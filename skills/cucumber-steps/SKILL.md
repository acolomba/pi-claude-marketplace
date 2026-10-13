---
name: cucumber-steps
description: Rules for cucumber-js step definitions and their library code -- the .steps.ts module family, named step functions, the per-scenario world, and fakes for external services. Apply when writing or changing features/steps/**/*.steps.ts or features/lib/**/*.ts.
---

# Cucumber step definitions and library

Step definitions drive the real code through its public surface against local stand-ins for every external service. No scenario needs an account, hardware, or the public network.

## Tools

Use `@cucumber/cucumber` for the runner, `node:assert/strict` for assertions, and the world for scenario state. Node runs the `.ts` files directly.

```bash
npm run test:cucumber
```

## Module families

Cucumber loads exactly two kinds of module, and `cucumber.json` names both under `import`:

| File                                 | Holds                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `features/steps/<function>.steps.ts` | Step definitions for one vertical function: named step functions and their `Given`/`When`/`Then` registration.            |
| `features/lib/world.ts`              | The world class, `setWorldConstructor()`, `Before()`/`After()` hooks, `setDefaultTimeout()`, and `defineParameterType()`. |

Every other `.ts` file under `features/lib/` is reusable library code. Its name is itself the vertical: the specific thing it drives or stands in for (`lib/pi-process.ts`, `lib/pi-commands.ts`, `lib/path-marketplace.ts`). Name the kind, not the role: `marketplace-fixture.ts` stops saying anything once a git or url marketplace joins the path one. A module that grows splits into `lib/<name>/`. Cucumber never loads library code directly; a step module or the world imports it.

- The `.steps.ts` suffix is mandatory for step modules, and only step modules use it.
- A step module lives under `features/steps/`, never under `features/lib/`.
- A library module never calls `Given`, `When`, `Then`, `Before`, or `After`.

## Step modules

- Organize step modules by vertical function, the user-facing function their steps are about: `plugin.steps.ts`, `marketplace.steps.ts`, `session.steps.ts`, `command.steps.ts`. A step belongs to the function of the thing it names, not to the feature that first used it and not to its keyword.
- Functions can be distinct from feature directories. A step that every feature uses still names its function: running a command and reading its result is the `command` function.
- No catch-all module, in `steps/` or `lib/`: no `common`, `shared`, `utils`, `helpers`, `support`, or `misc`. If a step or helper seems to fit no function, name the function it exercises.
- When a function module grows, split it into `features/steps/<function>/<topic>.steps.ts`.
- Start each module with an `@fileoverview` that says what its steps own.
- A step module exports nothing. A small helper private to one step module may stay in it; once a second module needs it, it moves to `features/lib/`.
- Order the registrations `Given`, then `When`, then `Then`.

## Step functions

- Write each step as a named function declaration with a typed `this`, directly followed by its registration:

  ```ts
  async function runUserCommand(this: PluginWorld, command: string): Promise<void> {
    this.result = await runCommand(this.sandbox, command);
  }

  When("the user runs {string}", runUserCommand);
  ```

  Cucumber binds the world to `this`, so arrow functions do not work, and the name shows up in stack traces.

- Name a `Given` after the thing that is given (`offeredPlugins`, `addedMarketplace`), a `When` after the action (`runUserCommand`), and a `Then` with `assert` plus the condition (`assertSeverity`). Only `Then` functions start with `assert`.

- Keep each step short. `Given` records or sets up the thing given, `When` performs the action, `Then` asserts the condition.

- A `Given` that performs setup asserts that the setup succeeded, so a broken precondition fails in the `Given` and not in a later `Then`.

- A `Then` has no side effects. It reads what the `When` left on the world.

- Assert with `node:assert/strict`, comparing whole values: build the expected record or row set from the step argument and `deepStrictEqual` it against the same projection of the actual value. No `assert.ok(x.includes(...))`.

- Step text uses Cucumber expressions (`{string}`, `{int}`, `{word}`), never regular expressions. A custom parameter type is defined in `world.ts`.

- Every step text matches exactly one definition, and every definition is used by at least one scenario.

## The world

- `features/lib/world.ts` declares the world class and registers it. Every scenario gets a fresh world.
- Write each hook as a named function declaration with a typed `this`, directly followed by its registration, as for steps.
- Keep scenario state on the world as initialized fields. The one module-level state under `features/` is the run's process under test in `world.ts`: it is too slow to start per scenario, so `BeforeAll()` starts it and `AfterAll()` stops it.
- A `Before()` hook resets that process before every scenario: it empties every directory the process reads, starts a new session, and asserts that nothing from an earlier scenario is left. A process left busy or gone by a failed scenario is replaced. Cucumber runs the scenarios in random order, so a reset that leaks fails.
- The world owns the lifetime of everything else a scenario creates (temporary directories, fakes, child processes) and releases it in an `After()` hook, in reverse order of creation.
- A step timeout above the default is a named constant with a comment that says why.

## Fakes and drivers

- Replace every external service the code talks to with a local stand-in in its own module under `features/lib/`, named after the specific thing it stands in for (`lib/path-marketplace.ts`).
- A stand-in for a networked service is a fake: it records what it receives and can be armed to fail, so scenarios cover error paths. A stand-in for local input, such as a marketplace directory, is a fixture: scenarios reach its error paths by writing bad input.
- A driver that runs the code under test (`lib/pi-commands.ts`) validates what it returns against the published contract, such as a JSON schema, before a step reads it.
- A driver may reuse a process harness from `tests/e2e/` rather than copy it. Nothing else under `features/` imports from `tests/`.

## Errors

- Do not catch exceptions in step or library code to log them. Let them bubble up: the stack trace is more useful than a log line.
