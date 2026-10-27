import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * D-v1.0-01-11: the plugin and marketplace ledger entry points, as BLOCK C zone paths.
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
 * D-PL9-10 / PKD-03: the only module that may import platform/package-manager.ts.
 * It is the network seam of a plugin's own package install. NETWORK_SEAMS names
 * the git surface and does not list it.
 */
const PACKAGE_INSTALL_SEAM =
  "./extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";

/**
 * NFR-5 / PI-2 / PL-3 / PRL-07: the orchestrators/ and domain/ modules that
 * BLOCK F skips, because each one must name the git surface, or the hosted
 * catalog download (D-PL5-07), itself. BLOCK F is default-deny, so a new
 * module in either directory is gated from its first commit. A module stays
 * off this list when it reaches git through
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
  // D-PL5-07: owns the hosted catalog port and its default download.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts",
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

// NFR-5 / D-PL5-07: the names of the git seam and of the hosted catalog
// download. A network-free module reaches neither through a name the gate
// does not match.
const NETWORK_SEAM_NAMES =
  "gitOps|DEFAULT_GIT_OPS|refreshGitHubClone|hostedManifestFetch|HostedManifestFetch|DEFAULT_HOSTED_MANIFEST_FETCH|downloadHostedCatalog|refreshHostedCatalog|fetchHostedManifest";

const NETWORK_FREE_SYNTAX_SELECTORS = [
  {
    selector: "ImportExpression[source.value=/platform\\/(?:git|hosted-manifest)/]",
    message:
      "NFR-5 / D-PL5-07: network-free modules must not dynamically import a platform/git or platform/hosted-manifest-fetch module.",
  },
  {
    selector: "TSImportType Literal[value=/platform\\/(?:git|hosted-manifest)/]",
    message:
      "NFR-5 / D-PL5-07: network-free modules must not name a platform/git or platform/hosted-manifest-fetch type through import().",
  },
  {
    selector: `:matches(Identifier, PrivateIdentifier)[name=/^(?:${NETWORK_SEAM_NAMES})$/]`,
    message:
      "NFR-5 / D-PL5-07: network-free modules must not name the git seam (gitOps, DEFAULT_GIT_OPS, refreshGitHubClone) or the hosted catalog download (hostedManifestFetch, HostedManifestFetch, DEFAULT_HOSTED_MANIFEST_FETCH, downloadHostedCatalog, refreshHostedCatalog, fetchHostedManifest). Only the NETWORK_SEAMS files in eslint.config.js may name them.",
  },
  {
    selector: `Literal[value=/\\b(?:${NETWORK_SEAM_NAMES})\\b/]`,
    message:
      "NFR-5 / D-PL5-07: network-free modules must not spell a git seam or hosted catalog download name in a string.",
  },
  {
    selector: `TemplateElement[value.raw=/\\b(?:${NETWORK_SEAM_NAMES})\\b/]`,
    message:
      "NFR-5 / D-PL5-07: network-free modules must not spell a git seam or hosted catalog download name in a string.",
  },
];

const GITHUB_LITERAL = /github\.com/i;

/**
 * GHB-02 / D-MF-01: a github.com URL belongs in shared/github-base-url.ts.
 * That module is the one place the clone-base override reads, so a github.com
 * literal anywhere else in the extension would send bytes or credentials
 * around the override. The rule reports string literals, template text after
 * escapes are resolved, and regular expression literals with their `\.`
 * escapes read as dots. Comments are not AST nodes, so a comment never
 * matches.
 */
const LOCAL_PLUGIN = {
  rules: {
    "no-github-literal": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          found:
            "GHB-02: a github.com literal belongs in shared/github-base-url.ts. Disable this line with a reason only at a parser host comparison, user-facing reason text, the github.com display string, or a Device Flow endpoint.",
        },
      },
      create(context) {
        return {
          Literal(node) {
            const text = typeof node.value === "string" ? node.value : node.regex?.pattern;
            if (text !== undefined && GITHUB_LITERAL.test(text.replaceAll("\\.", "."))) {
              context.report({ node, messageId: "found" });
            }
          },
          TemplateElement(node) {
            if (GITHUB_LITERAL.test(node.value.cooked ?? node.value.raw)) {
              context.report({ node, messageId: "found" });
            }
          },
        };
      },
    },
  },
};

const APPEND_ENTRY_SYNTAX_SELECTORS = [
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.computed=false][callee.property.name='appendEntry']",
    message: "JOUT-01: only shared/notification-dispatch.ts may call appendEntry.",
  },
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.value='appendEntry']",
    message: "JOUT-01: only shared/notification-dispatch.ts may call appendEntry.",
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
      "test/live-uat/",
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
      // The style rules the typescript-style skill relies on the toolchain for.
      eqeqeq: ["error", "smart"],
      "prefer-arrow-callback": "error",
      // Function declarations are hoisted, so a helper may follow its caller.
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false, classes: false, enums: false },
      ],
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-nested-conditional": "error",
      "sonarjs/no-nested-template-literals": "error",
      curly: ["error", "all"],
    },
  },
  {
    // The cucumber skill's steps.md: a step module exports nothing, and its step text is a
    // Cucumber expression written as a string literal, never a regular expression. A literal
    // is required so a pattern held in a variable cannot hide a regex. The text checks match
    // the callee by name, so a step module registers through `Given`, `When`, and `Then`
    // imported under their own names: no `defineStep`, no renamed import, and no namespace
    // import whose member calls the checks would miss. A local alias still escapes them, so
    // scripts/check-features.mjs also rejects every registered pattern that is not a Cucumber
    // expression. Hooks, parameter types, and the world belong to support modules (layout.md).
    files: ["features/step_definitions/**/*.steps.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@cucumber/cucumber",
              importNames: ["defineStep"],
              message: "A step module registers steps through Given, When, and Then.",
            },
            {
              name: "@cucumber/cucumber",
              importNames: [
                "Before",
                "After",
                "BeforeAll",
                "AfterAll",
                "BeforeStep",
                "AfterStep",
                "defineParameterType",
                "setWorldConstructor",
                "setDefaultTimeout",
                "setDefinitionFunctionWrapper",
                "setParallelCanAssign",
              ],
              message: "A step module registers steps only; support modules register the rest.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration, TSExportAssignment",
          message: "A step module exports nothing.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(Given|When|Then)$/][arguments.0.type!='Literal']",
          message: "Step text is a string literal Cucumber expression.",
        },
        {
          selector: "CallExpression[callee.name=/^(Given|When|Then)$/] > Literal.arguments[regex]",
          message: "Step text uses Cucumber expressions, never regular expressions.",
        },
        {
          selector:
            "ImportSpecifier[imported.name='Given'][local.name!='Given'], ImportSpecifier[imported.name='When'][local.name!='When'], ImportSpecifier[imported.name='Then'][local.name!='Then']",
          message: "Import Given, When, and Then under their own names.",
        },
        {
          selector:
            "ImportDeclaration[source.value='@cucumber/cucumber'] > :matches(ImportNamespaceSpecifier, ImportDefaultSpecifier)",
          message: "Import the Cucumber functions by name.",
        },
      ],
    },
  },
  {
    // The cucumber skill's layout.md: only step modules call Given, When, or Then.
    files: ["features/support/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@cucumber/cucumber",
              importNames: ["Given", "When", "Then", "defineStep"],
              message: "Only step modules register steps.",
            },
          ],
        },
      ],
    },
  },
  {
    // The cucumber skill's layout.md: a library module registers nothing. Only step modules
    // register steps and only support modules register hooks, parameter types, or the world.
    files: ["features/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@cucumber/cucumber",
              importNames: [
                "Given",
                "When",
                "Then",
                "Before",
                "After",
                "BeforeAll",
                "AfterAll",
                "BeforeStep",
                "AfterStep",
                "defineStep",
                "defineParameterType",
                "setWorldConstructor",
                "setDefaultTimeout",
                "setDefinitionFunctionWrapper",
                "setParallelCanAssign",
              ],
              message: "A library module registers nothing.",
            },
          ],
        },
      ],
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
    // BLOCK C (D-v1.0-01-11): Import-direction enforcement. The first eight zones map
    // each layer folder to the sibling folders that MUST NOT import from it
    // (i.e. they enforce the upward/inward direction of the dep graph). The
    // next four keep the ledger modules apart, type-only and dynamic imports
    // included: no orchestrators/marketplace/ file imports a plugin ledger, no
    // plugin ledger imports a marketplace ledger, and no ledger imports another
    // ledger of its own kind. Cycle detection reports a cycle only once the
    // graph is already circular, so these zones stop the first edge. The final
    // zone lets only PACKAGE_INSTALL_SEAM import platform/package-manager.ts.
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
                "D-v1.0-01-11: orchestrators/marketplace/ must not import a plugin ledger module. Import the leaf row composer (plugin/update-row.ts), a shared type from orchestrators/types.ts, or the injected pluginUpdate seam instead.",
            },
            {
              target: PLUGIN_LEDGERS,
              from: MARKETPLACE_LEDGERS,
              message:
                "D-v1.0-01-11: a plugin ledger must not import a marketplace ledger module. Only orchestrators/marketplace/shared.ts is reachable from a plugin ledger.",
            },
            {
              target: PLUGIN_LEDGERS,
              from: PLUGIN_LEDGERS,
              message: "D-v1.0-01-11: plugin ledger modules must not import each other.",
            },
            {
              target: MARKETPLACE_LEDGERS,
              from: MARKETPLACE_LEDGERS,
              message: "D-v1.0-01-11: marketplace ledger modules must not import each other.",
            },
            {
              target: "./extensions/pi-claude-marketplace/**/!(package-install).ts",
              from: ["./extensions/pi-claude-marketplace/platform/package-manager.ts"],
              message: `D-PL9-10: only ${PACKAGE_INSTALL_SEAM} imports platform/package-manager.ts, the spawn runner of a plugin's own package install.`,
            },
          ],
        },
      ],
    },
  },
  {
    // Optional calls share the same CallExpression/MemberExpression shape.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    ignores: ["extensions/pi-claude-marketplace/shared/notification-dispatch.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...APPEND_ENTRY_SYNTAX_SELECTORS],
    },
  },
  {
    // BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07): default-deny. Every orchestrators/
    // and domain/ module outside NETWORK_SEAMS names no git surface: no
    // platform/git or platform/hosted-manifest-fetch import of any kind
    // (type-only and dynamic included, D-PL5-07) and no NETWORK_SEAM_NAMES
    // identifier, key, or string: the git seam and the hosted catalog
    // download.
    // edge/ and index.ts are outside the network rule. Compose the append
    // restriction again: this block replaces the earlier syntax rule options.
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
            {
              regex: "platform/hosted-manifest",
              message:
                "NFR-5 / D-PL5-07: network-free modules must not import platform/hosted-manifest-fetch.ts, type-only imports included. Download a hosted catalog through the port in orchestrators/marketplace/hosted-catalog.ts.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...APPEND_ENTRY_SYNTAX_SELECTORS,
        ...NETWORK_FREE_SYNTAX_SELECTORS,
      ],
    },
  },
  {
    // GHB-02: a github.com literal outside the seam fails lint at its line.
    // A disable covers one line, so a new literal fails even in a file that
    // already carries disables. The rule has its own name because a
    // no-restricted-syntax disable would also mute the NFR-5 and JOUT-01
    // selectors on that line. A run over the real tree is the proof; no
    // planted violation is committed.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    plugins: { local: LOCAL_PLUGIN },
    rules: {
      "local/no-github-literal": "error",
    },
  },
  {
    // GHB-02: the seam holds the github.com origin. The rule is turned off
    // here rather than ignored above, so the plugin stays registered for this
    // file and a directive that names the rule still resolves.
    files: ["extensions/pi-claude-marketplace/shared/github-base-url.ts"],
    rules: {
      "local/no-github-literal": "off",
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
    // `sonar.test.exclusions` drops test/**, so SonarCloud never reads the
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
    // drops test/** via `sonar.test.exclusions`, so enforcing there would
    // gate code Sonar never grades.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "@typescript-eslint/max-params": ["error", { max: 7 }],
    },
  },
  {
    // The local equivalent of typescript:S9382 (promises awaited one at a
    // time in a loop). SonarCloud runs S9382 as core `no-await-in-loop`,
    // which `eslint-plugin-sonarjs` does not ship, so the Sonar way spread
    // above does not carry it.
    //
    // Scoped to mirror `sonar.sources`, like the blocks above. SonarCloud
    // drops test/** via `sonar.test.exclusions`.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "no-await-in-loop": "error",
    },
  },
  {
    // Tests deliberately do defensive checking after operations that "should"
    // have populated state, and `node:test`'s `test(...)` returns an unawaited
    // promise by design. Relax the rules that fight that style.
    files: ["test/**/*.ts"],
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
      "test/bridges/agents/types.test.ts",
      "test/bridges/commands/types.test.ts",
      "test/bridges/hooks/exec-result.test.ts",
      "test/bridges/mcp/types.test.ts",
      "test/bridges/skills/types.test.ts",
      "test/bridges/workflows/types.test.ts",
      "test/domain/resolver-types.test.ts",
      "test/edge/types.test.ts",
      "test/orchestrators/import/types.test.ts",
      "test/orchestrators/types.test.ts",
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
