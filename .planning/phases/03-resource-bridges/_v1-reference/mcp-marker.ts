import { assertSafeName } from "../validation.ts";

export const CLAUDE_MARKETPLACE_MARKER_KEY = "_claudeMarketplace";

export interface ClaudeMarketplaceMarker {
  plugin: string;
  marketplace: string;
}

/** Returns the parsed marker subobject if `value` is an object with a
 *  well-formed `_claudeMarketplace: { plugin: string; marketplace: string }`
 *  entry; otherwise null. */
export function readMarker(value: unknown): ClaudeMarketplaceMarker | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const marker = (value as Record<string, unknown>)[CLAUDE_MARKETPLACE_MARKER_KEY];
  if (typeof marker !== "object" || marker === null || Array.isArray(marker)) {
    return null;
  }

  const obj = marker as Record<string, unknown>;
  if (typeof obj.plugin !== "string" || typeof obj.marketplace !== "string") {
    return null;
  }

  return { plugin: obj.plugin, marketplace: obj.marketplace };
}

/** assertSafeName both names so the marker shape stays uniform with state records. */
export function buildMarker(plugin: string, marketplace: string): ClaudeMarketplaceMarker {
  assertSafeName(plugin, "plugin name");
  assertSafeName(marketplace, "marketplace name");
  return { plugin, marketplace };
}

export function isOwnedBy(value: unknown, plugin: string, marketplace: string): boolean {
  const m = readMarker(value);
  return m !== null && m.plugin === plugin && m.marketplace === marketplace;
}
