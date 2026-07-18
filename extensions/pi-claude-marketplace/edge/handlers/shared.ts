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

import { notifyUsageError } from "../../shared/notify.ts";
import { SCOPE_TARGET_FLAG } from "../flag-catalog.ts";

import type { ExtensionCommandContext } from "../../platform/pi-api.ts";

/**
 * Position-independent `--local` flag scanner. Walks the tokenised args,
 * recognises `--scope <value>` as a downstream-consumed pair, recognises
 * the catalog-owned scope-target flag (`SCOPE_TARGET_FLAG`, `--local`) as
 * the flag this helper extracts, and rejects any other long flag via
 * `notifyUsageError` UNLESS listed in `passThroughLongFlags` (a
 * caller-supplied allow-list of additional boolean long flags handled by
 * the downstream domain parser, e.g. install/update's `--map-model`).
 *
 * Returns `{ local, residualArgs }` where `residualArgs` has every `--local`
 * token REMOVED (other passthrough flags are preserved verbatim for the
 * downstream parser). Returns `undefined` when an unknown long flag was
 * found (the usage error has already been notified; caller should early-
 * return).
 */
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  passThroughLongFlags: readonly string[] = [],
): { local: boolean; residualArgs: string } | undefined {
  let local = false;
  const tokens = args.split(/\s+/).filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === undefined) {
      break;
    }

    if (tok === "--scope") {
      // Consume the value (handled by the downstream domain parser).
      i += 2;
      continue;
    }

    if (tok === SCOPE_TARGET_FLAG) {
      local = true;
      i += 1;
      continue;
    }

    if (tok.startsWith("--")) {
      if (passThroughLongFlags.includes(tok)) {
        // Known downstream-consumed long flag (e.g. --map-model). Preserve
        // verbatim in residualArgs for the domain parser.
        i += 1;
        continue;
      }

      notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
      return undefined;
    }

    i += 1;
  }

  return { local, residualArgs: tokens.filter((t) => t !== SCOPE_TARGET_FLAG).join(" ") };
}
