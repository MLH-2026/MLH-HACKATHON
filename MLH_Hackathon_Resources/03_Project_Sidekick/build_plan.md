# Sidekick — build plan

## Milestone 1: prove the technical path
- Create a minimal Electron app.
- Show a small always-on-top floating window.
- Add a click handler and user-approved screenshot capture.
- Send a test image to a backend endpoint and call Gemini.

## Milestone 2: complete one useful interaction
- Display the screenshot preview.
- Return a guiding question and first hint.
- Add buttons for **More specific hint** and **Explain more**.
- Add **Check again** to repeat the capture-and-feedback loop.

## Milestone 3: make it demo-safe
- Add loading, error, timeout, and retry states.
- Add visible privacy/capture controls.
- Test on the actual demo machine and screen resolution.
- Keep a known-good fallback screenshot / scripted demo path.

## Optional only after the core works
- User-configured check-ins with explicit opt-in.
- Simple states such as **Doing fine**, **I'm stuck**, and **Snooze**.
- Additional task categories beyond beginner coding.
