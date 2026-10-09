---
phase: "7"
slug: "docs-and-live-proof"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-09"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) |
| **Config file** | none; the scripts are in `package.json` |
| **Quick run command** | `node --test tests/architecture/peer-floor.test.ts tests/bridges/mcp/adapter-entry.test.ts` |
| **Full suite command** | `npm run check`; with the real peer: `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/<dir> npm run test:integration` |
| **Estimated runtime** | ~75 seconds (`npm run check`) |

---

## Sampling Rate

- **After every task commit:** the pre-commit hook (`check:commit`) for build inputs. Docs-only commits skip it.
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green, plus the canary PASS and the negative-control output recorded in `tests/live-uat/README.md`
- **Max feedback latency:** ~75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| floor | 07-01 | 1 | PIFL-03 amend (D-07-07) | — | peer admits only the advisory-fixed adapter | arch/unit | `node --test tests/architecture/peer-floor.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ | ✅ green |
| conformance | 07-01 | 1 | D-07-07 | — | N/A | integration | `PI_MCP_ADAPTER_ROOT=<5.2.0> TMPDIR=/var/tmp/<dir> node --test tests/integration/adapter-expansion-conformance.test.ts tests/integration/mcp-status-conformance.test.ts` | ✅ | ✅ green |
| canary | 07-02, 07-04 | 2–3 | ADOC-02 | — | sandboxed HOME, no real agent dir | live UAT | `PI_MCP_ADAPTER_ROOT=<5.2.0> TMPDIR=/var/tmp/<dir> node tests/live-uat/mcp-adapter-canary.mjs` (exit read directly, never through a pipe) plus the negative control | ✅ | ✅ green |
| docs | 07-03, 07-05 | 2–4 | ADOC-01 | — | N/A | lint + review | `SKIP=npm-check pre-commit run --files <docs>` | ✅ | ✅ green |
| changelog | 07-03 | 2 | ADOC-03 | — | N/A | grep | `grep -n "mcp-adapter.json" CHANGELOG.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/live-uat/mcp-adapter-canary.mjs` — covers ADOC-02
- [x] the seed fixture captured from 0.19.2 — covers ADOC-02 legacy migration
- [x] `tests/live-uat/openai-stub-server.mjs` scripted tool-call mode — covers D-07-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docs accuracy against shipped behavior | ADOC-01 | prose review | Compare each doc section with the phase 1–6 CONTEXT decisions and the canary output |
| Version bump offered before the PR | ADOC-03 | operator decision at PR time | Offer 0.20.0 (D-07-11) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-09

## Validation Audit 2026-10-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
