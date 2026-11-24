---
phase: "7"
slug: "path-source-dependency-tags"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-21"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (behavioral); `node:test` for the trimmed integration file |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile <adapter\|builtin> --parallel 2 features/plugin/install-dependencies.feature`, `$S` being the shared scratchpad of the plan's execution rules |
| **Full suite command** | `npm run check` (the wave's post-merge gate on the combined tree) |
| **Estimated runtime** | 4 to 17 seconds per focused run at `--parallel 2` (measured by the planner: `install-dependencies.feature` 14 to 17 s under adapter and 4 s under builtin, the 27 tag-only scenarios 9 to 12 s), more while the lock is held; `check:static` about 3 minutes from a cold ESLint cache; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** `features/plugin/install-dependencies.feature` under both profiles (Task 1 also the 27 tag-only scenarios), plus `npm run check:static` by hand in a worktree
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 120 seconds for a focused run without lock waits

---

## Per-Task Verification Map

Filled by the planner from `07-RESEARCH.md` "Phase Requirements → Test Map" and plan 07-01. The plan's "Red-proof tables" section holds the break runs and the scenarios each must fail; `check-red.mjs` (`$S/plan-07/inputs/`) checks them. Counts are under the adapter profile unless the row says builtin; both new scenarios are untagged, so the builtin profile selects only the file's one existing `@mcp` scenario (DUAL-02).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ITMIG-07 | T-07-01, T-07-02, T-07-03, T-07-05 | The tag step runs hermetic git against the loopback git host; the break is restored and never committed | behavioral (tracer) | `install-dependencies.feature` 60 passed, builtin 1 passed; the 27 tag-only scenarios pass; B1-tracer fails S1 on a `Then` (`check-red.mjs ... tracer-`); `check:static` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | ITMIG-07 | T-07-03 | Every copied file equals its frozen copy (`cmp`) | behavioral | `install-dependencies.feature` 61 passed, builtin 1 passed; `check:static` | ✅ | ✅ green |
| 07-01-03 | 01 | 1 | ITMIG-07 | T-07-01, T-07-04, T-07-06, T-07-07 | CR-01 is kept; every break is restored; the trim follows `RED-PROOFS OK` | break + checker + integration | B1 to B5 under adapter (`RED-PROOFS OK`, B5 the survivor); trimmed `path-source-tag-install` 2 passed, and B5 on it fails the two-member case; `check:static`; `fallow audit` shows only `weakened-tests` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

07-01's tracer task adds the marketplace-tag step in `marketplace/publishing.steps.ts` with a shared builder in `features/lib/git-marketplace.ts` that `features/lib/git-plugin.ts` also calls, and the tag tokens in `features/support/world.ts`. No separate wave.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-24

Audit evidence (current tree): `features/plugin/install-dependencies.feature:672` (S1, TAGS-01/TAGS-03), `:716` (S2, TAGS-02/D-07-03), and `:748` (local-git-folder marketplace tag variant) pass under adapter (`npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/install-dependencies.feature:672 features/plugin/install-dependencies.feature:716 features/plugin/install-dependencies.feature:748`, 3 passed); the file under builtin passes (1 passed); `node --import ./scripts/isolated-pi-home.mjs --test test/integration/path-source-tag-install.test.ts` passes 2/2 (CR-01 and the two-member git-state case). S2 moved from `:704` to `:716` after later work; it still covers the behavior. The deliberate breaks B1 to B5 are recorded in 07-01-SUMMARY.md and were not rerun.

## Validation Audit 2026-11-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
