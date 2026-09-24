import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

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
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
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
    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project", dryRun: true });

    await assert.rejects(stat(locations.extensionRoot), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
    ]);
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

test("actual prune with a missing state skips snapshot and save", async () => {
  await withHermeticEnvironment("prune-owner-empty-missing-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    let saves = 0;
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: () => {
            saves += 1;
            return Promise.resolve();
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.equal(saves, 0);
    await assert.rejects(stat(locations.stateJsonPath), { code: "ENOENT" });
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
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

for (const dryRun of [true, false] as const) {
  test(`${dryRun ? "preview" : "actual prune"} reports malformed state as a scoped failure`, async () => {
    await withHermeticEnvironment("prune-owner-malformed-state-", async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(locations.stateJsonPath, "{");
      const { ctx, notifications } = makeCtx(cwd);

      // act
      await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project", dryRun });

      // assert
      assert.deepStrictEqual(await readFile(locations.stateJsonPath, "utf8"), "{");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /\(prune\) \[project\].*failed.*unreadable/s);
      assert.match(notifications[0]?.message ?? "", /state\.json.*not valid JSON/);
      assert.doesNotMatch(notifications[0]?.message ?? "", /\/reload|\/tmp\//);
    });
  });
}

test("actual prune reports a held lock without changing state", async () => {
  await withHermeticEnvironment("prune-owner-held-lock-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 3, marketplaces: {} });
    const stateBefore = await readFile(locations.stateJsonPath);
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
    });
    const { ctx, notifications } = makeCtx(cwd);

    try {
      // act
      await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

      // assert
      assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /\(prune\) \[user\].*failed.*lock held/s);
      assert.match(notifications[0]?.message ?? "", /operation is in progress/);
      assert.doesNotMatch(notifications[0]?.message ?? "", /\/reload|\/tmp\//);
    } finally {
      await release();
    }
  });
});

test("actual prune reports a non-Error transaction rejection", async () => {
  await withHermeticEnvironment("prune-owner-non-error-", async ({ cwd }) => {
    // arrange
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The boundary can reject with a non-Error value.
      withLockedStateTransaction: () => Promise.reject(undefined),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [user]\n  ⊘ (prune) (failed) {unreadable}\n    cause: undefined",
        severity: "error",
      },
    ]);
  });
});

test("a failed state save retains a missing skill directory and restores state", async () => {
  await withHermeticEnvironment("prune-owner-save-failure-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const stateBefore = await readFile(locations.stateJsonPath);
    const skillBefore = await readFile(fixture.skills["orphan@mp"] ?? "");
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: () => Promise.reject(new Error("state save failed")),
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    await assert.rejects(stat(path.dirname(fixture.skills["orphan@mp"] ?? "")), {
      code: "ENOENT",
    });
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.ok(backupName);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName, "0", "SKILL.md")),
      skillBefore,
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback requires manual directory restore at mp-orphan-skill.",
        severity: "error",
      },
    ]);
  });
});

test("a failed save without directory artifacts completes rollback", async () => {
  await withHermeticEnvironment("prune-owner-save-no-directory-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await seedRecord(
      "project",
      cwd,
      JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./orphan" }] }),
    );
    const originalState = await readFile(locations.stateJsonPath);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: () => Promise.reject(new Error("state save failed")),
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), originalState);
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {unreadable}\n    cause: state save failed",
        severity: "error",
      },
    ]);
  });
});

test("a save that writes then rejects restores state and retains the skill backup", async () => {
  await withHermeticEnvironment("prune-owner-save-after-write-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const stateBefore = await readFile(locations.stateJsonPath);
    const skillBefore = await readFile(fixture.skills["orphan@mp"] ?? "");
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: async (root, state) => {
            await saveState(root, state);
            throw new Error("state save rejected after write");
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    await assert.rejects(stat(path.dirname(fixture.skills["orphan@mp"] ?? "")), {
      code: "ENOENT",
    });
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.ok(backupName);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName, "0", "SKILL.md")),
      skillBefore,
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after write\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback requires manual directory restore at mp-orphan-skill.",
        severity: "error",
      },
    ]);
  });
});

test("a failed save removes newly created state and retains the skill backup", async () => {
  await withHermeticEnvironment("prune-owner-save-created-state-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const loaded = await loadState(locations.extensionRoot);
    const skillBefore = await readFile(fixture.skills["orphan@mp"] ?? "");
    await rm(locations.stateJsonPath);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          loadState: () => Promise.resolve(loaded),
          saveState: async (root, state) => {
            await saveState(root, state);
            throw new Error("state save rejected after create");
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    await assert.rejects(stat(locations.stateJsonPath), { code: "ENOENT" });
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    await assert.rejects(stat(path.dirname(fixture.skills["orphan@mp"] ?? "")), {
      code: "ENOENT",
    });
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.ok(backupName);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName, "0", "SKILL.md")),
      skillBefore,
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save rejected after create\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback requires manual directory restore at mp-orphan-skill.",
        severity: "error",
      },
    ]);
  });
});

test("an occupied restore target reports rollback partial and retains the backup", async () => {
  await withHermeticEnvironment("prune-owner-restore-occupied-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const skill = fixture.skills["orphan@mp"] ?? "";
    const stateBefore = await readFile(locations.stateJsonPath);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: async () => {
            await mkdir(path.dirname(skill), { recursive: true });
            await writeFile(skill, "replacement\n");
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the transaction can reject with a non-Error value.
            await Promise.reject("state save failed");
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    assert.equal(await readFile(skill, "utf8"), "replacement\n");
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.match(backupName ?? "", /^prune-backup-[\w-]+$/);
    const manifest = JSON.parse(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "manifest.json"), "utf8"),
    ) as { entries: Array<{ phase: string; root: string; target: string; backup: string | null }> };
    assert.deepStrictEqual(
      manifest.entries.filter((entry) => entry.phase === "skills"),
      [
        {
          phase: "skills",
          root: path.join("pi-claude-marketplace", "resources", "skills"),
          target: "mp-orphan-skill",
          backup: "0",
        },
      ],
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback found an occupied artifact at mp-orphan-skill.",
        severity: "error",
      },
    ]);
  });
});

test("a missing skill directory reports manual recovery and restores state", async () => {
  await withHermeticEnvironment("prune-owner-restore-directory-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const skill = fixture.skills["orphan@mp"] ?? "";
    const originalSkill = await readFile(skill);
    const originalState = await readFile(locations.stateJsonPath);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: () => Promise.reject(new Error("state save failed")),
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    await assert.rejects(stat(path.dirname(skill)), { code: "ENOENT" });
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), originalState);
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.ok(backupName);
    const backupRoot = path.join(locations.extensionRoot, backupName);
    const manifest = JSON.parse(await readFile(path.join(backupRoot, "manifest.json"), "utf8")) as {
      entries: Array<{ phase: string; root: string; target: string; backup: string | null }>;
    };
    assert.deepStrictEqual(
      manifest.entries.filter(({ phase }) => phase === "skills"),
      [
        {
          phase: "skills",
          root: path.join("pi-claude-marketplace", "resources", "skills"),
          target: "mp-orphan-skill",
          backup: "0",
        },
      ],
    );
    assert.deepStrictEqual(await readFile(path.join(backupRoot, "0", "SKILL.md")), originalSkill);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback requires manual directory restore at mp-orphan-skill.",
        severity: "error",
      },
    ]);
  });
});

test("a concurrent MCP edit survives failed save with its original in recovery backup", async () => {
  await withHermeticEnvironment("prune-owner-mcp-collision-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const originalMcp = Buffer.from('{ "mcpServers": { "original": 1 } }\n');
    const currentMcp = Buffer.from('{ "mcpServers": { "original": 1, "independent": 2 } }\n');
    await writeFile(locations.mcpJsonPath, originalMcp);
    const stateBefore = await readFile(locations.stateJsonPath);
    const skillBefore = await readFile(fixture.skills["orphan@mp"] ?? "");
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: async () => {
            await writeFile(locations.mcpJsonPath, currentMcp);
            throw new Error("state save failed");
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(await readFile(locations.mcpJsonPath), currentMcp);
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    await assert.rejects(stat(path.dirname(fixture.skills["orphan@mp"] ?? "")), {
      code: "ENOENT",
    });
    await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" });
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.match(backupName ?? "", /^prune-backup-[\w-]+$/);
    const manifest = JSON.parse(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "manifest.json"), "utf8"),
    ) as { entries: Array<{ phase: string; root: string; target: string; backup: string | null }> };
    assert.deepStrictEqual(
      manifest.entries.filter((entry) => entry.phase === "mcp"),
      [{ phase: "mcp", root: ".", target: "mcp.json", backup: "3" }],
    );
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "3")),
      originalMcp,
    );
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "0", "SKILL.md")),
      skillBefore,
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● (prune) [project]\n  ⊘ (prune) (failed) {rollback partial}\n" +
          `    cause: Prune rollback was incomplete. Inspect ${backupName}/manifest.json under this scope's pi-claude-marketplace directory before retrying. -> state save failed\n` +
          "    [skills] (rollback failed)\n" +
          "      cause: Prune rollback requires manual directory restore at mp-orphan-skill.\n" +
          "    [mcp] (rollback failed)\n" +
          "      cause: Prune rollback found an occupied metadata path at mcp.json.",
        severity: "error",
      },
    ]);
  });
});

test("an MCP edit after a cascade with no MCP resources survives failed persistence", async () => {
  await withHermeticEnvironment("prune-owner-mcp-after-cascade-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await seedScope("project", cwd, { mp: { orphan: { provenance: "dependency" } } });
    const original = Buffer.from('{ "mcpServers": { "original": 1 } }\n');
    const independent = Buffer.from('{ "mcpServers": { "original": 1, "independent": 2 } }\n');
    await writeFile(locations.mcpJsonPath, original);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      cascadeUnstagePlugin: async (...args) => {
        const outcome = await REAL_UNINSTALL_TRANSACTION.cascadeUnstagePlugin(...args);
        await writeFile(locations.mcpJsonPath, independent);
        return outcome;
      },
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: () => Promise.reject(new Error("state save failed")),
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(await readFile(locations.mcpJsonPath), independent);
    assert.match(notifications[0]?.message ?? "", /\{rollback partial\}/);
    assert.match(notifications[0]?.message ?? "", /\[mcp\] \(rollback failed\)/);
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.ok(backupName);
    const manifest = JSON.parse(
      await readFile(path.join(locations.extensionRoot, backupName, "manifest.json"), "utf8"),
    ) as { entries: Array<{ phase: string; backup: string | null }> };
    const entry = manifest.entries.find(({ phase }) => phase === "mcp");
    assert.ok(entry?.backup);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, backupName, entry.backup)),
      original,
    );
  });
});

test("rollback details survive a simultaneous lock-release failure", async (t) => {
  await withHermeticEnvironment("prune-owner-rollback-release-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await seedScope("project", cwd, { mp: { orphan: { provenance: "dependency" } } });
    await writeFile(locations.mcpJsonPath, '{ "mcpServers": { "original": 1 } }\n');
    const originalLock = lockfile.lock;
    t.mock.method(lockfile, "lock", async (...args: Parameters<typeof lockfile.lock>) => {
      const release = await originalLock(...args);
      return async (): Promise<void> => {
        await release();
        throw new Error("lock release failed");
      };
    });
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run, {
          saveState: async () => {
            await writeFile(
              locations.mcpJsonPath,
              '{ "mcpServers": { "original": 1, "independent": 2 } }\n',
            );
            throw new Error("state save failed");
          },
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    const message = notifications[0]?.message ?? "";
    assert.equal(notifications[0]?.severity, "error");
    assert.match(message, /\{rollback partial\}/);
    assert.match(message, /\[mcp\] \(rollback failed\)/);
    assert.match(message, /prune-backup-[\w-]+\/manifest\.json/);
    assert.match(message, /state save failed/);
    assert.match(message, /lock release also failed: lock release failed/);
    assert.doesNotMatch(message, /\/tmp\//);
    assert.equal(
      await readFile(locations.mcpJsonPath, "utf8"),
      '{ "mcpServers": { "original": 1, "independent": 2 } }\n',
    );
  });
});

test("a lock-release rejection reports committed removal and completes cleanup", async () => {
  await withHermeticEnvironment("prune-owner-release-after-save-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run).then(() =>
          Promise.reject(new Error("lock release failed after save")),
        ),
    };
    const routes: string[] = [];
    const pruneWithRoutes = createPrunePlugin(
      transaction,
      {
        removePluginConfigFromCache: (targetScope, marketplace, plugin) => {
          routes.push(`${targetScope}:${marketplace}:${plugin}`);
        },
        rebuildRoutingTables: () => {
          routes.push("rebuilt");
        },
      },
      createCompletionCache(),
    );
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await pruneWithRoutes({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    await assert.rejects(stat(fixture.skills["orphan@mp"] ?? ""), { code: "ENOENT" });
    await assert.rejects(stat(fixture.data["orphan@mp"] ?? ""), { code: "ENOENT" });
    assert.deepStrictEqual(routes, ["project:mp:orphan", "rebuilt"]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: lock release failed after save\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});

test("an undefined release rejection still reports the committed scope", async () => {
  await withHermeticEnvironment("prune-owner-release-undefined-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run).then(() => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Model a foreign promise that rejects without an Error.
          return Promise.reject(undefined);
        }),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    await assert.rejects(stat(fixture.data["orphan@mp"] ?? ""), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: undefined\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});

test("post-commit cleanup failure reports committed members and continues cleanup", async () => {
  await withHermeticEnvironment("prune-owner-cleanup-after-save-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: {
        a: { provenance: "dependency" },
        b: { provenance: "dependency" },
      },
    });
    const cleaned: string[] = [];
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      runPostCommitCleanup: async (args) => {
        cleaned.push(args.plugin);
        if (args.plugin === "a") {
          throw new Error("first cleanup failed");
        }

        await REAL_UNINSTALL_TRANSACTION.runPostCommitCleanup(args);
      },
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(cleaned, ["a", "b"]);
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    assert.equal(await readFile(fixture.data["a@mp"] ?? "", "utf8"), "data\n");
    await assert.rejects(stat(fixture.data["b@mp"] ?? ""), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project]\n" +
          "  ○ a v1.0.0 (uninstalled) {dependency pruned}\n" +
          "    cause: first cleanup failed\n\n" +
          "● mp [project]\n" +
          "  ○ b v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});

test("cleanup failure on the second member warns only that member and keeps its data", async () => {
  await withHermeticEnvironment("prune-owner-second-cleanup-after-save-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: {
        a: { provenance: "dependency" },
        b: { provenance: "dependency" },
      },
    });
    const cleaned: string[] = [];
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      runPostCommitCleanup: async (args) => {
        cleaned.push(args.plugin);
        if (args.plugin === "b") {
          throw new Error("second cleanup failed");
        }

        await REAL_UNINSTALL_TRANSACTION.runPostCommitCleanup(args);
      },
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(cleaned, ["a", "b"]);
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    await assert.rejects(stat(fixture.data["a@mp"] ?? ""), { code: "ENOENT" });
    assert.equal(await readFile(fixture.data["b@mp"] ?? "", "utf8"), "data\n");
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project]\n" +
          "  ○ a v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● mp [project]\n" +
          "  ○ b v1.0.0 (uninstalled) {dependency pruned}\n" +
          "    cause: second cleanup failed\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});

test("lock-release and second-member cleanup failures keep separate causes", async () => {
  await withHermeticEnvironment("prune-owner-release-second-cleanup-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: {
        a: { provenance: "dependency" },
        b: { provenance: "dependency" },
      },
    });
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run).then(() =>
          Promise.reject(new Error("lock release failed after save")),
        ),
      runPostCommitCleanup: async (args) => {
        if (args.plugin === "b") {
          throw new Error("second cleanup failed");
        }

        await REAL_UNINSTALL_TRANSACTION.runPostCommitCleanup(args);
      },
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), []);
    await assert.rejects(stat(fixture.data["a@mp"] ?? ""), { code: "ENOENT" });
    assert.equal(await readFile(fixture.data["b@mp"] ?? "", "utf8"), "data\n");
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project]\n" +
          "  ○ a v1.0.0 (uninstalled) {dependency pruned}\n\n" +
          "● mp [project]\n" +
          "  ○ b v1.0.0 (uninstalled) {dependency pruned}\n" +
          "    cause: second cleanup failed\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
      {
        message:
          "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: lock release failed after save\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});

test("a post-save failure preserves the original cause when every member failed", async () => {
  await withHermeticEnvironment("prune-owner-release-all-failed-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seedScope("project", cwd, {
      mp: { orphan: { provenance: "dependency" } },
    });
    const cause = new AgentsUnstageFailureError("agent content changed", [
      { generatedName: "orphan-agent", targetPath: "/agents/orphan.md", reason: "missing marker" },
    ]);
    const transaction: UninstallTransaction = {
      ...REAL_UNINSTALL_TRANSACTION,
      cascadeUnstagePlugin: () =>
        Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
          cause,
        }),
      withLockedStateTransaction: (target, run) =>
        withLockedStateTransaction(target, run).then(() =>
          Promise.reject(new Error("release failed after save")),
        ),
    };
    const { ctx, notifications } = makeCtx(cwd);

    // act
    await prune(transaction)({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(installedKeys(await loadState(locations.extensionRoot)), ["orphan@mp"]);
    assert.equal(
      await readFile(fixture.skills["orphan@mp"] ?? "", "utf8"),
      "---\nname: mp-orphan-skill\n---\nbody\n",
    );
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project]\n" +
          "  ⊘ orphan v1.0.0 (failed) {source mismatch}\n" +
          "    cause: agent content changed",
        severity: "warning",
      },
      {
        message:
          "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: release failed after save\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
  });
});
