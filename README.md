# MLH Hackathon Resources — Fall Hacks 2026

A starter resource pack for **Fall Hacks 2026** and the **Sidekick** project.

> **Sidekick:** Your work. Your thinking. Your Sidekick.

## Contents

- `01_Event_Info/` — event notes and organizer-resource links
- `02_Gemini_API/` — official Gemini API documentation and an integration checklist
- `03_Project_Sidekick/` — project brief, MVP scope, build plan, privacy principles, and demo outline

## Event overview

The event theme discussed in this project is **Digital Side-kick**.

The event notes in `01_Event_Info/event_notes.md` summarize details from the opening-ceremony material shared in this chat. Please confirm deadlines, team rules, and submission requirements against the latest official event instructions before relying on them.

## Project overview: Sidekick

Sidekick is an always-available desktop companion designed to help beginner programmers get unstuck while still learning.

The intended MVP flow is:

1. The user clicks the floating Sidekick button.
2. The user explicitly approves or initiates a screen capture.
3. Sidekick sends the selected screenshot for Gemini-powered analysis.
4. Sidekick offers progressive help: a guiding question, a more specific hint, and a deeper explanation.
5. The user makes an attempt and selects **Check again** for feedback on the updated screen.

The goal is to guide the user rather than immediately take over and provide a complete solution.

## Suggested technology

- **Desktop app:** Electron
- **UI:** React
- **Backend:** Node.js
- **AI:** Google Gemini API with image input

Keep the Gemini API key on the backend. Do not bundle it into the desktop client.

## Privacy principles

- Capture the screen only after an explicit user action.
- Make capture and analysis visible to the user.
- Do not save screenshots by default.
- Do not transmit screenshots in the background.
- Provide clear pause and close controls.

## Gemini API resources

- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [API key guidance](https://ai.google.dev/gemini-api/docs/api-key)
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini Cookbook](https://github.com/google-gemini/cookbook)

Check the official documentation for current model names, SDK usage, quotas, and pricing.

## Recommended build order

1. Prove the floating window and user-approved screenshot capture.
2. Send one screenshot to Gemini through a backend endpoint.
3. Render a useful first hint.
4. Add the progressive hint ladder and **Check again** loop.
5. Add privacy controls and reliable error handling.
6. Polish and rehearse the demo.

Keep the first version focused on one complete coding-help workflow. Defer accounts, databases, voice features, productivity scoring, and automatic screen monitoring until the core experience works.

## Important note

This pack contains project-planning notes and links, not official MLH endorsement or a guarantee that any particular feature meets a judging rubric. Follow the event organizers' latest rules and the official Gemini API documentation.
