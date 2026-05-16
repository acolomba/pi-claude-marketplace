# Quick Task 260515-wpe: Clarify marketplace/plugin scope rules - Plan

**Date:** 2026-05-15
**Status:** Ready

## Goal

Update the project specifications so marketplace scope, plugin install scope, dual-scope plugin installs, precedence, and tab completion behavior are explicit.

## Tasks

1. **PRD scope contract**
   - Files: `docs/prd/pi-claude-marketplace-prd.md`
   - Action: Add explicit cross-scope marketplace visibility and plugin target-scope rules; tighten install completion to available plugins only.
   - Verify: New rules cover user/project marketplace add, project install from user marketplace, user install restrictions, dual-scope plugin installs, project precedence, and completion.

2. **Planning/spec mirrors**
   - Files: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
   - Action: Record the decision and mirror the new requirement summaries/success criteria.
   - Verify: Behavioral Gap 4 is resolved and D-26 captures the full rule set.

3. **User-facing docs + task record**
   - Files: `README.md`, `.planning/STATE.md`, `260515-wpe-SUMMARY.md`
   - Action: Document practical scope behavior and record the quick task.
   - Verify: README examples explain when `--scope project` can use a user marketplace and how to target user-scope shadowed installs.
