// Owner for edge/handlers/plugin/reinstall.ts (MOD-09).
//
// This shim accepts zero or one positional and maps it onto the three target
// forms the reinstall workflow takes: no positional is the all form, a leading
// separator followed by a name is the marketplace form, and anything else is
// split into a plugin reference. RINST-01 / D-67-03 make the overwrite of
// collisions and foreign content unconditional, so there is no command-local
// overwrite flag and the retired one now fails as an unknown flag.
//
// The interesting property is a TWO-STAGE flag rejection, and the two stages
// emit DIFFERENT sentences:
//   * stage one is the shared scanner, which this handler calls with an EMPTY
//     pass-through list, so every long flag it sees is rejected with the
//     unknown-FLAG sentence;
//   * stage two is this handler's own positional loop, reached only by a token
//     the shared scanner did not see as a long flag. The shared scanner splits
//     on whitespace and reads the raw characters, while the tokenizer behind it
//     strips quotes, so a QUOTED long flag passes stage one as an ordinary word
//     and is reassembled into a long-flag-shaped token before the loop reads it.
//     That token takes the unknown-OPTION sentence.
// Both sentences are hand-authored here and neither is carried across from a
// sibling: the rejecting siblings do not agree on the wording, and this shim
// uses BOTH forms, one per stage.
//
// Which parser a module calls decides its arity and flag answers, so all of the
// following were measured against the real module before a case was written:
//   * ZERO and ONE positional are both accepted, and TWO is rejected with the
//     too-many-arguments sentence. There is no arity below zero, so only the
//     surplus half of the arity obligation has a target here;
//   * the scope-target flag is ACCEPTED. It reaches the shared scanner, which
//     consumes it and strips it from the residual, and it discriminates: the
//     write-back lands in the override config layer instead of the base one;
//   * a scope flag and the scope-target flag driven TOGETHER are ACCEPTED and
//     both honoured -- the user scope's override layer takes the write-back --
//     so the inherited "mutually exclusive selectors are rejected" claim has no
//     target on this module;
//   * a lone separator is NOT the marketplace form. That branch demands a length
//     beyond the separator, so a bare separator falls through to the reference
//     split and takes the malformed-reference sentence.
//
// D-116-05 (O3) places this handler in Group C: `reinstallPlugins` is reached by
// direct import with no injection point, so a delegating case cannot state an
// exact argument list against it. That exact-argument gap is this owner's
// recorded scope. Delegation is observed instead as the minimal on-disk effect a
// reinstall leaves: which skill directories each scope root carries afterwards,
// and which config layer the write-back landed in. Each seeded plugin owns a
// DIFFERENTLY NAMED skill directory and each scope a different marketplace, so a
// command that reached the wrong form, the wrong marketplace, or the wrong scope
// materialises the wrong name rather than merely materialising nothing.
//
// The negative half of D-116-06 is proven in full. A rejecting case sizes the
// boundary at one emission, zero probes, and NO stated working directory, and
// also reads back the empty footprint, so "the workflow never ran" is asserted
// as an absence of recorded state as well as at the boundary. The zero-probe
// half is a post-hoc report from the boundary's own verification rather than a
// crash -- the soft-dependency probe swallows its own throw -- so every case
// calls `verifyBoundary()` and none relies on the workflow dying.
//
// Measured boundary counts, taken through a counting context before a case was
// written, because the two paths disagree:
//   * a rejection reads `ctx.ui` once, `ctx.cwd` never, and `pi.getAllTools()`
//     never -- the usage-error channel writes straight to `ctx.ui`;
//   * a delegating command reads `ctx.ui` once, `ctx.cwd` once, and
//     `pi.getAllTools()` TWICE, on every target form, scope and flag
//     combination.
//
// Both scope roots are values this file chose: `<cwd>/.pi` for the project scope
// and `<HOME>/.pi/agent` for the user scope, with the agent-directory variable
// DELETED rather than overwritten, because `getAgentDir()` reads it ahead of
// `homedir()` and an ambient value would defeat a hermetic HOME (SC-1).
//
// NFR-5: the git transport door is `https.request`, replaced by a counting
// fail-fast throw and asserted at zero in every case. `globalThis.fetch` is
// deliberately NOT the door watched -- the git transport reaches the wire
// through `simple-get` -> `https.request`, and this repo's only `fetch` caller
// is the device-flow credential path, which no reinstall invocation enters. One
// case seeds a COLD git source as the installed plugin, which is the input that
// would need the network to resolve any further; the no-network resolver answers
// first and the row renders offline. Nothing in the reachable input space turns
// materialisation on, so no positive control is available here: the zero is a
// regression guard on NFR-5, and the offline row beside it is what says the
// workflow answered from disk.
//
// This pair makes no exhaustiveness claim: the target selection is a chain of
// `if` statements over string shapes, not a `switch` over a closed union, so a
// missing-arm plant has no target here. No case asserts the absence of direct
// process output (ESLint and fallow own that), none re-proves the shared flag
// scan owned by tests/edge/handlers/shared.test.ts or the reference split owned
// by tests/edge/handlers/plugin/shared.test.ts, none restates the tokenizer
// diagnostics owned by tests/edge/args.test.ts, none restates the retired
// vocabulary guard owned by tests/architecture/partial-vocabulary-guard.test.ts,
// and none re-derives the reinstall workflow's own row grammar, which
// tests/orchestrators/plugin/reinstall.test.ts owns.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { makeReinstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";
import {
  buildInstalledPluginRecord,
  materializeMarketplaceTree,
  mergeMarketplaceIntoState,
} from "../marketplace-seed.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The usage block this shim appends after a blank line to every rejection. */
const REINSTALL_USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--local]";

/** The bytes of the one skill each seeded plugin carries. */
const SKILL_SOURCE = "---\nname: tool\ndescription: A tool skill.\n---\n\nBody.\n";

/** Every place a reinstall could leave a record, read back as one value. */
interface Footprint {
  readonly projectSkills: readonly string[];
  readonly userSkills: readonly string[];
  readonly projectBase: unknown;
  readonly projectLocal: unknown;
  readonly userBase: unknown;
  readonly userLocal: unknown;
}

/** Nothing materialised and nothing declared: the footprint a rejection leaves. */
const NOTHING_REINSTALLED: Footprint = {
  projectSkills: [],
  userSkills: [],
  projectBase: undefined,
  projectLocal: undefined,
  userBase: undefined,
  userLocal: undefined,
};

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
  const cwd = await mkdtemp(path.join(tmpdir(), `plugin-reinstall-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `plugin-reinstall-${label}-home-`));
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
    throw new Error("reinstall must not open a network connection");
  });
  return {
    cwd,
    projectRoot: path.join(cwd, ".pi"),
    userRoot: path.join(home, ".pi", "agent"),
    transportCalls: (): number => requestSpy.mock.callCount(),
  };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/**
 * Materialise one path-source marketplace tree under the working directory and
 * record every one of its plugins as installed in the given scope's state file.
 * Each plugin carries one skill directory, which is what a reinstall writes back
 * into the scope's resources root.
 */
async function seedMarketplace(
  workspace: HermeticWorkspace,
  scope: Scope,
  marketplace: string,
  plugins: readonly string[],
): Promise<void> {
  const marketplaceRoot = path.join(workspace.cwd, `${marketplace}-src`);
  await materializeMarketplaceTree(marketplaceRoot, {});
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "seed-owner" },
      plugins: plugins.map((plugin) => ({
        name: plugin,
        source: `./${plugin}`,
        version: "1.0.0",
      })),
    }),
  );
  for (const plugin of plugins) {
    await writeUnder(
      path.join(marketplaceRoot, plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "1.0.0" }),
    );
    await writeUnder(
      path.join(marketplaceRoot, plugin, "skills", "tool", "SKILL.md"),
      SKILL_SOURCE,
    );
  }

  const scopeRoot = scope === "project" ? workspace.projectRoot : workspace.userRoot;
  await mergeMarketplaceIntoState(path.join(scopeRoot, "pi-claude-marketplace"), marketplace, {
    name: marketplace,
    scope,
    source: { kind: "path", raw: `./${marketplace}-src`, logical: `./${marketplace}-src` },
    addedFromCwd: workspace.cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: Object.fromEntries(
      plugins.map((plugin) => [
        plugin,
        buildInstalledPluginRecord(
          { version: "1.0.0", resolvedSource: `./${plugin}` },
          { skills: [`${plugin}-tool`], prompts: [], agents: [], mcpServers: [], hooks: [] },
        ),
      ]),
    ),
  });
}

/**
 * Two marketplaces in the project scope, one of them holding two plugins, and a
 * third marketplace in the user scope. Every plugin name, and therefore every
 * skill directory name, is distinct across the whole workspace, so a command
 * that reached the wrong target form or the wrong scope root materialises a name
 * the case did not promise.
 */
async function seedBothScopes(workspace: HermeticWorkspace): Promise<void> {
  await seedMarketplace(workspace, "project", "mp", ["alpha", "beta"]);
  await seedMarketplace(workspace, "project", "other", ["gamma"]);
  await seedMarketplace(workspace, "user", "umkt", ["delta"]);
}

async function readSkillDirectories(scopeRoot: string): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(path.join(scopeRoot, "pi-claude-marketplace", "resources", "skills"), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function readConfigLayer(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }

  return JSON.parse(raw) as unknown;
}

/** Both scopes' materialised skills and both scopes' config layers. */
async function readFootprint(workspace: HermeticWorkspace): Promise<Footprint> {
  return {
    projectSkills: await readSkillDirectories(workspace.projectRoot),
    userSkills: await readSkillDirectories(workspace.userRoot),
    projectBase: await readConfigLayer(path.join(workspace.projectRoot, "claude-plugins.json")),
    projectLocal: await readConfigLayer(
      path.join(workspace.projectRoot, "claude-plugins.local.json"),
    ),
    userBase: await readConfigLayer(path.join(workspace.userRoot, "claude-plugins.json")),
    userLocal: await readConfigLayer(path.join(workspace.userRoot, "claude-plugins.local.json")),
  };
}

const ALL_PLUGINS_MESSAGE =
  "● mp [project]\n" +
  "  ● alpha v1.0.0 (reinstalled)\n" +
  "  ● beta v1.0.0 (reinstalled)\n\n" +
  "● other [project]\n" +
  "  ● gamma v1.0.0 (reinstalled)\n\n" +
  "● umkt [user]\n" +
  "  ● delta v1.0.0 (reinstalled)\n\n" +
  "Plugin reinstall: 4 successes\n\n" +
  "/reload to pick up changes";

const PROJECT_SCOPE_MESSAGE =
  "● mp [project]\n" +
  "  ● alpha v1.0.0 (reinstalled)\n" +
  "  ● beta v1.0.0 (reinstalled)\n\n" +
  "● other [project]\n" +
  "  ● gamma v1.0.0 (reinstalled)\n\n" +
  "Plugin reinstall: 3 successes\n\n" +
  "/reload to pick up changes";

const USER_SCOPE_MESSAGE =
  "● umkt [user]\n" +
  "  ● delta v1.0.0 (reinstalled)\n\n" +
  "Plugin reinstall: 1 success\n\n" +
  "/reload to pick up changes";

const MARKETPLACE_FORM_MESSAGE =
  "● mp [project]\n" +
  "  ● alpha v1.0.0 (reinstalled)\n" +
  "  ● beta v1.0.0 (reinstalled)\n\n" +
  "Plugin reinstall: 2 successes\n\n" +
  "/reload to pick up changes";

const PLUGIN_FORM_MESSAGE =
  "● mp [project]\n  ● alpha v1.0.0 (reinstalled)\n\n/reload to pick up changes";

const ALL_PLUGINS_DECLARED = {
  schemaVersion: 1,
  plugins: { "alpha@mp": {}, "beta@mp": {}, "gamma@other": {} },
};

const USER_PLUGIN_DECLARED = { schemaVersion: 1, plugins: { "delta@umkt": {} } };

const MARKETPLACE_FORM_DECLARED = {
  schemaVersion: 1,
  plugins: { "alpha@mp": {}, "beta@mp": {} },
};

// ---------------------------------------------------------------------------
// The three target forms. Each narrower form must leave the names the wider one
// touches alone, which is what the distinct skill directory names make visible.
// ---------------------------------------------------------------------------

test("re-materialises every installed plugin in both scopes when no positional is supplied (RINST-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "all-form");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: ALL_PLUGINS_MESSAGE }]);
  assert.deepStrictEqual(await readFootprint(workspace), {
    projectSkills: ["alpha-tool", "beta-tool", "gamma-tool"],
    userSkills: ["delta-tool"],
    projectBase: ALL_PLUGINS_DECLARED,
    projectLocal: undefined,
    userBase: USER_PLUGIN_DECLARED,
    userLocal: undefined,
  });
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

test("re-materialises only the named marketplace when a bare marketplace reference is supplied (RINST-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "marketplace-form");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("@mp", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: MARKETPLACE_FORM_MESSAGE }]);
  assert.deepStrictEqual(await readFootprint(workspace), {
    projectSkills: ["alpha-tool", "beta-tool"],
    userSkills: [],
    projectBase: MARKETPLACE_FORM_DECLARED,
    projectLocal: undefined,
    userBase: undefined,
    userLocal: undefined,
  });
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

test("re-materialises only the named plugin when a plugin reference is supplied (RINST-01)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "plugin-form");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("alpha@mp", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: PLUGIN_FORM_MESSAGE }]);
  assert.deepStrictEqual(await readFootprint(workspace), {
    projectSkills: ["alpha-tool"],
    userSkills: [],
    projectBase: { schemaVersion: 1, plugins: { "alpha@mp": {} } },
    projectLocal: undefined,
    userBase: undefined,
    userLocal: undefined,
  });
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// The scope member. Each scope holds a different marketplace, so a scope flag
// that selected the wrong root would name the wrong plugin.
// ---------------------------------------------------------------------------

for (const { expectedFootprint, expectedMessage, scopeValue } of [
  {
    scopeValue: "project",
    expectedMessage: PROJECT_SCOPE_MESSAGE,
    expectedFootprint: {
      projectSkills: ["alpha-tool", "beta-tool", "gamma-tool"],
      userSkills: [],
      projectBase: ALL_PLUGINS_DECLARED,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    },
  },
  {
    scopeValue: "user",
    expectedMessage: USER_SCOPE_MESSAGE,
    expectedFootprint: {
      projectSkills: [],
      userSkills: ["delta-tool"],
      projectBase: undefined,
      projectLocal: undefined,
      userBase: USER_PLUGIN_DECLARED,
      userLocal: undefined,
    },
  },
] satisfies readonly {
  expectedFootprint: Footprint;
  expectedMessage: string;
  scopeValue: string;
}[]) {
  test(`re-materialises the ${scopeValue} scope alone when that scope is selected (SCOPE-01)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, `scope-${scopeValue}`);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(`--scope ${scopeValue}`, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
    assert.deepStrictEqual(await readFootprint(workspace), expectedFootprint);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

for (const { args, placement } of [
  { args: "--scope project @mp", placement: "before the positional" },
  { args: "@mp --scope project", placement: "after the positional" },
]) {
  test(`selects the project scope when the scope flag appears ${placement} (AP-4)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "scope-position");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: MARKETPLACE_FORM_MESSAGE }]);
    assert.deepStrictEqual(await readFootprint(workspace), {
      projectSkills: ["alpha-tool", "beta-tool"],
      userSkills: [],
      projectBase: MARKETPLACE_FORM_DECLARED,
      projectLocal: undefined,
      userBase: undefined,
      userLocal: undefined,
    });
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// The scope-target flag. It is ACCEPTED here, and it discriminates: the same
// reference without it declares the write-back in the base layer above, and with
// it in the override layer. Both placements are driven because the shared
// scanner promises position independence (WR-02).
// ---------------------------------------------------------------------------

for (const { args, placement } of [
  { args: "--local @mp", placement: "before the positional" },
  { args: "@mp --local", placement: "after the positional" },
]) {
  test(`declares the write-back in the override layer when the scope-target flag appears ${placement} (WB-01)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, "scope-target-position");
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
      value: workspace.cwd,
      reads: 1,
    });
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [{ message: MARKETPLACE_FORM_MESSAGE }]);
    assert.deepStrictEqual(await readFootprint(workspace), {
      projectSkills: ["alpha-tool", "beta-tool"],
      userSkills: [],
      projectBase: undefined,
      projectLocal: MARKETPLACE_FORM_DECLARED,
      userBase: undefined,
      userLocal: undefined,
    });
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

test("honours a scope flag and the scope-target flag driven together (WB-02)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "both-selectors");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("--scope user --local", ctx);

  // assert
  assert.deepStrictEqual(notifications, [{ message: USER_SCOPE_MESSAGE }]);
  assert.deepStrictEqual(await readFootprint(workspace), {
    projectSkills: [],
    userSkills: ["delta-tool"],
    projectBase: undefined,
    projectLocal: undefined,
    userBase: undefined,
    userLocal: USER_PLUGIN_DECLARED,
  });
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// NFR-5, the network half. A COLD git source recorded as the installed plugin is
// the input that would need the network to resolve any further; the no-network
// resolver answers first and the row renders offline.
// ---------------------------------------------------------------------------

test("answers a cold git source from the no-network resolver without opening a connection (NFR-5)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "cold-git-source");
  const marketplaceRoot = path.join(workspace.cwd, "mp-src");
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      owner: { name: "seed-owner" },
      plugins: [{ name: "far", source: "https://127.0.0.1:9/far.git", version: "1.0.0" }],
    }),
  );
  await mergeMarketplaceIntoState(path.join(workspace.projectRoot, "pi-claude-marketplace"), "mp", {
    name: "mp",
    scope: "project",
    source: { kind: "path", raw: "./mp-src", logical: "./mp-src" },
    addedFromCwd: workspace.cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {
      far: buildInstalledPluginRecord(
        { version: "1.0.0", resolvedSource: "https://127.0.0.1:9/far.git" },
        { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      ),
    },
  });
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2, {
    value: workspace.cwd,
    reads: 1,
  });
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("far@mp", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ far (failed) {source mismatch}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// One above the accepted arity. There is no arity below zero, so the surplus
// half is the only half of the arity obligation with a target on this module.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: "alpha@mp beta@mp", label: "arity-two", summary: "two references" },
  { args: "alpha@mp beta@mp gamma@other", label: "arity-three", summary: "three references" },
  {
    args: "--scope project alpha@mp beta@mp",
    label: "arity-two-project",
    summary: "two references beside a project scope flag",
  },
  {
    args: "--scope user alpha@mp beta@mp",
    label: "arity-two-user",
    summary: "two references beside a user scope flag",
  },
]) {
  test(`rejects ${summary} with the too-many-arguments sentence and re-materialises nothing (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Too many arguments.\n\n${REINSTALL_USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// Malformed references. The lone separator belongs here rather than with the
// marketplace form: that branch demands a length beyond the separator, so a bare
// separator falls through to the reference split.
// ---------------------------------------------------------------------------

for (const { label, reference, summary } of [
  { label: "no-separator", reference: "noseparator", summary: "carries no separator" },
  { label: "trailing-separator", reference: "alpha@", summary: "ends at the separator" },
  { label: "lone-separator", reference: "@", summary: "is the separator alone" },
]) {
  test(`rejects a reference that ${summary} and re-materialises nothing (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(reference, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Invalid <plugin>@<marketplace> ref: "${reference}".\n\n${REINSTALL_USAGE}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// Flag rejection, STAGE ONE: the shared scanner, called with an empty
// pass-through list, so every long flag it sees takes the unknown-FLAG sentence.
// ---------------------------------------------------------------------------

for (const { args, label, offendingToken, summary } of [
  {
    args: "--frobnicate",
    label: "stage-one-alone",
    offendingToken: "--frobnicate",
    summary: "driven alone",
  },
  {
    args: "@mp --frobnicate",
    label: "stage-one-behind-reference",
    offendingToken: "--frobnicate",
    summary: "driven behind a reference",
  },
  {
    args: "--scope project --frobnicate",
    label: "stage-one-beside-scope",
    offendingToken: "--frobnicate",
    summary: "driven beside a scope flag",
  },
]) {
  test(`reports an unrecognised long flag ${summary} as an unknown FLAG and re-materialises nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown flag: "${offendingToken}".\n\n${REINSTALL_USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

test("rejects the retired overwrite flag as an unknown flag rather than accepting it (RINST-01 / D-67-03)", async (t) => {
  // arrange
  const workspace = await createHermeticWorkspace(t, "retired-overwrite-flag");
  await seedBothScopes(workspace);
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const reinstallHandler = makeReinstallHandler(pi);

  // act
  await reinstallHandler("alpha@mp --force", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Unknown flag: "--force".\n\n${REINSTALL_USAGE}`, severity: "error" },
  ]);
  assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
  assert.strictEqual(workspace.transportCalls(), 0);
  verifyBoundary();
});

// ---------------------------------------------------------------------------
// Flag rejection, STAGE TWO: the handler's own positional loop. The shared
// scanner splits on whitespace and reads raw characters, while the tokenizer
// behind it strips quotes, so each of these survives stage one as an ordinary
// word and is reassembled into a long-flag-shaped token. The sentence is the
// unknown-OPTION form, which stage one never emits.
// ---------------------------------------------------------------------------

for (const { args, label, summary } of [
  { args: '"--frobnicate"', label: "stage-two-double", summary: "wrapped in double quotes" },
  { args: "'--frobnicate'", label: "stage-two-single", summary: "wrapped in single quotes" },
  {
    args: '"--"frobnicate',
    label: "stage-two-split",
    summary: "split so only its prefix is quoted",
  },
  {
    args: '--scope project "--frobnicate"',
    label: "stage-two-beside-scope",
    summary: "wrapped in double quotes beside a scope flag",
  },
]) {
  test(`reports a quoted long flag ${summary} as an unknown OPTION and re-materialises nothing (D-116-06)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown option: "--frobnicate".\n\n${REINSTALL_USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}

// ---------------------------------------------------------------------------
// An unrecognised scope value reaches the tokenizer only AFTER the shared
// scanner has consumed the pair, so the thrown message arrives under this shim's
// usage block.
// ---------------------------------------------------------------------------

for (const { args, expectedSentence, label, summary } of [
  {
    args: "--scope bogus",
    expectedSentence: 'Invalid --scope value: "bogus". Must be "user" or "project".',
    label: "scope-value-unrecognised",
    summary: "an unrecognised scope value",
  },
  {
    args: "--scope",
    expectedSentence: '--scope requires a value: "user" or "project".',
    label: "scope-value-missing",
    summary: "a scope flag with no value",
  },
]) {
  test(`carries the parse failure for ${summary} under this shim's usage block and re-materialises nothing (MSG-NC-2)`, async (t) => {
    // arrange
    const workspace = await createHermeticWorkspace(t, label);
    await seedBothScopes(workspace);
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
    const reinstallHandler = makeReinstallHandler(pi);

    // act
    await reinstallHandler(args, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${expectedSentence}\n\n${REINSTALL_USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(await readFootprint(workspace), NOTHING_REINSTALLED);
    assert.strictEqual(workspace.transportCalls(), 0);
    verifyBoundary();
  });
}
