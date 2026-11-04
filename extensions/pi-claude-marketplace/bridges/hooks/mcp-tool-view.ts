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
// MCP name. It keeps no tool cache across events: a server that reconnects
// registers its tools again. It keeps one answer for its generation: whether
// pi-mcp-adapter's proxy rule applies (MHK-02, D-P5-06, D-P5-07).

import { claudeFormToolName } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { openNotificationSnapshot } from "../../shared/notification-run.ts";

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
  /**
   * MHK-02, D-P5-06: whether pi-mcp-adapter is the active MCP implementation,
   * so that its proxy rule (D-CF5-12) applies. Under Pi's built-in MCP, or
   * with none, there is no proxy and the answer is false.
   */
  proxyRuleApplies(): boolean;
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
 *
 * D-P5-07: `proxyRuleApplies` takes the run snapshot at its first call and
 * keeps its answer. The set of loaded extensions changes only on `/reload` or
 * in a new Pi, and each one registers a new bridge generation with a new view.
 * The snapshot is the notification run's (D-JO-01), so the view makes the
 * same reads as every other soft-dependency check and never throws. The view
 * keeps the first answer even when a read failed: `softDepStatus` reports a
 * read that throws as not loaded, so the answer stays `false` until
 * `/reload`, and under pi-mcp-adapter each proxy call then runs its hooks on
 * the outer call and again on the nested call. At `tool_call` time the
 * session is bound, so these reads are not expected to throw.
 */
export function createHookToolView(
  pi: Pick<ExtensionAPI, "getAllTools" | "getCommands"> | undefined,
): HookToolView {
  let proxyRule: boolean | undefined;
  return {
    proxyRuleApplies() {
      proxyRule ??=
        pi !== undefined && openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter";
      return proxyRule;
    },
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
