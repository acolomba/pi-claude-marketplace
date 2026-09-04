---
phase: 116-edge-surface
plan: "21"
subsystem: testing
tags: [node-test, edge, plugin, pending, group-c, offline, d-116-01a, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-02's `edge/args.ts` owner, which owns the tokenizer and the scope-value diagnostics this owner does not restate"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C no-seam negative-delegation shape"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the `withParsedArgs` prelude this handler opens with"
provides:
  - "tests/edge/handlers/plugin/pending.test.ts — the sole mirrored direct owner for edge/handlers/plugin/pending.ts, at 100 percent direct functions and lines and the documented single-branch D-116-01a shortfall"
  - "the D-116-01a identity pin for edge/handlers/plugin/pending.ts:39 — COMPILER-FORCED by noUncheckedIndexedAccess, proved by two green plants and a 19530-input brute force with its own positive control, filed as WINDOWS ledger entry 19"
  - "the measured correction that the ZERO-PROBE half of createNotificationBoundary(n, 0) is NOT a fail-fast: the production soft-dep probes each wrap pi.getAllTools() in their own try/catch, so an unstated probe is swallowed at the call site and only verify(pi) reports it"
  - "a SIXTH distinct Group-C negative-delegation diagnostic pair, and the first module where 116-19's scope discriminator fires and 116-20's exception does not"
  - "a SIXTH parser/arity/flag combination, and the first whose surplus half emits TWO different sentences picked from the shape of the FIRST positional alone"
  - "the TWELFTH distinct `--local` outcome, and the first that MATCHES a sibling's answer exactly — still measured rather than carried across"
  - "the third and final SC-4 offline answer, discharging the assignment: a verb with no materialization flag whose fixture still drives a cold git source through the no-network resolver"

affects: []

actuals:
  tokens: 21000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A tree-listing read-only proof compares the COMPLETE listing of both hermetic trees across the act. It is a live gate — planting a `saveState` into the orchestrator turns the scope rows RED — but it catches an ADDED path, not an in-place rewrite"
    - "Each scope declares a DIFFERENT plugin under the same marketplace name, so a diff read out of the wrong scope root names the wrong plugin rather than merely being absent from the right block"
    - "A brute-force unreachability route carries its own positive control: the same brute force with the index moved out of range must report the sentinel, or the zero proves only that the detector is broken"
    - "Boundary sizing per row: a rejection is `(1, 0)` with NO stated `cwd`, a delegating command is `(1, 2, {cwd, reads: 1})`. Both counts held across every scope and fixture combination measured"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/pending.test.ts

key-decisions:
  - "FINDING — the ZERO-PROBE half of `createNotificationBoundary(n, 0)` is NOT a fail-fast, and this is the mechanism behind what 116-20 observed. `hasLoadedPiSubagents` and `hasLoadedPiMcpAdapter` each wrap `pi.getAllTools()` in their OWN `try { … } catch { return false }` (`platform/pi-api.ts:129-135` and `143-155`), so strong-mock's unexpected-call throw on an unstated `getAllTools` is SWALLOWED at the call site: the probe degrades to `unloaded` and the render proceeds normally. The zero-probe half is therefore a POST-HOC report from `verify(pi)` — `The following calls were unexpected: - extension API.getAllTools() - extension API.getAllTools()` — not a crash. Measured directly by running a guard-deleted handler and calling `verifyBoundary()` ahead of the assertion. The durable consequence: a Group-C case MUST call `verifyBoundary()` and must NEVER rely on the workflow crashing when a probe is unstated"
  - "FINDING — the Group-C negative here IS scope-discriminated, so 116-19's rule fires and 116-20's exception does not: `pendingReconcile`'s scope list is exactly what reaches `locationsFor`. Measured, both variants, verbatim. With NO scope flag the project-first fan-out throws raw `TypeError [ERR_INVALID_ARG_TYPE]: The \"path\" argument must be of type string. Received function` at `persistence/locations.ts:145` via `orchestrators/reconcile/pending.ts:149`, emitting NOTHING, and `verifyBoundary()` additionally reports the unmet `ctx.ui` expectation. With `--scope user` the workflow runs to COMPLETION (the user scope never reads `cwd`), emits exactly ONE notification so the emission sizing stays SATISFIED, and the case is caught by the hand-authored whole-value comparison receiving `● mp [user]\\n  ● p-user (will install)`, with the zero-probe report as the independent second catch"
  - "MEASURED — a SIXTH parser/arity/flag combination: `parseArgs` through `withParsedArgs`, then this shim's own `positional.length > 0` guard. ZERO is the accepted arity and ONE is rejected, so there is no arity one BELOW it and the lower half of the arity `must_haves` truth again has no target. The surplus half holds, and this is the FIRST module in the phase whose surplus half emits TWO DIFFERENT sentences, picked from the SHAPE of the FIRST positional only: a long-flag-shaped first token takes `Unknown option: \"<token>\".` and anything else takes `Too many arguments.`, while a long-flag-shaped token driven SECOND behind an ordinary one takes the too-many-arguments sentence"
  - "MEASURED — `--local` is REJECTED as `Unknown option: \"--local\".`, alone and beside `--scope user`. This module never calls `extractLocalFlag`, so the token survives `parseArgs` as an ordinary positional, opens with `--`, and lands in the unknown-option channel. That is the TWELFTH distinct `--local` outcome in this phase and the FIRST that matches a sibling's answer exactly (116-20's `plugin/list`, unknown-OPTION wording rather than the unknown-FLAG wording `fetch` and `plugin/info` emit). It was measured on this module, not carried across. It also makes the mutually-exclusive-selector truth HOLD here, the third time in the phase"
  - "SC-4 — the zero IS asserted, in all 15 cases, watching `https.request` and never `globalThis.fetch`, and the assignment is DISCHARGED with a third answer of 116-20's family. The fixture declares a COLD git source (`https://127.0.0.1:9/far.git`) as a PLANNED INSTALL, which `resolvePendingForceInstalls` routes through `resolveStrict`; the no-network resolver answers `unavailable` with the counter at zero and the row renders `(will install)` offline. So the zero is NOT the all-path-source vacuity 116-18 measured — the input is one that would need the network to resolve any further. But this verb has no flag that turns materialization on, so there is NO positive control, and the zero is an NFR-5 regression guard rather than a discriminated proof. Recorded as a limit. A separate out-of-suite control confirmed the DOOR is instrumented: a direct `https.request` call under the same replacement moves the counter 0 → 1"
  - "D-116-01a PINNED — `edge/handlers/plugin/pending.ts:39`, the `?? \"\"` fallback on the first positional. COMPILER-FORCED: the guard on the line above has already proven the positional list non-empty and `parseArgs` pushes only non-undefined tokens onto it, but `noUncheckedIndexedAccess` (`tsconfig.json:12`) types the index read as possibly undefined. Deleting the fallback raises `error TS18048: 'first' is possibly 'undefined'` at its consumption site (line 40); narrowing it needs a non-null or type assertion, both barred throughout `extensions/`. The pin has two homes, per the shape settled at `ed0e490f`: a header paragraph in the suite, and the executable identity assertion plus the `must_haves` truth in `116-21-PLAN.md`. No absolute branch pair is asserted anywhere"
  - "OBSERVATION — the branch pair moved 8/9 → 9/10 as the suite strengthened, and nothing regressed. The DENOMINATOR tracks suite strength, which is the third instance of the phase's 'branch numbers are not a property of the source' finding (116-02 authored 25/26 and measured 28/29; 116-26 derived 13/14 and measured 14/15). This pair's verdict line carries no `lines` and no `functions` clause and an EMPTY uncovered-line cell, so the exact uncovered line set is pinned by the trailing `$` anchor — the 116-21 variant of the identity shape that 116-03 and 116-13 later adopted"
  - "DEVIATION — the plan CONTRADICTS ITSELF. Its `<acceptance_criteria>` demands that `the direct-coverage gate reports 100 percent functions, lines, and branches for the paired source`, while its `<objective>`, its `must_haves` truth, its `<verify>` link and its `<success_criteria>` all require exactly ONE uncovered branch at the documented D-116-01a shortfall. Taken literally the acceptance criteria would have deleted the shortfall this plan exists to document, which the same criteria's `no coverage exception added` clause and the phase's no-production-licence rule both forbid. Followed the four blocks that agree; the contradiction is reported, not resolved by editing"
  - "DEVIATION — no rejecting case asserts an empty on-disk footprint. `pending` writes nothing on ANY path, so that negative would hold whether or not the workflow ran (the 116-16 vacuity rule). The write half of NFR-5 is instead asserted on the DELEGATING cases, where it has a real target: the sibling apply path writes a migrated `claude-plugins.json` from the same inputs and this read surface deliberately does not, and Plant G proves the assertion fires"
  - "No production file was touched. Seven plants were applied across `edge/handlers/plugin/pending.ts` and `orchestrators/reconcile/pending.ts` — five RED and two deliberately GREEN — and each was reverted from a byte copy taken beforehand or with `git checkout --` on that single path. `pending.ts`'s SHA-1 was `40829772fcf9ebe9222f0da9184616885cd4e3b3` before the first plant and after the last revert; `git diff --stat -- extensions/` is empty and `git log -1 --stat` shows 1 file changed"

patterns-established:
  - "A zero stated on a strong-mock port is only reported at verify time when the production code wraps the call in its own try/catch. Before claiming an unstated member 'fails where it happens', check whether the caller swallows throws — if it does, the boundary's report is post-hoc and the case must call verify()"
  - "Prove a brute-force zero with its own positive control. 19530 inputs producing zero sentinel hits means nothing until the same run with a deliberately out-of-range index reports the sentinel"
  - "Read a plan's blocks against EACH OTHER, not just against the module. This plan's acceptance criteria contradicted its own objective, must_haves, verify block and success criteria"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/pending.test.ts owns edge/handlers/plugin/pending.ts at 100 percent direct functions and lines"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts — 15 runtime cases from 5 marked bodies, pass 15 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts → functions 100.00, lines 100.00, branches 90.00 (9/10), uncovered-line cell empty; was 100.00 / 88.89 (8/9) / 100.00"
        status: pass
  - deliverable: "The two rejection sentences are proven to be picked from the SHAPE of the first positional"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts#rejects a single surplus token with the too-many-arguments sentence and never reaches the pending workflow (MSG-NC-2)"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts#names an unrecognised long option driven alone and never reaches the pending workflow (D-116-06)"
        status: pass
      - kind: command
        ref: "Plant A — swap the two sentences; 9 cases RED, the four too-many-arguments rows receiving the unknown-option sentence and the five unknown-option rows receiving the too-many-arguments sentence"
        status: pass
  - deliverable: "The shape test reads only the FIRST positional"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts#rejects a long-flag-shaped token driven behind an ordinary one with the too-many-arguments sentence and never reaches the pending workflow (MSG-NC-2)"
        status: pass
  - deliverable: "The D-116-06 negative: the pending workflow is proven unreached on every rejection channel"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — delete the positional guard; 9 rows RED. Two distinct diagnostics measured, one per scope variant, both recorded verbatim"
        status: pass
  - deliverable: "The selected scope and the working directory each reach the workflow as their own member"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant C — delete the conditional scope spread; exactly the two supplied-scope rows RED, the omitted row green"
        status: pass
      - kind: command
        ref: "Plant D — replace the cwd forward with a literal; all 4 delegating rows RED, the user-scope row failing on verifyBoundary()'s stated-cwd expectation and the other three on the whole-value comparison"
        status: pass
  - deliverable: "This read-only path writes no file"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts — assert.deepStrictEqual(await bothTreeListings(workspace), expectedListings) on all 4 delegating cases"
        status: pass
      - kind: command
        ref: "Plant G — make the orchestrator persist the loaded state; 3 rows RED on the added pi-claude-marketplace/state.json path"
        status: pass
  - deliverable: "This read-only path never reaches the network"
    human_judgment: true
    rationale: "Every case asserts the https.request call count is zero, the fixture drives a cold git source through the no-network resolver so the assertion is not vacuous over the fixture, and an out-of-suite control proves the door is instrumented. But no input to this verb turns the transport on, so no positive control could be run — a human should read the SC-4 section and accept the zero as an NFR-5 regression guard rather than a discriminated proof"
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts — assert.strictEqual(workspace.transportCalls(), 0) in all 15 cases"
        status: pass
  - deliverable: "The D-116-01a shortfall at pending.ts:39 is a pinned claim, not prose"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/pending.test.ts header — names the line, the runtime unreachability, the compiler setting that forces it, the three measured routes, and that no coverage exception is added"
        status: pass
      - kind: command
        ref: "116-21-PLAN.md <verify> chain, re-run end to end against the committed pair → exit 0 at branches 9/10"
        status: pass
      - kind: other
        ref: "Five directional plants — two assertion-side (require a lines clause; assert a 2-branch shortfall) and three output-side (a lines clause appears; a second branch goes uncovered; the verdict disappears). All five FAIL; only the real output passes"
        status: pass
      - kind: other
        ref: "Unreachability measured three ways: deleting the fallback raises TS18048; a replacement plant and an OBSERVABLE long-flag-shaped plant both stay GREEN across all 15 cases; a brute force over 19530 argument strings reports zero sentinel emissions while the same run with the index out of range reports it for 136 of 155"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over pending.ts, all three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git diff --stat -- extensions/ empty; pending.ts SHA-1 identical before the first plant and after the last revert"
        status: pass

duration: 65 min
completed: 2026-09-03
---

# Phase 116 Plan 21: Plugin Pending Owner Summary

The pending shim now has one exhaustive, hermetic, offline-proven owner, and the one branch that
cannot be reached from outside the module is pinned by identity rather than reported as prose.

## What was built

`tests/edge/handlers/plugin/pending.test.ts` was rewritten from seven cases that matched substrings
(`message.includes("Too many arguments.")`) into **15 runtime cases from 5 marked bodies**, all on the
shared strict boundary with every expected value hand-authored and compared whole.

| Marked body | Args | Rows | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| scope | `""`, `--scope user`, `--scope project` | 3 | `(1, 2, {cwd, reads: 1})` | the scope member; the omitted row is also the accepted arity of ZERO; each row also carries the write half of NFR-5 |
| cold git source | `--scope project` | 1 | same | a planned install of a source that would need the network, answered offline |
| arity above, ordinary first | `surplus`, `surplus second`, `--scope user surplus`, `surplus --frobnicate` | 4 | `(1, 0)`, **no `cwd`** | the too-many-arguments sentence, and that the shape test reads only the FIRST token |
| arity above, long-flag-shaped first | `--frobnicate`, `--frobnicate surplus`, `--scope user --frobnicate`, `--local`, `--scope user --local` | 5 | `(1, 0)`, **no `cwd`** | the unknown-option sentence, the scope-target rejection, and the mutually-exclusive-selector case |
| parse failure | `--scope bogus`, `--scope` | 2 | `(1, 0)`, **no `cwd`** | the prelude carries the throw's own sentence under this shim's usage block |

Direct coverage moved from functions 100 percent, lines 100 percent, branches 8/9 to functions
100 percent, lines 100 percent, **branches 9/10** — the documented shortfall, one uncovered branch,
uncovered-line cell empty.

## The two rejection sentences

The module's real promise is that it distinguishes two sentences from the shape of the first
positional. Measured through a counting context before a case was written:

| Args | Emission |
|------|----------|
| `surplus` | `Too many arguments.` |
| `surplus second` | `Too many arguments.` |
| `surplus --frobnicate` | `Too many arguments.` — the shape test reads only the FIRST token |
| `--frobnicate` | `Unknown option: "--frobnicate".` |
| `--frobnicate surplus` | `Unknown option: "--frobnicate".` |
| `--local` | `Unknown option: "--local".` |
| `--scope user --local` | `Unknown option: "--local".` |

Either family alone passes for a handler that always emits one sentence. The pair is the
discriminating proof, and Plant A is what separates them: swapping the two sentences turns all four
too-many-arguments rows and all five unknown-option rows RED, in opposite directions.

## Plants (D-116-04)

Seven plants across two production files. Five RED, two deliberately GREEN. All reverted;
`pending.ts`'s SHA-1 was `40829772fcf9ebe9222f0da9184616885cd4e3b3` before the first and after the
last, and `git diff --stat -- extensions/` is empty.

| Plant | File | Edit | Result |
|-------|------|------|--------|
| A | `edge/…/plugin/pending.ts` | swap the two rejection sentences | **9 RED** |
| B | `edge/…/plugin/pending.ts` | delete the `positional.length > 0` guard | **9 RED**, two distinct diagnostics |
| C | `edge/…/plugin/pending.ts` | delete the conditional `scope` spread | **2 RED**, the omitted row green |
| D | `edge/…/plugin/pending.ts` | `cwd: ctx.cwd` → a literal | **4 RED** |
| E | `edge/…/plugin/pending.ts` | `?? ""` → `?? "--@@unreached@@"` (observable) | **GREEN** — the D-116-01a finding |
| F | `edge/…/plugin/pending.ts` | `?? ""` → `?? "@@unreached@@"` | **GREEN** — the D-116-01a finding |
| G | `orchestrators/reconcile/pending.ts` | persist the loaded state inside the read surface | **3 RED** |

Plant A's verbatim output, both directions:

```
✖ rejects a single surplus token with the too-many-arguments sentence …
  +     message: 'Unknown option: "surplus".\n' +
  -     message: 'Too many arguments.\n' +
✖ names an unrecognised long option driven alone …
  +     message: 'Too many arguments.\n' +
  -     message: 'Unknown option: "--frobnicate".\n' +
```

Plant G's verbatim output, which is what makes the read-only assertion a gate rather than a comment:

```
    [
      [
        '.pi/',
        '.pi/claude-plugins.json',
  +     '.pi/pi-claude-marketplace/',
  +     '.pi/pi-claude-marketplace/state.json'
      ],
```

Plant G left the cold-git-source case green: its fixture already carries a `state.json`, so the write
rewrites a path rather than adding one. A tree listing catches an ADDED path, not an in-place
rewrite — recorded rather than papered over.

## The Group-C negative fires twice here, differently

`pendingReconcile`'s scope list is exactly what reaches `locationsFor`, so 116-19's scope
discriminator fires and 116-20's exception does not. Both variants of Plant B, verbatim:

| Variant | What happened |
|---------|---------------|
| `surplus` | the handler THREW `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function ` at `path.join` → `locationsFor` (`persistence/locations.ts:145`) → `pendingReconcile` (`orchestrators/reconcile/pending.ts:149`). Nothing emitted; `verifyBoundary()` also reports the unmet `ctx.ui` expectation |
| `--scope user surplus` | the handler RESOLVED. The user scope never reads `cwd`, so the workflow ran to completion and emitted `● mp [user]\n  ● p-user (will install)` — exactly ONE emission, so `verifyBoundary()`'s emission sizing stayed SATISFIED. The whole-value comparison fired, and `verifyBoundary()` independently reported `extension API.getAllTools()` unexpected twice |

### Why the zero-probe half reports rather than crashes

116-20 recorded the zero-probe half as "the load-bearing half" without the mechanism. Measured here:
`hasLoadedPiSubagents` and `hasLoadedPiMcpAdapter` each wrap `pi.getAllTools()` in their own
`try { … } catch { return false }` (`platform/pi-api.ts:129-135` and `143-155`). So strong-mock's
unexpected-call throw on an unstated `getAllTools` is **swallowed at the call site** — the probe
degrades to "unloaded" and the render proceeds. The zero-probe half is a **post-hoc report from
`verify(pi)`**, not a fail-fast.

The durable consequence for every remaining Group-C owner: a case must **call `verifyBoundary()`**
and must never rely on the workflow crashing when a probe is unstated.

## Offline (SC-4): the assignment is discharged

The door watched is `https.request`, replaced by a counting fail-fast throw. `globalThis.fetch` is
deliberately not watched — the git transport reaches the wire through `simple-get` → `https.request`,
and this repo's only `fetch` caller is the device-flow credential path, which no pending invocation
enters.

Asked as two separate questions:

1. **Can the fixture reach the transport?** The fixture declares a cold git source
   (`https://127.0.0.1:9/far.git`) as a **planned install**, which `resolvePendingForceInstalls`
   routes through `resolveStrict`. Measured: the resolver answers `unavailable` with the counter at
   zero and the row renders `(will install)` offline. So this is not the all-path-source vacuity
   116-18 measured — the input is one that would need the network to resolve any further.
2. **Does any input turn the transport on?** No. `pending` has no materialization flag, so unlike
   `plugin/info --fetch` there is no 0-versus-2 pair available and **no positive control**.

The zero is therefore asserted in all 15 cases as an NFR-5 regression guard, and that limit is stated
rather than dressed up. A separate out-of-suite control confirmed the door itself is instrumented: a
direct `https.request` call under the same replacement moves the counter 0 → 1, so the zero is a live
counter over a dead path rather than a broken probe.

## D-116-01a: the pin for `pending.ts:39`

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts: branches 9/10
```

No `lines` clause, no `functions` clause, empty uncovered-line cell. The shortfall is the `?? ""`
fallback on `const first = parsed.positional[0] ?? "";`.

**Reason — COMPILER-FORCED.** The guard on the line above has already proven the positional list
non-empty, and `parseArgs` pushes only non-undefined tokens onto it (`edge/args.ts:33-37, 50`), so the
index read always yields a string. `noUncheckedIndexedAccess` (`tsconfig.json:12`) nevertheless types
it `string | undefined`. Removing the fallback needs a non-null assertion or a type assertion, both
barred throughout `extensions/`.

**Measured, not inspected — three routes:**

| Route | Result |
|-------|--------|
| delete the fallback, typecheck | `extensions/…/plugin/pending.ts(40,11): error TS18048: 'first' is possibly 'undefined'.` |
| Plant F: `?? "@@unreached@@"` | GREEN, 15/15 |
| Plant E: `?? "--@@unreached@@"` (**observable** — the arm would name this token in the unknown-option sentence) | GREEN, 15/15 |
| brute force: drive the handler over all 19530 argument strings of length ≤ 6 over the tokenizer's significant alphabet (`a`, space, `'`, `"`, `-`), with Plant E applied | **0** sentinel emissions, 168 reaching the workflow |
| the same brute force with the index moved to `[999]` | **136 of 155** report the sentinel — so the detector is live |

**Pinned in two homes**, per the shape settled at `ed0e490f`: the header paragraph in the suite, and
the executable identity assertion plus the `must_haves` truth in `116-21-PLAN.md`. The assertion
matches the verdict with branch numbers read loosely, requires denominator minus numerator to equal
exactly 1, and anchors on `$` so a `lines` or `functions` clause appearing fails the link.

**Planted in BOTH directions**, five mutations, all behaving:

| Direction | Mutation | Result |
| --------- | -------- | ------ |
| — | real gate output, pin as authored | **PASS** 9/10 |
| assertion | require a `lines` clause | FAIL |
| assertion | assert a 2-branch shortfall | FAIL |
| output | a `lines` clause appears | FAIL |
| output | a second branch goes uncovered | FAIL |
| output | the verdict disappears (gate passes) | FAIL |

Filed as `.planning/WINDOWS.md` entry 19 (`unmet-truth`, `open`). **No coverage-exception pragma was
added and no production file changed.**

**The branch pair moved 8/9 → 9/10 and nothing regressed** — the denominator tracks suite strength,
the third instance of the phase's "branch numbers are not a property of the source" finding.

## Deviations from Plan

### 1. The plan contradicts itself on the coverage end state

The `<acceptance_criteria>` demands that "the direct-coverage gate reports 100 percent functions,
lines, and branches for the paired source". The `<objective>`, the `must_haves` truth, the `<verify>`
link and the `<success_criteria>` all require exactly ONE uncovered branch at the documented
D-116-01a shortfall. Taken literally the acceptance criteria would have deleted the shortfall the plan
exists to document — which the same criteria's "no coverage exception added" clause and the phase's
spent production licence both forbid. Followed the four blocks that agree. Reported, not resolved by
editing.

### 2. No empty on-disk footprint on the rejecting cases

`pending` writes nothing on any path, so an empty-footprint negative on a rejection would hold whether
or not the workflow ran (the 116-16 vacuity rule). The write half of NFR-5 is asserted on the
**delegating** cases instead, where it has a real target — the sibling apply path writes a migrated
`claude-plugins.json` from the same inputs and this read surface deliberately does not. Plant G proves
it fires.

### 3. The arity truth is again half false

ZERO positionals is the accepted arity, so there is nothing one BELOW it and the lower half of the
`must_haves` arity obligation has no target. Only the surplus half does — and here it has two
sentences rather than one, which no earlier module in the phase had.

**Total deviations:** 3 documented. **Impact:** one records an internal contradiction in the plan,
one narrows a specified proof that could not have failed, one records a `must_haves` truth that is
half false against the real module.

## Known Stubs

None.

## Gates

Run separately, each exit code checked. `npm run check` was NOT used: its `format:check` link fails on
pre-existing untracked operator files and short-circuits before the tests.

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/pending.test.ts` | 15/15 pass |
| `npm run test:coverage:direct -- …/plugin/pending.ts` | functions 100.00, lines 100.00, branches 9/10 — the documented shortfall |
| `116-21-PLAN.md` `<verify>` chain, end to end | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | **5109 tests / 293 suites, 0 fail** (read from the runner's `ℹ tests` line) |
| `npm run test:integration` | 31/31 |
| anti-pattern scan | exit 1 (no match) — the negated link passes |
| `rg -c '^\s+// arrange$'` | 5 marked bodies, 5 `test()` sites |
| `prettier --check` on the changed path | clean |
| trufflehog filesystem scan | `chunks: 3, bytes: 24232, verified_secrets: 0, unverified_secrets: 0` |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` | all hooks passed |
| `git diff --quiet` over the pinned production paths and the shared helper | exit 0 |

## Issues Encountered

None.

## Next Phase Readiness

Wave 5 has three plans left — 116-22, 116-24, 116-25 — then 116-28 (register) closes wave 6. The
**SC-4 offline assignment is discharged**; three owners measured three correct answers and all three
are in the phase handoff. All seven D-116-01a claimants are now pinned.

The finding every remaining Group-C owner should read first: the **zero-probe half of
`createNotificationBoundary(n, 0)` is not a fail-fast**. The production soft-dep probes swallow the
unexpected-call throw, so the boundary reports it only at `verify(pi)` — a case must call
`verifyBoundary()` and must never rely on the workflow crashing.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/pending.test.ts` exists on disk.
- `b3eabd5905fff786359fa84672d41454f408c23d` exists in `git log`, one file changed.
- `git diff --stat -- extensions/` is empty; `git diff --quiet` over the plan's pinned production
  paths and the shared boundary helper exits 0.
- The plan's `<verify>` chain re-runs green after the last revert.
- `.planning/WINDOWS.md` carries entry 19 for `pending.ts:39`.
- `grep -c '^- \[x\] \*\*116-' .planning/ROADMAP.md` returns 27.
