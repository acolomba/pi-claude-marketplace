// edge/args-schema.ts
//
// Schema-driven positional validator.
//
// Note: `notify` is delivered as a callback parameter (`onError`),
// NOT imported. The caller (handler) passes a closure that wraps the
// canonical `notify(ctx, pi, NotificationMessage)` /
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
 * Each schema entry names a positional and whether it is required; the
 * returned object exposes each positional as a typed property (string
 * for required, string|undefined for optional). On any failure, calls
 * `onError(usage)` and returns undefined so the handler can early-
 * return.
 *
 * Example:
 *   const parsed = parseCommandArgs(args, {
 *     positional: [{ name: "marketplace" }, { name: "plugin" }],
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
    const required = entry.required !== false;
    if (required) {
      if (value === undefined || value.trim() === "") {
        onError(schema.usage);
        return undefined;
      }

      out[entry.name] = value;
    } else if (value !== undefined) {
      if (value.trim() === "") {
        onError("Argument must not be empty.");
        return undefined;
      }

      out[entry.name] = value;
    }
  }

  if (parsed.scope !== undefined) {
    out.scope = parsed.scope;
  }

  // Built field-by-field from `schema` above; the mapped conditional return
  // type cannot be verified structurally from a plain Record.
  return out as ParsedCommandArgs<Spec>;
}
