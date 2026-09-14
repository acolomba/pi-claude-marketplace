// edge/handlers/shared.ts
//
// Cross-cutting edge-handler helpers shared by both the marketplace/ and
// plugin/ subtrees. This file sits at the edge/handlers/ directory root,
// alongside `edge/handlers/marketplace/` and `edge/handlers/plugin/` --
// each subtree retains its own domain-specific `shared.ts` (e.g.
// `parseRequiredPluginMarketplaceRef`); this file hosts ONLY helpers that
// are genuinely cross-cutting.
//
// extractLocalFlag originated as a private function in
// `edge/handlers/plugin/enable-disable.ts`. It was lifted here so every
// mutating-command handler consumes one canonical scanner.
//
// WR-02 corrected a regression where `--local` left in the residual args
// caused `parseRequiredPluginMarketplaceRef` to treat it as a positional
// and reject the entire command with a misleading
// "Invalid <plugin>@<marketplace> ref: '--local'." error. The scanner
// REMOVES `--local` from the residual so flag position cannot change the
// outcome -- matching how `--scope` is consumed by the downstream parser
// itself.

import { notifyUsageError } from "../../shared/notification-dispatch.ts";
import { SCOPE_TARGET_FLAG } from "../flag-catalog.ts";

import type { ExtensionCommandContext } from "../../platform/pi-api.ts";

/** Selects strict extraction of caller-supplied boolean long flags. */
export interface ConsumeLongFlags {
  readonly consumeLongFlags: readonly string[];
}

/**
 * Extracts local and accepted boolean flags in one position-independent scan.
 * Scope/value pairs remain for the downstream parser. Array-form callers keep
 * their pass-through flags and legacy residual shape; consuming callers receive
 * a flag set and reject unknown short options as well as unknown long options.
 */
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags: ConsumeLongFlags,
): { local: boolean; residualArgs: string; consumedFlags: ReadonlySet<string> } | undefined;
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags?: readonly string[],
): { local: boolean; residualArgs: string } | undefined;
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags: readonly string[] | ConsumeLongFlags = [],
): { local: boolean; residualArgs: string; consumedFlags?: ReadonlySet<string> } | undefined {
  const consuming = "consumeLongFlags" in flags;
  const acceptedFlags = consuming ? flags.consumeLongFlags : flags;
  const consumedFlags = new Set<string>();
  const residualTokens: string[] = [];
  let local = false;
  let skipValue = false;
  for (const token of args.split(/\s+/).filter((text) => text.length > 0)) {
    residualTokens.push(token);
    if (skipValue) {
      skipValue = false;
      continue;
    }

    if (token === "--scope") {
      skipValue = true;
      continue;
    }

    if (token === SCOPE_TARGET_FLAG) {
      local = true;
      residualTokens.pop();
      continue;
    }

    if (consuming && acceptedFlags.includes(token)) {
      consumedFlags.add(token);
      residualTokens.pop();
      continue;
    }

    if (isUnknownFlag(token, acceptedFlags, consuming)) {
      notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage });
      return undefined;
    }
  }

  // Preserve the legacy removal of --local even when it was a scope value.
  const residualArgs = residualTokens
    .filter((token) => consuming || token !== SCOPE_TARGET_FLAG)
    .join(" ");
  return consuming ? { local, residualArgs, consumedFlags } : { local, residualArgs };
}

function isUnknownFlag(
  token: string,
  acceptedFlags: readonly string[],
  consuming: boolean,
): boolean {
  return token.startsWith(consuming ? "-" : "--") && !acceptedFlags.includes(token);
}
