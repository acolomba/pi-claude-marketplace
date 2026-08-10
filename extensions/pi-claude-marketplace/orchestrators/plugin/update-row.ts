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

import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { PluginUpdatedMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateUpdatedOutcome } from "../types.ts";

/**
 * Compose the success row for one updated plugin. The SOLE composer for that
 * row: the manual update cascade and the marketplace autoupdate cascade both
 * call it, so the two surfaces cannot report the same ledger run differently
 * (the WR-09 lesson, one verb over).
 *
 * WARN-01 / WR-12 / D-99-03: a component this ledger degraded names its kind and
 * takes the info -> warning raise, exactly as on the install, enable and
 * reinstall arms. A clean update composes no reasons and keeps the caller's
 * severity, so its row is byte-identical to before (NREG-01).
 *
 * `baseSeverity` is the caller's own success-severity policy, which the two
 * surfaces set differently and deliberately: the manual cascade raises on an
 * absent declared companion (SEV-01), while the autoupdate cascade stays `info`
 * for that condition (WR-01 -- a background operation must not warn about a
 * companion the user is not present to install). The malformed-component raise
 * is a SEPARATE axis and applies on both, because a degraded component is
 * carried out but short of ideal whichever surface reports it.
 *
 * CMC-13 / MSG-SD-3: `dependencies` carries the declared kinds that drive the
 * renderer-time `{requires pi-subagents}` / `{requires pi-mcp}` markers; the
 * renderer narrows on membership plus the notify-time probe.
 *
 * D-03/D-06: a realized update transition always reloads Pi resources.
 */
export function updatedRowFromOutcome(
  outcome: PluginUpdateUpdatedOutcome,
  rowScope: Scope,
  baseSeverity: "info" | "warning",
): PluginUpdatedMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  return {
    status: "updated",
    name: outcome.name,
    scope: rowScope,
    from: outcome.fromVersion,
    to: outcome.toVersion,
    dependencies: outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp),
    // Optional spread, not a required key: an unaffected row renders the legacy
    // brace-less bytes because the key is ABSENT, not `undefined` (NREG-01).
    ...(malformed.length > 0 && { reasons: malformed }),
    severity: malformed.length > 0 ? "warning" : baseSeverity,
    needsReload: true,
  };
}

/** Derive the v2 Dependency[] tuple from the outcome's declared kinds. */
export function outcomeDependencies(
  declaresAgents: boolean,
  declaresMcp: boolean,
): readonly Dependency[] {
  return [
    ...(declaresAgents ? (["agents"] as const) : []),
    ...(declaresMcp ? (["mcp"] as const) : []),
  ];
}
