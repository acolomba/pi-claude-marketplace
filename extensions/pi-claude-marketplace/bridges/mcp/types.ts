// bridges/mcp/types.ts
//
// Type-only module: shapes shared across the MCP bridge surface
// (parse / collision-slots / stage / unstage). Kept in a single file so
// the discriminated `PreparedMcpStaging` union and `StageMcpInput` /
// `UnstageMcpInput` records cannot drift apart across modules.

import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * Free-shape MCP server entry as it appears in `mcp.json` (post-resolution).
 * Per pi-mcp-adapter contract the bridge does no per-field validation
 * beyond shape ("must be an object"); the adapter owns all runtime
 * semantics. Forward-compat fields land in the index signature.
 */
export interface McpServerEntry {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
  readonly [extra: string]: unknown;
}

/**
 * Top-level shape of any `mcp.json` document we read from disk -- either
 * a scoped (`<scopeRoot>/mcp.json`) doc or one of the four pi-mcp-adapter
 * collision slots. Both wrapped (`{mcpServers: {...}}`) and unwrapped
 * (`{server-name: {...}}`) forms appear at this layer; per-slot shape
 * normalization happens in the consumers.
 */
export interface RawMcpDoc {
  readonly mcpServers?: Record<string, unknown>;
  readonly [extra: string]: unknown;
}

/** MC-1 source-of-truth tag returned by `resolvePluginMcpServers`. */
export type McpServersSource = "marketplace-entry" | "plugin-manifest" | "standalone" | "none";

/** Outcome of MC-1 precedence resolution. `servers` is empty when source === "none". */
export interface ResolvedMcpServers {
  readonly source: McpServersSource;
  readonly servers: Record<string, unknown>;
}

/** MC-1 input bundle. `pluginRoot` is consulted only when entry+manifest are both absent. */
export interface ResolvePluginMcpServersInput {
  readonly entry: { readonly mcpServers?: unknown };
  readonly manifest: { readonly mcpServers?: unknown };
  readonly pluginRoot: string;
}

/** Input record for `prepareStageMcpServers`. */
export interface StageMcpInput {
  readonly locations: ScopedLocations;
  /** Used by MC-4 collision check to construct the four-slot list. */
  readonly cwd: string;
  readonly marketplaceName: string;
  readonly pluginName: string;
  /** Already-resolved per-plugin servers (output of `resolvePluginMcpServers().servers`). */
  readonly servers: Record<string, unknown>;
  /** Canonical provenance for state.json (e.g. "<pluginRoot>/.mcp.json"); optional. */
  readonly sourcePath?: string;
}

/**
 * One staged-server record for Phase 5 state.json population (W-05 fix).
 * Phase 5 reads `StageMcpCommitResult.recorded` -- not the StageMcpInput --
 * because by commit time the per-server `targetPath` is final and the
 * generated server name is already stable.
 */
export interface StagedMcpRecord {
  /** Server name as it appears in mcp.json (== input key; no rename today). */
  readonly generatedName: string;
  /** Canonical source: "<pluginRoot>/.mcp.json" or "<pluginRoot>/<plugin>.json#mcpServers". */
  readonly sourcePath: string;
  /** Absolute path to the scoped mcp.json the server landed in. */
  readonly targetPath: string;
}

/** Discriminated commit-result shape. `stagedNames` aliases `recorded.map(r=>r.generatedName)`. */
export interface StageMcpCommitResult {
  readonly stagedNames: readonly string[];
  // W-05 fix: Phase 5 reads `recorded` to populate state.json (CONTEXT.md
  // "Integration Points" line 192). Order matches stagedNames.
  readonly recorded: readonly StagedMcpRecord[];
  readonly warnings: readonly string[];
}

/** Discriminated union for prepare → commit → abort. */
export type PreparedMcpStaging = PreparedMcpNoop | PreparedMcpStaged;

/**
 * AS-8 noop branch. No new servers AND no previous-ours -- prepare
 * decided to materialize nothing. Commit is a zero-op; abort is a
 * synchronous no-op.
 */
export interface PreparedMcpNoop {
  readonly kind: "noop";
  readonly result: StageMcpCommitResult;
}

/**
 * Staged branch. `_nextDoc` is the in-memory merged doc that
 * `commitPreparedMcp` will write atomically. The leading underscore
 * marks it as bridge-internal -- the barrel does NOT re-export this
 * field's shape; consumers use `result` instead.
 */
export interface PreparedMcpStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagedNames: readonly string[];
  readonly result: StageMcpCommitResult;
  readonly _nextDoc: RawMcpDoc;
}

/** Opaque reinstall replacement handle for staged MCP changes. */
export type McpReplacement = McpReplacementNoop | McpReplacementReplaced;

export interface McpReplacementNoop {
  readonly kind: "noop";
  readonly prepared: Extract<PreparedMcpStaging, { kind: "noop" }>;
}

export interface McpReplacementReplaced {
  readonly kind: "replaced";
  readonly prepared: PreparedMcpStaged;
}

/** Input record for `unstageMcpServers`. */
export interface UnstageMcpInput {
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
}

/** Result of unstageMcpServers. `removedNames` is empty when nothing matched. */
export interface UnstageMcpResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
}
