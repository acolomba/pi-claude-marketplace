# Quick Task 260515-cmp: Implement CMP-1..8 marketplace/plugin scope rules - Plan

**Date:** 2026-05-15
**Status:** Ready

## Goal

Implement the previously documented CMP-1..8 marketplace/plugin scope rules in code, including project-target install fallback to user marketplaces, dual-scope plugin installs, project precedence for unqualified installed-plugin operations, and available-only install completion.

## Tasks

1. **Plugin lifecycle scope resolution**
   - Files: `extensions/pi-claude-marketplace/orchestrators/plugin/*.ts`, `extensions/pi-claude-marketplace/edge/handlers/plugin/*.ts`
   - Action: Split install target scope from source marketplace scope; allow project installs to source user marketplaces when no project marketplace exists; resolve unqualified uninstall/update installed-plugin targets with project precedence.
   - Verify: Target-scope state/resources remain scoped, user-target installs do not read project-only marketplaces, same plugin can be installed in both scopes.

2. **Scope-aware completion filtering**
   - Files: `extensions/pi-claude-marketplace/edge/completions/*.ts`, `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`
   - Action: Parse completion target scope, use CMP-3/CMP-4 source visibility, and make install completions available-only (`status === "available"`) for the current target scope.
   - Verify: `install --scope project` can suggest user-marketplace plugins as fallback; installed/unavailable plugins are excluded.

3. **Regression tests and task record**
   - Files: `tests/**`, `.planning/STATE.md`, `260515-cmp-SUMMARY.md`
   - Action: Add focused tests for CMP-1..8 behavior and update planning artifacts.
   - Verify: Relevant node:test files and `npm run check` pass.
