# Phase 68: Load-Time Backfill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 68-load-time-backfill
**Areas discussed:** Version-stamp migration, Backfill materialize scope, Scan gate granularity, Backfill notification

---

## Version-stamp migration

| Option | Description | Selected |
|--------|-------------|----------|
| Optional top-level field, no bump | `lastReconciledExtensionVersion?` optional on STATE_SCHEMA; schemaVersion stays 2; absent = scan-once. | ✓ |
| Bump schemaVersion 2->3 | Treat as shape change with migration. Heavier than needed. | |

**User's choice:** Optional top-level field, no bump → D-68-01.

---

## Backfill materialize scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full unconditional reinstall | Reuse Phase 67 reinstall primitive; re-resolve + overwrite in place; compatibility record updates; promote to installed if unsupported empties. Same version, no network. | ✓ |
| Only newly-supported components | Surgical partial materialize. Diverges from 'reinstall semantics'. | |

**User's choice:** Full unconditional reinstall → D-68-02.

---

## Scan gate granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Version-change, force-installed only | Scan fires only on version change; stamps running version; scans only force-installed; absent stamp = scan-once. | ✓ |
| Scan every load | Re-resolve all force-installed every load. Wasteful when boundary unmoved. | |

**User's choice:** Version-change, force-installed only → D-68-03.

---

## Backfill notification

| Option | Description | Selected |
|--------|-------------|----------|
| Join the reconcile cascade | Promotion surfaces as a row in the single applyReconcile cascade (RECON-04); severity deferred to Phase 69. | ✓ |
| Silent backfill | No row. Hides a real state change. | |

**User's choice:** Join the reconcile cascade → D-68-04.

## Claude's Discretion

- Whether backfill is a sub-step of applyReconcile or a session_start sibling folding into the same cascade.
- Promotion-row token/wording (reconciled in Phase 70).

## Deferred Ideas

- Force-path severity ladder SEV-01..05 (incl. promotion-row severity) — Phase 69.
- Final PRD §11 reconcile + byte-exact promotion-row token — Phase 70.
