// bridges/agents/grant-forms.ts
//
// MGRT-01: the grant form of each MCP implementation for one generated agent.
// The stage writes the active implementation's form and records both forms on
// the agent's index row when they differ, so a load after a switch can swap
// the file's frontmatter block without converting the agent again.
//
//   1. The adapter form maps the servers the caller passes as
//      `mcpServerNames`, the adapter-supported subset (ANAME-02).
//   2. The built-in form maps the declared servers whose built-in verdict is
//      supported, in declaration order. A grant of any other server is
//      dropped with the converter's usual warning.
//   3. AG-11 per form: the file's form converts through `convertAgent`, so an
//      explicit `tools:` list that maps to nothing fails the staging; the
//      other form converts through `convertAgentForm`, and an empty list
//      leaves that form out of the row.

import { profileFor } from "../../domain/mcp-implementation.ts";

import { convertAgent, convertAgentForm } from "./convert.ts";

import type { ConvertAgentInput } from "./convert.ts";
import type { ConvertedAgent, StageAgentsInput } from "./types.ts";
import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

/**
 * MGRT-01: converts one agent for the stage. `input` is the adapter form's
 * conversion input; its `mcpServerNames` is the adapter's server set. With
 * no `grantForms` the agent converts as before and the row records nothing.
 * Otherwise the file gets the built-in form when the active implementation
 * is built-in and the adapter form otherwise (`none` included), and
 * `recorded` holds the row's `mcpImplementation` and `mcpForms` when the two
 * forms' frontmatter blocks differ.
 */
export function convertAgentGrantForms(
  input: ConvertAgentInput,
  grantForms: StageAgentsInput["mcpGrantForms"],
): {
  readonly agent: ConvertedAgent;
  readonly recorded: Pick<AgentsIndexEntry, "mcpImplementation" | "mcpForms">;
} {
  if (grantForms === undefined) {
    return { agent: convertAgent(input), recorded: {} };
  }

  const fileForm: McpImplementationId = grantForms.active === "builtin" ? "builtin" : "adapter";
  const otherForm: McpImplementationId = fileForm === "builtin" ? "adapter" : "builtin";
  const builtinServers = builtinServerNames(grantForms.declaredMcpServers);
  const agent = convertAgent(formInput(input, fileForm, builtinServers));
  const other = convertAgentForm(formInput(input, otherForm, builtinServers));
  if (other?.frontmatter === agent.frontmatter) {
    return { agent, recorded: {} };
  }

  const mcpForms: NonNullable<AgentsIndexEntry["mcpForms"]> = { [fileForm]: storedForm(agent) };
  if (other !== undefined) {
    mcpForms[otherForm] = storedForm(other);
  }

  return { agent, recorded: { mcpImplementation: fileForm, mcpForms } };
}

/**
 * The declared servers Pi's built-in MCP can run, in declaration order.
 * `Object.entries` reads own keys only, so a server named `__proto__` stays
 * a server.
 */
function builtinServerNames(declaredMcpServers: Readonly<Record<string, unknown>>): string[] {
  const builtin = profileFor("builtin");
  return Object.entries(declaredMcpServers)
    .filter(([, config]) => builtin.classify(config).kind === "supported")
    .map(([name]) => name);
}

function formInput(
  input: ConvertAgentInput,
  form: McpImplementationId,
  builtinServers: readonly string[],
): ConvertAgentInput {
  return form === "builtin"
    ? { ...input, mcpImplementation: "builtin", mcpServerNames: builtinServers }
    : { ...input, mcpImplementation: "adapter" };
}

/** A form as the row stores it: copies, so the row shares no array with the agent. */
function storedForm(agent: ConvertedAgent): {
  frontmatter: string;
  warnings: string[];
  droppedTools: string[];
} {
  return {
    frontmatter: agent.frontmatter,
    warnings: [...agent.warnings],
    droppedTools: [...agent.droppedTools],
  };
}
