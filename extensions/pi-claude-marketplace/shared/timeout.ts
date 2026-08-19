// shared/timeout.ts
//
// EXEC-02: parse a hook handler's `timeout` field into milliseconds.
//
// Claude Code's hooks.json spec declares `timeout` in SECONDS, so a bare
// number is interpreted as seconds for upstream parity. A `timeout: 2`
// (2 seconds in Claude Code) becomes 2000ms here -- not 2ms, which is the
// units mismatch that SIGTERM'd every timed hook at spawn and silently
// degraded them to no-ops.
//
// Absent, non-finite, zero, negative, or non-number input falls back to
// `defaultMs` (the bridge default, 600_000ms = 10min from dispatch-exec
// and async-rewake/registry). A non-number (string, boolean, object) is
// NOT accepted as seconds -- Claude Code's spec is `timeout: <number>`,
// so a non-number means malformed config and defaults rather than a
// silent reinterpretation.
//
// Pure leaf module: no imports, no module-level state. Consumed by both
// hook-exec lanes (sync dispatch + async-rewake) so they cannot drift on
// the unit interpretation.

const SECOND_MS = 1_000;

/**
 * EXEC-02: parse a hook handler `timeout` value into milliseconds.
 *
 * A finite, positive number is interpreted as SECONDS (Claude Code
 * parity): `2` -> 2000ms. Any other input returns `defaultMs` so a
 * malformed `timeout` never breaks hook dispatch -- matching the
 * bridge's swallow-and-default stance on bad config.
 */
export function parseTimeoutMs(raw: unknown, defaultMs: number): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw * SECOND_MS;
  }

  return defaultMs;
}
