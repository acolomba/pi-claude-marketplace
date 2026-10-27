/**
 * @fileoverview The brace tokens that stand for run-specific values in scenarios.
 *
 * A scenario cannot know where the sandbox lives, where the git host listens,
 * or when it runs, so it writes those values as tokens. The sandbox HOME,
 * project, and Pi agent directory do not nest, so the order in which their
 * tokens are replaced does not matter. A typed command has
 * each token expanded to its value, and a result value is projected back to
 * the token by exact substring, so only that exact value reads as the token
 * (D-03).
 * `{scenario time}` stands for any timestamp inside the scenario's window,
 * from the world's construction to the check (D-05). A revision token such as
 * `{ghp revision 1}` stands for the first 12 hex digits of the commit of a
 * revision a scenario published to a git plugin repository, the version Claude
 * Code records for a git plugin that declares none, and a commit token such as
 * `{ghp commit 1}` for that revision's full 40-hex commit; commit dates change
 * every run, so the sha does too. A commit starts with its revision's digits,
 * so a result is projected through the commit tokens first. An error token
 * such as `{mcp-adapter.json read error}` stands for the message this Node
 * gives a file call that a step set up to fail, which differs between Node
 * majors; the step reads it back by making the same call. An error token also
 * stands for its message with each quoted path cut to its last segment, which
 * is how import and apply show a redacted cause. A message can hold a sandbox
 * path, so a result is projected through the error tokens before any other.
 */

import path from "node:path";

/** The values the tokens stand for in one scenario. */
export interface RunTokens {
  /** The realpath of the sandbox HOME, which `{home}` stands for. */
  readonly home: string;
  /** The sandbox project, Pi's working directory, which `{project dir}` stands for. */
  readonly projectDir: string;
  /** The sandbox Pi agent directory, which `{agent dir}` stands for. */
  readonly agentDir: string;
  /** The `127.0.0.1:<port>` address of the run's git host, which `{git host}` stands for. */
  readonly gitHost: string;
  /** When the scenario started, in milliseconds since the epoch. */
  readonly scenarioStartedAt: number;
  /** The version each revision token, such as `{ghp revision 1}`, stands for. */
  readonly revisions: ReadonlyMap<string, string>;
  /** The full commit each commit token, such as `{ghp commit 1}`, stands for. */
  readonly commits: ReadonlyMap<string, string>;
  /** The error message each error token, such as `{mcp-adapter.json read error}`, stands for. */
  readonly errors: ReadonlyMap<string, string>;
}

const HOME_TOKEN = "{home}";
const PROJECT_DIR_TOKEN = "{project dir}";
const AGENT_DIR_TOKEN = "{agent dir}";
const GIT_HOST_TOKEN = "{git host}";
const SCENARIO_TIME_TOKEN = "{scenario time}";

// Pi stamps with `toISOString()` on the worker's clock, so a timestamp of
// this scenario is an exact ISO string inside the window, to the millisecond.
function isScenarioTime(value: string, startedAt: number): boolean {
  const at = Date.parse(value);
  return (
    !Number.isNaN(at) && new Date(at).toISOString() === value && at >= startedAt && at <= Date.now()
  );
}

/**
 * Returns `message` with each single-quoted path cut to its last segment, as
 * a redacted cause shows it.
 */
export function cutQuotedPaths(message: string): string {
  return message.replaceAll(
    /'([^']+)'/gu,
    (_quoted, quotedPath: string) => `'${path.basename(quotedPath)}'`,
  );
}

/**
 * Replaces every `{home}`, `{project dir}`, and `{agent dir}` in `text` with
 * the sandbox directory it stands for, every `{git host}` with the git host's
 * address, every revision token with its version, and every commit token
 * with its commit.
 */
export function expandTokens(text: string, tokens: RunTokens): string {
  let expanded = text
    .replaceAll(HOME_TOKEN, tokens.home)
    .replaceAll(PROJECT_DIR_TOKEN, tokens.projectDir)
    .replaceAll(AGENT_DIR_TOKEN, tokens.agentDir)
    .replaceAll(GIT_HOST_TOKEN, tokens.gitHost);
  for (const [token, standsFor] of [...tokens.revisions, ...tokens.commits, ...tokens.errors]) {
    expanded = expanded.replaceAll(token, standsFor);
  }

  return expanded;
}

/**
 * Projects the result value `value` of the field `key` back to tokens. A
 * `lastUpdatedAt` inside the scenario's window becomes `{scenario time}`;
 * otherwise every occurrence of a recorded error message, then of that
 * message with its quoted paths cut, becomes its error token, then every
 * occurrence of a sandbox directory becomes its token, every
 * occurrence of the git host's address becomes `{git host}`, every
 * occurrence of a revision's commit becomes its commit token, and every
 * remaining occurrence of a revision's 12 digits becomes its revision token.
 */
export function projectTokens(key: string, value: string, tokens: RunTokens): string {
  if (key === "lastUpdatedAt" && isScenarioTime(value, tokens.scenarioStartedAt)) {
    return SCENARIO_TIME_TOKEN;
  }

  let projected = value;
  for (const [token, standsFor] of tokens.errors) {
    projected = projected.replaceAll(standsFor, token).replaceAll(cutQuotedPaths(standsFor), token);
  }

  projected = projected
    .replaceAll(tokens.home, HOME_TOKEN)
    .replaceAll(tokens.projectDir, PROJECT_DIR_TOKEN)
    .replaceAll(tokens.agentDir, AGENT_DIR_TOKEN)
    .replaceAll(tokens.gitHost, GIT_HOST_TOKEN);
  for (const [token, standsFor] of [...tokens.commits, ...tokens.revisions]) {
    projected = projected.replaceAll(standsFor, token);
  }

  return projected;
}
