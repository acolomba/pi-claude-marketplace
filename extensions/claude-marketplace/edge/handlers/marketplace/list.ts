// edge/handlers/marketplace/list.ts
//
// Thin-shim plain handler for
// `/claude:plugin marketplace list [--scope user|project]`.
// No factory needed -- `listMarketplaces` takes no orchestrator-side
// dependencies. Delegates with parsed scope (undefined = enumerate both).

import { listMarketplaces } from "../../../orchestrators/marketplace/list.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin marketplace list [--scope user|project]";

export async function handleMarketplaceList(
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const parsed = parseCommandArgs(
    args,
    {
      positional: [] as const,
      usage: USAGE,
    },
    (message) => {
      notifyError(ctx, message);
    },
  );
  if (parsed === undefined) {
    return;
  }

  await listMarketplaces({
    ctx,
    cwd: ctx.cwd,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  });
}
