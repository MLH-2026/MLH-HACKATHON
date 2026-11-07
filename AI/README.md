# AI

Gemini integration resources live in [gemini/](gemini/). Add model integration logic, coaching prompts, response schemas, and evaluation examples here as the AI implementation develops.

The frontend currently uses scripted hints for its sample exercise. The backend teammate owns the API, sessions, validation, and Gemini transport in [`backend/src/`](../backend/src/). The AI teammate owns tutoring prompts and evaluation in this folder. See the [AI handoff contract](../backend/API.md#ai-boundary-contract) for connecting the prompts to the backend. The checklist in this folder is the original planning reference.
