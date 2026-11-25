# Phase 1: Duplicate Integration Files - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 1-Duplicate Integration Files
**Areas discussed:** ITDUP-01 breaks, ITDUP-01 gaps, ITDUP-02 scenario, ITDUP-02 harness, ITDUP-02 breaks, References, Helpers, Process, Gate

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase changes tests, test harness code, and docs, and touches no persisted schema, public contract, or dependency. No question was presented to the user.

---

## Decided autonomously

[auto] [ITDUP-01 breaks] — Q: "Which behaviors of hooks-spawn-end-to-end must a deliberate break prove covered before the file goes?" → Selected: "Five breaks, one at a time: SessionStart spawn and side effect, CLAUDE_PLUGIN_ROOT resolution, timeout read as seconds, a plugin root outside the extension directory, a user-scope SessionStart hook with an empty project scope" (reversible technical — decided autonomously: test approach only; every break is reverted)
[auto] [ITDUP-01 breaks] — Q: "Which scenarios run under each break?" → Selected: "plugin/session-start-hooks.feature plus the features/hook/ scenarios the planner finds for each break, under both profiles, recorded in SUMMARY.md" (reversible technical — decided autonomously: local to the plan)
[auto] [ITDUP-01 gaps] — Q: "What happens when a break fails no scenario?" → Selected: "Add a scenario to plugin/session-start-hooks.feature that fails under that break, then delete the file" (reversible technical — decided autonomously: follows the ROADMAP note; a scenario is cheap to change)
[auto] [ITDUP-02 scenario] — Q: "Where does the empty-body child scenario go?" → Selected: "plugin/subagent-child.feature, tagged @mcp" (reversible technical — decided autonomously: moving a scenario is cheap)
[auto] [ITDUP-02 scenario] — Q: "What does the scenario launch and check?" → Selected: "An ordinary agent with an empty body, tools Bash and Read, calls bash and failing read, under pi-subagents' own default; its four tool runs carry its identity, and no main-session run names a child" (reversible technical — decided autonomously: mirrors the case it replaces)
[auto] [ITDUP-02 harness] — Q: "How does the real-child step get an empty body?" → Selected: "parseRealChildAgents also accepts a fifth body column; tables without it keep today's body" (reversible technical — decided autonomously: internal harness shape)
[auto] [ITDUP-02 breaks] — Q: "Which cases of pi-subagents-child-identity need a deliberate break before the file goes?" → Selected: "All four, each mapped to the scenario that must fail" (reversible technical — decided autonomously: test approach only)
[auto] [References] — Q: "What happens to the docs that cite the deleted files?" → Selected: "docs/mcp-compatibility.md and docs/hooks-compatibility.md cite the scenarios instead" (reversible technical — decided autonomously: doc wording is cheap to change)
[auto] [Helpers] — Q: "What happens to code that only the deleted files used?" → Selected: "It goes with them; features/lib/real-subagent-child.ts stays" (reversible technical — decided autonomously: local deletion)
[auto] [Process] — Q: "Does this phase edit CHANGELOG.md, BACKLOG.md, or the PROJECT.md Key Decisions table?" → Selected: "No CHANGELOG entry; BACKLOG only under rule 4; edits made directly because phases run one after another in one session" (reversible technical — decided autonomously: process choice)
[auto] [Gate] — Q: "How are the checks scheduled?" → Selected: "Focused cucumber runs under both profiles while editing, npm run check at the phase gate, through the non-DAC wrapper" (reversible technical — decided autonomously: scheduling only)

## Claude's Discretion

- Scenario titles and step wording, within the cucumber skill's rules.
- The exact code edit of each deliberate break.
- Plan count and wave split.

## Deferred Ideas

None.
