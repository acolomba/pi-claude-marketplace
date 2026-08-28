import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MCP_SERVERS_SCHEMA,
  MCP_SERVERS_VALIDATOR,
} from "../../../extensions/pi-claude-marketplace/domain/components/mcp.ts";

describe("MCP_SERVERS_SCHEMA", () => {
  test("describes a string-keyed object with unknown values", () => {
    // arrange
    const expectedSchema = {
      type: "object",
      patternProperties: { "^.*$": {} },
    };

    // act
    const schema = MCP_SERVERS_SCHEMA;

    // assert
    assert.deepStrictEqual(schema, expectedSchema);
  });
});

describe("MCP_SERVERS_VALIDATOR", () => {
  for (const servers of [
    {},
    { local: { command: "node", args: ["server.js"] } },
    { nil: null, scalar: "opaque", list: [1, 2] },
  ]) {
    test(`accepts ${JSON.stringify(servers)}`, () => {
      // arrange
      const mcpServers = servers;

      // act
      const isValid = MCP_SERVERS_VALIDATOR.Check(mcpServers);

      // assert
      assert.strictEqual(isValid, true);
    });
  }

  for (const servers of [null, [], "server", 42]) {
    test(`rejects ${JSON.stringify(servers)}`, () => {
      // arrange
      const mcpServers = servers;

      // act
      const isValid = MCP_SERVERS_VALIDATOR.Check(mcpServers);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});
