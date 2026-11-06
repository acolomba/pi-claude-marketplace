// orchestrators/mcp/recorded-servers.ts
//
// MREC-01 / D-MB-04: the one reader of a plugin record's `mcpServerConfigs`.
// Every reader of a record's MCP servers goes through here: the built-in
// registration, the effective compatibility read, info, and mcp-migration.
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
// re-resolution, and the built-in registration step. Every read takes a
// source that only `legacyServersSourceFor` builds, so the record and the
// marketplace name come from the marketplace record the check trusts. The
// check trusts a source only with the locations of the scope its marketplace
// record names.
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
import { ownValue } from "../../shared/own-key.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { deriveInstallVersion } from "../plugin/install-outcome.ts";

import type {
  RecordedMcpServer,
  RecordedMcpServers,
  UnreadableMcpServersReason,
} from "../../domain/mcp-implementation.ts";
import type { GitPluginRootResult, ResolveContext } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";

/** The MCP servers the legacy reader re-resolves for a record that predates the field. */
export interface LegacyServers {
  readonly servers: readonly RecordedMcpServer[];
  /** The plugin references a `.mcpb` or `.dxt` bundle (MREC-01). */
  readonly bundle: boolean;
}

/** Re-resolves the MCP servers of `source`'s record, which predates `mcpServerConfigs`. */
export type LegacyServersReader = (source: LegacyServersSource) => Promise<LegacyServers>;

/**
 * MREC-01 / MREC-02: the MCP servers of `source`'s record. `readLegacy` is
 * called only for a record without `mcpServerConfigs`.
 *
 * A record with the field answers `recorded` with the field as stored; the
 * values are the record's own, so a caller must not change them. When the
 * record's plugin root is outside its owning clone root, the stored servers
 * are refused as `uncontained` (UF-1, NFR-10), and an uncontained stored
 * record answers `unreadable`. A record without the field answers
 * `re-resolved` from the legacy reader. A refusal or any failure of that
 * reader answers `unreadable`, so the stored compatibility verdict stands.
 * The answer carries the refusal's reason, or `read-failed` for any other
 * failure; the message goes to the `mcp` debug channel.
 */
export async function recordedMcpServers(
  source: LegacyServersSource,
  readLegacy: LegacyServersReader,
): Promise<RecordedMcpServers> {
  try {
    return await readRecordedServers(source, readLegacy);
  } catch (error: unknown) {
    // MREC-02: an unreadable declaration leaves the stored verdict standing.
    // The caller sees only the reason; the debug channel keeps the message.
    // UF-4: manifest and plugin file errors name absolute paths, which the
    // line cuts to their last segment.
    hookDebugLog(
      redactAbsolutePaths(`recorded MCP servers unreadable: ${errorMessage(error)}`),
      "mcp",
    );
    return {
      kind: "unreadable",
      reason: error instanceof RecordedServersUnreadableError ? error.reason : "read-failed",
    };
  }
}

/** The servers `recordedMcpServers` answers with; throws for every `unreadable` answer. */
async function readRecordedServers(
  source: LegacyServersSource,
  readLegacy: LegacyServersReader,
): Promise<RecordedMcpServers> {
  const { record } = source;
  if (record.mcpServerConfigs === undefined) {
    const legacy = await readLegacy(source);
    return { kind: "re-resolved", servers: legacy.servers, bundle: legacy.bundle };
  }

  // UF-1 / NFR-10: stored servers name commands and arguments from the
  // plugin's own files, so they are trusted only for a contained root.
  if (!(await isPluginRootContained(source))) {
    throw refusal(source, "uncontained");
  }

  return {
    kind: "recorded",
    servers: record.mcpServerConfigs,
    bundle: record.mcpBundle === true,
  };
}

/** Unique brand symbol; only `legacyServersSourceFor` builds a source. */
const LEGACY_SERVERS_SOURCE_BRAND: unique symbol = Symbol("LegacyServersSource");

/**
 * UF-1 / NFR-10: the plugin whose record's MCP servers are read. Only
 * `legacyServersSourceFor` builds one, so its marketplace name, plugin name,
 * and record come from one marketplace record, and its locations are those of
 * the scope whose state file the caller read.
 */
export interface LegacyServersSource {
  readonly [LEGACY_SERVERS_SOURCE_BRAND]: true;
  /**
   * The marketplace record that lists the plugin. Its `name` is the
   * `<marketplace>` of `<plugin>@<marketplace>`.
   */
  readonly marketplace: Pick<
    ExtensionState["marketplaces"][string],
    "name" | "scope" | "manifestPath" | "marketplaceRoot" | "source"
  >;
  readonly pluginName: string;
  /** The plugin record that `marketplace` lists under `pluginName`. */
  readonly record: PluginInstallRecord;
  /**
   * The locations of the scope whose state file holds the record and its
   * marketplace record. They name the clone root the record's plugin root
   * must lie in.
   */
  readonly locations: ScopedLocations;
}

/**
 * UF-1 / NFR-10: the servers source of `pluginName`, read with the record
 * that `marketplace` lists under that name and with `locations`, the
 * locations of the scope whose state file holds `marketplace`. Every caller
 * passes a plugin its marketplace record lists, so the throw for an unlisted
 * plugin marks a programming mistake.
 */
export function legacyServersSourceFor(
  locations: ScopedLocations,
  marketplace: LegacyServersSource["marketplace"] &
    Pick<ExtensionState["marketplaces"][string], "plugins">,
  pluginName: string,
): LegacyServersSource {
  const record = ownValue(marketplace.plugins, pluginName);
  if (record === undefined) {
    throw new Error(`the marketplace record ${marketplace.name} lists no plugin ${pluginName}`);
  }

  return {
    [LEGACY_SERVERS_SOURCE_BRAND]: true as const,
    marketplace,
    pluginName,
    record,
    locations,
  };
}

/** Why a read refuses a record's servers; any other failure is `read-failed`. */
type RefusalReason = Exclude<UnreadableMcpServersReason, "read-failed">;

/**
 * A read refuses a record's MCP servers: the legacy reader refuses to
 * re-resolve its declaration (MREC-02), or the stored path refuses an
 * uncontained record (UF-1). `recordedMcpServers` answers every refusal as
 * `unreadable` with the refusal's reason.
 */
class RecordedServersUnreadableError extends Error {
  readonly reason: RefusalReason;
  readonly plugin: string;
  readonly marketplace: string;
  constructor(reason: RefusalReason, plugin: string, marketplace: string) {
    super(`cannot read the MCP servers of ${plugin}@${marketplace}: ${reason}`);
    this.name = "RecordedServersUnreadableError";
    this.reason = reason;
    this.plugin = plugin;
    this.marketplace = marketplace;
  }
}

/** The refusal for `source`'s plugin, for `reason`. */
function refusal(
  source: LegacyServersSource,
  reason: RefusalReason,
): RecordedServersUnreadableError {
  return new RecordedServersUnreadableError(reason, source.pluginName, source.marketplace.name);
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
 * UF-1 / NFR-10: the one clone root a record's plugin root must lie in. It
 * comes from the source's locations only when they are those of the scope
 * its marketplace record names. A cloned marketplace's root is taken from the
 * same state file as the record, so it must itself lie inside the scope's
 * checkout of that marketplace. Throws when the record names no such root.
 */
async function owningRoot(source: LegacyServersSource): Promise<string> {
  const { locations, marketplace, record } = source;
  if (marketplace.scope !== locations.scope) {
    throw new Error(
      `the marketplace record ${marketplace.name} names the ${marketplace.scope} scope, not the ${locations.scope} scope`,
    );
  }

  const cloneKey = cloneKeyOf(record, locations.pluginClonesDir);
  if (cloneKey !== undefined) {
    if (!CLONE_KEY.test(cloneKey)) {
      throw new Error(`plugin root is not inside a plugin clone: ${cloneKey}`);
    }

    return locations.pluginCloneDir(cloneKey);
  }

  if (!isPathMarketplace(marketplace.source)) {
    const checkout = await locations.sourceCloneDir(marketplace.name);
    await assertPathInside(checkout, marketplace.marketplaceRoot, "marketplace root");
  }

  return marketplace.marketplaceRoot;
}

/**
 * UF-1 / NFR-10: whether the plugin root of `source`'s record lies inside its
 * owning clone root, the record's `plugin-clones/<key>/` entry or its
 * marketplace root. A source whose locations are not those of the scope its
 * marketplace record names is never contained. Reads no file but the path
 * segments it walks.
 */
async function isPluginRootContained(source: LegacyServersSource): Promise<boolean> {
  try {
    const root = await owningRoot(source);
    await assertPathInside(root, source.record.resolvedSource, "plugin root");
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
function recordedRootContext(source: LegacyServersSource): ResolveContext {
  const { record } = source;
  const recordedRoot = (): Promise<GitPluginRootResult> =>
    Promise.resolve({
      kind: "materialized",
      pluginRoot: record.resolvedSource,
      resolvedSha: record.resolvedSha ?? "",
    });
  return {
    marketplaceRoot: source.marketplace.marketplaceRoot,
    marketplaceName: source.marketplace.name,
    marketplaceSource: source.marketplace.source,
    resolveGitPluginRoot: recordedRoot,
    resolvePathPluginRoot: recordedRoot,
    ...(record.resolvedSha !== undefined && { pathPluginPin: record.resolvedSha }),
  };
}

/**
 * MREC-02: the production legacy reader. It answers the declared MCP servers
 * of `source`'s record, which predates `mcpServerConfigs`. It reads the cached
 * `marketplace.json` and the plugin's own files, and re-runs `resolveStrict`
 * pinned to the recorded plugin root. Before it reads anything, it refuses a
 * plugin root outside its owning clone root (UF-1, NFR-10): both root
 * callbacks answer the recorded root, so the root-mismatch check below
 * cannot catch such a root for a git or tag-pinned record. It refuses when
 * the manifest no longer lists the plugin, when the re-resolution is
 * unavailable, when the re-resolved plugin root is not `record.resolvedSource`,
 * and when the version install would record for the re-resolution is not the
 * record's `version`. The last check matters for an unpinned path source, whose
 * recorded root is the live directory that `marketplace update` moves
 * forward, and for a manifest entry that changed after the install: the
 * reader never returns the servers of a version the record does not name.
 * A record with `resolvedVersion` derives the version at its release tag, as
 * install did. The servers come back in D-CF6-01 merge order, as declared,
 * before plugin-variable substitution (D-MB-04).
 */
export async function readLegacyServers(source: LegacyServersSource): Promise<LegacyServers> {
  if (!(await isPluginRootContained(source))) {
    throw refusal(source, "uncontained");
  }

  const { record } = source;
  const manifest = await loadMarketplaceManifest(source.marketplace.manifestPath);
  const lookup = lookupDeclaredPlugin(manifest, source.pluginName);
  if (lookup.kind === "absent") {
    throw refusal(source, "not-in-manifest");
  }

  const resolved = await resolveStrict(lookup.entry, recordedRootContext(source));
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
      marketplaceName: source.marketplace.name,
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
}
