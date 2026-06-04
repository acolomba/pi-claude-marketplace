// orchestrators/plugin/info.ts
//
// Read-only info surface for `info <plugin>@<marketplace>`. MUST NOT
// touch the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`,
// no `refreshGitHubClone`. The grep-gate test in
// `tests/orchestrators/plugin/info.test.ts` enforces this structurally
// (it strips comments before searching). IL-2: exactly one `notify()`
// call per invocation.
//
// Source-kind gate: only `"path"` sources are locally resolvable. Every
// other source kind (`github` / `url` / `git-subdir` / `npm` /
// `unknown`) emits `componentsResolved: false` -- fetching a remote
// source to resolve components would violate NFR-5.

import { readdir } from "node:fs/promises";
import path from "node:path";

import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { parsePluginSource, type ParsedSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { assertNever } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { narrowProbeError, narrowResolverNotes } from "../../shared/probe-classifiers.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  NotificationMessage,
  PluginInfoMessage,
  PluginInfoRow,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface GetPluginInfoOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for the soft-dep probe (info
   * surfaces do not emit soft-dep markers, but the probe argument is
   * threaded for signature parity with the cascade arm).
   */
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly plugin: string;
  /** When omitted, fan-out across BOTH scopes (project-first per INFO-03). */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * A `"path"` source (relative to the marketplace root) is locally
 * resolvable; every other kind lives at an unsynced external location
 * the orchestrator MUST NOT fetch (NFR-5). Exhaustive `switch (src.kind)`
 * over `ParsedSource` with `assertNever` so a future source kind is a
 * compile-time error here.
 */
function isLocallyResolvable(src: ParsedSource): boolean {
  switch (src.kind) {
    case "path":
      return true;
    case "github":
    case "url":
    case "git-subdir":
    case "npm":
    case "unknown":
      return false;
    default:
      assertNever(src);
      return false;
  }
}

/**
 * Walk one or more component-kind DIRECTORIES (relative to the plugin
 * root) and accumulate the per-kind component NAMES.
 *
 * For each declared directory:
 *   - skills:   directory entries -> directory NAMES (each skill is a
 *               subdirectory; `isSkillDir` filtering is bridge-layer
 *               only -- info surfaces authoring intent).
 *   - commands: file entries -> basename minus `.md` suffix.
 *   - agents:   file entries -> basename minus `.md` suffix.
 *
 * Read failures of ENOENT/ENOTDIR yield an empty bucket (declared dir
 * doesn't exist yet -- legitimate "no components" state). Every other
 * failure propagates so the row builder can classify via
 * `narrowProbeError` and surface a `{permission denied}` / `{unreadable}`
 * reason rather than silently rendering as "no components". The
 * renderer requires PRE-SORTED arrays; this helper sorts before
 * returning.
 */
/** Extract the displayable name from a single directory entry per `kind`,
 *  or `undefined` if the entry does not qualify. */
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; strip the suffix for display.
  return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined;
}

/**
 * Read directory entries. ENOENT / ENOTDIR yield an empty array
 * (declared dir doesn't exist yet -- a legitimate "no components in
 * this kind" state). Every other failure (EACCES, EPERM, EIO, ...)
 * PROPAGATES so the row builder can classify via `narrowProbeError`
 * and surface a `{permission denied}` / `{unreadable}` reason rather
 * than silently rendering as "no components declared".
 */
async function readEntriesOrEmpty(
  abs: string,
): Promise<readonly { name: string; isDirectory(): boolean; isFile(): boolean }[]> {
  try {
    return await readdir(abs, { withFileTypes: true });
  } catch (err) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return [];
      }
    }

    throw err;
  }
}

async function discoverComponentNames(
  pluginRoot: string,
  componentDirs: readonly string[],
  kind: "skills" | "commands" | "agents",
): Promise<readonly string[]> {
  const names = new Set<string>();
  for (const rel of componentDirs) {
    const abs = path.isAbsolute(rel) ? rel : path.join(pluginRoot, rel);
    const entries = await readEntriesOrEmpty(abs);
    for (const entry of entries) {
      const name = nameFromEntry(entry, kind);
      if (name !== undefined) {
        names.add(name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Resolve a manifest entry's `dependencies` field into a sorted
 * `readonly string[]` for the renderer. The schema keeps this field
 * opaque (`Type.Unknown()`); the renderer surfaces dependencies as
 * `<plugin>@<marketplace>` strings when the manifest provides them in
 * that form. When the field is an array of strings, sort
 * alphabetically (deterministic byte form across manifest authoring
 * orders); any other shape returns `undefined` so the renderer omits
 * the `dependencies:` line.
 */
function normalizeDependencies(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const strings = raw.filter((d): d is string => typeof d === "string");
  if (strings.length === 0) {
    return undefined;
  }

  return [...strings].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Compose the resolved-components field of a `PluginInfoRow`. Walks
 * `resolved.componentPaths` to discover per-kind component names on
 * disk; for mcpServers, the `resolved.mcpServers` keys ARE the names.
 * Empty per-kind arrays return `undefined` so the renderer omits the
 * line (the renderer assumes pre-sorted input and does not sort
 * defensively).
 */
async function composeResolvedComponents(
  pluginRoot: string,
  resolved: {
    readonly componentPaths: {
      readonly skills: readonly string[];
      readonly commands: readonly string[];
      readonly agents: readonly string[];
    };
    readonly mcpServers: Record<string, unknown>;
  },
): Promise<{
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly mcp?: readonly string[];
  readonly skills?: readonly string[];
}> {
  const agents = await discoverComponentNames(pluginRoot, resolved.componentPaths.agents, "agents");
  const commands = await discoverComponentNames(
    pluginRoot,
    resolved.componentPaths.commands,
    "commands",
  );
  const skills = await discoverComponentNames(pluginRoot, resolved.componentPaths.skills, "skills");
  const mcp = Object.keys(resolved.mcpServers).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  return {
    ...(agents.length > 0 && { agents }),
    ...(commands.length > 0 && { commands }),
    ...(mcp.length > 0 && { mcp }),
    ...(skills.length > 0 && { skills }),
  };
}

/**
 * Build a `PluginInfoMessage` for ONE scope-record pair. Branches:
 *   (a) Manifest read failure -> `(failed) {<reason>}` row, reason
 *       classified via `narrowProbeError`.
 *   (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
 *   (c) Installed -> `(installed)` row + (path source -> resolved
 *       components; other sources -> `components: not resolved`).
 *   (d) Available (resolveStrict installable) -> `(available)` row.
 *   (e) Unavailable (resolveStrict not installable OR threw) ->
 *       `(unavailable)` row with closed-set reasons.
 */
async function buildBlock(
  marketplace: string,
  pluginName: string,
  scope: Scope,
  mpRecord: MarketplaceRecord,
): Promise<PluginInfoMessage> {
  const marketplaceDetails = { autoupdate: mpRecord.autoupdate ?? false };

  // (a) Manifest read failure -> bare `(failed) {<reason>}` row under
  // the marketplace header. The reason is CLASSIFIED via the same
  // `narrowProbeError` ladder used elsewhere in this file so an
  // EACCES, ENOENT, or SyntaxError on `marketplace.json` produces the
  // same closed-set Reason that `list.ts` would surface for the same
  // failure -- the two read-only surfaces stay in lockstep. The
  // `componentsResolved: true` arm with an EMPTY components map keeps
  // the renderer's switch quiet (no `components: not resolved` marker,
  // no per-kind lines) -- a failure row is its own structural signal;
  // INFO-05's marker is reserved for external-source `(installed)` /
  // `(available)` rows.
  let manifest: MarketplaceManifest;
  try {
    manifest = await loadMarketplaceManifest(mpRecord.manifestPath);
  } catch (err) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: [narrowProbeError(err)],
        componentsResolved: true,
        components: {},
      },
    };
  }

  // (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
  // Same `componentsResolved: true` + empty components rationale as
  // (a) above.
  const entry = manifest.plugins.find((p) => p.name === pluginName);
  if (entry === undefined) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: ["not in manifest"],
        componentsResolved: true,
        components: {},
      },
    };
  }

  const installed = mpRecord.plugins[pluginName];
  const installedVersion = installed?.version;
  const manifestVersion = entry.version;
  const description = entry.description;
  const dependencies = normalizeDependencies((entry as Record<string, unknown>).dependencies);

  // INFO-05 source-kind gate.
  const parsedSource = parsePluginSource((entry as Record<string, unknown>).source);
  const resolvable = isLocallyResolvable(parsedSource);

  // (c) Installed bucket.
  if (installed !== undefined) {
    const row = await buildInstalledRow(
      pluginName,
      installedVersion ?? manifestVersion,
      description,
      dependencies,
      entry,
      mpRecord,
      resolvable,
    );
    return wrapBlock(marketplace, scope, marketplaceDetails, row);
  }

  // (d) / (e) Not installed -> resolve to classify available / unavailable.
  // `resolvable` is not threaded: the `(unavailable)` arm catches every
  // non-path source because `resolveStrict` returns `installable: false`
  // for them, so the `(available)` arm is reached only with path sources.
  const row = await buildNotInstalledRow(
    pluginName,
    manifestVersion,
    description,
    dependencies,
    entry,
    mpRecord,
  );
  return wrapBlock(marketplace, scope, marketplaceDetails, row);
}

function wrapBlock(
  marketplace: string,
  scope: Scope,
  marketplaceDetails: { readonly autoupdate: boolean },
  plugin: PluginInfoRow,
): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: marketplace,
    marketplaceScope: scope,
    marketplaceDetails,
    plugin,
  };
}

/**
 * Build an `(installed)` row. When the source kind is `"path"` (the
 * only locally resolvable kind), run `resolveStrict` to compute the
 * per-kind component arrays + sort them. For all other source kinds,
 * emit `componentsResolved: false` (INFO-05 marker).
 */
async function buildInstalledRow(
  pluginName: string,
  version: string | undefined,
  description: string | undefined,
  dependencies: readonly string[] | undefined,
  entry: MarketplaceManifest["plugins"][number],
  mpRecord: MarketplaceRecord,
  resolvable: boolean,
): Promise<PluginInfoRow> {
  if (!resolvable) {
    return {
      status: "installed",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      componentsResolved: false,
    };
  }

  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
    if (resolved.installable) {
      return {
        status: "installed",
        name: pluginName,
        ...(version !== undefined && { version }),
        ...(description !== undefined && { description }),
        componentsResolved: true,
        components: await composeResolvedComponents(resolved.pluginRoot, resolved),
        ...(dependencies !== undefined && { dependencies }),
      };
    }

    // resolveStrict returned NotInstallable but the state record says
    // installed -- the marketplace clone changed, OR the manifest now
    // declares an unsupported field (`hooks` / `lspServers`). Surface
    // the disagreement via `narrowResolverNotes` so the row does not
    // render byte-identically to a deliberate external-source defer
    // (which has no reason brace). Status stays `installed` because the
    // state record confirms the install.
    const resolverReasons = narrowResolverNotes(resolved.notes);
    return {
      status: "installed",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...(resolverReasons.length > 0 && { reasons: resolverReasons }),
      componentsResolved: false,
    };
  } catch (err) {
    // Probe failure on disk -- classify the underlying failure via
    // `narrowProbeError`. Status stays `installed` (state record
    // confirms the install); the `{reason}` brace makes the
    // persistence-vs-disk disagreement explicit and prevents byte-
    // identical render with a deliberate external-source defer.
    const reasons: readonly Reason[] = [narrowProbeError(err)];
    return {
      status: "installed",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }
}

/**
 * Build the row for a plugin that is NOT in the state's installed
 * bucket. `resolveStrict` decides between `(available)` and
 * `(unavailable)`; the per-kind component arrays follow the same
 * INFO-05 source-kind gate as the installed row.
 */
async function buildNotInstalledRow(
  pluginName: string,
  version: string | undefined,
  description: string | undefined,
  dependencies: readonly string[] | undefined,
  entry: MarketplaceManifest["plugins"][number],
  mpRecord: MarketplaceRecord,
): Promise<PluginInfoRow> {
  let resolved;
  try {
    resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
  } catch (err) {
    // Probe throw -> classify the underlying failure via the same
    // `narrowProbeError` ladder used by `list.ts`. Hardcoding
    // `"unreadable"` here would diverge from the list surface for the
    // same `EACCES` / `ENOENT` failures.
    const reasons: readonly Reason[] = [narrowProbeError(err)];
    return {
      status: "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }

  if (!resolved.installable) {
    const reasons = narrowResolverNotes(resolved.notes);
    return {
      status: "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...(reasons.length > 0 && { reasons }),
      componentsResolved: false,
    };
  }

  // Non-path sources reach the `(unavailable)` arm above because
  // `resolveStrict` returns `installable: false` for them -- so by the
  // time control gets here the source is path-resolvable and
  // `composeResolvedComponents` is safe to call without an external-
  // source short-circuit. The `resolvable` parameter is informational.
  return buildAvailableRow({
    pluginName,
    version,
    description,
    dependencies,
    pluginRoot: resolved.pluginRoot,
    resolvedForComponents: resolved,
  });
}

/**
 * `(available)` row constructor for a path-source plugin (the only
 * locally-resolvable kind). Walks `composeResolvedComponents` to gather
 * per-kind names; a non-ENOENT readdir failure during component
 * discovery propagates here and is classified via `narrowProbeError`
 * so a permission-denied directory cannot silently render as
 * "no components".
 */
async function buildAvailableRow(opts: {
  readonly pluginName: string;
  readonly version: string | undefined;
  readonly description: string | undefined;
  readonly dependencies: readonly string[] | undefined;
  readonly pluginRoot: string;
  readonly resolvedForComponents: Parameters<typeof composeResolvedComponents>[1];
}): Promise<PluginInfoRow> {
  const { pluginName, version, description, dependencies } = opts;

  try {
    const components = await composeResolvedComponents(opts.pluginRoot, opts.resolvedForComponents);
    return {
      status: "available",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      componentsResolved: true,
      components,
      ...(dependencies !== undefined && { dependencies }),
    };
  } catch (err) {
    const reasons: readonly Reason[] = [narrowProbeError(err)];
    return {
      status: "available",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }
}

export async function getPluginInfo(opts: GetPluginInfoOptions): Promise<void> {
  // INFO-03 iteration order: project-first per MSG-GR-3 when both
  // scopes are searched; otherwise the explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Collect (scope, record) tuples so the fan-out renderer preserves
  // the outer-loop iteration order. Each scope's state is loaded
  // read-only via `loadState` (NFR-5 preserved -- NO network).
  const found: { scope: Scope; record: MarketplaceRecord }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces[opts.marketplace];
    if (record !== undefined) {
      found.push({ scope, record });
    }
  }

  // Branch on the collected marketplaces (a) / (b) / (c) per the file
  // header.
  if (found.length === 0) {
    // `{not added}` carve-out reused. The renderer's predicate emits
    // ONLY the bare plugin row when `status === "failed"` and
    // `reasons === ["not added"]`; `marketplaceName`,
    // `marketplaceScope`, `marketplaceDetails` are unused on this
    // path. `plugin.name` carries the MARKETPLACE name -- the user-
    // facing failure is "the marketplace is not added", not "the
    // plugin doesn't exist". `plugin.scope` is set when a `--scope`
    // was requested (renders `[user]` / `[project]`); OMITTED when
    // `--scope` was undefined and BOTH scopes missed (the bracket
    // suppresses).
    const message: NotificationMessage = {
      kind: "plugin-info",
      marketplaceName: opts.marketplace,
      marketplaceScope: opts.scope ?? "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "failed",
        name: opts.marketplace,
        ...(opts.scope !== undefined && { scope: opts.scope }),
        reasons: ["not added"],
        componentsResolved: false,
      },
    };
    notify(opts.ctx, opts.pi, message);
    return;
  }

  // Destructure to make the branch choice unambiguous and avoid the
  // silent fall-through hazard the pre-fix `if (found.length === 1) /
  // if (sole !== undefined)` had under `noUncheckedIndexedAccess`.
  const [sole, ...rest] = found;
  if (sole !== undefined && rest.length === 0) {
    const block = await buildBlock(opts.marketplace, opts.plugin, sole.scope, sole.record);
    notify(opts.ctx, opts.pi, block);
    return;
  }

  // (c) Two marketplaces found (BOTH scopes hold the marketplace).
  // Emit the fan-out variant `PluginInfoCascadeMessage`. `blocks`
  // order follows the iteration order of the outer scopes loop above
  // (project-first per MSG-GR-3). The destructure-and-rebuild proves
  // the non-empty tuple shape that the cascade type requires.
  const blocks = await Promise.all(
    found.map((f) => buildBlock(opts.marketplace, opts.plugin, f.scope, f.record)),
  );
  const [head, ...tail] = blocks;
  if (head === undefined) {
    // Unreachable: the (a) / (b) branches above already returned for
    // empty / single-element `found`; here `blocks.length >= 2`.
    return;
  }

  const message: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [head, ...tail],
  };
  notify(opts.ctx, opts.pi, message);
}

// Test-only re-export of the shared classifier so callers exercising
// this orchestrator's behavior can verify the closed-set ladder without
// reaching into `shared/probe-classifiers.ts` directly.
export { narrowProbeError as __test_narrowProbeError };
