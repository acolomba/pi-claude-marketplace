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
| `features/lib/pi-tui-pty.py`                    | The fixed Python standard-library bridge for the real-terminal TUI driver.     |

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

## Function directories

Each component kind has one function directory, one fixture writer, and one seed step module (D-CF1-08). The slash-command directory is `features/slash-command/`, because `command` already names `command.steps.ts`, the steps that run any `/claude:plugin` command. The MCP directory is `features/mcp-server/`, not `features/mcp/`.

| Kind           | Function directory        | Fixture writer                        | Seed step module                                           |
| -------------- | ------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Skills         | `features/skill/`         | `features/lib/skill-files.ts`         | `features/step_definitions/skill/listing.steps.ts`         |
| Slash commands | `features/slash-command/` | `features/lib/slash-command-files.ts` | `features/step_definitions/slash-command/listing.steps.ts` |
| Agents         | `features/agent/`         | `features/lib/agent-files.ts`         | `features/step_definitions/agent/listing.steps.ts`         |
| Hooks          | `features/hook/`          | `features/lib/hook-files.ts`          | `features/step_definitions/hook/runs.steps.ts`             |
| MCP servers    | `features/mcp-server/`    | `features/lib/mcp-server-files.ts`    | `features/step_definitions/mcp-server/listing.steps.ts`    |
| Workflows      | `features/workflow/`      | `features/lib/workflow-files.ts`      | `features/step_definitions/workflow/runs.steps.ts`         |

For workflows, `runs.steps.ts` stays the seed module and `features/step_definitions/workflow/listing.steps.ts` is the shared topic module (the listing `Then` steps, the no-run `When`, and the notices `Then`). The shared record helpers `progressOf`, `WorkflowCommandTurn`, and `sendWorkflowCommand` live in `features/lib/workflow-files.ts` beside the fixture writer.

For agents, `listing.steps.ts` is the shared step module: the agent `Given` steps, the pi-subagents settings `Given` steps, and the advertised-agents `Then`. The run steps live in `features/step_definitions/agent/runs.steps.ts`.

For slash commands, `listing.steps.ts` is the shared step module. The invocation, frontmatter, and model-run steps live in their own modules beside it.

For hooks, `runs.steps.ts` stays the seed module and holds the runs `Then` steps (`the hooks record these runs in any order:` and `the hooks record no runs`). `session.steps.ts` holds the session `Given` and `When` steps, `tool-use.steps.ts` the stub MCP server `Given` steps, the profile-aware MCP call step, and the `mcp.json` step, `messages.steps.ts` the hook notice steps (`the hooks show the user these messages:` and `the hooks show the user no messages`), and `prompt-and-stop.steps.ts` the Stop re-entry `When`.

For MCP servers, `listing.steps.ts` is the shared step module, and every MCP step module writes its fixtures through `features/lib/mcp-server-files.ts`. Its stub marker, an object whose one own member is `stub`, is read wherever it sits in a document. So a wrapped file whose only server is named `stub`, `{"mcpServers": {"stub": {...}}}`, cannot be written through the stub-marker `Given` steps: the marker becomes a server named `mcpServers`.

## MCP built-in

The mcp-builtin milestone runs a plugin's MCP servers through pi-mcp-adapter or through Pi's built-in MCP. Phase 1 runs alone and freezes every shared file. Then Phases 2 to 5 run in parallel, each in its own child session, worktree, and branch, and Phase 6 runs alone after the last merge. This section applies "Parallel work" to that milestone. It copies the "File ownership" section of `.planning/ROADMAP.md`.

Every scenario expects Claude Code's behavior. A scenario pins a divergence from Claude Code only when a recorded decision ID or a Pi capability gap licenses it, and the scenario names that ID or gap.

Product paths are relative to `extensions/pi-claude-marketplace/`, step module paths to `features/step_definitions/`, and lib paths to `features/lib/`. Each phase owns the unit pair (`test/<same path>.test.ts`) of every product file it owns. A new file takes its phase's name prefix, so two phases never create the same file. A step that a phase adds names its topic in its text, so two phases never define the same step text (D-08).

### Frozen after Phase 1

No later phase edits these files. A change that a phase needs is a parent line, which the parent session applies at the merge or in Phase 6.

- Build and CI: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `.fallowrc.json`, `rule-packs/architecture.json`, and `eslint.config.js`.
- Harness: `test/e2e/_rpc.ts`, `features/support/**`, the libraries `pi-process.ts`, `pi-commands.ts`, `companions.ts`, `run-tokens.ts`, `published-marketplace.ts`, `mcp-stub-server.ts`, `mcp-server-files.ts`, `mcp-configuration.ts`, `mcp-implementation.ts`, `scripted-model/**`, `pi-registry-probe/**`, `builtin-mcp-stand-in/**`, and `hook-recorder.ts`, and the shared step modules `command`, `session`, `config`, `companion`, `model`, `mcp-configuration`, `mcp-implementation`, `plugin/publishing`, `marketplace/publishing`, `mcp-server/listing`, and `mcp-server/status`.
- This skill, `.agents/skills/cucumber/**`, and the architecture tests that Phase 1 adds (the profile-tag rule in `scripts/check-features.mjs` and the factory-time probe ban).
- `features/mcp-server/implementation-profiles.feature`, which holds the seed scenarios of the MCP implementation steps.
- Product: `platform/pi-api.ts`, `domain/mcp-implementation.ts`, `domain/mcp-server-features.ts`, `domain/mcp-builtin-features.ts`, the MCP functions in `domain/name.ts`, `persistence/state-io.ts`, `orchestrators/mcp/session-materialize.ts`, `orchestrators/mcp/recorded-servers.ts`, `index.ts`, `edge/register.ts`, `edge/types.ts`, and `edge/handlers/plugin/info.ts`.
- Closed sets, frozen except for additions at the end: `shared/notification-types.ts`, `shared/notification-wire.ts`, the reason table in `shared/notify-reasons.ts`, `test/architecture/notify-closed-set-locks.test.ts`, `docs/json-output.md`, and the catalog counters (`docs/output-catalog.md`, `EXPECTED_STATE_COUNT`, and `EXPECTED_UTF8_BYTES`).

### What each phase owns

| Phase                      | Owns (product)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owns (tests and features)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Must not touch                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1 (serial)                 | Everything frozen above; the record producer (`declaredMcpServers` in `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts`, `statePhase` in `orchestrators/plugin/install-outcome.ts`, the record write in `update-swap.ts`); the step seeds `orchestrators/mcp/{builtin-registration-step,agent-grants-step}.ts`; the seed `platform/mcp-builtin-status.ts`; the status call in `orchestrators/plugin/info.ts`; `.planning/PROJECT.md`; the Pi version lines in the READMEs, docs, `AGENTS.md`, `STACK.md`, and `CHANGELOG.md`                                                                                                                                                                                                                                                                                                  | their unit pairs; the floor tests; `features/mcp-server/agent-grants.feature` (the MCP-07 split); the `@adapter-only` tags; moving every row whose MCP marker or state depends on the active implementation into a Phase 3 file                                                                                                                                                                                                                                                                                                        | none (runs alone)                                                                                                                 |
| 2 Built-in materialization | NEW `domain/mcp-builtin-translation.ts`; `bridges/mcp/**` (NEW `builtin-{entry,escape,registration}.ts`, the `substitute.ts` encoder parameter; the adapter files keep writing `mcp-adapter.json`); `orchestrators/mcp/builtin-registration-step.ts`; `orchestrators/plugin/info-mcp-status.ts`; `platform/mcp-builtin-status.ts`; `platform/mcp-status.ts` (its `McpStatusReader` interface stays frozen); `docs/mcp-compatibility.md`                                                                                                                                                                                                                                                                                                                                                                                                 | NEW `test/integration/mcp-builtin-*`; `features/mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature`; NEW `features/mcp-server/{implementation-switch,builtin-*}.feature`; `mcp-server/{configuration,sources,lifecycle}` and NEW `mcp-server/{implementation-switch,builtin-*}` step modules; `mcp-server-{http,environment}.ts`; NEW `mcp-builtin-*.ts` libs                                                                                                                                       | the resolver and verdict readers (Phase 3), `orchestrators/plugin/info.ts`, `bridges/agents/**`, `bridges/hooks/**`, frozen files |
| 3 Read-time verdicts       | `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts` (state and verdicts; the producer and the entry points `recorded-servers.ts` calls stay as Phase 1 left them); `orchestrators/plugin/info.ts` (all but the status call); `list-installed-row.ts`; `plugin-state-classifier.ts`; `update-preflight.ts`; the consent gate function in `install-outcome.ts`; the `partial` functions in `enable-disable.ts`, `install-cascade.ts`, `install-flow-results.ts`, `update-swap.ts`, and `orchestrators/import/execute.ts`; every other site that emits the MCP soft-dependency marker (own function each); `shared/concerns/soft-dep.ts` (MCP arm); `companionSeverity` and the MCP wording in `shared/notify-reasons.ts`; `orchestrators/reconcile/{convergence,mcp-migration}.ts`; `docs/messaging-style-guide.md` (marker text) | their unit pairs; the marker and state assertions in existing `test/integration/mcp-*` tests; NEW `test/integration/mcp-verdict-*`; the e2e marker tests (`adapter-detection-rpc`, `install-soft-deps`); `features/mcp-server/{companion-missing,invalid-configs}.feature`; NEW `features/mcp-server/verdict-*.feature`; `mcp-server/invalid-configs` and NEW `mcp-server/verdict-*` step modules; NEW `mcp-verdict-*.ts` libs; the MCP marker and state rows in `features/plugin/*.feature` and `features/marketplace/update.feature` | `bridges/**`, `orchestrators/mcp/**`, `info-mcp-status.ts`, `platform/mcp-*status.ts`, frozen files                               |
| 4 Agent grants             | `bridges/agents/**`; `persistence/agents-index-{schema,io}.ts`; `orchestrators/mcp/agent-grants-step.ts`; `agentsPhase` in `install-outcome.ts`; the agent staging function in `update-swap.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | their unit pairs; `test/integration/agents-*`; `features/mcp-server/agent-grants.feature`; `features/agent/**`; the `mcp-server/agent-grants` step module; `agent-files.ts`; NEW `mcp-agent-*.ts` libs                                                                                                                                                                                                                                                                                                                                 | `bridges/mcp/**`, `bridges/hooks/**`, the verdict readers, frozen files                                                           |
| 5 Hook tool names          | `bridges/hooks/**`; `domain/components/hooks/**`; `docs/hooks-compatibility.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | their unit pairs; `test/integration/hooks-*`; `features/hook/**` (NEW `mcp-tool-names.feature`); `hook/**` step modules; `hook-files.ts`                                                                                                                                                                                                                                                                                                                                                                                               | every MCP file outside hooks, frozen files                                                                                        |
| 6 (serial)                 | `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`, closed-set removals, the root log (now `.planning/milestones/mcp-builtin-DUBIOUS-CHOICES.md`), CI timeouts if the combined run needs more                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | any file a combined-tree fix needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | none (runs alone after the last merge)                                                                                            |

Shared by function: `orchestrators/plugin/install-outcome.ts` (Phase 1 `statePhase` before the fan-out, Phase 3 the consent gate, Phase 4 `agentsPhase`) and `orchestrators/plugin/update-swap.ts` (Phase 1 the record write, Phase 3 the `partial` functions, Phase 4 the agent staging). In a file shared by function, which also includes `shared/concerns/soft-dep.ts` and `shared/notify-reasons.ts`, a phase edits only its own function or arm. In a shared test file, a phase changes only the cases for its own function. An existing integration test belongs to the phase whose behavior it pins. If it pins both Phase 2's materialization and Phase 3's marker or state, Phase 3 changes the marker and state assertions, and Phase 2 adds its cases in a new `test/integration/mcp-builtin-*` file.

A scenario in a Phase 2, 4, or 5 file pins connection, naming, grants, or hook runs. It never pins a plugin state, a marker, or a per-server verdict that depends on the active implementation: those rows live in Phase 3 files. Each phase removes the `@adapter-only` tags that Phase 1 placed on its own files.

### Reserved names

Phase 1 takes these names. No later phase creates a file or a module with one of them:

- Frozen: the step module `features/step_definitions/mcp-implementation.steps.ts`, the support module `features/support/mcp-implementation.ts`, the library `features/lib/mcp-implementation.ts`, the stand-in directory `features/lib/builtin-mcp-stand-in/`, and the feature `features/mcp-server/implementation-profiles.feature`.
- Passed to Phase 3 with the other `verdict-*` files: `features/mcp-server/verdict-markers.feature`.
- Passed to Phase 4: `features/mcp-server/agent-grants.feature` and `features/step_definitions/mcp-server/agent-grants.steps.ts`.

### Parent-owned files

No child phase edits `CHANGELOG.md`, `README.md`, `README.es.md`, the Key Decisions table of `.planning/PROJECT.md`, `.planning/BACKLOG.md`, or a frozen file. Each phase lists its lines for those files under "Parent lines" in its last plan's `SUMMARY.md`, and the parent session applies them at the merge or in Phase 6.

## Behavioral gaps

The behavioral-gaps milestone adds the scenarios that the November 2026 coverage audit found missing. Phase 1 runs alone. It builds and seeds every shared stand-in, then freezes the shared files. Then Phases 2 to 16 run in parallel child sessions, one per phase, each on the local branch `features/behavioral-gaps-phase-N` (D-BG-16). This section applies "Parallel work" to that milestone. It copies the "File ownership" section of `.planning/ROADMAP.md`.

Product paths are relative to `extensions/pi-claude-marketplace/`, step module paths to `features/step_definitions/`, and feature paths to `features/`. Each phase owns the unit pair (`test/<same path>.test.ts`) of every product file it owns. A new test file takes a name that carries its phase's topic, so two phases never create the same file.

### Frozen after Phase 1

No stream edits these files. A change that a stream needs is a parent line, which the parent session applies on the milestone branch.

- Build and CI: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `.fallowrc.json`, `rule-packs/architecture.json`, and `eslint.config.js`.
- Harness: `test/e2e/_rpc.ts`, `features/support/**`, and `features/lib/**`, with every library Phase 1 adds. A stream adds no file under `features/support/` or `features/lib/`. A small helper private to one of its step modules stays in that module.
- Step modules: the shared modules `command`, `config`, `session`, `mcp-configuration`, `mcp-implementation`, `git-host`, `scope-state`, `claude-code-settings`, `model`, `completion`, `companion`, and `npm-registry`; every topic module, such as `plugin/publishing`, `plugin/installation`, `marketplace/publishing`, `marketplace/checkout`, `hook/runs`, `hook/session`, and `hook/tool-use`; and every other step module that exists when Phase 1 ends. A stream adds only the verb module that the table below gives it.
- This skill, `.agents/skills/cucumber/**`.
- Product: `platform/pi-api.ts` and any seam that Phase 1 adds for a stand-in.
- Closed sets, frozen except for additions at the end: `shared/notification-types.ts` `Reason`, `shared/notification-wire.ts` `REASONS`, the reason table in `shared/notify-reasons.ts`, `test/architecture/notify-closed-set-locks.test.ts`, `docs/json-output.md`, and the catalog counters (`docs/output-catalog.md`, `EXPECTED_STATE_COUNT`, and `EXPECTED_UTF8_BYTES`).

### What each phase owns

| Phase                        | Feature files                             | Verb step module                       | Product it may fix                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (serial)                   | the seeds, in the stream files below      | every shared and topic module          | everything frozen above                                                                                                                                                                                                                                   |
| 2 Async hooks                | NEW `hook/async.feature`                  | NEW `hook/async.steps.ts`              | `bridges/hooks/async-rewake/**`; the `async` and `asyncRewake` branches of the shared hook modules                                                                                                                                                        |
| 3 StopFailure hooks          | NEW `hook/stop-failure.feature`           | NEW `hook/stop-failure.steps.ts`       | `bridges/hooks/payloads/stop-failure.ts`; the StopFailure arm of the shared hook modules                                                                                                                                                                  |
| 4 PostToolUseFailure hooks   | NEW `hook/tool-failure.feature`           | NEW `hook/tool-failure.steps.ts`       | `bridges/hooks/payloads/post-tool-use-failure.ts`; the PostToolUseFailure arm of the shared hook modules                                                                                                                                                  |
| 5 PostCompact hooks          | NEW `hook/compaction.feature`             | NEW `hook/compaction.steps.ts`         | `bridges/hooks/payloads/{post-compact,compact-trigger}.ts`; the PostCompact arm of the shared hook modules                                                                                                                                                |
| 6 SessionEnd hooks           | NEW `hook/session-end.feature`            | NEW `hook/session-end.steps.ts`        | `bridges/hooks/payloads/session-end.ts`; the SessionEnd arm of the shared hook modules                                                                                                                                                                    |
| 7 State schema migration     | NEW `plugin/state-migration.feature`      | NEW `plugin/state-migration.steps.ts`  | `persistence/migrate.ts`; the load and schema-version functions of `persistence/state-io.ts`                                                                                                                                                              |
| 8 First-run config migration | NEW `plugin/config-migration.feature`     | NEW `plugin/config-migration.steps.ts` | `persistence/migrate-config.ts`; the invalid-config handling in `persistence/config-io.ts`; the MIG-01 step in `orchestrators/reconcile/read-pass.ts`                                                                                                     |
| 9 Legacy MCP entry move      | NEW `mcp-server/legacy-move.feature`      | NEW `mcp-server/legacy-move.steps.ts`  | `orchestrators/reconcile/mcp-migration.ts`                                                                                                                                                                                                                |
| 10 Model-facing tools        | NEW `plugin/model-tools.feature`          | NEW `plugin/model-tools.steps.ts`      | `edge/handlers/tools.ts`                                                                                                                                                                                                                                  |
| 11 Device Flow sign-in       | NEW `marketplace/device-flow.feature`     | NEW `marketplace/device-flow.steps.ts` | `domain/{github-auth,auth-registry}.ts`; `orchestrators/auth-host.ts`; `platform/{git-credential,git-auth-callbacks}.ts`; the auth call in `orchestrators/plugin/clone-cache.ts`; the credential choice in `orchestrators/marketplace/background-pass.ts` |
| 12 Browse picker             | `plugin/browse.feature` (exists)          | NEW `plugin/browse.steps.ts`           | `edge/browser/plugin-browser.ts`; `edge/handlers/plugin/browse.ts`; the browse arms of `edge/router.ts`                                                                                                                                                   |
| 13 Prune                     | `plugin/prune.feature` (exists)           | NEW `plugin/prune.steps.ts`            | `orchestrators/plugin/{prune,prune-rollback}.ts`; `edge/handlers/plugin/prune.ts`; `domain/dependency-orphans.ts`                                                                                                                                         |
| 14 Bootstrap                 | `plugin/bootstrap.feature` (exists)       | NEW `plugin/bootstrap.steps.ts`        | `orchestrators/plugin/bootstrap.ts`; `edge/handlers/plugin/bootstrap.ts`                                                                                                                                                                                  |
| 15 Marketplace state lock    | `marketplace/state-lock.feature` (exists) | NEW `marketplace/state-lock.steps.ts`  | `orchestrators/marketplace/autoupdate.ts`; `edge/handlers/marketplace/autoupdate.ts`; `transaction/with-state-guard.ts`                                                                                                                                   |
| 16 Background-child load     | NEW `plugin/subagent-child.feature`       | NEW `plugin/subagent-child.steps.ts`   | `platform/subagent-child.ts`; the background-child gates in `orchestrators/reconcile/load.ts` and `orchestrators/mcp/agent-grants-step.ts`                                                                                                                |

### Reserved names

Phase 1 reserves each new feature file and each new verb module of the table for its own stream. No other phase creates a file or a module with one of these names:

- Phase 2: `hook/async.feature` and `hook/async.steps.ts`.
- Phase 3: `hook/stop-failure.feature` and `hook/stop-failure.steps.ts`.
- Phase 4: `hook/tool-failure.feature` and `hook/tool-failure.steps.ts`.
- Phase 5: `hook/compaction.feature` and `hook/compaction.steps.ts`.
- Phase 6: `hook/session-end.feature` and `hook/session-end.steps.ts`.
- Phase 7: `plugin/state-migration.feature` and `plugin/state-migration.steps.ts`.
- Phase 8: `plugin/config-migration.feature` and `plugin/config-migration.steps.ts`.
- Phase 9: `mcp-server/legacy-move.feature` and `mcp-server/legacy-move.steps.ts`.
- Phase 10: `plugin/model-tools.feature` and `plugin/model-tools.steps.ts`.
- Phase 11: `marketplace/device-flow.feature` and `marketplace/device-flow.steps.ts`.
- Phase 12: `plugin/browse.steps.ts`.
- Phase 13: `plugin/prune.steps.ts`.
- Phase 14: `plugin/bootstrap.steps.ts`.
- Phase 15: `marketplace/state-lock.steps.ts`.
- Phase 16: `plugin/subagent-child.feature` and `plugin/subagent-child.steps.ts`.

Phase 1 creates none of these verb modules. It creates only the new feature files that hold a seed. No seed needs `hook/tool-failure.feature` or `hook/session-end.feature`, so Phases 4 and 6 create those files. The existing `plugin/browse.feature`, `plugin/prune.feature`, `plugin/bootstrap.feature`, and `marketplace/state-lock.feature` pass to their streams when Phase 1 merges.

### Seeds

Each seed scenario that Phase 1 puts in a stream's feature file passes to that stream. The stream may rewrite the seed, but it keeps every shared step that the seed uses in use, because `npm run check:features` fails on an unused step and the stream cannot remove one from a frozen module.

The per-stream list of seed steps follows when the seeds land.

### Parent-owned files

No child phase edits `CHANGELOG.md`, `README.md`, `README.es.md`, the Key Decisions table of `.planning/PROJECT.md`, `.planning/BACKLOG.md`, the root log `.planning/DUBIOUS-CHOICES.md`, or a frozen file. Each phase lists its lines for those files under "Parent lines" in its last plan's `SUMMARY.md`, and the parent session applies them at the merge.

## Boundaries

- The `.steps.ts` suffix is mandatory for step modules, and only step modules use it: `cucumber.json` loads step modules by that suffix, so it is also how a reader tells which files register steps. A step module lives under `features/step_definitions/` only.
- Only step modules call `Given`, `When`, or `Then`, and only support modules register anything else. A library module registers nothing and never imports a step module.
- The one Python library file is `pi-tui-pty.py`. It opens and relays a PTY for `pi-tui.ts`; no other Python file belongs under `features/`.
- A support module holds no helpers. A small helper private to one step module may stay in it; once a second module needs it, or a hook and a step both need it, it moves to `features/lib/`.
- Every external service the code talks to has a local stand-in in its own module under `features/lib/`: a loopback-only fake for a networked service, a fixture for local input such as a directory of files.
- Nothing under `features/` imports from `test/`, except a driver that reuses a process harness.
- A process under test too slow to start per scenario is the run's only module-level state. It lives in the support module named after it, and steps reach it through the world. A stand-in whose address the process fixes at start joins that state. `.agents/skills/cucumber/rules/world-and-stand-ins.md` says how they start, reset, and stop.
