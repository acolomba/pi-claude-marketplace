// Owner suite for orchestrators/reconcile/pending.ts.
//
// D-115-03: pending reads the real merged config and the real state off a
// case-owned temporary tree and delegates the row projection, so every case
// shapes its inputs on disk rather than injecting a seam. The only doubles are
// the Pi context and the notification run the orchestrator hands to `notify`.
//
// IL-2 is proved by sizing the notification boundary: each case promises the
// exact number of emissions it expects, so a second `ctx.ui.notify` call throws
// where it is made instead of being counted afterwards. Both pending
// notifications render from the run's snapshot (D-05), so no case holds a tool
// inventory to probe.
//
// Every seeded state.json is written in the canonical shape (`enabled` present,
// `resources.hooks` present, both marketplace paths present), so `loadState`
// performs no legacy migration and fires no best-effort background save. That
// keeps the IL-3 legacy-migration warning off standard error and keeps the
// no-mutation assertions from racing a fire-and-forget write.

import assert from "node:assert/strict";
import fs, { chmod, mkdir, readdir, readFile, utimes, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { test } from "node:test";

import {
  composePendingReport,
  pendingReconcile,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

interface HermeticScopes {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
}

/**
 * One project root and one user root per case, both removed with the
 * environment restore in a single hook registered before the act phase.
 */
async function createHermeticScopes(t: TestContext, label: string): Promise<HermeticScopes> {
  const { cwd } = await createHermeticEnvironment(t, `pending-${label}-`);
  return { cwd, project: locationsFor("project", cwd), user: locationsFor("user", cwd) };
}

/** Write `bytes` at `filePath`, creating the parent directory first. */
async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

interface DeclaredPlugin {
  readonly key: string;
  readonly enabled: boolean;
}

/** The bytes of a `claude-plugins.json` declaring one marketplace and its plugins. */
function configBytes(
  marketplace: string,
  source: string,
  plugins: readonly DeclaredPlugin[],
): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      marketplaces: { [marketplace]: { source } },
      plugins: Object.fromEntries(plugins.map(({ key, enabled }) => [key, { enabled }])),
    },
    null,
    2,
  );
}

interface RecordedPlugin {
  readonly name: string;
  readonly skills: readonly string[];
}

/**
 * The bytes of a canonical state.json recording one marketplace. Every field the
 * migrator would otherwise fill is present, so the load performs no migration.
 */
function stateBytes(
  marketplace: string,
  source: string,
  marketplaceRoot: string,
  plugins: readonly RecordedPlugin[],
): string {
  return JSON.stringify(
    {
      schemaVersion: 2,
      marketplaces: {
        [marketplace]: {
          name: marketplace,
          scope: "project",
          source,
          addedFromCwd: "/declared/cwd",
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: Object.fromEntries(
            plugins.map((plugin) => [
              plugin.name,
              {
                version: "1.0.0",
                resolvedSource: path.join(marketplaceRoot, plugin.name),
                compatibility: {
                  installable: true,
                  notes: [],
                  supported: ["skills"],
                  unsupported: [],
                },
                resources: {
                  skills: [...plugin.skills],
                  prompts: [],
                  agents: [],
                  mcpServers: [],
                  hooks: [],
                  workflows: [],
                },
                enabled: true,
                provenance: "explicit",
                installedAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          ),
        },
      },
    },
    null,
    2,
  );
}

test("DIFF-01: reports the zero-action advisory when neither scope has pending work", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "empty");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: /claude:plugin apply has nothing to change." },
  ]);
  verifyBoundary();
});

test("MSG-GR-3: an omitted scope walks both scopes and orders a shared marketplace name project before user", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "fanout");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (will add)\n  ● p-proj (will install)\n\n" +
        "● mp [user] (will add)\n  ● p-user (will install)\n\n" +
        "Reconcile pending: 4 successes\n\n/claude:plugin apply to make these changes",
    },
  ]);
  verifyBoundary();
});

test("an explicit user scope reports the user scope's pending work and never reads the project scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "user-only");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "user" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (will add)\n  ● p-user (will install)\n\nReconcile pending: 2 successes\n\n/claude:plugin apply to make these changes",
    },
  ]);
  verifyBoundary();
});

test("an explicit project scope reports the project scope's pending work and never reads the user scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "project-only");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (will add)\n  ● p-proj (will install)\n\nReconcile pending: 2 successes\n\n/claude:plugin apply to make these changes",
    },
  ]);
  verifyBoundary();
});

test("DIFF-01 / NFR-5: a repeated invocation emits the same notification and leaves both scope roots byte-identical", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "idempotent");
  const declaredConfig = configBytes("mp", "acme/tools", []);
  const recordedState = stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
    { name: "p1", skills: ["mp-p1-tool"] },
  ]);
  await writeUnder(project.baseConfigJsonPath, declaredConfig);
  await writeUnder(project.stateJsonPath, recordedState);
  const expectedNotification = {
    message:
      "● mp [project]\n  ○ p1 v1.0.0 (will uninstall)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
  };
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [expectedNotification, expectedNotification]);
  assert.deepStrictEqual(await retryTree(project.scopeRoot), [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  assert.deepStrictEqual(await retryTree(user.scopeRoot), []);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), declaredConfig);
  assert.strictEqual(await readFile(project.stateJsonPath, "utf8"), recordedState);
  verifyBoundary();
});

// CFG-03: an invalid config arm aborts the planner for its scope and reports the
// file's BASENAME (T-53-02-02: the absolute path is never emitted). Each row
// records a marketplace the surviving config arm does not fully declare, so
// skipping the abort would plan and render `(will uninstall)` rows.
const invalidConfigRows = [
  {
    reported: "claude-plugins.json",
    files: {
      "claude-plugins.json": "{",
    },
  },
  {
    reported: "claude-plugins.local.json",
    files: {
      "claude-plugins.json": configBytes("mp", "acme/tools", []),
      "claude-plugins.local.json": "{",
    },
  },
] satisfies readonly {
  readonly reported: string;
  readonly files: Readonly<Record<string, string>>;
}[];

for (const { reported, files } of invalidConfigRows) {
  test(`CFG-03 / I5: a malformed ${reported} reports its basename as a failed block with its parse cause and plans nothing for that scope`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "invalid-config");
    await writeUnder(
      project.stateJsonPath,
      stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
        { name: "p1", skills: ["mp-p1-tool"] },
      ]),
    );
    for (const [name, bytes] of Object.entries(files)) {
      await writeUnder(path.join(project.scopeRoot, name), bytes);
    }

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          `Some operations have failed.\n\n` +
          `⊘ ${reported} [project] (failed) {invalid manifest}\n` +
          `  ⊘ ${reported} (failed) {invalid manifest}\n` +
          "    cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n\n" +
          "Reconcile pending: 2 failures",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

// A `loadState` throw is contained as a structured failed block rather than
// escaping the command with no output at all. The two rows separate the
// classifier's arms: a parse failure carries a SyntaxError cause and reports
// `unparseable`; every other load failure delegates to the shared probe ladder,
// which reports `unreadable` for a wrapper error that carries no errno code.
const stateLoadFailureRows = [
  { condition: "an unparseable state.json", bytes: "{", reason: "unparseable" },
  {
    condition: "a state.json declaring an unsupported schema version",
    bytes: JSON.stringify({ schemaVersion: 99, marketplaces: {} }, null, 2),
    reason: "unreadable",
  },
] satisfies readonly {
  readonly condition: string;
  readonly bytes: string;
  readonly reason: string;
}[];

for (const { condition, bytes, reason } of stateLoadFailureRows) {
  test(`WR-04: ${condition} is contained as a failed block reporting {${reason}}`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "state-load-failure");
    await writeUnder(project.baseConfigJsonPath, configBytes("mp", "acme/tools", []));
    await writeUnder(project.stateJsonPath, bytes);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          `A marketplace operation has failed.\n\n` +
          `⊘ state.json [project] (failed) {${reason}}\n\n` +
          "Reconcile pending: 1 failure",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

// LAYER-06: a layer that declares a plugin whose marketplace only the other
// layer declares reports that layer's basename with the cause, and the scope
// plans nothing. Skipping the check would plan `p1` as `(will install)`. The
// file heads its block without a status, so its one failed row is the one
// error the tally counts.
const layerGapRows = [
  {
    reported: "claude-plugins.local.json",
    files: {
      "claude-plugins.json": configBytes("mp", "acme/tools", []),
      "claude-plugins.local.json": JSON.stringify({ schemaVersion: 1, plugins: { "p1@mp": {} } }),
    },
    cause:
      "The local config (claude-plugins.local.json) declares p1@mp, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.",
  },
  {
    reported: "claude-plugins.json",
    files: {
      "claude-plugins.json": JSON.stringify({ schemaVersion: 1, plugins: { "p1@mp": {} } }),
      "claude-plugins.local.json": configBytes("mp", "acme/tools", []),
    },
    cause:
      "The base config (claude-plugins.json) declares p1@mp, but only the local config (claude-plugins.local.json) declares its marketplace. Run /claude:plugin marketplace add <source> --scope project with the source the local config declares, or remove the plugin from the base config.",
  },
] satisfies readonly {
  readonly reported: string;
  readonly files: Readonly<Record<string, string>>;
  readonly cause: string;
}[];

for (const { reported, files, cause } of layerGapRows) {
  test(`LAYER-06: ${reported} declaring a plugin whose marketplace only the other layer declares reports one failure with the cause and plans nothing`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "layer-gap");
    await writeUnder(
      project.stateJsonPath,
      stateBytes("mp", "acme/tools", path.join(cwd, "clone"), []),
    );
    for (const [name, bytes] of Object.entries(files)) {
      await writeUnder(path.join(project.scopeRoot, name), bytes);
    }

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          `● ${reported} [project]\n` +
          `  ⊘ ${reported} (failed) {invalid manifest}\n` +
          `    cause: ${cause}\n\n` +
          "Reconcile pending: 1 failure",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

test("MSG-GR-3: a failed configuration block sorts among the plan blocks by name rather than trailing them", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "mixed-order");
  await writeUnder(project.baseConfigJsonPath, "{");
  await writeUnder(
    user.baseConfigJsonPath,
    configBytes("zzz-mp", "acme/z", [{ key: "pp@zzz-mp", enabled: true }]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
        "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
        "    cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n\n" +
        "● zzz-mp [user] (will add)\n  ● pp (will install)\n\n" +
        "Reconcile pending: 2 failures, 2 successes\n\n/claude:plugin apply to make these changes",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("APL-04 / D-14: a list whose only row is a source mismatch carries no apply trailer", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "mismatch-only");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/other", [{ key: "p1@mp", enabled: true }]),
  );
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "mp-root"), [{ name: "p1", skills: [] }]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n" +
        "⊘ mp [project] (failed) {source mismatch}\n\n" +
        "Reconcile pending: 1 failure",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("MIG-01: an absent base config plans against the state projection instead of an empty desired state", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: /claude:plugin apply has nothing to change." },
  ]);
  verifyBoundary();
});

test("MIG-01 / NFR-5: the pre-migration projection is read-only and never writes the base config", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-readonly");
  const recordedState = stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
    { name: "p1", skills: ["mp-p1-tool"] },
  ]);
  await writeUnder(project.stateJsonPath, recordedState);
  const expectedNotification = { message: "Pending: /claude:plugin apply has nothing to change." };
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [expectedNotification, expectedNotification]);
  assert.deepStrictEqual(await retryTree(project.scopeRoot), [
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  assert.strictEqual(await readFile(project.stateJsonPath, "utf8"), recordedState);
  verifyBoundary();
});

test("MIG-01 / D-20: a local-only marketplace merges over the state projection as a will-add header and adds no uninstalls", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-local");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  await writeUnder(project.localConfigJsonPath, configBytes("zzz-extra", "acme/extra", []));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● zzz-extra [project] (will add)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
    },
  ]);
  verifyBoundary();
});

test("LAYER-06 / MIG-01: before the first-run migration, a local layer missing the marketplace the migration declares reports the layer error", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-layer-gap");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  await writeUnder(
    project.localConfigJsonPath,
    JSON.stringify({ schemaVersion: 1, plugins: { "p1@mp": {} } }),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● claude-plugins.local.json [project]\n" +
        "  ⊘ claude-plugins.local.json (failed) {invalid manifest}\n" +
        "    cause: The local config (claude-plugins.local.json) declares p1@mp, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.\n\n" +
        "Reconcile pending: 1 failure",
      severity: "error",
    },
  ]);
  await assert.rejects(readFile(project.baseConfigJsonPath, "utf8"), { code: "ENOENT" });
  verifyBoundary();
});

test("FIX-02: the pending view leaves out what the local config declares, as the load's migration does", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-local-declared");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  await writeUnder(project.localConfigJsonPath, configBytes("mp", "acme/tools", []));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project]\n  ○ p1 v1.0.0 (will uninstall)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
    },
  ]);
  verifyBoundary();
});

/**
 * FSTAT-06 / D-66-04: stage a project scope whose marketplace `mp-github` is
 * RECORDED with a clone on disk, and whose plugin `cr` is DECLARED and enabled
 * but not yet recorded, so the planner emits one install. A `.lsp.json` in the
 * plugin root is a component kind the resolver cannot support, so the
 * no-network candidate resolve degrades and the row takes the partial modifier.
 */
async function stagePlannedInstall(
  cwd: string,
  locations: ScopedLocations,
  options: { readonly degrade: boolean },
): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const marketplaceRoot = path.join(locations.extensionRoot, "marketplaces", "mp-github");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.join(marketplaceRoot, "cr"), { recursive: true });
  if (options.degrade) {
    await writeUnder(path.join(marketplaceRoot, "cr", ".lsp.json"), "{}");
  }

  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: "mp-github",
      plugins: [{ name: "cr", source: "./cr", version: "1.0.0" }],
    }),
  );
  await writeUnder(
    locations.stateJsonPath,
    JSON.stringify({
      schemaVersion: 2,
      marketplaces: {
        "mp-github": {
          name: "mp-github",
          scope: "project",
          source: "acme/tools",
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {},
        },
      },
    }),
  );
  await writeUnder(
    locations.baseConfigJsonPath,
    configBytes("mp-github", "acme/tools", [{ key: "cr@mp-github", enabled: true }]),
  );
  return { marketplaceRoot, manifestPath };
}

// FSTAT-06: the pending preview resolves a planned install against the recorded
// marketplace's cached manifest, no-network. Only a candidate that both resolves
// and degrades takes the partial modifier; every way of failing to locate or
// resolve one leaves the plain token, because the preview must not assert a
// degrade it could not establish. D-66-05: no will-update analog exists.
const plannedInstallRows = [
  {
    condition: "a candidate that resolves with an unsupported component kind",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      await stagePlannedInstall(cwd, locations, { degrade: true });
    },
    rendered: "● cr (will partially install)",
    expectedMessage:
      "● mp-github [project]\n  ● cr (will partially install)\n\n" +
      "Reconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
  },
  {
    condition: "a candidate that resolves cleanly",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      await stagePlannedInstall(cwd, locations, { degrade: false });
    },
    rendered: "● cr (will install)",
    expectedMessage:
      "● mp-github [project]\n  ● cr (will install)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
  },
  {
    condition: "a marketplace that is declared but not recorded",
    stage: async (_cwd: string, locations: ScopedLocations): Promise<void> => {
      await writeUnder(
        locations.baseConfigJsonPath,
        configBytes("newmp", "acme/new", [{ key: "pp@newmp", enabled: true }]),
      );
    },
    rendered: "● pp (will install)",
    expectedMessage:
      "● newmp [project] (will add)\n  ● pp (will install)\n\nReconcile pending: 2 successes\n\n/claude:plugin apply to make these changes",
  },
  {
    condition: "a recorded manifest that does not parse",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      const { manifestPath } = await stagePlannedInstall(cwd, locations, { degrade: true });
      await writeFile(manifestPath, "{ not valid json at all", "utf8");
    },
    rendered: "● cr (will install)",
    expectedMessage:
      "● mp-github [project]\n  ● cr (will install)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
  },
  {
    condition: "a recorded manifest that omits the planned plugin",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      const { manifestPath } = await stagePlannedInstall(cwd, locations, { degrade: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp-github",
          plugins: [{ name: "other", source: "./other", version: "1.0.0" }],
        }),
        "utf8",
      );
    },
    rendered: "● cr (will install)",
    expectedMessage:
      "● mp-github [project]\n  ● cr (will install)\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
  },
] satisfies readonly {
  readonly condition: string;
  readonly stage: (cwd: string, locations: ScopedLocations) => Promise<void>;
  readonly rendered: string;
  readonly expectedMessage: string;
}[];

for (const { condition, stage, rendered, expectedMessage } of plannedInstallRows) {
  test(`FSTAT-06: a planned install with ${condition} renders "${rendered}"`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "planned-install");
    await stage(cwd, project);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// D-21 / LOAD-01 / MISS-01: pending computes the satisfaction verdict apply's
// read pass computes, so it lists the dependency disables and missing
// dependency installs apply makes, and nothing apply would not make.
// ---------------------------------------------------------------------------

interface OfferedPlugin {
  readonly version: string;
  readonly dependencies?: readonly string[];
}

interface RecordedDependencyPlugin {
  readonly version: string;
  readonly enabled?: boolean;
  /** LOAD-01: the check's own marker on a record it disabled. */
  readonly dependencyDisabled?: boolean;
}

interface DependencyScopeSeed {
  readonly offered: Readonly<Record<string, OfferedPlugin>>;
  readonly recorded: Readonly<Record<string, RecordedDependencyPlugin>>;
  readonly declared: readonly DeclaredPlugin[];
}

/**
 * Stage a project scope whose marketplace `tools` is recorded with its manifest
 * on disk, so the verdict reads each record's declarations from the manifest
 * entry. Every record is written in the canonical shape, so the load performs
 * no migration.
 */
async function stageDependencyScope(
  cwd: string,
  locations: ScopedLocations,
  seed: DependencyScopeSeed,
): Promise<{ readonly manifestPath: string }> {
  const marketplaceRoot = path.join(locations.extensionRoot, "marketplaces", "tools");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: "tools",
      plugins: Object.entries(seed.offered).map(([name, offered]) => ({
        name,
        source: `./${name}`,
        version: offered.version,
        ...(offered.dependencies !== undefined && { dependencies: offered.dependencies }),
      })),
    }),
  );
  await writeUnder(
    locations.stateJsonPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        marketplaces: {
          tools: {
            name: "tools",
            scope: "project",
            source: "acme/tools",
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: Object.fromEntries(
              Object.entries(seed.recorded).map(([name, recorded]) => [
                name,
                {
                  version: recorded.version,
                  resolvedSource: path.join(marketplaceRoot, name),
                  compatibility: {
                    installable: true,
                    notes: [],
                    supported: ["skills"],
                    unsupported: [],
                  },
                  resources: {
                    skills: [],
                    prompts: [],
                    agents: [],
                    mcpServers: [],
                    hooks: [],
                    workflows: [],
                  },
                  enabled: recorded.enabled ?? true,
                  ...(recorded.dependencyDisabled !== undefined && {
                    dependencyDisabled: recorded.dependencyDisabled,
                  }),
                  provenance: "explicit",
                  installedAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              ]),
            ),
          },
        },
      },
      null,
      2,
    ),
  );
  await writeUnder(locations.baseConfigJsonPath, configBytes("tools", "acme/tools", seed.declared));
  return { manifestPath };
}

/** `app` 2.0.0 requires `lib@^2.0.0`; the recorded `lib` is at `libVersion`. */
function appNeedingNewerLib(
  libVersion: string,
  app: Omit<RecordedDependencyPlugin, "version"> = {},
  appDeclaredEnabled = true,
): DependencyScopeSeed {
  return {
    offered: {
      app: { version: "2.0.0", dependencies: ["lib@^2.0.0"] },
      lib: { version: libVersion },
    },
    recorded: { app: { version: "2.0.0", ...app }, lib: { version: libVersion } },
    declared: [
      { key: "app@tools", enabled: appDeclaredEnabled },
      { key: "lib@tools", enabled: true },
    ],
  };
}

const PENDING_EMPTY = { message: "Pending: /claude:plugin apply has nothing to change." };

function pendingList(rows: readonly string[]): { readonly message: string } {
  const count = rows.length === 1 ? "1 success" : `${rows.length} successes`;
  return {
    message:
      `● tools [project]\n${rows.map((row) => `  ${row}\n`).join("")}\n` +
      `Reconcile pending: ${count}\n\n/claude:plugin apply to make these changes`,
  };
}

const dependencyRows = [
  {
    condition: "an enabled plugin whose declared dependency is too old",
    seed: appNeedingNewerLib("1.0.0"),
    expected: pendingList(["◍ app (will disable)"]),
  },
  {
    condition: "a plugin the user already disabled whose declared dependency is too old",
    seed: appNeedingNewerLib("1.0.0", { enabled: false }, false),
    expected: PENDING_EMPTY,
  },
  {
    condition: "a plugin the check holds down whose dependency is still too old",
    seed: appNeedingNewerLib("1.0.0", { enabled: false, dependencyDisabled: true }),
    expected: PENDING_EMPTY,
  },
  {
    condition: "a plugin the check holds down whose dependency is now satisfied",
    seed: appNeedingNewerLib("2.0.0", { enabled: false, dependencyDisabled: true }),
    expected: pendingList(["● app (will enable)"]),
  },
  {
    condition: "a recorded plugin whose declared dependency is not installed",
    seed: {
      offered: { app: { version: "1.0.0", dependencies: ["vault"] }, vault: { version: "1.0.0" } },
      recorded: { app: { version: "1.0.0" } },
      declared: [{ key: "app@tools", enabled: true }],
    },
    expected: pendingList(["● vault (will install)"]),
  },
  {
    condition: "a chain whose last link misses a dependency the install brings",
    seed: {
      offered: {
        app: { version: "1.0.0", dependencies: ["core"] },
        core: { version: "1.0.0", dependencies: ["vault"] },
        vault: { version: "1.0.0" },
      },
      recorded: { app: { version: "1.0.0" }, core: { version: "1.0.0" } },
      declared: [
        { key: "app@tools", enabled: true },
        { key: "core@tools", enabled: true },
      ],
    },
    expected: pendingList(["● vault (will install)"]),
  },
  {
    condition: "a plugin whose missing dependency is installed but whose other one stays too old",
    seed: {
      offered: {
        app: { version: "2.0.0", dependencies: ["vault", "lib@^2.0.0"] },
        lib: { version: "1.0.0" },
        vault: { version: "1.0.0" },
      },
      recorded: { app: { version: "2.0.0" }, lib: { version: "1.0.0" } },
      declared: [
        { key: "app@tools", enabled: true },
        { key: "lib@tools", enabled: true },
      ],
    },
    expected: pendingList(["● vault (will install)", "◍ app (will disable)"]),
  },
  {
    condition: "a dependency the user disabled, the config enables and the check holds down",
    seed: {
      offered: {
        app: { version: "1.0.0", dependencies: ["core"] },
        core: { version: "1.0.0", dependencies: ["vault"] },
        vault: { version: "1.0.0" },
      },
      recorded: {
        app: { version: "1.0.0" },
        core: { version: "1.0.0", enabled: false },
      },
      declared: [
        { key: "app@tools", enabled: true },
        { key: "core@tools", enabled: true },
      ],
    },
    expected: pendingList([
      "● vault (will install)",
      "◍ app (will disable)",
      "● core (will enable)",
    ]),
  },
] satisfies readonly {
  readonly condition: string;
  readonly seed: DependencyScopeSeed;
  readonly expected: { readonly message: string };
}[];

for (const { condition, seed, expected } of dependencyRows) {
  test(`D-21: pending previews what apply makes for ${condition}`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency");
    await stageDependencyScope(cwd, project, seed);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [expected]);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// APL-02 / D-10 / D-14: the catalog moves apply would make, each a
// `(will update)` row with the move's version arrow.
// ---------------------------------------------------------------------------

/**
 * Stage each offered plugin's directory, its own manifest declaring the
 * offered version and dependencies.
 */
async function stageOfferedPlugins(
  locations: ScopedLocations,
  offered: Readonly<Record<string, OfferedPlugin>>,
): Promise<void> {
  const marketplaceRoot = path.join(locations.extensionRoot, "marketplaces", "tools");
  await Promise.all(
    Object.entries(offered).map(([name, plugin]) =>
      writeUnder(
        path.join(marketplaceRoot, name, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          version: plugin.version,
          ...(plugin.dependencies !== undefined && { dependencies: plugin.dependencies }),
        }),
      ),
    ),
  );
}

const catalogMoveRows = [
  {
    condition: "a recorded plugin the catalog moved to a newer version",
    seed: {
      offered: { demo: { version: "1.1.0" } },
      recorded: { demo: { version: "1.0.0" } },
      declared: [{ key: "demo@tools", enabled: true }],
    },
    expected: pendingList(["● demo v1.0.0 → v1.1.0 (will update)"]),
  },
  {
    condition: "a recorded plugin the catalog moved that the config disables",
    seed: {
      offered: { demo: { version: "1.1.0" } },
      recorded: { demo: { version: "1.0.0" } },
      declared: [{ key: "demo@tools", enabled: false }],
    },
    expected: pendingList(["◍ demo (will disable)"]),
  },
  {
    condition: "a disabled plugin the config enables while the catalog moved it",
    seed: {
      offered: { demo: { version: "1.1.0" } },
      recorded: { demo: { version: "1.0.0", enabled: false } },
      declared: [{ key: "demo@tools", enabled: true }],
    },
    expected: pendingList(["● demo (will enable)", "● demo v1.0.0 → v1.1.0 (will update)"]),
  },
  {
    condition: "a recorded plugin at the catalog version",
    seed: {
      offered: { demo: { version: "1.0.0" } },
      recorded: { demo: { version: "1.0.0" } },
      declared: [{ key: "demo@tools", enabled: true }],
    },
    expected: PENDING_EMPTY,
  },
] satisfies readonly {
  readonly condition: string;
  readonly seed: DependencyScopeSeed;
  readonly expected: { readonly message: string };
}[];

for (const { condition, seed, expected } of catalogMoveRows) {
  test(`APL-02 / D-14: pending previews what apply makes for ${condition}`, async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "catalog-move");
    await stageDependencyScope(cwd, project, seed);
    await stageOfferedPlugins(project, seed.offered);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [expected]);
    verifyBoundary();
  });
}

test("APL-02 / D-14: composePendingReport counts a catalog move alone as a change apply makes", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "compose-move");
  const offered = { demo: { version: "1.1.0" } };
  await stageDependencyScope(cwd, project, {
    offered,
    recorded: { demo: { version: "1.0.0" } },
    declared: [{ key: "demo@tools", enabled: true }],
  });
  await stageOfferedPlugins(project, offered);

  // act
  const report = await composePendingReport({ cwd, scopes: ["project"] });

  // assert
  assert.deepStrictEqual(report, {
    marketplaces: [
      {
        name: "tools",
        scope: "project",
        plugins: [{ status: "will update", name: "demo", from: "1.0.0", to: "1.1.0" }],
      },
    ],
    retained: {},
    needsApply: true,
  });
});

// ---------------------------------------------------------------------------
// D-12 / D-23: a move a dependent's range does not admit is listed with the
// row `apply` reports for it, and asks for no apply.
// ---------------------------------------------------------------------------

/** `app` declares `lib@^1.0.0`; the catalog now offers `lib` 2.0.0. */
const LIB_PAST_APP_RANGE: DependencyScopeSeed = {
  offered: {
    app: { version: "1.0.0", dependencies: ["lib@^1.0.0"] },
    lib: { version: "2.0.0" },
  },
  recorded: { app: { version: "1.0.0" }, lib: { version: "1.0.0" } },
  declared: [
    { key: "app@tools", enabled: true },
    { key: "lib@tools", enabled: true },
  ],
};

test("D-12: pending lists a range-held move as update's warning hold row, with no apply trailer", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "range-hold");
  await stageDependencyScope(cwd, project, LIB_PAST_APP_RANGE);
  await stageOfferedPlugins(project, LIB_PAST_APP_RANGE.offered);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n\n" +
        "● tools [project]\n" +
        "  ⊘ lib v1.0.0 (skipped) {dependents constrain}\n" +
        '    cause: version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools"\n' +
        "\nReconcile pending: 1 warning",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("D-12 / D-24: pending lists a consent decline with the hint naming update --partial", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "consent-decline");
  const seed: DependencyScopeSeed = {
    offered: { demo: { version: "1.1.0" } },
    recorded: { demo: { version: "1.0.0" } },
    declared: [{ key: "demo@tools", enabled: true }],
  };
  await stageDependencyScope(cwd, project, seed);
  await stageOfferedPlugins(project, seed.offered);
  await writeUnder(
    path.join(project.extensionRoot, "marketplaces", "tools", "demo", "output-styles", "terse.md"),
    "# Terse\n",
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n\n" +
        "● tools [project]\n" +
        "  ● demo v1.0.0 (partially-upgradable) {unsupported component}\n" +
        "    Run update --partial on this plugin to update it with the supported components.\n" +
        "\nReconcile pending: 1 warning",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("D-12: composePendingReport does not count a range hold as a change apply makes", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "compose-hold");
  await stageDependencyScope(cwd, project, LIB_PAST_APP_RANGE);
  await stageOfferedPlugins(project, LIB_PAST_APP_RANGE.offered);

  // act
  const report = await composePendingReport({ cwd, scopes: ["project"] });

  // assert
  assert.deepStrictEqual(report, {
    marketplaces: [
      {
        name: "tools",
        scope: "project",
        plugins: [
          {
            status: "skipped",
            name: "lib",
            version: "1.0.0",
            reasons: ["dependents constrain"],
            cause: new Error(
              'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools"',
            ),
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
    retained: {},
    needsApply: false,
  });
});

test("D-05-07: a declarer whose manifest cannot be read plans no dependency row", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "dependency-unreadable");
  const { manifestPath } = await stageDependencyScope(cwd, project, {
    offered: { app: { version: "1.0.0", dependencies: ["vault"] } },
    recorded: { app: { version: "1.0.0" } },
    declared: [{ key: "app@tools", enabled: true }],
  });
  await writeFile(manifestPath, "{ not valid json at all", "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [PENDING_EMPTY]);
  verifyBoundary();
});

test("D-21 / NFR-5: previewing a dependency disable leaves state.json and the config byte-identical", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "dependency-read-only");
  await stageDependencyScope(cwd, project, appNeedingNewerLib("1.0.0"));
  const stateBefore = await readFile(project.stateJsonPath, "utf8");
  const configBefore = await readFile(project.baseConfigJsonPath, "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [pendingList(["◍ app (will disable)"])]);
  assert.strictEqual(await readFile(project.stateJsonPath, "utf8"), stateBefore);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), configBefore);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// WR-06: the retained workflow staging advisory.
//
// The staging sweeper deliberately keeps an aged tree whose `.previous/` still
// holds envelopes, because those bytes are the only surviving copy of the
// user's previous workflow scripts. The tree sits outside every scope root, so
// uninstall and a reload cannot reach it, so a command must name it.
// These cases pin that this command names it on BOTH of its arms, in the same
// bytes, once per invocation.
// ---------------------------------------------------------------------------

/** Two days: comfortably past the sweeper's one-day abandonment bound. */
const WELL_PAST_THE_STAGING_BOUND_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Plant the shape the sweeper keeps forever: an aged staging root whose
 * `.previous/` holds displaced envelopes. `workflowsStagingDir` is
 * scope-independent, so the bundle a case builds it from is immaterial.
 */
async function seedRetainedStagingTree(
  locations: ScopedLocations,
  name: string,
  envelopes: number,
): Promise<void> {
  const displaced = path.join(locations.workflowsStagingDir, name, ".previous");
  await mkdir(displaced, { recursive: true });
  for (let index = 0; index < envelopes; index += 1) {
    await writeFile(path.join(displaced, `acme_prev${index}.json`), `{"i":${index}}\n`, "utf8");
  }

  const stamp = new Date(Date.now() - WELL_PAST_THE_STAGING_BOUND_MS);
  await utimes(path.join(locations.workflowsStagingDir, name), stamp, stamp);
}

const RETAINED_LINE =
  "    retained workflow staging: staging-aaa (2 envelopes) under the workflows staging directory";

test("WR-06: the steady state names a retained workflow staging tree", async (t) => {
  // arrange
  // The steady-state reader is the one most likely to be carrying a retained
  // tree, and the arm they land on declares no fields of its own -- so this is
  // the arm an advisory threaded onto the cascade alone would miss entirely.
  const { cwd, user } = await createHermeticScopes(t, "retained-empty");
  await seedRetainedStagingTree(user, "staging-aaa", 2);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Pending: /claude:plugin apply has nothing to change.\n\n${RETAINED_LINE}` },
  ]);
  verifyBoundary();
});

test("WR-06: the cascade arm carries the identical retained-tree line", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "retained-cascade");
  await writeUnder(project.baseConfigJsonPath, configBytes("mp", "acme/tools", []));
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  await seedRetainedStagingTree(user, "staging-aaa", 2);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  // Byte-for-byte the same line the steady-state case above asserts: one render
  // site composes both arms, so the two cannot drift.
  assert.deepStrictEqual(notifications, [
    {
      message: `● mp [project]\n  ○ p1 v1.0.0 (will uninstall)\n\n${RETAINED_LINE}\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes`,
    },
  ]);
  verifyBoundary();
});

test("WR-06: renders the advisory once for an invocation that walks both scopes", async (t) => {
  // arrange
  // The staging directory is scope-independent while the scope fan-out is not,
  // so a scan run inside the per-scope loop would render this line twice.
  const { cwd, project, user } = await createHermeticScopes(t, "retained-fanout");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  await seedRetainedStagingTree(user, "staging-aaa", 2);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const readdirSpy = t.mock.method(fs, "readdir");
  syncBuiltinESMExports();
  t.after(() => {
    readdirSpy.mock.restore();
    syncBuiltinESMExports();
  });

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `● mp [project] (will add)\n  ● p-proj (will install)\n\n● mp [user] (will add)\n  ● p-user (will install)\n\n${RETAINED_LINE}\n\nReconcile pending: 4 successes\n\n/claude:plugin apply to make these changes`,
    },
  ]);
  assert.deepStrictEqual(
    readdirSpy.mock.calls
      .filter((call) => call.arguments[0] === user.workflowsStagingDir)
      .map((call) => call.arguments),
    [[user.workflowsStagingDir]],
  );
  verifyBoundary();
});

test("WR-06: two retained trees render two lines, sorted by directory name", async (t) => {
  // arrange
  // Seeded in reverse, and the second carries a single envelope so the singular
  // form is pinned alongside the ordering.
  const { cwd, user } = await createHermeticScopes(t, "retained-two");
  await seedRetainedStagingTree(user, "staging-zzz", 1);
  await seedRetainedStagingTree(user, "staging-aaa", 2);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: [
        "Pending: /claude:plugin apply has nothing to change.",
        "",
        RETAINED_LINE,
        "    retained workflow staging: staging-zzz (1 envelope) under the workflows staging directory",
      ].join("\n"),
    },
  ]);
  verifyBoundary();
});

test("WR-06 / DIFF-01: a retained tree still leaves two consecutive invocations byte-identical", async (t) => {
  // arrange
  const { cwd, user } = await createHermeticScopes(t, "retained-idempotent");
  await seedRetainedStagingTree(user, "staging-aaa", 2);
  const expected = {
    message: `Pending: /claude:plugin apply has nothing to change.\n\n${RETAINED_LINE}`,
  };
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [expected, expected]);
  // The recovery copies themselves: naming them must not move them.
  assert.deepStrictEqual(
    await readdir(path.join(user.workflowsStagingDir, "staging-aaa", ".previous")),
    ["acme_prev0.json", "acme_prev1.json"],
  );
  verifyBoundary();
});

test("NFR-5: naming retained trees never creates the workflows staging directory", async (t) => {
  // arrange
  // No staging tree at all, so the scan meets an absent directory. A scan that
  // created it on the way to answering "nothing is retained" would make a
  // documented no-write surface write.
  const { cwd, user } = await createHermeticScopes(t, "retained-absent");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: /claude:plugin apply has nothing to change." },
  ]);
  await assert.rejects(readdir(user.workflowsHomeDir), { code: "ENOENT" });
  verifyBoundary();
});

test("WR-06: a staging directory that cannot be read leaves the command's own output unchanged", async (t) => {
  // arrange
  // A plain file where the staging directory belongs: the read fails with an
  // errno the scan cannot interpret, and the command the user actually asked
  // for still renders exactly what it renders with no retained tree at all.
  const { cwd, user } = await createHermeticScopes(t, "retained-unreadable");
  await mkdir(user.workflowsHomeDir, { recursive: true });
  await writeFile(user.workflowsStagingDir, "not a directory", "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await pendingReconcile({ ctx, run: runWithNothingLoaded(), cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: /claude:plugin apply has nothing to change." },
  ]);
  verifyBoundary();
});

test("D-05: composePendingReport returns an empty report when no scope has pending work", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "compose-empty");

  // act
  const report = await composePendingReport({ cwd, scopes: ["project", "user"] });

  // assert
  assert.deepStrictEqual(report, { marketplaces: [], retained: {}, needsApply: false });
});

test("D-06: composePendingReport returns the change apply would make and asks for apply", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "compose-change");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );

  // act
  const report = await composePendingReport({ cwd, scopes: ["project", "user"] });

  // assert
  assert.deepStrictEqual(report, {
    marketplaces: [
      {
        name: "mp",
        scope: "project",
        status: "will add",
        severity: "info",
        needsReload: false,
        plugins: [{ status: "will install", name: "p-proj" }],
      },
    ],
    retained: {},
    needsApply: true,
  });
});

test("D-06: composePendingReport reads only the scopes it is given", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "compose-scopes");
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(user.baseConfigJsonPath, "{");

  // act
  const userOnly = await composePendingReport({ cwd, scopes: ["user"] });
  const none = await composePendingReport({ cwd, scopes: [] });

  // assert
  assert.deepStrictEqual(
    userOnly.marketplaces.map(({ name, scope }) => ({ name, scope })),
    [{ name: "claude-plugins.json", scope: "user" }],
  );
  assert.equal(userOnly.needsApply, false);
  assert.deepStrictEqual(none, { marketplaces: [], retained: {}, needsApply: false });
});

test("I5 / T-53-02-02: an unreadable config's cause names its basename and no absolute path", async (t) => {
  // arrange
  // A mode does not bind uid 0, so the EACCES never happens under root.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("permission cases cannot run as root");
  }

  const { cwd, project } = await createHermeticScopes(t, "compose-unreadable");
  await writeUnder(project.baseConfigJsonPath, configBytes("mp", "acme/tools", []));
  await chmod(project.baseConfigJsonPath, 0o000);

  // act
  const report = await composePendingReport({ cwd, scopes: ["project"] });

  // assert
  assert.deepStrictEqual(report.marketplaces, [
    {
      name: "claude-plugins.json",
      scope: "project",
      status: "failed",
      reasons: ["invalid manifest"],
      severity: "error",
      plugins: [
        {
          status: "failed",
          name: "claude-plugins.json",
          reasons: ["invalid manifest"],
          cause: new Error("read failed: EACCES: permission denied, open 'claude-plugins.json'"),
          severity: "error",
          needsReload: false,
        },
      ],
    },
  ]);
});
