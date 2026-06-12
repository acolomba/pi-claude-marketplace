---
phase: 52
plan: 01
subsystem: persistence
tags: [persistence, migration, first-run, phase-52, MIG-01, MIG-02]
requires:
  - persistence/config-io.ts (Phase 51-01: loadConfig trichotomy + saveConfig single sanctioned writer)
  - persistence/config-merge.ts (Phase 51-02: mergeScopeConfigs for data-level convergence)
  - persistence/locations.ts (Phase 51-01: configJsonPath + scopeRoot fields)
  - persistence/state-io.ts (Phase 51-01: ExtensionState shape; D-13-gated migrate keeps legacy autoupdate in-memory)
  - persistence/migrate.ts (Phase 51-02: D-13 gate-closed scrub preserves autoupdate for this phase to capture)
  - domain/source.ts (Phase 1: ParsedSource.raw is SP-7 verbatim user input)
provides:
  - extensions/pi-claude-marketplace/persistence/migrate-config.ts (Phase 52 seam)
  - tests/persistence/migrate-config.test.ts (MIG-01/MIG-02 lock)
  - tests/persistence/fixtures/legacy/state-populated-mixed.json (multi-marketplace fixture)
affects:
  - Phase 53 (planner-level convergence: planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state) deepEqual emptyPlan)
  - Phase 55 (load-wiring: calls migrateFirstRunConfig under withStateGuard; closes Pitfalls 52-2 / 52-4)
tech-stack:
  added: []
  patterns:
    - "ENOENT-gated idempotency via loadConfig trichotomy (no half-set flag, no second probe)"
    - "Pure projection + thin orchestrator split (NFR-1/NFR-10 inherited from saveConfig)"
    - "SPLIT-01 cast pattern with strict ===true / ===false arms for legacy field capture (D-13 + defense-in-depth drop of non-boolean)"
key-files:
  created:
    - extensions/pi-claude-marketplace/persistence/migrate-config.ts
    - tests/persistence/migrate-config.test.ts
    - tests/persistence/fixtures/legacy/state-populated-mixed.json
  modified: []
decisions:
  - "Source of truth for ScopeConfig.marketplaces[].source is (mp.source as ParsedSource).raw (SP-7 byte-stable round-trip)"
  - "Legacy autoupdate captured ONLY for exact ===true / ===false; any non-boolean silently dropped at the projection boundary (defense-in-depth)"
  - "saveConfig is the SOLE write seam; no atomicWriteJson import; SPLIT-02 allow-list stays at 1 element (Assumption A1 VERIFIED)"
  - "Idempotency is loadConfig-trichotomy-driven: invalid AND valid arms both fall to the same short-circuit (Pitfall 52-5 NEVER overwrite)"
metrics:
  duration: "~14m"
  completed: 2026-06-10T12:05:48Z
  tasks: 3
  files: 3
---

# Phase 52 Plan 01: First-Run Migration Summary

Atomic, idempotent, lossless projection from `state.json` to `claude-plugins.json` on first load, with the existence-of-config gate preventing any overwrite of a pre-existing user-authored file.

## What landed

- New module `extensions/pi-claude-marketplace/persistence/migrate-config.ts` (118 lines) exporting exactly three symbols:
  - `MigrateFirstRunResult` (`interface`): `readonly { migrated: boolean; entryCount: number; filePath: string }`.
  - `buildConfigFromState(state: ExtensionState): ScopeConfig`: pure lossless projection. Returns `{ schemaVersion: 1, marketplaces, plugins }`. Every marketplace in. Every plugin in (soft-degraded included; Pitfall 52-1). Source recovered byte-stably via `(mp.source as ParsedSource).raw`. Plugin keys flat `${plugin}@${mp}` (Pitfall 52-6 collision-free). Plugin entry body `{}` (D-04). `autoupdate` captured only when exactly `=== true` or exactly `=== false`; any other value silently dropped.
  - `migrateFirstRunConfig(loc, state): Promise<MigrateFirstRunResult>`: thin ENOENT-gated orchestrator. `await loadConfig(loc.configJsonPath)`; any `status !== "absent"` short-circuits with `{ migrated: false, entryCount: 0, filePath }`. On the `absent` arm: build projection + `await saveConfig(loc.configJsonPath, config, loc.scopeRoot)` (NFR-1 atomicity + NFR-10 containment + CONFIG_VALIDATOR revalidation all inherited).

- New test suite `tests/persistence/migrate-config.test.ts` (397 lines, 20 tests, all passing):
  - Section A (MIG-01 projection): 10 tests -- losslessness, soft-degrade inclusion, source byte-stable from `.raw`, autoupdate=true capture, omit-when-undefined, explicit false preserved, forward-tampered non-boolean dropped, cross-mp collision-free, empty plugin body, schemaVersion=1.
  - Section B (MIG-02 happy path): 3 tests -- ENOENT triggers migration with `entryCount === 5` (2 mps + 3 plugins), CONFIG_VALIDATOR round-trip via `loadConfig`, path-source byte-stable round-trip.
  - Section C (no-overwrite / idempotency): 4 tests -- second call short-circuits with mtime-stable, 0-byte / valid / schema-invalid pre-existing files all unmodified.
  - Section D (data-level convergence; Phase 53 planner proof deferred): 3 tests -- merged marketplaces + plugins key sets mirror state, every merged entry `source: "base"`.

- New fixture `tests/persistence/fixtures/legacy/state-populated-mixed.json` (75 lines): 2 marketplaces (`mp-path` with `autoupdate: true` + path-source raw string, `mp-github` with no autoupdate + github-source raw string), `soft-degraded` plugin (compatibility.installable=false), `code-reviewer` plugin in BOTH marketplaces (Pitfall 52-6 collision anchor). Every plugin's `resources.{skills,prompts,agents,mcpServers}` populated.

## Test pass counts

- New suite `tests/persistence/migrate-config.test.ts`: **20/20** GREEN.
- SPLIT-02 architecture test `tests/architecture/config-state-write-seams.test.ts`: **5/5** GREEN, byte-identical to its pre-phase state. (Plan 52-01 acceptance text says "4 passing tests" -- that figure pre-dated Plan 51-03's addition of the synthetic-offender walker self-test; the file actually has 5 tests since Phase 51-03 close and remains at 5, byte-identical to its pre-phase state. The intent -- "unmodified, architecture invariant held" -- is met.)
- Full project gate `npm run check`: **1571/1571** unit tests + **7/7** integration tests. Phase 51 close baseline was 1527 unit + 7 integration; the delta of +44 unit tests was contributed by Plans 51-02 (already landed before this plan started) and the +20 from this plan.

## Assumption A1 outcome

**Assumption A1 [VERIFIED]:** the SPLIT-02 architecture test stayed at 1 entry in `ALLOWED_CONFIG_JSON_WRITERS` (`extensions/pi-claude-marketplace/persistence/config-io.ts`). `migrate-config.ts` routes its single write through `saveConfig` rather than `atomicWriteJson` directly, so the path-name-specific regex `atomicWriteJson\(\s*(?:\w+\.)?configJsonPath\b` does NOT match anything in the new file. No fallback fired -- no allow-list edit was needed, no `tests/architecture/config-state-write-seams.test.ts` edit was needed. Both the writer set and the "exactly one file may write claude-plugins.json files" sibling assertion are unmodified.

## Cross-phase deferrals (recorded in test-file comments)

- **Phase 55 (load wiring) -- Pitfall 52-2 + Pitfall 52-4:** the HAZARD block comment at `tests/persistence/migrate-config.test.ts:24-34` names both pitfalls and the lock-coverage obligation. The Phase 55 call site MUST invoke `migrateFirstRunConfig` inside `withStateGuard` so two processes do not both see `absent` and race the projection. The D-13 gate race (existsSync ordering rail) is also owned by Phase 55's load wiring.
- **Phase 53 (planner-level convergence proof):** the docstring at `tests/persistence/migrate-config.test.ts:36-42` and the Section D leader comment at `tests/persistence/migrate-config.test.ts:344-358` both name the deferral. The planner-level proof `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state) deepEqual emptyPlan` will land in Phase 53 where `planReconcile` lands. Phase 52 satisfies Success Criterion 4 at the data level: merged key sets mirror state and every merged entry has `source: "base"` provenance (since `local` was `{}` in the merge).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Blank-line lint fix in `tests/persistence/migrate-config.test.ts`**
- **Found during:** Task 2 pre-commit run (`@stylistic/padding-line-between-statements` failed on line 393 -- last `for` loop in the Section D provenance test).
- **Fix:** Inserted the required blank line before the second `for` loop in the final test block.
- **Files modified:** `tests/persistence/migrate-config.test.ts`.
- **Commit:** Bundled into Task 2's `feat(52-01)` commit `735b592` since the violation only surfaced when running pre-commit against the new production file (the original Task 1 RED commit ran pre-commit against the test file with the production file ABSENT, and the lint configuration's blank-line rule did not fire on that file in isolation -- it fired when the production file was added and the typecheck pass widened the scope).

No other deviations. Plan executed exactly as written.

## Source-comment policy compliance

The new module keeps requirement / decision / pitfall IDs inline as traceability (MIG-01, MIG-02, D-04, D-11, D-13, SPLIT-01, SPLIT-02, NFR-1, NFR-10, Pitfall 51-1, Pitfall 52-1, Pitfall 52-3, Pitfall 52-5, Pitfall 52-6, SP-7). No phase / plan / wave / milestone narrative was retained in source comments -- git history holds it.

## Frozen-file invariant

No edits to `config-io.ts`, `state-io.ts`, `migrate.ts`, `config-merge.ts`, `locations.ts`, or `tests/architecture/config-state-write-seams.test.ts`. Confirmed via `git diff --stat HEAD~2..HEAD`: only the three new files changed. This phase is pure addition built atop the Phase 51 frozen foundation, satisfying Success Criteria 5 and 6.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/persistence/migrate-config.ts` -- FOUND.
- `tests/persistence/migrate-config.test.ts` -- FOUND.
- `tests/persistence/fixtures/legacy/state-populated-mixed.json` -- FOUND.
- Commit `c3e4213` (test scaffold) -- FOUND in `git log --oneline`.
- Commit `735b592` (production module + lint fix) -- FOUND in `git log --oneline`.
- `npm run check` -- exit 0, 1571 unit + 7 integration GREEN.
- SPLIT-02 architecture test -- byte-identical, 5/5 GREEN.
