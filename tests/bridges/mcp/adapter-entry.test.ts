import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import {
  inactiveOverrideFields,
  restoredOverride,
  stampServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts";

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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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
      keptOverrides: {},
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

  test("AFILE-06: the marker keeps the server's override as its last member", () => {
    // arrange
    const keptOverride = { disabled: true, env: { STUB_TOKEN: "stub-secret" } };

    // act
    const stamping = stampServers({
      servers: { server: { url: "https://acme.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides: { server: keptOverride },
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      '{"server":{"url":"https://acme.example/mcp","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true,"env":{"STUB_TOKEN":"stub-secret"}}}}}',
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
      },
      previous: {},
      keptOverrides: {},
    });

    // assert
    assert.strictEqual(
      JSON.stringify(stamping.stamped),
      '{"__proto__":{"command":"plugin-command","env":{"CLAUDE_PLUGIN_ROOT":"/plugin/root","CLAUDE_PLUGIN_DATA":"/plugin/data"},"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}',
    );
  });

  test("AFILE-06: a kept value that is not a plain object adds no keptOverride member", () => {
    // arrange
    const keptOverrides = { server: [{ disabled: true }] };

    // act
    const stamping = stampServers({
      servers: { server: { url: "https://acme.example/mcp" } },
      pluginName: "acme",
      marketplaceName: "catalog",
      substitution: PROJECT_CONTEXT,
      previous: {},
      keptOverrides,
    });

    // assert
    assert.deepStrictEqual(stamping.stamped, {
      server: { url: "https://acme.example/mcp", _piClaudeMarketplace: MARKER },
    });
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
      const inactive = inactiveOverrideFields(override);

      // assert
      assert.deepStrictEqual(inactive, fields);
      assert.strictEqual(Object.isFrozen(inactive), true);
    });
  }
});

describe("restoredOverride", () => {
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

  test("AFILE-06: carried fields only the live entry holds follow the kept fields in set order", () => {
    // arrange
    const kept = { env: { STUB_TOKEN: "stub-secret" } };
    const live = {
      command: "plugin-command",
      lifecycle: "eager",
      disabled: true,
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(
      JSON.stringify(restored),
      '{"env":{"STUB_TOKEN":"stub-secret"},"disabled":true,"lifecycle":"eager"}',
    );
  });

  test("AFILE-05: no field of the live entry outside the carried set reaches the override", () => {
    // arrange
    const kept = { env: { STUB_TOKEN: "stub-secret" } };
    const live = {
      ...fullEntry("live"),
      _piClaudeMarketplace: { ...MARKER, keptOverride: kept },
    };

    // act
    const restored = restoredOverride(kept, live);

    // assert
    assert.strictEqual(
      JSON.stringify(restored),
      '{"env":{"STUB_TOKEN":"stub-secret"},"disabled":"live-disabled","approveTools":"live-approveTools","includeTools":"live-includeTools","excludeTools":"live-excludeTools","lifecycle":"live-lifecycle","idleTimeout":"live-idleTimeout","requestTimeoutMs":"live-requestTimeoutMs","debug":"live-debug","searchKeywords":"live-searchKeywords"}',
    );
  });
});

// pi-mcp-adapter@5.0.0 (dist.shasum 6c20461d658ec7d7b7e303b067e2ff13a7846d00)
// applies nothing under `_piClaudeMarketplace`; re-check each fact when the
// floor moves:
//   - config.ts:1335-1360 `toServerEntries` keeps each entry object verbatim
//     and validates no unknown key.
//   - config.ts:902-962 `mergeServerMaps` and agent-plugin-provenance.ts:27-35
//     merge entries with a shallow spread, so the marker is one opaque value.
//   - Every field consumer names its field (`definition.env`,
//     `definition.bearerToken`, `definition.headers`, `definition.oauth`;
//     metadata-cache.ts:109 `computeServerHash` lists named fields).
//   - config.ts:1715 `writeProjectServerDisabledOverride` and config.ts:1961
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
    ">=5.0.0",
    "the pi-mcp-adapter floor moved: refresh SERVER_ENTRY_KEYS from the new floor's types.ts " +
      "(ServerEntry), revisit the carried set in adapter-entry.ts, " +
      "and re-prove that the adapter applies nothing under _piClaudeMarketplace (keptOverride)",
  );
});
