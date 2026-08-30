import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import {
  type BatchedConfigPatch,
  deleteMarketplaceConfigEntryWithCascade,
  deletePluginConfigEntry,
  writeBatchedConfigEntries,
  writeMarketplaceConfigEntry,
  writePluginConfigEntry,
} from "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

const CONFIG_WRITE_BACK_SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts",
);

describe("writeMarketplaceConfigEntry", () => {
  test("patches one marketplace and writes one complete validated document", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-marketplace-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const currentLiteral = {
      schemaVersion: 1,
      futureRoot: "retained root",
      marketplaces: {
        tools: {
          source: "acme/tools",
          autoupdate: false,
          futureMarketplace: "retained entry",
        },
        adjacent: { source: "acme/adjacent", autoupdate: true },
      },
      plugins: {
        "reviewer@tools": { enabled: false },
      },
    } as const;
    const current: ScopeConfig = currentLiteral;
    const patch = { autoupdate: true } as const;
    const expectedBytes = `{
  "schemaVersion": 1,
  "futureRoot": "retained root",
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": true,
      "futureMarketplace": "retained entry"
    },
    "adjacent": {
      "source": "acme/adjacent",
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
    await writeMarketplaceConfigEntry(current, filePath, scopeRoot, "tools", patch);
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });

  test("creates an absent marketplace without removing the plugin map", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-new-market-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      plugins: { "reviewer@other": { enabled: false } },
    } satisfies ScopeConfig;
    const patch = { source: "acme/tools", autoupdate: true } as const;
    const expectedBytes = `{
  "schemaVersion": 1,
  "plugins": {
    "reviewer@other": {
      "enabled": false
    }
  },
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": true
    }
  }
}
`;

    // act
    await writeMarketplaceConfigEntry(current, filePath, scopeRoot, "tools", patch);
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });

  test("rejects an incomplete absent marketplace before creating a file", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-invalid-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = { schemaVersion: 1 } satisfies ScopeConfig;
    let configError: unknown;

    // act
    try {
      await writeMarketplaceConfigEntry(current, filePath, scopeRoot, "tools", {
        autoupdate: true,
      });
    } catch (error) {
      configError = error;
    }

    const readError = await readFile(filePath, "utf8").catch((error: unknown) => error);

    // assert
    assert.ok(configError instanceof Error);
    assert.deepStrictEqual(
      { name: configError.name, message: configError.message },
      {
        name: "Error",
        message:
          "saveConfig refused: in-memory config failed schema validation: /marketplaces/tools: must have required properties source",
      },
    );
    assert.ok(readError instanceof Error);
    assert.ok("code" in readError);
    assert.strictEqual(readError.code, "ENOENT");
  });
});

describe("deleteMarketplaceConfigEntryWithCascade", () => {
  test("deletes a marketplace when the plugin map is absent", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-no-plugins-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      marketplaces: {
        tools: { source: "acme/tools" },
        adjacent: { source: "acme/adjacent", autoupdate: true },
      },
    } satisfies ScopeConfig;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "adjacent": {
      "source": "acme/adjacent",
      "autoupdate": true
    }
  },
  "plugins": {}
}
`;

    // act
    await deleteMarketplaceConfigEntryWithCascade(current, filePath, scopeRoot, "tools");
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });

  test("cascades every matching flat key and preserves adjacent names", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-cascade-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      marketplaces: {
        tools: { source: "acme/tools" },
        other: { source: "acme/other" },
      },
      plugins: {
        "reviewer@tools": { enabled: true },
        "formatter@tools": { enabled: false },
        "reviewer@my-tools": { enabled: true },
        "reviewer@tool": { enabled: false },
        "reviewer@other": { enabled: true },
      },
    } satisfies ScopeConfig;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "other": {
      "source": "acme/other"
    }
  },
  "plugins": {
    "reviewer@my-tools": {
      "enabled": true
    },
    "reviewer@tool": {
      "enabled": false
    },
    "reviewer@other": {
      "enabled": true
    }
  }
}
`;

    // act
    await deleteMarketplaceConfigEntryWithCascade(current, filePath, scopeRoot, "tools");
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });
});

describe("writePluginConfigEntry", () => {
  test("patches one flat plugin key and preserves unrelated entries", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-plugin-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const currentLiteral = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools" } },
      plugins: {
        "reviewer@tools": { enabled: true, futurePlugin: "retained" },
        "formatter@tools": { enabled: false },
      },
    } as const;
    const current: ScopeConfig = currentLiteral;
    const patch = { enabled: false } as const;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools"
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": false,
      "futurePlugin": "retained"
    },
    "formatter@tools": {
      "enabled": false
    }
  }
}
`;

    // act
    await writePluginConfigEntry(current, filePath, scopeRoot, "reviewer", "tools", patch);
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });

  test("creates an absent flat plugin key without removing marketplaces", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-new-plugin-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools" } },
    } satisfies ScopeConfig;
    const patch = { enabled: true } as const;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools"
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": true
    }
  }
}
`;

    // act
    await writePluginConfigEntry(current, filePath, scopeRoot, "reviewer", "tools", patch);
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });
});

describe("deletePluginConfigEntry", () => {
  test("deletes exactly one flat plugin key", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-delete-plugin-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools" } },
      plugins: {
        "reviewer@tools": { enabled: true },
        "formatter@tools": { enabled: false },
        "reviewer@other": { enabled: true },
      },
    } satisfies ScopeConfig;
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools"
    }
  },
  "plugins": {
    "formatter@tools": {
      "enabled": false
    },
    "reviewer@other": {
      "enabled": true
    }
  }
}
`;

    // act
    await deletePluginConfigEntry(current, filePath, scopeRoot, "reviewer", "tools");
    const configBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(configBytes, expectedBytes);
  });
});

describe("writeBatchedConfigEntries", () => {
  test("contains one awaited saveConfig call after both patch loops", async () => {
    // arrange
    const sourceText = await readFile(CONFIG_WRITE_BACK_SOURCE_PATH, "utf8");
    const sourceFile = ts.createSourceFile(
      CONFIG_WRITE_BACK_SOURCE_PATH,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // act
    const batchFunction = sourceFile.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === "writeBatchedConfigEntries",
    );
    const patchLoopEnds: number[] = [];
    const saveCallFacts: Array<{
      readonly awaited: boolean;
      readonly loopDepth: number;
      readonly position: number;
    }> = [];
    const visit = (node: ts.Node, loopDepth: number): void => {
      const isLoop = ts.isForOfStatement(node);
      const childLoopDepth = loopDepth + (isLoop ? 1 : 0);
      if (isLoop) {
        patchLoopEnds.push(node.end);
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "saveConfig"
      ) {
        saveCallFacts.push({
          awaited: ts.isAwaitExpression(node.parent),
          loopDepth: childLoopDepth,
          position: node.getStart(sourceFile),
        });
      }

      ts.forEachChild(node, (child) => {
        visit(child, childLoopDepth);
      });
    };

    if (batchFunction?.body !== undefined) {
      visit(batchFunction.body, 0);
    }

    // assert
    assert.ok(batchFunction?.body !== undefined, "writeBatchedConfigEntries must exist");
    assert.strictEqual(patchLoopEnds.length, 2, "both patch collections must use one loop each");
    assert.deepStrictEqual(
      saveCallFacts.map(({ awaited, loopDepth }) => ({ awaited, loopDepth })),
      [{ awaited: true, loopDepth: 0 }],
    );
    assert.ok(
      saveCallFacts[0]!.position > Math.max(...patchLoopEnds),
      "the single saveConfig call must follow both patch loops",
    );
  });

  test("applies a marketplace-only batch and performs one complete write", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-market-batch-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const currentLiteral = {
      schemaVersion: 1,
      marketplaces: {
        tools: { source: "acme/tools", autoupdate: false, futureMarketplace: 7 },
        adjacent: { source: "acme/adjacent" },
      },
      plugins: { "reviewer@tools": { enabled: true } },
    } as const;
    const current: ScopeConfig = currentLiteral;
    const batch: BatchedConfigPatch = {
      marketplaces: { tools: { autoupdate: true } },
    };
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools",
      "autoupdate": true,
      "futureMarketplace": 7
    },
    "adjacent": {
      "source": "acme/adjacent"
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": true
    }
  }
}
`;

    // act
    await writeBatchedConfigEntries(current, filePath, scopeRoot, batch);
    const configBytes = await readFile(filePath, "utf8");
    const storedFiles = await readdir(scopeRoot);

    // assert
    assert.strictEqual(configBytes, expectedBytes);
    assert.deepStrictEqual(storedFiles, ["claude-plugins.json"]);
  });

  test("applies a plugin-only batch and performs one complete write", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-plugin-batch-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const currentLiteral = {
      schemaVersion: 1,
      marketplaces: { tools: { source: "acme/tools" } },
      plugins: {
        "reviewer@tools": { enabled: true, futurePlugin: "retained" },
        "formatter@tools": { enabled: false },
      },
    } as const;
    const current: ScopeConfig = currentLiteral;
    const batch: BatchedConfigPatch = {
      plugins: { "reviewer@tools": { enabled: false } },
    };
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "tools": {
      "source": "acme/tools"
    }
  },
  "plugins": {
    "reviewer@tools": {
      "enabled": false,
      "futurePlugin": "retained"
    },
    "formatter@tools": {
      "enabled": false
    }
  }
}
`;

    // act
    await writeBatchedConfigEntries(current, filePath, scopeRoot, batch);
    const configBytes = await readFile(filePath, "utf8");
    const storedFiles = await readdir(scopeRoot);

    // assert
    assert.strictEqual(configBytes, expectedBytes);
    assert.deepStrictEqual(storedFiles, ["claude-plugins.json"]);
  });

  test("creates absent marketplace and plugin entries in one complete write", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "config-write-back-new-batch-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true }));
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const current = {
      schemaVersion: 1,
      marketplaces: { adjacent: { source: "acme/adjacent" } },
      plugins: { "formatter@adjacent": { enabled: false } },
    } satisfies ScopeConfig;
    const batch: BatchedConfigPatch = {
      marketplaces: { tools: { source: "acme/tools", autoupdate: true } },
      plugins: { "reviewer@tools": { enabled: true } },
    };
    const expectedBytes = `{
  "schemaVersion": 1,
  "marketplaces": {
    "adjacent": {
      "source": "acme/adjacent"
    },
    "tools": {
      "source": "acme/tools",
      "autoupdate": true
    }
  },
  "plugins": {
    "formatter@adjacent": {
      "enabled": false
    },
    "reviewer@tools": {
      "enabled": true
    }
  }
}
`;

    // act
    await writeBatchedConfigEntries(current, filePath, scopeRoot, batch);
    const configBytes = await readFile(filePath, "utf8");
    const storedFiles = await readdir(scopeRoot);

    // assert
    assert.strictEqual(configBytes, expectedBytes);
    assert.deepStrictEqual(storedFiles, ["claude-plugins.json"]);
  });
});
