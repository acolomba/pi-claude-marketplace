import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  parseMcpServers,
  resolvePluginMcpServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  return pluginRoot;
}

describe("parseMcpServers", () => {
  test("returns a complete valid server map unchanged", () => {
    // arrange
    const servers = {
      filesystem: {
        command: "node",
        args: ["filesystem-server.js", "/workspace"],
        env: { LOG_LEVEL: "debug" },
      },
      remote: {
        type: "http",
        url: "https://mcp.example.test/server",
        headers: { authorization: "Bearer token" },
      },
    };
    const expectedServers = {
      filesystem: {
        command: "node",
        args: ["filesystem-server.js", "/workspace"],
        env: { LOG_LEVEL: "debug" },
      },
      remote: {
        type: "http",
        url: "https://mcp.example.test/server",
        headers: { authorization: "Bearer token" },
      },
    };

    // act
    const parsedServers = parseMcpServers(servers, "plugin-manifest mcpServers");

    // assert
    assert.strictEqual(parsedServers, servers);
    assert.deepStrictEqual(parsedServers, expectedServers);
  });

  test("rejects a string reference as an unresolved domain-resolver input", () => {
    // arrange
    const expectedError = {
      constructorName: "TypeError",
      name: "TypeError",
      message:
        'marketplace-entry mcpServers is a string reference ("./config/plugin.mcp.json"); string mcpServers references are resolved by the domain resolver before reaching the mcp bridge.',
    };

    // act
    let thrownError: unknown;
    try {
      parseMcpServers("./config/plugin.mcp.json", "marketplace-entry mcpServers");
    } catch (error) {
      thrownError = error;
    }

    // assert
    assert.ok(thrownError instanceof TypeError);
    assert.deepStrictEqual(
      {
        constructorName: thrownError.constructor.name,
        name: thrownError.name,
        message: thrownError.message,
      },
      expectedError,
    );
  });

  for (const { description, servers } of [
    { description: "undefined", servers: undefined },
    { description: "null", servers: null },
    { description: "a number", servers: 42 },
    { description: "a boolean", servers: false },
    { description: "an array", servers: [{ command: "node" }] },
  ]) {
    test(`rejects ${description} as the server map`, () => {
      // arrange
      const expectedError = {
        constructorName: "Error",
        name: "Error",
        message: "source mcpServers must be an object mapping server names to entries.",
      };

      // act
      let thrownError: unknown;
      try {
        parseMcpServers(servers, "source mcpServers");
      } catch (error) {
        thrownError = error;
      }

      // assert
      assert.ok(thrownError instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: thrownError.constructor.name,
          name: thrownError.name,
          message: thrownError.message,
        },
        expectedError,
      );
    });
  }

  for (const { description, entry } of [
    { description: "a string", entry: "stdio" },
    { description: "a number", entry: 42 },
    { description: "null", entry: null },
    { description: "an array", entry: ["node", "server.js"] },
  ]) {
    test(`rejects ${description} as a server entry`, () => {
      // arrange
      const expectedError = {
        constructorName: "Error",
        name: "Error",
        message: 'source mcpServers: server "invalidServer" must be an object.',
      };

      // act
      let thrownError: unknown;
      try {
        parseMcpServers({ invalidServer: entry }, "source mcpServers");
      } catch (error) {
        thrownError = error;
      }

      // assert
      assert.ok(thrownError instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: thrownError.constructor.name,
          name: thrownError.name,
          message: thrownError.message,
        },
        expectedError,
      );
    });
  }

  for (const { description, serverName, expectedMessage } of [
    {
      description: "an empty server name",
      serverName: " ",
      expectedMessage: 'source mcpServers server name " " must be a non-empty string.',
    },
    {
      description: "a dot server name",
      serverName: ".",
      expectedMessage: 'source mcpServers server name "." must not be "." or "..".',
    },
    {
      description: "a path separator",
      serverName: "../escape",
      expectedMessage:
        'source mcpServers server name "../escape" "../escape" must not contain path separators.',
    },
    {
      description: "an ASCII control character",
      serverName: "server\u0000name",
      expectedMessage:
        'source mcpServers server name "server\u0000name" "server\u0000name" must not contain ASCII control characters.',
    },
  ]) {
    test(`rejects ${description}`, () => {
      // arrange
      const expectedError = {
        constructorName: "Error",
        name: "Error",
        message: expectedMessage,
      };

      // act
      let thrownError: unknown;
      try {
        parseMcpServers({ [serverName]: {} }, "source mcpServers");
      } catch (error) {
        thrownError = error;
      }

      // assert
      assert.ok(thrownError instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: thrownError.constructor.name,
          name: thrownError.name,
          message: thrownError.message,
        },
        expectedError,
      );
    });
  }
});

describe("resolvePluginMcpServers", () => {
  test("prefers the marketplace entry over the manifest and standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-entry-");
    await writeFile(path.join(pluginRoot, ".mcp.json"), "not standalone json", "utf8");
    const expectedResolution = {
      source: "marketplace-entry",
      servers: {
        entryServer: {
          command: "entry-command",
          args: ["--entry"],
          env: { SOURCE: "entry" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {
        mcpServers: {
          entryServer: {
            command: "entry-command",
            args: ["--entry"],
            env: { SOURCE: "entry" },
          },
        },
      },
      manifest: {
        mcpServers: {
          manifestServer: { command: "manifest-command", args: ["--manifest"] },
        },
      },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("prefers the plugin manifest over the standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-manifest-");
    await writeFile(path.join(pluginRoot, ".mcp.json"), "not standalone json", "utf8");
    const expectedResolution = {
      source: "plugin-manifest",
      servers: {
        manifestServer: {
          command: "manifest-command",
          args: ["--manifest"],
          env: { SOURCE: "manifest" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {
        mcpServers: {
          manifestServer: {
            command: "manifest-command",
            args: ["--manifest"],
            env: { SOURCE: "manifest" },
          },
        },
      },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("accepts a wrapped standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-wrapped-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          wrappedServer: {
            command: "wrapped-command",
            args: ["--wrapped"],
            env: { SOURCE: "wrapped" },
          },
        },
      }),
      "utf8",
    );
    const expectedResolution = {
      source: "standalone",
      servers: {
        wrappedServer: {
          command: "wrapped-command",
          args: ["--wrapped"],
          env: { SOURCE: "wrapped" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("accepts an unwrapped standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-unwrapped-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({
        unwrappedServer: {
          command: "unwrapped-command",
          args: ["--unwrapped"],
          env: { SOURCE: "unwrapped" },
        },
      }),
      "utf8",
    );
    const expectedResolution = {
      source: "standalone",
      servers: {
        unwrappedServer: {
          command: "unwrapped-command",
          args: ["--unwrapped"],
          env: { SOURCE: "unwrapped" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("returns none when no declaration exists", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-none-");
    const expectedResolution = { source: "none", servers: {} };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("treats an empty marketplace entry map as present", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-empty-entry-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ standaloneServer: { command: "standalone-command" } }),
      "utf8",
    );
    const expectedResolution = { source: "marketplace-entry", servers: {} };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: { mcpServers: {} },
      manifest: { mcpServers: { manifestServer: { command: "manifest-command" } } },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("treats an empty plugin manifest map as present", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-empty-manifest-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ standaloneServer: { command: "standalone-command" } }),
      "utf8",
    );
    const expectedResolution = { source: "plugin-manifest", servers: {} };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: { mcpServers: {} },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  for (const { description, document } of [
    { description: "an empty wrapped document", document: { mcpServers: {} } },
    { description: "an empty unwrapped document", document: {} },
  ]) {
    test(`returns none for ${description}`, async (t) => {
      // arrange
      const pluginRoot = await createPluginRoot(t, "mcp-parse-empty-standalone-");
      await writeFile(path.join(pluginRoot, ".mcp.json"), JSON.stringify(document), "utf8");
      const expectedResolution = { source: "none", servers: {} };

      // act
      const resolution = await resolvePluginMcpServers({
        entry: {},
        manifest: {},
        pluginRoot,
      });

      // assert
      assert.deepStrictEqual(resolution, expectedResolution);
    });
  }

  test("returns none when the standalone path has a non-directory parent", async (t) => {
    // arrange
    const directory = await createPluginRoot(t, "mcp-parse-not-directory-");
    const pluginRoot = path.join(directory, "plugin-file");
    await writeFile(pluginRoot, "not a directory", "utf8");
    const expectedResolution = { source: "none", servers: {} };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("propagates an ordinary standalone read failure", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-read-failure-");
    const standalonePath = path.join(pluginRoot, ".mcp.json");
    await mkdir(standalonePath);

    // act
    let thrownError: unknown;
    try {
      await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    } catch (error) {
      thrownError = error;
    }

    // assert
    assert.ok(thrownError instanceof Error);
    assert.deepStrictEqual(
      {
        constructorName: thrownError.constructor.name,
        name: thrownError.name,
        code: (thrownError as NodeJS.ErrnoException).code,
        path: (thrownError as NodeJS.ErrnoException).path,
        syscall: (thrownError as NodeJS.ErrnoException).syscall,
      },
      {
        constructorName: "Error",
        name: "Error",
        code: "EISDIR",
        path: undefined,
        syscall: "read",
      },
    );
  });

  test("reports malformed standalone JSON with its syntax error cause", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-malformed-json-");
    const standalonePath = path.join(pluginRoot, ".mcp.json");
    await writeFile(standalonePath, "{", "utf8");
    const expectedSyntaxMessage =
      "Expected property name or '}' in JSON at position 1 (line 1 column 2)";
    const expectedError = {
      constructorName: "Error",
      name: "Error",
      message: `malformed JSON at ${standalonePath}: ${expectedSyntaxMessage}`,
      cause: {
        constructorName: "SyntaxError",
        name: "SyntaxError",
        message: expectedSyntaxMessage,
      },
    };

    // act
    let thrownError: unknown;
    try {
      await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    } catch (error) {
      thrownError = error;
    }

    // assert
    assert.ok(thrownError instanceof Error);
    assert.ok(thrownError.cause instanceof SyntaxError);
    assert.deepStrictEqual(
      {
        constructorName: thrownError.constructor.name,
        name: thrownError.name,
        message: thrownError.message,
        cause: {
          constructorName: thrownError.cause.constructor.name,
          name: thrownError.cause.name,
          message: thrownError.cause.message,
        },
      },
      expectedError,
    );
  });

  for (const { description, document } of [
    { description: "null", document: null },
    { description: "an array", document: [{ command: "node" }] },
    { description: "a string", document: "server" },
    { description: "a number", document: 42 },
  ]) {
    test(`rejects ${description} as the standalone document`, async (t) => {
      // arrange
      const pluginRoot = await createPluginRoot(t, "mcp-parse-invalid-document-");
      const standalonePath = path.join(pluginRoot, ".mcp.json");
      await writeFile(standalonePath, JSON.stringify(document), "utf8");
      const expectedError = {
        constructorName: "Error",
        name: "Error",
        message: `${standalonePath} must be a JSON object.`,
      };

      // act
      let thrownError: unknown;
      try {
        await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
      } catch (error) {
        thrownError = error;
      }

      // assert
      assert.ok(thrownError instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: thrownError.constructor.name,
          name: thrownError.name,
          message: thrownError.message,
        },
        expectedError,
      );
    });
  }

  for (const { description, wrapper } of [
    { description: "null", wrapper: null },
    { description: "an array", wrapper: [{ command: "node" }] },
    { description: "a string", wrapper: "./servers.json" },
  ]) {
    test(`treats ${description} mcpServers wrapper as an invalid unwrapped entry`, async (t) => {
      // arrange
      const pluginRoot = await createPluginRoot(t, "mcp-parse-invalid-wrapper-");
      const standalonePath = path.join(pluginRoot, ".mcp.json");
      await writeFile(standalonePath, JSON.stringify({ mcpServers: wrapper }), "utf8");
      const expectedError = {
        constructorName: "Error",
        name: "Error",
        message: `standalone .mcp.json mcpServers at ${standalonePath}: server "mcpServers" must be an object.`,
      };

      // act
      let thrownError: unknown;
      try {
        await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
      } catch (error) {
        thrownError = error;
      }

      // assert
      assert.ok(thrownError instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: thrownError.constructor.name,
          name: thrownError.name,
          message: thrownError.message,
        },
        expectedError,
      );
    });
  }

  test("rejects a malformed marketplace entry without falling through", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-malformed-entry-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ standaloneServer: { command: "standalone-command" } }),
      "utf8",
    );
    const expectedError = {
      constructorName: "Error",
      name: "Error",
      message: "marketplace-entry mcpServers must be an object mapping server names to entries.",
    };

    // act
    let thrownError: unknown;
    try {
      await resolvePluginMcpServers({
        entry: { mcpServers: ["invalid-entry"] },
        manifest: { mcpServers: { manifestServer: { command: "manifest-command" } } },
        pluginRoot,
      });
    } catch (error) {
      thrownError = error;
    }

    // assert
    assert.ok(thrownError instanceof Error);
    assert.deepStrictEqual(
      {
        constructorName: thrownError.constructor.name,
        name: thrownError.name,
        message: thrownError.message,
      },
      expectedError,
    );
  });

  test("rejects a malformed plugin manifest without falling through", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-malformed-manifest-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ standaloneServer: { command: "standalone-command" } }),
      "utf8",
    );
    const expectedError = {
      constructorName: "TypeError",
      name: "TypeError",
      message:
        'plugin-manifest mcpServers is a string reference ("./manifest-servers.json"); string mcpServers references are resolved by the domain resolver before reaching the mcp bridge.',
    };

    // act
    let thrownError: unknown;
    try {
      await resolvePluginMcpServers({
        entry: {},
        manifest: { mcpServers: "./manifest-servers.json" },
        pluginRoot,
      });
    } catch (error) {
      thrownError = error;
    }

    // assert
    assert.ok(thrownError instanceof TypeError);
    assert.deepStrictEqual(
      {
        constructorName: thrownError.constructor.name,
        name: thrownError.name,
        message: thrownError.message,
      },
      expectedError,
    );
  });
});
