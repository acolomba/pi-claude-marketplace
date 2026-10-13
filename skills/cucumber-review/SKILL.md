---
name: cucumber-review
description: Review cucumber behavioral tests -- feature files, .steps.ts step definitions, the world, and fakes -- against the project's cucumber rules. Use when reviewing or revising features/**.
---

# Cucumber behavioral test review

When revising, produce the form that `skills/cucumber-features/SKILL.md` and `skills/cucumber-steps/SKILL.md` describe.

The central question for every scenario: **would a plausible wrong implementation still pass it?** A scenario must fail when the behavior in its title breaks. A `Then` that checks one field of a many-field result, or a table that lists a sample of the rows, lets a wrong implementation through; that is the highest-value finding.

The second question: **can a reader understand the scenario without opening a step definition?** A step that hides the behavior behind an implementation name, or a scenario whose point lives only in a step's code, is a finding.

## Verify with the toolchain

Run `npm run test:cucumber` and require every scenario to pass. A failing, undefined, ambiguous, or pending step is a finding, and so is a step definition that no scenario uses.

## Feature files

- One feature per file, named in kebab case after the feature title, with a two- or three-line description.
- Sentence-case scenario titles that name the behavior.
- Lower-case steps; no `And` or `But`; no `should`; no `Given` after a `When`; a `Background` with `Given` steps only.
- Steps name user-visible things only.
- Data tables list every row of the outcome, with lower-case headers that match field names.

## Step modules

- Step definitions live only in `features/steps/*.steps.ts`; support code lives only in `features/support/` and registers no steps or hooks (the world excepted).
- Each step and hook is a named function directly followed by its registration. A `Then` function starts with `assert`, and no other does.
- A step module has an `@fileoverview`, exports nothing, and orders its registrations `Given`, `When`, `Then`.
- A setup `Given` asserts its own success. A `Then` has no side effects and compares whole values.
- Step text uses Cucumber expressions, not regular expressions.

## World and fakes

- Scenario state lives on the world; no module-level mutable state.
- Everything a scenario creates is released in `After()`, in reverse order.
- Every external service has a local stand-in, and a fake for a networked service can be armed to fail; no scenario reaches the network, a real account, or the user's home directory.
- No defensive `try`/`catch` that logs and continues.
