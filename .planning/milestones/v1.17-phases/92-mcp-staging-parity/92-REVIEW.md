---
phase: 92-mcp-staging-parity
reviewed: 2026-08-03T22:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/substitute.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 92: Code Review Report

**Reviewed:** 2026-08-03T22:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** clean (WR-01 fixed in iteration 3, commit 022b782d)

## Summary

Iteration-3 (final) re-review verifying the `safeSet` consolidation
(commit 35ba7cc7, new `bridges/mcp/safe-set.ts`) is correct and complete: that
every assignment site with attacker-influenced (JSON-parsed) server-name keys
routes through the shared helper, that no previously-fixed site regressed, and
that the helper itself is sound.

**The helper is sound and the three migrated sites are correct.** `safeSet`
special-cases the one key with an inherited accessor on `Object.prototype`
(`__proto__`) via `Object.defineProperty` and copies every other key with plain
assignment. `__proto__` is genuinely the only dangerous key here — `constructor`
and `prototype` are plain data properties on a fresh `{}` and assign as own keys
without re-routing. The three migrated call sites are correct: `deepSubstitute`
(substitute.ts:67), `partitionExistingServers` (stage.ts:114), and `stampServers`
(stage.ts:168). Every object-spread merge in stage.ts / substitute.ts
(`{ ...theirs, ...stamped }`, `{ ...entryObj, [MARKER]: marker }`,
`{ ...injected, ...declared }`, `{ ...doc, mcpServers: ... }`) uses
`CreateDataProperty` semantics and so never re-invokes the `__proto__` setter —
safe as-is. The added regression tests exercise the stage and value-walk paths
(foreign `__proto__` server preserved; plugin-declared `__proto__` server stamped;
no `Object.prototype` pollution). The inline guard in substitute.ts was correctly
retired in favor of the shared helper. No regression was introduced.

**But the consolidation is not complete.** Adversarial tracing of every
parsed-server-name assignment site in the MCP bridge surfaced a fourth site that
was NOT migrated: `unstage.ts:85` (`kept[name] = value`) rebuilds the surviving
server map with the identical unguarded `accumulator[attackerKey] = value`
pattern the helper exists to eliminate. This produces silent data loss on the
unstage path — asymmetric with the stage path the new tests now protect — and
directly contradicts the "used by all sites" completeness claim.

## Warnings

### WR-01: `unstageMcpServers` drops a foreign server literally named `__proto__` (missed consolidation site) — FIXED (iteration 3, commit 022b782d)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:85`

**Issue:** `unstageMcpServers` rebuilds the surviving-server map with a plain
computed assignment keyed by an attacker-influenced name:

```ts
const kept: Record<string, unknown> = {};
for (const [name, value] of Object.entries(existing)) {
  if (isOwnedBy(value, pluginName, marketplaceName)) {
    removed.push(name);
  } else {
    kept[name] = value; // <-- unguarded; routes __proto__ through the setter
  }
}
// ...
await atomicWriteJson(locations.mcpJsonPath, { ...doc, mcpServers: kept });
```

`existing` is `doc.mcpServers` parsed from the on-disk scoped `mcp.json`, and
`JSON.parse` materializes a literal `"__proto__"` key as a real own-enumerable
property, so `Object.entries(existing)` yields `["__proto__", value]`. For a
**foreign** server (not owned by the plugin being unstaged) literally named
`__proto__`, the `else` branch runs `kept["__proto__"] = value`, which invokes
the inherited `Object.prototype` `__proto__` setter instead of creating an own
key: it reparents `kept` (or silently no-ops for a non-object value) and never
adds the entry. `atomicWriteJson(..., { ...doc, mcpServers: kept })` then
serializes only own-enumerable keys, so the foreign `__proto__` server is
**silently deleted** from the user's `mcp.json` on any unstage/uninstall of a
different plugin in that scope.

This is the exact WR-01 defect class fixed for the stage path in 5a408484 /
35ba7cc7, and the reason `safeSet` was extracted into a shared helper "so the
sites cannot drift." `unstage.ts` is a fourth site with the same parsed-key
pattern that neither imports nor calls `safeSet`. The result is an observable
asymmetry: the stage path now preserves a foreign `__proto__`-named server
verbatim (asserted by the new "foreign server literally named __proto__ is
preserved verbatim" test at `stage.test.ts:963`), while the unstage path drops
it. Data loss, edge/adversarial-triggered (requires a coexisting server named
`__proto__`), and currently untested on the unstage path. There is no global
`Object.prototype` pollution (the setter mutates only the local accumulator's
prototype), which keeps this a data-integrity WARNING rather than a security
BLOCKER — the same tier as the stage-path findings already judged worth fixing.

**Fix:** Route the surviving-entry copy through the shared helper, matching the
three already-migrated sites:

```ts
import { safeSet } from "./safe-set.ts";
// ...
for (const [name, value] of Object.entries(existing)) {
  if (isOwnedBy(value, pluginName, marketplaceName)) {
    removed.push(name);
  } else {
    // safeSet copies a foreign server literally named `__proto__` as an own
    // data property rather than routing it through the inherited setter (which
    // would silently drop the user's entry) -- WR-01.
    safeSet(kept, name, value);
  }
}
```

Add an unstage regression test mirroring the stage-path WR-01 case: seed the
scoped doc as raw text with a foreign `"__proto__"` server plus one owned entry,
unstage the owned plugin, and assert the foreign `__proto__` entry survives as an
own key in the rewritten doc (and that `({}).command === undefined`, i.e. no
prototype pollution).

## Info

### IN-01: Non-object `env` on a stdio entry is silently coerced to `{}` (carried forward, intentional)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts:118`

**Issue:** `const declared = isPlainObject(substituted.env) ? substituted.env : {};`
drops a malformed (non-object) declared `env` without a diagnostic; injected keys
still land. This is the documented, tested tolerance (`stage.test.ts:709`,
"malformed env treated as absent") consistent with the bridge's shape-only
contract. Carried forward from prior iterations; not escalated.

**Fix:** None required — intentional tolerance. If a diagnostic is ever wanted,
surface it through the existing bridge `warnings` channel rather than dropping
quietly.

### IN-02: `deepSubstitute` doc comment overstates non-plain-object pass-through (carried forward)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts:46-51`

**Issue:** The docstring says "any other non-plain value pass through untouched,"
but the branch at line 61 (`typeof node === "object" && node !== null`) rebuilds
ANY non-array object as a fresh plain object via `Object.entries`, so a non-plain
object (e.g. a `Date`) would be flattened rather than passed through. Harmless in
practice — every input originates from `JSON.parse` (plain objects, arrays,
primitives only) — but the comment could mislead a future maintainer. Carried
forward from prior iterations; not escalated.

**Fix:** Tighten the wording to "plain objects and arrays are rebuilt; primitives
(number, boolean, null, undefined) pass through untouched," or gate the object
branch on the existing `isPlainObject` predicate to match the comment.

---

_Reviewed: 2026-08-03T22:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
