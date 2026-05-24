---
phase: 14-drift-guard-test-alignment
plan: 03
type: execute
wave: 3
depends_on:
  - 14-01-cmc-16-closure
  - 14-02-cmc-34-closure
files_modified:
  - package.json
  - eslint.config.js
  - tests/lint-rules/lib/frontmatter.js
  - tests/lint-rules/index.js
  - extensions/pi-claude-marketplace/shared/grammar/markers.ts
  - extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
  - extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/presentation/marketplace-list.ts
  - tests/architecture/grammar-frontmatter.test.ts
autonomous: true
requirements:
  - CMC-38

must_haves:
  truths:
    - "`@typescript-eslint/rule-tester` is installed as a direct devDependency in `package.json`."
    - "`yaml` is a direct devDependency in `package.json` (promoted from transitive)."
    - "`package.json:test` script glob includes `tests/lint-rules/**/*.test.{js,ts}` so RuleTester companions run under `npm test`."
    - "`eslint.config.js` contains an override block for `tests/lint-rules/**/*.{js,ts}` that applies `tseslint.configs.disableTypeChecked` (RESEARCH.md Pitfall 2)."
    - "`tests/lint-rules/lib/frontmatter.js` exists; exports four named arrays `STATUS_TOKENS_FRONTMATTER`, `REASONS_FRONTMATTER`, `MARKERS_FRONTMATTER`, `PATTERN_CLASSES_FRONTMATTER`; uses `yaml.parse()` against the style-guide frontmatter and memoizes via module-scope const."
    - "`tests/lint-rules/index.js` exists; exports a `RULE_NAMES` frozen array (initially empty; Plans 04+05 populate it) and a default export `{ meta, rules: {} }` ESLint-plugin shape."
    - "`shared/grammar/markers.ts` exists; exports `MARKERS = [\"autoupdate\", \"no autoupdate\"] as const` + derived `Marker` type."
    - "`shared/grammar/pattern-classes.ts` exists; exports `PATTERN_CLASSES = [12 entries] as const` matching the frontmatter `pattern_classes:` block byte-equal + derived `PatternClass` type."
    - "`shared/constants/marketplace-label-probe.ts` exists; exports a single canonical `MARKETPLACE_LABEL_PROBE: SoftDepProbe` constant; the 3 historical definitions in add.ts:81, autoupdate.ts:60, presentation/marketplace-list.ts:74 are replaced with imports from the new module."
    - "`tests/architecture/grammar-frontmatter.test.ts` imports the four named exports from `tests/lint-rules/lib/frontmatter.js` and asserts 4-key set-equality against the in-code constants (STATUS_TOKENS, REASONS, MARKERS, PATTERN_CLASSES)."
    - "`npm run check` is green at the Plan 03 commit (no rules registered yet; loader + grammar constants only)."
  artifacts:
    - path: tests/lint-rules/lib/frontmatter.js
      provides: "Memoized YAML frontmatter loader exporting the 4 closed-set arrays"
      contains: "STATUS_TOKENS_FRONTMATTER,REASONS_FRONTMATTER,MARKERS_FRONTMATTER,PATTERN_CLASSES_FRONTMATTER"
    - path: tests/lint-rules/index.js
      provides: "Local ESLint plugin entry exporting RULE_NAMES (empty initially) + default plugin shape"
      contains: "export const RULE_NAMES"
    - path: extensions/pi-claude-marketplace/shared/grammar/markers.ts
      provides: "MARKERS closed-set literal-union (2 entries)"
      contains: 'MARKERS = ['
    - path: extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
      provides: "PATTERN_CLASSES closed-set literal-union (12 entries)"
      contains: 'PATTERN_CLASSES = ['
    - path: extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts
      provides: "Single canonical MARKETPLACE_LABEL_PROBE constant; dedup target for 3 prior definitions"
      contains: "MARKETPLACE_LABEL_PROBE"
  key_links:
    - from: tests/lint-rules/lib/frontmatter.js
      to: docs/messaging-style-guide.md
      via: "readFileSync + yaml.parse on frontmatter block"
      pattern: "yaml.parse"
    - from: tests/architecture/grammar-frontmatter.test.ts
      to: tests/lint-rules/lib/frontmatter.js
      via: "named imports of the 4 frontmatter arrays + set-equality against in-code constants"
      pattern: "STATUS_TOKENS_FRONTMATTER"
    - from: "orchestrators/marketplace/{add,autoupdate}.ts + presentation/marketplace-list.ts"
      to: extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts
      via: "import { MARKETPLACE_LABEL_PROBE } from '<rel>/../shared/constants/marketplace-label-probe.ts'"
      pattern: "MARKETPLACE_LABEL_PROBE"
---

<objective>
Land Wave 3a infrastructure: install the rule-tester devDependency, promote `yaml` to direct devDep, extend the test glob, add the typecheck-disable override for the new tests/lint-rules/ tree, create the shared memoized YAML frontmatter loader, create the local ESLint plugin shell, create two NEW grammar files (`markers.ts` + `pattern-classes.ts`) per Phase 12 D-CMC-01 / D-CMC-02 one-closed-set-per-file precedent (RESEARCH.md Claude's Discretion #3 recommendation), consolidate the 3 duplicate `MARKETPLACE_LABEL_PROBE` definitions into a single module under a NEW `shared/constants/` directory (RESEARCH.md Pitfall 7 recommendation), and migrate `grammar-frontmatter.test.ts` to consume the shared loader + extend from 2-key to 4-key set-equality.

This plan is the FOUNDATION for Plans 04 / 05 / 06: it produces an empty plugin shell, a loader the rules will consume, the new grammar constants the rules will assert parity against, and the extended set-equality test that proves the in-code constants ↔ frontmatter contract for all four closed sets. No rules are added in this plan; the plugin's `rules` object is empty until Plans 04 and 05 populate it.

Purpose: Per Wave 0 in VALIDATION.md (8 items) + RESEARCH.md §Plan Decomposition Plan 3a; required pre-condition for the 34 MSG-* rules + registry test. Per D-14-03 (LOCKED wave structure) + D-14-10 (LOCKED YAML loader strategy) + D-14-10b (DERIVED literal-union extensions) + D-14-05 (LOCKED MARKETPLACE_LABEL_PROBE dedup).
Output: Wave 3a infrastructure lands; existing tests still pass; `npm run check` green.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@.planning/phases/14-drift-guard-test-alignment/14-VALIDATION.md
@docs/messaging-style-guide.md
@package.json
@eslint.config.js
@tests/architecture/grammar-frontmatter.test.ts
@extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
@extensions/pi-claude-marketplace/shared/grammar/reasons.ts
@extensions/pi-claude-marketplace/presentation/marketplace-list.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts:
- `export const STATUS_TOKENS = [...15 entries...] as const;`
- `export type StatusToken = (typeof STATUS_TOKENS)[number];`
- This file is the precedent for the two NEW files in this plan (markers.ts, pattern-classes.ts). Mirror its docstring posture, locking-decision header, and as-const literal-union shape exactly.

From docs/messaging-style-guide.md (verified lines 1-65):
- Frontmatter has 4 keys: `status_tokens:` (15 entries), `reasons:` (28 entries), `markers:` (2 entries: `autoupdate`, `no autoupdate`), `pattern_classes:` (12 entries: success, failure, cascade-row, cascade-summary, list-rendering, reload-hint, soft-dep, manual-recovery, rollback-partial, usage, empty, legacy-migrate)
- The four arrays' byte-equality with these frontmatter entries is the binding contract.

From RESEARCH.md Pattern 3 + the existing `extractFrontmatterList` in grammar-frontmatter.test.ts:
- The loader's regex extracts the frontmatter block: `/^---\n([\s\S]*?)\n---\n/`. The body (capture group 1) is passed to `yaml.parse()`.
- `yaml.parse()` returns an object; each of the 4 keys must be a string-array.
- Memoization: module-scope `let _cache = null;` + lazy-init function. Plain const not used because we want a single readable error message if frontmatter is malformed (the loader throws on bad shape).

From eslint.config.js (existing patterns):
- Flat config (ESM, "type": "module" in package.json).
- `tseslint.configs.disableTypeChecked` is already used at line ~316-319 for the eslint.config.js file itself; apply the same shape for tests/lint-rules/.
- BLOCK C / D-11 zone enforcement (lines 143-260+) -- unchanged by this plan; the new `tests/lint-rules/` tree is OUTSIDE the extension surface and not subject to BLOCK C constraints.

From the 3 historical MARKETPLACE_LABEL_PROBE definitions (verified via grep):
- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:81 -- `const MARKETPLACE_LABEL_PROBE: SoftDepProbe = { ... }`
- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:60 -- identical definition
- extensions/pi-claude-marketplace/presentation/marketplace-list.ts:74 -- identical definition
- Type: `SoftDepProbe` from `presentation/compact-line.ts` (already imported in these 3 files; no new dependency)
- Read marketplace-list.ts:74-77 (the most-detailed comment of the three) to copy the rationale into the new module's docstring.

From package.json:74:
- Current test script: `"test": "node --test \"tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}/**/*.test.ts\""`
- Per RESEARCH.md Validation Architecture: brace expansion already used; ADD `lint-rules` to the brace expansion AND extend the file-extension brace to `{js,ts}` for the lint-rules subtree. Two possible shapes:
  (a) Single glob: `"test": "node --test \"tests/{architecture,bridges,domain,edge,helpers,lint-rules,orchestrators,persistence,presentation,shared,transaction}/**/*.test.{js,ts}\""` -- clean.
  (b) Two globs: `"test": "node --test \"tests/{architecture,...,transaction}/**/*.test.ts\" \"tests/lint-rules/**/*.test.{js,ts}\""` -- explicit separation.
  Per RESEARCH.md Wave 0 note "may need two globs", lean toward (b) if shape (a) causes node:test brace-expansion gotchas under the project's npm version. Verify with `node --test --help` and a one-off invocation if uncertain.

From eslint.config.js (the typecheck-disable override pattern):
- The existing block at lines ~316-319 looks like: `{ files: ["eslint.config.js"], ...tseslint.configs.disableTypeChecked, },`
- The new block for tests/lint-rules: `{ files: ["tests/lint-rules/**/*.{js,ts}"], ...tseslint.configs.disableTypeChecked, },`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: package.json + eslint.config.js infrastructure landing</name>
  <files>package.json, eslint.config.js</files>
  <read_first>
    - package.json (focus lines 14-30 devDependencies; line 74 test script; line 84 type: module)
    - eslint.config.js (find the existing `tseslint.configs.disableTypeChecked` block -- likely near the end of the file; this plan adds a sibling block for tests/lint-rules/)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md "Standard Stack" section (verified yaml@2.8.3 transitive; @typescript-eslint/rule-tester NOT installed)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 2 (parserOptions.projectService + tests/lint-rules/ subtree)
  </read_first>
  <action>
    Three landings in this task:

    1. **devDep additions** -- run `npm install -D @typescript-eslint/rule-tester yaml` to add both packages. Pin to the major-line versions verified in RESEARCH.md: `@typescript-eslint/rule-tester@^8.59.1` (lockstep with the already-installed `typescript-eslint@^8.59.1`) and `yaml@^2.8.3` (current transitive version on disk). After install, `package.json` `devDependencies` includes both packages; `package-lock.json` updates as a side effect.

    2. **test script glob extension** -- edit `package.json:74` to include `tests/lint-rules/**/*.test.{js,ts}` in the node:test glob. Preferred shape per RESEARCH.md (two globs for clarity):
       ```
       "test": "node --test \"tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}/**/*.test.ts\" \"tests/lint-rules/**/*.test.{js,ts}\""
       ```
       (Confirm shape works under the project's Node version by running `npm test` after Plan 04/05 lands a `.test.js` file; for THIS plan, no test files under `tests/lint-rules/` exist yet, so the glob harmlessly matches zero files.)

    3. **eslint.config.js typecheck-disable override block** -- add an override for `tests/lint-rules/**/*.{js,ts}` that applies `tseslint.configs.disableTypeChecked`. Place this block AFTER the existing `eslint.config.js` self-override (so flat-config ordering is consistent) and BEFORE any per-file overrides further down. Block shape mirrors the existing self-override:
       ```
       {
         files: ["tests/lint-rules/**/*.{js,ts}"],
         ...tseslint.configs.disableTypeChecked,
       },
       ```
       This prevents `parserOptions.projectService: true` (from the main config block at ~line 32-40) from refusing the new tree because it's not in `tsconfig.json`'s include glob (RESEARCH.md Pitfall 2).

    Verify after all three edits:
    - `npm install -D` completes; `package.json` devDeps reflect both new packages.
    - `npm run typecheck` is still green (no source change in extension code).
    - `npm run lint` is still green (eslint.config.js change adds a NEW block; the override only affects files under `tests/lint-rules/` which is empty at this point).
    - `npm run test` is still green (the new glob matches zero files at this point).

    Commit this task as a single commit (Conventional Commits per CLAUDE.md): `feat(14-03): add rule-tester + yaml devDeps; extend test glob; add tests/lint-rules typecheck override`.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # devDep presence:
      node -e "const p=require('./package.json'); console.log('rule-tester:', p.devDependencies['@typescript-eslint/rule-tester']); console.log('yaml:', p.devDependencies['yaml']);"
      # Both should print version strings (not undefined).
      # Test glob extension:
      grep '"test":' package.json | grep -c 'tests/lint-rules'
      # Expect: 1
      # ESLint override:
      grep -A2 'tests/lint-rules/\*\*' eslint.config.js | grep -c 'disableTypeChecked'
      # Expect: 1
      # Full check after install (sanity):
      npm run typecheck 2>&1 | tail -3
      npm run lint 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    1. `package.json` devDependencies include `@typescript-eslint/rule-tester` and `yaml` as direct entries with `^8.x` and `^2.x` ranges respectively.
    2. `package.json:test` script glob includes `tests/lint-rules/**/*.test.{js,ts}` (in addition to the existing tests/{...}/**/*.test.ts glob).
    3. `eslint.config.js` contains an override block matching `files: ["tests/lint-rules/**/*.{js,ts}"]` with `tseslint.configs.disableTypeChecked` spread.
    4. `npm run typecheck`, `npm run lint`, `npm run test` all green (no rule files exist yet; harmless).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create tests/lint-rules/lib/frontmatter.js loader + tests/lint-rules/index.js plugin shell</name>
  <files>tests/lint-rules/lib/frontmatter.js, tests/lint-rules/index.js</files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 3 (Memoized YAML frontmatter loader -- the full code template is in the research file)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 4 (Plugin entry -- `tests/lint-rules/index.js` template)
    - docs/messaging-style-guide.md lines 1-65 (the frontmatter the loader will parse)
    - tests/architecture/grammar-frontmatter.test.ts (Phase 12 extractor pattern -- for comparison; this loader supersedes the regex extractor)
  </read_first>
  <action>
    Create two NEW files following the RESEARCH.md Pattern 3 and Pattern 4 templates verbatim, with the following identifiers:

    **`tests/lint-rules/lib/frontmatter.js`** (Pattern 3):
    - ESM module (`import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { parse } from "yaml";`).
    - Module-scope `const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")` -- confirms 3 levels up from `tests/lint-rules/lib/` lands at the repo root.
    - Module-scope `const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");`.
    - Module-scope `let _cache = null;` + `function loadFrontmatter() { ... }` per Pattern 3 verbatim.
    - The loader extracts the frontmatter block via `/^---\n([\s\S]*?)\n---\n/` regex, then `parse(m[1])` from the `yaml` package, then validates each of the 4 keys is a `string[]` (helper `requireList(key)` per Pattern 3), then freezes the result.
    - Four named exports (top-level `const` declarations that call `loadFrontmatter()` once at module load):
      ```
      export const STATUS_TOKENS_FRONTMATTER = loadFrontmatter().STATUS_TOKENS_FRONTMATTER;
      export const REASONS_FRONTMATTER = loadFrontmatter().REASONS_FRONTMATTER;
      export const MARKERS_FRONTMATTER = loadFrontmatter().MARKERS_FRONTMATTER;
      export const PATTERN_CLASSES_FRONTMATTER = loadFrontmatter().PATTERN_CLASSES_FRONTMATTER;
      ```
    - Also export the `loadFrontmatter` function itself for direct test consumption (grammar-frontmatter.test.ts uses this).
    - Top-of-file JSDoc comment block citing D-14-10 + Phase 12 D-CMC-04 deferral context (loader was deferred from Phase 12 to here).

    **`tests/lint-rules/index.js`** (Pattern 4 -- initial shape with empty rules):
    - ESM module.
    - At the top: a block comment noting "Plans 04 + 05 populate `RULE_NAMES` and `rules`."
    - For this plan, BOTH `RULE_NAMES` and `rules` are empty:
      ```
      export const RULE_NAMES = Object.freeze([]);

      export default {
        meta: {
          name: "eslint-plugin-msg-local",
          version: "1.0.0",
        },
        rules: {},
      };
      ```
    - Plan 04 and Plan 05 will add imports + populate both `RULE_NAMES` and `rules`. This plan ships the shell only.

    Do NOT register the plugin in `eslint.config.js` yet -- Plan 06 wires the per-rule `files:` patterns once the rules exist. Adding a `plugins: { msg: msgPlugin }` block now with an empty `rules` object would be a no-op but would also fail any rule lookup the registry test does in Plan 05.

    The frontmatter loader's `readFileSync` synchronous initialization (per Pattern 3) means the module throws at import time if the style guide's frontmatter is malformed. That is the intended fail-fast behavior: any rule file importing the loader will fail-fast if the contract drifts.

    NEVER place fenced code blocks in this action; the read_first artifacts contain the full template.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File presence:
      ls -la tests/lint-rules/lib/frontmatter.js tests/lint-rules/index.js
      # Loader smoke test:
      node -e "import('./tests/lint-rules/lib/frontmatter.js').then(m => { console.log('STATUS_TOKENS_FRONTMATTER count:', m.STATUS_TOKENS_FRONTMATTER.length); console.log('REASONS_FRONTMATTER count:', m.REASONS_FRONTMATTER.length); console.log('MARKERS_FRONTMATTER count:', m.MARKERS_FRONTMATTER.length); console.log('PATTERN_CLASSES_FRONTMATTER count:', m.PATTERN_CLASSES_FRONTMATTER.length); });"
      # Expect: 15, 28, 2, 12 respectively (matching the frontmatter)
      # Plugin shell smoke test:
      node -e "import('./tests/lint-rules/index.js').then(m => { console.log('RULE_NAMES:', m.RULE_NAMES.length); console.log('rules keys:', Object.keys(m.default.rules).length); });"
      # Expect: 0, 0 (empty initially)
      # ESLint still green (the new override block from Task 1 covers tests/lint-rules/):
      npm run lint 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    1. `tests/lint-rules/lib/frontmatter.js` exists; ESM module; uses `yaml.parse()`; exports 4 named arrays + a `loadFrontmatter` function.
    2. Smoke test shows STATUS_TOKENS_FRONTMATTER=15, REASONS_FRONTMATTER=28, MARKERS_FRONTMATTER=2, PATTERN_CLASSES_FRONTMATTER=12.
    3. `tests/lint-rules/index.js` exists; ESM module; exports `RULE_NAMES = Object.freeze([])` and a default `{ meta, rules: {} }` plugin shape.
    4. `npm run lint` and `npm run typecheck` still green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create shared/grammar/markers.ts + shared/grammar/pattern-classes.ts</name>
  <files>
    extensions/pi-claude-marketplace/shared/grammar/markers.ts,
    extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
  </files>
  <read_first>
    - extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts (the precedent -- copy its docstring posture, locking-decision header, and `as const` shape verbatim with appropriate identifier substitution)
    - extensions/pi-claude-marketplace/shared/grammar/reasons.ts (the second precedent -- confirm the same posture)
    - docs/messaging-style-guide.md lines 48-65 (the `markers:` and `pattern_classes:` blocks -- byte-equal source for both new files' entries)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md "Code Examples" section (`markers.ts` and `pattern-classes.ts` templates)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-10b (DERIVED -- extension of literal-union types)
  </read_first>
  <action>
    Create two NEW files under `extensions/pi-claude-marketplace/shared/grammar/` per RESEARCH.md "Code Examples" section + Claude's Discretion #3 recommendation (two new files, not additions to existing files):

    **`extensions/pi-claude-marketplace/shared/grammar/markers.ts`** (2 entries):
    ```
    export const MARKERS = ["autoupdate", "no autoupdate"] as const;
    export type Marker = (typeof MARKERS)[number];
    ```
    - Top docstring cites: D-14-10b (DERIVED), Phase 12 D-CMC-01 / D-CMC-02 / D-CMC-08 precedent (one-closed-set-per-file under shared/grammar/), CMC-38 binding contract, the byte-equal source in `docs/messaging-style-guide.md` lines 48-50, and the assertion that `tests/architecture/grammar-frontmatter.test.ts` (extended in Task 4 of this plan) asserts set-equality every CI run.
    - Locking decisions section mirrors status-tokens.ts's structure -- list D-CMC-01, D-CMC-02, D-CMC-03, D-14-10b as applicable.

    **`extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts`** (12 entries -- byte-equal to frontmatter `pattern_classes:` block):
    ```
    export const PATTERN_CLASSES = [
      "success",
      "failure",
      "cascade-row",
      "cascade-summary",
      "list-rendering",
      "reload-hint",
      "soft-dep",
      "manual-recovery",
      "rollback-partial",
      "usage",
      "empty",
      "legacy-migrate",
    ] as const;
    export type PatternClass = (typeof PATTERN_CLASSES)[number];
    ```
    - Top docstring same posture as markers.ts; cites D-14-10b + Phase 12 D-CMC-01 precedents + the byte-equal source `docs/messaging-style-guide.md` lines 51-64.

    Both files compile under `tsc --noEmit`. Neither file is imported by anything in this plan; downstream consumers may emerge in Plan 06 or later (e.g., if a rule needs the typed Marker / PatternClass for AST signatures). For now, the parity test in Task 4 below imports both via the grammar-frontmatter.test.ts route.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File presence:
      ls -la extensions/pi-claude-marketplace/shared/grammar/markers.ts extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
      # Content count verification:
      grep -c '^  "' extensions/pi-claude-marketplace/shared/grammar/markers.ts
      # Expect: 2
      grep -c '^  "' extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
      # Expect: 12
      # Type compilation:
      npm run typecheck 2>&1 | tail -3
      # Expect: success
    </automated>
  </verify>
  <done>
    1. `extensions/pi-claude-marketplace/shared/grammar/markers.ts` exists; exports `MARKERS` (2 entries: "autoupdate", "no autoupdate") + derived `Marker` type.
    2. `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` exists; exports `PATTERN_CLASSES` (12 entries matching frontmatter pattern_classes:) + derived `PatternClass` type.
    3. Both files compile (`npm run typecheck` green).
    4. Docstring on each file cites D-14-10b + Phase 12 D-CMC-* precedent + binding-contract assertion.
  </done>
</task>

<task type="auto">
  <name>Task 4: Migrate grammar-frontmatter.test.ts to shared loader + extend from 2-key to 4-key</name>
  <files>tests/architecture/grammar-frontmatter.test.ts</files>
  <read_first>
    - tests/architecture/grammar-frontmatter.test.ts (current state -- uses local `extractFrontmatterList` regex; pins 2 keys)
    - tests/lint-rules/lib/frontmatter.js (created in Task 2 of this plan -- the loader that supersedes the local extractor)
    - extensions/pi-claude-marketplace/shared/grammar/markers.ts (created in Task 3)
    - extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts (created in Task 3)
    - extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts (existing)
    - extensions/pi-claude-marketplace/shared/grammar/reasons.ts (existing)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-10 (LOCKED loader strategy)
  </read_first>
  <action>
    Migrate `tests/architecture/grammar-frontmatter.test.ts` per D-14-10:

    1. Delete the local `extractFrontmatterList` function (lines 38-62 of the existing file) -- superseded by `tests/lint-rules/lib/frontmatter.js`.
    2. Replace `extractFrontmatterList` consumers (the two existing test calls at lines 66 and 77) with imports of the 4 named exports + the `loadFrontmatter` function from `tests/lint-rules/lib/frontmatter.js`.
    3. Extend the test from 2 keys to 4 keys: add set-equality tests for `MARKERS` ↔ `MARKERS_FRONTMATTER` and `PATTERN_CLASSES` ↔ `PATTERN_CLASSES_FRONTMATTER`.
    4. Migrate the two error-path tests (lines 87-98 -- `extractFrontmatterList throws if frontmatter is missing` / `extractFrontmatterList throws if key is missing`) to assert the loader's `loadFrontmatter()` throws. Since `loadFrontmatter()` reads from `docs/messaging-style-guide.md` at module load time and can't be re-invoked with bad input, EITHER (a) export an internal `parseStyleGuideFrontmatter(md: string)` helper from the loader (parametrized over the markdown content) and assert that helper throws on bad shapes, OR (b) drop the negative tests entirely if all error paths are covered by the happy-path assertions failing fast at module load. Option (a) is preferred -- refactor the loader (back in Task 2 if you discover this) to expose a parametrized parse helper.

    Final test structure:
    - 4 set-equality tests (one per closed set):
      - `"D-14-10 / CMC-38: STATUS_TOKENS is set-equal to style-guide frontmatter status_tokens"`
      - `"D-14-10 / CMC-38: REASONS is set-equal to style-guide frontmatter reasons"`
      - `"D-14-10b / CMC-38: MARKERS is set-equal to style-guide frontmatter markers"`
      - `"D-14-10b / CMC-38: PATTERN_CLASSES is set-equal to style-guide frontmatter pattern_classes"`
    - 2 negative tests (if helper extraction completed): `parseStyleGuideFrontmatter throws if frontmatter is missing` / `... throws if key is missing or not string[]`.
    - Test rename strategy: keep the existing D-CMC-04 attribution comments for the two status_tokens/reasons tests, ADD D-14-10 / CMC-38 attribution; new markers + pattern_classes tests use D-14-10b / CMC-38 attribution.

    Note: at this point in time (Plan 03 commit), the grammar-frontmatter test now also depends on the new markers.ts + pattern-classes.ts existing -- the Task 3 files. If you order tasks Task 3 BEFORE Task 4 inside this plan (recommended), the test passes immediately on commit. Order is enforced by sequencing inside the plan; no `depends_on:` across tasks needed.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # Removed local extractor:
      grep -c 'function extractFrontmatterList' tests/architecture/grammar-frontmatter.test.ts
      # Expect: 0
      # New imports:
      grep -c 'from "../../tests/lint-rules/lib/frontmatter' tests/architecture/grammar-frontmatter.test.ts
      # Expect: ≥1
      # 4-key coverage:
      grep -cE 'STATUS_TOKENS|REASONS|MARKERS|PATTERN_CLASSES' tests/architecture/grammar-frontmatter.test.ts
      # Expect: ≥4 (one per closed set; usually more if tests reference both code-side and frontmatter-side names)
      # Test passes:
      node --test tests/architecture/grammar-frontmatter.test.ts 2>&1 | tail -10
      # Wave-3a sanity gate:
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS (NFR-6 milestone)
    </automated>
  </verify>
  <done>
    1. `tests/architecture/grammar-frontmatter.test.ts` no longer contains a local `extractFrontmatterList` function; instead imports the 4 named arrays + `loadFrontmatter` (or `parseStyleGuideFrontmatter`) from `tests/lint-rules/lib/frontmatter.js`.
    2. 4 set-equality tests exist (one per closed set: STATUS_TOKENS, REASONS, MARKERS, PATTERN_CLASSES) and all pass.
    3. The 2 negative tests (loader throws on bad shape) are preserved if a parametrized helper is exposed; otherwise dropped with rationale.
    4. `node --test tests/architecture/grammar-frontmatter.test.ts` passes.
    5. `npm run check` is green (Wave 3a gate).
  </done>
</task>

<task type="auto">
  <name>Task 5: Dedup MARKETPLACE_LABEL_PROBE into shared/constants/ + update 3 call sites</name>
  <files>
    extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts,
    extensions/pi-claude-marketplace/presentation/marketplace-list.ts
  </files>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts (focus line 81 + line 171 usage)
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts (focus line 60 + lines 175, 190 usages)
    - extensions/pi-claude-marketplace/presentation/marketplace-list.ts (focus line 74 + lines 92, 106 usages -- this file has the most-detailed comment; use it for the new module's docstring)
    - extensions/pi-claude-marketplace/presentation/compact-line.ts (focus on the `SoftDepProbe` type the constant satisfies; verify the import path used by all 3 files)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 7 (MARKETPLACE_LABEL_PROBE location -- grammar/ vs constants/)
    - eslint.config.js BLOCK C / D-11 layering (verify that `shared/constants/` sits BELOW `presentation/` and `orchestrators/` -- i.e., importable from both without violating BLOCK C)
  </read_first>
  <action>
    Implements D-14-05 (LOCKED dedup) per RESEARCH.md Pitfall 7 recommendation: place the canonical constant in a NEW `extensions/pi-claude-marketplace/shared/constants/` directory (NOT shared/grammar/, since `MARKETPLACE_LABEL_PROBE` is a `SoftDepProbe` sentinel value, not a closed-set token).

    1. **Create `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts`** containing:
       - Import `SoftDepProbe` from `../../presentation/compact-line.ts` (verify the relative path resolves; compact-line.ts exports the type per Read).
       - One named export: `export const MARKETPLACE_LABEL_PROBE: SoftDepProbe = { ... };` -- copy the exact object literal from `presentation/marketplace-list.ts:74-77` (the most-commented of the 3 definitions). Confirm the three existing literals are byte-equal before deduplication (grep finds all 3 with `MARKETPLACE_LABEL_PROBE: SoftDepProbe = {`).
       - Top JSDoc: cites D-14-05 (LOCKED), RESEARCH.md Pitfall 7 rationale (sentinel object not closed-set token; lives in constants/ not grammar/), the 3 historical definitions it replaces (add.ts:81, autoupdate.ts:60, marketplace-list.ts:74), and the BLOCK C layering note (constants/ sits below presentation/orchestrators).

    2. **Layering verification (BLOCKING precondition)**: `shared/constants/` must be importable from BOTH `presentation/` AND `orchestrators/`. Check `eslint.config.js` BLOCK C -- `shared/` is currently the "everything-can-import-from-it" leaf (per BLOCK C zones lines 158, 174, 186 etc. -- `shared/` is the universal allowed-target). The new `shared/constants/` subdirectory inherits that posture. If BLOCK C uses a tighter pattern (e.g., `shared/{grammar,errors,...}/` enumerated explicitly), the new `constants/` subdirectory may need to be added to allowlists. Verify by reading BLOCK C carefully BEFORE moving the file.

    3. **Update 3 call sites** to import from the new module instead of defining locally:
       - `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`: delete the local `const MARKETPLACE_LABEL_PROBE: SoftDepProbe = {...}` at line 81; add `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";` at the import block top. Verify the SoftDepProbe import (if previously only used by the local literal) is still needed by other code in the file; if not, drop it.
       - `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`: same shape -- delete local const at line 60, add import.
       - `extensions/pi-claude-marketplace/presentation/marketplace-list.ts`: same shape -- delete local const at line 74, add `import { MARKETPLACE_LABEL_PROBE } from "../shared/constants/marketplace-label-probe.ts";` (note the relative-path depth -- presentation/ is at the same depth as shared/, so single `..`).

    4. **Verify** post-edit:
       - `grep -c 'const MARKETPLACE_LABEL_PROBE' extensions/pi-claude-marketplace/` returns exactly 1 (only the new module).
       - `grep -rln 'MARKETPLACE_LABEL_PROBE' extensions/pi-claude-marketplace/` returns the 4 files (new module + 3 call sites) -- all consuming sites use the imported constant.
       - `npm run check` green.

    Note: This dedup does NOT change any user-visible behavior; the 3 historical definitions were byte-equal. The drift-guard rule MSG-CC-1 (or analog) in Plan 05 can detect re-introductions of `MARKETPLACE_LABEL_PROBE` definitions outside the canonical module -- but that rule is OPTIONAL per CONTEXT.md ("no-dup grep equivalent -- one rule covering this would be excessive -- leave as code review concern after dedup"). For this plan, the dedup alone satisfies D-14-05.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # New module exists:
      ls -la extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts
      # Exactly 1 definition (the new one):
      grep -rc 'const MARKETPLACE_LABEL_PROBE' extensions/pi-claude-marketplace/ | grep -v ':0$' | sort
      # Expect: 1 line, ending ":1", pointing to the new constants/marketplace-label-probe.ts file
      # 3 call sites all import:
      grep -rln 'MARKETPLACE_LABEL_PROBE' extensions/pi-claude-marketplace/
      # Expect 4 files: the new module + add.ts + autoupdate.ts + marketplace-list.ts
      grep -c 'import.*MARKETPLACE_LABEL_PROBE.*from.*shared/constants' extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
      # Expect: 1
      grep -c 'import.*MARKETPLACE_LABEL_PROBE.*from.*shared/constants' extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
      # Expect: 1
      grep -c 'import.*MARKETPLACE_LABEL_PROBE.*from.*shared/constants' extensions/pi-claude-marketplace/presentation/marketplace-list.ts
      # Expect: 1
      # Full milestone gate:
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS
    </automated>
  </verify>
  <done>
    1. `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` exists with the canonical `MARKETPLACE_LABEL_PROBE: SoftDepProbe` constant.
    2. `add.ts`, `autoupdate.ts`, and `marketplace-list.ts` no longer contain a local `const MARKETPLACE_LABEL_PROBE = ...` definition; all 3 import from the new module.
    3. `grep -rc 'const MARKETPLACE_LABEL_PROBE' extensions/pi-claude-marketplace/` reports exactly 1 definition (the canonical one in shared/constants/).
    4. `npm run check` is GREEN -- Plan 03 Wave 3a milestone gate.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| YAML loader → in-process state | The `yaml.parse()` call reads `docs/messaging-style-guide.md`, which is a committed-in-repo file. Input is trusted; no untrusted-YAML attack surface introduced. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-05 | Tampering | tests/lint-rules/lib/frontmatter.js readFileSync at module-load time | accept | Input is `docs/messaging-style-guide.md`, a committed repo file. The loader fails fast (throws at import) on malformed input -- this IS the drift-guard's "fail closed" property. |
| T-14-SC | Tampering | npm install of @typescript-eslint/rule-tester + yaml direct devDep | mitigate | Both packages verified in RESEARCH.md Package Legitimacy Audit: rule-tester is the sibling of an already-installed package (typescript-eslint@^8.59.1, same monorepo); yaml@2.8.3 is already on disk as transitive. slopcheck not invoked because both are approved per the audit table. |
</threat_model>

<verification>
- `npm install -D @typescript-eslint/rule-tester yaml` succeeds; `package.json` devDeps reflect both.
- `package.json:test` glob extension matches `tests/lint-rules/**/*.test.{js,ts}`.
- `eslint.config.js` typecheck-disable override for `tests/lint-rules/**/*.{js,ts}` is in place.
- `tests/lint-rules/lib/frontmatter.js` parses the frontmatter and exports 4 named arrays (15, 28, 2, 12 entries respectively).
- `tests/lint-rules/index.js` is the plugin shell (empty `rules`, empty `RULE_NAMES`).
- `shared/grammar/markers.ts` and `shared/grammar/pattern-classes.ts` exist with as-const literal-union shape (2 + 12 entries).
- `shared/constants/marketplace-label-probe.ts` is the canonical home of `MARKETPLACE_LABEL_PROBE`; the 3 historical definitions are gone.
- `tests/architecture/grammar-frontmatter.test.ts` extended to 4-key set-equality via the shared loader.
- `npm run check` is green at the Plan 03 commit.
</verification>

<success_criteria>
1. Wave 0 / Wave 3a infrastructure landed: 8 items from VALIDATION.md complete.
2. Foundation ready for Plans 04 (meta-assertion rules) + 05 (full-impl rules + registry).
3. `MARKETPLACE_LABEL_PROBE` WARNING-level audit finding closed (D-14-05).
4. Phase 12 D-CMC-04 deferral satisfied (D-14-10 richer YAML loader exists).
5. `npm run check` green throughout.
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-03-SUMMARY.md` when done.
</output>
