// edge/completions/data.ts
//
// Cache-backed completion data accessors + V1 pure helpers carried forward.
// Two responsibilities:
//
//   1. Pure helpers ported verbatim from V1 (`completions.ts`):
//      `buildItem`, `splitCompletionInput`, `extractPositionals`,
//      `getScopeCompletions`, `getMarketplaceCompletions`.
//
//   2. Cache-backed read-through helpers that replace V1's per-keystroke
//      loadState/loadMarketplaceManifest reads:
//      `getMarketplaceNamesAcrossScopes`, `getPluginToMarketplacesMap`,
//      `getPluginRefCompletions` (status-aware per D-03 corollary).
//
// Architecture seam: data.ts MUST NOT import from `persistence/` (ESLint
// BLOCK C: edge/ -> persistence/ forbidden). The `LocationsResolver`
// interface is the indirection. `register.ts` (Plan 06-05) constructs the
// resolver from `persistence/locations.ts` + `persistence/state-io.ts` +
// `domain/manifest.ts` and threads it through `getArgumentCompletions`.
// Tests construct mock resolvers inline.
//
// D-03 corollary status filtering:
//   - mode = "install"   -> keep status !== "installed" (INCLUDES
//                           "unavailable"; future --force will install them).
//   - mode = "uninstall" -> keep status === "installed".
//   - mode = "update"    -> keep status === "installed".

import {
  getMarketplaceNames,
  getPluginIndex,
  ManifestSoftFailError,
} from "../../shared/completion-cache.ts";
import { SCOPES } from "../../shared/types.ts";

import type { PluginIndexRow } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

type PluginRefCompletionMode = "install" | "uninstall" | "update";

// ---------------------------------------------------------------------------
// LocationsResolver -- the edge/ -> persistence/ injection seam.
// ---------------------------------------------------------------------------

/**
 * Injection surface that lets edge/completions reach into persistence/state
 * + domain/manifest WITHOUT importing them (Phase 1 D-11 / ESLint BLOCK C
 * keeps edge/ from importing persistence/). Constructed by edge/register.ts
 * (Plan 06-05) and threaded through getArgumentCompletions.
 *
 * The two rebuild-callback resolvers (loadStateForScope,
 * loadManifestForMarketplace) MUST throw to signal failure -- the cache layer
 * uses ManifestSoftFailError as the soft-fail discriminator (TC-8); any
 * other thrown error propagates verbatim (TC-9: state.json errors surface).
 */
export interface LocationsResolver {
  /** Cache file path for the marketplace-names cache of a scope. */
  marketplaceNamesCachePath(scope: Scope): string;
  /** Cache file path for a scoped marketplace's plugin index. */
  pluginCachePath(scope: Scope, marketplace: string): Promise<string>;
  /** Loads state.json for a scope (cache-miss rebuild path). */
  loadStateForScope(scope: Scope): Promise<{
    marketplaces: Record<string, MarketplaceStateRecord>;
  }>;
  /** Loads + bucketizes a marketplace's manifest into PluginIndexRow shape. */
  loadManifestForMarketplace(scope: Scope, marketplace: string): Promise<readonly PluginIndexRow[]>;
}

/** Minimal shape consumed by `rebuildNamesForScope`; full state record lives in persistence. */
export interface MarketplaceStateRecord {
  readonly manifestPath?: string;
  readonly plugins?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pure helpers ported verbatim from V1.
// ---------------------------------------------------------------------------

/**
 * Pi's autocomplete returns each suggestion's `value` as the complete
 * replacement for `argumentText` (everything after the slash command + space),
 * not just the chosen token. So a completion's value must reconstruct any
 * already-typed tokens that precede the cursor, append the chosen text, and
 * (for non-terminal completions) append a space so the next argument can be
 * typed without the user adding one.
 */
export function buildItem(
  argumentTextPrefix: string,
  itemText: string,
  appendSpace: boolean,
): AutocompleteItem {
  const head = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";
  const tail = appendSpace ? " " : "";
  return { label: itemText, value: head + itemText + tail };
}

/**
 * Pi delivers everything after the slash command + space to
 * `getArgumentCompletions(prefix)`. Split that into already-finished tokens
 * and the partial token under the cursor. A trailing space means the cursor
 * sits at the start of a new (empty) token.
 */
export function splitCompletionInput(input: string): { tokens: string[]; current: string } {
  if (input === "") {
    return { tokens: [], current: "" };
  }

  const trailingSpace = /\s$/.test(input);
  const allTokens = input.split(/\s+/).filter((t) => t !== "");
  if (trailingSpace) {
    return { tokens: allTokens, current: "" };
  }

  const current = allTokens.at(-1) ?? "";
  return { tokens: allTokens.slice(0, -1), current };
}

/**
 * Walk a token list and skip `--scope <value>` pairs to recover positional
 * arguments in order. Used by completion handlers to know which positional
 * the cursor is currently typing.
 */
export function extractPositionals(tokens: readonly string[]): string[] {
  const positionals: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "--scope") {
      i += 2;
      continue;
    }

    if (t !== undefined) {
      positionals.push(t);
    }

    i++;
  }

  return positionals;
}

/** V1 `getScopeCompletions` -- emits `--scope user` / `--scope project` suggestions. */
export function getScopeCompletions(argumentTextPrefix: string): AutocompleteItem[] {
  return [
    {
      ...buildItem(argumentTextPrefix, "--scope user", true),
      description: "User scope (~/.pi/agent)",
    },
    {
      ...buildItem(argumentTextPrefix, "--scope project", true),
      description: "Project scope (.pi/)",
    },
  ];
}

/** V1 `getMarketplaceCompletions` -- filters names by `currentPrefix` and emits trailing-space terminals. */
export function getMarketplaceCompletions(
  names: readonly string[],
  currentPrefix: string,
  argumentTextPrefix: string,
): AutocompleteItem[] {
  return names
    .filter((n) => n.startsWith(currentPrefix))
    .map((n) => buildItem(argumentTextPrefix, n, true));
}

// ---------------------------------------------------------------------------
// Rebuild closures (private). Wrap manifest failures in ManifestSoftFailError
// for TC-8; state.json failures propagate verbatim (TC-9).
// ---------------------------------------------------------------------------

async function rebuildNamesForScope(
  resolver: LocationsResolver,
  scope: Scope,
): Promise<readonly string[]> {
  // State.json errors propagate -- TC-9.
  const state = await resolver.loadStateForScope(scope);
  return Object.keys(state.marketplaces);
}

async function rebuildPluginIndex(
  resolver: LocationsResolver,
  scope: Scope,
  marketplace: string,
): Promise<readonly PluginIndexRow[]> {
  try {
    return await resolver.loadManifestForMarketplace(scope, marketplace);
  } catch (err) {
    // TC-8: signal soft-fail to the cache; any non-state.json failure during
    // manifest load becomes a poison-cache row. Bare Errors (e.g.
    // state.json) propagate via TC-9 by NOT being wrapped here; the resolver
    // contract is "loadManifestForMarketplace throws manifest-related errors
    // only".
    throw new ManifestSoftFailError(err);
  }
}

// ---------------------------------------------------------------------------
// Cache-backed accessors.
// ---------------------------------------------------------------------------

/**
 * Union of marketplace names visible from user + project scopes (deduped).
 * State.json errors from either scope propagate (TC-9).
 */
export async function getMarketplaceNamesAcrossScopes(
  resolver: LocationsResolver,
): Promise<readonly string[]> {
  const perScope = await Promise.all(
    SCOPES.map((scope) =>
      getMarketplaceNames(resolver.marketplaceNamesCachePath(scope), scope, () =>
        rebuildNamesForScope(resolver, scope),
      ),
    ),
  );
  return Array.from(new Set(perScope.flat()));
}

/**
 * Map plugin name -> [marketplaces] that carry the plugin under the given
 * `mode`'s status filter. D-03 corollary:
 *   - install   -> keep status !== "installed" (INCLUDES "unavailable")
 *   - uninstall -> keep status === "installed"
 *   - update    -> keep status === "installed"
 */
export async function getPluginToMarketplacesMap(
  mode: PluginRefCompletionMode,
  resolver: LocationsResolver,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const scope of SCOPES) {
    const names = await getMarketplaceNames(resolver.marketplaceNamesCachePath(scope), scope, () =>
      rebuildNamesForScope(resolver, scope),
    );
    for (const mp of names) {
      const cachePath = await resolver.pluginCachePath(scope, mp);
      const rows = await getPluginIndex(cachePath, scope, mp, () =>
        rebuildPluginIndex(resolver, scope, mp),
      );
      for (const row of rows) {
        if (!statusMatchesMode(mode, row)) {
          continue;
        }

        const existing = result.get(row.name) ?? [];
        if (!existing.includes(mp)) {
          existing.push(mp);
        }

        result.set(row.name, existing);
      }
    }
  }

  return result;
}

function statusMatchesMode(mode: PluginRefCompletionMode, row: PluginIndexRow): boolean {
  switch (mode) {
    case "install":
      return row.status !== "installed";
    case "uninstall":
    case "update":
      return row.status === "installed";
  }
}

async function getPluginHalfCompletions(
  mode: PluginRefCompletionMode,
  currentPrefix: string,
  argumentTextPrefix: string,
  resolver: LocationsResolver,
): Promise<AutocompleteItem[]> {
  const map = await getPluginToMarketplacesMap(mode, resolver);
  const items: AutocompleteItem[] = [];
  for (const [name, mps] of map) {
    if (!name.startsWith(currentPrefix)) {
      continue;
    }

    if (mps.length === 1 && mps[0] !== undefined) {
      items.push(buildItem(argumentTextPrefix, `${name}@${mps[0]}`, true));
      continue;
    }

    items.push(buildItem(argumentTextPrefix, `${name}@`, false));
  }

  return items;
}

async function getMarketplaceOnlyCompletions(
  marketplacePart: string,
  argumentTextPrefix: string,
  resolver: LocationsResolver,
  allowMarketplaceOnly: boolean,
): Promise<AutocompleteItem[]> {
  if (!allowMarketplaceOnly) {
    return [];
  }

  const all = await getMarketplaceNamesAcrossScopes(resolver);
  return all
    .filter((m) => m.startsWith(marketplacePart))
    .map((m) => buildItem(argumentTextPrefix, `@${m}`, true));
}

/**
 * `<plugin>@<marketplace>` token completion -- TC-6 + D-03 corollary.
 *
 *   - `currentPrefix` has no `@`: complete the plugin half. Plugins unique
 *     to one marketplace -> `name@mp` (trailing space). Plugins in multiple
 *     marketplaces -> `name@` (no trailing space, user picks marketplace).
 *
 *   - `currentPrefix` is `@…`: complete marketplace name only. Gated by
 *     `allowMarketplaceOnly` (true for `update` only -- accepts the bare
 *     `@<marketplace>` form per V1).
 *
 *   - `currentPrefix` is `name@…`: complete only marketplaces carrying
 *     `name`.
 */
export async function getPluginRefCompletions(
  mode: PluginRefCompletionMode,
  currentPrefix: string,
  argumentTextPrefix: string,
  resolver: LocationsResolver,
  options: { allowMarketplaceOnly: boolean },
): Promise<AutocompleteItem[]> {
  const at = currentPrefix.indexOf("@");

  if (at === -1) {
    return getPluginHalfCompletions(mode, currentPrefix, argumentTextPrefix, resolver);
  }

  const pluginPart = currentPrefix.slice(0, at);
  const marketplacePart = currentPrefix.slice(at + 1);

  if (pluginPart === "") {
    return getMarketplaceOnlyCompletions(
      marketplacePart,
      argumentTextPrefix,
      resolver,
      options.allowMarketplaceOnly,
    );
  }

  const map = await getPluginToMarketplacesMap(mode, resolver);
  const mps = map.get(pluginPart) ?? [];
  return mps
    .filter((m) => m.startsWith(marketplacePart))
    .map((m) => buildItem(argumentTextPrefix, `${pluginPart}@${m}`, true));
}
