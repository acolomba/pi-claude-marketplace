import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type * as ComponentPathsOwner from "../../extensions/pi-claude-marketplace/domain/component-paths.ts";

type OwnerShape = typeof ComponentPathsOwner;

function preserveDirectOwnerType(owner: OwnerShape): void {
  void owner;
}

function emptyResolution(): ComponentPathsOwner.ComponentPathResolution {
  return {
    supported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
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
    (candidate) => Promise.resolve(candidate === path.join(pluginRoot, "skills") ? "dir" : null),
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
      workflows: [],
    },
  });
});

test("canonicalizes equivalent declarations and represents the plugin root as a dot", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", skills: ["./skills/", "a/../skills", ".", "./"] },
      manifest: { skills: ["skills"] },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["skills"],
    notes: [],
    componentPaths: { skills: ["skills", "."], commands: [], agents: [], workflows: [] },
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
    () => Promise.resolve(null),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["commands"],
    notes: [],
    componentPaths: { skills: [], commands: ["missing-command"], agents: [], workflows: [] },
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
    () => Promise.resolve("file"),
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
      () => Promise.resolve(null),
    );

    // assert
    assert.strictEqual(dirty, true);
    assert.deepStrictEqual(resolution, {
      supported: [],
      notes: [reason],
      componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
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
    () => Promise.resolve(null),
  );

  // assert
  assert.strictEqual(dirty, true);
  assert.deepStrictEqual(resolution, {
    supported: [],
    notes: ['component path for "agents" escapes plugin root: "linked/agent.md"'],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
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
        () => Promise.resolve(null),
      ),
    (error: unknown) =>
      error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOTDIR",
  );
});

test("collects declared entry paths without convention matches", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", agents: ["one", "one", "two"] },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["agents"],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: ["one", "two"], workflows: [] },
  });
});

test("treats absent and null strict declarations as empty", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const absentResolution = emptyResolution();
  const nullResolution = emptyResolution();

  // act
  const absentDirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha" },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution: absentResolution,
    },
    () => Promise.resolve(null),
  );
  const nullDirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha", skills: null },
      manifest: null,
      pluginRoot: "/plugins/alpha",
      resolution: nullResolution,
    },
    () => Promise.resolve(null),
  );

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

type FolderRuleKind = "skills" | "commands" | "agents" | "workflows";

interface FolderRuleCase {
  readonly title: string;
  readonly kind: FolderRuleKind;
  /** The marketplace entry's and `plugin.json`'s declarations; a missing key declares nothing. */
  readonly declared: { readonly entry?: unknown; readonly manifest?: unknown };
  readonly expectedPaths: readonly string[];
  readonly leavesFolderUnread?: true;
}

const REPLACE_KINDS = ["agents", "workflows"] as const;

// D-CF1-06: Claude Code 2.1.316 reads the conventional agents and workflows
// folders only when the kind's declaration is falsy, and always reads
// `skills/`. D-CF3-04 (E4): it reads `commands/` unless `plugin.json`
// declares `commands`, in the order folder, `plugin.json` paths, entry paths.
const folderRuleCases: readonly FolderRuleCase[] = [
  ...REPLACE_KINDS.flatMap((kind): FolderRuleCase[] => [
    {
      title: `D-CF1-06 an entry-declared ${kind} path replaces the existing ${kind}/ folder`,
      kind,
      declared: { entry: "custom" },
      expectedPaths: ["custom"],
      leavesFolderUnread: true,
    },
    {
      title: `D-CF1-06 a manifest-declared ${kind} path replaces the existing ${kind}/ folder`,
      kind,
      declared: { manifest: "custom" },
      expectedPaths: ["custom"],
      leavesFolderUnread: true,
    },
    {
      title: `D-CF1-06 a declared empty ${kind} list leaves the existing ${kind}/ folder unread`,
      kind,
      declared: { manifest: [] },
      expectedPaths: [],
      leavesFolderUnread: true,
    },
    {
      title: `D-CF1-06 an empty-string ${kind} declaration reads the ${kind}/ folder and nothing else`,
      kind,
      declared: { entry: "" },
      expectedPaths: [kind],
    },
    {
      title: `D-CF1-06 a null ${kind} declaration reads the ${kind}/ folder`,
      kind,
      declared: { manifest: null },
      expectedPaths: [kind],
    },
  ]),
  {
    title: "D-CF3-04 an entry-declared commands path adds to the existing commands/ folder",
    kind: "commands",
    declared: { entry: "./more" },
    expectedPaths: ["commands", "more"],
  },
  {
    title: "D-CF3-04 a declared empty commands list in the entry still reads the commands/ folder",
    kind: "commands",
    declared: { entry: [] },
    expectedPaths: ["commands"],
  },
  {
    title: "D-CF3-04 a manifest-declared commands path replaces the existing commands/ folder",
    kind: "commands",
    declared: { manifest: "./custom" },
    expectedPaths: ["custom"],
    leavesFolderUnread: true,
  },
  {
    title:
      "D-CF3-04 manifest and entry commands paths are read in that order and leave the folder unread",
    kind: "commands",
    declared: { entry: "./more", manifest: "./custom" },
    expectedPaths: ["custom", "more"],
    leavesFolderUnread: true,
  },
  {
    title: "D-CF3-04 an entry path that reaches the commands/ folder leaves no folder unread",
    kind: "commands",
    declared: { entry: "./commands/extra", manifest: "./custom" },
    expectedPaths: ["custom", "commands/extra"],
  },
  {
    title: "D-CF3-04 a declared empty commands list in the manifest leaves the folder unread",
    kind: "commands",
    declared: { entry: "./more", manifest: [] },
    expectedPaths: ["more"],
    leavesFolderUnread: true,
  },
  {
    title: "D-CF3-04 an empty-string commands declaration in the manifest reads the folder",
    kind: "commands",
    declared: { manifest: "" },
    expectedPaths: ["commands"],
  },
  {
    title: "D-CF3-04 a null commands declaration in the manifest reads the folder",
    kind: "commands",
    declared: { manifest: null },
    expectedPaths: ["commands"],
  },
  {
    title: "D-CF3-04 the commands/ folder comes before an entry path that names it again",
    kind: "commands",
    declared: { entry: ["./more", "./commands"] },
    expectedPaths: ["commands", "more"],
  },
  {
    title: "D-CF1-06 an entry-declared skills path adds to the existing skills/ folder",
    kind: "skills",
    declared: { entry: "custom" },
    expectedPaths: ["custom", "skills"],
  },
  {
    title: "D-CF1-06 a manifest-declared skills path adds to the existing skills/ folder",
    kind: "skills",
    declared: { manifest: "custom" },
    expectedPaths: ["custom", "skills"],
  },
  {
    title: "D-CF1-06 a declared empty skills list still reads the existing skills/ folder",
    kind: "skills",
    declared: { manifest: [] },
    expectedPaths: ["skills"],
  },
  ...(["skills", "commands", ...REPLACE_KINDS] as const).map((kind): FolderRuleCase => ({
    title: `D-CF1-06 an undeclared ${kind} kind reads its existing ${kind}/ folder`,
    kind,
    declared: {},
    expectedPaths: [kind],
  })),
];

for (const { title, kind, declared, expectedPaths, leavesFolderUnread } of folderRuleCases) {
  test(title, async () => {
    // arrange
    const { collectStrictComponentPaths } =
      await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();
    const expected = emptyResolution();
    expected.componentPaths[kind].push(...expectedPaths);
    if (expectedPaths.length > 0) {
      expected.supported.push(kind);
    }

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: {
          name: "alpha",
          source: "./alpha",
          ...(Object.hasOwn(declared, "entry") && { [kind]: declared.entry }),
        },
        manifest: Object.hasOwn(declared, "manifest") ? { [kind]: declared.manifest } : null,
        pluginRoot,
        resolution,
      },
      (candidate) => Promise.resolve(candidate === path.join(pluginRoot, kind) ? "dir" : null),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          ...expected,
          ...(leavesFolderUnread === true && { shadowedFolders: [kind] }),
        },
      },
    );
  });
}

interface ShadowedFolderCase {
  readonly title: string;
  readonly declared: Readonly<Record<string, unknown>>;
  readonly existingFolders: readonly string[];
  readonly componentPaths: Readonly<Record<string, readonly string[]>>;
  readonly shadowedFolders: readonly string[] | undefined;
}

// D-CF1-06: Claude Code 2.1.316 names a conventional folder that a declaration
// leaves unread, unless a declared path is that folder or lies inside it.
const shadowedFolderCases: readonly ShadowedFolderCase[] = [
  {
    title: "D-CF1-06 a declared path inside the commands/ folder leaves no folder unread",
    declared: { commands: "./commands/extra" },
    existingFolders: ["commands"],
    componentPaths: { commands: ["commands/extra"] },
    shadowedFolders: undefined,
  },
  {
    title: "D-CF1-06 a declared path equal to the commands/ folder leaves no folder unread",
    declared: { commands: "./commands" },
    existingFolders: ["commands"],
    componentPaths: { commands: ["commands"] },
    shadowedFolders: undefined,
  },
  {
    title: "D-CF1-06 a declared plugin root does not read the agents/ folder below it",
    declared: { agents: "." },
    existingFolders: ["agents"],
    componentPaths: { agents: ["."] },
    shadowedFolders: ["agents"],
  },
  {
    title: "D-CF1-06 a declared skills path never leaves the skills/ folder unread",
    declared: { skills: "./custom" },
    existingFolders: ["skills"],
    componentPaths: { skills: ["custom", "skills"] },
    shadowedFolders: undefined,
  },
  {
    title: "D-CF1-06 a declared commands path leaves no folder unread when commands/ is absent",
    declared: { commands: "./custom" },
    existingFolders: [],
    componentPaths: { commands: ["custom"] },
    shadowedFolders: undefined,
  },
  {
    title: "D-CF1-06 every folder a declaration leaves unread is named in kind order",
    declared: { workflows: "./flows", commands: "./cmds" },
    existingFolders: ["commands", "workflows"],
    componentPaths: { commands: ["cmds"], workflows: ["flows"] },
    shadowedFolders: ["commands", "workflows"],
  },
];

for (const {
  title,
  declared,
  existingFolders,
  componentPaths,
  shadowedFolders,
} of shadowedFolderCases) {
  test(title, async () => {
    // arrange
    const { collectStrictComponentPaths } =
      await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();
    const expected = emptyResolution();
    Object.assign(expected.componentPaths, componentPaths);
    expected.supported.push(
      ...(["skills", "commands", "agents", "workflows"] as const).filter(
        (kind) => componentPaths[kind] !== undefined,
      ),
    );
    const directories = new Set(existingFolders.map((folder) => path.join(pluginRoot, folder)));

    // act
    const dirty = await collectStrictComponentPaths(
      { entry: { name: "alpha", source: "./alpha" }, manifest: declared, pluginRoot, resolution },
      (candidate) => Promise.resolve(directories.has(candidate) ? "dir" : null),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      {
        dirty: false,
        resolution: {
          ...expected,
          ...(shadowedFolders !== undefined && { shadowedFolders }),
        },
      },
    );
  });
}

test("D-CF3-03 a plugin manifest's object map of commands becomes the command map", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha" },
      manifest: {
        commands: {
          alpha: { source: "./cmds/alpha.md" },
          beta: { source: "cmds/../cmds/beta.md" },
        },
      },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, resolution },
    {
      dirty: false,
      resolution: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          skills: [],
          commands: [],
          agents: [],
          workflows: [],
          commandMap: [
            { key: "alpha", source: "cmds/alpha.md", origin: "manifest" },
            { key: "beta", source: "cmds/beta.md", origin: "manifest" },
          ],
        },
      },
    },
  );
});

test("D-CF3-03 a command map entry keeps its inline content and its non-empty overrides", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha" },
      manifest: {
        commands: {
          beta: {
            content: "Beta body",
            description: "Beta from the manifest.",
            argumentHint: "<target>",
            model: "opus",
          },
          gamma: { source: "./g.md", description: "", argumentHint: "", model: "" },
        },
      },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, commandMap: resolution.componentPaths.commandMap },
    {
      dirty: false,
      commandMap: [
        {
          key: "beta",
          content: "Beta body",
          origin: "manifest",
          description: "Beta from the manifest.",
          argumentHint: "<target>",
          model: "opus",
        },
        { key: "gamma", source: "g.md", origin: "manifest" },
      ],
    },
  );
});

for (const { title, commands, reason } of [
  {
    title: "an object whose first value is a string",
    commands: { alpha: "./cmds/alpha.md" },
    reason: 'component path for "commands" is not a string (got object)',
  },
  {
    title: "an object whose first value names neither source nor content",
    commands: { alpha: { path: "./cmds/alpha.md" }, beta: { source: "./b.md" } },
    reason: 'component path for "commands" is not a string (got object)',
  },
  {
    title: "an empty object",
    commands: {},
    reason: 'component path for "commands" is not a string (got object)',
  },
]) {
  test(`D-CF3-03 refuses ${title} as a commands path and keeps no command map`, async () => {
    // arrange
    const { collectStrictComponentPaths } =
      await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
    const resolution = emptyResolution();

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: { name: "alpha", source: "./alpha" },
        manifest: { commands },
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      () => Promise.resolve(null),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution },
      { dirty: true, resolution: { ...emptyResolution(), notes: [reason] } },
    );
  });
}

test("D-CF3-03 refuses a command map source that escapes the plugin root with a note naming its key", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha" },
      manifest: { commands: { alpha: { source: "./a.md" }, out: { source: "../out.md" } } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, notes: resolution.notes, commandMap: resolution.componentPaths.commandMap },
    {
      dirty: true,
      notes: ['source of command map entry "out" escapes plugin root: "../out.md"'],
      commandMap: [{ key: "alpha", source: "a.md", origin: "manifest" }],
    },
  );
});

test("D-CF3-03 refuses a command map entry that is not an object with a note naming its key", async () => {
  // arrange
  const { collectStrictComponentPaths } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await collectStrictComponentPaths(
    {
      entry: { name: "alpha", source: "./alpha" },
      manifest: { commands: { alpha: { source: "./a.md" }, beta: 5 } },
      pluginRoot: "/plugins/alpha",
      resolution,
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(
    { dirty, notes: resolution.notes },
    {
      dirty: true,
      notes: ['source of command map entry "beta" is not a string (got undefined)'],
    },
  );
});

test("D-CF1-06 the shadowed-folder warning names the folder and the field that hides it", async () => {
  // arrange
  const { shadowedFolderWarning } =
    await import("../../extensions/pi-claude-marketplace/domain/component-paths.ts");

  // act
  const warning = shadowedFolderWarning("commands");

  // assert
  assert.strictEqual(
    warning,
    'Default commands/ folder is ignored because the manifest sets "commands"',
  );
});
