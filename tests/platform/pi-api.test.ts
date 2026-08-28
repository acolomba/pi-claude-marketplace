import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getAgentDir as peerGetAgentDir,
  parseFrontmatter as peerParseFrontmatter,
} from "@earendil-works/pi-coding-agent";

import {
  getAgentDir,
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
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

function extensionApiWithTools(tools: ToolDeclaration[]): PiBoundary.ExtensionAPI {
  return { getAllTools: () => tools } as unknown as PiBoundary.ExtensionAPI;
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

describe("getAgentDir", () => {
  test("re-exports the peer binding", () => {
    // arrange
    const expectedGetAgentDir = peerGetAgentDir;

    // act
    const boundaryGetAgentDir = getAgentDir;

    // assert
    assert.strictEqual(boundaryGetAgentDir, expectedGetAgentDir);
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

describe("hasLoadedPiSubagents", () => {
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
      const extensionApi = extensionApiWithTools(tools);

      // act
      const isLoaded = hasLoadedPiSubagents(extensionApi);

      // assert
      assert.strictEqual(isLoaded, expectedLoaded);
    });
  }

  test("degrades to unloaded when tool discovery fails", () => {
    // arrange
    const extensionApi = {
      getAllTools: () => {
        throw new Error("not ready");
      },
    } as unknown as PiBoundary.ExtensionAPI;

    // act
    const isLoaded = hasLoadedPiSubagents(extensionApi);

    // assert
    assert.strictEqual(isLoaded, false);
  });

  test("degrades to unloaded when a tool name accessor fails", () => {
    // arrange
    const inaccessibleTool = Object.defineProperty({}, "name", {
      get: () => {
        throw new Error("inaccessible");
      },
    });
    const extensionApi = extensionApiWithTools([inaccessibleTool]);

    // act
    const isLoaded = hasLoadedPiSubagents(extensionApi);

    // assert
    assert.strictEqual(isLoaded, false);
  });
});

describe("hasLoadedPiMcpAdapter", () => {
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
      const extensionApi = extensionApiWithTools(tools);

      // act
      const isLoaded = hasLoadedPiMcpAdapter(extensionApi);

      // assert
      assert.strictEqual(isLoaded, expectedLoaded);
    });
  }

  test("degrades to unloaded when tool discovery fails", () => {
    // arrange
    const extensionApi = {
      getAllTools: () => {
        throw new Error("not ready");
      },
    } as unknown as PiBoundary.ExtensionAPI;

    // act
    const isLoaded = hasLoadedPiMcpAdapter(extensionApi);

    // assert
    assert.strictEqual(isLoaded, false);
  });

  test("degrades to unloaded when a tool name accessor fails", () => {
    // arrange
    const inaccessibleTool = Object.defineProperty({}, "name", {
      get: () => {
        throw new Error("inaccessible");
      },
    });
    const extensionApi = extensionApiWithTools([inaccessibleTool]);

    // act
    const isLoaded = hasLoadedPiMcpAdapter(extensionApi);

    // assert
    assert.strictEqual(isLoaded, false);
  });
});

describe("softDepStatus", () => {
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
      const extensionApi = extensionApiWithTools(tools);

      // act
      const status = softDepStatus(extensionApi);

      // assert
      assert.deepStrictEqual(status, expectedStatus);
    });
  }

  test("degrades both dependencies to unloaded when discovery fails", () => {
    // arrange
    const extensionApi = {
      getAllTools: () => {
        throw new Error("not ready");
      },
    } as unknown as PiBoundary.ExtensionAPI;

    // act
    const status = softDepStatus(extensionApi);

    // assert
    assert.deepStrictEqual(status, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    });
  });
});
