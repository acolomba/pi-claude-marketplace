/**
 * @fileoverview The brace tokens that stand for run-specific values in scenarios.
 *
 * A scenario cannot know where the sandbox lives, where the git host listens,
 * or when it runs, so it writes those values as tokens. A typed command has
 * each token expanded to its value, and a result value is projected back to
 * the token by exact substring, so only that exact value reads as the token
 * (D-03).
 * `{scenario time}` stands for any timestamp inside the scenario's window,
 * from the world's construction to the check (D-05).
 */

/** The values the tokens stand for in one scenario. */
export interface RunTokens {
  /** The realpath of the sandbox HOME, which `{home}` stands for. */
  readonly home: string;
  /** The `127.0.0.1:<port>` address of the run's git host, which `{git host}` stands for. */
  readonly gitHost: string;
  /** When the scenario started, in milliseconds since the epoch. */
  readonly scenarioStartedAt: number;
}

const HOME_TOKEN = "{home}";
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
 * Replaces every `{home}` in `text` with the sandbox HOME and every
 * `{git host}` with the git host's address.
 */
export function expandTokens(text: string, tokens: RunTokens): string {
  return text.replaceAll(HOME_TOKEN, tokens.home).replaceAll(GIT_HOST_TOKEN, tokens.gitHost);
}

/**
 * Projects the result value `value` of the field `key` back to tokens. A
 * `lastUpdatedAt` inside the scenario's window becomes `{scenario time}`;
 * otherwise every occurrence of the sandbox HOME becomes `{home}`, and every
 * occurrence of the git host's address becomes `{git host}`.
 */
export function projectTokens(key: string, value: string, tokens: RunTokens): string {
  if (key === "lastUpdatedAt" && isScenarioTime(value, tokens.scenarioStartedAt)) {
    return SCENARIO_TIME_TOKEN;
  }

  return value.replaceAll(tokens.home, HOME_TOKEN).replaceAll(tokens.gitHost, GIT_HOST_TOKEN);
}
