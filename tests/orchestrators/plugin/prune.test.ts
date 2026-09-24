import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { AgentsUnstageFailureError } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { createPrunePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts";
import { REAL_UNINSTALL_TRANSACTION } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeCtx } from "../../e2e/_helpers.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { UninstallTransaction } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

function prune(transaction: UninstallTransaction = REAL_UNINSTALL_TRANSACTION) {
  return createPrunePlugin(
    transaction,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

interface Seed {
  readonly dependencies?: readonly string[];
  readonly provenance?: "explicit" | "dependency";
  readonly enabled?: boolean;
}

async function seedScope(
  scope: Scope,
  cwd: string,
  marketplaces: Readonly<Record<string, Readonly<Record<string, Seed>>>>,
): Promise<{
  readonly skills: Readonly<Record<string, string>>;
  readonly data: Readonly<Record<string, string>>;
}> {
  const locations = locationsFor(scope, cwd);
  const state: ExtensionState = { schemaVersion: 3, marketplaces: {} };
  const skills: Record<string, string> = {};
  const data: Record<string, string> = {};
  for (const [marketplace, plugins] of Object.entries(marketplaces)) {
    const marketplaceRoot = path.join(locations.extensionRoot, "sources", marketplace);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    const entries: object[] = [];
    const records: Record<string, ExtensionState["marketplaces"][string]["plugins"][string]> = {};
    for (const [plugin, seed] of Object.entries(plugins)) {
      const key = `${plugin}@${marketplace}`;
      const skill = `${marketplace}-${plugin}-skill`;
      const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
      const ownManifest = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      await mkdir(path.dirname(ownManifest), { recursive: true });
      await writeFile(
        ownManifest,
        JSON.stringify({ name: plugin, dependencies: seed.dependencies ?? [] }),
      );
      entries.push({ name: plugin, source: `./plugins/${plugin}` });
      const skillPath = path.join(locations.skillsTargetDir, skill, "SKILL.md");
      await mkdir(path.dirname(skillPath), { recursive: true });
      await writeFile(skillPath, `---\nname: ${skill}\n---\nbody\n`);
      const dataPath = path.join(await locations.pluginDataDir(marketplace, plugin), "session");
      await mkdir(path.dirname(dataPath), { recursive: true });
      await writeFile(dataPath, "data\n");
      skills[key] = skillPath;
      data[key] = dataPath;
      records[plugin] = {
        version: "1.0.0",
        resolvedSource: pluginRoot,
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        resources: { skills: [skill], prompts: [], agents: [], mcpServers: [], hooks: [] },
        enabled: seed.enabled ?? true,
        provenance: seed.provenance ?? "explicit",
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
    }

    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({ name: marketplace, plugins: entries }));
    state.marketplaces[marketplace] = {
      name: marketplace,
      scope,
      source: pathSource(`./${marketplace}`),
      addedFromCwd: cwd,
      manifestPath,
      marketplaceRoot,
      plugins: records,
    };
  }

  await saveState(locations.extensionRoot, state);
  return { skills, data };
}

function installedKeys(state: ExtensionState): readonly string[] {
  return Object.values(state.marketplaces)
    .flatMap((marketplace) =>
      Object.keys(marketplace.plugins).map((plugin) => `${plugin}@${marketplace.name}`),
    )
    .sort((left, right) => left.localeCompare(right));
}

async function filePresence(
  paths: Readonly<Record<string, string>>,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const [key, filePath] of Object.entries(paths)) {
    result[key] = await readFile(filePath).then(
      () => true,
      () => false,
    );
  }

  return result;
}

async function seedRecord(scope: Scope, cwd: string, manifestText: string): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(locations.extensionRoot, "sources", "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, manifestText);
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
          orphan: {
            version: "1.0.0",
            resolvedSource: "/unused",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: true,
            provenance: "dependency",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

test("removes an orphan from the default user scope and reports it", async () => {
  await withHermeticEnvironment("prune-owner-user-", async ({ cwd }) => {
    await seedRecord(
      "user",
      cwd,
      JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./orphan" }] }),
    );
    const { ctx, notifications } = makeCtx(cwd);
    const locations = locationsFor("user", cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces.mp?.plugins, {});
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
      },
    ]);
  });
});

test("previews an orphan without writing state or taking a lock", async () => {
  await withHermeticEnvironment("prune-owner-preview-", async ({ cwd }) => {
    await seedRecord(
      "user",
      cwd,
      JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./orphan" }] }),
    );
    const locations = locationsFor("user", cwd);
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, dryRun: true });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      { message: "● mp [user]\n  ○ orphan (will uninstall) {dependency pruned}" },
    ]);
  });
});

test("preview refuses an unreadable declarer without a write", async () => {
  await withHermeticEnvironment("prune-owner-preview-unreadable-", async ({ cwd }) => {
    await seedRecord("user", cwd, "{");
    const locations = locationsFor("user", cwd);
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, dryRun: true });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.match(notifications[0]?.message ?? "", /orphan.*failed.*unreadable/);
    assert.doesNotMatch(notifications[0]?.message ?? "", /\/reload|\/tmp\//);
  });
});

test("preview without orphans leaves the selected scope absent", async () => {
  await withHermeticEnvironment("prune-owner-preview-empty-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project", dryRun: true });

    await assert.rejects(stat(locations.extensionRoot), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, []);
  });
});

test("reports an empty project sweep without saving state", async () => {
  await withHermeticEnvironment("prune-owner-empty-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 3, marketplaces: {} });
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
    ]);
  });
});

test("refuses an unreadable declarer before saving or removing it", async () => {
  await withHermeticEnvironment("prune-owner-unreadable-", async ({ cwd }) => {
    await seedRecord("user", cwd, "{");
    const locations = locationsFor("user", cwd);
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    assert.deepStrictEqual(
      Object.keys((await loadState(locations.extensionRoot)).marketplaces.mp?.plugins ?? {}),
      ["orphan"],
    );
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /orphan.*failed.*unreadable/);
    assert.doesNotMatch(notifications[0]?.message ?? "", /\/reload|\/tmp\//);
  });
});

test("removes the whole project-scope fixpoint in literal order and leaves held records staged", async () => {
  await withHermeticEnvironment("prune-owner-fixpoint-", async ({ cwd }) => {
    const project = locationsFor("project", cwd);
    const user = locationsFor("user", cwd);
    const fixture = await seedScope("project", cwd, {
      alpha: {
        keeper: { dependencies: ["held@beta"] },
        a: { provenance: "dependency", dependencies: ["b@beta"] },
        c: { provenance: "dependency" },
        disabled: { enabled: false, dependencies: ["paused@alpha"] },
        paused: { provenance: "dependency" },
      },
      beta: {
        held: { provenance: "dependency" },
        b: { provenance: "dependency", dependencies: ["c@alpha"] },
        z: { provenance: "dependency" },
      },
    });
    await seedScope("user", cwd, { other: { untouched: { provenance: "dependency" } } });
    const userBefore = await readFile(user.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);
    const preview = makeCtx(cwd);
    const projectBefore = await readFile(project.stateJsonPath);

    await prune()({
      ctx: preview.ctx,
      pi: { getAllTools: () => [] },
      cwd,
      scope: "project",
      dryRun: true,
    });
    assert.deepStrictEqual(await readFile(project.stateJsonPath), projectBefore);
    assert.deepStrictEqual(preview.notifications, [
      {
        message:
          "● alpha [project]\n  ○ a (will uninstall) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ z (will uninstall) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ b (will uninstall) {dependency pruned}\n\n" +
          "● alpha [project]\n  ○ c (will uninstall) {dependency pruned}",
      },
    ]);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(installedKeys(await loadState(project.extensionRoot)), [
      "disabled@alpha",
      "held@beta",
      "keeper@alpha",
      "paused@alpha",
    ]);
    assert.deepStrictEqual(await filePresence(fixture.skills), {
      "keeper@alpha": true,
      "a@alpha": false,
      "c@alpha": false,
      "disabled@alpha": true,
      "paused@alpha": true,
      "held@beta": true,
      "b@beta": false,
      "z@beta": false,
    });
    assert.deepStrictEqual(await filePresence(fixture.data), {
      "keeper@alpha": true,
      "a@alpha": false,
      "c@alpha": false,
      "disabled@alpha": true,
      "paused@alpha": true,
      "held@beta": true,
      "b@beta": false,
      "z@beta": false,
    });
    assert.deepStrictEqual(await readFile(user.stateJsonPath), userBefore);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● alpha [project]\n  ○ a v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● beta [project]\n  ○ z v1.0.0 (uninstalled) {dependency pruned}\n" +
          "\n● beta [project]\n  ○ b v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● alpha [project]\n  ○ c v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
      },
    ]);
    const after = await readFile(project.stateJsonPath);
    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });
    assert.deepStrictEqual(await readFile(project.stateJsonPath), after);
    assert.deepStrictEqual(notifications[1], {
      message: "Nothing to prune in project scope: no orphaned dependency installs were found.",
    });
  });
});

test("reports only explicit and held user installs as an empty sweep without saving", async () => {
  await withHermeticEnvironment("prune-owner-held-empty-", async ({ cwd }) => {
    const locations = locationsFor("user", cwd);
    await seedScope("user", cwd, {
      mp: {
        holder: { dependencies: ["held@mp"] },
        held: { provenance: "dependency" },
      },
    });
    const before = await readFile(locations.stateJsonPath);
    const beforeStat = await stat(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    assert.equal((await stat(locations.stateJsonPath)).ino, beforeStat.ino);
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), [
      "held@mp",
      "holder@mp",
    ]);
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in user scope: no orphaned dependency installs were found." },
    ]);
  });
});

test("a failed member keeps its dependent chain while an independent orphan commits", async () => {
  await withHermeticEnvironment("prune-owner-failed-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      alpha: {
        a: { provenance: "dependency", dependencies: ["b@beta"] },
        free: { provenance: "dependency" },
      },
      beta: { b: { provenance: "dependency" } },
    });
    const cause = new AgentsUnstageFailureError("Agents unstage refused: foreign content", [
      { generatedName: "a-agent", targetPath: "/agents/a-agent.md", reason: "missing marker" },
    ]);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      cascadeUnstagePlugin: (plugin, marketplace, target, record) =>
        plugin === "a"
          ? Promise.resolve({
              ok: false,
              dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
              cause,
            })
          : REAL_UNINSTALL_TRANSACTION.cascadeUnstagePlugin(plugin, marketplace, target, record),
    };
    const { ctx, notifications } = makeCtx(cwd);

    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), [
      "a@alpha",
      "b@beta",
    ]);
    assert.deepStrictEqual(await filePresence(fixture.skills), {
      "a@alpha": true,
      "free@alpha": false,
      "b@beta": true,
    });
    assert.deepStrictEqual(await filePresence(fixture.data), {
      "a@alpha": true,
      "free@alpha": false,
      "b@beta": true,
    });
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● alpha [project]\n" +
          "  ⊘ a v1.0.0 (failed) {source mismatch}\n" +
          "    cause: Agents unstage refused: foreign content\n\n" +
          "● alpha [project]\n" +
          "  ○ free v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});
