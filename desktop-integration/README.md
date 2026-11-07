# WhatNow desktop companion

From the repo root, run npm ci and npm --prefix backend ci. Set GEMINI_API_KEY in backend/.env. Start the backend with npm --prefix backend start, then run npm run desktop in another terminal.

## Workflow

1. The popup opens with a brief project or work-item overview and current goal.
2. Optionally add assignment instructions, notes, PDF, PPTX, DOCX, text, or code. Text extraction occurs locally. Up to 12,000 characters accompany the next help request. File size is limited to 10 MB. PDF extraction covers up to 50 pages. Images, diagrams, and scanned pages need a written summary.
3. Start working shrinks the popup into a corner control. Drag its header to move it to another position or display. The full help window is resizable.
4. Click Nudge me. WhatNow hides its windows, captures the display containing the button, and sends that frame and context for level-one help. Move the button to the display you intend to share.
5. Ask for a Suggested fix or Full explanation. These reuse the last frame. Each new nudge captures current work and starts at level one, retaining previous replies for Previous/Next navigation.

Back to context, Undo/Redo edits, and Cancel edits let students revise their overview. Applying changed context resets the same session. New problem asks for confirmation and deletes the old session to release capacity. Optional supporting context can be edited or removed before the next request.

The corner Open button opens the help window without capturing. Pause disables new screen capture. Quit exits the app. Frames are captured only on a nudge, held in memory, and sent to the backend for Gemini guidance. Screenshots are not saved to disk. The assistant does not edit the original app or its files.

On macOS, enable Electron under System Settings → Privacy & Security → Screen Recording (or Screen & System Audio Recording), then restart WhatNow. For a launch failure under an automation environment, retry npm run desktop directly in Terminal.

## Team integration

The existing POST /session and multipart POST /hint contract remains compatible. New optional fields are context (up to 12,000 characters) and restart_ladder=true (check_again only). A normal check_again keeps its existing level behavior. The new desktop nudge uses restart_ladder to start at level one while retaining screenshot comparison and history.

The local HTTP server serves the built React frontend and proxies /api to 127.0.0.1:8000. Keep VITE_API_BASE_URL unset for desktop builds. Signed installers are not configured.
