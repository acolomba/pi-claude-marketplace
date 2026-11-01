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

## Component features

The component-features milestone covers the six component kinds of a plugin. Phase 1 builds the harness and seeds each kind. Then six component phases run in parallel, one session and one worktree for each kind. This section applies "Parallel work" to that milestone. It copies the "File ownership" section of `.planning/ROADMAP.md`.

Every scenario expects Claude Code's behavior. A scenario pins a divergence from Claude Code only when a recorded decision ID or a Pi capability gap licenses it, and the scenario names that ID or gap.

### Function directories

Phase 1 creates one function directory for each kind (D-CF1-08). Each starts with its seed features, one fixture writer, and one topic step module. When Phase 1 merges, all three pass to the phase of that kind. The slash-command directory is `features/slash-command/`, because `command` already names `command.steps.ts`, the steps that run any `/claude:plugin` command. The MCP directory is `features/mcp-server/`, not `features/mcp/`.

| Kind           | Function directory        | Seed features                                 | Fixture writer                        | Seed step module                                           |
| -------------- | ------------------------- | --------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Skills         | `features/skill/`         | `invocation.feature`                          | `features/lib/skill-files.ts`         | `features/step_definitions/skill/listing.steps.ts`         |
| Slash commands | `features/slash-command/` | `listing.feature`                             | `features/lib/slash-command-files.ts` | `features/step_definitions/slash-command/listing.steps.ts` |
| Agents         | `features/agent/`         | `invocation.feature`, `project-trust.feature` | `features/lib/agent-files.ts`         | `features/step_definitions/agent/runs.steps.ts`            |
| Hooks          | `features/hook/`          | `tool-use.feature`                            | `features/lib/hook-files.ts`          | `features/step_definitions/hook/runs.steps.ts`             |
| MCP servers    | `features/mcp-server/`    | `invocation.feature`                          | `features/lib/mcp-server-files.ts`    | `features/step_definitions/mcp-server/calls.steps.ts`      |
| Workflows      | `features/workflow/`      | `run.feature`                                 | `features/lib/workflow-files.ts`      | `features/step_definitions/workflow/runs.steps.ts`         |

### Frozen after Phase 1

No component phase edits these files:

- `features/support/world.ts`, which holds the profile Pi, the last model turn, and the uncompared-turn check, and `features/support/pi-process.ts`.
- The harness libraries: `features/lib/pi-process.ts`, `features/lib/pi-commands.ts`, `features/lib/run-tokens.ts`, `features/lib/published-marketplace.ts`, `features/lib/companions.ts`, `features/lib/turn-records.ts`, `features/lib/scripted-model/`, `features/lib/pi-registry-probe/`, `features/lib/hook-recorder.ts`, `features/lib/mcp-stub-server.ts`, `features/lib/pi-launch-environment.ts`, `features/lib/mcp-configuration.ts`, and the generic readers that slice JSONL logs and project tables. Every other file under `features/lib/` except the six fixture writers is frozen too.
- The shared step modules: `command`, `session`, `config`, `git-host`, `mcp-configuration`, `model`, `companion`, `plugin/publishing`, and `marketplace/publishing`. `session` holds the model-turn `When` (`the user prompts {string}`) and the listing `When` (`the user lists the slash commands pi offers`). `plugin/publishing` holds the generic file `Given` (`the published plugin {string} of the marketplace {string} has the file {string} with this text:`), which a phase uses to write a plugin manifest that declares a component path. `mcp-configuration` holds the approval `Given` for project MCP servers.
- `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs`, and this skill, `.agents/skills/cucumber/**`.
- `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs`, `.github/workflows/ci.yml`, and `extensions/pi-claude-marketplace/platform/pi-api.ts`. Phase 1 widens every Pi event and API type that a kind needs, such as `session_compact` and the `new` and `fork` reasons.
- The invocation cores, under `extensions/pi-claude-marketplace/`: `domain/argument-substitution.ts`, `domain/shell-words.ts`, `domain/context-injection.ts`, `domain/description-fallback.ts`, `domain/invocation-frontmatter.ts`, and `platform/prompt-shell.ts`. A phase that needs a change in a core reports it to the parent session and does not edit the core. The parent applies the change on the milestone branch, so every phase that uses the core merges the same fix.

### What each component phase owns

Step module paths are relative to `features/step_definitions/`, lib paths to `features/lib/`, and product paths to `extensions/pi-claude-marketplace/`, except the paths under `docs/` and `test/`.

| Phase | Kind           | Feature files                                                     | Step modules                                     | Lib                      | Product                                                                                                                         |
| ----- | -------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 2     | Skills         | `features/skill/**`                                               | `skill/**`                                       | `skill-files.ts`         | `bridges/skills/**`, `edge/skill-aliases.ts`                                                                                    |
| 3     | Slash commands | `features/slash-command/**`                                       | `slash-command/**`                               | `slash-command-files.ts` | `bridges/commands/**`, `edge/command-invocation.ts`                                                                             |
| 4     | Agents         | `features/agent/**`                                               | `agent/**`                                       | `agent-files.ts`         | `bridges/agents/**`, `persistence/agents-index-*`                                                                               |
| 5     | Hooks          | `features/hook/**`, `features/plugin/session-start-hooks.feature` | `hook/**`, `plugin/session-start-hooks.steps.ts` | `hook-files.ts`          | `bridges/hooks/**`, `domain/components/hook*`, `test/architecture/hooks-*.test.ts`, `docs/hooks-compatibility.md`               |
| 6     | MCP servers    | `features/mcp-server/**`                                          | `mcp-server/**`                                  | `mcp-server-files.ts`    | `bridges/mcp/**`, `platform/mcp-status.ts`, `domain/mcp-resolution.ts`, `domain/components/mcp.ts`, `docs/mcp-compatibility.md` |
| 7     | Workflows      | `features/workflow/**`                                            | `workflow/**`                                    | `workflow-files.ts`      | `bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts`, `docs/workflows-compatibility.md`             |

Each component phase also owns the unit tests of its kind, `test/bridges/<kind>/**`, and its integration tests, `test/integration/<kind>-*`. `features/agent/project-trust.feature`, the trust pair of HAR-06, passes to Phase 4 with the rest of `features/agent/`. `features/plugin/component-directories.feature` and `features/plugin/staging-warnings.feature`, which pin D-CF1-06, stay lifecycle files that no component phase edits. A phase that pins the replace rule for its own kind adds a scenario under its own function directory. Phase 1 creates `edge/command-invocation.ts` as a pass-through and registers it in `index.ts`, so no component phase edits `index.ts`.

### Reserved names

Phase 1 takes these module names. No component phase creates a module with one of them:

- The libraries `features/lib/scripted-model/`, `features/lib/pi-registry-probe/`, `features/lib/hook-recorder.ts`, `features/lib/mcp-stub-server.ts`, `features/lib/pi-launch-environment.ts`, `features/lib/companions.ts`, and `features/lib/turn-records.ts`.
- The step modules `model` and `companion`.
- The six step directories `skill/`, `slash-command/`, `agent/`, `hook/`, `mcp-server/`, and `workflow/` under `features/step_definitions/`, and the six fixture writers `features/lib/<kind>-files.ts`. Each passes to its kind's phase.

A parameter type that a phase adds starts with the name of its kind. A step that a phase adds names its kind in its text, so two phases never define the same step text. This is the verb rule of D-08, applied to kinds.

### Parent-owned files and cross-kind scenarios

- No component phase edits `CHANGELOG.md`, `README.md`, `README.es.md`, the Key Decisions table of `.planning/PROJECT.md`, or `.planning/BACKLOG.md`. Each phase lists its lines for those files in its `SUMMARY.md`, and the parent session applies them when it merges the phase.
- A scenario that uses two kinds belongs to exactly one phase. It uses the Phase 1 stand-ins and the frozen fixture writers, such as `published-marketplace.ts`, and never the lib file of another phase. XK-01, an agent that preloads a skill, belongs to Agents. MCP-07, an agent with an MCP tool, belongs to MCP Servers. HOOK-08, a hook on an MCP tool, belongs to Hooks.

## Boundaries

- The `.steps.ts` suffix is mandatory for step modules, and only step modules use it: `cucumber.json` loads step modules by that suffix, so it is also how a reader tells which files register steps. A step module lives under `features/step_definitions/` only.
- Only step modules call `Given`, `When`, or `Then`, and only support modules register anything else. A library module registers nothing and never imports a step module.
- The one Python library file is `pi-tui-pty.py`. It opens and relays a PTY for `pi-tui.ts`; no other Python file belongs under `features/`.
- A support module holds no helpers. A small helper private to one step module may stay in it; once a second module needs it, or a hook and a step both need it, it moves to `features/lib/`.
- Every external service the code talks to has a local stand-in in its own module under `features/lib/`: a loopback-only fake for a networked service, a fixture for local input such as a directory of files.
- Nothing under `features/` imports from `test/`, except a driver that reuses a process harness.
- A process under test too slow to start per scenario is the run's only module-level state. It lives in the support module named after it, and steps reach it through the world. A stand-in whose address the process fixes at start joins that state. `.agents/skills/cucumber/rules/world-and-stand-ins.md` says how they start, reset, and stop.
