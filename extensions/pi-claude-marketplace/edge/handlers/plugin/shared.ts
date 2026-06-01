// edge/handlers/plugin/shared.ts
//
// Argument-parsing failures route
// through `notifyUsageError` per MSG-NC-2 / MSG-SR-7 (sentence form
// preserved; Usage block appended after a blank line). Entity-shape errors
// live in the orchestrator layer and surface as `EntityErrorRow` compact
// lines per CMC-34 / MSG-NC-1.

import { notifyUsageError } from "../../../shared/notify.ts";
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

export interface ParsedPositionalsResult {
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
}

/**
 * Scans raw positional tokens for known boolean flags (currently --map-model)
 * and separates them from non-flag positionals. Returns undefined and emits
 * `notifyUsageError` if an unrecognised long flag is encountered (MSG-NC-2:
 * argument-parsing failure with Usage-block-appended sentence form).
 */
export function parsePositionalsWithFlags(
  tokens: readonly string[],
  ctx: ExtensionCommandContext,
  usage: string,
): ParsedPositionalsResult | undefined {
  let mapModel = false;
  const nonFlagPositionals: string[] = [];
  for (const token of tokens) {
    if (token === "--map-model") {
      mapModel = true;
    } else if (token.startsWith("--")) {
      notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage });
      return undefined;
    } else {
      nonFlagPositionals.push(token);
    }
  }

  return { nonFlagPositionals, mapModel };
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
      // MSG-NC-2: argument-parsing failure surfaces with Usage block.
      // parseCommandArgs passes either an error message OR the usage block
      // itself on the missing-required-positional path; suppress the
      // duplicate-usage case by stripping when message === usage.
      const head = message === usage ? "Missing required argument." : message;
      notifyUsageError(ctx, { message: head, usage });
    },
  );
  if (parsed === undefined) {
    return undefined;
  }

  const ref = splitPluginMarketplaceRef(parsed.ref);
  if (ref === undefined) {
    // PI-1 invalid `<plugin>@<marketplace>` token -- USAGE error per MSG-NC-2.
    notifyUsageError(ctx, {
      message: `Invalid <plugin>@<marketplace> ref: "${parsed.ref}".`,
      usage,
    });
    return undefined;
  }

  return {
    ...ref,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  };
}
