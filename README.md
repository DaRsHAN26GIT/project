# RuralClass AI

**One Teacher. Multiple Grades. Continuous Learning.**

An offline-first, fictional classroom demonstration built with Next.js App Router, React, TypeScript, Tailwind, Motion, Recharts, and lazy-loaded React Three Fiber. No API keys or login are needed for the local scheduling workflow.

## Run

Node.js 22+ is recommended (prepared with Node 24). From `/workspace/project`:

```sh
npm ci
npm run dev
```

For production and service-worker testing:

```sh
npm run build
npm start
```

Service-worker registration is production-only. Open all routes once while online, then disable network in browser developer tools and reload a cached route. Resources become available only after successful caching. Do not assume a first-ever visit works without internet. Service workers require HTTPS outside localhost. No external fonts or model assets are needed in 2D mode.

## Classroom workflow

1. Open the no-login dashboard (fictional Class 2, 3, 4).
2. Use Timetable Studio to change students, subjects, priorities, required minutes, learning levels, available time, and breaks.
3. Generate; inspect unmet requests; approve and save to IndexedDB.
4. Open Learning Continuity for primary, follow-up, easier, and checkpoint tasks. Approve templates and mark completion.
5. In Replanning Lab introduce lost minutes and a grade needing support. Compare both actual schedules and approve the revised day.
6. Classroom Simulation plays actual schedule blocks; click a row or use the timeline to inspect a block.
7. Add assessments to update grade charts and support recommendations. Scores below 60% flag support; this is a transparent rule, not a predictive model.
8. Offline Workspace stores attendance and observations, exports JSON, and provides account-scoped synchronization.
9. Presentation Mode offers five guided steps without cloud services.

The scheduling engine uses a deterministic priority-weighted fair-share greedy heuristic in at-most-ten-minute teaching blocks. It allocates at most one teacher, respects breaks and the available horizon, and reports every unallocated requested minute. Independent tasks cover other groups. It does **not** claim mathematical optimality, validated pedagogical outcomes, or field-testing results. Priority is weighted by a transparent teacher-entered support level (1.3 for “Needs support” or “Struggling”, 1.1 for “Developing”, otherwise 1) and square-root group size. Alternatives support lower levels without pretending to infer individual ability.

## Optional Supabase

Copy `.env.example` to `.env.local` and configure the project URL and public anon key. Never place service-role keys in browser code. Run `supabase/schema.sql` in your Supabase SQL editor, configure authorized site/redirect URLs, and enable email/password authentication. Email confirmation may be required.

The database uses one typed `records` table with ownership enforced by PostgreSQL RLS. Record kinds represent teachers/profiles, classrooms, minimized student records, assessments, timetables, activities, completion, observations, and attendance. This avoids repeating identical ownership policies across tables. The public demo never uploads its fictional local data. Signed-in records have a distinct local namespace. `save_record` enforces optimistic revision checks; retries cannot silently overwrite another client. Conflicts stop synchronization and preserve local edits for export and manual resolution. A failed batch may have synced some earlier rows; each acknowledged record is tracked separately.

Shared-device privacy: IndexedDB is durable and **not encrypted**. Sign-out scopes UI access but is not protection from another user who can inspect browser storage. Avoid identifiable student data, export and clear device records when finished. Signed-in private records synchronize on reconnect and through the Synchronize button. Demo data is never uploaded.

## Optional OpenAI

Set `OPENAI_API_KEY` server-side and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). The API route verifies a Supabase bearer session before spending the key. OpenAI Responses uses seven strict-schema function tools to read classroom details, generate/replan timetables, retrieve activities and assessment summaries, and explain changes; the same deterministic engine calculates every proposal. No proposal is saved automatically. Kannada can be requested in the prompt; offline commands are limited English intents, not a cloud language model. Production deployments should add durable user quotas and provider budget limits before opening registration broadly.

Without cloud configuration, the local assistant handles “Generate today’s timetable”, “Reduce time to 2 hours”, “Prioritize Class 3”, and “Show Class 2 activities.” It labels local execution honestly. Hugging Face models were intentionally omitted: essential offline scheduling needs no downloaded model.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:browser
```

Browser tests use system Chromium when available; otherwise run `npx playwright install chromium` first, or set `CHROMIUM_PATH`. Start the production server before running browser tests.

Engine tests cover input validation, one-teacher constraints, break boundaries, infeasible requests, activities, replanning, local assistant commands, and revision conflict decisions. `tests/browser.cjs` covers browser navigation, replanning, persistence, accessibility basics, responsive layout, 2D fallback, and offline reload after cache initialization when run against a production server. Online Supabase policies and OpenAI responses require configured services for integration testing.

## Deployment

Import this repository into Vercel as a Next.js project. Set optional environment variables in Vercel project settings; do not commit `.env.local`. Build with `npm run build`. Apply Supabase SQL and configure its site URL if cloud accounts are enabled. No deployment or public URL is claimed until verified.

## Research

The Impact page links to official UDISE+ and ASER sources without fabricating statistics. Counts of single-teacher schools must not be described as counts of multi-grade classrooms. The project has not conducted field trials.

## Updated teacher companion

The assistant now uses local shadcn/ui components (Radix Dialog and Tabs, Button, Badge, Card, Textarea), keeping RuralClass's original colours. It includes account-scoped conversation history, contextual grade/time information, timetable comparisons with explicit approval or dismissal, worksheet creation, answer-key controls, print/download, conversation export, keyboard submission, and request cancellation. Follow-up planning uses the latest draft; approved and superseded proposals are kept distinct.

The local assistant supports planning commands and deterministic Mathematics/Reading worksheet templates, including correct answer keys. It is clearly labelled **Local tools**, not cloud AI. Saved chat records join the existing Supabase ownership/sync flow when authenticated. Fresh Supabase projects can use `supabase/schema.sql`; existing projects must also apply `supabase/migrations/20261030_conversations.sql` to permit conversation records. The same RLS policies remain in effect. IndexedDB is not encrypted: do not put personal child information in chat on a shared device.

### Connect live AI in your VS Code project

1. Create `.env.local` **beside `package.json`**, using `.env.example` as a guide. Keep the file private; it is ignored by Git.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using your Supabase project settings. Apply the SQL schema and enable email/password authentication.
3. Choose **one** server-side AI provider:
   - OpenAI: `AI_PROVIDER=openai`, `OPENAI_API_KEY=...`, and optionally `OPENAI_MODEL=gpt-4.1-mini`.
   - Hugging Face: `AI_PROVIDER=huggingface`, `HF_TOKEN=...`, and `HF_MODEL=...`. Choose an available Inference Provider model with tool-calling support. Model availability, permissions, and billing depend on your HF account; no model is bundled or downloaded into the browser.
4. Stop the server with Ctrl+C, then restart with `npm.cmd run dev` on Windows (or `npm run dev` elsewhere).
5. Sign in through **Teacher portal**. In **Teacher assistant → Settings**, confirm that authentication and the provider are configured. The badge shows the active mode. The language selector requests English or Kannada; quality depends on the configured model and has not been language-validated. Local commands remain English.

Cloud requests use bounded conversation history, strict function schemas, server-side provider credentials, a verified Supabase session, cancellation/timeouts, and a demo per-instance rate limit. The provider can call the real scheduler or prepare a worksheet, but has no save/approval tool. Hugging Face uses its OpenAI-compatible Inference Providers chat endpoint; a model that does not support the declared tools will return an error. Retry or use local tools without losing the thread. Live provider calls and cloud RLS integration still require real project credentials for validation; transport tests use mocks.

### Easier Windows startup

Extract the **entire** ZIP, then double-click `start-windows.cmd` in the same folder as `package.json`. It installs the locked dependencies and starts the website. Node.js must already be installed. Alternatively, in VS Code's terminal in that folder, run `npm.cmd ci` followed by `npm.cmd run dev`.
