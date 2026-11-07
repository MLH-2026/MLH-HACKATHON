# Desktop integration

Electron now provides an always-on-top floating control and user-triggered screen/window capture, connected to the existing React session UI.

From the repo root, install with `npm ci` and `npm --prefix backend ci`. Configure the backend key in `backend/.env`. Start the backend with `npm --prefix backend start`, then run `npm run desktop` in another terminal. The desktop command builds the frontend before launching Electron.

Click **Get help**, enter a goal, start a session, and click **Capture a screen or window**. Select a preview, review it, then click **I’m stuck** to submit it. **More hint** reuses the retained capture; **Check again** needs another capture or upload. Previews are snapshots from when Capture was clicked. Recapture after editing code.

On macOS, allow Electron under **System Settings → Privacy & Security → Screen Recording** (or **Screen & System Audio Recording**), then quit and restart the desktop app. Capture resolution is bounded to 1600×1000; zoom the editor for readable text.

Closing the help window hides it and preserves the session. The floating control reopens it, pauses/resumes new captures, or quits the app. Pause does not cancel submitted requests or discard an already selected image. No automatic captures, audio recording, or screenshot files are created. Unused backend sessions expire normally.

`main.cjs` owns windows, capture IPC, static serving, and the API proxy. `preload.cjs` exposes only capture to React; `launcher.cjs` exposes the floating controls. Windows use sandboxing, context isolation, disabled Node integration, sender validation, and blocked navigation. The built frontend runs on an ephemeral loopback port and `/api` proxies to `127.0.0.1:8000`. Keep `VITE_API_BASE_URL` unset for desktop builds and start the backend separately on port 8000.

Checks: `npm run build`, `npm run check --workspace=@what-now/desktop`, and `npm --prefix backend test`. On the demo machine, verify permission denial, capture selection/cancel/discard, pause/resume, initial hint, stronger hint, changed-code check, unavailable backend, and quit/reopen. Backend tests mock Gemini; live guidance requires a valid key and accessible model.

This is a local demo integration. Signed installers and distribution packaging are not configured.

See the [build plan](../MLH_Hackathon_Resources/03_Project_WhatNow/build_plan.md) for the desktop milestones.
