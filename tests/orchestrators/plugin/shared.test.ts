import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  assertNoCrossPluginConflicts,
  resolveInstallMarketplaceSource,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  type CrossPluginGeneratedNames,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  CrossPluginConflictError,
  MarketplaceNotFoundError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

// Test-local typing aliases that mirror the structural shape of the
// records this pure helper actually reads. Using the published
// ExtensionState type ensures we stay in sync with schema changes.
type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * Build a structurally complete PluginRecord that satisfies the
 * STATE_SCHEMA shape. The helper only reads
 * `state.marketplaces[*].plugins[*].resources`, but we still populate
 * the surrounding fields so the fixture matches what `saveState` would
 * accept -- prevents accidental schema-drift fixtures.
 */
function makePluginRecord(over: { resources?: Partial<PluginRecord["resources"]> }): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: {
      installable: true,
      notes: [],
      supported: [],
      unsupported: [],
    },
    resources: {
      skills: over.resources?.skills ?? [],
      prompts: over.resources?.prompts ?? [],
      agents: over.resources?.agents ?? [],
      mcpServers: over.resources?.mcpServers ?? [],
    },
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeMarketplaceRecord(
  name: string,
  plugins: Record<string, PluginRecord>,
  scope: "user" | "project" = "user",
): MarketplaceRecord {
  const cwd = "/tmp/test-cwd";

  return {
    name,
    scope,
    source: pathSource("./src"),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, "marketplace.json"),
    marketplaceRoot: cwd,
    plugins,
  };
}

function makeState(
  marketplaces: Record<string, { plugins: Record<string, PluginRecord> }>,
): ExtensionState {
  return {
    schemaVersion: 1,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([mpName, mp]) => [
        mpName,
        makeMarketplaceRecord(mpName, mp.plugins),
      ]),
    ),
  };
}

test("PI-6 / D-05 case A: no conflicts -> returns void", () => {
  const state = makeState({
    official: {
      plugins: {
        existing: makePluginRecord({
          resources: { skills: ["existing-skill"], prompts: [], agents: [], mcpServers: [] },
        }),
      },
    },
  });
  const names: CrossPluginGeneratedNames = {
    skills: ["new-skill"],
    commands: ["new:cmd"],
    agents: ["pi-claude-marketplace-new-agent"],
  };
  assert.doesNotThrow(() => {
    assertNoCrossPluginConflicts("user", names, state);
  });
});

test("PI-6 / D-05 case B: single skill collision -> throws with one conflict entry", () => {
  const state = makeState({
    official: {
      plugins: {
        other: makePluginRecord({
          resources: { skills: ["dup-name"], prompts: [], agents: [], mcpServers: [] },
        }),
      },
    },
  });
  const names: CrossPluginGeneratedNames = {
    skills: ["dup-name"],
    commands: [],
    agents: [],
  };
  // `assert.throws` with a constructor returns void; capture via try/catch
  // so the structured payload (err.conflicts) can be asserted.
  let captured: unknown;
  try {
    assertNoCrossPluginConflicts("user", names, state);
  } catch (e) {
    captured = e;
  }

  assert.ok(captured instanceof CrossPluginConflictError, "expected CrossPluginConflictError");
  assert.equal(captured.conflicts.length, 1);
  assert.match(captured.conflicts[0]!, /^skill "dup-name" already owned by plugin "other"$/);
});

test("PI-6 / D-05 case C: skill + command + agent collisions -> deterministic order (skills, commands, agents; alpha within kind)", () => {
  const state = makeState({
    official: {
      plugins: {
        owner: makePluginRecord({
          resources: {
            skills: ["b-skill", "a-skill"],
            prompts: ["plugin:b-cmd", "plugin:a-cmd"],
            agents: ["pi-claude-marketplace-x-agent", "pi-claude-marketplace-y-agent"],
            mcpServers: [],
          },
        }),
      },
    },
  });
  const names: CrossPluginGeneratedNames = {
    // intentionally provided out-of-order to verify the helper sorts
    skills: ["b-skill", "a-skill"],
    commands: ["plugin:b-cmd", "plugin:a-cmd"],
    agents: ["pi-claude-marketplace-y-agent", "pi-claude-marketplace-x-agent"],
  };
  let captured: unknown;
  try {
    assertNoCrossPluginConflicts("user", names, state);
  } catch (e) {
    captured = e;
  }

  assert.ok(captured instanceof CrossPluginConflictError, "expected CrossPluginConflictError");
  // Deterministic: skills first (alpha), then commands (alpha), then agents (alpha).
  assert.deepEqual(captured.conflicts, [
    `skill "a-skill" already owned by plugin "owner"`,
    `skill "b-skill" already owned by plugin "owner"`,
    `command "plugin:a-cmd" already owned by plugin "owner"`,
    `command "plugin:b-cmd" already owned by plugin "owner"`,
    `agent "pi-claude-marketplace-x-agent" already owned by plugin "owner"`,
    `agent "pi-claude-marketplace-y-agent" already owned by plugin "owner"`,
  ]);
});

test("PI-6 / D-05 case D: MCP server collision NOT detected (PRD §6.5 exclusion)", () => {
  // An existing plugin owns an MCP server named "shared-mcp". The
  // helper's input shape (CrossPluginGeneratedNames) has NO mcpServers
  // field, so by construction this kind cannot be reported here. Even
  // if a future caller tried to thread MCP names through, they would
  // have nowhere to go in this guard -- MC-4 handles them at the
  // bridge layer per PRD §6.5.
  const state = makeState({
    official: {
      plugins: {
        other: makePluginRecord({
          resources: { skills: [], prompts: [], agents: [], mcpServers: ["shared-mcp"] },
        }),
      },
    },
  });
  const names: CrossPluginGeneratedNames = { skills: [], commands: [], agents: [] };
  assert.doesNotThrow(() => {
    assertNoCrossPluginConflicts("user", names, state);
  });
});

test("PI-6 / D-05 case E: cross-scope independence -- helper trusts caller passes one scope's state", () => {
  // Phase 2 D-10 cross-scope independence is enforced BY CONSTRUCTION:
  // the caller passes one scope's state. Demonstrate: a "this-scope"
  // state with no marketplaces (the same-named skill lives in the
  // OTHER scope, which is NOT passed) does not throw.
  const thisScopeState = makeState({}); // empty -- represents the scope being checked
  const names: CrossPluginGeneratedNames = {
    skills: ["shared"],
    commands: [],
    agents: [],
  };
  assert.doesNotThrow(() => {
    assertNoCrossPluginConflicts("user", names, thisScopeState);
  });
});

async function withTmpCwd<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "plugin-shared-cmp-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = path.join(cwd, "agent-home");
  try {
    return await fn(cwd);
  } finally {
    if (previousAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    }

    await rm(cwd, { recursive: true, force: true });
  }
}

async function saveScopedState(
  cwd: string,
  scope: "user" | "project",
  marketplaces: Record<string, Record<string, PluginRecord>>,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([mpName, plugins]) => [
        mpName,
        makeMarketplaceRecord(mpName, plugins, scope),
      ]),
    ),
  });
}

// ---------------------------------------------------------------------------
// CMP-2..4 -- resolveInstallMarketplaceSource target/source scope split.
// ---------------------------------------------------------------------------

test("CMP-2 :: resolveInstallMarketplaceSource returns target-scope record when marketplace present in target state", async () => {
  const mpRecord = makeMarketplaceRecord("mp", {}, "project");
  await withTmpCwd(async (cwd) => {
    const result = await resolveInstallMarketplaceSource({
      targetScope: "project",
      cwd,
      marketplace: "mp",
      targetState: { schemaVersion: 1, marketplaces: { mp: mpRecord } },
    });
    assert.ok(result !== undefined);
    assert.equal(result.sourceScope, "project");
    assert.equal(result.sourceRecord, mpRecord);
  });
});

test("CMP-4 :: resolveInstallMarketplaceSource returns undefined when user-target marketplace absent from user state", async () => {
  await withTmpCwd(async (cwd) => {
    const result = await resolveInstallMarketplaceSource({
      targetScope: "user",
      cwd,
      marketplace: "mp",
      targetState: { schemaVersion: 1, marketplaces: {} },
    });
    assert.equal(result, undefined);
  });
});

test("CMP-3 :: resolveInstallMarketplaceSource falls back to user-scope record when project-target marketplace absent from project state", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: {} });
    const result = await resolveInstallMarketplaceSource({
      targetScope: "project",
      cwd,
      marketplace: "mp",
      targetState: { schemaVersion: 1, marketplaces: {} },
    });
    assert.ok(result !== undefined);
    assert.equal(result.sourceScope, "user");
    assert.equal(result.sourceRecord.name, "mp");
  });
});

test("CMP-3 :: resolveInstallMarketplaceSource returns undefined when project-target marketplace absent from both scopes", async () => {
  await withTmpCwd(async (cwd) => {
    const result = await resolveInstallMarketplaceSource({
      targetScope: "project",
      cwd,
      marketplace: "mp",
      targetState: { schemaVersion: 1, marketplaces: {} },
    });
    assert.equal(result, undefined);
  });
});

// ---------------------------------------------------------------------------
// CMP-5 -- unqualified installed-plugin target resolution.
// ---------------------------------------------------------------------------

test("CMP-5 :: unqualified plugin target prefers project install over user install", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: { plug: makePluginRecord({}) } });
    await saveScopedState(cwd, "project", { mp: { plug: makePluginRecord({}) } });

    const resolved = await resolveInstalledPluginTarget({ cwd, marketplace: "mp", plugin: "plug" });

    assert.equal(resolved?.scope, "project");
  });
});

test("CMP-5 :: explicit user scope overrides project-precedence for plugin target", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: { plug: makePluginRecord({}) } });
    await saveScopedState(cwd, "project", { mp: { plug: makePluginRecord({}) } });

    const resolved = await resolveInstalledPluginTarget({
      cwd,
      marketplace: "mp",
      plugin: "plug",
      explicitScope: "user",
    });

    assert.equal(resolved?.scope, "user");
  });
});

test("CMP-5 :: unqualified plugin target resolves user when only user has install", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: { plug: makePluginRecord({}) } });
    await saveScopedState(cwd, "project", { mp: {} });

    const resolved = await resolveInstalledPluginTarget({ cwd, marketplace: "mp", plugin: "plug" });

    assert.equal(resolved?.scope, "user");
  });
});

test("CMP-5 :: unqualified plugin target returns undefined when plugin is absent", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: {} });
    await saveScopedState(cwd, "project", { mp: {} });

    const resolved = await resolveInstalledPluginTarget({ cwd, marketplace: "mp", plugin: "plug" });

    assert.equal(resolved, undefined);
  });
});

test("CMP-5 :: unqualified marketplace target prefers project when both scopes have installs", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: { plug: makePluginRecord({}) } });
    await saveScopedState(cwd, "project", { mp: { plug: makePluginRecord({}) } });

    const resolved = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

    assert.equal(resolved.scope, "project");
  });
});

test("CMP-5 :: unqualified marketplace target resolves user when only user has installs", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: { plug: makePluginRecord({}) } });
    await saveScopedState(cwd, "project", { mp: {} });

    const resolved = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

    assert.equal(resolved.scope, "user");
  });
});

test("CMP-5 :: unqualified marketplace target returns project empty record before user empty record", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: {} });
    await saveScopedState(cwd, "project", { mp: {} });

    const resolved = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

    assert.equal(resolved.scope, "project");
  });
});

test("CMP-5 :: unqualified marketplace target returns user empty record when project missing", async () => {
  await withTmpCwd(async (cwd) => {
    await saveScopedState(cwd, "user", { mp: {} });

    const resolved = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

    assert.equal(resolved.scope, "user");
  });
});

test("CMP-5 :: unqualified marketplace target throws when absent from both scopes", async () => {
  await withTmpCwd(async (cwd) => {
    await assert.rejects(
      resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" }),
      (err: unknown) => err instanceof MarketplaceNotFoundError,
    );
  });
});
