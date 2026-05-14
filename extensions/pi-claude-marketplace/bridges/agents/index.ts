// bridges/agents/index.ts
//
// Public surface barrel for the agents bridge. Internal underscore-prefixed
// fields on the staged variant of PreparedAgentsStaging are NOT re-exported
// from this module; orchestrators MUST treat the prepared object as opaque
// (D-01 opaque-handle discipline). The PreparedAgentsStaging type is exposed
// so callers can declare it in signatures, but consuming code MUST narrow on
// `kind` and pass the value to commitPreparedAgents / abortPreparedAgents
// rather than reading the internal fields.

export {
  abortPreparedAgents,
  commitPreparedAgents,
  finalizeAgentsReplacement,
  prepareStagePluginAgents,
  replacePreparedAgents,
  rollbackAgentsReplacement,
} from "./stage.ts";
export { unstagePluginAgents } from "./unstage.ts";
export { discoverPluginAgents } from "./discover.ts";
export {
  assertNoAgentCollisions,
  convertAgent,
  generatedAgentName,
  MODEL_MAP,
  THINKING_VALUES,
  TOOL_MAP,
} from "./convert.ts";
export {
  emitGeneratedAgentFile,
  parseFrontmatter,
  emitYamlScalar,
  sanitizeProvenance,
} from "./frontmatter.ts";
export { GENERATED_AGENT_MARKER, GENERATED_AGENT_PREFIX, isOwnedAgentFile } from "./marker.ts";
export { findOwnershipConflicts, partitionByOwner } from "./index-mutation.ts";

export type {
  AgentsReplacement,
  ConvertedAgent,
  DiscoveredAgent,
  PreparedAgentsStaging,
  ReplacePreparedAgentsOptions,
  RawAgentFrontmatter,
  StageAgentsCommitResult,
  StageAgentsInput,
  StagedAgentRecord,
  UnstageAgentFailure,
  UnstageAgentsInput,
  UnstageAgentsResult,
} from "./types.ts";
