import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  abortPreparedCommands,
  commitPreparedCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { ManualRecoveryError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const MARKETPLACE_NAME = "catalog";
const PLUGIN_NAME = "acme";

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
    },
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
    "---\ndescription: Deploy the service\n---\n" +
    `Deploy from ${pluginRoot} in ${locations.scopeRoot}.\n`;
  const expectedStatus =
    "---\ndescription: Show status\n---\n" + `Read ${pluginDataDir}/status.json.\n`;
  await mkdir(path.join(commandsRoot, "build"), { recursive: true });
  await writeFile(path.join(commandsRoot, "acme-deploy.md"), deploySource);
  await writeFile(path.join(commandsRoot, "status.md"), statusSource);
  await writeFile(path.join(commandsRoot, "build", "web.md"), nestedSource);

  // act
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  const commitLeak = await commitPreparedCommands(prepared);
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
  assert.strictEqual(nestedBytes, nestedSource);
  assert.strictEqual(statusBytes, expectedStatus);
});

test("returns a complete no-op and materializes no command directories", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-noop-");
  const pluginRoot = await createPluginRoot(t, "commands-source-noop-");

  // act
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot, []),
  });
  const commitLeak = await commitPreparedCommands(prepared);
  const abortLeak = await abortPreparedCommands(prepared);
  const replacement = await replacePreparedCommands(prepared);
  const rollbackLeaks = await rollbackCommandsReplacement(replacement);
  const finalizeLeaks = await finalizeCommandsReplacement(replacement);
  const stagingExists = await pathIsPresent(locations.commandsStagingDir);
  const promptsExist = await pathIsPresent(locations.promptsTargetDir);

  // assert
  assert.deepStrictEqual(prepared, {
    kind: "noop",
    result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
  });
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(abortLeak, undefined);
  assert.deepStrictEqual(replacement, { kind: "noop", prepared });
  assert.deepStrictEqual(rollbackLeaks, []);
  assert.deepStrictEqual(finalizeLeaks, []);
  assert.strictEqual(stagingExists, false);
  assert.strictEqual(promptsExist, false);
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  assert.strictEqual(prepared.kind, "staged");
  const stagedBytes = await readFile(path.join(prepared.stagingRoot, "acme:abort.md"), "utf8");
  const abortLeak = await abortPreparedCommands(prepared);
  const stagingExists = await pathIsPresent(prepared.stagingRoot);
  const targetExists = await pathIsPresent(path.join(locations.promptsTargetDir, "acme:abort.md"));

  // assert
  assert.strictEqual(stagedBytes, commandSource);
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:old", "acme:already-missing"],
  });
  const commitLeak = await commitPreparedCommands(prepared);
  const priorExists = await pathIsPresent(priorTarget);
  const currentBytes = await readFile(
    path.join(locations.promptsTargetDir, "acme:current.md"),
    "utf8",
  );

  // assert
  assert.strictEqual(commitLeak, undefined);
  assert.strictEqual(priorExists, false);
  assert.strictEqual(currentBytes, currentSource);
});

test("neutralizes malformed frontmatter and preserves exact substituted body bytes", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-stage-malformed-");
  const pluginRoot = await createPluginRoot(t, "commands-source-malformed-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const malformedSource =
    "---\ntitle: Deploy: the whole thing\ndescription: never reached\n---\n\n" +
    "Run the deployment for ${CLAUDE_PLUGIN_ROOT}.\n";
  const expectedBytes = `\nRun the deployment for ${pluginRoot}.\n`;
  const expectedParseError =
    "Nested mappings are not allowed in compact mappings at line 1, column 8:\n\n" +
    "title: Deploy: the whole thing\n       ^\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "bad-command.md"), malformedSource);

  // act
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const commitLeak = await commitPreparedCommands(prepared);
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
    `Root: ${pluginRoot}\n` +
    `Data: ${pluginDataDir}\n` +
    `Project: ${locations.scopeRoot}\n` +
    "Skill: ${CLAUDE_SKILL_DIR}\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "vars.md"), commandSource);

  // act
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(prepared);
  const stagedBytes = await readFile(path.join(locations.promptsTargetDir, "acme:vars.md"), "utf8");

  // assert
  assert.strictEqual(stagedBytes, expectedBytes);
});

test("retains the project variable for user scope and restores the user directory", async (t) => {
  // arrange
  const scopeRoot = await mkdtemp(path.join(tmpdir(), "commands-stage-user-vars-"));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(() => {
    if (previousAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    }
  });
  process.env.PI_CODING_AGENT_DIR = scopeRoot;
  const locations = locationsFor("user", scopeRoot);
  const pluginRoot = await createPluginRoot(t, "commands-source-user-vars-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const pluginDataDir = path.join(scopeRoot, "plugin-data", PLUGIN_NAME);
  const commandSource =
    "Root: ${CLAUDE_PLUGIN_ROOT}\n" +
    "Data: ${CLAUDE_PLUGIN_DATA}\n" +
    "Project: ${CLAUDE_PROJECT_DIR}\n";
  const expectedBytes =
    `Root: ${pluginRoot}\n` + `Data: ${pluginDataDir}\n` + "Project: ${CLAUDE_PROJECT_DIR}\n";
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "vars.md"), commandSource);

  // act
  const prepared = await prepareStageCommands({
    locations,
    cwd: scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir,
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(prepared);
  const stagedBytes = await readFile(path.join(locations.promptsTargetDir, "acme:vars.md"), "utf8");

  // assert
  assert.strictEqual(stagedBytes, expectedBytes);
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const abortLeak = await abortPreparedCommands(prepared);

  // assert
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(prepared.result.stagedNames, ["acme:tools:lint"]);
  assert.deepStrictEqual(prepared.result.warnings, [
    `command source "tools/lint" in "${commandsRoot}" elides to generated name "acme:tools:lint", already produced by command source "acme-tools/lint"; ignoring duplicate.`,
  ]);
  assert.strictEqual(abortLeak, undefined);
});

test("rolls a replacement back to exact prior prompt bytes", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-rollback-");
  const pluginRoot = await createPluginRoot(t, "commands-replace-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const deploySource = "---\ndescription: New deploy\n---\nNew deploy prompt.\n";
  const statusSource = "---\ndescription: New status\n---\nNew status prompt.\n";
  const deployTarget = path.join(locations.promptsTargetDir, "acme:deploy.md");
  const statusTarget = path.join(locations.promptsTargetDir, "acme:status.md");
  const priorDeployBytes = "prior deploy prompt bytes\n";
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "deploy.md"), deploySource);
  await writeFile(path.join(commandsRoot, "status.md"), statusSource);
  await writeFile(deployTarget, priorDeployBytes);
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:deploy"],
  });

  // act
  const replacement = await replacePreparedCommands(prepared);
  const replacementDeployBytes = await readFile(deployTarget, "utf8");
  const replacementStatusBytes = await readFile(statusTarget, "utf8");
  const rollbackLeaks = await rollbackCommandsReplacement(replacement);
  const restoredDeployBytes = await readFile(deployTarget, "utf8");
  const statusExists = await pathIsPresent(statusTarget);

  // assert
  assert.strictEqual(replacement.kind, "replaced");
  assert.strictEqual(replacementDeployBytes, deploySource);
  assert.strictEqual(replacementStatusBytes, statusSource);
  assert.deepStrictEqual(rollbackLeaks, []);
  assert.strictEqual(restoredDeployBytes, priorDeployBytes);
  assert.strictEqual(statusExists, false);
});

test("finalizes a replacement with exact new bytes and no staging trees", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-finalize-");
  const pluginRoot = await createPluginRoot(t, "commands-finalize-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const currentSource = "---\ndescription: Current\n---\nCurrent prompt bytes.\n";
  const currentTarget = path.join(locations.promptsTargetDir, "acme:current.md");
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), currentSource);
  await writeFile(currentTarget, "prior prompt bytes\n");
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:current"],
  });
  assert.strictEqual(prepared.kind, "staged");

  // act
  const replacement = await replacePreparedCommands(prepared);
  const finalizeLeaks = await finalizeCommandsReplacement(replacement);
  const currentBytes = await readFile(currentTarget, "utf8");
  const stagingExists = await pathIsPresent(prepared.stagingRoot);
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.deepStrictEqual(finalizeLeaks, []);
  assert.strictEqual(currentBytes, currentSource);
  assert.strictEqual(stagingExists, false);
  assert.deepStrictEqual(stagingChildren, []);
});

test("replaces when a declared prior prompt is already missing", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-missing-");
  const pluginRoot = await createPluginRoot(t, "commands-missing-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const currentSource = "Current prompt.\n";
  const currentTarget = path.join(locations.promptsTargetDir, "acme:current.md");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), currentSource);
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:missing"],
  });

  // act
  const replacement = await replacePreparedCommands(prepared);
  const currentBytes = await readFile(currentTarget, "utf8");
  const rollbackLeaks = await rollbackCommandsReplacement(replacement);
  const currentExists = await pathIsPresent(currentTarget);

  // assert
  assert.strictEqual(replacement.kind, "replaced");
  assert.strictEqual(currentBytes, currentSource);
  assert.deepStrictEqual(rollbackLeaks, []);
  assert.strictEqual(currentExists, false);
});

test("restores owned backups and preserves a foreign prompt when replacement fails", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-foreign-");
  const pluginRoot = await createPluginRoot(t, "commands-foreign-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const deployTarget = path.join(locations.promptsTargetDir, "acme:deploy.md");
  const statusTarget = path.join(locations.promptsTargetDir, "acme:status.md");
  const priorDeployBytes = "owned prior deploy bytes\n";
  const foreignStatusBytes = "foreign status bytes\n";
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "deploy.md"), "new deploy bytes\n");
  await writeFile(path.join(commandsRoot, "status.md"), "new status bytes\n");
  await writeFile(deployTarget, priorDeployBytes);
  await writeFile(statusTarget, foreignStatusBytes);
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:deploy"],
  });

  // act
  const error = await replacePreparedCommands(prepared).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const restoredDeployBytes = await readFile(deployTarget, "utf8");
  const retainedStatusBytes = await readFile(statusTarget, "utf8");
  const stagingChildren = await readdir(locations.commandsStagingDir);

  // assert
  assert.ok(error instanceof Error);
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "Error",
      message: `Cannot replace command target with non-previous content at ${statusTarget}`,
      cause: undefined,
    },
  );
  assert.strictEqual(restoredDeployBytes, priorDeployBytes);
  assert.strictEqual(retainedStatusBytes, foreignStatusBytes);
  assert.deepStrictEqual(stagingChildren, []);
});

test("backs up an owned orphan and keeps its replacement after finalization", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-orphan-");
  const pluginRoot = await createPluginRoot(t, "commands-orphan-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const deploySource = "new owned deploy bytes\n";
  const deployTarget = path.join(locations.promptsTargetDir, "acme:deploy.md");
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "deploy.md"), deploySource);
  await writeFile(deployTarget, "orphan deploy bytes\n");
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:deploy"],
  });

  // act
  const replacement = await replacePreparedCommands(prepared);
  const finalizeLeaks = await finalizeCommandsReplacement(replacement);
  const deployBytes = await readFile(deployTarget, "utf8");

  // assert
  assert.strictEqual(replacement.kind, "replaced");
  assert.deepStrictEqual(finalizeLeaks, []);
  assert.strictEqual(deployBytes, deploySource);
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  assert.strictEqual(prepared.kind, "staged");
  await mkdir(betaTarget, { recursive: true });
  await writeFile(path.join(betaTarget, "blocker.txt"), "keep blocker\n");

  // act
  const error = await commitPreparedCommands(prepared).then(
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
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
  const error = await commitPreparedCommands(prepared).then(
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:blocked"],
  });

  // act
  const error = await commitPreparedCommands(prepared).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const abortLeak = await abortPreparedCommands(prepared);
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
  const error = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
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
  const error = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
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
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  await commitPreparedCommands(prepared);
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
  assert.strictEqual(loneCrBytes, "\nLone CR body.\n");
  assert.strictEqual(repeatedBytes, "Repeated body.\n");
  assert.strictEqual(frontmatterOnlyBytes, "");
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
  const error = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
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
  const error = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
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

test("reports manual recovery when a failed replacement cannot remove its new prompt", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-manual-");
  const pluginRoot = await createPluginRoot(t, "commands-manual-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  const alphaTarget = path.join(locations.promptsTargetDir, "acme:alpha.md");
  const betaTarget = path.join(locations.promptsTargetDir, "acme:beta.md");
  await mkdir(commandsRoot, { recursive: true });
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(commandsRoot, "alpha.md"), "new alpha prompt\n");
  await writeFile(path.join(commandsRoot, "beta.md"), "new beta prompt\n");
  await writeFile(alphaTarget, "prior alpha prompt\n");
  await writeFile(betaTarget, "foreign beta prompt\n");
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
    previousCommandNames: ["acme:alpha"],
  });
  assert.strictEqual(prepared.kind, "staged");
  const alphaPair = prepared._renamePairs.find((pair) => pair.to === alphaTarget) as
    { from: string; to: string } | undefined;
  assert.ok(alphaPair);
  const rollbackBlocker = path.join(locations.scopeRoot, "rollback-blocker.md");
  await mkdir(rollbackBlocker, { recursive: true });
  await writeFile(path.join(rollbackBlocker, "child.txt"), "keep child\n");
  const actualTarget = alphaPair.to;
  let targetReads = 0;
  delete (alphaPair as Partial<typeof alphaPair>).to;
  Object.defineProperty(alphaPair, "to", {
    configurable: true,
    enumerable: true,
    get() {
      targetReads += 1;
      return targetReads <= 3 ? actualTarget : rollbackBlocker;
    },
  });
  const expectedMessage = `Cannot replace command target with non-previous content at ${betaTarget}`;
  const expectedLeaks = [
    `failed to remove replacement command file at ${rollbackBlocker}: ` +
      `Path is a directory: rm returned EISDIR (is a directory) ${rollbackBlocker}`,
  ];
  const expectedCause = {
    name: "Error",
    message: expectedMessage,
    cause: undefined,
  };

  // act
  const error = await replacePreparedCommands(prepared).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(error instanceof ManualRecoveryError);
  assert.strictEqual(error.name, "ManualRecoveryError");
  assert.strictEqual(error.message, expectedMessage);
  assert.deepStrictEqual(error.leaks, expectedLeaks);
  assert.ok(error.cause instanceof Error);
  assert.deepStrictEqual(
    {
      name: error.cause.name,
      message: error.cause.message,
      cause: error.cause.cause,
    },
    expectedCause,
  );
});

test("rejects unknown replacement handles through both public cleanup operations", async (t) => {
  // arrange
  const locations = await createProjectLocations(t, "commands-replace-unknown-");
  const pluginRoot = await createPluginRoot(t, "commands-unknown-source-");
  const commandsRoot = path.join(pluginRoot, "commands");
  await mkdir(commandsRoot, { recursive: true });
  await writeFile(path.join(commandsRoot, "current.md"), "Current prompt.\n");
  const prepared = await prepareStageCommands({
    locations,
    cwd: locations.scopeRoot,
    marketplaceName: MARKETPLACE_NAME,
    pluginName: PLUGIN_NAME,
    pluginRoot,
    pluginDataDir: path.join(locations.scopeRoot, "plugin-data", PLUGIN_NAME),
    resolved: resolvedFor(pluginRoot),
  });
  const replacement = await replacePreparedCommands(prepared);
  assert.strictEqual(replacement.kind, "replaced");
  t.after(() => finalizeCommandsReplacement(replacement));
  const { locations: replacementLocations, ...cloneablePrepared } = replacement.prepared;
  const clonedReplacement = structuredClone({ ...replacement, prepared: cloneablePrepared });
  const unknownReplacement = {
    ...clonedReplacement,
    prepared: { ...clonedReplacement.prepared, locations: replacementLocations },
  } satisfies typeof replacement;

  // act
  const rollbackError = await rollbackCommandsReplacement(unknownReplacement).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const finalizeError = await finalizeCommandsReplacement(unknownReplacement).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(rollbackError instanceof Error);
  assert.deepStrictEqual(
    { name: rollbackError.name, message: rollbackError.message, cause: rollbackError.cause },
    { name: "Error", message: "Unknown commands replacement handle.", cause: undefined },
  );
  assert.ok(finalizeError instanceof Error);
  assert.deepStrictEqual(
    { name: finalizeError.name, message: finalizeError.message, cause: finalizeError.cause },
    { name: "Error", message: "Unknown commands replacement handle.", cause: undefined },
  );
});
