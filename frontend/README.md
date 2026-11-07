# Frontend

React, TypeScript, Vite, and Three.js power the welcome screen and interactive hint playground.

Run `npm ci` and `npm run dev` from the repository root. Root commands forward to this npm workspace. Production output is written to `frontend/dist/`.

- `src/main.tsx` contains the interface and scripted debugging exercise.
- `src/Orb.tsx` renders the interactive 3D scene.
- `src/styles.css` styles the interface.

## Backend requests

Development requests go through Vite's `/api` proxy to `http://127.0.0.1:8000`. Run the Node/Express backend on the same machine as Vite. With the backend implementation and dependencies available, start it from the repo root.

```bash
npm --prefix backend ci
npm --prefix backend start
```

The backend requires `GEMINI_API_KEY` for hints. Configure that key in the backend environment.

For deployment, set `VITE_API_BASE_URL` in `frontend/.env.local` before building, or configure a production `/api` reverse proxy. An absolute backend URL requires the backend to allow your frontend origin through CORS. Restart Vite after environment changes.

`src/api.ts` exports these request functions.

- `createSession(goal)` posts JSON to `/session`.
- `requestHint({ sessionId, action, question?, screenshot })` posts FormData to `/hint`. The actions `initial` and `check_again` require a screenshot file.
- `requestHint({ sessionId, action: 'more_hint', question? })` requests more help without a screenshot.
- `deleteSession(sessionId)` sends DELETE to `/session/{id}` to release capacity.
- `resetSession(sessionId)` posts to `/session/{id}/reset`. Await a successful reset before starting an unrelated problem.

Each function accepts an optional second argument with an AbortSignal. The browser supplies the multipart Content-Type header and boundary.

The desktop Get help workspace provides a local live preview, project overview and task fields, and three explicitly requested help levels. Draft context supports Undo/Redo and Cancel. Back/forward controls revisit saved replies without extra API calls.

Updating saved context resets the same session with its new goal. Starting a new problem requires confirmation and deletes the old session. The browser version retains image input for testing and fallback use.

Responses are validated against the supplied session and hint schemas. Backend error messages appear in the interface. Expired sessions return the form to session creation. The separate playground remains available as a scripted example.

The Node/Express implementation lives in `backend/src/`. See the [backend setup](../backend/README.md) and [API contract](../backend/API.md).
