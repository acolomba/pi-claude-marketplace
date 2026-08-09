---
phase: 96-installation-record-backed-plugin-info
plan: 04
subsystem: testing
tags: [list-orchestrator, manifest-lookup, cross-scope-fold, output-catalog, regression-pins]

# Dependency graph
requires:
  - phase: 95-manifest-independent-installed-inventory
    provides: "the `ManifestLookup` discriminated value and `loadMarketplaceManifestSoftly`, which judge absence against the manifest a record itself names"
  - phase: 96-installation-record-backed-plugin-info
    provides: "plans 96-01/02/03 delivered the state-only info arm; this plan closes the folded-row question the milestone inherited"
provides:
  - "four regression pins for D-96-02 own-manifest authority: absence (pre-existing), upgradable negative, upgradable positive, description"
  - "a BOUND-01 pin that a failed owning manifest renders the bare `(failed)` header and suppresses the folded rows the fold already computed"
  - "the settled folded-row rule stated identically in `list.ts`, the list suite and `docs/output-catalog.md`"
affects: [97-disabled-state-classification-repair, 98-lifecycle-regression-and-contract-documentation]

actuals:
  tokens: 3572
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Deliberately DISAGREEING fixtures: two manifest files under one clone root, so a pin fails if the wrong manifest is consulted"
    - "Prose closure paired with an executable pin in the same commit — a settled rule with no test is a comment, not a contract"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/list-manifest-absent.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - docs/output-catalog.md

key-decisions:
  - "D-96-02 ratified as written: a folded row describes its own record's manifest for the absence claim, the upgradable derivation and the description alike"
  - "BOUND-01's wholesale non-render under a failed owning manifest kept as contract and pinned, not reclassified as a defect"
  - "BOUND-02 satisfied by re-running the existing UXG-08 pin unmodified rather than duplicating it"

patterns-established:
  - "Authority pins use disagreeing fixtures in BOTH directions: an agreeing fixture proves nothing about which source was read"
  - "Comment-only production edits are gated by a diff check that every changed line in the file is a comment line"

requirements-completed: [BOUND-01, BOUND-02]

coverage:
  - id: D1
    description: "A folded row is NOT upgradable when its own manifest declares the installed version, even though the user block's manifest declares a newer one"
    requirement: BOUND-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#D-96-02: a folded row is NOT upgradable when its OWN manifest declares the installed version, though the user block's manifest declares a newer one"
        status: pass
    human_judgment: false
  - id: D2
    description: "A folded row IS upgradable when its own manifest declares a newer version, even though the user block's manifest declares the installed one"
    requirement: BOUND-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#D-96-02: a folded row IS upgradable when its OWN manifest declares a newer version, though the user block's manifest declares the installed one"
        status: pass
    human_judgment: false
  - id: D3
    description: "A folded row's description comes from its own record's manifest entry; the neighbouring scope's text appears nowhere in the message"
    requirement: BOUND-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#D-96-02: a folded row's description comes from its OWN manifest entry, not the user block's entry for the same name"
        status: pass
    human_judgment: false
  - id: D4
    description: "A user-scope marketplace whose own manifest fails to load renders the bare `(failed)` header with no child rows, folded rows included"
    requirement: BOUND-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#BOUND-01: a marketplace whose OWN manifest failed to load renders the bare `(failed)` header -- folded rows are suppressed with it"
        status: pass
    human_judgment: false
  - id: D5
    description: "A name absent from both a loaded manifest and every installation record still renders `(failed) {not in manifest}` on info — regression re-run, body unmodified"
    requirement: BOUND-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#UXG-08: missing plugin in known marketplace emits `⊘ <plugin> (failed) {not in manifest}` at 2-space indent + severity error"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#GRAM-04 both-scopes failed block"
        status: pass
    human_judgment: false
  - id: D6
    description: "The folded-row question reads as settled in `list.ts`, the list suite and `docs/output-catalog.md`, with the same rule in all three, and no fenced catalog block moved"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
      - kind: other
        ref: "grep -c 'separate open question' extensions/.../list.ts == 0; grep -c 'still open' docs/output-catalog.md == 0; git diff on list.ts shows comment lines only"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 96 Plan 04: Folded-row manifest authority Summary

**Four regression pins ratify D-96-02 — a cross-scope folded row reads its own record's manifest for absence, upgrade and description — and the same settled rule now replaces the open question in `list.ts`, the list suite and the output catalog.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-09T03:38:00Z
- **Completed:** 2026-08-09T04:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Pinned own-manifest authority for the upgradable derivation in BOTH directions with fixtures whose two manifests disagree: the negative case renders `(installed)` where borrowing the user block's manifest would have said `(upgradable)`, and the positive case renders `(upgradable)` where borrowing it would have said `(installed)`.
- Pinned description authority: the folded row renders `From the project manifest.` and the user block's competing text appears nowhere in the whole-message assertion.
- Pinned the BOUND-01 suppression: a user-scope marketplace whose own manifest is unreadable emits exactly `A marketplace operation has failed.` + the bare `⊘ mp1 [user] (failed)` header, with no `alpha` row of any kind, even though the fold computed one from a project manifest that reads cleanly.
- Closed the same open question in all three places it was written down — the `loadMarketplaceManifestSoftly` doc comment, the fold-test comment, and the `manifest-absent-inventory` catalog entry — with one rule and its BOUND-01 half.
- Changed no production behavior: `list.ts` shows comment lines only in `git diff`, and `npm run check` is green at 3314 passing tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin own-manifest authority for the upgradable derivation and the description** - `8a61749` (test)
2. **Task 2: Pin the failed-owning-manifest suppression and close the open question in all three documents** - `fc81402` (docs)

## Files Created/Modified

- `tests/orchestrators/plugin/list-manifest-absent.test.ts` - four new pins (upgradable negative, upgradable positive, description, BOUND-01 suppression) plus the fold-test comment closure; 16 tests total, all passing, no `assert.match` anywhere
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - the `loadMarketplaceManifestSoftly` doc comment now states the settled rule and cites D-96-02 / INV-01 / BOUND-01; comment lines only
- `docs/output-catalog.md` - the `manifest-absent-inventory` entry's closing prose replaced in Simplified Technical English; no fenced block touched

## Decisions Made

- **Both flagged assumptions in the plan held, and were confirmed empirically rather than assumed.** The positive-direction fixture degrades to the plain `(upgradable)` row (the candidate probe finds no materialized plugin tree, so the CR-01 degrade applies), and `excludeFromAvailable` still suppresses the user block's duplicate row when the two manifests declare *different* versions. Neither produced the "stop and report" condition the plan defined.
- **The BOUND-01 fixture seeds the failure by deleting the user record's manifest after seeding**, rather than by extending `seedMarketplace` with a path override. `seedMarketplace` allocates and writes its own manifest path; removing that file afterward expresses "the owning manifest cannot be read" without introducing a second seeding route, which the plan explicitly discouraged.
- **BOUND-02 was satisfied by re-running the existing UXG-08 pin**, per the plan's flagged assumption. `git diff tests/orchestrators/plugin/info.test.ts` is empty for this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The trufflehog pre-commit hook fails structurally inside a linked worktree (it cannot read `.git/index` because `.git` is a file there); the sanctioned filesystem-mode scan was run over the changed paths before each commit and reported `verified_secrets: 0, unverified_secrets: 0`, and the commits used `SKIP=trufflehog` with no other hook skipped. All other hooks — prettier, mdformat, markdownlint, npm lint, npm format check, npm typecheck — passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 96 is complete: INFO-09/10/11/12 and BOUND-01/02 all landed across plans 01-04, with `npm run check` green.
- The last open question this milestone inherited is closed. No carrier remains for the folded-row manifest choice.
- Phase 98 (DOC-08) still carries the stale-comment reconciliation list: `shared/notify.ts`'s two sentences about the list orchestrator omitting `reasons`, `shared/notify-reasons.ts`'s "37-entry" header for a 38-entry set, and D-96-01's generated-name divergence note. None of those were touched here.
- Phase 97 (disabled-state classification repair) will widen the ENBL-04 canonical disabled shape; the INV-04 pin in this suite is the one deliberately left narrow for it.

## Self-Check: PASSED

- `tests/orchestrators/plugin/list-manifest-absent.test.ts` — FOUND (16 tests pass)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — FOUND (comment-only diff verified)
- `docs/output-catalog.md` — FOUND (catalog-uat gate green)
- Commit `8a61749` — FOUND
- Commit `fc81402` — FOUND

---
*Phase: 96-installation-record-backed-plugin-info*
*Completed: 2026-08-09*
