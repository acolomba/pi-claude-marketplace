# Phase 96: Installation-record-backed plugin info - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 96-installation-record-backed-plugin-info
**Areas discussed:** Component name fidelity (D-95-11), Folded-row manifest choice, Hooks-config degradation rendering, --fetch on state-only records

---

## Component name fidelity (D-95-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Generated names, documented | Render Pi-generated installed names exactly as `resources.*` holds them; document the divergence from the manifest-backed arm | ✓ |
| Reverse-map, strict prefix | Strip deterministic prefixes when they match exactly; fall back to generated name otherwise | |
| You decide | Claude picks during planning | |

**User's choice:** Generated names, documented (recommended option)
**Notes:** Resolves the D-95-11 deferral. Truthful-to-disk; matches INFO-11's
"documented rather than engineered away" posture. MCP raw source keys stay the
sole exception, by data shape.

---

## Folded-row manifest choice

| Option | Description | Selected |
|--------|-------------|----------|
| Record's own — settle it | Ratify Phase 95 fix-loop semantics: folded rows describe their own record's manifest for all three facts; pin with regression, close the catalog note | ✓ |
| Block header's manifest | Re-derive from the block header's manifest (reintroduces the INV-01 false negative) | |
| Leave open for a later milestone | Keep the catalog note as-is | |

**User's choice:** Record's own — settle it (recommended option)
**Notes:** Closes the Phase 95 carrier todo. BOUND-01 retains the bare
`(failed)` header with no child rows — the non-render under a failed owning
manifest is the pinned contract, not a defect.

---

## Hooks-config degradation rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Truthful split | No hooks in record → omit line; record-has-hooks but config unreadable → explicit degradation marker | ✓ |
| Silent omission on any failure | Any read failure drops the hooks line | |
| You decide | Claude picks during planning | |

**User's choice:** Truthful split (recommended option)
**Notes:** Exact token/wording chosen at planning through the closed-set
catalog process.

---

## --fetch on state-only records

| Option | Description | Selected |
|--------|-------------|----------|
| Visible skip note | Fetch lane visibly reports skipped, reusing `(skipped) {not in manifest}` precedent | ✓ |
| Silent — identical to bare info | Flag silently ignored | |
| You decide | Claude picks during planning | |

**User's choice:** Visible skip note (recommended option)
**Notes:** The user's flag is never silently swallowed; zero-call network
assertion against injected seams per INFO-12.

---

## Claude's Discretion

- State-only arm placement within `info.ts` dispatch (disabled carve-out stays first)
- Degradation marker token/wording (closed-set process)
- Test file organization for the new info suites
- Placement of the D-96-01 divergence note within the catalog entry prose

## Deferred Ideas

- Coverage-sweep todo (update/reinstall failure arms) — reviewed, out of scope, stays pending
- notify.ts stale-comment reconciliation — Phase 98 DOC-08 carrier; D-96-01's divergence documentation adds to its list
