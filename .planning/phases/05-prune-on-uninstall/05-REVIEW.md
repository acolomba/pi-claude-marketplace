---
phase: 05-prune-on-uninstall
reviewed: 2026-09-17T00:25:20Z
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
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-17T00:25:20Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

The phase adds the dependents guard (PRUNE-05), the whole-scope orphan fixpoint and sweep (PRUNE-01..03), the two-block report (PRUNE-04), the `--prune` flag (FLAG-01), and the reconcile refusal path (D-05-16). The lock-closure discipline is sound on the paths I traced: the guard runs after both converge arms and before the cascade, a refusal throws with no `tx.save()`, the sweep runs only on the arm where the named plugin actually left disk, the member body is total (`cascadeUnstagePlugin` has a catch-all, `applyPartialCascadeFold`/`commitPluginRemoval`/`composePrunedRow` cannot throw), and there is exactly one save. NFR-5 holds: `uninstall.ts` and `dependency-index.ts` name no git surface and are now pinned by the network gate. The closed-set amendment lands in full (REASONS tail, `notify-reasons.ts` ledger, catalog states, fixtures, byte lock, enumeration pins).

Two defects are proven by execution rather than inferred. First, the sweep computes its removal order once and keeps going after a member fails, so a dependency declared only by the failed member is pruned while its declarer stays installed -- exactly the state the guard exists to forbid (CR-01). Second, the reconcile path processes its uninstall bucket in `state.json` insertion order, which is the order the install cascade writes (dependency before root), so dropping a plugin and its dependent from config together yields an `error`-severity refusal row and a second reload in the common case, contradicting the catalog's "the next pass removes both" (WR-01). The remaining findings concern the fail-closed claim (an unreadable own manifest with a silent marketplace entry reads as "declares nothing"), the truthfulness of the declarer's failure token on the target's row, and docs/test gaps.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A failed pruned member does not stop the sweep from pruning the dependencies only it declares

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:585-607`
**Issue:** `sweepOrphans` calls `pruneOrphans` once, up front, and then runs `removeDependencyMember` over the full precomputed order. `pruneOrphans` marks each batch as `gone` on the assumption that every member in it will be removed, so a later batch contains keys that were held only by earlier-batch members. When an earlier member's cascade fails (D-05-13: AG-5 foreign agents content, or any partial failure) its record stays in the snapshot -- it is still an installed plugin that still declares its dependencies -- yet the sweep proceeds to remove the later-batch keys it declares.

Reproduced against HEAD with the suite's own `PRUNE_SCOPE` seed (`x -> d1 -> d2@mp2`, plus orphan `o@mp2`) and `cascadeFailingFor("d1", AgentsUnstageFailureError)` on `uninstall x --prune`:

```text
● mp [project]
  ○ x v0.0.1 (uninstalled)
  ⊘ d1 v0.0.1 (failed) {source mismatch}
    cause: Agents unstage refused: foreign content

● mp2 [project]
  ○ o v0.0.1 (uninstalled) {dependency pruned}
  ○ d2 v0.0.1 (uninstalled) {dependency pruned}
```

Final inventory: `{"d1@mp": ["mp-d1-skill"]}` -- `d1` remains installed and declares `d2@mp2`, which is gone. Had the user typed `uninstall d2@mp2` directly, the guard would have refused it with `required by d1@mp`. PRUNE-03 ("never removes a plugin that a remaining installed plugin still declares") and the D-05-14 invariant are both violated on this path, and nothing later repairs it: reconcile does not re-run the closure for an installed record, and the record `d1` keeps is the shrunken or intact one D-05-13 describes. The three D-05-13 tests all fail the leaf `d2`, so none of them can observe this.
**Fix:** Recompute the orphan set after every member, seeding `removed` only with keys that actually left the snapshot, and stop when a pass makes no progress. `pruneOrphans` is pure and cheap, so the simplest correct shape is:

```ts
async function sweepOrphans(args: {...}): Promise<PrunedMember[]> {
  const { snapshot, primaryKey, ...removal } = args;
  const gone = new Set([primaryKey]);
  const attempted = new Set<string>();
  const pruned: PrunedMember[] = [];
  for (;;) {
    // A failed member is still an installed declarer, so it is NOT in `gone`;
    // every key it alone holds drops out of the next order (PRUNE-03).
    const next = pruneOrphans(snapshot.candidates, snapshot.index, gone).filter(
      (key) => !attempted.has(key),
    );
    const key = next[0];
    if (key === undefined) {
      return pruned;
    }

    attempted.add(key);
    const member = snapshot.candidates.find((candidate) => candidate.key === key);
    // `find` cannot miss: every key `pruneOrphans` returns is a candidate's key.
    if (member === undefined) {
      return pruned;
    }

    const result = await removeDependencyMember({ member, ...removal });
    if (result.removed) {
      gone.add(key);
    }

    pruned.push(result);
  }
}
```

Add a test to `tests/orchestrators/plugin/uninstall.test.ts` that fails `d1` and asserts `d2@mp2` stays recorded and staged (`recordedInventory` = `{ "d1@mp": [...], "d2@mp2": ["mp2-d2-skill"] }`), with `o@mp2` still pruned. Update the D-05-13 catalog prose, which currently says "every other member's removal STAND" without qualifying that a failed member's own dependencies are kept.

## Warnings

### WR-01: Reconcile processes uninstalls in `state.json` insertion order, so dropping a plugin together with its dependent produces a refusal row and needs a second reload

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:341-393` (also `orchestrators/reconcile/plan.ts:515-556`, `docs/output-catalog.md` state `reconcile-uninstall-refused-dependents`)
**Issue:** `applyPluginUninstalls` makes one sequential pass over `plan.pluginsToUninstall`, and `buildUninstallBucket` fills that list by `Object.entries(mpRecord.plugins)` -- record insertion order. The install cascade writes the dependency's record before the root's (post-order), and a later promotion to `explicit` (D-04-07) does not move it. So in the ordinary case -- `install app` cascaded `lib`, the user later `install lib`, both are in config, the user then drops both -- the pass tries `lib` first, the guard refuses it (`app` still declares it), then removes `app`. The report is an `error`-severity block with `⊘ lib (failed) {dependents remain}` next to `○ app (uninstalled)` and the tally `1 failure, 1 success`, and `lib` is only removed on the following reload.

Reproduced against HEAD by re-running the suite's D-05-16 case with `orphan` recorded before `keeper` (the cascade's order) and then emptying the config:

```text
A plugin operation has failed.

● mp [project]
  ⊘ orphan (failed) {dependents remain}
    cause: required by keeper@mp
  ○ keeper v1.0.0 (uninstalled)

Reconcile: 1 failure, 1 success
```

State after that pass still holds `orphan`. The committed test seeds `keeper` before `orphan`, which is the one order that converges in a single pass, so it does not discriminate this behavior, and the catalog's claim "by dropping the dependent too, after which the next pass removes both and the pass after it is silent" is false for the order the extension itself produces. The user did fix the config and is told the operation failed.
**Fix:** In `applyPluginUninstalls`, retry refused entries after the pass until no progress is made (a refusal is cheap: no artifact leaves disk and nothing is saved), and push only the final outcome per entry:

```ts
let pending = [...plan.pluginsToUninstall];
for (;;) {
  const refused: PlannedPluginUninstall[] = [];
  for (const op of pending) {
    const result = await runOne(op); // existing body, returning the outcome
    if (result.status === "failed" && result.error instanceof UninstallRefusedError) {
      refused.push(op);
      continue;
    }
    pushOutcome(op, result);
  }
  if (refused.length === 0 || refused.length === pending.length) {
    for (const op of refused) { pushOutcome(op, /* the stored refusal */); }
    return;
  }
  pending = refused;
}
```

Alternatively order the bucket dependents-first using the same declaration index, but a retry loop needs no second index build and is robust to a declarer outside the bucket. Either way, flip the committed D-05-16 test's seed order (or add a second case) so the test plants the order the cascade produces, and correct the catalog sentence.

### WR-02: The fail-closed guard reads an unreadable own manifest as "declares nothing" when the marketplace entry is silent

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:143-158` (via `dependency-declaration-read.ts:256-268`)
**Issue:** The module header (lines 23-28) and `docs/dependency-resolution.md` ("A declaration cannot be read when ... its manifest is unreadable ... the uninstall is refused") promise that an unreadable declarer never reads as "declares nothing". The index only fails closed on three arms: the *marketplace* manifest fails to load, the entry is absent, or the parsed declaration is unusable. The plugin's OWN manifest being present-but-unusable (corrupt JSON, non-object payload, EACCES on `plugin.json`) collapses to `NOT_READABLE` in `readManifestCandidate`/`parseOwnManifest`, and `readDependencyDeclaration` then answers from `entry.dependencies`; when the entry carries no `dependencies` key, `parseDeclaredDependencies(undefined)` returns `{ ok: true, dependencies: [] }`. The record is indexed as holding nothing, and its real dependencies become uninstallable and prunable. D-01-07 documents that fallback for the *install* read, but D-05-07 sets a stricter bar for deletion ("deleting on incomplete information is the one outcome this phase must never produce"), and the index reuses the install read without distinguishing "absent" from "present but unusable".
**Fix:** Surface the distinction the read already computes internally. Give `OwnManifestRead` a third arm (`{ kind: "unusable" }`) returned by `readManifestCandidate` for parse failures and non-absence errno codes, and let `readDependencyDeclaration` return a `DeclarationLookupResult` `unusable` arm for it (the install cascade may keep the entry fallback via a flag or a second exported reader; the guard must not). In `readRecordDeclarations`, map that arm to `unreadableDeclarer(key, "unparseable", "own manifest could not be read")`. Add a `dependency-index.test.ts` case that plants a corrupt `plugin.json` beside a silent entry and asserts `ok: false`. If the operator instead accepts the entry fallback as the deliberate answer, the module header and the docs paragraph must say so ("its marketplace manifest is unreadable", not "its manifest").

### WR-03: The declarer's read-failure token is stamped on the target's row, where it makes a false claim about the target

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:252-254` (rendered via `emitCascadeFailure`, catalog state `refused-declarer-unreadable`)
**Issue:** `assertNoDependents` throws `UninstallRefusedError(result.reason, ...)` with `result.reason` being the *declarer's* token, so the refusal renders as `⊘ helper v1.0.0 (failed) {not in manifest}` when it is `other@mp` that is unlisted, or `{invalid manifest}` / `{source missing}` / `{permission denied}` when it is some other record whose marketplace manifest failed. Under the project's row grammar the brace states a fact about the row's subject; `helper` IS in its manifest, and every list/info surface would say so. The cause line corrects it, but the token is what the summary, the severity fold and any consumer that reads `outcome.reason` (the reconcile projection reads only `reason`; the catalog states that the cause is the only carrier) see. On the reconcile path the row `⊘ helper (failed) {not in manifest}` recurs on every reload with no version and no way to tell it from a genuinely unlisted `helper` other than the trailer. D-05-07 left the token choice to the planner ("an existing reason ... where it fits"); none of the existing members fit a row whose subject is the target.
**Fix:** Either (a) amend the closed set once more with a token whose subject is the target -- e.g. `dependents unknown` beside `dependents remain`, same cause-line contract naming the unreadable declarer -- with the full ten-surface amendment; or (b) if a new token is refused, at minimum keep the declarer's token out of `reason` and use the D-47-B default `unreadable` (the existing "we could not read on-disk state" member) so the row at least makes no positive claim about the target's manifest, and re-lock the catalog bytes. Update `dependency-index.ts`'s `ScopeDeclarationIndexResult` doc and the `refused-declarer-unreadable` catalog prose to match whichever is chosen.

### WR-04: The docs omit the simplest remedy for an unreadable declarer and point at one that may itself be refused

**File:** `docs/dependency-resolution.md` (section "Removing a plugin other plugins need", the paragraph beginning "The check reads the declarations"), `docs/output-catalog.md` state `refused-declarer-unreadable`
**Issue:** Both say the remedy for a declarer that cannot be read is `marketplace update <name>` or `marketplace remove <name>`. `marketplace update` cannot re-list a plugin its upstream removed (the most common way a record becomes "not in manifest"), and `marketplace remove` tears down every plugin in that marketplace. The remedy the guard itself makes available is never mentioned: `uninstall <unreadable-plugin>@<marketplace>` succeeds, because the target is excluded from the index (`dependency-index.ts:173`), and the guard then passes for everything else. The docs' own "two unlisted plugins refuse each other" paragraph is also solved by that command, not only by `marketplace remove`.
**Fix:** In both places name `uninstall <plugin>@<marketplace>` on the unreadable record as the first remedy, and keep `marketplace update`/`remove` as the alternatives when the record should stay.

## Info

### IN-01: `prune` in orchestrated mode removes records silently

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:1062-1074, 1182-1188`
**Issue:** `UninstallPluginOptions.prune` is available to the orchestrated caller, and nothing refuses it there; the sweep would run, `finalizePrunedMembers` would clean up, and the orchestrated arm returns only the primary's `{ status: "uninstalled" }`, discarding `prune.members`. Today no orchestrated caller sets it (D-05-08), so this is latent, but the type contract leaves a path where removals happen unreported.
**Fix:** Gate the sweep on `opts.prune === true && !orchestrated`, or narrow the option type so the orchestrated overload cannot carry `prune`.

### IN-02: `prune` wrapper object is unnecessary and its comment states a false rationale

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:966-969`
**Issue:** `const prune = { members: [] as PrunedMember[] }` with "Object form so the post-guard reads see the closure's writes rather than the initializer". A `const members: PrunedMember[] = []` pushed into inside the closure is the same reference outside it; no wrapper is needed and the comment gives a reason that does not hold.
**Fix:** `const prunedMembers: PrunedMember[] = [];` and drop the comment.

### IN-03: `IndexedRecord` repeats the `MarketplaceStateRecord` alias defined above it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:54, 63-67`
**Issue:** `MarketplaceStateRecord` is declared at line 54 and then `IndexedRecord.marketplace` and `.record` spell out `ExtensionState["marketplaces"][string]` again.
**Fix:** Use the alias: `readonly marketplace: MarketplaceStateRecord; readonly record: MarketplaceStateRecord["plugins"][string];`.

### IN-04: The dependents guard is bypassed by marketplace removal (typed and config-driven)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (marketplace removal arm), `orchestrators/marketplace/remove.ts`
**Issue:** `removeMarketplace` cascades every plugin in the marketplace through `cascadeUnstagePlugin` directly, so a plugin in another marketplace that declares `dep@removed-mp` keeps a dangling declaration. The docs acknowledge this ("`marketplace remove` is the exit, because it does not run this check"), so it is a known, documented gap rather than a defect of this phase; recording it so D-05-16's "one behavior at both entry points" is not read as covering marketplace drops.
**Fix:** None required now; carry to BACKLOG.md as a follow-up if cross-marketplace declarations are expected in practice.

---

_Reviewed: 2026-09-17T00:25:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
