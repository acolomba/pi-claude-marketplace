---
phase: 11-skills-commands-and-records
plan: "01"
subsystem: commands
status: complete
tags: [commands, aliases, PG-CMD-09, D-PG11-01]
requires: []
provides:
  - claudeCommandName(plugin, source) in domain/name.ts
  - CommandRecord.claudeName, written at staging
  - the stored Claude Code name as a command alias source
affects:
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts (plan 11-02 edits it again)
tech-stack:
  added: []
  patterns:
    - a stored value is checked again when read (plugin prefix, no whitespace)
key-files:
  created: []
  modified:
    - features/slash-command/aliases.feature
    - extensions/pi-claude-marketplace/domain/name.ts
    - test/domain/name.test.ts
    - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
    - test/bridges/commands/command-record.test.ts
    - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
    - test/bridges/commands/staged-command.test.ts
    - test/bridges/commands/stage.test.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
    - test/orchestrators/skill-alias-state.test.ts
    - README.md
    - README.es.md
decisions:
  - "The record writer takes `CommandRecord & { readonly claudeName: string }`, so it always writes the three members in one order and has no branch for a missing name; the reader returns `claudeName: undefined` for a record staged before D-PG11-01."
requirements-completed: [PG-CMD-09]
metrics:
  duration: ~45m
  completed: 2026-11-15
actuals:
  tokens: 26000
  tasks: 2
  commits: 2
plan_head_before: 4aabdf393c83306149f3049884b2ad0f366db9b8
plan_head_after: 34d885fb02e22237bc097b70c59488d40c51d1bc
---

# Phase 11 Plan 01: Claude Code's command name as an alias Summary

A bridged command now answers to `/<plugin>:<path>:<file>`, Claude Code's un-elided name for it: the stager stores the name as `claudeName` in the command's install-time record, and the session alias reader adds it under the existing alias rules. The Pi listing name keeps the D-141-01 elision.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 11-01-01 | 3fc210a8 | feat(commands): answer to Claude Code's name for a command |
| 11-01-02 | 34d885fb | docs(readme): describe the Claude Code name alias of a command |

## Red run (before the change)

`npx cucumber-js --profile adapter --name "(PG-CMD-09)" features/slash-command/aliases.feature`, with only the scenario outline added:

```
3 scenarios (1 passed, 2 failed)
39 steps (37 passed, 2 failed)
```

Rows two (`/demo:demo-lint`) and three (`/demo:demo-tools:lint`) failed at `Then the model receives these calls:` (`features/step_definitions/model.steps.ts:135`). The model got the typed text as typed: `'/demo:demo-lint src'` and `'/demo:demo-tools:lint src'`. The expected text was `'Lint the sources.\n\nARGUMENTS: src'`. Row one (`/demo:lint`) passed.

## Green run (after the change)

- The outline gives `3 scenarios (3 passed)`, `39 steps (39 passed)`.
- `features/slash-command/aliases.feature`, `frontmatter.feature`, and `listing.feature` (adapter) give `27 scenarios (27 passed)`. All of `features/slash-command` (adapter) gives `86 scenarios (86 passed)`.
- The five owner tests pass: 378 tests, 0 failed, 0 cancelled.
- The caller owner tests pass: `command-invocation`, `edge/register`, `materialize-latest`, `reinstall-flow`, `typed-expansion`, `edge/skill-aliases`, and `commands/discover`, 667 tests in all.
- Direct coverage is 100% for `domain/name.ts`, `bridges/commands/command-record.ts`, `staged-command.ts`, `stage.ts`, and `orchestrators/skill-alias-state.ts`.
- `npm run typecheck`, ESLint on the changed files, `npm run fallow`, and `npm run check:features` exit 0.
- `git diff --quiet 4aabdf39 -- extensions/pi-claude-marketplace/edge extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts` exits 0.
- The pre-commit hook passed on both commits. The first commit ran `npm run check:commit`.

## Lines for later plans

No name was renamed. The names as they landed:

- `extensions/pi-claude-marketplace/domain/name.ts:546`: `export function claudeCommandName(plugin: string, source: string): string`
- `extensions/pi-claude-marketplace/bridges/commands/command-record.ts:26`: `readonly claudeName: string | undefined;` (schema member `claudeName: Type.Optional(Type.String())` at `:35`)
- `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:169`: `function storedClaudeName(` (module-private, the alias source that `COMMAND_KIND.names` calls before `frontmatterNameAliases`)
- `features/slash-command/aliases.feature:41`: `Scenario Outline: A command answers to its Pi name and to the name Claude Code gives it (PG-CMD-09)`
- README paragraph (English) that later plans may quote: "Claude Code names a command with the plugin name, a colon, and the path of the command file in `commands/` without `.md`, with each `/` changed to a colon. When that name is different from the Pi name, the command also answers to it. For example, `foo-bar` in plugin `foo` is listed as `/foo:bar` and also answers to `/foo:foo-bar`." The same paragraph also adds: "An alias that is the Pi name of another command is not added."

## Deviations from Plan

1. **[Rule 1 - test fidelity] The test "D-CF3-03 stages an inline command's content as the same text as a file holding it" gives the file command the source name `beta`.** The record now holds each command's own Claude Code name, so a file command `deploy` and an inline entry `beta` would no longer stage the same text. The file command now uses `sourceName: "beta"`, so the test still proves what its title says. File: `test/bridges/commands/staged-command.test.ts`. Commit: 3fc210a8.
2. **[Rule 2 - coverage] The `claudeCommandName` cases also run on win32** (`setCasePlatform`), to show that the colon join does not depend on the platform (Pitfall 8). File: `test/domain/name.test.ts`. Commit: 3fc210a8.

The plan also says to add rows "to the table loop" of `test/domain/name.test.ts`. The rows are in a new `describe("claudeCommandName")` block with its own table loop, beside `generatedCommandName`, because the tested function is a different one.

## Maintainer review

- D-PG11-01 is still pending maintainer review. It amends D-141-01 for the alias only, and this plan implements it as recorded.
- The record change is costly to reverse. A release older than this one reads a record that has `claudeName` as no record, so after a downgrade a typed argument loses its `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` fill until the plugin is staged again.
- A command staged before this change gets the alias only when its plugin is staged again. Plan 11-07 adds that note to the CHANGELOG.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-11-01 is mitigated: the writer replaces the whole record key, and an owner case plants a `claudeName` in the source frontmatter and sees it replaced. The reader keeps a stored name only under the plugin's own prefix and with no whitespace, and owner cases cover another plugin's prefix and a name with whitespace. T-11-02 is mitigated: `reserved` and first-claim-wins are unchanged, and owner cases cover the command's own Pi name, another loaded command's Pi name, and a name a skill already claimed. T-11-03 is mitigated: one writer writes the members in a fixed order, the new member is optional in the schema, and owner cases cover the round trip and a record with only the two older members. The session-time reader still imports only `readFile` from `node:fs/promises`.

## Self-Check: PASSED

- All 12 modified files exist.
- Commits 3fc210a8 and 34d885fb are ancestors of HEAD.
