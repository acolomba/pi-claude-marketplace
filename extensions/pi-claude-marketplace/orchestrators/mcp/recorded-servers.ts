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
// The read changes nothing: it writes no file and no state, and it reaches no
// network (NFR-5). This module is outside BLOCK F's NETWORK_SEAMS, so it can
// import no git surface.

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { isSameVersion } from "../../domain/version.ts";
import { deriveInstallVersion } from "../plugin/install-outcome.ts";

import type { RecordedMcpServer, RecordedMcpServers } from "../../domain/mcp-implementation.ts";
import type { GitPluginRootResult, ResolveContext } from "../../domain/resolver-types.ts";
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
 * MREC-01 / MREC-02: a plugin record's MCP servers. A record with
 * `mcpServerConfigs` answers `recorded` with the field as stored; the values
 * are the record's own, so a caller must not change them. A record without
 * the field answers `re-resolved` from the legacy reader, and any failure of
 * that reader answers `unreadable`, so the stored compatibility verdict
 * stands.
 */
export async function recordedMcpServers(
  record: PluginInstallRecord,
  reader: LegacyServersReader,
): Promise<RecordedMcpServers> {
  if (record.mcpServerConfigs !== undefined) {
    return {
      kind: "recorded",
      servers: record.mcpServerConfigs,
      bundle: record.mcpBundle === true,
    };
  }

  try {
    const legacy = await reader(record);
    return { kind: "re-resolved", servers: legacy.servers, bundle: legacy.bundle };
  } catch {
    // MREC-02: an unreadable declaration leaves the stored verdict standing.
    return { kind: "unreadable" };
  }
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
}

/** Why the legacy reader could not re-resolve a record's declaration. */
export type LegacyServersUnreadableReason =
  "not-in-manifest" | "unavailable" | "root-mismatch" | "version-mismatch";

/**
 * MREC-02: the legacy reader refuses to re-resolve a record's declaration.
 * `recordedMcpServers` reads every refusal as `unreadable`.
 */
export class LegacyServersUnreadableError extends Error {
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
 * pinned to the recorded plugin root. It refuses when the manifest no longer
 * lists the plugin, when the re-resolution is unavailable, when the
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
  const refuse = (reason: LegacyServersUnreadableReason): LegacyServersUnreadableError =>
    new LegacyServersUnreadableError(reason, source.pluginName, source.marketplaceName);

  return async (record) => {
    const manifest = await loadMarketplaceManifest(source.marketplace.manifestPath);
    const lookup = lookupDeclaredPlugin(manifest, source.pluginName);
    if (lookup.kind === "absent") {
      throw refuse("not-in-manifest");
    }

    const resolved = await resolveStrict(lookup.entry, recordedRootContext(source, record));
    if (resolved.state === "unavailable") {
      throw refuse("unavailable");
    }

    if (resolved.pluginRoot !== record.resolvedSource) {
      throw refuse("root-mismatch");
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
      throw refuse("version-mismatch");
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
