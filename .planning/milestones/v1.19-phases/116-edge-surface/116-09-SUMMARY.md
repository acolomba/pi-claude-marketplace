---
phase: 116-edge-surface
plan: "09"
subsystem: testing
tags: [node-test, edge, marketplace, info, group-c, offline, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-12's `edge/handlers/marketplace/shared.ts` owner, which owns the single-name parse mechanism this shim wires a constant and a workflow into"
provides:
  - "tests/edge/handlers/marketplace/info.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/info.ts, at 100 percent direct branches, functions, and lines"
  - "the measured THIRD diagnostic for the Group-C negative: `getMarketplaceInfo` performs no catch, so the unstated-`cwd` failure escapes as `ERR_INVALID_ARG_TYPE` inside `locationsFor` (the `list.ts` family), while the same plant with a literal working directory dies on the emission count instead"
  - "the measured FIFTH `--local` outcome: a shim that never calls `extractLocalFlag` and declares one REQUIRED positional takes `--local` as the NAME, so `--scope project --local` reports `⊘ --local [project] (failed) {not added}`"
  - "the per-owner NFR-5 offline shape: a context-owned fail-fast replacement of the process-wide transport, asserted by CALL COUNT in every case, rejecting ones included"
  - "the measured outcome that a single REQUIRED positional also DROPS surplus tokens — the fifth plan running for which the phase's `must_haves` truth 3 'one above the accepted arity is rejected' is false"
affects: []

actuals:
  tokens: 24000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED, three marketplaces seeded so a workflow that ran would have records to report, the whole notification list compared, `verifyBoundary()` last"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })` — one emission, two `getAllTools()` reads (one soft-dependency probe reading twice), one `cwd` read. All four counts were measured against the real module through a counting proxy before a line of the suite was written"
    - "Offline proof for a read-only edge path: `t.mock.method(globalThis, 'fetch', refuseNetwork)` registered inside the hermetic-workspace helper, asserted `strictEqual(fetchCallCount(), 0)` in EVERY case. The count is what is asserted, never an error message — an error-message assertion passes for the wrong error"
    - "Delegation observed as the emitted row and its scope bracket: `alpha` seeded in BOTH scopes, so a scope selection is visible as which rows survive, and an unnamed `beta` seeded in the user scope alone, so a lookup that widened past the first positional would surface it"
    - "`marketplaceRoot` is a literal this suite chose (`/repo/path/alpha`), never a temporary path, so the rendered `path:` line stays hand-authored while only the manifest has to exist on disk"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/info.test.ts

key-decisions:
  - "MEASURED — a THIRD answer to the Group-C negative's diagnostic, and it confirms 116-08's durable rule rather than replacing it. `getMarketplaceInfo` wraps nothing in a catch: `collectMarketplaceRecordsByScope` reads `opts.cwd` on the orchestrator's first statement, so Plant C1 (falling through to a real workflow call forwarding `ctx.cwd`) dies as `ERR_INVALID_ARG_TYPE: The \"path\" argument must be of type string. Received function` at `persistence/locations.ts:145`. Plant C2, the same fall-through with a literal working directory, runs the workflow to completion and dies on the emission count as `ctx.ui.notify is not a function` at `orchestrators/marketplace/info.ts:184`. Both variants recorded verbatim. Omitting `cwd` is what makes the workflow fail at all; which member it trips is a property of the orchestrator's error handling"
  - "DEVIATION — the plan's `must_haves` truth 3 ('both out-of-range counts are rejected with a usage error before any orchestrator call') is FALSE against this module, for the FIFTH plan running. The schema is one REQUIRED positional, so zero IS rejected (truth 3's lower half holds here, unlike 116-08), but `parseCommandArgs` walks `schema.positional.entries()` — the SCHEMA, not the input — so the second token of `alpha beta` is never inspected. Measured: `alpha beta` emits byte-identical output to `alpha`, and the seeded user-scope `beta` is never reported. Written as a DROP proof; Plant E (a surplus-positional rejection added to `parseCommandArgs`) confirms the case discriminates. The plan's `<action>` text already anticipated this and instructed 'assert what actually reaches the workflow rather than assuming a rejection' — the defect is in `must_haves` alone"
  - "MEASURED — the FIFTH distinct `--local` outcome in this phase, and a sixth would still be a guess. `makeSingleNameMarketplaceHandler` never calls `extractLocalFlag`, so `--local` reaches `parseArgs` as an ordinary token and lands on `positional`. With one REQUIRED positional declared, `--scope project --local` puts `--local` in the NAME position: the workflow runs, finds nothing, and reports `⊘ --local [project] (failed) {not added}` at error severity. This matches `marketplace/update.ts` (116-13) and differs from `list.ts` (drops it), `add.ts`, and `autoupdate.ts` (both accept it beside `--scope`). Asserted as the measured outcome, never as a rejection"
  - "The offline claim is a real NFR-5 obligation here, not a formality. `tests/architecture/no-orchestrator-network.test.ts` source-greps five ORCHESTRATOR files and says nothing about the edge tier, so nothing else in the repo gates this shim's read-only path. Plant D (a `fetch` call added to the shared single-name handler) turns all SEVEN cases RED with `1 !== 0`, which is what makes the zero-count assertion a proof rather than a decoration"
  - "No D-116-01a claim. The pair holds 100 percent — branches 2/2, functions 1/1, lines 22/22, unchanged from the baseline. The plan's threat T-116-09-B (an outcome-thin rewrite dropping a branch the old suite covered incidentally) was re-measured after the rewrite and did not occur. Nothing was filed in `.planning/WINDOWS.md`"
  - "No case restates 116-12. `tests/edge/handlers/marketplace/shared.test.ts` drives `makeSingleNameMarketplaceHandler` with an injected `run` and a hand-authored `INFO_USAGE` literal, so it owns the collapse rule (`:90`), the surplus drop (`:111`), and the verbatim-diagnostic rule (`:130`) as MECHANISMS. What is unproven there and proven here is IDENTITY: which constant and which workflow `makeMarketplaceInfoHandler` actually wires in. Every case title states the identity claim, and the surplus case's distinct fact is that the dropped token reaches no SECOND real lookup — observable only because `beta` is a real seeded record"
  - "OBSERVATION, not a defect — the scope-target case does NOT discriminate the delegate. Under Plant B (swapping in `removeMarketplace`) it stayed GREEN, because both workflows emit the same `{not added}` row for an absent name. Its claim is about where `--local` lands and which scope reaches the workflow, and Plant F proves the second half. The delegate identity is carried by the four other delegating cases, all of which went RED under Plant B"
  - "No production file was touched. Six plants were applied across `edge/handlers/marketplace/info.ts`, `edge/handlers/marketplace/shared.ts`, and `edge/args-schema.ts`, each reverted from a byte copy taken before the first plant; `git diff --quiet -- extensions/` exited 0 after the last revert, and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "For a read-only edge owner, the D-116-06 negative has no on-disk half to assert — the workflow writes nothing even on success. `verifyBoundary()` plus the omitted `cwd` carries it alone, and the offline call count is the fact that replaces the config footprint"
  - "Seed one record the expectations never name. `beta` in the user scope costs one line and converts 'the surplus token was dropped' from a claim about an options bag into a claim about which lookups the real workflow performed"
  - "Three Group-C modules now give three different diagnostics for the same plant. The sizing is durable; the stack trace is not. Run the plant, then write down what it said"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/info.test.ts owns edge/handlers/marketplace/info.ts at 100 percent direct branches, functions, and lines"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/info.test.ts — 7 runtime cases from 5 marked bodies, pass 7 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts → branches 2/2, functions 1/1, lines 22/22"
        status: pass
  - deliverable: "The usage block this shim supplies is the info form, written out by hand"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — swap USAGE to the remove form; both usage-identity cases RED on the deepStrictEqual diff"
        status: pass
  - deliverable: "The delegate this shim supplies is the info workflow"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — pass removeMarketplace as the delegate; all four delegating cases RED"
        status: pass
  - deliverable: "The D-116-06 negative: the info workflow is proven unreached on both rejection channels"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/info.test.ts#supplies the info usage block, shown when the name positional is missing"
        status: pass
      - kind: command
        ref: "Plant C1 — fall through to a real getMarketplaceInfo call forwarding ctx.cwd; both rejecting cases RED with ERR_INVALID_ARG_TYPE at locationsFor"
        status: pass
      - kind: command
        ref: "Plant C2 — the same fall-through with a literal working directory; both rejecting cases RED with ctx.ui.notify is not a function"
        status: pass
  - deliverable: "The read-only path never reaches the network (NFR-5), asserted by call count in every case"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — add a fetch call to the shared single-name handler; all 7 cases RED with 1 !== 0"
        status: pass
  - deliverable: "A surplus positional is dropped rather than rejected, and reaches no second lookup"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant E — add a surplus-positional rejection to parseCommandArgs; the surplus case RED"
        status: pass
  - deliverable: "The scope the flags selected is the scope the workflow reports"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant F — delete the conditional scope spread; both explicit-scope rows and the scope-target case RED, each widening to the both-scope cascade"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over info.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 35 min
completed: 2026-09-02
---

# Phase 116 Plan 09: Marketplace Info Owner Summary

The thinnest shim in the phase now has one hermetic owner that proves its usage block, its delegate,
and — as a real NFR-5 obligation rather than a formality — that its read-only path never reaches the
network.

## What was built

`tests/edge/handlers/marketplace/info.test.ts` was rewritten from seven loose cases built on a
hand-rolled context cast (two of which tested `edge/router.ts`, not this module at all) into seven
runtime cases from five marked bodies, all on the shared strict boundary.

| Marked body | Args | Boundary sizing | Proves |
|-------------|------|-----------------|--------|
| scope selection (3 rows) | `alpha`, `alpha --scope project`, `alpha --scope user` | `(1, 2, {cwd, reads: 1})` | the delegate is the info workflow; the scope member is present only when supplied, observed through the row's scope bracket |
| missing name positional | `""` | `(1, 0)`, **no `cwd`** | the usage-block identity; the D-116-06 negative |
| unrecognised scope value | `alpha --scope bogus` | `(1, 0)`, **no `cwd`** | the same constant on the second rejection channel, beside a verbatim parse diagnostic; the D-116-06 negative |
| surplus positional | `alpha beta` | `(1, 2, {cwd, reads: 1})` | the surplus token is DROPPED and reaches no second lookup — the seeded `beta` is never reported |
| scope-target flag | `--scope project --local` | `(1, 2, {cwd, reads: 1})` | `--local` is not a flag on this shim; it lands in the NAME position |

Direct coverage held at **branches 2/2, functions 1/1, lines 22/22** — unchanged from the baseline.

Three marketplaces are seeded in every case, rejecting ones included: `alpha` in both scopes so a
scope selection is visible as which rows survive, and `beta` in the user scope alone as a record no
expectation names. A workflow that ran on a rejection would have had records to report.

## The Group-C negative — a third diagnostic for the same plant

116-10 measured that the phase's normative G5 excerpt named the wrong mechanism; 116-08 measured
that 116-10's correction was not universal either. This module gives the third answer, and it
confirms 116-08's durable rule rather than replacing it.

`getMarketplaceInfo` wraps nothing in a catch. `collectMarketplaceRecordsByScope` reads `opts.cwd`
on the orchestrator's first statement, so the unstated working directory escapes as an
`ERR_INVALID_ARG_TYPE` — the `list.ts` family. Give the same fall-through a literal working
directory and the workflow runs to completion, and its own success notification is what the boundary
refuses.

> The negative fires at the first unstated boundary member the workflow reaches AFTER whatever error
> handling it performs. Omitting `cwd` is the constant; the diagnostic is not.

## Plants (D-116-04)

Six plants, all RED, all reverted. Production is byte-identical to HEAD.

### Plant A — swap the usage constant to the remove form

```text
✖ supplies the info usage block, shown when the name positional is missing (20.532646ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
        message: 'Missing required argument.\n' +
          '\n' +
  +       'Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]',
  -       'Usage: /claude:plugin marketplace info <name> [--scope user|project]',
        severity: 'error'
      }
    ]
```

Both usage-identity cases RED (2 of 7). This is the case the plan calls out: a wrong usage block
would make the shim indistinguishable from the remove shim.

### Plant B — pass `removeMarketplace` as the delegate

```text
✖ reaches the info workflow, which reports both scopes when no scope flag is supplied (55.572783ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '● alpha [project] (removed)'
  -     message: '● alpha [project] <no autoupdate>\n' +
  -       'path: /repo/path/alpha\n' +
  -       '\n' +
  -       '● alpha [user] <no autoupdate>\n' +
  -       'path: /home/user/marketplaces/alpha'
      }
    ]
```

All four delegating cases RED. The scope-target case stayed GREEN — recorded above as an
observation, not a defect: both workflows emit the same `{not added}` row for an absent name, and
that case's claim is about where `--local` lands, which Plant F covers.

### Plant C1 — the rejection path falls through to a real workflow call forwarding `ctx.cwd`

```ts
    if (parsed === undefined) {
      await run({ ctx, pi, name: "alpha", cwd: ctx.cwd });
      return;
    }
```

```text
✖ supplies the info usage block, shown when the name positional is missing (22.059489ms)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at readScopeMarketplaceRecord (.../orchestrators/scope-fanout.ts:75:21)
      at collectMarketplaceRecordsByScope (.../orchestrators/scope-fanout.ts:62:23)
      at getMarketplaceInfo (.../orchestrators/marketplace/info.ts:154:23)
```

Both rejecting cases RED. No catch stands between the orchestrator's first statement and the
unstated `cwd`.

### Plant C2 — the same fall-through with a literal working directory

```ts
    if (parsed === undefined) {
      await run({ ctx, pi, name: "alpha", cwd: "/tmp/plant-c2-cwd" });
      return;
    }
```

```text
✖ supplies the info usage block, shown when the name positional is missing (22.080113ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at dispatchInfoMessage (.../shared/notify.ts:3723:3)
      at notify (.../shared/notify.ts:3752:5)
      at getMarketplaceInfo (.../orchestrators/marketplace/info.ts:184:5)
```

Both rejecting cases RED on the emission count. The workflow ran to completion and its own
notification is what the boundary refused.

### Plant D — add a `fetch` call to the shared single-name handler

```text
✖ reaches the info workflow, which reports both scopes when no scope flag is supplied (45.845264ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  1 !== 0

      at TestContext.<anonymous> (.../tests/edge/handlers/marketplace/info.test.ts:188:12)
```

All SEVEN cases RED, on the count and not on an error message. This is what makes the offline
assertion an NFR-5 proof rather than a decoration.

### Plant E — reject surplus positionals inside `parseCommandArgs`

```text
✖ queries the first positional alone, so a surplus token reaches no second lookup (16.379848ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'Missing required argument.\n' +
  -     message: '● alpha [project] <no autoupdate>\n' +
  -       'path: /repo/path/alpha\n' +
          '\n' +
  +       'Usage: /claude:plugin marketplace info <name> [--scope user|project]',
  +     severity: 'error'
  -       '● alpha [user] <no autoupdate>\n' +
  -       'path: /home/user/marketplaces/alpha'
      }
    ]
```

The drop row discriminates rather than decorating.

### Plant F — delete the conditional `scope` spread

```text
✖ reaches the info workflow, which reports the project scope alone (51.338891ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '● alpha [project] <no autoupdate>\n' +
  +       'path: /repo/path/alpha\n' +
  +       '\n' +
  +       '● alpha [user] <no autoupdate>\n' +
  +       'path: /home/user/marketplaces/alpha'
  -     message: '● alpha [project] <no autoupdate>\npath: /repo/path/alpha'
      }
    ]
```

3 cases RED, each widening from the selected scope to the both-scope cascade — which is what makes
the scope bracket a selection proof rather than a rendering proof.

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 3: a surplus positional is DROPPED, not rejected

- **Found during:** Task 1, reading `edge/args-schema.ts` before writing a line, then measured.
- **Issue:** The truth promises that "both out-of-range counts are rejected with a usage error
  before any orchestrator call". The lower half holds here (this schema declares one REQUIRED
  positional, so zero IS rejected — unlike 116-08's optional one), but the upper half is false:
  `parseCommandArgs` walks `schema.positional.entries()`, so the second token is never inspected.
- **Fix:** Wrote the surplus row as a DROP proof with a real seeded `beta` that stays unreported,
  and planted a rejection (Plant E) to show it discriminates.
- **Verification:** Measured before writing — `alpha beta` emits byte-identical output to `alpha`.
- **Commit:** `1d2b5bf8`

### 2. [Scope narrowing] The two router cases the old file carried were dropped

- **Found during:** Task 1, case selection.
- **Issue:** The previous file asserted `MARKETPLACE_SUBCOMMANDS` and `MARKETPLACE_USAGE` from
  `edge/router.ts` "because there is no dedicated router test file in the existing layout". There is
  one now: 116-29 owns `tests/edge/router.test.ts`, including the alias-identity and anti-shadowing
  invariants. Keeping them here would restate another owner's facts and break the mirrored-pair rule.
- **Fix:** Dropped both. Nothing is left unproven — 116-29 covers them.
- **Commit:** `1d2b5bf8`

**Total deviations:** 2 (1 false `must_haves` truth corrected and planted, 1 set of cases narrowed
off a sibling owner). **Impact:** the owner asserts only what the module can falsify. No claim was
weakened to go green.

## Scoped gap (D-116-05, O3, Group C)

`getMarketplaceInfo` is reached by direct import at the factory call site with no injection point, so
this owner cannot state an exact argument list against it. Delegation is observed as one minimal
effect — the emitted row naming the seeded marketplace and the scope bracket it carries. This
exact-argument gap is recorded in the plan's `must_haves` truth 6 and is **scoped, not missed**. The
negative half of D-116-06 is proven in full, on both rejection channels, with two plant variants.

## Exhaustiveness

None claimed. `edge/handlers/marketplace/info.ts` contains no `switch` and no closed-union dispatch,
so a missing-arm plant has no target here. D-116-14 is discharged and scoped to 116-27 alone.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/info.test.ts` | tests 7, pass 7, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/info.ts` | branches 2/2, functions 1/1, lines 22/22 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5053/5053 across 291 suites, exit 0 |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 5 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 11692, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0 |

## Note to the remaining Group-C owners

1. The sizing is durable; the stack trace is not. Three modules, three diagnostics for the same
   plant. Run the plant, then write down what it said.
2. Check your positional schema before writing an out-of-range case. Zero, one optional, and one
   required positional all DROP surplus tokens — only the lower bound differs.
3. Do not carry a `--local` claim across handlers. Five measured, five outcomes.
4. Where your workflow writes nothing, `verifyBoundary()` plus the omitted `cwd` carries the negative
   alone; there is no on-disk half to add.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-11 (marketplace remove) and 116-05 (completions/provider) to close wave 4, then wave 5.
116-11 is the closest sibling: it takes the same `<name>` positional but reaches it through
`openMarketplaceCommand`, which DOES call `extractLocalFlag` — so its `--local` outcome will differ
from this one and must be measured, not carried over.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/info.test.ts` exists on disk.
- `git log --oneline --all | grep 1d2b5bf8` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
