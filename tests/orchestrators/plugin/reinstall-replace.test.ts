import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  REAL_REINSTALL_TRANSACTION,
  finalizeReinstalledPlugin,
  replaceReinstalledPlugin,
  rollbackReinstalledPlugin,
  runPostSuccessMaintenance,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type {
  ReinstallReplaceOperations,
  ReplaceReinstalledPluginInput,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

test("exports the atomic reinstall replacement owner", () => {
  // act & assert
  assert.strictEqual(REAL_REINSTALL_TRANSACTION.replaceReinstalledPlugin, replaceReinstalledPlugin);
});

test("runs committed reinstall maintenance with the exact removal contract", async () => {
  // arrange
  const locations = locationsFor("project", "/workspace");
  const calls: unknown[] = [];
  const completionCache = {
    dropMarketplaceCache: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve();
    },
  } as unknown as CompletionCache;

  // act
  const warnings = await runPostSuccessMaintenance(
    {
      scope: "project",
      marketplace: "market",
      plugin: "plugin",
      removeDataDir: (dataDir, options) => {
        calls.push([dataDir, options]);
        return Promise.resolve();
      },
    },
    locations,
    completionCache,
  );

  // assert
  assert.deepStrictEqual(calls, [
    [await locations.pluginCacheFile("market"), "project", "market"],
    [await locations.pluginDataDir("market", "plugin"), { recursive: true, force: true }],
  ]);
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(Object.isFrozen(warnings), true);
});

test("reports both non-fatal committed maintenance failures", async () => {
  // arrange
  const locations = locationsFor("user", "/workspace");
  const completionCache = {
    dropMarketplaceCache: () => Promise.reject(new Error("cache denied")),
  } as unknown as CompletionCache;
  const dataDir = await locations.pluginDataDir("market", "plugin");

  // act
  const warnings = await runPostSuccessMaintenance(
    {
      scope: "user",
      marketplace: "market",
      plugin: "plugin",
      removeDataDir: () => Promise.reject(new Error("data denied")),
    },
    locations,
    completionCache,
  );

  // assert
  assert.deepStrictEqual(warnings, [
    'Plugin "plugin" reinstalled; completion cache refresh deferred: cache denied',
    `Plugin "plugin" reinstalled; data cleanup deferred at ${dataDir}: data denied`,
  ]);
});

test("uses the real recursive data removal when no seam is supplied", async () => {
  // arrange
  const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-replace-maintenance-"));
  const locations = locationsFor("project", cwd);
  const dataDir = await locations.pluginDataDir("market", "plugin");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "state.json"), "temporary");
  const completionCache = {
    dropMarketplaceCache: () => Promise.resolve(),
  } as unknown as CompletionCache;

  try {
    // act
    const warnings = await runPostSuccessMaintenance(
      { scope: "project", marketplace: "market", plugin: "plugin" },
      locations,
      completionCache,
    );

    // assert
    assert.deepStrictEqual(warnings, []);
    await assert.rejects(mkdir(path.join(dataDir, "child")), { code: "ENOENT" });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function replacementInput(pluginRoot = "/plugin"): ReplaceReinstalledPluginInput {
  return {
    locations: {} as ScopedLocations,
    cwd: "/workspace",
    marketplace: "market",
    plugin: "plugin",
    installable: {
      state: "installable",
      installable: true,
      name: "plugin",
      pluginRoot,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    },
    pluginDataDir: "/data",
    oldRecord: {
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    } as unknown as ReplaceReinstalledPluginInput["oldRecord"],
    agentsDirs: [],
  };
}

function fakeOperations(
  calls: string[],
  overrides: Partial<ReinstallReplaceOperations> = {},
): ReinstallReplaceOperations {
  const prepared = (kind: string) => ({
    result: {
      recorded: [{ generatedName: `${kind}-name` }],
      degraded: [],
      warnings: [`${kind} warning`],
    },
  });
  const operation =
    (name: string, result: unknown = {}) =>
    () => {
      calls.push(name);
      return Promise.resolve(result);
    };

  return {
    prepareStageSkills: operation("prepare skills", prepared("skills")),
    prepareStageCommands: operation("prepare commands", prepared("commands")),
    prepareStagePluginAgents: operation("prepare agents", prepared("agents")),
    prepareStageMcpServers: operation("prepare mcp", prepared("mcp")),
    replacePreparedSkills: operation("replace skills"),
    replacePreparedCommands: operation("replace commands"),
    replacePreparedAgents: operation("replace agents"),
    replacePreparedMcp: operation("replace mcp"),
    removeHookConfig: operation("remove hooks"),
    writeHookConfig: operation("write hooks"),
    abortPreparedMcp: () => calls.push("abort mcp"),
    abortPreparedAgents: operation("abort agents", "agents staging"),
    abortPreparedCommands: operation("abort commands", undefined),
    abortPreparedSkills: operation("abort skills", "skills staging"),
    rollbackSkillsReplacement: operation("rollback skills", ["skills backup"]),
    rollbackCommandsReplacement: operation("rollback commands", ["commands backup"]),
    rollbackAgentsReplacement: operation("rollback agents", ["agents backup"]),
    rollbackMcpReplacement: operation("rollback mcp", ["mcp backup"]),
    finalizeSkillsReplacement: operation("finalize skills", ["skills finalize"]),
    finalizeCommandsReplacement: operation("finalize commands", ["commands finalize"]),
    finalizeAgentsReplacement: operation("finalize agents", ["agents finalize"]),
    finalizeMcpReplacement: operation("finalize mcp", ["mcp finalize"]),
    ...overrides,
  } as unknown as ReinstallReplaceOperations;
}

test("replaces, rolls back, and finalizes every bridge in atomic order", async () => {
  // arrange
  const calls: string[] = [];
  const operations = fakeOperations(calls);

  // act
  const replacement = await replaceReinstalledPlugin(replacementInput(), operations);
  const rollbackLeaks = await rollbackReinstalledPlugin(replacement);
  const finalizeLeaks = await finalizeReinstalledPlugin(replacement);

  // assert
  assert.deepStrictEqual(calls, [
    "prepare skills",
    "prepare commands",
    "prepare agents",
    "prepare mcp",
    "replace skills",
    "replace commands",
    "replace agents",
    "remove hooks",
    "replace mcp",
    "rollback mcp",
    "rollback agents",
    "rollback commands",
    "rollback skills",
    "finalize skills",
    "finalize commands",
    "finalize agents",
    "finalize mcp",
  ]);
  assert.deepStrictEqual(replacement.discoveryWarnings, ["skills warning", "commands warning"]);
  assert.deepStrictEqual(replacement.bridgeWarnings, ["agents warning", "mcp warning"]);
  assert.deepStrictEqual(rollbackLeaks, [
    "mcp: mcp backup",
    "agents: agents backup",
    "commands: commands backup",
    "skills: skills backup",
  ]);
  assert.deepStrictEqual(finalizeLeaks, [
    "skills: skills finalize",
    "commands: commands finalize",
    "agents: agents finalize",
    "mcp: mcp finalize",
  ]);
});

test("aborts prepared bridges and reports leaks when replacement fails", async () => {
  // arrange
  const calls: string[] = [];
  const operations = fakeOperations(calls, {
    replacePreparedSkills: () => Promise.reject(new Error("replace denied")),
  });

  // act & assert
  await assert.rejects(
    replaceReinstalledPlugin(replacementInput(), operations),
    (error: Error) =>
      error instanceof Error &&
      error.message === "replace denied" &&
      error.name === "ManualRecoveryError",
  );
  assert.deepStrictEqual(calls.slice(-4), [
    "abort mcp",
    "abort agents",
    "abort commands",
    "abort skills",
  ]);
});

test("aborts partial preparation in reverse order", async () => {
  // arrange
  const calls: string[] = [];
  const operations = fakeOperations(calls, {
    prepareStageMcpServers: () => Promise.reject(new Error("mcp prepare denied")),
  });

  // act & assert
  await assert.rejects(
    replaceReinstalledPlugin(replacementInput(), operations),
    /mcp prepare denied/u,
  );
  assert.deepStrictEqual(calls.slice(-3), ["abort agents", "abort commands", "abort skills"]);
});

test("writes parsed hooks between agents and MCP replacement", async () => {
  // arrange
  const calls: string[] = [];
  const operations = fakeOperations(calls);
  const root = await mkdtemp(path.join(tmpdir(), "reinstall-replace-hooks-"));
  await mkdir(path.join(root, "hooks"), { recursive: true });
  await writeFile(
    path.join(root, "hooks", "hooks.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "echo ready" }] }],
      },
    }),
  );
  const input = replacementInput(root);
  const installable = { ...input.installable, hooksConfigPath: "hooks/hooks.json" };

  try {
    // act
    const replacement = await replaceReinstalledPlugin({ ...input, installable }, operations);

    // assert
    assert.deepStrictEqual(replacement.hookEntries, [{ event: "SessionStart" }]);
    assert.ok(calls.includes("write hooks"));
    assert.ok(calls.indexOf("write hooks") < calls.indexOf("replace mcp"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects malformed hooks and compensates completed replacements", async () => {
  // arrange
  const calls: string[] = [];
  const operations = fakeOperations(calls);
  const root = await mkdtemp(path.join(tmpdir(), "reinstall-replace-bad-hooks-"));
  await mkdir(path.join(root, "hooks"), { recursive: true });
  await writeFile(path.join(root, "hooks", "hooks.json"), JSON.stringify({ hooks: 42 }));
  const input = replacementInput(root);
  const installable = { ...input.installable, hooksConfigPath: "hooks/hooks.json" };

  try {
    // act & assert
    await assert.rejects(
      replaceReinstalledPlugin({ ...input, installable }, operations),
      /hooks\.json re-parse failed/u,
    );
    assert.deepStrictEqual(calls.slice(-7), [
      "rollback agents",
      "rollback commands",
      "rollback skills",
      "abort mcp",
      "abort agents",
      "abort commands",
      "abort skills",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normalizes a real bridge preparation failure", async () => {
  // arrange
  const input = replacementInput();

  // act & assert
  await assert.rejects(
    replaceReinstalledPlugin(input, REAL_REINSTALL_TRANSACTION.replaceOperations),
  );
});
