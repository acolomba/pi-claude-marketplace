# Phase 29 Discussion Log

**Mode:** `--auto`, no prompts. Revised 2026-10-24: the user's decision changed from "load converges on the catalog" (CAT-D1, withdrawn) to "read-only load plus an explicit `apply` command" (APL-D1) with the NFR-2 amendment (APL-D2). The orchestrating session relayed both decisions.

| Area | Auto-selected (recommended) |
| --- | --- |
| What still runs at load | Resource discovery, hook routing, plugin path, delisted warning, format migrations (D-04) |
| Load output | `pending`'s block with an `apply` trailer; nothing when matching (D-05, D-06) |
| `apply` scope and lock | `pending`'s scope flags; the existing reconcile machinery under per-scope locks (D-07) |
| `apply` rows | Existing applied/backfill composers + `(updated)`; ends with the `/reload` hint (D-08) |
| Session-start autoupdate | Marketplaces only; plugin moves show as pending (D-09) |
| Move predicate | Same-revision test OR supported-set growth, every `apply` (D-10) |
| Network in `apply` | Allowed on a cache miss; recommended `refreshSource: false` (D-11) |
| Blocked moves | `(skipped) {dependents constrain}` / `(partially-upgradable)` warning, still in `pending` (D-12) |
| Pending | New `(will update)` status; trailer names `apply` (D-14, D-15) |
| Scenarios | New `apply.feature`; reload scenarios move to `apply` with only the trigger and trailer changed (D-19) |

Upstream evidence: code.claude.com `plugins/loading.md`, `plugins/org.md`, `plugins/host-marketplace.md`, retrieved 2026-10-24 (D-01).
