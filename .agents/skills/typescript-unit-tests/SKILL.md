---
name: typescript-unit-tests
description: Unit test rules for this TypeScript project -- which test modules exist, how source is shaped for them, how cases, doubles, and boundaries are written, and how to review them. Use when planning, writing, changing, or reviewing extensions/pi-claude-marketplace/**/*.ts or test/**/*.ts.
---

# TypeScript unit tests

Every case must discriminate the behavior named in its title: a wrong implementation makes the assertion fail. A test with weak assertions costs all the maintenance of a test and gives none of the protection. A planned case names the behavior it proves; a verified case would fail if that behavior broke.

In the rules files, "Do" and "Do not" are hard rules. "Prefer" states the default and allows a justified exception. "May" grants a permission.

Use `node:test` for the runner, lifecycle, and the context's `t.mock`; `node:assert/strict` for assertions; `strong-mock` for strict interaction mocks; `--experimental-test-coverage` for coverage. Do not add another runner, assertion library, or mocking library.

## Read before you act

| When you                                                                                   | Read                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| plan, add, move, or rename a source or test module                                         | `.agents/skills/typescript-unit-tests/rules/pairing-and-design.md` |
| write the imports of a test module                                                         | `.agents/skills/typescript-unit-tests/rules/tools.md`              |
| write or change a test case                                                                | `.agents/skills/typescript-unit-tests/rules/cases.md`              |
| use a fake, a spy, or a `strong-mock` mock                                                 | `.agents/skills/typescript-unit-tests/rules/test-doubles.md`       |
| test a type-only module, a barrel, the filesystem, HTTP, time, env, or an adapter contract | `.agents/skills/typescript-unit-tests/rules/boundaries.md`         |
| review a case or a source-test pair, or classify a finding                                 | `.agents/skills/typescript-unit-tests/rules/review.md`             |
| run tests or decide which checks a task needs                                              | `.agents/skills/local-verification/SKILL.md`                       |

## Where a test goes

Put each test case where it can observe the behavior it checks:

- A behavior that a user can see is a cucumber scenario under `features/`.
- A behavior of one source module is a unit test in the test module that pairs with that source module under `test/`.
- A structural invariant that must hold across the whole source tree, or a contract between modules that no single source module owns, is an architecture test under `test/architecture/`.
- A case goes in `test/integration/` only when neither a scenario nor a unit test can observe what it checks. It must be one of these:
  - Peer conformance: it runs a peer's own code (Pi, pi-mcp-adapter, pi-subagents, or the workflow engine) on what this extension writes.
  - Multi-process: two or more processes race, or one process acts on what another process left behind.
  - Internal: it reads a stored record field that no command shows or state that only an earlier release wrote, injects a fault, or checks a call or a write that must not happen.
  - Known bug: it guards a bug that has an entry in `.planning/BACKLOG.md`, until the fix lands.
- The first comment of each integration file names its class and the behavior that cucumber does not cover. A file that guards a known bug also names the BACKLOG ID.
- A case that fits none of these classes moves to the unit test of its source pair, or to `test/architecture/` when no single source pair owns it. If a scenario or a unit test already covers the case, delete it: first break the behavior on purpose, see that scenario or test fail, and undo the break.

## Review

The central question for every case: **would a plausible wrong implementation still pass it?** A weak assertion is the highest-value finding.
