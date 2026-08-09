# Phase 97 deferred items

Out-of-scope discoveries logged during execution. Not fixed in this phase.

## 1. `orchestrators/reconcile/README.md:34` still describes the two-axis marker

**Found during:** plan `97-02` Task 3 (the stale-marker prose sweep).

**What it says:** the `pluginsToEnable` bucket description claims
`plan.ts::isRecordedButDisabled` "reads the empty-resources marker (all four
`resources.*` arrays empty AND `compatibility.installable === true`)".

**Why it is wrong now:** ENBL-05 collapsed the predicate onto the explicit
`enabled` boolean and moved it to `persistence/state-io.ts`. Both the module
reference and the marker description are stale, and the array count was already
wrong (five arrays since the hooks axis landed).

**Why it is deferred:** `97-02` enumerated its four prose surfaces
(`shared/notify.ts`, `orchestrators/reconcile/notify.ts`,
`orchestrators/reconcile/types.ts`, `docs/output-catalog.md`) and this README is
not one of them. Plans `97-03` / `97-04` own the reconcile subsystem and are the
natural place for it; otherwise it belongs with the Phase 98 DOC-08 prose
carrier alongside the PRD's PL-6 row, the catalog's brace-bearing-variant count,
the missing `(partially-installed)` status-token table row, and the
`notify-reasons.ts` header count.

**Carrier:** Phase 98 DOC-08, or plan `97-03` / `97-04` if either already edits
`orchestrators/reconcile/README.md`.
