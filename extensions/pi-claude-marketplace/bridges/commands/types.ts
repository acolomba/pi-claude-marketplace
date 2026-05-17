// bridges/commands/types.ts
//
// Type definitions for the commands bridge (Phase 3 Plan 03-04).
//
// `PreparedCommandsStaging` is a discriminated union over `kind: "noop" |
// "staged"`. The "noop" branch carries no staging-dir state because the
// short-circuit (no commands AND no previous names) avoids creating one.
// The "staged" branch carries the absolute `stagingRoot` plus the
// per-file `_renamePairs` and `_previousNames` consumed by
// `commitPreparedCommands`. Underscore-prefixed fields are bridge-internal
// commit state -- they are intentionally NOT re-exported from the barrel
// (`bridges/commands/index.ts`) so external consumers cannot read or
// mutate them.
//
// `StageCommandsCommitResult.recorded` (W-05 fix) gives Phase 5
// install/update orchestrators the per-command (sourcePath, targetPath)
// records needed to populate `state.json` without re-discovering after
// commit.

import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/** A single command discovered under `componentPaths.commands`. */
export interface DiscoveredCommand {
  /** `.md` basename minus extension (e.g. "acme-deploy" or "status"). */
  readonly sourceName: string;
  /** `<plugin>:<command>` after CM-2 elision (e.g. "acme:deploy"). */
  readonly generatedName: string;
  /** Absolute path to the source `.md` file. */
  readonly commandFile: string;
}

/** Input bundle for `prepareStageCommands`. */
export interface StageCommandsInput {
  readonly locations: ScopedLocations;
  readonly marketplaceName: string;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  readonly resolved: ResolvedPluginInstallable;
  /** Names previously staged for this (mp, plugin) -- read from state.json on re-stage. */
  readonly previousCommandNames?: readonly string[];
}

/** Per-command record returned to Phase 5 for `state.json` population (W-05). */
export interface StagedCommandRecord {
  readonly generatedName: string;
  /** Absolute path to the source `.md` file (pre-substitution). */
  readonly sourcePath: string;
  /** Absolute path to the target `.md` file under `<extensionRoot>/resources/prompts/`. */
  readonly targetPath: string;
}

/** Result returned to callers after commit (or noop). */
export interface StageCommandsCommitResult {
  readonly stagedNames: readonly string[];
  /** W-05 fix: Phase 5 reads `recorded` to populate state.json. */
  readonly recorded: readonly StagedCommandRecord[];
  readonly warnings: readonly string[];
}

/** Discriminated union -- `kind: "noop" | "staged"`. */
export type PreparedCommandsStaging = PreparedCommandsNoop | PreparedCommandsStaged;

/** Short-circuit branch: no commands, no previous names. Commit is a no-op. */
export interface PreparedCommandsNoop {
  readonly kind: "noop";
  readonly result: StageCommandsCommitResult;
}

/** Staged branch: per-command files written under `stagingRoot`, awaiting commit. */
export interface PreparedCommandsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  /** Absolute path: `<extensionRoot>/commands-staging/<uuid>/`. */
  readonly stagingRoot: string;
  readonly result: StageCommandsCommitResult;
  /** Bridge-internal -- previous names to remove on commit (re-stage path). */
  readonly _previousNames: readonly string[];
  /** Bridge-internal -- per-file rename pairs applied at commit. */
  readonly _renamePairs: readonly { from: string; to: string }[];
}

/** Opaque reinstall replacement handle for staged commands. */
export type CommandsReplacement = CommandsReplacementNoop | CommandsReplacementReplaced;

export interface CommandsReplacementNoop {
  readonly kind: "noop";
  readonly prepared: Extract<PreparedCommandsStaging, { kind: "noop" }>;
}

export interface CommandsReplacementReplaced {
  readonly kind: "replaced";
  readonly prepared: PreparedCommandsStaged;
}

/** Input bundle for `unstagePluginCommands`. */
export interface UnstageCommandsInput {
  readonly locations: ScopedLocations;
  readonly previousCommandNames: readonly string[];
}

/** Result of `unstagePluginCommands`. */
export interface UnstageCommandsResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
}
