---
phase: 08-enablement-parity-for-dependencies
reviewed: 2026-09-21T21:36:22Z
depth: standard
iteration: 2
files_reviewed: 28
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
  - tests/shared/notification-types.test.ts
findings:
  critical: 2
  warning: 4
  info: 6
  total: 12
status: issues_found
---

# Phase 08: Code Review Report (iteration 2)

**Reviewed:** 2026-09-21T21:36:22Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Re-review of HEAD `f2378bac` after the 14-commit fix pass (`2fa1bba5..HEAD`). Every iteration-1 finding was re-derived against the current source rather than the fix report: `enableCascadeClosureFailure`'s reachability was re-traced through `domain/dependency-closure.ts` (the `marketplace-not-added` and `not-found` exclusions hold: the lazy lookup never answers `absent`, and it grows `knownMarketplaces` with every declared marketplace before `walkChildren` checks a child edge); the merged `runPhases` ledger was checked against `transaction/phase-ledger.ts` (root last, no `undo` needed, member `undo` gated on `materialized`); the CR-04 discovery loop and fold were executed against the real walk; and the rewritten EDEP-01 fault-injection tests now `stat` the member's staged skill with a positive control at `enable-disable.test.ts:5302` proving the path is real.

Ten of the twelve in-scope findings are resolved. Two are not fully resolved, and the fixes introduced two new Critical defects of the same class the iteration-1 findings named:

1. **CR-01 survives on the `--local` path** (both cascades). The member patch reads only the TARGET file's entry; with `--local` the target is the local file, so a member whose `enabled: false` lives in the base file (exactly what `disable <dep>` writes for a dependency with no local declaration) is skipped. Reproduced against the real orchestrator: `enable a --local` renders `b (installed) {dependency enabled}` + `/reload`, and `planReconcile` on the merged view then plans `disable b` (CR-06).
2. **`assertFoldingClosureSucceeded` is false** in the CR-04 fix. The discovery loop walks each discovered member as a ROOT, which the walk exempts from the catalog-absent guard; the fold walks the same member as a CHILD of the synthetic root, which is not exempt. A `toReEnable` member absent from its marketplace manifest therefore makes the fold return `not-found` and the code dereferences `folded.closure` on a failure arm -- a TypeError escapes exactly as CR-02 did (CR-07, reproduced with the real walk).

CR-03's fix covers the ledger-failure paths but not the config-write path the finding also named (WR-08). The docs now contradict the CR-01 behaviour they describe (WR-09), and the fix commits added new comment-policy violations of the WR-06 kind (WR-10). The three Info items from iteration 1 are unchanged and re-listed.

## Iteration-1 verdicts

| ID | Verdict |
| --- | --- |
| CR-01 | resolved for the flagless path; **not resolved** for `--local` (CR-06) |
| CR-02 | resolved -- `enableCascadeClosureFailure` handles `unusable-declaration`; the remaining assertion's evidence is correct |
| CR-03 | resolved for root/member ledger failures (merged ledger, fault-injection test at `:5458` observes `ENOENT`); **not resolved** for the config-write path named in the finding (WR-08) |
| CR-04 | resolved for the transitivity claim (depth-2 test); **regressed** -- the fold's assertion is false and crashes on a manifest-absent member (CR-07) |
| CR-05 | resolved -- all three tests assert the on-disk footprint and exact row bytes; the positive control at `:5302` proves the path |
| WR-01 | resolved -- undo rethrows after the fold; both partial sources thread into `enable-failed`; row renders `{rollback partial}` + child |
| WR-02 | resolved -- `hydrateReEnabledMemberHooks` runs after both save paths; routing-bucket assertion |
| WR-03 | resolved -- lazy per-key lookup; ENBL-07/D-97-01 bytes restored; `disable`'s scope-wide read documented per ruling |
| WR-04 | resolved per ruling -- `warning`, header `needs attention`, catalog prose states the reload consequence |
| WR-05 | resolved -- both fixtures seed the config precondition and the comments say so |
| WR-06 | resolved for the listed sites; **regressed** -- the fix commits introduced new violations (WR-10) |
| WR-07 | resolved per ruling (documented), but the new subsection makes a false claim about EDEP-03 (WR-09) |
| IN-01 | still present |
| IN-02 | still present |
| IN-03 | still present |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-06: The member config patch reads only the target file, so `--local` leaves a base-file `enabled: false` in the merged view and the next reload reverts the member

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1158-1190` (`writeReEnabledMemberConfigEntries`, condition at `:1174`); `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:961-991` (`writeReEnabledCascadeMemberConfigEntries`, condition at `:973-976`)
**Issue:** Both helpers call `selectDeclaringConfigWriteTarget({ locations, local: opts.local, key })` and then test `selection.current.plugins?.[key]?.enabled !== false`. `selection.current` is the TARGET file's parse only (`shared.ts:591-602`), and with `local === true` the target is unconditionally the local file (`resolveTargetIsLocal`, `shared.ts:722-727`). A dependency's `enabled: false` entry lands in the BASE file whenever `disable <dep>` ran without `--local` and nothing declared it locally -- the canonical CR-01 sequence. `enable a --local` (or `install a --local`) then re-enables `b` through its record, skips the patch because the local file has no `b` entry, and the merged view (`config-merge.ts`, CFG-02 local-wins-by-identity) still says `enabled: false`. Reproduced against the real orchestrator with the CR-01 fixture plus `local: true`: the row renders `● b@official v1.0.0 (installed) {dependency enabled}` with the `/reload` trailer, `state.json` has `b.enabled: true`, the base file keeps `"b@official": {"enabled": false}`, the local file gains only `a@official`, and `planReconcile(merged, stateAfter, "user")` returns `pluginsToDisable: [{ plugin: "b", marketplace: "official" }]`. That is the exact outcome CR-01 described, one flag away. No test passes `local: true` through either cascade (`grep 'local: true'` over the cascade tests returns nothing after line 4100). The root itself is unaffected because its write is unconditional and shadows the base entry wholesale.
**Fix:** The entry to overwrite is the one that EXISTS, so select the member's file by declaration alone, ignoring the flag the user typed for the root -- that is also what keeps D-04-02 (no new key anywhere). Put the helper in `shared.ts` next to `writeAdoptingConfigEntries` so both cascades share one body (they are currently duplicated verbatim, which is how the same defect landed twice):

```ts
// shared.ts
export async function overwriteDisabledMemberEntries(args: {
  locations: ScopedLocations; state: ExtensionState; keys: readonly string[];
  select: typeof selectDeclaringConfigWriteTarget; write: typeof writeAdoptingConfigEntries;
}): Promise<void> {
  for (const key of args.keys) {
    // The flag names the ROOT's write file; a member's existing entry lives
    // where it lives, so the declaring-file rule (no flag) finds it.
    const selection = await args.select({ locations: args.locations, local: undefined, key });
    if (selection.kind !== "selected" || selection.current.plugins?.[key]?.enabled !== false) continue;
    // ...write { enabled: true } as today
  }
}
```

Add a test to each cascade suite that seeds `{"b@official": {"enabled": false}}` in the BASE file, runs the command with `local: true`, and asserts `planReconcile(merged, stateAfter, scope)` equals `emptyReconcilePlan(scope)` and that the local file gains no `b` key.

### CR-07: `assertFoldingClosureSucceeded` is false -- a manifest-absent disabled member crashes the install with a TypeError when the transitive fold runs

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:954-1003` (`resolveTransitiveReEnableSet` fold at `:961-983`, assertion at `:999-1003`); `extensions/pi-claude-marketplace/domain/dependency-closure.ts:428-430` (root-only catalog-absent exemption)
**Issue:** The assertion's evidence is "each discovered member was walked as its OWN root, so any failure reachable from it was caught in discovery". That covers `cycle` and `unusable-declaration`, which `walkEdge` reports for a root too, but NOT `not-found`: `walkEdge` returns `not-found` only when `looked.kind === "absent" && edge.requiredBy !== undefined`, so a ROOT whose lookup answers `absent` is tolerated (dependencies `[]`) while the SAME key as a CHILD of the synthetic root fails. `lookupCascadeDependencies` (`install-flow.ts:486-512`) answers `absent` for any installed record its marketplace manifest no longer declares -- the ATTR-08 `not in manifest` state, which a marketplace update produces. Reproduced with the real `resolveDependencyClosure`: `foo -> {bar, qux}`, `bar -> baz`, all three dependencies installed-and-disabled, `qux` dropped from the manifest. Discovery: `bar` root -> `[baz, bar]`; `qux` root -> `[qux]` (absent tolerated); `baz` root -> `[baz]`; `discovered.size` (3) != `toReEnable.length` (2) so the fold runs and returns `{"ok":false,"reason":"not-found","key":"qux@mp","requiredBy":"cr04-synthetic-reenable-root@cr04-synthetic-marketplace"}`; the code then evaluates `folded.closure.filter(...)` and throws `TypeError: Cannot read properties of undefined (reading 'filter')`. The TypeError escapes `runInstallCascade` into the install's lock closure and renders as a brace-less `(failed)` row with the TypeError text -- the same shape CR-02 was opened for. Had the failure been returned instead, the rendered `requiredBy` would leak the internal synthetic key into a user-visible row. Neither CR-04 test exercises a member absent from the catalog.
**Fix:** Do not assert; the fold is a walk with its own failure arms. Route the failure to the cascade's `closure-failed` outcome with the synthetic key mapped back to the real declarer, or avoid the synthetic root entirely by treating each discovered member's lookup as root-exempt during the fold:

```ts
const folded = await resolveDependencyClosure({ /* as today */ });
if (!folded.ok) {
  // A discovered member is a `not-found` here only as a child of the synthetic
  // root; report it against the real dependent that reached it.
  return folded.reason === "not-found" && folded.requiredBy === TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY
    ? { ...folded, requiredBy: discovered.get(folded.key)?.requiredBy ?? rootKey }
    : folded;
}
```

Add an `install-cascade.test.ts` case with the graph above (`catalog` omits `qux@mp`) asserting `closure-failed` / `not-found` with a real `requiredBy`, and remove `assertFoldingClosureSucceeded`.

## Warnings

### WR-08: A config-write throw after the merged ledger commits still strands every member and the root on disk with no state save

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1930-1932` (`runFreshEnableCascadeWithRoot`), `:1853-1860` (`settleIdempotentEnableCascade`), `:1140-1156` (the helper's own comment)
**Issue:** CR-03 named three post-cascade failure points: the root ledger, `writeEnabledFlagBack`, and `tx.save()`. The fix folds the root ledger into `runPhases`, so a ledger throw now unwinds the members (verified at `:5458`). But `writeEnabledFlagBack` and `writeReEnabledMemberConfigEntries` run AFTER `runPhases` returned `ok` and BEFORE `tx.save()`; a throw there (EACCES on the config file, the case the file already tests for `disable` at `:3185`) propagates to the outer catch, which renders `(failed)` and never saves. Every member's and the root's artifacts are then on disk while `state.json` records them all disabled -- the NFR-3 shape CR-03 described, now with N+1 records instead of N. The helper's own comment (`:1150-1156`) explains why the patch cannot move INTO the ledger ("a config write is not undone by `runPhases`") but does not address the reverse hazard. The exposure for the root alone predates this phase, and a retry self-heals (`bridges/skills/stage.ts:407-415` removes an existing target before renaming), which is why this is a Warning rather than a Critical.
**Fix:** Catch around the two config writes inside the closure, run the members' (and root's) `unstageBackToDisabled` on failure, then rethrow -- or make the config writes a final ledger phase whose `undo` is a no-op and whose `do` throwing still triggers the member undos:

```ts
phases.push({
  name: "config",
  do: async () => {
    await writeEnabledFlagBack(transaction, write, selection, state);
    await writeReEnabledMemberConfigEntries(transaction, opts, locations, state, reEnabledMemberKeys);
  },
});
```

Add a fault-injection test: `writeConfigEntries` rejects after `b` materialized; assert `b:s1` is `ENOENT` afterwards.

### WR-09: The docs now contradict the CR-01 behaviour and the WR-07 subsection makes a false claim about EDEP-03

**File:** `docs/plugin-enablement.md:42` and `:50-52`; `docs/dependency-resolution.md:112`; `docs/output-catalog.md:3094`
**Issue:** (a) `plugin-enablement.md:42` states "Neither path writes an explicit `enabled` value into the configuration file for a dependency ... the write reaches the installation record alone"; `dependency-resolution.md:112` states "The desired-state configuration is not touched by this"; `output-catalog.md:3094` states "only the plugin the user named reaches the config write". Since `33dc82c7`/`657c2cf5` both cascades overwrite an existing `enabled: false` member entry to `true` (`enable-disable.ts:1158`, `install-flow.ts:961`), so all three sentences are false. (b) The new subsection "Only the standalone `enable` command lifts a disabled dependency" (`:50-52`) says "The enable cascade (EDEP-01) and the install cascade's re-enable arm (EDEP-03) both run for the standalone `enable`/`install` commands only". `runInstallCascade` has no orchestration gate (`install-cascade.ts:1218-1240`; `grep orchestrated` over the file is empty), and `installPluginWithTransaction` calls it on both modes -- only the config write-back at `:1647` is standalone-gated. A reconcile-driven install therefore DOES re-enable a disabled member through its record and does NOT patch its config entry, which is the CR-01 divergence on the orchestrated path; the doc claims the opposite. `dependency-doc-agreement.test.ts` pins only reason tokens, so none of this is gated.
**Fix:** Rewrite `:42` to: "Neither path ADDS a config entry for a dependency (D-04-02). Where the target scope already declares the member with `enabled: false` -- what `disable <dep>` writes -- the standalone command overwrites that entry to `true` so the next reload does not plan the disable back." Mirror in `dependency-resolution.md:112` and the catalog prose. In the WR-07 subsection, say that EDEP-01 is standalone-only while EDEP-03 runs on every install but patches the member's config entry only for a standalone install, and state the reconcile consequence for the orchestrated case.

### WR-10: The fix commits introduced new comment-policy violations (removed-code narration) in source and tests

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:507-513` ("replacing the former whole-scope eager read `buildScopeDeclarationDetail` did", "for the same reason the former eager lookup did"), `:525` ("restoring the pre-EDEP-01 ENBL-07 bytes"), `:868-873` ("Before this, the members materialized in their own separate ledger and the root ran afterward through `runEnableBranch`; ... the file's own former "Known gap" comment"), `:1207-1208` ("when materialization used to happen here"); `tests/orchestrators/plugin/enable-disable.test.ts:4643` ("before WR-03, the whole-scope eager read reached..."), `:5463-5468` ("Before CR-03, "b"'s materialization ran in its own separate ledger ...")
**Issue:** `skills/typescript-comments/SKILL.md` forbids "narration of code that no longer exists" and names `the former X`, `X used to ...`, `Pre-fix, X ...`, `replacing the former X` as the patterns to drop. These are the same class WR-06 was opened for; the WR-06 commit fixed the listed sites and the later fix commits added these.
**Fix:** State the current fact only: "reads ONE record's declarations as the walk visits it, so an unreadable record outside the closure never blocks the enable"; "the ENBL-07 `not in manifest` refusal is rendered by the ledger's PI-3 lookup, so the cascade treats a manifest-readable, entry-absent ROOT as declaring nothing"; "the root's own fresh enable is the LAST phase of the same `runPhases` ledger as the members, so a failure in either direction unwinds both"; drop the "used to happen here" sentence. In the tests, keep the arrange comment to what the fixture sets up.

### WR-11: The CR-04 discovery walk now fails an install on declarations under already-installed ENABLED members and silently ignores a re-enabled member's never-installed dependency

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:930-952` (discovery walk with `installedKeys: new Set()`), `:1226-1235` (`closure-failed` propagation)
**Issue:** With an empty `installedKeys`, each `toReEnable` member's discovery walk recurses through every installed member below it, enabled or not, and through every not-installed declaration it finds. Two consequences the tests do not cover and the docs do not state: (a) `install R` where `R -> D (disabled) -> E (enabled, installed) -> F` with `F` absent from its manifest or in an un-added marketplace now returns `closure-failed` naming `F` required by `E` -- a plugin the user did not ask about and that the outer walk was designed to skip ("RESV-05 precedes D-03-08 deliberately", `dependency-closure.ts:355-359`); before the fix the install succeeded and LOAD-01 reported the gap at load time. (b) `R -> D (disabled) -> F (never installed, declared in a readable manifest)`: `F` is found but not disabled, so it is neither re-enabled nor installed nor reported; `D` comes back up and LOAD-01 holds it and `R` down on the next pass -- the CR-04 symptom with a missing rather than a disabled member. The enable cascade at least renders `(skipped) {not installed}` at `warning` for the analogous case.
**Fix:** For (a), decide and document: either keep the fail-closed stance and add a test plus a sentence in `dependency-resolution.md`'s failure table, or seed the discovery walk's `installedKeys` with the ENABLED records only (the set the enable cascade's classification already distinguishes) so the walk stops at a live dependency as the outer walk does. For (b), either add the not-installed sub-closure members to `constraints.members` (they are dependencies of something this install turns on) or emit them as `(skipped) {not installed}` rows the way `enableCascadeSkipRow` does.

## Info

### IN-01: `EnableCascadeMember.record` is optional where the disposition already decides it (unchanged from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:479-485`, `:980` (`if (member.record !== undefined)` with a silent `else`), `:929` (conditional spread)
**Issue:** As in iteration 1: a `re-enabled` member without a record is dropped with no phase and no row.
**Fix:** Discriminated union `{ disposition: "re-enabled" | "already-enabled"; record: InstalledPluginRecord } | { disposition: "not-installed" }`.

### IN-02: Names that no longer describe what the code does (unchanged from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:450` (`EnableRefusedError` carries disable refusals), `:1347` (`readEnabledDependents` returns `void` and throws)
**Fix:** `EnableDisableRefusedError`; `assertNoEnabledDependents`.

### IN-03: Test structure drift in the messaging suite (unchanged from iteration 1)

**File:** `tests/orchestrators/plugin/enable-disable.messaging.test.ts:585`, `:680` (two `describe` blocks among 29 flat `test()` cases); `tests/orchestrators/plugin/install-cascade.test.ts:2278` ("byte-identical to today")
**Fix:** One style per file; retitle to "a plugin that declares nothing composes the single-row block".

### IN-04: `unstageBackToDisabled` defends an arm the sibling branch narrows away, and a test exists only to cover it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:763-766`; `tests/orchestrators/plugin/enable-disable.test.ts:5603` ("...carries no cause still rethrows with a synthesized message")
**Issue:** `runDisableBranch` narrows the same outcome through `isFailedUnstageOutcome` (`:1466-1469`, "`cascadeUnstagePlugin` normalizes every `ok: false` result to an Error cause") and reads `cascade.cause` directly; `unstageBackToDisabled` instead writes `outcome.cause ?? new Error(...)`, and a test injects an `ok: false` outcome with no `cause` purely to cover the fallback. That is error handling for a scenario the module's own predicate declares impossible, plus a test that pins a fake shape.
**Fix:** `if (isFailedUnstageOutcome(outcome)) { applyPartialCascadeFold(...); throw outcome.cause; }` and delete the fallback test.

### IN-05: `isDeclarerAbsentFromManifest` discriminates on an error-message suffix

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:502-504`; `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:196-200`
**Issue:** The ATTR-08 special case is detected by `cause.message.endsWith(": not declared by its marketplace")`. The other `unreadableDeclarer` arm carries `redactAbsolutePaths(errorMessage(err))` from a manifest-load failure, i.e. text the discriminant cannot distinguish by construction. Impact is nil today (root only, and the ledger refuses regardless), but `readRecordDeclarations` was just exported for this caller and could carry a `kind: "absent-entry" | "unreadable"` field instead.
**Fix:** Add a structured discriminant to `IndexFailure` and switch on it.

### IN-06: A false ordering comment and two verbatim helper duplications

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:955-957` ("the direct set the caller already found in the walk's own post order"); `enable-disable.ts:1587-1626` vs `install-flow.ts` `hydrateInstalledHooks`; `enable-disable.ts:1158` vs `install-flow.ts:961`
**Issue:** `closure.alreadyInstalled` is `ctx.skipped`, which `walkDependencyEdge` pushes on the installed-key hit BEFORE any recursion (`dependency-closure.ts:367-373`), so it is encounter order, not post order; the early-return arm therefore re-enables in a different order from the fold arm (harmless today because re-enable phases do not check each other, but the comment is wrong). `hydrateReEnabledMemberHooks` and the two `writeReEnabled*ConfigEntries` helpers are near-verbatim copies across files -- the duplication is what let CR-06 land in both.
**Fix:** Correct the comment; hoist the two helpers into `shared.ts` (see CR-06's sketch) and parameterize `hydrateInstalledHooks` by log prefix.

---

_Reviewed: 2026-09-21T21:36:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
