# Phase 80: Remote status, glyph reassignment & warm-cache resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13 (session interrupted by re-scope; resumed and completed 2026-07-14)
**Phase:** 80-remote-status-glyph-reassignment-warm-cache-resolution
**Areas discussed:** Glyph rendering gate, Unpinned prefix-scan semantics (re-scoped), (remote) presentation details

---

## Glyph rendering gate

| Option | Description | Selected |
|--------|-------------|----------|
| Lock ◍ U+25CD | Renders distinctly from ◉/● in the operator's terminal | ✓ |
| Fallback ◎ U+25CE | Sanctioned fallback if ◍ rendered poorly | |

**User's choice:** Lock ◍ U+25CD.
**Notes:** Samples rendered in-terminal (row-context + side-by-side family
`● ◉ ◍ ◎ ◌ ○ ⊖ ⊘`); the ROADMAP's terminal-rendering gate is CLEARED before
catalog byte forms lock.

---

## Unpinned prefix-scan semantics (became the Phase 79.1 re-scope)

Initial confirmations (seed rule + `(available)` multi-match bucket) were
superseded when the operator drilled into the design: "why do we need pinning?
why can't these source clones be like marketplaces, updated in place?" and
"definitely we don't want to be unable to resolve components of a plugin that
we have information on just because we have two copies."

| Option | Description | Selected |
|--------|-------------|----------|
| Seed rule (prefix-scan, multi-match unresolved) | | |
| Newest-pick heuristic | | |
| Re-scope: mutable mirrors first | One marketplace-style mirror per URL for unpinned; pinned keep per-sha | ✓ |
| Drop sha-addressing entirely | | (rejected — pins are upstream contract) |

**Resolution:** Phase 79.1 inserted, executed, and shipped (2026-07-14).
RSTA-06 rewritten to mirror-dir presence. Upstream pin contract verified at
code.claude.com/docs/en/plugin-marketplaces.

---

## (remote) presentation details

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm derived set | Bare row, no new REASONS, marker unchanged, completion offers (remote), manifest order | ✓ |
| Adjust something | | |

**User's choice:** Confirm.
**Notes:** All items forced by closed-set discipline, (available) parity, the
tri-state severity model, and the 79.1 mirror architecture.

---

## Claude's Discretion

- Tuple insertion positions (append-last discipline), test organization,
  drift-guard extension mechanics — follow the partially-available / disabled
  amendment precedents.
- Catalog row prose style.

## Deferred Ideas

- SEED-001 todo stays pending; resolves at Phase 81 (fetch verb).
