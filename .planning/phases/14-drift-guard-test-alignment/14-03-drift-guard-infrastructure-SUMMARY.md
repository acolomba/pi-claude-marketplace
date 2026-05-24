---
phase: 14-drift-guard-test-alignment
plan: 03
subsystem: testing
tags: [eslint, eslint-flat-config, yaml, drift-guard, msg-rules, typescript-eslint, rule-tester, grammar]

# Dependency graph
requires:
  - phase: 12-messaging-foundations-renderer-primitives
    provides: "D-CMC-01/02/08 one-closed-set-per-file grammar precedent; D-CMC-04 deferred richer YAML reader; STATUS_TOKENS + REASONS literal-unions"
  - phase: 13-conformance-refactor-es-5-supersession
    provides: "D-13-20 15-entry STATUS_TOKENS extension; SoftDepProbe shape used by the renderer"
  - plan: 14-01-cmc-16-closure
    provides: "Wave 1 CMC-16 closure (must precede Wave 3 per D-14-03)"
  - plan: 14-02-cmc-34-closure
    provides: "Wave 2 CMC-34 closure (must precede Wave 3 per D-14-03)"
provides:
  - "Wave 3a drift-guard infrastructure: rule-tester + yaml direct devDeps"
  - "Memoized YAML frontmatter loader at tests/lint-rules/lib/frontmatter.js exposing 4 closed-set arrays"
  - "Local ESLint plugin shell at tests/lint-rules/index.js (empty rules; populated by Plans 04/05)"
  - "MARKERS closed-set literal-union (2 entries) at shared/grammar/markers.ts"
  - "PATTERN_CLASSES closed-set literal-union (12 entries) at shared/grammar/pattern-classes.ts"
  - "Canonical MARKETPLACE_LABEL_PROBE module at shared/constants/marketplace-label-probe.ts (dedup of 3 historical definitions)"
  - "4-key set-equality drift test at tests/architecture/grammar-frontmatter.test.ts (extended from 2-key)"
  - "tseslint disableTypeChecked + relaxed-rules ESLint overrides for tests/lint-rules/"
affects:
  - 14-04-meta-assertion-rules
  - 14-05-full-impl-rules-and-registry
  - 14-06-plugin-registration-in-eslint-config
  - 15-* (future MSG-* additions consume the loader without test-code changes -- SC #3)

# Tech tracking
tech-stack:
  added:
    - "@typescript-eslint/rule-tester ^8.59.4 (devDep; powers per-rule planted-violation tests in Plans 04/05)"
    - "yaml ^2.9.0 (promoted from transitive to direct devDep per D-14-10)"
  patterns:
    - "Memoized YAML frontmatter loader (RESEARCH.md Pattern 3): module-scope cache + parametrized parseStyleGuideFrontmatter helper for negative tests"
    - "Local ESLint plugin shell (RESEARCH.md Pattern 4): RULE_NAMES frozen array + default { meta, rules } export; consumed by Plan 14-06 eslint.config.js registration"
    - "Co-located .d.ts for a .js loader to bridge TS-strict consumers without broadening tsconfig with allowJs"
    - "Closed-set dedup via shared/constants/<name>.ts + inline structural-type re-declaration to honor D-11 layering (shared/ cannot upward-import presentation/)"

key-files:
  created:
    - "tests/lint-rules/lib/frontmatter.js"
    - "tests/lint-rules/lib/frontmatter.d.ts"
    - "tests/lint-rules/index.js"
    - "extensions/pi-claude-marketplace/shared/grammar/markers.ts"
    - "extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts"
    - "extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts"
  modified:
    - "package.json (rule-tester + yaml devDeps; test glob extended with tests/lint-rules/)"
    - "package-lock.json (lockfile update for the two new devDeps)"
    - "eslint.config.js (tests/lint-rules/ override block: tseslint.configs.disableTypeChecked + relaxed test-infra rules)"
    - "tests/architecture/grammar-frontmatter.test.ts (migrated to shared loader; extended from 2-key to 4-key set-equality)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts (local MARKETPLACE_LABEL_PROBE deleted; imports from shared/constants/)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts (same dedup)"
    - "extensions/pi-claude-marketplace/presentation/marketplace-list.ts (same dedup; docstring updated to cite the canonical module)"

key-decisions:
  - "Co-located .d.ts for the .js loader: bridges TS-strict consumers (grammar-frontmatter.test.ts) without broadening tsconfig.json with allowJs (Rule 3 fix - the cleaner alternative to widening type-checking scope)"
  - "Inline structural type re-declaration in shared/constants/marketplace-label-probe.ts: avoids the D-11 layering violation that an `import type { SoftDepProbe }` would create (shared/ may only import from platform/ per BLOCK C)"
  - "Extended the tests/lint-rules/ ESLint override to disable @typescript-eslint/explicit-module-boundary-types and four other test-infra-irrelevant rules; mirrors the existing tests/**/*.ts override"
  - "Plugin shell registered nowhere in eslint.config.js yet -- D-14-07 wires it in Plan 14-06 once the 34 rules exist; empty registration now would break the Plan 14-05 registry parity test"

patterns-established:
  - "Pattern: YAML loader as .js + co-located .d.ts -- keeps the loader's `parserOptions.projectService: true` overhead off the test-infra tree while still giving TS consumers strict types"
  - "Pattern: Sentinel-object dedup via shared/constants/<name>.ts with inline structural type -- the canonical home for non-closed-set constants that need to be importable from both presentation/ and orchestrators/ while honoring D-11"
  - "Pattern: parseStyleGuideFrontmatter parametrized helper -- exposed alongside the memoized loadFrontmatter so negative tests can exercise the parser with bad input the module-load-time reader can't see"

requirements-completed: [CMC-38]

# Metrics
duration: ~30min
completed: 2026-05-24
---

# Phase 14 Plan 03: Drift Guard Infrastructure Summary

**Wave 3a foundation: YAML frontmatter loader + 2 new closed-set grammar files + local ESLint plugin shell + MARKETPLACE_LABEL_PROBE single-source-of-truth dedup, with the grammar-frontmatter drift test extended to all four closed sets**

## Performance

- **Duration:** ~30 min (5 tasks; first commit 14:34, last task commit 14:55 local; SUMMARY commit follows)
- **Started:** 2026-05-24T18:32Z (approx, first `npm install` step)
- **Completed:** 2026-05-24T18:55Z (final task commit)
- **Tasks:** 5 / 5
- **Files modified:** 11 (6 created, 5 modified excluding lockfile)

## Accomplishments

- `@typescript-eslint/rule-tester` and `yaml` landed as direct devDependencies; `package.json:test` glob now covers `tests/lint-rules/**/*.test.{js,ts}` (zero-match today; populated by Plans 04/05)
- ESLint flat-config gets a `tests/lint-rules/**/*.{js,ts}` override block applying `tseslint.configs.disableTypeChecked` (per RESEARCH.md Pitfall 2: avoids the `parserOptions.projectService` "not in tsconfig" refusal) plus a sibling block relaxing `@typescript-eslint/explicit-module-boundary-types` and a few test-infra-irrelevant rules
- Memoized YAML frontmatter loader at `tests/lint-rules/lib/frontmatter.js` exports four frozen arrays -- `STATUS_TOKENS_FRONTMATTER` (15), `REASONS_FRONTMATTER` (28), `MARKERS_FRONTMATTER` (2), `PATTERN_CLASSES_FRONTMATTER` (12) -- plus a `parseStyleGuideFrontmatter` pure helper for negative tests and a `loadFrontmatter` memoized reader
- Local ESLint plugin shell at `tests/lint-rules/index.js` (empty `RULE_NAMES`, empty `rules`); not yet wired into `eslint.config.js` -- Plan 14-06 does the per-rule `files:` registration once Plans 04/05 land the 34 rules
- Two NEW closed-set grammar files: `shared/grammar/markers.ts` (2 entries) and `shared/grammar/pattern-classes.ts` (12 entries); both follow the Phase 12 D-CMC-01..D-CMC-03 / D-CMC-08 one-closed-set-per-file precedent
- `MARKETPLACE_LABEL_PROBE` consolidated into a single canonical module at `shared/constants/marketplace-label-probe.ts`; the 3 byte-equal historical definitions at `add.ts:81`, `autoupdate.ts:60`, `marketplace-list.ts:74` are gone -- all three sites import from the new module (D-14-05 WARNING-level audit finding closed)
- `tests/architecture/grammar-frontmatter.test.ts` migrated from the Phase 12 hand-rolled `extractFrontmatterList` regex extractor to the shared loader; extended from 2-key to 4-key set-equality; the two negative tests carry forward via `parseStyleGuideFrontmatter`
- `npm run check` GREEN throughout (1149 / 1149 tests pass at the Plan 03 commit) -- Wave 3a milestone gate cleared

## Task Commits

Each task was committed atomically (per CLAUDE.md Conventional Commits; `SKIP=trufflehog` per project worktree rule):

1. **Task 1: package.json + eslint.config.js infrastructure landing** -- `bbc57a9` (feat)
2. **Task 2: tests/lint-rules/lib/frontmatter.js loader + tests/lint-rules/index.js plugin shell** -- `ff0726b` (feat)
3. **Task 3: shared/grammar/markers.ts + shared/grammar/pattern-classes.ts** -- `6e2c32f` (feat)
4. **Task 4: grammar-frontmatter.test.ts migration to shared loader + 4-key parity** -- `b3466e1` (test)
5. **Task 5: MARKETPLACE_LABEL_PROBE dedup into shared/constants/** -- `e44a9ee` (refactor)

**Plan metadata commit follows** (this SUMMARY.md).

## Files Created/Modified

### Created
- `tests/lint-rules/lib/frontmatter.js` -- Memoized YAML loader; `parse*` helper + `load*` reader + 4 frozen array exports
- `tests/lint-rules/lib/frontmatter.d.ts` -- TypeScript declarations bridging the .js loader to TS-strict consumers (added as a Rule 3 fix when the migrated test failed `tsc --noEmit` with TS7016)
- `tests/lint-rules/index.js` -- Local ESLint plugin shell; empty `RULE_NAMES` + empty `rules` (Plans 04/05 populate)
- `extensions/pi-claude-marketplace/shared/grammar/markers.ts` -- `MARKERS` (2 entries) + `Marker` literal-union type
- `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` -- `PATTERN_CLASSES` (12 entries) + `PatternClass` literal-union type
- `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` -- Canonical `MARKETPLACE_LABEL_PROBE` sentinel; inline `MarketplaceLabelProbeShape` interface to honor D-11 layering

### Modified
- `package.json` -- `@typescript-eslint/rule-tester ^8.59.4` + `yaml ^2.9.0` added to devDependencies; test script glob extended with `"tests/lint-rules/**/*.test.{js,ts}"`
- `package-lock.json` -- lockfile update for the two new devDeps (committed atomically with `package.json` per project convention)
- `eslint.config.js` -- two new override blocks for `tests/lint-rules/**/*.{js,ts}`: (a) `tseslint.configs.disableTypeChecked` (Pitfall 2 mitigation), (b) explicit rules relaxation for test-infra style
- `tests/architecture/grammar-frontmatter.test.ts` -- `extractFrontmatterList` deleted; imports from shared loader; 4 set-equality tests (one per closed set) + 2 `parseStyleGuideFrontmatter`-level negative tests
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- local `MARKETPLACE_LABEL_PROBE` deleted; `SoftDepProbe` type import removed; new `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts"`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- same dedup
- `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` -- same dedup; the head-of-file docstring at lines 28-34 updated to cite the canonical module

## Decisions Made

- **Co-located `.d.ts` for the JS loader** rather than turning on `allowJs: true` in `tsconfig.json`: keeps the project's strict TS scope narrow. The `.js` loader was a deliberate choice (RESEARCH.md recommendation: test infra stays out of `parserOptions.projectService`); a `.d.ts` sibling is the minimal bridge for the TS test that consumes it.
- **Inline `MarketplaceLabelProbeShape` interface** in `shared/constants/marketplace-label-probe.ts` rather than importing `SoftDepProbe` from `presentation/compact-line.ts`: `shared/` may only upward-import from `platform/` per BLOCK C. TypeScript structural typing lets `MARKETPLACE_LABEL_PROBE` flow into any `SoftDepProbe` parameter without casts, so callers are unaffected.
- **Extended `tests/lint-rules/` ESLint override beyond plain `disableTypeChecked`** to also turn off `@typescript-eslint/explicit-module-boundary-types`, `no-floating-promises`, `no-non-null-assertion`, `no-unnecessary-condition`, `no-restricted-syntax`, `no-console`: the project enables boundary-typing globally; JSDoc-annotated ESLint plugin code shouldn't be held to that standard. Mirrors the existing `tests/**/*.ts` override.
- **Plugin shell NOT registered in `eslint.config.js` yet**: registering an empty `plugins: { msg: msgPlugin }` block now would silently break Plan 14-05's registry parity test (which asserts every name in `RULE_NAMES` appears in an `eslint.config.js` rules block). D-14-07 / Plan 14-06 wires the per-rule `files:` patterns once rules exist.
- **`markers.ts` as inline single-line array** (`["autoupdate", "no autoupdate"]`) rather than multi-line: Prettier-clean for 2 entries; the parity test asserts set-equality on the runtime values, not the source-form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript-strict typecheck rejected the .js loader import**
- **Found during:** Task 4 (`tsc --noEmit` failed with `TS7016: Could not find a declaration file for module '../lint-rules/lib/frontmatter.js'`)
- **Issue:** The `tests/architecture/grammar-frontmatter.test.ts` is a `.ts` file under strict typecheck; it imports from the new `.js` loader. With no declarations, TS resolves the loader to `any` and the strict config refuses.
- **Fix:** Created `tests/lint-rules/lib/frontmatter.d.ts` with parallel declarations for `parseStyleGuideFrontmatter`, `loadFrontmatter`, and the four named array exports. The `tests/**/*.ts` include glob in `tsconfig.json` picks it up automatically.
- **Alternative considered:** adding `allowJs: true` to `tsconfig.json`. Rejected -- would broaden the strict-typecheck scope to every `.js` file under `tests/` and `extensions/` (zero today, but a hidden footgun).
- **Files modified:** `tests/lint-rules/lib/frontmatter.d.ts` (NEW)
- **Verification:** `npm run typecheck` green; `node --test tests/architecture/grammar-frontmatter.test.ts` passes all 6 cases.
- **Committed in:** `b3466e1` (Task 4 commit; the .d.ts was added before staging Task 4)

**2. [Rule 3 - Blocking] BLOCK C layering rejected `shared/` importing `SoftDepProbe` from `presentation/`**
- **Found during:** Task 5 (initial draft of `shared/constants/marketplace-label-probe.ts` imported `type { SoftDepProbe }` from `presentation/compact-line.ts`; `npm run lint` failed with `import-x/no-restricted-paths`)
- **Issue:** The plan's PLAN.md `<action>` step said to "Import `SoftDepProbe` from `../../presentation/compact-line.ts`"; this violates eslint.config.js BLOCK C zone for `shared/` (target restricted from importing presentation/).
- **Fix:** Re-declared the structural shape inline as a local `MarketplaceLabelProbeShape` interface (2 readonly boolean fields, byte-equal to `SoftDepProbe`). TypeScript structural typing makes the constant assignable to any `SoftDepProbe` parameter without casts.
- **Alternative considered:** Moving `SoftDepProbe` to a new `shared/soft-dep.ts` module and re-exporting from `presentation/compact-line.ts`. Rejected -- bigger blast radius for a single sentinel constant; structural duplication is local and well-commented.
- **Files modified:** `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts`
- **Verification:** `npm run lint` green; the 3 consumer sites pass `renderRow(..., MARKETPLACE_LABEL_PROBE)` without casts; `npm run check` green (1149/1149 tests).
- **Committed in:** `e44a9ee` (Task 5 commit)

**3. [Rule 3 - Blocking] ESLint global `@typescript-eslint/explicit-module-boundary-types` rule fired on the JS loader**
- **Found during:** Task 2 (`npm run lint` after writing `tests/lint-rules/lib/frontmatter.js` reported 3 errors on the loader's function signatures)
- **Issue:** The plan added a `tseslint.configs.disableTypeChecked` override for `tests/lint-rules/`, but the global block's `@typescript-eslint/explicit-module-boundary-types: error` is not type-aware -- it stays active.
- **Fix:** Added a SECOND override block for `tests/lint-rules/**/*.{js,ts}` that explicitly disables `explicit-module-boundary-types` + four other test-infra-irrelevant rules. Mirrors the existing `tests/**/*.ts` override.
- **Files modified:** `eslint.config.js`
- **Verification:** `npm run lint` green
- **Committed in:** `ff0726b` (Task 2 commit; included in the same atomic landing as the loader/shell)

**4. [Rule 3 - Blocking] Import-order violation after adding the new import in `add.ts`**
- **Found during:** Task 5 (`npm run lint` reported `import-x/order`: `shared/constants/marketplace-label-probe.ts` must sort before `shared/errors.ts`)
- **Issue:** Manual edit landed the new import in the wrong slot in the alphabetized import block.
- **Fix:** Ran `npm run lint:fix`; auto-fix re-sorted the imports.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (import block only)
- **Verification:** `npm run lint` green
- **Committed in:** `e44a9ee` (Task 5 commit)

---

**Total deviations:** 4 auto-fixed (4 × Rule 3 "blocking issue"). None changed plan scope or semantics.
**Impact on plan:** All four were anticipated friction-points (the d.ts was implied by RESEARCH.md Pattern 3's choice to keep the loader as JS while the consumer is TS; the BLOCK C violation is called out implicitly in eslint.config.js but the PLAN.md action step assumed an unrestricted import; the explicit-module-boundary-types friction is the same shape as the existing tests/**/*.ts override; the import-order was a mechanical fix). No scope creep.

## Issues Encountered

- **Trufflehog hook fails under worktree sandbox.** Per project CLAUDE.md: "the trufflehog hook's auto-updater fails to spawn child processes under the worktree sandbox even though the underlying scan succeeds; running `pre-commit run trufflehog --all-files` separately (outside `git commit`) still passes". Verified clean (`pre-commit run trufflehog --all-files` from the main checkout returned `Passed`); committed with `SKIP=trufflehog` per the project's documented worktree procedure.
- **`node_modules/` was empty in the worktree at start.** Worktrees don't share their parent's `node_modules/`. Ran `npm install --no-audit --no-fund` to populate it before the Task 1 `npm install -D` step. Took ~19s; lockfile was committed unchanged by that step (only the subsequent `npm install -D` rewrote it, atomically with the package.json edit).

## Threat Flags

None -- no new network endpoints, no new auth surface, no new file-write paths. The `readFileSync` inside the loader reads a committed-in-repo file (`docs/messaging-style-guide.md`); the only new write paths in this plan are committed source files. T-14-05 and T-14-SC from the plan's `<threat_model>` are both addressed: T-14-05 (loader tampering) is `accept` per plan -- the loader fails fast at module load on malformed input; T-14-SC (npm install) is `mitigate` per plan -- both packages were verified in RESEARCH.md's package-legitimacy audit (rule-tester is a sibling of an already-installed `typescript-eslint` package; `yaml` was already on disk as transitive).

## Known Stubs

None. The plugin shell at `tests/lint-rules/index.js` is intentionally empty per the plan (populated by Plans 04/05/06); CONTEXT.md and the plan explicitly document this. The empty `RULE_NAMES` array is NOT a UI-affecting stub -- it's the registry-parity contract that Plan 05 asserts against.

## User Setup Required

None -- no external service configuration. The added packages are pure devDependencies installable via `npm install` (already run as part of the standard project setup).

## Next Phase Readiness

- Wave 3a milestone gate cleared: `npm run check` is green; all 1149 tests pass; the foundation is ready for Plan 14-04 (meta-assertion rules), Plan 14-05 (full-impl rules + registry parity test), and Plan 14-06 (per-rule `files:` registration in `eslint.config.js`).
- The loader's 4 frozen-array exports are the contract Plans 04/05 consume (no per-rule re-parse of the style-guide markdown).
- The two new closed-set grammar files (`markers.ts`, `pattern-classes.ts`) are typed and parity-asserted; future MSG-* rules that need the `Marker` / `PatternClass` literal-union types have them available.
- The `MARKETPLACE_LABEL_PROBE` dedup closes one of the two WARNING-level audit findings in `.planning/v1.3-MILESTONE-AUDIT.md`. The remaining WARNING-level finding (`transaction/rollback.ts:56-62` refactor through the renderer) is owned by a separate Wave 3 plan.
- Plan 14-06 (or whichever plan registers the local plugin in `eslint.config.js`) MUST land AFTER Plans 04/05 -- registering with an empty rules object now would silently fail the Plan 14-05 registry parity test.

## TDD Gate Compliance

Not applicable -- this plan is `type: execute`, not `type: tdd`. The drift-guard suite itself enforces test-based correctness for the messaging contract; the plan's RuleTester `valid:` / `invalid:` fixture pattern (Plans 04/05) is structurally TDD-shaped but the *infrastructure* plan here lands the loader / plugin shell / grammar files / dedup as straight implementation.

## Self-Check

**FILE PRESENCE (all created files exist):**
- `tests/lint-rules/lib/frontmatter.js` -- FOUND
- `tests/lint-rules/lib/frontmatter.d.ts` -- FOUND
- `tests/lint-rules/index.js` -- FOUND
- `extensions/pi-claude-marketplace/shared/grammar/markers.ts` -- FOUND
- `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` -- FOUND
- `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` -- FOUND

**COMMITS (all 5 task commits present):**
- `bbc57a9` (Task 1) -- FOUND
- `ff0726b` (Task 2) -- FOUND
- `6e2c32f` (Task 3) -- FOUND
- `b3466e1` (Task 4) -- FOUND
- `e44a9ee` (Task 5) -- FOUND

**FUNCTIONAL VERIFICATION:**
- Loader smoke test passes: counts 15 / 28 / 2 / 12 across the four closed sets -- byte-equal to the frontmatter.
- Plugin shell smoke test passes: empty `RULE_NAMES`, empty `rules`.
- `MARKETPLACE_LABEL_PROBE` definition count: 1 (only the canonical module).
- `npm run check` GREEN (1149 / 1149 tests pass).

## Self-Check: PASSED

---
*Phase: 14-drift-guard-test-alignment*
*Plan: 03*
*Completed: 2026-05-24*
