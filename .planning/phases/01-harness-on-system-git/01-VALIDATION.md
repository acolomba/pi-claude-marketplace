---
phase: "1"
slug: "harness-on-system-git"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-23"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration), `@cucumber/cucumber` (behavioral) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/architecture/hermetic-git-environment.test.ts test/architecture/https-git-host-server.test.ts test/architecture/https-git-host-cgi.test.ts test/architecture/ssh-git-host.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~60 seconds; full ~15 minutes |

In this sandbox, prefix every command with `PATH="/opt/pi-claude-marketplace/bin:$PATH"` (Node 24 wrapper). See RESEARCH.md "Baseline gate result" for the known sandbox-only failures and the trimmed-environment gate command.

---

## Sampling Rate

- **After every task commit:** the pre-commit hook (`npm run check:commit`), plus the task's own owner test
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds for the quick command

---

## Per-Task Verification Map

The planner fills task IDs. Requirement-level map from RESEARCH.md:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SG-HRN-01 | — | N/A | unit | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | SG-HRN-01 | — | planted GIT_CONFIG_COUNT rewrite, CA, proxy, XDG_CONFIG_HOME never reach a suite git | architecture | quick run command | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-HRN-02 | — | N/A | architecture | quick run command | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-HRN-03 | path containment in stub | upload-pack path stays under the repositories root; unregistered host exits 255 | architecture | quick run command | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-HRN-04 | — | N/A | architecture | quick run command | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/architecture/ssh-git-host.test.ts` — argv table and real-git cases (SG-HRN-03)
- [ ] New cases in `test/architecture/https-git-host-server.test.ts` and `https-git-host-cgi.test.ts` (SG-HRN-02)
- [ ] New planted-leak cases in `test/architecture/hermetic-git-environment.test.ts` (SG-HRN-01, SG-HRN-04)

Frameworks are in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `git --version` appears in each test job's log | SG-HRN-04 | a workflow step has no local runner | read the PR's CI run logs for static, integration, behavioral, direct-coverage, e2e-tests, and e2e-nightly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
