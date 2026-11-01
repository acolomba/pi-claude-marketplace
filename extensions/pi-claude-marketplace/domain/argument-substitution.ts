// domain/argument-substitution.ts
//
// Port of Claude Code 2.1.316's argument substitution `T2e` (D-CF1-01): the
// passes that fill `$0`, `$ARGUMENTS[N]`, and `$ARGUMENTS` in a skill or
// command body with the arguments the user typed.
//
// Scope (D-CF1-03): Pi calls this only for skills and commands the user
// invokes. When the model reads a skill on its own, Pi gives the extension no
// hook, so that content is never substituted.

import { splitArguments } from "./shell-words.ts";

// Stands for a literal "$" until the last step, so no later pass reads it.
const LITERAL_DOLLAR = "￿";
// Brackets an inserted value, so no later pass reads it.
const WRAP = "￾";

/** The inputs of one substitution, matching `T2e`'s parameters. */
export interface ArgumentSubstitution {
  readonly body: string;
  /** The raw argument text; `undefined` when the user typed no arguments. */
  readonly args: string | undefined;
  readonly argumentNames: readonly string[];
  readonly variables: Readonly<Record<string, string>>;
  /** Append `ARGUMENTS: <args>` when nothing was substituted (default true). */
  readonly append?: boolean;
}

interface SubstitutionState {
  readonly args: string;
  readonly words: readonly string[];
  substituted: boolean;
}

function wrapValue(value: string): string {
  return WRAP + value.replaceAll("$", LITERAL_DOLLAR) + WRAP;
}

function insertValue(state: SubstitutionState, value: string): string {
  state.substituted = true;
  return wrapValue(value);
}

function replaceIndexedArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll(/\$ARGUMENTS\[(\d+)\]/g, (matched, index: string) => {
    const word = state.words[Number.parseInt(index, 10)];
    return word === undefined ? LITERAL_DOLLAR + matched.slice(1) : insertValue(state, word);
  });
}

function replacePositionalArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll(/\$(\d+)(?!\w)/g, (matched, index: string) => {
    const word = state.words[Number.parseInt(index, 10)];
    return word === undefined ? matched : insertValue(state, word);
  });
}

function replaceRawArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll("$ARGUMENTS", () => insertValue(state, state.args));
}

function appendArguments(body: string, state: SubstitutionState, append: boolean): string {
  return !state.substituted && append && state.args !== ""
    ? `${body}\n\nARGUMENTS: ${wrapValue(state.args)}`
    : body;
}

/**
 * Fill a skill or command body with the user's arguments, as Claude Code
 * 2.1.316's `T2e` does (D-CF1-01). Argument `N` is `splitArguments(args)[N]`,
 * 0-based. A missing index stays literal. When nothing was substituted and the
 * arguments are not empty, `\n\nARGUMENTS: <args>` is appended.
 */
export function substituteArguments(input: ArgumentSubstitution): string {
  const { args, append = true } = input;
  if (args === undefined) {
    return input.body;
  }

  const state: SubstitutionState = { args, words: splitArguments(args), substituted: false };
  let body = replaceIndexedArguments(input.body, state);
  body = replacePositionalArguments(body, state);
  body = replaceRawArguments(body, state);
  body = appendArguments(body, state, append);
  return body.replaceAll(LITERAL_DOLLAR, "$").replaceAll(WRAP, "");
}
