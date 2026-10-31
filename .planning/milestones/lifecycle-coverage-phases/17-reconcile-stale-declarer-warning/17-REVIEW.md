---
phase: 17-reconcile-stale-declarer-warning
reviewed: 2026-10-23T13:12:39Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - docs/output-catalog.md
  - features/marketplace/remove.feature
  - features/marketplace/update.feature
  - features/plugin/reconcile.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - test/architecture/notify-stamp-coverage.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/plan.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-10-23T13:12:39Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Scope: the uncommitted REC-05 change. The declaration walk's failure arm now carries a closed-set `reason`. A new `plugin-declarer-unreadable` reconcile outcome renders as `(failed) {<token>}` at `warning` severity with the walk's cause. Feature, catalog and unit pins were updated to match.

What was verified clean:

- **Exhaustiveness.** All three notify switches (`applyOutcomeToBlock`, `applyPluginOutcomeToBlock`, and the `Extract<>` kind list) name the new kind. The WR-03 return-type mechanism holds, and `npx tsc --noEmit` exits 0. The mapped type in `notify.test.ts` (`[K in PerEntryOutcome["kind"]]`) forces a row for the new kind.
- **Other `PerEntryOutcome` consumers.** `failedRowCause`, `outcomeSubject`, `surfacePostCommitWarnings`, `surfaceMcpConfigNotices` and `isRefusedUninstall` need no new arm.
- **Severity, summary and tally.** These are computed from stamped row severity (`countRowsBySeverity`, `cascadeSeverity`), not from `status`. The row therefore lands in `warnings`, and the summary reads "needs attention".
- **JSON wire.** No new field. All three tokens are already in the wire `Reason` set (`notification-wire.ts:87-99`, `docs/json-output.md:845`). The catalog-UAT wire and contract tests pass at 292 states.
- **T-05-04.** Every cause is built from fixed phrases or the parser's field path (`dependencies.N: Invalid input`), without `{ cause }` chaining. Tokens are chosen by branch or by error class and errno, never by message text.
- **D-06.** The other failure-arm consumers ignore `reason`. These are `shared.ts:894` `DependencyDeclarationsUnreadableError`, `prune.ts`, `enable-disable.ts`, and `update-constraint-gate`.
- **Checks run.** Focused unit tests passed: dependency-index, notify, notify-stamp-coverage, catalog-uat, dependency-verdict, and the REC-05/D-05-07/D-05-16 tests in apply. `cucumber-js features/plugin/reconcile.feature` passed. `fallow dead-code` passed.

The findings below are about how truthful the new brace is, how it matches existing classifiers, and the dedupe rule now that the row is a warning.

Not a source finding: CONTEXT D-02 describes the row as `⚠ <plugin> ... (failed)`. The grammar renders every `failed` row with `⊘`, as the catalog and the tests show. The planning text is wrong; the code is fine.

## Warnings

### WR-01: An own manifest that "cannot be read" gets the brace `{invalid manifest}`, which contradicts its own cause line

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:261` (root cause in `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts:239` and `:282`)
**Issue:** `readManifestCandidate` returns `UNUSABLE` for every read error other than ENOENT/ENOTDIR, such as EACCES, EISDIR or EIO. Under `refuseUnusableOwnManifest`, that becomes `{ kind: "unusable", detail: "its own manifest is present but cannot be read" }`, and line 261 maps every `unusable` read to `"invalid manifest"`. The rendered row then contradicts itself, as `apply.test.ts:4980` pins:

```
⊘ broken (failed) {invalid manifest}
  cause: cannot read the dependencies of broken@mp: its own manifest is present but cannot be read
```

The same row family maps a marketplace manifest that "cannot be read" (EACCES) to `{unreadable manifest}` (`dependency-index.ts:215-221`). So the same phrase, "cannot be read", maps to two different tokens depending on which file failed. The catalog prose (`docs/output-catalog.md:3658`) says `{invalid manifest}` means the own manifest "is invalid", which is false for a permission or I/O error.

D-05 justifies this by saying the read's `unusable` arm "does not tell a damaged file from an unreadable one". That is true of the arm's output. It is not true of the producers: `readManifestCandidate`'s catch (an I/O failure) and `parseOwnManifest` (a parse or shape failure) are separate branches. A token chosen by the branch is not message classification, and the plan's own rule allows it ("chosen by the same branch that picks the cause phrase").
**Fix:** Make the producing branch carry the fault on the unusable arm, and pick the token from it:

```ts
// dependency-declaration-read.ts
type OwnManifestRead =
  | { readonly kind: "readable"; readonly dependencies: unknown }
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly fault: "unreadable" | "invalid" };
// readManifestCandidate catch -> { kind: "unusable", fault: "unreadable" }
// parseOwnManifest failures   -> { kind: "unusable", fault: "invalid" }
// refuse arm: detail "its own manifest cannot be read" vs "its own manifest is invalid",
//             plus a token field on the returned unusable arm
// dependency-index.ts:261 -> unreadableDeclarer(key, read.token ?? "invalid manifest", read.detail)
```

The minimum fix is to reword the fixed phrase so it does not contradict the brace (for example "its own manifest is present but unusable"), and to correct the catalog prose.

### WR-02: The token set ignores the existing cross-surface manifest classifier, so one marketplace gets different braces on different surfaces

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:208-221`
**Issue:** `shared/probe-classifiers.ts::narrowProbeError` is the shared classifier for a failed marketplace or plugin manifest load. It is used by `list`, `info`, `fetch`, `install`, `enable-disable` and the reconcile MCP migration, and it exists for "SC#1 manifest cross-surface parity" (D-48-B IN-02). For the same thrown value it answers:

| Error | `narrowProbeError` | `manifestLoadFailure` (new) |
| --- | --- | --- |
| `InvalidMarketplaceManifestError`, cause `SyntaxError` | `unparseable` | `invalid manifest` |
| `InvalidMarketplaceManifestError`, schema | `invalid manifest` | `invalid manifest` |
| ENOENT / ENOTDIR | `source missing` | `unreadable manifest` |
| EACCES / EPERM | `permission denied` | `unreadable manifest` |
| other | `unreadable` | `unreadable manifest` |

Example: a marketplace whose `marketplace.json` became malformed JSON. `list` or `info` shows its plugins as `{unparseable}`, while the next reload's stale-declarer row shows `{invalid manifest}`. That is the cross-surface drift D-48-B closed. D-05 was recorded without mentioning this classifier, so the divergence looks unintended rather than chosen. Before this change the walk produced no token, so no parity existed to break. This is the first row that exposes a token from this walk.
**Fix:** In `manifestLoadFailure`, use `narrowProbeError(err)` for the token and keep the fixed phrase. Widen `DeclarerReadFailure` to `"not in manifest" | ReturnType<typeof narrowProbeError> | "invalid manifest"`. If the narrower three-token set is intended, record why D-05 overrides D-48-B/SC#1 in CONTEXT and in the `DeclarerReadFailure` docblock. This is a user-facing choice, so the decision belongs to the user.

### WR-03: The RECON-04 dedupe also drops the warning when the declarer got a success row, and it misses backfill rows

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1351-1359` (also `:1476` vs `:1485`)
**Issue:** The predicate suppresses the stale-declarer row whenever any outcome in the pass names the same `(scope, marketplace, plugin)`. That includes success rows such as `plugin-disabled` (info), `plugin-installed` and `plugin-enabled`. The docblock (`:1333-1336`) justifies the dedupe only with failure rows ("its clone is gone, its install failed") and argues that "two rows for one plugin state the same fact twice".

That argument no longer holds now that the row carries its own warning fact: the dependency check did not run for the scope. A concrete case: the user sets `"demo@mp": { "enabled": false }`, and `demo`'s catalog dropped it. The disable proceeds, because the dependents guard excludes the target (`enable-disable.ts:1551`, `exclude: key`). The session shows only `◍ demo (disabled)` at info. Nothing says that no plugin in the scope was checked on this pass, which goes against D-08's "emitted every session while the fault lasts".

In the other direction, `reportUnreadableDeclarer` runs before `applyBackfillForScopeIsolated` (`:1476` then `:1485`). A backfill row for the same declarer (for example a backfill that fails `{not in manifest}` at error after an extension upgrade) is never seen by the dedupe, so the session can show an error row and a warning row for the same plugin. The predicate and the ordering predate this change, but REC-05 changes what the suppressed row means.
**Fix:** Limit the dedupe to outcomes that already report a failure for the plugin, or that removed it:

```ts
const SUPPRESSING = new Set<PerEntryOutcome["kind"]>([
  "plugin-install-failed", "plugin-uninstall-failed", "plugin-enable-failed",
  "plugin-disable-failed", "plugin-uninstalled",
]);
const reported = outcomes.some((o) => SUPPRESSING.has(o.kind) && o.scope === scope && "plugin" in o
  && o.plugin === plugin && o.marketplace === marketplace);
```

Also either move `reportUnreadableDeclarer` after the backfill step, or exclude backfilled declarers. If the broad predicate is intended, rewrite the docblock and D-08 to say that any row for the plugin suppresses the warning.

## Info

### IN-01: Bare `D-05` collides with the file's `D-05-NN` namespace

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:81`
**Issue:** `REC-05 / D-05:` cites the phase-local 17-CONTEXT decision. Every other decision cited in this file is `D-05-04`…`D-05-07`, so a reader will take `D-05` as a group heading of that older series. CONVENTIONS asks comments to cite durable IDs, and a bare phase-local `D-NN` stops meaning anything once the phase is archived.
**Fix:** Cite `REC-05` alone, as `apply.ts` and `notify.ts` do, or use a qualified decision ID.

### IN-02: The `reportUnreadableDeclarer` docblock still says the failed read "was of a plugin manifest"

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1325-1328`
**Issue:** The row can now explicitly name a marketplace-manifest fault (`{invalid manifest}` or `{unreadable manifest}` with "its marketplace manifest is …"). The sentence "the read that failed was of a plugin manifest" is now inaccurate in the block this change edited.
**Fix:** Change it to "the read that failed was of the declarer's manifest or its marketplace manifest, not of `state.json`".

### IN-03: No type-level proof for `PluginDeclarerUnreadableOutcome` in the paired test

**File:** `test/orchestrators/reconcile/apply-outcomes.test.ts` (pair of `apply-outcomes.ts:461-471`)
**Issue:** Every other exported outcome interface has positive `satisfies` proofs and `@ts-expect-error` negative proofs there. The new interface has neither. Its contract is that `reason` is narrowed to `DeclarerReadFailure` (so `unreadable` must be rejected, keeping the D-06 target token off this row) and that `cause` is required. Neither has a compile-time proof.
**Fix:** Add `void ({ kind: "plugin-declarer-unreadable", …, reason: "not in manifest", cause } satisfies PluginDeclarerUnreadableOutcome)`, plus negative cases for `reason: "unreadable"` and for a missing `cause`.

### IN-04: The JSON doc says the tally's `failures` counts "Failed rows", but a `(failed)` warning row counts under `warnings`

**File:** `docs/json-output.md:805`
**Issue:** `resolveTally` counts by stamped severity, so this new reconcile `failed` row adds to `warnings` (the features pin `tally failures 0 / warnings 1`). The doc's "Failed rows." / "Warning rows." wording is now wrong for this surface. The uninstall member row (D-05-13) already had the same gap.
**Fix:** Reword to "Rows at `error` severity." / "Rows at `warning` severity."

### IN-05: The user-facing load-time-check guide does not mention the new warning

**File:** `docs/dependency-resolution.md:235-275`
**Issue:** "The load-time check" section explains what every reload reports. It does not say that a plugin whose declarations cannot be read yields a `warning` row and skips the check for the whole scope on that pass (D-05-07, D-09). Only the output catalog documents it. A user who sees the new row every session gets no remedy text from the guide; the uninstall section at line 176 has remedy text for the command case.
**Fix:** Add a short paragraph and example row: the plugin keeps loading, the rest of the scope is not checked on that pass, and the repairs are `marketplace update`, uninstalling the plugin, or `marketplace remove`.

---

_Reviewed: 2026-10-23T13:12:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
