---
phase: "4"
slug: "install-provenance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-15"
validated: "2026-09-16"
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

Filled by validate-phase on 2026-09-16 from each PLAN.md task's `<verify><automated>` entries, cross-referenced against the SUMMARY.md verification records, the RED-evidence records, and the `04-SECURITY.md` threat register. Every row's paired test file already existed — there were no Wave 0 gaps.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PROV-04 | T-04-02 | Human decision checkpoint — one-way schemaVersion 2 → 3 bump with required `provenance`; see Manual-Only | checkpoint | N/A — answered `proceed-as-decided` (04-01-SUMMARY.md) | N/A | ✅ answered |
| 04-01-02 | 01 | 1 | PROV-01 | T-04-04 | `provenance` is computed from `member.key === rootKey`, never plugin-supplied; written at every layer of a cascade | tracer / unit (tdd) | `node --test --test-name-pattern "D-04-01" tests/orchestrators/plugin/install-flow.test.ts` (+ `tsc --noEmit`) | ✅ | ✅ green (RED_EVIDENCE_OK) |
| 04-01-03 | 01 | 1 | PROV-04 | T-04-02 / T-04-05 | The fill touches only an absent key and writes only through `persistMigratedState`; a present-but-invalid value is rejected at its pointer | unit (tdd) | `node --test --test-name-pattern "D-04-03" tests/persistence/migrate.test.ts` (+ `npm run fallow` — `migrate.ts` at 18/15 against 20/15) | ✅ | ✅ green (RED_EVIDENCE_OK) |
| 04-02-01 | 02 | 2 | PROV-01, PROV-04 | T-04-06 | All four architecture pins remain equality assertions; each rewritten message records what it now sanctions | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/hooks-foundation.test.ts` | ✅ | ✅ green (two plants observed red) |
| 04-02-02 | 02 | 2 | PROV-04 | T-04-02 | Non-coercion: a value outside the two literals reaches the validator and is rejected with the stored bytes untouched | unit (tdd) | `node --test tests/persistence/state-io.test.ts tests/persistence/migrate.test.ts` (+ `test:coverage:direct` on `migrate.ts`) | ✅ | ✅ green (RED_EVIDENCE_OK ×2) |
| 04-03-01 | 03 | 3 | PROV-01 | T-04-07 | Fixture sweep: builders first, contracts second; no byte expectation repaired from actual output | unit (sweep) | `node --test "tests/orchestrators/**/*.test.ts"` | ✅ | ✅ green |
| 04-03-02 | 03 | 3 | PROV-01 | T-04-07 | Same discipline over edge/transaction/bridge/entry suites and the integration suite; strict-equality census 1584→1592 / 284→284 / 500→502 | unit + integration (sweep) | `node --test "tests/{edge,transaction,bridges}/**/*.test.ts" "tests/index.test.ts"` (+ `npm run check`) | ✅ | ✅ green |
| 04-03-03 | 03 | 3 | PROV-02 | T-04-08 | Whole-record `deepStrictEqual` proves a direct install stays direct when a later plugin declares it; falsified against a three-site plant | unit (tdd, planted red) | `node --test --test-name-pattern "D-04-01" tests/orchestrators/plugin/install-flow.test.ts` (+ `git diff --quiet -- extensions/` → 0) | ✅ | ✅ green (RED_EVIDENCE_OK) |
| 04-04-01 | 04 | 4 | PROV-01 (D-04-05) | T-04-09 | The exemption's positive case and its negative control share one `provenanceState()`; an over-broad exemption shows as a missing uninstall entry | unit | `node --test --test-name-pattern "D-04-05" tests/orchestrators/reconcile/plan.test.ts` | ✅ | ✅ green (red then green; widened form red in both halves) |
| 04-04-02 | 04 | 4 | PROV-01 (D-04-05) | T-04-09 / T-04-10 | One field test in `buildUninstallBucket`; `plan.ts` stays pure (purity gate unamended) | unit + architecture (tdd) | `node --test tests/orchestrators/reconcile/plan.test.ts tests/architecture/reconcile-planner-purity.test.ts` (+ `npm run fallow`, `npm run check`) | ✅ | ✅ green |
| 04-05-01 | 05 | 5 | PROV-01, PROV-02 (D-04-02) | T-04-03 / T-04-11 | Both cascade config-write arms and their dead parameters removed; `fallow dead-code` → no issues | lint / static | `npm run fallow` + `npm run typecheck` + `npm run lint` | ✅ | ✅ green |
| 04-05-02 | 05 | 5 | PROV-01 (D-04-04 / CR-01) | T-04-03 | Reload-survival case drives `applyReconcile` twice with NO declaration; observed red with the D-04-05 exemption reverted | unit (tdd, planted red) | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts` (+ `npm test`) | ✅ | ✅ green (RED_EVIDENCE_OK) |
| 04-05-03 | 05 | 5 | PROV-01 (D-04-02) | T-04-12 | Retired-behavior prose rewritten; two literal-absence greps read 0 | docs / gate | `node --test tests/architecture/dependency-doc-agreement.test.ts` (+ `pre-commit run --files docs/dependency-resolution.md README.md`) | ✅ | ✅ green |
| 04-06-01 | 06 | 6 | PROV-03 | T-04-14 | Human decision checkpoint — reason token `dependency promoted`, status `installed`, info severity, no reload hint; see Manual-Only | checkpoint | N/A — answered `proceed-as-decided` (04-06-SUMMARY.md) | N/A | ✅ answered |
| 04-06-02 | 06 | 6 | PROV-03 (D-04-07) | T-04-13 / T-04-14 / T-04-15 | Promotion flips one field of one record with no ledger run; declares the key via the single-entry writer; skipped in orchestrated mode | unit (tdd) | `node --test --test-name-pattern "D-04-07" tests/orchestrators/plugin/install-flow.test.ts` (+ `notification-types`, `notify-reasons`, `install.messaging` pairs) | ✅ | ✅ green (RED_EVIDENCE_OK) |
| 04-06-03 | 06 | 6 | PROV-03 (D-04-07) | T-04-14 | All nine catalog surfaces moved in one commit; every enumeration and byte pin green; omission plant observed firing | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts` (+ `npm run check`, `pre-commit run --all-files`) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sampling continuity: every task except the two human checkpoints (04-01-01, 04-06-01) carries an automated direct-owner command; no 3 consecutive tasks lack one.*

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

**Observed (validate-phase 2026-09-16):** every row above has a recorded red run in its plan's SUMMARY.md — 04-01 (Tasks 2, 3: `RED_EVIDENCE_OK`), 04-02 (renamed-field and reverted-default plants against the pins; overwrite-instead-of-fill and dependency-default plants against the persistence cases, both `RED_EVIDENCE_OK`), 04-03 (three-site cascade plant for PROV-02, `RED_EVIDENCE_OK`), 04-04 (positive case red then green; over-broad exemption red in both halves — raw TAP shows the target failing; the checker's `INVALID_RED` is the known `describe`-nesting limitation and is recorded in the summary), 04-05 (exemption reverted, reload-survival case red on `pluginsToUninstall`, `RED_EVIDENCE_OK`), 04-06 (`already-installed` throw on the non-mutating arm, `RED_EVIDENCE_OK`; catalog omission plant observed firing).

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
| A legacy `state.json` written by a released build (through v0.18.3) loads and fills `"explicit"` | PROV-04 | No released-build state file exists in the repo; the automated test uses a synthesized v2 document, which is a fixture rather than a genuine artifact. The contract itself (absent key filled `"explicit"`, present value untouched, out-of-union value rejected at its pointer, schemaVersion 2→3) is fully automated in `tests/persistence/migrate.test.ts` and `state-io.test.ts`; this row is a confidence check against a genuine artifact, not a coverage gap | Install a plugin on a v0.18.3 build, keep its `state.json`, load it under this phase's build, confirm every record reads `"explicit"` and no notification fires. **Status: open (optional) — not required for nyquist compliance; carry into the milestone UAT sweep if a released-build state file is at hand** |
| The new D-04-07 outcome row renders as documented | PROV-03 | The catalog contract asserts bytes; a human should confirm the row reads sensibly in a live session | In a live Pi session install a plugin as a dependency, then `install` it by name, and confirm the row states the promotion. **Status: passed — `04-UAT.md` test 1, operator accepted the pinned row bytes as legible, 2026-09-16T19:07:07Z** |

---

Two tasks are human decisions rather than behaviors:

| Task ID | What | Outcome |
|---------|------|---------|
| 04-01-01 | `checkpoint:decision` — confirm the one-way schemaVersion 2 → 3 bump with required `provenance` and silent `"explicit"` back-fill (D-04-03) | Developer answered `proceed-as-decided` (recorded in `04-01-SUMMARY.md` § Checkpoint answer); the `optional-additive-instead` shape was declined |
| 04-06-01 | `checkpoint:decision` — confirm the reason token `dependency promoted`, status `installed`, info severity, no reload hint (D-04-07) | Developer answered `proceed-as-decided` before dispatch (recorded in `04-06-SUMMARY.md`); `skipped` and other wordings rejected |

---

## Validation Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Tasks mapped | 15 (13 automated + 2 human checkpoints) |
| Requirements covered | 4/4 (PROV-01..04) |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Targeted run of all 18 referenced test files at `14b6a542`: 578 tests, 578 pass,
0 fail (`node --test`, 9.2 s). Every `<automated>` command's owning test file
exists on disk and every SUMMARY.md verification record reads `status: pass`.
No auditor subagent was spawned: no MISSING or PARTIAL classification remained
after cross-referencing. The one open Manual-Only row (legacy released-build
state file) is a confidence check whose contract is already automated, not a
coverage gap.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references *(none — infrastructure is complete)*
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] Every row's "observed failing against" state was actually observed
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-16
