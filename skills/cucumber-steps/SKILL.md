---
name: cucumber-steps
description: Rules for cucumber-js step definitions and their support code -- the .steps.ts module family, named step functions, the per-scenario world, and fakes for external services. Apply when writing or changing features/steps/**/*.steps.ts or features/support/**/*.ts.
---

# Cucumber step definitions and support

Step definitions drive the real code through its public surface against local stand-ins for every external service. No scenario needs an account, hardware, or the public network.

## Tools

Use `@cucumber/cucumber` for the runner, `node:assert/strict` for assertions, and the world for scenario state. Node runs the `.ts` files directly.

```bash
npm run test:cucumber
```

## Module families

Cucumber loads exactly two kinds of module, and `cucumber.json` names both under `import`:

| File                             | Holds                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `features/steps/<area>.steps.ts` | Step definitions: named step functions and their `Given`/`When`/`Then` registration.                                      |
| `features/support/world.ts`      | The world class, `setWorldConstructor()`, `Before()`/`After()` hooks, `setDefaultTimeout()`, and `defineParameterType()`. |

Every other `.ts` file under `features/support/` is plain support code: fakes, fixtures, and drivers. Cucumber never loads it directly; a step module or the world imports it.

- The `.steps.ts` suffix is mandatory for step modules, and only step modules use it.
- A step module lives under `features/steps/`, never under `features/support/`.
- A support module never calls `Given`, `When`, `Then`, `Before`, or `After`.

## Step modules

- Name a step module after the function of its steps, not after a feature file: `commands.steps.ts` runs commands, `results.steps.ts` checks results. A step used by several features lives in one module.
- Start each module with an `@fileoverview` that says what its steps own.
- A step module exports nothing. A helper that two step modules need moves to `features/support/`.
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

- `features/support/world.ts` declares the world class and registers it. Every scenario gets a fresh world.
- Keep scenario state on the world as initialized fields; no module-level mutable state anywhere under `features/`.
- The world owns the lifetime of everything a scenario creates (temporary directories, fakes, child processes) and releases it in an `After()` hook, in reverse order of creation.
- A step timeout above the default is a named constant with a comment that says why.

## Fakes and drivers

- Fake every external service the code talks to with a local stand-in in its own module under `features/support/`, named after what it stands in for (`marketplace-fixture.ts`).
- A fake records what it receives and can be armed to fail, so scenarios cover error paths.
- A driver that runs the code under test (`pi-commands.ts`) validates what it returns against the published contract, such as a JSON schema, before a step reads it.

## Errors

- Do not catch exceptions in step or support code to log them. Let them bubble up: the stack trace is more useful than a log line.
