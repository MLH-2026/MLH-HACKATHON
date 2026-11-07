# Gemini integration checklist for Sidekick

- [ ] Create / select a Google AI Studio project and obtain a Gemini API key.
- [ ] Keep the key in a server-side environment variable (never bundle it in the Electron renderer).
- [ ] Build a backend endpoint that accepts a user-approved screenshot and a short context prompt.
- [ ] Send the screenshot as image input using the current official SDK/API pattern.
- [ ] Ask Gemini for a concise explanation and a three-level hint ladder.
- [ ] Use structured output where practical so the UI can reliably render `guiding_question`, `hint`, `deeper_explanation`, and `next_step`.
- [ ] Handle API errors, timeouts, rate limits, and empty/unclear screenshots gracefully.
- [ ] Avoid logging screenshots or sensitive screen contents.
- [ ] Verify current model IDs and image-input limits in the official documentation.
