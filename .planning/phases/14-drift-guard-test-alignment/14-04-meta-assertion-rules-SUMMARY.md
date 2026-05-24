---
phase: 14-drift-guard-test-alignment
plan: 04
subsystem: testing
tags: [eslint, eslint-plugin, typescript-eslint, rule-tester, drift-guard, msg-rules, meta-assertion]

# Dependency graph
requires:
  - phase: 14-drift-guard-test-alignment/03-drift-guard-infrastructure
    provides: empty tests/lint-rules/index.js shell, eslint.config.js overrides for tests/lint-rules/**/*.{js,ts}, yaml frontmatter loader at tests/lint-rules/lib/frontmatter.js
provides:
  - 16 of 34 MSG-* drift-guard rule files (meta-assertion subset per D-14-09)
  - 16 RuleTester companion *.test.js files (one per rule, all SMOKE-level valid: cases)
  - Populated tests/lint-rules/index.js with RULE_NAMES (length 16) and rules dict (16 keys)
  - eslint.config.js override adding @typescript-eslint/no-empty-function disable for tests/lint-rules/**/*.{js,ts}
affects:
  - 14-drift-guard-test-alignment/05-full-impl-rules (must add 18 rules to reach 34 total)
  - 14-drift-guard-test-alignment/06-registry-test-and-config-wiring (Plan 06 wires per-rule files: patterns in eslint.config.js)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Meta-assertion ESLint rule: no-op Program: () => {} visitor + meta.docs.description citing the structural enforcement mechanism (D-14-09)"
    - "Per-rule RuleTester companion under node:test using the 4-line shim (RuleTester.afterAll = test.after; ...) per RESEARCH.md Pitfall 1"
    - "ESM named-import plugin registration in tests/lint-rules/index.js with frozen RULE_NAMES + rules dict (D-14-07, D-14-12)"

key-files:
  created:
    - tests/lint-rules/msg-gr-1-line-grammar.js
    - tests/lint-rules/msg-gr-1-line-grammar.test.js
    - tests/lint-rules/msg-gr-2-marketplace-token.js
    - tests/lint-rules/msg-gr-2-marketplace-token.test.js
    - tests/lint-rules/msg-gr-3-per-scope.js
    - tests/lint-rules/msg-gr-3-per-scope.test.js
    - tests/lint-rules/msg-gr-4-reasons-block.js
    - tests/lint-rules/msg-gr-4-reasons-block.test.js
    - tests/lint-rules/msg-gr-5-marker-slot.js
    - tests/lint-rules/msg-gr-5-marker-slot.test.js
    - tests/lint-rules/msg-ic-1-filled-icon.js
    - tests/lint-rules/msg-ic-1-filled-icon.test.js
    - tests/lint-rules/msg-ic-2-open-icon.js
    - tests/lint-rules/msg-ic-2-open-icon.test.js
    - tests/lint-rules/msg-ic-3-blocked-icon.js
    - tests/lint-rules/msg-ic-3-blocked-icon.test.js
    - tests/lint-rules/msg-sd-3-soft-dep-scope.js
    - tests/lint-rules/msg-sd-3-soft-dep-scope.test.js
    - tests/lint-rules/msg-pl-1-description.js
    - tests/lint-rules/msg-pl-1-description.test.js
    - tests/lint-rules/msg-pl-2-version-slot.js
    - tests/lint-rules/msg-pl-2-version-slot.test.js
    - tests/lint-rules/msg-pl-3-version-arrow.js
    - tests/lint-rules/msg-pl-3-version-arrow.test.js
    - tests/lint-rules/msg-pl-4-upgradable-listonly.js
    - tests/lint-rules/msg-pl-4-upgradable-listonly.test.js
    - tests/lint-rules/msg-pl-5-hash-version.js
    - tests/lint-rules/msg-pl-5-hash-version.test.js
    - tests/lint-rules/msg-pl-6-version-non-success.js
    - tests/lint-rules/msg-pl-6-version-non-success.test.js
    - tests/lint-rules/msg-er-1-empty-token.js
    - tests/lint-rules/msg-er-1-empty-token.test.js
  modified:
    - tests/lint-rules/index.js
    - eslint.config.js

key-decisions:
  - "Each meta-assertion rule cites its enforcement mechanism in meta.docs.description and in a top-of-file comment block; the structural-enforcement vocabulary is consistent across all 16 rules (renderer / RowSpec discriminated union / file-private constants / catalog-uat byte-equality / Reason literal-union / EmptyToken Extract<...>)"
  - "Disabled @typescript-eslint/no-empty-function inside the existing tests/lint-rules/**/*.{js,ts} override (Rule 3 auto-fix) -- the no-op Program: () => {} visitor is intentional per RESEARCH.md Pitfall 8 mitigation and would otherwise be flagged on every meta-assertion rule"
  - "RULE_NAMES ordered family-then-numeric (gr → ic → sd → pl → er) for stable diffs across plans; the registry test in Plan 05 uses slug-prefix matching (name.startsWith('msg-gr-1-')) so the exact slug after the numeric ID does not matter structurally, but the locked filename set is pinned for cross-plan consistency with Plan 06's eslint.config.js wiring"

patterns-established:
  - "Meta-assertion rule template (RESEARCH.md Pattern 2): ESLintUtils.RuleCreator → exported createRule({ name, meta: { type: 'problem', docs, messages: { structurallyEnforced }, schema: [] }, defaultOptions: [], create() { return { Program: () => {} }; } }); paired with a top-of-file comment block citing MSG-* ID, the docs/messaging-style-guide.md section, D-14-09, and the specific structural enforcement mechanism"
  - "RuleTester companion test template (RESEARCH.md Pattern 5 + Pitfall 1): import * as test from 'node:test'; import { RuleTester } from '@typescript-eslint/rule-tester'; import rule from './<name>.js'; RuleTester.afterAll = test.after; RuleTester.describe = test.describe; RuleTester.it = test.it; RuleTester.itOnly = test.it.only; const ruleTester = new RuleTester(); ruleTester.run('<name>', rule, { valid: [{ code: 'const _x = 1;' }], invalid: [] });"
  - "Plugin registration pattern (RESEARCH.md Pattern 4 + D-14-12): named ESM imports at top, frozen RULE_NAMES array (consumed by registry parity test in Plan 05), default.rules dict mapping rule names to imported defaults"

requirements-completed:
  - CMC-38

# Metrics
duration: 35min
completed: 2026-05-24
---

# Phase 14 Plan 04: Meta-Assertion Rules Summary

**Lands 16 of 34 MSG-* drift-guard rules as structural meta-assertions per D-14-09 (LOCKED), each citing its enforcement mechanism (RowSpec union, Reason literal-union, file-private icon constants, EmptyToken.token Extract, or catalog-uat byte-equality) and paired with a SMOKE-level RuleTester companion test.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-24T18:46:00Z (approx.)
- **Completed:** 2026-05-24T19:20:51Z
- **Tasks:** 3
- **Files created:** 32 (16 rule files + 16 RuleTester companion tests)
- **Files modified:** 2 (`tests/lint-rules/index.js`, `eslint.config.js`)

## Accomplishments

- Authored exactly 16 meta-assertion ESLint rule files covering MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, and MSG-ER-1 (the LOCKED 16-entry set per RESEARCH.md Pattern 2).
- Each rule uses a no-op `Program: () => {}` visitor (RESEARCH.md Pitfall 8 mitigation) and cites the structural enforcement mechanism in both `meta.docs.description` and a top-of-file comment block.
- Authored 16 companion `*.test.js` files, each applying the 4-line node:test shim (RESEARCH.md Pitfall 1) and asserting a single SMOKE-level `valid:` RuleTester case (no `invalid:` cases -- meta-assertion rules can't fail).
- Wired all 16 rules into `tests/lint-rules/index.js`: `RULE_NAMES` (frozen array, length 16) + `default.rules` (dict, 16 keys) in stable family-then-numeric order.
- `npm run check` is GREEN at the final commit (1165 tests pass).

## Task Commits

Each task was committed atomically with the `SKIP=trufflehog` prefix per project CLAUDE.md (worktree-sandbox trufflehog spawn limitation; the scan itself runs clean from the main checkout and was verified before each commit):

1. **Task 1: Author 16 meta-assertion rule files** -- `7cd1547` (feat)
2. **Task 2: Author 16 RuleTester companion tests** -- `9e367b7` (test)
3. **Task 3: Wire 16 rules into tests/lint-rules/index.js** -- `7f0a331` (feat)

## Files Created

### Rule files (16)

- `tests/lint-rules/msg-gr-1-line-grammar.js` -- MSG-GR-1: line grammar; cites `RowSpec` discriminated union + `renderRow` switch in `presentation/compact-line.ts` + catalog-uat byte-equality
- `tests/lint-rules/msg-gr-2-marketplace-token.js` -- MSG-GR-2: `@<marketplace>` carve-out; cites `PluginCascadeRow` at `compact-line.ts:128-148` lacking the `marketplace` field
- `tests/lint-rules/msg-gr-3-per-scope.js` -- MSG-GR-3: per-scope rendering; cites sort-key + renderer logic in `presentation/marketplace-list.ts` + catalog-uat
- `tests/lint-rules/msg-gr-4-reasons-block.js` -- MSG-GR-4: closed-set reasons in `{}`; cites `Reason` literal-union in `shared/grammar/reasons.ts` + `composeReasons` in `compact-line.ts` + grammar-frontmatter drift test
- `tests/lint-rules/msg-gr-5-marker-slot.js` -- MSG-GR-5: `<marker>` slot on marketplace rows only; cites `MarketplaceRow.marker` literal-union + plugin-row variants lacking the field
- `tests/lint-rules/msg-ic-1-filled-icon.js` -- MSG-IC-1: filled icon `●`; cites file-private `ICON_INSTALLED` at `compact-line.ts:62` + renderer's icon dispatch
- `tests/lint-rules/msg-ic-2-open-icon.js` -- MSG-IC-2: open icon `○`; cites file-private `ICON_AVAILABLE` at `compact-line.ts:63` + per-shape icon dispatch
- `tests/lint-rules/msg-ic-3-blocked-icon.js` -- MSG-IC-3: blocked icon `⊘`; cites file-private `ICON_UNINSTALLABLE` at `compact-line.ts:64` + icon dispatch fn
- `tests/lint-rules/msg-sd-3-soft-dep-scope.js` -- MSG-SD-3: soft-dep emission scope; cites `PluginInlineUninstalledRow` at `compact-line.ts:114-120` lacking `declaresAgents` / `declaresMcp`
- `tests/lint-rules/msg-pl-1-description.js` -- MSG-PL-1: plugin-list description column; cites catalog-uat byte-equality + `description?` field declared only on `PluginListRow`
- `tests/lint-rules/msg-pl-2-version-slot.js` -- MSG-PL-2: `v<version>` slot; cites `version?: string` on plugin-row variants in `compact-line.ts` + catalog-uat
- `tests/lint-rules/msg-pl-3-version-arrow.js` -- MSG-PL-3: `v<from> → v<to>` transition; cites version-slot formatter in `compact-line.ts` + catalog-uat
- `tests/lint-rules/msg-pl-4-upgradable-listonly.js` -- MSG-PL-4: `(upgradable)` list-only; cites `PluginListRow.status` being the only `RowSpec` variant whose `Extract<StatusToken, ...>` includes `"upgradable"`
- `tests/lint-rules/msg-pl-5-hash-version.js` -- MSG-PL-5: `hash-<12hex>` verbatim; cites version-slot formatter + catalog-uat
- `tests/lint-rules/msg-pl-6-version-non-success.js` -- MSG-PL-6: version display on non-success states; cites per-shape renderers + `MarketplaceRow` lacking `version` field + catalog-uat
- `tests/lint-rules/msg-er-1-empty-token.js` -- MSG-ER-1: bare empty-list token; cites `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">` at `compact-line.ts:200-204`

### RuleTester companion tests (16)

One `*.test.js` per rule file above, each applying the 4-line node:test shim (`RuleTester.afterAll = test.after; ...`) and asserting `valid: [{ code: "const _x = 1;" }], invalid: []`.

## Files Modified

- `tests/lint-rules/index.js` -- 16 named ESM imports added; `RULE_NAMES` populated to length 16 in family-then-numeric order (gr → ic → sd → pl → er); `default.rules` dict populated with the 16 entries.
- `eslint.config.js` -- added `"@typescript-eslint/no-empty-function": "off"` to the existing `tests/lint-rules/**/*.{js,ts}` override (Rule 3 deviation; see Deviations section below).

## Decisions Made

- **Vocabulary consistency:** the structural-enforcement vocabulary across all 16 `meta.docs.description` strings is consistent (referring to `RowSpec` discriminated union, file-private icon constants by line number, `Reason` literal-union, `EmptyToken.token` Extract type, catalog-uat byte-equality, grammar-frontmatter drift test). Reviewer can grep for any MSG-* ID and locate both the rule and its enforcement.
- **Anchor-URL strategy:** the `ESLintUtils.RuleCreator` URL builder uses `https://github.com/.../docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}` -- a passthrough that maps `msg-gr-1-line-grammar` → `#msg-gr-1-line-grammar`. The registry test in Plan 14-05 does NOT verify the URL, only rule existence + registration; the URL is informational for reviewers (the canonical lookup is the bold `**MSG-GR-1**` cell in the style-guide tables).
- **RULE_NAMES order:** family-then-numeric (gr → ic → sd → pl → er; numeric ascending) for stable diffs across plans. Plan 05 will append its 18 full-impl entries to reach 34 total.
- **Smoke-test body:** chose minimal `const _x = 1;` over a substantive snippet showing a RowSpec usage. The rule's `Program` visitor is no-op; ANY valid code lints clean. The smoke-level case is sufficient to verify (a) the rule loads, (b) RuleTester wires correctly under node:test (Pitfall 1), and (c) the empty `invalid:` array does not throw.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Disabled `@typescript-eslint/no-empty-function` for `tests/lint-rules/**/*.{js,ts}`**

- **Found during:** Task 1 (right after authoring the 16 rule files; `npm run lint` flagged 16 errors -- one per rule)
- **Issue:** The plan's required no-op `Program: () => {}` visitor (RESEARCH.md Pitfall 8 mitigation) is itself flagged by `@typescript-eslint/no-empty-function` with `Unexpected empty method 'Program'`. The plan's Task 1 verify expected `npm run lint` to pass, but the lint rule trips on every meta-assertion file.
- **Fix:** Added `"@typescript-eslint/no-empty-function": "off"` to the existing override block at `eslint.config.js:331-346` (the same block that already disables `no-restricted-syntax`, `no-console`, etc., for the local plugin tree). Added a comment explaining the Pitfall 8 rationale.
- **Files modified:** `eslint.config.js`
- **Verification:** `npm run lint` green; `npm run check` green (1165 tests pass).
- **Committed in:** `7cd1547` (Task 1 commit -- the rule files and the override change ship together because the lint check on the rule files requires the override).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation is necessary for correctness -- the plan's mandated `Program: () => {}` visitor and the project's `@typescript-eslint/no-empty-function` default policy were structurally incompatible; the resolution scopes the disable narrowly to the `tests/lint-rules/**/*.{js,ts}` tree (the existing override boundary) so the project-wide default policy is preserved everywhere else. No scope creep.

## Issues Encountered

- **Prettier reformatted three rule files** (`msg-er-1-empty-token.js`, `msg-ic-3-blocked-icon.js`, `msg-pl-4-upgradable-listonly.js`) during the Task 1 pre-commit run: where a description string contained an escaped double-quote (e.g., `\"upgradable\"` inside Markdown backticks), Prettier preferred single-quote string delimiters with unescaped inner double-quotes. This is normal Prettier behavior; the auto-format ran before the commit and the final committed state is consistent. No content change.
- **Trufflehog pre-commit hook fails under the worktree sandbox** with `error preparing repo: failed to read index file: open .../.git/index: not a directory`. This is the documented worktree spawn issue (`.git` is a file in worktrees, not a directory). Per project CLAUDE.md, this is handled by prefixing `SKIP=trufflehog` on the commit AND running `pre-commit run trufflehog --all-files` separately from the main checkout to verify the scan is clean. Verified clean before each of the three task commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 14-05 (full-impl rules):** ready to author the remaining 18 MSG-* rules (MSG-SR-1..7, MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-RH-1, MSG-LC-1..2, MSG-SD-1..2) with full AST visitor coverage + planted-violation `invalid:` cases. Plan 14-05 will extend `tests/lint-rules/index.js` additively to reach 34 entries total. **MSG-ER-1 is intentionally NOT in Plan 14-05's scope** -- it ships here as meta-assertion per D-14-09.
- **Plan 14-06 (registry test + config wiring):** ready to write the registry parity test at `tests/architecture/msg-rule-registry.test.ts` (asserts every style-guide MSG-* ID has a `RULE_NAMES` entry AND that the rule is referenced by some `eslint.config.js` block) and to add per-rule `files:` patterns to `eslint.config.js`.

## Self-Check: PASSED

**Files exist (16 rule files + 16 companion tests + 1 modified index + 1 modified eslint config):**

- `tests/lint-rules/msg-gr-1-line-grammar.js` -- FOUND
- `tests/lint-rules/msg-gr-1-line-grammar.test.js` -- FOUND
- `tests/lint-rules/msg-gr-2-marketplace-token.js` -- FOUND
- `tests/lint-rules/msg-gr-2-marketplace-token.test.js` -- FOUND
- `tests/lint-rules/msg-gr-3-per-scope.js` -- FOUND
- `tests/lint-rules/msg-gr-3-per-scope.test.js` -- FOUND
- `tests/lint-rules/msg-gr-4-reasons-block.js` -- FOUND
- `tests/lint-rules/msg-gr-4-reasons-block.test.js` -- FOUND
- `tests/lint-rules/msg-gr-5-marker-slot.js` -- FOUND
- `tests/lint-rules/msg-gr-5-marker-slot.test.js` -- FOUND
- `tests/lint-rules/msg-ic-1-filled-icon.js` -- FOUND
- `tests/lint-rules/msg-ic-1-filled-icon.test.js` -- FOUND
- `tests/lint-rules/msg-ic-2-open-icon.js` -- FOUND
- `tests/lint-rules/msg-ic-2-open-icon.test.js` -- FOUND
- `tests/lint-rules/msg-ic-3-blocked-icon.js` -- FOUND
- `tests/lint-rules/msg-ic-3-blocked-icon.test.js` -- FOUND
- `tests/lint-rules/msg-sd-3-soft-dep-scope.js` -- FOUND
- `tests/lint-rules/msg-sd-3-soft-dep-scope.test.js` -- FOUND
- `tests/lint-rules/msg-pl-1-description.js` -- FOUND
- `tests/lint-rules/msg-pl-1-description.test.js` -- FOUND
- `tests/lint-rules/msg-pl-2-version-slot.js` -- FOUND
- `tests/lint-rules/msg-pl-2-version-slot.test.js` -- FOUND
- `tests/lint-rules/msg-pl-3-version-arrow.js` -- FOUND
- `tests/lint-rules/msg-pl-3-version-arrow.test.js` -- FOUND
- `tests/lint-rules/msg-pl-4-upgradable-listonly.js` -- FOUND
- `tests/lint-rules/msg-pl-4-upgradable-listonly.test.js` -- FOUND
- `tests/lint-rules/msg-pl-5-hash-version.js` -- FOUND
- `tests/lint-rules/msg-pl-5-hash-version.test.js` -- FOUND
- `tests/lint-rules/msg-pl-6-version-non-success.js` -- FOUND
- `tests/lint-rules/msg-pl-6-version-non-success.test.js` -- FOUND
- `tests/lint-rules/msg-er-1-empty-token.js` -- FOUND
- `tests/lint-rules/msg-er-1-empty-token.test.js` -- FOUND
- `tests/lint-rules/index.js` -- FOUND (modified)
- `eslint.config.js` -- FOUND (modified)

**Commits exist:**

- `7cd1547` (Task 1) -- FOUND
- `9e367b7` (Task 2) -- FOUND
- `7f0a331` (Task 3) -- FOUND

---

*Phase: 14-drift-guard-test-alignment*
*Completed: 2026-05-24*
