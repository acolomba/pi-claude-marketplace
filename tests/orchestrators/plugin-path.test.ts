import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  collectBinDirs,
  recomputePluginPath,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin-path.ts";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

interface PathEnvironmentSnapshot {
  readonly agentDir: string | undefined;
  readonly debug: string | undefined;
  readonly home: string | undefined;
  readonly ledger: string | undefined;
  readonly path: string | undefined;
}

function pluginRecord(resolvedSource: string, enabled: boolean): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled,
    installedAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function marketplaceRecord(
  name: string,
  scope: "user" | "project",
  sourceRoot: string,
  plugins: Record<string, PluginInstallRecord>,
): ExtensionState["marketplaces"][string] {
  return {
    name,
    scope,
    source: { kind: "path", raw: sourceRoot },
    addedFromCwd: sourceRoot,
    manifestPath: path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: sourceRoot,
    plugins,
  };
}

function stateFor(
  scope: "user" | "project",
  sourceRoot: string,
  plugins: Record<string, PluginInstallRecord>,
): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      catalog: marketplaceRecord("catalog", scope, sourceRoot, plugins),
    },
  };
}

async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(path.join(extensionRoot, "state.json"), JSON.stringify(state), "utf8");
}

async function seedUnsupportedState(extensionRoot: string): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({ schemaVersion: 3, marketplaces: {} }),
    "utf8",
  );
}

function snapshotPathEnvironment(): PathEnvironmentSnapshot {
  return {
    agentDir: process.env.PI_CODING_AGENT_DIR,
    debug: process.env.PI_CLAUDE_MARKETPLACE_DEBUG,
    home: process.env.HOME,
    ledger: process.env.PI_CLAUDE_MARKETPLACE_PATH,
    path: process.env.PATH,
  };
}

function restorePathEnvironment(snapshot: PathEnvironmentSnapshot): void {
  if (snapshot.agentDir === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = snapshot.agentDir;
  }

  if (snapshot.debug === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = snapshot.debug;
  }

  if (snapshot.home === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = snapshot.home;
  }

  if (snapshot.ledger === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_PATH = snapshot.ledger;
  }

  if (snapshot.path === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = snapshot.path;
  }
}

function pathEnvironmentShape(): {
  readonly ledger: { readonly present: boolean; readonly value?: string | undefined };
  readonly path: { readonly present: boolean; readonly value?: string | undefined };
} {
  return {
    ledger: Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_PATH")
      ? { present: true, value: process.env.PI_CLAUDE_MARKETPLACE_PATH }
      : { present: false },
    path: Object.hasOwn(process.env, "PATH")
      ? { present: true, value: process.env.PATH }
      : { present: false },
  };
}

describe("collectBinDirs", () => {
  test("collects enabled bins in marketplace and plugin insertion order", () => {
    // arrange
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        zeta: marketplaceRecord("zeta", "user", "/marketplaces/zeta", {
          second: pluginRecord("/plugins/second", true),
          disabled: pluginRecord("/plugins/disabled", false),
          first: pluginRecord("/plugins/first", true),
        }),
        alpha: marketplaceRecord("alpha", "project", "/marketplaces/alpha", {
          last: pluginRecord("/plugins/last", true),
        }),
      },
    };

    // act
    const binDirs = collectBinDirs(state);

    // assert
    assert.deepStrictEqual(binDirs, [
      path.join("/plugins/second", "bin"),
      path.join("/plugins/first", "bin"),
      path.join("/plugins/last", "bin"),
    ]);
  });

  test("returns no bins for an empty state", () => {
    // arrange
    const state: ExtensionState = { schemaVersion: 2, marketplaces: {} };

    // act
    const binDirs = collectBinDirs(state);

    // assert
    assert.deepStrictEqual(binDirs, []);
  });

  test("drops every invalid root with an ordered complete diagnostic", (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const consoleError = t.mock.method(console, "error", () => undefined);
    const poisonedRoot = `/plugins${path.delimiter}poison`;
    const state = stateFor("user", "/marketplaces/catalog", {
      empty: pluginRecord("", true),
      relative: pluginRecord("plugins/relative", true),
      poisoned: pluginRecord(poisonedRoot, true),
      disabledInvalid: pluginRecord("plugins/disabled", false),
      valid: pluginRecord("/plugins/valid", true),
    });

    try {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";

      // act
      const binDirs = collectBinDirs(state);

      // assert
      assert.deepStrictEqual(binDirs, [path.join("/plugins/valid", "bin")]);
      assert.deepStrictEqual(
        consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [
          [
            "[env] plugin PATH: dropped invalid resolvedSource for catalog/empty: AbsolutePluginRoot: empty string",
          ],
          [
            "[env] plugin PATH: dropped invalid resolvedSource for catalog/relative: AbsolutePluginRoot: not absolute: plugins/relative",
          ],
          [
            `[env] plugin PATH: dropped invalid resolvedSource for catalog/poisoned: AbsolutePluginRoot: contains PATH delimiter: ${poisonedRoot}`,
          ],
        ],
      );
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });
});

describe("recomputePluginPath", () => {
  test("applies user then project bins, removes stale ownership, and deduplicates", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-"));
    const userFirst = path.join(userRoot, "missing-user-first");
    const shared = path.join(projectRoot, "missing-shared");
    const projectLast = path.join(projectRoot, "missing-project-last");
    const stale = path.join(userRoot, "stale-bin");
    const baseline = path.join(userRoot, "system-bin");

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      process.env.PATH = [baseline, stale].join(path.delimiter);
      process.env.PI_CLAUDE_MARKETPLACE_PATH = stale;
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, {
          userFirst: pluginRecord(userFirst, true),
          shared: pluginRecord(shared, true),
        }),
      );
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, {
          shared: pluginRecord(shared, true),
          projectLast: pluginRecord(projectLast, true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: {
          present: true,
          value: [
            path.join(userFirst, "bin"),
            path.join(shared, "bin"),
            path.join(projectLast, "bin"),
          ].join(path.delimiter),
        },
        path: {
          present: true,
          value: [
            baseline,
            path.join(userFirst, "bin"),
            path.join(shared, "bin"),
            path.join(projectLast, "bin"),
          ].join(path.delimiter),
        },
      });
      await assert.rejects(() => access(path.join(userFirst, "bin")), { code: "ENOENT" });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("reports an exact user read failure and keeps the project contribution", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-failure-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-healthy-"));
    const userExtensionRoot = path.join(userRoot, "pi-claude-marketplace");
    const projectSource = path.join(projectRoot, "project-plugin");
    const baseline = path.join(projectRoot, "system-bin");

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedUnsupportedState(userExtensionRoot);
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, {
          projectPlugin: pluginRecord(projectSource, true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, {
        skipped: [
          {
            scope: "user",
            reason: `state.json at ${path.join(userExtensionRoot, "state.json")} has an unsupported schema version`,
          },
        ],
      });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: path.join(projectSource, "bin") },
        path: {
          present: true,
          value: [baseline, path.join(projectSource, "bin")].join(path.delimiter),
        },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("reports an exact project read failure and keeps the user contribution", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-healthy-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-failure-"));
    const projectExtensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const userSource = path.join(userRoot, "user-plugin");
    const baseline = path.join(userRoot, "system-bin");

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, {
          userPlugin: pluginRecord(userSource, true),
        }),
      );
      await seedUnsupportedState(projectExtensionRoot);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, {
        skipped: [
          {
            scope: "project",
            reason: `state.json at ${path.join(projectExtensionRoot, "state.json")} has an unsupported schema version`,
          },
        ],
      });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: path.join(userSource, "bin") },
        path: {
          present: true,
          value: [baseline, path.join(userSource, "bin")].join(path.delimiter),
        },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("reports both read failures in scope order and removes every owned path", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-failure-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-failure-"));
    const userExtensionRoot = path.join(userRoot, "pi-claude-marketplace");
    const projectExtensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const baseline = path.join(userRoot, "system-bin");
    const userOwned = path.join(userRoot, "owned-bin");
    const projectOwned = path.join(projectRoot, "owned-bin");

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      process.env.PATH = [baseline, userOwned, projectOwned].join(path.delimiter);
      process.env.PI_CLAUDE_MARKETPLACE_PATH = [userOwned, projectOwned].join(path.delimiter);
      await seedUnsupportedState(userExtensionRoot);
      await seedUnsupportedState(projectExtensionRoot);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, {
        skipped: [
          {
            scope: "user",
            reason: `state.json at ${path.join(userExtensionRoot, "state.json")} has an unsupported schema version`,
          },
          {
            scope: "project",
            reason: `state.json at ${path.join(projectExtensionRoot, "state.json")} has an unsupported schema version`,
          },
        ],
      });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: "" },
        path: { present: true, value: baseline },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("preserves absent PATH and ledger properties when both states have no bins", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-empty-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-empty-"));

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      delete process.env.PATH;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: false },
        path: { present: false },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("preserves empty PATH and ledger properties when both states have no bins", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-empty-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-empty-"));

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      process.env.PATH = "";
      process.env.PI_CLAUDE_MARKETPLACE_PATH = "";

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: "" },
        path: { present: true, value: "" },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });

  test("materializes absent PATH and ledger properties only when a bin must be applied", async () => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const userRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-user-apply-"));
    const projectRoot = await mkdtemp(path.join(tmpdir(), "plugin-path-project-empty-"));
    const userSource = path.join(userRoot, "plugin-source");

    try {
      process.env.PI_CODING_AGENT_DIR = userRoot;
      process.env.HOME = userRoot;
      delete process.env.PATH;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, {
          userPlugin: pluginRecord(userSource, true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: path.join(userSource, "bin") },
        path: { present: true, value: path.join(userSource, "bin") },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
      await Promise.all([
        rm(userRoot, { recursive: true, force: true }),
        rm(projectRoot, { recursive: true, force: true }),
      ]);
    }
  });
});
