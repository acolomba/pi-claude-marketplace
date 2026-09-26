// orchestrators/plugin/update-row.ts
//
// The shared row-fact leaf for BOTH update cascades: the `(updated)`
// partition's row composer, and the constraint cause-line carrier the
// `skipped` and `unchanged` rows read (UPDT-02, D-10-13). A LEAF module: it
// imports the outcome type from `../types.ts` plus the shared notify
// vocabulary, and nothing from either update ledger.
//
// D-05 / D-06 / D-11: the composer is shared by `plugin/update-cascade.ts` (the
// manual update cascade) and `marketplace/update.ts` (the autoupdate cascade),
// so it cannot live in either of them. Importing it from `plugin/update.ts` gave
// `marketplace/update.ts` a static edge onto the plugin-update LEDGER -- the
// module graph the injected `pluginUpdate` seam exists to keep it out of, and
// the `orchestrators/marketplace` -> `orchestrators/plugin` direction
// `../types.ts` was created to avoid. A leaf with no back-edges cannot close
// that cycle whatever either ledger grows into next -- which is exactly why
// the constraint cause-line carrier lives here rather than in the constraint
// gate leaf: the autoupdate cascade must not gain a static edge onto a
// module that imports the declaration index and the tag probes.

import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type PluginPartiallyInstalledMessage,
  type PluginUpdatedMessage,
} from "../../shared/notification-types.ts";
import { malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateSkippedOutcome,
  PluginUpdateUnchangedOutcome,
  PluginUpdateUpdatedOutcome,
} from "../types.ts";

/**
 * The caller's own success-severity policy for the `updated` partition, one
 * entry per row form the partition can take. The two cascade surfaces set them
 * differently and deliberately, so the composer takes the policy rather than
 * deriving it:
 *
 *  - the manual update cascade raises the clean row on an absent declared
 *    companion (SEV-01) and applies that same stamp to the dropped-kind row,
 *    because a `--partial` degrade is an explicit opt-in (it never raises on
 *    the drop itself);
 *  - the autoupdate cascade stays `info` for an absent companion (WR-01 -- a
 *    background operation must not warn about a companion the user is not
 *    present to install) but DOES raise the dropped-kind row when the degrade
 *    is new (SEV-03 / D-69-01).
 */
export interface UpdatedRowSeverity {
  /** Base for the clean `(updated)` row. */
  readonly updated: "info" | "warning";
  /** Base for the dropped-kind `(partially-installed)` row. */
  readonly partiallyInstalled: "info" | "warning";
}

/**
 * Compose the success row for one updated plugin, in whichever form the
 * outcome's signals select. The SOLE composer for that partition: the manual
 * update cascade and the marketplace autoupdate cascade both call it, so the
 * two surfaces cannot report the same ledger run differently (the WR-09 lesson,
 * one verb over), and BOTH row forms are composed here so a signal cannot be
 * threaded onto one form while a caller short-circuits past it on the other
 * (CR-01).
 *
 * The partition carries five INDEPENDENT degradation axes and the row names
 * whichever are present:
 *
 *  - D-10-15, the CURRENT-COPY axis: a constrained path source with no
 *    satisfying marketplace tag fell back to the marketplace's current copy,
 *    and it landed in range. Reuses the install cascade's existing
 *    `{dependency current copy}` token -- same fact, same phrase: no tag
 *    pinned this, the marketplace's current copy is what landed. Named FIRST
 *    in the brace: it says where the tree came from, which precedes anything
 *    the staging then did with it. Moves NO severity channel -- the update
 *    was carried out in full.
 *  - FSTAT-07 / D-66-04, the DROPPED-kind axis: a `--partial` update whose
 *    candidate re-resolved `partially-available` dropped the unsupported kinds,
 *    so the row reports `(partially-installed)` with the dropped-component
 *    detail instead of `(updated)`. This reads the LIVE candidate resolution of
 *    the just-completed update -- NOT the persisted `compatibility.unsupported`
 *    the `list` / non-path `info` derivers read; they agree here only because
 *    the update just wrote that record. A clean candidate keeps `(updated)`
 *    (FSTAT-03 -- no lingering partial state).
 *  - WARN-01 / WR-12 / D-99-03, the MALFORMED-component axis: a component whose
 *    source frontmatter would not parse is WRITTEN in degraded form, not
 *    dropped, so it names its kind and takes the info -> warning raise exactly
 *    as on the install, enable and reinstall arms.
 *  - SURF-05 / D-63-08 / WR-01, the ORPHAN-REWAKE axis: the re-materialized
 *    `hooks/hooks.json` declares `rewakeMessage` / `rewakeSummary` on a handler
 *    without `asyncRewake: true`. One token per plugin regardless of N orphan
 *    handlers, and it moves NO severity channel -- the config bug names itself
 *    in the brace while the update itself was carried out in full.
 *  - WLIF-06, the STALE-COMMAND axis: the new version withdrew or renamed a
 *    workflow the record named, and the host exposes no unregister call, so the
 *    command that envelope registered stays live until a reload. One token per
 *    plugin regardless of how many names were retired, and it sits LAST inside
 *    the brace on both row forms -- the tail position the closed set itself
 *    gives it -- so a reader meets it in the same place on every surface.
 *
 * An update can do all five at once, and the row then carries every token in
 * ONE brace in the install row's established emit order -- current copy, then
 * orphan rewake, then

 * malformed kinds, then dropped kinds (`docs/output-catalog.md`,
 * `enable-orphan-rewake`), then the stale-command token. A clean update composes
 * no reasons and keeps the caller's severity, so its row is byte-identical to
 * before (NREG-01).
 *
 * CMC-13 / MSG-SD-3: `dependencies` carries the declared kinds that drive the
 * renderer-time `{requires pi-subagents}` / `{requires pi-mcp}` /
 * `{requires pi-dynamic-workflows}` markers on BOTH forms (WR-03); the renderer
 * narrows on membership plus the notify-time probe.
 *
 * D-03/D-06: a realized update transition always reloads Pi resources, and
 * `partially-installed` is a realized transition too.
 */
export function updatedRowFromOutcome(
  outcome: PluginUpdateUpdatedOutcome,
  rowScope: Scope,
  baseSeverity: UpdatedRowSeverity,
): PluginUpdatedMessage | PluginPartiallyInstalledMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  // Emit order, shared by both row forms below: current copy, then orphan
  // rewake, then the malformed kinds, then whatever the dropped-kind form
  // appends.
  const written: readonly ContentReason[] = [
    ...(outcome.constraint?.fellBackToCurrentCopy === true
      ? (["dependency current copy"] as const)
      : []),
    ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
    ...malformed,
  ];
  // WLIF-06: the tail token on both row forms, and the second axis that moves
  // the severity channel. Computed by the producing verb, never here -- the
  // composer holds no pre-update record to take a difference against.
  const stale: readonly ContentReason[] =
    outcome.staleWorkflowCommand === true ? (["stale workflow command"] as const) : [];
  const raised = malformed.length > 0 || stale.length > 0;
  const dependencies = outcomeDependencies(
    outcome.declaresAgents,
    outcome.declaresMcp,
    outcome.declaresWorkflows,
  );
  const dropped = outcome.partialDegrade;
  if (dropped !== undefined && dropped.kinds.length > 0) {
    return {
      status: "partially-installed",
      name: outcome.name,
      scope: rowScope,
      version: outcome.toVersion,
      dependencies,
      reasons: [...written, ...narrowUnsupportedKinds(dropped.kinds), ...stale],
      severity: raised ? "warning" : baseSeverity.partiallyInstalled,
      needsReload: true,
    };
  }

  const cleanFormReasons: readonly ContentReason[] = [...written, ...stale];
  return {
    status: "updated",
    name: outcome.name,
    scope: rowScope,
    from: outcome.fromVersion,
    to: outcome.toVersion,
    dependencies,
    // Optional spread, not a required key: an unaffected row renders the legacy
    // brace-less bytes because the key is ABSENT, not `undefined` (NREG-01).
    ...(cleanFormReasons.length > 0 && { reasons: cleanFormReasons }),
    // Two axes move the severity channel, for two different reasons. The
    // MALFORMED axis names a component the update wrote in degraded form; the
    // STALE-COMMAND axis names a shortfall in what the update achieved -- it was
    // carried out, but the desired state is not reached until the reload. An
    // orphan rewake moves nothing: it is a config bug the row names, not a
    // shortfall in what the update carried out.
    severity: raised ? "warning" : baseSeverity.updated,
    needsReload: true,
  };
}

/**
 * Derive the v2 Dependency[] tuple from the outcome's declared kinds. File-
 * private: both row forms take it from the one composer above, so no caller can
 * hand-derive a third spelling of the same tuple (IN-05).
 *
 * WDEP-02: `workflows` spreads LAST, so an update that declares agents and mcp
 * renders the same two-marker brace whether or not it also declares workflows.
 */
function outcomeDependencies(
  declaresAgents: boolean,
  declaresMcp: boolean,
  declaresWorkflows: boolean,
): readonly Dependency[] {
  return [
    ...(declaresAgents ? (["agents"] as const) : []),
    ...(declaresMcp ? (["mcp"] as const) : []),
    ...(declaresWorkflows ? (["workflows"] as const) : []),
  ];
}

/**
 * UPDT-02 / D-10-11 / D-10-13: the constraint gate's cause line, read off
 * whichever partition carries it. The `skipped` arm carries the held-update
 * cause on `notes`; the `unchanged` arm carries the D-10-13 ceiling
 * disclosure on `constraint`. `undefined` for every other outcome, so its
 * row stays byte-frozen (no other producer sets either field under this
 * reason).
 */
export function constraintCauseFor(
  outcome: PluginUpdateSkippedOutcome | PluginUpdateUnchangedOutcome,
): Error | undefined {
  if (outcome.partition === "unchanged") {
    return outcome.constraint === undefined ? undefined : new Error(outcome.constraint.disclosure);
  }

  if (!outcome.reasons.includes("dependents constrain") || outcome.notes.length === 0) {
    return undefined;
  }

  return new Error(outcome.notes.join(" "));
}
