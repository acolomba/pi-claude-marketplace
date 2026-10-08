// bridges/mcp/types.ts
//
// Type-only module: shapes shared across the MCP bridge surface
// (collision-slots / adapter-doc / stage / unstage / legacy). Kept in a single file so
// the discriminated `PreparedMcpStaging` union and `StageMcpInput` /
// `UnstageMcpInput` records cannot drift apart across modules.

import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { McpWrittenFile } from "../../shared/errors-bridges.ts";
import type { McpConfigNotice } from "../../shared/notification-dispatch.ts";

/**
 * Top-level shape of an MCP config document: `<scopeRoot>/mcp-adapter.json`,
 * or the legacy `<scopeRoot>/mcp.json`. Other top-level fields are
 * preserved verbatim; only the server maps are read or mutated.
 */
export interface RawMcpDoc {
  readonly mcpServers?: unknown;
  readonly [extra: string]: unknown;
}

/** Input record for `prepareStageMcpServers`. */
export interface StageMcpInput {
  readonly locations: ScopedLocations;
  /** The project root whose config sources the AFILE-05 collision walk reads. */
  readonly cwd: string;
  readonly marketplaceName: string;
  readonly pluginName: string;
  /** Already-resolved per-plugin servers from the domain plugin resolver. */
  readonly servers: Record<string, unknown>;
  /** Absolute install path substituted for `${CLAUDE_PLUGIN_ROOT}` and injected into stdio env (MENV-01/02). */
  readonly pluginRoot: string;
  /** Per-plugin data dir substituted for `${CLAUDE_PLUGIN_DATA}` and injected into stdio env (MENV-01/02). */
  readonly pluginData: string;
  /** Canonical provenance for state.json (e.g. "<pluginRoot>/.mcp.json"); optional. */
  readonly sourcePath?: string;
  /** The plugin's description, written on every server entry when present (ANAME-06). */
  readonly description?: string | undefined;
  /**
   * The environment Claude's variable rule reads at install time (AVAR-02).
   * Absent means Pi's `process.env`.
   */
  readonly env?: ClaudeEnv | undefined;
}

/**
 * One staged-server record for state.json population (W-05).
 * Callers read `StageMcpCommitResult.recorded` -- not the StageMcpInput --
 * because by commit time the per-server `targetPath` is final.
 */
export interface StagedMcpRecord {
  /**
   * The server's declared name, which state.json records. Its entry in
   * mcp-adapter.json sits under `generatedMcpServerKey(plugin, name)`
   * (ANAME-01).
   */
  readonly generatedName: string;
  /** Canonical source: "<pluginRoot>/.mcp.json" or "<pluginRoot>/<plugin>.json#mcpServers". */
  readonly sourcePath: string;
  /** Absolute path to the scoped mcp-adapter.json the server landed in. */
  readonly targetPath: string;
}

/** Discriminated commit-result shape. `stagedNames` aliases `recorded.map(r=>r.generatedName)`. */
export interface StageMcpCommitResult {
  /**
   * The staged servers' declared names. Each entry sits under
   * `generatedMcpServerKey(plugin, name)` (ANAME-01).
   */
  readonly stagedNames: readonly string[];
  // W-05: callers read `recorded` to populate state.json. Order matches
  // stagedNames.
  readonly recorded: readonly StagedMcpRecord[];
  readonly warnings: readonly string[];
  /**
   * AFILE-04 / AFILE-02 / AFILE-06 / AVAR-04: facts about the config file this
   * stage rewrites or leaves alone, for the orchestrator to route to the user:
   * a `comments-dropped` or `left-unchanged` notice, then one `override-kept`
   * notice per absorbed override whose fields stop applying, then the
   * per-server variable notices from the variable reports of the staged
   * entries, in declared server order: a server's `variables-missing` notice
   * before its `credentials-blanked` notice (AVAR-05), then the per-server
   * `tool-rules-unenforced` notices, in declared server order (ANAME-07), then
   * one `leftover-removed` notice per old-name leftover the stage drops from
   * the target (AMIG-01). Distinct from `warnings`, which are hygiene notes
   * standalone commands do not show.
   */
  readonly notices: readonly McpConfigNotice[];
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
 * Staged branch. The underscored members are the in-memory writes that
 * `commitPreparedMcp` and `replacePreparedMcp` perform. The leading underscore
 * marks them as bridge-internal by convention only -- they are still
 * reachable through the exported `PreparedMcpStaging` union; consumers
 * should use `result` instead.
 */
export interface PreparedMcpStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagedNames: readonly string[];
  readonly result: StageMcpCommitResult;
  /**
   * The next scope `mcp-adapter.json`. Absent when the stage leaves that file
   * alone: the plugin has no server, owns no entry there and left no leftover
   * there (AMIG-01).
   */
  readonly _nextDoc?: RawMcpDoc;
  /**
   * AMIG-02: present when the scope's `mcp.json` holds the plugin's marked
   * entries, so `replacePreparedMcp` knows whose entries to remove. `names`
   * lists them in file order.
   */
  readonly _legacy?: {
    readonly pluginName: string;
    readonly marketplaceName: string;
    readonly names: readonly string[];
  };
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
  /**
   * AMIG-02: what the replace removed from the scope's `mcp.json` after its
   * `mcp-adapter.json` writes; all empty when the plugin had no marked entry.
   */
  readonly legacy: RemoveLegacyMcpResult;
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
  /**
   * AFILE-04 / AFILE-06: for each file the unstage rewrote,
   * `mcp-adapter.json` before `mcp.json`, a `comments-dropped` notice when
   * its bytes held JSONC comments, then one `override-restored` notice per
   * kept override it wrote back. Empty when nothing was removed.
   */
  readonly notices: readonly McpConfigNotice[];
  /**
   * NFR-3: each file the unstage rewrote and the exact bytes it wrote, in
   * write order. Empty when nothing was removed.
   */
  readonly written: readonly McpWrittenFile[];
}

/**
 * AMIG-01: one plugin that owns marked entries in a scope's legacy
 * `mcp.json`. `names` lists its server keys in file order.
 */
export interface LegacyMcpOwner {
  readonly plugin: string;
  readonly marketplace: string;
  readonly names: readonly string[];
}

/**
 * AMIG-01: a user-scope plugin the reload move stages, and the old names of
 * its marked `mcp.json` entries, whose disable stubs in the project
 * `mcp-adapter.json` `removeProjectDisableStubs` drops.
 */
export interface ProjectDisableStubOwner {
  readonly pluginName: string;
  readonly marketplaceName: string;
  readonly names: readonly string[];
}

/** AMIG-01: input record for `removeLegacyMcpEntries`. */
export interface RemoveLegacyMcpInput {
  readonly locations: ScopedLocations;
  readonly pluginName: string;
  readonly marketplaceName: string;
}

/**
 * AMIG-01: result of `removeLegacyMcpEntries`. `removedNames` lists the
 * removed server keys in file order, `notices` the facts about `mcp.json`
 * (AFILE-04, AFILE-02), and `written` the file and the exact bytes written to
 * it (NFR-3). All three are empty when nothing was removed.
 */
export interface RemoveLegacyMcpResult {
  readonly removedNames: readonly string[];
  readonly notices: readonly McpConfigNotice[];
  readonly written: readonly McpWrittenFile[];
}
