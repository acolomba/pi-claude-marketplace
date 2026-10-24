---
milestone: lifecycle-coverage
audited: 2026-10-24T00:00:00Z
status: tech_debt
scores:
  requirements: 95/95
  phases: 27/27
  integration: 6/6
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
nyquist:
  compliant_phases: []
  partial_phases: []
  not_validated_phases: ["01"]
  missing_phases: ["02-27"]
  overall: missing
open_decisions:
  - "WR-06 (phase 18): a plugin the marketplace no longer lists fails every update/reinstall in its scope as {unreadable}; it should not be treated as corruption"
  - "WR-05 (phase 18): a load-time reinstall that a dependent's range blocks retries silently on every load"
decisions:
  - "INR-03 (user, 2026-10-24): a pinned sha that no branch or tag reaches fails {source missing}. Recorded Pi capability gap: isomorphic-git 1.43.1 fetches only advertised refs over protocol v1, so it cannot do Claude Code's `git fetch origin <sha>`; D-13 keeps the git binary out."
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
  - area: docs
    items:
      - ".planning/codebase/* is stale: lists deleted reinstall-replace/reinstall-clone-probe, omits materialize-latest.ts, out-of-date write-file-atomic exemptions, 46 fallow markers where the tree has 41"
---

# Milestone audit: lifecycle-coverage

**Status:** tech debt, no blockers. Every requirement is satisfied, every phase passed verification, and the integration check found no broken wiring.

## Evidence

- `npm run check` on the combined tree (after phases 25 and 26 merged) exited 0: 758/758 cucumber scenarios, unit and integration tests, 280 direct-coverage records, lint, fallow.
- All 27 phases have a `*-VERIFICATION.md` with `status: passed`.
- 3-source cross-check: all 95 traceability rows are `Complete` and checked, each appears in its phase's VERIFICATION.md, and each is listed in a SUMMARY `requirements-completed` field. UNI-03 is listed in no plan; its phase 4 VERIFICATION marks it satisfied by the Phase 1 seed scenarios (CONTEXT D-02).

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

## Open decisions

The three items under `open_decisions` are product questions put to the user. None blocks the milestone: each describes current behavior that fails clean.

## Nyquist

The validate-phase hook is active (`workflow.nyquist_validation: true`), but no phase ran it. Phase 1 has a draft `01-VALIDATION.md` (NOT-VALIDATED); phases 2-27 have none (MISSING). Discovery only: each phase's behavior is pinned by its cucumber scenarios and the green combined `npm run check`. Run `/gsd-validate-phase <N>` to reconcile if wanted.
