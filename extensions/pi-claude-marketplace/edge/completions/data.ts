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
// Status filtering per mode:
//   - install   -> target/source-scope visibility, keep only `available`,
//                  exclude plugins already installed in the target scope.
//   - uninstall -> keep `installed`.
//   - update    -> keep `installed`.
//   - reinstall -> keep `installed`.
//   - info      -> union of every plugin row across BOTH scopes, NO
//                  install-state exclusion. The info surface accepts any
//                  known plugin.

import { getPluginIndex, ManifestSoftFailError } from "../../shared/completion-cache.ts";
import { SCOPES } from "../../shared/types.ts";

import type { PluginIndexRow } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

type PluginRefCompletionMode = "install" | "uninstall" | "update" | "reinstall" | "info";

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
export function extractPositionals(
  tokens: readonly string[],
  booleanFlags: readonly string[] = [],
): string[] {
  const positionals: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "--scope") {
      i += 2;
      continue;
    }

    if (t !== undefined && booleanFlags.includes(t)) {
      i += 1;
      continue;
    }

    if (t !== undefined) {
      positionals.push(t);
    }

    i++;
  }

  return positionals;
}

export function extractScope(tokens: readonly string[]): Scope | undefined {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "--scope") {
      continue;
    }

    const value = tokens[i + 1];
    if (value === "user" || value === "project") {
      return value;
    }
  }

  return undefined;
}

/** V1 `getScopeCompletions` -- emits `--scope user` / `--scope project` suggestions. */
export function getScopeCompletions(argumentTextPrefix: string): AutocompleteItem[] {
  return [
    {
      ...buildItem(argumentTextPrefix, "--scope user", true),
      description: "User scope (Pi agent dir; defaults to ~/.pi/agent)",
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
 *
 * Marketplace-name completion reads state directly instead of trusting the
 * optimization cache. The cache has no TTL, and stale marketplace-name files
 * from an older process/version should not hide valid command targets.
 */
export async function getMarketplaceNamesAcrossScopes(
  resolver: LocationsResolver,
): Promise<readonly string[]> {
  const perScope = await Promise.all(SCOPES.map((scope) => rebuildNamesForScope(resolver, scope)));
  return Array.from(new Set(perScope.flat()));
}

interface PluginMapOptions {
  /** Install target scope, or explicit uninstall/update scope. */
  readonly targetScope?: Scope;
}

function addMapping(result: Map<string, string[]>, plugin: string, marketplace: string): void {
  const existing = result.get(plugin) ?? [];
  if (!existing.includes(marketplace)) {
    existing.push(marketplace);
  }

  result.set(plugin, existing);
}

async function marketplaceNamesForScope(
  resolver: LocationsResolver,
  scope: Scope,
): Promise<readonly string[]> {
  return rebuildNamesForScope(resolver, scope);
}

async function sourceMarketplacesForInstall(
  resolver: LocationsResolver,
  targetScope: Scope,
): Promise<readonly { scope: Scope; marketplace: string }[]> {
  const userNames = await marketplaceNamesForScope(resolver, "user");
  if (targetScope === "user") {
    return userNames.map((marketplace) => ({ scope: "user" as const, marketplace }));
  }

  const projectNames = await marketplaceNamesForScope(resolver, "project");
  const projectSet = new Set(projectNames);
  return [
    ...projectNames.map((marketplace) => ({ scope: "project" as const, marketplace })),
    ...userNames
      .filter((marketplace) => !projectSet.has(marketplace))
      .map((marketplace) => ({ scope: "user" as const, marketplace })),
  ];
}

async function installedNamesInTarget(
  resolver: LocationsResolver,
  targetScope: Scope,
  marketplace: string,
): Promise<ReadonlySet<string>> {
  const state = await resolver.loadStateForScope(targetScope);
  const plugins = state.marketplaces[marketplace]?.plugins ?? {};
  return new Set(Object.keys(plugins));
}

async function getInstallPluginToMarketplacesMap(
  resolver: LocationsResolver,
  targetScope: Scope,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const source of await sourceMarketplacesForInstall(resolver, targetScope)) {
    const targetInstalled = await installedNamesInTarget(resolver, targetScope, source.marketplace);
    const cachePath = await resolver.pluginCachePath(source.scope, source.marketplace);
    const rows = await getPluginIndex(cachePath, source.scope, source.marketplace, () =>
      rebuildPluginIndex(resolver, source.scope, source.marketplace),
    );

    for (const row of rows) {
      if (row.status !== "available" || targetInstalled.has(row.name)) {
        continue;
      }

      addMapping(result, row.name, source.marketplace);
    }
  }

  return result;
}

async function getInstalledPluginToMarketplacesMap(
  _mode: Exclude<PluginRefCompletionMode, "install" | "info">,
  resolver: LocationsResolver,
  explicitScope: Scope | undefined,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  for (const scope of scopes) {
    const names = await marketplaceNamesForScope(resolver, scope);
    for (const mp of names) {
      const cachePath = await resolver.pluginCachePath(scope, mp);
      const rows = await getPluginIndex(cachePath, scope, mp, () =>
        rebuildPluginIndex(resolver, scope, mp),
      );
      for (const row of rows) {
        if (row.status !== "installed") {
          continue;
        }

        addMapping(result, row.name, mp);
      }
    }
  }

  return result;
}

/**
 * Union of every (plugin, marketplace) row across both scopes with NO
 * `row.status` filter -- `info` is a read-only detail surface that
 * accepts any known plugin. The orchestrator handles scope mismatches
 * at execution time via the `{not added}` row, so explicit scope does
 * NOT narrow the candidate set here.
 */
async function getInfoPluginToMarketplacesMap(
  resolver: LocationsResolver,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const scope of SCOPES) {
    const names = await marketplaceNamesForScope(resolver, scope);
    for (const mp of names) {
      const cachePath = await resolver.pluginCachePath(scope, mp);
      const rows = await getPluginIndex(cachePath, scope, mp, () =>
        rebuildPluginIndex(resolver, scope, mp),
      );
      for (const row of rows) {
        // NO status filter -- info surfaces every known plugin.
        addMapping(result, row.name, mp);
      }
    }
  }

  return result;
}

/**
 * Map plugin name -> [marketplaces] that carry the plugin under the
 * given mode's target-scope rules. Install completion is available-only;
 * reinstall flows through the installed-only path; info is the union
 * of every status across both scopes.
 */
export async function getPluginToMarketplacesMap(
  mode: PluginRefCompletionMode,
  resolver: LocationsResolver,
  options: PluginMapOptions = {},
): Promise<Map<string, string[]>> {
  if (mode === "info") {
    return getInfoPluginToMarketplacesMap(resolver);
  }

  if (mode === "install") {
    return getInstallPluginToMarketplacesMap(resolver, options.targetScope ?? "user");
  }

  return getInstalledPluginToMarketplacesMap(mode, resolver, options.targetScope);
}

async function getPluginHalfCompletions(
  mode: PluginRefCompletionMode,
  currentPrefix: string,
  argumentTextPrefix: string,
  resolver: LocationsResolver,
  options: PluginMapOptions,
): Promise<AutocompleteItem[]> {
  const map = await getPluginToMarketplacesMap(mode, resolver, options);
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
  options: PluginMapOptions,
): Promise<AutocompleteItem[]> {
  if (!allowMarketplaceOnly) {
    return [];
  }

  const map = await getPluginToMarketplacesMap("update", resolver, options);
  const all = Array.from(new Set(Array.from(map.values()).flat()));
  return all
    .filter((m) => m.startsWith(marketplacePart))
    .map((m) => buildItem(argumentTextPrefix, `@${m}`, true));
}

/**
 * `<plugin>@<marketplace>` token completion -- TC-6 + CMP-6..8.
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
  options: { allowMarketplaceOnly: boolean; targetScope?: Scope },
): Promise<AutocompleteItem[]> {
  const at = currentPrefix.indexOf("@");

  if (at === -1) {
    return getPluginHalfCompletions(mode, currentPrefix, argumentTextPrefix, resolver, options);
  }

  const pluginPart = currentPrefix.slice(0, at);
  const marketplacePart = currentPrefix.slice(at + 1);

  if (pluginPart === "") {
    return getMarketplaceOnlyCompletions(
      marketplacePart,
      argumentTextPrefix,
      resolver,
      options.allowMarketplaceOnly,
      options,
    );
  }

  const map = await getPluginToMarketplacesMap(mode, resolver, options);
  const mps = map.get(pluginPart) ?? [];
  return mps
    .filter((m) => m.startsWith(marketplacePart))
    .map((m) => buildItem(argumentTextPrefix, `${pluginPart}@${m}`, true));
}
