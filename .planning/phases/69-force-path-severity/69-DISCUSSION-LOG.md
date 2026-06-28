# Phase 69: Force-Path Severity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 69-force-path-severity
**Areas discussed:** Newly-degrades detection, Targeted vs bulk distinction, SEV-02 --force pointer message, SEV-05 reasons-brace extension

---

## Newly-degrades detection (SEV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Compare prior persisted compatibility | Read persisted compatibility before update; prior unsupported empty + degrade -> warning; prior non-empty + still degraded -> info. Reuses Phase 66 deriver source. | ✓ |
| Resolve old + new and diff | Re-resolve both versions and diff. More work; re-derives held state. | |

**User's choice:** Compare prior persisted compatibility → D-69-01.

---

## Targeted vs bulk distinction (SEV-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Thread invocation-shape flag | Use the orchestrator's existing targeted (specific ref) vs bulk (no ref) signal; targeted decline -> warning, bulk skip -> info. | ✓ |
| Infer from row count/context | Infer from cascade shape. Fragile; couples severity to presentation. | |

**User's choice:** Thread invocation-shape flag → D-69-02.

---

## SEV-02 --force pointer message

| Option | Description | Selected |
|--------|-------------|----------|
| Condition on resolver arm | unsupported arm -> error + --force hint; unavailable arm -> structural error, no hint. Uses Phase 64 discriminant. | ✓ |
| Always suggest, soften for unavailable | Always mention --force, soften for unavailable. Violates SEV-02 (no suggestion for unavailable). | |

**User's choice:** Condition on resolver arm → D-69-03.

---

## SEV-05 reasons-brace extension

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the shared reason composer | Route installed/force-installed/force-upgradable through the same composer + narrowUnsupportedKinds; brace when reasons present; brace-less rows byte-identical. | ✓ |
| Per-state reason builders | Bespoke per-state logic. Duplication/divergence risk. | |

**User's choice:** Reuse the shared reason composer → D-69-04.

## Claude's Discretion

- Threading points for the targeted/bulk flag and prior-compatibility lookup in update.ts.
- Exact byte wording of the SEV-02 hint + severity row text (reconciled in Phase 70).

## Deferred Ideas

- Byte-exact SEV-02 hint wording + all severity row text, final PRD §11 reconcile, dropped-scope removal — Phase 70.
