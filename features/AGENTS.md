# Behavioral tests

Cucumber loads only `features/support/world.ts` and `features/steps/**/*.steps.ts`. A step module without the `.steps.ts` suffix never runs.

| Path                             | Holds                                      | Rules                               |
| -------------------------------- | ------------------------------------------ | ----------------------------------- |
| `features/**/*.feature`          | One feature, named after its title         | `skills/cucumber-features/SKILL.md` |
| `features/steps/<area>.steps.ts` | Step definitions only, grouped by function | `skills/cucumber-steps/SKILL.md`    |
| `features/support/world.ts`      | The world, hooks, and parameter types      | `skills/cucumber-steps/SKILL.md`    |
| `features/support/*.ts`          | Fakes, fixtures, and drivers               | `skills/cucumber-steps/SKILL.md`    |

Read the rules for a file before you change it. Review with `skills/cucumber-review/SKILL.md`.
