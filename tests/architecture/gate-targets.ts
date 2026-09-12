/**
 * The architecture gates' target registry.
 *
 * D-07-05: every gate under `tests/architecture/` names the production files it
 * guards through a group exported from here, and composes no path of its own.
 * Each entry is a FULL literal repository-relative path -- never a joined
 * segment, never a template -- so one literal-match scan of this file sees every
 * guarded target. A composed entry defeats that in the only way that matters: it
 * makes a stale path invisible to the scan that exists to find stale paths.
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
 * NFR-5 / PI-2 / PL-3 / PRL-07: every module that must NAME no git surface of
 * its own. That is a narrower claim than "performs no network operation", and
 * the membership splits two ways. Most targets are network-free by contract --
 * the read surfaces (`list`, plugin `info`, marketplace `info`), the reconcile
 * pending/planner/projection family, both reinstall owners (cached manifests
 * only), and the resolver, one file OUTSIDE the orchestrator layer. The resolver
 * inherits its obligation from the two read surfaces it answers for. The others
 * are MUTATING verbs that do reach git -- `install-flow.ts` and `fetch.ts`
 * materialize a clone on a cache miss, and `enable-disable.ts` re-materializes
 * through the install ledger -- and they qualify because they reach it ONLY
 * through the `clone-cache.ts` seam, by entrypoint name.
 *
 * Exempt files (do NOT add):
 *   - `orchestrators/plugin/update-flow.ts` and `update-preflight.ts`: PUP-2
 *     `syncClone` REQUIRES gitOps; they legitimately name the `GitOps` surface
 *     via the `orchestrators/marketplace/shared.ts` re-export (Pattern S-9).
 *   - `orchestrators/plugin/uninstall.ts` is implicitly clean (no git surface
 *     today) but is not gated -- gating install + list covers the NFR-5
 *     orchestrator-tier obligation.
 */
export const NETWORK_FREE_TARGETS = [
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
  // ledger cannot weaken the original gate.
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
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
  // ENBL-03: the enable/disable orchestrator re-materializes from cache
  // -- NO network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
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
] as const;

/**
 * The `NETWORK_FREE_TARGETS` member whose temp-root COPY the network gate's
 * offender and near-miss controls mutate (D-07-01, D-07-04). It is one of the
 * marketplace owners rather than a long-standing entry, so the controls prove
 * the newest members of the group are really scanned and not merely listed.
 *
 * The annotation is the membership check: assigning a path the group does not
 * name stops compiling, so this second reference cannot drift away from the
 * group it points into.
 */
export const NETWORK_FREE_CONTROL_TARGET: (typeof NETWORK_FREE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";

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

/** The orchestrator layer. Root of the D-11 ledger walk and the cast-read walk. */
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
 * D-11 / D-21-02: the eight layer folders the import-boundary matrix names as
 * zone targets.
 *
 * The `./` prefix is part of the value, not decoration: these strings are
 * compared against the `target` field of an ESLint `no-restricted-paths` zone,
 * which spells them that way. A gate that rewrote them without the prefix would
 * compare two things that never match and report a difference that is an artifact
 * of its own normalisation.
 */
export const ZONE_FOLDER_TARGETS = [
  "./extensions/pi-claude-marketplace/edge",
  "./extensions/pi-claude-marketplace/orchestrators",
  "./extensions/pi-claude-marketplace/bridges",
  "./extensions/pi-claude-marketplace/domain",
  "./extensions/pi-claude-marketplace/transaction",
  "./extensions/pi-claude-marketplace/persistence",
  "./extensions/pi-claude-marketplace/platform",
  "./extensions/pi-claude-marketplace/shared",
] as const;

/**
 * D-11: one real module per zone folder, in `ZONE_FOLDER_TARGETS` order.
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
 * D-11: the five plugin ledger entry points.
 *
 * A ledger owns a transactional verb end to end. Their sibling `*-probe`,
 * `*-swap`, `*-record`, `*-row`, and `*-outcome` modules are extracted helpers
 * and leaf composers, and are deliberately absent -- so is `bootstrap.ts`, a
 * composer whose whole job is calling marketplace verbs. The bare module names a
 * regex needs are derived from these paths, never spelled separately: a name
 * that resolves to nothing stops matching silently instead of failing.
 */
export const PLUGIN_LEDGER_TARGETS = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
] as const;

/**
 * D-11: the four marketplace ledger entry points, the other half of the
 * no-ledger-imports-a-ledger pair. A plugin ledger reaches marketplace code only
 * through `orchestrators/marketplace/shared.ts`.
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
 * Paths that MUST NOT resolve on disk.
 *
 * WR-06 fixtures for the shared scan mechanic's own gate: each one stands for a
 * target that was renamed, deleted, or not yet written, and the scan is expected
 * to fail (or to waive it explicitly) rather than green over zero inspected
 * files. If any of these ever becomes a real module, its case stops proving
 * anything -- rename the probe instead of reusing the collision.
 */
export const MISSING_TARGET_PROBES = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/renamed-away.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/not-yet-written.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/other-missing.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/not-this-one.ts",
] as const;

/**
 * D-07-17: the records that carry a finding's disposition when the evidence for
 * it is a command run this cycle rather than a change to the tree.
 *
 * A record like this is a target in exactly the sense the rest of this file
 * means: a gate that cannot open it inspects nothing, and it is as liable to be
 * renamed as any module.
 */
export const EVIDENCE_RECORD_TARGETS = [
  ".planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md",
] as const;

/** The disposition of every finding routed to the gate-integrity work. */
export const FINDING_DISPOSITIONS_REL: (typeof EVIDENCE_RECORD_TARGETS)[number] =
  ".planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md";

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
 */
export const UNOWNED_EXPORT_CENSUS: Readonly<Record<string, readonly string[]>> = {
  "extensions/pi-claude-marketplace/bridges/agents/convert.ts": [
    "MODEL_MAP",
    "THINKING_VALUES",
    "TOOL_MAP",
  ],
  "extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts": [
    "GENERATED_AGENT_MARKER",
    "emitYamlScalar",
    "sanitizeProvenanceValue",
  ],
  "extensions/pi-claude-marketplace/bridges/agents/index.ts": [
    "GENERATED_AGENT_MARKER",
    "GENERATED_AGENT_MARKER_LEGACY",
  ],
  "extensions/pi-claude-marketplace/bridges/agents/marker.ts": [
    "GENERATED_AGENT_MARKER_LEGACY",
    "GENERATED_AGENT_PREFIX",
  ],
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts": [
    "ASYNC_REWAKE_PIDS_FILENAME",
    "ASYNC_REWAKE_PID_TABLE_VERSION",
  ],
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts": ["MARKER_ENV"],
  "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts": [
    "createBeforeAgentStartHandler",
  ],
  "extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts": [
    "bashSubcommandFires",
    "compileBashGlob",
    "compilePathGlob",
    "compilePowerShellGlob",
    "compilePowerShellRule",
    "parseBashSubcommands",
    "parsePowerShellSubcommands",
    "powerShellSubcommandFires",
  ],
  "extensions/pi-claude-marketplace/bridges/hooks/stage.ts": [
    "createWriteHookConfig",
    "hookConfigPathFor",
  ],
  "extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts": ["MCP_COLLISION_SLOTS"],
  "extensions/pi-claude-marketplace/bridges/mcp/index.ts": ["resolvePluginMcpServers"],
  "extensions/pi-claude-marketplace/bridges/mcp/marker.ts": ["readMarker"],
  "extensions/pi-claude-marketplace/bridges/mcp/parse.ts": [
    "parseMcpServers",
    "resolvePluginMcpServers",
  ],
  "extensions/pi-claude-marketplace/bridges/mcp/stage.ts": ["MalformedMcpServersError"],
  "extensions/pi-claude-marketplace/bridges/mcp/substitute.ts": ["deepSubstitute"],
  "extensions/pi-claude-marketplace/bridges/skills/unstage.ts": ["createUnstagePluginSkills"],
  "extensions/pi-claude-marketplace/domain/auth-registry.ts": ["GITLAB_PROVIDER"],
  "extensions/pi-claude-marketplace/domain/components/hooks.ts": [
    "HOOKS_CONFIG_SCHEMA",
    "HOOKS_VALIDATOR",
  ],
  "extensions/pi-claude-marketplace/domain/components/hooks/schema.ts": ["HOOKS_CONFIG_SCHEMA"],
  "extensions/pi-claude-marketplace/domain/plugin-resolver.ts": ["resolveLoose"],
  "extensions/pi-claude-marketplace/domain/resolver-types.ts": ["ResolvedPluginSchema"],
  "extensions/pi-claude-marketplace/domain/unsupported-components.ts": [
    "SUPPORTED_COMPONENT_KINDS",
    "UNSUPPORTED_COMPONENT_KINDS",
  ],
  "extensions/pi-claude-marketplace/edge/completions/data.ts": [
    "buildItem",
    "getPluginToMarketplacesMap",
  ],
  "extensions/pi-claude-marketplace/edge/flag-catalog.ts": ["CATALOG_VERBS"],
  "extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts": ["parseFetchTarget"],
  "extensions/pi-claude-marketplace/edge/handlers/tools.ts": ["projectRowStatus"],
  "extensions/pi-claude-marketplace/edge/router.ts": ["MARKETPLACE_USAGE", "TOP_LEVEL_USAGE"],
  "extensions/pi-claude-marketplace/index.ts": ["default"],
  "extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts": [
    "planMarketplaceSourcesForRefs",
  ],
  "extensions/pi-claude-marketplace/orchestrators/import/refs.ts": ["parseEnabledPluginRef"],
  "extensions/pi-claude-marketplace/orchestrators/import/settings.ts": [
    "mergeClaudeSettings",
    "resolveClaudeSettingsPaths",
  ],
  "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts": ["resolveScopeFromState"],
  "extensions/pi-claude-marketplace/orchestrators/plugin-path.ts": ["collectBinDirs"],
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts": [
    "createSetPluginEnabled",
  ],
  "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts": ["createFetchPlugins"],
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts": ["createGetPluginInfo"],
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts": ["createInstallPlugin"],
  "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts": [
    "narrowResolverReasons",
  ],
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts": [
    "createReinstallPlugin",
  ],
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts": [
    "finalizeReinstalledPlugin",
    "replaceReinstalledPlugin",
    "rollbackReinstalledPlugin",
    "runPostSuccessMaintenance",
  ],
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts": [
    "outcomeToPluginMessage",
  ],
  "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts": ["createUninstallPlugin"],
  "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts": ["createApplyReconcile"],
  "extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts": [
    "scanForceInstalledBackfills",
  ],
  "extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts": [
    "PENDING_STATUSES",
  ],
  "extensions/pi-claude-marketplace/persistence/config-io.ts": ["CONFIG_VALIDATOR"],
  "extensions/pi-claude-marketplace/persistence/state-io.ts": [
    "PLUGIN_INSTALL_RECORD_SCHEMA",
    "STATE_SCHEMA",
    "STATE_VALIDATOR",
  ],
  "extensions/pi-claude-marketplace/platform/git-credential.ts": ["createCredentialOps"],
  "extensions/pi-claude-marketplace/platform/git.ts": [
    "buildAuthCallbacks",
    "listBranches",
    "listRemotes",
  ],
  "extensions/pi-claude-marketplace/platform/pi-api.ts": [
    "hasLoadedPiMcpAdapter",
    "hasLoadedPiSubagents",
  ],
  "extensions/pi-claude-marketplace/shared/completion-cache.ts": [
    "MARKETPLACE_NAMES_CACHE_SCHEMA",
    "PLUGIN_INDEX_CACHE_SCHEMA",
  ],
  "extensions/pi-claude-marketplace/shared/errors-bridges.ts": ["AgentForeignContentError"],
  "extensions/pi-claude-marketplace/shared/errors.ts": ["ConcurrentUninstallError"],
  "extensions/pi-claude-marketplace/shared/markers.ts": ["STATE_LOCK_HELD_PREFIX"],
  "extensions/pi-claude-marketplace/shared/notification-dispatch.ts": ["emitWithSummary"],
  "extensions/pi-claude-marketplace/shared/notification-grammar.ts": [
    "ICON_PARTIALLY_AVAILABLE",
    "ICON_REMOTE",
  ],
  "extensions/pi-claude-marketplace/shared/notification-types.ts": [
    "MARKETPLACE_STATUSES",
    "PLUGIN_STATUSES",
    "REASONS",
    "STATUS_TOKENS",
  ],
  "extensions/pi-claude-marketplace/shared/path-safety.ts": [
    "LexicalTraversalError",
    "createPathSafetyGuard",
  ],
  "scripts/revalidation.mjs": [
    "buildDecisionDossier",
    "deriveScopeImpact",
    "enumerateCorpus",
    "main",
    "mergeShards",
    "parseAssignments",
    "publishRevalidation",
    "renderRevalidation",
    "reportCliError",
    "validateLedger",
    "validateShard",
  ],
};
