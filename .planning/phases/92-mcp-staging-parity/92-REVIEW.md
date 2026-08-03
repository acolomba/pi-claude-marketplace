---
phase: 92-mcp-staging-parity
reviewed: 2026-08-03T17:10:59Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/bridges/integration-materialization-gate.test.ts
  - tests/bridges/integration.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/substitute.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 92: Code Review Report

**Reviewed:** 2026-08-03T17:10:59Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The phase adds a bridge-local deep-substitution + stdio-env-injection engine
(`bridges/mcp/substitute.ts`), threads `pluginRoot` / `pluginData` through
`StageMcpInput` and the three orchestrator call sites, wires it into
`stampServers`, and adds the MENV-02/03/04 test suites plus two additive
integration-test call-site updates.

The changed surface is small and the implementation is disciplined. I traced
every adversarial angle called out for this phase and verified the decided
behaviors hold:

- **Single-pass / no re-expansion:** `substituteLeaf` uses one global-regex
  `.replace` with a function replacer. Verified empirically that a substituted
  value containing another var token is emitted verbatim (no re-expansion), that
  `$1`/`$&`/`\` in values are inserted literally (no `$n` pattern expansion), and
  that the module-level global regex leaves `lastIndex === 0` after each call, so
  reuse across entries is not stateful.
- **Marker preservation / theirs isolation:** substitution runs BEFORE the
  marker is spread on, and foreign (`theirs`) entries are kept verbatim (never
  walked). Both are covered by tests and hold.
- **Declared-wins precedence:** `{ ...injected, ...declared }` gives plugin-
  declared env keys the winning value while preserving injected key positions —
  matches Claude Code spread order and the test assertions.
- **Scope arms:** `CLAUDE_PROJECT_DIR` is resolved/injected only for project
  scope and passes through untouched for user scope; the injected value is `cwd`
  (project root), not `scopeRoot`. Correct.
- **Written-path containment:** substitution values only ever enter the CONTENT
  of `mcp.json`; the write target is the fixed `locations.mcpJsonPath`, so no
  substitution value can influence the output path (no traversal surface).
- **Orchestrator threading:** install / reinstall / update all pass
  `pluginData` = the per-plugin `pluginDataDir` and `pluginRoot` =
  `installable.pluginRoot`. Consistent and correct across all three.

One robustness/fidelity WARNING in the deep walk (a `__proto__` key in a server
entry is silently dropped). I verified empirically this is NOT exploitable as
prototype pollution — `Object.prototype` is never mutated — so it is not a
security blocker; it is a contract-fidelity gap.

## Warnings

### WR-01: `deepSubstitute` silently drops a `__proto__` server-entry key and reparents the fresh accumulator

**File:** `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts:59-66`

**Issue:** The object arm rebuilds a fresh plain-object accumulator (`const out:
Record<string, unknown> = {}`) and assigns children via `out[key] = ...`. When a
server entry (which is free-shape per `McpServerEntry`, `[extra: string]:
unknown`) carries a literal `__proto__` key — which `JSON.parse` materializes as
a real own-enumerable property that `Object.entries` iterates — the assignment
`out["__proto__"] = value` triggers the inherited `__proto__` accessor rather
than creating an own data property:

- If the value is an object, `out`'s `[[Prototype]]` is reparented to it and the
  key is dropped from the serialized output.
- If the value is a primitive, the setter is a no-op and the key is dropped.

Either way the documented invariant ("plain objects are rebuilt fresh with keys
copied verbatim") is violated for that key — the data is silently lost from the
written `mcp.json`.

Verified empirically: this does NOT pollute `Object.prototype` globally (a
`{"constructor":{"prototype":{...}}}` payload also round-trips inertly), so it is
not a prototype-pollution vulnerability. Practical impact is low because real MCP
entries do not use `__proto__` as a field name, but the walk should preserve
whatever keys the source declares rather than dropping one class of them.

**Fix:** Build the accumulator with a null prototype so the assignment creates an
own data property instead of hitting the inherited accessor (spreads downstream
in `stampServers` copy own-enumerable keys regardless of prototype, so behavior
is otherwise unchanged):

```ts
if (typeof node === "object" && node !== null) {
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, childValue] of Object.entries(node)) {
    out[key] = deepSubstitute(childValue, map);
  }
  return out;
}
```

Alternatively guard the `__proto__` key explicitly with
`Object.defineProperty(out, key, { value, enumerable: true, writable: true,
configurable: true })`.

## Info

### IN-01: stdio entry with a non-object `env` silently discards the declared value

**File:** `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts:113-115`

**Issue:** For a stdio entry, `const declared = isPlainObject(substituted.env) ?
substituted.env : {}` means a malformed non-object `env` (e.g. `env:
"not-an-object"`) is dropped and replaced by injected defaults only. This is
covered and asserted by the `stage.test.ts` "empty/absent/bad env" test, so the
behavior is intentional tolerance consistent with the bridge's "shape-only,
adapter owns semantics" contract. Noting it for visibility because the drop is
silent — a plugin shipping a malformed env gets no diagnostic — but no change is
required if that tolerance is the decided contract.

**Fix:** No action required; documented tolerance. If a diagnostic is ever
desired, surface it through the existing bridge `warnings` channel rather than
dropping quietly.

---

_Reviewed: 2026-08-03T17:10:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
