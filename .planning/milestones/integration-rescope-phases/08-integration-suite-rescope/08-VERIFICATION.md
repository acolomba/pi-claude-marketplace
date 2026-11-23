---
phase: 08-integration-suite-rescope
verified: 2026-11-23T12:00:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".agents/skills/cucumber/SKILL.md"
  - ".agents/skills/typescript-unit-tests/SKILL.md"
  - ".planning/codebase/TESTING.md"
  - ".planning/phases/08-integration-suite-rescope/08-01-PLAN.md"
  - ".planning/phases/08-integration-suite-rescope/08-01-SUMMARY.md"
  - ".planning/phases/08-integration-suite-rescope/08-02-PLAN.md"
  - ".planning/phases/08-integration-suite-rescope/08-02-SUMMARY.md"
  - ".planning/phases/08-integration-suite-rescope/08-03-PLAN.md"
  - ".planning/phases/08-integration-suite-rescope/08-03-SUMMARY.md"
  - ".planning/phases/08-integration-suite-rescope/08-04-PLAN.md"
  - ".planning/phases/08-integration-suite-rescope/08-04-SUMMARY.md"
  - ".planning/phases/08-integration-suite-rescope/08-05-PLAN.md"
  - ".planning/phases/08-integration-suite-rescope/08-05-SUMMARY.md"
  - "docs/hooks-compatibility.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "features/mcp-server/project-scope.feature"
  - "test/bridges/mcp/builtin-entry.test.ts"
  - "test/integration/adapter-expansion-conformance.test.ts"
  - "test/integration/adapter-tool-name-conformance.test.ts"
  - "test/integration/agents-adapter-grant-conformance.test.ts"
  - "test/integration/agents-builtin-grant-conformance.test.ts"
  - "test/integration/auth-e2e.test.ts"
  - "test/integration/concurrent-install.test.ts"
  - "test/integration/hooks-dispatch-end-to-end.test.ts"
  - "test/integration/hooks-result-boundary.test.ts"
  - "test/integration/load-reconcile-race.test.ts"
  - "test/integration/marketplace-add-seed-mirrors.test.ts"
  - "test/integration/marketplace-layer-remove.test.ts"
  - "test/integration/mcp-adapter-entry-conformance.test.ts"
  - "test/integration/mcp-builtin-encoding-conformance.test.ts"
  - "test/integration/mcp-migration.test.ts"
  - "test/integration/mcp-server-records.test.ts"
  - "test/integration/mcp-status-conformance.test.ts"
  - "test/integration/mcp-verdict-list.test.ts"
  - "test/integration/mcp-verdict-migration.test.ts"
  - "test/integration/mcp-verdict-update.test.ts"
  - "test/integration/path-source-tag-install.test.ts"
  - "test/integration/pi-subagents-child-launch-conformance.test.ts"
  - "test/integration/plugin-layer-verbs.test.ts"
  - "test/integration/provenance-invisibility.test.ts"
  - "test/integration/skill-path-resolution.test.ts"
  - "test/integration/standalone-prune.test.ts"
  - "test/integration/subagent-hook-ownership.test.ts"
  - "test/integration/workflow-engine-agent-registry.test.ts"
  - "test/integration/workflow-kind-inversion.test.ts"
  - "test/orchestrators/reconcile/plan.test.ts"
covered_digest: "v4:sha256:518abf43f8e132ff07cd411fd894b6e6880ed67d193375b7f7f98682a30addbd"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Integration Suite Rescope Verification Report

**Phase Goal:** Every case left in `test/integration/` guards something that cucumber and the unit tests cannot reach, each remaining file says what it guards, the suite's charter is written down, and the combined tree passes `npm run check`.
**Verified:** 2026-11-23
**Status:** passed
**Re-verification:** No (initial verification)

HEAD `2b17290` differs from the gate tree `b9c0a04` only in `.planning/ROADMAP.md` and `08-05-SUMMARY.md` (`git diff --name-only b9c0a04 HEAD` prints no file outside `.planning/`). So the gate logs of `b9c0a04` apply to HEAD.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every case in `test/integration/` is peer conformance, multi-process, or internal (or kept under rule 4). Every other case moved to a unit pair or is gone because a scenario or unit test covers it. No helper in `test/integration/` is without an importer (ITSCOPE-01) | VERIFIED | 28 test files remain: the 19 untouched files that stay, plus the 9 that earlier phases trimmed. `reconcile-plan-convergence` and `transaction-lifecycle-cascade` are deleted (`771c4ec`, `1c17900`). `hooks-additionalcontext-end-to-end` is gone (Phase 6.1). Moves: 8 fixed points moved to `test/orchestrators/reconcile/plan.test.ts` (`771c4ec`: +191 lines in plan.test.ts, the 593-line integration file deleted). `plan-test.log` shows 71/71. 28 table rows moved to `test/bridges/mcp/builtin-entry.test.ts` (`7d76c64`). One case became an `@adapter-only` scenario in `features/mcp-server/project-scope.feature` (`f63bc50`). Each deletion has a recorded break that turned its cover red: B1 to B3 in 08-01-SUMMARY (unit `✖` titles), and B4, B5, B6a to B6c, B7, B7i, B7c in 08-02-SUMMARY (cucumber `Then`/`When` failures and unit `✖` titles). I read the case titles of every internal and multi-process file. Each fits its class: stored fields (`mcp-server-records`, `mcp-verdict-update`, `mcp-verdict-list`), earlier-release records with their stored fields asserted (`mcp-verdict-migration`, `workflow-kind-inversion`), fault injection (`marketplace-layer-remove`, `mcp-migration`, `auth-e2e`, `plugin-layer-verbs`, `hooks-dispatch-end-to-end`), calls or writes that must not happen (`standalone-prune`, `marketplace-add-seed-mirrors`, RECON-05), and multi-process (`concurrent-install`, `load-reconcile-race`, `subagent-hook-ownership`). Helper importers (grep): `concurrent-install-child`, `ipc-child`, `load-reconcile-race-child`, `mcp-plugin-seed` (6 importers), `optional-peer` (7), `optional-peer-suite-versions.json` (4), `pi-mcp-adapter-peer` (4), `pi-subagents-peer` (2). `test/bridges/mcp/expansion-cases.ts` is imported by two conformance files and two unit files. None is an orphan. |
| 2 | The opening comment of each remaining integration file names its class and the behavior that cucumber does not cover (ITSCOPE-02) | VERIFIED | All 28 files start with `// test/integration/<name>.test.ts` and have `(ITSCOPE-01)` in their first 30 lines (counted per file). I read every header. Each names its class (Peer conformance / multi-process / internal / fault injection / calls that must not happen) and says what cucumber cannot reach, with the covering feature files named. The carried overclaims are settled: `standalone-prune` now asserts the whole `gitCalls` object (lines 195, 236), and the `mcp-verdict-migration` header says its cases compare whole rendered text that the scenarios do not compare. Doc claims: `docs/hooks-compatibility.md` (`b9c0a04`) and `docs/mcp-compatibility.md` (`382ec65`) now say "read in source". `docs/output-catalog.md:695` points at `features/workflow/storage.feature`. No file outside `.planning/` names a deleted integration file. |
| 3 | The `typescript-unit-tests` skill, the `cucumber` skill, and `.planning/codebase/TESTING.md` each state the charter (ITSCOPE-03) | VERIFIED | `## Where a test goes` is at `.agents/skills/typescript-unit-tests/SKILL.md:26` and `.agents/skills/cucumber/SKILL.md:10`. The same list is nested under `**Integration Tests:**` at `.planning/codebase/TESTING.md:187-198`. I read all three: same text, 10 items (cucumber, unit pair, `test/architecture/`, the integration gate with its four classes: peer conformance, multi-process, internal, known bug; the header rule; the move-or-delete rule with a break). `charter-equality.log`: `rules=10 same-text=true`. |
| 4 | `npm run check` exits 0 on the combined tree, with both cucumber profiles green and 100% direct coverage for every source-test pair (ITSCOPE-04) | VERIFIED | `gate-pre.log`: `head=b9c0a04…`, `status=[]` (clean tree), node v24.22.3. `check-main.log` (check:static, test:unpaired, test:integration, test:cucumber, chained with `&&`): the 7 static `passed` lines, adapter `2285 scenarios (2285 passed)`, builtin `260 scenarios (260 passed)`, `main_exit=0`. `check-cov.log` (`test:coverage:direct:all`): `Merged LCOV: coverage/direct.lcov (376 records)`, `cov_exit=0`. `scripts/test-coverage-direct.mjs` calls `assertCompleteCoverage` for each pair and fails on a missing pair, so exit 0 means 100% for every pair. `integration.log`: `tests 236`, `pass 236`, `fail 0`. Splitting `npm run check` into two commands with the same five steps is equivalent (`package.json:92`). |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Accepted count change (orchestrator decision)

The plan expected 265 integration cases and 9 charter items. The review fixes changed these numbers on purpose:
- `7d76c64` moved 28 rows to the unit pair.
- `f63bc50` replaced 1 case with a scenario.
- `9403a1c` added the `test/architecture/` charter item.

`case-diff.log` shows that only `mcp-builtin-encoding-conformance` (7 to 5 calls) and `mcp-status-conformance` (3 to 2) changed their test-call counts after the Wave 1 merge. 265 - 28 - 1 = 236. Each change moves a case to a place the charter allows, so the success criteria are met with 236 cases and 10 items.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `test/orchestrators/reconcile/plan.test.ts` | the moved fixed points | VERIFIED | 71 tests pass. Its pair has 100% coverage through the all-pair gate |
| `test/bridges/mcp/builtin-entry.test.ts` | the moved written-as-is rows | VERIFIED | +101 lines in `7d76c64`. Its pair passes the gate |
| `features/mcp-server/project-scope.feature` | the ASTAT-01 overridden-row scenario | VERIFIED | +35 lines in `f63bc50`. The adapter profile is green |
| 28 `test/integration/*.test.ts` headers | class + not-in-cucumber statement | VERIFIED | see truth 2 |
| Charter in 3 files | same rule | VERIFIED | see truth 3 |
| Deleted: `reconcile-plan-convergence`, `transaction-lifecycle-cascade` | gone | VERIFIED | absent from `test/integration/`. No remaining references |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| integration helpers | test files | imports | WIRED | every helper has at least 1 importer (see truth 1) |
| `optional-peer-suite-versions.json` | `optional-peer.ts`, `scripts/install-test-peers.mjs`, `features/lib/companions.ts`, `test/architecture/gate-targets.ts` | reads | WIRED | |
| charter | `.agents/skills/cucumber/rules/world-and-stand-ins.md` | cross-reference | WIRED | cited in all three copies |

### Data-Flow Trace (Level 4)

Not applicable. The phase changes tests and docs only, and it renders no dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Gate tree equals HEAD outside `.planning/` | `git diff --name-only b9c0a04 HEAD \| grep -v '^\.planning/'` | empty | PASS |
| Each file has its class marker | count `(ITSCOPE-01)` in the head of each file | 28/28 | PASS |
| Helpers have importers | grep the importers of each helper | no orphan | PASS |
| No added debt markers | grep the added lines since `9aa92a1` for TBD/FIXME/XXX/TODO/HACK | none | PASS |

Per the instructions, I ran no test suite. The suite results come from the gate logs above.

### Probe Execution

No probe is declared, and no `scripts/*/tests/probe-*.sh` exists for this phase. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ITSCOPE-01 | 08-01, 08-02 (and 08-05 checks) | Every case left is conformance, multi-process, or internal; the others moved or were deleted | SATISFIED | truth 1 |
| ITSCOPE-02 | 08-02, 08-03 | The header names its class and what cucumber does not cover | SATISFIED | truth 2 |
| ITSCOPE-03 | 08-04 | The charter is in both skills and in TESTING.md | SATISFIED | truth 3 |
| ITSCOPE-04 | 08-05 | `npm run check` passes on the combined tree | SATISFIED | truth 4 |

No orphaned requirements: REQUIREMENTS.md maps only ITSCOPE-01..04 to Phase 8. Its checkboxes and traceability rows still read `Pending`. Milestone close updates them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `test/integration/standalone-prune.test.ts` | 195, 236 | fallow `weakened-tests` (assertions 16 -> 14) | Info (accepted) | Accepted by user decision for review at the PR. Several assertions became one whole-object `deepStrictEqual` of `gitCalls`, which is stronger, not weaker. `audit-phase.json`: verdict `warn`, dead code 0, complexity 0, clone groups 0 |
| `test/integration/adapter-expansion-conformance.test.ts` | row titles | review IN-04 (iter 3), still open: titles show the internal label `env-builtin` | Info | Cosmetic. Does not affect ITSCOPE-02 |
| `.planning/codebase/TESTING.md` | 66 | the dated block `Verified counts (2026-10-05)` still says `16 under test/integration/` | Info | Kept on purpose (CONTEXT [TESTING.md counts], 08-04 plan). The integration bullet itself no longer gives a count. A later codebase-map refresh should update the dated block |

No blocker or warning anti-patterns.

### Human Verification Required

None. The classification of each case (ITSCOPE-01) is a judgment, but it is backed by the research table, three review passes (0 open critical, 0 open warning per 08-REVIEW-DISPOSITION.md), and recorded red breaks for every deletion.

### Gaps Summary

No gaps. All four roadmap success criteria hold on HEAD:
- The suite has 28 files with 236 cases, all passing.
- Each file states its class.
- The charter is the same in all three places.
- The combined-tree gate at `b9c0a04` (the same tree as HEAD outside `.planning/`) passed every step of `npm run check`: both cucumber profiles were green, and all 376 direct-coverage pairs reached 100%.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_
