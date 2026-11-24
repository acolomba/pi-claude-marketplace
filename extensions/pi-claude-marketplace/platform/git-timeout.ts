// platform/git-timeout.ts
//
// D-SG-13, SG-TRN-05: the time limit of one git command. Claude Code reads
// CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS as a number above 0, caps it at
// 2147483647, and otherwise uses 120000 ms (03-EVIDENCE Q15). Node runs a
// timer longer than 2147483647 ms at once, so the cap keeps a large value
// from stopping git as soon as it starts.
//
// Only trimmed decimal digits count, so a fractional, signed, or exponent
// value, or one with a unit, gives the default. The variable is read on every
// call, and each git command computes its own deadline from its own read.

/** The limit while the variable is unset or does not hold a usable value. */
const DEFAULT_GIT_TIMEOUT_MS = 120_000;

/** The longest delay Node's timers keep. */
const MAX_TIMER_MS = 2_147_483_647;

const DECIMAL_DIGITS = /^\d+$/;

/**
 * D-SG-13: the milliseconds one git command may run, from
 * CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS in `env`.
 */
export function gitTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS?.trim();
  if (value === undefined || !DECIMAL_DIGITS.test(value)) {
    return DEFAULT_GIT_TIMEOUT_MS;
  }

  const limit = Number(value);
  return limit > 0 ? Math.min(limit, MAX_TIMER_MS) : DEFAULT_GIT_TIMEOUT_MS;
}
