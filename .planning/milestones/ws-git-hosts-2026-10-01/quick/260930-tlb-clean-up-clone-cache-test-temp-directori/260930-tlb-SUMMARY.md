---
phase: 260930-tlb
plan: 01
subsystem: tests
tags: [tests, hermeticity, temp-directories, clone-cache]
status: complete
requires: []
provides:
  - per-case removal of every temporary directory tests/orchestrators/plugin/clone-cache.test.ts creates
affects:
  - tests/orchestrators/plugin/clone-cache.test.ts
tech-stack:
  added: []
  patterns:
    - "t.after(() => rm(<dir>, { recursive: true, force: true })) on the line after mkdtemp"
key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/clone-cache.test.ts
decisions:
  - "Cleanup is registered per case on the owning TestContext, with no module-level lifecycle hook"
  - "SEED cases keep two directories (project root and marketplace checkout), each removed by its own registration"
metrics:
  duration: ~25 min
  completed: 2026-09-30
requirements: [TREF-01, NFR-6]
actuals:
  tokens: 7200
  tasks: 2
  commits: 2
plan_head_before: e40d3dda389929927c9441cf6cf277bf0ab23d8f
plan_head_after: 556345c8ad825ea7eb97e14b75528ee316066bb6
---

# Quick Task 260930-tlb: Clean up clone-cache test temp directories Summary

Every `mkdtemp` in `tests/orchestrators/plugin/clone-cache.test.ts` now pairs with a `t.after` `rm` on the owning case's TestContext. One run of the file leaves an empty TMPDIR. Before the change, it left 54 directories.

## Baseline

- Start SHA: `e40d3dda389929927c9441cf6cf277bf0ab23d8f`
- RED baseline (empty TMPDIR under /var/tmp, unedited file):

```
     39 clone-cache-
      1 clone-cache-escape-
     11 clone-cache-marketplace-
      1 clone-cache-missing-
      1 clone-cache-nongit-
      1 clone-cache-subdir-
ℹ tests 57
ℹ pass 57
ℹ fail 0
TEST_EXIT=0 BARE=39 LEFTOVER=54
```

## Task Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 (tracer) | `4beb7fa6` | test: clean up clone-cache scope temp directories |
| 2 | `556345c8` | test: clean up the remaining clone-cache temp directories |

Both commits change only `tests/orchestrators/plugin/clone-cache.test.ts`. `git diff --name-only e40d3dda..HEAD` prints only that file.

## Results

- **Task 1 leak check:** `TEST_EXIT=0 BARE=0 LEFTOVER=15`. The 15 left were 11 clone-cache-marketplace- and one each of the nongit, subdir, escape and missing directories. Tests: 57/57 passed. Census: `freshLocations(t)=39 buildMarketplaceCheckout(t)=0 openers(t)=39 mkdtemp=6 cleanup=1`.
- **Final census:** `freshLocations(t)=39 buildMarketplaceCheckout(t)=11 openers(t)=42 mkdtemp=6 cleanup=6`.
- **Pairing:** `paired=6`.
- **Final leak check:** `TEST_EXIT=0 LEFTOVER=0`. The TMPDIR listing was empty, not even `node-compile-cache`. Tests: `tests 57`, `pass 57`, `fail 0`.
- **Direct coverage:** `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts (branches 99/99, functions 12/12, lines 629/629)`.
- **npm run check:** the log ended with:

```
option-failure: ok
Unused type member negative controls passed (7 of 7).
CHECK_EXIT=0
```

- **fallow audit:** `"verdict":"pass"` before both commits.
- **pre-commit:** `pre-commit run --files tests/orchestrators/plugin/clone-cache.test.ts` exited 0 before both commits. `git status` after each commit showed the test file clean, so no hook rewrote it.
- `.agents/skills/new-gsd-workspace/SKILL.md` is still an unstaged modification, untouched.

## Deviations from Plan

**1. [Rule 3 - Blocking] Recovered from a self-inflicted truncation during the Task 1 edit**
- **Found during:** Task 1
- **Issue:** My first edit used `perl -i` with a slurp (`my @l = <>`). After the slurp, `print` went to stdout, so the test file was left empty.
- **Fix:** The file had no changes before this edit, so I restored it with `git checkout -- tests/orchestrators/plugin/clone-cache.test.ts` (one file only). I re-applied the same transformation through a scratch file and checked the line count (1695 → 1696). Nothing was committed in the broken state.
- **Commit:** none (fixed before `4beb7fa6`)

**2. [Rule 1 - Cleanup] Removed /tmp leftovers from the Task 1 pre-commit run**
- **Found during:** Task 1 commit
- **Issue:** The pre-commit hook `npm direct coverage (changed pairs)` ran the test file under the default TMPDIR. At that point Task 2's fixes were not in yet, so the run left 15 directories in /tmp. The plan warned about this for `npm run check` and direct coverage, but it did not mention that pre-commit runs direct coverage too.
- **Fix:** I removed exactly those 15 `clone-cache-*` directories. All of them had a timestamp from that run (11 marketplace, plus nongit, subdir, escape and missing). After Task 2, `npm run check` and the second pre-commit run left 0 `clone-cache-*` directories in /tmp.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: tests/orchestrators/plugin/clone-cache.test.ts
- FOUND: 4beb7fa6
- FOUND: 556345c8
