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
