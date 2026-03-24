# ExamHQ 📚

An all-in-one exam preparation PWA built for JEE, CET, MET, and UGEE aspirants. Track study sessions, manage chapters, log mock scores, use spaced-repetition flashcards, plan your schedule, and get AI-powered advice — all offline-first in your browser.

## 🔗 Live App

> [https://1st-app-three.vercel.app](https://1st-app-three.vercel.app)

## ✨ Features

- **Dashboard** — Daily study heatmap, streak tracker, AIR estimator, mood logger
- **Timer** — Pomodoro + custom session tracker with subject tagging
- **Chapters** — Full JEE/CET/MET/UGEE syllabus with completion tracking and decay scoring
- **Scores** — Mock test log with rank predictor and trend charts
- **Weights** — Subject-wise priority tuning for adaptive scheduling
- **Planner** — Daily task planner + sprint mode
- **Flashcards** — Spaced Repetition System (SRS/SM-2 algorithm)
- **Notes** — Per-subject markdown notes with pin support
- **Advisor** — Gemini AI-powered study coach (bring your own API key)
- **Settings** — Themes, fonts, density, sound, export/import data

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand (with persist + migrate) |
| Routing | React Router v6 |
| Styling | Custom CSS with CSS variables |
| Notifications | Sonner |
| AI | Google Gemini API |

## 🚀 Running Locally

```bash
git clone https://github.com/clonephone16007-cpu/1st-app
cd 1st-app
npm install
cp .env.example .env        # add your GEMINI_API_KEY
npm run dev
```

## 🔑 Environment Variables

See `.env.example`. The only required variable is your Gemini API key for the Advisor feature:

```
VITE_GEMINI_API_KEY=your_key_here
```

The app works fully without it — Advisor page will just show a key input prompt.

## 📦 Data & Privacy

All data is stored **locally in your browser** via `localStorage`. Nothing is sent to any server. You can export/import your data as JSON from Settings.

## 📄 License

MIT
