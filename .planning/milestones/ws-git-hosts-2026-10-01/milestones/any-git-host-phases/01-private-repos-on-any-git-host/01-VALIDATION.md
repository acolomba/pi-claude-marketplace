---
phase: "01"
slug: "private-repos-on-any-git-host"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-28"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract, reconstructed after execution from the four PLAN/SUMMARY
> pairs, the re-verification in `01-VERIFICATION.md` and the completed `01-UAT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in runner), TypeScript run natively |
| **Config file** | none (scripts in `package.json`) |
| **Quick run command** | `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~10 s; full gate several minutes |

---

## Sampling Rate

- **After every task commit:** run the task's targeted `node --test` files
- **After every plan wave:** run `npm run check` (unpiped, exit code captured)
- **Before `/gsd-verify-work`:** full suite must be green
- **Max feedback latency:** ~10 s for targeted files

---

## Per-Task Verification Map

Threat refs point to each plan's `<threat_model>`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | GAUTH-03 | 01-01 threat model | Stored credential reaches only its own unregistered host | unit | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/domain/auth-registry.test.ts tests/architecture/no-credential-leak.test.ts` | ✅ | ✅ green |
| 01-01-02 | 01 | 1 | GAUTH-04 | 01-01 threat model | Credential miss names `git credential approve`, no credential in errors | unit | `node --test tests/orchestrators/marketplace/update.test.ts` | ✅ | ✅ green |
| 01-01-03 | 01 | 1 | GAUTH-03, GAUTH-05 | — | N/A | unit | `node --test tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/auth-host.test.ts` | ✅ | ✅ green |
| 01-02-01 | 02 | 2 | GAUTH-06 | 01-02 threat model | onAuth cancels a URL on another host (port included) before querying the helper | unit | `node --test tests/platform/git-auth-callbacks.test.ts tests/architecture/no-credential-leak.test.ts` | ✅ | ✅ green |
| 01-02-02 | 02 | 2 | GAUTH-06 | 01-02 threat model | Cancel sends no Authorization header at the transport | unit | `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/architecture/import-boundaries.test.ts` | ✅ | ✅ green |
| 01-03-01 | 03 | 3 | GAUTH-03 | — | Every plugin verb threads a host-keyed bundle | unit | `node --test tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts` | ✅ | ✅ green |
| 01-03-02 | 03 | 3 | GAUTH-03, GAUTH-05 | — | Handler surfaces carry auth on clone and fetch | unit | `node --test tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/plugin/bootstrap.test.ts` | ✅ | ✅ green |
| 01-04-01 | 04 | 4 | GAUTH-06 | 01-04 threat model | No credential header crosses an origin change on a redirect (info/refs leg: clone, fetch, resolveRemoteRef) | unit (wire) | `node --test tests/platform/git.test.ts` | ✅ | ✅ green |
| 01-04-01b | 04 | 4 | GAUTH-06 | 01-04 threat model; review WR-02 | No credential header crosses an origin change on a redirect of the authenticated git-upload-pack POST (307 and 302 to another port, http: same host, another host); same-origin 307 still authenticates | unit (wire) | `node --test tests/platform/git.test.ts` | ✅ | ✅ green (added by this audit) |
| 01-04-02 | 04 | 4 | GAUTH-06 | — | Origin normalization pinned; docstrings name the redirect guard | unit | `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-stale-test-citations.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts` | ✅ | ✅ green |
| 01-04-03 | 04 | 4 | all | — | Whole gate green | gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `git credential` helper resolves a non-registry host, and `marketplace add` of a private repo succeeds end to end (no helper: fails as `{authentication required}`) | GAUTH-03, GAUTH-04 | Every automated test injects `CredentialOps` through the memory fake; the shipped subprocess composition needs a real helper and a real remote | `01-UAT.md` tests 1-3: instrumented HTTPS server + `credential.helper=store` scoped via `GIT_CONFIG_*`, driven through pi RPC mode |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (targeted files)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-28

## Validation Audit 2026-09-28

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

The gap was review finding WR-02: no automated test redirected the credential-bearing
git-upload-pack POST across origins. Five wire-level `resolveRemoteRef` cases were added to
`tests/platform/git.test.ts` (commit `a2db444e`). Negative control: a scrub applied only to GET
hops turned the four cross-origin rows red and left the same-origin control green. `npm run
check` exit 0 after the addition.
