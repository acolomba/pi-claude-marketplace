// edge/handlers/plugin/shared.ts
//
// Argument-parsing failures route
// through `notifyUsageError` per MSG-NC-2 / MSG-SR-7 (sentence form
// preserved; Usage block appended after a blank line). Entity-shape errors
// live in the orchestrator layer and surface as `EntityErrorRow` compact
// lines per CMC-34 / MSG-NC-1.

import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { parseArgs } from "../../args.ts";

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
  readonly force: boolean;
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
  let force = false;
  const nonFlagPositionals: string[] = [];
  for (const token of tokens) {
    if (token === "--map-model") {
      mapModel = true;
    } else if (token === "--force") {
      // D-65-05: install/update route through this shared scanner, so the
      // `--force` arm MUST precede the unknown-flag rejection below or the
      // token falls through to `Unknown flag: "--force".`.
      force = true;
    } else if (token.startsWith("--")) {
      notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage });
      return undefined;
    } else {
      nonFlagPositionals.push(token);
    }
  }

  return { nonFlagPositionals, mapModel, force };
}

export interface ParsedMapModelArgs {
  readonly scope?: Scope;
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
  readonly force: boolean;
}

/**
 * Shared opening parse sequence for the `--map-model`-bearing plugin handlers
 * (`install` / `update`). Runs `parseArgs` (notifying via `notifyUsageError`
 * with `errorMessage(err)` on an MSG-NC-2 argument-parsing failure), then
 * `parsePositionalsWithFlags` with its undefined-guard. Returns `undefined`
 * whenever an error has ALREADY been notified (parse failure OR an unknown
 * long flag); on success returns the destructured `{ nonFlagPositionals,
 * mapModel }` plus `parsed.scope` (carried via spread so the optional-property
 * contract matches `parsed.scope`'s `Scope | undefined` shape under TS strict).
 * Each handler keeps its own distinct post-parse positional logic.
 */
export function parseMapModelArgs(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
): ParsedMapModelArgs | undefined {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (err) {
    // MSG-NC-2: argument-parsing failure (invalid --scope value) -- sentence
    // form with Usage block appended after a blank line.
    notifyUsageError(ctx, { message: errorMessage(err), usage });
    return undefined;
  }

  const flagged = parsePositionalsWithFlags(parsed.positional, ctx, usage);
  if (flagged === undefined) {
    return undefined;
  }

  return {
    nonFlagPositionals: flagged.nonFlagPositionals,
    mapModel: flagged.mapModel,
    force: flagged.force,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
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
