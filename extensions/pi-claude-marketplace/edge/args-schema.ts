// edge/args-schema.ts
//
// Schema-driven positional validator. Ported verbatim from V1
// (`extensions/pi-claude-marketplace/commands/_args.ts`) with import refactor:
//   - `./args.ts` (sibling) for `parseArgs` (V1 imported from `../args.ts`)
//   - `../shared/errors.ts` for `errorMessage`
//   - `../shared/types.ts` for `Scope`
//
// Note: `notify` is delivered as a callback parameter (`onError`),
// NOT imported. The caller (handler) passes a closure that wraps the
// canonical `notify(ctx, pi, NotificationMessage)` /
// `notifyUsageError(ctx, UsageErrorMessage)` from `shared/notify.ts`.
// This keeps this module independent of `ExtensionContext` and lets
// tests inject a spy.

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
    onError(errorMessage(err));
    return undefined;
  }
}

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
export interface PositionalSpec<Name extends string = string> {
  readonly name: Name;
  /** Defaults to true; set to false for tail-optional args. */
  readonly required?: boolean;
}

export type ParsedCommandArgs<Spec extends readonly PositionalSpec[]> = {
  readonly [Entry in Spec[number] as Entry["name"]]: Entry extends { required: false }
    ? string | undefined
    : string;
} & { readonly scope?: Scope };

export function parseCommandArgs<const Spec extends readonly PositionalSpec[]>(
  args: string,
  schema: { positional: Spec; usage: string },
  onError: (message: string) => void,
): ParsedCommandArgs<Spec> | undefined {
  const parsed = parseArgsOrNotify(args, onError);
  if (parsed === undefined) {
    return undefined;
  }

  const out: Record<string, string | undefined> = {};
  for (const [i, entry] of schema.positional.entries()) {
    const value = parsed.positional[i];
    const required = entry.required !== false;
    if (required) {
      if (value === undefined || value.trim() === "") {
        onError(schema.usage);
        return undefined;
      }

      out[entry.name] = value;
    } else if (value !== undefined && value.trim() !== "") {
      out[entry.name] = value;
    }
  }

  if (parsed.scope !== undefined) {
    out.scope = parsed.scope;
  }

  return out as ParsedCommandArgs<Spec>;
}
