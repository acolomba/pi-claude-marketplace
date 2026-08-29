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
  for (const { description, servers, expectedServers } of [
    {
      description: "an empty record",
      servers: {},
      expectedServers: {},
    },
    {
      description: "a record with arbitrary values",
      servers: {
        nested: { command: "node", args: ["server.js"] },
        scalar: "opaque",
        list: [1, 2],
        disabled: false,
        nil: null,
      },
      expectedServers: {
        nested: { command: "node", args: ["server.js"] },
        scalar: "opaque",
        list: [1, 2],
        disabled: false,
        nil: null,
      },
    },
  ]) {
    test(`parses ${description}`, () => {
      // arrange
      const mcpServers = servers;
      const expectedMcpServers = expectedServers;

      // act
      const parsedMcpServers = MCP_SERVERS_VALIDATOR.Parse(mcpServers);

      // assert
      assert.deepStrictEqual(parsedMcpServers, expectedMcpServers);
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
