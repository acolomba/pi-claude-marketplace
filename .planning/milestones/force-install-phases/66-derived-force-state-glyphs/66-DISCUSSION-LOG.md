# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 66-derived-force-state-glyphs
**Areas discussed:** Derivation seam, force-upgradable logic, Tokens & glyphs, Preview/info/notification

---

## Derivation seam

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared deriver | One helper derives status from recorded-installed + current resolver state; all surfaces read it. No persisted flag, no migration. | ✓ |
| Per-surface derivation | Each surface derives independently. Divergence risk. | |

**User's choice:** Single shared deriver → D-66-01.

---

## force-upgradable logic

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse candidate resolve + compare | Reuse the existing no-network candidate resolution; mark force-upgradable when current `installable` AND candidate `unsupported`; exclude force-installed. | ✓ |
| Separate candidate path | Distinct candidate resolution. Duplication/drift risk. | |

**User's choice:** Reuse candidate resolve + compare → D-66-02.

---

## Tokens & glyphs

| Option | Description | Selected |
|--------|-------------|----------|
| Extend union + exhaustive switch | Add `force-installed` (`ICON_FORCE_INSTALLED="◉"`) and `force-upgradable` (reuses `●`) to the status union + glyph switch; `assertNever` forces all render sites. | ✓ |
| Map outside the union | Side-table mapping at render time. Loses exhaustiveness guarantee. | |

**User's choice:** Extend union + exhaustive switch → D-66-03.

---

## Preview/info/notification

| Option | Description | Selected |
|--------|-------------|----------|
| Thread derived signal into rows | Same derived signal feeds preview (`will force install`/`will force update`), info (force-installed + dropped detail via narrowUnsupportedKinds), and success notification ("force-installed"). | ✓ |
| Per-surface flags | Ad-hoc booleans per surface. Disagreement risk. | |

**User's choice:** Thread derived signal into rows → D-66-04.

## Claude's Discretion

- Deriver helper name/location, recorded-state record shape, candidate-supportability comparison placement.
- Byte-exact preview/info/notification wording reconciled in Phase 70.

## Deferred Ideas

- List filters / completion / reinstall-as-repair — Phase 67.
- Load-time backfill — Phase 68.
- Force-path severity ladder SEV-01..05 — Phase 69.
- Byte-exact token/catalog + PRD §11 — Phase 70.
