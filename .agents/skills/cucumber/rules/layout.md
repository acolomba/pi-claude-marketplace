# Layout

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

## Plans

A plan names the features and scenarios it adds by title and the behavior each proves, and the files each lands in. Step text belongs to the writer, under `.agents/skills/cucumber/rules/features.md`.

## File families

Cucumber loads `features/support/**/*.ts` and `features/step_definitions/**/*.steps.ts`, as named under `import` in `cucumber.json`. Library code under `features/lib/` runs only when one of them imports it.

| Path                                            | Holds                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `features/<function>/<capability>.feature`      | One feature of one function.                                                   |
| `features/step_definitions/<function>.steps.ts` | The steps about one vertical function.                                         |
| `features/support/world.ts`                     | The world class, its registration, its release hook, and any run-wide timeout. |
| `features/support/<name>.ts`                    | Hooks and parameter types of one vertical.                                     |
| `features/lib/<name>.ts`                        | Reusable code that registers nothing: drivers, fakes, and fixtures.            |

Run them with `npm run test:cucumber`. A project with an orders function and a fake of the Acme payments API looks like this:

```text
features/
  orders/checkout.feature
  step_definitions/orders.steps.ts
  support/world.ts
  support/acme-payments.ts        # Before() arms the fake on the world
  lib/acme-payments.ts            # the loopback-only fake
  lib/order-lines.ts              # reads order-line tables
```

## Vertical functions

Every file is organized by vertical function: the user-facing function it is about, never the Gherkin keyword, the test mechanism, or the feature file that first needed it.

- A feature lives in the directory of its function. Its file name is its title in kebab case without the function word: `Feature: <Function> <capability>` is `features/<function>/<capability>.feature`. A function directory holds only `.feature` files.
- A step belongs to the function of the thing it names, not to the feature that first used it and not to its keyword.
- A step module can name a function that has no feature directory. A step every feature uses still names its function: running a command and reading its result goes in `command.steps.ts`.
- A support module is named after the specific thing its hooks set up or its parameter types parse, never after the construct: no `hooks.ts` or `parameter-types.ts`.
- A library module's name is itself the vertical: the specific thing it drives or stands in for. Name the kind, not the role: a name that would fit a second kind of the same stand-in says nothing once that second kind arrives.
- No catch-all module in `step_definitions/`, `support/`, or `lib/`: no `common`, `shared`, `utils`, `helpers`, `support`, or `misc`. If a step or helper seems to fit no function, name the function it exercises.
- A module that grows splits into a directory of the same name with files named for their parts: `step_definitions/<function>/<topic>.steps.ts`, `support/<name>/`, `lib/<name>/`.
- When several verbs of one function share steps, a topic module under `step_definitions/<function>/` holds the shared steps, and each verb has its own `<verb>.steps.ts` beside it. For marketplaces, `marketplace/publishing.steps.ts` holds the shared steps. A shared topic module never takes the name of a verb (D-08).
- The step text of a verb module names its verb, so two verb modules never define the same text. When a second verb needs a step of a verb module, the work that finds the second use moves the step to the shared topic module, in a commit of its own (D-08).

`npm run check:features` checks the file families and the names that this file describes.

## Parallel work

When behavioral coverage is split into streams of work that run in parallel, each file has one owner:

- The foundation work lands first and owns every shared file: `features/support/**`, `features/lib/**`, `cucumber.json`, `scripts/check-features.mjs`, this skill, the shared step modules (`command`, `config`, `session`, `mcp-configuration`, `git-host`, and the scope and settings modules), and every topic module.
- Each stream adds only its own feature files and its own verb step modules. It never edits a foundation file or a file of another stream.
- A stream that needs a step the foundation did not provide defines it in its own verb module, with text that names its verb (D-08). When a second stream needs the same step, the step moves to a topic module in a follow-up commit of its own, never into the other stream's module.
- The plugin topic modules live under `features/step_definitions/plugin/` and never take a verb name. These module names belong to the streams that own those verbs: `install`, `uninstall`, `enable`, `disable`, `update`, `reinstall`, `list`, `info`, `pending`, `reconcile`, `fetch`, `prune`, `import`, `bootstrap`, `browse`, `help`, `git-source`, `rollback`, and `state-lock` under `plugin/`, and `remove` under `marketplace/`.

## Boundaries

- The `.steps.ts` suffix is mandatory for step modules, and only step modules use it: `cucumber.json` loads step modules by that suffix, so it is also how a reader tells which files register steps. A step module lives under `features/step_definitions/` only.
- Only step modules call `Given`, `When`, or `Then`, and only support modules register anything else. A library module registers nothing and never imports a step module.
- A support module holds no helpers. A small helper private to one step module may stay in it; once a second module needs it, or a hook and a step both need it, it moves to `features/lib/`.
- Every external service the code talks to has a local stand-in in its own module under `features/lib/`: a loopback-only fake for a networked service, a fixture for local input such as a directory of files.
- Nothing under `features/` imports from `test/`, except a driver that reuses a process harness.
- A process under test too slow to start per scenario is the run's only module-level state. It lives in the support module named after it, and steps reach it through the world. A stand-in whose address the process fixes at start joins that state. `.agents/skills/cucumber/rules/world-and-stand-ins.md` says how they start, reset, and stop.
