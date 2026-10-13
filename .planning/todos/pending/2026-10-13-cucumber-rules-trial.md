---
created: 2026-10-13
source: cucumber JSON behavioral-test spike (branch features/cucumber-behavioral-tests)
---

# Try the cucumber rules on the behavioral-test POC

The spike added cucumber scenarios for `plugin install`, `uninstall`, and `update` that drive a headless Pi in RPC mode and assert on the JSON entries (`features/`). The rules that govern them are written but not yet applied or enforced:

- `skills/cucumber-features/SKILL.md` -- `features/**/*.feature`
- `skills/cucumber-steps/SKILL.md` -- `features/steps/**/*.steps.ts`, `features/support/**/*.ts`
- `skills/cucumber-review/SKILL.md` -- review of both
- `.claude/rules/cucumber-features.md`, `.claude/rules/cucumber-steps.md` -- path-scoped pointers
- `features/AGENTS.md` -- the file families, for Claude Code and Codex
- `.planning/config.json` `agent_skills` -- writers get features + steps, `gsd-code-reviewer` and `gsd-verifier` get review

## 1. Migrate the POC to the layout -- done

The step modules live in `features/steps/*.steps.ts`, `cucumber.json` imports only those and `features/support/world.ts`, and the review with `skills/cucumber-review/SKILL.md` is applied: 13 scenarios pass. The review also tightened the scenarios -- a new session must offer the installed skill (and its version), every plugin table names `id`, `status`, and `reasons`, and every result states `severity`, `needsReload`, `noOp`, and `summary` in full. The two known gaps became rules: a directory stand-in is a fixture, not a fake that is armed to fail, and a driver may reuse the `tests/e2e/` process harness.

## 2. Enforce what a tool can check

Prose rules drift; each item below turns one into a gate in `npm run check:static`. Do not commit negative controls for these gates (CONVENTIONS.md): the run over the real tree is the proof, plus a one-off local check that each gate fails on a planted violation.

1. **ESLint block for `features/steps/**/*.steps.ts`** (`no-restricted-syntax`):
   - `CallExpression[callee.name=/^(Given|When|Then)$/] > :matches(ArrowFunctionExpression, FunctionExpression)` -- inline step bodies; require a named function.
   - `CallExpression[callee.name='Then'] > Identifier:not([name=/^assert[A-Z]/])` and `CallExpression[callee.name=/^(Given|When)$/] > Identifier[name=/^assert[A-Z]/]` -- role names.
   - `ExportNamedDeclaration`, `ExportDefaultDeclaration` -- step modules export nothing.
   - `CallExpression[callee.name=/^(Given|When|Then)$/] > Literal[regex]` -- Cucumber expressions only.
2. **ESLint block for `features/support/**/*.ts` except `world.ts`** (`no-restricted-imports`): ban `Given`, `When`, `Then`, `Before`, `After`, `BeforeAll`, `AfterAll`, `setWorldConstructor`, `defineParameterType` from `@cucumber/cucumber`.
3. **`scripts/check-features.mjs`** (parse with `@cucumber/gherkin`, already installed by `@cucumber/cucumber`):
   - Layout: under `features/`, a file is `*.feature` (outside `steps/` and `support/`), `steps/*.steps.ts`, `support/**/*.ts` without `.steps.`, or `AGENTS.md`. Anything else fails.
   - File name equals the kebab-cased `Feature:` title; one feature per file; non-empty description.
   - No `And`/`But` keyword; step text starts lower case; no `should` in step text; no `Given` after a `When`; `Background` holds `Given` only.
   - Scenario titles start with an upper-case letter.
4. **Step usage**: `cucumber-js --dry-run --format usage-json:<tmp>` (or `--format message`) in the same script, failing on an undefined, ambiguous, or unused step definition. Dry run loads the modules but runs no step, so it fits `check:static`.

The `npm-check` hook already covers `features/**`. Add the new script to the `check:static` list in `package.json`.

## 3. Upstream

When the rules hold on the POC, port the three skills, the two rule files, `features/AGENTS.md`, the `cucumber.json` import list, the ESLint blocks, and the gate script to `acolomba/blueprint-typescript` on draft PR #7 (`features/cucumber-step-naming`), replacing its single `cucumber-behavioral-testing` skill. Its generated greeting example moves to `features/steps/greeting.steps.ts`.

## Open questions

- Should `agent_skills` load the cucumber skills into every executor, or only when a plan touches `features/`? Today the unit-testing skill loads unconditionally, so this follows that precedent at some prompt cost.
- Pi reads only the root `AGENTS.md` and lists `.claude/rules/` without applying `paths`, so for Pi the root `AGENTS.md` skill list is the only path-scoped pointer.
