// bridges/hooks/mcp-tool-view.ts
//
// The tool of a tool event as the hooks see it (MHK-01, D-P5-01, D-P5-02).
// Pi's built-in MCP folds `-` in a server's name to `_` in its tool names,
// while Claude Code keeps `-`. Pi's tool list keeps the registered server
// name as the namespace alias of each tool its built-in MCP serves, so the
// view reads that list when a tool event's hooks are about to run and gives
// them the tool under Claude's server segment.
//
// The view reads nothing when it is created, so a bridge generation can make
// one at registration (MSEL-01), and nothing for a tool whose name is not an
// MCP name. It keeps no cache across events: a server that reconnects
// registers its tools again.

import { claudeFormToolName } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import type { ExtensionAPI } from "../../platform/pi-api.ts";

// Pi loads its built-in MCP extension from this path, so every tool it
// registers carries it as `sourceInfo.path`. The frozen platform probe that
// compares the same literal is private to its module.
const BUILTIN_MCP_SOURCE_PATH = "builtin:mcp";

const MCP_TOOL_PREFIX = "mcp__";

type PiTool = ReturnType<ExtensionAPI["getAllTools"]>[number];

/** The tool of a tool event, with the name every hook sees (D-P5-03). */
export interface HookTool extends McpToolIdentity {
  /**
   * The tool name of the hook's stdin, its notice label, and every label the
   * model reads: Claude's form for a tool of Pi's built-in MCP, else Pi's name.
   */
  readonly name: string;
}

/** The dispatch-time view of the tools Pi lists. */
export interface HookToolView {
  /** The tool the event names `piName`, read from Pi's tool list once per call. */
  identify(piName: string): HookTool;
}

function asPiNames(piName: string): HookTool {
  return { piName, name: piName, builtinServer: undefined };
}

// D-P5-01: a tool counts as a tool of Pi's built-in MCP only when Pi's own
// loader registered it and its namespace keeps the server's registered name.
function hookToolFor(piName: string, tool: PiTool | undefined): HookTool {
  const namespace = tool?.namespace;
  const server = namespace?.aliases?.[0];
  if (
    tool?.sourceInfo.path !== BUILTIN_MCP_SOURCE_PATH ||
    namespace === undefined ||
    server === undefined
  ) {
    return asPiNames(piName);
  }

  return {
    piName,
    name: claudeFormToolName(piName, namespace.name, server),
    builtinServer: server,
  };
}

/**
 * D-P5-01: the view over the tools `pi` lists. `identify` reads nothing when
 * there is no Pi API or the name is not an MCP name; otherwise it reads the
 * tool list once. A read that throws keeps Pi's name, with a debug line
 * (OBS-01), and never fails the event.
 */
export function createHookToolView(
  pi: Pick<ExtensionAPI, "getAllTools" | "getCommands"> | undefined,
): HookToolView {
  return {
    identify(piName) {
      if (pi === undefined || !piName.startsWith(MCP_TOOL_PREFIX)) {
        return asPiNames(piName);
      }

      try {
        return hookToolFor(
          piName,
          pi.getAllTools().find((tool) => tool.name === piName),
        );
      } catch (error: unknown) {
        hookDebugLog(`mcp-tool-view: tool read failed for ${piName}: ${errorMessage(error)}`);
        return asPiNames(piName);
      }
    },
  };
}
