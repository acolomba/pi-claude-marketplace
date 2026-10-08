import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  readLegacyMcpOwners,
  removeLegacyMcpEntries,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/legacy.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { McpConfigFileError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

async function createScope(t: TestContext, prefix: string): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", cwd);
  await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
  return locations;
}

async function fileIdentity(filePath: string): Promise<readonly bigint[]> {
  const stats = await stat(filePath, { bigint: true });
  return [stats.ino, stats.mtimeNs];
}

describe("readLegacyMcpOwners", () => {
  test("AMIG-01: a missing file has no owner", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-owners-missing-");

    // act
    const owners = await readLegacyMcpOwners(locations.mcpJsonPath);

    // assert
    assert.deepStrictEqual(owners, []);
  });

  for (const { shape, bytes } of [
    { shape: "a blank file", bytes: "  \n" },
    { shape: "a non-object top level", bytes: '["srv"]\n' },
    { shape: "a document with no mcpServers", bytes: '{ "servers": {} }\n' },
  ]) {
    test(`AMIG-01: ${shape} has no owner`, async (t) => {
      // arrange
      const locations = await createScope(t, "mcp-legacy-owners-empty-");
      await writeFile(locations.mcpJsonPath, bytes);

      // act
      const owners = await readLegacyMcpOwners(locations.mcpJsonPath);

      // assert
      assert.deepStrictEqual(owners, []);
    });
  }

  test("AMIG-01: groups marked entries by owner, sorted by marketplace then plugin in code-unit order", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-owners-grouped-");
    await writeFile(
      locations.mcpJsonPath,
      `{
  "mcpServers": {
    "first": { "command": "a", "_piClaudeMarketplace": { "plugin": "acme", "marketplace": "official" } },
    "mine": { "command": "my-server" },
    "zeta-one": { "command": "z", "_piClaudeMarketplace": { "plugin": "tools", "marketplace": "Zeta" } },
    "broken": { "command": "b", "_piClaudeMarketplace": { "plugin": "acme" } },
    "second": { "command": "c", "_piClaudeMarketplace": { "plugin": "acme", "marketplace": "official" } },
    "beta-one": { "command": "d", "_piClaudeMarketplace": { "plugin": "beta", "marketplace": "official" } },
    "Acme-one": { "command": "e", "_piClaudeMarketplace": { "plugin": "Acme", "marketplace": "official" } }
  }
}
`,
    );

    // act
    const owners = await readLegacyMcpOwners(locations.mcpJsonPath);

    // assert
    assert.deepStrictEqual(owners, [
      { plugin: "tools", marketplace: "Zeta", names: ["zeta-one"] },
      { plugin: "Acme", marketplace: "official", names: ["Acme-one"] },
      { plugin: "acme", marketplace: "official", names: ["first", "second"] },
      { plugin: "beta", marketplace: "official", names: ["beta-one"] },
    ]);
  });

  for (const { defect, bytes } of [
    { defect: "invalid-jsonc", bytes: '{ "mcpServers": \n' },
    { defect: "mcpServers-not-object", bytes: '{ "mcpServers": ["srv"] }\n' },
  ] as const) {
    test(`AFILE-02: a file with defect ${defect} rejects with McpConfigFileError`, async (t) => {
      // arrange
      const locations = await createScope(t, "mcp-legacy-owners-invalid-");
      await writeFile(locations.mcpJsonPath, bytes);

      // act & assert
      await assert.rejects(readLegacyMcpOwners(locations.mcpJsonPath), (error: unknown) => {
        assert.ok(error instanceof McpConfigFileError);
        assert.strictEqual(error.defect, defect);
        assert.strictEqual(error.filePath, locations.mcpJsonPath);
        return true;
      });
    });
  }

  test("AMIG-01: a read failure other than a config defect propagates", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-owners-unreadable-");
    await mkdir(locations.mcpJsonPath);

    // act & assert
    await assert.rejects(readLegacyMcpOwners(locations.mcpJsonPath), { code: "EISDIR" });
  });
});

describe("removeLegacyMcpEntries", () => {
  test("AMIG-01: removes only the owner's marked entries and keeps every other key in place", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-remove-owned-");
    await writeFile(
      locations.mcpJsonPath,
      `{
  "version": 2,
  "mcpServers": {
    "srv": { "command": "node", "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" } },
    "__proto__": { "command": "proto-server" },
    "other": { "command": "x", "_piClaudeMarketplace": { "plugin": "other", "marketplace": "mp" } },
    "tools": { "url": "https://example.test", "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" } }
  },
  "settings": { "keep": true }
}
`,
    );
    const expectedBytes = `{
  "version": 2,
  "mcpServers": {
    "__proto__": {
      "command": "proto-server"
    },
    "other": {
      "command": "x",
      "_piClaudeMarketplace": {
        "plugin": "other",
        "marketplace": "mp"
      }
    }
  },
  "settings": {
    "keep": true
  }
}
`;

    // act
    const removed = await removeLegacyMcpEntries({
      locations,
      pluginName: "hello",
      marketplaceName: "mp",
    });

    // assert
    assert.deepStrictEqual(removed, {
      removedNames: ["srv", "tools"],
      notices: [],
      written: [{ path: locations.mcpJsonPath, bytes: Buffer.from(expectedBytes) }],
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), expectedBytes);
  });

  test("AFILE-04: a commented file reports that its comments were dropped", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-remove-comments-");
    await writeFile(
      locations.mcpJsonPath,
      `// written by an older build
{ "mcpServers": { "srv": { "command": "node", "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" } } } }
`,
    );
    const expectedBytes = '{\n  "mcpServers": {}\n}\n';

    // act
    const removed = await removeLegacyMcpEntries({
      locations,
      pluginName: "hello",
      marketplaceName: "mp",
    });

    // assert
    assert.deepStrictEqual(removed, {
      removedNames: ["srv"],
      notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
      written: [{ path: locations.mcpJsonPath, bytes: Buffer.from(expectedBytes) }],
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), expectedBytes);
  });

  for (const { shape, bytes } of [
    {
      shape: "a file with only another owner's entries",
      bytes:
        '{ "mcpServers": { "srv": { "command": "node", "_piClaudeMarketplace": { "plugin": "other", "marketplace": "mp" } } } }\n',
    },
    { shape: "a non-object top level", bytes: '"srv"\n' },
  ]) {
    test(`AMIG-01: ${shape} is not rewritten`, async (t) => {
      // arrange
      const locations = await createScope(t, "mcp-legacy-remove-nothing-");
      await writeFile(locations.mcpJsonPath, bytes);
      const identity = await fileIdentity(locations.mcpJsonPath);

      // act
      const removed = await removeLegacyMcpEntries({
        locations,
        pluginName: "hello",
        marketplaceName: "mp",
      });

      // assert
      assert.deepStrictEqual(removed, { removedNames: [], notices: [], written: [] });
      assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), bytes);
      assert.deepStrictEqual(await fileIdentity(locations.mcpJsonPath), identity);
    });
  }

  test("AMIG-01: a missing file stays missing", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-remove-missing-");

    // act
    const removed = await removeLegacyMcpEntries({
      locations,
      pluginName: "hello",
      marketplaceName: "mp",
    });

    // assert
    assert.deepStrictEqual(removed, { removedNames: [], notices: [], written: [] });
    await assert.rejects(stat(locations.mcpJsonPath), { code: "ENOENT" });
  });

  test("AFILE-02: an unparseable file is left-unchanged and reported", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-remove-unparseable-");
    const bytes = '{ "mcpServers": { "srv": \n';
    await writeFile(locations.mcpJsonPath, bytes);

    // act
    const removed = await removeLegacyMcpEntries({
      locations,
      pluginName: "hello",
      marketplaceName: "mp",
    });

    // assert
    assert.deepStrictEqual(removed, {
      removedNames: [],
      notices: [{ kind: "left-unchanged", scope: "project", file: "mcp.json" }],
      written: [],
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), bytes);
  });

  test("AMIG-01: a read failure other than a config defect propagates", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-remove-unreadable-");
    await mkdir(locations.mcpJsonPath);

    // act & assert
    await assert.rejects(
      removeLegacyMcpEntries({ locations, pluginName: "hello", marketplaceName: "mp" }),
      { code: "EISDIR" },
    );
  });
});
