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
  t.after(() => {
    restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);
  });
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
  t.after(() => {
    restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);
  });
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

test("returns every safe derived path inside its exact scope root", async () => {
  // arrange
  const projectRoot = path.join(path.parse(process.cwd()).root, "derived-fixture", "project");
  const extensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
  const locations = locationsFor("project", projectRoot);
  const expectedPaths = {
    pluginData: path.join(extensionRoot, "data", "market-alpha", "plugin-one"),
    marketplaceData: path.join(extensionRoot, "data", "market-beta"),
    sourceClone: path.join(extensionRoot, "sources", "market-gamma"),
    pluginClone: path.join(extensionRoot, "plugin-clones", "0123456789ab-abcdef012345"),
    sourcesStaging: path.join(
      extensionRoot,
      "sources-staging",
      "123e4567-e89b-12d3-a456-426614174000",
    ),
    pluginCache: path.join(extensionRoot, "cache", "plugins", "market-zeta.json"),
  };
  const expectedRelativePaths = {
    pluginData: path.join("market-alpha", "plugin-one"),
    marketplaceData: "market-beta",
    sourceClone: "market-gamma",
    pluginClone: "0123456789ab-abcdef012345",
    sourcesStaging: "123e4567-e89b-12d3-a456-426614174000",
    pluginCache: path.join("plugins", "market-zeta.json"),
  };

  // act
  const paths = {
    pluginData: await locations.pluginDataDir("market-alpha", "plugin-one"),
    marketplaceData: await locations.marketplaceDataDir("market-beta"),
    sourceClone: await locations.sourceCloneDir("market-gamma"),
    pluginClone: await locations.pluginCloneDir("0123456789ab-abcdef012345"),
    sourcesStaging: await locations.sourcesStagingDir("123e4567-e89b-12d3-a456-426614174000"),
    pluginCache: await locations.pluginCacheFile("market-zeta"),
  };
  const relativePaths = {
    pluginData: path.relative(locations.dataRoot, paths.pluginData),
    marketplaceData: path.relative(locations.dataRoot, paths.marketplaceData),
    sourceClone: path.relative(locations.sourcesDir, paths.sourceClone),
    pluginClone: path.relative(locations.pluginClonesDir, paths.pluginClone),
    sourcesStaging: path.relative(
      path.join(extensionRoot, "sources-staging"),
      paths.sourcesStaging,
    ),
    pluginCache: path.relative(locations.cacheDir, paths.pluginCache),
  };

  // assert
  assert.deepStrictEqual(paths, expectedPaths);
  assert.deepStrictEqual(relativePaths, expectedRelativePaths);
});

const activeSeparatorName = ["active", "separator"].join(path.sep);
const alternateSeparator = path.sep === "/" ? "\\" : "/";
const alternateSeparatorName = ["alternate", "separator"].join(alternateSeparator);

for (const {
  title,
  safeName,
  unsafeName,
  invoke,
  expectedSafePath,
  expectedErrorName,
  expectedErrorMessage,
} of [
  {
    title: "rejects an empty plugin beside a safe plugin path",
    safeName: "plugin-one",
    unsafeName: "",
    invoke: (locations: ScopedLocations, name: string) =>
      locations.pluginDataDir("market-one", name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "data", "market-one", name),
    expectedErrorName: "Error",
    expectedErrorMessage: () => 'pluginDataDir plugin name "" must be a non-empty string.',
  },
  {
    title: "rejects a dot marketplace beside a safe marketplace path",
    safeName: ".market",
    unsafeName: ".",
    invoke: (locations: ScopedLocations, name: string) => locations.marketplaceDataDir(name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "data", name),
    expectedErrorName: "Error",
    expectedErrorMessage: () => 'marketplaceDataDir marketplace name "." must not be "." or "..".',
  },
  {
    title: "rejects a parent marketplace beside an adjacent safe source path",
    safeName: "...",
    unsafeName: "..",
    invoke: (locations: ScopedLocations, name: string) => locations.sourceCloneDir(name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "sources", name),
    expectedErrorName: "Error",
    expectedErrorMessage: () => 'sourceCloneDir marketplace name ".." must not be "." or "..".',
  },
  {
    title: "rejects the active platform separator beside a safe clone key",
    safeName: "active-separator",
    unsafeName: activeSeparatorName,
    invoke: (locations: ScopedLocations, name: string) => locations.pluginCloneDir(name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "plugin-clones", name),
    expectedErrorName: "Error",
    expectedErrorMessage: (_extensionRoot: string, name: string) =>
      `pluginCloneDir clone key "${name}" "${name}" must not contain path separators.`,
  },
  {
    title: "rejects the alternate platform separator beside a safe cache path",
    safeName: "alternate-separator",
    unsafeName: alternateSeparatorName,
    invoke: (locations: ScopedLocations, name: string) => locations.pluginCacheFile(name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "cache", "plugins", `${name}.json`),
    expectedErrorName: "Error",
    expectedErrorMessage: (_extensionRoot: string, name: string) =>
      `pluginCacheFile marketplace name "${name}" "${name}" must not contain path separators.`,
  },
  {
    title: "rejects a control character beside an adjacent safe plugin path",
    safeName: "plugin neighbor",
    unsafeName: "plugin\x00neighbor",
    invoke: (locations: ScopedLocations, name: string) =>
      locations.pluginDataDir("market-two", name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "data", "market-two", name),
    expectedErrorName: "Error",
    expectedErrorMessage: (_extensionRoot: string, name: string) =>
      `pluginDataDir plugin name "${name}" "${name}" must not contain ASCII control characters.`,
  },
  {
    title: "rejects an escaping staging path beside an adjacent safe staging path",
    safeName: "...",
    unsafeName: path.join("..", "escape"),
    invoke: (locations: ScopedLocations, name: string) => locations.sourcesStagingDir(name),
    expectedSafePath: (extensionRoot: string, name: string) =>
      path.join(extensionRoot, "sources-staging", name),
    expectedErrorName: "PathContainmentError",
    expectedErrorMessage: (extensionRoot: string, name: string) => {
      const stagingRoot = path.join(extensionRoot, "sources-staging");
      const escapedPath = path.join(extensionRoot, "escape");
      return `sourcesStagingDir(${name}) escapes ${stagingRoot} (resolved: ${escapedPath}).`;
    },
  },
] as const) {
  test(title, async () => {
    // arrange
    const projectRoot = path.join(path.parse(process.cwd()).root, "boundary-fixture", "project");
    const extensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const locations = locationsFor("project", projectRoot);
    const expectedPath = expectedSafePath(extensionRoot, safeName);
    const expectedMessage = expectedErrorMessage(extensionRoot, unsafeName);

    // act
    const safePath = await invoke(locations, safeName);
    const unsafePath = invoke(locations, unsafeName);

    // assert
    assert.strictEqual(safePath, expectedPath);
    await assert.rejects(unsafePath, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.name, expectedErrorName);
      assert.strictEqual(error.message, expectedMessage);
      return true;
    });
  });
}
