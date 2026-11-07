# Sidekick API

Local base URL: `http://127.0.0.1:8000`. JSON uses UTF-8. Session IDs are opaque strings. Successful guidance responses always contain all five fields below; `context_question` is explicitly `null` when clarification is unnecessary.

## Health

`GET /health` returns `200` without contacting Gemini:

```json
{
  "status": "ok",
  "gemini_configured": false,
  "model": "gemini-3.8-flash"
}
```

`gemini_configured` only reports whether the backend has a key. It does not confirm that Gemini accepts the key or that quota is available.

## Create a session

`POST /session` accepts `application/json`:

```json
{"goal": "Understand and fix my Python list indexing error"}
```

`goal` is a required, nonblank string, up to 2,000 characters after trimming surrounding whitespace. Unknown JSON fields are rejected. A successful `200` response contains a unique ID:

```json
{"session_id": "paste-the-returned-id-into-subsequent-requests"}
```

```bash
curl -X POST http://127.0.0.1:8000/session \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Understand and fix my Python list indexing error"}'
```

## Request guidance

`POST /hint` accepts `multipart/form-data`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `session_id` | nonblank string, up to 128 characters | yes | ID returned by `/session`. |
| `action` | string enum | yes | Exactly `initial`, `more_hint`, or `check_again`. |
| `screenshot` | image file | for `initial` and `check_again` | Actual PNG, JPEG, or WebP image, at most 5 MiB and 16 million pixels by default. |
| `question` | string | no | Up to 2,000 characters of user context; omit when absent. |

The server inspects decoded image data rather than trusting the extension or upload MIME type. Supply the matching upload MIME type (`image/png`, `image/jpeg`, or `image/webp`); a mismatch is rejected. Animated images are rejected. Omit `screenshot` for `more_hint`: it reuses the latest retained screenshot and context, and rejects an uploaded image with `422 unexpected_screenshot`. Capture a fresh image for every `check_again` request; identical image bytes are accepted when the visible work has not changed.

Unknown or repeated multipart fields are rejected. Blank `question` values are treated as absent. The whole `/hint` request body is limited to `MAX_IMAGE_BYTES + 65536` bytes to allow multipart overhead; JSON bodies for session creation and reset are limited to 16 KiB.

| Action | Preconditions | Hint level after success | Behavior |
| --- | --- | --- | --- |
| `initial` | New or reset problem; screenshot required | `1` | One guiding question or minimal hint. |
| `more_hint` | A successful `initial` exists | Increases by one, capped at `3` | Adds specificity and avoids repeating the last hint. |
| `check_again` | A successful `initial` exists; fresh screenshot required | Unchanged | Compares visible changes and suggests one next step. |

Calling `initial` on an active problem returns `409 problem_already_started`. Calling `more_hint` or `check_again` before a successful initial request returns `409 problem_not_started`. Reset the session first to start an unrelated problem without mixing context. At level 3, further hints stay at level 3; a full replacement solution is not the intended behavior.

```bash
SESSION_ID='replace-with-your-session-id'

curl -X POST http://127.0.0.1:8000/hint \
  -F "session_id=$SESSION_ID" \
  -F 'action=initial' \
  -F 'question=Why does this loop go past the list?' \
  -F 'screenshot=@/absolute/path/to/screenshot.png;type=image/png'

curl -X POST http://127.0.0.1:8000/hint \
  -F "session_id=$SESSION_ID" \
  -F 'action=more_hint'

curl -X POST http://127.0.0.1:8000/hint \
  -F "session_id=$SESSION_ID" \
  -F 'action=check_again' \
  -F 'question=I changed the loop bound. What should I check now?' \
  -F 'screenshot=@/absolute/path/to/new-screenshot.png;type=image/png'
```

Example `200` response (illustrative guidance, not a recorded live model result):

```json
{
  "hint_level": 1,
  "observation": "The visible traceback reports an IndexError at the list access.",
  "message": "Which index does the final loop iteration use, and is it inside the list?",
  "needs_more_context": false,
  "context_question": null
}
```

| Response field | Type | Meaning |
| --- | --- | --- |
| `hint_level` | integer `1`–`3` | Current assistance specificity. |
| `observation` | nonempty string, up to 1,200 characters | Concise description grounded in available context; may state uncertainty. |
| `message` | nonempty string, up to 1,600 characters | One question, hint, or actionable next step. |
| `needs_more_context` | boolean | Whether the user must clarify or supply clearer context. |
| `context_question` | string up to 500 characters, or `null` | Nonblank clarification question when `needs_more_context` is `true`; otherwise `null`. |

When context is insufficient, display `context_question` and let the user reply through `question`. Use `more_hint` for a text clarification or `check_again` when providing a clearer screenshot. A response describing a code change does not establish that it runs successfully; Gemini is instructed to require visible execution evidence before making that claim. The server validates the JSON schema and rejects a normalized repeat of the previous message on `more_hint`, but these checks cannot establish that the model's advice is correct or detect every paraphrased repeat.

## Start a new problem

`POST /session/{session_id}/reset` clears the screenshot, problem context, history, and hint ladder. Omit the body to keep the learning goal, or supply JSON with a replacement goal. The optional `goal` field accepts a nonblank string up to 2,000 characters; omitted or `null` retains the existing goal. Unknown JSON fields are rejected.

```bash
curl -X POST "http://127.0.0.1:8000/session/$SESSION_ID/reset" \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Learn why this function returns None"}'
```

```json
{"session_id": "same-session-id", "hint_level": 0}
```

The next interaction must be `initial` with a screenshot. A new `POST /session` also starts an independent problem, but delete the old session when it is no longer needed.

## Delete a session

`DELETE /session/{session_id}` returns `204` with no response body and clears retained context:

```bash
curl -X DELETE "http://127.0.0.1:8000/session/$SESSION_ID"
```

Sessions expire after 30 idle minutes by default. Successful guidance requests and resets refresh that deadline; health checks and failed requests do not. Restarting the backend clears all sessions. Frontends should create a fresh session after a missing or expired session response. Do not send requests for the same session concurrently; overlap returns `409`.

## Errors

API errors use a JSON envelope:

```json
{"error": {"code": "session_not_found", "message": "Session not found or expired."}}
```

Treat `error.code` as machine-readable and display `error.message` to the user. Failed guidance requests leave the hint level and retained problem context unchanged. No endpoint automatically retries a paid request.

| HTTP status | `error.code` | Situation / frontend action |
| --- | --- | --- |
| `404` | `session_not_found` | Missing, deleted, or expired session. Create a session and resend an `initial` screenshot. |
| `409` | `session_busy` | A request is using the same session. Wait for it to finish. |
| `409` | `problem_already_started`, `problem_not_started` | Use the appropriate action or reset the problem. |
| `413` | `image_too_large`, `request_too_large` | Image byte/pixel or request-body limit exceeded. Reduce screenshot size and retry explicitly. |
| `415` | `invalid_content_type`, `unsupported_image` | Send multipart form data with a matching PNG, JPEG, or WebP MIME type. |
| `422` | `invalid_request`, `invalid_multipart` | Missing/invalid fields, action, repeated fields, or malformed multipart. Correct the input. |
| `422` | `screenshot_required`, `unexpected_screenshot` | Supply an image for `initial`/`check_again`; omit it for `more_hint`. |
| `422` | `unreadable_image` | Empty, damaged, unreadable, or animated image. Capture a supported still image. |
| `429` | `gemini_rate_limited` | Gemini rate limit. Honor `Retry-After` and let the user retry. |
| `500` | `internal_error` | Unexpected backend failure. Preserve the displayed hint and report the failure. |
| `502` | `gemini_invalid_response`, `gemini_repeated_hint`, `gemini_unavailable` | Invalid/repeated model response or connection failure. Preserve the current hint and allow an explicit retry. |
| `503` | `gemini_not_configured`, `gemini_configuration_error`, `gemini_unavailable` | Set/check the backend key and model, or retry later if Gemini is unavailable. |
| `503` | `tutoring_prompt_invalid` | Check the configured AI teammate module's return value. |
| `503` | `session_capacity`, `server_busy` | Delete unused sessions or wait for local requests to finish. |
| `504` | `gemini_timeout` | Gemini timed out. Preserve the current hint and allow an explicit retry. |

Routes or methods without a handler return `404 http_error`.

The server does not return screenshot bytes, API keys, or raw Gemini error bodies. CORS errors are browser-level failures; configure `ALLOWED_ORIGINS` with explicit HTTP(S) origins for the frontend. For an Electron renderer loaded from `file://`, route backend requests through the desktop main process or serve the renderer from an allowed HTTP origin; `null` and wildcard origins are not accepted by this configuration.

## AI boundary contract

The backend owns HTTP transport, sessions, and validation. The AI teammate owns tutoring policy and prompt refinement via `TUTORING_PROMPT_MODULE`; the HTTP response contract stays stable across prompt changes.

`GeminiGateway.generate(request)` is the internal handoff between backend orchestration and Gemini. It receives only the current problem's bounded context:

| Input property | Meaning |
| --- | --- |
| `goal` | Validated learning goal string. |
| `action` | `initial`, `more_hint`, or `check_again`. |
| `hintLevel` | Backend-selected integer from 1 to 3. |
| `question` | Optional user question string, or `null`. |
| `problemContext` | JSON string containing `{ initial_question: string \| null, latest_observation: string }`. |
| `history` | Bounded array of `{ action, question, hint_level, observation, message, needs_more_context, context_question }` from successful interactions. |
| `screenshot` | `{ data: Buffer, mimeType: string }`: current upload for `initial`/`check_again`, or retained image for `more_hint`. |
| `previousScreenshot` | The same image shape, or `null`; used only by `check_again` to compare the previous view with `screenshot`. |

Image MIME types are `image/png`, `image/jpeg`, and `image/webp`. The gateway converts buffers to Gemini inline image parts; it does not upload permanent screenshot files. Goals, questions, history, and screenshot text remain task data rather than policy instructions.

The model returns exactly this shape; `src/guidance.js` owns its JSON schema and server-side validation:

```ts
type ModelGuidance = {
  observation: string;
  message: string;
  needs_more_context: boolean;
  context_question: string | null;
};
```

The backend adds `hint_level` to form the public response, after validating the model output. A model-provided hint level or additional output fields are rejected. The AI teammate should return one requested hint rather than a complete hint ladder. If a different model output format is introduced, adapt it inside `src/gemini.js` and keep the HTTP response shape stable.

Optional AI teammate instructions are loaded from `TUTORING_PROMPT_MODULE`, resolved relative to `backend/`. For example, `../AI/gemini/tutoring.js` can provide this trusted ESM export:

```js
export function buildTutoringInstructions({ action, hintLevel }) {
  return `For ${action}, give one useful step at specificity level ${hintLevel}.`;
}
```

This function must be synchronous and return a string of at most 20,000 characters. Startup checks the exported function; the gateway validates its return value on each request. An empty or whitespace-only string keeps the baseline instructions without an addition. Baseline coaching and screenshot-data guardrails remain in place when teammate instructions are appended. The AI teammate owns the module content; the backend does not overwrite files in `AI/`.

## Frontend example

Pass the captured screenshot as a `Blob` or `File`. The desktop/frontend team remains responsible for explicit capture, selection of the work window, and panel state.

```ts
const API = 'http://127.0.0.1:8000';

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Backend error ${response.status}`);
  }
  return body;
}

const { session_id } = await readJson(await fetch(`${API}/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ goal: 'Understand my Python indexing error' }),
}));

async function requestHint(
  action: 'initial' | 'more_hint' | 'check_again',
  screenshot?: Blob,
  question?: string,
) {
  const data = new FormData();
  data.set('session_id', session_id);
  data.set('action', action);
  if (screenshot) data.set('screenshot', screenshot, 'capture.png');
  if (question?.trim()) data.set('question', question.trim());
  return readJson(await fetch(`${API}/hint`, { method: 'POST', body: data }));
}

// captureSelectedWindow() is supplied by the desktop integration.
const first = await requestHint('initial', await captureSelectedWindow());
// Render first.message and first.observation; show first.context_question if needed.
const stronger = await requestHint('more_hint');
const checked = await requestHint('check_again', await captureSelectedWindow());

await readJson(await fetch(`${API}/session/${session_id}/reset`, {
  method: 'POST',
}));
await fetch(`${API}/session/${session_id}`, { method: 'DELETE' });
```

Do not manually set `Content-Type` for `FormData`: the browser supplies the multipart boundary. Disable the hint buttons while a request is pending. No API key is sent by the frontend. These examples are integration snippets; the existing scripted playground is not wired to this API automatically.
