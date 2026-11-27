// orchestrators/plugin/update-cascade.ts
//
// Owns update result projection, marketplace grouping, exact tally selection,
// severity, and reload-hint routing. Invocation cardinality remains structural.

import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import {
  notifyUpdateNoOpWithContext,
  notifyUpdateWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { companionSeverity, skipSeverity } from "../../shared/notify-reasons.ts";

import { withCloneNote } from "./install.messaging.ts";
import { constraintCauseFor, revisionVersionSlot, updatedRowFromOutcome } from "./update-row.ts";
import { UPDATE_CONTEXT, type UpdateMsg } from "./update.messaging.ts";

import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { NotificationContext, SoftDepStatus } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { CloneTransportNote, ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { GitHubCloneNotes } from "../github-transport.ts";
import type { PluginUpdateSkippedOutcome } from "../types.ts";
import type { DirectRenderableOutcome } from "./update-swap.ts";

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

/**
 * D-SG-22: the clone notes an update command's rows read. `plugins` holds the
 * notes of the plugin clones, keyed by `<plugin>@<marketplace>`, so a moved
 * dependency's row reads its own key. `marketplace` gives the note of the
 * PUP-2 sync that re-cloned marketplace `name` in `scope`, and undefined for
 * a sync that cloned nothing.
 */
export interface UpdateCloneNotes {
  readonly plugins: GitHubCloneNotes;
  readonly marketplace: (scope: Scope, name: string) => CloneTransportNote | undefined;
}

/** One update result with the target facts required for exact row composition. */
export interface UpdateCascadeOutcome {
  readonly target: UpdateCascadeTarget;
  readonly outcome: DirectRenderableOutcome;
  /**
   * D-SG-22: the notes of this target's own clones, which its rows read in
   * place of the command's `plugins` notes. A command that updates one
   * `<plugin>@<marketplace>` in both scopes keeps each scope's notes here, so
   * neither row reads the other scope's clone.
   */
  readonly notes?: GitHubCloneNotes;
}

function cascadeSkipSeverity(
  reasons: readonly ContentReason[],
  cardinality: "single" | "plural",
): "info" | "warning" | "error" {
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

function projectSkippedOutcome(
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
    {
      declaresAgents: outcome.declaresAgents,
      declaresMcp: outcome.declaresMcp,
      declaresWorkflows: outcome.declaresWorkflows,
    },
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
        // UPR-03: a failure before any candidate names the installed version.
        ...revisionVersionSlot(outcome),
        reasons: outcome.reasons,
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
        severity: "error",
        needsReload: false,
      };
  }
}

interface MarketplaceGroup {
  readonly name: string;
  readonly scope: Scope;
  readonly clone?: CloneTransportNote;
  readonly plugins: UpdateMsg[];
}

/**
 * The rows of one outcome. UPD-DEP-D1: the dependencies the update changed
 * render beside its row. D-SG-22: each row reads the note of its own subject
 * from `notes`; a dependency row is named by its full key. A bulk update
 * drops an up-to-date row unless its update ran a GitHub clone the row names.
 */
function cascadeRows(
  target: UpdateCascadeTarget,
  outcome: DirectRenderableOutcome,
  probe: SoftDepStatus,
  cardinality: "single" | "plural",
  notes: GitHubCloneNotes | undefined,
): UpdateMsg[] {
  const subject = `${outcome.name}@${target.marketplace}`;
  if (
    cardinality === "plural" &&
    outcome.partition === "unchanged" &&
    notes?.noteFor(subject) === undefined
  ) {
    return [];
  }

  return [
    withCloneNote(
      outcomeToCascadePluginMessage(target, outcome, probe, cardinality),
      notes,
      subject,
    ),
    ...(outcome.dependencyRows ?? []).map((row) => withCloneNote(row, notes, row.name)),
  ];
}

/**
 * Groups the rows of `outcomes` by marketplace and scope. D-SG-22: every
 * outcome makes its marketplace's group, so the group carries the note of the
 * PUP-2 sync that re-cloned that marketplace; a group with no rows is kept
 * only when it carries that note. When the target `abortedBy` stopped the
 * batch, its failure notification already shows that target's block with the
 * sync's note, so a group of that target's marketplace and scope with no rows
 * would only repeat it and is dropped. A group of another marketplace keeps
 * its note, which no other notification shows.
 */
function groupCascadeOutcomes(
  outcomes: readonly UpdateCascadeOutcome[],
  probe: SoftDepStatus,
  cardinality: "single" | "plural",
  clones: UpdateCloneNotes | undefined,
  abortedBy: UpdateCascadeTarget | undefined,
): Plural<MarketplaceRows<UpdateMsg>> {
  const byMarketplace = new Map<string, MarketplaceGroup>();
  for (const { target, outcome, notes } of outcomes) {
    const key = `${target.scope}:${target.marketplace}`;
    // D-SG-22: a target's own notes win over the command's.
    const rows = cascadeRows(target, outcome, probe, cardinality, notes ?? clones?.plugins);
    const existing = byMarketplace.get(key);
    if (existing === undefined) {
      const clone = clones?.marketplace(target.scope, target.marketplace);
      byMarketplace.set(key, {
        name: target.marketplace,
        scope: target.scope,
        ...(clone !== undefined && { clone }),
        plugins: rows,
      });
    } else {
      existing.plugins.push(...rows);
    }
  }

  return [...byMarketplace.values()]
    .filter(
      (group) =>
        group.plugins.length > 0 ||
        (group.clone !== undefined &&
          (group.name !== abortedBy?.marketplace || group.scope !== abortedBy.scope)),
    )
    .sort((left, right) =>
      compareByNameThenScope(
        { name: left.name, scope: left.scope },
        { name: right.name, scope: right.scope },
      ),
    )
    .map((group) => ({
      name: group.name,
      scope: group.scope,
      ...(group.clone !== undefined && { clone: group.clone }),
      plugins: group.plugins,
    }));
}

/**
 * Composes and emits one exact update cascade from ordered plugin outcomes.
 * D-05: the row severity stamps and the emitted markers read the run's one
 * soft-dependency snapshot. D-SG-22: `clones` gives each row and block the
 * note of the GitHub clone it ran; with none, no row names a clone.
 * `abortedBy` is the target whose separately reported failure stopped the
 * batch, and undefined when the batch ran to its end.
 */
export function composeUpdateCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  abortedBy?: UpdateCascadeTarget,
  clones?: UpdateCloneNotes,
): void {
  const abortedByFailure = abortedBy !== undefined;
  const marketplaces = groupCascadeOutcomes(outcomes, run.softDeps, cardinality, clones, abortedBy);
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
    notifyUpdateNoOpWithContext(ctx, run, UPDATE_CONTEXT, marketplaces, cardinality);
    return;
  }

  if (abortedByFailure && marketplaces.length === 0) {
    return;
  }

  notifyUpdateWithContext(ctx, run, UPDATE_CONTEXT, marketplaces, cardinality, {
    verb: "updated",
    count: updatedCount,
  });
}
