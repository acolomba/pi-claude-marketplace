// D-08-07 (OWNKEY-01): plugin and marketplace names that are also
// `Object.prototype` members work end to end. Every case runs the
// `/claude:plugin` command handler, which reaches the production operations
// (`createInstallOperation`, `createEnableOperation`,
// `createUninstallOperation`, `getPluginInfo`, `listPlugins`), or the real
// `applyReconcile`, in a hermetic home.
//
// - A plugin named `constructor` installs, lists, shows, disables, enables and
//   uninstalls, and state.json holds it as an own key after each save.
// - A reload whose claude-plugins.json declares `constructor@mp` installs it.
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

interface StoredState {
  readonly marketplaces: Readonly<
    Record<string, { readonly plugins: Readonly<Record<string, { readonly enabled: boolean }>> }>
  >;
}

/**
 * Seeds path marketplace `<marketplace>-src` under `cwd` declaring `plugins`,
 * each with one skill, and returns its root.
 */
async function seedMarketplace(
  cwd: string,
  marketplace: string,
  plugins: readonly string[],
): Promise<string> {
  const marketplaceRoot = path.join(cwd, `${marketplace}-src`);
  for (const plugin of plugins) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "1.0.0" }),
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
        version: "1.0.0",
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
  registerClaudePluginCommand(
    mock.pi,
    {
      completionCache,
      mcpStatus: noStatusSnapshot(),
      gitOps: createGitOpsFake({ boundary: "memory" }).gitOps,
      beginPluginUpdateRun: () => () => Promise.reject(new Error("no update run expected")),
    },
    hooksRouting,
    createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  );
  const command = mock.commands.get("claude:plugin");
  assert.ok(command);
  return async (args) => {
    const { ctx, notifications } = makeCtx(cwd);
    await command.handler(args, ctx);
    return notifications;
  };
}

// `Object.entries` lists own keys only, so a `constructor` record appears here
// only when state.json stores it as an own key.
async function recordedPlugins(
  cwd: string,
  marketplace: string,
): Promise<readonly (readonly [string, boolean])[]> {
  const state = JSON.parse(
    await readFile(locationsFor("project", cwd).stateJsonPath, "utf8"),
  ) as StoredState;
  return Object.entries(state.marketplaces[marketplace]?.plugins ?? {}).map(
    ([name, record]) => [name, record.enabled] as const,
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
    assert.deepStrictEqual(afterInstall, [["constructor", true]]);
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
    assert.deepStrictEqual(afterDisable, [["constructor", false]]);
    assert.deepStrictEqual(enabled, [
      {
        message: "● mp [project]\n  ● constructor v1.0.0 (installed)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterEnable, [["constructor", true]]);
    assert.deepStrictEqual(uninstalled, [
      {
        message:
          "● mp [project]\n  ○ constructor v1.0.0 (uninstalled)\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(afterUninstall, []);
  });
});

test("D-08-07: a reload whose config declares constructor@mp installs it as an own record", async () => {
  await withHermeticEnvironment("reserved-record-keys-reload-", async ({ cwd }) => {
    // arrange
    const marketplaceRoot = await seedMarketplace(cwd, "mp", ["constructor", "hello"]);
    await mkdir(path.join(cwd, ".pi"), { recursive: true });
    await writeFile(
      path.join(cwd, ".pi", "claude-plugins.json"),
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "constructor@mp": {} },
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
        message: "● mp [project] (added)\n  ● constructor (installed)\n\nReconcile: 2 successes",
      },
    ]);
    assert.deepStrictEqual(await recordedPlugins(cwd, "mp"), [["constructor", true]]);
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
    assert.deepStrictEqual(await recordedPlugins(cwd, "hostile"), [["hello", true]]);
    assert.deepStrictEqual(await recordedPlugins(cwd, "mp"), [["constructor", true]]);
  });
});

for (const { command, notification } of [
  {
    command: (name: string) => `info x@${name}`,
    notification: (name: string): NotifyRecord => ({
      message: `A marketplace operation has failed.\n\n⊘ ${name} (failed) {marketplace not added}`,
      severity: "error",
    }),
  },
  {
    command: (name: string) => `uninstall ${name}@mp`,
    notification: (name: string): NotifyRecord => ({
      message: `A plugin operation has failed.\n\n● mp [project]\n  ⊘ ${name} (failed) {not installed}`,
      severity: "error",
    }),
  },
  {
    command: (name: string) => `enable ${name}@mp`,
    notification: (name: string): NotifyRecord => ({
      message: `A plugin operation has failed.\n\n● mp [project]\n  ⊘ ${name} (skipped) {not installed}`,
      severity: "error",
    }),
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
