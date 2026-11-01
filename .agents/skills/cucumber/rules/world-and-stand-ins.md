# The world and stand-ins

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

## The world

- `features/support/world.ts` declares the world class and registers it. Every scenario gets a fresh world.
- A hook lives in the support module of the thing it sets up and is registered as a step is: a `Before()` or `After()` hook that uses the world is a `function` expression with a typed `this`, and one that does not is an arrow. `BeforeAll()` and `AfterAll()` run once per worker, outside any scenario, so they get no world and are always arrows.
- Keep scenario state on the world as initialized fields; no module-level mutable state anywhere under `features/`. Module state outlives the scenario that set it and leaks into the next one.
- One exception: a process under test that is too slow to start per scenario. The support module named after that process may hold it as the run's only module-level state, with `BeforeAll()` starting it and `AfterAll()` stopping it. A `Before()` hook then resets it before every scenario: it empties everything the process reads, and asserts that nothing from an earlier scenario is left. A process left busy or gone by a failed scenario is replaced. Each parallel worker loads its own copy of that module, so each worker gets its own process.
- A scenario that needs a session in another project starts a second Pi of its own through the world's `startSessionInAnotherProject()`. The world stops that Pi and removes its project directory. The second Pi is scenario state, not module state, so only the scenarios that need it pay its start-up time.
- A scenario that needs Pi to run with another GitHub base address, such as one Pi refuses (GHB-03), starts a Pi of its own in the run's sandbox through the world's `usePiWithGitHubBaseUrl()`, behind the step `pi runs with the github base address "<value>"`. That Pi takes the place of the run's Pi for the rest of the scenario, and the world stops it. Its startup load reads the configs, so the step comes before the steps that write them.
- A scenario that proves an RPC session does not run the background update starts a Pi of its own in the same way through the world's `usePiWithBackgroundUpdateDelay()`, behind the step `pi runs with the background update delay "<value>"`, because a Pi's environment is fixed when it starts, and the run's Pi never sets `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`. With no delay, a pass that wrongly armed would append its notice inside the driver's window.
- A stand-in whose address or trust that process fixes when it starts shares the same run state. For example, Pi reads the run's certificate and the git host's port once, at start, so the https git host lives in the same `PiRun` as Pi. The same `BeforeAll()` starts the stand-in before the process, and `AfterAll()` stops it after the process. `Before()` resets the stand-in together with the process: it empties the repositories, the arming, the request log, the connections, and the CGI children, and asserts that nothing is left. A replaced process gets the same environment, so it trusts the same certificate and reaches the same address.
- The git host serves bare repositories under any owner: `acme` for the fixtures, and `anthropics` for the official marketplace, which Pi reaches through the GitHub base override. A step names a repository through the `{git repository}` parameter type, by the marketplace or the plugin it serves, such as `marketplace "tools"` or `plugin "ghp"`. The plugin form names the one git plugin repository of the scenario that holds that plugin now. A step that arms a repository registers a release that disarms it. `the git host serves the <repository> again` removes that arm as a precondition before the scenario's `When`, so an arm never outlives its scenario.
- The git host also serves the static catalog files of hosted marketplaces, from memory, at `/<owner>/<directory>/<file>`. An arm of a hosted marketplace applies to its catalog as it applies to a repository. `Before()` resets the files with the repositories, and its check asserts that the host serves none.
- Keep `order: random` in `cucumber.json`, so a reset that leaks fails.
- The world owns the lifetime of everything else a scenario creates (temporary directories, fakes, child processes). The step or hook that creates a thing registers its release with `this.onRelease()`; the `After()` hook in `world.ts` runs the releases in reverse order, so teardown happens in one place and in the reverse of setup even when a scenario fails halfway. Every release runs even when an earlier one fails; the failures surface together as one `AggregateError`. No other hook releases scenario resources.
- A step timeout above the default is a named constant with a comment that says why. A run-wide default goes in `world.ts`, beside the world it governs.

## Fakes and drivers

- A fake listens on loopback only, records what it receives, and can be armed to fail, so scenarios cover error paths. A fixture reaches its error paths through bad input that scenarios write.
- A driver that runs the code under test validates what it returns against the published contract, such as a JSON schema, before a step reads it.
- The command driver returns every payload a command emits, in the order the command emits them. It validates each payload against the published payload schema (DRV-01).
- The session driver reads the payloads of a new session, such as its reconcile report, through Pi's RPC `get_entries` request. It validates each one (DRV-01) and returns every one in session order. Pi binds the extension twice in an RPC `new_session`, so a lasting reconcile failure appears twice. The driver keeps both, and a scenario states both.
- A plain message's background result is read from the entries that follow the message. Pi refuses the message for want of a model, but only after its input handlers ran, so the driver asserts the refusal and that the refusal carries no payload, which proves no update ran before Pi answered. It then reads the entries until at least one payload follows the message and no new payload has arrived for a quiet window, or until its window ends, and returns the payloads it read, which can be none. Only a tui session arms the background update, and the suite drives Pi over RPC, so the driver's purpose is the RPC negative: `Then the session reports no results` proves that nothing followed the message. The quiet window still lets a later, extra payload reach the step when one arrives. `When the user sends the message` keeps those payloads as session results.
- A tui session's Pi reads its environment when the first message arrives, so `Given the tui session starts with the environment variable {string} set to {string}` (the world's `setTuiVariable`) adds a variable to that session alone, before the session starts. `Then the tui session reports no notice` first waits for Pi's refusal of the message, which follows its input handlers, so its quiet window starts after the background pass was armed or declined.
- `When the user starts a new pi session` keeps the session's payloads as the last results, as `When the user runs` does for a command. So the rules below for uncompared rows and notices cover sessions too. A command is always followed by a field step, but a session is not, so the world also fails a scenario when a session reported a result whose fields no step stated. The steps that state the fields of every result, such as `the result has these fields:` and `the session reports these results:`, record the comparison through the world's `markResultsCompared()`. A session that reports nothing leaves nothing to compare.
- A step that expects one result asserts that there is exactly one payload. It never picks one payload out of several.
- A command with several payloads is compared in two steps (D-02). The first step, `the command reports these results:`, lists one row per payload. The second step, `the results list these marketplaces and plugins:`, lists the rows across all the payloads. When no payload carries rows, the first table alone is the whole value. An info fan-out, whose payloads are a marketplace-info and a plugin-info, is an example. A new session's payloads are compared the same way, with `the session reports these results:` as the first step. Each of the two first steps refuses the results of the other source: `the command reports these results:` fails after a new session, and `the session reports these results:` fails after a command.
- The steps that state a result's fields hide its row arrays, `marketplaces`, `blocks`, and the `plugins` of a `background-update`. A row step records that it compared them through the world's `markRowsCompared()`. A scenario that otherwise passes fails when the last command left a non-empty row array that no row step compared, and a second `When` fails when the first one's rows went uncompared. `the result lists these plugins:` reads the plugin rows of a `cascade` and of a `reconcile-applied-cascade`, the blocks of a `plugin-info-cascade`, whose columns have the names the fields of a single `plugin-info` result have, and the `plugins` of a `background-update`, whose columns are `name`, `marketplace`, `scope`, `from version`, and `to version`. `the result lists these marketplaces:` reads the marketplace blocks of a `cascade` and of a `reconcile-applied-cascade`, and the blocks of a `marketplace-info-cascade`. The field steps compare a kind without a row array whole, such as `prune-empty`, `reconcile-pending-empty`, `usage-info`, `reconcile-aborted`, `internal-error`, and `prune-committed-warning`; `the results list these marketplaces and plugins:` skips such a result, since it has no row to miss. A new kind with a `marketplaces` or `blocks` row array fails until a row step learns its rows.
- An MCP config notice result has no rows: its notices are fields, and only `the command reports these results:` states them. That step records it through the world's `markNoticesCompared()`. A scenario that otherwise passes fails when the last command emitted a notice that step did not compare, and a second `When` fails when the first one's notices went uncompared.
- Local marketplace fixtures live under the sandbox home directory.
- The world records the source kind of each published marketplace, and the library code dispatches on it. A new source kind changes library code only, not the steps.
- The official marketplace is recorded like any published marketplace: a github source on the git host. So every marketplace step works on it.
- A driver may reuse a process harness from `test/` rather than copy it.

## Profile Pis and the scripted model

### The profile Pi and project trust

- The run's shared Pi has no model and no companions. A scenario that needs either starts a profile Pi through a `Given`, which calls the profile method of the world. The profile Pi runs in the run's sandbox and becomes the Pi that the steps talk to. The scenario's release stops it together with its process group (D-CF1-15).
- A profile Pi loads the real extension, the scripted model, the registry probe, and the companions that the step names. The world finds each companion through the `pi.extensions` entry of its `package.json` in the optional peer cache, and checks its version against the declared floor. It never hard-codes an entry path. The profile Pi runs with `TMPDIR` inside the sandbox home.
- The profile Pi trusts the sandbox project through a persisted entry in `<agent dir>/trust.json`, the record that Pi saves when a user answers its trust prompt. It never uses `--approve` or `defaultProjectTrust` (D-CF1-07). An untrusted scenario starts a profile Pi with no entry.
- Pi trusts a project that holds no trust-requiring resource, whatever `trust.json` says. So an untrusted scenario also writes `<project>/.pi/settings.json`, and the trusted scenario beside it holds the same file. Then only the trust entry differs between the two.
- Approval of project MCP servers is a separate `Given` that writes the user-level `projectServers` setting of pi-mcp-adapter. It is never part of the default profile.

### The scripted model

- The scripted model is Pi's faux provider, loaded as a Pi extension from `features/lib/scripted-model/` (D-CF1-17). It reads the scenario's script from a file in the sandbox home. It counts the records in its own call log to find the next step, so the Pi of a child agent reads the same script. The script, the call log, and the count reset with the sandbox.
- The scripted model records every call whole: the messages, the tools, and the system prompt.
- The scripted model has no fallback reply. A call past the end of the script fails the turn, and a step that no call used fails the scenario.
- A feature file writes the whole script as literals. A `Then` reads the call log, never the script, because a step that reads the script back proves nothing.

### The model turn

- The model-turn `When` sends the prompt. If Pi reports the `handled` disposition, no turn runs. Otherwise the step waits for `agent_settled` with `aborted: false` until a named deadline. It never sleeps for a fixed time.
- The step keeps every record that the turn produced: RPC events, tool events, custom entries, notifies, and extension errors. It also keeps every line that the stand-ins logged during the turn.
- A `Then` that reads the turn marks it compared. The world fails a scenario that otherwise passes when no step compared its last turn.
- Pi queues a prompt sent during a turn as a follow-up. So a step never sends a second prompt before the first turn settles.

### Stand-ins of the profile Pi

- The registry probe is a Pi extension under `features/lib/pi-registry-probe/`. It reports Pi's tools, all of them and the active ones, and Pi's commands, as a custom entry.
- The hook recorder, `features/lib/hook-recorder.ts`, runs as a hook command. It logs the event, the stdin, the arguments, and the `CLAUDE_*` environment of each run.
- The MCP stub, `features/lib/mcp-stub-server.ts`, is a stdio JSON-RPC server with no dependencies. It logs every request, writes a pid file, and exits when its stdin closes.
- These stand-ins are `.ts` files under `features/lib/`, never under `features/support/`, because cucumber imports `features/support/` into every worker (D-CF1-17). A Pi extension under `features/lib/` carries `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.` above its default export.
- No step filters or deduplicates records. Since pi-mcp-adapter 6.0, a call through the `mcp` proxy runs the real tool as a nested Pi tool call. So a step lists both the `mcp` event and the event of the real tool.

### Reset and CI

- The reset asserts a clean baseline. After the profile Pi stops, every pid that a stand-in recorded is dead, and the script has no unused step. The `Before()` of the next scenario empties the sandbox.
- The behavioral CI job runs as two path shards (D-CF1-16). The lifecycle shard runs `features/marketplace` and `features/plugin`, and the components shard runs the six function directories. `npm run check:features` dry-runs every scenario, so a shard hides no unused step.

### Arguments that start with `!`

- In a skill or a command, an argument word that starts with `!` reaches the model as `\!`, as in Claude Code (`xM`, D-CF1-01). A scenario that types such an argument states the backslash in its expected value. This is upstream parity, not a defect.
