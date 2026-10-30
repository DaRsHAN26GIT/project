# Validation evidence

Recorded 31 October 2026 at 03:43 (Asia/Kolkata). Scope: the implementation in this change set, tested in the managed Linux environment with Node.js and system Chromium.

| Check | Observed result |
| --- | --- |
| npm test | 24 native Node tests executed and passed |
| npm run typecheck | Passed |
| npm run lint | Passed |
| npm run build | Production Webpack build passed; assistant, health, and scheduling API routes emitted |
| Main browser suite | Teacher journey, constraints, persistence, mobile navigation, offline reload, 2D fallback, and real 3D rendering passed |
| Assistant browser suite | Conversations, approval/dismissal, worksheets, answer keys, printing/download, keyboard dialogs, mobile layout, and offline commands passed |
| Classroom regression | Repeated 3D mounts, grade changes, and 2D unmounts passed with no captured React root warnings or page errors |
| Judge browser suite | All six rubric panels, real health and scheduling API requests, frontend/backend parity, invalid/oversized request rejection, report exports, safe printing, mobile layout, and cached offline challenge passed |
| Connectivity recovery | Failed network check cleared stale service status; an online retry verified actual parity again |

## The reported 3D defect

The previous Drei Html labels reproduced the synchronous React-root unmount warning and a removeChild exception in development Strict Mode. Native Three.js canvas-texture sprites replaced those nested DOM roots. The same repeated-switch regression then passed in development mode, and the production browser checks passed as well. No Strict Mode suppression was introduced.

## Evidence boundaries

The server scheduling request was made to the actual running Next.js route and compared to the browser's locally calculated result. API health used the actual backend, not a mocked success indicator. Test-provider tool-call fixtures use mocked OpenAI and Hugging Face transports; no live cloud-model call is claimed.

Supabase and live provider credentials were not configured in this environment. Actual private-account authentication, database writes, cross-account RLS behavior, live model quality/languages, and a Vercel deployment URL were not validated. Configuration-only statuses are labelled accordingly. No field trial, measured learning gain, or teacher-acceptance result is claimed.

Screenshots in docs/screenshots are captures from the running production app with fictional scenarios. CI results can be inspected in the repository's Actions tab after push; a local pass does not establish that remote CI has completed.
