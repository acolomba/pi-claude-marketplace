---
phase: 92-mcp-staging-parity
fixed_at: 2026-08-03T17:57:19Z
review_path: .planning/phases/92-mcp-staging-parity/92-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 92: Code Review Fix Report

**Fixed at:** 2026-08-03T17:57:19Z
**Source review:** .planning/phases/92-mcp-staging-parity/92-REVIEW.md
**Iteration:** 3 (final)

**Summary (cumulative across iterations 1-3):**

- Findings in scope: 2 (two WR-01-class parsed-`__proto__`-key sinks)
- Fixed: 2
- Skipped: 0

Both sinks are the same defect class — an attacker-influenced JSON-parsed
server-name key (`__proto__`) written via plain computed assignment
(`acc[key] = value`), which routes through the inherited `Object.prototype`
`__proto__` setter and silently drops the user's entry. Iteration 2 fixed the
three stage-path sites and extracted the shared `safeSet` helper; iteration 3's
adversarial re-review surfaced a fourth, un-migrated site on the unstage path
and fixed it, completing the consolidation.

## Fixed Issues

### WR-01 (iteration 3): `unstageMcpServers` drops a foreign server literally named `__proto__` (missed consolidation site)

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`,
`tests/bridges/mcp/unstage.test.ts`
**Commit:** 022b782d
**Applied fix:**

Routed the surviving-entry copy in `unstageMcpServers` through the shared
`safeSet` helper, matching the three sites migrated in iteration 2:

```ts
import { safeSet } from "./safe-set.ts";
// ...
} else {
  safeSet(kept, name, value);
}
```

Previously `kept[name] = value` sent a JSON-parsed `"__proto__"` key through the
inherited setter, so a **foreign** server (owned by a different plugin) literally
named `__proto__` was silently deleted from the user's `mcp.json` on any
unstage/uninstall of a different plugin in that scope. `safeSet` copies it as an
own data property via `Object.defineProperty` instead.

Added one unstage regression test (`tests/bridges/mcp/unstage.test.ts`),
mirroring the stage-path WR-01 case: the scoped doc is seeded as raw text with a
foreign `"__proto__"` server plus one owned entry; after unstaging the owned
plugin, the foreign `__proto__` entry survives as an own key byte-for-byte, the
non-mcp top-level field is preserved, only the owned plugin is removed, and
`({}).command === undefined` (no `Object.prototype` pollution).

**Completeness grep (WR-01 closure):** grepping `bridges/mcp` for
computed-assignment sinks over parsed JSON keys
(`grep -rnE '\][ ]*=[^=]'` and `'\[[a-zA-Z_][a-zA-Z0-9_]*\] *='`) leaves exactly
one live `acc[key] = value` site: `safe-set.ts:22` — the guarded `else` branch of
`safeSet` itself (the sanctioned destination, reached only after the `__proto__`
check). The other matches are array type annotations
(`unstage.ts:80 const removed: string[] =`,
`stage.ts:237 readonly StagedMcpRecord[] =`, `stage.ts:311 const leaks: string[] =`),
not key-assignment sinks. Every parsed-server-name assignment site in the MCP
bridge now routes through `safeSet`. Consolidation complete.

### WR-01 (iteration 2): stage-path sites — `partitionExistingServers` / `stampServers` / `deepSubstitute`

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts` (new),
`extensions/pi-claude-marketplace/bridges/mcp/stage.ts`,
`extensions/pi-claude-marketplace/bridges/mcp/substitute.ts`,
`tests/bridges/mcp/stage.test.ts`
**Commit:** 35ba7cc7
**Applied fix (carried forward from iteration 2):**

Extracted the shared `safeSet(out, key, value)` helper into
`bridges/mcp/safe-set.ts` (copies a literal `__proto__` key as an own data
property via `Object.defineProperty` instead of `out[key] = value`). Routed all
three stage-path accumulator sites through it so they cannot drift:
`partitionExistingServers`, `stampServers`, and `deepSubstitute` (migrating
`substitute.ts`'s prior inline guard onto the shared helper). Added two
`stage.ts` regression tests (foreign `__proto__` server preserved verbatim;
plugin-declared `__proto__` server substituted/stamped/written as an own key),
both asserting no `Object.prototype` pollution.

## Verification

Ran in the **main working tree** (worktrees disabled for this run — the
project's `npm` / `pre-commit` gates require the main checkout's `node_modules`,
so the numbers are reproducible from the main checkout):

- `node --test tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/stage.test.ts
  tests/bridges/mcp/substitute.test.ts` — 56 tests, all green (includes the new
  unstage WR-01 case).
- `npm run typecheck` — clean.
- `pre-commit run --files extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  tests/bridges/mcp/unstage.test.ts` — all hooks passed (prettier, eslint,
  format, typecheck, trufflehog).

## Notes on out-of-scope findings

- **IN-01** (non-object `env` coerced to `{}`): Info tier, documented intentional
  tolerance — left unchanged.
- **IN-02** (`deepSubstitute` doc-comment wording nit): Info tier, optional — left
  unchanged to keep the change surgical.

---

_Fixed: 2026-08-03T17:57:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
