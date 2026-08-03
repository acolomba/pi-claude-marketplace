# Phase 90: Session environment initialization - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 4 (1 new source module, 1 modified integration point, 2 new test files)
**Analogs found:** 4 / 4

> **Decision reconciliation (read first):** CONTEXT.md's D-90-01 was **revised on
> 2026-08-03 after research** to the **env-var ledger** mechanism (D-90-02
> RESOLVED — module-level baseline falsified, user selected the
> `process.env` ledger). RESEARCH.md still narrates the pre-resolution
> module-baseline blocker; that is stale. **Plan the env-var ledger.** All other
> research findings (host mechanism, event ordering, state shape, integration
> point) remain authoritative.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/session-env.ts` (NEW) | utility (edge/env seam) | transform (state → `process.env` mutation) | `shared/debug-log.ts` + `bridges/hooks/dispatch-exec.ts:298-317` | role-match (leaf env seam) + exact (env-build) |
| `index.ts` (MODIFIED) | edge/registration | event-driven | `index.ts` self (`resources_discover` + `session_start`) + `edge/register.ts:116` | exact |
| `tests/shared/session-env.test.ts` (NEW) | test | — | `tests/shared/debug-log.test.ts`, `tests/shared/vars.test.ts` | exact |
| `tests/shared/plugin-path.test.ts` (NEW) | test | — | same | exact |

*Module placement is Claude's discretion (D-90 discretion note); `shared/` is
the house home for pure leaf seams (`debug-log.ts`, `vars.ts`) that both
handlers import. `edge/` is an acceptable alternative if the module registers
its own `pi.on`. Recommended: keep the pure logic in `shared/session-env.ts`
and do the `pi.on`/handler wiring in `index.ts` (mirrors how `index.ts` wires
`applyReconcile` from `orchestrators/`).*

## Pattern Assignments

### `shared/session-env.ts` (utility, transform) — session-var setter

**Analog:** `bridges/hooks/dispatch-exec.ts:312-317` (the established `process.env`
spread + Claude-Code env-key derivation) and RESEARCH Pattern 1.

**Core pattern — session vars (SENV-01/02/03):**
```typescript
// SENV-01/02/03: refresh Claude-Code session env on every session_start
// (startup/reload/new/resume/fork). Overwrite unconditionally so the value
// tracks the active session (SENV-02 freshness).
export function applySessionEnv(sessionId: string): void {
  process.env.CLAUDECODE = "1";                 // SENV-01
  process.env.CLAUDE_CODE_SESSION_ID = sessionId; // SENV-02
  process.env.CLAUDE_SESSION_ID = sessionId;      // SENV-03 pi-only shim
}
```
Session-id source is `ctx.sessionManager.getSessionId()` — extract at the
handler, pass the string in (keeps this fn pure/testable). Precedent for the
getter: `bridges/hooks/translation-context.ts:56`.

**Non-interference (Pitfall 2 / success criterion 4):** assign only these three
named keys; never delete or clear other keys. A test snapshots `process.env`
before/after and asserts the exact delta.

---

### `shared/session-env.ts` (utility, transform) — PATH recompute + env-var ledger

**Analog:** RESEARCH Pattern 2 (bin-dir collection) + `shared/debug-log.ts`
(the `PI_CLAUDE_MARKETPLACE_*` env-var naming + pure-leaf convention).

**Ledger var (D-90-01 revised):** a dedicated `process.env` bookkeeping key holds
the exact list of PATH entries this extension appended. Recommended name mirrors
the existing `PI_CLAUDE_MARKETPLACE_DEBUG` convention (`shared/debug-log.ts:22`):
`PI_CLAUDE_MARKETPLACE_PATH`. It survives `/reload` with `process.env` and dies
with the process — this is precisely why it replaces the module-level baseline
(module state is wiped on `/reload`; see RESEARCH Critical Finding).

**Recompute algorithm (PENV-01):**
1. Read the ledger var → split on `path.delimiter` → `owned: string[]`.
2. Remove exactly `owned` entries from `process.env.PATH` (split → filter-out → join).
3. Re-derive the fresh set: `loadState` for **both** scopes (D-90-04), collect
   `path.join(rec.resolvedSource, "bin")` for every `enabled === true` record,
   in a deterministic order (Claude's discretion — pick e.g. user-before-project,
   stable within scope; make it testable).
4. Dedupe against entries already on PATH (idempotency) — entries the extension
   did not append are skipped and never enter the ledger.
5. Append the fresh set (never prepend); add the entry **even if `bin/` is absent**
   (Claude Code 2.1.212 parity).
6. Rewrite the ledger var with the freshly appended set.

**Bin-dir collection (from RESEARCH, `[VERIFIED: state-io.ts:151,169]`):**
```typescript
const collectBinDirs = (state: ExtensionState): string[] => {
  const dirs: string[] = [];
  for (const mp of Object.values(state.marketplaces)) {
    for (const rec of Object.values(mp.plugins)) {
      if (rec.enabled) dirs.push(path.join(rec.resolvedSource, "bin"));
    }
  }
  return dirs;
};
```
- `rec.resolvedSource` == pluginRoot — `[VERIFIED: dispatch-exec.ts:307]`.
- `rec.enabled` is required boolean — `[VERIFIED: state-io.ts:77]`.

**Per-scope state read (Don't-Hand-Roll):**
```typescript
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
// user scope ignores cwd; project scope = <cwd>/.pi  (locations.ts:144-147)
const userState = await loadState(locationsFor("user", homedir()).extensionRoot);
const projState = await loadState(locationsFor("project", cwd).extensionRoot);
```
`loadState` returns `DEFAULT_STATE` on ENOENT (never throws) but **can throw on
malformed JSON / schema-invalid state** (`state-io.ts:257-273`) — so the caller
MUST wrap (Pitfall 3).

**PATH key/delimiter portability (Pitfall 4):** use `path.delimiter`; mutate
`process.env.PATH` directly (Unix-first repo posture — Assumption A1). Document
the choice in a comment.

---

### `index.ts` (edge/registration, event-driven) — wiring

**Analog:** `index.ts` itself (the file being modified) + `edge/register.ts:116`.

**Session-var handler — factory-time `pi.on("session_start")`** (copy the shape
from `edge/register.ts:116-132`):
```typescript
// SENV-01/02/03: reset Claude-Code session env on every session_start
// (startup/reload/new/resume/fork). Idempotent: overwrite is unconditional.
pi.on("session_start", (_event, ctx) => {
  applySessionEnv(ctx.sessionManager.getSessionId());
});
```
Register alongside the existing `registerClaudePluginCommand(pi, ...)` /
`registerClaudeMarketplaceTools(pi)` calls at the bottom of the factory
(`index.ts:105-109`). No `ExtensionContext` cast gymnastics needed — the
handler receives a real `ctx`. `SessionStartEvent` is already exported via
`platform/pi-api.ts:53`.

**PATH recompute — inside the existing `resources_discover` handler, after
`applyReconcile`** (D-90-03). Insert between `index.ts:77` and `:95`, inside the
same NFR-2 discipline. Follow the existing try/catch swallow pattern
(`index.ts:76-93`):
```typescript
try {
  await applyReconcile({ ctx, pi, cwd: event.cwd });
} catch (err) { /* existing last-ditch notify */ }

// PENV-01 PATH recompute (D-90-03/04): both scopes, wrapped so a state-read
// failure never blocks Pi load (NFR-2). Swallow + debug-log per house convention.
try {
  await recomputePluginPath(event.cwd);
} catch {
  // NFR-2: a malformed-state throw must never propagate past resources_discover.
}
```
`event.cwd` is the authoritative project cwd (same source the rest of the
handler uses at `:97`).

---

### `tests/shared/session-env.test.ts` + `tests/shared/plugin-path.test.ts`

**Analog:** `tests/shared/debug-log.test.ts`, `tests/shared/vars.test.ts` (pure
leaf-module unit tests, `node:test`).

**Framework:** `node:test` (built-in), glob-driven `test` script. Scoped run:
`node --test tests/shared/session-env.test.ts`.

**session-env.test.ts:** mock `getSessionId`; assert `CLAUDECODE="1"`,
`CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` equal the mocked id; re-invoke with a
new id and assert refresh (SENV-02); snapshot `process.env` to prove
non-interference (only three keys added). Save/restore `process.env` in
`beforeEach`/`afterEach`.

**plugin-path.test.ts:** mock `loadState` per scope (or seed state fixtures);
assert append (not prepend), dedupe, idempotency across repeated calls,
enabled-only filter, both-scope contribution, entry-added-when-bin-absent, and
the **ledger-based stale removal across a simulated reload** (install → recompute
→ uninstall → clear module state but keep `process.env` → recompute → assert the
uninstalled bin dir was removed). This reload test is the one the env-var ledger
makes possible (module-baseline would leak it — RESEARCH Pitfall 1).

## Shared Patterns

### Load-time failure containment (NFR-2)
**Source:** `index.ts:76-93` (`applyReconcile` try/catch) + `shared/debug-log.ts`
**Apply to:** the PATH recompute call in `resources_discover`.
Swallow + debug-log; never propagate. `loadState` swallows ENOENT but throws on
malformed JSON — the wrap is mandatory.
```typescript
export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[hooks] ${detail}`);
  }
}
```
Discretion: reuse `hookDebugLog` or add a session-env-scoped equivalent; either
way the `console.*` needs the per-file ESLint override block (IL-2/IL-3), as
`debug-log.ts` documents — do NOT use inline `eslint-disable`.

### `process.env` env-build convention
**Source:** `bridges/hooks/dispatch-exec.ts:312-317`
**Apply to:** the session-var setter (assign named Claude-Code keys onto env).
Established precedent that this extension sets `CLAUDE_*` keys derived from
install-state `resolvedSource`.

### Comment policy
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** all new files. Anchor comments with requirement/decision IDs
(`SENV-01`, `PENV-01`, `D-90-01`, `NFR-2`); never with phase/plan/wave refs or
bare `Pitfall N`.

### Idempotent factory-time registration
**Source:** `edge/register.ts:116` (the `session_start` autocomplete wrapper)
**Apply to:** the new `session_start` handler — register once at factory time;
unconditional overwrite makes re-fire harmless.

## No Analog Found

None. Every file has a close in-repo analog.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/` (`index.ts`,
`edge/`, `shared/`, `persistence/`, `bridges/hooks/`, `platform/`), `tests/shared/`.
**Files scanned:** 9 source + test-dir listing.
**Pattern extraction date:** 2026-08-03
