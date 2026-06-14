import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

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
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
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
    // in `migrateLegacyMarketplaceRecords` (IL-3) -- allowed via the
    // block-level files-override for `persistence/migrate.ts` below (BLOCK
    // B-2). No inline `eslint-disable-next-line` directive is required.
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
            "console.warn is forbidden in the extension (IL-2) except at the single sanctioned migrateLegacyMarketplaceRecords callsite, which is allowed via a block-level files-override in this config.",
        },
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
          message:
            "console.error is forbidden in the extension (IL-2). Use notify(ctx, pi, NotificationMessage) (failed status carries cause via per-plugin cause?: Error) from shared/notify.ts.",
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
            "Direct ctx.ui.notify is forbidden -- use notify(ctx, pi, NotificationMessage) or notifyUsageError(ctx, UsageErrorMessage) from shared/notify.ts.",
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
  {
    // Per-file override -- migrate.ts emits the single sanctioned
    // legacy-migration console.warn (IL-3). That one callsite trips BOTH
    // rules: the explicit `console.warn` selector in `no-restricted-syntax`
    // AND the catch-all `no-console: error`, so both must be disabled for
    // this file (and only this file). No other console.warn is permitted in
    // the extension.
    files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"],
    rules: {
      "no-console": "off",
      "no-restricted-syntax": "off",
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
            // D-21-02 Phase 21: edge/ may now import domain/ directly; the
            // prior cross-zone re-export hack via the retired rendering
            // layer is gone.
            {
              target: "./extensions/pi-claude-marketplace/edge",
              from: [
                "./extensions/pi-claude-marketplace/bridges",
                "./extensions/pi-claude-marketplace/transaction",
                "./extensions/pi-claude-marketplace/persistence",
              ],
              message: "edge/ may only import from orchestrators/, domain/, shared/, platform/.",
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
              ],
              message: "persistence/ may only import from domain/, shared/, platform/.",
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
);
