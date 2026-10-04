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

// Options BLOCK A and BLOCK E apply to the whole extension. BLOCK F restates
// them for the network-free files, because a later block that sets a rule's
// options replaces the earlier options for the files it matches.
const OUTPUT_DISCIPLINE_SELECTORS = [
  {
    selector:
      "CallExpression[callee.object.object.name='process'][callee.object.property.name='stdout'][callee.property.name='write']",
    message:
      "Direct process.stdout.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers.",
  },
  {
    selector:
      "CallExpression[callee.object.object.name='process'][callee.object.property.name='stderr'][callee.property.name='write']",
    message:
      "Direct process.stderr.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers.",
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
    message:
      "console.log is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers.",
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='warn']",
    message:
      "console.warn is forbidden in the extension (IL-2) except at the single sanctioned migrateLegacyMarketplaceRecords callsite, which is allowed via a block-level files-override in this config.",
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
    message:
      "console.error is forbidden in the extension (IL-2). Use notify(ctx, pi, NotificationMessage) (failed status carries cause via per-plugin cause?: Error) from shared/notification-dispatch.ts.",
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='info']",
    message:
      "console.info is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers.",
  },
  {
    selector: "CallExpression[callee.property.name='notify'][callee.object.property.name='ui']",
    message:
      "Direct ctx.ui.notify is forbidden -- use notify(ctx, pi, NotificationMessage) or notifyUsageError(ctx, UsageErrorMessage) from shared/notification-dispatch.ts.",
  },
];

const PI_PEER_IMPORT_RESTRICTION = {
  name: "@earendil-works/pi-coding-agent",
  message: "Import Pi API types from extensions/pi-claude-marketplace/platform/pi-api.ts instead.",
};

/**
 * NFR-5 / PI-2 / PL-3 / PRL-07: every module that must name no git surface of
 * its own. BLOCK F applies to exactly these files. That is a narrower claim
 * than "performs no network operation", and the membership splits two ways.
 * Most targets are network-free by contract -- the read surfaces (`list`,
 * plugin `info`, marketplace `info`), the reconcile pending/planner/projection
 * family, both reinstall owners (cached manifests only), and the resolver, one
 * file OUTSIDE the orchestrator layer. The resolver inherits its obligation
 * from the two read surfaces it answers for. The others are MUTATING verbs
 * that do reach git -- `install-flow.ts` and `fetch.ts` materialize a clone on
 * a cache miss, and `enable-disable.ts` re-materializes through the install
 * ledger -- and they qualify because they reach it ONLY through the
 * `clone-cache.ts` seam, by entrypoint name.
 *
 * The rule is per file, which a fallow boundary zone cannot express:
 * `orchestrators` -> `platform` is a legal edge for `update-flow.ts`,
 * `clone-cache.ts`, and `auth-host.ts`, and fallow zones are directory-scoped.
 *
 * Exempt files (do NOT add):
 *   - `orchestrators/plugin/update-flow.ts` and `update-preflight.ts`: PUP-2
 *     `syncClone` REQUIRES gitOps; they legitimately name the `GitOps` surface
 *     via the `orchestrators/marketplace/shared.ts` re-export (Pattern S-9).
 */
const NETWORK_FREE_TARGETS = [
  // The update flow owns refresh enumeration and its injected Git seam, so it
  // remains the exact update exemption documented above and is not gated here.
  // NFR-5 (amended): both install owners carry ZERO git surface of their own. A
  // git-source (url / git-subdir / github) clone is delegated to the
  // install-clone-probe.ts leaf, which reaches the clone-cache.ts sibling seam
  // where the git surface legally lives. The flow composes the leaf and the
  // ledger invokes that injected operation; neither owner names `gitOps`.
  // The ledger reads the cached manifest with no
  // network sync of its own; the only network touch is the cache-miss clone
  // inside the seam. Keep both targets so splitting composition from the
  // ledger cannot weaken the original gate. operations.ts is the third install
  // owner: it binds the concrete runPhases and withLockedStateTransaction
  // wrappers around the semantic factory, so it is exactly where a direct git
  // import would land once composition moved out of the flow.
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts",
  // PL-3 + NFR-5: list is read-only against state + manifest; no network.
  // Every list owner is gated, not just the flow: candidate-row owns the
  // cold/warm `(remote)` vs `(available)` classification and installed-row
  // drives the upgrade probe, so both are the sites where a "refresh the
  // mirror" edit would land. Keep all four so splitting row composition and
  // orphan folding out of the flow cannot weaken the original gate.
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts",
  // PUP-2 + NFR-5: the update family splits its Git seam across exactly two
  // owners, so the other four are gated. update-swap.ts matters most: it
  // performs the physical replace inside the window where the old tree is
  // already gone, which is where a stray fetch would do the most damage.
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts",
  // PRL-07: the public reinstall flow uses cached manifests only -- which is
  // also why refreshGitHubClone is one of the gated patterns. The flow owner
  // contains the complete sequencing body, so this one target guards the full
  // operation without a retired compatibility path.
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  // INFO-02 + NFR-5: info is a read-only seam over the local state + on-disk
  // marketplace manifests; no network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
  // INFO-01 + NFR-5: marketplace info is read-only against local state +
  // marketplace.json; no network.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts",
  // ML-1..4 + NFR-5: marketplace list is read-only against state.json alone --
  // it reads no manifest and holds no clone. A future need to show a remote
  // freshness column must route through orchestrators/plugin/clone-cache.ts,
  // the seam where the git surface legally lives, never through a git import
  // here.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts",
  // MAU-1..5 + NFR-5: autoupdate rewrites config entries and state records; the
  // refresh it schedules is performed by the update verb, not by autoupdate
  // itself, so this owner is network-free by contract. A future need to probe a
  // remote before scheduling must route through
  // orchestrators/plugin/clone-cache.ts.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts",
  // MR-1..8 + NFR-5: remove unstages local artifacts and collects orphaned
  // clones through orchestrators/plugin/clone-gc.ts, which deletes directories
  // and never fetches. The file carries no NFR-5 header of its own, so this
  // entry is where the network-free-by-contract claim is recorded: a future
  // need to consult a remote before deleting must route through
  // orchestrators/plugin/clone-cache.ts.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts",
  // DIFF-01 SC #2: the reconcile pending/planner/projection
  // family is read-only and pure. pending.ts is the user-facing orchestrator;
  // plan.ts + notify.ts are belt-and-braces (plan.ts also has the stricter
  // reconcile-planner-purity gate -- this is cheap defensive cover).
  "extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts",
  // LOAD-01 / NFR-5 / WR-06: the satisfaction walk composes dependency-index.ts
  // -- already gated one group below -- and reads the memoized manifest cache
  // and the warm clone cache only. It sits on the load path, where a stray
  // fetch would make every session start wait on a remote, so the file that
  // claims the walk is offline carries the gate that pins it. A future need to
  // refresh a clone before deciding must route through
  // orchestrators/plugin/clone-cache.ts.
  "extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts",
  // ENBL-03: the enable/disable orchestrator re-materializes from cache
  // -- NO network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
  // NFR-5 / D-05-06 / PRUNE-05: uninstall composes an offline manifest read
  // through the declaration-index leaf before it decides anything -- the
  // dependents guard reads what every other record in the scope declares from
  // the memoized manifest cache and the warm clone cache only. Neither owner
  // names a git surface; a future need to refresh a clone before deciding must
  // route through orchestrators/plugin/clone-cache.ts.
  "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts",
  // FTCH-01: fetch reaches git ONLY through the clone-cache.ts seam (by
  // entrypoint name), install-style. It names zero gitOps surface, so it is
  // locked here permanently. It is NOT exempt: among the gated orchestrator
  // candidates, update-flow.ts is the only file allowed the gitOps surface (seam
  // files such as clone-cache.ts sit outside this gate's candidate set).
  "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts",
  // NFR-5 / OUT-05: the resolver now answers a question for `list` and `info`,
  // two surfaces that are network-free by contract, so the file that answers it
  // inherits their obligation. It carries no git surface today, which is exactly
  // why the gate is cheap here -- it is defense in depth, and it is the
  // STRUCTURAL half of the network-free guarantee. The behavioral half can only
  // show that no call happened on the paths a test exercises; it can never show
  // the surface is absent.
  "extensions/pi-claude-marketplace/domain/plugin-resolver.ts",
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
      "NFR-5: network-free modules must not name gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone. Only update-flow.ts and update-preflight.ts may name the git seam.",
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
    // BLOCK A (D-06 / IL-2 / IL-3): Output discipline scoped to the extension.
    // Direct stdout/stderr writes and console.* calls are forbidden in the
    // extension. Sanctioned exception: load-time migrate-record save failure
    // in `migrateLegacyMarketplaceRecords` (IL-3) -- allowed via the
    // block-level files-override for `persistence/migrate.ts` below (BLOCK
    // B-2). No inline `eslint-disable-next-line` directive is required.
    files: ["extensions/pi-claude-marketplace/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...OUTPUT_DISCIPLINE_SELECTORS],
      // Catches console.debug / console.trace / console.dir which the AST
      // selectors above don't enumerate.
      "no-console": "error",
    },
  },
  {
    // BLOCK B: Per-file override -- shared/notification-dispatch.ts IS the sanctioned
    // ctx.ui.notify call site, so its body must be allowed to call it.
    files: ["extensions/pi-claude-marketplace/shared/notification-dispatch.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
  {
    // Per-file override (OBS-01 / D-59-05) -- shared/debug-log.ts IS the
    // sole sanctioned runtime debug-output seam for the hooks dispatch
    // path, so its env-gated `console.error` call must be allowed. Mirrors
    // BLOCK B's authorization for shared/notification-dispatch.ts (sanctioned escape from
    // IL-2 / IL-3). Scope is the single literal file path so a glob-widening
    // drift surfaces in code review.
    files: ["extensions/pi-claude-marketplace/shared/debug-log.ts"],
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
          paths: [PI_PEER_IMPORT_RESTRICTION],
        },
      ],
    },
  },
  {
    // BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07): the modules in NETWORK_FREE_TARGETS
    // name no git surface: no platform/git import of any kind (type-only and
    // dynamic included) and no gitOps / DEFAULT_GIT_OPS / refreshGitHubClone
    // identifier, key, or string. Both rules restate the extension-wide options
    // of BLOCK A and BLOCK E, because a later block that sets a rule's options
    // replaces the earlier options for the files it matches.
    files: NETWORK_FREE_TARGETS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [PI_PEER_IMPORT_RESTRICTION],
          patterns: [
            {
              regex: "platform/git",
              message:
                "NFR-5: network-free modules must not import a platform/git module, type-only imports included. Reach git through orchestrators/plugin/clone-cache.ts by entrypoint name.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...OUTPUT_DISCIPLINE_SELECTORS,
        ...NETWORK_FREE_SYNTAX_SELECTORS,
      ],
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
