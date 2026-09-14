---
phase: "3"
slug: "dependency-resolution"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in test runner) |
| **Config file** | none — plain `node --test` over `tests/**/*.test.ts` |
| **Quick run command** | `node --test <specific test file(s)>` |
| **Full suite command** | `npm test` (unit) + `npm run test:integration` |
| **Estimated runtime** | seconds for a targeted file; minutes for the full suite |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command(s) — direct-owner
  test file(s) for the module(s) that task touched.
- **After every plan wave:** Run the full `npm test` unit suite.
- **Before `/gsd-verify-work`:** `npm run check` (typecheck + lint + fallow + format:check +
  unit + integration) must be green.
- **Max feedback latency:** under 60 seconds for a single targeted test file.

---

## Per-Task Verification Map

*Populated by the planner from PLAN.md task `<verify><automated>` entries. Left as template
until PLAN.md files exist.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New leaf modules this phase introduces (cross-manifest range intersection,
  git-tag range resolution, the multi-plugin cascade orchestrator, the path-stack +
  visited-memo cycle walk) each need their own mirrored test file per the project's
  1:1 source↔test correspondence gate (`npm run test:corresponding`) — Wave 0 stubs
  are one option if the planner sequences tests ahead of implementation.

*Existing infrastructure (`node:test`, `npm run check` gate chain) covers all phase
requirements — no new framework or fixture installation needed.*

---

## Manual-Only Verifications

*If none: "All phase behaviors have automated verification."*

All phase behaviors have automated verification. No real-world dependency
fixtures exist to exercise against a live marketplace (per REQUIREMENTS.md
Planning Notes — RESV/PROV test data is necessarily synthetic), so synthetic
fixtures are the only verification path regardless of automation.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
