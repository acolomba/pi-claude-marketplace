import assert from "node:assert/strict";
import test from "node:test";

import {
  builtinRegistrationRefused,
  builtinServerOwner,
  createBuiltinMcpStatusReader,
  noteBuiltinServerOwners,
  noteFreshBuiltinRegistration,
  noteRefusedBuiltinRegistration,
  noteReplacedBuiltinRegistration,
} from "../../extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts";

import type { McpStatusReader } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type {
  PiInventory,
  PiMcpRegistry,
  RegisteredMcpServer,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type BuiltinPi = Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">;

// Pi's tool items carry `namespace` and `exposure` beside the fields
// `ToolInventoryItem` declares.
type PiTool = ToolInventoryItem & { readonly namespace?: unknown; readonly exposure?: unknown };

function registered(name: string): RegisteredMcpServer {
  return {
    name,
    config: { command: "node" },
    extensionPath: "/extensions/pi-claude-marketplace",
  } satisfies RegisteredMcpServer;
}

function mcpTool(namespace: string, exposure: string, name = `${namespace}__echo`): PiTool {
  return { name, namespace: { name: namespace, aliases: ["plugin"] }, exposure };
}

/** A Pi whose registry lists `servers` and whose tool list holds `tools`. */
function piWith(servers: readonly string[], tools: readonly PiTool[]): BuiltinPi {
  return {
    getMcpServers: () => servers.map(registered),
    getAllTools: () => tools,
  } satisfies BuiltinPi;
}

// MSEL-01: the factory builds the reader before every extension has loaded.
test("MSEL-01: building the built-in status reader reads nothing from Pi", () => {
  // arrange
  const reads: string[] = [];
  const pi = {
    getMcpServers: () => {
      reads.push("getMcpServers");
      return [];
    },
    getAllTools: () => {
      reads.push("getAllTools");
      return [];
    },
  } satisfies BuiltinPi;

  // act
  createBuiltinMcpStatusReader(pi);

  // assert
  assert.deepStrictEqual(reads, []);
});

for (const { label, servers, tools, answer } of [
  {
    label: "a name Pi does not list",
    servers: ["plugin_alpha_db"],
    tools: [mcpTool("mcp__plugin_alpha_api", "deferred")],
    answer: "unlisted",
  },
  {
    label: "a name Pi does not list, with hidden tools of an earlier registration",
    servers: [],
    tools: [mcpTool("mcp__plugin_alpha_api", "hidden")],
    answer: "unlisted",
  },
  {
    label: "a registered server with a deferred tool",
    servers: ["plugin_alpha_api"],
    tools: [mcpTool("mcp__plugin_alpha_api", "deferred")],
    answer: "connected",
  },
  {
    label: "a registered server with a direct tool beside a hidden one",
    servers: ["plugin_alpha_api"],
    tools: [
      mcpTool("mcp__plugin_alpha_api", "hidden", "mcp__plugin_alpha_api__drop"),
      mcpTool("mcp__plugin_alpha_api", "direct"),
    ],
    answer: "connected",
  },
  {
    label: "a registered server whose tool carries no exposure",
    servers: ["plugin_alpha_api"],
    tools: [{ name: "mcp__plugin_alpha_api__echo", namespace: { name: "mcp__plugin_alpha_api" } }],
    answer: "connected",
  },
  {
    label: "a registered server whose every tool is hidden",
    servers: ["plugin_alpha_api"],
    tools: [
      mcpTool("mcp__plugin_alpha_api", "hidden", "mcp__plugin_alpha_api__drop"),
      mcpTool("mcp__plugin_alpha_api", "hidden"),
    ],
    answer: "disabled",
  },
  {
    label: "a registered server with no tool",
    servers: ["plugin_alpha_api"],
    tools: [],
    answer: "not-connected",
  },
  {
    label: "a registered server whose namespace holds only another server's tools",
    servers: ["plugin_alpha_api", "plugin_alpha_db"],
    tools: [mcpTool("mcp__plugin_alpha_db", "direct")],
    answer: "not-connected",
  },
  {
    label: "a registered server beside tools with no or malformed namespaces",
    servers: ["plugin_alpha_api"],
    tools: [
      { name: "read", exposure: "direct" },
      { name: "mcp__plugin_alpha_api__a", namespace: "mcp__plugin_alpha_api", exposure: "direct" },
      { name: "mcp__plugin_alpha_api__b", namespace: null, exposure: "direct" },
      { name: "mcp__plugin_alpha_api__c", namespace: { aliases: [] }, exposure: "direct" },
    ],
    answer: "not-connected",
  },
] as const satisfies readonly {
  label: string;
  servers: readonly string[];
  tools: readonly PiTool[];
  answer: ReturnType<McpStatusReader["lookup"]>;
}[]) {
  test(`BLT-05 / P2-DC-10: the built-in status reader answers ${answer} for ${label}`, () => {
    // arrange
    const reader = createBuiltinMcpStatusReader(piWith(servers, tools));

    // act
    const status = reader.lookup("plugin_alpha_api");

    // assert
    assert.strictEqual(status, answer);
  });
}

test("BLT-05: the built-in status reader matches a server name's namespace with every - folded to _", () => {
  // arrange
  const reader = createBuiltinMcpStatusReader(
    piWith(["plugin_my-plugin_my-api"], [mcpTool("mcp__plugin_my_plugin_my_api", "hidden")]),
  );

  // act
  const status = reader.lookup("plugin_my-plugin_my-api");

  // assert
  assert.strictEqual(status, "disabled");
});

test("BLT-05: the built-in status reader reads Pi again at every lookup", () => {
  // arrange
  let tools: readonly PiTool[] = [];
  const reader = createBuiltinMcpStatusReader({
    getMcpServers: () => [registered("plugin_alpha_api")],
    getAllTools: () => tools,
  } satisfies BuiltinPi);
  const before = reader.lookup("plugin_alpha_api");
  tools = [mcpTool("mcp__plugin_alpha_api", "deferred")];

  // act
  const after = reader.lookup("plugin_alpha_api");

  // assert
  assert.deepStrictEqual([before, after], ["not-connected", "connected"]);
});

test("P2-DC-10: a server whose registration replaced another config answers not-connected while its tools are hidden", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_api");
  });
  const reader = createBuiltinMcpStatusReader(
    piWith(["plugin_alpha_api"], [mcpTool("mcp__plugin_alpha_api", "hidden")]),
  );
  noteReplacedBuiltinRegistration("plugin_alpha_api");

  // act
  const status = reader.lookup("plugin_alpha_api");

  // assert
  assert.strictEqual(status, "not-connected");
});

test("P2-DC-10: a replaced server that connects again answers connected", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_api");
  });
  const reader = createBuiltinMcpStatusReader(
    piWith(["plugin_alpha_api"], [mcpTool("mcp__plugin_alpha_api", "deferred")]),
  );
  noteReplacedBuiltinRegistration("plugin_alpha_api");

  // act
  const status = reader.lookup("plugin_alpha_api");

  // assert
  assert.strictEqual(status, "connected");
});

test("P2-DC-10: a fresh registration after a replacement makes hidden tools read disabled again", () => {
  // arrange
  const reader = createBuiltinMcpStatusReader(
    piWith(["plugin_alpha_api"], [mcpTool("mcp__plugin_alpha_api", "hidden")]),
  );
  noteReplacedBuiltinRegistration("plugin_alpha_api");
  noteFreshBuiltinRegistration("plugin_alpha_api");

  // act
  const status = reader.lookup("plugin_alpha_api");

  // assert
  assert.strictEqual(status, "disabled");
});

test("P2-DC-10: a replacement of one server leaves another server's hidden tools disabled", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_db");
  });
  const reader = createBuiltinMcpStatusReader(
    piWith(["plugin_alpha_api"], [mcpTool("mcp__plugin_alpha_api", "hidden")]),
  );
  noteReplacedBuiltinRegistration("plugin_alpha_db");

  // act
  const status = reader.lookup("plugin_alpha_api");

  // assert
  assert.strictEqual(status, "disabled");
});

test("P2-DC-14: each noted name answers its owner and a name the sync does not register answers none", (t) => {
  // arrange
  t.after(() => {
    noteBuiltinServerOwners(new Map());
  });
  const project = { scope: "project", marketplace: "mp", plugin: "alpha" } as const;
  noteBuiltinServerOwners(new Map([["plugin_alpha_api", project]]));

  // act
  const owners = [builtinServerOwner("plugin_alpha_api"), builtinServerOwner("plugin_alpha_db")];

  // assert
  assert.deepStrictEqual(owners, [project, undefined]);
});

test("P2-DC-14: a later sync's owners replace every earlier owner", (t) => {
  // arrange
  t.after(() => {
    noteBuiltinServerOwners(new Map());
  });
  const user = { scope: "user", marketplace: "mp", plugin: "alpha" } as const;
  noteBuiltinServerOwners(new Map([["plugin_alpha_api", user]]));
  noteBuiltinServerOwners(new Map([["plugin_alpha_db", user]]));

  // act
  const owners = [builtinServerOwner("plugin_alpha_api"), builtinServerOwner("plugin_alpha_db")];

  // assert
  assert.deepStrictEqual(owners, [undefined, user]);
});

test("D-MB-29: a refused registration reads as refused and another name does not", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_api");
  });
  noteRefusedBuiltinRegistration("plugin_alpha_api");

  // act
  const refused = [
    builtinRegistrationRefused("plugin_alpha_api"),
    builtinRegistrationRefused("plugin_alpha_db"),
  ];

  // assert
  assert.deepStrictEqual(refused, [true, false]);
});

test("D-MB-29: a fresh registration or a removal clears a refusal", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_api");
  });
  noteRefusedBuiltinRegistration("plugin_alpha_api");
  const before = builtinRegistrationRefused("plugin_alpha_api");

  // act
  noteFreshBuiltinRegistration("plugin_alpha_api");

  // assert
  assert.deepStrictEqual([before, builtinRegistrationRefused("plugin_alpha_api")], [true, false]);
});

test("D-MB-29: a replacement clears a refusal", (t) => {
  // arrange
  t.after(() => {
    noteFreshBuiltinRegistration("plugin_alpha_api");
  });
  noteRefusedBuiltinRegistration("plugin_alpha_api");
  const before = builtinRegistrationRefused("plugin_alpha_api");

  // act
  noteReplacedBuiltinRegistration("plugin_alpha_api");

  // assert
  assert.deepStrictEqual([before, builtinRegistrationRefused("plugin_alpha_api")], [true, false]);
});
