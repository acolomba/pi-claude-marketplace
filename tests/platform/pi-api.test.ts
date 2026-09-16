import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getAgentDir as peerGetAgentDir,
  parseFrontmatter as peerParseFrontmatter,
} from "@earendil-works/pi-coding-agent";

import {
  getAgentDir,
  parseFrontmatter,
  softDepStatus,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

import type * as PiBoundary from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type * as Peer from "@earendil-works/pi-coding-agent";

interface ToolDeclaration {
  name?: string;
  sourceInfo?: { source?: unknown };
}

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

/**
 * The peer's root `exports` map publishes only `.`, and its `dist/index.d.ts`
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

function toolInventory(tools: ToolDeclaration[]): PiBoundary.ToolInventory {
  return { getAllTools: () => tools };
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
} satisfies PiBoundary.SoftDepStatus);
void (true satisfies Same<PiBoundary.AgentMessage, PiBoundary.AgentEndEvent["messages"][number]>);
void (true satisfies Same<
  PiBoundary.AssistantMessage,
  Extract<PiBoundary.AgentMessage, { role: "assistant" }>
>);
void (true satisfies Same<PiBoundary.StopReason, PiBoundary.AssistantMessage["stopReason"]>);
void (true satisfies PiBoundary.ExtensionAPI extends PiBoundary.ToolInventory ? true : false);
void (true satisfies PiBoundary.ExtensionContext extends PiBoundary.NotificationContext
  ? true
  : false);
void ({ getAllTools: () => [{ name: "subagent" }] } satisfies PiBoundary.ToolInventory);
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
// @ts-expect-error soft-dependency status reports both dependencies
void ({ piSubagentsLoaded: true } satisfies PiBoundary.SoftDepStatus);
// @ts-expect-error an agent message has a supported role
void ({ role: "unsupported" } satisfies PiBoundary.AgentMessage);
// @ts-expect-error an assistant message has the assistant role
void ({ role: "user" } satisfies PiBoundary.AssistantMessage);
// @ts-expect-error a stop reason has a closed value set
void ("unsupported" satisfies PiBoundary.StopReason);
// @ts-expect-error a tool inventory must expose getAllTools
void ({} satisfies PiBoundary.ToolInventory);
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
      });
    });
  }

  for (const { tools, expectedLoaded, behavior } of [
    {
      behavior: "recognizes the mcp tool name",
      tools: [{ name: "mcp" }],
      expectedLoaded: true,
    },
    {
      behavior: "recognizes the adapter source",
      tools: [{ name: "other", sourceInfo: { source: "pi-mcp-adapter" } }],
      expectedLoaded: true,
    },
    {
      behavior: "recognizes the adapter within a source path",
      tools: [{ sourceInfo: { source: "wrapper/pi-mcp-adapter-clone" } }],
      expectedLoaded: true,
    },
    {
      behavior: "rejects a partial adapter source name",
      tools: [{ sourceInfo: { source: "pi-mcp" } }],
      expectedLoaded: false,
    },
    {
      behavior: "rejects an empty adapter source",
      tools: [{ sourceInfo: { source: "" } }],
      expectedLoaded: false,
    },
    {
      behavior: "accepts a tool without source metadata",
      tools: [{}],
      expectedLoaded: false,
    },
    {
      behavior: "rejects a non-string adapter source",
      tools: [{ sourceInfo: { source: 42 } }],
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
        piMcpAdapterLoaded: expectedLoaded,
      });
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
    });
  });

  for (const { tools, expectedStatus, behavior } of [
    {
      behavior: "reports both dependencies as loaded",
      tools: [{ name: "subagent" }, { name: "mcp" }],
      expectedStatus: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    },
    {
      behavior: "reports only subagents as loaded",
      tools: [{ name: "subagent" }],
      expectedStatus: { piSubagentsLoaded: true, piMcpAdapterLoaded: false },
    },
    {
      behavior: "reports only the MCP adapter as loaded",
      tools: [{ sourceInfo: { source: "pi-mcp-adapter" } }],
      expectedStatus: { piSubagentsLoaded: false, piMcpAdapterLoaded: true },
    },
    {
      behavior: "reports both dependencies as unloaded",
      tools: [],
      expectedStatus: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    },
  ]) {
    test(behavior, () => {
      // arrange
      const extensionApi = toolInventory(tools);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, expectedStatus);
    });
  }

  test("degrades both dependencies to unloaded when discovery fails", () => {
    // arrange
    const extensionApi: PiBoundary.ToolInventory = {
      getAllTools: () => {
        throw new Error("not ready");
      },
    };

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    });
  });
});
