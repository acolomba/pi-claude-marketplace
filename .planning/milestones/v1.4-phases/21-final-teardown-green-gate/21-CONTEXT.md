# Phase 21: Final Teardown & GREEN Gate - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning. Phase 20 (Migration Wave 3 -- Edge Handlers & UsageError) landed 2026-05-27; the dependency is satisfied. All V1 wrapper migration is complete: zero callers of `notifySuccess` / `notifyWarning` / `notifyError` / V1 3-arg `notifyUsageError(ctx, msg, usage)` remain anywhere in extension code (verified by grep across `extensions/pi-claude-marketplace/**`).

<domain>
## Phase Boundary

Retire the entire v1.3 drift-guard infrastructure and the V1 messaging surface, leaving a minimal V2-only codebase that passes `npm run check` GREEN.

**Seven concurrent teardown surfaces:**

1. **`tests/lint-rules/` (the 34-rule MSG-* lint plugin)** -- 34 rule files + 34 RuleTester companion tests + `lib/` helpers (`frontmatter.js`, `sr-tokens.js`) + plugin shell (`index.js`, `index.d.ts`). Fully deleted -- the MSG-* drift-guard surface served its purpose during Phases 12-14 and is now obsolete because the V2 closed-set type encoding (`PluginStatus` / `MarketplaceStatus` / `Reason` / `StatusToken` / `Marker` unions in `shared/notify.ts`) structurally enforces what MSG-* enforced via AST checks.

2. **`tests/architecture/msg-rule-registry.test.ts`** -- the 4-way parity test that asserted 1:1 between `tests/lint-rules/index.js` `RULE_NAMES` export, `eslint.config.js` rule wirings, the rule files themselves, and the RuleTester suites. Deleted alongside the plugin.

3. **`tests/architecture/no-legacy-markers.test.ts`** -- the 5-ES-5-literals static-audit gate. DELETED entirely per the discussion (Area 3 lock). Closed-set type encoding (`PluginStatus`, `MarketplaceStatus`, `Reason`, `StatusToken`, `Marker`) makes ES-5 marker reintroduction structurally impossible -- the test is redundant. SNM-28's deletion arm is taken.

4. **`eslint.config.js` MSG-* surface** -- delete MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 (all `msg/` rule wirings); delete `import msgPlugin from "./tests/lint-rules/index.js"`; delete the two `tests/lint-rules/**` overrides (`disableTypeChecked` + relaxed-rules blocks). RETAIN BLOCK A (extension output discipline -- already has the canonical `ctx.ui.notify`-outside-`shared/notify.ts` `no-restricted-syntax` selector + the per-callsite `console.warn` selector). UPDATE BLOCK A's `no-console: "error"` to a block-level per-file override for `persistence/migrate.ts` per SC #3 (the inline `eslint-disable-next-line` at the IL-3 sanctioned callsite gets removed; the block-level override replaces it). RETAIN BLOCK B (shared/notify.ts self-override -- still needs to call `ctx.ui.notify` directly). RETAIN BLOCK C (import-direction enforcement), BLOCK D (test fixtures override), BLOCK E (Pi peer-import chokepoint).

5. **V1 wrappers in `shared/notify.ts`** -- delete `notifySuccess` (line 68), `notifyWarning` (line 73), `notifyError` (line 96), the V1 3-arg `notifyUsageError(ctx, message, usageBlock)` overload (line 127), and the implementation arm that handles the V1 3-arg branch (lines 137-145). Only `notify(ctx, pi, message)` and `notifyUsageError(ctx, UsageErrorMessage)` remain exported. SNM-22 closes.

6. **`shared/grammar/` aggressive inline (SNM-29)** -- inline `REASONS` const + `Reason` type + `STATUS_TOKENS` const + `StatusToken` type directly into `shared/notify.ts`; DELETE the entire `shared/grammar/` directory (`markers.ts`, `pattern-classes.ts`, `reasons.ts`, `status-tokens.ts`). All 11+ consumers update their imports to source these types from `shared/notify.ts`. SNM-29 closes via "single source of truth in shared/notify.ts" -- this is the aggressive arm (vs. retain-as-enum-source or migration-trim arms).

7. **`presentation/` full clean-sweep** -- relocate the 4 still-used utilities out of `presentation/` and DELETE the directory entirely (plus `tests/presentation/`). Specific moves:
   - `sourceLogical` + `ParsedSource` (from `marketplace-list.ts`) → `domain/source.ts` (where similar source-parsing logic already lives).
   - `EntityErrorRow` interface (from `compact-line.ts`) → `orchestrators/plugin/install.ts` (sole consumer).
   - `composeErrorWithCauseChain` (1-line wrapper from `cause-chain.ts`) → `shared/errors.ts` (where `causeChainTrailer` already lives).
   - `compareByNameThenScope` (from `sort.ts`) → `shared/notify.ts` (single comparator consumed by 3 orchestrators).
   - `renderMarketplaceList` + `MarketplaceListEntry` (from `marketplace-list.ts`) → `orchestrators/marketplace/list.ts` (sole consumer; inlined since it's a single function for a single caller).
   - DELETE all remaining `presentation/*.ts` files (12 source files including `index.ts` barrel + `README.md`).
   - DELETE entire `tests/presentation/` directory (11 test files for orphaned/relocated composers).

**Plus minor cleanups (folded into Phase 21):**

- `edge/args-schema.ts` callback rename: `notifyError: (message: string) => void` → `onError: (message: string) => void` (V1-era name shadow cleanup; Phase 20 deferred cosmetic).
- Remove the inline `eslint-disable-next-line no-restricted-syntax` directive at `persistence/migrate.ts`'s legacy-migration `console.warn` callsite (replaced by the block-level no-console override in Plan 21-01).

**In scope (this phase):**

1. ESLint + MSG-* + static-audit teardown (Plan 21-01): rewrite `eslint.config.js` to stock rules; delete `tests/lint-rules/`, `tests/architecture/msg-rule-registry.test.ts`, `tests/architecture/no-legacy-markers.test.ts`. Atomic single commit.
2. Source consolidation (Plan 21-02): delete V1 wrappers from `shared/notify.ts`; inline `shared/grammar/*` into `shared/notify.ts` and delete the directory; full `presentation/` clean-sweep (5 relocations + directory delete + `tests/presentation/` delete); update 11+ consumer import sites for the new `shared/notify.ts` re-export surface; rename `edge/args-schema.ts` callback to `onError`. Atomic single commit centered on `shared/notify.ts` consolidation.
3. Final gate (Plan 21-03): `npm run check` GREEN end-to-end verification (typecheck + ESLint + Prettier + tests); test-count accounting (1249 v1.3 baseline minus ~70 RuleTester suites minus ~11 composer tests minus 2 architecture tests; Phase 16 per-variant tests already shipped); CHANGELOG entry recording closure of SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32.

**Out of scope (not Phase 21):**

- **Adding new lint rules.** The post-Phase-21 lint surface is stock ESLint + the retained BLOCKS A/B/C/D/E (output discipline + per-file overrides + import direction + test fixtures + Pi peer chokepoint). No new MSG-style drift guards.
- **Renaming `presentation/` to something else, or keeping a stub directory.** Aggressive clean-sweep deletes the directory entirely.
- **Migrating `shared/markers.ts`** -- still exports `RECOVERY_PLUGIN_REINSTALL_PREFIX` + `STATE_LOCK_HELD_PREFIX` (Phase 5/7 extensions; NOT the 5 ES-5 markers, which were deleted in Plan 13-03-02). Active in production code. STAYS. `tests/architecture/markers-snapshot.test.ts` drift-guards those exports and STAYS.
- **Migrating BLOCK C (`import-x/no-restricted-paths`)** -- the 9-zone import-direction enforcement is V1-wrapper-INDEPENDENT and continues to gate the layered architecture. STAYS.
- **Migrating BLOCK E (`no-restricted-imports` against `@earendil-works/pi-coding-agent`)** -- the Pi peer-import chokepoint is V1-wrapper-INDEPENDENT. STAYS.
- **`tests/architecture/grammar-frontmatter.test.ts`** -- already deleted earlier in v1.4 (does not exist on disk). No further action.
- **Type-model amendments** -- the V2 type model is frozen (SNM-01..11 + SNM-21 closed in Phase 15; Phase 17.1 amended for autoupdate surface; Phase 17.2 amended for orphan-fold). No further amendments in Phase 21.
- **Catalog amendments** -- `docs/output-catalog.md` is the V2 binding contract (frozen in Phase 17 + 17.1). No new fixtures.
- **Documentation rewrites** -- ADR (`docs/adr/v2-001-structured-notify.md`), messaging style guide (`docs/messaging-style-guide.md`), and catalog already reflect v1.4 final state from Phase 15 / 17. Phase 21 only adds a CHANGELOG entry.
- **Sketches / spike research / new framework integrations** -- v1.4 is closing, not opening new surfaces.

</domain>

<decisions>
## Implementation Decisions

### `shared/grammar/` retention (SNM-29) -- aggressive inline

- **D-21-01:** `shared/grammar/` is DELETED entirely. The 4 closed-set declarations are inlined into `shared/notify.ts` as the single source of truth for the v1.4 structured-notification surface:
  - `REASONS` const + `Reason` type union (from `reasons.ts`)
  - `STATUS_TOKENS` const + `StatusToken` type union (from `status-tokens.ts`)
  - `MARKERS` const + `Marker` type union (from `markers.ts` -- currently zero callers; preserved as documented closed set even though no code currently imports it)
  - `PATTERN_CLASSES` const + `PatternClass` type union (from `pattern-classes.ts` -- currently zero callers; preserved as documented closed set even though no code currently imports it)

  All 11 active import sites migrate (`orchestrators/marketplace/{remove,update}.ts`, `orchestrators/plugin/{install,uninstall,update,reinstall}.ts`, `orchestrators/import/execute.ts`, `orchestrators/types.ts`, `presentation/compact-line.ts` -- which is then deleted by D-21-04, so this site disappears too -- and tests `tests/architecture/notify-types.test.ts`, `tests/e2e/install-soft-deps.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`, `tests/shared/notify-v2.test.ts`). Existing `shared/notify.ts:14` `export type { Reason } from "./grammar/reasons.ts"` becomes a direct in-file declaration; the `StatusToken` re-export is ADDED.

  **Justification:** The Phase 16 design comment at `shared/notify.ts:9-11` ("Re-export Reason so Phase 16-20 call-site authors can import the entire v1.4 structured-notify surface from this file alone, instead of hopping to shared/grammar/reasons.ts") signals the design intent toward consolidation. Aggressive inline finishes that path. The pattern-classes / markers files are ZERO-CALLER orphans regardless; their content is preserved as documentation-of-closed-set inside `shared/notify.ts` for completeness.

  **Code-volume tradeoff:** `shared/notify.ts` grows by ~80 lines (4 const tuples + 4 type aliases + brief comments). The file is already ~1175 lines; this is a 7% growth. Acceptable because (a) the inlined declarations are pure value/type declarations with no runtime logic; (b) it removes the `shared/grammar/` directory entirely (4 files); (c) it kills 11+ import-hop sites; (d) it aligns with D-16-04 (renderer-as-spec discipline: the v2 grammar IS `shared/notify.ts`).

### Orphaned `presentation/*` clean-sweep -- full directory deletion

- **D-21-02:** `presentation/` is DELETED entirely (12 source files + `README.md`). The 5 still-active utilities are relocated to their natural homes:
  - `sourceLogical(s: string): "github" | "path"` + `ParsedSource` type → `domain/source.ts`. Reason: `domain/source.ts` already houses parallel source-parsing logic; `marketplace-list.ts` was an architectural mis-location (these are domain primitives, not presentation rendering). Consumer migration: 9 callers across `domain/`, `edge/handlers/tools.ts`, `orchestrators/marketplace/{add,update}.ts`, `orchestrators/plugin/update.ts`, `orchestrators/import/execute.ts`, `persistence/state-io.ts`.
  - `EntityErrorRow` interface → `orchestrators/plugin/install.ts`. Reason: install.ts is the sole consumer (the interface describes its classified-error return shape). No reason for it to live as a public type in `presentation/`.
  - `composeErrorWithCauseChain(err: unknown): string` → `shared/errors.ts`. Reason: `causeChainTrailer` (the actual depth-5 walker) already lives there; `composeErrorWithCauseChain` is a 1-line `errorMessage(err) + causeChainTrailer(err)` composition that has no semantic reason to live in a separate file. Consumer migration: 3 orchestrators (`marketplace/update.ts`, `plugin/update.ts`, `plugin/reinstall.ts`).
  - `compareByNameThenScope(a: Sortable, b: Sortable): number` → `shared/notify.ts`. Reason: it's a single pure comparator consumed by 3 orchestrators alongside their `NotificationMessage` construction; living in `shared/notify.ts` keeps the v1.4 surface in one place. Consumer migration: `orchestrators/import/execute.ts`, `orchestrators/plugin/update.ts`, `orchestrators/plugin/reinstall.ts`.
  - `renderMarketplaceList(records): string` + `MarketplaceListEntry` interface → INLINED into `orchestrators/marketplace/list.ts` (sole caller). Reason: the function has exactly one caller; a separate file is unjustified. The `MarketplaceListEntry` interface becomes a file-local type inside `list.ts`.

  **Files deleted from `presentation/`:** `cascade-summary.ts`, `cause-chain.ts`, `compact-line.ts`, `manual-recovery.ts`, `marketplace-list.ts`, `plugin-list.ts`, `reload-hint.ts`, `rollback-partial.ts`, `soft-dep.ts`, `sort.ts`, `version-arrow.ts`, `index.ts`, `README.md`. Total: 12 source + 1 markdown = 13.

  **Tests deleted from `tests/presentation/`:** all 11 composer-test files (`cascade-summary.test.ts`, `cause-chain.test.ts`, `compact-line.test.ts`, `manual-recovery.test.ts`, `marketplace-list.test.ts`, `plugin-list.test.ts`, `reload-hint.test.ts`, `rollback-partial.test.ts`, `soft-dep.test.ts`, `sort.test.ts`, `version-arrow.test.ts`). The corresponding behaviors are now covered by:
  - V2 renderer behavior: `tests/shared/notify-v2.test.ts` (per-variant unit tests shipped in Phase 16 + amendments in 17.1/17.2).
  - Catalog UAT byte-equality: `tests/architecture/catalog-uat.test.ts`.
  - Source parsing: any pre-existing `tests/domain/source.test.ts` plus migrated assertions from the deleted `tests/presentation/marketplace-list.test.ts` (planner verifies during research whether `tests/domain/source.test.ts` already covers `sourceLogical` or if assertions need to be migrated).
  - Error composition: any pre-existing `tests/shared/errors.test.ts` plus migrated assertions for `composeErrorWithCauseChain` (planner verifies during research).
  - Comparator: a small new `tests/shared/notify-v2.test.ts` block exercising `compareByNameThenScope` (planner judgment -- may be sufficient to test indirectly through orchestrator tests).

  **Justification:** Phase 21 is the "Final Teardown" phase by ROADMAP design. Leaving `presentation/` as a 3-or-4-file directory after the V1 grammar surface is gone would be architectural debt -- a stub directory with no clear ownership. The 5 relocations move each utility to its natural home (domain → `domain/`, error helpers → `shared/errors.ts`, comparator → `shared/notify.ts`, install-specific type → `install.ts`, single-caller helper → inlined). Mirrors the D-21-01 aggressive-inline choice for `shared/grammar/`.

  **BLOCK C import-direction implications:** `domain/` MUST NOT import upward (per current `import-x/no-restricted-paths` zone). All 5 relocation targets respect this: `domain/source.ts` accepts utilities; `shared/errors.ts` is already imported by orchestrators/edge/etc.; `shared/notify.ts` is the canonical entry point; `orchestrators/marketplace/list.ts` and `orchestrators/plugin/install.ts` are leaf orchestrators. Zero zone changes required.

### `no-legacy-markers.test.ts` (SNM-28) -- delete entirely

- **D-21-03:** `tests/architecture/no-legacy-markers.test.ts` is DELETED entirely. The 5 ES-5 legacy marker strings (`"pi-subagents is not loaded; "`, `"pi-mcp-adapter is not loaded; "`, `"Run /reload to "`, `"MANUAL RECOVERY REQUIRED: "`, `"(rollback partial: "`) cannot be re-introduced through the V2 typed surface because closed-set type encoding (`Reason`, `StatusToken`, `Marker` unions in `shared/notify.ts`) structurally rejects any non-member literal. SNM-28's deletion arm is taken.

  **Tradeoff acknowledged:** the static byte-grep would still catch raw-string regressions in comment blocks or in TypeScript files that bypass the typed surface (e.g., a future `console.log("(rollback partial: foo)")`). After Phase 21 there are NO `console.log` callsites in extension code (lint-blocked by BLOCK A's `no-console: "error"` + the per-file override allowing only `persistence/migrate.ts` `console.warn`). The grep-defense was a v1.3 transitional gate; closing it for v1.4 is consistent with the rest of the teardown.

  **Files retained (NOT deleted):** `shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` -- these guard the Phase 5/7 extension markers (`RECOVERY_PLUGIN_REINSTALL_PREFIX`, `STATE_LOCK_HELD_PREFIX`), which are still active in production code. Orthogonal to SNM-28; out of scope.

### ESLint stock-rule replacement strategy (SC #3) -- minimal edit on BLOCK A

- **D-21-04:** `eslint.config.js` rewrite is mostly DELETIONS, not additions. The MSG-* blocks (1, 1b, 2, 3, 4a, 4b, 5, 6) and the two `tests/lint-rules/**` overrides are deleted; the `msgPlugin` import is deleted. BLOCKS A/B/C/D/E are preserved as-is with two small surgical updates:

  1. **BLOCK A `no-console` override for `persistence/migrate.ts`:** the existing inline `eslint-disable-next-line no-restricted-syntax -- IL-3: ...` at the legacy-migration `console.warn` callsite is removed. A new block-level override is added:
     ```js
     {
       files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"],
       rules: {
         "no-console": "off",
         "no-restricted-syntax": "off", // narrow override below
       },
     }
     ```
     This satisfies SC #3 verbatim ("`no-console` rule with per-file override for `persistence/migrate.ts`"). Planner has discretion to narrow the override more granularly (e.g., only `no-console`) if the IL-3 callsite doesn't need both rules disabled.

  2. **BLOCK A `ctx.ui.notify` selector retention:** the existing `no-restricted-syntax` selector blocking `ctx.ui.notify` calls outside `shared/notify.ts` (lines 124-128) is RETAINED verbatim per SC #3 ("`no-restricted-syntax` blocking `ctx.ui.notify` calls outside `shared/notify.ts`"). BLOCK B's shared/notify.ts self-override remains in place.

  3. **Update BLOCK A message strings:** the existing messages reference `notifySuccess/notifyWarning/notifyError from shared/notify.ts` (line 127) -- these wrappers no longer exist post-D-21-05. The message is updated to reference `notify` and `notifyUsageError` (the only remaining exported entrypoints). Similar updates to the `console.warn` IL-3 reference (line 110-111) and the `console.error` reference to `notifyError` (line 116) -- the planner picks the post-teardown phrasing.

  **No new lint rules introduced.** The post-Phase-21 lint surface is: stock ESLint recommended + typescript-eslint strict-type-checked + stylistic + sonarjs + import-x + the 5 retained BLOCKS (A output discipline, B notify.ts self-override, C import direction, D test fixtures, E Pi peer chokepoint). No more 34-rule MSG-* drift guards.

### V1 wrapper deletion (SNM-22 closure) -- surgical 4-function removal

- **D-21-05:** Delete from `shared/notify.ts`:
  - `notifySuccess(ctx, message): void` at line 68 (3-line function body).
  - `notifyWarning(ctx, message): void` at line 73 (3-line function body).
  - `notifyError(ctx, message, cause?): void` at line 96 (4-line function body including the cause-trailer composition via `causeChainTrailer`).
  - V1 3-arg overload signature `notifyUsageError(ctx, message: string, usageBlock: string): void` at line 127.
  - The V1 3-arg branch of the implementation function (lines 137-145) -- the `if (typeof message === "string")` arm. The V2 1-arg implementation arm (the `else` branch) becomes the entire function body.
  - The `causeChainTrailer` import in `shared/notify.ts` (if it's no longer used after `notifyError` deletion -- planner verifies; the V2 `notify()` path also uses `causeChainTrailer` for per-plugin `cause?: Error` rendering inside `renderPluginRow`, so it likely STAYS).
  - Update file header comments (lines 17-44) describing the V1 vs V2 surface to reflect V2-only state.

  **Test-side impact:** the V1 wrappers were already test-free post-Phase-20 (all tests migrated to assert through real `notify()` / `notifyUsageError(1-arg)` via mock `ctx` per D-19-07). No test surgery required for SNM-22 closure.

  **`shared/notify.ts` bounded-window ignores removal:** the Phase 16 bounded-window ignores on MSG-Block 4a (line 262: `extensions/pi-claude-marketplace/shared/notify.ts`) and MSG-Block 5 (line 319) are deleted automatically when the entire MSG-Block 4a + 5 is deleted by D-21-04. Plan 21-01 captures this side-effect; no separate work unit.

### Plan/wave structure -- 3 plans, 2 waves

- **D-21-06:** Phase 21 ships **3 plans** across **2 waves**:

  **Wave 1 (independent infra teardown):**
  - **Plan 21-01: ESLint + MSG-* + static-audit teardown.** Atomic single commit that simultaneously:
    - Rewrites `eslint.config.js` per D-21-04 (deletes MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 + the two `tests/lint-rules/**` overrides + the `msgPlugin` import; adds the block-level `persistence/migrate.ts` no-console override; updates BLOCK A message strings to V2-only phrasing).
    - Deletes `tests/lint-rules/` directory entirely (34 rule files + 34 RuleTester tests + `lib/` helpers + `index.js` + `index.d.ts`).
    - Deletes `tests/architecture/msg-rule-registry.test.ts`.
    - Deletes `tests/architecture/no-legacy-markers.test.ts` per D-21-03.
    - Removes the inline `eslint-disable-next-line` directive at `persistence/migrate.ts`'s console.warn callsite (now redundant given the block-level override).
    - This commit MUST be atomic: the config and source-files must change together, or one half passes lint and the other fails.

  **Wave 2 (source consolidation -- depends on Wave 1):**
  - **Plan 21-02: Source consolidation -- V1 deletion + grammar inline + presentation clean-sweep + edge cleanup.** Atomic single commit centered on `shared/notify.ts` consolidation that simultaneously:
    - Deletes V1 wrappers per D-21-05.
    - Inlines `REASONS` / `Reason` / `STATUS_TOKENS` / `StatusToken` / `MARKERS` / `Marker` / `PATTERN_CLASSES` / `PatternClass` declarations into `shared/notify.ts` per D-21-01.
    - Deletes `shared/grammar/` directory.
    - Migrates 11+ import sites from `shared/grammar/*` to `shared/notify.ts`.
    - Relocates `sourceLogical` + `ParsedSource` to `domain/source.ts`; updates 9 consumers.
    - Relocates `EntityErrorRow` to `orchestrators/plugin/install.ts`.
    - Inlines `composeErrorWithCauseChain` into `shared/errors.ts`; updates 3 consumers.
    - Adds `compareByNameThenScope` to `shared/notify.ts`; updates 3 consumers.
    - Inlines `renderMarketplaceList` + `MarketplaceListEntry` into `orchestrators/marketplace/list.ts`; updates 1 consumer.
    - Deletes the `presentation/` directory entirely (12 source + `README.md`).
    - Deletes the `tests/presentation/` directory entirely (11 test files).
    - Renames `edge/args-schema.ts` callback parameter `notifyError` → `onError`.
    - This commit MUST be atomic: the consolidation moves and the directory deletions must land together; partial states are non-compiling.

  **Wave 3 (final gate -- depends on Wave 2):**
  - **Plan 21-03: Final GREEN gate + closure.** Verification-and-closure plan:
    - Runs `npm run check` end-to-end and asserts GREEN (typecheck + ESLint with stock rules + Prettier + tests).
    - Accounts for test-count change: 1249 v1.3 baseline minus ~70 RuleTester suites in `tests/lint-rules/` minus 1 `msg-rule-registry.test.ts` minus 1 `no-legacy-markers.test.ts` minus 11 composer tests in `tests/presentation/` = expected baseline somewhere in the ~1080-~1180 range depending on Phase 16/17 per-variant additions already shipped. The planner verifies the exact arithmetic during research.
    - Appends a CHANGELOG.md entry recording closure of SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32.
    - Marks the v1.4 milestone complete in STATE.md / PROJECT.md / REQUIREMENTS.md per the existing milestone-closure pattern.
    - This plan is verification-heavy (no source mutations beyond CHANGELOG + state files).

- **D-21-07:** **No pilot / recipe block-comment needed.** Phases 18/19 used pilot-first discipline for mirrored work across orchestrator families. Phase 21 is deletion-and-relocation work with no mirrored cascade construction; each plan is one-of-a-kind. The atomic-single-commit discipline replaces pilot-first sequencing.

- **D-21-08:** **Wave 2 cannot be parallelized.** D-21-01 (grammar inline), D-21-02 (presentation clean-sweep), D-21-05 (V1 wrapper deletion) all mutate `shared/notify.ts`. A single atomic commit covers them; splitting would create intermediate states with broken imports. The planner DOES have discretion to split Plan 21-02 into sub-plans (e.g., 21-02a V1 deletion + 21-02b grammar inline + 21-02c presentation sweep) ONLY IF each sub-plan compiles and tests GREEN in isolation -- but the recommended default is one atomic commit because the cross-file dependencies are dense.

### Test count accounting (SC #5) -- mechanical, no decision required

- **D-21-09:** Test count is a CONSEQUENCE of the deletions, not a decision. Expected delta vs v1.3 baseline (1249):
  - Minus 34 MSG-* RuleTester suites in `tests/lint-rules/` (one `.test.js` per rule).
  - Minus 1 `tests/architecture/msg-rule-registry.test.ts`.
  - Minus 1 `tests/architecture/no-legacy-markers.test.ts`.
  - Minus 11 `tests/presentation/*.test.ts` files (each may contain multiple tests; planner counts actual tests during research).
  - Plus Phase 16/17/17.1/17.2 per-variant additions (already shipped pre-Phase-21; no NEW additions in this phase).
  - Plan 21-03 documents the final number in its SUMMARY.md.

### Claude's Discretion

The planner has flexibility on:

- **Internal `shared/notify.ts` layout:** Where exactly to place the inlined `REASONS` / `STATUS_TOKENS` / `MARKERS` / `PATTERN_CLASSES` declarations within the file. Recommended: near the top alongside existing type declarations (`PluginNotificationMessage`, `MarketplaceNotificationMessage`, etc.) for a single contiguous "v1.4 surface" section. Specific line placement is cosmetic.

- **`tests/architecture/markers-snapshot.test.ts` review:** the test drift-guards `RECOVERY_PLUGIN_REINSTALL_PREFIX` + `STATE_LOCK_HELD_PREFIX` in `shared/markers.ts` (orthogonal to SNM-28). No structural change required; planner verifies during research that the test still PASSes after the Phase 21 deletions (it should -- the test imports nothing that's being deleted).

- **`tests/architecture/notify-types.test.ts` consumer migration:** the file imports `Reason` from `shared/grammar/reasons.ts` (verified above). After D-21-01, that import becomes `shared/notify.ts`. The test's assertions are unchanged; only the import path migrates.

- **Plan 21-02 commit granularity:** the recommended default is ONE atomic commit. If the planner finds the diff is genuinely unreviewable (>>200 files), splitting into 21-02a/b/c sub-plans is acceptable AS LONG AS each sub-plan compiles and tests GREEN in isolation. Otherwise keep it atomic.

- **`tests/presentation/marketplace-list.test.ts` assertion migration:** if any assertions about `sourceLogical` / `ParsedSource` are unique to this file (i.e., not duplicated in any existing `tests/domain/source.test.ts`), the planner migrates them to a new or extended `tests/domain/source.test.ts` rather than dropping them. Planner reads both files during research.

- **`composeErrorWithCauseChain` post-inline export shape:** once moved into `shared/errors.ts`, the planner decides whether it stays as an exported named function or gets inlined into each of its 3 callers (since it's a 1-line `errorMessage(err) + causeChainTrailer(err)` composition). Recommended default: KEEP as exported named function for readability; inlining is acceptable if the planner sees a cleanliness benefit.

- **`MarketplaceListEntry` interface placement in `orchestrators/marketplace/list.ts`:** file-local (top-of-file `interface` declaration) vs. exported public type. Recommended file-local since the function inlines too; no external consumer needs the type post-inline.

- **CHANGELOG entry phrasing for Plan 21-03:** the planner picks the entry shape. Recommended: a single v1.4 milestone-closure section listing all 7 closed SNM IDs with one-line annotations.

- **Whether `shared/notify.ts` post-D-21-01 stays one file or gets split:** the file grows by ~80 lines (grammar inline) + ~10 lines (`compareByNameThenScope` inline) - ~30 lines (V1 wrapper deletion) = roughly +60 lines net, from ~1175 to ~1235. Still under 1500. Recommended: keep it one file. If the planner finds the post-consolidation file becomes structurally hard to navigate (e.g., exceeds 2000 lines, which it won't), a split is acceptable -- but this is not anticipated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `.planning/ROADMAP.md` §"Phase 21: Final Teardown & GREEN Gate" -- Goal + 5 success criteria. SC #1 (tests/lint-rules/ absent + msg-rule-registry.test.ts absent) → Plan 21-01. SC #2 (V1 severity wrappers + V1 3-arg `notifyUsageError` deleted from `shared/notify.ts`) → Plan 21-02. SC #3 (`eslint.config.js` stock rules: `no-restricted-syntax` blocking `ctx.ui.notify` + `no-console` with `persistence/migrate.ts` override) → Plan 21-01. SC #4 (`grammar-frontmatter.test.ts` rewritten OR deleted [already gone]; `no-legacy-markers.test.ts` reviewed and updated [→ DELETE per D-21-03]; `shared/grammar/` retain-or-delete [→ DELETE inline per D-21-01]) → Plans 21-01 + 21-02. SC #5 (`npm run check` GREEN) → Plan 21-03 final gate.

- `.planning/REQUIREMENTS.md` §"Migration & Deletion" + §"Test Coverage" -- the 7 closed requirements:
  - **SNM-22**: All V1 severity-named wrapper call sites migrated AND wrappers deleted from `shared/notify.ts`. Migration half closed by Phases 18/19/20; deletion half closes here via D-21-05.
  - **SNM-24**: `tests/lint-rules/` deleted in full. Closes via D-21-04 + Plan 21-01.
  - **SNM-25**: `tests/architecture/msg-rule-registry.test.ts` deleted. Closes via Plan 21-01.
  - **SNM-26**: `tests/architecture/grammar-frontmatter.test.ts` rewritten or deleted. Already CLOSED earlier in v1.4 (file does not exist on disk; phase mapping table in REQUIREMENTS.md may show this as Phase 17). No further action.
  - **SNM-27**: `eslint.config.js` cleaned of all 34 MSG-* wirings; added `no-restricted-syntax` + per-file `no-console` override. Closes via D-21-04 + Plan 21-01.
  - **SNM-28**: `tests/architecture/no-legacy-markers.test.ts` reviewed and updated for v2 vocabulary. Closes via D-21-03 (DELETE arm) + Plan 21-01.
  - **SNM-29**: `shared/grammar/` deleted (closed sets type-encoded) OR retained as enum source. Closes via D-21-01 (aggressive inline arm: DELETE entirely + inline into `shared/notify.ts`) + Plan 21-02.
  - **SNM-32**: `npm run check` GREEN after all migrations land. Closes via Plan 21-03.

- `docs/output-catalog.md` -- Phase 17 v2.0 catalog. BINDING USER CONTRACT. Phase 21 makes NO catalog amendments. Catalog UAT byte-equality (`tests/architecture/catalog-uat.test.ts`) must stay GREEN through every wave; Plan 21-03 verifies as the final gate.

- `docs/messaging-style-guide.md` -- Phase 17 v2.0 pointer doc. Phase 21 makes NO style-guide amendments. The supersession of PRD §6.12 ES-5 is locked.

- `docs/adr/v2-001-structured-notify.md` -- Accepted (Phase 15 D-15-13). Phase 21 makes NO ADR amendments.

### V2 renderer & types (binding contract)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- the file Phase 21 most intensively modifies.
  - Lines 1-44: file header / V1 vs V2 surface description (REWRITE per D-21-05 to V2-only phrasing).
  - Line 14: `export type { Reason } from "./grammar/reasons.ts"` (REPLACE with direct in-file declaration per D-21-01).
  - Lines 68-99: V1 wrapper bodies (`notifySuccess`, `notifyWarning`, `notifyError`) (DELETE per D-21-05).
  - Line 127: V1 3-arg `notifyUsageError` overload signature (DELETE per D-21-05).
  - Lines 137-145: V1 3-arg implementation branch (DELETE per D-21-05).
  - Lines ~129, ~290, ~325-459, ~487-507, ~529 (`renderMpHeader`), ~573-590 (per-variant interfaces): UNCHANGED.
  - Line 1034 (`notify(ctx, pi, message)`): UNCHANGED.
  - ADD: inlined `REASONS` / `Reason` / `STATUS_TOKENS` / `StatusToken` / `MARKERS` / `Marker` / `PATTERN_CLASSES` / `PatternClass` declarations per D-21-01.
  - ADD: `compareByNameThenScope` comparator function per D-21-02 (~10 lines, moved from `presentation/sort.ts`).
  - Final file size estimate post-Phase-21: ~1235 lines (current ~1175 + 60 net).

- `tests/shared/notify-v2.test.ts` -- Phase 16 per-variant unit tests + Phase 17.1 amendment tests + Phase 17.2 orphan-fold tests (1141+ lines, 32+ tests). Phase 21 does NOT modify this file; it only verifies it stays GREEN after the V1 wrapper deletion and grammar inline (the V2 surface assertions are unaffected).

- `tests/architecture/catalog-uat.test.ts` -- Phase 17 byte-equality runner. Drives every `(section, state)` catalog fixture through `notify(mockCtx, mockPi, message)` and asserts byte-equality. Plan 21-03 verifies it stays GREEN end-to-end after every Phase 21 deletion + relocation. UNCHANGED by Phase 21.

### Phase 17-20 migration lineage (controlling decisions inherited)

- `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md` -- D-20-01 (Phase 21 deletes V1 wrappers, MSG-* lint plugin, orphaned composers, bounded shared/notify.ts ignores on Block 4a + 5, and shared/grammar -- ALL OPERATIONALIZED HERE); D-20-03 (defense-in-depth catch-all DROP discipline -- inherited as the precedent for tear-out-rather-than-rewrite).

- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-CONTEXT.md` -- D-19-01 (DROP V1 surfaces with no V2 representation -- inherited as the precedent for `no-legacy-markers.test.ts` deletion); D-19-07 (test discipline -- byte-exact end-to-end through real notify() -- inherited; no test-side changes required for V1 wrapper deletion because tests already use V2).

- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-CONTEXT.md` -- D-18-01 (DROP precedent for post-success warnings); D-18-07 (additive MSG-* lint narrowing -- inherited and then OBSOLETED by D-21-04 wholesale deletion).

- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- D-16-04 (renderer-as-spec: the v2 grammar IS `shared/notify.ts`'s rendering behavior; this is the structural foundation for the D-21-01 aggressive-inline choice); D-16-09 (bounded duplication of literals between `shared/notify.ts` and `presentation/*` composers ends in Phase 21 -- OPERATIONALIZED HERE).

- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- D-15-01 (per-variant `reasons: readonly Reason[]` discipline); D-15-03 (Reason imported from grammar/reasons.ts -- changes path here to inline within shared/notify.ts).

- `.planning/phases/14-drift-guard-test-alignment/` -- Phase 14 introduced the MSG-* drift-guard infrastructure deleted here. The 34 rules + 34 RuleTester suites + parity test were the v1.3 transitional safety net during the long ES-5 → V2 migration. Their structural purpose is replaced by V2's closed-set type encoding.

- `.planning/phases/13-conformance-refactor-es5/` -- Phase 13 deleted the 5 ES-5 marker exports from `shared/markers.ts` and locked the closed-set Reason enum in `shared/grammar/reasons.ts`. Phase 21 closes the cycle by inlining that enum into `shared/notify.ts` per D-21-01.

### Source files Phase 21 modifies

**Plan 21-01 (ESLint + MSG-* + static-audit teardown):**

- `eslint.config.js` -- delete MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 (lines ~144-356); delete `import msgPlugin from "./tests/lint-rules/index.js"` (line 8); delete the two `tests/lint-rules/**` overrides (lines ~535-572); update BLOCK A `no-console` to be a block-level override carve-out for `persistence/migrate.ts` (new block); update BLOCK A message strings to V2-only phrasing.
- `tests/lint-rules/` -- entire directory DELETED (~36 source files + ~36 test files + `lib/` + `index.js` + `index.d.ts`).
- `tests/architecture/msg-rule-registry.test.ts` -- DELETED.
- `tests/architecture/no-legacy-markers.test.ts` -- DELETED per D-21-03.
- `extensions/pi-claude-marketplace/persistence/migrate.ts` -- remove the inline `eslint-disable-next-line` directive (now redundant given the block-level override). Inspect during research; expected to be a one-line removal.

**Plan 21-02 (source consolidation):**

- `extensions/pi-claude-marketplace/shared/notify.ts` -- per D-21-01 + D-21-02 + D-21-05 (see section above).
- `extensions/pi-claude-marketplace/shared/errors.ts` -- ADD `composeErrorWithCauseChain` function per D-21-02 (inline from `presentation/cause-chain.ts`).
- `extensions/pi-claude-marketplace/domain/source.ts` -- ADD `sourceLogical` + `ParsedSource` type per D-21-02 (relocated from `presentation/marketplace-list.ts`).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- ADD `EntityErrorRow` interface per D-21-02 (relocated from `presentation/compact-line.ts`); update `import type { EntityErrorRow } from "../../presentation/compact-line.ts"` (line 121) to file-local declaration.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` -- INLINE `renderMarketplaceList` + `MarketplaceListEntry` per D-21-02 (sole-caller inlining).
- 11+ consumer import sites for `shared/grammar/*` types (see D-21-01 list) -- each updates its import path from `shared/grammar/{reasons,status-tokens}.ts` to `shared/notify.ts`.
- 9 consumer import sites for `presentation/marketplace-list.ts` `sourceLogical`/`ParsedSource` -- each updates its import path to `domain/source.ts`.
- 3 consumer import sites for `presentation/cause-chain.ts` `composeErrorWithCauseChain` -- each updates its import path to `shared/errors.ts`.
- 3 consumer import sites for `presentation/sort.ts` `compareByNameThenScope` -- each updates its import path to `shared/notify.ts`.
- `extensions/pi-claude-marketplace/edge/args-schema.ts` -- rename callback parameter `notifyError` → `onError` (D-21-02 small cleanup).
- `extensions/pi-claude-marketplace/shared/grammar/` -- entire directory DELETED.
- `extensions/pi-claude-marketplace/presentation/` -- entire directory DELETED.
- `tests/presentation/` -- entire directory DELETED.

**Plan 21-03 (final gate + closure):**

- `CHANGELOG.md` -- ADD v1.4 milestone closure entry listing closed SNM IDs.
- `.planning/STATE.md` -- mark v1.4 milestone complete.
- `.planning/PROJECT.md` -- update Key Decisions table with Phase 21 closure entries.
- `.planning/REQUIREMENTS.md` -- mark SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32 as complete in the per-phase mapping table. (Note: REQUIREMENTS.md currently shows SNM-22 with a stray `[x]` checkbox -- planner verifies this is corrected/aligned with the Phase 21 closure pattern.)

### Source files Phase 21 reads but does NOT modify

- `extensions/pi-claude-marketplace/shared/markers.ts` -- still exports `RECOVERY_PLUGIN_REINSTALL_PREFIX` + `STATE_LOCK_HELD_PREFIX` (Phase 5/7 extensions; NOT the 5 ES-5 markers). Active in production code. RETAINED.
- `tests/architecture/markers-snapshot.test.ts` -- drift-guards the 2 active exports above. RETAINED.
- `tests/architecture/notify-types.test.ts` -- compile-time proofs for the V2 type model. Reads (after Plan 21-02 lands) from `shared/notify.ts` instead of `shared/grammar/reasons.ts`. Test assertions unchanged.
- `tests/shared/notify-v2.test.ts` -- per-variant unit tests. Unchanged structurally; verifies the V2 surface stays GREEN through Phase 21.
- `tests/architecture/catalog-uat.test.ts` -- catalog byte-equality runner. Unchanged; verifies catalog UAT stays GREEN.
- All other `extensions/pi-claude-marketplace/**` files -- read for grep verification; no modifications.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`shared/notify.ts` re-export pattern (line 14):** `export type { Reason } from "./grammar/reasons.ts"` is the existing template for the D-21-01 aggressive-inline destination. The Phase 16 design comment at lines 9-13 ("Re-export Reason so Phase 16-20 call-site authors can import the entire v1.4 structured-notify surface from this file alone, instead of hopping to shared/grammar/reasons.ts. The runtime REASONS array + drift test stay in shared/grammar/reasons.ts as the source of truth (D-15-03), but call sites use this barrel re-export.") foreshadowed exactly this consolidation; D-21-01 finishes the journey by also inlining the runtime arrays.
- **`shared/errors.ts::causeChainTrailer` (line 46):** the depth-5 cause-chain walker that `composeErrorWithCauseChain` wraps with `errorMessage(err) + causeChainTrailer(err)`. After D-21-02 moves `composeErrorWithCauseChain` into `shared/errors.ts`, it lives alongside its dependency -- no cross-file hops for the cause-chain surface.
- **`domain/source.ts` parallel parsers:** the file already houses source-parsing helpers used by domain code; `sourceLogical(s)` and `ParsedSource` are a natural fit alongside the existing exports.
- **`tests/architecture/catalog-uat.test.ts` mock-ctx pattern:** verifies V2 byte-equality through real `notify()`. Survives Phase 21 untouched -- the V2 surface is the gate.

### Established Patterns

- **Renderer-as-spec discipline (D-16-04 inherited):** the V2 grammar IS `shared/notify.ts`'s rendering behavior. D-21-01 aggressive-inline of `REASONS` / `STATUS_TOKENS` finishes this by making `shared/notify.ts` the SINGLE file that defines the v1.4 surface (types + closed-set runtime arrays + renderer + entry points).
- **Atomic-single-commit discipline (D-18-06 + D-19-07 + D-20-06 inheritance):** Phase 21's Plans 21-01 and 21-02 each ship as ONE atomic commit because the cross-file dependencies are dense (config + source for Plan 21-01; `shared/notify.ts` + grammar/ + presentation/ + 11+ consumers for Plan 21-02). Intermediate states are non-compiling.
- **Single-source-of-truth for V2 closed sets (D-21-01 -- novel for Phase 21):** after this phase, `shared/notify.ts` is the sole declaration site for `REASONS` / `Reason` / `STATUS_TOKENS` / `StatusToken` / `MARKERS` / `Marker` / `PATTERN_CLASSES` / `PatternClass`. All call sites import from here.
- **Domain-relocation-over-orphan-deletion (D-21-02 -- novel for Phase 21):** when deleting a directory, utilities with active consumers are relocated to their natural homes (domain primitives → `domain/`, error helpers → `shared/errors.ts`, comparator → `shared/notify.ts`, install-specific type → `install.ts`, single-caller helper → inlined) rather than dropped.

### Integration Points

- **Phase 18-20 migration ↔ Phase 21 teardown:** Phases 18-20 migrated all V1 call sites to V2. The V1 wrappers in `shared/notify.ts` have ZERO callers anywhere (verified by grep). D-21-05 deletion is purely surgical -- no cascading test impact.
- **MSG-* lint scoping (Phase 14 / 16 / 18 / 19 / 20 narrowings) ↔ Plan 21-01:** after Phases 18-20, MSG-Block 1's `ignores` array covers all 3 orchestrator families (`marketplace/**`, `plugin/**`, `import/**`). The block matches zero files at this point -- effectively a no-op. Plan 21-01 wholesale-deletes the block (and all other MSG-Blocks) rather than continuing to narrow.
- **`presentation/` clean-sweep ↔ BLOCK C import-direction enforcement:** D-21-02 relocations respect the existing zone graph (`domain/` doesn't import upward; `shared/errors.ts` is leaf-callable; `shared/notify.ts` is the v1.4 entry point). Zero BLOCK C changes required.
- **`shared/grammar/` deletion ↔ `tests/architecture/notify-types.test.ts`:** the test imports `Reason` from `shared/grammar/reasons.ts` (line ?). Post-D-21-01, the test imports from `shared/notify.ts`. Compile-time invariance proofs are unaffected; only the import path changes.

</code_context>

<specifics>
## Specific Ideas

- **`pattern-classes.ts` and `markers.ts` are zero-caller orphans.** Verified by `grep -rln "shared/grammar/markers" extensions/ tests/` and similar for `pattern-classes`. Both files declare closed-set tuples (`MARKERS = ["autoupdate", "no autoupdate"]`; `PATTERN_CLASSES = ["legacy-error-prose", "legacy-cause-chain", ...]`) that no code currently imports. D-21-01 inlines them anyway to preserve the closed-set documentation -- they exist as architectural markers of what the v1.4 type system structurally encodes, even if no code uses the runtime arrays today.

- **The Phase 16 design comment at `shared/notify.ts:9-13` already signals the D-21-01 destination.** Reading it confirms the design intent toward `shared/notify.ts` as the single v1.4 surface. Phase 21 finishes the journey.

- **`composeErrorWithCauseChain` is a 1-line helper.** The function at `presentation/cause-chain.ts:30` is literally `return errorMessage(err) + causeChainTrailer(err)`. Moving it to `shared/errors.ts` (where `causeChainTrailer` lives) eliminates a redundant file.

- **`renderMarketplaceList` has exactly one caller.** Verified `orchestrators/marketplace/list.ts` is the sole non-test importer. Inlining is the natural choice over relocating to a directory that's being deleted.

- **`sourceLogical` is the most-imported single utility in `presentation/`.** Verified 9 consumers across `domain/`, `edge/handlers/`, `orchestrators/marketplace/`, `orchestrators/plugin/`, `orchestrators/import/`, `persistence/`. Its architectural home is `domain/` (parallel to `domain/source.ts`). The original placement in `presentation/marketplace-list.ts` was a v1.0-era mis-location that this phase corrects.

- **`compact-line.ts` is the V1 grammar renderer.** All 11 row types + `renderRow` are V1-only; only `EntityErrorRow` interface escaped V1 isolation (consumed by `install.ts` as an internal classified-error return shape). Phase 21 deletes the entire file by relocating that one interface.

- **No special pi-plumbing concerns.** Phase 21 doesn't introduce new orchestrator entry points or change Pi API consumption patterns. The existing `notify(ctx, pi, message)` signature in `shared/notify.ts` is the entry point everywhere.

- **`tests/architecture/grammar-frontmatter.test.ts` was already deleted earlier in v1.4.** Confirmed by `ls tests/architecture/grammar-frontmatter.test.ts` → not present. SNM-26's "rewrite or delete" closure happened in Phase 17 per REQUIREMENTS.md mapping. Phase 21 does nothing on this front.

- **The 1249 v1.3 baseline test count includes the 34 RuleTester suites in `tests/lint-rules/`.** The post-Phase-21 baseline drops by ~70-80 tests (34 RuleTester suites + 1 registry-parity test + 1 no-legacy-markers test + 11 composer tests + ad-hoc deletions). Phase 16/17.1/17.2 already shipped per-variant additions; no new tests added by Phase 21 except possibly a small `compareByNameThenScope` block (planner discretion).

</specifics>

<deferred>
## Deferred Ideas

- **`shared/markers.ts` cleanup:** the file still exports `RECOVERY_PLUGIN_REINSTALL_PREFIX` and `STATE_LOCK_HELD_PREFIX`. Both are Phase 5/7 extensions actively used in production. Out of scope for Phase 21 (orthogonal to V1-vs-V2 messaging migration). If a future tidy-up wants to relocate these into a more central home, it would be a small refactor.

- **`docs/messaging-style-guide.md` post-v1.4 review:** the style guide reflects v2.0 catalog grammar (locked in Phase 17). If a future revision wants to formalize the V2-only state (no V1 wrapper / no MSG-* drift-guard residue), it would be a doc-only update. Backlog.

- **`docs/output-catalog.md` per-command usage-error fixtures:** explicitly REJECTED in Phase 20 D-20-04 for v1.4. If a future milestone wants exhaustive per-callsite enumeration, it would be a doc-style change. Backlog.

- **Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }`:** still inlined in every edge handler and orchestrator test file. Cosmetic refactor; carried backlog from Phase 18 / 19 / 20.

- **Branded `Version` type with `hash-<12hex>` / semver validation:** Carried backlog from Phase 15/16.

- **Type-model amendments to support a top-level cause-bearing failure shape:** explicitly REJECTED for v1.4. Backlog.

- **v1.5 milestone planning:** Phase 21 closes v1.4. The next milestone (whatever it is) would be a fresh `/gsd-new-milestone` cycle. Not part of Phase 21.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 21` was not run during this discussion. The Phase 20 CONTEXT similarly noted no pre-targeted todos for the v1.4 final phases. If todos exist that should retroactively fold, the planner can surface them during research.

</deferred>

---

*Phase: 21-Final Teardown & GREEN Gate*
*Context gathered: 2026-05-27*
