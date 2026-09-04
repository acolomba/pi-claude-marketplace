// Owner for edge/handlers/plugin/list.ts (MOD-09).
//
// This shim carries the widest filter-flag family in the handler tier: one
// optional marketplace positional, five catalog-derived boolean filters, and the
// global scope flag. It opens with the shared `withParsedArgs` prelude over
// `parseArgs`, then runs its own scan over the recovered positional tokens.
//
// Which parser a module calls decides its arity and flag answers, so all of the
// following were measured against the real module before a case was written:
//   * ZERO and ONE marketplace positional are both accepted, and TWO or THREE
//     are rejected. There is no arity one BELOW the accepted range, so only the
//     surplus half of the arity obligation has a target here;
//   * the scope-target flag is REJECTED. This module never reaches
//     `extractLocalFlag`, so the token survives `parseArgs` as an ordinary
//     positional, fails the recognized-filter test, opens with `--`, and lands
//     in the unknown-option channel -- with or without a scope flag beside it;
//   * the rejection sentence is the unknown-OPTION wording, not the unknown-FLAG
//     wording the install and update siblings emit, so every expected sentence
//     here is written out rather than carried across;
//   * the scan does not stop at the first recognized filter: an unknown option
//     driven AFTER a recognized filter is still claimed.
//
// Coverage cannot see a data field, so every filter is classified by what it
// changes and each VALUE-carrying member is pinned against a hand-authored row
// set rather than left to a branch count. All five are value-carrying: each maps
// a recognized token to one named member of the workflow's options bag, and each
// member selects a different bucket. The fixture gives every bucket exactly one
// plugin so the five members are mutually distinguishable -- a flag that reached
// the workflow under a neighbour's member name produces a different row set:
//   * `--installed`   -> `installed`   -> the recorded `alpha` / `solo` rows;
//   * `--available`   -> `available`   -> `spare`;
//   * `--unavailable` -> `unavailable` -> `missing`;
//   * `--partial`     -> `partial`     -> `degraded`;
//   * `--remote`      -> `remote`      -> `far`.
// The five names are written out rather than derived from the catalog: the
// module derives its own recognized set from the same catalog call, so a
// catalog-driven input could not disagree with it, and the token-to-member
// mapping the rows actually pin is a hand-written literal in the module, not a
// catalog fact. Catalog-versus-handler reconciliation is owned by
// tests/architecture/flag-catalog-drift.test.ts.
//
// D-116-05 (O3) places this handler in Group C: `listPlugins` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. This verb is read-only and writes nothing on
// any path, so there is no on-disk footprint to measure either. Delegation is
// observed instead as the ROW SET the single emission carries, projected to the
// marketplace header plus each row's name, version and status token and compared
// as ONE whole value. The projection deliberately drops the glyph and the reason
// trailer: the rendered body belongs to tests/orchestrators/plugin/list.test.ts,
// and re-deriving it here would restate a fact another pair owns at full direct
// coverage.
//
// For the same reason no rejecting case asserts an empty on-disk footprint. That
// negative would hold whether or not the workflow ran, because the workflow
// never writes; an assertion whose subject cannot change proves the module
// rather than the case. The negative half of D-116-06 is carried by the shape
// that CAN fail: a rejecting case sizes the boundary at one emission, zero
// probes, and NO stated `cwd`, so a workflow that did run reads an unstated
// boundary member and dies where it happens.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- `notifyUsageError` writes straight to the channel;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` TWICE, on every filter and scope combination.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope
// and `<HOME>/.pi/agent` for the user scope, with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1). Each
// scope declares the SAME two marketplaces and the same plugins at a different
// version, so a row read out of the wrong scope carries the wrong version.
//
// The git transport door (`https.request`) is replaced by a counting fail-fast
// throw, and every case asserts it recorded zero calls. The fixture declares a
// COLD git source (`far`), whose clone is not materialized, so the zero is
// asserted over an input that would need the network to resolve any further --
// not over an all-path-source fixture where no code path could reach the
// transport at all. `globalThis.fetch` is deliberately NOT the door watched
// here: the git transport reaches the wire through `simple-get` ->
// `https.request`, and this repo's only `fetch` caller is the device-flow
// credential path, which no list invocation enters. This verb has no flag that
// turns materialization on, so unlike the info verb there is no positive control
// available: the zero is a regression guard on NFR-5, and the `(remote)` row
// beside it is what says the workflow chose the offline answer.
//
// This pair makes no exhaustiveness claim: `edge/handlers/plugin/list.ts`
// contains no `switch` and no closed-union dispatch, so a missing-arm plant has
// no target here. No case asserts the absence of direct process output (ESLint
// and fallow own that), none re-pins the catalog's per-verb flag sets owned by
// tests/edge/flag-catalog.test.ts, none restates the tokenizer diagnostics owned
// by tests/edge/args.test.ts, none restates the shared prelude owned by
// tests/edge/handlers/plugin/shared.test.ts, and none re-derives the list
// outcome owned by tests/orchestrators/plugin/list.test.ts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { SCOPE_TARGET_FLAG } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { makeListHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import { buildInstalledPluginRecord, mergeMarketplaceIntoState } from "../marketplace-seed.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { Notification } from "../../notification-boundary.ts";

/** The five filters as a user types them, and the usage block this shim owns. */
const INSTALLED_FLAG = "--installed";
const AVAILABLE_FLAG = "--available";
const UNAVAILABLE_FLAG = "--unavailable";
const PARTIAL_FLAG = "--partial";
const REMOTE_FLAG = "--remote";

const LIST_USAGE =
  "Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user|project]";

const SKILL_SOURCE = "---\nname: tool\ndescription: A tool skill.\n---\n\nBody.\n";

interface HermeticWorkspace {
  /** The project working directory the handler forwards as `ctx.cwd`. */
  readonly cwd: string;
  /** `<cwd>/.pi` -- the project scope root (SC-1). */
  readonly projectRoot: string;
  /** `<HOME>/.pi/agent` -- the user scope root (SC-1). */
  readonly userRoot: string;
  /** Calls recorded by the fail-fast git transport door (NFR-5). */
  readonly transportCalls: () => number;
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared and the git transport door replaced by a
 * counting fail-fast throw. Removal and both environment restores are registered
 * before the handler runs.
 */
async function createHermeticWorkspace(t: TestContext, label: string): Promise<HermeticWorkspace> {
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-list-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-list-${label}-home-`));
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
  const requestSpy = t.mock.method(https, "request", (): never => {
    throw new Error("list must not open a network connection");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    transportCalls: (): number => requestSpy.mock.callCount(),
  };
}

/** One plugin source tree: a manifest and one skill. */
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
}

async function writeMarketplaceManifest(
  marketplaceRoot: string,
  name: string,
  plugins: readonly Record<string, string>[],
): Promise<string> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name, owner: { name: "seed-owner" }, plugins }),
    "utf8",
  );
  return manifestPath;
}

/**
 * Record one marketplace in a scope's state, pointing at the tree just written.
 * `installed` names the plugins that carry an install record; every other
 * manifest entry resolves to its own not-installed bucket.
 */
async function recordMarketplace(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  marketplace: string,
  marketplaceRoot: string,
  manifestPath: string,
  installed: readonly string[],
  version: string,
): Promise<void> {
  const plugins: Record<string, unknown> = {};
  for (const name of installed) {
    plugins[name] = buildInstalledPluginRecord(
      { version },
      { skills: [`${name}-tool`], prompts: [], agents: [], mcpServers: [], hooks: [] },
    );
  }

  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), marketplace, {
    name: marketplace,
    scope,
    source: {
      kind: "path",
      raw: `./${marketplace}-src-${scope}`,
      logical: `./${marketplace}-src-${scope}`,
    },
    addedFromCwd: workspace.cwd,
    manifestPath,
    marketplaceRoot,
    plugins,
  });
}

/**
 * Seed both marketplaces into one scope. `mp` carries one plugin per bucket:
 * `alpha` is recorded, `spare` resolves installable, `degraded` declares an
 * unsupported component kind, `missing` points at a source that is not there,
 * and `far` is a COLD git source whose clone was never materialized. `other`
 * carries a single recorded plugin so a marketplace filter is visible.
 */
async function seedScope(
  workspace: HermeticWorkspace,
  scope: Scope,
  scopeRoot: string,
  version: string,
): Promise<void> {
  const mpRoot = path.join(workspace.cwd, `mp-src-${scope}`);
  const mpManifest = await writeMarketplaceManifest(mpRoot, "mp", [
    { name: "alpha", source: "./alpha" },
    { name: "degraded", source: "./degraded" },
    { name: "far", source: "https://127.0.0.1:9/far.git" },
    { name: "missing", source: "./missing" },
    { name: "spare", source: "./spare" },
  ]);
  await seedPlugin(mpRoot, "alpha", { name: "alpha", version });
  await seedPlugin(mpRoot, "spare", { name: "spare", version });
  await seedPlugin(mpRoot, "degraded", {
    name: "degraded",
    version,
    experimental: { themes: "./themes" },
  });
  await recordMarketplace(
    workspace,
    scope,
    scopeRoot,
    "mp",
    mpRoot,
    mpManifest,
    ["alpha"],
    version,
  );

  const otherRoot = path.join(workspace.cwd, `other-src-${scope}`);
  const otherManifest = await writeMarketplaceManifest(otherRoot, "other", [
    { name: "solo", source: "./solo" },
  ]);
  await seedPlugin(otherRoot, "solo", { name: "solo", version });
  await recordMarketplace(
    workspace,
    scope,
    scopeRoot,
    "other",
    otherRoot,
    otherManifest,
    ["solo"],
    version,
  );
}

/**
 * Both scopes declare the same two marketplaces at a different version each, so
 * a row read out of the wrong scope root carries the wrong version rather than
 * merely being absent from the right block.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedScope(workspace, "project", workspace.projectRoot, "1.0.0");
  await seedScope(workspace, "user", workspace.userRoot, "2.0.0");
}

/** One rendered marketplace block: its header and the rows it kept. */
interface MarketplaceBlock {
  readonly marketplace: string;
  readonly plugins: readonly string[];
}

const HEADER_PATTERN = /^\S+ (.+)$/u;
const ROW_PATTERN = /^ {2}\S+ (\S+(?: v\S+)?) \((\S+)\)(?: \{.+\})?$/u;

function projectRow(row: string): string {
  const matched = ROW_PATTERN.exec(row);
  const name = matched?.[1];
  const status = matched?.[2];
  if (name === undefined || status === undefined) {
    throw new Error(`unrecognised plugin row: ${row}`);
  }

  return `${name} (${status})`;
}

function projectBlock(block: string): MarketplaceBlock {
  const [header, ...rows] = block.split("\n");
  const marketplace = header === undefined ? undefined : HEADER_PATTERN.exec(header)?.[1];
  if (marketplace === undefined) {
    throw new Error(`unrecognised marketplace header: ${String(header)}`);
  }

  return { marketplace, plugins: rows.map(projectRow) };
}

/**
 * The single listing emission, reduced to the row IDENTITIES the filters and the
 * scope select. The glyph and the reason trailer are dropped because the
 * rendered body is another pair's contract.
 */
function projectListing(notifications: readonly Notification[]): readonly MarketplaceBlock[] {
  const [listing, ...surplus] = notifications;
  if (listing === undefined || surplus.length > 0 || listing.severity !== undefined) {
    throw new Error(
      `expected exactly one listing emission carrying no severity, got ${JSON.stringify(notifications)}`,
    );
  }

  return listing.message.split("\n\n").map(projectBlock);
}

const MP_PROJECT = "mp [project]";
const MP_USER = "mp [user]";
const OTHER_PROJECT = "other [project]";
const OTHER_USER = "other [user]";

const ALPHA_PROJECT_ROW = "alpha v1.0.0 (installed)";
const ALPHA_USER_ROW = "alpha v2.0.0 (installed)";
const SOLO_PROJECT_ROW = "solo v1.0.0 (installed)";
const SOLO_USER_ROW = "solo v2.0.0 (installed)";
const DEGRADED_ROW = "degraded (partially-available)";
const FAR_ROW = "far (remote)";
const MISSING_ROW = "missing (unavailable)";
const SPARE_ROW = "spare (available)";

const EVERY_MP_PROJECT_ROW = [
  ALPHA_PROJECT_ROW,
  DEGRADED_ROW,
  FAR_ROW,
  MISSING_ROW,
  SPARE_ROW,
] as const;

const EVERY_MP_USER_ROW = [ALPHA_USER_ROW, DEGRADED_ROW, FAR_ROW, MISSING_ROW, SPARE_ROW] as const;

const EVERY_BLOCK: readonly MarketplaceBlock[] = [
  { marketplace: MP_PROJECT, plugins: EVERY_MP_PROJECT_ROW },
  { marketplace: MP_USER, plugins: EVERY_MP_USER_ROW },
  { marketplace: OTHER_PROJECT, plugins: [SOLO_PROJECT_ROW] },
  { marketplace: OTHER_USER, plugins: [SOLO_USER_ROW] },
];

// ---------------------------------------------------------------------------
// Scope selection. The omitted row is also the accepted arity of ZERO
// positionals with no flags: every seeded plugin appears.
// ---------------------------------------------------------------------------

for (const { args, expectedBlocks, label, summary } of [
  {
    args: "",
    label: "scope-omitted",
    summary: "no scope flag lists both scopes",
    expectedBlocks: EVERY_BLOCK,
  },
  {
    args: "--scope user",
    label: "scope-user",
    summary: "a supplied user scope lists the user scope alone",
    expectedBlocks: [
      { marketplace: MP_USER, plugins: EVERY_MP_USER_ROW },
      { marketplace: OTHER_USER, plugins: [SOLO_USER_ROW] },
    ],
  },
  {
    args: "--scope project",
    label: "scope-project",
    summary: "a supplied project scope lists the project scope alone",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: EVERY_MP_PROJECT_ROW },
      { marketplace: OTHER_PROJECT, plugins: [SOLO_PROJECT_ROW] },
    ],
  },
] satisfies readonly {
  args: string;
  expectedBlocks: readonly MarketplaceBlock[];
  label: string;
  summary: string;
}[]) {
  test(`lists the plugins ${summary} (SC-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(projectListing(notifications), expectedBlocks);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The accepted arity of ONE positional: the marketplace narrowing.
// ---------------------------------------------------------------------------

for (const { args, expectedBlocks, label } of [
  {
    args: "mp",
    label: "narrow-mp",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: EVERY_MP_PROJECT_ROW },
      { marketplace: MP_USER, plugins: EVERY_MP_USER_ROW },
    ],
  },
  {
    args: "other",
    label: "narrow-other",
    expectedBlocks: [
      { marketplace: OTHER_PROJECT, plugins: [SOLO_PROJECT_ROW] },
      { marketplace: OTHER_USER, plugins: [SOLO_USER_ROW] },
    ],
  },
] satisfies readonly {
  args: string;
  expectedBlocks: readonly MarketplaceBlock[];
  label: string;
}[]) {
  test(`narrows the listing to the "${args}" marketplace the positional names (PL-3)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(projectListing(notifications), expectedBlocks);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// Each filter alone. One plugin per bucket, so a filter that reached the
// workflow under a neighbour's member name produces a different row set.
// ---------------------------------------------------------------------------

for (const { anchor, args, expectedBlocks, label } of [
  {
    anchor: "PL-1",
    args: INSTALLED_FLAG,
    label: "filter-installed",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [ALPHA_PROJECT_ROW] },
      { marketplace: MP_USER, plugins: [ALPHA_USER_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [SOLO_PROJECT_ROW] },
      { marketplace: OTHER_USER, plugins: [SOLO_USER_ROW] },
    ],
  },
  {
    anchor: "PL-1",
    args: AVAILABLE_FLAG,
    label: "filter-available",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [SPARE_ROW] },
      { marketplace: MP_USER, plugins: [SPARE_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [] },
      { marketplace: OTHER_USER, plugins: [] },
    ],
  },
  {
    anchor: "PL-1",
    args: UNAVAILABLE_FLAG,
    label: "filter-unavailable",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [MISSING_ROW] },
      { marketplace: MP_USER, plugins: [MISSING_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [] },
      { marketplace: OTHER_USER, plugins: [] },
    ],
  },
  {
    anchor: "LIST-01 / D-67-01",
    args: PARTIAL_FLAG,
    label: "filter-partial",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [DEGRADED_ROW] },
      { marketplace: MP_USER, plugins: [DEGRADED_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [] },
      { marketplace: OTHER_USER, plugins: [] },
    ],
  },
  {
    anchor: "RSTA-07 / D-80-07",
    args: REMOTE_FLAG,
    label: "filter-remote",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [FAR_ROW] },
      { marketplace: MP_USER, plugins: [FAR_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [] },
      { marketplace: OTHER_USER, plugins: [] },
    ],
  },
] satisfies readonly {
  anchor: string;
  args: string;
  expectedBlocks: readonly MarketplaceBlock[];
  label: string;
}[]) {
  test(`narrows the listing to the bucket "${args}" selects, leaving the other filters off (${anchor})`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(projectListing(notifications), expectedBlocks);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// Filters combined: the members are independent, not mutually exclusive.
// ---------------------------------------------------------------------------

for (const { args, expectedBlocks, label, summary } of [
  {
    args: `${INSTALLED_FLAG} ${REMOTE_FLAG}`,
    label: "union-two",
    summary: "two filters",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [ALPHA_PROJECT_ROW, FAR_ROW] },
      { marketplace: MP_USER, plugins: [ALPHA_USER_ROW, FAR_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [SOLO_PROJECT_ROW] },
      { marketplace: OTHER_USER, plugins: [SOLO_USER_ROW] },
    ],
  },
  {
    args: `${PARTIAL_FLAG} ${AVAILABLE_FLAG}`,
    label: "union-two-empty",
    summary: "two filters no plugin in the second marketplace matches",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [DEGRADED_ROW, SPARE_ROW] },
      { marketplace: MP_USER, plugins: [DEGRADED_ROW, SPARE_ROW] },
      { marketplace: OTHER_PROJECT, plugins: [] },
      { marketplace: OTHER_USER, plugins: [] },
    ],
  },
  {
    args: `${INSTALLED_FLAG} ${AVAILABLE_FLAG} ${UNAVAILABLE_FLAG} ${PARTIAL_FLAG} ${REMOTE_FLAG}`,
    label: "union-five",
    summary: "all five filters",
    expectedBlocks: EVERY_BLOCK,
  },
] satisfies readonly {
  args: string;
  expectedBlocks: readonly MarketplaceBlock[];
  label: string;
  summary: string;
}[]) {
  test(`unions the buckets ${summary} select (PL-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(projectListing(notifications), expectedBlocks);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// A filter beside the positional: both constraints apply, and the scan claims a
// filter driven on either side of the positional.
// ---------------------------------------------------------------------------

for (const { args, expectedBlocks, label, summary } of [
  {
    args: `mp ${INSTALLED_FLAG}`,
    label: "both-flag-after",
    summary: "a filter driven after the positional",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [ALPHA_PROJECT_ROW] },
      { marketplace: MP_USER, plugins: [ALPHA_USER_ROW] },
    ],
  },
  {
    args: `${INSTALLED_FLAG} mp`,
    label: "both-flag-before",
    summary: "the same filter driven before the positional",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [ALPHA_PROJECT_ROW] },
      { marketplace: MP_USER, plugins: [ALPHA_USER_ROW] },
    ],
  },
  {
    args: `${REMOTE_FLAG} mp`,
    label: "both-remote",
    summary: "a second filter driven before the positional",
    expectedBlocks: [
      { marketplace: MP_PROJECT, plugins: [FAR_ROW] },
      { marketplace: MP_USER, plugins: [FAR_ROW] },
    ],
  },
] satisfies readonly {
  args: string;
  expectedBlocks: readonly MarketplaceBlock[];
  label: string;
  summary: string;
}[]) {
  test(`applies the marketplace narrowing and ${summary} together (PL-1 / PL-3)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(projectListing(notifications), expectedBlocks);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// One above the accepted arity. Rejections size the boundary at one emission,
// zero probes, and no stated `cwd`, so a workflow that ran would read an
// unstated boundary member.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "mp other", label: "arity-two", summary: "two marketplace names" },
  { args: "mp other third", label: "arity-three", summary: "three marketplace names" },
  {
    args: `${INSTALLED_FLAG} mp other`,
    label: "arity-two-with-filter",
    summary: "two marketplace names beside a recognized filter",
  },
]) {
  test(`rejects ${summary} with the too-many-arguments sentence and never reaches the list workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Too many arguments.\n\n${LIST_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// Unknown long options. This shim emits the unknown-OPTION wording.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "--frobnicate", label: "unknown-alone", summary: "driven alone" },
  {
    args: `${INSTALLED_FLAG} --frobnicate`,
    label: "unknown-after-filter",
    summary: "driven after a recognized filter",
  },
  {
    args: "mp --frobnicate",
    label: "unknown-after-positional",
    summary: "driven after the marketplace positional",
  },
]) {
  test(`names an unrecognised long option ${summary} and never reaches the list workflow (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown option: "--frobnicate".\n\n${LIST_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope-target flag. This shim never reaches the shared scope-target
// scanner, so the token is an unrecognised long option here -- alone, and beside
// a scope flag.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: SCOPE_TARGET_FLAG, label: "target-alone", summary: "on its own" },
  {
    args: `--scope user ${SCOPE_TARGET_FLAG}`,
    label: "target-with-scope",
    summary: "beside a scope flag",
  },
]) {
  test(`rejects the scope-target flag ${summary} and never reaches the list workflow (SC-1)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown option: "--local".\n\n${LIST_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The shared prelude: a parse throw carries its own sentence under this shim's
// usage block, and the workflow never runs.
// ---------------------------------------------------------------------------

for (const { args, expectedSentence, label, summary } of [
  {
    args: "mp --scope bogus",
    expectedSentence: 'Invalid --scope value: "bogus". Must be "user" or "project".',
    label: "scope-value-unrecognised",
    summary: "an unrecognised scope value",
  },
  {
    args: "mp --scope",
    expectedSentence: '--scope requires a value: "user" or "project".',
    label: "scope-value-missing",
    summary: "a scope flag with no value",
  },
]) {
  test(`carries the parse failure for ${summary} under this shim's usage block and never reaches the list workflow (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const listHandler = makeListHandler(pi);

    // act
    await listHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${expectedSentence}\n\n${LIST_USAGE}`, severity: "error" },
    ]);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}
