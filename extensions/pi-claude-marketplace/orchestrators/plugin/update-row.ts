// orchestrators/plugin/update-row.ts
//
// The `(updated)` partition's row composer, and nothing else. A LEAF module:
// it imports the outcome type from `../types.ts` plus the shared notify
// vocabulary, and nothing from either update ledger.
//
// D-05 / D-06 / D-11: the composer is shared by `plugin/update.ts` (the manual
// update cascade) and `marketplace/update.ts` (the autoupdate cascade), so it
// cannot live in either of them. Importing it from `plugin/update.ts` gave
// `marketplace/update.ts` a static edge onto the plugin-update LEDGER -- the
// module graph the injected `pluginUpdate` seam exists to keep it out of, and
// the `orchestrators/marketplace` -> `orchestrators/plugin` direction
// `../types.ts` was created to avoid. A leaf with no back-edges cannot close
// that cycle whatever either ledger grows into next.

import { malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  ContentReason,
  PluginPartiallyInstalledMessage,
  PluginUpdatedMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateUpdatedOutcome } from "../types.ts";

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
 * The partition carries three INDEPENDENT degradation axes and the row names
 * whichever are present:
 *
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
 *
 * An update can do all three at once, and the row then carries every token in
 * ONE brace in the install row's established emit order -- orphan rewake, then
 * malformed kinds, then dropped kinds (`docs/output-catalog.md`,
 * `enable-orphan-rewake`). A clean update composes no reasons and keeps the
 * caller's severity, so its row is byte-identical to before (NREG-01).
 *
 * CMC-13 / MSG-SD-3: `dependencies` carries the declared kinds that drive the
 * renderer-time `{requires pi-subagents}` / `{requires pi-mcp}` markers on BOTH
 * forms (WR-03); the renderer narrows on membership plus the notify-time probe.
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
  // Emit order, shared by both row forms below: orphan rewake, then the
  // malformed kinds, then whatever the dropped-kind form appends.
  const written: readonly ContentReason[] = [
    ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
    ...malformed,
  ];
  const dependencies = outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp);
  const dropped = outcome.partialDegrade;
  if (dropped !== undefined && dropped.kinds.length > 0) {
    return {
      status: "partially-installed",
      name: outcome.name,
      scope: rowScope,
      version: outcome.toVersion,
      dependencies,
      reasons: [...written, ...narrowUnsupportedKinds(dropped.kinds)],
      severity: malformed.length > 0 ? "warning" : baseSeverity.partiallyInstalled,
      needsReload: true,
    };
  }

  return {
    status: "updated",
    name: outcome.name,
    scope: rowScope,
    from: outcome.fromVersion,
    to: outcome.toVersion,
    dependencies,
    // Optional spread, not a required key: an unaffected row renders the legacy
    // brace-less bytes because the key is ABSENT, not `undefined` (NREG-01).
    ...(written.length > 0 && { reasons: written }),
    // Only the MALFORMED axis moves the severity channel: an orphan rewake is a
    // config bug the row names, not a shortfall in what the update carried out.
    severity: malformed.length > 0 ? "warning" : baseSeverity.updated,
    needsReload: true,
  };
}

/**
 * Derive the v2 Dependency[] tuple from the outcome's declared kinds. File-
 * private: both row forms take it from the one composer above, so no caller can
 * hand-derive a third spelling of the same tuple (IN-05).
 */
function outcomeDependencies(declaresAgents: boolean, declaresMcp: boolean): readonly Dependency[] {
  return [
    ...(declaresAgents ? (["agents"] as const) : []),
    ...(declaresMcp ? (["mcp"] as const) : []),
  ];
}
