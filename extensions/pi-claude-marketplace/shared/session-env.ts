/**
 * shared/session-env.ts -- the pure runtime env-injection primitives that
 * mutate Pi's live `process.env` so every bash child spawned through Pi's bash
 * tool sees Claude-Code-parity environment (SENV-01/02/03, PENV-01).
 *
 * Two disjoint concerns on disjoint key sets (D-90-03):
 *   1. Session vars (`applySessionEnv`) -- refreshed on every `session_start`.
 *   2. Plugin PATH ledger core (`applyPathLedger`) -- pure PATH transform.
 *
 * Pure-leaf posture (mirrors `shared/debug-log.ts`): no module-level state,
 * no fs, and -- per the D-11 import-direction rule -- no imports outside
 * `platform/`. The state-reading I/O shell (`recomputePluginPath`) and the
 * `ExtensionState`-typed `collectBinDirs` live in `orchestrators/plugin-path.ts`
 * where importing `persistence/` is permitted; they build on the pure core here.
 *
 * The env-var ledger (`PI_CLAUDE_MARKETPLACE_PATH`) is the only durable state,
 * and it lives on `process.env` -- not in any module -- precisely so it
 * survives `/reload` (module top-level is re-evaluated fresh on reload while
 * `process.env` persists in-process).
 */
import path from "node:path";

/**
 * HENV-01/02 / SENV-01/02/03: the three Claude-Code-parity session env vars
 * as a plain key/value object -- the single source of truth for the session
 * env contract.
 *
 * `applySessionEnv` applies these to Pi's live `process.env` (bash-tool path);
 * the two hook-spawn lanes (`prepareEnv` in `bridges/hooks/dispatch-exec.ts`
 * and `prepareAsyncEnv` in `bridges/hooks/async-rewake/registry.ts`) spread the
 * returned object into each child's env AFTER the `...process.env` spread so
 * the authoritative per-dispatch snapshot wins over the live process.env
 * (D-91-02). Sharing one producer keeps the two lanes parity-equal by
 * construction rather than only by the drift-guard test (WR-01).
 * CLAUDE_SESSION_ID is the pi-only alias (SENV-03 / D-91-02).
 */
export function claudeSessionEnvFor(sessionId: string): {
  CLAUDECODE: string;
  CLAUDE_CODE_SESSION_ID: string;
  CLAUDE_SESSION_ID: string;
} {
  return {
    CLAUDECODE: "1", // SENV-01
    CLAUDE_CODE_SESSION_ID: sessionId, // SENV-02
    CLAUDE_SESSION_ID: sessionId, // SENV-03 pi-only shim
  };
}

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
  Object.assign(process.env, claudeSessionEnvFor(sessionId));
}

/**
 * PENV-01 / D-90-01: the pi-only bookkeeping env var that records the exact
 * list of PATH entries this extension appended (name mirrors the
 * `PI_CLAUDE_MARKETPLACE_DEBUG` convention). It survives `/reload` together
 * with `process.env` and dies with the process -- which is precisely why it
 * replaces a module-level baseline (module top-level is wiped on `/reload`).
 * It is visible to child processes; a documented pi-only bookkeeping var.
 */
export const PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH";

/**
 * PENV-01 ledger core (pure): given the current PATH, the prior ledger (the
 * entries this extension appended on a previous recompute), and the freshly
 * derived bin dirs, produce the new PATH and the new ledger.
 *
 * Remove exactly the prior-ledger entries from PATH (never touch a non-owned
 * entry), then append each fresh dir not already present (dedupe against the
 * surviving base and against itself). Append never prepends -- a plugin binary
 * cannot shadow a system/Pi binary (T-90-01). Adds a dir even if it does not
 * exist on disk (no fs stat; Claude Code parity). The new ledger holds exactly
 * the dirs actually appended, so a repeated recompute is idempotent and a
 * plugin dropped between loads leaves no stale entry (D-90-01).
 *
 * Empty PATH segments (a leading `:`, trailing `:`, or `::` -- the POSIX
 * implicit-current-directory form) are non-owned content and pass through
 * byte-identical: only ledger-owned entries, which are always absolute and
 * non-empty, are ever removed, so an empty segment can never match and always
 * survives the split/join round-trip (PENV-01 non-interference). A whole-PATH
 * empty string is treated as zero entries -- not one empty segment -- so
 * appending a fresh dir onto an empty PATH never introduces a spurious leading
 * empty segment.
 */
export function applyPathLedger(
  currentPath: string,
  priorLedger: string,
  freshBinDirs: string[],
): { path: string; ledger: string } {
  // The ledger only ever records absolute, non-empty bin dirs (write-side
  // invariant). Re-enforce it on read: drop empties AND relative entries, so a
  // tampered/corrupted ledger cannot make the removal step strip a non-owned
  // relative or empty PATH segment (the ledger's only power is removal).
  const owned = new Set(
    priorLedger.split(path.delimiter).filter((entry) => path.isAbsolute(entry)),
  );
  // Split currentPath WITHOUT dropping empty segments so non-owned empties
  // survive verbatim; a whole-PATH empty string is zero entries, not one empty
  // segment. Remove only entries the extension previously appended; every other
  // entry (including an empty segment or one equal to a fresh bin dir) survives.
  const base = (currentPath === "" ? [] : currentPath.split(path.delimiter)).filter(
    (entry) => !owned.has(entry),
  );

  const seen = new Set(base);
  const appended: string[] = [];
  for (const dir of freshBinDirs) {
    if (!seen.has(dir)) {
      seen.add(dir);
      appended.push(dir);
    }
  }

  return {
    path: [...base, ...appended].join(path.delimiter),
    ledger: appended.join(path.delimiter),
  };
}
