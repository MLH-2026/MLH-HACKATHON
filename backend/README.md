# WhatNow backend

Express powers the beginner coding guidance loop: a user-approved screenshot goes to Gemini, which returns one guiding question or next step. Users can request a stronger hint or submit a fresh screenshot for feedback. The normal application uses Google's official `@google/genai` SDK; fake Gemini responses are confined to tests.

The backend builds on the teammate's Node/Express package from `feature/gemini-backend`, preserving its `backend` package name and ESM setup. The React playground in `frontend/` currently uses scripted hints. The earlier AI planning checklist suggested a whole hint ladder with different response fields; this API returns one requested step at a time using the contract in [API.md](API.md). Frontend, desktop capture, and the AI teammate's files remain separate.

## Run on macOS

Use Node.js 22.12 or newer. From the repository root:

```bash
npm --prefix backend install
test -e backend/.env || cp backend/.env.example backend/.env
```

Edit `backend/.env` and set `GEMINI_API_KEY` to your own Gemini API key. Keep it server-side; do not use a `VITE_` variable or include it in frontend code. An existing `.env` is preserved by the command above.

```bash
npm --prefix backend start
```

Use one server process: sessions live in memory and are lost on restart. The server reads `backend/.env`; exported environment variables take precedence. The backend is a standalone npm package; frontend dependencies and root npm scripts are unchanged.

```bash
curl http://127.0.0.1:8000/health
```

The [API contract](API.md) includes endpoint details, errors, and frontend examples. A healthy service can report `gemini_configured: false`; health does not call Gemini or verify a key, quota, or model access.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listening interface. |
| `PORT` | `8000` | Backend port. |
| `GEMINI_API_KEY` | unset | Required for real guidance requests. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model used for image understanding and structured guidance. |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Deadline for a Gemini request. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins allowed by CORS. |
| `MAX_IMAGE_BYTES` | `5242880` | Per-upload limit, 5 MiB. |
| `MAX_IMAGE_PIXELS` | `16000000` | Maximum decoded screenshot pixel count. |
| `SESSION_TTL_SECONDS` | `1800` | Idle session lifetime, 30 minutes. |
| `MAX_SESSIONS` | `32` | Maximum retained sessions. |
| `HISTORY_LIMIT` | `8` | Maximum retained interactions per session. |
| `CLEANUP_INTERVAL_SECONDS` | `30` | Expired-session cleanup interval. |
| `MAX_INFLIGHT_REQUESTS` | `8` | Maximum concurrent HTTP requests. |
| `TUTORING_PROMPT_MODULE` | unset | Optional trusted AI teammate module, relative to `backend/`; see the handoff below. |

Set `ALLOWED_ORIGINS` to explicit HTTP(S) origins served by the frontend. An Electron renderer loaded from `file://` should route requests through its main process or use an allowed HTTP origin; see [API.md](API.md). CORS is a browser integration setting; this local demo has no accounts or authentication. Bind to `127.0.0.1` for the local demo.

## Request flow and files

1. Create a session with the learning goal.
2. Send `initial` with a screenshot and optional question. The first successful response starts at hint level 1.
3. Send `more_hint` to reuse the latest screenshot and context. Specificity increases to level 3; further requests stay at that level and should offer another useful angle.
4. Send `check_again` with a newly captured screenshot. Gemini receives the previous and current work for comparison, while the hint level stays unchanged.
5. Reset before an unrelated problem, or delete the session when finished.

| File | Responsibility |
| --- | --- |
| `src/server.js` | Server startup and shutdown. |
| `src/app.js`, `src/multipart.js` | Express routes, action handling, bounded Busboy upload parsing, and success-only session updates. |
| `src/gemini.js` | Gemini SDK calls, deadlines, and upstream error handling. |
| `src/coaching.js`, `src/prompt-loader.js` | Baseline coaching rules and optional AI teammate prompt loading. |
| `src/guidance.js` | Structured guidance schema and server-side validation. |
| `src/sessions.js` | Bounded in-memory sessions, expiration, and overlapping-request handling. |
| `src/images.js` | Image decoding with Sharp and format, byte, and pixel validation. |
| `src/config.js`, `src/errors.js` | Environment settings and predictable errors. |
| `test/*.test.js` | Built-in Node tests with explicit fake Gemini responses. |

Session memory retains the goal, current problem context, latest validated screenshot, hint level, and a bounded interaction history. A check request temporarily includes the previous screenshot for comparison; successful checks replace the retained screenshot. Reset, deletion, and expiration clear retained problem context. Screenshots are not written to application storage or logged. Gemini receives the submitted content, so Google's API data handling also applies.

Only successful guidance requests update the hint level, screenshot, or history. Requests overlapping on one session fail with `409` rather than racing. Requests are not automatically retried: retries could incur another Gemini request. Model JSON is validated, but schema validation cannot prove that the advice is correct; prompts require uncertainty when evidence is missing.

## AI teammate handoff

The backend owns HTTP transport, sessions, screenshot handling, validation, and the response contract. The AI teammate owns tutoring policy and prompt refinement through `TUTORING_PROMPT_MODULE`, with additions kept in their own files. For example, a module can live in `AI/gemini/tutoring.js`. To load it, set this optional backend environment variable:

```dotenv
TUTORING_PROMPT_MODULE=../AI/gemini/tutoring.js
```

The trusted ESM module exports a synchronous `buildTutoringInstructions({ action, hintLevel })` function returning an instruction string of at most 20,000 characters. The server checks the exported function at startup and validates its return value during each guidance request. A blank string keeps the baseline instructions. Nonblank instructions are appended to those rules and do not replace the guardrails. Do not point this setting at uploaded or user-provided code.

The internal Gemini request and response shapes are documented in [API.md](API.md#ai-boundary-contract). If the AI teammate's preferred output differs, adapt it at the Gemini boundary while preserving the public five-field response. The backend supplies `hint_level`; model output does not control progression.

## Checks and live verification

```bash
npm --prefix backend run check
npm --prefix backend test
```

Tests use a mocked Gemini boundary or mocked SDK response; they do not spend quota. A real screenshot-to-Gemini request still needs verification with a valid API key, model access, and available quota. After setup, follow the first two `curl` examples in [API.md](API.md) using a real screenshot, then exercise `more_hint` and `check_again`. Confirm that the first response is a concise guiding question, stronger hints add detail, and checks describe only visible changes.

The implementation follows [Google's Gen AI JavaScript SDK](https://github.com/googleapis/js-genai), [image understanding documentation](https://ai.google.dev/gemini-api/docs/image-understanding), and [structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output). Available models and quotas vary by project; `GEMINI_MODEL` can be changed without editing source.
