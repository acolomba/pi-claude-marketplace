---
phase: 15-type-model-adr-refresh
plan: 02
subsystem: tests/architecture
tags: [notify, type-model, compile-check, arch-test, v1.4]
requires:
  - "Plan 15-01 (shared/notify.ts ships PluginNotificationMessage union + PLUGIN_STATUSES/MARKETPLACE_STATUSES/DEPENDENCIES tuples + Reason re-export)"
provides:
  - "tests/architecture/notify-types.test.ts: bidirectional SNM-04 round-trip proof (PluginStatus <-> PluginNotificationMessage['status'])"
  - "tests/architecture/notify-types.test.ts: tuple-length proofs (10/4/2) for PLUGIN_STATUSES / MARKETPLACE_STATUSES / DEPENDENCIES"
  - "tests/architecture/notify-types.test.ts: set-equality proofs for PluginStatus (10 literals) / MarketplaceStatus (4 literals) / Dependency (2 literals)"
  - "tests/architecture/notify-types.test.ts: top-level shape proofs for NotificationMessage / MarketplaceNotificationMessage / MarketplaceDetails / UsageErrorMessage"
  - "tests/architecture/notify-types.test.ts: per-variant invariants for cause? (2 variants) / rollbackPartial? (1 variant) / dependencies (3 variants required) / reasons (5 variants required) / scope? (8 variants) / from-to (updated only) / version? (9 variants)"
  - "tests/architecture/notify-types.test.ts: negative-presence proofs via @ts-expect-error covering 53 absent-field claims"
affects: []
tech-stack:
  added: []
  patterns:
    - "Type-level `_Assert_<invariant> = X extends Y ? true : never` paired with `export const _<short>: _Assert_<invariant> = true;` (export is required to satisfy tsconfig `noUnusedLocals` AND typescript-eslint `no-unused-vars`)"
    - "Per-variant `_V<Variant> = Extract<PluginNotificationMessage, { status: '<status>' }>` aliases extracted once at file top so negative-presence indexed access (e.g. `_VInstalled['cause']`) stays on a single line under its `@ts-expect-error` directive"
    - "Negative-presence via `// @ts-expect-error -- <reason>` immediately preceding `export type _NoXxxOnVariant = _V<Variant>['xxx'];` -- regression in either direction (field added where absent, field removed where present) fails typecheck"
key-files:
  created:
    - "tests/architecture/notify-types.test.ts (+570 LoC)"
  modified: []
decisions:
  - "Refactored per-variant `Extract<PluginNotificationMessage, { status: 'X' }>` expressions into 10 top-of-file `_V<Variant>` type aliases so Prettier doesn't wrap negative-presence indexed access onto multiple lines (the `@ts-expect-error` directive only suppresses errors on the immediately-following line; wrapped expressions misaligned the directive from the property-access line)"
  - "Exported every `_Assert_*` value AND every `_NoXxx` type alias instead of using bare `const _xx = true;` -- tsconfig has `noUnusedLocals: true` AND typescript-eslint's `no-unused-vars` flags unused type aliases; both are silenced by the `export` keyword. The exports are inert (nothing imports this file at runtime)"
  - "Skipped adding `Scope` / `Reason` to the top-level named imports; used inline type aliases `_Scope = import('...').Scope` and `_Reason = import('...').Reason` instead to keep the import block focused on the 11 SNM-01..SNM-11 surface symbols"
  - "Converted 4 expected-shape type aliases (`_NotificationMessageExpected`, `_MarketplaceMessageExpected`, `_MarketplaceDetailsExpected`, `_UsageErrorMessageExpected`) to `interface` per typescript-eslint `consistent-type-definitions` rule"
metrics:
  duration: "~22m"
  completed: "2026-05-25T22:18:00Z"
  tasks_completed: 2
  files_created: 1
  loc_added: 570
  loc_removed: 0
---

# Phase 15 Plan 02: notify type model compile-time proof Summary

Added `tests/architecture/notify-types.test.ts` -- the closed-system, type-level compile-time proof of SNM-01..SNM-11 + per-variant invariants D-15-12. The file is the SOLE consumer of the v1.4 structured notification types outside `shared/notify.ts` itself; `npm run check` is GREEN and Success Criterion #4 holds.

## Net LoC

| File                                          | Added | Removed | Net  |
| --------------------------------------------- | ----- | ------- | ---- |
| tests/architecture/notify-types.test.ts (NEW) | +570  | 0       | +570 |
| **TOTAL**                                     | +570  | 0       | +570 |

The plan's `<output>` did not budget a target. The 570-LoC file is dominated by ~52 type-level `_Assert_*` blocks + 53 `@ts-expect-error` negative-presence aliases + per-block JSDoc citing the governing SNM-* / D-15-* requirement. Substantive type-declaration content is well under 200 LoC; the rest is governance/anchor documentation.

## Closed-System Proof Inventory

### Compile-time `_Assert_*` blocks: 52 total

| Group                                  | Count | Coverage                                                                                              |
| -------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------- |
| Closed-set membership (SNM-04 round-trip + tuple lengths + value-set equality) | 8 | `PluginStatusForward`, `PluginStatusBackward`, 3× tuple-length, 3× value-set (Plugin/Marketplace/Dependency) |
| Top-level shape (SNM-01 / SNM-02 / SNM-07 / SNM-08 + D-15-05 / D-15-06)        | 4 | `NotificationMessageShape`, `MarketplaceMessageShape`, `MarketplaceDetailsShape`, `UsageErrorMessageShape` |
| `cause?` presence (SNM-10)             | 2     | failed, manual recovery                                                                               |
| `rollbackPartial?` presence (SNM-09)   | 1     | failed                                                                                                |
| `dependencies` REQUIRED + NOT optional (SNM-06 + D-15-02) | 6 | 3× required + 3× not-optional (installed/updated/reinstalled) |
| `reasons` REQUIRED + NOT optional (D-15-01) | 10 | 5× required + 5× not-optional (unavailable/upgradable/skipped/failed/manual recovery) |
| `scope?` presence (SNM-11 + D-15-12)   | 8     | installed, updated, reinstalled, uninstalled, upgradable, failed, skipped, manual recovery            |
| `from` / `to` REQUIRED + NOT optional on `updated` (D-15-04) | 4 | 2× required + 2× not-optional (from, to) |
| `version?` presence on 9 variants (D-15-04) | 9 | installed, uninstalled, reinstalled, available, unavailable, upgradable, failed, skipped, manual recovery |
| **TOTAL**                              | **52** | Each paired with a load-bearing `export const _<short>: _Assert_<X> = true;` assignment              |

### `@ts-expect-error` negative-presence directives: 53 total

| Group                                  | Count | Variants Covered                                                                  |
| -------------------------------------- | ----: | --------------------------------------------------------------------------------- |
| NotificationMessage absences (SNM-01)  | 2     | severity, trailer                                                                 |
| UsageErrorMessage absences (SNM-08)    | 2     | cause, severity                                                                   |
| `cause` absent (SNM-10)                | 8     | installed, updated, reinstalled, uninstalled, available, unavailable, upgradable, skipped |
| `rollbackPartial` absent (SNM-09)      | 9     | All variants except `failed`                                                       |
| `dependencies` absent (D-15-02)        | 7     | uninstalled, available, unavailable, upgradable, failed, skipped, manual recovery |
| `reasons` absent (D-15-01)             | 5     | installed, updated, reinstalled, uninstalled, available                            |
| `scope` absent (SNM-11)                | 2     | available, unavailable                                                            |
| `from` absent (D-15-04)                | 9     | All variants except `updated`                                                      |
| `to` absent (D-15-04)                  | 9     | All variants except `updated`                                                      |
| **TOTAL**                              | **53** | Far exceeds the AC's `>=35` floor                                                |

A future commit that mistakenly ADDS one of the 53 absent fields fires "Unused @ts-expect-error" at typecheck and surfaces the regression. A future commit that mistakenly REMOVES one of the 52 positive-presence fields breaks the matching `_Assert_*` assignment to `true` and fires "Type 'never' is not assignable to type 'true'" at typecheck.

## Symbol Import Verification

The file imports all 11 SNM-01..SNM-11 symbols from `shared/notify.ts` (3 runtime, 8 type-only):

| Import         | Kind    | Source                                                                                          |
| -------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `PLUGIN_STATUSES`              | runtime | `../../extensions/pi-claude-marketplace/shared/notify.ts` |
| `MARKETPLACE_STATUSES`         | runtime | (same)                                                    |
| `DEPENDENCIES`                 | runtime | (same)                                                    |
| `PluginStatus`                 | type    | (same)                                                    |
| `MarketplaceStatus`            | type    | (same)                                                    |
| `Dependency`                   | type    | (same)                                                    |
| `PluginNotificationMessage`    | type    | (same)                                                    |
| `MarketplaceNotificationMessage` | type  | (same)                                                    |
| `NotificationMessage`          | type    | (same)                                                    |
| `MarketplaceDetails`           | type    | (same)                                                    |
| `UsageErrorMessage`            | type    | (same)                                                    |

`Scope` (from `shared/types.ts`) and `Reason` (from `shared/grammar/reasons.ts`) are referenced via inline `import("...").X` type queries -- kept out of the top-level imports per the planner's stated intent of focusing the import block on the 11 SNM-01..SNM-11 surface symbols (the file's own JSDoc header documents the discretion).

## node:test Anchor

A single `test("Phase 15 / SNM-01..SNM-11 / D-15-12: notify type model invariants hold at compile time", ...)` block at the bottom of the file with a trivial `assert.equal(1, 1)` body. `node --test tests/architecture/notify-types.test.ts` exits 0; output:

```text
ok 1 - Phase 15 / SNM-01..SNM-11 / D-15-12: notify type model invariants hold at compile time
1..1
# tests 1   # pass 1   # fail 0
```

`npm test` picks up the file via the existing `tests/{architecture,...}/**/*.test.ts` glob (package.json:76). The file appears in the runner output as one of 1327 tests (1326 from prior phases + 1 from this plan). The 90-suite count is unchanged.

## Success Criterion #4 (zero call-site refs in `extensions/`)

```bash
git grep -nE "\b(PluginNotificationMessage|MarketplaceNotificationMessage|UsageErrorMessage|NotificationMessage|PluginStatus|MarketplaceStatus|MarketplaceDetails)\b" \
  -- 'extensions/' ':!extensions/pi-claude-marketplace/shared/notify.ts'
```

Returns EMPTY. The new arch-test file lives under `tests/architecture/`, NOT `extensions/`; it is the SOLE consumer of the new type model and is correctly outside the SC#4 grep scope.

Note: the plan's verification grep at `<verification>` step 3 does NOT include `\b` word boundaries, which makes it match `ToolPluginStatus` (a local type at `extensions/pi-claude-marketplace/edge/handlers/tools.ts:135` that pre-dates Phase 15 and contains the substring "PluginStatus"). The Wave 1 SUMMARY established the word-boundary precedent for SC#4 grep; this Wave 2 SUMMARY uses the same word-boundary grep. The substantive claim -- zero references to the new SNM-01..SNM-11 type symbols in `extensions/` -- holds.

## Deviations from Plan

### `[Rule 1 - Bug: noUnusedLocals + typescript-eslint no-unused-vars on type aliases]` Required `export` on every `_Assert_*` const AND every `_NoXxx` type alias

- **Found during:** Task 1 first `npm run typecheck` + `npm run lint`.
- **Issue:** The plan's `<action>` writes `const _<short>: _Assert_* = true;` (bare const, no export). Two compounding problems:
  1. tsconfig has `noUnusedLocals: true` (RESEARCH §"A1" confirmed strict mode; planner verified during Task 1's tsconfig read but did not separately note `noUnusedLocals`). Bare `const _<short> = ...` fires TS6133 "'_<short>' is declared but its value is never read" -- the underscore prefix does NOT exempt locals (only function parameters via `noUnusedParameters`'s `_`-prefix convention).
  2. typescript-eslint's `@typescript-eslint/no-unused-vars` (active via the project's strict-type-checked config) flags unused TYPE aliases (e.g., the 53 `type _NoXxxOnVariant = ...` negative-presence aliases). The TypeScript compiler's `noUnusedLocals` does NOT flag unused type aliases, but the ESLint rule does.
- **Fix:** Add `export` to every `_Assert_*` const AND every `_NoXxx` type alias. ESM exports from a test file are inert (nothing imports the file at runtime; node:test executes it directly). This satisfies both `noUnusedLocals` (TS) and `no-unused-vars` (ESLint) without modifying eslint.config.js or tsconfig.json.
- **Files modified:** `tests/architecture/notify-types.test.ts`.
- **Commit:** `427d08d` (single plan commit).

### `[Rule 1 - Bug: @ts-expect-error misalignment under Prettier wrapping]` Extracted per-variant `_V<Variant>` aliases

- **Found during:** Task 1 first `npm run typecheck`.
- **Issue:** The plan's `<action>` writes negative-presence assertions as:
  ```ts
  // @ts-expect-error -- ...
  type _NoCauseOnReinstalled = Extract<PluginNotificationMessage, { status: "reinstalled" }>["cause"];
  ```
  The `Extract<...>` expression is long enough that Prettier wraps the second line onto three lines:
  ```ts
  // @ts-expect-error -- ...
  type _NoCauseOnReinstalled = Extract<
    PluginNotificationMessage,
    { status: "reinstalled" }
  >["cause"];
  ```
  The `@ts-expect-error` directive suppresses errors on the IMMEDIATELY-FOLLOWING line only -- the property access `>["cause"]` lives 3 lines below the directive, so TS2339 "Property 'cause' does not exist on type 'PluginReinstalledMessage'" fires unsuppressed. 22 of 53 negative-presence assertions failed on the first typecheck for this reason.
- **Fix:** Extract 10 per-variant `_V<Variant> = Extract<PluginNotificationMessage, { status: "<status>" }>` aliases once at the top of the file. All negative-presence assertions now read `_V<Variant>["xxx"]` -- short enough that Prettier keeps each on a single line under its `@ts-expect-error` directive. The directive correctly catches the TS2339, and a future commit that adds a field to the variant fires "Unused @ts-expect-error" -- the intended drift-detection contract is preserved.
- **Files modified:** `tests/architecture/notify-types.test.ts`.
- **Commit:** `427d08d` (single plan commit).

### `[Rule 1 - Bug: typescript-eslint consistent-type-definitions]` Converted 4 expected-shape `type` aliases to `interface`

- **Found during:** Task 1 first `npm run lint`.
- **Issue:** The 4 expected-shape aliases (`_NotificationMessageExpected`, `_MarketplaceMessageExpected`, `_MarketplaceDetailsExpected`, `_UsageErrorMessageExpected`) were declared as `type X = { ... }`. The project's typescript-eslint strict-type-checked config enables `@typescript-eslint/consistent-type-definitions`, which prefers `interface` for object-shape declarations.
- **Fix:** Converted the 4 aliases to `interface`. The `_Assert_*` conditional types that consume them work identically (`X extends interface Y` is valid TypeScript).
- **Files modified:** `tests/architecture/notify-types.test.ts`.
- **Commit:** `427d08d` (single plan commit).

### `[Rule 1 - AC regex pedantry]` Reworded file-header comment to avoid literal `assert.equal(1, 1)`

- **Found during:** Task 1 acceptance-criteria verification.
- **Issue:** The plan's AC `grep -c "assert.equal(1, 1)" tests/architecture/notify-types.test.ts returns 1` is byte-literal. The file-header comment block originally mentioned the canonical anchor body as `assert.equal(1, 1)` inside backticks for prose clarity -- which made the grep return 2 (one comment mention + one real call). The substantive requirement (exactly one runtime call) was satisfied; only the literal byte count diverged.
- **Fix:** Reworded the comment to read "a trivial identity-assert body" -- the prose still describes the anchor's purpose, the grep returns the expected `1`.
- **Files modified:** `tests/architecture/notify-types.test.ts`.
- **Commit:** `427d08d` (single plan commit).

No Rule 2, Rule 3, or Rule 4 deviations occurred.

## Authentication Gates

None.

## Threat Flags

None. Plan 02 adds a single compile-time-only arch test consuming types from `shared/notify.ts`; no new packages, no network, no disk mutation outside the commit (per `<threat_model>` T-15-02 / T-15-03 / T-15-SC).

## Verification Results

| Check                                                                          | Result |
| ------------------------------------------------------------------------------ | ------ |
| `npm run typecheck`                                                            | PASS   |
| `npm run lint`                                                                 | PASS   |
| `npm run format:check`                                                         | PASS   |
| `npm test` (1327 tests, 90 suites; +1 vs HEAD~1's 1326)                        | PASS   |
| `npm run check` (composite)                                                    | PASS   |
| `node --test tests/architecture/notify-types.test.ts` exits 0                  | PASS   |
| Pre-commit hooks (all except trufflehog -- worktree sandbox bug per CLAUDE.md) | PASS   |
| Trufflehog (standalone scan from main repo)                                    | PASS   |
| SC#4 word-boundary grep against `extensions/` returns empty                    | PASS   |
| File imports the 11 SNM-01..SNM-11 surface symbols                             | PASS   |
| 52 `_Assert_*` blocks each paired with `export const _<short>: _Assert_<X> = true;` | PASS |
| 53 `@ts-expect-error` directives (exceeds AC floor of 35)                      | PASS   |
| Exactly one `test(...)` block                                                  | PASS   |
| Commit title matches `^test\(notify\): lock v1\.4 type invariants via compile-time _Assert_\*$` (66 chars, ≤72) | PASS |
| Commit body lines all ≤80 chars                                                | PASS   |
| Single file in commit                                                          | PASS   |
| Branch is not `main` (`worktree-agent-a17138ff6880975fb`)                      | PASS   |

## Commit

- **Hash:** `427d08d0662f9f82ed91f59cb1ce44409310165a` (short: `427d08d`)
- **Branch:** `worktree-agent-a17138ff6880975fb` (worktree; merges to `gsd/v1.3-replan-catalog` after wave 2 completes)
- **Title:** `test(notify): lock v1.4 type invariants via compile-time _Assert_*`
- **Files:** `tests/architecture/notify-types.test.ts` (only)
- **Stat:** 1 file changed, 570 insertions(+), 0 deletions(-)

## Requirements Satisfied

| Req    | Statement                                                                                                       | Where                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SNM-01 | NotificationMessage shape compile-locked (positive shape + negative severity / trailer)                         | `tests/architecture/notify-types.test.ts:_Assert_NotificationMessageShape, _NoSeverityOnNotificationMessage, _NoTrailerOnNotificationMessage` |
| SNM-02 | MarketplaceNotificationMessage shape compile-locked                                                             | `_Assert_MarketplaceMessageShape`                                                              |
| SNM-03 | PluginNotificationMessage 10-variant value set compile-locked                                                   | `_Assert_PluginStatusValues` + 10 `_V<Variant>` extractions                                    |
| SNM-04 | PluginStatus round-trip vs PluginNotificationMessage["status"] compile-locked (BOTH directions)                 | `_Assert_PluginStatusForward`, `_Assert_PluginStatusBackward`                                  |
| SNM-05 | MarketplaceStatus 4-value set compile-locked                                                                    | `_Assert_MarketplaceStatusValues`, `_Assert_MarketplaceStatusesLen`                            |
| SNM-06 | Dependency 2-value set compile-locked + required on installed/updated/reinstalled                               | `_Assert_DependencyValues`, `_Assert_DependenciesLen`, `_Assert_DepsRequired{Installed,Updated,Reinstalled}`, `_Assert_DepsNotOptional{Installed,Updated,Reinstalled}` |
| SNM-07 | MarketplaceDetails 2-field shape compile-locked                                                                 | `_Assert_MarketplaceDetailsShape`                                                              |
| SNM-08 | UsageErrorMessage shape compile-locked (positive shape + negative cause/severity)                               | `_Assert_UsageErrorMessageShape`, `_NoCauseOnUsageError`, `_NoSeverityOnUsageError`            |
| SNM-09 | rollbackPartial? exists on failed only compile-locked (positive + 9 negative)                                   | `_Assert_RollbackOnFailed` + 9 `_NoRollbackOn<Variant>`                                        |
| SNM-10 | cause? exists on failed/manual recovery only compile-locked (2 positive + 8 negative)                           | `_Assert_CauseOnFailed`, `_Assert_CauseOnManualRecovery` + 8 `_NoCauseOn<Variant>`             |
| SNM-11 | scope absent on available/unavailable compile-locked (2 negative + 8 positive)                                  | `_NoScopeOnAvailable`, `_NoScopeOnUnavailable` + 8 `_Assert_ScopeOn<Variant>`                  |

## Self-Check: PASSED

- File `tests/architecture/notify-types.test.ts` exists (570 lines).
- Commit `427d08d0662f9f82ed91f59cb1ce44409310165a` exists in `git log` (`git log --oneline | grep 427d08d`).
- 52 `_Assert_*` blocks, 52 paired `export const`, 53 `@ts-expect-error` directives, 11 SNM-01..SNM-11 symbol imports (all verified via grep counts).
- `npm run check` exits 0 (1327 tests, 90 suites, all pass).
- SC#4 (word-boundary regex against `extensions/`) returns empty.
- Commit is on the worktree-agent branch (not `main`); single file; 66-char title (≤72); body lines all ≤80; pre-commit hooks ran clean (trufflehog skipped per CLAUDE.md worktree-sandbox guidance + scanned standalone from main repo).
