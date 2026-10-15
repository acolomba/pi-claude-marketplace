---
name: cucumber
description: Rules for the cucumber behavioral tests under features/ -- which files exist and how they are named, how feature files and step definitions are written, the per-scenario world, stand-ins for external services, and how to review the suite. Use when planning, writing, changing, or reviewing behavioral tests or any file under features/.
---

# Cucumber behavioral tests

Behavioral tests drive the real code through its public surface against local stand-ins for every external service. No scenario needs an account, hardware, the public network, or the user's home directory. A scenario must fail when the behavior in its title breaks: a `Then` that checks part of a result, or a table that lists a sample of the rows, lets a wrong implementation through.

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

Run `npm run test:cucumber` and require every scenario to pass; a failing, undefined, ambiguous, or pending step is a finding. Run `npx cucumber-js --dry-run --format usage`; a definition it lists as `UNUSED` is a finding.

- **BLOCKER** when the suite lies or leaks: a scenario a plausible wrong implementation still passes, a failing, undefined, ambiguous, or unused step, a scenario that reaches the network, a real account, or the user's home directory, a resource no release frees, or module-level state outside the slow-process exception.
- **WARNING** otherwise: layout, naming, wording, table, and module-structure findings degrade readability, not protection.
