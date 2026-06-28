import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getArgumentCompletions } from "../../../extensions/pi-claude-marketplace/edge/completions/provider.ts";
import { __resetCacheForTests } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { LocationsResolver } from "../../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { PluginIndexRow } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * Tests for edge/completions/provider.ts (TC-1..TC-9 integration + null
 * sentinel + branching dispatch).
 *
 * The provider is a pure function of (prefix, resolver); resolver is a
 * test-built mock that captures call counts + throws to exercise TC-8/TC-9.
 */

interface FixtureSpec {
  readonly state: Partial<Record<Scope, Record<string, { manifestPath?: string }>>>;
  readonly manifests: Partial<Record<Scope, Record<string, readonly PluginIndexRow[]>>>;
  /** When set, loadStateForScope(scope) rejects with this error for the named scope. */
  readonly stateThrows?: Partial<Record<Scope, Error>>;
  /** When set, loadManifestForMarketplace rejects with this error for the named marketplace. */
  readonly manifestThrows?: Partial<Record<Scope, Record<string, Error>>>;
}

interface Fixture {
  readonly resolver: LocationsResolver;
  cleanup(): Promise<void>;
}

async function makeFixture(spec: FixtureSpec): Promise<Fixture> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "provider-test-"));
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
      const throwErr = spec.stateThrows?.[scope];
      if (throwErr !== undefined) {
        return Promise.reject(throwErr);
      }

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
      const throwErr = spec.manifestThrows?.[scope]?.[marketplace];
      if (throwErr !== undefined) {
        return Promise.reject(throwErr);
      }

      const rows = spec.manifests[scope]?.[marketplace];
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

async function emptyFixture(): Promise<Fixture> {
  return makeFixture({ state: {}, manifests: {} });
}

// ---------------------------------------------------------------------------
// TC-1 -- top-level subcommand keywords.
// ---------------------------------------------------------------------------

test("TC-1 :: first positional surfaces top-level keywords (bootstrap/install/uninstall/update/reinstall/list/ls/info/pending/enable/disable/import/marketplace)", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    // INFO-02: `info` added to TOP_LEVEL_SUBCOMMANDS for the
    // `info <plugin>@<marketplace>` top-level verb. DIFF-01 SC #2:
    // `pending` added for the `/claude:plugin pending` read-only diff
    // command. D-54-01: `enable` / `disable` added for the enable/disable
    // surface (ENBL-01..04).
    assert.deepEqual([...labels].sort(), [
      "bootstrap",
      "disable",
      "enable",
      "import",
      "info",
      "install",
      "list",
      "ls",
      "marketplace",
      "pending",
      "reinstall",
      "uninstall",
      "update",
    ]);
    // All terminal completions get a trailing space (TC-7 cross-check).
    for (const item of items) {
      assert.match(item.value, / $/, `expected trailing space in value: ${item.value}`);
    }
  } finally {
    await f.cleanup();
  }
});

test('TC-1 :: top-level keyword filtering by prefix ("ins" -> install only)', async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("ins", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["install"],
    );
  } finally {
    await f.cleanup();
  }
});

test('TC-1 :: top-level keyword filtering by prefix ("l" -> list and ls)', async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("l", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["list", "ls"],
    );
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: top-level rei completes to reinstall with trailing space", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("rei", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(items, [{ label: "reinstall", value: "reinstall " }]);
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-2 -- nested marketplace subcommand keywords.
// ---------------------------------------------------------------------------

test("TC-2 :: after marketplace surfaces nested keywords and aliases", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("marketplace ", f.resolver);
    assert.ok(items !== null);
    // INFO-06: `info` added to MARKETPLACE_SUBCOMMANDS for
    // `marketplace info <name>` argument completion (TC-5 via the
    // MARKETPLACE_VERBS_WITH_NAME_ARG set).
    assert.deepEqual([...items.map((i) => i.label)].sort(), [
      "add",
      "autoupdate",
      "info",
      "list",
      "ls",
      "noautoupdate",
      "remove",
      "rm",
      "update",
    ]);
  } finally {
    await f.cleanup();
  }
});

test("TC-2 :: nested keyword prefix surfaces rm and ls aliases", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const rmItems = await getArgumentCompletions("marketplace r", f.resolver);
    assert.ok(rmItems !== null);
    assert.deepEqual(
      rmItems.map((i) => i.label),
      ["remove", "rm"],
    );

    const lsItems = await getArgumentCompletions("marketplace l", f.resolver);
    assert.ok(lsItems !== null);
    assert.deepEqual(
      lsItems.map((i) => i.label),
      ["list", "ls"],
    );
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-3 -- flag-name completion.
// ---------------------------------------------------------------------------

test("TC-3 :: - prefix surfaces --scope", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("install -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("--scope"));
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: - prefix on list head also surfaces --installed/--available/--unavailable", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("list -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    for (const expected of [
      "--scope",
      "--installed",
      "--available",
      "--unavailable",
      "--unsupported",
    ]) {
      assert.ok(labels.includes(expected), `expected ${expected} in: ${labels.join(", ")}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: - prefix on ls alias also surfaces --installed/--available/--unavailable", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("ls -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    for (const expected of [
      "--scope",
      "--installed",
      "--available",
      "--unavailable",
      "--unsupported",
    ]) {
      assert.ok(labels.includes(expected), `expected ${expected} in: ${labels.join(", ")}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: - prefix on install head surfaces --map-model (260516-08j)", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("install -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    for (const expected of ["--scope", "--map-model"]) {
      assert.ok(labels.includes(expected), `expected ${expected} in: ${labels.join(", ")}`);
    }

    // list-only flags MUST NOT leak into install completions.
    for (const unexpected of ["--installed", "--available", "--unavailable", "--unsupported"]) {
      assert.ok(!labels.includes(unexpected), `unexpected ${unexpected} in: ${labels.join(", ")}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: - prefix on update head surfaces --map-model (260516-08j)", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("update -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    for (const expected of ["--scope", "--map-model"]) {
      assert.ok(labels.includes(expected), `expected ${expected} in: ${labels.join(", ")}`);
    }

    // list-only flags MUST NOT leak into update completions.
    for (const unexpected of ["--installed", "--available", "--unavailable", "--unsupported"]) {
      assert.ok(!labels.includes(unexpected), `unexpected ${unexpected} in: ${labels.join(", ")}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: --map-model does NOT appear under list head (260516-08j)", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("list -", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(!labels.includes("--map-model"), `unexpected --map-model in: ${labels.join(", ")}`);
  } finally {
    await f.cleanup();
  }
});

test("TC-3 :: -- and - prefixes behave identically", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const single = await getArgumentCompletions("install -", f.resolver);
    const double = await getArgumentCompletions("install --", f.resolver);
    assert.ok(single !== null);
    assert.ok(double !== null);
    assert.deepEqual(
      single.map((i) => i.label),
      double.map((i) => i.label),
    );
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 / RINST-01 :: reinstall flag completion excludes --force; --scope still offered", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const reinstallItems = await getArgumentCompletions("reinstall -", f.resolver);
    assert.ok(reinstallItems !== null);
    // D-67-03: `--force` is retired from the reinstall completion surface.
    assert.equal(
      reinstallItems.some((i) => i.label === "--force"),
      false,
    );
    assert.ok(reinstallItems.some((i) => i.label === "--scope"));

    // LIST-02 / D-67-02: `--force` is now a completion flag for install/update
    // (the force-gated candidate sets), so those heads are NOT in this
    // exclusion list. uninstall/list/ls/marketplace never carry `--force`.
    for (const head of ["uninstall", "list", "ls", "marketplace"]) {
      const items = await getArgumentCompletions(`${head} -`, f.resolver);
      assert.ok(items !== null, head);
      assert.equal(
        items.some((i) => i.label === "--force"),
        false,
        head,
      );
    }
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-4 -- after `--scope`.
// ---------------------------------------------------------------------------

test("TC-4 :: token after --scope surfaces user and project only", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("install --scope ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["project", "user"]);
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-5 -- marketplace-name positional for list / marketplace <verb>.
// ---------------------------------------------------------------------------

test("TC-5 :: list <here> completes with union of marketplace names from both scopes", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: {
      user: { "mp-u": {} },
      project: { "mp-p": {}, "mp-u": {} },
    },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("list ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["mp-p", "mp-u"]);
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: ls <here> completes with union of marketplace names from both scopes", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: {
      user: { "mp-u": {} },
      project: { "mp-p": {}, "mp-u": {} },
    },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("ls ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["mp-p", "mp-u"]);
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace remove <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace remove ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: exact marketplace remove token without trailing space completes marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace remove", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["marketplace remove mp-a "],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace remove --scope project <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: {}, project: { "superpowers-marketplace": {} } },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions(
      "marketplace remove --scope project superpowers",
      f.resolver,
    );
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["superpowers-marketplace"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["marketplace remove --scope project superpowers-marketplace "],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace rm --scope project <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: {}, project: { "superpowers-marketplace": {} } },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions(
      "marketplace rm --scope project superpowers",
      f.resolver,
    );
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["superpowers-marketplace"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["marketplace rm --scope project superpowers-marketplace "],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace ls does not take a marketplace-name positional", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace ls ", f.resolver);
    assert.equal(items, null);
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: install --scope project <here> still completes plugin refs", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: {}, project: { mp: {} } },
    manifests: { user: {}, project: { mp: [{ name: "solo", status: "available" }] } },
  });
  try {
    const items = await getArgumentCompletions("install --scope project so", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["solo@mp"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace update <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace update ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace autoupdate <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace autoupdate ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace noautoupdate <here> completes with marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace noautoupdate ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
  } finally {
    await f.cleanup();
  }
});

// INFO-06: `marketplace info <name>` argument completion. The TC-5
// union surface is reused: candidates are the union
// of marketplace names across BOTH scopes; the `--scope` filter does NOT
// narrow the completion candidate set (the orchestrator handles scope-
// mismatch at execution time via the INFO-04 `{not added}` row).

test("TC-5 :: marketplace info <here> completes with union of marketplace names from both scopes", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: {
      user: { "mp-u": {} },
      project: { "mp-p": {} },
    },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace info ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["mp-p", "mp-u"]);
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: exact `marketplace info` token without trailing space completes marketplace names", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace info", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["marketplace info mp-a "],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-5 :: marketplace info --scope project <here> still completes union of marketplace names (scope filter does NOT narrow set)", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    // Marketplace lives in USER scope only; with `--scope project` the
    // completion still surfaces the name. The orchestrator handles the
    // mismatch at execution time via the INFO-04 `{not added}` row.
    state: { user: { "mp-a": {} }, project: {} },
    manifests: { user: {}, project: {} },
  });
  try {
    const items = await getArgumentCompletions("marketplace info --scope project mp", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["mp-a"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["marketplace info --scope project mp-a "],
    );
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-6 -- <plugin>@<marketplace> token completion (status-aware).
// ---------------------------------------------------------------------------

test("TC-6 :: install <here> -- status filter excludes installed plugins", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
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
    const items = await getArgumentCompletions("install ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.equal(
      labels.some((l) => l.startsWith("p-installed")),
      false,
    );
    assert.ok(labels.some((l) => l.startsWith("p-avail")));
  } finally {
    await f.cleanup();
  }
});

test("TC-6 / CMP-7 :: install <here> excludes unavailable plugins", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-avail", status: "available" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("install ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.some((l) => l.startsWith("p-avail")));
    assert.equal(
      labels.some((l) => l.startsWith("p-unavail")),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// CMP-6..8 -- scope-aware install completion.
// ---------------------------------------------------------------------------

test("CMP-8 :: install --scope project completes from user marketplace fallback", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: { user: { mp: [{ name: "fallback", status: "available" }] }, project: {} },
  });
  try {
    const items = await getArgumentCompletions("install --scope project fall", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["fallback@mp"],
    );
  } finally {
    await f.cleanup();
  }
});

test("CMP-8 :: project marketplace shadows same-named user marketplace in install completion", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: { mp: {} } },
    manifests: {
      user: { mp: [{ name: "user-only", status: "available" }] },
      project: { mp: [{ name: "project-only", status: "available" }] },
    },
  });
  try {
    const items = await getArgumentCompletions("install --scope project ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual(labels, ["project-only@mp"]);
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: uninstall <here> -- status filter shows only installed plugins", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
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
    const items = await getArgumentCompletions("uninstall ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.some((l) => l.startsWith("p-installed")));
    assert.equal(
      labels.some((l) => l.startsWith("p-avail")),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: exact uninstall token without trailing space completes installed plugin refs", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
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
    const items = await getArgumentCompletions("uninstall", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["p-installed@mp"],
    );
    assert.deepEqual(
      items.map((i) => i.value),
      ["uninstall p-installed@mp "],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: uninstall --scope user limits installed plugin refs to user scope", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: { mp: {} } },
    manifests: {
      user: { mp: [{ name: "user-installed", status: "installed" }] },
      project: { mp: [{ name: "project-installed", status: "installed" }] },
    },
  });
  try {
    const items = await getArgumentCompletions("uninstall --scope user ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["user-installed@mp"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: update <here> -- status filter shows only installed plugins", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
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
    const items = await getArgumentCompletions("update ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.some((l) => l.startsWith("p-installed")));
    assert.equal(
      labels.some((l) => l.startsWith("p-avail")),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

// FINDING (SNM-39 / G-MIL-07, D-25-10 -- DEFER-WITH-FINDING, host-external):
// This test proves OUR provider is CORRECT for the bare `update @` form --
// `getArgumentCompletions("update @")` returns `["@mp-a","@mp-b"]`. Yet the
// live runtime shows NOTHING (or file paths) for `/claude:plugin update @<TAB>`.
// The gap is NOT in our code; it is the host's `@`-precedence in
// `@earendil-works/pi-tui` (root-caused against the GLOBAL pi-tui 0.76.0 that
// `scripts/pi.sh` actually execs, NOT the local node_modules 0.74.2 -- the
// `@`-logic is byte-identical across both versions):
//
//   pi-tui dist/autocomplete.js (0.76.0):
//     - CombinedAutocompleteProvider.getSuggestions  (:188)
//       checks `const atPrefix = this.extractAtPrefix(textBeforeCursor)` (:191)
//       and, when truthy, routes to `getFuzzyFileSuggestions` and returns
//       early (:192-204) -- BEFORE the slash-command branch
//       `if (!options.force && textBeforeCursor.startsWith("/"))` (:205).
//     - extractAtPrefix (:331) splits on `findLastDelimiter` against
//       `PATH_DELIMITERS = new Set([" ","\t",'"',"'","="])` (:6) -- which has
//       NO `@`. So for `/claude:plugin update @` the trailing `@` token is
//       treated as a file-mention prefix; if no cwd files match, the user sees
//       nothing (matching the original G-MIL-07 report); if files match, file
//       paths appear. Either way our slash-command `getArgumentCompletions`
//       is NEVER reached for the bare-`@<mp>` token.
//
// Causes ruled out: (a) provider code-path divergence -- ELIMINATED, the
// runtime source-loads the provider this test covers via SNM-37. (c)
// `getInstalledPluginToMarketplacesMap` empty via scope-root mismatch -- not
// the cause: pi-tui intercepts before our resolver map (`data.ts:313`) is ever
// consulted for a bare `@` token.
//
// Per D-25-10 this is `@earendil-works/pi-tui`-external -- DEFER, do NOT contort
// our provider to dodge the host's `@`-precedence (that would degrade the
// documented bare-`@<mp>` UX without fixing the interception). The
// `<plugin>@<mp>` and bare-`<TAB>` plugin-half forms are unaffected (their
// token does not START with `@`).
test("TC-6 :: update accepts bare @<marketplace> form", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "p", status: "installed" }],
        "mp-b": [{ name: "p", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("update @", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    // Each marketplace surfaces as `@<name>`.
    assert.deepEqual([...labels].sort(), ["@mp-a", "@mp-b"]);
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: reinstall completion mode shows only installed plugins", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
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
    const items = await getArgumentCompletions("reinstall ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual(labels, ["p-installed@mp"]);
    assert.deepEqual(
      items.map((i) => i.value),
      ["reinstall p-installed@mp "],
    );
  } finally {
    await f.cleanup();
  }
});

// RINST-01 / D-67-03: removed the former `reinstall --force completion still
// reaches installed refs` test -- `--force` is no longer a reinstall token, so
// the completion provider no longer special-cases it during positional
// extraction. The bare `reinstall ` installed-plugin completion above is the
// surviving coverage for the reinstall ref surface.

test("PRL-16 :: reinstall @ completes marketplace-only targets", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "p", status: "installed" }],
        "mp-b": [{ name: "p", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("reinstall @", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["@mp-a", "@mp-b"]);
    for (const item of items) {
      assert.match(
        item.value,
        / $/,
        `marketplace-only completion needs trailing space: ${item.value}`,
      );
    }
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: reinstall @m ignores stale marketplace-name cache", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, market: {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "p", status: "installed" }],
        market: [{ name: "p", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const staleUserCache = f.resolver.marketplaceNamesCachePath("user");
    await mkdir(path.dirname(staleUserCache), { recursive: true });
    await writeFile(staleUserCache, JSON.stringify({ schemaVersion: 2, names: [] }));

    const items = await getArgumentCompletions("reinstall @m", f.resolver);

    assert.ok(items !== null);
    assert.deepEqual([...items.map((i) => i.label)].sort(), ["@market", "@mp-a"]);
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: reinstall plugin half preserves multi-marketplace no trailing space", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "shared", status: "installed" }],
        "mp-b": [{ name: "shared", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("reinstall shared", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(items, [{ label: "shared@", value: "reinstall shared@" }]);
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: update --scope user limits installed plugin refs to user scope", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: { mp: {} } },
    manifests: {
      user: { mp: [{ name: "user-installed", status: "installed" }] },
      project: { mp: [{ name: "project-installed", status: "installed" }] },
    },
  });
  try {
    const items = await getArgumentCompletions("update --scope user ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["user-installed@mp"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: unique plugin yields name@mp with trailing space", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: { mp: [{ name: "solo", status: "installed" }] },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("uninstall ", f.resolver);
    assert.ok(items !== null);
    const solo = items.find((i) => i.label === "solo@mp");
    assert.ok(solo !== undefined, `expected solo@mp in: ${items.map((i) => i.label).join(", ")}`);
    assert.match(solo.value, / $/, "unique plugin must include trailing space");
  } finally {
    await f.cleanup();
  }
});

test("TC-6 :: multi-marketplace plugin yields name@ without trailing space", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "shared", status: "installed" }],
        "mp-b": [{ name: "shared", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("uninstall ", f.resolver);
    assert.ok(items !== null);
    const shared = items.find((i) => i.label === "shared@");
    assert.ok(shared !== undefined, `expected shared@ in: ${items.map((i) => i.label).join(", ")}`);
    assert.equal(
      shared.value.endsWith(" "),
      false,
      "multi-mp plugin must NOT include trailing space",
    );
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// INFO-02 + INFO-06: TC-6 `info` mode --
// `<plugin>@<marketplace>` token completion across the union of
// installed + available + unavailable rows from BOTH scopes (no
// install-state exclusion; scope filter does NOT narrow the candidate
// set -- the orchestrator handles scope mismatches via the INFO-04
// `{not added}` row).
// ---------------------------------------------------------------------------

test("TC-6 / INFO-02 :: info <here> returns union of installed + available + unavailable refs across both scopes", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: {
      user: { mp: {} },
      project: { mp2: {} },
    },
    manifests: {
      user: {
        mp: [
          { name: "foo", status: "installed" },
          { name: "bar", status: "available" },
          { name: "qux", status: "unavailable" },
        ],
      },
      project: { mp2: [{ name: "baz", status: "installed" }] },
    },
  });
  try {
    const items = await getArgumentCompletions("info ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual([...labels].sort(), ["bar@mp", "baz@mp2", "foo@mp", "qux@mp"]);
  } finally {
    await f.cleanup();
  }
});

test("TC-6 / INFO-02 :: info foo@<here> narrows to marketplaces carrying foo", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "foo", status: "available" }],
        "mp-b": [{ name: "other", status: "available" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("info foo@", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["foo@mp-a"],
    );
  } finally {
    await f.cleanup();
  }
});

test("TC-6 / INFO-02 :: info --scope project <here> returns the SAME union (scope filter does NOT narrow set)", async () => {
  __resetCacheForTests();
  // Marketplace lives in USER scope only; with `--scope project` the
  // completion still surfaces every known plugin. The orchestrator
  // handles the mismatch at execution time via the INFO-04
  // `{not added}` row.
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "foo", status: "installed" },
          { name: "bar", status: "available" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("info --scope project ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual([...labels].sort(), ["bar@mp", "foo@mp"]);
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// LIST-02 / D-67-02 -- `--force`-gated install/update completion candidate
// sets sourced from the finer cache statuses. With `--force` preceding the
// plugin positional, install offers `available` + `unsupported` and update
// offers `upgradable` + `force-upgradable` (`unavailable` excluded in both).
// Without `--force`, the candidate sets are byte-identical to today.
// ---------------------------------------------------------------------------

test("LIST-02 / D-67-02 :: install --force offers available + unsupported, excludes unavailable", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-avail", status: "available" },
          { name: "p-unsup", status: "unsupported" },
          { name: "p-unavail", status: "unavailable" },
          { name: "p-inst", status: "installed" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("install --force ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual([...labels].sort(), ["p-avail@mp", "p-unsup@mp"]);
  } finally {
    await f.cleanup();
  }
});

test("LIST-02 / D-67-02 / WR-02 :: update --force offers upgradable + force-upgradable + force-installed-upgradable, excludes installed/force-installed/unavailable", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-upg", status: "upgradable" },
          { name: "p-fupg", status: "force-upgradable" },
          // WR-02: a force-installed row with a meaningful (newer,
          // non-unavailable) candidate IS a real `update --force` target.
          { name: "p-finst-upg", status: "force-installed-upgradable" },
          { name: "p-inst", status: "installed" },
          // Plain force-installed (no newer candidate) stays excluded.
          { name: "p-finst", status: "force-installed" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("update --force ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual([...labels].sort(), ["p-finst-upg@mp", "p-fupg@mp", "p-upg@mp"]);
  } finally {
    await f.cleanup();
  }
});

test("LIST-02 / D-67-02 :: install (no --force) offers ONLY available -- byte-identical regression", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-avail", status: "available" },
          { name: "p-unsup", status: "unsupported" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("install ", f.resolver);
    assert.ok(items !== null);
    assert.deepEqual(
      items.map((i) => i.label),
      ["p-avail@mp"],
    );
  } finally {
    await f.cleanup();
  }
});

test("LIST-02 / D-67-02 :: update (no --force) offers ALL installed-family statuses -- byte-identical regression", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: {
      user: {
        mp: [
          { name: "p-inst", status: "installed" },
          { name: "p-upg", status: "upgradable" },
          { name: "p-finst", status: "force-installed" },
          { name: "p-finst-upg", status: "force-installed-upgradable" },
          { name: "p-fupg", status: "force-upgradable" },
          { name: "p-avail", status: "available" },
          { name: "p-unavail", status: "unavailable" },
        ],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("update ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    // WR-02: `force-installed-upgradable` is part of the installed inventory, so
    // the no-`--force` set still spans the full family (byte-identical contract).
    assert.deepEqual([...labels].sort(), [
      "p-finst-upg@mp",
      "p-finst@mp",
      "p-fupg@mp",
      "p-inst@mp",
      "p-upg@mp",
    ]);
  } finally {
    await f.cleanup();
  }
});

test("LIST-02 / D-67-02 :: --force is a flag completion for install/update and NOT for reinstall", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    for (const head of ["install", "update"]) {
      const items = await getArgumentCompletions(`${head} -`, f.resolver);
      assert.ok(items !== null, head);
      assert.ok(
        items.some((i) => i.label === "--force"),
        `expected --force under ${head}`,
      );
    }

    const reinstallItems = await getArgumentCompletions("reinstall -", f.resolver);
    assert.ok(reinstallItems !== null);
    assert.equal(
      reinstallItems.some((i) => i.label === "--force"),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

test("LIST-02 / D-67-02 :: install --force <here> does not return null (positional-ref branch fires)", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: { user: { mp: [{ name: "p-avail", status: "available" }] }, project: {} },
  });
  try {
    const items = await getArgumentCompletions("install --force ", f.resolver);
    assert.notEqual(items, null);
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-7 -- trailing space invariant (sampled).
// ---------------------------------------------------------------------------

test("TC-7 :: all terminal completions include trailing space (TC-1 case)", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("", f.resolver);
    assert.ok(items !== null);
    for (const item of items) {
      assert.match(item.value, / $/, `expected trailing space in TC-1 item: ${item.value}`);
    }
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// TC-8 / TC-9 -- soft-fail vs. propagation through the dispatcher.
// ---------------------------------------------------------------------------

test("TC-8 :: per-marketplace manifest load failure soft-fails to empty list (no throw)", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { broken: {}, healthy: {} }, project: {} },
    manifests: {
      user: { healthy: [{ name: "h", status: "installed" }] },
      project: {},
    },
    manifestThrows: {
      user: { broken: new Error("manifest read EACCES") },
    },
  });
  try {
    // uninstall mode reads only installed; broken's plugin set soft-fails
    // to [], so the result must contain h@healthy only (no throw).
    const items = await getArgumentCompletions("uninstall ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("h@healthy"));
    // Nothing from the broken marketplace surfaces.
    for (const l of labels) {
      assert.equal(l.includes("broken"), false, `unexpected broken-mp label: ${l}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: reinstall per-marketplace manifest soft-fail preserves other marketplace completions", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { broken: {}, healthy: {} }, project: {} },
    manifests: {
      user: { healthy: [{ name: "ok", status: "installed" }] },
      project: {},
    },
    manifestThrows: {
      user: { broken: new Error("manifest read EACCES") },
    },
  });
  try {
    const items = await getArgumentCompletions("reinstall ", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("ok@healthy"));
    assert.deepEqual(items.find((i) => i.label === "ok@healthy")?.value, "reinstall ok@healthy ");
    for (const l of labels) {
      assert.equal(l.includes("broken"), false, `unexpected broken-mp label: ${l}`);
    }
  } finally {
    await f.cleanup();
  }
});

test("TC-9 :: state.json error propagates (throw escapes getArgumentCompletions)", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: { user: { mp: [] }, project: {} },
    stateThrows: { user: new Error("ENOENT: state.json corrupt") },
  });
  try {
    await assert.rejects(
      () => getArgumentCompletions("uninstall ", f.resolver),
      /state\.json corrupt/,
    );
  } finally {
    await f.cleanup();
  }
});

test("PRL-16 :: reinstall state load errors propagate", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: {} }, project: {} },
    manifests: { user: { mp: [] }, project: {} },
    stateThrows: { user: new Error("state boom") },
  });
  try {
    await assert.rejects(() => getArgumentCompletions("reinstall ", f.resolver), /state boom/);
  } finally {
    await f.cleanup();
  }
});

// ---------------------------------------------------------------------------
// no-match -> null sentinel.
// ---------------------------------------------------------------------------

test("no-match position returns null (Pi-tui sentinel; not [])", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    // `install foo@bar ` -- past the only positional, no flag prefix, no
    // marketplace subcommand context; the dispatcher must return null
    // (not []) so Pi-tui can fall through to other providers.
    const items = await getArgumentCompletions("install foo@bar ", f.resolver);
    assert.equal(items, null);
  } finally {
    await f.cleanup();
  }
});

test("TC-1 :: first positional completion includes import", async () => {
  __resetCacheForTests();
  const f = await emptyFixture();
  try {
    const items = await getArgumentCompletions("", f.resolver);
    assert.ok(items !== null);
    assert.ok(items.some((item) => item.label === "import" && item.value === "import "));
  } finally {
    await f.cleanup();
  }
});

test("import completions offer scope values and no plugin refs", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { mp: { manifestPath: "/tmp/manifest" } } },
    manifests: {
      user: {
        mp: [{ name: "plugin", status: "available", version: "1.0.0" }],
      },
    },
  });
  try {
    const scopeItems = await getArgumentCompletions("import --scope ", f.resolver);
    assert.ok(scopeItems !== null);
    assert.deepEqual(scopeItems.map((item) => item.label).sort(), ["project", "user"]);

    const flagItems = await getArgumentCompletions("import -", f.resolver);
    assert.ok(flagItems !== null);
    assert.ok(flagItems.some((item) => item.label === "--scope"));

    const positionalItems = await getArgumentCompletions("import foo", f.resolver);
    assert.equal(positionalItems, null);
  } finally {
    await f.cleanup();
  }
});
