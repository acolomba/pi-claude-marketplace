import assert from "node:assert/strict";
import { test } from "node:test";

import {
  substituteAndInject,
  type McpSubstitutionContext,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

import { EXPANSION_BUILTINS, EXPANSION_CASES, type ExpansionField } from "./expansion-cases.ts";

interface FieldShape {
  /** The minimal translated entry holding `value` in the field. */
  readonly entry: (value: string) => Record<string, unknown>;
  /** The written entry holding `value` in the field, given the injected env. */
  readonly writtenEntry: (
    value: string,
    injected: Readonly<Record<string, string>>,
  ) => Record<string, unknown>;
}

const SERVER_URL = "https://mcp.example.test";

function remoteShape(entry: (value: string) => Record<string, unknown>): FieldShape {
  return { entry, writtenEntry: (value) => entry(value) };
}

const FIELD_SHAPES: Readonly<Record<ExpansionField, FieldShape>> = {
  command: {
    entry: (value) => ({ command: value }),
    writtenEntry: (value, injected) => ({ command: value, env: injected }),
  },
  args: {
    entry: (value) => ({ command: "server", args: [value] }),
    writtenEntry: (value, injected) => ({ command: "server", args: [value], env: injected }),
  },
  env: {
    entry: (value) => ({ command: "server", env: { VALUE: value } }),
    writtenEntry: (value, injected) => ({ command: "server", env: { ...injected, VALUE: value } }),
  },
  "env-builtin": {
    entry: (value) => ({ command: "server", env: { CLAUDE_PLUGIN_ROOT: value } }),
    writtenEntry: (value, injected) => ({
      command: "server",
      env: { ...injected, CLAUDE_PLUGIN_ROOT: value },
    }),
  },
  url: remoteShape((value) => ({ url: value })),
  headers: remoteShape((value) => ({ url: SERVER_URL, headers: { Value: value } })),
  "oauth.clientId": remoteShape((value) => ({ url: SERVER_URL, oauth: { clientId: value } })),
  "oauth.scope": remoteShape((value) => ({ url: SERVER_URL, oauth: { scope: value } })),
  "oauth.authServerMetadataUrl": remoteShape((value) => ({
    url: SERVER_URL,
    oauth: { authServerMetadataUrl: value },
  })),
};

const SCOPE_BUILTINS = {
  project: EXPANSION_BUILTINS,
  user: { ...EXPANSION_BUILTINS, projectDir: undefined },
} as const;

const INJECTED_ENV = {
  project: {
    CLAUDE_PLUGIN_ROOT: "/plugins/acme",
    CLAUDE_PLUGIN_DATA: "/data/mp/acme",
    CLAUDE_PROJECT_DIR: "/work/project",
  },
  user: { CLAUDE_PLUGIN_ROOT: "/plugins/acme", CLAUDE_PLUGIN_DATA: "/data/mp/acme" },
} as const;

const PROJECT_CONTEXT: McpSubstitutionContext = { ...EXPANSION_BUILTINS, env: {} };

for (const {
  title,
  field,
  scope = "project",
  raw,
  installEnv,
  written,
  missing,
  blanked = [],
} of EXPANSION_CASES) {
  test(title, () => {
    // arrange
    const shape = FIELD_SHAPES[field];
    const context: McpSubstitutionContext = { ...SCOPE_BUILTINS[scope], env: installEnv };

    // act
    const substituted = substituteAndInject(shape.entry(raw), context);

    // assert
    assert.deepStrictEqual(substituted, {
      entry: shape.writtenEntry(written, INJECTED_ENV[scope]),
      report: { missing, blanked },
    });
  });
}

test("AVAR-01: writes oauth.redirectUri, description, keys and non-string values unchanged", () => {
  // arrange
  const translated = {
    url: "https://mcp.example.test/${PI_CM_PATH}",
    headers: { "${PI_CM_KEY}": "plain", Retries: 3 },
    httpTransport: "sse",
    oauth: {
      clientId: "client",
      redirectUri: "http://localhost:8765/callback",
      port: 8765,
    },
    requestTimeoutMs: 90_000,
    description: "${PI_CM_DESCRIPTION} $env:PI_CM_SECRET {env:PI_CM_SECRET}",
    directTools: true,
    toolPrefix: "mcp",
  };
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, env: { PI_CM_PATH: "path" } };

  // act
  const substituted = substituteAndInject(translated, context);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: {
      url: "https://mcp.example.test/${PI_CM_PATH}",
      headers: { "${PI_CM_KEY}": "plain", Retries: 3 },
      httpTransport: "sse",
      oauth: {
        clientId: "client",
        redirectUri: "http://localhost:8765/callback",
        port: 8765,
      },
      requestTimeoutMs: 90_000,
      description: "${PI_CM_DESCRIPTION} $env:PI_CM_SECRET {env:PI_CM_SECRET}",
      directTools: true,
      toolPrefix: "mcp",
    },
    report: { missing: [], blanked: [] },
  });
});

test("AVAR-01: passes field values of an unexpected type through unchanged", () => {
  // arrange
  const remote = {
    command: 7,
    url: 7,
    headers: "header",
    oauth: ["client"],
    env: "env",
    args: "args",
  };
  const stdio = { command: "server", args: ["--level", 2, null], env: { RETRIES: 3 } };

  // act
  const substitutedRemote = substituteAndInject(remote, PROJECT_CONTEXT);
  const substitutedStdio = substituteAndInject(stdio, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(substitutedRemote, {
    entry: {
      command: 7,
      url: 7,
      headers: "header",
      oauth: ["client"],
      env: "env",
      args: "args",
    },
    report: { missing: [], blanked: [] },
  });
  assert.deepStrictEqual(substitutedStdio, {
    entry: {
      command: "server",
      args: ["--level", 2, null],
      env: { ...INJECTED_ENV.project, RETRIES: 3 },
    },
    report: { missing: [], blanked: [] },
  });
});

test("MENV-02: injects the env first and in place, lets declared keys win and keeps field order", () => {
  // arrange
  const translated = {
    command: "server",
    args: ["--flag"],
    env: { TOKEN: "token", CLAUDE_PLUGIN_ROOT: "declared-root" },
    requestTimeoutMs: 5000,
    description: "acme",
    directTools: "search",
    toolPrefix: "mcp",
  };

  // act
  const { entry } = substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(entry, {
    command: "server",
    args: ["--flag"],
    env: {
      CLAUDE_PLUGIN_ROOT: "declared-root",
      CLAUDE_PLUGIN_DATA: "/data/mp/acme",
      CLAUDE_PROJECT_DIR: "/work/project",
      TOKEN: "token",
    },
    requestTimeoutMs: 5000,
    description: "acme",
    directTools: "search",
    toolPrefix: "mcp",
  });
  assert.deepStrictEqual(Object.keys(entry), [
    "command",
    "args",
    "env",
    "requestTimeoutMs",
    "description",
    "directTools",
    "toolPrefix",
  ]);
  assert.deepStrictEqual(Object.keys(entry.env as Record<string, unknown>), [
    "CLAUDE_PLUGIN_ROOT",
    "CLAUDE_PLUGIN_DATA",
    "CLAUDE_PROJECT_DIR",
    "TOKEN",
  ]);
});

test("MENV-02: injects the env into a stdio entry without args", () => {
  // arrange
  const translated = { command: "server", directTools: "search" };

  // act
  const { entry } = substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(Object.keys(entry), ["command", "env", "directTools"]);
});

test("returns a fresh entry and leaves the translated entry unchanged", () => {
  // arrange
  const translated = {
    command: "${CLAUDE_PLUGIN_ROOT}/server",
    args: ["${CLAUDE_PLUGIN_DATA}"],
    env: { MODE: "!fast" },
  };
  const originalTranslated = structuredClone(translated);

  // act
  substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(translated, originalTranslated);
});

test("preserves a literal __proto__ key in env and headers without changing global prototypes", () => {
  // arrange
  const stdio = JSON.parse('{"command":"server","env":{"__proto__":"${PI_CM_V}"}}') as Record<
    string,
    unknown
  >;
  const remote = JSON.parse(
    '{"url":"https://mcp.example.test","headers":{"__proto__":"!x"}}',
  ) as Record<string, unknown>;

  // act
  const substitutedStdio = substituteAndInject(stdio, PROJECT_CONTEXT);
  const substitutedRemote = substituteAndInject(remote, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(Object.entries(substitutedStdio.entry.env as Record<string, unknown>), [
    ...Object.entries(INJECTED_ENV.project),
    ["__proto__", "${PI_CM_V}"],
  ]);
  assert.deepStrictEqual(Object.entries(substitutedRemote.entry.headers as object), [
    ["__proto__", "!!x"],
  ]);
  assert.strictEqual(({} as Record<string, unknown>).x, undefined);
});

test("AVAR-02: writes no value of a referenced variable", () => {
  // arrange
  const sentinels = {
    PI_CM_COMMAND: "sentinel-command",
    PI_CM_ARG: "sentinel-arg",
    PI_CM_ENV: "sentinel-env",
    PI_CM_URL: "sentinel-url",
    PI_CM_HEADER: "sentinel-header",
    PI_CM_OAUTH: "sentinel-oauth",
  };
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, env: sentinels };
  const stdio = {
    command: "${PI_CM_COMMAND}",
    args: ["${PI_CM_ARG:-x}"],
    env: { VALUE: "${PI_CM_ENV}", CLAUDE_PLUGIN_DATA: "${PI_CM_ENV}" },
  };
  const remote = {
    url: "https://${PI_CM_URL}",
    headers: { Value: "${PI_CM_HEADER:-}" },
    oauth: { clientId: "${PI_CM_OAUTH}" },
  };

  // act
  const writtenText = JSON.stringify([
    substituteAndInject(stdio, context),
    substituteAndInject(remote, context),
  ]);

  // assert
  assert.deepStrictEqual(
    Object.values(sentinels).filter((sentinel) => writtenText.includes(sentinel)),
    [],
  );
});

test("AVAR-03: no written env or headers value starts with a single !", () => {
  // arrange
  const context: McpSubstitutionContext = {
    ...PROJECT_CONTEXT,
    pluginRoot: "!/root",
    projectDir: "!/project",
    env: { PI_CM_X: "x" },
  };
  const stdio = {
    command: "!server",
    args: ["!arg"],
    env: { CLAUDE_PLUGIN_DATA: "!data", MODE: "!${PI_CM_X}", PLAIN: "!!x" },
  };
  const remote = { url: "!url", headers: { Value: "!header" } };

  // act
  const substitutedStdio = substituteAndInject(stdio, context);
  const substitutedRemote = substituteAndInject(remote, context);

  // assert
  assert.deepStrictEqual(substitutedStdio.entry, {
    command: "!server",
    args: ["!arg"],
    env: {
      CLAUDE_PLUGIN_ROOT: "!!/root",
      CLAUDE_PLUGIN_DATA: "!!data",
      CLAUDE_PROJECT_DIR: "!!/project",
      MODE: "!!${PI_CM_X}",
      PLAIN: "!!!x",
    },
  });
  assert.deepStrictEqual(substitutedRemote.entry, {
    url: "!url",
    headers: { Value: "!!header" },
  });
});

test("AVAR-02: reports a stdio server's missing names once each in command, args, env order", () => {
  // arrange
  const translated = {
    command: "${PI_CM_B}",
    args: ["${PI_CM_A}", "${PI_CM_B}", "${PI_CM_C}"],
    env: { FIRST: "${PI_CM_A}${PI_CM_D}", CLAUDE_PLUGIN_ROOT: "${PI_CM_E}" },
  };

  // act
  const { report } = substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(report, {
    missing: ["PI_CM_B", "PI_CM_A", "PI_CM_C", "PI_CM_D"],
    blanked: [],
  });
});

test("AVAR-02: reports a remote server's missing names once each in url, headers order", () => {
  // arrange
  const translated = {
    url: "https://${PI_CM_U}",
    headers: { First: "${PI_CM_V}", Second: "${PI_CM_U}${PI_CM_W}" },
  };

  // act
  const { report } = substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(report, { missing: ["PI_CM_U", "PI_CM_V", "PI_CM_W"], blanked: [] });
});

test("AVAR-05: reports a remote server's set withheld names once each in url, headers order", () => {
  // arrange
  const translated = {
    url: "https://mcp.example.test/${GIT_CONFIG_VALUE_0}",
    headers: {
      First: "${AWS_SESSION_TOKEN}${ANTHROPIC_API_KEY}",
      Second: "${GIT_CONFIG_VALUE_0}${NPM_TOKEN}",
      Third: "${ANTHROPIC_API_KEY}",
    },
  };
  const context: McpSubstitutionContext = {
    ...PROJECT_CONTEXT,
    env: {
      GIT_CONFIG_VALUE_0: "config-value",
      AWS_SESSION_TOKEN: "aws-value",
      NPM_TOKEN: "npm-value",
      ANTHROPIC_API_KEY: "api-key-value",
    },
  };

  // act
  const { report } = substituteAndInject(translated, context);

  // assert
  assert.deepStrictEqual(report, {
    missing: [],
    blanked: ["GIT_CONFIG_VALUE_0", "AWS_SESSION_TOKEN", "ANTHROPIC_API_KEY", "NPM_TOKEN"],
  });
});

test("AVAR-05: a remote unset withheld name is neither blanked nor missing", () => {
  // arrange
  const translated = {
    url: "https://mcp.example.test",
    headers: { Value: "${ANTHROPIC_API_KEY}" },
  };

  // act
  const substituted = substituteAndInject(translated, PROJECT_CONTEXT);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: { url: "https://mcp.example.test", headers: { Value: "" } },
    report: { missing: [], blanked: [] },
  });
});

test("AVAR-05: a plain-field blank adds no blanked name", () => {
  // arrange
  const translated = {
    command: "${CLAUDE_CODE_OAUTH_TOKEN}",
    args: ["${CLAUDE_CODE_OAUTH_TOKEN}"],
    env: { TOKEN: "${OTEL_EXPORTER_OTLP_HEADERS}" },
  };
  const context: McpSubstitutionContext = {
    ...PROJECT_CONTEXT,
    env: { CLAUDE_CODE_OAUTH_TOKEN: "oauth-value", OTEL_EXPORTER_OTLP_HEADERS: "otel-value" },
  };

  // act
  const substituted = substituteAndInject(translated, context);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: { command: "", args: [""], env: { ...INJECTED_ENV.project, TOKEN: "" } },
    report: { missing: [], blanked: [] },
  });
});

test("AVAR-05: a deny-listed header variable set to the empty string is blanked and listed", () => {
  // arrange
  const translated = {
    url: "https://mcp.example.test",
    headers: { Value: "${ANTHROPIC_API_KEY}" },
  };
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, env: { ANTHROPIC_API_KEY: "" } };

  // act
  const substituted = substituteAndInject(translated, context);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: { url: "https://mcp.example.test", headers: { Value: "" } },
    report: { missing: [], blanked: ["ANTHROPIC_API_KEY"] },
  });
});
