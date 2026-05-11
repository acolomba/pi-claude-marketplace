---
phase: 07
slug: integration-pi-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 07 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` |
| **Config file** | none for test runner |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run check && npm run test:integration && npm run test:e2e` |
| **Estimated runtime** | TBD during Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run `npm test` or the smallest touched test file.
- **After every plan wave:** Run `npm run check`; waves touching integration/e2e also run their dedicated script.
- **Before `/gsd-verify-work`:** `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run` must be green.
- **Max feedback latency:** TBD during Wave 0.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-W0-01 | TBD | 0 | NFR-2 | T-07-04 | `/reload` discovery smoke does not invoke installed skill bodies or LLM turns. | e2e / smoke | `npm run test:e2e -- tests/e2e/resources-discover.test.ts` | no - W0 | pending |
| 07-W0-02 | TBD | 0 | NFR-3 | T-07-02 | Concurrent install loser rolls back without corrupting state or orphaning resources. | integration | `npm run test:integration -- tests/integration/concurrent-install.test.ts` | no - W0 | pending |
| 07-W0-03 | TBD | 0 | NFR-8 | - | Manifest-path reads route through one seam for future mtime caching. | architecture | `node --test tests/architecture/manifest-read-seam.test.ts` | no - W0 | pending |
| 07-W0-04 | TBD | 0 | NFR-11 | T-07-03 | Peer dependency floor and wrapper compile against `@mariozechner/pi-coding-agent@0.73.1`. | typecheck / package | `npm run typecheck && npm pack --dry-run` | no - W0 | pending |
| 07-W0-05 | 07-05 | 4 | NFR-2 / NFR-11 | T-07-04 | Real Pi runtime loads the extension under isolated HOME/cwd; Layer A mock coverage alone is not accepted. | e2e / subprocess smoke | `PI_CM_E2E_REF=pinned node --test tests/e2e/pi-runtime-smoke.test.ts` | no - W0 | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/discover.test.ts` - covers `resources_discover` aggregation and SK-5 behavior.
- [ ] `tests/architecture/manifest-read-seam.test.ts` - covers the NFR-8 manifest read seam.
- [ ] `tests/integration/concurrent-install.test.ts` - covers the NFR-3 live race.
- [ ] `tests/e2e/_pinned-sha.ts`, `tests/e2e/_targets.ts`, and `tests/e2e/_fixtures/<sha>/` - cover NFR-2/NFR-11 live surface.
- [ ] `tests/e2e/pi-runtime-smoke.test.ts` - covers real Pi-runtime extension load with isolated HOME/cwd, or blocks validation sign-off until a manual smoke gate is recorded.
- [ ] Package scripts `test:e2e`, `test:e2e:nightly`, narrowed `test`, and PR/nightly workflows.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pi-runtime smoke fallback gate | NFR-2 / NFR-11 | Only applies if the executor proves the package bin cannot support noninteractive subprocess smoke. Layer A mock `ExtensionAPI` does not prove real Pi process loading. | Blocking gate: launch Pi with isolated `HOME` and a tmp cwd, load the local extension, run the smoke command group or reload/resources-discover path, confirm a non-error result, and record evidence in the plan summary before validation sign-off. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency measured during Wave 0.
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 proves coverage.
- [ ] Real Pi-runtime smoke is green via `tests/e2e/pi-runtime-smoke.test.ts`, or the blocking manual smoke gate above is completed and recorded; validation sign-off is blocked otherwise.

**Approval:** pending
