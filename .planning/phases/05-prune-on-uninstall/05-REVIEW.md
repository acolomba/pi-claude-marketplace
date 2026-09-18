---
phase: 05-prune-on-uninstall
reviewed: 2026-09-17T01:11:06Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-orphans.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - README.md
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts
  - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/dependency-orphans.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/router.test.ts
  - tests/orchestrators/plugin/dependency-index.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
status: clean
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-17T01:11:06Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** clean

## Summary

Re-review (iteration 2) of the prune-on-uninstall phase after the five fixer commits `50e43272`, `7afaece9`, `8780a9b6`, `d3e3405f`, `1fd73b5d`. Every previously reported Critical and Warning is resolved against the current source, and neither fix introduced a new defect that I could prove.

**CR-01 (failed member's dependencies pruned)** is fixed correctly, and by a different shape than the one the previous review suggested. The fixer's objection to the suggested per-member `pruneOrphans` recompute is right: `pruneOrphans` marks a whole batch gone on the assumption every member goes, so re-running it after a failure would still return the failed member's dependencies. The applied fix keeps the precomputed order and re-checks `isHeldBy(snapshot.index, gone, member.key)` immediately before each removal, with `gone` seeded only with the primary key and grown only by keys whose `removed` is true (`uninstall.ts:598-618`). I traced the invariant the fix relies on: a key lands in batch N of `pruneOrphans` only when every holder of it is in `removed` or in batches 1..N-1, explicit holders keep a key out of every batch, and index keys and candidate keys come from the same walk -- so every holder of a key does precede it in the order, the check is exact when it runs, and a chain or diamond behind a failed member is skipped transitively because a skipped member is never added to `gone`. `pruneOrphans` copies the seed set (`dependency-orphans.ts:115`), so the sweep's `gone` is not mutated by the order computation. The regression test (`uninstall.test.ts`, "PRUNE-03 / D-05-13: a failed member is still a declarer") plants exactly the previous review's reproduction and asserts `d2@mp2` stays recorded and staged while `o@mp2` is still pruned; it passes at HEAD. `isHeldBy` itself is a one-pass predicate with no fixpoint, no mutation, and four direct cases.

**WR-01 (reconcile refusal in cascade order)** is fixed by the retry loop in `apply.ts:423-448`. Termination is sound: a pass ends the loop when no entry was refused or when every pending entry was refused, and otherwise `pending` shrinks strictly. Only refusals (`plugin-uninstall-failed` with an `UninstallRefusedError` cause) are retried; cascade failures and converges are settled on first sight, and each entry contributes exactly one final outcome. The reconcile renderer sorts rows with `compareByNameThenScope`, so pushing refused outcomes after the others does not change the report. Each `uninstallPlugin` call still acquires and releases its own lock, so the retry does not nest guards. The regression test seeds `orphan` before `keeper` (the cascade's order), empties the config, and asserts a single-pass `2 successes` report with an empty record set; it passes at HEAD. One small inefficiency remains (IN-08).

**WR-02, WR-03, WR-04** were resolved with the alternative remedies the previous review offered, and the module header, the docs paragraphs, the catalog state, the fixture and the byte lock all agree with the code as it now stands. The two operator decisions the fixer explicitly left open are carried below as Info (IN-05, IN-06), together with the four Info items from iteration 1 that were out of the fixer's scope and are still present unchanged (IN-01..04), plus one prose defect the CR-01 docs edit introduced (IN-07).

NFR-5 still holds: neither `uninstall.ts` nor `dependency-index.ts` names a git surface, and both remain pinned by the network gate. The pattern scan for debug artifacts, loose equality, `as any` and empty catches is clean across the changed production files. I ran `tests/domain/dependency-orphans.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `tests/orchestrators/reconcile/apply.test.ts` and `tests/orchestrators/plugin/dependency-index.test.ts` at HEAD: 173 tests, 0 failures.

## Narrative Findings (AI reviewer)

No Critical or Warning findings remain.

## Info

### IN-01: `prune` in orchestrated mode removes records silently (carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:1082-1094, 1202-1208`
**Issue:** Unchanged. `UninstallPluginOptions.prune` is accepted on the orchestrated overload, the sweep is gated on `opts.prune === true` alone, and the orchestrated arm returns only the primary's `{ status: "uninstalled" }`, discarding `prune.members`. No orchestrated caller sets it today (D-05-08), so this is latent.
**Fix:** Gate the sweep on `opts.prune === true && !orchestrated`, or narrow the orchestrated overload's option type so it cannot carry `prune`.

### IN-02: `prune` wrapper object is unnecessary and its comment states a false rationale (carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:986-989`
**Issue:** Unchanged. `const prune = { members: [] as PrunedMember[] }` with "Object form so the post-guard reads see the closure's writes rather than the initializer". A `const members: PrunedMember[] = []` pushed into inside the closure is the same reference outside it.
**Fix:** `const prunedMembers: PrunedMember[] = [];` and drop the comment.

### IN-03: `IndexedRecord` repeats the `MarketplaceStateRecord` alias defined above it (carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:60, 69-73`
**Issue:** Unchanged. `MarketplaceStateRecord` is declared at line 60 and `IndexedRecord.marketplace` / `.record` spell out `ExtensionState["marketplaces"][string]` again.
**Fix:** `readonly marketplace: MarketplaceStateRecord; readonly record: MarketplaceStateRecord["plugins"][string];`

### IN-04: The dependents guard is bypassed by marketplace removal (carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (marketplace removal arm), `orchestrators/marketplace/remove.ts`
**Issue:** Unchanged and documented ("`marketplace remove` is the exit, because it does not run this check"). A plugin in another marketplace that declares `dep@removed-mp` keeps a dangling declaration after `marketplace remove`.
**Fix:** None required now; carry to BACKLOG.md if cross-marketplace declarations are expected in practice.

### IN-05: Operator decision left open by the WR-02 fix -- an unusable own manifest still falls back to the marketplace entry

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:30-36`, `docs/dependency-resolution.md` (paragraph "The check reads the declarations")
**Issue:** The fixer took the alternative remedy: the header and the docs now state the fallback honestly (a present-but-unusable own manifest is answered by the marketplace entry, and a silent entry reads "declares nothing"; fail-closed applies only where the entry cannot answer either). The code, the header and the docs agree, so nothing is misleading any more. What remains is the design question the fixer declined to decide: D-05-07's bar ("deleting on incomplete information is the one outcome this phase must never produce") is stricter than D-05-06's fallback for a corrupt `plugin.json` beside a silent entry. The header records that tightening it is a one-line predicate change.
**Fix:** Operator decision. If the stricter guard is wanted, add a `{ kind: "unusable" }` arm to `OwnManifestRead` consumed only by the index, map it to `unreadableDeclarer(key, ...)`, and add the corrupt-`plugin.json`-beside-silent-entry case to `dependency-index.test.ts`. Otherwise close as accepted.

### IN-06: Operator decision left open by the WR-03 fix -- `unreadable` is truthful but non-specific on the refused row

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:248-250`, `docs/output-catalog.md` state `refused-declarer-unreadable`
**Issue:** The refusal now renders `⊘ helper v1.0.0 (failed) {unreadable}` with the cause line naming the declarer and why. The token no longer makes a false claim about the target, which was the defect. It is also the same token the unclassified cascade-failure default uses (`narrowCascadeFailure`'s last return), so a consumer reading only `outcome.reason` cannot tell a declarer-read refusal from an unclassified unstage failure; the cause line is the discriminator, and on the reconcile surface it is carried (D-05-16). A dedicated `dependents unknown` token would be a closed-set amendment across ten surfaces.
**Fix:** Operator decision. Either accept `unreadable` as the truthful existing member (05-CONTEXT's stated preference) or amend the closed set with `dependents unknown` and re-lock the catalog bytes.

### IN-07: The CR-01 docs edit left a dangling modifier in the catalog's D-05-13 prose

**File:** `docs/output-catalog.md:1163` (state `prune-partial-failure`), `docs/dependency-resolution.md` (section "Pruning dependencies nothing needs", same sentence, correct there)
**Issue:** The inserted clause "The failed member is still an installed plugin that still declares its own dependencies, so the sweep keeps every dependency only it holds -- those records render no row, exactly as the guard would refuse them if named directly (PRUNE-03) --" now sits directly before "shrunk to the artifacts still on disk when the cascade dropped some before failing, or intact when foreign content refused the unstage." Read in order, "shrunk ... or intact" attaches to the kept dependency records, which are untouched; it describes the failed member's own record. `dependency-resolution.md` phrases the same fact without the ambiguity.
**Fix:** Move the inserted clause to after the "shrunk ... or intact" sentence, or make it its own sentence: "... with the failed member's record still present (NFR-3) -- shrunk to ... or intact when .... That member is still an installed plugin that still declares its own dependencies, so the sweep keeps every dependency only it holds; those records render no row, exactly as the guard would refuse them if named directly (PRUNE-03)."

### IN-08: The reconcile retry loop takes one extra no-op pass when a converged entry sits beside a refusal

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:436-447`
**Issue:** The no-progress test is `refused.length === pending.length`, but an entry whose outcome is `undefined` (the PU-5 converge) is neither refused nor counted as progress; it just drops out. With `pending = [A (converged), B (refused)]`, pass 1 yields `refused.length = 1 !== 2`, so B is retried in a second pass that rebuilds the declaration index and refuses again with the same outcome. The result is identical (the converge removed no declarer), so this is a wasted guard walk, not a wrong report, and the loop still terminates because `pending` shrinks.
**Fix:** Count progress as "an outcome was settled this pass" rather than by length: keep a `settled` counter incremented on the `outcomes.push(outcome)` branch and return when `refused.length === 0 || settled === 0`.

---

_Reviewed: 2026-09-17T01:11:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
