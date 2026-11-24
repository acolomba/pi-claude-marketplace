// test/integration/standalone-prune.test.ts
//
// Two cases of `/claude:plugin prune` through the registered command, kept
// for the calls that must not happen (ITSCOPE-01). `registeredCommand` makes
// the reconcile apply and the missing-dependency install throw, and a git
// double records every git operation it serves except `listRemotes`, so the
// actual prune and the `--dry-run` preview each prove that prune runs neither
// seam and makes none of those git calls. The preview case also pins the
// mtimes of the state and config files, which the cucumber whole-scope step
// does not compare. Everything a user can see of prune is in
// `features/plugin/prune.feature`, `features/plugin/state-lock.feature`, and
// `features/plugin/usage-errors.feature`.

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { noStatusReaders } from "../platform/mcp-status-seed.ts";
import { makeCtx, makeMockPi } from "../platform/mock-pi.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

function pluginRecord(provenance: "explicit" | "dependency", skill: string) {
  return {
    version: "1.0.0",
    resolvedSource: "/unused",
    compatibility: { installable: true as const, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: [skill],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
      workflows: [],
    },
    enabled: true,
    provenance,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function seedScope(scope: Scope, cwd: string): Promise<ExtensionState> {
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
  return state;
}

async function scopeTree(
  scope: Scope,
  cwd: string,
): Promise<readonly (readonly [string, string | null])[]> {
  const root = locationsFor(scope, cwd).scopeRoot;
  const names = (await readdir(root, { recursive: true })).sort();
  return Promise.all(
    names.map(async (name) => {
      const absolute = path.join(root, name);
      const bytes = (await stat(absolute)).isDirectory()
        ? null
        : (await readFile(absolute)).toString("base64");
      return [name, bytes] as const;
    }),
  );
}

function registeredCommand(cwd: string) {
  const piHost = makeMockPi([]);
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  const git = createGitOpsFake({ boundary: "memory" });
  registerClaudePluginCommand(
    piHost.pi,
    {
      completionCache,
      mcpStatus: noStatusReaders(),
      gitOps: git.gitOps,
      beginPluginUpdateRun: () => () =>
        Promise.resolve({
          declaresWorkflows: false,
          partition: "unchanged",
          name: "unused",
          fromVersion: "1.0.0",
          toVersion: "1.0.0",
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
        }),
      applyReconcile: (): Promise<void> => {
        throw new Error("standalone prune must not run a reconcile apply");
      },
      installMissingDependencies: (): Promise<never> => {
        throw new Error("standalone prune must not run the missing-dependency step");
      },
    },
    hooksRouting,
    createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  );
  const command = piHost.commands.get("claude:plugin");
  assert.ok(command);
  const { ctx, notifications } = makeCtx(cwd);
  return { command, ctx, notifications, gitCalls: git.state.calls };
}

test("prune removes an orphan dependency through the registered command", async () => {
  await withHermeticEnvironment("standalone-prune-", async ({ cwd }) => {
    const seeded = await seedScope("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);
    const locations = locationsFor("user", cwd);

    await command.handler("prune", ctx);

    const state = await loadState(locations.extensionRoot);
    assert.deepStrictEqual(state, {
      ...seeded,
      marketplaces: {
        mp: { ...seeded.marketplaces.mp, plugins: { app: pluginRecord("explicit", "app-skill") } },
      },
    });
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
    assert.deepStrictEqual(gitCalls, {
      checkout: [],
      clone: [],
      currentBranch: [],
      fetch: [],
      forceUpdateRef: [],
      resolveRef: [],
      resolveRemoteRef: [],
    });
  });
});

test("prune --dry-run previews the orphan without writing current state", async () => {
  await withHermeticEnvironment("standalone-prune-preview-", async ({ cwd }) => {
    await seedScope("user", cwd);
    const locations = locationsFor("user", cwd);
    const statePath = path.join(locations.extensionRoot, "state.json");
    await writeFile(locations.baseConfigJsonPath, '{"plugins":{}}');
    const bytesBefore = await readFile(statePath);
    const mtimeBefore = (await stat(statePath, { bigint: true })).mtimeNs;
    const configBefore = await readFile(locations.baseConfigJsonPath);
    const configMtimeBefore = (await stat(locations.baseConfigJsonPath, { bigint: true })).mtimeNs;
    const treeBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune --dry-run", ctx);
    await command.handler("prune --dry-run", ctx);

    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ orphan v1.0.0 (will uninstall) {dependency pruned}" },
      { message: "● mp [user]\n  ○ orphan v1.0.0 (will uninstall) {dependency pruned}" },
    ]);
    assert.deepStrictEqual(await readFile(statePath), bytesBefore);
    assert.equal((await stat(statePath, { bigint: true })).mtimeNs, mtimeBefore);
    assert.deepStrictEqual(await readFile(locations.baseConfigJsonPath), configBefore);
    assert.equal(
      (await stat(locations.baseConfigJsonPath, { bigint: true })).mtimeNs,
      configMtimeBefore,
    );
    assert.deepStrictEqual(await scopeTree("user", cwd), treeBefore);
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(gitCalls, {
      checkout: [],
      clone: [],
      currentBranch: [],
      fetch: [],
      forceUpdateRef: [],
      resolveRef: [],
      resolveRemoteRef: [],
    });
  });
});
