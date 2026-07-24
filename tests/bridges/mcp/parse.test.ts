import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseMcpServers,
  resolvePluginMcpServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";

// MC-1 / MC-2 / MC-3 -- precedence chain, wrapped vs unwrapped, shape validation.

async function withTmpPluginRoot<T>(fn: (pluginRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcp-parse-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// MC-3 ------------------------------------------------------------------

test("MC-3 parseMcpServers throws when value is not an object", () => {
  assert.throws(() => {
    parseMcpServers(null, "lbl");
  }, /must be an object/);
  assert.throws(() => {
    parseMcpServers(42, "lbl");
  }, /must be an object/);
});

test("MCPR-01 parseMcpServers rejects a string as an unresolved reference (not a malformed shape)", () => {
  // A string mcpServers is a reference resolved upstream by the domain
  // resolver; reaching the bridge with one is a wiring error, so the message
  // must point at the resolver, not read as a generic "must be an object".
  assert.throws(() => {
    parseMcpServers("./config/x.mcp.json", "marketplace-entry mcpServers");
  }, /string reference.*resolved by the domain resolver/);
});

test("MC-3 parseMcpServers throws when value is array", () => {
  assert.throws(() => {
    parseMcpServers(["x"], "lbl");
  }, /must be an object/);
});

test("MC-3 parseMcpServers throws when entry value is not an object", () => {
  assert.throws(() => {
    parseMcpServers({ a: "string" }, "lbl");
  }, /server "a" must be an object/);
  assert.throws(() => {
    parseMcpServers({ a: 1 }, "lbl");
  }, /server "a" must be an object/);
  assert.throws(() => {
    parseMcpServers({ a: null }, "lbl");
  }, /server "a" must be an object/);
  assert.throws(() => {
    parseMcpServers({ a: ["x"] }, "lbl");
  }, /server "a" must be an object/);
});

test("MC-3 parseMcpServers throws when name fails assertSafeName", () => {
  // Path separator -> assertSafeName rejects.
  assert.throws(() => {
    parseMcpServers({ "../x": {} }, "lbl");
  }, /must not contain path separators/);
  // Empty after trim.
  assert.throws(() => {
    parseMcpServers({ " ": {} }, "lbl");
  }, /must be a non-empty string/);
  // ASCII control char.
  assert.throws(() => {
    parseMcpServers({ "a\x00b": {} }, "lbl");
  }, /must not contain ASCII control characters/);
});

test("MC-3 parseMcpServers returns map when all entries valid", () => {
  const out = parseMcpServers({ "a-b": { command: "x" }, c: {} }, "lbl");
  assert.deepEqual(Object.keys(out).sort(), ["a-b", "c"]);
});

// MC-1 precedence ------------------------------------------------------

test("MC-1 resolvePluginMcpServers picks marketplace-entry when present", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    const out = await resolvePluginMcpServers({
      entry: { mcpServers: { a: { command: "x" } } },
      manifest: { mcpServers: { b: { command: "y" } } },
      pluginRoot,
    });
    assert.equal(out.source, "marketplace-entry");
    assert.deepEqual(Object.keys(out.servers), ["a"]);
  });
});

test("MC-1 resolvePluginMcpServers picks plugin-manifest when entry absent", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    const out = await resolvePluginMcpServers({
      entry: {},
      manifest: { mcpServers: { b: { command: "y" } } },
      pluginRoot,
    });
    assert.equal(out.source, "plugin-manifest");
    assert.deepEqual(Object.keys(out.servers), ["b"]);
  });
});

test("MC-1 resolvePluginMcpServers picks standalone .mcp.json when both absent", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { c: { command: "z" } } }),
      "utf8",
    );
    const out = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });
    assert.equal(out.source, "standalone");
    assert.deepEqual(Object.keys(out.servers), ["c"]);
  });
});

test("MC-1 resolvePluginMcpServers returns source:'none' when all three absent", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    const out = await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    assert.equal(out.source, "none");
    assert.deepEqual(out.servers, {});
  });
});

test("MC-1 resolvePluginMcpServers throws when entry.mcpServers is malformed (no fallthrough)", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await assert.rejects(
      resolvePluginMcpServers({
        entry: { mcpServers: ["not-object"] },
        manifest: { mcpServers: { b: {} } },
        pluginRoot,
      }),
      /marketplace-entry mcpServers must be an object/,
    );
  });
});

test("MC-1 resolvePluginMcpServers throws when manifest.mcpServers is malformed (no fallthrough to standalone)", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    // Pre-seed a valid standalone -- if the precedence chain falls through
    // (the bug), this would succeed instead of throwing.
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { c: {} } }),
      "utf8",
    );
    await assert.rejects(
      resolvePluginMcpServers({
        entry: {},
        manifest: { mcpServers: ["array-not-object"] },
        pluginRoot,
      }),
      /plugin-manifest mcpServers must be an object/,
    );
  });
});

// MC-2 wrapped vs unwrapped -------------------------------------------

test("MC-2 standalone parse accepts wrapped form {mcpServers: {...}}", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { wrapped: { command: "x" } } }),
      "utf8",
    );
    const out = await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    assert.equal(out.source, "standalone");
    assert.deepEqual(Object.keys(out.servers), ["wrapped"]);
  });
});

test("MC-2 standalone parse accepts unwrapped form {server-name: {...}}", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ unwrapped: { command: "y" } }),
      "utf8",
    );
    const out = await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    assert.equal(out.source, "standalone");
    assert.deepEqual(Object.keys(out.servers), ["unwrapped"]);
  });
});

test("MC-1 resolvePluginMcpServers throws on standalone JSON parse failure", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await writeFile(path.join(pluginRoot, ".mcp.json"), "not json {{", "utf8");
    await assert.rejects(
      resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot }),
      /malformed JSON at .*\.mcp\.json/,
    );
  });
});

test("MC-1 resolvePluginMcpServers returns 'none' for empty wrapped doc", async () => {
  await withTmpPluginRoot(async (pluginRoot) => {
    await writeFile(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");
    const out = await resolvePluginMcpServers({ entry: {}, manifest: {}, pluginRoot });
    assert.equal(out.source, "none");
    assert.deepEqual(out.servers, {});
  });
});
