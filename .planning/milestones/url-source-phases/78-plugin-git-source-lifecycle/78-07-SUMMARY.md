---
phase: 78-plugin-git-source-lifecycle
plan: 07
subsystem: persistence
tags: [config-write-back, reconcile, dangling-reference, claude-plugins.local.json, marketplace-remove, plugin-uninstall]

# Dependency graph
requires:
  - phase: 78-plugin-git-source-lifecycle
    provides: single-layer WB-01 config write-back for marketplace remove + plugin uninstall
provides:
  - Cross-layer config-deletion cascade for standalone marketplace remove
  - Cross-layer config-deletion cascade for standalone plugin uninstall
  - Self-healing removal that leaves planReconcile clean across base + local layers
affects: [reconcile, config-write-back, uninstall, marketplace-remove]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-layer sweep helper (loadConfig fresh -> WR-02 no-op guard -> atomic saveConfig) iterated over both configJsonPath and configLocalJsonPath in standalone mode"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts

key-decisions:
  - "Cross-layer sweep is unconditional in standalone mode (both layers), regardless of opts.local; opts.local now governs only the CFG-03 abort target"
  - "The --local single-layer byte-identity guarantee is deliberately dropped: when the sibling layer declares the same key it is swept too"
  - "Sibling layer being absent/invalid is NOT a CFG-03 abort -- it is skipped (per-file valid-only rule); CFG-03 abort remains scoped to the target layer"

patterns-established:
  - "cascadeRemoveFromLayer / deletePluginFromLayer: load each physical config layer fresh, apply the WR-02 no-op short-circuit per file, delete + atomic-save only when the layer declares the target"

requirements-completed: [PURL-05, PURL-06]

coverage:
  - id: D1
    description: "Standalone marketplace remove sweeps the marketplace + its @<marketplace> plugin keys from BOTH claude-plugins.json and claude-plugins.local.json"
    requirement: PURL-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#cross-layer cascade: --local plugin declaration under the removed marketplace is swept from BOTH config files (no perpetual dangling-reference)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#cross-layer: standalone remove sweeps the marketplace from BOTH the base and local files"
        status: pass
    human_judgment: false
  - id: D2
    description: "Standalone plugin uninstall sweeps its plugin@marketplace key from BOTH config layers when declared in either"
    requirement: PURL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#cross-layer cascade: uninstall sweeps the plugin key from the sibling layer when declared there"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#cross-layer: standalone uninstall deletes the plugin key from BOTH the base and local files"
        status: pass
    human_judgment: false
  - id: D3
    description: "After a cross-layer remove/uninstall, the merged config + planReconcile yields zero sourceMismatches (no perpetual dangling-reference)"
    requirement: PURL-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#cross-layer cascade: --local plugin declaration under the removed marketplace is swept from BOTH config files (no perpetual dangling-reference)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Orchestrated (reconcile-driven) mode still skips config write-back entirely (WR-09 unchanged); a no-op layer is not rewritten (RECON-05)"
    requirement: PURL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#WR-09 / T-56-02-01: orchestrated remove SKIPS the cascade write-back; config untouched"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WR-09 / T-56-03-01: orchestrated-mode uninstall SKIPS write-back; config untouched"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-12
status: complete
---

# Phase 78 Plan 07: Cross-Config-Layer Removal Cascade Summary

**Standalone marketplace remove and plugin uninstall now sweep the declarative config across BOTH claude-plugins.json and claude-plugins.local.json, so an orphaned sibling-layer declaration can no longer persist as a perpetual reconcile dangling-reference.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-12T04:44:00Z
- **Completed:** 2026-07-12T05:29:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Closed the cross-config-layer removal gap diagnosed in `.planning/debug/reload-remove-source-mismatch.md`: a `pr-review-toolkit@claude-plugins-official` key left in `claude-plugins.local.json` by a prior `--local` install survived a base-layer marketplace remove and produced "Reconcile: 2 failures" on every `/reload`.
- `commitFullRemove` now iterates both sanctioned config paths via the extracted `cascadeRemoveFromLayer` helper; each layer is loaded fresh, gated by the WR-02 no-op guard, and saved atomically. Orchestrated mode still returns early (WR-09).
- The standalone uninstall config-delete arm iterates both layers via `deletePluginFromLayer`, preserving the write-back-before-`tx.save()` ordering so a write-back throw still aborts the state save.
- Reproduction tests recreate the mixed-layer declaration, run the standalone operation, and assert (a) both physical files no longer declare the key and (b) `planReconcile` over the merged config is empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce the cross-layer orphan in failing tests** - `69fa9239` (test)
2. **Task 2: Cross-layer cascade delete in marketplace remove** - `80aa472d` (fix)
3. **Task 3: Cross-layer cascade delete in plugin uninstall** - `b3781b2d` (fix)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` - `commitFullRemove` reworked to take `locations` and sweep both config layers via new `cascadeRemoveFromLayer`; removed now-unused `ConfigLoadResult` import and the single `targetConfigPath`/`cfg` params it threaded into the commit.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - standalone config-delete arm sweeps both layers via new `deletePluginFromLayer`; CFG-03 target-layer abort and `tx.save()` ordering unchanged.
- `tests/orchestrators/marketplace/remove.test.ts` - added the cross-layer reproduction test; replaced the `--local` single-layer byte-identity test with a cross-layer sweep assertion.
- `tests/orchestrators/plugin/uninstall.test.ts` - added the cross-layer reproduction test; replaced the `--local` single-layer byte-identity test with a cross-layer sweep assertion.

## Decisions Made
- **Sweep is unconditional across both layers in standalone mode.** `opts.local` no longer scopes the write-back to one file; it now governs only which layer the CFG-03 abort inspects. This is the direct correction to WB-01's single-layer assumption.
- **Per-file WR-02 no-op guard preserved.** A layer declaring neither the marketplace nor a plugin under it (remove) / not declaring the key (uninstall), or an absent/invalid layer, is skipped and never rewritten — RECON-05 byte/mtime stability holds for untargeted layers.
- **Sibling-layer invalidity is not a CFG-03 abort.** The CFG-03 loud-abort stays scoped to the target layer (`runRemoveLockBody` / the uninstall guard closure); an invalid sibling is silently skipped, matching the per-file valid-only rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced two `--local` byte-identity tests that encoded the removed single-layer behavior**
- **Found during:** Task 2 (remove) and Task 3 (uninstall)
- **Issue:** The existing `WB-01: --local ... base file untouched` tests seeded the same marketplace/plugin key in BOTH the base and local files, then asserted the base file stayed byte-identical after a `--local` operation. The plan's cross-layer sweep deliberately changes exactly this: when the base ALSO declares the target, it is now swept. Leaving the tests as-is would have made them fail on correct new behavior.
- **Fix:** Retitled and rewrote both tests to assert the target is removed from BOTH physical files (the new contract), instead of the old base-untouched byte-identity guarantee.
- **Files modified:** tests/orchestrators/marketplace/remove.test.ts, tests/orchestrators/plugin/uninstall.test.ts
- **Verification:** Both suites green (32 remove, 35 uninstall); full suite 2728 pass / 0 fail.
- **Committed in:** `80aa472d` (Task 2), `b3781b2d` (Task 3)

**2. [Rule 3 - Blocking] Removed now-unused `ConfigLoadResult` import in remove.ts**
- **Found during:** Task 2
- **Issue:** `commitFullRemove` no longer receives a pre-loaded `ConfigLoadResult` (it loads each layer fresh), leaving the type-only import unreferenced — a lint/typecheck failure.
- **Fix:** Dropped the unused `import type { ConfigLoadResult }` line.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
- **Verification:** `npm run typecheck` green; targeted eslint clean.
- **Committed in:** `80aa472d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were required to keep the suite green under the deliberately-changed behavior. No scope creep — the test rewrites assert the plan's own new contract, and the import removal is a direct orphan of the signature change.

## Issues Encountered
- Full-repo `npm run lint` and `pre-commit run --all-files` are slow in this environment (multi-minute). Verified the gate green via targeted `npx eslint` on changed files, standalone `npm run typecheck` / `npm run format:check`, a completed background `npm run lint` (exit 0), and the per-commit pre-commit hooks (which passed on both fix commits). Full `npm test` completed: 2728 pass, 0 fail, 1 pre-existing skip.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The orphan is now swept at its source (this plan). Plan 78-08 gives the `dangling-reference` reconcile diagnostic its own `{dangling reference}` reason token so any future hand-edited dangling reference names the real problem instead of reading `{source mismatch}`.
- No blockers.

## Self-Check: PASSED

- SUMMARY.md present on disk.
- All three task commits present in git history (`69fa9239`, `80aa472d`, `b3781b2d`).
- Full test suite green (2728 pass / 0 fail / 1 pre-existing skip); typecheck + format:check + lint green.

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-12*
