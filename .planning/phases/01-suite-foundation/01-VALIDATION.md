---
phase: "1"
slug: "suite-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-22"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` 13 (behavioral); `node:test` for unit tests |
| **Config file** | `cucumber.json` |
| **Quick run command** | `npx cucumber-js <touched feature files>` and `npm run check:features` |
| **Full suite command** | `npm run test:cucumber` (about 15 s), then `npm run check` at the phase gate |
| **Estimated runtime** | ~15 seconds for the suite, ~2 minutes for `npm run check` |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js <touched feature files>` and `npm run check:features`
- **After every plan wave:** Run `npm run test:cucumber` and `npm run check:static`
- **Before `/gsd-verify-work`:** `npm run check` must be green on the combined tree
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled by the planner: one row per task, with its seed feature file and command (see `01-RESEARCH.md` § Validation Architecture and the Seed Map).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-XX | XX | X | FND-01 / FND-02 | — | Sandbox HOME only; loopback-only git host | behavioral / static | `npx cucumber-js features/plugin/<seed>.feature` / `npm run check:features` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New seed feature files (`git-source`, `git-source-update`, `install-rollback`, `install-dependencies`, `partial-install`, `info`, `pending`, `reconcile`, `prune`, `import`, `bootstrap`, `help`, `plugin/state-lock`, and the others in the Seed Map)
- [ ] `features/lib` modules: lock holder, git plugin repositories, official marketplace, settings writer, shared result-row helpers
- [ ] Run tokens for the project directory, the agent directory, and git revisions, documented in `.agents/skills/cucumber/rules/features.md`

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
