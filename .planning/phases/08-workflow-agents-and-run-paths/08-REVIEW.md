---
phase: 08-workflow-agents-and-run-paths
iteration: 2
reviewed: 2026-11-15T06:09:51Z
depth: deep
diff_base: 3826ad12
diff_head: 8305e78b
files_reviewed: 10
files_reviewed_list:
  - .planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - features/workflow/agent-types.feature
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/fixtures/plugin-info.ts
  - test/orchestrators/plugin/discover-names.test.ts
  - test/orchestrators/plugin/info.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report (iteration 2)

**Reviewed:** 2026-11-15T06:09:51Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Scope: `git diff 3826ad12..8305e78b`. 08-REVIEW-FIX.md was the only planning file I read for intent. 08-SECURITY.md is in scope because the fix changed the T-08-13 row. I checked each claim against the installed engine 3.15.0 source (`node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src`). Owner tests passed in a scratchpad HOME with `--import test/platform/isolated-pi-home.ts`: `discover-names.test.ts` and `catalog-contract.test.ts`, 53/53.

The iteration-1 findings, one by one:
- **CR-01 fixed.** `loadWorkflowSettings` (`src/workflow-settings.ts:122-136`) merges `<cwd>/.pi/workflows/settings.json` with no trust check, and every caller passes only `{ cwd }` (`src/pi-extension.ts:95, 162, 316, 376, 389, 394`; `src/workflow-tool.ts:488`). The paragraph at `docs/workflows-compatibility.md:242` now says this. The README line 253 is quoted no more. The T-08-13 row has a problem in its disposition, not in its facts (WR2-01).
- **WR-01 fixed.** The short form fires only when `shown === 0`. In that case `shown < 5` holds, so every type the line counts must be over 128 characters. The claim is sound. The owner cases use `acme:` plus 124 characters, which is 129. The scenario type is also 129 characters (measured).
- **WR-02 fixed.** "fails the step" now reads the same in the code (`discover-names.ts:170, 192`), the catalog state and prose, the fixture, the owner tests, `info.test.ts`, every scenario table and title, and the `agentType` row. The byte pin moved by +1, which matches the one changed state line. `grep "stops the run"` finds the old text only in `.planning/` history.
- **WR-03 fixed.** `restrictedAgentTools` now keys only on `declaredAgentName`. This matches `parseAgentDefinition` (`src/agent-registry.ts:97-98`, `fmName || basename`). No caller read `WorkflowNoteAgent.generatedName`: the one external caller, `info.ts:1291`, passes discovered agents, which still fit the narrower type. The other `generatedName` reads in `discover-names.ts:336-341`, `install-outcome.ts`, and `update-swap.ts` read the bridge discovery types, not this interface. The new owner case and the scenario at `agent-types.feature:135` both assert that no note appears. The `agentType` row records the fifth limit. Keeping the flat name without a note is reasonable: an upstream-authored script cannot name a `pi-claude-marketplace-` file.
- **WR-04 fixed.** The row now matches the engine's own order, "explicit model > agentType model > tier > phase model > metadata model > inherited main model > implicit medium > session default" (`src/workflow-capability-contract.ts:330`), and `resolveAgentModelSpec` (`src/agent.ts:242-265`).
- **IN-01, IN-02, IN-03 fixed** as recorded. IN-02's call text pins the absence of an agent body. Removing the IN-03 sentence leaves one gap (IN2-03).

New defects: the T-08-13 change leaves 08-SECURITY.md contradicting itself (WR2-01), plus four Info items. No new code defect was found in the over-128 count line or the name-only join.

Necessity rubric applied. No necessity findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR2-01: The T-08-13 fix makes 08-SECURITY.md contradict itself: a fixer-inferred "accept" is marked closed, the sign-off says no acceptance was inferred, and the residual has no carrier

**File:** `.planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md:48, 68, 84, 88-93` (frontmatter lines 4-8)
**Issue:**
- The fix changed T-08-13 from `transfer` to `accept` and set the status to `closed`. Its own text says "Pending maintainer review" (lines 48 and 68). The autonomous fixer chose the acceptance. The maintainer did not.
- The Sign-Off still says "Residual risks documented; no new acceptance inferred." and "No blocking or nonblocking threat remains open". The approval line still says "verified 2026-11-15 at f7360834". The frontmatter still says `status: verified`, `threats_open: 0`.
- A downstream gate that reads `threats_open` therefore sees an acceptance that nobody owns as settled.
- The severity is also out of line. T-08-13 is rated `low`, yet it lets a cloned repository bring about T-08-12 (`medium`: an adapter in workflow children holds every adapter tool) with no consent from the user. It can also load any other enabled user extension into every subagent.
- The BACKLOG line for the engine request is drafted twice, in 08-REVIEW-FIX.md and on line 68, but `.planning/BACKLOG.md` has no entry. The residual has no carrier.

**Fix:**
- Until the maintainer accepts T-08-13, give it status `open` (nonblocking). Set `threats_open_nonblocking: 1` and `threats_closed: 26`.
- Reword the sign-off bullet to name the pending acceptance.
- Rate T-08-13 `medium` to match T-08-12, or record why it is lower.
- Append the drafted line to `.planning/BACKLOG.md`, or name the carrier the parent will write.

## Info

### IN2-01: The comment and the catalog say "no note" or "the only line", but the code's test is "no missing-agent note"

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:175-178`; `docs/output-catalog.md:3159` ("When the count line is the only line of the script")
**Issue:** `shown` counts only missing-agent notes. A script with one restricted agent and one over-128 missing type prints the restriction note first, then the short count line. That output is correct. But the count line is then not "the only line of the script", and a note does come before it. The prose gives the wrong condition.
**Fix:** Say "when no missing-agent note comes before it" in both places. You can also add an owner case for a restriction note followed by the short count line.

### IN2-02: The other 08-SECURITY rows cite line numbers that the fixes moved

**File:** `.planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md:39-41, 59`
**Issue:** T-08-04, T-08-05, T-08-06, and T-08-24 still cite the f7360834 lines. Since then, the limits have moved from 137-138 to 135-136, the count line from 175-179 to 177-193, `missingAgentNote` from 171-173 to 169-171, the seven-type scenario from 135-161 to 161-190, and the fixture note from 221 to 233. The edited T-08-13 row cites the current tree, so the register now mixes two baselines.
**Fix:** Re-point the four rows at 8305e78b, or state in the register that every row except T-08-13 cites f7360834.

### IN2-03: Removing the IN-03 sentence leaves the AG-11 refusal of a Workflow-only agent with no upstream statement

**File:** `docs/mcp-compatibility.md:391`
**Issue:** The bullet now says only that the install is refused (AG-11). It no longer says what Claude Code does with such an agent, so a reader cannot tell whether the refusal matches upstream or is a divergence. AGENTS.md requires every divergence to carry a recorded license.
**Fix:** Read the 2.1.323 binary for an agent whose `tools` resolve to nothing. Then either restore a graded upstream sentence or name the decision that licenses the refusal.

### IN2-04: The untrusted settings paragraph names two keys; the file sets more that cost money or write data

**File:** `docs/workflows-compatibility.md:242`
**Issue:** Through the same untrusted merge, a repository can also set `defaultEffort: "ultra"`, `defaultTokenBudget: null`, `defaultConcurrency`, `defaultAgentRetries`, `persistAgentSessions` (which writes subagent transcripts to disk), and `keywordTriggerEnabled` (`src/workflow-settings.ts:14-49`). The paragraph does not claim to list every key. Still, a user who checks only the two named keys can miss a cost or a transcript write.
**Fix:** Add "among other settings", or tell the user to read the whole file. The paragraph's last sentence already says to read it.

---

_Reviewed: 2026-11-15T06:09:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
