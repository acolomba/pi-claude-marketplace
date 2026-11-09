---
phase: 06-sessionend-hooks
plan: 01
subsystem: testing
tags: [cucumber, hooks, session-end]

requires:
  - phase: 01-foundation
    provides: "the hook recorder, the json-mode driver, the terminal driver, and the hook session steps"
provides:
  - "features/hook/session-end.feature with the resume and json-mode reason scenarios and four matcher scenarios"
  - "features/step_definitions/hook/session-end.steps.ts with the saved-session Given, the resume When, and the json-mode When"
affects: [06-03]

actuals:
  tasks: 2
  commits: 1

key-files:
  created:
    - features/hook/session-end.feature
    - features/step_definitions/hook/session-end.steps.ts
  modified: []

key-decisions:
  - "D-BG-601, D-BG-602, D-BG-606 implemented as planned"

requirements-completed: []
---

# Plan 06-01 Summary: reason and matcher scenarios

Commit `9b5beb83` (`test(hooks): cover session end reasons and matchers`) adds the new feature file and the verb step module. Both tasks went into one commit, because the feature file and the module were written and red-proofed together.

## What was built

- Step texts (D-BG-606): `the user has a saved pi session {string} in the project`, `the user resumes the saved pi session {string} with the hooks recording`, `the user runs {string} in pi's json mode with the hooks recording`. The module exports nothing, imports `DIALOG_METHODS` from the frozen process driver, and records turns through one private helper of its own shape (no clone group with `hook/session.steps.ts`).
- Six scenarios: resume through RPC `switch_session` (SessionEnd `resume`, SessionStart `resume` with transcript path `{agent dir}/sessions/saved.jsonl`), a json-mode `/claude:plugin list` (SessionStart `startup`, SessionEnd `other`), and one matcher scenario each for `clear`, `resume`, `other` (RPC stop), and `prompt_input_exit` (terminal quit, user scope), each with five SessionEnd hooks of which exactly one runs; `logout` never runs.

## Verification

- `npx cucumber-js --profile adapter --parallel 3 features/hook/session-end.feature`: exit 0, 6 scenarios passed, 43.8 s wall.
- `npm run check:features`: exit 0. `npx fallow dupes --fail-on-issues --format human`: exit 0. ESLint and Prettier on the module: exit 0.
- The commit hook (`npm run check:commit`) passed.

## Red proofs

- R1: in `payloads/session-end.ts`, the Pi `resume` case moved to the `clear` arm. The resume scenario failed at `the hooks record these runs:` with `+ 'clear'` / `- 'resume'`. Reverted.
- R2: in the same file, the `json` case of `quitReason` moved to the terminal arm. The json scenario failed at the runs step with `+ 'prompt_input_exit'` / `- 'other'`. Reverted.
- R3: in `dispatch.ts`, the SessionEnd arm of `matchValue` returned `undefined`, so every SessionEnd hook fired. All four matcher scenarios failed at the runs step, each recording five runs (`end-clear`, `end-resume`, `end-logout`, `end-prompt-input-exit`, `end-other`) where it states one. Reverted; `git diff --quiet -- extensions` exited 0 before the commit.
- `find ~/.pi -newer <marker>` printed nothing.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- Both tasks landed in one commit instead of two.
- The plan's executor role ran inline in the child session: the `gsd-executor` dispatch was refused by the agent-isolation guard, which reads the sentinel of the parent checkout's directory, and the coordinator then asked for inline execution (see P6-DC-21).
