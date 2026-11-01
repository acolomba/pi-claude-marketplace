// domain/argument-substitution.ts
//
// Port of Claude Code 2.1.316's argument substitution `T2e` (D-CF1-01), with
// the value and body transforms that plugin skills and commands pass to it:
// the variable pass `FZt`, the `!` guard `xM`, and the value wrapper `m1t`.
//
// Scope (D-CF1-03): Pi calls this only for skills and commands the user
// invokes. When the model reads a skill on its own, Pi gives the extension no
// hook, so that content is never substituted.
//
// Residuals recorded under D-CF1-01:
// - Pi writes `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`,
//   `${CLAUDE_SKILL_DIR}`, and `${CLAUDE_PROJECT_DIR}` into the body at
//   install. Upstream fills them here and wraps them, so a path holding `$1`
//   or `$ARGUMENTS` is read by the `$` passes only in Pi.
// - `${user_config.*}` stays literal: plugin user configuration is not a
//   supported component, so Pi has no value for it.
// - `${CLAUDE_EFFORT}` follows Pi's session thinking level alone; frontmatter
//   `effort` has no effect on bridged skills and commands (D-CF1-05).

import { splitArguments } from "./shell-words.ts";

// Stands for a literal "$" until the last step, so no later pass reads it.
const LITERAL_DOLLAR = "￿";
// Brackets an inserted value, so no later pass reads it.
const WRAP = "￾";
// Replaces a marker character that was already in the text.
const REPLACEMENT = "�";

const MAX_CHARACTERS = 4_000_000;
const MAX_ARGUMENT_NAMES = 64;
const MAX_ARGUMENT_NAME_LENGTH = 64;

// `FZt` fills these in this order; any other `${...}` stays literal.
const VARIABLE_NAMES = [
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_SKILL_DIR",
  "CLAUDE_SESSION_ID",
  "CLAUDE_EFFORT",
] as const;

/** The effort levels Claude Code 2.1.316 gives `${CLAUDE_EFFORT}`. */
export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

// Pi thinking levels with no Claude counterpart (`off`, `minimal`) map to the
// lowest effort (D-CF1-01).
const EFFORT_BY_THINKING_LEVEL = new Map<string, ClaudeEffort>([
  ["off", "low"],
  ["minimal", "low"],
  ["low", "low"],
  ["medium", "medium"],
  ["high", "high"],
  ["xhigh", "xhigh"],
  ["max", "max"],
]);

/**
 * Thrown when a body and the values filled into it pass Claude Code's limit of
 * 4,000,000 characters (D-CF1-01). The message is Claude Code's own.
 */
export class InvocationTooLargeError extends Error {
  readonly size: number;
  readonly limit: number;
  constructor(size: number) {
    super(
      "This skill, command or hook and the arguments filled into it add up to more than 4,000,000 characters. Use shorter arguments or fewer placeholders such as $ARGUMENTS.",
    );
    this.name = "InvocationTooLargeError";
    this.size = size;
    this.limit = MAX_CHARACTERS;
  }
}

/** The inputs of one substitution, matching `T2e`'s parameters. */
export interface ArgumentSubstitution {
  readonly body: string;
  /** The raw argument text; `undefined` when the user typed no arguments. */
  readonly args: string | undefined;
  /** Names from frontmatter `arguments`, through `parseArgumentNames`. */
  readonly argumentNames: readonly string[];
  /** Values for `${CLAUDE_*}` variables, filled in the body and the arguments. */
  readonly variables: Readonly<Record<string, string>>;
  /** Append `ARGUMENTS: <args>` when nothing was substituted (default true). */
  readonly append?: boolean;
}

interface NamedArgument {
  readonly name: string;
  readonly index: number;
}

interface SubstitutionState {
  readonly args: string;
  readonly words: readonly string[];
  readonly variables: Readonly<Record<string, string>>;
  size: number;
  substituted: boolean;
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// `m1t`
function wrapValue(value: string): string {
  const protectedValue = value
    .replaceAll(LITERAL_DOLLAR, REPLACEMENT)
    .replaceAll(WRAP, REPLACEMENT)
    .replaceAll("$", LITERAL_DOLLAR);
  return WRAP + protectedValue + WRAP;
}

// `FZt`, limited to the variables Pi supplies.
function applyVariables(
  text: string,
  variables: Readonly<Record<string, string>>,
  wrap: (value: string) => string,
): string {
  let filled = text;
  for (const name of VARIABLE_NAMES) {
    const value = variables[name];
    if (value !== undefined) {
      filled = filled.replaceAll(`\${${name}}`, () => wrap(value));
    }
  }

  return filled;
}

// `xM`: an argument value cannot form a new `!` command pattern.
function guardBangs(value: string): string {
  return value
    .replaceAll("`!", "` !")
    .replaceAll("!`", "! `")
    .replaceAll(/(^|\s)!/gm, "$1\\!");
}

function insertValue(state: SubstitutionState, typed: string | undefined): string {
  const raw = typed ?? "";
  const value = guardBangs(applyVariables(raw, state.variables, (variable) => variable));
  state.size += Math.max(raw.length, value.length);
  if (state.size > MAX_CHARACTERS) {
    throw new InvocationTooLargeError(state.size);
  }

  return wrapValue(value);
}

function substitute(state: SubstitutionState, typed: string | undefined): string {
  state.substituted = true;
  return insertValue(state, typed);
}

function namedArguments(argumentNames: readonly string[]): readonly NamedArgument[] {
  return argumentNames
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name !== "" && name.length <= MAX_ARGUMENT_NAME_LENGTH)
    .slice(0, MAX_ARGUMENT_NAMES)
    .sort((left, right) => right.name.length - left.name.length);
}

function protectEscapedDollars(body: string, names: readonly NamedArgument[]): string {
  const targets = [
    String.raw`\d`,
    "ARGUMENTS",
    ...names.map(({ name }) => String.raw`${escapeRegExp(name)}(?![\[\w])`),
  ];
  const escaped = new RegExp(String.raw`(?<!\\)\\\$(?=${targets.join("|")})`, "g");
  return body.replaceAll(escaped, LITERAL_DOLLAR);
}

function replaceNamedArguments(
  body: string,
  state: SubstitutionState,
  names: readonly NamedArgument[],
): string {
  let filled = body;
  for (const { name, index } of names) {
    const placeholder = new RegExp(String.raw`\$${escapeRegExp(name)}(?![\[\w])`, "g");
    filled = filled.replaceAll(placeholder, () => substitute(state, state.words[index]));
  }

  return filled;
}

function replaceIndexedArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll(/\$ARGUMENTS\[(\d+)\]/g, (matched, index: string) => {
    const word = state.words[Number.parseInt(index, 10)];
    return word === undefined ? LITERAL_DOLLAR + matched.slice(1) : substitute(state, word);
  });
}

function replacePositionalArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll(/\$(\d+)(?!\w)/g, (matched, index: string) => {
    const word = state.words[Number.parseInt(index, 10)];
    return word === undefined ? matched : substitute(state, word);
  });
}

function replaceRawArguments(body: string, state: SubstitutionState): string {
  return body.replaceAll("$ARGUMENTS", () => substitute(state, state.args));
}

function appendArguments(body: string, state: SubstitutionState, append: boolean): string {
  return !state.substituted && append && state.args !== ""
    ? `${body}\n\nARGUMENTS: ${insertValue(state, state.args)}`
    : body;
}

/**
 * Fill a skill or command body with the user's arguments, as Claude Code
 * 2.1.316's `T2e` does (D-CF1-01). With no arguments, only the variables are
 * filled. Otherwise, in order: `\$` before a digit, `ARGUMENTS`, or a declared
 * name becomes a literal `$`; then named `$name`, `$ARGUMENTS[N]`, `$N`
 * (0-based, from `splitArguments`), and `$ARGUMENTS` (the raw text) are
 * replaced, a missing index staying literal; when nothing was replaced and the
 * arguments are not empty, `\n\nARGUMENTS: <args>` is appended. A filled-in
 * value is never read by a later pass.
 *
 * @throws InvocationTooLargeError past 4,000,000 characters.
 */
export function substituteArguments(input: ArgumentSubstitution): string {
  const { args, variables, append = true } = input;
  if (args === undefined) {
    return applyVariables(input.body, variables, (value) => value);
  }

  const cleaned = input.body.replaceAll(LITERAL_DOLLAR, REPLACEMENT).replaceAll(WRAP, REPLACEMENT);
  let body = applyVariables(cleaned, variables, wrapValue);
  const state: SubstitutionState = {
    args,
    words: splitArguments(args),
    variables,
    size: body.length,
    substituted: false,
  };
  const names = namedArguments(input.argumentNames);
  body = protectEscapedDollars(body, names);
  body = replaceNamedArguments(body, state, names);
  body = replaceIndexedArguments(body, state);
  body = replacePositionalArguments(body, state);
  body = replaceRawArguments(body, state);
  body = appendArguments(body, state, append);
  return body.replaceAll(LITERAL_DOLLAR, "$").replaceAll(WRAP, "");
}

/**
 * Read frontmatter `arguments` into declared names, as Claude Code 2.1.316's
 * `Rhe` does (D-CF1-01): a list keeps its string entries, a string is split on
 * whitespace, and empty or all-digit names are dropped. The declared order is
 * kept, because name `i` reads argument `i`; `substituteArguments` applies the
 * 64-name and 64-character limits.
 */
export function parseArgumentNames(frontmatterArguments: unknown): readonly string[] {
  const isName = (entry: unknown): entry is string =>
    typeof entry === "string" && entry.trim() !== "" && !/^\d+$/.test(entry);
  if (Array.isArray(frontmatterArguments)) {
    return frontmatterArguments.filter(isName);
  }

  return typeof frontmatterArguments === "string"
    ? frontmatterArguments.split(/\s+/).filter(isName)
    : [];
}

/**
 * The `${CLAUDE_EFFORT}` value for Pi's session thinking level (D-CF1-01):
 * `low`, `medium`, `high`, `xhigh`, and `max` map to themselves, `off` and
 * `minimal` to `low`, and an unset or unknown level to Claude Code's default
 * `high`.
 */
export function claudeEffort(thinkingLevel: string | undefined): ClaudeEffort {
  return EFFORT_BY_THINKING_LEVEL.get(thinkingLevel ?? "") ?? "high";
}
