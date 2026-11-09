---
phase: "16"
slug: "background-child-load"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (behavioral) and `node:test` (existing unit pairs) |
| **Config file** | `cucumber.json` (frozen); profiles `adapter` and `builtin` |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 2 --format progress features/plugin/subagent-child.feature` |
| **Full suite command** | `npm run check` (background, output and exit code to files, never piped) |
| **Estimated runtime** | ~45 seconds quick; ~10 minutes full under load |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (the commit hook runs `check:commit`, which includes `check:features`).
- **After every plan wave:** Run the parts of `npm run check` in order (`check:static`, `test:unpaired`, `test:integration`, both cucumber profiles with `--parallel 3`, `test:coverage:direct:all`).
- **Before `/gsd-verify-work`:** Full `npm run check` and `npm run test:modules` must be green.
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CHILD-01 | — | a child installs, uninstalls, and updates nothing | behavioral | quick run, `--name "autoapply"` | ✅ (seed) | ⬜ pending |
| 16-01-02 | 01 | 1 | CHILD-02 | — | a child moves no legacy `mcp.json` entry | behavioral | quick run, `--name "mcp.json"` | ❌ to add | ⬜ pending |
| 16-01-03 | 01 | 1 | CHILD-02 | — | a child still offers skills and slash commands | behavioral | quick run, `--name "skill"` | ❌ to add | ⬜ pending |
| 16-01-04 | 01 | 1 | CHILD-02 | — | a child still runs a PreToolUse hook | behavioral | quick run, `--name "PreToolUse"` | ❌ to add | ⬜ pending |
| 16-01-05 | 01 | 1 | CHILD-02 | — | a child rewrites no agent grant | behavioral | `npx cucumber-js --profile adapter --format progress --name "leaves an agent's grant in the form it holds" features/mcp-server/agent-grants.feature` | ✅ (unowned) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
