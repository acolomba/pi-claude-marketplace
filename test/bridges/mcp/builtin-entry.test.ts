import assert from "node:assert/strict";
import { test } from "node:test";

import { builtinServerConfig } from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";

import {
  EXPANSION_BUILTINS,
  EXPANSION_CASES,
  OPTION_FIELD_CASES,
  type ExpansionField,
} from "./expansion-cases.ts";

import type { McpSubstitutionContext } from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

const CONTEXT: McpSubstitutionContext = {
  pluginRoot: "/plugins/a$b",
  pluginData: "/data/mp/a",
  projectDir: "/work/project",
  env: { PI_CM_TOKEN: "t$1", PI_CM_HOST: "mcp.example.test" },
  options: undefined,
};

test("BLT-02: a stdio server gets the plugin variables in its env and deferred exposure", () => {
  // arrange
  const server = {
    command: "${CLAUDE_PLUGIN_ROOT}/server",
    args: ["--project", "${CLAUDE_PROJECT_DIR}"],
    env: { TOKEN: "${PI_CM_TOKEN}" },
  };

  // act
  const config = builtinServerConfig(server, CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "/plugins/a$b/server",
    args: ["--project", "/work/project"],
    env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a", TOKEN: "t$$1" },
    timeout: 1800,
    exposure: "deferred",
  });
});

test("BLT-02: an http server resolves its url and headers and carries the description", () => {
  // arrange
  const server = {
    type: "http",
    url: "https://${PI_CM_HOST}/mcp",
    headers: { Authorization: "Bearer ${PI_CM_TOKEN}" },
    alwaysLoad: true,
  };

  // act
  const config = builtinServerConfig(server, CONTEXT, "Demo plugin");

  // assert
  assert.deepStrictEqual(config, {
    type: "http",
    url: "https://mcp.example.test/mcp",
    headers: { Authorization: "Bearer t$$1" },
    timeout: 300,
    exposure: "direct",
    description: "Demo plugin",
  });
});

for (const { title, server } of [
  { title: "a number", server: 5 },
  { title: "null", server: null },
  { title: "an array", server: [{ command: "node" }] },
  { title: "an object with neither command nor url", server: { type: "http" } },
  { title: "an object whose command is not a string", server: { command: 5 } },
]) {
  test(`BLT-01: ${title} gives no config`, () => {
    // arrange
    const expectedConfig = undefined;

    // act
    const config = builtinServerConfig(server, CONTEXT, undefined);

    // assert
    assert.strictEqual(config, expectedConfig);
  });
}

const HOME_CONTEXT: McpSubstitutionContext = {
  ...CONTEXT,
  env: { PI_CM_TILDE: "~", PI_CM_CONFIG: "~/conf", PI_CM_USER: "~user" },
};

for (const { title, server } of [
  { title: "a command that resolves to ~", server: { command: "${PI_CM_TILDE}" } },
  { title: "an arg that resolves to ~/", server: { command: "node", args: ["${PI_CM_CONFIG}"] } },
  {
    title: "an arg whose empty default leaves a leading ~/",
    server: { command: "node", args: ["--flag", "${PI_CM_UNSET:-}~/a"] },
  },
]) {
  test(`BLT-02: ${title} gives no config, since Pi would expand it to the home directory`, () => {
    // arrange
    const expectedConfig = undefined;

    // act
    const config = builtinServerConfig(server, HOME_CONTEXT, undefined);

    // assert
    assert.strictEqual(config, expectedConfig);
  });
}

test("BLT-02: a ~ that is not leading, or that names a user, is kept as Pi keeps it", () => {
  // arrange
  const server = { command: "node", args: ["a~/b", "${PI_CM_USER}"] };

  // act
  const config = builtinServerConfig(server, HOME_CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "node",
    args: ["a~/b", "~user"],
    env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a" },
    timeout: 1800,
    exposure: "deferred",
  });
});

// D-PG10-20: the full option shape; `token` is required and has no default.
const TOKEN_REQUIRED_CONTEXT: McpSubstitutionContext = {
  ...CONTEXT,
  options: resolveOptions({
    token: { type: "string", title: "Token", description: "The token.", required: true },
  }),
};

test("D-PG10-21: a server that names a plugin option with no value gives no config", () => {
  // arrange
  const server = { command: "node", env: { TOKEN: "${user_config.token}" } };

  // act
  const config = builtinServerConfig(server, TOKEN_REQUIRED_CONTEXT, undefined);

  // assert
  assert.strictEqual(config, undefined);
});

test("D-PG10-21: a server that names no option gives a config under declared options", () => {
  // arrange
  const server = { command: "node" };

  // act
  const config = builtinServerConfig(server, TOKEN_REQUIRED_CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "node",
    env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a" },
    timeout: 1800,
    exposure: "deferred",
  });
});

test("D-PG10-21: a plugin that declares no options keeps an option reference as written", () => {
  // arrange
  const server = { command: "node", env: { TOKEN: "${user_config.token}" } };

  // act
  const config = builtinServerConfig(server, CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "node",
    env: {
      CLAUDE_PLUGIN_ROOT: "/plugins/a$$b",
      CLAUDE_PLUGIN_DATA: "/data/mp/a",
      TOKEN: "$${user_config.token}",
    },
    timeout: 1800,
    exposure: "deferred",
  });
});

// D-PG10-20: the full option shape; `region` is not required and has no default.
const FILLED_CONTEXT: McpSubstitutionContext = {
  ...CONTEXT,
  options: resolveOptions({
    tool: { type: "string", title: "Tool", description: "The tool.", default: "reverse" },
    team: { type: "string", title: "Team", description: "The team.", default: "core" },
    region: { type: "string", title: "Region", description: "The region." },
  }),
};

test("D-PG10-12: a stdio server gets the option's value in its command, args, and env", () => {
  // arrange
  const server = {
    command: "/opt/${user_config.tool}",
    args: ["--tool", "${user_config.tool}"],
    env: { TEAM: "${user_config.team}" },
  };

  // act
  const config = builtinServerConfig(server, FILLED_CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "/opt/reverse",
    args: ["--tool", "reverse"],
    env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a", TEAM: "core" },
    timeout: 1800,
    exposure: "deferred",
  });
});

test("D-PG10-12: a remote server gets the option's value in its url and headers", () => {
  // arrange
  const server = {
    type: "http",
    url: "https://${user_config.tool}.example.test/mcp",
    headers: { "X-Team": "${user_config.team}" },
  };

  // act
  const config = builtinServerConfig(server, FILLED_CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    type: "http",
    url: "https://reverse.example.test/mcp",
    headers: { "X-Team": "core" },
    timeout: 300,
    exposure: "deferred",
  });
});

test("D-PG10-12: an option's value is escaped for Pi in env and headers and kept as written elsewhere", () => {
  // arrange
  const context: McpSubstitutionContext = {
    ...CONTEXT,
    options: resolveOptions({
      run: { type: "string", title: "Run", description: "The run.", default: "!echo $HOME" },
    }),
  };
  const stdio = {
    command: "node",
    args: ["${user_config.run}"],
    env: { RUN: "${user_config.run}" },
  };
  const remote = {
    type: "http",
    url: "https://h.example.test",
    headers: { Run: "${user_config.run}" },
  };

  // act
  const configs = [stdio, remote].map((server) => builtinServerConfig(server, context, undefined));

  // assert
  assert.deepStrictEqual(configs, [
    {
      command: "node",
      args: ["!echo $HOME"],
      env: {
        CLAUDE_PLUGIN_ROOT: "/plugins/a$$b",
        CLAUDE_PLUGIN_DATA: "/data/mp/a",
        RUN: "$!echo $$HOME",
      },
      timeout: 1800,
      exposure: "deferred",
    },
    {
      type: "http",
      url: "https://h.example.test",
      headers: { Run: "$!echo $$HOME" },
      timeout: 300,
      exposure: "deferred",
    },
  ]);
});

test("D-PG10-21: an option that is not required and has no default is the empty string", () => {
  // arrange
  const server = { command: "node", args: ["--region=${user_config.region}"] };

  // act
  const config = builtinServerConfig(server, FILLED_CONTEXT, undefined);

  // assert
  assert.deepStrictEqual(config, {
    command: "node",
    args: ["--region="],
    env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a" },
    timeout: 1800,
    exposure: "deferred",
  });
});

test("D-PG10-12: a command that options resolve to a leading ~/ gives no config, since Pi would expand it", () => {
  // arrange
  const context: McpSubstitutionContext = {
    ...CONTEXT,
    options: resolveOptions({
      empty: { type: "string", title: "Empty", description: "The prefix." },
      tool: { type: "string", title: "Tool", description: "The tool.", default: "~/bin/tool" },
    }),
  };
  const server = { command: "${user_config.empty}${user_config.tool}" };

  // act
  const config = builtinServerConfig(server, context, undefined);

  // assert
  assert.strictEqual(config, undefined);
});

// BLT-02: Pi resolves only `env` and `headers` values when it connects, so
// every other field must hold Claude Code's value as written. The Pi
// conformance test runs the `env` and `headers` rows through Pi's resolver.
type WrittenAsIsField = Exclude<ExpansionField, "env" | "env-builtin" | "headers">;

/** How one field sits in a Claude server object, and how to read it back from the config. */
interface WrittenAsIsShape {
  readonly server: (value: string) => Record<string, unknown>;
  readonly written: (config: Readonly<Record<string, unknown>>) => unknown;
}

const REMOTE_URL = "https://mcp.example.test";

function member(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

const WRITTEN_AS_IS_SHAPES: Readonly<Record<WrittenAsIsField, WrittenAsIsShape>> = {
  command: { server: (value) => ({ command: value }), written: (config) => config.command },
  args: {
    server: (value) => ({ command: "server", args: [value] }),
    written: (config) => member(config.args, "0"),
  },
  url: { server: (value) => ({ type: "http", url: value }), written: (config) => config.url },
  "oauth.clientId": {
    server: (value) => ({ type: "http", url: REMOTE_URL, oauth: { clientId: value } }),
    written: (config) => member(config.oauth, "clientId"),
  },
  "oauth.scope": {
    server: (value) => ({ type: "http", url: REMOTE_URL, oauth: { scopes: value } }),
    written: (config) => member(config.oauth, "scope"),
  },
  "oauth.authServerMetadataUrl": {
    server: (value) => ({ type: "http", url: REMOTE_URL, oauth: { authServerMetadataUrl: value } }),
    written: (config) => member(config.oauth, "authServerMetadataUrl"),
  },
};

function isWrittenAsIs<T extends { readonly field: ExpansionField }>(
  row: T,
): row is T & { readonly field: WrittenAsIsField } {
  return Object.hasOwn(WRITTEN_AS_IS_SHAPES, row.field);
}

function writtenField(
  field: WrittenAsIsField,
  raw: string,
  context: McpSubstitutionContext,
): unknown {
  const shape = WRITTEN_AS_IS_SHAPES[field];
  const config = builtinServerConfig(shape.server(raw), context, undefined);
  assert.ok(config !== undefined, `no config for ${raw}`);
  return shape.written({ ...config });
}

// The built-in path registers per session, so `projectDir` is the session's
// working directory at both scopes (P2-DC-03).
for (const row of EXPANSION_CASES.filter(isWrittenAsIs)) {
  test(`BLT-02: ${row.title} is written as Claude Code's value`, () => {
    // arrange
    const context: McpSubstitutionContext = {
      ...EXPANSION_BUILTINS,
      env: row.runtimeEnv,
      options: undefined,
    };

    // act
    const written = writtenField(row.field, row.raw, context);

    // assert
    assert.strictEqual(written, row.claudeOutput);
  });
}

// D-PG10-12: the option `opt` of one plugin, whose default is the row's value.
for (const row of OPTION_FIELD_CASES.filter(isWrittenAsIs)) {
  test(`D-PG10-12: ${row.title} is written as Claude Code's value`, () => {
    // arrange
    const context: McpSubstitutionContext = {
      ...EXPANSION_BUILTINS,
      env: {},
      options: resolveOptions({
        opt: { type: "string", title: "Option", description: "The option.", default: row.value },
      }),
    };

    // act
    const written = writtenField(row.field, row.raw, context);

    // assert
    assert.strictEqual(written, row.claudeOutput);
  });
}
