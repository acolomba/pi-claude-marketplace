import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { assertPathInside } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

export async function seedMarketplaceRecord(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugins: MarketplaceRecord["plugins"];
  readonly scope: Scope;
}): Promise<MarketplaceRecord> {
  assert.match(opts.marketplace, /^[a-z0-9][a-z0-9._-]*$/iu);
  const marketplaceRoot = path.join(opts.cwd, opts.marketplace);
  await assertPathInside(opts.cwd, marketplaceRoot, `marketplace "${opts.marketplace}" root`);
  const entries = await Promise.all(
    Object.entries(opts.plugins).map(async ([name, record]) => {
      assert.match(name, /^[a-z0-9][a-z0-9._-]*$/iu);
      const pluginRoot = path.join(marketplaceRoot, "plugins", name);
      const pluginManifest = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      await mkdir(path.dirname(pluginManifest), { recursive: true });
      await writeFile(pluginManifest, JSON.stringify({ name, version: record.version }));
      return { name, version: record.version, source: `./plugins/${name}` };
    }),
  );
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name: opts.marketplace, plugins: entries }));

  return {
    name: opts.marketplace,
    scope: opts.scope,
    source: pathSource(`./${opts.marketplace}`),
    addedFromCwd: opts.cwd,
    manifestPath,
    marketplaceRoot,
    plugins: opts.plugins,
  };
}
