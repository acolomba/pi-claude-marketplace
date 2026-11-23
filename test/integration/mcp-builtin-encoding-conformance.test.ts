// test/integration/mcp-builtin-encoding-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against Pi's own resolver and validator.
// BLT-02: every `env` and `headers` value the built-in path writes for a
// plugin MCP server comes out of Pi 1.5.0's `resolveConfigValueOrThrow` as
// Claude Code's value. Each `env` and `headers` row of the shared expansion
// table runs through `builtinServerConfig`, with the session environment as
// `runtimeEnv` and the session's working directory as `projectDir` for both
// scopes (P2-DC-03). A written secret value names no variable and is no shell
// command, so Pi reads no environment and runs nothing (PI-1, PI-2). Pi's own
// `validateMcpServerConfig` returns a stdio config, a remote config with
// Claude Code's OAuth fields, and a direct-exposure config with the same JSON,
// so a re-registration does not reconnect (P2-DC-08), and it refuses a url
// that keeps an unset `${NAME}`. No table row reaches the validator.
// D-PG10-12: each `env` and `headers` option row runs through
// `builtinServerConfig` with the option's default filled in, and comes out of
// Pi as Claude Code's value, with no command run and no variable of Pi's
// environment read. Pi resolves no other field, so the unit test of
// `bridges/mcp/builtin-entry.ts` checks that the other rows are written as
// Claude's value. A few env and option values are also in the scenarios of
// `features/mcp-server/`; the table, the PI-1 and PI-2 cases, and the
// validator cases need Pi's own functions.
//
// Pi publishes neither module in its `exports` map, so the test imports both
// by absolute file URL from the repository's devDependency. It changes no
// environment variable.

import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { builtinServerConfig } from "../../extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts";
import { resolveOptions } from "../../extensions/pi-claude-marketplace/domain/user-config.ts";
import {
  builtinRowInput,
  EXPANSION_BUILTINS,
  EXPANSION_CASES,
  OPTION_FIELD_CASES,
  type ExpansionField,
} from "../bridges/mcp/expansion-cases.ts";

import type { McpSubstitutionContext } from "../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

type Environment = Readonly<Record<string, string>>;

/** The part of Pi's `dist/core/resolve-config-value.js` the test drives. */
interface PiConfigValues {
  readonly resolveConfigValueOrThrow: (
    config: string,
    description: string,
    env?: Environment,
  ) => string;
  readonly getConfigValueEnvVarNames: (config: string) => string[];
  readonly isCommandConfigValue: (config: string) => boolean;
}

/** The part of Pi's `dist/core/mcp-servers.js` the test drives. */
interface PiMcpServers {
  readonly validateMcpServerConfig: (name: string, raw: unknown) => unknown;
}

const PI_CORE = new URL(
  "../../node_modules/@earendil-works/pi-coding-agent/dist/core/",
  import.meta.url,
);

async function importPiCore<T>(file: string): Promise<T> {
  return (await import(pathToFileURL(new URL(file, PI_CORE).pathname).href)) as T;
}

const piConfigValues = await importPiCore<PiConfigValues>("resolve-config-value.js");
const piMcpServers = await importPiCore<PiMcpServers>("mcp-servers.js");

const SERVER_NAME = "plugin_demo_stub";

const SERVER_URL = "https://mcp.example.test";

/** The fields whose values Pi resolves when it connects. */
type SecretField = Extract<ExpansionField, "env" | "env-builtin" | "headers">;

/** How one field sits in a Claude server object, and how to read it back from Pi's config. */
interface FieldShape {
  readonly server: (value: string) => Record<string, unknown>;
  readonly written: (config: Readonly<Record<string, unknown>>) => unknown;
}

function member(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

const FIELD_SHAPES: Readonly<Record<SecretField, FieldShape>> = {
  env: {
    server: (value) => ({ command: "server", env: { VALUE: value } }),
    written: (config) => member(config.env, "VALUE"),
  },
  "env-builtin": {
    server: (value) => ({ command: "server", env: { CLAUDE_PLUGIN_ROOT: value } }),
    written: (config) => member(config.env, "CLAUDE_PLUGIN_ROOT"),
  },
  headers: {
    server: (value) => ({ type: "http", url: SERVER_URL, headers: { Value: value } }),
    written: (config) => member(config.headers, "Value"),
  },
};

function isSecret<T extends { readonly field: ExpansionField }>(
  row: T,
): row is T & { readonly field: SecretField } {
  return Object.hasOwn(FIELD_SHAPES, row.field);
}

// The built-in path registers per session, so `projectDir` is the session's
// working directory at both scopes (P2-DC-03).
function sessionContext(env: Environment): McpSubstitutionContext {
  return { ...EXPANSION_BUILTINS, env, options: undefined };
}

function builtinConfig(server: Record<string, unknown>, env: Environment): Record<string, unknown> {
  const config = builtinServerConfig(server, sessionContext(env), undefined);
  assert.ok(config !== undefined, `no config for ${JSON.stringify(server)}`);
  return { ...config };
}

// Every `${NAME}` and `$NAME` a raw value names, set to a value no case uses.
function sentinelEnvironment(raw: string): Environment {
  const environment: Record<string, string> = {};
  for (const [, name = ""] of raw.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/gu)) {
    environment[name] = `sentinel-${name}`;
  }

  return environment;
}

/** Pi's value for one written secret: resolved under `env`, then under sentinels for `raw`'s names. */
function piResolved(written: string, raw: string, env: Environment): readonly string[] {
  return [
    piConfigValues.resolveConfigValueOrThrow(written, "conformance value", env),
    piConfigValues.resolveConfigValueOrThrow(
      written,
      "conformance value",
      sentinelEnvironment(raw),
    ),
  ];
}

for (const row of EXPANSION_CASES.filter(isSecret)) {
  test(`BLT-02: ${builtinRowInput(row)} comes out of Pi's resolver as Claude Code's value ${JSON.stringify(row.claudeOutput)}`, () => {
    // arrange
    const shape = FIELD_SHAPES[row.field];

    // act
    const written = shape.written(builtinConfig(shape.server(row.raw), row.runtimeEnv));

    // assert
    assert.ok(typeof written === "string", `no written ${row.field}`);
    assert.deepStrictEqual(
      [
        piConfigValues.getConfigValueEnvVarNames(written),
        piConfigValues.isCommandConfigValue(written),
        ...piResolved(written, row.raw, row.runtimeEnv),
      ],
      [[], false, row.claudeOutput, row.claudeOutput],
    );
  });
}

const PI_SYNTAX_CASES: readonly {
  readonly raw: string;
  readonly env: Environment;
  readonly claudeOutput: string;
}[] = [
  { raw: "$HOME", env: { HOME: "/home/user" }, claudeOutput: "$HOME" },
  { raw: "$$", env: {}, claudeOutput: "$$" },
  { raw: "$!", env: {}, claudeOutput: "$!" },
  { raw: "!cmd", env: {}, claudeOutput: "!cmd" },
  { raw: "a$", env: {}, claudeOutput: "a$" },
  { raw: "", env: {}, claudeOutput: "" },
  { raw: "${PI_CM_A}${PI_CM_B}", env: { PI_CM_A: "x", PI_CM_B: "y" }, claudeOutput: "xy" },
];

for (const { raw, env, claudeOutput } of PI_SYNTAX_CASES) {
  test(`PI-1, PI-2: env ${JSON.stringify(raw)} resolves through Pi to Claude's value with no shell and no environment`, () => {
    // arrange
    const shape = FIELD_SHAPES.env;

    // act
    const written = shape.written(builtinConfig(shape.server(raw), env));

    // assert
    assert.ok(typeof written === "string", "no written env value");
    assert.deepStrictEqual(
      [
        piConfigValues.getConfigValueEnvVarNames(written),
        piConfigValues.isCommandConfigValue(written),
        ...piResolved(written, raw, env),
      ],
      [[], false, claudeOutput, claudeOutput],
    );
  });
}

const VALID_SERVERS: readonly {
  readonly title: string;
  readonly server: Record<string, unknown>;
}[] = [
  {
    title: "a stdio config with its timeout in seconds",
    server: { command: "server", args: ["--stdio"], timeout: 2500 },
  },
  {
    title: "a remote config with Claude Code's four OAuth fields",
    server: {
      type: "http",
      url: "http://127.0.0.1:9/mcp",
      headers: { "X-Api-Key": "key" },
      oauth: {
        clientId: "client",
        callbackPort: 8765,
        authServerMetadataUrl: "https://127.0.0.1:9/.well-known/oauth-authorization-server",
        scopes: "read write",
      },
    },
  },
  {
    title: "a direct-exposure config",
    server: { command: "server", alwaysLoad: true },
  },
];

for (const { title, server } of VALID_SERVERS) {
  test(`BLT-02, P2-DC-08: Pi's validator returns ${title} with the same JSON`, () => {
    // arrange
    const config = builtinConfig(server, {});

    // act
    const validated = piMcpServers.validateMcpServerConfig(SERVER_NAME, config);

    // assert
    assert.ok(typeof validated === "object", `Pi refused the config: ${String(validated)}`);
    assert.strictEqual(JSON.stringify(validated), JSON.stringify(config));
  });
}

test("BLT-02, P2-DC-08: Pi's validator refuses a url that keeps an unset ${NAME}", () => {
  // arrange
  const config = builtinConfig(
    { type: "http", url: "http://127.0.0.1:${PI_CM_UNSET_PORT}/mcp" },
    {},
  );

  // act
  const validated = piMcpServers.validateMcpServerConfig(SERVER_NAME, config);

  // assert
  assert.deepStrictEqual(
    [config.url, validated],
    [
      "http://127.0.0.1:${PI_CM_UNSET_PORT}/mcp",
      `server "${SERVER_NAME}": url must be an http or https URL`,
    ],
  );
});

// D-PG10-12: the option `opt` of one plugin, whose default is `value`.
function optionContext(value: string): McpSubstitutionContext {
  const options = resolveOptions({
    opt: { type: "string", title: "Option", description: "The option.", default: value },
  });
  return { ...EXPANSION_BUILTINS, env: {}, options };
}

function optionWritten(
  row: (typeof OPTION_FIELD_CASES)[number] & { readonly field: SecretField },
): unknown {
  const shape = FIELD_SHAPES[row.field];
  const config = builtinServerConfig(shape.server(row.raw), optionContext(row.value), undefined);
  assert.ok(config !== undefined, `no config for ${row.raw}`);
  return shape.written({ ...config });
}

for (const row of OPTION_FIELD_CASES.filter(isSecret)) {
  test(`D-PG10-12: ${row.title} comes out of Pi's resolver as Claude Code's value`, () => {
    // arrange
    const environment = { HOME: "/leaked" };

    // act
    const written = optionWritten(row);

    // assert
    assert.ok(typeof written === "string", `no written ${row.field}`);
    assert.deepStrictEqual(
      [
        piConfigValues.getConfigValueEnvVarNames(written),
        piConfigValues.isCommandConfigValue(written),
        piConfigValues.resolveConfigValueOrThrow(written, "conformance value", environment),
      ],
      [[], false, row.claudeOutput],
    );
  });
}
