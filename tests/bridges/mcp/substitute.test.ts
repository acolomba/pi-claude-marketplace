import assert from "node:assert/strict";
import { test } from "node:test";

import {
  substituteAndInject,
  type McpSubstitutionContext,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

test("substitutes every string leaf while preserving complete source structure", () => {
  // arrange
  const server = {
    "${CLAUDE_PLUGIN_ROOT}": "${CLAUDE_PLUGIN_DATA}/key-value",
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: [
      "--data",
      "${CLAUDE_PLUGIN_DATA}/state",
      { project: "${CLAUDE_PROJECT_DIR}", enabled: true },
    ],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: {
      Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}",
      nested: { root: "${CLAUDE_PLUGIN_ROOT}" },
    },
    retries: 3,
    disabled: false,
    nullable: null,
  };
  const originalServer = {
    "${CLAUDE_PLUGIN_ROOT}": "${CLAUDE_PLUGIN_DATA}/key-value",
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: [
      "--data",
      "${CLAUDE_PLUGIN_DATA}/state",
      { project: "${CLAUDE_PROJECT_DIR}", enabled: true },
    ],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: {
      Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}",
      nested: { root: "${CLAUDE_PLUGIN_ROOT}" },
    },
    retries: 3,
    disabled: false,
    nullable: null,
  };
  const context: McpSubstitutionContext = {
    pluginRoot: "/plugin/root",
    pluginData: "/plugin/data",
    projectDir: "/project/root",
  };
  const expectedServer = {
    "${CLAUDE_PLUGIN_ROOT}": "/plugin/data/key-value",
    command: "/plugin/root/bin/server",
    args: ["--data", "/plugin/data/state", { project: "/project/root", enabled: true }],
    cwd: "/project/root",
    headers: {
      Authorization: "Bearer /plugin/data",
      nested: { root: "/plugin/root" },
    },
    retries: 3,
    disabled: false,
    nullable: null,
    env: {
      CLAUDE_PLUGIN_ROOT: "/plugin/root",
      CLAUDE_PLUGIN_DATA: "/plugin/data",
      CLAUDE_PROJECT_DIR: "/project/root",
    },
  };

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
  assert.deepStrictEqual(server, originalServer);
  assert.notStrictEqual(substitutedServer, server);
  assert.ok(typeof substitutedServer === "object" && substitutedServer !== null);
  assert.notStrictEqual(substitutedServer.args, server.args);
  assert.notStrictEqual(substitutedServer.headers, server.headers);
});

for (const { description, leaf, context, expectedLeaf } of [
  {
    description: "adjacent and repeated tokens",
    leaf: "${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_ROOT}${CLAUDE_PLUGIN_DATA}:${CLAUDE_PROJECT_DIR}",
    context: { pluginRoot: "/root", pluginData: "/data", projectDir: "/project" },
    expectedLeaf: "/root:/root/data:/project",
  },
  {
    description: "known and unknown tokens",
    leaf: "${CLAUDE_PLUGIN_ROOT}/${CLAUDE_SESSION_ID}/${CLAUDE_PROJECT_DIR}",
    context: { pluginRoot: "/root", pluginData: "/data", projectDir: undefined },
    expectedLeaf: "/root/${CLAUDE_SESSION_ID}/${CLAUDE_PROJECT_DIR}",
  },
  {
    description: "a replacement containing another recognized token",
    leaf: "${CLAUDE_PLUGIN_ROOT}",
    context: { pluginRoot: "${CLAUDE_PLUGIN_DATA}", pluginData: "/data", projectDir: undefined },
    expectedLeaf: "${CLAUDE_PLUGIN_DATA}",
  },
  {
    description: "replacement-pattern and Unicode characters",
    leaf: "${CLAUDE_PLUGIN_DATA}",
    context: {
      pluginRoot: "/root",
      pluginData: "café-☃-$1-$&-\\path-{value}",
      projectDir: undefined,
    },
    expectedLeaf: "café-☃-$1-$&-\\path-{value}",
  },
] satisfies ReadonlyArray<{
  description: string;
  leaf: string;
  context: McpSubstitutionContext;
  expectedLeaf: string;
}>) {
  test(`substitutes ${description} exactly once`, () => {
    // arrange
    const server = { leaf };

    // act
    const substitutedServer = substituteAndInject(server, context);

    // assert
    assert.deepStrictEqual(substitutedServer, { leaf: expectedLeaf });
  });
}

for (const { description, leaf, expectedLeaf } of [
  { description: "an empty string", leaf: "", expectedLeaf: "" },
  { description: "a number", leaf: 42, expectedLeaf: 42 },
  { description: "a boolean", leaf: false, expectedLeaf: false },
  { description: "null", leaf: null, expectedLeaf: null },
  { description: "undefined", leaf: undefined, expectedLeaf: undefined },
]) {
  test(`preserves ${description}`, () => {
    // arrange
    const server = { leaf };
    const context: McpSubstitutionContext = {
      pluginRoot: "/root",
      pluginData: "/data",
      projectDir: undefined,
    };

    // act
    const substitutedServer = substituteAndInject(server, context);

    // assert
    assert.deepStrictEqual(substitutedServer, { leaf: expectedLeaf });
  });
}

test("preserves a literal __proto__ key without changing global prototypes", () => {
  // arrange
  const server = JSON.parse(
    '{"__proto__":{"root":"${CLAUDE_PLUGIN_ROOT}"},"keep":"${CLAUDE_PLUGIN_DATA}"}',
  ) as Record<string, unknown>;
  const context: McpSubstitutionContext = {
    pluginRoot: "/plugin/root",
    pluginData: "/plugin/data",
    projectDir: undefined,
  };
  const expectedServer = JSON.parse(
    '{"__proto__":{"root":"/plugin/root"},"keep":"/plugin/data"}',
  ) as Record<string, unknown>;

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
  assert.ok(typeof substitutedServer === "object" && substitutedServer !== null);
  assert.deepStrictEqual(Object.keys(substitutedServer), ["__proto__", "keep"]);
  assert.strictEqual(Object.getPrototypeOf(substitutedServer), Object.prototype);
  assert.strictEqual(({} as Record<string, unknown>).root, undefined);
});

test("substitutes a project server and lets declared environment keys win", () => {
  // arrange
  const server = {
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: [
      "--root=${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_ROOT}",
      "--data=${CLAUDE_PLUGIN_DATA}",
      "--project=${CLAUDE_PROJECT_DIR}",
      "--session=${CLAUDE_SESSION_ID}",
    ],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: {
      Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}",
      "X-Plugin-Root": "${CLAUDE_PLUGIN_ROOT}",
    },
    env: {
      CLAUDE_PLUGIN_ROOT: "declared-root",
      TOKEN_PATH: "${CLAUDE_PLUGIN_DATA}/token",
      UNKNOWN_TOKEN: "${CLAUDE_SESSION_ID}",
    },
    enabled: true,
  };
  const originalServer = {
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: [
      "--root=${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_ROOT}",
      "--data=${CLAUDE_PLUGIN_DATA}",
      "--project=${CLAUDE_PROJECT_DIR}",
      "--session=${CLAUDE_SESSION_ID}",
    ],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: {
      Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}",
      "X-Plugin-Root": "${CLAUDE_PLUGIN_ROOT}",
    },
    env: {
      CLAUDE_PLUGIN_ROOT: "declared-root",
      TOKEN_PATH: "${CLAUDE_PLUGIN_DATA}/token",
      UNKNOWN_TOKEN: "${CLAUDE_SESSION_ID}",
    },
    enabled: true,
  };
  const context = {
    pluginRoot: "/plugin/root",
    pluginData: "/plugin/data",
    projectDir: "/project/root",
  } satisfies McpSubstitutionContext;
  const expectedServer = {
    command: "/plugin/root/bin/server",
    args: [
      "--root=/plugin/root:/plugin/root",
      "--data=/plugin/data",
      "--project=/project/root",
      "--session=${CLAUDE_SESSION_ID}",
    ],
    cwd: "/project/root",
    headers: {
      Authorization: "Bearer /plugin/data",
      "X-Plugin-Root": "/plugin/root",
    },
    env: {
      CLAUDE_PLUGIN_ROOT: "declared-root",
      CLAUDE_PLUGIN_DATA: "/plugin/data",
      CLAUDE_PROJECT_DIR: "/project/root",
      TOKEN_PATH: "/plugin/data/token",
      UNKNOWN_TOKEN: "${CLAUDE_SESSION_ID}",
    },
    enabled: true,
  };

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
  assert.deepStrictEqual(server, originalServer);
  assert.notStrictEqual(substitutedServer, server);
  assert.notStrictEqual(substitutedServer.args, server.args);
  assert.notStrictEqual(substitutedServer.headers, server.headers);
  assert.notStrictEqual(substitutedServer.env, server.env);
});

test("leaves project tokens unresolved and omits project injection for user scope", () => {
  // arrange
  const server = {
    command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
    args: ["--project=${CLAUDE_PROJECT_DIR}"],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: { Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}" },
  };
  const context = {
    pluginRoot: "/user/plugin/root",
    pluginData: "/user/plugin/data",
    projectDir: undefined,
  } satisfies McpSubstitutionContext;
  const expectedServer = {
    command: "/user/plugin/root/bin/server",
    args: ["--project=${CLAUDE_PROJECT_DIR}"],
    cwd: "${CLAUDE_PROJECT_DIR}",
    headers: { Authorization: "Bearer /user/plugin/data" },
    env: {
      CLAUDE_PLUGIN_ROOT: "/user/plugin/root",
      CLAUDE_PLUGIN_DATA: "/user/plugin/data",
    },
  };

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
});

test("substitutes a URL server without injecting environment defaults", () => {
  // arrange
  const server = {
    url: "https://mcp.test/${CLAUDE_PLUGIN_ROOT}/sse",
    headers: { Authorization: "Bearer ${CLAUDE_PLUGIN_DATA}" },
    env: { TOKEN_PATH: "${CLAUDE_PLUGIN_DATA}/token" },
  };
  const context = {
    pluginRoot: "plugin-root",
    pluginData: "plugin-data",
    projectDir: "/project/root",
  } satisfies McpSubstitutionContext;
  const expectedServer = {
    url: "https://mcp.test/plugin-root/sse",
    headers: { Authorization: "Bearer plugin-data" },
    env: { TOKEN_PATH: "plugin-data/token" },
  };

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
});

test("does not re-expand substituted context values", () => {
  // arrange
  const server = {
    command: "${CLAUDE_PLUGIN_ROOT}",
    env: { DECLARED_ROOT: "${CLAUDE_PLUGIN_ROOT}" },
  };
  const context = {
    pluginRoot: "${CLAUDE_PLUGIN_DATA}",
    pluginData: "/plugin/data",
    projectDir: undefined,
  } satisfies McpSubstitutionContext;
  const expectedServer = {
    command: "${CLAUDE_PLUGIN_DATA}",
    env: {
      CLAUDE_PLUGIN_ROOT: "${CLAUDE_PLUGIN_DATA}",
      CLAUDE_PLUGIN_DATA: "/plugin/data",
      DECLARED_ROOT: "${CLAUDE_PLUGIN_DATA}",
    },
  };

  // act
  const substitutedServer = substituteAndInject(server, context);

  // assert
  assert.deepStrictEqual(substitutedServer, expectedServer);
});
