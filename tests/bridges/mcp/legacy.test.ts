import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  checkMcpAdapterConfig,
  leftoverNames,
  projectDisableStubNames,
  readLegacyMcpNames,
  readLegacyMcpOwners,
  removeLegacyMcpEntries,
  removeProjectDisableStubs,
  withoutServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/legacy.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { McpConfigFileError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { McpConfigDoc } from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts";
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

/** A temporary project tree; returns its root and the project `mcp-adapter.json` path. */
async function createProject(
  t: TestContext,
  prefix: string,
): Promise<{ readonly cwd: string; readonly adapterPath: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
  const adapterPath = locationsFor("project", cwd).mcpAdapterJsonPath;
  await mkdir(path.dirname(adapterPath), { recursive: true });
  return { cwd, adapterPath };
}

/** A commented project file: stubs under `srv`, `b` and `x`, a direct-tools copy under `tool`. */
const PROJECT_STUBS_TEXT = `{
  // project
  "mcpServers": {
    "srv": { "disabled": true },
    "tool": { "command": "t", "directTools": true },
    "b": { "disabled": true },
    "x": { "disabled": true }
  }
}
`;

const ACME_OWNER = { pluginName: "acme", marketplaceName: "mp", names: ["srv", "tool"] } as const;

describe("projectDisableStubNames", () => {
  test("AMIG-01: gives the old names that hold an override stub in the project file", async (t) => {
    // arrange
    const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-names-");
    await writeFile(adapterPath, PROJECT_STUBS_TEXT);

    // act
    const names = await projectDisableStubNames(cwd, ACME_OWNER);

    // assert
    assert.deepStrictEqual(names, ["srv"]);
  });

  for (const { file, write } of [
    { file: "a missing project file", write: async (): Promise<void> => {} },
    {
      file: "a project file that is not a valid MCP config",
      write: async (adapterPath: string): Promise<void> => {
        await writeFile(adapterPath, '{ "mcpServers": \n');
      },
    },
  ]) {
    test(`AMIG-01: ${file} gives no name`, async (t) => {
      // arrange
      const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-names-none-");
      await write(adapterPath);

      // act
      const names = await projectDisableStubNames(cwd, ACME_OWNER);

      // assert
      assert.deepStrictEqual(names, []);
    });
  }

  test("AMIG-01: a project file it cannot read rejects", async (t) => {
    // arrange
    const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-names-dir-");
    await mkdir(adapterPath);

    // act & assert
    await assert.rejects(projectDisableStubNames(cwd, ACME_OWNER), { code: "EISDIR" });
  });
});

describe("removeProjectDisableStubs", () => {
  test("AMIG-01: removes only the owners' old-name stubs and reports them in owner order", async (t) => {
    // arrange
    const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-remove-");
    await writeFile(adapterPath, PROJECT_STUBS_TEXT);

    // act
    const notices = await removeProjectDisableStubs(cwd, [
      ACME_OWNER,
      { pluginName: "beta", marketplaceName: "mp", names: ["b"] },
    ]);

    // assert
    assert.deepStrictEqual(notices, [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "srv",
      },
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "beta",
        server: "b",
      },
    ]);
    assert.strictEqual(
      await readFile(adapterPath, "utf8"),
      '{\n  "mcpServers": {\n    "tool": {\n      "command": "t",\n      "directTools": true\n    },\n    "x": {\n      "disabled": true\n    }\n  }\n}\n',
    );
  });

  test("AMIG-01: an uncommented project file loses its stub with no comments notice", async (t) => {
    // arrange
    const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-plain-");
    await writeFile(adapterPath, '{"mcpServers":{"srv":{"disabled":true}}}\n');

    // act
    const notices = await removeProjectDisableStubs(cwd, [ACME_OWNER]);

    // assert
    assert.deepStrictEqual(notices, [
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "srv",
      },
    ]);
    assert.strictEqual(await readFile(adapterPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
  });

  for (const { file, bytes } of [
    { file: "with no stub under an old name", bytes: '{"mcpServers":{"x":{"disabled":true}}}\n' },
    { file: "that is not a valid MCP config", bytes: '{ "mcpServers": \n' },
  ]) {
    test(`AMIG-01: a project file ${file} is not written and gives no notice`, async (t) => {
      // arrange
      const { cwd, adapterPath } = await createProject(t, "mcp-legacy-stub-keep-");
      await writeFile(adapterPath, bytes);
      const before = await fileIdentity(adapterPath);

      // act
      const notices = await removeProjectDisableStubs(cwd, [ACME_OWNER]);

      // assert
      assert.deepStrictEqual(notices, []);
      assert.deepStrictEqual(await fileIdentity(adapterPath), before);
      assert.strictEqual(await readFile(adapterPath, "utf8"), bytes);
    });
  }
});

describe("checkMcpAdapterConfig", () => {
  test("AMIG-01: a missing mcp-adapter.json passes", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-adapter-missing-");

    // act & assert
    await assert.doesNotReject(checkMcpAdapterConfig(locations.mcpAdapterJsonPath));
  });

  test("AMIG-01: a valid mcp-adapter.json passes and stays byte-identical", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-adapter-valid-");
    const bytes = '{\n  // mine\n  "mcp-servers": { "srv": { "command": "x" } },\n}\n';
    await writeFile(locations.mcpAdapterJsonPath, bytes);

    // act
    await assert.doesNotReject(checkMcpAdapterConfig(locations.mcpAdapterJsonPath));

    // assert
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), bytes);
  });

  for (const { defect, bytes } of [
    { defect: "invalid-jsonc", bytes: "{ broken" },
    { defect: "top-level-not-object", bytes: '["srv"]\n' },
    { defect: "mcpServers-not-object", bytes: '{ "mcpServers": ["srv"] }\n' },
  ] as const) {
    test(`AMIG-01: an mcp-adapter.json with defect ${defect} rejects with McpConfigFileError`, async (t) => {
      // arrange
      const locations = await createScope(t, "mcp-legacy-adapter-invalid-");
      await writeFile(locations.mcpAdapterJsonPath, bytes);

      // act & assert
      await assert.rejects(
        checkMcpAdapterConfig(locations.mcpAdapterJsonPath),
        (error: unknown) => {
          assert.ok(error instanceof McpConfigFileError);
          assert.strictEqual(error.defect, defect);
          assert.strictEqual(error.filePath, locations.mcpAdapterJsonPath);
          return true;
        },
      );
    });
  }
});

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

describe("readLegacyMcpNames", () => {
  test("AMIG-01: lists the plugin's marked keys in file order", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-names-");
    await writeFile(
      locations.mcpJsonPath,
      `{
  "mcpServers": {
    "zeta": { "command": "z", "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" } },
    "mine": { "command": "my-server" },
    "other": { "command": "o", "_piClaudeMarketplace": { "plugin": "other", "marketplace": "mp" } },
    "alpha": { "command": "a", "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" } }
  }
}
`,
    );

    // act
    const names = await readLegacyMcpNames(locations.mcpJsonPath, "hello", "mp");

    // assert
    assert.deepStrictEqual(names, ["zeta", "alpha"]);
  });

  test("AMIG-01: a missing file has no name", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-names-missing-");

    // act
    const names = await readLegacyMcpNames(locations.mcpJsonPath, "hello", "mp");

    // assert
    assert.deepStrictEqual(names, []);
  });

  for (const { shape, bytes } of [
    { shape: "a blank file", bytes: "  \n" },
    { shape: "a non-object top level", bytes: '["srv"]\n' },
    { shape: "an unparseable file", bytes: '{ "mcpServers": { "srv": \n' },
    {
      shape: "a file with only another plugin's entries",
      bytes:
        '{ "mcpServers": { "srv": { "command": "x", "_piClaudeMarketplace": { "plugin": "other", "marketplace": "mp" } } } }\n',
    },
  ]) {
    test(`AMIG-01: ${shape} has no name`, async (t) => {
      // arrange
      const locations = await createScope(t, "mcp-legacy-names-empty-");
      await writeFile(locations.mcpJsonPath, bytes);

      // act
      const names = await readLegacyMcpNames(locations.mcpJsonPath, "hello", "mp");

      // assert
      assert.deepStrictEqual(names, []);
    });
  }

  test("AMIG-01: a read failure other than a config defect propagates", async (t) => {
    // arrange
    const locations = await createScope(t, "mcp-legacy-names-unreadable-");
    await mkdir(locations.mcpJsonPath);

    // act & assert
    await assert.rejects(readLegacyMcpNames(locations.mcpJsonPath, "hello", "mp"), {
      code: "EISDIR",
    });
  });
});

/** An adapter config whose selected map is `mcpServers`, with an optional `mcp-servers` map. */
function adapterConfig(
  servers: Readonly<Record<string, unknown>>,
  dashed?: Readonly<Record<string, unknown>>,
): McpConfigDoc {
  const doc =
    dashed === undefined ? { mcpServers: servers } : { mcpServers: servers, "mcp-servers": dashed };
  return {
    doc,
    serverKey: "mcpServers",
    serverMaps: new Map(Object.entries(doc)) as McpConfigDoc["serverMaps"],
    hadComments: false,
  } satisfies McpConfigDoc;
}

const MARKER = { plugin: "hello", marketplace: "mp" };

describe("leftoverNames", () => {
  test("AMIG-01: a marker-less override stub under an old name is a leftover", () => {
    // arrange
    const config = adapterConfig({ srv: { disabled: true } });

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, ["srv"]);
  });

  for (const directTools of [true, false, ["search"]]) {
    test(`AMIG-01: with panel copies, a marker-less full definition carrying directTools ${JSON.stringify(directTools)} is a leftover`, () => {
      // arrange
      const config = adapterConfig({ srv: { command: "node", args: ["s.js"], directTools } });

      // act
      const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

      // assert
      assert.deepStrictEqual(leftovers, ["srv"]);
    });
  }

  test("AMIG-01: a marker-less full definition without directTools is the user's own server, also with panel copies", () => {
    // arrange
    const config = adapterConfig({ srv: { command: "node", args: ["mine.js"] } });

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: without panel copies a full definition carrying directTools is not a leftover, and a stub still is", () => {
    // arrange
    const config = adapterConfig({
      srv: { url: "https://example.test/mcp", directTools: true },
      tool: { disabled: true },
    });

    // act
    const leftovers = leftoverNames(config, ["srv", "tool"], { newKeys: [], panelCopies: false });

    // assert
    assert.deepStrictEqual(leftovers, ["tool"]);
  });

  for (const { shape, entry } of [
    { shape: "a string", entry: "disabled" },
    { shape: "an array", entry: [{ disabled: true }] },
    { shape: "null", entry: null },
  ]) {
    test(`AMIG-01: ${shape} under an old name is not a leftover`, () => {
      // arrange
      const config = adapterConfig({ srv: entry });

      // act
      const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

      // assert
      assert.deepStrictEqual(leftovers, []);
    });
  }

  test("AMIG-01: an old name that is one of the plugin's new keys is not a leftover", () => {
    // arrange
    const config = adapterConfig({ srv: { disabled: true } });

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: ["srv"], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: a marked entry under an old name is not a leftover", () => {
    // arrange
    const config = adapterConfig({
      srv: { disabled: true, _piClaudeMarketplace: { plugin: "other", marketplace: "mp" } },
      tool: { command: "t", directTools: true, _piClaudeMarketplace: MARKER },
    });

    // act
    const leftovers = leftoverNames(config, ["srv", "tool"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: an entry under a name that is not an old name is not a leftover", () => {
    // arrange
    const config = adapterConfig({ keep: { disabled: true } });

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: an entry in the server map the adapter does not load is not a leftover", () => {
    // arrange
    const config = adapterConfig({}, { srv: { disabled: true } });

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: a file with no server map has no leftover", () => {
    // arrange
    const config = {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const leftovers = leftoverNames(config, ["srv"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, []);
  });

  test("AMIG-01: leftovers come back in the old names' order", () => {
    // arrange
    const config = adapterConfig({ alpha: { disabled: true }, zeta: { disabled: true } });

    // act
    const leftovers = leftoverNames(config, ["zeta", "alpha"], { newKeys: [], panelCopies: true });

    // assert
    assert.deepStrictEqual(leftovers, ["zeta", "alpha"]);
  });

  test("AMIG-01: a __proto__ old name stays an own key", () => {
    // arrange
    const servers = JSON.parse('{ "__proto__": { "disabled": true } }') as Record<string, unknown>;
    const config = adapterConfig(servers);

    // act
    const leftovers = leftoverNames(config, ["__proto__", "constructor"], {
      newKeys: [],
      panelCopies: true,
    });

    // assert
    assert.deepStrictEqual(leftovers, ["__proto__"]);
  });
});

describe("withoutServers", () => {
  test("AMIG-01: removes exactly the named servers from the selected map and keeps every other key in order", () => {
    // arrange
    const doc = {
      imports: ["cursor"],
      mcpServers: { a: { disabled: true }, srv: { disabled: true }, z: { command: "z" } },
      "mcp-servers": { srv: { command: "dashed" } },
      settings: { toolPrefix: "none" },
    };

    // act
    const next = withoutServers(doc, "mcpServers", ["srv"]);

    // assert
    assert.deepStrictEqual(Object.entries(next), [
      ["imports", ["cursor"]],
      ["mcpServers", { a: { disabled: true }, z: { command: "z" } }],
      ["mcp-servers", { srv: { command: "dashed" } }],
      ["settings", { toolPrefix: "none" }],
    ]);
    assert.deepStrictEqual(Object.keys(next.mcpServers as object), ["a", "z"]);
  });

  test("AMIG-01: a non-object server map is copied unchanged", () => {
    // arrange
    const doc = { mcpServers: ["srv"] };

    // act
    const next = withoutServers(doc, "mcpServers", ["srv"]);

    // assert
    assert.deepStrictEqual(next, { mcpServers: ["srv"] });
  });

  test("AMIG-01: __proto__ keys stay own keys in the copy", () => {
    // arrange
    const doc = JSON.parse(
      '{ "__proto__": { "polluted": true }, "mcpServers": { "__proto__": { "disabled": true }, "srv": { "disabled": true } } }',
    ) as Record<string, unknown>;

    // act
    const next = withoutServers(doc, "mcpServers", ["srv"]);

    // assert
    assert.deepStrictEqual(Object.keys(next), ["__proto__", "mcpServers"]);
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(next, "__proto__")?.value, {
      polluted: true,
    });
    const servers = next.mcpServers as Record<string, unknown>;
    assert.deepStrictEqual(Object.keys(servers), ["__proto__"]);
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(servers, "__proto__")?.value, {
      disabled: true,
    });
  });
});
