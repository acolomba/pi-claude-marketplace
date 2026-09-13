---
phase: 260912-fp0
plan: 01
subsystem: edge
tags: [typescript, comments, completions, process-cwd, windows-ledger]

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: WINDOWS.md ledger entry 20 naming the two stale cwd-lifetime comments
provides:
  - Both cwd comment sites in edge/register.ts state the per-completion-lookup read
  - The inline site cites its pinning test by path and by test title
  - Evidence for sibling item 260912-fp3 to dispose WINDOWS entry 20 as fixed
affects: [260912-fp3, windows-ledger-disposition]

actuals:
  tokens: 1976
  tasks: 2
  commits: 1
plan_head_before: 6bc71dc4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A production comment that states a behavior cites the gate pinning it by path AND test title, so the claim stays checkable if the suite relocates"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts

key-decisions:
  - "Kept both sanction sentences verbatim and replaced only the false lifetime claims, so the `process.cwd()` exemption rationale survives"
  - "Cited the pin as `tests/edge/register.test.ts` plus the test title rather than a line number, matching the house style in bridges/hooks/dispatch-exec.ts and edge/flag-catalog.ts"
  - "Skipped trufflehog (this checkout is a linked worktree, the documented SKIP case) and npm-format-check (it fails repo-wide on an orchestrator-owned untracked BATCH.json this item is forbidden to touch) rather than touching either out-of-scope file"

patterns-established:
  - "Behavior-immutability gate: a comment-only plan gates on a diff whose changed non-comment line count is exactly 0, so a behavior edit cannot ride along"

requirements-completed: []

coverage:
  - id: D1
    description: "Neither cwd comment site in edge/register.ts claims a registration-time capture or a resolver reused across lookups; both state the per-lookup read"
    verification:
      - kind: other
        ref: "! grep -qE 'per-command-registration|Captured at registration time|closed-over resolver' extensions/pi-claude-marketplace/edge/register.ts && grep -q 'completion lookup' ... && grep -q 'tests/edge/register.test.ts' ... && grep -q 'D-04' ... && ! grep -qiE 'Phase [0-9]+|Plan [0-9]+|Wave [0-9]+|milestone v[0-9]' ..."
        status: pass
    human_judgment: false
  - id: D2
    description: "Executable behavior is byte-unchanged — the diff carries comment lines only"
    verification:
      - kind: other
        ref: "git diff HEAD -U0 -- extensions/pi-claude-marketplace/edge/register.ts | awk (non-comment changed lines) == 0"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts (20/20 pass, incl. 'resolves argument completions against the working directory the callback runs in (D-04)')"
        status: pass
    human_judgment: false
  - id: D3
    description: "The corrected prose reads correctly to a human and matches the comment policy's present-tense rule"
    verification:
      - kind: manual_procedural
        ref: "read extensions/pi-claude-marketplace/edge/register.ts header block and the getArgumentCompletions comment"
        status: unknown
    human_judgment: true
    rationale: "Comment accuracy and readability is a judgment call; the greps prove the forbidden tokens are gone but not that the replacement prose reads well"

# Metrics
duration: 11min
completed: 2026-09-12
status: complete
---

# Quick Item 260912-fp0: Correct the cwd-Lifetime Comments in edge/register.ts Summary

**Both cwd comments in `edge/register.ts` now state that `process.cwd()` is read inside the `getArgumentCompletions` arrow on every completion lookup, replacing the false claim of a registration-time capture threaded through a closed-over resolver.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-12T15:33:00Z
- **Completed:** 2026-09-12T15:44:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- The file-header paragraph keeps its `process.cwd()` sanction and now closes with the real semantics: the read happens inside the `getArgumentCompletions` callback, once per completion lookup, so completions resolve against the directory the process is in at the moment the user types and no directory value is retained between lookups.
- The inline comment above `getArgumentCompletions` keeps its single-sanctioned-site line and now states that the arrow body runs per lookup, builds a fresh `makeLocationsResolver` from the current directory each time, and that the read happens per lookup rather than once at registration. It cites the pin by path and title.
- The behavior-immutability gate measured **0** changed non-comment lines, so the runtime behavior — which was already the correct one — is provably untouched.

## Task Commits

1. **Task 1: Rewrite both cwd comment sites to the measured behavior** and **Task 2: Gate and commit the comment fix** - `b6f1e037` (docs)

Both tasks land in one commit: Task 2 is the gate-and-commit step for Task 1's edit, so there is no intermediate state worth committing.

**Plan metadata:** owned by the batch orchestrator (this item commits only the production file).

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/register.ts` - Comment text only. Header block (the `process.cwd()` sanction paragraph) and the inline comment above the `getArgumentCompletions` property. `D-04` on header line 3, header lines 9-10, BLOCK A, BLOCK C, both JSDoc blocks, and the `session_start` / TC-7 comment are untouched.

## Gate Readings

| Gate | Reading |
|---|---|
| Stale-claim greps (`per-command-registration`, `Captured at registration time`, `closed-over resolver`) | absent; `completion lookup`, `tests/edge/register.test.ts`, `D-04` all present; no planning references |
| Changed non-comment lines in the file diff | **0** |
| `node --test tests/edge/register.test.ts` | exit 0 — 20 pass, 0 fail |
| `npx prettier --check extensions/pi-claude-marketplace/edge/register.ts` | exit 0 |
| `pre-commit run --files extensions/pi-claude-marketplace/edge/register.ts` | clean with `SKIP=trufflehog,npm-format-check`; `npm lint`, `npm typecheck`, `npm fallow`, `npm direct coverage (changed pairs)` all Passed |
| Commit subject | `docs(edge): fix cwd-lifetime comments on argument completions` — 61 chars, Conventional Commits, no planning references |
| Commit body line widths | all <= 80 |
| Files in commit | 1 (`extensions/pi-claude-marketplace/edge/register.ts`); 0 deletions |
| Branch at commit | `features/refine-unit-tests` (not `main`) |

## WINDOWS Entry 20 Disposition Evidence

**For sibling item `260912-fp3`: the ledger was NOT stale — this landed as a real edit.**

Both stale claims were live in the working tree at `6bc71dc4`:

- header: `The cwd captured here is per-command-registration.`
- inline: `Captured at registration time; threads through every keystroke's completion lookup via the closed-over resolver.`

Both are now gone. **Commit SHA: `b6f1e037a01875867fa05a1d1f3cca6e9ce2744a`** (short `b6f1e037`).

## Decisions Made

- The planner's line numbers had drifted from the ledger's (`:117-119` vs the ledger's `:104-106`); both sites were located by content, as the plan directed.
- One clarifying negative was kept at the inline site ("the read happens per lookup, not once when the command is registered") because a registration-time capture is the reader's default assumption and dispelling it is the point of the fix. It is phrased as a property of the code as it stands, not as narration of a removed shape, so it satisfies the comment policy's ban on describing prior shapes.

## Deviations from Plan

None to the source edit — the plan executed exactly as written. Two environment notes on the gate run:

**1. [Environment, not a deviation] `trufflehog` cannot scan from this checkout**

- **Found during:** Task 2 (`pre-commit run`)
- **Reading:** `failed to read index file: open .../.git/index: not a directory`
- **Cause:** `.git` here is a file, not a directory — `git rev-parse --git-dir` resolves to `/home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-refine-unit-tests`, so this checkout is a **linked worktree**, not the primary checkout the execution-mode brief described. `CLAUDE.md` documents `SKIP=trufflehog` as the sanctioned handling for exactly this case.
- **Action:** committed with `SKIP=trufflehog`. No file touched.

**2. [Out of scope] `npm-format-check` fails on an untracked, orchestrator-owned file**

- **Found during:** Task 2 (`pre-commit run`)
- **Reading:** `[warn] .planning/quick-batches/260912-foz/BATCH.json`
- **Cause:** the hook is `pass_filenames: false`, so `format:check` runs repo-wide and picks up an untracked file this item is explicitly forbidden to write. `prettier --check` on the actual changed file passes, and the filename-scoped `prettier` hook Passed.
- **Action:** skipped the hook for this commit; did not touch `BATCH.json`. The batch coordinator's end-of-run `npm run check` will surface it if it still needs formatting.

---

**Total deviations:** 0 source deviations; 2 gate-environment notes.
**Impact on plan:** none. Both skipped hooks are unrelated to the changed file, and the four in-scope gates (lint, typecheck, fallow, direct coverage) all ran and Passed.

## Issues Encountered

`.planning/STATE.md` shows as modified in the working tree. That write is the batch orchestrator's session narrative, not this item's — this item never opened STATE.md for writing. Left untouched, as were the other pre-existing modifications and untracked paths.

## User Setup Required

None.

## Next Phase Readiness

- `260912-fp3` can dispose WINDOWS entry 20 as fixed, citing `b6f1e037`.
- `.planning/WINDOWS.md` is untouched by this item.
- No follow-up commit was needed: `git status --short` is clean for `edge/register.ts` after the commit, so no hook rewrote the file mid-commit.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/edge/register.ts` — FOUND
- `.planning/quick/260912-fp0-correct-the-cwd-lifetime-comments-in-ext/260912-fp0-SUMMARY.md` — FOUND
- commit `b6f1e037` — FOUND in `git log --all`

---
*Item: 260912-fp0*
*Completed: 2026-09-12*
