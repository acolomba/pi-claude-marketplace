import assert from "node:assert/strict";
import { test } from "node:test";

import {
  adapterFieldEncoder,
  substituteAndInject,
  type McpFieldEncoder,
  type McpSubstitutionContext,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";

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

// The adapter's encoder for a plugin that declares no options.
const ADAPTER_FIELD_ENCODER = adapterFieldEncoder(new Map());

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
  CLAUDE_PLUGIN_ROOT: "/plugins/acme",
  CLAUDE_PLUGIN_DATA: "/data/mp/acme",
} as const;

const PROJECT_CONTEXT: McpSubstitutionContext = {
  ...EXPANSION_BUILTINS,
  env: {},
  options: undefined,
};

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
    const context: McpSubstitutionContext = {
      ...SCOPE_BUILTINS[scope],
      env: installEnv,
      options: undefined,
    };

    // act
    const substituted = substituteAndInject(shape.entry(raw), context, ADAPTER_FIELD_ENCODER);

    // assert
    assert.deepStrictEqual(substituted, {
      entry: shape.writtenEntry(written, INJECTED_ENV),
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
  const substituted = substituteAndInject(translated, context, ADAPTER_FIELD_ENCODER);

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
  const substitutedRemote = substituteAndInject(remote, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);
  const substitutedStdio = substituteAndInject(stdio, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
      env: { ...INJECTED_ENV, RETRIES: 3 },
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
  const { entry } = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(entry, {
    command: "server",
    args: ["--flag"],
    env: {
      CLAUDE_PLUGIN_ROOT: "declared-root",
      CLAUDE_PLUGIN_DATA: "/data/mp/acme",
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
    "TOKEN",
  ]);
});

for (const scope of ["project", "user"] as const) {
  test(`AVAR-01: the injected stdio env is exactly CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA at ${scope} scope`, () => {
    // arrange
    const context: McpSubstitutionContext = {
      ...SCOPE_BUILTINS[scope],
      env: {},
      options: undefined,
    };

    // act
    const { entry } = substituteAndInject({ command: "server" }, context, ADAPTER_FIELD_ENCODER);

    // assert
    assert.deepStrictEqual(Object.entries(entry.env as Record<string, unknown>), [
      ["CLAUDE_PLUGIN_ROOT", "/plugins/acme"],
      ["CLAUDE_PLUGIN_DATA", "/data/mp/acme"],
    ]);
  });
}

test("AVAR-01: a declared env.CLAUDE_PROJECT_DIR follows the plain rule", () => {
  // arrange
  const translated = {
    command: "server",
    env: { CLAUDE_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}/${PI_CM_UNSET}" },
  };

  // act
  const substituted = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: {
      command: "server",
      env: { ...INJECTED_ENV, CLAUDE_PROJECT_DIR: "/work/project/${PI_CM_UNSET}" },
    },
    report: { missing: ["PI_CM_UNSET"], blanked: [] },
  });
});

test("AVAR-01: a project-scope ${CLAUDE_PROJECT_DIR} expands at install in command, args, env, url and headers", () => {
  // arrange
  const stdio = {
    command: "${CLAUDE_PROJECT_DIR}/bin/server",
    args: ["${CLAUDE_PROJECT_DIR}"],
    env: { DIR: "${CLAUDE_PROJECT_DIR}" },
  };
  const remote = {
    url: "https://mcp.example.test${CLAUDE_PROJECT_DIR}",
    headers: { Dir: "${CLAUDE_PROJECT_DIR}" },
  };

  // act
  const substitutedStdio = substituteAndInject(stdio, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);
  const substitutedRemote = substituteAndInject(remote, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(
    [substitutedStdio.entry, substitutedRemote.entry],
    [
      {
        command: "/work/project/bin/server",
        args: ["/work/project"],
        env: { ...INJECTED_ENV, DIR: "/work/project" },
      },
      { url: "https://mcp.example.test/work/project", headers: { Dir: "/work/project" } },
    ],
  );
});

test("MENV-02: injects the env into a stdio entry without args", () => {
  // arrange
  const translated = { command: "server", directTools: "search" };

  // act
  const { entry } = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
  substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
  const substitutedStdio = substituteAndInject(stdio, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);
  const substitutedRemote = substituteAndInject(remote, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(Object.entries(substitutedStdio.entry.env as Record<string, unknown>), [
    ...Object.entries(INJECTED_ENV),
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
    substituteAndInject(stdio, context, ADAPTER_FIELD_ENCODER),
    substituteAndInject(remote, context, ADAPTER_FIELD_ENCODER),
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
  const substitutedStdio = substituteAndInject(stdio, context, ADAPTER_FIELD_ENCODER);
  const substitutedRemote = substituteAndInject(remote, context, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(substitutedStdio.entry, {
    command: "!server",
    args: ["!arg"],
    env: {
      CLAUDE_PLUGIN_ROOT: "!!/root",
      CLAUDE_PLUGIN_DATA: "!!data",
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
  const { report } = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
  const { report } = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
  const { report } = substituteAndInject(translated, context, ADAPTER_FIELD_ENCODER);

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
  const substituted = substituteAndInject(translated, PROJECT_CONTEXT, ADAPTER_FIELD_ENCODER);

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
  const substituted = substituteAndInject(translated, context, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: { command: "", args: [""], env: { ...INJECTED_ENV, TOKEN: "" } },
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
  const substituted = substituteAndInject(translated, context, ADAPTER_FIELD_ENCODER);

  // assert
  assert.deepStrictEqual(substituted, {
    entry: { url: "https://mcp.example.test", headers: { Value: "" } },
    report: { missing: [], blanked: ["ANTHROPIC_API_KEY"] },
  });
});

test("BLT-02: passes each field to the encoder with its secret flag and writes literals through it", () => {
  // arrange
  const encoder: McpFieldEncoder = {
    expanded: (segments, secret, env) =>
      `expanded ${JSON.stringify(segments)} secret=${String(secret)} env=${String(env.PI_CM_MARK)}`,
    literal: (text, secret) => `literal ${text} secret=${String(secret)}`,
    optionForm: { kind: "none" },
  };
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, env: { PI_CM_MARK: "m" } };
  const stdio = { command: "c", args: ["a"], env: { K: "e" } };
  const remote = { url: "u", headers: { H: "h" }, oauth: { clientId: "o" } };

  // act
  const substitutedStdio = substituteAndInject(stdio, context, encoder);
  const substitutedRemote = substituteAndInject(remote, context, encoder);

  // assert
  assert.deepStrictEqual(substitutedStdio.entry, {
    command: 'expanded [{"kind":"text","text":"c"}] secret=false env=m',
    args: ['expanded [{"kind":"text","text":"a"}] secret=false env=m'],
    env: {
      CLAUDE_PLUGIN_ROOT: "literal /plugins/acme secret=true",
      CLAUDE_PLUGIN_DATA: "literal /data/mp/acme secret=true",
      K: 'expanded [{"kind":"text","text":"e"}] secret=true env=m',
    },
  });
  assert.deepStrictEqual(substitutedRemote.entry, {
    url: 'expanded [{"kind":"text","text":"u"}] secret=false env=m',
    headers: { H: 'expanded [{"kind":"text","text":"h"}] secret=true env=m' },
    oauth: { clientId: "literal o secret=false" },
  });
});

// D-PG10-20: the full option shape; `region` is not required and has no default.
const TOKEN_OPTIONS = resolveOptions({
  token: { type: "string", title: "Token", description: "The token.", default: "abc" },
  region: { type: "string", title: "Region", description: "The region." },
});

const OWNED_TOKEN = "PI_CLAUDE_MARKETPLACE_OPTION_0123456789abcdef";

const OWNED_REGION = "PI_CLAUDE_MARKETPLACE_OPTION_fedcba9876543210";

const TOKEN_NAMES: ReadonlyMap<string, string> = new Map([
  ["token", OWNED_TOKEN],
  ["region", OWNED_REGION],
]);

// Writes each field's segments as JSON, so a case reads what the walk gave.
function segmentsEncoder(optionForm: McpFieldEncoder["optionForm"]): McpFieldEncoder {
  return {
    expanded: (segments) => JSON.stringify(segments),
    literal: (text) => text,
    optionForm,
  };
}

test("D-PG10-11: the adapter encoder writes each option as a reference to its process variable", () => {
  // arrange
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, options: TOKEN_OPTIONS };
  const server = {
    command: "node",
    args: ["--token=${user_config.token}", "${user_config.region}"],
  };

  // act
  const substituted = substituteAndInject(server, context, adapterFieldEncoder(TOKEN_NAMES));

  // assert
  assert.deepStrictEqual(substituted, {
    entry: {
      command: "node",
      args: [`--token=\${${OWNED_TOKEN}}`, `\${${OWNED_REGION}}`],
      env: { CLAUDE_PLUGIN_ROOT: "/plugins/acme", CLAUDE_PLUGIN_DATA: "/data/mp/acme" },
    },
    report: { missing: [], blanked: [] },
  });
});

test("D-PG10-21: a plugin that declares no options keeps an option reference as written", () => {
  // arrange
  const server = { command: "node", args: ["${user_config.token}"] };

  // act
  const substituted = substituteAndInject(
    server,
    PROJECT_CONTEXT,
    adapterFieldEncoder(TOKEN_NAMES),
  );

  // assert
  assert.deepStrictEqual(substituted.entry.args, ["${user_config.token}"]);
});

test("D-PG10-11: a text-form encoder gets each option's MCP value as a text segment", () => {
  // arrange
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, options: TOKEN_OPTIONS };
  const server = { command: "node", args: ["${user_config.token}", "${user_config.region}"] };

  // act
  const substituted = substituteAndInject(server, context, segmentsEncoder({ kind: "text" }));

  // assert
  assert.deepStrictEqual(substituted.entry.args, [
    JSON.stringify([{ kind: "text", text: "abc" }]),
    JSON.stringify([{ kind: "text", text: "" }]),
  ]);
});

test("D-PG10-11: an encoder whose form is none runs no option pass", () => {
  // arrange
  const context: McpSubstitutionContext = { ...PROJECT_CONTEXT, options: TOKEN_OPTIONS };
  const server = { command: "node", args: ["${user_config.token}"] };

  // act
  const substituted = substituteAndInject(server, context, segmentsEncoder({ kind: "none" }));

  // assert
  assert.deepStrictEqual(substituted.entry.args, [
    JSON.stringify([{ kind: "text", text: "${user_config.token}" }]),
  ]);
});
