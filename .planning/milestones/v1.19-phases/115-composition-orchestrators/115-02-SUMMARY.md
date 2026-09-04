---
phase: 115-composition-orchestrators
plan: 02
subsystem: testing
tags: [node-test, strong-mock, import-cascade, dependency-injection, unreachable-code, coverage]

requires:
  - phase: 115-composition-orchestrators
    plan: 03
    provides: "The barrel repoint that gave orchestrators/import/index.ts a production consumer, which is what made removing this suite's barrel import safe for the dead-code gate"
  - phase: 115-composition-orchestrators
    plan: 08
    provides: "The sized notification boundary and t.after-owned hermetic scope idioms this suite copies"
provides:
  - "The sole mirrored owner for orchestrators/import/execute.ts at 100 percent direct branch, function, and line coverage"
  - "A pragma-free extensions/ tree: the last c8 ignore in the extension is gone, replaced by a case that drives all four production default resolvers"
  - "Five structurally unreachable arms removed from the import cascade, each replaced by a narrowed private type that turns a wrong token into a compile error"
  - "One fewer correspondence-gate violation: the wrong-import record on tests/orchestrators/import/execute.test.ts is closed"
affects: [115-05, 116, 117]

actuals:
  tokens: 31027
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Derive every collaborator type from the module's own injection seam (NonNullable<ImportDeps[...]>) so a change to the seam is a compile error in the suite instead of a stale hand-copied type"
    - "Fill an all-optional dependency bundle with rejecting collaborators so an unpromised call surfaces as an unexpected outcome on the aggregated result rather than reaching a real transport"
    - "Prove a conditional spread by comparing the WHOLE captured options object, because deepStrictEqual distinguishes an omitted key from an explicit undefined and a per-value assertion does not"
    - "Prove a production default resolver by running the entrypoint twice, so the default's own answer is what changes the second outcome"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - tests/orchestrators/import/execute.test.ts

key-decisions:
  - "Delivered all three plan tasks in one commit: removing the module-scope environment mutation and the file-wide lint suppression is not separable from rewriting every case, and DEL-01 makes the commit, not the task, the pair-atomic unit"
  - "Found three MORE unreachable arms than the plan named, and removed all five inside the pair rather than keeping a coverage exception for any of them"
  - "Restructured the notification builder so plugin rows accumulate in a sibling map and the block status is REQUIRED, which is what made the bare undefined-status arm removable without a non-null assertion"
  - "Required both halves of the module's private config-patch type so the six nullish fallbacks nothing could reach disappeared with the type, not with a pragma"
  - "Kept cases at the top level with no describe(), matching the completed sibling owner in this phase and the rule's single-entrypoint clause"

patterns-established:
  - "A defensive guard can be REACHED and still not be DISCRIMINATING; when a plant on it stays green, report the redundancy and narrow the case's stated claim instead of inventing a case"
  - "When a plant on a conditional spread stays green, the case was reading the value rather than the key set; compare the whole options object"
  - "An unreachable switch arm whose type is optional cannot be deleted alone; make the field required at construction and the arm goes with it"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "orchestrators/import/execute.ts reaches 100 percent direct functions, lines, and branches with its owner run alone and carries no coverage exception"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/import/execute.ts -> branches 150/150, functions 35/35, lines 1156/1156"
        status: pass
      - kind: unit
        ref: "rg 'c8 ignore|node:coverage ignore' extensions/pi-claude-marketplace/orchestrators/import/execute.ts -> 0 hits"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner imports its own paired source and the correspondence gate no longer reports a violation anywhere under tests/orchestrators/import/"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node scripts/check-corresponding-tests.mjs | rg 'import/' -> 0 hits"
        status: pass
    human_judgment: false
  - id: D3
    description: "All eight public outcome types are produced through every producer route, each cell asserting the complete aggregated result and the complete notification array"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts (48 cases, all deepStrictEqual on the whole ClaudeImportExecutionResult and the whole notification array)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Continuation holds with the failing entry in first and in middle position, for the marketplace pass and for the plugin pass"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#ensures the rest of the batch after ... on the first marketplace / on a middle marketplace / records an unexpected plugin failure and keeps the batch after ..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Five structurally unreachable arms were removed with no behavior change, and the narrowed private types make a wrong token a compile error"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "planted violation: assigning \"removed\" to the block status and calling importWarningReason(\"marketplace-failed\") each fail npm run typecheck; reverted"
        status: pass
      - kind: unit
        ref: "planted violation: a guard throwing on any plugin-row block that carries no marketplace status never fired across all 48 cases; reverted"
        status: pass
    human_judgment: false
  - id: D6
    description: "The default resolvers run for real against a case-owned tree with no dependency bundle and no network reach"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#resolves every collaborator from production when the caller supplies no dependency bundle"
        status: pass
      - kind: unit
        ref: "planted violation: neutering each of the four default resolvers turns that case red; reverted"
        status: pass
    human_judgment: false

duration: 96min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 02: Import Cascade Owner Summary

**The import cascade now proves all eight of its public outcome types through every producer route at 100 percent direct coverage, and the last coverage-exception pragma in the extension is gone — replaced by five unreachable arms removed and two private types narrowed.**

## Performance

- **Duration:** 96 min
- **Tasks:** 3 (delivered in 1 commit)
- **Cases:** 25 -> 48
- **Suite size:** 1487 -> 2486 lines
- **Direct coverage:** branches 116/137 -> 150/150, functions 31/33 -> 35/35, lines 1071/1130 -> 1156/1156

## Accomplishments

### D-115-02 — the owner imports its own module

`tests/orchestrators/import/execute.test.ts` imported `importClaudeSettings` through
`orchestrators/import/index.ts`. It now imports `orchestrators/import/execute.ts` directly.
The correspondence gate reports nothing under `tests/orchestrators/import/`. The barrel keeps
its production consumer from P115-03, so the dead-code gate stays clean.

### D-115-04 — the pragma is gone, the default path is proved

The `c8 ignore next` on the default state loader was the only coverage exception in the whole
`extensions/` tree. It is deleted. In its place, one case calls `importClaudeSettings` with no
`deps` at all against a case-owned temporary tree carrying a real `.claude/settings.json` and a
real path-source marketplace, so the production settings loader, state loader, marketplace add,
and plugin install all execute. The in-repo git fake with an empty remote allow-list is passed
so any transport attempt would be a hard failure.

The case runs the import **twice**. The second run must report the two skips the first run's
committed state implies — which is what makes the default state loader's own answer, rather than
merely its absence of a throw, the thing under test.

### D-05 — five unreachable arms, not two

The plan named two. A branch-by-branch reading found five, each confirmed by a caller trace.

| Arm | Why unreachable | Disposition |
| --- | --- | --- |
| `blockToMarketplaceMessage` `default: throw` | the module assigns only `added` / `updated` / `failed` to the private block status | narrowed the private status type to those three tokens; arm deleted |
| `blockToMarketplaceMessage` `case undefined:` | every plugin row's marketplace necessarily carries a marketplace-level outcome, so a statusless header cannot be built | made `status` REQUIRED and moved plugin rows into a sibling map; arm deleted |
| `installOnePlannedPlugin` `default: assertNever(outcome)` | `InstallPluginOutcome` has exactly two arms and both are explicit cases | arm deleted; the `assertNever` import went with it |
| `importWarningReason` `case "marketplace-failed":` | the notification loop `continue`s that reason before the renderer is reached | narrowed the parameter to the two reasons that survive; arm deleted |
| `importWarningReason` `case "unmappable-marketplace-source":` | same `continue` | same |

A sixth class of dead branch came from the module's private config patch: `BatchedConfigPatch`
declares both halves optional, but every patch this module builds carries both, so six `?? {}`
fallbacks were unreachable. The patch type is now `Required<BatchedConfigPatch>` inside the
module — still assignable to the persistence contract — and the fallbacks are gone with it.

**Caller trace evidence.** `codegraph explore` reports `MarketplaceBlock`
(`execute.ts:281`) with 2 callers, both inside `execute.ts`, and `blockToMarketplaceMessage`
(`execute.ts:491`) with 1 caller, also inside `execute.ts` — the type is module-private, so the
narrowing is invisible outside the file. `InstallPluginOutcome`
(`orchestrators/types.ts:429`) is a two-arm union. `orchestrators/reconcile/notify.ts:137-148`
carries the same recipe already applied to its own block type, which is the in-repo precedent
this change copies.

**Every public outcome is preserved.** The 25 prior cases passed unmodified against the
restructured source before the rewrite began.

### D-115-07 / D-115-08 — the exhaustive matrix

All eight outcome types are produced through every producer route, including the three routes
into `PluginSkipOutcome` (already-recorded state, `PluginShapeError{already-installed}`, and the
`ConcurrentInstallError` route the suite had never produced), the four `ImportWarningOutcome`
reasons, and both `UnexpectedPluginFailureOutcome` routes. Every cell asserts the complete
`ClaudeImportExecutionResult` and the complete captured notification array. No cell re-derives
why a lifecycle workflow failed internally; each injects one cause and asserts the composition's
continuation, ordering, tally, and notification effect.

Every expected notification is authored by hand from the shipped grammar. No expectation calls a
production builder, projector, or formatter.

### D-115-09 — continuation from first and from middle

Each failure family is authored as a three-entry batch with the fault in position one and,
separately, in position two. Six marketplace-pass cells (typed failure, absent outcome, throw ×
two positions) and four plugin-pass cells cover both passes, and because every cell asserts the
whole aggregated result, the earlier entries' surviving outcomes are proved in the same
assertion.

### Suite hygiene

- The module-scope `process.env.PI_CODING_AGENT_DIR = mkdtempSync(...)` that ran at import time,
  was restored nowhere, leaked a temporary root per run, and split the import block is gone.
  Every case now takes a `createHermeticScopes(t, label)` pair of roots with the `HOME` and
  agent-directory restore registered in one `t.after()` before the act phase.
- The file-wide `eslint-disable @typescript-eslint/require-await` is gone with nothing in its
  place; collaborator stubs return resolved promises directly.
- The two doubles built by casting through `unknown` are gone. The Pi boundary is three strict
  `strong-mock` mocks sized to the promised emission count, with `verifyBoundary()` after the
  result assertions.
- Case titles state public behavior and cite decision IDs only; no plan, phase, or wave
  reference appears in either file.

## Planted violations

Twenty-nine plants were run. Each was applied to the production source, the suite was run, and
the source was restored; `git diff` against the committed tree is empty.

| Plant | Result |
| --- | --- |
| `settingsLoader` default: drop the production settings loader | RED |
| `addMarketplaceFn` default: never add | RED |
| `installPluginFn` default: never install | RED |
| `stateLoader` default: answer with an empty state | GREEN, then RED after the fix below |
| `blockToMarketplaceMessage`: render an already-present marketplace as added | RED |
| `setMarketplaceStatus`: keep the first status instead of the last | RED |
| `pushMarketplaceRow`: drop every row after the first | RED |
| the builder: render no plugin rows | RED |
| `importWarningReason`: render the wrong content reason | RED |
| `isEmptyPatch`: treat a half-empty patch as empty | GREEN, then RED after the fix below |
| `mergeEnsureAndRepairs`: repair an already-declared marketplace key | RED |
| `mergeEnsureAndRepairs`: repair an already-declared plugin key | RED |
| `buildBatchedPatchForScope`: drop the undeclared-source guard | RED |
| `buildRepairPatchForScope`: drop the undeclared-source guard | **GREEN — reported below** |
| `buildRepairPatchForScope`: drop the per-scope plugin filter | RED |
| `addOnePlannedMarketplace`: always thread the git port | GREEN, then RED after the fix below |
| `installOnePlannedPlugin`: report a resource change on every install | RED |
| `installOnePlannedPlugin`: drop the post-commit warnings | RED |
| `dispatchFailedOutcome`: drop the concurrent-install skip route | RED |
| `executeScopedPlan`: install under a blocked marketplace | RED |
| `executeScopedPlan`: drop the already-recorded plugin skip | RED |
| `executeScopedPlan`: swallow the unreadable-state diagnostic | RED |
| `writeBatchedConfigForScope`: swallow the write-failure diagnostic | RED |
| `writeBatchedConfigForScope`: write over an invalid config instead of aborting | RED |
| `reconcileExistingMarketplace`: treat an unrecognized stored source as a match | RED |
| `addOnePlannedMarketplace`: record a non-added outcome as added | RED |
| `recordMarketplaceAddFailure`: stop warning the dependent plugins | RED |
| typecheck: assign a marketplace status the import path never produces | RED |
| typecheck: render a warning reason the cascade drops before the renderer | RED |

Plus one inverted plant: a guard that throws on any plugin-row block carrying no marketplace
status **never fired across all 48 cases**, which is the runtime evidence behind removing the
bare `case undefined:` arm.

### Four plants stayed green. Three were fixed; one is reported.

**1. The default state loader was not discriminated.** The no-dependency case seeded no prior
state, so an empty default snapshot was indistinguishable from the real load. Fixed by running
the import twice: the second run reads what the first committed and must report skips. The plant
is now red.

**2. `isEmptyPatch`'s `&&` was not discriminated.** No case carried a patch that was empty in
exactly one dimension with an empty repair half, so switching the operator to `||` changed
nothing. Fixed by adding two behaviors that had been untested: a marketplace whose only plugin
failed to install is still declared in the config (marketplaces-only patch), and a fresh plugin
under a recorded marketplace that records no plugins is declared (plugins-only patch). The plant
is now red.

**3. The git-port conditional spread was not discriminated.** The case read
`options.gitOps`, which is `undefined` whether the key is omitted or set explicitly to
`undefined`. Fixed by capturing the whole `AddMarketplaceOptions` object and comparing it with
`deepStrictEqual`, which distinguishes an absent own key from an undefined-valued one. That also
pinned the rest of the add options, including `notifications: { mode: "orchestrated" }`. The
plant is now red.

**4. The repair builder's undeclared-source guard is reachable but not discriminating — reported,
not papered over.** Deleting `if (rawSource === undefined) continue;` from
`buildRepairPatchForScope` leaves the suite green. The reason is structural: any marketplace that
reaches a later scope plan's repair pass without a declared source was already written into the
config by the plan that skipped it, so `mergeEnsureAndRepairs`'s already-declared check drops it
before it can reach `saveConfig`. The guard is therefore redundant with a downstream check rather
than dead — its `continue` does execute, which is why the branch is covered. The case that
reaches it now says so in a comment and claims only the observable outcome: both scope plans
converge on one config declaring both recorded marketplaces and both recorded plugins.

This is the same shape as the 115-06 pristine-guard finding. It is **not** proposed for removal
here: unlike the five arms above, this guard is reached at runtime, and deleting it would rely on
an invariant in a different function. It is recorded so the milestone's later cleanup can decide
with the evidence in hand.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical correctness] Three more unreachable arms than the plan named**

- **Found during:** Task 1's branch-by-branch reading, before any test was written
- **Issue:** The plan's D-05 named two arms and expected `case undefined:` at
  `blockToMarketplaceMessage` and both advisory arms of `importWarningReason` to be *reachable*.
  Neither is. `case undefined:` needs a plugin row whose marketplace carries no marketplace-level
  outcome, which cannot happen: a plugin only runs when its marketplace was added or was already
  present, and both record an outcome. The two `importWarningReason` arms sit behind a `continue`
  that drops exactly those two reasons before the renderer. Keeping them would have made 100
  percent coverage unreachable without a pragma, which the plan forbids.
- **Fix:** Removed all three with the same S8 recipe the plan sanctions for the other two:
  narrowed the private type so a wrong token is a compile error, then deleted the arm. For
  `case undefined:` that required making the block status REQUIRED, which in turn required moving
  plugin rows into a sibling map keyed the same way — a private restructure with no export, seam,
  or public-behavior change.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
- **Commit:** `6324939a`

**2. [Rule 2 - Missing critical correctness] Six dead nullish fallbacks on the private patch type**

- **Found during:** Task 3's branch analysis
- **Issue:** `BatchedConfigPatch` declares `marketplaces?` and `plugins?` optional, but every
  patch this module constructs sets both, so the `?? {}` right operands in `isEmptyPatch`,
  `mergeEnsureAndRepairs`, and their callers could never evaluate.
- **Fix:** Introduced the module-private `ImportConfigPatch = Required<BatchedConfigPatch>` and
  dropped the fallbacks. Still assignable to `writeBatchedConfigEntries`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
- **Commit:** `6324939a`

**3. [Process] All three tasks delivered in one commit**

The plan ordered three tasks. Task 1 required deleting the module-scope environment mutation and
the file-wide `require-await` suppression; both are only removable by rewriting every case, which
is Task 2's work. Splitting them would have meant writing all 25 cases twice. DEL-01 binds the
pair to the commit, not to the task, and P115-03 set the same precedent in this phase. All three
tasks' acceptance criteria are met.

**4. [Process] Cases stay at the top level with no `describe()`**

The plan asked for one top-level `describe()` per exported entrypoint.
`.claude/rules/typescript-unit-testing.md` says a single-entrypoint module keeps its cases at the
top level, and `execute.ts` exports one runtime entrypoint. The completed sibling owner in this
phase (`tests/orchestrators/reconcile/pending.test.ts`) uses top-level cases. Followed the rule
and the sibling.

### Behavior coverage adjusted rather than dropped

The prior `WB-03 batched: ONE mtime touch` case asserted only that the mtime increased. The
replacement asserts the mtime increased **and** the complete resulting config bytes, which is what
actually proves all five entries landed in one file rather than partially.

## Verification

Every gate was run separately, because `npm run check` short-circuits at `format:check` on
pre-existing untracked files this plan must not touch.

| Gate | Command | Exit |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | 0 |
| Lint | `npm run lint` | 0 |
| Fallow (dead-code, health, dupes) | `npm run fallow` | 0 |
| Prettier | `npm exec -- prettier --check <both files>` | 0 |
| Unit suite | `npm test` | 0 (4816 tests, 0 fail) |
| Integration suite | `npm run test:integration` | 0 (30 tests, 0 fail) |
| Direct coverage | `npm run test:coverage:direct -- .../import/execute.ts` | 0 — branches 150/150, functions 35/35, lines 1156/1156 |
| Correspondence gate | `node scripts/check-corresponding-tests.mjs \| rg 'import/'` | 0 hits |
| Prohibited patterns | `rg` for `only/skip/todo`, `c8 ignore`, `as unknown as`, `as any`, `anyTimes()`, `It.isAny()`, `verifyAll(`, capitalized phase markers, `mkdtempSync`, file-wide `eslint-disable` | 0 hits |
| Secrets | trufflehog `filesystem` over both changed paths | 0 verified, 0 unverified |
| Scoped hooks | `pre-commit run --files <both files>` | lint, typecheck, fallow pass; only the two pre-existing out-of-scope failures (worktree trufflehog git-mode abort, `format:check` on operator-owned untracked files) |

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary schema change
was introduced. The two threats the plan flagged high are mitigated as planned: the import-time
environment mutation is replaced by per-case hermetic scopes with the restore registered before
the act phase (T-115-02-A), and every case either injects collaborators that reach no transport
or passes the in-repo git fake with an empty remote allow-list (T-115-02-B). The coverage
exception is deleted and a prohibited-pattern scan fails the pair if one returns (T-115-02-C).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` — FOUND
- `tests/orchestrators/import/execute.test.ts` — FOUND
- `.planning/phases/115-composition-orchestrators/115-02-SUMMARY.md` — FOUND
- Commit `6324939a` — FOUND in `git log`
