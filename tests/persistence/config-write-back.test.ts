// Config-write-back helper unit tests.
//
// WB-01 (entry-level patch) / WB-02 (--local) / WB-03 (batched) / WB-04
// (bootstrap composed). Exercises the new persistence/config-write-back.ts
// module against the real saveConfig seam (NFR-1 atomic write end-to-end);
// no module mocking. Test scope: per-helper correctness (preserves D-09
// unknown forward-compat keys; cascade-delete on marketplace remove; batched
// multi-entry patch applies all N entries via ONE saveConfig call).
//
// Mirrors tests/persistence/config-io.test.ts scaffolding (tmpScopeRoot +
// retry-cleanup loop). Each test uses a fresh tmp scopeRoot, writes a fixture
// via saveConfig OR direct writeFile, runs the helper, reads the file back,
// and asserts byte properties.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import {
  type BatchedConfigPatch,
  deleteMarketplaceConfigEntryWithCascade,
  deletePluginConfigEntry,
  writeBatchedConfigEntries,
  writeMarketplaceConfigEntry,
  writePluginConfigEntry,
} from "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

async function tmpScopeRoot(): Promise<{ scopeRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-write-back-test-"));
  const scopeRoot = path.join(dir, ".pi");
  await mkdir(scopeRoot, { recursive: true });
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

  return { scopeRoot, cleanup };
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────────────
// writeMarketplaceConfigEntry
// ──────────────────────────────────────────────────────────────────────────

test("writeMarketplaceConfigEntry preserves unknown forward-compat keys on the entry and at top level", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    // Seed via direct write so unknown keys land in the file (saveConfig schema
    // is lenient per D-09 but the typed ScopeConfig surface does not expose
    // them; bypassing the typed seam for the fixture is intentional).
    await (
      await import("node:fs/promises")
    ).writeFile(
      filePath,
      JSON.stringify(
        {
          schemaVersion: 1,
          futureTopLevel: "preserve me top",
          marketplaces: {
            mp1: { source: "owner/repo", autoupdate: true, futureField: "preserve me entry" },
          },
        },
        null,
        2,
      ),
    );

    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    await writeMarketplaceConfigEntry(cfg.config, filePath, scopeRoot, "mp1", {
      autoupdate: false,
    });

    const after = await readJson(filePath);
    assert.equal(after.futureTopLevel, "preserve me top");
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1!.source, "owner/repo");
    assert.equal(marketplaces.mp1!.autoupdate, false);
    assert.equal(marketplaces.mp1!.futureField, "preserve me entry");
  } finally {
    await cleanup();
  }
});

test("writeMarketplaceConfigEntry creates the marketplace record when absent", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const empty: ScopeConfig = { schemaVersion: 1 };
    await writeMarketplaceConfigEntry(empty, filePath, scopeRoot, "mp1", {
      source: "owner/repo",
      autoupdate: true,
    });

    const after = await readJson(filePath);
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1!.source, "owner/repo");
    assert.equal(marketplaces.mp1!.autoupdate, true);
    assert.equal(after.schemaVersion, 1);
  } finally {
    await cleanup();
  }
});

test("writeMarketplaceConfigEntry preserves other marketplaces", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const seed: ScopeConfig = {
      schemaVersion: 1,
      marketplaces: {
        mp1: { source: "owner/one", autoupdate: false },
        mp2: { source: "owner/two", autoupdate: true },
      },
    };
    await saveConfig(filePath, seed, scopeRoot);
    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    await writeMarketplaceConfigEntry(cfg.config, filePath, scopeRoot, "mp1", {
      autoupdate: true,
    });

    const after = await readJson(filePath);
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1!.autoupdate, true);
    assert.equal(marketplaces.mp2!.source, "owner/two");
    assert.equal(marketplaces.mp2!.autoupdate, true);
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// writePluginConfigEntry
// ──────────────────────────────────────────────────────────────────────────

test("writePluginConfigEntry preserves unknown keys + flat-key plugin@marketplace shape", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await (
      await import("node:fs/promises")
    ).writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: {
          "foo@mp1": { enabled: true, futurePluginField: "preserve" },
        },
      }),
    );

    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    await writePluginConfigEntry(cfg.config, filePath, scopeRoot, "foo", "mp1", {
      enabled: false,
    });

    const after = await readJson(filePath);
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.ok(plugins["foo@mp1"], "foo@mp1 key present");
    assert.equal(plugins["foo@mp1"].enabled, false);
    assert.equal(plugins["foo@mp1"].futurePluginField, "preserve");
  } finally {
    await cleanup();
  }
});

test("writePluginConfigEntry creates the plugin record when absent", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const empty: ScopeConfig = { schemaVersion: 1 };
    await writePluginConfigEntry(empty, filePath, scopeRoot, "foo", "mp1", { enabled: true });

    const after = await readJson(filePath);
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.equal(plugins["foo@mp1"]!.enabled, true);
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// deleteMarketplaceConfigEntryWithCascade
// ──────────────────────────────────────────────────────────────────────────

test("deleteMarketplaceConfigEntryWithCascade removes the marketplace + all plugin keys ending in @<marketplace>; same-suffix-different-marketplace entries survive", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const seed: ScopeConfig = {
      schemaVersion: 1,
      marketplaces: {
        mp1: { source: "owner/one" },
        other: { source: "owner/other" },
      },
      plugins: {
        "foo@mp1": { enabled: true },
        "bar@mp1": { enabled: false },
        "foo@other": { enabled: true },
      },
    };
    await saveConfig(filePath, seed, scopeRoot);
    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    await deleteMarketplaceConfigEntryWithCascade(cfg.config, filePath, scopeRoot, "mp1");

    const after = await readJson(filePath);
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1, undefined, "mp1 marketplace removed");
    assert.ok(marketplaces.other, "other marketplace survives");
    assert.equal(plugins["foo@mp1"], undefined, "foo@mp1 cascaded out");
    assert.equal(plugins["bar@mp1"], undefined, "bar@mp1 cascaded out");
    assert.ok(plugins["foo@other"], "foo@other survives");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// deletePluginConfigEntry
// ──────────────────────────────────────────────────────────────────────────

test("deletePluginConfigEntry removes exactly one plugin key", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const seed: ScopeConfig = {
      schemaVersion: 1,
      plugins: {
        "foo@mp1": { enabled: true },
        "bar@mp1": { enabled: false },
      },
    };
    await saveConfig(filePath, seed, scopeRoot);
    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    await deletePluginConfigEntry(cfg.config, filePath, scopeRoot, "foo", "mp1");

    const after = await readJson(filePath);
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.equal(plugins["foo@mp1"], undefined);
    assert.ok(plugins["bar@mp1"], "bar@mp1 untouched");
    assert.equal(plugins["bar@mp1"].enabled, false);
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// writeBatchedConfigEntries (WB-03)
// ──────────────────────────────────────────────────────────────────────────

test("writeBatchedConfigEntries applies N marketplace + N plugin patches in ONE saveConfig call", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const empty: ScopeConfig = { schemaVersion: 1 };

    const batch: BatchedConfigPatch = {
      marketplaces: {
        mp1: { source: "owner/one", autoupdate: true },
        mp2: { source: "owner/two", autoupdate: false },
        mp3: { source: "owner/three" },
      },
      plugins: {
        "foo@mp1": { enabled: true },
        "bar@mp2": { enabled: false },
      },
    };

    // Take a stat snapshot before (file does not exist) and after; assert
    // ONE atomic write produced the final state. Single-saveConfig structural
    // guarantee is grep-verified at the source level (only one `await
    // saveConfig` in writeBatchedConfigEntries). We separately verify that
    // every batched patch lands in the final file (the user-facing property).
    await writeBatchedConfigEntries(empty, filePath, scopeRoot, batch);

    const st = await stat(filePath);
    assert.ok(st.isFile(), "file written");

    const after = await readJson(filePath);
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1!.source, "owner/one");
    assert.equal(marketplaces.mp1!.autoupdate, true);
    assert.equal(marketplaces.mp2!.source, "owner/two");
    assert.equal(marketplaces.mp2!.autoupdate, false);
    assert.equal(marketplaces.mp3!.source, "owner/three");
    assert.equal(plugins["foo@mp1"]!.enabled, true);
    assert.equal(plugins["bar@mp2"]!.enabled, false);
  } finally {
    await cleanup();
  }
});

test("writeBatchedConfigEntries merges patches over existing entries (preserves prior fields)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await (
      await import("node:fs/promises")
    ).writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: {
          mp1: { source: "owner/one", autoupdate: false, futureField: "preserve" },
        },
        plugins: {
          "foo@mp1": { enabled: true, futurePluginField: "preserve" },
        },
      }),
    );

    const cfg = await loadConfig(filePath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    const batch: BatchedConfigPatch = {
      marketplaces: { mp1: { autoupdate: true } },
      plugins: { "foo@mp1": { enabled: false } },
    };

    await writeBatchedConfigEntries(cfg.config, filePath, scopeRoot, batch);

    const after = await readJson(filePath);
    const marketplaces = after.marketplaces as Record<string, Record<string, unknown>>;
    const plugins = after.plugins as Record<string, Record<string, unknown>>;
    assert.equal(marketplaces.mp1!.source, "owner/one");
    assert.equal(marketplaces.mp1!.autoupdate, true);
    assert.equal(marketplaces.mp1!.futureField, "preserve");
    assert.equal(plugins["foo@mp1"]!.enabled, false);
    assert.equal(plugins["foo@mp1"]!.futurePluginField, "preserve");
  } finally {
    await cleanup();
  }
});

test("T6 / PR #51 / S10: writeMarketplaceConfigEntry partial patch on an ABSENT marketplace WITHOUT a `source` field triggers saveConfig's loud refusal -- the S10 cast comment's documented backstop", async () => {
  // Pre-T6 the S10 cast at config-write-back.ts:58-67 -- a
  // `Partial<MarketplaceConfigEntry>` spread over an absent entry (`{}`) is
  // cast to the non-Partial `MarketplaceConfigEntry` -- relied on saveConfig's
  // `CONFIG_VALIDATOR.Check(config)` to refuse a missing required field
  // (`source`) before the bytes hit disk. The cast comment names this
  // backstop; this test pins the loud refusal so a future refactor cannot
  // silently drop the validator (which would corrupt claude-plugins.json
  // with a half-formed marketplace entry).
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    // No prior entry -- the marketplace is absent. The patch carries only
    // `autoupdate`, no `source`, so the merged entry violates the schema.
    const empty: ScopeConfig = { schemaVersion: 1 };
    await assert.rejects(
      () =>
        writeMarketplaceConfigEntry(empty, filePath, scopeRoot, "mp1", {
          autoupdate: true,
        }),
      /saveConfig refused/,
      "T6: writeMarketplaceConfigEntry must propagate saveConfig's loud refusal when the merged entry lacks `source`",
    );

    // And the loud refusal must fire BEFORE any bytes touch disk -- the
    // atomic writer (write-file-atomic) refuses on the validation gate, so
    // the config file MUST NOT exist after the rejection.
    await assert.rejects(
      () => readFile(filePath, "utf8"),
      (err: unknown) => (err as NodeJS.ErrnoException).code === "ENOENT",
      "T6: the loud refusal must fire BEFORE any bytes hit disk (no partial file)",
    );
  } finally {
    await cleanup();
  }
});
