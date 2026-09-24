// A standalone, same-scope orphan sweep. Actual removals share one locked
// snapshot; preview selects from one nonpersisting read.

import { rename, rm } from "node:fs/promises";

import { pruneOrphans } from "../../domain/dependency-orphans.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { redactCauseChain } from "../../shared/redact-absolute-paths.ts";

import { buildScopeDeclarationIndex } from "./dependency-index.ts";
import { preparePruneRollback } from "./prune-rollback.ts";
import { UNINSTALL_CONTEXT } from "./uninstall.messaging.ts";
import { finalizePrunedMembers, sweepOrphans } from "./uninstall.ts";

import type { PruneRestoreFailure } from "./prune-rollback.ts";
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

class PruneRollbackError extends Error {
  readonly failures: readonly PruneRestoreFailure[];

  constructor(primary: unknown, failures: readonly PruneRestoreFailure[], backupName: string) {
    super(
      `Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying.`,
      { cause: primary },
    );
    this.failures = failures;
  }
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

/** Reports a prune operation failure without attributing it to a declaration. */
function notifyOperationFailure(options: PrunePluginOptions, scope: Scope, error: unknown): void {
  const cause = redactCauseChain(error) ?? new Error(errorMessage(error));
  const rollbackPartial =
    error instanceof PruneRollbackError
      ? error.failures.map((failure) => ({
          phase: failure.phase,
          // Every failure has an Error; the redactor returns undefined only for nullish input.
          cause: redactCauseChain(failure.cause) as unknown as Error,
        }))
      : undefined;
  let reason: "rollback partial" | "lock held" | "unreadable" = "unreadable";
  if (rollbackPartial !== undefined) {
    reason = "rollback partial";
  } else if (error instanceof StateLockHeldError) {
    reason = "lock held";
  }

  notifyWithContext(
    options.ctx,
    options.pi,
    UNINSTALL_CONTEXT,
    [
      {
        name: "(prune)",
        scope,
        plugins: [
          {
            status: "failed",
            name: "(prune)",
            reasons: [reason],
            cause,
            ...(rollbackPartial !== undefined && { rollbackPartial }),
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

async function finalizeCommittedMembers(
  args: Parameters<typeof finalizePrunedMembers>[0],
): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const member of args.members) {
    try {
      await finalizePrunedMembers({ ...args, members: [member] });
    } catch (error: unknown) {
      failures.push(error);
    }
  }

  return failures;
}

function notifyCommitted(
  options: PrunePluginOptions,
  scope: Scope,
  members: Awaited<ReturnType<typeof sweepOrphans>>,
  postCommitFailures: readonly unknown[],
): void {
  if (members.length === 0) {
    notify(options.ctx, options.pi, { kind: "prune-empty", scope });
    return;
  }

  const warningCause =
    postCommitFailures.length > 0
      ? new Error(postCommitFailures.map(errorMessage).join("; "))
      : undefined;
  const warningMember = members.find((member) => member.removed) ?? members[0];
  notifyWithContext(
    options.ctx,
    options.pi,
    UNINSTALL_CONTEXT,
    members.map((member) => ({
      name: member.marketplace,
      scope,
      plugins: [
        warningCause !== undefined && member === warningMember
          ? {
              ...member.row,
              severity: "warning" as const,
              needsReload: true,
              cause: redactCauseChain(
                new Error(
                  [member.row.cause, warningCause]
                    .filter((cause) => cause !== undefined)
                    .map(errorMessage)
                    .join("; "),
                ),
              ) as unknown as Error,
            }
          : member.row,
      ],
    })),
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
      try {
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
        } else {
          notify(options.ctx, options.pi, { kind: "prune-empty", scope });
        }
      } catch (error: unknown) {
        notifyOperationFailure(options, scope, error);
      }

      return;
    }

    let outcome:
      | { readonly kind: "unreadable"; readonly declarer: string; readonly cause: Error }
      | { readonly kind: "swept"; readonly members: Awaited<ReturnType<typeof sweepOrphans>> };
    let savedMembers: Awaited<ReturnType<typeof sweepOrphans>> | undefined;
    const postCommitFailures: unknown[] = [];
    try {
      outcome = await transaction.withLockedStateTransaction(locations, async (tx) => {
        const snapshot = await buildScopeDeclarationIndex({ state: tx.state, locations });
        if (!snapshot.ok) {
          return {
            kind: "unreadable" as const,
            declarer: snapshot.declarer,
            cause: snapshot.cause,
          };
        }

        const order = pruneOrphans(snapshot.candidates, snapshot.index, new Set<string>());
        const candidates = snapshot.candidates.filter((candidate) => order.includes(candidate.key));
        const backup =
          candidates.length > 0
            ? await preparePruneRollback(locations, candidates, { rename, removeBackup: rm })
            : undefined;
        let members: Awaited<ReturnType<typeof sweepOrphans>>;
        try {
          members = await sweepOrphans({
            snapshot,
            initiallyGone: new Set<string>(),
            locations,
            keepData: false,
            cascade: transaction.cascadeUnstagePlugin,
            transaction,
          });
          if (backup !== undefined) {
            await backup.markUnstaged();
          }

          if (members.length > 0) {
            await tx.save();
            savedMembers = members;
          }
        } catch (error: unknown) {
          if (backup !== undefined) {
            const failures = await backup.rollback();
            if (failures.length > 0) {
              throw new PruneRollbackError(error, failures, backup.backupName);
            }
          }

          throw error;
        }

        if (backup !== undefined) {
          await backup.discard();
        }

        return { kind: "swept" as const, members };
      });
    } catch (error: unknown) {
      if (savedMembers === undefined) {
        notifyOperationFailure(options, scope, error);
        return;
      }

      postCommitFailures.push(error);
      outcome = { kind: "swept", members: savedMembers };
    }

    if (outcome.kind === "unreadable") {
      notifyUnreadable(options, scope, outcome.declarer, outcome.cause);
      return;
    }

    postCommitFailures.push(
      ...(await finalizeCommittedMembers({
        members: outcome.members,
        hooksRouting,
        completionCache,
        locations,
        scope,
        keepData: false,
        transaction,
      })),
    );
    notifyCommitted(options, scope, outcome.members, postCommitFailures);
  };
}
