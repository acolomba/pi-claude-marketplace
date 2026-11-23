---
phase: quick-261123-qrv
plan: 01
type: execute
wave: 2
quick_id: 261123-qrv
depends_on: ["261123-qru"]
files_modified:
  - features/lib/pi-commands.ts
  - features/step_definitions/session.steps.ts
  - features/support/world.ts
  - features/step_definitions/command.steps.ts
  - features/lib/result-rows.ts
  - features/lib/path-marketplace.ts
  - features/step_definitions/workflow/companion-missing.steps.ts
  - features/step_definitions/workflow/listing.steps.ts
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - features/agent/frontmatter.feature
  - features/agent/invocation.feature
  - features/agent/lifecycle.feature
  - features/agent/listing.feature
  - features/agent/project-trust.feature
  - features/hook/additional-context.feature
  - features/hook/async.feature
  - features/hook/compaction.feature
  - features/hook/configuration.feature
  - features/hook/failures.feature
  - features/hook/lifecycle.feature
  - features/hook/matchers.feature
  - features/hook/messages.feature
  - features/hook/process.feature
  - features/hook/prompt-and-stop.feature
  - features/hook/prompt-commands.feature
  - features/hook/prompt-expansion.feature
  - features/hook/session-end.feature
  - features/hook/session.feature
  - features/hook/stop-failure.feature
  - features/hook/tool-failure.feature
  - features/hook/tool-use.feature
  - features/marketplace/add.feature
  - features/marketplace/autoupdate.feature
  - features/marketplace/file-source-update.feature
  - features/marketplace/refused-name.feature
  - features/marketplace/remove.feature
  - features/marketplace/update.feature
  - features/mcp-server/agent-grants.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/options.feature
  - features/mcp-server/verdict-list.feature
  - features/plugin/apply.feature
  - features/plugin/autoapply.feature
  - features/plugin/component-directories.feature
  - features/plugin/config-migration.feature
  - features/plugin/configuration.feature
  - features/plugin/disable.feature
  - features/plugin/enable.feature
  - features/plugin/executables.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source-update.feature
  - features/plugin/git-source.feature
  - features/plugin/import.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/install-rollback.feature
  - features/plugin/install.feature
  - features/plugin/model-tools.feature
  - features/plugin/options.feature
  - features/plugin/package-dependencies.feature
  - features/plugin/partial-install.feature
  - features/plugin/project-locality.feature
  - features/plugin/project-trust.feature
  - features/plugin/reconcile.feature
  - features/plugin/reinstall.feature
  - features/plugin/session-start-hooks.feature
  - features/plugin/state-migration.feature
  - features/plugin/subagent-child.feature
  - features/plugin/uninstall.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update-rollback.feature
  - features/plugin/update.feature
  - features/skill/aliases.feature
  - features/skill/collisions.feature
  - features/skill/frontmatter.feature
  - features/skill/invocation.feature
  - features/skill/lifecycle.feature
  - features/skill/listing.feature
  - features/skill/model-reads.feature
  - features/skill/options.feature
  - features/skill/project-trust.feature
  - features/skill/root-source-entries.feature
  - features/skill/sibling-links.feature
  - features/slash-command/aliases.feature
  - features/slash-command/frontmatter.feature
  - features/slash-command/invocation.feature
  - features/slash-command/lifecycle.feature
  - features/slash-command/listing.feature
  - features/slash-command/manifest-forms.feature
  - features/slash-command/model-runs.feature
  - features/slash-command/options.feature
  - features/workflow/agent-steps.feature
  - features/workflow/agent-types.feature
  - features/workflow/collisions.feature
  - features/workflow/companion-missing.feature
  - features/workflow/lifecycle.feature
  - features/workflow/listing.feature
  - features/workflow/references.feature
  - features/workflow/refusals.feature
  - features/workflow/run.feature
  - features/workflow/storage.feature
  - .planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-SUMMARY.md
autonomous: true
must_haves:
  truths:
    - "An RPC scenario reloads Pi with `When the user reloads pi` or `Given the user has reloaded pi`: the driver `reloadSession` in `features/lib/pi-commands.ts` sends the prompt `/claude:plugin reload`, requires the disposition `handled` with no extension error and no dialog, and keeps only the payloads that the reload appended after the command, each valid against the payload schema (DRV-01), as session results, with the skills Pi offers after the reload."
    - "The doc comment of `startSession` no longer says that a new session works like Pi's reload. It names what a new session does that a reload does not (SessionEnd, then SessionStart with source clear, an empty conversation, a new session id, `resources_discover` with reason startup, two binds over RPC) and points to `reloadSession`."
    - "Every use of the five new-session step forms (639 lines in 92 feature files at 98ada0c) and each of the five library `startSession` callers has one row in `$D/new-session-audit.tsv`, with exactly one category from the closed set and a reason with its evidence, assigned by the precedence rules of this plan. The SUMMARY lists the count of each category with its files."
    - "Every use classified `switch:reload-stand-in` reloads. Every use that depends on SessionStart or SessionEnd hooks, an empty conversation, a saved session, live MCP connections, another project, or the shared Pi reset still starts a new session, and so do the five library callers."
    - "Each switched scenario states the outcome that it stated before. The one exception: a table of what a switched `When` produced lists the rows of one load, which is a prefix of its old rows, because a reload binds the extension once where RPC `new_session` binds it twice. Any other difference reverted that switch, and the SUMMARY reports it."
    - "`npm run check:static` (with `check:features`: no unused, undefined, or ambiguous step) and `npm run test:cucumber` (adapter, then builtin) pass on the final tree. The dry-run scenario and step totals of both profiles equal those before Task 1. No file outside `files_modified` changed: no product, unit-test, script, or config file."
  artifacts:
    - path: features/lib/pi-commands.ts
      provides: "the reload driver `reloadSession` beside `startSession` and `readSession`, and the corrected `startSession` doc comment"
      exports: ["reloadSession", "startSession", "readSession"]
      contains: "const RELOAD_COMMAND = \"/claude:plugin reload\";"
    - path: features/step_definitions/session.steps.ts
      provides: "the RPC reload steps `Given the user has reloaded pi` and `When the user reloads pi`"
      contains: "\"the user reloads pi\""
    - path: .agents/skills/cucumber/rules/world-and-stand-ins.md
      provides: "the reload driver, the reload steps, and when a scenario reloads or starts a new session"
      contains: "`When the user reloads pi`"
    - path: .planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-SUMMARY.md
      provides: "the audit counts per category with file lists, the switch results, and the checks"
      contains: "## Audit"
  key_links:
    - from: features/step_definitions/session.steps.ts
      to: features/lib/pi-commands.ts
      via: "both reload steps call `reloadSession(this.pi)`; the `When` keeps the report through `keepSession`, as the new-session `When` does"
      pattern: "reloadSession\\(this\\.pi\\)"
    - from: features/lib/pi-commands.ts
      to: extensions/pi-claude-marketplace/edge/router.ts
      via: "the prompt `RELOAD_COMMAND` reaches the `reload` subcommand that 261123-qru adds, whose handler awaits `ctx.reload()` before it returns"
      pattern: "message: RELOAD_COMMAND"
    - from: features/plugin/reconcile.feature
      to: features/step_definitions/session.steps.ts
      via: "the switched scenarios type the step texts that the module registers; `check:features` fails on an unused or undefined step"
      pattern: "^    When the user reloads pi$"
---

# Quick 261123-qrv: RPC scenarios reload instead of starting a new session

<objective>
Apply decision 5 of `.planning/research/HEADLESS-RELOAD.md`: RPC scenarios reload. Today 639
step lines in 92 feature files start a new session with RPC `new_session` (`startSession`), and
the comment of `startSession` claims that a new session works like `/reload`. It does not: a new
session runs SessionEnd, then SessionStart with source `clear`, empties the conversation, gets a
new session id, loads with reason `startup`, and binds the extension twice over RPC. A reload does
none of those (Pi 1.5.1 facts below).

After this plan:

- The harness has an RPC reload: `reloadSession(pi)` in `features/lib/pi-commands.ts`, which
  sends `/claude:plugin reload` (the subcommand of sibling item 261123-qru), and the steps
  `Given the user has reloaded pi` and `When the user reloads pi`.
- A mechanical audit, `$D/new-session-audit.tsv` (`$D` is this plan's scratch folder; see
  "Execution rules"), classifies every new-session use and the five library callers, with a
  reason per row.
- Every use that only stands in for a reload now reloads. Every use that tests a new session keeps
  it.
- The `startSession` comment is true.
- Both cucumber profiles pass.

No product change. Purpose: the scenarios test the reload that a real RPC client now has, and the
new-session scenarios that remain test a new session.

Output: four commits (the harness with four tracer scenarios, then the switches of three feature
areas), the audit table under `$D`, and `261123-qrv-SUMMARY.md` with the counts per category and
their file lists.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/research/HEADLESS-RELOAD.md
@.agents/skills/cucumber/SKILL.md
@.agents/skills/cucumber/rules/features.md
@.agents/skills/cucumber/rules/steps.md
@.agents/skills/cucumber/rules/world-and-stand-ins.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/committing/SKILL.md
@.agents/skills/local-verification/SKILL.md
@features/lib/pi-commands.ts
@features/step_definitions/session.steps.ts
@features/support/pi-process.ts

Read when the task needs them: `features/support/world.ts` (`recordResults`, `resultsOf`,
`sessionSkills`, `startSessionInAnotherProject`, `restartPi`), `features/lib/pi-process.ts`
(`RUNTIME_REQUESTS`, `request`), `features/step_definitions/hook/session.steps.ts`
(`recordSessionAction`), and the merged sibling's SUMMARY,
`.planning/quick/261123-qru-*/261123-qru-SUMMARY.md`. The sibling's plan did not exist when this
plan was written, so the reload contract below is this plan's expectation, and Task 1 checks it.

<interfaces>
From features/lib/pi-commands.ts (98ada0c):

```typescript
export type NotificationPayload = Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
export interface OfferedSkill { readonly command: string; readonly description: string; }
export interface SessionReport {
  readonly skills: readonly OfferedSkill[];
  readonly payloads: readonly NotificationPayload[];
}
export function claudePluginPayloads(
  entries: ReadonlyArray<{ readonly customType?: string; readonly data?: unknown }>,
): NotificationPayload[];
export async function runCommandPayloads(pi: PiProcess, command: string): Promise<readonly NotificationPayload[]>;
export async function startSession(pi: PiProcess): Promise<SessionReport>; // RPC new_session, then readSession
export async function readSession(pi: PiProcess): Promise<SessionReport>; // get_commands skills + all session payloads
export async function sendMessage(pi: PiProcess, message: string): Promise<readonly NotificationPayload[]>;
// private: assertQuiet(exchange), readCustomEntries(pi) -> the session's `custom` entries in order
```

From features/lib/pi-process.ts:

```typescript
export interface RpcExchange {
  readonly response: Readonly<Record<string, unknown>>;
  readonly entries: readonly CustomEntry[];
  readonly extensionErrors: readonly string[];
  readonly dialogs: readonly string[];
}
// PiProcess.request(request: RpcRequest): Promise<RpcExchange>
// RUNTIME_REQUESTS = new_session, switch_session, fork, clone: the requests that decide project trust
```

From features/step_definitions/session.steps.ts:

```typescript
function keepSession(world: ScenarioWorld, report: SessionReport): void; // recordResults(payloads, "session"); world.skills = skills
// Given "the user has started a new pi session"            -> every payload info
// Given "the user has started a new pi session, which warned" -> payloads non-empty, every one a warning
// When  "the user starts a new pi session"                  -> keepSession(startSession)
// When  "the user starts a new pi session in another project" -> keepSession(world.startSessionInAnotherProject())
// Then  "the session reports these results:" / "the session reports no results" / "the session offers these skills:"
```

From features/support/world.ts:

```typescript
recordResults(results: readonly NotificationPayload[], source: "command" | "session"): void;
resultsOf(source: "command" | "session"): readonly NotificationPayload[];
sessionSkills(): readonly OfferedSkill[]; // throws "no new session has started in this scenario"
```
</interfaces>
</context>

## Scope note

One plan, three tasks. Task 1 is the tracer. It adds the driver and both steps, fixes the
comments, documents the steps, and switches four scenarios that cover the shared Pi, a profile Pi
with the scripted model, both profiles, both step forms, a title rewording, and the double-bind
row change, in one commit. Task 2 builds the audit table, in `$D` only, with no commit. Task 3
applies the audit, runs both whole profiles, triages each failure by the rules below, commits by
feature area (plugin and marketplace; hooks; the component directories), runs the final gates, and
writes the SUMMARY.

## Pi 1.5.1 facts this plan relies on

Paths under `node_modules/@earendil-works/pi-coding-agent/`.

- F1. RPC `prompt` runs an extension command before anything else (`dist/core/agent-session.js:1704-1709`,
  `_tryExecuteExtensionCommand` at `:1782`). Pi answers `{disposition: "handled"}` only after the
  handler returned (`dist/modes/rpc/rpc-mode.js:314-338`, `preflightResult`). Pi's own `/reload` is a
  terminal built-in (`dist/modes/interactive/interactive-mode.js:2762`), and RPC has no reload request.
- F2. `ctx.reload()` in RPC awaits `session.reload()` (`rpc-mode.js:256`). It runs `session_shutdown`
  with reason `reload` in the old runtime, reloads the settings and resources without resolving
  project trust (`dist/core/resource-loader.js:370-381`), builds one new runtime, then emits
  `session_start` and `resources_discover` with reason `reload` (`agent-session.js:3094-3134`). Pi's
  docs tell a handler to treat it as terminal: `await ctx.reload(); return;` (`docs/extensions.md:1514-1531`).
- F3. RPC `new_session` builds a new runtime and binds the extension again (`rpc-mode.js:356-363`),
  with `session_start` reason `new` and `resources_discover` reason `startup`. The new session's
  entries hold the payloads of both binds, so a load condition that lasts is reported twice
  (`features/lib/pi-commands.ts:168-171`, `world-and-stand-ins.md:27`).
- F4. The hooks bridge runs no SessionEnd and no SessionStart on a reload
  (`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1434`, `:1727`, D-CF5-03). The
  late SessionStart runs only for reason `startup` (`event-router.ts:1378-1390`, HOOKLATESS-D1). A new
  session runs SessionEnd with reason `clear`, then SessionStart with source `clear`.
- F5. A new session empties the conversation and gets a new session id. A reload keeps both, and it
  keeps the entries that came before it.
- F6. Pi decides project trust only when it builds a runtime (`dist/main.js:644-679`). A reload keeps
  the trust of the runtime it reloads. Over RPC, with no trust entry, a new runtime in a project that
  holds a trust-requiring resource decides "not trusted" (`dist/core/project-trust.js:18-61`). So
  `PiProcess` stays right to count only `new_session`, `switch_session`, `fork`, and `clone` as
  trust-deciding requests (`features/lib/pi-process.ts:88-95`, `:265-268`). Do not add the reload.
- F7. Both MCP implementations close their connections at every `session_shutdown` and connect again
  at every `session_start`, a reload included (`dist/extensions/mcp/index.js:972`, `:1115`;
  `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts:1679`, `:1849`).
- F8. A reload clears Pi's extension cache (`resource-loader.js:372`), so every extension module loads
  again. A new session reuses the loaded modules.

## The reload contract (expected from 261123-qru)

- Command text, sent as the `message` of an RPC `prompt`: exactly `/claude:plugin reload`.
- Availability: `acceptsLaterCommands(ctx)` is `ctx.hasUI`, and RPC binds a UI context (Pi
  `dist/core/extensions/runner.js:404`). So over RPC the subcommand runs. In a one-shot host it
  refuses (decision 2), which no RPC scenario reaches.
- Response: `{ disposition: "handled" }`, with no `extension_error` and no dialog during the
  request. It arrives after the reload has finished (F1, F2), because the handler awaits
  `ctx.reload()` before it returns.
- Payloads: on success the command appends no `claude-plugin` payload of its own. Every
  `claude-plugin` entry after the command comes from the reloaded runtime's load, in session order,
  such as the reconcile pending block or an MCP move notice. There is none when the load has nothing
  to report.
- If the merged handler does append a payload of its own on success, the driver asserts that
  payload by exact value (its kind and fields, as the sibling's own scenario states them) at the
  position where the handler emits it. It returns only the load payloads, in session order, and the
  SUMMARY records the contract. If the handler returns before `ctx.reload()` resolves, refuses over
  RPC, or answers anything but `handled`, the precondition failed: stop and report.

## Audit rules

The table is `$D/new-session-audit.tsv`. It is tab-separated, and its header row is exactly
`file`, `line`, `step`, `scenario`, `scenario line`, `pi`, `signals`, `category`, `reason`, `outcome`.

Rows:

- One row per use in a feature file. A use is a step line, a Background included, whose text after
  the keyword is one of seven forms. The five new-session forms are `the user has started a new pi session`,
  `the user has started a new pi session, which warned`, `the user starts a new pi session`,
  `the user starts a new pi session with the hooks recording`, and
  `the user starts a new pi session in another project`. The two reload forms are those that Task 1
  introduces: `the user has reloaded pi` and `the user reloads pi`, matched as the whole text, so
  the terminal steps never match.
- Column values: `step` is the keyword and the text exactly as in the file, and `line` is its line
  at `HEAD`, the tracer commit. `scenario` is the title, or `Background of <feature title>`.
  `scenario line` is the line of its `Scenario` or `Background`. `pi` is `profile` when a step
  above the use, the Background's included, starts with `pi runs with`, and `shared` otherwise.
  `outcome` is `-` until Task 3 fills it.
- Five library rows, one for each `startSession(` call outside `features/step_definitions/session.steps.ts`:
  `features/support/pi-process.ts`, `features/lib/real-subagent-child.ts`,
  `features/lib/subagent-hook-session.ts`, `features/step_definitions/plugin/subagent-hooks.steps.ts`,
  and `features/step_definitions/hook/session.steps.ts` (lines 245, 742, 587, 434, and 513 at
  98ada0c). `line` is the line of the call at `HEAD`, `step` is that line trimmed, `scenario` is
  the step text or the hook that the call serves, and `pi` is `n/a`.
- The script fails on any step that contains `new pi session` but holds none of the five
  new-session forms, so no sixth form slips through.

Signals: the `signals` column holds their names, comma-separated. The `reason` column holds the
evidence: the matched step or row, with its line.

- `other-project`: the form ends with `in another project`.
- `hooks-recording`: the form ends with `with the hooks recording`.
- `session-hooks`: the scenario's text matches `\bSession(Start|End)\b|session (start|end) hook`,
  case-insensitive. The scenario's text is its title, its own steps and the Background's, their
  data tables and doc strings, and its Examples rows. The feature description does not count.
- `turn-before`: a step above the use, the Background's included, starts with `the user `
  followed by one of `prompts `, `has prompted `, `compacts`, `has compacted`, `forks`,
  `has forked`, `resumes`, `has resumed`, `releases`, `has released`, `sends the message`,
  `has sent the message`, `runs the workflow command`, or `has run the workflow command`.
- `saved-session`: the scenario's text, as for `session-hooks`, matches
  `saves its session|saved pi session|the last session|resumed the session|resumes the saved|\{session file\}`.
- `live-mcp`: the text of a step below the use, without its table, matches
  `has listed the tools of the stub mcp server|lists the mcp tools pi offers|plugin mcp tools|registered mcp servers|stub mcp server .*receives|through the mcp implementation|complete mcp`.
- Flags, which never set a category:
  - `trust-write`: `pi` is `shared`, and a step above the use matches
    `the mcp\.json file of the project scope holds|"mcp\.json" of the project scope holds|the project holds a pi settings file|\.pi/(settings\.json|mcp\.json|extensions|skills|prompts|themes|SYSTEM\.md|APPEND_SYSTEM\.md)|\.agents/skills`.
    These are Pi's trust-requiring project resources (`dist/core/trust-manager.js:8-16`, F6).
  - `repeated-rows`: the use is a `When`, and the first `the session reports these results:`
    table below it, before the next `When`, holds a row twice.
  - `title-new-session`: the scenario title contains `new session`.

Category: the first rule that matches wins.

1. `other-project` gives `keep:another-project`. The step starts a second Pi in another project and
   sends no `new_session`.
2. `hooks-recording` or `session-hooks` gives `keep:session-hooks`. A new session runs those hooks;
   a reload never does (F4).
3. `turn-before` gives `keep:empty-conversation`. A new session empties the conversation; a reload
   keeps it (F5).
4. `saved-session` gives `keep:saved-session`. A new session writes a new session file; a reload
   keeps the file.
5. `live-mcp` gives `keep:live-mcp`, the MCP connections of a new session.
6. Otherwise `switch:reload-stand-in`. Its reason is `relies on:`, then the distinct `When` and
   `Then` step texts below the use, quotes kept and tables left out, then the flags.

Evaluate a Background use once for each scenario of its file. Above the use: the Background steps
above it. Below the use: the Background steps below it, then that scenario's steps. The use takes
the first keep category that any scenario yields, and switch otherwise. Its reason names the
scenario that decided.

Library rows always get these categories:

- `features/support/pi-process.ts`: `keep:shared-pi-reset`. The `Before()` reset ends the last
  scenario's session, which runs its SessionEnd hooks (D-CF5-26), empties the conversation, and
  starts each scenario in a new session (decision 5).
- `features/lib/real-subagent-child.ts`: `keep:session-hooks`. `installPlugin` asserts that the
  session id changed. The real-children runs table names the session that the install ended
  `startup` and the new one `main`, and the hooks record every event.
- `features/lib/subagent-hook-session.ts`: `keep:names-new-session`. `runChildStages` reads the
  other sessions' waiting hooks after the stage `new session`, which its step names: "starts a new
  session".
- `features/step_definitions/plugin/subagent-hooks.steps.ts`: `keep:empty-conversation`. Its step
  prompts in the startup session, starts a new session ("in a new session"), and compares the next
  turn's model calls.
- `features/step_definitions/hook/session.steps.ts`: `keep:session-hooks`. The step
  `the user starts a new pi session with the hooks recording` records the SessionEnd and
  SessionStart `clear` runs.

Review lists, each with the header `count`, `text`, `decision`, one row per distinct step text:

- `$D/turn-misses.tsv`: steps above a use whose text contains `prompt`, `compact`, `fork`, `resum`,
  `release`, `workflow command`, or `message` but did not set `turn-before`. Decide `turn` or
  `not a turn`.
- `$D/mcp-misses.tsv`: steps below a use whose text contains `mcp` and did not set `live-mcp`,
  except the file steps (`mcp configuration file`, `mcp.json file`, `mcp-adapter.json`). Decide
  `live` or `not live`.

A `turn` or `live` decision goes into the script as a new pattern, and the script runs again. Never
edit a category by hand, except a library row or a Task 3 revert.

For orientation only: a dry run of these rules at 98ada0c gave about 570 switches, 57 session-hook
keeps, 6 another-project keeps, 5 live-MCP keeps, 1 empty-conversation keep, and 0 saved-session
keeps (each saved-session scenario also declares session hooks). It also found about 51 switched
`When` uses with repeated rows, about 70 switched uses whose title names a new session, and 13
`trust-write` flags, all on the project-scope `mcp.json` moves of
`features/mcp-server/legacy-move.feature` and `features/mcp-server/verdict-list.feature`. Four files
had no switch: `features/hook/session-end.feature`, `features/mcp-server/lifecycle.feature`,
`features/plugin/package-dependencies.feature`, and `features/plugin/session-start-hooks.feature`.

## Switch rules

- W1, the line swap. `Given the user has started a new pi session` becomes
  `Given the user has reloaded pi`. `Given the user has started a new pi session, which warned`
  becomes `Given the user has reloaded pi, which warned`. `When the user starts a new pi session`
  becomes `When the user reloads pi`. The indentation stays. The forms that end in
  `with the hooks recording` or `in another project` never switch.
- W2, the double bind: the one change of expected rows that this plan allows. The old `When`
  reported two loads, because RPC `new_session` binds the extension twice. A reload reports one
  (F2, F3). Some tables state what a switched `When` produced, in order:
  `the session reports these results:`, the `the results list these marketplaces and plugins:`
  table that follows it, and a request log, each before the next `When`. Such a table must equal a
  prefix of its rows at the tracer commit: the first load's rows. The rows that go are the second
  load's, and the outcome that a user sees, one load's report, stays the same. Before the first run,
  halve each such session table whose rows are an exact repeat (rows 1 to k equal rows k+1 to 2k),
  and halve the rows table after it when it repeats the same way. After the run, set a failing
  table of this kind to the rows that the run reports, when those rows are a prefix of the old
  ones. Every other step and every other table stays as it was.
- W3, rewording. A scenario that has a switched use, has no kept use of its own, and has a title
  that names a new session gets a new title. Change only the words that name the session event.
  Keep every other word and every ID, use ASCII only (the dash and quote fixer hooks rewrite feature
  files), and keep the title unique in its file. "A new session" as a subject becomes "A reload",
  "Every new session" becomes "Every reload", "in a new session" and "of a new session" become
  "after a reload", "from a new session" becomes "at the next reload", "until a new session"
  becomes "until a reload", and "new sessions" becomes "reloads". When a mapping reads badly, use
  the shortest wording that names the reload. A feature description sentence that names a new
  session as the way the file's switched scenarios load what changed is reworded the same way. When
  the file keeps new-session uses that the sentence also describes, name both. A comment under
  `features/lib`, `features/step_definitions`, or `features/support` that names a new session as
  the way a switched scenario loads what changed is reworded too. Edit only files in
  `files_modified`; a stale comment elsewhere goes under "For the orchestrator". Record every
  rewording in `$D/rewordings.tsv` with the columns `file`, `line`, `old`, and `new`.
- W4, revert and report. A switched scenario that fails for any other reason gets its lines back
  from the tracer commit: the step, the title, and the tables. Its row's category becomes
  `keep:switch-changed-outcome`, with this reason: the failing step, expected against actual in one
  line, and the profile. Flag the row `possible product bug` when the reload shows less than the
  new session did for what the scenario installed, enabled, updated, or removed (a skill, a command,
  an agent, a workflow, a hook run, an MCP tool, or a load report), because decision 2's reload
  must make those visible. Never edit product code.
- W5, step definitions. The commit that first uses `Given the user has reloaded pi, which warned`
  adds that step. The commit that removes the last use of a new-session step deletes its
  definition. `check:features` fails on an unused step.

## Execution rules

- `$S` is `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad`.
  This plan's own folder is `$D` = `$S/quick-261123-qrv`. Create it, and never write to another
  folder of `$S`.
- Run every command from the root of this plan's own checkout (`git rev-parse --show-toplevel`).
  Every repository path in this plan is relative to that root. Never read, write, or run tests in
  another checkout.
- Put this prefix before every npm script:
  `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.
- Cucumber needs `fd`: put `$S/gate-bin` first on `PATH` for every cucumber run, dry runs included.
  Run every cucumber run except a dry run, the ESLint warm-up, every `check:static`, and every
  commit under `flock -w 3600 "$S/phase07-heavy.lock"`.
- A targeted run of at most ten scenario locations passes `--parallel 2` right after
  `--profile <name>`. A whole-profile run and `npm run test:cucumber` keep the worker count that
  `scripts/cucumber.mjs` picks.
- A command that can outlast the tool's foreground limit runs with the tool's background option.
  These include a whole-profile run (adapter about 14 minutes, builtin about 3), `npm run test:cucumber`
  (about 17 minutes), `check:static`, a commit, and any run that waits for the lock. Wait for its
  completion notification, and never poll with `sleep`.
- Decide a run by its exit status and the log it wrote, never by piping the check into `tail`,
  `head`, or `grep`. The summary reporter lists each failed scenario with `# <file>:<line>`, then
  its failing step and the assertion. A run whose only failures are cucumber step timeouts is
  evidence of nothing: rerun it, and keep the rerun's log.
- Warm ESLint with one lone `npm run lint` under the lock before the first `check:static`.
- The shell guard may refuse a one-line command that calls `git` inside `$(...)`. If it refuses a
  command of this plan, write the command verbatim into a script under `$D` and run it with `bash`.
- Stage by explicit path only; never `git add -A`, `git add .`, or `git commit -a`. Commit with
  `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144 git commit -F <message file>`, and let the whole hook run
  (`npm run check:commit`).
- Do not run the pre-commit tool by hand with a skip list, and never set `SKIP` for a hook; the
  session's exported `SKIP=trufflehog` stays as it is. When a fixer hook changes a file, the commit
  fails: restage the file and commit again.
- Never use `--no-verify`, `--amend`, a rebase, `git stash`, a push, or a commit on `main`.
- Inside a worktree the hook may check nothing, so run `check:static` on a tree before you commit
  it. Task 3's three area commits split one verified tree, so one run before the first of them is
  enough, and the final gate checks the last commit.
- Commit messages follow `.agents/skills/committing/SKILL.md`: a Conventional Commits title of 5 to
  72 characters, with no quick id, batch id, decision number, milestone, phase, plan, wave, or task
  in the title or the scope. Body lines have at most 80 characters, and the attribution lines of
  your session's instructions come at the end. Right after each commit, write `git rev-parse HEAD`
  to the commit file that the task names.
- Edit only the files in `files_modified`. Never edit `extensions/**`, `test/**`, `scripts/**`,
  `cucumber.json`, `package.json`, `package-lock.json`, `.fallowrc.json`, `eslint.config.js`, a CI
  workflow, `CHANGELOG.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, or `.planning/BACKLOG.md`.
- Add no suppression marker (`fallow-ignore`, `eslint-disable`) and no config entry. If
  `fallow dupes` reports a clone group in the harness code that this plan adds, move the shared
  lines into one private helper in the same module.
- Comments follow `.agents/skills/typescript-style/rules/comments.md`: load the `simple-english`
  skill in Plain mode and the `humanizer` skill, and apply both to every comment you add or change.
  If the merged sibling recorded decision IDs for the headless-reload decisions (in its SUMMARY or
  in `.planning/PROJECT.md`), cite the ID of decision 5 where a comment needs an anchor. Otherwise
  cite none, and say the reason in plain words.
- A scenario that this plan did not change and that fails gets one lone rerun under its profile. If
  it fails again, follow the leak protocol of Task 3, step 7.

<tasks>

<task type="tracer">
  <name>Task 1: Reload pi over RPC end to end on four scenarios, in one commit</name>
  <precondition>Sibling 261123-qru is merged into this checkout: `grep -rln acceptsLaterCommands extensions/pi-claude-marketplace` lists at least one file (it lists none at 98ada0c), and a file `.planning/quick/261123-qru-*/261123-qru-SUMMARY.md` exists. `$S/nondac-sh` is executable, `$S/gate-bin/fd` exists, `flock` is on PATH, and `node_modules/.package-lock.json` exists in this checkout.</precondition>
  <reversibility rating="reversible">Test-harness only: a new driver function, two new steps, comments, docs, and four scenarios. Reverting the commit restores the old steps, and no stored format or product code changes.</reversibility>
  <files>features/lib/pi-commands.ts, features/step_definitions/session.steps.ts, features/support/world.ts, features/step_definitions/command.steps.ts, features/lib/result-rows.ts, .agents/skills/cucumber/rules/world-and-stand-ins.md, features/plugin/reconcile.feature, features/mcp-server/legacy-move.feature, features/hook/tool-use.feature</files>
  <action>
    1. Create `$D`. Write `git rev-parse HEAD` to `$D/base-commit`. Run the two dry runs with
       `$S/gate-bin` first on PATH: `npx --no -- cucumber-js --profile adapter --dry-run` into
       `$D/dry-run-adapter-base.log`, and the same for `--profile builtin` into
       `$D/dry-run-builtin-base.log`. Then write the lines of both logs that match
       `^[0-9]+ (scenarios|steps) `, adapter first, to `$D/dry-run-base.txt`, with `grep -h`.
       At 98ada0c the totals were adapter 2288 scenarios and 28722 steps, builtin 260 and 3576;
       the sibling adds its own.

    2. Check the reload contract. Read the merged sibling's SUMMARY, the handler of its `reload`
       subcommand (the router entry `reload` in `extensions/pi-claude-marketplace/edge/router.ts`,
       and the files that `grep -rln acceptsLaterCommands extensions/pi-claude-marketplace` lists),
       and its own reload scenario. Write the contract that you find to `$D/reload-contract.txt`:
       the response, whether the handler appends its own payload on success and where, and whether
       it awaits `ctx.reload()` before it returns. Apply "The reload contract" section of this plan,
       including its fallback and its stop rule. Grep `features/` for `claude:plugin reload` and for
       step texts that name a reload, other than the terminal ones (`... reloads pi in the
       terminal ...` and the stop-limit step `... reloads pi, and prompts ...`). If the sibling already
       registered an RPC reload step with this meaning, never register a second text for it (one
       meaning per step):
       - Use the sibling's step text for every switch in this plan.
       - Add only what is missing, such as the `Given` form, in
         `features/step_definitions/session.steps.ts`.
       - Build or reuse the driver in `features/lib/pi-commands.ts`, and never edit a file outside
         `files_modified`.
       Record the mapping from this plan's names (`reloadSession`, `the user reloads pi`,
       `the user has reloaded pi`) to the names in use in `$D/reload-contract.txt`. The verify
       commands of all three tasks then use the mapped names, and the SUMMARY states the mapping.

    3. In `features/lib/pi-commands.ts`:
       a. Reword the overview. The module runs `/claude:plugin` commands, reloads, and new sessions
          in the run's headless Pi, and a command, a reload, or a new session returns every payload
          it emits. Reword the docs of `OfferedSkill` and `SessionReport` to name a session after
          it starts or reloads.
       b. Add the module constant `RELOAD_COMMAND` with the value `/claude:plugin reload`. Its
          comment gives the reason for the subcommand: Pi's own `/reload` runs only in the terminal
          UI, and RPC has no reload request (F1).
       c. Move the `get_commands` part of `readSession` into a private
          `async function offeredSkills(pi: PiProcess): Promise<readonly OfferedSkill[]>`, and make
          `readSession` call it.
       d. Add `export async function reloadSession(pi: PiProcess): Promise<SessionReport>`. It
          counts the session's custom entries through `readCustomEntries` and sends
          `pi.request({ type: "prompt", message: RELOAD_COMMAND })`. Then it runs `assertQuiet` on
          the exchange and asserts that `response.data` deep-equals `{ disposition: "handled" }`,
          with the command as the assertion message. It reads the custom entries again, passes the
          ones after the count through `claudePluginPayloads` (DRV-01), and returns
          `{ skills: await offeredSkills(pi), payloads }`. Its doc comment states F2, F4, F5, F6,
          and F8 in plain words. It names the Pi files (`agent-session.js`, `rpc-mode.js`,
          `resource-loader.js`) but no line numbers, because those change with each Pi release:
          - Pi answers after the reload has finished.
          - A reload keeps the session, the conversation, the id, and the entries before the
            command, so the driver reads only the entries after the command.
          - A reload binds the extension once, so a lasting failure appears once.
          - A reload runs no SessionStart and no SessionEnd hook (D-CF5-03).
          - A reload decides no project trust, so `PiProcess` does not count it as a runtime
            request.
          If `$D/reload-contract.txt` records an own payload, put the fallback here.
       e. Rewrite the doc comment above `startSession` (lines 159-163 at 98ada0c). Drop the
          sentence that says a new session makes installed plugins visible the way Pi's reload
          command does. State what a new session does that a reload does not (F3, F4, F5): it ends
          the old session, which runs SessionEnd, then runs SessionStart with source `clear`; it
          empties the conversation; it gets a new id; it loads with reason `startup`. Say that a
          step that only needs Pi to load what changed uses `reloadSession`. Keep the double-bind
          comment inside the function.

    4. In `features/step_definitions/session.steps.ts`:
       a. Extend the overview. A reload's payloads become the last results, as a new session's
          do. Pi's own `/reload` runs only in the terminal, so an RPC scenario reloads through
          `/claude:plugin reload`.
       b. Import `reloadSession`. Add two private helpers, `assertAllInfo(payloads)` and
          `assertAllWarnings(payloads)`, that hold the two existing severity checks (the second
          one also requires a non-empty list). Make the two new-session `Given` steps call them.
       c. After the new-session Givens, register `Given("the user has reloaded pi", ...)`: it
          calls `reloadSession(this.pi)` and `assertAllInfo`. After
          `When("the user starts a new pi session", ...)`, register
          `When("the user reloads pi", ...)`: it calls `keepSession(this, await reloadSession(this.pi))`.
          Both are `function` expressions with a typed `this`, and neither has a timeout above the
          default. If a tracer reload takes more than 10 seconds, the steps instead take a named
          timeout constant with a comment that says why (`world-and-stand-ins.md`), and the
          SUMMARY records the time. Do not add the `, which warned` reload form here; Task 3 adds it
          if a switched use needs it.
       d. Above the new-session `When`, add a comment. A new session is not a reload: it runs
          SessionEnd and SessionStart `clear`, empties the conversation, gets a new id, loads with
          reason `startup`, and binds twice over RPC. A scenario starts a new session only to test
          one of those, and reloads otherwise. Extend the D-02 comment above
          `the session reports these results:` so that it covers a reload, which reports one load.

    5. Update three more comments:
       - `features/support/world.ts`: the comment on `resultsSource` names a new session or a
         reload as a session source. The doc of `sessionSkills()` names the last new session or
         reload, and its error text becomes `no new session or reload has run in this scenario`.
       - `features/step_definitions/command.steps.ts`: the overview line becomes "a command, a new
         session, or a reload". The last sentence of the D-02 comment says that the results of a
         new session or a reload have a step of their own.
       - `features/lib/result-rows.ts`: the overview line becomes "the results of a command, a new
         session, or a reload".

    6. In `.agents/skills/cucumber/rules/world-and-stand-ins.md`, in Plain mode, in the file's own
       style:
       - The session-driver bullet (line 27) gains the reload driver. `reloadSession()` in
         `features/lib/pi-commands.ts` sends `/claude:plugin reload` as a prompt, because Pi's own
         `/reload` runs only in the terminal. Pi answers after the reload has finished. The driver
         reads and validates the entries that the reload appended after the command (DRV-01), and
         returns them in session order with the skills offered after the reload. A reload binds the
         extension once, so a lasting failure appears once.
       - The new-session `When` bullet (line 31) gains `When the user reloads pi` and
         `Given the user has reloaded pi`, which keep the reload's payloads as session results. It
         also gains the choice rule. A scenario reloads Pi when it only needs Pi to load what
         changed: installed, changed, or removed plugins, or the load report. It starts a new
         session only to test one: SessionStart `clear` and SessionEnd runs, an empty
         conversation, a new session id or file, or the MCP connections of a new session.
       - The trust bullet (line 62) gains this fact: a reload decides no trust and keeps the trust
         of the runtime it reloads, so `PiProcess` does not record it.

    7. Make the tracer edits. The lines are those at 98ada0c. If the sibling moved them, find the
       scenarios by title and the lines by their text, use the new lines in the verify runs, and
       record them in `$D/tracer-lines.txt`.
       - `features/plugin/reconcile.feature`: line 13 becomes
         `  Scenario: A reload after a hand edit of the config prints the pending block and changes nothing`.
         Line 18 becomes `    When the user reloads pi`. Delete the two lines that were 22
         and 26 at 98ada0c: the second `Reconcile pending` row of the session table, and the
         second `demo@fixtures ... will install` row of the rows table (W2). After the deletions,
         line 22 is `    Then the results list these marketplaces and plugins:`, and line 25
         is `    Then the project scope has no installed plugins`.
       - `features/mcp-server/legacy-move.feature`: lines 21 and 150 become
         `    When the user reloads pi`, and line 149 becomes `    Given the user has reloaded pi`.
       - `features/hook/tool-use.feature`: line 276 becomes `    Given the user has reloaded pi`.

    8. Run the tracer: the four scenarios under the adapter profile, and the two `@mcp` legacy-move
       scenarios under the builtin profile (the verify commands). Fix a failure that the driver
       code of this task causes, here. If a tracer scenario fails for another reason, stop and
       report it with the log and `$D/reload-contract.txt`, for the orchestrator: the contract
       differs, the reload reports both binds, or a companion fails on a reload.

    9. Warm ESLint, run `check:static`, then commit the nine files with a message file
       `$D/tracer-message.txt`. Its title is
       `test(features): reload pi over rpc with /claude:plugin reload`. Its body says:
       - RPC scenarios can now reload Pi through the extension's reload subcommand, because Pi's
         own `/reload` runs only in the terminal.
       - The `startSession` comment now says how a new session differs from a reload.
       - Four scenarios switch, and the reconcile scenario lists one load's pending block.
       Write the commit to `$D/tracer-commit`.
  </action>
  <verify>
    <automated>f=features/lib/pi-commands.ts; test "$(grep -c '^export async function reloadSession(pi: PiProcess): Promise<SessionReport> {$' "$f")" -ge 1 && test "$(grep -cF 'const RELOAD_COMMAND = "/claude:plugin reload";' "$f")" -ge 1 && test "$(grep -cF 'message: RELOAD_COMMAND' "$f")" -ge 1 && test "$(grep -c 'reloadSession' "$f")" -ge 2 && test "$(grep -c 'async function offeredSkills(pi: PiProcess)' "$f")" -ge 1 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the driver, its command constant, or its request is missing; the `startSession` comment does not name `reloadSession`; or the skills read was not shared through `offeredSkills` (a second definition of any of them fails the typecheck of `check:static`)</fails_when>
    <automated>test "$(grep -cF 'as `/reload` does' features/lib/pi-commands.ts)" -eq 0 # [HEAD=1 EXPECT==0 @98ada0c]</automated>
    <fails_when>non-zero exit: the old claim that a new session works like Pi's reload is still in the `startSession` comment</fails_when>
    <automated>f=features/step_definitions/session.steps.ts; test "$(grep -cF '"the user reloads pi"' "$f")" -ge 1 && test "$(grep -cF '"the user has reloaded pi"' "$f")" -ge 1 && test "$(grep -cF 'reloadSession(this.pi)' "$f")" -ge 2 && grep -qF 'no new session or reload has run in this scenario' features/support/world.ts && grep -qF 'a command, a new session, or a reload' features/step_definitions/command.steps.ts && grep -qF 'a command, a new session, or a reload' features/lib/result-rows.ts && w=.agents/skills/cucumber/rules/world-and-stand-ins.md && test "$(grep -cF '`When the user reloads pi`' "$w")" -ge 1 && test "$(grep -cF '/claude:plugin reload' "$w")" -ge 1 && test "$(grep -cF 'reloadSession()' "$w")" -ge 1 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a reload step is missing, a step does not call the driver, or a comment or the skill doc does not name the reload (a step registered twice is ambiguous and fails `check:features`)</fails_when>
    <automated>test "$(grep -n '^    When the user reloads pi$' features/plugin/reconcile.feature | cut -d: -f1 | tr '\n' ' ')" = "18 " && test "$(grep -n '^  Scenario: A reload after a hand edit of the config prints the pending block and changes nothing$' features/plugin/reconcile.feature | cut -d: -f1 | tr '\n' ' ')" = "13 " && test "$(sed -n '22p' features/plugin/reconcile.feature)" = "    Then the results list these marketplaces and plugins:" && test "$(sed -n '25p' features/plugin/reconcile.feature)" = "    Then the project scope has no installed plugins" && test "$(grep -n '^    When the user reloads pi$' features/mcp-server/legacy-move.feature | cut -d: -f1 | tr '\n' ' ')" = "21 150 " && test "$(grep -n '^    Given the user has reloaded pi$' features/mcp-server/legacy-move.feature | cut -d: -f1 | tr '\n' ' ')" = "149 " && test "$(grep -n '^    Given the user has reloaded pi$' features/hook/tool-use.feature | cut -d: -f1 | tr '\n' ' ')" = "276 " # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a tracer line was not switched, was switched at another line, or the reconcile title or its two one-load tables are wrong. If the sibling moved the tracer lines, compare with the lines of `$D/tracer-lines.txt` instead.</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/reconcile.feature:13 features/mcp-server/legacy-move.feature:12 features/mcp-server/legacy-move.feature:140 features/hook/tool-use.feature:265 > "$D/tracer-adapter.log" 2>&1; s=$?; echo "exit=$s" >> "$D/tracer-adapter.log"; test "$s" -eq 0 && grep -qx '4 scenarios (4 passed)' "$D/tracer-adapter.log" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a tracer scenario failed under the adapter profile (at 98ada0c the reload steps are undefined): the driver, the contract, or the one-load rows are wrong, and step 8 says which to fix and which to report</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile builtin --parallel 2 features/mcp-server/legacy-move.feature:12 features/mcp-server/legacy-move.feature:140 > "$D/tracer-builtin.log" 2>&1; s=$?; echo "exit=$s" >> "$D/tracer-builtin.log"; test "$s" -eq 0 && grep -qx '2 scenarios (2 passed)' "$D/tracer-builtin.log" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a reload fails under Pi's built-in MCP</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent check:static > "$D/tracer-static.log" 2>&1; s=$?; echo "exit=$s" >> "$D/tracer-static.log"; test "$s" -eq 0</automated>
    <fails_when>non-zero exit: typecheck, lint, fallow, Prettier, pairing, or `check:features` (an unused, undefined, or ambiguous step) failed</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; A=$(cat "$D/tracer-commit") && test -n "$A" && test "$(git show -s --format=%s "$A")" = "test(features): reload pi over rpc with /claude:plugin reload" && git show --name-only --format= "$A" > "$D/tracer-files-raw.txt" && LC_ALL=C sort "$D/tracer-files-raw.txt" > "$D/tracer-files.txt" && printf '%s\n' .agents/skills/cucumber/rules/world-and-stand-ins.md features/hook/tool-use.feature features/lib/pi-commands.ts features/lib/result-rows.ts features/mcp-server/legacy-move.feature features/plugin/reconcile.feature features/step_definitions/command.steps.ts features/step_definitions/session.steps.ts features/support/world.ts | diff - "$D/tracer-files.txt" && test -s "$D/dry-run-base.txt" && test -s "$D/reload-contract.txt" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the commit file is missing, the title differs, the commit holds another set of files, or the dry-run totals or the contract record are missing</fails_when>
  </verify>
  <done>Over RPC, `When the user reloads pi` and `Given the user has reloaded pi` send `/claude:plugin reload` and keep only the reload's payloads and the offered skills. The `startSession` comment states how a new session differs. The skill doc says when to reload and when to start a new session. The four tracer scenarios pass: three under the adapter profile, the two `@mcp` ones under both profiles. The reconcile scenario lists one load's pending block. `check:static` passes, and `$D/tracer-commit` names the one commit.</done>
</task>

<task type="auto">
  <name>Task 2: Classify every new-session use and every library caller in the audit table</name>
  <precondition>`$D/tracer-commit` exists and equals `git rev-parse HEAD`, and `git status --porcelain -- features .agents` prints nothing.</precondition>
  <files>none in the repository; scratch only: $D/audit-uses.mjs, $D/new-session-audit.tsv, $D/audit-counts.tsv, $D/turn-misses.tsv, $D/mcp-misses.tsv</files>
  <action>
    1. Write `$D/audit-uses.mjs`, a Node script with no dependency that takes the checkout root as
       its one argument. It walks `features/**/*.feature` in sorted path order and parses each file
       into its Background and its scenarios. Scenarios and Scenario Outlines both count,
       including those inside a `Rule`. For each block the script keeps the title, the line, the
       tags, each step (keyword, text, line, data-table rows, and doc-string lines), and the
       Examples rows. It applies "Audit rules" exactly: the rows, the signals and flags with their
       evidence, the category precedence, the Background rule, and the reasons. It writes the table
       to stdout, sorted by file and then line. It writes the two review lists to the paths it is
       given, and it fails on a step that names `new pi session` in a form outside the five.

    2. Run it into `$D/new-session-audit.tsv`. Add the five library rows with the categories and
       reasons of "Audit rules". Find each call's line at `HEAD` with `grep -n 'startSession('`.

    3. Decide each row of `$D/turn-misses.tsv` and `$D/mcp-misses.tsv` by reading the step. A
       settings step such as `pi keeps only one recent token when the hooks session compacts` is
       `not a turn`. A step that adds a model turn or a session action is a `turn`. A step that reads
       a live MCP server, tool, or registration is `live`, and a step that reads a file or a payload
       is `not live`. When a decision is `turn` or `live`, add its text to the script's pattern,
       run steps 1 and 2 again, and keep the decision column.

    4. Self-check the rules. Each of the five tracer uses (reconcile line 18; legacy-move lines 21,
       149, and 150; tool-use line 276) must come out `switch:reload-stand-in`, and so must every
       other reload-form row. If one does not, a rule misreads a step: fix the script, not the
       table, and run it again.

    5. Read the reason of every keep row and of every switch row that carries a flag. When a signal
       misreads a step, fix the script and run it again. Then write `$D/audit-counts.tsv` with the
       header `category`, `count`, `files`, `file list`, one row per category. `file list` is each
       file with its row count, such as `features/hook/tool-use.feature (57)`, separated by `; `.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; t="$D/new-session-audit.tsv"; test -s "$t" && test "$(head -1 "$t")" = "$(printf 'file\tline\tstep\tscenario\tscenario line\tpi\tsignals\tcategory\treason\toutcome')" && n=$(grep -rhE '^\s*(Given the user has started a new pi session(, which warned)?|When the user starts a new pi session( with the hooks recording| in another project)?|Given the user has reloaded pi(, which warned)?|When the user reloads pi)$' features --include='*.feature' | wc -l) && test "$(awk -F'\t' 'NR>1 && $1 ~ /\.feature$/' "$t" | wc -l)" -eq "$n" && test "$(awk -F'\t' 'NR>1 && $1 ~ /\.ts$/' "$t" | wc -l)" -eq 5 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the table is missing, its header differs, it lacks a use or holds one twice, or it does not hold the five library rows. The tree's count `n` was 639 at 98ada0c; it differs only when the sibling added uses.</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; t="$D/new-session-audit.tsv"; awk -F'\t' 'NR>1 && (NF != 10 || $8 !~ /^(switch:reload-stand-in|keep:(session-hooks|empty-conversation|saved-session|live-mcp|another-project|shared-pi-reset|names-new-session))$/ || $9 == "" || $10 != "-") {bad++} END {exit bad > 0}' "$t" && awk -F'\t' 'NR>1 && $1 ~ /\.feature$/ {print $1"\t"$2"\t"$3}' "$t" | while IFS="$(printf '\t')" read -r f l s; do test "$(sed -n "${l}p" "$f" | sed 's/^ *//')" = "$s" || { echo "stale row $f:$l"; exit 1; }; done # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a row has another column count, a category outside the closed set, an empty reason, or an outcome other than `-`; or a row's file and line do not hold its step text at HEAD</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; t="$D/new-session-audit.tsv"; awk -F'\t' 'NR>1 && $1 ~ /\.ts$/ {print $1" "$8}' "$t" | LC_ALL=C sort > "$D/library-rows.txt" && printf '%s\n' 'features/lib/real-subagent-child.ts keep:session-hooks' 'features/lib/subagent-hook-session.ts keep:names-new-session' 'features/step_definitions/hook/session.steps.ts keep:session-hooks' 'features/step_definitions/plugin/subagent-hooks.steps.ts keep:empty-conversation' 'features/support/pi-process.ts keep:shared-pi-reset' | diff - "$D/library-rows.txt" && awk -F'\t' 'NR>1 && $1 ~ /\.ts$/ {print $1"\t"$2}' "$t" | while IFS="$(printf '\t')" read -r f l; do sed -n "${l}p" "$f" | grep -q 'startSession(' || exit 1; done && test "$(awk -F'\t' 'NR>1 && ($3=="When the user reloads pi" || $3=="Given the user has reloaded pi") && $8!="switch:reload-stand-in"' "$t" | wc -l)" -eq 0 && test "$(awk -F'\t' 'NR>1 && (($1=="features/plugin/reconcile.feature" && $2==18) || ($1=="features/mcp-server/legacy-move.feature" && ($2==21 || $2==149 || $2==150)) || ($1=="features/hook/tool-use.feature" && $2==276)) && $8=="switch:reload-stand-in"' "$t" | wc -l)" -eq 5 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a library row is missing or has another category, a library line does not hold its call, or a reload-form row (a tracer use among them) is not a switch. If the sibling moved the tracer lines, use the lines of `$D/tracer-lines.txt` in this check.</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; t="$D/new-session-audit.tsv"; c="$D/audit-counts.tsv"; test -s "$c" && test "$(head -1 "$c")" = "$(printf 'category\tcount\tfiles\tfile list')" && test "$(awk -F'\t' 'NR>1 {s+=$2} END {print s+0}' "$c")" -eq "$(tail -n +2 "$t" | wc -l)" && for m in "$D/turn-misses.tsv" "$D/mcp-misses.tsv"; do test -f "$m" || exit 1; test "$(head -1 "$m")" = "$(printf 'count\ttext\tdecision')" || exit 1; awk -F'\t' 'NR>1 && (NF != 3 || $3 !~ /^(turn|not a turn|live|not live)$/) {bad++} END {exit bad > 0}' "$m" || exit 1; done # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the counts file is missing, has another header, or does not sum to the table's rows; or a review list is missing or holds an undecided row</fails_when>
  </verify>
  <done>`$D/new-session-audit.tsv` holds one row per use (639 at 98ada0c, 5 of them already switched by the tracer) and the five library rows. Each row has a category from the closed set and a reason with evidence, assigned by the script's rules and never by hand, except the library rows. The review lists are decided, the tracer self-check holds, and `$D/audit-counts.tsv` gives each category's count and files.</done>
</task>

<task type="auto">
  <name>Task 3: Switch the reload stand-ins, prove both profiles green, and commit by feature area</name>
  <precondition>Task 2's four verify commands pass on this checkout, and `git rev-parse HEAD` equals `$D/tracer-commit`.</precondition>
  <files>the 92 `features/**/*.feature` paths listed in files_modified, features/step_definitions/session.steps.ts, features/step_definitions/workflow/companion-missing.steps.ts, features/step_definitions/workflow/listing.steps.ts, features/lib/path-marketplace.ts, .planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-SUMMARY.md</files>
  <action>
    1. Write `$D/apply-switch.mjs`. For each `switch:reload-stand-in` feature row whose line still
       holds a new-session form, it checks that the line holds the row's step text, replaces it by
       W1, and keeps the indentation. A tracer row is already switched and is skipped. Then it
       pre-trims by W2: for each switched `When`, it halves an exact-repeat session table and the
       rows table after it. The swaps keep the line count, so the script makes all of them first,
       then makes the trims from the bottom of each file up, and the table's line numbers stay
       valid while it runs. It logs every change to `$D/switch-log.tsv` with the columns `file`,
       `line`, and `change`, and it fails on a line that holds neither the expected old text nor
       the new one. Run it.

    2. Reword by W3: titles, feature descriptions, and the comments that
       `grep -rn "new session" features/lib features/step_definitions features/support` shows.
       `features/step_definitions/workflow/companion-missing.steps.ts` (header and line 40),
       `features/step_definitions/workflow/listing.steps.ts` (line 3), and
       `features/lib/path-marketplace.ts` (line 6) are the known candidates. Record every rewording
       in `$D/rewordings.tsv`.

    3. Apply W5. If a switched use has the `, which warned` form, add
       `Given("the user has reloaded pi, which warned", ...)` in
       `features/step_definitions/session.steps.ts` with `reloadSession` and `assertAllWarnings`.
       Delete a new-session step definition that has no use left.

    4. Run the whole adapter profile into `$D/switch-adapter.log` and the whole builtin profile into
       `$D/switch-builtin.log`, with
       `npm run --silent test:cucumber:profile -- --profile <name> features` under the lock.

    5. Triage each failed scenario from the logs, in this order:
       a. Only cucumber step timeouts: rerun the scenario alone, and keep the rerun's log.
       b. The failing step is a W2 table, and the reported rows are a prefix of its rows at the
          tracer commit (`git show "$(cat $D/tracer-commit)":<file>`): set the table to that
          prefix, and mark the row `outcome` as
          `switched; one load's rows (double bind): <old count> -> <new count>`.
       c. Anything else: revert by W4 and report.
       If more than 20 switched scenarios fail for reasons other than a and b, do not revert
       them. Stop and report the shared cause with three sample logs, because a cause that many
       scenarios share, such as a companion that does not survive a reload, is the orchestrator's
       call.

    6. Rerun each fixed or reverted scenario by its `file:line` under every profile that runs it,
       until each one passes. Keep the logs as `$D/fix-<n>-<profile>.log`.

    7. Leak protocol, for a scenario that this plan did not change and that fails twice, or for a
       `Before` hook that fails:
       a. Rerun the whole profile once.
       b. If it fails again, run that profile on the switched files of one area at a time (plugin
          and marketplace; hook; the component directories) to find the area whose reloads leave
          state for the next reset.
       c. In that area, revert the switched uses whose `pi` is `shared`, one file at a time,
          until the area passes. Record each by W4 with the reason
          `the reload left state that the next scenario's reset found: <message>`.
       d. If no area reproduces the failure, stop and report it with the logs.

    8. Fill the `outcome` column of every row. A switched row reads `switched`, or the W2 text, or
       `switched; title reworded`, or both. A reverted row reads `reverted: <reason>`. Every other
       row reads `kept`. Rewrite `$D/audit-counts.tsv` with the final categories.

    9. Run `check:static` on the whole switched tree, then commit by area. Each title has its own
       commit file:
       - Plugin and marketplace: the files under `features/plugin/` and `features/marketplace/`,
         plus `features/lib/path-marketplace.ts` if step 2 changed it. Title
         `test(features): reload pi in the plugin and marketplace scenarios`, commit file
         `$D/lifecycle-commit`.
       - Hooks: the files under `features/hook/`. Title
         `test(features): reload pi in the hook scenarios`, commit file `$D/hooks-commit`.
       - Components: the files under `features/skill/`, `features/slash-command/`,
         `features/agent/`, `features/workflow/`, and `features/mcp-server/`, plus the step
         modules that steps 2 and 3 changed. Title
         `test(features): reload pi in the component scenarios`, commit file
         `$D/components-commit`.
       Each body says:
       - The scenarios that only need Pi to load what changed now reload Pi over RPC.
       - The scenarios that test a new session keep it.
       - Session tables list one load's rows, because a reload binds the extension once.
       - Titles that named a new session now name the reload.
       If `check:features` fails on a commit because a step's only uses are in a later area,
       stage those files in the same commit and say so in the SUMMARY.

    10. Run the final gates on the last commit: the dry-run comparison, `check:static`, and
        `npm run test:cucumber`, which runs the adapter profile and then the builtin profile. Then
        write the SUMMARY, as `<output>` says.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; t="$D/new-session-audit.tsv"; sw=$(awk -F'\t' 'NR>1 && $1 ~ /\.feature$/ && $8=="switch:reload-stand-in"' "$t" | wc -l); kp=$(awk -F'\t' 'NR>1 && $1 ~ /\.feature$/ && $8!="switch:reload-stand-in"' "$t" | wc -l); r=$(grep -rhE '^\s*(Given the user has reloaded pi(, which warned)?|When the user reloads pi)$' features --include='*.feature' | wc -l); n=$(grep -rhE '^\s*(Given the user has started a new pi session(, which warned)?|When the user starts a new pi session( with the hooks recording| in another project)?)$' features --include='*.feature' | wc -l); test "$sw" -gt 0 && test "$r" -eq "$sw" && test "$n" -eq "$kp" && test "$(awk -F'\t' 'NR>1 && $10=="-"' "$t" | wc -l)" -eq 0 && test "$(awk -F'\t' 'NR>1 && $8=="switch:reload-stand-in" && $3 ~ /(with the hooks recording|in another project)$/' "$t" | wc -l)" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the tree's reload lines (0 at 98ada0c) do not equal the table's switch rows, its new-session lines (639 at 98ada0c) do not equal its keep feature rows, a row has no outcome, or a form that never switches was switched</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; PATH="$S/gate-bin:$PATH" npx --no -- cucumber-js --profile adapter --dry-run > "$D/dry-run-adapter-end.log" 2>&1 && PATH="$S/gate-bin:$PATH" npx --no -- cucumber-js --profile builtin --dry-run > "$D/dry-run-builtin-end.log" 2>&1 && grep -hE '^[0-9]+ (scenarios|steps) ' "$D/dry-run-adapter-end.log" "$D/dry-run-builtin-end.log" > "$D/dry-run-end.txt" && diff "$D/dry-run-base.txt" "$D/dry-run-end.txt" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a scenario or a step was added or lost, against the totals of `$D/dry-run-base.txt` (adapter 2288 scenarios and 28722 steps, builtin 260 and 3576 at 98ada0c, before the sibling). A swap replaces one step line with one step line, and a trim removes only table rows.</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent check:static > "$D/final-static.log" 2>&1; s=$?; echo "exit=$s" >> "$D/final-static.log"; test "$s" -eq 0</automated>
    <fails_when>non-zero exit: `check:features` reports an unused, undefined, or ambiguous step, or another static check failed</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber > "$D/final-cucumber.log" 2>&1; s=$?; echo "exit=$s" >> "$D/final-cucumber.log"; test "$s" -eq 0 && test "$(grep -Ec '^([0-9]+) scenarios \(\1 passed\)$' "$D/final-cucumber.log")" -ge 2 && test "$(grep -Ec 'scenarios? \(.*(failed|undefined|ambiguous|pending|skipped)' "$D/final-cucumber.log")" -eq 0 && ! grep -q 'timed out' "$D/final-cucumber.log" # [HEAD=present EXPECT==present @98ada0c GUARD MUTATION: a switched use whose scenario needs a new session, such as a SessionStart clear run]</automated>
    <fails_when>non-zero exit: a scenario failed, was undefined, ambiguous, pending, or skipped, or a step timed out, under the adapter or the builtin profile</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; P=.planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-PLAN.md; sed -n '/^files_modified:/,/^autonomous:/p' "$P" | sed -n 's/^  - //p' > "$D/allowed-files.txt" && B=$(cat "$D/base-commit") && git diff --name-only "$B" HEAD > "$D/changed-files.txt" && test -s "$D/changed-files.txt" && test "$(grep -cvxF -f "$D/allowed-files.txt" "$D/changed-files.txt")" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a file outside `files_modified` changed since `$D/base-commit`, such as product code, a unit test, a script, or a config</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qrv; for k in lifecycle hooks components; do test -s "$D/$k-commit" || exit 1; git show --name-only --format= "$(cat "$D/$k-commit")" > "$D/$k-files.txt" || exit 1; test -s "$D/$k-files.txt" || exit 1; done; test "$(git show -s --format=%s "$(cat "$D/lifecycle-commit")")" = "test(features): reload pi in the plugin and marketplace scenarios" && test "$(grep -cvE '^features/(plugin|marketplace)/|^features/lib/path-marketplace\.ts$' "$D/lifecycle-files.txt")" -eq 0 && test "$(git show -s --format=%s "$(cat "$D/hooks-commit")")" = "test(features): reload pi in the hook scenarios" && test "$(grep -cvE '^features/hook/' "$D/hooks-files.txt")" -eq 0 && test "$(git show -s --format=%s "$(cat "$D/components-commit")")" = "test(features): reload pi in the component scenarios" && test "$(grep -cvE '^features/(skill|slash-command|agent|workflow|mcp-server)/|^features/step_definitions/(session|workflow/companion-missing|workflow/listing)\.steps\.ts$' "$D/components-files.txt")" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: an area commit is missing, has another title, or holds a file of another area (unless step 9 recorded a step that had to move with its uses, which the SUMMARY explains)</fails_when>
    <automated>f=.planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-SUMMARY.md; test -s "$f" && for h in '## Harness' '## Audit' '## Switch results' '## Checks' '## Threat Flags' '## For the orchestrator'; do grep -qxF "$h" "$f" || exit 1; done && grep -qF 'keep:shared-pi-reset' "$f" && grep -qF 'switch:reload-stand-in' "$f" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the SUMMARY is missing a required section or the audit counts per category</fails_when>
  </verify>
  <done>Every reload stand-in reloads, and every new-session test keeps its new session. Every switched scenario passes under each profile that runs it, with its old expectations except W2's one-load rows. Each other change is reverted and reported. Titles, descriptions, and comments name what the steps do. Three area commits hold the switches. `check:static` and `npm run test:cucumber` pass with the dry-run totals unchanged. The SUMMARY gives the audit counts per category with file lists, every trim, rewording, and revert, and the checks.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| scenario expectations -> suite verdict | a switched scenario that proves less than before lets a product regression pass the behavioral gate |
| one scenario's Pi state -> the next scenario's reset | a reload leaves processes, connections, or runtime state that the shared Pi's `Before()` reset must find |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qrv-01 | Tampering | switched scenarios (test evidence) | high | mitigate | The keep rules hold every new-session behavior under test: session hooks, an empty conversation, a saved session, live MCP, another project, and the shared reset. W2 allows only the second bind's rows to go, as a prefix check against the tracer commit. W4 reverts any other change and reports it, flagged `possible product bug` where the reload shows less. The SUMMARY lists every switch, trim, rewording, and revert, and the dry-run totals must not change. |
| T-qrv-02 | Tampering | audit rules (a misclassified use) | medium | mitigate | The script sets every category, and the review lists hold every near-miss step text for a decision. The tracer self-check requires the five known stand-ins to classify as switches. Every keep reason and every flagged switch is read, and both whole profiles run on the result. |
| T-qrv-03 | Denial of service | the shared Pi after a reload | medium | mitigate | The shared Pi's `Before()` asserts a clean baseline (no plugin, no payload, no git host state, the profile's MCP implementation), and the builtin profile asserts that stubs exit. Step 7 of Task 3 finds the area that leaves state and reverts its shared-Pi switches. |
| T-qrv-04 | Information disclosure | `$D` tables and logs | low | accept | They hold sandbox paths under a temporary root and scenario text, never a credential, and they stay in the scratch folder. |
| T-qrv-05 | Repudiation | a revert that no reader sees | low | mitigate | The `outcome` column and the SUMMARY's "Switch results" list every revert with its failing step and profile. |
| T-qrv-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package and has no install task, so the package-legitimacy gate has nothing to check. |
</threat_model>

<verification>
- Task 1: the driver, step, comment, and skill-doc grep gates; the four tracer scenarios under the
  adapter profile and the two `@mcp` ones under the builtin profile; `check:static`; and the tracer
  commit's title and file set.
- Task 2: the table's header, its row count against the tree's live count, the closed category set,
  the reasons and outcome placeholders, the stale-row check, the five library rows, the tracer
  self-check, the counts file, and the decided review lists.
- Task 3: the reload and new-session line counts against the final table, the unchanged dry-run
  totals, `check:static`, `npm run test:cucumber` with both summaries all passed, the scope check
  against `files_modified`, the three area commits, and the SUMMARY sections.
- For the orchestrator, not the executor: `npm run check` in the main checkout after the merge
  (AGENTS.md, Build verification).
</verification>

<success_criteria>
- An RPC scenario can reload Pi with `/claude:plugin reload` through one step meaning, with the
  reloaded load's payloads and skills on the world.
- The `startSession` comment states the real difference between a new session and a reload.
- All 639 uses at 98ada0c, and any that the sibling added, plus the five library callers, are
  classified mechanically, with a reason per row in `$D/new-session-audit.tsv`. The SUMMARY gives
  the counts per category with their file lists.
- Every reload stand-in reloads. SessionStart `clear`, SessionEnd, empty-conversation,
  saved-session, live-MCP, another-project, and shared-reset uses keep their new session.
- Each switched scenario asserts the same outcome, apart from the documented one-load rows. Any
  other difference is reverted and reported, never rewritten.
- The adapter and builtin cucumber runs pass in full, and `check:static` passes. No product file
  changes.
</success_criteria>

## Source audit

| Source | ID | Item | Plan | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GOAL | 261123-qrv | RPC tests reload instead of starting a new session | Tasks 1-3 | COVERED | |
| CONTEXT | item | add an RPC harness step that sends `/claude:plugin reload`; it depends on the sibling's subcommand | Task 1 | COVERED | `reloadSession`, `When the user reloads pi`, `Given the user has reloaded pi`; `depends_on: ["261123-qru"]`; precondition and contract check |
| CONTEXT | item | audit every RPC step that calls `startSession`/`new_session`: 639 uses in 92 files plus the library callers | Task 2 | COVERED | the seven forms (five plus the tracer's two) and five library rows |
| CONTEXT | item | switch the reload stand-ins | Task 3 | COVERED | W1, with W2 to W5 |
| CONTEXT | item | keep SessionStart `clear`, SessionEnd hooks, an empty conversation, and the shared Pi reset | Task 2 | COVERED | categories 2 and 3; the `pi-process.ts` library row |
| CONTEXT | item | fix the `features/lib/pi-commands.ts:162` comment | Task 1 | COVERED | step 3e; negative grep on the old claim |
| CONTEXT | item | both cucumber profiles stay green | Tasks 1, 3 | COVERED | tracer runs; final `npm run test:cucumber` |
| CONTEXT | item | the audit result (counts per category, with file lists) goes in the SUMMARY | Task 3, output | COVERED | `$D/audit-counts.tsv` copied into "## Audit" |
| CONTEXT | orchestrator | single plan, 1-3 tasks; `depends_on`, `files_modified`, `must_haves` | frontmatter | COVERED | |
| CONTEXT | orchestrator | state the precondition, the exact command text, and the expected payload; read the sibling's plan if it exists | context, contract, Task 1 | COVERED | the sibling's plan did not exist; Task 1 step 2 checks the merged handler |
| CONTEXT | orchestrator | mechanical, reviewable audit; classification by what later steps rely on; a table under the scratch folder with a reason per use | audit rules, Task 2 | COVERED | the new-session id is covered by keep rules 2, 3, and 4 and by the library rows; the trust difference is flagged |
| CONTEXT | orchestrator | mind the different payloads; the same outcome, or say why rows change | W2, Task 3 | COVERED | the double bind is the one allowed change, a prefix check; the reload runs no session hooks (keep rule 2) |
| CONTEXT | orchestrator | each switched scenario passes both profiles; a differing outcome is reported; a masked product bug goes to the orchestrator | W4, Task 3 steps 5-7 | COVERED | the `possible product bug` flag; stop at more than 20 |
| CONTEXT | orchestrator | a step name that says what happens; reuse the terminal wording; one meaning per step | Task 1 | COVERED | "the user reloads pi" beside "the user reloads pi in the terminal ..." |
| CONTEXT | orchestrator | the npm prefix, `fd`, the heavy lock, the commit hook, no `--no-verify`, no `SKIP` | execution rules | COVERED | |
| CONTEXT | orchestrator | no product change; never edit STATE, ROADMAP, BACKLOG, or CHANGELOG | execution rules, scope gate | COVERED | |
| CONTEXT | orchestrator | commit titles per the committing skill, no quick ids; split by feature area | Tasks 1, 3 | COVERED | four commits |
| RESEARCH | facts | built-in `/reload` is terminal-only; `ctx.reload()` works over RPC; `new_session` is not a reload; the late SessionStart keys on `startup` | facts F1-F4, Task 1 docs | COVERED | |
| RESEARCH | harness facts | the other `startSession` callers listed in the note | Task 2 library rows | COVERED | five rows with fixed categories |
| RESEARCH | decision 5 | fix the comment; keep the new-session tests | Tasks 1, 2 | COVERED | |
| RESEARCH | decision 6 | the `reload-plugins` alias and print-mode notify | -- | EXCLUDED | out of scope by decision 6 |
| RESEARCH | one-shot drivers | `pi-json-mode.ts` and `pi-one-shot.ts` never reload | -- | EXCLUDED | not RPC; nothing to switch |

<output>
Create `.planning/quick/261123-qrv-rpc-tests-reload-instead-of-starting-a-new-session-planning/261123-qrv-SUMMARY.md`
with `status: complete` in its frontmatter and these sections, each heading on a line of its own:

- `## Harness`: the reload contract found (`$D/reload-contract.txt`): the response, any payload
  of the command's own, and whether a sibling step was reused. Also the driver and the two (or
  three) steps, the comment fix, the skill-doc changes, the tracer lines, and the tracer run times
  from the summary lines.
- `## Audit`: the use count at 98ada0c (639 lines in 92 files) and in this tree, and the five
  library callers. The rules as the script applied them, with any pattern that a review-list
  decision added. A table with one row per category: count, number of files, and the file list
  with per-file counts, from the final `$D/audit-counts.tsv`. The absolute path of
  `$D/new-session-audit.tsv`. The `trust-write` rows and what happened to each.
- `## Switch results`: switched uses and scenarios per area; each W2 trim (file, title, old and
  new row counts); each rewording from `$D/rewordings.tsv` (old and new); each revert (file, line,
  title, failing step, expected against actual, profile, and the `possible product bug` flag); the
  step definitions added or deleted by W5.
- `## Checks`: every verify command with its exit status, the commit it ran on, the Node version,
  and the counts it printed. This includes the dry-run totals at the start and the end, both
  whole-profile runs and their reruns, `check:static`, and the final `npm run test:cucumber` with
  its durations. Then each commit's hash, title, and file count.
- `## Threat Flags`, even when the answer is "None" (AGENTS.md, GSD records), as this line:
  None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
- `## For the orchestrator` (the executor edits none of these files):
  - No CHANGELOG line: the change is test-only, and the reload subcommand's line belongs to
    261123-qru.
  - Every revert flagged `possible product bug`, for routing.
  - The keep categories beyond decision 5's list: saved session, live MCP connections, another
    project, and a step that names a new session. Also the `trust-write` flag, for the
    maintainer's review.
  - A stale comment outside `files_modified`, if step 2 of Task 3 found one. One already seen:
    the doubled comment line at `features/step_definitions/hook/session.steps.ts:507-508`, left as
    it is.
  - `npm run check` in the main checkout after the merge.
</output>
