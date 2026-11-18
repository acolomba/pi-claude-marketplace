---
phase: quick-261116-im3
plan: 01
status: complete
subsystem: options
tags: [options, mcp, hooks, fail-closed]
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/option-withhold.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/option-withhold.ts
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/domain/user-config.ts
    - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/index.ts
key-decisions:
  - D-PG10-25 locked by the maintainer review 2026-11-16, reversed to fail closed with `{unreadable}`; it amends APL-D1 as D-MB-03 and AMIG-01 do.
---

# Quick task 261116-im3: fail closed on unreadable recorded plugin options

## Per surface

- Load: `(failed) {unreadable}` warning per enabled record, with the parse
  failure and the `reinstall` remedy as cause (`plugin-declarer-unreadable` row).
- `list` / `info`: `{unreadable}` on the record's row, disabled rows included.
- Built-in MCP: servers that name an option are not registered (as before).
- Option variables: none set (as before).
- pi-mcp-adapter: entries that name an option get `disabled: true`, the
  entry's own `disabled` kept in the marker's `withheld`; restored when the
  record reads again. Runs at load after the AMIG-01 move, and at factory time
  for the user scope, because Pi 1.5.0 emits `session_start` (where the
  adapter reads its config) before `resources_discover`. Restage and unstage
  read the user's `disabled` from `withheld`. Skipped in a pi-subagents child.
- Hooks: exec-form hook that names an option fails with
  `UnreadablePluginOptionsError`; hooks that name no option run.
- Content: unaffected (filled at stage time from the manifest).
- `reinstall` / restaging `update`: repair record and entries.

## Verification

- Six new scenarios fail with the production diff reverted and pass with it
  (plugin options x3, hook failures x1, MCP options x2); two repair scenarios
  guard reinstall.
- Paired unit tests with 100% direct coverage for each changed pair.
- `npm run check`: see the gate log `/tmp/qt-ucfg.log`.

## Threat Flags

None -- no security-relevant surface outside the task's scope was introduced.
