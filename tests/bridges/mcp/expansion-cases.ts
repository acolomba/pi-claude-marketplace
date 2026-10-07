// Shared raw -> written -> Claude-output cases for plugin MCP variables
// (AVAR-01..03). Each row is one raw field value, the environment at install,
// the value this extension writes, the environment when the server connects,
// and Claude Code's output for that field, derived by hand from Claude's rule.
// `substitute.test.ts` checks `written` and `missing`. The adapter conformance
// test feeds `written` through pi-mcp-adapter's real call chain for `field`
// with `PI_CLAUDE_MARKETPLACE_EMPTY=""` and `runtimeEnv`, and expects
// `claudeOutput`. Every reference a row keeps is set in `runtimeEnv`.

/** Where a raw value sits in the translated entry. */
export type ExpansionField =
  | "command"
  | "args"
  | "env"
  | "env-builtin"
  | "url"
  | "headers"
  | "oauth.clientId"
  | "oauth.scope"
  | "oauth.authServerMetadataUrl";

/** One field value's expected install-time and runtime behavior. */
export interface ExpansionCase {
  readonly title: string;
  readonly field: ExpansionField;
  /** The install scope; project when absent. */
  readonly scope?: "user" | "project";
  readonly raw: string;
  readonly installEnv: Readonly<Record<string, string>>;
  readonly written: string;
  readonly missing: readonly string[];
  readonly runtimeEnv: Readonly<Record<string, string>>;
  readonly claudeOutput: string;
}

/** The builtin paths every case expands against. */
export const EXPANSION_BUILTINS = {
  pluginRoot: "/plugins/acme",
  pluginData: "/data/mp/acme",
  projectDir: "/work/project",
} as const;

const SPLIT = "{env:PI_CLAUDE_MARKETPLACE_EMPTY}";

const SECRET_ENV = { PI_CM_SECRET: "secret-value" };

export const EXPANSION_CASES: readonly ExpansionCase[] = [
  {
    title: "AVAR-01: command ${CLAUDE_PLUGIN_ROOT} becomes the plugin root",
    field: "command",
    raw: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    installEnv: {},
    written: "/plugins/acme/bin/server",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "/plugins/acme/bin/server",
  },
  {
    title: "AVAR-01: args ${CLAUDE_PROJECT_DIR} becomes the project root at project scope",
    field: "args",
    raw: "${CLAUDE_PROJECT_DIR}",
    installEnv: {},
    written: "/work/project",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "/work/project",
  },
  {
    title: "AVAR-01: args ${CLAUDE_PROJECT_DIR} stays a reference at user scope",
    field: "args",
    scope: "user",
    raw: "${CLAUDE_PROJECT_DIR}",
    installEnv: {},
    written: "${CLAUDE_PROJECT_DIR}",
    missing: [],
    runtimeEnv: { CLAUDE_PROJECT_DIR: "/work/project" },
    claudeOutput: "/work/project",
  },
  {
    title: "AVAR-02: args with a variable unset at install keeps the reference and reports it",
    field: "args",
    raw: "--site=${PI_CM_SITE}",
    installEnv: {},
    written: "--site=${PI_CM_SITE}",
    missing: ["PI_CM_SITE"],
    runtimeEnv: { PI_CM_SITE: "us5" },
    claudeOutput: "--site=us5",
  },
  {
    title: "AVAR-02: args ${VAR:-default} with the variable unset writes the default",
    field: "args",
    raw: "${PI_CM_LEVEL:-info}",
    installEnv: {},
    written: "info",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "info",
  },
  {
    title: "AVAR-02: args ${VAR:-default} with the variable set to empty keeps the reference",
    field: "args",
    raw: "${PI_CM_LEVEL:-info}",
    installEnv: { PI_CM_LEVEL: "" },
    written: "${PI_CM_LEVEL}",
    missing: [],
    runtimeEnv: { PI_CM_LEVEL: "" },
    claudeOutput: "",
  },
  {
    title: "AVAR-02: headers with a set variable keeps the reference",
    field: "headers",
    raw: "Bearer ${PI_CM_TOKEN}",
    installEnv: { PI_CM_TOKEN: "token-value" },
    written: "Bearer ${PI_CM_TOKEN}",
    missing: [],
    runtimeEnv: { PI_CM_TOKEN: "token-value" },
    claudeOutput: "Bearer token-value",
  },
  {
    title: "AVAR-02: headers ${VAR:-} with the variable unset writes an empty value",
    field: "headers",
    raw: "${DD_API_KEY:-}",
    installEnv: {},
    written: "",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "",
  },
  {
    title: "AVAR-02: url ${VAR:-default} with the variable unset writes the default",
    field: "url",
    raw: "${LOGFIRE_MCP_URL:-https://logfire-us.pydantic.dev/mcp}",
    installEnv: {},
    written: "https://logfire-us.pydantic.dev/mcp",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "https://logfire-us.pydantic.dev/mcp",
  },
  {
    title: "AVAR-02: url ${VAR:-default} with the variable set keeps the reference",
    field: "url",
    raw: "${LOGFIRE_MCP_URL:-https://logfire-us.pydantic.dev/mcp}",
    installEnv: { LOGFIRE_MCP_URL: "https://logfire-eu.example.test/mcp" },
    written: "${LOGFIRE_MCP_URL}",
    missing: [],
    runtimeEnv: { LOGFIRE_MCP_URL: "https://logfire-eu.example.test/mcp" },
    claudeOutput: "https://logfire-eu.example.test/mcp",
  },
  {
    title: "AVAR-03: headers literal {env:NAME} is split",
    field: "headers",
    raw: "{env:PI_CM_SECRET}",
    installEnv: {},
    written: `{env:${SPLIT}PI_CM_SECRET}`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "{env:PI_CM_SECRET}",
  },
  {
    title: "AVAR-03: headers literal $env:NAME is split",
    field: "headers",
    raw: "$env:PI_CM_SECRET",
    installEnv: {},
    written: `$env${SPLIT}:PI_CM_SECRET`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "$env:PI_CM_SECRET",
  },
  {
    title: "AVAR-03: env literal ${1X} is split",
    field: "env",
    raw: "${1X}",
    installEnv: {},
    written: `$${SPLIT}{1X}`,
    missing: [],
    runtimeEnv: { "1X": "x" },
    claudeOutput: "${1X}",
  },
  {
    title: "AVAR-03: env value starting with ! gains one !",
    field: "env",
    raw: "!echo hi",
    installEnv: {},
    written: "!!echo hi",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "!echo hi",
  },
  {
    title: "AVAR-03: env ! before a kept reference gains one !",
    field: "env",
    raw: "!${PI_CM_CMD}",
    installEnv: { PI_CM_CMD: "x" },
    written: "!!${PI_CM_CMD}",
    missing: [],
    runtimeEnv: { PI_CM_CMD: "x" },
    claudeOutput: "!x",
  },
  {
    title: "AVAR-01: env CLAUDE_PLUGIN_ROOT value is literal",
    field: "env-builtin",
    raw: "${PI_CM_FOO}",
    installEnv: {},
    written: `$${SPLIT}{PI_CM_FOO}`,
    missing: [],
    runtimeEnv: { PI_CM_FOO: "x" },
    claudeOutput: "${PI_CM_FOO}",
  },
  {
    title: "AVAR-01: oauth.clientId is literal",
    field: "oauth.clientId",
    raw: "${PI_CM_SECRET}",
    installEnv: SECRET_ENV,
    written: `$${SPLIT}{PI_CM_SECRET}`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "${PI_CM_SECRET}",
  },
  {
    title: "AVAR-01: oauth.scope is literal",
    field: "oauth.scope",
    raw: "{env:PI_CM_SECRET} read",
    installEnv: {},
    written: `{env:${SPLIT}PI_CM_SECRET} read`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "{env:PI_CM_SECRET} read",
  },
  {
    title: "AVAR-01: oauth.authServerMetadataUrl is literal",
    field: "oauth.authServerMetadataUrl",
    raw: "https://auth.example.test/$env:PI_CM_SECRET",
    installEnv: {},
    written: `https://auth.example.test/$env${SPLIT}:PI_CM_SECRET`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "https://auth.example.test/$env:PI_CM_SECRET",
  },
  {
    title: "AVAR-03: headers {env before an empty reference is guarded",
    field: "headers",
    raw: "{env${PI_CM_R}:PI_CM_SECRET}",
    installEnv: { PI_CM_R: "" },
    written: `{env${SPLIT}\${PI_CM_R}:PI_CM_SECRET}`,
    missing: [],
    runtimeEnv: { ...SECRET_ENV, PI_CM_R: "" },
    claudeOutput: "{env:PI_CM_SECRET}",
  },
  {
    title: "AVAR-03: headers $en before an empty reference is guarded",
    field: "headers",
    raw: "$en${PI_CM_R}v:PI_CM_SECRET",
    installEnv: { PI_CM_R: "" },
    written: `$en${SPLIT}\${PI_CM_R}v:PI_CM_SECRET`,
    missing: [],
    runtimeEnv: { ...SECRET_ENV, PI_CM_R: "" },
    claudeOutput: "$env:PI_CM_SECRET",
  },
  {
    title: "AVAR-03: headers default text and adjacent literal text are escaped as one run",
    field: "headers",
    raw: "${PI_CM_A:-{}env:PI_CM_SECRET}",
    installEnv: {},
    written: `{env:${SPLIT}PI_CM_SECRET}`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "{env:PI_CM_SECRET}",
  },
  {
    title: "AVAR-03: headers nested {env:{env:NAME}} is split twice",
    field: "headers",
    raw: "{env:{env:PI_CM_SECRET}}",
    installEnv: {},
    written: `{env:${SPLIT}{env:${SPLIT}PI_CM_SECRET}}`,
    missing: [],
    runtimeEnv: SECRET_ENV,
    claudeOutput: "{env:{env:PI_CM_SECRET}}",
  },
  {
    title: "AVAR-01: args ~user/x is literal and the adapter leaves it",
    field: "args",
    raw: "~user/x",
    installEnv: {},
    written: "~user/x",
    missing: [],
    runtimeEnv: {},
    claudeOutput: "~user/x",
  },
];
