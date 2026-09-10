---
phase: quick-260802-v2z
plan: 01
subsystem: planning-docs
status: complete
tags: [env-parity, v1.17, requirements, roadmap, doc-only]
requires: []
provides: [amended-v1.17-planning-corpus]
affects: [.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/STATE.md, .planning/PROJECT.md]
key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/STATE.md
decisions:
  - Fixed a spec-missed "three call sites" occurrence on the Phase 93 "Depends on" line in ROADMAP (spec edit 11 only named the Goal sentence) so the Task 2 verify gate could pass.
metrics:
  duration: ~12m
  completed: 2026-08-02
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase quick-260802-v2z Plan 01: Amend v1.17 env-parity planning docs Summary

Applied the LOCKED validation-pass findings (verified 2026-08-02 against Claude Code
2.1.212, pi-coding-agent 0.82.1, pi-mcp-adapter 2.10.0) across the four v1.17
env-parity planning docs: corrected the getShellEnv mechanism to the
resolveSpawnContext five-key model, added the PENV-01 plugin-PATH requirement,
extended MENV-01's substitution set with project-scope `${CLAUDE_PROJECT_DIR}`,
replaced the open pi-mcp-adapter question with the verified `resolveEnv`
spread-then-override finding, corrected Phase 93 to four call sites with the
invoke-time user-scope divergence justification, and added the BINP-01 v2 deferral
plus Out of Scope rows.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Amend REQUIREMENTS.md | b098810b | .planning/REQUIREMENTS.md |
| 2 | Amend ROADMAP.md | 830c4aee | .planning/ROADMAP.md |
| 3 | Amend STATE.md + PROJECT.md | 1ce8f203 (PROJECT only) | .planning/PROJECT.md, .planning/STATE.md |

Per the constraints, STATE.md edits (Task 3 S1-S6) were left unstaged in the working
tree for the orchestrator's docs commit; the SUMMARY.md and PLAN.md are likewise not
committed by this executor.

## What Changed

- **getShellEnv mechanism** — the "scrubbing only PI_*" phrasing is gone from all four
  docs, replaced by: `getShellEnv()` spreads the full live `process.env` (only mutation:
  prepends Pi's managed bin dir to PATH), then `resolveSpawnContext()` deletes and
  re-derives exactly five named keys (`PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`,
  `PI_MODEL`, `PI_REASONING_LEVEL`); no PI_*-prefix scrub.
- **PENV-01** — new plugin-PATH requirement in REQUIREMENTS (requirement + traceability
  row, coverage 13→14), ROADMAP (Phase 90 requirements line + new SC5 + Goal note),
  STATE (Phase 90 bullet + "14 v1 requirements mapped"), PROJECT (target feature +
  active checklist item).
- **MENV-01 substitution set** — extended to include project-scope
  `${CLAUDE_PROJECT_DIR}` (user-scope a documented absence) across REQUIREMENTS,
  ROADMAP (Phase 92 Goal + SC1), STATE, PROJECT.
- **pi-mcp-adapter finding** — the open verification item is replaced everywhere by the
  verified `server-manager.ts::resolveEnv` finding (`{...process.env, ...interpolated(config.env)}`,
  config keys win; interpolation on env/cwd/headers/bearerToken, unknown var → empty
  string, NOT command/args) in DOC-06, ROADMAP Phase 92/94, STATE, PROJECT.
- **Phase 93 call sites** — corrected three → four across the three bridges (skills stage
  ×2, commands stage, agents convert) with the invoke-time user-scope divergence
  justification, in ROADMAP, STATE, PROJECT.
- **BINP-01** — v2 deferral + Out of Scope row in REQUIREMENTS; deferral note in PROJECT.
- **Out of Scope rows** — added `AI_AGENT`, `CLAUDE_CODE_BRIDGE_SESSION_ID` /
  `CLAUDE_CODE_REMOTE_SESSION_ID`, and plugin-binaries provisioning to REQUIREMENTS.
- **Provenance/bookkeeping** — REQUIREMENTS footer, STATE Current Position amendment
  line, PROJECT Key context re-verification stamp.
- **`### In progress v1.17 env-parity`** ROADMAP heading preserved exactly (one
  occurrence).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected a second "three call sites" occurrence in ROADMAP**
- **Found during:** Task 2
- **Issue:** The LOCKED spec's edit (11) only named the Phase 93 *Goal* sentence, but
  the Phase 93 "**Depends on**" line also read "its three call sites". Task 2's verify
  gate asserts `! grep -q "three call sites"`, so leaving it would have failed the gate.
- **Fix:** Updated the "Depends on" line to "its four call sites" for consistency with
  the amended Goal.
- **Files modified:** .planning/ROADMAP.md
- **Commit:** 830c4aee

## Verification

- Task 1 grep gate: PASS
- Task 2 grep gate: PASS (heading occurrence count = 1)
- Task 3 grep gate: PASS (both STATE.md and PROJECT.md)
- Conflict-marker scan: no `<<<<<<<`/`>>>>>>>` markers (two matches on the literal word
  "conflict" are pre-existing PROJECT.md prose, untouched)
- `git diff --stat` shows only the four target files
- `pre-commit run --files` clean on each committed file

## Self-Check: PASSED

- .planning/REQUIREMENTS.md — FOUND
- .planning/ROADMAP.md — FOUND
- .planning/PROJECT.md — FOUND
- .planning/STATE.md — FOUND (modified, unstaged per constraint)
- Commit b098810b — FOUND
- Commit 830c4aee — FOUND
- Commit 1ce8f203 — FOUND
