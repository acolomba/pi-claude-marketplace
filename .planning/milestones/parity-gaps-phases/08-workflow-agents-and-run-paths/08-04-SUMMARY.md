---
phase: 08-workflow-agents-and-run-paths
plan: "04"
subsystem: docs
tags: [workflows, docs, parity, mcp]
status: complete
requires: ["08-01", "08-02", "08-03"]
provides:
  - "docs/workflows-compatibility.md section `What a workflow subagent can reach`"
  - "three evidence grades: source-read at 3.15.0, measured by spike S5, documented upstream for subagents"
  - "corrected fan-out failure paragraph (D-PG8-10)"
affects: [docs/workflows-compatibility.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: [docs/workflows-compatibility.md]
decisions:
  - "D-PG8-08 as graded: the section states each claim with its grade; hooks and skills in the Claude Code column are graded documented upstream for subagents"
  - "D-PG8-09: the page tells the user what to set; this extension writes no engine setting"
  - "D-PG8-10 as refined: Claude Code's parallel() and pipeline() never reject; the engine rethrows its non-recoverable class"
metrics:
  completed: 2026-11-14
  tasks: 2
  files: 1
actuals:
  tokens: 8555
  tasks: 2
  commits: 2
plan_head_before: e56d938668cfd2f14338a5c6939b8c120674c4c1
plan_head_after: a75956d69579beec83c5f69c073460d7f12404b5
---

# Phase 8 Plan 04: What a workflow subagent can reach Summary

The workflow page now says what an engine `agent()` subagent can reach on Pi and in Claude Code, names `inheritMainModel` and `providerMiddlewareExtensions` with their three files, states the pi-mcp-adapter setting as spike S5 measured it, and no longer calls Claude Code's fan-out failure behavior unknown.

## Commits

- `169ed5fb` docs(workflows): say what a workflow subagent can reach
- `a75956d6` docs(workflows): say that Claude Code's fan-out helpers never reject

Plan base `e56d9386`; `git rev-list --count e56d9386..HEAD` = 2 before this SUMMARY commit.

## Commands and results

- `SKIP=npm-check pre-commit run --files docs/workflows-compatibility.md`: first run after each edit, mdformat padded the tables (expected); the second run exited 0; the commit hooks passed.
- `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature features/workflow/run.feature`: exit 0, 12 scenarios (12 passed), 167 steps (167 passed). Hermetic cucumber sandbox.
- `node --test test/architecture/partial-vocabulary-guard.test.ts` (the architecture test that reads `docs/`): 45 pass, 0 fail.
- `git diff --quiet HEAD -- extensions test features`: exit 0 before each commit.
- `npm run check` not run (orchestrator's wave 3 gate).

## The adapter row as the page states it

From the record line `- S5(b) adapter setting: Works.` and rows b1-b5: "The setting works (measured by spike S5 on 2026-11-14, with Pi 1.5.0, engine 3.15.0, and pi-mcp-adapter 7.0.1)." A workflow subagent was offered `mcp` from its first request, called the plugin server through it, was offered the plugin tool after that proxy call and called it directly; both returned the server's answer; the run completed with no extension error; the main session's plugin tools still worked. The page notes the install wrote `"directTools": "search"` without claiming causation. The control (b5) is stated in the MCP-by-default row.

## Grade of each row

| Row | Grade(s) |
| --- | --- |
| Pi's `read`, `bash`, `edit`, `write` | source-read at 3.15.0 (`src/agent.ts`); scenario-measured at 3.15.0 (worktree scenario, `agent-steps.feature`) |
| `workflow` / `workflow_control` | source-read at 3.15.0; measured by spike S5 (a3 note); scenario-measured at 3.15.0 (sibling scenario, `run.feature`) |
| MCP tools by default | read from the 2.1.323 binary (Claude Code); source-read at 3.15.0; measured by spike S5 (control b5, adapter profile) |
| pi-mcp-adapter setting | measured by spike S5; name matching source-read at 3.15.0 |
| tool list with the adapter loaded | source-read at 3.15.0; engine README quote |
| Pi's built-in MCP | source-read at 3.15.0 (`src/agent.ts`) |
| plugin hooks | documented upstream for subagents |
| plugin skills | documented upstream for subagents; source-read at 3.15.0 (README); D-CF4-04 |
| model | documented upstream; source-read at 3.15.0 (`src/agent.ts`, README) |
| context files | read from the 2.1.323 binary; source-read at 3.15.0 (README) |
| settings files and workflow home | source-read at 3.15.0 (`src/workflow-settings.ts`, `src/workflow-paths.ts`); README quote on project trust |

No engine line number is cited in the new section.

## Passages changed in the failure subsection and in "Naming"

- Paragraph opening "Claude Code and the chosen engine therefore agree on the ordinary failure": dropped "What remains is a difference this document cannot yet size" and the "neither read out of the binary nor measured" sentence; kept the 3.10.1 rejection citation; added the `Promise.allSettled` reading with both quotes (read from the 2.1.323 binary on 2026-11-14), the engine's null/rethrow arms (source-read at 3.15.0, `src/workflow.ts`), the bare-`agent()` conditions, D-PG8-10, and the D-PG8-17 pointer to PRD section 8.4.
- Failure table: the Claude Code row adds the two throw conditions, graded read from the 2.1.323 binary.
- Script-defense paragraph: "Claude Code yields `null` for a failed item of a fan-out, where the engine may end the run ...".
- Naming residuals: the residual names `parallel()` and `pipeline()` and says Claude Code's never reject.
- Kept unchanged: canary results, the non-recoverable code list, the 3.10.1 citations, the official-script counts (`workflow-agent-failure-canary.mjs` count stays 2).

## Flagged assumptions (from the plan)

- No leading tracer: both tasks write one Markdown page.
- Hooks and skills in the Claude Code column graded "documented upstream for subagents" (A7).
- The engine's path refusal (`workflow`, `pi-dynamic-workflows`, `pi-subagents` segments) is not stated: S5 does not show it.
- Section sits directly before "Host engine requirements".
- Depends on 08-03 for the two cited scenarios; both titles exist verbatim in their feature files.
- Runs beside 08-07 in wave 3; this plan edited no file of 08-07.
- BACKLOG WOUT-01 is out of date (parent line below).

## Deviations from Plan

None - plan executed exactly as written. Small wording choices: the built-in-tools and `workflow`-tools rows use `--` in the Claude Code column (the sources read do not state those for a workflow agent); the "tool list with the adapter loaded" row marks Claude Code `✓` by the existing D-PG4-14 row's 2.1.323 read; a sentence naming the engine 3.15.0 source and README was added to the paragraph listing what the Pi column reflects.

## Parent lines (for the orchestrator; not edited here)

- PROJECT.md decision rows, pending the maintainer's review: D-PG8-08 (as graded: section "What a workflow subagent can reach", docs only), D-PG8-09 (this extension writes no engine setting; the page tells the user what to set), D-PG8-10 (as refined: Claude Code's `parallel()`/`pipeline()` never reject; the engine rejects on its non-recoverable class).
- BACKLOG: mark WOUT-01 out of date (workflow subagents get Pi's tools since engine 3.13.1). Add to WFLENGINE-01, if not listed, the three PRD section 8.4 requests this phase depends on and does not draft (D-PG8-17): an unknown `agentType` throws; `parallel()` and `pipeline()` return `null` and never reject; `builtin:mcp` in subagents.
- CHANGELOG: the workflow compatibility page now says what a workflow subagent can reach, and which engine settings give it MCP tools and the session's model.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-12 (row on the tool list with the adapter loaded, README "no sandbox" quote, D-PG4-14 pointer), T-08-13 (project settings file and the trust quote), T-08-14 (closing statement not to list this extension), and T-08-15 (every claim graded; adapter row copied from the S5(b) verdict) are mitigated as planned.

## Self-Check: PASSED

- `docs/workflows-compatibility.md` contains `## What a workflow subagent can reach`.
- Commits `169ed5fb` and `a75956d6` are ancestors of HEAD.
