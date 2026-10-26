---
created: 2026-10-13
source: cucumber JSON behavioral-test spike (branch features/cucumber-behavioral-tests)
audit_acknowledged:
  milestone: marketplace-features
  at: 2026-10-21
---

# Try the cucumber rules on the behavioral-test POC

> **Status (2026-10-15):** §1, §1b and §2 are done in marketplace-features Phase 1 (`01-suite-foundation`):
> `npm run check:features` in `check:static` (usage gate over every row, layout and Gherkin rules) and the
> `features/` ESLint blocks. Only §3 (the upstream port) remains open.

The spike added cucumber scenarios for `plugin install`, `uninstall`, and `update` that drive a headless Pi in RPC mode and assert on the JSON entries (`features/`). The rules that govern them are written but not yet applied or enforced:

- `skills/cucumber-features/SKILL.md` -- `features/**/*.feature`
- `skills/cucumber-steps/SKILL.md` -- `features/steps/**/*.steps.ts`, `features/lib/**/*.ts`
- `skills/cucumber-review/SKILL.md` -- review of both
- `.claude/rules/cucumber-features.md`, `.claude/rules/cucumber-steps.md` -- path-scoped pointers
- `features/AGENTS.md` -- the file families, for Claude Code and Codex
- `.planning/config.json` `agent_skills` -- writers get features + steps, `gsd-code-reviewer` and `gsd-verifier` get review

## 1. Migrate the POC to the layout -- done

The step modules live in `features/steps/*.steps.ts`, `cucumber.json` imports only those and `features/lib/world.ts`, and the review with `skills/cucumber-review/SKILL.md` is applied: 13 scenarios pass. The review also tightened the scenarios -- a new session must offer the installed skill (and its version), every plugin table names `id`, `status`, and `reasons`, and every result states `severity`, `needsReload`, `noOp`, and `summary` in full. The two known gaps became rules: a directory stand-in is a fixture, not a fake that is armed to fail, and a driver may reuse the `test/e2e/` process harness.

## 1b. Re-lay the POC out by vertical function

`features/AGENTS.md` now organizes features, step modules, and library files by vertical function, with no catch-all module (`common`, `shared`, `utils`, `helpers`, `support`, `misc`). The POC still uses the earlier mechanism-named layout:

- Features: move `features/plugin-{install,uninstall,update}.feature` to `features/plugin/{install,uninstall,update}.feature`.
- Steps: `commands.steps.ts` plus the envelope step of `results.steps.ts` (`the result has these fields:`) become `command.steps.ts`; `the result lists these plugins:` moves to `plugin.steps.ts`; `skills.steps.ts` becomes `session.steps.ts`; `marketplace.steps.ts` stays.
- Library: `lib/marketplace-fixture.ts` becomes `lib/path-marketplace.ts`, because it writes a path-source marketplace and git or url kinds will follow. `lib/pi-process.ts`, `lib/pi-commands.ts`, and `lib/world.ts` keep their names: each already names its vertical. Split one into `lib/<name>/` only when it grows.

## 2. Enforce what a tool can check

Prose rules drift; each item below turns one into a gate in `npm run check:static`. Do not commit negative controls for these gates (CONVENTIONS.md): the run over the real tree is the proof, plus a one-off local check that each gate fails on a planted violation.

1. **ESLint block for `features/steps/**/*.steps.ts`** (`no-restricted-syntax`):
   - `CallExpression[callee.name=/^(Given|When|Then)$/] > :matches(ArrowFunctionExpression, FunctionExpression)` -- inline step bodies; require a named function.
   - `CallExpression[callee.name='Then'] > Identifier:not([name=/^assert[A-Z]/])` and `CallExpression[callee.name=/^(Given|When)$/] > Identifier[name=/^assert[A-Z]/]` -- role names.
   - `ExportNamedDeclaration`, `ExportDefaultDeclaration` -- step modules export nothing.
   - `CallExpression[callee.name=/^(Given|When|Then)$/] > Literal[regex]` -- Cucumber expressions only.
   - Whether a module name is a specific vertical or a test mechanism or too-generic role (`marketplace-fixture`) stays a review finding; the gate only bans the catch-all names.
2. **ESLint block for `features/lib/**/*.ts` except `world.ts`** (`no-restricted-imports`): ban `Given`, `When`, `Then`, `Before`, `After`, `BeforeAll`, `AfterAll`, `setWorldConstructor`, `defineParameterType` from `@cucumber/cucumber`.
3. **`scripts/check-features.mjs`** (parse with `@cucumber/gherkin`, already installed by `@cucumber/cucumber`):
   - Layout: under `features/`, a file is `<function>/*.feature`, `steps/**/*.steps.ts`, `lib/**/*.ts` without `.steps.`, or `AGENTS.md`. Anything else fails, including a `.feature` at the root of `features/`.
   - No path segment under `features/` is a catch-all name: `common`, `shared`, `utils`, `helpers`, `support`, `misc`.
   - File name equals the kebab-cased `Feature:` title without the function word (its directory name); one feature per file; non-empty description.
   - No `And`/`But` keyword; step text starts lower case; no `should` in step text; no `Given` after a `When`; `Background` holds `Given` only.
   - Scenario titles start with an upper-case letter.
4. **Step usage**: `cucumber-js --dry-run --format usage-json:<tmp>` (or `--format message`) in the same script, failing on an undefined, ambiguous, or unused step definition. Dry run loads the modules but runs no step, so it fits `check:static`.

The `npm-check` hook already covers `features/**`. Add the new script to the `check:static` list in `package.json`.

## 3. Upstream

When the rules hold on the POC, port the three skills, the two rule files, `features/AGENTS.md`, the `cucumber.json` import list, the ESLint blocks, and the gate script to `acolomba/blueprint-typescript` on draft PR #7 (`features/cucumber-step-naming`), replacing its single `cucumber-behavioral-testing` skill. Its generated greeting example moves to `features/greeting/greet.feature` and `features/steps/greeting.steps.ts`.

## Open questions

- Should `agent_skills` load the cucumber skills into every executor, or only when a plan touches `features/`? Today the unit-testing skill loads unconditionally, so this follows that precedent at some prompt cost.
- Pi reads only the root `AGENTS.md` and lists `.claude/rules/` without applying `paths`, so for Pi the root `AGENTS.md` skill list is the only path-scoped pointer.
