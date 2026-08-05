# Phase 90: Session environment initialization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 90-session-environment-initialization
**Areas discussed:** Stale PATH cleanup strategy, PATH recompute trigger + scopes

---

## Stale PATH cleanup strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Env-var ledger | Store the appended-entry list in a dedicated pi-only env var; recompute removes ledger entries, re-derives, rewrites ledger. Correct regardless of /reload module semantics; cost: one extra bookkeeping var visible to children. (Claude's recommendation) | |
| Module-level baseline | Keep the appended-entry set in module state. No extra env var. Risk: if /reload re-imports modules fresh, pre-reload baseline is lost and a stale entry lingers until Pi restart. | ✓ |
| Append-only + document | Never remove; document restart requirement. Fails success criterion 5 as written. | |

**User's choice:** Module-level baseline
**Notes:** Follow-up contingency question — if research falsifies module-state survival across `/reload`: user chose **"Stop and ask me"** (blocker, not silent fallback to the env ledger, not accept-the-gap). Recorded as D-90-02.

**Post-research re-decision (2026-08-03):** Research falsified module-state survival (`clearExtensionCache()` + jiti `moduleCache: false` re-evaluates modules fresh on /reload). Per the contingency the orchestrator stopped and re-asked with three options: Env-var ledger (recommended) / Disk ledger (pid-guarded) / Keep baseline + accept gap. **User selected: Env-var ledger.** D-90-01 revised accordingly in CONTEXT.md.

---

## PATH recompute trigger + scopes

### Where the recompute runs

| Option | Description | Selected |
|--------|-------------|----------|
| resources_discover | Recompute after applyReconcile in the existing handler: authoritative event.cwd, freshly reconciled state, fires every load/reload. Interprets PENV-01 "at session start" as "at load time". (Recommended) | ✓ |
| session_start for everything | One handler for vars + PATH; needs a project-cwd source session_start doesn't carry. | |
| Both events | Redundant defensive recompute in both handlers. | |

**User's choice:** resources_discover (Recommended)

### Scope coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Both scopes | User + project scope, matching Claude Code (appends for ALL enabled plugins regardless of scope). (Recommended) | ✓ |
| User scope only | Simpler but a parity gap with no upside. | |

**User's choice:** Both scopes (Recommended)

---

## Claude's Discretion

- Module placement/naming for the session-env code
- Deterministic append ordering
- State-load failure behavior during recompute (house NFR-2 convention)
- Test structure / drift guards

## Deferred Ideas

- Todo "Coverage sweep: test rare failure arms in update/reinstall/install" reviewed and NOT folded — keyword match only, unrelated to session env (user confirmed).
