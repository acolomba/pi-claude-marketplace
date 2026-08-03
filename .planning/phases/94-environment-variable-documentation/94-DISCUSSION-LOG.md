# Phase 94: Environment-variable documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 94-environment-variable-documentation
**Areas discussed:** Matrix shape & orientation, Divergence/caveat placement, Out-of-scope vars treatment, DOC-07 reconcile strategy

---

## Matrix shape & orientation

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Compact variables×surfaces overview matrix up front, then per-surface detail sections in house style | ✓ |
| Single wide matrix only | One table carries everything, notes crammed into cells | |
| Per-surface sections only | Five small tables, no cross-surface overview | |

**User's choice:** Hybrid (recommended option)

## Cell encoding (same area)

| Option | Description | Selected |
|--------|-------------|----------|
| Glyph + legend | S = substitution, E = env injection, — = n/a, ✗ = absence; footnote markers; one legend line | ✓ |
| Spelled-out words | Full words in cells | |
| Delivery-only checkmarks | ✓/✗ only, mechanism in sections | |

**User's choice:** Glyph + legend (recommended option)

---

## Divergence/caveat placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated section + markers | Full prose in one "Divergences and documented absences" section; tables carry footnote markers | ✓ |
| Inline in per-surface notes | Caveats explained where they bite; multi-surface caveats duplicated | |
| Both in full | Prose inline AND dedicated section (double maintenance) | |

**User's choice:** Dedicated section + markers (recommended option)

## Pi-only variables (same area)

| Option | Description | Selected |
|--------|-------------|----------|
| In-matrix, marked pi-only | Real matrix rows, Claude Code column = — | ✓ |
| Divergences section only | Matrix strictly Claude Code's variable set | |

**User's choice:** In-matrix, marked pi-only (recommended option)

---

## Out-of-scope vars treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated not-delivered section | One-line why per item; out of the matrix | ✓ |
| Matrix rows marked ✗ | Full rows with ✗ across surfaces | |
| Omit entirely | Only delivered variables appear | |

**User's choice:** Dedicated not-delivered section (recommended option)

---

## DOC-07 reconcile strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Correct in place + authority note | Fix stale rows, add Phase-91 rows, one authority line pointing at env-vars.md | ✓ |
| Slim to pointer | Replace table body with a pointer to env-vars.md | |

**User's choice:** Correct in place + authority note (recommended option)

---

## Claude's Discretion

- Exact glyph/footnote characters, section ordering, matrix column ordering
  and column set (one vs two MCP columns).
- Wording/depth of divergence subsections, provided carrier items C-1..C-6
  all land.

## Deferred Ideas

- Todo `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in`
  reviewed and NOT folded — code-test coverage is out of scope for a docs
  phase; stays pending.
