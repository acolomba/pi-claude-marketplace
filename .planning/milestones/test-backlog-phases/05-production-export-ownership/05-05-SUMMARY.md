---
phase: 05-production-export-ownership
plan: "05"
status: complete
integration-status: accepted
subsystem: testing
tags: [hooks, exports, lifecycle, pid-table, native-coverage]
requirements-completed: []
plan_head_before: ce407cf6049492e238d4acb2e4a53e690595dde8
requires:
  - phase: 05-04
    provides: Defining-module hook type consumers
provides:
  - Private before-agent callback tested through real registration
  - Private PID and dispatch marker constants with public-effect byte assertions
  - Proven stream-reader analyzer limitation; annotation activation assigned to Plan 05-28
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [Registered callback ownership, Independent serialized fixtures]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - tests/bridges/hooks/event-router.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - tests/bridges/hooks/index.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts
    - tests/bridges/hooks/async-rewake/pid-table.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/bridges/hooks/async-rewake/registry.test.ts
    - tests/architecture/hooks-async-rewake.test.ts
key-decisions:
  - Preserve stale-generation protection in the synchronous registration wrapper and retire only the redundant inner check
  - Keep defining hook types consumed by live public signatures while retiring five unused barrel aliases
  - Retain RingBuffer.read and its interim finding; activate the proven adjacent annotation with production mode in Plan 05-28
actuals:
  tasks: 4
completed: 2026-09-14
---

# Phase 5 Plan 5: Hook Registration and Async Stream Ownership Summary

The before-agent callback is private and tested through its actual Pi registration. PID and dispatch-marker constants are private with exact public filesystem/environment assertions; RingBuffer.read retains its production stream consumers; its proven local analyzer exception is assigned to Plan 05-28 for atomic activation with production mode.

All four tasks, including the added compiler-proof repair, are accepted. Parent integration results below supersede earlier executor handoff counts and pending statements. EXPORT-01 stays open for the remaining owners. Actual token telemetry is unavailable, so token actuals are intentionally absent.

## Tasks and commit ownership

1. Registration/barrel cleanup: 33 focused tests pass; registered callback return/context/drain and reload-order assertions preserved.
2. PID/registry policy: 50 focused tests pass; exact paths, serialized bytes, environment, stream-finalization, failure, and orphan cleanup assertions retained.
3. Ring-buffer limitation: 37 focused ring/control tests pass, including unrelated-read offender and real-reader companion controls. The annotation itself is deferred to Plan 05-28 because current shipping mode reports it as stale.
4. Four barrel owners: all thirteen missing-member proofs reject individually restored exports and pass ESLint without rule exceptions.

All eleven baseline SHA-256 hashes matched immediately before apply. Ten source/test files changed; the eleventh planned owner, ring-buffer.test.ts, remains byte-for-byte unchanged. The accepted Task 1 clarification is recorded in 05-05-PLAN.md. No change outside the approved owner set, PLAN, and this SUMMARY was made.

The parent reserved all commits and root state updates for the integrated wave. No executor commit or commit-count actual is claimed here. Parent integration must add measured commit metadata after committing the wave.

## Exact findings and caller dispositions

Paths use the prefix `extensions/pi-claude-marketplace/bridges/hooks/`.

| Category | Path | Binding | Disposition and evidence |
| --- | --- | --- | --- |
| unused_exports | event-router.ts | createBeforeAgentStartHandler | Private; the sole production factory use is the `before_agent_start` registration in `registerHooksBridgeWith`. The public entry is `createHooksHydration(...).registerHooksBridge(...)`; tests capture its actual Pi callback. |
| unused_types | index.ts | HooksFileReader | Retire the unused convenience re-export. The defining event-router type remains consumed by createHooksRouting and hydration signatures. |
| unused_types | index.ts | HooksHydration | Retire the unused convenience re-export. The defining type is the return contract of the live createHooksHydration function. |
| unused_types | index.ts | HooksHydrationDeps | Retire the unused convenience re-export. The defining type is the required dependency contract of createHooksHydration; the barrel owner preserves its shape proof through Parameters<typeof createHooksHydration>[1]. |
| unused_types | index.ts | ReadAndCachePluginHooksOptions | Retire the unused convenience re-export. Its defining type remains the readAndCachePluginHooks operation's options contract. |
| unused_types | index.ts | HooksRuntime | Retire the unused convenience re-export. runtime.ts's defining type remains live throughout hooks execution, and createHooksRuntime remains an exact public factory binding. |
| unused_exports | async-rewake/pid-table.ts | ASYNC_REWAKE_PIDS_FILENAME | Private; pidTablePath retains the exact filename and read/write/unlink callers. |
| unused_exports | async-rewake/pid-table.ts | ASYNC_REWAKE_PID_TABLE_VERSION | Private; readPidTable validates the discriminator, writePidTable serializes it, and the internal envelope retains its literal type. |
| unused_exports | async-rewake/registry.ts | MARKER_ENV | Private; child environment construction and /proc ownership verification retain the exact key. |
| unused_class_members | async-rewake/ring-buffer.ts | RingBuffer.read / class_method | Keep the live method and its interim finding. Plan 05-28 will activate one immediately adjacent `fallow-ignore-next-line unused-class-member` with the production-mode configuration; it cites registry finalization's two real stream readers. No class/name/global exception. |

### Orphaned-type investigation

Named production import search found no readers of the four event-router type names outside the barrel and defining module. That was a hypothesis, not proof of dead exports. After removing the barrel exports, isolated Fallow reports **no** new unused types in event-router: these declarations participate in live exported function/operation signatures. The defining contracts therefore remain unchanged. No new private declarations, type exports, fake consumers, or suppression were introduced to force a clean count. Existing external HooksHydrationDeps tests continue compiling from the defining module; no extra owner path is required.

## Task 1: registered callback and barrel assertions

| Original assertion/case | Replacement public assertion/case | Disposition |
| --- | --- | --- |
| Reload lifecycle case calls createBeforeAgentStartHandler(runtime, previousEpoch) and asserts undefined | Captures the actual before_agent_start callback during the first public registration, before clearing the registration recorder. After the real reload registration, invokes that captured stale callback with exactly the previous event fields/context and still asserts undefined. | Original assertion preserved through the production registration path. |
| Reload ordering, stale tool/settle callbacks, epoch, pending reset, child kill, orphan reap, hydration/routing order, registered event order/count, cache, directory, messages, notifications, peer-runtime isolation | All original assertions and fixtures remain unchanged. Only the direct before-agent factory call above moves. | Preserved verbatim. |
| Direct helper joins alpha and beta context with exact double-newline separators | Fresh temporary root and isolated agent root; public hydration registration first; same context seeds then actual recorded callback. Exact `{systemPrompt: "base prompt\n\nalpha context\n\nbeta context"}` comparison remains. | Preserved. |
| Direct helper second drain returns undefined and pending buffer is empty | Same recorded callback invoked twice; original undefined and complete empty-buffer assertions remain. | Preserved. |
| Direct helper with stale captured generation returns undefined without draining live context | First real registration supplies captured callback; second real registration advances the generation; the same live context is appended afterward. Invokes the first callback and preserves undefined plus the exact one-entry live context array. | Preserved without an artificial runtime getter or test-only state seam. |
| Barrel positive HooksHydrationDeps object satisfies the exported type | Identical object satisfies Parameters<typeof createHooksHydration>[1], the real factory's public dependency contract. | All dependency fields/type proof preserved. |
| Existing barrel private-member negative type checks | Every original negative check remains. | Preserved. |
| Five removed barrel type aliases | Five new `@ts-expect-error` checks forbid those convenience type names on the barrel. | Intentional facade retirement with strict TypeScript proof. |
| createHooksHydration, createHooksRuntime, readHooksJson, removeHookConfig, writeHookConfig exact runtime binding checks | All unchanged. | Preserved. |

### Redundant guard proof and bounded removal

Original path:

1. Public `createHooksHydration(...).registerHooksBridge(...)` invokes `registerHooksBridgeWith`.
2. Registration calls `bind((generation) => createBeforeAgentStartHandler(runtime, generation))`.
3. `bind` delegates to `bindRegistrationCallback(runtime, capturedGeneration, factory)`.
4. `bindRegistrationCallback` builds the inner callback once and returns a wrapper. On invocation, that wrapper compares `runtime.currentGeneration()` to the captured generation. If stale, it returns undefined immediately. Otherwise it calls `callback(...args)` synchronously.
5. The old inner callback immediately compared the same runtime generation to the same captured number a second time.

There is no await, event-loop yield, callback invocation, generation mutation, or other intervening operation between the wrapper's successful check and the inner callback's duplicate check. The real runtime's currentGeneration method only returns its owned counter. Therefore, the stale branch inside the private helper has no reachable production path once direct helper access is removed. Stale registered callbacks continue returning at the wrapper and leave the pending buffer intact.

The applied patch removes only the duplicate inner check and now-unused numeric parameter, and changes the binding factory to `bind(() => createBeforeAgentStartHandler(runtime))`. The wrapper guard, runtime lifecycle ownership, registration generation increments, buffer-drain behavior, and exact stale/current callback assertions remain. This is an unreachable redundant-guard retirement, not an assertion deletion to conceal uncovered behavior. The helper comment now describes wrapper ownership accurately.

The scoped lint check caught one old double cast at the migrated reload invocation, because the callback recorder accepts the original event object. Removing that unnecessary cast changes no input value or assertion.

## Task 2: PID and environment assertions

| Original assertion | Replacement public assertion | Disposition |
| --- | --- | --- |
| ASYNC_REWAKE_PIDS_FILENAME equals async-rewake-pids.json | Existing lifecycle case still compares the complete actual path against an independently built literal path ending in `data/_shared/async-rewake-pids.json`, reads the actual file, and asserts ENOENT after actual unlink. | Direct constant access removed; exact path and public filesystem effects preserve it. |
| ASYNC_REWAKE_PID_TABLE_VERSION equals 1 | The same lifecycle case preserves complete independently authored JSON bytes beginning with the literal `"version": 1`, exact parsed entries, caller-array non-aliasing, completion results, and unlink result. Existing version 2 malformed/stale envelope refusal remains. | Direct constant access removed; actual write/read acceptance and refusal preserve it. |
| MARKER_ENV equals PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH | Existing lifecycle spawn comparison still compares the complete spawn command/args/options/environment. The expected environment now uses the independent literal property name instead of `[MARKER_ENV]`; exact dispatch-lifecycle value remains. | Constant equality subsumed by real child environment equality with independent bytes. |
| Linux /proc fixture strings constructed from MARKER_ENV | Replace only interpolated constant with identical literal bytes for owned, wrong-owner, suffix-lookalike, permission, and kill-failure fixtures. Every existing reap/kill/no-kill/state/cleanup assertion remains. | Preserved; expectations no longer share the implementation key. |
| Architecture sync/async key and per-key parity excluding MARKER_ENV | Same comparator, with the independent literal excluded key. Exact two-spawn assertion and explicit async dispatch ID assertions use the independent key. | Preserved; no empty/unspawned lane can pass. |

All other PID tests are unchanged: absent file, malformed JSON, null/primitive/missing-version/non-array/stale-version envelopes, public read/write/remove failures, diagnostics, serialized bytes, file preservation, and cleanup. Registry tests retain every existing spawn/no-spawn failure, timer/listener/order interaction, stdout/stderr finalization output, truncation/fallback, notification, session-state, persisted PID, and orphan ownership assertion. No tests are removed or skipped.

## Task 3: stream reader proof and narrow analyzer exception

Registry finalization reads both `entry.stderrBuffer.read()` and `entry.stdoutBuffer.read()` before selecting the exact final content. RingBuffer.read remains otherwise untouched, as do all exact empty/zero-capacity/wrap/overflow/truncation/raw-UTF-8-tail tests. ring-buffer.test.ts is byte-for-byte identical to its baseline.

The qualified annotation is one line directly before `read`, naming both actual production calls. It was removed from this wave after the shipping-mode gate reported it as stale; it will be added atomically with production mode in Plan 05-28. Ring-buffer source and its paired owner therefore remain unchanged in this commit. The existing `member annotation remains local` analyzer control passes by reporting exactly `unused_class_members|extensions/pi-claude-marketplace/shared/markers.ts|Peer|read|class_method` for an unrelated unconsumed read method; the annotated Buffer.read does not erase that finding. The `local member companion consumes sibling` control reports zero findings after its genuine read consumer is added. Both controls ran in the full 37-case task 3 command and remain unchanged.


## Checkout verification

Each command ran against the applied checkout with real native Node execution. No import-failure or whole-file-only discovery result is counted as successful verification. All 120 focused cases passed without failures, skips, cancellations, or todos.

| Command | Result | Log |
| --- | --- | --- |
| `node --test tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/index.test.ts` | Exit 0; 33 tests, 5 suites | `/tmp/hook-export-prep/checkout-task1.log` |
| `node --test tests/bridges/hooks/async-rewake/pid-table.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/architecture/hooks-async-rewake.test.ts` | Exit 0; 50 tests | `/tmp/hook-export-prep/checkout-task2.log` |
| `node --test tests/bridges/hooks/async-rewake/ring-buffer.test.ts tests/architecture/fallow-production-mode.test.ts` | Exit 0; 37 tests, 3 suites | `/tmp/hook-export-prep/checkout-task3.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | Exit 0; branches 112/112, functions 43/43, lines 1007/1007 | `/tmp/hook-export-prep/checkout-direct-event-router.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/index.ts` | Exit 0; branches 1/1, functions 0/0, lines 23/23 | `/tmp/hook-export-prep/checkout-direct-index.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts` | Exit 0; branches 21/21, functions 4/4, lines 175/175 | `/tmp/hook-export-prep/checkout-direct-async-rewake-pid-table.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` | Exit 0; branches 104/104, functions 28/28, lines 674/674 | `/tmp/hook-export-prep/checkout-direct-async-rewake-registry.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts` | Exit 0; branches 19/19, functions 4/4, lines 150/150 | `/tmp/hook-export-prep/checkout-direct-async-rewake-ring-buffer.log` |
| `npm run typecheck` | Exit 0; strict public-contract and negative barrel checks pass | `/tmp/hook-export-prep/checkout-typecheck.log` |
| Installed ESLint on the eleven exact plan paths | Exit 0; no findings | `/tmp/hook-export-prep/checkout-eslint.log` |
| `git diff --check` on all eleven paths and PLAN | Exit 0 | No output |

The direct gate and pins are unchanged. These exact pair results do not claim aggregate production unit coverage or an integration/e2e union.

## Isolated analyzer evidence and expected parent delta

Preparation ran `node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json` only in `/tmp/hook-export-prep/runtime`. Fallow 3.22.0 returned kind dead-code, schema version 9, with unchanged nonempty entry discovery: ten total entries (one manual, nine package.json). The isolated snapshot went from 57 to 47 issues. Both runs exited 1 normally because other phase findings remained.

The existing complete `findingIdentities` normalizer confirmed exactly the ten dispositions listed above were removed, with **no added identities**. No defining event-router types became orphaned. The final isolated report rechecked the coherent closure after preparation corrections. Reports and normalized delta are retained at:

- `/tmp/hook-export-prep/fallow-before.json`
- `/tmp/hook-export-prep/fallow-after-initial.json`
- `/tmp/hook-export-prep/fallow-after-final.json`
- `/tmp/hook-export-prep/finding-delta.json`

No live whole-tree census ran while the other wave owner was editing. Parent must compare the complete stable checkout report and accept these ten expected dispositions before advancing.

## Deviations and guard compliance

The parent accepted the bounded Task 1 clarification after the wrapper-to-helper proof above: retire the redundant inner generation guard and unused parameter, preserve the real wrapper guard, and exercise all stale/current paths through actual registration. This adds no new source owner or fake runtime seam. Defining types remain unchanged because isolated analyzer evidence proves their live public-signature consumption.

The preparation-only lint finding was the obsolete cast at a migrated callback call; it was removed without changing the event object or assertion. Checkout scoped lint is clean.

This is a behavior-preserving refactor. Replacement public-effect tests pass existing behavior; no fabricated intentional runtime RED, failing commit, or claim of RED evidence is made. All former direct assertions are preserved or explicitly subsumed by complete public effects in the ledger above. Ring-buffer tests and unrelated-read analyzer controls remain unchanged.

No new dependencies, network/auth/filesystem trust boundaries, test-only production exports, reset seams, coverage exclusions, threshold changes, blanket analyzer exceptions, or known stubs were introduced. No original test was removed or skipped.

## Parent integration pending

Parent must perform stable-wave census reconciliation, aggregate native production unit coverage at exactly 100%, full pre-commit and independent review, then create the wave commits and update shared planning state. No requirement completion or integration pass is claimed before that acceptance.

## Self-Check: PASSED

All eleven declared owner paths exist; the ten applied changes match the reviewed temporary copies exactly, while ring-buffer.test.ts still matches its original baseline bytes. The bounded PLAN amendment and this canonical SUMMARY are on disk. Three intended focused commands discover and pass 120 actual cases, all five direct instruments pass exact hit/found counts, and checkout typecheck/lint pass. No commit is asserted because the parent retained commit ownership.



## Parent review repair: export-absence compiler checks

Independent review proved that five new hook checks and eight related checks in the agent, command and skill barrels could pass after a forbidden export returned. A bounded four-owner task replaces each with an optional-property `satisfies` expression: the absent namespace member is its only intended error. All thirteen separate restoration controls now emit exactly TS2578; all four baselines compile and lint without exceptions. No production export is added, and positive proofs and runtime assertions remain unchanged.

The initial `| undefined` repair correctly detected restored exports but triggered the existing lint rule for redundant error-type unions. The final optional-property idiom resolves both checks. The first integrated unit run measured exact 100% coverage but failed one census case because the new RingBuffer annotation is stale in shipping mode. The annotation is deferred, its finding remains visible, and the final full gates are rerun. These failures and repairs are retained in the independent review and verification report.


## Final parent acceptance

Completed in `851c5e26`. The stable wave passes 6,242/6,242 unit tests with exact 100% coverage across 225 emitted production modules: 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches. All 58 analyzer/census/Sonar controls and mandatory pre-commit checks pass, including affected direct pairs. Independent review has zero open findings across 22 changed source/test paths; all thirteen restored-export compiler controls reject their offenders. The complete census is 57 → 42: fifteen exact removals, zero additions. RingBuffer.read remains in the census until its proven adjacent exception can be activated with production mode in Plan 05-28. See [wave verification](05-WAVE-4-VERIFICATION.md). EXPORT-01 and EXPORT-02 remain open for later plans.
