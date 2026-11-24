# LiLab V2.0: running costs and how they were lowered

All the recommendations from the first review are now built into V2.0. The code changes are done. The steps in **Turn it on** need someone with access to the Google Cloud and Firebase consoles, because this repo can't change those settings.

## What changed

### 1. Cloud SQL retired: Firestore is the only database
- Every `syncRecordToSql` / `syncBatchToSql` / `deleteRecordFromSql` call is gone from the app (≈75 call sites), along with `src/services/sqlSyncClient.ts`, `src/db/`, the `/api/sql/*` routes, and the `drizzle-orm` / `drizzle-kit` / `pg` runtime dependencies.
- The admin console used to copy **every record** to Postgres 2.5 seconds after **any** change it saw. That alone kept Cloud Run and Cloud SQL busy while an admin had the console open. It no longer exists.
- Server role checks now read `users/{uid}` from Firestore with the Admin SDK (`src/lib/firebase-admin.ts`).
- Curriculum PDFs and media files that lived in Postgres as base64 now live in **Cloud Storage** (`src/services/storageMaterials.ts`): `protected_materials/{noteId}/…` and `media/{key}`. The read-only viewer and `/api/media/:key` work as before.

### 2. Fewer Firestore reads
- **Local cache on**: the browser keeps an IndexedDB copy (`src/firebase.ts`). When a screen re-opens, its listener resumes from the cache and only pays for documents that changed.
- **Catalogues are read once, not watched** (`src/services/catalogueReads.ts`): programs, curriculum notes, bank details and academy events are fetched once per 10 minutes and shared across screens, for parents, students and teachers. Admin screens stay live because admins edit them. Admins switching "View as" refreshes them.
- **Growing lists are capped**: payment reminder log → newest 300; exercise submissions → newest 500.
- **Sign-in is cheaper**: the resolved profile is kept for the browser tab session, so reloads skip up to 4 reads. Signing out clears it. (A role change made by an admin applies the next time that person opens the app in a new tab.)
- The automatic "connection test" read on every page load is removed.

### 3. Cheaper AI
- **Narration is recorded once, ever.** `/api/ai/tts` checks memory, then Cloud Storage (`narration/{hash}.json`), and only calls Gemini when both miss. Each new clip is saved to Storage, so every server instance reuses it.
- **Speaking Lab pre-recording script**: `npm run narration:generate` records all 8,794 Speaking Lab words and phrases (one voice) into Storage ahead of time. It skips clips that already exist. Try `-- --dry-run` first, then `-- --level pre_a1 --limit 50`.
- **Model per feature**: `LILAB_STORY_MODEL`, `LILAB_SPEAKING_MODEL` and `LILAB_TTS_MODEL` can be set in Secrets. Story Studio only needs JSON, so point `LILAB_STORY_MODEL` at the cheapest Flash-Lite model your key can use.
- **Shorter speaking recordings**: auto-stop at 12 s for phrases and 6 s for words (was 14 s / 7 s). Gemini bills audio by length.
- **Guest protection**: chat and translate still work without sign-in, but guests get 10 requests per 5 minutes and share a daily cap (`LILAB_GUEST_DAILY_AI_CAP`, default 300 per server instance). Signed-in users are limited per account instead of per IP.
- **App Check ready**: set `VITE_RECAPTCHA_SITE_KEY` (web) and `LILAB_REQUIRE_APP_CHECK=true` (server). Calls from scripts and bots are then refused.
- Translations and narration still have the in-memory cache added earlier.

### 4. Hosting sized for a small academy
- `npm start` refuses to run without a built `dist/` (`scripts/ensure-build.mjs`) and always sets `NODE_ENV=production`. Before, a missing build silently started the heavy Vite development server.
- `deploy/cloudrun-service.yaml`: 0 minimum instances, 3 maximum, CPU billed only during requests, 512 MiB, concurrency 80.
- `firebase.json`: the site is served from Firebase Hosting's CDN and only `/api/**` goes to Cloud Run. Images, JS and CSS never wake a server.
- `Dockerfile` for deploying outside AI Studio.

### 5. Housekeeping
- AI Studio screenshots and the schedule PDF moved from `public/` (publicly downloadable) to `docs/aistudio-reference/`.
- One lockfile: `package-lock.json` (npm). `bun.lock` removed.
- Package renamed `lilab`, version `2.0.0`.

## Turn it on (console steps)

1. **Copy files out of Postgres before deleting it.** From a machine that can reach the database:
   `SQL_HOST=… SQL_USER=… SQL_PASSWORD=… SQL_DB_NAME=… npm run migrate:sql-to-storage`
   It copies materials and media to Cloud Storage and prints a row-count comparison against Firestore. Investigate any table marked "check" before you go on.
2. **Give the Cloud Run service account Storage access** (Storage Object Admin on the `gen-lang-client-0900806695.firebasestorage.app` bucket), if it doesn't already have it.
3. **Deploy V2.0**, confirm curriculum PDFs open in the viewer, then **stop and delete the Cloud SQL instance** and remove the `SQL_*` secrets.
4. **Optional: pre-record narration** with `npm run narration:generate`. It needs `GEMINI_API_KEY` and Storage credentials, and is safe to stop and re-run.
5. **Cloud Run sizing**: in AI Studio's deploy settings, or with `gcloud run services replace deploy/cloudrun-service.yaml`, set min instances 0 and max 3.
6. **Optional: Firebase Hosting in front**: `firebase deploy --only hosting` (edit the Cloud Run service name/region in `firebase.json` first).
7. **Budget alerts**: Google Cloud Billing → Budgets & alerts, at 50%, 90% and 100% of a monthly amount you choose. Also set a spend cap on the Gemini API key in AI Studio.
8. **Optional: App Check**: register the web app with reCAPTCHA Enterprise in Firebase → App Check, add the two settings above, and turn on enforcement once traffic shows verified requests.

## Clickable preview

`npm run build:preview` builds a version of the app that runs entirely in the browser. Firestore and sign-in are replaced by an in-memory stand-in with sample data (`preview/`), and a bar at the bottom switches between the parent, student, teacher and admin portals. AI features need the real server, so they show an error in the preview. The production build doesn't include any preview code.
