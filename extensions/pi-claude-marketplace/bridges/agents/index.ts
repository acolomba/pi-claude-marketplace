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
  assertAgentCommitTargets,
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "./stage.ts";
export { unstagePluginAgents } from "./unstage.ts";
export { discoverPluginAgents } from "./discover.ts";
export { assertAgentTargetsFree } from "./target-check.ts";

export type { PreparedAgentsStaging } from "./types.ts";
