// A standalone, same-scope orphan sweep. Actual removals share one locked
// snapshot; preview selects from one nonpersisting read.

import { pruneOrphans } from "../../domain/dependency-orphans.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";

import { buildScopeDeclarationIndex } from "./dependency-index.ts";
import { UNINSTALL_CONTEXT } from "./uninstall.messaging.ts";
import { finalizePrunedMembers, sweepOrphans } from "./uninstall.ts";

import type { UninstallHooksRouting, UninstallTransaction } from "./uninstall.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";

/** Inputs for an orphan sweep or read-only preview in exactly one scope. */
export interface PrunePluginOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly cwd: string;
  readonly scope?: Scope;
  readonly dryRun?: boolean;
}

/** Reports a declaration read failure without exposing an absolute path. */
function notifyUnreadable(
  options: PrunePluginOptions,
  scope: Scope,
  declarer: string,
  cause: Error,
): void {
  const at = declarer.lastIndexOf("@");
  const plugin = declarer.slice(0, at);
  const marketplace = declarer.slice(at + 1);
  notifyWithContext(
    options.ctx,
    options.pi,
    UNINSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            name: plugin,
            reasons: ["unreadable"],
            cause,
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
}

/** Binds the standalone sweep to uninstall's guarded removal capabilities. */
export function createPrunePlugin(
  transaction: UninstallTransaction,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): (options: PrunePluginOptions) => Promise<void> {
  return async (options): Promise<void> => {
    const scope = options.scope ?? "user";
    const locations = locationsFor(scope, options.cwd);
    if (options.dryRun === true) {
      const state = await loadState(locations.extensionRoot, { persistMigration: false });
      const snapshot = await buildScopeDeclarationIndex({ state, locations });
      if (!snapshot.ok) {
        notifyUnreadable(options, scope, snapshot.declarer, snapshot.cause);
        return;
      }

      const order = pruneOrphans(snapshot.candidates, snapshot.index, new Set<string>());
      const marketplaces = order.flatMap((key) =>
        snapshot.candidates
          .filter((candidate) => candidate.key === key)
          .map((candidate) => ({
            name: candidate.marketplace.name,
            scope,
            plugins: [
              {
                status: "will uninstall" as const,
                name: candidate.plugin,
                reasons: ["dependency pruned" as const],
                severity: "info" as const,
                needsReload: false,
              },
            ],
          })),
      );
      if (marketplaces.length > 0) {
        notify(options.ctx, options.pi, { kind: "cascade", marketplaces, cardinality: "single" });
      }

      return;
    }

    const outcome = await transaction.withLockedStateTransaction(locations, async (tx) => {
      const snapshot = await buildScopeDeclarationIndex({ state: tx.state, locations });
      if (!snapshot.ok) {
        return { kind: "unreadable" as const, declarer: snapshot.declarer, cause: snapshot.cause };
      }

      const members = await sweepOrphans({
        snapshot,
        initiallyGone: new Set<string>(),
        locations,
        keepData: false,
        cascade: transaction.cascadeUnstagePlugin,
        transaction,
      });
      if (members.length > 0) {
        await tx.save();
      }

      return { kind: "swept" as const, members };
    });

    if (outcome.kind === "unreadable") {
      notifyUnreadable(options, scope, outcome.declarer, outcome.cause);
      return;
    }

    await finalizePrunedMembers({
      members: outcome.members,
      hooksRouting,
      completionCache,
      locations,
      scope,
      keepData: false,
      transaction,
    });
    if (outcome.members.length === 0) {
      return;
    }

    notifyWithContext(
      options.ctx,
      options.pi,
      UNINSTALL_CONTEXT,
      outcome.members.map((member) => ({
        name: member.marketplace,
        scope,
        plugins: [member.row],
      })),
      undefined,
      "single",
    );
  };
}
