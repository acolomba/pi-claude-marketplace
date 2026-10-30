// edge/handlers/plugin/shared.ts
//
// Argument-parsing failures route
// through `notifyUsageError` per MSG-NC-2 / MSG-SR-7 (sentence form
// preserved; Usage block appended after a blank line). Entity-shape errors
// live in the orchestrator layer and surface as `EntityErrorRow` compact
// lines per CMC-34 / MSG-NC-1.

import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { parseArgs } from "../../args.ts";
import { passThroughFlagNames } from "../../flag-catalog.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { NotificationRun } from "../../../shared/notification-run.ts";
import type { Scope } from "../../../shared/types.ts";
import type { SubcommandHandler } from "../../router.ts";

export interface PluginMarketplaceRef {
  readonly marketplace: string;
  readonly plugin: string;
}

export interface ParsedPluginMarketplaceRef extends PluginMarketplaceRef {
  readonly scope?: Scope;
}

function splitPluginMarketplaceRef(ref: string): PluginMarketplaceRef | undefined {
  const atIdx = ref.indexOf("@");
  if (atIdx < 0) {
    return undefined;
  }

  const plugin = ref.slice(0, atIdx);
  const marketplace = ref.slice(atIdx + 1);
  if (plugin.trim() === "" || marketplace.trim() === "") {
    return undefined;
  }

  return { plugin, marketplace };
}

/**
 * Splits the one `<plugin>@<marketplace>` reference of a verb that takes no
 * other form, or notifies the usage error and returns `undefined`. A reference
 * that is empty or blank as a whole names the plugin name; any other reference
 * that does not split into two non-blank halves is invalid (PI-1, USE-07).
 */
export function parsePluginRef(
  ref: string,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
  usage: string,
): PluginMarketplaceRef | undefined {
  if (ref.trim() === "") {
    notifyUsageError(ctx, run, { message: "Plugin name must not be empty.", usage });
    return undefined;
  }

  const split = splitPluginMarketplaceRef(ref);
  if (split === undefined) {
    notifyUsageError(ctx, run, {
      message: `Invalid <plugin>@<marketplace> ref: "${ref}".`,
      usage,
    });
  }

  return split;
}

export type PluginCommandTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

/**
 * Maps the optional target of `update`, `fetch`, and `reinstall`, or notifies
 * the usage error and returns `undefined`. No reference is every plugin,
 * `@<marketplace>` one marketplace, and `<plugin>@<marketplace>` one plugin. An
 * `@` with an empty or blank name names the marketplace name (D-81-01, USE-07).
 */
export function parsePluginTarget(
  ref: string | undefined,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
  usage: string,
): PluginCommandTarget | undefined {
  if (ref === undefined) {
    return { kind: "all" };
  }

  if (ref.startsWith("@")) {
    const marketplace = ref.slice(1);
    if (marketplace.trim() === "") {
      notifyUsageError(ctx, run, { message: "Marketplace name must not be empty.", usage });
      return undefined;
    }

    return { kind: "marketplace", marketplace };
  }

  const split = parsePluginRef(ref, ctx, run, usage);
  return split === undefined ? undefined : { kind: "plugin", ...split };
}

interface ParsedPositionalsResult {
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
  readonly partial: boolean;
}

// The downstream-consumed boolean flags recognized here derive from the
// catalog parse-sets of the two verbs that route through this scanner
// (install / update), minus the scope-target flag already consumed upstream
// by `extractLocalFlag`. The drift guard pins both verbs to the same exact
// set, so the union stays per-verb exact.
const DOWNSTREAM_BOOLEAN_FLAGS = new Set([
  ...passThroughFlagNames("install"),
  ...passThroughFlagNames("update"),
]);

/**
 * Scans raw positional tokens for the catalog-derived downstream boolean
 * flags (`--map-model` / `--partial`) and separates them from non-flag
 * positionals. Returns undefined and emits `notifyUsageError` if an
 * unrecognised long flag is encountered (MSG-NC-2: argument-parsing failure
 * with Usage-block-appended sentence form).
 */
function parsePositionalsWithFlags(
  tokens: readonly string[],
  ctx: ExtensionCommandContext,
  run: NotificationRun,
  usage: string,
): ParsedPositionalsResult | undefined {
  const flags = new Set<string>();
  const nonFlagPositionals: string[] = [];
  for (const token of tokens) {
    if (DOWNSTREAM_BOOLEAN_FLAGS.has(token)) {
      // D-65-05: recognized downstream flags (including `--partial`) MUST be
      // consumed before the unknown-flag rejection below or the token falls
      // through to `Unknown flag: "--partial".`.
      flags.add(token);
    } else if (token.startsWith("--")) {
      notifyUsageError(ctx, run, { message: `Unknown flag: "${token}".`, usage });
      return undefined;
    } else {
      nonFlagPositionals.push(token);
    }
  }

  return {
    nonFlagPositionals,
    mapModel: flags.has("--map-model"),
    partial: flags.has("--partial"),
  };
}

export interface ParsedMapModelArgs {
  readonly scope?: Scope;
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
  readonly partial: boolean;
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
  run: NotificationRun,
  usage: string,
): ParsedMapModelArgs | undefined {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (err) {
    // MSG-NC-2: argument-parsing failure (invalid --scope value) -- sentence
    // form with Usage block appended after a blank line.
    notifyUsageError(ctx, run, { message: errorMessage(err), usage });
    return undefined;
  }

  const flagged = parsePositionalsWithFlags(parsed.positional, ctx, run, usage);
  if (flagged === undefined) {
    return undefined;
  }

  return {
    nonFlagPositionals: flagged.nonFlagPositionals,
    mapModel: flagged.mapModel,
    partial: flagged.partial,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  };
}

/**
 * Rejects the first long-flag token of a plugin command that accepts no flag
 * beyond what its parser already consumed. Returns whether it rejected one.
 */
export function rejectUnknownFlag(
  tokens: readonly string[],
  { ctx, run, usage }: { ctx: ExtensionCommandContext; run: NotificationRun; usage: string },
): boolean {
  const flag = tokens.find((token) => token.startsWith("--"));
  if (flag === undefined) {
    return false;
  }

  notifyUsageError(ctx, run, { message: `Unknown flag: "${flag}".`, usage });
  return true;
}

export function parseRequiredPluginMarketplaceRef(
  args: string,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
  usage: string,
): ParsedPluginMarketplaceRef | undefined {
  const parsed = parseCommandArgs(
    args,
    {
      positional: [{ name: "ref", label: "Plugin name" }] as const,
      usage,
    },
    (message) => {
      // MSG-NC-2: argument-parsing failure surfaces with Usage block.
      // parseCommandArgs passes either an error message OR the usage block
      // itself on the missing-required-positional path; suppress the
      // duplicate-usage case by stripping when message === usage.
      const head = message === usage ? "Missing required argument." : message;
      notifyUsageError(ctx, run, { message: head, usage });
    },
  );
  if (parsed === undefined) {
    return undefined;
  }

  const ref = parsePluginRef(parsed.ref, ctx, run, usage);
  if (ref === undefined) {
    return undefined;
  }

  return {
    ...ref,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  };
}

/**
 * MSG-NC-2: the shared handler prelude. Parse the raw argument string and, on
 * a parse throw -- an invalid `--scope` value, an unknown long flag -- emit the
 * sentence-form usage error with the Usage block appended after a blank line,
 * then return without calling the orchestrator.
 *
 * Every `/claude:plugin` subcommand handler opens this way, so the prelude
 * lives here rather than being restated per handler.
 *
 * The returned handler takes the router's notification run and hands it to
 * `operation` beside the parsed arguments and the context (D-05). An operation
 * that renders no notification from the run may declare two parameters.
 */
export function withParsedArgs<P>(
  parse: (args: string) => P,
  usage: string,
  operation: (parsed: P, ctx: ExtensionCommandContext, run: NotificationRun) => Promise<void>,
): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    let parsed: P;
    try {
      parsed = parse(args);
    } catch (err) {
      notifyUsageError(ctx, run, { message: errorMessage(err), usage });
      return;
    }

    await operation(parsed, ctx, run);
  };
}

/**
 * D-07: the prelude of a verb whose only argument is `--scope` (`pending`,
 * `apply`). After `withParsedArgs`, a token that opens with `--` is an unknown
 * flag, and any other positional is one too many. Only then does `operation`
 * run, with the parsed scope (`undefined` when no flag narrows the command).
 */
export function withScopeOnlyArgs(
  usage: string,
  operation: (
    scope: Scope | undefined,
    ctx: ExtensionCommandContext,
    run: NotificationRun,
  ) => Promise<void>,
): SubcommandHandler {
  return withParsedArgs(parseArgs, usage, async (parsed, ctx, run): Promise<void> => {
    if (rejectUnknownFlag(parsed.positional, { ctx, run, usage })) {
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage });
      return;
    }

    await operation(parsed.scope, ctx, run);
  });
}
