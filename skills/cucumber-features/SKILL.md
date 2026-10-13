---
name: cucumber-features
description: Rules for writing Gherkin feature files -- file naming, feature descriptions, scenario titles, step wording, step order, data tables, and backgrounds. Apply when writing or changing features/**/*.feature.
---

# Cucumber feature files

A feature file describes one user-visible capability from the outside. A reader who never opens a step definition must understand what each scenario proves.

## Files

- One `Feature:` per file. Files live under `features/`, in subdirectories by area when there are many.
- The file name is the feature title in kebab case with the `.feature` extension: `Feature: Plugin install` lives in `plugin-install.feature`.
- No other file type sits beside feature files, except `features/AGENTS.md`. Step definitions live under `features/steps/` and support code under `features/support/` (see `skills/cucumber-steps/SKILL.md`).

## Feature description

- Every feature has a description of two or three lines under the title.
- The description says what the feature protects and what the scenarios stand in for (a local marketplace in place of a published one, a fake service in place of the vendor).

## Scenarios

- Titles use sentence case and name the behavior: `Scenario: The user installs a plugin the marketplace does not offer`. No `works`, `happy path`, `test`, or ticket and plan references.
- One scenario proves one behavior. A scenario that needs a second `When` to prove its point usually hides a second behavior; split it.
- A `Scenario Outline` is for three or more variants of one behavior. Its `Examples:` columns use the same names as the step parameters.

## Steps

- Steps are entirely lower case after the keyword. Quoted values keep their own case.
- Use `Given`, `When`, and `Then` only. Never `And` or `But`; repeat the keyword.
- Order: every `Given` comes before the first `When`. After that, `When` and `Then` may alternate, and no `Given` follows a `When`.
- `Given` states a precondition as a fact: `the marketplace "fixtures" offers these plugins:`, `the user has run "..."`.
- `When` states one action by a named actor in the present tense: `the user runs "..."`.
- `Then` states an observable outcome in the present tense: `the result severity is "error"`. Never `should`.
- Use the definite article for a specific thing (`the result`, `the marketplace "fixtures"`) and `these` to introduce a data table (`these plugins:`).
- Be concise and use active verbs. Use the passive voice only when the actor is unknown.
- Steps name user-visible things only: commands the user types, results the user sees, files the user owns. They never name sandbox paths, process handles, or implementation modules.

## Data tables

- Header cells are lower case and use the field names of the thing they describe (`id`, `status`, `version`).
- A table lists every row the outcome contains, not a sample. The step compares the whole set.
- Align the columns.

## Background

- A `Background:` holds `Given` steps only, and only those that every scenario in the file needs.
