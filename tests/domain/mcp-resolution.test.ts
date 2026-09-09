import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type * as McpResolutionOwner from "../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts";

type OwnerShape = typeof McpResolutionOwner;
type FileValue = "dir" | { readonly contents: string };

function preserveDirectOwnerType(owner: OwnerShape): void {
  void owner;
}

function emptyResolution() {
  return { notes: [] as string[], mcpServers: {} as Record<string, unknown> };
}

function mcpFiles(files: Readonly<Record<string, FileValue>>) {
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
      referencedResolution: { notes: [], mcpServers: { alpha: { command: "node" } } },
      inlineDirty: false,
      inlineResolution: { notes: [], mcpServers: { alpha: { command: "node" } } },
    },
  );
});

test("uses manifest MCP only when the entry is absent", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    {
      entry: { mcpServers: {} },
      manifest: { mcpServers: { manifest: { command: "python" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    mcpFiles({}),
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, { dirty: false, resolution: emptyResolution() });
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
      contents: JSON.stringify({ mcpServers: { wrapped: {} } }),
    },
    [path.join(unwrappedRoot, ".mcp.json")]: {
      contents: JSON.stringify({ unwrapped: {} }),
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
      wrappedResolution: { notes: [], mcpServers: { wrapped: {} } },
      unwrappedDirty: false,
      unwrappedResolution: { notes: [], mcpServers: { unwrapped: {} } },
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
    assert.deepStrictEqual({ dirty, resolution }, {
      dirty: true,
      resolution: { notes: [expectedNote], mcpServers: {} },
    });
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
    contents: JSON.stringify({ alpha: {} }),
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

test("classifies a malformed standalone document with a non-Error rejection", async () => {
  // arrange
  const { resolveStrictMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveStrictMcp(
    { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    {
      statKind: () => Promise.resolve("file"),
      readFileText: () => Promise.reject("read failure"),
    },
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, {
    dirty: true,
    resolution: {
      notes: ["malformed mcpServers (.mcp.json): read failure"],
      mcpServers: {},
    },
  });
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
        notes: ["malformed mcpServers: Expected object"],
        mcpServers: {},
      },
      inlineDirty: true,
      inlineResolution: { notes: ["malformed mcpServers: Expected object"], mcpServers: {} },
    },
  );
});

test("resolves valid loose entry MCP without filesystem access", async () => {
  // arrange
  const { resolveLooseMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveLooseMcp(
    {
      entry: { mcpServers: { alpha: {} } },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.reject(new Error("must not inspect standalone MCP")),
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, {
    dirty: false,
    resolution: { notes: [], mcpServers: { alpha: {} } },
  });
});

test("reports manifest and standalone loose MCP without an entry as one conflict", async () => {
  // arrange
  const { resolveLooseMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const manifestResolution = emptyResolution();
  const standaloneResolution = emptyResolution();

  // act
  const manifestDirty = await resolveLooseMcp(
    {
      entry: {},
      manifest: { mcpServers: { alpha: {} } },
      pluginRoot: "/plugins/manifest",
      resolution: manifestResolution,
    },
    () => Promise.resolve(null),
  );
  const standaloneDirty = await resolveLooseMcp(
    {
      entry: {},
      manifest: null,
      pluginRoot: "/plugins/standalone",
      resolution: standaloneResolution,
    },
    (candidate) =>
      Promise.resolve(candidate === "/plugins/standalone/.mcp.json" ? "file" : null),
  );

  // assert
  const conflictResolution = {
    notes: [
      "component declarations conflict: manifest/standalone mcpServers without entry-level declaration",
    ],
    mcpServers: {},
  };
  assert.deepStrictEqual(
    { manifestDirty, manifestResolution, standaloneDirty, standaloneResolution },
    {
      manifestDirty: true,
      manifestResolution: conflictResolution,
      standaloneDirty: true,
      standaloneResolution: conflictResolution,
    },
  );
});

test("treats fully absent loose MCP as empty", async () => {
  // arrange
  const { resolveLooseMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveLooseMcp(
    { entry: {}, manifest: null, pluginRoot: "/plugins/alpha", resolution },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual({ dirty, resolution }, { dirty: false, resolution: emptyResolution() });
});

test("distinguishes loose string references from malformed inline values", async () => {
  // arrange
  const { resolveLooseMcp } =
    await import("../../extensions/pi-claude-marketplace/domain/mcp-resolution.ts");
  const referenceResolution = emptyResolution();
  const malformedResolution = emptyResolution();

  // act
  const referenceDirty = await resolveLooseMcp(
    {
      entry: { mcpServers: "servers.json" },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution: referenceResolution,
    },
    () => Promise.resolve(null),
  );
  const malformedDirty = await resolveLooseMcp(
    {
      entry: { mcpServers: 42 },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution: malformedResolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(
    { referenceDirty, referenceResolution, malformedDirty, malformedResolution },
    {
      referenceDirty: true,
      referenceResolution: {
        notes: ['unsupported mcpServers string reference in loose mode: "servers.json"'],
        mcpServers: {},
      },
      malformedDirty: true,
      malformedResolution: { notes: ["malformed mcpServers"], mcpServers: {} },
    },
  );
});
