// Determinism-guard fixture: contains exactly the three constructs Claude Code
// documents as unavailable inside a workflow script (they would break resume).
export const meta = { name: "determinism-probe", description: "Date/Math reachability" };

const out = [];
try {
  out.push("Date.now=" + Date.now());
} catch (e) {
  out.push("Date.now threw " + e.constructor.name);
}
try {
  out.push("Math.random=" + Math.random());
} catch (e) {
  out.push("Math.random threw " + e.constructor.name);
}
try {
  out.push("new Date=" + new Date().toISOString());
} catch (e) {
  out.push("new Date threw " + e.constructor.name);
}
return out;
