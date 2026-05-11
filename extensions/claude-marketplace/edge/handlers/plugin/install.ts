// edge/handlers/plugin/install.ts
//
// Thin-shim handler factory for `/claude:plugin install <plugin>@<marketplace>`.
// Pattern 1 from 06-PATTERNS.md: parseCommandArgs -> early return on undefined
// (Usage already emitted via notifyError) -> delegate to installPlugin
// orchestrator.
//
// BLOCK A: zero direct ctx.ui.notify calls -- all user-visible messages route
// through shared/notify.ts wrappers via the closure passed to parseCommandArgs.
// BLOCK C: no imports from persistence/, domain/, bridges/, transaction/,
// platform/. Only orchestrators/, shared/, edge/ (sibling) imports.

import { installPlugin } from "../../../orchestrators/plugin/install.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

const USAGE = "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project]";

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `installPlugin` for soft-dep probes). Phase 6 Plan 05 wires this factory
 * into `register.ts` via the `SubcommandHandlers` map.
 */
export function makeInstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "ref" }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyError(ctx, message);
      },
    );
    if (parsed === undefined) {
      return;
    }

    // Split `<plugin>@<marketplace>`; reject missing/leading/trailing `@`.
    const atIdx = parsed.ref.indexOf("@");
    if (atIdx <= 0 || atIdx === parsed.ref.length - 1) {
      notifyError(ctx, USAGE);
      return;
    }

    const plugin = parsed.ref.slice(0, atIdx);
    const marketplace = parsed.ref.slice(atIdx + 1);

    await installPlugin({
      ctx,
      pi,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      marketplace,
      plugin,
    });
  };
}
