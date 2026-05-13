import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CLAUDE_MARKETPLACE_MARKER_KEY } from "../../../extensions/pi-claude-marketplace/bridges/mcp/marker.ts";
import { unstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

// MC-6 / MC-7 -- unstage: drop ours, tolerate missing fields, no-rewrite on noop.

interface Ctx {
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
}

async function withTmpScope<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-unstage-"));
  const locations = locationsFor("project", cwd);
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const MP = "official";
const PLUGIN = "acme";

const mark = (plugin: string, marketplace: string): Record<string, unknown> => ({
  [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin, marketplace },
});

// ---------------------------------------------------------------------------
// MC-6 happy path
// ---------------------------------------------------------------------------

test("MC-6 unstageMcpServers drops entries with matching marker, keeps others", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          mine: { command: "x", ...mark(PLUGIN, MP) },
          theirs: { command: "y", ...mark("other-plugin", MP) },
          unmarked: { command: "z" },
        },
      }),
      "utf8",
    );

    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });

    assert.deepEqual([...result.removedNames], ["mine"]);
    assert.deepEqual([...result.warnings], []);

    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(onDisk.mcpServers).sort(), ["theirs", "unmarked"]);
  });
});

test("MC-6 unstageMcpServers writes reduced doc atomically when removals occurred", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        customTopLevel: "preserve-me",
        mcpServers: {
          a: { command: "x", ...mark(PLUGIN, MP) },
          b: { command: "y", ...mark(PLUGIN, MP) },
        },
      }),
      "utf8",
    );

    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });

    assert.deepEqual([...result.removedNames].sort(), ["a", "b"]);

    const onDisk = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      customTopLevel: unknown;
      mcpServers: Record<string, unknown>;
    };
    assert.equal(onDisk.customTopLevel, "preserve-me", "non-mcp top-level fields preserved");
    assert.deepEqual(onDisk.mcpServers, {});
  });
});

// ---------------------------------------------------------------------------
// MC-7 tolerances
// ---------------------------------------------------------------------------

test("MC-7 unstageMcpServers tolerates missing mcpServers field", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    // Doc has other top-level fields but no mcpServers.
    await writeFile(locations.mcpJsonPath, JSON.stringify({ customField: "x" }), "utf8");
    const before = (await stat(locations.mcpJsonPath)).mtimeMs;

    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });
    assert.deepEqual([...result.removedNames], []);
    assert.deepEqual([...result.warnings], []);

    // Wait a short tick to let any I/O settle, then assert the file was NOT rewritten.
    const after = (await stat(locations.mcpJsonPath)).mtimeMs;
    assert.equal(after, before, "MC-7 noop must NOT rewrite the file");
  });
});

test("MC-7 unstageMcpServers tolerates missing mcp.json file (ENOENT)", async () => {
  await withTmpScope(async ({ locations }) => {
    // No mcp.json on disk at all.
    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });
    assert.deepEqual([...result.removedNames], []);
    assert.deepEqual([...result.warnings], []);

    const mcpStat = await stat(locations.mcpJsonPath).catch(() => null);
    assert.equal(mcpStat, null, "ENOENT noop must NOT materialize mcp.json");
  });
});

test("MC-7 unstageMcpServers tolerates non-object mcpServers (treats as missing)", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, JSON.stringify({ mcpServers: "not-an-object" }), "utf8");
    const before = (await stat(locations.mcpJsonPath)).mtimeMs;

    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });
    assert.deepEqual([...result.removedNames], []);

    const after = (await stat(locations.mcpJsonPath)).mtimeMs;
    assert.equal(after, before, "non-object mcpServers must NOT trigger a rewrite");
  });
});

// ---------------------------------------------------------------------------
// no-rewrite on noop
// ---------------------------------------------------------------------------

test("MC-6 unstageMcpServers does NOT materialize file when nothing to remove", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    // Pre-seed with foreign-only entries; we own nothing here.
    await writeFile(
      locations.mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          theirs: { command: "x", ...mark("someone-else", MP) },
          unmarked: { command: "y" },
        },
      }),
      "utf8",
    );
    const before = (await stat(locations.mcpJsonPath)).mtimeMs;

    const result = await unstageMcpServers({
      locations,
      marketplaceName: MP,
      pluginName: PLUGIN,
    });
    assert.deepEqual([...result.removedNames], []);

    const after = (await stat(locations.mcpJsonPath)).mtimeMs;
    assert.equal(after, before, "MC-6 noop must NOT rewrite the file");
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON propagates
// ---------------------------------------------------------------------------

test("unstageMcpServers throws descriptive error on malformed JSON", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, "not-json {{", "utf8");

    await assert.rejects(
      unstageMcpServers({ locations, marketplaceName: MP, pluginName: PLUGIN }),
      /malformed JSON at/,
    );
  });
});
