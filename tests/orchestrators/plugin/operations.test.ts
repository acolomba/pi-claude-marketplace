import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { mock, verify } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createInstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { InstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  NotificationContext,
  ToolInventory,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

function makeCtx(): {
  ctx: NotificationContext;
  pi: ToolInventory;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  return { ctx, pi: { getAllTools: () => [] }, notifications };
}

/**
 * Seed a path-source marketplace whose single plugin declares `hooks/hooks.json`,
 * plus the state record that makes it resolvable. Deliberately minimal: this
 * owner asserts the composed operation's real effects, not fixture variety.
 */
async function seedHooksDeclaringPlugin(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly hooksJson: object;
}): Promise<void> {
  const { cwd, marketplace, plugin } = opts;
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "hooks"));
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"));
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin, version: "0.0.1" }),
  );
  await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(opts.hooksJson));

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: [{ name: plugin, source: `./plugins/${plugin}` }],
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      [marketplace]: {
        name: marketplace,
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

test("constructs the install operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const installPlugin = createInstallOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof installPlugin, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after a successful installPlugin for a plugin declaring a
// hooks.json, the hooks-bridge routing table reflects the new entry. Without
// the rebuildRoutingTables call inside the per-plugin lock, the routing table
// would stay pinned to whatever the last reconcile produced and the new
// plugin would not receive dispatch until `/reload` (NFR-2 violation).
//
// This case owns the CONCRETE transaction wrapper: it runs the composed
// operation against the real phase ledger and the real state lock, so the
// production bindings this module holds are the ones under test.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: installPlugin of a hooks-declaring plugin rebuilds the routing table without /reload", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
  const { cwd } = await createHermeticEnvironment(t, "install-operation-wr03-");
  const ownerRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const installPlugin = createInstallOperation(
    createHooksRouting(ownerRuntime, { readHooksJson }),
    createCompletionCache(),
  );
  const locations = locationsFor("project", cwd);
  await seedHooksDeclaringPlugin({
    cwd,
    marketplace: "mp",
    plugin: "p1",
    hooksJson: {
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
    },
  });
  // Pre-condition: the routing table's PreToolUse bucket is empty.
  assert.deepStrictEqual(ownerRuntime.getRoutingBucket("PreToolUse"), []);
  const { ctx, pi, notifications } = makeCtx();

  // act
  const outcome = await installPlugin({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    status: "installed",
    version: "0.0.1",
    resourcesChanged: false,
    declaresAgents: false,
    declaresMcp: false,
  });

  // Confirm install succeeded (no "failed" / "unavailable" notification).
  // The first notification carries the cascade text; we only need the
  // routing-table effect to be observable.
  const summary = notifications.map((n) => n.message).join("\n");
  assert.ok(
    !summary.includes("(failed)") && !summary.includes("(unavailable)"),
    `expected clean install notification; got: ${summary}`,
  );

  // The plugin must have its hooks resource recorded -- otherwise the
  // bridge cache lookup at rebuild time would silently skip it. The whole
  // record is pinned, which also covers D-100-01 / ENBL-11: the same install
  // describes the hook entries `info` reports once the artifacts are gone.
  // A tool event carries its matcher (empty string = match-all); no handler
  // payload is recorded.
  const afterState = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins["p1"], {
    version: "0.0.1",
    resolvedSource: path.join(cwd, "mp-src", "plugins", "p1"),
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["p1"] },
    hookEntries: [{ event: "PreToolUse", matcher: "" }],
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // The materialized config is the dispatch input, so its complete bytes are
  // the contract -- not a re-parsed object a consumer never sees.
  assert.strictEqual(
    await readFile(path.join(locations.hooksDir, "p1", "hooks.json"), "utf8"),
    '{\n  "PreToolUse": [\n    {\n      "matcher": "",\n      "hooks": [\n        {\n          "type": "command",\n          "command": "echo hello"\n        }\n      ]\n    }\n  ]\n}\n',
  );

  // Post-condition: the routing table now reflects the installed plugin's
  // PreToolUse entry. This proves WR-03's `rebuildRoutingTables()` ran
  // inside the per-plugin lock right after `addPluginConfigToCache`.
  // resolvedSource must propagate from the resolver -> cache -> routing
  // table; without it a regression that drops the pluginRoot argument from
  // addPluginConfigToCache(...) would not be caught at the orchestrator-test
  // layer. CLAUDE_PLUGIN_ROOT export at dispatch depends on this field.
  const bucket = ownerRuntime.getRoutingBucket("PreToolUse");
  assert.equal(bucket.length, 1);
  assert.equal(bucket[0]?.pluginId, "p1");
  assert.equal(bucket[0]?.scope, "project");
  assert.equal(bucket[0]?.handlerDecl["command"], "echo hello");
  assert.equal(
    bucket[0]?.resolvedSource,
    afterState.marketplaces["mp"]?.plugins["p1"]?.resolvedSource,
    "RoutingEntry.resolvedSource must mirror state.json's resolvedSource",
  );
  assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
});
