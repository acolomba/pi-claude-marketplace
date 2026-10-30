// Owner suite for orchestrators/reconcile/load.ts.
//
// APL-03 / D-02: the load's contract is what it leaves on disk -- nothing --
// and what it prints: the block `pending` prints for the same tree (D-05 /
// D-06), then the cascade of the warnings that return every session (D-18).
// Each case shapes a project scope on a case-owned temporary tree and runs the
// real read pass, the real routing owner and the real persistence. The MCP
// move is injected only where its input is the promise.
//
// IL-2 is proved by sizing the notification boundary: each case promises the
// exact number of emissions it expects, so an unexpected one throws where it is
// made. A load with nothing to report promises zero.

import assert from "node:assert/strict";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createLoadReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import { pendingReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { LoadReconcileOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import type {
  ApplyReconcileOptions,
  McpMigrationStep,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/** AAP-02: the apply step of a load whose configs leave autoapply off. */
function applyNeverRuns(): Promise<void> {
  return Promise.reject(new Error("a load with autoapply off ran the apply step"));
}

const loadReconcile = createLoadReconcile({ loadState }, applyNeverRuns);

/** One load over the case's tree with a fresh routing owner. */
function load(
  opts: Omit<LoadReconcileOptions, "hooksRouting" | "run" | "completionCache">,
): Promise<void> {
  return loadReconcile({
    ...opts,
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });
}

interface InstalledPlugin {
  readonly enabled?: boolean;
  /** Bare tokens written into the plugin's own manifest and its catalog entry. */
  readonly dependencies?: readonly string[];
}

interface LoadScope {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
  /** The path marketplace `mp` every seeded state records. */
  readonly marketplaceRoot: string;
}

async function createLoadScope(t: TestContext, label: string): Promise<LoadScope> {
  const { cwd } = await createHermeticEnvironment(t, `load-${label}-`);
  return {
    cwd,
    project: locationsFor("project", cwd),
    user: locationsFor("user", cwd),
    marketplaceRoot: path.join(cwd, "mp-src"),
  };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/**
 * Lay down marketplace `mp` at `marketplaceRoot` listing `listed`, give every
 * plugin in `installed` its own manifest, and record `installed` in the scope's
 * state.json.
 */
async function seedInstalled(
  scope: LoadScope,
  locations: ScopedLocations,
  installed: Readonly<Record<string, InstalledPlugin>>,
  listed: readonly string[],
): Promise<void> {
  const root = scope.marketplaceRoot;
  await writeUnder(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: listed.map((name) => ({
        name,
        version: "1.0.0",
        source: `./plugins/${name}`,
        dependencies: [...(installed[name]?.dependencies ?? [])],
      })),
    }),
  );
  const records: Record<string, PluginRecord> = {};
  for (const [name, plugin] of Object.entries(installed)) {
    const pluginRoot = path.join(root, "plugins", name);
    await writeUnder(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name, version: "1.0.0", dependencies: plugin.dependencies ?? [] }),
    );
    records[name] = {
      version: "1.0.0",
      resolvedSource: pluginRoot,
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled: plugin.enabled ?? true,
      provenance: "explicit",
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: locations.scope,
        source: pathSource(root),
        addedFromCwd: scope.cwd,
        manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: root,
        plugins: records,
      },
    },
  });
}

/** The bytes of a base config declaring `mp` at `source` and the given plugins. */
function declaring(source: string, plugins: Readonly<Record<string, object>>): string {
  return JSON.stringify({ schemaVersion: 1, marketplaces: { mp: { source } }, plugins });
}

/** Both files a load must never write, read back as bytes plus the state's mtime. */
async function scopeFiles(locations: ScopedLocations): Promise<readonly unknown[]> {
  return [
    await readFile(locations.stateJsonPath, "utf8"),
    (await stat(locations.stateJsonPath)).mtimeMs,
    await readFile(locations.baseConfigJsonPath, "utf8"),
  ];
}

const APPLY_TRAILER = "\n\n/claude:plugin apply to make these changes";

test("APL-03 / D-05: a config that declares a plugin the scope never installed prints pending's block and changes nothing", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "declared-only");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project]\n  ● hello (will install)\n\nReconcile pending: 1 success" + APPLY_TRAILER,
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  assert.deepStrictEqual(await retryTree(scope.project.scopeRoot), [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  verifyBoundary();
});

test("D-06: the load's block and pending's output over the same tree are byte-identical", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "same-bytes");
  await seedInstalled(scope, scope.project, { gone: {}, kept: {} }, ["gone", "hello", "kept"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {}, "kept@mp": { enabled: false } }),
  );
  const loaded = createNotificationBoundary(1);
  const pending = createNotificationBoundary(1);

  // act
  await load({ ctx: loaded.ctx, cwd: scope.cwd });
  await pendingReconcile({ ctx: pending.ctx, run: runWithNothingLoaded(), cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(loaded.notifications, pending.notifications);
  loaded.verifyBoundary();
  pending.verifyBoundary();
});

for (const { name, plugins, installed, rows } of [
  {
    name: "a record its config no longer declares stays installed",
    plugins: {},
    installed: { hello: {} },
    rows: "  ○ hello v1.0.0 (will uninstall)",
  },
  {
    name: "a record its config declares disabled stays enabled",
    plugins: { "hello@mp": { enabled: false } },
    installed: { hello: {} },
    rows: "  ◍ hello (will disable)",
  },
  {
    name: "a disabled record its config declares enabled stays disabled",
    plugins: { "hello@mp": {} },
    installed: { hello: { enabled: false } },
    rows: "  ● hello (will enable)",
  },
  {
    name: "D-21: a record whose declared dependency is missing stays enabled",
    plugins: { "hello@mp": {} },
    installed: { hello: { dependencies: ["helper"] } },
    rows: "  ● helper (will install)",
  },
] as const) {
  test(`APL-03: ${name} and the load prints the change pending lists`, async (t) => {
    // arrange
    const scope = await createLoadScope(t, "kept-record");
    await seedInstalled(scope, scope.project, installed, ["hello", "helper"]);
    await writeUnder(scope.project.baseConfigJsonPath, declaring(scope.marketplaceRoot, plugins));
    const before = await scopeFiles(scope.project);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await load({ ctx, cwd: scope.cwd });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `● mp [project]\n${rows}\n\nReconcile pending: 1 success` + APPLY_TRAILER },
    ]);
    assert.deepStrictEqual(await scopeFiles(scope.project), before);
    verifyBoundary();
  });
}

test("RECON-05 / D-05: a config that matches the records prints nothing and changes nothing", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "matching");
  await seedInstalled(scope, scope.project, { hello: {} }, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("D-18: a recorded plugin its marketplace no longer lists gets the not-in-manifest warning on every load", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "delisted");
  await seedInstalled(scope, scope.project, { gone: {} }, []);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "gone@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const warning = {
    message:
      "A plugin operation needs attention.\n" +
      "\n" +
      "● mp [project]\n" +
      "  ⊘ gone (failed) {not in manifest}\n" +
      '    cause: Plugin "gone" not found in marketplace "mp"\n' +
      "\n" +
      "Reconcile: 1 warning",
    severity: "warning",
  } as const;
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await load({ ctx, cwd: scope.cwd });
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [warning, warning]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("D-18 / REC-05: a declarer whose own manifest cannot be read gets its warning and nothing is disabled", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "unreadable-declarer");
  await seedInstalled(scope, scope.project, { broken: {} }, ["broken"]);
  await writeUnder(
    path.join(scope.marketplaceRoot, "plugins", "broken", ".claude-plugin", "plugin.json"),
    "{ truncated",
  );
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "broken@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n" +
        "\n" +
        "● mp [project]\n" +
        "  ⊘ broken (failed) {unreadable manifest}\n" +
        "    cause: cannot read the dependencies of broken@mp: its own manifest is present but cannot be read\n" +
        "\n" +
        "Reconcile: 1 warning",
      severity: "warning",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("D-PL2-25: an enabled record whose installed copy cannot be used is listed in pending's block, as apply reports it", async (t) => {
  // arrange -- `widget` runs a per-commit copy whose manifest links outside
  // its plugin directory
  const scope = await createLoadScope(t, "refused-copy");
  await seedInstalled(scope, scope.project, { widget: {} }, ["widget"]);
  const copy = path.join(scope.project.pluginClonesDir, "widget-copy");
  const outside = path.join(scope.cwd, "outside-plugin.json");
  await writeUnder(outside, JSON.stringify({ name: "widget", version: "1.0.0" }));
  await mkdir(path.join(copy, ".claude-plugin"), { recursive: true });
  await symlink(outside, path.join(copy, ".claude-plugin", "plugin.json"));
  const seeded = await loadState(scope.project.extensionRoot);
  const widget = seeded.marketplaces["mp"]?.plugins["widget"];
  assert.ok(widget !== undefined);
  widget.resolvedSource = copy;
  widget.resolvedSha = "a".repeat(40);
  await saveState(scope.project.extensionRoot, seeded);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "widget@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n" +
        "\n" +
        "● mp [project]\n" +
        "  ⊘ widget (failed) {unreadable manifest}\n" +
        "    cause: cannot read the dependencies of widget@mp: its own manifest is present but cannot be read\n" +
        "\n" +
        "Reconcile pending: 1 warning",
      severity: "warning",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("CFG-03 / D-06: an unparseable config is reported once, by pending's block with its parse cause", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "invalid-config");
  await seedInstalled(scope, scope.project, { hello: {} }, ["hello"]);
  await writeUnder(scope.project.baseConfigJsonPath, "{");
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
        "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
        "    cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n" +
        "\n" +
        "Reconcile pending: 2 failures",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("D-PL10-23: a marketplace declared from another source is reported as an actionable replacement", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "source-mismatch");
  await seedInstalled(scope, scope.project, { hello: {} }, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(path.join(scope.cwd, "elsewhere"), { "hello@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (will add)\n" +
        "\n" +
        "Reconcile pending: 1 success\n" +
        "\n" +
        "/claude:plugin apply to make these changes",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("WR-05: a pristine workspace stays silent and creates nothing in either scope", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "pristine");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await retryTree(scope.project.scopeRoot), []);
  assert.deepStrictEqual(await retryTree(scope.user.scopeRoot), []);
  verifyBoundary();
});

test("WR-01: a project state file that cannot be parsed is one warning row, out of the block, and the user scope still reports", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "one-scope-fails");
  await writeUnder(scope.project.stateJsonPath, "{ not json");
  await seedInstalled(scope, scope.user, { gone: {} }, []);
  await writeUnder(scope.user.baseConfigJsonPath, declaring(scope.marketplaceRoot, {}));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user]\n  ○ gone v1.0.0 (will uninstall)\n\nReconcile pending: 1 success" +
        APPLY_TRAILER,
    },
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "● mp [user]\n" +
        "  ⊘ gone (failed) {not in manifest}\n" +
        '    cause: Plugin "gone" not found in marketplace "mp"\n' +
        "\n" +
        "⊘ state.json [project] (failed) {unparseable}\n" +
        "  ⊘ state.json (failed) {unparseable}\n" +
        "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
        "\n" +
        "Reconcile: 2 failures, 1 warning",
      severity: "error",
    },
  ]);
  assert.equal(await readFile(scope.project.stateJsonPath, "utf8"), "{ not json");
  verifyBoundary();
});

test("D-22 / AMIG-04: the MCP move runs for each readable scope with the plan its read pass computed", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "mcp-move");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {} }),
  );
  const moves: unknown[] = [];
  const migrateMcpEntries: McpMigrationStep = (input) => {
    moves.push({
      scope: input.scope,
      cwd: input.cwd,
      installs: input.plan?.pluginsToInstall.map((planned) => planned.plugin),
    });
    return Promise.resolve();
  };

  const { ctx, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd, migrateMcpEntries });

  // assert
  assert.deepStrictEqual(moves, [
    { scope: "project", cwd: scope.cwd, installs: ["hello"] },
    { scope: "user", cwd: scope.cwd, installs: undefined },
  ]);
  verifyBoundary();
});

test("IL-2: the migration notice, the pending block and the warnings go out in that order", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "all-payloads");
  await seedInstalled(scope, scope.project, { gone: {} }, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "gone@mp": {}, "hello@mp": {} }),
  );
  const migrateMcpEntries: McpMigrationStep = () => Promise.reject(new Error("cannot read"));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);

  // act
  await load({ ctx, cwd: scope.cwd, migrateMcpEntries });

  // assert
  // The notice names each scope's stopped move; the user scope's comes last.
  assert.deepStrictEqual(
    notifications.map(({ message }) => message.split("\n").at(-1)),
    [
      "  The user-scope move stopped: cannot read. The next /reload tries again.",
      "/claude:plugin apply to make these changes",
      "Reconcile: 1 warning",
    ],
  );
  verifyBoundary();
});

/** AAP-02: a load step whose apply step records each call and changes nothing. */
function recordingLoad(): {
  readonly loadReconcile: (opts: LoadReconcileOptions) => Promise<void>;
  readonly applied: ApplyReconcileOptions[];
} {
  const applied: ApplyReconcileOptions[] = [];
  return {
    loadReconcile: createLoadReconcile({ loadState }, (opts) => {
      applied.push(opts);
      return Promise.resolve();
    }),
    applied,
  };
}

/** The bytes of a base config declaring `mp`, the given plugins and an `autoapply` value. */
function declaringAutoapply(
  source: string,
  plugins: Readonly<Record<string, object>>,
  autoapply: unknown,
): string {
  return JSON.stringify({ schemaVersion: 1, marketplaces: { mp: { source } }, plugins, autoapply });
}

test("AAP-02 / D-05: a project config that turns autoapply on hands the load to the apply step and prints nothing itself", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "autoapply-on");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaringAutoapply(scope.marketplaceRoot, { "hello@mp": {} }, true),
  );
  const before = await scopeFiles(scope.project);
  const { loadReconcile: autoLoad, applied } = recordingLoad();
  const run = runWithNothingLoaded();
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await autoLoad({ ctx, run, cwd: scope.cwd, hooksRouting, completionCache });

  // assert
  assert.equal(applied.length, 1);
  const [handed] = applied;
  assert.deepStrictEqual(Object.keys(handed ?? {}).sort(), [
    "completionCache",
    "ctx",
    "cwd",
    "hooksRouting",
    "run",
  ]);
  assert.equal(handed?.ctx, ctx);
  assert.equal(handed?.run, run);
  assert.equal(handed?.cwd, scope.cwd);
  assert.equal(handed?.hooksRouting, hooksRouting);
  assert.equal(handed?.completionCache, completionCache);
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("AAP-02 / D-22: an autoapply load hands the apply step its MCP move", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "autoapply-mcp");
  await writeUnder(scope.user.baseConfigJsonPath, JSON.stringify({ autoapply: true }));
  const migrateMcpEntries: McpMigrationStep = () => Promise.resolve();
  const { loadReconcile: autoLoad, applied } = recordingLoad();
  const { ctx, verifyBoundary } = createNotificationBoundary(0);

  // act
  await autoLoad({
    ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    migrateMcpEntries,
  });

  // assert
  assert.equal(applied.length, 1);
  assert.equal(applied[0]?.migrateMcpEntries, migrateMcpEntries);
  verifyBoundary();
});

test("AAP-03 / NFR-2: an apply step that throws is reported as aborted, then the load prints the pending block", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "autoapply-throws");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaringAutoapply(scope.marketplaceRoot, { "hello@mp": {} }, true),
  );
  const before = await scopeFiles(scope.project);
  const throwingLoad = createLoadReconcile({ loadState }, () =>
    Promise.reject(new Error("the pass ended")),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await throwingLoad({
    ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "reconcile aborted: the pass ended", severity: "error" },
    {
      message:
        "● mp [project]\n  ● hello (will install)\n\nReconcile pending: 1 success" + APPLY_TRAILER,
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("AAP-03 / NFR-2: a refused abort notice still lets the read-only pass run", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "autoapply-abort-refused");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaringAutoapply(scope.marketplaceRoot, {}, true),
  );
  const before = await scopeFiles(scope.project);
  const throwingLoad = createLoadReconcile({ loadState }, () =>
    Promise.reject(new Error("the pass ended")),
  );
  const attempted: string[] = [];
  const ctx = {
    mode: "tui",
    ui: {
      notify: (message: string): never => {
        attempted.push(message);
        throw new Error("host notification refused");
      },
    },
  } as unknown as LoadReconcileOptions["ctx"];

  // act
  await throwingLoad({
    ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });

  // assert
  assert.deepStrictEqual(attempted, ["reconcile aborted: the pass ended"]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
});

test("AAP-01 / D-03: a config that turns autoapply on beside an invalid config keeps the load read-only", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "autoapply-invalid");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaringAutoapply(scope.marketplaceRoot, { "hello@mp": {} }, true),
  );
  await writeUnder(scope.user.baseConfigJsonPath, JSON.stringify({ autoapply: "yes" }));
  const before = await scopeFiles(scope.project);
  const { loadReconcile: autoLoad, applied } = recordingLoad();
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await autoLoad({
    ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });

  // assert
  assert.deepStrictEqual(applied, []);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "⊘ claude-plugins.json [user] (failed) {invalid manifest}\n" +
        "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
        "    cause: schema validation failed: /autoapply: must be boolean\n" +
        "\n" +
        "● mp [project]\n" +
        "  ● hello (will install)\n" +
        "\n" +
        "Reconcile pending: 2 failures, 1 success" +
        APPLY_TRAILER,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});
