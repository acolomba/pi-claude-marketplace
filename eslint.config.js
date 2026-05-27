import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

import msgPlugin from "./tests/lint-rules/index.js";

export default tseslint.config(
  {
    ignores: [
      ".claude/",
      ".opencode/",
      ".pi/",
      ".planning/",
      "build/",
      "coverage/",
      "dist/",
      "node_modules/",
      "tmp/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{js,ts}"],
    plugins: {
      "@stylistic": stylistic,
      "import-x": importX,
      sonarjs,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // Pure-style rules I do not want to enforce: `Array<T>` vs `T[]` is
      // either-or, and template-literal expressions on numbers are normal.
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "block-like", next: "*" },
      ],
      "prefer-object-has-own": "error",
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-nested-conditional": "error",
      "sonarjs/no-nested-template-literals": "error",
      curly: ["error", "all"],
    },
  },
  {
    // BLOCK A (D-06 / IL-2 / IL-3): Output discipline scoped to the extension.
    // Direct stdout/stderr writes and console.* calls are forbidden in the
    // extension. Sanctioned exception: load-time migrate-record save failure
    // in `migrateLegacyMarketplaceRecords` (IL-3) -- disabled inline at the
    // single callsite with `// eslint-disable-next-line no-restricted-syntax
    // -- IL-3: ...`. The `--` justification is required (Pitfall #5).
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.object.name='process'][callee.object.property.name='stdout'][callee.property.name='write']",
          message:
            "Direct process.stdout.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
        },
        {
          selector:
            "CallExpression[callee.object.object.name='process'][callee.object.property.name='stderr'][callee.property.name='write']",
          message:
            "Direct process.stderr.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message:
            "console.log is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='warn']",
          message:
            "console.warn is forbidden in the extension (IL-3) except at the single sanctioned migrateLegacyMarketplaceRecords callsite (use eslint-disable-next-line with a -- comment citing IL-3).",
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
          message:
            "console.error is forbidden in the extension (IL-2). Use notifyError(ctx, ..., cause) via shared/notify.ts wrappers.",
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='info']",
          message:
            "console.info is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
        },
        {
          selector:
            "CallExpression[callee.property.name='notify'][callee.object.property.name='ui']",
          message:
            "Direct ctx.ui.notify is forbidden -- use notifySuccess/notifyWarning/notifyError from shared/notify.ts (D-07).",
        },
      ],
      // Catches console.debug / console.trace / console.dir which the AST
      // selectors above don't enumerate.
      "no-console": "error",
    },
  },
  {
    // BLOCK B: Per-file override -- shared/notify.ts IS the sanctioned
    // ctx.ui.notify call site, so its body must be allowed to call it.
    files: ["extensions/pi-claude-marketplace/shared/notify.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
  // ----- Phase 14 MSG-* drift-guard rules (D-14-08 LOCKED per-rule scoping;
  // RESEARCH.md Pattern 4 + Pitfall 9; Plan 14-06 wires the 34-rule plugin
  // shipped by Plans 14-04 + 14-05 under `tests/lint-rules/`). Rule files are
  // named `msg-<family>-<n>-<slug>.js`; the plugin exports them under the
  // `msg/` namespace. Total: 6 + 2 + 2 + 5 + 3 + 16 = 34 (no duplicates;
  // registry parity test in tests/architecture/msg-rule-registry.test.ts
  // asserts 1:1 with tests/lint-rules/index.js's RULE_NAMES export).
  {
    // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators
    // surface. Every notify* call site lives under orchestrators/ (edge/
    // has the separate MSG-SR-7 usage-error variant in Block 2). MSG-GR-3
    // is wired separately below across BOTH surfaces (orchestrators/ and
    // edge/handlers/) since Phase 14.2-fix CR-01 surfaced a user-first
    // iteration literal in `edge/handlers/plugin/import.ts:45` that the
    // orchestrator-only glob missed.
    files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
    ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
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
    // MSG-Block 1b (MSG-GR-3): per-scope rendering rule. Promoted out of
    // the meta-assertion bag in Phase 14.2 (D-14-2-08 supersedes D-14-09)
    // as an active AST check detecting (a) local user-first `scopeOrder`
    // helpers and (b) `["user", "project"]` iteration literals. Phase
    // 14.2-fix CR-01: glob widened to include `edge/handlers/` because
    // the bare `import` handler still constructed `["user", "project"]`
    // for its `selectedScopes` argument, contradicting the project-first
    // contract enforced everywhere else. The canonical comparator in
    // `presentation/sort.ts` remains outside the detection glob.
    files: [
      "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
      "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
    ],
    ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-gr-3-per-scope": "error",
    },
  },
  {
    // MSG-Block 2 (MSG-SR-7 + MSG-NC-2): argument-validation usage-error
    // routing -- edge/handlers are the only surface that emits Usage blocks.
    files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-sr-7-usage-error-routing": "error",
      "msg/msg-nc-2-usage-separator": "error",
    },
  },
  {
    // MSG-Block 3 (MSG-LC-1..2): console.warn discipline (IL-3). The rule
    // intent is to detect console.warn / eslint-disable-touching-no-console
    // OUTSIDE the single sanctioned `persistence/migrate.ts` callsite (the
    // sanctioned IL-3 load-time legacy migration save-failure). MSG-LC-1
    // flags any `console.warn` CallExpression; MSG-LC-2 flags any
    // eslint-disable directive touching `no-restricted-syntax` /
    // `no-console`. The composer callsite is exempted via `ignores:`.
    // (MSG-LC-2 also accepts IL-3-marked sanctioned directives via the
    // rule's internal SANCTIONED_RE discriminator -- belt-and-braces.)
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: ["extensions/pi-claude-marketplace/persistence/migrate.ts"],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-lc-1-console-warn-form": "error",
      "msg/msg-lc-2-eslint-discipline": "error",
    },
  },
  {
    // MSG-Block 4a (MSG-MR-1..2, MSG-RP-1, MSG-RH-1): composer-chokepoint
    // literal-detection rules (RESEARCH.md Pitfall 9). The composer files
    // themselves legitimately contain the canonical literals they own --
    // they MUST be ignored or the rules report false positives.
    //
    // Phase 16 (v1.4) bounded-window addition: shared/notify.ts is the V2
    // renderer chokepoint (SNM-12 / SNM-15 / D-16-09 / D-16-12) and houses
    // the duplicated `RELOAD_HINT_TRAILER = "/reload to pick up changes"`
    // literal consumed by its file-private `shouldEmitReloadHint`-gated
    // append discipline inside the public `notify()` (plan 05). The
    // duplication is intentional (D-16-04) and ends in Phase 21 when V1
    // wrappers + presentation/* composers are deleted together; this ignore
    // can be removed at the same time as the reload-hint.ts entry above.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: [
      "extensions/pi-claude-marketplace/presentation/manual-recovery.ts",
      "extensions/pi-claude-marketplace/presentation/rollback-partial.ts",
      "extensions/pi-claude-marketplace/presentation/reload-hint.ts",
      "extensions/pi-claude-marketplace/shared/notify.ts",
    ],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-mr-1-manual-recovery-anchor": "error",
      "msg/msg-mr-2-manual-recovery-system": "error",
      "msg/msg-rp-1-rollback-partial": "error",
      "msg/msg-rh-1-reload-hint": "error",
    },
  },
  {
    // MSG-Block 4b (MSG-CC-1): cause-chain trailer chokepoint. The
    // canonical composers live at presentation/cause-chain.ts and
    // shared/errors.ts (causeChainTrailer). Two additional sites
    // legitimately emit `cause:` / `Cause:` literals: the
    // marketplace-block cause-trailer at presentation/plugin-list.ts
    // (catalog line 230 -- a DIFFERENT surface from the error cause
    // chain, owns its own per-line composition) and the IL-3 sanctioned
    // load-time legacy-migration save-failure log at persistence/migrate.ts
    // (the only sanctioned console.warn callsite -- its `Cause: ${msg}`
    // suffix is part of the IL-3 sanctioned message form, not the
    // user-facing notify trailer).
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: [
      "extensions/pi-claude-marketplace/presentation/cause-chain.ts",
      "extensions/pi-claude-marketplace/shared/errors.ts",
      "extensions/pi-claude-marketplace/presentation/plugin-list.ts",
      "extensions/pi-claude-marketplace/persistence/migrate.ts",
    ],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-cc-1-cause-chain": "error",
    },
  },
  {
    // MSG-Block 5 (MSG-NC-1, MSG-SD-1..2): renderer-chokepoint literal-
    // detection rules. The canonical V1 renderer lives in
    // presentation/compact-line.ts; the soft-dep predicate plumbing also
    // legitimately emits the marker literals there. The closed-set
    // Reasons literal-union in shared/grammar/reasons.ts is the
    // canonical declaration of the bare-predicate token values
    // (`"requires pi-subagents"`, `"requires pi-mcp"`) consumed by the
    // renderer -- it MUST be ignored or MSG-SD-2 reports false
    // positives on the source-of-truth declaration.
    //
    // Phase 16 (v1.4) bounded-window addition: shared/notify.ts is the V2
    // renderer chokepoint (SNM-17 / SNM-18 / D-16-09) and houses the
    // duplicated SOFT_DEP_MARKER_AGENTS / SOFT_DEP_MARKER_MCP literals
    // injected by its file-private composeReasons / renderPluginRow (plan
    // 04). The duplication is intentional (D-16-04) and ends in Phase 21
    // when V1 wrappers + presentation/* composers are deleted together;
    // this ignore can be removed at the same time as the compact-line.ts
    // entry above.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: [
      "extensions/pi-claude-marketplace/presentation/compact-line.ts",
      "extensions/pi-claude-marketplace/shared/grammar/reasons.ts",
      "extensions/pi-claude-marketplace/shared/notify.ts",
    ],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-nc-1-entity-error": "error",
      "msg/msg-sd-1-soft-dep-reason": "error",
      "msg/msg-sd-2-soft-dep-predicate": "error",
    },
  },
  {
    // MSG-Block 6 (15 entries): structural meta-assertion rules. Each cites
    // a structural enforcement mechanism in meta.docs and uses an empty
    // `Program: () => {}` visitor (RESEARCH.md Pitfall 8). Zero runtime
    // cost; satisfies the registry parity test (the rule names must appear
    // in eslint.config.js for assertion (c) to pass). MSG-GR-3 was
    // promoted out of this bag in Phase 14.2 (D-14-2-08 supersedes
    // D-14-09) -- it is now an active AST check wired under MSG-Block 1
    // (orchestrator-scoped) above.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    plugins: { msg: msgPlugin },
    rules: {
      "msg/msg-gr-1-line-grammar": "error",
      "msg/msg-gr-2-marketplace-token": "error",
      "msg/msg-gr-4-reasons-block": "error",
      "msg/msg-gr-5-marker-slot": "error",
      "msg/msg-ic-1-filled-icon": "error",
      "msg/msg-ic-2-open-icon": "error",
      "msg/msg-ic-3-blocked-icon": "error",
      "msg/msg-sd-3-soft-dep-scope": "error",
      "msg/msg-pl-1-description": "error",
      "msg/msg-pl-2-version-slot": "error",
      "msg/msg-pl-3-version-arrow": "error",
      "msg/msg-pl-4-upgradable-listonly": "error",
      "msg/msg-pl-5-hash-version": "error",
      "msg/msg-pl-6-version-non-success": "error",
      "msg/msg-er-1-empty-token": "error",
    },
  },
  {
    // BLOCK C (D-11): Import-direction enforcement. 9-zone no-restricted-paths
    // mapping: each folder declares which sibling folders MUST NOT import from
    // it (i.e. enforces the upward/inward direction of the dep graph).
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: "./extensions/pi-claude-marketplace/edge",
              from: [
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/domain",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
              ],
              message:
                "edge/ may only import from orchestrators/, presentation/, shared/, platform/.",
            },
            {
              target: "./extensions/pi-claude-marketplace/orchestrators",
              from: ["./extensions/pi-claude-marketplace/edge"],
              message: "orchestrators/ MUST NOT import from edge/.",
            },
            {
              target: "./extensions/pi-claude-marketplace/bridges",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message:
                "bridges/ may only import from domain/, persistence/, shared/, platform/. Cross-bridge imports are also forbidden.",
            },
            {
              target: "./extensions/pi-claude-marketplace/domain",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message:
                "domain/ MUST NOT import upward -- pure logic only. shared/ and platform/ are the only sibling imports allowed.",
            },
            {
              target: "./extensions/pi-claude-marketplace/transaction",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/domain",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message: "transaction/ may only import from persistence/, shared/, platform/.",
            },
            {
              target: "./extensions/pi-claude-marketplace/persistence",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message: "persistence/ may only import from domain/, shared/, platform/.",
            },
            {
              target: "./extensions/pi-claude-marketplace/presentation",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
              ],
              message: "presentation/ may only import from domain/, shared/, platform/.",
            },
            {
              target: "./extensions/pi-claude-marketplace/platform",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/domain",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message:
                "platform/ may only import from shared/. It's the external-system boundary (git, Pi API surface).",
            },
            {
              target: "./extensions/pi-claude-marketplace/shared",
              from: [
                "./extensions/pi-claude-marketplace/edge",
                "./extensions/pi-claude-marketplace/orchestrators",
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/domain",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
                "./extensions/pi-claude-marketplace/presentation",
              ],
              message: "shared/ may only import from platform/ for Pi API types.",
            },
          ],
        },
      ],
    },
  },
  {
    // BLOCK E (Phase 7 D-04): Pi peer-import chokepoint. Direct imports of
    // `@earendil-works/pi-coding-agent` are allowed only in
    // `extensions/pi-claude-marketplace/platform/pi-api.ts`. All other
    // extension code imports Pi API types through the wrapper so
    // peer-dependency version bumps have a single audit point.
    //
    // The Phase 13 D-13-09 Gate 2 (legacy ES-5 marker import restriction +
    // its sibling BLOCK E-2 covering tests) was retired in the Plan
    // 13-03-02 atomic commit: the 5 ES-5 marker exports no longer exist
    // in `shared/markers.ts`, so there is nothing to restrict. The
    // static-audit at `tests/architecture/no-legacy-markers.test.ts`
    // continues to enforce zero re-introductions for the rest of the
    // codebase's lifetime under `npm run check`.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: ["extensions/pi-claude-marketplace/platform/pi-api.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@earendil-works/pi-coding-agent",
              message:
                "Import Pi API types from extensions/pi-claude-marketplace/platform/pi-api.ts instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // BLOCK D: Test fixtures override. Canary fixtures under
    // tests/fixtures/bad-imports/ INTENTIONALLY violate the import-x rules;
    // the canary test (Plan 05) spawns eslint manually on them, so normal CI
    // lint must skip them.
    ignores: ["tests/fixtures/bad-imports/**"],
  },
  {
    // Tests deliberately do defensive checking after operations that "should"
    // have populated state, and `node:test`'s `test(...)` returns an unawaited
    // promise by design. Relax the rules that fight that style.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/dot-notation": "off",
      "no-restricted-syntax": "off",
      "no-console": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-inverted-boolean-check": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
    },
  },
  {
    // The eslint config file itself does not need type-aware linting.
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Phase 14 (D-14-10 / RESEARCH.md Pitfall 2): the local MSG-* ESLint
    // plugin under `tests/lint-rules/` is test-infrastructure code -- it is
    // consumed by ESLint at lint time, not by the TypeScript compiler, and
    // is intentionally outside `tsconfig.json`'s include glob. The main
    // config block (above) enables `parserOptions.projectService: true`,
    // which would otherwise refuse these files with a "not in tsconfig"
    // error. Mirror the existing `eslint.config.js` self-override.
    files: ["tests/lint-rules/**/*.{js,ts}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Phase 14 (Plan 14-03 Task 2): relax the project's explicit-boundary
    // rule for the local plugin tree. ESLint plugin rule files use JSDoc
    // type annotations for AST visitors rather than TS explicit boundaries,
    // and the YAML loader is a plain ESM module consumed only by other
    // rule files. Aligns with the existing `tests/**/*.ts` override that
    // relaxes type-aware rules for test-suite code.
    //
    // Phase 14 (Plan 14-04 deviation -- Rule 3 auto-fix): the 16
    // meta-assertion rules in this directory intentionally implement a
    // no-op `Program: () => {}` visitor per RESEARCH.md Pitfall 8 (the
    // rules cite a structural enforcement mechanism in `meta.docs`; the
    // AST visitor exists only to silence the "rule has no selectors"
    // typescript-eslint nag). `@typescript-eslint/no-empty-function`
    // would otherwise flag every Program method, so disable it for this
    // tree.
    files: ["tests/lint-rules/**/*.{js,ts}"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
);
