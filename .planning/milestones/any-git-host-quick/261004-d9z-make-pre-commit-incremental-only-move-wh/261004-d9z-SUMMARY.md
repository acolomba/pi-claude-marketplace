---
phase: 261004-d9z
plan: 01
subsystem: tooling/checks
tags: [pre-commit, check-changed, eslint-cache, ci, docs]
status: complete
requires: []
provides:
  - "check:changed broad scope (cached whole-repo static checks) replacing the full npm run check fallback"
  - "checker rule: checker-family scripts without tests run Prettier, ESLint, Fallow, and their control"
  - "content-keyed ESLint cache shared by npm run lint and the selector; CI clears it before npm run check"
affects: [pre-commit hook duration, local-verification policy, CI check job]
tech-stack:
  added: []
  patterns: ["ESLint --cache --cache-strategy content --cache-location node_modules/.cache/eslint/"]
key-files:
  created: []
  modified:
    - scripts/check-changed.mjs
    - scripts/check-changed.negative.mjs
    - package.json
    - .github/workflows/ci.yml
    - .pre-commit-config.yaml
    - AGENTS.md
    - skills/local-verification/SKILL.md
    - CONTRIBUTING.md
    - docs/unused-type-member-gate.md
decisions:
  - "Commit-time checks never run npm run check; former full-fallback inputs select the broad scope"
  - "Broad baseline includes npm run lint:workflows (DEV-1), which caught a real violation in this task"
  - "CI clears node_modules/.cache/eslint in a step before npm run check instead of a no-cache flag (DEV-2)"
  - "Lock code unchanged and applied to broad runs; its names still say full until the planned redesign"
metrics:
  started: 2026-10-04T14:01:06Z
  completed: 2026-10-04T14:45:32Z
  duration_minutes: 44
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: e2907d9f7aec375531842c0ba9c06255d99779e6
plan_head_after: 6708e06a5a7e27728ad157354013a4c9dc8f2b45
---

# Quick Task 261004-d9z: Make commit-time checks incremental only Summary

The `check:changed` hook no longer runs the whole `npm run check` (about 23 minutes) for configuration, tooling, CI, removal, e2e, or unknown inputs. Those inputs now select a `broad` scope: whole-repository `format:check`, `typecheck`, cached `lint`, `lint:workflows`, `fallow`, and `test:corresponding`, plus any targeted tests and controls that other rules name. A warm broad run took about 27 s of checks. Checker scripts without their own test now run Prettier, ESLint, Fallow, and their own control. `npm run lint` and the selector share a content-keyed ESLint cache, and CI clears it before `npm run check`.

## Commits

| Task | Commit   | Title                                                                  |
| ---- | -------- | ---------------------------------------------------------------------- |
| 1    | 8ca5fbb5 | perf(checks): run incremental broad checks instead of the full check   |
| 2    | 6708e06a | docs: describe incremental commit checks and checkpoint runs           |

## Pre-commit runs (Node v26.10.0)

All runs used `pre-commit run --verbose --files <task files>` on the main checkout, branch `features/faster-precommit`. The `durationMs`, `exitStatus`, and `lockWaitMs` values come from `.git/check-changed.log`.

| Run | Before commit | Exit | Scope / commands | Hook `durationMs` | `exitStatus` | `lockWaitMs` | pre-commit wall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Task 1, attempt 1 | 8ca5fbb5 | 1 | broad: format:check, typecheck, lint (cold, empty cache), lint:workflows (failed) | 214,103 | 1 | 1 | 303 s |
| Task 1, attempt 2 | 8ca5fbb5 | 0 | broad: the six broad commands + `npm run check:controls` | 550,674 | 0 | 1 | 649 s |
| Task 2 | 6708e06a | 0 | focused, reason `Documentation`: `npm run test:architecture` | 103,522 | 0 | 0 | 122 s |

- Task 1 attempt 2 log (`/tmp/d9z-precommit-task1.log`) contained `Checking: "npm" "run" "lint"`, `Checking: "npm" "run" "check:controls"`, and "Broad checks passed". It had no line exactly `Checking: "npm" "run" "check"`. Most of its 550 s is `npm run check:controls`, which includes the type-member control (about 8-10 min).
- Reason for both Task 1 attempts: `Broad check required by .github/workflows/ci.yml, .pre-commit-config.yaml, package.json`.
- For comparison, the last full hook run before this change (az6 Task 2) took 1,384,434 ms.

`--list` before the Task 1 commit (`/tmp/d9z-list-task1.json`): scope `broad`, reason `Broad check required by .github/workflows/ci.yml, .pre-commit-config.yaml, package.json`, commands exactly `npm run format:check`, `typecheck`, `lint`, `lint:workflows`, `fallow`, `test:corresponding`, `check:controls`.

## Cold vs warm broad timing

- Cold: attempt 1 ran `format:check`, `typecheck`, whole-repository `lint` from an empty ESLint cache, and then `lint:workflows` (which failed) in 214,103 ms. That was the cost of filling the cache. The plan measured a cold lint alone at about 202 s.
- Warm: in the planted-lock probe, the full broad set took 35,197 ms in total. 8,008 ms of that was the lock wait, so the checks took about 27 s.

## Planted-lock probe (lock applies to broad runs)

- Planted `.git/check-changed-full.lock/owner.json` with the live shell pid, `startedAt` = now - 3,592,000 ms, and worktree `d9z-probe-holder`. Ran `node scripts/check-changed.mjs` with the untracked `d9z-broad-probe.txt`.
- `PROBE_EXIT=0`. The log contained `Waiting for the broad check running in d9z-probe-holder (pid 3164094)` and "Broad checks passed".
- Log record: scope `broad`, reason `Broad check required by d9z-broad-probe.txt`, exitStatus 0, lockWaitMs 8,008 (at least 3000), durationMs 35,197.
- After the run, neither the lock directory nor the probe file remained, and `git status --short` showed only the `.planning/` path.
- Lock outcome: the existing lock now serializes broad runs, because they still lint the whole repository. `acquireFullLock`, `FULL_LOCK_*`, and `check-changed-full.lock` still say "full" until the planned redesign. Only the doc comment and the waiting message were changed.

## Final handoff verification (full)

Run on HEAD `6708e06a5a7e27728ad157354013a4c9dc8f2b45` with Node v26.10.0. `node_modules/.cache/eslint` was deleted first, so the lint inside `npm run check` started from an empty cache, as in CI. The two commands ran one after the other in one background call, without `&&`.

| Command                  | Exit | Seconds |
| ------------------------ | ---- | ------- |
| `npm run check`          | 0    | 755     |
| `npm run check:controls` | 0    | 523     |

Source: `/tmp/d9z-final.txt`. These two runs are the full verification of the finished tree. The hooks gave focused and broad evidence only.

## Selector before/after (real tree)

"Before" is from the plan's context fact 5 (HEAD e2907d9f). "After" was measured on the final tree. The counts in `eslint(n)` and `prettier(n)` are file arguments.

| Input | Before | After |
| --- | --- | --- |
| `scripts/check-changed.mjs` | `npm run check` + its control | focused: prettier(1), eslint(1), fallow, `check-changed.negative.mjs` |
| `scripts/test-reporter.mjs` | `npm run check` + control | focused: prettier, eslint, fallow, `test-reporter.negative.mjs` |
| `scripts/test-coverage-direct.pin.mjs` | `npm run check` + control | focused: prettier, eslint, fallow, `test-coverage-direct.negative.mjs` |
| `scripts/check-workflow-install-scripts.mjs` | `npm run check` + control | focused: prettier, eslint, fallow, its control |
| `scripts/check-corresponding-tests.negative.mjs` | `npm run check` + control | focused: prettier, eslint, fallow, its control |
| `scripts/check-unused-type-members.analysis.mjs` | `npm run check` + control | focused: prettier, eslint, fallow, `check-unused-type-members.negative.mjs` |
| `scripts/init.sh`, `scripts/test-coverage-direct.pin.json`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`, `tests/live-uat/stop-canary.mjs` | `npm run check` | broad (the six commands) |
| `tests/e2e/import-command.test.ts` | `npm run check` + `npm run test:e2e` | broad (no e2e run) |
| `package.json` | `npm run check` + `check:controls` | broad + `check:controls` |
| `package.json` + `shared/compare-name-scope.ts` | `npm run check` + `check:controls` | broad + direct coverage of the pair + `check:controls` + `node --test` (75 consumer tests) |
| `scripts/check-unused-type-members.flow.mjs` | focused analyzer + type-member control | unchanged: prettier, eslint(2), fallow, `test:analyzers`, control |
| `scripts/check-unused-type-members.exceptions.json` | prettier + `lint:type-members` | unchanged |
| `shared/compare-name-scope.ts` | focused (about 150 lint files, 76 consumer tests) | focused: typecheck, cached eslint(152), fallow, pairing, direct coverage, 75 consumer tests |

## Deviations from Plan

The plan pre-approved DEV-1 to DEV-3:

- **DEV-1**: the broad baseline includes `npm run lint:workflows`. It paid off in this task (see auto-fix 1 below).
- **DEV-2**: CI clears `node_modules/.cache/eslint` in a step before `npm run check`. It passes no no-cache flag.
- **DEV-3**: the reason text now starts with "Broad check required by"; the trigger-list format is unchanged.

### Auto-fixed Issues

**1. [Rule 1 - Bug] TXT-2 comment tripped the workflow install-script gate**

- **Found during:** Task 1, pre-commit attempt 1 (the new broad `lint:workflows` step).
- **Issue:** `scripts/check-workflow-install-scripts.mjs` matches `npm ci` on any workflow line, comment lines included. The TXT-2 sentence "`npm ci` already starts without node_modules." failed with `missing --ignore-scripts: .github/workflows/ci.yml:86`.
- **Fix:** Changed that one comment sentence to "The clean install already starts without node_modules." The rest of TXT-2 is verbatim. The checker is unchanged.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** 8ca5fbb5. The fix landed before the commit, and attempt 2 passed.

**2. [Formatting] Prettier rewrapped one `eslint(...)` call in `scripts/check-changed.negative.mjs`.** The file was restaged before the pre-commit run. No behavior changed.

Task 2 needed no edits beyond TXT-4 to TXT-7. The search for leftover full-check, uncached, or old-lock wording in the four documents found only the AGENTS.md Git bullet ("a full-scope run can take many minutes"). Choice 8 keeps that bullet out of scope.

## Verification scope

`focused task verification passed; full phase/PR verification pending` does not apply here. This task ran the explicit final `npm run check` (exit 0) and `npm run check:controls` (exit 0) on HEAD 6708e06a with a fresh ESLint cache, and those runs are the full verification. Both Task `<verify>` commands passed. Both fallow audits returned verdict `pass`. `.planning/config.json` is unchanged.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/check-changed.mjs, scripts/check-changed.negative.mjs, package.json, .github/workflows/ci.yml, .pre-commit-config.yaml, AGENTS.md, skills/local-verification/SKILL.md, CONTRIBUTING.md, docs/unused-type-member-gate.md
- FOUND: commits 8ca5fbb5, 6708e06a
- No `.git/check-changed-full.lock` remains. `git status --short` shows only `.planning/` paths.
