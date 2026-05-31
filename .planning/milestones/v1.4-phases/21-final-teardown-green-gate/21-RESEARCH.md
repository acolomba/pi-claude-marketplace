# Phase 21 Research -- Final Teardown & GREEN Gate

**Researched:** 2026-05-27
**Domain:** Deletion + relocation across ESLint config, MSG-* lint plugin, V1 wrappers, grammar/, presentation/
**Confidence:** HIGH (verification-only; CONTEXT.md is authoritative)
**Status:** COMPLETE

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-21-01:** `shared/grammar/` deleted entirely; inline `REASONS`/`Reason`/`STATUS_TOKENS`/`StatusToken`/`MARKERS`/`Marker`/`PATTERN_CLASSES`/`PatternClass` into `shared/notify.ts`. CONTEXT claims 11 active import sites; **verified actual = 10 today; net 9 after compact-line.ts is deleted** (see §2 + §8 CORRECTION 3).
- **D-21-02:** `presentation/` deleted entirely (12 source + README). 5 relocations: `sourceLogical`+`ParsedSource`→`domain/source.ts` (**already canonical there -- see §8 CORRECTION 2**); `EntityErrorRow`→`orchestrators/plugin/install.ts`; `composeErrorWithCauseChain`→`shared/errors.ts`; `compareByNameThenScope`→`shared/notify.ts`; `renderMarketplaceList`+`MarketplaceListEntry` inlined into `orchestrators/marketplace/list.ts` (**but `renderMarketplaceList` has ZERO live callers -- see §8 CORRECTION 6**). `tests/presentation/` (11 files / 133 tests) deleted.
- **D-21-03:** `tests/architecture/no-legacy-markers.test.ts` deleted entirely (SNM-28 deletion arm).
- **D-21-04:** `eslint.config.js` mostly deletions. Delete MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 + `msgPlugin` import + two `tests/lint-rules/**` overrides. Retain BLOCKS A/B/C/D/E. Add block-level `persistence/migrate.ts` no-console override. Update BLOCK A message strings to V2-only phrasing.
- **D-21-05:** Delete from `shared/notify.ts`: `notifySuccess` (line 68), `notifyWarning` (line 73), `notifyError` (line 96), V1 3-arg `notifyUsageError` overload (line 127), V1 3-arg impl branch (lines 135-144). **All line numbers VERIFIED -- see §4**. Update file header comments (lines 17-44) to V2-only.
- **D-21-06:** 3 plans, 2 waves. Plan 21-01 (lint teardown, atomic). Plan 21-02 (source consolidation, atomic). Plan 21-03 (final GREEN gate).
- **D-21-07:** No pilot/recipe block needed.
- **D-21-08:** Wave 2 cannot be parallelized (dense `shared/notify.ts` cross-deps).
- **D-21-09:** Test count is consequence, not decision. **Mechanical arithmetic in §5: 1367 → 1192 expected.**

### Claude's Discretion
- Internal `shared/notify.ts` layout for inlined declarations.
- `tests/architecture/markers-snapshot.test.ts` review (expected unchanged -- verified orthogonal).
- `tests/architecture/notify-types.test.ts` consumer migration (one-line import path change at line 87).
- Plan 21-02 commit granularity (default 1 atomic; split allowed if >>200 files -- **actual ~44 files, well under threshold**).
- `tests/presentation/marketplace-list.test.ts` assertion migration if unique.
- `composeErrorWithCauseChain` post-inline export shape.
- `MarketplaceListEntry` placement (file-local vs exported).
- CHANGELOG entry phrasing.
- Whether `shared/notify.ts` post-D-21-01 stays one file.
- **NEW (uncovered by research):** BLOCK C strategy for `edge/handlers/tools.ts` → `domain/source.ts` direct import -- three options enumerated in §8 CORRECTION 2.

### Deferred Ideas (OUT OF SCOPE)
- `shared/markers.ts` cleanup.
- `docs/messaging-style-guide.md` post-v1.4 review.
- `docs/output-catalog.md` per-command usage-error fixtures.
- Test-helper extraction for `makeCtx()`.
- Branded `Version` type.
- Type-model amendments for top-level cause-bearing failure.
- v1.5 milestone planning.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-22 | V1 severity-named wrappers deleted from `shared/notify.ts` | §4 -- wrapper deletion verification |
| SNM-24 | `tests/lint-rules/` deleted in full | §1 -- file inventory (73 files) |
| SNM-25 | `tests/architecture/msg-rule-registry.test.ts` deleted | §1 -- file inventory |
| SNM-27 | `eslint.config.js` cleaned of all 34 MSG-* wirings | §3 -- eslint.config.js block map |
| SNM-28 | `no-legacy-markers.test.ts` reviewed/updated (DELETE arm) | §1 -- file inventory |
| SNM-29 | `shared/grammar/` deleted (aggressive inline arm) | §2 -- consumer sites |
| SNM-32 | `npm run check` GREEN after all migrations land | §5 -- test-count arithmetic + Validation Architecture |

## 1. File Inventories (VERIFIED)

### `tests/lint-rules/` -- total 73 files

| Category | Count | Notes |
|----------|-------|-------|
| Plugin shell (`index.js` + `index.d.ts`) | 2 | Top-level plugin entry |
| `lib/` helpers | 3 | `frontmatter.js`, `frontmatter.d.ts`, `sr-tokens.js` |
| MSG-* rule source files (`msg-*.js`, NOT `.test.js`) | 34 | One per rule |
| MSG-* RuleTester files (`msg-*.test.js`) | 34 | 1:1 with rule files |
| **Total** | **73** | Verified via `find tests/lint-rules -type f \| wc -l` |

Full subdir tree: `tests/lint-rules/` (top) + `tests/lint-rules/lib/`. No other subdirs.

### `tests/presentation/` -- 11 test files (VERIFIED)
`cascade-summary.test.ts`, `cause-chain.test.ts`, `compact-line.test.ts`, `manual-recovery.test.ts`, `marketplace-list.test.ts`, `plugin-list.test.ts`, `reload-hint.test.ts`, `rollback-partial.test.ts`, `soft-dep.test.ts`, `sort.test.ts`, `version-arrow.test.ts`. Matches CONTEXT exactly.

### `extensions/pi-claude-marketplace/presentation/` -- 12 source files + 1 README (VERIFIED)
`cascade-summary.ts`, `cause-chain.ts`, `compact-line.ts`, `index.ts`, `manual-recovery.ts`, `marketplace-list.ts`, `plugin-list.ts`, `reload-hint.ts`, `rollback-partial.ts`, `soft-dep.ts`, `sort.ts`, `version-arrow.ts`, plus `README.md`. Matches CONTEXT exactly.

### `extensions/pi-claude-marketplace/shared/grammar/` -- 4 source files (VERIFIED)
`markers.ts`, `pattern-classes.ts`, `reasons.ts`, `status-tokens.ts`. Matches CONTEXT exactly.

### Architecture tests on disk
| File | Exists? | Disposition |
|------|---------|-------------|
| `tests/architecture/msg-rule-registry.test.ts` | yes (7.5K, 4 inner tests) | DELETE (Plan 21-01) |
| `tests/architecture/no-legacy-markers.test.ts` | yes (5.9K, 1 inner test) | DELETE (Plan 21-01) |
| `tests/architecture/markers-snapshot.test.ts` | yes (3.9K) | RETAIN (orthogonal) |
| `tests/architecture/notify-types.test.ts` | yes (27K) | RETAIN -- one-line import update at line 87 |
| `tests/architecture/catalog-uat.test.ts` | yes (43K) | RETAIN -- green-gate sentinel |
| `tests/architecture/grammar-frontmatter.test.ts` | **absent** | Already deleted in earlier v1.4 work (CONTEXT verified) |

### `tests/shared/` -- relevant inventory
| File | Tests | Disposition |
|------|-------|-------------|
| `tests/shared/notify.test.ts` | 7 | **DELETE -- V1 wrapper tests, MISSED BY CONTEXT (see §8 CORRECTION 1)** |
| `tests/shared/notify-v2.test.ts` | 41 | RETAIN -- V2 surface coverage |
| Other `tests/shared/*.test.ts` (atomic-json, completion-cache, errors, errors-bridges, fs-utils, index-smoke, path-safety, vars) | various | RETAIN |

## 2. Consumer Sites (VERIFIED)

### `shared/grammar/markers.ts` consumers
**Zero external consumers** (grep returns only the file itself). CONTEXT verified -- `MARKERS`/`Marker` is a documented closed-set orphan. Inline into notify.ts is preservation-only.

### `shared/grammar/pattern-classes.ts` consumers
**Zero external consumers** (grep returns only the file itself). CONTEXT verified -- `PATTERN_CLASSES`/`PatternClass` is a documented closed-set orphan. Same preservation rationale.

### `shared/grammar/reasons.ts` consumers -- 10 live importers today, 9 to migrate

| File | Line | Import | Survives Plan 21-02? |
|------|------|--------|---|
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | 10 | `import type { Reason } from "../shared/grammar/reasons.ts";` | Yes -- migrate to `shared/notify.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 62 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 122 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 98 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 116 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | 25 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | 73 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 131 | `import type { Reason } from "../../shared/grammar/reasons.ts";` | Yes -- migrate |
| `extensions/pi-claude-marketplace/presentation/compact-line.ts` | 58 | `import type { Reason } from "../shared/grammar/reasons.ts";` | **No -- file deleted** |
| `tests/architecture/notify-types.test.ts` | 87 | `type _Reason = import("../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts").Reason;` | Yes -- migrate (string path update) |

Also `shared/notify.ts:14`: existing `export type { Reason } from "./grammar/reasons.ts";` -- replaced by inline declaration.

Comment-only refs (cosmetic update optional): `tests/e2e/install-soft-deps.test.ts:11`, `orchestrators/plugin/install.ts:1195` + `:1215`, `orchestrators/plugin/uninstall.ts:100`.

**Net migration: 9 file edits** (8 orchestrator imports + 1 architecture-test type-import path).

### `shared/grammar/status-tokens.ts` consumers -- 1 importer today, 0 to migrate

| File | Line | Import | Survives Plan 21-02? |
|------|------|--------|---|
| `extensions/pi-claude-marketplace/presentation/compact-line.ts` | 59 | `import type { StatusToken } from "../shared/grammar/status-tokens.ts";` | **No -- file deleted** |

**Net migration: 0 file edits.** CONTEXT correctly noted the `StatusToken` re-export from `shared/notify.ts` is **NEW** (no current re-export exists; only `Reason` is re-exported today at line 14).

Comment-only ref (cosmetic): `tests/shared/notify-v2.test.ts:1443`, `tests/orchestrators/plugin/reinstall.test.ts:1217,1233,1472,1527`.

### `presentation/marketplace-list.ts` (`sourceLogical` / `ParsedSource`) -- RE-EXPORT, not duplicate

**CRITICAL FINDING (see §8 CORRECTION 2):** The presentation copy is a RE-EXPORT from `domain/source.ts` (lines 37, 44, 51-52):
```ts
import { sourceLogical } from "../domain/source.ts";
import type { ParsedSource } from "../domain/source.ts";
// ...
export { sourceLogical };
export type { ParsedSource };
```
`domain/source.ts` is already the canonical home (`ParsedSource` at line 70, `sourceLogical` at line 389). The re-export exists because BLOCK C blocks `edge/` → `domain/`. The sole consumer of the re-export today:

| File | Line | Import |
|------|------|--------|
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | 43 | `import { sourceLogical } from "../../presentation/marketplace-list.ts";` |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | 46 | `import type { ParsedSource } from "../../presentation/marketplace-list.ts";` |

**CONTEXT claim of "9 consumers" is incorrect.** Likely counted system-wide consumers of `sourceLogical`/`ParsedSource` (8 already on `domain/source.ts` direct + 1 via re-export). The 8 direct consumers below need NO Phase 21 action (unaffected by deletion):

| Already on domain/source.ts | Line |
|-----------------------------|------|
| `domain/resolver.ts` | 31 |
| `orchestrators/plugin/update.ts` | 112 |
| `orchestrators/marketplace/update.ts` | 127 |
| `orchestrators/import/execute.ts` | 1 |
| `domain/index.ts` | 3 |
| `tests/domain/source.test.ts` | 8 |
| `persistence/state-io.ts:180` | comment only |
| `orchestrators/marketplace/add.ts:309` | comment only |

**Real Phase 21 work for `sourceLogical`/`ParsedSource`:** delete the re-export (happens automatically when `presentation/marketplace-list.ts` is deleted) AND update **1 file** (`edge/handlers/tools.ts` lines 43, 46) to import from `domain/source.ts`. **BLOCK C must be amended to allow this.**

### `presentation/compact-line.ts` (`EntityErrorRow`) consumer
| File | Line | Import |
|------|------|--------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 121 | `import type { EntityErrorRow } from "../../presentation/compact-line.ts";` |

**ONE consumer.** Matches CONTEXT exactly.

### `presentation/cause-chain.ts` (`composeErrorWithCauseChain`) consumers
| File | Line | Import |
|------|------|--------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 69 | `import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 83 | `import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";` |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 109 | `import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";` |

**3 consumers.** Matches CONTEXT exactly.

Comment-only refs (cosmetic update optional): `orchestrators/marketplace/shared.ts:485`, `shared/errors.ts:42`, `presentation/README.md:5`.

### `presentation/sort.ts` (`compareByNameThenScope`) consumers
| File | Line | Import |
|------|------|--------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 70 | `import { compareByNameThenScope } from "../../presentation/sort.ts";` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 84 | `import { compareByNameThenScope } from "../../presentation/sort.ts";` |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | 10 | `import { compareByNameThenScope } from "../../presentation/sort.ts";` |

**3 consumers.** Matches CONTEXT exactly.

**Drift-guard reference (string literal):** `tests/architecture/scope-order-drift.test.ts:158` mentions `presentation/sort.ts` in an error-message string ("Use the canonical `compareByNameThenScope` from `extensions/pi-claude-marketplace/presentation/sort.ts`"). After D-21-02 moves the comparator to `shared/notify.ts`, this string must be updated. **Not flagged by CONTEXT -- see §8 CORRECTION 5.**

### `presentation/marketplace-list.ts` (`renderMarketplaceList` / `MarketplaceListEntry`) consumer
**ZERO live consumers.** Grep shows:
- `extensions/pi-claude-marketplace/presentation/index.ts:25` -- barrel re-export (deleted with directory)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts:18` -- comment reference only
- `tests/architecture/catalog-uat.test.ts:15` -- comment reference only

`orchestrators/marketplace/list.ts` imports `notify` directly from `shared/notify.ts` (line 28) and uses the V2 surface -- it does NOT call `renderMarketplaceList`. **CONTEXT claim "sole caller `orchestrators/marketplace/list.ts`" is WRONG -- there is no live caller.** See §8 CORRECTION 6.

**Real Phase 21 work for `renderMarketplaceList`:** simply delete `marketplace-list.ts` (no relocation/inline needed). `MarketplaceListEntry` interface also has no external consumer.

### `presentation/index.ts` barrel re-export consumers
Need to verify nothing else imports through `presentation/index.ts` since the barrel is deleted with the directory:
- Re-exports `renderMarketplaceList` from `marketplace-list.ts` (line 25) -- already shown above as the only finding.

### Any other `presentation/*` consumers
The exhaustive `grep -rn "from .*presentation/"` results above cover the complete live external surface. CONTEXT's enumeration is complete (modulo the corrections noted); no additional surprise consumers.

## 3. eslint.config.js Block Map (VERIFIED, 573 total lines)

| Block | Lines | Action | Notes |
|-------|-------|--------|-------|
| Header imports | 1-8 | Update line 8 -- delete `import msgPlugin from "./tests/lint-rules/index.js";` | |
| `ignores` + global rules | 11-79 | RETAIN | Stock recommended config |
| **BLOCK A** (output discipline) | 80-134 | RETAIN with surgical edits | Update line 127 (`notifySuccess/notifyWarning/notifyError` → `notify/notifyUsageError`); update line 116 (`notifyError` reference); update line 111 (IL-3 phrasing optional); add per-file override block for `persistence/migrate.ts` to set `no-console: off` (and optionally narrow `no-restricted-syntax`). |
| **BLOCK B** (shared/notify.ts self-override) | 135-143 | RETAIN unchanged | |
| Comment header for MSG-* blocks | 144-150 | DELETE | Comment block referencing the lint plugin |
| **MSG-Block 1** (`msg-sr-1..6`) | 151-174 | DELETE | Cascade routing |
| **MSG-Block 1b** (`msg-gr-3-per-scope`) | 175-214 | DELETE | |
| **MSG-Block 2** (`msg-sr-7`, `msg-nc-2`) | 215-224 | DELETE | Usage-error routing |
| **MSG-Block 3** (`msg-lc-1`, `-2`) | 225-242 | DELETE | Console-warn discipline |
| **MSG-Block 4a** (`msg-mr-1/-2`, `msg-rp-1`, `msg-rh-1`) | 243-271 | DELETE | Also kills `shared/notify.ts` ignore at line 262 |
| **MSG-Block 4b** (`msg-cc-1-cause-chain`) | 272-295 | DELETE | |
| **MSG-Block 5** (`msg-nc-1`, `msg-sd-1/-2`) | 296-327 | DELETE | Also kills `shared/notify.ts` ignore at line 319 and `shared/grammar/reasons.ts` ignore at line 318 |
| **MSG-Block 6** (15 meta-assertion rules) | 328-356 | DELETE | |
| **BLOCK C** (import-direction) | 357-472 | RETAIN, **MAY AMEND** | Lines 369-378 (`edge` zone `from`) likely needs `domain/` removed (or per-file override added) to allow `edge/handlers/tools.ts` → `domain/source.ts`. See §8 CORRECTION 2. |
| **BLOCK E** (Pi peer chokepoint) | 473-503 | RETAIN unchanged | Lines 481-486 comment refers to `no-legacy-markers.test.ts` -- could be updated but not required |
| **BLOCK D** (test fixtures override) | 504-510 | RETAIN unchanged | |
| Tests-wide relaxation override | 511-529 | RETAIN unchanged | |
| eslint.config.js self-override | 530-534 | RETAIN unchanged | |
| **`tests/lint-rules/**` disableTypeChecked override** | 535-545 | DELETE | |
| **`tests/lint-rules/**` relaxed-rules override** | 546-572 | DELETE | |
| Closing `)` | 573 | RETAIN | |

**Inline `eslint-disable-next-line` reference:** `persistence/migrate.ts:177`:
```
// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
console.warn(
```
**VERIFIED** -- this is the directive to delete per CONTEXT D-21-04 (replaced by block-level override).

**Total deleted lines (approx):** 144-356 (MSG-* blocks: 213 lines) + 535-572 (lint-rules overrides: 38 lines) + 1 (msgPlugin import) = **~252 lines deleted** out of 573. Post-Phase-21 file size: ~320 lines (plus a few added lines for the new `persistence/migrate.ts` override block).

## 4. V1 Wrapper Deletion Verification (VERIFIED)

### Live caller scan (extension code + tests)
Grep for `notifySuccess(`, `notifyWarning(`, `notifyError(`:

| Location | Type | Action |
|----------|------|--------|
| `shared/notify.ts` (definition site, lines 68, 73, 96) | Source | DELETE per D-21-05 |
| `extensions/**` comments | Comment-only refs (no live calls) | Optional cosmetic update |
| `edge/args-schema.ts:33,84` | Calls to **local callback parameter** named `notifyError` (NOT the wrapper) | D-21-02 renames callback to `onError` -- these become `onError(...)` |
| **`tests/shared/notify.test.ts`** lines 27, 34, 41, 48, 61, 73, 85 | **LIVE CALLS** to V1 wrappers (7 tests) | **DELETE entire file -- MISSED BY CONTEXT (see §8 CORRECTION 1)** |
| `tests/lint-rules/msg-*.test.js` | Strings inside RuleTester `code:` fixtures (28+ occurrences) | DELETED with the directory (Plan 21-01) -- no concern |

### `notifyUsageError` 3-arg caller scan (VERIFIED)
- `shared/notify.ts:127` -- overload signature (DELETE per D-21-05)
- `shared/notify.ts:107` -- comment-block ref (update during D-21-05 header rewrite)
- `tests/lint-rules/msg-nc-2-usage-separator.test.js:27` -- string in RuleTester fixture (deleted with directory)
- **Zero live 3-arg callers** in extension or test code.

All 14 active callers use the 2-arg V2 form `notifyUsageError(ctx, { message, usage })`. CONTEXT verified correctly.

### `causeChainTrailer` post-deletion usage check (VERIFIED -- STAYS)
`grep -n causeChainTrailer extensions/pi-claude-marketplace/shared/notify.ts`:
- Line 3: `import { assertNever, causeChainTrailer } from "./errors.ts";`
- Line 85: comment ref
- Line 97: **used by `notifyError` (deleted)**
- Line 1067: **used elsewhere -- STAYS LIVE**

After `notifyError` is removed, `causeChainTrailer` remains imported because line 1067 (inside the V2 per-plugin row renderer) still uses it. CONTEXT prediction correct: import STAYS, only the line-97 use disappears.

### V1 wrapper specific line numbers -- ALL VERIFIED

| CONTEXT line | Actual content (verified) |
|--------------|---------------------------|
| 68 | `export function notifySuccess(ctx: ExtensionContext, message: string): void {` ✓ |
| 73 | `export function notifyWarning(ctx: ExtensionContext, message: string): void {` ✓ |
| 96 | `export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {` ✓ |
| 127 | `export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void;` ✓ |
| 137-145 | **CORRECTION: actual range is 135-144** (the V1 3-arg `if (typeof message === "string")` branch). The `if` opens at 135, the `ctx.ui.notify(\`${message}\n\n${usageBlock ?? ""}\`, "error");` is line 144. Then `} else {` at 145 begins the V2 branch. After Plan 21-02, the body collapses to just the V2 emission. |

CONTEXT line range 137-145 was off by 2; **actual range is 135-144**. Minor discrepancy, called out in §8.

## 5. Test-Count Arithmetic (VERIFIED)

### Current baseline (from `npm test` 2026-05-27)
```
# tests 1367
# suites 90
# pass 1365
# fail 0
# cancelled 0
# skipped 0
# todo 2
```

### Per-file test counts in the deletion set

| File / Directory | Tests | Source of count |
|------------------|-------|------------------|
| `tests/presentation/cascade-summary.test.ts` | 19 | grep `^test(\|^\s*test(` |
| `tests/presentation/cause-chain.test.ts` | 11 | grep |
| `tests/presentation/compact-line.test.ts` | 41 | grep |
| `tests/presentation/manual-recovery.test.ts` | 7 | grep |
| `tests/presentation/marketplace-list.test.ts` | 8 | grep |
| `tests/presentation/plugin-list.test.ts` | 13 | grep |
| `tests/presentation/reload-hint.test.ts` | 5 | grep |
| `tests/presentation/rollback-partial.test.ts` | 9 | grep |
| `tests/presentation/soft-dep.test.ts` | 7 | grep |
| `tests/presentation/sort.test.ts` | 6 | grep |
| `tests/presentation/version-arrow.test.ts` | 7 | grep |
| **`tests/presentation/` subtotal** | **133** | sum |
| `tests/lint-rules/*.test.js` × 34 | 34 | One `.run()` per file = 1 node:test entry (verified: `node --test msg-er-1-empty-token.test.js` reports `# tests 1`) |
| `tests/architecture/msg-rule-registry.test.ts` | 4 | grep |
| `tests/architecture/no-legacy-markers.test.ts` | 1 | grep |
| `tests/shared/notify.test.ts` | 7 | grep |
| **Total deletion subtotal** | **179** | sum |

### Expected post-Phase-21 test count

```
1367 (current)
-  34 (tests/lint-rules/ deleted)
-   4 (msg-rule-registry.test.ts deleted)
-   1 (no-legacy-markers.test.ts deleted)
- 133 (tests/presentation/ deleted)
-   7 (tests/shared/notify.test.ts deleted)
+   0 to +2 (planner-discretionary compareByNameThenScope block in notify-v2.test.ts)
= 1188 to 1190 expected
```

**Final number: ~1188-1190 (computed in Plan 21-03 SUMMARY.md per D-21-09).** CONTEXT's mention of "1249 v1.3 baseline" is outdated -- Phase 16/17/18/19/20 additions brought the current pre-Phase-21 baseline to 1367.

## 6. Atomic-Commit Ordering Audit

### Plan 21-01 file inventory (atomic single commit)
| Mutation | File / Dir count |
|----------|------------------|
| `eslint.config.js` rewrite | 1 (edited) |
| `tests/lint-rules/` deletion | 73 (deleted) |
| `tests/architecture/msg-rule-registry.test.ts` deletion | 1 (deleted) |
| `tests/architecture/no-legacy-markers.test.ts` deletion | 1 (deleted) |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` inline directive removal | 1 (edited) |
| **`package.json` test script: remove `tests/lint-rules/**/*.test.{js,ts}` glob (line 76)** | 1 (edited) -- **MISSED BY CONTEXT, see §8 CORRECTION 7** |
| **Subtotal** | **~77 files** |

### Plan 21-02 file inventory (atomic single commit, source consolidation)
| Mutation type | File count |
|---------------|------------|
| `shared/notify.ts` (centerpiece: V1 wrapper delete + grammar inline + comparator add + header rewrite) | 1 (edited) |
| `shared/errors.ts` (+composeErrorWithCauseChain) | 1 (edited) |
| `domain/source.ts` (no changes -- already canonical) | 0 |
| `orchestrators/plugin/install.ts` (+EntityErrorRow inline, +update Reason import) | 1 (edited) |
| `orchestrators/marketplace/list.ts` (no edits needed -- renderMarketplaceList has no live caller, see §8 CORRECTION 6) | 0 |
| `orchestrators/plugin/update.ts` (3 imports update: composeErrorWithCauseChain, compareByNameThenScope, Reason) | 1 (edited) |
| `orchestrators/plugin/reinstall.ts` (3 imports update) | 1 (edited) |
| `orchestrators/import/execute.ts` (2 imports update: compareByNameThenScope, Reason) | 1 (edited) |
| `orchestrators/marketplace/update.ts` (2 imports update: composeErrorWithCauseChain, Reason) | 1 (edited) |
| `orchestrators/marketplace/remove.ts` (1 import update: Reason) | 1 (edited) |
| `orchestrators/plugin/uninstall.ts` (1 import update: Reason) | 1 (edited) |
| `orchestrators/types.ts` (1 import update: Reason) | 1 (edited) |
| `edge/handlers/tools.ts` (2 imports update: sourceLogical, ParsedSource → `domain/source.ts`) | 1 (edited) |
| `edge/args-schema.ts` (callback rename: `notifyError` → `onError`) | 1 (edited) |
| `tests/architecture/notify-types.test.ts` (1 import-path string update at line 87) | 1 (edited) |
| `tests/architecture/scope-order-drift.test.ts` (1 string update at line 158) | 1 (edited) |
| **`tests/shared/notify.test.ts` DELETE** (V1 wrapper tests -- see §8 CORRECTION 1) | 1 (deleted) |
| `shared/grammar/*.ts` deleted | 4 (deleted) |
| `presentation/*.ts` + `README.md` deleted | 13 (deleted) |
| `tests/presentation/*.test.ts` deleted | 11 (deleted) |
| **`package.json` test script + coverage script: remove `presentation` from glob (lines 76, 80)** | 1 (edited) -- **MISSED BY CONTEXT, see §8 CORRECTION 7** |
| **Optionally:** `eslint.config.js` BLOCK C zone amendment | 0 or 1 (edited) |
| **Subtotal** | **~46 files** (well under the 200-file split threshold) |

### Cross-zone import discipline check
After Plan 21-02:
- `edge/handlers/tools.ts` imports `sourceLogical`/`ParsedSource` from `domain/source.ts` -- **violates current BLOCK C** unless an amendment is made. Three options (planner choice):
  1. **Amend BLOCK C `edge` zone** to remove `domain/` from `from:` (broadest -- relaxes the rule everywhere edge/* lives)
  2. **Per-file override** for `edge/handlers/tools.ts` (narrow exception)
  3. **Move re-export to `shared/`** (defeats the cleanup goal -- `shared/` is allowed from `edge/`)
- All other relocations respect BLOCK C: `shared/errors.ts`, `shared/notify.ts`, `orchestrators/marketplace/list.ts`, `orchestrators/plugin/install.ts` are all valid import targets from their respective callers.

### Plan 21-03 file inventory (verification + closure)
| Mutation | File count |
|----------|------------|
| `CHANGELOG.md` v1.4 closure entry | 1 (edited) |
| `.planning/STATE.md` milestone marker | 1 (edited) |
| `.planning/PROJECT.md` Key Decisions update | 1 (edited) |
| `.planning/REQUIREMENTS.md` SNM-22, 24, 25, 27, 28, 29, 32 marked complete | 1 (edited) |
| **Subtotal** | **4 files** (all docs/state) |

## 7. Adjacent Test Non-Interference (VERIFIED)

| File | Grammar / presentation imports | Action needed |
|------|--------------------------------|---------------|
| `tests/architecture/markers-snapshot.test.ts` | None (imports `shared/markers.ts` only) | RETAIN unchanged -- orthogonal |
| `tests/architecture/catalog-uat.test.ts` | None found via grep | RETAIN unchanged -- sentinel for Plan 21-03 |
| `tests/architecture/notify-types.test.ts` | Line 87: `type _Reason = import("../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts").Reason;` | Update to `shared/notify.ts` (one-line edit) |
| `tests/architecture/scope-order-drift.test.ts` | Line 158: error-message string mentions `presentation/sort.ts` | Update string to `shared/notify.ts` |
| `tests/shared/notify-v2.test.ts` | None (only comment refs at line 1443) | Optional cosmetic update |
| `tests/orchestrators/plugin/reinstall.test.ts` | None (only comment refs at lines 1217, 1233, 1472, 1527) | Optional cosmetic update |
| `tests/e2e/install-soft-deps.test.ts` | None (only comment ref at line 11) | Optional cosmetic update |

## 8. Discrepancies vs CONTEXT.md

### CORRECTION 1 -- `tests/shared/notify.test.ts` MISSED
**CONTEXT D-21-05 says:** "the V1 wrappers were already test-free post-Phase-20 ... No test surgery required for SNM-22 closure."

**Reality:** `tests/shared/notify.test.ts` (91 lines, 7 tests) exists and contains LIVE calls to `notifySuccess`, `notifyWarning`, `notifyError`. Imports at lines 4-8 explicitly pull in the wrappers from `shared/notify.ts`. Deleting the wrappers without this file breaks `npm test`.

**Action for planner:** Plan 21-02 (paired with V1 wrapper deletion) must DELETE `tests/shared/notify.test.ts` atomically with the V1 wrapper removal. The V2 surface tests in `tests/shared/notify-v2.test.ts` (41 tests) cover the live notify() surface.

### CORRECTION 2 -- `sourceLogical`/`ParsedSource` are ALREADY in `domain/source.ts`
**CONTEXT D-21-02 says:** "Relocate `sourceLogical` + `ParsedSource` to `domain/source.ts`. Reason: `domain/source.ts` already houses parallel source-parsing logic..."

**Reality:** `domain/source.ts` already declares `ParsedSource` (line 70) and exports `sourceLogical` (line 389). The `presentation/marketplace-list.ts` definition (lines 37, 44, 51-52) is a RE-EXPORT, not a duplicate. The re-export exists because `edge/` cannot directly import `domain/` per BLOCK C (lines 369-378 of `eslint.config.js`).

**Action for planner:** Plan 21-02 does NOT need to move any code into `domain/source.ts`. The work is:
1. Delete the re-export (happens automatically when `presentation/marketplace-list.ts` is deleted).
2. Migrate the **single** consumer `edge/handlers/tools.ts` (lines 43, 46) to import from `domain/source.ts` directly.
3. Pick a BLOCK C strategy:
   - **Option A:** Amend BLOCK C `edge` zone to remove `domain/` (relaxes the rule globally for edge/).
   - **Option B:** Per-file override for `edge/handlers/tools.ts`.
   - **Option C:** Move re-export to a new location under `shared/` (defeats the cleanup intent).

This is a meaningful planning decision; the planner must pick a BLOCK C strategy. **Recommended: Option A.** Option A's blast radius is small (only one current `edge/` file would benefit, and BLOCK C's overall direction is still enforced for `bridges/transaction/persistence`).

### CORRECTION 3 -- `shared/grammar/reasons.ts` has **10 live importers today, 9 to migrate** post-Plan-21-02
CONTEXT D-21-01 cites "All 11 active import sites migrate" and enumerates 11 files including `presentation/compact-line.ts` (deleted), `tests/e2e/install-soft-deps.test.ts` (comment-only ref), `tests/orchestrators/plugin/reinstall.test.ts` (comment-only ref), and `tests/shared/notify-v2.test.ts` (comment-only ref).

**Verified actual:**
- 10 live importers (8 orchestrators + presentation/compact-line.ts + tests/architecture/notify-types.test.ts)
- Net 9 file edits post-Plan-21-02 (compact-line.ts deleted, not migrated)
- The 3 "tests/..." files CONTEXT counted have comment refs only -- updating comments is optional cosmetic

CONTEXT's enumeration is structurally complete (modulo the comment vs import distinction); the count phrasing is high by ~2-3.

### CORRECTION 4 -- `shared/grammar/status-tokens.ts` has 1 importer (deleted with compact-line.ts), 0 to migrate
**Action: 0 file edits** for the migration. The NEW `StatusToken` re-export from `shared/notify.ts` is the planner's net addition (no current re-export exists). CONTEXT correctly noted the re-export is added.

### CORRECTION 5 -- `tests/architecture/scope-order-drift.test.ts:158` not flagged by CONTEXT
**CONTEXT** lists files Plan 21-02 modifies but does not include this drift-guard. **Real action:** update the error-message STRING literal at line 158 from `presentation/sort.ts` to `shared/notify.ts`. One-line edit.

### CORRECTION 6 -- `renderMarketplaceList` has ZERO live callers
**CONTEXT D-21-02 says:** "`renderMarketplaceList` + `MarketplaceListEntry` interface → INLINED into `orchestrators/marketplace/list.ts` (sole caller)."

**Reality:** `orchestrators/marketplace/list.ts` does NOT import or call `renderMarketplaceList`. It imports `notify` from `shared/notify.ts` (line 28) and uses the V2 surface directly. The only references to `renderMarketplaceList` outside `presentation/marketplace-list.ts` itself are:
- `presentation/index.ts:25` -- barrel re-export (deleted with directory)
- `orchestrators/marketplace/list.ts:18` -- comment-only ref
- `tests/architecture/catalog-uat.test.ts:15` -- comment-only ref
- `tests/presentation/marketplace-list.test.ts` -- direct unit-test (deleted)

**Action for planner:** Plan 21-02 simply DELETES `marketplace-list.ts` (and its unit-test file) -- no inline needed. `MarketplaceListEntry` also has no external consumer.

### CORRECTION 7 -- `package.json` test scripts reference deleted directories
**CONTEXT** does not call out `package.json` changes. **Real actions:**
- Line 76 (`"test"` script): remove `,presentation` from the brace expansion AND remove the trailing `"tests/lint-rules/**/*.test.{js,ts}"` argument.
- Line 80 (`"test:coverage:unit"`): remove `,presentation` from the brace expansion.

Without these edits, `npm test` will print "no files found matching pattern" warnings post-deletion (test infrastructure quirk; doesn't fail the suite but is noisy). Plan 21-01 owns the `tests/lint-rules` portion (atomic with deletion); Plan 21-02 owns the `presentation` portion (atomic with deletion).

### CORRECTION 8 -- V1 wrapper implementation branch is lines 135-144, not 137-145
**CONTEXT D-21-05 cites lines 137-145.** **Verified actual:** the `if (typeof message === "string")` opens at line 135, the V1 emission is line 144, the `} else {` for V2 begins line 145. Minor 2-line shift; CONTEXT's intent is clear and unambiguous.

### CORRECTION 9 -- `causeChainTrailer` STAYS in `shared/notify.ts` (CONTEXT prediction confirmed)
CONTEXT correctly predicted that `causeChainTrailer` would survive `notifyError` deletion because the V2 renderer (line 1067) also uses it. Verified.

### VERIFIED ITEMS (no correction)
- `tests/architecture/grammar-frontmatter.test.ts` is absent (already deleted earlier in v1.4).
- `tests/lint-rules/` totals 73 files = 34 rules + 34 RuleTester tests + 2 plugin shell + 3 lib helpers.
- `tests/presentation/` has 11 test files = 133 tests total.
- `extensions/pi-claude-marketplace/presentation/` has 12 source + 1 README.
- `shared/grammar/` has 4 source files.
- All references in extension code to V1 wrappers are comments (no live calls outside `edge/args-schema.ts` callback param).
- All `notifyUsageError` callers use 2-arg V2 form.
- Inline `eslint-disable-next-line` at `persistence/migrate.ts:177` exists as described.
- `markers-snapshot.test.ts` imports only `shared/markers.ts` (orthogonal -- survives unchanged).
- `catalog-uat.test.ts` does not import grammar/presentation -- survives unchanged.

## Validation Architecture

> Required by orchestrator. `workflow.nyquist_validation` config not explicitly disabled.

### Test framework
| Property | Value |
|----------|-------|
| Framework | `node --test` (built-in) per project pattern; tsx loader for `.ts` |
| Config file | None (CLI flags in `package.json` scripts) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests) per NFR-6 / CLAUDE.md |
| Test-only command | `npm test` (currently 1367 tests; expected ~1188 post-Phase-21) |

### Phase 21 regression matrix

| Regression risk | Catcher | Command |
|-----------------|---------|---------|
| Broken import paths after grammar inline | TypeScript | `npm run typecheck` |
| Forgotten consumer migration (`shared/grammar/*`) | TypeScript | `npm run typecheck` |
| V1 wrapper deletion leaves dangling call | TypeScript + node:test | `npm run typecheck` + `npm test` |
| `tests/shared/notify.test.ts` not deleted in lockstep with V1 wrappers | node:test (compile failure) | `npm test` |
| MSG-* config block left orphaned referencing deleted plugin | ESLint config-loader | `npm run lint` |
| BLOCK A message-string drift (still mentions deleted wrappers) | Manual + Plan 21-03 review | SUMMARY.md ack |
| BLOCK C zone violation if `edge/` → `domain/` not addressed | ESLint `import-x/no-restricted-paths` | `npm run lint` |
| V2 catalog byte-equality drift | `tests/architecture/catalog-uat.test.ts` | `npm test -- tests/architecture/catalog-uat.test.ts` |
| Phase 5/7 markers regression (orthogonal) | `tests/architecture/markers-snapshot.test.ts` | `npm test -- tests/architecture/markers-snapshot.test.ts` |
| Compile-time `Reason`/`StatusToken` type holes | `tests/architecture/notify-types.test.ts` | `npm test -- tests/architecture/notify-types.test.ts` |
| V2 per-variant renderer drift | `tests/shared/notify-v2.test.ts` (41 tests) | `npm test -- tests/shared/notify-v2.test.ts` |
| `package.json` test glob references missing dirs | `npm test` "no files found" warning | `npm test 2>&1 \| grep -i 'no files'` |
| Stray `shared/grammar/` directory | Static post-condition assertion | `! test -d extensions/pi-claude-marketplace/shared/grammar` |
| Stray `presentation/` directory | Static post-condition assertion | `! test -d extensions/pi-claude-marketplace/presentation` |
| Stray `tests/lint-rules/` directory | Static post-condition assertion | `! test -d tests/lint-rules` |
| Stray `tests/presentation/` directory | Static post-condition assertion | `! test -d tests/presentation` |
| Live V1 wrapper caller | Grep | `! grep -rnE 'notify(Success\|Warning\|Error)\(' extensions/ tests/ \| grep -vE '//\|^\s*\*\|args-schema'` (after `onError` rename) |
| Pre-commit hook failures | `pre-commit run --files <changed>` | Per CLAUDE.md, run before commit; NEVER `--no-verify` |

### Sampling rate
- **Per atomic commit (Plan 21-01, Plan 21-02):** `npm run check` MUST be GREEN before the commit lands. Atomic commit discipline (D-21-08) means intermediate states are non-compiling -- verify only at the post-edit state.
- **Plan 21-03 final gate:** `npm run check` GREEN + manual SUMMARY.md test-count accounting.

### Wave 0 gaps
None -- existing test infrastructure (node:test + tsx + the architecture test trio) covers every Phase 21 regression. No new test files needed (planner has discretion on a small `compareByNameThenScope` block in `tests/shared/notify-v2.test.ts`).

## Sources

### Primary (HIGH confidence -- direct repo verification)
- `find tests/lint-rules -type f | wc -l` → 73
- `ls extensions/pi-claude-marketplace/{presentation,shared/grammar}/`
- `grep -rn shared/grammar/{reasons,status-tokens,markers,pattern-classes}` across `extensions/` + `tests/`
- `grep -rn "from .*presentation/"` enumeration
- `grep -rnE "notify(Success|Warning|Error)\("` for live caller verification
- Read of `tests/shared/notify.test.ts` (91 lines, 7 tests, all V1 wrapper calls)
- Read of `eslint.config.js` (573 lines)
- Read of `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` (96 lines -- confirmed re-export, not duplicate)
- Read of `extensions/pi-claude-marketplace/shared/notify.ts:60-150` (V1 wrapper bodies -- line numbers verified)
- `grep -n causeChainTrailer extensions/pi-claude-marketplace/shared/notify.ts` -- lines 3, 85, 97, 1067 (line 97 deleted, line 1067 keeps import live)
- `grep -n eslint-disable extensions/pi-claude-marketplace/persistence/migrate.ts` → line 177
- `npm test 2>&1 | tail -15` → 1367 tests / 1365 pass / 0 fail / 2 todo
- Per-file `grep -c "^test("` counts for presentation/lint-rules/notify.test.ts/msg-rule-registry/no-legacy-markers
- `node --test tests/lint-rules/msg-er-1-empty-token.test.js` → `# tests 1` confirming RuleTester = 1 test per file
- `grep -n presentation\|lint-rules package.json` → lines 76 + 80

### Secondary (MEDIUM confidence)
- None -- all critical findings verified via primary sources above.

## RESEARCH COMPLETE
