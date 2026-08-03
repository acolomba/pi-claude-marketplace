---
phase: 90-session-environment-initialization
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - tests/shared/index-smoke.test.ts
  - tests/shared/plugin-path.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-08-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 90 wires Claude-Code session-env parity (`applySessionEnv`, SENV-01/02/03)
and a plugin-PATH ledger (`applyPathLedger` / `recomputePluginPath`, PENV-01,
D-90-01/03/04) into the extension entry point. The pure ledger core is clean:
the append-never-prepend rule (T-90-01), the owned-entry removal via
`PI_CLAUDE_MARKETPLACE_PATH`, and the dedupe/idempotency semantics are correct
and well-covered by `tests/shared/plugin-path.test.ts` (including the
reload-durable uninstall-cleanup and zero-fresh-dir cases). The NFR-2 swallow at
the `recomputePluginPath` call site is present and correct.

Two robustness/security gaps surfaced, both concerning inputs the ledger core
trusts implicitly. Neither blocks ship, but one re-opens a data-flow the rest of
the codebase deliberately closed with a branded type.

## Warnings

### WR-01: `collectBinDirs` threads unvalidated `resolvedSource` into `process.env.PATH` (relative-PATH / untrusted-search-path risk)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:30`
**Issue:**
`collectBinDirs` composes `path.join(rec.resolvedSource, "bin")` directly from
the raw state.json value. On state.json, `resolvedSource` is only
`Type.String()` (see `persistence/state-io.ts:56`) — the schema does not
constrain it to be absolute, non-empty, or traversal-free. `loadState` never
brand-validates it. So an enabled record whose `resolvedSource` is `""` yields
`path.join("", "bin") === "bin"` — a **relative** PATH entry (CWE-426 untrusted
search path), resolved against each child process's cwd. A relative or
`..`-bearing `resolvedSource` flows the same way into `process.env.PATH`, which
every bash child spawned through Pi inherits.

This is exactly the data-flow the codebase already hardened elsewhere: the hooks
hydrate boundary (`bridges/hooks/event-router.ts:648-655`) wraps the identical
field in `asAbsolutePluginRoot(...)` and *drops* the record on failure,
with the explicit rationale "so a corrupted record (empty / relative /
traversal) is dropped here instead of silently flowing to `CLAUDE_PLUGIN_ROOT`
on dispatch." `domain/plugin-root.ts` states this invariant must hold "at the
state-IO load boundary and at every cache-mutator entrypoint." The new PATH
consumer is a new subprocess-env boundary that bypasses that guard. Under normal
installs `resolvedSource` is always an absolute `pluginRoot`, so the realistic
trigger is a corrupted/hand-edited state.json — hence WARNING, not BLOCKER — but
the guard is cheap and the precedent is established.

**Fix:** Mirror the hydrate-path guard — skip records whose `resolvedSource`
fails absolute-path validation instead of appending a relative/garbage entry:

```ts
import { asAbsolutePluginRoot } from "../domain/plugin-root.ts";

export function collectBinDirs(state: ExtensionState): string[] {
  const dirs: string[] = [];
  for (const mp of Object.values(state.marketplaces)) {
    for (const rec of Object.values(mp.plugins)) {
      if (!rec.enabled) continue;
      try {
        const root = asAbsolutePluginRoot(rec.resolvedSource);
        dirs.push(path.join(root, "bin"));
      } catch {
        // Corrupted record (empty/relative/traversal): never let it reach PATH.
      }
    }
  }
  return dirs;
}
```

### WR-02: `session_start` handler is unguarded; the "cannot throw" justification omits the `getSessionId()` call

**File:** `extensions/pi-claude-marketplace/index.ts:119-127`
**Issue:**
The comment justifies the absence of a try/catch with "Three unconditional
string assignments cannot throw." That reasoning covers `applySessionEnv`'s body
but not the argument expression `ctx.sessionManager.getSessionId()`, which is
evaluated first and *can* throw (or `ctx.sessionManager` could be undefined). A
throw there propagates out of the `session_start` event handler — inconsistent
with the meticulously NFR-2-guarded `resources_discover` handler a few lines
above, which wraps even "defensive, already-swallowed" calls. If Pi's contract
guarantees `ctx.sessionManager` is always present and `getSessionId()` is
infallible, the risk is low; but the stated justification is incomplete and the
hardening posture is asymmetric with the rest of the entry point.

**Fix:** Either wrap the handler to preserve the file's NFR-2 boundary
discipline, or correct the comment to state the real invariant being relied on
(that `ctx.sessionManager.getSessionId()` is contract-guaranteed non-throwing):

```ts
pi.on("session_start", (_event, ctx) => {
  try {
    applySessionEnv(ctx.sessionManager.getSessionId());
  } catch (err) {
    hookDebugLog(`session env apply skipped: ${errorMessage(err)}`);
  }
});
```

## Info

### IN-01: `collectBinDirs` keys on `enabled` only, admitting non-installable records

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:25-36`
**Issue:**
`collectBinDirs` filters on `rec.enabled` but not `rec.compatibility.installable`.
A `--partial` install persists `installable: false` while remaining enabled with
a valid absolute `pluginRoot` (see `orchestrators/plugin/install.ts:1125` and the
INV-1/BFILL-01 comment), so its `<root>/bin` will be added to PATH. This matches
the PENV-01 wording ("every enabled plugin record") and is likely intended, so
no change is required — flagging only so the enabled-vs-installable distinction
is a conscious decision rather than an oversight. If the intent is
installable-only, add `&& rec.compatibility.installable` to the guard.
**Fix:** Confirm intent; no code change needed if "enabled" is the correct key.

---

_Reviewed: 2026-08-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
