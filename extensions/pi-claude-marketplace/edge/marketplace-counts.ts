// edge/marketplace-counts.ts
//
// The plugin counts of one marketplace and their wording, shared by the
// first-screen rows of the `/claude:plugin browse` picker and the lines of
// the `pi_claude_marketplace_list` tool, so the two surfaces state the same
// fact in the same words (D-BG-1201, D-BG-1012).
//
// Read-only and offline: the catalog is read through the cached
// `loadMarketplaceManifest`, and nothing is written (NFR-5, NFR-8).

import { loadMarketplaceManifest } from "../domain/manifest.ts";
import { assertRecordedMarketplaceName } from "../domain/name.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import type { ParsedSource } from "../domain/source.ts";

/**
 * D-BG-1201: the number of plugin entries a marketplace's catalog offers, as
 * Claude Code counts them, or undefined when the catalog cannot be read or
 * declares a name Claude Code refuses (D-PL5-28). The loader returns its
 * cached parse by reference, so only its length is read.
 */
export async function offeredPluginCount(
  name: string,
  source: ParsedSource,
  manifestPath: string,
): Promise<number | undefined> {
  try {
    const manifest = await loadMarketplaceManifest(manifestPath);
    assertRecordedMarketplaceName(name, source, manifest.name);
    return manifest.plugins.length;
  } catch (err) {
    hookDebugLog(
      `marketplace counts: manifest load failed for ${manifestPath}: ${errorMessage(err)}`,
      "marketplace",
    );
    return undefined;
  }
}

/**
 * D-BG-1201, D-BG-1012: a marketplace reads as Claude Code's does, the
 * catalog's count of plugins and, when any is installed, the installed count,
 * then Pi's `-- {source}` tail.
 */
export function marketplaceDescription(m: {
  readonly pluginCount: number | undefined;
  readonly installedCount: number;
  readonly source: string;
}): string {
  const parts: string[] = [];
  if (m.pluginCount !== undefined) {
    parts.push(`${m.pluginCount.toString()} available`);
  }

  if (m.installedCount > 0) {
    parts.push(`${m.installedCount.toString()} installed`);
  }

  return parts.length === 0 ? m.source : `${parts.join(" • ")} -- ${m.source}`;
}
