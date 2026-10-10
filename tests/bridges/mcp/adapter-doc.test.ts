import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import stripJsonComments from "strip-json-comments";

import {
  ADAPTER_SERVER_KEYS,
  isFullDefinition,
  partitionServers,
  readMcpConfigDoc,
  restoredOverrideNames,
  storedChoicesFor,
  withPluginServers,
  withPluginServersKeepingChoices,
  type McpConfigDoc,
  type McpServerKey,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts";
import { McpConfigFileError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

async function createConfigFile(t: TestContext, text: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "mcp-adapter-doc-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "mcp-adapter.json");
  await writeFile(filePath, text, "utf8");
  return filePath;
}

function adapterGrammar(text: string): unknown {
  const body = text.startsWith("﻿") ? text.slice(1) : text;
  return JSON.parse(stripJsonComments(body, { trailingCommas: true })) as unknown;
}

const ACME_MARKER = { plugin: "acme", marketplace: "catalog" };
const OTHER_MARKER = { plugin: "other", marketplace: "catalog" };

/** A config whose server maps are the document's `mcpServers` and `mcp-servers` objects. */
function configOf(doc: Record<string, unknown>): McpConfigDoc {
  const serverMaps = new Map<McpServerKey, Readonly<Record<string, unknown>>>();
  for (const key of ADAPTER_SERVER_KEYS) {
    const servers = doc[key];
    if (servers !== undefined) {
      serverMaps.set(key, servers as Readonly<Record<string, unknown>>);
    }
  }

  return {
    doc,
    serverKey: [...serverMaps.keys()][0] ?? "mcpServers",
    serverMaps,
    hadComments: false,
  };
}

describe("readMcpConfigDoc", () => {
  for (const { description, text, expectedConfig } of [
    {
      description: "a BOM, a line comment and trailing commas",
      text: '﻿// user config\n{"mcpServers":{"a":{"command":"x"},},}\n',
      expectedConfig: {
        doc: { mcpServers: { a: { command: "x" } } },
        serverKey: "mcpServers",
        serverMaps: new Map([["mcpServers", { a: { command: "x" } }]]),
        hadComments: true,
      },
    },
    {
      description: "a block comment",
      text: '{/* note */"settings":{"toolPrefix":"short"}}',
      expectedConfig: {
        doc: { settings: { toolPrefix: "short" } },
        serverKey: "mcpServers",
        serverMaps: new Map(),
        hadComments: true,
      },
    },
    {
      description: "trailing commas in an object and an array",
      text: '{"imports":["a","b",],"mcpServers":{},}',
      expectedConfig: {
        doc: { imports: ["a", "b"], mcpServers: {} },
        serverKey: "mcpServers",
        serverMaps: new Map([["mcpServers", {}]]),
        hadComments: false,
      },
    },
    {
      description: "a CRLF-terminated line comment",
      text: '{\r\n// note\r\n"mcp-servers":{"a":{"url":"https://a.test"}}\r\n}\r\n',
      expectedConfig: {
        doc: { "mcp-servers": { a: { url: "https://a.test" } } },
        serverKey: "mcp-servers",
        serverMaps: new Map([["mcp-servers", { a: { url: "https://a.test" } }]]),
        hadComments: true,
      },
    },
    {
      description: "comment tokens inside a string value",
      text: '{"mcpServers":{"a":{"url":"http://x/*y*/","args":["//z"]}}}',
      expectedConfig: {
        doc: { mcpServers: { a: { url: "http://x/*y*/", args: ["//z"] } } },
        serverKey: "mcpServers",
        serverMaps: new Map([["mcpServers", { a: { url: "http://x/*y*/", args: ["//z"] } }]]),
        hadComments: false,
      },
    },
    {
      description: "escaped quotes before a comment-like token",
      text: '{"settings":{"note":"say \\"hi\\" // not a comment"}}',
      expectedConfig: {
        doc: { settings: { note: 'say "hi" // not a comment' } },
        serverKey: "mcpServers",
        serverMaps: new Map(),
        hadComments: false,
      },
    },
    {
      description: "a comma followed by a comment before the closing brace",
      text: '{"mcpServers":{"a":{"command":"x"}, // last\n}}',
      expectedConfig: {
        doc: { mcpServers: { a: { command: "x" } } },
        serverKey: "mcpServers",
        serverMaps: new Map([["mcpServers", { a: { command: "x" } }]]),
        hadComments: true,
      },
    },
  ] as const) {
    test(`AFILE-02: reads ${description} with the adapter grammar`, async (t) => {
      // arrange
      const filePath = await createConfigFile(t, text);

      // act
      const config = await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);

      // assert
      assert.deepStrictEqual(config, expectedConfig);
      assert.deepStrictEqual(adapterGrammar(text), expectedConfig.doc);
    });
  }

  for (const { description, text, hadComments } of [
    { description: "an empty", text: "", hadComments: false },
    { description: "a whitespace-only", text: "  \n\t\r\n", hadComments: false },
    { description: "a BOM-only", text: "﻿", hadComments: false },
    { description: "a comment-only", text: "// only\n/* note */\n", hadComments: true },
  ]) {
    test(`AFILE-02: reads ${description} file as the empty document`, async (t) => {
      // arrange
      const filePath = await createConfigFile(t, text);

      // act
      const config = await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);

      // assert
      assert.deepStrictEqual(config, {
        doc: {},
        serverKey: "mcpServers",
        serverMaps: new Map(),
        hadComments,
      });
    });
  }

  for (const { description, text, defect } of [
    {
      description: "an unterminated block comment",
      text: '{"mcpServers":{}} /* open',
      defect: "invalid-jsonc",
    },
    { description: "a top-level array", text: "[]", defect: "top-level-not-object" },
    { description: "a top-level string", text: '"text"', defect: "top-level-not-object" },
    { description: "a top-level null", text: "null", defect: "top-level-not-object" },
    {
      description: "a non-object mcpServers",
      text: '{"mcpServers": []}',
      defect: "mcpServers-not-object",
    },
    {
      description: "a non-object mcp-servers",
      text: '{"mcp-servers": "x"}',
      defect: "mcp-servers-not-object",
    },
  ] as const) {
    test(`AFILE-02: refuses ${description}`, async (t) => {
      // arrange
      const filePath = await createConfigFile(t, text);

      // act & assert
      await assert.rejects(
        () => readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS),
        (error: unknown) => {
          assert.ok(error instanceof McpConfigFileError);
          assert.deepStrictEqual(
            { filePath: error.filePath, defect: error.defect, cause: error.cause },
            { filePath, defect, cause: undefined },
          );
          return true;
        },
      );
    });
  }

  test("AFILE-02: refuses invalid JSONC without quoting the file content", async (t) => {
    // arrange
    const filePath = await createConfigFile(t, '{"a": sk-secret-abc}');

    // act & assert
    await assert.rejects(
      () => readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS),
      (error: unknown) => {
        assert.ok(error instanceof McpConfigFileError);
        assert.deepStrictEqual(
          {
            message: error.message,
            filePath: error.filePath,
            defect: error.defect,
            cause: error.cause,
          },
          {
            message: `MCP config ${filePath} is not valid JSONC; it was left unchanged.`,
            filePath,
            defect: "invalid-jsonc",
            cause: undefined,
          },
        );
        assert.strictEqual(error.message.includes("sk-secret-abc"), false);
        return true;
      },
    );
  });

  for (const { description, text, serverKey, serverMaps } of [
    {
      description: "mcpServers when both keys are present",
      text: '{"mcp-servers":{"b":{"command":"b"}},"mcpServers":{"a":{"command":"a"}}}',
      serverKey: "mcpServers",
      serverMaps: new Map([
        ["mcpServers", { a: { command: "a" } }],
        ["mcp-servers", { b: { command: "b" } }],
      ]),
    },
    {
      description: "mcpServers when only mcpServers is present",
      text: '{"mcpServers":{"a":{"command":"a"}}}',
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", { a: { command: "a" } }]]),
    },
    {
      description: "mcp-servers when only mcp-servers is present",
      text: '{"mcp-servers":{"b":{"command":"b"}}}',
      serverKey: "mcp-servers",
      serverMaps: new Map([["mcp-servers", { b: { command: "b" } }]]),
    },
    {
      description: "mcpServers when neither key is present",
      text: '{"settings":{}}',
      serverKey: "mcpServers",
      serverMaps: new Map(),
    },
  ] as const) {
    test(`AFILE-03: selects ${description}`, async (t) => {
      // arrange
      const filePath = await createConfigFile(t, text);

      // act
      const config = await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);

      // assert
      assert.deepStrictEqual(
        { serverKey: config.serverKey, serverMaps: config.serverMaps },
        { serverKey, serverMaps },
      );
    });
  }

  test("checks only the server keys it is given", async (t) => {
    // arrange
    const filePath = await createConfigFile(t, '{"mcp-servers":"x"}');

    // act
    const config = await readMcpConfigDoc(filePath, ["mcpServers"]);

    // assert
    assert.deepStrictEqual(config, {
      doc: { "mcp-servers": "x" },
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    });
  });

  test("reads a missing file as the empty document", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "mcp-adapter-doc-missing-"));
    t.after(() => rm(directory, { recursive: true, force: true }));

    // act
    const config = await readMcpConfigDoc(
      path.join(directory, "mcp-adapter.json"),
      ADAPTER_SERVER_KEYS,
    );

    // assert
    assert.deepStrictEqual(config, {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    });
  });

  test("reads a file under a non-directory parent as the empty document", async (t) => {
    // arrange
    const parent = await createConfigFile(t, "{}");

    // act
    const config = await readMcpConfigDoc(
      path.join(parent, "mcp-adapter.json"),
      ADAPTER_SERVER_KEYS,
    );

    // assert
    assert.deepStrictEqual(config, {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    });
  });

  test("propagates any other read failure unchanged", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "mcp-adapter-doc-dir-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "mcp-adapter.json");
    await mkdir(filePath);

    // act & assert
    await assert.rejects(
      () => readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        const filesystemError = error as NodeJS.ErrnoException;
        assert.deepStrictEqual(
          { code: filesystemError.code, syscall: filesystemError.syscall },
          { code: "EISDIR", syscall: "read" },
        );
        return true;
      },
    );
  });
});

describe("partitionServers", () => {
  test("collects owned entries from both keys and foreign entries from the selected key", () => {
    // arrange
    const config = {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map([
        [
          "mcpServers",
          {
            mine: { command: "mine" },
            shared: { command: "selected", _piClaudeMarketplace: ACME_MARKER },
            other: { command: "other", _piClaudeMarketplace: OTHER_MARKER },
          },
        ],
        [
          "mcp-servers",
          {
            legacy: { command: "legacy" },
            shared: { command: "stale", _piClaudeMarketplace: ACME_MARKER },
            old: { command: "old", _piClaudeMarketplace: ACME_MARKER },
          },
        ],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const partition = partitionServers(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(partition, {
      ours: {
        shared: { command: "selected", _piClaudeMarketplace: ACME_MARKER },
        old: { command: "old", _piClaudeMarketplace: ACME_MARKER },
      },
      overlays: {},
      theirs: {
        mine: { command: "mine" },
        other: { command: "other", _piClaudeMarketplace: OTHER_MARKER },
      },
      keptOverrides: {},
    });
    assert.deepStrictEqual(Object.keys(partition.ours), ["shared", "old"]);
  });

  test("keeps a server named __proto__ as an own entry on both sides", () => {
    // arrange
    const config = {
      doc: {},
      serverKey: "mcp-servers",
      serverMaps: new Map([
        [
          "mcpServers",
          JSON.parse(
            '{"__proto__":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
          ) as Record<string, unknown>,
        ],
        [
          "mcp-servers",
          JSON.parse('{"__proto__":{"command":"foreign"}}') as Record<string, unknown>,
        ],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const partition = partitionServers(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(partition, {
      ours: JSON.parse(
        '{"__proto__":{"command":"owned","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
      ) as unknown,
      overlays: {},
      theirs: JSON.parse('{"__proto__":{"command":"foreign"}}') as unknown,
      keptOverrides: {},
    });
  });

  test("returns empty maps for a config with no server key", () => {
    // arrange
    const config = {
      doc: { settings: {} },
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const partition = partitionServers(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(partition, { ours: {}, overlays: {}, theirs: {}, keptOverrides: {} });
  });

  test("AFILE-05: splits marker-less overrides from full definitions and foreign marked entries", () => {
    // arrange
    const config = {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map([
        [
          "mcpServers",
          {
            stub: { disabled: true },
            user: { url: "https://user.example" },
            otherStub: { disabled: true, _piClaudeMarketplace: OTHER_MARKER },
            scalar: 5,
          },
        ],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const partition = partitionServers(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(partition, {
      ours: {},
      overlays: { stub: { disabled: true } },
      theirs: {
        user: { url: "https://user.example" },
        otherStub: { disabled: true, _piClaudeMarketplace: OTHER_MARKER },
        scalar: 5,
      },
      keptOverrides: {},
    });
  });
});

describe("isFullDefinition", () => {
  for (const { label, entry, isFull } of [
    { label: "a string command", entry: { command: "node" }, isFull: true },
    { label: "a string url", entry: { url: "https://mcp.example" }, isFull: true },
    { label: "a string socket", entry: { socket: "/run/mcp.sock" }, isFull: true },
    {
      label: "a non-string transport",
      entry: { command: ["node"], url: 1, socket: null },
      isFull: false,
    },
    { label: "an override with no transport", entry: { disabled: true }, isFull: false },
    { label: "an array", entry: [{ command: "node" }], isFull: false },
    { label: "null", entry: null, isFull: false },
    { label: "a primitive", entry: "node", isFull: false },
  ]) {
    test(`AFILE-05: reports ${label} as ${isFull ? "a full definition" : "no full definition"}`, () => {
      // arrange
      const expectedIsFull = isFull;

      // act
      const reportedIsFull = isFullDefinition(entry);

      // assert
      assert.strictEqual(reportedIsFull, expectedIsFull);
    });
  }

  test("AFILE-06: lists the override kept by the plugin's entries under the selected key only", () => {
    // arrange
    const kept = { disabled: true, env: { TOKEN: "stub-secret" } };
    const selected = {
      server: { command: "server", _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: kept } },
      plain: { command: "plain", _piClaudeMarketplace: ACME_MARKER },
      full: {
        command: "full",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { command: "user" } },
      },
      nested: {
        command: "nested",
        _piClaudeMarketplace: {
          ...ACME_MARKER,
          keptOverride: { disabled: true, _piClaudeMarketplace: OTHER_MARKER },
        },
      },
      listed: {
        command: "listed",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: [{ disabled: true }] },
      },
      foreign: {
        command: "foreign",
        _piClaudeMarketplace: { ...OTHER_MARKER, keptOverride: { disabled: true } },
      },
    };
    const legacy = {
      old: {
        command: "old",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
      },
    };
    const config = {
      doc: { mcpServers: selected, "mcp-servers": legacy },
      serverKey: "mcpServers",
      serverMaps: new Map<McpServerKey, Readonly<Record<string, unknown>>>([
        ["mcpServers", selected],
        ["mcp-servers", legacy],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const partition = partitionServers(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(partition.keptOverrides, {
      server: { disabled: true, env: { TOKEN: "stub-secret" } },
    });
  });
});

describe("withPluginServers", () => {
  test("appends entries after the kept entries and keeps every top-level key in place", () => {
    // arrange
    const config = {
      doc: {
        settings: { toolPrefix: "short" },
        mcpServers: {
          old: { command: "old", _piClaudeMarketplace: ACME_MARKER },
          mine: { command: "mine" },
        },
        custom: 1,
      },
      serverKey: "mcpServers",
      serverMaps: new Map([
        [
          "mcpServers",
          {
            old: { command: "old", _piClaudeMarketplace: ACME_MARKER },
            mine: { command: "mine" },
          },
        ],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {
      second: { command: "second" },
      first: { command: "first" },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"settings":{"toolPrefix":"short"},"mcpServers":{"mine":{"command":"mine"},"second":{"command":"second"},"first":{"command":"first"}},"custom":1}',
    );
  });

  test("AFILE-03: writes under mcp-servers when only that key is present", () => {
    // arrange
    const config = {
      doc: { "mcp-servers": { mine: { command: "mine" } } },
      serverKey: "mcp-servers",
      serverMaps: new Map([["mcp-servers", { mine: { command: "mine" } }]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", { server: { command: "server" } });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcp-servers":{"mine":{"command":"mine"},"server":{"command":"server"}}}',
    );
  });

  test("AFILE-03: drops owned entries from the other key and writes under the selected key", () => {
    // arrange
    const legacy = {
      legacy: { command: "legacy" },
      server: { command: "stale", _piClaudeMarketplace: ACME_MARKER },
    };
    const config = {
      doc: { "mcp-servers": legacy, mcpServers: { mine: { command: "mine" } } },
      serverKey: "mcpServers",
      serverMaps: new Map<McpServerKey, Readonly<Record<string, unknown>>>([
        ["mcpServers", { mine: { command: "mine" } }],
        ["mcp-servers", legacy],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", { server: { command: "server" } });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcp-servers":{"legacy":{"command":"legacy"}},"mcpServers":{"mine":{"command":"mine"},"server":{"command":"server"}}}',
    );
  });

  test("adds no server map when the key is absent and there is nothing to write", () => {
    // arrange
    const config = {
      doc: { settings: {} },
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(JSON.stringify(next), '{"settings":{}}');
  });

  test("adds the selected key last when it is absent and entries are staged", () => {
    // arrange
    const config = {
      doc: { settings: {} },
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", { server: { command: "server" } });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"settings":{},"mcpServers":{"server":{"command":"server"}}}',
    );
  });

  test("AFILE-05: replaces an overlay under a staged name and appends the entry after the kept entries", () => {
    // arrange
    const servers = {
      server: { disabled: true },
      mine: { command: "mine" },
    };
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", { server: { command: "server" } });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"mine":{"command":"mine"},"server":{"command":"server"}}}',
    );
  });

  test("keeps an overlay under a staged name in the key the adapter does not load", () => {
    // arrange
    const legacy = { server: { disabled: true } };
    const config = {
      doc: { mcpServers: {}, "mcp-servers": legacy },
      serverKey: "mcpServers",
      serverMaps: new Map<McpServerKey, Readonly<Record<string, unknown>>>([
        ["mcpServers", {}],
        ["mcp-servers", legacy],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", { server: { command: "server" } });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"server":{"command":"server"}},"mcp-servers":{"server":{"disabled":true}}}',
    );
  });

  test("writes a staged server named __proto__ as an own entry", () => {
    // arrange
    const config = {
      doc: {},
      serverKey: "mcpServers",
      serverMaps: new Map(),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(
      config,
      "acme",
      "catalog",
      JSON.parse('{"__proto__":{"command":"server"}}') as Record<string, unknown>,
    );

    // assert
    assert.strictEqual(JSON.stringify(next), '{"mcpServers":{"__proto__":{"command":"server"}}}');
  });
  test("AFILE-01: an unstage writes each kept override back in its entry's position and removes the rest", () => {
    // arrange
    const servers = {
      first: { command: "first" },
      kept: {
        command: "kept",
        disabled: true,
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
      },
      plain: { command: "plain", _piClaudeMarketplace: ACME_MARKER },
      invalid: {
        command: "invalid",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { url: "https://user.example" } },
      },
      last: { command: "last" },
    };
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"first":{"command":"first"},"kept":{"disabled":true},"last":{"command":"last"}}}',
    );
  });

  test("AFILE-06: a restage drops a restaged entry and writes back the override of each entry not restaged in its map", () => {
    // arrange
    const selected = {
      server: {
        command: "old-server",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
      },
      gone: {
        command: "gone",
        debug: true,
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { debug: true } },
      },
    };
    const legacy = {
      moved: {
        command: "moved",
        lifecycle: "eager",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { lifecycle: "eager" } },
      },
    };
    const config = {
      doc: { mcpServers: selected, "mcp-servers": legacy },
      serverKey: "mcpServers",
      serverMaps: new Map<McpServerKey, Readonly<Record<string, unknown>>>([
        ["mcpServers", selected],
        ["mcp-servers", legacy],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {
      server: { command: "server" },
      moved: { command: "moved-new" },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"gone":{"debug":true},"server":{"command":"server"},"moved":{"command":"moved-new"}},"mcp-servers":{"moved":{"lifecycle":"eager"}}}',
    );
  });

  test("WR-01: writes back the kept override of a server named __proto__ as an own entry", () => {
    // arrange
    const servers = JSON.parse(
      '{"__proto__":{"command":"owned","disabled":true,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true}}}}',
    ) as Record<string, unknown>;
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(JSON.stringify(next), '{"mcpServers":{"__proto__":{"disabled":true}}}');
  });

  test("AFILE-06: an unstage removes an entry whose kept override the user's later enable emptied", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        srv: {
          command: "srv",
          _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
        },
        mine: { command: "mine" },
      },
    });

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.deepStrictEqual(next, { mcpServers: { mine: { command: "mine" } } });
  });

  test("AFILE-06: an unstage writes a kept empty stub back as an empty stub", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        srv: { command: "srv", _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: {} } },
      },
    });

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.deepStrictEqual(next, { mcpServers: { srv: {} } });
  });

  test("AFILE-06: a written-back override takes each carried field from the live entry and keeps every other field", () => {
    // arrange
    const servers = {
      enabled: {
        command: "enabled",
        env: { CLAUDE_PLUGIN_ROOT: "/plugin/root" },
        disabled: false,
        _piClaudeMarketplace: {
          ...ACME_MARKER,
          keptOverride: { disabled: true, env: { TOKEN: "token-1" } },
        },
      },
      cleared: {
        command: "cleared",
        _piClaudeMarketplace: {
          ...ACME_MARKER,
          keptOverride: { disabled: true, headers: { Authorization: "Bearer user" } },
        },
      },
    };
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"enabled":{"disabled":false,"env":{"TOKEN":"token-1"}},"cleared":{"headers":{"Authorization":"Bearer user"}}}}',
    );
  });

  test("ANAME-07: dropping an entry whose plugin set the timeout writes back the stub's own timeout", () => {
    // arrange
    const servers = {
      plugin_acme_srv_: {
        url: "https://acme.example/mcp",
        requestTimeoutMs: 60000,
        directTools: "search",
        toolPrefix: "mcp",
        disabled: true,
        _piClaudeMarketplace: {
          ...ACME_MARKER,
          pluginSetFields: ["requestTimeoutMs"],
          keptOverride: { requestTimeoutMs: 5000, disabled: true },
        },
      },
    };
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const next = withPluginServers(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{"plugin_acme_srv_":{"requestTimeoutMs":5000,"disabled":true}}}',
    );
  });
});

describe("restoredOverrideNames", () => {
  test("AFILE-06: lists the plugin's entries that keep a restorable override, selected key first, once each", () => {
    // arrange
    const unselected = {
      first: {
        command: "first",
        disabled: true,
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
      },
      shared: {
        command: "shared-old",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { debug: true } },
      },
    };
    const selected = {
      shared: {
        command: "shared",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { env: { TOKEN: "token-1" } } },
      },
      invalid: {
        command: "invalid",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { url: "https://user.example" } },
      },
      plain: { command: "plain", _piClaudeMarketplace: ACME_MARKER },
      foreign: {
        command: "foreign",
        _piClaudeMarketplace: { ...OTHER_MARKER, keptOverride: { disabled: true } },
      },
      user: { disabled: true },
      last: {
        command: "last",
        lifecycle: "eager",
        _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { lifecycle: "eager" } },
      },
    };
    const config = {
      doc: { mcpServers: unselected, "mcp-servers": selected },
      serverKey: "mcp-servers",
      serverMaps: new Map<McpServerKey, Readonly<Record<string, unknown>>>([
        ["mcpServers", unselected],
        ["mcp-servers", selected],
      ]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const names = restoredOverrideNames(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(names, ["shared", "last", "first"]);
    assert.strictEqual(Object.isFrozen(names), true);
  });

  test("AFILE-06: leaves out an entry whose kept override the user's later enable emptied", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        srv: {
          command: "srv",
          _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: { disabled: true } },
        },
        stub: { command: "stub", _piClaudeMarketplace: { ...ACME_MARKER, keptOverride: {} } },
      },
    });

    // act
    const names = restoredOverrideNames(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(names, ["stub"]);
  });

  test("AFILE-06: lists nothing when no entry of the plugin keeps an override", () => {
    // arrange
    const servers = {
      plain: { command: "plain", _piClaudeMarketplace: ACME_MARKER },
      user: { disabled: true },
    };
    const config = {
      doc: { mcpServers: servers },
      serverKey: "mcpServers",
      serverMaps: new Map([["mcpServers", servers]]),
      hadComments: false,
    } satisfies McpConfigDoc;

    // act
    const names = restoredOverrideNames(config, "acme", "catalog");

    // assert
    assert.deepStrictEqual(names, []);
  });
});

describe("storedChoicesFor", () => {
  test("D-08-02: returns the fields of each asked key the store records for the plugin", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        serverChoices: {
          mine: { plugin: "acme", fields: { disabled: true } },
          foreign: { plugin: "other", fields: { approveTools: true } },
          unasked: { plugin: "acme", fields: { trace: true } },
          scalar: "not-a-choice",
          unnamed: { plugin: 7, fields: { disabled: true } },
          fieldless: { plugin: "acme", fields: ["disabled"] },
        },
      },
    });

    // act
    const stored = storedChoicesFor(config, "acme", [
      "mine",
      "foreign",
      "scalar",
      "unnamed",
      "fieldless",
      "missing",
      "toString",
    ]);

    // assert
    assert.deepStrictEqual(stored, { mine: { disabled: true } });
  });

  for (const { description, doc } of [
    { description: "no member", doc: { mcpServers: {} } },
    { description: "a member that is not an object", doc: { _piClaudeMarketplace: null } },
    {
      description: "a serverChoices value that is not an object",
      doc: { _piClaudeMarketplace: { serverChoices: [] } },
    },
  ]) {
    test(`D-08-02: returns nothing for a document with ${description}`, () => {
      // act
      const stored = storedChoicesFor(configOf(doc), "acme", ["mine"]);

      // assert
      assert.deepStrictEqual(stored, {});
    });
  }
});

describe("withPluginServersKeepingChoices", () => {
  test("D-08-02: a leaving entry stores only its user carried fields outside the written-back override", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        srv: {
          command: "plugin-command",
          env: { STUB_TOKEN: "stub-secret" },
          headers: { Authorization: "stub-header" },
          requestTimeoutMs: 60000,
          approveTools: ["live"],
          disabled: true,
          openUi: true,
          _piClaudeMarketplace: {
            ...ACME_MARKER,
            pluginSetFields: ["requestTimeoutMs"],
            keptOverride: { approveTools: ["kept"], env: { STUB_TOKEN: "stub-secret" } },
          },
        },
        mine: { command: "mine" },
      },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      JSON.stringify({
        mcpServers: {
          srv: { approveTools: ["live"], env: { STUB_TOKEN: "stub-secret" } },
          mine: { command: "mine" },
        },
        _piClaudeMarketplace: {
          serverChoices: { srv: { plugin: "acme", fields: { disabled: true, openUi: true } } },
        },
      }),
    );
  });

  test("D-08-02: a leaving entry with no user carried field writes no store", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        srv: {
          command: "plugin-command",
          requestTimeoutMs: 60000,
          _piClaudeMarketplace: { ...ACME_MARKER, pluginSetFields: ["requestTimeoutMs"] },
        },
      },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

    // assert
    assert.deepStrictEqual(next, { mcpServers: {} });
  });

  test("D-08-02: a restaged entry stores nothing and a dropped one stores its choice", () => {
    // arrange
    const config = configOf({
      mcpServers: {
        kept: { command: "kept", disabled: true, _piClaudeMarketplace: ACME_MARKER },
        dropped: { command: "dropped", trace: true, _piClaudeMarketplace: ACME_MARKER },
      },
      "mcp-servers": {
        dropped: { command: "unread", debug: true, _piClaudeMarketplace: ACME_MARKER },
      },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {
      kept: { command: "kept-v2" },
    });

    // assert
    assert.deepStrictEqual(next, {
      mcpServers: { kept: { command: "kept-v2" } },
      "mcp-servers": {},
      _piClaudeMarketplace: {
        serverChoices: { dropped: { plugin: "acme", fields: { trace: true } } },
      },
    });
  });

  test("D-08-02: a capture appends to an existing member in its position and replaces another plugin's entry in place", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        note: "kept",
        serverChoices: {
          srv: { plugin: "other", fields: { approveTools: true } },
          foreign: { plugin: "other", fields: { disabled: true } },
        },
      },
      mcpServers: {
        srv: { command: "srv", disabled: false, _piClaudeMarketplace: ACME_MARKER },
        added: { command: "added", lifecycle: "eager", _piClaudeMarketplace: ACME_MARKER },
      },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      JSON.stringify({
        _piClaudeMarketplace: {
          note: "kept",
          serverChoices: {
            srv: { plugin: "acme", fields: { disabled: false } },
            foreign: { plugin: "other", fields: { disabled: true } },
            added: { plugin: "acme", fields: { lifecycle: "eager" } },
          },
        },
        mcpServers: {},
      }),
    );
  });

  test("D-08-02: a capture under an existing member without serverChoices adds the map last", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: { note: "kept" },
      mcpServers: { srv: { command: "srv", trace: true, _piClaudeMarketplace: ACME_MARKER } },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      JSON.stringify({
        _piClaudeMarketplace: {
          note: "kept",
          serverChoices: { srv: { plugin: "acme", fields: { trace: true } } },
        },
        mcpServers: {},
      }),
    );
  });

  test("WR-01: stores the choice of a server named __proto__ as an own entry", () => {
    // arrange
    const servers = JSON.parse(
      '{"__proto__":{"command":"x","disabled":true,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
    ) as Record<string, unknown>;
    const config = configOf({ mcpServers: servers });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      '{"mcpServers":{},"_piClaudeMarketplace":{"serverChoices":{"__proto__":{"plugin":"acme","fields":{"disabled":true}}}}}',
    );
  });

  test("D-08-02: staging a key consumes only the store entry the plugin recorded", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        serverChoices: {
          mine: { plugin: "acme", fields: { disabled: true } },
          foreign: { plugin: "other", fields: { approveTools: true } },
          later: { plugin: "acme", fields: { trace: true } },
        },
        note: "kept",
      },
      mcpServers: {},
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {
      mine: { command: "mine" },
      foreign: { command: "foreign" },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(next),
      JSON.stringify({
        _piClaudeMarketplace: {
          serverChoices: {
            foreign: { plugin: "other", fields: { approveTools: true } },
            later: { plugin: "acme", fields: { trace: true } },
          },
          note: "kept",
        },
        mcpServers: { mine: { command: "mine" }, foreign: { command: "foreign" } },
      }),
    );
  });

  test("D-08-02: consuming the last choice removes serverChoices and an emptied member", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        serverChoices: { mine: { plugin: "acme", fields: { disabled: true } } },
      },
      mcpServers: {},
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {
      mine: { command: "mine" },
    });

    // assert
    assert.deepStrictEqual(next, { mcpServers: { mine: { command: "mine" } } });
  });

  test("D-08-02: consuming the last choice keeps a member that holds another key", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        note: "kept",
        serverChoices: { mine: { plugin: "acme", fields: { disabled: true } } },
      },
      mcpServers: {},
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {
      mine: { command: "mine" },
    });

    // assert
    assert.deepStrictEqual(next, {
      _piClaudeMarketplace: { note: "kept" },
      mcpServers: { mine: { command: "mine" } },
    });
  });

  test("D-08-02: a document with nothing captured or consumed keeps its member as it is", () => {
    // arrange
    const config = configOf({
      _piClaudeMarketplace: {
        serverChoices: {},
        foreign: { plugin: "other", fields: { disabled: true } },
      },
      mcpServers: { srv: { command: "srv", _piClaudeMarketplace: ACME_MARKER } },
    });

    // act
    const next = withPluginServersKeepingChoices(config, "acme", "catalog", {
      other: { command: "other" },
    });

    // assert
    assert.deepStrictEqual(next, {
      _piClaudeMarketplace: {
        serverChoices: {},
        foreign: { plugin: "other", fields: { disabled: true } },
      },
      mcpServers: { other: { command: "other" } },
    });
  });

  for (const { description, member } of [
    { description: "a member that is not an object", member: ["kept"] },
    {
      description: "a serverChoices value that is not an object",
      member: { serverChoices: "kept" },
    },
  ]) {
    test(`D-08-02: leaves ${description} unchanged and captures nothing`, () => {
      // arrange
      const config = configOf({
        _piClaudeMarketplace: member,
        mcpServers: { srv: { command: "srv", disabled: true, _piClaudeMarketplace: ACME_MARKER } },
      });

      // act
      const next = withPluginServersKeepingChoices(config, "acme", "catalog", {});

      // assert
      assert.deepStrictEqual(next, { _piClaudeMarketplace: member, mcpServers: {} });
    });
  }
});
