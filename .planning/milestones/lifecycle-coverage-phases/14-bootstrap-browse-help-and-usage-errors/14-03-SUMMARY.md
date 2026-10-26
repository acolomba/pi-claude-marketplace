---
phase: 14-bootstrap-browse-help-and-usage-errors
plan: 03
subsystem: plugin help and browse
tags: [cucumber, help, browse]
requires: [14-02]
provides:
  - "features/plugin/help.feature"
  - "features/plugin/browse.feature"
key-files:
  created:
    - features/plugin/help.feature
    - features/plugin/browse.feature
requirements-completed: [BRW-01, HLP-01]
completed: 2026-10-23
---

# Plan 14-03 Summary: help and browse

**Plugin help and the browse refusal outside the terminal UI are scenarios, each result
compared whole.**

## Commits

- `98981a74` test(features): cover plugin help and the browse refusal

## Scenarios (7)

- help.feature: `help` and `help help` show the whole plugin usage (`usage-info`); `help bogus`
  is rejected with `Unknown help topic: "bogus".` and the help usage; `/claude:plugin bogus`
  shows the plugin usage with `Unknown subcommand: "bogus".`.
- browse.feature: `browse` and bare `/claude:plugin` in rpc mode are refused with
  `Browse is unavailable in rpc mode. Use /claude:plugin list instead.` and the browse usage;
  `browse extra` is rejected as taking no arguments.

No step module was needed (D-10). The TUI picker is out of scope: the headless driver has no
terminal UI.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
