import assert from "node:assert/strict";
import test from "node:test";

import { CLAUDE_MARKETPLACE_MARKER_KEY } from "../../../extensions/pi-claude-marketplace/bridges/mcp/marker.ts";
import {
  deepSubstitute,
  substituteAndInject,
  type McpSubstitutionContext,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

// D-92-01 deep substitution surface + MENV-01 edge probes for the pure walker.
// Drives deepSubstitute / substituteAndInject directly -- cheaper and more
// targeted than the full prepare/commit path.

const ROOT = "/real/plugin/root";
const DATA = "/real/plugin/data";
const PROJ = "/real/project";

// Project-scope map: all three vars present.
const projectMap = new Map<string, string>([
  ["CLAUDE_PLUGIN_ROOT", ROOT],
  ["CLAUDE_PLUGIN_DATA", DATA],
  ["CLAUDE_PROJECT_DIR", PROJ],
]);

// User-scope map: CLAUDE_PROJECT_DIR omitted (documented absence, MENV-03).
const userMap = new Map<string, string>([
  ["CLAUDE_PLUGIN_ROOT", ROOT],
  ["CLAUDE_PLUGIN_DATA", DATA],
]);

function rec(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deep nesting (D-92-01 whole-entry deep)
// ---------------------------------------------------------------------------

test("deepSubstitute walks string leaves at every nesting depth", () => {
  const entry = {
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: ["--data", "${CLAUDE_PLUGIN_DATA}/state", "--proj", "${CLAUDE_PROJECT_DIR}"],
    env: { NESTED_PATH: "${CLAUDE_PLUGIN_ROOT}/node_modules/.bin" },
    cwd: "${CLAUDE_PLUGIN_DATA}",
    headers: { "X-Root": "${CLAUDE_PLUGIN_ROOT}", nested: { deep: "${CLAUDE_PLUGIN_DATA}" } },
  };

  const out = rec(deepSubstitute(entry, projectMap));
  assert.equal(out.command, `${ROOT}/bin/server`);
  assert.deepEqual(out.args, ["--data", `${DATA}/state`, "--proj", PROJ]);
  assert.equal(rec(out.env).NESTED_PATH, `${ROOT}/node_modules/.bin`);
  assert.equal(out.cwd, DATA);
  const headers = rec(out.headers);
  assert.equal(headers["X-Root"], ROOT);
  assert.equal(rec(headers.nested).deep, DATA);
});

// ---------------------------------------------------------------------------
// Adjacency + cross-variable safety (T-03-01)
// ---------------------------------------------------------------------------

test("adjacent tokens each resolve exactly once in a single pass", () => {
  const out = deepSubstitute("${CLAUDE_PLUGIN_ROOT}${CLAUDE_PLUGIN_DATA}", projectMap);
  assert.equal(out, ROOT + DATA);
});

test("cross-variable: a substituted value containing another token is NOT re-expanded", () => {
  // CLAUDE_PLUGIN_ROOT resolves to a value that literally contains the
  // CLAUDE_PLUGIN_DATA token; single-pass discipline emits it verbatim.
  const trickyMap = new Map<string, string>([
    ["CLAUDE_PLUGIN_ROOT", "${CLAUDE_PLUGIN_DATA}"],
    ["CLAUDE_PLUGIN_DATA", "/data"],
  ]);
  const out = deepSubstitute("${CLAUDE_PLUGIN_ROOT}", trickyMap);
  assert.equal(out, "${CLAUDE_PLUGIN_DATA}");
});

// ---------------------------------------------------------------------------
// Empty / non-string leaves
// ---------------------------------------------------------------------------

test("empty and non-string leaves are handled", () => {
  assert.equal(deepSubstitute("", projectMap), "");
  assert.deepEqual(deepSubstitute([], projectMap), []);
  assert.equal(deepSubstitute(42, projectMap), 42);
  assert.equal(deepSubstitute(true, projectMap), true);
  assert.equal(deepSubstitute(null, projectMap), null);

  const mixed = { count: 3, on: false, blank: "", ref: "${CLAUDE_PLUGIN_ROOT}", empties: [] };
  const out = rec(deepSubstitute(mixed, projectMap));
  assert.equal(out.count, 3);
  assert.equal(out.on, false);
  assert.equal(out.blank, "");
  assert.equal(out.ref, ROOT);
  assert.deepEqual(out.empties, []);
});

// ---------------------------------------------------------------------------
// Encoding: literal insertion, no $n expansion, unicode preserved
// ---------------------------------------------------------------------------

test("substituted values are inserted literally ($, braces, backslash not re-interpreted)", () => {
  const specialMap = new Map<string, string>([["CLAUDE_PLUGIN_ROOT", "a$1b\\c{d}e$&f"]]);
  const out = deepSubstitute("${CLAUDE_PLUGIN_ROOT}", specialMap);
  assert.equal(out, "a$1b\\c{d}e$&f");
});

test("unicode and special characters in values are preserved byte-for-byte", () => {
  const uniValue = "café-☃-\u{1F600}-Ω";
  const uniMap = new Map<string, string>([["CLAUDE_PLUGIN_DATA", uniValue]]);
  const out = deepSubstitute("${CLAUDE_PLUGIN_DATA}", uniMap);
  assert.equal(out, uniValue);
});

// ---------------------------------------------------------------------------
// Ordering: key insertion order + array element order preserved
// ---------------------------------------------------------------------------

test("the walk preserves object key insertion order and array element order", () => {
  const obj = { z: "1", a: "${CLAUDE_PLUGIN_ROOT}", m: "3" };
  const out = rec(deepSubstitute(obj, projectMap));
  assert.deepEqual(Object.keys(out), ["z", "a", "m"]);
  assert.equal(out.a, ROOT);

  const arr = ["${CLAUDE_PLUGIN_ROOT}", "b", "${CLAUDE_PLUGIN_DATA}"];
  assert.deepEqual(deepSubstitute(arr, projectMap), [ROOT, "b", DATA]);
});

// ---------------------------------------------------------------------------
// Keys never substituted
// ---------------------------------------------------------------------------

test("object keys are never substituted -- only string values", () => {
  const obj = { "${CLAUDE_PLUGIN_ROOT}": "${CLAUDE_PLUGIN_DATA}" };
  const out = rec(deepSubstitute(obj, projectMap));
  assert.deepEqual(Object.keys(out), ["${CLAUDE_PLUGIN_ROOT}"]);
  assert.equal(out["${CLAUDE_PLUGIN_ROOT}"], DATA);
});

// ---------------------------------------------------------------------------
// Verbatim key preservation for a literal __proto__ key (WR-01)
// ---------------------------------------------------------------------------

test("WR-01 a literal __proto__ key survives the walk verbatim and does not pollute Object.prototype", () => {
  // JSON.parse materializes __proto__ as a real own-enumerable property, so the
  // walker must copy it as an own data property rather than hitting the
  // inherited __proto__ accessor (which would drop the key).
  const entry: unknown = JSON.parse('{"__proto__": {"ref": "${CLAUDE_PLUGIN_ROOT}"}, "keep": "x"}');
  const out = rec(deepSubstitute(entry, projectMap));

  assert.ok(Object.hasOwn(out, "__proto__"), "__proto__ must be an own key on the output");
  assert.deepEqual(rec(out.__proto__), { ref: ROOT });
  assert.equal(out.keep, "x");
  assert.deepEqual(Object.keys(out), ["__proto__", "keep"]);

  // The literal-key round-trip must not have mutated the global prototype.
  assert.equal(
    ({} as Record<string, unknown>).ref,
    undefined,
    "Object.prototype must not be polluted",
  );
});

// ---------------------------------------------------------------------------
// Unknown-var pass-through
// ---------------------------------------------------------------------------

test("unknown vars and user-scope CLAUDE_PROJECT_DIR pass through untouched", () => {
  assert.equal(deepSubstitute("${CLAUDE_SESSION_ID}", userMap), "${CLAUDE_SESSION_ID}");
  assert.equal(deepSubstitute("${CLAUDE_PROJECT_DIR}", userMap), "${CLAUDE_PROJECT_DIR}");
  // Mixed known + unknown in one leaf: known resolves, unknown stays.
  assert.equal(
    deepSubstitute("${CLAUDE_PLUGIN_ROOT}/x/${CLAUDE_SESSION_ID}", userMap),
    `${ROOT}/x/\${CLAUDE_SESSION_ID}`,
  );
});

// ---------------------------------------------------------------------------
// Marker isolation
// ---------------------------------------------------------------------------

test("the walk is marker-agnostic -- a carried marker subobject is untouched", () => {
  const entry = {
    command: "${CLAUDE_PLUGIN_ROOT}/bin",
    [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "acme", marketplace: "official" },
  };
  const out = rec(deepSubstitute(entry, projectMap));
  assert.equal(out.command, `${ROOT}/bin`);
  assert.deepEqual(out[CLAUDE_MARKETPLACE_MARKER_KEY], {
    plugin: "acme",
    marketplace: "official",
  });
});

// ---------------------------------------------------------------------------
// Non-object tolerance at the walk boundary
// ---------------------------------------------------------------------------

test("deepSubstitute never throws on a primitive leaf at the boundary", () => {
  assert.equal(deepSubstitute(42, projectMap), 42);
  assert.equal(deepSubstitute(null, projectMap), null);
  assert.equal(deepSubstitute(undefined, projectMap), undefined);
});

// ---------------------------------------------------------------------------
// substituteAndInject: injection targeting + precedence (MENV-02/03, D-92-02)
// ---------------------------------------------------------------------------

const projectCtx: McpSubstitutionContext = {
  pluginRoot: ROOT,
  pluginData: DATA,
  projectDir: PROJ,
};
const userCtx: McpSubstitutionContext = {
  pluginRoot: ROOT,
  pluginData: DATA,
  projectDir: undefined,
};

test("MENV-02 stdio entry gets injected env with plugin-declared keys winning", () => {
  const out = substituteAndInject(
    {
      command: "${CLAUDE_PLUGIN_ROOT}/bin",
      env: { FOO: "bar", CLAUDE_PLUGIN_ROOT: "declared-wins" },
    },
    projectCtx,
  );
  assert.equal(out.command, `${ROOT}/bin`);
  assert.deepEqual(out.env, {
    CLAUDE_PLUGIN_ROOT: "declared-wins",
    CLAUDE_PLUGIN_DATA: DATA,
    CLAUDE_PROJECT_DIR: PROJ,
    FOO: "bar",
  });
});

test("MENV-03 user scope omits CLAUDE_PROJECT_DIR from injected env", () => {
  const out = substituteAndInject({ command: "x" }, userCtx);
  const env = rec(out.env);
  assert.equal(env.CLAUDE_PLUGIN_ROOT, ROOT);
  assert.equal(env.CLAUDE_PLUGIN_DATA, DATA);
  assert.ok(!("CLAUDE_PROJECT_DIR" in env), "user scope must not inject CLAUDE_PROJECT_DIR");
});

test("D-92-02 url-type entry keeps substitution but gains no env", () => {
  const out = substituteAndInject({ url: "${CLAUDE_PLUGIN_ROOT}/sse" }, projectCtx);
  assert.equal(out.url, `${ROOT}/sse`);
  assert.ok(!("env" in out), "url-type entry must not synthesize an env block");
});

test("D-92-02 url-type entry with declared env is substituted but not injected", () => {
  const out = substituteAndInject(
    { url: "https://x", env: { A: "${CLAUDE_PLUGIN_DATA}" } },
    projectCtx,
  );
  assert.deepEqual(out.env, { A: DATA });
});
