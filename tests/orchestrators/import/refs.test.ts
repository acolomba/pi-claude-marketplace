import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractEnabledPluginRefs,
  parseEnabledPluginRef,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

test("parseEnabledPluginRef accepts exactly one plugin@marketplace separator", () => {
  const got = parseEnabledPluginRef("frontend-design@claude-plugins-official");
  assert.equal(got.ok, true);
  if (got.ok) {
    assert.equal(got.ref.plugin, "frontend-design");
    assert.equal(got.ref.marketplace, "claude-plugins-official");
    assert.equal(got.ref.raw, "frontend-design@claude-plugins-official");
  }
});

for (const raw of [
  "",
  "plugin",
  "@claude-plugins-official",
  "frontend-design@",
  "frontend-design@@mp",
  "frontend-design@mp@extra",
]) {
  test(`parseEnabledPluginRef rejects malformed ref ${JSON.stringify(raw)}`, () => {
    const got = parseEnabledPluginRef(raw);
    assert.equal(got.ok, false);
  });
}

test("extractEnabledPluginRefs returns only exact true refs and skips false silently", () => {
  const got = extractEnabledPluginRefs("user", {
    enabledPlugins: { "a@mp": true, "b@mp": false },
    extraKnownMarketplaces: {},
  });

  assert.deepEqual(
    got.refs.map((ref) => ref.raw),
    ["a@mp"],
  );
  assert.deepEqual(got.diagnostics, []);
});

test("extractEnabledPluginRefs diagnoses non-boolean enabled plugin values", () => {
  const got = extractEnabledPluginRefs("project", {
    enabledPlugins: { "a@mp": "true", "b@mp": 1, "c@mp": null, "d@mp": {} },
    extraKnownMarketplaces: {},
  });

  assert.deepEqual(got.refs, []);
  assert.equal(got.diagnostics.length, 4);
  assert.deepEqual(
    got.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "non-boolean-enabled-plugin",
      "non-boolean-enabled-plugin",
      "non-boolean-enabled-plugin",
      "non-boolean-enabled-plugin",
    ],
  );
});

test("extractEnabledPluginRefs diagnoses malformed refs and continues to valid refs", () => {
  const got = extractEnabledPluginRefs("user", {
    enabledPlugins: { bad: true, "good@mp": true },
    extraKnownMarketplaces: {},
  });

  assert.deepEqual(
    got.refs.map((ref) => ref.raw),
    ["good@mp"],
  );
  assert.equal(got.diagnostics.length, 1);
  assert.equal(got.diagnostics[0]?.code, "malformed-plugin-ref");
  assert.equal(got.diagnostics[0]?.ref, "bad");
});

test("refs.ts stays pure and side-effect free", async () => {
  const source = await readFile(
    new URL(
      "../../../extensions/pi-claude-marketplace/orchestrators/import/refs.ts",
      import.meta.url,
    ),
    "utf8",
  );
  for (const forbidden of [
    "ctx.ui.notify",
    "console.",
    "process.stdout",
    "process.stderr",
    "fetch",
    "readFile",
    "writeFile",
  ]) {
    assert.equal(source.includes(forbidden), false, `refs.ts must not contain ${forbidden}`);
  }
});
