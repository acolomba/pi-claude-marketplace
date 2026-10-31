// edge/args-schema.ts
//
// Schema-driven positional validator.
//
// Note: `notify` is delivered as a callback parameter (`onError`),
// NOT imported. The caller (handler) passes a closure that wraps the
// canonical `notify(ctx, run, NotificationMessage)` /
// `notifyUsageError(ctx, UsageErrorMessage)` from `shared/notification-dispatch.ts`.
// This keeps this module independent of `ExtensionContext` and lets
// tests inject a spy.

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import { parseArgs, type ParsedArgs } from "./args.ts";

import type { Scope } from "../shared/types.ts";

/**
 * Parse a slash-command argument string and route any error to the notify
 * callback (so the handler can early-return). Internal helper used by
 * `parseCommandArgs`.
 */
function parseArgsOrNotify(
  args: string,
  onError: (message: string) => void,
): ParsedArgs | undefined {
  try {
    return parseArgs(args);
  } catch (err) {
    // parseArgs only throws the two controlled AP-2 diagnostics (bad/missing
    // --scope value), which are already safe to surface verbatim; logging
    // here just gives a debug trail if that ever stops being true.
    hookDebugLog(`parseArgs failed: ${errorMessage(err)}`, "args");
    onError(errorMessage(err));
    return undefined;
  }
}

/** One positional argument in a `parseCommandArgs` schema. */
export interface PositionalSpec<Name extends string = string> {
  readonly name: Name;
  /** Names the argument in `<label> must not be empty.` (USE-07). */
  readonly label: string;
  /** Defaults to true; set to false for tail-optional args. */
  readonly required?: boolean;
}

/** The typed object `parseCommandArgs` returns for a given positional schema. */
export type ParsedCommandArgs<Spec extends readonly PositionalSpec[]> = {
  readonly [Entry in Spec[number] as Entry["name"]]: Entry extends { required: false }
    ? string | undefined
    : string;
} & { readonly scope?: Scope };

/**
 * Parse + validate command args against an explicit positional schema.
 * Each schema entry names a positional, its label, and whether it is
 * required; the returned object exposes each positional as a typed property
 * (string for required, string|undefined for optional). On a failure it
 * calls `onError` once and returns undefined so the handler can early-
 * return. It reports, in order:
 *
 *   - the `--scope` errors of `parseArgs`;
 *   - an unknown flag, as `Unknown flag: "<flag>".`;
 *   - surplus positionals, as `Too many arguments.`;
 *   - then, slot by slot in schema order, an omitted required positional as
 *     the `usage` string itself, or a supplied empty or blank positional,
 *     required or optional, as `<label> must not be empty.` (USE-07).
 *
 * Example:
 *   const parsed = parseCommandArgs(args, {
 *     positional: [
 *       { name: "marketplace", label: "Marketplace name" },
 *       { name: "plugin", label: "Plugin name" },
 *     ],
 *     usage: "Usage: ...:plugin-install <marketplace> <plugin> [--scope ...]",
 *   }, onError);
 *   if (parsed === undefined) return;
 *   parsed.marketplace; // string
 *   parsed.plugin;      // string
 *   parsed.scope;       // Scope | undefined
 */
export function parseCommandArgs<const Spec extends readonly PositionalSpec[]>(
  args: string,
  schema: { positional: Spec; usage: string },
  onError: (message: string) => void,
): ParsedCommandArgs<Spec> | undefined {
  const parsed = parseArgsOrNotify(args, onError);
  if (parsed === undefined) {
    return undefined;
  }

  const unknownFlag = parsed.positional.find((token) => token.startsWith("--"));
  if (unknownFlag !== undefined) {
    onError(`Unknown flag: "${unknownFlag}".`);
    return undefined;
  }

  if (parsed.positional.length > schema.positional.length) {
    onError("Too many arguments.");
    return undefined;
  }

  const out: Record<string, string | undefined> = {};
  for (const [index, entry] of schema.positional.entries()) {
    const value = parsed.positional[index];
    if (value === undefined) {
      if (entry.required !== false) {
        onError(schema.usage);
        return undefined;
      }

      continue;
    }

    if (value.trim() === "") {
      onError(`${entry.label} must not be empty.`);
      return undefined;
    }

    out[entry.name] = value;
  }

  if (parsed.scope !== undefined) {
    out.scope = parsed.scope;
  }

  // Built field-by-field from `schema` above; the mapped conditional return
  // type cannot be verified structurally from a plain Record.
  return out as ParsedCommandArgs<Spec>;
}
