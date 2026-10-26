// edge/handlers/plugin/apply.ts
//
// D-07 / APL-01 handler factory for `/claude:plugin apply [--scope user|project]`.
//
// The shim parses `--scope`, rejects any positional argument and any unknown
// flag, then hands the reconcile apply step the router's notification run.
// With no scope flag the apply step covers both scopes, project first
// (MSG-GR-3).
//
// CR-01: proper-lockfile is not re-entrant, and the apply step takes its own
// per-scope locks, so this handler takes none.

import { withScopeOnlyArgs } from "./shared.ts";

import type { InstallHooksRouting } from "../../../orchestrators/plugin/install-disable-cascade.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";
import type { SubcommandHandler } from "../../router.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin apply [--scope user|project]";

export interface ApplyHandlerDeps {
  readonly completionCache: CompletionCache;
  readonly applyReconcile: EdgeDeps["applyReconcile"];
}

/** Builds the `apply` handler over the injected reconcile apply step. */
export function makeApplyHandler(
  deps: ApplyHandlerDeps,
  hooksRouting: InstallHooksRouting,
): SubcommandHandler {
  return withScopeOnlyArgs(USAGE, async (scope, ctx, run): Promise<void> => {
    await deps.applyReconcile({
      ctx,
      run,
      cwd: ctx.cwd,
      hooksRouting,
      completionCache: deps.completionCache,
      ...(scope !== undefined && { scope }),
    });
  });
}
