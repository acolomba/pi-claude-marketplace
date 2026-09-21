import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { recomputePluginPath } from "../../extensions/pi-claude-marketplace/orchestrators/plugin-path.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

interface PathEnvironmentSnapshot {
  readonly debug: string | undefined;
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
    debug: process.env.PI_CLAUDE_MARKETPLACE_DEBUG,
    ledger: process.env.PI_CLAUDE_MARKETPLACE_PATH,
    path: process.env.PATH,
  };
}

function restorePathEnvironment(snapshot: PathEnvironmentSnapshot): void {
  if (snapshot.debug === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = snapshot.debug;
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

describe("recomputePluginPath", () => {
  test("applies enabled bins in marketplace and plugin insertion order", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-order-");
    const baseline = path.join(projectRoot, "system-bin");
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        zeta: marketplaceRecord("zeta", "project", "/marketplaces/zeta", {
          second: pluginRecord("/plugins/second", true),
          disabled: pluginRecord("/plugins/disabled", false),
          first: pluginRecord("/plugins/first", true),
        }),
        alpha: marketplaceRecord("alpha", "project", "/marketplaces/alpha", {
          last: pluginRecord("/plugins/last", true),
        }),
      },
    };
    const appended = [
      path.join("/plugins/second", "bin"),
      path.join("/plugins/first", "bin"),
      path.join("/plugins/last", "bin"),
    ];

    try {
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), state);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: appended.join(path.delimiter) },
        path: { present: true, value: [baseline, ...appended].join(path.delimiter) },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("leaves an existing PATH untouched when a seeded state declares no marketplace", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-bare-");
    const baseline = path.join(projectRoot, "system-bin");

    try {
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), {
        schemaVersion: 2,
        marketplaces: {},
      });

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: false },
        path: { present: true, value: baseline },
      });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("drops every invalid root with an ordered complete diagnostic", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const consoleError = t.mock.method(console, "error", () => undefined);
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-invalid-");
    const baseline = path.join(projectRoot, "system-bin");
    const poisonedRoot = `/plugins${path.delimiter}poison`;
    const state = stateFor("project", "/marketplaces/catalog", {
      empty: pluginRecord("", true),
      relative: pluginRecord("plugins/relative", true),
      poisoned: pluginRecord(poisonedRoot, true),
      disabledInvalid: pluginRecord("plugins/disabled", false),
      valid: pluginRecord("/plugins/valid", true),
    });

    try {
      process.env.PATH = baseline;
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), state);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: path.join("/plugins/valid", "bin") },
        path: {
          present: true,
          value: [baseline, path.join("/plugins/valid", "bin")].join(path.delimiter),
        },
      });
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

  test("applies user then project bins, removes stale ownership, and deduplicates", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-",
    );
    const userFirst = path.join(userRoot, "missing-user-first");
    const shared = path.join(projectRoot, "missing-shared");
    const projectLast = path.join(projectRoot, "missing-project-last");
    const stale = path.join(userRoot, "stale-bin");
    const baseline = path.join(userRoot, "system-bin");

    try {
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
    }
  });

  test("reports an exact user read failure and keeps the project contribution", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-failure-",
    );
    const userExtensionRoot = path.join(userRoot, "pi-claude-marketplace");
    const projectSource = path.join(projectRoot, "project-plugin");
    const baseline = path.join(projectRoot, "system-bin");

    try {
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
    }
  });

  test("reports an exact project read failure and keeps the user contribution", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-healthy-",
    );
    const projectExtensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const userSource = path.join(userRoot, "user-plugin");
    const baseline = path.join(userRoot, "system-bin");

    try {
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
    }
  });

  test("reports both read failures in scope order and removes every owned path", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-failure-",
    );
    const userExtensionRoot = path.join(userRoot, "pi-claude-marketplace");
    const projectExtensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const baseline = path.join(userRoot, "system-bin");
    const userOwned = path.join(userRoot, "owned-bin");
    const projectOwned = path.join(projectRoot, "owned-bin");

    try {
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
    }
  });

  test("preserves absent PATH and ledger properties when both states have no bins", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-empty-");

    try {
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
    }
  });

  test("preserves empty PATH and ledger properties when both states have no bins", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-empty-");

    try {
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
    }
  });

  test("materializes absent PATH and ledger properties only when a bin must be applied", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-apply-",
    );
    const userSource = path.join(userRoot, "plugin-source");

    try {
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
    }
  });
});
