/**
 * The fixed-order MCP session steps that run at every `session_start`.
 *
 * D-MB-10: the built-in MCP registration step runs first, then the agent MCP
 * grants step, both over one notification run, so both read the same
 * soft-dependency snapshot (D-05). Pi emits `session_start` only after every
 * extension has loaded, so the snapshot sees the whole inventory (MSEL-01).
 *
 * NFR-2: each step runs in its own try/catch. A step that throws or rejects is
 * debug-logged, the next step still runs, and the materializer resolves.
 */

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { openNotificationRun } from "../../shared/notification-run.ts";

import type { AgentGrantsStepInput } from "./agent-grants-step.ts";
import type { BuiltinRegistrationStepInput } from "./builtin-registration-step.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";

/** Runs the MCP session steps for one `session_start`. It never rejects (NFR-2). */
export type McpSessionMaterializer = (pi: ExtensionAPI, ctx: ExtensionContext) => Promise<void>;

/** Runs one step and debug-logs its failure instead of passing it on. */
async function runStep(name: string, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error: unknown) {
    hookDebugLog(`${name} skipped: ${errorMessage(error)}`, "mcp");
  }
}

/**
 * Creates a materializer that opens one load run and runs the two steps over
 * it: the built-in registration step first, then the agent grants step.
 */
export function createMcpSessionMaterializer(steps: {
  readonly builtinRegistrationStep: (input: BuiltinRegistrationStepInput) => Promise<void>;
  readonly agentGrantsStep: (input: AgentGrantsStepInput) => Promise<void>;
}): McpSessionMaterializer {
  return async (pi, ctx) => {
    const snapshot = openNotificationRun(pi, { kind: "load" });
    await runStep("MCP built-in registration", () =>
      steps.builtinRegistrationStep({ pi, ctx, snapshot }),
    );
    await runStep("MCP agent grants", () => steps.agentGrantsStep({ pi, ctx, snapshot }));
  };
}
