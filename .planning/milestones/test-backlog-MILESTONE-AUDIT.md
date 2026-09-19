---
milestone: test-backlog
audited: 2026-09-18
status: tech_debt
scores:
  requirements: 18/18
  phases: 8/8
  integration: 9/9
  flows: 2/2
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-phase
    items:
      - "The branch has never been pushed (300 commits ahead of origin/main, 0 behind); no CI run exists. Every gate was measured locally at HEAD 1e25b80b (08-MEASUREMENT.md). The first CI run is on the PR."
      - "07-VERIFICATION.md frontmatter reads `score: 8/8` while its body counts 10/10 (two roadmap criteria plus eight plan-level truths). Explained in 08-MEASUREMENT.md section 1; the frontmatter is the canonical value. Not rewritten: the record is historical."
      - "Nyquist discovery: 07 is `validated`; 01, 02 and 03 carry `nyquist_compliant: true` under the legacy `status: passed` / `complete` values; 04 has no `nyquist_compliant` field; 05, 06 and 08 are `status: draft` (never reconciled by validate-phase). Coverage TODO, not a compliance failure (#2117)."
      - "pre-commit runs a faster subset of the check chain (no corresponding-test controls, no coverage negatives, no integration); CI runs the full sixteen-member chain. Deliberate split, recorded so nobody reads the local hooks as the whole gate."
  - phase: 05-production-export-ownership
    items:
      - "deferred-items.md: five open comment-drift items (comments naming `CONFIG_VALIDATOR.Check`/`STATE_VALIDATOR.Check`, the four closed-set tuple names, `ICON_PARTIALLY_AVAILABLE` from outside its module, two planning records with the older type-only owner count) and the archived force-reinstall spike importing the now-private `STATE_VALIDATOR`. None is read by a gate."
      - "05-REVIEW.md info findings IN-01..IN-04 recorded as non-actions; IN-04 (read-only `info`/`fetch` load the whole operation graph) is a design note the operator may keep."
  - phase: 06-unused-type-member-gate
    items:
      - "deferred-items.md item 1 (`remove.test.ts` read the operator's real user scope) is resolved by the #196 hermetic-environment merge from main: the file now imports `createHermeticEnvironment`. Recorded here; the deferred-items file still says open."
      - "deferred-items.md item 2: six 06-LIVE-TRIAGE.md witness coordinates drifted by a few lines from the fresh report. Ledger prose only."
  - phase: 07-reliable-coverage-metrics
    items:
      - "07-REVIEW.md info findings IN-01..IN-09 (non-directory `--root`, stack traces on malformed input, absolute-path producer identity, stale public map after a bare `coverage:capture`, Node floor above `engines`, `--root` docs, pid-keyed worker registration, substring `kind` matching in refusal tests, validator crash read as stale). The five warnings were fixed (07-REVIEW-FIX.md, all_fixed)."
  - phase: 08-final-verification-and-reconciliation
    items:
      - "TruffleHog cannot open a worktree's `.git` file, so `pre-commit run --all-files` exits 1 in this checkout on that hook alone. Environment; CLAUDE.md prescribes `SKIP=trufflehog` for worktree commits. Green on a normal checkout and in CI."
      - "STATE.md `Known Risk Worth Revisiting` (IN-03 from refine-unit-tests: NFR-10 containment rests on a prose-only injected contract) is carried forward unchanged."
nyquist:
  compliant_phases: ["07"]
  legacy_status_compliant_phases: ["01", "02", "03"]
  partial_phases: []
  not_validated_phases: ["04", "05", "06", "08"]
  missing_phases: []
  overall: not_validated
---

# Milestone Audit — test-backlog

**Status: `tech_debt`.** No blockers. Every requirement is satisfied, every phase verified, the
gate chain measured green at the final HEAD, and the eleven authorized items reconciled. What
remains is recorded, non-blocking debt: comment drift, info-level review findings, unreconciled
validation files, and a branch that has never met CI.

## Requirements — 18/18 satisfied

Cross-referenced across three independent sources: the `REQUIREMENTS.md` checkbox block
(18 `[x]`, traceability rows all `Complete`), every phase `VERIFICATION.md` (all eight
`status: passed`), and the `requirements-completed` frontmatter of the SUMMARY files (every
requirement claimed by at least one summary in its assigned phase). No partials. No orphans.
The FAIL gate did not trip.

| Requirement | Phase | VERIFICATION | SUMMARY claim | REQUIREMENTS.md |
| --- | --- | --- | --- | --- |
| NEG-01, NEG-02 | 1 | passed 5/5 | 01-01 | `[x]` Complete |
| HIST-01 | 1 | passed 5/5 | 01-02 | `[x]` Complete |
| SONAR-01, SONAR-02 | 2 | passed 4/4 | 02-01 | `[x]` Complete |
| AGENT-01, AGENT-02 | 3 | passed 18/18 | 03-04 | `[x]` Complete |
| ARGS-01, ARGS-02, ARGS-03 | 4 | passed 7/7 | 04-03 | `[x]` Complete |
| EXPORT-01, EXPORT-02 | 5 | passed 10/10 | 05-07..05-28 | `[x]` Complete |
| MEMBER-01, MEMBER-02 | 6 | passed 2/2 | 06-08..06-17 | `[x]` Complete |
| METRIC-01, METRIC-02 | 7 | passed 8/8 (body 10/10) | 07-01..07-08 | `[x]` Complete |
| FINAL-01, FINAL-02 | 8 | passed 7/7 | 08-01, 08-02 | `[x]` Complete |

## Phases — 8/8 passed

61/61 must-haves verified, zero overrides, zero `behavior_unverified`. Phase 8 measured every
gate fresh at HEAD `1e25b80b` as separate processes: the sixteen `check` members all exit 0
(1290 s), `test:e2e` 14/14, `test:coverage:direct:all` 239 pairs with the two pinned shortfalls
matched exactly, aggregate unit production coverage 63825/63825 lines, 1890/1890 functions,
9234/9234 branches with zero zero-count LCOV entries, CRAP maximum 20.00 with none at or above
30. Its verifier re-executed five members, reproduced the LCOV recount, and cross-checked the
long gates through their surviving artifacts.

`init.manager` reports every phase `stale`. That is the `covered_files` timestamp artifact
documented in STATE.md (each VERIFICATION.md lists ROADMAP/STATE/REQUIREMENTS, which every later
close rewrites), not an outcome verdict.

## Integration — 9/9 requirement paths wired, 2/2 flows

The integration check traced each requirement to the shipping composition rather than to phase
reports. Every gate a phase introduced is a member of `package.json` `check` (16 members) and
is pinned by `tests/architecture/coverage-metrics-pipeline.test.ts`, which plants violations
rather than re-reading config. Both `fallow dead-code` runs (production-scoped, then
`--no-production --circular-deps --re-export-cycles`) pass. Fallow's whole-tree `maxCrap: 0`
stays disabled while `scripts/coverage-risk-policy.json` is the single CRAP-30 enforcement
point, so the two never compete over one metric. Phase 6's five recorded member exceptions and
Phase 5's `fallow-ignore` markers are separate lists consumed by separate analyzers; nothing is
double-counted.

Product-surface flows changed by this milestone:

- **Argument validation (ARGS-01..03):** `edge/router.ts` → handler → `edge/args-schema.ts`
  `parseCommandArgs`, the single chokepoint that rejects unknown flags and surplus positionals
  before any orchestrator work; `tests/architecture/flag-catalog-drift.test.ts` is the drift
  gate. Wired.
- **Agent collision and name migration (AGENT-01/02):** `bridges/agents/{discover,stage,convert}`
  + `domain/name.ts`, exercised end to end by `tests/orchestrators/plugin/install-flow.test.ts`,
  `reinstall-flow.test.ts`, `update-flow.test.ts` and `tests/edge/handlers/plugin/reinstall.test.ts`,
  plus the two global-peer pi-subagents integration cases. Wired.

No orphaned scripts, no test file outside the `check`/`test` globs, no workflow job referencing a
removed script, no control without its negative twin in the chain.

## The one warning

`07-VERIFICATION.md` frontmatter says `score: 8/8`; its body says 10/10. Both are true under
their own counting (eight plan-level must-haves; ten truths once the two roadmap criteria are
added). Phase 8 cites the frontmatter as canonical and says so in `08-MEASUREMENT.md` section 1.
The record is historical and is not rewritten here; a future reader of `07-VERIFICATION.md`
alone should read the body's parenthetical.

## Tech debt

Listed in the frontmatter by phase. None of it is read by a gate. The two items worth a look at
the next opportunity: the Phase 5 comment drift (six comments name a `Check` call the code no
longer makes) and the four `draft` VALIDATION.md files, which `/gsd-validate-phase` would
reconcile without new work.

## Note on this file's path

The milestone is named, not versioned, so this report is `test-backlog-MILESTONE-AUDIT.md`,
matching `refine-unit-tests-MILESTONE-AUDIT.md`. Automated paths that grep for
`.planning/v<version>-MILESTONE-AUDIT.md` will not find it.
