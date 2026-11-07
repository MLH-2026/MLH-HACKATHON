# MLH Hackathon Resources — Fall Hacks 2026

## Repository structure

| Folder | Contents |
| --- | --- |
| `frontend/` | React, TypeScript, Three.js, styles, and Vite configuration. |
| `backend/` | Backend ownership and planned Node.js API responsibilities. |
| `AI/` | Gemini documentation and integration checklist. |
| `desktop-integration/` | Electron and screen-capture integration responsibilities. |
| `MLH_Hackathon_Resources/` | Shared event notes, project brief, build plan, and demo script. |

The root package uses npm workspaces. Run installation and development commands from the repository root. The frontend is the implemented workspace today. Backend and desktop code can be added to their folders as those components are built.

## What Now frontend

What Now is a beginner coding companion for the MLH hackathon. The welcome screen includes a draggable 3D crystal and an interactive Python debugging exercise. Change the loop bound, check your attempt, and reveal a guiding question, a hint, or a concept explanation as needed.

### Run locally

Install Node.js 22.12+ (or Node.js 20.19+ on the 20.x line), then run these commands from the repository root.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### Packages

| Package | What it does |
| --- | --- |
| `react`, `react-dom` | Render the interface and manage the playground state. |
| `three` | Render the WebGL crystal, lighting, and orbit rings. Its bundled OrbitControls handle dragging. |
| `typescript` | Type-check the React app and scene. |
| `vite`, `@vitejs/plugin-react` | Run the Node.js development server and build the frontend. |
| `@types/react`, `@types/react-dom`, `@types/three` | Provide TypeScript declarations for the libraries. |

### Build and preview

```bash
npm run typecheck
npm run build
npm run preview
```

The production files are generated in `frontend/dist/`. The playground simulates one Python exercise in the browser and uses scripted hints. The Get help section connects to the local Python backend for live guidance. See [backend connection setup](frontend/README.md#backend-requests).

A starter resource pack for **Fall Hacks 2026** and the **What Now** project.

> **What Now:** Your work. Your thinking. What Now.

## Contents

- `MLH_Hackathon_Resources/01_Event_Info/` — event notes and organizer-resource links
- `AI/gemini/` — official Gemini API documentation and an integration checklist
- `MLH_Hackathon_Resources/03_Project_What_Now/` — project brief, MVP scope, build plan, privacy principles, and demo outline

## Event overview

The event theme discussed in this project is **Digital Side-kick**.

The event notes in `MLH_Hackathon_Resources/01_Event_Info/event_notes.md` summarize details from the opening-ceremony material shared in this chat. Please confirm deadlines, team rules, and submission requirements against the latest official event instructions before relying on them.

## Project overview: What Now

What Now is an always-available desktop companion designed to help beginner programmers get unstuck while still learning.

The intended MVP flow is:

1. The user clicks the floating What Now button.
2. The user explicitly approves or initiates a screen capture.
3. What Now sends the selected screenshot for Gemini-powered analysis.
4. What Now offers progressive help: a guiding question, a more specific hint, and a deeper explanation.
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
