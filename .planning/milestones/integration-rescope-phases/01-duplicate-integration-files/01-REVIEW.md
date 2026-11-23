---
phase: 01-duplicate-integration-files
reviewed: 2026-11-21T16:40:00Z
depth: standard
iteration: 3
files_reviewed: 5
files_reviewed_list:
  - features/lib/real-subagent-child.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/plugin/subagent-child.feature
  - docs/mcp-compatibility.md
  - docs/hooks-compatibility.md
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
  necessity: 1
  # WR-04 is listed below with its recorded user disposition "won't fix".
  # It is not counted under `warning` or `total`.
  dispositioned_wont_fix: 1
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-21T16:40:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found (Info only, plus the dispositioned WR-04)

## Summary

This is re-review iteration 3, the last pass of the `--auto` fix loop. Scope: `git diff f67fe6c9 -- <file>` for the five files, with the most attention on the second fix pass, a7ee4ea (WR-05) and 011073b (WR-06). I applied `AGENTS.md`, the cucumber skill (its review section and `rules/features.md`), and the typescript-style skill. As the orchestrator asked, I did not re-run the suite. Static checks and both cucumber profiles passed on the touched features after the second pass.

**The second-pass findings are resolved:**

- **WR-05 (fixed, a7ee4ea).** `assertCallsAnswered` (`features/lib/real-subagent-child.ts:830-857`) now takes the child's `ScriptedToolCall[]`. It selects every provider request whose first marker is the child's task marker. It fails unless each of those requests offered every tool that the child calls, which gives `ProviderRequest.tools` (`:278`, `:396`) a reader. It then fails unless one request carries a result for each call. I traced the edge cases:
  - A child with no request passes the first assertion on `[]` and fails the second, so a child that never ran still fails.
  - Requests that the provider rejects with a 400 are recorded before the model test (`:398`), so their tools are checked too.
  - The scripted names match Pi's request names: `bash`, `read`, and `MCP_TOOL` (`:121`, `:1059-1063`).
  - The guard now also runs for the background children of `runRealSubagentChild`, including `demo:granted`. The fix report says that both profiles passed on that scenario.

  The vacuous case from iteration 2 no longer passes: a session that does not offer `bash` or `read` fails at the first assertion. The fix report records the red proof: `tools: Edit` failed the When with the fix, and passed with the old guard.
- **WR-06 (fixed, 011073b).** The feature description now limits D-PG3-08 to a background child. It says that a foreground child runs no plugin hook, names the real pi-subagents children and the loopback provider, and says that each real-child run installs the plugin in Pi's startup session and then starts the main session, which ends the startup session. That matches `installPlugin` (`features/lib/real-subagent-child.ts:729-752`). The `startup | SessionEnd` row now reads from the feature file alone. The step module's `@fileoverview` opens "child, background or foreground". The description lines are at most 99 characters long. The 9-line length is noted in IN-05.

The fix pass added no new BLOCKER or WARNING. WR-04 keeps its recorded disposition. IN-01 to IN-04 still apply, because neither commit touched those lines. IN-05 is new, and it is minor.

## Warnings

### WR-04: The PR's `fallow-audit` job will fail on the `weakened-tests` warning from the two deletions

**Disposition (orchestrator, 2026-11-21): won't fix, by user decision.** This finding is not counted as an open warning. The user chose to make no `.fallowrc.json` change. An `overrides` entry that turns `weakened-tests` off raises its own `rule-severity` warn, which has no suppression (measured), so it would not make the audit pass. The PR accepts the `fallow-audit` failure once, at review (STATE.md Blockers/Concerns). Do not edit `.fallowrc.json` or the CI workflow for this finding.

**File:** `.github/workflows/lint.yml:80-86`. This is a consequence of deleting `test/integration/hooks-spawn-end-to-end.test.ts` and `test/integration/pi-subagents-child-identity.test.ts`.
**Issue:** `fallow audit --base f67fe6c9` returns verdict `warn`, with `weakened-tests` (`removed-tests`) on both deleted files. The step "Fail on a Fallow warning" fails on `verdict == 'warn'`.
**Fix:** None, per the disposition above.

## Info

### IN-01: Already-defended-elsewhere: the empty-body scenario detects nothing the other real-child scenarios miss

**File:** `features/plugin/subagent-child.feature:574`
**Category:** necessity
**Issue:** This item is carried from iterations 1 and 2. The scenario is unchanged, and both docs cite it (`docs/mcp-compatibility.md:495`, `docs/hooks-compatibility.md:77`). By the phase's own red proofs (01-02 SUMMARY), every break that failed this scenario also failed another one. E7 failed the background real-child scenario and `frontmatter.feature:423`. E8 failed the background real-child scenario, `frontmatter.feature:410`, and `:423`. E9 failed all five. E10 failed `frontmatter.feature:410`. E6, the bare-tag parse, passed this scenario, because pi-subagents appends its intercom section after an empty body. This judgment rests on SUMMARY evidence that the repository cannot reproduce, so it stays Info.
**Fix:** Pick one:
- Drop the scenario and cite `frontmatter.feature:410` and `:423` instead.
- Make the empty body load-bearing.
- Retitle the scenario so that it does not imply empty-body coverage.

### IN-02: The negative `openUi` claim reads as if the cited scenarios proved it

**File:** `docs/mcp-compatibility.md:770`
**Issue:** This item is carried from iterations 1 and 2, and the text has not changed. The sentence "An agent with a plugin MCP grant then does not launch." comes right before scenarios that show the opposite condition: with no `openUi` default, the granted agents launch. No test runs `openUi: false`. The claim rests on reading `computeMcpServerHash` in the pi-subagents source.
**Fix:** Mark the negative as read in source, for example "(read in the pi-subagents 0.88.1 source, `computeMcpServerHash`; not run)". Keep the scenario citations for the positive.

### IN-03: The hooks doc states the fork's boundary-free prompt as if a scenario showed it

**File:** `docs/hooks-compatibility.md:77`
**Issue:** This item is carried from iteration 2, and the text has not changed. The clause "one of them launched as a fork, whose prompt pi-subagents leaves without its appended boundary" sits in the Evidence paragraph. It matches the source: `registerSubagentPromptBoundary` returns early when `config.forkCacheKey` is set (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/subagent-prompt-runtime.js:239`). But no step observes the prompt, and no Then tells the forked row apart from the others.
**Fix:** Mark it as read in source, for example "...launched as a fork, which pi-subagents 0.88.1 gives no appended boundary (read in source, `registerSubagentPromptBoundary`)".

### IN-04: One inline copy of the child-identity test is left after `childIdentityCell` was extracted

**File:** `features/step_definitions/plugin/subagent-hooks.steps.ts:653-656`
**Issue:** This item is carried from iteration 2. The control-prompt step and the in-order step use `childIdentityCell` (`:316-320`). The `named` filter of the any-order step still spells out `Object.hasOwn(run.stdin, "agent_type") || Object.hasOwn(run.stdin, "agent_id")`. If one copy changes, the steps can disagree about what "names a child" means.
**Fix:** `.filter((run) => childIdentityCell(run) === "named")`.

### IN-05: The feature description grew from three lines to nine

**File:** `features/plugin/subagent-child.feature:3-11`
**Issue:** `.agents/skills/cucumber/rules/features.md:27` says: "Every feature has a description of two or three lines under the title." WR-06 rewrapped the old three over-long lines to at most 99 characters and added the foreground and real-child sentences, so the description now has nine lines. `check:features` does not enforce the count. Many features in the suite already break the rule: 40 of 149 descriptions have more than three lines. So this departure is minor and is not a defect in behavior. The added content is the content that WR-06 asked for.
**Fix:** This is optional. To keep the rule, shorten the stand-in list and merge the two real-child sentences. For example, "Stand-ins: stand-in child Pis beside a main Pi, real pi-subagents children against a loopback scripted model, recording hooks, and a local marketplace; each real-child run installs in Pi's startup session, then starts the main session." Otherwise, leave it as it is.

---

_Reviewed: 2026-11-21T16:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
