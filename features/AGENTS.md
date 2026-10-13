# Behavioral tests

Cucumber loads only `features/lib/world.ts` and `features/steps/**/*.steps.ts`. A step module without the `.steps.ts` suffix never runs.

## Layout

Everything under `features/` is organized by vertical function: the user-facing function a file is about (`plugin`, `marketplace`, `session`, `command`), never the Gherkin keyword, the test mechanism, or the feature file that first needed it. There is no catch-all module: no `common`, `shared`, `utils`, `helpers`, `support`, or `misc`.

| Path                                       | Holds                                       | Rules                               |
| ------------------------------------------ | ------------------------------------------- | ----------------------------------- |
| `features/<function>/<capability>.feature` | One feature of one function                 | `skills/cucumber-features/SKILL.md` |
| `features/steps/<function>.steps.ts`       | The steps about one vertical function       | `skills/cucumber-steps/SKILL.md`    |
| `features/lib/world.ts`                    | The world, hooks, and parameter types       | `skills/cucumber-steps/SKILL.md`    |
| `features/lib/<name>.ts`                   | Reusable non-step code, named as a vertical | `skills/cucumber-steps/SKILL.md`    |

## Principles

- A feature lives in the directory of its function. Its file name is its title in kebab case without the function word: `Feature: Plugin install` is `features/plugin/install.feature`.
- A step belongs to the function of the thing it names, not to the feature that first used it. `the marketplace "fixtures" offers these plugins:` goes in `marketplace.steps.ts` wherever it is used.
- A step module can name a function that has no feature directory. A step used by every feature still names its function: `the user runs {string}` and `the result has these fields:` are about the `command` function, so they go in `command.steps.ts`.
- A step module may split into `features/steps/<function>/<topic>.steps.ts` when it grows; the suffix still applies.
- `features/lib/` holds reusable non-step code. A module's name is itself the vertical: it names the specific thing the module drives or stands in for (`lib/pi-process.ts`, `lib/pi-commands.ts`, `lib/path-marketplace.ts`). A name too generic for its siblings is a finding: `marketplace-fixture.ts` says nothing once there is more than one kind of marketplace (path, git, url), so name the kind. When a module grows, split it into `lib/<name>/` with files named for their parts.
- A small helper private to one step module may stay in that module; once a second module needs it, it moves to `lib/`.
- Code in `lib/` registers no step, and nothing but `world.ts` registers a hook. It never imports a step module.

Read the rules for a file before you change it. Review with `skills/cucumber-review/SKILL.md`.
