---
phase: "8"
slug: "clear-milestone-debt"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), strict TS run natively; fallow 3.31.0 for DEBT-01 |
| **Config file** | `package.json` scripts; `scripts/test-coverage-direct.mjs`; `.fallowrc.json` |
| **Quick run command** | `TMPDIR=/var/tmp/mcp4-p8 node --test <owner test file>` |
| **Full suite command** | `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p8 npm run check` |
| **Estimated runtime** | quick ~5-30 s; full check ~3 min |

---

## Sampling Rate

- **After every task commit:** the owner test; the pre-commit hook runs `check:commit`.
- **After every plan that touches a file in a fallow clone group:** the DEBT-01 audit command (editing lines inside an old group re-flags it as added).
- **After every plan wave:** the full suite command.
- **Before `/gsd-verify-work`:** full suite green, the audit at `pass`, and the DEBT-02 ledger check.
- **Max feedback latency:** 60 seconds for owner tests.

---

## Per-Task Verification Map

Task IDs are filled by the planner. Requirement-level checks from `08-RESEARCH.md` §Validation Architecture:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DEBT-01 | — | N/A | gate | `npx fallow audit --base $(git merge-base origin/main HEAD) --format json` verdict `pass`; `npm run fallow` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DEBT-02 | — | N/A | doc check | no `open`/`deferred`/`skipped` row in `.planning/phases/0[1-7]-*/0[1-7]-REVIEW-DISPOSITION.md`; Phase 7 ledger exists | ❌ W0 (Phase 7 ledger) | ⬜ pending |
| TBD | TBD | TBD | DEBT-03 | choice store | store holds only carried fields, never a credential | unit + integration + conformance | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/stage.test.ts tests/integration/mcp-override-lifecycle.test.ts`; adapter conformance case with `PI_MCP_ADAPTER_ROOT` | ❌ W0 (conformance case) | ⬜ pending |
| TBD | TBD | TBD | DEBT-04 (D-08-03) | — | N/A | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/import/execute.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DEBT-04 (D-08-04) | OAuth headers | never write a credential; auth only for clean headers | unit | `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DEBT-04 (D-08-05) | — | N/A | unit + architecture | `node --test tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/git-source-probe.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts tests/architecture/mcp-migration-notice.test.ts tests/shared/notification-dispatch.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DEBT-04 (D-08-06) | env | staging reads only the passed env | unit | `node --test tests/bridges/mcp/stage.test.ts tests/orchestrators/plugin/install-outcome.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DEBT-04 (D-08-07) | prototype keys | inherited keys never read as records; `__proto__` refused | unit + integration | `node --test tests/shared/own-key.test.ts tests/domain/name.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ❌ W0 (`tests/shared/own-key.test.ts`) | ⬜ pending |
| TBD | TBD | TBD | DEBT-05 | — | N/A | doc check | ROADMAP Phase 1 criterion 4 names D-04-12, D-07-07; `STATE.md` ADET-02 wording says extension command | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shared/own-key.test.ts` — pairs with the new `shared/own-key.ts` (pairing gate)
- [ ] An adapter conformance case for the `_piClaudeMarketplace.serverChoices` member, through `tests/integration/pi-mcp-adapter-peer.ts`, with a hermetic HOME
- [ ] `.planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md`

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
