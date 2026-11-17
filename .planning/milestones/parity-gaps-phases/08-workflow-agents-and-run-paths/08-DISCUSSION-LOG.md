# Phase 8: Workflow Agents and Run Paths - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 08-workflow-agents-and-run-paths
**Areas discussed:** S5 gate and sequencing, agent type binding proof, missing agent type note, run-path scenarios, subagent reach page, `Workflow` grant mapping, grant condition, launch mode, proof
**Mode:** `--auto`. Every area was auto-selected and took the recommended (upstream-parity) option. Every decision is pending maintainer review. Upstream evidence: Claude Code 2.1.323 binary grep, 2026-11-14; PRD and research reports of the milestone.

---

## S5 gate and sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first in plan 01; WF-05 plan conditional with a maintainer checkpoint on a negative result | Follows the run's instruction; plan exists but changes nothing if S5(a) fails | ✓ |
| Write no WF-05 plan until S5 runs | ROADMAP's literal sequencing; needs a second planning run | |
| Run S5 during research | Not the instructed placement | |

[auto] S5 gate — Q: "How does S5 gate WF-05?" → Selected: "Spike first; conditional plan with checkpoint" (recommended default; product: sequencing)

## Agent type binding proof (WF-02 a)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated guard scenario, unrestricted fixture agent, body in the model call | Own named proof; no SEC-01 note muddles it | ✓ |
| Cite the Phase 7 agent-steps scenarios | Already show a body, but not titled for WF-02 | |

[auto] Binding proof → Selected: "Dedicated guard scenario" (recommended default)

## Missing agent type note (WF-02 b)

| Option | Description | Selected |
|--------|-------------|----------|
| Literal `<plugin>:` names that match no installed agent; one note per (script, type) pair | Truthful, never false; mirrors D-PG4-11/12 | ✓ |
| Any literal that matches no agent of the plugin, including bare names and other plugins | False notes for names another install provides | |
| Refuse the install | Upstream fails at run, not at load; a note never refuses | |

[auto] Missing note → Selected: "Own-namespace literals, one note per pair" (recommended default; wording pending maintainer review)

## Run-path scenarios (WF-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Guard scenarios pinning today's behavior, titles name upstream differences, mutation recorded in SUMMARY | No behavior change in scope | ✓ |
| Change behavior to parity where it differs (worktree cleanup, duplicate names) | Engine-owned or decision 14; out of scope | |

[auto] Run paths → Selected: "Guard scenarios" (recommended default)

## Subagent reach page (WF-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Docs section only; adapter setting graded by S5; extension writes no engine setting | NFR-10; the engine settings are the user's | ✓ |
| Write the engine settings at install | Outside containment; not asked | |

[auto] Reach page → Selected: "Docs only" (recommended default)

## `Workflow` grant mapping (WF-05)

| Option | Description | Selected |
|--------|-------------|----------|
| `Workflow` and `Workflow(<name>)` both map to `workflow`; specifier not applied | Upstream specifier is a pre-approval rule; Pi asks no approval (D-CF7-01); matches D-PG7-08 shape | ✓ |
| Drop `Workflow(<name>)`, map bare only | Loses the grant for agents that list only the specifier | |

[auto] Grant mapping → Selected: "Both map to `workflow`" (recommended default)

## Grant condition

| Option | Description | Selected |
|--------|-------------|----------|
| Map whenever granted; fall back to "only when the plugin stages a workflow" if pi-subagents refuses a launch with a missing provider | Upstream grants the tool regardless | ✓ |
| Map only when the plugin stages a workflow | Requirement text; narrower than upstream | |

[auto] Grant condition → Selected: "Map whenever granted, with researched fallback" (recommended default; product)

## Launch mode

| Option | Description | Selected |
|--------|-------------|----------|
| `async: true` like MCP-granted agents (D-CF6-10) | Requirement says background; extension tools reach background children | ✓ |
| Leave to pi-subagents' default | A foreground default would lose the tool | |

[auto] Launch mode → Selected: "`async: true`" (recommended default)

## Proof

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + `subagent get` scenario + live real-child run (cucumber if the harness can, else integration) | Matches criterion 5 and the Phase 7 precedent | ✓ |
| Unit and `subagent get` only | Misses the live run the criterion asks for | |

[auto] Proof → Selected: "Unit, scenario, live run" (recommended default)

## Claude's Discretion

Plan split, helper names, feature file placement, note wording within the style guide.

## Deferred Ideas

PG-WF-03, PG-WF-06, decision 14, a `MODEL_NOT_FOUND` note for `--map-model` agent types, new engine requests, `Workflow` in the hook tool table.
