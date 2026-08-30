import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";

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
