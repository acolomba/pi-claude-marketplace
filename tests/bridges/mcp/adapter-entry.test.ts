import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { stampServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts";

import type { McpSubstitutionContext } from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

// pi-mcp-adapter@5.0.0 types.ts:438-525 (ServerEntry), dist.shasum 6c20461d658ec7d7b7e303b067e2ff13a7846d00
// The members in declaration order. Refresh this list from the new floor's
// types.ts whenever package.json moves the pi-mcp-adapter floor.
const SERVER_ENTRY_KEYS = [
  "description",
  "command",
  "args",
  "socket",
  "env",
  "inheritEnv",
  "cwd",
  "url",
  "caFile",
  "headers",
  "requestHeadersCommand",
  "auth",
  "bearerToken",
  "bearerTokenEnv",
  "bearerTokenStore",
  "oauth",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "exposeResources",
  "directTools",
  "toolPrefix",
  "includeTools",
  "excludeTools",
  "searchKeywords",
  "approveTools",
  "debug",
  "trace",
  "httpTransport",
  "pluginDataDir",
  "literalEnv",
  "protocolVersion",
  "tasks",
  "disabled",
] as const;

// AFILE-06: the user's fields a re-stage keeps, written independently of the
// production set.
const CARRIED_KEYS: readonly string[] = [
  "disabled",
  "approveTools",
  "includeTools",
  "excludeTools",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "debug",
  "searchKeywords",
];

const MARKER = { plugin: "acme", marketplace: "catalog" };

const PROJECT_CONTEXT: McpSubstitutionContext = {
  pluginRoot: "/plugin/root",
  pluginData: "/plugin/data",
  projectDir: "/project/root",
};

const INJECTED_ENV = {
  CLAUDE_PLUGIN_ROOT: "/plugin/root",
  CLAUDE_PLUGIN_DATA: "/plugin/data",
  CLAUDE_PROJECT_DIR: "/project/root",
};

/** An entry holding every ServerEntry key at `<prefix>-<key>`, with an object-valued env. */
function fullEntry(prefix: string): Record<string, unknown> {
  return Object.fromEntries(
    SERVER_ENTRY_KEYS.map((key) => [
      key,
      key === "env" ? { [`${prefix.toUpperCase()}_ENV`]: `${prefix}-env` } : `${prefix}-${key}`,
    ]),
  );
}

test("translates the plugin entry and appends the marker when no previous entry exists", () => {
  // arrange
  const servers = {
    local: { command: "${CLAUDE_PLUGIN_ROOT}/bin/server", args: ["${CLAUDE_PROJECT_DIR}"] },
  };

  // act
  const stamping = stampServers({
    servers,
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous: {},
  });

  // assert
  assert.strictEqual(
    JSON.stringify(stamping.stamped),
    JSON.stringify({
      local: {
        command: "/plugin/root/bin/server",
        args: ["/project/root"],
        env: INJECTED_ENV,
        _piClaudeMarketplace: MARKER,
      },
    }),
  );
  assert.deepStrictEqual(stamping.warnings, []);
});

test("AFILE-06: a previous entry holding no carried field adds nothing", () => {
  // arrange
  const previous = { server: { url: "https://old.example/mcp", headers: { token: "old" } } };

  // act
  const stamping = stampServers({
    servers: { server: { url: "https://new.example/mcp" } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous,
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: { url: "https://new.example/mcp", _piClaudeMarketplace: MARKER },
  });
});

test("AFILE-06: the previous disabled and lifecycle override the plugin's values", () => {
  // arrange
  const previous = {
    server: { url: "https://old.example/mcp", disabled: true, lifecycle: "eager" },
  };

  // act
  const stamping = stampServers({
    servers: { server: { url: "https://new.example/mcp", lifecycle: "lazy", disabled: false } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous,
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: {
      url: "https://new.example/mcp",
      lifecycle: "eager",
      disabled: true,
      _piClaudeMarketplace: MARKER,
    },
  });
});

test("AFILE-06: an explicit disabled false is carried like true", () => {
  // arrange
  const previous = { server: { url: "https://old.example/mcp", disabled: false } };

  // act
  const stamping = stampServers({
    servers: { server: { url: "https://new.example/mcp", disabled: true } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous,
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: { url: "https://new.example/mcp", disabled: false, _piClaudeMarketplace: MARKER },
  });
});

test("AFILE-06: a field the previous entry only inherits is not carried", () => {
  // arrange
  const inherited: Record<string, unknown> = Object.create({ disabled: true }) as Record<
    string,
    unknown
  >;

  // act
  const stamping = stampServers({
    servers: { server: { url: "https://new.example/mcp" } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous: { server: inherited },
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: { url: "https://new.example/mcp", _piClaudeMarketplace: MARKER },
  });
});

test("AFILE-06: orders the translated fields, then the carried fields in set order, then the marker", () => {
  // arrange
  const previous = {
    server: { searchKeywords: ["old"], lifecycle: "eager", disabled: true, cwd: "/old" },
  };

  // act
  const stamping = stampServers({
    servers: { server: { url: "https://new.example/mcp", lifecycle: "eager" } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous,
  });

  // assert
  assert.strictEqual(
    JSON.stringify(stamping.stamped),
    JSON.stringify({
      server: {
        url: "https://new.example/mcp",
        lifecycle: "eager",
        disabled: true,
        searchKeywords: ["old"],
        _piClaudeMarketplace: MARKER,
      },
    }),
  );
});

test("reports a non-object entry and a malformed stdio env as ordered warnings", () => {
  // arrange
  const servers = {
    malformedEnv: { command: "node", env: ["invalid"] },
    urlWithScalarEnv: { url: "https://mcp.example.test", env: "opaque" },
    scalar: "invalid",
    nil: null,
  };

  // act
  const stamping = stampServers({
    servers,
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous: {},
  });

  // assert
  assert.deepStrictEqual(stamping.warnings, [
    'mcp server "malformedEnv": declared env is not an object; it was ignored (injected defaults only)',
    'mcp server "scalar": entry is not an object; staged as an empty entry',
    'mcp server "nil": entry is not an object; staged as an empty entry',
  ]);
  assert.deepStrictEqual(stamping.stamped, {
    malformedEnv: { command: "node", env: INJECTED_ENV, _piClaudeMarketplace: MARKER },
    urlWithScalarEnv: {
      url: "https://mcp.example.test",
      env: "opaque",
      _piClaudeMarketplace: MARKER,
    },
    scalar: { _piClaudeMarketplace: MARKER },
    nil: { _piClaudeMarketplace: MARKER },
  });
});

test("omits project substitution and injection when the context has no project dir", () => {
  // arrange
  const substitution: McpSubstitutionContext = {
    pluginRoot: "/plugin/root",
    pluginData: "/plugin/data",
    projectDir: undefined,
  };

  // act
  const stamping = stampServers({
    servers: { server: { command: "${CLAUDE_PROJECT_DIR}/server" } },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution,
    previous: {},
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: {
      command: "${CLAUDE_PROJECT_DIR}/server",
      env: { CLAUDE_PLUGIN_ROOT: "/plugin/root", CLAUDE_PLUGIN_DATA: "/plugin/data" },
      _piClaudeMarketplace: MARKER,
    },
  });
});

test("AFILE-06: of every ServerEntry key, only the carried keys keep their previous values", () => {
  // arrange
  const expectedEntry: Record<string, unknown> = Object.fromEntries(
    SERVER_ENTRY_KEYS.map((key) => [
      key,
      CARRIED_KEYS.includes(key) ? `previous-${key}` : `plugin-${key}`,
    ]),
  );
  expectedEntry.env = { ...INJECTED_ENV, PLUGIN_ENV: "plugin-env" };
  expectedEntry._piClaudeMarketplace = MARKER;

  // act
  const stamping = stampServers({
    servers: { server: fullEntry("plugin") },
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous: { server: fullEntry("previous") },
  });

  // assert
  assert.strictEqual(JSON.stringify(stamping.stamped), JSON.stringify({ server: expectedEntry }));
});

test("AFILE-06: a previous entry's credentials, env and owned fields never reach a command-only entry", () => {
  // arrange
  const servers = { server: { command: "plugin-command" } };

  // act
  const stamping = stampServers({
    servers,
    pluginName: "acme",
    marketplaceName: "catalog",
    substitution: PROJECT_CONTEXT,
    previous: { server: fullEntry("previous") },
  });

  // assert
  assert.deepStrictEqual(stamping.stamped, {
    server: {
      command: "plugin-command",
      env: {
        CLAUDE_PLUGIN_ROOT: "/plugin/root",
        CLAUDE_PLUGIN_DATA: "/plugin/data",
        CLAUDE_PROJECT_DIR: "/project/root",
      },
      disabled: "previous-disabled",
      approveTools: "previous-approveTools",
      includeTools: "previous-includeTools",
      excludeTools: "previous-excludeTools",
      lifecycle: "previous-lifecycle",
      idleTimeout: "previous-idleTimeout",
      requestTimeoutMs: "previous-requestTimeoutMs",
      debug: "previous-debug",
      searchKeywords: "previous-searchKeywords",
      _piClaudeMarketplace: MARKER,
    },
  });
});

test("AFILE-06: the vendored ServerEntry keys match the pi-mcp-adapter floor", async () => {
  // arrange
  const packageJsonPath = new URL("../../../package.json", import.meta.url);

  // act
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    readonly peerDependencies: Readonly<Record<string, string>>;
  };

  // assert
  assert.strictEqual(
    packageJson.peerDependencies["pi-mcp-adapter"],
    ">=5.0.0",
    "the pi-mcp-adapter floor moved: refresh SERVER_ENTRY_KEYS from the new floor's types.ts " +
      "(ServerEntry) and revisit the carried set in adapter-entry.ts",
  );
});
