// bridges/agents/types.ts
//
// Type contracts for the agents bridge. Notable shapes:
//   1. Discriminated PreparedAgentsStaging union (noop|staged) carries a
//      kind tag so commit/abort branch on `kind` rather than empty-string
//      sentinels.
//   2. StageAgentsCommitResult includes `recorded: StagedAgentRecord[]`
//      (W-05) so install/update can populate state.json.installs.
//   3. StageAgentsCommitResult includes `failed: UnstageAgentFailure[]`
//      (W-08) so prepare-time AG-5 foreign content surfaces softly per D-06
//      corollary, instead of throwing.
//
// W-04: typed fields + open index signature use `unknown` to avoid TS2411
// (typed-string fields incompatible with `string | undefined` index).
// The line-based parser in frontmatter.ts only emits string values for the
// known fields; consumers narrow as needed.

import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

export interface RawAgentFrontmatter {
  readonly name?: string;
  readonly description?: string;
  readonly model?: string;
  readonly tools?: string;
  readonly disallowedTools?: string;
  readonly thinking?: string;
  readonly effort?: string;
  readonly skills?: string;
  readonly [extra: string]: unknown;
}

export interface DiscoveredAgent {
  /** Source agent name (frontmatter `name:` if set, else filename stem). */
  readonly sourceName: string;
  /** Generated pi-subagent name -- `pi-claude-marketplace-<plugin>-<agent>` with AG-1 elision. */
  readonly generatedName: string;
  /** Absolute path to the source .md file. */
  readonly sourcePath: string;
  /** sha256 hex digest of the source file's raw bytes (BOM/line-ending tolerant). */
  readonly sourceHash: string;
  /** Parsed frontmatter -- typed strings for known fields; open index for extras. */
  readonly raw: RawAgentFrontmatter;
  /** Body of the source file (after the closing ---), normalized line endings. */
  readonly body: string;
}

export interface ConvertedAgent {
  readonly generatedName: string;
  readonly sourceName: string;
  readonly sourcePath: string;
  readonly sourceHash: string;
  /** Ready-to-write file content (frontmatter + provenance comment + body). */
  readonly fileContent: string;
  /** Original `model:` field from source if present (for index/comment). */
  readonly originalModel?: string;
  /** Frontmatter fields dropped because unsupported. */
  readonly droppedFields: readonly string[];
  /** Tool tokens dropped during mapping (e.g. WebFetch, NotebookEdit). */
  readonly droppedTools: readonly string[];
  /** Human-readable warnings. */
  readonly warnings: readonly string[];
}

export interface StageAgentsInput {
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  readonly resolved: MaterializablePlugin;
  /** Absolute path to plugin's agents/ dir, or null when the plugin has no agents component. */
  readonly agentsSourceDir: string | null;
  /** Generated skill names for this plugin (used to validate `skills:` refs). */
  readonly knownSkills?: readonly string[];
  /**
   * AG-7 opt-in: when true, `convertAgent` runs the model-mapping table
   * (sonnet/opus/haiku/inherit/unknown) and emits `model:` accordingly.
   * When false (the default), the generated frontmatter omits `model:`
   * entirely and Pi picks its own default model. Threaded only on the
   * install/update direct paths -- the marketplace autoupdate cascade
   * always leaves this unset, so cascade-driven re-installs omit `model:`.
   */
  readonly mapModel?: boolean;
}

/**
 * Per-agent stage record. Read to populate state.json.installs.
 */
export interface StagedAgentRecord {
  readonly generatedName: string;
  readonly sourcePath: string;
  readonly targetPath: string;
}

export interface UnstageAgentFailure {
  readonly generatedName: string;
  readonly targetPath: string;
  readonly reason: string;
}

export interface StageAgentsCommitResult {
  /** Generated agent names that will land in <scopeRoot>/agents/. */
  readonly stagedNames: readonly string[];
  /**
   * W-05: per-record array read to populate state.json.installs.
   * Distinct from stagedNames because state.json wants the full {generatedName,
   * sourcePath, targetPath} tuple, not just names.
   */
  readonly recorded: readonly StagedAgentRecord[];
  /** Aggregated warnings (per-agent + per-row index corruptions). */
  readonly warnings: readonly string[];
  /**
   * W-08 / B-08: prepare-time AG-5 foreign content surfaces here, NOT via
   * throw, per D-06 corollary. Empty when no foreign content found. The
   * orchestrator routes these to notifyWarning.
   */
  readonly failed: readonly UnstageAgentFailure[];
}

export type PreparedAgentsStaging = PreparedAgentsNoop | PreparedAgentsStaged;

export interface PreparedAgentsNoop {
  readonly kind: "noop";
  readonly result: StageAgentsCommitResult;
}

export interface PreparedAgentsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagingDir: string;
  readonly result: StageAgentsCommitResult;
  // Internals -- opaque to orchestrators (NOT re-exported from index.ts).
  /** Previous index entries safe to overwrite (foreign-content excluded). */
  readonly _previousEntries: readonly AgentsIndexEntry[];
  /** W-08: AG-5 foreign-content rows kept in index, NOT rm'd. */
  readonly _foreignPreservedEntries: readonly AgentsIndexEntry[];
  /** Other (mp,plugin) rows preserved across the stage. */
  readonly _otherEntries: readonly AgentsIndexEntry[];
  /** New rows produced by this stage. */
  readonly _newEntries: readonly AgentsIndexEntry[];
  /** Pre-staged file paths -- {from: stagingDir/<name>.md, to: agentsDir/<name>.md}. */
  readonly _stagedFilePaths: readonly { readonly from: string; readonly to: string }[];
}

export interface ReplacePreparedAgentsOptions {
  readonly force?: boolean;
}

/** Opaque reinstall replacement handle for staged agents. */
export type AgentsReplacement = AgentsReplacementNoop | AgentsReplacementReplaced;

export interface AgentsReplacementNoop {
  readonly kind: "noop";
  readonly prepared: Extract<PreparedAgentsStaging, { kind: "noop" }>;
}

export interface AgentsReplacementReplaced {
  readonly kind: "replaced";
  readonly prepared: PreparedAgentsStaged;
}

export interface UnstageAgentsInput {
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
}

export interface UnstageAgentsResult {
  readonly removedNames: readonly string[];
  readonly failed: readonly UnstageAgentFailure[];
  readonly warnings: readonly string[];
}
