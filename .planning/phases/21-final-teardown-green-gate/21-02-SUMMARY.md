---
phase: 21
plan: 21-02
subsystem: shared-notify-consolidation
tags: [teardown, consolidation, v1-deletion, grammar-inline, presentation-sweep, atomic-commit]
requires:
  - "Plan 21-01: stock-rules ESLint baseline (no MSG-* drift-guard surface remaining)"
provides:
  - "shared/notify.ts is the single source of truth for the v1.4 messaging surface: V2 entry points + inlined REASONS / STATUS_TOKENS / MARKERS / PATTERN_CLASSES closed sets + compareByNameThenScope comparator (SNM-22 + SNM-29 closed)"
  - "shared/grammar/ absent on disk (D-21-01 aggressive-inline arm)"
  - "extensions/pi-claude-marketplace/presentation/ absent on disk (D-21-02 full clean-sweep)"
  - "tests/presentation/ absent on disk (133 V1 composer tests deleted)"
  - "tests/shared/notify.test.ts absent on disk (7 V1 wrapper tests deleted)"
  - "edge/handlers/tools.ts imports sourceLogical + ParsedSource directly from domain/source.ts (BLOCK C amended)"
  - "BLOCK C drops from 9 zones to 8 (presentation/ target gone); edge zone's from: no longer blocks domain/"
  - "edge/args-schema.ts callback parameter renamed notifyError -> onError"
affects:
  - "Plan 21-03 inherits a V2-only codebase: npm run check GREEN end-to-end is the final gate"
tech-stack:
  added: []
  patterns:
    - "Single source of truth for v1.4 closed sets (D-21-01): shared/notify.ts declares REASONS / STATUS_TOKENS / MARKERS / PATTERN_CLASSES const tuples + derived literal-union types in one contiguous section"
    - "Domain-relocation-over-orphan-deletion (D-21-02): each utility moved to its natural home rather than dropped (composeErrorWithCauseChain -> shared/errors.ts; compareByNameThenScope + Sortable -> shared/notify.ts; EntityErrorRow -> install.ts file-local)"
    - "Atomic single-commit consolidation (D-21-06 + D-21-08): one commit covers shared/notify.ts + 9 consumer migrations + grammar-inline + presentation-sweep so no intermediate state is non-compiling"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts (1175 -> 1251 lines; +76 net; V1 wrappers deleted, V2 notifyUsageError collapsed to single overload, REASONS / STATUS_TOKENS / MARKERS / PATTERN_CLASSES inlined, compareByNameThenScope + Sortable interface added, file header rewritten V2-only)"
    - "extensions/pi-claude-marketplace/shared/errors.ts (+22 lines; +composeErrorWithCauseChain function placed adjacent to its causeChainTrailer dependency)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (Reason migrated to shared/notify.ts; EntityErrorRow inlined file-local from the retired presentation/compact-line.ts; +StatusToken import for the interface)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (Reason migrated; composeErrorWithCauseChain migrated to shared/errors.ts; compareByNameThenScope migrated to shared/notify.ts; presentation imports removed)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (same 3-import migration as reinstall.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts (Reason migrated to shared/notify.ts)"
    - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts (Reason + compareByNameThenScope migrated)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts (Reason migrated)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts (Reason + composeErrorWithCauseChain migrated)"
    - "extensions/pi-claude-marketplace/orchestrators/types.ts (Reason migrated)"
    - "extensions/pi-claude-marketplace/edge/handlers/tools.ts (sourceLogical + ParsedSource migrated from presentation/marketplace-list.ts to domain/source.ts; possible due to BLOCK C amendment)"
    - "extensions/pi-claude-marketplace/edge/args-schema.ts (callback parameter notifyError -> onError at 4 spots + JSDoc + file-header comment paragraph rewritten to point at V2 entry points)"
    - "eslint.config.js (BLOCK C: dropped 'presentation' target zone, removed 'domain' from edge zone's from:, removed 'presentation' from every other zone's from: + message strings; +D-21-02 Phase 21 comment block above edge zone)"
    - "package.json (test + test:coverage:unit globs: dropped 'presentation' brace entry)"
    - "tests/architecture/notify-types.test.ts (line 87 dynamic-import string updated shared/grammar/reasons.ts -> shared/notify.ts)"
    - "tests/architecture/scope-order-drift.test.ts (allowlist path entry at line 53 + error-message template at line 158 updated presentation/sort.ts -> shared/notify.ts)"
    - "tests/architecture/import-boundaries.test.ts (Rule 1 stale-test fix: FOLDERS const drops 'presentation'; EXPECTED_FORBIDDEN map reflects 8-zone topology with edge zone no longer forbidding domain; test title updated to '8 zones')"
    - "tests/transaction/rollback.test.ts (Rule 1 stale-test fix: 3 V1 byte-equivalence tests for composeRollbackPartialChildren deleted; file header docstring updated to point at V2 catalog-uat as the new sentinel)"
  deleted:
    - "extensions/pi-claude-marketplace/presentation/ (12 source files + README.md = 13 entries: cascade-summary.ts, cause-chain.ts, compact-line.ts, index.ts, manual-recovery.ts, marketplace-list.ts, plugin-list.ts, reload-hint.ts, rollback-partial.ts, soft-dep.ts, sort.ts, version-arrow.ts, README.md)"
    - "extensions/pi-claude-marketplace/shared/grammar/ (4 source files: markers.ts, pattern-classes.ts, reasons.ts, status-tokens.ts)"
    - "tests/presentation/ (11 test files = 133 tests: cascade-summary.test.ts, cause-chain.test.ts, compact-line.test.ts, manual-recovery.test.ts, marketplace-list.test.ts, plugin-list.test.ts, reload-hint.test.ts, rollback-partial.test.ts, soft-dep.test.ts, sort.test.ts, version-arrow.test.ts)"
    - "tests/shared/notify.test.ts (1 file, 7 V1 wrapper tests)"
decisions:
  - "D-21-01: shared/grammar/ deleted entirely; REASONS / Reason / STATUS_TOKENS / StatusToken / MARKERS / Marker / PATTERN_CLASSES / PatternClass inlined into shared/notify.ts as the single source of truth"
  - "D-21-02: presentation/ deleted entirely; 5 utilities relocated to their natural homes (composeErrorWithCauseChain -> shared/errors.ts; compareByNameThenScope + Sortable -> shared/notify.ts; EntityErrorRow -> install.ts file-local; sourceLogical/ParsedSource left in their canonical home domain/source.ts and the edge re-export hack retired; renderMarketplaceList dropped entirely with zero live callers)"
  - "D-21-05: V1 severity-named wrappers (notifySuccess, notifyWarning, notifyError) and V1 3-arg notifyUsageError overload deleted from shared/notify.ts"
  - "D-21-06 + D-21-08: ONE atomic commit covers all 47 file changes (refactor(21): consolidate shared/notify.ts + retire V1 + presentation)"
  - "Option A for BLOCK C edge -> domain (RESEARCH §8 CORRECTION 2 recommendation): edge zone's from: array drops the domain/ entry; smallest blast radius, only one current file (edge/handlers/tools.ts) benefits"
  - "D-21-02 N2 promoted to in-scope: BLOCK C dead-presentation cleanup (presentation target zone deleted; presentation token removed from every other zone's from: + message strings) folded into the same commit"
  - "tests/architecture/import-boundaries.test.ts updated to assert the 8-zone post-Phase-21 invariant (Rule 1 stale-test fix; analogous to Plan 21-01's CMC-37 invariant-flip)"
  - "tests/transaction/rollback.test.ts: 3 V1 composeRollbackPartialChildren byte-equivalence tests deleted (Rule 1 stale-test fix; V2 byte form is now owned by tests/architecture/catalog-uat.test.ts)"
metrics:
  duration: "~50 minutes"
  completed: "2026-05-27"
  tests_pre: 1263  # npm test post-Plan-21-01
  tests_post: 1120  # npm test post-Plan-21-02 (1263 - 133 presentation - 7 notify.test.ts - 3 rollback V1 byte-equiv = 1120)
  files_changed: 47
  insertions: 307
  deletions: 4353
---

# Phase 21 Plan 21-02: Source Consolidation -- V1 Deletion + Grammar Inline + Presentation Clean-Sweep Summary

Atomic single-commit retirement of the V1 messaging surface and consolidation of the v1.4 source tree. `shared/notify.ts` is now the SINGLE source of truth for the v1.4 structured-notification grammar -- types + closed-set runtime arrays + renderer + entry points + per-scope comparator all live in one file. The `shared/grammar/`, `presentation/`, and `tests/presentation/` directories are gone; the 4 utilities that still had active consumers were relocated to their natural homes per the D-21-02 domain-relocation-over-orphan-deletion pattern. Closed: SNM-22 (V1 wrappers absent from shared/notify.ts) and SNM-29 (shared/grammar/ aggressively inlined).

## Tasks Completed

1. **Task 21-02-01 -- Add composeErrorWithCauseChain to shared/errors.ts** -- Verified pre-condition (helper not yet present); copied the 1-line composer from `presentation/cause-chain.ts:30` and placed it immediately after `causeChainTrailer`'s dependency cluster (after the internal `linkMessage` helper) so the composer lives adjacent to the walker it wraps. JSDoc rewritten to reference the D-21-02 relocation context and point at the V2 `notify` renderer's per-row cause-chain path. `npm run typecheck` GREEN. No commit -- folded into the atomic Plan 21-02 commit.

2. **Task 21-02-02 -- Rewrite shared/notify.ts header + delete V1 wrappers + inline grammar consts + add compareByNameThenScope** -- The centerpiece edit. (a) Deleted the `import type { Reason } from "./grammar/reasons.ts"` value/type import + the corresponding `export type { Reason } from "./grammar/reasons.ts"` re-export. (b) Deleted `notifySuccess`, `notifyWarning`, `notifyError` function bodies + JSDoc (lines 68-100 pre-edit). (c) Deleted the V1 3-arg `notifyUsageError` overload signature + the V1 branch (`if (typeof message === "string") {...}`) of the implementation function; collapsed the V2 branch into the function body so the function is single-overload `(ctx, UsageErrorMessage) => void`. (d) Inlined `REASONS` (28 entries) + `Reason`, `STATUS_TOKENS` (15 entries) + `StatusToken`, `MARKERS` (2 entries) + `Marker`, `PATTERN_CLASSES` (12 entries) + `PatternClass` near the top of the file as a single contiguous "v1.4 closed-set" section. (e) Added `export interface Sortable {...}` + `export function compareByNameThenScope(a: Sortable, b: Sortable): number` at the bottom alongside the comment block explaining the MSG-GR-3 single-source policy. (f) Rewrote the file header (lines 1-65 pre-edit) to V2-only phrasing -- dropped all references to V1 wrappers and the Phase 16-20 migration window; new header documents the two V2 entry points + the closed-set source-of-truth role. `causeChainTrailer` import survived (used at line ~1091 in `renderIndentedCauseChain` per RESEARCH §8 CORRECTION 9). Final file: 1251 lines (1175 -> 1251, +76 net; planner estimate was ~1235 -- 16 lines off due to denser closed-set JSDoc preservation). All 8 positive grep checks (`export const REASONS`, etc.) return 1; all negative checks (`notify(Success|Warning|Error)`, `usageBlock`, `from "./grammar/"`) return zero. No commit -- folded into the atomic Plan 21-02 commit.

3. **Task 21-02-03 -- Migrate 9 Reason consumer import sites** -- Updated 8 orchestrator files (`orchestrators/types.ts`, `orchestrators/plugin/{install,uninstall,reinstall,update}.ts`, `orchestrators/import/execute.ts`, `orchestrators/marketplace/{remove,update}.ts`) to import `Reason` from `shared/notify.ts`; wherever the file already imported type symbols from `shared/notify.ts` the `Reason` entry was merged into the existing multi-member `import type {...}` block to satisfy `import-x/order`. Updated `tests/architecture/notify-types.test.ts:87` dynamic-import string from `shared/grammar/reasons.ts` to `shared/notify.ts`. Verified zero residual live imports of `shared/grammar/reasons.ts` across `extensions/` and `tests/architecture/`. No commit.

4. **Task 21-02-04 -- Migrate 3 composeErrorWithCauseChain consumer import sites** -- Updated `orchestrators/plugin/reinstall.ts:69`, `orchestrators/plugin/update.ts:83`, `orchestrators/marketplace/update.ts:109` to import `composeErrorWithCauseChain` from `shared/errors.ts`; merged into the existing `shared/errors.ts` value-import block at each call site to satisfy `import-x/order`. The old `presentation/cause-chain.ts` import line removed at each site. No commit.

5. **Task 21-02-05 -- Migrate 3 compareByNameThenScope consumers + EntityErrorRow file-local + edge/handlers/tools.ts -> domain/source.ts + scope-order-drift.test.ts strings** -- (a) Updated `orchestrators/plugin/reinstall.ts:70`, `orchestrators/plugin/update.ts:84`, `orchestrators/import/execute.ts:10` to import `compareByNameThenScope` from `shared/notify.ts`; merged with the existing `notify` value import at each site. (b) Removed `import type { EntityErrorRow }` from `orchestrators/plugin/install.ts:121` and added a file-local `interface EntityErrorRow` declaration immediately after the import block; added `StatusToken` to the existing `shared/notify.ts` type-import block to satisfy the `Extract<StatusToken, "failed" | "unavailable">` usage. (c) Updated `edge/handlers/tools.ts:43,46` to import `sourceLogical` + `ParsedSource` from `domain/source.ts` directly (the canonical home; the presentation re-export hack is retired). (d) Updated `tests/architecture/scope-order-drift.test.ts` line 53 (allowlist path string) and line 158 (error-message template) from `extensions/pi-claude-marketplace/presentation/sort.ts` to `extensions/pi-claude-marketplace/shared/notify.ts`. No commit.

6. **Task 21-02-06 -- Amend eslint.config.js BLOCK C** -- Adopted Option A (RESEARCH §8 CORRECTION 2 recommendation, smallest blast radius). Removed `"./extensions/pi-claude-marketplace/domain"` from the `edge` zone's `from:` array so `edge/handlers/tools.ts` can import `domain/source.ts` directly. Per N2 (promoted to in-scope), deleted the entire `presentation` TARGET zone and removed every `"./extensions/pi-claude-marketplace/presentation"` entry from all other zones' `from:` arrays + updated message strings to drop the `presentation/` mention (`edge` message: "edge/ may only import from orchestrators/, presentation/, shared/, platform/." -> "edge/ may only import from orchestrators/, domain/, shared/, platform/."). Added a comment block above the amended `edge` zone explaining the D-21-02 amendment. Final BLOCK C is 8 zones (down from 9). No commit.

7. **Task 21-02-07 -- Rename edge/args-schema.ts callback parameter notifyError -> onError** -- Used a single `replace_all` Edit to rename the identifier across the file (covers 4 functional spots: `parseArgsOrNotify` parameter + body callsite; `parseCommandArgs` parameter + body callsite; the inner `parseArgsOrNotify(args, onError)` propagation; and the schema-usage error path). Also updated the JSDoc example block at lines 38-54 and the file header comment paragraph (lines 9-13) to reference the V2 entry points (`notify(ctx, pi, NotificationMessage)` / `notifyUsageError(ctx, UsageErrorMessage)`) instead of the deleted V1 `notifyError` wrapper. Verified `! grep -n "notifyError" extensions/pi-claude-marketplace/edge/args-schema.ts` returns empty; verified zero handlers under `edge/handlers/` pass a positional `notifyError:` keyword (handlers pass inline arrow closures per PATTERNS.md). No commit.

8. **Task 21-02-08 -- Delete tests/shared/notify.test.ts** -- `git rm tests/shared/notify.test.ts` (1 file, 91 lines, 7 V1 wrapper tests). Without this delete the suite would compile-fail at the imports of `notifySuccess`/`notifyWarning`/`notifyError` from `shared/notify.ts`. `tests/shared/notify-v2.test.ts` (41 V2 tests) survives untouched. No commit.

9. **Task 21-02-09 -- Delete tests/presentation/** -- Pre-delete checks (per CONTEXT Claude's Discretion): (a) `tests/presentation/marketplace-list.test.ts` had ZERO `sourceLogical`/`ParsedSource` assertions (verified via grep); `tests/domain/source.test.ts` already has 13 references covering the surface. No assertion migration needed. (b) `tests/presentation/cause-chain.test.ts` tested only `causeChainTrailer` (already covered in `tests/architecture/catalog-uat.test.ts` byte-equality + the 30 cause-chain-tagged tests in `tests/shared/notify-v2.test.ts`); no migration needed. (c) `compareByNameThenScope` is exercised indirectly by every multi-marketplace/multi-plugin orchestrator test; no dedicated unit-test block added (planner SKIP default). `git rm -r tests/presentation/` -- 11 files / 133 tests removed. No commit.

10. **Task 21-02-10 -- Delete extensions/pi-claude-marketplace/presentation/** -- `git rm -r extensions/pi-claude-marketplace/presentation/` -- 12 source files + README.md = 13 entries. `renderMarketplaceList` + `MarketplaceListEntry` simply dropped (zero live callers per RESEARCH §8 CORRECTION 6 -- the comment refs at `orchestrators/marketplace/list.ts:18` and `tests/architecture/catalog-uat.test.ts:15` are descriptive prose and were left untouched). No commit.

11. **Task 21-02-11 -- Delete extensions/pi-claude-marketplace/shared/grammar/** -- `git rm -r extensions/pi-claude-marketplace/shared/grammar/` -- 4 source files (markers.ts, pattern-classes.ts, reasons.ts, status-tokens.ts). All consumer imports already migrated by Tasks 21-02-02 (declarations inlined into `shared/notify.ts`) and 21-02-03 (9 Reason consumers migrated). No commit.

12. **Task 21-02-12 -- Update package.json globs** -- Removed `presentation,` from both the `test` script (line 76) and the `test:coverage:unit` script (line 80) brace expansions. Used a single `replace_all` Edit since the brace expansion is byte-identical in both lines. Verified `! grep "presentation" package.json` returns empty. No commit.

13. **Task 21-02-13 -- Pre-commit gate + atomic single commit** -- `npm run check` first run surfaced a typecheck failure (`tests/transaction/rollback.test.ts:4` imports `composeRollbackPartialChildren` from the deleted `presentation/rollback-partial.ts`) -- this was a research miss; CONTEXT + RESEARCH did not flag this file. Applied Rule 1 (stale test) auto-fix: removed the 3 V1 byte-equivalence tests for `composeRollbackPartialChildren` (the V2 form is now owned by `tests/architecture/catalog-uat.test.ts`); updated the file's header docstring + the comment at line ~79 to reference the V2 surface; kept the 5 remaining `formatRollbackError` tests untouched. Subsequent `npm run check` surfaced two more issues: (a) one `import-x/order` lint error in `shared/notify.ts` (the new type-import block placed `./types.ts` after `../platform/pi-api.ts` -- fixed by swapping order; sibling-before-parent in the type group); (b) 3 prettier formatting warnings (`eslint.config.js`, `remove.ts`, `uninstall.ts`) -- fixed via `npx prettier --write` (the long type-import lines I authored exceeded the line limit and were collapsed to single-line form by prettier). The second `npm run check` pass surfaced a third stale-test failure: `tests/architecture/import-boundaries.test.ts` asserted "exactly 9 zones" + `EXPECTED_FORBIDDEN` had `presentation` entries. Applied Rule 1 stale-test fix: updated `FOLDERS` const to drop `presentation`; updated `EXPECTED_FORBIDDEN` map to reflect the new 8-zone topology with `edge` no longer forbidding `domain`; updated test title to "exactly 8 zones (one per folder) -- D-11 (Phase 21 retired presentation/)". Third `npm run check` pass GREEN (1120 pass / 0 fail). Staged all 47 files explicitly; ran `pre-commit run --files $(git diff --cached --name-only)` -- TruffleHog failed due to documented worktree sandbox issue (per CLAUDE.md); ran `pre-commit run trufflehog --all-files` from the main repo path -- passed. Committed with `SKIP=trufflehog` prefix per CLAUDE.md worktree guidance. Commit `4fdd771` landed: `refactor(21): consolidate shared/notify.ts + retire V1 + presentation`.

## Files Created/Modified

| File | Change | Notes |
|------|--------|-------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | modified | 1175 -> 1251 lines; +76 net. V1 wrappers removed; V2 notifyUsageError collapsed to single overload; REASONS/STATUS_TOKENS/MARKERS/PATTERN_CLASSES const tuples + Reason/StatusToken/Marker/PatternClass type aliases inlined; compareByNameThenScope + Sortable added; file header rewritten V2-only |
| `extensions/pi-claude-marketplace/shared/errors.ts` | modified | +22 lines (+composeErrorWithCauseChain function adjacent to causeChainTrailer dependency) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | modified | Reason import migrated; EntityErrorRow inlined file-local; +StatusToken type import for the interface |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | modified | Reason + composeErrorWithCauseChain + compareByNameThenScope all migrated; 2 presentation/* imports removed |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | modified | Same 3-import migration as reinstall.ts |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | modified | Reason migrated to shared/notify.ts (merged into existing type-import block) |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | modified | Reason + compareByNameThenScope migrated; presentation/sort.ts import removed |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | modified | Reason migrated (merged into existing type-import block) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | modified | Reason + composeErrorWithCauseChain migrated |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | modified | Reason migrated |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | modified | sourceLogical + ParsedSource migrated from presentation/marketplace-list.ts to domain/source.ts (BLOCK C amended to allow) |
| `extensions/pi-claude-marketplace/edge/args-schema.ts` | modified | notifyError -> onError (4 functional spots + JSDoc + file-header paragraph) |
| `eslint.config.js` | modified | BLOCK C: dropped presentation TARGET zone; removed domain from edge zone's from:; removed presentation from every other zone's from: + message strings; +D-21-02 amendment comment block above edge zone |
| `package.json` | modified | test + test:coverage:unit globs: dropped 'presentation' brace entry (both lines 76 + 80) |
| `tests/architecture/notify-types.test.ts` | modified | line 87 dynamic-import string: shared/grammar/reasons.ts -> shared/notify.ts |
| `tests/architecture/scope-order-drift.test.ts` | modified | line 53 allowlist + line 158 error-message template: presentation/sort.ts -> shared/notify.ts |
| `tests/architecture/import-boundaries.test.ts` | modified | Rule 1 stale-test fix: FOLDERS const + EXPECTED_FORBIDDEN map updated for 8-zone post-Phase-21 topology; test title updated to "8 zones" |
| `tests/transaction/rollback.test.ts` | modified | Rule 1 stale-test fix: 3 V1 byte-equivalence tests for composeRollbackPartialChildren removed; file header docstring + line ~79 comment updated to point at V2 catalog-uat sentinel |
| `extensions/pi-claude-marketplace/presentation/` | deleted | 12 source files + README.md (entire directory) |
| `extensions/pi-claude-marketplace/shared/grammar/` | deleted | 4 source files (markers.ts, pattern-classes.ts, reasons.ts, status-tokens.ts) |
| `tests/presentation/` | deleted | 11 test files / 133 inner tests (entire directory) |
| `tests/shared/notify.test.ts` | deleted | 1 file / 7 V1 wrapper tests |
| `.planning/phases/21-final-teardown-green-gate/21-02-SUMMARY.md` | created | this file |

## Verification Matrix: All Plan 21-02 Success Criteria

| SC | Description | Command | Observed Result | Exit | Status |
|----|-------------|---------|-----------------|------|--------|
| SNM-22 | V1 severity wrappers absent from shared/notify.ts | `! grep -nE "^export function notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/shared/notify.ts` | no matches | 0 (predicate) | **GREEN** |
| SNM-22 (live callers) | Zero live V1 wrapper callsites anywhere | `! grep -rnE 'notify(Success\|Warning\|Error)\(' extensions/ tests/ \| grep -vE '//\|^\s*\*'` | no non-comment matches | 0 (predicate) | **GREEN** |
| SNM-22 (V1 3-arg overload) | usageBlock removed from shared/notify.ts | `! grep -n "usageBlock" extensions/pi-claude-marketplace/shared/notify.ts` | no matches | 0 (predicate) | **GREEN** |
| SNM-29 | shared/grammar/ absent on disk | `! test -d extensions/pi-claude-marketplace/shared/grammar` | absent | 0 (predicate) | **GREEN** |
| SNM-29 (closed sets inlined) | REASONS/STATUS_TOKENS/MARKERS/PATTERN_CLASSES exported from shared/notify.ts | `grep -c "^export const REASONS" + "^export const STATUS_TOKENS" + "^export const MARKERS" + "^export const PATTERN_CLASSES" extensions/pi-claude-marketplace/shared/notify.ts` | 1 + 1 + 1 + 1 | 0 | **GREEN** |
| SNM-29 (live grammar imports) | Zero live `shared/grammar/*` imports in extensions/ | `! grep -rn "from \".*shared/grammar/" extensions/pi-claude-marketplace/` | no matches | 0 (predicate) | **GREEN** |
| D-21-02 directory delete | presentation/ absent on disk | `! test -d extensions/pi-claude-marketplace/presentation` | absent | 0 (predicate) | **GREEN** |
| D-21-02 directory delete | tests/presentation/ absent on disk | `! test -d tests/presentation` | absent | 0 (predicate) | **GREEN** |
| RESEARCH §8 CORRECTION 1 | tests/shared/notify.test.ts absent | `! test -f tests/shared/notify.test.ts` | absent | 0 (predicate) | **GREEN** |
| D-21-02 BLOCK C amendment | edge zone's `from:` no longer contains domain | `grep -A 6 'target: "./extensions/pi-claude-marketplace/edge"' eslint.config.js \| (! grep -q "/domain\",")` | no domain entry | 0 (predicate) | **GREEN** |
| D-21-02 BLOCK C dead presentation cleanup | Zero presentation references in eslint.config.js | `! grep -n "presentation" eslint.config.js` | no matches | 0 (predicate) | **GREEN** |
| RESEARCH §8 CORRECTION 5 | scope-order-drift test strings updated | `! grep -n "presentation/sort\\.ts" tests/architecture/scope-order-drift.test.ts` | no matches | 0 (predicate) | **GREEN** |
| RESEARCH §8 CORRECTION 7 | package.json no `presentation` in globs | `! grep "presentation" package.json` | no matches | 0 (predicate) | **GREEN** |
| D-21-02 EntityErrorRow inline | install.ts declares EntityErrorRow file-local | `grep -c "interface EntityErrorRow" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 1 | 0 | **GREEN** |
| D-21-02 edge -> domain direct | tools.ts imports domain/source.ts | `grep -n "domain/source" extensions/pi-claude-marketplace/edge/handlers/tools.ts` | 2 matches (value + type) | 0 | **GREEN** |
| D-21-02 args-schema rename | edge/args-schema.ts has zero notifyError | `! grep -n "notifyError" extensions/pi-claude-marketplace/edge/args-schema.ts` | no matches | 0 (predicate) | **GREEN** |
| D-21-02 compareByNameThenScope inline | comparator + Sortable exported from shared/notify.ts | `grep -c "^export function compareByNameThenScope" + "^export interface Sortable" extensions/pi-claude-marketplace/shared/notify.ts` | 1 + 1 | 0 | **GREEN** |
| D-21-02 composeErrorWithCauseChain | helper exported from shared/errors.ts | `grep -c "^export function composeErrorWithCauseChain" extensions/pi-claude-marketplace/shared/errors.ts` | 1 | 0 | **GREEN** |
| RESEARCH §8 CORRECTION 9 | causeChainTrailer import survives in shared/notify.ts | `grep -c "causeChainTrailer" extensions/pi-claude-marketplace/shared/notify.ts` | 2 (import + V2 renderer use at line ~1091) | 0 | **GREEN** |
| V2 notifyUsageError | single overload uses ctx.ui.notify exactly once | `grep -A 3 "^export function notifyUsageError" extensions/pi-claude-marketplace/shared/notify.ts \| grep -c 'ctx\\.ui\\.notify('` | 1 | 0 | **GREEN** |
| Atomic single commit | one commit covers all 47 changes | `git log -1 --pretty=%s` | `refactor(21): consolidate shared/notify.ts + retire V1 + presentation` | 0 | **GREEN** |
| Commit body line-length | every body line <=80 chars | `git log -1 --pretty=%B \| awk 'length>80' \| wc -l` | 0 | 0 | **GREEN** |
| Working tree clean | no residual unstaged changes | `git status --porcelain \| wc -l` | 0 | 0 | **GREEN** |
| `npm run check` full pipeline | typecheck + lint + format + tests all pass | `npm run check` | 1120 pass / 0 fail / 0 skipped / 0 todo | 0 | **GREEN** |

## NO-CHANGE Invariant Re-Verification

| Invariant | Command | Observed | Expected | Status |
|-----------|---------|----------|----------|--------|
| V2 entry points still present in shared/notify.ts | `grep -c "^export function notify(" + "^export function notifyUsageError(" extensions/pi-claude-marketplace/shared/notify.ts` | 1 + 1 | 1 + 1 | **PASS** |
| `tests/shared/notify-v2.test.ts` survives untouched | `test -f tests/shared/notify-v2.test.ts` | exists | exists | **PASS** |
| `tests/architecture/markers-snapshot.test.ts` survives (Phase 5/7 markers orthogonal) | `test -f tests/architecture/markers-snapshot.test.ts` | exists | exists | **PASS** |
| `tests/architecture/catalog-uat.test.ts` survives (V2 catalog sentinel) | `test -f tests/architecture/catalog-uat.test.ts` | exists | exists | **PASS** |
| `tests/architecture/notify-types.test.ts` survives (Reason invariance proof) | `test -f tests/architecture/notify-types.test.ts` | exists | exists | **PASS** |
| `shared/markers.ts` still exports Phase 5/7 extension markers | `grep -c "RECOVERY_PLUGIN_REINSTALL_PREFIX\|STATE_LOCK_HELD_PREFIX" extensions/pi-claude-marketplace/shared/markers.ts` | 2 | 2 | **PASS** |
| `domain/source.ts` still declares sourceLogical + ParsedSource canonically | `grep -c "^export function sourceLogical\|^export interface ParsedSource\|^export type ParsedSource" extensions/pi-claude-marketplace/domain/source.ts` | >=2 | >=2 | **PASS** |
| BLOCK C 8-zone topology in eslint.config.js | `grep -c "target: \"./extensions/pi-claude-marketplace/" eslint.config.js` | 8 | 8 | **PASS** |
| `npm test` no "no files found" warnings | `npm test 2>&1 \| grep -i "no files"` | empty | empty | **PASS** |
| Plan 21-01 invariants preserved (no MSG-* import) | `! grep "import msgPlugin\|msg/" eslint.config.js` | no matches | no matches | **PASS** |
| Plan 21-01 invariants preserved (no inline eslint-disable in migrate.ts) | `! grep "eslint-disable-next-line" extensions/pi-claude-marketplace/persistence/migrate.ts` | no matches | no matches | **PASS** |

## Decisions Made

- **Option A for BLOCK C edge -> domain (RESEARCH §8 CORRECTION 2):** Adopted; the smallest blast-radius amendment removes `domain/` from the `edge` zone's `from:` array. Only one current file (`edge/handlers/tools.ts`) benefits from the relaxation, and BLOCK C's overall direction is still enforced for `bridges`, `transaction`, and `persistence`. Alternative options (per-file override, or moving the re-export to `shared/`) would have either fragmented the lint config or defeated the cleanup goal.

- **N2 dead-presentation cleanup promoted to in-scope (planner discretion per Task 21-02-06 action note):** The plan recommended folding the BLOCK C `presentation`-token cleanup (target zone + every other zone's `from:` arrays + message strings) into the same commit so BLOCK C contains no path that no longer exists. Done -- final BLOCK C is 8 zones with zero `presentation` references.

- **Skip optional comment-only `shared/grammar/` reference updates (planner default per Task 21-02-03 + others):** Several test files and orchestrator JSDoc blocks reference `shared/grammar/...` paths in comments (e.g., `tests/e2e/install-soft-deps.test.ts:11`, `tests/orchestrators/plugin/reinstall.test.ts` 4 spots, `orchestrators/plugin/install.ts` 2 spots, `orchestrators/plugin/uninstall.ts:99`). These are descriptive prose; updating them is cosmetic and was skipped per RESEARCH §2 + PATTERNS.md default. Substantive zero-live-import invariant is met.

- **Skip `renderMarketplaceList` inline (RESEARCH §8 CORRECTION 6):** CONTEXT D-21-02 originally instructed inlining `renderMarketplaceList` + `MarketplaceListEntry` into `orchestrators/marketplace/list.ts`. RESEARCH §8 CORRECTION 6 found the function had ZERO live callers (the orchestrator imports `notify` directly from `shared/notify.ts` instead). The correction was honored -- `renderMarketplaceList` + `MarketplaceListEntry` are dropped entirely with no inline.

- **Skip `MarketplaceListEntry` placement decision (CONTEXT Claude's Discretion):** Moot per above; no inline happened.

- **Skip `composeErrorWithCauseChain` inline-at-callers (CONTEXT Claude's Discretion):** Kept as an exported named function in `shared/errors.ts` (recommended default). The 3 call sites are byte-identical and the named export is more readable.

- **`Sortable` interface exported (planner choice):** Made `Sortable` a public exported interface alongside `compareByNameThenScope` rather than file-private (V1 had it file-private). Rationale: any future caller that constructs a row type intended to be sorted can structurally declare it `Sortable`, and exporting the contract surface alongside the comparator is consistent with the rest of the `shared/notify.ts` public API.

- **`shared/notify.ts` stays one file (CONTEXT Claude's Discretion):** File grew to 1251 lines (planner estimate was ~1235; +16 lines off due to denser closed-set JSDoc preservation). Still well under 1500; no split needed.

- **No new `compareByNameThenScope` unit-test block (CONTEXT Claude's Discretion + RESEARCH §5):** The comparator is exercised indirectly by every multi-marketplace/multi-plugin orchestrator test. Adding redundant unit coverage is low value.

- **Skip test-assertion migration from `tests/presentation/` deletion (CONTEXT Claude's Discretion per Task 21-02-09):** Pre-delete grep checks confirmed `tests/presentation/marketplace-list.test.ts` has ZERO `sourceLogical`/`ParsedSource` assertions (covered in `tests/domain/source.test.ts` via 13 references) and `tests/presentation/cause-chain.test.ts` tested only `causeChainTrailer` (covered by `tests/architecture/catalog-uat.test.ts` byte-equality + 30 cause-tagged tests in `tests/shared/notify-v2.test.ts`). No migration needed.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 -- Stale Test] `tests/transaction/rollback.test.ts` V1 byte-equivalence tests for composeRollbackPartialChildren**
   - **Found during:** Task 21-02-13 first `npm run check` pass (typecheck reported `Cannot find module '../../extensions/pi-claude-marketplace/presentation/rollback-partial.ts'`).
   - **Issue:** The file imported `composeRollbackPartialChildren` from the deleted `presentation/rollback-partial.ts` to drive 3 V1 byte-equivalence tests. RESEARCH and CONTEXT did not flag this file as a consumer of `presentation/`; it's a transaction-layer test that incidentally crossed into the presentation surface for V1 byte assertions.
   - **Fix:** Removed the 3 V1 byte-equivalence tests (`composeRollbackPartialChildren produces the byte-equivalent catalog children block`, `... returns empty string for zero partials`, `... handles a single partial`). The V2 byte form is now owned by `tests/architecture/catalog-uat.test.ts` against the V2 renderer in `shared/notify.ts` (specifically `composeRollbackPartialLines`). Updated the file header docstring + line ~79 comment to point at the V2 surface. Preserved the 5 `formatRollbackError` tests (transaction-layer behavior, unrelated to presentation deletion).
   - **Files modified:** `tests/transaction/rollback.test.ts` (--58 lines diff: removed 3 tests + their JSDoc; added a 7-line comment block explaining the V1->V2 supersession).
   - **Commit:** Folded into atomic Plan 21-02 commit `4fdd771`.

2. **[Rule 1 -- Stale Test] `tests/architecture/import-boundaries.test.ts` 9-zone assertion + presentation references**
   - **Found during:** Task 21-02-13 second `npm run check` pass (test runner reported 2 failures: `import-x/no-restricted-paths defines exactly 9 zones (one per folder) -- D-11` and `each zone's target+from set matches the D-11 allowed-imports matrix`).
   - **Issue:** The test asserted the v1.3 invariant of 9 zones + an `EXPECTED_FORBIDDEN` map that included a `presentation` target entry and `presentation` entries in every other zone's `from:` array, plus a `domain` entry in `edge`'s forbidden set. Under D-21-02 the topology drops to 8 zones with the presentation references removed and edge no longer forbidding domain.
   - **Fix:** Updated `FOLDERS` const to drop `presentation`; updated `EXPECTED_FORBIDDEN` map to reflect the 8-zone topology (edge no longer forbids domain; presentation TARGET zone gone; no presentation entries in other zones' forbidden sets); updated test title from "9 zones" to "8 zones (one per folder) -- D-11 (Phase 21 retired presentation/)" and added a `Phase 21 (D-21-02) retired the presentation/ folder` comment block above the `FOLDERS` const explaining the post-Phase-21 invariant. The test logic itself (zone count assertion + per-zone forbidden-set deepEqual) is unchanged.
   - **Files modified:** `tests/architecture/import-boundaries.test.ts` (--19 lines diff: removed presentation references; added new comment block).
   - **Commit:** Folded into atomic Plan 21-02 commit `4fdd771`.

3. **[Rule 1 -- Lint Order] `shared/notify.ts` type-import order swap**
   - **Found during:** Task 21-02-13 second `npm run check` pass (lint reported 1 error: `./types.ts type import should occur before type import of ../platform/pi-api.ts`).
   - **Issue:** After deleting the `import type { Reason } from "./grammar/reasons.ts"` line in Task 21-02-02, the remaining two type imports (`ExtensionAPI`/etc from `../platform/pi-api.ts` and `Scope` from `./types.ts`) were in the wrong relative order per `import-x/order`'s sibling-before-parent convention in the type group.
   - **Fix:** Swapped the two lines so `./types.ts` precedes `../platform/pi-api.ts`.
   - **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts` (--2 +2 lines).
   - **Commit:** Folded into atomic Plan 21-02 commit `4fdd771`.

4. **[Rule 1 -- Prettier] 3 prettier formatting fixes**
   - **Found during:** Task 21-02-13 second `npm run check` pass (`format:check` reported 3 files: `eslint.config.js`, `orchestrators/marketplace/remove.ts`, `orchestrators/plugin/uninstall.ts`).
   - **Issue:** Multi-line type-import blocks I authored for `remove.ts` and `uninstall.ts` exceeded prettier's preferred line-collapse heuristic; `eslint.config.js` had whitespace drift from my BLOCK C edit.
   - **Fix:** Ran `npx prettier --write` on the 3 files. Prettier collapsed the multi-line type imports back to single-line where they fit under the column limit and fixed the eslint.config.js whitespace.
   - **Files modified:** `eslint.config.js`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`.
   - **Commit:** Folded into atomic Plan 21-02 commit `4fdd771`.

No Rule 2 (missing critical functionality), Rule 3 (blocking install), or Rule 4 (architectural decision) deviations occurred. The deviations above all fall under Rule 1 (auto-fix bugs / stale-tests) -- analogous to Plan 21-01's CMC-37 stale-test fix where a v1.3 invariant required re-targeting under the new post-teardown invariant.

## Authentication Gates

None -- Plan 21-02 is pure file-system + git work; no network or credentialed surfaces touched.

## Known Stubs

None -- Plan 21-02 is a teardown + consolidation plan; no stubs or placeholders introduced. The `MARKERS` and `PATTERN_CLASSES` const tuples have zero live consumers in extension code today and are preserved in `shared/notify.ts` as documented closed sets per D-21-01 -- this is deliberate documentation of what the v1.4 grammar structurally encodes, not a stub awaiting implementation.

## Threat Flags

None -- Plan 21-02 only DELETES surface area (V1 wrappers, V1 byte forms, grammar source files, presentation rendering layer, V1 wrapper tests) and RELOCATES utilities to their canonical homes. No new endpoints, no new auth paths, no new file-access patterns, no schema changes, no trust-boundary changes. The reduction in surface (4353 lines deleted vs 307 added) is monotonically safer than the pre-plan state.

## Self-Check: PASSED

- **Files exist as claimed:**
  - `extensions/pi-claude-marketplace/shared/notify.ts` -- exists, 1251 lines (verified `wc -l`).
  - `extensions/pi-claude-marketplace/shared/errors.ts` -- exists, +composeErrorWithCauseChain present (`grep -c "^export function composeErrorWithCauseChain"` returns 1).
  - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- exists, EntityErrorRow inlined file-local (`grep -c "interface EntityErrorRow"` returns 1).
  - `extensions/pi-claude-marketplace/edge/handlers/tools.ts` -- exists, sourceLogical + ParsedSource imported from domain/source.ts (`grep -n "domain/source"` returns 2 matches).
  - `extensions/pi-claude-marketplace/edge/args-schema.ts` -- exists, zero `notifyError` occurrences (`! grep -n "notifyError"` returns 0).
  - `eslint.config.js` -- exists, zero `presentation` substrings (`! grep "presentation"` returns 0).
  - `package.json` -- exists, zero `presentation` substrings.
  - `.planning/phases/21-final-teardown-green-gate/21-02-SUMMARY.md` -- created (this file).

- **Files absent as claimed:**
  - `extensions/pi-claude-marketplace/presentation/` -- absent (`! test -d` succeeds).
  - `extensions/pi-claude-marketplace/shared/grammar/` -- absent.
  - `tests/presentation/` -- absent.
  - `tests/shared/notify.test.ts` -- absent.

- **Commit exists:** `git log --oneline -1` shows `4fdd771 refactor(21): consolidate shared/notify.ts + retire V1 + presentation` at HEAD.

- **`npm run check` post-commit:** GREEN (1120 pass / 0 fail / 0 skipped / 0 todo).
