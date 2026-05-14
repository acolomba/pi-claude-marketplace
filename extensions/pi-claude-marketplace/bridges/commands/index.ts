// bridges/commands/index.ts -- barrel re-export.
//
// The bridge-internal underscore-prefixed fields on PreparedCommandsStaged
// (the previous-names list and the rename-pairs list consumed by commit)
// are intentionally NOT re-exported here -- they are reachable only
// through the discriminated union from this barrel, and external
// consumers should never read or mutate them.

export { discoverPluginCommands } from "./discover.ts";
export {
  abortPreparedCommands,
  assertNoCommandCollisions,
  commitPreparedCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
} from "./stage.ts";
export { unstagePluginCommands } from "./unstage.ts";

export type {
  CommandsReplacement,
  DiscoveredCommand,
  PreparedCommandsStaging,
  StageCommandsCommitResult,
  StageCommandsInput,
  StagedCommandRecord,
  UnstageCommandsInput,
  UnstageCommandsResult,
} from "./types.ts";
