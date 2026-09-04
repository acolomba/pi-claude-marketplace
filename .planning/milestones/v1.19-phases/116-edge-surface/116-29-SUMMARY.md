---
phase: 116-edge-surface
plan: "29"
subsystem: testing
tags: [node-test, edge, router, dispatch, aliases, strong-mock, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's createNotificationBoundary(emissions, toolProbes) — a count of 0 states no expectation at all"
  - phase: 116-edge-surface
    provides: "the G4 exact-argument interaction shape settled by tests/edge/handlers/plugin/shared.test.ts"
provides:
  - "tests/edge/router.test.ts — the sole mirrored direct owner for edge/router.ts, at 100 percent direct functions, lines and branches"
  - "the measured correction that the two subcommand vocabularies deliberately overlap on four names, so 'no marketplace name is also handled by the top-level dispatch' is false against the real module"
  - "a worked shape for proving alias identity in one case: one stated expectation with a definite count of 2, driven once by the alias and once by the canonical name"
affects: []

actuals:
  tokens: 7641
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Row-driven dispatch matrix over an injected handler record: the row names the target member by hand, the loop indexes the strong mock with it, and a name added to the exported vocabulary without a row fails the vocabulary case"
    - "Alias identity in one case: one expectation stated with a definite count of 2, then the alias and its canonical name each driven once — two separate cases would prove two dispatches, not one identity"
    - "Cross-dispatch separation as the real anti-shadowing proof: a token both vocabularies spell is driven through both entry points in one case, against two distinct stated members"
    - "Hand-authored usage blocks at module scope: the emission expectations compose them, so a usage assertion pins the real text instead of passing for any text"

key-files:
  created: []
  modified:
    - tests/edge/router.test.ts

key-decisions:
  - "DEVIATION — a must_haves claim that is false against the real module. The plan asked to assert 'no marketplace name reachable through the marketplace dispatch is also handled by the top-level dispatch under a different handler member'. Four names are: list, ls, info, and update appear in BOTH exported vocabularies and reach list/list/pluginInfo/update at the top level against marketplaceList/marketplaceList/marketplaceInfo/marketplaceUpdate behind the marketplace token. Written as stated the case could only be made green by asserting something untrue. It was replaced with the behavior that actually carries the anti-shadowing promise: one case per shared name, driving both entry points against two distinct stated members, so neither vocabulary can start shadowing the other unnoticed"
  - "DEVIATION — the 'no duplicate entries' half of the same claim was folded into the vocabulary cases rather than written as a Set comparison. Deduplicating the exported constant and comparing the result back to itself would be an expectation produced by transforming an actual result, which the plan's own acceptance criteria forbid. The vocabulary cases compare each exported list against the hand-authored row table that serves it, where every name is written once and visibly, so a duplicate entry in the export fails there"
  - "The two exported usage blocks are pinned in their own cases. They are hand-authored at module scope and composed into every usage-error expectation, and the separate pin cases exist because the constants are part of the surface this pair owns — the completion provider reads the subcommand lists declared beside them"
  - "No exhaustiveness plant was attempted, per the plan's explicit instruction and D-116-14's scoping to 116-27 alone. Both switches turn on an open string peeled from raw user input (router.ts:148, :197) and both carry a default arm, so removing an arm produces a usage error at runtime rather than any compiler diagnostic. What catches a removed arm here is the row table, through the usage error the router would begin emitting instead"
  - "Every dispatch case sizes the boundary at zero emissions and every usage-error case at one emission with zero tool probes — notifyUsageError writes straight to ctx.ui.notify and runs no soft-dependency probe"
  - "No production file was touched. The two plants were applied to extensions/pi-claude-marketplace/edge/router.ts, measured, and reverted from a byte copy taken before the first one; git diff --quiet on the pinned production paths and on tests/helpers/notification-boundary.ts passed after each revert and again before staging"

patterns-established:
  - "When a plan's stated invariant is false against the module, do not narrow it into vacuity — find the behavior that carries the same promise and prove that instead. Here 'the vocabularies do not overlap' was false; 'the overlap resolves differently per dispatch' is both true and falsifiable"
  - "A pin case that can never fail alone is redundant, but a pin case for a constant other modules import is owned surface — say which one it is in the header so the next reader does not delete it as noise"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/router.test.ts owns every dispatch arm, alias, and usage-error path of edge/router.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/router.test.ts — 45 runtime cases from 20 marked bodies, pass 45 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts → Direct coverage passed (branches 37/37, functions 3/3, lines 221/221)"
        status: pass
  - deliverable: "Every alias resolves to the same handler member as its canonical name, and the shared names do not shadow across the two dispatches"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/router.test.ts — 3 alias-identity cases (ls, marketplace rm, marketplace ls) plus 4 cross-dispatch cases (list, ls, info, update)"
        status: pass
  - deliverable: "Both D-116-04 plants went RED and were reverted"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant A rerouted the list/ls arm → 5 cases RED; Plant B removed the leading-whitespace strip → 1 case RED. Both reverted, git diff --quiet clean"
        status: pass
  - deliverable: "No production file and no shared test helper changed"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- router.ts, the three handler shared.ts files, flag-catalog.ts, tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows one file changed"
        status: pass
---

# Phase 116 Plan 29: Router Owner Summary

The subcommand router is now owned through a strict mock of its injected handler record: every
dispatch case states the one call it promises with both arguments written out, every usage-error case
states none at all, and the paired source moved from 34/37 branches and 218/221 lines to 100 percent
direct functions, lines, and branches.

## Accomplishments

- **Rewrote `tests/edge/router.test.ts`** — 45 runtime cases from 20 marked case bodies, replacing 22
  cases that built the context with a double assertion through `unknown` and recorded handler calls in
  a plain array. The handler record is now `mock<SubcommandHandlers>({ exactParams: true })`, typed
  from the module's own exported record type, and every case ends with `verify(handlers)`.
- **Drove both dispatch matrices from hand-authored row tables** — 13 top-level rows and 9 marketplace
  rows, each naming its target handler member by hand. Two vocabulary cases compare each exported
  subcommand list against the rows that serve it, so a name added to a list without a dispatch arm
  fails here.
- **Closed the three uncovered arms** — `pending`, `enable`, and `disable` (router.ts:167, :169, :171)
  had no case at all in the old suite.
- **Proved alias identity in one case each** — one expectation with a definite count of 2, driven once
  by the alias and once by the canonical name, for `ls`, `marketplace rm`, and `marketplace ls`.
- **Proved the remainder reaches the handler byte-for-byte** — leading whitespace stripped, the
  interior of the remainder preserved, quotes and flags untouched, an absent remainder and a
  whitespace-only remainder both arriving as the empty string, and the double peel through the
  marketplace token.
- **Sized the boundary at zero emissions on every dispatch case**, which is what makes a successful
  route provably silent, and at one emission with zero tool probes on every usage-error case.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Rewrite the router owner with an exact-argument handler mock and a full alias matrix | `3a6c36a5` | `tests/edge/router.test.ts` |

## Plants (D-116-04)

Both plants named by the plan were applied to `extensions/pi-claude-marketplace/edge/router.ts`,
measured, and reverted from a byte copy taken before the first one.

### Plant A — reroute the `list`/`ls` arm to a different handler member

Mutation at `router.ts:163`: `return handlers.list(rest, ctx);` → `return handlers.pending(rest, ctx);`

Result: **RED**, `pass 40 fail 5` — the `list` row, the `ls` row, the `ls` alias-identity case, and
both cross-dispatch cases for `list` and `ls`.

```text
test at tests/edge/router.test.ts:114:3
✖ dispatches list to the list handler with the remaining argument text (AP-3) (2.680295ms)
  Error: Didn't expect subcommand handlers.pending("alpha@official --scope user", [Function extension context]) to be called.

  No remaining expectations.
      at Proxy.<anonymous> (file:///.../node_modules/strong-mock/dist/index.js:410:13)
      at routeClaudePlugin (file:///.../extensions/pi-claude-marketplace/edge/router.ts:163:23)
      at TestContext.<anonymous> (file:///.../tests/edge/router.test.ts:121:11)

test at tests/edge/router.test.ts:169:1
✖ routes the ls alias and the list subcommand to one and the same plugin list handler (0.796709ms)
  Error: Didn't expect subcommand handlers.pending("official --scope user", [Function extension context]) to be called.

  No remaining expectations.
```

Reverted; `git diff --quiet -- extensions/pi-claude-marketplace/edge/router.ts` exit 0.

### Plant B — remove the leading-whitespace strip from the token peeler

Mutation at `router.ts:123`: `const trimmed = args.trimStart();` → `const trimmed = args;`

Result: **RED**, `pass 44 fail 1` — exactly the leading-whitespace case, in the documented over-read
shape: the zero-emission boundary states no `ctx.ui`, so the router's fallback into `notifyUsageError`
dies on the pending-call proxy rather than on a message mismatch.

```text
test at tests/edge/router.test.ts:268:1
✖ strips whitespace that precedes the subcommand (0.910571ms)
  TypeError: ctx.ui.notify is not a function
      at notifyUsageError (file:///.../extensions/pi-claude-marketplace/shared/notify.ts:326:10)
      at routeClaudePlugin (file:///.../extensions/pi-claude-marketplace/edge/router.ts:144:5)
      at TestContext.<anonymous> (file:///.../tests/edge/router.test.ts:275:9)
```

Reverted; `git diff --quiet -- extensions/pi-claude-marketplace/edge/router.ts` exit 0, and the suite
returned to `pass 45 fail 0`.

### No exhaustiveness plant

Neither switch carries an exhaustiveness guarantee, and no missing-arm plant was attempted. Both
`switch` statements (`router.ts:148` and `:197`) turn on `head`, an open `string` peeled from raw user
input, and both carry a `default:` arm. Removing an arm changes runtime behavior — the token falls
through to a usage error — and produces no compiler diagnostic at all. D-116-14's exhaustiveness
obligation is scoped to 116-27 alone and none of it was imported here. What catches a removed arm in
this pair is the row table, through the usage error the router would begin emitting instead; Plant A
is the measured demonstration that a wrong arm fails loudly.

## Deviations from Plan

### 1. [Rule 1 — Plan defect] A `must_haves` claim that is false against the real module

- **Found during:** Task 1, while authoring the anti-shadowing cases.
- **Issue:** The plan asked to assert that "no marketplace name reachable through the marketplace
  dispatch is also handled by the top-level dispatch under a different handler member." Four names
  are. `list`, `ls`, `info`, and `update` appear in **both** exported vocabularies. At the top level
  they reach `list`, `list`, `pluginInfo`, and `update`; behind the `marketplace` token they reach
  `marketplaceList`, `marketplaceList`, `marketplaceInfo`, and `marketplaceUpdate`. Written as
  specified, the case could only be made green by asserting something untrue about the module.
- **Fix:** Replaced with the behavior that actually carries the anti-shadowing promise — one case per
  shared name, driving the same token through both entry points in one case against two distinct
  stated members. A dispatch that started shadowing the other now fails on the unexpected member.
- **Files modified:** `tests/edge/router.test.ts`
- **Verification:** four cases, all green; Plant A takes two of them RED.
- **Commit:** `3a6c36a5`

### 2. [Rule 1 — Plan defect] The "no duplicate entries" assertion could not be written as specified

- **Found during:** Task 1.
- **Issue:** The plan asked to "assert the two exported name lists contain no duplicate entries." The
  only self-contained way to do that is to deduplicate the exported constant and compare the result
  back against the constant — an expectation produced by transforming an actual result, which the
  plan's own acceptance criteria forbid in the same task.
- **Fix:** Folded the claim into the two vocabulary cases. Each exported list is compared as a whole
  value against the hand-authored row table that serves it, where every accepted name is written once
  and visibly. A duplicate entry in an export fails there, against a hand-authored expectation.
- **Files modified:** `tests/edge/router.test.ts`
- **Verification:** both vocabulary cases green; adding a name to either export without a row fails.
- **Commit:** `3a6c36a5`

**Total deviations:** 2, both plan defects corrected in place (2 × Rule 1). **Impact:** the owner
proves stronger, true properties than the plan specified; no scope was dropped and no case was
weakened.

## Issues Encountered

None.

## Verification Results

Each gate was run separately and its exit code checked individually. `npm run check` was **not** used:
its `format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests run.

| Gate | Command | Result |
| ---- | ------- | ------ |
| Focused suite | `node --test tests/edge/router.test.ts` | exit 0 — tests 45, pass 45, fail 0 |
| Direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts` | `Direct coverage passed … (branches 37/37, functions 3/3, lines 221/221)` |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint (focused) | `npm exec -- eslint tests/edge/router.test.ts` | exit 0 |
| Lint (repo) | `npm run lint` | exit 0 |
| Format | `npm exec -- prettier --check tests/edge/router.test.ts` | exit 0 |
| Fallow | `npm run fallow` | exit 0 |
| Anti-pattern scan | the plan's negated `rg` link | exit 0 — no match |
| Arrange markers | `rg -c '^\s+// arrange$'` | 20, equal to the 20 case bodies |
| Whitespace | `git diff --check -- tests/edge/router.test.ts` | exit 0 |
| Pinned sources | `git diff --quiet` over router.ts, the three `shared.ts` helpers, flag-catalog.ts, notification-boundary.ts | exit 0 |
| Unit suite | `npm test` | exit 0 — tests 4984, suites 283, pass 4984, fail 0 |
| Integration | `npm run test:integration` | exit 0 — tests 31, pass 31, fail 0 |
| Secret scan | `trufflehog filesystem tests/edge/router.test.ts --results=verified,unknown --fail` | exit 0 — chunks 2, bytes 21081, verified 0, unverified 0 |
| Hooks | `SKIP=trufflehog,npm-format-check pre-commit run --files tests/edge/router.test.ts` | exit 0 — all applicable hooks Passed |

Baseline before the rewrite, for the record:
`Incomplete direct coverage for extensions/pi-claude-marketplace/edge/router.ts: branches 34/37, lines 218/221`,
uncovered lines `167 169 171`.

## Observations (no action taken)

- **The correspondence gate is unchanged at 10 violations.** `tests/edge/router.test.ts` was already a
  correctly-mirrored pair, so this plan neither closed nor opened one. The remaining 10 are
  pre-existing and belong to other plans.
- **`npm test` now reports 4984 cases across 283 suites**, up from the 4945/280 recorded in the
  handoff; the difference is 116-27's suite plus this rewrite's net case change.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change was introduced —
this plan changed one test file and touched no production surface.

## Next

Ready for the next plan in wave 4 (116-07 … 116-13, the marketplace handlers). Waves 1-3 and the
DAG-recomputed wave 2 pair (116-27, 116-29) are closed; 11 of 31 plans complete.

## Self-Check: PASSED

- `tests/edge/router.test.ts` exists on disk (18009 bytes).
- `git log --oneline --all | grep 3a6c36a5` → found.
- All plan `<verification>` gates re-run and recorded above; all `<acceptance_criteria>` re-checked.
