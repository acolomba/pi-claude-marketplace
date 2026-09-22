// orchestrators/plugin/update-cascade.ts
//
// Owns update result projection, marketplace grouping, exact tally selection,
// severity, and reload-hint routing. Invocation cardinality remains structural.

import { softDepStatus } from "../../platform/pi-api.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import {
  notifyUpdateNoOpWithContext,
  notifyUpdateWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { companionSeverity, skipSeverity } from "../../shared/notify-reasons.ts";

import { constraintCauseFor, updatedRowFromOutcome } from "./update-row.ts";
import { UPDATE_CONTEXT, type UpdateMsg } from "./update.messaging.ts";

import type { DirectRenderableOutcome } from "./update-swap.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { NotificationContext, SoftDepStatus, ToolInventory } from "../../platform/pi-api.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateSkippedOutcome } from "../types.ts";

/** Hook-routing capabilities consumed by successful update finalization. */
export type UpdateHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/** Target identity retained beside an update result until cascade composition. */
export interface UpdateCascadeTarget {
  readonly marketplace: string;
  readonly scope: Scope;
}

/** One update result with the target facts required for exact row composition. */
export interface UpdateCascadeOutcome {
  readonly target: UpdateCascadeTarget;
  readonly outcome: DirectRenderableOutcome;
}

function cascadeSkipSeverity(
  reasons: readonly ContentReason[],
  cardinality: "single" | "plural",
): "info" | "warning" | "error" {
  if (reasons.includes("not installed") || reasons.includes("not found")) {
    return "error";
  }

  if (reasons.includes("no longer installable")) {
    return cardinality === "single" ? "warning" : "info";
  }

  // D-10-12: the held-update token relies on this default to reach `warning`
  // on both cascades and must never be added to `IDEMPOTENT_REASONS` -- a
  // deliberate divergence from the `(updated)` partition's info-for-
  // autoupdate split, because a constraint hold persists across every future
  // run until the user changes a declaration.
  return skipSeverity(reasons);
}

// fallow-ignore-next-line unused-export -- production reaches this through `outcomeToCascadePluginMessage`'s `skipped` arm in the same module; exported so the doc-agreement gate drives the held-row token through the REAL composer rather than a copied literal.
export function projectSkippedOutcome(
  target: UpdateCascadeTarget,
  outcome: PluginUpdateSkippedOutcome,
  cardinality: "single" | "plural",
): UpdateMsg {
  const version =
    outcome.fromVersion !== undefined && outcome.fromVersion !== ""
      ? { version: outcome.fromVersion }
      : {};

  if (outcome.partialUpgradable === true) {
    return {
      status: "partially-upgradable",
      name: outcome.name,
      scope: target.scope,
      ...version,
      reasons: outcome.reasons,
      partialHint: true,
      severity: cardinality === "single" ? "warning" : "info",
      needsReload: false,
    };
  }

  const cause = constraintCauseFor(outcome);
  return {
    status: "skipped",
    name: outcome.name,
    scope: target.scope,
    ...version,
    reasons: outcome.reasons,
    severity: cascadeSkipSeverity(outcome.reasons, cardinality),
    needsReload: false,
    ...(cause !== undefined && { cause }),
  };
}

function outcomeToCascadePluginMessage(
  target: UpdateCascadeTarget,
  outcome: DirectRenderableOutcome,
  probe: SoftDepStatus,
  cardinality: "single" | "plural",
): UpdateMsg {
  const successSeverity = companionSeverity(
    { declaresAgents: outcome.declaresAgents, declaresMcp: outcome.declaresMcp },
    probe,
  );
  switch (outcome.partition) {
    case "updated":
      return updatedRowFromOutcome(outcome, target.scope, {
        updated: successSeverity,
        partiallyInstalled: successSeverity,
      });
    case "unchanged": {
      // D-10-13: the ceiling disclosure -- the effective range and its
      // holders -- rides the SAME cause-line carrier the `skipped` arm
      // reads; `undefined` for an unconstrained up-to-date plugin, so its
      // row stays byte-identical (NREG-01).
      const cause = constraintCauseFor(outcome);

      return {
        status: "skipped",
        name: outcome.name,
        scope: target.scope,
        reasons: ["up-to-date"],
        severity: "info",
        needsReload: false,
        ...(cause !== undefined && { cause }),
      };
    }

    case "skipped":
      return projectSkippedOutcome(target, outcome, cardinality);
    case "failed":
      return {
        status: "failed",
        name: outcome.name,
        scope: target.scope,
        reasons: outcome.reasons,
        severity: "error",
        needsReload: false,
      };
  }
}

interface MarketplaceGroup {
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: UpdateMsg[];
}

function groupCascadeOutcomes(
  outcomes: readonly UpdateCascadeOutcome[],
  probe: SoftDepStatus,
  cardinality: "single" | "plural",
): Plural<MarketplaceRows<UpdateMsg>> {
  const byMarketplace = new Map<string, MarketplaceGroup>();
  for (const { target, outcome } of outcomes) {
    if (cardinality === "plural" && outcome.partition === "unchanged") {
      continue;
    }

    const key = `${target.scope}:${target.marketplace}`;
    const row = outcomeToCascadePluginMessage(target, outcome, probe, cardinality);
    const existing = byMarketplace.get(key);
    if (existing === undefined) {
      byMarketplace.set(key, {
        name: target.marketplace,
        scope: target.scope,
        plugins: [row],
      });
    } else {
      existing.plugins.push(row);
    }
  }

  return [...byMarketplace.values()]
    .filter((group) => group.plugins.length > 0)
    .sort((left, right) =>
      compareByNameThenScope(
        { name: left.name, scope: left.scope },
        { name: right.name, scope: right.scope },
      ),
    )
    .map((group) => ({
      name: group.name,
      scope: group.scope,
      plugins: group.plugins,
    }));
}

/** Composes and emits one exact update cascade from ordered plugin outcomes. */
export function composeUpdateCascade(
  ctx: NotificationContext,
  pi: ToolInventory,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  abortedByFailure = false,
): void {
  const marketplaces = groupCascadeOutcomes(outcomes, softDepStatus(pi), cardinality);
  const updatedCount = outcomes.filter(({ outcome }) => outcome.partition === "updated").length;
  const hasErrorOrWarningRow = marketplaces.some((marketplace) =>
    marketplace.plugins.some(
      (plugin) => plugin.severity === "error" || plugin.severity === "warning",
    ),
  );

  if (
    cardinality === "plural" &&
    updatedCount === 0 &&
    !hasErrorOrWarningRow &&
    !abortedByFailure
  ) {
    notifyUpdateNoOpWithContext(ctx, pi, UPDATE_CONTEXT, marketplaces, cardinality);
    return;
  }

  if (abortedByFailure && marketplaces.length === 0) {
    return;
  }

  notifyUpdateWithContext(ctx, pi, UPDATE_CONTEXT, marketplaces, cardinality, {
    verb: "updated",
    count: updatedCount,
  });
}
