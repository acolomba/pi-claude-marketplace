import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type * as McpResolutionOwner from "../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts";
import type { StatKindReader } from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

type OwnerShape = typeof McpResolutionOwner;
type FileValue = "dir" | { readonly contents: string };

function preserveDirectOwnerType(owner: OwnerShape): void {
  void owner;
}

function emptyResolution() {
  return {
    notes: [] as string[],
    unsupported: [] as string[],
    mcpServers: {} as Record<string, unknown>,
  };
}

function mcpFiles(files: Readonly<Record<string, FileValue>>): {
  readonly statKind: StatKindReader;
  readonly readFileText: (candidate: string) => Promise<string>;
} {
  return {
    statKind(candidate: string) {
      const file = files[candidate];
      return Promise.resolve(file === undefined ? null : file === "dir" ? "dir" : "file");
    },
    readFileText(candidate: string) {
      const file = files[candidate];
      return file !== undefined && file !== "dir"
        ? Promise.resolve(file.contents)
        : Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }));
    },
  };
}

void preserveDirectOwnerType;

test("resolves a strict string reference at inline parity", async () => {
  // arrange
  let owner: OwnerShape | undefined;
  await assert.doesNotReject(async () => {
    owner = await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  }, "mcp-resolution.ts is absent");
  assert.ok(owner !== undefined);
  const pluginRoot = "/plugins/alpha";
  const referencePath = path.join(pluginRoot, "servers.json");
  const referencedResolution = emptyResolution();
  const inlineResolution = emptyResolution();
  const deps = mcpFiles({
    [referencePath]: {
      contents: JSON.stringify({ mcpServers: { alpha: { command: "node" } } }),
    },
  });

  // act
  const referencedDirty = await owner.resolveStrictMcp(
    {
      entry: { mcpServers: "servers.json" },
      manifest: null,
      pluginRoot,
      resolution: referencedResolution,
    },
    deps,
  );
  const inlineDirty = await owner.resolveStrictMcp(
    {
      entry: { mcpServers: { alpha: { command: "node" } } },
      manifest: null,
      pluginRoot,
      resolution: inlineResolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { referencedDirty, referencedResolution, inlineDirty, inlineResolution },
    {
      referencedDirty: false,
      referencedResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { alpha: { command: "node" } },
      },
      inlineDirty: false,
      inlineResolution: { notes: [], unsupported: [], mcpServers: { alpha: { command: "node" } } },
    },
  );
});

test("prefers entry MCP and falls back to manifest MCP when the entry is absent", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const entryResolution = emptyResolution();
  const manifestResolution = emptyResolution();

  // act
  const entryDirty = await resolveStrictMcp(
    {
      entry: { mcpServers: {} },
      manifest: { mcpServers: { manifest: { command: "python" } } },
      pluginRoot: "/plugins/alpha",
      resolution: entryResolution,
    },
    mcpFiles({}),
  );
  const manifestDirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: { manifest: { command: "python" } } },
      pluginRoot: "/plugins/alpha",
      resolution: manifestResolution,
    },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(
    { entryDirty, entryResolution, manifestDirty, manifestResolution },
    {
      entryDirty: false,
      entryResolution: emptyResolution(),
      manifestDirty: false,
      manifestResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { manifest: { command: "python" } },
      },
    },
  );
});

test("accepts wrapped and unwrapped standalone documents", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const wrappedRoot = "/plugins/wrapped";
  const unwrappedRoot = "/plugins/unwrapped";
  const wrappedResolution = emptyResolution();
  const unwrappedResolution = emptyResolution();
  const deps = mcpFiles({
    [path.join(wrappedRoot, ".mcp.json")]: {
      contents: JSON.stringify({ mcpServers: { wrapped: { command: "node" } } }),
    },
    [path.join(unwrappedRoot, ".mcp.json")]: {
      contents: JSON.stringify({ unwrapped: { command: "node" } }),
    },
  });

  // act
  const wrappedDirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: wrappedRoot, resolution: wrappedResolution },
    deps,
  );
  const unwrappedDirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: unwrappedRoot, resolution: unwrappedResolution },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { wrappedDirty, wrappedResolution, unwrappedDirty, unwrappedResolution },
    {
      wrappedDirty: false,
      wrappedResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { wrapped: { command: "node" } },
      },
      unwrappedDirty: false,
      unwrappedResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { unwrapped: { command: "node" } },
      },
    },
  );
});

test("treats a missing standalone document as empty", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, { dirty: false, resolution: emptyResolution() });
});

for (const { title, reference, expectedNote } of [
  {
    title: "rejects a missing string reference",
    reference: "missing.json",
    expectedNote: 'malformed mcp reference: file not found: "missing.json"',
  },
  {
    title: "rejects an absolute string reference",
    reference: "/outside/servers.json",
    expectedNote:
      'malformed mcp reference: must be relative (got absolute "/outside/servers.json")',
  },
  {
    title: "rejects a traversing string reference",
    reference: "../outside.json",
    expectedNote: 'malformed mcp reference: escapes plugin root: "../outside.json"',
  },
] as const) {
  test(title, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: { mcpServers: reference },
        manifest: null,
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      mcpFiles({}),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: true,
        resolution: { notes: [expectedNote], unsupported: [], mcpServers: {} },
      },
    );
  });
}

for (const { title, contents, expectedNote } of [
  {
    title: "rejects malformed JSON in a string reference",
    contents: "{",
    expectedNote: 'malformed mcp reference: invalid JSON in "servers.json":',
  },
  {
    title: "rejects an unwrapped string reference",
    contents: JSON.stringify({ alpha: { command: "node" } }),
    expectedNote: 'malformed mcp reference: missing top-level "mcpServers": "servers.json"',
  },
] as const) {
  test(title, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: { mcpServers: "servers.json" },
        manifest: null,
        pluginRoot,
        resolution,
      },
      mcpFiles({ [path.join(pluginRoot, "servers.json")]: { contents } }),
    );

    // assert
    assert.strictEqual(dirty, true);
    assert.strictEqual(resolution.notes.length, 1);
    assert.ok(resolution.notes[0]?.startsWith(expectedNote));
    assert.deepStrictEqual(resolution.mcpServers, {});
  });
}

test("rejects a string reference that crosses a symlink without reading it", async (testContext) => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-resolution-symlink-"));
  const pluginRoot = path.join(temporaryRoot, "plugin");
  const outsideRoot = path.join(temporaryRoot, "outside");
  await mkdir(pluginRoot);
  await mkdir(outsideRoot);
  await symlink(outsideRoot, path.join(pluginRoot, "linked"));
  testContext.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const resolution = emptyResolution();
  let read = false;

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: "linked/servers.json" },
      manifest: null,
      pluginRoot,
      resolution,
    },
    {
      statKind: () => Promise.resolve("file"),
      readFileText: () => {
        read = true;
        return Promise.resolve("{}");
      },
    },
  );

  // assert
  assert.deepStrictEqual(
    { dirty, read, resolution },
    {
      dirty: true,
      read: false,
      resolution: {
        notes: ['malformed mcp reference: escapes plugin root: "linked/servers.json"'],
        unsupported: [],
        mcpServers: {},
      },
    },
  );
});

test("propagates an existing reference read failure", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const readFailure = Object.assign(new Error("denied"), { code: "EACCES" });

  // act & assert
  await assert.rejects(
    () =>
      resolveStrictMcp(
        {
          entry: { mcpServers: "servers.json" },
          manifest: null,
          pluginRoot: "/plugins/alpha",
          resolution: emptyResolution(),
        },
        {
          statKind: () => Promise.resolve("file"),
          readFileText: () => Promise.reject(readFailure),
        },
      ),
    (error: unknown) => error === readFailure,
  );
});

test("propagates a standalone document read failure with a non-Error rejection", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act & assert
  await assert.rejects(
    () =>
      resolveStrictMcp(
        { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
        {
          statKind: () => Promise.resolve("file"),
          readFileText: () =>
            new Promise<string>((_resolve, reject) => {
              Reflect.apply(reject, undefined, ["read failure"]);
            }),
        },
      ),
    (error: unknown) => error === "read failure",
  );
});

test("standalone document EACCES propagates (not wrapped as malformed mcpServers)", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();
  const readFailure = Object.assign(new Error("denied"), { code: "EACCES" });

  // act & assert
  await assert.rejects(
    () =>
      resolveStrictMcp(
        { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
        {
          statKind: () => Promise.resolve("file"),
          readFileText: () => Promise.reject(readFailure),
        },
      ),
    (error: unknown) => error === readFailure,
  );
});

test("classifies malformed JSON content in a standalone document", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const pluginRoot = "/plugins/alpha";
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot, resolution },
    mcpFiles({ [path.join(pluginRoot, ".mcp.json")]: { contents: "{ not json" } }),
  );

  // assert
  assert.strictEqual(dirty, true);
  assert.strictEqual(resolution.notes.length, 1);
  assert.ok(resolution.notes[0]?.startsWith("malformed mcpServers (.mcp.json):"));
  assert.deepStrictEqual(resolution.mcpServers, {});
});

test("classifies a wrapped malformed map like an inline malformed map", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const pluginRoot = "/plugins/alpha";
  const referencedResolution = emptyResolution();
  const inlineResolution = emptyResolution();
  const deps = mcpFiles({
    [path.join(pluginRoot, "servers.json")]: {
      contents: JSON.stringify({ mcpServers: ["invalid"] }),
    },
  });

  // act
  const referencedDirty = await resolveStrictMcp(
    {
      entry: { mcpServers: "servers.json" },
      manifest: null,
      pluginRoot,
      resolution: referencedResolution,
    },
    deps,
  );
  const inlineDirty = await resolveStrictMcp(
    {
      entry: { mcpServers: ["invalid"] },
      manifest: null,
      pluginRoot,
      resolution: inlineResolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { referencedDirty, referencedResolution, inlineDirty, inlineResolution },
    {
      referencedDirty: true,
      referencedResolution: {
        notes: ["malformed mcpServers: must be object"],
        unsupported: [],
        mcpServers: {},
      },
      inlineDirty: true,
      inlineResolution: {
        notes: ["malformed mcpServers: must be object"],
        unsupported: [],
        mcpServers: {},
      },
    },
  );
});

test("resolves valid inline entry MCP without filesystem access", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: { alpha: { command: "node" } } },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    {
      statKind: () => Promise.reject(new Error("must not inspect standalone MCP")),
      readFileText: () => Promise.reject(new Error("must not read standalone MCP")),
    },
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: { notes: [], unsupported: [], mcpServers: { alpha: { command: "node" } } },
    },
  );
});

test("treats fully absent strict MCP as empty", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, { dirty: false, resolution: emptyResolution() });
});

test("ANAME-07: leaves a blocked server out and records it with its feature", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {
        mcpServers: {
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
          local: { command: "node" },
        },
      },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: ["mcpServers"],
        mcpServers: { local: { command: "node" } },
        droppedMcpServers: [{ server: "live", feature: "ws" }],
      },
    },
  );
});

test("ANAME-07: records the mcpServers kind once for several blocked servers", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {
        mcpServers: {
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
          ide: { type: "sdk" },
        },
      },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: ["mcpServers"],
        mcpServers: {},
        droppedMcpServers: [
          { server: "live", feature: "ws" },
          { server: "ide", feature: "sdk" },
        ],
      },
    },
  );
});

test("ANAME-07: a malformed server adds a note and reports a structural defect", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {
        mcpServers: {
          db: { command: "node", timeout: 1.5 },
          local: { command: "node" },
        },
      },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: true,
      resolution: {
        notes: ['malformed mcp server "db": /timeout: must be integer'],
        unsupported: [],
        mcpServers: { local: { command: "node" } },
      },
    },
  );
});

test("ANAME-07: keeps a server named __proto__ as an own server", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();
  const servers: unknown = JSON.parse('{"__proto__":{"command":"node"}}');

  // act
  await resolveStrictMcp(
    { entry: { mcpServers: servers }, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(Object.entries(resolution.mcpServers), [
    ["__proto__", { command: "node" }],
  ]);
});
