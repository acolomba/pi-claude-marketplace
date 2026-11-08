---
phase: 16-background-child-load
plan: 01
subsystem: testing
tags: [cucumber, pi-subagents, background-child, reconcile, hooks]

requires:
  - phase: 01-foundation
    provides: "the background-child profile Pi (D-BG-10), the json-mode one-shot Pi (D-BG-09), the release 0.19.2 mcp.json writer, and the seed in features/plugin/subagent-child.feature"
provides:
  - "Four scenarios in features/plugin/subagent-child.feature that pin the load of a pi-subagents background child (CHILD-01, CHILD-02)"
  - "Red proofs M1-M5 for them, and a re-run of the MGRT-02 grant scenario's red proof (M3)"
affects: [the load path (Phases 7, 8, 9), the hook phases (2-6)]

actuals:
  tasks: 3
  commits: 3
plan_head_before: 45c7d47e
plan_head_after: ad7359f0

tech-stack:
  added: []
  patterns:
    - "A child scenario proves both halves in one run: the child's load leaves the change, and a one-shot json-mode parent then makes it"

key-files:
  created: []
  modified:
    - features/plugin/subagent-child.feature

key-decisions:
  - "The json-mode parent records only its own command's payload, so the parent half of D-BG-1602 is checked through the list rows and the installation record, not through the load's results (corrects the CONTEXT wording)"
  - "No product change: the child gates already behave as D-MB-12 requires"

requirements-completed: [CHILD-01, CHILD-02]
---

# Phase 16 Plan 01: Background-Child Load Summary

**Four scenarios pin that a pi-subagents background child changes nothing installed, yet still loads the installed plugins' skills, slash commands, and hooks; each fails under a recorded mutation.**

## Accomplishments

- Scenario A (rewrites the Phase 1 seed): with autoapply on, the child's load reports a pending install, uninstall, and update twice (Pi runs the load twice for one RPC new session), the installation record keeps `old@fixtures` and `upd@fixtures` at 1.0.0, and the next parent load (a one-shot Pi in json mode running `/claude:plugin list`) applies all three: demo installed 1.0.0, old available, upd installed 1.1.0.
- Scenario B (`@own-implementation`): the child reports no results and leaves a release 0.19.2 `mcp.json` and the stripped `mcp-adapter.json` as they were; the json-mode parent then moves the entry.
- Scenario C: the child's session offers the plugin's skill and lists its slash command.
- Scenario D: the child runs the plugin's PreToolUse hook on a bash call its scripted model makes (upstream runs plugin tool hooks inside subagents, code.claude.com/docs/en/hooks).
- The grant half of CHILD-02 stays pinned by the unowned MGRT-02 scenario in `features/mcp-server/agent-grants.feature`; its red proof was re-run (D-BG-1604).

## Task Commits

1. **Task 1: scenario A** - `4edee03b` (test)
2. **Task 2: scenario B, grant red proof** - `5fea0fac` (test)
3. **Task 3: scenarios C and D** - `ad7359f0` (test)

## Scenarios and red proofs

All mutations ran in an untracked scratch copy of the tree (node_modules linked), were restored and checked with `cmp`, and the copy was removed; `git diff HEAD -- extensions/` stayed empty. All runs: `npx cucumber-js --profile adapter --parallel 2 --format progress`.

| Scenario | Mutation | Red run | Green run |
|---|---|---|---|
| A: leaves a pending install, uninstall, and update for the next parent load | M1: `load.ts` child branch falls through to `loadReconcileWithReader` | `a-m1` exit 1, `1 scenario (1 failed)`, fails at `Then the session reports these results:` (the child applied, so no pending block) | `a-green` exit 0, `1 scenario (1 passed)`; control in the unmutated copy `a-control` exit 0 |
| B: moves no mcp.json entry | M2: `readOnlyPass(reader, SCOPES, opts)` without `NO_MCP_MOVE` | `b-m2` exit 1, `1 scenario (1 failed)`, fails at the first `Then the mcp configuration file "mcp.json" ...` (the child moved `srv`); `the session reports no results` still passed, because the move happened at the child's start load | `b-green` exit 0, `1 scenario (1 passed)` |
| MGRT-02 grant scenario (unowned) | M3: `agent-grants-step.ts` gate reduced to `active === "none"` | `grant-m3` exit 1, `1 scenario (1 failed)`, fails at `Then the model receives these calls:` (the tool result names `mcp:plugin_demo_stub/echo`) | `grant-green` exit 0, `1 scenario (1 passed)` |
| C: offers the skill and the slash command | M4: `resources_discover` returns no paths in a child (`index.ts`) | `cd-m4` exit 1, `2 scenarios (1 passed, 1 failed)`, C fails at `Then the session offers these skills:` | `cd-green` exit 0, `2 scenarios (2 passed)` |
| D: runs the PreToolUse hook | M4 plus M5: the hooks bridge is not registered in a child (`index.ts`) | `cd-m4`: D stays green, because the hooks bridge registers at factory time; `cd-m45` exit 1, `2 scenarios (2 failed)`, D fails at `Then the hooks record these runs:` | `cd-green` exit 0 |

Whole file: `file-green` exit 0, `4 scenarios (4 passed)`. `npm run check:features` exit 0 after each task. Run outputs: `/tmp/claude-1000/bg-phase-16/p16-01-*.out` (tasks 2-3) and the shared scratchpad's `phase16/p16-01-a-*.out` (task 1). No run needed a rerun.

## Validation map

| Task ID | Requirement | Status |
|---|---|---|
| 16-01-01 | CHILD-01 | green, red under M1 |
| 16-01-02 | CHILD-02 | green, red under M2 |
| 16-01-03 | CHILD-02 | green, red under M4 |
| 16-01-04 | CHILD-02 | green, red under M4 with M5 |
| 16-01-05 | CHILD-02 | green, red under M3 |

## Deviations from Plan

- The plan's executor was interrupted twice (the orchestrator's subagents run in the background and stopped mid-task); the orchestrator finished Tasks 2 and 3 inline with the same commands and mutations. Two executors briefly overlapped in Task 2: one appended scenario B twice and cut it back to one copy (checked against RESEARCH.md lines 391-473), and the second task-1 commit attempt failed on `index.lock` while the first one held it. No content was lost.
- Task 2-3 run outputs live in `/tmp/claude-1000/bg-phase-16/`, not in the plan's shared scratch directory.

## Real `~/.pi`

`find ~/.pi -newer <stamp>` found no file changed during the plan's runs.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

None. No frozen file, CHANGELOG, README, PROJECT.md Key Decisions, or BACKLOG line is needed. The frozen `.agents/skills/cucumber/rules/layout.md` "Seeds" list still names the seed's old title, "A background child's load leaves a declared plugin pending while autoapply is on"; the parent may update it to scenario A's title at the merge (optional).

## Dubious Choices

- Red proofs ran in a scratch copy, not in the worktree (P16-DC-08).
- Scenario D's red proof needs M5 on top of M4 (P16-DC-09).
- The plan was finished inline by the orchestrator after the subagent executors were stopped (P16-DC-17).
- Two executors overlapped briefly in Task 2; one trimmed a duplicated scenario B (P16-DC-18).
