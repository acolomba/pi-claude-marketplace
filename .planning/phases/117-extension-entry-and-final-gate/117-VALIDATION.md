---
phase: "117"
slug: "extension-entry-and-final-gate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-03"
---

# Phase 117 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `strong-mock` + `node:assert/strict` |
| **Config file** | none — configured entirely through `package.json` scripts |
| **Quick run command** | `node --test <one test path>` |
| **Focused pair command** | `node scripts/test-coverage-direct.mjs <source-or-test-path>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~0.9–9.0 s per pair (measured); full suite 5141/5141 across 295 suites |

**The aggregate gate cannot speak here.** `npm run check` is
`typecheck && lint && fallow && format:check && test && test:integration`, and `format:check` fails on
the operator's pre-existing untracked files, short-circuiting before `test`. Every command below is
run **separately** with its exit code read.

---

## Sampling Rate

- **After every task commit:** `node scripts/test-coverage-direct.mjs <the pair touched>` **and**
  `node scripts/check-corresponding-tests.mjs`.
- **After every plan wave:** `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`,
  `npm run test:integration` — each separately, each exit code read.
- **Before `/gsd-verify-work`:** the five above, plus `npm run test:coverage:direct:all` and both
  negative controls.
- **Max feedback latency:** ~9 s for a focused pair; the wave gate is bounded by `npm test`.

---

## Per-Task Verification Map

Plan and task IDs are assigned by the planner; this map fixes the requirement-to-command binding the
tasks must satisfy.

| Workstream | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|
| W1 entry pair | MOD-10, OWN-01, COV-01 | `index.ts` has a mirrored owner at 100% direct function/line/branch coverage | unit | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts` | ❌ W0 | ⬜ pending |
| W1 glob amendment | COV-01, SUITE-05 | the root owner actually runs under `npm test` | structural | `npm test` suite total must rise; plus a control that fails if the root pattern is dropped | ❌ W0 | ⬜ pending |
| W2 orphan folds | OWN-06, SUITE-06 | no `unexpected-test` remains | structural | `npm run test:corresponding` | ✅ (8 violations today) | ⬜ pending |
| W2b proxy check | OWN-02 | an owner reaching its pair only through a barrel is rejected **and named as such** | structural | `npm run test:corresponding:negative` | ❌ W0 | ⬜ pending |
| W2b coverage controls | COV-02, COV-04 | `Expected one LCOV record … found 2` and `Incomplete direct coverage for …` each have a planting control | structural | `npm run test:coverage:direct:negative` | partial — only `found 0` is controlled | ⬜ pending |
| W3 dissolution | SUITE-02 | no generic test-support directory | structural | `test ! -d tests/helpers` **and** `npm test` | ❌ W0 | ⬜ pending |
| W4 all-pair proof | COV-03, COV-05 | one complete direct coverage record per inventory row, retained as an artifact | structural | `npm run test:coverage:direct:all` + a completeness assertion over the artifact | ❌ W0 | ⬜ pending |
| W5 inventory sweep | SUITE-06, OWN-05 | ROADMAP / STATE / REQUIREMENTS / WINDOWS agree with the tree | doc | diff against the measured pair count | ❌ W0 | ⬜ pending |
| all | SUITE-05 | the repository gates pass on the completed tree | suite | the five separate commands above | ✅ green today | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/index.test.ts` — the entry owner; covers MOD-10, OWN-01, and the module's 14 branches.
      Research proved a cast-free owner reaching branches 14/14, functions 3/3, lines 161/161 is
      achievable; the prototype is preserved in the scratchpad.
- [ ] `package.json` unit-test glob amendment — **without it the new owner never runs under
      `npm test`** (measured: `globSync` returns 249 paths and the root file is not among them),
      while `test:coverage:direct:all` would still report the pair green.
- [ ] Negative control for `Expected one LCOV record … found 2`.
- [ ] Negative control for `Incomplete direct coverage for …` — the verdict the entire D-116-01a pin
      regime rests on, currently uncontrolled.
- [ ] Negative control for the new proxy/barrel check.
- [ ] The `--all` result artifact and its completeness assertion (COV-05 retains nothing today).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| The all-pair run's **duration** on the target runtime | success criterion 3, D-117-10 | A wall-clock measurement is an observation, not an assertion; it is read from the runner and recorded, never computed from a delta | Run `npm run test:coverage:direct:all`, record the runtime version and the elapsed time as printed |
| Which runtime the all-pair result is labelled with | success criterion 3 | No Node 24 is installed (PATH v26.7.0, `/usr/bin` v22.22.2); CI pins 24. Operator decision | Record the runtime actually used; do not label a non-24 run "the Node 24 all-pair result" |
| COV-05's reading for the 7 type-only modules | COV-05 | A module emitting no JavaScript has no lines to cover, so no record can exist for it. Which reading applies is a judgement, not a measurement | State the reading in the plan; do not resolve by pragma or by weakening the other 197 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for a focused pair
- [ ] Every gate added in this phase has a control that **plants the violation** — a control that
      re-reads configuration is not a control
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
