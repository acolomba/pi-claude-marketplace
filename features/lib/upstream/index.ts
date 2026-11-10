/**
 * @fileoverview The one place that reduces a companion's or Pi's own text in
 * a model call to the facts this extension owns, before a scenario compares
 * it. A scenario then pins what this extension does, and an upstream release
 * that rewords its own output breaks no scenario.
 */

import { projectMcpResult } from "./mcp.ts";
import { projectArgumentValidationFailure, projectReadResult } from "./pi.ts";
import { projectChildTask, projectSubagentResult } from "./subagents.ts";

const RESULT_PROJECTORS: ReadonlyMap<string, (text: string, failed: boolean) => string> = new Map([
  ["mcp", projectMcpResult],
  ["read", projectReadResult],
  ["subagent", projectSubagentResult],
]);

/**
 * The text of one tool result as a scenario states it. A failed result that
 * is Pi's refusal of the call's arguments reads as that refusal's projection,
 * whatever the tool.
 */
export function projectToolResult(tool: string, failed: boolean, text: string): string {
  const refused = failed ? projectArgumentValidationFailure(tool, text) : undefined;
  if (refused !== undefined) {
    return refused;
  }

  const projector = RESULT_PROJECTORS.get(tool);
  return projector === undefined ? text : projector(text, failed);
}

/** The text of one user message as a scenario states it. */
export function projectUserText(text: string): string {
  return projectChildTask(text);
}
