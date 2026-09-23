import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { registerClaudePluginCommand } from "../../extensions/pi-claude-marketplace/edge/register.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeCtx, makeMockPi } from "../e2e/_helpers.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

function pluginRecord(provenance: "explicit" | "dependency", skill: string) {
  return {
    version: "1.0.0",
    resolvedSource: "/unused",
    compatibility: { installable: true as const, notes: [], supported: [], unsupported: [] },
    resources: { skills: [skill], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    provenance,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function seedScope(scope: Scope, cwd: string): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(locations.extensionRoot, "sources", "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "app", version: "1.0.0", source: "./plugins/app" },
        { name: "orphan", version: "1.0.0", source: "./plugins/orphan" },
      ],
    }),
  );
  for (const name of ["app", "orphan"]) {
    const pluginManifest = path.join(
      marketplaceRoot,
      "plugins",
      name,
      ".claude-plugin",
      "plugin.json",
    );
    await mkdir(path.dirname(pluginManifest), { recursive: true });
    await writeFile(pluginManifest, JSON.stringify({ name, version: "1.0.0" }));
    const skillDir = path.join(locations.skillsTargetDir, `${name}-skill`);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}-skill\n---\nbody\n`);
  }

  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          app: pluginRecord("explicit", "app-skill"),
          orphan: pluginRecord("dependency", "orphan-skill"),
        },
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

function registeredCommand(cwd: string) {
  const mock = makeMockPi([]);
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  const git = createGitOpsFake({ boundary: "memory" });
  registerClaudePluginCommand(
    mock.pi,
    {
      completionCache,
      gitOps: git.gitOps,
      beginPluginUpdateRun: () => () =>
        Promise.resolve({
          partition: "unchanged",
          name: "unused",
          fromVersion: "1.0.0",
          toVersion: "1.0.0",
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
        }),
    },
    hooksRouting,
    createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  );
  const command = mock.commands.get("claude:plugin");
  assert.ok(command);
  const { ctx, notifications } = makeCtx(cwd);
  return { command, ctx, notifications, gitCalls: git.state.calls };
}

test("prune removes an orphan dependency through the registered command", async () => {
  await withHermeticEnvironment("standalone-prune-", async ({ cwd }) => {
    await seedScope("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);
    const locations = locationsFor("user", cwd);

    await command.handler("prune", ctx);

    const state = await loadState(locations.extensionRoot);
    assert.deepStrictEqual(Object.keys(state.marketplaces.mp?.plugins ?? {}), ["app"]);
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "app-skill", "SKILL.md"), "utf8"),
      "---\nname: app-skill\n---\nbody\n",
    );
    await assert.rejects(
      readFile(path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md")),
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});
