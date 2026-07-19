# Phase 70: Spec & Documentation Reconcile - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 70-spec-documentation-reconcile
**Areas discussed:** SEV-02 hint wording, unavailable-arm severity, WR-01 autoupdate warning, Dropped-scope removal

---

## SEV-02 hint wording

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is, freeze | Freeze `Re-run with --force to install the supported components.`; drop placeholder markers; lock into catalog + style guide. | ✓ |
| Refine wording | Tweak before freezing. | |

**User's choice:** Keep as-is, freeze → D-70-01.

---

## unavailable-arm severity

| Option | Description | Selected |
|--------|-------------|----------|
| Stamp error, no --force hint | Finalize unavailable install failure at error, no --force suggestion (completes SEV-02). Verify current state first. | ✓ |
| Leave byte-frozen | Keep as today. Risks half-satisfied SEV-02. | |

**User's choice:** Stamp error, no --force hint → D-70-02.

---

## WR-01 autoupdate companion warning

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it, document | SEV-01 scoped to install/manual update; autoupdate governed by SEV-03; keep scoping + document. | ✓ |
| Add it for consistency | Apply companion warning on autoupdate too (one-line change). | |

**User's choice:** Leave it, document → D-70-03.

---

## Dropped-scope removal

| Option | Description | Selected |
|--------|-------------|----------|
| Fully remove | Strike global force default + manual complete entirely from PRD §11 and other spec text. | ✓ |
| Mark deprecated/removed | Keep historical note. | |

**User's choice:** Fully remove → D-70-04.

## Claude's Discretion

- PRD §11 prose structure; whether the unavailable-arm severity change (if needed) is its own task.

## Deferred Ideas

- None new — milestone lifecycle (audit/complete/cleanup) follows. Pre-existing tmpdir ENOTEMPTY flake is post-milestone cleanup tech-debt.
