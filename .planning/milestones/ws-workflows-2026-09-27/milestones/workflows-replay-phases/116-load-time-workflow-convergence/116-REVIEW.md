---
phase: 116-load-time-workflow-convergence
reviewed: 2026-09-09T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - docs/output-catalog.md
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/index.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/shared/notify.test.ts
findings:
  critical: 2
  warning: 9
  info: 5
  total: 16
status: issues_found
---

# Phase 116: Code Review Report

**Reviewed:** 2026-09-09
**Depth:** deep (cross-file: import graph, producer/consumer chains for `PluginBackfilledOutcome`, call chain `applyReconcile -> applyBackfillForScopeIsolated -> scanForceInstalledBackfills -> maybeBackfillPlugin -> reinstallPlugin`)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The production change is small — one deleted early return in `backfillOnePluginIsolated`, one new closed-set `REASONS` member, and a reordered `reasons` prelude in `backfilledRowFromOutcome` — but deleting that guard changes the *population* the load-time scan walks from "records the extension already knows are degraded" to "every recorded plugin in the scope". Most of the defects below follow from that widening rather than from the notification work.

Verified and found sound:

- **`backfilledRowFromOutcome`'s unconditional `reasons` (prompt item 1).** `plugin-backfilled` has exactly one producer repo-wide (`backfill.ts:409`), reached through exactly one consumer (`applyPluginOutcomeToBlock`, `reconcile/notify.ts:789`). The prelude at `reconcile/notify.ts:618-626` is unconditional, so `reasons.length > 0` was provably always true and dropping the spread guard is safe for every reachable caller. No other module can construct the outcome.
- **Guard ordering after the deletion (prompt item 2).** `isRecordedButDisabled` then `alreadyTouched` are both pure benign-skip predicates returning `false`; their relative order is not observable. `hasForceInstalledPlugin` and `isRecordedButDisabled` are byte-identical to before.
- **The reinstall gate.** `reinstallPlugin` resolves through `requirePartialInstallable` unconditionally (`reinstall.ts:1224`), so widening the population cannot produce a `not-installable` throw for a formerly-clean record. The "clean record hits a strict gate" failure mode I looked for does not exist.
- **Closed-set plumbing.** `REASONS`, `CommandPrivateReason`, `_ReasonsCoverageProof`, `COMPAT-01`, the length locks and the catalog count are all consistent at 46; there is no render-time reason allowlist that would reject the new token.

What follows are the defects.

## Critical Issues

### CR-01: The widened scan turns an unreadable marketplace manifest into a permanent, per-plugin, every-load `(failed)` cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:275-319` (the deleted `record.compatibility.installable` early return), with `:101-103` and `:307-318`

**Issue:**
Before this phase, a record with `compatibility.installable === true` returned at the top of `backfillOnePluginIsolated` and its marketplace manifest was never read. Now every enabled record reaches `maybeBackfillPlugin -> resolveRecordedPluginOffline -> loadMarketplaceManifest(mp.manifestPath)`. `manifest-cache.ts` treats a `stat` failure as a pure miss (its D-02), so a missing / unreadable / corrupt manifest throws straight through per plugin. Each throw is caught at `backfill.ts:309`, pushed as a `plugin-install-failed` row, and returns `true`, which propagates to `anyFailure` and makes `applyBackfillForScope` return at `:101-103` **without stamping the version**. The gate therefore stays open forever.

Net effect for a scope whose marketplace source directory was deleted or became unreadable, with N recorded plugins under it: N `⊘ <plugin> (failed) {unreadable}` rows in the applied cascade **on every single reload, permanently**, with no convergence path. Pre-change this was bounded to the (usually zero) partially-installed records under that marketplace.

This is not speculative — the phase's own tests document both halves:

- `tests/orchestrators/reconcile/backfill.test.ts:819` ("reads the same poisoned manifest when the record is enabled, and holds the gate open") asserts exactly this shape for an `installable: true` record: one `plugin-install-failed` row *and* `loadState(...)` deep-equal to the seeded state, i.e. the stamp withheld. Under the pre-change code that same fixture produced zero rows and a landed stamp.
- `tests/index.test.ts:479-488` states the consequence in prose: "the scan that follows re-resolves this record against a `marketplaceRoot` no case here creates -- surfacing a failure row and one extra cascade emission."

This violates the load-time silence contract the same subsystem enforces elsewhere (`apply.ts:805-808`, NFR-2 / A4 / RECON-05) and the retry-safety expectation of the SF-02 "keep the gate open so the next load retries" design, which assumes the failure is transient. A deleted source tree is not transient.

**Fix:** Separate "this record was a promotion candidate whose re-materialize failed" from "this record could not even be resolved". The resolve-time throw should not be treated as a promotion failure for a record that had nothing to promote. Concretely, classify at the resolve boundary rather than at the outer catch:

```ts
// backfill.ts
async function backfillOnePluginIsolated(...): Promise<boolean> {
  ...
  try {
    return await maybeBackfillPlugin(opts, scope, marketplace, mp, plugin, record, outcomes);
  } catch (err) {
    if (err instanceof ManifestResolveError) {
      // WCONV-01: the widened population reaches manifests that no promotion
      // candidate would have. An unresolvable manifest is not a failed
      // promotion -- surface nothing and let the gate close, exactly as an
      // absent entry does (resolveRecordedPluginOffline -> undefined).
      return false;
    }
    outcomes.push({ kind: "plugin-install-failed", scope, marketplace, plugin,
                    reason: classifyOrchestratorThrow(err) });
    return true;
  }
}
```

(Wrapping the `loadMarketplaceManifest` call in `resolveRecordedPluginOffline` in a typed `ManifestResolveError` keeps the project's `instanceof`-narrowing convention and keeps a genuine re-materialize failure — the SF-01 `failed` partition — on the existing gate-open path.) If the team prefers to keep surfacing the row, the gate must still close after it, or the row must be emitted once and then suppressed, otherwise the cascade never converges.

### CR-02: A load-time backfill can flip a clean record to partially-installed and unstage working components, bypassing the `--partial` consent rule the update path enforces

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:359-433` (reached now that the `installable` filter is gone), with `orchestrators/plugin/reinstall.ts:1224` and `reinstall.ts:1548-1558`

**Issue:**
`maybeBackfillPlugin` promotes on `supportedSetGrew(record.compatibility.supported, resolved.supported)` alone. Nothing checks whether the *unsupported* side also moved. A record that is currently `installable: true` can re-resolve `partially-available` while its supported set strictly grew — for example the extension gains `workflows` support (a kind that was previously invisible, so absent from both halves of `compatibility`) in the same release that tightens detection of an unsupported kind, or a path-source plugin tree is edited to add both a `workflows/` directory and an unsupported declaration. Growth is `true`, so:

1. `reinstallPlugin` is invoked (`backfill.ts:365`), admitted by `requirePartialInstallable` (`reinstall.ts:1224`);
2. `replaceAll(handles, ...)` replaces the staged artifact set with the newly-resolved one, so components that dropped out of `supported` are unstaged;
3. `updateStateRecord` persists `installable: installable.state === "installable"` (`reinstall.ts:1554`), flipping the record to `installable: false` with the new `unsupported` list.

The project already has an explicit, documented rule against exactly this transition on the update path — `docs/output-catalog.md:1343`: *"a disabled record that is still CLEAN is NOT admitted this way; it renders the `(partially-upgradable)` decline row instead, because flipping a clean record to degraded is a consent the user has not given."* The backfill now performs that same flip **at load time, on a reload the user did not initiate, with no flag and no prompt**, and removes working artifacts while doing it. The `◉ (partially-installed) {components now supported, ...}` row discloses the result after the fact, at `info` severity.

Reachability requires a specific future extension change (or an edited path-source plugin tree) plus an open version gate; it is not reachable on today's constant. But the widening is what makes it reachable at all — the deleted guard made this combination impossible, because a clean record was never scanned.

**Fix:** Make the promotion gate refuse an unconsented degrade, mirroring the update path's stance:

```ts
// maybeBackfillPlugin, after the growth test
if (record.compatibility.installable && resolved.state !== "installable") {
  // WCONV-01 / consent parity with update's WR-01: promoting a CLEAN record
  // into a degraded one drops components the user never agreed to lose.
  // Benign skip -- no row, gate may still close.
  return false;
}
```

A record that is already `installable: false` keeps today's behaviour (it was installed under `--partial`, so the consent exists).

## Warnings

### WR-01: `backfill.ts:422` comment asserts a brace-less `(installed)` row that this phase deleted

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:419-423`

**Issue:** The comment reads "The `installable` arm projects to the brace-less `(installed)` row, so its unsupported set is empty." As of `reconcile/notify.ts:628-639` the `installable` arm is *never* brace-less — the WCONV-03 marker is unconditional. This is precisely the class of stale comment the phase brief asked to be checked for, and it is inside one of the two production files changed.

**Fix:** "The `installable` arm projects to the `(installed)` row, whose brace holds the convergence marker alone (WCONV-03), so its unsupported set is empty."

### WR-02: Four cross-file comments still describe the deleted filter or the deleted brace-less shape

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:180`; `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:282`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:116`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:146-147`

**Issue:** These sit outside the 14-file scope but were falsified by it — deep review is where they surface:

- `apply.ts:180` — "carry the loaded state snapshot out so applyBackfillForScope can read its stamp + **scan its partially-installed plugins**".
- `types.ts:282` — same sentence on `ScopeReadResult.state`.
- `apply-outcomes.ts:116` — "a **partially-installed plugin** is re-resolved offline (NFR-5)".
- `apply-outcomes.ts:146-147` — "Empty on a fully-promoted (`installable`) backfill, where the row drops to the **brace-less** `(installed)` projection."

The phase restated 12 comment sites inside `backfill.ts` but did not follow the same claim into the three sibling modules that repeat it. A reader arriving at `ScopeReadResult.state` is told the scan is filtered when it is not.

**Fix:** Restate all four in the widened present tense, matching the `backfill.ts:188-199` wording, and drop "brace-less" from `apply-outcomes.ts:147`.

### WR-03: `scanForceInstalledBackfills` and `hasForceInstalledPlugin` are named for a filter that no longer exists

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:227` (exported), `:175`

**Issue:** The phase brief's rule was "no comment now describes a filter that no longer exists". The *names* do. `scanForceInstalledBackfills` is an exported symbol whose own doc comment (`:188`) has to open by contradicting it — "scan EVERY plugin in the read-pass snapshot". Names outlive comments and this one is part of the module's public surface (`backfill.test.ts` imports it). `hasForceInstalledPlugin` is at least still accurate for the predicate itself, but its call site at `:87` now reads as though it gates the scan population, which it does not.

**Fix:** Rename to `scanRecordedBackfills` (or `scanBackfillCandidates`) and `hasPartiallyInstalledPlugin`, updating the two test import sites. This is the cheapest edit in the review and removes the strongest remaining false signal about the population.

### WR-04: `hasForceInstalledPlugin` decides nothing on the production path; the guard reduces to `!stateExisted`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:87`, `:161-185`

**Issue:** The D-116-04 comment added by this phase argues the predicate is "deliberately narrower than the population the scan itself walks", and it is correct that this is safe. What it does not say is that the predicate is **constant `false`** on the production path it guards: `apply.ts:108-115` probes `stateJsonPath` before the lock, and when that probe is false `with-state-guard.ts` hands back `loadState`'s `DEFAULT_STATE`, whose `marketplaces` map is empty — so the loop at `:176-182` never executes. The only way it returns `true` is a cross-process TOCTOU window between the probe and the lock.

That is a defensible reason to keep it, but the comment justifies the wrong property. A reader is told "narrower on purpose"; the actual property is "vacuous except in a race window". The distinction matters because the next person who widens the population will read this comment as permission to widen the predicate too, and discover it changes nothing.

**Fix:** Say what it is: `if (!readResult.stateExisted && !hasPartiallyInstalledPlugin(state))` guards only the TOCTOU window in which another process created `state.json` between `apply.ts`'s `pathExists` probe and the guard's `loadState`. Name that window in the comment, and drop the "deliberately narrower than the population" framing, which invites the wrong conclusion.

### WR-05: The `tests/index.test.ts` repair suppresses the new load-time behaviour instead of asserting it

**File:** `tests/index.test.ts:479-497` (`seedEnabledPlugin`), consumed at `:617`, `:668`, `:704`, `:737`

**Issue:** Four extension-entry cases went red because the widened scan reached a fixture whose `marketplaceRoot` (`<cwd>/mp-src`) is never created. The repair stamps `lastReconciledExtensionVersion: EXTENSION_VERSION` into the seed, closing the gate so the scan never runs.

The change does not weaken what those four cases *assert* — they are PATH-plumbing cases, and pre-change the same records were skipped by the deleted `installable` filter, so the fixture restores the prior effective coverage. That part is fine, and the fixture's own doc comment is honest about the mechanism.

What it does do is remove the only place in the suite where the extension entry point observed a reconcile over a record whose marketplace source is absent — which is exactly the CR-01 shape. The red test was a true signal about product behaviour and was answered by silencing the surface rather than by deciding what that surface should do. There is now no case at the `index.ts` layer that pins the answer either way.

**Fix:** Keep the stamped seed for the four PATH cases (correct — they should be steady-state), and add one case that deliberately leaves the stamp absent over the same seed, asserting the intended load-time answer once CR-01 is resolved.

### WR-06: The backfilled `(installed)` row reports an absent companion at `info` where the install row reports it at `warning`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:627`; catalogued at `docs/output-catalog.md:2467-2473` (`backfill-installed-workflow-engine-absent`)

**Issue:** `severity = malformed.length > 0 ? "warning" : "info"` — the companion probe is never consulted, so a backfilled row that stages a workflow into a session with no host workflow engine renders `● hello v1.0.0 (installed) {components now supported, requires pi-dynamic-workflows}` at `info`. The standalone install row stamps `warning` for the same fact via `companionSeverity` (`notify-reasons.ts:96-109`).

Under the project's tri-state severity model (`info` = desired state reached; `warning` = carried out but short), this row is *carried out but short*: the workflow is staged and cannot run. The catalog prose justifies `info` by parity with the load-time enable arm, which is a real precedent — but the enable arm is user-initiated, so the user is looking at the screen. This row appears on a reload nobody asked for, which makes under-reporting worse here, not better. The phase created a new catalog state to pin these exact bytes, so the divergence is now contractual.

**Fix:** Either route the backfilled arms through `companionSeverity(...)` with the same probe the install row uses, or record the divergence as an explicit decision (a `SEV-` / `D-116-` ID) in `backfilledRowFromOutcome`'s doc block rather than only in catalog prose, so the next reader does not read it as an oversight.

### WR-07: The new RECON-04 test's rationale contradicts `reinstall.ts` and overstates what the dedupe protects

**File:** `tests/orchestrators/reconcile/backfill.test.ts:1529-1535`

**Issue:** The comment claims: *"Only the already-touched dedupe stands between the widened scan and a re-materialize, and the re-materialize writes `enabled: true` unconditionally -- so without the dedupe the scan would reverse the user's own decision at load time (ENBL-08)."*

That is false. `runLockedReinstall` re-reads fresh state under its own lock and refuses a disabled record at `reinstall.ts:925-938`, returning `partition: "skipped"` with `already disabled`. `maybeBackfillPlugin`'s own comment (`backfill.ts:377-383`) states this correctly, for exactly the cross-process case this test simulates. So the dedupe is a **single-emit** guard (RECON-04), not the last line of defence against an enable reversal.

A test whose stated rationale is wrong is worse than one with no rationale: the next person to touch the dedupe will believe removing it re-enables disabled plugins, and will either leave dead belt-and-braces in place or, on discovering the claim is false, distrust the case entirely.

**Fix:** Restate to what the case actually measures — no second row and no redundant re-materialize over a transition the same load already applied (RECON-04) — and cross-reference `reinstall.ts:925-938` as the independent ENBL-08 guard, mirroring `backfill.ts:377-383`.

### WR-08: The WCONV-01 integration case never asserts the marker it exists to prove

**File:** `tests/integration/workflow-kind-inversion.test.ts:448`

**Issue:** The end-to-end convergence case asserts `assert.notDeepStrictEqual(first.notifications, [])` — "something was emitted". The phase's user-visible deliverable is that a convergence row is distinguishable from a fresh install, and the fully-promoted arm's marker is the only thing that distinguishes them. This case drives the real `applyReconcile -> backfill -> projection -> notify` chain and is the only test that does; it then declines to look at the bytes.

The marker is covered by `reconcile/notify.test.ts:174-183` (hand-built outcome into the pure projection) and by `catalog-uat.test.ts:5404-5430` (hand-built message into the renderer). Neither exercises the producer. A regression that stopped `backfill.ts:408-432` from producing a `plugin-backfilled` outcome — or produced one under a different kind — would leave all three green.

**Fix:**

```ts
assert.match(
  first.notifications.map((n) => n.message).join("\n"),
  /\(installed\) \{components now supported\}/,
);
```

### WR-09: The reason-count changelog is maintained by hand in four places with zero gates, and this phase added a fifth entry to it

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:16-36`; `extensions/pi-claude-marketplace/shared/notify.ts:82-83`; `tests/architecture/notify-closed-set-locks.test.ts:29` (title) and `:31-59` (body comment); `docs/output-catalog.md:63`

**Issue:** The 37→38→39→41→43→44→43→44→45→46 narrative is a changelog embedded in a doc comment. The phase extended it, and — to its credit — added a sentence admitting the problem: "Neither gate reads a comment: the counts ... are prose, so nothing turns red when they fall behind." Having identified that the artefact is ungated, the change appends to it rather than removing it.

Git already holds this history, and the project's own comment policy is to keep decision IDs as traceability anchors, not running counts. The 46 now appears in four files and one test *title*; `COMPAT-01` and the length lock pin the tuple, which is the only thing that needs pinning.

**Fix:** Reduce the header to the invariant (append-only, order is catalog-stable, membership is pinned by `COMPAT-01` and the length lock) plus the per-member decision IDs already attached to each literal in `REASONS`. Drop the running arithmetic from all four sites; drop the count from the test title so it stops needing an edit per member.

## Info

### IN-01: `backfill.ts` header narrates code that no longer exists

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:8-12`

**Issue:** "It lived inside apply.ts and its two entry points were reached through `__test_` re-exports, while its tests already had a file of their own..." — a description of a prior arrangement, which `.claude/rules/typescript-comments.md` excludes. Pre-existing, untouched by this phase, and the phase touched the two lines directly above it. Flagged for the next sweep, not for this one.

**Fix:** Keep the FLOW-09 rationale for where the module sits; drop the account of where it used to sit.

### IN-02: `reinstall.ts` claims it has no reconcile-driven caller — `backfill.ts` is one

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:991-994`

**Issue:** "Reinstall is invoked by the user (both standalone and bulk-cascade paths are user-initiated); there is no orchestrated / reconcile-driven caller today." `backfill.ts:365` calls `reinstallPlugin({ ..., render: "none" })` from inside `applyReconcile`. The claim was already wrong before this phase; the widening makes it wrong for the whole recorded population rather than the degraded subset. It sits directly above the `maybeWritePluginConfigBack` deep-equal short-circuit, so a reader reasoning about whether a load-time path can write `claude-plugins.json` is misled at the one place that answers it.

**Fix:** Name `orchestrators/reconcile/backfill.ts` as the reconcile-driven caller and keep the deep-equal-short-circuit argument, which still holds (D-68-02 preserves the version, so the entry shape is stable).

### IN-03: Integration fixture hardcodes `schemaVersion: 1`

**File:** `tests/integration/workflow-kind-inversion.test.ts:124`

**Issue:** `seedWorkflowPlugin` calls `saveState(..., { schemaVersion: 1, ... })` after loading a state that is already at the current version. It works because the loader migrates, but the fixture is silently exercising the migration path in cases that are about workflow convergence. The sibling fixture in `tests/index.test.ts:493` uses `schemaVersion: 2`.

**Fix:** Seed the current schema version, or spread `...state` so the loaded version carries through.

### IN-04: `supportedSetGrew`'s length fast-path is duplicate-sensitive

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:470-477`

**Issue:** `if (resolved.length <= recorded.length) return false` compares array lengths, not set cardinalities. A `recorded` array containing a duplicate kind would suppress a legitimate promotion. The resolver pushes each kind once today, so this is latent rather than live.

**Fix:** Compare `new Set(resolved).size` against `new Set(recorded).size`, or drop the fast path — the `every` below is already the whole test.

### IN-05: `alreadyTouched` uses a space delimiter where the sibling key uses NUL

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:236`, `:303`

**Issue:** `` `${o.marketplace} ${o.plugin}` `` can collide two distinct pairs if either name could contain a space; `forceInstallKey` in the same subsystem (`reconcile/notify.ts:269-271`) uses ` ` explicitly for that reason. Both sides of the backfill key are built identically, so the failure mode is an over-eager skip (safe) rather than a missed dedupe, and safe-name assertions make it unreachable in practice. Noted only because the widened population makes this key load-bearing for far more plugins than before.

**Fix:** Reuse the NUL-delimited convention for consistency with the sibling key.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
