// bridges/workflows/index.ts -- barrel re-export.
//
// The bridge-internal underscore-prefixed fields on PreparedWorkflowsStaged
// (the previous-names list and the rename-pairs list consumed by commit)
// are intentionally NOT re-exported here -- they are reachable only
// through the discriminated union from this barrel, and external
// consumers should never read or mutate them.
//
// `PreparedWorkflowsStaging` is the one type an orchestrator declares in a
// signature, so it is the one type this barrel carries. The bridge's other
// contracts stay on `./types.ts`, where their sole outside reader
// (`orchestrators/marketplace/shared.ts`) already imports them.

export { discoverPluginWorkflows } from "./discover.ts";
export { abortPreparedWorkflows, commitPreparedWorkflows, prepareStageWorkflows } from "./stage.ts";
export { unstagePluginWorkflows } from "./unstage.ts";

export type { PreparedWorkflowsStaging } from "./types.ts";
