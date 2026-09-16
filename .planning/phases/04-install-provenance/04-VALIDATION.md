---
phase: "4"
slug: "install-provenance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-15"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in runner). Local Node v26.8.2; CI pins Node 24 |
| **Config file** | none — suites are selected by glob in `package.json` scripts |
| **Quick run command** | `node --test tests/<path>/<file>.test.ts` |
| **Full suite command** | `npm test` (6363 cases on the current tree) |
| **Estimated runtime** | ~5s single file; full unit suite minutes |

**Phase gate:** `npm run check` — `typecheck && lint && lint:workflows && lint:workflows:negative && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration`

**Pairing gate:** `scripts/check-corresponding-tests.mjs` enforces 1:1 `extensions/pi-claude-marketplace/X.ts` ↔ `tests/X.test.ts`.

---

## Sampling Rate

- **After every task commit:** the touched file's paired test. **Plus `npm run fallow` for any task touching `migrate.ts`** — see the complexity note below; `npm run lint` will not catch it
- **After every plan wave:** `npm test` AND `npm run test:integration`. `npm test` is the only gate that sees the fixture blast radius — `tsc` is not
- **Before `/gsd-verify-work`:** `npm run check` green, then `pre-commit run --all-files` (no pre-commit hook is installed in this checkout, so it must be run by hand; budget ~9 min)
- **Max feedback latency:** ~10 seconds for a single paired test

---

## Per-Task Verification Map

Task IDs are assigned by the planner and filled in after planning. Every row's paired test file already exists — there are no Wave 0 gaps.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PROV-01 | — | N/A | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-01 | — | N/A | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-01 | — | N/A | unit | `node --test tests/orchestrators/plugin/install-outcome.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-01 | — | N/A | unit | `node --test tests/persistence/state-io.test.ts tests/orchestrators/plugin/reinstall-record.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-04 | — | N/A | unit | `node --test tests/persistence/migrate.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-04 | — | N/A | unit | `node --test tests/persistence/state-io.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROV-02 | — | N/A | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 2 | D-04-05 | — | N/A | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 3 | D-04-02 | — | N/A | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 3 | D-04-04 / CR-01 | — | N/A | unit (drives `applyReconcile`) | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 3 | PROV-03 / D-04-07 | — | N/A | unit | `node --test tests/orchestrators/plugin/install-outcome.test.ts tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 3 | PROV-03 / D-04-07 | — | N/A | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### What each test must be observed FAILING against

A test that has never been seen red proves nothing. Each row names the specific unfixed state it must fail against:

| Requirement | Must be observed failing against |
|---|---|
| PROV-01 (schema pin) | the un-amended key-set pin in `compat-01-no-expansion.test.ts` |
| PROV-01 (cascade values) | an `install-flow.ts` that passes a constant instead of `member.key === rootKey` |
| PROV-01 (standalone) | `statePhase` omitting the field — `saveState` refuses |
| PROV-01 (clone carry) | an omission at `state-io.ts:149` / `reinstall-record.ts:128` |
| PROV-02 | a cascade that includes already-installed members — plant it by relaxing `dependency-closure.ts:269`'s `!isRoot &&` guard |
| PROV-03 | the current `already-installed` throw at `install-outcome.ts:414`, which fails instead of promoting |
| PROV-04 (fill) | the fill absent — `STATE_VALIDATOR.Check` throws at `state-io.ts:464` |
| PROV-04 (no coercion) | a fill that overwrites rather than only filling absence |
| PROV-04 (no misreport) | a fill defaulting to `"dependency"` |
| PROV-04 (version guard) | the un-widened guard at `state-io.ts:409-410` |
| D-04-05 (positive) | the un-exempted inner loop at `plan.ts:501-506` |
| D-04-05 (negative control) | an over-broad exemption that skips every undeclared record |
| D-04-02 | the un-removed arms at `install-flow.ts:1346` / `:1358` |
| D-04-04 / CR-01 | step 3 landed without step 2 — worth planting once, deliberately, as the proof that step 2 is load-bearing |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Every file this phase touches already has its paired test:

- `tests/persistence/state-io.test.ts`
- `tests/persistence/migrate.test.ts`
- `tests/orchestrators/reconcile/plan.test.ts`
- `tests/orchestrators/plugin/install-flow.test.ts`
- `tests/orchestrators/plugin/install-outcome.test.ts`
- `tests/orchestrators/plugin/install-cascade.test.ts`
- `tests/orchestrators/plugin/reinstall-record.test.ts`
- `tests/orchestrators/plugin/shared.test.ts`

**Create no new production module.** Doing so incurs a new required pair and a new 100%-run-alone coverage obligation for no benefit — every change this phase needs has a home in an existing file. The one exception to watch is D-04-07's new outcome row: if it forces a new `*.messaging.ts` surface, that surface needs its pair.

---

## The project's own rule, applied

A green suite is not proof. CR-01 passed every test while falsifying RESV-01, because the tests exercised `installPlugin` directly and never drove `applyReconcile` — the path reconcile actually takes.

1. **The reconcile-survival test must drive `applyReconcile`, not `planReconcile` alone.** The existing case at `install-flow.test.ts:3486` already does this (it calls `reconcilePass()` twice). Keep that shape. A test that only calls `planReconcile` and asserts `pluginsToUninstall === []` repeats the exact CR-01 mistake.
2. **PROV-02's proof must be falsifiable.** It needs no production code, which makes a vacuous pass easy. Plant the violation and observe the failure before asserting the fix.
3. **The exemption needs its negative control.** A test that only proves the dependency is kept would pass against an exemption that keeps everything.

---

## Regression surface

A probe implementation produced **861 failing test cases across 39 files**:

- **~765 are one runtime message** (`saveState refused: … must have required property`) from loosely-typed fixtures. Mechanical; they carry no contract.
- **96 across 20 files are real byte-exact or behavioral contracts.** These ARE the regression surface. Each must be read and amended deliberately.

**A byte assertion "fixed" by copying the new actual bytes back into the expectation has verified nothing.** Expected values are built independently.

---

## Complexity budget

Measured, not estimated. `migrateLegacyMarketplaceRecords` ends this phase at **18 cyclomatic / 15 cognitive** against fallow's ceiling of 20/15 — **zero headroom**, and the ceiling is inclusive (verified: `fallow health --fail-on-issues` exits 0 at exactly 15).

ESLint's `sonarjs/cognitive-complexity` reads the same function at **7**. A green `npm run lint` is not evidence that `npm run fallow` will pass. Any task touching `migrate.ts` must run `npm run fallow` directly.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A legacy `state.json` written by a released build (through v0.18.3) loads and fills `"explicit"` | PROV-04 | No released-build state file exists in the repo; the automated test uses a synthesized v2 document, which is a fixture rather than a genuine artifact | Install a plugin on a v0.18.3 build, keep its `state.json`, load it under this phase's build, confirm every record reads `"explicit"` and no notification fires |
| The new D-04-07 outcome row renders as documented | PROV-03 | The catalog contract asserts bytes; a human should confirm the row reads sensibly in a live session | In a live Pi session install a plugin as a dependency, then `install` it by name, and confirm the row states the promotion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references *(none — infrastructure is complete)*
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] Every row's "observed failing against" state was actually observed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
