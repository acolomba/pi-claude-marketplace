---
phase: 06-sessionend-hooks
verified: 2026-11-08T12:55:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/phases/06-sessionend-hooks/06-01-PLAN.md
  - .planning/phases/06-sessionend-hooks/06-01-SUMMARY.md
  - .planning/phases/06-sessionend-hooks/06-02-PLAN.md
  - .planning/phases/06-sessionend-hooks/06-02-SUMMARY.md
  - .planning/phases/06-sessionend-hooks/06-03-PLAN.md
  - .planning/phases/06-sessionend-hooks/06-03-SUMMARY.md
  - docs/hooks-compatibility.md
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
  - features/hook/session-end.feature
  - features/step_definitions/hook/session-end.steps.ts
  - test/bridges/hooks/timeout.test.ts
covered_digest: "v4:sha256:5f3130d5909013155ffcf1dee6f7d7ab53dd0d9274c49c1bc9c7b5e8360942e2"
behavior_unverified: 0
---

# Phase 6: SessionEnd Hooks - Verification

Verified inline by the child session, following `.claude/agents/gsd-verifier.md`, because the coordinator ruled that Phase 6 dispatches no subagent (P6-DC-21). Goal-backward, against the roadmap's success criteria and SEND-01, on the tree merged with `features/behavioral-gaps` (merge `f6db7eba`).

## Goal

Every way a Pi session ends runs the plugin's SessionEnd hooks with Claude Code's reason, matchers select them by reason, and a failing hook never keeps the session from ending.

## Must-haves

| # | Truth | Evidence | Status |
|---|-------|----------|--------|
| 1 | Each reason Pi can produce has a scenario, with Claude Code's reason and payload (SEND-01 criterion 1) | Pi 1.5.0 emits `new`, `resume`, `fork`, `quit`, `reload`. `hook/session.feature` covers `new`, `fork`, `quit` (RPC and terminal), and `reload`; `hook/session-end.feature` adds `resume` (RPC `switch_session`) and `quit` in json mode, each stating the whole stdin and environment of every run. Red proofs R1 and R2 (06-01-SUMMARY). | ✓ |
| 2 | A matcher for each reason selects only that reason's run (criterion 2) | Four scenarios (clear, resume, other, prompt_input_exit), five SessionEnd hooks each, one run each; `logout` never runs. R3 turned all four red. | ✓ |
| 3 | A SessionEnd hook that exits non-zero, exits 2, or runs past its timeout does not keep the session from ending; the next session starts or Pi exits; the run is recorded (criterion 3) | RPC new-session outline (exit 1, sleep 30, timeout 60 + sleep 60), exit-2 scenario with the D-CF5-24 notice, json-mode outline (exit 1, exit 2, sleep 30, timeout 60 + sleep 60) whose driver fails unless Pi exits 0 within 25 s. R4 to R7 (06-03-SUMMARY). | ✓ |
| 4 | A plugin SessionEnd hook's declared timeout does not extend the 1.5 s budget (D-BG-604) | `capSessionEndTimeout` in `timeout.ts`; three unit cases (cap with debug line, boundary kept, background kept), 100% direct coverage; the `timeout: 60` rows fail without the cap (R4). | ✓ |

## Gates

- Wave gate (pre-merge tree, parts in order): `check:static` 0, `test:unpaired` 0, `test:integration` 0, adapter cucumber 1654/1654 (exit 0), builtin cucumber 148/148 (exit 0), `test:coverage:direct:all` 0.
- Phase gate (merged tree): `npm run check` exit 1: static, unpaired, and integration passed, then the adapter cucumber leg at its default `--parallel 8` failed 13 of 1732 scenarios, all outside the hook files (autoapply, marketplace update, install, apply, disable, reconcile, skill collisions), at a load average near 50 to 60. A rerun of exactly those 13 at `--parallel 3` passed 13/13 (12.7 s). `npm run check` stops at the first failing part, so the builtin leg (152/152, exit 0) and `test:coverage:direct:all` (exit 0) ran separately on the same tree. `npm run test:modules` exit 0.
- `find ~/.pi -newer <marker>`, with the marker made before the first scenario run of the phase: empty. Nothing under the real `~/.pi` changed.

## Residual risks (recorded, not gaps)

- SessionEnd scenarios depend on the Node hook recorder starting within the 1.5 s budget; a heavily loaded machine can drop a SessionEnd run (P6-DC-22, IN-01).
- `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` and a bounded SessionEnd wait are deferred (D-BG-605), and the non-blocking SessionEnd failure notice stays unpinned (HOOKERRNOTE-01); each has a parent line.
