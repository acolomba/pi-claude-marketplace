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
import { tokenizeArgs } from "../args.ts";
import { SCOPE_TARGET_FLAG } from "../flag-catalog.ts";

import type { ExtensionCommandContext } from "../../platform/pi-api.ts";

/** Selects strict extraction of caller-supplied boolean long flags. */
export interface ConsumeLongFlags {
  readonly consumeLongFlags: readonly string[];
}

/** The scan every caller receives: the scope-target verdict and the residual argument text. */
export interface LocalFlagScan {
  readonly local: boolean;
  readonly residualArgs: string;
}

/** The consuming-mode scan: the accepted flags the scan removed, on top of `LocalFlagScan`. */
export interface ConsumedFlagScan extends LocalFlagScan {
  readonly consumedFlags: ReadonlySet<string>;
}

/**
 * Extracts the scope-target flag, and in consuming mode the caller's accepted
 * boolean flags, in one position-independent scan. A `--scope <value>` pair
 * stays in the residual for the downstream parser. Array-form callers keep
 * their pass-through flags verbatim in the residual and only an unknown long
 * flag is rejected; consuming callers receive the consumed flags as a set and
 * every unknown option, short or long, is rejected. Returns `undefined` once
 * the usage error is notified, so the caller returns early.
 */
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags: ConsumeLongFlags,
): ConsumedFlagScan | undefined;
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags?: readonly string[],
): LocalFlagScan | undefined;
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  flags: readonly string[] | ConsumeLongFlags = [],
): LocalFlagScan | ConsumedFlagScan | undefined {
  const consuming = "consumeLongFlags" in flags;
  const acceptedFlags = consuming ? flags.consumeLongFlags : flags;
  const consumedFlags = new Set<string>();
  const isRejected = rejectionTestFor(flags);
  const tokens = tokenizeArgs(args);
  const consumed = new Set<number>();
  let local = false;
  let skipValue = false;
  for (const [index, token] of tokens.entries()) {
    const tok = token.value;
    if (skipValue) {
      skipValue = false;
      continue;
    }

    if (tok === "--scope") {
      skipValue = true;
      continue;
    }

    if (tok === SCOPE_TARGET_FLAG) {
      local = true;
      consumed.add(index);
      continue;
    }

    if (consuming && acceptedFlags.includes(tok)) {
      consumedFlags.add(tok);
      consumed.add(index);
      continue;
    }

    if (isRejected(tok)) {
      notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
      return undefined;
    }
  }

  // A SCOPE_TARGET_FLAG token sitting in the `--scope` VALUE position is that
  // flag's value, not a flag: both modes keep it verbatim, so `--scope --local
  // foo@bar` reaches the downstream parser unchanged and its message names the
  // offending value. Every other position consumes it (the loop above). Each
  // surviving token is the source slice, so quoting reaches the downstream
  // parser as the user typed it.
  const residualArgs = tokens
    .filter((_, index) => !consumed.has(index))
    .map((token) => args.slice(token.start, token.end))
    .join(" ");
  if (consuming) {
    // IN-03: the consuming overload promises `consumedFlags`, but TypeScript
    // checks an overload against the implementation signature only loosely,
    // and that signature admits a plain `LocalFlagScan` -- returning this
    // branch without the field would compile and break `consumedFlags.has(...)`
    // at the call site at runtime. The `satisfies` makes the omission a compile
    // error here, where the branch is chosen.
    return { local, residualArgs, consumedFlags } satisfies ConsumedFlagScan;
  }

  return { local, residualArgs };
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
