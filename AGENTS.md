<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- All AI (learning JSON calls, plan-coach streaming via Gemini OpenAI-compatible endpoint, and TTS) calls Google Gemini directly with server-side `GEMINI_API_KEY` — runs independently of Lovable when self-hosted; handlers live in `src/lib/coach.functions.ts`, plan-coach HTTP route delegates to a bearer-validated handler.
- Server functions use the caller's RLS-scoped client (`context.supabase`), never the admin client — user data isolation is enforced by RLS on every table (`user_id = auth.uid()`).
- Day activities are generated lazily when a day is first opened — so each day can use performance from earlier days and the latest weakness history.
- When changing the study sequence, reorder existing study-day rows by subject while retaining their IDs and activity/session references — preserves completed work under the correct day.
- Questions, answers and per-question results live as JSON inside `activities` (content / answers / results) rather than separate tables — one activity is always read/written as a unit.
- Activity kinds (`task`, `flashcards`, `quiz`, `listening`, `conversation`) each map to one player in `src/components/coach/players.tsx`; add a new kind by extending the AI schema and adding a player.
- Supported target languages are registered in `src/lib/languages.ts`; `weekly_lessons.language` and `vocabulary.language` carry the code so more languages can be added without schema changes.
- Uploaded homework is stored in the private `homework` bucket under `<user_id>/<lesson_id>/…`; storage RLS checks the first folder equals `auth.uid()`.
- Spoken audio comes from `/api/tts` (Lovable AI Gateway TTS, auth-checked, WAV) via `src/lib/voice.ts` with per-text caching; voice input still uses browser speech recognition — natural voices instead of robotic device voices.
- Authenticated pages live under `src/routes/_authenticated/` with a client-side session gate (`ssr: false`), since sessions are stored in the browser.
- Office/RTF homework files are converted to plain text in the browser (`src/lib/extract-text.ts`) and stored as `.txt` documents (original kept under `originals/`) — the analyzer only reads images, PDFs and text.
- Weekly plan customization: immutable original day snapshots, account-owned route-addressed chat threads, and learner-approved proposals (additions, soft removals via `activities.removed_at`, minute changes) applied atomically in SQL; completed work and Day 1 gate activities are protected, and removed originals still count as "generated" so lazy generation never re-runs.
