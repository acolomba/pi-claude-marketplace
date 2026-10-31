---
name: babysit-pr
description: After a PR is opened (e.g. by /gsd-ship), drive it to a clean state -- pass the project's review skills and the pr-review-toolkit review, then get the SonarQube PR quality gate green, and, when the branch ships a GSD milestone, close that milestone last so the planning records describe the final head -- with the heavy work delegated to subagents. Invoke manually; not automatic.
argument-hint: "[PR number] (defaults to the current branch's PR)"
disable-model-invocation: true
model: sonnet
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, Agent, Skill, mcp__sonarqube__*
---

# Babysit PR

Run every subagent this skill spawns on Sonnet in Claude Code, or on gpt-5.6-terra where Sonnet is not offered.

Take an already-open pull request and harden it in three phases: a local **review-convergence** loop, a **SonarQube** pass once CI has analyzed the pushed head, and a **milestone closeout** when the branch ships a GSD milestone. The point is to hand a human reviewer a PR that already clears the automated bars, with the expensive review and fixing done in subagents rather than in this conversation's context.

Invoke this yourself after the PR exists (`$ARGUMENTS` is an optional PR number; default to the current branch's PR). It is safe to re-run -- a clean PR converges to a no-op.

Follow `.agents/skills/babysit-pr/rules/procedure.md` step by step.
