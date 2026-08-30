import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  type ScopedLocations,
  locationsFor,
} from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

const LOCATION_KEYS = [
  "scope",
  "scopeRoot",
  "extensionRoot",
  "stateJsonPath",
  "stateLockFile",
  "agentsDir",
  "agentsStagingDir",
  "agentsIndexPath",
  "mcpJsonPath",
  "configJsonPath",
  "configLocalJsonPath",
  "skillsStagingDir",
  "commandsStagingDir",
  "skillsTargetDir",
  "promptsTargetDir",
  "dataRoot",
  "sourcesDir",
  "pluginClonesDir",
  "hooksDir",
  "cacheDir",
  "marketplaceNamesCacheFile",
  "pluginDataDir",
  "marketplaceDataDir",
  "sourceCloneDir",
  "pluginCloneDir",
  "sourcesStagingDir",
  "pluginCacheFile",
] as const;

function fixedLocationBundle(locations: ScopedLocations) {
  return {
    scope: locations.scope,
    scopeRoot: locations.scopeRoot,
    extensionRoot: locations.extensionRoot,
    stateJsonPath: locations.stateJsonPath,
    stateLockFile: locations.stateLockFile,
    agentsDir: locations.agentsDir,
    agentsStagingDir: locations.agentsStagingDir,
    agentsIndexPath: locations.agentsIndexPath,
    mcpJsonPath: locations.mcpJsonPath,
    configJsonPath: locations.configJsonPath,
    configLocalJsonPath: locations.configLocalJsonPath,
    skillsStagingDir: locations.skillsStagingDir,
    commandsStagingDir: locations.commandsStagingDir,
    skillsTargetDir: locations.skillsTargetDir,
    promptsTargetDir: locations.promptsTargetDir,
    dataRoot: locations.dataRoot,
    sourcesDir: locations.sourcesDir,
    pluginClonesDir: locations.pluginClonesDir,
    hooksDir: locations.hooksDir,
    cacheDir: locations.cacheDir,
    marketplaceNamesCacheFile: locations.marketplaceNamesCacheFile,
  };
}

function restoreAgentDirectory(hadAgentDirectory: boolean, agentDirectory: string | undefined) {
  if (hadAgentDirectory && agentDirectory !== undefined) {
    process.env.PI_CODING_AGENT_DIR = agentDirectory;
  } else {
    delete process.env.PI_CODING_AGENT_DIR;
  }
}

test("returns the complete frozen user location bundle and restores the agent directory", (t) => {
  // arrange
  const hadAgentDirectory = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  t.after(() => restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory));
  const userRoot = path.join(path.parse(process.cwd()).root, "scope-fixture", "user-agent");
  process.env.PI_CODING_AGENT_DIR = userRoot;
  const extensionRoot = path.join(userRoot, "pi-claude-marketplace");
  const expectedLocations = {
    scope: "user",
    scopeRoot: userRoot,
    extensionRoot,
    stateJsonPath: path.join(extensionRoot, "state.json"),
    stateLockFile: path.join(extensionRoot, ".state-lock"),
    agentsDir: path.join(userRoot, "agents"),
    agentsStagingDir: path.join(extensionRoot, "agents-staging"),
    agentsIndexPath: path.join(extensionRoot, "agents-index.json"),
    mcpJsonPath: path.join(userRoot, "mcp.json"),
    configJsonPath: path.join(userRoot, "claude-plugins.json"),
    configLocalJsonPath: path.join(userRoot, "claude-plugins.local.json"),
    skillsStagingDir: path.join(extensionRoot, "skills-staging"),
    commandsStagingDir: path.join(extensionRoot, "commands-staging"),
    skillsTargetDir: path.join(extensionRoot, "resources", "skills"),
    promptsTargetDir: path.join(extensionRoot, "resources", "prompts"),
    dataRoot: path.join(extensionRoot, "data"),
    sourcesDir: path.join(extensionRoot, "sources"),
    pluginClonesDir: path.join(extensionRoot, "plugin-clones"),
    hooksDir: path.join(extensionRoot, "hooks"),
    cacheDir: path.join(extensionRoot, "cache"),
    marketplaceNamesCacheFile: path.join(extensionRoot, "cache", "marketplace-names.json"),
  };

  // act
  const locations = locationsFor("user", path.join(path.parse(process.cwd()).root, "ignored"));
  restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);
  const brandKeys = Object.getOwnPropertySymbols(locations);

  // assert
  assert.deepStrictEqual(fixedLocationBundle(locations), expectedLocations);
  assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS);
  assert.strictEqual(Object.isFrozen(locations), true);
  assert.strictEqual(brandKeys.length, 1);
  assert.strictEqual(Reflect.get(locations, brandKeys[0]!), true);
  assert.strictEqual(Object.hasOwn(process.env, "PI_CODING_AGENT_DIR"), hadAgentDirectory);
  assert.strictEqual(process.env.PI_CODING_AGENT_DIR, previousAgentDirectory);
});

test("returns the complete frozen project location bundle", () => {
  // arrange
  const projectRoot = path.join(path.parse(process.cwd()).root, "scope-fixture", "project");
  const scopeRoot = path.join(projectRoot, ".pi");
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  const expectedLocations = {
    scope: "project",
    scopeRoot,
    extensionRoot,
    stateJsonPath: path.join(extensionRoot, "state.json"),
    stateLockFile: path.join(extensionRoot, ".state-lock"),
    agentsDir: path.join(scopeRoot, "agents"),
    agentsStagingDir: path.join(extensionRoot, "agents-staging"),
    agentsIndexPath: path.join(extensionRoot, "agents-index.json"),
    mcpJsonPath: path.join(scopeRoot, "mcp.json"),
    configJsonPath: path.join(scopeRoot, "claude-plugins.json"),
    configLocalJsonPath: path.join(scopeRoot, "claude-plugins.local.json"),
    skillsStagingDir: path.join(extensionRoot, "skills-staging"),
    commandsStagingDir: path.join(extensionRoot, "commands-staging"),
    skillsTargetDir: path.join(extensionRoot, "resources", "skills"),
    promptsTargetDir: path.join(extensionRoot, "resources", "prompts"),
    dataRoot: path.join(extensionRoot, "data"),
    sourcesDir: path.join(extensionRoot, "sources"),
    pluginClonesDir: path.join(extensionRoot, "plugin-clones"),
    hooksDir: path.join(extensionRoot, "hooks"),
    cacheDir: path.join(extensionRoot, "cache"),
    marketplaceNamesCacheFile: path.join(extensionRoot, "cache", "marketplace-names.json"),
  };

  // act
  const locations = locationsFor("project", projectRoot);
  const brandKeys = Object.getOwnPropertySymbols(locations);

  // assert
  assert.deepStrictEqual(fixedLocationBundle(locations), expectedLocations);
  assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS);
  assert.strictEqual(Object.isFrozen(locations), true);
  assert.strictEqual(brandKeys.length, 1);
  assert.strictEqual(Reflect.get(locations, brandKeys[0]!), true);
});

test("uses the default Pi agent root when the override is absent and restores the environment", (t) => {
  // arrange
  const hadAgentDirectory = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  t.after(() => restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory));
  delete process.env.PI_CODING_AGENT_DIR;
  const expectedScopeRoot = path.join(os.homedir(), ".pi", "agent");

  // act
  const locations = locationsFor("user", path.join(path.parse(process.cwd()).root, "ignored"));
  restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);

  // assert
  assert.strictEqual(locations.scopeRoot, expectedScopeRoot);
  assert.strictEqual(
    locations.extensionRoot,
    path.join(os.homedir(), ".pi", "agent", "pi-claude-marketplace"),
  );
  assert.strictEqual(Object.hasOwn(process.env, "PI_CODING_AGENT_DIR"), hadAgentDirectory);
  assert.strictEqual(process.env.PI_CODING_AGENT_DIR, previousAgentDirectory);
});
