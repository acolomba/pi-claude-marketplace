import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, watch, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  DEFAULT_STATE,
  STATE_VALIDATOR,
  type DisabledPluginRecord,
  type EnabledPluginRecord,
  type ExtensionState,
  type PluginInstallRecord,
  clonePluginRecord,
  isRecordedButDisabled,
  loadState,
  saveState,
  toDisabledRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

interface HooksOnlyResources {
  readonly skills: [];
  readonly prompts: [];
  readonly agents: [];
  readonly mcpServers: [];
  readonly hooks: [string];
}

void ({
  version: "1.0.0",
  resolvedSource: "/plugins/active",
  compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
  resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
  enabled: true,
  installedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies EnabledPluginRecord);

// @ts-expect-error an enabled record must retain the true discriminant
void ({ enabled: false } satisfies EnabledPluginRecord);

async function createExtensionRoot(t: TestContext, prefix: string): Promise<string> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  return extensionRoot;
}

test("publishes the exact frozen default state", () => {
  // arrange
  const expectedState = { schemaVersion: 2, marketplaces: {} };

  // act
  const defaultState = DEFAULT_STATE;

  // assert
  assert.deepStrictEqual(defaultState, expectedState);
  assert.strictEqual(Object.isFrozen(defaultState), true);
});

for (const { enabled, expectedDisabled } of [
  { enabled: true, expectedDisabled: false },
  { enabled: false, expectedDisabled: true },
]) {
  test(`reports enabled ${String(enabled)} as disabled ${String(expectedDisabled)}`, () => {
    // arrange
    const record = { enabled };

    // act
    const disabled = isRecordedButDisabled(record);

    // assert
    assert.strictEqual(disabled, expectedDisabled);
  });
}

test("clones every plugin field without retaining nested aliases", () => {
  // arrange
  const record: PluginInstallRecord = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/acme/plugin",
    resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    hookEntries: [{ event: "PreToolUse", matcher: "Bash" }, { event: "SessionStart" }],
    compatibility: {
      installable: false,
      notes: ["partial"],
      supported: ["skills"],
      unsupported: ["commands"],
    },
    resources: {
      skills: ["skill-a"],
      prompts: ["command-a"],
      agents: ["agent-a"],
      mcpServers: ["mcp-a"],
      hooks: ["hooks-a"],
    },
    enabled: false,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
  const expectedRecord: PluginInstallRecord = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/acme/plugin",
    resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    hookEntries: [{ event: "PreToolUse", matcher: "Bash" }, { event: "SessionStart" }],
    compatibility: {
      installable: false,
      notes: ["partial"],
      supported: ["skills"],
      unsupported: ["commands"],
    },
    resources: {
      skills: ["skill-a"],
      prompts: ["command-a"],
      agents: ["agent-a"],
      mcpServers: ["mcp-a"],
      hooks: ["hooks-a"],
    },
    enabled: false,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };

  // act
  const clonedRecord = clonePluginRecord(record);

  // assert
  assert.deepStrictEqual(clonedRecord, expectedRecord);
  assert.notStrictEqual(clonedRecord, record);
  assert.notStrictEqual(clonedRecord.hookEntries, record.hookEntries);
  assert.notStrictEqual(clonedRecord.hookEntries?.[0], record.hookEntries?.[0]);
  assert.notStrictEqual(clonedRecord.compatibility, record.compatibility);
  assert.notStrictEqual(clonedRecord.compatibility.notes, record.compatibility.notes);
  assert.notStrictEqual(clonedRecord.resources, record.resources);
  assert.notStrictEqual(clonedRecord.resources.skills, record.resources.skills);
});

test("clones a legacy plugin without inventing optional fields", () => {
  // arrange
  const record: PluginInstallRecord = {
    version: "1.0.0",
    resolvedSource: "/plugins/legacy",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  // act
  const clonedRecord = clonePluginRecord(record);

  // assert
  assert.deepStrictEqual(clonedRecord, {
    version: "1.0.0",
    resolvedSource: "/plugins/legacy",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  });
  assert.strictEqual(Object.hasOwn(clonedRecord, "resolvedSha"), false);
  assert.strictEqual(Object.hasOwn(clonedRecord, "hookEntries"), false);
});

test("disables a plugin while preserving its complete inventory", () => {
  // arrange
  const resources: HooksOnlyResources = {
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
    hooks: ["hooks-a"],
  };
  const record: PluginInstallRecord & { resources: HooksOnlyResources } = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/acme/plugin",
    resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    hookEntries: [{ event: "PreToolUse", matcher: "Bash" }],
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources,
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const expectedRecord: DisabledPluginRecord<HooksOnlyResources> = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/acme/plugin",
    resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    hookEntries: [{ event: "PreToolUse", matcher: "Bash" }],
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources,
    enabled: false,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  };

  // act
  const disabledRecord: DisabledPluginRecord<HooksOnlyResources> = toDisabledRecord(
    record,
    "2026-02-02T00:00:00.000Z",
  );

  // assert
  assert.deepStrictEqual(disabledRecord, expectedRecord);
  assert.strictEqual(disabledRecord.resources, resources);
});

for (const { name, state, accepted } of [
  { name: "schema version 1", state: { schemaVersion: 1, marketplaces: {} }, accepted: true },
  { name: "schema version 2", state: { schemaVersion: 2, marketplaces: {} }, accepted: true },
  { name: "schema version 3", state: { schemaVersion: 3, marketplaces: {} }, accepted: false },
  {
    name: "optional reconciliation stamp",
    state: { schemaVersion: 2, lastReconciledExtensionVersion: "0.17.0", marketplaces: {} },
    accepted: true,
  },
]) {
  test(`validates ${name}`, () => {
    // arrange
    const storedState = state;

    // act
    const valid = STATE_VALIDATOR.Check(storedState);

    // assert
    assert.strictEqual(valid, accepted);
  });
}

test("rejects an unsupported stored schema version without replacing future bytes", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-future-version-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const storedBytes = '{"schemaVersion":3,"marketplaces":{},"futureField":"keep"}\n';
  await writeFile(stateJsonPath, storedBytes);

  // act
  const error = await loadState(extensionRoot).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const retainedBytes = await readFile(stateJsonPath, "utf8");

  // assert
  assert.ok(error instanceof Error);
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "Error",
      message: `state.json at ${stateJsonPath} has an unsupported schema version`,
      cause: undefined,
    },
  );
  assert.strictEqual(retainedBytes, storedBytes);
});

test("loads a null legacy root as empty state without replacing the stored bytes", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-null-root-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const storedBytes = "null\n";
  await writeFile(stateJsonPath, storedBytes);

  // act
  const state = await loadState(extensionRoot);
  const retainedBytes = await readFile(stateJsonPath, "utf8");

  // assert
  assert.deepStrictEqual(state, { schemaVersion: 2, marketplaces: {} });
  assert.strictEqual(retainedBytes, storedBytes);
});

test("validates complete hook and resolved-sha plugin records", () => {
  // arrange
  const storedState = {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {
          plugin: {
            version: "1.0.0",
            resolvedSource: "/catalog/plugin",
            resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            hookEntries: [{ event: "PreToolUse", matcher: "Bash" }],
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: ["hooks-a"],
            },
            enabled: true,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };

  // act
  const valid = STATE_VALIDATOR.Check(storedState);

  // assert
  assert.strictEqual(valid, true);
});

test("returns the exact default for a missing state file", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-missing-");
  const expectedState: ExtensionState = { schemaVersion: 2, marketplaces: {} };

  // act
  const state = await loadState(extensionRoot);

  // assert
  assert.deepStrictEqual(state, expectedState);
  assert.notStrictEqual(state, DEFAULT_STATE);
});

test("normalizes a complete version-2 document and preserves its stamp", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-valid-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const storedState = {
    schemaVersion: 2,
    lastReconciledExtensionVersion: "0.16.0",
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "project",
        source: { kind: "path", raw: "./catalog", logical: "stale" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        lastUpdatedAt: "2026-01-02T00:00:00.000Z",
        plugins: {},
      },
    },
  };
  const expectedState: ExtensionState = {
    schemaVersion: 2,
    lastReconciledExtensionVersion: "0.16.0",
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "project",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        lastUpdatedAt: "2026-01-02T00:00:00.000Z",
        plugins: {},
      },
    },
  };
  await writeFile(stateJsonPath, JSON.stringify(storedState));

  // act
  const state = await loadState(extensionRoot);

  // assert
  assert.deepStrictEqual(state, expectedState);
  assert.strictEqual(await readFile(stateJsonPath, "utf8"), JSON.stringify(storedState));
});

test(
  "migrates legacy state, persists exact bytes, and replays as a fixed point",
  { timeout: 5_000 },
  async (t) => {
    // arrange
    const extensionRoot = await createExtensionRoot(t, "state-io-legacy-");
    const stateJsonPath = path.join(extensionRoot, "state.json");
    const storedState = {
      schemaVersion: 1,
      marketplaces: {
        legacy: {
          name: "legacy",
          scope: "user",
          source: "./legacy",
          addedFromCwd: "/work",
          plugins: {
            plugin: {
              version: "1.0.0",
              resolvedSource: "/legacy/plugin",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: ["skill-a"], prompts: ["command-a"] },
              installedAt: "2025-01-01T00:00:00.000Z",
              updatedAt: "2025-01-01T00:00:00.000Z",
            },
          },
        },
      },
    };
    const expectedState: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        legacy: {
          name: "legacy",
          scope: "user",
          source: { kind: "path", raw: "./legacy", logical: "./legacy" },
          addedFromCwd: "/work",
          manifestPath: path.join(
            extensionRoot,
            "sources",
            "legacy",
            ".claude-plugin",
            "marketplace.json",
          ),
          marketplaceRoot: path.join(extensionRoot, "sources", "legacy"),
          plugins: {
            plugin: {
              version: "1.0.0",
              resolvedSource: "/legacy/plugin",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: ["skill-a"],
                prompts: ["command-a"],
                agents: [],
                mcpServers: [],
                hooks: [],
              },
              enabled: true,
              installedAt: "2025-01-01T00:00:00.000Z",
              updatedAt: "2025-01-01T00:00:00.000Z",
            },
          },
        },
      },
    };
    const expectedBytes = `{
  "schemaVersion": 2,
  "marketplaces": {
    "legacy": {
      "name": "legacy",
      "scope": "user",
      "source": {
        "kind": "path",
        "raw": "./legacy",
        "logical": "./legacy"
      },
      "addedFromCwd": "/work",
      "plugins": {
        "plugin": {
          "version": "1.0.0",
          "resolvedSource": "/legacy/plugin",
          "compatibility": {
            "installable": true,
            "notes": [],
            "supported": [],
            "unsupported": []
          },
          "resources": {
            "skills": [
              "skill-a"
            ],
            "prompts": [
              "command-a"
            ],
            "agents": [],
            "mcpServers": [],
            "hooks": []
          },
          "installedAt": "2025-01-01T00:00:00.000Z",
          "updatedAt": "2025-01-01T00:00:00.000Z",
          "enabled": true
        }
      },
      "manifestPath": ${JSON.stringify(path.join(extensionRoot, "sources", "legacy", ".claude-plugin", "marketplace.json"))},
      "marketplaceRoot": ${JSON.stringify(path.join(extensionRoot, "sources", "legacy"))}
    }
  }
}
`;
    await writeFile(stateJsonPath, JSON.stringify(storedState));
    const controller = new AbortController();
    t.after(() => {
      controller.abort();
    });
    const changes = watch(extensionRoot, { signal: controller.signal })[Symbol.asyncIterator]();
    const stateJsonChanged = (async () => {
      while (true) {
        const change = await changes.next();
        if (change.done) {
          throw new Error("state.json watcher ended before persistence");
        }

        if (change.value.filename === "state.json") {
          return change.value;
        }
      }
    })();

    // act
    const state = await loadState(extensionRoot);
    const change = await stateJsonChanged;
    await changes.return?.();
    const persistedBytes = await readFile(stateJsonPath, "utf8");
    const persistedMetadata = await stat(stateJsonPath, { bigint: true });
    const replayedState = await loadState(extensionRoot);
    const replayedBytes = await readFile(stateJsonPath, "utf8");
    const replayedMetadata = await stat(stateJsonPath, { bigint: true });

    // assert
    assert.deepStrictEqual({ ...change }, { eventType: "rename", filename: "state.json" });
    assert.deepStrictEqual(state, expectedState);
    assert.strictEqual(persistedBytes, expectedBytes);
    assert.deepStrictEqual(replayedState, expectedState);
    assert.strictEqual(replayedBytes, expectedBytes);
    assert.deepStrictEqual(
      {
        ino: replayedMetadata.ino,
        size: replayedMetadata.size,
        mtimeNs: replayedMetadata.mtimeNs,
        ctimeNs: replayedMetadata.ctimeNs,
      },
      {
        ino: persistedMetadata.ino,
        size: persistedMetadata.size,
        mtimeNs: persistedMetadata.mtimeNs,
        ctimeNs: persistedMetadata.ctimeNs,
      },
    );
  },
);

test("saves exact version-2 bytes and loads the complete state", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-save-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const state: ExtensionState = {
    schemaVersion: 2,
    lastReconciledExtensionVersion: "0.17.0",
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "github", raw: "acme/catalog", repo: "acme/catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {},
      },
    },
  };
  const expectedBytes = `${JSON.stringify(state, null, 2)}\n`;
  const expectedState: ExtensionState = {
    schemaVersion: 2,
    lastReconciledExtensionVersion: "0.17.0",
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "github", raw: "acme/catalog", owner: "acme", repo: "catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {},
      },
    },
  };

  // act
  await saveState(extensionRoot, state);
  const storedBytes = await readFile(stateJsonPath, "utf8");
  const loadedState = await loadState(extensionRoot);

  // assert
  assert.strictEqual(storedBytes, expectedBytes);
  assert.deepStrictEqual(loadedState, expectedState);
});

test("accepts and stores a version-1 empty state", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-save-v1-");
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };

  // act
  await saveState(extensionRoot, state);
  const storedBytes = await readFile(path.join(extensionRoot, "state.json"), "utf8");

  // assert
  assert.strictEqual(storedBytes, '{\n  "schemaVersion": 1,\n  "marketplaces": {}\n}\n');
});

for (const { name, source, expectedSource } of [
  {
    name: "a stored GitHub source",
    source: { kind: "github", raw: "acme/catalog", owner: "stale", repo: "stale" },
    expectedSource: { kind: "github", raw: "acme/catalog", owner: "acme", repo: "catalog" },
  },
  {
    name: "a stored URL source",
    source: {
      kind: "url",
      raw: "https://git.example.com/acme/catalog.git#release",
      url: "stale",
    },
    expectedSource: {
      kind: "url",
      raw: "https://git.example.com/acme/catalog.git#release",
      url: "https://git.example.com/acme/catalog",
      ref: "release",
    },
  },
  {
    name: "a forward-compatible unknown source",
    source: { kind: "unknown", raw: "future:catalog", reason: "future source" },
    expectedSource: { kind: "unknown", raw: "future:catalog", reason: "future source" },
  },
]) {
  test(`normalizes ${name} through the public load path`, async (t) => {
    // arrange
    const extensionRoot = await createExtensionRoot(t, "state-io-source-");
    const stateJsonPath = path.join(extensionRoot, "state.json");
    const storedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source,
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          plugins: {},
        },
      },
    };
    const expectedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source: expectedSource,
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          plugins: {},
        },
      },
    };
    await writeFile(stateJsonPath, JSON.stringify(storedState));

    // act
    const state = await loadState(extensionRoot);

    // assert
    assert.deepStrictEqual(state, expectedState);
  });
}

for (const { name, source, expectedMessage } of [
  {
    name: "an unclassifiable raw string",
    source: "catalog",
    expectedMessage:
      'state.json marketplace "catalog" has unclassifiable source: non-relative string source catalog cannot be classified',
  },
  {
    name: "a null source",
    source: null,
    expectedMessage: 'state.json marketplace "catalog" has missing or invalid source',
  },
  {
    name: "a primitive source",
    source: 17,
    expectedMessage: 'state.json marketplace "catalog" has missing or invalid source',
  },
  {
    name: "a URL record whose raw value classifies as GitHub",
    source: { kind: "url", raw: "acme/catalog" },
    expectedMessage: 'state.json marketplace "catalog" has an invalid url source: acme/catalog',
  },
  {
    name: "a path record without a raw string",
    source: { kind: "path" },
    expectedMessage:
      'state.json marketplace "catalog" has malformed source object (missing kind/raw)',
  },
]) {
  test(`rejects ${name} with the complete public error`, async (t) => {
    // arrange
    const extensionRoot = await createExtensionRoot(t, "state-io-source-error-");
    const stateJsonPath = path.join(extensionRoot, "state.json");
    const storedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source,
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          plugins: {},
        },
      },
    };
    await writeFile(stateJsonPath, JSON.stringify(storedState));

    // act & assert
    await assert.rejects(
      () => loadState(extensionRoot),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message, cause: error.cause },
          { name: "Error", message: expectedMessage, cause: undefined },
        );
        return true;
      },
    );
  });
}

test("rejects malformed JSON with its complete structured cause", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-json-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  await writeFile(stateJsonPath, "{");

  // act & assert
  await assert.rejects(
    () => loadState(extensionRoot),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof SyntaxError);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          cause: { name: error.cause.name, message: error.cause.message },
        },
        {
          name: "Error",
          message: `state.json at ${stateJsonPath} is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)`,
          cause: {
            name: "SyntaxError",
            message: "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
          },
        },
      );
      return true;
    },
  );
});

test("wraps a non-missing read failure with its filesystem cause", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-read-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  await mkdir(stateJsonPath);

  // act & assert
  await assert.rejects(
    () => loadState(extensionRoot),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof Error);
      const cause = error.cause as NodeJS.ErrnoException;
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          cause: {
            name: cause.name,
            code: cause.code,
            errno: cause.errno,
            syscall: cause.syscall,
          },
        },
        {
          name: "Error",
          // Composed from the cause rather than from a literal: the runtime owns the errno wording
          // and later majors append the offending path to it. What this pins is the composition.
          message: `Failed to read ${stateJsonPath}: ${cause.message}`,
          cause: {
            name: "Error",
            code: "EISDIR",
            errno: -21,
            syscall: "read",
          },
        },
      );
      return true;
    },
  );
});

test("reports the exact post-normalization schema failure", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-schema-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const storedState = {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {
          plugin: {
            version: "1.0.0",
            resolvedSource: "/catalog/plugin",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: null,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await writeFile(stateJsonPath, JSON.stringify(storedState));

  // act & assert
  await assert.rejects(
    () => loadState(extensionRoot),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message, cause: error.cause },
        {
          name: "Error",
          message: `state.json at ${stateJsonPath} failed schema validation: /marketplaces/catalog/plugins/plugin/enabled: must be boolean`,
          cause: undefined,
        },
      );
      return true;
    },
  );
});

test("formats a root validator failure through the public loader", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-root-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const rootErrors = STATE_VALIDATOR.Errors(null);
  t.mock.method(STATE_VALIDATOR, "Check", () => false);
  t.mock.method(STATE_VALIDATOR, "Errors", () => rootErrors);
  await writeFile(stateJsonPath, "{}");

  // act & assert
  await assert.rejects(
    () => loadState(extensionRoot),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message, cause: error.cause },
        {
          name: "Error",
          message: `state.json at ${stateJsonPath} failed schema validation: <root>: must be object`,
          cause: undefined,
        },
      );
      return true;
    },
  );
});

test("uses the no-detail fallback when an invalid save has no validator errors", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-empty-errors-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const existingBytes = '{"keep":true}\n';
  const invalidState = { schemaVersion: 3, marketplaces: {} } as unknown as ExtensionState;
  t.mock.method(STATE_VALIDATOR, "Errors", () => []);
  await writeFile(stateJsonPath, existingBytes);

  // act
  const error = await saveState(extensionRoot, invalidState).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const retainedBytes = await readFile(stateJsonPath, "utf8");

  // assert
  assert.ok(error instanceof Error);
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "Error",
      message: "saveState refused: in-memory state failed schema validation: (no detail available)",
      cause: undefined,
    },
  );
  assert.strictEqual(retainedBytes, existingBytes);
});

test("rejects an invalid save before replacing existing bytes", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-save-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const existingBytes = '{"keep":true}\n';
  const invalidState = {
    schemaVersion: 2,
    marketplaces: { catalog: { name: "catalog" } },
  } as unknown as ExtensionState;
  await writeFile(stateJsonPath, existingBytes);

  // act
  const error = await saveState(extensionRoot, invalidState).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  const retainedBytes = await readFile(stateJsonPath, "utf8");

  // assert
  assert.ok(error instanceof Error);
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "Error",
      message:
        "saveState refused: in-memory state failed schema validation: /marketplaces/catalog: must have required properties scope, source, addedFromCwd, manifestPath, marketplaceRoot, plugins",
      cause: undefined,
    },
  );
  assert.strictEqual(retainedBytes, existingBytes);
});

test("ignores a non-string reconciliation stamp", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-stamp-");
  const storedState = {
    schemaVersion: 2,
    lastReconciledExtensionVersion: 17,
    marketplaces: {},
  };
  await writeFile(path.join(extensionRoot, "state.json"), JSON.stringify(storedState));

  // act
  const state = await loadState(extensionRoot);

  // assert
  assert.deepStrictEqual(state, { schemaVersion: 2, marketplaces: {} });
});

test("preserves legacy autoupdate while the config migration gate is closed", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-gate-closed-");
  const storedState = {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        autoupdate: true,
        plugins: {},
      },
    },
  };
  await writeFile(path.join(extensionRoot, "state.json"), JSON.stringify(storedState));

  // act
  const state = await loadState(extensionRoot);

  // assert
  assert.deepStrictEqual(state, storedState);
});

test(
  "scrubs and persists legacy autoupdate when the config migration gate is open",
  { timeout: 5_000 },
  async (t) => {
    // arrange
    const extensionRoot = await createExtensionRoot(t, "state-io-gate-open-");
    const scopeRoot = path.dirname(extensionRoot);
    const stateJsonPath = path.join(extensionRoot, "state.json");
    const storedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source: { kind: "path", raw: "./catalog", logical: "./catalog" },
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          autoupdate: true,
          plugins: {},
        },
      },
    };
    const expectedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source: { kind: "path", raw: "./catalog", logical: "./catalog" },
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          plugins: {},
        },
      },
    };
    const expectedBytes = `{
  "schemaVersion": 2,
  "marketplaces": {
    "catalog": {
      "name": "catalog",
      "scope": "user",
      "source": {
        "kind": "path",
        "raw": "./catalog",
        "logical": "./catalog"
      },
      "addedFromCwd": "/work",
      "manifestPath": "/catalog/.claude-plugin/marketplace.json",
      "marketplaceRoot": "/catalog",
      "plugins": {}
    }
  }
}
`;
    await writeFile(path.join(scopeRoot, "claude-plugins.json"), "{}");
    await writeFile(stateJsonPath, JSON.stringify(storedState));
    const controller = new AbortController();
    t.after(() => {
      controller.abort();
    });
    const changes = watch(extensionRoot, { signal: controller.signal })[Symbol.asyncIterator]();
    const stateJsonChanged = (async () => {
      while (true) {
        const change = await changes.next();
        if (change.done) {
          throw new Error("state.json watcher ended before persistence");
        }

        if (change.value.filename === "state.json") {
          return;
        }
      }
    })();

    // act
    const state = await loadState(extensionRoot);
    await stateJsonChanged;
    await changes.return?.();
    const persistedBytes = await readFile(stateJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(state, expectedState);
    assert.strictEqual(persistedBytes, expectedBytes);
  },
);

for (const { name, plugin } of [
  {
    name: "a plugin without hooks",
    plugin: {
      version: "1.0.0",
      resolvedSource: "/catalog/plugin",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
      enabled: true,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    name: "a plugin with non-array hooks",
    plugin: {
      version: "1.0.0",
      resolvedSource: "/catalog/plugin",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: "hooks" },
      enabled: true,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    name: "a plugin without enabled",
    plugin: {
      version: "1.0.0",
      resolvedSource: "/catalog/plugin",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
]) {
  test(`rejects ${name} at the published validator`, () => {
    // arrange
    const storedState = {
      schemaVersion: 2,
      marketplaces: {
        catalog: {
          name: "catalog",
          scope: "user",
          source: { kind: "path", raw: "./catalog", logical: "./catalog" },
          addedFromCwd: "/work",
          manifestPath: "/catalog/.claude-plugin/marketplace.json",
          marketplaceRoot: "/catalog",
          plugins: { plugin },
        },
      },
    };

    // act
    const valid = STATE_VALIDATOR.Check(storedState);

    // assert
    assert.strictEqual(valid, false);
  });
}

test("round-trips resolved sha and hook entries through exact state bytes", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-plugin-roundtrip-");
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {
          plugin: {
            version: "sha-a1b2c3d4e5f6",
            resolvedSource: "https://github.com/acme/plugin",
            resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            hookEntries: [{ event: "SessionStart" }],
            compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["hooks-a"] },
            enabled: true,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  const expectedState: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "user",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/work",
        manifestPath: "/catalog/.claude-plugin/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {
          plugin: {
            version: "sha-a1b2c3d4e5f6",
            resolvedSource: "https://github.com/acme/plugin",
            resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            hookEntries: [{ event: "SessionStart" }],
            compatibility: {
              installable: true,
              notes: [],
              supported: ["hooks"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: ["hooks-a"],
            },
            enabled: true,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  const expectedBytes = `${JSON.stringify(expectedState, null, 2)}\n`;

  // act
  await saveState(extensionRoot, state);
  const storedBytes = await readFile(path.join(extensionRoot, "state.json"), "utf8");
  const loadedState = await loadState(extensionRoot);

  // assert
  assert.strictEqual(storedBytes, expectedBytes);
  assert.deepStrictEqual(loadedState, expectedState);
});

test("derives the config migration gate path from the public locations contract", () => {
  // arrange
  const locations = locationsFor("project", path.join(tmpdir(), "state-io-drift-guard"));

  // act
  const derivedConfigPath = path.join(path.dirname(locations.extensionRoot), "claude-plugins.json");

  // assert
  assert.strictEqual(derivedConfigPath, locations.configJsonPath);
});
