# Desktop integration

Electron now provides an always-on-top floating control and user-triggered screen/window capture, connected to the existing React session UI.

From the repo root, install with `npm ci` and `npm --prefix backend ci`. Configure the backend key in `backend/.env`. Start the backend with `npm --prefix backend start`, then run `npm run desktop` in another terminal. The desktop command builds the frontend before launching Electron.

Click **Get help** to open the dedicated workspace. Choose a VS Code window or screen to start a local preview refreshed approximately every 1.2 seconds. Enter a project overview and current task, then continue to the help panel.

- Level 1 gives a minimal nudge.
- Level 2 adds guidance.
- Level 3 explicitly requests a full answer or corrected code, subject to the available context.
- Previous/Next and the level buttons revisit saved replies without calling Gemini.
- Back to context preserves the session. Undo/Redo edits the context draft. Cancel edits restores the saved context.
- Applying changed context resets the existing session and clears hint history. New problem asks for confirmation and deletes the old session to free capacity.
- Check my latest work captures a fresh frame. More guidance reuses the backend's prior capture.

The preview is a read-only visual mirror. Continue editing in the original application. Frames stay local until the user requests a hint or checks their work. Pause, Disconnect, hiding the help window, and the floating control's pause stop preview refreshes. Resume from the floating control when it has paused capture.

On macOS, allow Electron under **System Settings → Privacy & Security → Screen Recording** (or **Screen & System Audio Recording**), then quit and restart the desktop app. Capture resolution is bounded to 1600×1000; zoom the editor for readable text.

Closing the help window hides it and preserves the session. The floating control reopens it, pauses/resumes new captures, or quits the app. Pause does not cancel submitted requests or discard an already selected image. Local preview refreshes do not call Gemini. Audio and screenshot files are not recorded. Unused backend sessions expire normally.

`main.cjs` owns windows, capture IPC, static serving, and the API proxy. `preload.cjs` exposes only capture to React; `launcher.cjs` exposes the floating controls. Windows use sandboxing, context isolation, disabled Node integration, sender validation, and blocked navigation. The built frontend runs on an ephemeral loopback port and `/api` proxies to `127.0.0.1:8000`. Keep `VITE_API_BASE_URL` unset for desktop builds and start the backend separately on port 8000.

Checks: `npm run build`, `npm run check --workspace=@what-now/desktop`, and `npm --prefix backend test`. On the demo machine, verify permission denial, capture selection/cancel/discard, pause/resume, initial hint, stronger hint, changed-code check, unavailable backend, and quit/reopen. Backend tests mock Gemini; live guidance requires a valid key and accessible model.

This is a local demo integration. Signed installers and distribution packaging are not configured.

See the [build plan](../MLH_Hackathon_Resources/03_Project_WhatNow/build_plan.md) for the desktop milestones.
