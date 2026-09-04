// A Claude-Code-shaped workflow script that introspects its own sandbox.
//
// Shape matches the upstream contract (code.claude.com/docs/en/workflows): a
// leading meta declaration, then a plain-JS statement body with top-level await
// available and a trailing `return`. It never calls agent(), so it runs under
// either engine with no model auth, no token spend, and no subagent spawn.
//
// TWO deliberate omissions, each of which is itself a finding (see READMEs):
//   1. The meta-declaration phrase is never written literally in a comment.
//      @nicknisi/pi-workflows rewrites the FIRST regex match of that phrase in
//      raw source, so a comment mentioning it hijacks the rewrite.
//   2. Clock/RNG calls live in determinism.workflow.js, not here.
//      @quintinshaw/pi-dynamic-workflows runs a raw-text blocklist over the
//      source, so even a comment naming them rejects the whole script.

export const meta = {
  name: "trust-probe",
  description: "Introspect the sandbox a Claude-shaped workflow script receives",
  phases: [{ title: "Probe", detail: "reachability checks only" }],
};

const p = (label, fn) => {
  try {
    return { label, ok: true, value: String(fn()).slice(0, 70) };
  } catch (e) {
    return { label, ok: false, value: (e && e.constructor && e.constructor.name) || "err" };
  }
};

// Which documented Claude globals did the engine actually inject?
const globals = {};
for (const name of ["agent", "parallel", "pipeline", "phase", "log", "args", "budget", "cwd"]) {
  globals[name] = p(name, () => eval(`typeof ${name}`)).value;
}

// Upstream Claude grants NONE of the host capabilities below: "No direct
// filesystem or shell access from the workflow itself", "No module loading".
const privilege = [
  p("typeof process", () => typeof process),
  p("process own keys", () => Object.keys(process).slice(0, 6).join(",") || "(none)"),
  p("process.env type", () => typeof process.env),
  p("process.env size", () => (process.env ? Object.keys(process.env).length + " vars" : "n/a")),
  p("process.pid", () => process.pid),
  p("process.binding", () => typeof process.binding),
  p('binding("fs") keys', () => Object.keys(process.binding("fs")).slice(0, 4).join(",")),
  p('binding("spawn_sync")', () => typeof process.binding("spawn_sync")),
  p("typeof require", () => typeof require),
  // Realm escape: a Function compiled inside the realm sees that realm's
  // globals. If the engine injected HOST built-ins, this reaches the host.
  p("Function -> process.env type", () => Function("return typeof process.env")()),
  p("Function -> env size", () => {
    const e = Function("return process.env")();
    return e ? Object.keys(e).length + " vars" : "no-env";
  }),
  p("Function -> globalThis keys", () =>
    Function('return Object.keys(globalThis).slice(0,6).join(",")')(),
  ),
];

// Shape of the injected non-function globals.
const shapes = [
  p("budget keys", () =>
    budget && typeof budget === "object" ? Object.keys(budget).join(",") : typeof budget,
  ),
  p("phase() returns", () => typeof phase("Probe")),
  p("log() returns", () => typeof log("probe-line")),
];

return { globals, privilege, shapes };
