// platform/subagent-child.ts
//
// MGRT-02 / D-MB-12: tells whether this process hosts pi-subagents background
// children. pi-subagents runs each background child as a session inside its
// detached runner process, and every ambient extension, this one included,
// loads into that session. A child must change no installation state, so its
// callers read this before a load-time write. It also reads the id of the
// session that launched a child (D-PG6-02).
//
// pi-subagents is a soft dependency and is never imported: each variable name
// is a string literal here, read from an environment the caller passes in
// (production callers pass `process.env` itself, read when the event runs).

/**
 * The marker pi-subagents 0.84.0 sets to `"1"` before any child session
 * starts: `src/runs/shared/child-runtime-config.js:6` names it
 * (`SUBAGENT_CHILD_ENV`), and `src/runs/background/subagent-runner.js:89`
 * sets it ("This process hosts child sessions").
 */
const SUBAGENT_CHILD_VARIABLE = "PI_SUBAGENT_CHILD";

/** The environment a caller reads the marker from. */
export type SubagentChildEnv = Readonly<Record<string, string | undefined>>;

/**
 * True exactly when `env` carries pi-subagents' child marker as the string
 * `"1"`, the value pi-subagents itself compares against.
 */
export function isSubagentChild(env: SubagentChildEnv): boolean {
  return env[SUBAGENT_CHILD_VARIABLE] === "1";
}

/**
 * The id of the session that launched a background child, which
 * pi-subagents 0.87.0 and 0.88.1 name in
 * `src/runs/shared/child-runtime-config.js:13-14`
 * (`SUBAGENT_PARENT_SESSION_ENV`) and set in the runner's environment in
 * `src/runs/background/async-execution.js:543-555`. Its value is the
 * launching session's id, or that session's file when the session has no id.
 */
const SUBAGENT_PARENT_SESSION_VARIABLE = "PI_SUBAGENT_PARENT_SESSION";

/**
 * D-PG6-02: the launching session's id that pi-subagents put in `env`, or
 * `undefined` when the variable is unset or empty or holds a path
 * separator, because a value with one is pi-subagents' fallback to a session
 * file and not an id.
 */
export function subagentParentSessionId(env: SubagentChildEnv): string | undefined {
  const value = env[SUBAGENT_PARENT_SESSION_VARIABLE];
  return value === undefined || value === "" || /[/\\]/u.test(value) ? undefined : value;
}
