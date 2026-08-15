---
phase: 103
slug: reconcile-stability-and-lifecycle-non-reapplication
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in), Node `>=20.19.0` |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | quick command ≈ 4.8s (154 tests), measured on this tree at HEAD; `npm run check` ≈ 6min |

---

## Sampling Rate

- **After every task commit:** the quick command above, plus `npm run typecheck`.
- **After every plan wave:** `npm test` (the architecture globs are in the unit set, and this phase adds an architecture gate).
- **Before verification:** `npm run check` must be green (NFR-6).
- **Max feedback latency:** ~4.8s for the quick command — well under the ~60s budget, so no `--test-name-pattern` narrowing is needed.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each row below is a required behavior; the planner MUST attach every row to at least one task and fill the Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DFEN-06 | T-103-01 | The planner classifies an install-disabled plugin into NO action bucket — asserted against `plan.ts`'s own output, with the fixture proven to have reached the classifier at all (D-103-04, D-103-06) | unit | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/plan-convergence.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-06 | T-103-01 | Three successive `applyReconcile` passes are a fixed point: config entry, state record and rendered cascade all unchanged after passes 2 and 3 (D-103-05) | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-06 | T-103-02 | The fixed point holds for a plugin declared ONLY in `claude-plugins.local.json` — the case where a mis-targeted stamp surfaces as continued planning rather than as a bad write (D-103-07) | unit | same | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-07 | T-103-03 | `update` does not move an install-disabled record when the marketplace entry's `defaultEnabled` is flipped between the two calls, with the manifest cache proven invalidated so the flip is really seen (D-103-10) | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-07 | T-103-03 | `reinstall` likewise does not move it across the same flip | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-07 | T-103-04 | Architecture gate: `orchestrators/plugin/{update,reinstall}.ts` reference neither `defaultEnabled` nor `applyDefaultEnabled`, while their legitimate `resolveStrict` calls stay allowed (D-103-08, D-103-09) | architecture | `node --test "tests/architecture/**/*.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-07 | T-103-05 | Criterion 4's converse: after `enable`, the declaring config file reads `enabled: true` and the record stays enabled across reload, update and reinstall (D-103-11) | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-05 / DFEN-08 | T-103-06 | The D-103-01 decision is pinned: installing over a config entry that already says `enabled: false` materializes the plugin and leaves the entry byte-identical — the behavior that widening would have changed (D-103-03) | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | NFR-6 | — | Whole suite green at the phase boundary | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers every phase requirement. Every target test file already exists:

- `tests/orchestrators/reconcile/plan.test.ts`, `plan-convergence.test.ts`, `apply.test.ts`
- `tests/orchestrators/plugin/update.test.ts`, `reinstall.test.ts`, `enable-disable.test.ts`, `install.test.ts`
- `tests/architecture/` — including three existing convergence/purity gates the new gate should be sited against rather than duplicating: `reconcile-planner-purity.test.ts`, `cross-op-convergence.test.ts`, `no-orchestrator-network.test.ts`

No framework install, no new fixture harness. The one genuinely new artifact this phase may add is a single architecture gate, and the planner should first decide whether it belongs inside `reconcile-planner-purity.test.ts` or `no-orchestrator-network.test.ts` rather than as a new file.

---

## Manual-Only Verifications

None. Every behavior in this phase is a planner output, a state/config comparison, or a source-level gate — all assertable in process.

---

## Security Sign-Off (ASVS L1, block on `high`)

| Threat Ref | Pattern | STRIDE | Mitigation to verify |
|------------|---------|--------|----------------------|
| T-103-01 | An unattended reload silently re-enabling a plugin its author declared off — the milestone's central hazard | Elevation of privilege | The planner plans no action; a re-enabled plugin's hooks would dispatch again |
| T-103-02 | A mis-targeted config stamp leaving the merged view unchanged, so the re-enable returns undetected | Tampering | The local-declared fixed-point case is the only assertion that distinguishes this from a correct stamp |
| T-103-03 | A plugin release flipping `defaultEnabled` to flip an existing user's enablement | Tampering | `update`/`reinstall` never read the field; the manifest flip proves it rather than assuming it |
| T-103-04 | A future edit reintroducing the read into a lifecycle verb | Tampering | Source-level gate fails at the token, before any behavior exists to test |
| T-103-05 | A user's explicit `enable` being reverted by the next reload | Tampering | `enable` writes `enabled: true` to the declaring file, making the reload a fixed point in that direction too |
| T-103-06 | Widening the install verdict and silently breaking the DFEN-08 parity guarantee | Tampering | The pinned regression test makes the current behavior explicit and attributed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — every target file exists)
- [x] No watch-mode flags
- [x] Feedback latency recorded and under budget — 4.8s measured, not estimated
- [ ] Every Per-Task Verification Map row has a real Task ID
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — the planner binds Task IDs, then the plan-checker gate signs off. `status` stays `draft` until `/gsd-validate-phase` sets `validated`.
