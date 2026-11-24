# LiLab V2.0: running costs and how to lower them

This is a review of the LiLab codebase (branch `v2.0`), written to answer one question: what costs money when LiLab runs, and how can it run more cheaply?

## What the app runs on today

| Layer | What the code uses | Billed by |
|---|---|---|
| Web server | Express (`server.ts`) on Cloud Run, which is what an AI Studio deploy uses | CPU, memory and requests while instances are up |
| Sign-in | Firebase Auth (Google + email) | Free for these volumes |
| Main database | Firestore, read straight from the browser (52 `onSnapshot` listeners) | Each document read, write and delete |
| Second database | Cloud SQL Postgres. Every Firestore write is copied to it through `/api/sql/upsert` (`src/services/sqlSyncClient.ts`). Postgres also stores media files as base64 text (`media_assets.data_base64`) | An always-on instance, paid **even when nobody uses the app** |
| AI (Gemini) | `gemini-4-hydrogen` for stories and speaking scores, `gemini-3.8-flash-lite-tts` for narration | Tokens per call (audio input and output is the expensive part) |
| AI (OpenRouter) | `openrouter/free` for chat, translation and the kids coding lab | $0, but rate-limited and with no uptime guarantee |

## Already done in V2.0

1. **Narration and translations are cached on the server** (`server.ts`, `AiResponseCache`). When the same sentence is narrated with the same voice, or the same text is translated again, the stored result is returned and no new AI call is made. Narration is kept for 7 days (64 MB cap) and translations for 24 hours (8 MB cap). The Speaking Lab plays the same fixed phrases to every child, so most narration calls repeat.
2. **The AI assistant stops re-reading the whole academy each time it opens** (`src/services/academySearch.ts`). It used to read 10 full Firestore collections every time the drawer opened. It now reuses that data for 5 minutes per user.
3. **The sign-in page is lighter.** The 500 KB charts library (139 KB gzipped) was being preloaded on the sign-in page but only the dashboards use it. It now loads only when a chart is shown (`vite.config.ts`).
4. **Story backgrounds shrank from 4.2 MB to 0.74 MB** (the JPGs were converted to WebP at the same size). That means less Cloud Run bandwidth and faster pages on phones.
5. **The enrolment pop-up no longer covers the sign-in form.** It now opens once a day for parents after they sign in. This saves the promo bundle download for everyone who only came to sign in.

## Recommended next steps, biggest savings first

### 1. Retire the Cloud SQL copy (biggest fixed cost)
Firestore already holds all the data. Postgres is a copy that every write goes to twice. The Cloud SQL instance bills 24/7, so with low traffic it is probably most of the monthly bill.
- Point `/api/sql/overview` and `/api/sql/reset-all` at Firestore through `firebase-admin`, then remove `syncRecordToSql` calls and `src/db/`.
- Move `media_assets` and `protected_materials` to Cloud Storage, or to files in `public/`. The read-only PDF viewer can use short-lived signed URLs, which keeps the copy-protection.
- If you need SQL reporting, use the Firestore to BigQuery export: it costs nothing while idle.
- If you must keep Postgres, use the smallest shared-core tier and turn off high availability. Or move to a serverless Postgres that scales to zero.

### 2. Cut Firestore reads
None of the 52 real-time listeners uses `limit()`. Every listener reads every matching document when its screen opens, and again each time the user comes back to that tab. The worst offenders are `ParentStudentPortal` (9 listeners), `TeacherDashboard` (7) and `LearningResourceLibrary` (4).
- Add `where(...)`, `orderBy(...)` and `limit(...)` to every query. For example, a teacher only needs their own classes and this term's notes.
- For data that rarely changes (programs, academy events, curriculum notes), use a single `getDocs` instead of a live listener.
- Use `firebase/firestore/lite` on screens that don't need live updates. It is a much smaller download than the full SDK (currently the largest chunk, 173 KB gzipped).
- On sign-in, `syncUserProfile` runs up to 4 reads plus a SQL write every time. Cache the profile in `sessionStorage` for the session.

### 3. Spend less per AI call
- **Pre-record Speaking Lab narration.** The phrases in `src/data/speakingLab/*` are fixed. Generate each one once with a script and save them as audio files in Cloud Storage. Runtime narration cost for the lab then drops to about zero, and children hear audio instantly.
- **Use the cheapest Gemini model that does the job.** Story Studio only needs structured JSON, so try the Flash-Lite tier for it. Keep the stronger model for speaking scores, which already uses `thinkingLevel: LOW` (good).
- **Send smaller audio.** Before uploading for speaking scores, convert recordings to 16 kHz mono and trim the silence at both ends. Audio tokens scale with length.
- **Close the open doors.** `/api/ai/chat` and `/api/ai/translate` work without sign-in, and their rate limit lives in each server instance's memory. Cloud Run can start new instances, and each one resets the limit. Turn on Firebase App Check, or require sign-in for everything except a small guest quota.
- **Set budget alerts** in Google Cloud Billing and AI Studio so a runaway loop shows up in hours, not at month end.

### 4. Size Cloud Run to the traffic
- Minimum instances **0** (for an academy app, a ~1–2 s cold start is acceptable), a low maximum (e.g. 3), concurrency 80, 512 MiB, and CPU billed only while a request is running.
- Make sure the deploy runs `npm run build` and sets `NODE_ENV=production`. If `dist/` is missing, `server.ts` quietly falls back to the Vite development server. That uses far more memory and makes cold starts slow.
- Serve the built site from **Firebase Hosting** (a global CDN) and send only `/api/*` to Cloud Run. Images, JS and CSS then never wake a server.

### 5. Housekeeping
- `public/assets/aistudio/` (development screenshots and a schedule PDF) is deployed publicly. Move it out of `public/`.
- `bun.lock` exists but the scripts use npm/tsx. Pick one lockfile so the deploy installs the same versions every time.
- Rename the package from `react-example` to `lilab`.

## Rough priority

| Step | Effort | Savings |
|---|---|---|
| 1. Remove Cloud SQL | 1–2 days | Highest: removes a fixed monthly charge |
| 2. Firestore query limits | 1 day | High as the student count grows |
| 3. Pre-recorded narration + model tiers | Half a day | Medium to high, depending on Speaking Lab use |
| 4. Cloud Run sizing + Firebase Hosting | 1–2 hours | Medium |
| 5. Housekeeping | 30 min | Small |
