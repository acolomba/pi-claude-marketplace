// D-08-07 (OWNKEY-01): plugin and marketplace names that are also
// `Object.prototype` members work end to end. Every case runs the
// `/claude:plugin` command handler, which reaches the production operations
// (`createInstallOperation`, `createEnableOperation`,
// `createUninstallOperation`, `getPluginInfo`, `listPlugins`), or the real
// `applyReconcile`, in a hermetic home.
//
// - A plugin named `constructor` installs, lists, shows, disables, enables and
//   uninstalls, and state.json holds it as an own key after each save.
// - It updates, and removing its marketplace uninstalls it.
// - A reload whose claude-plugins.json declares `constructor@mp` or
//   `hello@constructor` installs it, and an import of `constructor@mp`
//   installs it and writes its config entry.
// - A marketplace that also declares `__proto__` installs its other plugins,
//   and it lists `__proto__` as unavailable. An install of `__proto__` is
//   refused and changes no file.
// - A command on `constructor` when no such plugin or marketplace exists
//   prints what it prints for any absent name.

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { registerClaudePluginCommand } from "../../extensions/pi-claude-marketplace/edge/register.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeCtx, makeMockPi } from "../e2e/_helpers.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { noStatusSnapshot } from "../platform/mcp-status-seed.ts";

import type { NotifyRecord } from "../e2e/_helpers.ts";

interface StoredRecord {
  readonly version: string;
  readonly enabled: boolean;
}

interface StoredState {
  readonly marketplaces: Readonly<
    Record<string, { readonly plugins: Readonly<Record<string, StoredRecord>> }>
  >;
}

/**
 * Seeds path marketplace `<marketplace>-src` under `cwd` declaring `plugins`
 * at `version`, each with one skill, and returns its root.
 */
async function seedMarketplace(
  cwd: string,
  marketplace: string,
  plugins: readonly string[],
  version = "1.0.0",
): Promise<string> {
  const marketplaceRoot = path.join(cwd, `${marketplace}-src`);
  for (const plugin of plugins) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version }),
    );
    await mkdir(path.join(pluginRoot, "skills", "greet"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, "skills", "greet", "SKILL.md"),
      "---\nname: greet\ndescription: Greets.\n---\nbody\n",
    );
  }

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      plugins: plugins.map((plugin) => ({
        name: plugin,
        source: `./plugins/${plugin}`,
        version,
      })),
    }),
  );
  return marketplaceRoot;
}

/** Registers `/claude:plugin` and returns a runner that collects one command's notifications. */
function registeredCommand(cwd: string): (args: string) => Promise<NotifyRecord[]> {
  const mock = makeMockPi([]);
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  const pluginUpdates = createPluginUpdateOperations(hooksRouting, completionCache);
  registerClaudePluginCommand(
    mock.pi,
    {
      completionCache,
      mcpStatus: noStatusSnapshot(),
      gitOps: createGitOpsFake({ boundary: "memory" }).gitOps,
      beginPluginUpdateRun: pluginUpdates.beginPluginUpdateRun,
    },
    hooksRouting,
    pluginUpdates.updatePlugins,
  );
  const command = mock.commands.get("claude:plugin");
  assert.ok(command);
  return async (args) => {
    const { ctx, notifications } = makeCtx(cwd);
    await command.handler(args, ctx);
    return notifications;
  };
}

// `Object.hasOwn` and `Object.entries` read own keys only, so a `constructor`
// marketplace or plugin record appears here only when state.json stores it as
// an own key.
async function recordedPlugins(
  cwd: string,
  marketplace: string,
): Promise<readonly (readonly [string, string, boolean])[]> {
  const state = JSON.parse(
    await readFile(locationsFor("project", cwd).stateJsonPath, "utf8"),
  ) as StoredState;
  const plugins = Object.hasOwn(state.marketplaces, marketplace)
    ? state.marketplaces[marketplace]?.plugins
    : undefined;
  return Object.entries(plugins ?? {}).map(
    ([name, record]) => [name, record.version, record.enabled] as const,
  );
}

/** Every file under `root` with its bytes, in path order. */
async function treeBytes(root: string): Promise<readonly (readonly [string, string])[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(
      async (file) =>
        [path.relative(root, file), (await readFile(file)).toString("base64")] as const,
    ),
  );
}

test("D-08-07: a plugin named constructor installs, lists, shows, disables, enables and uninstalls as an own record", async () => {
  await withHermeticEnvironment("reserved-record-keys-lifecycle-", async ({ cwd }) => {
    // arrange
    const marketplaceRoot = await seedMarketplace(cwd, "mp", ["constructor", "hello"]);
    const run = registeredCommand(cwd);
    const added = await run(`marketplace add ${marketplaceRoot} --scope project`);

    // act
    const installed = await run("install constructor@mp --scope project");
    const afterInstall = await recordedPlugins(cwd, "mp");
    const listed = await run("list --scope project");
    const shown = await run("info constructor@mp");
    const disabled = await run("disable constructor@mp");
    const afterDisable = await recordedPlugins(cwd, "mp");
    const enabled = await run("enable constructor@mp");
    const afterEnable = await recordedPlugins(cwd, "mp");
    const uninstalled = await run("uninstall constructor@mp");
    const afterUninstall = await recordedPlugins(cwd, "mp");

    // assert
    assert.deepStrictEqual(added, [{ message: "● mp [project] (added)" }]);
    assert.deepStrictEqual(installed, [
      {
        message: "● mp [project]\n  ● constructor v1.0.0 (installed)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterInstall, [["constructor", "1.0.0", true]]);
    assert.deepStrictEqual(listed, [
      {
        message:
          "● mp [project]\n  ● constructor v1.0.0 (installed)\n  ○ hello v1.0.0 (available)\n\n" +
          "Plugin list: 2 successes",
      },
    ]);
    assert.deepStrictEqual(shown, [
      {
        message:
          "● mp [project] <no autoupdate>\n  ● constructor v1.0.0 (installed)\n    skills: greet",
      },
    ]);
    assert.deepStrictEqual(disabled, [
      {
        message: "● mp [project]\n  ◍ constructor v1.0.0 (disabled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterDisable, [["constructor", "1.0.0", false]]);
    assert.deepStrictEqual(enabled, [
      {
        message: "● mp [project]\n  ● constructor v1.0.0 (installed)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterEnable, [["constructor", "1.0.0", true]]);
    assert.deepStrictEqual(uninstalled, [
      {
        message:
          "● mp [project]\n  ○ constructor v1.0.0 (uninstalled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterUninstall, []);
  });
});

for (const { marketplace, plugins, plugin } of [
  { marketplace: "mp", plugins: ["constructor", "hello"], plugin: "constructor" },
  { marketplace: "constructor", plugins: ["hello"], plugin: "hello" },
]) {
  test(`D-08-07: a reload whose config declares ${plugin}@${marketplace} installs it as an own record`, async () => {
    await withHermeticEnvironment("reserved-record-keys-reload-", async ({ cwd }) => {
      // arrange
      const marketplaceRoot = await seedMarketplace(cwd, marketplace, plugins);
      await mkdir(path.join(cwd, ".pi"), { recursive: true });
      await writeFile(
        path.join(cwd, ".pi", "claude-plugins.json"),
        JSON.stringify({
          schemaVersion: 1,
          marketplaces: { [marketplace]: { source: marketplaceRoot } },
          plugins: { [`${plugin}@${marketplace}`]: {} },
        }),
      );
      const { ctx, notifications } = makeCtx(cwd);
      const applyReconcile = createApplyReconcile({ loadState });

      // act
      await applyReconcile({
        ctx,
        pi: makeMockPi([]).pi,
        cwd,
        completionCache: createCompletionCache(),
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        reason: "reload",
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `● ${marketplace} [project] (added)\n  ● ${plugin} (installed)\n\nReconcile: 2 successes`,
        },
      ]);
      assert.deepStrictEqual(await recordedPlugins(cwd, marketplace), [[plugin, "1.0.0", true]]);
    });
  });
}

test("D-08-07: a plugin named constructor updates, and removing its marketplace uninstalls it", async () => {
  await withHermeticEnvironment("reserved-record-keys-update-", async ({ cwd }) => {
    // arrange
    const marketplaceRoot = await seedMarketplace(cwd, "mp", ["constructor", "hello"]);
    const run = registeredCommand(cwd);
    await run(`marketplace add ${marketplaceRoot} --scope project`);
    await run("install constructor@mp --scope project");
    await seedMarketplace(cwd, "mp", ["constructor", "hello"], "1.1.0");

    // act
    const updated = await run("update constructor@mp");
    const afterUpdate = await recordedPlugins(cwd, "mp");
    const refreshed = await run("marketplace update mp");
    const removed = await run("marketplace remove mp");
    const stateAfterRemove: unknown = JSON.parse(
      await readFile(locationsFor("project", cwd).stateJsonPath, "utf8"),
    );

    // assert
    assert.deepStrictEqual(updated, [
      {
        message:
          "● mp [project]\n  ● constructor v1.0.0 → v1.1.0 (updated)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterUpdate, [["constructor", "1.1.0", true]]);
    assert.deepStrictEqual(refreshed, [{ message: "● mp [project] (skipped) {up-to-date}" }]);
    assert.deepStrictEqual(removed, [
      {
        message:
          "● mp [project] (removed)\n  ○ constructor (uninstalled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(stateAfterRemove, { schemaVersion: 3, marketplaces: {} });
  });
});

test("D-08-07: an import of constructor@mp installs it, and disable and uninstall write its config entry back", async () => {
  await withHermeticEnvironment("reserved-record-keys-import-", async ({ cwd }) => {
    // arrange
    const marketplaceRoot = await seedMarketplace(cwd, "mp", ["constructor", "hello"]);
    await mkdir(path.join(cwd, ".claude"), { recursive: true });
    await writeFile(
      path.join(cwd, ".claude", "settings.json"),
      JSON.stringify({
        extraKnownMarketplaces: { mp: { source: { source: "directory", path: marketplaceRoot } } },
        enabledPlugins: { "constructor@mp": true },
      }),
    );
    const configPath = path.join(cwd, ".pi", "claude-plugins.json");
    const run = registeredCommand(cwd);

    // act
    const imported = await run("import --scope project");
    const configAfterImport: unknown = JSON.parse(await readFile(configPath, "utf8"));
    const afterImport = await recordedPlugins(cwd, "mp");
    const disabled = await run("disable constructor@mp");
    const configAfterDisable: unknown = JSON.parse(await readFile(configPath, "utf8"));
    const uninstalled = await run("uninstall constructor@mp");
    const configAfterUninstall: unknown = JSON.parse(await readFile(configPath, "utf8"));
    const afterUninstall = await recordedPlugins(cwd, "mp");

    // assert
    assert.deepStrictEqual(imported, [
      {
        message:
          "● mp [project] (added)\n  ● constructor (installed)\n\nImport: 2 successes\n\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(configAfterImport, {
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "constructor@mp": {} },
    });
    assert.deepStrictEqual(afterImport, [["constructor", "1.0.0", true]]);
    assert.deepStrictEqual(disabled, [
      {
        message: "● mp [project]\n  ◍ constructor v1.0.0 (disabled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(configAfterDisable, {
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "constructor@mp": { enabled: false } },
    });
    assert.deepStrictEqual(uninstalled, [
      {
        message:
          "● mp [project]\n  ○ constructor v1.0.0 (uninstalled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(configAfterUninstall, {
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: {},
    });
    assert.deepStrictEqual(afterUninstall, []);
  });
});

test("D-08-07: a marketplace that declares __proto__ installs hello, lists __proto__ as unavailable and refuses its install without a file change", async () => {
  await withHermeticEnvironment("reserved-record-keys-proto-", async ({ cwd, root }) => {
    // arrange
    const mpRoot = await seedMarketplace(cwd, "mp", ["constructor"]);
    const hostileRoot = await seedMarketplace(cwd, "hostile", ["__proto__", "hello"]);
    const run = registeredCommand(cwd);
    await run(`marketplace add ${mpRoot} --scope project`);
    await run(`marketplace add ${hostileRoot} --scope project`);
    await run("install constructor@mp --scope project");

    // act
    const installedHello = await run("install hello@hostile --scope project");
    const listed = await run("list --scope project");
    const filesBefore = await treeBytes(root);
    const refused = await run("install __proto__@hostile --scope project");
    const filesAfter = await treeBytes(root);

    // assert
    assert.deepStrictEqual(installedHello, [
      {
        message: "● hostile [project]\n  ● hello v1.0.0 (installed)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(listed, [
      {
        message:
          "● hostile [project]\n  ⊘ __proto__ v1.0.0 (unavailable) {unsupported source}\n" +
          "  ● hello v1.0.0 (installed)\n\n● mp [project]\n  ● constructor v1.0.0 (installed)\n\n" +
          "Plugin list: 3 successes",
      },
    ]);
    assert.deepStrictEqual(refused, [
      {
        message:
          "A plugin operation has failed.\n\n● hostile [project]\n" +
          "  ⊘ __proto__ (failed) {invalid manifest}\n" +
          '    cause: Plugin "__proto__@hostile" declares an unusable dependency ' +
          "(root: expected <plugin>@<marketplace>).",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(filesAfter, filesBefore);
    assert.deepStrictEqual(await recordedPlugins(cwd, "hostile"), [["hello", "1.0.0", true]]);
    assert.deepStrictEqual(await recordedPlugins(cwd, "mp"), [["constructor", "1.0.0", true]]);
  });
});

function marketplaceNotAdded(name: string): NotifyRecord {
  return {
    message: `A marketplace operation has failed.\n\n⊘ ${name} (failed) {marketplace not added}`,
    severity: "error",
  };
}

function pluginFailed(name: string, outcome: string): NotifyRecord {
  return {
    message: `A plugin operation has failed.\n\n● mp [project]\n  ⊘ ${name} ${outcome}`,
    severity: "error",
  };
}

for (const { command, notification } of [
  { command: (name: string) => `info x@${name}`, notification: marketplaceNotAdded },
  { command: (name: string) => `reinstall x@${name}`, notification: marketplaceNotAdded },
  { command: (name: string) => `marketplace update ${name}`, notification: marketplaceNotAdded },
  { command: (name: string) => `marketplace remove ${name}`, notification: marketplaceNotAdded },
  {
    command: (name: string) => `uninstall ${name}@mp`,
    notification: (name: string) => pluginFailed(name, "(failed) {not installed}"),
  },
  {
    command: (name: string) => `enable ${name}@mp`,
    notification: (name: string) => pluginFailed(name, "(skipped) {not installed}"),
  },
  {
    command: (name: string) => `reinstall ${name}@mp`,
    notification: (name: string) => pluginFailed(name, "(skipped) {not installed}"),
  },
  {
    command: (name: string) => `update ${name}@mp`,
    notification: (name: string) => pluginFailed(name, "(failed) {not in manifest}"),
  },
]) {
  test(`D-08-07: ${command("constructor")} prints what ${command("absent")} prints and changes no file`, async () => {
    await withHermeticEnvironment("reserved-record-keys-absent-", async ({ cwd, root }) => {
      // arrange
      const marketplaceRoot = await seedMarketplace(cwd, "mp", ["hello"]);
      const run = registeredCommand(cwd);
      await run(`marketplace add ${marketplaceRoot} --scope project`);
      await run("install hello@mp --scope project");
      const filesBefore = await treeBytes(root);

      // act
      const reserved = await run(command("constructor"));
      const absent = await run(command("absent"));

      // assert
      assert.deepStrictEqual(reserved, [notification("constructor")]);
      assert.deepStrictEqual(absent, [notification("absent")]);
      assert.deepStrictEqual(await treeBytes(root), filesBefore);
    });
  });
}
