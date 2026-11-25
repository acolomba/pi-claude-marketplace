---
milestone: integration-rescope
audited: 2026-11-23T11:00:00Z
status: tech_debt
scores:
  requirements: 22/22
  phases: 9/9
  integration: 4/4
  flows: 3/3
gaps:
  requirements: []
  integration: []
  flows: []
stale_verifications:
  - "01: docs/hooks-compatibility.md, docs/mcp-compatibility.md (Phase 8 doc claims)"
  - "02: features/support/world.ts (Phases 3, 6, 7 harness), test/integration/plugin-layer-verbs.test.ts (Phase 8 header)"
  - "03: features/lib/git-plugin.ts, features/step_definitions/marketplace/publishing.steps.ts, features/support/world.ts (Phase 7), test/integration/marketplace-layer-remove.test.ts (Phase 8 header)"
  - "04: test/integration/standalone-prune.test.ts (Phase 8 header and whole-object assertion)"
  - "05: features/step_definitions/session.steps.ts (Phase 6), test/integration/mcp-verdict-migration.test.ts (Phase 8 header)"
  - "06: features/hook/additional-context.feature, features/step_definitions/hook/session.steps.ts, features/support/world.ts (Phase 6.1)"
  - "06.1: docs/hooks-compatibility.md (Phase 8 plan 08-05 doc claim)"

pending_human:
  - id: "CHANGELOG-PARENT"
    phase: "06.1-reload-keeps-sessionstart-context"
    item: "CHANGELOG.md has none of the three Phase 6.1 parent lines (HKRL-01, HKRL-02, HKRL-03) yet. STATE.md holds them, and the milestone PR writes them (06.1 CONTEXT decision). The PR also carries the other phases' parent lines and the version bump offer."
  - id: "FALLOW-WEAKENED-TESTS"
    phase: "08-integration-suite-rescope"
    item: "The PR's fallow-audit job will report `weakened-tests` (assertion-drop 16 to 14) on test/integration/standalone-prune.test.ts. The user decided on 2026-11-21 to accept it at PR review, with no .fallowrc.json or CI change."
tech_debt:
  - phase: all
    items:
      - "Nyquist NOT-VALIDATED: every VALIDATION.md (01 to 08, 06.1) is still `status: draft`; /gsd-validate-phase was never run. This is a coverage TODO, not a compliance failure."
      - "Requirement frontmatter: 05-03 lists ITMIG-11 under `requirements:`, and 06.1-02 has no `requirements-completed` key (HKRL-02). All three are satisfied in VERIFICATION and in the traceability table."
  - phase: 01-duplicate-integration-files
    items:
      - "Review info open: IN-01 (kept), IN-04 (inline identity check), IN-05 (feature description length). IN-02 and IN-03 were closed by Phase 8 (382ec65, b9c0a04)."
  - phase: 02-plugin-layers-names-and-list-fold
    items:
      - "Review info open: IN-01..IN-04 (title wording, pre-migration config pins, orphan-fold comment, the scope snapshot ignores file modes)."
  - phase: 03-marketplace-layers-and-cross-scope-install
    items:
      - "Review info open: IN-01..IN-06 (unreachable git-subdir branch, seeding comment, project clone ownership marker, url-row fetch proof, byte vs mtime checks, a long header line)."
  - phase: 04-prune
    items:
      - "Review info open: IN-01 (lstat/chmod symlink-swap window, accepted as AR-04-02), IN-02, IN-04. IN-03 was closed by Phase 8 (whole-object gitCalls assertion)."
  - phase: 05-mcp-install-legacy-move-and-overrides
    items:
      - "Review info open: IN-01 (three near-identical launch-environment steps), IN-02 (an unhelpful no-stdio hint)."
  - phase: 06-hooks-and-auth
    items:
      - "Review info open: IN-01/IN-04, IN-05, IN-06 (launch-shape names, stopHookScripts first-throw, a reload step under the 30 s default timeout)."
      - "Harness fragility: test/bridges/hooks/dispatch-exec.test.ts:39 fails under a large environment and passes under env -i; follow-up task card queued."
  - phase: 06.1-reload-keeps-sessionstart-context
    items:
      - "The review loop ran 4 fix passes (cap 3) because pass 2's fix caused a regression; no review ran after pass 4, and the final gate covers it."
      - "The follow-up retained across a failed-then-retried run has unit coverage only, with no scenario."
      - "Four steer paths the run-phase tracker cannot see may add one model call; found by source reading and documented in docs/hooks-compatibility.md and D-CF5-13."
      - "BACKLOG HOOKLATESS-01 (parity question for the user: no SessionStart for a plugin that loads after the session starts) and HOOKASYNCRESUME-01."
  - phase: 07-path-source-dependency-tags
    items:
      - "Review info open: IN-02 (the tag step does not check that the tagged commit is main)."
      - "BACKLOG DIRGITTAG-01 (no scenario installs a dependency from a tag of a local git marketplace)."
  - phase: 08-integration-suite-rescope
    items:
      - "Review info open: IN-04 (expansion row titles show the internal label `env-builtin`)."
      - "TESTING.md:66 still says '16 under test/integration/' in its dated count block, kept on purpose; refresh at the next codebase map."
      - "08-05's planned counts (265 cases, 9 charter items) were stale after the phase's own review fixes; the tree holds 236 and 10, accepted and recorded in 08-05-SUMMARY."
  - phase: process
    items:
      - "Commit titles b935623 and 965c0ec name a phase or the milestone; history is not rewritten (AGENTS.md)."
---

# Milestone integration-rescope — Audit

**Status:** tech_debt; close as `override_closeout`. Seven phase reports (01 to 06.1) read `stale` only because later phases edited files they cover (see `stale_verifications`); the full gate on the combined tree after all those edits passed, so no verifier was re-run, as in earlier closes. All 22 requirements are satisfied, all 9 phases passed verification, and the cross-phase wiring is complete. Only deferred and informational items remain.

## Requirements (3-source cross-reference)

| Requirement | Phase | VERIFICATION | SUMMARY frontmatter | Traceability | Final |
|-------------|-------|--------------|---------------------|--------------|-------|
| ITDUP-01, ITDUP-02 | 1 | passed | listed | Complete | satisfied |
| ITMIG-01..04 | 2 | passed | listed | Complete | satisfied |
| ITMIG-05, ITMIG-06 | 3 | passed | listed | Complete | satisfied |
| ITMIG-08 | 4 | passed | listed | Complete | satisfied |
| ITMIG-09, ITMIG-10 | 5 | passed | listed | Complete | satisfied |
| ITMIG-11 | 5 | passed | under `requirements:` (05-03) | Complete | satisfied (checked by hand) |
| ITMIG-12, ITMIG-13 | 6 | passed | listed | Complete | satisfied |
| HKRL-01 | 6.1 | passed | listed | Complete | satisfied |
| HKRL-02 | 6.1 | passed | body only (06.1-02) | Complete | satisfied (checked by hand) |
| HKRL-03 | 6.1 | passed | `requirements-completed` (06.1-03) | Complete | satisfied |
| ITMIG-07 | 7 | passed | listed | Complete | satisfied |
| ITSCOPE-01..04 | 8 | passed | listed | Complete | satisfied |

No orphaned requirements.

## Phases

| Phase | Verification | Security | Review |
|-------|--------------|----------|--------|
| 01 Duplicate Integration Files | passed 6/6 | secured | 0 open critical/warning |
| 02 Plugin Layers, Names, and List Fold | passed 4/4 | secured | 0 open critical/warning |
| 03 Marketplace Layers and Cross-Scope Install | passed 3/3 | secured | 0 open critical/warning |
| 04 Prune | passed 5/5 | secured | 0 open critical/warning |
| 05 MCP Install, Legacy Move, and Overrides | passed 4/4 | secured | 0 open critical/warning |
| 06 Hooks and Auth | passed 9/9 | secured | 0 open critical/warning |
| 06.1 Reload Keeps SessionStart Context | passed 5/5 | secured (22/22) | 0 open; 4 passes |
| 07 Path-Source Dependency Tags | passed 9/9 | secured | 0 open critical/warning |
| 08 Integration Suite Rescope | passed 4/4 | secured (17/17) | 0 open critical/warning |

## Integration

The integration checker (read-only) found 4 of 4 wiring points connected and 3 of 3 flows complete:

1. The shared harness (`features/support/world.ts`, `features/lib/`, `features/step_definitions/`) has no ambiguous or renamed step. The gate passed, and an ambiguous step would fail it.
2. No doc, skill, or code outside `.planning/` cites a deleted integration file.
3. Phase 6.1's hooks change matches the Phase 6 scenarios and the Phase 8 headers. `HOOK-E2E-04` now labels only the throwing-hydrate case.
4. Every requirement's scenario or unit pair is present at HEAD.

The ITSCOPE-04 gate ran on the combined tree `b9c0a04`, which differs from HEAD only in `.planning/`:

| Step | Result |
|------|--------|
| `check:static` | 7 of 7 passed |
| Cucumber, adapter profile | 2285/2285 scenarios passed |
| Cucumber, builtin profile | 260/260 scenarios passed |
| Integration | 236/236 cases passed |
| Direct coverage | `cov_exit=0`, 376 records merged |

## Nyquist

| Phase | VALIDATION.md | Compliant | Action |
|-------|---------------|-----------|--------|
| 01, 02, 03, 04, 05, 06, 06.1, 07, 08 | exists, draft | not validated | `/gsd-validate-phase N` (optional) |

## Tech debt

See the frontmatter `tech_debt`. All items are informational or deferred, and none blocks the milestone.
