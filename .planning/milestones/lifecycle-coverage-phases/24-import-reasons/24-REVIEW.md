---
phase: 24-import-reasons
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - features/plugin/import.feature
  - test/orchestrators/import/execute.test.ts
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Scope: the uncommitted working-tree diff for IMP-08, IMP-09, and IMP-10, plus
the held-dependency case. Untracked `fallow-setup` skill directories were
excluded.

What I verified:

- `node --test test/orchestrators/import/execute.test.ts` passes (80/80).
  Direct coverage of `import/execute.ts` is 100% lines, branches, and functions.
- `npx eslint` and `npx prettier --check` are clean on the changed import files.
- The two new cucumber scenarios pass (`npx cucumber-js features/plugin/import.feature --name ...`).
- The result shape is safe for its callers. The post-pass config write
  (`execute.ts:1615`, `:1680`) still reads `installedPlugins[].reenabled`, and
  the enable path still sets it. `edge/handlers/plugin/import.ts` and
  `edge/types.ts` only pass `ClaudeImportExecutionResult` through. No other
  production code reads `warnings[].reason` or `unexpectedPluginFailures`.
- The new imports create no cycle. `reconcile/apply.ts` and
  `reconcile/notify.ts` import nothing from `orchestrators/import/`.

Problems:

- **CR-01:** adding `partially-installed` to `IMPORT_CONTEXT.rowPolicies`
  breaks three tests in two test files the diff did not touch. `npm run check`
  and the pre-commit hook will fail.
- **WR-01, WR-02:** several comments and one catalog sentence still describe
  behavior that this change removed.
- **WR-03:** IMP-09 matches install's runtime-throw branch only. It does not
  match install's `InstallMarketplaceAddError` branch, which also reaches
  import's fallthrough.

## Critical Issues

### CR-01: `IMPORT_CONTEXT` gains a row policy, and three tests that pin it now fail

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts:39`. The failing tests are at `test/orchestrators/import/execute.messaging.test.ts:33-47`, `test/orchestrators/import/execute.messaging.test.ts:245-256`, and `test/architecture/soft-dep-marker-policy.test.ts:196-204`.

**Issue:** IMP-10 adds `"partially-installed": { markers: true, contentReasons: true }`
to `IMPORT_CONTEXT.rowPolicies`. Three existing assertions pin the old
four-key map exactly:

- `exports the complete import command context` expects `rowPolicyStatuses: ["installed", "skipped", "failed", "unavailable"]`.
- `IMPORT_CONTEXT declares complete row policies` deep-equals the four-key map.
- `SC-5 / D-12: IMPORT_CONTEXT (import/execute.messaging.ts) declares the per-verb marker policy` deep-equals the same map.

I confirmed all three fail:

```
node --test test/orchestrators/import/execute.messaging.test.ts      -> 2 failing
node --test test/architecture/soft-dep-marker-policy.test.ts         -> 1 failing
```

`execute.messaging.ts` is a staged source with a test pair, so the pre-commit
`check:commit` direct-coverage run fails on it. `test:unpaired` fails on the
architecture test. `npm run check` cannot pass. The plan's `files_modified`
lists neither test file, which is how this was missed.

**Fix:** Add the new key to all three expectations, in source key order:

```ts
// execute.messaging.test.ts:36
rowPolicyStatuses: ["installed", "partially-installed", "skipped", "failed", "unavailable"],

// execute.messaging.test.ts:250 and soft-dep-marker-policy.test.ts:198
installed: { markers: true, contentReasons: true },
"partially-installed": { markers: true, contentReasons: true },
skipped: { markers: false, contentReasons: true },
failed: { markers: false, contentReasons: true },
unavailable: { markers: false, contentReasons: true },
```

## Warnings

### WR-01: Source comments still describe the old rows

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1075-1076`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:624-629`, `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts:15-18`

**Issue:** Three comments state the opposite of what the code now does:

- **`enableOnePlannedPlugin` header (`execute.ts:1075`):** says "An enable re-materializes the record through the install ledger, so the row is `(installed)`, the row reconcile renders for the same transition." After IMP-10, a partial record's row is `(partially-installed)`, and a malformed component raises the row to `warning`.
- **`buildImportNotificationMarketplaces` doc (`execute.ts:626-627`):** maps "installed plugin -> PluginInstalledMessage". It can now be `PluginPartiallyInstalledMessage`.
- **`ImportStatus` doc (`execute.messaging.ts:16-17`):** gives "a per-plugin failure (`failed`, e.g. source-mismatch / not-in-manifest)". Before this change, `not-in-manifest` was the brace on the unexpected-failure `(failed)` row. IMP-09 removed that, so no import `(failed)` row carries `{not in manifest}` any more. A plugin missing from the manifest is the `(unavailable)` warning row. Line 16 is also 124 characters, because the IMP-10 insertion was not rewrapped. Prettier does not reflow comments, so this line stays long.

**Fix:** Change the enable header to "so the row is the one reconcile renders for the same re-enable (`enabledRowFromOutcome`): `(installed)`, or `(partially-installed)` for a partial record". Change the builder doc to "installed plugin -> PluginInstalledMessage, or PluginPartiallyInstalledMessage for a re-enabled partial record". Change the `ImportStatus` example to `(failed, e.g. source-mismatch / dependency-failed / lock-held)` and rewrap it to 100 columns.

### WR-02: The output catalog still says import's fallthrough carries `{not in manifest}`

**File:** `docs/output-catalog.md:2357`

**Issue:** The `dependency-cascade-failed` explanation says `dispatchFailedOutcome` checks for `DependencyCascadeError` first, "so a cascade failure never renders the unrelated `{not in manifest}` token the fallthrough carries for every other unclassified throw." IMP-09 removed that token from the fallthrough. The diff updated the section intro at line 2248 but missed this sentence, so the catalog now contradicts itself.

**Fix:** Change the sentence to say the `DependencyCascadeError` check comes before the generic fallthrough, so a cascade failure reads `{dependency failed}` and not the fallthrough's git-host reason or bare `(failed)` row.

### WR-03: IMP-09 matches install's runtime-throw branch only; an `InstallMarketplaceAddError` still loses its reason on import

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1808`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1840-1898`. Compare `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:354-363`.

**Issue:** Install classifies a failed orchestrated install in two places. `classifyEntityShapeError` gives an `InstallMarketplaceAddError` its `err.reason`. This is the LAYER-07 / D-MF-04 target-scope add that `resolveTargetScopeMarketplace` runs when only the user scope records the marketplace, rethrown by `recordAsInstallFailure` (`install-outcome.ts:500-513`). The reason is `source missing`, `invalid manifest`, or another reason `classifyAddError` returns. Install's Branch 4 only handles everything else.

Import's `dispatchFailedOutcome` has no `InstallMarketplaceAddError` arm, so that error falls through to `pushUnexpectedFailure`. There, `classifyGitHostFailure(error)` returns `undefined`: the class carries only a redacted message, with no `code`, no `data.statusCode`, and no `cause`. Import then renders a bare `(failed)` row with a cause line, where `install` renders `(failed) {<add reason>}`.

The catalog sentence this phase added says "a failure no reason classifies reads a bare `(failed)` ... as `install`'s does". That is false for this failure, because install does classify it. A rollback-partial failure has the same problem: install renders `{rollback partial}`, and import cannot tell from the orchestrated outcome's error. Fixing that one needs the outcome to carry the partials, so treat it as known residue.

**Fix:** Compute the reason in `pushUnexpectedFailure` the way install's two branches do, and widen the field type to match:

```ts
const hostReason =
  reason !== "unexpected-failure"
    ? undefined
    : error instanceof InstallMarketplaceAddError
      ? error.reason
      : classifyGitHostFailure(error);
```

`hostReason` then becomes `ContentReason`. The authentication-only cause suppression at `execute.ts:708` stays correct, because `recordAsInstallFailure` rethrows an authentication failure unchanged. `sonarjs/no-nested-conditional` rejects the nested ternary, so put the chain in a small helper. Add a unit case that feeds `failedInstallOutcome(new InstallMarketplaceAddError("source missing", "..."))` and expects `(failed) {source missing}`.

## Info

### IN-01: The import messaging test still renders a row import can no longer produce, and has no `partially-installed` case

**File:** `test/orchestrators/import/execute.messaging.test.ts:23-31`, `test/orchestrators/import/execute.messaging.test.ts:218-243`

**Issue:** The type fixture and the `eta-plugin` render case pin `(unavailable) {no longer installable}` as an import row. IMP-08 removed that token from import. `ImportMsg` also gained `PluginPartiallyInstalledMessage`, but no test renders it through `IMPORT_CONTEXT`.

**Fix:** Change the fixtures to a reason import emits now, such as `{unsupported hooks}`. Add one `partially-installed` render case next to the `installed` one.

### IN-02: `warningBase` names its return type through the `"unavailable"` arm

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:371-383`

**Issue:** The return type is `Omit<Extract<ImportWarningOutcome, { reason: "unavailable" }>, "reason">`. It reads as if the base belongs to the `unavailable` warning, but the `uninstallable` arm uses it too. If the `unavailable` arm ever gains a field, the base changes silently.

**Fix:** Declare `interface ImportWarningBase { kind; scope; plugin; marketplace; ref; cause? }` and define `ImportWarningOutcome = ImportWarningBase & (...)`. Then `warningBase` returns `ImportWarningBase`.

### IN-03: The enable outcome stores its companion facts twice

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1127-1131`

**Issue:** The enable arm sets `declaresAgents`, `declaresMcp`, and `declaresWorkflows` from `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows`. It also stores the same three values in `enableSignals`. On this path, `installedRow` reads only `enableSignals`, so the `declares*` copies are never rendered and could drift apart unnoticed. `reenabled` and `enableSignals` also always appear together on this path.

**Fix:** Leave this alone (D-05 keeps the outcome shape), or note on the field that `enableSignals` is the source of truth for the row when it is present.

### IN-04: `import/execute.ts` now depends on the reconcile apply module for a pure projection

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:11`

**Issue:** `degradationFromEnable` is a 10-line pure function, but it lives in `reconcile/apply.ts`, the load-time orchestrator that owns the lock, migrations, and marketplace add and remove. Exporting it from there links import's module graph to reconcile's apply ledger. D-05 limits shared files to one-word edits while phases 20-23 run in parallel, so this was acceptable for now.

**Fix:** Later, move `degradationFromEnable` next to `EnableDegradationSignals` in `orchestrators/plugin/enable-disable.ts`, or into a reconcile leaf such as `apply-outcomes.ts`, and import it from there in both places.

### IN-05: The held-dependency case does not observe directly that the enable operation was skipped

**File:** `test/orchestrators/import/execute.test.ts:4869-4946`

**Issue:** D-06 says to assert that import "never calls the enable operation". The test runs the production operations on real disk and infers this from the result and the state that remains. That is strong evidence: an actual enable would set `enabled: true`. But it is not a direct observation. An enable that answered `skipped {already enabled}` would produce the same result.

**Fix:** Optionally pass `deps: { setPluginEnabled: spy }` that wraps the production operation, and assert the spy was called zero times.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
