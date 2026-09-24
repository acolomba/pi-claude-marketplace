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
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("prune --dry-run previews the orphan without writing current state", async () => {
  await withHermeticEnvironment("standalone-prune-preview-", async ({ cwd }) => {
    await seedScope("user", cwd);
    const locations = locationsFor("user", cwd);
    const statePath = path.join(locations.extensionRoot, "state.json");
    const bytesBefore = await readFile(statePath);
    const mtimeBefore = (await stat(statePath, { bigint: true })).mtimeNs;
    const treeBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune --dry-run", ctx);

    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
    ]);
    assert.deepStrictEqual(await readFile(statePath), bytesBefore);
    assert.equal((await stat(statePath, { bigint: true })).mtimeNs, mtimeBefore);
    assert.deepStrictEqual(await scopeTree("user", cwd), treeBefore);
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("preview and actual prune select the same dependent-first fixpoint", async () => {
  await withHermeticEnvironment("standalone-prune-parity-", async ({ cwd }) => {
    const seeded = await seedScope("user", cwd);
    const locations = locationsFor("user", cwd);
    const marketplace = seeded.marketplaces.mp;
    assert.ok(marketplace);
    const orphanManifest = path.join(
      marketplace.marketplaceRoot,
      "plugins",
      "orphan",
      ".claude-plugin",
      "plugin.json",
    );
    const leafManifest = path.join(
      marketplace.marketplaceRoot,
      "plugins",
      "leaf",
      ".claude-plugin",
      "plugin.json",
    );
    await writeFile(orphanManifest, JSON.stringify({ name: "orphan", dependencies: ["leaf"] }));
    await mkdir(path.dirname(leafManifest), { recursive: true });
    await writeFile(leafManifest, JSON.stringify({ name: "leaf", version: "1.0.0" }));
    await writeFile(
      marketplace.manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: ["app", "orphan", "leaf"].map((name) => ({
          name,
          version: "1.0.0",
          source: `./plugins/${name}`,
        })),
      }),
    );
    const leafSkill = path.join(locations.skillsTargetDir, "leaf-skill", "SKILL.md");
    await mkdir(path.dirname(leafSkill), { recursive: true });
    await writeFile(leafSkill, "---\nname: leaf-skill\n---\nbody\n");
    await saveState(locations.extensionRoot, {
      ...seeded,
      marketplaces: {
        mp: {
          ...marketplace,
          plugins: { ...marketplace.plugins, leaf: pluginRecord("dependency", "leaf-skill") },
        },
      },
    });
    const before = await scopeTree("user", cwd);
    const { command, ctx, notifications } = registeredCommand(cwd);

    await command.handler("prune --dry-run", ctx);
    assert.deepStrictEqual(await scopeTree("user", cwd), before);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}\n\n● mp [user]\n  ○ leaf (will uninstall) {dependency pruned}",
      },
    ]);

    await command.handler("prune", ctx);
    assert.deepStrictEqual(notifications[1], {
      message:
        "● mp [user]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n● mp [user]\n  ○ leaf v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
    });
  });
});

test("repeated legacy previews normalize in memory without writing the scope", async () => {
  await withHermeticEnvironment("standalone-prune-legacy-preview-", async ({ cwd }) => {
    const seeded = await seedScope("user", cwd);
    const marketplace = seeded.marketplaces.mp;
    assert.ok(marketplace);
    const locations = locationsFor("user", cwd);
    const legacy = {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: "./mp",
          addedFromCwd: cwd,
          plugins: marketplace.plugins,
        },
      },
    };
    await writeFile(locations.stateJsonPath, JSON.stringify(legacy));
    await writeFile(locations.configJsonPath, '{"plugins":{}}');
    const stateBefore = await readFile(locations.stateJsonPath);
    const stateMtimeBefore = (await stat(locations.stateJsonPath, { bigint: true })).mtimeNs;
    const configMtimeBefore = (await stat(locations.configJsonPath, { bigint: true })).mtimeNs;
    const orphanSkill = path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md");
    const skillMtimeBefore = (await stat(orphanSkill, { bigint: true })).mtimeNs;
    const treeBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune --dry-run", ctx);
    await command.handler("prune --dry-run", ctx);

    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
    ]);
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    assert.equal((await stat(locations.stateJsonPath, { bigint: true })).mtimeNs, stateMtimeBefore);
    assert.equal(
      (await stat(locations.configJsonPath, { bigint: true })).mtimeNs,
      configMtimeBefore,
    );
    assert.equal((await stat(orphanSkill, { bigint: true })).mtimeNs, skillMtimeBefore);
    assert.deepStrictEqual(await scopeTree("user", cwd), treeBefore);
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("preview of a missing project state leaves both scope trees unchanged", async () => {
  await withHermeticEnvironment("standalone-prune-missing-preview-", async ({ cwd }) => {
    await seedScope("user", cwd);
    const project = locationsFor("project", cwd);
    await mkdir(project.scopeRoot, { recursive: true });
    const projectBefore = await scopeTree("project", cwd);
    const userBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune --scope project --dry-run", ctx);

    assert.deepStrictEqual(await scopeTree("project", cwd), projectBefore);
    assert.deepStrictEqual(await scopeTree("user", cwd), userBefore);
    for (const missing of [
      project.extensionRoot,
      project.stateJsonPath,
      project.configJsonPath,
      project.stateLockFile,
    ]) {
      await assert.rejects(stat(missing), { code: "ENOENT" });
    }

    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("project prune removes only the project orphan", async () => {
  await withHermeticEnvironment("standalone-prune-project-", async ({ cwd }) => {
    await seedScope("user", cwd);
    const projectSeed = await seedScope("project", cwd);
    const userBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);
    const project = locationsFor("project", cwd);

    await command.handler("prune --scope project", ctx);

    assert.deepStrictEqual(await loadState(project.extensionRoot), {
      ...projectSeed,
      marketplaces: {
        mp: {
          ...projectSeed.marketplaces.mp,
          plugins: { app: pluginRecord("explicit", "app-skill") },
        },
      },
    });
    assert.deepStrictEqual(await scopeTree("user", cwd), userBefore);
    assert.equal(
      await readFile(path.join(project.skillsTargetDir, "app-skill", "SKILL.md"), "utf8"),
      "---\nname: app-skill\n---\nbody\n",
    );
    await assert.rejects(readFile(path.join(project.skillsTargetDir, "orphan-skill", "SKILL.md")));
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("an unreadable declarer refuses prune without changing either scope", async () => {
  await withHermeticEnvironment("standalone-prune-unreadable-", async ({ cwd }) => {
    await seedScope("user", cwd);
    await seedScope("project", cwd);
    const user = locationsFor("user", cwd);
    await writeFile(
      path.join(
        user.extensionRoot,
        "sources",
        "mp",
        "plugins",
        "app",
        ".claude-plugin",
        "plugin.json",
      ),
      "{",
    );
    const userBefore = await scopeTree("user", cwd);
    const projectBefore = await scopeTree("project", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune", ctx);

    assert.deepStrictEqual(await scopeTree("user", cwd), userBefore);
    assert.deepStrictEqual(await scopeTree("project", cwd), projectBefore);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [user]\n  ⊘ app (failed) {unreadable}\n    cause: cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});
