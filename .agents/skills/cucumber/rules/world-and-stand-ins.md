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
- A driver may reuse a process harness from `tests/` rather than copy it.
