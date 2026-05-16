// edge/handlers/plugin/shared.ts

import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { Scope } from "../../../shared/types.ts";

export interface PluginMarketplaceRef {
  readonly marketplace: string;
  readonly plugin: string;
}

export interface ParsedPluginMarketplaceRef extends PluginMarketplaceRef {
  readonly scope?: Scope;
}

export function splitPluginMarketplaceRef(ref: string): PluginMarketplaceRef | undefined {
  const atIdx = ref.indexOf("@");
  if (atIdx <= 0 || atIdx === ref.length - 1) {
    return undefined;
  }

  return {
    plugin: ref.slice(0, atIdx),
    marketplace: ref.slice(atIdx + 1),
  };
}

export function parseRequiredPluginMarketplaceRef(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
): ParsedPluginMarketplaceRef | undefined {
  const parsed = parseCommandArgs(
    args,
    {
      positional: [{ name: "ref" }] as const,
      usage,
    },
    (message) => {
      notifyError(ctx, message);
    },
  );
  if (parsed === undefined) {
    return undefined;
  }

  const ref = splitPluginMarketplaceRef(parsed.ref);
  if (ref === undefined) {
    notifyError(ctx, usage);
    return undefined;
  }

  return {
    ...ref,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  };
}
