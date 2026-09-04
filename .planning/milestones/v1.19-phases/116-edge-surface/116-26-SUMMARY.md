---
phase: 116-edge-surface
plan: "26"
subsystem: testing
tags: [node-test, edge, argument-scanner, coverage-shortfall, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's pinned tests/helpers/notification-boundary.ts, consumed with an explicit toolProbes of 0 at every call site and no cwd option"
  - phase: 116-edge-surface
    provides: "116-02's amended D-116-01a pin form — shortfall identity, not absolute branch numbers"
  - phase: 116-edge-surface
    provides: "116-12's and 116-23's settled G3 helper-owner shape"
provides:
  - "tests/edge/handlers/shared.test.ts — the sole mirrored direct owner for edge/handlers/shared.ts, landing at the argued D-116-01a shortfall"
  - "The scanning contract the seven mutating-command handler owners build on: they assert only the usage string, the pass-through list they supplied, and that the residual reached the next stage"
affects:
  [116-13, 116-14, 116-15, 116-16, 116-18, 116-19, 116-20, 116-21, 116-22, 116-24, 116-25]

actuals:
  tokens: 9400
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "G3 helper owner with a single export: no describe(), a flat sequence of test() bodies, one module-local return-type alias derived from the module's own signature"
    - "Position independence by identical whole value: three placement rows share one hand-authored expected object, so a filter regression reddens all three"
    - "Zero-emission boundary as the silence proof: an accepting case states no emission at all, so the first unwanted notification dies at the pending-call proxy"
    - "Whitespace-class discrimination: a tab row separates the split-on-whitespace claim from the drop-empty-tokens claim, which a spaces-only row cannot do"

key-files:
  created: []
  modified:
    - tests/edge/handlers/shared.test.ts

key-decisions:
  - "The expected-value type alias is NonNullable<ReturnType<typeof extractLocalFlag>>, derived from the export's own signature, so a change to the returned shape is a compile error in this suite rather than a stale hand-copied literal"
  - "The pass-through list argument is passThroughFlagNames(\"install\") — the real production list the real caller supplies — while the flag asserted to survive is the hand-authored literal --map-model. extractLocalFlag does not derive its own list from that call (the caller does), so this is a behavior link rather than the tautology 116-23 rejected; the catalog's contents are not asserted here and stay owned by tests/edge/flag-catalog.test.ts and the drift guard"
  - "A fourth whitespace row using a tab was ADDED beyond the plan's three. Plant D showed the plan's run-of-interior-spaces row cannot fail under either single-mutation plant: split(/\\s+/) is greedy, so an interior run of spaces never produces an empty token, and the filter that the row was meant to pin is exercised only by the leading and trailing rows. The tab row reddens under a split narrowed to a literal space (plant E) and is what makes the interior-whitespace claim discriminating"
  - "No exhaustiveness plant was attempted: handlers/shared.ts has no switch and no closed-union dispatch, so D-116-14 has no target here (recorded per the plan's own must_have)"
  - "No case asserts the absence of direct process output and none re-pins the catalog's per-verb flag sets; ESLint, fallow, and tests/edge/flag-catalog.test.ts already own those (D-116-12)"

patterns-established:
  - "Whitespace-class rows must separate the two claims they look like one of: dropping empty tokens and splitting on a whitespace CLASS are independent behaviors, and a spaces-only row pins neither on its own"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/handlers/shared.test.ts owns every runtime-reachable branch of edge/handlers/shared.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/shared.test.ts — 17 runtime cases from 12 marked bodies, pass 17 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/shared.ts (functions 100.00, branches 14/15, lines 83/85, uncovered 54-55)"
        status: pass
  - deliverable: "The documented D-116-01a shortfall for edge/handlers/shared.ts is re-measured and argued"
    human_judgment: false
    verification:
      - kind: command
        ref: "the plan's identity assertion — incomplete verdict printed, denominator minus numerator equals 1, exactly 2 uncovered lines, uncovered cell reads 54-55 — exits 0"
        status: pass
  - deliverable: "The WR-02 residual removal is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant A — the residual filter dropped; five cases reddened, including all three placement rows"
        status: pass
  - deliverable: "The caller-supplied pass-through allow-list is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant B — the membership test forced to always miss; the pass-through case reddened"
        status: pass
  - deliverable: "The scope-pair value consumption is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant C — the pair advance reduced to one token; the scope-followed-by-scope-target case reddened"
        status: pass
  - deliverable: "The empty-token filter is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant D — the length filter removed; the leading and trailing whitespace rows reddened, the interior-spaces row did NOT (the finding that produced the tab row)"
        status: pass
  - deliverable: "The whitespace-class split is proven discriminating"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant E — the split narrowed to a literal space; the added tab row reddened alone"
        status: pass

metrics:
  duration: "45 min"
  completed: 2026-09-02
---

# Phase 116 Plan 26: Cross-Cutting Flag Scanner Owner Summary

`edge/handlers/shared.ts` now has a mirrored owner in the pair-contract shape, covering the single
export `extractLocalFlag` across every runtime-reachable branch, and landing at the exact D-116-01a
shortfall the phase ratified for it. No production file changed.

## What was built

`tests/edge/handlers/shared.test.ts`, 233 lines added over 55 removed. One export means no
`describe()`: twelve marked case bodies emit seventeen runtime cases at the top level. Every
expected value is a hand-authored literal compared as one whole object with
`assert.deepStrictEqual`, tagged `satisfies Scan` where
`type Scan = NonNullable<ReturnType<typeof extractLocalFlag>>`.

| Case | What it pins |
| --- | --- |
| no flag supplied | the flag off and the positionals rejoined |
| three placement rows (WR-02) | the scope-target flag before, between, and after the other tokens yields ONE identical whole value — the position-independence proof |
| the flag supplied twice | every scope-target token is removed, and the flag stays on |
| a scope pair | both tokens survive verbatim in the residual for the downstream parser |
| an unrecognised scope value | the scanner returns a result and emits nothing — the value is rejected one layer down, not here |
| a scope flag immediately followed by the scope-target flag | the pair consumption takes the next token as the value, so the flag stays OFF while the residual filter still drops the token |
| a caller-listed long flag | survives verbatim in the residual and does not set the flag |
| a long flag the caller did not list | `undefined` returned, exactly one notification, whole message hand-written including the blank line before the usage block |
| an unknown flag after an accepted scope-target token | still rejects with exactly one notification, so the scan is proven not to stop early |
| a single-dash token | kept as an ordinary residual token, not treated as a long flag |
| four whitespace rows | a run of interior spaces, an interior tab, leading whitespace, and trailing whitespace all yield one identical single-space-separated residual with no empty token |
| no argument text at all | `{ local: false, residualArgs: "" }` with zero notifications |

**The boundary.** `createNotificationBoundary` with an explicit `toolProbes` of 0 at every call
site: `extractLocalFlag` reaches the user only through `notifyUsageError`, which writes straight to
the channel and runs no soft-dependency probe. Thirteen accepting cases size it at zero emissions,
which is itself the proof that a successful scan is silent — an unwanted emission has no stated
expectation and dies at the pending-call proxy. The two rejecting cases size it at one emission and
call `verifyBoundary()`. No case states `cwd`: nothing in this module reads it, so any read would be
unexpected.

## D-116-01a record

**Measured verdict, verbatim:**

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/shared.ts: branches 14/15, lines 83/85
```

Coverage table row, verbatim:

```text
     shared.ts                |  97.65 |    93.33 |  100.00 | 54-55
```

The four parts D-116-01a requires:

1. **Exact line range.** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:53-55` — the
   `if (tok === undefined) { break; }` guard inside the `extractLocalFlag` while loop. Lines 54-55
   (the `break;` and its closing brace) are the two uncovered lines; line 53 executes on every
   iteration as the guard's false arm.
2. **Unreachable at runtime.** `tokens` is a dense array built by
   `args.split(/\s+/).filter((t) => t.length > 0)`. `String.prototype.split` returns no holes, and
   `Array.prototype.filter` produces a dense result, so every index in `[0, tokens.length)` holds a
   string. The loop condition is `i < tokens.length` and every arm advances `i` by 1 or 2 from a
   value that satisfied that condition, so `tokens[i]` is never read out of range. No input to
   `extractLocalFlag` can make the read yield `undefined`.
3. **The compiler setting that forces it.** `noUncheckedIndexedAccess` (`tsconfig.json:12`) types
   every index read as `T | undefined` regardless of what the surrounding bounds guarantee, so
   `const tok = tokens[i]` is `string | undefined` and the guard must exist for the later
   `tok === "--scope"` and `tok.startsWith("--")` reads to compile. Removing it needs a non-null
   assertion (`@typescript-eslint/no-non-null-assertion` is an error throughout `extensions/` and
   relaxed only for `tests/**`) or a type assertion (banned by this phase's own anti-pattern grep).
   The only remaining route is a loop rewrite, which the operator declined. **No coverage-exception
   pragma was added and no production file was changed.**
4. **Measured numbers as an observation, not a gate.** Branches **14/15**, lines **83/85**,
   functions **100 percent**. The plan pins the shortfall's *identity* — an incomplete verdict is
   printed, denominator minus numerator equals exactly 1, exactly two lines are uncovered, and the
   uncovered cell reads `54-55`. All four held. The suite moved the pair from `branches 12/14,
   lines 78/85` (uncovered `54-55` and `71-75`) to `branches 14/15, lines 83/85` (uncovered `54-55`
   alone): the pass-through arm at `71-75` is now covered, and the denominator rose by one because
   covering that arm made a previously-collapsed V8 range diverge from its parent. This is the same
   denominator behavior 116-02 measured; it confirms the amended identity-based pin was the right
   call, since a `13/14` number pin authored before the rewrite would have failed here on a
   strictly stronger suite.

The verdict is not passing, and it must not be made to pass. A passing verdict would mean the
shortfall no longer holds and would itself be a reportable finding.

## Plants

Five plants, all RED. The plan named two; three more were run because each covers a claim whose
failure mode is not obvious from the assertion. Each was reverted and the revert confirmed with
`git diff --quiet` before the next.

**Plant A — drop the residual filter** (`tokens.filter((t) => t !== SCOPE_TARGET_FLAG).join(" ")`
became `tokens.join(" ")`). This is the WR-02 regression itself. Predicted RED for the removal
cases; five cases reddened.

```text
✖ removes the scope-target flag from the residual when it appears before every other token (WR-02)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +   residualArgs: '--local alpha@official --scope user'
  -   residualArgs: 'alpha@official --scope user'
✖ removes the scope-target flag from the residual when it appears between two other tokens (WR-02)
  +   residualArgs: 'alpha@official --local --scope user'
  -   residualArgs: 'alpha@official --scope user'
✖ removes the scope-target flag from the residual when it appears after every other token (WR-02)
  +   residualArgs: 'alpha@official --scope user --local'
  -   residualArgs: 'alpha@official --scope user'
✖ removes every scope-target token when the flag is supplied more than once (WR-02)
  +   residualArgs: '--local alpha@official --local'
  -   residualArgs: 'alpha@official'
✖ consumes the token after the scope flag as its value, so a scope-target token there leaves the flag off
  +   residualArgs: '--scope --local alpha@official'
  -   residualArgs: '--scope alpha@official'
```

**Plant B — force the pass-through membership test to always miss**
(`passThroughLongFlags.includes(tok)` became `passThroughLongFlags.includes("--never-supplied")`).
Exactly the pass-through case reddened, and it reddened in the shape this milestone already
measured: an unstated emission on a zero-emission boundary dies at the pending-call proxy as a raw
`TypeError` rather than as a notification-count assertion. That shape was kept, not softened —
stating `ctx.ui` to get a prettier message would weaken the silence proof.

```text
✖ keeps a caller-listed long flag verbatim in the residual and leaves the flag off
  TypeError: ctx.ui.notify is not a function
```

**Plant C — reduce the scope-pair advance from two tokens to one** (`i += 2` became `i += 1`).
Exactly the pair-consumption case reddened, which is the "genuine and easily-lost behavior" the plan
called out: with the pair consumed correctly the scope-target token is the scope VALUE and does not
set the flag.

```text
✖ consumes the token after the scope flag as its value, so a scope-target token there leaves the flag off
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +   local: true,
  -   local: false,
```

**Plant D — remove the empty-token filter** (`args.split(/\s+/).filter((t) => t.length > 0)` became
`args.split(/\s+/)`). The leading and trailing whitespace rows reddened as predicted. **The
run-of-interior-spaces row stayed GREEN — a finding, and the reason a fourth row exists.**
`/\s+/` is greedy, so an interior run of spaces never produces an empty token; that row could not
fail under this mutation. The empty-argument case also stayed green, correctly: `"".split(/\s+/)`
yields `[""]`, which joins back to `""` either way, so that case's claim does not rest on the filter.

```text
✖ separates the residual with single spaces and emits no empty token given leading whitespace
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +   residualArgs: ' alpha@official --scope user'
  -   residualArgs: 'alpha@official --scope user'
✖ separates the residual with single spaces and emits no empty token given trailing whitespace
  +   residualArgs: 'alpha@official --scope user '
  -   residualArgs: 'alpha@official --scope user'
```

**Plant E — narrow the split from a whitespace class to a literal space**
(`args.split(/\s+/)` became `args.split(" ")`, filter retained). Run against the strengthened suite
that carries the added tab row. Exactly that row reddened, which is what makes the
interior-whitespace claim discriminating and closes the plant-D finding.

```text
✖ separates the residual with single spaces and emits no empty token given interior whitespace that is not a space
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +   residualArgs: 'alpha@official\t--scope\tuser'
  -   residualArgs: 'alpha@official --scope user'
```

## Deviations from Plan

**1. [Rule 2 — missing critical proof] A fourth whitespace row was added.**

- **Found during:** Task 1, plant D.
- **Issue:** The plan named three whitespace shapes: a run of interior spaces, a leading space, and
  a trailing space. Plant D showed the interior-spaces row cannot fail under the mutation it looks
  like it pins, and plant E showed it cannot fail under the split narrowing either. It was a row
  that could not discriminate on its own.
- **Fix:** Added a fourth row driving an interior tab. It reddens alone under plant E. The plan's
  three rows were kept, not replaced — the claim is now covered rather than narrowed.
- **Files modified:** `tests/edge/handlers/shared.test.ts`
- **Commit:** `8bf2166b`

**2. [Plan defect, reported not fixed] The plan's own `<acceptance_criteria>` and
`<success_criteria>` contradict its `must_haves` on the coverage outcome.**

The first sentence of `<acceptance_criteria>` and the first bullet of `<success_criteria>` both say
the pair reaches "100 percent direct functions, lines, and branches". The plan's `must_haves`, its
`<objective>`, the same `<acceptance_criteria>`'s closing sentence, and the `<verify>` block all say
the opposite and correct thing: the pair lands at the D-116-01a shortfall with exactly one uncovered
branch and uncovered lines `54-55`, and a *passing* verdict fails the link. The executable gate and
the ratified decision agree with each other, so they were followed; the two stale prose sentences
are a leftover from before the D-116-01a amendment. Nothing was changed to satisfy them — doing so
would have meant deleting a production guard or adding a coverage exception, both forbidden.

## Verification

Every gate run separately with its exit code checked. `npm run check` was not used: its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests.

| Gate | Result |
| --- | --- |
| `node --test tests/edge/handlers/shared.test.ts` | 0 — 17 pass, 0 fail |
| the plan's coverage identity assertion | 0 — branches 14/15, lines 83/85, uncovered `54-55` |
| `npm run typecheck` | 0 |
| `npm exec -- eslint tests/edge/handlers/shared.test.ts` | 0 |
| `npm exec -- prettier --check` on the same path | 0 |
| `npm run fallow` | 0 |
| the anti-pattern scan | no match (so the negated link passes) |
| `rg -c '^\s+// arrange$'` | 12 |
| `git diff --check` | 0 |
| `git diff --quiet` over the five pinned files | 0 — none changed |
| `npm test` | 0 — 4945 pass, 0 fail, 280 suites |
| `npm run test:integration` | 0 — 31 pass, 0 fail |
| trufflehog filesystem scan | 0 — chunks 1, bytes 9396, 0 verified, 0 unverified |
| `SKIP=trufflehog,npm-format-check pre-commit run --files` | 0 |

The correspondence gate still reports 10 violations, unchanged. This pair was a rewrite of an
existing file, not one of the five new owners, so it was never among the gate's findings.

## Known Stubs

None.

## Self-Check

- `tests/edge/handlers/shared.test.ts` — FOUND
- commit `8bf2166b` — FOUND

## Self-Check: PASSED
