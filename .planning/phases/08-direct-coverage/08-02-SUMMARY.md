---
phase: 08-direct-coverage
plan: 02
subsystem: testing
tags: [coverage, lcov, node-test, noUncheckedIndexedAccess, arg-parsing]

requires:
  - phase: 08-direct-coverage
    provides: "08-01's measured enumeration baseline — the seven refused rows with their exact reading strings, which is where all three of this plan's before-readings come from"
provides:
  - "`edge/args.ts`, `edge/handlers/shared.ts`, and `edge/handlers/plugin/pending.ts` read complete under the direct gate, so three rows leave the accepted-shortfall set"
  - "Two cases pinning the `--scope` lookahead: the token after `--scope` is its value even when that token is itself a flag, and a `--scope` with nothing to consume is not an error"
  - "A worked instance of the non-assertion removal: typed iteration under `noUncheckedIndexedAccess` replaces an index loop with no `!` and no `as`"
affects: [08-08, 08-09]

actuals:
  tokens: 6220
  tasks: 3
  commits: 3
  plan_head_before: ea5808e0615bba7ed6f9b1a3bae9e795d610e1fd

tech-stack:
  added: []
  patterns:
    - "A manual index loop that exists only to carry lookahead becomes typed iteration plus an explicit skip flag; the flag states the lookahead the index arithmetic hid"
    - "`entries()` only where a loop genuinely reads a neighbouring element by index; a bare `for...of` everywhere else"
    - "Characterization cases land before the refactor and pass against both shapes — the point is that they would fail if the rewrite dropped the property, not that they start red"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/args.ts
    - extensions/pi-claude-marketplace/edge/handlers/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
    - tests/edge/args.test.ts
    - tests/edge/handlers/shared.test.ts

key-decisions:
  - "The trailing-`--scope` case Task 1 asks for already existed (`tests/edge/args.test.ts`, `install --scope`); it was not duplicated, and only the `--scope --local` case was added"
  - "The `--scope --local` case Task 2 asks for already existed in `tests/edge/handlers/shared.test.ts` asserting `local: false`; instead of duplicating it, the property it pins was stated in the owner's header and only the sole-`--scope` case was added"
  - "`tests/edge/handlers/shared.test.ts`'s `D-116-01a` header paragraph claimed the pair lands one branch short — a claim the rewrite makes false — so it was replaced with the load-bearing property the cases hold"
  - "Measured readings are reported as measured: the two rewritten loops do not reproduce research's predicted branch and line counts exactly, and the gate verdict, not the count, is the criterion"
  - "WINDOWS.md entries 19, 21, and 22 are now false but stay open: `windows fixed` is blocked by a pre-existing table/JSON desync on unrelated rows 9 and 30 — logged to deferred-items.md rather than repaired here"

patterns-established:
  - "Before rewriting a loop whose index arithmetic is not uniform (`i += 2` next to `i += 1`), pin the non-uniform step with a case; the asymmetry is the contract, and the owner suite does not otherwise discriminate it"
  - "A comment that explains why a guard must exist becomes a lie the moment the guard goes; removing the guard includes finding and rewriting that comment"

requirements-completed: []

coverage:
  - id: D1
    description: "`edge/args.ts` reads complete under the direct gate after `parseArgs` iterates with `entries()` and an explicit skip flag"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/args.ts (Direct coverage passed: branches 28/28, functions 2/2, lines 88/88)"
        status: pass
      - kind: unit
        ref: "tests/edge/args.test.ts (20 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`edge/handlers/shared.ts` reads complete under the direct gate after `extractLocalFlag` iterates with `for...of` and an explicit skip flag"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/shared.ts (Direct coverage passed: branches 15/15, functions 3/3, lines 82/82)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/shared.test.ts (18 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`edge/handlers/plugin/pending.ts` reads complete under the direct gate after the first positional is taken by destructuring"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts (Direct coverage passed: branches 9/9, functions 2/2, lines 56/56)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/pending.test.ts (15 pass, 0 fail, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The `--scope` lookahead survives both rewrites: `--scope --local` still leaves the scope-target flag off, and a sole `--scope` still raises no usage error"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "tests/edge/handlers/shared.test.ts#consumes the token after the scope flag as its value, so a scope-target token there leaves the flag off"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/shared.test.ts#reports the flag off and raises no usage error when the scope flag has no value to consume"
        status: pass
      - kind: unit
        ref: "tests/edge/args.test.ts#parseArgs reads the token after the scope flag as its value even when that token is a flag"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole edge suite passes unchanged in contract, and no assertion operator, coverage pragma, or pin row was introduced"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "node --test \"tests/edge/**/*.test.ts\" (657 pass, 0 fail, 22 suites)"
        status: pass
      - kind: other
        ref: "npm run typecheck (exit 0) + npx eslint extensions/pi-claude-marketplace/edge tests/edge --max-warnings=0 (exit 0) + npm fallow via pre-commit (Passed)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-10
status: complete
---

# Phase 08 Plan 02: Three Dense-Index Guards Removed Summary

**Three index loops became typed iteration with an explicit skip flag, deleting the `undefined` arms no input could reach — `edge/args.ts` (28/28 branches), `edge/handlers/shared.ts` (15/15), and `edge/handlers/plugin/pending.ts` (9/9) now read complete under the direct gate with no `!`, no `as`, and no pin row.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-11T02:21Z
- **Completed:** 2026-09-11T02:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `parseArgs` walks `tokens.entries()` with a `skipValue` flag. `entries()` earns its place here and only here: the `--scope` arm reads `tokens[index + 1]`. Reading `branches 28/28, functions 2/2, lines 88/88`, from `branches 28/29, lines 86/89`.
- `extractLocalFlag` walks a bare `for...of` with a `skipValue` flag. Nothing in that loop reads a neighbour by index, so the flag alone carries what `i += 2` encoded. Reading `branches 15/15, functions 3/3, lines 82/82`, from `branches 14/15, lines 83/85`.
- The `pending` handler takes its first positional by destructuring and tests for `undefined`, which retires the `?? ""` arm the enclosing length guard already excluded. Reading `branches 9/9, functions 2/2, lines 56/56`, from `branches 9/10`.
- The `--scope` lookahead is pinned from both sides. One case proves the token after `--scope` is read as its value even when it is itself a flag; a second proves a `--scope` with nothing after it is not a usage error. A rewrite that dropped the skip fails the first of these while every other case in the suite stays green.
- The whole edge suite runs 657 cases with 0 failures — 655 before, plus this plan's two.

## Task Commits

1. **Task 1: Rewrite edge/args.ts's index loop to entries() with an explicit value skip** — `c539b9e8` (refactor)
2. **Task 2: Rewrite edge/handlers/shared.ts's index loop to for...of, preserving the --scope value skip** — `7f47befb` (refactor)
3. **Task 3: Replace pending.ts's indexed positional read with array destructuring** — `3df79731` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/args.ts` — `parseArgs` iterates `tokens.entries()` behind a `skipValue` flag; both `--scope` error message literals are untouched, verified by diffing the range for either string.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts` — `extractLocalFlag` iterates `for...of` behind a `skipValue` flag; the `passThroughLongFlags` check stays a nested `if`, and the `Unknown flag: "` literal is untouched.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` — `const [first] = parsed.positional; if (first !== undefined)` replaces the length guard plus indexed read; both `notifyUsageError` literals are untouched.
- `tests/edge/args.test.ts` — one case added: the token after `--scope` is its value even when that token is a flag, asserted by exact message.
- `tests/edge/handlers/shared.test.ts` — one case added (a sole `--scope` raises no usage error) and the header's stale shortfall paragraph replaced by the property the cases hold.

## Decisions Made

**Two of the four cases the plan asks for already existed.** `tests/edge/args.test.ts` already rejected a trailing `--scope` by exact message (`install --scope`, line 176 of the pre-plan file), and `tests/edge/handlers/shared.test.ts` already asserted `local: false` for `--scope --local` ("consumes the token after the scope flag as its value…"). Per the plan's own instruction, neither was duplicated. Only the two genuinely missing cases were added. That the `--scope --local` property was already pinned is the reason the rewrite could be made with confidence rather than hope.

**The owner header had to change, not just the loop.** `tests/edge/handlers/shared.test.ts` carried a `D-116-01a` paragraph asserting "this pair lands one branch short of complete" and explaining why the guard could not be removed. The rewrite makes every sentence of it false. It was replaced by a present-tense statement of the load-bearing property — that consuming the `--scope` value is the one thing a scanner rewrite can silently drop — which is where the plan's requested "comment naming what it pins" ended up living, matching this file's convention of stating load-bearing properties in the header rather than inline.

**No test was added for `pending.ts`,** as the plan directs. Both usage-error arms are already covered by the existing 15 cases, and a case asserting that index 0 of a non-empty array is defined would restate what the compiler and the gate already enforce.

**`entries()` versus bare `for...of` was decided per loop, not per family.** `args.ts` reads `tokens[index + 1]`, so it needs the index. `shared.ts` reads no neighbour, so taking the index there would be an unused binding that lint would reject anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced a header comment the rewrite made false**

- **Found during:** Task 2 (`edge/handlers/shared.ts` rewrite)
- **Issue:** `tests/edge/handlers/shared.test.ts:18-23` documented the pair as one branch short of complete and explained that removing the guard "needs a non-null or type assertion, both barred throughout `extensions/`" — which the rewrite disproves. Left in place, the file would assert a shortfall that the gate contradicts, and the next reader would meet a stale justification rather than the current contract.
- **Fix:** Replaced the paragraph with the `ER-F19` property the two preservation cases hold. The new text states a fact about the code as it stands and does not narrate the shape that was replaced, per `.claude/rules/typescript-comments.md`.
- **Files modified:** `tests/edge/handlers/shared.test.ts`
- **Verification:** `node --test tests/edge/handlers/shared.test.ts` (18 pass, 0 fail); `npx eslint … --max-warnings=0` exit 0
- **Committed in:** `7f47befb` (Task 2 commit)

**2. [Rule 1 - Bug] Reworded a new comment that contained the literal token ` as `**

- **Found during:** Task 1 (`edge/args.ts` rewrite)
- **Issue:** The first draft of the skip-flag comment read "never examined as a flag". The task's own acceptance grep for an introduced ` as ` type assertion matched that comment line, producing a false positive that any later reviewer running the same grep would hit.
- **Fix:** Reworded to "never tested for flag-ness". The diff-range grep for `!`/` as ` is now clean on an honest reading rather than on a reviewer's judgement call.
- **Files modified:** `extensions/pi-claude-marketplace/edge/args.ts`
- **Verification:** `git diff "$PLAN_BASE" -- …/edge/args.ts | grep '^+' | grep -E '!\.|! *\)|! *;| as '` returns nothing
- **Committed in:** `c539b9e8` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs — one stale comment, one self-defeating grep token, two STATE.md fields the state verbs wrote wrong)
**Impact on plan:** Both are inside the files this plan owns and neither changes behavior. No scope creep.

## Deviations addendum — STATE.md progress fields

**3. [Rule 1 - Bug] Restored `completed_phases` and `percent` after every state verb regressed them**

- **Found during:** state updates, after `state.advance-plan`, `state.add-decision`, and `state.add-blocker`
- **Issue:** Each state verb recomputes the frontmatter `progress` block and wrote
  `completed_phases: 3 -> 1` and `percent: 33 -> 11`. This plan completed no phase, so both are
  regressions. The `completed_plans: 197 -> 198` increment in the same block is correct and was kept.
  The known workstream-STATE behaviour: the verbs cannot read a workstream roadmap's phase tally.
- **Fix:** Restored both fields by hand after the LAST verb call, since any earlier repair is
  overwritten by the next verb. `state.update-progress` itself reports
  `updated: false, reason: no Progress: line found in STATE.md body`, so it cannot be used to fix them.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `sed -n '13,19p' .planning/STATE.md` reads `completed_phases: 3`, `percent: 33`,
  `completed_plans: 198`; no conflict markers in `STATE.md` or `ROADMAP.md`
- **Committed in:** the plan metadata commit

**4. [Rule 1 - Bug] Added the missing unit to the recorded duration**

- **Found during:** state updates
- **Issue:** `state.record-metric --duration 20` wrote `| Phase 08 P02 | 20 | 3 tasks | 5 files |`,
  where every other row in the Performance Metrics table carries the unit (`39min`, `42min`).
- **Fix:** Corrected the cell to `20min`.
- **Files modified:** `.planning/STATE.md`
- **Committed in:** the plan metadata commit

## Issues Encountered

**Research's predicted branch and line counts do not reproduce exactly, and the measured numbers are reported as measured.** Research recorded `branches 29/29, lines 86/86` for `args.ts` and `branches 15/15, lines 81/81` for `shared.ts`. This tree measures `28/28, lines 88/88` and `15/15, lines 82/82`. The line deltas are comment lines this plan added; the `args.ts` branch delta (28 against 29) means the loop shape built here is not byte-identical to the probe's. `pending.ts` matches research exactly at `9/9, 56/56`. The criterion each task states is the gate's verdict line, and all three print `Direct coverage passed:`. Quoting research's numbers into the SUMMARY would have been the repudiation `T-08-09` names — a reading taken from a recorded number rather than from the instrument.

**`pre-commit run --files` exceeds a two-minute tool budget.** The first attempt was killed at 120 s. Re-run with a 10-minute budget it completes with every hook passing (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow` all Passed) under `SKIP=trufflehog`, which is the prescribed skip for this worktree. Each of the three commits ran the hooks to completion before committing; none used `--no-verify`.

**WINDOWS.md entries 19, 21, and 22 could not be closed.** Each records one of the three arms this plan deleted and each states it "closes only by a production rewrite". `gsd-tools windows fixed <id>` refuses for all three because the rendered table disagrees with the fenced JSON on rows **9 and 30** — unrelated rows, last written by `697d6812`, so the desync predates this phase. Repairing another plan's drift in a shared planning artifact is outside this plan's scope; it is logged to `.planning/phases/08-direct-coverage/deferred-items.md` with 08-08 named as the natural owner.

## Known Stubs

None. This plan removed code; it added no placeholder, no unwired path, and no coverage exception.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Two records of the now-removed defect are still live, and both belong to 08-08:**

1. `CONTRIBUTING.md:55-66` states "Seven modules fall short today" and tables all three of this plan's modules with their old readings (`edge/args.ts` branches 28/29, `edge/handlers/plugin/pending.ts` branches 9/10, `edge/handlers/shared.ts` branches 14/15). Those three rows are now false. 08-08 and 08-09 are the plans that list `CONTRIBUTING.md` in `files_modified`; 08-08 writes the regenerated baseline from the second sweep.
2. `.planning/WINDOWS.md` entries 19, 21, and 22, blocked as described above.

**The shortfall set is down to four measured modules** from 08-01's seven: `bridges/commands/discover.ts` (pin row, two sites per `D-08-A05`), `bridges/hooks/event-router.ts` (tests per `D-08-A04`), `orchestrators/plugin/update-preflight.ts`, and `orchestrators/plugin/install-outcome.ts`. No pin row is needed for any module this plan touched, and `scripts/test-coverage-direct.pin.json` does not yet exist, so none could have been added.

**No blocker for downstream plans.** `npm run typecheck` is clean, the edge suite is green at 657 cases, and the three modules' public signatures, exported types, and error message strings are byte-for-byte what they were.

---

_Phase: 08-direct-coverage_
_Completed: 2026-09-10_

## Self-Check: PASSED

All five modified source/test files, the SUMMARY, and `deferred-items.md` are present on disk.
All three task commits (`c539b9e8`, `7f47befb`, `3df79731`) are reachable from `git log --all`.
