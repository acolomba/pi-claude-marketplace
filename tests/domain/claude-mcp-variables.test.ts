import assert from "node:assert/strict";
import { test } from "node:test";

import { expandClaudeValue } from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

import type {
  ClaudeBuiltins,
  ClaudeEnv,
  ExpandedValue,
} from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";

interface ExpansionRow {
  readonly title: string;
  readonly raw: string;
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
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "/plugins/acme/bin" }], missing: [] },
  },
  {
    title: "AVAR-01: replaces ${CLAUDE_PLUGIN_DATA} with the data path",
    raw: "${CLAUDE_PLUGIN_DATA}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "/data/mp/acme" }], missing: [] },
  },
  {
    title: "AVAR-01: replaces ${CLAUDE_PROJECT_DIR} with the project root at project scope",
    raw: "${CLAUDE_PROJECT_DIR}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "/work/project" }], missing: [] },
  },
  {
    title: "AVAR-01: keeps ${CLAUDE_PROJECT_DIR} at user scope and never reports it missing",
    raw: "${CLAUDE_PROJECT_DIR}",
    env: {},
    builtins: USER,
    expanded: { segments: [{ kind: "ref", name: "CLAUDE_PROJECT_DIR" }], missing: [] },
  },
  {
    title: "AVAR-02: ${CLAUDE_PROJECT_DIR:-x} at user scope follows the ordinary rule",
    raw: "${CLAUDE_PROJECT_DIR:-x}",
    env: {},
    builtins: USER,
    expanded: { segments: [{ kind: "text", text: "x" }], missing: [] },
  },
  {
    title: "AVAR-02: ${CLAUDE_PLUGIN_ROOT:-x} is an ordinary variable",
    raw: "${CLAUDE_PLUGIN_ROOT:-x}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "x" }], missing: [] },
  },
  {
    title: "AVAR-01: the data pass expands ${CLAUDE_PLUGIN_DATA} inside the plugin root",
    raw: "${CLAUDE_PLUGIN_ROOT}",
    env: {},
    builtins: { ...PROJECT, pluginRoot: "${CLAUDE_PLUGIN_DATA}/root" },
    expanded: { segments: [{ kind: "text", text: "/data/mp/acme/root" }], missing: [] },
  },
  {
    title: "AVAR-02: a ${CLAUDE_PROJECT_DIR} the data pass inserts at project scope is ordinary",
    raw: "${CLAUDE_PLUGIN_DATA}",
    env: {},
    builtins: { ...PROJECT, pluginData: "${CLAUDE_PROJECT_DIR}" },
    expanded: {
      segments: [{ kind: "ref", name: "CLAUDE_PROJECT_DIR" }],
      missing: ["CLAUDE_PROJECT_DIR"],
    },
  },
  {
    title: "AVAR-02: the rule scans builtin output for a set variable",
    raw: "${CLAUDE_PLUGIN_ROOT}/bin",
    env: { PI_CM_HOME: "home-value" },
    builtins: { ...PROJECT, pluginRoot: "/home/${PI_CM_HOME}/acme" },
    expanded: {
      segments: [
        { kind: "text", text: "/home/" },
        { kind: "ref", name: "PI_CM_HOME" },
        { kind: "text", text: "/acme/bin" },
      ],
      missing: [],
    },
  },
  {
    title: "AVAR-01: inserts a builtin path holding replacement patterns literally",
    raw: "${CLAUDE_PLUGIN_ROOT}",
    env: {},
    builtins: { ...PROJECT, pluginRoot: "/p/$&-$1" },
    expanded: { segments: [{ kind: "text", text: "/p/$&-$1" }], missing: [] },
  },
  {
    title: "AVAR-02: a set variable stays a reference",
    raw: "${PI_CM_V}",
    env: { PI_CM_V: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [] },
  },
  {
    title: "AVAR-02: a variable set to the empty string counts as set",
    raw: "${PI_CM_V}",
    env: { PI_CM_V: "" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [] },
  },
  {
    title: "AVAR-02: an unset variable stays a reference and is reported missing",
    raw: "${PI_CM_V}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"] },
  },
  {
    title: "AVAR-02: an own property holding undefined reads as unset",
    raw: "${PI_CM_V}",
    env: { PI_CM_V: undefined },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"] },
  },
  {
    title: "AVAR-02: a set variable with a default stays a reference",
    raw: "${PI_CM_V:-d}",
    env: { PI_CM_V: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: [] },
  },
  {
    title: "AVAR-02: an unset variable with a default becomes the default text",
    raw: "${PI_CM_V:-d}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "d" }], missing: [] },
  },
  {
    title: "AVAR-02: an unset variable with an empty default becomes empty text",
    raw: "${PI_CM_V:-}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "text", text: "" }], missing: [] },
  },
  {
    title: "AVAR-02: a default holding ${X} is text and never scanned again",
    raw: "${PI_CM_V:-${PI_CM_X}}",
    env: { PI_CM_X: "set-value" },
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "${PI_CM_X" },
        { kind: "text", text: "}" },
      ],
      missing: [],
    },
  },
  {
    title: "AVAR-02: a default holding {env:X} is text",
    raw: "${PI_CM_V:-{env:PI_CM_X}}",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "text", text: "{env:PI_CM_X" },
        { kind: "text", text: "}" },
      ],
      missing: [],
    },
  },
  ...["$PI_CM_V", "${1X}", "${A-B}", "${A:b}", "${user_config.KEY}", "$env:X", "{env:X}"].map(
    (raw): ExpansionRow => ({
      title: `AVAR-02: ${raw} is outside Claude's grammar and stays text`,
      raw,
      env: { PI_CM_V: "set", A: "set", X: "set" },
      builtins: PROJECT,
      expanded: { segments: [{ kind: "text", text: raw }], missing: [] },
    }),
  ),
  {
    title: "AVAR-02: the lookup is exact-case",
    raw: "${PI_CM_V}",
    env: { pi_cm_v: "set-value" },
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "PI_CM_V" }], missing: ["PI_CM_V"] },
  },
  {
    title: "AVAR-02: the lookup reads own properties only",
    raw: "${constructor}",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [{ kind: "ref", name: "constructor" }], missing: ["constructor"] },
  },
  {
    title: "AVAR-02: adjacent references give two references",
    raw: "${PI_CM_A}${PI_CM_B}",
    env: { PI_CM_A: "a-value", PI_CM_B: "b-value" },
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "ref", name: "PI_CM_A" },
        { kind: "ref", name: "PI_CM_B" },
      ],
      missing: [],
    },
  },
  {
    title: "AVAR-02: a missing name used twice is reported twice",
    raw: "${PI_CM_V}/${PI_CM_V}",
    env: {},
    builtins: PROJECT,
    expanded: {
      segments: [
        { kind: "ref", name: "PI_CM_V" },
        { kind: "text", text: "/" },
        { kind: "ref", name: "PI_CM_V" },
      ],
      missing: ["PI_CM_V", "PI_CM_V"],
    },
  },
  {
    title: "AVAR-02: an empty value has no segments",
    raw: "",
    env: {},
    builtins: PROJECT,
    expanded: { segments: [], missing: [] },
  },
];

for (const { title, raw, env, builtins, expanded } of ROWS) {
  test(title, () => {
    // arrange
    const expectedValue = expanded;

    // act
    const expandedValue = expandClaudeValue(raw, env, builtins);

    // assert
    assert.deepStrictEqual(expandedValue, expectedValue);
  });
}
