---
phase: "2"
slug: "endpoints-that-answer-only-at-the-verbatim-url"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-26"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (no external test framework) |
| **Config file** | none — behavior driven by `npm run test` / `test:coverage:unit` script flags in `package.json` |
| **Quick run command** | `node --test tests/domain/clone-key.test.ts tests/orchestrators/plugin/clone-cache.test.ts` |
| **Full suite command** | `npm run check; echo "CHECK_EXIT=$?"` |
| **Estimated runtime** | ~600 seconds (full `check`); ~5 seconds (quick run) |

---

## Sampling Rate

- **After every task commit:** Run `node --test <the one or two files that task touched>`
- **After every plan wave:** Run `npm run test:coverage:direct && npm run test:coverage:unit`
- **Before `/gsd-verify-work`:** `npm run check` must be green (milestone-wide GATE-01, enforced at every phase boundary)
- **Max feedback latency:** 30 seconds for the per-task run

---

## Per-Task Verification Map

Seeded at plan time from the requirement→test map below; the per-task rows are filled by the
planner as it writes each task's `<automated>` verify block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MURL-08 | — | N/A | unit | `node --test tests/domain/clone-key.test.ts` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | MURL-08 | — | N/A | unit | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/marketplace/add.test.ts` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | MURL-09 | — | N/A | unit | call-count assertion `git.state.calls.clone.length === 1` per seam, success AND failure path | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | MURL-09 | — | Original error identity preserved (no 401/403/5xx rewrite) | unit | `node --test tests/shared/git-failure-classifiers.test.ts` plus new seam-level cases | ✅ | ⬜ pending |
| 02-01-05 | 01 | 1 | MURL-08 | — | N/A | integration | `node --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/plugin/fetch.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A call-count assertion of exactly one on the **failure** path for each clone-cache seam.
      Every existing failure-path test asserts only the thrown error, never
      `git.state.calls.*.length`. This is the SC3 regression guard and must be written, not
      assumed to exist.
- [ ] A fixture for a host that serves ONLY the verbatim (non-`.git`) path and 404s the `.git`
      form. `createGitOpsFake`'s `allowedRemoteUrls` already expresses this (allowlist the
      verbatim URL, omit the `.git` form) — no new fake capability, one new case per affected seam.
- [ ] The suites that currently pin the pre-phase `.git`-for-every-host wire URL must be rewritten
      as first-class task work, not as fallout: `add.test.ts:2344` and `clone-cache.test.ts:824`
      encode the old rule in their test NAMES under MURL-01 / PURL-09 and must be retitled, not
      edited under an unchanged name.
- [ ] Framework install: none — `node:test` is already the project's sole framework.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real smart-HTTP endpoint that answers only at the verbatim path | MURL-08 | Needs a live server configured to 404 the `.git` form; the offline fake proves the URL sent, not a real server's response | Point `marketplace add` at such an endpoint and confirm both the initial clone and a later `resolveRemoteRef` resolve |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
