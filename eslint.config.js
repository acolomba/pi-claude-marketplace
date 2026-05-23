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
    // BLOCK E (Phase 7 D-04 + Phase 13 D-13-09): Two `no-restricted-imports`
    // gates merged for extension files (split between two blocks to keep test
    // files exempt from Gate 1 -- tests legitimately mock the Pi API via
    // direct imports). Gate 1's extension-only scope is unchanged; Gate 2
    // also covers tests via BLOCK E-2 below (this block).
    //
    // Per RESEARCH.md PITFALL 2: when two flat-config blocks target the same
    // file with the same rule, the later block's paths[] REPLACES the earlier
    // (not merges). BLOCK E (this) and BLOCK E-2 (below) have DISJOINT files
    // patterns (extensions/** vs tests/**) so no overlap occurs.
    //
    // Gate 1 (Phase 7 D-04): direct Pi peer imports are allowed only in
    // platform/pi-api.ts. All other extension code imports Pi API types from
    // the wrapper so peer-dependency version bumps have a single audit point.
    //
    // Gate 2 (Phase 13 D-13-09): the 5 legacy ES-5 marker exports from
    // shared/markers.ts cannot be imported from any callsite except the
    // canonical allow-list. The Wave 3 atomic commit deletes those exports
    // entirely (markers.ts + markers-snapshot.test.ts + PRD §6.12). Sub-waves
    // 2a-2d migrate the legacy callsites listed in the per-file ignores;
    // those file entries are removed alongside the Wave 3 export deletion.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: [
      // Gate 1 allow-list (Phase 7 D-04): the Pi-API wrapper module.
      "extensions/pi-claude-marketplace/platform/pi-api.ts",
      // Gate 2 allow-list (Phase 13 D-13-09): canonical extension source.
      "extensions/pi-claude-marketplace/shared/markers.ts",
      // Gate 2 temporary allow-list (Phase 13 Wave 2 sub-wave migration TODO):
      // these production callsites still import legacy ES-5 markers today.
      // Wave 2 sub-waves migrate them to the new presentation/ composers; the
      // Wave 3 atomic commit removes these entries alongside the markers.ts
      // export deletion.
      //   - bridges/{agents,skills,commands}/stage.ts: MANUAL_RECOVERY_REQUIRED
      //     leaks-on-rollback Error message (Wave 2 sub-wave 2b)
      //   - orchestrators/plugin/reinstall.ts: MANUAL_RECOVERY_REQUIRED
      //     leak-aggregation wrapper (Wave 2 sub-wave 2a)
      //   - transaction/rollback.ts: ROLLBACK_PARTIAL marker chokepoint
      //     (Wave 2 sub-wave 2a uses presentation/rollback-partial.ts)
      "extensions/pi-claude-marketplace/bridges/agents/stage.ts",
      "extensions/pi-claude-marketplace/bridges/skills/stage.ts",
      "extensions/pi-claude-marketplace/bridges/commands/stage.ts",
      "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
      "extensions/pi-claude-marketplace/transaction/rollback.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            // Gate 1 (Phase 7 D-04): Pi peer import chokepoint.
            {
              name: "@earendil-works/pi-coding-agent",
              message:
                "Import Pi API types from extensions/pi-claude-marketplace/platform/pi-api.ts instead.",
            },
            // Gate 2 (Phase 13 D-13-09): the 5 legacy ES-5 marker names are
            // import-forbidden during Wave 2; use the new presentation/
            // composers (renderRow, renderManualRecovery, renderRollbackPartial,
            // appendReloadHint). The Wave 3 atomic commit deletes these
            // exports. Three relative-path variants cover every callsite in
            // the codebase (paths[].name is exact-string match).
            {
              name: "../shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message:
                "Legacy ES-5 marker strings are import-forbidden during Wave 2 (D-13-09); use the new presentation/ composers. The Wave 3 atomic commit deletes these exports.",
            },
            {
              name: "../../shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message: "Legacy ES-5 markers (D-13-09); use the new presentation/ composers.",
            },
            {
              name: "../../extensions/pi-claude-marketplace/shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message:
                "Legacy ES-5 markers (D-13-09); allow-listed only in markers-snapshot.test.ts and no-legacy-markers.test.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    // BLOCK E-2 (Phase 13 D-13-09): Gate 2 (legacy ES-5 marker import
    // restriction) applied to tests/**/*.ts. Tests do NOT inherit Gate 1
    // (Pi peer-import restriction) because tests legitimately import
    // @earendil-works/pi-coding-agent for mocking the Pi API surface.
    //
    // Per RESEARCH.md PITFALL 2: this block has DISJOINT files patterns from
    // BLOCK E above (tests/** vs extensions/**) so the per-rule paths[]
    // replacement-vs-merge concern does not apply.
    files: ["tests/**/*.ts"],
    ignores: [
      // Gate 2 allow-list (Phase 13 D-13-09): canonical test sources.
      "tests/architecture/markers-snapshot.test.ts",
      "tests/architecture/no-legacy-markers.test.ts",
      // Gate 2 temporary allow-list (Phase 13 Wave 2 sub-wave migration TODO):
      // these contract-assertion tests still import legacy ES-5 markers today.
      // Wave 2 sub-waves migrate them; the Wave 3 atomic commit removes these
      // entries alongside the markers.ts export deletion.
      //   - tests/e2e/install-soft-deps.test.ts: PI_*_NOT_LOADED contract
      //     assertion (Wave 2 sub-wave 2b)
      //   - tests/platform/pi-api.test.ts: PI_*_NOT_LOADED contract assertion
      //     (Wave 2 sub-wave 2b finalization with platform/pi-api.ts deletion
      //     of subagentWarningIfNeeded / mcpAdapterWarningIfNeeded)
      //   - tests/presentation/soft-dep.test.ts: PI_*_NOT_LOADED contract
      //     assertion (Wave 2 sub-wave 2b)
      //   - tests/transaction/rollback.test.ts: ROLLBACK_PARTIAL contract
      //     assertion (Wave 2 sub-wave 2a)
      "tests/e2e/install-soft-deps.test.ts",
      "tests/platform/pi-api.test.ts",
      "tests/presentation/soft-dep.test.ts",
      "tests/transaction/rollback.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            // Gate 2 only (3 relative-path variants from tests/...).
            {
              name: "../shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message:
                "Legacy ES-5 markers (D-13-09); allow-listed only in markers-snapshot.test.ts and no-legacy-markers.test.ts.",
            },
            {
              name: "../../shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message: "Legacy ES-5 markers (D-13-09); use the new presentation/ composers.",
            },
            {
              name: "../../extensions/pi-claude-marketplace/shared/markers.ts",
              importNames: [
                "PI_SUBAGENTS_NOT_LOADED",
                "PI_MCP_ADAPTER_NOT_LOADED",
                "RELOAD_HINT_PREFIX",
                "MANUAL_RECOVERY_REQUIRED",
                "ROLLBACK_PARTIAL",
              ],
              message:
                "Legacy ES-5 markers (D-13-09); allow-listed only in markers-snapshot.test.ts and no-legacy-markers.test.ts.",
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
