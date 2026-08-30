import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { deepSubstitute } from "../../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";

describe("deepSubstitute", () => {
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
    const substitutions = new Map<string, string>([
      ["CLAUDE_PLUGIN_ROOT", "/plugin/root"],
      ["CLAUDE_PLUGIN_DATA", "/plugin/data"],
      ["CLAUDE_PROJECT_DIR", "/project/root"],
    ]);
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
    };

    // act
    const substitutedServer = deepSubstitute(server, substitutions);

    // assert
    assert.deepStrictEqual(substitutedServer, expectedServer);
    assert.deepStrictEqual(server, originalServer);
    assert.notStrictEqual(substitutedServer, server);
    assert.ok(typeof substitutedServer === "object" && substitutedServer !== null);
    assert.notStrictEqual((substitutedServer as typeof expectedServer).args, server.args);
    assert.notStrictEqual((substitutedServer as typeof expectedServer).headers, server.headers);
  });

  for (const { description, leaf, bindings, expectedLeaf } of [
    {
      description: "adjacent and repeated tokens",
      leaf: "${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_ROOT}${CLAUDE_PLUGIN_DATA}:${CLAUDE_PROJECT_DIR}",
      bindings: [
        ["CLAUDE_PLUGIN_ROOT", "/root"],
        ["CLAUDE_PLUGIN_DATA", "/data"],
        ["CLAUDE_PROJECT_DIR", "/project"],
      ],
      expectedLeaf: "/root:/root/data:/project",
    },
    {
      description: "known and unknown tokens",
      leaf: "${CLAUDE_PLUGIN_ROOT}/${CLAUDE_SESSION_ID}/${CLAUDE_PROJECT_DIR}",
      bindings: [["CLAUDE_PLUGIN_ROOT", "/root"]],
      expectedLeaf: "/root/${CLAUDE_SESSION_ID}/${CLAUDE_PROJECT_DIR}",
    },
    {
      description: "a replacement containing another recognized token",
      leaf: "${CLAUDE_PLUGIN_ROOT}",
      bindings: [
        ["CLAUDE_PLUGIN_ROOT", "${CLAUDE_PLUGIN_DATA}"],
        ["CLAUDE_PLUGIN_DATA", "/data"],
      ],
      expectedLeaf: "${CLAUDE_PLUGIN_DATA}",
    },
    {
      description: "replacement-pattern and Unicode characters",
      leaf: "${CLAUDE_PLUGIN_DATA}",
      bindings: [["CLAUDE_PLUGIN_DATA", "café-☃-$1-$&-\\path-{value}"]],
      expectedLeaf: "café-☃-$1-$&-\\path-{value}",
    },
  ] satisfies ReadonlyArray<{
    description: string;
    leaf: string;
    bindings: [string, string][];
    expectedLeaf: string;
  }>) {
    test(`substitutes ${description} exactly once`, () => {
      // arrange
      const substitutions = new Map<string, string>(bindings);

      // act
      const substitutedLeaf = deepSubstitute(leaf, substitutions);

      // assert
      assert.strictEqual(substitutedLeaf, expectedLeaf);
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
      const substitutions = new Map<string, string>([["CLAUDE_PLUGIN_ROOT", "/root"]]);

      // act
      const substitutedLeaf = deepSubstitute(leaf, substitutions);

      // assert
      assert.deepStrictEqual(substitutedLeaf, expectedLeaf);
    });
  }

  test("preserves a literal __proto__ key without changing global prototypes", () => {
    // arrange
    const server = JSON.parse(
      '{"__proto__":{"root":"${CLAUDE_PLUGIN_ROOT}"},"keep":"${CLAUDE_PLUGIN_DATA}"}',
    ) as Record<string, unknown>;
    const substitutions = new Map<string, string>([
      ["CLAUDE_PLUGIN_ROOT", "/plugin/root"],
      ["CLAUDE_PLUGIN_DATA", "/plugin/data"],
    ]);
    const expectedServer = JSON.parse(
      '{"__proto__":{"root":"/plugin/root"},"keep":"/plugin/data"}',
    ) as Record<string, unknown>;

    // act
    const substitutedServer = deepSubstitute(server, substitutions);

    // assert
    assert.deepStrictEqual(substitutedServer, expectedServer);
    assert.ok(typeof substitutedServer === "object" && substitutedServer !== null);
    assert.deepStrictEqual(Object.keys(substitutedServer), ["__proto__", "keep"]);
    assert.strictEqual(Object.getPrototypeOf(substitutedServer), Object.prototype);
    assert.strictEqual(({} as Record<string, unknown>).root, undefined);
  });
});
