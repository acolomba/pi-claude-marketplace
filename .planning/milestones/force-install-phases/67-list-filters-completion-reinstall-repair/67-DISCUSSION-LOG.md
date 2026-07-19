# Phase 67: List Filters, Completion & Reinstall Repair - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 67-list-filters-completion-reinstall-repair
**Areas discussed:** --unsupported filter scope, Completion candidate sets, reinstall --force removal, Byte-contract & help text

---

## --unsupported filter scope

| Option | Description | Selected |
|--------|-------------|----------|
| Not-installed unsupported only | `--unsupported` = unsupported AND not installed; force-installed reached by `--installed`. Clean partition. | ✓ |
| Any unsupported state | Includes force-installed; overlaps `--installed`. | |

**User's choice:** Not-installed unsupported only → D-67-01.

---

## Completion candidate sets

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 66 derived states | `--force` install = available + unsupported; update = upgradable + force-upgradable; unavailable excluded; without --force unchanged. | ✓ |
| Independent completion query | Separate classifier; divergence risk. | |

**User's choice:** Reuse Phase 66 derived states → D-67-02.

---

## reinstall --force removal

| Option | Description | Selected |
|--------|-------------|----------|
| Reject token, unconditional overwrite | Remove --force (errors as unknown flag); overwrite-everything becomes unconditional; delete the force option/branch. | ✓ |
| Silently ignore token | Accept-and-ignore for back-compat. Hides the contract change. | |

**User's choice:** Reject token, unconditional overwrite → D-67-03.

---

## Byte-contract & help text

| Option | Description | Selected |
|--------|-------------|----------|
| Lockstep now | Usage/help/completion/tests AND output-catalog/style-guide updated in 67 (matches 65.1/66). | ✓ |
| Defer prose to Phase 70 | Tests now, docs in 70. Inconsistent with milestone pattern. | |

**User's choice:** Lockstep now → D-67-04.

## Claude's Discretion

- list.ts BOOLEAN_FLAGS edits and the completion provider's --force-position detection.

## Deferred Ideas

- Load-time backfill — Phase 68.
- Force-path severity ladder SEV-01..05 — Phase 69.
- Final PRD §11 reconcile — Phase 70.
