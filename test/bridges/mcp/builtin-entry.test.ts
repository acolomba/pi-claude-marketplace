import assert from "node:assert/strict";
import { test } from "node:test";

import { builtinServerConfig } from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts";

import type { McpSubstitutionContext } from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

const CONTEXT: McpSubstitutionContext = {
  pluginRoot: "/plugins/a$b",
  pluginData: "/data/mp/a",
  projectDir: "/work/project",
  env: { PI_CM_TOKEN: "t$1", PI_CM_HOST: "mcp.example.test" },
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
  assert.strictEqual(
    JSON.stringify(config),
    JSON.stringify({
      command: "/plugins/a$b/server",
      args: ["--project", "/work/project"],
      env: { CLAUDE_PLUGIN_ROOT: "/plugins/a$$b", CLAUDE_PLUGIN_DATA: "/data/mp/a", TOKEN: "t$$1" },
      exposure: "deferred",
    }),
  );
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
  assert.strictEqual(
    JSON.stringify(config),
    JSON.stringify({
      type: "http",
      url: "https://mcp.example.test/mcp",
      headers: { Authorization: "Bearer t$$1" },
      exposure: "direct",
      description: "Demo plugin",
    }),
  );
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
