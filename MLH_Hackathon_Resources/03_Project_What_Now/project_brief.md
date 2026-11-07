# What Now

**Tagline:** Your work. Your thinking. What Now.

## Concept
What Now is a small, always-available desktop companion that helps a user get unstuck without taking over the work. The user explicitly clicks a floating button, shares a screenshot, and receives contextual guidance.

## Target user / first use case
Beginner programmers who are stuck while coding. Keep the hackathon MVP focused on coding rather than trying to support every task category.

## Core user flow
1. User clicks the floating What Now button.
2. What Now explains what it can inspect and asks for / uses explicit screen-capture permission.
3. User reviews or confirms the screenshot before sending.
4. Gemini interprets the visible code, error, or IDE context.
5. What Now provides a progressive hint ladder:
   - Level 1: a guiding question.
   - Level 2: a more specific hint.
   - Level 3: a deeper explanation.
6. User tries the suggestion and clicks **Check again** to share an updated screenshot.

## MVP feature list
- Always-on-top floating desktop control.
- User-triggered screenshot capture.
- Gemini-powered screenshot understanding.
- Progressive hints rather than immediately dumping a complete solution.
- A clear **Check again** loop.
- Pause / close controls and a visible capture indicator.

## Suggested architecture
- Desktop shell: Electron.
- UI: React.
- Backend: Node.js.
- AI: Gemini API with image input.
- Keep the Gemini API key on the backend in an environment variable.

## Privacy principles
- Capture only after an explicit user action.
- Show a clear indication when a screenshot is being captured or analyzed.
- Do not save screenshots by default.
- Do not transmit screenshots in the background.
- Let the user pause or close What Now at any time.
- Never label users as lazy or infer personal traits from inactivity.

## Scope cuts for a reliable hackathon demo
Do not prioritize accounts, persistent user profiles, databases, voice, essay mode, productivity scoring, or automatic surveillance. Make one coding-help flow work end to end before adding anything else.
