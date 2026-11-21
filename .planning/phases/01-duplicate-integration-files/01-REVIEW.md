---
phase: 01-duplicate-integration-files
reviewed: 2026-11-21T16:03:37Z
depth: standard
iteration: 2
files_reviewed: 5
files_reviewed_list:
  - features/lib/real-subagent-child.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/plugin/subagent-child.feature
  - docs/mcp-compatibility.md
  - docs/hooks-compatibility.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
  necessity: 1
  # WR-04 is listed below with its recorded user disposition "won't fix".
  # It is not counted under `warning` or `total`.
  dispositioned_wont_fix: 1
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-21T16:03:37Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is re-review iteration 2. Scope: `git diff f67fe6c9 -- <file>` for the five files, with the most attention on the iteration-1 fixes 32b41e5, 6ad14de, and e014f87. I applied `AGENTS.md`, the cucumber skill (its review section and the `features.md` and `steps.md` rules), and the typescript-style skill (`comments.md` and `review.md`). As the orchestrator asked, I did not re-run the suite. Static checks and both cucumber profiles passed after iteration 1.

**The iteration-1 findings are resolved:**

- **WR-01 (fixed).** The new scenario at `features/plugin/subagent-child.feature:592` compares every hook run in append order, in any session. So a hook that a foreground child's tool call runs anywhere adds a row and fails the table. I also checked that the order of `startup SessionEnd` before `main SessionStart` is fixed and not a race. `sessionShutdownCallback` awaits the SessionEnd composite before it returns (`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1230`). `docs/hooks-compatibility.md:79` now cites the scenario by title.
- **WR-02 (fixed).** `parseConcurrentLaunches` reads the optional `fork cache key` column, and `tableRecords` still checks the header strictly. The `demo:beta` row sets `pg3-fork`, so `forkCacheKey` has a setter again.
- **WR-03 (fixed).** The scripted-model check covers every request, including the ones the provider rejects with a 400. This holds because `requests.push(received)` (`features/lib/real-subagent-child.ts:398`) runs before the model test. The dead fields are gone. The version claim rests on `resolveCompanion`, which refuses a peer cache whose version is not `0.88.1` (`features/lib/companions.ts:136-140`, `test/integration/optional-peer-suite-versions.json`).

**New findings in the fixes:**

1. The new guard `assertCallsAnswered` counts tool results, not tool calls that ran. Pi returns an error result for a tool that the child was not offered, and it does so without dispatching any hook. In that case the foreground scenario passes without proving anything (WR-05).
2. The feature description and the step module overview still say that a child runs a plugin's tool hooks. The `startup` session in the new table is explained only in a step-definition comment (WR-06).

WR-04 keeps its recorded disposition. IN-01 and IN-02 still apply. Two new Info items cover an unobserved doc claim and a leftover inline copy of the new helper.

## Warnings

### WR-04: The PR's `fallow-audit` job will fail on the `weakened-tests` warning from the two deletions

**Disposition (orchestrator, 2026-11-21): won't fix, by user decision.** This finding is not counted as an open warning. The user chose to make no `.fallowrc.json` change. An `overrides` entry that turns `weakened-tests` off raises its own `rule-severity` warn, which has no suppression (measured), so it would not make the audit pass. The PR accepts the `fallow-audit` failure once, at review (STATE.md Blockers/Concerns). Do not edit `.fallowrc.json` or the CI workflow for this finding.

**File:** `.github/workflows/lint.yml:80-86`. This is a consequence of deleting `test/integration/hooks-spawn-end-to-end.test.ts` and `test/integration/pi-subagents-child-identity.test.ts`.
**Issue:** `fallow audit --base f67fe6c9` returns verdict `warn`, with `weakened-tests` (`removed-tests`) on both deleted files. The step "Fail on a Fallow warning" fails on `verdict == 'warn'`.
**Fix:** None, per the disposition above.

### WR-05: `assertCallsAnswered` counts tool results, so a child that was offered neither `bash` nor `read` still passes the foreground scenario

**File:** `features/lib/real-subagent-child.ts:830-842` (guard), `features/lib/real-subagent-child.ts:278` and `:396` (the `ProviderRequest.tools` field, which nothing reads)
**Issue:** The guard passes when some request carries the child's task marker and holds `calls` tool messages after it. The fix report calls it the proof that the foreground child "called `bash`". The scenario at `features/plugin/subagent-child.feature:592` and `docs/hooks-compatibility.md:79` ("its `Bash` and `Read` calls run no hook in any session") rest on that proof. But a tool message is not a tool call that ran. Take a child whose session does not offer `bash` or `read`. Pi's `prepareToolCall` (`node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:487-494`) returns `{ kind: "immediate", result: createErrorToolResult("Tool bash not found") }` for each call. It returns before `config.beforeToolCall`, which is where Pi's `tool_call` event fires and the hooks bridge dispatches PreToolUse. The child still sends two tool results, so the guard passes. No hook can run for a tool that never runs, so the in-order table also passes. The `failing read` call fails in both cases, so its result cannot show the difference either.

In that state the scenario proves nothing about its title, which is "runs no plugin hook for its tool calls". This is the gap the guard was added to close ("a foreground child that never called `bash` would pass"). The driver already records the tools each request offers (`ProviderRequest.tools`), but nothing reads that field. A tool-grant regression is caught elsewhere: `features/agent/frontmatter.feature` compares the generated agent file, and the background real-child rows hook `Bash`. That is why this is a WARNING and not a BLOCKER.
**Fix:** Make the guard require that each request of the child offered every tool the child calls. This also gives `tools` a reader:

```ts
// Fails unless the child of `agent` was offered each tool it calls and sent
// the provider the results of all of them. No hook shows the calls of a
// foreground child, and Pi answers a call to a tool it does not offer with an
// error result and no tool event.
function assertCallsAnswered(
  run: MainRun,
  agent: string,
  calls: readonly ScriptedToolCall[],
): void {
  const requests = run.provider.requests.filter(
    ({ lastUserText }) => MARKER_PATTERN.exec(lastUserText)?.[0] === taskMarker(agent),
  );
  assert.deepStrictEqual(
    requests.map(({ tools }) => calls.map(({ tool }) => tool).filter((tool) => !tools.includes(tool))),
    requests.map(() => []),
    `the child of ${agent} was offered every tool it calls`,
  );
  assert.ok(
    requests.some(({ toolResults }) => toolResults === calls.length),
    `the child of ${agent} sent the results of its ${calls.length} tool calls`,
  );
}
```

Then pass `calls` instead of `calls.length` through `launchChild` and `runRealSubagentChild`. Give it a red proof: write the `plain` agent with `tools: Edit` in the foreground scenario. The run should fail in the When.

### WR-06: The feature description and the step overview do not cover the foreground behavior, and the `startup` row is explained only in step code

**File:** `features/plugin/subagent-child.feature:3-6`, `features/plugin/subagent-child.feature:599-601`, `features/step_definitions/plugin/subagent-hooks.steps.ts:1-6`
**Issue:**
- The feature description says "a child runs a plugin's tool hooks but no main-session hook (D-PG3-08)". The new scenario shows the opposite for a foreground child: it runs no plugin hook at all. The description also lists the stand-ins, but not the real pi-subagents children and the loopback provider that the four real-child scenarios use. The cucumber rule (`features.md`, "Feature description") says the description states what the feature protects and what the scenarios stand in for.
- The first row of the new table is `startup | SessionEnd`. Nothing in the scenario or the feature says that the run installs the plugin in Pi's startup session and then starts the main session, which ends the startup one. That fact lives only in the comment on the Then (`subagent-hooks.steps.ts:676-679`) and in the driver. So the scenario fails the second review question: a reader cannot understand it without opening a step definition.
- The step module's `@fileoverview` still opens "Steps about the hooks of an installed plugin in a pi-subagents background child and in the main session beside it". Its last sentence now covers the foreground step, but the opening does not.

**Fix:** Extend the description. For example:

```gherkin
  A load in a pi-subagents background child changes nothing installed, yet loads the installed
  components (D-MB-12), and a background child runs a plugin's tool hooks but no main-session hook
  (D-PG3-08); a foreground child runs inside the main Pi's turn and runs no plugin hook. ...
  The real-child scenarios run the installed pi-subagents against a loopback scripted provider;
  each installs the plugin in Pi's startup session, then starts the main session, which ends the
  startup one.
```

Change the overview's first sentence to "in a pi-subagents child, background or foreground, and in the main session beside it".

## Info

### IN-01: Already-defended-elsewhere: the empty-body scenario detects nothing the other real-child scenarios miss

**File:** `features/plugin/subagent-child.feature:569`
**Category:** necessity
**Issue:** This item is carried from iteration 1 and still applies. Iteration 1 left the scenario unchanged, and both docs now cite it (`docs/mcp-compatibility.md:495`, `docs/hooks-compatibility.md:77`). By the phase's own red proofs (01-02 SUMMARY), every break that failed `:569` also failed another scenario: E7 failed `:542` and `frontmatter.feature:423`; E8 failed `:542`, `frontmatter.feature:410`, and `:423`; E9 failed all five; E10 failed `frontmatter.feature:410`. E6, the bare-tag parse, passed `:569`, because pi-subagents appends its intercom section after an empty body. This judgment rests on SUMMARY evidence that the repository cannot reproduce, so it stays Info.
**Fix:** Pick one. Drop the scenario and cite `frontmatter.feature:410` and `:423` instead. Or make the empty body load-bearing. Or retitle the scenario so that it does not imply empty-body coverage.

### IN-02: The negative `openUi` claim reads as if the cited scenarios proved it

**File:** `docs/mcp-compatibility.md:770`
**Issue:** This item is carried from iteration 1, and the text has not changed. The sentence "An agent with a plugin MCP grant then does not launch." comes right before scenarios that show the opposite condition: with no `openUi` default, the granted agents launch. No test runs `openUi: false`. The claim rests on reading `computeMcpServerHash` in the pi-subagents source.
**Fix:** Mark the negative as read in source, for example "(read in the pi-subagents 0.88.1 source, `computeMcpServerHash`; not run)". Keep the scenario citations for the positive.

### IN-03: The hooks doc states the fork's boundary-free prompt as if a scenario showed it

**File:** `docs/hooks-compatibility.md:77`
**Issue:** The new clause "one of them launched as a fork, whose prompt pi-subagents leaves without its appended boundary" sits in the Evidence paragraph. It matches the source: `registerSubagentPromptBoundary` returns early when `config.forkCacheKey` is set (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/subagent-prompt-runtime.js:239`). But no step observes the prompt. The fix report also says that no Then distinguishes the forked row, because the bridge reads only `customPrompt` and `appendSystemPrompt`.
**Fix:** Mark it as source-read, for example "...launched as a fork, which pi-subagents 0.88.1 gives no appended boundary (read in source, `registerSubagentPromptBoundary`)".

### IN-04: One inline copy of the child-identity test is left after `childIdentityCell` was extracted

**File:** `features/step_definitions/plugin/subagent-hooks.steps.ts:652-654`
**Issue:** Iteration 1 extracted `childIdentityCell` (`:314-317`), and the control-prompt step and the new in-order step use it. The `named` filter of the any-order step still spells out `Object.hasOwn(run.stdin, "agent_type") || Object.hasOwn(run.stdin, "agent_id")`. If one copy changes, the steps can disagree about what "names a child" means.
**Fix:** `.filter((run) => childIdentityCell(run) === "named")`.

---

_Reviewed: 2026-11-21T16:03:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
