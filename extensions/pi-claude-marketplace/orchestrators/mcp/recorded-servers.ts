// orchestrators/mcp/recorded-servers.ts
//
// MREC-01 / D-MB-04: the one reader of a plugin record's `mcpServerConfigs`.
// The built-in registration and the effective compatibility read take a
// record's MCP servers from here, and from nowhere else.
//
// MREC-02: a record without the field predates it. Absence never means "no
// servers": the legacy reader re-resolves the declaration from the recorded
// plugin root instead. A present empty array means the plugin declares no
// non-malformed server, and the legacy reader is not called.
//
// UF-1 / NFR-10: a record's plugin root must lie inside its own clone root
// before any of its files is read: a git record's own `plugin-clones/<key>/`
// entry, any other record's marketplace root, which for a cloned marketplace
// must itself lie inside the scope's `sources/<marketplace>/` checkout. One
// check here guards a record's stored servers, the legacy reader's
// re-resolution, and the built-in registration step.
//
// The read changes nothing: it writes no file and no state, and it reaches no
// network (NFR-5). This module is outside BLOCK F's NETWORK_SEAMS, so it can
// import no git surface.

import path from "node:path";

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { isSameVersion } from "../../domain/version.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { deriveInstallVersion } from "../plugin/install-outcome.ts";

import type { RecordedMcpServer, RecordedMcpServers } from "../../domain/mcp-implementation.ts";
import type { GitPluginRootResult, ResolveContext } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";

/** The MCP servers the legacy reader re-resolves for a record that predates the field. */
export interface LegacyServers {
  readonly servers: readonly RecordedMcpServer[];
  /** The plugin references a `.mcpb` or `.dxt` bundle (MREC-01). */
  readonly bundle: boolean;
}

/** Re-resolves the declared MCP servers of a record that predates `mcpServerConfigs`. */
export type LegacyServersReader = (record: PluginInstallRecord) => Promise<LegacyServers>;

/**
 * MREC-01 / MREC-02: a plugin record's MCP servers. `source` names the
 * marketplace record that lists the plugin and the locations of the scope
 * whose state file holds both. `readerFor` builds the legacy reader for that
 * source, and it is called only for a record without `mcpServerConfigs`.
 *
 * A record with the field answers `recorded` with the field as stored; the
 * values are the record's own, so a caller must not change them. When the
 * record's plugin root is outside its owning clone root, the stored servers
 * are refused as `uncontained` (UF-1, NFR-10). A record without the field
 * answers `re-resolved` from the legacy reader. A refusal or any failure of
 * that reader answers `unreadable`, so the stored compatibility verdict
 * stands. The reason goes to the `mcp` debug channel.
 */
export async function recordedMcpServers(
  record: PluginInstallRecord,
  source: LegacyServersSource,
  readerFor: (source: LegacyServersSource) => LegacyServersReader,
): Promise<RecordedMcpServers> {
  try {
    return await readRecordedServers(record, source, readerFor);
  } catch (err) {
    // MREC-02: an unreadable declaration leaves the stored verdict standing.
    // The debug channel keeps why, since a caller sees only `unreadable`.
    // UF-4: manifest and plugin file errors name absolute paths, which the
    // line cuts to their last segment.
    hookDebugLog(
      redactAbsolutePaths(`recorded MCP servers unreadable: ${errorMessage(err)}`),
      "mcp",
    );
    return { kind: "unreadable" };
  }
}

/** The servers `recordedMcpServers` answers with; throws for every `unreadable` answer. */
async function readRecordedServers(
  record: PluginInstallRecord,
  source: LegacyServersSource,
  readerFor: (source: LegacyServersSource) => LegacyServersReader,
): Promise<RecordedMcpServers> {
  if (record.mcpServerConfigs === undefined) {
    const legacy = await readerFor(source)(record);
    return { kind: "re-resolved", servers: legacy.servers, bundle: legacy.bundle };
  }

  // UF-1 / NFR-10: stored servers name commands and arguments from the
  // plugin's own files, so they are trusted only for a contained root.
  if (!(await isPluginRootContained(record, source))) {
    throw refusal(source, "uncontained");
  }

  return {
    kind: "recorded",
    servers: record.mcpServerConfigs,
    bundle: record.mcpBundle === true,
  };
}

/** The plugin a legacy reader re-resolves: its name and the marketplace that lists it. */
export interface LegacyServersSource {
  /** The registered marketplace name, the `<marketplace>` of `<plugin>@<marketplace>`. */
  readonly marketplaceName: string;
  readonly marketplace: Pick<
    ExtensionState["marketplaces"][string],
    "manifestPath" | "marketplaceRoot" | "source"
  >;
  readonly pluginName: string;
  /**
   * UF-1 / NFR-10: the locations of the scope whose state file holds the
   * record and its marketplace record. They name the clone root the record's
   * plugin root must lie in.
   */
  readonly locations: ScopedLocations;
}

/** Why the legacy reader could not re-resolve a record's declaration. */
type LegacyServersUnreadableReason =
  "not-in-manifest" | "unavailable" | "root-mismatch" | "version-mismatch" | "uncontained";

/**
 * MREC-02: the legacy reader refuses to re-resolve a record's declaration,
 * or `recordedMcpServers` refuses a record's stored servers (UF-1).
 * `recordedMcpServers` reads every refusal as `unreadable`.
 */
class LegacyServersUnreadableError extends Error {
  readonly reason: LegacyServersUnreadableReason;
  readonly plugin: string;
  readonly marketplace: string;
  constructor(reason: LegacyServersUnreadableReason, plugin: string, marketplace: string) {
    super(`cannot re-resolve the MCP servers of ${plugin}@${marketplace}: ${reason}`);
    this.name = "LegacyServersUnreadableError";
    this.reason = reason;
    this.plugin = plugin;
    this.marketplace = marketplace;
  }
}

/** The refusal for `source`'s plugin, for `reason`. */
function refusal(
  source: LegacyServersSource,
  reason: LegacyServersUnreadableReason,
): LegacyServersUnreadableError {
  return new LegacyServersUnreadableError(reason, source.pluginName, source.marketplaceName);
}

/** `pluginCloneKey` (`<12hex>-<sha12>`) and `pluginMirrorKey` (`<12hex>`) outputs. */
const CLONE_KEY = /^[0-9a-f]{12}(?:-[0-9a-f]{12})?$/;

/**
 * D-PL2-23: the `plugin-clones/` entry that owns a record, or `undefined` when
 * the record runs in place in its marketplace. Records carry no source kind,
 * so `plugin-clones/` owns one only when it has `resolvedSha` and its root
 * lies under `plugin-clones/`.
 */
function cloneKeyOf(record: PluginInstallRecord, pluginClonesDir: string): string | undefined {
  const relative = path.relative(pluginClonesDir, record.resolvedSource);
  if (
    record.resolvedSha === undefined ||
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }

  return relative.split(path.sep)[0];
}

/** A `dir` or `file` marketplace, whose root is the user's own directory. */
function isPathMarketplace(source: unknown): boolean {
  return (
    typeof source === "object" && source !== null && "kind" in source && source.kind === "path"
  );
}

/**
 * UF-1 / NFR-10: the one clone root a record's plugin root must lie in. A
 * cloned marketplace's root is taken from the same state file as the record,
 * so it must itself lie inside the scope's checkout of that marketplace.
 * Throws when the record names no such root.
 */
async function owningRoot(
  record: PluginInstallRecord,
  source: LegacyServersSource,
): Promise<string> {
  const { locations, marketplace } = source;
  const cloneKey = cloneKeyOf(record, locations.pluginClonesDir);
  if (cloneKey !== undefined) {
    if (!CLONE_KEY.test(cloneKey)) {
      throw new Error(`plugin root is not inside a plugin clone: ${cloneKey}`);
    }

    return locations.pluginCloneDir(cloneKey);
  }

  if (!isPathMarketplace(marketplace.source)) {
    const checkout = await locations.sourceCloneDir(source.marketplaceName);
    await assertPathInside(checkout, marketplace.marketplaceRoot, "marketplace root");
  }

  return marketplace.marketplaceRoot;
}

/**
 * UF-1 / NFR-10: whether `record`'s plugin root lies inside its owning clone
 * root, the record's `plugin-clones/<key>/` entry or its marketplace root.
 * Reads no file but the path segments it walks.
 */
export async function isPluginRootContained(
  record: PluginInstallRecord,
  source: LegacyServersSource,
): Promise<boolean> {
  try {
    const root = await owningRoot(record, source);
    await assertPathInside(root, record.resolvedSource, "plugin root");
    return true;
  } catch {
    // Any refusal, a traversal, a path outside, a symlinked segment, or a
    // root the record cannot own, leaves the plugin root uncontained.
    return false;
  }
}

/**
 * The resolve context of a re-resolution pinned to the recorded plugin root.
 * Both root callbacks answer `record.resolvedSource`, so a git source and a
 * tag-pinned path source read the recorded copy and nothing clones or fetches
 * (NFR-5). The resolver reads only `pluginRoot` from the callback's result,
 * so a legacy git record without `resolvedSha` passes an empty sha. A path
 * source without a recorded sha resolves under the marketplace root, as
 * install resolved it.
 */
function recordedRootContext(
  source: LegacyServersSource,
  record: PluginInstallRecord,
): ResolveContext {
  const recordedRoot = (): Promise<GitPluginRootResult> =>
    Promise.resolve({
      kind: "materialized",
      pluginRoot: record.resolvedSource,
      resolvedSha: record.resolvedSha ?? "",
    });
  return {
    marketplaceRoot: source.marketplace.marketplaceRoot,
    marketplaceName: source.marketplaceName,
    marketplaceSource: source.marketplace.source,
    resolveGitPluginRoot: recordedRoot,
    resolvePathPluginRoot: recordedRoot,
    ...(record.resolvedSha !== undefined && { pathPluginPin: record.resolvedSha }),
  };
}

/**
 * MREC-02: the production legacy reader for one plugin. It reads the cached
 * `marketplace.json` and the plugin's own files, and re-runs `resolveStrict`
 * pinned to the recorded plugin root. Before it reads anything, it refuses a
 * plugin root outside its owning clone root (UF-1, NFR-10): both root
 * callbacks answer the recorded root, so the root-mismatch check below
 * cannot catch such a root for a git or tag-pinned record. It refuses when
 * the manifest no longer lists the plugin, when the re-resolution is unavailable, when the
 * re-resolved plugin root is not `record.resolvedSource`, and when the
 * version install would record for the re-resolution is not the record's
 * `version`. The last check matters for an unpinned path source, whose
 * recorded root is the live directory that `marketplace update` moves
 * forward, and for a manifest entry that changed after the install: the
 * reader never returns the servers of a version the record does not name.
 * A record with `resolvedVersion` derives the version at its release tag, as
 * install did. The servers come back in D-CF6-01 merge order, as declared,
 * before plugin-variable substitution (D-MB-04).
 */
export function createLegacyServersReader(source: LegacyServersSource): LegacyServersReader {
  return async (record) => {
    if (!(await isPluginRootContained(record, source))) {
      throw refusal(source, "uncontained");
    }

    const manifest = await loadMarketplaceManifest(source.marketplace.manifestPath);
    const lookup = lookupDeclaredPlugin(manifest, source.pluginName);
    if (lookup.kind === "absent") {
      throw refusal(source, "not-in-manifest");
    }

    const resolved = await resolveStrict(lookup.entry, recordedRootContext(source, record));
    if (resolved.state === "unavailable") {
      throw refusal(source, "unavailable");
    }

    if (resolved.pluginRoot !== record.resolvedSource) {
      throw refusal(source, "root-mismatch");
    }

    const version = await deriveInstallVersion({
      entry: lookup.entry,
      installable: resolved,
      marketplace: {
        marketplaceName: source.marketplaceName,
        marketplaceRoot: source.marketplace.marketplaceRoot,
      },
      resolvedSha: record.resolvedSha,
      pinVersionOverride: undefined,
      resolvedVersion: record.resolvedVersion,
    });
    if (!isSameVersion(record.version, version, record.resolvedSha)) {
      throw refusal(source, "version-mismatch");
    }

    return {
      servers: Object.entries(resolved.declaredMcpServers).map(([name, config]) => ({
        name,
        config,
      })),
      bundle: resolved.mcpBundle === true,
    };
  };
}
