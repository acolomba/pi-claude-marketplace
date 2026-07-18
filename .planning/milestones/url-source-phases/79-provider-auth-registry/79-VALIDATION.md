---
phase: 79
slug: provider-auth-registry
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node >= 20.19.0) |
| **Config file** | package.json `test` script |
| **Quick run command** | `npm test` (or targeted `node --test <file>`) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the changed test file via `node --test`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled after plan creation) | — | — | PROV-01..05 | credential leak | No credential in any output path; byte-identical github flow | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the phase. Byte-identity proof: the three existing
github auth tests MUST stay green UNCHANGED. The `no-credential-leak` architecture
gate must enumerate every new provider file (PROV-05).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live device flow against a real private github repo | PROV-03 | Needs a real GitHub account + private repo + interactive browser step | Add/install from a private github repo, complete the device flow, confirm credential stored host-keyed and clone succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11
