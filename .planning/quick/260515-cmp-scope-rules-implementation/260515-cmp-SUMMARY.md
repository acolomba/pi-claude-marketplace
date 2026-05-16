# Quick Task 260515-cmp: Implement CMP-1..8 marketplace/plugin scope rules - Summary

**Date:** 2026-05-15
**Status:** Complete

## Summary

Implemented the CMP-1..8 marketplace/plugin scope rules across plugin lifecycle orchestration, edge handlers, and completions.

## Completed

- Split install target scope from source marketplace scope.
- Allowed project-target installs to fall back to user-scope marketplaces when no same-named project marketplace exists.
- Preserved user-target isolation from project-only marketplaces.
- Allowed the same plugin to be installed independently in user and project scopes.
- Added installed-plugin target resolution with project precedence when `--scope` is omitted.
- Updated uninstall/update flows to use the new installed target resolution helpers.
- Updated completion data to follow target-scope/source-marketplace visibility.
- Made install completions available-only and target-scope aware.
- Added CMP regression tests for orchestrators and completions.

## Notes

- `/claude:plugin add` is not a valid top-level plugin command and was not added. The correct plugin install command remains `/claude:plugin install <plugin>@<marketplace>`.
- `marketplace add` remains the only add form: `/claude:plugin marketplace add <source>`.
