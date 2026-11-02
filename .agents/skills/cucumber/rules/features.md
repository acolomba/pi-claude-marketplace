# Feature files

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

A feature file describes one user-visible capability from the outside. A reader who never opens a step definition must understand what each scenario proves. Where a feature file lives and how it is named is in `.agents/skills/cucumber/rules/layout.md`.

```gherkin
Feature: Orders checkout

  Checkout turns the lines a customer picked into a placed order.
  The scenarios run against a fake of the Acme payments API.

  Scenario: The placed order prices every line
    Given the order holds these lines:
      | item  | quantity | price |
      | apple | 2        | 2     |
      | pear  | 1        | 3     |
    When the customer places the order
    Then the order has these lines:
      | item  | quantity | subtotal |
      | apple | 2        | 4        |
      | pear  | 1        | 3        |
```

## Feature description

- Every feature has a description of two or three lines under the title.
- The description says what the feature protects and what the scenarios stand in for, such as a fake service in place of a vendor's.

## Scenarios

- Titles use sentence case and name the behavior. No `works`, `happy path`, `test`, or ticket and plan references.
- One scenario proves one behavior. A scenario that needs a second `When` to prove its point usually hides a second behavior; split it.
- A `Scenario Outline` is for three or more variants of one behavior. Its `<placeholder>` names say what each value is: `<quantity>`, not `<n>`.
- The three variants of an Outline count the rows of every `Examples:` block, tagged or not.

## Steps

- Steps are entirely lower case after the keyword, so one step never appears in two spellings. Quoted values keep their own case.
- Use `Given`, `When`, and `Then` only. Never `And` or `But`; repeat the keyword, so every step states its own role and moving a line never changes what it means.
- Order: every `Given` comes before the first `When`. After that, `When` and `Then` may alternate, and no `Given` follows a `When`: setup after an action belongs to a second behavior and a second scenario.
- `Given` states a precondition as a fact.
- `When` states one action by a named actor in the present tense.
- `Then` states an observable outcome in the present tense. Never `should`.
- Use the definite article for a specific thing and `these` to introduce a data table (`these <things>:`), so the step reads as continuing into the table below it.
- Be concise and use active verbs. Use the passive voice only when the actor is unknown.
- Steps name user-visible things only: commands the user types, results the user sees, files the user owns. They never name temporary paths, process handles, or implementation modules.

## Data tables

- Header cells name the fields of the thing they describe in lower-case words: `unit price` for `unitPrice`.
- A nested field drops a leading word that its parent already says: `cause.causeChain` is `cause chain`. So `source.kind` and `source.sourceKind` read the same, and a table cannot tell those two spellings apart. When two fields of one record read the same, the step fails rather than compare one of them.
- A table lists every row the outcome contains, not a sample. The step compares the whole set.
- A result with no rows has its own step, such as `the result lists no marketplaces`. A table with only a header row cannot be compared.
- Align the columns.

## Source kinds

A marketplace can be published as one of several source kinds: `dir`, `file`, `url`, and `github`. A behavior that several kinds share is one `Scenario Outline`:

- An untagged `Examples:` block holds the local kinds, `dir` and `file`. An `@url` block holds the url kind, and an `@github` block holds the github kind. `npm run check:features` fails on a row whose `source kind` does not belong in its block, and on a tagged block with no `source kind` column.
- The kind reaches the steps through a `<source kind>` column, and the source the user types reaches them through a `<source>` column.
- Tags appear only on `Examples:` blocks, and the only tags are `@url` and `@github`. A tag on a feature or a scenario would also tag its local rows, so excluding that tag would drop them.

```gherkin
  Scenario Outline: Adding a marketplace records it in the chosen scope
    Given the marketplace "tools" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |
```

`cucumber.json` excludes no tag, so every row runs. The url and github kinds share one stand-in, the run's https git host. The github kind reaches it through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`. If a new source kind has no stand-in yet, `cucumber.json` excludes its tag, and the work that adds the stand-in removes the exclusion. Removing a tag turns on every row of that kind, with no edit to a feature file.

A behavior that only one kind has lives in a feature file of its own.

A marketplace can also be published as `hosted`: one `marketplace.json` that the git host serves at an https URL, such as `https://{git host}/acme/tools/marketplace.json`. Every later change to the manifest is served again. A hosted marketplace has no branch, no unreadable file, and no source to remove; to make it fail, arm the git host for it. Its scenarios live in feature files of their own and never in a source-kind Outline, and `npm run check:features` rejects `hosted` in the `source kind` column of any `Examples:` block.

A plugin can also come from a git repository on the git host, as a `github`, `url`, or `git-subdir` source. These are the plugin's source kinds, not the marketplace's: any marketplace kind can offer them. An Outline over the plugin source kinds names its column `plugin source kind` and keeps its `Examples:` blocks untagged, because `npm run check:features` reads a `source kind` column, and the `@url` and `@github` tags, as the marketplace's.

## Run tokens

A scenario cannot know where its sandbox lives or when it runs. It writes each run-specific value as a brace token (D-03):

- `{home}` is the home directory of the sandbox. A command expands it to the real path, and a result shows `{home}` wherever the real path appears.
- `{project dir}` is the project directory of the sandbox, where Pi runs. The root of the project scope is `{project dir}/.pi`. It expands and projects back the same way.
- `{agent dir}` is the Pi agent directory of the sandbox, which is the root of the user scope. It expands and projects back the same way.
- `{git host}` is the `127.0.0.1:<port>` address of the run's https git host. A command expands it to that address, and a result shows `{git host}` wherever that exact address appears.
- `{<repository> revision <n>}` is the version of the n-th revision, counted from 1, that a scenario published to a git plugin repository. For example, `{ghp revision 1}` is the version of the first revision of the repository `ghp`: the first 12 hex digits of its commit, which Claude Code records for a git plugin that declares no version. Commit dates change every run, so the commit does too. A version with more around it keeps the rest as written: a `git-subdir` plugin's `{mono revision 1}-3989e95a`, or a pinned plugin of the plugin directory's `1.0.0-{dirp revision 1}`. A command expands the token to the version, and a result shows the token wherever that version appears.
- `{<repository> commit <n>}` is the full 40-hex commit of the same revision. For example, `{ghp commit 2}` is the commit of the second revision of the repository `ghp`. A command expands the token to the commit, and a result shows the token wherever that commit appears.
- An error token, such as `{mcp-adapter.json read error}` or `{unreadable skill file copy error}`, is the message Node gives a file call that a `Given` set up to fail. Node majors word one errno differently, with or without the path, so the step makes the same call, checks its code and syscall, and records the message it gets. A result shows the token wherever that message appears, before any other token is projected. A result also shows the token where the message appears with each quoted path cut to its last segment, as import and apply redact a cause. Only `{read-only skill directory removal error}` also matches where each quoted path is any path that ends in that segment, because install shows that cause at a path where the step cannot make its call (D-PL6-16). Every other error token matches only its message and its cut form.
- `{uuid}` is any lowercase RFC 4122 UUID in the text of a model call, such as the mission id that pi-subagents ends a subagent result with. The model-call steps project it, and a command never expands it. It does not prove that two ids are the same.
- `{tool call <n>}` is the id that Pi makes up for the n-th tool call of the last model turn, counted from 1 in call order. Only the stub MCP server's messages step projects it, where pi-mcp-adapter forwards the id in `_meta`.
- `{zero width space}` stands for U+200B, which the extension puts before a finished input that starts with `/` so that Pi does not expand it again. Only the model-call steps of `features/step_definitions/model.steps.ts` project it, and a command never expands it.
- `{em dash}` stands for U+2014, which the `fix-unicode-dashes` pre-commit hook rewrites in feature files. Only `the model receives these mcp calls:` (`features/step_definitions/mcp-server/status.steps.ts`) projects it, and a command never expands it.
- In the hooks runs step, a cell whose whole value is a session id reads as the session's ordinal: `first`, `second`, `third`, or `fourth`, counted by the order in which each session first appears across the runs. A session id inside a cell, such as the one in the `claude-env-<id>.env` file that `CLAUDE_ENV_FILE` names, reads as the same ordinal in its place (D-CF5-26). A command never expands an ordinal.
- In the workflow notices step, `{run id}` is the run that a workflow command started, as its progress entries name it, and `{session id}` is Pi's current session id. A command never expands either.
- `{scenario time}` in a `last updated at` cell matches any exact ISO timestamp between the start of the scenario and the check. Any other value stays as written, so a stale, future, or malformed time fails (D-05).

A token never uses `<...>`, because an Outline uses that form for its placeholders. A token never uses `~`, because the product prints `~` itself. An `Examples:` cell can hold a token: `| dir | {home}/marketplaces/tools |`. A stand-in whose address shows up in a command or a result gets its own token in the same way.

## Background

- A `Background:` holds `Given` steps only, and only those that every scenario in the file needs. Anything more moves part of a scenario's point out of the scenario.
