// pi_claude_marketplace_list + pi_claude_marketplace_plugin_list
// LLM-tool tests.
//
// The tools are registered via `pi.registerTool({...})`. We build a mock pi
// whose `registerTool` stores each registration in a Map; tests assert
// presence of the two tool names AND invoke the registered `execute`
// callback to verify the surface (text + details).

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  registerListMarketplacesTool,
  registerListPluginsTool,
} from "../../../extensions/pi-claude-marketplace/edge/handlers/tools.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Reduced type for the bits of the tool definition we exercise. The real
// type from `@earendil-works/pi-coding-agent` carries more fields than tests
// need to read; we capture the `execute` callback verbatim plus a few
// metadata fields for identity assertions.
interface ToolDef {
  name: string;
  label?: string;
  description?: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: unknown,
    onUpdate: unknown,
    ctx: ExtensionContext,
  ) => Promise<{
    content: { type: string; text: string }[];
    details: unknown;
    isError?: boolean;
  }>;
}

interface MockPiHandle {
  pi: ExtensionAPI;
  registered: Map<string, ToolDef>;
}

function makeMockPi(): MockPiHandle {
  const registered = new Map<string, ToolDef>();
  const pi = {
    registerTool: (tool: ToolDef): void => {
      registered.set(tool.name, tool);
    },
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  return { pi, registered };
}

function makeCtx(cwd: string): ExtensionContext {
  return {
    cwd,
    ui: {
      notify: (): void => {
        // unused
      },
    },
  } as unknown as ExtensionContext;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "tools-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "tools-shim-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

/**
 * Seed a single path-source marketplace at the project scope.
 * `extraPluginsInState` plants installed records under `mp.plugins`.
 * `manifestEntries` plants entries inside marketplace.json so the
 * orchestrator's `loadPluginListPayload` resolves the available /
 * uninstallable buckets.
 */
async function seedMarketplace(opts: {
  cwd: string;
  scope: "user" | "project";
  name: string;
  installedPlugins?: { name: string; version: string }[];
  manifestEntries?: { name: string; source: string; version?: string }[];
}): Promise<void> {
  const locations = locationsFor(opts.scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Seed a marketplaceRoot + manifest on disk so manifest reads work for
  // available/unavailable bucketing. (When no manifestEntries are provided
  // we still write an empty plugins array so the validator passes.)
  const mpRoot = await mkdtemp(path.join(tmpdir(), `mp-${opts.name}-`));
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: opts.name, plugins: opts.manifestEntries ?? [] }),
  );

  const nowIso = new Date().toISOString();
  const plugins: Record<
    string,
    {
      version: string;
      resolvedSource: string;
      compatibility: {
        installable: boolean;
        notes: string[];
        supported: string[];
        unsupported: string[];
      };
      resources: { skills: string[]; prompts: string[]; agents: string[]; mcpServers: string[] };
      installedAt: string;
      updatedAt: string;
    }
  > = {};
  for (const p of opts.installedPlugins ?? []) {
    plugins[p.name] = {
      version: p.version,
      resolvedSource: path.join(mpRoot, "plugins", p.name),
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      // ENBL-04: empty resources + installable:true IS the disabled marker;
      // seed a populated skills array so the record reads as ENABLED (a
      // production installed record always has >= 1 populated array).
      resources: { skills: [`${p.name}-skill`], prompts: [], agents: [], mcpServers: [] },
      installedAt: nowIso,
      updatedAt: nowIso,
    };
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: opts.scope,
        source: pathSource(`./mp-${opts.name}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: mpRoot,
        plugins,
      },
    },
  });
}

// ─── pi_claude_marketplace_list ─────────────────────────────────────────────

test("D-02 :: registerListMarketplacesTool registers tool name pi_claude_marketplace_list with empty params schema", () => {
  const { pi, registered } = makeMockPi();
  registerListMarketplacesTool(pi);
  assert.equal(registered.size, 1);
  const tool = registered.get("pi_claude_marketplace_list");
  assert.notEqual(tool, undefined);
  // Params is Type.Object({}) -- structurally an object with no required
  // properties. We don't need to introspect the schema deeply; identity is
  // enough.
  assert.notEqual(tool!.parameters, undefined);
});

test('pi_claude_marketplace_list :: empty state returns content text "No marketplaces configured." + details.marketplaces == []', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { pi, registered } = makeMockPi();
    registerListMarketplacesTool(pi);
    const tool = registered.get("pi_claude_marketplace_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);
    assert.equal(out.content[0]!.text, "No marketplaces configured.");
    const details = out.details as { marketplaces: unknown[] };
    assert.deepEqual(details.marketplaces, []);
  });
});

test("pi_claude_marketplace_list :: populated state returns one line per marketplace formatted [<scope>] <name> -- <N> plugin(s) -- <source.logical>", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListMarketplacesTool(pi);
    const tool = registered.get("pi_claude_marketplace_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);
    assert.match(out.content[0]!.text, /\[project\] mymkt -- 1 plugin\(s\) -- \.\/mp-mymkt/);
    const details = out.details as { marketplaces: { name: string; pluginCount: number }[] };
    assert.equal(details.marketplaces.length, 1);
    assert.equal(details.marketplaces[0]!.name, "mymkt");
    assert.equal(details.marketplaces[0]!.pluginCount, 1);
  });
});

// ─── pi_claude_marketplace_plugin_list ──────────────────────────────────────

test("D-02 :: registerListPluginsTool registers tool name pi_claude_marketplace_plugin_list with extended params", () => {
  const { pi, registered } = makeMockPi();
  registerListPluginsTool(pi);
  assert.equal(registered.size, 1);
  const tool = registered.get("pi_claude_marketplace_plugin_list");
  assert.notEqual(tool, undefined);
  assert.notEqual(tool!.parameters, undefined);
});

test("pi_claude_marketplace_plugin_list :: marketplace set, marketplace exists -> plugins from that marketplace", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { marketplace: "mymkt" }, undefined, undefined, ctx);
    assert.match(out.content[0]!.text, /Marketplace mymkt \(project\)/);
    assert.match(out.content[0]!.text, /\[installed\] p1/);
    const details = out.details as { plugins: { name: string; status: string }[] };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "p1");
    assert.equal(details.plugins[0]!.status, "installed");
  });
});

test("pi_claude_marketplace_plugin_list :: marketplace set, marketplace not found -> error text + details.plugins == []", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { marketplace: "ghost" }, undefined, undefined, ctx);
    assert.equal(out.content[0]!.text, 'Marketplace "ghost" not found.');
    const details = out.details as { plugins: unknown[] };
    assert.deepEqual(details.plugins, []);
  });
});

test("pi_claude_marketplace_plugin_list :: marketplace omitted -> enumerate across all marketplaces", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mkt-a",
      installedPlugins: [{ name: "pA", version: "1.0.0" }],
    });
    await seedMarketplace({
      cwd,
      scope: "user",
      name: "mkt-b",
      installedPlugins: [{ name: "pB", version: "2.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);
    assert.match(out.content[0]!.text, /Marketplace mkt-a/);
    assert.match(out.content[0]!.text, /Marketplace mkt-b/);
    assert.match(out.content[0]!.text, /\[installed\] pA/);
    assert.match(out.content[0]!.text, /\[installed\] pB/);
    const details = out.details as { plugins: { name: string }[] };
    assert.equal(details.plugins.length, 2);
  });
});

test("pi_claude_marketplace_plugin_list :: installed: true filter -> only installed bucket", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
      // No additional manifest entries -- so the available bucket is empty
      // and the installed-only filter still shows p1.
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { installed: true }, undefined, undefined, ctx);
    const details = out.details as { plugins: { name: string; status: string }[] };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.status, "installed");
  });
});

test("pi_claude_marketplace_plugin_list :: available: true filter -> only available bucket", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
      // No manifest entries that resolve to "available". With installed: omitted
      // and available: true the filter excludes the installed bucket. The
      // resulting plugin list is empty.
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { available: true }, undefined, undefined, ctx);
    const details = out.details as { plugins: unknown[] };
    assert.equal(details.plugins.length, 0);
  });
});

test("pi_claude_marketplace_plugin_list :: unavailable: true filter -> only unavailable bucket", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { unavailable: true }, undefined, undefined, ctx);
    const details = out.details as { plugins: unknown[] };
    assert.equal(details.plugins.length, 0);
  });
});

test("pi_claude_marketplace_plugin_list :: available: true + unavailable: true -> union of both (PL-1)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute(
      "call-1",
      { available: true, unavailable: true },
      undefined,
      undefined,
      ctx,
    );
    const details = out.details as { plugins: { status: string }[] };
    // p1 is installed -- so neither available nor unavailable filter
    // matches; the union is empty.
    for (const p of details.plugins) {
      assert.notEqual(p.status, "installed");
    }
  });
});

test("pi_claude_marketplace_plugin_list :: no filters -> all three buckets (PL-1 default)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "mymkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);
    const details = out.details as { plugins: { name: string; status: string }[] };
    // PL-1 default: installed is included.
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.status, "installed");
  });
});

test('pi_claude_marketplace_plugin_list :: scope: "user" filters to user scope only', async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "user",
      name: "user-mkt",
      installedPlugins: [{ name: "pU", version: "1.0.0" }],
    });
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "proj-mkt",
      installedPlugins: [{ name: "pP", version: "2.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { scope: "user" }, undefined, undefined, ctx);
    const details = out.details as { plugins: { name: string; scope: string }[] };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.scope, "user");
  });
});

test('pi_claude_marketplace_plugin_list :: scope: "project" filters to project scope only', async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "user",
      name: "user-mkt",
      installedPlugins: [{ name: "pU", version: "1.0.0" }],
    });
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "proj-mkt",
      installedPlugins: [{ name: "pP", version: "2.0.0" }],
    });
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { scope: "project" }, undefined, undefined, ctx);
    const details = out.details as { plugins: { name: string; scope: string }[] };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.scope, "project");
  });
});

// ─── Coverage for uncovered paths in tools.ts ────────────────────────────────

// Lines 173+193+236+315: projectRowStatus 'available' arm, statusLabel
// '[available]', statusKey 'a', pluginScopeOrFallback fallback for available.
test("pi_claude_marketplace_plugin_list :: path-source manifest entry -> available row [available] with marketplace scope", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Build a temporary marketplace root with a real plugin directory so
    // resolveStrict returns installable: true.
    const mpRoot = await mkdtemp(path.join(tmpdir(), "mp-avail-"));
    const pluginDir = path.join(mpRoot, "plugins", "pavail");
    await mkdir(pluginDir, { recursive: true });

    // Seed state with the marketplace record pointing at mpRoot but no
    // installed plugins -- the manifest entry is the only source of 'pavail'.
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "avail-mkt",
        plugins: [{ name: "pavail", source: "./plugins/pavail" }],
      }),
    );
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "avail-mkt": {
          name: "avail-mkt",
          scope: "project",
          source: pathSource("./avail-mkt"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {},
        },
      },
    });

    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);

    // statusLabel('available') -> '[available]' (line 193)
    assert.match(out.content[0]!.text, /\[available\] pavail/);
    const details = out.details as {
      plugins: { name: string; status: string; scope: string }[];
    };
    // projectRowStatus returns 'available' (line 173)
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pavail");
    assert.equal(details.plugins[0]!.status, "available");
    // pluginScopeOrFallback returns marketplaceScope for 'available' (line 315)
    assert.equal(details.plugins[0]!.scope, "project");

    await rm(mpRoot, { recursive: true, force: true });
  });
});

// Lines 175+195+238+315+207-208: projectRowStatus 'unavailable' arm,
// statusLabel '[unavailable]', statusKey 'u', reasons trailer,
// pluginScopeOrFallback fallback for unavailable.
test("pi_claude_marketplace_plugin_list :: github-source manifest entry -> unavailable row with reasons trailer", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const mpRoot = await mkdtemp(path.join(tmpdir(), "mp-unavail-"));
    await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "unavail-mkt",
        plugins: [{ name: "pgithub", source: "https://github.com/org/repo" }],
      }),
    );

    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "unavail-mkt": {
          name: "unavail-mkt",
          scope: "project",
          source: pathSource("./unavail-mkt"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {},
        },
      },
    });

    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);

    // statusLabel('unavailable') -> '[unavailable]' (line 195)
    assert.match(out.content[0]!.text, /\[unavailable\] pgithub/);
    // renderPluginRow pushes reasons trailer (lines 207-208)
    assert.match(out.content[0]!.text, /\(unsupported source\)/);
    const details = out.details as {
      plugins: { name: string; status: string; scope: string }[];
    };
    // projectRowStatus returns 'unavailable' (line 175)
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pgithub");
    assert.equal(details.plugins[0]!.status, "unavailable");
    // pluginScopeOrFallback returns marketplaceScope for 'unavailable' (line 315)
    assert.equal(details.plugins[0]!.scope, "project");

    await rm(mpRoot, { recursive: true, force: true });
  });
});

// Line 337: pluginReasons evaluates p.reasons for 'upgradable' status.
// An upgradable row has reasons: [] so pluginReasons returns undefined,
// the row's reasons field is absent, and the tool projects it as 'installed'.
test("pi_claude_marketplace_plugin_list :: upgradable plugin (manifest version > installed) -> [installed] no reasons", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "upgrade-mkt",
      installedPlugins: [{ name: "pupgrade", version: "1.0.0" }],
      manifestEntries: [{ name: "pupgrade", source: "./plugins/pupgrade", version: "2.0.0" }],
    });

    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { installed: true }, undefined, undefined, ctx);

    // upgradable projects to 'installed' on the tool surface
    assert.match(out.content[0]!.text, /\[installed\] pupgrade/);
    const details = out.details as {
      plugins: { name: string; status: string; reasons?: unknown }[];
    };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pupgrade");
    assert.equal(details.plugins[0]!.status, "installed");
    // pluginReasons returns undefined for empty reasons[] (line 337)
    assert.equal(details.plugins[0]!.reasons, undefined);
  });
});

// Lines 407-408: renderPluginPayload skips a row when its status bucket is
// not in the active filter (the continue branch).
test("pi_claude_marketplace_plugin_list :: installed:true filter skips unavailable github-source row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const mpRoot = await mkdtemp(path.join(tmpdir(), "mp-filter-"));
    await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "filter-mkt",
        plugins: [{ name: "pghost", source: "https://github.com/org/repo" }],
      }),
    );

    const nowIso = new Date().toISOString();
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "filter-mkt": {
          name: "filter-mkt",
          scope: "project",
          source: pathSource("./filter-mkt"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {
            pinstalled: {
              version: "1.0.0",
              resolvedSource: path.join(mpRoot, "plugins", "pinstalled"),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              // Populated resources: an ENABLED installed record (empty
              // resources + installable:true reads as disabled per ENBL-04).
              resources: { skills: ["pinstalled-skill"], prompts: [], agents: [], mcpServers: [] },
              installedAt: nowIso,
              updatedAt: nowIso,
            },
          },
        },
      },
    });

    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    // installed:true -> only 'i' bucket open; unavailable row hits statusKey('u')
    // which is false -> continue fires (lines 407-408)
    const out = await tool.execute("call-1", { installed: true }, undefined, undefined, ctx);
    const details = out.details as { plugins: { name: string; status: string }[] };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pinstalled");
    assert.equal(details.plugins[0]!.status, "installed");

    await rm(mpRoot, { recursive: true, force: true });
  });
});

// Lines 469-481: loadToolPluginPayload throws (corrupt state.json) ->
// tool returns isError: true with failure message.
test("pi_claude_marketplace_plugin_list :: corrupt state.json -> isError:true with failure message", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedMarketplace({
      cwd,
      scope: "project",
      name: "err-mkt",
      installedPlugins: [{ name: "p1", version: "1.0.0" }],
    });

    // Overwrite both scope state files with invalid JSON so loadState throws.
    const projectLocations = locationsFor("project", cwd);
    await writeFile(projectLocations.stateJsonPath, "INVALID");

    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);

    // TC-9: state parse error surfaces as a tool error (lines 469-481)
    assert.equal(out.isError, true);
    assert.match(out.content[0]!.text, /Failed to load plugin list/);
    const details = out.details as { plugins: unknown[] };
    assert.deepEqual(details.plugins, []);
  });
});

// Lines 485-490: rows.length === 0 && payload.length === 0 ->
// returns 'No marketplaces configured.' (plugin_list with no state).
test("pi_claude_marketplace_plugin_list :: no marketplaces in state -> No marketplaces configured.", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Intentionally do NOT call seedMarketplace -- no state.json written,
    // so loadPluginListPayload returns []. rows is also empty.
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", {}, undefined, undefined, ctx);

    assert.equal(out.content[0]!.text, "No marketplaces configured.");
    const details = out.details as { plugins: unknown[] };
    assert.deepEqual(details.plugins, []);
  });
});
