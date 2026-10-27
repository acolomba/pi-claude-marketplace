// edge/types.ts
//
// D-04: `EdgeDeps` is the orchestrator-side injection surface that
// `index.ts` wires up. `register.ts` accepts `EdgeDeps` and builds the
// `SubcommandHandlers` record from it.
//
// `GitOps` lives in `orchestrators/marketplace/shared.ts` (D-12).
// `PluginUpdateFn` and `ScopeDependencyInstallFn` live in
// `orchestrators/types.ts` (D-06, D-PL2-09).
// `edge/` imports both -- allowed by D-v1.0-01-11 (edge -> orchestrators).
//
// This module declares `EdgeDeps` only. `SubcommandHandlers` is declared and
// exported by `./router.ts` -- import it from there
// (`import type { SubcommandHandlers } from "./router.ts"`, as `register.ts`
// does).

import type {
  ClaudeImportExecutionResult,
  ImportClaudeSettingsOptions,
} from "../orchestrators/import/index.ts";
import type { GitOps } from "../orchestrators/marketplace/shared.ts";
import type { ApplyReconcileOptions } from "../orchestrators/reconcile/types.ts";
import type { PluginUpdateFn, ScopeDependencyInstallFn } from "../orchestrators/types.ts";
import type { McpStatusReader } from "../platform/mcp-status.ts";
import type { NotificationContext } from "../platform/pi-api.ts";
import type { CompletionCache } from "../shared/completion-cache.ts";
import type { NotificationRun } from "../shared/notification-run.ts";

export interface EdgeDeps {
  readonly completionCache: CompletionCache;
  /**
   * ASTAT-01: the factory-owned tracker of pi-mcp-adapter's status snapshots,
   * one per extension load, that the plugin info handler reads.
   */
  readonly mcpStatus: McpStatusReader;
  readonly gitOps: GitOps;
  /**
   * Autoupdate-cascade injection seam, allocated per command invocation:
   * the marketplace update handler calls this once and passes the returned
   * function to the orchestrator, so the cascade's D-10-18 tag memos are
   * bounded by the run rather than by this binding's lifetime. UPD-DEP-D1:
   * the command's context is what a dependency install the cascade makes
   * reports through.
   */
  readonly beginPluginUpdateRun: (notification: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
  }) => PluginUpdateFn;
  /** APL-01: the reconcile apply step that `/claude:plugin apply` runs. */
  readonly applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>;
  /**
   * D-PL2-09: `apply`'s missing-dependency step over one scope, which
   * `marketplace add`, `bootstrap` and `marketplace update` run
   * (`ScopeDependencyInstallFn`).
   */
  readonly installMissingDependencies: ScopeDependencyInstallFn;
  readonly importClaudeSettings?: (
    opts: ImportClaudeSettingsOptions,
  ) => Promise<ClaudeImportExecutionResult>;
}
