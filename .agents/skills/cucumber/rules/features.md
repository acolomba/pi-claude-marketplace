# Feature files

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

A feature file describes one user-visible capability from the outside. A reader who never opens a step definition must understand what each scenario proves. Where a feature file lives and how it is named is in `.agents/skills/cucumber/rules/layout.md`.

```gherkin
Feature: Orders checkout

  Checkout turns the lines a customer picked into a placed order.
  The scenarios run against a fake of the Acme payments API.

  Scenario: The placed order prices every line
    Given the order holds these lines:
      | item  | quantity | price |
      | apple | 2        | 2     |
      | pear  | 1        | 3     |
    When the customer places the order
    Then the order has these lines:
      | item  | quantity | subtotal |
      | apple | 2        | 4        |
      | pear  | 1        | 3        |
```

## Feature description

- Every feature has a description of two or three lines under the title.
- The description says what the feature protects and what the scenarios stand in for, such as a fake service in place of a vendor's.

## Scenarios

- Titles use sentence case and name the behavior. No `works`, `happy path`, `test`, or ticket and plan references.
- One scenario proves one behavior. A scenario that needs a second `When` to prove its point usually hides a second behavior; split it.
- A `Scenario Outline` is for three or more variants of one behavior. Its `<placeholder>` names say what each value is: `<quantity>`, not `<n>`.

## Steps

- Steps are entirely lower case after the keyword, so one step never appears in two spellings. Quoted values keep their own case.
- Use `Given`, `When`, and `Then` only. Never `And` or `But`; repeat the keyword, so every step states its own role and moving a line never changes what it means.
- Order: every `Given` comes before the first `When`. After that, `When` and `Then` may alternate, and no `Given` follows a `When`: setup after an action belongs to a second behavior and a second scenario.
- `Given` states a precondition as a fact.
- `When` states one action by a named actor in the present tense.
- `Then` states an observable outcome in the present tense. Never `should`.
- Use the definite article for a specific thing and `these` to introduce a data table (`these <things>:`), so the step reads as continuing into the table below it.
- Be concise and use active verbs. Use the passive voice only when the actor is unknown.
- Steps name user-visible things only: commands the user types, results the user sees, files the user owns. They never name temporary paths, process handles, or implementation modules.

## Data tables

- Header cells name the fields of the thing they describe in lower-case words: `unit price` for `unitPrice`.
- A table lists every row the outcome contains, not a sample. The step compares the whole set.
- Align the columns.

## Background

- A `Background:` holds `Given` steps only, and only those that every scenario in the file needs. Anything more moves part of a scenario's point out of the scenario.
