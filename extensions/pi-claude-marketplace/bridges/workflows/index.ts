// bridges/workflows/index.ts -- barrel re-export.
//
// The bridge-internal underscore-prefixed fields on PreparedWorkflowsStaged
// (the previous-names list and the rename-pairs list consumed by commit)
// are intentionally NOT re-exported here -- they are reachable only
// through the discriminated union from this barrel, and external
// consumers should never read or mutate them.

export { discoverPluginWorkflows } from "./discover.ts";
export { abortPreparedWorkflows, commitPreparedWorkflows, prepareStageWorkflows } from "./stage.ts";
export { unstagePluginWorkflows } from "./unstage.ts";

export type {
  CommitWorkflowsOptions,
  DiscoveredWorkflow,
  DiscoverPluginWorkflowsResult,
  PreparedWorkflowsStaging,
  StageWorkflowsCommitResult,
  StageWorkflowsInput,
  UnstageWorkflowFailure,
  UnstageWorkflowsInput,
  UnstageWorkflowsResult,
  WorkflowDiscoveryTarget,
  WorkflowEnvelope,
} from "./types.ts";
