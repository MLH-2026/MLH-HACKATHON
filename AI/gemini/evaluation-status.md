# Evaluation status — November 7, 2026

## Local verification

- Tutor contract tests: 2 passed, including all nine action/level combinations.
- Backend Gemini and prompt-loader tests: 31 passed with mocked provider boundaries.
- Backend syntax checks and live-runner syntax check: passed.
- Full backend suite: 31 passed; 44 localhost API tests could not bind inside the sandbox. Permission to rerun outside it was rejected. These are not verified passing here.

## Live attempt

Configured model: `gemini-3.8-flash`. An initial request returned valid structured
guidance: it identified the visible IndexError and asked the learner to compare
valid list indexes with the loop range, without supplying the correction.
Subsequent level 2 requests timed out, including with a 120-second timeout.
Live evaluation remains incomplete. The runner now resumes saved successes and
checkpoints each response; this resume change has not been executed or tested.
The API key and private response report are excluded from this commit.

After backend connectivity/model access is established, run:

```sh
node AI/gemini/evaluate.mjs
```

Review the ignored response report against the README rubric. Then complete a team
smoke test using a real user-approved desktop capture. No backend, frontend, or
desktop source was changed in this AI work.
