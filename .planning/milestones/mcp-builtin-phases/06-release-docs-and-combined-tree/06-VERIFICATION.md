---
phase: 06-release-docs-and-combined-tree
verified: 2026-11-05T04:35:00Z
status: passed
score: 4/4 must-haves verified
covered_files: [".agents/skills/cucumber/rules/layout.md",".agents/skills/cucumber/rules/world-and-stand-ins.md",".fallowrc.json",".planning/phases/06-release-docs-and-combined-tree/06-01-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-01-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-02-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-02-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-03-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-03-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-04-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-04-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-05-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-05-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-06-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-06-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-07-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-07-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-08-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-08-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-09-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-09-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-10-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-10-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-11-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-11-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-12-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-12-SUMMARY.md",".planning/phases/06-release-docs-and-combined-tree/06-13-PLAN.md",".planning/phases/06-release-docs-and-combined-tree/06-13-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/hooks-compatibility.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/mcp/substitute.ts","extensions/pi-claude-marketplace/edge/completions/data.ts","extensions/pi-claude-marketplace/edge/register.ts","extensions/pi-claude-marketplace/orchestrators/edge-deps.ts","extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts","extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts","extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts","extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts","extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts","extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts","extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/completion-cache.ts","features/lib/plugin-completions.ts","features/lib/turn-records.ts","features/lib/upstream/tool-search.ts","features/mcp-server/agent-grants.feature","features/mcp-server/implementation-switch.feature","features/mcp-server/lifecycle.feature","features/mcp-server/verdict-list.feature","features/step_definitions/completion.steps.ts","features/step_definitions/mcp-server/builtin-tool-search.steps.ts","test/architecture/background-update-notice.test.ts","test/architecture/catalog-uat/catalog-contract.test.ts","test/architecture/catalog-uat/fixtures/plugin-info.ts","test/architecture/closed-set-enrollment.test.ts","test/architecture/cross-surface-reason-parity.test.ts","test/architecture/flag-catalog-drift.test.ts","test/architecture/gate-targets.ts","test/architecture/manifest-lookup-drift.test.ts","test/architecture/manifest-read-agreement.test.ts","test/architecture/mcp-migration-notice.test.ts","test/architecture/workflows-marker-coverage.test.ts","test/bridges/mcp/substitute.test.ts","test/edge/completions/data.test.ts","test/edge/completions/provider.test.ts","test/edge/register.test.ts","test/index.test.ts","test/integration/adapter-expansion-conformance.test.ts","test/integration/marketplace-add-seed-mirrors.test.ts","test/orchestrators/auth-host.test.ts","test/orchestrators/edge-deps.test.ts","test/orchestrators/import/execute.test.ts","test/orchestrators/marketplace/background-pass.test.ts","test/orchestrators/mcp/agent-grants-step.test.ts","test/orchestrators/mcp/builtin-registration-step.test.ts","test/orchestrators/mcp/recorded-servers.test.ts","test/orchestrators/plugin/enable-disable.test.ts","test/orchestrators/plugin/git-source-probe.test.ts","test/orchestrators/plugin/install-cascade.messaging.test.ts","test/orchestrators/plugin/install-cascade.test.ts","test/orchestrators/plugin/install-flow-fixture.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/install-flow-results.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/list-flow.test.ts","test/orchestrators/plugin/list-installed-row.test.ts","test/orchestrators/plugin/mcp-verdict-read.test.ts","test/orchestrators/plugin/plugin-state-classifier.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/reinstall.messaging.test.ts","test/orchestrators/plugin/update-cascade.test.ts","test/orchestrators/plugin/update-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/orchestrators/reconcile/apply.test.ts","test/orchestrators/reconcile/pending.test.ts","test/platform/pi-api.test.ts","test/shared/completion-cache.test.ts","test/shared/concerns/soft-dep.test.ts","test/shared/notification-dispatch.test.ts","test/shared/notification-resolve.test.ts","test/shared/notification-run-seeds.ts","test/shared/notification-run.test.ts","test/shared/notification-summary.test.ts","test/shared/notify-reasons.test.ts"]
covered_digest: "v4:sha256:986cd32f7d1b5d56465c185fc1cfa330d542e949b2a04485f0a7b0a14f95505b"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 6: Release Docs and Combined Tree Verification Report

**Phase Goal:** The combined milestone tree is ready to ship: the CHANGELOG and READMEs describe built-in MCP support, the three `requires` markers, and the naming divergence; closed sets hold no unused entry; and every MCP feature and the switch scenario pass under both profiles after the last merge.
**Verified:** 2026-11-05
**Status:** passed
**Re-verification:** No, initial verification
**Tree:** `features/mcp-builtin`, HEAD `2b6f2f4`. Its build inputs equal those of `71a37c4` (it differs only in `.planning/**/*.md`; confirmed with `git diff 71a37c4 HEAD -- . ':(exclude,glob).planning/**/*.md'`, which prints nothing).

## Goal Achievement

### Observable Truths (the four ROADMAP Phase 6 success criteria)

| #   | Truth                                                                                                                                                              | Status     | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 1   | CHANGELOG, README.md, README.es.md, and docs/hooks-compatibility.md describe built-in MCP support, the three `requires` markers, and the `-` to `_` divergence (MDOC-02) | VERIFIED   | See criterion 1 below. Each statement found by grep in the file that D-P6-02/D-P6-03 assigns it to. |
| 2   | The switch scenario reaches the server under the adapter, shows `{requires mcp}` with no implementation, reaches it under built-in, then under the adapter again, with no plugin command between (DUAL-04) | VERIFIED   | `features/mcp-server/implementation-switch.feature:50-127`. I ran it on HEAD under the adapter profile: `1 scenario (1 passed)`, 34 steps, seed 609858. Red proof on `d1711fd` is in 06-01-SUMMARY (fails at the `requires mcp` row). |
| 3   | On the combined tree `npm run check`, both cucumber profiles, and `npm run test:modules` pass; `npx fallow dupes` reports no unreviewed clone group; CI behavioral jobs finish within their timeouts | VERIFIED (CI re-run on 2b6f2f4 pending, parent records it) | See criterion 3 below. |
| 4   | Every child's parent lines are applied, no closed-set entry remains that the combined tree never emits, and the phase dubious-choice logs are merged into the root log | VERIFIED (with caveat on "merged", see Dubious Choices) | See criterion 4 below. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Criterion 1: documentation (MDOC-02)

| File | Built-in MCP support | Three `requires` markers | What the adapter adds / how to enable | `-` to `_` divergence |
| ---- | -------------------- | ------------------------ | ------------------------------------- | --------------------- |
| `CHANGELOG.md` `[Unreleased]` | line 5, 8 | line 11 (`{requires mcp}`, `{requires builtin mcp}`, `{requires pi-mcp-adapter}`) | line 9 (turn on built-in MCP or install pi-mcp-adapter; adapter runs when both load) | lines 22-23 (server `-` kept, tool segment `-` to `_`, 64-character cut to 55 plus hash) |
| `README.md` | lines 29, 40, `### MCP implementations` at 159-163 | table at lines 183-185, each with a remedy | line 163; seven "adapter adds" bullets at 167-175 | line 126 and the `my-db` row at 132 |
| `README.es.md` | same structure | table at lines 183-185 | line 163; seven bullets 167-175 | line 126, row at 132 |
| `docs/hooks-compatibility.md` | line 148 | not described (D-P6-03 scopes this file to the divergence and the proxy rule) | not described | lines 119-120, 144, 148 (`mcp__echo-server__echo_text`, first 55 characters plus hash) |

- All eight link targets the READMEs cite exist as headings: `#choosing-an-implementation` (mcp-compatibility.md:17), `#name-length` (110), `#tool-search` (77), `#partially-available-plugins` (298), `#user-overrides` (330), `#server-status-in-info` (525), `#project-scope-servers` (139), `#tool-search-and-mcp` (207), and `#tool-name-mapping` (hooks-compatibility.md:129).
- README.md and README.es.md both have 541 lines. The WR-01 review fix (4ef28fa) corrected the `{requires builtin mcp}` remedy to "remove pi-mcp-adapter first, then turn on built-in MCP".
- The `docs/output-catalog.md` and `docs/json-output.md` literals changed with their fixtures (06-07); `test:unpaired` ran green in the gate.

### Criterion 2: DUAL-04 switch scenario

Scenario "A plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with no plugin command (MSEL-02, MSEL-03, D-MB-01, DUAL-04)", tagged `@own-implementation`:

1. Install `demo@fixtures`, start with pi-mcp-adapter, model calls the `mcp` proxy and gets `echo:ping` (steps 59-78).
2. `restarts pi without pi-mcp-adapter`: no results, no extension error (79-81).
3. `/claude:plugin list` reads `demo@fixtures` `installed` with reason `requires mcp` (83-94); no registered server, no plugin tool offered (95-99).
4. `restarts pi with pi's built-in mcp turned on`: built-in lists the stub's tools, the model reaches `echo:ping` through `tool_search` and the direct tool (100-114).
5. `restarts pi with pi-mcp-adapter`: the adapter lists the tools, nothing registered with built-in, the model reaches `echo:ping` through `mcp` again (115-127).

No plugin command that changes state runs between the restarts. The only command between them is the read-only `list` (see Dubious Choices, item 2).

### Criterion 3: combined-tree gate

| Check | Evidence | Status |
| ----- | -------- | ------ |
| `npm run check` | `fix-gate.log`, exit 0 on `71a37c4`: adapter `1603 scenarios (1603 passed)`, builtin `133 scenarios (133 passed)`, direct coverage merged (350 records) | PASS (gate evidence from parent; I read the log tail, not re-ran) |
| `npm run test:modules` | `fix-modules.log`, exit 0 on `2b6f2f4` | PASS (read from log) |
| Fresh-cache gate and e2e before the review fixes | plan 06-12 on `a7f73bf` (SUMMARY gate record), both e2e parts exit 0 | PASS (read from SUMMARY) |
| `npx fallow dupes --fail-on-issues --format human --quiet` | I ran it on HEAD: exit 0, empty output | PASS |
| Switch scenario, adapter profile | I ran it on HEAD: 1 passed | PASS |
| CI run 41960058038 (workflow_dispatch, head `1bec91e`) | `gh run view`: conclusion success, all 9 jobs success. Job durations from `startedAt` to `completedAt`: lifecycle 3 min 20 s, components 4 min 35 s, builtin all 2 min 56 s, pinned e2e 57 s | PASS |
| Timeouts | `ci.yml:133` `timeout-minutes: 15` per behavioral leg. Slowest leg 4 min 35 s; 1.5 times is 6 min 53 s, so the D-CF1-16 rule (as D-P6-25 applies it) keeps 15. PROJECT.md row D-CF1-16 (line 1936) carries the run id | PASS |
| CI re-run on `2b6f2f4` | run 41967152313 `in_progress` when checked | PENDING, parent records the result |

The CI run was on `1bec91e`, which predates the review-fix commits. Ten non-planning files differ between `1bec91e` and HEAD (README.md, README.es.md, `orchestrators/edge-deps.ts`, `list-installed-row.ts`, `plugin-state-classifier.ts`, `shared/completion-cache.ts`, and four tests). The local full gate on `71a37c4` covers those changes (adapter 1603/1603, builtin 133/133), and the new CI run on `2b6f2f4` closes the gap.

### Criterion 4: parent lines, closed sets, dubious-choice logs

- **Parent lines:** `06-PARENT-LINES.md` `## Dispositions` has 118 rows. None is unresolved. Three rows are "left for the user" by design: PL-05 (PR number waits for the pull request, D-P6-17), PL-07 (D-MB-08 to D-MB-13 stay Pending, D-P6-13), PL-92 (Phase 2 manual checks, listed in the root log). D-CF1-16 in PROJECT.md was amended with the 2026-11-05 measurement.
- **Closed sets:** the six candidate entries each have a production emitter and an observing scenario (06-07-SUMMARY table; I spot-checked `soft-dep.ts` `COMPANION_ANY_MCP`, `COMPANION_BUILTIN_MCP`, `mcpDependencyMarker`, and the two `requires` members at `notification-types.ts:298-299`). The unused-export side is also clean: `.fallowrc.json` now has one `entry` (`extensions/pi-claude-marketplace/index.ts`) and no `ignoreExports` key, the frozen modules are consumed (`domain/mcp-implementation` and `orchestrators/mcp/recorded-servers` are imported by `orchestrators/plugin/*`), and `npm run fallow` passed in the gate. The codebase maps (STACK.md, CONVENTIONS.md) were updated to match.
- **Dubious-choice logs:** `.planning/DUBIOUS-CHOICES.md` (1794 lines) is the new root log, with `## Decisions waiting on you` first (31 High mentions) and the previous milestone's log archived at `.planning/milestones/component-features-DUBIOUS-CHOICES.md`. See Dubious Choices, item 4, for what "merged" means here.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `CHANGELOG.md` | one milestone lead bullet with MCP sub-bullets | VERIFIED | lines 5-24 |
| `README.md`, `README.es.md` | MCP implementations section, marker table, naming table | VERIFIED | lines 126-185, mirrored |
| `docs/hooks-compatibility.md` | built-in tool-name divergence, proxy rule scope | VERIFIED | lines 119-120, 144-150 |
| `docs/mcp-compatibility.md` | built-in column and anchors the READMEs link | VERIFIED | all anchors present |
| `features/mcp-server/implementation-switch.feature` | DUAL-04 scenario with the `requires mcp` read | VERIFIED | passes, red proof recorded |
| `.planning/DUBIOUS-CHOICES.md` | root log with review list | VERIFIED | present, 1794 lines |
| `.planning/phases/06-.../06-CI-HANDOFF.md` | handoff with CI timings | VERIFIED | `## CI timings` filled for run 41960058038 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MDOC-02 | 06-06, 06-07, 06-10, 06-12, 06-13 | CHANGELOG, README, `README.es.md`, `docs/hooks-compatibility.md` describe built-in MCP, the three markers, the naming divergence; docs say to turn on built-in MCP or install pi-mcp-adapter and list what the adapter adds | SATISFIED | Criterion 1 table |
| DUAL-04 | 06-01, 06-12, 06-13 | Switch scenario, four stages, no plugin command between | SATISFIED | Criterion 2; scenario passes on HEAD |
| MGRT-01 | 06-02 | catalog-move grant staging | SATISFIED (Phase 4 ID, marked Complete in REQUIREMENTS.md) | cross-checked, mapped to Phase 4 |
| MREC-03 | 06-03 | completions follow the active implementation | SATISFIED (Phase 3 ID, Complete) | review fixes WR-02, IN-03 applied |
| BLT-01, BLT-02 | 06-04, 06-05 | built-in registration and values | SATISFIED (Phase 2 IDs, Complete) | builtin profile 133/133 |
| MREC-02 | 06-08 | legacy-record materialization | SATISFIED (Phase 2 ID, Complete) | `implementation-switch.feature:9` runs under both profiles |
| MSEL-01 | 06-09 | one active implementation | SATISFIED (Phase 1 ID, Complete) | `piMcpAdapterLoaded` removal, gate green |
| DUAL-01, DUAL-03 | 06-11, 06-12 | profiles and CI timeouts | SATISFIED (Phase 1 IDs, Complete) | CI run 41960058038 |

Every ID in the plan frontmatter is defined in REQUIREMENTS.md. The phase's own IDs (MDOC-02, DUAL-04) are mapped to Phase 6 there. No orphaned requirement: REQUIREMENTS.md maps only MDOC-02 and DUAL-04 to Phase 6, and both appear in plans. REQUIREMENTS.md still shows both as `[ ]` and `Pending` (lines 123, 129, 180, 182); the orchestrator flips them after this verification.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, or `XXX` marker was added in any non-planning file changed since `37f1cfd` (90 files). The code review (`06-REVIEW.md`) ended with 0 warnings and 8 info items after the fixes; the fix scope excluded info items, so IN-01, IN-02, IN-04 to IN-09 stay deferred (`06-REVIEW-DISPOSITION.md`).

### Human Verification Required

None for the goal. Not part of this verification: the user's review of the root log and of the Pending D-MB-08 to D-MB-13 rows, the version bump, and the pull request (D-P6-17).

### Gaps Summary

No gaps. Open bookkeeping for the parent: record the CI result of run 41967152313 (head `2b6f2f4`), and flip MDOC-02 and DUAL-04 to Complete in REQUIREMENTS.md.

### Dubious Choices

| # | Choice | Alternatives | Why dubious | Severity |
| - | ------ | ------------ | ----------- | -------- |
| 1 | Criterion 1 is met per file by D-P6-02/D-P6-03 allocation: the markers and the adapter-adds list live in both READMEs and the CHANGELOG (markers only); `docs/hooks-compatibility.md` covers only built-in support and the naming divergence | Add a marker paragraph to the hooks doc and an adapter-adds list to the CHANGELOG | The ROADMAP wording lists four files against one sentence. A strict per-file reading would fail the hooks doc and the CHANGELOG | Low |
| 2 | DUAL-04 "no plugin command in between" is met with a read-only `/claude:plugin list` between the adapter removal and the built-in restart (D-P6-18) | Read the marker through the LLM tool in a model turn, or from the load report | `list` is a `/claude:plugin` command. It changes no state and uses no network, so it cannot cause the switch, but a literal reading of the requirement would reject it | Medium |
| 3 | The switch scenario is `@own-implementation` without `@mcp`, so it runs in the adapter profile legs only. The builtin profile selects `(@mcp or @builtin-only) and not @adapter-only` and ran 0 scenarios for it when I tried | Tag it `@mcp` so both profile legs run it | The goal sentence says the switch scenario passes under both profiles. The scenario picks its own implementations, so one profile run proves it, but the builtin profile never executes it | Low |
| 4 | The root log is the parent working copy plus Phase 6 entries, not a union of the phase logs. About 150 Low entries (P2-DC-26.., P3-DC-25.., P4-DC-16.., P5-DC-21..) appear only in the phase logs, which the root log preface links | Copy every phase entry into the root log | ROADMAP criterion 4 says the logs are "merged". Every High and Medium entry is present and D-P6-14 chose this shape, but a user reviewing only the root log misses the Low entries | Low |
| 5 | CI timing evidence is from run 41960058038 on `1bec91e`, which predates ten non-planning file changes from the review fixes. The re-run on `2b6f2f4` (41967152313) was still running | Wait for the re-run before the verdict | The CI part of criterion 3 rests on a commit that is not HEAD. The local gate on `71a37c4` covers the fixed code | Low |
| 6 | REQUIREMENTS.md still marks MDOC-02 and DUAL-04 `Pending` | Flip them in the phase-closing commit | Bookkeeping only. The orchestrator owns it after verification | Low |
| 7 | Review info items IN-01, IN-02, IN-04 to IN-09 are deferred, among them phase-scoped IDs cited in code without a Key Decisions row (IN-02) and a CHANGELOG that names `install` and `update --partial` completion only (IN-04) | Fix them in this phase | Fix scope was Critical plus Warning. IN-02 and IN-04 are documentation gaps a reader could notice | Low |

---

_Verified: 2026-11-05_
_Verifier: Claude (gsd-verifier)_
