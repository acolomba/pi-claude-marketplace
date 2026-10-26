import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  expandClaudeValue,
  scanClaudeServerVariables,
} from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

import type {
  ClaudeBuiltins,
  ClaudeEnv,
  ExpandedValue,
  FieldClass,
  ServerVariableScan,
} from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

interface ExpansionRow {
  readonly title: string;
  readonly raw: string;
  readonly fieldClass: FieldClass;
  readonly env: ClaudeEnv;
  readonly builtins: ClaudeBuiltins;
  readonly expanded: ExpandedValue;
}

const PROJECT: ClaudeBuiltins = {
  pluginRoot: "/plugins/acme",
  pluginData: "/data/mp/acme",
  projectDir: "/work/project",
};

const USER: ClaudeBuiltins = { ...PROJECT, projectDir: undefined };

const ROWS: readonly ExpansionRow[] = [
  {
    title: "AVAR-01: replaces ${CLAUDE_PLUGIN_ROOT} with the plugin root",
    raw: "${CLAUDE_PLUGIN_ROOT}/bin",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "/plugins/acme/bin" }],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-01: replaces ${CLAUDE_PLUGIN_DATA} with the data path",
    raw: "${CLAUDE_PLUGIN_DATA}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "/data/mp/acme" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-01: replaces ${CLAUDE_PROJECT_DIR} with the project root at project scope",
    raw: "${CLAUDE_PROJECT_DIR}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "/work/project" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-01: keeps ${CLAUDE_PROJECT_DIR} at user scope and never reports it missing",
    raw: "${CLAUDE_PROJECT_DIR}",
    fieldClass: "plain",
    env: {},
    builtins: USER,
    expanded: {
      segments: [{ kind: "ref", name: "CLAUDE_PROJECT_DIR" }],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: ${CLAUDE_PROJECT_DIR:-x} at user scope follows the ordinary rule",
    raw: "${CLAUDE_PROJECT_DIR:-x}",
    fieldClass: "plain",
    env: {},
    builtins: USER,
    expanded: { segments: [{ kind: "text", text: "x" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: ${CLAUDE_PLUGIN_ROOT:-x} is an ordinary variable",
    raw: "${CLAUDE_PLUGIN_ROOT:-x}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "x" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-01: the data pass expands ${CLAUDE_PLUGIN_DATA} inside the plugin root",
    raw: "${CLAUDE_PLUGIN_ROOT}",
    fieldClass: "plain",
    env: {},
    builtins: { ...PROJECT, pluginRoot: "${CLAUDE_PLUGIN_DATA}/root" },
    expanded: {
      segments: [{ kind: "text", text: "/data/mp/acme/root" }],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: a ${CLAUDE_PROJECT_DIR} the data pass inserts at project scope is ordinary",
    raw: "${CLAUDE_PLUGIN_DATA}",
    fieldClass: "plain",
    env: {},
    builtins: { ...PROJECT, pluginData: "${CLAUDE_PROJECT_DIR}" },
    expanded: {
      segments: [{ kind: "ref", name: "CLAUDE_PROJECT_DIR" }],
      missing: ["CLAUDE_PROJECT_DIR"],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: the rule scans builtin output for a set variable",
    raw: "${CLAUDE_PLUGIN_ROOT}/bin",
    fieldClass: "plain",
    env: { PI_CM_HOME: "home-value" },
    builtins: { ...PROJECT, pluginRoot: "/home/${PI_CM_HOME}/acme" },
    expanded: {
      segments: [
        { kind: "text", text: "/home/" },
        { kind: "ref", name: "PI_CM_HOME" },
        { kind: "text", text: "/acme/bin" },
      ],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-01: inserts a builtin path holding replacement patterns literally",
    raw: "${CLAUDE_PLUGIN_ROOT}",
    fieldClass: "plain",
    env: {},
    builtins: { ...PROJECT, pluginRoot: "/p/$&-$1" },
    expanded: { segments: [{ kind: "text", text: "/p/$&-$1" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: a set variable stays a reference",
    raw: "${PI_CM_V}",
    fieldClass: "plain",
    env: { PI_CM_V: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: a variable set to the empty string counts as set",
    raw: "${PI_CM_V}",
    fieldClass: "plain",
    env: { PI_CM_V: "" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: an unset variable stays a reference and is reported missing",
    raw: "${PI_CM_V}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"], withheld: [] },
  },
  {
    title: "AVAR-02: an own property holding undefined reads as unset",
    raw: "${PI_CM_V}",
    fieldClass: "plain",
    env: { PI_CM_V: undefined },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"], withheld: [] },
  },
  {
    title: "AVAR-02: a set variable with a default stays a reference",
    raw: "${PI_CM_V:-d}",
    fieldClass: "plain",
    env: { PI_CM_V: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: an unset variable with a default becomes the default text",
    raw: "${PI_CM_V:-d}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "d" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: an unset variable with an empty default becomes empty text",
    raw: "${PI_CM_V:-}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-02: a default holding ${X} is text and never scanned again",
    raw: "${PI_CM_V:-${PI_CM_X}}",
    fieldClass: "plain",
    env: { PI_CM_X: "set-value" },
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "${PI_CM_X" },
        { kind: "text", text: "}" },
      ],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: a default holding {env:X} is text",
    raw: "${PI_CM_V:-{env:PI_CM_X}}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "{env:PI_CM_X" },
        { kind: "text", text: "}" },
      ],
      missing: [],
      withheld: [],
    },
  },
  ...["$PI_CM_V", "${1X}", "${A-B}", "${A:b}", "${user_config.KEY}", "$env:X", "{env:X}"].map(
    (raw): ExpansionRow => ({
      title: `AVAR-02: ${raw} is outside Claude's grammar and stays text`,
      raw,
      fieldClass: "plain",
      env: { PI_CM_V: "set", A: "set", X: "set" },
      builtins: PROJECT,
      expanded: { segments: [{ kind: "text", text: raw }], missing: [], withheld: [] },
    }),
  ),
  {
    title: "AVAR-02: the lookup is exact-case",
    raw: "${PI_CM_V}",
    fieldClass: "plain",
    env: { pi_cm_v: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"], withheld: [] },
  },
  {
    title: "AVAR-02: the lookup reads own properties only",
    raw: "${constructor}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "ref", name: "constructor" }],
      missing: ["constructor"],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: adjacent references give two references",
    raw: "${PI_CM_A}${PI_CM_B}",
    fieldClass: "plain",
    env: { PI_CM_A: "a-value", PI_CM_B: "b-value" },
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "ref", name: "PI_CM_A" },
        { kind: "ref", name: "PI_CM_B" },
      ],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: a missing name used twice is reported twice",
    raw: "${PI_CM_V}/${PI_CM_V}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "ref", name: "PI_CM_V" },
        { kind: "text", text: "/" },
        { kind: "ref", name: "PI_CM_V" },
      ],
      missing: ["PI_CM_V", "PI_CM_V"],
      withheld: [],
    },
  },
  {
    title: "AVAR-02: an empty value has no segments",
    raw: "",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [], missing: [], withheld: [] },
  },
  {
    title: "AVAR-05: a remote set deny-listed reference inside text is withheld as empty text",
    raw: "Bearer ${ANTHROPIC_API_KEY}",
    fieldClass: "remote",
    env: { ANTHROPIC_API_KEY: "api-key-value" },
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "Bearer " },
        { kind: "text", text: "" },
      ],
      missing: [],
      withheld: [{ name: "ANTHROPIC_API_KEY", set: true }],
    },
  },
  {
    title: "AVAR-05: a remote unset deny-listed reference is empty text and never missing",
    raw: "Bearer ${ANTHROPIC_API_KEY}",
    fieldClass: "remote",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "Bearer " },
        { kind: "text", text: "" },
      ],
      missing: [],
      withheld: [{ name: "ANTHROPIC_API_KEY", set: false }],
    },
  },
  {
    title: "AVAR-05: a remote set deny-listed reference ignores its default",
    raw: "${ANTHROPIC_API_KEY:-x}",
    fieldClass: "remote",
    env: { ANTHROPIC_API_KEY: "api-key-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "ANTHROPIC_API_KEY", set: true }],
    },
  },
  {
    title: "AVAR-05: a remote unset deny-listed reference ignores its default",
    raw: "${ANTHROPIC_API_KEY:-x}",
    fieldClass: "remote",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "ANTHROPIC_API_KEY", set: false }],
    },
  },
  {
    title: "AVAR-05: remote membership reads the uppercase name",
    raw: "${anthropic_api_key}",
    fieldClass: "remote",
    env: { anthropic_api_key: "api-key-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "anthropic_api_key", set: true }],
    },
  },
  {
    title: "AVAR-05: a remote set GITHUB_TOKEN stays a reference",
    raw: "${GITHUB_TOKEN}",
    fieldClass: "remote",
    env: { GITHUB_TOKEN: "github-token-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "GITHUB_TOKEN" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-05: a remote name matching Claude's pattern is withheld",
    raw: "${GIT_CONFIG_VALUE_0}",
    fieldClass: "remote",
    env: { GIT_CONFIG_VALUE_0: "config-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "GIT_CONFIG_VALUE_0", set: true }],
    },
  },
  {
    title: "AVAR-05: a remote ANTHROPIC_BASE_URL whose value embeds a credential is withheld",
    raw: "${ANTHROPIC_BASE_URL}",
    fieldClass: "remote",
    env: { ANTHROPIC_BASE_URL: "https://user:pass@proxy.example.test" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "ANTHROPIC_BASE_URL", set: true }],
    },
  },
  {
    title: "AVAR-05: a remote credential-free ANTHROPIC_BASE_URL stays a reference",
    raw: "${ANTHROPIC_BASE_URL}",
    fieldClass: "remote",
    env: { ANTHROPIC_BASE_URL: "https://proxy.example.test" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "ref", name: "ANTHROPIC_BASE_URL" }],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-05: a remote unset ANTHROPIC_BASE_URL stays a reference and is reported missing",
    raw: "${ANTHROPIC_BASE_URL}",
    fieldClass: "remote",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "ref", name: "ANTHROPIC_BASE_URL" }],
      missing: ["ANTHROPIC_BASE_URL"],
      withheld: [],
    },
  },
  {
    title: "AVAR-05: a remote name on no deny-list stays a reference",
    raw: "${PI_CM_V}",
    fieldClass: "remote",
    env: { PI_CM_V: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [], withheld: [] },
  },
  {
    title: "AVAR-05: a plain set ANTHROPIC_API_KEY stays a reference",
    raw: "${ANTHROPIC_API_KEY}",
    fieldClass: "plain",
    env: { ANTHROPIC_API_KEY: "api-key-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "ref", name: "ANTHROPIC_API_KEY" }],
      missing: [],
      withheld: [],
    },
  },
  {
    title: "AVAR-05: a plain set Claude credential is withheld as empty text",
    raw: "${CLAUDE_CODE_OAUTH_TOKEN}",
    fieldClass: "plain",
    env: { CLAUDE_CODE_OAUTH_TOKEN: "oauth-token-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "CLAUDE_CODE_OAUTH_TOKEN", set: true }],
    },
  },
  {
    title: "AVAR-05: a plain unset Claude credential with a default becomes the default text",
    raw: "${CLAUDE_CODE_OAUTH_TOKEN:-d}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "d" }], missing: [], withheld: [] },
  },
  {
    title:
      "AVAR-05: a plain unset Claude credential is literal text, never a reference, and missing",
    raw: "${CLAUDE_CODE_OAUTH_TOKEN}",
    fieldClass: "plain",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "${CLAUDE_CODE_OAUTH_TOKEN}" }],
      missing: ["CLAUDE_CODE_OAUTH_TOKEN"],
      withheld: [],
    },
  },
  {
    title: "AVAR-05: a plain set OTEL_ name is withheld as empty text",
    raw: "${OTEL_EXPORTER_OTLP_HEADERS}",
    fieldClass: "plain",
    env: { OTEL_EXPORTER_OTLP_HEADERS: "otel-value" },
    builtins: PROJECT,
    expanded: {
      segments: [{ kind: "text", text: "" }],
      missing: [],
      withheld: [{ name: "OTEL_EXPORTER_OTLP_HEADERS", set: true }],
    },
  },
];

describe("expandClaudeValue", () => {
  for (const { title, raw, fieldClass, env, builtins, expanded } of ROWS) {
    test(title, () => {
      // arrange
      const expectedValue = expanded;

      // act
      const expandedValue = expandClaudeValue(raw, fieldClass, env, builtins);

      // assert
      assert.deepStrictEqual(expandedValue, expectedValue);
    });
  }
});

interface ScanRow {
  readonly title: string;
  readonly server: unknown;
  readonly env: ClaudeEnv;
  readonly scan: ServerVariableScan;
}

const SCAN_ROWS: readonly ScanRow[] = [
  {
    title: "AVAR-04: a builtin placeholder never joins the text after it into a variable",
    server: { command: "$${CLAUDE_PLUGIN_ROOT}{PI_CM_JOINED}", args: ["${PI_CM_E}"] },
    env: {},
    scan: { unset: ["PI_CM_E"], withheld: [] },
  },
  {
    title: "AVAR-04: a remote builtin placeholder never joins the text after it into a variable",
    server: {
      type: "http",
      url: "https://a.example/$${CLAUDE_PROJECT_DIR}{PI_CM_JOINED}",
      headers: { "X-Data": "$${CLAUDE_PLUGIN_DATA}{PI_CM_JOINED}" },
    },
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title:
      "AVAR-04: lists a stdio server's unset args name and its set plain-listed env credential",
    server: {
      command: "${CLAUDE_PLUGIN_ROOT}/bin/x",
      args: ["${PI_CM_A}", "${PI_CM_B:-d}"],
      env: { TOKEN: "${CLAUDE_CODE_OAUTH_TOKEN}", CLAUDE_PLUGIN_ROOT: "${PI_CM_C}" },
    },
    env: { CLAUDE_CODE_OAUTH_TOKEN: "oauth-value" },
    scan: { unset: ["PI_CM_A"], withheld: ["CLAUDE_CODE_OAUTH_TOKEN"] },
  },
  {
    title: "AVAR-04: lists an unset plain-listed name with no default as unset, not withheld",
    server: { command: "${CLAUDE_CODE_OAUTH_TOKEN}" },
    env: {},
    scan: { unset: ["CLAUDE_CODE_OAUTH_TOKEN"], withheld: [] },
  },
  {
    title: "AVAR-04: never lists ${CLAUDE_PROJECT_DIR} or ${CLAUDE_PLUGIN_DATA}",
    server: {
      type: "stdio",
      command: "${CLAUDE_PROJECT_DIR}/run",
      args: ["${CLAUDE_PLUGIN_DATA}/db", 7],
      env: { DATA: "${CLAUDE_PLUGIN_DATA}", CLAUDE_PLUGIN_DATA: "${PI_CM_C}" },
    },
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title:
      "AVAR-05: lists a remote server's deny-listed references as withheld whether set or not, each once",
    server: {
      type: "streamable-http",
      url: "https://api.example.test/${ANTHROPIC_API_KEY}/${PI_CM_D}",
      headers: {
        Authorization: "Bearer ${ANTHROPIC_API_KEY}",
        "X-Oauth": "${CLAUDE_CODE_OAUTH_TOKEN}",
        "X-Github": "${GITHUB_TOKEN}",
        "X-Count": 3,
      },
    },
    env: { ANTHROPIC_API_KEY: "api-key-value", GITHUB_TOKEN: "github-value" },
    scan: { unset: ["PI_CM_D"], withheld: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] },
  },
  {
    title: "AVAR-04: a ws server gives two empty lists",
    server: { type: "ws", url: "wss://db.example.test/${PI_CM_E}" },
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title: "AVAR-04: a host-only server type gives two empty lists",
    server: { type: "claudeai-proxy", url: "https://proxy.example.test/${PI_CM_E}" },
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title: "AVAR-04: a server with a non-string type gives two empty lists",
    server: { type: 7, command: "${PI_CM_E}" },
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title: "AVAR-04: a null server gives two empty lists",
    server: null,
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title: "AVAR-04: a string server gives two empty lists",
    server: "${PI_CM_E}",
    env: {},
    scan: { unset: [], withheld: [] },
  },
  {
    title: "AVAR-04: an array server gives two empty lists",
    server: ["${PI_CM_E}"],
    env: {},
    scan: { unset: [], withheld: [] },
  },
];

describe("scanClaudeServerVariables", () => {
  for (const { title, server, env, scan } of SCAN_ROWS) {
    test(title, () => {
      // arrange
      const expectedScan = scan;

      // act
      const serverScan = scanClaudeServerVariables(server, env);

      // assert
      assert.deepStrictEqual(serverScan, expectedScan);
    });
  }
});
