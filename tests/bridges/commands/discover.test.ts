import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { createHash } from "node:crypto";
import { renameSync, symlinkSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";
import { CommandNameError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

function resolvedPlugin(
  pluginRoot: string,
  commands: readonly string[],
): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: commands.length === 0 ? [] : ["commands"],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: [],
      commands: [...commands],
      agents: [],
    },
    mcpServers: {},
    defaultEnabled: true,
  };
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
        sourceName: "acme-build/deploy",
        generatedName: "acme:build:deploy",
        commandFile: deployPath,
      },
      {
        sourceName: "acme-build/prod/rollout",
        generatedName: "acme:build:prod:rollout",
        commandFile: rolloutPath,
      },
      {
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
      { sourceName: "first", generatedName: "acme:first", commandFile: absolutePath },
      { sourceName: "second", generatedName: "acme:second", commandFile: relativePath },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
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
    discovered: [{ sourceName: "good", generatedName: "acme:good", commandFile: goodPath }],
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

test("reports one source file reached through overlapping command roots", async (t) => {
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
        sourceName: "build/web",
        generatedName: "acme:build:web",
        commandFile: commandPath,
      },
      { sourceName: "web", generatedName: "acme:web", commandFile: commandPath },
    ],
    warnings: [
      `command file "commands/build/web.md" is reached by more than one componentPaths.commands entry; installing it as both "acme:build:web" and "acme:web".`,
    ],
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
      discovered: [{ sourceName, generatedName, commandFile: commandPath }],
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
    discovered: [{ sourceName: "good", generatedName: "acme:good", commandFile: goodPath }],
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
    discovered: [{ sourceName: "readable", generatedName: "acme:readable", commandFile: goodPath }],
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
    discovered: [{ sourceName: "readable", generatedName: "acme:readable", commandFile: goodPath }],
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
      if (completedFilesystemRequests === 1) {
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

test("propagates a wrapped name error when its class identity is unavailable", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-name-identity-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const unsafeSourceName = "bad\u0001";
  await mkdir(commandsDirectory, { recursive: true });
  await writeFile(path.join(commandsDirectory, `${unsafeSourceName}.md`), "unsafe\n");
  const resolved = resolvedPlugin(directory, ["commands"]);
  const previousHasInstance = Object.getOwnPropertyDescriptor(CommandNameError, Symbol.hasInstance);
  t.after(() => {
    if (previousHasInstance === undefined) {
      Reflect.deleteProperty(CommandNameError, Symbol.hasInstance);
    } else {
      Object.defineProperty(CommandNameError, Symbol.hasInstance, previousHasInstance);
    }
  });
  Object.defineProperty(CommandNameError, Symbol.hasInstance, {
    configurable: true,
    value: () => false,
  });
  const expectedMessage = `invalid command source "${unsafeSourceName}" in "${commandsDirectory}"`;

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.constructor, CommandNameError);
      assert.ok(error.cause instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          sourceName: (error as CommandNameError).sourceName,
          commandsDir: (error as CommandNameError).commandsDir,
          cause: { name: error.cause.name, message: error.cause.message },
        },
        {
          name: "CommandNameError",
          message: expectedMessage,
          sourceName: unsafeSourceName,
          commandsDir: commandsDirectory,
          cause: {
            name: "Error",
            message: `command path segment in "${unsafeSourceName}" "${unsafeSourceName}" must not contain ASCII control characters.`,
          },
        },
      );
      return true;
    },
  );
});

test("propagates a filesystem error whose errno disappears between observations", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "command-discover-unstable-errno-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const commandsDirectory = path.join(directory, "commands");
  const nestedDirectory = path.join(commandsDirectory, "nested");
  await mkdir(nestedDirectory, { recursive: true });
  const filesystemPromises = createRequire(import.meta.url)(
    "node:fs/promises",
  ) as typeof import("node:fs/promises");
  const originalReaddir = filesystemPromises.readdir;
  const commandEntries = await originalReaddir(commandsDirectory, {
    withFileTypes: true,
    encoding: "utf8",
  });
  const filesystemError = new Error("unstable command-directory errno");
  let codeReads = 0;
  Object.defineProperty(filesystemError, "code", {
    configurable: true,
    enumerable: true,
    get: () => {
      codeReads += 1;
      return codeReads === 1 ? "EACCES" : undefined;
    },
  });
  const readdir = t.mock.method(
    filesystemPromises,
    "readdir",
    async (directoryPath: Parameters<typeof originalReaddir>[0]) => {
      if (directoryPath === commandsDirectory) {
        return commandEntries;
      }

      throw filesystemError;
    },
  );
  t.after(() => {
    readdir.mock.restore();
    syncBuiltinESMExports();
  });
  syncBuiltinESMExports();
  const resolved = resolvedPlugin(directory, ["commands"]);

  // act & assert
  await assert.rejects(
    () => discoverPluginCommands({ pluginName: "acme", resolved }),
    (error: unknown) => {
      assert.strictEqual(error, filesystemError);
      assert.strictEqual(codeReads, 2);
      return true;
    },
  );
});
