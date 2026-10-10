import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import {
  inactiveOverrideFields,
  restoredOverride,
  stampServers,
  userCarriedFields,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts";

import type { McpSubstitutionContext } from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

// pi-mcp-adapter@5.2.0 types.ts:438-527 (ServerEntry), dist.shasum 9950f0b4423371c7a7839d67d7e20cade3debc69
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
  "openUi",
  "debug",
  "trace",
  "httpTransport",
  "pluginDataDir",
  "literalEnv",
  "protocolVersion",
  "tasks",
  "disabled",
] as const;

// pi-mcp-adapter@5.2.0 types.ts:397-422 (OAuthConfig), dist.shasum 9950f0b4423371c7a7839d67d7e20cade3debc69
// The members in declaration order. Refresh this list with SERVER_ENTRY_KEYS.
const OAUTH_CONFIG_KEYS = [
  "grantType",
  "clientId",
  "clientSecret",
  "clientMetadataUrl",
  "scope",
  "authorizationParams",
  "redirectUri",
  "clientName",
  "clientUri",
  "logoUri",
  "authServerMetadataUrl",
  "skipIssuerMetadataValidation",
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
  "openUi",
  "trace",
];

const MARKER = { plugin: "acme", marketplace: "catalog" };

const PROJECT_CONTEXT: McpSubstitutionContext = {
  pluginRoot: "/plugin/root",
  pluginData: "/plugin/data",
  projectDir: "/project/root",
  env: {},
};

// ANAME-01 / ANAME-04: the fields every stamped entry carries by default.
const OWNED = { directTools: "search", toolPrefix: "mcp" };

const INJECTED_ENV = {
  CLAUDE_PLUGIN_ROOT: "/plugin/root",
  CLAUDE_PLUGIN_DATA: "/plugin/data",
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

describe("stampServers", () => {
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
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        local: {
          command: "/plugin/root/bin/server",
          args: ["/project/root"],
          env: INJECTED_ENV,
          ...OWNED,
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
    assert.deepStrictEqual(stamping.warnings, []);
    assert.deepStrictEqual(
      stamping.variableReports,
      new Map([["local", { missing: [], blanked: [] }]]),
    );
  });

  test("AVAR-02: reports each server's unset variables keyed by server in declared order", () => {
    // arrange
    const servers = {
      remote: { type: "http", url: "https://mcp.example.test/${PI_CM_SITE}" },
      local: { command: "server", args: ["${PI_CM_LEVEL}", "${PI_CM_TOKEN}"] },
      scalar: 42,
    };
    const substitution: McpSubstitutionContext = {
      ...PROJECT_CONTEXT,
      env: { PI_CM_TOKEN: "token-value" },
    };

    // act
    const stamping = stampServers({
      servers,
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution,
      previous: {},
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(
      [...stamping.variableReports],
      [
        ["remote", { missing: ["PI_CM_SITE"], blanked: [] }],
        ["local", { missing: ["PI_CM_LEVEL"], blanked: [] }],
        ["scalar", { missing: [], blanked: [] }],
      ],
    );
    assert.deepStrictEqual(stamping.stamped, {
      remote: {
        url: "https://mcp.example.test/${PI_CM_SITE}",
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
      local: {
        command: "server",
        args: ["${PI_CM_LEVEL}", "${PI_CM_TOKEN}"],
        env: INJECTED_ENV,
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
      scalar: { ...OWNED, _piClaudeMarketplace: MARKER },
    });
  });

  test("AFILE-06: a previous entry holding no carried field adds nothing", () => {
    // arrange
    const previous = { server: { url: "https://old.example/mcp", headers: { token: "old" } } };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: { url: "https://new.example/mcp", ...OWNED, _piClaudeMarketplace: MARKER },
    });
  });

  test("AFILE-06: the previous disabled and lifecycle carry onto the new entry", () => {
    // arrange
    const previous = {
      server: { url: "https://old.example/mcp", disabled: true, lifecycle: "eager" },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: {
        url: "https://new.example/mcp",
        ...OWNED,
        disabled: true,
        lifecycle: "eager",
        _piClaudeMarketplace: MARKER,
      },
    });
  });

  test("AFILE-06: an explicit disabled false is carried like true", () => {
    // arrange
    const previous = { server: { url: "https://old.example/mcp", disabled: false } };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: {
        url: "https://new.example/mcp",
        disabled: false,
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
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
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: { server: inherited },
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: { url: "https://new.example/mcp", ...OWNED, _piClaudeMarketplace: MARKER },
    });
  });

  test("AFILE-06: orders the translated fields, then the owned fields, then the carried fields in set order, then the marker, and the plugin's timeout wins", () => {
    // arrange
    const previous = {
      server: {
        searchKeywords: ["old"],
        requestTimeoutMs: 9000,
        lifecycle: "eager",
        disabled: true,
        cwd: "/old",
      },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp", timeout: 5000 } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://new.example/mcp",
          requestTimeoutMs: 5000,
          ...OWNED,
          disabled: true,
          lifecycle: "eager",
          searchKeywords: ["old"],
          _piClaudeMarketplace: { ...MARKER, pluginSetFields: ["requestTimeoutMs"] },
        },
      }),
    );
  });

  test("ANAME-07: the plugin's timeout replaces a carried requestTimeoutMs while disabled carries", () => {
    // arrange
    const previous = {
      server: { url: "https://old.example/mcp", requestTimeoutMs: 5000, disabled: true },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp", timeout: 120000 } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://new.example/mcp",
          requestTimeoutMs: 120000,
          ...OWNED,
          disabled: true,
          _piClaudeMarketplace: { ...MARKER, pluginSetFields: ["requestTimeoutMs"] },
        },
      }),
    );
  });

  test("ANAME-07: a timeout the previous marker lists as plugin-set does not survive a version without one", () => {
    // arrange
    const previous = {
      server: {
        url: "https://old.example/mcp",
        requestTimeoutMs: 120000,
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, pluginSetFields: ["requestTimeoutMs"] },
      },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://new.example/mcp",
          ...OWNED,
          disabled: true,
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
  });

  test("ANAME-07: the kept override's own timeout applies again once the plugin drops its timeout", () => {
    // arrange
    const keptOverride = { requestTimeoutMs: 5000, disabled: true };
    const previous = {
      server: {
        url: "https://old.example/mcp",
        requestTimeoutMs: 120000,
        disabled: true,
        _piClaudeMarketplace: {
          ...MARKER,
          pluginSetFields: ["requestTimeoutMs"],
          keptOverride,
        },
      },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: { server: keptOverride },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://new.example/mcp",
          ...OWNED,
          disabled: true,
          requestTimeoutMs: 5000,
          _piClaudeMarketplace: { ...MARKER, keptOverride },
        },
      }),
    );
  });

  test("ANAME-07: a user requestTimeoutMs no marker lists carries when the plugin sets no timeout", () => {
    // arrange
    const previous = {
      server: {
        url: "https://old.example/mcp",
        requestTimeoutMs: 5000,
        _piClaudeMarketplace: MARKER,
      },
    };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://new.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous,
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://new.example/mcp",
          ...OWNED,
          requestTimeoutMs: 5000,
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
  });

  test("reports a non-object entry and a malformed stdio env as ordered warnings", () => {
    // arrange
    const servers = {
      malformedEnv: { command: "node", env: ["invalid"] },
      urlWithScalarEnv: { type: "http", url: "https://mcp.example.test", env: "opaque" },
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
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.warnings, [
      'mcp server "malformedEnv": declared env is not an object; it was ignored (injected defaults only)',
      'mcp server "scalar": entry is not an object; staged as an empty entry',
      'mcp server "nil": entry is not an object; staged as an empty entry',
    ]);
    assert.deepStrictEqual(stamping.stamped, {
      malformedEnv: {
        command: "node",
        env: INJECTED_ENV,
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
      urlWithScalarEnv: {
        url: "https://mcp.example.test",
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
      scalar: { ...OWNED, _piClaudeMarketplace: MARKER },
      nil: { ...OWNED, _piClaudeMarketplace: MARKER },
    });
  });

  test("omits project substitution and injection when the context has no project dir", () => {
    // arrange
    const substitution: McpSubstitutionContext = {
      pluginRoot: "/plugin/root",
      pluginData: "/plugin/data",
      projectDir: undefined,
      env: {},
    };

    // act
    const stamping = stampServers({
      servers: { server: { command: "${CLAUDE_PROJECT_DIR}/server" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution,
      previous: {},
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: {
        command: "${CLAUDE_PROJECT_DIR}/server",
        env: { CLAUDE_PLUGIN_ROOT: "/plugin/root", CLAUDE_PLUGIN_DATA: "/plugin/data" },
        ...OWNED,
        _piClaudeMarketplace: MARKER,
      },
    });
  });

  test("AFILE-06: of every ServerEntry key, only the carried keys take their previous values and the plugin's adapter-only values are dropped", () => {
    // arrange
    // ANAME-07: the plugin's string `args` is not an array, so the closed
    // table keeps only its `command` and object `env`.
    const expectedEntry = {
      command: "plugin-command",
      env: { ...INJECTED_ENV, PLUGIN_ENV: "plugin-env" },
      ...OWNED,
      ...Object.fromEntries(CARRIED_KEYS.map((key) => [key, `previous-${key}`])),
      _piClaudeMarketplace: MARKER,
    };

    // act
    const stamping = stampServers({
      servers: { server: fullEntry("plugin") },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: { server: fullEntry("previous") },
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(JSON.stringify(stamping.stamped), JSON.stringify({ server: expectedEntry }));
  });

  test("D-08-01: a restage keeps the user's openUi and trace after the other carried fields", () => {
    // arrange
    const previous = {
      command: "old-command",
      trace: false,
      openUi: true,
      disabled: true,
      _piClaudeMarketplace: MARKER,
    };

    // act
    const stamping = stampServers({
      servers: { server: { command: "plugin-command" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: { server: previous },
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      '{"server":{"command":"plugin-command","env":{"CLAUDE_PLUGIN_ROOT":"/plugin/root","CLAUDE_PLUGIN_DATA":"/plugin/data"},"directTools":"search","toolPrefix":"mcp","disabled":true,"openUi":true,"trace":false,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
    );
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
      keptOverrides: {},
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: {
        command: "plugin-command",
        env: {
          CLAUDE_PLUGIN_ROOT: "/plugin/root",
          CLAUDE_PLUGIN_DATA: "/plugin/data",
        },
        ...OWNED,
        disabled: "previous-disabled",
        approveTools: "previous-approveTools",
        includeTools: "previous-includeTools",
        excludeTools: "previous-excludeTools",
        lifecycle: "previous-lifecycle",
        idleTimeout: "previous-idleTimeout",
        requestTimeoutMs: "previous-requestTimeoutMs",
        debug: "previous-debug",
        searchKeywords: "previous-searchKeywords",
        openUi: "previous-openUi",
        trace: "previous-trace",
        _piClaudeMarketplace: MARKER,
      },
    });
  });

  test("AFILE-06: the marker keeps the server's override as its last member", () => {
    // arrange
    const keptOverride = { disabled: true, env: { STUB_TOKEN: "stub-secret" } };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://acme.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides: { server: keptOverride },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      '{"server":{"url":"https://acme.example/mcp","directTools":"search","toolPrefix":"mcp","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true,"env":{"STUB_TOKEN":"stub-secret"}}}}}',
    );
  });

  test("AFILE-06: an absorbed override's credentials stay inside the marker and only carried fields become active", () => {
    // arrange
    const override = {
      disabled: true,
      env: { STUB_TOKEN: "stub-secret" },
      headers: { Authorization: "stub-header" },
      bearerToken: "!echo stub",
      bearerTokenEnv: "STUB_ENV",
      bearerTokenStore: "stub-store",
      oauth: { clientId: "stub-client" },
      auth: "bearer",
      requestHeadersCommand: "stub-headers",
      caFile: "/stub/ca.pem",
    };

    // act
    const stamping = stampServers({
      servers: { server: { command: "plugin-command" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: { server: override },
      keptOverrides: { server: override },
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: {
        command: "plugin-command",
        env: INJECTED_ENV,
        ...OWNED,
        disabled: true,
        _piClaudeMarketplace: {
          plugin: "acme",
          marketplace: "catalog",
          keptOverride: {
            disabled: true,
            env: { STUB_TOKEN: "stub-secret" },
            headers: { Authorization: "stub-header" },
            bearerToken: "!echo stub",
            bearerTokenEnv: "STUB_ENV",
            bearerTokenStore: "stub-store",
            oauth: { clientId: "stub-client" },
            auth: "bearer",
            requestHeadersCommand: "stub-headers",
            caFile: "/stub/ca.pem",
          },
        },
      },
    });
  });

  test("WR-01: a server named __proto__ without an own kept override gets a marker without one", () => {
    // arrange
    const servers = JSON.parse('{"__proto__":{"command":"plugin-command"}}') as Record<
      string,
      unknown
    >;

    // act
    const stamping = stampServers({
      servers,
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: {
        pluginRoot: "/plugin/root",
        pluginData: "/plugin/data",
        projectDir: undefined,
        env: {},
      },
      previous: {},
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      '{"__proto__":{"command":"plugin-command","env":{"CLAUDE_PLUGIN_ROOT":"/plugin/root","CLAUDE_PLUGIN_DATA":"/plugin/data"},"directTools":"search","toolPrefix":"mcp","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
    );
  });

  test("AFILE-06: a kept value that is not a plain object adds no keptOverride member", () => {
    // arrange
    const keptOverrides = { server: [{ disabled: true }] };

    // act
    const stamping = stampServers({
      servers: { server: { type: "http", url: "https://acme.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides,
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: { url: "https://acme.example/mcp", ...OWNED, _piClaudeMarketplace: MARKER },
    });
  });

  test("ANAME-04: alwaysLoad true gets directTools true, and the plugin's directTools and toolPrefix never survive", () => {
    // arrange
    const servers = {
      server: {
        command: "plugin-command",
        alwaysLoad: true,
        directTools: false,
        toolPrefix: "short",
      },
    };

    // act
    const stamping = stampServers({
      servers,
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: { server: { disabled: true, directTools: "user", toolPrefix: "user" } },
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          command: "plugin-command",
          env: INJECTED_ENV,
          directTools: true,
          toolPrefix: "mcp",
          disabled: true,
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
  });

  test("ANAME-01: a command-only entry gets toolPrefix mcp and directTools search", () => {
    // arrange
    const servers = { server: { command: "plugin-command" } };

    // act
    const stamping = stampServers({
      servers,
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          command: "plugin-command",
          env: INJECTED_ENV,
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
  });

  test("ANAME-07: a plugin entry holding every ServerEntry and OAuthConfig key at hostile values keeps only the closed table's fields", () => {
    // arrange
    const hostile = {
      ...Object.fromEntries(SERVER_ENTRY_KEYS.map((key) => [key, `hostile-${key}`])),
      type: "sse",
      url: "https://mcp.example.com/sse",
      headers: { "X-Team": "core" },
      auth: { provider: "anthropic" },
      bearerTokenEnv: "ANTHROPIC_API_KEY",
      approveTools: false,
      requestHeadersCommand: { command: "sign" },
      inheritEnv: true,
      lifecycle: "keep-alive",
      oauth: {
        ...Object.fromEntries(OAUTH_CONFIG_KEYS.map((key) => [key, `hostile-${key}`])),
        clientSecret: "s3cret",
        skipIssuerMetadataValidation: true,
        redirectUri: "https://evil.example/cb",
        clientId: "pi-client",
        callbackPort: 8765,
        authServerMetadataUrl: "https://auth.example/.well-known/oauth-authorization-server",
        scopes: "read write",
      },
    };

    // act
    const stamping = stampServers({
      servers: { server: hostile },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides: {},
      description: "Acme tools",
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: {
          url: "https://mcp.example.com/sse",
          headers: { "X-Team": "core" },
          httpTransport: "sse",
          oauth: {
            clientId: "pi-client",
            redirectUri: "http://localhost:8765/callback",
            authServerMetadataUrl: "https://auth.example/.well-known/oauth-authorization-server",
            scope: "read write",
          },
          description: "Acme tools",
          ...OWNED,
          _piClaudeMarketplace: MARKER,
        },
      }),
    );
  });

  test("ANAME-06: a non-object entry gets the plugin's description with the owned fields", () => {
    // arrange
    const servers = { server: "invalid" };

    // act
    const stamping = stampServers({
      servers,
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides: {},
      description: "Acme tools",
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      JSON.stringify({
        server: { description: "Acme tools", ...OWNED, _piClaudeMarketplace: MARKER },
      }),
    );
  });
});

describe("inactiveOverrideFields", () => {
  for (const { description, override, fields } of [
    {
      description: "an override of carried fields only",
      override: { disabled: true, lifecycle: "eager", debug: false },
      fields: [],
    },
    {
      description: "a mixed override",
      override: {
        env: { STUB_TOKEN: "stub-secret" },
        disabled: true,
        headers: { Authorization: "Bearer stub" },
        includeTools: ["read"],
        bearerToken: "stub-token",
      },
      fields: ["env", "headers", "bearerToken"],
    },
    {
      description: "an override holding the entry-owned directTools and toolPrefix",
      override: { toolPrefix: "user", disabled: true, directTools: true },
      fields: ["toolPrefix", "directTools"],
    },
    { description: "an empty override", override: {}, fields: [] },
  ]) {
    test(`AFILE-06: names the inactive fields of ${description} in key order`, () => {
      // act
      const inactive = inactiveOverrideFields(override, []);

      // assert
      assert.deepStrictEqual(inactive, fields);
      assert.strictEqual(Object.isFrozen(inactive), true);
    });
  }

  for (const { description, pluginSetFields, fields } of [
    {
      description: "with requestTimeoutMs plugin-set",
      pluginSetFields: ["requestTimeoutMs"],
      fields: ["requestTimeoutMs", "env"],
    },
    { description: "with no plugin-set field", pluginSetFields: [], fields: ["env"] },
  ]) {
    test(`ANAME-07: names a plugin-set carried field among the inactive fields ${description}`, () => {
      // arrange
      const override = { requestTimeoutMs: 5000, disabled: true, env: {} };

      // act
      const inactive = inactiveOverrideFields(override, pluginSetFields);

      // assert
      assert.deepStrictEqual(inactive, fields);
    });
  }
});

describe("restoredOverride", () => {
  test("ANAME-07: a carried field the live marker lists as plugin-set comes back with the kept value", () => {
    // arrange
    const kept = { requestTimeoutMs: 5000, disabled: true };
    const live = {
      command: "plugin-command",
      requestTimeoutMs: 60000,
      _piClaudeMarketplace: {
        ...MARKER,
        pluginSetFields: ["requestTimeoutMs"],
        keptOverride: kept,
      },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(JSON.stringify(restored), '{"requestTimeoutMs":5000}');
  });

  test("ANAME-07: a carried field no live marker lists keeps the live-value rule", () => {
    // arrange
    const kept = { requestTimeoutMs: 5000, disabled: true };
    const live = {
      command: "plugin-command",
      requestTimeoutMs: 7000,
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(JSON.stringify(restored), '{"requestTimeoutMs":7000}');
  });

  test("AFILE-06: the live entry's disabled false replaces the kept disabled true in its kept position", () => {
    // arrange
    const kept = { disabled: true, env: { STUB_TOKEN: "stub-secret" } };
    const live = {
      command: "plugin-command",
      env: INJECTED_ENV,
      disabled: false,
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(
      JSON.stringify(restored),
      '{"disabled":false,"env":{"STUB_TOKEN":"stub-secret"}}',
    );
  });

  test("AFILE-06: a kept carried field the live entry lacks is left out", () => {
    // arrange
    const kept = { disabled: true, headers: { Authorization: "Bearer stub" } };
    const live = {
      command: "plugin-command",
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(JSON.stringify(restored), '{"headers":{"Authorization":"Bearer stub"}}');
  });

  test("AFILE-06: a carried field the plugin's live entry declares and the kept override lacks is not added", () => {
    // arrange
    const kept = { disabled: true };
    const live = {
      command: "plugin-command",
      lifecycle: "eager",
      debug: true,
      disabled: true,
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(JSON.stringify(restored), '{"disabled":true}');
  });

  test("AFILE-05: each kept carried field takes the live value and every other field comes from the kept override", () => {
    // arrange
    const kept = {
      env: { STUB_TOKEN: "stub-secret" },
      ...Object.fromEntries(CARRIED_KEYS.map((key) => [key, `kept-${key}`])),
    };
    const live = {
      ...fullEntry("live"),
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(
      JSON.stringify(restored),
      '{"env":{"STUB_TOKEN":"stub-secret"},"disabled":"live-disabled","approveTools":"live-approveTools","includeTools":"live-includeTools","excludeTools":"live-excludeTools","lifecycle":"live-lifecycle","idleTimeout":"live-idleTimeout","requestTimeoutMs":"live-requestTimeoutMs","debug":"live-debug","searchKeywords":"live-searchKeywords","openUi":"live-openUi","trace":"live-trace"}',
    );
  });
});

describe("userCarriedFields", () => {
  test("D-08-02: returns the entry's carried fields in carried-set order and nothing else", () => {
    // arrange
    const entry = {
      trace: true,
      command: "plugin-command",
      env: { STUB_TOKEN: "stub-secret" },
      headers: { Authorization: "stub-header" },
      openUi: true,
      disabled: true,
      directTools: "search",
      _piClaudeMarketplace: MARKER,
    };

    // act
    const fields = userCarriedFields(entry);

    // assert
    assert.strictEqual(JSON.stringify(fields), '{"disabled":true,"openUi":true,"trace":true}');
  });

  test("D-08-02: leaves out the carried fields the entry's marker lists as plugin-set", () => {
    // arrange
    const entry = {
      url: "https://acme.example/mcp",
      requestTimeoutMs: 60000,
      approveTools: ["read"],
      _piClaudeMarketplace: { ...MARKER, pluginSetFields: ["requestTimeoutMs"] },
    };

    // act
    const fields = userCarriedFields(entry);

    // assert
    assert.deepStrictEqual(fields, { approveTools: ["read"] });
  });

  test("D-08-02: a non-object entry holds no carried field", () => {
    // act
    const fields = userCarriedFields("not-an-entry");

    // assert
    assert.deepStrictEqual(fields, {});
  });
});

// pi-mcp-adapter@5.2.0 (dist.shasum 9950f0b4423371c7a7839d67d7e20cade3debc69)
// applies nothing under `_piClaudeMarketplace`; re-check each fact when the
// floor moves:
//   - config.ts:1346-1371 `toServerEntries` keeps each entry object verbatim
//     and validates no unknown key.
//   - config.ts:913-973 `mergeServerMaps` and agent-plugin-provenance.ts:27-35
//     merge entries with a shallow spread, so the marker is one opaque value.
//   - Every field consumer names its field (`definition.env`,
//     `definition.bearerToken`, `definition.headers`, `definition.oauth`;
//     metadata-cache.ts:109 `computeServerHash` lists named fields).
//   - config.ts:1726 `writeProjectServerDisabledOverride` and config.ts:1972
//     `writeDirectToolsConfig` spread the entry, so the marker survives.
//   - project-server-trust.ts:68-79 `hashProjectServerDefinition` hashes the
//     whole entry, marker included: an identity read only.
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
    ">=5.2.0 <6",
    "the pi-mcp-adapter range moved: refresh SERVER_ENTRY_KEYS and OAUTH_CONFIG_KEYS from the " +
      "new floor's types.ts (ServerEntry, OAuthConfig), revisit the carried set in adapter-entry.ts, " +
      "re-prove that the adapter applies nothing under _piClaudeMarketplace (keptOverride), " +
      "and re-prove the variable escape against the new range's interpolation passes",
  );
});
