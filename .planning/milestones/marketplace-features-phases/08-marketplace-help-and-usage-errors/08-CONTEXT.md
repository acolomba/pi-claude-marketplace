# Phase 8: Marketplace Help and Usage Errors - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 pins `marketplace help` and every usage rejection across the
marketplace verbs (USE-01 to USE-08) with real-Pi scenarios that compare the
whole `usage-info` or `usage-error` payload. `features/marketplace/help.feature`
already holds two scenarios: the help text, and help with an argument.

The discussion chose three production changes, each written test-first:

- The marketplace help text shows `[--local]` where the verbs accept it (D-01).
- Each verb's argument signature is defined once, so the help and the
  usage line of every verb cannot drift (D-02).
- An empty argument is rejected with a message that names its field (D-05).

D-05 reaches the plugin verbs too, because they share the parser.

</domain>

<decisions>
## Implementation Decisions

### Help text

- **D-01 (user):** Fix the `marketplace help` text (`MARKETPLACE_USAGE` in
  `extensions/pi-claude-marketplace/edge/router.ts`) so its `add`, `remove`,
  `autoupdate`, and `noautoupdate` lines show `[--local]`. Each must match the
  verb's own usage line. For example, `add` rejects with
  `Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]`.
  Write it test-first: the help scenario fails on today's text, then passes.
  The `docs/output-catalog.md` entry and its byte-count constant change in the
  same commit.
- **D-02 (user):** Define each marketplace verb's argument signature once.
  Build both the verb's line in the help and its own `Usage:` line from that
  one definition, so a new flag cannot reach one and miss the other. This is a
  small refactor in the edge layer with paired unit tests. The planner chooses
  the shape, for example a signature table in the router or an export from
  each handler module. The help text keeps its current layout, including the
  alias notes and column alignment, except for the D-01 change.

### Rejection coverage

- **D-03 (user):** Cover every verb for each rejection kind. Write one
  Outline per kind, with a row for every marketplace verb that can produce it.
  Each row compares the whole `usage-error` payload: kind, severity, needs
  reload, message, and the verb's own usage line. The kinds:
  - **Missing required argument** (USE-03): `add`, `remove`, `info`, reporting
    `Missing required argument.`
  - **Surplus arguments** (USE-04): every verb, reporting `Too many arguments.`
  - **Unknown flag** (USE-05): every verb, reporting `Unknown flag: "<flag>".`,
    including `--local` on `list`, `info`, and `update`.
  - **Bad `--scope` value** (USE-06): every verb, reporting
    `Invalid --scope value: "<x>". Must be "user" or "project".`
  - **Missing `--scope` value** (USE-06): every verb, reporting
    `--scope requires a value: "user" or "project".`
  - **Empty argument** (USE-07, with D-05's wording): `add`, `remove`, `info`,
    `update`, `autoupdate`, and `noautoupdate`.
- **D-04 (user):** Cover `--scope` positions once per parser path. Every verb
  gets one bad-value row and one missing-value row. Add rows with `--scope`
  before the positional, after it, and at the end with no value, for one verb
  of each of the three parser paths:
  - `add`, `remove`, `info` (the shared open-command helper in
    `edge/handlers/marketplace/shared.ts`)
  - `list`, `update` (`parseCommandArgs` directly)
  - `autoupdate`, `noautoupdate` (`extractLocalFlag` strips `--local` first)

### Empty-value errors

- **D-05 (user):** An explicitly empty argument is an input-value validation
  error. Its message names the field: `<Field> must not be empty.` This applies
  to required and optional arguments alike, and to every verb that shares the
  parser:
  - `Source must not be empty.`: `marketplace add ""`.
  - `Marketplace name must not be empty.`: `marketplace remove ""`,
    `info ""`, `update ""`, `autoupdate ""`, and `noautoupdate ""`.
  - `Plugin name must not be empty.`: the plugin verbs that take
    `<plugin>@<marketplace>`.
  - An omitted required argument keeps `Missing required argument.` (USE-03).
    That is an absence, not a value error.

  This replaces both today's `Missing required argument.` for an empty
  required argument and the generic `Argument must not be empty.` for an empty
  optional one. Write it test-first. Update the plugin verbs' scenarios, the
  unit tests, and the catalog entries that state the old messages.
  A positional that has no obvious label (a plugin verb's `@<marketplace>`
  form, for instance) takes its label from the placeholder its usage line
  prints. The planner lists each label. — **Reversibility:** costly — it
  changes the documented catalog bytes and the `usage-error` JSON `message`
  across both the marketplace and the plugin verbs, so undoing it touches the
  catalog, the scenarios, and the unit tests again.

- **D-06 (user, after research):** D-05 reaches every verb, including the
  plugin verbs that do not use the shared parser. Research found two gaps
  there:
  - `install`, `info`, `update`, `fetch`, and `reinstall` reject `""` as
    `Invalid <plugin>@<marketplace> ref: "".`.
  - Plugin `list ""` is accepted and lists nothing.

  Under D-06:
  - An explicitly empty plugin ref (`""`) reports
    `Plugin name must not be empty.`.
  - An `@<marketplace>` form whose name is empty (`@`) reports
    `Marketplace name must not be empty.`.
  - Plugin `list ""` is rejected with `Marketplace name must not be empty.`.

  A partly malformed ref (for example `foo@`) keeps its
  `Invalid <plugin>@<marketplace> ref` message, unless research shows a clean
  mapping to a named empty field. The rule covers values that are empty as a
  whole. Written test-first. The tests that pin the old messages are updated,
  for example `tests/edge/handlers/plugin/reinstall.test.ts:898-920`.
- **Resolved after research (orchestrator):**
  - The top-level `help` and `help help` text is not pinned in this phase.
    It belongs to the deferred top-level help fix, which will change it.
  - The user-visible changes of D-01, D-05, and D-06 each get a CHANGELOG
    entry under `[Unreleased]`, per `.agents/skills/changelog/SKILL.md`.

### Pinned as they are (carried forward, not re-asked)

- USE-01: `marketplace help` and `help marketplace` both return `usage-info`
  with the marketplace usage.
- USE-02: a bare `marketplace` reports `marketplace requires a subcommand.`,
  and an unknown subcommand reports `Unknown marketplace subcommand: "<x>".`.
  Both show the marketplace usage.
- USE-08: `marketplace help extra` reports
  `marketplace help takes no arguments.` with
  `Usage: /claude:plugin marketplace help`. The existing scenario stays.
- A rejection shows the verb's own usage line, not the whole marketplace
  usage. Phase 1 set the whole-payload comparison.

### Claude's Discretion

- Whether the `rm` and `ls` aliases get rows of their own in the rejection
  Outlines. RM-07 and LS-04 already pin that the aliases succeed the same way.
- Whether to pin a flag given as the `--scope` value (`--scope --local`, which
  reads as an invalid value), and `help marketplace extra` (today
  `Unknown help topic: "marketplace extra".`).
- Outline titles and table layout, within `.agents/skills/cucumber/rules/`.
  Each Outline needs three or more rows.
- How the plan splits the work. D-01 depends on D-02. The D-05 parser change
  lands with every scenario, test, and catalog entry it changes, so the
  commit hook stays green.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contract and phase scope

- `.planning/ROADMAP.md`: the Phase 8 goal and success criteria.
- `.planning/REQUIREMENTS.md`: USE-01 to USE-08.
- `.planning/PROJECT.md`: "Terminology: Scope and Layer" (line 13), the output
  channel rule, and the upstream-parity rule.
- `.planning/phases/07-marketplace-autoupdate/07-CONTEXT.md`: the most recent
  phase's conventions (test-first evidence, catalog-change commits).

### Code

- `extensions/pi-claude-marketplace/edge/router.ts`: `MARKETPLACE_USAGE`,
  `TOP_LEVEL_USAGE`, `selectMarketplaceRoute`, and `MARKETPLACE_HELP_USAGE`.
- `extensions/pi-claude-marketplace/edge/args.ts`: `parseArgs`, which holds
  the `--scope` messages.
- `extensions/pi-claude-marketplace/edge/args-schema.ts`: `parseCommandArgs`
  (the unknown-flag, too-many, required, and empty checks). D-05 changes it.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/*.ts`: each
  verb's `USAGE`, plus `shared.ts`
  (`openMarketplaceCommand`, `makeSingleNameMarketplaceHandler`), which maps
  the usage reply to `Missing required argument.`.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts`:
  `extractLocalFlag`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/*.ts`: the plugin
  verbs that share the parser (D-05), and `help.ts`.
- `docs/output-catalog.md`: the usage entries.
- `docs/json-output.md`: the `usage-error` and `usage-info` payloads.

### Behavioral tests

- `.agents/skills/cucumber/SKILL.md`, with `rules/layout.md`,
  `rules/features.md`, and `rules/steps.md`.
- `features/marketplace/help.feature`: the existing help scenarios.
- `features/plugin/*.feature`: any plugin scenario that pins an empty-argument
  message (D-05).

### Upstream compatibility evidence

- **Question:** does Claude Code define marketplace help or usage-error text
  that Pi should match?
- **Claude Code 2.1.296:** `claude plugin marketplace --help` is commander
  output. Upstream has no `info`, `autoupdate`, or `noautoupdate` command, and
  its usage-error wording comes from commander.
- **Confidence:** high, from the help output checked during the Phase 7
  discussion.
- **Divergence:** none. The `/claude:plugin` help and usage-error text is
  Pi's own surface.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/step_definitions/command.steps.ts`: "the user runs" and "the
  result has these fields:", which compares the whole payload.
- The existing `help.feature` scenarios show the usage-info and usage-error
  field tables.

### Established Patterns

- `parseCommandArgs` rejects in order: an unknown long flag
  (`Unknown flag: "<flag>".`), then surplus positionals
  (`Too many arguments.`), then a missing or blank required positional (it
  returns the usage, which the marketplace helper maps to
  `Missing required argument.`), then a blank optional positional
  (`Argument must not be empty.`).
- `parseArgs` rejects `--scope` with no value or a value other than `user` or
  `project`, wherever it appears.
- The tokenizer keeps an explicit `""` as an empty token, so an empty argument
  differs from an omitted one.

### Integration Points

- The help text and each verb's usage line come from separate string
  constants today. D-02 merges them into one definition per verb.

</code_context>

<specifics>
## Specific Ideas

- Show the D-01 help scenario and the D-05 empty-value rows failing on
  today's code before the fix. Record the RED evidence as Phase 7 did
  (`*-RED.json`).
- The usage line in each rejection row is that verb's line, so the rejection
  matrix also pins every verb's usage text.

</specifics>

<deferred>
## Deferred Ideas

- The top-level `/claude:plugin help` (`TOP_LEVEL_USAGE`) has drifted the same
  way. It omits `[--local]`, `--map-model`, and `--partial` on `install`,
  `update`, and `reinstall`, which those verbs' own usage lines show. That is
  plugin help, outside this phase, and a candidate for its own change applying
  the D-02 single-source pattern.
- The plugin `list` verb reports an unknown flag as `Unknown option: "<x>".`,
  but the marketplace verbs say `Unknown flag: "<x>".`. This is a plugin-family
  wording inconsistency, outside this phase.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md`: porting the
  cucumber skills to another repository is outside this phase.

</deferred>

---

*Phase: 08-marketplace-help-and-usage-errors*
*Context gathered: 2026-10-20*
