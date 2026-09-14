import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { workflowProjectKey } from "../../extensions/pi-claude-marketplace/domain/workflow-project-key.ts";
import {
  type ScopedLocations,
  locationsFor,
} from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

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
  "workflowsHomeDir",
  "workflowsSavedDir",
  "workflowsStagingDir",
  "pluginDataDir",
  "marketplaceDataDir",
  "sourceCloneDir",
  "pluginCloneDir",
  "sourcesStagingDir",
  "pluginCacheFile",
  "workflowArtifactPath",
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

/**
 * Relocate the home directory `os.homedir()` reads, and hand the new home back
 * so the caller never re-reads the global it just wrote: a caller reading
 * `process.env.HOME` back needs a `?? ""` to satisfy `strictNullChecks`, and
 * that fallback turns a broken precondition into a silent cwd-relative probe
 * instead of a failure.
 *
 * The previous value is saved and its restoration registered before anything
 * is mutated, so a failing assertion cannot leave the variable relocated. A
 * variable that was absent is deleted rather than reassigned, because
 * `process.env` stringifies every assignment and an absent variable restored by
 * assignment would come back as the four letters `undefined`.
 *
 * WPTH-04: call this BEFORE `locationsFor`. The factory evaluates the workflow
 * home eagerly and freezes the result, so a bundle built before the relocation
 * points at the developer's real `~/.pi/workflows/` and the case still passes
 * while writing there.
 */
async function hermeticHome(t: TestContext, label: string): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), `locations-home-${label}-`));
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
  return home;
}

async function temporaryDirectory(t: TestContext, label: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), `locations-${label}-`));

  t.after(async () => {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  return directory;
}

/** Pure containment predicate; the boundary itself does not count as inside. */
function isInsideDirectory(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
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

for (const { title, parentFor, linkSegments, childSegments, invoke, label } of [
  {
    title: "plugin data refuses a symlinked marketplace component",
    parentFor: (locations: ScopedLocations) => locations.dataRoot,
    linkSegments: ["market"],
    childSegments: ["market", "plugin"],
    invoke: (locations: ScopedLocations) => locations.pluginDataDir("market", "plugin"),
    label: "pluginDataDir(market, plugin)",
  },
  {
    title: "marketplace data refuses a symlinked marketplace component",
    parentFor: (locations: ScopedLocations) => locations.dataRoot,
    linkSegments: ["market"],
    childSegments: ["market"],
    invoke: (locations: ScopedLocations) => locations.marketplaceDataDir("market"),
    label: "marketplaceDataDir(market)",
  },
  {
    title: "source clones refuse a symlinked marketplace component",
    parentFor: (locations: ScopedLocations) => locations.sourcesDir,
    linkSegments: ["market"],
    childSegments: ["market"],
    invoke: (locations: ScopedLocations) => locations.sourceCloneDir("market"),
    label: "sourceCloneDir(market)",
  },
  {
    title: "plugin clones refuse a symlinked clone-key component",
    parentFor: (locations: ScopedLocations) => locations.pluginClonesDir,
    linkSegments: ["clone-key"],
    childSegments: ["clone-key"],
    invoke: (locations: ScopedLocations) => locations.pluginCloneDir("clone-key"),
    label: "pluginCloneDir(clone-key)",
  },
  {
    title: "source staging refuses a symlinked identifier component",
    parentFor: (locations: ScopedLocations) =>
      path.join(locations.extensionRoot, "sources-staging"),
    linkSegments: ["stage-id"],
    childSegments: ["stage-id"],
    invoke: (locations: ScopedLocations) => locations.sourcesStagingDir("stage-id"),
    label: "sourcesStagingDir(stage-id)",
  },
  {
    title: "plugin cache refuses a symlinked intermediate directory",
    parentFor: (locations: ScopedLocations) => locations.cacheDir,
    linkSegments: ["plugins"],
    childSegments: ["plugins", "market.json"],
    invoke: (locations: ScopedLocations) => locations.pluginCacheFile("market"),
    label: "pluginCacheFile(market)",
  },
] as const) {
  test(title, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "locations-symlink-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const projectRoot = path.join(directory, "project");
    const outsideRoot = path.join(directory, "outside");
    const locations = locationsFor("project", projectRoot);
    const parent = parentFor(locations);
    const linkPath = path.join(parent, ...linkSegments);
    const child = path.join(parent, ...childSegments);
    await mkdir(path.dirname(linkPath), { recursive: true });
    await mkdir(outsideRoot);
    await writeFile(path.join(outsideRoot, "sentinel.txt"), "outside sentinel\n");
    await symlink(outsideRoot, linkPath);
    const outsideTreeBefore = await readdir(outsideRoot);
    const outsideBytesBefore = await readFile(path.join(outsideRoot, "sentinel.txt"));
    const expectedError = {
      name: "SymlinkRefusedError",
      message: `${label} contains symlink ${linkPath} -> ${outsideRoot} (parent: ${parent}, target: ${child}).`,
      parent,
      child,
      linkPath,
      linkTarget: outsideRoot,
    };
    let symlinkError: unknown;

    // act
    try {
      await invoke(locations);
    } catch (error) {
      symlinkError = error;
    }

    // assert
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
    assert.deepStrictEqual(await readdir(outsideRoot), outsideTreeBefore);
    assert.deepStrictEqual(
      await readFile(path.join(outsideRoot, "sentinel.txt")),
      outsideBytesBefore,
    );
  });
}

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

test("derives every user-scope workflows path from the home directory", async (t) => {
  // arrange
  const home = await hermeticHome(t, "user-values");
  const projectDirectory = await temporaryDirectory(t, "user-cwd");
  const workflowsHome = path.join(home, ".pi", "workflows");
  const expectedWorkflowsPaths = {
    workflowsHomeDir: workflowsHome,
    workflowsSavedDir: path.join(workflowsHome, "saved"),
    workflowsStagingDir: path.join(workflowsHome, ".pi-claude-marketplace-staging"),
  };

  // act
  const locations = locationsFor("user", projectDirectory);

  // assert
  assert.deepStrictEqual(
    {
      workflowsHomeDir: locations.workflowsHomeDir,
      workflowsSavedDir: locations.workflowsSavedDir,
      workflowsStagingDir: locations.workflowsStagingDir,
    },
    expectedWorkflowsPaths,
  );
});

test("WPTH-01 branches only the saved directory on scope", async (t) => {
  // arrange
  const home = await hermeticHome(t, "project-saved");
  const projectDirectory = await temporaryDirectory(t, "project-cwd");
  // The project key is obtained from its own module rather than transcribed:
  // this case asserts where the key LANDS, and the derivation itself is pinned
  // by a literal parity table in that module's own owner test. A second copy of
  // those literals here would give the derivation two sources of truth.
  const expectedProjectValues = {
    workflowsSavedDir: path.join(
      home,
      ".pi",
      "workflows",
      "projects",
      workflowProjectKey(projectDirectory),
      "saved",
    ),
    homeMatchesUserScope: true,
    stagingMatchesUserScope: true,
  };

  // act
  const userLocations = locationsFor("user", projectDirectory);
  const projectLocations = locationsFor("project", projectDirectory);

  // assert
  assert.deepStrictEqual(
    {
      workflowsSavedDir: projectLocations.workflowsSavedDir,
      homeMatchesUserScope: projectLocations.workflowsHomeDir === userLocations.workflowsHomeDir,
      stagingMatchesUserScope:
        projectLocations.workflowsStagingDir === userLocations.workflowsStagingDir,
    },
    expectedProjectValues,
  );
});

test("WPTH-02 roots the saved directory under the home and never under the project", async (t) => {
  // arrange
  await hermeticHome(t, "home-derived");
  // A project directory distinct from the relocated home is what makes the
  // home derivation observable: with one directory serving as both, these
  // assertions pass just as happily for a project-derived saved directory.
  const projectDirectory = await temporaryDirectory(t, "home-derived-cwd");

  // act
  const locations = locationsFor("project", projectDirectory);

  // assert
  assert.deepStrictEqual(
    {
      underProjectDirectory: isInsideDirectory(projectDirectory, locations.workflowsSavedDir),
      legacyProjectPath:
        locations.workflowsSavedDir === path.join(projectDirectory, ".pi", "workflows", "saved"),
    },
    { underProjectDirectory: false, legacyProjectPath: false },
  );
});

test("WPTH-05 keeps the staging directory outside every scope and extension root", async (t) => {
  // arrange
  const hadAgentDirectory = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  t.after(() => {
    restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);
  });
  await hermeticHome(t, "staging-invariant");
  const firstAgentDirectory = await temporaryDirectory(t, "staging-agent-first");
  const secondAgentDirectory = await temporaryDirectory(t, "staging-agent-second");
  const firstProjectDirectory = await temporaryDirectory(t, "staging-cwd-first");
  const secondProjectDirectory = await temporaryDirectory(t, "staging-cwd-second");

  // act
  process.env.PI_CODING_AGENT_DIR = firstAgentDirectory;
  const userLocations = locationsFor("user", firstProjectDirectory);
  process.env.PI_CODING_AGENT_DIR = secondAgentDirectory;
  const projectLocations = locationsFor("project", secondProjectDirectory);
  restoreAgentDirectory(hadAgentDirectory, previousAgentDirectory);

  // assert
  // Two bundles under one home but with differing agent directories and
  // project directories. A refactor that rerouted staging under the extension
  // root would break both the equality and the containment booleans; a
  // rename-fails assertion would not, because whether the two roots land on
  // one filesystem is a property of the machine, not of the code.
  assert.deepStrictEqual(
    {
      stagingIsIdentical:
        userLocations.workflowsStagingDir === projectLocations.workflowsStagingDir,
      insideUserScopeRoot: isInsideDirectory(
        userLocations.scopeRoot,
        userLocations.workflowsStagingDir,
      ),
      insideUserExtensionRoot: isInsideDirectory(
        userLocations.extensionRoot,
        userLocations.workflowsStagingDir,
      ),
      insideProjectScopeRoot: isInsideDirectory(
        projectLocations.scopeRoot,
        projectLocations.workflowsStagingDir,
      ),
      insideProjectExtensionRoot: isInsideDirectory(
        projectLocations.extensionRoot,
        projectLocations.workflowsStagingDir,
      ),
    },
    {
      stagingIsIdentical: true,
      insideUserScopeRoot: false,
      insideUserExtensionRoot: false,
      insideProjectScopeRoot: false,
      insideProjectExtensionRoot: false,
    },
  );
});

test("keeps the staging directory adjacent to the saved directory", async (t) => {
  // arrange
  const home = await hermeticHome(t, "adjacency");
  const projectDirectory = await temporaryDirectory(t, "adjacency-cwd");
  const expectedAdjacency = {
    stagingParent: path.join(home, ".pi", "workflows"),
    savedUnderWorkflowHome: true,
  };

  // act
  const locations = locationsFor("project", projectDirectory);

  // assert
  // Weak on its own: it restates the composer, so it guards a careless edit
  // rather than standing in for the cross-configuration invariant above.
  assert.deepStrictEqual(
    {
      stagingParent: path.dirname(locations.workflowsStagingDir),
      savedUnderWorkflowHome: isInsideDirectory(
        locations.workflowsHomeDir,
        locations.workflowsSavedDir,
      ),
    },
    expectedAdjacency,
  );
});

test("composes a workflow artifact path from a safe generated name", async (t) => {
  // arrange
  const home = await hermeticHome(t, "artifact-path");
  const projectDirectory = await temporaryDirectory(t, "artifact-cwd");
  const generatedName = "acme:deploy";
  const expectedArtifactPath = path.join(home, ".pi", "workflows", "saved", "acme:deploy.json");
  const locations = locationsFor("user", projectDirectory);

  // act
  const artifactPath = await locations.workflowArtifactPath(generatedName);

  // assert
  assert.strictEqual(artifactPath, expectedArtifactPath);
});

for (const { title, unsafeName, expectedMessage } of [
  {
    title: "an empty generated name",
    unsafeName: "",
    expectedMessage: 'workflowArtifactPath workflow name "" must be a non-empty string.',
  },
  {
    title: "a whitespace-only generated name",
    unsafeName: " ",
    expectedMessage: 'workflowArtifactPath workflow name " " must be a non-empty string.',
  },
  {
    title: "the current-directory generated name",
    unsafeName: ".",
    expectedMessage: 'workflowArtifactPath workflow name "." must not be "." or "..".',
  },
  {
    title: "the parent-directory generated name",
    unsafeName: "..",
    expectedMessage: 'workflowArtifactPath workflow name ".." must not be "." or "..".',
  },
  {
    title: "a forward slash in a generated name",
    unsafeName: "acme/deploy",
    expectedMessage:
      'workflowArtifactPath workflow name "acme/deploy" "acme/deploy" must not contain path separators.',
  },
  {
    title: "a backslash in a generated name",
    unsafeName: "acme\\deploy",
    expectedMessage:
      'workflowArtifactPath workflow name "acme\\deploy" "acme\\deploy" must not contain path separators.',
  },
  {
    title: "an ASCII control character in a generated name",
    unsafeName: "acme\x00deploy",
    expectedMessage:
      'workflowArtifactPath workflow name "acme\x00deploy" "acme\x00deploy" must not contain ASCII control characters.',
  },
] as const) {
  test(`rejects ${title} before composing any path`, async (t) => {
    // arrange
    await hermeticHome(t, "artifact-refusal");
    const projectDirectory = await temporaryDirectory(t, "artifact-refusal-cwd");
    const locations = locationsFor("user", projectDirectory);

    // act
    const rejection = locations.workflowArtifactPath(unsafeName);

    // assert
    // The thrown value is the name check's own plain Error rather than a
    // containment error, which is what places the refusal upstream of the join.
    await assert.rejects(rejection, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message },
        { name: "Error", message: expectedMessage },
      );
      return true;
    });
  });
}

test("refuses a symbolic link planted at the composed artifact path", async (t) => {
  // arrange
  const home = await hermeticHome(t, "artifact-symlink");
  const projectDirectory = await temporaryDirectory(t, "artifact-symlink-cwd");
  const savedDirectory = path.join(home, ".pi", "workflows", "saved");
  const artifactPath = path.join(savedDirectory, "acme:linked.json");
  const linkTarget = path.join(projectDirectory, "elsewhere.json");
  await mkdir(savedDirectory, { recursive: true });
  await symlink(linkTarget, artifactPath);
  const locations = locationsFor("user", projectDirectory);

  // act
  const rejection = locations.workflowArtifactPath("acme:linked");

  // assert
  await assert.rejects(rejection, (error: unknown) => {
    assert.ok(error instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      { name: error.name, linkPath: error.linkPath, linkTarget: error.linkTarget },
      { name: "SymlinkRefusedError", linkPath: artifactPath, linkTarget },
    );
    return true;
  });
});
