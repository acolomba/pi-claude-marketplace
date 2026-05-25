# Phase 14: Drift Guard & Test Alignment - Research

**Researched:** 2026-05-24
**Domain:** ESLint custom rules under flat config (ESM); typescript-eslint AST; YAML frontmatter parsing; multi-tier rule decomposition; targeted refactors in orchestrators/edge layers
**Confidence:** HIGH on the locked decisions; HIGH on the HOW; MEDIUM only on plan decomposition (planner discretion per D-14-03)

## Summary

Phase 14 is the v1.3 milestone-close commit. CONTEXT.md has locked D-14-01..D-14-12 -- the WHAT and WHERE are settled. This research answers HOW: which APIs, which AST visitor patterns, which file layouts, and what surprises to expect.

Three findings drive the plan-shape:

1. **`@typescript-eslint/rule-tester` is NOT installed** (only `@typescript-eslint/utils` is). The plan MUST add it as a `devDependency` alongside the `yaml` package promotion. This is a single dep-install step but it must land in Wave 3 plan #1 (infrastructure) before any rule test file runs.

2. **The `yaml` package is internally CommonJS** (`"type": "commonjs"` in its package.json) but ships a proper `exports.` map with `"types": "./dist/index.d.ts"` and `"node": "./dist/index.js"`. ESM consumers `import { parse } from "yaml"` resolves correctly under Node ≥22 interop. No `createRequire` workaround needed. `[VERIFIED: node_modules/yaml/package.json]`

3. **D-14-04's transaction/rollback.ts refactor path needs revisiting.** D-14-04 offered "accepting a partial-context renderer variant" -- having `transaction/rollback.ts` call a presentation/ helper. BUT `eslint.config.js:194-202` BLOCK C zone explicitly forbids `transaction/` from importing `presentation/`. So option (b) violates layering. The recommended path (this research): MOVE rendering OUT of `transaction/rollback.ts` and INTO calling orchestrators. The transaction layer keeps producing structured `RunPhasesResult` data; orchestrators that catch the error call `presentation/rollback-partial.ts` themselves. This honors D-11, satisfies CMC-38 structurally, and the MSG-RP-1 ESLint rule then catches any re-introduction of hand-composed literals.

**Primary recommendation:** Adopt the typescript-eslint v8 + ESLint v10 canonical plugin pattern (`ESLintUtils.RuleCreator` + flat-config `plugins: { msg: { rules: { ... } } }` + per-rule `files:` blocks). Use `@typescript-eslint/rule-tester` with the `node:test` adapter shim (RuleTester static-property assignment in a per-test-file preamble, NOT a `--import` flag -- the project's existing test glob doesn't use `--import` and adding one would complicate the package.json scripts). Land the YAML loader as a `.js` file (not `.ts`) under `tests/lint-rules/lib/frontmatter.js` to dodge the `parserOptions.projectService` typecheck overhead on what is fundamentally test infrastructure code. Keep all 34 rule files as `.js` for the same reason -- they're consumed by ESLint, not by the TypeScript compiler.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MSG-* rule definitions (AST visitors) | tests/lint-rules/ (NEW) | -- | Test infrastructure; not shipped in `extensions/pi-claude-marketplace/**`. Lives under `tests/` per the established no-legacy-markers and catalog-uat precedent |
| Frontmatter loader (memoized YAML reader) | tests/lint-rules/lib/ | -- | Test-only dependency on `yaml` package; never imported from extension code |
| ESLint plugin registration | eslint.config.js (root) | -- | Flat-config is the single entry point; per-rule `files:` patterns live here |
| Per-rule RuleTester companion tests | tests/lint-rules/ (NEW, co-located) | -- | D-14-11 locks co-location with the rule files |
| Registry parity test | tests/architecture/ | -- | Joins existing `grammar-frontmatter.test.ts`, `no-legacy-markers.test.ts`, `catalog-uat.test.ts` family |
| Closed-set literal-union types (markers, pattern_classes) | extensions/pi-claude-marketplace/shared/grammar/ | -- | Phase 12 D-CMC-01 / D-CMC-08 precedent: one closed-set-per-file in `shared/grammar/` |
| ManualRecoveryLine emission (CMC-16) | orchestrators/plugin/reinstall.ts | presentation/manual-recovery.ts | Orchestrator owns context (plugin id, scope, recovery instructions); presentation renders |
| notifyUsageError migration (CMC-34) | edge/handlers/{plugin,marketplace}/*.ts | shared/notify.ts | Edge handlers are the argument-validation surface; notify wrapper exists in shared/ |
| transaction/rollback.ts refactor (WARNING) | orchestrators that catch the rollback error | presentation/rollback-partial.ts | Layer-clean: transaction continues to produce data; orchestrators render |
| MARKETPLACE_LABEL_PROBE dedup (WARNING) | extensions/pi-claude-marketplace/shared/constants/ (NEW dir) | -- | Treated as a sentinel object, not a closed-set token; `shared/grammar/` is for the latter |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@typescript-eslint/utils` | `^8.59.1` (already in tree via `typescript-eslint@^8.59.1`) | `ESLintUtils.RuleCreator` for typed rule definitions; AST type imports | The canonical 2026 way to write TS-aware ESLint rules; provides `MessageIds` type-inference from `meta.messages`. `[CITED: https://typescript-eslint.io/developers/custom-rules/]` |
| `@typescript-eslint/rule-tester` | `^8.59.1` (NOT YET INSTALLED) | RuleTester API for per-rule planted-violation tests | Replaces ESLint's built-in `RuleTester` with one that understands the typescript-eslint parser. Sets up `valid:` and `invalid:` fixture arrays per rule. `[CITED: https://typescript-eslint.io/packages/rule-tester/]` |
| `yaml` | `^2.8.3` (transitive today; promote to direct devDep) | `parse()` of frontmatter body | Industry standard; supports YAML 1.2; `[VERIFIED: node_modules/yaml/package.json reports v2.8.3]` |
| `eslint` | `^10.2.1` (already in tree) | Flat-config plugin loader, AST traversal, rule execution | Already wired for `npm run lint`; no new config flag needed for local plugins |
| `typescript-eslint` | `^8.59.1` (already in tree) | Parser, project-service, strict-type-checked rules | Provides the parser the custom rules' AST visitors depend on |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | bundled with Node ≥22 | Run RuleTester `.test.js` files via the existing `npm test` glob | All Phase 14 tests; the project baseline at v22.22.2 supports native TS strip but `tests/lint-rules/` files are `.js` so this matters for the `tests/architecture/msg-rule-registry.test.ts` (TS) only |
| `node:assert/strict` | bundled | Registry-parity assertions | Matches existing `tests/architecture/*.test.ts` style |
| `node:fs/promises` | bundled | Reading style-guide markdown body | Already used by `grammar-frontmatter.test.ts` |
| `node:path` + `node:url::fileURLToPath` | bundled | Repo-root resolution from ESM modules | Already used by `grammar-frontmatter.test.ts` and `no-legacy-markers.test.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@typescript-eslint/rule-tester` | ESLint's built-in `RuleTester` from `eslint` package | Built-in works but requires manual parser configuration on every test file; the `@typescript-eslint/rule-tester` variant pre-wires the parser and gives better error messages for typed rules. Cost is +1 devDep (~50KB). RECOMMEND: install the typescript-eslint variant |
| `yaml@^2.8.3` | `js-yaml@^4.x`; `gray-matter` (frontmatter-specific) | js-yaml is older API style; gray-matter pulls in additional deps for templating not needed here. `yaml` is already in tree as transitive |
| `.js` rule files | `.ts` rule files (native TS strip on Node 22.18+) | TS would give type-checking on the AST handlers, but would also force the rule files through the project's strict typecheck. The `.js` choice keeps test infrastructure out of `tsconfig` coverage. The Discretion item in CONTEXT.md leaves this to the planner -- RECOMMEND `.js` for friction-reduction |
| Single registry test | Per-rule registration assertions | Single test is simpler; per-rule would scale poorly past 34. RECOMMEND single test |

**Installation:**
```
npm install --save-dev @typescript-eslint/rule-tester yaml
```

**Version verification (2026-05-24):**

- `node_modules/yaml/package.json` reports `"version": "2.8.3"` -- transitive dep already on disk; promote to direct devDep. `[VERIFIED: filesystem inspection]`
- `node_modules/@typescript-eslint/` lists `utils/`, `parser/`, `eslint-plugin/`, etc. but no `rule-tester/`. `[VERIFIED: filesystem listing]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@typescript-eslint/rule-tester` | npm | 4+ yrs | ~3M/wk | github.com/typescript-eslint/typescript-eslint | not run (sibling of already-installed `@typescript-eslint/utils`) | Approved -- same monorepo as `typescript-eslint@^8.59.1` already in tree |
| `yaml` | npm | 9+ yrs | ~50M/wk | github.com/eemeli/yaml | not run (already on disk as transitive) | Approved -- present as `node_modules/yaml/` at v2.8.3 |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

*slopcheck was not invoked because both packages are well-known, already present in `node_modules/` (yaml) or part of the same monorepo as installed deps (typescript-eslint/rule-tester). Verified via direct file inspection and the existing `node_modules/` layout.*

## Architecture Patterns

### System Architecture Diagram

```
                       +------------------------------------------+
                       |       docs/messaging-style-guide.md      |
                       |  (binding contract -- frontmatter + body)|
                       +------+-------------------------+---------+
                              |                         |
                              | YAML frontmatter        | body (MSG-* IDs in section 1-15)
                              | (4 closed sets)         |
                              v                         v
              +-----------------------------+  +--------------------------------+
              |  tests/lint-rules/lib/      |  |  tests/architecture/           |
              |  frontmatter.js             |  |  msg-rule-registry.test.ts     |
              |  (memoized yaml.parse)      |  |  (scans body for MSG-* IDs;    |
              |  exports 4 const arrays     |  |   asserts file + config parity)|
              +------+---------------+------+  +----------------+---------------+
                     |               |                          |
      +--------------+----+     +----+----------------------+   |
      | tests/architecture|     | tests/lint-rules/         |   |
      | grammar-          |     | msg-{family}-{n}-{slug}.js|   |
      | frontmatter.test  |     | (34 ESLint rule files)    |   |
      | (4-key set-equal) |     +-------+-------------------+   |
      +-------------------+             |                       |
                                        |  registered under     |
                                        |  files: patterns      |
                                        v                       |
              +----------------------------------------------+  |
              |  eslint.config.js                            |  |
              |  plugins: { msg: { rules: {...34 entries} } }|<-+
              |  + per-rule `files:` block scoping           |
              +----------------------------------------------+
                                  |
                                  | npm run lint
                                  v
              +---------------------------------------------+
              |  ESLint walks files via per-rule patterns;  |
              |  any drift produces source-location + MSG-* |
              |  rule name in the failure output            |
              +---------------------------------------------+

       Wave 1                 Wave 2                     Wave 3
       ------                 ------                     ------
       reinstall.ts           edge/handlers/...          loader + 34 rules +
       emits                   notifyUsageError           registry +
       ManualRecoveryLine      (drop-in migration)        rollback.ts refactor +
       remove.ts seam         (no router change needed)   MARKETPLACE_LABEL_PROBE
       cleanup                                            dedup

                              All three waves: npm run check stays green throughout
```

### Recommended Project Structure (NEW files under tests/)

```
tests/
+- architecture/
|   +- grammar-frontmatter.test.ts   (MIGRATE: extend from 2-key to 4-key; import loader from tests/lint-rules/lib)
|   +- msg-rule-registry.test.ts     (NEW -- body-scan; assert rule files + eslint.config.js parity)
+- lint-rules/                       (NEW directory)
    +- index.js                      (plugin entry -- exports { rules: {...} } object)
    +- lib/
    |   +- frontmatter.js            (memoized yaml.parse loader)
    +- msg-gr-1-line-grammar.js
    +- msg-gr-1-line-grammar.test.js
    +- msg-gr-2-marketplace-token.js
    +- msg-gr-2-marketplace-token.test.js
    +- ...
    +- msg-lc-2-eslint-discipline.js
    +- msg-lc-2-eslint-discipline.test.js

(34 rule files + 34 test files + 1 plugin entry + 1 loader + 1 registry test = 71 new files)
```

### Pattern 1: Custom ESLint rule via ESLintUtils.RuleCreator

**What:** The 2026-canonical rule shape using `ESLintUtils.RuleCreator` from `@typescript-eslint/utils`. Provides type-safe `messageId` enforcement and clean meta-attribution.

**When to use:** Every MSG-* rule that needs AST visitor coverage. Meta-assertion rules use a stripped-down variant (see Pattern 2).

**Example (msg-sr-7-usage-error-routing.js):**

```javascript
// tests/lint-rules/msg-sr-7-usage-error-routing.js
// MSG-SR-7 (style-guide section 10): argument-parsing and usage-validation
// failures MUST route through notifyUsageError, not notifyError + manual
// USAGE block.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#msg-sr-7`,
);

export default createRule({
  name: "msg-sr-7-usage-error-routing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Argument-validation failures must use notifyUsageError, not notifyError + manual USAGE concatenation.",
    },
    messages: {
      useNotifyUsageError:
        "MSG-SR-7: use notifyUsageError(ctx, message, usageBlock) instead of notifyError with USAGE concatenated into the message. The wrapper enforces the MSG-NC-2 blank-line separator.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "notifyError"
        ) {
          return;
        }

        const messageArg = node.arguments[1];
        if (messageArg === undefined) {
          return;
        }

        if (sourceReferencesUsage(messageArg)) {
          context.report({
            node,
            messageId: "useNotifyUsageError",
          });
        }
      },
    };
  },
});

function sourceReferencesUsage(node) {
  if (node.type === "Identifier" && node.name === "USAGE") {
    return true;
  }
  if (node.type === "TemplateLiteral") {
    return node.expressions.some(sourceReferencesUsage);
  }
  if (node.type === "BinaryExpression") {
    return sourceReferencesUsage(node.left) || sourceReferencesUsage(node.right);
  }
  return false;
}
```

This rule's `files:` scope in `eslint.config.js` is `extensions/pi-claude-marketplace/edge/handlers/**/*.ts` -- narrowest valid pattern per D-14-08. After CMC-34 closure (Wave 2), the existing offending callsites are migrated; the rule then catches any reintroduction.

**Source:** Pattern derived from typescript-eslint custom-rules docs `[CITED: https://typescript-eslint.io/developers/custom-rules/]` cross-referenced with `@typescript-eslint/utils` source under `node_modules/@typescript-eslint/utils/`.

### Pattern 2: Meta-assertion rule (no AST visitor)

**What:** A rule that exists to satisfy the registry parity test and cite the structural enforcement mechanism in metadata. Implements an empty `create()` returning `{}` (or a no-op `Program` visitor -- see Pitfall 8). The `meta.docs.description` cites the file/test that actually enforces the rule.

**When to use:** Per D-14-09, for MSG-* IDs that are structurally enforced (the TypeScript type system, or `tests/architecture/catalog-uat.test.ts`, already enforces them). The rule's `meta` documents the cross-reference; the rule does no AST work.

**Example (msg-sd-3-soft-dep-scope.js):**

```javascript
// MSG-SD-3 is structurally enforced by:
//   - PluginInlineUninstalledRow having NO declaresAgents/declaresMcp fields
//     (compact-line.ts:114-120) -- the renderer cannot emit
//     {requires pi-subagents} on (uninstalled) rows because the type lacks
//     the predicate field.
//   - tests/architecture/catalog-uat.test.ts byte-equality on the catalog's
//     (uninstalled) rendering.
// This rule exists to satisfy the registry parity test (D-14-09 / D-14-12).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#msg-sd-3`,
);

export default createRule({
  name: "msg-sd-3-soft-dep-scope",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SD-3 emission scope is structurally enforced by PluginInlineUninstalledRow lacking the predicate fields and by catalog-uat byte-equality. This rule's metadata cites the enforcement.",
    },
    messages: {
      structurallyEnforced:
        "MSG-SD-3 is structurally enforced; see compact-line.ts:114-120 and tests/architecture/catalog-uat.test.ts.",
    },
    schema: [],
  },
  defaultOptions: [],
  create() {
    return {
      // No-op visitor (see Pitfall 8) -- documents intent and silences
      // any "rule has no selectors" eslint nag.
      Program: () => {},
    };
  },
});
```

**Trade-off discussion (per research focus item #5):**

Do meta-assertion rules need to RUN against the codebase? No. The registry parity test asserts existence + registration; the rule body does no AST work. ESLint will load and run the rule on every file but the empty visitor returns no reports, so the runtime cost is one function-call per file -- negligible. The benefit is uniform discoverability: every MSG-* ID in the style guide has a file under `tests/lint-rules/` and a registration in `eslint.config.js`. The reviewer mental model holds.

**Which MSG-* IDs are meta-assertion?** From D-14-09:

- **MSG-GR-1**: line grammar enforced by `RowSpec` discriminated union + `renderRow` switch
- **MSG-GR-2**: `@<marketplace>` carve-out enforced by `PluginCascadeRow` lacking the field
- **MSG-GR-3**: per-scope rendering enforced by sort-key in `presentation/marketplace-list.ts` + renderer logic
- **MSG-GR-4**: closed-set reasons enforced by `Reason` literal-union; `composeReasons` enforces `{}` formatting and empty omission
- **MSG-GR-5**: `<marker>` slot enforced by `MarketplaceRow.marker` literal union (`"autoupdate" | "no autoupdate"`)
- **MSG-IC-1..3**: icon constants are file-private in `compact-line.ts:62-64`; the icon dispatch fn is the only emission point
- **MSG-SD-3**: enforced by `PluginInlineUninstalledRow` lacking the predicate fields
- **MSG-PL-1..6**: enforced by `tests/architecture/catalog-uat.test.ts` byte-equality on the rendered output
- **MSG-ER-1**: enforced by `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">`

**Which MSG-* IDs are full-impl?** From D-14-09 (the rules that need real AST coverage):

- **MSG-SR-1..7**: `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` callsite routing -- AST CallExpression visitor inspecting callee identifier + arguments
- **MSG-MR-1..2**: manual-recovery anchor emission -- detect any string literal matching `MANUAL RECOVERY REQUIRED:` outside the renderer; assert `ManualRecoveryLine` is the only emission path
- **MSG-RP-1**: rollback-partial composition -- detect hand-composed `(failed) {rollback partial}` strings outside `presentation/rollback-partial.ts`. After Wave 3's `transaction/rollback.ts` refactor, this rule passes.
- **MSG-CC-1**: cause-chain trailer -- detect manual `Cause:` / `cause:` string composition outside `presentation/cause-chain.ts`
- **MSG-NC-1**: entity-shaped non-cascade errors -- detect literal `unicode-block-icon <name>` patterns outside the renderer
- **MSG-NC-2**: blank-line separator between message and USAGE block -- detect `notifyError(ctx, msg + "\n" + USAGE)` patterns (overlaps MSG-SR-7's detection; MSG-SR-7 is the canonical implementation, MSG-NC-2 cites it)
- **MSG-RH-1**: reload-hint trailer -- detect literal `Run /reload` and `/reload to <verb>` strings outside `presentation/reload-hint.ts`
- **MSG-LC-1**: console.warn sentence form -- detect any `console.warn` outside `persistence/migrate.ts:178` (overlaps existing `no-restricted-syntax` rule)
- **MSG-LC-2**: eslint discipline -- detect any `eslint-disable*` comment touching `no-restricted-syntax` or `no-console` outside the single migrate.ts callsite
- **MSG-SD-1..2**: soft-dep emission predicate -- detect hand-composed `{requires pi-subagents}` / `{requires pi-mcp}` strings outside `presentation/compact-line.ts::composeReasons`

### Pattern 3: Memoized YAML frontmatter loader

**What:** A `.js` ESM module that reads `docs/messaging-style-guide.md` once per Node process, extracts the frontmatter block via regex, parses with `yaml.parse()`, and exports 4 named arrays.

**Example (tests/lint-rules/lib/frontmatter.js):**

```javascript
// tests/lint-rules/lib/frontmatter.js
//
// Memoized loader for the binding contract YAML frontmatter at
// docs/messaging-style-guide.md. Module-scope cache ensures 34 rules
// don't re-parse on every lint invocation.
//
// D-14-10: uses the yaml package (promoted from transitive to direct devDep
// in Phase 14). The Phase 12 D-CMC-04 regex extractor at
// tests/architecture/grammar-frontmatter.test.ts is migrated here.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");

let _cache = null;

function loadFrontmatter() {
  if (_cache !== null) {
    return _cache;
  }

  const md = readFileSync(STYLE_GUIDE_PATH, "utf8");
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (m === null) {
    throw new Error(
      "messaging-style-guide.md: no YAML frontmatter found at file head",
    );
  }

  const parsed = parse(m[1]);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("messaging-style-guide.md: frontmatter parsed as non-object");
  }

  const requireList = (key) => {
    const v = parsed[key];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      throw new Error(
        `messaging-style-guide.md frontmatter: key "${key}" missing or not a string[]`,
      );
    }
    return Object.freeze([...v]);
  };

  _cache = Object.freeze({
    STATUS_TOKENS_FRONTMATTER: requireList("status_tokens"),
    REASONS_FRONTMATTER: requireList("reasons"),
    MARKERS_FRONTMATTER: requireList("markers"),
    PATTERN_CLASSES_FRONTMATTER: requireList("pattern_classes"),
  });

  return _cache;
}

export const STATUS_TOKENS_FRONTMATTER = loadFrontmatter().STATUS_TOKENS_FRONTMATTER;
export const REASONS_FRONTMATTER = loadFrontmatter().REASONS_FRONTMATTER;
export const MARKERS_FRONTMATTER = loadFrontmatter().MARKERS_FRONTMATTER;
export const PATTERN_CLASSES_FRONTMATTER = loadFrontmatter().PATTERN_CLASSES_FRONTMATTER;
```

**Why `readFileSync` not `readFile`:** The loader runs at ESM import time. Per the memoization design, all four named exports must resolve synchronously when imported by a rule file. The cost is one synchronous read per Node process per `npm run check` invocation -- negligible (~5KB file, <1ms). `[ASSUMED -- based on Node ≥22 fs.readFileSync performance characteristics]`

**Why a separate `loadFrontmatter()` function:** The loader can be invoked from tests directly (the migrated `grammar-frontmatter.test.ts` calls it). Module-scope const initialization is sufficient for the rule-file consumers.

### Pattern 4: Per-rule `files:` scope in flat config

**What:** Each MSG-* rule registered in its own flat-config block with a narrowly-scoped `files:` pattern. Multiple blocks accumulate; ESLint's last-wins applies for conflicting rule settings (none expected here -- each rule has a single registration).

**Example (additions to eslint.config.js):**

```javascript
import msgPlugin from "./tests/lint-rules/index.js";

// ... existing config blocks ...

{
  // MSG-SR-1..6: severity routing rules. Run on all orchestrators
  // that emit user-visible messages.
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sr-1-success-routing": "error",
    "msg/msg-sr-2-warning-routing": "error",
    "msg/msg-sr-3-error-routing": "error",
    "msg/msg-sr-4-cascade-success": "error",
    "msg/msg-sr-5-cascade-warning": "error",
    "msg/msg-sr-6-no-cascade-error": "error",
  },
},
{
  // MSG-SR-7: usage-error routing. Narrowest scope -- the edge layer
  // is the only surface for argument-validation failures.
  files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sr-7-usage-error-routing": "error",
    "msg/msg-nc-2-usage-separator": "error",
  },
},
{
  // MSG-LC-1..2: console.warn discipline. Single sanctioned callsite is
  // persistence/migrate.ts:178; the rules accept that callsite via an
  // inline eslint-disable check.
  files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-lc-1-console-warn-form": "error",
    "msg/msg-lc-2-eslint-discipline": "error",
  },
},
{
  // MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1: composer-chokepoint rules.
  // Run on the extension surface; the composer files themselves are
  // ignored to allow the canonical literals in their bodies.
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/presentation/manual-recovery.ts",
    "extensions/pi-claude-marketplace/presentation/rollback-partial.ts",
    "extensions/pi-claude-marketplace/presentation/cause-chain.ts",
    "extensions/pi-claude-marketplace/presentation/reload-hint.ts",
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-mr-1-manual-recovery-anchor": "error",
    "msg/msg-mr-2-manual-recovery-system": "error",
    "msg/msg-rp-1-rollback-partial": "error",
    "msg/msg-cc-1-cause-chain": "error",
    "msg/msg-rh-1-reload-hint": "error",
  },
},
{
  // All structural meta-assertion rules: enabled globally with empty
  // create(); zero runtime cost; satisfies registry parity.
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-1-line-grammar": "error",
    "msg/msg-gr-2-marketplace-token": "error",
    "msg/msg-gr-3-per-scope": "error",
    "msg/msg-gr-4-reasons-block": "error",
    "msg/msg-gr-5-marker-slot": "error",
    "msg/msg-ic-1-filled-icon": "error",
    "msg/msg-ic-2-open-icon": "error",
    "msg/msg-ic-3-blocked-icon": "error",
    "msg/msg-sd-1-soft-dep-reason": "error",
    "msg/msg-sd-2-soft-dep-predicate": "error",
    "msg/msg-sd-3-soft-dep-scope": "error",
    "msg/msg-nc-1-entity-error": "error",
    "msg/msg-er-1-empty-token": "error",
    "msg/msg-pl-1-description": "error",
    "msg/msg-pl-2-version-slot": "error",
    "msg/msg-pl-3-version-arrow": "error",
    "msg/msg-pl-4-upgradable-listonly": "error",
    "msg/msg-pl-5-hash-version": "error",
    "msg/msg-pl-6-version-non-success": "error",
  },
},
```

**Plugin entry (tests/lint-rules/index.js):**

```javascript
// tests/lint-rules/index.js
import msgGr1 from "./msg-gr-1-line-grammar.js";
import msgGr2 from "./msg-gr-2-marketplace-token.js";
// ... 32 more imports ...

export const RULE_NAMES = Object.freeze([
  "msg-gr-1-line-grammar",
  "msg-gr-2-marketplace-token",
  // ... 32 more entries ...
]);

export default {
  meta: {
    name: "eslint-plugin-msg-local",
    version: "1.0.0",
  },
  rules: {
    "msg-gr-1-line-grammar": msgGr1,
    "msg-gr-2-marketplace-token": msgGr2,
    // ... 32 more entries ...
  },
};
```

**Why a `RULE_NAMES` export?** The registry parity test imports `RULE_NAMES` from this file and asserts (a) every MSG-* ID extracted from the style-guide body has a corresponding name, and (b) every name appears in some `rules:` block of `eslint.config.js`. This makes the test independent of `eslint.config.js` parsing.

**Source:** ESLint flat-config plugin pattern `[CITED: https://eslint.org/docs/latest/use/configure/plugins]` cross-referenced with `eslint.config.js`'s existing local-plugin usage (`@stylistic`, `import-x`, `sonarjs`).

### Pattern 5: RuleTester under node:test (per-rule test files)

**What:** Per-rule companion tests using `@typescript-eslint/rule-tester` with `valid:` and `invalid:` fixture arrays. The `invalid:` cases ARE the planted violations (D-14-11). Each test asserts `messageId` byte-exactly, satisfying SC #2 (failure includes MSG-* rule ID).

**Test file setup (in each .test.js):**

```javascript
// tests/lint-rules/msg-sr-7-usage-error-routing.test.js
import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-7-usage-error-routing.js";

// Bind RuleTester to node:test runner. Done per-test-file rather than
// via --import to keep package.json scripts unchanged.
RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-7-usage-error-routing", rule, {
  valid: [
    // Canonical: notifyUsageError IS the correct routing.
    {
      code: `
        import { notifyUsageError } from "../shared/notify.ts";
        function handle(ctx, msg) {
          notifyUsageError(ctx, msg, "Usage: /claude:plugin install <plugin>");
        }
      `,
    },
    // notifyError without USAGE is fine -- it's a non-usage error.
    {
      code: `
        import { notifyError } from "../shared/notify.ts";
        function handle(ctx, msg) {
          notifyError(ctx, msg);
        }
      `,
    },
  ],
  invalid: [
    // Planted violation #1: notifyError + manual USAGE composition.
    {
      code: `
        import { notifyError } from "../shared/notify.ts";
        const USAGE = "Usage: ...";
        function handle(ctx, msg) {
          notifyError(ctx, msg + "\\n" + USAGE);
        }
      `,
      errors: [{ messageId: "useNotifyUsageError" }],
    },
    // Planted violation #2: notifyError + USAGE via template literal.
    {
      code: `
        import { notifyError } from "../shared/notify.ts";
        const USAGE = "Usage: ...";
        function handle(ctx, msg) {
          notifyError(ctx, \`\${msg}\\n\${USAGE}\`);
        }
      `,
      errors: [{ messageId: "useNotifyUsageError" }],
    },
  ],
});
```

**Source:** `[CITED: https://typescript-eslint.io/packages/rule-tester/]`.

### Pattern 6: Registry parity test

**What:** Single tests/architecture/ test that ties the four moving parts together. Body-scan from D-14-12; no frontmatter `msg_rule_ids:` key needed.

**Example (tests/architecture/msg-rule-registry.test.ts):**

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RULE_NAMES } from "../../tests/lint-rules/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");
const ESLINT_CONFIG_PATH = path.join(REPO_ROOT, "eslint.config.js");

const MSG_ID_RE = /MSG-[A-Z]+-[0-9]+/g;

// D-14-12: derive the canonical MSG-* set by scanning the style-guide body.
function extractMsgIdsFromStyleGuide(md: string): readonly string[] {
  const matches = md.match(MSG_ID_RE);
  if (matches === null) {
    throw new Error("messaging-style-guide.md: no MSG-* IDs found");
  }
  return Object.freeze([...new Set(matches)].sort());
}

function msgIdToFileSlug(msgId: string): string {
  // MSG-SR-7 -> "msg-sr-7-" (prefix; rule file names have a trailing
  // descriptive slug like "msg-sr-7-usage-error-routing")
  return msgId.toLowerCase() + "-";
}

test("D-14-12 / CMC-38: every MSG-* ID has a corresponding rule file name", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = extractMsgIdsFromStyleGuide(md);

  const missing: string[] = [];
  for (const id of styleGuideIds) {
    const slug = msgIdToFileSlug(id);
    const found = RULE_NAMES.some((name) => name.startsWith(slug));
    if (!found) {
      missing.push(id);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `style-guide MSG-* IDs without a tests/lint-rules/msg-*.js rule file:\n  ${missing.join("\n  ")}`,
  );
});

test("D-14-12 / CMC-38: every rule name corresponds to a style-guide MSG-* ID", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = extractMsgIdsFromStyleGuide(md);
  const styleGuideSlugs = new Set(styleGuideIds.map(msgIdToFileSlug));

  const orphans: string[] = [];
  for (const name of RULE_NAMES) {
    const matchesAny = [...styleGuideSlugs].some((slug) => name.startsWith(slug));
    if (!matchesAny) {
      orphans.push(name);
    }
  }

  assert.deepEqual(orphans, [], `rule files without a style-guide MSG-* anchor:\n  ${orphans.join("\n  ")}`);
});

test("D-14-12 / CMC-38: every rule name is registered in eslint.config.js", async () => {
  const config = await readFile(ESLINT_CONFIG_PATH, "utf8");

  const unregistered: string[] = [];
  for (const name of RULE_NAMES) {
    // Match the "msg/msg-xx-N-slug": rule-style registration.
    const registrationRe = new RegExp(`["']msg/${name}["']\\s*:`);
    if (!registrationRe.test(config)) {
      unregistered.push(name);
    }
  }

  assert.deepEqual(unregistered, [], `rules in tests/lint-rules/index.js without eslint.config.js registration:\n  ${unregistered.join("\n  ")}`);
});

test("D-14-12 / CMC-38: rule count is 34 (matches style-guide MSG-* ID count)", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = extractMsgIdsFromStyleGuide(md);
  assert.equal(styleGuideIds.length, 34, `expected 34 MSG-* IDs in style guide; got ${styleGuideIds.length}`);
  assert.equal(RULE_NAMES.length, 34, `expected 34 rules in tests/lint-rules/index.js; got ${RULE_NAMES.length}`);
});
```

**Reading `eslint.config.js` as text not via dynamic import:** The test treats the config file as a source artifact and greps for registration strings. This avoids the need to evaluate ESM (which would also avoid the `parserOptions.projectService` overhead for the config file). Fragile to format reflows in the config file -- but the test is run on every `npm run check`, so any format reflow that breaks the regex is caught immediately. RECOMMEND keeping the registration strings consistent (always `"msg/<name>"` with double quotes).

### Anti-Patterns to Avoid

- **Hand-rolled frontmatter regex extraction in 35 places.** The shared loader at `tests/lint-rules/lib/frontmatter.js` is the single source of the four closed sets. Rules that consume them import from the loader; the grammar-frontmatter test imports from the loader. SC #3 ("modifying frontmatter requires no changes to drift-guard test code") depends on this.
- **`require()` + `createRequire` for the `yaml` package.** `yaml@2.8.3` ships an `exports.` map with both Node and browser entry points. ESM `import { parse } from "yaml"` resolves correctly under Node ≥22 ESM/CJS interop. `[VERIFIED: node_modules/yaml/package.json exports map]`
- **Putting rule files in `.ts` form to "match the project's strict posture".** The rule files are infrastructure consumed by ESLint, not by `tsc`. Forcing them through `parserOptions.projectService` and the strict-type-checked ruleset adds 5+ seconds to typecheck for zero downstream value. CONTEXT.md leaves this to discretion (Claude's Discretion subsection); recommended choice is `.js`.
- **Parsing `eslint.config.js` via dynamic import in the registry test.** Forces the test to evaluate the ESM module graph (including the local plugin's 34 imports), slow and brittle. Text-grep is simpler.
- **A single mega-rule covering all 34 IDs with internal branching.** D-14-09 locks 1-per-MSG-* granularity for reviewer mental model. The 34-file footprint is large but uniform.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Hand-rolled regex extraction of multi-key blocks | `yaml@^2.8.3` `parse()` | v1.4 may add comments, quoted strings, multi-line entries to the frontmatter; regex breaks silently |
| AST-typed rule construction | `module.exports = { meta, create }` plain object | `ESLintUtils.RuleCreator` | RuleCreator infers `MessageIds` type from `meta.messages`; catches typos at TypeScript compile-time if you do go with `.ts` rule files |
| RuleTester | ESLint's built-in `RuleTester` from `eslint` package | `@typescript-eslint/rule-tester` | Pre-wires the typescript-eslint parser; gives cleaner error messages for typed rules; same API surface |
| Frontmatter to Set parity per rule | Each rule re-reads + re-parses the markdown file | Module-scope memoized loader at `tests/lint-rules/lib/frontmatter.js` | 34 rules x N files per lint run x re-parse = wasted IO; memoize once per Node process |
| Style-guide MSG-* ID enumeration | Hardcoded list in the registry test | Body-scan via `/MSG-[A-Z]+-[0-9]+/g` regex | D-14-12 locks body-scan; honors SC #3 |

**Key insight:** The MSG-* drift guard is fundamentally an *introspection* problem (does my code match the contract?) not a *transformation* problem. typescript-eslint AST visitors are the right primitive -- they already know how to walk source code, compose error messages with source locations, and integrate with ESLint's existing reporting. Reinventing this with raw regex over `fs.readFile` is what the no-legacy-markers test does today; it's adequate for the 5-marker case but doesn't scale to 34 callsite-level rules.

## Runtime State Inventory

This is not a rename/refactor phase -- it's an additive phase that lands new infrastructure. The only "runtime state" affected is the npm dep graph (one new direct devDep: `@typescript-eslint/rule-tester`; one transitive-to-direct promotion: `yaml`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None | none -- Phase 14 doesn't touch any datastore |
| Live service config | None | none -- Phase 14 doesn't touch any external service |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | `package-lock.json` regenerates after dep install | One `npm install -D` run; lockfile committed |

**Nothing found in category:** all categories confirmed empty by inspection of phase scope.

## Common Pitfalls

### Pitfall 1: RuleTester needs explicit node:test wiring per test file

**What goes wrong:** RuleTester defaults to `describe` / `it` / `after` from Mocha-style globals. Under `node --test`, these are not globals; tests silently produce no output.

**Why it happens:** `@typescript-eslint/rule-tester` does not auto-detect node:test.

**How to avoid:** Each `*.test.js` file under `tests/lint-rules/` MUST include the 4-line `RuleTester.afterAll = test.after; RuleTester.describe = ...` shim. Place this above the rule import for visibility. Alternative -- package.json `test` script gets `--import` of a shared setup file -- adds friction; recommend the per-file shim.

**Warning signs:** `node --test tests/lint-rules/msg-sr-7-usage-error-routing.test.js` returns 0 with no test output.

**Source:** `[CITED: https://typescript-eslint.io/packages/rule-tester/]`

### Pitfall 2: parserOptions.projectService trips on local plugin files

**What goes wrong:** The flat-config block at `eslint.config.js:32-40` enables `parserOptions: { projectService: true, tsconfigRootDir: ... }` for `**/*.{js,ts}` files. The local plugin's `.js` rule files are in `tests/lint-rules/` -- which may not be in `tsconfig.json`'s `include`. ESLint refuses to run with a "not in tsconfig" error.

**Why it happens:** `projectService` requires every TS-aware file to be reachable from `tsconfig.json`.

**How to avoid:** Add an explicit override block in `eslint.config.js` for `tests/lint-rules/**/*.{js,ts}` that disables type-aware linting (analogous to the existing `eslint.config.js` override at lines 316-319 for `eslint.config.js` itself):

```javascript
{
  files: ["tests/lint-rules/**/*.{js,ts}"],
  ...tseslint.configs.disableTypeChecked,
}
```

**Warning signs:** `npm run lint` fails with `Parsing error: ... is not included in any tsconfig`.

**Source:** Inferred from `eslint.config.js:316-319` pattern usage and typescript-eslint parser docs. `[ASSUMED]`

### Pitfall 3: yaml package CommonJS internals + ESM consumer

**What goes wrong:** `yaml@2.8.3` has `"type": "commonjs"` in its package.json. ESM consumers occasionally hit named-import errors with CJS packages where Node's static analysis can't see all named exports.

**Why it happens:** Node's ESM-from-CJS interop is heuristic.

**How to avoid:** Use the form `import { parse } from "yaml"` -- the package's `exports.` map declares the proper `"types"` and `"node"` entries, and `parse` is a top-level named export from `dist/index.js`. If named import fails (unlikely), fall back to `import yaml from "yaml"; yaml.parse(...)`.

**Warning signs:** `SyntaxError: The requested module 'yaml' does not provide an export named 'parse'`.

**Source:** `[VERIFIED: node_modules/yaml/package.json exports map structure]`

### Pitfall 4: notifyUsageError migration leaves trailing newline

**What goes wrong:** Today's `notifyError(ctx, msg + "\n" + USAGE)` produces `msg\nUSAGE`. Migrating to `notifyUsageError(ctx, msg, USAGE)` correctly produces `msg\n\nUSAGE`. But the message string in some callsites -- e.g., `bootstrap.ts:48-50` -- already includes its own trailing `\n` before the USAGE concatenation. Migration may leave a `msg\n\n\nUSAGE` (triple newline) if not careful.

**Why it happens:** Mixed concatenation styles across 6 handlers.

**How to avoid:** Wave 2 plan must inspect each of the 13 callsites and strip any trailing `\n` from the message string before passing it as the 2nd arg to `notifyUsageError`. The MSG-NC-2 rule (full-impl, Wave 3) catches the test cases that planted-fail this.

**Warning signs:** `tests/edge/router.test.ts` would catch the byte-shape today if it asserted `\n\n` byte-exactly -- but per the audit, it doesn't. Phase 14's drift guard rule (msg-nc-2) is the structural catch.

### Pitfall 5: reinstall.ts emission of ManualRecoveryLine -- where in the pipeline?

**What goes wrong:** The temptation is to emit the `ManualRecoveryLine` from `outcomeToCascadeRow` (reinstall.ts:498). But that function builds a `PluginCascadeRow`, not a top-level line. Emitting both shapes from one function violates the function's single responsibility and the MSG-MR-1 "separate top-level compact line, preceded by a blank line, independent of whatever operation triggered them" contract.

**Why it happens:** The current code at reinstall.ts:521-548 reroutes ManualRecoveryError into the cascade row's reasons. Moving the rerouting back out is non-trivial.

**How to avoid:** Emit the `ManualRecoveryLine` SEPARATELY from `renderReinstallPartitionAndNotify` (reinstall.ts:416-483). Add a step: after composing the cascade `body`, walk the outcomes for any with `failureClass: "manual-recovery"`. For each, call `renderManualRecovery(line, probe)` and prepend the line + blank-line separator to the body. The cascade row stays as `(failed) {rollback partial}` (the structural failure tag the catalog binds); the separate manual-recovery anchor line satisfies MSG-MR-1 / MSG-MR-2.

**Warning signs:** `tests/orchestrators/plugin/reinstall.test.ts` only asserts the cascade row's structural mapping; the new emission path needs a new test asserting the prepended anchor line.

### Pitfall 6: transaction/rollback.ts cannot import from presentation/

**What goes wrong:** D-14-04 offered two paths to refactor `transaction/rollback.ts:56-62` through the renderer. Option (b) -- "accepting a partial-context renderer variant" -- would have `transaction/rollback.ts` call `renderRollbackPartialBody` from `presentation/`. But `eslint.config.js:194-202` BLOCK C zone explicitly forbids `transaction/` from importing `presentation/`.

**Why it happens:** Layering constraint per D-11 / IL-2.

**How to avoid:** Adopt the recommended path (this research) -- move rendering responsibility OUT of `transaction/rollback.ts` and INTO calling orchestrators. The `formatRollbackError` function continues to return an `Error` carrying `RunPhasesResult` data in its `cause` chain; callers extract the data via a new helper exported from `transaction/phase-ledger.ts` (which orchestrators already import via `transaction/`) and render via `presentation/rollback-partial.ts` themselves. Mechanically: change `formatRollbackError`'s signature to NOT compose the body, and add a new orchestrator-facing helper.

**Alternative considered:** Add `presentation/` to the allowed-from list for `transaction/` in `eslint.config.js`. Rejected: this widens the D-11 layering contract for a single use case and forfeits a structural protection.

**Warning signs:** Any approach that adds `import { ... } from "../presentation/..."` to `transaction/rollback.ts` fails ESLint immediately.

**Source:** `[VERIFIED: eslint.config.js:194-202]`

### Pitfall 7: MARKETPLACE_LABEL_PROBE location -- grammar/ or constants/?

**What goes wrong:** D-14-05 leaves the location open. The constant is NOT a closed-set token (it's a `SoftDepProbe` shape constant -- see usage at `presentation/marketplace-list.ts:74-77`); it's a sentinel object.

**Why it happens:** Phase 12's `shared/grammar/` directory was scoped to closed-set token literal-unions (`STATUS_TOKENS`, `REASONS`). A non-set sentinel doesn't fit semantically.

**How to avoid:** Create `extensions/pi-claude-marketplace/shared/constants/` as a NEW sibling directory. Put `marketplace-label-probe.ts` there exporting the constant. The three current call sites -- `presentation/marketplace-list.ts:74`, `orchestrators/marketplace/autoupdate.ts:60`, `orchestrators/marketplace/add.ts:81` -- import from the new module. This keeps `shared/grammar/` strictly scoped to closed-set tokens.

**Warning signs:** Putting it in `shared/grammar/` would force a parallel `as const` literal-union design on what is a single object value, awkward.

**Source:** `[VERIFIED: grep for MARKETPLACE_LABEL_PROBE shows 3 definitions, identical body]`

### Pitfall 8: Empty rule visitors and the eslint v10 type signature

**What goes wrong:** `ESLintUtils.RuleCreator` returns a rule whose `create` function must return an object (the visitor record). An empty `return {}` is valid but typescript-eslint may flag this as "no visitor selectors" lint at config time under strict-type-checked.

**Why it happens:** Strict typescript-eslint configs report this as a code-smell pattern (rule that does nothing).

**How to avoid:** In each meta-assertion rule's `create()`, add a no-op `Program: () => {}` selector. This documents intent (the rule traverses the file but does nothing) and silences any auto-fix lint nag.

**Warning signs:** ESLint warning along the lines of `the rule has no selectors`.

**Source:** `[ASSUMED -- based on typescript-eslint rule-creation guidance; not formally tested in this research]`

### Pitfall 9: per-file ignores for composer files

**What goes wrong:** Some rules (MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1) detect canonical literal patterns that MUST appear in their composer files (e.g., `presentation/manual-recovery.ts` MUST contain the `(manual recovery)` literal because it's the composer). Without proper ignores, these rules report false positives on the composer files themselves.

**Why it happens:** ESLint's `files:` pattern is inclusion; the composer files match the broad pattern.

**How to avoid:** Use `ignores:` in the same flat-config block to exclude the composer file(s) from that rule's scope. See the Pattern 4 example above (the `ignores` arrays).

**Warning signs:** Wave 3 lands and `npm run check` fails with false-positive reports on `presentation/manual-recovery.ts`.

### Pitfall 10: Wave 1 + Wave 2 parallelization conflicts

**What goes wrong:** D-14-03 allows Wave 1 + Wave 2 to parallelize since file sets don't overlap. They DON'T overlap on the extension surface, but BOTH waves modify `tests/` (Wave 1 adds reinstall.ts emission tests; Wave 2 updates router.ts byte-exact tests or adds equivalents). Race condition on `tests/orchestrators/plugin/reinstall.test.ts` and `tests/edge/router.test.ts`.

**Why it happens:** The orchestrator test asserts the cascade row; the new emission path needs new fixtures.

**How to avoid:** Sequence the waves in commit order even if plans are drafted in parallel. Wave 1 lands first; Wave 2 rebases onto Wave 1. The audit-driven router byte-exact test (Gap Closure Plan #4 in `.planning/v1.3-MILESTONE-AUDIT.md:200`) is satisfied by the MSG-NC-2 rule's RuleTester invalid cases -- so no new edge test is strictly needed (D-14-02 lock).

## Code Examples

Verified patterns from the existing codebase:

### Reading the style-guide frontmatter (current pattern, MIGRATING)

```typescript
// From tests/architecture/grammar-frontmatter.test.ts:38-62 (Phase 12 pattern):
function extractFrontmatterList(md: string, key: string): string[] {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (frontmatterMatch === null) {
    throw new Error("messaging-style-guide.md: no YAML frontmatter found at file head");
  }

  const frontmatter = frontmatterMatch[1]!;
  const keyBlockRe = new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, "m");
  const keyBlockMatch = keyBlockRe.exec(frontmatter);
  if (keyBlockMatch === null) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" not found`);
  }

  const items = keyBlockMatch[1]!
    .split("\n")
    .filter((line) => line.startsWith("  - "))
    .map((line) => line.slice("  - ".length));
  // ...
}
```

After D-14-10 migration, this becomes:

```javascript
// In tests/architecture/grammar-frontmatter.test.ts:
import {
  STATUS_TOKENS_FRONTMATTER,
  REASONS_FRONTMATTER,
  MARKERS_FRONTMATTER,
  PATTERN_CLASSES_FRONTMATTER,
} from "../../tests/lint-rules/lib/frontmatter.js";

// Then four set-equality tests, one per closed set.
```

### Closed-set literal-union for new `markers.ts` and `pattern-classes.ts`

```typescript
// extensions/pi-claude-marketplace/shared/grammar/markers.ts -- NEW

// CMC-38 / D-14-10b closed marker set. The 2 entries below are byte-equal
// to the `markers:` block in the binding frontmatter at
// `docs/messaging-style-guide.md`. The drift test at
// `tests/architecture/grammar-frontmatter.test.ts` asserts set-equality.

export const MARKERS = [
  "autoupdate",
  "no autoupdate",
] as const;

export type Marker = (typeof MARKERS)[number];
```

```typescript
// extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts -- NEW

// CMC-38 / D-14-10b closed pattern-class set. The 12 entries below are
// byte-equal to the `pattern_classes:` block in the binding frontmatter
// at `docs/messaging-style-guide.md`.

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

Sources: `[VERIFIED: docs/messaging-style-guide.md lines 51-65]`

### reinstall.ts ManualRecoveryLine emission (NEW)

```typescript
// Conceptual edit to reinstall.ts:416-483 (renderReinstallPartitionAndNotify):
//
// Before: composes cascade body + notify with reload-hint.
// After: walks for manual-recovery outcomes, composes anchor line(s),
// prepends with blank-line separator BEFORE the cascade body.

function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  const probe = softDepStatus(pi);

  // ... existing cascade body composition (unchanged) ...

  const body = bodySegments.join("\n\n");

  // NEW: collect manual-recovery anchors from outcomes carrying
  // failureClass: "manual-recovery". Per MSG-MR-1, the anchor is a
  // separate top-level line preceded by a blank line.
  const manualRecoveryLines = outcomes
    .filter((o): o is ReinstallFailedOutcomeWithManualRecovery =>
      o.partition === "failed" && o.failureClass === "manual-recovery",
    )
    .map((o) => {
      const line: ManualRecoveryLine = {
        kind: "manual-recovery",
        resource: `${o.name}@${o.marketplace}`,
        reasons: ["rollback partial"] as const,
        // Optional orphanDetails could surface leaks here if needed.
      };
      return renderManualRecovery(line, probe);
    });

  const composedBody =
    manualRecoveryLines.length === 0
      ? body
      : `${body}\n\n${manualRecoveryLines.join("\n\n")}`;

  const changedNames = outcomes
    .filter((o): o is ReinstallReinstalledOutcome =>
      o.partition === "reinstalled" && o.resourcesChanged,
    )
    .map((o) => o.name);
  const hint = reloadHint(changedNames);
  const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess;
  dispatch(ctx, appendReloadHint(composedBody, hint));
}
```

This is a sketch; the planner picks the exact shape. Key invariants:

1. The cascade row's `(failed) {rollback partial}` semantics are PRESERVED (catalog binding).
2. The manual-recovery anchor is a SEPARATE compact line preceded by a blank line (MSG-MR-1).
3. `renderManualRecovery` from `presentation/manual-recovery.ts` IS the emission path -- no new composer.

### transaction/rollback.ts refactor (orchestrator-owns-rendering approach)

```typescript
// transaction/rollback.ts -- refactored shape

import { PathContainmentError } from "../shared/path-safety.ts";

import type { RunPhasesResult, RollbackPartialEntry } from "./phase-ledger.ts";

export interface RollbackErrorResult {
  readonly error: Error;
  readonly rollbackPartials: readonly RollbackPartialEntry[];
}

/**
 * Format a RunPhasesResult into a structured error result. The transaction
 * layer no longer composes the user-visible body; the caller (orchestrator)
 * is responsible for rendering via presentation/rollback-partial.ts.
 *
 * Layering: this file CANNOT import from presentation/ (D-11 / BLOCK C
 * zone in eslint.config.js).
 */
export function formatRollbackError(
  result: RunPhasesResult,
  originalError: Error,
): RollbackErrorResult {
  if (originalError instanceof PathContainmentError) {
    return { error: originalError, rollbackPartials: [] };
  }

  if (result.rollbackPartials.length === 0) {
    return { error: originalError, rollbackPartials: [] };
  }

  // Wrap the error with cause; the body composition moves to the caller.
  return {
    error: new Error(originalError.message, { cause: originalError }),
    rollbackPartials: result.rollbackPartials,
  };
}
```

Orchestrators that call `formatRollbackError` now receive the structured `rollbackPartials` array and call `renderRollbackPartial` (or a new bare-row helper) from `presentation/rollback-partial.ts` to compose the body before passing to `notifyError`. The audit-flagged hand-composed literal at line 57 GOES AWAY entirely.

**Note for planner:** This refactor has user-visible behavior implications -- `originalError.message` no longer carries the rollback-partial body. Every caller must be updated. The audit (line 65) says the token strings are correct today; the refactor doesn't change WHAT is rendered, only WHERE. Catalog UAT byte-equality assertions catch any regression.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled regex extraction of YAML frontmatter | `yaml.parse()` via the `yaml` package | Phase 14 (D-14-10) | Frontmatter mutation forward-compat for v1.4 |
| Per-test architectural assertions via recursive walk | typescript-eslint custom rules via AST | Phase 14 (D-14-06) | Better source-location attribution; ESLint integration |
| Hand-composed status/reason literals | Renderer composition via `RowSpec` discriminated union + `renderRow` | Phase 13 | Structural enforcement of grammar |
| `MANUAL RECOVERY REQUIRED:` prefix sentence form | `unicode-block-icon <resource> (manual recovery) {<reason>}` compact line | Phase 13 + Phase 14 wiring | MSG-MR-1 / MSG-MR-2 |
| `notifyError(ctx, msg + "\n" + USAGE)` | `notifyUsageError(ctx, msg, USAGE)` | Phase 14 (CMC-34 closure) | Enforces MSG-NC-2 `\n\n` separator |

**Deprecated/outdated:**

- `tests/architecture/grammar-frontmatter.test.ts`'s hand-rolled `extractFrontmatterList` regex extractor (D-14-10 migrates to shared loader)
- `transaction/rollback.ts:56-62` hand-composed literal (D-14-04 refactor)
- `MARKETPLACE_LABEL_PROBE` triplication (D-14-05 dedup)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@typescript-eslint/rule-tester@8.59.1` is API-stable with `@typescript-eslint/utils@8.59.1` (same monorepo, same version line) | Standard Stack | If versions diverge, RuleTester may not understand the rule shape produced by RuleCreator. Both are released in lockstep from the typescript-eslint monorepo; very low risk |
| A2 | Empty `create()` returning `{}` is valid for ESLint v10 (meta-assertion rules) | Pattern 2 | If invalid, add `Program: () => {}` no-op visitor; tested at the Pitfall 8 mitigation level. Source not formally verified |
| A3 | `parserOptions.projectService: true` in `eslint.config.js:37` will refuse to lint files outside `tsconfig.json`'s include glob | Pitfall 2 | If wrong, the `tseslint.configs.disableTypeChecked` override is unnecessary. Cost is zero -- adding the override is harmless |
| A4 | `import { parse } from "yaml"` resolves correctly under Node 22+ ESM/CJS interop | Pattern 3 | If wrong, fall back to `import yaml from "yaml"; yaml.parse(...)`. Both forms documented in the yaml package |
| A5 | `originalError.message` mutation by `formatRollbackError` is the binding contract; the audit-flagged literal moves to orchestrator side without user-visible change | transaction/rollback.ts refactor | If wrong, catalog UAT byte-equality test catches any regression |
| A6 | Wave 3 plan count of 3-4 is sufficient for plan decomposition | Plan decomposition | If wrong, plans are restructured during plan-phase. The wave structure is binding (D-14-03); the plan count is discretionary |
| A7 | Body-scan regex `/MSG-[A-Z]+-[0-9]+/g` matches exactly 34 unique IDs in the current style guide | Registry test | If wrong, the count assertion fails immediately and the test is updated. Verified at research time: 34 unique IDs |
| A8 | Per-test-file RuleTester shim (4 lines of `RuleTester.afterAll = test.after; ...`) is preferable to `--import` flag in package.json | Pitfall 1 | Equivalent functionally; per-file shim keeps package.json scripts simple |

**Verified claims (NOT assumptions):**

- `yaml@2.8.3` is present at `node_modules/yaml/` `[VERIFIED: filesystem inspection]`
- `@typescript-eslint/utils` is present at `node_modules/@typescript-eslint/utils/` `[VERIFIED: filesystem inspection]`
- `@typescript-eslint/rule-tester` is NOT present `[VERIFIED: filesystem inspection]`
- Style guide contains 34 unique MSG-* IDs `[VERIFIED: grep extraction]`
- Frontmatter has the 4 expected keys (`status_tokens`, `reasons`, `markers`, `pattern_classes`) `[VERIFIED: file read]`
- `transaction/` is forbidden from importing `presentation/` `[VERIFIED: eslint.config.js:194-202]`
- The 13 callsites in CMC-34 evidence are accurate `[VERIFIED: grep for notifyError in edge/handlers/]`
- `MARKETPLACE_LABEL_PROBE` is identically defined in 3 files `[VERIFIED: grep + read]`

## Open Questions

**None -- all answered.** The locked decisions in CONTEXT.md D-14-01..D-14-12 settled WHAT and WHERE; this research answered HOW.

The CONTEXT.md's "Claude's Discretion" subsection lists six items left to planner discretion; this research provides recommendations:

1. **Wave 3 plan decomposition:** Recommend 4 plans (infrastructure / meta-assertion-rules / full-impl-rules / WARNING-closures-and-config-wiring). See Plan Decomposition section below.
2. **Rule-file extension `.js` vs `.ts`:** Recommend `.js`. Reasoning: keeps test infrastructure out of `tsconfig` strict typecheck; matches typescript-eslint's own rule-file convention; sidesteps Pitfall 2.
3. **Grammar file layout for new closed sets:** Recommend two NEW files (`markers.ts` and `pattern-classes.ts`) per Phase 12 D-CMC-01 / D-CMC-02 one-closed-set-per-file precedent.
4. **transaction/rollback.ts refactor approach:** Recommend orchestrator-owns-rendering (NOT D-14-04's option (b) because of the D-11 layering constraint). See Pitfall 6 / "Code Examples" section.
5. **MARKETPLACE_LABEL_PROBE constant location:** Recommend new `extensions/pi-claude-marketplace/shared/constants/` directory (NOT `shared/grammar/` -- the constant isn't a closed-set token). See Pitfall 7.
6. **Memoization mechanism for the frontmatter loader:** Recommend plain module-scope const (lazy-init function called once at module load). See Pattern 3.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner, ESLint | yes | 22.22.2 (verified `node --version`) | -- |
| npm | Package management | yes | bundled with Node | -- |
| `@typescript-eslint/utils` | Rule construction | yes | 8.59.1 (transitive via `typescript-eslint`) | -- |
| `@typescript-eslint/rule-tester` | Per-rule tests | NO | -- | Install as devDep in Wave 3 plan #1 |
| `yaml` | Frontmatter loader | yes (transitive at v2.8.3) | 2.8.3 | Promote to direct devDep in Wave 3 plan #1 |
| `typescript-eslint` (parser + rules) | flat config | yes | 8.59.1 | -- |
| `eslint` | Plugin loader | yes | 10.2.1 (>=10.x required for flat config) | -- |
| `typescript` | typecheck step | yes | 6.0.3 | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `@typescript-eslint/rule-tester` -- install as devDep; the planner-side dep install step is the fix.

## Validation Architecture

**Test framework**

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, bundled with Node ≥22) |
| Config file | None (the `npm test` script in `package.json:74` is the contract) |
| Quick run command | `npm run lint` (catches MSG-* drift via ESLint) and `npm test` (catches RuleTester + registry-parity test failures) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |

**Phase Requirements to Test Map**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMC-38 | Drift guard fails npm run check when any MSG-* rule violated | unit (per-rule RuleTester invalid case) | `node --test tests/lint-rules/msg-sr-7-usage-error-routing.test.js` | NO Wave 3 |
| CMC-38 | Style-guide frontmatter is binding source of truth for 4 closed sets | unit (set-equality) | `node --test tests/architecture/grammar-frontmatter.test.ts` | YES (extending from 2-key to 4-key in Wave 3) |
| CMC-38 | Every MSG-* ID has rule file + config registration | unit (registry-parity) | `node --test tests/architecture/msg-rule-registry.test.ts` | NO Wave 3 |
| CMC-16 | ManualRecoveryLine emitted from reinstall.ts on ManualRecoveryError | integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | YES (extending in Wave 1) |
| CMC-16 | renderManualRecovery is consumed in production (orphan resolved) | structural | `grep -l renderManualRecovery extensions/pi-claude-marketplace/orchestrators/` shows >=1 caller | NO Wave 1 (new caller added) |
| CMC-34 | 6 edge handlers use notifyUsageError for argument-validation failures | structural (drift guard MSG-SR-7) | `node --test tests/lint-rules/msg-sr-7-usage-error-routing.test.js` | NO Wave 3 (rule lands after migration) |
| CMC-34 | Router emits `\n\n` separator between message and USAGE block | structural (drift guard MSG-NC-2) | `node --test tests/lint-rules/msg-nc-2-usage-separator.test.js` | NO Wave 3 |
| WARNING | transaction/rollback.ts no longer hand-composes literals | structural (drift guard MSG-RP-1) | `node --test tests/lint-rules/msg-rp-1-rollback-partial.test.js` | NO Wave 3 (rule + refactor land together) |
| WARNING | MARKETPLACE_LABEL_PROBE single source | structural (no-dup grep equivalent) | one rule covering this would be excessive -- leave as code review concern after dedup | NO Wave 3 (dedup only) |

**Sampling Rate**

- **Per task commit:** `npm run check` (full gate; pre-commit hook also enforces).
- **Per wave merge:** `npm run check` (re-verifies after rebase).
- **Phase gate:** `npm run check` green at HEAD before `/gsd:verify-work` runs.

**Wave 0 Gaps**

- [ ] `tests/lint-rules/lib/frontmatter.js` -- shared loader (consumed by 34 rules + grammar-frontmatter.test.ts migration)
- [ ] `tests/lint-rules/index.js` -- plugin entry exporting `RULE_NAMES` + `rules` object
- [ ] `tests/lint-rules/msg-*.{js,test.js}` -- 34 rule files + 34 test files
- [ ] `tests/architecture/msg-rule-registry.test.ts` -- registry parity test
- [ ] `extensions/pi-claude-marketplace/shared/grammar/markers.ts` -- new closed-set literal-union (2 entries)
- [ ] `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` -- new closed-set literal-union (12 entries)
- [ ] `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` -- dedup target (NEW directory)
- [ ] devDep additions: `@typescript-eslint/rule-tester` + `yaml` (promote to direct)
- [ ] `eslint.config.js` -- local plugin registration + per-rule `files:` blocks + per-tests-lint-rules typecheck-disable override
- [ ] `package.json` -- extend test glob to include `tests/lint-rules/**/*.test.{js,ts}` (brace expansion already used; just add the path)
- [ ] `tests/architecture/grammar-frontmatter.test.ts` -- migrate from local extractor to shared loader; extend from 2-key to 4-key

## Security Domain

Security enforcement is not the primary axis of this phase (`security_enforcement` is absent from `.planning/config.json`; phase scope is internal-contract drift guard not external-attack-surface hardening). The drift guard itself has indirect security value: it locks the user-contract surface and prevents accidental introduction of unsafe patterns (e.g., a `notifyError(ctx, untrusted + USAGE)` that bypasses the `\n\n` separator and confuses error parsing). However, no new external-input or auth surface is introduced.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (no auth surface in Phase 14 scope) |
| V3 Session Management | no | (no session surface) |
| V4 Access Control | no | (no access-control surface) |
| V5 Input Validation | yes (indirect) | The yaml loader inputs are trusted (committed-in-repo markdown); no untrusted YAML input |
| V6 Cryptography | no | (no crypto surface) |

**Known Threat Patterns:** None directly introduced. The drift guard's input -- `docs/messaging-style-guide.md` -- is a committed-in-repo file; a malicious YAML input would require a malicious commit, which is governed by the existing git review process.

## Plan Decomposition (Wave 3 -- recommendation, planner discretion)

Wave 1: 1 plan -- CMC-16 closure (reinstall.ts emission + remove.ts seam cleanup).

Wave 2: 1 plan -- CMC-34 closure (6 edge handlers + supporting test updates).

Wave 3: 4 plans recommended (per the discretion in CONTEXT.md and the scope size):

**Plan 3a -- Infrastructure & Foundations:**

- Install `@typescript-eslint/rule-tester` and promote `yaml` to direct devDep
- Create `tests/lint-rules/` directory with `lib/frontmatter.js` (memoized loader)
- Create `tests/lint-rules/index.js` (plugin entry -- initially exporting empty rules object; populated in 3b/3c)
- Create `extensions/pi-claude-marketplace/shared/grammar/markers.ts` (2 entries)
- Create `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` (12 entries)
- Migrate `tests/architecture/grammar-frontmatter.test.ts` to use the shared loader
- Extend `grammar-frontmatter.test.ts` to 4-key set-equality
- Create `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` and update 3 import sites
- Extend `package.json:test` script glob to include `tests/lint-rules/**/*.test.{js,ts}`
- Add `eslint.config.js` override block for `tests/lint-rules/**/*.{js,ts}` (disable type-checked)

**Plan 3b -- Meta-Assertion Rules (no AST visitor; structural cross-references):**

- Create rule files for MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, MSG-ER-1 (19 rule files)
- Create RuleTester companion tests (each asserts `valid:` cases compile cleanly -- the meta-assertion rules' empty visitors do nothing on valid code, so the test is essentially a smoke test)
- Wire into `tests/lint-rules/index.js`
- Wire into `eslint.config.js` global block

**Plan 3c -- Full-Impl Rules (real AST coverage):**

- Create rule files for MSG-SR-1..7, MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-RH-1, MSG-LC-1..2, MSG-SD-1..2 (15 rule files)
- Create RuleTester companion tests with comprehensive `valid:` and `invalid:` fixture arrays
- Wire into `tests/lint-rules/index.js`
- Wire into `eslint.config.js` with per-rule `files:` patterns
- Create `tests/architecture/msg-rule-registry.test.ts` -- registry parity assertions

**Plan 3d -- WARNING Closures:**

- Refactor `transaction/rollback.ts:48-63` (orchestrator-owns-rendering approach)
- Update callers of `formatRollbackError` to render via `presentation/rollback-partial.ts`
- Update related orchestrator tests
- (Note: MARKETPLACE_LABEL_PROBE dedup landed in Plan 3a; no additional work here.)

**Parallelization potential:**

- Wave 1 + Wave 2 may parallelize (no file overlap on extension surface; rebase Wave 2 onto Wave 1 in commit order).
- Plan 3b + Plan 3c may parallelize (no rule-file overlap; both depend on Plan 3a).
- Plan 3d may parallelize with 3b/3c (no file overlap once dependencies on Plan 3a settle; the MSG-RP-1 rule (in 3c) verifies the 3d refactor structurally, so plan 3d should land before MSG-RP-1's `invalid:` planted-violation tests would fail -- sequence is `3a -> 3d -> 3c` for rollback.ts; `3a -> 3b` independent).

Estimated total plan count: **6 plans (Wave 1 + Wave 2 + 4 Wave 3 sub-plans).** This is within the CONTEXT.md "3-6 plans total" estimate.

## Sources

### Primary (HIGH confidence)

- `docs/messaging-style-guide.md` -- Direct file read; frontmatter (lines 1-65), section 1-15 MSG-* IDs (verified 34 unique IDs)
- `.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md` -- Locked decisions D-14-01..D-14-12
- `.planning/v1.3-MILESTONE-AUDIT.md` -- Audit findings driving absorbed scope; specific file:line evidence for CMC-16 + CMC-34
- `eslint.config.js` (read in full) -- Existing flat-config structure, BLOCK A/B/C/D/E patterns; D-11 layering enforcement
- `extensions/pi-claude-marketplace/shared/grammar/{status-tokens.ts,reasons.ts}` -- `as const` literal-union pattern; D-CMC-08 precedent for new files
- `extensions/pi-claude-marketplace/shared/notify.ts` -- Existing 4-wrapper API; `notifyUsageError` signature
- `extensions/pi-claude-marketplace/presentation/{manual-recovery.ts,rollback-partial.ts,compact-line.ts}` -- Existing composer surfaces; `RowSpec` discriminated union
- `extensions/pi-claude-marketplace/transaction/rollback.ts` -- Hand-composed literal at lines 56-62
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- ManualRecoveryError handling at lines 195-205, 268-282; `outcomeToCascadeRow` at 498-554; `renderReinstallPartitionAndNotify` at 416-483
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- Dead-code `void renderManualRecovery;` at line 96
- `extensions/pi-claude-marketplace/edge/handlers/{plugin,marketplace}/*.ts` -- All 13 CMC-34 callsites verified
- `extensions/pi-claude-marketplace/edge/router.ts:125` -- `notifyUsageError` canonical usage example
- `tests/architecture/grammar-frontmatter.test.ts` -- Phase 12 extractor pattern (98 lines)
- `tests/architecture/no-legacy-markers.test.ts` -- D-13-12 / CMC-35 recursive-walk pattern (124 lines)
- `tests/edge/router.test.ts:70-86` -- Existing router test (only presence-check; the byte-exact `\n\n` separator IS NOT verified today per audit)
- `node_modules/yaml/package.json` -- Confirmed v2.8.3, `"type": "commonjs"`, ESM-compatible `exports.` map
- `node_modules/@typescript-eslint/` (filesystem listing) -- Confirmed `utils` present, `rule-tester` absent
- `package.json` -- Test script glob; existing devDep list; engines `>=20.19.0`; `typescript: ^6.0.3`

### Secondary (MEDIUM confidence)

- [typescript-eslint custom rules docs](https://typescript-eslint.io/developers/custom-rules/) -- `ESLintUtils.RuleCreator` pattern, meta object structure, `MessageIds` type inference
- [typescript-eslint rule-tester docs](https://typescript-eslint.io/packages/rule-tester/) -- Node:test integration shim pattern
- [ESLint flat config plugins docs](https://eslint.org/docs/latest/use/configure/plugins) -- `plugins: { namespace: pluginObj }` shape; per-block `files:` patterns
- [eemeli/yaml docs](https://eemeli.org/yaml/) -- ESM `import { parse } from "yaml"` confirmed
- [Node.js Test Runner docs](https://nodejs.org/api/test.html) -- Brace expansion in globs (matches existing `package.json:test` script)

### Tertiary (LOW confidence -- flagged for validation)

- None -- every load-bearing claim is verified against an authoritative source.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- every package version verified via filesystem or npm registry
- Architecture: HIGH -- recommended patterns verified against authoritative docs and cross-referenced with codebase
- Pitfalls: HIGH -- every pitfall is grounded in observed codebase invariants (eslint.config.js BLOCK C zone, projectService overhead, etc.)
- Plan decomposition: MEDIUM -- recommendation; CONTEXT.md leaves this to planner discretion
- transaction/rollback.ts refactor approach: MEDIUM-HIGH -- the layering constraint forces the orchestrator-owns-rendering path; the alternative (plumbing context) is also viable but requires more code

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days -- stable surface; typescript-eslint releases major versions ~yearly; ESLint major versions ~2 years)

## RESEARCH COMPLETE

Phase 14 (Drift Guard & Test Alignment) is fully researched. The locked decisions in CONTEXT.md D-14-01..D-14-12 are honored; this research provides the HOW for each.

**Three new findings the planner MUST act on:**

1. **Install `@typescript-eslint/rule-tester` as a devDependency in Wave 3 Plan 3a.** It's not present in `node_modules/`. The plan-phase task list must include this dependency-install step before any rule test file runs.

2. **D-14-04 option (b) is forbidden by the import-x layering rules at `eslint.config.js:194-202` BLOCK C zone.** The transaction layer cannot import from presentation/. The recommended refactor path (orchestrator-owns-rendering) is documented in detail; planner picks this approach or relitigates the layering constraint with the user (NOT recommended).

3. **Plan decomposition recommendation: 6 plans total** (Wave 1 = 1 plan; Wave 2 = 1 plan; Wave 3 = 4 plans). Plan 3a (Infrastructure) lands first; 3b/3c parallelizable; 3d sequences after 3a but before 3c's MSG-RP-1 invalid cases.

The planner can proceed to PLAN.md generation. Every plan author should re-read this file's Pitfalls section before drafting tasks.
