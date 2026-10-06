import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type * as HooksResolutionOwner from "../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts";

type OwnerShape = typeof HooksResolutionOwner;

function emptyResolution() {
  return {
    supported: [] as string[],
    unsupported: [] as string[],
    notes: [] as string[],
  };
}

/**
 * A path-keyed file tree. A string node is file contents, an `Error` node is a
 * file whose read rejects with that error, and `"dir"` is a directory. Every
 * read lands in `reads`, and a read of a path that is not a file rejects with
 * ENOENT.
 */
function fileTree(nodes: Record<string, string | Error>): {
  reads: string[];
  statKind: (candidate: string) => Promise<"file" | "dir" | null>;
  readFileText: (candidate: string) => Promise<string>;
} {
  const reads: string[] = [];
  return {
    reads,
    statKind: (candidate) => {
      const node = nodes[candidate];
      if (node === undefined) {
        return Promise.resolve(null);
      }

      return Promise.resolve(node === "dir" ? "dir" : "file");
    },
    readFileText: (candidate) => {
      reads.push(candidate);
      const node = nodes[candidate];
      if (node instanceof Error) {
        return Promise.reject(node);
      }

      if (node === undefined || node === "dir") {
        return Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }));
      }

      return Promise.resolve(node);
    },
  };
}

const MODULE_HOOKS = JSON.stringify({ modules: ["./register.ts"] });
const DEFAULT_HOOKS_PATH = path.join("/plugins/alpha", "hooks", "hooks.json");

function dependencies(
  contents: string | undefined,
  readError?: Error,
): {
  statKind: (candidate: string) => Promise<"file" | null>;
  readFileText: (candidate: string) => Promise<string>;
} {
  return {
    statKind: () =>
      Promise.resolve(contents === undefined && readError === undefined ? null : "file"),
    readFileText: () =>
      readError === undefined ? Promise.resolve(contents ?? "") : Promise.reject(readError),
  };
}

test("resolves no hooks when the convention file is absent", async () => {
  // arrange
  let owner: OwnerShape | undefined;
  const resolution = emptyResolution();

  // act & assert
  await assert.doesNotReject(async () => {
    owner = await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  }, "hooks-resolution.ts is absent");
  assert.ok(owner !== undefined);
  const dirty = await owner.resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(undefined),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
});

test("records a supported hooks configuration and its relative path", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ready" }] }],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
});

test("records a module declared by a modules-only convention file", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({ modules: ["./register.ts"] });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [],
    declaresHookModule: true,
  });
});

test("keeps command hooks supported beside a declared module", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
    },
    modules: ["./register.ts"],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
    declaresHookModule: true,
  });
});

test("classifies malformed hooks as a structural failure", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies("not-json"),
  );

  // assert
  assert.strictEqual(dirty, true);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [
      "malformed hooks.json: hooks.json is not valid JSON: Unexpected token 'o', \"not-json\" is not valid JSON",
    ],
  });
});

test("propagates convention-file read failures unchanged", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const readError = Object.assign(new Error("denied"), { code: "EACCES" });

  // act & assert
  await assert.rejects(
    resolveHooks(
      { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
      dependencies(undefined, readError),
    ),
    (error: unknown) => error === readError,
  );
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
});

test("keeps supported handlers and reports dropped groups in source order", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [
      { matcher: ".*", hooks: [{ type: "command", command: "echo first" }] },
      { matcher: "Bash", hooks: [{ type: "command", command: "echo kept" }] },
      { matcher: ".+", hooks: [{ type: "command", command: "echo second" }] },
    ],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
      { kind: "group", event: "PreToolUse", matcher: ".+", cond: "regex" },
    ],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
});

test("omits materialization when every hook is dropped", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    Notification: [{ hooks: [{ type: "command", command: "echo ignored" }] }],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [{ kind: "event", event: "Notification" }],
  });
});

test("flags orphan rewake fields only in the retained hook subset", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          { type: "command", command: "echo paired", asyncRewake: true, rewakeMessage: "ok" },
          { type: "command", command: "echo orphan", rewakeSummary: "later" },
        ],
      },
      {
        matcher: ".*",
        hooks: [{ type: "command", command: "echo dropped", rewakeMessage: "ignored" }],
      },
    ],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [{ kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" }],
    hooksConfigPath: path.join("hooks", "hooks.json"),
    orphanRewake: true,
  });
});

test("repeated resolutions are observationally identical", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const contents = JSON.stringify({
    PostToolUse: [
      { matcher: "Edit", hooks: [{ type: "command", command: "echo once" }] },
      { matcher: "Write", hooks: [{ type: "notification" }] },
    ],
  });
  const firstResolution = emptyResolution();
  const secondResolution = emptyResolution();

  // act
  const firstDirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution: firstResolution },
    dependencies(contents),
  );
  const secondDirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: {}, manifest: null, resolution: secondResolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(firstDirty, false);
  assert.strictEqual(secondDirty, false);
  assert.deepStrictEqual(secondResolution, firstResolution);
});

test("parallel resolutions keep independent deterministic state", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const supportedResolution = emptyResolution();
  const droppedResolution = emptyResolution();
  const supportedContents = JSON.stringify({
    SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
  });
  const droppedContents = JSON.stringify({
    Notification: [{ hooks: [{ type: "command", command: "echo ignored" }] }],
  });

  // act
  const [supportedDirty, droppedDirty] = await Promise.all([
    resolveHooks(
      {
        pluginRoot: "/plugins/supported",
        entry: {},
        manifest: null,
        resolution: supportedResolution,
      },
      dependencies(supportedContents),
    ),
    resolveHooks(
      { pluginRoot: "/plugins/dropped", entry: {}, manifest: null, resolution: droppedResolution },
      dependencies(droppedContents),
    ),
  ]);

  // assert
  assert.deepStrictEqual([supportedDirty, droppedDirty], [false, false]);
  assert.deepStrictEqual(supportedResolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
  assert.deepStrictEqual(droppedResolution, {
    supported: [],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [{ kind: "event", event: "Notification" }],
  });
});

test("records a module declared by a hooks file the manifest names", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const extraPath = path.join("/plugins/alpha", "hooks", "extra.json");
  const files = fileTree({ [extraPath]: MODULE_HOOKS });

  // act
  const dirty = await resolveHooks(
    {
      pluginRoot: "/plugins/alpha",
      entry: {},
      manifest: { hooks: "./hooks/extra.json" },
      resolution,
    },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [],
    declaresHookModule: true,
  });
  assert.deepStrictEqual(files.reads, [extraPath]);
});

test("adopts no command hooks from a hooks file the entry names", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const extraPath = path.join("/plugins/alpha", "extra.json");
  const files = fileTree({
    [extraPath]: JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }] },
    }),
  });

  // act
  const dirty = await resolveHooks(
    {
      pluginRoot: "/plugins/alpha",
      entry: { hooks: [{ SessionStart: [] }, "./extra.json"] },
      manifest: null,
      resolution,
    },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
  assert.deepStrictEqual(files.reads, [extraPath]);
});

for (const { description, reference } of [
  { description: "an escaping", reference: "../outside.json" },
  { description: "an absolute", reference: "/plugins/outside.json" },
]) {
  test(`never reads ${description} hooks reference`, async () => {
    // arrange
    const { resolveHooks } =
      await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
    const resolution = emptyResolution();
    const files = fileTree({ "/plugins/outside.json": MODULE_HOOKS });

    // act
    const dirty = await resolveHooks(
      { pluginRoot: "/plugins/alpha", entry: { hooks: reference }, manifest: null, resolution },
      files,
    );

    // assert
    assert.strictEqual(dirty, false);
    assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
    assert.deepStrictEqual(files.reads, []);
  });
}

test("reads every file of a manifest hooks array until one declares a module", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const firstPath = path.join("/plugins/alpha", "hooks", "first.json");
  const secondPath = path.join("/plugins/alpha", "hooks", "second.json");
  const thirdPath = path.join("/plugins/alpha", "hooks", "third.json");
  const files = fileTree({
    [firstPath]: JSON.stringify({ hooks: {} }),
    [secondPath]: JSON.stringify({ modules: [] }),
    [thirdPath]: MODULE_HOOKS,
  });

  // act
  const dirty = await resolveHooks(
    {
      pluginRoot: "/plugins/alpha",
      entry: {},
      manifest: { hooks: ["./hooks/first.json", "./hooks/second.json", "./hooks/third.json"] },
      resolution,
    },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [],
    declaresHookModule: true,
  });
  assert.deepStrictEqual(files.reads, [firstPath, secondPath, thirdPath]);
});

test("reads the convention file once when the manifest names it", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const files = fileTree({
    [DEFAULT_HOOKS_PATH]: JSON.stringify({
      SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
    }),
  });

  // act
  const dirty = await resolveHooks(
    {
      pluginRoot: "/plugins/alpha",
      entry: {},
      manifest: { hooks: "./hooks/hooks.json" },
      resolution,
    },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
  assert.deepStrictEqual(files.reads, [DEFAULT_HOOKS_PATH]);
});

test("reads a hooks file once when the entry and the manifest both name it", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const extraPath = path.join("/plugins/alpha", "extra.json");
  const files = fileTree({ [extraPath]: JSON.stringify({ hooks: {} }) });

  // act
  const dirty = await resolveHooks(
    {
      pluginRoot: "/plugins/alpha",
      entry: { hooks: "./extra.json" },
      manifest: { hooks: ["extra.json"] },
      resolution,
    },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
  assert.deepStrictEqual(files.reads, [extraPath]);
});

const EXTRA_HOOKS_PATH = path.join("/plugins/alpha", "extra.json");

for (const { description, nodes, expectedReads } of [
  { description: "a missing", nodes: {}, expectedReads: [] },
  { description: "a directory", nodes: { [EXTRA_HOOKS_PATH]: "dir" }, expectedReads: [] },
  {
    description: "an invalid JSON",
    nodes: { [EXTRA_HOOKS_PATH]: "not-json" },
    expectedReads: [EXTRA_HOOKS_PATH],
  },
]) {
  test(`ignores ${description} hooks reference`, async () => {
    // arrange
    const { resolveHooks } =
      await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
    const resolution = emptyResolution();
    const files = fileTree(nodes);

    // act
    const dirty = await resolveHooks(
      {
        pluginRoot: "/plugins/alpha",
        entry: { hooks: "./extra.json" },
        manifest: null,
        resolution,
      },
      files,
    );

    // assert
    assert.strictEqual(dirty, false);
    assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
    assert.deepStrictEqual(files.reads, expectedReads);
  });
}

test("reads no referenced hooks file when the convention file declares a module", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const files = fileTree({
    [DEFAULT_HOOKS_PATH]: MODULE_HOOKS,
    [path.join("/plugins/alpha", "extra.json")]: MODULE_HOOKS,
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", entry: { hooks: "./extra.json" }, manifest: null, resolution },
    files,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [],
    declaresHookModule: true,
  });
  assert.deepStrictEqual(files.reads, [DEFAULT_HOOKS_PATH]);
});

test("propagates a referenced hooks file read failure unchanged", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const readError = Object.assign(new Error("denied"), { code: "EACCES" });
  const files = fileTree({ [path.join("/plugins/alpha", "extra.json")]: readError });

  // act & assert
  await assert.rejects(
    resolveHooks(
      { pluginRoot: "/plugins/alpha", entry: {}, manifest: { hooks: "./extra.json" }, resolution },
      files,
    ),
    (error: unknown) => error === readError,
  );
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
});
