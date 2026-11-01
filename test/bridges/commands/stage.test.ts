import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify } from "strong-mock";

import {
  abortPreparedCommands,
  commitPreparedCommands,
  prepareStageCommands,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { CleanupLeakError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  ProjectCommandChange,
  ProjectCommandLedger,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts";
import type { PreparedCommandsStaged } from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";
import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { RemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

const PLUGIN_NAME = "acme";

/** A ledger that accepts every change; the cases about the ledger build their own. */
const projectLedger = { update: () => Promise.resolve() } satisfies ProjectCommandLedger;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function createProjectLocations(t: TestContext, prefix: string): Promise<ScopedLocations> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 }));
  return pluginRoot;
}

function resolvedFor(
  pluginRoot: string,
  commandPaths: readonly string[] = ["commands"],
): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: PLUGIN_NAME,
    pluginRoot,
    supported: commandPaths.length === 0 ? [] : ["commands"],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: [],
      commands: [...commandPaths],
      agents: [],
      workflows: [],
    },
    mcpServers: {},
    defaultEnabled: true,
  };
}

/** The D-CF3-06 record line a staged command ends its frontmatter with. */
function recordLine(pluginRoot: string, pluginData: string): string {
  return `"pi-claude-marketplace": {"pluginRoot":"${pluginRoot}","pluginData":"${pluginData}"}\n`;
}

async function pathIsPresent(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

test("stages recursive commands with exact names, records, substitutions, and prompt bytes", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-complete-");
  const pluginRoot = await createPluginRoot(t, "commands-source-complete-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const pluginDataDir = path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME);
  const deploySource =
    "---\ndescription: Deploy the service\n---\n" +
    "Deploy from ${CLAUDE_PLUGIN_ROOT} in ${CLAUDE_PROJECT_DIR}.\n";
  const statusSource =
    "---\ndescription: Show status\n---\n" + "Read ${CLAUDE_PLUGIN_DATA}/status.json.\n";
  const nestedSource = "---\ndescription: Build the web app\n---\nBuild web.\n";
  const expectedDeploy =
    '---\n"description": "Deploy the service"\n' +
    recordLine(pluginRoot, pluginDataDir) +
    "---\n" +
    `Deploy from ${pluginRoot} in ${locations.scopeRoot}.\n`;
  const expectedStatus =
    '---\n"description": "Show status"\n' +
    recordLine(pluginRoot, pluginDataDir) +
    "---\n" +
    `Read ${pluginDataDir}/status.json.\n`;
  await mkdir(path.join(commandsRoot, "build"), { recursive: true });
  await writeFile(path.join(commandsRoot, "acme-deploy.md"), deploySource);
  await writeFile(path.join(commandsRoot, "status.md"), statusSource);
  await writeFile(path.join(commandsRoot, "build", "web.md"), nestedSource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const promptNames = (await readdir(locations.promptsTargetDir)).sort();
  const deployBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:deploy.md"),
    "utf8",
  );
  const nestedBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:build:web.md"),
    "utf8",
  );
  const statusBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:status.md"),
    "utf8",
  );

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result, {
    stagedNames: ["acme:deploy", "acme:build:web", "acme:status"],
    recorded: [
      {
        generatedName: "acme:deploy",
        sourcePath: path.join(commandsRoot, "acme-deploy.md"),
        targetPath: path.join(locations.promptsTargetDir, "acme:deploy.md"),
      },
      {
        generatedName: "acme:build:web",
        sourcePath: path.join(commandsRoot, "build", "web.md"),
        targetPath: path.join(locations.promptsTargetDir, "acme:build:web.md"),
      },
      {
        generatedName: "acme:status",
        sourcePath: path.join(commandsRoot, "status.md"),
        targetPath: path.join(locations.promptsTargetDir, "acme:status.md"),
      },
    ],
    warnings: [],
    degraded: [],
  });
  assert.strictEqual(commitLeak, undefined);
  assert.deepStrictEqual(promptNames, ["acme:build:web.md", "acme:deploy.md", "acme:status.md"]);
  assert.strictEqual(deployBytes, expectedDeploy);
  assert.strictEqual(
    nestedBytes,
    '---\n"description": "Build the web app"\n' +
      recordLine(pluginRoot, pluginDataDir) +
      "---\nBuild web.\n",
  );
  assert.strictEqual(statusBytes, expectedStatus);
});

test("rewrites skill and command references in staged command Markdown", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-cross-references-");
  const pluginRoot = await createPluginRoot(t, "commands-cross-references-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(
    path.join(commandsRoot, "review.md"),
    "---\ndescription: Review\n---\nUse acme:helper, then /acme:review.\n",
  );

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data"),
    resolved: resolvedFor(pluginRoot),
    referenceNames: { skills: ["acme-helper"], commands: ["acme:review"], workflows: [] },
  });
  assert.strictEqual(prepared.kind, "staged");
  const content = await readFile(path.join(prepared.stagingRoot, "acme:review.md"), "utf8");

  // assert
  assert.strictEqual(
    content,
    '---\n"description": "Review"\n' +
      recordLine(pluginRoot, path.join(locations.scopeRoot, "plugin-data")) +
      "---\nUse /skill:acme-helper, then /acme:review.\n",
  );
});

test("stages a source led by a byte-order mark without the marker or a duplicated fence", async (t) => {
  // arrange
  // FMBOM-01: a marker raises no gate-1 throw, so no CMD-01 degrade fires and
  // the marker would ride into the staged prompt, where Pi's loader drops
  // the whole block at load time. The assertion reads
  // the COMMITTED bytes, not a parse result: the installed peer tolerates a
  // leading marker in its own parser, so a parse-only check would pass without
  // the strip.
  const locations = await createProjectLocations(t, "commands-stage-bom-");
  const pluginRoot = await createPluginRoot(t, "commands-source-bom-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const pluginDataDir = path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME);
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(
    path.join(commandsRoot, "deploy.md"),
    "\uFEFF---\ndescription: Deploy the service\nmodel: sonnet\n---\nDeploy carefully.\n",
  );
  const expectedDeploy =
    '---\n"description": "Deploy the service"\n"model": "sonnet"\n' +
    recordLine(pluginRoot, pluginDataDir) +
    "---\nDeploy carefully.\n";

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const deployBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:deploy.md"),
    "utf8",
  );

  // assert
  assert.strictEqual(commitLeak, undefined);
  assert.deepStrictEqual(prepared.result, {
    stagedNames: ["acme:deploy"],
    recorded: [
      {
        generatedName: "acme:deploy",
        sourcePath: path.join(commandsRoot, "deploy.md"),
        targetPath: path.join(locations.promptsTargetDir, "acme:deploy.md"),
      },
    ],
    warnings: [{ kind: "discovery", message: "[deploy] dropped fields: model" }],
    degraded: [],
  });
  assert.strictEqual(deployBytes, expectedDeploy);
});

test("returns a complete no-op and materializes no command directories", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-noop-");
  const pluginRoot = await createPluginRoot(t, "commands-source-noop-");

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot, []),
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);
  const stagingExists = await pathIsPresent(locations.commandsStagingDir);
  const promptsExist = await pathIsPresent(locations.promptsTargetDir);

  // assert
  assert.deepStrictEqual(prepared, {
    kind: "noop",
    result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
  });
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(abortLeak, undefined);
  assert.strictEqual(stagingExists, false);
  assert.strictEqual(promptsExist, false);
});

test("refuses an outside previous command before changing its complete target tree", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-outside-target-");
  const resourcesRoot = path.dirname(locations.promptsTargetDir);
  const outsideFile = path.join(resourcesRoot, "outside", "command.md");
  await mkdir(path.dirname(outsideFile), { recursive: true });
  await writeFile(outsideFile, "outside command\n");
  const targetTreeBefore = (await readdir(resourcesRoot, { recursive: true })).sort();
  const outsideBytesBefore = await readFile(outsideFile);
  const expectedError = {
    name: "PathContainmentError",
    message: `previous command file escapes ${locations.promptsTargetDir} (resolved: ${outsideFile}).`,
    parent: locations.promptsTargetDir,
    child: outsideFile,
  };
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot: path.join(locations.scopeRoot, "plugin"),
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(path.join(locations.scopeRoot, "plugin"), []),
    previousCommandNames: ["../outside/command"],
  });
  let containmentError: unknown;

  // act
  try {
    await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  } catch (error) {
    containmentError = error;
  }

  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result, {
    stagedNames: [],
    recorded: [],
    warnings: [],
    degraded: [],
  });
  assert.ok(containmentError instanceof PathContainmentError);
  assert.strictEqual(containmentError instanceof SymlinkRefusedError, false);
  assert.deepStrictEqual(
    {
      name: containmentError.name,
      message: containmentError.message,
      parent: containmentError.parent,
      child: containmentError.child,
    },
    expectedError,
  );
  assert.strictEqual(abortLeak, undefined);
  assert.deepStrictEqual(
    (await readdir(resourcesRoot, { recursive: true })).sort(),
    targetTreeBefore,
  );
  assert.deepStrictEqual(await readFile(outsideFile), outsideBytesBefore);
});

test("refuses an intermediate symlink before changing its complete target tree", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-symlink-target-");
  const outsideRoot = path.join(locations.extensionRoot, "outside-prompts");
  const outsideFile = path.join(outsideRoot, "command.md");
  const linkPath = path.join(locations.promptsTargetDir, "link");
  const child = path.join(linkPath, "command.md");
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await mkdir(outsideRoot);
  await writeFile(outsideFile, "outside command\n");
  await symlink(outsideRoot, linkPath);
  const targetTreeBefore = await readdir(locations.promptsTargetDir);
  const outsideTreeBefore = await readdir(outsideRoot);
  const outsideBytesBefore = await readFile(outsideFile);
  const expectedError = {
    name: "SymlinkRefusedError",
    message: `previous command file contains symlink ${linkPath} -> ${outsideRoot} (parent: ${locations.promptsTargetDir}, target: ${child}).`,
    parent: locations.promptsTargetDir,
    child,
    linkPath,
    linkTarget: outsideRoot,
  };
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot: path.join(locations.scopeRoot, "plugin"),
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(path.join(locations.scopeRoot, "plugin"), []),
    previousCommandNames: ["link/command"],
  });
  let symlinkError: unknown;

  // act
  try {
    await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  } catch (error) {
    symlinkError = error;
  }

  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result, {
    stagedNames: [],
    recorded: [],
    warnings: [],
    degraded: [],
  });
  assert.ok(symlinkError instanceof SymlinkRefusedError);
  assert.ok(symlinkError instanceof PathContainmentError);
  assert.deepStrictEqual(
    {
      name: symlinkError.name,
      message: symlinkError.message,
      parent: symlinkError.parent,
      child: symlinkError.child,
      linkPath: symlinkError.linkPath,
      linkTarget: symlinkError.linkTarget,
    },
    expectedError,
  );
  assert.strictEqual(abortLeak, undefined);
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), targetTreeBefore);
  assert.deepStrictEqual(await readdir(outsideRoot), outsideTreeBefore);
  assert.deepStrictEqual(await readFile(outsideFile), outsideBytesBefore);
});

test("aborts staged commands without creating target prompts", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-abort-");
  const pluginRoot = await createPluginRoot(t, "commands-source-abort-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const commandSource = "---\ndescription: Abort me\n---\nDo not commit.\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "abort.md"), commandSource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  assert.strictEqual(prepared.kind, "staged");
  const stagedBytes = await readFile(path.join(prepared.stagingRoot, "acme:abort.md"), "utf8");
  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);
  const stagingExists = await pathIsPresent(prepared.stagingRoot);
  const targetExists = await pathIsPresent(path.join(locations.promptsTargetDir, "acme:abort.md"));

  // assert
  assert.strictEqual(
    stagedBytes,
    '---\n"description": "Abort me"\n' +
      recordLine(pluginRoot, path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME)) +
      "---\nDo not commit.\n",
  );
  assert.strictEqual(abortLeak, undefined);
  assert.strictEqual(stagingExists, false);
  assert.strictEqual(targetExists, false);
});

test("removes prior owned prompts and tolerates a missing prior prompt during commit", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-restage-");
  const pluginRoot = await createPluginRoot(t, "commands-source-restage-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const currentSource = "---\ndescription: Current\n---\nCurrent prompt.\n";
  const priorTarget = path.join(locations.promptsTargetDir, "acme:old.md");
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), currentSource);
  await writeFile(priorTarget, "old prompt bytes\n");

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:old", "acme:already-missing"],
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const priorExists = await pathIsPresent(priorTarget);
  const currentBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:current.md"),
    "utf8",
  );

  // assert
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(priorExists, false);
  assert.strictEqual(
    currentBytes,
    '---\n"description": "Current"\n' +
      recordLine(pluginRoot, path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME)) +
      "---\nCurrent prompt.\n",
  );
});

test("neutralizes malformed frontmatter and preserves exact substituted body bytes", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-malformed-");
  const pluginRoot = await createPluginRoot(t, "commands-source-malformed-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const malformedSource =
    "---\ntitle: Deploy: the whole thing\ndescription: never reached\n---\n\n" +
    "Run the deployment for ${CLAUDE_PLUGIN_ROOT}.\n";
  const expectedBytes =
    `---\n"description": "Run the deployment for ${pluginRoot}."\n` +
    recordLine(pluginRoot, path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME)) +
    "---\n" +
    `\nRun the deployment for ${pluginRoot}.\n`;
  const expectedParseError =
    "Nested mappings are not allowed in compact mappings at line 1, column 8:\n\n" +
    "title: Deploy: the whole thing\n       ^\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "bad-command.md"), malformedSource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const stagedBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:bad-command.md"),
    "utf8",
  );

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result.degraded, [
    { generatedName: "acme:bad-command", parseError: expectedParseError },
  ]);
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(stagedBytes, expectedBytes);
});

test("substitutes project variables and retains command-inapplicable skill variables", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-project-vars-");
  const pluginRoot = await createPluginRoot(t, "commands-source-project-vars-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const pluginDataDir = path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME);
  const commandSource =
    "Root: ${CLAUDE_PLUGIN_ROOT}\n" +
    "Data: ${CLAUDE_PLUGIN_DATA}\n" +
    "Project: ${CLAUDE_PROJECT_DIR}\n" +
    "Skill: ${CLAUDE_SKILL_DIR}\n";
  const expectedBytes =
    `---\n"description": "Root: ${pluginRoot}"\n` +
    recordLine(pluginRoot, pluginDataDir) +
    "---\n" +
    `Root: ${pluginRoot}\n` +
    `Data: ${pluginDataDir}\n` +
    `Project: ${locations.scopeRoot}\n` +
    "Skill: ${CLAUDE_SKILL_DIR}\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "vars.md"), commandSource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const stagedBytes = await readFile(path.join(locations.promptsTargetDir, "acme:vars.md"), "utf8");

  // assert
  assert.strictEqual(stagedBytes, expectedBytes);
});

test("retains the project variable for user scope and restores the user directory", async (t) => {
  // arrange
  const { agentDir: scopeRoot } = await createHermeticEnvironment(t, "commands-stage-user-vars-");
  const locations = locationsFor("user", scopeRoot);
  const pluginRoot = await createPluginRoot(t, "commands-source-user-vars-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const pluginDataDir = path.join(scopeRoot, "plugin-data", PLUGIN_NAME);
  const commandSource =
    "Root: ${CLAUDE_PLUGIN_ROOT}\n" +
    "Data: ${CLAUDE_PLUGIN_DATA}\n" +
    "Project: ${CLAUDE_PROJECT_DIR}\n";
  const expectedBytes =
    `---\n"description": "Root: ${pluginRoot}"\n` +
    recordLine(pluginRoot, pluginDataDir) +
    "---\n" +
    `Root: ${pluginRoot}\n` +
    `Data: ${pluginDataDir}\n` +
    "Project: ${CLAUDE_PROJECT_DIR}\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "vars.md"), commandSource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const stagedBytes = await readFile(path.join(locations.promptsTargetDir, "acme:vars.md"), "utf8");

  // assert
  assert.strictEqual(stagedBytes, expectedBytes);
});

test("D-CF3-06 records the same plugin root and data at user and project scope", async (t) => {
  // arrange
  const { agentDir } = await createHermeticEnvironment(t, "commands-stage-record-user-");
  const userLocations = locationsFor("user", agentDir);
  const projectLocations = await createProjectLocations(t, "commands-stage-record-project-");
  const pluginRoot = await createPluginRoot(t, "commands-source-record-");
  const pluginDataDir = path.join(pluginRoot, "data");
  await mkdir(path.join(pluginRoot, "commands"), { recursive: true });
  await writeFile(path.join(pluginRoot, "commands", "scoped.md"), "Scope check.\n");
  const expectedBytes =
    '---\n"description": "Scope check."\n' +
    recordLine(pluginRoot, pluginDataDir) +
    "---\nScope check.\n";

  // act
  const stagedBytes = await Promise.all(
    [userLocations, projectLocations].map(async (locations) => {
      const prepared = await prepareStageCommands(createRemovalOps(), {
        locations,
        cwd: locations.scopeRoot,
        pluginName: PLUGIN_NAME,
        pluginRoot,
        pluginDataDir,
        resolved: resolvedFor(pluginRoot),
      });
      await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
      return readFile(path.join(locations.promptsTargetDir, "acme:scoped.md"), "utf8");
    }),
  );

  // assert
  assert.deepStrictEqual(stagedBytes, [expectedBytes, expectedBytes]);
});

test("preserves first-wins discovery warnings on a staged result", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-warning-");
  const pluginRoot = await createPluginRoot(t, "commands-source-warning-");
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(path.join(commandsRoot, "acme-tools"), { recursive: true });
  await mkdir(path.join(commandsRoot, "tools"), { recursive: true });
  await writeFile(path.join(commandsRoot, "acme-tools", "lint.md"), "first prompt\n");
  await writeFile(path.join(commandsRoot, "tools", "lint.md"), "second prompt\n");

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result.stagedNames, ["acme:tools:lint"]);
  assert.deepStrictEqual(prepared.result.warnings, [
    {
      kind: "discovery",
      message: `command source "tools/lint" in "${commandsRoot}" elides to generated name "acme:tools:lint", already produced by command source "acme-tools/lint"; ignoring duplicate.`,
    },
  ]);
  assert.strictEqual(abortLeak, undefined);
});

test("D-CF3-09 returns the discover warnings, then each dropped-fields line in command order", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-dropped-");
  const pluginRoot = await createPluginRoot(t, "commands-source-dropped-");
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(path.join(commandsRoot, "acme-tools"), { recursive: true });
  await mkdir(path.join(commandsRoot, "tools"), { recursive: true });
  await writeFile(
    path.join(commandsRoot, "acme-tools", "lint.md"),
    "---\ndescription: Lints.\nmodel: opus\neffort: high\n---\nLint.\n",
  );
  await writeFile(path.join(commandsRoot, "tools", "lint.md"), "second prompt\n");
  await writeFile(
    path.join(commandsRoot, "deploy.md"),
    "---\ndescription: Deploys.\nargument-hint: <env>\n---\nDeploy.\n",
  );

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);

  // assert
  assert.deepStrictEqual(
    { stagedNames: prepared.result.stagedNames, warnings: prepared.result.warnings },
    {
      stagedNames: ["acme:tools:lint", "acme:deploy"],
      warnings: [
        {
          kind: "discovery",
          message: `command source "tools/lint" in "${commandsRoot}" elides to generated name "acme:tools:lint", already produced by command source "acme-tools/lint"; ignoring duplicate.`,
        },
        { kind: "discovery", message: "[acme-tools/lint] dropped fields: model, effort" },
      ],
    },
  );
  assert.strictEqual(abortLeak, undefined);
});

test("rolls back a partial command commit and removes the staging tree", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-commit-rollback-");
  const pluginRoot = await createPluginRoot(t, "commands-rollback-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const alphaTarget = path.join(locations.promptsTargetDir, "acme:alpha.md");
  const betaTarget = path.join(locations.promptsTargetDir, "acme:beta.md");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "alpha.md"), "alpha prompt\n");
  await writeFile(path.join(commandsRoot, "beta.md"), "beta prompt\n");
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  assert.strictEqual(prepared.kind, "staged");
  await mkdir(betaTarget, { recursive: true });
  await writeFile(path.join(betaTarget, "blocker.txt"), "keep blocker\n");

  // act
  const error = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const alphaExists = await pathIsPresent(alphaTarget);
  const stagingExists = await pathIsPresent(prepared.stagingRoot);
  const blockerBytes = await readFile(path.join(betaTarget, "blocker.txt"), "utf8");

  // assert
  assert.ok(error instanceof Error);
  assert.strictEqual(alphaExists, false);
  assert.strictEqual(stagingExists, false);
  assert.strictEqual(blockerBytes, "keep blocker\n");
});

test("reports a commit rollback leak without promoting it to manual recovery", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-commit-leak-");
  const pluginRoot = await createPluginRoot(t, "commands-leak-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "alpha.md"), "alpha prompt\n");
  await writeFile(path.join(commandsRoot, "beta.md"), "beta prompt\n");
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  assert.strictEqual(prepared.kind, "staged");
  const betaTarget = path.join(locations.promptsTargetDir, "acme:beta.md");
  await mkdir(betaTarget, { recursive: true });
  await writeFile(path.join(betaTarget, "blocker.txt"), "keep blocker\n");
  const rollbackBlocker = path.join(prepared.stagingRoot, "rollback-blocker.md");
  await mkdir(rollbackBlocker, { recursive: true });
  await writeFile(path.join(rollbackBlocker, "child.txt"), "keep child\n");
  const alphaPair = prepared._renamePairs.find((pair) => pair.to.endsWith("acme:alpha.md")) as
    { from: string; to: string } | undefined;
  assert.ok(alphaPair);
  const actualFrom = alphaPair.from;
  let fromReads = 0;
  delete (alphaPair as Partial<typeof alphaPair>).from;
  Object.defineProperty(alphaPair, "from", {
    configurable: true,
    enumerable: true,
    get() {
      fromReads += 1;
      return fromReads === 1 ? actualFrom : rollbackBlocker;
    },
  });

  // act
  const error = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(error instanceof Error);
  assert.notStrictEqual(error.name, "ManualRecoveryError");
  assert.match(error.message, /\(additionally: failed to roll back command rename/);
});

test("propagates a non-missing previous-prompt removal failure", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-commit-unlink-");
  const pluginRoot = await createPluginRoot(t, "commands-unlink-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const blockedPreviousTarget = path.join(locations.promptsTargetDir, "acme:blocked.md");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), "current prompt\n");
  await mkdir(blockedPreviousTarget, { recursive: true });
  await writeFile(path.join(blockedPreviousTarget, "child.txt"), "keep child\n");
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:blocked"],
  });

  // act
  const error = await commitPreparedCommands(createRemovalOps(), prepared, projectLedger).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const abortLeak = await abortPreparedCommands(createRemovalOps(), prepared);
  const childBytes = await readFile(path.join(blockedPreviousTarget, "child.txt"), "utf8");

  // assert
  assert.ok(error instanceof Error);
  assert.match(error.message, /(EISDIR|EPERM)/);
  assert.strictEqual(abortLeak, undefined);
  assert.strictEqual(childBytes, "keep child\n");
});

test("names the plugin and generated command when an overlong target cannot be staged", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-long-name-");
  const pluginRoot = await createPluginRoot(t, "commands-long-name-source-");
  const outer = "d".repeat(200);
  const inner = "c".repeat(200);
  const generatedName = `acme:${outer}:${inner}`;
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(path.join(commandsRoot, outer), { recursive: true });
  await writeFile(path.join(commandsRoot, outer, `${inner}.md`), "long command prompt\n");

  // act
  const error = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.ok(error instanceof Error);
  assert.strictEqual(error.name, "BridgeStagingError");
  assert.strictEqual(
    error.message,
    `command "${generatedName}" of plugin "acme" could not be staged`,
  );
  assert.ok(error.cause instanceof Error);
  assert.match(error.cause.message, /ENAMETOOLONG/);
  assert.deepStrictEqual(stagingChildren, []);
});

test("passes through a non-filesystem staging error and cleans staging", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-name-error-");
  const pluginRoot = await createPluginRoot(t, "commands-name-error-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  let generatedNameSlashChecks = 0;
  t.mock.method(
    String.prototype,
    "includes",
    function (this: string, searchString: string, position?: number) {
      if (this === "acme:current" && searchString === "/") {
        generatedNameSlashChecks += 1;
        return generatedNameSlashChecks >= 2;
      }

      const start = Math.max(position ?? 0, 0);
      for (let index = start; index <= this.length - searchString.length; index += 1) {
        if (this.slice(index, index + searchString.length) === searchString) {
          return true;
        }
      }

      return searchString === "" && start <= this.length;
    },
  );
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), "current prompt\n");

  // act
  const error = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.ok(error instanceof Error);
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "Error",
      message: 'generated command name "acme:current" must not contain path separators.',
      cause: undefined,
    },
  );
  assert.deepStrictEqual(stagingChildren, []);
});

test("normalizes lone-CR and repeated malformed blocks to exact body bytes", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-malformed-rows-");
  const pluginRoot = await createPluginRoot(t, "commands-malformed-rows-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const loneCrSource = "---\rbad: one: two\r---\r\rLone CR body.\r";
  const repeatedSource = "---\nalpha: one: two\n---\n---\nbeta: three: four\n---\nRepeated body.\n";
  const frontmatterOnlySource = "---\nbad: one: two\n---";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "lone-cr.md"), loneCrSource);
  await writeFile(path.join(commandsRoot, "repeated.md"), repeatedSource);
  await writeFile(path.join(commandsRoot, "frontmatter-only.md"), frontmatterOnlySource);

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(createRemovalOps(), prepared, projectLedger);
  const loneCrBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:lone-cr.md"),
    "utf8",
  );
  const repeatedBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:repeated.md"),
    "utf8",
  );
  const frontmatterOnlyBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:frontmatter-only.md"),
    "utf8",
  );

  // assert
  assert.deepStrictEqual(
    prepared.result.degraded.map(({ generatedName }) => generatedName),
    ["acme:frontmatter-only", "acme:lone-cr", "acme:repeated"],
  );
  const expectedRecord = recordLine(
    pluginRoot,
    path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
  );
  assert.strictEqual(
    loneCrBytes,
    '---\n"description": "Lone CR body."\n' + expectedRecord + "---\n\nLone CR body.\n",
  );
  assert.strictEqual(
    repeatedBytes,
    '---\n"description": "Repeated body."\n' + expectedRecord + "---\nRepeated body.\n",
  );
  assert.strictEqual(
    frontmatterOnlyBytes,
    '---\n"description": "Plugin command"\n' + expectedRecord + "---\n",
  );
});

test("cleans staging when a repeated malformed block reaches the no-opening safeguard", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-no-opening-");
  const pluginRoot = await createPluginRoot(t, "commands-no-opening-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const repeatedRemainder = "---\nbeta: three: four\n---\nPlain body.\n";
  const commandSource = `---\nalpha: one: two\n---\n${repeatedRemainder}`;
  let remainderOpeningChecks = 0;
  t.mock.method(
    String.prototype,
    "startsWith",
    function (this: string, searchString: string, position?: number) {
      if (this === repeatedRemainder && searchString === "---") {
        remainderOpeningChecks += 1;
        if (remainderOpeningChecks === 2) {
          return false;
        }
      }

      const start = position ?? 0;
      return this.slice(start, start + searchString.length) === searchString;
    },
  );
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "repeated.md"), commandSource);

  // act
  const error = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.ok(error instanceof Error);
  assert.strictEqual(error.name, "BridgeStagingError");
  assert.strictEqual(remainderOpeningChecks, 3);
  assert.deepStrictEqual(stagingChildren, []);
});

test("cleans staging when a repeated malformed block reaches the no-close safeguard", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-no-close-");
  const pluginRoot = await createPluginRoot(t, "commands-no-close-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const repeatedRemainder = "---\nbeta: three: four\n---\nPlain body.\n";
  const commandSource = `---\nalpha: one: two\n---\n${repeatedRemainder}`;
  let remainderCloseSearches = 0;
  t.mock.method(
    String.prototype,
    "indexOf",
    function (this: string, searchString: string, position?: number) {
      if (this === repeatedRemainder && searchString === "\n---") {
        remainderCloseSearches += 1;
        if (remainderCloseSearches === 2) {
          return -1;
        }
      }

      const start = Math.max(position ?? 0, 0);
      if (searchString === "") {
        return Math.min(start, this.length);
      }

      for (let index = start; index <= this.length - searchString.length; index += 1) {
        if (this.slice(index, index + searchString.length) === searchString) {
          return index;
        }
      }

      return -1;
    },
  );
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "repeated.md"), commandSource);

  // act
  const error = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.ok(error instanceof Error);
  assert.strictEqual(error.name, "BridgeStagingError");
  assert.strictEqual(remainderCloseSearches, 3);
  assert.deepStrictEqual(stagingChildren, []);
});

/** Stages the commands `greet.md` and `build/web.md` of a fresh `acme` plugin into `locations`. */
async function prepareGreetAndWeb(
  t: TestContext,
  locations: ScopedLocations,
  previousCommandNames: readonly string[],
): Promise<{ readonly pluginRoot: string; readonly prepared: PreparedCommandsStaged }> {
  const pluginRoot = await createPluginRoot(t, "commands-ledger-source-");
  await mkdir(path.join(pluginRoot, "commands", "build"), { recursive: true });
  await writeFile(path.join(pluginRoot, "commands", "greet.md"), "Greet.\n");
  await writeFile(path.join(pluginRoot, "commands", "build", "web.md"), "Build web.\n");
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(pluginRoot, "data"),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames,
  });
  assert.strictEqual(prepared.kind, "staged");
  return { pluginRoot, prepared };
}

test("D-CF3-07 lists each committed project command with its file digest after the staging cleanup", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-ledger-record-");
  const { pluginRoot, prepared } = await prepareGreetAndWeb(t, locations, ["acme:old"]);
  const record = recordLine(pluginRoot, path.join(pluginRoot, "data"));
  const expectedGreet = '---\n"description": "Greet."\n' + record + "---\nGreet.\n";
  const expectedWeb = '---\n"description": "Build web."\n' + record + "---\nBuild web.\n";
  const updates: { change: ProjectCommandChange; stagingPresent: boolean }[] = [];
  const ledger = {
    update: async (change: ProjectCommandChange) => {
      updates.push({ change, stagingPresent: await pathIsPresent(prepared.stagingRoot) });
    },
  } satisfies ProjectCommandLedger;

  // act
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, ledger);

  // assert
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(
    await readFile(path.join(locations.promptsTargetDir, "acme:greet.md"), "utf8"),
    expectedGreet,
  );
  assert.strictEqual(
    await readFile(path.join(locations.promptsTargetDir, "acme:build:web.md"), "utf8"),
    expectedWeb,
  );
  assert.deepStrictEqual(updates, [
    {
      change: {
        projectPath: path.dirname(locations.scopeRoot),
        forget: ["acme:old"],
        remember: new Map([
          ["acme:greet", { plugin: "acme", sha256: sha256(expectedGreet) }],
          ["acme:build:web", { plugin: "acme", sha256: sha256(expectedWeb) }],
        ]),
      },
      stagingPresent: false,
    },
  ]);
});

test("D-CF3-07 a user-scope commit writes no project ledger", async (t) => {
  // arrange
  const { agentDir } = await createHermeticEnvironment(t, "commands-ledger-user-");
  const locations = locationsFor("user", agentDir);
  const { prepared } = await prepareGreetAndWeb(t, locations, ["acme:old"]);
  const ledger = mock<ProjectCommandLedger>({ exactParams: true, name: "project ledger" });

  // act
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, ledger);

  // assert
  assert.strictEqual(commitLeak, undefined);
  assert.deepStrictEqual((await readdir(locations.promptsTargetDir)).sort(), [
    "acme:build:web.md",
    "acme:greet.md",
  ]);
  verify(ledger);
});

test("D-CF3-07 a no-op staging writes no project ledger", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-ledger-noop-");
  const pluginRoot = await createPluginRoot(t, "commands-ledger-noop-source-");
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(pluginRoot, "data"),
    resolved: resolvedFor(pluginRoot, []),
  });
  const ledger = mock<ProjectCommandLedger>({ exactParams: true, name: "project ledger" });

  // act
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, ledger);

  // assert
  assert.strictEqual(prepared.kind, "noop");
  assert.strictEqual(commitLeak, undefined);
  verify(ledger);
});

test("D-CF3-07 a failed project ledger write fails the commit after removing the staging tree", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-ledger-failed-");
  const { prepared } = await prepareGreetAndWeb(t, locations, []);
  const ledgerError = new Error("the project ledger holds content this version cannot update");
  const ledger = {
    update: () => Promise.reject(ledgerError),
  } satisfies ProjectCommandLedger;

  // act
  const error = await commitPreparedCommands(createRemovalOps(), prepared, ledger).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.strictEqual(error, ledgerError);
  assert.strictEqual(await pathIsPresent(prepared.stagingRoot), false);
});

test("D-CF3-07 a failed project ledger write carries the staging cleanup leak", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-ledger-leak-");
  const { prepared } = await prepareGreetAndWeb(t, locations, []);
  t.after(() => rm(prepared.stagingRoot, { recursive: true, force: true }));
  const ledgerError = new Error("the project ledger cannot be read");
  const ledger = {
    update: () => Promise.reject(ledgerError),
  } satisfies ProjectCommandLedger;
  const ops = {
    rm: () => Promise.reject(Object.assign(new Error("permission denied"), { code: "EACCES" })),
  } satisfies RemovalOps;

  // act
  const error = await commitPreparedCommands(ops, prepared, ledger).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(error instanceof CleanupLeakError);
  assert.deepStrictEqual(
    { message: error.message, cause: error.cause },
    {
      message: `the project ledger cannot be read (additionally: failed to clean up commands staging directory at ${prepared.stagingRoot}: permission denied)`,
      cause: ledgerError,
    },
  );
});

test("D-CF3-03 stages an inline command map entry and records it under the plugin root's commands key", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-inline-");
  const pluginRoot = await createPluginRoot(t, "commands-source-inline-");
  const pluginDataDir = path.join(pluginRoot, "data");
  const expectedBeta =
    '---\n"description": "Beta from the manifest."\n' +
    recordLine(pluginRoot, pluginDataDir) +
    "---\nBeta inline body in ${CLAUDE_PLUGIN_ROOT}".replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
  const updates: ProjectCommandChange[] = [];
  const ledger = {
    update: (change: ProjectCommandChange) => {
      updates.push(change);
      return Promise.resolve();
    },
  } satisfies ProjectCommandLedger;
  const resolved: ResolvedPluginInstallable = {
    ...resolvedFor(pluginRoot, []),
    supported: ["commands"],
    componentPaths: {
      ...resolvedFor(pluginRoot, []).componentPaths,
      commandMap: [
        {
          key: "beta",
          content: "Beta inline body in ${CLAUDE_PLUGIN_ROOT}",
          origin: "manifest",
          description: "Beta from the manifest.",
        },
      ],
    },
  };

  // act
  const prepared = await prepareStageCommands(createRemovalOps(), {
    locations,
    cwd: locations.scopeRoot,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved,
  });
  const commitLeak = await commitPreparedCommands(createRemovalOps(), prepared, ledger);

  // assert
  assert.deepStrictEqual(
    { commitLeak, recorded: prepared.result.recorded, warnings: prepared.result.warnings },
    {
      commitLeak: undefined,
      recorded: [
        {
          generatedName: "acme:beta",
          sourcePath: `${pluginRoot}#commands.beta`,
          targetPath: path.join(locations.promptsTargetDir, "acme:beta.md"),
        },
      ],
      warnings: [],
    },
  );
  assert.strictEqual(
    await readFile(path.join(locations.promptsTargetDir, "acme:beta.md"), "utf8"),
    expectedBeta,
  );
  assert.deepStrictEqual(updates, [
    {
      projectPath: path.dirname(locations.scopeRoot),
      forget: [],
      remember: new Map([["acme:beta", { plugin: "acme", sha256: sha256(expectedBeta) }]]),
    },
  ]);
});
