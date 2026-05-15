---
status: complete
phase: 09-reinstall-edge-bulk-ux
source:
  - .planning/phases/09-reinstall-edge-bulk-ux/09-01-SUMMARY.md
  - .planning/phases/09-reinstall-edge-bulk-ux/09-02-SUMMARY.md
  - .planning/phases/09-reinstall-edge-bulk-ux/09-03-SUMMARY.md
  - .planning/phases/09-reinstall-edge-bulk-ux/09-04-SUMMARY.md
started: 2026-05-15T21:59:32Z
updated: 2026-05-15T22:14:52Z
---

## Current Test

[testing complete]

## Tests

### 1. Reinstall Command Forms and Empty Target Behavior
expected: In Pi, `/claude:plugin reinstall`, `/claude:plugin reinstall @<marketplace>`, and `/claude:plugin reinstall <plugin>@<marketplace>` are recognized command forms. With no installed plugins matching the selected target set, the command reports `No plugins installed.` and does not emit a reload hint.
result: issue
reported: "plain reinstall passes; reinstall with a marketplace may well pass, but completion isn't working right. `/claude:plugin reinstall @m` doesn't suggest marketplaces; and also /claude:plugin install suggests plugins that are not available"
severity: major

### 2. Batch Reinstall Output and Reload Warnings
expected: Reinstalling installed plugins reports deterministic `Reinstalled`, `Skipped`, and `Failed` partitions as applicable. One plugin failure does not uninstall or corrupt other plugins, reload hints appear only when generated resources changed, and existing pi-subagents/pi-mcp-adapter soft-dependency warnings appear when relevant.
result: pass

### 3. Scope and Force Flag Handling
expected: `--scope user|project` is accepted before or after reinstall targets and filters the selected installed plugins. Reinstall-specific `--force` is accepted for prior agent-file content that looks foreign, while unknown flags, `--force=true`, invalid refs, and extra arguments show reinstall-specific usage/errors.
result: issue
reported: "for a plugin installed in user scope in a marketplace in user scope, `/claude:plugin reinstall commit-commands@claude-plugins-official --scope project` produced `Error: Marketplace "claude-plugins-official" not found in project scope. Cause: Marketplace "claude-plugins-official" not found in project scope.` this is wrong because a marketplace in user scope can be used to install a plugin in project scope"
severity: major

### 4. Reinstall Tab Completion
expected: Tab completion offers `reinstall` at the `/claude:plugin` top level, completes installed plugin refs only, supports `@<marketplace>` marketplace-wide targets, offers reinstall-specific `--force`, inserts trailing spaces, and preserves existing soft-fail behavior for marketplace/state completion errors.
result: pass

### 5. README Reinstall Documentation
expected: README documents all three reinstall target forms, `--scope user|project`, reinstall-specific `--force`, cached-manifest/no-network behavior, recorded-version preservation, installed-only targeting, no reload hint for empty target sets, and plugin data cleanup only after successful replacement.
result: issue
reported: "README does not cover the cross-scope marketplace behavior discovered during UAT: a user-scoped marketplace can be used as the source when installing or reinstalling into project scope. The reinstall docs only say `--scope` limits reinstall to one scope and do not clarify marketplace source lookup across scopes."
severity: major

## Summary

total: 5
passed: 2
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "In Pi, `/claude:plugin reinstall`, `/claude:plugin reinstall @<marketplace>`, and `/claude:plugin reinstall <plugin>@<marketplace>` are recognized command forms. With no installed plugins matching the selected target set, the command reports `No plugins installed.` and does not emit a reload hint."
  status: failed
  reason: "User reported: plain reinstall passes; reinstall with a marketplace may well pass, but completion isn't working right. `/claude:plugin reinstall @m` doesn't suggest marketplaces; and also /claude:plugin install suggests plugins that are not available"
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "`--scope user|project` is accepted before or after reinstall targets and filters the selected installed plugins. Reinstall-specific `--force` is accepted for prior agent-file content that looks foreign, while unknown flags, `--force=true`, invalid refs, and extra arguments show reinstall-specific usage/errors."
  status: failed
  reason: "User reported: for a plugin installed in user scope in a marketplace in user scope, `/claude:plugin reinstall commit-commands@claude-plugins-official --scope project` produced `Error: Marketplace "claude-plugins-official" not found in project scope. Cause: Marketplace "claude-plugins-official" not found in project scope.` this is wrong because a marketplace in user scope can be used to install a plugin in project scope"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "README documents all three reinstall target forms, `--scope user|project`, reinstall-specific `--force`, cached-manifest/no-network behavior, recorded-version preservation, installed-only targeting, no reload hint for empty target sets, and plugin data cleanup only after successful replacement."
  status: failed
  reason: "User asked whether README covers the cross-scope marketplace behavior; review found it does not. README does not clarify that a user-scoped marketplace can be used as the source when installing or reinstalling into project scope."
  severity: major
  test: 5
  artifacts: []
  missing: []
