# Phase 55: Load-Time Reconcile Apply, Notification & Wiring - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

On every Pi startup and `/reload`, the extension automatically reconciles installed reality to the merged config -- adding declared-but-missing entries, removing undeclared managed ones -- reporting through the structured notification cascade, soft-failing network per entry, and never blocking Pi load.

Success criteria (from ROADMAP):

1. At extension load (both startup and restart/reload), declared-but-missing marketplaces and plugins are added/installed automatically, and installed-but-undeclared marketplaces and plugins -- scoped to entries the extension manages (provenance/ownership guard) -- are removed/uninstalled automatically (RECON-01, RECON-02).
2. A network failure during reconcile soft-fails for that one entry: it is reported and skipped, the rest of the pass continues, and the failure never propagates past the `resources_discover` boundary or blocks Pi load (RECON-03, NFR-5; the apply step drives the existing per-scope-locked orchestrators serially with no outer lock, continue-on-failure per item).
3. Reconcile results surface through the existing structured `notify` / `emitWithSummary` cascade in catalog-conformant grammar (IL-2), and reconcile never emits a `/reload to pick up changes` hint -- the notify-sink wiring resolves the feasibility question that `resources_discover` carries no `ctx`/`pi` in its current signature (RECON-04; new emission context lands its catalog + byte-UAT forms in the same atomic commit).
4. Reconciliation converges to a fixed point: an immediately repeated reconcile applies zero changes and rewrites neither the config nor the internal state file (byte-unchanged), proven by a back-to-back reconcile test (RECON-05).
5. Concurrent Pi processes cannot double-apply or interleave reconciliation: the existing cross-process scope lock covers the new internal bookkeeping file, orchestrators run serially with no nested locks, and a two-process simultaneous-start test shows no double-apply or interleaved write (RECON-06, NFR-3).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Inherited constraints and cross-phase obligations (the frozen foundation):
- **Phase 52 ordering rail (MIG-01):** migration runs BEFORE any reconcile pass in load order — a populated install must never be seen as "empty desired state" and pruned. This phase lands the migrate-then-reconcile wiring and discharges the Phase 52-deferred obligations: load-wiring call site for `migrateFirstRunConfig` inside the scope lock (Pitfalls 52-2 concurrent same-scope loads and 52-4 D-13 gate race), plus the migrate-then-reconcile exit-gate test on a populated state fixture.
- **CFG-03 abort signal:** an `invalid` config file aborts the reconcile pass for that scope — NEVER treated as empty desired state (no mass uninstall). The preview command (Phase 53) already models this; the apply path must mirror it.
- **Phase 53 planner:** `planReconcile` is the single source of the diff; the apply step consumes `ReconcilePlan` buckets. Preview and apply must agree (preview shows exactly what apply would do).
- **Phase 54:** enable/disable transitions apply via `setPluginEnabled`-equivalent internals; `isRecordedButDisabled` is exported for reuse; disabled entries are NOT re-materialized (desired-materialized = declared AND enabled).
- **Ownership guard (RECON-02):** only extension-managed entries (recorded in state.json) may be removed/uninstalled. Nothing not in state is ever touched.
- **NFR-2/NFR-3:** no fix requires Pi restart (`/reload` suffices); all operations idempotent or fail-clean. NFR-1 atomic writes throughout.
- **Network policy update (NFR-5):** load-time reconciliation is the sanctioned exception — network attempts soft-fail per entry and never block load.
- **Locking:** drive existing per-scope-locked orchestrators serially with NO outer lock (avoid the CR-01-class nested-lock deadlock found in Phase 54); cross-process double-apply prevented by the existing scope lock; two-process simultaneous-start test required.

### Output grammar (locked project conventions — treat as constraints)
- Reconcile results route through the structured `notify()` / `emitWithSummary` cascade (IL-2); subject-first rows; error/warning severities carry a non-empty summary line.
- Reconcile NEVER emits the `/reload to pick up changes` trailer (the reconcile already ran — the hint would be a lie). `shouldEmitReloadHint` discipline applies.
- Any new emission context/tokens are closed-set catalog amendments landing with `docs/output-catalog.md` + catalog-uat byte fixtures in the SAME atomic commit.
- The `resources_discover` signature carries no `ctx`/`pi` — the notify-sink wiring must resolve this feasibility question (e.g., capture the sink at extension setup / session_start and emit at the discover boundary, or defer emission to the first context that has a sink). Investigate what the Pi extension API actually provides; pick the least-magic mechanism that keeps IL-2 intact.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
