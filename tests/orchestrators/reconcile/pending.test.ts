// Owner suite for orchestrators/reconcile/pending.ts.
//
// D-115-03: pending reads the real merged config and the real state off a
// case-owned temporary tree and delegates the row projection, so every case
// shapes its inputs on disk rather than injecting a seam. The only doubles are
// the two Pi surfaces the orchestrator hands to `notify`.
//
// IL-2 is proved by sizing the notification boundary: each case promises the
// exact number of emissions it expects, so a second `ctx.ui.notify` call throws
// where it is made instead of being counted afterwards.
//
// Every seeded state.json is written in the canonical shape (`enabled` present,
// `resources.hooks` present, both marketplace paths present), so `loadState`
// performs no legacy migration and fires no best-effort background save. That
// keeps the IL-3 legacy-migration warning off standard error and keeps the
// no-mutation assertions from racing a fire-and-forget write.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { pendingReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createNotificationBoundary } from "../../helpers/notification-boundary.ts";
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
  const cwd = await mkdtemp(path.join(tmpdir(), `pending-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `pending-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { force: true, recursive: true });
    await rm(home, { force: true, recursive: true });
  });
  process.env.HOME = home;
  // SC-1: getAgentDir() reads PI_CODING_AGENT_DIR before homedir(), so an
  // environment that sets it would defeat the hermetic HOME above.
  delete process.env.PI_CODING_AGENT_DIR;
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
                },
                enabled: true,
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
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: next reload will apply 0 actions." },
  ]);
  verifyBoundary();
});

test("MSG-GR-3: an omitted scope walks both scopes and orders a shared marketplace name project before user", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "fanout");
  await writeUnder(
    project.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project]\n  ● p-proj (will install)\n\n● mp [user]\n  ● p-user (will install)",
    },
  ]);
  verifyBoundary();
});

test("an explicit user scope reports the user scope's pending work and never reads the project scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "user-only");
  await writeUnder(
    project.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd, scope: "user" });

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● mp [user]\n  ● p-user (will install)" }]);
  verifyBoundary();
});

test("an explicit project scope reports the project scope's pending work and never reads the user scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "project-only");
  await writeUnder(
    project.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-proj@mp", enabled: true }]),
  );
  await writeUnder(
    user.configJsonPath,
    configBytes("mp", "acme/tools", [{ key: "p-user@mp", enabled: true }]),
  );
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● mp [project]\n  ● p-proj (will install)" }]);
  verifyBoundary();
});

test("DIFF-01 / NFR-5: a repeated invocation emits the same notification and leaves both scope roots byte-identical", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "idempotent");
  const declaredConfig = configBytes("mp", "acme/tools", []);
  const recordedState = stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
    { name: "p1", skills: ["mp-p1-tool"] },
  ]);
  await writeUnder(project.configJsonPath, declaredConfig);
  await writeUnder(project.stateJsonPath, recordedState);
  const expectedNotification = { message: "● mp [project]\n  ○ p1 (will uninstall)" };
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 4);

  // act
  await pendingReconcile({ ctx, pi, cwd });
  await pendingReconcile({ ctx, pi, cwd });

  // assert
  assert.deepStrictEqual(notifications, [expectedNotification, expectedNotification]);
  assert.deepStrictEqual(await retryTree(project.scopeRoot), [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  assert.deepStrictEqual(await retryTree(user.scopeRoot), []);
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), declaredConfig);
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
  test(`CFG-03: a malformed ${reported} reports its basename as a failed block and plans nothing for that scope`, async (t) => {
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

    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

    // act
    await pendingReconcile({ ctx, pi, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${reported} [project] (failed) {invalid manifest}`,
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
    await writeUnder(project.configJsonPath, configBytes("mp", "acme/tools", []));
    await writeUnder(project.stateJsonPath, bytes);
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

    // act
    await pendingReconcile({ ctx, pi, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ state.json [project] (failed) {${reason}}`,
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

test("MSG-GR-3: a failed configuration block sorts among the plan blocks by name rather than trailing them", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "mixed-order");
  await writeUnder(project.configJsonPath, "{");
  await writeUnder(
    user.configJsonPath,
    configBytes("zzz-mp", "acme/z", [{ key: "pp@zzz-mp", enabled: true }]),
  );
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n" +
        "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n\n" +
        "● zzz-mp [user]\n  ● pp (will install)",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("MIG-01: an absent base configuration plans against the state projection instead of an empty desired state", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: next reload will apply 0 actions." },
  ]);
  verifyBoundary();
});

test("MIG-01 / NFR-5: the pre-migration projection is read-only and never writes the base configuration file", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-readonly");
  const recordedState = stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
    { name: "p1", skills: ["mp-p1-tool"] },
  ]);
  await writeUnder(project.stateJsonPath, recordedState);
  const expectedNotification = { message: "Pending: next reload will apply 0 actions." };
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 4);

  // act
  await pendingReconcile({ ctx, pi, cwd, scope: "project" });
  await pendingReconcile({ ctx, pi, cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [expectedNotification, expectedNotification]);
  assert.deepStrictEqual(await retryTree(project.scopeRoot), [
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  assert.strictEqual(await readFile(project.stateJsonPath, "utf8"), recordedState);
  verifyBoundary();
});

test("MIG-01: a local-only marketplace merges over the state projection and adds no uninstalls", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "premigration-local");
  await writeUnder(
    project.stateJsonPath,
    stateBytes("mp", "acme/tools", path.join(cwd, "clone"), [
      { name: "p1", skills: ["mp-p1-tool"] },
    ]),
  );
  await writeUnder(project.configLocalJsonPath, configBytes("zzz-extra", "acme/extra", []));
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

  // act
  await pendingReconcile({ ctx, pi, cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "Pending: next reload will apply 0 actions." },
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
    locations.configJsonPath,
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
    expectedMessage: "● mp-github [project]\n  ● cr (will partially install)",
  },
  {
    condition: "a candidate that resolves cleanly",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      await stagePlannedInstall(cwd, locations, { degrade: false });
    },
    rendered: "● cr (will install)",
    expectedMessage: "● mp-github [project]\n  ● cr (will install)",
  },
  {
    condition: "a marketplace that is declared but not recorded",
    stage: async (_cwd: string, locations: ScopedLocations): Promise<void> => {
      await writeUnder(
        locations.configJsonPath,
        configBytes("newmp", "acme/new", [{ key: "pp@newmp", enabled: true }]),
      );
    },
    rendered: "● pp (will install)",
    expectedMessage: "● newmp [project]\n  ● pp (will install)",
  },
  {
    condition: "a recorded manifest that does not parse",
    stage: async (cwd: string, locations: ScopedLocations): Promise<void> => {
      const { manifestPath } = await stagePlannedInstall(cwd, locations, { degrade: true });
      await writeFile(manifestPath, "{ not valid json at all", "utf8");
    },
    rendered: "● cr (will install)",
    expectedMessage: "● mp-github [project]\n  ● cr (will install)",
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
    expectedMessage: "● mp-github [project]\n  ● cr (will install)",
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);

    // act
    await pendingReconcile({ ctx, pi, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    verifyBoundary();
  });
}
