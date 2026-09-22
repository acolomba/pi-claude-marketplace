---
phase: 09-reload-installs-missing-dependencies
reviewed: 2026-09-22T08:18:45Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - CHANGELOG.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
  - tests/index.test.ts
  - tests/integration/reconcile-plan-convergence.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/dependency-verdict.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/orchestrators/reconcile/types.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-09-22T08:18:45Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Reviewed the `67da6cbf..HEAD` diff for the reload-driven missing-dependency install (MISS-01 / MISS-02) against D-09-01..D-09-16, with the three project skills applied.

The core mechanics hold up under tracing:

- `apply.ts`: `applyDependencyInstalls` gates on `opts.reason === "reload"` in one `if`; `refreshTogglePlan` substitutes ONLY `pluginsToEnable` / `pluginsToDisable` / `pluginsToDependencyDisable` from the fresh plan, so no uninstall/remove/add/install bucket is ever re-driven and source-mismatch rows stay round-1. The second `readPassForScope` takes its own lock inside `runScopeIsolated`; the entry point's lock is released before it runs. A re-read throw becomes a `state.json` row and the round-1 toggles stand (pinned by a test). The failure arm reuses `classifyOrchestratorThrow` + `redactedDependencyCascadeError`, so no raw `error.message` reaches output (T-55-02-02). The install loop carries no per-entry try/catch, matching `applyPluginInstalls`' documented reliance on the entry point's never-rethrow contract; I traced `handleCascadeThrow` / `handleInstallThrow` / `classifyInstallFailure` and both orchestrated arms always return `status: "failed"`, and the only post-catch await (`collectPostCommitWarnings`) swallows its own throws.
- `install-flow.ts`: `createInstallMissingDependency` stamps `provenance: "dependency"` on every member including the root, performs no config write, has no promotion arm and no DFEN-04 landed-disabled arm, skips an already-recorded key without `tx.save()`, maps the ledger's marketplace-absent sentinel onto a `marketplace-not-added` closure failure (renders the D-03-08 cause), and hydrates hooks after the save exactly as `installPlugin` does.
- `install-cascade.ts`: `rootRanges` folds once in `effectiveRanges` at `resolveOneMember`; a failing fold is a `constraint-failed` / `range-conflict` outcome naming the root's own texts (T-06-10 pinned by a test); `treatDisabledAsWall` gates `liveInstalledKeys` at exactly one site and callers passing neither option see no change.
- `plan.ts` / `dependency-verdict.ts`: the D-09-02 predicate admits enabled, marker-held, or config-declared-enabled dependents and refuses claimed, config-disabled, and user-disabled-left-alone ones; dedupe by key with `localeCompare`; raw ranges (no fold); `buildDependencyDisabledLift` never lifts a record without the marker or one the config declares disabled; `plan.ts` still reads no filesystem. `declaredKeys` and `declaredEnabledKeys` are populated at the same point in `classifyDeclaredPlugin`, so a dangling or malformed declaration cannot read as "declared disabled".
- Closed-set amendment: `Reason` union, `CommandPrivateReason`, header count 60 -> 61, the two enrollment records, `EXPECTED_REASONS` in both architecture tests, the catalog paragraph, two new catalog states (220 -> 222, bytes 30_538) and the fixture all agree. `notify.ts` reads one outcome flag and probes nothing.
- `index.ts`: only `reason: event.reason` was added inside the existing try/catch.
- D-04-05's `holdsDependencyRecord` keeps a marketplace reached through the CMP-3 user-scope fallback out of `marketplacesToRemove`, so a cross-scope dependency install does not oscillate on the next reload.

What the review found is a cluster of silent-omission gaps on the new success row (two `CascadeMemberOutcome` / `InstallLedgerSummary` facts the reload path drops that every other install surface reports), one orphaned JSDoc block, and several test-quality and documentation items.

Environment note: the host `/tmp` tmpfs is out of inodes (~30k leaked `clone-cache*` fixture directories from earlier test runs, days old). Bash stdout was lost mid-review; I routed diffs through `~/.cache/claude-review-09/` and the Read tool. I did not delete the leaked directories (the auto-mode classifier denied the sweep). The executor's recorded gate evidence (`09-04-SUMMARY.md`: typecheck, unit 7485/7485 at 100% coverage, integration 38/38, type-member gates; the one `require-await` debt closed in 14ff68e3) was spot-checked rather than re-run.

## Warnings

### WR-01: The reload install row silently drops the root's WARN-01 degradation signals

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:727-742`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2003-2010, 2180-2186`
**Issue:** `PluginInstalledOutcome` inherits `orphanRewake` and `degradedKinds` from `EnableDegradationSignals` precisely so that "none [of the ledger-driven arms] can be given a signal the others silently lack" (`apply-outcomes.ts:100-108`). The config-declared install arm (`applyPluginInstalls`, lines 636-648) propagates both; `installedRowFromOutcome` raises the row to `warning` and stamps `{malformed skill}` / `{malformed command}` / `{orphan rewake}` from them. The new dependency-install arm writes neither. `InstallMissingDependencyOutcome.installed` carries only `members` and `postCommitWarnings`; the root's `InstallLedgerSummary` (`outcome.root`, which has `frontmatterDegradations` and `resolved.orphanRewake`) is consumed for the warnings text and then discarded. A dependency whose skill frontmatter is unparseable therefore renders `(installed) {dependency installed}` at `info`, with the only trace being the free-text post-install diagnostic. The apply test at `tests/orchestrators/reconcile/apply.test.ts:4626-4634` documents this as the expected shape ("the row itself stays the plain {dependency installed} token") rather than pinning the WARN-01 contract every other install row honours.
**Fix:** Carry the root's signals on the outcome and stamp them on the root member's row, mirroring `installedPluginOutcome`:

```ts
// install-flow.ts -- InstallMissingDependencyOutcome "installed" arm
| {
    readonly status: "installed";
    readonly members: readonly CascadeMemberOutcome[];
    readonly postCommitWarnings?: readonly string[];
    readonly orphanRewake?: true;
    readonly degradedKinds?: readonly FrontmatterKind[];
  }

// ...return site
const degradedKinds = [...new Set(outcome.root.frontmatterDegradations.map((d) => d.kind))];
return {
  status: "installed",
  members: outcome.members,
  ...(warnings.length > 0 && { postCommitWarnings: warnings }),
  ...(outcome.root.resolved.orphanRewake === true && { orphanRewake: true }),
  ...(degradedKinds.length > 0 && { degradedKinds }),
};

// apply.ts -- inside the member loop, gated on member.key === rootKey like postCommitWarnings
...(member.key === rootKey && result.orphanRewake === true && { orphanRewake: true }),
...(member.key === rootKey && result.degradedKinds !== undefined && result.degradedKinds.length > 0 && {
  degradedKinds: result.degradedKinds,
}),
```

Then change the apply test to assert the full bytes `secrets-vault v1.0.0 (installed) {dependency installed, malformed skill}` at `warning` severity, and add the `plugin-installed` + `dependencyInstalled` + `degradedKinds` combination to the notify test (the ordering case at `notify.test.ts:914-952` already proves the renderer handles it).

### WR-02: `fellBackToCurrentCopy` is a REQUIRED member fact the reload row never reports

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:727-742`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:110-134`
**Issue:** `CascadeMemberOutcome.fellBackToCurrentCopy` is REQUIRED "so a new fact goes silently unreported" cannot happen (`install-cascade.ts:389-398`), and the standalone cascade composer stamps `{dependency current copy}` from it (`install-cascade.messaging.ts:228`; catalog line 826). The new loop reads `member.marketplace`, `member.name`, `member.version` and the soft-dep booleans and ignores `fellBackToCurrentCopy`; `PluginInstalledOutcome` has no slot for it, so the compile-time guard the field was made required for never fires at this construction site. This is exactly the path where the fact matters most: D-09-07 says the re-plan "catches a TAGS-02 current-copy that landed out of range", which renders as the dependency's `(installed) {dependency installed}` row beside the dependent's `(disabled) {dependency version unsatisfied}` row, and nothing on the surface says the version was a fallback rather than a pin. The same drop applies to `reEnabledFromRecord`, but that one is unreachable here because `treatDisabledAsWall` removes every re-enable phase, so it is not a defect.
**Fix:** Add an optional `dependencyCurrentCopy?: true` to `PluginInstalledOutcome` (omitted when false, NREG-01), set it from `member.fellBackToCurrentCopy` in the loop, and push `"dependency current copy"` after `"dependency installed"` in `installedRowFromOutcome`. Extend the closed-set docs paragraph only if the token's carrier list is enumerated there (the token already exists; no REASONS amendment). Add a notify test for the combined `["dependency installed", "dependency current copy"]` order and an apply test using the injected `marketplaceTagProbe` "no-matching-tag" seam that `install-flow.test.ts:11702-11743` already exercises.

### WR-03: `buildInstallLedgerOptions` lost its JSDoc to the inserted type alias

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:276-293`
**Issue:** The 30-line JSDoc that documents `buildInstallLedgerOptions` (the cascade-wide vs per-member option split, the `pinVersionOverride` precedence rule) now ends at line 276 and is immediately followed by a second `/** ... */` block at 277 that documents `InstallLedgerCallerOptions`. The first block is attached to nothing, and the function declaration at 293 has no doc comment. Editors and doc tooling will show the type alias's three-line description for the function and drop the contract text entirely.
**Fix:** Move the type alias and its own JSDoc above the function's JSDoc:

```ts
/**
 * The fields `buildInstallLedgerOptions` reads off its caller's options,
 * narrowed so `installMissingDependencyWithTransaction` can share the builder
 * without carrying every `InstallPluginOptions` field (D-09-05).
 */
type InstallLedgerCallerOptions = Pick<InstallPluginOptions, "ctx" | "mapModel" | ...>;

/**
 * Build the per-member ledger options ...   <-- the existing 30-line block
 */
function buildInstallLedgerOptions(opts: InstallLedgerCallerOptions, core: { ... }) {
```

## Info

### IN-01: README now understates the marker's readers

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:52`
**Issue:** The paragraph rewritten in this phase says "Exactly three readers decide anything on [`dependencyDisabled`]" and lists `isAlreadyDependencyDisabled`, `isDisabledIndependently` and `buildDependencyDisabledLift`. `plan.ts::isEligibleDependencyInstallDependent` (line 754, `record.dependencyDisabled === true`) is a fourth reader that decides an action: it is D-09-02's marker-held arm, which admits a dependent into the dependency-install bucket.
**Fix:** Say "four" and add the D-09-02 reader, or make `isEligibleDependencyInstallDependent` call `isAlreadyDependencyDisabled(record)` so the README's count stays literally true.

### IN-02: Test-side casts and weak assertions in the new entry-point cases

**File:** `tests/orchestrators/plugin/install-flow.test.ts:11608-11609, 11690-11692, 11829, 12014, 12048`
**Issue:** (a) `(outcome as { cause: string }).cause` appears three times right after `assert.ok(outcome.status === "failed" && ...)`, which already narrows `outcome` -- the cast is redundant and the unit-testing skill forbids reaching a member through an assertion. (b) `assert.ok((outcome.postCommitWarnings ?? []).length > 0)` asserts a length, not the warning text; the skill asks for the whole value. (c) `const { loadConfig } = await import("../../../.../config-io.ts")` is a dynamic import inside a test body where a static import at the top of the file is the file's convention. (d) `assert.equal(outcome.status, "installed"); assert.ok(outcome.status === "installed");` duplicates one check for narrowing.
**Fix:** Drop the casts and read `outcome.cause` directly after the narrowing `assert.ok`; assert the exact `postCommitWarnings` array; hoist `loadConfig` to the import block; keep one narrowing assertion per case.

### IN-03: Four apply cases assert substrings instead of rendered bytes

**File:** `tests/orchestrators/reconcile/apply.test.ts:4630-4634, 5031, 5366-5367, 5418-5420`
**Issue:** The malformed-skill, marketplace-not-added, failed-re-read and dangling-reference cases use `assert.match` / `message.includes(...)` on the notification text while every sibling case in the block pins the complete `message` string. The review brief asked that reload cases assert real rendered bytes; substring checks let a second row, a changed tally line, or a severity change slip through.
**Fix:** Replace each with `assert.deepStrictEqual(notifications, [{ message: "...", severity: ... }])` (the two-notification malformed case can pin both entries).

### IN-04: History narration in a new JSDoc and a test title

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1085-1092`; `tests/orchestrators/reconcile/notify.test.ts:876`
**Issue:** `applyToggleSteps`' doc opens with "extracted out of `applyPlan` so it can run this once ... Unchanged otherwise:", which narrates the refactor rather than the function; the comment skill asks for present-tense facts about the code as it stands. The test title "an outcome without the flag renders byte-identically to today" is the "byte-identical to what came before" claim the same skill names as not a fact about the current code.
**Fix:** Reword to "Runs the two `applyPluginToggles` calls and the LOAD-01 dependency-disable step against whichever plan is current: round 1's, or `refreshTogglePlan`'s D-09-07 replacement. WR-02-style isolation wraps the dependency-disable step's own stamp write ..." and retitle the test "an outcome without the flag renders no reasons brace (NREG-01)".

### IN-05: Cross-marketplace member row form differs from D-09-09's wording

**File:** `docs/output-catalog.md:2801`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:731-732`
**Issue:** D-09-09 in `09-CONTEXT.md` says "a cross-marketplace member keeps the standalone cascade's `name@marketplace` key form". The code keys each member's row by its OWN marketplace and renders the bare name under that marketplace's block (`● tools [project]` / `● shared-lib ...`), and the catalog paragraph written in this phase documents that form. The docs describe the code truthfully, so this is not a docs defect, but the decision record and the shipped surface disagree and nothing in the phase summaries records the deviation.
**Fix:** Record the deviation in the phase summary or amend D-09-09's text; no code change needed unless the operator prefers the decision's form.

### IN-06: CHANGELOG line overstates what the reload enables

**File:** `CHANGELOG.md:13`
**Issue:** "`/reload` now installs a declared dependency an installed plugin lacks, and enables the plugin that needed it." The reload brings a dependent back up only when the load-time check had held it down (marker) or the configuration declares it enabled; a plugin the user disabled by hand stays disabled (D-09-02, tested at `apply.test.ts` D-09-04). The sentence reads as unconditional.
**Fix:** "... and brings back the plugin the load-time check had disabled for it." (or "and re-enables the dependent the check had disabled").

### IN-07: Source-text regex test for the reason threading

**File:** `tests/index.test.ts:900-916`
**Issue:** The D-09-13 threading case reads `index.ts` as text and counts regex matches of the `applyReconcile({...reason: event.reason})` call. It follows the file's existing `reconcileConstructions` precedent, but it proves a source shape, not behaviour, and a legitimate reformat (an added option, a comment inside the literal) breaks it while a behavioural regression that keeps the text would not. The behavioural case immediately below it (`MISS-01 / D-09-13: a reload event installs a missing dependency that a startup event left alone`) already covers the contract.
**Fix:** Consider dropping the regex case in favour of the behavioural one, or keep it only as long as the file-level precedent stands.

---

_Reviewed: 2026-09-22T08:18:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
