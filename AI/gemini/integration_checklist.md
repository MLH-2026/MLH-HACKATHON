# AI integration status

- [x] Synchronous `buildTutoringInstructions({ action, hintLevel })` module.
- [x] Three levels: guiding question, focused hint, concept explanation and diagnostic step.
- [x] Initial help, history-aware hints, and previous/current screenshot comparison.
- [x] Evidence limits, clarification, correct-work handling, and embedded instruction resistance.
- [x] Four-field JSON response matching the backend validator.
- [x] Backend loader contract checks for all nine action/level combinations.
- [x] Repeatable opt-in synthetic screenshot evaluation via production GeminiGateway.
- [ ] Review successful live responses against the README rubric.
- [ ] Team demo with the desktop teammate's capture flow and frontend rendering.

Backend owns transport, validation, sessions, timeouts, and hint progression.
Frontend owns rendering; desktop owns user-approved capture. No parallel AI endpoint
or alternate response schema is needed. The backend adds `hint_level`.

Private backend configuration:
`TUTORING_PROMPT_MODULE=../AI/gemini/tutoring.mjs` and `GEMINI_API_KEY`.
Keep the key server-side. Never commit `.env`.
