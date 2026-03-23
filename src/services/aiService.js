// ─── Multi-provider AI Service ────────────────────────────────────────────────
// Supports Gemini, OpenAI (ChatGPT), and Sarvam AI.
// Provider is selected in Settings → stored as settings.aiProvider
// API key stored as settings.geminiApiKey (reused for all providers)

// ─── Response Sanitiser ───────────────────────────────────────────────────────
// Strips <think>...</think> blocks that some models (Gemini Flash Thinking,
// DeepSeek, etc.) expose as chain-of-thought. User must never see these.
function cleanResponse(text) {
  if (!text) return null;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')   // <think> blocks
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '') // <reasoning> blocks
    .replace(/```json\s*/g, '')                  // stray code fences
    .replace(/```\s*/g, '')
    .trim() || null;
}

const PROVIDERS = {
  gemini: {
    name: 'Gemini',
    endpoint: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    buildBody: (prompt) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.6 },
    }),
    parseResponse: (data) => cleanResponse(data?.candidates?.[0]?.content?.parts?.[0]?.text),
    authHeader: null, // key goes in URL
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

export async function askAI(prompt, apiKey, provider = 'gemini') {
  if (!apiKey?.trim()) return null;
  const p = PROVIDERS[provider] ?? PROVIDERS.gemini;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (p.authHeader) headers['Authorization'] = p.authHeader(apiKey.trim());

    const res = await fetch(p.endpoint(apiKey.trim()), {
      method: 'POST',
      headers,
      body: JSON.stringify(p.buildBody(prompt)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[ExamHQ AI]', res.status, err?.error?.message || err);
      return null;
    }
    const data = await res.json();
    return p.parseResponse(data);
  } catch (e) {
    console.error('[ExamHQ AI]', e?.message);
    return null;
  }
}

export async function testApiKey(apiKey, provider = 'gemini') {
  const result = await askAI('Reply with exactly the word: OK', apiKey, provider);
  return result?.trim().includes('OK') ?? false;
}
