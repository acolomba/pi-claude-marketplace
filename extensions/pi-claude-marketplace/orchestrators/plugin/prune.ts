// A standalone, same-scope orphan sweep. The declaration walk and every
// removal share one locked state snapshot; cleanup and notification follow
// the state commit.

import { locationsFor } from "../../persistence/locations.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";

import { buildScopeDeclarationIndex } from "./dependency-index.ts";
import { UNINSTALL_CONTEXT } from "./uninstall.messaging.ts";
import { finalizePrunedMembers, sweepOrphans } from "./uninstall.ts";

import type { UninstallHooksRouting, UninstallTransaction } from "./uninstall.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";

/** Inputs for an actual orphan sweep in exactly one scope. */
export interface PrunePluginOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly cwd: string;
  readonly scope?: Scope;
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
      const at = outcome.declarer.lastIndexOf("@");
      const plugin = outcome.declarer.slice(0, at);
      const marketplace = outcome.declarer.slice(at + 1);
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
                cause: outcome.cause,
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
        undefined,
        "single",
      );
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
