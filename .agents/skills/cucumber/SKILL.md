---
name: cucumber
description: Rules for the cucumber behavioral tests under features/ -- which files exist and how they are named, how feature files and step definitions are written, the per-scenario world, stand-ins for external services, and how to review the suite. Use when planning or changing user-visible command behavior, and when planning, writing, changing, or reviewing behavioral tests or any file under features/.
---

# Cucumber behavioral tests

Behavioral tests drive the real code through its public surface against local stand-ins for every external service. No scenario needs an account, hardware, the public network, or the user's home directory. A scenario must fail when the behavior in its title breaks: a `Then` that checks part of a result, or a table that lists a sample of the rows, lets a wrong implementation through.

## Where a test goes

Put each test case where it can observe the behavior it checks:

- A behavior that a user can see is a cucumber scenario under `features/`.
- A behavior of one source module is a unit test in the test module that pairs with that source module under `test/`.
- A structural invariant that must hold across the whole source tree, or a contract between modules that no single source module owns, is an architecture test under `test/architecture/`.
- A case goes in `test/integration/` only when neither a scenario nor a unit test can observe what it checks. It must be one of these:
  - Peer conformance: it runs a peer's own code (Pi, pi-mcp-adapter, pi-subagents, or the workflow engine) on what this extension writes.
  - Multi-process: two or more processes race, or one process acts on what another process left behind.
  - Internal: it reads a stored record field that no command shows, injects a fault, or checks a call or a write that must not happen. State that only an earlier release wrote belongs here only for a stored field that no step shows. What a user sees of that state is a scenario, because the earlier-release writers of the cucumber world rebuild it (`.agents/skills/cucumber/rules/world-and-stand-ins.md`).
  - Known bug: it guards a bug that has an entry in `.planning/BACKLOG.md`, until the fix lands.
- The first comment of each integration file names its class and the behavior that cucumber does not cover. A file that guards a known bug also names the BACKLOG ID.
- A case that fits none of these classes moves to the unit test of its source pair, or to `test/architecture/` when no single source pair owns it. If a scenario or a unit test already covers the case, delete it: first break the behavior on purpose, see that scenario or test fail, and undo the break.

## Read before you act

| When you                                                                            | Read                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| plan features, or add, move, or name any file under `features/`                     | `.agents/skills/cucumber/rules/layout.md`              |
| write or change a `.feature` file                                                   | `.agents/skills/cucumber/rules/features.md`            |
| write or change a step module                                                       | `.agents/skills/cucumber/rules/steps.md`               |
| write or change the world, a hook, a parameter type, a fake, a driver, or a fixture | `.agents/skills/cucumber/rules/world-and-stand-ins.md` |

## Review

A review reads the rules files the change touches; a revision produces the form they describe. Two questions come first:

- **Would a plausible wrong implementation still pass the scenario?** A scenario that checks part of a result is the highest-value finding.
- **Can a reader understand the scenario without opening a step definition?** A step that hides the behavior behind an implementation name, or a scenario whose point lives only in a step's code, is a finding.

Run `npm run test:cucumber`, which runs the adapter profile and then the builtin profile (DUAL-01), and require every scenario to pass under both profiles; a failing, undefined, ambiguous, or pending step is a finding. Run `npm run check:features`, which is part of `npm run check:static`, and require it to pass. It fails on an unused, undefined, or ambiguous step, and on the layout and feature-file rules it can check, which include the MCP implementation tags. Do not use the usage report of the cucumber CLI (`npx cucumber-js --dry-run --format usage`) instead. That report does not check the layout and feature-file rules. The gate also dry-runs every scenario, even if a future `cucumber.json` excludes a tag again, so a step that only excluded rows use still counts as used (D-09).

- **BLOCKER** when the suite lies or leaks: a scenario a plausible wrong implementation still passes, a failing, undefined, ambiguous, or unused step, a scenario that reaches the network, a real account, or the user's home directory, a resource no release frees, or module-level state outside the slow-process exception.
- **WARNING** otherwise: layout, naming, wording, table, and module-structure findings degrade readability, not protection.
