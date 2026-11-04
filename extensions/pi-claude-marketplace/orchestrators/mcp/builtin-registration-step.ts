/**
 * The built-in MCP registration step and its resync, both seeds that do
 * nothing yet.
 *
 * Their names, input, and call sites are fixed: `session-materialize.ts` runs
 * `builtinRegistrationStep` at every `session_start`, and the extension runs
 * `resyncBuiltinRegistrations` after each load reconcile (D-MB-10). The
 * built-in registration fills both bodies in place: it registers each
 * recorded plugin MCP server with Pi's own MCP for the session (D-MB-02), a
 * project-scope server only while Pi trusts the project (D-MB-09), and a
 * background child registers for its own session and writes nothing
 * (D-MB-12).
 *
 * MSEL-03: no body may register a server while pi-mcp-adapter is the active
 * implementation, or while no implementation is active. Pi reports such a
 * registration as an extension error.
 */

import type { ExtensionContext, PiMcpRegistry } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";

/** What the registration step and its resync receive. */
export interface BuiltinRegistrationStepInput {
  /** Pi's session MCP registry, the one Pi surface the step may change. */
  readonly pi: PiMcpRegistry;
  readonly ctx: ExtensionContext;
  /** The run whose soft-dependency snapshot names the active implementation (D-05). */
  readonly snapshot: NotificationRun;
}

/** D-MB-10: registers the built-in MCP servers at `session_start`. A seed: it does nothing yet. */
export function builtinRegistrationStep(_input: BuiltinRegistrationStepInput): Promise<void> {
  return Promise.resolve();
}

/**
 * D-MB-10: brings the built-in registrations in line with the records after
 * the load reconcile. A seed: it does nothing yet.
 */
export function resyncBuiltinRegistrations(_input: BuiltinRegistrationStepInput): Promise<void> {
  return Promise.resolve();
}
