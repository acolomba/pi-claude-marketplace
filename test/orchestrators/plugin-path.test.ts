import assert from "node:assert/strict";
import { mkdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { recomputePluginPath } from "../../extensions/pi-claude-marketplace/orchestrators/plugin-path.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { marketplaceRecord, pluginRecord, seedState, stateFor } from "./scope-state-seeds.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

interface PathEnvironmentSnapshot {
  readonly debug: string | undefined;
  readonly ledger: string | undefined;
  readonly path: string | undefined;
}

// D-PG10-03: a bin joins PATH only when it is a directory, so a case that
// expects an entry gives the plugin a real one.
async function binDirectoryOf(pluginRoot: string): Promise<string> {
  const binDir = path.join(pluginRoot, "bin");
  await mkdir(binDir, { recursive: true });
  return binDir;
}

async function seedUnsupportedState(extensionRoot: string): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({ schemaVersion: 4, marketplaces: {} }),
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

interface BinFilterOutcome {
  readonly ledger: string | undefined;
  readonly logs: readonly string[];
}

// Recomputes PATH for one enabled project plugin at `pluginRoot`, with debug
// logging on, and returns the ledger and the debug lines.
async function recomputeOnePlugin(
  t: TestContext,
  projectRoot: string,
  pluginRoot: string,
): Promise<BinFilterOutcome> {
  const consoleError = t.mock.method(console, "error", () => undefined);
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
  await seedState(
    path.join(projectRoot, ".pi", "pi-claude-marketplace"),
    stateFor("project", projectRoot, { plugin: pluginRecord(pluginRoot, true) }),
  );
  const pathUpdate = await recomputePluginPath(projectRoot, true);
  assert.deepStrictEqual(pathUpdate, { skipped: [] });
  return {
    ledger: process.env.PI_CLAUDE_MARKETPLACE_PATH,
    logs: consoleError.mock.calls.map(({ arguments: [line] }) => String(line)),
  };
}

describe("recomputePluginPath", () => {
  test("applies enabled bins in marketplace and plugin insertion order", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-order-");
    const baseline = path.join(projectRoot, "system-bin");
    const pluginRoot = (name: string): string => path.join(projectRoot, "plugins", name);
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        zeta: marketplaceRecord("zeta", "project", "/marketplaces/zeta", {
          second: pluginRecord(pluginRoot("second"), true),
          disabled: pluginRecord(pluginRoot("disabled"), false),
          first: pluginRecord(pluginRoot("first"), true),
        }),
        alpha: marketplaceRecord("alpha", "project", "/marketplaces/alpha", {
          last: pluginRecord(pluginRoot("last"), true),
        }),
      },
    };
    await binDirectoryOf(pluginRoot("disabled"));
    const appended = [
      await binDirectoryOf(pluginRoot("second")),
      await binDirectoryOf(pluginRoot("first")),
      await binDirectoryOf(pluginRoot("last")),
    ];

    try {
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), state);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      valid: pluginRecord(path.join(projectRoot, "valid"), true),
    });
    const validBin = await binDirectoryOf(path.join(projectRoot, "valid"));

    try {
      process.env.PATH = baseline;
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(path.join(projectRoot, ".pi", "pi-claude-marketplace"), state);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, true);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
      assert.deepStrictEqual(pathEnvironmentShape(), {
        ledger: { present: true, value: validBin },
        path: { present: true, value: [baseline, validBin].join(path.delimiter) },
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
    const userFirst = path.join(userRoot, "user-first");
    const shared = path.join(projectRoot, "shared");
    const projectLast = path.join(projectRoot, "project-last");
    const stale = path.join(userRoot, "stale-bin");
    const baseline = path.join(userRoot, "system-bin");

    try {
      process.env.PATH = [baseline, stale].join(path.delimiter);
      process.env.PI_CLAUDE_MARKETPLACE_PATH = stale;
      await binDirectoryOf(userFirst);
      await binDirectoryOf(shared);
      await binDirectoryOf(projectLast);
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
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      await binDirectoryOf(projectSource);
      await seedUnsupportedState(userExtensionRoot);
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, {
          projectPlugin: pluginRecord(projectSource, true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      await binDirectoryOf(userSource);
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, {
          userPlugin: pluginRecord(userSource, true),
        }),
      );
      await seedUnsupportedState(projectExtensionRoot);

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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
      await binDirectoryOf(userSource);
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, {
          userPlugin: pluginRecord(userSource, true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, true);

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

  test("D-PG10-02: an untrusted project contributes no bin and its owned entries leave PATH", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { agentDir: userRoot, cwd: projectRoot } = await createHermeticEnvironment(
      t,
      "plugin-path-untrusted-",
    );
    const userSource = path.join(userRoot, "user-plugin");
    const projectSource = path.join(projectRoot, "project-plugin");
    const projectOwned = path.join(projectSource, "bin");
    const baseline = path.join(userRoot, "system-bin");

    try {
      process.env.PATH = [baseline, projectOwned].join(path.delimiter);
      process.env.PI_CLAUDE_MARKETPLACE_PATH = projectOwned;
      await binDirectoryOf(userSource);
      await binDirectoryOf(projectSource);
      await seedState(
        path.join(userRoot, "pi-claude-marketplace"),
        stateFor("user", userRoot, { userPlugin: pluginRecord(userSource, true) }),
      );
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, { projectPlugin: pluginRecord(projectSource, true) }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, false);

      // assert
      assert.deepStrictEqual(pathUpdate, { skipped: [] });
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

  test("D-PG10-02: an untrusted project's state file is not read, so a malformed one is not reported", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-unread-");
    const projectExtensionRoot = path.join(projectRoot, ".pi", "pi-claude-marketplace");
    const baseline = path.join(projectRoot, "system-bin");

    try {
      process.env.PATH = baseline;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await mkdir(projectExtensionRoot, { recursive: true });
      await writeFile(path.join(projectExtensionRoot, "state.json"), "{ not json", "utf8");

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, false);

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

  test("D-PG10-02: an untrusted project with no user bin and no ledger leaves absent properties absent", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-untrusted-empty-");

    try {
      delete process.env.PATH;
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, {
          projectPlugin: pluginRecord(path.join(projectRoot, "project-plugin"), true),
        }),
      );

      // act
      const pathUpdate = await recomputePluginPath(projectRoot, false);

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

  test("D-PG10-03: appends a bin that is a directory", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-dir-");
    const pluginRoot = path.join(projectRoot, "plugin");
    const binDir = await binDirectoryOf(pluginRoot);

    try {
      // act
      const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

      // assert
      assert.deepStrictEqual(outcome, { ledger: binDir, logs: [] });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("D-PG10-03: appends a bin that is a symbolic link to a directory", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-link-");
    const pluginRoot = path.join(projectRoot, "plugin");
    const target = await binDirectoryOf(path.join(projectRoot, "elsewhere"));
    await mkdir(pluginRoot, { recursive: true });
    await symlink(target, path.join(pluginRoot, "bin"), "dir");

    try {
      // act
      const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

      // assert
      assert.deepStrictEqual(outcome, { ledger: path.join(pluginRoot, "bin"), logs: [] });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  for (const { label, arrange, cause } of [
    {
      label: "a missing bin",
      arrange: (root: string) => mkdir(root, { recursive: true }),
      cause: "ENOENT",
    },
    {
      label: "a regular file named bin",
      arrange: async (root: string) => {
        await mkdir(root, { recursive: true });
        await writeFile(path.join(root, "bin"), "", "utf8");
      },
      cause: "not a directory",
    },
    {
      label: "a bin under a plugin root that is a file",
      arrange: async (root: string) => {
        await mkdir(path.dirname(root), { recursive: true });
        await writeFile(root, "", "utf8");
      },
      cause: "ENOTDIR",
    },
  ]) {
    test(`D-PG10-03: adds nothing for ${label} and logs the drop`, async (t) => {
      // arrange
      const environmentBefore = snapshotPathEnvironment();
      const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-absent-");
      const pluginRoot = path.join(projectRoot, "plugin");
      await arrange(pluginRoot);

      try {
        // act
        const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

        // assert
        assert.deepStrictEqual(outcome, {
          ledger: undefined,
          logs: [`[env] plugin PATH: dropped ${path.join(pluginRoot, "bin")}: ${cause}`],
        });
      } finally {
        restorePathEnvironment(environmentBefore);
      }
    });
  }

  for (const character of ['"', "'", "$", "`", "\\", "\n", "\r"]) {
    test(`D-PG10-22: drops an existing bin whose path holds ${JSON.stringify(character)}`, async (t) => {
      // arrange
      const environmentBefore = snapshotPathEnvironment();
      const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-meta-");
      const pluginRoot = path.join(projectRoot, `plug${character}in`);
      await binDirectoryOf(pluginRoot);

      try {
        // act
        const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

        // assert
        assert.deepStrictEqual(outcome, {
          ledger: undefined,
          logs: [
            `[env] plugin PATH: dropped ${path.join(pluginRoot, "bin")}: holds a shell metacharacter`,
          ],
        });
      } finally {
        restorePathEnvironment(environmentBefore);
      }
    });
  }

  test("D-PG10-22: drops a bin whose path holds the path delimiter", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-colon-");
    const pluginRoot = path.join(projectRoot, `plug${path.delimiter}in`);
    await binDirectoryOf(pluginRoot);

    try {
      // act
      const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

      // assert
      assert.deepStrictEqual(outcome, {
        ledger: undefined,
        logs: [
          `[env] plugin PATH: dropped invalid resolvedSource for catalog/plugin: AbsolutePluginRoot: contains PATH delimiter: ${pluginRoot}`,
        ],
      });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("D-PG10-22: keeps a bin whose stat fails with another error and logs it", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-loop-");
    const pluginRoot = path.join(projectRoot, "plugin");
    const binDir = path.join(pluginRoot, "bin");
    await mkdir(pluginRoot, { recursive: true });
    await symlink(binDir, binDir);
    // The runtime's own wording, which differs between Node releases.
    const statError = await stat(binDir).then(
      () => assert.fail("the self-link must not stat"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual((error as NodeJS.ErrnoException).code, "ELOOP");
        return error.message;
      },
    );

    try {
      // act
      const outcome = await recomputeOnePlugin(t, projectRoot, pluginRoot);

      // assert
      assert.deepStrictEqual(outcome, {
        ledger: binDir,
        logs: [`[env] plugin PATH: kept ${binDir} despite a stat error: ${statError}`],
      });
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("D-PG10-03: two enabled plugins, one with a bin directory, give one ledger entry", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-pair-");
    const withBin = path.join(projectRoot, "with-bin");
    const withoutBin = path.join(projectRoot, "without-bin");
    const binDir = await binDirectoryOf(withBin);
    await mkdir(withoutBin, { recursive: true });

    try {
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, {
          withBin: pluginRecord(withBin, true),
          withoutBin: pluginRecord(withoutBin, true),
        }),
      );

      // act
      await recomputePluginPath(projectRoot, true);

      // assert
      assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });

  test("D-PG10-03: a bin created after a recompute joins at the next one and leaves once removed", async (t) => {
    // arrange
    const environmentBefore = snapshotPathEnvironment();
    const { cwd: projectRoot } = await createHermeticEnvironment(t, "plugin-path-later-");
    const pluginRoot = path.join(projectRoot, "plugin");
    const binDir = path.join(pluginRoot, "bin");
    const ledgers: (string | undefined)[] = [];

    try {
      delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
      await mkdir(pluginRoot, { recursive: true });
      await seedState(
        path.join(projectRoot, ".pi", "pi-claude-marketplace"),
        stateFor("project", projectRoot, { plugin: pluginRecord(pluginRoot, true) }),
      );

      // act
      await recomputePluginPath(projectRoot, true);
      ledgers.push(process.env.PI_CLAUDE_MARKETPLACE_PATH);
      await binDirectoryOf(pluginRoot);
      await recomputePluginPath(projectRoot, true);
      ledgers.push(process.env.PI_CLAUDE_MARKETPLACE_PATH);
      await rm(binDir, { recursive: true });
      await recomputePluginPath(projectRoot, true);
      ledgers.push(process.env.PI_CLAUDE_MARKETPLACE_PATH);

      // assert
      assert.deepStrictEqual(ledgers, [undefined, binDir, ""]);
    } finally {
      restorePathEnvironment(environmentBefore);
    }
  });
});
