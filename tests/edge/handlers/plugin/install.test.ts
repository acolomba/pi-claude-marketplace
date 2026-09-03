// Owner for edge/handlers/plugin/install.ts (MOD-09).
//
// This shim carries the largest flag matrix in the handler tier: one plugin
// reference, two catalog-derived downstream booleans (`--map-model`,
// `--partial`), the scope-target flag, and the global scope flag. It runs TWO
// long-flag scanners in sequence -- the shared `extractLocalFlag`, then
// `parseMapModelArgs`'s own positional scan -- and each has its own rejection
// channel.
//
// Which parser a module calls decides its arity and flag answers, so all of the
// following were measured against the real module before a case was written:
//   * the handler's own `nonFlagPositionals.length !== 1` guard rejects ZERO,
//     TWO and THREE references with one sentence, so both halves of the arity
//     obligation hold here;
//   * the scope-target flag is ACCEPTED beside a scope flag. `extractLocalFlag`
//     consumes `--scope <value>` as a downstream-owned pair and filters only the
//     scope-target token, so BOTH members reach the workflow -- the scope
//     narrows the record and the flag moves the declaration to the override
//     layer;
//   * a quoted long flag survives the FIRST scan (which splits on whitespace and
//     sees a token opening with a quote character) and is claimed by the SECOND
//     (which runs after `parseArgs`'s quote-stripping tokenizer). That is one of
//     the two routes into `install.ts:57-59`; an unrecognised scope value is the
//     other, because the tokenizer's throw is caught inside the same shared
//     parse and surfaces as the same `undefined`.
//
// Coverage cannot see a data field, so every flag is classified by what it
// changes and each VALUE-carrying member is pinned against a hand-authored
// expectation rather than left to a branch count:
//   * `--map-model` -> `mapModel: true`, observed as the `model:` line the
//     generated agent frontmatter carries (AG-7 is opt-in: absent means the
//     field is omitted entirely);
//   * `--partial` -> `partial: true`, observed as whether a partially-available
//     plugin materialises at all (D-65-03);
//   * the scope-target flag -> `local: true`, observed as which of the scope's
//     two physical config files holds the declaration (WB-01 / CFG-02);
//   * `--scope` -> the scope member, observed as which scope root holds the
//     record, with the OMITTED case pinned to the user scope default;
//   * `applyDefaultEnabled: true` is forwarded UNCONDITIONALLY -- no flag turns
//     it off and no branch selects it, so the only discriminating observation is
//     the enabled state a plugin declaring `defaultEnabled: false` lands in
//     (DFEN-04 / D-102-03).
//
// D-116-05 (O3) places this handler in Group C: `installPlugin` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as the
// materialised footprint the workflow leaves in the hermetic tree -- both
// scopes' install records, both scopes' base and override config layers, and the
// generated agent files -- compared as ONE whole value, which is what turns
// "which scope, which layer, which member" into a measurement. The delegating
// cases deliberately do NOT assert the notification body: that value belongs to
// tests/orchestrators/plugin/install.test.ts, and re-deriving it here would
// restate a fact another pair owns at full direct coverage.
//
// The negative half of D-116-06 is proven in full. Every rejecting case sizes
// the boundary at one emission, zero probes, and NO stated `cwd`, seeds both
// scopes so a workflow that did run would have a marketplace to install from,
// compares the whole notification list, and asserts an empty footprint beside
// `verifyBoundary()`.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the three paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command that MATERIALISES reads `ctx.ui` once, `ctx.cwd`
//     once, and `pi.getAllTools()` FOUR times;
//   * a delegating command that is refused by the install gate, or that lands
//     disabled, reads `pi.getAllTools()` TWICE.
// The count is a property of the emission the workflow reaches, not of the
// module, so it is stated per row rather than shared.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope
// and `<HOME>/.pi/agent` for the user scope, with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1). Each
// scope declares the SAME three plugins at a different version, so a record
// written to the wrong scope is visible in the footprint.
//
// The git transport door (`https.request`) is replaced by a fail-fast throw for
// hermeticity. No zero is asserted over it: every fixture here is a path source,
// which never reaches the transport with or without any flag, so an asserted
// zero could not fail and would prove the fixture rather than the module.
//
// This pair makes no exhaustiveness claim: `edge/handlers/plugin/install.ts`
// contains no `switch` and no closed-union dispatch, so a missing-arm plant has
// no target here. No case asserts the absence of direct process output (ESLint
// and fallow own that), none re-proves the shared flag scan owned by
// tests/edge/handlers/shared.test.ts, none re-proves the map-model parse owned
// by tests/edge/handlers/plugin/shared.test.ts, none restates the tokenizer
// diagnostics owned by tests/edge/args.test.ts, and none re-pins the catalog's
// per-verb flag sets owned by tests/edge/flag-catalog.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { SCOPE_TARGET_FLAG } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { makeInstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts";
import { loadConfig } from "../../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { loadState } from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { ScopeConfig } from "../../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * The two downstream booleans as a user types them. Written out rather than
 * taken positionally off the catalog's pass-through derivation: the two names
 * are NOT interchangeable here (one selects the install gate, the other the
 * generated agent's model field), so a positional read would silently swap the
 * matrix's two behavior columns if the catalog order changed, and a read by name
 * is the literal with extra steps. The scope-target flag has no such hazard --
 * the catalog exports it as a single named constant, so it is taken from there.
 */
const MAP_MODEL_FLAG = "--map-model";
const PARTIAL_FLAG = "--partial";

/** The frontmatter field the AG-7 mapping emits, and the prefix that finds it. */
const MODEL_FIELD_PREFIX = "model: ";

const SKILL_SOURCE = "---\nname: tool\ndescription: A tool skill.\n---\n\nBody.\n";

/**
 * One agent per plugin, declaring a source model the AG-7 table maps. The
 * mapping is opt-in, so this file is what makes `--map-model` observable.
 */
const AGENT_SOURCE =
  "---\nname: scout\ndescription: A scout agent.\nmodel: sonnet\ntools: Read\n---\n\nScout body.\n";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared and the git transport door replaced by a
 * fail-fast throw. Removal and both environment restores are registered before
 * the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-install-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-install-${label}-home-`));
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

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  t.mock.method(https, "request", (): never => {
    throw new Error("install must not open a network connection for a path source");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
  };
}

/** One plugin source tree: a manifest, one skill, and one model-bearing agent. */
async function seedPlugin(
  marketplaceRoot: string,
  name: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, name);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify(manifest),
    "utf8",
  );
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), SKILL_SOURCE, "utf8");
  await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
  await writeFile(path.join(pluginRoot, "agents", "scout.md"), AGENT_SOURCE, "utf8");
}

/**
 * Record the `mp` marketplace in one scope and materialise the tree it points
 * at. `alpha` resolves installable; `degraded` declares an experimental
 * component kind so it resolves partially-available and needs the install gate
 * widened; `optout` declares itself off by default.
 */
async function seedScope(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  version: string,
): Promise<void> {
  const marketplaceRoot = path.join(workspace.cwd, `mp-src-${scope}`);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      owner: { name: "seed-owner" },
      plugins: [
        { name: "alpha", source: "./alpha" },
        { name: "degraded", source: "./degraded" },
        { name: "optout", source: "./optout" },
      ],
    }),
    "utf8",
  );
  await seedPlugin(marketplaceRoot, "alpha", { name: "alpha", version });
  await seedPlugin(marketplaceRoot, "degraded", {
    name: "degraded",
    version,
    experimental: { themes: "./themes" },
  });
  await seedPlugin(marketplaceRoot, "optout", { name: "optout", version, defaultEnabled: false });
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), "mp", {
    name: "mp",
    scope,
    source: { kind: "path", raw: `./mp-src-${scope}`, logical: `./mp-src-${scope}` },
    addedFromCwd: workspace.cwd,
    manifestPath,
    marketplaceRoot,
    plugins: {},
  });
}

/**
 * Both scopes declare the same marketplace and the same three plugins, at a
 * different version per scope, so a record written to the wrong scope root is
 * readable off the footprint rather than merely absent from the right one.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedScope(workspace, "project", workspace.projectRoot, "1.0.0");
  await seedScope(workspace, "user", workspace.userRoot, "2.0.0");
}

/** The fields of a persisted install record that a flag can move. */
interface InstallRecordProjection {
  readonly plugin: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly installable: boolean;
  readonly unsupported: readonly string[];
  readonly skills: readonly string[];
  readonly agents: readonly string[];
}

/** One generated agent file, carrying its mapped model only when one was emitted. */
interface GeneratedAgentProjection {
  readonly file: string;
  readonly model?: string;
}

interface ScopeFootprint {
  readonly records: readonly InstallRecordProjection[];
  readonly base: ScopeConfig | undefined;
  readonly local: ScopeConfig | undefined;
  readonly agents: readonly GeneratedAgentProjection[];
}

interface Footprint {
  readonly project: ScopeFootprint;
  readonly user: ScopeFootprint;
}

/** The declarative layer at one path, or undefined when no file was written. */
async function readConfigLayer(filePath: string): Promise<ScopeConfig | undefined> {
  const result = await loadConfig(filePath);
  return result.status === "valid" ? result.config : undefined;
}

async function readGeneratedAgents(scopeRoot: string): Promise<GeneratedAgentProjection[]> {
  const agentsDir = path.join(scopeRoot, "agents");
  let files: string[];
  try {
    files = (await readdir(agentsDir)).sort();
  } catch {
    return [];
  }

  const projected: GeneratedAgentProjection[] = [];
  for (const file of files) {
    const text = await readFile(path.join(agentsDir, file), "utf8");
    const modelLine = text.split("\n").find((line) => line.startsWith(MODEL_FIELD_PREFIX));
    projected.push(
      modelLine === undefined
        ? { file }
        : { file, model: modelLine.slice(MODEL_FIELD_PREFIX.length) },
    );
  }

  return projected;
}

async function readScopeFootprint(scopeRoot: string): Promise<ScopeFootprint> {
  const state = await loadState(path.join(scopeRoot, "pi-claude-marketplace"));
  const records = Object.entries(state.marketplaces["mp"]?.plugins ?? {})
    .map(([plugin, record]) => ({
      plugin,
      version: record.version,
      enabled: record.enabled,
      installable: record.compatibility.installable,
      unsupported: record.compatibility.unsupported,
      skills: record.resources.skills,
      agents: record.resources.agents,
    }))
    .sort((a, b) => a.plugin.localeCompare(b.plugin));

  return {
    records,
    base: await readConfigLayer(path.join(scopeRoot, "claude-plugins.json")),
    local: await readConfigLayer(path.join(scopeRoot, "claude-plugins.local.json")),
    agents: await readGeneratedAgents(scopeRoot),
  };
}

/**
 * Everything the install could have left behind, in both scopes, as one value.
 * A whole-value comparison catches a record or a declaration that landed in the
 * wrong scope or the wrong layer; separate existence checks do not.
 */
async function readFootprint(workspace: HermeticWorkspace): Promise<Footprint> {
  return {
    project: await readScopeFootprint(workspace.projectRoot),
    user: await readScopeFootprint(workspace.userRoot),
  };
}

const EMPTY_SCOPE: ScopeFootprint = { records: [], base: undefined, local: undefined, agents: [] };

const NOTHING_MATERIALIZED: Footprint = { project: EMPTY_SCOPE, user: EMPTY_SCOPE };

const ALPHA_AGENT_FILE = "pi-claude-marketplace-alpha-scout.md";
const DEGRADED_AGENT_FILE = "pi-claude-marketplace-degraded-scout.md";
const MAPPED_MODEL = "anthropic/claude-sonnet-4-6";

const ALPHA_USER_RECORD: InstallRecordProjection = {
  plugin: "alpha",
  version: "2.0.0",
  enabled: true,
  installable: true,
  unsupported: [],
  skills: ["alpha-tool"],
  agents: ["pi-claude-marketplace-alpha-scout"],
};

const ALPHA_PROJECT_RECORD: InstallRecordProjection = { ...ALPHA_USER_RECORD, version: "1.0.0" };

const ALPHA_USER_DECLARATION: ScopeConfig = {
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src-user" } },
  plugins: { "alpha@mp": {} },
};

const ALPHA_PROJECT_DECLARATION: ScopeConfig = {
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src-project" } },
  plugins: { "alpha@mp": {} },
};

const DEGRADED_USER_RECORD: InstallRecordProjection = {
  plugin: "degraded",
  version: "2.0.0",
  enabled: true,
  installable: false,
  unsupported: ["themes"],
  skills: ["degraded-tool"],
  agents: ["pi-claude-marketplace-degraded-scout"],
};

const DEGRADED_USER_DECLARATION: ScopeConfig = {
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src-user" } },
  plugins: { "degraded@mp": {} },
};

// ---------------------------------------------------------------------------
// The flag matrix: all four combinations of the two downstream booleans.
// ---------------------------------------------------------------------------

for (const { args, expectedFootprint, label, summary, toolProbes } of [
  {
    args: "degraded@mp",
    label: "matrix-neither",
    summary: "neither downstream flag",
    toolProbes: 2,
    expectedFootprint: NOTHING_MATERIALIZED,
  },
  {
    args: `degraded@mp ${MAP_MODEL_FLAG}`,
    label: "matrix-map-model",
    summary: "the model-mapping flag alone",
    toolProbes: 2,
    expectedFootprint: NOTHING_MATERIALIZED,
  },
  {
    args: `degraded@mp ${PARTIAL_FLAG}`,
    label: "matrix-partial",
    summary: "the gate-widening flag alone",
    toolProbes: 4,
    expectedFootprint: {
      project: EMPTY_SCOPE,
      user: {
        records: [DEGRADED_USER_RECORD],
        base: DEGRADED_USER_DECLARATION,
        local: undefined,
        agents: [{ file: DEGRADED_AGENT_FILE }],
      },
    },
  },
  {
    args: `degraded@mp ${PARTIAL_FLAG} ${MAP_MODEL_FLAG}`,
    label: "matrix-both",
    summary: "both downstream flags",
    toolProbes: 4,
    expectedFootprint: {
      project: EMPTY_SCOPE,
      user: {
        records: [DEGRADED_USER_RECORD],
        base: DEGRADED_USER_DECLARATION,
        local: undefined,
        agents: [{ file: DEGRADED_AGENT_FILE, model: MAPPED_MODEL }],
      },
    },
  },
] satisfies readonly {
  args: string;
  expectedFootprint: Footprint;
  label: string;
  summary: string;
  toolProbes: number;
}[]) {
  test(`forwards ${summary} to the install workflow, leaving the unsupplied one off (D-65-05)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, toolProbes, {
      value: workspace.cwd,
      reads: 1,
    });
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope member, and the default an omitted scope flag reaches the workflow
// with.
// ---------------------------------------------------------------------------

for (const { args, expectedFootprint, label, summary } of [
  {
    args: "alpha@mp",
    label: "scope-omitted",
    summary: "an omitted scope flag reaches the workflow as the user scope",
    expectedFootprint: {
      project: EMPTY_SCOPE,
      user: {
        records: [ALPHA_USER_RECORD],
        base: ALPHA_USER_DECLARATION,
        local: undefined,
        agents: [{ file: ALPHA_AGENT_FILE }],
      },
    },
  },
  {
    args: "alpha@mp --scope user",
    label: "scope-user",
    summary: "a supplied user scope reaches the workflow unchanged",
    expectedFootprint: {
      project: EMPTY_SCOPE,
      user: {
        records: [ALPHA_USER_RECORD],
        base: ALPHA_USER_DECLARATION,
        local: undefined,
        agents: [{ file: ALPHA_AGENT_FILE }],
      },
    },
  },
  {
    args: "alpha@mp --scope project",
    label: "scope-project",
    summary: "a supplied project scope reaches the workflow unchanged",
    expectedFootprint: {
      project: {
        records: [ALPHA_PROJECT_RECORD],
        base: ALPHA_PROJECT_DECLARATION,
        local: undefined,
        agents: [{ file: ALPHA_AGENT_FILE }],
      },
      user: EMPTY_SCOPE,
    },
  },
] satisfies readonly {
  args: string;
  expectedFootprint: Footprint;
  label: string;
  summary: string;
}[]) {
  test(`records the install where ${summary} (SC-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope-target flag: which physical config layer holds the declaration.
// ---------------------------------------------------------------------------

for (const { args, expectedAgents, label, position } of [
  {
    args: `${SCOPE_TARGET_FLAG} alpha@mp`,
    label: "target-before",
    position: "before the reference",
    expectedAgents: [{ file: ALPHA_AGENT_FILE }],
  },
  {
    args: `alpha@mp ${SCOPE_TARGET_FLAG}`,
    label: "target-after",
    position: "after the reference",
    expectedAgents: [{ file: ALPHA_AGENT_FILE }],
  },
  {
    args: `alpha@mp ${MAP_MODEL_FLAG} ${SCOPE_TARGET_FLAG} ${PARTIAL_FLAG}`,
    label: "target-between",
    position: "between the two downstream flags",
    expectedAgents: [{ file: ALPHA_AGENT_FILE, model: MAPPED_MODEL }],
  },
] satisfies readonly {
  args: string;
  expectedAgents: readonly GeneratedAgentProjection[];
  label: string;
  position: string;
}[]) {
  test(`writes the declaration to the override layer when the scope-target flag is supplied ${position} (WB-01)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), {
      project: EMPTY_SCOPE,
      user: {
        records: [ALPHA_USER_RECORD],
        base: undefined,
        local: ALPHA_USER_DECLARATION,
        agents: expectedAgents,
      },
    } satisfies Footprint);
    verifyBoundary();
  });
}

test("honors a scope flag and the scope-target flag supplied together, narrowing the scope and moving the layer (WB-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "both-selectors");
  await seedBothScopes(workspace);
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
    value: workspace.cwd,
    reads: 1,
  });
  const installHandler = makeInstallHandler(pi);

  // act
  await installHandler(`alpha@mp --scope project ${SCOPE_TARGET_FLAG}`, ctx);

  // assert
  assert.deepStrictEqual(await readFootprint(workspace), {
    project: {
      records: [ALPHA_PROJECT_RECORD],
      base: undefined,
      local: ALPHA_PROJECT_DECLARATION,
      agents: [{ file: ALPHA_AGENT_FILE }],
    },
    user: EMPTY_SCOPE,
  } satisfies Footprint);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// The unconditional default-enabled member.
// ---------------------------------------------------------------------------

test("records a plugin declaring itself off by default as disabled, because the default-enabled member is always forwarded (DFEN-04)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "default-enabled");
  await seedBothScopes(workspace);
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const installHandler = makeInstallHandler(pi);

  // act
  await installHandler("optout@mp", ctx);

  // assert
  assert.deepStrictEqual(await readFootprint(workspace), {
    project: EMPTY_SCOPE,
    user: {
      records: [
        {
          plugin: "optout",
          version: "2.0.0",
          enabled: false,
          installable: true,
          unsupported: [],
          skills: ["optout-tool"],
          agents: ["pi-claude-marketplace-optout-scout"],
        },
      ],
      base: {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp-src-user" } },
        plugins: { "optout@mp": { enabled: false } },
      },
      local: undefined,
      agents: [],
    },
  } satisfies Footprint);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// Rejections: nothing materialises and the workflow is never reached.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "", label: "arity-zero", summary: "no reference at all" },
  {
    args: `${MAP_MODEL_FLAG} ${PARTIAL_FLAG}`,
    label: "arity-flags-only",
    summary: "both downstream flags with no reference",
  },
  { args: "alpha@mp degraded@mp", label: "arity-two", summary: "two references" },
  {
    args: "alpha@mp degraded@mp optout@mp",
    label: "arity-three",
    summary: "three references",
  },
]) {
  test(`rejects ${summary} with the exactly-one-argument sentence and never reaches the install workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "install requires exactly one <plugin>@<marketplace> argument.\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_MATERIALIZED);
    verifyBoundary();
  });
}

for (const { args, expectedMessage, label, summary } of [
  {
    args: "no-at-sign",
    label: "ref-no-separator",
    summary: "a reference carrying no separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "no-at-sign".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  },
  {
    args: "@mp",
    label: "ref-leading-separator",
    summary: "a reference opening at the separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "@mp".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  },
  {
    args: "alpha@",
    label: "ref-trailing-separator",
    summary: "a reference ending at the separator",
    expectedMessage:
      'Invalid <plugin>@<marketplace> ref: "alpha@".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  },
]) {
  test(`names ${summary} verbatim and never reaches the install workflow (PI-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_MATERIALIZED);
    verifyBoundary();
  });
}

test("names an unrecognised long flag the first scan claims and never reaches the install workflow (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "unknown-first-scan");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const installHandler = makeInstallHandler(pi);

  // act
  await installHandler("alpha@mp --frobnicate", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_MATERIALIZED);
  verifyBoundary();
});

test("names an unrecognised long flag that survives the first scan and is claimed by the second, and never reaches the install workflow (D-116-06)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "unknown-second-scan");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const installHandler = makeInstallHandler(pi);

  // act
  await installHandler('alpha@mp "--frobnicate"', ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        'Unknown flag: "--frobnicate".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_MATERIALIZED);
  verifyBoundary();
});

for (const { args, expectedMessage, label, summary } of [
  {
    args: "alpha@mp --scope bogus",
    label: "scope-value-ordinary",
    summary: "an ordinary token in the scope-value position",
    expectedMessage:
      'Invalid --scope value: "bogus". Must be "user" or "project".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  },
  {
    args: "alpha@mp --scope --frobnicate",
    label: "scope-value-long-flag",
    summary: "a long flag in the scope-value position",
    expectedMessage:
      'Invalid --scope value: "--frobnicate". Must be "user" or "project".\n\nUsage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]',
  },
]) {
  test(`carries the tokenizer's own sentence for ${summary} and never reaches the install workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const installHandler = makeInstallHandler(pi);

    // act
    await installHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_MATERIALIZED);
    verifyBoundary();
  });
}
