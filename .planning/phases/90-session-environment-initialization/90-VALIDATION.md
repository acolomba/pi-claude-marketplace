---
phase: 90
slug: session-environment-initialization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, TS via native type stripping) |
| **Config file** | package.json `test` script |
| **Quick run command** | `node --test tests/<new-session-env-test-file>.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds full check; ~2 seconds single file |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file for the module touched
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | SENV-01..03, PENV-01 | — | env keys never clobber unrelated vars | unit | `node --test <file>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — node:test suite and `npm run check` are established; new test files follow the existing `tests/` layout.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live bash child sees the session vars | SENV-01..03 | End-to-end through a real Pi session's bash tool | In a live Pi session with the extension loaded: run `env \| grep -E 'CLAUDECODE\|CLAUDE_CODE_SESSION_ID\|CLAUDE_SESSION_ID'` via the bash tool; verify values; `/reload` and re-check freshness |
| PATH reflects installs/uninstalls after /reload | PENV-01 | Requires live install/uninstall + reload cycle | Install a plugin with a `bin/` dir, check `echo $PATH`; uninstall, `/reload`, re-check the entry is gone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
