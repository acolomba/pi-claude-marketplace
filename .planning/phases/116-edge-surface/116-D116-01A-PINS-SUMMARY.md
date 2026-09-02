---
phase: 116-edge-surface
plan: "D116-01A-PINS"
subsystem: testing
tags: [d-116-01a, coverage-shortfall, identity-pin, edge, gap-closure]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-03's measured unreachability proof for edge/completions/data.ts:188"
  - phase: 116-edge-surface
    provides: "116-13's measured unreachability proof for edge/handlers/marketplace/update.ts:41"
  - phase: 116-edge-surface
    provides: "116-02's and 116-26's identity-pin shape, and 116-21's no-lines-clause variant of it"
provides:
  - "the D-116-01a identity pin for edge/completions/data.ts:188, in the suite header and in the 116-03 verify block"
  - "the D-116-01a identity pin for edge/handlers/marketplace/update.ts:41, stating the required-false asymmetry that makes the arm dead here and live for its siblings"
  - "the measured correction that a pair's identity pin has TWO homes, not one: prose in the suite header and the executable assertion in the plan verify block. An in-suite executable pin is impossible, because the coverage gate runs node --test over the paired suite and would recurse"
affects: []

actuals:
  tokens: 9000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "For a pair whose lines and functions are BOTH complete, the exact uncovered line set is pinned by the ABSENCE of a `lines` or `functions` clause from the verdict line, anchored with `$`. That is stronger than naming a range and needs no range to maintain — 116-21's variant of the 116-02 shape"

key-files:
  created:
    - .planning/phases/116-edge-surface/116-D116-01A-PINS-SUMMARY.md
  modified:
    - tests/edge/completions/data.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - .planning/phases/116-edge-surface/116-03-PLAN.md
    - .planning/phases/116-edge-surface/116-03-SUMMARY.md
    - .planning/phases/116-edge-surface/116-13-PLAN.md
    - .planning/phases/116-edge-surface/116-13-SUMMARY.md
    - .planning/STATE.md

key-decisions:
  - "Both pins take the 116-21 variant of the identity shape, not the 116-02 one, because both pairs measure lines and functions COMPLETE. The verdict line is `Incomplete direct coverage for <source>: branches N/M` with nothing after it, so the regex anchors on `$` immediately after the branch pair. A `lines` or `functions` clause appearing is then itself the failure — which is exactly how a moved uncovered-line set surfaces in this verdict shape. 116-02 and 116-26 pin `lines 86/89` / `54-55` because their pairs genuinely have uncovered lines; these two do not"
  - "DEVIATION (scope) — the task confined edits to the two suites, their two SUMMARY files, and STATE.md. The executable half of the pin cannot live in any of those. The coverage gate runs `node --test` over the PAIRED SUITE, so an in-suite assertion that shells out to the gate would recurse into itself. Measured against the two named reference pairs: `tests/edge/args.test.ts` carries NO pin text at all, and `tests/edge/handlers/shared.test.ts` carries only a prose header paragraph. In both, the executable identity assertion lives in the plan's `<verify><automated>` link, and the D-116-01a-required claim lives in the plan's `must_haves`. 116-03-PLAN.md and 116-13-PLAN.md were therefore amended too — the same two files, and the same two blocks, that the operator's earlier amendment touched when it re-pinned 116-02, 116-17, 116-21, and 116-26"
  - "No production file was touched. Three plants were applied to production to re-confirm the recorded unreachability and each was restored from a byte-copy taken beforehand; `git diff --quiet -- extensions/` exits 0. Zero coverage-exception pragmas exist anywhere in `extensions/` or `tests/`"
  - "`.planning/WINDOWS.md` entries 15 and 16 were NOT edited. Both descriptions still end `reported, not pinned or excepted`, which is now stale. The ledger is outside this task's scope and its `status` column is the phase-boundary sweep's business, so the drift is reported rather than fixed"

patterns-established:
  - "A pin is only a gate if it can fail. Plant it in BOTH directions: break the assertion against real output (proves the assertion is live), and doctor the output against the unbroken assertion (proves it catches a real change). The second direction is the one that matters, and it is the one a mutated-assertion plant alone does not give you"

requirements-completed: []

coverage:
  - deliverable: "edge/completions/data.ts:188 is a pinned D-116-01a claim"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts header — names the line, the runtime unreachability, the standard-library typing of Array.prototype.at() that forces the fallback, the measured proof, and that no coverage exception is added"
        status: pass
      - kind: command
        ref: "116-03-PLAN.md <verify> link, re-run end to end against the committed pair → exit 0 at branches 109/110"
        status: pass
  - deliverable: "edge/handlers/marketplace/update.ts:41 is a pinned D-116-01a claim, stating the structural asymmetry"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/update.test.ts header — states that NO compiler setting forces the arm, that parseCommandArgs passes the usage string only for a required positional, and that the arm is therefore dead here and LIVE for siblings declaring a required one"
        status: pass
      - kind: command
        ref: "116-13-PLAN.md <verify> link, re-run end to end against the committed pair → exit 0 at branches 11/12"
        status: pass
  - deliverable: "Each pin is falsifiable"
    human_judgment: false
    verification:
      - kind: other
        ref: "Six plants. Assertion-side: requiring a lines clause, and asserting a 2-branch shortfall — both FAIL against real output, for each pin. Output-side, with the pin unbroken: a lines clause appearing, a second branch going uncovered, and the verdict disappearing (the gate passing) — all three FAIL, for each pin"
        status: pass
  - deliverable: "The two original plants still behave as 116-03 and 116-13 recorded"
    human_judgment: false
    verification:
      - kind: other
        ref: "data.ts:188 fallback replaced → 66/66 GREEN. update.ts:41 literal replaced → 7/7 GREEN. update.ts:41 condition inverted → 6 pass 1 fail, the rejection case RED on the collapsed sentence. All three reverted; production byte-identical"
        status: pass
  - deliverable: "No production file changed and no coverage pragma exists"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --stat -- extensions/ → empty; rg 'c8 ignore|node:coverage ignore' extensions/ tests/ → exit 1, no matches"
        status: pass

duration: 40 min
completed: 2026-09-02
---

# Phase 116 D-116-01a Pins Summary

The operator amended D-116-01a to open its claimant list to measurement after 116-03 and 116-13 had
already executed. Both had MEASURED an unreachable branch and, under the old locked four-claimant
rule, reported it as prose. Prose is not a gate. Both shortfalls are now pinned by identity.

## What changed

**Pin 1 — `edge/completions/data.ts:188`**, the right-hand side of `allTokens.at(-1) ?? ""`.
Compiler-forced: the standard library types `Array.prototype.at()` as `T | undefined`, so the
fallback must exist even though `splitCompletionInput` has already returned for an empty input and
for an input ending in whitespace, which leaves the filtered token list non-empty at that line.
Removing it needs a non-null assertion or a type assertion, both barred throughout `extensions/`.

**Pin 2 — `edge/handlers/marketplace/update.ts:41`**, the `message === USAGE` collapse arm. NOT
compiler-forced. `parseCommandArgs` passes the usage string to the callback only for a REQUIRED
positional, and this schema declares its sole positional `required: false`. The arm is therefore dead
for THIS module and stays LIVE for the sibling handlers that declare a required positional. The
amendment requires that distinction to be part of the claim, and both the suite header and the plan's
`must_haves` state it.

Each pin has two halves:

- **In the suite** — a D-116-01a header paragraph naming the exact line, the runtime unreachability,
  the reason, the measured proof, and that no coverage exception is added. This is the shape
  `tests/edge/handlers/shared.test.ts` already carries.
- **In the plan's `<verify>` link and `must_haves`** — the executable identity assertion. It matches
  an `Incomplete direct coverage for <source>: branches N/M` verdict with branch numbers read
  loosely, requires denominator minus numerator to equal exactly 1, and anchors on `$` so a `lines`
  or `functions` clause appearing fails the link. A passing verdict fails it too.

**No absolute branch pair is asserted anywhere.** The measured `109/110` and `11/12` appear in the
`must_haves` and in the summaries as observations, never as a gate.

## Both pairs measure lines and functions complete, so the pin takes 116-21's variant

116-02 pins `lines 86/89` and an uncovered cell reading `35-37`; 116-26 pins two uncovered lines at
`54-55`. Those pairs have uncovered lines. These two do not — the gate prints

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/completions/data.ts: branches 109/110
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts: branches 11/12
```

with no `lines` and no `functions` clause and an empty uncovered-line cell. The exact uncovered line
set is therefore the empty set, and it is pinned by the trailing `$`: the moment a line goes
uncovered the gate appends a `lines` clause and the regex stops matching. That is stronger than
naming a range, and it is the variant 116-21's plan already authored for the same situation.

## Plants

### The two original plants, re-confirmed

| Plant | Mutation | Recorded | Measured now |
| ----- | -------- | -------- | ------------ |
| 116-03 Plant F | `data.ts:188` fallback → `"@@unreached@@"` | GREEN | GREEN, 66/66 |
| 116-13 Plant C | `update.ts:41` literal replaced | GREEN | GREEN, 7/7 |
| 116-13 Plant D | `update.ts:41` condition inverted to `message !== USAGE` | RED | RED, 6 pass 1 fail |

Plant D's failure is byte-for-byte what 116-13 recorded — the rejection case receives
`Missing required argument.` where it expects the tokenizer diagnostic:

```text
✖ reports an unrecognised scope value with the update usage block and never updates
  actual: [ { message: 'Missing required argument.\n\nUsage: /claude:plugin marketplace update [<name>] [--scope user|project]', severity: 'error' } ],
```

Each was restored from a byte-copy taken before it was applied. `git diff --quiet -- extensions/`
exits 0.

### The pins themselves, planted in both directions

Breaking a pin proves the pin is live. Doctoring the world proves it catches a real change. Both were
run, per pin, against real captured gate output.

| Direction | Mutation | Pin 1 | Pin 2 |
| --------- | -------- | ----- | ----- |
| — | real gate output, pin as authored | PASS 109/110 | PASS 11/12 |
| assertion | require a `lines` clause | FAIL | FAIL |
| assertion | assert a 2-branch shortfall | FAIL | FAIL |
| output | a `lines` clause appears | FAIL | FAIL |
| output | a second branch goes uncovered | FAIL `saw 2` | FAIL `saw 2` |
| output | the verdict disappears (gate passes) | FAIL | FAIL |

The last row is the one D-116-01a calls out by name: a passing verdict still fails the link and must
be reported, never edited away.

## Deviations

### 1. [Rule 3 - Blocker] The executable half of a pin cannot live in a test file

- **Issue:** The task confined edits to the two suites, their two SUMMARY files, and STATE.md, and
  asked for a pin that can be broken and confirmed RED. No assertion in any of those files can do it.
  `scripts/test-coverage-direct.mjs` runs `node --test` over the PAIRED SUITE, so an in-suite
  assertion that shells out to the gate recurses into itself.
- **Measured:** the two named reference pairs do not carry an executable pin either.
  `tests/edge/args.test.ts` carries no pin text at all — no header comment, no case. Only
  `tests/edge/handlers/shared.test.ts` carries a prose header paragraph. In both, the executable
  identity assertion is in the plan's `<verify><automated>` link and the required claim is in the
  plan's `must_haves`, which is a plan block, not a summary block.
- **Fix:** delivered both halves — the header paragraph in each suite, and the verify assertion plus
  `must_haves` truth in each plan. `116-03-PLAN.md` and `116-13-PLAN.md` are the same two blocks in
  the same two kinds of file that the operator's earlier amendment edited when it re-pinned 116-02,
  116-17, 116-21, and 116-26.
- **Verification:** both amended `<verify>` links re-run end to end against the committed pairs, exit
  0. Six plants, above.

**Total deviations:** 1 (a scope extension to the two PLAN files, without which the pin is prose).
**Impact:** the pins are gates rather than comments, in both files a future reader will look in.

## Observations for the operator

- **`.planning/WINDOWS.md` entries 15 and 16 are now stale.** Both descriptions end
  `reported, not pinned or excepted`; both are pinned. Left untouched — the ledger and its `status`
  column belong to the phase-boundary sweep.
- **Neither suite gained or lost a case.** `npm test` is 5044/5044, unchanged. Both changes are
  header comments.
- **Two stale production comments remain unacted-on**, as 116-03 recorded: `data.ts:1-12` advertises
  a `getScopeCompletions` export that does not exist, and `data.ts:361` says `--partial` widens the
  install set when it shifts it. No production licence exists to fix them.

## Known Stubs

None.

## Verification Results

Each gate run separately with its own exit code checked. `npm run check` was NOT used — its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests.

| Gate | Result |
| ---- | ------ |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — 5044/5044 across 291 suites |
| `npm run test:integration` | exit 0 — 31/31 |
| `116-03-PLAN.md` `<verify>` chain | exit 0 |
| `116-13-PLAN.md` `<verify>` chain | exit 0 |
| anti-pattern scan on both suites | exit 1 (no match) — negated link passes |
| `rg 'c8 ignore\|node:coverage ignore' extensions/ tests/` | exit 1 — zero pragmas repo-wide |
| `git diff --stat -- extensions/` | empty — no production file changed |
| `git diff --stat -- .planning/ROADMAP.md` | empty — ROADMAP unchanged |

## Next Phase Readiness

Wave 4 is next (116-05, 116-07, 116-08, 116-09, 116-11), unchanged. The plan count stays at 14 of 31;
this closed a gap, not a plan.

Every remaining plan inherits the amended rule: **if you MEASURE an unreachable branch, you are a
claimant and you pin it.** Both variants of the identity shape now have a worked example in this
phase — 116-02 and 116-26 where lines are incomplete, 116-03 and 116-13 where they are not.

## Self-Check: PASSED

- `tests/edge/completions/data.test.ts` and `tests/edge/handlers/marketplace/update.test.ts` each
  carry a `D-116-01a:` header paragraph.
- Both amended `<verify>` chains exit 0; both pins fail on all five mutations.
- `git diff --stat -- extensions/` is empty.
