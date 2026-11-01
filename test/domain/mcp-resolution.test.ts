import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

test("D-CF6-01: reads the manifest MCP and ignores the entry MCP when a plugin.json exists", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
      stringEntryDirty: false,
      stringEntryResolution: {
        notes: [],
        unsupported: [],
        mcpServers: { manifest: { command: "python" } },
      },
      reads: [],
    },
  );
});

test("D-CF6-01: reads the entry MCP after .mcp.json when the plugin has no plugin.json", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
      order: ["e", "f"],
    },
  );
});

test("D-CF6-01: merges .mcp.json and the manifest, a later server replacing an earlier one in place", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
      order: ["a", "c", "b"],
    },
  );
});

test("D-CF6-01: reads an array of references and maps in order", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
      order: ["x", "z", "y"],
    },
  );
});

test("D-CF6-01: refuses an array holding an element that is neither a reference nor a map, with one note", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
      stats: ["/plugins/alpha/.mcp.json"],
    },
  );
});

for (const bundle of ["server.mcpb", "./server.dxt"] as const) {
  test(`D-CF6-01: marks the bundle reference ${bundle} unsupported without reading it`, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        },
        stats: ["/plugins/alpha/.mcp.json"],
        reads: ["/plugins/alpha/.mcp.json"],
      },
    );
  });
}

test("D-CF6-01: records the mcpServers kind once for a bundle and a blocked server", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        droppedMcpServers: [{ server: "live", feature: "ws" }],
      },
    },
  );
});

test("D-CF6-01: a later supported server replaces an earlier blocked one of the same name", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { live: { command: "node" } } },
    },
  );
});

test("D-CF6-01: a later blocked server replaces an earlier supported one and is left out", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        droppedMcpServers: [{ server: "live", feature: "ws" }],
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
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        resolution: { notes: [expectedNote], unsupported: [], mcpServers: {} },
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
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      },
    );
  });
}

test("D-CF6-01: reads an unwrapped string reference", async () => {
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
      resolution: { notes: [], unsupported: [], mcpServers: { alpha: { command: "node" } } },
    },
  );
});

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
  const reads: string[] = [];

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
      readFileText: (candidate) => {
        reads.push(candidate);
        return Promise.resolve("{}");
      },
    },
  );

  // assert
  assert.deepStrictEqual(
    { dirty, reads, resolution },
    {
      dirty: true,
      reads: [path.join(pluginRoot, ".mcp.json")],
      resolution: {
        notes: ['malformed mcp reference: escapes plugin root: "linked/servers.json"'],
        unsupported: [],
        mcpServers: {},
      },
    },
  );
});

for (const { title, readFailure } of [
  { title: "an EACCES error", readFailure: Object.assign(new Error("denied"), { code: "EACCES" }) },
  { title: "a non-Error value", readFailure: "read failure" },
] as const) {
  test(`D-CF6-02: skips a string reference whose read rejects with ${title}`, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      },
    );
  });

  test(`D-CF6-02: skips a .mcp.json whose read rejects with ${title} and keeps the manifest servers`, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      },
    );
  });
}

test("D-CF6-02: skips a .mcp.json whose stat fails and keeps the manifest servers", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      reads: [],
    },
  );
});

for (const documentText of ["{ not json", "5", "null", "[1]", '{"mcpServers": 5}'] as const) {
  test(`D-CF6-02: skips a .mcp.json holding ${documentText} and keeps the manifest servers`, async () => {
    // arrange
    const { resolveStrictMcp } =
      await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
        resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      },
    );
  });
}

test("D-CF6-02: drops a malformed server in .mcp.json and keeps its other server, with no note", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { ok: { command: "node" } } },
    },
  );
});

test("D-CF6-02: a malformed server in a later file never replaces an earlier server of its name", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { x: { command: "mcpjson-x" } } },
    },
  );
});

test("D-CF6-02: skips a string reference whose path walk fails with ENOTDIR, without reading it", async (testContext) => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { local: { command: "node" } } },
      reads: [path.join(pluginRoot, ".mcp.json")],
    },
  );
});

test("D-CF6-02: refuses a value written inline that is not a server map", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
    },
  );
});

test("D-CF6-02: refuses a malformed server in a map that an array holds inline", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      },
    },
  );
});

test("D-CF6-02: logs each file skip on the mcp debug channel", async (testContext) => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
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
      resolution: { notes: [], unsupported: [], mcpServers: { alpha: { command: "node" } } },
      stats: ["/plugins/alpha/.mcp.json"],
      reads: [],
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
