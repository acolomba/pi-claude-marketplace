---
phase: 94
slug: environment-variable-documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
validated: 2026-08-03
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
| 94-01-01 | 01 | 1 | DOC-06 | — | Matrix + legend + two-mechanism prose land; pi-only rows marked | content | grep assertions on docs/env-vars.md + `pre-commit run mdformat --files docs/env-vars.md` / `markdownlint-cli2` | ✅ | ✅ green |
| 94-01-02 | 01 | 1 | DOC-06 | — | Per-surface tables + all six divergence items (C-1..C-6) + not-delivered section present | content | grep assertions (nested-host, spawn-order, staleness, resolveEnv, out-of-scope names, ledger count) | ✅ | ✅ green |
| 94-01-03 | 01 | 1 | DOC-07 | — | Hooks env table corrected in place; authority line present; no cross-doc contradiction | content | grep assertions on docs/hooks-compatibility.md; diff confined to `## Environment variables` | ✅ | ✅ green |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing pre-commit doc hooks)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-03

---

## Validation Audit 2026-08-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All three task verifications ran green during execution (executor evidence),
were independently re-checked by the 3-iteration review/fix loop (factual
accuracy vs bridge sources) and by the phase verifier (10/10 truths, including
a direct check of the pi-mcp-adapter claim against the globally installed
package source). Docs-only phase — content assertions + doc lint constitute
the full automated coverage; no manual-only items.
