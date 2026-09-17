import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadMergedClaudeSettingsForScope } from "../../../extensions/pi-claude-marketplace/orchestrators/import/settings.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

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

test("loads default user paths from the private home root when the config variable is absent", async (t) => {
  // arrange
  const { home: root } = await createHermeticEnvironment(t, "import-settings-default-user-");
  const configRoot = path.join(root, ".claude");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    delete process.env.CLAUDE_CONFIG_DIR;
    loaded = await loadMergedClaudeSettingsForScope("user");
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(process.env.HOME, root);
});

test("loads explicit user paths ahead of an absolute config environment value", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-explicit-user-");
  const configRoot = path.join(root, "explicit");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "environment");
    loaded = await loadMergedClaudeSettingsForScope("user", {
      claudeConfigDir: path.join(root, "explicit"),
    });
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("loads user paths from an absolute config environment value", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-environment-user-");
  const configRoot = path.join(root, "environment");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "environment");
    loaded = await loadMergedClaudeSettingsForScope("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("loads private home settings with a warning for a relative config environment value", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-relative-user-");
  const configRoot = path.join(root, ".claude");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    process.env.HOME = root;
    loaded = await loadMergedClaudeSettingsForScope("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
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

test("loads explicit project paths independently from the config environment", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-explicit-project-");
  const configRoot = path.join(root, "project", ".claude");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "ignored-user-config");
    loaded = await loadMergedClaudeSettingsForScope("project", {
      cwd: path.join(root, "project"),
    });
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("loads default project paths independently from the config environment", async (t) => {
  // arrange
  const root = await makeTempRoot(t, "import-settings-default-project-");
  const configRoot = path.join(root, "project", ".claude");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  const originalHome = captureEnvironmentProperty("HOME");
  t.mock.method(process, "cwd", () => path.join(root, "project"));
  await writeSettings(configRoot, "base", { enabledPlugins: { "base@market": true } });
  await writeSettings(configRoot, "local", { enabledPlugins: { "local@market": false } });
  let loaded;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "ignored-user-config");
    loaded = await loadMergedClaudeSettingsForScope("project");
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
    restoreEnvironmentProperty("HOME", originalHome);
  }

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    settings: {
      enabledPlugins: { "base@market": true, "local@market": false },
      extraKnownMarketplaces: {},
    },
    diagnostics: [],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(Object.hasOwn(process.env, "HOME"), originalHome.exists);
  assert.strictEqual(process.env.HOME, originalHome.value);
});

test("shallow-merges known sections with local precedence", async (t) => {
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

  const configRoot = await makeTempRoot(t, "import-settings-merge-");
  await writeSettings(configRoot, "base", base);
  await writeSettings(configRoot, "local", local);

  // act
  const loaded = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    diagnostics: [],
    settings: {
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
    },
  });
});

test("treats every nonobject known section as empty", async (t) => {
  // arrange
  const base = {
    enabledPlugins: "invalid",
    extraKnownMarketplaces: null,
  };
  const local = {
    enabledPlugins: ["invalid"],
    extraKnownMarketplaces: 42,
  };

  const configRoot = await makeTempRoot(t, "import-settings-merge-");
  await writeSettings(configRoot, "base", base);
  await writeSettings(configRoot, "local", local);

  // act
  const loaded = await loadMergedClaudeSettingsForScope("user", {
    claudeConfigDir: configRoot,
  });

  // assert
  assert.deepStrictEqual(loaded, {
    paths: {
      basePath: path.join(configRoot, "settings.json"),
      localPath: path.join(configRoot, "settings.local.json"),
    },
    diagnostics: [],
    settings: {
      enabledPlugins: {},
      extraKnownMarketplaces: {},
    },
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
  const { home: root } = await createHermeticEnvironment(t, "import-settings-diagnostic-order-");
  const configRoot = path.join(root, ".claude");
  const basePath = path.join(configRoot, "settings.json");
  const localPath = path.join(configRoot, "settings.local.json");
  const originalConfigDirectory = captureEnvironmentProperty("CLAUDE_CONFIG_DIR");
  await mkdir(localPath, { recursive: true });
  // Read back the runtime's own errno wording: later majors append the offending path to it.
  // The failure's IDENTITY is not runtime-owned, so it is pinned here rather than left to the
  // composition: the probe is the same read production makes, so it moves with whatever is on
  // disk. A fixture that drifted to a missing file would report ENOENT on both sides and leave
  // this case green against a different failure entirely.
  const readFailure = await readFile(localPath, "utf8").catch((error: unknown) => {
    const errno = error as NodeJS.ErrnoException;
    assert.deepStrictEqual(
      { code: errno.code, syscall: errno.syscall },
      { code: "EISDIR", syscall: "read" },
    );
    return errno.message;
  });
  await writeFile(basePath, "{base", "utf8");
  let result;

  // act
  try {
    process.env.CLAUDE_CONFIG_DIR = "relative/config";
    result = await loadMergedClaudeSettingsForScope("user", {});
  } finally {
    restoreEnvironmentProperty("CLAUDE_CONFIG_DIR", originalConfigDirectory);
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
        message: `Unable to read Claude local settings file: ${readFailure}`,
      },
    ],
  });
  assert.strictEqual(
    Object.hasOwn(process.env, "CLAUDE_CONFIG_DIR"),
    originalConfigDirectory.exists,
  );
  assert.strictEqual(process.env.CLAUDE_CONFIG_DIR, originalConfigDirectory.value);
  assert.strictEqual(process.env.HOME, root);
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
