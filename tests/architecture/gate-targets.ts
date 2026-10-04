/**
 * The architecture gates' target registry.
 *
 * D-07-05: a target group that more than one gate reads lives here. Each entry
 * is a FULL literal repository-relative path -- never a joined segment, never a
 * template -- so a search for a path finds every group that names it.
 *
 * GGAT-01: a gate that reports success over targets which stopped resolving is
 * worse than a missing gate, because it buys confidence it has not earned. The
 * groups here are the "declared" half of that obligation; `ScanReport.visited`
 * (`tests/architecture/source-scan.ts`) is the "actually opened" half, and each
 * gate deep-compares the two.
 *
 * This file registers no case of its own.
 */

/**
 * Directory roots the gates walk rather than name file by file.
 *
 * D-07-05 covers a directory the same way it covers a file: a gate that
 * re-spells `extensions/pi-claude-marketplace` locally defeats the single scan
 * point exactly as a re-spelled module path does, and a walk rooted at a
 * directory that stopped existing enumerates nothing without raising. Membership
 * means "some gate opens this directory and treats what it finds as its target
 * set".
 */
export const DIRECTORY_ROOT_TARGETS = [
  "extensions/pi-claude-marketplace",
  "extensions/pi-claude-marketplace/orchestrators",
  "extensions/pi-claude-marketplace/orchestrators/plugin",
  "extensions/pi-claude-marketplace/bridges/hooks",
  "extensions/pi-claude-marketplace/edge/handlers/plugin",
  "tests/architecture",
] as const;

/** The extension tree. Root of the vocabulary, shell-out, and seam walks. */
export const EXTENSION_ROOT_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] =
  "extensions/pi-claude-marketplace";

/** The orchestrator layer. Root of the cast-read walk. */
export const ORCHESTRATORS_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators";

/** The plugin orchestrators. The four lifecycle owners live directly inside it. */
export const PLUGIN_ORCHESTRATORS_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/plugin";

/** The hooks bridge. Root of the dispatch and async-rewake surfaces. */
export const HOOKS_BRIDGE_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] =
  "extensions/pi-claude-marketplace/bridges/hooks";

/** SURF-03: the plugin edge handlers, where the scope-fence surface lives. */
export const PLUGIN_EDGE_HANDLERS_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] =
  "extensions/pi-claude-marketplace/edge/handlers/plugin";

/** The gate corpus itself, walked by the vocabulary guard and the registry gate. */
export const ARCHITECTURE_DIR_REL: (typeof DIRECTORY_ROOT_TARGETS)[number] = "tests/architecture";

/**
 * Repository-root manifests and configs the gates read as data.
 *
 * These are not extension modules, but they are targets in the same sense: a
 * gate that cannot open one inspects nothing, and the path is as liable to move
 * as any other. `eslint.config.js` in particular is read by two gates that
 * resolve rule state out of it.
 */
export const REPO_MANIFEST_TARGETS = [
  "package.json",
  "package-lock.json",
  "eslint.config.js",
] as const;

/** The package manifest: version sync, peer floor, telemetry ban, unit-suite glob. */
export const PACKAGE_JSON_REL: (typeof REPO_MANIFEST_TARGETS)[number] = "package.json";

/** The lockfile, read alongside the manifest by the peer-floor gate. */
export const PACKAGE_LOCK_REL: (typeof REPO_MANIFEST_TARGETS)[number] = "package-lock.json";

/** The flat ESLint config, the source of the zone matrix and the no-console cascade. */
export const ESLINT_CONFIG_REL: (typeof REPO_MANIFEST_TARGETS)[number] = "eslint.config.js";

/**
 * OBS-01 / IL-2 / IL-3: the complete set of extension modules allowed a
 * `no-console` exemption.
 *
 * Membership is a closed obligation, not a convenience list -- the claim is that
 * these three files and no others may write to the console, so the set has to be
 * complete for a sweep over it to mean anything. `migrate.ts` carries the
 * sanctioned load-time legacy-migration warning; `debug-log.ts` is the debug
 * trace channel; `notification-dispatch.ts` is the sole sanctioned user-visible
 * output surface.
 */
export const NO_CONSOLE_EXEMPT_TARGETS = [
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
  "extensions/pi-claude-marketplace/shared/debug-log.ts",
  "extensions/pi-claude-marketplace/shared/notification-dispatch.ts",
] as const;

/**
 * D-11: one real module per layer zone folder, in BLOCK C zone order.
 *
 * A zone matrix is resolved per FILE, not per folder, so proving the matrix
 * applies needs a file inside each zone that actually exists. These are chosen
 * for being long-lived owners of their layer rather than for anything they
 * contain; the gate only ever asks the config resolver what rules reach them.
 */
export const ZONE_REPRESENTATIVE_TARGETS = [
  "extensions/pi-claude-marketplace/edge/router.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin-path.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts",
  "extensions/pi-claude-marketplace/domain/manifest.ts",
  "extensions/pi-claude-marketplace/transaction/phase-ledger.ts",
  "extensions/pi-claude-marketplace/persistence/locations.ts",
  "extensions/pi-claude-marketplace/platform/git.ts",
  "extensions/pi-claude-marketplace/shared/path-safety.ts",
] as const;

/**
 * D-11: the four marketplace ledger entry points. BLOCK C in `eslint.config.js`
 * keeps the ledgers from importing each other; a plugin ledger reaches
 * marketplace code only through `orchestrators/marketplace/shared.ts`.
 */
export const MARKETPLACE_LEDGER_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts",
] as const;

/**
 * WR-01 / WR-03 / D-60-05: the four lifecycle verbs that must emit a hooks
 * re-materialization signal, plus the event router where the WR-01 prefix that
 * signal carries is defined.
 *
 * The router belongs in the same group because the obligation is a relationship
 * between the two sides: a verb emitting a prefix the router no longer knows is
 * the failure this set is scanned for, and a group holding only one side cannot
 * express it.
 */
export const HOOKS_LIFECYCLE_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts",
] as const;

/**
 * D-75-01: the non-extension documents the retired-vocabulary absence sweep
 * covers.
 *
 * The extension tree is walked from `EXTENSION_ROOT_REL`; these are the files
 * outside it that publish the same vocabulary to a reader, so a token retired in
 * code but surviving in the catalog, the style guide, or the PRD is still live as
 * far as anyone reading them is concerned. The catalog-contract case is included
 * for the same reason: it asserts the catalog's own shape.
 */
export const VOCABULARY_GUARD_DOC_TARGETS = [
  "docs/output-catalog.md",
  "docs/messaging-style-guide.md",
  "docs/prd/pi-claude-marketplace-prd.md",
  "tests/architecture/catalog-uat/catalog-contract.test.ts",
] as const;

/**
 * COMPAT-01 / D-98-08: the grammar owner and the catalog it must not outgrow.
 *
 * The output catalog is also named by `VOCABULARY_GUARD_DOC_TARGETS`; two groups
 * naming one path is deliberate and legal, because the two obligations are
 * different and either could be retired without the other.
 */
export const COMPAT_NO_EXPANSION_TARGETS = [
  "extensions/pi-claude-marketplace/shared/notification-grammar.ts",
  "docs/output-catalog.md",
] as const;

/**
 * NFR-10 / SPLIT-02: the only modules allowed to write state and config directly.
 *
 * Every other module reaches persisted state through them, which is what makes
 * the atomic-write and containment guarantees checkable in three files instead of
 * across the tree.
 */
export const STATE_WRITE_SEAM_TARGETS = [
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
  "extensions/pi-claude-marketplace/persistence/config-io.ts",
] as const;

/**
 * ENBL-05: the disabled-state predicate's definition site followed by every
 * module that classifies on it.
 *
 * Order carries meaning here -- the first entry defines the rule and the rest
 * consume it, so a consumer that starts re-deriving the classification inline is
 * what the scan over this set looks for.
 */
export const DISABLED_STATE_TARGETS = [
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
  // LOAD-01: the load-time satisfaction verdict classifies a declared
  // dependency as unsatisfied when its own record is disabled, so it consumes
  // the predicate exactly as the planner beside it does.
  "extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts",
] as const;

/**
 * INV-01 / BOUND-02 / BOUND-03 / INFO-09 / INFO-10 / D-99: the manifest-lookup
 * rule's definition site followed by every surface that must resolve a manifest
 * entry through it rather than re-implementing the lookup.
 */
export const MANIFEST_LOOKUP_TARGETS = [
  "extensions/pi-claude-marketplace/domain/manifest-lookup.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts",
  "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts",
] as const;

/**
 * AUTH-09: every module that handles a credential, a token, or the state that
 * could carry one.
 *
 * The persistence and transaction entries are here because a credential leaks
 * just as completely by being written to `state.json` as by being logged, so the
 * files that own those writes carry the same obligation as the ones that hold the
 * secret.
 */
export const CREDENTIAL_LEAK_TARGETS = [
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
  "extensions/pi-claude-marketplace/transaction/with-state-guard.ts",
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
  "extensions/pi-claude-marketplace/domain/github-auth.ts",
  "extensions/pi-claude-marketplace/platform/git.ts",
  "extensions/pi-claude-marketplace/domain/auth-registry.ts",
  "extensions/pi-claude-marketplace/orchestrators/auth-host.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
  // AUTH-09: buildAuthCallbacks and its three hookDebugLog calls moved out of
  // platform/git.ts into this module. The scan aimed at git.ts kept passing
  // over a file with nothing left to catch, so the credential-adjacent logging
  // was covered by nothing. Appended last so no existing positional binding in
  // no-credential-leak.test.ts is re-aimed.
  "extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts",
] as const;

/**
 * HOOK-03 / D-57-01: the hooks schema module, which must keep rejecting
 * additional properties so an unrecognised hook key fails loudly instead of
 * being silently accepted and ignored.
 */
export const HOOKS_SCHEMA_TARGETS = [
  "extensions/pi-claude-marketplace/domain/components/hooks.ts",
] as const;

/**
 * TAGS-01 / D-07-05: the local, network-free marketplace-tag probe and the
 * shared release-tag selection module its offline gate pins the exact
 * `platform/git.ts` (and `platform/`) import surface of.
 */
export const MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts",
  "extensions/pi-claude-marketplace/domain/release-tag.ts",
] as const;

/**
 * DFEN-04 / DFEN-05 / DFEN-07 / D-103-08 / D-103-09: the lifecycle verbs that
 * must not read a default-enabled fallback.
 *
 * Enablement is a recorded fact; a verb that falls back to a default when the
 * record is absent invents user intent, which is the failure this set is scanned
 * for.
 */
export const LIFECYCLE_ENABLED_READ_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
] as const;

/**
 * AUTH-06 / AUTH-08 / D-21: the complete set of modules allowed to spawn a
 * subprocess.
 *
 * Closed, like the console exemption: the claim is that these three and no others
 * shell out, so the value of a sweep depends on the set being exhaustive.
 * `git-credential.ts` runs the credential helper; the two hooks modules execute
 * user-declared hook commands, which is their entire purpose.
 */
export const SHELL_OUT_EXEMPT_TARGETS = [
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
] as const;

/**
 * DIFF-01: the reconcile planner, which must stay pure.
 *
 * A planner that mutates while planning makes the plan it returns unusable as a
 * preview, which is the whole reason the pending surface can show one.
 */
export const RECONCILE_PURITY_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
] as const;

/**
 * SURF-03 / SURF-04 / HOOK-04 / D-58-01: the modules that carry the scope fence.
 *
 * The vocabulary owner comes first, then the three surfaces that must render
 * scope through it. `extensions/pi-claude-marketplace/commands/plugin` is
 * deliberately NOT a member: the fence gate asserts that directory is ABSENT, and
 * a group whose entries are all required to resolve cannot carry a path whose
 * contract is that it does not.
 */
export const SCOPE_FENCE_TARGETS = [
  "extensions/pi-claude-marketplace/shared/notification-types.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts",
  "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts",
] as const;

/**
 * The two canonical scope-ordering declaration sites.
 *
 * `types.ts` owns the `SCOPES` enumeration and `compare-name-scope.ts` owns the
 * name-then-scope comparator. They are the only files allowed to spell the
 * ordering out; every other site imports it, and the drift guard that scans the
 * extension tree excuses exactly these two. The runtime ESLint rule
 * `msg-gr-3-per-scope` covers only `orchestrators` and `edge/handlers`, which is
 * why the wider scan exists at all.
 */
export const SCOPE_ORDER_CANONICAL_TARGETS = [
  "extensions/pi-claude-marketplace/shared/types.ts",
  "extensions/pi-claude-marketplace/shared/compare-name-scope.ts",
] as const;

/**
 * D-75-01: the three modules whose `description:` string VALUES are user-facing
 * completion prose, scanned for the retired plugin-level vocabulary.
 *
 * `flag-catalog.ts` is the single source of truth the two completion modules
 * derive from, so all three carry the same obligation and a scan of any one
 * alone would miss where the prose actually originates.
 */
export const COMPLETION_DESCRIPTION_TARGETS = [
  "extensions/pi-claude-marketplace/edge/completions/provider.ts",
  "extensions/pi-claude-marketplace/edge/completions/data.ts",
  "extensions/pi-claude-marketplace/edge/flag-catalog.ts",
] as const;

/**
 * The unused-type-member gate's own subjects.
 *
 * The runner and its recorded decisions are targets in the sense this registry
 * means, and so are the suites beside them: the claim-to-control ledger names a
 * case inside each one, and a suite that moved would leave a stated capability
 * with no discriminating test.
 */
export const UNUSED_TYPE_MEMBER_GATE_TARGETS = [
  "scripts/check-unused-type-members.mjs",
  "scripts/check-unused-type-members.exceptions.json",
  "tests/scripts/check-unused-type-members.test.ts",
  "tests/scripts/check-unused-type-members.model.test.ts",
  "tests/scripts/check-unused-type-members.operations.test.ts",
] as const;

/** The gate's command-line entry point, which states the claims it supports. */
export const TYPE_MEMBER_GATE_REL: (typeof UNUSED_TYPE_MEMBER_GATE_TARGETS)[number] =
  "scripts/check-unused-type-members.mjs";

/**
 * The recorded decisions the gate's exit status accepts: one entry per member,
 * each naming exact coordinates and the mechanism that was measured. This is a
 * target in the sense this file means -- a gate that cannot open it accepts
 * whatever it happens to contain.
 */
export const TYPE_MEMBER_EXCEPTIONS_REL: (typeof UNUSED_TYPE_MEMBER_GATE_TARGETS)[number] =
  "scripts/check-unused-type-members.exceptions.json";

/** WDEP-05: the workflows bridge, whose commit path must never call a probe. */
export const WORKFLOWS_BRIDGE_TARGETS = [
  "extensions/pi-claude-marketplace/bridges/workflows",
  "extensions/pi-claude-marketplace/bridges/workflows/discover.ts",
  "extensions/pi-claude-marketplace/bridges/workflows/index.ts",
  "extensions/pi-claude-marketplace/bridges/workflows/stage.ts",
  "extensions/pi-claude-marketplace/bridges/workflows/types.ts",
  "extensions/pi-claude-marketplace/bridges/workflows/unstage.ts",
] as const;

/** WPTH-06: the staging-tree scan that must never write. */
export const WORKFLOWS_STAGING_SCAN_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts",
] as const;

/** WNAM-06 / WVAL-02: the module the workflows doc-pin and single-parse gates read. */
export const WORKFLOWS_SCRIPT_TARGETS = [
  "extensions/pi-claude-marketplace/domain/workflow-script.ts",
] as const;

/** WDEP-04 / SNM-06: the `Dependency[]` derivation sites the marker-coverage gate drives. */
export const WORKFLOWS_MARKER_COVERAGE_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts",
  "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts",
] as const;

/**
 * D-07-19 / GGAT-04: every export the repository publishes that no production
 * consumer reads, keyed by the file that publishes it.
 *
 * THIS IS A MEASUREMENT, NOT AN ALLOW-LIST. Nothing here is approved, accepted,
 * or waived. Each entry is a fact about the tree as it stands, and the gate that
 * reads it (`unowned-exports-census.test.ts`) re-measures the same question and
 * compares for EXACT equality -- so an addition fails, a removal fails, and a
 * one-in-one-out swap fails. An allow-list forgives its named entries silently
 * and forever; a pinned set forces whoever changes the export surface of the
 * tree to change this record in the same commit and say why.
 *
 * Many members are legitimate design. The `create*` factories exist for the
 * dependency-injection pattern `CONVENTIONS.md` prescribes, the closed tuples in
 * `shared/notification-types.ts` derive their union types in the file that
 * declares them, and the barrel rows are re-export chains whose only reader is a
 * test. Membership is therefore not an accusation -- it is the statement that
 * production does not read this, which is exactly the fact a reader needs when
 * they wonder whether deleting it is safe.
 *
 * Each file's export names are sorted, and that order is part of the pin: the
 * gate sorts what it measures the same way, so a reordering can never be
 * mistaken for a change and a change can never hide inside a reordering.
 *
 * The record is keyed rather than listed because every ARRAY-valued export of
 * this module is a list of paths that must resolve on disk, and a census entry
 * carries an export name as well as a path. Keying by path keeps every path a
 * bare string literal, which is what the literal-match scan over this file needs.
 *
 * The record is EMPTY, and an empty measurement is not a disabled one. The gate
 * still runs the analyzer, still validates the report envelope, and still
 * compares for exact equality -- so the first export that production stops
 * reading fails here rather than landing unremarked. Emptiness is the strongest
 * state this pin can be in, not the weakest.
 */
export const UNOWNED_EXPORT_CENSUS: Readonly<Record<string, readonly string[]>> = {};

/**
 * Complete production finding identities; additions, removals, and swaps require review.
 *
 * Every category is empty, which is the measured state of the tree and not a
 * suppression of it. Three declarations production reachability cannot follow
 * -- the manifest-loaded entry default, the test reporter's default that
 * `node --test` loads, and the ring buffer's `read` -- carry an exact adjacent
 * annotation naming their real loader and their real callers.
 */
export const PRODUCTION_FINDING_CENSUS = {
  unused_exports: [],
  unused_types: [],
  unused_files: [],
  unused_class_members: [],
  duplicate_exports: [],
} as const;
