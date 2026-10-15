---
name: typescript-unit-tests
description: Unit test rules for this TypeScript project -- which test modules exist, how source is shaped for them, how cases, doubles, and boundaries are written, and how to review them. Use when planning, writing, changing, or reviewing extensions/pi-claude-marketplace/**/*.ts or tests/**/*.ts.
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

## Review

The central question for every case: **would a plausible wrong implementation still pass it?** A weak assertion is the highest-value finding.
