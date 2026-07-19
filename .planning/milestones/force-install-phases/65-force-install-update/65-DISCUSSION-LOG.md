# Phase 65: Force Install & Update - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 65-force-install-update
**Areas discussed:** Severity scope, Materialize path, Gate branching, update --force target

---

## Severity scope (FORCE-04 boundary)

First pass:

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: no-Warning guarantee only | Phase 65 ensures no `Warning:` summary on force paths; SEV-01..05 deferred to Phase 69. | |
| Full severity model now | Implement SEV-01..05 in Phase 65. | ✓ (initial) |

Reconcile pass (raised because SEV-03/04/05 depend on Phase 66 force-upgradable/force-installed states that do not exist yet):

| Option | Description | Selected |
|--------|-------------|----------|
| All reachable severity now | SEV-01/02 in 65; SEV-03/04/05 with their subject states (66 derives, 69 stamps). | |
| Pull Phase 66 forward into 65 | Move derived-state work into 65 to implement all of SEV-01..05. | |
| Revert to minimal (no-Warning only) | Only FORCE-04 no-Warning guarantee; all SEV-01..05 deferred to Phase 69. | ✓ |

**User's choice:** Revert to minimal (no-Warning only)
**Notes:** Resolves the dependency tension cleanly — SEV requirements reference force-upgradable / force-installed derived states born in Phase 66. → D-65-01.

---

## Materialize path

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse single supported-path | Existing materialize path installs only supported components; `unsupported` arm naturally skips. Gate selection is the only force-specific difference. | ✓ |
| Distinct force-degrade branch | Separate force materialize branch enumerating/skipping unsupported. Duplicates logic, drift risk. | |

**User's choice:** Reuse single supported-path → D-65-02.

---

## Gate branching

| Option | Description | Selected |
|--------|-------------|----------|
| Branch gate, inert on supported | `force ? requireForceInstallable : requireInstallable`; supported plugin resolves `installable`, force is inert (FORCE-01 no-op), no special-casing. | ✓ |
| Explicit no-op short-circuit | Detect supported-plus-force and short-circuit explicitly. Redundant. | |

**User's choice:** Branch gate, inert on supported → D-65-03.

---

## update --force target

| Option | Description | Selected |
|--------|-------------|----------|
| Resolved candidate (target) version | Force applies to the no-network-resolved candidate's supportability via `requireForceInstallable`. | ✓ |
| Installed version supportability | Evaluate against currently-installed version. Wrong per FORCE-02. | |

**User's choice:** Resolved candidate (target) version → D-65-04.

## Claude's Discretion

- Orchestrator force-flag option field name, helper naming, gate-branch placement in preflight.
- Usage-string / router help-text wording (byte-exact catalog forms reconciled in Phase 70).

## Deferred Ideas

- Derived force states, glyph, will-force preview, info detail — Phase 66.
- List filters, completion, reinstall-as-repair — Phase 67.
- Load-time backfill — Phase 68.
- Full SEV-01..05 severity ladder (incl. --force-citing error message) — Phase 69.
- Byte-exact token/catalog + PRD §11 — Phase 70.
