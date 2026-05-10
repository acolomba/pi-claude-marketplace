import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CLAUDE_MARKETPLACE_MARKER_KEY } from "../../../extensions/claude-marketplace/bridges/mcp/marker.ts";
import {
  abortPreparedMcp,
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../../extensions/claude-marketplace/bridges/mcp/stage.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";
import { McpServerCollisionError } from "../../../extensions/claude-marketplace/shared/errors-bridges.ts";

// MC-4 / MC-5 / MC-6 / AS-8 -- prepare/commit/abort.
//
// Project-scope locations resolve to <cwd>/.pi/mcp.json which IS slot[3] of
// MCP_COLLISION_SLOTS. That means cross-slot tests must write to slot[2]
// (<cwd>/.mcp.json), not slot[3], to simulate a foreign declarer in a
// different slot.

interface Ctx {
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
}

async function withTmpScope<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-stage-"));
  const locations = locationsFor("project", cwd);
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const MP = "official";
const PLUGIN = "acme";

// ---------------------------------------------------------------------------
// MC-5 marker stamping
// ---------------------------------------------------------------------------

test("MC-5 prepareStageMcpServers stamps each new entry with _claudeMarketplace marker", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { a: { command: "x" }, b: { command: "y", args: ["--flag"] } },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    const stagedDoc = prepared._nextDoc.mcpServers as Record<string, Record<string, unknown>>;
    assert.deepEqual(stagedDoc.a?.[CLAUDE_MARKETPLACE_MARKER_KEY], {
      plugin: PLUGIN,
      marketplace: MP,
    });
    assert.deepEqual(stagedDoc.b?.[CLAUDE_MARKETPLACE_MARKER_KEY], {
      plugin: PLUGIN,
      marketplace: MP,
    });
    assert.equal(stagedDoc.a?.command, "x");
    assert.deepEqual(stagedDoc.b?.args, ["--flag"]);
  });
});

// ---------------------------------------------------------------------------
// MC-6 commit
// ---------------------------------------------------------------------------

test("MC-6 commitPreparedMcp writes mcp.json atomically with full merged doc", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "node", args: ["server.js"] } },
    });

    const result = await commitPreparedMcp(prepared);
    assert.deepEqual([...result.stagedNames], ["srv"]);
    assert.equal(result.recorded.length, 1);
    assert.equal(result.recorded[0]!.generatedName, "srv");
    assert.equal(result.recorded[0]!.targetPath, locations.mcpJsonPath);

    const text = await readFile(locations.mcpJsonPath, "utf8");
    const onDisk = JSON.parse(text) as { mcpServers: Record<string, Record<string, unknown>> };
    assert.equal(onDisk.mcpServers.srv?.command, "node");
    assert.deepEqual(onDisk.mcpServers.srv?.[CLAUDE_MARKETPLACE_MARKER_KEY], {
      plugin: PLUGIN,
      marketplace: MP,
    });
  });
});

test("MC-6 commitPreparedMcp returns recorded with provided sourcePath (W-05)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "x" } },
      sourcePath: "/plugins/acme/.mcp.json",
    });
    const result = await commitPreparedMcp(prepared);
    assert.equal(result.recorded.length, 1);
    assert.equal(result.recorded[0]!.sourcePath, "/plugins/acme/.mcp.json");
  });
});

test("MC-6 prepareStageMcpServers falls back to synthetic sourcePath when omitted", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "x" } },
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.equal(prepared.result.recorded[0]!.sourcePath, `${PLUGIN}#mcpServers`);
  });
});

// ---------------------------------------------------------------------------
// AS-8 noop
// ---------------------------------------------------------------------------

test("AS-8 prepareStageMcpServers returns kind:'noop' when no new servers AND no previous ours", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: {},
    });
    assert.equal(prepared.kind, "noop");
    assert.deepEqual([...prepared.result.stagedNames], []);
    assert.deepEqual([...prepared.result.recorded], []);
    assert.deepEqual([...prepared.result.warnings], []);
  });
});

test("AS-8 commit on noop does NOT create mcp.json", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: {},
    });
    await commitPreparedMcp(prepared);

    // mcp.json must NOT exist after a noop commit.
    const mcpStat = await stat(locations.mcpJsonPath).catch(() => null);
    assert.equal(mcpStat, null, "AS-8 noop must not materialize mcp.json");
  });
});

test("AS-8 prepare with previous-ours but no new still stages (drops old)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Pre-seed the scoped doc with one of OUR own entries.
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          old: {
            command: "x",
            [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: PLUGIN, marketplace: MP },
          },
        },
      }),
      "utf8",
    );

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: {},
    });

    // Empty `servers` + ours.size > 0 must take the staged branch (drop ours).
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    const stagedDoc = prepared._nextDoc.mcpServers!;
    assert.ok(!("old" in stagedDoc), "old entry must be dropped");

    await commitPreparedMcp(prepared);
    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.deepEqual(onDisk.mcpServers, {});
  });
});

// ---------------------------------------------------------------------------
// MC-4 / RN-5 collision check
// ---------------------------------------------------------------------------

test("MC-4 prepareStageMcpServers throws McpServerCollisionError for foreign entry in OUR scope", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Pre-seed our scoped mcp.json with a foreign-owned entry.
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          dup: {
            command: "x",
            [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "other", marketplace: MP },
          },
        },
      }),
      "utf8",
    );

    await assert.rejects(
      prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: MP,
        pluginName: PLUGIN,
        servers: { dup: { command: "y" } },
      }),
      (err) => {
        assert.ok(
          err instanceof McpServerCollisionError,
          `expected McpServerCollisionError, got ${err instanceof Error ? err.constructor.name : typeof err}`,
        );
        assert.equal(err.serverName, "dup");
        assert.equal(err.owningPath, locations.mcpJsonPath);
        return true;
      },
    );
  });
});

test("MC-4 prepareStageMcpServers throws McpServerCollisionError for entry in DIFFERENT slot", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Slot 2 = <cwd>/.mcp.json -- a different slot than our scope (slot 3).
    const slot2 = path.join(cwd, ".mcp.json");
    await writeFile(slot2, JSON.stringify({ mcpServers: { foreign: { command: "x" } } }), "utf8");

    await assert.rejects(
      prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: MP,
        pluginName: PLUGIN,
        servers: { foreign: { command: "y" } },
      }),
      (err) => {
        assert.ok(err instanceof McpServerCollisionError);
        assert.equal(err.serverName, "foreign");
        assert.equal(err.owningPath, slot2, "owningPath must point at the foreign slot");
        return true;
      },
    );
  });
});

test("MC-4 prepareStageMcpServers ALLOWS self-replace within own scope", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Pre-seed our scoped doc with our OWN entry.
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          srv: {
            command: "old",
            [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: PLUGIN, marketplace: MP },
          },
        },
      }),
      "utf8",
    );

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "new" } },
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    const stagedDoc = prepared._nextDoc.mcpServers as Record<string, Record<string, unknown>>;
    assert.equal(stagedDoc.srv?.command, "new", "self-replace updates command");
    assert.deepEqual(stagedDoc.srv?.[CLAUDE_MARKETPLACE_MARKER_KEY], {
      plugin: PLUGIN,
      marketplace: MP,
    });
  });
});

// ---------------------------------------------------------------------------
// Doc preservation
// ---------------------------------------------------------------------------

test("MC-3 prepare preserves non-mcp top-level fields in mcp.json", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({ customField: "preserve-me", mcpServers: {} }),
      "utf8",
    );

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "x" } },
    });
    await commitPreparedMcp(prepared);

    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      customField: unknown;
      mcpServers: Record<string, unknown>;
    };
    assert.equal(onDisk.customField, "preserve-me");
    assert.ok("srv" in onDisk.mcpServers);
  });
});

// ---------------------------------------------------------------------------
// abort
// ---------------------------------------------------------------------------

test("abortPreparedMcp is a synchronous no-op (staged branch)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { srv: { command: "x" } },
    });

    // Synchronous return path -- no throw, no disk side effect.
    abortPreparedMcp(prepared);

    const mcpStat = await stat(locations.mcpJsonPath).catch(() => null);
    assert.equal(mcpStat, null, "abort must not materialize mcp.json");
  });
});

test("abortPreparedMcp is a synchronous no-op (noop branch)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: {},
    });
    // Synchronous return path -- assert by absence of throw.
    abortPreparedMcp(prepared);
  });
});

// ---------------------------------------------------------------------------
// stagedNames vs recorded parity
// ---------------------------------------------------------------------------

test("stagedNames matches recorded.map(r=>r.generatedName)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      servers: { a: { command: "x" }, b: { command: "y" }, c: { command: "z" } },
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    const result = prepared.result;
    assert.deepEqual(
      [...result.stagedNames],
      result.recorded.map((r) => r.generatedName),
    );
  });
});
