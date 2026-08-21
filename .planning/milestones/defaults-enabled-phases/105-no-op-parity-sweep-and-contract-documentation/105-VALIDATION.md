---
phase: 105
slug: no-op-parity-sweep-and-contract-documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
---

# Phase 105 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict`, Node v22.22.2 with native TS type-stripping |
| **Config file** | none — driven by `package.json` scripts and a path glob |
| **Quick run command** | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/list.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/compat-01-no-expansion.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8s quick (measured: 312 tests / 7.97s) · ~44s full |

Full gate: `npm run check` = typecheck + lint + format:check + test + test:integration.

---

## Sampling Rate

- **After every task commit:** the quick run command (~8s)
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must exit 0
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DFEN-08 | `update` — declaring-`true` and silent rows identical to each other; a flipped declaration moves no enablement | unit/integration | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ test added | ✅ green |
| DFEN-08 | `reinstall` — same, over the bulk cascade | unit/integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ test added | ✅ green |
| DFEN-08 | `reconcile` — same, plus per-entry config byte stability, plus a silent second pass | integration | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ test added; `seedRealPathMarketplace` widened to a plugin map | ✅ green |
| DFEN-08 | Structural half for the two lifecycle verbs | architecture | `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts` | ✅ **EXISTS AND PASSES — no work owed** | ✅ green |
| DFEN-08 | `list` / `info` / `install` arms | already covered | `node --test tests/shared/notify-not-installed-reasons.test.ts tests/orchestrators/plugin/{list,info,install}.test.ts` | ✅ exists; deliberately NOT re-proven | ✅ green |
| DOC-01 | The reinstall `(skipped) {already disabled}` block renders byte-equal to its fixture, both walk directions | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ block + fixture added | ✅ green |
| DOC-01 | The `(available)` token-table cell edit | **manual-only** | — | No byte gate covers the token-reference table's prose | ✅ verified by reading |
| DOC-02 | The contract document | **manual-only** | — | See Manual-Only section — this is a deliberate, recorded gap | ✅ verified by reading |
| Criterion 4 | Exactly one `REASONS` delta at the tail; no glyph, status token, record key or schema version moved | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ **EXISTS AND PASSES 14/14 — no work owed** | ✅ green |
| IN-02 | Network-gate docstring / failure-message accuracy | architecture (regression only) | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ exists; comment-only edit, still green | ✅ green |
| IN-04 | Type precision on `installsDisabledField` | typecheck | `npm run typecheck && node --test tests/orchestrators/plugin/list.test.ts` | ✅ exists | ✅ green |
| (hollow guard) | Deleting the unfalsifiable NFR-5 check removes no unique coverage | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ deleted in both regions, including the sibling's cross-reference | ✅ green |

**Two requirements are already satisfied before the phase starts** — the structural
lifecycle gate and the closed-set proof. The plan must ASSERT that rather than
rebuild either; duplicating them is the failure mode here.

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Every test file the phase
needs exists and is green. The single structural prerequisite is widening
`seedRealPathMarketplace` in `tests/orchestrators/reconcile/apply.test.ts` from a
scalar `pluginName` to a plugin array — a change inside a test file, not new
infrastructure. `update`'s `seedPathMarketplace` / `rewriteManifest` and
`reinstall`'s `seedMarketplace` already take a `defaultEnabled` knob and already
support multi-plugin marketplaces; neither needs a change.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/plugin-enablement.md` states the shipped three-input rule and both divergences | DOC-02 | The requirement is that a READER can tell a stated limit from an oversight. No assertion expresses that. `docs/output-catalog.md` is the only byte-gated doc in this repo, and `tests/docs/` does not exist despite appearing in the `npm test` glob | Read the new document against `docs/output-catalog.md:380` (which already states the three-input rule correctly) and confirm they agree rather than diverge. Confirm the `## Divergences and documented absences` section follows the `docs/env-vars.md:129` pattern, including its no-duplication rule |
| The `(available)` token-table cell | DOC-01 | Prose in a non-gated table cell | Read it beside the `(remote)` cell and confirm they describe the same token consistently |

**This ungated surface is a known, deliberate gap, not an oversight.** The new
contract document is the one deliverable in this phase with no automated defence.
If the phase wants it defended, that must be an explicit choice made at planning
time — flag it rather than letting it pass silently.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 8s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-15

## Validation Audit 2026-08-15

Reconciled at milestone close. Every automatable row is automated and green.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 2 (manual-only by nature, declared below) |

The two escalated rows are prose deliverables with no behavior to sample: the
`(available)` token-table cell and `docs/plugin-enablement.md` itself. Both were
verified by reading — the contract document against `docs/output-catalog.md:380`
and against the live code paths, by both the phase code review and the phase
verifier. `docs/output-catalog.md` is the only byte-gated document in this repo
and `tests/docs/` does not exist, so this is a known structural limit rather than
a phase shortfall; it is recorded in the milestone audit as tech debt.

Note also that a code review found a real coverage gap AFTER this file was
seeded: the case scoped as `install` parity actually exercised DFEN-05
precedence, leaving one of DFEN-08's six surfaces untested. A parity test was
added and mutation-verified. The map row for DFEN-08 covers the corrected state.
