import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

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

interface GraphPlugin {
  readonly provenance: "explicit" | "dependency";
  readonly dependencies?: readonly string[];
  readonly enabled?: boolean;
  readonly skill?: string;
}

async function seedGraphScope(
  scope: Scope,
  cwd: string,
  graph: Readonly<Record<string, Readonly<Record<string, GraphPlugin>>>>,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const marketplaces: ExtensionState["marketplaces"] = {};
  for (const [marketplaceName, plugins] of Object.entries(graph)) {
    const marketplaceRoot = path.join(locations.extensionRoot, "sources", marketplaceName);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    const entries: object[] = [];
    const records: ExtensionState["marketplaces"][string]["plugins"] = {};
    for (const [pluginName, plugin] of Object.entries(plugins)) {
      const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
      const pluginManifest = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      await mkdir(path.dirname(pluginManifest), { recursive: true });
      await writeFile(
        pluginManifest,
        JSON.stringify({ name: pluginName, dependencies: plugin.dependencies ?? [] }),
      );
      entries.push({ name: pluginName, version: "1.0.0", source: `./plugins/${pluginName}` });
      const skill = plugin.skill ?? `${marketplaceName}-${pluginName}-skill`;
      if (plugin.skill === undefined) {
        const skillFile = path.join(locations.skillsTargetDir, skill, "SKILL.md");
        await mkdir(path.dirname(skillFile), { recursive: true });
        await writeFile(skillFile, `---\nname: ${skill}\n---\nbody\n`);
      }

      records[pluginName] = {
        ...pluginRecord(plugin.provenance, skill),
        resolvedSource: pluginRoot,
        enabled: plugin.enabled ?? true,
      };
    }

    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({ name: marketplaceName, plugins: entries }));
    marketplaces[marketplaceName] = {
      name: marketplaceName,
      scope,
      source: pathSource(`./${marketplaceName}`),
      addedFromCwd: cwd,
      manifestPath,
      marketplaceRoot,
      plugins: records,
    };
  }

  await saveState(locations.extensionRoot, { schemaVersion: 3, marketplaces });
}

function installedKeys(state: ExtensionState): readonly string[] {
  return Object.values(state.marketplaces)
    .flatMap((marketplace) =>
      Object.keys(marketplace.plugins).map((plugin) => `${plugin}@${marketplace.name}`),
    )
    .sort((left, right) => left.localeCompare(right));
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
          declaresWorkflows: false,
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

for (const args of ["prune --dry-run", "prune"] as const) {
  test(`${args} reports malformed state without exposing its path`, async () => {
    await withHermeticEnvironment("standalone-prune-malformed-state-", async ({ cwd }) => {
      // arrange
      await seedScope("user", cwd);
      const locations = locationsFor("user", cwd);
      await writeFile(locations.stateJsonPath, "{");
      const stateBefore = await readFile(locations.stateJsonPath);
      const { command, ctx, notifications } = registeredCommand(cwd);

      // act
      await command.handler(args, ctx);

      // assert
      assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● (prune) [user]\n  ⊘ (prune) (failed) {unreadable}\n" +
            "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2) -> Expected property name or '}' in JSON at position 1 (line 1 column 2)",
          severity: "error",
        },
      ]);
    });
  });
}

test("prune reports a held state lock and leaves the scope intact", async () => {
  await withHermeticEnvironment("standalone-prune-held-lock-", async ({ cwd }) => {
    // arrange
    await seedScope("user", cwd);
    const locations = locationsFor("user", cwd);
    const stateBefore = await readFile(locations.stateJsonPath);
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
    });
    const { command, ctx, notifications } = registeredCommand(cwd);

    try {
      // act
      await command.handler("prune", ctx);

      // assert
      assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● (prune) [user]\n  ⊘ (prune) (failed) {lock held}\n" +
            "    cause: Another pi-claude-marketplace operation is in progress for user scope (.state-lock). Retry after it completes. -> Lock file is already being held",
          severity: "error",
        },
      ]);
    } finally {
      await release();
    }
  });
});

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
    await writeFile(locations.configJsonPath, '{"plugins":{}}');
    const bytesBefore = await readFile(statePath);
    const mtimeBefore = (await stat(statePath, { bigint: true })).mtimeNs;
    const configBefore = await readFile(locations.configJsonPath);
    const configMtimeBefore = (await stat(locations.configJsonPath, { bigint: true })).mtimeNs;
    const treeBefore = await scopeTree("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    await command.handler("prune --dry-run", ctx);
    await command.handler("prune --dry-run", ctx);

    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
    ]);
    assert.deepStrictEqual(await readFile(statePath), bytesBefore);
    assert.equal((await stat(statePath, { bigint: true })).mtimeNs, mtimeBefore);
    assert.deepStrictEqual(await readFile(locations.configJsonPath), configBefore);
    assert.equal(
      (await stat(locations.configJsonPath, { bigint: true })).mtimeNs,
      configMtimeBefore,
    );
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

test("preview and actual preserve alternating marketplaces and held neighbors", async () => {
  await withHermeticEnvironment("standalone-prune-graph-", async ({ cwd }) => {
    // arrange
    await seedGraphScope("project", cwd, {
      alpha: {
        a: { provenance: "dependency", dependencies: ["b@beta"] },
        c: { provenance: "dependency" },
        disabled: { provenance: "explicit", enabled: false, dependencies: ["paused"] },
        paused: { provenance: "dependency" },
      },
      beta: {
        z: { provenance: "dependency", dependencies: ["c@alpha"] },
        b: { provenance: "dependency", dependencies: ["c@alpha"] },
        keeper: { provenance: "explicit", dependencies: ["held"] },
        held: { provenance: "dependency" },
      },
    });
    const locations = locationsFor("project", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    // act
    await command.handler("prune --dry-run --scope project", ctx);
    await command.handler("prune --scope project", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● alpha [project]\n  ○ a (will uninstall) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ z (will uninstall) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ b (will uninstall) {dependency pruned}\n\n" +
          "● alpha [project]\n  ○ c (will uninstall) {dependency pruned}",
      },
      {
        message:
          "● alpha [project]\n  ○ a v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ z v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ b v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● alpha [project]\n  ○ c v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), [
      "disabled@alpha",
      "held@beta",
      "keeper@beta",
      "paused@alpha",
    ]);
    for (const [name, present] of [
      ["alpha-a-skill", false],
      ["alpha-c-skill", false],
      ["alpha-disabled-skill", true],
      ["alpha-paused-skill", true],
      ["beta-z-skill", false],
      ["beta-b-skill", false],
      ["beta-keeper-skill", true],
      ["beta-held-skill", true],
    ] as const) {
      const skillFile = path.join(locations.skillsTargetDir, name, "SKILL.md");
      if (present) {
        assert.equal(await readFile(skillFile, "utf8"), `---\nname: ${name}\n---\nbody\n`);
      } else {
        await assert.rejects(stat(skillFile), { code: "ENOENT" });
      }
    }

    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("actual prune reselects after a stale preview changes on disk", async () => {
  await withHermeticEnvironment("standalone-prune-stale-", async ({ cwd }) => {
    // arrange
    await seedGraphScope("user", cwd, {
      mp: { old: { provenance: "dependency" }, keeper: { provenance: "explicit" } },
    });
    const locations = locationsFor("user", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    // act
    await command.handler("prune --dry-run", ctx);
    await seedGraphScope("user", cwd, {
      mp: {
        old: { provenance: "explicit" },
        fresh: { provenance: "dependency" },
        keeper: { provenance: "explicit" },
      },
    });
    await command.handler("prune", ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ old (will uninstall) {dependency pruned}" },
      {
        message:
          "● mp [user]\n  ○ fresh v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), [
      "keeper@mp",
      "old@mp",
    ]);
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "mp-old-skill", "SKILL.md"), "utf8"),
      "---\nname: mp-old-skill\n---\nbody\n",
    );
    await assert.rejects(stat(path.join(locations.skillsTargetDir, "mp-fresh-skill")), {
      code: "ENOENT",
    });
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

test("failed actual member holds its dependency until a later retry", async () => {
  await withHermeticEnvironment("standalone-prune-failed-member-", async ({ cwd }) => {
    // arrange
    await seedGraphScope("project", cwd, {
      alpha: {
        a: { provenance: "dependency", dependencies: ["b@beta"], skill: "../invalid" },
        free: { provenance: "dependency" },
      },
      beta: { b: { provenance: "dependency" } },
    });
    const locations = locationsFor("project", cwd);
    const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

    // act
    await command.handler("prune --scope project --dry-run", ctx);
    await command.handler("prune --scope project", ctx);

    // assert
    assert.deepStrictEqual(notifications[0], {
      message:
        "● alpha [project]\n  ○ a (will uninstall) {dependency pruned}\n\n" +
        "● alpha [project]\n  ○ free (will uninstall) {dependency pruned}\n\n" +
        "● beta [project]\n  ○ b (will uninstall) {dependency pruned}",
    });
    assert.deepStrictEqual(notifications[1], {
      message:
        "A plugin operation needs attention.\n\n" +
        "● alpha [project]\n" +
        "  ⊘ a v1.0.0 (failed) {unreadable}\n" +
        '    cause: skill name to unstage "../invalid" must not contain path separators.\n\n' +
        "● alpha [project]\n" +
        "  ○ free v1.0.0 (uninstalled) {dependency pruned}\n\n" +
        "/reload to pick up changes",
      severity: "warning",
    });
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), [
      "a@alpha",
      "b@beta",
    ]);
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "beta-b-skill", "SKILL.md"), "utf8"),
      "---\nname: beta-b-skill\n---\nbody\n",
    );
    await assert.rejects(stat(path.join(locations.skillsTargetDir, "alpha-free-skill")), {
      code: "ENOENT",
    });
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);

    const state = await loadState(locations.extensionRoot);
    const alpha = state.marketplaces.alpha;
    const a = alpha?.plugins.a;
    assert.ok(alpha);
    assert.ok(a);
    await saveState(locations.extensionRoot, {
      ...state,
      marketplaces: {
        ...state.marketplaces,
        alpha: {
          ...alpha,
          plugins: {
            ...alpha.plugins,
            a: {
              ...a,
              resources: { ...a.resources, skills: [] },
            },
          },
        },
      },
    });

    await command.handler("prune --scope project", ctx);

    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    assert.deepStrictEqual(notifications[2], {
      message:
        "● alpha [project]\n  ○ a v1.0.0 (uninstalled) {dependency pruned}\n\n" +
        "● beta [project]\n  ○ b v1.0.0 (uninstalled) {dependency pruned}\n\n" +
        "/reload to pick up changes",
    });
    await assert.rejects(stat(path.join(locations.skillsTargetDir, "beta-b-skill")), {
      code: "ENOENT",
    });
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
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

    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
    ]);
    assert.deepStrictEqual(gitCalls.clone, []);
    assert.deepStrictEqual(gitCalls.fetch, []);
  });
});

for (const { scope, args } of [
  { scope: "user", args: "prune" },
  { scope: "user", args: "prune --scope user" },
  { scope: "project", args: "prune --scope project" },
  { scope: "user", args: "prune --dry-run" },
  { scope: "user", args: "prune --scope user --dry-run" },
  { scope: "project", args: "prune --dry-run --scope project" },
  { scope: "project", args: "prune --scope project --dry-run" },
] as const) {
  test(`${args} reports an empty ${scope} scope without changing the scope`, async () => {
    await withHermeticEnvironment("standalone-prune-empty-", async ({ cwd }) => {
      // arrange
      const seeded = await seedScope(scope, cwd);
      const locations = locationsFor(scope, cwd);
      const marketplace = seeded.marketplaces.mp;
      assert.ok(marketplace);
      await saveState(locations.extensionRoot, {
        ...seeded,
        marketplaces: {
          mp: {
            ...marketplace,
            plugins: {
              app: pluginRecord("explicit", "app-skill"),
              orphan: pluginRecord("explicit", "orphan-skill"),
            },
          },
        },
      });
      await writeFile(locations.configJsonPath, '{"plugins":{}}');
      const stateBefore = await readFile(locations.stateJsonPath);
      const stateMtimeBefore = (await stat(locations.stateJsonPath, { bigint: true })).mtimeNs;
      const configBefore = await readFile(locations.configJsonPath);
      const configMtimeBefore = (await stat(locations.configJsonPath, { bigint: true })).mtimeNs;
      const treeBefore = await scopeTree(scope, cwd);
      const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

      // act
      await command.handler(args, ctx);

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `Nothing to prune in ${scope} scope: no orphaned dependency installs were found.`,
        },
      ]);
      assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
      assert.equal(
        (await stat(locations.stateJsonPath, { bigint: true })).mtimeNs,
        stateMtimeBefore,
      );
      assert.deepStrictEqual(await readFile(locations.configJsonPath), configBefore);
      assert.equal(
        (await stat(locations.configJsonPath, { bigint: true })).mtimeNs,
        configMtimeBefore,
      );
      assert.deepStrictEqual(await scopeTree(scope, cwd), treeBefore);
      await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
      assert.deepStrictEqual(gitCalls.clone, []);
      assert.deepStrictEqual(gitCalls.fetch, []);
    });
  });
}

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

    await command.handler("prune --dry-run", ctx);
    await command.handler("prune", ctx);

    assert.deepStrictEqual(await scopeTree("user", cwd), userBefore);
    assert.deepStrictEqual(await scopeTree("project", cwd), projectBefore);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [user]\n  ⊘ app (failed) {unreadable}\n    cause: cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
        severity: "error",
      },
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

for (const { args, error } of [
  { args: "prune -y", error: 'Unknown flag: "-y".' },
  { args: "prune --keep-data", error: 'Unknown flag: "--keep-data".' },
  { args: "prune --prune", error: 'Unknown flag: "--prune".' },
  { args: "prune --bogus", error: 'Unknown flag: "--bogus".' },
  { args: "prune orphan@mp", error: "Too many arguments." },
] as const) {
  test(`${args} rejects before selecting an installed orphan`, async () => {
    await withHermeticEnvironment("standalone-prune-flags-", async ({ cwd }) => {
      // arrange
      await seedScope("user", cwd);
      await seedScope("project", cwd);
      const userBefore = await scopeTree("user", cwd);
      const projectBefore = await scopeTree("project", cwd);
      const { command, ctx, notifications, gitCalls } = registeredCommand(cwd);

      // act
      await command.handler(args, ctx);

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `${error}\n\nUsage: /claude:plugin prune [--scope user|project] [--dry-run]`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(await scopeTree("user", cwd), userBefore);
      assert.deepStrictEqual(await scopeTree("project", cwd), projectBefore);
      assert.deepStrictEqual(gitCalls.clone, []);
      assert.deepStrictEqual(gitCalls.fetch, []);
    });
  });
}
