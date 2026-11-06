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
// pi-mcp-adapter's proxy rule applies. That answer comes from the first probe
// whose reads all succeed (MHK-02, D-P5-06, D-P5-07, HOOKTOOLREAD-01).

import {
  claudeFormToolName,
  MCP_TOOL_PREFIX,
} from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { openNotificationSnapshot } from "../../shared/notification-run.ts";

import type { McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import type { ExtensionAPI, PiInventory } from "../../platform/pi-api.ts";

// Pi loads its built-in MCP extension from this path, so every tool it
// registers carries it as `sourceInfo.path`. Another module holds a private
// copy of the same literal.
const BUILTIN_MCP_SOURCE_PATH = "builtin:mcp";

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

// HOOKTOOLREAD-01: Pi's own reads, with each read that throws recorded in
// `failures` and thrown again, so the snapshot handles it as Pi's own throw.
function watchedInventory(pi: PiInventory, failures: unknown[]): PiInventory {
  const watch = <T>(read: () => T): T => {
    try {
      return read();
    } catch (error: unknown) {
      failures.push(error);
      throw error;
    }
  };

  return {
    getAllTools: () => watch(() => pi.getAllTools()),
    getCommands: () => watch(() => pi.getCommands()),
  };
}

// HOOKTOOLREAD-01, OBS-01: writes one debug line for the first failed read it
// gets and nothing for the later ones.
function createReadFailureReporter(): (error: unknown) => void {
  let reported = false;
  return (error) => {
    if (reported) {
      return;
    }

    reported = true;
    hookDebugLog(
      `mcp-tool-view: a read of Pi's tools or commands failed (logged once per bridge load): ${errorMessage(error)}`,
      "mcp",
    );
  };
}

/**
 * D-P5-01: the view over the tools `pi` lists. `identify` reads nothing when
 * there is no Pi API or the name is not an MCP name; otherwise it reads the
 * tool list once. A read that throws names no built-in server, so the hooks
 * see Pi's name, and it never fails the event.
 *
 * D-P5-07: `proxyRuleApplies` takes the run snapshot and keeps the answer of
 * the first probe whose reads all succeed. The set of loaded extensions
 * changes only on `/reload` or in a new Pi, and each one registers a new
 * bridge generation with a new view. The snapshot is the notification run's
 * (D-JO-01), so the view makes the same reads as every other soft-dependency
 * check and never throws. HOOKTOOLREAD-01: a probe in which a read of Pi's
 * tools or commands threw keeps no answer. It answers that one call, and the
 * next call probes again. At `tool_call` time the session is bound, so these
 * reads are not expected to throw.
 *
 * OBS-01: the first failed read of a generation, in `identify` or in a probe,
 * writes one `mcp` debug line. Nothing reaches the user.
 */
export function createHookToolView(
  pi: Pick<ExtensionAPI, "getAllTools" | "getCommands"> | undefined,
): HookToolView {
  const reportReadFailure = createReadFailureReporter();
  let proxyRule: boolean | undefined;
  return {
    proxyRuleApplies() {
      if (proxyRule !== undefined) {
        return proxyRule;
      }

      if (pi === undefined) {
        proxyRule = false;
        return proxyRule;
      }

      const failures: unknown[] = [];
      const answer =
        openNotificationSnapshot(watchedInventory(pi, failures)).softDeps.mcpImplementation ===
        "adapter";
      if (failures.length > 0) {
        reportReadFailure(failures[0]);
        return answer;
      }

      proxyRule = answer;
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
        reportReadFailure(error);
        return asPiNames(piName);
      }
    },
  };
}
