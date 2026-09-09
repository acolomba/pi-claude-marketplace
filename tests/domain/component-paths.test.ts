import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type * as ComponentPathsOwner from "../../extensions/pi-claude-marketplace/domain/component-paths.ts";

type OwnerShape = typeof ComponentPathsOwner;

function preserveDirectOwnerType(_owner: OwnerShape): void {}

function emptyResolution() {
  return {
    supported: [] as string[],
    notes: [] as string[],
    componentPaths: { skills: [] as string[], commands: [] as string[], agents: [] as string[] },
  };
}

void preserveDirectOwnerType;

test("collects strict paths in declaration order with first-wins deduplication", async () => {
  // arrange
  const pluginRoot = "/plugins/alpha";
  const resolution = emptyResolution();
  let owner: OwnerShape | undefined;

  // act & assert
  await assert.doesNotReject(async () => {
    owner = await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  }, "component-paths.ts is absent");
  assert.ok(owner !== undefined);
  const dirty = await owner.collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", skills: ["entry", "shared"] },
      manifest: { skills: ["shared", "manifest"] },
      pluginRoot,
      resolution,
    },
    async (candidate) => (candidate === path.join(pluginRoot, "skills") ? "dir" : null),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["skills"],
    notes: [],
    componentPaths: {
      skills: ["entry", "shared", "manifest", "skills"],
      commands: [],
      agents: [],
    },
  });
});

test("accepts contained declared paths without requiring the leaf to exist", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", commands: "missing-command" },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    async () => null,
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["commands"],
    notes: [],
    componentPaths: { skills: [], commands: ["missing-command"], agents: [] },
  });
});

test("ignores null declarations and wrong-kind convention paths", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", skills: null },
      manifest: { commands: null },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    async () => "file",
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, emptyResolution());
});

const invalidPathCases = [
  {
    title: "rejects a nested array component path",
    value: [["nested"]],
    reason: 'component path for "skills" contains nested array element; must be a string',
  },
  {
    title: "rejects a non-string component path",
    value: [42],
    reason: 'component path for "skills" is not a string (got number)',
  },
  {
    title: "rejects an absolute component path",
    value: ["/outside/skills"],
    reason: 'component path for "skills" must be relative (got absolute "/outside/skills")',
  },
  {
    title: "rejects a traversing component path",
    value: ["../outside"],
    reason: 'component path for "skills" escapes plugin root: "../outside"',
  },
] as const;

for (const { title, value, reason } of invalidPathCases) {
  test(title, async () => {
    // arrange
    const { collectStrictComponentPaths } =
      await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
    const resolution = emptyResolution();

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: { name: "alpha", source: "./alpha", skills: value },
        manifest: null,
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      async () => null,
    );

    // assert
    assert.strictEqual(dirty, true);
    assert.deepStrictEqual(resolution, {
      supported: [],
      notes: [reason],
      componentPaths: { skills: [], commands: [], agents: [] },
    });
  });
}

test("rejects a component path that crosses a symlink", async (testContext) => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "component-paths-symlink-"));
  const pluginRoot = path.join(temporaryRoot, "plugin");
  const outsideRoot = path.join(temporaryRoot, "outside");
  await mkdir(pluginRoot);
  await mkdir(outsideRoot);
  await symlink(outsideRoot, path.join(pluginRoot, "linked"));
  testContext.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", agents: "linked/agent.md" },
      manifest: null,
      pluginRoot,
      resolution,
    },
    async () => null,
  );

  // assert
  assert.strictEqual(dirty, true);
  assert.deepStrictEqual(resolution, {
    supported: [],
    notes: ['component path for "agents" escapes plugin root: "linked/agent.md"'],
    componentPaths: { skills: [], commands: [], agents: [] },
  });
});

test("propagates a containment inspection error", async (testContext) => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "component-paths-notdir-"));
  const pluginRoot = path.join(temporaryRoot, "plugin");
  await mkdir(pluginRoot);
  await writeFile(path.join(pluginRoot, "file"), "not a directory", "utf8");
  testContext.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  // act & assert
  await assert.rejects(
    () =>
      collectStrictComponentPaths(
        {
          entry: { name: "alpha", source: "./alpha", skills: "file/child" },
          manifest: null,
          pluginRoot,
          resolution: emptyResolution(),
        },
        async () => null,
      ),
    (error: unknown) =>
      error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOTDIR",
  );
});

test("collects only entry paths in loose mode", async () => {
  // arrange
  const { collectLooseComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectLooseComponentPaths({
    entry: { name: "alpha", source: "./alpha", agents: ["one", "one", "two"] },
    manifest: null,
    pluginRoot: "/plugins/alpha",
    resolution,
  });

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["agents"],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: ["one", "two"] },
  });
});

test("reports manifest-only loose declarations as conflicts", async () => {
  // arrange
  const { collectLooseComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectLooseComponentPaths({
    entry: { name: "alpha", source: "./alpha" },
    manifest: { commands: "commands" },
    pluginRoot: "/plugins/alpha",
    resolution,
  });

  // assert
  assert.strictEqual(dirty, true);
  assert.deepStrictEqual(resolution, {
    supported: [],
    notes: ['component declarations conflict: manifest declares "commands" but entry does not'],
    componentPaths: { skills: [], commands: [], agents: [] },
  });
});

test("treats absent and null loose declarations as empty", async () => {
  // arrange
  const { collectLooseComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const absentResolution = emptyResolution();
  const nullResolution = emptyResolution();

  // act
  const absentDirty = await collectLooseComponentPaths({
    entry: { name: "alpha", source: "./alpha" },
    manifest: null,
    pluginRoot: "/plugins/alpha",
    resolution: absentResolution,
  });
  const nullDirty = await collectLooseComponentPaths({
    entry: { name: "alpha", source: "./alpha", skills: null },
    manifest: null,
    pluginRoot: "/plugins/alpha",
    resolution: nullResolution,
  });

  // assert
  assert.deepStrictEqual(
    { absentDirty, absentResolution, nullDirty, nullResolution },
    {
      absentDirty: false,
      absentResolution: emptyResolution(),
      nullDirty: false,
      nullResolution: emptyResolution(),
    },
  );
});
