import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * D-11: the plugin and marketplace ledger entry points, as BLOCK C zone paths.
 * A ledger owns a transactional verb end to end. Their `*-probe`, `*-swap`,
 * `*-record`, `*-row`, and `*-outcome` siblings are helpers and leaf
 * composers, and `orchestrators/plugin/bootstrap.ts` is a composer whose job
 * is calling marketplace verbs, so none of them is listed.
 */
const PLUGIN_LEDGERS = [
  "./extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
];

const MARKETPLACE_LEDGERS = [
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts",
];

/**
 * NFR-5 / PI-2 / PL-3 / PRL-07: the orchestrators/ and domain/ modules that
 * BLOCK F skips, because each one must name the git surface itself. BLOCK F
 * is default-deny, so a new module in either directory is gated from its
 * first commit. A module stays off this list when it reaches git through
 * orchestrators/plugin/clone-cache.ts by entrypoint name, or through an
 * injected field whose name the gate does not match. Add a file here only
 * when neither works, with a one-line reason.
 *
 * The rule lives in ESLint because fallow cannot express it: a rule pack's
 * banned-import rule matches whole raw specifiers without globs, no
 * rule-pack kind bans an identifier or a string, and fallow's boundary zones
 * are directory-scoped.
 */
const NETWORK_SEAMS = [
  // D-79-04: a provider maps a token to the type-only GitCredentials shape.
  "extensions/pi-claude-marketplace/domain/auth-registry.ts",
  // D-32-01: the Device Flow engine types its credentials from platform/git.
  "extensions/pi-claude-marketplace/domain/github-auth.ts",
  // D-79-05: builds the host-keyed credential bundle from platform/git-credential.ts.
  "extensions/pi-claude-marketplace/orchestrators/auth-host.ts",
  // Passes the injected gitOps seam to the marketplace adds an import performs.
  "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
  // NFR-5: adding a git-source marketplace clones it.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  // D-12 / D-13: owns GitOps, DEFAULT_GIT_OPS, and refreshGitHubClone.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts",
  // NFR-5: updating a git-source marketplace refreshes its clone.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
  // A composer that hands gitOps to the marketplace add it calls.
  "extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts",
  // PURL-02 / PURL-04: clones a git-source plugin on a cache miss.
  "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts",
  // D-03-03: lists a constrained dependency's remote tags.
  "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts",
  // RESV-01: the type-only RemoteTag that the cascade's tag probe returns.
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts",
  // TAGS-01: reads the marketplace clone's local tags with listTags and resolveTagOid.
  "extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts",
  // D-10-19: the type-only RemoteTag of the constraint gate's tag query.
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts",
  // PUP-2: syncClone needs gitOps.
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts",
  // PUP-2: the preflight threads gitOps and the type-only RemoteTag.
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts",
  // RECON-01: passes the injected gitOps seam to the marketplace adds reconcile performs.
  "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts",
  // DIFF-01: declares the optional gitOps seam that apply.ts passes on.
  "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts",
];

const NETWORK_FREE_SYNTAX_SELECTORS = [
  {
    selector: "ImportExpression[source.value=/platform\\/git/]",
    message: "NFR-5: network-free modules must not dynamically import a platform/git module.",
  },
  {
    selector: "TSImportType Literal[value=/platform\\/git/]",
    message: "NFR-5: network-free modules must not name a platform/git type through import().",
  },
  {
    selector:
      ":matches(Identifier, PrivateIdentifier)[name=/^(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)$/]",
    message:
      "NFR-5: network-free modules must not name gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone. Only the NETWORK_SEAMS files in eslint.config.js may name the git seam.",
  },
  {
    selector: "Literal[value=/\\b(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)\\b/]",
    message:
      "NFR-5: network-free modules must not spell gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone in a string.",
  },
  {
    selector: "TemplateElement[value.raw=/\\b(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)\\b/]",
    message:
      "NFR-5: network-free modules must not spell gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone in a string.",
  },
];

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
      "tests/live-uat/",
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
      // A switch over a union either lists every member and has no `default`,
      // or lists some and has one. The `default` never counts as covering the
      // union, so a member added later is a lint error at every switch that
      // omits it; a `default: assertNever(...)` arm on a complete switch is
      // unreachable and is an error too.
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
        },
      ],
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
    // IL-2 / IL-3 / OBS-01: the fallow rule pack (rule-packs/architecture.json)
    // owns console discipline in the extension. It bans every console call
    // except the console.warn in persistence/migrate.ts and the console.error
    // in shared/debug-log.ts, and it holds each of those files to that one
    // method. The base no-console warning would flag both sanctioned calls.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // BLOCK C (D-11): Import-direction enforcement. The first eight zones map
    // each layer folder to the sibling folders that MUST NOT import from it
    // (i.e. they enforce the upward/inward direction of the dep graph). The
    // last four keep the ledger modules apart, type-only and dynamic imports
    // included: no orchestrators/marketplace/ file imports a plugin ledger, no
    // plugin ledger imports a marketplace ledger, and no ledger imports another
    // ledger of its own kind. Cycle detection reports a cycle only once the
    // graph is already circular, so these zones stop the first edge.
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
            {
              target: "./extensions/pi-claude-marketplace/orchestrators/marketplace",
              from: PLUGIN_LEDGERS,
              message:
                "D-11: orchestrators/marketplace/ must not import a plugin ledger module. Import the leaf row composer (plugin/update-row.ts), a shared type from orchestrators/types.ts, or the injected pluginUpdate seam instead.",
            },
            {
              target: PLUGIN_LEDGERS,
              from: MARKETPLACE_LEDGERS,
              message:
                "D-11: a plugin ledger must not import a marketplace ledger module. Only orchestrators/marketplace/shared.ts is reachable from a plugin ledger.",
            },
            {
              target: PLUGIN_LEDGERS,
              from: PLUGIN_LEDGERS,
              message: "D-11: plugin ledger modules must not import each other.",
            },
            {
              target: MARKETPLACE_LEDGERS,
              from: MARKETPLACE_LEDGERS,
              message: "D-11: marketplace ledger modules must not import each other.",
            },
          ],
        },
      ],
    },
  },
  {
    // BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07): default-deny. Every orchestrators/
    // and domain/ module outside NETWORK_SEAMS names no git surface: no
    // platform/git import of any kind (type-only and dynamic included) and no
    // gitOps / DEFAULT_GIT_OPS / refreshGitHubClone identifier, key, or string.
    // edge/ and index.ts are outside the rule. No other block sets either rule
    // for extension files. A block that did would replace these options for
    // every file that both blocks match.
    files: [
      "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
      "extensions/pi-claude-marketplace/domain/**/*.ts",
    ],
    ignores: NETWORK_SEAMS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "platform/git",
              message:
                "NFR-5: network-free modules must not import a platform/git module, type-only imports included. Reach git through orchestrators/plugin/clone-cache.ts by entrypoint name.",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...NETWORK_FREE_SYNTAX_SELECTORS],
    },
  },
  {
    // Sonar way, enforced locally. `sonarjs.configs.recommended` is the
    // plugin's port of the Sonar way profile: 217 rules at "error" and the
    // other 62 off. 200 of those 217 are active in the TypeScript Sonar way
    // profile SonarCloud runs against this project, so a violation caught
    // here is one the pull-request gate would have reported -- found before
    // the push rather than after it.
    //
    // Scoped to mirror `sonar.sources` in sonar-project.properties.
    // `sonar.test.exclusions` drops tests/**, so SonarCloud never reads the
    // test tree. Tests opt into the three assertion rules below. The full
    // preset conflicts with compiler proofs, strict mocks, and fixture data;
    // SWTEST-01 records the measured per-cluster policy.
    //
    // The rules are SPREAD rather than the config being extended, for two
    // reasons. `recommended` re-declares the `sonarjs` plugin this file
    // already declares above, and ESLint 10 refuses that ("Cannot redefine
    // plugin"). It also carries no `files` key, so as a config entry it
    // would apply to every file ESLint touches.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Re-asserted after the spread because `recommended` sets a bare
      // "error" here, which drops the threshold. The plugin's own default
      // is 15 and Sonar way runs S3776 at 15, so nothing changes today --
      // but the number is also paired with fallow's `health.maxCognitive`,
      // and leaning on a default makes that agreement implicit.
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  {
    // The local equivalent of typescript:S107 (too many parameters).
    // `eslint-plugin-sonarjs` ships no implementation of S107 at any
    // severity, so the Sonar way spread above does not carry it and the
    // finding could only ever surface on a pull request.
    //
    // 7 is Sonar's own maximum for S107, so the two gates agree by
    // construction rather than by coincidence.
    //
    // Scoped to mirror `sonar.sources`, like the block above. SonarCloud
    // drops tests/** via `sonar.test.exclusions`, so enforcing there would
    // gate code Sonar never grades.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "@typescript-eslint/max-params": ["error", { max: 7 }],
    },
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
      // Tests use `void (expr satisfies T);` as a compile-time-only proof
      // that a value shape matches a type, with no runtime effect intended.
      // `no-unused-expressions` doesn't unwrap `TSSatisfiesExpression` the
      // way it unwraps `as`, so the bare expression alone is already legal
      // there -- `void` is what stops it being reported here instead, since
      // typescript-eslint 8.69 tightened `no-meaningless-void-operator` to
      // flag voiding any non-call expression, which now fires on every one
      // of these proof statements.
      "@typescript-eslint/no-meaningless-void-operator": "off",
      "no-restricted-syntax": "off",
      "no-console": "off",
      // Assertion checks also apply to test support that registers node:test cases.
      "sonarjs/assertions-in-tests": "error",
      "sonarjs/no-empty-test-file": "error",
      "sonarjs/no-trivial-assertions": "error",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-inverted-boolean-check": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
    },
  },
  {
    // These ten owners prove erased types with satisfies and @ts-expect-error.
    // Runtime assertions would not test their contract; neighboring runtime owners
    // retain no-empty-test-file. Keep this list exact rather than exempting types.*.
    // `exec-result.test.ts` qualifies on the same ground as the rest: its whole
    // contract is compile-time, and the shared `assertNever` owner carries the
    // runtime cases for that concern.
    files: [
      "tests/bridges/agents/types.test.ts",
      "tests/bridges/commands/types.test.ts",
      "tests/bridges/hooks/exec-result.test.ts",
      "tests/bridges/mcp/types.test.ts",
      "tests/bridges/skills/types.test.ts",
      "tests/bridges/workflows/types.test.ts",
      "tests/domain/resolver-types.test.ts",
      "tests/edge/types.test.ts",
      "tests/orchestrators/import/types.test.ts",
      "tests/orchestrators/types.test.ts",
    ],
    rules: { "sonarjs/no-empty-test-file": "off" },
  },
  {
    // The eslint config file itself does not need type-aware linting.
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // The repository gate scripts.
    files: ["scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@stylistic": stylistic,
      "import-x": importX,
      sonarjs,
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
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
      // `process.stdout.write` is how a command-line gate reports its verdict.
      // The IL-2 ban on it is scoped to extensions/**, which these are not.
      "no-restricted-syntax": "off",
    },
  },
);
