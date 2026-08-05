import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CLAUDE_MARKETPLACE_MARKER_KEY } from "../../../extensions/pi-claude-marketplace/bridges/mcp/marker.ts";
import {
  abortPreparedMcp,
  commitPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { McpServerCollisionError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

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

/**
 * User-scope fixture. `locationsFor("user", …)` resolves scopeRoot to
 * `getAgentDir()`, which honors PI_CODING_AGENT_DIR -- so point it at a tmp
 * dir for the duration of the test to keep the user-scope mcp.json hermetic
 * (never touch the real agent dir). The env var must stay set through the
 * prepare call too, since the collision-slot walk re-reads getAgentDir().
 */
async function withTmpUserScope<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-stage-cwd-"));
  const agentDir = await mkdtemp(path.join(os.tmpdir(), "mcp-stage-agent-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    const locations = locationsFor("user", cwd);
    return await fn({ cwd, locations });
  } finally {
    if (previous === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previous;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
}

const MP = "official";
const PLUGIN = "acme";
const PLUGIN_ROOT = "/plugins/acme";
const PLUGIN_DATA = "/data/acme";

interface CommittedServer {
  command?: string;
  url?: string;
  env?: Record<string, string>;
  [k: string]: unknown;
}

/** Read the committed mcp.json and return its mcpServers map. */
async function readCommittedServers(mcpJsonPath: string): Promise<Record<string, CommittedServer>> {
  const onDisk = JSON.parse(await readFile(mcpJsonPath, "utf8")) as {
    mcpServers: Record<string, CommittedServer>;
  };
  return onDisk.mcpServers;
}

// ---------------------------------------------------------------------------
// MC-5 marker stamping
// ---------------------------------------------------------------------------

test("MC-5 prepareStageMcpServers stamps each new entry with _piClaudeMarketplace marker", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
// MENV-01/02 end-to-end substitution + injection
// ---------------------------------------------------------------------------

test("MENV-01 prepareStageMcpServers substitutes ${CLAUDE_PLUGIN_ROOT} and injects env end-to-end", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: {
        srv: {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
          args: ["--data", "${CLAUDE_PLUGIN_DATA}"],
        },
      },
    });

    await commitPreparedMcp(prepared);

    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      mcpServers: Record<
        string,
        {
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          [k: string]: unknown;
        }
      >;
    };
    const srv = onDisk.mcpServers.srv!;
    assert.equal(srv.command, `${PLUGIN_ROOT}/bin/server`);
    assert.equal(srv.args?.[1], PLUGIN_DATA);
    assert.equal(srv.env?.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
    assert.equal(srv.env?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);
    // Project scope injects CLAUDE_PROJECT_DIR = cwd (MENV-03).
    assert.equal(srv.env?.CLAUDE_PROJECT_DIR, cwd);
    // Marker survives the substitution/injection pass intact.
    assert.deepEqual(srv[CLAUDE_MARKETPLACE_MARKER_KEY], {
      plugin: PLUGIN,
      marketplace: MP,
    });
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
        pluginRoot: PLUGIN_ROOT,
        pluginData: PLUGIN_DATA,
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
        pluginRoot: PLUGIN_ROOT,
        pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
// replacement rollback
// ---------------------------------------------------------------------------

test("PRL-10 replacePreparedMcp rollback restores previous mcp.json bytes", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    const previous = '{"customField":"keep-shape","mcpServers":{"old":{"command":"old"}}}\n';
    await writeFile(locations.mcpJsonPath, previous, "utf8");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "new" } },
    });

    const replacement = await replacePreparedMcp(prepared);
    const replaced = await readFile(locations.mcpJsonPath, "utf8");
    assert.notEqual(replaced, previous);
    assert.ok(replaced.includes("srv"));

    const leaks = await rollbackMcpReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await readFile(locations.mcpJsonPath, "utf8"), previous);
  });
});

test("PRL-10 replacePreparedMcp rollback removes newly-created mcp.json when absent before", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "new" } },
    });

    const replacement = await replacePreparedMcp(prepared);
    assert.ok(await stat(locations.mcpJsonPath));

    const leaks = await rollbackMcpReplacement(replacement);
    assert.deepEqual([...leaks], []);
    const mcpStat = await stat(locations.mcpJsonPath).catch(() => null);
    assert.equal(mcpStat, null);
  });
});

test("PRL-10 noop MCP replacements rollback and finalize without leaks", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: {},
    });

    const replacement = await replacePreparedMcp(prepared);
    assert.equal(replacement.kind, "noop");
    assert.deepEqual([...(await rollbackMcpReplacement(replacement))], []);
    assert.deepEqual([...finalizeMcpReplacement(replacement)], []);
  });
});

test("PRL-10 replacePreparedMcp preserves prepare-owned MCP collision policy", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
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
        pluginRoot: PLUGIN_ROOT,
        pluginData: PLUGIN_DATA,
        servers: { dup: { command: "y" } },
      }),
      McpServerCollisionError,
    );
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
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

// ---------------------------------------------------------------------------
// MENV-02 / D-92-02 -- stdio env injection targeting + declared-wins precedence
// ---------------------------------------------------------------------------

test("MENV-02 stdio env carries CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "node", args: ["server.js"] } },
    });
    await commitPreparedMcp(prepared);

    const srv = (await readCommittedServers(locations.mcpJsonPath)).srv!;
    assert.equal(srv.env?.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
    assert.equal(srv.env?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);
    // Injected-first order: the two plugin keys lead the env map.
    assert.deepEqual(Object.keys(srv.env).slice(0, 2), [
      "CLAUDE_PLUGIN_ROOT",
      "CLAUDE_PLUGIN_DATA",
    ]);
  });
});

test("MENV-02 plugin-declared env key wins over injected default", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: {
        // Declares a literal override of an injected key plus a custom key
        // that references an injected var (proves substitution still runs).
        override: {
          command: "x",
          env: { CLAUDE_PLUGIN_ROOT: "/plugin/override", CUSTOM: "${CLAUDE_PLUGIN_DATA}/c" },
        },
        // Declares the same key with a value that itself carries the token --
        // substitution resolves it AND the declared key still wins.
        substituted: {
          command: "y",
          env: { CLAUDE_PLUGIN_ROOT: "${CLAUDE_PLUGIN_ROOT}/x" },
        },
      },
    });
    await commitPreparedMcp(prepared);

    const servers = await readCommittedServers(locations.mcpJsonPath);
    const override = servers.override!;
    // Declared literal wins over the injected default; the key appears once.
    assert.equal(override.env?.CLAUDE_PLUGIN_ROOT, "/plugin/override");
    assert.equal(Object.keys(override.env).filter((k) => k === "CLAUDE_PLUGIN_ROOT").length, 1);
    // CLAUDE_PLUGIN_DATA (not declared) is still injected; CUSTOM is substituted.
    assert.equal(override.env?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);
    assert.equal(override.env?.CUSTOM, `${PLUGIN_DATA}/c`);

    // Declared value carrying the token is substituted, and still wins the key.
    assert.equal(servers.substituted!.env?.CLAUDE_PLUGIN_ROOT, `${PLUGIN_ROOT}/x`);
  });
});

test("MENV-02 stdio entry without env gains injected keys; malformed env treated as absent", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: {
        empty: { command: "x", env: {} },
        // Non-object env is treated as absent -- injected keys still land.
        bad: { command: "y", env: "not-an-object" },
      },
    });
    await commitPreparedMcp(prepared);

    const servers = await readCommittedServers(locations.mcpJsonPath);
    assert.equal(servers.empty!.env?.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
    assert.equal(servers.empty!.env?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);

    const badEnv = servers.bad!.env;
    assert.equal(typeof badEnv, "object");
    assert.equal(badEnv?.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
    assert.equal(badEnv?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);
  });
});

test("D-92-02 url-type entry keeps declared env untouched and gains no env; string values still substituted", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: {
        // No command -> url-type. String value is substituted, but no env synthesized.
        urlNoEnv: { url: "https://x/${CLAUDE_PLUGIN_ROOT}" },
        // Declared env on a url-type entry is preserved verbatim (no injection).
        urlWithEnv: { url: "https://y", env: { TOKEN: "abc" } },
      },
    });
    await commitPreparedMcp(prepared);

    const servers = await readCommittedServers(locations.mcpJsonPath);
    const urlNoEnv = servers.urlNoEnv!;
    assert.equal(urlNoEnv.url, `https://x/${PLUGIN_ROOT}`);
    assert.equal("env" in urlNoEnv, false, "url-type entry must not gain a synthesized env");

    const urlWithEnv = servers.urlWithEnv!;
    assert.equal(urlWithEnv.url, "https://y");
    assert.deepEqual(urlWithEnv.env, { TOKEN: "abc" });
  });
});

// ---------------------------------------------------------------------------
// Staging warnings -- silent normalizations surface on result.warnings
// ---------------------------------------------------------------------------

test("staging warnings: malformed declared env on a stdio entry surfaces a warning", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { bad: { command: "y", env: "not-an-object" } },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepEqual(
      [...prepared.result.warnings],
      ['mcp server "bad": declared env is not an object; it was ignored (injected defaults only)'],
    );
  });
});

test("staging warnings: non-object server entry surfaces a warning and stages as an empty entry", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { broken: "just-a-string" },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepEqual(
      [...prepared.result.warnings],
      ['mcp server "broken": entry is not an object; staged as an empty entry'],
    );

    // The existing `{}` tolerance is unchanged: the entry still commits as an
    // empty (marker-stamped) object.
    await commitPreparedMcp(prepared);
    const broken = (await readCommittedServers(locations.mcpJsonPath)).broken!;
    assert.deepEqual(Object.keys(broken), [CLAUDE_MARKETPLACE_MARKER_KEY]);
  });
});

test("staging warnings: a pre-existing malformed mcp.json surfaces a replacement warning on the staged branch", async () => {
  // Unparseable JSON.
  await withTmpScope(async ({ cwd, locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, "{ not valid json", "utf8");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { a: { command: "x" } },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepEqual(
      [...prepared.result.warnings],
      [
        `existing mcp.json at ${locations.mcpJsonPath} is malformed; it will be replaced (non-plugin entries in it are lost)`,
      ],
    );
  });

  // Non-object top level (array) is the same malformed arm.
  await withTmpScope(async ({ cwd, locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, JSON.stringify(["not", "an", "object"]), "utf8");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { a: { command: "x" } },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepEqual(
      [...prepared.result.warnings],
      [
        `existing mcp.json at ${locations.mcpJsonPath} is malformed; it will be replaced (non-plugin entries in it are lost)`,
      ],
    );
  });
});

test("staging warnings: a clean staging produces warnings: []", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { a: { command: "x", env: { FOO: "bar" } }, b: { url: "https://y" } },
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepEqual([...prepared.result.warnings], []);
  });
});

// ---------------------------------------------------------------------------
// MENV-03 -- project vs user CLAUDE_PROJECT_DIR scope arms
// ---------------------------------------------------------------------------

const PROJECT_DIR_SRV = { srv: { command: "${CLAUDE_PROJECT_DIR}/run" } };

test("MENV-03 project scope substitutes and injects CLAUDE_PROJECT_DIR=cwd", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: PROJECT_DIR_SRV,
    });
    await commitPreparedMcp(prepared);

    const srv = (await readCommittedServers(locations.mcpJsonPath)).srv!;
    // Project root == cwd, NOT scopeRoot (<cwd>/.pi).
    assert.equal(srv.command, `${cwd}/run`);
    assert.equal(srv.env?.CLAUDE_PROJECT_DIR, cwd);
    // Injected order: CLAUDE_PROJECT_DIR trails the two plugin keys.
    assert.deepEqual(Object.keys(srv.env).slice(0, 3), [
      "CLAUDE_PLUGIN_ROOT",
      "CLAUDE_PLUGIN_DATA",
      "CLAUDE_PROJECT_DIR",
    ]);
  });
});

test("MENV-03 user scope omits CLAUDE_PROJECT_DIR (token passes through, no env key)", async () => {
  // Cross-check reference: stage the SAME source under project scope in its
  // own isolated scope (distinct cwd/agent dir) so the two stages never share
  // a collision slot. Captured before the user stage runs.
  const projSrv = await withTmpScope(async ({ cwd, locations }) => {
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: PROJECT_DIR_SRV,
    });
    await commitPreparedMcp(prepared);
    return (await readCommittedServers(locations.mcpJsonPath)).srv!;
  });

  await withTmpUserScope(async ({ cwd, locations }) => {
    assert.equal(locations.scope, "user");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: PROJECT_DIR_SRV,
    });
    await commitPreparedMcp(prepared);

    const userSrv = (await readCommittedServers(locations.mcpJsonPath)).srv!;
    // Documented user-scope absence: the token is left untouched...
    assert.equal(userSrv.command, "${CLAUDE_PROJECT_DIR}/run");
    // ...and no CLAUDE_PROJECT_DIR key is injected, while the plugin keys remain.
    assert.equal("CLAUDE_PROJECT_DIR" in userSrv.env!, false);
    assert.equal(userSrv.env?.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
    assert.equal(userSrv.env?.CLAUDE_PLUGIN_DATA, PLUGIN_DATA);

    // The ONLY divergence from the project-scope stage of the same source is
    // the ${CLAUDE_PROJECT_DIR} treatment (command literal + env key).
    assert.notEqual(projSrv.command, userSrv.command);
    assert.equal("CLAUDE_PROJECT_DIR" in projSrv.env!, true);
    // Everything else (marker, plugin env keys) matches.
    assert.deepEqual(
      projSrv[CLAUDE_MARKETPLACE_MARKER_KEY],
      userSrv[CLAUDE_MARKETPLACE_MARKER_KEY],
    );
    assert.equal(projSrv.env?.CLAUDE_PLUGIN_ROOT, userSrv.env?.CLAUDE_PLUGIN_ROOT);
    assert.equal(projSrv.env?.CLAUDE_PLUGIN_DATA, userSrv.env?.CLAUDE_PLUGIN_DATA);
  });
});

// ---------------------------------------------------------------------------
// MENV-04 -- re-derivation on re-stage + theirs isolation
// ---------------------------------------------------------------------------

test("MENV-04 re-stage with new pluginRoot leaves no stale path", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Source servers carry placeholders both times -- re-stage substitutes the
    // resolver's SOURCE (never a read-back of the prior mcp.json).
    const source = { srv: { command: "${CLAUDE_PLUGIN_ROOT}/bin" } };
    const oldRoot = "/sources/mp/plugins/acme-OLDSHA";
    const newRoot = "/sources/mp/plugins/acme-NEWSHA";

    const first = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: oldRoot,
      pluginData: PLUGIN_DATA,
      servers: source,
    });
    await commitPreparedMcp(first);

    const second = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: newRoot,
      pluginData: PLUGIN_DATA,
      servers: source,
    });
    await commitPreparedMcp(second);

    const onDisk = await readFile(locations.mcpJsonPath, "utf8");
    assert.ok(onDisk.includes("acme-NEWSHA"), "new root must be present");
    assert.equal(onDisk.includes("acme-OLDSHA"), false, "no substring of the old root may survive");
  });
});

test("MENV-04 re-stage with same pluginRoot is idempotent", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const source = {
      srv: { command: "${CLAUDE_PLUGIN_ROOT}/bin", args: ["${CLAUDE_PLUGIN_DATA}"] },
    };
    const stageOnce = async (): Promise<string> => {
      const prepared = await prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: MP,
        pluginName: PLUGIN,
        pluginRoot: PLUGIN_ROOT,
        pluginData: PLUGIN_DATA,
        servers: source,
      });
      await commitPreparedMcp(prepared);
      return readFile(locations.mcpJsonPath, "utf8");
    };

    const firstText = await stageOnce();
    const secondText = await stageOnce();
    // Substitution runs on the placeholder-bearing source both times, so an
    // already-real path is never double-substituted -- byte-identical output.
    assert.equal(secondText, firstText);
  });
});

test("MENV-04 re-stage preserves foreign (theirs) entries verbatim", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Pre-seed a foreign entry (different plugin marker) carrying a placeholder
    // token AND its own env, plus a top-level non-mcp field.
    const foreign = {
      command: "${CLAUDE_PLUGIN_ROOT}/x",
      env: { A: "1" },
      [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "other", marketplace: MP },
    };
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({ customField: "keep-me", mcpServers: { foreign } }),
      "utf8",
    );

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "y" } },
    });
    await commitPreparedMcp(prepared);

    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      customField: unknown;
      mcpServers: Record<string, CommittedServer>;
    };
    // Foreign entry byte-preserved: token untouched, env unchanged, no injected keys.
    assert.deepEqual(onDisk.mcpServers.foreign, foreign);
    // Top-level non-mcp field survives.
    assert.equal(onDisk.customField, "keep-me");
    // Our own entry did land (sanity).
    assert.ok("srv" in onDisk.mcpServers);
  });
});

// ---------------------------------------------------------------------------
// WR-01 -- a server literally named __proto__ survives partition and stamping
// ---------------------------------------------------------------------------

test("WR-01 a foreign server literally named __proto__ is preserved verbatim", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // JSON.parse materializes __proto__ as a real own-enumerable key, so the
    // scoped doc must be seeded as raw text -- an object literal with a
    // __proto__ key would hit the prototype setter and never create the entry.
    const rawDoc =
      '{"customField":"keep-me","mcpServers":{"__proto__":{"command":"foreign",' +
      `"env":{"A":"1"},"${CLAUDE_MARKETPLACE_MARKER_KEY}":` +
      `{"plugin":"other","marketplace":"${MP}"}}}}`;
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, rawDoc, "utf8");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "y" } },
    });
    await commitPreparedMcp(prepared);

    const servers = await readCommittedServers(locations.mcpJsonPath);
    // The foreign __proto__ entry survives as an own key, byte-for-byte.
    assert.ok(Object.hasOwn(servers, "__proto__"), "foreign __proto__ entry must be an own key");
    assert.deepEqual(servers["__proto__"], {
      command: "foreign",
      env: { A: "1" },
      [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "other", marketplace: MP },
    });
    // Our own entry still landed.
    assert.ok("srv" in servers);
    // No global prototype pollution from the round-trip.
    assert.equal(({} as Record<string, unknown>).command, undefined);
  });
});

test("WR-01 a plugin-declared server named __proto__ is stamped and written", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // JSON.parse materializes __proto__ as a real own key, mirroring what the
    // resolver produces from a plugin manifest naming a server "__proto__".
    const servers = JSON.parse('{"__proto__":{"command":"${CLAUDE_PLUGIN_ROOT}/bin"}}') as Record<
      string,
      unknown
    >;

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers,
    });
    await commitPreparedMcp(prepared);

    const committed = await readCommittedServers(locations.mcpJsonPath);
    assert.ok(
      Object.hasOwn(committed, "__proto__"),
      "the __proto__ server must be an own key on disk",
    );
    const entry = committed["__proto__"];
    assert.equal(entry?.command, `${PLUGIN_ROOT}/bin`);
    assert.deepEqual(entry?.[CLAUDE_MARKETPLACE_MARKER_KEY], { plugin: PLUGIN, marketplace: MP });
    // No global prototype pollution from the stamp/write round-trip.
    assert.equal(({} as Record<string, unknown>).command, undefined);
  });
});

test("PRL-10 finalizeMcpReplacement throws on unknown replacement handle (defensive)", () => {
  const bogus = { kind: "replaced" } as Parameters<typeof finalizeMcpReplacement>[0];
  assert.throws(() => finalizeMcpReplacement(bogus), /Unknown MCP replacement handle/);
});

test("PRL-10 replacePreparedMcp rollback records leak when restore fails", async (t) => {
  // POSIX-only: chmod the mcp.json parent dir read-only so the rollback's
  // writeFile fails. The catch block accumulates a leak message rather
  // than throwing.
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block writeFile");
    return;
  }

  const { chmod } = await import("node:fs/promises");

  await withTmpScope(async ({ cwd, locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    const previous = '{"mcpServers":{"old":{"command":"old"}}}\n';
    await writeFile(locations.mcpJsonPath, previous, "utf8");

    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: MP,
      pluginName: PLUGIN,
      pluginRoot: PLUGIN_ROOT,
      pluginData: PLUGIN_DATA,
      servers: { srv: { command: "new" } },
    });

    const replacement = await replacePreparedMcp(prepared);
    // Remove mcp.json, then chmod its parent dir read-only so the rollback's
    // `mkdir(recursive: true)` followed by `writeFile` fails on the create
    // step (O_CREAT requires parent write).
    await rm(locations.mcpJsonPath, { force: true });
    await chmod(path.dirname(locations.mcpJsonPath), 0o500);

    try {
      const leaks = await rollbackMcpReplacement(replacement);
      assert.ok(leaks.length >= 1, "expected a restore leak");
      assert.match(leaks[0] ?? "", /failed to restore mcp\.json/);
    } finally {
      await chmod(path.dirname(locations.mcpJsonPath), 0o755);
    }
  });
});
