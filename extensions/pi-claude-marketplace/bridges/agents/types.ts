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

import type { InstalledReferenceNames } from "../../domain/skill-tokens.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { StagingWarning } from "../../shared/staging-warnings.ts";

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
  /** Generated pi-subagent name -- `pi-claude-marketplace-<plugin>-<agent>` with the complete source name. */
  readonly generatedName: string;
  /** Absolute path to the source .md file. */
  readonly sourcePath: string;
  /**
   * D-CF4-01: the folder segments between the agents folder and the file,
   * present only for a file in a subfolder (`["review"]` for
   * `agents/review/security.md`).
   */
  readonly namespace?: readonly string[];
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
  /** Ready-to-write file content (frontmatter, including provenance keys, + body). */
  readonly fileContent: string;
  /** Original `model:` field from source if present (for index/provenance). */
  readonly originalModel?: string;
  /** Frontmatter fields dropped because unsupported. */
  readonly droppedFields: readonly string[];
  /** Tool tokens dropped during mapping (e.g. WebFetch, NotebookEdit). */
  readonly droppedTools: readonly string[];
  /** Human-readable warnings. */
  readonly warnings: readonly string[];
}

export interface StageAgentsInput {
  readonly referenceNames?: InstalledReferenceNames | undefined;
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  /** Absolute agent directories in resolver order; empty when no agents component exists. */
  readonly agentsDirs: readonly string[];
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
  /**
   * ANAME-02: the declared names of the MCP servers this install writes.
   * `convertAgent` maps an agent's `mcp__` tool names that name one of these
   * servers to pi-subagents `mcp:` entries.
   */
  readonly mcpServerNames?: readonly string[] | undefined;
  /**
   * D-CF4-04: the skills phase's recorded rows. The stage reads each row's
   * source `SKILL.md` for the skills an agent preloads. Absent leaves every
   * preload as a `skills:` entry.
   */
  readonly skillSources?: readonly AgentSkillSource[] | undefined;
  /**
   * Install cwd (the project root for project-scope installs), substituted for
   * `${CLAUDE_PROJECT_DIR}` in agent bodies (SUB-02). Required so a
   * project-scope caller cannot silently omit it and ship the token literal.
   * The BRIDGE gates by scope: user-scope installs ignore the value and the
   * token passes through untouched. Unlike the MCP bridge's `cwd`, this feeds
   * substitution only.
   */
  readonly cwd: string;
}

/**
 * D-CF4-04: one skill the skills phase staged, as its recorded row. The
 * agents bridge declares this shape itself, because it does not import the
 * skills bridge.
 */
export interface AgentSkillSource {
  readonly generatedName: string;
  /** Absolute source skill folder under the resolved plugin. */
  readonly sourcePath: string;
  /** Absolute staged skill folder, `<extensionRoot>/resources/skills/<name>`. */
  readonly targetPath: string;
}

/**
 * D-CF4-04: what an agent's preload of one skill becomes. `inline` is the
 * text written after the agent body; `skip` names why Claude Code would not
 * preload the skill.
 */
export type SkillPreload =
  | { readonly kind: "inline"; readonly text: string }
  | {
      readonly kind: "skip";
      readonly reason: "disable-model-invocation" | "no-description" | "unparseable";
    };

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
  /**
   * D-PL1-02: aggregated warnings. Index corruptions and per-agent conversion
   * notes are `hygiene`; D-07 duplicate-name skips are `discovery`.
   */
  readonly warnings: readonly StagingWarning[];
  /**
   * W-08 / B-08: prepare-time AG-5 foreign content surfaces here, NOT via
   * throw, per D-06 corollary. Empty when no foreign content found. The
   * orchestrator reports these as post-commit warnings.
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
  readonly previousEntries: readonly AgentsIndexEntry[];
  /** W-08: AG-5 foreign-content rows kept in index, NOT rm'd. */
  readonly foreignPreservedEntries: readonly AgentsIndexEntry[];
  /** Other (mp,plugin) rows preserved across the stage. */
  readonly otherEntries: readonly AgentsIndexEntry[];
  /** New rows produced by this stage. */
  readonly newEntries: readonly AgentsIndexEntry[];
  /** Pre-staged file paths -- {from: stagingDir/<name>.md, to: agentsDir/<name>.md}. */
  readonly stagedFilePaths: readonly { readonly from: string; readonly to: string }[];
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
