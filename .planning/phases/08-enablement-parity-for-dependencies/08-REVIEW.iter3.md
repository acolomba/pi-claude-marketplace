---
phase: 08-enablement-parity-for-dependencies
reviewed: 2026-09-22T00:00:17Z
depth: standard
iteration: 3
files_reviewed: 30
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-disable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-enable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 1
  warning: 4
  info: 8
  total: 13
status: issues_found
---

# Phase 08: Code Review Report (iteration 3, final)

**Reviewed:** 2026-09-22T00:00:17Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Final re-review of HEAD `3a0bd2c2` after the 10-commit iteration-2 fix pass (`f2378bac..HEAD`). Every iteration-2 finding and the four iteration-1 findings it left partial were re-derived against the current source, not the fix report: `overwriteDisabledMemberEntries` was traced through `selectDeclaringConfigWriteTarget` (`shared.ts:645-687`) for the base-file, local-file, bare-local-entry and unreadable-local cases; the new `"config"` phase and `buildEnableRootPhase.undo` were checked against `transaction/phase-ledger.ts` (the failing phase's own `undo` runs first, then executed phases in reverse; both undos gate on their sentinels, the config phase has none, so no double-undo is reachable); the two CR-07 narrowing assertions were re-traced through `domain/dependency-closure.ts` (a recorded member's marketplace is a key of `state.marketplaces` and therefore always in `knownMarketplaces`, `cycle` and deeper `not-found` are caught in discovery, so the fold's only failure is a `toReEnable` member absent from its manifest and `discovered.get` always answers -- both assertions hold); the contract-pin file was confirmed coherent by running the single `lint:type-members` gate (exit 0, the same 5 recorded exceptions). The WR-09 doc rewrite matches the code for the CR-06 overwrite and for the EDEP-01/EDEP-03 gating asymmetry.

Six of the six iteration-2 findings are resolved as stated. The WR-11(b) fix regressed, however, in the one configuration its own test never reaches: when the CR-04 fold runs (a transitively disabled member was discovered), the fold walk also visits every never-installed member below the disabled ones and hands them to `buildReEnableMemberPhase`, which assumes a disabled record. Reproduced against the real `runInstallCascade` in two shapes: a duplicated `qux` row (`(installed)` then `{already installed, dependency enabled}`) with a second ledger pass over a plugin that was never disabled, and -- when the same never-installed member is also reachable from the root directly -- a `member-failed` carrying `TypeError: Cannot read properties of undefined (reading 'version')` for an install that should succeed (CR-08). The same fold path also stamps the internal synthetic root key into `CascadeMemberOutcome.requiredBy` on success, and the transitively discovered members bypass the RESV-05 recorded-version check the docs promise (WR-12). WR-10's comment-policy class regressed a third time in the fix commits (WR-13), and the transitive/never-installed behaviour the fixes added is undocumented (WR-14). The Info items from iterations 1 and 2 are re-listed; two are new.

## Verdicts on prior findings

| ID | Verdict |
| --- | --- |
| CR-01 | resolved -- `overwriteDisabledMemberEntries` selects by declaration alone (`shared.ts:843`), both cascades delegate to it, `--local` tests in both suites assert `planReconcile === emptyReconcilePlan` |
| CR-03 | resolved -- the config writes are the ledger's final phase on both enable paths (`enable-disable.ts:1098-1100`, `:1169`); `WR-08` test at `enable-disable.test.ts:5566` observes `ENOENT` for `a:s1` and `b:s1` |
| CR-04 | resolved for transitivity; **regressed** in the fold's output (CR-08) and still unchecked against RESV-05 (WR-12) |
| CR-06 | resolved -- see CR-01; helper shared, the member's file is the one that declares it |
| CR-07 | resolved -- `not-found` remapped onto `discovered.get(key).requiredBy`; both narrowing assertions re-traced and hold (see Summary); test at `install-cascade.test.ts:1913` asserts `requiredBy: foo@marketplace` |
| WR-06 | **not resolved** -- the iteration-2 fix commits added six new removed-code narrations (WR-13) |
| WR-08 | resolved -- `buildEnableCascadeConfigPhase` is pushed last on both paths; `buildEnableRootPhase.undo` gates on `run.root` |
| WR-09 | resolved for the three false sentences and the EDEP-03 gating claim; the docs now omit the transitive/never-installed behaviour the fixes added (WR-14) |
| WR-10 | **not resolved** -- the listed sites are fixed; the same commits introduced new ones (WR-13) |
| WR-11 | (a) resolved -- discovery and fold seed `installedKeys` with `enabledInstalledKeys`; (b) resolved for the direct case, **regressed** when the fold runs (CR-08) |
| IN-01 | still present (`enable-disable.ts:485`, `:940`, `:991`) |
| IN-02 | still present (`enable-disable.ts:451`, `:1396`) |
| IN-03 | still present (`enable-disable.messaging.test.ts:585`, `:680`; `install-cascade.test.ts:2450`) |
| IN-04 | still present (`enable-disable.ts:765`; `enable-disable.test.ts:5698`) |
| IN-05 | still present (`enable-disable.ts:504`) |
| IN-06 | partially resolved -- the config-write duplication is gone; the false "post order" comment (`install-cascade.ts:1041-1043`) and the `hydrateReEnabledMemberHooks`/`hydrateInstalledHooks` duplication (`enable-disable.ts:1636`, `install-flow.ts:357`) remain |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-08: The fold's closure is not filtered to the disabled set, so a never-installed member below a disabled dependency gets a re-enable phase -- a duplicated row and second ledger pass, or a TypeError when its own install phase comes later

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1084-1090` (fold success arm), `:1369-1382` (phase assembly), `:1190-1197` (`buildReEnableMemberPhase` dereferences `record.version` behind the no-op `assertDisabledRecordExists`)
**Issue:** The fold walks from the synthetic root with `installedKeys = enabledInstalledKeys(state)`, so it stops at ENABLED records only; every never-installed member declared under a discovered disabled member is looked up, found, and pushed to `ctx.order`. The success arm returns `folded.closure` minus the synthetic key -- disabled AND never-installed members alike -- and `runInstallCascade` maps every one of them through `buildReEnableMemberPhase`. That phase's contract ("`partitionAlreadyInstalled` has already proved its record exists and is disabled", `:1124-1129`) is false for the fold's output, the same false-narrowing class as CR-02 and CR-07. The WR-11(b) test (`install-cascade.test.ts:2031`) never reaches the fold: its graph discovers no transitively disabled member, so `discovered.size === toReEnable.length` short-circuits at `:1040` and `neverInstalled` alone drives the install. Two reproductions against the real `runInstallCascade` with the suite's own fixtures:

1. `foo -> bar`, `bar -> {baz, qux}`, `bar`/`baz` installed-and-disabled, `qux` never installed. Result `installed` with members `[qux (reEnabledFromRecord: false), baz (true), qux (true), bar (true), foo]`: `qux` is installed by its WR-11(b) member phase, then `runInstallLedger` runs a SECOND time over the just-written enabled record with `allowExistingRecord: true` and `pinVersionOverride: record.version`, pushing a second outcome. The user sees two `qux` rows, the second reading `{already installed, dependency enabled}` (`install-cascade.messaging.ts:236-238`) for a plugin that was never installed before, and `hydrateInstalledHooks` hydrates it twice. In the same run `bar`'s outcome carries `requiredBy: "cr04-synthetic-reenable-root@cr04-synthetic-marketplace"` -- the fold's `ClosureMember.requiredBy` for a direct synthetic child -- into the exported `CascadeMemberOutcome` (`:1211`); nothing renders that field today, which is the only reason it is not user-visible.
2. `foo -> {bar, qux}`, `bar -> {baz, qux}`, `bar`/`baz` disabled, `qux` never installed (a diamond also reachable from the root). `qux` is in `outerClosureKeys`, so it is a PRIMARY member whose install phase runs last; the fold still lists it, so its re-enable phase runs FIRST with no record: `record.version` throws and the cascade returns `member-failed` for `qux@marketplace` with `TypeError: Cannot read properties of undefined (reading 'version')` (`install-cascade.ts:1197`, via `phase-ledger.ts:158`). A valid install fails with an internal error, rendered as a brace-less `(failed)` row -- the CR-02 shape.

**Fix:** Keep only the discovered (disabled) members in the fold's closure, and take `requiredBy` from discovery for a direct synthetic child so the synthetic key never leaves the function:

```ts
return {
  ok: true,
  closure: folded.closure
    .filter((member) => discovered.has(member.key))
    .map((member) =>
      member.requiredBy === TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY
        ? { ...member, requiredBy: discovered.get(member.key)?.requiredBy }
        : member,
    ),
  neverInstalled: [...neverInstalled.values()],
};
```

Add both graphs above to `install-cascade.test.ts`, asserting exactly one `qux` outcome with `reEnabledFromRecord: false`, `kind: "installed"` for the diamond, and that no outcome's `requiredBy` contains `cr04-synthetic`. Retitle `assertDisabledRecordExists`'s doc comment to name the fold as a second producer whose output must satisfy the same invariant, or drop the assertion in favour of a `recordedDisabled` filter at the phase-assembly site.

## Warnings

### WR-12: Transitively discovered members bypass the RESV-05 recorded-version check the docs promise, and a never-installed member's ranges are taken from the first walk that met it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1336-1340` (`resolveMemberConstraints` gets the OUTER walk's `alreadyInstalled` only), `:759-767` (`checkInstalledMember` runs over that list alone), `:994-996` (`neverInstalled.set` on first sight only), `:1022-1023` (`sub.alreadyInstalled` discarded); `docs/dependency-resolution.md:110`
**Issue:** `checkInstalledMember` runs only over `closure.alreadyInstalled`, the direct hits of the outer walk. A disabled member discovered THROUGH a `toReEnable` member (the CR-04 fold's whole purpose) reaches `buildReEnableMemberPhase` with its `ranges` never intersected or compared to its recorded version, and `sub.alreadyInstalled` -- the enabled members a re-enabled member declares a range on -- is dropped at `:1022`. Reproduced: `foo -> bar`, `bar -> baz@^1.0.0`, both disabled, `baz` recorded `0.0.1`: the cascade returns `installed` and re-enables `baz@0.0.1`; the direct-member control (`foo -> bar@^1.0.0`, `bar` recorded `0.0.1`) returns `constraint-failed` / `installed-unsatisfied`. `docs/dependency-resolution.md:110` states the check unconditionally ("It still checks the recorded version against the effective constraint. A recorded version that does not satisfy the constraint is a conflict, and the install fails"). The install reports success; the next reload's `dependency-verdict.ts` `out-of-range` arm then holds `bar` and `foo` down -- the LOAD-01 loop CR-04 was opened to stop, entered from a different door. Separately, `classifyReEnableCandidate` records a never-installed member on FIRST sight (`:994-996`): with `D1 -> N@^1` and `D2 -> N@^2` both disabled, `N` resolves its pin against `^1` alone and `D2`'s `^2` disappears quietly -- the outcome `domain/dependency-closure.ts`'s D-03-36 comment names as worse than a refusal.
**Fix:** Let one walk own the constraints. Drop the `:1040` short-circuit so the fold always runs, then partition the fold's closure (after CR-08's filter) into the disabled subset -- run `checkInstalledMember` over it before any phase is built -- and the never-installed subset, whose `ranges` the fold has already merged across every declaring branch; pass the fold's `alreadyInstalled` through `checkInstalledMember` as well. Add the two graphs above to `install-cascade.test.ts` asserting `constraint-failed` for the transitive case and a pin resolved against `>=2.0.0 <2.0.0-0`-style intersection (or a `range-conflict`) for the diamond.

### WR-13: The iteration-2 fix commits introduced new removed-code narration in source and tests (WR-06/WR-10 class, third occurrence)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:831-833` ("which duplicated this write verbatim before this helper existed"); `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:883-884` ("This phase is no longer unconditionally last"), `:1027-1035` ("Before this phase existed, both writes ran AFTER `runPhases` had already returned `ok` ... As a phase, the same throw now unwinds"); `tests/orchestrators/plugin/install-cascade.test.ts:1920-1922` ("this is exactly where the pre-fix code dereferenced `folded.closure`"), `:1974-1978` ("Before the fix, the discovery walk's empty `installedKeys` recursed PAST"), `:2033-2036` ("Before the fix, the discovery walk found "qux" ... and silently dropped it")
**Issue:** `skills/typescript-comments/SKILL.md` forbids narration of code that no longer exists and names `X no longer ...`, `Pre-fix, X ...` and `before this` shapes explicitly. Each fix pass has removed the cited sites and added new ones of the same shape in the commit that fixed them; the policy applies to test bodies too.
**Fix:** State the present fact only. `shared.ts:831-833` -> "Shared by the enable cascade's EDEP-01 arm and the install cascade's EDEP-03 re-enable arm." `enable-disable.ts:883` -> "`runEnableCascadeWithRoot` pushes the config phase after this one, so a throw there reaches back here through `runPhases`'s reverse-order undo." `:1027-1035` -> "As the ledger's final phase, a throw from either write unwinds every phase before it through `runPhases`'s reverse-order undo (NFR-3)." In the tests, keep each arrange comment to the graph it builds and the outcome it asserts.

### WR-14: The docs do not describe the transitive re-enable, the never-installed-through-disabled install, or the fail-closed failures those walks add, and one sentence contradicts the paragraph above it

**File:** `docs/dependency-resolution.md:112` (the only EDEP-03 paragraph), `:120` ("This extension does not write a dependency into `claude-plugins.json` or `claude-plugins.local.json`"), the "Why a dependency can fail" table; `docs/plugin-enablement.md:40`
**Issue:** Iteration-2's WR-11 asked for the fail-closed stance to be decided AND documented. The fix decided it (a declaration under an ENABLED member is left unexplored; one under a DISABLED member is walked, a never-installed member found there is installed, and a `not-found` / `marketplace-not-added` / `cycle` below a disabled member fails the whole install as `closure-failed`), but neither doc says any of it: `:112` describes re-enabling "that same record" as if it were one plugin deep, and the failure table does not say that a disabled dependency's own broken declaration can fail an install of a plugin that never named it. `:120`'s "does not write a dependency into `claude-plugins.json`" now contradicts `:112`'s "overwrites that entry to `true`" eight lines above it. `dependency-doc-agreement.test.ts` pins reason tokens only, so none of this is gated.
**Fix:** In `:112`, add: "The re-enable is transitive: a disabled dependency's own disabled dependencies come back the same way, and a dependency it declares that was never installed is installed as an ordinary cascade member. A declaration under a dependency that is already enabled is not walked. A dependency that is disabled and declares something this extension cannot resolve (not in its marketplace, in a marketplace this scope has not added, or part of a cycle) fails the install with that dependency's own reason, even though the plugin you named never declared it." Add the same row to the failure table. Reword `:120` to "does not ADD a dependency to ...". Mirror the transitive sentence in `plugin-enablement.md:40`.

### WR-15: `resolveTransitiveReEnableSet`'s 50-line doc comment is orphaned above `classifyReEnableCandidate`, which carries two consecutive JSDoc blocks

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:922-967` (the CR-04/WR-11/CR-07 doc block), `:968-973` (the second JSDoc block immediately after it), `:999` (`resolveTransitiveReEnableSet` has no doc comment)
**Issue:** The complexity-driven extraction inserted `classifyReEnableCandidate` between the function's doc comment and the function. Two `/** */` blocks now sit back to back; tooling attaches only the second to `classifyReEnableCandidate`, and the first -- the only place the discovery/fold design, the WR-11 stance and the CR-07 remap are explained -- is attached to nothing and reads, in-editor, as the helper's documentation. `resolveTransitiveReEnableSet` itself is undocumented.
**Fix:** Move `classifyReEnableCandidate` (with its own short comment) ABOVE the CR-04 block so that block sits directly on `resolveTransitiveReEnableSet`.

## Info

### IN-01: `EnableCascadeMember.record` is optional where the disposition already decides it (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:485`, `:940`, `:991`
**Fix:** Discriminated union `{ disposition: "re-enabled" | "already-enabled"; record } | { disposition: "not-installed" }`.

### IN-02: Names that no longer describe what the code does (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:451` (`EnableRefusedError` carries disable refusals), `:1396` (`readEnabledDependents` returns `void` and throws)
**Fix:** `EnableDisableRefusedError`; `assertNoEnabledDependents`.

### IN-03: Test structure drift in the messaging suite (unchanged)

**File:** `tests/orchestrators/plugin/enable-disable.messaging.test.ts:585`, `:680`; `tests/orchestrators/plugin/install-cascade.test.ts:2450` ("byte-identical to today")
**Fix:** One style per file; retitle to "a plugin that declares nothing composes the single-row block".

### IN-04: `unstageBackToDisabled` defends an arm the sibling branch narrows away (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:765`; `tests/orchestrators/plugin/enable-disable.test.ts:5698`
**Fix:** `throw outcome.cause` behind `isFailedUnstageOutcome`; delete the fallback test.

### IN-05: `isDeclarerAbsentFromManifest` discriminates on an error-message suffix (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:504`; `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:196-200`
**Fix:** A structured `kind` on `IndexFailure`.

### IN-06: A false ordering comment and one remaining helper duplication (partially resolved)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1041-1043` ("the direct set the caller already found in the walk's own post order" -- `closure.alreadyInstalled` is `ctx.skipped`, pushed before recursion, so it is encounter order); `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1636` vs `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:357`
**Fix:** Say "encounter order"; parameterize `hydrateInstalledHooks` by log prefix and call it from both.

### IN-07: `EnableCascadeRun.root`'s comment still says the root phase is the ledger's last phase

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:712-713`
**Issue:** WR-08 pushed the config phase after the root phase; `buildEnableRootPhase`'s own comment (`:881-887`) was updated, this one was not.
**Fix:** "set by `buildEnableRootPhase` once `materializeEnableRoot` completes".

### IN-08: The install cascade's config write-back still runs outside the ledger, after the members committed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1608-1631` (`writeAdoptingConfigEntries` + `writeReEnabledCascadeMemberConfigEntries` after `runInstallCascade` returned, before `tx.save()`)
**Issue:** WR-08 closed this shape for the enable cascade; the install cascade keeps it. A throw from either write (EACCES on the config file) leaves every materialized and re-enabled member's artifacts on disk with no state save, exactly as `enable-disable.ts` did before WR-08. The shape predates this phase for the root and the fresh cascade members (which is why it is Info), but EDEP-03's re-enable arm added N re-enabled records to the same window.
**Fix:** Mirror WR-08 -- a final `"config"` phase inside `runInstallCascade`'s ledger, or a catch around the two writes that runs the members' undos before rethrowing. Add the same fault-injection test `enable-disable.test.ts:5566` has.

---

_Reviewed: 2026-09-22T00:00:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
