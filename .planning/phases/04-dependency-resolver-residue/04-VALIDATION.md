---
phase: "04"
slug: "dependency-resolver-residue"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| **Config file** | `package.json` scripts, `cucumber.json` |
| **Quick run command** | `node --test <test-path>` and `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~120 seconds (full), ~10 seconds (one test file) |

## Sampling Rate

- **After every task commit:** the owner test file plus direct coverage of each changed source (the commit hook runs `check:commit`).
- **After a task touching `features/`:** `npm run check:features` and the scenario via `npx cucumber-js --name '<title>'`.
- **After every plan wave and before verification:** `npm run check` on the combined tree.
- **Max feedback latency:** 120 seconds.

## Per-Task Verification Map

See `04-RESEARCH.md` § Validation Architecture for the requirement-to-command
map; each plan's tasks carry the matching `<automated>` command.

## Wave 0 Requirements

- [x] `test/bridges/agents/<new>.test.ts` pairs with the new agents-bridge check (RSV-04).
- [x] A keyed `contradiction` fixture in `test/orchestrators/plugin/dependency-plan.test.ts` (RSV-03).
- [x] Cucumber steps: publish a plugin agent; place a hand-written agent file (RSV-04).

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** focused validation evidence complete; the execute-phase owner retains the full `npm run check` gate.


## Integrated-tree evidence (2026-10-28)

| Requirement | Observable evidence | Focused command | Result |
|-------------|---------------------|-----------------|--------|
| RSV-01 | Previewed commit reaches dependency and install-root ledger; git fixture sees one fetch | `node --test test/orchestrators/plugin/dependency-plan.test.ts test/orchestrators/plugin/install-flow-dependency-ledger.test.ts`; Phase 4 Cucumber scenarios | green |
| RSV-02 | Deferred apply still refuses a bad fresh dependency before a move | `node --test test/orchestrators/plugin/dependency-plan.test.ts` | green |
| RSV-03 | Contradiction fixture shows the documented D-PL4-03 untried-pair limit | `node --test test/orchestrators/plugin/dependency-plan.test.ts` | green |
| RSV-04 | Occupied agent targets refuse before moves or dependency installs; prior files and state survive | `node --test test/bridges/agents/target-check.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/install-flow-planning.test.ts`; Phase 4 Cucumber scenarios | green |
| RSV-05 | No-match tag probe has no range; declared ranges and rollback partials reach failure outcomes | `node --test test/orchestrators/plugin/dependency-tag-probe.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts test/orchestrators/plugin/install-cascade.test.ts test/orchestrators/plugin/install-flow-cascade-context.test.ts test/orchestrators/plugin/install-flow-results.test.ts` | green |

The focused unit runs passed all 11 selected modules. The four Phase 4 Cucumber scenarios passed: 4 scenarios, 57 steps. They cover one git fetch, occupied second dependency move, occupied fresh dependency before a move, and occupied direct update before dependency install. The first sandbox run could not bind the loopback git fixture (`listen EPERM`); the permitted rerun passed. No test or fixture change was needed.

## Final merged-tree audit (2026-10-28)

The Phase 4 validation map remains Nyquist-compliant on the final integrated tree.
The audit found no uncovered RSV behavior and required no test or fixture change.

| Evidence | Final result |
|----------|--------------|
| Eleven focused owner modules covering resolver preview/apply, move preflight, tag probing, cascade planning, dependency ledger pins, install outcomes, and update swap | 11 passed, 0 failed |
| RSV-01 one-fetch scenario plus the three RSV-04 occupied-agent refusal scenarios | 4 scenarios passed, 57 steps passed |
| Final integrated `npm run check` supplied by the phase owner on the same build inputs | 1,142 scenarios, 11,734 steps, 309 LCOV records |

RSV-01 through RSV-05 therefore remain covered by behavioral assertions that can
fail on duplicate resolution, a post-mutation refusal, a contradictory-plan
regression, a reintroduced `range` field on `no-matching-tag`, or a missing
`rollbackPartials` outcome. Since the merge commit, only planning Markdown has
changed; the final full-gate result is reusable for this audit under the local
verification policy.

## Final-head audit (2026-10-29)

The final integrated tree remains Nyquist-compliant. The audit started from the
assumption that later warning-channel and resolver integrations had broken a
Phase 4 handoff; fresh owner and public behavior runs disproved that hypothesis.

| Requirement | Fresh adversarial proof | Result |
|-------------|-------------------------|--------|
| RSV-01 | Dependency-plan, install-outcome, planning, cascade-context, ledger, and public git-request assertions still pin the previewed SHA and exactly one fetch. | green |
| RSV-02 | The deferring-plan owner still refuses a bad fresh dependency before scheduling a move. | green |
| RSV-03 | The exact four-walk, six-judge untried-pair case still pins the recorded greedy-search limit. | green |
| RSV-04 | Target-check, update-swap, preview/planning owners and three public scenarios still prove that the occupied target refuses before a move or dependency install mutates state. | green |
| RSV-05 | Release/tag/cascade owners retain the range-free no-match arm, and the split dependency-ledger/results owners retain the exact rollback-partial outcome. | green |

Fresh focused evidence:

- `node --test` over 13 current owner modules passed 13/13 modules, including
  the Phase 11 split planning, cascade-context, dependency-ledger, ledger, and
  results owners.
- The four discriminating Phase 4 Cucumber scenarios passed 4/4 scenarios,
  57/57 steps, and 16/16 hooks. The sandboxed attempt could not bind the
  loopback fixture (`listen EPERM`); the permitted rerun passed unchanged.
- `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` exited
  0. The exact full `npm run check` result at that unchanged executable head is
  therefore reusable: 1,145 scenarios, 11,777 steps, and 309 LCOV records.

No test, fixture, or implementation gap was found. RSV-01 through RSV-05 are
COMPLIANT with zero resolved, escalated, skipped, or remaining gaps.

## Validation Audit 2026-10-29

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
