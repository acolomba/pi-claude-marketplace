---
phase: "07"
slug: "marketplace-repo-tag-resolution"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-19"
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` + `node:assert/strict` |
| **Config file** | none — `npm test` globs `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts` (package.json:86) |
| **Quick run command** | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts` (plus new test file(s) this phase adds) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds (quick), several minutes (full — per prior-phase convention) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command, scoped to the files the task touched
- **After every plan wave:** Run `npm run check` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-* | 01 | 1 | TAGS-01 | T-07-01 | Only a tag carrying the dependency's own `{name}--v` prefix and a valid `semver` is selected | unit | `node --test tests/orchestrators/plugin/marketplace-tag-probe.test.ts` | ✅ created | ✅ green |
| 07-01-* | 01 | 1 | TAGS-01 | — | No network call for path-source resolution | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |
| 07-02-* | 02 | 2 | TAGS-02 | — | No matching tag → current copy installs, info-level row | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` (new cases) | ✅ | ✅ green |
| 07-02-* | 02 | 2 | TAGS-02 | — | New reason token is a closed-set member (COMPAT-01) | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |
| 07-01-* | 01 | 1 | TAGS-03 | T-07-03 | Path containment re-checked against the checked-out root, not the live marketplace root | unit + integration | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/install-outcome.test.ts` (new cases) | ✅ present | ✅ green |
| 07-01-* | 01 | 1 | TAGS-03 | T-07-02 | Materialized clone survives `clone-gc.ts`'s sweep after an unrelated uninstall (Pitfall 2 — `resolvedSha` must be stamped) | unit | `node --test tests/orchestrators/plugin/clone-gc.test.ts` | ✅ | ✅ green |
| 07-03-* | 03 | 3 | DIVG-01 | — | Docs state the `sha`-field divergence and new resolution behavior | manual / doc-lint | `docs/dependency-resolution.md` prose review | doc-only, no dedicated test | ✅ green |

*Status: ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/plugin/marketplace-tag-probe.test.ts` covers local tag selection and failures.
- [x] New test cases in `tests/orchestrators/plugin/install-cascade.test.ts`: a path-source member with a satisfying tag (pin attached, version recorded per D-07-02), and a path-source member with no satisfying tag (install proceeds, info note, NOT a `CascadeConstraintFailure`)
- [x] A regression test proving a tag-materialized `plugin-clones/<key>/` directory survives `clone-gc.ts`'s sweep (Pitfall 2)
- [x] Confirm whether `tests/orchestrators/plugin/clone-cache.test.ts` already has a pattern for testing `seedOnePluginMirror`-shaped functions the new materialize-at-tag function's tests should mirror

---

## Manual-Only Verifications

*All phase behaviors have automated verification, except DIVG-01's doc prose which is reviewed by reading, not run.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-24

## Validation Audit 2026-09-24

| Metric | Count |
| --- | ---: |
| Behavioral requirement gaps | 0 |
| New tests needed | 0 |
| Escalated | 0 |

The phase plans and summaries map every behavior to a named test. The current milestone run passed 7,760/7,760 unit tests and all 15 integration files. The corresponding source/test pairs, catalog contracts, and architecture guards remain active. The chain-wide `npm run check` still stops on the operator-owned `.planning/config.json` formatting drift; the test results above were run separately on the current tree.
