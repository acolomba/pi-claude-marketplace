---
phase: 07
slug: integration-pi-wiring
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| **Full suite command** | `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run` |
| **Estimated runtime** | Observed green during Plan 07-05 and Plan 07-06 executor runs; budget as a multi-minute phase gate rather than per-edit feedback. |

---

## Sampling Rate

- **After every task commit:** Run `npm test` or the smallest touched test file.
- **After every plan wave:** Run `npm run check`; waves touching integration/e2e also run their dedicated script.
- **Before `/gsd-verify-work`:** `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run` must be green.
- **Max feedback latency:** Per-task feedback uses targeted files or `npm test`; full phase feedback uses the multi-command gate and was observed green in Plan 07-05 and Plan 07-06 executor output.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-W0-01 | 07-05 | 0 / 4 | NFR-2 | T-07-04 | `/reload` discovery smoke does not invoke installed skill bodies or LLM turns. | e2e / smoke | `npm run test:e2e -- tests/e2e/resources-discover.test.ts` | yes - `tests/e2e/resources-discover.test.ts` | green |
| 07-W0-02 | 07-04 | 0 / 3 | NFR-3 | T-07-02 | Concurrent install loser rolls back without corrupting state or orphaning resources. | integration | `npm run test:integration -- tests/integration/concurrent-install.test.ts` | yes - `tests/integration/concurrent-install.test.ts` | green |
| 07-W0-03 | 07-02 | 0 / 1 | NFR-8 | - | Manifest-path reads route through one seam for future mtime caching. | architecture | `node --test tests/architecture/manifest-read-seam.test.ts` | yes - `tests/architecture/manifest-read-seam.test.ts` | green |
| 07-W0-04 | 07-01 / 07-05 | 0 / 1 / 4 | NFR-11 | T-07-03 | Peer dependency floor and wrapper compile against `@mariozechner/pi-coding-agent@0.73.1`. | typecheck / package | `npm run typecheck && npm pack --dry-run` | yes - `extensions/pi-claude-marketplace/platform/pi-api.ts`, `package.json`, `.github/workflows/ci.yml` | green |
| 07-W0-05 | 07-05 | 4 | NFR-2 / NFR-11 | T-07-04 | Real Pi runtime loads the extension under isolated HOME/cwd; Layer A mock coverage alone is not accepted. | e2e / subprocess smoke | `PI_CM_E2E_REF=pinned node --test tests/e2e/pi-runtime-smoke.test.ts` | yes - `tests/e2e/pi-runtime-smoke.test.ts` | green |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/discover.test.ts` - covers `resources_discover` aggregation and SK-5 behavior.
- [x] `tests/architecture/manifest-read-seam.test.ts` - covers the NFR-8 manifest read seam.
- [x] `tests/integration/concurrent-install.test.ts` - covers the NFR-3 live race.
- [x] `tests/e2e/_pinned-sha.ts`, `tests/e2e/_targets.ts`, and `tests/e2e/_fixtures/<sha>/` - cover NFR-2/NFR-11 live surface.
- [x] `tests/e2e/pi-runtime-smoke.test.ts` - covers real Pi-runtime extension load with isolated HOME/cwd; manual fallback gate not required.
- [x] Package scripts `test:e2e`, `test:e2e:nightly`, narrowed `test`, and PR/nightly workflows.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pi-runtime smoke fallback gate | NFR-2 / NFR-11 | Only applies if the executor proves the package bin cannot support noninteractive subprocess smoke. Layer A mock `ExtensionAPI` does not prove real Pi process loading. | Blocking gate: launch Pi with isolated `HOME` and a tmp cwd, load the local extension, run the smoke command group or reload/resources-discover path, confirm a non-error result, and record evidence in the plan summary before validation sign-off. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency observed during Wave 0 / executor runs: targeted task commands for edits, full multi-command gate for phase sign-off.
- [x] `nyquist_compliant: true` set in frontmatter after Wave 0 proves coverage.
- [x] Real Pi-runtime smoke is green via `tests/e2e/pi-runtime-smoke.test.ts`; blocking manual fallback gate not required.

**Approval:** complete - Plan 07-06 reran `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run` successfully after Plans 07-02 through 07-05 landed.
