// bridges/skills/types.ts
//
// Type contracts for the skills bridge.
//
// Discriminated union `PreparedSkillsStaging = noop | staged` follows the
// prepare/commit/abort discipline but localizes the staging dir to the
// bridge per D-04 (per-skill atomic dir rename at commit instead of
// orchestrator-level tree rename).
//
// W-05: StageSkillsCommitResult exposes `recorded: StagedSkillRecord[]`
// so orchestrators can populate state.json without re-discovering skills.

import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/** A skill enumerated by `discoverPluginSkills` (one entry per source skill dir). */
export interface DiscoveredSkill {
  /** Directory name in the source plugin (e.g. `acme-knowledge`, `helper`). */
  readonly sourceName: string;
  /** `<plugin>-<skill>` with SK-2 elision applied (e.g. `acme-knowledge`, `acme-helper`). */
  readonly generatedName: string;
  /** Absolute path to the source skill directory. */
  readonly skillDir: string;
}

/** Input bundle for `prepareStageSkills`. */
export interface StageSkillsInput {
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  readonly resolved: MaterializablePlugin;
  /**
   * Names from a previous install of this plugin -- their target dirs are
   * deleted before commit-time renames so re-stages cleanly replace prior
   * staged content. Empty / absent on fresh installs.
   */
  readonly previousSkillNames?: readonly string[];
}

/**
 * One row in `StageSkillsCommitResult.recorded` -- the source/target pair the
 * orchestrator reads to populate state.json.
 */
export interface StagedSkillRecord {
  readonly generatedName: string;
  /** Absolute source dir under the resolved plugin. */
  readonly sourcePath: string;
  /** Absolute target dir under `<extensionRoot>/resources/skills/<name>/`. */
  readonly targetPath: string;
}

/** Result returned by `commitPreparedSkills` and embedded in the noop variant. */
export interface StageSkillsCommitResult {
  readonly stagedNames: readonly string[];
  /** W-05: callers read `recorded` to populate state.json. */
  readonly recorded: readonly StagedSkillRecord[];
  readonly warnings: readonly string[];
}

/** `prepareStageSkills` returns a discriminated union; orchestrators MUST narrow on `kind`. */
export type PreparedSkillsStaging = PreparedSkillsNoop | PreparedSkillsStaged;

/** No-op variant: no skills discovered AND no previous-name cleanup needed. */
export interface PreparedSkillsNoop {
  readonly kind: "noop";
  /** `recorded`/`stagedNames`/`warnings` are all empty for the noop. */
  readonly result: StageSkillsCommitResult;
}

/**
 * Staged variant: a per-skill staging directory was materialized; the
 * orchestrator MUST call either `commitPreparedSkills` or
 * `abortPreparedSkills` exactly once. Internal `_`-prefixed fields are NOT
 * re-exported from the barrel (D-01 opaque-handle discipline).
 */
export interface PreparedSkillsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagingRoot: string;
  readonly result: StageSkillsCommitResult;
  /** Internal -- orchestrators MUST NOT read these. */
  readonly _previousNames: readonly string[];
  /** Internal -- per-skill staging-to-target rename pairs for commit. */
  readonly _renamePairs: readonly { from: string; to: string }[];
}

/** Opaque reinstall replacement handle for staged skills. */
export type SkillsReplacement = SkillsReplacementNoop | SkillsReplacementReplaced;

export interface SkillsReplacementNoop {
  readonly kind: "noop";
  readonly prepared: Extract<PreparedSkillsStaging, { kind: "noop" }>;
}

export interface SkillsReplacementReplaced {
  readonly kind: "replaced";
  readonly prepared: PreparedSkillsStaged;
}

/** Input bundle for `unstagePluginSkills`. */
export interface UnstageSkillsInput {
  readonly locations: ScopedLocations;
  readonly previousSkillNames: readonly string[];
}

/** Result of `unstagePluginSkills`. */
export interface UnstageSkillsResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
}
