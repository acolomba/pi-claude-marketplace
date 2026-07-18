import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  DEFAULT_STATE,
  STATE_VALIDATOR,
  type DisabledPluginRecord,
  type EnabledPluginRecord,
  type ExtensionState,
  type PluginInstallRecord,
  loadState,
  saveState,
  toDisabledRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * ST-1, ST-6 -- state.json load/save behavior.
 *
 * Each test creates an isolated tmpdir representing the extensionRoot and
 * cleans up afterwards. Round-trip uses saveState followed by loadState.
 * The missing-file / empty-`{}` cases verify ENOENT and structurally-empty
 * states return the canonical DEFAULT_STATE shape.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/legacy");

async function tmpExtensionRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-state-test-"));
  const root = path.join(dir, "pi-claude-marketplace");
  await mkdir(root, { recursive: true });
  // Cleanup retries with a short sleep -- ST-4 fire-and-forget persists
  // can land between our `rm`'s readdir and rmdir, raising ENOTEMPTY.
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }

        throw err;
      }
    }
  };

  return { root, cleanup };
}

test("loadState on missing state.json returns DEFAULT_STATE", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const got = await loadState(root);
    assert.deepEqual(got, { schemaVersion: 2, marketplaces: {} });
  } finally {
    await cleanup();
  }
});

test("loadState on empty {} state.json returns DEFAULT_STATE shape", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    await writeFile(path.join(root, "state.json"), "{}");
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 2);
    assert.deepEqual(got.marketplaces, {});
  } finally {
    await cleanup();
  }
});

test("ST-1 saveState + loadState round-trip preserves marketplace shape", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const state: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "user",
          source: { kind: "path", raw: "./local", logical: "./local" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp1/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp1",
          plugins: {},
        },
      },
    };
    await saveState(root, state);
    const stateOnDisk = JSON.parse(await readFile(path.join(root, "state.json"), "utf8")) as {
      schemaVersion: number;
      marketplaces: Record<string, { name: string }>;
    };
    assert.equal(stateOnDisk.schemaVersion, 1);
    assert.equal(stateOnDisk.marketplaces["mp1"]?.name, "mp1");

    const reloaded = await loadState(root);
    const mp1 = (reloaded.marketplaces as Record<string, { name: string }>)["mp1"];
    assert.equal(mp1?.name, "mp1");
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState classifies legacy raw-string source via pathSource (v0 fixture)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn in this test: the fire-and-forget
  // persistMigratedState call may race the cleanup `rm` and emit ENOENT
  // -- that's expected library behavior under the test harness, not a
  // regression. The IL-3 callsite itself is exercised in migrate.test.ts.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    const fixtureRaw = await readFile(path.join(FIXTURES, "v0-no-schemaversion.json"), "utf8");
    await writeFile(path.join(root, "state.json"), fixtureRaw);
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 2);
    const mp = (got.marketplaces as Record<string, { source: unknown }>)["alpha"];
    assert.ok(mp);
    // Source revalidated to ParsedSource object form
    const src = mp.source as { kind: string };
    assert.equal(src.kind, "path");
    // ST-4 best-effort persist is fire-and-forget; let it finish before
    // cleanup so we don't race the rm. write-file-atomic queues + fsyncs;
    // a few microtasks plus a setImmediate is enough to flush.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState rejects state.json with malformed source object", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const malformed = {
      schemaVersion: 1,
      marketplaces: {
        bad: {
          name: "bad",
          scope: "user",
          source: { kind: "no-such-kind", raw: "x" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/bad/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/bad",
          plugins: {},
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(malformed));
    await assert.rejects(() => loadState(root), /malformed source/);
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState accepts forward-compat unknown-kind source verbatim (NFR-12)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const forwardCompat = {
      schemaVersion: 1,
      marketplaces: {
        future: {
          name: "future",
          scope: "user",
          source: { kind: "unknown", raw: "future-spec://x", reason: "forward-compat" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/future/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/future",
          plugins: {},
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(forwardCompat));
    const got = await loadState(root);
    const mp = (got.marketplaces as Record<string, { source: unknown }>)["future"];
    assert.ok(mp);
    const src = mp.source as { kind: string };
    assert.equal(src.kind, "unknown");
  } finally {
    await cleanup();
  }
});

test("loadState rejects state.json that is not valid JSON", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    await writeFile(path.join(root, "state.json"), "{ this is not json");
    await assert.rejects(() => loadState(root), /not valid JSON/);
  } finally {
    await cleanup();
  }
});

test("saveState refuses invalid in-memory state (caller-bug guard)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const bad = { schemaVersion: 1, marketplaces: { x: { not: "valid" } } };
    await assert.rejects(
      () => saveState(root, bad as unknown as ExtensionState),
      /failed schema validation/,
    );
  } finally {
    await cleanup();
  }
});

test("STATE_VALIDATOR exports a JIT-compiled validator (D-07)", () => {
  assert.equal(typeof STATE_VALIDATOR.Check, "function");
  assert.equal(STATE_VALIDATOR.Check(DEFAULT_STATE), true);
  // ENBL-02: schemaVersion 2 is the new normal; both 1 and 2 are valid.
  assert.equal(STATE_VALIDATOR.Check({ schemaVersion: 2, marketplaces: {} }), true);
  // schemaVersion 3 is unknown and must be rejected.
  assert.equal(STATE_VALIDATOR.Check({ schemaVersion: 3, marketplaces: {} }), false);
});

test("SPLIT-01: legacy state.json with autoupdate still loads (typebox lenient)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    const fixtureRaw = await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8");
    await writeFile(path.join(root, "state.json"), fixtureRaw);
    // D-13 gate is CLOSED here because no <scopeRoot>/claude-plugins.json
    // exists alongside the tmp extensionRoot -- the migrator preserves the
    // legacy `autoupdate` in-memory for the first-run migration to capture, while the
    // STATE_SCHEMA carve-out (autoupdate removed from MARKETPLACE_RECORD_SCHEMA)
    // means the lenient typebox default ACCEPTS the extra property at the
    // schema gate. Both halves must hold for the load to succeed.
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 2);
    const mp = (got.marketplaces as Record<string, { name: string }>)["mp-with-autoupdate"];
    assert.ok(mp);
    assert.equal(mp.name, "mp-with-autoupdate");
    // Flush fire-and-forget persist.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("D-13 GATE OPEN through loadState: sibling claude-plugins.json triggers the autoupdate scrub (in-memory + persisted)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    // `root` is <scopeRoot>/pi-claude-marketplace; the D-13 gate path is the
    // SIBLING <scopeRoot>/claude-plugins.json. Materializing it here proves
    // loadState's internal derivation (path.dirname(extensionRoot) join)
    // actually points at the file the gate is specified against -- the scrub
    // must fire end-to-end through loadState, not just at the migrator unit.
    const scopeRoot = path.dirname(root);
    await writeFile(path.join(scopeRoot, "claude-plugins.json"), "{}", "utf8");
    const fixtureRaw = await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8");
    const stateJsonPath = path.join(root, "state.json");
    await writeFile(stateJsonPath, fixtureRaw);

    const got = await loadState(root);
    const mp = (got.marketplaces as Record<string, Record<string, unknown>>)["mp-with-autoupdate"];
    assert.ok(mp);
    // Gate OPEN -> the legacy autoupdate flag is scrubbed from the in-memory record.
    assert.equal(mp["autoupdate"], undefined);

    // Flush the ST-4 fire-and-forget persist, then assert the scrub was
    // persisted: the on-disk state.json no longer carries the flag either.
    // write-file-atomic performs real fs work (write + fsync + rename), so
    // poll with a short backoff instead of relying on a fixed tick count.
    let persisted: { marketplaces: Record<string, Record<string, unknown>> } | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      persisted = JSON.parse(await readFile(stateJsonPath, "utf8")) as {
        marketplaces: Record<string, Record<string, unknown>>;
      };
      if (persisted.marketplaces["mp-with-autoupdate"]?.["autoupdate"] === undefined) {
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }

    assert.ok(persisted);
    assert.equal(persisted.marketplaces["mp-with-autoupdate"]?.["autoupdate"], undefined);
  } finally {
    await cleanup();
  }
});

test("D-13 drift guard: loadState's configJsonPath derivation matches locationsFor byte-for-byte", () => {
  // loadState derives the gate path as
  // path.join(path.dirname(extensionRoot), "claude-plugins.json") without
  // importing locationsFor (its external signature must stay
  // loadState(extensionRoot)). Pin the equivalence so a future edit to
  // either construction cannot silently divert the D-13 gate.
  const loc = locationsFor("project", path.join(tmpdir(), "drift-guard-cwd"));
  assert.equal(
    path.join(path.dirname(loc.extensionRoot), "claude-plugins.json"),
    loc.configJsonPath,
  );
});

// ===================================================================
// HOOK-02 / D-57-01: additive `resources.hooks` field on the plugin
// install record. The validator is the schema gate; the default-fill in
// persistence/migrate.ts is the responsibility for adding `hooks: []`
// before validation runs.
//
// ENBL-02: `enabled: boolean` is REQUIRED from schemaVersion 2.
// The fixture builder includes it so STATE_VALIDATOR.Check passes.
// ===================================================================

function buildValidatorFixture(opts: {
  hooks?: unknown;
  omitHooks?: boolean;
  enabled?: unknown;
  omitEnabled?: boolean;
  resolvedSha?: string;
}): {
  schemaVersion: 2;
  marketplaces: Record<string, unknown>;
} {
  const resources: Record<string, unknown> = {
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
  };
  if (!opts.omitHooks) {
    resources["hooks"] = opts.hooks ?? [];
  }

  const plugin: Record<string, unknown> = {
    version: "1.0.0",
    resolvedSource: "/abs/mp/p1",
    compatibility: {
      installable: true,
      notes: [],
      supported: [],
      unsupported: [],
    },
    resources,
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  if (!opts.omitEnabled) {
    plugin["enabled"] = opts.enabled ?? true;
  }

  if (opts.resolvedSha !== undefined) {
    plugin["resolvedSha"] = opts.resolvedSha;
  }

  return {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "user",
        source: { kind: "path", raw: "./mp", logical: "./mp" },
        addedFromCwd: "/cwd",
        manifestPath: "/abs/mp/.claude-plugin/marketplace.json",
        marketplaceRoot: "/abs/mp",
        plugins: { p1: plugin },
      },
    },
  };
}

test("HOOK-02: STATE_VALIDATOR accepts resources.hooks: []", () => {
  const fixture = buildValidatorFixture({ hooks: [] });
  assert.equal(STATE_VALIDATOR.Check(fixture), true);
});

test("HOOK-02 / D-57-03: STATE_VALIDATOR accepts resources.hooks with a generatedName entry", () => {
  const fixture = buildValidatorFixture({ hooks: ["my-plugin"] });
  assert.equal(STATE_VALIDATOR.Check(fixture), true);
});

test("HOOK-02: STATE_VALIDATOR rejects resources.hooks of a non-array shape", () => {
  const fixture = buildValidatorFixture({ hooks: "not-an-array" });
  assert.equal(STATE_VALIDATOR.Check(fixture), false);
});

test("HOOK-02 / D-57-01: STATE_VALIDATOR rejects a record missing resources.hooks (default-fill is the migrator's responsibility)", () => {
  const fixture = buildValidatorFixture({ omitHooks: true });
  assert.equal(STATE_VALIDATOR.Check(fixture), false);
});

test("ENBL-02: STATE_VALIDATOR rejects a record missing `enabled` (fill-before-validate is the migrator's responsibility)", () => {
  // Guards the fill-before-validate contract: if `enabled` ever became
  // optional in the schema, the migrator's default-fill could silently
  // regress to a no-op and a field-less record would validate. This pins
  // `enabled` as REQUIRED.
  const fixture = buildValidatorFixture({ omitEnabled: true });
  assert.equal(STATE_VALIDATOR.Check(fixture), false);
});

// ===================================================================
// D-77-02 / PURL-09: resolvedSha additive-optional field.
//
// The full 40-hex resolved commit sha lives on the plugin install record
// as an OPTIONAL field -- absent on legacy/path/github-name records, present
// on git-source installs. No schemaVersion bump and no migrate fill.
// ===================================================================

test("D-77-02 STATE_VALIDATOR accepts a plugin record WITHOUT resolvedSha (legacy loads unchanged)", () => {
  const fixture = buildValidatorFixture({ hooks: [] });
  assert.equal(STATE_VALIDATOR.Check(fixture), true);
});

test("D-77-02 STATE_VALIDATOR accepts a plugin record WITH a 40-hex resolvedSha", () => {
  const fixture = buildValidatorFixture({
    hooks: [],
    resolvedSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  });
  assert.equal(STATE_VALIDATOR.Check(fixture), true);
});

test("D-77-02 saveState + loadState round-trips resolvedSha intact", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const plugin: PluginInstallRecord = {
      version: "sha-a1b2c3d4e5f6",
      resolvedSource: "https://github.com/o/r",
      resolvedSha: fullSha,
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      enabled: true,
      installedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: { kind: "path", raw: "./mp", logical: "./mp" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp",
          plugins: { p1: plugin },
        },
      },
    };
    await saveState(root, state);
    const reloaded = await loadState(root);
    const mp = reloaded.marketplaces["mp"];
    assert.ok(mp);
    const reloadedPlugin = mp.plugins["p1"];
    assert.equal(reloadedPlugin?.resolvedSha, fullSha);
  } finally {
    await cleanup();
  }
});

test("D-77-02 toDisabledRecord preserves resolvedSha through the disable transform", () => {
  const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  const record: PluginInstallRecord = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/o/r",
    resolvedSha: fullSha,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: ["s"], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  const disabled = toDisabledRecord(record, "2025-02-02T00:00:00.000Z");
  assert.equal(disabled.resolvedSha, fullSha);
  assert.equal(disabled.enabled, false);
});

test("HOOK-02 / D-57-01: v1.12-shaped state.json round-trips through loadState; every plugin record gains resources.hooks default", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    // v1.12-shaped state.json -- plugin records carry skills/prompts/
    // agents/mcpServers but NO `hooks`. A second plugin record carries a
    // pre-existing `hooks: ["pre-existing"]` to assert the migrator
    // leaves it untouched. schemaVersion stays 1 per D-57-01.
    const v12State = {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: { kind: "path", raw: "./mp", logical: "./mp" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp",
          plugins: {
            "needs-default": {
              version: "1.0.0",
              resolvedSource: "/abs/mp/needs-default",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
              installedAt: "2025-01-01T00:00:00.000Z",
              updatedAt: "2025-01-01T00:00:00.000Z",
            },
            "has-preexisting": {
              version: "2.0.0",
              resolvedSource: "/abs/mp/has-preexisting",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["pre-existing"],
              },
              installedAt: "2025-01-02T00:00:00.000Z",
              updatedAt: "2025-01-02T00:00:00.000Z",
            },
          },
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(v12State));

    const got = await loadState(root);
    const mp = (
      got.marketplaces as Record<
        string,
        { plugins: Record<string, { resources: Record<string, unknown> }> }
      >
    )["mp"];
    assert.ok(mp);
    // The migrator's hooks arm fills the default for the v1.12-shaped
    // record (no hooks field on disk).
    assert.deepEqual(mp.plugins["needs-default"]?.resources["hooks"], []);
    // The migrator leaves an existing hooks array untouched (D-57-03).
    assert.deepEqual(mp.plugins["has-preexisting"]?.resources["hooks"], ["pre-existing"]);
    // Flush fire-and-forget persist before cleanup races.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("ENBL-02: pre-enabled state.json round-trips through loadState; every plugin record gains enabled: true", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    // A pre-ENBL-02 state.json: plugin records carry full resources
    // (including hooks, so this exercises the `enabled` arm in isolation)
    // but NO `enabled` field. schemaVersion stays 1. This pins loadState's
    // integration: the migrator's enabled-fill MUST run before
    // STATE_VALIDATOR.Check -- a reorder would throw on this file undetected.
    const preEnabledState = {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: { kind: "path", raw: "./mp", logical: "./mp" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp",
          plugins: {
            one: {
              version: "1.0.0",
              resolvedSource: "/abs/mp/one",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
              installedAt: "2025-01-01T00:00:00.000Z",
              updatedAt: "2025-01-01T00:00:00.000Z",
            },
            two: {
              version: "2.0.0",
              resolvedSource: "/abs/mp/two",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: ["s"], prompts: [], agents: [], mcpServers: [], hooks: [] },
              installedAt: "2025-01-02T00:00:00.000Z",
              updatedAt: "2025-01-02T00:00:00.000Z",
            },
          },
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(preEnabledState));

    const got = await loadState(root);
    const mp = (
      got.marketplaces as Record<string, { plugins: Record<string, { enabled: boolean }> }>
    )["mp"];
    assert.ok(mp);
    assert.equal(mp.plugins["one"]?.enabled, true);
    assert.equal(mp.plugins["two"]?.enabled, true);
    // Flush fire-and-forget persist before cleanup races.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("ENBL-02: STATE_SCHEMA.schemaVersion accepts 1 and 2 (saveState accepts both; rejects 3+)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    // schemaVersion 2 is the ENBL-02 shape and must be accepted.
    const v2 = { schemaVersion: 2, marketplaces: {} } as ExtensionState;
    await saveState(root, v2); // must not throw
    // schemaVersion 1 is the pre-ENBL-02 shape and must still be accepted
    // (migration is additive; old files with no plugin records are valid v1).
    const v1 = { schemaVersion: 1, marketplaces: {} } as ExtensionState;
    await saveState(root, v1); // must not throw
    // schemaVersion 3 is unknown and must be refused.
    const v3 = { schemaVersion: 3 as unknown as 1, marketplaces: {} } as ExtensionState;
    await assert.rejects(() => saveState(root, v3), /failed schema validation/);
  } finally {
    await cleanup();
  }
});

// ===================================================================
// ENBL-02 two-signal invariant: EnabledPluginRecord / DisabledPluginRecord
// branded types + the toDisabledRecord factory.
// ===================================================================

test("ENBL-02: toDisabledRecord empties all resources, sets enabled:false, preserves identity + restamps updatedAt", () => {
  const record: PluginInstallRecord = {
    version: "9.9.9",
    resolvedSource: "/abs/mp/foo",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: ["s"], prompts: ["p"], agents: ["a"], mcpServers: ["m"], hooks: ["h"] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const disabled = toDisabledRecord(record, "2026-02-02T00:00:00.000Z");
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.resources, {
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
    hooks: [],
  });
  // Identity fields preserved.
  assert.equal(disabled.version, "9.9.9");
  assert.equal(disabled.resolvedSource, "/abs/mp/foo");
  assert.deepEqual(disabled.compatibility, record.compatibility);
  assert.equal(disabled.installedAt, "2026-01-01T00:00:00.000Z");
  // updatedAt restamped.
  assert.equal(disabled.updatedAt, "2026-02-02T00:00:00.000Z");
  // The disabled + empty shape is a legal stored record.
  assert.equal(
    STATE_VALIDATOR.Check({
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: { kind: "path", raw: "./mp", logical: "./mp" },
          addedFromCwd: "/cwd",
          manifestPath: "/m",
          marketplaceRoot: "/r",
          plugins: { foo: disabled },
        },
      },
    }),
    true,
  );
});

test("ENBL-02: DisabledPluginRecord forbids non-empty resources at compile time", () => {
  // Compile-time guard: gated by `npm run typecheck` (tests/**/*.ts is in the
  // tsconfig include). If the branded type regresses to permissive arrays,
  // the @ts-expect-error below stops erroring and typecheck fails.
  type DisabledSkills = DisabledPluginRecord["resources"]["skills"];
  // @ts-expect-error a disabled record's resources arrays must be empty ([])
  const badSkills: DisabledSkills = ["x"];
  void badSkills;

  // The empty form type-checks, and an enabled record may carry populated
  // resources (the normal active shape) -- proving the asymmetry is intended.
  const okSkills: DisabledSkills = [];
  const active: EnabledPluginRecord = {
    version: "1.0.0",
    resolvedSource: "/abs",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: ["x"], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.deepEqual(okSkills, []);
  assert.equal(active.enabled, true);
});

test("BFILL-02 state with lastReconciledExtensionVersion validates and round-trips", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const state: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: "0.6.2",
      marketplaces: {},
    };
    assert.equal(STATE_VALIDATOR.Check(state), true);

    await saveState(root, state);
    const reloaded = await loadState(root);
    assert.equal(reloaded.lastReconciledExtensionVersion, "0.6.2");
    assert.equal(reloaded.schemaVersion, 2);
  } finally {
    await cleanup();
  }
});

test("BFILL-02 / D-68-01 old doc without the stamp loads unchanged (no schemaVersion bump)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    // A doc with no stamp -- the absent-stamp = scan-once case.
    const legacy = {
      schemaVersion: 2,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "user",
          source: { kind: "path", raw: "./local", logical: "./local" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp1/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp1",
          plugins: {},
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(legacy));
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 2);
    assert.equal(got.lastReconciledExtensionVersion, undefined);
    assert.ok((got.marketplaces as Record<string, unknown>)["mp1"]);
  } finally {
    await cleanup();
  }
});

test("BFILL-02 loadState normalization preserves a stamp present in the raw doc", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    // Guards the rebuilt-object drop hazard: loadState normalization rebuilds
    // { schemaVersion, marketplaces } and would silently drop a new top-level
    // field unless it is threaded through.
    const raw = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: "0.5.0",
      marketplaces: {},
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(raw));
    const got = await loadState(root);
    assert.equal(got.lastReconciledExtensionVersion, "0.5.0");
  } finally {
    await cleanup();
  }
});
