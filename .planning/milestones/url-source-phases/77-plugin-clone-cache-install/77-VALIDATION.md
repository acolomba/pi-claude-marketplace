---
phase: 77
slug: plugin-clone-cache-install
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node >= 20.19.0) |
| **Config file** | package.json `test` script |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (or the changed test file via `node --test`)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 77-01-01 | 01 | 1 | PURL-04 | — | Fixed-length hash key, no URL sanitization surface | unit | `node --test tests/domain/clone-key.test.ts tests/domain/version.test.ts` | ❌ W0 | ⬜ pending |
| 77-01-02 | 01 | 1 | PURL-04 | T-77 containment | SC-7 chokepoint for plugin-clones paths | unit | `node --test tests/persistence/locations.test.ts` | ✅ | ⬜ pending |
| 77-01-03 | 01 | 1 | PURL-09 | — | Additive resolvedSha field, legacy records load | unit | `node --test tests/persistence/state-io.test.ts` | ✅ | ⬜ pending |
| 77-01-04 | 01 | 1 | PURL-09 | — | sha-<12hex> display transform | unit | `node --test tests/domain/version.test.ts` | ✅ | ⬜ pending |
| 77-02-01 | 02 | 1 | PURL-01 | — | Discriminated installable union survives widening | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ | ⬜ pending |
| 77-02-02 | 02 | 1 | PURL-01, PURL-03 | T-77 escape | git-subdir containment anchored to clone root | unit | `node --test tests/domain/resolver-*.test.ts tests/domain/resolver.types.test.ts` | ✅ | ⬜ pending |
| 77-03-01 | 03 | 2 | PURL-02 | — | Staging + atomic rename, MA-9 append-leak | unit | `node --test tests/orchestrators/plugin/clone-cache.test.ts && npm run typecheck` | ❌ W0 | ⬜ pending |
| 77-03-02 | 03 | 2 | PURL-02, PURL-04 | — | Dedup EEXIST-tolerant, network guard green | unit | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/architecture/no-orchestrator-network.test.ts` | ❌ W0 | ⬜ pending |
| 77-04-01 | 04 | 3 | PURL-01, PURL-02 | — | install.ts stays gitOps-token-free | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 77-04-02 | 04 | 3 | PURL-09 | — | Git sources always record sha-<12hex> | unit | `node --test tests/orchestrators/plugin/install.test.ts tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 77-04-03 | 04 | 3 | all 5 | — | Full-suite integration | full | `node --test tests/architecture/no-orchestrator-network.test.ts && npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The architecture guard
`tests/architecture/no-orchestrator-network.test.ts` must stay green — the clone
seam lives outside install.ts (S-9 pattern), never inside it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live clone of a real public git plugin repo into the cache | PURL-02 | Network-dependent; unit tests mock the git layer | Install a url-source plugin from a real public repo; re-install a second plugin with the same url+sha and confirm no new clone; disconnect network and confirm warm-cache install succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11
