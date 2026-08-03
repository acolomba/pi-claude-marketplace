---
phase: 94
slug: environment-variable-documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 94 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | docs-only phase — no test framework; verification is content assertion + doc linting |
| **Config file** | .pre-commit-config.yaml (mdformat, markdownlint-cli2) |
| **Quick run command** | `pre-commit run mdformat markdownlint-cli2 --files docs/env-vars.md docs/hooks-compatibility.md` |
| **Full suite command** | `npm run check` (unchanged by this phase — no source edits) |
| **Estimated runtime** | ~5 s lint; content assertions via grep per task verify blocks |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` verify (grep content assertions + doc lint)
- **After every plan wave:** `pre-commit run --files docs/env-vars.md docs/hooks-compatibility.md`
- **Before `/gsd-verify-work`:** All content assertions green; `npm run check` still green (no source drift)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner — grep-assertable content checks per DOC-06/DOC-07 deliverable) | | | DOC-06, DOC-07 | | | content | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — pre-commit doc hooks
already installed; content assertions need no framework.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

Expected: none — matrix/table content is grep-assertable.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
