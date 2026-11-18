import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  collectStrictComponentPaths,
  isMarketplaceRootSource,
  refusedListedSkillPathMessages,
  shadowedFolderDiscoveryWarnings,
} from "../../extensions/pi-claude-marketplace/domain/component-paths.ts";

import type { ComponentPathResolution } from "../../extensions/pi-claude-marketplace/domain/component-paths.ts";
import type { RefusedListedSkillPath } from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

function emptyResolution(): ComponentPathResolution {
  return {
    supported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
  };
}

describe("collectStrictComponentPaths", () => {
  test("collects strict paths in declaration order with first-wins deduplication", async () => {
    // arrange
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();

    // act
    const dirty = await collectStrictComponentPaths(
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
    const resolution = emptyResolution();

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: {
          name: "alpha",
          source: "./alpha",
          skills: ["./skills/", "a/../skills", ".", "./"],
        },
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
      title:
        "D-CF3-04 a declared empty commands list in the entry still reads the commands/ folder",
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

  // D-CF3-03: Claude Code 2.1.316 refuses the manifest for each of these
  // entries, so the plugin is unavailable. The valid `alpha` entry stays.
  for (const { title, beta, note } of [
    {
      title: "an entry that is not an object",
      beta: 5,
      note: 'command map entry "beta" is not an object (got number)',
    },
    {
      title: "an entry that is null",
      beta: null,
      note: 'command map entry "beta" is not an object (got null)',
    },
    {
      title: "an entry that is a list",
      beta: ["./b.md"],
      note: 'command map entry "beta" is not an object (got array)',
    },
    {
      title: "an entry that sets both source and content",
      beta: { source: "./b.md", content: "Beta body" },
      note: 'command map entry "beta" sets both "source" and "content"; it must set exactly one',
    },
    {
      title: "an entry that sets neither source nor content",
      beta: { description: "Beta." },
      note: 'command map entry "beta" sets neither "source" nor "content"; it must set exactly one',
    },
    {
      title: "an entry whose source and content are empty",
      beta: { source: "", content: "" },
      note: 'command map entry "beta" sets neither "source" nor "content"; it must set exactly one',
    },
    {
      title: "a source that is not a string",
      beta: { source: 7 },
      note: 'command map entry "beta" field "source" is not a string (got number)',
    },
    {
      title: "content that is not a string",
      beta: { content: { text: "Beta" } },
      note: 'command map entry "beta" field "content" is not a string (got object)',
    },
    {
      title: "a description that is not a string",
      beta: { source: "./b.md", description: 5 },
      note: 'command map entry "beta" field "description" is not a string (got number)',
    },
    {
      title: "an argument hint that is not a string",
      beta: { source: "./b.md", argumentHint: true },
      note: 'command map entry "beta" field "argumentHint" is not a string (got boolean)',
    },
    {
      title: "a model that is not a string",
      beta: { source: "./b.md", model: null },
      note: 'command map entry "beta" field "model" is not a string (got null)',
    },
    {
      title: "allowed tools that are a number",
      beta: { source: "./b.md", allowedTools: 3 },
      note: 'command map entry "beta" field "allowedTools" is not a string or a list of strings',
    },
    {
      title: "allowed tools that hold a number",
      beta: { source: "./b.md", allowedTools: ["Read", 3] },
      note: 'command map entry "beta" field "allowedTools" is not a string or a list of strings',
    },
    {
      title: "an absolute source",
      beta: { source: "/etc/b.md" },
      note: 'source of command map entry "beta" must be relative (got absolute "/etc/b.md")',
    },
    {
      title: "a source that escapes the plugin root",
      beta: { source: "../b.md" },
      note: 'source of command map entry "beta" escapes plugin root: "../b.md"',
    },
  ] as const) {
    test(`D-CF3-03 refuses ${title} with a note naming its key`, async () => {
      // arrange
      const resolution = emptyResolution();

      // act
      const dirty = await collectStrictComponentPaths(
        {
          entry: { name: "alpha", source: "./alpha" },
          manifest: { commands: { alpha: { source: "./a.md" }, beta } },
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
          notes: [note],
          commandMap: [{ key: "alpha", source: "a.md", origin: "manifest" }],
        },
      );
    });
  }

  test("D-CF3-03 accepts allowed tools given as a string or a list of strings and keeps none", async () => {
    // arrange
    const resolution = emptyResolution();

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: { name: "alpha", source: "./alpha" },
        manifest: {
          commands: {
            alpha: { source: "./a.md", allowedTools: "Read" },
            beta: { content: "Beta body", allowedTools: ["Read", "Bash"] },
          },
        },
        pluginRoot: "/plugins/alpha",
        resolution,
      },
      () => Promise.resolve(null),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, notes: resolution.notes, commandMap: resolution.componentPaths.commandMap },
      {
        dirty: false,
        notes: [],
        commandMap: [
          { key: "alpha", source: "a.md", origin: "manifest" },
          { key: "beta", content: "Beta body", origin: "manifest" },
        ],
      },
    );
  });

  test("D-CF3-03 refuses a command map source that passes through a symbolic link", async (testContext) => {
    // arrange
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "component-paths-map-symlink-"));
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
        entry: { name: "alpha", source: "./alpha" },
        manifest: { commands: { beta: { source: "./linked/b.md" } } },
        pluginRoot,
        resolution,
      },
      () => Promise.resolve(null),
    );

    // assert
    assert.deepStrictEqual(
      { dirty, notes: resolution.notes, commandMap: resolution.componentPaths.commandMap },
      {
        dirty: true,
        notes: ['source of command map entry "beta" escapes plugin root: "./linked/b.md"'],
        commandMap: [],
      },
    );
  });

  interface CommandMapDeclarationCase {
    readonly title: string;
    readonly entryCommands?: unknown;
    readonly manifestCommands?: unknown;
    readonly existingFolder: boolean;
    readonly expected: ComponentPathResolution;
  }

  // D-CF3-03 and D-CF3-04: a `plugin.json` map replaces `commands/` and names
  // it when it leaves it unread; an entry map adds to it and names nothing.
  const commandMapDeclarationCases: readonly CommandMapDeclarationCase[] = [
    {
      title: "D-CF3-03 a plugin manifest's command map leaves the existing commands/ folder unread",
      manifestCommands: { alpha: { source: "./cmds/alpha.md" }, beta: { content: "Beta body" } },
      existingFolder: true,
      expected: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          ...emptyResolution().componentPaths,
          commandMap: [
            { key: "alpha", source: "cmds/alpha.md", origin: "manifest" },
            { key: "beta", content: "Beta body", origin: "manifest" },
          ],
        },
        shadowedFolders: ["commands"],
      },
    },
    {
      title: "D-CF3-03 a plugin manifest's command map source inside commands/ reaches the folder",
      manifestCommands: { alpha: { source: "./commands/alpha.md" } },
      existingFolder: true,
      expected: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          ...emptyResolution().componentPaths,
          commandMap: [{ key: "alpha", source: "commands/alpha.md", origin: "manifest" }],
        },
      },
    },
    {
      title: "D-CF3-04 a marketplace entry's command map adds to the existing commands/ folder",
      entryCommands: {
        gamma: { source: "./extra/gamma.md" },
        delta: { content: "Delta body", description: "Delta." },
      },
      existingFolder: true,
      expected: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          ...emptyResolution().componentPaths,
          commands: ["commands"],
          commandMap: [
            { key: "gamma", source: "extra/gamma.md", origin: "entry" },
            { key: "delta", content: "Delta body", origin: "entry", description: "Delta." },
          ],
        },
      },
    },
    {
      title:
        "D-CF3-03 a plugin manifest's command map keeps the paths the marketplace entry declares",
      entryCommands: "./more",
      manifestCommands: { alpha: { source: "./cmds/alpha.md" } },
      existingFolder: false,
      expected: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          ...emptyResolution().componentPaths,
          commands: ["more"],
          commandMap: [{ key: "alpha", source: "cmds/alpha.md", origin: "manifest" }],
        },
      },
    },
    {
      title: "D-CF3-03 the plugin manifest's command map comes before the marketplace entry's",
      entryCommands: { gamma: { source: "./g.md" } },
      manifestCommands: { alpha: { source: "./a.md" } },
      existingFolder: false,
      expected: {
        supported: ["commands"],
        notes: [],
        componentPaths: {
          ...emptyResolution().componentPaths,
          commandMap: [
            { key: "alpha", source: "a.md", origin: "manifest" },
            { key: "gamma", source: "g.md", origin: "entry" },
          ],
        },
      },
    },
    {
      title: "D-CF3-03 a commands list that holds an object keeps the not-a-string refusal",
      manifestCommands: ["./cmds", { alpha: { source: "./a.md" } }],
      existingFolder: false,
      expected: {
        supported: ["commands"],
        notes: ['component path for "commands" is not a string (got object)'],
        componentPaths: { ...emptyResolution().componentPaths, commands: ["cmds"] },
      },
    },
  ];

  for (const {
    title,
    entryCommands,
    manifestCommands,
    existingFolder,
    expected,
  } of commandMapDeclarationCases) {
    test(title, async () => {
      // arrange
      const pluginRoot = "/plugins/alpha";
      const resolution = emptyResolution();

      // act
      await collectStrictComponentPaths(
        {
          entry: {
            name: "alpha",
            source: "./alpha",
            ...(entryCommands !== undefined && { commands: entryCommands }),
          },
          manifest: manifestCommands === undefined ? null : { commands: manifestCommands },
          pluginRoot,
          resolution,
        },
        (candidate) =>
          Promise.resolve(
            existingFolder && candidate === path.join(pluginRoot, "commands") ? "dir" : null,
          ),
      );

      // assert
      assert.deepStrictEqual(resolution, expected);
    });
  }
});

describe("shadowedFolderDiscoveryWarnings", () => {
  test("D-CF1-06 tags one discovery warning per shadowed folder in order", () => {
    // act
    const warnings = shadowedFolderDiscoveryWarnings(["commands", "agents"]);

    // assert
    assert.deepStrictEqual(warnings, [
      {
        kind: "discovery",
        message: 'Default commands/ folder is ignored because the manifest sets "commands"',
      },
      {
        kind: "discovery",
        message: 'Default agents/ folder is ignored because the manifest sets "agents"',
      },
    ]);
  });

  test("D-CF1-06 gives no warning when no folder is shadowed", () => {
    // act
    const warnings = shadowedFolderDiscoveryWarnings(undefined);

    // assert
    assert.deepStrictEqual(warnings, []);
  });
});

describe("refusedListedSkillPathMessages", () => {
  const cases: readonly {
    readonly title: string;
    readonly refused: RefusedListedSkillPath;
    readonly expected: string;
  }[] = [
    {
      title: "D-PG4-01 words a traversal as Claude Code's escape error",
      refused: { path: "../outside", cause: "traversal" },
      expected: "skills path escapes plugin directory: ../outside",
    },
    {
      title: "D-PG4-01 words a missing path as Claude Code's not-found error",
      refused: { path: "skills/missing", cause: "missing" },
      expected: "skills path not found: skills/missing",
    },
    {
      title: "D-PG4-01 words a file path as Claude Code's file error",
      refused: { path: "notes.md", cause: "file" },
      expected:
        "Failed to load skills from notes.md: path is a file; skills entries must be directories containing SKILL.md",
    },
    {
      title: "D-PG4-01 points a listed SKILL.md file at the folder that holds it",
      refused: { path: "skills/a/skill.MD", cause: "file" },
      expected:
        "Failed to load skills from skills/a/skill.MD: path is a file; skills entries must be directories containing SKILL.md \u2014 point to the parent directory 'skills/a' instead",
    },
    {
      title: "D-PG4-01 points a listed root SKILL.md file at the plugin root",
      refused: { path: "SKILL.md", cause: "file" },
      expected:
        "Failed to load skills from SKILL.md: path is a file; skills entries must be directories containing SKILL.md \u2014 point to the plugin root '.' instead",
    },
    {
      title: "D-PG4-01 escapes a control character of the listed path",
      refused: { path: "../out\nside", cause: "traversal" },
      expected: String.raw`skills path escapes plugin directory: ../out\u{a}side`,
    },
  ];

  for (const { title, refused, expected } of cases) {
    test(title, () => {
      // act
      const messages = refusedListedSkillPathMessages([refused]);

      // assert
      assert.deepStrictEqual(messages, [expected]);
    });
  }

  test("D-PG4-01 gives no message when no listed path is refused", () => {
    // act
    const messages = refusedListedSkillPathMessages(undefined);

    // assert
    assert.deepStrictEqual(messages, []);
  });
});

describe("collectStrictComponentPaths shadowed folders", () => {
  test("D-CF1-06 records a shadowed kind once when the same resolution is collected twice", async () => {
    // arrange
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();
    const input = {
      entry: { name: "alpha", source: "./alpha" },
      manifest: { agents: "custom-agents" },
      pluginRoot,
      resolution,
    };
    const statKind = (candidate: string): Promise<"dir" | null> =>
      Promise.resolve(candidate === path.join(pluginRoot, "agents") ? "dir" : null);

    // act
    await collectStrictComponentPaths(input, statKind);
    await collectStrictComponentPaths(input, statKind);

    // assert
    assert.deepStrictEqual(resolution.shadowedFolders, ["agents"]);
  });
});

describe("isMarketplaceRootSource", () => {
  const cases = [
    { source: "./", expected: true },
    { source: ".", expected: true },
    { source: "", expected: true },
    { source: ".\\", expected: true },
    { source: "././", expected: true },
    { source: "./alpha", expected: false },
    { source: "..", expected: false },
    { source: "alpha", expected: false },
    { source: { source: "directory", path: "./" }, expected: false },
    { source: undefined, expected: false },
  ] as const;

  for (const { source, expected } of cases) {
    test(`D-PG4-01 reads ${JSON.stringify(source)} as ${expected ? "" : "not "}the marketplace root`, () => {
      // act
      const actual = isMarketplaceRootSource(source);

      // assert
      assert.strictEqual(actual, expected);
    });
  }
});

describe("collectStrictComponentPaths root-source entries", () => {
  interface RootSourceCase {
    readonly title: string;
    readonly source: unknown;
    /** The entry's `skills`; a missing key declares nothing. */
    readonly entry?: { readonly skills?: unknown };
    readonly manifestSkills?: unknown;
    /** Directories under the plugin root; `.` is the root itself. */
    readonly directories: readonly string[];
    readonly files?: readonly string[];
    readonly expectedPaths: readonly string[];
    readonly expectedNotes?: readonly string[];
    readonly expectedRefused?: readonly RefusedListedSkillPath[];
  }

  const ALL_FOLDERS = [".", "skills", "skills/a", "skills/b", "extra"] as const;

  const rootSourceCases: readonly RootSourceCase[] = [
    ...(["./", ".", ".\\", "././"] as const).map((source): RootSourceCase => ({
      title: `D-PG4-01 the root source ${JSON.stringify(source)} collects only its listed skill folder`,
      source,
      entry: { skills: ["./skills/a"] },
      manifestSkills: ["extra"],
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a"],
    })),
    {
      title: "D-PG4-01 a single listed path selects that one folder",
      source: "./",
      entry: { skills: "./skills/b" },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/b"],
    },
    {
      title: "D-PG4-01 a listed plugin root collects the root and then the skills folder",
      source: "./",
      entry: { skills: ["."] },
      directories: ALL_FOLDERS,
      expectedPaths: [".", "skills"],
    },
    {
      title: "D-PG4-01 a listed plugin root collects no skills folder when none exists",
      source: "./",
      entry: { skills: ["./"] },
      directories: ["."],
      expectedPaths: ["."],
    },
    {
      title: "D-PG4-01 a listed skills folder collects once in either spelling",
      source: "./",
      entry: { skills: ["skills", "./skills/"] },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills"],
    },
    {
      title: "D-PG4-01 two spellings of one listed folder collect once",
      source: "./",
      entry: { skills: ["./skills/a", "skills/a/"] },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a"],
    },
    {
      title: "D-PG4-01 the listed paths keep their listed order",
      source: "./",
      entry: { skills: ["./skills/b", "./skills/a"] },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/b", "skills/a"],
    },
    {
      title:
        "D-PG4-01 a missing or file listed path does not survive beside one that does and is recorded relative to the plugin root",
      source: "./",
      entry: { skills: ["./skills/missing", "./skills/file", "./skills/a"] },
      directories: ALL_FOLDERS,
      files: ["skills/file"],
      expectedPaths: ["skills/a"],
      expectedRefused: [
        { path: "skills/missing", cause: "missing" },
        { path: "skills/file", cause: "file" },
      ],
    },
    {
      title:
        "D-PG4-01 no survivor and an escaping listed path collect no skill path and leave the plugin unmarked",
      source: "./",
      entry: { skills: ["../outside", "./skills/missing"] },
      manifestSkills: ["extra"],
      directories: ALL_FOLDERS,
      expectedPaths: [],
      expectedRefused: [
        { path: "../outside", cause: "traversal" },
        { path: "skills/missing", cause: "missing" },
      ],
    },
    {
      title:
        "D-PG4-01 no survivor and an absolute listed path collect no skill path and leave the plugin unmarked",
      source: "./",
      entry: { skills: ["/outside/skills"] },
      directories: ALL_FOLDERS,
      expectedPaths: [],
      expectedRefused: [{ path: "/outside/skills", cause: "traversal" }],
    },
    {
      title:
        "D-PG4-01 an escaping listed path beside a survivor is dropped without a note and recorded as written",
      source: "./",
      entry: { skills: ["../outside", "./skills/a", "/outside/skills"] },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a"],
      expectedRefused: [
        { path: "../outside", cause: "traversal" },
        { path: "/outside/skills", cause: "traversal" },
      ],
    },
    {
      title: "D-PG4-01 no survivor and no traversal apply the D-CF1-06 rule",
      source: "./",
      entry: { skills: ["./skills/missing"] },
      manifestSkills: ["extra"],
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/missing", "extra", "skills"],
      expectedRefused: [{ path: "skills/missing", cause: "missing" }],
    },
    {
      title:
        "D-PG4-01 a listed path that is not a string is no traversal, so the D-CF1-06 rule applies",
      source: "./",
      entry: { skills: [42, "./skills/missing"] },
      manifestSkills: ["../manifest-outside"],
      directories: ["skills"],
      expectedPaths: ["skills/missing", "skills"],
      expectedRefused: [{ path: "skills/missing", cause: "missing" }],
      expectedNotes: [
        'component path for "skills" is not a string (got number)',
        'component path for "skills" escapes plugin root: "../manifest-outside"',
      ],
    },
    {
      title:
        "D-PG4-01 a refused plugin.json path still marks the plugin when a listed path survives",
      source: "./",
      entry: { skills: ["./skills/a"] },
      manifestSkills: ["/outside/manifest"],
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a"],
      expectedNotes: [
        'component path for "skills" must be relative (got absolute "/outside/manifest")',
      ],
    },
    ...(
      [
        { label: "absent", entry: {} },
        { label: "null", entry: { skills: null } },
        { label: "an empty string", entry: { skills: "" } },
        { label: "an empty list", entry: { skills: [] } },
      ] as const
    ).map(({ label, entry }): RootSourceCase => ({
      title: `D-PG4-01 a root-source entry whose skills is ${label} applies the D-CF1-06 rule`,
      source: "./",
      entry,
      manifestSkills: ["extra"],
      directories: ALL_FOLDERS,
      expectedPaths: ["extra", "skills"],
    })),
    {
      title: "D-PG4-01 an object-form source applies the D-CF1-06 rule to its listed skills",
      source: { source: "directory", path: "./" },
      entry: { skills: ["./skills/a"] },
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a", "skills"],
    },
    {
      title: "D-PG4-01 a source below the root applies the D-CF1-06 rule to its listed skills",
      source: "./alpha",
      entry: { skills: ["./skills/a"] },
      manifestSkills: ["extra"],
      directories: ALL_FOLDERS,
      expectedPaths: ["skills/a", "extra", "skills"],
    },
  ];

  for (const {
    title,
    source,
    entry,
    manifestSkills,
    directories,
    files,
    expectedPaths,
    expectedNotes,
    expectedRefused,
  } of rootSourceCases) {
    test(title, async () => {
      // arrange
      const pluginRoot = "/plugins/alpha";
      const resolution = emptyResolution();
      const directoryPaths = new Set(directories.map((folder) => path.join(pluginRoot, folder)));
      const filePaths = new Set((files ?? []).map((file) => path.join(pluginRoot, file)));
      const statKind = (candidate: string): Promise<"dir" | "file" | null> => {
        if (directoryPaths.has(candidate)) {
          return Promise.resolve("dir");
        }

        return Promise.resolve(filePaths.has(candidate) ? "file" : null);
      };

      // act
      const dirty = await collectStrictComponentPaths(
        {
          entry: { name: "alpha", source, ...entry },
          manifest: manifestSkills === undefined ? null : { skills: manifestSkills },
          pluginRoot,
          resolution,
        },
        statKind,
      );

      // assert
      assert.deepStrictEqual(
        { dirty, resolution },
        {
          dirty: expectedNotes !== undefined,
          resolution: {
            supported: expectedPaths.length > 0 ? ["skills"] : [],
            notes: expectedNotes ?? [],
            componentPaths: { skills: expectedPaths, commands: [], agents: [], workflows: [] },
            ...(expectedRefused !== undefined && { refusedListedSkillPaths: expectedRefused }),
          },
        },
      );
    });
  }

  test("D-PG4-01 the stat reader receives no refused listed path", async () => {
    // arrange
    const pluginRoot = "/plugins/alpha";
    const resolution = emptyResolution();
    const statted: string[] = [];

    // act
    const dirty = await collectStrictComponentPaths(
      {
        entry: {
          name: "alpha",
          source: "./",
          skills: ["../outside", "/outside/skills", "./skills/a"],
        },
        manifest: null,
        pluginRoot,
        resolution,
      },
      (candidate) => {
        statted.push(candidate);
        return Promise.resolve(candidate === path.join(pluginRoot, "skills/a") ? "dir" : null);
      },
    );

    // assert
    assert.deepStrictEqual(
      { dirty, resolution, statted },
      {
        dirty: false,
        resolution: {
          supported: ["skills"],
          notes: [],
          componentPaths: { skills: ["skills/a"], commands: [], agents: [], workflows: [] },
          refusedListedSkillPaths: [
            { path: "../outside", cause: "traversal" },
            { path: "/outside/skills", cause: "traversal" },
          ],
        },
        statted: [
          path.join(pluginRoot, "skills/a"),
          path.join(pluginRoot, "commands"),
          path.join(pluginRoot, "agents"),
          path.join(pluginRoot, "workflows"),
        ],
      },
    );
  });
});
