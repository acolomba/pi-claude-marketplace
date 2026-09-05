import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedWorkflows,
  commitPreparedWorkflows,
  prepareStageWorkflows,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { WorkflowTargetOccupiedError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import {
  ManualRecoveryError,
  WorkflowNameCollisionError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type {
  PreparedWorkflowsStaged,
  PreparedWorkflowsStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";
import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const PLUGIN_NAME = "acme";

const GREET_SOURCE =
  'export const meta = { name: "greet", description: "says hi" };\nexport async function run() {}\n';
const SHOUT_SOURCE = 'export const meta = { name: "shout", description: "shouts" };\n';
const WAVE_SOURCE = 'export const meta = { name: "wave", description: "waves" };\n';
const UNDESCRIBED_SOURCE = 'export const meta = { name: "quiet" };\n';
const STEM_FALLBACK_SOURCE = 'export const meta = { description: "loud" };\n';
const NO_META_SOURCE = "export function help() {\n  return 1;\n}\n";
const GREET_REVISED_SOURCE =
  'export const meta = { name: "greet", description: "says hi again" };\n';

/**
 * The complete serialized envelope for `GREET_SOURCE`, transcribed rather than
 * rebuilt: the bytes are the contract, so a reformat, a re-encode or a
 * line-ending normalization must fail the case instead of being recomputed
 * into agreement with itself.
 */
const GREET_ENVELOPE =
  "{\n" +
  '  "name": "acme:greet",\n' +
  '  "description": "says hi",\n' +
  '  "script": "export const meta = { name: \\"greet\\", description: \\"says hi\\" };\\nexport async function run() {}\\n"\n' +
  "}\n";

/** The same again, for the revised script the re-stage case installs over it. */
const GREET_REVISED_ENVELOPE =
  "{\n" +
  '  "name": "acme:greet",\n' +
  '  "description": "says hi again",\n' +
  '  "script": "export const meta = { name: \\"greet\\", description: \\"says hi again\\" };\\n"\n' +
  "}\n";

/** The same, for a script that declares a name and no description. */
const UNDESCRIBED_ENVELOPE =
  "{\n" +
  '  "name": "acme:quiet",\n' +
  '  "script": "export const meta = { name: \\"quiet\\" };\\n"\n' +
  "}\n";

interface WorkflowScope {
  readonly home: string;
  readonly locations: ScopedLocations;
}

/**
 * Relocate the home directory before the bundle is built, and hand the new home
 * back so a case never re-reads a global it just wrote.
 *
 * `locationsFor` evaluates the workflow home eagerly and freezes the result, so
 * a bundle built before the relocation points at the developer's real
 * `~/.pi/workflows/` and every case below would pass while writing there. The
 * restoration is registered before anything is mutated, so a failing assertion
 * cannot leave the variable relocated, and an absent variable is deleted rather
 * than reassigned because `process.env` stringifies every assignment.
 *
 * Nothing under the workflow home is created here: the short-circuit case has
 * to observe that a plugin shipping no workflows leaves that root absent.
 */
async function createWorkflowScope(t: TestContext, prefix: string): Promise<WorkflowScope> {
  const home = await mkdtemp(path.join(tmpdir(), prefix));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 3 });
  });
  process.env.HOME = home;

  const scopeRoot = await mkdtemp(path.join(tmpdir(), `${prefix}scope-`));

  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  return { home, locations: locationsFor("project", scopeRoot) };
}

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));

  t.after(() => rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 }));
  return pluginRoot;
}

/** Create `<pluginRoot>/workflows/` and return it, so a case names it once. */
async function createWorkflowsDir(pluginRoot: string): Promise<string> {
  const workflowsDir = path.join(pluginRoot, "workflows");

  await mkdir(workflowsDir, { recursive: true });
  return workflowsDir;
}

async function writeWorkflowScript(
  workflowsDir: string,
  fileName: string,
  body: string,
): Promise<void> {
  await writeFile(path.join(workflowsDir, fileName), body, "utf8");
}

function resolvedPlugin(
  pluginRoot: string,
  workflows: readonly string[],
): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: PLUGIN_NAME,
    pluginRoot,
    supported: ["workflows"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [...workflows] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

async function pathIsPresent(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Narrow a prepared handle to its staged arm.
 *
 * The staging root and the rename pairs live only on that arm, and a case that
 * reads them must do so inside its act block -- so the narrowing throws instead
 * of asserting, which keeps every assertion in the block that owns it.
 */
function stagedPreparation(prepared: PreparedWorkflowsStaging): PreparedWorkflowsStaged {
  if (prepared.kind !== "staged") {
    throw new Error(`expected a staged preparation, got "${prepared.kind}"`);
  }

  return prepared;
}

/**
 * Redefine one rename pair's path property as a getter.
 *
 * `_renamePairs` is a frozen array whose elements are plain mutable objects, so
 * redefining a property on one element is the only lever into the commit's
 * rollback branches. The resolver is handed the real path, which lets a case
 * return it on the first read and something unusable on every read after that.
 */
function redefineRenamePairPath(
  prepared: PreparedWorkflowsStaged,
  name: string,
  property: "from" | "to",
  resolve: (actual: string) => string,
): void {
  const pair = prepared._renamePairs.find((candidate) => candidate.name === name);

  if (pair === undefined) {
    throw new Error(`no rename pair is named "${name}"`);
  }

  const actual = pair[property];

  Object.defineProperty(pair, property, {
    configurable: true,
    enumerable: true,
    get: () => resolve(actual),
  });
}

describe("prepareStageWorkflows", () => {
  test("short-circuits to a noop and leaves the engine storage root absent", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-noop-");
    const pluginRoot = await createPluginRoot(t, "workflows-noop-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "helper.js", NO_META_SOURCE);
    const expectedSkip =
      `workflow script "helper.js" in "${workflowsDir}" was not installed: ` +
      "helper.js declares no `meta`, so there is nothing to install";

    // act
    const prepared = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    });
    const workflowHomeExists = await pathIsPresent(locations.workflowsHomeDir);

    // assert
    assert.strictEqual(prepared.kind, "noop");
    assert.deepStrictEqual(prepared.result, { stagedNames: [], warnings: [expectedSkip] });
    assert.strictEqual(workflowHomeExists, false);
  });

  test("stages an empty rename set when only previous names remain", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-previous-only-");
    const pluginRoot = await createPluginRoot(t, "workflows-previous-only-source-");
    await createWorkflowsDir(pluginRoot);

    // act
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:gone"],
      }),
    );

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, { stagedNames: [], warnings: [] });
    assert.deepStrictEqual(prepared._renamePairs, []);
    assert.deepStrictEqual(prepared._previousNames, ["acme:gone"]);
  });

  test("stages one envelope carrying the script bytes verbatim", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-envelope-");
    const pluginRoot = await createPluginRoot(t, "workflows-envelope-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const expectedTarget = await locations.workflowArtifactPath("acme:greet");

    // act
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const stagedBytes = await readFile(path.join(prepared.stagingRoot, "acme:greet.json"), "utf8");

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, { stagedNames: ["acme:greet"], warnings: [] });
    assert.deepStrictEqual(
      prepared._renamePairs.map((pair) => pair.name),
      ["acme:greet"],
    );
    assert.deepStrictEqual(
      prepared._renamePairs.map((pair) => pair.to),
      [expectedTarget],
    );
    assert.strictEqual(stagedBytes, GREET_ENVELOPE);
  });

  test("omits the description key rather than emitting an empty one", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-undescribed-");
    const pluginRoot = await createPluginRoot(t, "workflows-undescribed-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "quiet.js", UNDESCRIBED_SOURCE);

    // act
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const stagedBytes = await readFile(path.join(prepared.stagingRoot, "acme:quiet.json"), "utf8");
    const parsedEnvelope: unknown = JSON.parse(stagedBytes);

    // assert
    assert.strictEqual(stagedBytes, UNDESCRIBED_ENVELOPE);
    assert.ok(typeof parsedEnvelope === "object" && parsedEnvelope !== null);
    assert.strictEqual(Object.hasOwn(parsedEnvelope, "description"), false);
  });

  test("stages the stem-fallback envelope and carries its caveat row through", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-stem-");
    const pluginRoot = await createPluginRoot(t, "workflows-stem-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "aaa-quiet.js", STEM_FALLBACK_SOURCE);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const expectedCaveat =
      `workflow script "aaa-quiet.js" in "${workflowsDir}" was installed but will not run: ` +
      "the engine loads a command only from a literal `meta.name` with a non-empty " +
      "`meta.description`, and this script declares no readable name";

    // act
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const fallbackEnvelopeExists = await pathIsPresent(
      path.join(prepared.stagingRoot, "acme:aaa-quiet.json"),
    );

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["acme:aaa-quiet", "acme:greet"],
      warnings: [expectedCaveat],
    });
    assert.strictEqual(fallbackEnvelopeExists, true);
  });

  test("rejects a generated-name collision before any envelope is written", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-collision-");
    const pluginRoot = await createPluginRoot(t, "workflows-collision-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "alpha.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "beta.js", GREET_SOURCE);

    // act
    const error = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const stagingDirExists = await pathIsPresent(locations.workflowsStagingDir);

    // assert
    assert.ok(error instanceof WorkflowNameCollisionError);
    assert.deepStrictEqual(error.collisions, [
      { generatedName: "acme:greet", fileNames: ["alpha.js", "beta.js"] },
    ]);
    assert.strictEqual(stagingDirExists, false);
  });

  test("keeps the first record when one directory is declared under two spellings", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-dedup-");
    const pluginRoot = await createPluginRoot(t, "workflows-dedup-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);

    // act
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows", "./workflows"]),
      }),
    );

    // assert
    assert.deepStrictEqual(prepared.result.stagedNames, ["acme:greet"]);
    assert.deepStrictEqual(
      prepared._renamePairs.map((pair) => pair.name),
      ["acme:greet"],
    );
  });

  test("refuses a staging directory that has been replaced by a symbolic link", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-symlink-");
    const pluginRoot = await createPluginRoot(t, "workflows-symlink-source-");
    const outsideDir = await createPluginRoot(t, "workflows-symlink-outside-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await mkdir(locations.workflowsHomeDir, { recursive: true });
    await symlink(outsideDir, locations.workflowsStagingDir);

    // act
    const error = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const outsideEntries = await readdir(outsideDir);

    // assert
    assert.ok(error instanceof SymlinkRefusedError);
    assert.strictEqual(error.linkPath, locations.workflowsStagingDir);
    assert.deepStrictEqual(outsideEntries, []);
  });

  test("cleans up the staging tree when the write loop fails", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-stage-write-fail-");
    const pluginRoot = await createPluginRoot(t, "workflows-write-fail-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    // Spreading the real bundle is what makes the write loop's only failure
    // point reachable. `SCOPED_LOCATIONS_BRAND` is an enumerable own symbol, so
    // object spread carries it and the result still satisfies the branded type
    // without a cast; no other seam reaches inside that loop.
    const refusingLocations: ScopedLocations = {
      ...locations,
      workflowArtifactPath: (): Promise<string> => Promise.reject(new Error("composer refused")),
    };

    // act
    const error = await prepareStageWorkflows({
      locations: refusingLocations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const stagingEntries = await readdir(locations.workflowsStagingDir);

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual(error.message, "composer refused");
    assert.deepStrictEqual(stagingEntries, []);
  });
});

describe("commitPreparedWorkflows", () => {
  test("renames every envelope into the saved directory and reports both names", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-happy-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-happy-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const stagedGreetBytes = await readFile(
      path.join(prepared.stagingRoot, "acme:greet.json"),
      "utf8",
    );
    const stagedShoutBytes = await readFile(
      path.join(prepared.stagingRoot, "acme:shout.json"),
      "utf8",
    );

    // act
    const commitLeak = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    });
    const savedEntries = (await readdir(locations.workflowsSavedDir)).sort();
    const committedGreetBytes = await readFile(
      path.join(locations.workflowsSavedDir, "acme:greet.json"),
      "utf8",
    );
    const committedShoutBytes = await readFile(
      path.join(locations.workflowsSavedDir, "acme:shout.json"),
      "utf8",
    );
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.strictEqual(commitLeak, undefined);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json", "acme:shout.json"]);
    assert.strictEqual(committedGreetBytes, stagedGreetBytes);
    assert.strictEqual(committedShoutBytes, stagedShoutBytes);
    assert.strictEqual(committedGreetBytes, GREET_ENVELOPE);
    assert.strictEqual(stagingRootExists, false);
    assert.deepStrictEqual(placed, [["acme:greet", "acme:shout"]]);
  });

  test("reports an empty placement for a noop preparation and creates no saved directory", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-noop-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-noop-source-");
    await createWorkflowsDir(pluginRoot);
    const placed: (readonly string[])[] = [];
    const prepared = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    });

    // act
    const commitLeak = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    });
    const savedDirExists = await pathIsPresent(locations.workflowsSavedDir);

    // assert
    assert.strictEqual(prepared.kind, "noop");
    assert.strictEqual(commitLeak, undefined);
    assert.deepStrictEqual(placed, [[]]);
    assert.strictEqual(savedDirExists, false);
  });

  test("commits without an options object at all", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-no-opts-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-no-opts-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );

    // act
    const commitLeak = await commitPreparedWorkflows(prepared);
    const savedEntries = await readdir(locations.workflowsSavedDir);

    // assert
    assert.strictEqual(commitLeak, undefined);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json"]);
  });

  test("keeps the staging tree on the same device as the saved directory", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-device-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-device-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const stagingParent = path.dirname(prepared.stagingRoot);

    // act
    await commitPreparedWorkflows(prepared);
    const stagingParentDevice = (await stat(stagingParent)).dev;
    const savedDevice = (await stat(locations.workflowsSavedDir)).dev;

    // assert
    // What this observes and what it does not: the two directories really do
    // share one filesystem at run time, which is what keeps the commit rename
    // atomic. It is a weak discriminator on its own -- a hermetic home built
    // under the system temporary directory puts both on the same filesystem, so
    // this would still pass if staging were rerouted under a root that also
    // lived there. The cross-configuration invariant in the locations owner test
    // is the guard; this is its runtime corroboration.
    assert.strictEqual(stagingParentDevice, savedDevice);
  });

  test("refuses a target holding foreign content before its first rename", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-occupied-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-occupied-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    const stageInput = {
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    };
    await commitPreparedWorkflows(await prepareStageWorkflows(stageInput));
    const foreignTarget = await locations.workflowArtifactPath("acme:greet");
    await writeFile(foreignTarget, "FOREIGN\n", "utf8");
    const placed: (readonly string[])[] = [];
    const prepared = await prepareStageWorkflows(stageInput);

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = (await readdir(locations.workflowsSavedDir)).sort();
    const foreignBytes = await readFile(foreignTarget, "utf8");

    // assert
    assert.ok(error instanceof WorkflowTargetOccupiedError);
    assert.strictEqual(error.targetPath, foreignTarget);
    // Comparing the whole array of calls, not its last element: the caller's
    // removal payload comes from this callback and never from the error type, so
    // a call that never happened must be distinguishable from a call carrying an
    // empty argument.
    assert.deepStrictEqual(placed, [[]]);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json", "acme:shout.json"]);
    assert.strictEqual(foreignBytes, "FOREIGN\n");
  });

  test("replaces previously recorded envelopes and discards the displaced copies", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-displace-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-displace-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    await commitPreparedWorkflows(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_REVISED_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:greet", "acme:shout"],
      }),
    );

    // act
    const commitLeak = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    });
    const committedGreetBytes = await readFile(
      path.join(locations.workflowsSavedDir, "acme:greet.json"),
      "utf8",
    );
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);
    const stagingEntries = await readdir(locations.workflowsStagingDir);

    // assert
    assert.strictEqual(commitLeak, undefined);
    assert.strictEqual(committedGreetBytes, GREET_REVISED_ENVELOPE);
    assert.strictEqual(stagingRootExists, false);
    assert.deepStrictEqual(stagingEntries, []);
    assert.deepStrictEqual(placed, [["acme:greet", "acme:shout"]]);
  });

  test("restores the displaced envelopes when a re-stage fails mid-sequence", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-restore-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-restore-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    await commitPreparedWorkflows(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_REVISED_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:greet", "acme:shout"],
      }),
    );
    redefineRenamePairPath(prepared, "acme:shout", "from", () =>
      path.join(prepared.stagingRoot, "absent.json"),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = (await readdir(locations.workflowsSavedDir)).sort();
    const restoredGreetBytes = await readFile(
      path.join(locations.workflowsSavedDir, "acme:greet.json"),
      "utf8",
    );
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(placed, [[]]);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json", "acme:shout.json"]);
    assert.strictEqual(restoredGreetBytes, GREET_ENVELOPE);
    assert.strictEqual(stagingRootExists, false);
  });

  test("tolerates a recorded previous name with no file behind it", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-absent-previous-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-absent-previous-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      previousWorkflowNames: ["acme:never"],
    });

    // act
    const commitLeak = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    });
    const savedEntries = await readdir(locations.workflowsSavedDir);

    // assert
    assert.strictEqual(commitLeak, undefined);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json"]);
    assert.deepStrictEqual(placed, [["acme:greet"]]);
  });

  test("propagates a displacement failure that is not a missing previous file", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-displace-fail-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-displace-fail-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await mkdir(locations.workflowsSavedDir, { recursive: true });
    const blockerFile = path.join(locations.workflowsSavedDir, "blocker.json");
    await writeFile(blockerFile, "blocker bytes\n", "utf8");
    // Resolving the previous name to a path underneath a regular file is what
    // makes its displacement fail for a reason other than the file being
    // absent, which is the only reason the displacement tolerates.
    const blockedLocations: ScopedLocations = {
      ...locations,
      workflowArtifactPath: (generatedName: string): Promise<string> =>
        generatedName === "acme:one"
          ? Promise.resolve(path.join(blockerFile, "acme:one.json"))
          : locations.workflowArtifactPath(generatedName),
    };
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations: blockedLocations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:one"],
      }),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = await readdir(locations.workflowsSavedDir);
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual((error as NodeJS.ErrnoException).code, "ENOTDIR");
    assert.deepStrictEqual(placed, [[]]);
    assert.deepStrictEqual(savedEntries, ["blocker.json"]);
    assert.strictEqual(stagingRootExists, false);
  });

  test("restores an already-displaced envelope when a later displacement fails", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-displace-partial-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-displace-partial-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await mkdir(locations.workflowsSavedDir, { recursive: true });
    const survivingTarget = path.join(locations.workflowsSavedDir, "acme:one.json");
    await writeFile(survivingTarget, "previous one bytes\n", "utf8");
    const blockerFile = path.join(locations.workflowsSavedDir, "blocker.json");
    await writeFile(blockerFile, "blocker bytes\n", "utf8");
    // Two recorded previous names where the SECOND displacement fails: the
    // first has already been moved aside by then, so its only copy is inside
    // the staging tree. A single-name case cannot reach this state -- the
    // partial list is the whole point.
    const blockedLocations: ScopedLocations = {
      ...locations,
      workflowArtifactPath: (generatedName: string): Promise<string> =>
        generatedName === "acme:two"
          ? Promise.resolve(path.join(blockerFile, "acme:two.json"))
          : locations.workflowArtifactPath(generatedName),
    };
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations: blockedLocations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:one", "acme:two"],
      }),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = (await readdir(locations.workflowsSavedDir)).sort();
    const survivingBytes = await readFile(survivingTarget, "utf8");
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual((error as NodeJS.ErrnoException).code, "ENOTDIR");
    // The bytes of the envelope displaced BEFORE the failure are the contract:
    // the staging tree is removed on this path, so a displacement list that did
    // not survive the throw takes them with it.
    assert.strictEqual(survivingBytes, "previous one bytes\n");
    assert.deepStrictEqual(savedEntries, ["acme:one.json", "blocker.json"]);
    assert.deepStrictEqual(placed, [[]]);
    assert.strictEqual(stagingRootExists, false);
  });

  test("reverses every completed rename when a later one fails", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-reversed-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-reversed-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    // Only the forward rename of the second pair has to fail here, so the getter
    // is constant: the first pair keeps its real staged path and its reversal
    // therefore succeeds, which is the branch this case is about.
    redefineRenamePairPath(prepared, "acme:shout", "from", () =>
      path.join(prepared.stagingRoot, "absent.json"),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = await readdir(locations.workflowsSavedDir);
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual(error instanceof ManualRecoveryError, false);
    // A reversal that fully succeeded has nothing to leak, and that absence is
    // exactly what separates this case from the one below it.
    assert.doesNotMatch(error.message, /\(additionally:/);
    assert.deepStrictEqual(placed, [[]]);
    assert.deepStrictEqual(savedEntries, []);
    assert.strictEqual(stagingRootExists, false);
  });

  test("reports the still-placed names in discovery order when the reversal fails", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-still-placed-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-still-placed-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    await writeWorkflowScript(workflowsDir, "wave.js", WAVE_SOURCE);
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );
    const rollbackBlocker = path.join(prepared.stagingRoot, "rollback-blocker");
    await mkdir(rollbackBlocker, { recursive: true });
    await writeFile(path.join(rollbackBlocker, "child.txt"), "keep child\n", "utf8");
    // The first two pairs rename forward from their real staged path and then
    // reverse onto a non-empty directory, so both stay placed; the third never
    // renames at all, which is what drives the commit into its rollback.
    for (const stillPlacedName of ["acme:greet", "acme:shout"]) {
      let reads = 0;

      redefineRenamePairPath(prepared, stillPlacedName, "from", (actual) => {
        reads += 1;
        return reads === 1 ? actual : rollbackBlocker;
      });
    }

    redefineRenamePairPath(prepared, "acme:wave", "from", () =>
      path.join(prepared.stagingRoot, "absent.json"),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const savedEntries = (await readdir(locations.workflowsSavedDir)).sort();

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual(error instanceof ManualRecoveryError, false);
    assert.match(error.message, /\(additionally: failed to roll back workflow rename/);
    assert.deepStrictEqual(placed, [["acme:greet", "acme:shout"]]);
    assert.deepStrictEqual(savedEntries, ["acme:greet.json", "acme:shout.json"]);
  });

  test("omits a still-placed name whose target the restore loop reclaimed", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-reclaimed-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-reclaimed-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    await mkdir(locations.workflowsSavedDir, { recursive: true });
    const greetTarget = await locations.workflowArtifactPath("acme:greet");
    await writeFile(greetTarget, "PREVIOUS ENVELOPE\n", "utf8");
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:greet"],
      }),
    );
    const rollbackBlocker = path.join(prepared.stagingRoot, "rollback-blocker");
    await mkdir(rollbackBlocker, { recursive: true });
    await writeFile(path.join(rollbackBlocker, "child.txt"), "keep child\n", "utf8");
    // A replaced name has ONE target path in both lists, so its reversal and
    // its restore compete for the same file. The first pair renames forward
    // from its real staged path and then reverses onto a non-empty directory,
    // which leaves it still placed; the second never renames at all, which is
    // what drives the commit into its rollback.
    let greetReads = 0;

    redefineRenamePairPath(prepared, "acme:greet", "from", (actual) => {
      greetReads += 1;
      return greetReads === 1 ? actual : rollbackBlocker;
    });
    redefineRenamePairPath(prepared, "acme:shout", "from", () =>
      path.join(prepared.stagingRoot, "absent.json"),
    );

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const greetBytes = await readFile(greetTarget, "utf8");

    // assert
    assert.ok(error instanceof Error);
    // `rename(2)` replaces an existing regular file, so the restore put the
    // previous envelope back over the still-placed new one. The target no
    // longer holds anything this commit placed, and a caller acting on the
    // report would delete the envelope the rollback just recovered.
    assert.strictEqual(greetBytes, "PREVIOUS ENVELOPE\n");
    assert.deepStrictEqual(placed, [[]]);
    // The same claim on the human-readable channel. These leak strings are the
    // manual-recovery instructions -- the restore leak beside this one says to
    // move a file back by hand -- so naming a reclaimed target here sends an
    // operator to delete the very bytes the structured report withholds.
    assert.doesNotMatch(error.message, /failed to roll back workflow rename/);
  });

  test("keeps the staging tree when a displaced envelope cannot be restored", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-commit-restore-fail-");
    const pluginRoot = await createPluginRoot(t, "workflows-commit-restore-fail-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await mkdir(locations.workflowsSavedDir, { recursive: true });
    const displacedTarget = path.join(locations.workflowsSavedDir, "acme:one.json");
    await writeFile(displacedTarget, "previous bytes\n", "utf8");
    // Spreading the real bundle again -- the brand is an enumerable own symbol,
    // so the spread keeps the branded type without a cast. Resolving the SECOND
    // previous name runs after the first has already been displaced, which is
    // the only moment at which the freed target can be turned into something a
    // restore cannot rename back onto.
    const displacingLocations: ScopedLocations = {
      ...locations,
      async workflowArtifactPath(generatedName: string): Promise<string> {
        if (generatedName !== "acme:two") {
          return locations.workflowArtifactPath(generatedName);
        }

        await mkdir(displacedTarget, { recursive: true });
        await writeFile(path.join(displacedTarget, "occupant.json"), "occupant\n", "utf8");
        return path.join(locations.workflowsSavedDir, "acme:two.json");
      },
    };
    const placed: (readonly string[])[] = [];
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations: displacingLocations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
        previousWorkflowNames: ["acme:one", "acme:two"],
      }),
    );
    await writeFile(await locations.workflowArtifactPath("acme:greet"), "FOREIGN\n", "utf8");

    // act
    const error = await commitPreparedWorkflows(prepared, {
      onPlaced: (names) => placed.push(names),
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);
    // Naming the displaced subdirectory is the point of the case: the staging
    // tree survives precisely because it holds the only copy of these bytes.
    const survivingBytes = await readFile(
      path.join(prepared.stagingRoot, ".previous", "acme:one.json"),
      "utf8",
    );

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual(stagingRootExists, true);
    assert.strictEqual(error.message.includes(prepared.stagingRoot), true);
    assert.strictEqual(survivingBytes, "previous bytes\n");
    assert.deepStrictEqual(placed, [[]]);
  });
});

describe("abortPreparedWorkflows", () => {
  test("removes nothing for a noop preparation", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-abort-noop-");
    const pluginRoot = await createPluginRoot(t, "workflows-abort-noop-source-");
    await createWorkflowsDir(pluginRoot);
    const prepared = await prepareStageWorkflows({
      locations,
      pluginName: PLUGIN_NAME,
      resolved: resolvedPlugin(pluginRoot, ["workflows"]),
    });

    // act
    const abortLeak = await abortPreparedWorkflows(prepared);
    const workflowHomeExists = await pathIsPresent(locations.workflowsHomeDir);

    // assert
    assert.strictEqual(prepared.kind, "noop");
    assert.strictEqual(abortLeak, undefined);
    assert.strictEqual(workflowHomeExists, false);
  });

  test("removes the staging tree of a staged preparation", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-abort-staged-");
    const pluginRoot = await createPluginRoot(t, "workflows-abort-staged-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );

    // act
    const abortLeak = await abortPreparedWorkflows(prepared);
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);

    // assert
    assert.strictEqual(abortLeak, undefined);
    assert.strictEqual(stagingRootExists, false);
  });

  test("empties a staging tree holding several envelopes", async (t) => {
    // arrange
    const { locations } = await createWorkflowScope(t, "workflows-abort-many-");
    const pluginRoot = await createPluginRoot(t, "workflows-abort-many-source-");
    const workflowsDir = await createWorkflowsDir(pluginRoot);
    await writeWorkflowScript(workflowsDir, "greet.js", GREET_SOURCE);
    await writeWorkflowScript(workflowsDir, "shout.js", SHOUT_SOURCE);
    await writeWorkflowScript(workflowsDir, "wave.js", WAVE_SOURCE);
    const prepared = stagedPreparation(
      await prepareStageWorkflows({
        locations,
        pluginName: PLUGIN_NAME,
        resolved: resolvedPlugin(pluginRoot, ["workflows"]),
      }),
    );

    // act
    const abortLeak = await abortPreparedWorkflows(prepared);
    // The removal order inside the tree is deliberately unspecified; what the
    // abort guarantees is the tree being gone, whatever order it walked.
    const stagingRootExists = await pathIsPresent(prepared.stagingRoot);
    const stagingEntries = await readdir(locations.workflowsStagingDir);

    // assert
    assert.deepStrictEqual(prepared.result.stagedNames, ["acme:greet", "acme:shout", "acme:wave"]);
    assert.strictEqual(abortLeak, undefined);
    assert.strictEqual(stagingRootExists, false);
    assert.deepStrictEqual(stagingEntries, []);
  });
});
