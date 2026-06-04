// orchestrators/plugin/info.ts
//
// Phase 44 / INFO-02 + INFO-03 + INFO-04 + INFO-05 + NFR-5 + IL-2.
//
// READ-ONLY: NO withStateGuard (the info surface never mutates state --
// it is a structurally read-only seam over the persisted records). NO
// `platform/git` / `DEFAULT_GIT_OPS` / `refreshGitHubClone` import
// (NFR-5: `info` MUST NOT touch the network -- a grep-gate test at
// `tests/orchestrators/plugin/info.test.ts` enforces this structurally
// by stripping comments before searching).
//
// IL-2 single-site discipline: exactly ONE `notify(opts.ctx, opts.pi,
// ...)` call per `getPluginInfo` invocation. The fan-out (when no
// `--scope` is given and the plugin+marketplace pair exists in both
// scopes) is composed by the Phase 44 `PluginInfoCascadeMessage`
// variant whose renderer joins per-block bodies with `\n\n`; the
// dispatcher still emits a single `ctx.ui.notify` call.
//
// Source-kind dispatch (INFO-05 key gate):
//   - "path"       -> components ARE resolvable from the local clone;
//                     run `resolveStrict` and emit
//                     `componentsResolved: true` with per-kind sorted
//                     arrays (PR-5 precondition: orchestrator pre-sorts).
//   - "github"     -> components CANNOT be resolved without fetching a
//                     remote clone (the marketplace clone is local, but
//                     the plugin entry's own source is GitHub). Emit
//                     `componentsResolved: false` and the marker line
//                     `    components: not resolved` (INFO-05). NFR-5
//                     preserved: no network.
//   - "url"        -> external git URL; same as "github".
//   - "git-subdir" -> external git URL + subdir; same as "github".
//   - "npm"        -> external npm package; same as "github".
//   - "unknown"    -> forward-compat tail per `domain/source.ts` (NFR-12).
//                     Default to `componentsResolved: false`; the
//                     orchestrator cannot reason about unknown source
//                     kinds, so emit the marker line rather than attempt
//                     resolution.
//
// Flow:
//   1. Determine the candidate scope set: project-first per
//      MSG-GR-3 / INFO-03 when `--scope` is omitted; otherwise the
//      explicit scope only.
//   2. For each candidate scope, `loadState(locationsFor(scope, cwd).extensionRoot)`
//      and pick up `state.marketplaces[opts.marketplace]` if present.
//   3. Branch on the collected records:
//      (a) Zero marketplaces found -> emit the Phase 42 INFO-04
//          `{not added}` `PluginInfoMessage` with `plugin.name` set to
//          the MARKETPLACE name (NOT the plugin name -- the user-facing
//          failure is "the marketplace is not added"; mirrors
//          `marketplace/info.ts:155-186` carve-out).
//      (b) One marketplace found -> emit a single `PluginInfoMessage`
//          via the shared `buildBlock` helper.
//      (c) Two marketplaces found (both scopes) -> emit a
//          `PluginInfoCascadeMessage` with
//          `blocks: [projectBlock, userBlock]` in project-first order.

import { readdir } from "node:fs/promises";
import path from "node:path";

import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { parsePluginSource, type ParsedSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { assertNever } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";

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
 * Narrow resolver `notes` strings to closed-set REASONS members (mirror
 * `orchestrators/plugin/list.ts:narrowResolverNotes`). The manifest
 * field carve-out (MSG-GR-4) passes `hooks` verbatim and maps the
 * manifest-field detection token `lspServers` to the emitted Reason
 * `lsp`; any other unsupported-source note falls through to
 * `unsupported source`. Empty notes -> empty reasons array.
 */
function narrowResolverNotes(
  notes: readonly string[],
): readonly ("hooks" | "lsp" | "unsupported source")[] {
  const out: ("hooks" | "lsp" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (note.includes("hooks") && !seen.has("hooks")) {
      out.push("hooks");
      seen.add("hooks");
      continue;
    }

    if (note.includes("lspServers") && !seen.has("lsp")) {
      out.push("lsp");
      seen.add("lsp");
      continue;
    }

    if (!seen.has("unsupported source")) {
      out.push("unsupported source");
      seen.add("unsupported source");
    }
  }

  return out;
}

/**
 * Probe-failure classifier mirroring
 * `orchestrators/plugin/list.ts::narrowProbeError`. When `resolveStrict`
 * throws on a per-row probe, classify the thrown error into a closed-set
 * `Reason` so the info surface surfaces the SAME cause class that the
 * list surface does for the same underlying failure (post-Phase 29 /
 * UXG-08 contract):
 *
 *   - `SyntaxError`           -> `unparseable` (JSON.parse on a
 *     malformed `plugin.json` / `marketplace.json`).
 *   - `EACCES` / `EPERM`      -> `permission denied`.
 *   - `ENOENT` / `ENOTDIR`    -> `source missing`.
 *   - any other thrown shape  -> `unreadable` (permissive fallback).
 *
 * Lives in `info.ts` instead of being imported from `list.ts` because
 * `shared/` is the only sanctioned cross-orchestrator import surface
 * per the project's layering rules. The two implementations MUST stay
 * in lockstep -- if `list.ts`'s ladder grows a new arm, this mirror
 * grows the same arm.
 */
function narrowProbeError(
  err: unknown,
): "permission denied" | "source missing" | "unparseable" | "unreadable" {
  if (err instanceof SyntaxError) {
    return "unparseable";
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return "permission denied";
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return "source missing";
    }
  }

  return "unreadable";
}

/**
 * INFO-05 source-kind dispatch: a `"path"` source (relative to the
 * marketplace root) is locally resolvable; every other kind lives at
 * an unsynced external location the orchestrator MUST NOT fetch
 * (NFR-5). Mirrors the file-header dispatch table; uses an exhaustive
 * `switch (src.kind)` over `ParsedSource` with `assertNever` so a
 * future 7th source kind is a compile-time error here (Phase 43 IN-01
 * follow-through).
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
 * root) and accumulate the per-kind component NAMES discovered inside.
 * Mirrors the bridge-layer discovery contract (`discoverPluginSkills`,
 * `discoverPluginCommands`, `discoverPluginAgents`) at NAME-DISCOVERY
 * granularity only -- the info surface does NOT need the bridge
 * layer's full staging metadata, just the names to display.
 *
 * For each declared directory:
 *   - skills:   directory entries -> directory NAMES (each skill is a
 *               subdirectory; the bridges' `isSkillDir` predicate is
 *               not re-checked here -- the info surface displays the
 *               authoring intent; the bridges' filtering only affects
 *               install-time staging).
 *   - commands: file entries -> basename minus `.md` suffix (commands
 *               are `.md` files per the v1 contract).
 *   - agents:   file entries -> basename minus `.md` suffix (agents
 *               are `.md` files per the v1 contract).
 *
 * Read failures (ENOENT, EACCES, etc.) yield an empty bucket for the
 * affected dir -- the info surface degrades gracefully rather than
 * failing the whole notification. The renderer's
 * `appendResolvedComponentLines` requires PRE-SORTED arrays (PR-5
 * precondition); this helper sorts before returning.
 *
 * File-private; sole caller is `composeResolvedComponents`.
 */
/** Extract the displayable name from a single directory entry per `kind`,
 *  or `undefined` if the entry does not qualify. Kept tiny to keep the
 *  outer `discoverComponentNames` under the cognitive-complexity budget. */
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

async function readEntriesGracefully(
  abs: string,
): Promise<readonly { name: string; isDirectory(): boolean; isFile(): boolean }[]> {
  try {
    return await readdir(abs, { withFileTypes: true });
  } catch {
    return [];
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
    const entries = await readEntriesGracefully(abs);
    for (const entry of entries) {
      const name = nameFromEntry(entry, kind);
      if (name !== undefined) {
        names.add(name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve a manifest entry's `dependencies` field into a sorted
 * `readonly string[]` for the renderer (PR-5 precondition). PI-13
 * keeps the field opaque (`Type.Unknown()`); the renderer surfaces
 * dependencies as `<plugin>@<marketplace>` strings if the manifest
 * provides them in that form. POLICY: when the field is an array of
 * strings, pass through (sorted alphabetically -- the orchestrator
 * imposes the sort so the byte form is deterministic across manifest
 * authoring orders); any other shape (object, nested, etc.) returns
 * `undefined` so the renderer omits the `dependencies:` line entirely.
 */
function normalizeDependencies(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const strings = raw.filter((d): d is string => typeof d === "string");
  if (strings.length === 0) {
    return undefined;
  }

  return [...strings].sort((a, b) => a.localeCompare(b));
}

/**
 * Compose the resolved-components field of a `PluginInfoRow`. Walks
 * `resolved.componentPaths` (skills/commands/agents) to discover the
 * per-kind component NAMES on disk (the resolver returns directory
 * paths; `plugin info` surfaces the named entities inside). For
 * mcpServers, the keys of `resolved.mcpServers` are the names
 * directly (no directory walk required).
 *
 * Sorts each per kind via `discoverComponentNames`. Empty per-kind
 * arrays are emitted as `undefined` so the renderer's
 * `if (names !== undefined && names.length > 0)` guard omits the line
 * (PR-5 precondition: orchestrator pre-sorts; renderer does not).
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
  const mcp = [...Object.keys(resolved.mcpServers)].sort((a, b) => a.localeCompare(b));

  return {
    ...(agents.length > 0 && { agents }),
    ...(commands.length > 0 && { commands }),
    ...(mcp.length > 0 && { mcp }),
    ...(skills.length > 0 && { skills }),
  };
}

/**
 * Build a `PluginInfoMessage` for ONE scope-record pair. File-private;
 * sole caller is `getPluginInfo` (Phase 44).
 *
 * Branching (per the file header):
 *   (a) Manifest read failure -> emit a `(failed)` row with
 *       `{unreadable}` REASON at 2-space indent under the marketplace
 *       header.
 *   (b) Plugin name not in manifest -> emit a `(failed)` row with
 *       `{not in manifest}` REASON (existing REASON, used by update.ts
 *       post-Phase 29 / UXG-08).
 *   (c) Installed bucket -> `(installed)` row + (path source ->
 *       resolved components; other sources -> `components: not
 *       resolved` marker per INFO-05).
 *   (d) Available bucket (resolveStrict installable) -> `(available)`
 *       row + components arm (resolved or not, per source kind).
 *   (e) Unavailable bucket (resolveStrict not installable OR threw)
 *       -> `(unavailable)` row with closed-set REASONS narrowed via
 *       `narrowResolverNotes`.
 */
async function buildBlock(
  marketplace: string,
  pluginName: string,
  scope: Scope,
  mpRecord: MarketplaceRecord,
): Promise<PluginInfoMessage> {
  const marketplaceDetails = { autoupdate: mpRecord.autoupdate ?? false };

  // (a) Manifest read failure -> bare `(failed) {unreadable}` row
  // under the marketplace header. The `componentsResolved: true` arm
  // with an EMPTY components map keeps the renderer's switch quiet
  // (no `components: not resolved` marker, no per-kind lines) -- a
  // failure row is its own structural signal; INFO-05's marker is
  // reserved for external-source `(installed)` / `(available)` rows.
  let manifest: MarketplaceManifest;
  try {
    manifest = await loadMarketplaceManifest(mpRecord.manifestPath);
  } catch {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: ["unreadable"],
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
  const row = await buildNotInstalledRow(
    pluginName,
    manifestVersion,
    description,
    dependencies,
    entry,
    mpRecord,
    resolvable,
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

    // WR-01 (Phase 44 review): resolveStrict returned NotInstallable
    // but the plugin is recorded as installed -- the marketplace clone
    // changed since install, OR the manifest now declares an
    // unsupported field (e.g. `hooks` / `lspServers`). Surface the
    // disagreement to the user by forwarding `narrowResolverNotes` as
    // closed-set reasons on the `(installed)` row -- mirrors the
    // post-Phase 29 / UXG-08 `narrowProbeError` discipline that
    // `list.ts` applies to its `(unavailable)` rows. Without these
    // reasons the row would render byte-identically to a deliberate
    // INFO-05 external-source defer, hiding a real failure cause.
    // Status remains `installed` because the state record confirms the
    // install; the brace makes the disagreement explicit.
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
    // WR-01 (Phase 44 review): probe failure on disk -- mirror
    // `list.ts::narrowProbeError` so the user learns whether this is a
    // permission issue, missing source, unparseable plugin.json, or a
    // generic unreadable failure. Keep `status: "installed"` because
    // the state record confirms the install; the `{reason}` brace
    // makes the persistence-vs-disk disagreement explicit (and stops
    // the row from rendering byte-identically to a deliberate INFO-05
    // external-source defer).
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
  resolvable: boolean,
): Promise<PluginInfoRow> {
  let resolved;
  try {
    resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
  } catch (err) {
    // WR-02 (Phase 44 review): probe throw -> classify the underlying
    // failure via the SAME `narrowProbeError` ladder that
    // `orchestrators/plugin/list.ts::narrowProbeError` applies on the
    // list surface. Previously this path hardcoded `"unreadable"` and
    // would render `{unreadable}` for an `EACCES` while `plugin list`
    // would render `{permission denied}` for the same underlying
    // failure -- two read-only surfaces over the same persistence
    // layer producing DIFFERENT user-facing reasons for the same
    // cause. Threading the classifier keeps the two surfaces in
    // lockstep (post-Phase 29 / UXG-08 contract).
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

  // Installable -> `(available)`. Components arm per INFO-05 source
  // gate: locally resolvable kinds surface the per-kind arrays;
  // external sources surface the `components: not resolved` marker.
  if (resolvable) {
    return {
      status: "available",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      componentsResolved: true,
      components: await composeResolvedComponents(resolved.pluginRoot, resolved),
      ...(dependencies !== undefined && { dependencies }),
    };
  }

  return {
    status: "available",
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    componentsResolved: false,
  };
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
    // (a) Phase 42 INFO-04 `{not added}` carve-out reused. The
    // renderer's predicate at `shared/notify.ts:1963-1976` checks
    // ONLY `plugin.status === "failed" && reasons.length === 1 &&
    // reasons[0] === "not added"` and emits the bare plugin row;
    // `marketplaceName`, `marketplaceScope`, and `marketplaceDetails`
    // are unused on this path (placeholders only).
    //
    // `plugin.name` is the MARKETPLACE name (NOT `opts.plugin`) --
    // the user-facing failure is "the marketplace is not added", not
    // "the plugin doesn't exist". Mirrors `marketplace/info.ts`'s
    // identical carve-out where the bare row's `name` is the
    // marketplace name.
    //
    // `plugin.scope` is set when a single `--scope` was requested
    // (renders `[user]` / `[project]`); OMITTED when `--scope` was
    // undefined and BOTH scopes missed (D-03: "absent from both
    // scopes" has no [scope] bracket because the marketplace is in
    // neither scope).
    const message: NotificationMessage = {
      kind: "plugin-info",
      marketplaceName: opts.marketplace,
      // Unused placeholder per the INFO-04 carve-out -- arbitrary
      // value; never rendered for the `{not added}` bare-row state.
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

  // (b) / (c) Destructure to make the branch choice unambiguous and
  // avoid the Phase 43 / WR-02 silent fall-through hazard. When
  // `found.length === 1`, `[sole]` is defined and `rest` is empty;
  // when `found.length === 2`, `rest` carries the second entry. The
  // exhaustive destructure pattern eliminates the
  // `noUncheckedIndexedAccess` guard branch that previously could
  // fall through into a different variant.
  const [sole, ...rest] = found;
  if (sole !== undefined && rest.length === 0) {
    const block = await buildBlock(opts.marketplace, opts.plugin, sole.scope, sole.record);
    notify(opts.ctx, opts.pi, block);
    return;
  }

  // (c) Two marketplaces found (BOTH scopes hold the marketplace).
  // Emit the Phase 44 fan-out variant `PluginInfoCascadeMessage`.
  // `blocks` order follows the iteration order of the outer scopes
  // loop above -- project-first per MSG-GR-3 / INFO-03.
  const blocks = await Promise.all(
    found.map((f) => buildBlock(opts.marketplace, opts.plugin, f.scope, f.record)),
  );
  const message: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks,
  };
  notify(opts.ctx, opts.pi, message);
}

// Test-only re-export. Mirrors the `__test_narrowProbeError` pattern
// in `orchestrators/plugin/list.ts`: the helper is file-private but
// its classification table is the load-bearing contract that callers
// (and the user) rely on. The WR-01 / WR-02 fixes (Phase 44 review)
// require this classifier to stay in lockstep with `list.ts`'s
// equivalent helper.
export { narrowProbeError as __test_narrowProbeError };
