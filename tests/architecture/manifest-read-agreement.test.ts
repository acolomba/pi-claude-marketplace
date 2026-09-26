/**
 * D-01-12 cross-reader agreement gate: a plugin's manifest has ONE set of
 * locations, in ONE order, honored by every reader that looks for it.
 *
 * The hazard: each reader locates `plugin.json` with a `path.join` of its own,
 * so a fallback added to one reader and not to another makes the two disagree
 * about where a plugin's manifest is. A source-grep would prove only that the
 * shared ordering is IMPORTED, never that a reader still reaches the file
 * through it -- so this gate plants a real tree on disk and drives the readers
 * against it.
 *
 * The halves asserted here:
 *   - `domain/plugin-resolver.ts::readManifest`, reached through `resolveStrict` with
 *     no seams injected so it reads real disk.
 *   - `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1.
 *   - `orchestrators/plugin/info.ts`'s own `dependencies` read, reached through
 *     `getPluginInfo` against a seeded scope (D-01-32). This half asserts more
 *     than location: the entry and the manifest declare DIFFERENT dependencies,
 *     so the rendered line proves which file the surface treated as
 *     authoritative, not merely that it opened one.
 *   - `orchestrators/plugin/dependency-declaration-read.ts`, the read the
 *     install cascade resolves a plugin's dependencies through. It answers the
 *     same question `info` renders, against the same planted tree, so the two
 *     cannot disagree about which file declares what a plugin depends on.
 *
 * The list is deliberately open: a reader added later is added here too
 * (MANF-01, MANF-02, MANF-05).
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { readDependencyDeclaration } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import { getPluginInfo } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { resolvePluginVersion } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  materializeMarketplaceTree,
  mergeMarketplaceIntoState,
} from "../edge/handlers/marketplace-seed.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type { ClosureLookupResult } from "../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";
import type {
  NotificationContext,
  ToolInventory,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/** The marketplace entry every case resolves. Its own version is tier 2. */
const ENTRY: PluginEntry = { name: "alpha", source: "./alpha", version: "1.0.0" };

/**
 * Plants a marketplace root holding one plugin directory, writing whichever
 * manifest locations the case names. A location left unnamed is absent from
 * disk, which is the only condition either reader may fall through on.
 */
async function plantPlugin(
  t: TestContext,
  manifests: { readonly wrapped?: string; readonly bare?: string },
): Promise<string> {
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "manifest-read-agreement-"));
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true, maxRetries: 3 }));
  const pluginRoot = path.join(marketplaceRoot, "alpha");
  await mkdir(pluginRoot, { recursive: true });

  if (manifests.wrapped !== undefined) {
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), manifests.wrapped);
  }

  if (manifests.bare !== undefined) {
    await writeFile(path.join(pluginRoot, "plugin.json"), manifests.bare);
  }

  return marketplaceRoot;
}

test("both readers honor a manifest that lives only at the bare path", async (t) => {
  // arrange -- MANF-01: the bare file is the plugin's only manifest.
  const marketplaceRoot = await plantPlugin(t, {
    bare: '{"name":"alpha","version":"9.9.9","defaultEnabled":false}\n',
  });

  // act
  const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
  requireInstallable(resolved);
  const version = await resolvePluginVersion(ENTRY, resolved);

  // assert
  assert.strictEqual(resolved.defaultEnabled, false);
  assert.strictEqual(version, "9.9.9");
});

test("both readers prefer the wrapped manifest over a bare sibling", async (t) => {
  // arrange -- MANF-02: the wrapped path is first in the shared ordering.
  const marketplaceRoot = await plantPlugin(t, {
    wrapped: '{"name":"alpha","version":"2.0.0","defaultEnabled":false}\n',
    bare: '{"name":"alpha","version":"9.9.9","defaultEnabled":true}\n',
  });

  // act
  const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
  requireInstallable(resolved);
  const version = await resolvePluginVersion(ENTRY, resolved);

  // assert
  assert.strictEqual(resolved.defaultEnabled, false);
  assert.strictEqual(version, "2.0.0");
});

test("both readers tolerate a plugin declaring no manifest at either path", async (t) => {
  // arrange -- MANF-05: absence at every candidate is not a failure.
  const marketplaceRoot = await plantPlugin(t, {});

  // act
  const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
  requireInstallable(resolved);
  const version = await resolvePluginVersion(ENTRY, resolved);

  // assert
  assert.strictEqual(resolved.defaultEnabled, true);
  assert.strictEqual(version, "1.0.0");
});

// D-01-32: the third reader. `info` opens the same planted file, and treats it
// as outranking the marketplace entry rather than merely reading it.

/** What the marketplace ENTRY declares -- the mirror that can go stale. */
const ENTRY_DEPENDENCY = "stale-dep@mp";
/** What the plugin's OWN bare manifest declares -- the authoritative source. */
const MANIFEST_DEPENDENCY = "fresh-dep@mp";

/**
 * Reads the planted tree through the fourth reader: the read the install
 * cascade resolves a plugin's dependencies through.
 */
async function readCascadeDeclaration(
  marketplaceRoot: string,
  cwd: string,
): Promise<ClosureLookupResult> {
  return readDependencyDeclaration({
    marketplaceRoot,
    entry: { ...ENTRY, dependencies: [ENTRY_DEPENDENCY] },
    locations: locationsFor("user", cwd),
  });
}

/** Builds the parsed form of a `<name>@mp` token either side may declare. */
function declares(name: string): ClosureLookupResult {
  return { kind: "found", dependencies: [{ name, marketplace: "mp" }] };
}

for (const { label, prepare, resolution, notification } of [
  {
    label: "malformed JSON",
    prepare: async (root: string) => {
      await mkdir(path.join(root, ".claude-plugin"));
      await writeFile(path.join(root, ".claude-plugin", "plugin.json"), "{ invalid");
    },
    // The parse failure is the resolver's own `unavailable` verdict.
    resolution: { state: "unavailable" },
    notification:
      "● mp [user] <no autoupdate>\n  ⊘ alpha v1.0.0 (unavailable) {unsupported source}",
  },
  {
    label: "a symlink loop preventing stat and read",
    prepare: async (root: string) => {
      const wrapper = path.join(root, ".claude-plugin");
      await symlink(wrapper, wrapper, "junction");
    },
    // A probe failure propagates out of the resolver with its identity intact,
    // so the caller's probe classifier names it (the hooks.json EACCES
    // precedent); no reader falls through to the bare sibling.
    resolution: { rejected: "ELOOP" },
    notification:
      "● mp [user] <no autoupdate>\n  ⊘ alpha v1.0.0 (unavailable) {unreadable}\n    components: not resolved",
  },
]) {
  test(`all four readers stop at ${label} instead of using the bare sibling`, async (t) => {
    // arrange
    const { agentDir, cwd } = await createHermeticEnvironment(t, "manifest-read-agreement-");
    const marketplaceRoot = await seedScopedMarketplace(agentDir, cwd);
    const previousResolution = await resolveStrict(ENTRY, { marketplaceRoot });
    requireInstallable(previousResolution);
    // A wrong dependency fallback must change info's result before the
    // resolver's unavailable row can suppress the selected dependencies.
    await writeFile(
      path.join(marketplaceRoot, "alpha", "plugin.json"),
      '{"name":"alpha","version":"9.9.9","dependencies":[42]}',
    );
    await prepare(path.join(marketplaceRoot, "alpha"));
    const { ctx, pi, notifications } = makeCtx();

    // act
    const resolved = await resolveStrict(ENTRY, { marketplaceRoot }).then(
      (resolution) => ({ state: resolution.state }),
      (error: unknown) => ({
        rejected: error instanceof Error && "code" in error ? error.code : error,
      }),
    );
    const version = await resolvePluginVersion(ENTRY, previousResolution);
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });
    const declaration = await readCascadeDeclaration(marketplaceRoot, cwd);

    // assert -- the fourth reader falls back to the ENTRY, so the bare
    // sibling's rejected `[42]` list cannot reach it either.
    assert.deepStrictEqual(
      { resolved, version, notifications, declaration },
      {
        resolved: resolution,
        version: "1.0.0",
        notifications: [notification],
        declaration: declares("stale-dep"),
      },
    );
  });
}

for (const { label, prepare } of [
  {
    label: "a non-directory wrapper",
    prepare: (root: string) => writeFile(path.join(root, ".claude-plugin"), "not a directory"),
  },
  {
    label: "a directory candidate",
    prepare: (root: string) =>
      mkdir(path.join(root, ".claude-plugin", "plugin.json"), { recursive: true }),
  },
  {
    label: "a device candidate",
    prepare: async (root: string) => {
      await mkdir(path.join(root, ".claude-plugin"));
      await symlink(devNull, path.join(root, ".claude-plugin", "plugin.json"));
    },
  },
]) {
  test(`all four readers fall through ${label} to the bare manifest`, async (t) => {
    // arrange
    const { agentDir, cwd } = await createHermeticEnvironment(t, "manifest-read-agreement-");
    const marketplaceRoot = await seedScopedMarketplace(agentDir, cwd);
    await prepare(path.join(marketplaceRoot, "alpha"));
    const { ctx, pi, notifications } = makeCtx();

    // act
    const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
    requireInstallable(resolved);
    const version = await resolvePluginVersion(ENTRY, resolved);
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });
    const declaration = await readCascadeDeclaration(marketplaceRoot, cwd);

    // assert
    assert.deepStrictEqual(
      { state: resolved.state, version, notifications, declaration },
      {
        state: "installable",
        version: "9.9.9",
        notifications: [
          "● mp [user] <no autoupdate>\n  ○ alpha v1.0.0 (available)\n    dependencies: fresh-dep@mp",
        ],
        declaration: declares("fresh-dep"),
      },
    );
  });
}

/**
 * Builds the two ports `getPluginInfo` takes: a recording notifier and an
 * empty tool inventory.
 */
function makeCtx(): { ctx: NotificationContext; pi: ToolInventory; notifications: string[] } {
  const notifications: string[] = [];
  const pi: ToolInventory = { getAllTools: () => [] };
  const ctx: NotificationContext = {
    ui: {
      notify: (message) => {
        notifications.push(message);
      },
    },
  };
  return { ctx, pi, notifications };
}

/**
 * Plants a user-scope path-source marketplace under the hermetic agent
 * directory, whose ONLY plugin manifest is the bare one, and whose entry
 * declares a DIFFERENT dependency than that manifest. Returns the marketplace
 * root, so the two direct-reader halves can be driven against the very same
 * tree `info` will read.
 */
async function seedScopedMarketplace(agentDir: string, cwd: string): Promise<string> {
  const locations = locationsFor("user", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const marketplaceRoot = path.join(agentDir, "marketplaces", "mp");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [{ ...ENTRY, dependencies: [ENTRY_DEPENDENCY] }],
    }),
    "utf8",
  );

  await materializeMarketplaceTree(marketplaceRoot, { installablePluginDirs: ["alpha"] });
  await writeFile(
    path.join(marketplaceRoot, "alpha", "plugin.json"),
    JSON.stringify({
      name: "alpha",
      version: "9.9.9",
      defaultEnabled: false,
      dependencies: [MANIFEST_DEPENDENCY],
    }),
    "utf8",
  );

  await mergeMarketplaceIntoState(locations.extensionRoot, "mp", {
    name: "mp",
    scope: "user",
    source: pathSource("./mp-src"),
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    plugins: {},
  });

  return marketplaceRoot;
}

test("all four readers locate one bare manifest, and two let it outrank the entry", async (t) => {
  // arrange -- one tree, one manifest, at the bare candidate only.
  const { agentDir, cwd } = await createHermeticEnvironment(t, "manifest-read-agreement-");
  const marketplaceRoot = await seedScopedMarketplace(agentDir, cwd);
  const { ctx, pi, notifications } = makeCtx();

  // act
  const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
  requireInstallable(resolved);
  const version = await resolvePluginVersion(ENTRY, resolved);
  await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });
  const declaration = await readCascadeDeclaration(marketplaceRoot, cwd);

  // assert -- readers one and two found the file; readers three and four not
  // only found it but preferred it to the entry's competing claim.
  assert.deepStrictEqual(
    { defaultEnabled: resolved.defaultEnabled, version, notifications, declaration },
    {
      defaultEnabled: false,
      version: "9.9.9",
      notifications: [
        "● mp [user] <no autoupdate>\n  ○ alpha v1.0.0 (available)\n    dependencies: fresh-dep@mp",
      ],
      declaration: declares("fresh-dep"),
    },
  );
});
