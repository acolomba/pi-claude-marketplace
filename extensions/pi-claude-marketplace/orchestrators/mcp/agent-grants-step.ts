/**
 * The agent MCP grants step, a seed that does nothing yet.
 *
 * Its name, input, and call site are fixed: `session-materialize.ts` runs it at
 * every `session_start`, after the built-in registration step. It will rewrite
 * the generated agent files whose MCP grants differ for the active
 * implementation (D-MB-03). A pi-subagents background child writes no file, so
 * the step changes nothing there (D-MB-12).
 */

import type { ExtensionContext, PiInventory } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";

/** What the agent grants step receives. */
export interface AgentGrantsStepInput {
  /** Pi's tool and command inventory, read-only. */
  readonly pi: PiInventory;
  readonly ctx: ExtensionContext;
  /** The run whose soft-dependency snapshot names the active implementation (D-05). */
  readonly snapshot: NotificationRun;
}

/** D-MB-03: brings the agent MCP grants in line with the active implementation. A seed: it does nothing yet. */
export function agentGrantsStep(_input: AgentGrantsStepInput): Promise<void> {
  return Promise.resolve();
}
