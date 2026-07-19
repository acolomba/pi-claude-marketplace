# Phase 81: Fetch verb & info --fetch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 81-fetch-verb-info-fetch
**Areas discussed:** Fetch granularity, Output grammar, Completion, Todo fold

---

## Fetch granularity (the deliberately deferred decision)

| Option | Description | Selected |
|--------|-------------|----------|
| Single-plugin v1 | As the seed proposed; bulk deferred as v2 FTCH-07 | |
| Include bulk now | `fetch @<marketplace>` in this phase | |
| (custom) All three shapes | `fetch <plugin>@<mp>` + `fetch @<mp>` + bare `fetch` (all marketplaces) | ✓ |

**User's choice (freeform):** "fetch @marketplace plus just fetch, to fetch from all marketplaces."
**Notes:** FTCH-07 promoted from v2 to v1; REQUIREMENTS.md and ROADMAP amended.
Per-plugin failures never abort a bulk sweep.

---

## Fetch output grammar

| Option | Description | Selected |
|--------|-------------|----------|
| Post-fetch status row | Derive-not-persist: success renders what list/info now show; no-op renders (skipped) + closed-set reason (update parity) | ✓ |
| Different shape | | |

**User's choice:** Post-fetch status row.

---

## Completion

| Option | Description | Selected |
|--------|-------------|----------|
| (remote) + unpinned warm | The set fetch meaningfully acts on | ✓ |
| (remote) only | | |
| All git-source | | |

**User's choice:** (remote) + unpinned warm.

---

## Todo fold

| Option | Description | Selected |
|--------|-------------|----------|
| Fold — resolves here | SEED-001 completes with the fetch verb; auto-closes at phase completion | ✓ |
| Keep pending | | |

**User's choice:** Fold.

---

## Claude's Discretion

- Fetch orchestrator's position vs the no-orchestrator-network gate (update-style
  exemption vs install-style seam injection).
- Exact `(skipped)` reason member per no-op case (existing REASONS only).
- Bulk iteration/grouping details at bulk-update parity; catalog row prose.

## Deferred Ideas

None — bulk shapes were promoted INTO this phase.
