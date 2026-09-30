---
phase: 01-presentation-model
reviewed: 2026-09-30T00:00:00Z
depth: standard
files_reviewed: 182
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/edge/args-schema.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/check-unused-type-members.exceptions.json
  - scripts/notify-corpus.hook.mjs
  - scripts/notify-corpus.mjs
  - scripts/notify-corpus.negative.mjs
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-list.ts
  - tests/architecture/catalog-uat/fixtures/plugin-update.ts
  - tests/architecture/catalog-uat/fixture-types.ts
  - tests/architecture/catalog-uat/mock-pi.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/cross-surface-reason-parity.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/no-probe-in-workflows-bridge.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-will-reload-agreement.test.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/architecture/workflows-marker-coverage.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/notification-boundary.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/index.test.ts
  - tests/integration/concurrent-install-child.ts
  - tests/integration/fold-adoption.test.ts
  - tests/integration/hooks-cross-scope-reconcile.test.ts
  - tests/integration/ipc-child.ts
  - tests/integration/load-reconcile-race-child.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/integration/transaction-lifecycle-cascade.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.messaging.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.messaging.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.messaging.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/orchestrators/reconcile/types.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-run-seeds.ts
  - tests/shared/notification-run.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 182
**Status:** issues_found

## Summary

The review covered the run threading, the new resolve step, the text strategy,
the corpus tooling, and the rewritten suites. The production refactor holds up
under an arm-by-arm trace against the diff base:

- **D-05 holds.** `softDepStatus` has exactly one caller,
  `openNotificationRun` (`shared/notification-run.ts:22`). The run opens only
  in `edge/register.ts:135` and `index.ts:123`. All three severity stamps
  (`install-flow.ts:411`, `enable-disable.ts:1350`, `update-cascade.ts:194`)
  read `run.softDeps`, the same snapshot `resolveRows` composes markers from.
  Nested runs (import, reconcile, bootstrap, browse actions) receive the
  parent's run.
- **The byte parity holds.** Each of the 18 per-verb `markers` tables was
  checked against the old render arm it replaced. A status is `true` exactly
  where the old arm passed `dependencies.includes(...)` to `composeReasons`, and
  `CENTRAL_MARKER_POLICY` matches the old central switch.
  `resolveTally`/`formatNotificationText` reproduce
  `composeTally`/`foldTallyAndHint`/`composeWithSummary` segment for segment,
  including the empty-body and zero-success edges. The missing-arm floor still
  runs before the envelope reads severity. Cause, leak, rollback, and hint
  lines keep their order and indents.

No blocker was found. Both warnings are test-oracle gaps. The per-verb marker
policy is currently indistinguishable from the central table on every status
a producer can emit with `dependencies`. As a result, a wrapper that ignored
its context's policy would pass the owner suites, the catalog, and the corpus.

**Known item (list-flow WDEP-02 decoy):** accepted. `listPlugins` no longer
reads a tool inventory, so a `workflow` decoy tool at the list surface would
exercise nothing. The WDEP-01 discriminator is still owned where the inventory
is read: `tests/platform/pi-api.test.ts:388,396` (`softDepStatus`), plus
`tests/shared/notification-run.test.ts`, which pins that `openNotificationRun`
is `softDepStatus` over the inventory. `workflows-marker-coverage.test.ts`
keeps its seven-surface marker coverage with seeded snapshots and gains a
planted-offender gate for the single `softDepMarkers` call site.

## Structural Findings (fallow)

The fallow audit (repo scope vs main, `--max-crap 30`) reports 17 duplicate
blocks, 0 unused exports, 0 unused files, and 0 cycles. Each is checked
against this phase's hunks below:

| # | Location | Related | Disposition |
|---|----------|---------|-------------|
| 1-3 | `scripts/check-corresponding-tests.mjs:202-205` | `check-unused-type-members{,.audit}.mjs`, `check-workflow-install-scripts.mjs` | Out of scope (not in the review file list). Pre-existing. |
| 4, 6 | `orchestrators/plugin/shared.ts:292`, `:310` (intra-file) | same file | Pre-existing. This phase touched only lines 49-51 and 1268-1373 of the file. |
| 5 | `orchestrators/marketplace/update.messaging.ts:232` (intra-file) | same file | Pre-existing. No hunk near line 232. |
| 7 | `edge/handlers/plugin/install.ts:52` | `edge/handlers/plugin/update.ts` | Handler clone family. Accepted by the operator. |
| 8 | `edge/handlers/plugin/bootstrap.ts:37` | `edge/handlers/plugin/import.ts` | Handler clone family. Accepted by the operator. |
| 9, 14, 16 | `update.messaging.ts:81`, `enable-disable.messaging.ts:75`, `:104` | `enable-disable.messaging.ts`, `install.messaging.ts`, `fetch.messaging.ts` | `*.messaging.ts` render-map clones. Accepted by the operator (a later phase deletes the render arms). |
| 10 | `tests/architecture/catalog-uat/fixtures/plugin-list.ts:93` (intra-file) | same file | Test fixture. Pre-existing. |
| 11 | `orchestrators/plugin/reinstall.messaging.ts:375` | `orchestrators/reconcile/apply-outcomes.ts` | Pre-existing (`dependenciesFromOutcome`). The nearby hunk at 361 only removes lines. |
| 12 | `tests/integration/concurrent-install-child.ts:34` | `tests/integration/load-reconcile-race-child.ts` | Both children gained the same `runWithNothingLoaded()` edit. The clone predates this phase. |
| 13 | `orchestrators/plugin/info.ts:1727` (intra-file) | same file | Pre-existing. No hunk near line 1727. |
| 15 | `orchestrators/plugin/install-flow.ts:328` | `orchestrators/plugin/uninstall.ts` | Pre-existing. No hunk near line 328. |
| 17 | `orchestrators/plugin/enable-disable.ts:918` | `orchestrators/plugin/install-flow.ts` | Pre-existing. No hunk near line 918. |

The four `fallow-ignore-file` markers on `scripts/notify-corpus*.mjs` are
accepted and are not re-reported.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The context wrappers are only tested with markers on, so ignoring `context.markers` would pass every test

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:180,225,268,308` (tested at `tests/shared/notify-context.test.ts:420-497`)

**Issue:** The four wrappers are `notifyWithContext`, `notifyUpdateWithContext`,
`notifyUpdateNoOpWithContext`, and `notifyReconcileAppliedWithContext`. Each
must pass `context.markers` to the emitter. The only test of that wiring (the
D-12 loop at `notify-context.test.ts:467`) uses `markers: { installed: true }`
and expects the marker. This test cannot tell a correct wrapper from one that
passes `CENTRAL_MARKER_POLICY` or an all-`true` policy.

No other oracle closes the gap:

- `tests/shared/notification-dispatch.test.ts:5878` does test the "off"
  direction, but against `emitContextCascade` directly. It does not go through
  the wrappers.
- The per-verb tables agree with `CENTRAL_MARKER_POLICY` on every status a
  producer emits with `dependencies`. The one divergence, list's
  `partially-installed: false`, has no byte effect because list's producer
  never sets `dependencies` on that row, as `soft-dep-marker-policy.test.ts:14-17`
  says. The catalog and the wire corpus therefore render identically under
  either policy.

So a regression that drops the per-verb policy is invisible. That policy is the
data D-12 exists to carry and the seam Phase 2 extends. The first real
divergence would ship unguarded: for example, a verb that turns markers off on
a dependency-bearing status.

**Fix:** Add an "off" case beside the existing loop for every wrapper, so each
emitter entry proves it reads the context's policy:

```ts
test(`D-12: ${entry} suppresses markers its context's policy maps off`, () => {
  const harness = createHarness({ message: expectedMessageWithoutMarker });
  const context = {
    Messaging: { label: "Plugin inspect" },
    render: { installed: (row) => `${row.name} {${row.reasons.join(", ")}}` },
    markers: { installed: false },
  } satisfies CommandContext<"installed", PluginInstalledMessage>;
  // same rows (dependencies: ["agents"]) and a run with nothing loaded
  emit(harness, context, rows);
  verify(harness.ctx);
  verify(harness.ui);
});
```

### WR-02: The SC-5 marker-policy table does not check that it lists every context

**File:** `tests/architecture/soft-dep-marker-policy.test.ts:59-231`

**Issue:** The table is keyed by `name: keyof typeof DECLARED_MARKERS`.
`satisfies` only checks that each row names an existing key. It does not check
that every key has a row. It also does not check that `DECLARED_MARKERS` lists
every exported `CommandContext`. Two regressions therefore stay green:

- Deleting a row from the literal array, for example the `INSTALL_CONTEXT` row,
  removes that policy from SC-5 with no failure.
- A new `*_CONTEXT ... satisfies CommandContext` (a later phase adds more) whose
  author forgets to register it here is never stated as data.

The header says "a changed policy value turns exactly that row red". That is
true only for rows that are still present.

**Fix:** Assert totality in both directions. At minimum, compare the row names
to the keys:

```ts
test("SC-5: the table states every declared marker policy exactly once", () => {
  const stated = TABLE.map((row) => row.name).sort();
  assert.deepStrictEqual(stated, Object.keys(DECLARED_MARKERS).sort());
});
```

For the second direction, also derive the context set from source. Scan
`extensions/**/*.messaging.ts` for `as const satisfies CommandContext<` with
`filesMatching`, following the house planted-offender pattern. Then compare
that set with `DECLARED_MARKERS`.

## Info

### IN-01: Comments still describe render-time probes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1395-1397`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts:37`

**Issue:** Two comments describe behavior this phase removed:

- `update-swap.ts:1395` says "The renderer probes companion-loaded state via
  SoftDepProbe and emits `{requires ...}`". No renderer probes anymore. Resolve
  composes the markers from the run's snapshot.
- `marketplace/list.ts:37` says the run's "snapshot drives the markers".
  `marketplace list` renders only marketplace headers, and its `LIST_CONTEXT`
  policy is `{}`, so the snapshot drives nothing there.

The same stale wording ("the notify-time probe") also sits in
`orchestrators/plugin/update-row.ts:94-96`. That file is outside the review
list.

**Fix:** State the current mechanism: "resolveRows composes the markers from
the command run's snapshot under the context's marker policy (D-05, D-12)".
For marketplace list, say the run is threaded for the shared emitter signature
only.

### IN-02: `CommandProbes.probingEmissions` is a dead test member that describes surfaces that no longer exist

**File:** `tests/edge/register.test.ts:158-168,327`

**Issue:** The doc comment says `probingEmissions` counts "notifications from
surfaces that still probe the Pi handle once per emission". After this phase
no such surface exists, and every call site passes `probingEmissions: 0`. The
member tells a future reader that per-emission probing is still a supported
case in the count. That weakens the claim this helper is meant to pin: one
snapshot per command. It also narrates removed code, which the
`typescript-comments` policy forbids.

**Fix:** Delete the member and compute `toolReads = probes.runs * 3`. Or take
a plain `runs: number`.

### IN-03: Row composers accept unresolved producer rows structurally, so markers can be dropped silently

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:522-543` (`pluginRow`), `:552-570` (`partiallyInstalledRow`), `:600-618` (`installedLikeRow`)

**Issue:** `installedLikeRow` used to require
`p.dependencies: readonly Dependency[]`, so a caller could not render an
`(installed)` row without deciding its markers. The new parameter types are
structural subsets: `{ name; scope? }` plus `reasons: readonly Reason[]`. A raw
`PluginInstalledMessage` still satisfies them.

Today every caller is a `RenderFn` over `ResolvedRow`, so nothing is broken.
But a future caller that passes a producer row compiles cleanly and renders it
without its `{requires ...}` markers. D-13's guarantee ("arms receive final
reasons from resolve") is then enforced by convention, not by the type.

**Fix:** Type the `p` parameters as `ResolvedRow<...>` projections, or add a
brand to `ResolvedRowFacts.reasons`, so an unresolved row is a compile error at
the composer.

### IN-04: Corpus tooling fragilities

**File:** `scripts/notify-corpus.mjs:299-314`, `scripts/notify-corpus.hook.mjs:53-56`

**Issue:** There are two fragilities:

1. `parseCaptureArgs` collects every non-`--` token after `--files` as a test
   path. With `capture --files a.test.ts --out x.jsonl`, `x.jsonl` becomes a
   test path. `node --test` then fails on the missing file, and the capture
   aborts with a misleading "test run exited 1". The failure is loud, but the
   argument order matters without any warning.
2. The hook's rewrite, `\b([A-Za-z_$][\w$]*)\.ui\.notify\(`, handles only a
   bare-identifier receiver. `opts.ctx.ui.notify(` would become
   `opts.globalThis.__corpusNotify(ctx.ui, `, which throws at load. A call
   through a destructured `ui.notify(` would go unrecorded. IL-2 currently
   keeps every call as `ctx.ui.notify(` in one file, so neither case applies
   today. Still, D-01's "survives file splits and renames" holds only while
   that spelling holds.

**Fix:** Parse `--files` values only up to the next `--` flag. Anchor the hook
regex so that a member-access receiver is refused loudly, for example with a
negative lookbehind `(?<![\w$.])` plus a load-time assertion that the rewrite
count matches the literal `ui.notify(` count.

### IN-05: Resolve's read order is constrained by a test's getter-backed `kind`

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:127-130`; `tests/shared/notification-dispatch.test.ts:45-58,5256,6200`

**Issue:** `resolveEnvelope` documents that severity and the summary resolve
before the reload and tally facts because "the dispatch tests pin the bytes a
getter-backed `kind` yields under this read order". The fixture
`messageWithKindSequence(..., [...Array(17).fill("marketplace-not-added"), "marketplace-info"])`
returns a different `kind` on the 18th read. Production evaluation order is
therefore tied to an exact count of property reads. That count is an
implementation detail, not a contract. Any harmless refactor of resolve (one
more `message.kind` read, or caching it once) changes the pinned bytes. The
test would then fail for a reason that has nothing to do with output.

**Fix:** Reach those fallback branches with a structurally invalid message
instead of a read-counting getter. Or read `message.kind` once at the top of
`resolveEnvelope` and thread it, then re-pin the fallback cases against that.
Either way, remove the production comment that cites the test's read order.

---

_Reviewed: 2026-09-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
