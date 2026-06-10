import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { githubSource, pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  CONFIG_VALIDATOR,
  loadConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  buildConfigFromState,
  migrateFirstRunConfig,
  type MigrateFirstRunResult,
} from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * MIG-01 (lossless first-run generation from state.json -> claude-plugins.json)
 * + MIG-02 (atomic, idempotent, no-overwrite, convergence-ready) test suite.
 *
 * HAZARD (deferred to Phase 55 -- load wiring):
 *   - Pitfall 52-2: concurrent first-loads racing on the same scope. The
 *     Phase 55 call site MUST invoke `migrateFirstRunConfig` inside the
 *     scope's `withStateGuard` lock so two processes do not both see
 *     `absent` and race the projection. This phase 52 seam is a pure data
 *     transform + a single ENOENT-gated write -- the lock-coverage proof
 *     belongs in Phase 55, not here.
 *   - Pitfall 52-4: D-13 gate race. The legacy `autoupdate` field is kept
 *     in-memory on the FIRST load (existsSync gate CLOSED) so this phase 52
 *     migration can capture it. The ordering rail (migrate-then-scrub) is
 *     owned by the Phase 55 load wiring, not by this seam.
 *
 * The planner-level convergence proof
 *   `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state)
 *    deepEqual { adds:[], installs:[], removes:[], uninstalls:[],
 *                transitions:[] }`
 * is DEFERRED to Phase 53 where `planReconcile` lands. Section D below
 * exercises the DATA-level surrogate (key-set + provenance equality) that
 * Phase 52 owns; the planner-level no-op proof is a Phase 53 obligation.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/legacy");

/**
 * Load the populated fixture and normalize its `source` strings to
 * `ParsedSource` objects, matching the post-`loadState` in-memory shape.
 * (The fixture file is the on-disk raw shape; `loadState` runs
 * `normalizeStoredSource` to turn each string into a ParsedSource. The
 * test owns this normalization at the boundary so the fixture itself
 * stays a faithful state.json transcript.)
 */
async function loadPopulatedState(): Promise<ExtensionState> {
  const raw = JSON.parse(
    await readFile(path.join(FIXTURES, "state-populated-mixed.json"), "utf8"),
  ) as { marketplaces: Record<string, Record<string, unknown>> };

  for (const mp of Object.values(raw.marketplaces)) {
    const src = mp["source"];
    if (typeof src === "string") {
      if (
        src.startsWith("./") ||
        src.startsWith("../") ||
        src.startsWith("/") ||
        src === "~" ||
        src.startsWith("~/")
      ) {
        mp["source"] = pathSource(src);
      } else {
        mp["source"] = githubSource(src);
      }
    }
  }

  return { schemaVersion: 1, ...raw } as unknown as ExtensionState;
}

async function tmpScopeRoot(): Promise<{
  scopeRoot: string;
  tmpDir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-migrate-config-test-"));
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

  return { scopeRoot, tmpDir: dir, cleanup };
}

// ──────────────────────────────────────────────────────────────────────────
// Section A -- buildConfigFromState pure projection (MIG-01)
// ──────────────────────────────────────────────────────────────────────────

test("MIG-01 losslessness: every state marketplace + plugin appears in the generated config", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.deepEqual(
    Object.keys(cfg.marketplaces ?? {}).sort(),
    Object.keys(state.marketplaces).sort(),
  );
  const expectedPluginKeys: string[] = [];
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const pluginName of Object.keys(mp.plugins)) {
      expectedPluginKeys.push(`${pluginName}@${mpName}`);
    }
  }

  assert.deepEqual(Object.keys(cfg.plugins ?? {}).sort(), expectedPluginKeys.sort());
});

test("MIG-01 Pitfall 52-1: soft-degraded plugin (installable: false) is included", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.ok("soft-degraded@mp-path" in (cfg.plugins ?? {}));
});

test("MIG-01 Pitfall 52-3: source recovered byte-stably from the .raw field", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.equal(cfg.marketplaces?.["mp-path"]?.source, "./mp-path-local");
  assert.equal(cfg.marketplaces?.["mp-github"]?.source, "acme/tools");
});

test("MIG-01 D-13: legacy autoupdate=true is captured", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.equal(cfg.marketplaces?.["mp-path"]?.autoupdate, true);
});

test("MIG-01 D-04: missing autoupdate is omitted (not emitted as undefined)", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  const entry = cfg.marketplaces?.["mp-github"];
  assert.ok(entry, "mp-github entry must exist");
  assert.equal(entry.autoupdate, undefined);
  assert.equal("autoupdate" in entry, false);
});

test("MIG-01 D-04: explicit autoupdate=false is preserved", () => {
  // SPLIT-01 cast: build a fabricated marketplace record with autoupdate=false
  // at the persistence layer (legacy field surface, not declared on the schema).
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      "mp-x": {
        name: "mp-x",
        scope: "user",
        source: pathSource("./mp-x"),
        addedFromCwd: "/cwd",
        manifestPath: "/abs/manifest.json",
        marketplaceRoot: "/abs/root",
        plugins: {},
        // SPLIT-01: legacy autoupdate carried on the record at runtime
        autoupdate: false,
      } as unknown as ExtensionState["marketplaces"][string],
    },
  };
  const cfg = buildConfigFromState(state);
  const entry = cfg.marketplaces?.["mp-x"];
  assert.ok(entry);
  assert.equal(entry.autoupdate, false);
});

test("MIG-01 forward-tampered autoupdate (string 'yes') is silently dropped", () => {
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      "mp-tamper": {
        name: "mp-tamper",
        scope: "user",
        source: pathSource("./mp-tamper"),
        addedFromCwd: "/cwd",
        manifestPath: "/abs/manifest.json",
        marketplaceRoot: "/abs/root",
        plugins: {},
        // SPLIT-01 / defense-in-depth: a non-boolean must fall through both
        // === true and === false checks.
        autoupdate: "yes" as unknown as boolean,
      } as unknown as ExtensionState["marketplaces"][string],
    },
  };
  const cfg = buildConfigFromState(state);
  const entry = cfg.marketplaces?.["mp-tamper"];
  assert.ok(entry);
  assert.equal("autoupdate" in entry, false);
});

test("MIG-01 NFR-12 regression: raw-less unknown-kind source coerces to its JSON string (never wedges)", () => {
  // ST-6 shape 3: loadState admits an unknown-kind source object verbatim
  // WITHOUT checking that `raw` exists (state-io.ts normalizeStoredSource).
  // Before the guard, the projection emitted { source: undefined }, which
  // failed CONFIG_VALIDATOR inside saveConfig and wedged first-run migration
  // permanently (the ENOENT arm re-fired identically on every load).
  const forwardCompatSource = { kind: "unknown", reason: "future kind" };
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      "mp-forward": {
        name: "mp-forward",
        scope: "user",
        source: forwardCompatSource,
        addedFromCwd: "/cwd",
        manifestPath: "/abs/manifest.json",
        marketplaceRoot: "/abs/root",
        plugins: {},
      } as unknown as ExtensionState["marketplaces"][string],
    },
  };
  const cfg = buildConfigFromState(state);
  // Policy: coerce the record to its JSON string (objectRaw precedent in
  // domain/source.ts) -- the marketplace is preserved, not dropped, and the
  // emitted source is always a string. NOTE: sourceLogical() is NOT a safe
  // fallback here -- its `unknown` arm returns `.raw`, i.e. undefined.
  assert.equal(cfg.marketplaces?.["mp-forward"]?.source, JSON.stringify(forwardCompatSource));
  // The wedge fired as a CONFIG_VALIDATOR failure inside saveConfig; pin
  // validity of the projection itself.
  assert.equal(CONFIG_VALIDATOR.Check(cfg), true);
});

test("MIG-01 NFR-12 regression: unknown-kind source WITH string raw recovers raw byte-stably", () => {
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      "mp-forward-raw": {
        name: "mp-forward-raw",
        scope: "user",
        source: { kind: "unknown", raw: "future://thing", reason: "future kind" },
        addedFromCwd: "/cwd",
        manifestPath: "/abs/manifest.json",
        marketplaceRoot: "/abs/root",
        plugins: {},
      } as unknown as ExtensionState["marketplaces"][string],
    },
  };
  const cfg = buildConfigFromState(state);
  assert.equal(cfg.marketplaces?.["mp-forward-raw"]?.source, "future://thing");
});

test("MIG-01 Pitfall 52-6: same-named plugin across two marketplaces does not collide", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.ok("code-reviewer@mp-path" in (cfg.plugins ?? {}));
  assert.ok("code-reviewer@mp-github" in (cfg.plugins ?? {}));
});

test("MIG-01 plugin entry body is the empty object (D-04: defaults at consume time)", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.deepEqual(cfg.plugins?.["code-reviewer@mp-path"], {});
});

test("MIG-01 D-11: schemaVersion is emitted as the literal 1", async () => {
  const state = await loadPopulatedState();
  const cfg = buildConfigFromState(state);
  assert.equal(cfg.schemaVersion, 1);
});

// ──────────────────────────────────────────────────────────────────────────
// Section B -- migrateFirstRunConfig ENOENT-arm integration (MIG-02 happy path)
// ──────────────────────────────────────────────────────────────────────────

test("MIG-02 happy path: ENOENT triggers migration; result.migrated true with correct count", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    const state = await loadPopulatedState();
    const result: MigrateFirstRunResult = await migrateFirstRunConfig(loc, state);
    assert.equal(result.migrated, true);
    // 2 marketplaces + 3 plugin flat keys (cr@mp-path, soft-degraded@mp-path, cr@mp-github)
    assert.equal(result.entryCount, 5);
    assert.equal(result.filePath, loc.configJsonPath);
  } finally {
    await cleanup();
  }
});

test("MIG-02 atomicity proxy: written file passes CONFIG_VALIDATOR (loadConfig 'valid')", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    const state = await loadPopulatedState();
    await migrateFirstRunConfig(loc, state);
    const reloaded = await loadConfig(loc.configJsonPath);
    assert.equal(reloaded.status, "valid");
    if (reloaded.status === "valid") {
      assert.deepEqual(reloaded.config, buildConfigFromState(state));
    }
  } finally {
    await cleanup();
  }
});

test("MIG-02 round-trip preserves the path-source raw string byte-for-byte", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    const state = await loadPopulatedState();
    await migrateFirstRunConfig(loc, state);
    const reloaded = await loadConfig(loc.configJsonPath);
    assert.equal(reloaded.status, "valid");
    if (reloaded.status === "valid") {
      assert.equal(reloaded.config.marketplaces?.["mp-path"]?.source, "./mp-path-local");
      assert.equal(reloaded.config.marketplaces?.["mp-github"]?.source, "acme/tools");
    }
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Section C -- idempotency / no-overwrite guards (MIG-02 + Pitfall 52-5)
// ──────────────────────────────────────────────────────────────────────────

test("MIG-02 idempotency: second call short-circuits and does not rewrite the file", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    const state = await loadPopulatedState();
    await migrateFirstRunConfig(loc, state);
    const mtimeBefore = (await stat(loc.configJsonPath)).mtimeMs;
    // Give the FS a beat so a hypothetical re-write would have a different mtime.
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    const second = await migrateFirstRunConfig(loc, state);
    assert.equal(second.migrated, false);
    if (!second.migrated) {
      assert.equal(second.reason, "existing-valid");
      assert.equal(second.error, undefined);
    }

    assert.equal(second.filePath, loc.configJsonPath);
    const mtimeAfter = (await stat(loc.configJsonPath)).mtimeMs;
    assert.equal(mtimeAfter, mtimeBefore);
  } finally {
    await cleanup();
  }
});

test("Pitfall 52-5: pre-existing 0-byte claude-plugins.json is NOT overwritten", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    await writeFile(loc.configJsonPath, "");
    const state = await loadPopulatedState();
    const result = await migrateFirstRunConfig(loc, state);
    assert.equal(result.migrated, false);
    if (!result.migrated) {
      // CFG-03: 0-byte file is the `invalid` arm; the loadConfig detail rides
      // along so the Phase 55 caller can surface it without a second probe.
      assert.equal(result.reason, "existing-invalid");
      assert.match(result.error ?? "", /JSON parse failed/);
    }

    assert.equal(await readFile(loc.configJsonPath, "utf8"), "");
  } finally {
    await cleanup();
  }
});

test("Pitfall 52-5: pre-existing VALID claude-plugins.json is NOT overwritten", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    const preExisting = JSON.stringify({
      schemaVersion: 1,
      marketplaces: { "user-already-declared": { source: "user/manual" } },
    });
    await writeFile(loc.configJsonPath, preExisting);
    const state = await loadPopulatedState();
    const result = await migrateFirstRunConfig(loc, state);
    assert.equal(result.migrated, false);
    if (!result.migrated) {
      assert.equal(result.reason, "existing-valid");
      assert.equal(result.error, undefined);
    }

    assert.equal(await readFile(loc.configJsonPath, "utf8"), preExisting);
  } finally {
    await cleanup();
  }
});

test("Pitfall 52-5: pre-existing INVALID (schema-failing) claude-plugins.json is NOT overwritten", async () => {
  const { tmpDir, cleanup } = await tmpScopeRoot();
  try {
    const loc = locationsFor("project", tmpDir);
    await mkdir(loc.scopeRoot, { recursive: true });
    // source: 42 violates Type.String(); loadConfig returns 'invalid'.
    const preExisting = JSON.stringify({ marketplaces: { mp: { source: 42 } } });
    await writeFile(loc.configJsonPath, preExisting);
    const state = await loadPopulatedState();
    const result = await migrateFirstRunConfig(loc, state);
    assert.equal(result.migrated, false);
    if (!result.migrated) {
      assert.equal(result.reason, "existing-invalid");
      assert.match(result.error ?? "", /schema validation failed/);
    }

    assert.equal(await readFile(loc.configJsonPath, "utf8"), preExisting);
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Section D -- data-level convergence (MIG-02 SC#4 here)
//
// The planner-level no-op convergence test --
//   planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state)
//     deepEqual { adds:[], installs:[], removes:[], uninstalls:[],
//                 transitions:[] }
// -- is DEFERRED to Phase 53 where `planReconcile` lands. This data-level
// convergence (key-set + provenance equality on the merged view) is the
// Phase 52 surrogate.
// ──────────────────────────────────────────────────────────────────────────

test("MIG-02 data-level convergence: merged marketplaces key set === state key set", async () => {
  const state = await loadPopulatedState();
  const merged = mergeScopeConfigs(buildConfigFromState(state), {});
  assert.deepEqual(Object.keys(merged.marketplaces).sort(), Object.keys(state.marketplaces).sort());
});

test("MIG-02 data-level convergence: merged plugin key set === flat `${plugin}@${mp}` keys from state", async () => {
  const state = await loadPopulatedState();
  const merged = mergeScopeConfigs(buildConfigFromState(state), {});
  const expected: string[] = [];
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const pluginName of Object.keys(mp.plugins)) {
      expected.push(`${pluginName}@${mpName}`);
    }
  }

  assert.deepEqual(Object.keys(merged.plugins).sort(), expected.sort());
});

test("MIG-02 data-level convergence: every merged entry has provenance source='base'", async () => {
  const state = await loadPopulatedState();
  const merged = mergeScopeConfigs(buildConfigFromState(state), {});
  for (const entry of Object.values(merged.marketplaces)) {
    assert.equal(entry.source, "base");
  }

  for (const entry of Object.values(merged.plugins)) {
    assert.equal(entry.source, "base");
  }
});
