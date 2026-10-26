---
phase: 11-pending-and-reconcile
plan: 01
subsystem: testing
tags: [cucumber, pending, reconcile, behavioral-tests]
requires:
  - phase: 01-suite-foundation
    provides: "config writers, command and session steps, skill offer steps, the pending and reconcile seeds"
provides:
  - "pending.feature: one hand edit causing install, uninstall, disable, and enable; --scope user and --scope project narrowing"
  - "reconcile.feature: hand removal, hand disable, hand enable, and a partly failing hand-declared install"
  - "The reconcile (installed) row of a hand-declared plugin carries its version"
affects: [phase-13-import, milestone-merge]
requirements-completed: [PND-01, PND-02, REC-01, REC-02, REC-03, REC-04]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/integration/mcp-migration.test.ts
    - test/integration/plugin-layer-consistency.test.ts
    - test/integration/reserved-record-keys.test.ts
    - test/architecture/catalog-uat/fixtures/reconcile-applied.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - docs/output-catalog.md
    - CHANGELOG.md
    - features/plugin/pending.feature
    - features/plugin/reconcile.feature
---

# Phase 11 Plan 01: Pending and Reconcile Summary

**`pending` and a new session are covered after hand-edited configs, and the reconcile install row now reports the plugin version.**

## Task Commits

1. **Task 1: Report the version on the reconcile install row** - `bdc2919b` (fix). Follow-up `cb489a34` updates the integration tests, the output catalog example and fixture, and the byte pin, which the plan's checks did not run (review CR-01).
2. **Task 2: Scenarios** - `f203fc53` (test); `29c0422f` reorders the REC-04 config so the failing plugin comes first (review WR-01).
3. **Task 3: Full gate** - `npm run check` (with `npm run test:cucumber`) exit 0 on the final tree: 471 scenarios, 4496 steps.

## Scenarios added

- pending: four transitions from one edit (tally success 4; rows `will install`, `will uninstall`, `will disable`, `will enable`); `--scope user` and `--scope project` each list only their scope's row while both scopes carry a hand edit.
- reconcile: hand removal (`uninstalled 1.0.0`, only the kept skill offered); hand disable (`disabled 1.0.0`, no skills); hand enable (`installed 1.0.0`, as standalone `enable` reports); `ghost` + `demo` (two error results, one per RPC binding; `ghost` `not in manifest` twice, `demo` installed and offered). The two Phase 1 seeds now state `version 1.0.0`.
- reconcile, handed over from Phase 7: `update app@tools` to a version that declares `lib@^2.0.0` while `lib` 1.0.0 is installed goes through; the next session reports one warning result with `app` `disabled` `{dependency version unsatisfied}`, version 2.0.0, cause `Update "lib@tools" to satisfy >=2.0.0 <3.0.0-0, or uninstall "app@tools"`, and offers only `lib`'s skill (LOAD-01). Commit added after the review; see 11-VERIFICATION.md.

## Deviations from Plan

- **[Rule 1 - Bug] Integration tests and the output catalog pinned the version-less row.** Found by the code review. Updated in `cb489a34`.
- No new step module was needed (D-01).

## Bug candidates (from Phase 1)

- Fixed: reconcile `installed` row without version (D-07).
- Not a bug: `pending` lists `will install` for a nonexistent source (D-08); unexpanded `{home}` source reported as `unsupported source` matches Claude Code's "Invalid marketplace source format" (D-09); a failure reported twice per new session is Pi RPC behavior (D-06).
- Deferred: `unreadable` reconcile row, without cause chain, for a plugin its catalog dropped or whose manifest is invalid (D-10).

## For the orchestrator

- D-10 deferred: the `failed {unreadable}` row that every new session prints for a plugin its catalog dropped, or whose manifest is invalid, has no cause chain and names a misleading reason. Source: `reportUnreadableDeclarer` in `orchestrators/reconcile/apply.ts` (D-05-07 fail-closed walk). A fix changes expected rows in `features/marketplace/update.feature`, `marketplace/remove.feature` (Phase 15), `plugin/uninstall.feature` (Phase 6), and `plugin/update.feature` (Phase 7), which this phase may not edit.
- Merge overlap: `test/architecture/catalog-uat/catalog-contract.test.ts` `EXPECTED_UTF8_BYTES` moves 46 623 -> 46 637 (+14). Another phase that edits `docs/output-catalog.md` will conflict; add both deltas.
- Merge overlap: any other phase's scenario or test that states a reload-installed `(installed)` row without a version will now fail; add `version 1.0.0` / `v1.0.0`. The full cucumber suite on this branch passed (471 scenarios), so no Phase 1 or untouched file was affected.
- Phase 13 candidate (not touched): `import` `installed` rows still carry no version.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED
