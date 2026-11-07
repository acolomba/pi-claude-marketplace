import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveStrictMcp } from "../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts";

import type { McpResolution } from "../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts";
import type { StatKindReader } from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

type FileValue = "dir" | { readonly contents: string };

function emptyResolution() {
  return {
    notes: [] as string[],
    unsupported: [] as string[],
    mcpServers: {} as Record<string, unknown>,
    declaredMcpServers: {} as Record<string, unknown>,
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

// The same files, recording every path the resolver stats and reads.
function recordedMcpFiles(files: Readonly<Record<string, FileValue>>): {
  readonly statKind: StatKindReader;
  readonly readFileText: (candidate: string) => Promise<string>;
  readonly stats: string[];
  readonly reads: string[];
} {
  const deps = mcpFiles(files);
  const stats: string[] = [];
  const reads: string[] = [];
  return {
    stats,
    reads,
    statKind(candidate: string) {
      stats.push(candidate);
      return deps.statKind(candidate);
    },
    readFileText(candidate: string) {
      reads.push(candidate);
      return deps.readFileText(candidate);
    },
  };
}

test("resolves a strict string reference at inline parity", async () => {
  // arrange
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
        declaredMcpServers: { alpha: { command: "node" } },
      },
      inlineDirty: false,
      inlineResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { alpha: { command: "node" } },
        declaredMcpServers: { alpha: { command: "node" } },
      },
    },
  );
});

test("D-CF6-01: reads the manifest MCP and ignores the entry MCP when a plugin.json exists", async () => {
  // arrange
  const objectEntryResolution = emptyResolution();
  const stringEntryResolution = emptyResolution();
  const deps = recordedMcpFiles({
    "/plugins/alpha/servers.json": {
      contents: JSON.stringify({ mcpServers: { entry: { command: "node" } } }),
    },
  });

  // act
  const objectEntryDirty = await resolveStrictMcp(
    {
      entry: { mcpServers: { entry: { command: "node" } } },
      manifest: { mcpServers: { manifest: { command: "python" } } },
      pluginRoot: "/plugins/alpha",
      resolution: objectEntryResolution,
    },
    deps,
  );
  const stringEntryDirty = await resolveStrictMcp(
    {
      entry: { mcpServers: "servers.json" },
      manifest: { mcpServers: { manifest: { command: "python" } } },
      pluginRoot: "/plugins/alpha",
      resolution: stringEntryResolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    {
      objectEntryDirty,
      objectEntryResolution,
      stringEntryDirty,
      stringEntryResolution,
      reads: deps.reads,
    },
    {
      objectEntryDirty: false,
      objectEntryResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { manifest: { command: "python" } },
        declaredMcpServers: { manifest: { command: "python" } },
      },
      stringEntryDirty: false,
      stringEntryResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { manifest: { command: "python" } },
        declaredMcpServers: { manifest: { command: "python" } },
      },
      reads: [],
    },
  );
});

test("D-CF6-01: reads the entry MCP after .mcp.json when the plugin has no plugin.json", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({ e: { command: "mcpjson-e" }, f: { command: "mcpjson-f" } }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: { e: { command: "entry-e" } } },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, order: Object.keys(resolution.mcpServers) },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { e: { command: "entry-e" }, f: { command: "mcpjson-f" } },
        declaredMcpServers: { e: { command: "entry-e" }, f: { command: "mcpjson-f" } },
      },
      order: ["e", "f"],
    },
  );
});

test("D-CF6-01: merges .mcp.json and the manifest, a later server replacing an earlier one in place", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({
        mcpServers: { a: { command: "mcpjson-a" }, c: { command: "mcpjson-c" } },
      }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: { a: { command: "manifest-a" }, b: { command: "manifest-b" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, order: Object.keys(resolution.mcpServers) },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: {
          a: { command: "manifest-a" },
          c: { command: "mcpjson-c" },
          b: { command: "manifest-b" },
        },
        declaredMcpServers: {
          a: { command: "manifest-a" },
          c: { command: "mcpjson-c" },
          b: { command: "manifest-b" },
        },
      },
      order: ["a", "c", "b"],
    },
  );
});

test("D-CF6-01: reads an array of references and maps in order", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({ x: { command: "mcpjson-x" }, z: { command: "mcpjson-z" } }),
    },
    "/plugins/alpha/a.json": {
      contents: JSON.stringify({ mcpServers: { x: { command: "filea-x" } } }),
    },
    "/plugins/alpha/b.json": { contents: JSON.stringify({ x: { command: "fileb-x" } }) },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: ["./a.json", { y: { command: "inline-y" } }, "./b.json"] },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, order: Object.keys(resolution.mcpServers) },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: {
          x: { command: "fileb-x" },
          z: { command: "mcpjson-z" },
          y: { command: "inline-y" },
        },
        declaredMcpServers: {
          x: { command: "fileb-x" },
          z: { command: "mcpjson-z" },
          y: { command: "inline-y" },
        },
      },
      order: ["x", "z", "y"],
    },
  );
});

test("D-CF6-01: refuses an array holding an element that is neither a reference nor a map, with one note", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = recordedMcpFiles({});

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: ["./a.json", { y: { command: "inline-y" } }, 1, 2] },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, stats: deps.stats },
    {
      dirty: true,
      resolution: {
        notes: ["malformed mcpServers: must be object"],
        unsupported: [],
        mcpServers: {},
        declaredMcpServers: {},
      },
      stats: ["/plugins/alpha/.mcp.json"],
    },
  );
});

for (const bundle of ["server.mcpb", "./server.dxt"] as const) {
  test(`D-CF6-01: marks the bundle reference ${bundle} unsupported without reading it`, async () => {
    // arrange
    const resolution = emptyResolution();
    const deps = recordedMcpFiles({
      "/plugins/alpha/.mcp.json": { contents: JSON.stringify({ local: { command: "node" } }) },
    });

    // act
    const dirty = await resolveStrictMcp(
      { entry: {}, manifest: { mcpServers: bundle }, pluginRoot: "/plugins/alpha", resolution },
      deps,
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution, stats: deps.stats, reads: deps.reads },
      {
        dirty: false,
        resolution: {
          notes: [],
          unsupported: ["mcpServers"],
          mcpServers: { local: { command: "node" } },
          declaredMcpServers: { local: { command: "node" } },
          mcpBundle: true,
        },
        stats: ["/plugins/alpha/.mcp.json"],
        reads: ["/plugins/alpha/.mcp.json"],
      },
    );
  });
}

test("D-CF6-01: records the mcpServers kind once for a bundle and a blocked server", async () => {
  // arrange
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: {
        mcpServers: ["./server.mcpb", { live: { type: "ws", url: "wss://mcp.example.com/ws" } }],
      },
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
        declaredMcpServers: { live: { type: "ws", url: "wss://mcp.example.com/ws" } },
        droppedMcpServers: [{ server: "live", feature: "ws" }],
        mcpBundle: true,
      },
    },
  );
});

test("D-CF6-01: a later supported server replaces an earlier blocked one of the same name", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({ live: { type: "ws", url: "wss://mcp.example.com/ws" } }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: { live: { command: "node" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { live: { command: "node" } },
        declaredMcpServers: { live: { command: "node" } },
      },
    },
  );
});

test("D-CF6-01: a later blocked server replaces an earlier supported one and is left out", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": { contents: JSON.stringify({ live: { command: "node" } }) },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: { live: { type: "ws", url: "wss://mcp.example.com/ws" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
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
        declaredMcpServers: { live: { type: "ws", url: "wss://mcp.example.com/ws" } },
        droppedMcpServers: [{ server: "live", feature: "ws" }],
      },
    },
  );
});

test("D-CF6-01: keeps Claude Code's object order for integer-like server names across sources", async () => {
  // arrange
  const resolution: McpResolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({
        b: { type: "ws", url: "wss://mcp.example.com/ws" },
        "10": { command: "node" },
      }),
    },
  });

  // act
  await resolveStrictMcp(
    {
      entry: {},
      manifest: {
        mcpServers: {
          a: { command: "node" },
          "2": { type: "ws", url: "wss://mcp.example.com/ws" },
        },
      },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    {
      declared: Object.keys(resolution.declaredMcpServers),
      supported: Object.keys(resolution.mcpServers),
      dropped: resolution.droppedMcpServers,
    },
    {
      declared: ["2", "10", "b", "a"],
      supported: ["10", "a"],
      dropped: [
        { server: "2", feature: "ws" },
        { server: "b", feature: "ws" },
      ],
    },
  );
});

test("accepts wrapped and unwrapped standalone documents", async () => {
  // arrange
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
        declaredMcpServers: { wrapped: { command: "node" } },
      },
      unwrappedDirty: false,
      unwrappedResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { unwrapped: { command: "node" } },
        declaredMcpServers: { unwrapped: { command: "node" } },
      },
    },
  );
});

test("treats a missing standalone document as empty", async () => {
  // arrange
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
  test(`D-CF6-02: ${title} without reading it`, async () => {
    // arrange
    const resolution = emptyResolution();
    const deps = recordedMcpFiles({});

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: { mcpServers: reference },
        manifest: null,
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      deps,
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution, stats: deps.stats, reads: deps.reads },
      {
        dirty: true,
        resolution: {
          notes: [expectedNote],
          unsupported: [],
          mcpServers: {},
          declaredMcpServers: {},
        },
        stats: ["/plugins/alpha/.mcp.json"],
        reads: [],
      },
    );
  });
}

const REFERENCE_PATH = "/plugins/alpha/servers.json";

for (const { title, referenceFiles } of [
  { title: "a missing string reference", referenceFiles: {} },
  { title: "a string reference that is a directory", referenceFiles: { [REFERENCE_PATH]: "dir" } },
  {
    title: "a string reference holding malformed JSON",
    referenceFiles: { [REFERENCE_PATH]: { contents: "{" } },
  },
  {
    title: "a string reference holding no server map",
    referenceFiles: { [REFERENCE_PATH]: { contents: "[1]" } },
  },
  {
    title: "a string reference whose wrapped map is not an object",
    referenceFiles: {
      [REFERENCE_PATH]: { contents: JSON.stringify({ mcpServers: ["invalid"] }) },
    },
  },
] satisfies readonly {
  readonly title: string;
  readonly referenceFiles: Readonly<Record<string, FileValue>>;
}[]) {
  test(`D-CF6-02: skips ${title} silently and keeps the .mcp.json servers`, async () => {
    // arrange
    const resolution = emptyResolution();
    const deps = mcpFiles({
      "/plugins/alpha/.mcp.json": { contents: JSON.stringify({ local: { command: "node" } }) },
      ...referenceFiles,
    });

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: {},
        manifest: { mcpServers: "./servers.json" },
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      deps,
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          notes: [],
          unsupported: [],
          mcpServers: { local: { command: "node" } },
          declaredMcpServers: { local: { command: "node" } },
        },
      },
    );
  });
}

test("D-CF6-01: reads an unwrapped string reference", async () => {
  // arrange
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
    mcpFiles({
      [path.join(pluginRoot, "servers.json")]: {
        contents: JSON.stringify({ alpha: { command: "node" } }),
      },
    }),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { alpha: { command: "node" } },
        declaredMcpServers: { alpha: { command: "node" } },
      },
    },
  );
});

// A plugin tree on disk with reference links, read through the real file
// system so the link rule runs against real links.
async function linkedPluginTree(
  testContext: { after: (fn: () => Promise<void>) => void },
  link: (tree: { readonly pluginRoot: string; readonly outsideRoot: string }) => Promise<void>,
): Promise<{
  readonly pluginRoot: string;
  readonly deps: {
    readonly statKind: StatKindReader;
    readonly readFileText: (candidate: string) => Promise<string>;
  };
  readonly reads: string[];
}> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-resolution-symlink-"));
  testContext.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const realRoot = await realpath(temporaryRoot);
  const pluginRoot = path.join(realRoot, "plugin");
  const outsideRoot = path.join(realRoot, "outside");
  await mkdir(pluginRoot);
  await mkdir(outsideRoot);
  await link({ pluginRoot, outsideRoot });
  const reads: string[] = [];
  return {
    pluginRoot,
    reads,
    deps: {
      async statKind(candidate: string) {
        try {
          return (await stat(candidate)).isDirectory() ? "dir" : "file";
        } catch {
          return null;
        }
      },
      readFileText(candidate: string) {
        reads.push(candidate);
        return readFile(candidate, "utf8");
      },
    },
  };
}

const LINKED_SERVERS = JSON.stringify({ mcpServers: { linked: { command: "node" } } });

test("MCPR-04: refuses a string reference whose link resolves outside the plugin root without reading it", async (testContext) => {
  // arrange
  const tree = await linkedPluginTree(testContext, async ({ pluginRoot, outsideRoot }) => {
    await writeFile(path.join(outsideRoot, "servers.json"), LINKED_SERVERS);
    await symlink(outsideRoot, path.join(pluginRoot, "linked"));
  });
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: "linked/servers.json" },
      manifest: null,
      pluginRoot: tree.pluginRoot,
      resolution,
    },
    tree.deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, reads: tree.reads, resolution },
    {
      dirty: true,
      reads: [],
      resolution: {
        notes: [
          'malformed mcp reference: symbolic link resolves outside plugin root: "linked/servers.json"',
        ],
        unsupported: [],
        mcpServers: {},
        declaredMcpServers: {},
      },
    },
  );
});

for (const { title, reference, makeLink } of [
  {
    title: "a file link",
    reference: "./servers.json",
    makeLink: (pluginRoot: string) =>
      symlink(path.join("config", "real.json"), path.join(pluginRoot, "servers.json")),
  },
  {
    title: "a directory link",
    reference: "./linked/real.json",
    makeLink: (pluginRoot: string) =>
      symlink(path.join(pluginRoot, "config"), path.join(pluginRoot, "linked")),
  },
] as const) {
  test(`MCPR-04: reads a string reference through ${title} at its target inside the plugin root`, async (testContext) => {
    // arrange
    const tree = await linkedPluginTree(testContext, async ({ pluginRoot }) => {
      await mkdir(path.join(pluginRoot, "config"));
      await writeFile(path.join(pluginRoot, "config", "real.json"), LINKED_SERVERS);
      await makeLink(pluginRoot);
    });
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      { entry: { mcpServers: reference }, manifest: null, pluginRoot: tree.pluginRoot, resolution },
      tree.deps,
    );

    // assert
    assert.deepStrictEqual(
      { dirty, reads: tree.reads, resolution },
      {
        dirty: false,
        reads: [path.join(tree.pluginRoot, "config", "real.json")],
        resolution: {
          notes: [],
          unsupported: [],
          mcpServers: { linked: { command: "node" } },
          declaredMcpServers: { linked: { command: "node" } },
        },
      },
    );
  });
}

for (const { title, makeLink } of [
  {
    title: "a dangling link",
    makeLink: (pluginRoot: string) =>
      symlink(path.join(pluginRoot, "gone.json"), path.join(pluginRoot, "servers.json")),
  },
  {
    title: "a link loop",
    makeLink: async (pluginRoot: string) => {
      await symlink(path.join(pluginRoot, "loop.json"), path.join(pluginRoot, "servers.json"));
      await symlink(path.join(pluginRoot, "servers.json"), path.join(pluginRoot, "loop.json"));
    },
  },
] as const) {
  test(`D-CF6-02: skips a string reference through ${title} silently`, async (testContext) => {
    // arrange
    const tree = await linkedPluginTree(testContext, ({ pluginRoot }) => makeLink(pluginRoot));
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: { mcpServers: "./servers.json" },
        manifest: null,
        pluginRoot: tree.pluginRoot,
        resolution,
      },
      tree.deps,
    );

    // assert
    assert.deepStrictEqual(
      { dirty, reads: tree.reads, resolution },
      { dirty: false, reads: [], resolution: emptyResolution() },
    );
  });
}

// D-CF6-02: Claude Code's loader skips every failure of its file read, the
// transient EMFILE and EIO included, and Node's refusal of a path.
for (const { title, readFailure } of [
  { title: "an EACCES error", readFailure: Object.assign(new Error("denied"), { code: "EACCES" }) },
  {
    title: "a transient EMFILE error",
    readFailure: Object.assign(new Error("too many open files"), { code: "EMFILE" }),
  },
  { title: "a transient EIO error", readFailure: Object.assign(new Error("i/o"), { code: "EIO" }) },
  {
    title: "a Node path error",
    readFailure: Object.assign(new TypeError("bad path"), { code: "ERR_INVALID_ARG_VALUE" }),
  },
] as const) {
  test(`D-CF6-02: skips a string reference whose read rejects with ${title}`, async () => {
    // arrange
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: { mcpServers: ["servers.json", { local: { command: "node" } }] },
        manifest: null,
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      {
        statKind: (candidate) =>
          Promise.resolve(candidate === "/plugins/alpha/servers.json" ? "file" : null),
        readFileText: () =>
          new Promise<string>((_resolve, reject) => {
            Reflect.apply(reject, undefined, [readFailure]);
          }),
      },
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          notes: [],
          unsupported: [],
          mcpServers: { local: { command: "node" } },
          declaredMcpServers: { local: { command: "node" } },
        },
      },
    );
  });

  test(`D-CF6-02: skips a .mcp.json whose read rejects with ${title} and keeps the manifest servers`, async () => {
    // arrange
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: {},
        manifest: { mcpServers: { local: { command: "node" } } },
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      {
        statKind: () => Promise.resolve("file"),
        readFileText: () =>
          new Promise<string>((_resolve, reject) => {
            Reflect.apply(reject, undefined, [readFailure]);
          }),
      },
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          notes: [],
          unsupported: [],
          mcpServers: { local: { command: "node" } },
          declaredMcpServers: { local: { command: "node" } },
        },
      },
    );
  });
}

// D-CF6-02: only a file-system failure skips a file source; a throw without a
// Node error code is a defect and reaches the caller.
for (const { title, failure } of [
  { title: "a non-Error value", failure: "read failure" },
  { title: "a TypeError without a code", failure: new TypeError("defect") },
] as const) {
  test(`D-CF6-02: rethrows ${title} from a string reference read`, async () => {
    // arrange

    // act
    const resolved = resolveStrictMcp(
      {
        entry: { mcpServers: ["servers.json", { local: { command: "node" } }] },
        manifest: null,
        pluginRoot: "/plugins/alpha",
        resolution: emptyResolution(),
      },
      {
        statKind: (candidate) =>
          Promise.resolve(candidate === "/plugins/alpha/servers.json" ? "file" : null),
        readFileText: () =>
          new Promise<string>((_resolve, reject) => {
            Reflect.apply(reject, undefined, [failure]);
          }),
      },
    );

    // assert
    await assert.rejects(resolved, (error: unknown) => {
      assert.strictEqual(error, failure);
      return true;
    });
  });

  test(`D-CF6-02: rethrows ${title} from the .mcp.json stat`, async () => {
    // arrange
    const reads: string[] = [];

    // act
    const resolved = resolveStrictMcp(
      {
        entry: {},
        manifest: { mcpServers: { local: { command: "node" } } },
        pluginRoot: "/plugins/alpha",
        resolution: emptyResolution(),
      },
      {
        statKind: () =>
          new Promise<"file">((_resolve, reject) => {
            Reflect.apply(reject, undefined, [failure]);
          }),
        readFileText: (candidate) => {
          reads.push(candidate);
          return Promise.resolve("{}");
        },
      },
    );

    // assert
    await assert.rejects(resolved, (error: unknown) => {
      assert.strictEqual(error, failure);
      return true;
    });
    assert.deepStrictEqual(reads, []);
  });
}

test("D-CF6-02: skips a .mcp.json whose stat fails and keeps the manifest servers", async () => {
  // arrange
  const resolution = emptyResolution();
  const reads: string[] = [];

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: { local: { command: "node" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    {
      statKind: () => Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" })),
      readFileText: (candidate) => {
        reads.push(candidate);
        return Promise.resolve("{}");
      },
    },
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, reads },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { local: { command: "node" } },
        declaredMcpServers: { local: { command: "node" } },
      },
      reads: [],
    },
  );
});

for (const documentText of ["{ not json", "5", "null", "[1]", '{"mcpServers": 5}'] as const) {
  test(`D-CF6-02: skips a .mcp.json holding ${documentText} and keeps the manifest servers`, async () => {
    // arrange
    const resolution = emptyResolution();

    // act
    const dirty = await resolveStrictMcp(
      {
        entry: {},
        manifest: { mcpServers: { local: { command: "node" } } },
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      mcpFiles({ "/plugins/alpha/.mcp.json": { contents: documentText } }),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          notes: [],
          unsupported: [],
          mcpServers: { local: { command: "node" } },
          declaredMcpServers: { local: { command: "node" } },
        },
      },
    );
  });
}

test("D-CF6-02: drops a malformed server in .mcp.json and keeps its other server, with no note", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({ ok: { command: "node" }, broken: { type: "bogus" } }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { ok: { command: "node" } },
        declaredMcpServers: { ok: { command: "node" } },
      },
    },
  );
});

test("D-CF6-02: a malformed server in a later file never replaces an earlier server of its name", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": { contents: JSON.stringify({ x: { command: "mcpjson-x" } }) },
    "/plugins/alpha/b.json": {
      contents: JSON.stringify({ x: { command: "fileb-x", timeout: 1.5 } }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: "./b.json" },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { x: { command: "mcpjson-x" } },
        declaredMcpServers: { x: { command: "mcpjson-x" } },
      },
    },
  );
});

test("D-CF6-02: skips a string reference whose path walk fails with ENOTDIR, without reading it", async (testContext) => {
  // arrange
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-resolution-notdir-"));
  testContext.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const pluginRoot = path.join(temporaryRoot, "plugin");
  await mkdir(pluginRoot);
  await writeFile(path.join(pluginRoot, "afile"), "x");
  const resolution = emptyResolution();
  const deps = recordedMcpFiles({
    [path.join(pluginRoot, ".mcp.json")]: {
      contents: JSON.stringify({ local: { command: "node" } }),
    },
  });

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: { mcpServers: "afile/servers.json" }, pluginRoot, resolution },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, reads: deps.reads },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { local: { command: "node" } },
        declaredMcpServers: { local: { command: "node" } },
      },
      reads: [path.join(pluginRoot, ".mcp.json")],
    },
  );
});

test("D-CF6-02: refuses a value written inline that is not a server map", async () => {
  // arrange
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    { entry: { mcpServers: 5 }, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: true,
      resolution: {
        notes: ["malformed mcpServers: must be object"],
        unsupported: [],
        mcpServers: {},
        declaredMcpServers: {},
      },
    },
  );
});

test("D-CF6-02: refuses a malformed server in a map that an array holds inline", async () => {
  // arrange
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {},
      manifest: {
        mcpServers: [{ local: { command: "node" } }, { broken: { type: "bogus" } }],
      },
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
        notes: ['malformed mcp server "broken": unknown type "bogus"'],
        unsupported: [],
        mcpServers: { local: { command: "node" } },
        declaredMcpServers: { local: { command: "node" } },
      },
    },
  );
});

test("D-CF6-02: logs each file skip on the mcp debug channel", async (testContext) => {
  // arrange
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  testContext.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnostics: string[] = [];
  testContext.mock.method(console, "error", (...parts: unknown[]) => {
    diagnostics.push(parts.map(String).join(" "));
  });
  const files = mcpFiles({
    "/plugins/alpha/.mcp.json": { contents: JSON.stringify({ broken: { type: "bogus" } }) },
    "/plugins/alpha/list.json": { contents: "[1]" },
    "/plugins/alpha/servers.json": { contents: "{}" },
  });
  const deps = {
    statKind: files.statKind,
    readFileText: (candidate: string) =>
      candidate === "/plugins/alpha/servers.json"
        ? Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" }))
        : files.readFileText(candidate),
  };

  // act
  await resolveStrictMcp(
    {
      entry: {},
      manifest: { mcpServers: ["./servers.json", "./list.json", "./missing.json"] },
      pluginRoot: "/plugins/alpha",
      resolution: emptyResolution(),
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(diagnostics, [
    '[mcp] .mcp.json of /plugins/alpha: skipped the server "broken": unknown type "bogus"',
    "[mcp] ./servers.json of /plugins/alpha: skipped the file: denied",
    "[mcp] ./list.json of /plugins/alpha: skipped the file: it holds no server map",
  ]);
});

test("resolves valid inline entry MCP after only a stat of the absent .mcp.json", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = recordedMcpFiles({});

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: { alpha: { command: "node" } } },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution, stats: deps.stats, reads: deps.reads },
    {
      dirty: false,
      resolution: {
        notes: [],
        unsupported: [],
        mcpServers: { alpha: { command: "node" } },
        declaredMcpServers: { alpha: { command: "node" } },
      },
      stats: ["/plugins/alpha/.mcp.json"],
      reads: [],
    },
  );
});

test("treats fully absent strict MCP as empty", async () => {
  // arrange
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
        declaredMcpServers: {
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
          local: { command: "node" },
        },
        droppedMcpServers: [{ server: "live", feature: "ws" }],
      },
    },
  );
});

test("D-P3-01: stages the adapter subset and drops only the servers both implementations block", async () => {
  // arrange
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {
        mcpServers: {
          local: { command: "node" },
          events: { type: "sse", url: "https://mcp.example.com/sse" },
          asker: { command: "node", bareElicitationCapability: true },
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
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
        mcpServers: {
          local: { command: "node" },
          events: { type: "sse", url: "https://mcp.example.com/sse" },
        },
        declaredMcpServers: {
          local: { command: "node" },
          events: { type: "sse", url: "https://mcp.example.com/sse" },
          asker: { command: "node", bareElicitationCapability: true },
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
        },
        droppedMcpServers: [{ server: "live", feature: "ws" }],
      },
    },
  );
});

test("D-P3-01: an sse and a bare-elicitation server leave the neutral verdict clean", async () => {
  // arrange
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: {
        mcpServers: {
          events: { type: "sse", url: "https://mcp.example.com/sse" },
          asker: { command: "node", bareElicitationCapability: true },
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
        unsupported: [],
        mcpServers: { events: { type: "sse", url: "https://mcp.example.com/sse" } },
        declaredMcpServers: {
          events: { type: "sse", url: "https://mcp.example.com/sse" },
          asker: { command: "node", bareElicitationCapability: true },
        },
      },
    },
  );
});

test("ANAME-07: records the mcpServers kind once for several blocked servers", async () => {
  // arrange
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
        declaredMcpServers: {
          live: { type: "ws", url: "wss://mcp.example.com/ws" },
          ide: { type: "sdk" },
        },
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
        declaredMcpServers: { local: { command: "node" } },
      },
    },
  );
});

test("ANAME-07: keeps a server named __proto__ as an own server", async () => {
  // arrange
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

test("MREC-01: keeps a declared server named __proto__ as an own server", async () => {
  // arrange
  const resolution = emptyResolution();
  const servers: unknown = JSON.parse('{"__proto__":{"command":"node"}}');

  // act
  await resolveStrictMcp(
    { entry: { mcpServers: servers }, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual(Object.entries(resolution.declaredMcpServers), [
    ["__proto__", { command: "node" }],
  ]);
});

test("MREC-01 / D-CF6-01: declares supported and blocked servers in merge order, a later source keeping the first position with its config", async () => {
  // arrange
  const resolution = emptyResolution();
  const deps = mcpFiles({
    "/plugins/alpha/.mcp.json": {
      contents: JSON.stringify({
        first: { command: "node", args: ["v1.js"] },
        live: { type: "ws", url: "wss://mcp.example.com/ws" },
        broken: { command: 5 },
      }),
    },
  });

  // act
  await resolveStrictMcp(
    {
      entry: {},
      manifest: {
        mcpServers: { last: { command: "python" }, first: { command: "node", args: ["v2.js"] } },
      },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    deps,
  );

  // assert
  assert.deepStrictEqual(Object.entries(resolution.declaredMcpServers), [
    ["first", { command: "node", args: ["v2.js"] }],
    ["live", { type: "ws", url: "wss://mcp.example.com/ws" }],
    ["last", { command: "python" }],
  ]);
});
