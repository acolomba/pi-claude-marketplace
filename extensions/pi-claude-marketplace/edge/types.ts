// edge/types.ts
//
// D-04: `EdgeDeps` is the orchestrator-side injection surface that
// Phase 7's `index.ts` wires up. `register.ts` (Plan 06-05) accepts
// `EdgeDeps` and builds the `SubcommandHandlers` record from it.
//
// `GitOps` lives in `orchestrators/marketplace/shared.ts` (Phase 4 D-12).
// `PluginUpdateFn` lives in `orchestrators/types.ts` (Phase 4 D-06).
// `edge/` imports both -- allowed by Phase 1 D-11 (edge -> orchestrators).
//
// `SubcommandHandlers` is re-exported from `./router.ts` so consumers can
// import the entire edge type surface from a single module:
// `import type { EdgeDeps, SubcommandHandlers } from "./types.ts"`.

export type { SubcommandHandlers } from "./router.ts";

import type {
  ClaudeImportExecutionResult,
  ImportClaudeSettingsOptions,
} from "../orchestrators/import/execute.ts";
import type { GitOps } from "../orchestrators/marketplace/shared.ts";
import type { PluginUpdateFn } from "../orchestrators/types.ts";

export interface EdgeDeps {
  readonly gitOps: GitOps;
  readonly pluginUpdate: PluginUpdateFn;
  readonly importClaudeSettings?: (
    opts: ImportClaudeSettingsOptions,
  ) => Promise<ClaudeImportExecutionResult>;
}
