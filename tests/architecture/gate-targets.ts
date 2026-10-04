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

/** The extension tree. Root of the vocabulary, shell-out, and seam walks. */
export const EXTENSION_ROOT_REL = "extensions/pi-claude-marketplace";

/** The orchestrator layer. Root of the cast-read walk. */
export const ORCHESTRATORS_REL = "extensions/pi-claude-marketplace/orchestrators";

/** The plugin orchestrators. The four lifecycle owners live directly inside it. */
export const PLUGIN_ORCHESTRATORS_REL = "extensions/pi-claude-marketplace/orchestrators/plugin";

/** SURF-03: the plugin edge handlers, where the scope-fence surface lives. */
export const PLUGIN_EDGE_HANDLERS_REL = "extensions/pi-claude-marketplace/edge/handlers/plugin";

/** The package manifest: version sync, peer floor, telemetry ban. */
export const PACKAGE_JSON_REL = "package.json";

/** The lockfile, read alongside the manifest by the peer-floor gate. */
export const PACKAGE_LOCK_REL = "package-lock.json";

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
