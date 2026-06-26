import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { reinstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { uninstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { updatePlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// LIFE-01 + LIFE-02 end-to-end integration: a hooks-declaring plugin
// flows through install -> update -> reinstall -> uninstall and at every
// site the on-disk <hooksDir>/<plugin>/hooks.json file matches the
// post-step contract.

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "lifecycle-cascade-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

async function seedHooksPlugin(opts: {
  readonly cwd: string;
  readonly marketplaceRoot: string;
  readonly marketplaceName?: string;
  readonly pluginName?: string;
  readonly version?: string;
  readonly hooksJson: object;
}): Promise<{ readonly pluginRoot: string; readonly manifestPath: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const pluginName = opts.pluginName ?? "hello";
  const version = opts.version ?? "1.0.0";

  const pluginRoot = path.join(opts.marketplaceRoot, "plugins", pluginName);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version }),
  );

  // Seed at least one skill so the install path stages something visible.
  const skillDir = path.join(pluginRoot, "skills", "tool");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: tool\n---\n\nbody for ${pluginName} ${version}.\n`,
  );

  await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
  await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(opts.hooksJson));

  await mkdir(path.join(opts.marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: [{ name: pluginName, source: `./plugins/${pluginName}`, version }],
    }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const { saveState, loadState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");
  const state = await loadState(locations.extensionRoot);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  });

  return { pluginRoot, manifestPath };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p, "utf8");
    return true;
  } catch {
    return false;
  }
}

test("LIFE-01 / LIFE-02 integration: install -> update -> reinstall -> uninstall all wire the hooks slot end-to-end", async () => {
  const { _resetForTest } =
    await import("../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "lifecycle-cascade-"));
    try {
      _resetForTest();
      const locations = locationsFor("project", cwd);
      const hooksPath = path.join(locations.hooksDir, "hello", "hooks.json");

      // HOOK-03 / LIFE-01: upstream PLUGIN-format wrapper per Claude Code
      // `plugin-dev/skills/hook-development/SKILL.md`. The source-plugin
      // seed file under `<pluginRoot>/hooks/hooks.json` ships the wrapper;
      // `parseHooksConfig` unwraps `parsed.hooks` before the bridge stage-
      // write path receives the inner record. On-disk `deepEqual`
      // assertions against `hooksPath` compare to `v1Hooks.hooks` /
      // `v2Hooks.hooks` (the unwrapped inner record the bridge writes).
      const v1Hooks = {
        hooks: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo v1" }] }],
        },
      };

      // (a) Install -- the hooks bridge file lands on disk.
      const seed = await seedHooksPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        hooksJson: v1Hooks,
      });

      {
        const { ctx, pi, notifications } = makeCtx();
        await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });
        const summary = notifications.map((n) => n.message).join("\n");
        assert.ok(!summary.includes("(failed)"), `install: expected clean; got: ${summary}`);
        assert.deepEqual(JSON.parse(await readFile(hooksPath, "utf8")), v1Hooks.hooks);
        // LIFE-02: install row + reload-hint trailer cascade.
        assert.ok(
          summary.includes("(installed)"),
          `install: expected (installed) row; got: ${summary}`,
        );
        assert.ok(
          summary.includes("/reload"),
          `install: expected reload-hint trailer; got: ${summary}`,
        );
      }

      // (b) Update to v2 with NEW hooks payload.
      const v2Hooks = {
        hooks: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo v2" }] }],
        },
      };
      await writeFile(
        seed.manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "hello", source: "./plugins/hello", version: "2.0.0" }],
        }),
      );
      await writeFile(
        path.join(seed.pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await writeFile(path.join(seed.pluginRoot, "hooks", "hooks.json"), JSON.stringify(v2Hooks));

      {
        const { ctx, pi, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          pi,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });
        const summary = notifications.map((n) => n.message).join("\n");
        assert.ok(!summary.includes("(failed)"), `update: expected clean; got: ${summary}`);
        assert.deepEqual(
          JSON.parse(await readFile(hooksPath, "utf8")),
          v2Hooks.hooks,
          "update commit slot must rewrite hooks.json with v2 payload",
        );
      }

      // (c) Reinstall -- the hooks bridge file is rewritten from the
      // resolved manifest. Corrupt the on-disk file first so the test
      // detects an actual write rather than passive carryover.
      await writeFile(hooksPath, JSON.stringify({ corrupted: true }));

      {
        const { ctx, pi, notifications } = makeCtx();
        const outcome = await reinstallPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });
        assert.equal(outcome.partition, "reinstalled");
        const summary = notifications.map((n) => n.message).join("\n");
        assert.ok(!summary.includes("(failed)"), `reinstall: expected clean; got: ${summary}`);
        assert.deepEqual(
          JSON.parse(await readFile(hooksPath, "utf8")),
          v2Hooks.hooks,
          "reinstall replace slot must rewrite hooks.json from the resolved manifest",
        );
      }

      // (d) Uninstall -- the hooks subtree is removed.
      {
        const { ctx, pi, notifications } = makeCtx();
        await uninstallPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });
        const summary = notifications.map((n) => n.message).join("\n");
        assert.ok(!summary.includes("(failed)"), `uninstall: expected clean; got: ${summary}`);
        assert.equal(
          await fileExists(hooksPath),
          false,
          "uninstall cascadeUnstagePlugin must remove the hooks subtree",
        );
        // LIFE-02: uninstall row + reload-hint trailer cascade.
        assert.ok(
          summary.includes("(uninstalled)"),
          `uninstall: expected (uninstalled) row; got: ${summary}`,
        );
        assert.ok(
          summary.includes("/reload"),
          `uninstall: expected reload-hint trailer; got: ${summary}`,
        );
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
