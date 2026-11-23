---
phase: "2"
slug: "git-process-seam-and-typed-failures"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-23"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict`; `@cucumber/cucumber` (profiles `adapter`, `builtin`) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git-process.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~30 seconds; full ~15 minutes |

---

## Sampling Rate

- **After every task commit:** owner tests and `npm run test:coverage:direct -- <source>` per touched pair; the hook runs `npm run check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** full suite green, then the manual macOS/Windows checkpoint
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Requirement-level map from `02-RESEARCH.md` "Validation Architecture"; the planner fills task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SG-PRC-01 | — | absolute git, argv array, no shell, closed stdin, `--end-of-options` table | unit + architecture | quick run; `npm run test:unpaired` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-PRC-02 | — | no prompt, no askpass, timeout kills the group | unit (real git on stand-ins) | quick run | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-PRC-03 | — | no repo hook/fsmonitor; refused protocols; repo pointers stripped; ceiling | unit (real git) | quick run | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-PRC-04 | — | local lane refuses the network under user `protocol.*.allow=always` | unit (real git) | quick run | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-PRC-05 | — | stderr corpus → kind; redaction | unit | `test/platform/git-failure-kind.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SG-PRC-06 | — | no git: git-source add/install fail with the message; path and hosted still work | cucumber | `npm run test:cucumber:profile -- --profile adapter <features>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/platform/process-run.test.ts`, `test/platform/git-process.test.ts`, `test/platform/git-failure-kind.test.ts`
- [ ] a zombie-ignoring process-group listing helper (test support)
- [ ] `usePiWithoutGit()` in the cucumber world and the new scenarios

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS xcrun-shim detection and message; Windows absolute-PATH lookup, tty, and process-tree kill | SG-PRC-02, SG-PRC-06 | CI and this sandbox run Linux only | steps in `02-RESEARCH.md` "Environment Availability" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
