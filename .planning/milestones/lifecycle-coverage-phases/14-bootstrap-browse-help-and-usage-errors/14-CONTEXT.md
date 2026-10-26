# Phase 14: Bootstrap, Browse, Help, and Usage Errors - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Scenarios for the plugin subcommands no other phase owns: `bootstrap`, the
`browse` refusal outside the TUI, plugin `help`, and the usage rejection of
every plugin subcommand (BOO-01, BOO-02, BRW-01, HLP-01, USE-01). Files this
phase owns: `features/plugin/bootstrap.feature` (seeded by Phase 1),
`features/plugin/usage-errors.feature` (pre-existing),
`features/plugin/browse.feature`, `features/plugin/help.feature`, and the verb
step modules `plugin/bootstrap.steps.ts`, `plugin/browse.steps.ts`,
`plugin/help.steps.ts` if a step is missing. Product bugs that a scenario
exposes are fixed in this phase, with Claude Code as the reference.

</domain>

<upstream>
## Upstream position (Claude Code 2.1.308, installed binary)

- `bootstrap` has no upstream command; its nearest upstream behavior is
  `claude plugin marketplace add` for the same source. Upstream throws
  `Failed to clone marketplace repository: <git stderr>` and the CLI prints
  that message, so a failed add always tells the user why.
- The upstream CLI parser (commander) tells an unknown option
  (`unknown option '--x'`) apart from surplus arguments
  (`too many arguments`). It never reports a flag as a positional argument.

</upstream>

<measured>
## Measured behavior before this phase (rpc mode, headless Pi)

- First `bootstrap`: two `cascade` results, `claude-plugins-official` /
  `user` / `added`, then `autoupdate enabled`. Second run: one `skipped`
  row, reason `already autoupdate`, no git request (Phase 1 seed).
- `bootstrap` on a 404: one `cascade` error, summary `A marketplace operation
  has failed.`, row `claude-plugins-official` / `user` / `failed`, no reasons
  and no cause. `marketplace add anthropics/claude-plugins-official` on the
  same 404 reports a failed child row with reason `source missing` and the
  cause chain `HTTP Error: 404 Not Found`, `fetched https://.../anthropics/claude-plugins-official.git`.
- `browse` and bare `/claude:plugin` in rpc mode: `usage-error`, message
  `Browse is unavailable in rpc mode. Use /claude:plugin list instead.`,
  usage `Usage: /claude:plugin browse`.
- `help` and `help help`: `usage-info` with the full plugin usage.
  `help bogus`: `Unknown help topic: "bogus".`, usage
  `Usage: /claude:plugin help [marketplace]`.
- Usage rejections that differ from the shared form
  (`Unknown flag: "<flag>".`, `Too many arguments.`, which the marketplace
  verbs and most plugin verbs use):
  - `bootstrap --bogus` and `bootstrap --local`: `bootstrap takes no arguments.`
  - `import --bogus`: `import does not accept positional arguments.`
  - `browse --bogus`, `browse --scope bad`: `browse takes no arguments.`
  - `help marketplace --bogus`, `help --scope bad marketplace`:
    `Unknown help topic: "<everything typed>".`
  - `list --bogus`, `ls --bogus`, `pending --bogus`: `Unknown option: "--bogus".`
  - `install p@m extra`, `info p@m extra`:
    `<verb> requires exactly one <plugin>@<marketplace> argument.`

</measured>

<decisions>
## Implementation Decisions

### Bootstrap
- **D-01:** A failed `bootstrap` add reports exactly what `marketplace add`
  reports for the official source: the failed row with its reason and cause
  chain. The autoupdate step does not run after a failed add. Upstream
  evidence: Claude Code prints the clone failure's cause; Phase 1 (01-06)
  recorded the causeless row as a bug. Implementation: `add.ts` exports a
  function that renders a failed add the way the public command does (the
  existing `handleAddFailure` standalone arm), and `bootstrapClaudePlugin`
  calls it for every error except `MarketplaceDuplicateNameError`. An error
  that is not an add precondition still reaches the handler's existing catch.
- **D-02:** `bootstrap.feature` covers: the first run (both results, the user
  config declares the official marketplace with autoupdate, the git host
  receives the clone requests), the existing second-run seed, the failed run
  on a 404 (D-01, nothing recorded), and the rejections of a positional
  argument, an unknown flag, `--scope user`, `--scope project`, and a bad
  `--scope` value (BOO-02).

### Usage rejections (USE-01)
- **D-03:** Every plugin subcommand rejects a flag it does not accept with
  `Unknown flag: "<flag>".` and its own usage line. Fix `bootstrap`,
  `import`, `browse`, `help`, `list`/`ls`, and `pending`. Upstream evidence:
  commander's unknown-option error; the marketplace verbs already do this.
- **D-04:** A one-operand subcommand (`install`, `info`) rejects a surplus
  positional with `Too many arguments.`, as `uninstall`, `enable`, `disable`,
  and the marketplace verbs do. The missing-operand message of `install` and
  `info` stays as it is (out of USE-01's scope).
- **D-05:** A zero-operand subcommand keeps its own sentence for a surplus
  positional: `bootstrap takes no arguments.`, `browse takes no arguments.`,
  `import does not accept positional arguments.`, as `marketplace help
  takes no arguments.` does. Only flag tokens change (D-03).
- **D-06:** `help` takes at most one topic. A flag is an unknown flag (D-03),
  a second positional is `Too many arguments.`, and one unknown topic stays
  `Unknown help topic: "<topic>".`
- **D-07:** `usage-errors.feature` mirrors the marketplace usage-error
  feature: Scenario Outlines per rejection kind (unknown flag, too many
  arguments, bad `--scope` value in either position, `--scope` with no
  value), one example row per plugin subcommand and alias, each comparing
  kind, severity, needs reload, message, and usage. Subcommands that do not
  accept `--scope` (`browse`, `help`) reject `--scope bad` as the unknown flag
  `--scope`; `bootstrap` rejects it as an invalid value before its own
  `--scope` refusal. The existing four outlines stay.

### Browse and help
- **D-08:** `browse.feature`: `browse` and bare `/claude:plugin` are refused
  in rpc mode with the message naming `/claude:plugin list` and the browse
  usage; `browse extra` is rejected as taking no arguments (BRW-01). The TUI
  picker itself is out of scope (no TUI in the headless driver).
- **D-09:** `help.feature`: `help` shows the plugin usage as a `usage-info`
  result compared whole; `help bogus` is rejected; an unknown subcommand
  shows the plugin usage with a reason (HLP-01). `help marketplace` is
  already covered by `features/marketplace/help.feature`.

### Steps and ownership
- **D-10:** No new step module is expected: the shared command, git-host, and
  config steps cover every scenario. If a step is missing it goes in this
  phase's verb module with text that names its verb.
- **D-11:** The product fixes touch handler files of verbs that other phases
  test (`install`, `info`, `list`, `pending`, `import`). Those edits change
  only the usage-error wording, so a merge conflict, if any, is local to the
  rejection branch. Each fix updates its source-test pair and the
  `COMMAND_ARGUMENT_CASES` table in `test/edge/register.test.ts`.

### Claude's Discretion
- Exact scenario titles and example-row order.
- Whether the help-usage rows use a Scenario Outline or separate scenarios.

</decisions>

<code_context>
## Existing Code Insights

- `edge/handlers/plugin/{bootstrap,import,browse,help,list,pending,install,info}.ts`
  hold the rejection branches. `edge/args-schema.ts` documents the shared
  sentences.
- `orchestrators/marketplace/add.ts` `handleAddFailure` renders the public
  failed row; `rethrowPreconditionErrors` is bootstrap's only use.
- `test/edge/register.test.ts` `COMMAND_ARGUMENT_CASES` states per-verb
  overrides of the shared sentences.
- Steps: `command.steps.ts` (results), `git-host.steps.ts` (arming, request
  log), `config.steps.ts` (declared marketplaces).

</code_context>

<deferred>
## Deferred Ideas

- The handler's catch-all failed row for a non-precondition error (for
  example a held state lock) still carries no cause; the state-lock phase
  (Phase 15) owns lock scenarios.

</deferred>

---

*Phase: 14-bootstrap-browse-help-and-usage-errors*
*Context gathered: 2026-10-23*
