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
import { getPluginInfo } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { resolvePluginVersion } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  materializeMarketplaceTree,
  mergeMarketplaceIntoState,
} from "../edge/handlers/marketplace-seed.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** The marketplace entry every case resolves. Its own version is tier 2. */
const ENTRY: PluginEntry = { name: "alpha", source: "./alpha", version: "1.0.0" };

/**
 * Plant a marketplace root holding one plugin directory, writing whichever
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

// ---------------------------------------------------------------------------
// D-01-32: the third reader. `info` opens the same planted file, and treats it
// as outranking the marketplace entry rather than merely reading it.
// ---------------------------------------------------------------------------

/** What the marketplace ENTRY declares -- the mirror that can go stale. */
const ENTRY_DEPENDENCY = "stale-dep@mp";
/** What the plugin's OWN bare manifest declares -- the authoritative source. */
const MANIFEST_DEPENDENCY = "fresh-dep@mp";

for (const { label, prepare } of [
  {
    label: "malformed JSON",
    prepare: async (root: string) => {
      await mkdir(path.join(root, ".claude-plugin"));
      await writeFile(path.join(root, ".claude-plugin", "plugin.json"), "{ invalid");
    },
  },
  {
    label: "a symlink loop preventing stat and read",
    prepare: async (root: string) => {
      const wrapper = path.join(root, ".claude-plugin");
      await symlink(wrapper, wrapper, "junction");
    },
  },
]) {
  test(`all three readers stop at ${label} instead of using the bare sibling`, async () => {
    await withHermeticHome(async ({ home, cwd }) => {
      // arrange
      const marketplaceRoot = await seedScopedMarketplace(home, cwd);
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
      const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
      const version = await resolvePluginVersion(ENTRY, previousResolution);
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // assert
      assert.deepStrictEqual(
        { state: resolved.state, version, notifications },
        {
          state: "unavailable",
          version: "1.0.0",
          notifications: [
            "● mp [user] <no autoupdate>\n  ⊘ alpha v1.0.0 (unavailable) {unsupported source}",
          ],
        },
      );
    });
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
  test(`all three readers fall through ${label} to the bare manifest`, async () => {
    await withHermeticHome(async ({ home, cwd }) => {
      // arrange
      const marketplaceRoot = await seedScopedMarketplace(home, cwd);
      await prepare(path.join(marketplaceRoot, "alpha"));
      const { ctx, pi, notifications } = makeCtx();

      // act
      const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
      requireInstallable(resolved);
      const version = await resolvePluginVersion(ENTRY, resolved);
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // assert
      assert.deepStrictEqual(
        { state: resolved.state, version, notifications },
        {
          state: "installable",
          version: "9.9.9",
          notifications: [
            "● mp [user] <no autoupdate>\n  ○ alpha v1.0.0 (available)\n    dependencies: fresh-dep@mp",
          ],
        },
      );
    });
  });
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: string[] } {
  const notifications: string[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string): void => {
        notifications.push(m);
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

/**
 * `getPluginInfo` resolves the user-scope agent directory from HOME, so its
 * half needs the swap the other two do not: they take an explicit
 * `marketplaceRoot` and touch nothing outside it.
 */
async function withHermeticHome<T>(fn: (env: { home: string; cwd: string }) => Promise<T>) {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "manifest-read-agreement-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "manifest-read-agreement-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 3 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 3 });
  }
}

/**
 * Plant a user-scope path-source marketplace whose ONLY plugin manifest is the
 * bare one, and whose entry declares a DIFFERENT dependency than that manifest.
 * Returns the marketplace root, so the two direct-reader halves can be driven
 * against the very same tree `info` will read.
 */
async function seedScopedMarketplace(home: string, cwd: string): Promise<string> {
  const locations = locationsFor("user", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const marketplaceRoot = path.join(home, ".pi", "agent", "marketplaces", "mp");
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

test("all three readers locate one bare manifest, and info lets it outrank the entry", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange -- one tree, one manifest, at the bare candidate only.
    const marketplaceRoot = await seedScopedMarketplace(home, cwd);
    const { ctx, pi, notifications } = makeCtx();

    // act
    const resolved = await resolveStrict(ENTRY, { marketplaceRoot });
    requireInstallable(resolved);
    const version = await resolvePluginVersion(ENTRY, resolved);
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert -- readers one and two found the file; reader three not only found
    // it but preferred it to the entry's competing claim.
    assert.strictEqual(resolved.defaultEnabled, false);
    assert.strictEqual(version, "9.9.9");
    assert.strictEqual(notifications.length, 1);
    assert.match(notifications[0]!, new RegExp(`dependencies: ${MANIFEST_DEPENDENCY}`));
    assert.doesNotMatch(notifications[0]!, new RegExp(ENTRY_DEPENDENCY));
  });
});
