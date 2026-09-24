export const meta = { name: "agent-failure", description: "null-vs-throw on agent failure" };
let outcome;
try {
  const v = await agent("probe");
  outcome = "returned " + JSON.stringify(v);
} catch (e) {
  outcome =
    "THREW " +
    ((e && e.constructor && e.constructor.name) || "err") +
    ": " +
    String(e && e.message).slice(0, 50);
}
return outcome;
