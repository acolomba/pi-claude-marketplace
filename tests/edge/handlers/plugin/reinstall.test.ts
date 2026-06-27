// reinstall handler shim tests.
//
// Reinstall mirrors update's three target forms. Overwrite of collisions and
// foreign content is unconditional (RINST-01 / D-67-03): there is no
// command-local `--force` flag, and passing one errors as an UNKNOWN flag.
// These tests verify the thin edge parser reaches the bulk orchestrator for
// valid forms and rejects invalid flags/positionals before any successful
// reinstall can occur.

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
    // D-19-02: empty-targets renders as the
    // `(no marketplaces)` sentinel via `{ marketplaces: [] }`.
    assert.equal(notifications[0]?.message ?? "", "(no marketplaces)");
  });
});

test("shim :: @marketplace form calls reinstallPlugins marketplace target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("@mymkt", ctx);
    assert.equal(notifications.length, 1);
    // ATTR-03 / D-47-A: bare `@<marketplace>` form absent in both scopes ->
    // standalone `{not added}` with NO bracket (re-attributed from the former
    // `{not found}`). Severity error.
    assert.equal(notifications[0]?.severity, "error");
    assert.equal(
      notifications[0]?.message ?? "",
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: plugin@marketplace form calls reinstallPlugins plugin target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("myplug@mymkt", ctx);
    assert.equal(notifications.length, 1);
    // ATTR-03 / D-47-A: bare `<plugin>@<marketplace>` form absent in both
    // scopes -> standalone `{not added}` with NO bracket. Severity error.
    assert.equal(notifications[0]?.severity, "error");
    assert.equal(
      notifications[0]?.message ?? "",
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: --scope works before and after reinstall ref", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const handler = makeReinstallHandler(makePi());
    const first = makeCtx(cwd);
    await handler("--scope project", first.ctx);
    assert.equal(first.notifications.length, 1);
    // D-19-02: empty-targets renders as
    // `(no marketplaces)` per the structural shape (see test
    // `shim :: bare reinstall ...` above for details).
    assert.equal(first.notifications[0]?.message ?? "", "(no marketplaces)");
    assert.doesNotMatch(first.notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/);

    const second = makeCtx(cwd);
    await handler("myplug@mymkt --scope project", second.ctx);
    assert.equal(second.notifications.length, 1);
    // ATTR-03 / D-47-A / SCOPE-01: explicit `--scope project` where mymkt is
    // not added in project -> standalone `{not added}` carrying the requested
    // `[project]` bracket (re-attributed from the former synthesized phantom
    // target -> `(skipped) {not installed}`). Severity error.
    assert.equal(second.notifications[0]?.severity, "error");
    assert.equal(
      second.notifications[0]?.message ?? "",
      "A marketplace operation has failed.\n\n⊘ mymkt [project] (failed) {not added}",
    );
  });
});

test("RINST-01 / D-67-03 :: bare reinstall over foreign content overwrites unconditionally; --force is an unknown flag", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { pluginRoot } = await seedInstalledAgentPlugin({ cwd });
    const locations = locationsFor("project", cwd);
    const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
    await writeFile(agentPath, "manual foreign bytes", "utf8");
    await writeAgentPluginTree(pluginRoot, "hello", "new agent");

    const handler = makeReinstallHandler(makePi());

    // RINST-01: overwrite of collisions + foreign content is unconditional.
    // A bare reinstall (no flag) over an agent that holds foreign bytes now
    // SUCCEEDS with a (reinstalled) row -- the prior contract required a
    // command-local `--force`. Per-row scope orphan-folded (matches
    // marketplace scope).
    const bareAttempt = makeCtx(cwd);
    await handler("hello@mp --scope project", bareAttempt.ctx);
    assert.equal(
      bareAttempt.notifications.some((n) => n.severity === "error"),
      false,
    );
    assert.match(
      bareAttempt.notifications[0]?.message ?? "",
      /● mp \[project\]\n {2}● hello v\d.+\(reinstalled\)/,
    );

    // D-67-03: `--force` is no longer an accepted flag -> it errors as an
    // UNKNOWN flag (the shared edge scanner rejects it before any reinstall
    // runs), a clear signal the contract changed rather than a silent no-op.
    await writeFile(agentPath, "manual foreign bytes again", "utf8");
    await writeAgentPluginTree(pluginRoot, "hello", "newer agent");
    const forceRejected = makeCtx(cwd);
    await handler("hello@mp --scope project --force", forceRejected.ctx);
    assert.equal(forceRejected.notifications.length, 1);
    assert.equal(forceRejected.notifications[0]?.severity, "error");
    assert.ok(
      (forceRejected.notifications[0]?.message ?? "").startsWith('Unknown flag: "--force".'),
    );
    assert.match(forceRejected.notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/);
    assert.doesNotMatch(forceRejected.notifications[0]?.message ?? "", /\(reinstalled\)/);
  });
});

test("PRL-01: shim :: invalid ref unknown flag and extra positionals emit reinstall usage (top-level command exposes a clear Usage: block)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const handler = makeReinstallHandler(makePi());
    // D-67-03: bare `--force` joins the unknown-flag set (sibling of the
    // existing `--force=true`) -- reinstall no longer accepts it.
    for (const args of ["no-at-sign", "--bogus", "a@mp b@mp", "--force=true", "--force"]) {
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

// ──────────────────────────────────────────────────────────────────────────
// --local flag scanning at the edge boundary
// ──────────────────────────────────────────────────────────────────────────

test("USAGE string contains [--local]", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("badtoken --frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\[--local\]/);
    // RINST-01 / D-67-03: the usage string no longer advertises `[--force]`.
    assert.doesNotMatch(notifications[0]!.message, /\[--force\]/);
  });
});

test("Flag: --local at the trailing position is accepted (control reaches reinstallPlugins)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    // Bare bulk reinstall against empty state -> (no marketplaces). The
    // --local flag MUST NOT trip USAGE.
    await handler("--local", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("Flag: --local at the leading position parses identically", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("--local @mymkt", ctx);
    // @mymkt against empty state -> {not added} on the marketplace.
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\(failed\) \{not added\}|\(no marketplaces\)/);
  });
});

test("Unknown long flag -> USAGE error (no orchestrator call)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeReinstallHandler(makePi());
    await handler("--frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--frobnicate"\./);
  });
});
