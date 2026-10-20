// edge/handlers/plugin/reinstall.ts
//
// Thin-shim handler factory for `/claude:plugin reinstall`.
// Target forms mirror update:
//   - bare (no positional)       -> target = { kind: "all" }
//   - `@<marketplace>`           -> target = { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>`   -> target = { kind: "plugin", plugin, marketplace }
//
// RINST-01 / D-67-03: reinstall is a pure repair primitive whose overwrite of
// collisions and foreign content is unconditional. There is no command-local
// overwrite flag; any `--` token beyond `--scope`/`--local` errors as an
// UNKNOWN flag.

import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { extractLocalFlag } from "../shared.ts";

import { parsePluginTarget } from "./shared.ts";

import type { ReinstallPluginsFn } from "../../../orchestrators/plugin/reinstall-flow.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--local]";

export function makeReinstallHandler(reinstallPlugins: ReinstallPluginsFn): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. No command-local long flags
    // are passed through (RINST-01 / D-67-03: reinstall takes no overwrite
    // flag), so any unrecognized `--` token is rejected here as an UNKNOWN flag.
    const localFlag = extractLocalFlag(args, { ctx, run, usage: USAGE }, []);
    if (localFlag === undefined) {
      return;
    }

    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs(localFlag.residualArgs);
    } catch (err) {
      notifyUsageError(ctx, run, { message: errorMessage(err), usage: USAGE });
      return;
    }

    const refs = parsed.positional;
    if (refs.length > 1) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    const target = parsePluginTarget(refs[0], ctx, run, USAGE);
    if (target === undefined) {
      return;
    }

    await reinstallPlugins({
      ctx,
      run,
      cwd: ctx.cwd,
      target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(localFlag.local && { local: true }),
    });
  };
}
