// Plan 09-02 Task 1: reinstall handler shim tests.
//
// Reinstall mirrors update's three target forms but adds a command-specific
// `--force` flag. These tests verify the thin edge parser reaches the bulk
// orchestrator for valid forms and rejects invalid flags/positionals before
// any successful reinstall can occur.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../../extensions/pi-claude-marketplace/domain/source.ts";
import { makeReinstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts";
import { installPlugin } from "../../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { __resetCacheForTests } from "../../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(cwd: string): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [{ name: "subagent" }, { name: "mcp" }],
  } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "reinstall-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-shim-cwd-"));
  process.env.HOME = home;
  __resetCacheForTests();
  try {
    return await fn({ cwd });
  } finally {
    __resetCacheForTests();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

async function seedInstalledAgentPlugin(opts: {
  readonly cwd: string;
  readonly marketplaceName?: string;
  readonly pluginName?: string;
  readonly scope?: Scope;
}): Promise<{ readonly pluginRoot: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const pluginName = opts.pluginName ?? "hello";
  const scope = opts.scope ?? "project";
  const marketplaceRoot = path.join(opts.cwd, `${marketplaceName}-src`);
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await writeAgentPluginTree(pluginRoot, pluginName, "old agent");

  const manifestDir = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: [{ name: pluginName, version: "1.0.0", source: `./plugins/${pluginName}` }],
    }),
  );

  const locations = locationsFor(scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state = await loadState(locations.extensionRoot);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope,
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });

  const { ctx } = makeCtx(opts.cwd);
  await installPlugin({
    ctx,
    pi: makePi(),
    scope,
    cwd: opts.cwd,
    marketplace: marketplaceName,
    plugin: pluginName,
  });
  return { pluginRoot };
}

async function writeAgentPluginTree(
  pluginRoot: string,
  pluginName: string,
  body: string,
): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName }),
  );
  const agentDir = path.join(pluginRoot, "agents");
  await mkdir(agentDir, { recursive: true });
  await writeFile(path.join(agentDir, "bot.md"), `---\nname: bot\n---\n\n${body}\n`);
}

test("shim :: bare reinstall with no positional calls reinstallPlugins target all", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, undefined);
    // Plan 19-04 / D-19-02 byte change: V2 empty-targets renders as the
    // `(no marketplaces)` sentinel via `{ marketplaces: [] }`. V1's
    // `(no plugins)` empty-row form is RETIRED -- V2's structural shape
    // carries no "(no plugins)" sentinel at the top-level / standalone-
    // cascade boundary; the closest analog is the list-surface
    // `(no marketplaces)` rendering at docs/output-catalog.md:139-145.
    assert.equal(notifications[0]?.message ?? "", "(no marketplaces)");
  });
});

test("shim :: @marketplace form calls reinstallPlugins marketplace target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("@mymkt", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, "error");
    assert.match(notifications[0]?.message ?? "", /mymkt/);
    assert.match(notifications[0]?.message ?? "", /not found/);
  });
});

test("shim :: plugin@marketplace form calls reinstallPlugins plugin target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("myplug@mymkt", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, "error");
    assert.match(notifications[0]?.message ?? "", /mymkt/);
    assert.match(notifications[0]?.message ?? "", /not found/);
  });
});

test("shim :: --scope works before and after reinstall ref", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const handler = makeReinstallHandler(makePi());
    const first = makeCtx(cwd);
    await handler("--scope project", first.ctx);
    assert.equal(first.notifications.length, 1);
    // Plan 19-04 / D-19-02 byte change: empty-targets renders as
    // `(no marketplaces)` per the V2 structural shape (see test
    // `shim :: bare reinstall ...` above for details).
    assert.equal(first.notifications[0]?.message ?? "", "(no marketplaces)");
    assert.doesNotMatch(first.notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/);

    const second = makeCtx(cwd);
    await handler("myplug@mymkt --scope project", second.ctx);
    assert.equal(second.notifications.length, 1);
    // Plan 19-04 / D-19-02: skipped row in plugins[] tips severity to
    // `warning` per D-16-11 (notify() content-derived ladder).
    assert.equal(second.notifications[0]?.severity, "warning");
    // V2 cascade row carries `(skipped) {not installed}`; per-row scope
    // orphan-folded (matches marketplace scope).
    assert.match(
      second.notifications[0]?.message ?? "",
      /● mymkt \[project\]\n {2}⊘ myplug \(skipped\) \{not installed\}/,
    );
  });
});

test("shim :: --force works before and after reinstall ref", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { pluginRoot } = await seedInstalledAgentPlugin({ cwd });
    const locations = locationsFor("project", cwd);
    const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
    await writeFile(agentPath, "manual foreign bytes", "utf8");
    await writeAgentPluginTree(pluginRoot, "hello", "new agent");

    const handler = makeReinstallHandler(makePi());
    const defaultAttempt = makeCtx(cwd);
    await handler("hello@mp --scope project", defaultAttempt.ctx);
    // Plan 19-04 / D-19-02: V2 cascade with a failed row tips severity
    // to `error` per D-16-11 (notify() content-derived ladder; failed
    // beats warning in first-match order). The V1 MSG-SR-6 ban on
    // `notifyError` for cascade summaries is GONE -- V2 owns severity
    // from contents. The per-row reason is derived structurally via the
    // failed outcome's `failureClass` tag (set by the orchestrator catch
    // when the bridge throws a ManualRecoveryError); in THIS scenario
    // (`replacePreparedAgents` rejects foreign content before any backup
    // commit, so no inner bridge rollback runs and the bridge never
    // throws ManualRecoveryError), the failed outcome carries no
    // `failureClass` tag and the renderer falls through to the closed-set
    // narrowing fallback `{not in manifest}`. Per-row scope orphan-folded.
    assert.equal(defaultAttempt.notifications[0]?.severity, "error");
    assert.match(defaultAttempt.notifications[0]?.message ?? "", /⊘ hello \(failed\)/);

    const forceAfter = makeCtx(cwd);
    await handler("hello@mp --scope project --force", forceAfter.ctx);
    assert.equal(
      forceAfter.notifications.some((n) => n.severity === "error"),
      false,
    );
    // Plan 19-04 / D-19-02: V2 single-plugin reinstall success renders as
    // a 1-row cascade carrying PluginReinstalledMessage; per-row scope
    // orphan-folded (matches marketplace scope).
    assert.match(
      forceAfter.notifications[0]?.message ?? "",
      /● mp \[project\]\n {2}● hello v\d.+\(reinstalled\)/,
    );

    await writeFile(agentPath, "manual foreign bytes again", "utf8");
    await writeAgentPluginTree(pluginRoot, "hello", "newer agent");
    const forceBefore = makeCtx(cwd);
    await handler("--force hello@mp --scope project", forceBefore.ctx);
    assert.equal(
      forceBefore.notifications.some((n) => n.severity === "error"),
      false,
    );
    assert.match(
      forceBefore.notifications[0]?.message ?? "",
      /● mp \[project\]\n {2}● hello v\d.+\(reinstalled\)/,
    );
  });
});

test("shim :: invalid ref unknown flag and extra positionals emit reinstall usage", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const handler = makeReinstallHandler(makePi());
    for (const args of ["no-at-sign", "--bogus", "a@mp b@mp", "--force=true"]) {
      const { ctx, notifications } = makeCtx(cwd);
      await handler(args, ctx);
      assert.equal(notifications.length, 1, args);
      assert.equal(notifications[0]?.severity, "error", args);
      assert.match(notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/, args);
      assert.doesNotMatch(notifications[0]?.message ?? "", /Reinstalled plugin/, args);
    }
  });
});

test("shim :: parseArgs failure (invalid --scope value) surfaces error with reinstall usage", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const handler = makeReinstallHandler(makePi());
    const { ctx, notifications } = makeCtx(cwd);
    await handler("--scope bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, "error");
    assert.match(notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/);
  });
});
