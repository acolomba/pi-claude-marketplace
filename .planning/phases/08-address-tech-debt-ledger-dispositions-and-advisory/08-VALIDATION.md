---
phase: "8"
slug: "address-tech-debt-ledger-dispositions-and-advisory"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-10"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node v26.11.1 locally, Node 24 in CI |
| **Config file** | none; scripts in `package.json` |
| **Quick run command** | `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts tests/integration/provenance-invisibility.test.ts` |
| **Full suite command** | `npm run check` (unpiped) |
| **Estimated runtime** | ~75 seconds locally for `npm run check`; seconds for the quick command |

---

## Sampling Rate

- **After every task commit:** Run the task's quick command from 08-RESEARCH.md §Validation Architecture, then `SKIP=npm-check pre-commit run --files <literal paths>` before `git commit` (the hook runs `check:commit`; staging `package-lock.json` escalates it to every direct-coverage pair)
- **After every plan wave:** Run `npm run check` (sequential execution in this checkout; run it after the last task of each plan)
- **Before `/gsd-verify-work`:** Full suite must be green, plus every SC row in 08-RESEARCH.md §Phase Requirements → Test Map, plus `npx fallow audit --base <BASE>`
- **Max feedback latency:** 180 seconds target for the per-task commands; `npm run check` is the gate, not the feedback loop

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by the planner from 08-RESEARCH.md §Phase Requirements → Test Map; this phase has no REQ-IDs, so rows cite SC-1..SC-5) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test file, fixture, or framework install is needed (08-RESEARCH.md §Wave 0 Gaps).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The waiver reasons name the right retiring commit or carrier for each entry | SC-1 | Reason content is prose; the automated row checks prefix, status, and the commit/carrier tokens, not the sentence | Read `gsd-tools windows status` output for 32-34, 41-58, 84, 88 against 08-CONTEXT.md D-01, D-03, D-05 |
| `brace-expansion@5.0.12` is the legitimate registry artifact | SC-3 | The package-legitimacy check rates the version `SUS` only for being 26 days old; a human confirms the integrity hash matches `npm view brace-expansion@5.0.12 dist.integrity` (08-RESEARCH.md §Package Legitimacy Audit) | Compare the lock's `integrity` for `node_modules/brace-expansion` with the registry value |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
