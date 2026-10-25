// edge/handlers/plugin/autoapply.ts
//
// AAP-04 / AAP-D2 handler factory for
// `/claude:plugin autoapply [on|off] [--scope user|project] [--local]`.
//
// Claude Code's `/effort` shows the current level when typed bare and sets it
// with an argument, and its boolean slash commands (`/fast`, `/focus`) spell
// the value `on|off`. So the bare form shows, with `--scope` and `--local` as
// filters, and `on` or `off` sets, with `--scope` and `--local` choosing the
// file as `enable` does (user scope, base layer by default). Any other
// argument is `Unknown argument`, two are `Too many arguments`, and any other
// flag is an unknown flag.

import { setAutoapply, showAutoapply } from "../../../orchestrators/reconcile/autoapply-setting.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { extractLocalFlag } from "../shared.ts";

import { withParsedArgs } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin autoapply [on|off] [--scope user|project] [--local]";

const VALUES: ReadonlyMap<string, boolean> = new Map([
  ["on", true],
  ["off", false],
]);

/** Builds the `autoapply` handler. */
export function makeAutoapplyHandler(): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const localFlag = extractLocalFlag(args, { ctx, run, usage: USAGE });
    if (localFlag === undefined) {
      return;
    }

    // `extractLocalFlag` has already refused any flag but `--scope` and `--local`.
    await withParsedArgs(parseArgs, USAGE, async (parsed, _ctx, _run): Promise<void> => {
      const [value, ...extra] = parsed.positional;
      if (extra.length > 0) {
        notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
        return;
      }

      const enabled = value === undefined ? undefined : VALUES.get(value);
      if (value !== undefined && enabled === undefined) {
        notifyUsageError(ctx, run, { message: `Unknown argument "${value}".`, usage: USAGE });
        return;
      }

      // The runtime context is read only once the arguments are valid.
      const options = {
        ctx,
        run,
        cwd: ctx.cwd,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
        ...(localFlag.local && { local: true }),
      };
      await (enabled === undefined
        ? showAutoapply(options)
        : setAutoapply({ ...options, enabled }));
    })(localFlag.residualArgs, ctx, run);
  };
}
