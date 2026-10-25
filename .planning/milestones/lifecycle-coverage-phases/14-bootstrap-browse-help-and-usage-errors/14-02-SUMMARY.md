---
phase: 14-bootstrap-browse-help-and-usage-errors
plan: 02
subsystem: edge argument parsing
tags: [cucumber, usage-error, parity]
requires: [14-01]
provides:
  - "rejectUnknownFlag helper in edge/handlers/shared.ts"
  - "features/plugin/usage-errors.feature: unknown flag, too many arguments, bad --scope, --scope with no value for every plugin subcommand"
key-files:
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/{bootstrap,import,browse,help,list,pending,install,info}.ts
    - test/edge/register.test.ts
    - features/plugin/usage-errors.feature
requirements-completed: [USE-01]
completed: 2026-10-23
---

# Plan 14-02 Summary: plugin usage rejections

**Every plugin subcommand now rejects an unknown flag as `Unknown flag: "<flag>".` and a surplus
positional as `Too many arguments.`, the wording the marketplace subcommands use, and each
rejection kind has a Scenario Outline row per subcommand and alias.**

## Commits

- `26e8e699` fix(edge): reject plugin flags and extra arguments in one wording
- `17499519` test(features): cover every plugin subcommand usage rejection

## What changed (D-03..D-07)

| Subcommand | Before | After |
| --- | --- | --- |
| `import --bogus` | `import does not accept positional arguments.` | `Unknown flag: "--bogus".` |
| `browse --bogus`, `browse --scope user` | `browse takes no arguments.` | `Unknown flag: "<flag>".` |
| `help marketplace --bogus` | `Unknown help topic: "marketplace --bogus".` | `Unknown flag: "--bogus".` |
| `help marketplace extra` | `Unknown help topic: "marketplace extra".` | `Too many arguments.` |
| `list`/`ls`/`pending --bogus` | `Unknown option: "--bogus".` | `Unknown flag: "--bogus".` |
| `install`/`info p@m extra` | `<verb> requires exactly one <plugin>@<marketplace> argument.` | `Too many arguments.` |

Zero-operand subcommands keep their own surplus sentence (D-05). `install`/`info` keep their
missing-operand sentence (D-04). `help` now tokenizes its argument, so `help ""` is an unknown
topic `""` rather than the raw text.

New helper `rejectUnknownFlag(tokens, {ctx, run, usage})` in `edge/handlers/shared.ts`, used by
bootstrap, import, browse, and help; it replaced a clone group fallow found between browse and
help. `COMMAND_ARGUMENT_CASES` in `register.test.ts` drops the overrides that now equal the
shared sentences, and the echo-the-token diagnostic helper that only help used.

Scenarios: four new outlines (27 + 17 + 25 + 14 rows) beside the four existing ones; 106
scenarios pass.

## Deviations

- The first commit failed fallow's duplication gate (`dup:48fe789f`, browse.ts and help.ts);
  extracted `rejectUnknownFlag` and recommitted.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
