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
 *   - `domain/resolver.ts::readManifest`, reached through `resolveStrict` with
 *     no seams injected so it reads real disk.
 *   - `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1.
 *
 * The list is deliberately open: a reader added later is added here too
 * (MANF-01, MANF-02, MANF-05).
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { resolvePluginVersion } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

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
