---
phase: "7"
slug: "git-errors-and-lock-discipline"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
audited: "2026-10-28"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Framework**          | node:test + @cucumber/cucumber                                   |
| **Config file**        | package.json scripts; cucumber.json                              |
| **Quick run command**  | `node --test <owner test>` + `npx cucumber-js --name <scenario>` |
| **Full suite command** | `npm run check`                                                  |
| **Estimated runtime**  | ~75 seconds (full)                                               |

---

## Sampling Rate

- **After every task commit:** Run owner tests + pre-commit check:commit
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement    | Threat Ref       | Secure Behavior                             | Test Type       | Automated Command                                                                                                                                                                               | File Exists | Status   |
| -------- | ----- | ---- | -------------- | ---------------- | ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| 07-01-T1 | 07-01 | 1    | GLK-01         | T-07-01, T-07-02 | frame only via redacted cause chain         | unit + cucumber | `node --test test/shared/git-failure-classifiers.test.ts`; `npx cucumber-js features/plugin/git-source.feature features/marketplace/url-source.feature features/marketplace/failed-add.feature` | ✅          | ✅ green |
| 07-01-T2 | 07-01 | 1    | GLK-01         | T-07-01          | marketplace update bytes unchanged          | unit + cucumber | `node --test test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/shared.test.ts`; `npx cucumber-js features/marketplace/url-source-update.feature`                     | ✅          | ✅ green |
| 07-02-T1 | 07-02 | 1    | GLK-03         | T-07-03          | GC refuses under a second holder            | unit + cucumber | `node --test test/orchestrators/plugin/clone-gc.test.ts test/orchestrators/plugin/uninstall.test.ts`                                                                                            | ✅          | ✅ green |
| 07-02-T2 | 07-02 | 1    | GLK-03         | T-07-03, T-07-04 | remove, apply, sweep collect under the lock | unit + cucumber | `node --test test/orchestrators/marketplace/remove.test.ts test/orchestrators/plugin/dependency-bindings.test.ts`                                                                               | ✅          | ✅ green |
| 07-02-T3 | 07-02 | 1    | GLK-03         | T-07-03          | unlocked GC unreachable (typecheck)         | static + unit   | `npm run typecheck && node --test test/orchestrators/plugin/clone-gc.test.ts`                                                                                                                   | ✅          | ✅ green |
| 07-03-T1 | 07-03 | 1    | GLK-06         | T-07-06          | same-ms rival refused (ST-9)                | unit            | `node --test --test-name-pattern 'GLK-06' test/orchestrators/plugin/update-swap.test.ts`                                                                                                        | ✅          | ✅ green |
| 07-03-T2 | 07-03 | 1    | GLK-06         | T-07-06          | finalize after mark; unparseable stamp      | unit            | `node --test test/orchestrators/plugin/update-swap.test.ts && npm run test:modules`                                                                                                             | ✅          | ✅ green |
| 07-04-T1 | 07-04 | 1    | GLK-08         | T-07-08          | tag read offline, no request                | unit + cucumber | `npx cucumber-js features/plugin/git-source-update.feature --name 'release tag reads the tag from the fetched copy'`                                                                            | ✅          | ✅ green |
| 07-04-T2 | 07-04 | 1    | GLK-08         | T-07-09          | non-commit tag is a miss                    | unit            | `node --test test/orchestrators/plugin/clone-cache.test.ts`                                                                                                                                     | ✅          | ✅ green |
| 07-05-T1 | 07-05 | 1    | GLK-07         | T-07-10          | completion offline, list rule               | unit            | `node --test test/orchestrators/edge-deps.test.ts test/architecture/manifest-lookup-drift.test.ts`                                                                                              | ✅          | ✅ green |
| 07-05-T2 | 07-05 | 1    | GLK-07         | —                | browse unchanged                            | unit            | `node --test test/orchestrators/edge-deps.test.ts test/edge/handlers/plugin/browse.test.ts`                                                                                                     | ✅          | ✅ green |
| 07-06-T1 | 07-06 | 2    | GLK-02         | T-07-11, T-07-12 | cascade cause redacted, reason truthful     | unit + cucumber | `node --test test/orchestrators/plugin/update-flow.test.ts`; `npx cucumber-js features/plugin/update-rollback.feature`                                                                          | ✅          | ✅ green |
| 07-06-T2 | 07-06 | 2    | GLK-01         | T-07-11          | refresh frame redacted                      | unit + cucumber | `npx cucumber-js features/plugin/url-marketplace-update.feature`                                                                                                                                | ✅          | ✅ green |
| 07-07-T1 | 07-07 | 2    | GLK-01         | T-07-14          | preflight frame redacted                    | unit + cucumber | `npx cucumber-js features/plugin/git-source-update.feature`                                                                                                                                     | ✅          | ✅ green |
| 07-07-T2 | 07-07 | 2    | GLK-04         | T-07-13          | tag copy only under lock                    | unit            | `node --test --test-name-pattern 'GLK-04' test/orchestrators/plugin/update-preflight.test.ts`                                                                                                   | ✅          | ✅ green |
| 07-08-T1 | 07-08 | 2    | GLK-01         | T-07-16, T-07-17 | fetch frame redacted; no git import         | unit + cucumber | `npx cucumber-js features/plugin/fetch.feature`                                                                                                                                                 | ✅          | ✅ green |
| 07-08-T2 | 07-08 | 2    | GLK-05, GLK-07 | T-07-15          | row read under lock                         | unit + cucumber | `node --test test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/operations.test.ts`                                                                                              | ✅          | ✅ green |
| 07-09-T1 | 07-09 | 2    | GLK-01         | T-07-19          | token only, no cause                        | unit + cucumber | `npx cucumber-js features/plugin/info.feature`                                                                                                                                                  | ✅          | ✅ green |
| 07-09-T2 | 07-09 | 2    | GLK-05         | T-07-18          | row read under lock                         | unit            | `node --test --test-name-pattern 'GLK-05\|GIT-03' test/orchestrators/plugin/info.test.ts`                                                                                                       | ✅          | ✅ green |
| 07-10-T1 | 07-10 | 3    | GLK-01         | T-07-20          | no URL or credential on the arm             | unit + cucumber | `node --test test/orchestrators/plugin/dependency-tag-probe.test.ts`; `npx cucumber-js features/plugin/git-source.feature`                                                                      | ✅          | ✅ green |
| 07-10-T2 | 07-10 | 3    | GLK-01         | T-07-21          | docs match behavior                         | architecture    | `node --test test/architecture/catalog-uat/catalog-contract.test.ts`                                                                                                                            | ✅          | ✅ green |

_Note: `npm run test:modules` failed once while cucumber ran in parallel and passed twice alone (concurrency flake class)._

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

All phase behaviors have automated verification. GLK-06's same-millisecond
invariant is deterministic under the unit test's controlled clock. GLK-07's
completion behavior is driven directly through the completion loader in
`test/orchestrators/edge-deps.test.ts`; it does not need a terminal-only manual
check.

---

## Fresh Revalidation Evidence — 2026-10-28

This audit re-read all ten plans and summaries, the four ROADMAP success
criteria, GLK-01 through GLK-08, D-PL7-01 through D-PL7-18, every threat row,
and the active production/test tree after Phases 8–11. No stale SUMMARY claim
was used as the only proof for a requirement.

| Requirement | Current automated proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Fresh result |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| GLK-01      | The classifier pair covers the complete ladder and its fixed wrappers. Active unit and Cucumber coverage reaches marketplace add/update, install/import/apply, direct/cascade update and preflight, fetch, info, reinstall, and constrained-dependency tag listing with each operation's 404/410 rule.                                                                                                                                                                                                       | green        |
| GLK-02      | `update-flow.test.ts` drives direct and converge/cascade failures through the shared ladder, including typed, errno, HTTP, and fallback arms; `update-rollback.feature` pins the public cascade rows.                                                                                                                                                                                                                                                                                                        | green        |
| GLK-03      | `clone-gc.test.ts` proves a second holder rejects both public locked boundaries without deleting. Uninstall, marketplace remove, and both dependency-sweep stages prove held-lock behavior at consumers. The unlocked bodies are module-private, and every active production GC reference resolves to `collectPluginClonesLocked` or `listUnreferencedPluginClonesLocked`; update, converge, reinstall, and apply tests separately prove their cleanup seam is reached and cleanup refusal remains hygienic. | green        |
| GLK-04      | `update-preflight.test.ts` observes the lock during the marketplace-tag copy and proves a second holder yields `lock held` before any copy.                                                                                                                                                                                                                                                                                                                                                                  | green        |
| GLK-05      | Fetch and info unit cases observe the scope lock during all unpinned row reads, prove pinned/bare arms stay unlocked, and cover lost/second-holder refusal. Their public feature files pass.                                                                                                                                                                                                                                                                                                                 | green        |
| GLK-06      | Four `update-swap.test.ts` cases prove same-millisecond overlap, finalize-after-mark, unparseable prior stamps, and the maximum-date fallback through a controlled clock.                                                                                                                                                                                                                                                                                                                                    | green        |
| GLK-07      | Fetch unit/Cucumber cases use `resolveListCandidate` for successful, failed, and skipped rows; completion cases drive the shared `upgradeCandidate` rule; browse's existing owner test remains green.                                                                                                                                                                                                                                                                                                        | green        |
| GLK-08      | `clone-cache.test.ts` proves local `refs/tags/<ref>` resolution, true cache-miss refresh, non-missing failures, and the no-ref arm; the warm-tag reinstall scenario observes zero git-host requests.                                                                                                                                                                                                                                                                                                         | green        |

### Commands Executed

| Command                                                                                                           | Result                                       |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `node --test test/shared/git-failure-classifiers.test.ts`                                                         | pass                                         |
| `node --test --test-name-pattern 'GLK-0[1-8]\|D-PL7-1[234]\|GIT-03'` over the 12 current Phase 7 owner test files | pass                                         |
| `npx cucumber-js` over the eight Phase 7 git/add/update/fetch/info feature files                                  | 92 scenarios, 1086 steps passed              |
| `npm run test:coverage:direct --` the nine classifier/lock/stamp/version/offline-tag owner sources                | pass, every pair at the direct-coverage gate |
| `npm run test:coverage:direct --` update-flow, reinstall-flow, apply, marketplace update/add, and import          | pass, every pair at the direct-coverage gate |

The first sandboxed Cucumber attempt could not bind its hermetic loopback git
host. A first direct-coverage attempt also blocked one Unix-socket fixture and
one FIFO fixture. The identical commands passed with only those local-fixture
permissions enabled; neither failure entered product code.

### Gap Disposition

No current automated coverage gap was found. No test or production file was
changed. The older Plan 02 note about not duplicating a held-lock case at every
default-bound consumer remains acceptable composition proof: the unlocked
bodies are unexported, all default bindings name the one tested locked export,
and separate consumer tests prove invocation and fail-clean handling. A test
that merely repeats the locked helper through each binding would add no new
behavioral seam.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 75s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** revalidated 2026-10-28

## Validation Audit 2026-10-28

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |
