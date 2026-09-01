import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadMergedClaudeSettingsForScope,
  mergeClaudeSettings,
  resolveClaudeSettingsPaths,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/settings.ts";

import type { TestContext } from "node:test";

interface EnvironmentProperty {
  readonly exists: boolean;
  readonly value: string | undefined;
}

function captureEnvironmentProperty(name: string): EnvironmentProperty {
  return {
    exists: Object.hasOwn(process.env, name),
    value: process.env[name],
  };
}

function restoreEnvironmentProperty(name: string, property: EnvironmentProperty): void {
  if (property.exists && property.value !== undefined) {
    process.env[name] = property.value;
  } else {
    Reflect.deleteProperty(process.env, name);
  }
}

async function makeTempRoot(t: TestContext, prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function writeSettings(
  configRoot: string,
  kind: "base" | "local",
  value: unknown,
): Promise<string> {
  const filePath = path.join(configRoot, kind === "base" ? "settings.json" : "settings.local.json");
  await mkdir(configRoot, { recursive: true });
  await writeFile(filePath, JSON.stringify(value), "utf8");
  return filePath;
}

test("resolves default user paths from the private home root when the config variable is absent", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-default-user-");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  let paths;

  // act
  try {
    delete process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = root;
    paths = resolveClaudeSettingsPaths("user");
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(paths, {
    basePath: path.join(root, ".claude", "settings.json"),
    localPath: path.join(root, ".claude", "settings.local.json"),
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("resolves explicit user paths ahead of an absolute config environment value", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-explicit-user-");
  const explicitRoot = path.join(root, "explicit");
  const environmentRoot = path.join(root, "environment");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  let paths;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = environmentRoot;
    paths = resolveClaudeSettingsPaths("user", { claudeConfigDir: explicitRoot });
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(paths, {
    basePath: path.join(explicitRoot, "settings.json"),
    localPath: path.join(explicitRoot, "settings.local.json"),
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});

test("resolves user paths from an absolute config environment value", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-environment-user-");
  const environmentRoot = path.join(root, "environment");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  let paths;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = environmentRoot;
    paths = resolveClaudeSettingsPaths("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(paths, {
    basePath: path.join(environmentRoot, "settings.json"),
    localPath: path.join(environmentRoot, "settings.local.json"),
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});

test("ignores a relative config environment value when resolving user paths", () => {
  // arrange
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  let paths;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    paths = resolveClaudeSettingsPaths("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(paths, {
    basePath: path.join(homedir(), ".claude", "settings.json"),
    localPath: path.join(homedir(), ".claude", "settings.local.json"),
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});

test("resolves explicit and default project paths independently from the config environment", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-project-paths-");
  const projectRoot = path.join(root, "project");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  let explicitPaths;
  let defaultPaths;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "ignored-user-config");
    explicitPaths = resolveClaudeSettingsPaths("project", { cwd: projectRoot });
    defaultPaths = resolveClaudeSettingsPaths("project");
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(explicitPaths, {
    basePath: path.join(projectRoot, ".claude", "settings.json"),
    localPath: path.join(projectRoot, ".claude", "settings.local.json"),
  });
  assert.deepStrictEqual(defaultPaths, {
    basePath: path.join(process.cwd(), ".claude", "settings.json"),
    localPath: path.join(process.cwd(), ".claude", "settings.local.json"),
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});

test("shallow-merges known sections with local precedence", () => {
  // arrange
  const base = {
    enabledPlugins: { "alpha@market": true, "shared@market": true },
    extraKnownMarketplaces: {
      alpha: { source: "base-alpha" },
      shared: { source: "base-shared", nested: { base: true } },
    },
    ignored: { base: true },
  };
  const local = {
    enabledPlugins: { "beta@market": true, "shared@market": false },
    extraKnownMarketplaces: {
      beta: { source: "local-beta" },
      shared: { source: "local-shared" },
    },
    ignored: { local: true },
  };

  // act
  const settings = mergeClaudeSettings(base, local);

  // assert
  assert.deepStrictEqual(settings, {
    enabledPlugins: {
      "alpha@market": true,
      "shared@market": false,
      "beta@market": true,
    },
    extraKnownMarketplaces: {
      alpha: { source: "base-alpha" },
      shared: { source: "local-shared" },
      beta: { source: "local-beta" },
    },
  });
});

test("treats every nonobject known section as empty", () => {
  // arrange
  const base = {
    enabledPlugins: "invalid",
    extraKnownMarketplaces: null,
  };
  const local = {
    enabledPlugins: ["invalid"],
    extraKnownMarketplaces: 42,
  };

  // act
  const settings = mergeClaudeSettings(base, local);

  // assert
  assert.deepStrictEqual(settings, {
    enabledPlugins: {},
    extraKnownMarketplaces: {},
  });
});

test("loads missing base and local files as complete empty settings", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-missing-");

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
});

test("loads and shallow-merges complete base and local settings", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-valid-");
  await writeSettings(configRoot, "base", {
    enabledPlugins: { "alpha@market": true, "shared@market": true },
    extraKnownMarketplaces: {
      alpha: { source: "base-alpha" },
      shared: { source: "base-shared" },
    },
    ignored: "base-only",
  });
  await writeSettings(configRoot, "local", {
    enabledPlugins: { "beta@market": false, "shared@market": false },
    extraKnownMarketplaces: {
      beta: { source: "local-beta" },
      shared: { source: "local-shared" },
    },
    ignored: "local-only",
  });

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: {
        "alpha@market": true,
        "shared@market": false,
        "beta@market": false,
      },
      extraKnownMarketplaces: {
        alpha: { source: "base-alpha" },
        shared: { source: "local-shared" },
        beta: { source: "local-beta" },
      },
    },
    diagnostics: [],
  });
});

test("keeps valid base settings when the local file is absent", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-base-only-");
  await writeSettings(configRoot, "base", {
    enabledPlugins: { "alpha@market": true },
    extraKnownMarketplaces: { alpha: { source: "base-alpha" } },
  });

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "alpha@market": true },
      extraKnownMarketplaces: { alpha: { source: "base-alpha" } },
    },
    diagnostics: [],
  });
});

test("loads nonobject JSON files as empty settings without diagnostics", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-nonobject-");
  await writeSettings(configRoot, "base", ["not", "an", "object"]);
  await writeSettings(configRoot, "local", null);

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
});

test("reports malformed base and local JSON in file order with exact wording", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-malformed-");
  const basePath = path.join(configRoot, "settings.json");
  const localPath = path.join(configRoot, "settings.local.json");
  await writeFile(basePath, "{base", "utf8");
  await writeFile(localPath, "{local", "utf8");

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath,
      localPath,
    },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [
      {
        severity: "warning",
        scope: "user",
        code: "malformed-json",
        path: basePath,
        message:
          "Ignoring malformed Claude base settings JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      },
      {
        severity: "warning",
        scope: "user",
        code: "malformed-json",
        path: localPath,
        message:
          "Ignoring malformed Claude local settings JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      },
    ],
  });
});

test("reports non-ENOENT base and local read failures in exact order", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-read-errors-");
  const configRoot = path.join(root, "config-file");
  const basePath = path.join(configRoot, "settings.json");
  const localPath = path.join(configRoot, "settings.local.json");
  await writeFile(configRoot, "not a directory", "utf8");

  // act
  const result = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(result, {
    paths: { basePath, localPath },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [
      {
        severity: "warning",
        scope: "user",
        code: "settings-read-error",
        path: basePath,
        message: `Unable to read Claude base settings file: ENOTDIR: not a directory, open '${basePath}'`,
      },
      {
        severity: "warning",
        scope: "user",
        code: "settings-read-error",
        path: localPath,
        message: `Unable to read Claude local settings file: ENOTDIR: not a directory, open '${localPath}'`,
      },
    ],
  });
});

test("reports invalid environment, malformed base, and unreadable local diagnostics in order", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-diagnostic-order-");
  const configRoot = path.join(root, ".claude");
  const basePath = path.join(configRoot, "settings.json");
  const localPath = path.join(configRoot, "settings.local.json");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  await mkdir(localPath, { recursive: true });
  await writeFile(basePath, "{base", "utf8");
  let result;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    process.env.HOME = root;
    result = await loadMergedClaudeSettingsForScope("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(result, {
    paths: { basePath, localPath },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [
      {
        severity: "warning",
        scope: "user",
        code: "invalid-claude-config-dir",
        message:
          'CLAUDE_CONFIG_DIR is not an absolute path ("relative/config"); falling back to ~/.claude.',
      },
      {
        severity: "warning",
        scope: "user",
        code: "malformed-json",
        path: basePath,
        message:
          "Ignoring malformed Claude base settings JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      },
      {
        severity: "warning",
        scope: "user",
        code: "settings-read-error",
        path: localPath,
        message: `Unable to read Claude local settings file: EISDIR: illegal operation on a directory, read`,
      },
    ],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("suppresses the invalid-environment warning when an explicit user root is supplied", async (t) => {
  // arrange
  const configRoot = await makeTempRoot(t, "import-settings-explicit-suppression-");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  let result;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    result = await loadMergedClaudeSettingsForScope("user", {
      claudeConfigDir: configRoot,
    });
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});

test("does not report a user-environment warning while loading project settings", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-project-load-");
  const projectRoot = path.join(root, "project");
  const configRoot = path.join(projectRoot, ".claude");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  await writeSettings(configRoot, "base", {
    enabledPlugins: { "alpha@market": true },
    extraKnownMarketplaces: { alpha: { source: "project-alpha" } },
  });
  let result;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    result = await loadMergedClaudeSettingsForScope("project", { cwd: projectRoot });
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(result, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "alpha@market": true },
      extraKnownMarketplaces: { alpha: { source: "project-alpha" } },
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
});
