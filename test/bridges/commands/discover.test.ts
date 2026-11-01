import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { createHash } from "node:crypto";
import { renameSync, symlinkSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";

import type {
  CommandMapEntry,
  ResolvedPluginInstallable,
} from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

function resolvedPlugin(
  pluginRoot: string,
  commands: readonly string[],
  commandMap?: readonly CommandMapEntry[],
): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: commands.length === 0 && commandMap === undefined ? [] : ["commands"],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: [],
      commands: [...commands],
      agents: [],
      workflows: [],
      ...(commandMap !== undefined && { commandMap: [...commandMap] }),
    },
    mcpServers: {},
    defaultEnabled: true,
  };
}

function sourceEntry(key: string, source: string): CommandMapEntry {
  return { key, source, origin: "manifest" };
}

test("discovers recursive commands in deterministic depth-first order with complete records", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-recursive-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const deployPath = path.join(commandsDirectory, "acme-build", "deploy.md");
  const rolloutPath = path.join(commandsDirectory, "acme-build", "prod", "rollout.md");
  const statusPath = path.join(commandsDirectory, "status.md");
  await mkdir(path.dirname(rolloutPath), { recursive: true });
  await writeFile(deployPath, "# deploy\r\n");
  await writeFile(rolloutPath, "# prod\n");
  await writeFile(statusPath, "# status\n");
  await writeFile(path.join(commandsDirectory, "README.txt"), "not a command\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "acme-build/deploy",
        generatedName: "acme:build:deploy",
        commandFile: deployPath,
      },
      {
        kind: "file",
        sourceName: "acme-build/prod/rollout",
        generatedName: "acme:build:prod:rollout",
        commandFile: rolloutPath,
      },
      {
        kind: "file",
        sourceName: "status",
        generatedName: "acme:status",
        commandFile: statusPath,
      },
    ],
    warnings: [],
  };
  const expectedDigests = [
    "1075382f7b89f51b6690453cb2e301a66bf19aec0b290a64d48d708e069b94a9",
    "a5695335cc9062f56b6e9b4564749e8331e388fca68ca0dd3bfeb6f7986dd674",
    "647d5f12f64b19a8992863dec45f6f518fbfaca7c016c6bbdc7685d81bb95104",
  ];

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
  assert.deepStrictEqual(
    await Promise.all(
      [deployPath, rolloutPath, statusPath].map(async (commandPath) =>
        createHash("sha256")
          .update(await readFile(commandPath))
          .digest("hex"),
      ),
    ),
    expectedDigests,
  );
  assert.strictEqual(Object.isFrozen(discovery.discovered), true);
  assert.strictEqual(Object.isFrozen(discovery.warnings), true);
});

test("elides the plugin prefix from only the first command path segment", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-head-elision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const commandPath = path.join(commandsDirectory, "acme-tools", "acme-lint.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "lint\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "acme-tools/acme-lint",
        generatedName: "acme:tools:acme-lint",
        commandFile: commandPath,
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("preserves declared command-root order for absolute and relative roots", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-roots-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const relativeDirectory = path.join(directory, "relative");
  const absoluteDirectory = path.join(directory, "absolute");
  const relativePath = path.join(relativeDirectory, "second.md");
  const absolutePath = path.join(absoluteDirectory, "first.md");
  await mkdir(relativeDirectory, { recursive: true });
  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(relativePath, "second\n");
  await writeFile(absolutePath, "first\n");
  const resolved = resolvedPlugin(directory, [absoluteDirectory, "relative"]);
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "first", generatedName: "acme:first", commandFile: absolutePath },
      {
        kind: "file",
        sourceName: "second",
        generatedName: "acme:second",
        commandFile: relativePath,
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 names a declared command file and a nested declared file from their basenames", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-file-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const filePath = path.join(directory, "cmds", "a.md");
  const nestedPath = path.join(directory, "cmds", "sub", "x.md");
  await mkdir(path.dirname(nestedPath), { recursive: true });
  await writeFile(filePath, "a\n");
  await writeFile(nestedPath, "x\n");
  const resolved = resolvedPlugin(directory, ["cmds/a.md", "cmds/sub/x.md"]);
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "a", generatedName: "acme:a", commandFile: filePath },
      { kind: "file", sourceName: "x", generatedName: "acme:x", commandFile: nestedPath },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 skips each declared path that is not a command file with a warning naming it", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-skips-"));
  const socketPath = path.join(directory, "cmds", "sock.md");
  const server = createServer();
  t.after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const goodPath = path.join(directory, "cmds", "good.md");
  await mkdir(path.join(directory, "cmds", "linked-dir-target"), { recursive: true });
  await writeFile(path.join(directory, "cmds", "readme.txt"), "readme\n");
  await writeFile(path.join(directory, "cmds", ".secret.md"), "secret\n");
  await writeFile(path.join(directory, "cmds", "target.md"), "target\n");
  await writeFile(goodPath, "good\n");
  await symlink(path.join(directory, "cmds", "target.md"), path.join(directory, "cmds", "link.md"));
  await symlink(
    path.join(directory, "cmds", "linked-dir-target"),
    path.join(directory, "cmds", "linked-dir"),
  );
  await new Promise<void>((resolve) => {
    server.listen(socketPath, resolve);
  });
  const resolved = resolvedPlugin(directory, [
    "cmds/readme.txt",
    "cmds/.secret.md",
    "cmds/link.md",
    "cmds/linked-dir",
    "cmds/sock.md",
    "cmds/good.md",
  ]);
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "good", generatedName: "acme:good", commandFile: goodPath },
    ],
    warnings: [
      `declared command path "cmds/readme.txt" in "${directory}" is not a markdown file; skipping path.`,
      `declared command path "cmds/.secret.md" in "${directory}" is dotfile-prefixed; skipping path.`,
      `declared command path "cmds/link.md" in "${directory}" is a symlink; skipping path.`,
      `declared command path "cmds/linked-dir" in "${directory}" is a symlink; skipping path.`,
      `declared command path "cmds/sock.md" in "${directory}" is not a regular file; skipping path.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 keeps one command for a declared file its declared directory also reaches", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-overlap-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const filePath = path.join(directory, "cmds", "a.md");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "a\n");
  const resolved = resolvedPlugin(directory, ["cmds", "cmds/a.md"]);
  const expectedDiscovery = {
    discovered: [{ kind: "file", sourceName: "a", generatedName: "acme:a", commandFile: filePath }],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 keeps the first of two declared files that name the same command", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-collision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const winningPath = path.join(directory, "cmds", "a.md");
  const losingPath = path.join(directory, "other", "a.md");
  await mkdir(path.dirname(winningPath), { recursive: true });
  await mkdir(path.dirname(losingPath), { recursive: true });
  await writeFile(winningPath, "winner\n");
  await writeFile(losingPath, "duplicate\n");
  const resolved = resolvedPlugin(directory, ["cmds/a.md", "other/a.md"]);
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "a", generatedName: "acme:a", commandFile: winningPath },
    ],
    warnings: [
      `command source "a" in "${losingPath}" elides to generated name "acme:a", already produced by command source "a"; ignoring duplicate.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 skips a declared command file whose name is unsafe and reports its cause chain", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-bad-name-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "cmds");
  const unsafeSourceName = "bad\u0001";
  await mkdir(commandsDirectory, { recursive: true });
  await writeFile(path.join(commandsDirectory, `${unsafeSourceName}.md`), "unsafe\n");
  const resolved = resolvedPlugin(directory, [`cmds/${unsafeSourceName}.md`]);
  const nameErrorMessage = `invalid command source "${unsafeSourceName}" in "${commandsDirectory}"`;
  const expectedDiscovery = {
    discovered: [],
    warnings: [
      `${nameErrorMessage} -- cause: ${nameErrorMessage} -> command path segment in "${unsafeSourceName}" "${unsafeSourceName}" must not contain ASCII control characters.; skipping file.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF3-05 propagates a non-tolerated error when a declared path cannot be classified", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-declared-loop-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const loopPath = path.join(directory, "loop");
  const declaredPath = path.join(loopPath, "a.md");
  await symlink(loopPath, loopPath);
  const resolved = resolvedPlugin(directory, ["loop/a.md"]);

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
          path: (error as NodeJS.ErrnoException).path,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        {
          name: "Error",
          message: `ELOOP: too many symbolic links encountered, lstat '${declaredPath}'`,
          code: "ELOOP",
          path: declaredPath,
          syscall: "lstat",
        },
      );
      return true;
    },
  );
});

test("returns an empty frozen inventory when the plugin declares no command roots", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-empty-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const resolved = resolvedPlugin(directory, []);
  const expectedDiscovery = { discovered: [], warnings: [] };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
  assert.strictEqual(Object.isFrozen(discovery.discovered), true);
  assert.strictEqual(Object.isFrozen(discovery.warnings), true);
});

test("treats missing and non-directory command roots as empty", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-absent-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const filePath = path.join(directory, "source.md");
  await writeFile(filePath, "source\n");
  const resolved = resolvedPlugin(directory, ["missing", path.join(filePath, "commands")]);
  const expectedDiscovery = { discovered: [], warnings: [] };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("skips dot entries and symlinks without following their targets", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-skips-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const hiddenDirectory = path.join(commandsDirectory, ".hidden");
  const outsideDirectory = path.join(directory, "outside");
  const goodPath = path.join(commandsDirectory, "good.md");
  await mkdir(hiddenDirectory, { recursive: true });
  await mkdir(outsideDirectory, { recursive: true });
  await writeFile(path.join(hiddenDirectory, "hidden.md"), "hidden\n");
  await writeFile(path.join(commandsDirectory, ".hidden.md"), "hidden\n");
  await writeFile(path.join(commandsDirectory, "notes.txt"), "notes\n");
  await writeFile(path.join(outsideDirectory, "escaped.md"), "escaped\n");
  await writeFile(path.join(directory, "outside.md"), "outside\n");
  await writeFile(goodPath, "good\n");
  await symlink(path.join(directory, "missing.md"), path.join(commandsDirectory, "dangling.md"));
  await symlink(path.join(directory, "outside.md"), path.join(commandsDirectory, "linked-file.md"));
  await symlink(outsideDirectory, path.join(commandsDirectory, "linked"));
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "good", generatedName: "acme:good", commandFile: goodPath },
    ],
    warnings: [
      `command subdirectory ".hidden" in "${commandsDirectory}" is dotfile-prefixed; skipping subdirectory.`,
      `command subdirectory "linked" in "${commandsDirectory}" is a symlink; skipping subdirectory.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("keeps the first command when plugin-prefix elision creates a duplicate name", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-collision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const winningPath = path.join(commandsDirectory, "acme-tools", "lint.md");
  await mkdir(path.dirname(winningPath), { recursive: true });
  await mkdir(path.join(commandsDirectory, "tools"), { recursive: true });
  await writeFile(winningPath, "winner\n");
  await writeFile(path.join(commandsDirectory, "tools", "lint.md"), "duplicate\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "acme-tools/lint",
        generatedName: "acme:tools:lint",
        commandFile: winningPath,
      },
    ],
    warnings: [
      `command source "tools/lint" in "${commandsDirectory}" elides to generated name "acme:tools:lint", already produced by command source "acme-tools/lint"; ignoring duplicate.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("uses depth-first order as the first-wins tiebreak for flat and nested names", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-dfs-collision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const winningPath = path.join(commandsDirectory, "build", "web.md");
  await mkdir(path.dirname(winningPath), { recursive: true });
  await writeFile(winningPath, "nested\n");
  await writeFile(path.join(commandsDirectory, "build:web.md"), "flat\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "build/web",
        generatedName: "acme:build:web",
        commandFile: winningPath,
      },
    ],
    warnings: [
      `command source "build:web" in "${commandsDirectory}" elides to generated name "acme:build:web", already produced by command source "build/web"; ignoring duplicate.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("keeps one source file reached through overlapping command roots without warning", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-overlap-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const commandPath = path.join(commandsDirectory, "build", "web.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "web\n");
  const resolved = resolvedPlugin(directory, ["commands", "commands/build"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "build/web",
        generatedName: "acme:build:web",
        commandFile: commandPath,
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

for (const { description, relativePath, sourceName, generatedName } of [
  {
    description: "keeps a command head whose prefix elision would be empty",
    relativePath: "acme-.md",
    sourceName: "acme-",
    generatedName: "acme:acme-",
  },
  {
    description: "matches the plugin prefix with case-sensitive semantics",
    relativePath: path.join("Acme-tools", "lint.md"),
    sourceName: "Acme-tools/lint",
    generatedName: "acme:Acme-tools:lint",
  },
  {
    description: "preserves punctuation that is valid in a command segment",
    relativePath: "acme_tools!.md",
    sourceName: "acme_tools!",
    generatedName: "acme:acme_tools!",
  },
]) {
  test(description, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "command-discover-boundary-"));
    t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
    const commandsDirectory = path.join(directory, "commands");
    const commandPath = path.join(commandsDirectory, relativePath);
    await mkdir(path.dirname(commandPath), { recursive: true });
    await writeFile(commandPath, "command\n");
    const resolved = resolvedPlugin(directory, ["commands"]);
    const expectedDiscovery = {
      discovered: [{ kind: "file", sourceName, generatedName, commandFile: commandPath }],
      warnings: [],
    };

    // act
    const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

    // assert
    assert.deepStrictEqual(discovery, expectedDiscovery);
  });
}

test("skips an unsafe command name and reports its complete cause chain", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-invalid-name-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const goodPath = path.join(commandsDirectory, "good.md");
  const unsafeSourceName = "bad\u0001";
  await mkdir(commandsDirectory, { recursive: true });
  await writeFile(path.join(commandsDirectory, `${unsafeSourceName}.md`), "unsafe\n");
  await writeFile(goodPath, "good\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const nameErrorMessage = `invalid command source "${unsafeSourceName}" in "${commandsDirectory}"`;
  const expectedDiscovery = {
    discovered: [
      { kind: "file", sourceName: "good", generatedName: "acme:good", commandFile: goodPath },
    ],
    warnings: [
      `${nameErrorMessage} -- cause: ${nameErrorMessage} -> command path segment in "${unsafeSourceName}" "${unsafeSourceName}" must not contain ASCII control characters.; skipping file.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("skips an unreadable command subdirectory and reports the filesystem error", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-unreadable-dir-"));
  const commandsDirectory = path.join(directory, "commands");
  const lockedDirectory = path.join(commandsDirectory, "locked");
  t.after(async () => {
    await chmod(lockedDirectory, 0o755).catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const goodPath = path.join(commandsDirectory, "readable.md");
  await mkdir(lockedDirectory, { recursive: true });
  await writeFile(path.join(lockedDirectory, "hidden.md"), "hidden\n");
  await writeFile(goodPath, "good\n");
  await chmod(lockedDirectory, 0o000);
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "readable",
        generatedName: "acme:readable",
        commandFile: goodPath,
      },
    ],
    warnings: [
      `command subdirectory "locked" in "${commandsDirectory}" cannot be read: EACCES: permission denied, scandir '${lockedDirectory}'; skipping subdirectory.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("skips a command file whose metadata is unreadable and reports the filesystem error", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-unreadable-file-"));
  const commandsDirectory = path.join(directory, "commands");
  const unreadableDirectory = path.join(commandsDirectory, "readable-only");
  t.after(async () => {
    await chmod(unreadableDirectory, 0o755).catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const unreadablePath = path.join(unreadableDirectory, "hidden.md");
  const goodPath = path.join(commandsDirectory, "readable.md");
  await mkdir(unreadableDirectory, { recursive: true });
  await writeFile(unreadablePath, "hidden\n");
  await writeFile(goodPath, "good\n");
  await chmod(unreadableDirectory, 0o444);
  const resolved = resolvedPlugin(directory, ["commands"]);
  const expectedDiscovery = {
    discovered: [
      {
        kind: "file",
        sourceName: "readable",
        generatedName: "acme:readable",
        commandFile: goodPath,
      },
    ],
    warnings: [
      `command file "readable-only/hidden.md" in "${commandsDirectory}" cannot be read: EACCES: permission denied, lstat '${unreadablePath}'; skipping file.`,
    ],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("rejects an unreadable declared command root", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-unreadable-root-"));
  const commandsDirectory = path.join(directory, "commands");
  t.after(async () => {
    await chmod(commandsDirectory, 0o755).catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(commandsDirectory, { recursive: true });
  await chmod(commandsDirectory, 0o000);
  const resolved = resolvedPlugin(directory, ["commands"]);

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
          path: (error as NodeJS.ErrnoException).path,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        {
          name: "Error",
          message: `EACCES: permission denied, scandir '${commandsDirectory}'`,
          code: "EACCES",
          path: commandsDirectory,
          syscall: "scandir",
        },
      );
      return true;
    },
  );
});

test("propagates a non-tolerated error when a discovered subdirectory becomes a symlink loop", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-subdir-race-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const volatileDirectory = path.join(commandsDirectory, "volatile");
  const displacedDirectory = path.join(commandsDirectory, "volatile-original");
  await mkdir(volatileDirectory, { recursive: true });
  await writeFile(path.join(volatileDirectory, "command.md"), "command\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const filesystemRequests = new Set<number>();
  let completedFilesystemRequests = 0;
  const hook = createHook({
    init(asyncId, type) {
      if (type === "FSREQPROMISE") {
        filesystemRequests.add(asyncId);
      }
    },
    after(asyncId) {
      if (!filesystemRequests.delete(asyncId)) {
        return;
      }

      completedFilesystemRequests += 1;
      if (completedFilesystemRequests === 2) {
        hook.disable();
        renameSync(volatileDirectory, displacedDirectory);
        symlinkSync(volatileDirectory, volatileDirectory, "dir");
      }
    },
  });
  t.after(() => hook.disable());
  hook.enable();

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
          path: (error as NodeJS.ErrnoException).path,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        {
          name: "Error",
          message: `ELOOP: too many symbolic links encountered, scandir '${volatileDirectory}'`,
          code: "ELOOP",
          path: volatileDirectory,
          syscall: "scandir",
        },
      );
      return true;
    },
  );
});

test("propagates a non-tolerated error when a discovered file gains a looping parent", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-file-race-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const volatileDirectory = path.join(commandsDirectory, "volatile");
  const displacedDirectory = path.join(commandsDirectory, "volatile-original");
  const commandPath = path.join(volatileDirectory, "command.md");
  await mkdir(volatileDirectory, { recursive: true });
  await writeFile(commandPath, "command\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const filesystemRequests = new Set<number>();
  let completedFilesystemRequests = 0;
  const hook = createHook({
    init(asyncId, type) {
      if (type === "FSREQPROMISE") {
        filesystemRequests.add(asyncId);
      }
    },
    after(asyncId) {
      if (!filesystemRequests.delete(asyncId)) {
        return;
      }

      completedFilesystemRequests += 1;
      if (completedFilesystemRequests === 3) {
        hook.disable();
        renameSync(volatileDirectory, displacedDirectory);
        symlinkSync(volatileDirectory, volatileDirectory, "dir");
      }
    },
  });
  t.after(() => hook.disable());
  hook.enable();

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
          path: (error as NodeJS.ErrnoException).path,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        {
          name: "Error",
          message: `ELOOP: too many symbolic links encountered, lstat '${commandPath}'`,
          code: "ELOOP",
          path: commandPath,
          syscall: "lstat",
        },
      );
      return true;
    },
  );
});

test("D-CF3-03 names each command map source file after its key", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-names-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const cmds = path.join(directory, "cmds");
  await mkdir(cmds, { recursive: true });
  await writeFile(path.join(cmds, "alpha.md"), "alpha\n");
  await writeFile(path.join(cmds, "web.md"), "web\n");
  await writeFile(path.join(cmds, "deploy.md"), "deploy\n");
  await writeFile(path.join(cmds, "lint.md"), "lint\n");
  const resolved = resolvedPlugin(
    directory,
    [],
    [
      sourceEntry("alpha", "cmds/alpha.md"),
      sourceEntry("build/web", "cmds/web.md"),
      sourceEntry("Deploy", "cmds/deploy.md"),
      sourceEntry("acme-lint", "cmds/lint.md"),
    ],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        kind: "file",
        sourceName: "alpha",
        generatedName: "acme:alpha",
        commandFile: path.join(cmds, "alpha.md"),
      },
      {
        kind: "file",
        sourceName: "build/web",
        generatedName: "acme:build:web",
        commandFile: path.join(cmds, "web.md"),
      },
      {
        kind: "file",
        sourceName: "Deploy",
        generatedName: "acme:Deploy",
        commandFile: path.join(cmds, "deploy.md"),
      },
      {
        kind: "file",
        sourceName: "acme-lint",
        generatedName: "acme:lint",
        commandFile: path.join(cmds, "lint.md"),
      },
    ],
    warnings: [],
  });
});

for (const { key, shownKey, reason } of [
  { key: "trail:", shownKey: "trail:", reason: 'ends with ":"' },
  { key: "<angle>", shownKey: "<angle>", reason: 'holds "<" or ">"' },
  { key: "right>", shownKey: "right>", reason: 'holds "<" or ">"' },
  { key: "has space", shownKey: "has space", reason: "holds whitespace" },
  { key: "tab\tkey", shownKey: String.raw`tab\u{9}key`, reason: "holds whitespace" },
  {
    key: `zero${String.fromCodePoint(0x200b)}width`,
    shownKey: String.raw`zero\u{200B}width`,
    reason: "holds a hidden or direction-changing character",
  },
  {
    key: `bidi${String.fromCodePoint(0x202e)}flip`,
    shownKey: String.raw`bidi\u{202E}flip`,
    reason: "holds a hidden or direction-changing character",
  },
  {
    key: "a/../b",
    shownKey: "a/../b",
    reason: 'cannot name a command (command path segment in "a/../b" must not be "." or "..")',
  },
  {
    key: "bell\u0007",
    shownKey: String.raw`bell\u{7}`,
    reason: String.raw`cannot name a command (command path segment in "bell\u{7}" "bell\u{7}" must not contain ASCII control characters)`,
  },
]) {
  test(`D-CF3-03 skips the command map key ${shownKey} with a warning`, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-key-"));
    t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
    const commandPath = path.join(directory, "cmds", "a.md");
    await mkdir(path.dirname(commandPath), { recursive: true });
    await writeFile(commandPath, "a\n");
    const resolved = resolvedPlugin(directory, [], [sourceEntry(key, "cmds/a.md")]);

    // act
    const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

    // assert
    assert.deepStrictEqual(discovery, {
      discovered: [],
      warnings: [`command map entry "${shownKey}" ${reason}; skipping entry.`],
    });
  });
}

test("D-CF3-03 skips each command map source that is not a command file with a warning", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-source-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const cmds = path.join(directory, "cmds");
  await mkdir(cmds, { recursive: true });
  await writeFile(path.join(cmds, "notes.txt"), "notes\n");
  await writeFile(path.join(cmds, ".hidden.md"), "hidden\n");
  await writeFile(path.join(directory, "real.md"), "real\n");
  await symlink(path.join(directory, "real.md"), path.join(cmds, "linked.md"));
  const resolved = resolvedPlugin(
    directory,
    [],
    [
      sourceEntry("missing", "cmds/missing.md"),
      sourceEntry("text", "cmds/notes.txt"),
      sourceEntry("hidden", "cmds/.hidden.md"),
      sourceEntry("linked", "cmds/linked.md"),
      sourceEntry("under-file", "real.md/child.md"),
    ],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [],
    warnings: [
      `command map entry "missing" names "cmds/missing.md", which does not exist; skipping entry.`,
      `command map entry "text" names "cmds/notes.txt", which is not a markdown file; skipping entry.`,
      `command map entry "hidden" names "cmds/.hidden.md", which is dotfile-prefixed; skipping entry.`,
      `command map entry "linked" names "cmds/linked.md", which is a symlink; skipping entry.`,
      `command map entry "under-file" names "real.md/child.md", which does not exist; skipping entry.`,
    ],
  });
});

test("D-CF3-03 walks a command map directory source and ignores its key", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-dir-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const topPath = path.join(directory, "more", "b.md");
  const nestedPath = path.join(directory, "more", "sub", "x.md");
  await mkdir(path.dirname(nestedPath), { recursive: true });
  await writeFile(topPath, "b\n");
  await writeFile(nestedPath, "x\n");
  const resolved = resolvedPlugin(directory, [], [sourceEntry("trail:", "more")]);

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "file", sourceName: "b", generatedName: "acme:b", commandFile: topPath },
      { kind: "file", sourceName: "sub/x", generatedName: "acme:sub:x", commandFile: nestedPath },
    ],
    warnings: [],
  });
});

test("D-CF3-03 skips a second command map key on one file with a warning naming the first", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-same-file-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandPath = path.join(directory, "cmds", "a.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "a\n");
  const resolved = resolvedPlugin(
    directory,
    [],
    [sourceEntry("one", "cmds/a.md"), sourceEntry("two", "./cmds/a.md")],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "file", sourceName: "one", generatedName: "acme:one", commandFile: commandPath },
    ],
    warnings: [
      `command map entry "two" names "cmds/a.md", already loaded as command source "one"; skipping entry.`,
    ],
  });
});

test("D-CF3-03 gives a declared path's command precedence over a command map key", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-order-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const folderPath = path.join(directory, "commands", "alpha.md");
  const mappedPath = path.join(directory, "cmds", "other.md");
  await mkdir(path.dirname(folderPath), { recursive: true });
  await mkdir(path.dirname(mappedPath), { recursive: true });
  await writeFile(folderPath, "alpha\n");
  await writeFile(mappedPath, "other\n");
  const resolved = resolvedPlugin(
    directory,
    ["commands"],
    [sourceEntry("alpha", "cmds/other.md"), sourceEntry("again", "commands/alpha.md")],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "file", sourceName: "alpha", generatedName: "acme:alpha", commandFile: folderPath },
    ],
    warnings: [
      `command map entry "alpha" elides to generated name "acme:alpha", already produced by command source "alpha"; skipping entry.`,
      `command map entry "again" names "commands/alpha.md", already loaded as command source "alpha"; skipping entry.`,
    ],
  });
});

test("D-CF3-03 discovers a plugin manifest's inline command map entry with its overrides", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-inline-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandPath = path.join(directory, "cmds", "alpha.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "alpha\n");
  const resolved = resolvedPlugin(
    directory,
    [],
    [
      {
        key: "beta",
        content: "Beta body",
        origin: "manifest",
        description: "Beta.",
        argumentHint: "<target>",
        model: "opus",
      },
      { key: "alpha", source: "cmds/alpha.md", origin: "manifest", model: "haiku" },
      { key: "gamma", content: "Gamma body", origin: "manifest" },
    ],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        kind: "inline",
        sourceName: "beta",
        generatedName: "acme:beta",
        content: "Beta body",
        overrides: { description: "Beta.", argumentHint: "<target>", model: "opus" },
      },
      {
        kind: "file",
        sourceName: "alpha",
        generatedName: "acme:alpha",
        commandFile: commandPath,
        overrides: { model: "haiku" },
      },
      { kind: "inline", sourceName: "gamma", generatedName: "acme:gamma", content: "Gamma body" },
    ],
    warnings: [],
  });
});

test("D-CF3-04 drops a marketplace entry's inline command map entry with a warning", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-entry-inline-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandPath = path.join(directory, "extra", "gamma.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "gamma\n");
  const resolved = resolvedPlugin(
    directory,
    [],
    [
      { key: "gamma", source: "extra/gamma.md", origin: "entry" },
      { key: "delta", content: "Delta body", origin: "entry" },
    ],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "file", sourceName: "gamma", generatedName: "acme:gamma", commandFile: commandPath },
    ],
    warnings: [
      'command map entry "delta" sets "content", which a marketplace entry cannot declare; skipping entry.',
    ],
  });
});

test("D-CF3-03 skips an inline command map entry whose key cannot name a command", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-inline-key-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const resolved = resolvedPlugin(
    directory,
    [],
    [{ key: "has space", content: "Body", origin: "manifest" }],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [],
    warnings: ['command map entry "has space" holds whitespace; skipping entry.'],
  });
});

test("D-CF3-03 keeps the first of two inline commands that elide to one name", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-inline-clash-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const resolved = resolvedPlugin(
    directory,
    [],
    [
      { key: "lint", content: "First body", origin: "manifest" },
      { key: "acme-lint", content: "Second body", origin: "manifest" },
    ],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "inline", sourceName: "lint", generatedName: "acme:lint", content: "First body" },
    ],
    warnings: [
      'command map entry "acme-lint" elides to generated name "acme:lint", already produced by command source "lint"; skipping entry.',
    ],
  });
});

test("D-CF3-03 ignores the overrides of a command map directory source", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-map-dir-overrides-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandPath = path.join(directory, "more", "b.md");
  await mkdir(path.dirname(commandPath), { recursive: true });
  await writeFile(commandPath, "b\n");
  const resolved = resolvedPlugin(
    directory,
    [],
    [{ key: "tools", source: "more", origin: "manifest", description: "Tools.", model: "opus" }],
  );

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { kind: "file", sourceName: "b", generatedName: "acme:b", commandFile: commandPath },
    ],
    warnings: [],
  });
});
