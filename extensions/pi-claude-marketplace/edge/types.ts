// edge/types.ts
//
// D-04: `EdgeDeps` is the orchestrator-side injection surface that
// `index.ts` wires up. `register.ts` accepts `EdgeDeps` and builds the
// `SubcommandHandlers` record from it.
//
// `GitOps` lives in `orchestrators/marketplace/shared.ts` (D-12).
// `PluginUpdateFn` lives in `orchestrators/types.ts` (D-06).
// `edge/` imports both -- allowed by D-11 (edge -> orchestrators).
//
// This module declares `EdgeDeps` only. `SubcommandHandlers` is declared and
// exported by `./router.ts` -- import it from there
// (`import type { SubcommandHandlers } from "./router.ts"`, as `register.ts`
// does). A convenience re-export used to let both types be imported from this
// module, but nothing imported the pair together, so it is gone.

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
