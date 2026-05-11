import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildItem,
  extractPositionals,
  getMarketplaceNamesAcrossScopes,
  getPluginToMarketplacesMap,
  splitCompletionInput,
} from "../../../extensions/claude-marketplace/edge/completions/data.ts";
import { __resetCacheForTests } from "../../../extensions/claude-marketplace/shared/completion-cache.ts";

import type { LocationsResolver } from "../../../extensions/claude-marketplace/edge/completions/data.ts";
import type { PluginIndexRow } from "../../../extensions/claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/claude-marketplace/shared/types.ts";

/**
 * Wave 2 / Plan 06-03 tests for edge/completions/data.ts.
 *
 * Each test builds a hermetic LocationsResolver mock with in-memory state +
 * manifest fixtures and a fresh tmpdir-rooted cache path. Tests call
 * `__resetCacheForTests()` to clear the shared module-level memory maps
 * between cases.
 */

interface ResolverFixture {
  readonly resolver: LocationsResolver;
  cleanup(): Promise<void>;
}

async function makeResolver(spec: {
  readonly state: Partial<Record<Scope, Record<string, { manifestPath?: string }>>>;
  readonly manifests: Partial<Record<Scope, Record<string, readonly PluginIndexRow[]>>>;
}): Promise<ResolverFixture> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "data-test-"));
  const resolver: LocationsResolver = {
    marketplaceNamesCachePath(scope: Scope): string {
      return path.join(dir, scope, "marketplace-names.json");
    },

    pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
      return Promise.resolve(path.join(dir, scope, "plugins", `${marketplace}.json`));
    },

    loadStateForScope(scope: Scope): Promise<{
      marketplaces: Record<string, { manifestPath?: string }>;
    }> {
      const scopeState = spec.state[scope];
      if (scopeState === undefined) {
        return Promise.resolve({ marketplaces: {} });
      }

      return Promise.resolve({ marketplaces: scopeState });
    },

    loadManifestForMarketplace(
      scope: Scope,
      marketplace: string,
    ): Promise<readonly PluginIndexRow[]> {
      const scopeManifests = spec.manifests[scope];
      const rows = scopeManifests?.[marketplace];
      if (rows === undefined) {
        return Promise.reject(new Error(`manifest missing for ${scope}/${marketplace}`));
      }

      return Promise.resolve(rows);
    },
  };

  return {
    resolver,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

test("buildItem :: reconstructs argumentText prefix + chosen text + trailing space", () => {
  __resetCacheForTests();
  const empty = buildItem("", "install", true);
  assert.deepEqual(empty, { label: "install", value: "install " });

  const nonEmpty = buildItem("install", "p@mp", true);
  assert.deepEqual(nonEmpty, { label: "p@mp", value: "install p@mp " });

  const nonTerminal = buildItem("install", "p@", false);
  assert.deepEqual(nonTerminal, { label: "p@", value: "install p@" });
});

test("splitCompletionInput :: trailing space yields empty current and full tokens", () => {
  __resetCacheForTests();
  const out = splitCompletionInput("install foo@bar ");
  assert.deepEqual(out, { tokens: ["install", "foo@bar"], current: "" });
});

test("splitCompletionInput :: no trailing space yields last token as current", () => {
  __resetCacheForTests();
  const out = splitCompletionInput("install fo");
  assert.deepEqual(out, { tokens: ["install"], current: "fo" });

  const empty = splitCompletionInput("");
  assert.deepEqual(empty, { tokens: [], current: "" });
});

test("extractPositionals :: skips --scope <value> pairs", () => {
  __resetCacheForTests();
  const out = extractPositionals(["install", "--scope", "user", "p@mp"]);
  assert.deepEqual(out, ["install", "p@mp"]);

  const middle = extractPositionals(["--scope", "project", "list", "mp"]);
  assert.deepEqual(middle, ["list", "mp"]);
});

// ---------------------------------------------------------------------------
// Cache-backed accessors.
// ---------------------------------------------------------------------------

test("getMarketplaceNamesAcrossScopes :: dedupes overlapping names from user and project", async () => {
  __resetCacheForTests();
  const fixture = await makeResolver({
    state: {
      user: { mp1: {}, mp2: {} },
      project: { mp2: {}, mp3: {} },
    },
    manifests: { user: {}, project: {} },
  });
  try {
    const names = await getMarketplaceNamesAcrossScopes(fixture.resolver);
    assert.deepEqual([...names].sort(), ["mp1", "mp2", "mp3"]);
  } finally {
    await fixture.cleanup();
  }
});

test("getPluginToMarketplacesMap :: install mode filters status === installed out, keeps available + unavailable", async () => {
  __resetCacheForTests();
  const fixture = await makeResolver({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-installed", status: "installed" },
          { name: "p-avail", status: "available" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const map = await getPluginToMarketplacesMap("install", fixture.resolver);
    // p-installed must be excluded; p-avail + p-unavail (D-03 corollary) must remain.
    assert.equal(map.has("p-installed"), false);
    assert.deepEqual(map.get("p-avail"), ["mp"]);
    assert.deepEqual(map.get("p-unavail"), ["mp"]);
  } finally {
    await fixture.cleanup();
  }
});

test("getPluginToMarketplacesMap :: uninstall mode keeps only installed", async () => {
  __resetCacheForTests();
  const fixture = await makeResolver({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-installed", status: "installed" },
          { name: "p-avail", status: "available" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const map = await getPluginToMarketplacesMap("uninstall", fixture.resolver);
    assert.deepEqual(map.get("p-installed"), ["mp"]);
    assert.equal(map.has("p-avail"), false);
    assert.equal(map.has("p-unavail"), false);
  } finally {
    await fixture.cleanup();
  }
});

test("getPluginToMarketplacesMap :: update mode keeps only installed", async () => {
  __resetCacheForTests();
  const fixture = await makeResolver({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-installed", status: "installed" },
          { name: "p-avail", status: "available" },
        ],
      },
      project: {},
    },
  });
  try {
    const map = await getPluginToMarketplacesMap("update", fixture.resolver);
    assert.deepEqual(map.get("p-installed"), ["mp"]);
    assert.equal(map.has("p-avail"), false);
  } finally {
    await fixture.cleanup();
  }
});

test("getPluginToMarketplacesMap :: cross-marketplace plugin appears with both marketplace names", async () => {
  __resetCacheForTests();
  const fixture = await makeResolver({
    state: {
      user: { "mp-a": {}, "mp-b": {} },
      project: {},
    },
    manifests: {
      user: {
        "mp-a": [{ name: "shared", status: "installed" }],
        "mp-b": [{ name: "shared", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const map = await getPluginToMarketplacesMap("uninstall", fixture.resolver);
    const mps = map.get("shared");
    assert.ok(mps !== undefined);
    assert.deepEqual([...mps].sort(), ["mp-a", "mp-b"]);
  } finally {
    await fixture.cleanup();
  }
});
