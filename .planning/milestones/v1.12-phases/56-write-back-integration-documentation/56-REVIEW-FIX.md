---
phase: 56-write-back-integration-documentation
fixed_at: 2026-06-11T07:20:00Z
review_path: .planning/phases/56-write-back-integration-documentation/56-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 56: Code Review Fix Report

**Fixed at:** 2026-06-11T07:20:00Z
**Source review:** .planning/phases/56-write-back-integration-documentation/56-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (2 Critical, 7 Warning; Info findings excluded by
  `fix_scope: critical_warning`)
- Fixed: 9
- Skipped: 0

`npm run check` is green after all fixes (typecheck + ESLint + Prettier +
unit suite + 10 integration tests; the integration suite is the final
chained step and completed 10/10).

## Fixed Issues

### CR-01: Bare-form autoupdate flip clobbers all but the last marketplace's config write

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`,
`tests/architecture/config-state-consistency.test.ts`
**Commit:** 732c19e
**Applied fix:** `writeAutoupdateBack` now accumulates one
`BatchedConfigPatch` across the `changed` loop and issues a single
`writeBatchedConfigEntries` call (one `saveConfig`, all-or-nothing) instead
of N sequential `writeMarketplaceConfigEntry` calls against the same stale
snapshot. Added the two-marketplace bare-form regression test asserting BOTH
entries (autoupdate flag + synthesized verbatim source) survive in the
read-back config.

### CR-02: Cross-scope install (CMP-3 fallback) writes a dangling plugin declaration

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`,
`tests/architecture/config-state-consistency.test.ts`
**Commit:** 6199671
**Applied fix:** New `synthesizeUndeclaredMarketplaceSource` helper in
`plugin/shared.ts`: when the targeted config does not declare the
marketplace, it synthesizes `source` from the state record's verbatim
`source.raw` (returns `undefined` when already declared, or when no string
raw exists -- avoiding the WR-06(b) `saveConfig` invariant throw). Install
and enable/disable write-backs now use `writeBatchedConfigEntries` to land
the marketplace declaration AND the plugin key in one atomic patch under the
same lock. Added the architecture regression: user-scope add (seeded state)
+ project-scope install via the CMP-3 fallback, asserting
`planReconcile(projectMerged, projectState, "project")` is the empty plan
(no `marketplacesToRemove`, no dangling failed row).

### WR-01: Import skip path never repairs missing config declarations

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
**Commit:** ed5d9c6
**Applied fix:** `buildBatchedPatchForScope` now returns `{ ensure, repair }`
where repair carries `skippedExistingMarketplaces` /
`skippedExistingPlugins` candidates. Inside the lock,
`mergeEnsureAndRepairs` applies repair entries ONLY when the key is absent
from the loaded config (RECON-05 byte stability for the all-declared steady
state -- the post-pass skips the save entirely when nothing remains). A
previously failed post-pass now converges constructively on re-run instead
of leaving recorded-but-undeclared entries for the reconcile planner to tear
down. The misleading "self-heals on next reconcile" comment was corrected.

### WR-02: Delete write-backs are unconditional (rewrite/CREATE the config for a no-op)

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
**Commit:** 9d2829e
**Applied fix:** Uninstall's `deletePluginConfigEntry` call is gated on
`cfg.status === "valid"` AND the `plugin@marketplace` key being present in
the loaded targeted file. Remove's `commitFullRemove` short-circuits unless
the marketplace key OR any `@<marketplace>`-suffixed plugin key is declared.
Neither path can rewrite (mtime bump) or CREATE `claude-plugins.json` for a
semantic no-op anymore. `commitFullRemove`'s `cfg` parameter was retyped to
the real `ConfigLoadResult` union, removing the unsound cast (this also
addresses out-of-scope IN-01 as a byproduct of the gate needing the typed
narrow).

### WR-03: enable/disable idempotency reads state-side truth only

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** 7f67897
**Applied fix:** The idempotent arm now compares the requested `enable`
against the targeted config entry's EXPLICIT `enabled` value. When the
config carries the opposite explicit value (standalone mode only), the flip
is promoted to fresh-for-the-config-write: the `{ enabled }` patch (plus the
CR-02 marketplace declaration when undeclared) lands while state stays
untouched (no `tx.save()`, mtime stable) -- mirroring
`reclassifyByConfigTruth`'s promotion arm exactly, including the
missing-entry/missing-field "keep state-side classification" rule. Added a
regression test: state-enabled plugin + config `enabled:false` + `plugin
enable` lands `enabled:true` in config with state.json bytes unchanged.

### WR-04: CFG-03 abort re-saves state.json on install/uninstall

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`,
`tests/orchestrators/plugin/install.test.ts`,
`tests/orchestrators/plugin/uninstall.test.ts`
**Commit:** 818a84a
**Applied fix:** Both orchestrators converted from `withStateGuard`
(unconditional save on closure return) to `withLockedStateTransaction` with
explicit `tx.save()` on the mutating arms only. Abort arms (CFG-03 invalid
config, install marketplace-absent, uninstall PU-5 already-gone) now return
without touching state.json. Uninstall's non-AG-5 partial-cascade fold arm
(a real mutation) saves explicitly. The prior write-back-then-save ordering
is preserved on success arms, so a config write throw still discards the
state snapshot exactly as before. Existing CFG-03 tests strengthened to
assert state.json bytes AND mtime are unchanged on abort.

### WR-05: Fresh autoupdate flips still write the carved-out legacy `autoupdate` field into state.json

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`,
`extensions/pi-claude-marketplace/orchestrators/index.ts`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/index.ts`,
`tests/architecture/no-split-01-cast-reads.test.ts`,
`tests/orchestrators/marketplace/autoupdate.test.ts`
**Commit:** 73f5f78
**Applied fix:** `applyAutoupdateFlipInPlace` no longer assigns
`mut.autoupdate` -- it classifies only, and was renamed
`classifyAutoupdateFlip` so the name matches the contract (barrel exports
updated). `flipOneScope` dropped its `tx.save()` entirely: a flip never
rewrites state.json; the config write-back is the sole flip surface
(SPLIT-01). The architecture gate gained a sibling ASSIGNMENT-form pattern
(`/\.autoupdate\s*=(?!=)/`, empty allow-list) with its own synthetic
offender/benign walker test, so any future `.autoupdate =` write in an
orchestrator fails CI.

### WR-06: Per-name sequential saveConfig not failure-atomic; source-synthesis failure surfaces as lying `{not found}`

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`
**Commit:** 7c4b119
**Applied fix:** Part (a) -- mid-loop partial commits -- was already
resolved by the CR-01 single batched save (commit 732c19e). Part (b):
`writeAutoupdateBack` now skips an entry from the batch when the config
entry lacks `source` AND no string `source.raw` can be synthesized from the
state record, so `saveConfig`'s required-`source` invariant throw can no
longer masquerade as a `{not found}` row.

### WR-07: add.ts config write failure after the clone rename leaves an orphaned final clone

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`,
`tests/orchestrators/marketplace/add.test.ts`
**Commit:** 9a29f85
**Applied fix:** `runAddInGuard` wraps the write-back + `tx.save()` in a
try/catch: on throw after a github materialization, it runs
`cleanupStaging` on the committed `sources/<name>/` dir and appends any
cleanup leak to the rethrown error (MA-9 discipline). Retries no longer
wedge on MA-6 `{stale clone}`. The regression test forces an EACCES on the
config write (read-only scope root after a valid pre-load) and asserts the
final clone is removed and state is unpersisted; the test was verified to
FAIL against the pre-fix code.

## Notes for the developer

- **Pre-existing test-hygiene issue (not introduced by these fixes):**
  several non-hermetic tests in `tests/orchestrators/import/execute.test.ts`
  exercise the real user-scope locations (`~/.pi/agent/`) and write fixture
  entries (`mp`, `mp-b` marketplaces; `plugin@mp`, `b@mp-b`, `other@mp`,
  `ok@mp`, `my-plugin@mp` plugin keys) into the developer's real
  `~/.pi/agent/claude-plugins.json` on every `npm test` run. This was
  verified to happen identically on the UNMODIFIED pre-fix code (same entry
  set, probed via `PI_CODING_AGENT_DIR` isolation). The fixture entries were
  removed from the real config after the fix-session test runs. Consider
  wrapping those tests in the file's existing `withHermeticHome` helper in a
  follow-up.
- Out-of-scope Info findings IN-01..IN-06 were not addressed, except IN-01
  (unsound `cfg` cast in `commitFullRemove`), which fell out of the WR-02
  gate naturally, and IN-06, which is covered by the CR-01/CR-02 regression
  tests added here.

---

_Fixed: 2026-06-11T07:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
