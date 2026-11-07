// bridges/agents/grant-forms.ts
//
// MGRT-01: the grant form of each MCP implementation for one generated agent.
// The stage writes the active implementation's form and records both forms on
// the agent's index row when they differ, so a load after a switch can swap
// the file's frontmatter block without converting the agent again.
//
//   1. Each form maps the declared servers its implementation's profile
//      supports, in declaration order. For the adapter form these are the
//      servers the mcp phase writes (ANAME-02).
//   2. A grant of any other server is dropped from that form with the
//      converter's usual warning.
//   3. AG-11 per form: the file's form converts through `convertAgent`, so an
//      explicit `tools:` list that maps to nothing fails the staging; the
//      other form converts through `convertAgentForm`, and an empty list
//      leaves that form out of the row. GRANTFORMGAP-01: a switch to the
//      implementation whose form the row leaves out keeps the agent's file
//      and row as they are. The index cannot store an empty form, because
//      pi-subagents cannot express "no tools" (AG-11). pi-subagents 0.84.0
//      refuses to launch such an agent, with an error that names the `mcp:`
//      selectors it cannot resolve, under both implementations. `list` and
//      `info` mark the plugin for the server the new implementation cannot
//      run.

import { profileFor } from "../../domain/mcp-implementation.ts";
import { storedGrantForms } from "../../persistence/agents-index-io.ts";

import { convertAgent, convertAgentForm } from "./convert.ts";

import type { ConvertAgentInput } from "./convert.ts";
import type { ConvertedAgent, StageAgentsInput } from "./types.ts";
import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { AgentGrantForm, AgentGrantFormFields } from "../../persistence/agents-index-io.ts";

/** The conversion input both forms share; each form adds its implementation and servers. */
export type GrantFormInput = Omit<ConvertAgentInput, "mcpServerNames" | "mcpImplementation">;

/**
 * MGRT-01 / ANAME-02: converts one agent for the stage. Each form maps the
 * declared servers its implementation's profile supports; the adapter
 * form's servers are the ones the mcp phase writes. With no `grantForms`
 * the plugin declares no MCP server: the agent converts in the adapter form
 * over no server, and the row records nothing. Otherwise the file gets the
 * built-in form when the active implementation is built-in and the adapter
 * form otherwise (`none` included), and `recorded` holds the row's
 * `mcpImplementation` and `mcpForms` when the two forms' frontmatter blocks
 * differ.
 */
export function convertAgentGrantForms(
  input: GrantFormInput,
  grantForms: StageAgentsInput["mcpGrantForms"],
): {
  readonly agent: ConvertedAgent;
  readonly recorded: AgentGrantFormFields;
} {
  if (grantForms === undefined) {
    return { agent: convertAgent(formInput(input, "adapter", {})), recorded: {} };
  }

  // MGRT-01: with no active implementation the file gets the adapter form,
  // the form every earlier release wrote.
  const fileForm: McpImplementationId =
    grantForms.active === "none" ? "adapter" : grantForms.active;
  const otherForm: McpImplementationId = fileForm === "builtin" ? "adapter" : "builtin";
  const agent = convertAgent(formInput(input, fileForm, grantForms.declaredMcpServers));
  const other = convertAgentForm(formInput(input, otherForm, grantForms.declaredMcpServers));
  if (other?.frontmatter === agent.frontmatter) {
    return { agent, recorded: {} };
  }

  return {
    agent,
    recorded: storedGrantForms(
      fileForm,
      storedForm(agent),
      other === undefined ? undefined : storedForm(other),
    ),
  };
}

/**
 * ANAME-02 / MGRT-01: the declared servers `implementation` can run, in
 * declaration order. `Object.entries` reads own keys only, so a server named
 * `__proto__` stays a server.
 */
function serverNamesFor(
  implementation: McpImplementationId,
  declaredMcpServers: Readonly<Record<string, unknown>>,
): string[] {
  const profile = profileFor(implementation);
  return Object.entries(declaredMcpServers)
    .filter(([, config]) => profile.classify(config).kind === "supported")
    .map(([name]) => name);
}

/** The conversion input of `implementation`'s form, over the servers it runs. */
function formInput(
  input: GrantFormInput,
  implementation: McpImplementationId,
  declaredMcpServers: Readonly<Record<string, unknown>>,
): ConvertAgentInput {
  return {
    ...input,
    mcpImplementation: implementation,
    mcpServerNames: serverNamesFor(implementation, declaredMcpServers),
  };
}

/** A form as the row stores it: copies, so the row shares no array with the agent. */
function storedForm(agent: ConvertedAgent): AgentGrantForm {
  return {
    frontmatter: agent.frontmatter,
    warnings: [...agent.warnings],
    droppedTools: [...agent.droppedTools],
  };
}
