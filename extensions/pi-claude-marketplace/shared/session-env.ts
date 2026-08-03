/**
 * shared/session-env.ts -- the runtime env-injection seam that mutates Pi's
 * live `process.env` so every bash child spawned through Pi's bash tool sees
 * Claude-Code-parity environment (SENV-01/02/03).
 *
 * Two disjoint concerns on disjoint key sets (D-90-03):
 *   1. Session vars (`applySessionEnv`) -- refreshed on every `session_start`.
 *   2. Plugin PATH (`recomputePluginPath`) -- recomputed at load time.
 *
 * Pure-leaf posture (mirrors `shared/debug-log.ts`): no module-level state.
 * The env-var ledger (`PI_CLAUDE_MARKETPLACE_PATH`) is the only durable state,
 * and it lives on `process.env` -- not in this module -- precisely so it
 * survives `/reload` (module top-level is re-evaluated fresh on reload while
 * `process.env` persists in-process).
 */

/**
 * SENV-01/02/03: refresh the Claude-Code session env on every `session_start`
 * (startup/reload/new/resume/fork). Overwrite unconditionally so the values
 * track the active session (SENV-02 freshness after a session switch).
 *
 * Assigns EXACTLY three keys and never deletes or clears any other key
 * (non-interference): no host-identity or entrypoint var (AI_AGENT,
 * CLAUDE_CODE_ENTRYPOINT, ...) is ever set -- only these three.
 */
export function applySessionEnv(sessionId: string): void {
  process.env.CLAUDECODE = "1"; // SENV-01
  process.env.CLAUDE_CODE_SESSION_ID = sessionId; // SENV-02
  process.env.CLAUDE_SESSION_ID = sessionId; // SENV-03 pi-only shim
}
