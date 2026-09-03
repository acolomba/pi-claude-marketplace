// Owner for edge/handlers/plugin/update.ts (MOD-09).
//
// This shim is the only one that crosses THREE TARGET FORMS with a flag
// matrix: no positional selects every installed plugin, a leading-separator
// reference selects one marketplace, and a `<plugin>@<marketplace>` reference
// selects one plugin. The same two catalog-derived downstream booleans
// (`--map-model`, `--partial`), the scope-target flag and the global scope flag
// ride all three. A cross product is the shape where a row that differs only in
// a dimension the module ignores passes whatever the module does, so every cell
// below was measured against the real module before it was written and every
// row has a named failure mode.
//
// Measured against the real module, because a sibling's answer is not this
// module's answer:
//   * the handler's own `nonFlagPositionals.length > 1` guard rejects TWO and
//     THREE references. ZERO is ACCEPTED -- it IS the all form -- so nothing
//     sits below the accepted arity and there is no rejection to prove there;
//   * the scope-target flag is ACCEPTED, and is invisible in the notification.
//     The emission is byte-identical with and without it; the only observable
//     difference is that the update's write-back creates the declaration in
//     `claude-plugins.local.json` instead of `claude-plugins.json`. A suite
//     reading only notifications would have called the flag inert;
//   * the scope flag and the scope-target flag are ACCEPTED TOGETHER.
//     `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair
//     and filters only the scope-target token, so both selectors reach the
//     workflow -- the scope narrows the target set and the flag moves the layer;
//   * a quoted long flag survives the FIRST scan (which splits on whitespace and
//     sees a token opening with a quote character) and is claimed by the SECOND
//     (which runs after the tokenizer strips quotes). That is one route into the
//     early return after the shared map-model parse; an unrecognised scope value
//     is the other, because the tokenizer's throw is caught inside the same
//     shared parse and surfaces as the same `undefined`.
//
// Coverage cannot see a data field, so each flag is classified by WHAT it
// changes and every value-carrying member is pinned against a hand-authored
// expectation rather than left to a branch count:
//   * `--map-model` -> `mapModel: true`, observed as the `model:` line the
//     re-staged agent frontmatter carries. AG-7 is opt-in, so the unsupplied
//     case omits the field entirely rather than writing a default -- which is
//     what "absent, not present-and-false" means here;
//   * `--partial` -> `partial: true`, observed as whether a plugin whose new
//     source declares an unsupported component kind updates at all (D-65-05);
//   * the scope-target flag -> `local: true`, observed as which of the scope's
//     two physical config files the write-back created (WB-01);
//   * `--scope` -> the scope member, observed as which scope roots were
//     enumerated. The OMITTED case is not a default: it enumerates BOTH scopes,
//     which is a third outcome distinct from either explicit value, so absence
//     is provable rather than assumed.
//
// D-116-05 (O3) places this handler in Group C: `updatePlugins` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. Delegation is observed instead as the
// footprint the workflow left in the hermetic tree -- both scopes' install
// records, both scopes' base and override config layers, and the generated
// agent files -- compared as ONE whole value. The delegating cases deliberately
// do NOT assert the notification body: that value belongs to
// tests/orchestrators/plugin/update.test.ts, and re-deriving it here would
// restate a fact another pair owns.
//
// The negative half of D-116-06 is proven in full. Every rejecting case sizes
// the boundary at one emission, zero probes and NO stated `cwd`, compares the
// whole notification list against a hand-authored value, asserts that the
// seeded fixture is byte-unchanged, and calls `verifyBoundary()`. That
// footprint assertion is a live gate rather than a vacuous negative: a
// delegating run over the same fixture bumps five records and writes two config
// layers.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two paths disagree and neither is a property of the
// helper:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * every delegating case, whether the update succeeds, degrades or is
//     refused by the candidate gate, reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` FOUR times.
//
// The network door is `https.request`, not `globalThis.fetch`: the git
// transport reaches the wire through `simple-get`, and `fetch` has a single
// production caller elsewhere. It is replaced by a counting fail-fast throw and
// read back at zero in every case. That zero is a HERMETICITY AND NFR-5
// REGRESSION GUARD, not a discriminated measurement -- this handler's
// orchestrator is the one documented git-operations exemption, so the door is
// genuinely in its import graph, but no input in this handler's reachable space
// opens it: the marketplace sync no-ops for every non-github source kind and
// every fixture here is a path source. Read it as a guard.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project
// scope and `<HOME>/.pi/agent` for the user scope, with the agent-directory
// variable DELETED rather than overwritten, because `getAgentDir()` reads it
// ahead of `homedir()` and an ambient value would defeat a hermetic HOME (SC-1).
// The two scopes declare the same plugins against DIFFERENT source versions, so
// a target resolved in the wrong scope is readable off the footprint rather
// than merely absent from the right one.
//
// This pair makes no exhaustiveness claim: the target form is selected by a
// chain of `if` statements over string shapes, not a `switch` over a closed
// union, so a missing-arm plant has no target here. No case asserts the absence
// of direct process output (ESLint and fallow own that), none re-proves the
// shared flag scan owned by tests/edge/handlers/shared.test.ts, none re-proves
// the map-model parse owned by tests/edge/handlers/plugin/shared.test.ts, none
// restates the tokenizer diagnostics owned by tests/edge/args.test.ts, and none
// re-pins the catalog's per-verb flag sets owned by
// tests/edge/flag-catalog.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { SCOPE_TARGET_FLAG } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { makeUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts";
import { loadConfig } from "../../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { loadState } from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { mergeMarketplaceIntoState } from "../../../helpers/marketplace-seed.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { ScopeConfig } from "../../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * The two downstream booleans as a user types them. Written out rather than
 * read positionally off the catalog's pass-through derivation: the two names
 * are NOT interchangeable here (one widens the candidate gate, the other adds a
 * field to the re-staged agent), so a positional read would silently swap the
 * matrix's behavior columns if the catalog order changed, and a read by name is
 * the literal with extra steps. The scope-target flag has no such hazard -- the
 * catalog exports it as a single named constant, so it is taken from there.
 */
const MAP_MODEL_FLAG = "--map-model";
const PARTIAL_FLAG = "--partial";

/** The reference prefix that selects the marketplace form. */
const MARKETPLACE_PREFIX = "@";

/** The frontmatter field the AG-7 mapping emits, and the prefix that finds it. */
const MODEL_FIELD_PREFIX = "model: ";

const USAGE =
  "Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] " +
  "[--scope user|project] [--map-model] [--partial] [--local]";

const SKILL_SOURCE = "---\nname: tool\ndescription: A tool skill.\n---\n\nBody.\n";

/**
 * One agent per agent-bearing plugin, declaring a source model the AG-7 table
 * maps. The mapping is opt-in, so this file is what makes `--map-model`
 * observable.
 */
const AGENT_SOURCE =
  "---\nname: scout\ndescription: A scout agent.\nmodel: sonnet\ntools: Read\n---\n\nScout body.\n";

/** The version every seeded install record carries before the update runs. */
const INSTALLED_VERSION = "1.0.0";
/** The version the PROJECT scope's marketplace sources declare. */
const PROJECT_SOURCE_VERSION = "2.0.0";
/** The version the USER scope's marketplace sources declare. */
const USER_SOURCE_VERSION = "3.0.0";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
  /** How many times the git transport door was opened. */
  readonly networkCalls: () => number;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared and the git transport door replaced by a
 * counting fail-fast throw. Removal and both environment restores are
 * registered before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-update-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-update-${label}-home-`));
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
  const door = t.mock.method(https, "request", (): never => {
    throw new Error("update must not open a network connection for a path source");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    networkCalls: (): number => door.mock.callCount(),
  };
}

interface SeededPlugin {
  readonly name: string;
  /** Emit `agents/scout.md`, which is what makes the model mapping visible. */
  readonly agent?: boolean;
  /** Declare an unsupported component kind, which needs the widened gate. */
  readonly unsupportedKind?: boolean;
}

/** One plugin source tree: a manifest, one skill, and optionally one agent. */
async function seedPluginTree(
  marketplaceRoot: string,
  plugin: SeededPlugin,
  version: string,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin.name);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin.name,
      version,
      ...(plugin.unsupportedKind === true && { experimental: { themes: "./themes" } }),
    }),
    "utf8",
  );
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), SKILL_SOURCE, "utf8");
  if (plugin.agent === true) {
    await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
    await writeFile(path.join(pluginRoot, "agents", "scout.md"), AGENT_SOURCE, "utf8");
  }
}

/** The persisted install record a seeded, stale plugin starts from. */
function seededRecord(plugin: SeededPlugin): Record<string, unknown> {
  return {
    version: INSTALLED_VERSION,
    resolvedSource: "./placeholder",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: [`${plugin.name}-tool`],
      prompts: [],
      agents: plugin.agent === true ? [`pi-claude-marketplace-${plugin.name}-scout`] : [],
      mcpServers: [],
      hooks: [],
    },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Record one path-source marketplace in one scope, materialise the tree it
 * points at at `sourceVersion`, and seed every plugin as installed at the
 * older `INSTALLED_VERSION` so a considered target is visible as a version
 * that moved.
 */
async function seedMarketplace(opts: {
  readonly workspace: HermeticWorkspace;
  readonly scope: Scope;
  readonly scopeRoot: string;
  readonly marketplace: string;
  readonly sourceVersion: string;
  readonly plugins: readonly SeededPlugin[];
}): Promise<void> {
  const logical = `./${opts.marketplace}-src-${opts.scope}`;
  const marketplaceRoot = path.join(opts.workspace.cwd, `${opts.marketplace}-src-${opts.scope}`);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: opts.marketplace,
      owner: { name: "seed-owner" },
      plugins: opts.plugins.map((p) => ({ name: p.name, source: `./plugins/${p.name}` })),
    }),
    "utf8",
  );
  const plugins: Record<string, unknown> = {};
  for (const plugin of opts.plugins) {
    await seedPluginTree(marketplaceRoot, plugin, opts.sourceVersion);
    plugins[plugin.name] = seededRecord(plugin);
  }

  await mergeMarketplaceIntoState(
    path.join(opts.scopeRoot, "pi-claude-marketplace"),
    opts.marketplace,
    {
      name: opts.marketplace,
      scope: opts.scope,
      source: { kind: "path", raw: logical, logical },
      addedFromCwd: opts.workspace.cwd,
      manifestPath,
      marketplaceRoot,
      plugins,
    },
  );
}

const ONE: SeededPlugin = { name: "one", agent: true };
const TWO: SeededPlugin = { name: "two" };
const THREE: SeededPlugin = { name: "three" };
const DEGRADED: SeededPlugin = { name: "degraded", agent: true, unsupportedKind: true };

/**
 * The target-form fixture. The project scope holds two marketplaces so the
 * marketplace form has something to exclude, `alpha` holds two plugins so the
 * plugin form has something to exclude, and the user scope holds the SAME
 * marketplace and plugins against a different source version so a target
 * resolved in the wrong scope lands on a visibly different version.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace({
    workspace,
    scope: "project",
    scopeRoot: workspace.projectRoot,
    marketplace: "alpha",
    sourceVersion: PROJECT_SOURCE_VERSION,
    plugins: [ONE, TWO],
  });
  await seedMarketplace({
    workspace,
    scope: "project",
    scopeRoot: workspace.projectRoot,
    marketplace: "beta",
    sourceVersion: PROJECT_SOURCE_VERSION,
    plugins: [THREE],
  });
  await seedMarketplace({
    workspace,
    scope: "user",
    scopeRoot: workspace.userRoot,
    marketplace: "alpha",
    sourceVersion: USER_SOURCE_VERSION,
    plugins: [ONE, TWO],
  });
}

/**
 * The downstream-boolean fixture: one plugin whose NEW source declares an
 * unsupported component kind, so the candidate gate refuses it unless the
 * gate-widening flag is supplied, and which carries a model-bearing agent so
 * the model-mapping flag is visible on the arm that does materialise.
 */
async function seedDegraded(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace({
    workspace,
    scope: "project",
    scopeRoot: workspace.projectRoot,
    marketplace: "alpha",
    sourceVersion: PROJECT_SOURCE_VERSION,
    plugins: [DEGRADED],
  });
}

/** The fields of a persisted install record an input to this handler can move. */
interface InstallRecordProjection {
  readonly marketplace: string;
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
  readonly networkCalls: number;
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
  const records: InstallRecordProjection[] = [];
  for (const [marketplace, entry] of Object.entries(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(entry.plugins)) {
      records.push({
        marketplace,
        plugin,
        version: record.version,
        enabled: record.enabled,
        installable: record.compatibility.installable,
        unsupported: record.compatibility.unsupported,
        skills: record.resources.skills,
        agents: record.resources.agents,
      });
    }
  }

  records.sort((a, b) =>
    `${a.marketplace}/${a.plugin}`.localeCompare(`${b.marketplace}/${b.plugin}`),
  );
  return {
    records,
    base: await readConfigLayer(path.join(scopeRoot, "claude-plugins.json")),
    local: await readConfigLayer(path.join(scopeRoot, "claude-plugins.local.json")),
    agents: await readGeneratedAgents(scopeRoot),
  };
}

/**
 * Everything the update could have moved, in both scopes, plus the transport
 * counter, as one value. A whole-value comparison catches a record refreshed
 * in the wrong scope, a declaration written to the wrong layer, and an agent
 * regenerated for a plugin the target form should have excluded; separate
 * existence checks do not.
 */
async function readFootprint(workspace: HermeticWorkspace): Promise<Footprint> {
  return {
    project: await readScopeFootprint(workspace.projectRoot),
    user: await readScopeFootprint(workspace.userRoot),
    networkCalls: workspace.networkCalls(),
  };
}

const ONE_AGENT_FILE = "pi-claude-marketplace-one-scout.md";
const DEGRADED_AGENT_FILE = "pi-claude-marketplace-degraded-scout.md";
const MAPPED_MODEL = "anthropic/claude-sonnet-4-6";

const ONE_STALE: InstallRecordProjection = {
  marketplace: "alpha",
  plugin: "one",
  version: INSTALLED_VERSION,
  enabled: true,
  installable: true,
  unsupported: [],
  skills: ["one-tool"],
  agents: ["pi-claude-marketplace-one-scout"],
};

const TWO_STALE: InstallRecordProjection = {
  marketplace: "alpha",
  plugin: "two",
  version: INSTALLED_VERSION,
  enabled: true,
  installable: true,
  unsupported: [],
  skills: ["two-tool"],
  agents: [],
};

const THREE_STALE: InstallRecordProjection = {
  marketplace: "beta",
  plugin: "three",
  version: INSTALLED_VERSION,
  enabled: true,
  installable: true,
  unsupported: [],
  skills: ["three-tool"],
  agents: [],
};

const ONE_FROM_PROJECT_SOURCE: InstallRecordProjection = {
  ...ONE_STALE,
  version: PROJECT_SOURCE_VERSION,
};
const TWO_FROM_PROJECT_SOURCE: InstallRecordProjection = {
  ...TWO_STALE,
  version: PROJECT_SOURCE_VERSION,
};
const THREE_FROM_PROJECT_SOURCE: InstallRecordProjection = {
  ...THREE_STALE,
  version: PROJECT_SOURCE_VERSION,
};
const ONE_FROM_USER_SOURCE: InstallRecordProjection = {
  ...ONE_STALE,
  version: USER_SOURCE_VERSION,
};
const TWO_FROM_USER_SOURCE: InstallRecordProjection = {
  ...TWO_STALE,
  version: USER_SOURCE_VERSION,
};

const PROJECT_UNTOUCHED: ScopeFootprint = {
  records: [ONE_STALE, TWO_STALE, THREE_STALE],
  base: undefined,
  local: undefined,
  agents: [],
};

const USER_UNTOUCHED: ScopeFootprint = {
  records: [ONE_STALE, TWO_STALE],
  base: undefined,
  local: undefined,
  agents: [],
};

/** No target was considered anywhere: every seeded record is byte-unchanged. */
const NOTHING_UPDATED: Footprint = {
  project: PROJECT_UNTOUCHED,
  user: USER_UNTOUCHED,
  networkCalls: 0,
};

const ALL_PROJECT_DECLARED: ScopeConfig = {
  schemaVersion: 1,
  plugins: { "one@alpha": {}, "two@alpha": {}, "three@beta": {} },
};

const ALPHA_PROJECT_DECLARED: ScopeConfig = {
  schemaVersion: 1,
  plugins: { "one@alpha": {}, "two@alpha": {} },
};

const ONE_DECLARED: ScopeConfig = { schemaVersion: 1, plugins: { "one@alpha": {} } };

const ALPHA_USER_DECLARED: ScopeConfig = {
  schemaVersion: 1,
  plugins: { "one@alpha": {}, "two@alpha": {} },
};

/** Every project-scope plugin refreshed from the project sources. */
const PROJECT_ALL_UPDATED: ScopeFootprint = {
  records: [ONE_FROM_PROJECT_SOURCE, TWO_FROM_PROJECT_SOURCE, THREE_FROM_PROJECT_SOURCE],
  base: ALL_PROJECT_DECLARED,
  local: undefined,
  agents: [{ file: ONE_AGENT_FILE }],
};

/** Every user-scope plugin refreshed from the user sources. */
const USER_ALL_UPDATED: ScopeFootprint = {
  records: [ONE_FROM_USER_SOURCE, TWO_FROM_USER_SOURCE],
  base: ALPHA_USER_DECLARED,
  local: undefined,
  agents: [{ file: ONE_AGENT_FILE }],
};

/** Only the `alpha` marketplace's project-scope plugins were considered. */
const PROJECT_ALPHA_UPDATED: ScopeFootprint = {
  records: [ONE_FROM_PROJECT_SOURCE, TWO_FROM_PROJECT_SOURCE, THREE_STALE],
  base: ALPHA_PROJECT_DECLARED,
  local: undefined,
  agents: [{ file: ONE_AGENT_FILE }],
};

/** Only the single named plugin was considered. */
const PROJECT_ONE_UPDATED: ScopeFootprint = {
  records: [ONE_FROM_PROJECT_SOURCE, TWO_STALE, THREE_STALE],
  base: ONE_DECLARED,
  local: undefined,
  agents: [{ file: ONE_AGENT_FILE }],
};

// ---------------------------------------------------------------------------
// The three target forms. Each excludes something the other two include, so a
// form that collapsed into another is visible rather than merely unproven. The
// no-positional row doubles as the scope-omitted proof: it enumerates BOTH
// scope roots, an outcome neither explicit scope value can produce.
// ---------------------------------------------------------------------------

for (const { args, expectedFootprint, label, summary } of [
  {
    args: "",
    label: "form-all",
    summary: "no positional considers every installed plugin in both scopes",
    expectedFootprint: {
      project: PROJECT_ALL_UPDATED,
      user: USER_ALL_UPDATED,
      networkCalls: 0,
    },
  },
  {
    args: `${MARKETPLACE_PREFIX}alpha`,
    label: "form-marketplace",
    summary: "a leading-separator reference considers only the named marketplace",
    expectedFootprint: {
      project: PROJECT_ALPHA_UPDATED,
      user: USER_UNTOUCHED,
      networkCalls: 0,
    },
  },
  {
    args: "one@alpha",
    label: "form-plugin",
    summary: "a plugin reference considers only the named plugin",
    expectedFootprint: {
      project: PROJECT_ONE_UPDATED,
      user: USER_UNTOUCHED,
      networkCalls: 0,
    },
  },
] satisfies readonly {
  args: string;
  expectedFootprint: Footprint;
  label: string;
  summary: string;
}[]) {
  test(`selects the update target so that ${summary} (PUP-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope member. An omitted scope flag is NOT a default -- the no-positional
// case above enumerates both roots -- so each explicit value narrows to a
// footprint neither the other value nor the omitted form produces.
// ---------------------------------------------------------------------------

for (const { args, expectedFootprint, label, summary } of [
  {
    args: "--scope project",
    label: "scope-project",
    summary: "the project scope alone",
    expectedFootprint: {
      project: PROJECT_ALL_UPDATED,
      user: USER_UNTOUCHED,
      networkCalls: 0,
    },
  },
  {
    args: "--scope user",
    label: "scope-user",
    summary: "the user scope alone",
    expectedFootprint: {
      project: PROJECT_UNTOUCHED,
      user: USER_ALL_UPDATED,
      networkCalls: 0,
    },
  },
] satisfies readonly {
  args: string;
  expectedFootprint: Footprint;
  label: string;
  summary: string;
}[]) {
  test(`narrows the considered plugins to ${summary} when that scope is supplied (SC-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// All four combinations of the two downstream booleans, against a plugin whose
// new source declares an unsupported component kind. The gate-widening flag
// decides whether anything materialises; the model-mapping flag decides whether
// the re-staged agent carries the field at all. The unsupplied model flag omits
// the field rather than writing a default, which is the "absent, not
// present-and-false" observation.
// ---------------------------------------------------------------------------

const DEGRADED_STALE: InstallRecordProjection = {
  marketplace: "alpha",
  plugin: "degraded",
  version: INSTALLED_VERSION,
  enabled: true,
  installable: true,
  unsupported: [],
  skills: ["degraded-tool"],
  agents: ["pi-claude-marketplace-degraded-scout"],
};

const DEGRADED_UPDATED: InstallRecordProjection = {
  ...DEGRADED_STALE,
  version: PROJECT_SOURCE_VERSION,
  unsupported: ["themes"],
};

const DEGRADED_REFUSED: Footprint = {
  project: { records: [DEGRADED_STALE], base: undefined, local: undefined, agents: [] },
  user: { records: [], base: undefined, local: undefined, agents: [] },
  networkCalls: 0,
};

function degradedUpdated(agents: readonly GeneratedAgentProjection[]): Footprint {
  return {
    project: {
      records: [DEGRADED_UPDATED],
      base: { schemaVersion: 1, plugins: { "degraded@alpha": {} } },
      local: undefined,
      agents,
    },
    user: { records: [], base: undefined, local: undefined, agents: [] },
    networkCalls: 0,
  };
}

for (const { args, expectedFootprint, label, summary } of [
  {
    args: "degraded@alpha",
    label: "matrix-neither",
    summary: "neither downstream flag leaves the candidate refused",
    expectedFootprint: DEGRADED_REFUSED,
  },
  {
    args: `degraded@alpha ${MAP_MODEL_FLAG}`,
    label: "matrix-map-model",
    summary: "the model-mapping flag alone does not widen the candidate gate",
    expectedFootprint: DEGRADED_REFUSED,
  },
  {
    args: `degraded@alpha ${PARTIAL_FLAG}`,
    label: "matrix-partial",
    summary: "the gate-widening flag alone re-stages the agent with no model field",
    expectedFootprint: degradedUpdated([{ file: DEGRADED_AGENT_FILE }]),
  },
  {
    args: `degraded@alpha ${PARTIAL_FLAG} ${MAP_MODEL_FLAG}`,
    label: "matrix-both",
    summary: "both downstream flags re-stage the agent with the mapped model",
    expectedFootprint: degradedUpdated([{ file: DEGRADED_AGENT_FILE, model: MAPPED_MODEL }]),
  },
] satisfies readonly {
  args: string;
  expectedFootprint: Footprint;
  label: string;
  summary: string;
}[]) {
  test(`forwards the downstream flags so that ${summary} (D-65-05)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedDegraded(workspace);
    const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 4, {
      value: workspace.cwd,
      reads: 1,
    });
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope-target flag. Its ONLY observable effect is which physical config
// file the write-back created: the notification is byte-identical with and
// without it. The flag-OMITTED companion is the plugin-reference case above,
// which lands the same declaration in the base layer, so this family has a
// demonstrated disagreement beside it rather than three rows that agree.
// Position independence is proven by a plant, not by these rows agreeing.
// ---------------------------------------------------------------------------

for (const { args, expectedAgents, label, position } of [
  {
    args: `${SCOPE_TARGET_FLAG} one@alpha`,
    label: "target-before",
    position: "ahead of the reference",
    expectedAgents: [{ file: ONE_AGENT_FILE }],
  },
  {
    args: `one@alpha ${SCOPE_TARGET_FLAG}`,
    label: "target-after",
    position: "after the reference",
    expectedAgents: [{ file: ONE_AGENT_FILE }],
  },
  {
    args: `one@alpha ${MAP_MODEL_FLAG} ${SCOPE_TARGET_FLAG} ${PARTIAL_FLAG}`,
    label: "target-between",
    position: "between the two downstream flags",
    expectedAgents: [{ file: ONE_AGENT_FILE, model: MAPPED_MODEL }],
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
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(await readFootprint(workspace), {
      project: {
        records: [ONE_FROM_PROJECT_SOURCE, TWO_STALE, THREE_STALE],
        base: undefined,
        local: ONE_DECLARED,
        agents: expectedAgents,
      },
      user: USER_UNTOUCHED,
      networkCalls: 0,
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
  const updateHandler = makeUpdateHandler(pi);

  // act
  await updateHandler(`--scope user one@alpha ${SCOPE_TARGET_FLAG}`, ctx);

  // assert
  assert.deepStrictEqual(await readFootprint(workspace), {
    project: PROJECT_UNTOUCHED,
    user: {
      records: [ONE_FROM_USER_SOURCE, TWO_STALE],
      base: undefined,
      local: ONE_DECLARED,
      agents: [{ file: ONE_AGENT_FILE }],
    },
    networkCalls: 0,
  } satisfies Footprint);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// Rejections. Nothing is considered, the workflow is never reached, and the
// seeded fixture survives byte-unchanged -- a live gate, because a delegating
// run over the same fixture moves five records and writes two config layers.
//
// There is no case one BELOW the accepted arity: zero positionals is the all
// form, which this handler accepts.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "one@alpha two@alpha", label: "arity-two", summary: "two references" },
  { args: "one@alpha two@alpha three@beta", label: "arity-three", summary: "three references" },
]) {
  test(`rejects ${summary} with the too-many-arguments sentence and never reaches the update workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Too many arguments.\n\n${USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_UPDATED);
    verifyBoundary();
  });
}

for (const { args, expectedMessage, label, summary } of [
  {
    args: "no-at-sign",
    label: "ref-no-separator",
    summary: "a reference carrying no separator",
    expectedMessage: `Invalid <plugin>@<marketplace> ref: "no-at-sign".\n\n${USAGE}`,
  },
  {
    args: MARKETPLACE_PREFIX,
    label: "ref-lone-separator",
    summary: "a lone separator with no marketplace after it",
    expectedMessage: `Invalid <plugin>@<marketplace> ref: "@".\n\n${USAGE}`,
  },
  {
    args: "one@",
    label: "ref-trailing-separator",
    summary: "a reference ending at the separator",
    expectedMessage: `Invalid <plugin>@<marketplace> ref: "one@".\n\n${USAGE}`,
  },
]) {
  test(`names ${summary} verbatim and never reaches the update workflow (PI-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_UPDATED);
    verifyBoundary();
  });
}

for (const { args, label, summary } of [
  {
    args: "one@alpha --frobnicate",
    label: "unknown-first-scan",
    summary: "is claimed by the first scan",
  },
  {
    args: 'one@alpha "--frobnicate"',
    label: "unknown-second-scan",
    summary: "is quoted past the first scan and claimed by the second",
  },
]) {
  test(`names an unrecognised long flag that ${summary} and never reaches the update workflow (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown flag: "--frobnicate".\n\n${USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_UPDATED);
    verifyBoundary();
  });
}

for (const { args, label, offending, summary } of [
  {
    args: "one@alpha --scope bogus",
    label: "scope-value-ordinary",
    offending: "bogus",
    summary: "an ordinary token in the scope-value position",
  },
  {
    args: "one@alpha --scope --frobnicate",
    label: "scope-value-long-flag",
    offending: "--frobnicate",
    summary: "a long flag in the scope-value position",
  },
]) {
  test(`carries the tokenizer's own sentence for ${summary} and never reaches the update workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const updateHandler = makeUpdateHandler(pi);

    // act
    await updateHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid --scope value: "${offending}". Must be "user" or "project".\n\n${USAGE}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_UPDATED);
    verifyBoundary();
  });
}
