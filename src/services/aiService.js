// ─── Multi-provider AI Service ────────────────────────────────────────────────
// Supports Gemini, OpenAI (ChatGPT), and Sarvam AI.
// Provider is selected in Settings → stored as settings.aiProvider
// API key stored as settings.geminiApiKey (reused for all providers)

// ─── Response Sanitiser ───────────────────────────────────────────────────────
function cleanResponse(text) {
  if (!text) return null;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim() || null;
}

// Gemini model fallback chain — tries each in order until one works
// gemini-2.0-flash is primary; 1.5-flash is the most permissive free-tier fallback
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

const PROVIDERS = {
  gemini: {
    name: 'Gemini',
    endpoint: (key, model = GEMINI_MODELS[0]) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    buildBody: (prompt) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.6 },
    }),
    parseResponse: (data) => cleanResponse(data?.candidates?.[0]?.content?.parts?.[0]?.text),
    authHeader: null,
  },
  openai: {
    name: 'ChatGPT (OpenAI)',
    endpoint: () => 'https://api.openai.com/v1/chat/completions',
    buildBody: (prompt) => ({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.6,
    }),
    parseResponse: (data) => cleanResponse(data?.choices?.[0]?.message?.content),
    authHeader: (key) => `Bearer ${key}`,
  },
  sarvam: {
    name: 'Sarvam AI',
    endpoint: () => 'https://api.sarvam.ai/v1/chat/completions',
    buildBody: (prompt) => ({
      model: 'sarvam-m',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.6,
    }),
    parseResponse: (data) => cleanResponse(data?.choices?.[0]?.message?.content),
    authHeader: (key) => `Bearer ${key}`,
  },
};

export const AI_PROVIDER_OPTIONS = Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name }));

// ─── Core askAI — Gemini tries all fallback models automatically ──────────────
export async function askAI(prompt, apiKey, provider = 'gemini') {
  if (!apiKey?.trim()) return null;
  const p = PROVIDERS[provider] ?? PROVIDERS.gemini;

  // For Gemini: try each model in fallback chain
  const modelsToTry = provider === 'gemini' ? GEMINI_MODELS : [null];

  for (const model of modelsToTry) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (p.authHeader) headers['Authorization'] = p.authHeader(apiKey.trim());

      const endpoint = model ? p.endpoint(apiKey.trim(), model) : p.endpoint(apiKey.trim());
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(p.buildBody(prompt)),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err?.error?.message || '';
        const status = res.status;

        // 429 = quota exceeded for this model, try next
        if (status === 429 && model && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
          console.warn(`[ExamHQ AI] Model ${model} quota hit, trying next model...`);
          continue;
        }

        console.error('[ExamHQ AI]', status, errMsg);
        return null;
      }

      const data = await res.json();
      const result = p.parseResponse(data);
      if (result) return result;
      // Empty response — try next model
      continue;

    } catch (e) {
      console.error('[ExamHQ AI]', e?.message);
      if (modelsToTry.indexOf(model) < modelsToTry.length - 1) continue;
      return null;
    }
  }
  return null;
}

// ─── Key Verification — returns { ok, message } instead of just boolean ───────
// Does NOT require billing — uses the lightest possible request
export async function testApiKey(apiKey, provider = 'gemini') {
  if (!apiKey?.trim()) return { ok: false, message: 'No API key entered.' };

  const p = PROVIDERS[provider] ?? PROVIDERS.gemini;
  const modelsToTry = provider === 'gemini' ? GEMINI_MODELS : [null];

  for (const model of modelsToTry) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (p.authHeader) headers['Authorization'] = p.authHeader(apiKey.trim());

      const endpoint = model ? p.endpoint(apiKey.trim(), model) : p.endpoint(apiKey.trim());

      // Minimal 1-token prompt to save quota
      const body = provider === 'gemini'
        ? { contents: [{ parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 5, temperature: 0 } }
        : p.buildBody('Hi');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return { ok: true, message: `Connected via ${model || provider}. AI features are active.` };
      }

      const err = await res.json().catch(() => ({}));
      const errMsg = err?.error?.message || '';
      const status = res.status;

      // 400 = bad request but key is valid (still counts as working key)
      if (status === 400) {
        return { ok: true, message: `Key valid. Connected via ${model || provider}.` };
      }

      // 401 / 403 = truly invalid key
      if (status === 401 || status === 403) {
        return { ok: false, message: 'Invalid API key. Go to aistudio.google.com and create a new key.' };
      }

      // 429 = quota exceeded but KEY IS VALID — this is success for verification
      if (status === 429) {
        // Try next model in chain for Gemini
        if (model && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
          continue;
        }
        // All models hit quota — key is valid, just rate limited
        return { ok: true, message: 'Key valid! Daily quota reached for today — try again tomorrow or use a different model.' };
      }

      // For other errors, try next model
      if (model && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
        continue;
      }

      return { ok: false, message: errMsg || `Error ${status}. Try creating a fresh key at aistudio.google.com.` };

    } catch (e) {
      if (model && modelsToTry.indexOf(model) < modelsToTry.length - 1) continue;
      return { ok: false, message: 'Network error. Check your internet connection and try again.' };
    }
  }

  return { ok: false, message: 'Could not connect to AI service. Try again.' };
}
