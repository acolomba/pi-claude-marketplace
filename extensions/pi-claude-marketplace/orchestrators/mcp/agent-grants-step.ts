/**
 * The agent MCP grants step.
 *
 * `session-materialize.ts` runs it at
 * every `session_start`, after the built-in registration step. A switch
 * between MCP implementations is installing or removing pi-mcp-adapter, which
 * runs no plugin command, so this step is what brings the generated agent
 * files in line with the active implementation: it swaps each file whose
 * stored grant form differs for the active form (MGRT-01, D-MB-03). The file
 * format work lives in the agents bridge (`bridges/agents/grant-rewrite.ts`);
 * this step decides when, which scopes, and holds the scope's state lock.
 *
 * - With no active implementation, and in a pi-subagents background child, it
 *   returns before it reads the context; a child changes no installation
 *   state (MGRT-02, D-MB-12).
 * - It handles the user scope, then the project scope only while Pi trusts
 *   the project (D-LOC-01).
 * - Per scope, an unlocked read of the agents index decides whether any row
 *   needs a rewrite; only then does it take the scope's state lock. It takes
 *   the lock alone, with no `state.json` read: the rewrite never reads that
 *   file, so a `state.json` that does not load blocks nothing, and the file
 *   stays untouched. The rewrite checks the lock is still held before each
 *   write (D-06).
 * - It reports nothing to the user (RECON-05). A held lock skips the scope
 *   until the next load, any other failure, a context that throws included,
 *   is debug-logged on the `mcp` channel, and the step never rejects (NFR-2).
 */

import { needsAgentGrantRewrite, rewriteAgentGrantForms } from "../../bridges/agents/index.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isSubagentChild } from "../../platform/subagent-child.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { createRemovalOps } from "../../shared/fs-utils.ts";
import { withExistingScopeLock } from "../../transaction/with-state-guard.ts";

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { ExtensionContext, PiInventory } from "../../platform/pi-api.ts";
import type { SubagentChildEnv } from "../../platform/subagent-child.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";

/** What the agent grants step receives. */
export interface AgentGrantsStepInput {
  /** Pi's tool and command inventory, read-only. */
  readonly pi: PiInventory;
  readonly ctx: ExtensionContext;
  /** The run whose soft-dependency snapshot names the active implementation (D-05). */
  readonly snapshot: NotificationRun;
}

/** Rewrites one scope's agent grants; never rejects. */
async function rewriteScope(scope: Scope, cwd: string, active: McpImplementationId): Promise<void> {
  try {
    const locations = locationsFor(scope, cwd);
    if (!(await needsAgentGrantRewrite(locations, active))) {
      return;
    }

    // The index the unlocked read found lies in the extension root, so the
    // lock-only primitive, which creates no directory, can take the lock.
    await withExistingScopeLock(locations, async (assertLockHeld) => {
      await rewriteAgentGrantForms(locations, active, createRemovalOps(), assertLockHeld);
    });
  } catch (error: unknown) {
    const reason =
      error instanceof StateLockHeldError ? "its state lock is held" : errorMessage(error);
    hookDebugLog(`agent grants of the ${scope} scope skipped: ${reason}`, "mcp");
  }
}

/**
 * MGRT-01 / D-MB-03: brings the generated agent files' MCP grants in line with
 * the active implementation. `env` is where the pi-subagents child marker is
 * read (MGRT-02).
 */
export async function agentGrantsStep(
  input: AgentGrantsStepInput,
  env: SubagentChildEnv,
): Promise<void> {
  const active = input.snapshot.softDeps.mcpImplementation;
  if (isSubagentChild(env) || active === "none") {
    return;
  }

  try {
    const cwd = input.ctx.cwd;
    await rewriteScope("user", cwd, active);
    if (input.ctx.isProjectTrusted()) {
      await rewriteScope("project", cwd, active);
    }
  } catch (error: unknown) {
    hookDebugLog(`agent grants skipped: ${errorMessage(error)}`, "mcp");
  }
}
