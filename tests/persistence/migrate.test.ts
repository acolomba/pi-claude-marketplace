import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  migrateLegacyMarketplaceRecords,
  persistMigratedState,
} from "../../extensions/pi-claude-marketplace/persistence/migrate.ts";

/**
 * ST-4, ST-5, IL-3 -- legacy migration + sanctioned console-warn.
 *
 * Migration tests use the JSON fixtures under fixtures/legacy/. The IL-3
 * console.warn assertions use t.mock.method to capture warn calls without
 * actually writing to stderr -- per eslint.config.js block D, the
 * tests/**.ts override allows console.* directly.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/legacy");
const REPO_ROOT = path.resolve(HERE, "../..");
const MIGRATE_PATH = path.join(
  REPO_ROOT,
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
);

// SPLIT-01 / D-13: `scrubAutoupdate: false` keeps the D-13 autoupdate scrub
// GATE-CLOSED, preserving prior behavior for fixtures that do not carry an
// `autoupdate` field. The migrator is a pure function -- the caller
// (loadState) owns the existsSync gate predicate, so the unit tests here
// pass the boolean directly.
const GATE_CLOSED = false;
const GATE_OPEN = true;

test("ST-4 migrate fills missing manifestPath + marketplaceRoot (v0 fixture)", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "v0-no-schemaversion.json"), "utf8"),
  ) as unknown;
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_CLOSED,
  );
  assert.equal(mutated, true);
  const alpha = marketplaces["alpha"] as { manifestPath: string; marketplaceRoot: string };
  assert.equal(
    alpha.manifestPath,
    path.join("/ext-root", "sources", "alpha", ".claude-plugin", "marketplace.json"),
  );
  assert.equal(alpha.marketplaceRoot, path.join("/ext-root", "sources", "alpha"));
});

test("ST-4 migrate fills only missing manifestPath (v1-missing-manifestpath fixture)", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "v1-missing-manifestpath.json"), "utf8"),
  ) as unknown;
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_CLOSED,
  );
  assert.equal(mutated, true);
  const beta = marketplaces["beta"] as { manifestPath: string; marketplaceRoot: string };
  assert.ok(
    beta.manifestPath.endsWith(path.join("beta", ".claude-plugin", "marketplace.json")),
    `manifestPath should end with sources/beta/.claude-plugin/marketplace.json, got ${beta.manifestPath}`,
  );
  // marketplaceRoot was already present in fixture; should not be overwritten.
  assert.equal(beta.marketplaceRoot, "/abs/beta");
});

test("ST-5 migrate normalizes resources.agents and resources.mcpServers to []", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "v1-missing-resources.json"), "utf8"),
  ) as unknown;
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_CLOSED,
  );
  assert.equal(mutated, true);
  const gamma = marketplaces["gamma"] as {
    plugins: Record<string, { resources: Record<string, unknown> }>;
  };
  const p2 = gamma.plugins["p2"];
  assert.ok(p2);
  assert.deepEqual(p2.resources["agents"], []);
  assert.deepEqual(p2.resources["mcpServers"], []);
});

test("migrate on null returns empty marketplaces (no mutation flag)", () => {
  const result = migrateLegacyMarketplaceRecords(null, "/ext-root", GATE_CLOSED);
  assert.deepEqual(result.marketplaces, {});
  assert.equal(result.mutated, false);
});

test("migrate on top-level array returns empty marketplaces", () => {
  const result = migrateLegacyMarketplaceRecords([1, 2, 3], "/ext-root", GATE_CLOSED);
  assert.deepEqual(result.marketplaces, {});
  assert.equal(result.mutated, false);
});

test("migrate on marketplaces:[] (array, not object) resets to {} with mutated=true", () => {
  const result = migrateLegacyMarketplaceRecords({ marketplaces: [] }, "/ext-root", GATE_CLOSED);
  assert.deepEqual(result.marketplaces, {});
  assert.equal(result.mutated, true);
});

test("migrate on marketplaces missing entirely returns {} with mutated=false", () => {
  const result = migrateLegacyMarketplaceRecords({ schemaVersion: 1 }, "/ext-root", GATE_CLOSED);
  assert.deepEqual(result.marketplaces, {});
  assert.equal(result.mutated, false);
});

// ===================================================================
// SPLIT-01 / D-12 / D-13 -- autoupdate scrub gated on scrubAutoupdate
// (the existsSync(configJsonPath) gate predicate lives in loadState;
// loadState-level gate coverage is in tests/persistence/state-io.test.ts)
// ===================================================================

test("D-13 GATE CLOSED: scrub does NOT fire when scrubAutoupdate=false; autoupdate preserved", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8"),
  ) as unknown;
  const { marketplaces } = migrateLegacyMarketplaceRecords(fixture, "/ext-root", GATE_CLOSED);
  const mp = marketplaces["mp-with-autoupdate"] as { autoupdate?: boolean };
  // Gate closed -> autoupdate field PRESERVED for the first-run migration to capture.
  assert.equal(mp.autoupdate, true);
});

test("D-13 GATE OPEN: scrub fires when scrubAutoupdate=true; autoupdate removed and mutated=true", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8"),
  ) as unknown;
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_OPEN,
  );
  const mp = marketplaces["mp-with-autoupdate"] as { autoupdate?: boolean };
  // Gate open -> autoupdate field SCRUBBED.
  assert.equal(mp.autoupdate, undefined);
  assert.equal(mutated, true);
});

test("D-13 idempotency: second migrate on already-scrubbed input returns mutated=false (gate open)", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8"),
  ) as unknown;
  // First migrate: scrub fires.
  const first = migrateLegacyMarketplaceRecords(fixture, "/ext-root", GATE_OPEN);
  assert.equal(first.mutated, true);
  // Wrap the already-scrubbed marketplaces back into a top-level state shape and
  // re-run the migrator. Idempotency: the second call must report mutated=false
  // because every per-marketplace ensure* helper is a no-op on already-normalized
  // data (no missing paths / no missing resources / no autoupdate field).
  const second = migrateLegacyMarketplaceRecords(
    { schemaVersion: 1, marketplaces: first.marketplaces },
    "/ext-root",
    GATE_OPEN,
  );
  assert.equal(second.mutated, false);
  const mp = second.marketplaces["mp-with-autoupdate"] as { autoupdate?: boolean };
  assert.equal(mp.autoupdate, undefined);
});

// ===================================================================
// HOOK-02 / D-57-01 -- ensurePluginResources `hooks: []` default-fill
// arm. Mirrors the existing `agents: []` / `mcpServers: []` arms.
// ===================================================================

/**
 * Build an in-memory parsed-state shape with one marketplace and one
 * plugin. `resources` is the in-place resources object; pass `undefined`
 * to omit the field entirely (exercises the synthesized-resources arm).
 */
function buildLegacyMigrationInput(opts: {
  resources?: Record<string, unknown> | undefined;
  omitResources?: boolean;
}): { schemaVersion: 1; marketplaces: Record<string, unknown> } {
  const plugin: Record<string, unknown> = {
    version: "1.0.0",
    resolvedSource: "/abs/mp/p1",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  if (!opts.omitResources) {
    plugin["resources"] = opts.resources ?? {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: [],
    };
  }

  return {
    schemaVersion: 1,
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

test("HOOK-02 / D-57-01: ensurePluginResources fills hooks: [] when absent", () => {
  const fixture = buildLegacyMigrationInput({
    resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
  });
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_CLOSED,
  );
  assert.equal(mutated, true);
  const mp = marketplaces["mp"] as {
    plugins: Record<string, { resources: Record<string, unknown> }>;
  };
  const p1 = mp.plugins["p1"];
  assert.ok(p1);
  assert.deepEqual(p1.resources["hooks"], []);
});

test("HOOK-02 / D-57-01: ensurePluginResources is idempotent for the hooks arm (whole-function mutated=false on already-normalized input)", () => {
  // Already-normalized record: every default-fill arm reports no-op, so
  // the whole-function `mutated` flag must come back false. This pins
  // the idempotency contract for the new hooks arm on top of the
  // existing agents / mcpServers arms.
  const fixture = buildLegacyMigrationInput({
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
  });
  const { mutated } = migrateLegacyMarketplaceRecords(fixture, "/ext-root", GATE_CLOSED);
  assert.equal(mutated, false);
});

test("HOOK-02 / D-57-03: ensurePluginResources preserves a pre-existing resources.hooks: ['x']", () => {
  const fixture = buildLegacyMigrationInput({
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["x"] },
  });
  const { marketplaces } = migrateLegacyMarketplaceRecords(fixture, "/ext-root", GATE_CLOSED);
  const mp = marketplaces["mp"] as {
    plugins: Record<string, { resources: Record<string, unknown> }>;
  };
  const p1 = mp.plugins["p1"];
  assert.ok(p1);
  assert.deepEqual(p1.resources["hooks"], ["x"]);
});

test("HOOK-02 / D-57-01: ensurePluginResources fills hooks: [] when the entire resources field is missing", () => {
  // Synthesized-resources arm: when `pl.resources` is absent, the helper
  // creates a fresh `{}` and fills agents/mcpServers/hooks defaults.
  const fixture = buildLegacyMigrationInput({ omitResources: true });
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    fixture,
    "/ext-root",
    GATE_CLOSED,
  );
  assert.equal(mutated, true);
  const mp = marketplaces["mp"] as {
    plugins: Record<string, { resources: Record<string, unknown> }>;
  };
  const p1 = mp.plugins["p1"];
  assert.ok(p1);
  assert.deepEqual(p1.resources["agents"], []);
  assert.deepEqual(p1.resources["mcpServers"], []);
  assert.deepEqual(p1.resources["hooks"], []);
});

test("IL-3 persistMigratedState swallows write failures and emits ONE console.warn", async (t) => {
  // Force atomicWriteJson to fail by passing a path whose dirname is an
  // existing FILE (not a directory). atomicWriteJson runs `mkdir(parent)`
  // first which throws ENOTDIR -- exactly the surface the IL-3 callsite
  // is supposed to swallow.
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-migrate-fail-"));
  try {
    const blocker = path.join(dir, "blocker");
    await writeFile(blocker, "");
    const targetThatCannotBeWritten = path.join(blocker, "state.json");

    const warnMock = t.mock.method(console, "warn", () => {
      // No-op: capture the call without echoing to stderr.
    });

    await persistMigratedState(targetThatCannotBeWritten, {
      schemaVersion: 1,
      marketplaces: {},
    });

    assert.equal(
      warnMock.mock.callCount(),
      1,
      "IL-3 sanctioned console.warn must fire exactly once on persist failure",
    );
    const warnArg = warnMock.mock.calls[0]?.arguments[0] as string;
    assert.match(warnArg, /Legacy marketplace migration could not be persisted/);
    assert.match(warnArg, /the in-memory normalized state is being used/);
    assert.match(warnArg, /Cause: /);
    assert.ok(
      warnArg.includes(targetThatCannotBeWritten),
      "warn message must name the failed path so the user can act",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("IL-3 persistMigratedState on success does NOT emit console.warn", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-migrate-ok-"));
  try {
    const target = path.join(dir, "state.json");
    const warnMock = t.mock.method(console, "warn", () => {
      // No-op
    });

    await persistMigratedState(target, { schemaVersion: 1, marketplaces: {} });

    assert.equal(warnMock.mock.callCount(), 0, "console.warn must NOT fire on the success path");
    // Verify the file was actually written:
    const written = await readFile(target, "utf8");
    assert.match(written, /"schemaVersion": 1/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("IL-3 persistMigratedState does NOT throw even when atomic write fails", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-migrate-nothrow-"));
  try {
    const blocker = path.join(dir, "blocker");
    await writeFile(blocker, "");
    const target = path.join(blocker, "state.json");
    t.mock.method(console, "warn", () => {
      // suppress noise
    });
    // Must NOT reject -- ST-4 best-effort guarantee.
    await persistMigratedState(target, { schemaVersion: 1, marketplaces: {} });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CMC-36: persistence/migrate.ts warn body matches style guide §14.1 wording", async () => {
  const src = await readFile(MIGRATE_PATH, "utf8");
  // Source-byte assertion: the migrate.ts file MUST contain the byte-exact
  // template-literal body locked by D-CMC-14 / §14.1 of the messaging style
  // guide. The `expected` value below is the literal source text we expect
  // to find (including backticks and the `${stateJsonPath}` / `${errMsg}`
  // interpolation tokens as they appear in the TypeScript source).
  const expected =
    "`Legacy marketplace migration could not be persisted to ${stateJsonPath}; " +
    "the in-memory normalized state is being used and the on-disk state.json " +
    "is unchanged. Cause: ${errMsg}.`";
  assert.ok(src.includes(expected), "Expected §14.1 wording at persistence/migrate.ts; not found.");
  assert.ok(
    !src.includes("failed to persist migrated state to"),
    "Legacy wording 'failed to persist migrated state to' must be fully replaced (CMC-36)",
  );
});

test("CMC-37 / D-21-04: IL-3 console.warn callsite carries no inline eslint-disable directive (block-level override supersedes)", async () => {
  const src = await readFile(MIGRATE_PATH, "utf8");
  // D-21-04: the warn callsite carries no inline `eslint-disable-next-line`;
  // a block-level files-override (BLOCK B-2 in eslint.config.js) scoped to
  // this single file supplies the suppression. Assert the inline directive
  // is absent.
  assert.ok(
    !/eslint-disable-next-line\s+no-restricted-syntax/.test(src),
    "Inline `eslint-disable-next-line` directive at the IL-3 warn callsite must be removed; the BLOCK B-2 files-override in eslint.config.js supplies the equivalent suppression.",
  );
  // The console.warn callsite itself must still be present and lint clean
  // (verified by `npm run lint` separately).
  assert.match(src, /console\.warn\(/, "IL-3 console.warn callsite must remain");
});

test("CMC-37: exactly one sanctioned warn callsite in persistence/migrate.ts", async () => {
  const src = await readFile(MIGRATE_PATH, "utf8");
  const matches = src.match(/console\.warn\(/g) ?? [];
  assert.equal(
    matches.length,
    1,
    "persistence/migrate.ts must have exactly one sanctioned warn (IL-3)",
  );
});
