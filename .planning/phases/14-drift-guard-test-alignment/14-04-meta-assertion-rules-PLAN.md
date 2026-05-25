---
phase: 14-drift-guard-test-alignment
plan: 04
type: execute
wave: 3
depends_on:
  - 14-03-drift-guard-infrastructure
files_modified:
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
  - tests/lint-rules/index.js
autonomous: true
requirements:
  - CMC-38

must_haves:
  truths:
    - "Exactly 16 meta-assertion rule files exist under tests/lint-rules/ -- one per MSG-* ID in the meta-assertion set per RESEARCH.md Pattern 2 §'Which MSG-* IDs are meta-assertion?': MSG-GR-1..5 (5) + MSG-IC-1..3 (3) + MSG-SD-3 (1) + MSG-PL-1..6 (6) + MSG-ER-1 (1) = 16."
    - "Each rule's `create()` returns a no-op `{ Program: () => {} }` visitor (RESEARCH.md Pitfall 8); rule body does no AST work."
    - "Each rule's `meta.docs.description` cites the structural enforcement mechanism (the file or test that DOES enforce the rule) -- RESEARCH.md Pattern 2."
    - "Each rule's `meta.messages` includes a `structurallyEnforced` (or equivalent) message keyed for the registry test."
    - "Each rule file has a sibling `*.test.js` RuleTester companion with the 4-line node:test shim (RESEARCH.md Pitfall 1) + a SMOKE-level `valid:` case with no `invalid:` cases (meta-assertion rules can't fail -- the test asserts that valid code lints clean, which is the smoke gate)."
    - "`tests/lint-rules/index.js` `RULE_NAMES` array includes exactly 16 entries (the meta-assertion set); `rules:` object exports all 16 rule modules under the same names. Plan 05 will add 18 more to reach 34 total."
    - "Each RuleTester companion `.test.js` runs under `node --test` and passes."
    - "`npm run check` is green at the Plan 04 commit (the rules exist in the plugin module but are NOT yet registered in eslint.config.js -- that wiring is Plan 06)."
  artifacts:
    - path: tests/lint-rules/msg-gr-1-line-grammar.js
      provides: "Meta-assertion rule citing the RowSpec + renderRow structural enforcement"
      contains: "msg-gr-1-line-grammar"
    - path: tests/lint-rules/msg-sd-3-soft-dep-scope.js
      provides: "Meta-assertion rule citing PluginInlineUninstalledRow lacking predicate fields"
      contains: "msg-sd-3-soft-dep-scope"
    - path: tests/lint-rules/msg-er-1-empty-token.js
      provides: "Meta-assertion rule citing EmptyToken.token Extract<StatusToken, ...> structural enforcement"
      contains: "msg-er-1-empty-token"
    - path: tests/lint-rules/index.js
      provides: "Plugin entry; RULE_NAMES + rules object populated with the 16 meta-assertion rules"
      contains: "RULE_NAMES"
  key_links:
    - from: tests/lint-rules/index.js
      to: "tests/lint-rules/msg-*.js (16 files)"
      via: "ESM named imports + plugin rules dict"
      pattern: "import.*from.*msg-"
---

<objective>
Land 16 of the 34 MSG-* drift-guard rules -- the meta-assertion subset locked by D-14-09 and enumerated in RESEARCH.md Pattern 2 §"Which MSG-* IDs are meta-assertion?". Per D-14-09 (LOCKED), rules whose semantic content is already structurally enforced (by the `RowSpec` discriminated union in `presentation/compact-line.ts`, by the `Reason` literal-union in `shared/grammar/reasons.ts`, by the `EmptyToken.token: Extract<StatusToken, ...>` shape, or by the byte-equality assertions in `tests/architecture/catalog-uat.test.ts`) become thin "structural meta-assertion" rules. Each meta-assertion rule cites the structural mechanism in its `meta.docs.description`, contains a no-op `Program: () => {}` visitor (RESEARCH.md Pitfall 8 mitigation), and is paired with a companion `*.test.js` file containing a SMOKE-level `valid:` RuleTester case.

**Locked count (per RESEARCH.md Pattern 2 enumeration):**

The 16 meta-assertion MSG-* IDs are: MSG-GR-1, MSG-GR-2, MSG-GR-3, MSG-GR-4, MSG-GR-5 (5) + MSG-IC-1, MSG-IC-2, MSG-IC-3 (3) + MSG-SD-3 (1) + MSG-PL-1, MSG-PL-2, MSG-PL-3, MSG-PL-4, MSG-PL-5, MSG-PL-6 (6) + MSG-ER-1 (1) = **16**.

Plan 05 ships the remaining 18 full-impl rules: MSG-SR-1..7 (7) + MSG-MR-1..2 (2) + MSG-RP-1 (1) + MSG-CC-1 (1) + MSG-NC-1..2 (2) + MSG-RH-1 (1) + MSG-LC-1..2 (2) + MSG-SD-1..2 (2) = 18. Total: 16 + 18 = 34. **MSG-ER-1 is in this plan (meta-assertion family); it MUST NOT appear in Plan 05.**

Purpose: Ships 16 of 34 MSG-* rules as structural meta-assertions; satisfies SC #2 ("failure includes MSG-* rule ID") for these rules via the rule-name-embedded message; satisfies the registry parity test (Plan 05) for these IDs. Per D-14-09 (LOCKED meta vs. full split).
Output: 16 rule files + 16 RuleTester companion tests + updated tests/lint-rules/index.js with RULE_NAMES.length === 16; `npm run check` green.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@docs/messaging-style-guide.md
@tests/lint-rules/lib/frontmatter.js
@tests/lint-rules/index.js
@extensions/pi-claude-marketplace/presentation/compact-line.ts
@extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
@extensions/pi-claude-marketplace/shared/grammar/reasons.ts

<interfaces>
<!-- Templates the executor consumes. -->

From RESEARCH.md Pattern 2 (Meta-assertion rule template):
- Import: `import { ESLintUtils } from "@typescript-eslint/utils";`
- `const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#<msg-id-anchor>`);`
- Default export: `createRule({ name: "msg-<family>-<n>-<slug>", meta: { type: "problem", docs: { description: ... }, messages: { structurallyEnforced: ... }, schema: [] }, defaultOptions: [], create() { return { Program: () => {} }; } });`

From RESEARCH.md Pattern 5 (RuleTester companion template -- for meta-assertion the `invalid:` array is empty):
- 4-line node:test shim at the top:
  - `RuleTester.afterAll = test.after;`
  - `RuleTester.describe = test.describe;`
  - `RuleTester.it = test.it;`
  - `RuleTester.itOnly = test.it.only;`
- `const ruleTester = new RuleTester();`
- `ruleTester.run("<name>", rule, { valid: [{ code: "/* anything */" }], invalid: [] });`

From RESEARCH.md Pattern 2 "Which MSG-* IDs are meta-assertion?" -- citation map for `meta.docs.description` (the 16 LOCKED entries):
- MSG-GR-1: line grammar enforced by `RowSpec` discriminated union + `renderRow` switch in `presentation/compact-line.ts`
- MSG-GR-2: `@<marketplace>` carve-out enforced by `PluginCascadeRow` lacking the field
- MSG-GR-3: per-scope rendering enforced by sort-key in `presentation/marketplace-list.ts` + renderer logic
- MSG-GR-4: closed-set reasons enforced by `Reason` literal-union; `composeReasons` enforces `{}` formatting and empty omission
- MSG-GR-5: `<marker>` slot enforced by `MarketplaceRow.marker` literal union (`"autoupdate" | "no autoupdate"`)
- MSG-IC-1..3: icon constants are file-private in `compact-line.ts:62-64`; the icon dispatch fn is the only emission point
- MSG-SD-3: enforced by `PluginInlineUninstalledRow` lacking the predicate fields (`compact-line.ts:114-120`)
- MSG-PL-1..6: enforced by `tests/architecture/catalog-uat.test.ts` byte-equality on the rendered output
- MSG-ER-1: enforced by `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">` (compact-line.ts:200-204)

From tests/lint-rules/index.js (Plan 03 shell):
- Currently empty `RULE_NAMES` + `rules: {}`. This plan populates both with the 16 meta-assertion rules.

From package.json:test glob (Plan 03 extension):
- The `.test.js` files in this plan will run automatically once they exist under `tests/lint-rules/**/*.test.js`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author exactly 16 meta-assertion rule files under tests/lint-rules/</name>
  <files>tests/lint-rules/msg-gr-{1,2,3,4,5}-*.js, tests/lint-rules/msg-ic-{1,2,3}-*.js, tests/lint-rules/msg-sd-3-soft-dep-scope.js, tests/lint-rules/msg-pl-{1,2,3,4,5,6}-*.js, tests/lint-rules/msg-er-1-empty-token.js</files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 2 (verbatim template -- the executor reads this once and applies the same pattern 16 times with different names + citations)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 2 §"Which MSG-* IDs are meta-assertion?" (citation map per rule -- LOCKED 16-entry set; do NOT add or remove any)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 8 (no-op `Program: () => {}` visitor -- REQUIRED to silence the "no visitor selectors" nag)
    - docs/messaging-style-guide.md (browse the relevant §section for each MSG-* ID -- used in the rule's `meta.docs.description` text)
    - extensions/pi-claude-marketplace/presentation/compact-line.ts (load lines 62-260 -- covers the icon constants, the RowSpec union variants, the `renderRow` switch, and `EmptyToken.token: Extract<...>` -- the structural enforcement points each rule cites)
  </read_first>
  <action>
    Create exactly 16 `.js` rule files under `tests/lint-rules/` following the RESEARCH.md Pattern 2 template verbatim:

    **Locked filename set (16 files; do NOT add or omit any):**
    1. msg-gr-1-line-grammar.js
    2. msg-gr-2-marketplace-token.js
    3. msg-gr-3-per-scope.js
    4. msg-gr-4-reasons-block.js
    5. msg-gr-5-marker-slot.js
    6. msg-ic-1-filled-icon.js
    7. msg-ic-2-open-icon.js
    8. msg-ic-3-blocked-icon.js
    9. msg-sd-3-soft-dep-scope.js
    10. msg-pl-1-description.js
    11. msg-pl-2-version-slot.js
    12. msg-pl-3-version-arrow.js
    13. msg-pl-4-upgradable-listonly.js
    14. msg-pl-5-hash-version.js
    15. msg-pl-6-version-non-success.js
    16. msg-er-1-empty-token.js

    The `<descriptive-slug>` after the numeric ID (e.g., `-line-grammar`, `-empty-token`) is fixed per the list above so Plan 06's eslint.config.js wiring can refer to exact slugs; the registry test in Plan 05 uses `name.startsWith("msg-gr-1-")` (slug-prefix matching) so any slug after the numeric ID works structurally, but pin to the listed names for cross-plan consistency.

    Per-file requirements (uniform across all 16 meta-assertion rules):

    1. **Imports**: `import { ESLintUtils } from "@typescript-eslint/utils";`
    2. **createRule factory**: `const createRule = ESLintUtils.RuleCreator((name) => \`https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}\`);` -- anchor URL points to the style guide's section. The registry test does NOT verify the anchor URL, only the rule existence.
    3. **default export**: `createRule({ name: "msg-<family>-<n>-<slug>", meta: { type: "problem", docs: { description: "<MSG-X-N>: <one-sentence summary>. Structurally enforced by <enforcement point>; this rule cites the enforcement and exists for registry parity (D-14-09)." }, messages: { structurallyEnforced: "<MSG-X-N> is structurally enforced; see <citation>." }, schema: [] }, defaultOptions: [], create() { return { Program: () => {} }; } });`
    4. **Top-of-file comment** citing:
       - The MSG-* ID and the style-guide §section.
       - D-14-09 (LOCKED) -- the meta vs. full split decision.
       - The specific structural enforcement mechanism (one short paragraph; copy from RESEARCH.md Pattern 2 §"Which MSG-* IDs are meta-assertion?").
       - That the rule body is intentionally a no-op `Program: () => {}` per Pitfall 8.

    Per-rule citations (`<enforcement point>` in `meta.docs.description`):
    - msg-gr-1-line-grammar: `presentation/compact-line.ts::renderRow` switch + RowSpec discriminated union
    - msg-gr-2-marketplace-token: `PluginCascadeRow` interface lacking `marketplace` field at `compact-line.ts:128-148`
    - msg-gr-3-per-scope: `presentation/marketplace-list.ts` sort + renderer logic
    - msg-gr-4-reasons-block: `Reason` literal-union in `shared/grammar/reasons.ts` + `composeReasons` in `compact-line.ts`
    - msg-gr-5-marker-slot: `MarketplaceRow.marker` literal union (`"autoupdate" | "no autoupdate"`) at `compact-line.ts`
    - msg-ic-1-filled-icon, msg-ic-2-open-icon, msg-ic-3-blocked-icon: file-private icon constants at `compact-line.ts:62-64` + the renderer's icon dispatch fn
    - msg-sd-3-soft-dep-scope: `PluginInlineUninstalledRow` lacking `declaresAgents`/`declaresMcp` fields at `compact-line.ts:114-120`
    - msg-pl-1-description through msg-pl-6-version-non-success: byte-equality from `tests/architecture/catalog-uat.test.ts` (each PL rule cites a slightly different aspect -- description rendering, version slot rendering, etc.; consult docs/messaging-style-guide.md §11 for the per-PL nuance)
    - msg-er-1-empty-token: `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">` at `compact-line.ts:200-204`

    No file should contain a real AST visitor -- all 16 meta-assertion rules return `{ Program: () => {} }`.
    NEVER place fenced code blocks in this action; the read_first artifacts (RESEARCH.md Pattern 2) contain the canonical template.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File count (must be exactly 16; deviation is a planning failure):
      ls tests/lint-rules/msg-gr-*.js tests/lint-rules/msg-ic-*.js tests/lint-rules/msg-sd-3-*.js tests/lint-rules/msg-pl-*.js tests/lint-rules/msg-er-1-*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 16
      # Each contains the no-op Program visitor:
      grep -l 'Program: () => {}' tests/lint-rules/msg-*.js | grep -v '.test.js' | wc -l
      # Expect: 16
      # Each has a messageId 'structurallyEnforced':
      grep -l 'structurallyEnforced' tests/lint-rules/msg-*.js | grep -v '.test.js' | wc -l
      # Expect: 16
      # No overlap with Plan 05 full-impl rule slugs (msg-er-1 stays here, not in Plan 05):
      ls tests/lint-rules/msg-er-1-*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 1
      # ESLint still green (rules not yet registered):
      npm run lint 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    1. Exactly 16 rule files exist under `tests/lint-rules/` matching the locked filename set above.
    2. Each rule's `create()` returns `{ Program: () => {} }` (Pitfall 8 mitigation).
    3. Each rule's `meta.docs.description` cites the structural enforcement point per the citation map above.
    4. `msg-er-1-empty-token.js` exists in THIS plan (Plan 04) and NOT in Plan 05.
    5. `npm run lint` green (rules exist as JS source but are not yet registered).
  </done>
</task>

<task type="auto">
  <name>Task 2: Author exactly 16 RuleTester companion test files</name>
  <files>tests/lint-rules/msg-gr-{1,2,3,4,5}-*.test.js, tests/lint-rules/msg-ic-{1,2,3}-*.test.js, tests/lint-rules/msg-sd-3-soft-dep-scope.test.js, tests/lint-rules/msg-pl-{1,2,3,4,5,6}-*.test.js, tests/lint-rules/msg-er-1-empty-token.test.js</files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 5 (RuleTester template; the 4-line node:test shim is REQUIRED per Pitfall 1)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 1 (RuleTester needs explicit node:test wiring per test file)
    - tests/lint-rules/msg-gr-1-line-grammar.js (Task 1 output -- one rule file the test imports from; verify the import path)
  </read_first>
  <action>
    For each of the 16 rule files created in Task 1, create a sibling `*.test.js` file under `tests/lint-rules/` with the same base name + `.test.js` suffix. Files share the same structure (uniform across all 16 tests):

    1. **Imports**:
       - `import * as test from "node:test";`
       - `import { RuleTester } from "@typescript-eslint/rule-tester";`
       - `import rule from "./<rule-file-name>.js";` (the rule under test)
    2. **node:test shim (REQUIRED per Pitfall 1)** -- exactly 4 lines, placed immediately after imports:
       - `RuleTester.afterAll = test.after;`
       - `RuleTester.describe = test.describe;`
       - `RuleTester.it = test.it;`
       - `RuleTester.itOnly = test.it.only;`
    3. **RuleTester instance + run**: instantiate `const ruleTester = new RuleTester();` then call `ruleTester.run("<rule-name-matching-the-rule-file-export>", rule, { valid: [{ code: "/* meta-assertion smoke: any code is valid because the rule does no AST work. */" }], invalid: [] });`. For some meta-assertion rules where a meaningful smoke case is appropriate (e.g., MSG-GR-1: include a tiny snippet showing a RowSpec usage), the `valid:` case can include something more substantive -- but it MUST be valid (no `invalid:` entries for meta-assertion rules; they can't fail).

    Each test file is independent: importing the rule, running RuleTester, asserting zero failures. The test infrastructure (RuleTester + node:test shim) handles the actual test reporting.

    No `invalid:` cases for meta-assertion rules: the no-op visitor never reports -- there is nothing to fail. The test is a smoke check (rule loads, RuleTester wires correctly under node:test, the `valid` case parses).

    Naming: file `tests/lint-rules/msg-gr-1-line-grammar.test.js` pairs with rule file `tests/lint-rules/msg-gr-1-line-grammar.js`. The first argument to `ruleTester.run(...)` MUST be the same string as the rule's `name` field (from Task 1).

    NEVER place fenced code blocks in this action; the read_first artifact (RESEARCH.md Pattern 5) contains the canonical template.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File count match (every rule has a test; both counts must be 16):
      RULE_COUNT=$(ls tests/lint-rules/msg-*.js 2>/dev/null | grep -v '.test.js' | wc -l)
      TEST_COUNT=$(ls tests/lint-rules/msg-*.test.js 2>/dev/null | wc -l)
      echo "rules: $RULE_COUNT; tests: $TEST_COUNT"
      # Expect: rules: 16; tests: 16
      # Each test has the 4-line node:test shim:
      grep -l 'RuleTester.afterAll = test.after' tests/lint-rules/msg-*.test.js | wc -l
      # Expect: 16
      # All tests run + pass under node --test:
      node --test tests/lint-rules/msg-gr-*.test.js tests/lint-rules/msg-ic-*.test.js tests/lint-rules/msg-sd-3-*.test.js tests/lint-rules/msg-pl-*.test.js tests/lint-rules/msg-er-1-*.test.js 2>&1 | tail -10
      # Expect: pass
    </automated>
  </verify>
  <done>
    1. Companion `*.test.js` count is exactly 16 (1:1 pairing with Task 1's rule files).
    2. Each test file includes the 4-line node:test shim before instantiating RuleTester.
    3. Each test uses `valid:` only (no `invalid:` cases -- meta-assertion rules can't fail).
    4. `node --test tests/lint-rules/msg-*.test.js` (the new files) all pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire the 16 meta-assertion rules into tests/lint-rules/index.js + run full check</name>
  <files>tests/lint-rules/index.js</files>
  <read_first>
    - tests/lint-rules/index.js (current shell from Plan 03 -- empty `RULE_NAMES` and `rules: {}`)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 4 (plugin entry template -- 34 entries expected after BOTH Plan 04 and Plan 05 land)
  </read_first>
  <action>
    Extend `tests/lint-rules/index.js` to import all 16 meta-assertion rule files from Task 1 and register them in BOTH `RULE_NAMES` (frozen ordered array) AND `rules:` (plugin shape dict).

    Pattern (template from RESEARCH.md Pattern 4):
    1. Add 16 named ESM imports at the top, one per rule file. Each import binds a default export.
    2. `RULE_NAMES` becomes `Object.freeze(["msg-gr-1-line-grammar", "msg-gr-2-marketplace-token", "msg-gr-3-per-scope", "msg-gr-4-reasons-block", "msg-gr-5-marker-slot", "msg-ic-1-filled-icon", "msg-ic-2-open-icon", "msg-ic-3-blocked-icon", "msg-sd-3-soft-dep-scope", "msg-pl-1-description", "msg-pl-2-version-slot", "msg-pl-3-version-arrow", "msg-pl-4-upgradable-listonly", "msg-pl-5-hash-version", "msg-pl-6-version-non-success", "msg-er-1-empty-token"])` -- listed in a stable family-then-numeric order. Plan 05 will add its 18 full-impl rules to this same list, reaching 34.
    3. `default.rules` object: each rule's `name` field (which matches the rule-file slug) maps to the imported default. Plan 05 adds 18 more entries.
    4. `meta` block in the default export (`{ name: "eslint-plugin-msg-local", version: "1.0.0" }`) unchanged.

    Do NOT register the rules in `eslint.config.js` yet -- that wiring is Plan 06. The plugin's `rules:` dict is populated here so the registry test in Plan 05 has something to check; the per-rule `files:` patterns in eslint.config.js are added by Plan 06 once all 34 rules exist.

    After the edit, run the full check to confirm zero regressions: `npm run check`.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # RULE_NAMES count must be exactly 16 (the meta-assertion set):
      node -e "import('./tests/lint-rules/index.js').then(m => { console.log('RULE_NAMES count:', m.RULE_NAMES.length); console.log('rules keys count:', Object.keys(m.default.rules).length); console.log('first 3:', m.RULE_NAMES.slice(0, 3)); console.log('last:', m.RULE_NAMES[m.RULE_NAMES.length - 1]); });"
      # Expect: 16; 16; ['msg-gr-1-line-grammar', 'msg-gr-2-marketplace-token', 'msg-gr-3-per-scope']; 'msg-er-1-empty-token'
      # Plan 04 milestone gate:
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS
    </automated>
  </verify>
  <done>
    1. `tests/lint-rules/index.js` imports all 16 meta-assertion rule files at the top.
    2. `RULE_NAMES` (frozen array) lists exactly 16 meta-assertion rule names in stable family-then-numeric order.
    3. `default.rules` dict maps each of the 16 rule names to its imported default export.
    4. `npm run check` is GREEN at the Plan 04 commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Plan 04 adds rule files + test files; no new external-input surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-06 | Tampering | RuleTester companion test shim (node:test wiring) | mitigate | Each test file applies the 4-line shim per RESEARCH.md Pitfall 1. A missing shim shows up as zero test output under node --test -- Task 2 verify catches this via the file-count assertion and the actual test run. |
</threat_model>

<verification>
- Exactly 16 rule files exist; each has a no-op `Program: () => {}` visitor.
- Exactly 16 RuleTester companion `.test.js` files exist; each has the 4-line node:test shim; each has a `valid:` smoke case and zero `invalid:` entries.
- `tests/lint-rules/index.js` `RULE_NAMES.length === 16` and `Object.keys(default.rules).length === 16`.
- `node --test tests/lint-rules/msg-*.test.js` passes for the new files.
- `npm run check` green.
- `msg-er-1-empty-token.js` is in Plan 04 ONLY (not also in Plan 05's files_modified).
</verification>

<success_criteria>
1. 16 of 34 MSG-* drift-guard rules ship as structural meta-assertions per D-14-09 (LOCKED count from RESEARCH.md Pattern 2).
2. Each rule's metadata cites the structural enforcement mechanism -- reviewer can map a registry-parity failure back to the cited mechanism.
3. RuleTester infrastructure wired correctly (Pitfall 1 mitigation in every test file).
4. Plugin shell extends from empty (Plan 03) to 16 rules -- Plan 05 adds 18 more to reach 34.
5. `npm run check` green.
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-04-SUMMARY.md` when done.
</output>
</content>
</invoke>
