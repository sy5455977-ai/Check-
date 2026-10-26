# Universal Multi-Platform Deployment Fix Plan

Ensure Blackbell AGI runs seamlessly and consistently across **Google AI Studio**, **Netlify**, **Vercel**, and **Hostinger** without breaking any existing feature, UI, or real-time capability.

---

## Confirmed User Selections & Critical Decisions

> [!IMPORTANT]
> The following technical approach was confirmed based on your preferences:

- **Backend & API Strategy**: **Full Hybrid Support** — Serverless Express adapter (`api/index.ts`) for Vercel/Netlify functions with intelligent client-side API fallback (`callDirectGeminiChat` & `generateGeminiDirectTTS`) for static environments.
- **Gemini API Key Configuration**: **Dual Mode** — Server-side environment variables (`GEMINI_API_KEY` / `GEMINI_API_KEYS`) with automatic key rotation plus interactive client-side key modal fallback (`ApiKeyModal.tsx`).
- **Deployment Files & Adapters**: **All 3 Platforms** — Pre-configured `vercel.json`, `netlify.toml`, and Hostinger `ecosystem.config.js` (PM2) plus build scripts.

---

## 1. Core Architecture & Runtime Matrix

| Feature / System | Google AI Studio / Hostinger (Node.js Express) | Netlify & Vercel (Serverless / Static) |
| :--- | :--- | :--- |
| **HTTP API (`/api/*`)** | Express server (`server.ts` on port 3000) | Serverless Function (`api/index.ts`) + Direct client fallback |
| **Gemini AI Chat** | Server proxy via `@google/genai` with cascade fallback | Serverless function OR direct client call (`geminiClient.ts`) |
| **Real-time Voice** | Express WebSocket server (`ws`) | Web Speech API / Gemini Direct Audio TTS REST fallback |
| **Database Storage** | Local SQLite (`better-sqlite3` in `/db.sqlite`) | In-memory / LocalStorage fallback guard for serverless |
| **Image Proxy & Web Search** | Node.js backend proxy (`/api/image-proxy`, `/api/search`) | Serverless API route + Client CORS-safe fallback |

---

## 2. User Experience & Feature Preservation

All existing views, dark/light theme options, Blackbell video animations, voice controls, admin panel settings, handwritten note generator, APK builder UI, and custom key modals will be preserved 100% intact.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Blackbell AGI Frontend                          │
│     (React + Tailwind + BellVideoScreen + Admin + Notes + APK)         │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
      [ Server Available? ]                 [ Serverless / Static? ]
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│ Express Server (Node/Hostinger/AIS)  │  │ Netlify/Vercel Serverless    │
│ - SQLite Database (/db.sqlite)       │  │ - api/index.ts Serverless    │
│ - WebSockets (ws://) for Live Voice  │  │ - Direct Client Gemini REST  │
│ - Gemini Cascade Key Rotation        │  │ - Web Speech API / TTS       │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 3. Key Technical Fixes & Code Changes

### A. Universal Serverless API Adapter (`/api/index.ts`)
- Create a serverless Express handler (`api/index.ts`) that imports core router logic without launching a blocking `server.listen()` or raw `ws` socket listener.
- Protect `better-sqlite3` calls with try/catch file-access guards so read-only serverless filesystems (Vercel/Netlify) do not crash the lambda function.

### B. Client-Side Resilience & Multi-Platform Fallbacks (`src/utils/geminiClient.ts` & `src/App.tsx`)
- Enhance `callDirectGeminiChat` and `generateGeminiDirectTTS` to check if `/api/chat` is reachable; if the server responds with 404/500 or network error, transparently fall back to client-side direct Gemini REST calls using `GEMINI_API_KEY` / `GEMINI_API_KEYS` or user modal key.
- Enhance voice mode in `App.tsx`: if WebSockets (`ws://`) fail to connect (as on Netlify/Vercel static hosting), automatically fall back to Web Speech API recognition and Gemini TTS audio response.

### C. Deployment Configurations
1. `vercel.json`:
   - Builds: Vite static frontend output to `dist`, Serverless function for `/api/*`.
   - Rewrites: Map `/api/(.*)` to `/api/index.ts` and `/*` to `/index.html` for single-page routing.
2. `netlify.toml`:
   - Build settings: `command = "npm run build"`, `publish = "dist"`, `functions = "netlify/functions"`.
   - Redirects: `/api/*` to `/.netlify/functions/api/:splat 200!` and `/*` to `/index.html 200`.
3. `ecosystem.config.js` (Hostinger PM2):
   - PM2 cluster mode script targeting `dist/server.cjs` or `tsx server.ts`.
   - Environment variables setup (`PORT=3000`, `NODE_ENV=production`).

### D. Package & Build Scripts (`package.json` & `vite.config.ts`)
- Update build scripts to cleanly bundle static assets and serverless functions without native module errors.
- Ensure all static routes and SPA fallbacks are configured properly.

---

## 4. Verification & Testing Plan

1. **Compilation Check**: Run `compile_applet` / `npm run lint` to verify zero TypeScript or bundle syntax errors.
2. **Local Production Build Test**: Run `npm run build` to ensure `dist/` builds without errors.
3. **Fallback Verification**: Verify that client-side API fallback and key rotation operate smoothly when backend proxy is unavailable.
