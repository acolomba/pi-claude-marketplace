/**
 * shared/session-env.ts -- the pure runtime env-injection primitives that
 * mutate Pi's live `process.env` so every bash child spawned through Pi's bash
 * tool sees Claude-Code-parity environment (SENV-01/02/03, PENV-01).
 *
 * Four disjoint concerns on disjoint key sets (D-90-03):
 *   1. Session vars (`applySessionEnv`) -- refreshed on every `session_start`.
 *   2. Plugin PATH ledger core (`applyPathLedger`) -- pure PATH transform.
 *   3. pi-mcp-adapter vars (`applyMcpAdapterEnv`) -- the reserved empty
 *      variable and `CLAUDE_PROJECT_DIR`, set at load and on every
 *      `session_start` (AVAR-01, AVAR-03).
 *   4. Plugin option variables (`planOptionLedger`, `applyOptionLedger`) --
 *      one owned variable per plugin option, kept in the
 *      `PI_CLAUDE_MARKETPLACE_OPTIONS` ledger (D-PG10-11, D-PG10-23).
 *
 * Pure-leaf posture (mirrors `shared/debug-log.ts`): no module-level state,
 * no fs, and -- per the D-v1.0-01-11 import-direction rule -- no imports outside
 * `platform/`. The state-reading I/O shells (`recomputePluginPath` in
 * `orchestrators/plugin-path.ts`, and the option variables in
 * `orchestrators/plugin-options.ts`) live where importing `persistence/` is
 * permitted; they build on the pure cores here.
 *
 * The env-var ledgers (`PI_CLAUDE_MARKETPLACE_PATH`, `PI_CLAUDE_MARKETPLACE_OPTIONS`) are the only durable state,
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
 * AVAR-03: the pi-only env var this extension keeps set to the empty string
 * in Pi's process. Written MCP entries split adapter syntax in literal text
 * with `{env:PI_CLAUDE_MARKETPLACE_EMPTY}`, which pi-mcp-adapter expands to
 * nothing, so the text reaches the server unchanged (name mirrors the
 * `PI_CLAUDE_MARKETPLACE_PATH` convention).
 */
export const ADAPTER_EMPTY_ENV = "PI_CLAUDE_MARKETPLACE_EMPTY";

// pi-mcp-adapter's two variable markers. The adapter re-scans a value it
// inserts, so a marker inside an exported value would expand a variable.
const ADAPTER_MARKER = /\$env:|\{env:/;

// A tail that the entry text after a kept `${CLAUDE_PROJECT_DIR}` can complete
// into a marker. New entries escape that text (AVAR-03,
// `bridges/mcp/adapter-escape.ts`), so this guards entries written before the
// escape: legacy `mcp.json` entries that the reload migration has not moved yet,
// until a reinstall, an update or the migration rewrites them.
const PARTIAL_MARKER_TAIL = /[${](?:e(?:nv?)?)?$/;

/**
 * AVAR-01 / AVAR-03: give pi-mcp-adapter the two variables written MCP entries
 * read from Pi's process. Claude Code expands `${CLAUDE_PROJECT_DIR}` in every
 * scope, so a user-scope entry keeps the reference and the adapter reads the
 * current project from Pi's process.
 *
 * The reserved variable is set to the empty string before `readCwd` runs, so
 * it is set even when `readCwd` throws: the split tokens in written entries
 * need it set, and the adapter refuses a `url` that names an unset variable.
 * A throw from `readCwd` propagates after `CLAUDE_PROJECT_DIR` is removed, so
 * no server reads a stale or inherited project.
 *
 * A working directory that holds `$env:` or `{env:`, or ends in `$`, `{` or a
 * longer prefix of either marker, is not exported (AVAR-05). The adapter would
 * expand the marker. The tail check guards entries written before text after a
 * kept reference was escaped: in those, plugin text after the reference can
 * complete such a tail into a reference to a withheld credential. Those are the
 * legacy `mcp.json` entries the reload migration has not moved yet, until a
 * reinstall, an update or the migration rewrites them. The skip also removes any
 * previous `CLAUDE_PROJECT_DIR`, so no server reads a stale or inherited
 * project. Returns `false` for that skip so the caller can log it; this module
 * does not log. Bash and MCP children inherit both values.
 */
export function applyMcpAdapterEnv(readCwd: () => string): boolean {
  process.env[ADAPTER_EMPTY_ENV] = "";
  let cwd: string;
  try {
    cwd = readCwd();
  } catch (error: unknown) {
    Reflect.deleteProperty(process.env, "CLAUDE_PROJECT_DIR");
    throw error;
  }

  if (ADAPTER_MARKER.test(cwd) || PARTIAL_MARKER_TAIL.test(cwd)) {
    Reflect.deleteProperty(process.env, "CLAUDE_PROJECT_DIR");
    return false;
  }

  process.env.CLAUDE_PROJECT_DIR = cwd;
  return true;
}

/**
 * PENV-01 ledger core (pure): given the current PATH, the prior ledger (the
 * entries this extension appended on a previous recompute), and the freshly
 * derived bin dirs, produce the new PATH and the new ledger.
 *
 * Remove exactly the prior-ledger entries from PATH (never touch a non-owned
 * entry), then append each fresh dir not already present (dedupe against the
 * surviving base and against itself). Append never prepends -- a plugin binary
 * cannot shadow a system/Pi binary (T-90-01). The core appends what it is
 * given, with no fs stat; the caller keeps only an existing directory
 * (D-PG10-03). The new ledger holds exactly
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

/**
 * D-PG10-11 / D-PG10-23: the pi-only bookkeeping env var that records each
 * plugin option variable this extension set, as comma-joined
 * `<scope>:<name>` entries (name mirrors `PI_CLAUDE_MARKETPLACE_PATH`). It
 * survives `/reload` together with `process.env` and dies with the process. It
 * is visible to child processes; a documented pi-only bookkeeping var.
 */
export const OPTION_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_OPTIONS";

// A ledger entry: a scope word, then a name of the characters every shell and
// pi-mcp-adapter's `\w+` read.
const OPTION_LEDGER_ENTRY = /^(?:user|project):\w+$/;

/**
 * What one apply does with one scope's option variables: `fresh` replaces the
 * scope's names with the pairs read from its state, `keep` leaves its names and
 * their values as they are, and `remove` deletes them (D-PG10-23).
 */
export type OptionScopeOutcome =
  | { readonly kind: "fresh"; readonly variables: readonly (readonly [string, string])[] }
  | { readonly kind: "keep" }
  | { readonly kind: "remove" };

/** Each scope's outcome for one apply. */
export interface OptionScopeOutcomes {
  readonly user: OptionScopeOutcome;
  readonly project: OptionScopeOutcome;
}

type OptionScope = keyof OptionScopeOutcomes;

/** The change one apply makes to the environment, and the ledger text it leaves. */
export interface OptionLedgerChange {
  readonly remove: readonly string[];
  readonly set: readonly (readonly [string, string])[];
  readonly ledger: string;
}

// The names a well-formed prior ledger records for one scope, in ledger order.
function priorOptionNames(priorLedger: string, ownedPrefix: string, scope: OptionScope): string[] {
  const scopePrefix = `${scope}:`;
  return priorLedger
    .split(",")
    .filter((entry) => OPTION_LEDGER_ENTRY.test(entry) && entry.startsWith(scopePrefix))
    .map((entry) => entry.slice(scopePrefix.length))
    .filter((name) => name.startsWith(ownedPrefix));
}

/**
 * D-PG10-23 ledger core (pure): from the prior ledger text and each scope's
 * outcome, compute the names to delete, the pairs to set, and the new ledger
 * text, in scope order (user, then project) and then in the order given.
 *
 * On read, an entry whose scope is neither `user` nor `project`, or whose name
 * does not start with `ownedPrefix` or holds a character outside letters,
 * digits, and underscore, is ignored, so a tampered ledger cannot delete or
 * keep an unrelated variable (the ledger's only power is removal). A name that
 * is set is never also deleted. The same input gives the same output, so a
 * repeated apply changes nothing.
 */
export function planOptionLedger(
  priorLedger: string,
  ownedPrefix: string,
  outcomes: OptionScopeOutcomes,
): OptionLedgerChange {
  const user = scopeLedgerChange(priorLedger, ownedPrefix, "user", outcomes.user);
  const project = scopeLedgerChange(priorLedger, ownedPrefix, "project", outcomes.project);
  const set = [...user.set, ...project.set];
  const setNames = new Set(set.map(([name]) => name));
  return {
    remove: [...user.remove, ...project.remove].filter((name) => !setNames.has(name)),
    set,
    ledger: [...user.entries, ...project.entries].join(","),
  };
}

// One scope's part of a ledger change, before a name that is set is spared.
function scopeLedgerChange(
  priorLedger: string,
  ownedPrefix: string,
  scope: OptionScope,
  outcome: OptionScopeOutcome,
): { remove: string[]; set: (readonly [string, string])[]; entries: string[] } {
  const priorNames = priorOptionNames(priorLedger, ownedPrefix, scope);
  switch (outcome.kind) {
    case "keep":
      return { remove: [], set: [], entries: priorNames.map((name) => `${scope}:${name}`) };
    case "remove":
      return { remove: priorNames, set: [], entries: [] };
    case "fresh":
      return {
        remove: priorNames,
        set: [...outcome.variables],
        entries: outcome.variables.map(([name]) => `${scope}:${name}`),
      };
  }
}

/**
 * D-PG10-23: apply a computed ledger change to an environment, Pi's
 * `process.env` in production. Deletes first, then sets, then writes the
 * ledger; an empty ledger is deleted rather than set to the empty string.
 */
export function applyOptionLedger(env: NodeJS.ProcessEnv, change: OptionLedgerChange): void {
  for (const name of change.remove) {
    Reflect.deleteProperty(env, name);
  }

  for (const [name, value] of change.set) {
    env[name] = value;
  }

  if (change.ledger === "") {
    Reflect.deleteProperty(env, OPTION_LEDGER_ENV);
  } else {
    env[OPTION_LEDGER_ENV] = change.ledger;
  }
}
