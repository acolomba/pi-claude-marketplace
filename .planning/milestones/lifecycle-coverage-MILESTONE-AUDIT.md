---
milestone: lifecycle-coverage
audited: 2026-10-25T00:00:00Z
status: tech_debt
scores:
  requirements: 104/104
  phases: 30/30
  integration: 8/8
  flows: 8/8
gaps:
  requirements: []
  integration: []
  flows: []
nyquist:
  compliant_phases: []
  partial_phases: []
  not_validated_phases: ["01"]
  missing_phases: ["02-30"]
  overall: missing
open_decisions: []
resolved_decisions:
  - "WR-06 (phase 18): resolved by phase 28, DLS-D1 (user, 2026-10-24). A delisted plugin's dependencies are read from its installed copy, so it no longer makes the scope's dependency walk unreadable."
  - "WR-05 (phase 18): resolved by phase 29, APL-D1 and D-12 (user, 2026-10-24). A load changes no installation state, so the silent load-time retry is gone; a range-blocked move is a `(skipped) {dependents constrain}` row in `apply` and `pending`."
decisions:
  - "INR-03 (user, 2026-10-24): a pinned sha that no branch or tag reaches fails {source missing}. Recorded Pi capability gap: isomorphic-git 1.43.1 fetches only advertised refs over protocol v1, so it cannot do Claude Code's `git fetch origin <sha>`; D-13 keeps the git binary out."
  - "APL-D1 / APL-D2 (user, 2026-10-24): a load is read-only and prints `pending`'s block; `/claude:plugin apply` makes the changes; NFR-2 amended to 'apply, then /reload'."
  - "D-12a / D-12b (user, 2026-10-25): a dependent that stays put is judged by its catalog plus installed-copy declarations; a co-shipped dependent and its newer dependency converge in two applies (accepted)."
  - "AAP-D1 (user, 2026-10-25): any config file, a committed repo file included, may turn `autoapply` on; with it on a load runs `apply`, network included (AGENTS.md NFR-5 clause)."
  - "AAP-D2 (2026-10-25): `/claude:plugin autoapply [on|off] [--scope user|project] [--local]`; bare shows. Modeled on Claude Code `/effort` (show/set) and `/fast` `[on|off]`."
tech_debt:
  - area: cross-phase (integration check)
    items:
      - "update-flow.ts:721-753 reasonsFromTypedError (autoupdate cascade catch) skips git-host classification and falls back to {not in manifest}; the direct path falls back to {unreadable manifest}. No concrete flow found that reaches it with a classifiable cause."
      - "fetch.ts:440/565, edge-deps.ts:172, plugin-browser.ts:384 show entry.version, outside the one version rule (fetch, completion, browse are not named by VER-01/02)"
      - "reconcile/notify.ts:430 buildReconcilePendingNotification defaults recordedVersions to new Map(); a new caller that omits it silently drops will-uninstall versions"
      - "REQUIREMENTS.md reuses PRN-02/PRN-03 for phase 12 and phase 23 with different meanings"
      - "withExistingScopeLock rejects when the scope's extension root is missing; fetch/info --fetch on a scope with only a registered marketplace not traced"
  - area: 18 update/reinstall unification
    items:
      - "CR-02 limit: reinstall of a tag ref still refreshes over the network"
      - "Reinstall outcome lost resourcesChanged; completion cache dropped twice per reinstall"
      - "Forced commit removes a hand-named agent index row inside the agents dir"
      - "Two intent marks in the same millisecond collide; the concurrent-run check can miss them"
      - "The 15 review-fix commits were not re-reviewed"
  - area: 25 update/reinstall rows
    items:
      - "No cucumber scenario for ', '-joined ranges on an update cause line (unit only)"
      - "No backfill test for a failed git host (D-17 offline path)"
      - "Cold git-source reinstall edge test expects a failed row with no reason"
  - area: 26 git mirror access
    items:
      - "WR-03 (pre-existing): clone GC runs after the lock is released and can delete a cache a locked command is using"
      - "WR-05: marketplace-tag-pinned update copies marketplace git data without the lock"
      - "WR-06: fetch/info --fetch read the result row after releasing the lock (display only)"
      - "IN-03: the lock is held across network fetch and GitHub sign-in"
      - "Dead code: createDelegatingRemovalOps (test fake), CheckoutOptions.force"
  - area: 29 load converges on the catalog
    items:
      - "CR-01 (accepted, D-12b): a co-shipped dependent and its newer dependency take two `apply` runs; one-run fix in BACKLOG APPLY1-01"
      - "IN-01..IN-05, IN-07..IN-09 deferred (29-REVIEW-DISPOSITION.md): preview/doc residue, none breaks a criterion"
      - "T-29-24 (medium, open, pre-existing): a hold row's cause can carry the raw catalog version string from marketplace.json"
      - "UAT-02 (manual only): Pi erases rows emitted during /reload; read the pending block by hand in a live Pi"
  - area: 30 autoapply setting
    items:
      - "APPLYTHROW-01 (BACKLOG): an apply pass that throws partway drops the rows it already collected (load-time and `/claude:plugin apply`)"
      - "No base-only filter: `--local` is a switch, so no verb selects the base layer alone"
      - "D-13 (stored credentials only at load, no Device Flow) and the migration before a base-file set are covered by unit tests, not cucumber scenarios"
  - area: docs
    items:
      - "RESOLVED at close: .planning/codebase/* refreshed 2026-10-25 (apply, autoapply, read-only load, deleted modules, marker count)"
---

# Milestone audit: lifecycle-coverage

**Status:** tech debt, no blockers. Every requirement is satisfied, every phase passed verification, and the integration check found no broken wiring. Updated 2026-10-25 for phases 28-30.

## Evidence

- `npm run check` on the combined tree at `1cfe3bb4` (after phases 28, 29 and 30 merged) exited 0: 825/825 cucumber scenarios, unit and integration tests, 286 direct-coverage records, lint, fallow.
- All 30 phases have a `*-VERIFICATION.md` with `status: passed`. Phase 29 passed with one override (the accepted two-apply case, D-12b). Phase 28's truth 5 ("`npm run check` stays green") was left to the orchestrator; the combined runs above close it.
- 3-source cross-check: all 104 traceability rows are `Complete` and checked, each appears in its phase's VERIFICATION.md, and each is listed in a SUMMARY `requirements-completed` field. UNI-03 is listed in no plan; its phase 4 VERIFICATION marks it satisfied by the Phase 1 seed scenarios (CONTEXT D-02).

## Integration check

The checker read the code across the seams phases touched in parallel and confirmed each one end to end:

| Seam | Requirements | Result |
|------|--------------|--------|
| Shared update/reinstall runner keeps per-commit copies, version rule, state lock, `{source missing}` | GIT-01, VER-01, GIT-03, SRC-01, REI-04, UPR-01 | wired |
| Reason narrowing shared by install, import, reconcile | INR-01..03, IMP-08/09, REC-06 | wired |
| One version rule in list, info, install, update, reinstall | VER-01, VER-02, UPR-02/03 | wired |
| `will uninstall` rows carry versions in prune, pending, reconcile | PRN-02 (phase 23) | wired |
| Import plans through reconcile's desired-state planner | IMP-05 | wired |
| State lock in every mutating command and fetch / info --fetch | FLR-*, GIT-03 | wired |
| Read-only load and `apply` share one read pass and one convergence planner; `pending` previews what `apply` makes | APL-01..04, DLS-01 | wired |
| `autoapply` effective value read once per load; on, the load runs the injected `applyReconcile`, stored credentials only; the command shows and sets the four files under the state lock | AAP-01..04 | wired |

## Open decisions

The user answered every open decision. WR-06 and WR-05 are resolved (see `resolved_decisions`), and INR-03, APL-D1/D2, D-12a/b and AAP-D1/D2 are recorded under `decisions`.

## Nyquist

The validate-phase hook is active (`workflow.nyquist_validation: true`), but no phase ran it. Phase 1 has a draft `01-VALIDATION.md` (NOT-VALIDATED); phases 2-30 have none (MISSING). Discovery only: each phase's behavior is pinned by its cucumber scenarios and the green combined `npm run check`. Run `/gsd-validate-phase <N>` to reconcile if wanted.
