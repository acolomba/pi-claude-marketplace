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
      commands: commandPaths,
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
