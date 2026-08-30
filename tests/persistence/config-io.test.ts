import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  CONFIG_VALIDATOR,
  type PluginConfigEntry,
  type ScopeConfig,
  isDeclaredEnabled,
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

void ({
  schemaVersion: 1,
  marketplaces: { tools: { source: "acme/tools", autoupdate: true } },
  plugins: { "reviewer@tools": { enabled: false } },
} satisfies ScopeConfig);
// @ts-expect-error schema version 2 belongs to a successor file
void ({ schemaVersion: 2 } satisfies ScopeConfig);

describe("isDeclaredEnabled", () => {
  test("treats an absent flag as enabled", () => {
    // arrange
    const entry = {} satisfies PluginConfigEntry;

    // act
    const enabled = isDeclaredEnabled(entry);

    // assert
    assert.strictEqual(enabled, true);
  });

  test("treats a true flag as enabled", () => {
    // arrange
    const entry = { enabled: true } as const;

    // act
    const enabled = isDeclaredEnabled(entry);

    // assert
    assert.strictEqual(enabled, true);
  });

  test("treats only a false flag as disabled", () => {
    // arrange
    const entry = { enabled: false } as const;

    // act
    const enabled = isDeclaredEnabled(entry);

    // assert
    assert.strictEqual(enabled, false);
  });
});

describe("CONFIG_VALIDATOR", () => {
  test("accepts a complete version-1 config", () => {
    // arrange
    const config = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools", autoupdate: true } },
      plugins: { "reviewer@tools": { enabled: true } },
    } as const;

    // act
    const accepted = CONFIG_VALIDATOR.Check(config);

    // assert
    assert.strictEqual(accepted, true);
  });
});

describe("loadConfig", () => {
  test("returns the complete absent result for a missing file", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-absent-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, { status: "absent" });
  });

  test("returns a complete ordinary version-1 config", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-valid-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(
      filePath,
      `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": false
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": true
    }
  }
}`,
    );
    const expectedConfig = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools", autoupdate: false } },
      plugins: { "reviewer@tools": { enabled: true } },
    };

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "valid",
      filePath,
      config: expectedConfig,
    });
  });

  test("keeps unknown top-level and entry fields visible", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-forward-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(
      filePath,
      `{
  "futureRoot": "retained",
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "futureMarketplace": 7
    }
  },
  "plugins": {
    "reviewer@tools": {
      "futurePlugin": true
    }
  }
}`,
    );
    const expectedConfig = {
      futureRoot: "retained",
      marketplaces: {
        tools: { source: "acme/tools", futureMarketplace: 7 },
      },
      plugins: {
        "reviewer@tools": { futurePlugin: true },
      },
    };

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "valid",
      filePath,
      config: expectedConfig,
    });
  });

  test("returns a complete valid result for an empty object", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-empty-object-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "{}");

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "valid",
      filePath,
      config: {},
    });
  });

  test("returns a complete parse failure for a zero-byte file", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-zero-byte-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "");

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error: "JSON parse failed: Unexpected end of JSON input",
    });
  });

  test("returns a complete parse failure for malformed JSON", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-malformed-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "{not json");

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error:
        "JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
    });
  });

  test("returns the root validator detail for null", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-null-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "null");

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error: "schema validation failed: <root>: must be object",
    });
  });

  test("rejects the adjacent schema version with its complete detail", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-version-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, '{"schemaVersion":2}');

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error: "schema validation failed: /schemaVersion: must be equal to constant",
    });
  });

  test("uses the no-detail fallback when validation exposes no errors", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-no-detail-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "null");
    t.mock.method(CONFIG_VALIDATOR, "Errors", () => []);

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error: "schema validation failed: (no detail available)",
    });
  });

  test("returns the complete ordinary read failure", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-read-failure-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await mkdir(filePath);

    // act
    const loadedConfig = await loadConfig(filePath);

    // assert
    assert.deepStrictEqual(loadedConfig, {
      status: "invalid",
      filePath,
      error: "read failed: EISDIR: illegal operation on a directory, read",
    });
  });
});

describe("saveConfig", () => {
  test("writes exact two-space JSON bytes inside the scope root", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "config-io-save-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "nested", "claude-plugins.json");
    await mkdir(path.dirname(filePath), { recursive: true });
    const config = {
      schemaVersion: 1,
      marketplaces: {
        tools: { source: "acme/tools", autoupdate: true },
      },
      plugins: {
        "reviewer@tools": { enabled: false },
      },
    } satisfies ScopeConfig;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": true
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": false
    }
  }
}
`;

    // act
    await saveConfig(filePath, config, scopeRoot);
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });

  test("rejects invalid data before containment and preserves existing bytes", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "config-io-invalid-save-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const scopeRoot = path.join(directory, "scope");
    const filePath = path.join(directory, "outside", "claude-plugins.json");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "unchanged invalid save\n");
    const invalidConfig: ScopeConfig = {};
    Object.assign(invalidConfig, { marketplaces: "not an object" });
    let saveError: unknown;

    // act
    try {
      await saveConfig(filePath, invalidConfig, scopeRoot);
    } catch (error) {
      saveError = error;
    }

    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.ok(saveError instanceof Error);
    assert.deepStrictEqual(
      { name: saveError.name, message: saveError.message },
      {
        name: "Error",
        message:
          "saveConfig refused: in-memory config failed schema validation: /marketplaces: must be object",
      },
    );
    assert.strictEqual(configBytes, "unchanged invalid save\n");
  });

  test("rejects an escaping path before replacement and preserves existing bytes", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "config-io-containment-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const scopeRoot = path.join(directory, "scope");
    const filePath = path.join(directory, "outside", "claude-plugins.json");
    await mkdir(scopeRoot, { recursive: true });
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "unchanged containment\n");
    const config = { schemaVersion: 1 } satisfies ScopeConfig;
    const expectedError = {
      name: "PathContainmentError",
      message: `saveConfig escapes ${scopeRoot} (resolved: ${filePath}).`,
      parent: scopeRoot,
      child: filePath,
    };
    let containmentError: unknown;

    // act
    try {
      await saveConfig(filePath, config, scopeRoot);
    } catch (error) {
      containmentError = error;
    }

    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.ok(containmentError instanceof Error);
    assert.ok("parent" in containmentError);
    assert.ok("child" in containmentError);
    assert.deepStrictEqual(
      {
        name: containmentError.name,
        message: containmentError.message,
        parent: containmentError.parent,
        child: containmentError.child,
      },
      expectedError,
    );
    assert.strictEqual(configBytes, "unchanged containment\n");
  });
});
