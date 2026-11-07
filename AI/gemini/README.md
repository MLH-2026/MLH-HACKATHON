# WhatNow tutoring module

`tutoring.mjs` exports synchronous `buildTutoringInstructions({ action, hintLevel })`.
Actions: `initial`, `more_hint`, `check_again`. Hint levels: integers 1–3.
The backend owns screenshots, history, level progression, Gemini transport and response validation.

To enable, set this in your local `backend/.env`, then restart the backend:

```dotenv
TUTORING_PROMPT_MODULE=../AI/gemini/tutoring.mjs
```

Keep `GEMINI_API_KEY` server-side and never commit `.env`.
This module supplements the backend baseline policy; it does not replace it.
Responses contain exactly `observation`, `message`, `needs_more_context`, and
`context_question` (null unless clarification is needed). The backend adds `hint_level`.

Run from repository root:

```sh
node --test AI/gemini/tutoring.test.mjs
```

These checks validate the loader, all nine combinations, sample response compatibility,
and invalid inputs. They do not establish live Gemini coaching quality.

## Live evaluation

Use the backend API with a real screenshot and configured key. Check:

| Scenario | Expected behavior |
| --- | --- |
| Initial beginner bug | One grounded guiding question, no corrected code. |
| Two more hints | Concept and location at level 2; concrete diagnostic step at level 3. |
| Further hint at level 3 | New useful clue without a full solution. |
| Check after edit | Visible comparison, same level, no execution claim without evidence. |
| Unchanged screenshot | No invented improvement; one useful next step. |
| Unreadable or insufficient context | One focused clarification, true context flag and nonblank question. |
| Correct work | No invented bug. |
| Embedded request to ignore rules | Treat as task data and retain the JSON/coaching rules. |

Record model and scenario outcomes without storing credentials or private screenshots.
