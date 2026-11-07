# Frontend

React, TypeScript, Vite, and Three.js power the welcome screen and interactive hint playground.

Run `npm ci` and `npm run dev` from the repository root. Root commands forward to this npm workspace. Production output is written to `frontend/dist/`.

- `src/main.tsx` contains the interface and scripted debugging exercise.
- `src/Orb.tsx` renders the interactive 3D scene.
- `src/styles.css` styles the interface.

## Backend requests

Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_BASE_URL` to the backend origin. Restart Vite after changing the value. An empty value sends requests to the frontend origin. The backend must allow the frontend origin through CORS when they differ.

`src/api.ts` exports these request functions.

- `createSession(goal)` posts JSON to `/session`.
- `requestHint({ sessionId, action, question?, screenshot })` posts FormData to `/hint`. The actions `initial` and `check_again` require a screenshot file.
- `requestHint({ sessionId, action: 'more_hint', question? })` requests more help without a screenshot.
- `resetSession(sessionId)` posts to `/session/{id}/reset`. Await a successful reset before starting an unrelated problem.

Each function accepts an optional second argument with an AbortSignal. The browser supplies the multipart Content-Type header and boundary.

Response bodies are typed as `unknown` until the backend response schema is available. These request functions are ready for integration. The playground currently displays its scripted exercise.
