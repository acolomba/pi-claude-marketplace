import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Compile } from "typebox/compile";

import {
  MCP_SERVER_MAP_VALIDATOR,
  MCP_SERVERS_SCHEMA,
} from "../../../extensions/pi-claude-marketplace/domain/components/mcp.ts";

describe("MCP_SERVERS_SCHEMA", () => {
  test("D-CF6-01: describes a server map or an array of references and server maps", () => {
    // arrange
    const serverMap = { type: "object", patternProperties: { "^.*$": {} } };
    const expectedSchema = {
      anyOf: [serverMap, { type: "array", items: { anyOf: [{ type: "string" }, serverMap] } }],
    };

    // act
    const schema = MCP_SERVERS_SCHEMA;

    // assert
    assert.deepStrictEqual(schema, expectedSchema);
  });

  for (const { description, mcpServers } of [
    { description: "a server map", mcpServers: { local: { command: "node" } } },
    { description: "an empty array", mcpServers: [] },
    {
      description: "an array of references and server maps",
      mcpServers: ["./a.json", { y: { command: "node" } }, "./b.json"],
    },
  ]) {
    test(`D-CF6-01: accepts ${description} as a declaration`, () => {
      // arrange
      const declarationValidator = Compile(MCP_SERVERS_SCHEMA);

      // act
      const isValid = declarationValidator.Check(mcpServers);

      // assert
      assert.strictEqual(isValid, true);
    });
  }

  for (const { description, mcpServers } of [
    { description: "null", mcpServers: null },
    { description: "a number", mcpServers: 42 },
    { description: "a boolean", mcpServers: false },
    { description: "an array holding a number", mcpServers: ["./a.json", 1] },
    { description: "an array holding an array", mcpServers: [[]] },
  ]) {
    test(`D-CF6-01: refuses ${description} as a declaration`, () => {
      // arrange
      const declarationValidator = Compile(MCP_SERVERS_SCHEMA);

      // act
      const isValid = declarationValidator.Check(mcpServers);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});

describe("MCP_SERVER_MAP_VALIDATOR", () => {
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
      const parsedMcpServers = MCP_SERVER_MAP_VALIDATOR.Parse(mcpServers);

      // assert
      assert.deepStrictEqual(parsedMcpServers, expectedMcpServers);
    });
  }

  for (const { description, servers } of [
    { description: "null", servers: null },
    { description: "an empty array", servers: [] },
    { description: "a non-empty array", servers: [{}] },
    { description: "a string", servers: "server" },
    { description: "a number", servers: 42 },
    { description: "a boolean", servers: false },
  ]) {
    test(`rejects ${description}`, () => {
      // arrange
      const mcpServers = servers;

      // act
      const parseMcpServers = () => MCP_SERVER_MAP_VALIDATOR.Parse(mcpServers);

      // assert
      assert.throws(parseMcpServers, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          {
            constructorName: error.constructor.name,
            name: error.name,
            message: error.message,
          },
          {
            constructorName: "ParseError",
            name: "Error",
            message: "Parse",
          },
        );
        return true;
      });
    });
  }

  test("reports a non-object value as must be object", () => {
    // arrange
    const mcpServers = ["invalid"];

    // act
    const messages = MCP_SERVER_MAP_VALIDATOR.Errors(mcpServers).map((error) => error.message);

    // assert
    assert.deepStrictEqual(messages, ["must be object"]);
  });
});
