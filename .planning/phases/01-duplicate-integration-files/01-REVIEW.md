---
phase: 01-duplicate-integration-files
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - features/lib/real-subagent-child.ts
  - features/plugin/subagent-child.feature
  - docs/mcp-compatibility.md
  - docs/hooks-compatibility.md
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
  necessity: 1
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Scope: `git diff f67fe6c9 -- <file>` for the four files, plus a check that nothing outside `.planning/` still imports or cites the two deleted integration files. The `parseRealChildAgents` change is correct. `tableRecords` stays strict: a header with `body` in the wrong place, or an empty table, still throws. The new scenario reads without opening a step definition. No file outside `.planning/` imports or names `test/integration/hooks-spawn-end-to-end.test.ts` or `test/integration/pi-subagents-child-identity.test.ts`, and the surviving `HOOK-E2E-0N` titles in `hooks-dispatch-end-to-end.test.ts` and `hooks-additionalcontext-end-to-end.test.ts` are their own cases.

The defects come from the deletion of `pi-subagents-child-identity.test.ts`. The cucumber suite does not carry over everything it checked:

1. The foreground-child claim in `docs/hooks-compatibility.md` still cites "the real-child tests", which are gone. The scenario mapped to that case does not prove the claim.
2. The deleted test's forked child (`forkCacheKey`) has no scenario, and the field is now dead.
3. Three observation fields lost their last reader, and with them the check that the provider was the scripted model and the record of the pi-subagents version.
4. The PR's `fallow-audit` CI job will fail on the `weakened-tests` warning. Both SUMMARYs record this as open.

## Warnings

### WR-01: Foreground-child claim cites the deleted tests, and the scenario it was mapped to does not prove it

**File:** `docs/hooks-compatibility.md:79`
**Issue:** The paragraph says "So no plugin hook runs for its tool calls ... The real-child tests show this for an ordinary agent under a foreground default." The "real-child tests" were `test/integration/pi-subagents-child-identity.test.ts`, which this phase deleted, so the sentence now cites nothing. The 01-02 SUMMARY case map moves this case to `features/agent/frontmatter.feature:423` ("Explicit background and MCP grants keep a child in the background", row `demo:plain | foreground`). That scenario does not prove the claim:
- "pi-subagents ran the real children like this" checks only the launch mode.
- "the real children's hooks record these runs in any order, and no main-session run names a child" keeps only runs whose `agent_id` is a launched child's session. A foreground child has no session id, so none of its runs is a child run. Of the other runs, the step rejects only those that carry `agent_type`/`agent_id`.
- The scenario has no main-session control step. Even the control step used elsewhere slices only the first 6 runs (`MAIN_CONTROL_RUNS`), which cover the control prompt and not the launch prompt.

So if a foreground child's `bash` call fired plugin hooks without an identity, the scenario would still pass. The deleted test asserted the main session's full run list for the launch prompt (`UserPromptSubmit`, `PreToolUse subagent`, `PostToolUse subagent`, `Stop`, `Stop`, and no `Bash`). It also asserted that the only run in any other session was the install's `SessionEnd`.
**Fix:** Add a Then to `frontmatter.feature:423`, or a dedicated foreground scenario, that compares every main-session run of the launch prompt and states that no run belongs to another session. Then cite that scenario by title in line 79 instead of "The real-child tests". For example:
```gherkin
    Then the main session's hooks record these runs for the launch prompt, and no other session runs a hook:
      | event            | tool name | child identity |
      | UserPromptSubmit |           | none           |
      | PreToolUse       | subagent  | none           |
      | PostToolUse      | subagent  | none           |
      | Stop             |           | none           |
      | Stop             |           | none           |
```

### WR-02: The forked concurrent child lost its only real run, and `forkCacheKey` is now dead

**File:** `features/lib/real-subagent-child.ts:200`, `features/lib/real-subagent-child.ts:911`, `features/lib/real-subagent-child.ts:1088-1104`
**Issue:** In the deleted test's concurrent case, `demo:beta` was launched with `forkCacheKey: "pg3-fork"`. `parseConcurrentLaunches` never sets `forkCacheKey`, and the table of `features/plugin/subagent-child.feature:591` cannot express one. So `ConcurrentChildLaunch.forkCacheKey` and the runner's `...(child.forkCacheKey === undefined ? {} : { forkCacheKey: ... })` spread now have no setter.

The lost case behaves differently. In pi-subagents 0.88.1, `registerSubagentPromptBoundary` returns early for a fork (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/subagent-prompt-runtime.js:239`), so a forked child's system prompt carries no appended boundary. That is a different prompt shape for the bridge's `ACTIVE_AGENT_PREFIX` reader (`bridges/hooks/runtime.ts:55`). The 01-02 case map lists the concurrent case as covered by `:591` and does not mention the fork.
**Fix:** Pick one of these:
- Keep the case. Add an optional `fork cache key` column to `parseConcurrentLaunches`, read it the way `parseRealChildAgents` reads `body`, and set it on the `demo:beta` row of `:591`.
- Record that the forked variant is dropped. Then delete `forkCacheKey` from `ConcurrentChildLaunch` and the spread from `CONCURRENT_RUNNER`.

### WR-03: `versions`, `providerModels`, and `providerPrompts` have no reader, and the scripted-model check and version record are gone

**File:** `features/lib/real-subagent-child.ts:213-256`, `features/lib/real-subagent-child.ts:718-722`, `features/lib/real-subagent-child.ts:859-864`
**Issue:**
- **No reader left.** `observeMain` still computes `versions`, `providerPrompts`, and `providerModels`, and `withMainRun` still builds `RealChildVersions`. The only readers of `versions` and `providerModels` were in the deleted test: `t.diagnostic({ versions })` and `assert.deepStrictEqual(observed.providerModels, ["scripted"])`. `providerPrompts` had no reader even before. The step definitions in `features/step_definitions/plugin/subagent-hooks.steps.ts:444-486` read only `children`, `generations`, `hookRuns`, `mainSessionId`, and `mainSessionFile`.
- **Lost check.** The guard that every provider request named the scripted model is gone.
- **Unsupported doc claim.** `docs/hooks-compatibility.md:77` now says "Real children of the installed pi-subagents 0.88.1 run in" three scenarios, but no scenario records or checks the version it ran.
**Fix:** Pick one of these:
- Restore the guards in the real-child When steps: `assert.deepStrictEqual(observed.providerModels, ["scripted"])`, and an assertion of `observed.versions.piSubagents` against `test/integration/optional-peer-suite-versions.json`.
- Remove the three fields, `RealChildVersions`, and the `versions` construction in `withMainRun`.

### WR-04: The PR's `fallow-audit` job will fail on the `weakened-tests` warning from the two deletions

**Disposition (orchestrator, 2026-11-21): won't fix — user decision.** The user chose no `.fallowrc.json` change: an `overrides` entry turning `weakened-tests` off is itself a `rule-severity` warn with no suppression (measured), so it would not make the audit pass. The PR's `fallow-audit` failure is accepted once at review (STATE.md Blockers/Concerns). Do not edit `.fallowrc.json` or the CI workflow for this finding.

**File:** `.github/workflows/lint.yml:80-86` (consequence of deleting `test/integration/hooks-spawn-end-to-end.test.ts` and `test/integration/pi-subagents-child-identity.test.ts`)
**Issue:** `fallow audit --base f67fe6c9` returns verdict `warn`, with `weakened-tests` (`removed-tests`) on both deleted files, and the step "Fail on a Fallow warning" fails on `verdict == 'warn'`. `.fallowrc.json` has no `overrides` entry for either path. Both SUMMARYs leave this to the milestone, but as committed, the branch cannot pass PR CI.
**Fix:** Before the PR, add a reviewed `overrides` entry in `.fallowrc.json` that sets `weakened-tests` to `off` for the two deleted paths, with a justification that cites the red proofs E1-E11. Alternatively, record the decision that the milestone PR accepts the warning, and change the gate.

## Info

### IN-01: Already-defended-elsewhere: the new empty-body scenario detects nothing the existing real-child scenarios miss

**File:** `features/plugin/subagent-child.feature:569`
**Category:** necessity
**Issue:** By the phase's own red proofs (01-02 SUMMARY), every break that failed `:569` also failed another scenario:

| Break | Other scenarios that failed |
| --- | --- |
| E7 | `:542`, `frontmatter.feature:423` |
| E8 | `:542`, `frontmatter.feature:410`, `:423` |
| E9 | all five scenarios |
| E10 | `frontmatter.feature:410` |

The "empty body" in the title does not reach a distinct path either. E6 (the bare-tag parse) passed `:569`, because pi-subagents appends its intercom section after an empty body. Only `:591`'s `demo:alpha` reaches the bare tag. The scenario repeats `frontmatter.feature:410` with an extra failing `Read`, at the cost of two real pi-subagents launches (adapter and builtin). This judgment rests on SUMMARY evidence that is not reproducible from the repository, so it is Info.
**Fix:** Pick one of these:
- Drop the scenario, and cite `frontmatter.feature:410` and `:423` in `docs/mcp-compatibility.md:495` and `docs/hooks-compatibility.md:77`.
- Make the empty body load-bearing, for example by asserting that the child's prompt section ends right after the tag in a case where no intercom text follows.
- Retitle it so that it does not imply empty-body coverage.

### IN-02: The negative `openUi` claim reads as if the cited scenarios proved it

**File:** `docs/mcp-compatibility.md:770`
**Issue:** "An agent with a plugin MCP grant then does not launch." is followed by scenarios that show the opposite condition: with no `openUi` default, the granted agents launch. No test runs `openUi: false`. The claim rests on reading pi-subagents' `computeMcpServerHash`. The deleted test had the same limit, so this is not a regression, but the new sentence order invites the misreading.
**Fix:** Mark the negative as read in source, for example "(read in the pi-subagents 0.88.1 source, `computeMcpServerHash`; not run)". Keep the scenario citation for the positive.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
