---
phase: 31
slug: credential-subprocess-layer-auth
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-01
---

# Phase 31 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node 20+) |
| **Config file** | none |
| **Quick run command** | `node --test "tests/platform/git-credential.test.ts" "tests/architecture/no-shell-out.test.ts" "tests/architecture/no-credential-leak.test.ts"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | (gate) | `node:child_process` whitelist exact-match for `platform/git-credential.ts` | architecture | `node --test "tests/architecture/no-shell-out.test.ts"` | ✅ (needs amendment) | ⬜ pending |
| 31-01-02 | 01 | 1 | (gate) | `tests/platform/` tests discovered by `npm test` | integration | `npm test 2>&1 \| grep "tests/platform"` | ✅ (`package.json`) | ⬜ pending |
| 31-02-01 | 02 | 2 | AUTH-09 | No credential field in state write files; no password in Error constructors | architecture | `node --test "tests/architecture/no-credential-leak.test.ts"` | ❌ Wave 0 (NEW) | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-06 | `approve` writes credential to keychain via mock | unit | `node --test "tests/platform/git-credential.test.ts" -t "approve"` | ❌ Wave 0 (NEW) | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-06 | `approve` builds correct stdin attribute block | unit | `node --test "tests/platform/git-credential.test.ts" -t "attribute block"` | ❌ Wave 0 | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-08 | `fill` returns stored credential on hit | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill hit"` | ❌ Wave 0 | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-08 | `fill` returns null on miss (non-zero exit) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill miss exit"` | ❌ Wave 0 | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-08 | `fill` returns null on miss (empty stdout, exit 0) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill miss empty"` | ❌ Wave 0 | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-08 | `fill` returns null on ENOENT (git missing) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill ENOENT"` | ❌ Wave 0 | ⬜ pending |
| 31-02-02 | 02 | 2 | AUTH-08 | `fill` does not hang on missing stdin EOF | regression | `node --test "tests/platform/git-credential.test.ts" -t "stdin end"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/pi-claude-marketplace/platform/git-credential.ts` -- CredentialOps interface + DEFAULT_CREDENTIAL_OPS + fill/approve/reject
- [ ] `tests/helpers/credential-mock.ts` -- `makeMockCredentialOps` factory with in-memory Map store + call logs
- [ ] `tests/platform/git-credential.test.ts` -- unit tests against mock (all AUTH-06/AUTH-08 scenarios)
- [ ] `tests/architecture/no-credential-leak.test.ts` -- AUTH-09 architecture gate (no password in state writes or Error constructors)
- [ ] Amendment to `tests/architecture/no-shell-out.test.ts` -- narrow D-21 gate to whitelist `platform/git-credential.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real OS keychain round-trip | AUTH-06, AUTH-08 | Requires a configured git credential helper and real keychain access | Set `PI_CM_REAL_GIT_CREDENTIAL=1`, run `node --test "tests/platform/git-credential.test.ts"`, verify the smoke test passes against real keychain |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
