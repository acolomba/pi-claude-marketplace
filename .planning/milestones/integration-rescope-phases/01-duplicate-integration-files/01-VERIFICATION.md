---
phase: 01-duplicate-integration-files
verified: 2026-11-21T17:10:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/01-duplicate-integration-files/01-01-PLAN.md"
  - ".planning/phases/01-duplicate-integration-files/01-01-SUMMARY.md"
  - ".planning/phases/01-duplicate-integration-files/01-02-PLAN.md"
  - ".planning/phases/01-duplicate-integration-files/01-02-SUMMARY.md"
  - "docs/hooks-compatibility.md"
  - "docs/mcp-compatibility.md"
  - "features/lib/real-subagent-child.ts"
  - "features/plugin/subagent-child.feature"
  - "features/step_definitions/plugin/subagent-hooks.steps.ts"
covered_digest: "v4:sha256:3b5560e1aa7d254900cfdc271e7b4db638035586ac33cc8c0608a79a66c0ed3c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Duplicate Integration Files Verification Report

**Phase Goal:** The two integration files that only repeat cucumber scenarios are gone. Before each one goes, a deliberate break proves that the scenarios which replace it fail when its behavior breaks.
**Verified:** 2026-11-21T17:10:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 (ITDUP-01): breaking the SessionStart side effect fails a scenario, so does breaking hook spawning for a plugin whose `CLAUDE_PLUGIN_ROOT` lies outside the extension directory, the scenarios pass under both profiles, and `hooks-spawn-end-to-end.test.ts` is gone | ✓ VERIFIED | The file is absent (`ls` fails; the diff against base `f67fe6c9` shows 371 lines deleted). Break logs in `phase01-plan01/`: E1 (SessionStart dispatch removed, `event-router.ts`) ends `11 scenarios (4 passed, 7 failed)`, with `session-start-hooks.feature:6` and `:19` among the failures. E4 (containment of `CLAUDE_PLUGIN_ROOT`, `hook-env.ts`) ends `11 scenarios (11 failed)`, which includes both `session-start-hooks.feature` scenarios. E2 (synthesized root) also fails both. Each log has `exit=1`, `restored=clean`, and the root of its own worktree. I ran `session-start-hooks.feature` under builtin (16 scenarios with `subagent-child.feature`) and its scenarios under adapter: all passed |
| 2 | SC2 (ITDUP-02): a scenario starts a real pi-subagents child of an agent with an empty body, running detached; its `Bash` and `Read` hooks, including the failing `Read`'s `PostToolUseFailure`, carry agent type and session id; no main-session hook carries a child identity | ✓ VERIFIED | `features/plugin/subagent-child.feature:574` (`@mcp`) with an empty `body` cell and `tool calls: bash, failing read`. It asserts mode `background`, state `complete`, a recorded runner process, the four `PreToolUse/PostToolUse Bash`, `PreToolUse Read`, `PostToolUseFailure Read` rows with `demo:plain`, agent id, transcript path, `CLAUDE_CODE_SESSION_ID`, and a control-prompt table in which `child identity` is `none`. `parseRealChildAgents` (`features/lib/real-subagent-child.ts:1102`) reads the optional `body` column and yields an empty body for an empty cell. Run: the scenario passes under adapter and builtin |
| 3 | SC3 (ITDUP-02): the scenarios of SC2 pass under both profiles and fail when the child's hook identity is broken on purpose, and `pi-subagents-child-identity.test.ts` is gone | ✓ VERIFIED | The file is absent (444 lines deleted), and no file outside `.planning/` names it (grep over `extensions test features scripts docs README* .github` is empty). Break logs in `phase01-plan02/`: E7 (no identity in the `PostToolUseFailure` payload) fails `:574` under adapter and under builtin; E8 (the child's own session in `session_id`) fails it under adapter; E9 (no identity in either lane) fails all 5; E10 (`async: false` for an ordinary agent) fails `:574` and `frontmatter.feature:410`; E11 fails `frontmatter.feature:423`; E6 fails the concurrent scenario. Every log has `exit=1`, `restored=clean`, and its own worktree root |
| 4 | Every case of the deleted identity file maps to a scenario that a recorded break fails (background and MCP children, empty-body ordinary child, foreground default, concurrent runner children) | ✓ VERIFIED | The map in `01-02-SUMMARY.md` agrees with the logs: `:547` (E7, E8, E9), `:574` (E7 to E10), `frontmatter.feature:423` (E7 to E9, E11), `:619` (E6, E9). The review added the foreground scenario (`:597`) and the `fork cache key` column to the concurrent scenario, so the fork-launched child of the old file is covered too |
| 5 | Only the test files go: no break stays in the tree or reaches a commit | ✓ VERIFIED | `git diff f67fe6c9 HEAD --stat -- extensions` prints nothing and `git status --porcelain -- extensions` prints nothing; the whole working tree is clean. The diff stat touches only `.planning/`, two docs, three `features/` files, and the two deleted tests |
| 6 | The docs cite scenarios in place of the deleted files | ✓ VERIFIED | `docs/hooks-compatibility.md` and `docs/mcp-compatibility.md` name the scenarios by title. No reference to either deleted path remains outside `.planning/` |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

The state-transition and cancellation truths are behavior-dependent, and every one rests on a passing scenario and a recorded red proof, not on symbol presence.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/subagent-child.feature` | new `@mcp` empty-body scenario | ✓ VERIFIED | Line 574, plus the foreground scenario at 597 |
| `features/lib/real-subagent-child.ts` | `parseRealChildAgents` with the optional `body` column | ✓ VERIFIED | Line 1102 to 1116; any other header throws through `tableRecords` |
| `docs/hooks-compatibility.md`, `docs/mcp-compatibility.md` | cite scenarios | ✓ VERIFIED | The diff against base shows the citations |
| `test/integration/hooks-spawn-end-to-end.test.ts` | deleted | ✓ VERIFIED | Absent |
| `test/integration/pi-subagents-child-identity.test.ts` | deleted | ✓ VERIFIED | Absent |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `subagent-child.feature` | `subagent-hooks.steps.ts` | the real-child When step, setting unset | ✓ WIRED | The scenario ran green under both profiles |
| `subagent-hooks.steps.ts` | `real-subagent-child.ts` | `parseRealChildAgents(table.raw())` | ✓ WIRED | The scenario ran green with a `body` column |
| `real-subagent-child.ts` | `bridges/hooks/runtime.ts` | the agent tag read through `ACTIVE_AGENT_PREFIX` | ✓ WIRED | E6 and E9 break it and fail the scenarios |
| `docs/hooks-compatibility.md` | `subagent-child.feature` | scenario titles | ✓ WIRED | The titles match the feature file |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| builtin: `subagent-child.feature` and `session-start-hooks.feature` | `npm run test:cucumber:profile -- --profile builtin --parallel 2 <both files>` | 16 scenarios (16 passed) | ✓ PASS |
| adapter: empty-body (`:574`), foreground (`:597`), `session-start-hooks.feature`, `frontmatter.feature:423` | the same command with `--profile adapter` | 5 scenarios (5 passed) | ✓ PASS |
| Orchestrator phase gate on `c1433e6` (not re-run by me) | `check:static`, `test:unpaired`, `test:integration`, `test:cucumber` (adapter 2102, builtin 206), `test:coverage:direct:all` | all passed | ✓ PASS (reported) |

### Probe Execution

Step 7c: SKIPPED (no probe scripts declared by the phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ITDUP-01 | 01-01 | the hook spawn integration file is deleted after the hook scenarios are confirmed to cover the SessionStart side effect and an outside `CLAUDE_PLUGIN_ROOT` | ✓ SATISFIED | Truth 1; E1 to E5 |
| ITDUP-02 | 01-02 | a scenario covers an empty-body child and the failing read; the identity integration file is deleted | ✓ SATISFIED | Truths 2 to 4; E6 to E11 |

Both IDs appear in the plan frontmatter and in `REQUIREMENTS.md`. No orphaned requirement maps to Phase 1. (The `[ ]` boxes and "Pending" status in `REQUIREMENTS.md` are bookkeeping that the orchestrator updates after verification.)

### Anti-Patterns Found

None. A scan of the lines this phase added in `features/` and `docs/` finds no `TBD`, `FIXME`, `XXX`, `TODO`, or `HACK`. No stubs: the new scenario has real assertions, and the break logs show those assertions firing.

### Findings Reviewed and Not Counted

- **`weakened-tests` from `fallow audit`** on both deleted files: by the user's decision of 2026-11-21 (review WR-04), no config change is made and the PR accepts it at review. Not a gap.
- **Plan 02 prohibition "MUST NOT change any existing table or line of a feature file":** commits `6ad14de` and `011073b`, made after the plan ran by the review-fix loop, added a `fork cache key` column to the concurrent scenario's table and rewrote the feature description. These changes add coverage (the fork-launched child the deleted file ran) and fix wording. The two docs and the scenario still agree. I judge this an accepted, review-driven deviation. Info only.
- **The concurrent scenario's fork column and the foreground scenario were added after the E6 to E11 breaks.** No break was recorded for the fork column (the old integration case was a fork) or for the foreground scenario. The foreground scenario has a red proof in `01-REVIEW-FIX.md` for its tool-offer guard (WR-05). The deleted file's foreground and fork cases are still reached by a passing scenario under both profiles. Info only; the goal's break-before-delete rule was met for all four mapped cases through E6 to E11.
- **Review Info items IN-01 to IN-05** stay open and none blocks the goal. IN-01: the empty-body scenario detects no break that no other scenario detects, because E7 to E10 also fail other scenarios. It is what ITDUP-02 asks for, and `01-02-SUMMARY.md` records E6 as the evidence that the reader has no body-specific path.
- **Known deviation of the break-verify commands** (`Scenario: ` grep versus the reporter's `N) <title> # <file>:<line>`): I judged the break logs on their content. They contain the real failure lists and match what the summaries claim.

### Human Verification Required

None.

### Gaps Summary

No gaps. Both integration files are gone, and each deletion followed recorded deliberate breaks (E1 to E5, E6 to E11) that failed the replacing scenarios on assertions, with every break restored and no change under `extensions/`. The new and the replacing scenarios pass under both profiles.

---

_Verified: 2026-11-21T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
