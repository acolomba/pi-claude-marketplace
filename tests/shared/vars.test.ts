import assert from "node:assert/strict";
import test from "node:test";

import { substituteClaudeVars } from "../../extensions/pi-claude-marketplace/shared/vars.ts";

// SK-4 / CM-3 / PI-10 -- pure-string substitution helper for
// ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA}.

test("SK-4 substituteClaudeVars replaces ${CLAUDE_PLUGIN_ROOT} every occurrence", () => {
  const body =
    "First: ${CLAUDE_PLUGIN_ROOT}\n" +
    "Second: ${CLAUDE_PLUGIN_ROOT}\n" +
    "Third: ${CLAUDE_PLUGIN_ROOT}";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/abs/path/to/plugin",
    pluginData: "/abs/path/to/data",
  });
  // All three occurrences replaced.
  assert.equal(
    out,
    "First: /abs/path/to/plugin\n" + "Second: /abs/path/to/plugin\n" + "Third: /abs/path/to/plugin",
  );
});

test("CM-3 substituteClaudeVars replaces ${CLAUDE_PLUGIN_DATA} every occurrence", () => {
  const body = "A=${CLAUDE_PLUGIN_DATA} B=${CLAUDE_PLUGIN_DATA} C=${CLAUDE_PLUGIN_DATA}";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/r",
    pluginData: "/d",
  });
  assert.equal(out, "A=/d B=/d C=/d");
});

test("substituteClaudeVars passes through bodies with no placeholders unchanged", () => {
  const body = "Hello world. No placeholders here.";
  const out = substituteClaudeVars(body, { pluginRoot: "/r", pluginData: "/d" });
  assert.equal(out, body);
});

test("substituteClaudeVars handles empty body (returns empty string)", () => {
  const out = substituteClaudeVars("", { pluginRoot: "/r", pluginData: "/d" });
  assert.equal(out, "");
});

test("T-03-01 substituteClaudeVars does NOT recursively substitute -- pluginRoot containing literal ${CLAUDE_PLUGIN_ROOT} is not re-fed", () => {
  // pluginRoot's literal value contains the SAME placeholder string. After
  // substitution the body must contain that literal verbatim -- the
  // implementation must NOT re-feed its own output back through the
  // ${CLAUDE_PLUGIN_ROOT} replaceAll, which would either loop or produce a
  // doubly-substituted value.
  const body = "Root is ${CLAUDE_PLUGIN_ROOT}";
  const out = substituteClaudeVars(body, {
    pluginRoot: "prefix/${CLAUDE_PLUGIN_ROOT}/suffix",
    pluginData: "/d",
  });
  // The single replaceAll runs once; the literal ${CLAUDE_PLUGIN_ROOT}
  // injected by the value itself MUST survive verbatim.
  assert.equal(out, "Root is prefix/${CLAUDE_PLUGIN_ROOT}/suffix");
});

test("substituteClaudeVars replaces both placeholders in same body", () => {
  const body = "${CLAUDE_PLUGIN_ROOT}/skills/x referencing ${CLAUDE_PLUGIN_DATA}/cache";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/r",
    pluginData: "/d",
  });
  assert.equal(out, "/r/skills/x referencing /d/cache");
});

// SUB-01 / SUB-02 / T-03-01 -- extended four-variable substitution contract.

test("SUB-01/SUB-02 substituteClaudeVars replaces all four tokens when all values present", () => {
  const body =
    "R=${CLAUDE_PLUGIN_ROOT} D=${CLAUDE_PLUGIN_DATA} " +
    "S=${CLAUDE_SKILL_DIR} P=${CLAUDE_PROJECT_DIR}";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/r",
    pluginData: "/d",
    skillDir: "/s",
    projectDir: "/p",
  });
  assert.equal(out, "R=/r D=/d S=/s P=/p");
});

test("SUB-01 absent skillDir leaves ${CLAUDE_SKILL_DIR} literal (never empty string)", () => {
  const body = "before ${CLAUDE_SKILL_DIR} after";
  const out = substituteClaudeVars(body, { pluginRoot: "/r", pluginData: "/d" });
  assert.ok(out.includes("${CLAUDE_SKILL_DIR}"), "token stays literal");
  assert.equal(out, "before ${CLAUDE_SKILL_DIR} after");
});

test("SUB-02 absent projectDir leaves ${CLAUDE_PROJECT_DIR} literal (never empty string)", () => {
  const body = "before ${CLAUDE_PROJECT_DIR} after";
  const out = substituteClaudeVars(body, { pluginRoot: "/r", pluginData: "/d" });
  assert.ok(out.includes("${CLAUDE_PROJECT_DIR}"), "token stays literal");
  assert.equal(out, "before ${CLAUDE_PROJECT_DIR} after");
});

test("substituteClaudeVars leaves an unknown ${CLAUDE_*} token unchanged", () => {
  const body = "x ${CLAUDE_SOMETHING_ELSE} y";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/r",
    pluginData: "/d",
    skillDir: "/s",
    projectDir: "/p",
  });
  assert.equal(out, "x ${CLAUDE_SOMETHING_ELSE} y");
});

test("T-03-01 single-pass: a skillDir value embedding ${CLAUDE_PLUGIN_DATA} is not re-expanded", () => {
  const body = "S=${CLAUDE_SKILL_DIR} D=${CLAUDE_PLUGIN_DATA}";
  const out = substituteClaudeVars(body, {
    pluginRoot: "/r",
    pluginData: "/data",
    skillDir: "/prefix/${CLAUDE_PLUGIN_DATA}/suffix",
    projectDir: "/p",
  });
  // The embedded ${CLAUDE_PLUGIN_DATA} inside the skillDir value survives
  // verbatim; only the standalone token is substituted.
  assert.equal(out, "S=/prefix/${CLAUDE_PLUGIN_DATA}/suffix D=/data");
});

test("byte-identity: content using only the two plugin vars matches the pre-existing output", () => {
  const body = "${CLAUDE_PLUGIN_ROOT}/skills/x referencing ${CLAUDE_PLUGIN_DATA}/cache";
  const out = substituteClaudeVars(body, { pluginRoot: "/r", pluginData: "/d" });
  assert.equal(out, "/r/skills/x referencing /d/cache");
});
