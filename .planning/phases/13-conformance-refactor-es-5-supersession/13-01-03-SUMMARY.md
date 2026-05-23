---
phase: 13-conformance-refactor-es-5-supersession
plan: 01-03
subsystem: presentation
tags: [eslint, no-restricted-imports, static-audit, markers, soft-dep, D-13-07, D-13-09, D-13-12, CMC-35, ES-5-cutover]

# Dependency graph
requires:
  - phase: 13-conformance-refactor-es-5-supersession
    provides: |
      Wave 1 keystone primitives from Plan 13-01-01 and Plan 13-01-02:
      - RowSpec discriminated union + renderRow grammar composer
        (presentation/compact-line.ts) with per-row soft-dep markers via
        injected SoftDepProbe (replaces the aggregated trailer)
      - presentation/cause-chain.ts, cascade-summary.ts, manual-recovery.ts,
        rollback-partial.ts composers (replace the legacy hand-formatted
        ES-5 marker strings at orchestrator callsites)
provides:
  - "BLOCK E (extension scope) and BLOCK E-2 (test scope) ESLint gates forbidding imports of the 5 legacy ES-5 marker names (PI_SUBAGENTS_NOT_LOADED, PI_MCP_ADAPTER_NOT_LOADED, RELOAD_HINT_PREFIX, MANUAL_RECOVERY_REQUIRED, ROLLBACK_PARTIAL) from any callsite outside the canonical allow-list. Three relative-path variants cover every import shape in the codebase. Two disjoint blocks avoid the BLOCK E paths[]-replacement risk that would have fired if a single block had spanned both extensions/** and tests/**."
  - "tests/architecture/no-legacy-markers.test.ts static-audit test (D-13-12 / CMC-35) that recursively scans extensions/pi-claude-marketplace + tests for the 5 literal strings and asserts zero matches in non-allow-listed files. Literals are PINNED BYTE-FOR-BYTE in the test body (not imported from markers.ts) so the gate survives the Wave 3 atomic export deletion."
  - "presentation/soft-dep.ts thinned to a probe-only surface per D-13-07 (re-exports hasLoadedPiMcpAdapter, hasLoadedPiSubagents, softDepStatus); the aggregated-trailer helpers (subagentWarningIfNeeded, mcpAdapterWarningIfNeeded) are removed from this shim and from the presentation/index.ts barrel."
  - "Six orchestrator callsites migrated to source the aggregated-trailer helpers directly from platform/pi-api.ts: orchestrators/plugin/{install,reinstall,uninstall,update}.ts + orchestrators/marketplace/{remove,update}.ts."
affects:
  - "Wave 2 sub-wave 2a (cascade orchestrators / rollback chokepoint): the ESLint gate + static-audit test prevent any regression to legacy marker strings during the renderer migration; the temporary allow-list entry for transaction/rollback.ts is removed once sub-wave 2a uses presentation/rollback-partial.ts; the temporary allow-list entry for orchestrators/plugin/reinstall.ts is removed once sub-wave 2a uses presentation/manual-recovery.ts"
  - "Wave 2 sub-wave 2b (single-plugin install / uninstall): temporary allow-list entries for bridges/{agents,skills,commands}/stage.ts (MANUAL_RECOVERY_REQUIRED imports) and the 3 contract-assertion test files are removed once the renderer migration retires the hand-formatted error strings"
  - "Wave 2 sub-wave 2c (marketplace remove / manual-recovery): finalization may delete subagentWarningIfNeeded / mcpAdapterWarningIfNeeded from platform/pi-api.ts once all orchestrator callers migrate to per-row markers"
  - "Wave 3 atomic commit: deletes the 5 legacy marker exports from shared/markers.ts, the matching rows from tests/architecture/markers-snapshot.test.ts, the PRD §6.12 row (rewritten to a pointer), AND the per-file allow-list entries in BLOCK E + BLOCK E-2 of eslint.config.js. The no-legacy-markers.test.ts static-audit gate keeps enforcing zero re-introductions for the lifetime of the codebase."

# Tech tracking
tech-stack:
  added: []  # No new dependencies.
  patterns:
    - "Two-block ESLint pattern for the same rule with disjoint files: when a no-restricted-imports rule must apply to two file scopes with DIFFERENT exemptions (Gate 1 chokepoint exempt for tests; Gate 2 marker restriction common to both), split into two blocks with non-overlapping files: patterns. Per RESEARCH.md PITFALL 2, the per-rule paths[] replacement-vs-merge concern only fires when blocks overlap; disjoint patterns avoid it entirely."
    - "Static-audit test pinning literals in test body (NOT importing from the under-audit module) so the gate survives the audited module's eventual deletion. Pattern combines manifest-read-seam.test.ts's recursive readdir walk + no-orchestrator-network.test.ts's ALLOW_LIST + offenders + assert.deepEqual([], ...) shape."
    - "Temporary allow-list entries in ESLint ignores: with TODO comments naming the sub-wave that will migrate each callsite. Sub-waves remove their corresponding allow-list entries as they finish; the Wave 3 atomic commit removes the remainder alongside the export deletion."
    - "Re-export shim thinning: when the architecture replaces an aggregated helper with per-row primitives, the re-export module retires the aggregated helper but keeps the probe surface that the per-row renderer still consumes. Direct callers of the retired helper source from the source module until they migrate."

key-files:
  created:
    - "tests/architecture/no-legacy-markers.test.ts (recursive static-audit gate; 6-entry ALLOW_LIST; 5 literal markers pinned byte-for-byte)"
  modified:
    - "eslint.config.js (BLOCK E extended in place with Gate 2 markers; NEW BLOCK E-2 mirrors Gate 2 for tests/** with disjoint files: pattern -- 2 blocks total instead of plan-spec'd 1 to avoid Pi peer-import gate escaping its extensions-only scope)"
    - "extensions/pi-claude-marketplace/presentation/soft-dep.ts (thinned: aggregated-trailer helpers dropped; 3 probe helpers retained; D-13-07 citation added)"
    - "extensions/pi-claude-marketplace/presentation/index.ts (barrel updated to mirror the thinned shim surface)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (trailer helpers imported from platform/pi-api.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (trailer helpers imported from platform/pi-api.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts (trailer helpers imported from platform/pi-api.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (trailer helpers imported from platform/pi-api.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts (trailer helpers imported from platform/pi-api.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts (trailer helpers imported from platform/pi-api.ts)"
    - "tests/presentation/soft-dep.test.ts (split imports: probes via thin shim, trailer helpers via platform/pi-api.ts source)"

key-decisions:
  - "Two-block ESLint structure (BLOCK E + BLOCK E-2) instead of plan-spec'd single block with files: [extensions/**, tests/**]. The plan's directive would have escaped Gate 1 (Pi peer-import chokepoint, originally extensions-only) into tests/, breaking 17 legitimate test mocks that import @earendil-works/pi-coding-agent directly. Two disjoint-pattern blocks preserve BOTH gates' intended scopes; per RESEARCH.md PITFALL 2 the paths[] replacement concern does not apply across disjoint files: patterns."
  - "Temporary per-file allow-list entries for 5 production callsites + 4 contract-assertion tests still importing legacy markers today. The plan assumed those callsites didn't import the markers directly (line 151: 'Most likely none of these production callsites import the markers directly'). They DO -- bridges/{agents,skills,commands}/stage.ts + orchestrators/plugin/reinstall.ts use MANUAL_RECOVERY_REQUIRED; transaction/rollback.ts uses ROLLBACK_PARTIAL; tests assert on PI_*_NOT_LOADED + ROLLBACK_PARTIAL contract literals. Wave 2 sub-waves migrate each as part of the renderer cutover; the Wave 3 atomic commit removes the remaining entries alongside the export deletion. Documented with TODO comments naming the migrating sub-wave."
  - "Static-audit ALLOW_LIST has 6 entries (plan envisioned 5). Three extra entries cover header-docstring mentions of '(rollback partial: ...)' in transaction/rollback.ts (D-03 chokepoint contract), transaction/phase-ledger.ts (PI-14 + AS-4 header), and tests/transaction/rollback.test.ts (PI-14 chokepoint header). The 2 .md ALLOW_LIST entries the plan listed (PRD + style guide) fall outside the .ts/.js scan scope -- no entry needed. Per RESEARCH.md line 806, comments are NOT stripped (legitimate doc-string mentions get covered by ALLOW_LIST instead)."
  - "tests/presentation/soft-dep.test.ts kept (not deleted) but with split imports. The test exists to verify the thin shim's surface; after the thinning it imports probes from presentation/soft-dep.ts (the shim surface under test) and the trailer helpers from platform/pi-api.ts (the source). Test coverage of the trailer helpers is duplicate with tests/platform/pi-api.test.ts but the duplication is harmless and intentionally retained until sub-wave 2c finalization decides whether to delete the trailer helpers from platform/pi-api.ts (Open Question 3 in RESEARCH.md)."

patterns-established:
  - "Pattern: split flat-config ESLint blocks with disjoint files: patterns to apply the same no-restricted-imports rule to two scopes with different exemption sets. Avoids the per-rule paths[] replacement-vs-merge gotcha that occurs when overlapping blocks both target the same rule."
  - "Pattern: static-audit gate pinning literals in the test body itself so the gate survives deletion of the audited module. Combine recursive readdir + ALLOW_LIST + offenders array + assert.deepEqual([], ...) shape; do NOT import the audited constants (the deletion would break the gate)."
  - "Pattern: temporary ESLint ignores: entries with sub-wave migration TODO comments document the planned cleanup horizon. Each sub-wave removes its corresponding entries; the final atomic commit removes the remainder."

requirements-completed:
  - CMC-35

# Metrics
duration: 31min
completed: 2026-05-23
---

# Phase 13 Plan 01-03: Wave 1 Cutover Gates Summary

**ESLint no-restricted-imports gate (BLOCK E + BLOCK E-2) + static-audit test (no-legacy-markers.test.ts) together prevent any Wave 2 sub-wave from regressing the 5 legacy ES-5 marker strings; presentation/soft-dep.ts thinned to probe-only surface per D-13-07.**

## Performance

- **Duration:** 31 minutes
- **Started:** 2026-05-23T17:10:16Z
- **Completed:** 2026-05-23T17:41:44Z
- **Tasks:** 3 / 3
- **Files modified / created:** 10 source files (1 created, 9 modified) + 1 config file

## Accomplishments

- **Two-layer cutover gate landed.** Layer 1 (ESLint `no-restricted-imports`): three relative-path variants of `shared/markers.ts` × five legacy marker names = 15 path/name pairs forbidden from any callsite outside the canonical allow-list. Layer 2 (static-audit test): recursively scans `extensions/pi-claude-marketplace` + `tests` for the 5 literal strings (pinned byte-for-byte in the test body) and asserts zero matches in non-allow-listed files. Both layers stay green through the entire Wave 2 cutover and survive the Wave 3 atomic deletion of the marker exports.
- **Two-block ESLint structure (BLOCK E + BLOCK E-2) preserves both gates' intended scopes.** The plan's directive of a single block with `files: [extensions/**, tests/**]` would have escaped Gate 1 (Pi peer-import chokepoint, originally extensions-only) into tests/, breaking 17 legitimate test mocks. Disjoint `files:` patterns avoid the BLOCK E paths[]-replacement risk per RESEARCH.md PITFALL 2 — no overlap, no replacement.
- **presentation/soft-dep.ts thinned to probe-only surface per D-13-07.** Aggregated-trailer helpers removed from the shim and from the `presentation/index.ts` barrel. The shim now publishes only the 3 probe helpers (`hasLoadedPiMcpAdapter`, `hasLoadedPiSubagents`, `softDepStatus`) that the per-row renderer in `compact-line.ts` consumes via the injected `SoftDepProbe`.
- **Six orchestrator callsites migrated** to source the trailer helpers directly from `platform/pi-api.ts` (the source module). The trailer helpers stay exported from `platform/pi-api.ts` until Wave 2 sub-wave 2c finalization decides whether to delete them per RESEARCH.md Open Question 3.
- **Static-audit test ALLOW_LIST has 6 entries (3 canonical + 3 header-docstring mentions).** Per RESEARCH.md line 806, comments are not stripped; legitimate header docstrings (D-03 chokepoint, PI-14 + AS-4 headers) are explicitly allow-listed instead.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ESLint BLOCK E with no-restricted-imports for the 5 legacy markers (D-13-09)** — `030f580` (feat)
2. **Task 2: Create tests/architecture/no-legacy-markers.test.ts static-audit (D-13-12)** — `57ca692` (test)
3. **Task 3: Thin presentation/soft-dep.ts to drop aggregated-trailer helpers; update barrel** — `8ff4eef` (refactor)

## Files Created/Modified

- `eslint.config.js` — BLOCK E extended with Gate 2 (5 legacy marker names × 3 relative-path variants) AND temporary per-file ignores for production callsites. NEW BLOCK E-2 mirrors Gate 2 for `tests/**` with disjoint `files:` pattern so Gate 1 (Pi peer-import chokepoint) stays extension-scoped.
- `tests/architecture/no-legacy-markers.test.ts` — NEW static-audit test (D-13-12 / CMC-35). Recursively scans for the 5 literal markers; 6-entry ALLOW_LIST; literals pinned byte-for-byte (NOT imported from `markers.ts`) so the gate survives Wave 3 export deletion.
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts` — Thinned: re-exports only the 3 probe helpers (`hasLoadedPiMcpAdapter`, `hasLoadedPiSubagents`, `softDepStatus`); D-13-07 citation added.
- `extensions/pi-claude-marketplace/presentation/index.ts` — Barrel updated to mirror the thinned shim.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — Trailer helpers imported from `platform/pi-api.ts`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — Same.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — Same.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — Same.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` — Same.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — Same.
- `tests/presentation/soft-dep.test.ts` — Imports split: probes via thin shim (verifies shim surface); trailer helpers via `platform/pi-api.ts` source.

## Decisions Made

- **Two-block ESLint structure (BLOCK E + BLOCK E-2) instead of plan-spec'd single block.** The plan's `files: [extensions/**, tests/**]` directive would have escaped Gate 1 into tests/. Two disjoint-pattern blocks preserve both gates' intended scopes; per RESEARCH.md PITFALL 2 the paths[] replacement concern does not apply across disjoint files: patterns.
- **Temporary per-file allow-list entries for 5 production callsites + 4 contract-assertion tests.** The plan assumed those callsites didn't import the markers directly; they DO. Each entry has a TODO comment naming the Wave 2 sub-wave that will migrate it. The Wave 3 atomic commit removes the remainder.
- **Static-audit ALLOW_LIST has 6 entries (plan envisioned 5).** Three extra cover header-docstring mentions of `(rollback partial: ...)` in `transaction/rollback.ts` (D-03 chokepoint), `transaction/phase-ledger.ts` (PI-14 + AS-4 header), and `tests/transaction/rollback.test.ts` (PI-14 chokepoint header). Per RESEARCH.md line 806, comments are NOT stripped.
- **`tests/presentation/soft-dep.test.ts` kept (not deleted) with split imports.** Probes from the thin shim (verifies shim surface); trailer helpers from `platform/pi-api.ts` (the source). Test coverage of the trailer helpers duplicates `tests/platform/pi-api.test.ts` but the duplication is intentionally retained until sub-wave 2c finalization decides whether to delete the trailer helpers from `platform/pi-api.ts` (Open Question 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Split single ESLint block into BLOCK E + BLOCK E-2 with disjoint files: patterns**

- **Found during:** Task 1 (Extend ESLint BLOCK E with no-restricted-imports for the 5 legacy markers).
- **Issue:** The plan directed `files: ["extensions/pi-claude-marketplace/**/*.ts", "tests/**/*.ts"]` for a single merged BLOCK E. Running this caused 17 legitimate test mocks (in `tests/edge/`, `tests/orchestrators/`) to fail Gate 1 (`no-restricted-imports` against `@earendil-works/pi-coding-agent`). Tests legitimately import the Pi API directly for mocking; Gate 1 was historically extension-only and the plan did not anticipate the side effect.
- **Fix:** Split into BLOCK E (extension scope, both gates) + BLOCK E-2 (test scope, Gate 2 only). Files patterns are DISJOINT so the BLOCK E paths[]-replacement risk per RESEARCH.md PITFALL 2 does not apply. Pi peer-import chokepoint stays extension-only; marker restriction applies to both scopes as planned.
- **Files modified:** `eslint.config.js`.
- **Verification:** `npx eslint --no-warn-ignored extensions/pi-claude-marketplace tests/` exits 0; canary file with marker import correctly fails the gate (sanity-tested before commit).
- **Committed in:** `030f580` (Task 1 commit).

**2. [Rule 3 — Blocking] Added temporary per-file ESLint ignores for 5 production callsites + 4 contract-assertion tests**

- **Found during:** Task 1 (post-plan grep for current consumers of the 5 legacy marker exports).
- **Issue:** The plan stated "Most likely none of these production callsites import the markers directly today" (line 151). Reality: `bridges/{agents,skills,commands}/stage.ts` + `orchestrators/plugin/reinstall.ts` import `MANUAL_RECOVERY_REQUIRED`; `transaction/rollback.ts` imports `ROLLBACK_PARTIAL`; `tests/e2e/install-soft-deps.test.ts` + `tests/platform/pi-api.test.ts` + `tests/presentation/soft-dep.test.ts` import `PI_*_NOT_LOADED` for contract assertions; `tests/transaction/rollback.test.ts` imports `ROLLBACK_PARTIAL` for the chokepoint contract. The plan envisioned these would be migrated by Wave 2 sub-waves — but the ESLint gate must land BEFORE Wave 2 to prevent regressions, so the existing imports needed allow-listing.
- **Fix:** Added 5 production-file + 4 test-file entries to BLOCK E / BLOCK E-2 `ignores:` with TODO comments naming the migrating sub-wave (2a / 2b / 2c). Sub-waves remove their corresponding entries; Wave 3 atomic commit removes the remainder alongside the export deletion. Preserves the plan's intent (the gate prevents NEW regressions during Wave 2) without forcing a scope expansion into this plan.
- **Files modified:** `eslint.config.js`.
- **Verification:** `npm run check` exits 0 on the post-edit baseline; canary sanity-test confirms the gate still fires on non-allow-listed callsites.
- **Committed in:** `030f580` (Task 1 commit).

**3. [Rule 3 — Blocking] Added 3 extra static-audit ALLOW_LIST entries for header-docstring mentions**

- **Found during:** Task 2 (initial test run flagged 3 files with `(rollback partial: ` in header docstrings).
- **Issue:** Per RESEARCH.md line 806 the test does NOT strip comments. The plan listed a 5-entry ALLOW_LIST (3 canonical sources + 2 .md docs); the .md docs fall outside the .ts/.js scan scope. Three .ts files contain legitimate header-docstring mentions of the `(rollback partial: ...)` chokepoint contract (`transaction/rollback.ts` D-03 header, `transaction/phase-ledger.ts` PI-14 + AS-4 header, `tests/transaction/rollback.test.ts` PI-14 header).
- **Fix:** Added the 3 .ts files to the ALLOW_LIST with rationale comments. Effective ALLOW_LIST: 6 entries (3 canonical + 3 header-docstring mentions). Each entry has an explicit justification comment in the test header.
- **Files modified:** `tests/architecture/no-legacy-markers.test.ts`.
- **Verification:** `node --test tests/architecture/no-legacy-markers.test.ts` exits 0 (offenders array empty); canary sanity-test confirms a regression triggers test failure.
- **Committed in:** `57ca692` (Task 2 commit).

**4. [Rule 3 — Blocking] Migrated 6 orchestrator import statements from `presentation/soft-dep.ts` to `platform/pi-api.ts`**

- **Found during:** Task 3 (pre-edit grep for consumers of the trailer helpers).
- **Issue:** The plan listed only `orchestrators/plugin/install.ts` and `orchestrators/marketplace/remove.ts` as consumers via the barrel. Actual consumers: those 2 PLUS `orchestrators/plugin/reinstall.ts`, `orchestrators/plugin/uninstall.ts`, `orchestrators/plugin/update.ts`, `orchestrators/marketplace/update.ts` — all importing the trailer helpers from `presentation/soft-dep.ts`. Thinning the shim without migrating these would break the build.
- **Fix:** Migrated all 6 import statements to source `subagentWarningIfNeeded` and `mcpAdapterWarningIfNeeded` directly from `../../platform/pi-api.ts`. `import-x/order` auto-reordered the imports (platform before presentation).
- **Files modified:** All 6 orchestrator files (`orchestrators/plugin/{install,reinstall,uninstall,update}.ts`, `orchestrators/marketplace/{remove,update}.ts`).
- **Verification:** `npm run check` exits 0; all 1121 tests pass.
- **Committed in:** `8ff4eef` (Task 3 commit).

---

**Total deviations:** 4 auto-fixed (4 Rule 3 — Blocking).
**Impact on plan:** All four deviations preserve the plan's intent (cutover gates land in Wave 1; legacy markers cannot be re-introduced after Wave 3) without changing architecture. Three of the four are root-caused by the plan's incomplete grep of existing callsites; the fourth (Block E split) is unavoidable given the file-scope conflict between Gate 1 and Gate 2. No scope creep into Wave 2 migration work.

## Issues Encountered

- None outside the deviations documented above. Each Rule 3 fix was straightforward and verified by both the existing test suite and canary sanity-tests.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The two-layer cutover gate (ESLint `no-restricted-imports` + static-audit test) is live and operational. Wave 2 sub-waves can proceed with renderer-callsite migration knowing that any regression to legacy ES-5 marker imports OR literal strings fails `npm run check` immediately.
- Wave 2 sub-wave 2a (cascade orchestrators) should remove the temporary allow-list entries for `transaction/rollback.ts` (when sub-wave 2a uses `presentation/rollback-partial.ts`) and `orchestrators/plugin/reinstall.ts` (when sub-wave 2a uses `presentation/manual-recovery.ts`) as part of its work.
- Wave 2 sub-wave 2b (single-plugin orchestrators) should remove the temporary allow-list entries for `bridges/{agents,skills,commands}/stage.ts` and the 3 contract-assertion test files (`tests/e2e/install-soft-deps.test.ts`, `tests/platform/pi-api.test.ts`, `tests/presentation/soft-dep.test.ts`) once it migrates the hand-formatted error strings to the new renderer surface.
- Wave 2 sub-wave 2c (marketplace remove / manual-recovery) should remove the temporary allow-list entry for `tests/transaction/rollback.test.ts` and decide per RESEARCH.md Open Question 3 whether to delete `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` from `platform/pi-api.ts` (currently the source module for the retired aggregated-trailer helpers).
- The Wave 3 atomic commit deletes (a) the 5 legacy marker exports from `shared/markers.ts`, (b) the matching rows from `tests/architecture/markers-snapshot.test.ts`, (c) PRD §6.12 rewritten to a pointer, (d) the remaining per-file allow-list entries in BLOCK E + BLOCK E-2 of `eslint.config.js`. The `no-legacy-markers.test.ts` static-audit gate keeps enforcing zero re-introductions for the lifetime of the codebase.

## Self-Check: PASSED

- `eslint.config.js`: FOUND
- `tests/architecture/no-legacy-markers.test.ts`: FOUND
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts`: FOUND
- `extensions/pi-claude-marketplace/presentation/index.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`: FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`: FOUND
- `tests/presentation/soft-dep.test.ts`: FOUND
- Commit `030f580` (Task 1 — ESLint): FOUND in git log
- Commit `57ca692` (Task 2 — static-audit test): FOUND in git log
- Commit `8ff4eef` (Task 3 — soft-dep thinning): FOUND in git log
- `npm run check`: PASS (1121 tests)
- `node --test tests/architecture/no-legacy-markers.test.ts`: PASS

---
*Phase: 13-conformance-refactor-es-5-supersession*
*Completed: 2026-05-23*
