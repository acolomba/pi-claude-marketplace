// platform/subagent-child.ts
//
// MGRT-02 / D-MB-12: tells whether this process hosts pi-subagents background
// children. pi-subagents runs each background child as a session inside its
// detached runner process, and every ambient extension, this one included,
// loads into that session. A child must change no installation state, so its
// callers read this before a load-time write.
//
// pi-subagents is a soft dependency and is never imported: the variable name
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
