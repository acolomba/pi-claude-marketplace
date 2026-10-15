# The world and stand-ins

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

## The world

- `features/support/world.ts` declares the world class and registers it. Every scenario gets a fresh world.
- A hook lives in the support module of the thing it sets up and is registered as a step is: a `Before()` or `After()` hook that uses the world is a `function` expression with a typed `this`, and one that does not is an arrow. `BeforeAll()` and `AfterAll()` run once per worker, outside any scenario, so they get no world and are always arrows.
- Keep scenario state on the world as initialized fields; no module-level mutable state anywhere under `features/`. Module state outlives the scenario that set it and leaks into the next one.
- One exception: a process under test that is too slow to start per scenario. The support module named after that process may hold it as the run's only module-level state, with `BeforeAll()` starting it and `AfterAll()` stopping it. A `Before()` hook then resets it before every scenario: it empties everything the process reads, and asserts that nothing from an earlier scenario is left. A process left busy or gone by a failed scenario is replaced. Each parallel worker loads its own copy of that module, so each worker gets its own process.
- Keep `order: random` in `cucumber.json`, so a reset that leaks fails.
- The world owns the lifetime of everything else a scenario creates (temporary directories, fakes, child processes). The step or hook that creates a thing registers its release with `this.onRelease()`; the `After()` hook in `world.ts` runs the releases in reverse order, so teardown happens in one place and in the reverse of setup even when a scenario fails halfway. Every release runs even when an earlier one fails; the failures surface together as one `AggregateError`. No other hook releases scenario resources.
- A step timeout above the default is a named constant with a comment that says why. A run-wide default goes in `world.ts`, beside the world it governs.

## Fakes and drivers

- A fake listens on loopback only, records what it receives, and can be armed to fail, so scenarios cover error paths. A fixture reaches its error paths through bad input that scenarios write.
- A driver that runs the code under test validates what it returns against the published contract, such as a JSON schema, before a step reads it.
- The command driver returns every payload a command emits, in the order the command emits them. It validates each payload against the published payload schema (DRV-01).
- A step that expects one result asserts that there is exactly one payload. It never picks one payload out of several.
- A command with several payloads is compared in two steps (D-02). The first step, `the command reports these results:`, lists one row per payload. The second step, `the results list these marketplaces and plugins:`, lists the rows across all the payloads. When no payload carries rows, the first table alone is the whole value. An info fan-out, whose payloads are a marketplace-info and a plugin-info, is an example.
- The steps that state a result's fields hide its row arrays, `marketplaces` and `blocks`. A scenario that otherwise passes fails when the last command left a non-empty row array that no row step compared, and a second `When` fails when the first one's rows went uncompared. A payload kind that no row step reads, such as `plugin-info-cascade` or `reconcile-applied-cascade`, therefore fails until a row step learns its rows.
- Local marketplace fixtures live under the sandbox home directory.
- The world records the source kind of each published marketplace, and the library code dispatches on it. A new source kind changes library code only, not the steps.
- A driver may reuse a process harness from `tests/` rather than copy it.
