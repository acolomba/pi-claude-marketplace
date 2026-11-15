---
phase: 08-workflow-agents-and-run-paths
iteration: 3
reviewed: 2026-11-15T06:27:25Z
depth: deep
diff_base: b3fdc46f
diff_head: a78def62
files_reviewed: 6
files_reviewed_list:
  - .planning/phases/08-workflow-agents-and-run-paths/08-REVIEW-FIX.md
  - .planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report (iteration 3)

**Reviewed:** 2026-11-15T06:27:25Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Scope: `git diff b3fdc46f..a78def62`, six commits (e03e0408, 8975cda6, dffbb2da, 9a0e0e05, 6e2f0a11, a78def62). I read 08-REVIEW-FIX.md (Iteration 2) for intent. I checked the engine claims against the installed engine 3.15.0 (`node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src`). I checked the upstream claim against the installed 2.1.323 Claude Code binary. I checked every line citation in 08-SECURITY.md against the current tree. The owner tests passed in a scratchpad HOME with `--import test/platform/isolated-pi-home.ts`: `discover-names.test.ts` and `catalog-contract.test.ts`, 53/53. The worktree stayed clean.

The iteration-2 findings, one by one:

- **WR2-01 fixed.** T-08-13 is now `open (nonblocking)`, rated `medium`, with the disposition "accept (pending maintainer acceptance)". The frontmatter reads `threats_open_nonblocking: 1` and `threats_closed: 26`. A tally of the table gives 4 high, 14 medium, 9 low, 26 closed (6 of them n/a) and 1 open, which matches the intro and the frontmatter. The sign-off no longer says "no new acceptance inferred". It has one unchecked item for the pending acceptance. The approval line limits the verification to the blocking gate. A new audit-trail row records the change. The BACKLOG carrier is the parent's merge, which is accepted and known, so it is not a finding. The loader cite `src/workflow-settings.ts:122-134` is the whole body of `loadWorkflowSettings`.
- **IN2-01 fixed.** The comment (`discover-names.ts:173-178`) and the catalog prose (`docs/output-catalog.md:3159`) now give the code's condition. `shown` counts only missing-agent notes (`discover-names.ts:220-231`), and the count line is pushed after the loop (233-235), so a restriction note can come before it. The byte pin counts example bytes only (`catalog-contract.test.ts:283-286`), so 55,018 still holds after a prose-only change. The test run confirms this.
- **IN2-02 fixed.** I checked every re-pointed citation against a78def62. Every later commit replaced exactly one line, so 8975cda6 and a78def62 have the same line numbers. The citations hold: `discover-names.ts` 135-136, 149-157, 150, 169-171, 179-194, 211-238, 224, 277-283; `discover-names.test.ts` 505-531, 742-822 (cases at 742, 769, 801), 824-842; `agent-types.feature` 161-190, 192-206; `plugin-info.ts` 234-236; `catalog-contract.test.ts` 21-22, 279-300; `output-catalog.md` 3161-3171. I spot-checked the rows that were not re-pointed (T-08-01, -02, -08, -09, -10, -12, -14, -15, -16, -17), and they still match.
- **IN2-03 fixed, with a residual (IN3-01).** The 2.1.323 binary contains the launch-time check. It logs `tengu_subagent_zero_tools` and throws `subagent_tool_resolution` / `zero_tools_refused` with "Agent '${agentType}' would be spawned with zero tools — refusing. Its tools list resolved to nothing: … not available to subagents [...]". So the upstream statement is correct. The doc writes the em dash as `--`, as the repository's dash fixer requires. AGENT-10 exists at `docs/research/parity-gaps/subagents.md:244`.
- **IN2-04 fixed, with a residual (IN3-02).** `defaultEffort`, `defaultTokenBudget` (a normalized `null` survives the merge, `workflow-settings.ts:198-199`), `defaultConcurrency`, `defaultAgentRetries`, and `persistAgentSessions` are described correctly. The `keywordTriggerEnabled` gloss is misleading.

No new defect was found in the one code change, which is a comment. The new defects are two Info items in the documentation.

Necessity rubric applied. No necessity findings.

## Narrative Findings (AI reviewer)

## Info

### IN3-01: The new upstream sentence says AG-11 licenses the install refusal, but the project's own records say AG-11's stated reason is no longer true

**File:** `docs/mcp-compatibility.md:391`
**Issue:** The bullet now says "refusing the install is a divergence, and the recorded requirement AG-11 licenses it". AGENTS.md allows two kinds of license: a recorded decision, or a Pi capability gap. AG-11 rested on a gap, "pi-subagents has no safe representation of 'no tools'". Two project records say that this gap no longer exists. `docs/prd/parity-gaps-prd.md:179` (decision 15) says "The stated reason, that pi-subagents cannot express 'no tools', is no longer true". `docs/research/parity-gaps/subagents.md:248` says that `tools:` empty now means no tools. So a reader of the compatibility page sees a divergence that looks settled, while it is an open decision whose basis has lapsed. The divergence is also larger than the sentence says. Claude Code installs the agent and refuses only its launch, but the refusal here fails the whole plugin install (`parity-gaps-prd.md:771`), not only that agent's. The last sentence implies this, but it does not say it.
**Fix:** Write, for example: "So refusing the whole plugin install is a divergence. The recorded requirement AG-11 still requires it, but its stated reason (pi-subagents could not express 'no tools') no longer holds. Decision 15 in `docs/prd/parity-gaps-prd.md` (AGENT-10) proposes to skip such an agent and install the rest of the plugin, pending the maintainer's decision."

### IN3-02: The `keywordTriggerEnabled` gloss describes the engine's default, not what a repository adds, and the paragraph leaves out `keywordTriggerWord`

**File:** `docs/workflows-compatibility.md:242`
**Issue:** The paragraph says that a cloned repository can set "`keywordTriggerEnabled` (which lets a keyword in your input turn on workflows mode)". In engine 3.15.0 the trigger is already on by default (`src/workflow-editor.ts:320`, `keywordTriggerEnabled: initialSettings.keywordTriggerEnabled ?? true`; the fallback at 467 is also `true`). A repository file can only turn it back on after the user turned it off. The bigger lever is in the same file and goes through the same untrusted merge (`src/pi-extension.ts:393-394` passes `loadWorkflowSettings({ cwd })` as the arming store): `keywordTriggerWord`. It accepts any single token that has no whitespace and no leading `/` (`src/config.ts:39-44`). So a repository can set the trigger to an ordinary word, and that word in normal input then arms workflows mode. The paragraph also leaves out `defaultAgentTimeoutMs` (`null` removes a user's global hard timeout, `workflow-settings.ts:189-190`), which costs money in the same way as `defaultTokenBudget: null`. The paragraph does not claim to list every key, so this is a gap in a security note, not a false statement.
**Fix:** Replace the gloss with "`keywordTriggerEnabled` and `keywordTriggerWord` (which can turn the keyword trigger back on and set it to an ordinary word, so that word in your input turns on workflows mode)". Add "`defaultAgentTimeoutMs` (`null` removes your own timeout)" next to `defaultTokenBudget`.

---

_Reviewed: 2026-11-15T06:27:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
