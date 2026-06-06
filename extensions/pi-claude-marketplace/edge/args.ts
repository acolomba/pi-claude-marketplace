// edge/args.ts
//
// AP-1 tokenizer + AP-2 / AP-4 --scope validator. `Scope` resolves from
// `shared/types.ts` so `edge/` can consume it without violating the D-11
// import boundary (edge MUST NOT import from `domain/`).
//
// PRD §6.6 AP-1: tokenize single (`'...'`) and double (`"..."`) quoted strings;
// no backslash escapes, no quote nesting, no mixed-quote escape (intentional
// minimalism).
//
// PRD §6.6 AP-2: `--scope user` and `--scope project` are the only legal
// values. Missing value throws `--scope requires a value: "user" or "project".`.
// Invalid value throws `Invalid --scope value: "<x>". Must be "user" or "project".`.
//
// PRD §6.6 AP-4: `--scope` may appear at any position in the argument list
// (position-independent). Positionals are recovered in input order regardless
// of where the `--scope` pair appears.

import type { Scope } from "../shared/types.ts";

export interface ParsedArgs {
  positional: string[];
  scope?: Scope;
}

export function parseArgs(args: string): ParsedArgs {
  const tokens = tokenize(args);
  const positional: string[] = [];
  let scope: Scope | undefined;

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) {
      i++;
      continue;
    }

    if (token === "--scope") {
      i++;
      const val = tokens[i];
      if (val === "user" || val === "project") {
        scope = val;
      } else if (val === undefined) {
        throw new Error(`--scope requires a value: "user" or "project".`);
      } else {
        throw new Error(`Invalid --scope value: "${val}". Must be "user" or "project".`);
      }
    } else {
      positional.push(token);
    }

    i++;
  }

  if (scope !== undefined) {
    return { positional, scope };
  }

  return { positional };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (const ch of input) {
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}
