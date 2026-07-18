---
phase: 78
slug: plugin-git-source-lifecycle
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 78 — Validation Strategy

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
| 78-01-01 | 01 | 1 | PURL-05/06 | — | GC RED scaffold | tdd | `node --test tests/orchestrators/plugin/clone-gc.test.ts` (RED) | ❌ W0 | ⬜ pending |
| 78-01-02 | 01 | 1 | PURL-05/06 | T-78 containment | Deletes only via pluginCloneDir chokepoint; gitOps-token-free | tdd | `node --test tests/orchestrators/plugin/clone-gc.test.ts` + comment-stripped token gate | ❌ W0 | ⬜ pending |
| 78-02-01 | 02 | 1 | PURL-07 | — | canonicalCloneUrl pure extraction | unit | `node --test tests/orchestrators/plugin/clone-cache.test.ts` | ✅ | ⬜ pending |
| 78-02-02 | 02 | 1 | PURL-07 | — | resolveGitSubdirRoot relocation, install parity | unit | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/clone-cache.test.ts` | ✅ | ⬜ pending |
| 78-03-01 | 03 | 1 | PURL-08 | — | List/info RED for git rows | tdd | `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/info.test.ts` (RED) | ✅ | ⬜ pending |
| 78-03-02 | 03 | 1 | PURL-08 | — | List network-free; git rows render available | tdd | `node --test tests/orchestrators/plugin/list.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| 78-03-03 | 03 | 1 | PURL-08 | — | Info parity, zero git surface | unit | `node --test tests/orchestrators/plugin/info.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| 78-04-01 | 04 | 2 | PURL-05 | — | Uninstall GC RED | tdd | `node --test tests/orchestrators/plugin/uninstall.test.ts` (RED) | ✅ | ⬜ pending |
| 78-04-02 | 04 | 2 | PURL-05 | — | Last-referencer GC; shared clone kept; fs-only | tdd | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| 78-05-01 | 05 | 2 | PURL-07 | — | Reinstall RED | tdd | `node --test tests/orchestrators/plugin/reinstall.test.ts` (RED) | ✅ | ⬜ pending |
| 78-05-02 | 05 | 2 | PURL-07 | — | Offline reinstall (clone+resolveRemoteRef throw); seam by name | tdd | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| 78-05-03 | 05 | 2 | PURL-07 | — | resolvedSha carry-forward | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ⬜ pending |
| 78-06-01 | 06 | 2 | PURL-06 | — | Update sha-change RED | tdd | `node --test tests/orchestrators/plugin/update.test.ts` (RED) | ✅ | ⬜ pending |
| 78-06-02 | 06 | 2 | PURL-06 | — | Materialize-before-swap; resolvedSha finalize; GC-after-swap | tdd | `node --test tests/orchestrators/plugin/update.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| 78-06-03 | 06 | 2 | PURL-06 | — | Version arrow v#old → v#new byte form | unit | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/clone-gc.test.ts` — new test scaffold for the GC helper (derive live keys from state, delete unreferenced dirs, keep referenced, idempotent re-run)

Existing infrastructure covers everything else. Hard offline test: reinstall must pass with a GitOps stub whose `clone`/`resolveRemoteRef` THROW (warm cache) — the mock already exposes `cloneThrows`/`resolveRemoteRefThrows`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live update of a git plugin after upstream sha bump | PURL-06 | Needs a real remote whose manifest sha changed | Bump/point a marketplace manifest at a new sha, run `update`, confirm swap + old clone GC'd |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11
