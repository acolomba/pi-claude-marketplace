# Phase 29 Discussion Log

**Mode:** `--auto`, no prompts. The user's 2026-10-24 decision (relayed by the orchestrating session) fixed scope, option (b), blocked-move rows, and the divergence record.

| Area | Auto-selected (recommended) |
| --- | --- |
| Move predicate | Same-revision test (version/sha/root) OR supported-set growth, one pass (D-03, D-04) |
| Extension-version gate | No longer gates; no write on a no-change load (D-05) |
| Network | None at load; uncached git target stays, no row; gate offline (D-06, D-07) |
| Range evaluation | Against the post-load scope (D-08) |
| Blocked rows | `(skipped) {dependents constrain}` / `(partially-upgradable)` warning, every load (D-09) |
| Move rows | `(updated) from → to`; growth-only keeps backfill rows (D-11) |
| Pending | Shared offline planner; new `(will update)` status (D-12, D-13) |
| Scenarios | New `reconcile-catalog.feature` + `pending.feature` (D-14) |

Upstream evidence: code.claude.com host-marketplace docs, retrieved 2026-10-24 (D-01). Divergence ID CAT-D1.
