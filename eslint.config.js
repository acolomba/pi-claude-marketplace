import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".claude/", "build/", "coverage/", "dist/", "node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{js,ts}"],
    plugins: {
      "@stylistic": stylistic,
      "import-x": importX,
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
    files: ["extensions/claude-marketplace/**/*.ts"],
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
    files: ["extensions/claude-marketplace/shared/notify.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
  {
    // BLOCK C (D-11): Import-direction enforcement. 9-zone no-restricted-paths
    // mapping: each folder declares which sibling folders MUST NOT import from
    // it (i.e. enforces the upward/inward direction of the dep graph).
    files: ["extensions/claude-marketplace/**/*.ts"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: "./extensions/claude-marketplace/edge",
              from: [
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/domain",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/persistence",
                "./extensions/claude-marketplace/platform",
              ],
              message: "edge/ may only import from orchestrators/, presentation/, shared/.",
            },
            {
              target: "./extensions/claude-marketplace/orchestrators",
              from: ["./extensions/claude-marketplace/edge"],
              message: "orchestrators/ MUST NOT import from edge/.",
            },
            {
              target: "./extensions/claude-marketplace/bridges",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/presentation",
                "./extensions/claude-marketplace/platform",
              ],
              message:
                "bridges/ may only import from domain/, persistence/, shared/. Cross-bridge imports are also forbidden.",
            },
            {
              target: "./extensions/claude-marketplace/domain",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/persistence",
                "./extensions/claude-marketplace/presentation",
                "./extensions/claude-marketplace/platform",
              ],
              message:
                "domain/ MUST NOT import upward -- pure logic only. shared/ is the only sibling import allowed.",
            },
            {
              target: "./extensions/claude-marketplace/transaction",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/domain",
                "./extensions/claude-marketplace/presentation",
                "./extensions/claude-marketplace/platform",
              ],
              message: "transaction/ may only import from persistence/, shared/.",
            },
            {
              target: "./extensions/claude-marketplace/persistence",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/presentation",
                "./extensions/claude-marketplace/platform",
              ],
              message: "persistence/ may only import from domain/, shared/.",
            },
            {
              target: "./extensions/claude-marketplace/presentation",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/persistence",
                "./extensions/claude-marketplace/platform",
              ],
              message: "presentation/ may only import from domain/, shared/.",
            },
            {
              target: "./extensions/claude-marketplace/platform",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/domain",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/persistence",
                "./extensions/claude-marketplace/presentation",
              ],
              message:
                "platform/ may only import from shared/. It's the external-system boundary (git, Pi API surface).",
            },
            {
              target: "./extensions/claude-marketplace/shared",
              from: [
                "./extensions/claude-marketplace/edge",
                "./extensions/claude-marketplace/orchestrators",
                "./extensions/claude-marketplace/bridges",
                "./extensions/claude-marketplace/domain",
                "./extensions/claude-marketplace/transaction",
                "./extensions/claude-marketplace/persistence",
                "./extensions/claude-marketplace/presentation",
                "./extensions/claude-marketplace/platform",
              ],
              message: "shared/ MUST NOT import from any extension folder. Pure leaves only.",
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
    },
  },
  {
    // The eslint config file itself does not need type-aware linting.
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
