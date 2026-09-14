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
  const isRejected = rejectionTestFor(flags);
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

    if (isRejected(token)) {
      notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage });
      return undefined;
    }
  }

  // WR-03: the two modes deliberately part company on a SCOPE_TARGET_FLAG token
  // sitting in the `--scope` VALUE position. Array-form callers strip every such
  // token regardless of position, so `install --scope --local foo@bar` reaches
  // the downstream parser as `--scope foo@bar` and it complains about the
  // positional. Consuming callers keep the token verbatim, so the same input
  // reaches the parser as `--scope --local foo@bar` and it names the offending
  // value itself -- the better message, and the reason the split exists rather
  // than being an oversight. Both modes still remove a SCOPE_TARGET_FLAG token
  // in every other position (the loop pops it above).
  const residualArgs = residualTokens
    .filter((token) => consuming || token !== SCOPE_TARGET_FLAG)
    .join(" ");
  // IN-03: the consuming overload promises a NON-optional `consumedFlags`, but
  // the implementation signature types it optional and TypeScript checks an
  // overload against its implementation only loosely -- returning the consuming
  // branch without the field would compile and break `consumedFlags.has(...)` at
  // the call site at runtime. The `satisfies` is what makes the omission a
  // compile error here, where the branch is chosen.
  return consuming
    ? ({ local, residualArgs, consumedFlags } satisfies {
        local: boolean;
        residualArgs: string;
        consumedFlags: ReadonlySet<string>;
      })
    : { local, residualArgs };
}

/**
 * IN-02: the rejection test this scan runs on a token the loop did not claim,
 * chosen ONCE from the caller's own flags argument. The two modes reject
 * different token shapes for different reasons, so each predicate below states
 * its own rule and neither carries a term that is dead in its own mode.
 */
function rejectionTestFor(flags: readonly string[] | ConsumeLongFlags): (token: string) => boolean {
  if ("consumeLongFlags" in flags) {
    return isOptionToken;
  }

  return (token: string): boolean => isUnacceptedLongFlag(token, flags);
}

/**
 * D-02-05: the consuming mode's rejection test. Every accepted flag has already
 * been consumed by the time this runs, so any surviving `-`-prefixed token is
 * unknown by construction -- short options included, which is what lets a
 * consuming caller reject `-y` rather than hand it to the reference parser.
 */
function isOptionToken(token: string): boolean {
  return token.startsWith("-");
}

/**
 * The array-form mode's rejection test: long flags only, and only those outside
 * the caller's pass-through list. Pass-through flags stay in the residual for
 * the downstream parser, so the allow-list is live in this mode and this mode
 * alone. Short options stay in the residual too -- the array-form callers'
 * downstream parser owns that verdict.
 */
function isUnacceptedLongFlag(token: string, acceptedFlags: readonly string[]): boolean {
  return token.startsWith("--") && !acceptedFlags.includes(token);
}
