// orchestrators/types.ts
//
// Cross-orchestrator types (D-06). Sits at the ROOT of
// `orchestrators/` so marketplace/update.ts and plugin/update.ts both
// import from here without an
// orchestrators/marketplace ↔ orchestrators/plugin cycle. Mirrors
// D-01's escalation note about a future BridgeOps<Prep, Target>
// belonging at this same path.

import type { DegradeKind } from "../shared/notify-reasons.ts";
import type { ContentReason } from "../shared/notify.ts";
import type { Scope } from "../shared/types.ts";
import type { LedgerDegradationSignals } from "./plugin/shared.ts";

export interface ReinstallOutcomeBase {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface ReinstallReinstalledOutcome extends ReinstallOutcomeBase {
  readonly partition: "reinstalled";
  readonly version: string;
  readonly resourcesChanged: boolean;
  /**
   * D-99-02c: the GENERATED NAMES the reinstall ledger staged. The `Names`
   * suffix keeps them spelled apart from the same-subject presence FLAGS on
   * `LedgerDegradationSignals` (`plugin/shared.ts`), which carry a count
   * verdict only. A name list and a boolean answer different questions --
   * `which resources were written` versus `does the row declare the
   * companion` -- so the two must not be confusable at a producer or a
   * consumer site.
   */
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
  /**
   * CMC-13: per-row soft-dep predicate inputs. `true` iff
   * the plugin's resolved manifest declared the kind AND it was actually
   * staged at reinstall time (the orchestrator already tracks
   * `stagedAgentNames.length > 0` / `stagedMcpServerNames.length > 0`
   * per-outcome; these flags surface them through the typed outcome so
   * cascade rendering
   * (`PluginCascadeRow.declaresAgents` / `.declaresMcp`) consumes the
   * effective-state-at-render-time signal without re-deriving from the
   * staged-name arrays at the renderer site).
   *
   * MSG-SD-3: per-row markers fire on `(reinstalled)` rows only. These
   * flags live ONLY on this reinstalled arm; the `(skipped)` and
   * `(failed)` arms do not declare them at all, because the renderer
   * narrows on the partition discriminator and never reads soft-dep flags
   * for those rows.
   *
   * CMC-13: required `boolean` (not `?: boolean`) so every reinstalled
   * outcome producer populates the predicate EXPLICITLY rather than
   * relying on `undefined ~= false`. The closed type enforces the contract
   * at compile time; the `tsc --noEmit` gate catches any forgotten emitter
   * on every CI run.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  /**
   * WARN-01 / WR-04 / D-86-03: the component kinds whose SOURCE frontmatter
   * could not be parsed and which re-materialized in degraded form. The
   * reinstall primitive drives the load-time backfill, so without this the
   * backfill projection renders a clean row over a ledger that just degraded a
   * component -- the contradiction the install and enable arms already avoid by
   * carrying the same signal. Omitted when nothing degraded, so a clean
   * reinstall's outcome shape is unchanged (NREG-01).
   */
  readonly degradedKinds?: readonly DegradeKind[];
  readonly notes?: readonly string[];
  /**
   * D-141-03 / D-141-05: the DISCOVERY half of this reinstall's staging
   * warnings, unprefixed, carried separately from `notes`.
   *
   * `notes` folds all three halves (discovery + hygiene + maintenance) behind
   * a `warning: ` prefix for orchestrated consumers, so a reader cannot tell
   * the halves apart again. `reinstallPlugins` needs exactly the discovery
   * half to render after its cascade, and the boundary forces the carrier:
   * the warnings originate inside the locked ledger while the rows are not
   * rendered until `renderReinstallPartitionAndNotify` at the very end of
   * `reinstallPlugins`, so a diagnostic fired from inside the ledger would
   * print the detail BEFORE the row it explains.
   *
   * Populated only on the `render: "none"` arm, the same arm that populates
   * `notes`. The self-rendering `render !== "none"` arm leaves this undefined
   * and surfaces NO discovery diagnostic of its own: no production caller
   * reaches that arm, so its duplicate copy of the `surfaceDiscoveryWarnings`
   * call was deleted rather than maintained against a surface nothing
   * exercises. Anything that makes that arm reachable again has to render the
   * discovery half itself -- do not read this field's absence there as the
   * warnings being handled some other way.
   * Omitted when empty, so a clean reinstall's outcome shape is unchanged
   * (NREG-01).
   */
  readonly discoveryWarnings?: readonly string[];
}

export interface ReinstallSkippedOutcome extends ReinstallOutcomeBase {
  readonly partition: "skipped";
  readonly notes: readonly string[];
}

export interface ReinstallFailedOutcome extends ReinstallOutcomeBase {
  readonly partition: "failed";
  readonly notes: readonly string[];
  /**
   * CMC-16 / CMC-11: structural failure-class tag
   * consumed by `outcomeToCascadePluginMessage`'s closed-set Reason mapping. When the
   * orchestrator catches a `ManualRecoveryError` (thrown by the bridges'
   * leak-on-rollback path), it sets `failureClass: "manual-recovery"` so
   * the cascade row renders `(failed) {rollback partial}` without
   * substring-matching the ES-5 `notes` text. Omitted on
   * non-manual-recovery failures; the cascade renderer falls back to
   * `narrowReason` on `notes` for those.
   */
  readonly failureClass?: "manual-recovery";
  /**
   * pre-narrowed closed-set `Reason[]` produced at
   * the throw/catch site instead of substring-matching the opaque
   * `composeErrorWithCauseChain(err)` text downstream. Mirrors the
   * `PluginUpdateOutcome.reasons` precedent (CR-06 / NFR-7). When
   * present, `outcomeToCascadePluginMessage` prefers `reasons[0]` over
   * `narrowReasons(notes)`; when absent, the substring narrow
   * is used (for fixtures that build outcomes without
   * `reasons`). Populated by the catch in `reinstallPlugins` so an
   * EACCES / EPERM / ENOENT failure renders as the matching closed
   * Reason (`permission denied` / `source missing`) rather than the
   * permissive `not in manifest` default. Typed `ContentReason` (TYPE-02):
   * the structural `marketplace not added` marker is never a per-plugin outcome reason.
   */
  readonly reasons?: readonly ContentReason[];
}

export type ReinstallPluginOutcome =
  ReinstallReinstalledOutcome | ReinstallSkippedOutcome | ReinstallFailedOutcome;

/**
 * Bridge identifier for `PluginUpdateFailedOutcome.phaseFailures` on the
 * update path. Promoted to a named type so callers and tests don't repeat
 * the literal union inline. (Distinct from the free-form
 * `PluginFailedMessage.rollbackPartial[].phase` label, which also carries the
 * install path's `phase3a` / `phase3b` tokens.)
 */
export type UpdatePhaseBridge = "skills" | "commands" | "agents" | "hooks" | "mcp";

/**
 * CMC-17 / MSG-RP-1: per-phase rollback-partial child
 * carried on the `(failed)` partition when phase-3a aggregation occurred.
 */
export interface UpdatePhaseFailure {
  readonly phase: UpdatePhaseBridge;
  readonly msg: string;
}

export interface PluginUpdateBase {
  readonly name: string;
  /**
   * CMC-13: required `boolean` on every partition.
   * The renderer narrows on the partition discriminator (`(updated)` is
   * the only partition that emits the soft-dep marker per MSG-SD-3), but
   * the explicit field keeps every producer honest at compile time.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

/**
 * `(updated)` partition. `fromVersion` and `toVersion`
 * are REQUIRED here -- the orchestrator transitioned the install record
 * from one to the other. `stagedAgentNames` / `stagedMcpServerNames` are the
 * names of resources that were actually written during the update
 * (WR-04 / RH-5 input).
 *
 * WR-12 / D-99-03: INHERITS `LedgerDegradationSignals` rather than declaring a
 * private `degradedKinds` of its own. `update` stages through the same skills
 * and commands bridges as install, enable and reinstall, so it degrades a
 * component the same way and must report it the same way; inheriting means a
 * signal added to that shape reaches this outcome instead of silently missing
 * from the one verb that redeclared it. Every member arrives OPTIONAL, so a
 * clean update's outcome shape is unchanged (NREG-01).
 *
 * WR-01: inheriting a signal is only half the claim -- the verb has to POPULATE
 * and RENDER it, or the shape promises a reach the rows do not have. Two of the
 * five are live here (`degradedKinds`, `orphanRewake`); the other three are
 * pinned `never` below because this outcome already spells the same three facts
 * in its own REQUIRED fields, and two spellings of one fact on one type is what
 * D-99-02c's rename set out to remove.
 */
export interface PluginUpdateUpdatedOutcome extends PluginUpdateBase, LedgerDegradationSignals {
  readonly partition: "updated";
  readonly fromVersion: string;
  readonly toVersion: string;
  /**
   * D-99-02c: generated NAMES, spelled apart from the same-subject presence
   * flags on `LedgerDegradationSignals` (`plugin/shared.ts`). While both
   * shapes spelled these members the same way, a `readonly string[]` member
   * collided with an optional `boolean` one, so this outcome could not
   * extend the signal shape at all.
   */
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
  /**
   * WR-01: the three inherited signals this verb spells elsewhere, pinned to
   * `never` so a producer cannot populate a second spelling of a fact the
   * outcome already carries. `never` still satisfies the inherited optional
   * `boolean` / `string[]`, so the inheritance itself is untouched and a signal
   * ADDED to `LedgerDegradationSignals` tomorrow still lands here unpinned --
   * which is the property the inheritance exists for.
   *
   *  - the inherited `unsupported` array is `partialDegrade.kinds` here, which
   *    pairs the dropped kinds with the `newlyDegraded` verdict that makes them
   *    actionable.
   *  - `stagedAgents` / `stagedMcpServers` are the presence half of
   *    `stagedAgentNames` / `stagedMcpServerNames`, already reduced to the
   *    required `declaresAgents` / `declaresMcp` predicates above.
   */
  readonly unsupported?: never;
  readonly stagedAgents?: never;
  readonly stagedMcpServers?: never;
  /**
   * FSTAT-07 / D-66-04 / SEV-03 / D-69-01: the partial-degrade signal for a
   * `--partial` update whose candidate re-resolved `partially-available`. Present
   * atomically -- both fields travel together or the whole sub-object is absent
   * -- so a consumer can never see a `newlyDegraded` flag without the `kinds`
   * that make it meaningful. Absent when the candidate resolved fully
   * `installable`; the cascade then renders the normal `(updated)` row.
   *
   * `kinds` are the unsupported component kinds carried on the candidate's
   * `partially-available` resolver arm. Non-empty flips the success row to
   * `(partially-installed)` with the dropped-component detail (the same derived
   * signal the list deriver reads), so a partial update reports its true realized
   * state.
   *
   * `newlyDegraded` is `true` when this partially-degrading update NEWLY degrades a
   * previously-clean plugin -- the plugin's PERSISTED `compatibility.unsupported`
   * was EMPTY before the update applied. Read from the prior install record in
   * `preflightUpdate` (no new tracking, no schema change). The marketplace
   * autoupdate cascade renderer reads it to raise the `(partially-installed)` row to
   * `warning` (a silent auto-update degradation is actionable); an
   * already-degraded re-degrade (prior `partially-available` non-empty) stays `info`.
   * The manual `update --partial` renderer ignores it -- the explicit opt-in stays
   * info unconditionally (SEV-01), so the warning fires ONLY on the autoupdate
   * surface.
   */
  readonly partialDegrade?: {
    readonly kinds: readonly string[];
    readonly newlyDegraded: boolean;
  };
  /**
   * D-141-03 / D-141-05: the bridge staging warnings this update produced,
   * already split -- the discovery half always, plus the hygiene half in
   * cascade mode only. Mirrors the optional `notes?` that
   * `ReinstallReinstalledOutcome` carries.
   *
   * This partition needs the carrier because the update path puts a boundary
   * between a warning and the row it qualifies: the warnings originate inside
   * the three-phase runner, while the direct path renders no row until
   * `renderUpdateCascadeAndNotify` at the very end of `updatePlugins`. A
   * diagnostic fired from inside the runner would print the detail BEFORE
   * that row, so the outcome is the only thing that crosses the boundary.
   *
   * Omitted when empty, so a clean update's outcome shape is unchanged
   * (NREG-01).
   *
   * NOT dead. `update.ts::surfaceUpdateDiscoveryWarnings` reads this field on
   * this partition to render the standalone diagnostic, and the cascade
   * consumers carry it onward. What no consumer does is NARROW it to a
   * closed-set `Reason` the way the `skipped` and `failed` arms do -- the two
   * `notes` narrowers (`narrowSkipReasons`, `narrowFailReasons`) are each
   * typed on their own partition's arm, so a cascade ROW renderer never
   * reads this one.
   */
  readonly notes?: readonly string[];
}

/**
 * `(unchanged)` partition. The resolved version
 * matched the install record version exactly; nothing was written.
 * `fromVersion === toVersion` is documented here on both fields for
 * outcome aggregators that want to display a `vX → vX` slot.
 */
export interface PluginUpdateUnchangedOutcome extends PluginUpdateBase {
  readonly partition: "unchanged";
  readonly fromVersion: string;
  readonly toVersion: string;
}

/**
 * `(skipped)` partition. `fromVersion` is optional --
 * preflight skipped paths (marketplace-missing / record-missing) have no
 * install record to read a version from; the manifest-skipped paths
 * (entry-missing / entry-invalid / no-longer-installable) do. `reasons`
 * is REQUIRED on skipped (one of the closed `not in manifest` /
 * `not installed` / `invalid manifest` / `no longer installable`
 * values). `notes` carries the free-form cause-chain text consumed by
 * the notify trailer.
 *
 * XSURF-03: `partialUpgradable` marks the partially-upgradable manual update-decline
 * (the resolver verdict was `partially-available`, so `--partial` could degrade-update
 * it). The projection flips ONLY this arm to the `partially-upgradable` token; the
 * discriminant is a dedicated field, NOT the reason string, so the degrade
 * reason can carry the list-consistent kinds instead of `no longer
 * installable`. Structural declines (`--partial` cannot help) leave it unset.
 */
export interface PluginUpdateSkippedOutcome extends PluginUpdateBase {
  readonly partition: "skipped";
  readonly fromVersion?: string;
  readonly notes: readonly string[];
  readonly reasons: readonly ContentReason[];
  readonly partialUpgradable?: boolean;
}

/**
 * `(failed)` partition. `fromVersion` / `toVersion`
 * are optional -- catch sites that don't have version context (e.g. a
 * marketplace-not-found cascade catch in `cascadeAutoupdates`) leave
 * them undefined. `notes` is REQUIRED (the composed cause-chain text
 * for the notify trailer). `reasons` and `phaseFailures` are optional
 * structured supplements consumed by the cascade renderer; when
 * neither is set the consumer falls back to the notes
 * substring parse.
 *
 * `cause?: Error` carries the raw thrown error
 * (only populated by the cascadeAutoupdates catch where the error is
 * in scope) so the `outcomeToCascadePluginMessage` mapper can attach
 * it to `PluginFailedMessage.cause` for the per-plugin 4-space-indent
 * cause-chain trailer. Producers that don't have the original
 * Error instance (e.g. failed outcomes built by plugin/update.ts) leave
 * this undefined; the renderer simply omits the trailer.
 */
export interface PluginUpdateFailedOutcome extends PluginUpdateBase {
  readonly partition: "failed";
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly notes: readonly string[];
  readonly reasons?: readonly ContentReason[];
  readonly phaseFailures?: readonly UpdatePhaseFailure[];
  readonly cause?: Error;
}

/**
 * Discriminated union on `partition`. The
 * discriminated union makes partition-specific fields (fromVersion /
 * toVersion on updated; phaseFailures on failed) STRUCTURALLY
 * unreachable on the wrong partition, so the renderer cannot read
 * `outcome.fromVersion!` from a skipped outcome without a narrow.
 *
 * Each partition variant carries `declaresAgents` / `declaresMcp` via
 * the shared `PluginUpdateBase` base (CMC-13 required
 * booleans).
 */
export type PluginUpdateOutcome =
  | PluginUpdateUpdatedOutcome
  | PluginUpdateUnchangedOutcome
  | PluginUpdateSkippedOutcome
  | PluginUpdateFailedOutcome;

/**
 * D-05 function-injection seam. (`marketplace update` with
 * `record.autoupdate === true`) calls this once per installed plugin
 * during the autoupdate cascade. `orchestrators/plugin/update.ts` ships
 * the real implementation; tests inject a mock. The
 * `index.ts` barrel performs the registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;

// ───────────────────────────────────────────────────────────────────────────
// It moved here from install.ts to join its three siblings. Leaving it in the
// orchestrator meant install.messaging.ts could not name the type its own
// failure classifier returns without importing back into install.ts, which
// would close a cycle (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parsed (plugin, marketplace) options bundle. PI-1 / RH-1 / RH-2 parse is
 * the edge layer's responsibility; this orchestrator entrypoint
 * accepts already-parsed strings + the resolved scope.
 *
 * `pi` is REQUIRED -- `notify(ctx, pi, message)` consumes it for the
 * single `softDepStatus(pi)` probe per call. The renderer
 * injects per-row `{requires pi-subagents}` / `{requires pi-mcp}`
 * markers from the per-row `dependencies: readonly Dependency[]`
 * declaration combined with the threaded probe. Making `pi`
 * optional would force a runtime branch the type checker cannot reason
 * about.
 *
 * SNM-04 / D-15-02: the `"installed"` variant carries REQUIRED
 * `dependencies: readonly Dependency[]` (the closed-set
 * `"agents" | "mcp"` per SNM-04). The orchestrator derives the
 * array at the success-return site from
 * `installCtx.stagedAgentNames.length > 0` (-> `"agents"`) and
 * `installCtx.stagedMcpServerNames.length > 0` (-> `"mcp"`); the
 * `declaresAgents`/`declaresMcp` predicates on `InstallPluginOutcome`
 * remain (consumed by `orchestrators/import/execute.ts` for its
 * cascade-row composition) -- NFR-7's discriminated-outcome contract
 * is unchanged.
 *
 * IN-07 / D-98-01: the `installed` arm INTERSECTS the shared
 * `LedgerDegradationSignals` shape rather than re-declaring the ledger's
 * degradation fields, so the enable branch and this one read ONE vocabulary for
 * the same ledger run. Each field is omitted when empty, so a clean install's
 * outcome shape is unchanged (NREG-01).
 *
 * WR-03: the intersection EXCLUDES the two staged-count verdicts, and every
 * field it keeps is populated below. WR-11: the type operator is an EXCLUSION,
 * so it cannot state that second half on its own -- a signal added to the shared
 * shape would widen this arm with a field nothing here writes. The key set is
 * pinned bidirectionally by `COMPAT-01: the install outcome inherits exactly the
 * signals installPlugin populates` in
 * `tests/architecture/compat-01-no-expansion.test.ts`, which stops compiling on
 * either a widening or a narrowing. Each field of the shared shape is optional,
 * so intersecting all five never made a missing one a compile error -- it only
 * advertised `stagedAgents` / `stagedMcpServers` that `installPlugin` never
 * writes, which a consumer reads as `undefined` and takes for "no agents
 * staged". Those two facts already ride the REQUIRED `declaresAgents` /
 * `declaresMcp` predicates below (consumed by `orchestrators/import/execute.ts`
 * and the reconcile projection), so excluding the optional twins removes a
 * duplicate vocabulary rather than a signal. The dropped-component
 * `unsupported` kind list stays and is populated: an install admitted through
 * the partial gate drops component kinds, and an outcome silent about them would
 * contradict the `(partially-installed)` row `list` renders one command later --
 * the same contradiction the shared shape exists to prevent on the enable side.
 */
export type InstallPluginOutcome =
  | ({
      readonly status: "installed";
      readonly resourcesChanged: boolean;
      readonly declaresAgents: boolean;
      readonly declaresMcp: boolean;
      /**
       * The resolved install version, as the standalone rows render it. An
       * orchestrated caller has no other way to fill the version slot its own
       * projection carries on every comparable row. Not a
       * `LedgerDegradationSignals` member, so the COMPAT-01 key-set pin is
       * undisturbed.
       */
      readonly version?: string;
      /** Post-commit warnings collected in orchestrated mode instead of firing individually. */
      readonly postCommitWarnings?: readonly string[];
      /**
       * DFEN-04: the install ran to completion and then unstaged, because the
       * plugin's own `defaultEnabled` declaration said so -- the record is
       * `enabled: false` and nothing the plugin declares is on disk. Omitted
       * otherwise (NREG-01). The reconcile cascade reads it so its projection
       * can report the truthful disabled row instead of `(installed)` over a
       * disabled record. Not a `LedgerDegradationSignals` member, so the
       * COMPAT-01 key-set pin (which covers only the intersection with that
       * shape) is undisturbed.
       */
      readonly landedDisabled?: true;
    } & Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">)
  | {
      /**
       * Collapsed failure shape. All failure variants (`already-installed`,
       * `unavailable`, `uninstallable`, `unexpected-failure`) map here.
       * `error` is the typed dispatch surface -- consumers narrow on
       * `instanceof PluginShapeError` and `.shape.kind` to recover the
       * specific failure class. `cause` preserves the formatted user-visible
       * text for callers in orchestrated mode that render it directly.
       */
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
    };
