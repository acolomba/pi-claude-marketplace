import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DynamicBorder as peerDynamicBorder,
  getAgentDir as peerGetAgentDir,
  parseFrontmatter as peerParseFrontmatter,
} from "@earendil-works/pi-coding-agent";
import { mock, verify, when } from "strong-mock";

import {
  DynamicBorder,
  getAgentDir,
  parseFrontmatter,
  softDepStatus,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

import {
  adapterCommand,
  adapterProxyTool,
  builtinMcpCommand,
  builtinMcpTool,
  foreignMcpTool,
  forkAdapterCommand,
} from "./pi-inventory-seed.ts";

import type * as PiBoundary from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type * as Peer from "@earendil-works/pi-coding-agent";

interface ToolDeclaration {
  name?: string;
  sourceInfo?: { source?: unknown };
}

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

/**
 * The peer's root `exports` map publishes four entries -- `.`, `./rpc-entry`,
 * `./client`, `./experimental/plugin` -- and its `dist/index.d.ts`
 * re-export list omits `ResourcesDiscoverEvent` and `ResourcesDiscoverResult`.
 * That omission is why `platform/pi-api.ts` mirrors both by hand, and it is why
 * the two pins below reach the installed declarations by a route rather than by
 * name -- deep-importing `dist/core/extensions/` would name a path the peer does
 * not publish.
 *
 * The event IS reachable exactly: it is one arm of the root-exported
 * `ExtensionEvent` union, so `Same<>` states mutual assignability against the
 * upstream declaration itself and fails if the local mirror widens, narrows,
 * drops or gains a member.
 */
type UpstreamResourcesDiscoverEvent = Extract<Peer.ExtensionEvent, { type: "resources_discover" }>;

/**
 * No root-exported name reaches `ResourcesDiscoverResult`: type-level selection
 * of one overload is not something the compiler offers, so a conditional type
 * that tries to `infer` through `ExtensionAPI["on"]` matches nothing. Plain
 * assignability against the overloaded method type does resolve, so this is the
 * strongest available statement -- the peer's own `resources_discover` overload
 * accepts a handler that takes the local event mirror and returns the local
 * result mirror, which is the same check `index.ts`'s registration makes.
 *
 * It holds every member of both mirrors to the upstream member's type. It does
 * NOT catch a member dropped from the result mirror, because every upstream
 * result slot is optional and a handler returning fewer optional slots stays
 * assignable; `Same<>` on the event covers that direction for the event.
 */
type PeerChecksLocalResourcesDiscoverHandler = Peer.ExtensionAPI["on"] extends (
  event: "resources_discover",
  handler: (
    event: PiBoundary.ResourcesDiscoverEvent,
    ctx: PiBoundary.ExtensionContext,
  ) => Promise<PiBoundary.ResourcesDiscoverResult>,
) => void
  ? true
  : false;

function toolInventory(
  tools: ToolDeclaration[],
  commands: PiBoundary.CommandInventoryItem[] = [],
): PiBoundary.PiInventory {
  return { getAllTools: () => tools, getCommands: () => commands };
}

void (true satisfies Same<PiBoundary.AgentEndEvent, Peer.AgentEndEvent>);
void (true satisfies Same<PiBoundary.AgentSettledEvent, Peer.AgentSettledEvent>);
void (true satisfies Same<PiBoundary.BeforeAgentStartEvent, Peer.BeforeAgentStartEvent>);
void (true satisfies Same<
  PiBoundary.BeforeAgentStartEventResult,
  Peer.BeforeAgentStartEventResult
>);
void (true satisfies Same<PiBoundary.ExtensionAPI, Peer.ExtensionAPI>);
void (true satisfies Same<PiBoundary.ExtensionCommandContext, Peer.ExtensionCommandContext>);
void (true satisfies Same<PiBoundary.ExtensionContext, Peer.ExtensionContext>);
void (true satisfies Same<PiBoundary.InputEvent, Peer.InputEvent>);
void (true satisfies Same<PiBoundary.InputEventResult, Peer.InputEventResult>);
void (true satisfies Same<PiBoundary.SessionBeforeCompactEvent, Peer.SessionBeforeCompactEvent>);
void (true satisfies Same<PiBoundary.SessionCompactEvent, Peer.SessionCompactEvent>);
void (true satisfies Same<PiBoundary.SessionShutdownEvent, Peer.SessionShutdownEvent>);
void (true satisfies Same<PiBoundary.SessionStartEvent, Peer.SessionStartEvent>);
void (true satisfies Same<PiBoundary.ToolCallEvent, Peer.ToolCallEvent>);
void (true satisfies Same<PiBoundary.ToolCallEventResult, Peer.ToolCallEventResult>);
void (true satisfies Same<PiBoundary.ToolResultEvent, Peer.ToolResultEvent>);
void ({ type: "text", text: "message" } satisfies PiBoundary.PiTextContentBlock);
void ({
  content: [{ type: "text", text: "message" }],
  details: { command: "build" },
  isError: false,
} satisfies PiBoundary.ToolResultEventResult);
void (true satisfies Same<PiBoundary.ResourcesDiscoverEvent, UpstreamResourcesDiscoverEvent>);
void (true satisfies PeerChecksLocalResourcesDiscoverHandler);
void ({
  type: "resources_discover",
  cwd: "/project",
  reason: "reload",
} satisfies PiBoundary.ResourcesDiscoverEvent);
void ({
  skillPaths: ["/skills"],
  promptPaths: ["/prompts"],
  themePaths: ["/themes"],
} satisfies PiBoundary.ResourcesDiscoverResult);
void ({
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: false,
  workflowEngineLoaded: false,
} satisfies PiBoundary.SoftDepStatus);
void (true satisfies Same<PiBoundary.AgentMessage, PiBoundary.AgentEndEvent["messages"][number]>);
void (true satisfies Same<
  PiBoundary.AssistantMessage,
  Extract<PiBoundary.AgentMessage, { role: "assistant" }>
>);
void (true satisfies Same<PiBoundary.StopReason, PiBoundary.AssistantMessage["stopReason"]>);
void (true satisfies PiBoundary.ExtensionAPI extends PiBoundary.PiInventory ? true : false);
void (true satisfies PiBoundary.ExtensionContext extends PiBoundary.NotificationContext
  ? true
  : false);
void ({
  getAllTools: () => [{ name: "subagent" }],
  getCommands: () => [{ name: "mcp-adapter", source: "extension" }],
} satisfies PiBoundary.PiInventory);
void ({
  ui: { notify: (_message: string): void => undefined },
} satisfies PiBoundary.NotificationContext);

// @ts-expect-error a text content block requires text
void ({ type: "text" } satisfies PiBoundary.PiTextContentBlock);
// @ts-expect-error a tool result accepts text content blocks only
void ({ content: [{ type: "image", text: "message" }] } satisfies PiBoundary.ToolResultEventResult);
// @ts-expect-error a resources-discover event has a closed reason set
void ("manual" satisfies PiBoundary.ResourcesDiscoverEvent["reason"]);
// @ts-expect-error resource paths are strings
void ({ skillPaths: [42] } satisfies PiBoundary.ResourcesDiscoverResult);
// @ts-expect-error soft-dependency status reports every dependency
void ({ piSubagentsLoaded: true } satisfies PiBoundary.SoftDepStatus);
// @ts-expect-error an agent message has a supported role
void ({ role: "unsupported" } satisfies PiBoundary.AgentMessage);
// @ts-expect-error an assistant message has the assistant role
void ({ role: "user" } satisfies PiBoundary.AssistantMessage);
// @ts-expect-error a stop reason has a closed value set
void ("unsupported" satisfies PiBoundary.StopReason);
// @ts-expect-error a Pi inventory must expose getAllTools
void ({ getCommands: () => [] } satisfies PiBoundary.PiInventory);
// @ts-expect-error a Pi inventory must expose getCommands
void ({ getAllTools: () => [] } satisfies PiBoundary.PiInventory);
// @ts-expect-error a notification context must expose ui.notify
void ({ ui: {} } satisfies PiBoundary.NotificationContext);

describe("getAgentDir", () => {
  test("re-exports the peer binding", () => {
    // arrange
    const expectedGetAgentDir = peerGetAgentDir;

    // act
    const boundaryGetAgentDir = getAgentDir;

    // assert
    assert.strictEqual(boundaryGetAgentDir, expectedGetAgentDir);
  });

  test("returns the explicit Pi agent directory", (t) => {
    // arrange
    const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (previousAgentDirectory === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
      }
    });
    process.env.PI_CODING_AGENT_DIR = "/tmp/pi-api-agent";

    // act
    const agentDirectory = getAgentDir();

    // assert
    assert.strictEqual(agentDirectory, "/tmp/pi-api-agent");
  });
});

describe("parseFrontmatter", () => {
  test("re-exports the peer binding", () => {
    // arrange
    const expectedParseFrontmatter = peerParseFrontmatter;

    // act
    const boundaryParseFrontmatter = parseFrontmatter;

    // assert
    assert.strictEqual(boundaryParseFrontmatter, expectedParseFrontmatter);
  });

  test("parses a closed block and normalizes its body", () => {
    // arrange
    const document =
      "---\r\nname: helper\r\ndescription: does a thing\r\n---\r\nBody line one\r\n\r\n";

    // act
    const parsedFrontmatter = parseFrontmatter<{ name: string; description: string }>(document);

    // assert
    assert.deepStrictEqual(parsedFrontmatter, {
      frontmatter: { name: "helper", description: "does a thing" },
      body: "Body line one",
    });
  });

  test("keeps the body and returns empty metadata without an opening delimiter", () => {
    // arrange
    const document = "# Heading\r\n\r\nProse.\r\n";

    // act
    const parsedFrontmatter = parseFrontmatter(document);

    // assert
    assert.deepStrictEqual(parsedFrontmatter, {
      frontmatter: {},
      body: "# Heading\n\nProse.\n",
    });
  });

  test("returns empty metadata for an unclosed block", () => {
    // arrange
    const document = "---\nname: helper\nno closing delimiter\n";

    // act
    const parsedFrontmatter = parseFrontmatter(document);

    // assert
    assert.deepStrictEqual(parsedFrontmatter, {
      frontmatter: {},
      body: "---\nname: helper\nno closing delimiter\n",
    });
  });

  test("throws a YAML parse error for malformed metadata", () => {
    // arrange
    const document = "---\ndescription: a: b: c value\n---\nbody\n";

    // act & assert
    assert.throws(
      () => parseFrontmatter(document),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, "YAMLParseError");
        return true;
      },
    );
  });
});

describe("DynamicBorder", () => {
  test("re-exports the peer binding", () => {
    // arrange
    const expectedDynamicBorder = peerDynamicBorder;

    // act
    const boundaryDynamicBorder = DynamicBorder;

    // assert
    assert.strictEqual(boundaryDynamicBorder, expectedDynamicBorder);
  });
});

describe("softDepStatus", () => {
  for (const { tools, expectedLoaded, behavior } of [
    {
      behavior: "recognizes the subagent tool",
      tools: [{ name: "subagent" }],
      expectedLoaded: true,
    },
    {
      behavior: "ignores other named tools",
      tools: [{ name: "other" }],
      expectedLoaded: false,
    },
    {
      behavior: "ignores a source-only subagents declaration",
      tools: [{ sourceInfo: { source: "pi-subagents" } }],
      expectedLoaded: false,
    },
    {
      behavior: "accepts a tool without a name",
      tools: [{}],
      expectedLoaded: false,
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = toolInventory(tools);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, {
        piSubagentsLoaded: expectedLoaded,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      });
    });
  }

  for (const { behavior, tools, commands, expectedStatus } of [
    {
      behavior: "ADET-02 counts the adapter's proxy tool and command from npm:pi-mcp-adapter",
      tools: [adapterProxyTool()],
      commands: [adapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts a disableProxyTool adapter by its mcp-adapter command alone",
      tools: [],
      commands: [adapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts a fork install by its mcp-adapter command from a foreign source",
      tools: [],
      commands: [forkAdapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts an adapter registered twice as mcp-adapter:1 and mcp-adapter:2",
      tools: [],
      commands: [adapterCommand("mcp-adapter:1", "cli"), adapterCommand("mcp-adapter:2", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts the collision-suffixed command mcp-adapter:2",
      tools: [],
      commands: [adapterCommand("mcp-adapter:2", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts the multi-digit collision suffix mcp-adapter:10",
      tools: [],
      commands: [adapterCommand("mcp-adapter:10", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-01 does not count Pi's built-in MCP alone",
      tools: [builtinMcpTool()],
      commands: [builtinMcpCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-01 counts the adapter command beside Pi's built-in MCP",
      tools: [builtinMcpTool()],
      commands: [builtinMcpCommand(), adapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-01 reports the adapter not loaded with neither MCP client",
      tools: [],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count another extension's tool named mcp",
      tools: [foreignMcpTool()],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count the command name MCP-Adapter",
      tools: [],
      commands: [adapterCommand("MCP-Adapter", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count the command name mcp-adapter-x",
      tools: [],
      commands: [adapterCommand("mcp-adapter-x", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a collision suffix with no digits, mcp-adapter:",
      tools: [],
      commands: [adapterCommand("mcp-adapter:", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a collision suffix with a letter, mcp-adapter:1a",
      tools: [],
      commands: [adapterCommand("mcp-adapter:1a", "cli")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a prompt template named mcp-adapter",
      tools: [],
      commands: [{ ...adapterCommand("mcp-adapter", "cli"), source: "prompt" }],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a skill command named mcp-adapter",
      tools: [],
      commands: [{ ...adapterCommand("mcp-adapter", "cli"), source: "skill" }],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count an extension command without a name",
      tools: [],
      commands: [{ source: "extension", sourceInfo: { source: "cli" } }],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts a command under another name whose source names pi-mcp-adapter",
      tools: [],
      commands: [adapterCommand("mcp-tools", "npm:pi-mcp-adapter")],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts a tool under another name whose source names pi-mcp-adapter",
      tools: [{ name: "other", sourceInfo: { source: "npm:pi-mcp-adapter" } }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 counts the adapter source within a source path",
      tools: [{ sourceInfo: { source: "wrapper/pi-mcp-adapter-clone" } }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a partial adapter source name",
      tools: [{ sourceInfo: { source: "pi-mcp" } }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count an empty adapter source",
      tools: [{ sourceInfo: { source: "" } }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a tool without source metadata",
      tools: [{}],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "ADET-02 does not count a non-string adapter source",
      tools: [{ sourceInfo: { source: 42 } }],
      commands: [{ name: "other", sourceInfo: { source: 42 } }],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = toolInventory(tools, commands);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, expectedStatus);
    });
  }

  test("ADET-02 lets the tool-source arm decide when getCommands() throws", () => {
    // arrange
    const extensionApi: PiBoundary.PiInventory = {
      getAllTools: () => [adapterProxyTool()],
      getCommands: () => {
        throw new Error("not ready");
      },
    };

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: false,
    });
  });

  test("ADET-02 lets the command arm decide when getAllTools() throws", () => {
    // arrange
    const extensionApi: PiBoundary.PiInventory = {
      getAllTools: () => {
        throw new Error("not ready");
      },
      getCommands: () => [forkAdapterCommand()],
    };

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: false,
    });
  });

  for (const { behavior, tools, commands, expectedStatus } of [
    {
      behavior:
        "ADET-02 reads getAllTools() three times and getCommands() once with the adapter loaded",
      tools: [adapterProxyTool()],
      commands: [adapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior:
        "ADET-01 reads getAllTools() three times and getCommands() once with only the built-in MCP",
      tools: [builtinMcpTool()],
      commands: [builtinMcpCommand()],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = mock<PiBoundary.PiInventory>({
        exactParams: true,
        name: "Pi inventory",
      });
      when(() => extensionApi.getAllTools())
        .thenReturn(tools)
        .times(3);
      when(() => extensionApi.getCommands())
        .thenReturn(commands)
        .times(1);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, expectedStatus);
      verify(extensionApi);
    });
  }

  test("degrades to unloaded when a tool name accessor fails", () => {
    // arrange
    const inaccessibleTool = Object.defineProperty({}, "name", {
      get: () => {
        throw new Error("inaccessible");
      },
    });
    const extensionApi = toolInventory([inaccessibleTool]);

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    });
  });

  for (const { tools, expectedLoaded, behavior } of [
    {
      behavior: "WDEP-01 recognizes the workflow_control tool name",
      tools: [{ name: "workflow_control" }],
      expectedLoaded: true,
    },
    {
      // WDEP-01: the discriminating case. `@nicknisi/pi-workflows` registers a
      // tool named `workflow` and no `workflow_control`, so a bare-name probe
      // would report that engine as the host.
      behavior: "WDEP-01 rejects a session exposing only the decoy `workflow` tool name",
      tools: [{ name: "workflow" }],
      expectedLoaded: false,
    },
    {
      // WDEP-01: the host engine's real session shape -- it registers BOTH
      // names, so the probe must SELECT on the discriminator while the decoy is
      // present, not merely reject an absent name.
      behavior: "WDEP-01 recognizes workflow_control beside the decoy `workflow` tool name",
      tools: [{ name: "workflow" }, { name: "workflow_control" }],
      expectedLoaded: true,
    },
    {
      behavior: "WDEP-01 reports unloaded for an empty tool list",
      tools: [],
      expectedLoaded: false,
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = toolInventory(tools);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: expectedLoaded,
      });
    });
  }

  for (const { tools, commands, expectedStatus, behavior } of [
    {
      behavior: "reports every dependency as loaded",
      tools: [{ name: "subagent" }, { name: "workflow_control" }],
      commands: [adapterCommand()],
      expectedStatus: {
        piSubagentsLoaded: true,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: true,
      },
    },
    {
      behavior: "reports only subagents as loaded",
      tools: [{ name: "subagent" }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: true,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
    {
      behavior: "reports only the MCP adapter as loaded",
      tools: [{ sourceInfo: { source: "pi-mcp-adapter" } }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      },
    },
    {
      // WDEP-01: `softDepStatus` composes the third field from the SAME tool
      // list the standalone probe reads -- the discriminator alone is enough,
      // and it moves no other field.
      behavior: "WDEP-01 reports the host engine alone as loaded",
      tools: [{ name: "workflow_control" }],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: true,
      },
    },
    {
      behavior: "reports every dependency as unloaded",
      tools: [],
      commands: [],
      expectedStatus: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = toolInventory(tools, commands);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, expectedStatus);
    });
  }

  test("ADET-02 degrades every dependency to unloaded when both Pi reads throw", () => {
    // arrange
    const extensionApi: PiBoundary.PiInventory = {
      getAllTools: () => {
        throw new Error("not ready");
      },
      getCommands: () => {
        throw new Error("not ready");
      },
    };

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    });
  });
});
