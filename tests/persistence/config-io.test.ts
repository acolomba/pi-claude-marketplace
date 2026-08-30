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
});
