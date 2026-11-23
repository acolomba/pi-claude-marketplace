---
phase: quick-261123-qrv
plan: 01
subsystem: features (cucumber harness and scenarios)
tags: [reload, rpc, cucumber, harness, new-session]
status: complete
requires:
  - "261123-qru: /claude:plugin reload and the reload-started payload"
provides:
  - "reloadSession(pi) in features/lib/pi-commands.ts: RPC reload through /claude:plugin reload"
  - "steps `Given the user has reloaded pi` and `When the user reloads pi`"
  - "533 RPC scenario uses that stood in for a reload now reload; 106 feature uses and 5 library callers keep a new session"
affects:
  - features/lib/pi-commands.ts
  - features/step_definitions/session.steps.ts
  - 84 feature files under features/
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
tech-stack:
  added: []
  patterns:
    - "an RPC reload is a prompt of /claude:plugin reload whose first payload, reload-started, the driver checks exactly and drops"
key-files:
  created: []
  modified:
    - features/lib/pi-commands.ts
    - features/step_definitions/session.steps.ts
    - features/support/world.ts
    - features/step_definitions/command.steps.ts
    - features/lib/result-rows.ts
    - features/lib/path-marketplace.ts
    - features/step_definitions/workflow/companion-missing.steps.ts
    - features/step_definitions/workflow/listing.steps.ts
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
decisions:
  - "RPC scenarios reload Pi through /claude:plugin reload when they only need Pi to load what changed; they start a new session only to test session hooks, an empty conversation, a saved session, live MCP connections, project trust, another project, or the shared reset (decision 5 of research/HEADLESS-RELOAD.md, which has no decision ID)"
metrics:
  completed: 2026-11-23
  tasks: 3
actuals:
  tokens: 99900
  tasks: 3
  commits: 4
commits: 4
plan_head_before: 20ff36e0bf0c3fedeada72fbbeb99a18eac7b5c9
plan_head_after: 90d11a47e88f619ce382bc9ff2aa6b2131d78c92
---

# Quick 261123-qrv Plan 01: RPC scenarios reload instead of starting a new session Summary

RPC scenarios now reload Pi with `/claude:plugin reload` through a checked driver,
`reloadSession`, and two steps. A mechanical audit sorted every one of the 639 new-session step
uses and the five library callers. 533 uses that only stood in for a reload now reload. 106 uses
that test what a new session does keep it, and so do the five callers. Both cucumber profiles
passed on the first whole run, with no revert.

Worktree `/home/user/pi-claude-marketplace/.claude/worktrees/agent-a23ccd376dfa5ca63`, branch
`worktree-agent-a23ccd376dfa5ca63`, base `20ff36e` (the merged sibling 261123-qru). `$D` is
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-qrv`.

## Harness

**Reload contract in the merged code** (`$D/reload-contract.txt`). It matches the plan's "The
reload contract" section, so no stop condition arose:

- The prompt `/claude:plugin reload` routes to `makeReloadHandler`
  (`edge/handlers/plugin/reload.ts`). With no refusal, it emits `reload-started` and asks for the
  reload. The registered command handler (`edge/register.ts`) returns
  `runForeground(...).then(() => reloadWhenRequested(...))`, which awaits `ctx.reload()`. Pi awaits
  that handler before it answers, so the answer `{disposition: "handled"}` comes after the
  reloaded runtime's load payloads.
- The `reload-started` value (`RELOAD_STARTED_PAYLOAD`, no other field):
  `{schemaVersion: 1, kind: "reload-started", origin: {kind: "command", commandId: "plugin reload", invocationId: <non-empty>}, severity: "info", needsReload: false}`.
- Refusals: a one-shot run (`acceptsLaterCommands` false) and a busy session (`ctx.isIdle()`
  false) emit one `usage-error`, severity `error`, usage `""`, and start no reload. Extra
  arguments get a `usage-error` too. None of these can happen over RPC in this plan's steps.
- Before Task 1, no step registered `the user reloads pi` or `the user has reloaded pi`.

**Driver** (`features/lib/pi-commands.ts`):

- `RELOAD_COMMAND = "/claude:plugin reload"`. Its comment says why: Pi's own `/reload` runs only in
  the terminal, and RPC has no reload request.
- `reloadSession(pi)` counts the session's custom entries, then sends the prompt. It asserts a
  quiet exchange (no extension error, no dialog) and the disposition `handled`. It reads the
  entries after the count through `claudePluginPayloads` (DRV-01). It requires the first payload
  to deep-equal the `reload-started` value, with the payload's own non-empty `invocationId`. It
  drops that payload and returns `{skills, payloads}` with the rest. A missing payload or any
  other first payload, a `usage-error` included, fails with the payload in the message. The doc
  comment states the contract and F2, F4, F5, F6, and F8. It names `rpc-mode.js`,
  `agent-session.js`, and `resource-loader.js` with no line numbers.
- The private `offeredSkills(pi)` holds the `get_commands` read. `readSession` and `reloadSession`
  share it.
- The `startSession` doc comment no longer says that a new session works as `/reload` does. It
  says what a new session does that a reload does not: SessionEnd, then SessionStart `clear`, an
  empty conversation, a new id, a session runtime with its own project-trust decision, and a load
  with the reason `startup`. It points to `reloadSession`. The double-bind comment stays.

**Steps** (`features/step_definitions/session.steps.ts`): `Given the user has reloaded pi` (all
payloads info) and `When the user reloads pi` (`keepSession`). The private helpers `assertAllInfo`
and `assertAllWarnings` hold the severity checks that the new-session Givens now share. A comment
above the reload steps states the contract. A comment above the new-session `When` says when a
scenario starts a new session. The D-02 comment covers a reload's single load. The steps use the
default timeout: the four tracer scenarios took 16.9 s together under the adapter profile
(`0m 16.935s`) and 3.5 s for the two `@mcp` scenarios under builtin (`0m 3.457s`). No reload came
near 10 s. The `, which warned` reload form was not needed, because neither `which warned` use
switched (both are project-trust keeps in `features/mcp-server/verdict-list.feature`).

**Comments and the skill doc:** `world.ts` (`resultsSource`, `sessionSkills()` and its error
text), `command.steps.ts` (overview, D-02), and `result-rows.ts` (overview) name the reload.
`world-and-stand-ins.md` gains a reload-driver bullet and the choice rule beside
`When the user starts a new pi session`, and its trust bullet says that a reload decides no trust.

**Tracer lines** (unchanged from 98ada0c, so no `$D/tracer-lines.txt`):
`features/plugin/reconcile.feature:13` (title), `:18` (`When the user reloads pi`; the second
`Reconcile pending` row and the second `demo@fixtures ... will install` row removed),
`features/mcp-server/legacy-move.feature:21`, `:149`, `:150`, and `features/hook/tool-use.feature:276`.

## Audit

- Uses: 639 lines in 92 files at 98ada0c. This tree had 639 too: 634 new-session lines plus the
  five tracer lines (the sibling added no use). There are 5 library callers. The table
  `$D/new-session-audit.tsv` (absolute path
  `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-qrv/new-session-audit.tsv`)
  has 644 rows plus the header. The script is `$D/audit-uses.mjs`. The library rows come from
  `$D/build-audit.sh`.
- Rules as applied: the plan's "Audit rules" verbatim. The signals are `other-project`,
  `hooks-recording`, `session-hooks`, `turn-before`, `saved-session`, `live-mcp`, `project-trust`
  (profile step, trust wording, or a write of a Pi trust input above the use), and
  `uneven-repeat`. The flags are `repeated-rows` and `title-new-session`. Precedence 1 to 8. A
  Background use is evaluated once per scenario of its file. The script also accepts the reload
  form `the user has reloaded pi, which warned`, and it fails on any other `new pi session` text.
- Review-list decisions added no pattern. No `turn`, `live`, or new `session hooks` text came
  out, so the categories equal the script's first run. That run matched the plan's orientation
  exactly: 533, 57, 36, 6, 5, 1, 1, 0.

### Category counts (final `$D/audit-counts.tsv`)

| category | count | files | file list |
| --- | --- | --- | --- |
| `keep:another-project` | 6 | 3 | features/plugin/disable.feature (2); features/plugin/enable.feature (2); features/plugin/install.feature (2) |
| `keep:empty-conversation` | 2 | 2 | features/slash-command/model-runs.feature (1); features/step_definitions/plugin/subagent-hooks.steps.ts (1) |
| `keep:live-mcp` | 5 | 2 | features/mcp-server/legacy-move.feature (2); features/mcp-server/lifecycle.feature (3) |
| `keep:names-new-session` | 1 | 1 | features/lib/subagent-hook-session.ts (1) |
| `keep:project-trust` | 36 | 8 | features/agent/project-trust.feature (4); features/mcp-server/legacy-move.feature (11); features/mcp-server/verdict-list.feature (2); features/plugin/autoapply.feature (2); features/plugin/executables.feature (3); features/plugin/options.feature (2); features/plugin/project-trust.feature (7); features/skill/project-trust.feature (5) |
| `keep:session-hooks` | 59 | 10 | features/hook/additional-context.feature (20); features/hook/async.feature (1); features/hook/configuration.feature (2); features/hook/messages.feature (6); features/hook/session-end.feature (8); features/hook/session.feature (16); features/lib/real-subagent-child.ts (1); features/plugin/package-dependencies.feature (1); features/plugin/session-start-hooks.feature (3); features/step_definitions/hook/session.steps.ts (1) |
| `keep:shared-pi-reset` | 1 | 1 | features/support/pi-process.ts (1) |
| `keep:uneven-repeat` | 1 | 1 | features/plugin/autoapply.feature (1) |
| `switch:reload-stand-in` | 533 | 84 | features/agent/frontmatter.feature (24); features/agent/invocation.feature (11); features/agent/lifecycle.feature (6); features/agent/listing.feature (9); features/hook/additional-context.feature (5); features/hook/async.feature (18); features/hook/compaction.feature (6); features/hook/configuration.feature (3); features/hook/failures.feature (11); features/hook/lifecycle.feature (6); features/hook/matchers.feature (6); features/hook/messages.feature (10); features/hook/process.feature (6); features/hook/prompt-and-stop.feature (8); features/hook/prompt-commands.feature (2); features/hook/prompt-expansion.feature (8); features/hook/session.feature (4); features/hook/stop-failure.feature (9); features/hook/tool-failure.feature (11); features/hook/tool-use.feature (57); features/marketplace/add.feature (2); features/marketplace/autoupdate.feature (2); features/marketplace/file-source-update.feature (1); features/marketplace/refused-name.feature (1); features/marketplace/remove.feature (11); features/marketplace/update.feature (8); features/mcp-server/agent-grants.feature (1); features/mcp-server/legacy-move.feature (5); features/mcp-server/options.feature (1); features/plugin/apply.feature (9); features/plugin/autoapply.feature (11); features/plugin/component-directories.feature (2); features/plugin/config-migration.feature (14); features/plugin/configuration.feature (3); features/plugin/disable.feature (5); features/plugin/enable.feature (7); features/plugin/executables.feature (1); features/plugin/fetch.feature (1); features/plugin/git-source-update.feature (1); features/plugin/git-source.feature (6); features/plugin/import.feature (6); features/plugin/install-dependencies.feature (6); features/plugin/install-rollback.feature (2); features/plugin/install.feature (3); features/plugin/model-tools.feature (1); features/plugin/options.feature (3); features/plugin/partial-install.feature (1); features/plugin/project-locality.feature (3); features/plugin/reconcile.feature (10); features/plugin/reinstall.feature (5); features/plugin/state-migration.feature (9); features/plugin/subagent-child.feature (3); features/plugin/uninstall.feature (12); features/plugin/update-dependencies.feature (3); features/plugin/update-rollback.feature (1); features/plugin/update.feature (7); features/skill/aliases.feature (9); features/skill/collisions.feature (5); features/skill/frontmatter.feature (5); features/skill/invocation.feature (16); features/skill/lifecycle.feature (7); features/skill/listing.feature (4); features/skill/model-reads.feature (6); features/skill/options.feature (3); features/skill/root-source-entries.feature (2); features/skill/sibling-links.feature (1); features/slash-command/aliases.feature (5); features/slash-command/frontmatter.feature (3); features/slash-command/invocation.feature (17); features/slash-command/lifecycle.feature (6); features/slash-command/listing.feature (7); features/slash-command/manifest-forms.feature (11); features/slash-command/model-runs.feature (5); features/slash-command/options.feature (1); features/workflow/agent-steps.feature (5); features/workflow/agent-types.feature (2); features/workflow/collisions.feature (3); features/workflow/companion-missing.feature (2); features/workflow/lifecycle.feature (7); features/workflow/listing.feature (4); features/workflow/references.feature (2); features/workflow/refusals.feature (2); features/workflow/run.feature (5); features/workflow/storage.feature (1) |

Kept by reason: session hooks 59 (57 feature uses and 2 library callers), project trust 36,
another project 6, live MCP 5, empty conversation 2 (1 feature use and 1 library caller), uneven
repeat 1, names a new session 1 (library), and shared Pi reset 1 (library). Reverted: 0.

### Review lists

`$D/turn-misses.tsv` (15 texts, all `not a turn`). These steps set up records, files, or
settings. None adds a model turn or a session action.

| count | text | decision |
| --- | --- | --- |
| 23 | pi keeps only one recent token when the hooks session compacts | not a turn |
| 2 | the agents folder of the user scope holds the file {s} as an earlier release wrote it, with this text: | not a turn |
| 2 | the agents folder of the user scope holds the file {s}x\{s} as an earlier release wrote it, with this text: | not a turn |
| 1 | the installation record of the plugin {s} in the project scope has no recorded mcp servers, as an earlier release wrote it | not a turn |
| 1 | the installation record of the plugin {s} in the user scope holds no plugin options, as an earlier release wrote it | not a turn |
| 2 | the installation record of the project scope is rewritten as release {s} wrote it | not a turn |
| 7 | the installation record of the user scope is rewritten as release {s} wrote it | not a turn |
| 2 | the installation record of the user scope is rewritten with a schema version this release does not read | not a turn |
| 11 | the mcp.json file of the project scope holds the servers of the plugin {s} as release 0.19.2 wrote them, beside the user's own server {s} | not a turn |
| 2 | the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it: | not a turn |
| 9 | the mcp.json file of the user scope holds the servers of the plugin {s} as release 0.19.2 wrote them, beside the user's own server {s} | not a turn |
| 1 | the project scope holds what release 0.4.3 left: its installation record and no config | not a turn |
| 1 | the published plugin {s} of the marketplace {s} has the skill {s} described as {s} with this body: | not a turn |
| 1 | the published plugin {s} of the marketplace {s} has the slash command {s} described as {s} with this body: | not a turn |
| 1 | the user scope holds what release 0.4.3 left: its installation record and no config | not a turn |

`$D/mcp-misses.tsv`: empty. Every step below a use that names mcp either set `live-mcp` or is a
file step.

`$D/hook-source-review.tsv` (31 texts). Each step definition and its fixture writer were read:
`features/lib/path-marketplace.ts` (`writePluginFiles` writes `plugin.json` and one skill),
`features/lib/git-plugin.ts`, `features/lib/hook-files.ts` (`publishRecordingHooks` writes only
the table's hooks), `features/step_definitions/marketplace/publishing.steps.ts`, and
`features/step_definitions/plugin/{publishing,installation}.steps.ts`. Only two fixture writers
write a SessionStart hook: `plugin/session-start-hooks.steps.ts` and `plugin/packages.steps.ts`.
Their step texts say `session start hook`, so the regex already keeps them. Decided
`session hooks`: `the published plugin {s} of the marketplace {s} has a session start hook that
records each run in the project file {s}` and `... has a session start hook that writes what the
npm package {s} exports to the project file {s}`. Every other text is `no session hooks`.

| count | text | decision |
| --- | --- | --- |
| 27 | the git repository {s} holds these plugins: | no session hooks |
| 24 | the installation record of the project scope holds these plugins: | no session hooks |
| 7 | the installation record of the user scope holds these plugins: | no session hooks |
| 4 | the marketplace {s} has the file {s} at its root with this text: | no session hooks |
| 9 | the marketplace {s} is published as a <source kind> source | no session hooks |
| 661 | the marketplace {s} is published as a dir source | no session hooks |
| 1 | the marketplace {s} is published as a url source | no session hooks |
| 1 | the marketplace {s} is published as an external manifest | no session hooks |
| 26 | the marketplace {s} offers these plugins from git repositories: | no session hooks |
| 43 | the marketplace {s} offers these plugins with dependencies: | no session hooks |
| 664 | the marketplace {s} offers these plugins: | no session hooks |
| 20 | the marketplace {s} publishes this manifest: | no session hooks |
| 13 | the published plugin {s} of the marketplace {s} declares the mcp server {s} | no session hooks |
| 1 | the published plugin {s} of the marketplace {s} depends on these npm packages: | no session hooks |
| 2 | the published plugin {s} of the marketplace {s} has a session start hook that records each run in the project file {s} | session hooks |
| 1 | the published plugin {s} of the marketplace {s} has a session start hook that writes what the npm package {s} exports to the project file {s} | session hooks |
| 27 | the published plugin {s} of the marketplace {s} has an output style | no session hooks |
| 1 | the published plugin {s} of the marketplace {s} has an unreadable command file | no session hooks |
| 17 | the published plugin {s} of the marketplace {s} has the agent {s} described as {s} with this body: | no session hooks |
| 4 | the published plugin {s} of the marketplace {s} has the executable file {s} with this text: | no session hooks |
| 9 | the published plugin {s} of the marketplace {s} has the file {s} with these stub mcp servers: | no session hooks |
| 108 | the published plugin {s} of the marketplace {s} has the file {s} with this text: | no session hooks |
| 33 | the published plugin {s} of the marketplace {s} has the skill {s} described as {s} with this body: | no session hooks |
| 46 | the published plugin {s} of the marketplace {s} has the skill {s} with this skill file: | no session hooks |
| 24 | the published plugin {s} of the marketplace {s} has the slash command {s} described as {s} with this body: | no session hooks |
| 60 | the published plugin {s} of the marketplace {s} has the slash command {s} with this command file: | no session hooks |
| 4 | the published plugin {s} of the marketplace {s} has the stub mcp server {s} | no session hooks |
| 1 | the published plugin {s} of the marketplace {s} has the stub mcp server {s} whose tool name argument is {s} | no session hooks |
| 23 | the published plugin {s} of the marketplace {s} has the workflow {s} described as {s} that returns {s} | no session hooks |
| 39 | the published plugin {s} of the marketplace {s} has these agents: | no session hooks |
| 229 | the published plugin {s} of the marketplace {s} has these hooks, each recording its runs: | no session hooks |

`$D/trust-misses.tsv` (47 texts, the checker's added list). It holds every distinct step text of
a switched scenario that names settings, prompts, themes, skills, `.pi/`, or `.agents/` and did
not set `project-trust`. The decision is whether the step writes one of Pi's project trust inputs
(`trust-manager.js:8-16`: `.pi/{settings.json,mcp.json,extensions,skills,prompts,themes,SYSTEM.md,APPEND_SYSTEM.md}`).
All 47 are `not a trust input`. Most are reads (`the session offers these skills:`, `the model
receives these calls:`) or the verb "prompts". The writers write elsewhere.
`the claude code settings file of the {word} scope holds this text:` writes
`<project>/.claude/settings.json` or `~/.claude/settings.json`
(`claude-code-settings.steps.ts:22-31`). `the user has added the pi-dynamic-workflows package to
pi's settings` writes `<agent dir>/settings.json`, which is user scope
(`companion-missing.steps.ts:45`). The agents-folder steps write the user scope's `agents/`. The
plugin and marketplace file steps write the plugin or marketplace folder. For the maintainer's
review:

| count | text | decision |
| --- | --- | --- |
| 1 | the agent's model call 2 runs on the body of the agent file {s} of the user scope, which reads: | not a trust input |
| 2 | the agents folder of the user scope holds the file {s} as an earlier release wrote it, with this text: | not a trust input |
| 12 | the agents folder of the user scope holds the file {s} with this text: | not a trust input |
| 2 | the agents folder of the user scope holds the file {s}x\{s} as an earlier release wrote it, with this text: | not a trust input |
| 2 | the agents folder of the user scope holds the file {s}x\{s} with this text: | not a trust input |
| 3 | the claude code settings file of the project scope holds this text: | not a trust input |
| 5 | the claude code settings file of the user scope holds this text: | not a trust input |
| 20 | the hooks record these runs in any order: | not a trust input |
| 120 | the hooks record these runs: | not a trust input |
| 13 | the hooks show the user these messages: | not a trust input |
| 4 | the marketplace {s} has the file {s} at its root with this text: | not a trust input |
| 4 | the marketplace {s} publishes this manifest: | not a trust input |
| 2 | the model call 1 lists these skills in its system prompt: | not a trust input |
| 52 | the model receives these calls: | not a trust input |
| 1 | the model receives these saved hook outputs: | not a trust input |
| 1 | the project scope stages these skills and prompts: | not a trust input |
| 7 | the published plugin {s} of the marketplace {s} has the file {s} with this text: | not a trust input |
| 33 | the published plugin {s} of the marketplace {s} has the skill {s} described as {s} with this body: | not a trust input |
| 39 | the published plugin {s} of the marketplace {s} has the skill {s} with this skill file: | not a trust input |
| 5 | the published plugin {s} of the marketplace {s} has these agents: | not a trust input |
| 47 | the published plugin {s} of the marketplace {s} has these hooks, each recording its runs: | not a trust input |
| 8 | the result has these fields: | not a trust input |
| 7 | the scripted model plays these steps: | not a trust input |
| 32 | the session offers no skills | not a trust input |
| 114 | the session offers these skills: | not a trust input |
| 1 | the user has added the pi-dynamic-workflows package to pi's settings | not a trust input |
| 2 | the user has deleted the installed skills of {s} in the project scope | not a trust input |
| 4 | the user has run {s}, which skipped a skill of the plugin | not a trust input |
| 1 | the user prompts '/demo:echo !`printf pwned`' | not a trust input |
| 1 | the user prompts '/skill:demo-echo !`printf pwned`' | not a trust input |
| 273 | the user prompts {s} | not a trust input |
| 1 | the user prompts {s} after the woken turn ends | not a trust input |
| 1 | the user prompts {s} and 1 background hook runs finish | not a trust input |
| 1 | the user prompts {s} and 6 background hook runs finish | not a trust input |
| 1 | the user prompts {s} and follows up with {s} while the tool runs | not a trust input |
| 1 | the user prompts {s} and interrupts the running tool once it has created {s} | not a trust input |
| 1 | the user prompts {s} and steers with {s} while the tool runs | not a trust input |
| 6 | the user prompts {s} and the hook {s} goes on in the background | not a trust input |
| 1 | the user prompts {s} and the hook {s} wakes the model once | not a trust input |
| 1 | the user prompts {s} and the hook {s} wakes the model while the stop hook {s} runs | not a trust input |
| 2 | the user prompts {s} and the hook {s} wakes the model while the tool runs | not a trust input |
| 2 | the user prompts {s} and the model starts a workflow run | not a trust input |
| 5 | the user prompts {s} and the stop hooks continue the run | not a trust input |
| 1 | the user prompts {s} until {s}, reloads pi, and prompts {s} through the stop limit | not a trust input |
| 1 | the user reloads pi in the terminal and then prompts {s} | not a trust input |
| 3 | the user runs {s} | not a trust input |
| 2 | the user scope stages these skills and prompts: | not a trust input |

## Switch results

- Switched uses: 533 in 84 files. By area: plugin and marketplace 160 uses
  (`features/plugin/`, `features/marketplace/`), hooks 170 (`features/hook/`), components 203
  (`features/{agent,skill,slash-command,workflow,mcp-server}/`). Task 3 swapped 528 of them, and
  the tracer had swapped the other 5.
- Both whole profiles passed on the first run after the switch: adapter `2293 scenarios (2293
  passed)`, builtin `260 scenarios (260 passed)`. So no row needed triage, no table changed
  beyond W2, and **no revert** happened. No `possible product bug` came up, and the leak protocol
  was not needed.
- W5: no step definition was added or deleted. No switched use has the `, which warned` form,
  and every new-session form keeps uses: 67 `Given ... started a new pi session`, 2
  `..., which warned`, 19 `When ... starts a new pi session`, 6 `... in another project`, and 12
  `... with the hooks recording`.

### W2 trims (one load's rows: an exact k+k repeat cut to k)

45 session tables. The tracer made 1 and Task 3 made 44: 43 went from 2 to 1 rows, and 2 went
from 4 to 2 (`features/plugin/state-migration.feature`). The `results list these marketplaces and
plugins:` table after each was an exact repeat too and was halved: 44 went from 2 to 1 rows, and
1 went from 6 to 3 (state-migration). The titles below are the titles at the tracer commit, and
the rows column is the session table.
The full log is `$D/switch-log.tsv`.

| use | scenario | session rows |
| --- | --- | --- |
| `features/agent/frontmatter.feature:184` | An installed ordinary agent adopts the delegated preference on update | 2 -> 1 |
| `features/agent/frontmatter.feature:1080` | An update renames an agent that was installed under a name with quote marks | 2 -> 1 |
| `features/hook/failures.feature:237` | An exec-form hook that names a plugin option of a record whose options do not parse fails as unreadable (D-PG10-25) | 2 -> 1 |
| `features/marketplace/refused-name.feature:31` | Every new session warns about an installed plugin whose marketplace manifest now declares a look-alike name and keeps it working | 2 -> 1 |
| `features/marketplace/remove.feature:620` | Removing a marketplace whose dependency declarations cannot be read fails and changes nothing | 2 -> 1 |
| `features/marketplace/update.feature:431` | Autoupdate off preserves installed versions | 2 -> 1 |
| `features/marketplace/update.feature:716` | Autoupdate keeps a plugin removed from the catalog | 2 -> 1 |
| `features/marketplace/update.feature:783` | Autoupdate continues in installed order after a plugin fails | 2 -> 1 |
| `features/marketplace/update.feature:831` | An invalid refreshed manifest leaves installed plugins unchanged | 2 -> 1 |
| `features/mcp-server/agent-grants.feature:562` | A pi-subagents background child with autoapply on installs nothing (MGRT-02) | 2 -> 1 |
| `features/mcp-server/options.feature:518` | A new session disables in mcp-adapter.json a server that names a plugin option of a record whose options do not parse (D-PG10-25) | 2 -> 1 |
| `features/plugin/apply.feature:111` | Apply replaces a marketplace whose declared source changed | 2 -> 1 |
| `features/plugin/apply.feature:312` | Apply that cannot install one hand-declared plugin still makes every other hand edit | 2 -> 1 |
| `features/plugin/autoapply.feature:106` | A project local config that turns autoapply off overrides a base config that turns it on | 2 -> 1 |
| `features/plugin/autoapply.feature:135` | A project config that turns autoapply off overrides a user config that turns it on | 2 -> 1 |
| `features/plugin/autoapply.feature:188` | A config that turns autoapply off keeps a new session read-only | 2 -> 1 |
| `features/plugin/autoapply.feature:269` | A config whose autoapply is not a boolean is reported as invalid and keeps a new session read-only | 2 -> 1 |
| `features/plugin/autoapply.feature:298` | A failed install during an autoapply session is reported and stays pending | 2 -> 1 |
| `features/plugin/config-migration.feature:106` | A later load keeps the user's edit to the config the first load wrote | 2 -> 1 |
| `features/plugin/config-migration.feature:149` | A load reports a config that is not valid and keeps it byte for byte | 2 -> 1 |
| `features/plugin/config-migration.feature:173` | A load reports an unreadable local config and writes no project config | 2 -> 1 |
| `features/plugin/configuration.feature:84` | A new session does not install a plugin whose local layer lacks its marketplace | 2 -> 1 |
| `features/plugin/fetch.feature:111` | A fetch leaves the installed plugin running the revision it installed until an update | 2 -> 1 |
| `features/plugin/git-source.feature:264` | Apply reports a declared plugin whose clone the git host refuses as source missing | 2 -> 1 |
| `features/plugin/git-source.feature:305` | Apply reports a declared plugin whose dependency's clone the git host refuses as dependency failed | 2 -> 1 |
| `features/plugin/options.feature:270` | Every new session warns about a plugin whose recorded options do not parse (D-PG10-25) | 2 -> 1 |
| `features/plugin/reconcile.feature:18` | A reload after a hand edit of the config prints the pending block and changes nothing | 2 -> 1 |
| `features/plugin/reconcile.feature:48` | A new session lists the disable of a plugin whose marketplace now declares a newer version of its dependency | 2 -> 1 |
| `features/plugin/reconcile.feature:69` | Every new session warns about an installed plugin that its catalog no longer offers and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:81` | Every new session warns about an installed plugin that its catalog no longer offers and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:98` | Every new session warns about an installed plugin whose marketplace manifest is invalid and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:110` | Every new session warns about an installed plugin whose marketplace manifest is invalid and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:127` | Every new session warns about an installed plugin whose marketplace manifest is not valid json and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:139` | Every new session warns about an installed plugin whose marketplace manifest is not valid json and keeps it working | 2 -> 1 |
| `features/plugin/reconcile.feature:164` | Every new session warns once about a plugin its catalog no longer offers whose files are gone | 2 -> 1 |
| `features/plugin/state-migration.feature:119` | A load refuses a newer installation record, leaves it as it was, and offers none of its plugins' skills | 4 -> 2 |
| `features/plugin/state-migration.feature:144` | A load that refuses the user scope's newer installation record still offers the project scope's skills | 4 -> 2 |
| `features/plugin/subagent-child.feature:37` | A background child's load with autoapply on leaves a pending install, uninstall, and update for the next parent load | 2 -> 1 |
| `features/plugin/uninstall.feature:309` | Uninstalling a plugin whose dependency's declarations cannot be read fails and changes nothing | 2 -> 1 |
| `features/plugin/update-rollback.feature:90` | A new session offers the skills of the installed version after a failed update | 2 -> 1 |
| `features/plugin/update.feature:175` | Updating with --local a plugin only the base layer declares fails as plugin in base layer only | 2 -> 1 |
| `features/plugin/update.feature:277` | Updating every plugin with --local updates only the plugins the local layer declares | 2 -> 1 |
| `features/plugin/update.feature:353` | Updating every plugin with --local fails and updates nothing when the dependencies of a local plugin cannot be read | 2 -> 1 |
| `features/plugin/update.feature:505` | Updating a dependency past the version range its dependent declares holds the update and changes nothing | 2 -> 1 |
| `features/plugin/update.feature:564` | Updating a plugin whose new version is only partially available is held without --partial and keeps the installed version | 2 -> 1 |

### Rewordings (W3, `$D/rewordings.tsv`)

The list has 84 entries: 67 scenario titles, 13 feature-description sentences in 11 files, and 4
harness comments. `features/plugin/autoapply.feature` keeps new-session uses (untrusted project),
so its description names both: "a reload or a new session". All text is ASCII, and the titles
stay unique in their files.

- `features/agent/listing.feature:266`: A new session advertises each bridged agent to the parent model -> A reload advertises each bridged agent to the parent model
- `features/marketplace/add.feature:167`: A marketplace added with --local to a scope with no base config stays out of it in a new session -> A marketplace added with --local to a scope with no base config stays out of it after a reload
- `features/marketplace/add.feature:176`: An added marketplace is still listed in a new session -> An added marketplace is still listed after a reload
- `features/marketplace/autoupdate.feature:121`: An enabled autoupdate shows in the marketplace list of a new session -> An enabled autoupdate shows in the marketplace list after a reload
- `features/marketplace/autoupdate.feature:139`: An enabled autoupdate shows in the marketplace info of a new session -> An enabled autoupdate shows in the marketplace info after a reload
- `features/marketplace/refused-name.feature:20`: Every new session warns about an installed plugin whose marketplace manifest now declares a look-alike name and keeps it working -> Every reload warns about an installed plugin whose marketplace manifest now declares a look-alike name and keeps it working
- `features/marketplace/remove.feature:112`: A new session offers none of the removed plugins' skills -> A reload offers none of the removed plugins' skills
- `features/marketplace/remove.feature:127`: A new session lists none of the removed plugins -> A reload lists none of the removed plugins
- `features/marketplace/remove.feature:147`: A removed base-layer marketplace stays absent in a new session -> A removed base-layer marketplace stays absent after a reload
- `features/marketplace/remove.feature:328`: A marketplace removed with --local stays removed in a new session -> A marketplace removed with --local stays removed after a reload
- `features/marketplace/remove.feature:394`: A marketplace removed from one layer is still listed in a new session -> A marketplace removed from one layer is still listed after a reload
- `features/marketplace/update.feature:457`: Autoupdate exposes the offered version in a new session -> Autoupdate exposes the offered version after a reload
- `features/mcp-server/options.feature:500`: A new session disables in mcp-adapter.json a server that names a plugin option of a record whose options do not parse (D-PG10-25) -> A reload disables in mcp-adapter.json a server that names a plugin option of a record whose options do not parse (D-PG10-25)
- `features/plugin/autoapply.feature:7`: A new session installs the plugins a project config declares when the config turns autoapply on -> A reload installs the plugins a project config declares when the config turns autoapply on
- `features/plugin/autoapply.feature:34`: A new session clones and installs a git-source plugin that a project config declares when autoapply is on -> A reload clones and installs a git-source plugin that a project config declares when autoapply is on
- `features/plugin/autoapply.feature:171`: A config that turns autoapply off keeps a new session read-only -> A config that turns autoapply off keeps a reload read-only
- `features/plugin/autoapply.feature:246`: A config whose autoapply is not a boolean is reported as invalid and keeps a new session read-only -> A config whose autoapply is not a boolean is reported as invalid and keeps a reload read-only
- `features/plugin/configuration.feature:79`: A new session does not install a plugin whose local layer lacks its marketplace -> A reload does not install a plugin whose local layer lacks its marketplace
- `features/plugin/install-dependencies.feature:24`: A new session offers the skills of a plugin and its dependency that carries a version constraint -> A reload offers the skills of a plugin and its dependency that carries a version constraint
- `features/plugin/install-dependencies.feature:236`: A new session offers the skills of every plugin of an installed dependency chain -> A reload offers the skills of every plugin of an installed dependency chain
- `features/plugin/install-dependencies.feature:295`: A new session after a failed dependency chain offers no skills -> A reload after a failed dependency chain offers no skills
- `features/plugin/install-dependencies.feature:423`: A new session offers the skills of a dependency that an install moved into its version constraint -> A reload offers the skills of a dependency that an install moved into its version constraint
- `features/plugin/install-dependencies.feature:550`: A new session after a dependency chain with conflicting versions failed offers no skills -> A reload after a dependency chain with conflicting versions failed offers no skills
- `features/plugin/install-dependencies.feature:562`: A new session after a version conflict with an installed dependency offers only the skills of the dependency -> A reload after a version conflict with an installed dependency offers only the skills of the dependency
- `features/plugin/install-rollback.feature:29`: A new session after a failed install offers no skills of the plugin -> A reload after a failed install offers no skills of the plugin
- `features/plugin/install.feature:106`: A new session offers the skills of the installed plugin -> A reload offers the skills of the installed plugin
- `features/plugin/options.feature:256`: Every new session warns about a plugin whose recorded options do not parse (D-PG10-25) -> Every reload warns about a plugin whose recorded options do not parse (D-PG10-25)
- `features/plugin/partial-install.feature:50`: A new session offers the skills of a plugin installed with --partial -> A reload offers the skills of a plugin installed with --partial
- `features/plugin/reconcile.feature:28`: A new session with nothing pending prints nothing -> A reload with nothing pending prints nothing
- `features/plugin/reconcile.feature:36`: A new session lists the disable of a plugin whose marketplace now declares a newer version of its dependency -> A reload lists the disable of a plugin whose marketplace now declares a newer version of its dependency
- `features/plugin/reconcile.feature:60`: Every new session warns about an installed plugin that its catalog no longer offers and keeps it working -> Every reload warns about an installed plugin that its catalog no longer offers and keeps it working
- `features/plugin/reconcile.feature:88`: Every new session warns about an installed plugin whose marketplace manifest is invalid and keeps it working -> Every reload warns about an installed plugin whose marketplace manifest is invalid and keeps it working
- `features/plugin/reconcile.feature:113`: Every new session warns about an installed plugin whose marketplace manifest is not valid json and keeps it working -> Every reload warns about an installed plugin whose marketplace manifest is not valid json and keeps it working
- `features/plugin/reconcile.feature:138`: Every new session warns once about a plugin its catalog no longer offers whose files are gone -> Every reload warns once about a plugin its catalog no longer offers whose files are gone
- `features/plugin/reinstall.feature:335`: A new session offers the skills of the reinstalled plugin -> A reload offers the skills of the reinstalled plugin
- `features/plugin/reinstall.feature:369`: Deleting the installed skills of a plugin takes them out of a new session before any reinstall -> Deleting the installed skills of a plugin takes them out at the next reload before any reinstall
- `features/plugin/reinstall.feature:481`: A new session offers the skills of the version a reinstall installed -> A reload offers the skills of the version a reinstall installed
- `features/plugin/uninstall.feature:25`: A new session no longer offers the skills of the uninstalled plugin -> A reload no longer offers the skills of the uninstalled plugin
- `features/plugin/update-rollback.feature:88`: A new session offers the skills of the installed version after a failed update -> A reload offers the skills of the installed version after a failed update
- `features/plugin/update.feature:76`: A new session offers the skills of the updated version -> A reload offers the skills of the updated version
- `features/skill/collisions.feature:36`: A new session offers no skill that shares its name with a command of its plugin -> A reload offers no skill that shares its name with a command of its plugin
- `features/skill/lifecycle.feature:19`: Disabling a plugin removes its skills from a new session -> Disabling a plugin removes its skills at the next reload
- `features/skill/lifecycle.feature:45`: Uninstalling a plugin removes its skills from a new session -> Uninstalling a plugin removes its skills at the next reload
- `features/skill/listing.feature:6`: A new session lists a bridged skill under its generated name with its description -> A reload lists a bridged skill under its generated name with its description
- `features/skill/root-source-entries.feature:129`: A new session after the update offers only the skill that stays -> A reload after the update offers only the skill that stays
- `features/slash-command/lifecycle.feature:20`: Disabling a plugin removes its slash commands from a new session -> Disabling a plugin removes its slash commands at the next reload
- `features/slash-command/lifecycle.feature:46`: Uninstalling a plugin removes its slash commands from a new session -> Uninstalling a plugin removes its slash commands at the next reload
- `features/slash-command/listing.feature:7`: A new session offers a bridged command as a prompt command with its description -> A reload offers a bridged command as a prompt command with its description
- `features/workflow/collisions.feature:31`: A new session offers the workflow and no prompt template under a name both claim -> A reload offers the workflow and no prompt template under a name both claim
- `features/workflow/collisions.feature:53`: Of two workflow scripts with one name, a new session offers the last one, as in Claude Code -> Of two workflow scripts with one name, a reload offers the last one, as in Claude Code
- `features/workflow/collisions.feature:81`: A new session offers both workflows when one name is the other with the plugin prefix -> A reload offers both workflows when one name is the other with the plugin prefix
- `features/workflow/companion-missing.feature:7`: Adding the engine to pi's settings after the install runs the workflow in a new session with no reinstall -> Adding the engine to pi's settings after the install runs the workflow after a reload with no reinstall
- `features/workflow/companion-missing.feature:60`: Without the engine, a new session offers no workflow command -> Without the engine, a reload offers no workflow command
- `features/workflow/lifecycle.feature:20`: Running a workflow command after its plugin is uninstalled shows the engine's notice, because pi keeps the command until a new session -> Running a workflow command after its plugin is uninstalled shows the engine's notice, because pi keeps the command until a reload
- `features/workflow/lifecycle.feature:27`: Uninstalling a plugin with a workflow reports that its command lingers until a new session -> Uninstalling a plugin with a workflow reports that its command lingers until a reload
- `features/workflow/lifecycle.feature:36`: A new session after the uninstall offers no workflow command -> A reload after the uninstall offers no workflow command
- `features/workflow/lifecycle.feature:42`: Disabling a plugin with a workflow reports that its command lingers until a new session -> Disabling a plugin with a workflow reports that its command lingers until a reload
- `features/workflow/lifecycle.feature:51`: Running a workflow command after its plugin is disabled shows the engine's notice, because pi keeps the command until a new session -> Running a workflow command after its plugin is disabled shows the engine's notice, because pi keeps the command until a reload
- `features/workflow/lifecycle.feature:58`: A new session after the disable offers no workflow command -> A reload after the disable offers no workflow command
- `features/workflow/lifecycle.feature:64`: Enabling a disabled plugin runs its workflow again in a new session -> Enabling a disabled plugin runs its workflow again after a reload
- `features/workflow/lifecycle.feature:108`: A new session after an update lists the new description of its workflow -> A reload after an update lists the new description of its workflow
- `features/workflow/lifecycle.feature:125`: Updating to a version that renames the workflow reports that the old command lingers until a new session -> Updating to a version that renames the workflow reports that the old command lingers until a reload
- `features/workflow/lifecycle.feature:143`: Running the old workflow command after a renaming update shows the engine's notice, because pi keeps the command until a new session -> Running the old workflow command after a renaming update shows the engine's notice, because pi keeps the command until a reload
- `features/workflow/lifecycle.feature:159`: A new session after a renaming update offers only the new workflow command -> A reload after a renaming update offers only the new workflow command
- `features/workflow/listing.feature:7`: A new session offers a bridged workflow as a command named for its plugin and its meta name -> A reload offers a bridged workflow as a command named for its plugin and its meta name
- `features/workflow/refusals.feature:143`: A new session offers a command for each installed script and none for a refused or skipped one -> A reload offers a command for each installed script and none for a refused or skipped one
- `features/workflow/storage.feature:31`: A new session offers the workflow of a project install and runs it -> A reload offers the workflow of a project install and runs it
- `features/agent/lifecycle.feature:3`: Each plugin verb changes what pi-subagents lists for a bridged agent, seen in a   new session as Pi's /reload gives it. -> Each plugin verb changes what pi-subagents lists for a bridged agent, seen after a   reload.
- `features/hook/lifecycle.feature:3`: which hooks of a bridged plugin run in a new session. -> which hooks of a bridged plugin run after a reload.
- `features/plugin/autoapply.feature:3`: When autoapply is on, a new session applies -> When autoapply is on, a reload or a new session applies
- `features/plugin/configuration.feature:3`: and a new session loads what -> and a reload loads what
- `features/plugin/reconcile.feature:3`: A new session reports pending config edits -> A reload reports pending config edits
- `features/skill/lifecycle.feature:3`: changes what a new session offers for a bridged skill -> changes what a reload offers for a bridged skill
- `features/skill/lifecycle.feature:4`: Changes apply at a new session, as Pi's /reload does. -> Changes apply at the next reload.
- `features/skill/listing.feature:3`: A new session lists each bridged skill -> A reload lists each bridged skill
- `features/slash-command/lifecycle.feature:3`: changes what a new session offers for a bridged command -> changes what a reload offers for a bridged command
- `features/slash-command/lifecycle.feature:4`: Changes apply at a new session, as Pi's /reload does. -> Changes apply at the next reload.
- `features/workflow/companion-missing.feature:4`: A new session stands in for /reload, which re-reads   pi's settings the same way, and a scripted model -> A reload re-reads   pi's settings, and a scripted model
- `features/workflow/lifecycle.feature:4`: workflow's command stays until a new session, -> workflow's command stays until a reload,
- `features/workflow/listing.feature:3`: become commands that a new session offers when the -> become commands that a reload offers when the
- `features/lib/path-marketplace.ts:6`: * plugin version, so a new session shows which version is installed. Pi adds -> * plugin version, so a reload shows which version is installed. Pi adds
- `features/step_definitions/workflow/companion-missing.steps.ts:5`: * The step adds the engine's package to Pi's user settings, the way * `pi install` records a package, so the next session loads it as `/reload` * would. Pi's RPC mode cannot run the `/reload` builtin, so a scenario starts * a new session instead, which re-reads Pi's settings and extensions the same * way. -> * The step adds the engine's package to Pi's user settings, the way * `pi install` records a package, so the next reload loads it. Pi's RPC mode * cannot run the `/reload` builtin, so a scenario reloads through * `/claude:plugin reload`, which re-reads Pi's settings and extensions.
- `features/step_definitions/workflow/companion-missing.steps.ts:38`: // found: a stale entry would load the engine into the shared Pi at its next // new session. -> // found: a stale entry would load the engine into the shared Pi at its next // reload or new session.
- `features/step_definitions/workflow/listing.steps.ts:2`: * @fileoverview Steps every workflow feature shares: the workflow commands a * new session offers, running -> * @fileoverview Steps every workflow feature shares: the workflow commands Pi * offers after a reload, running

## Checks

Node `v24.22.3` throughout. Every run used `$S/gate-bin` on PATH, the `nondac-sh` script shell,
and `NODE_OPTIONS=--max-old-space-size=6144`. The heavy runs took the shared lock.

| Check | Commit | Result |
| --- | --- | --- |
| Dry runs at the start (`$D/dry-run-base.txt`) | `20ff36e` | adapter 2293 scenarios, 28755 steps; builtin 260 scenarios, 3576 steps |
| Tracer, adapter, 4 scenarios (`$D/tracer-adapter.log`) | `20ff36e` + Task 1 edits | exit 0, `4 scenarios (4 passed)`, `55 steps (55 passed)`, 0m 16.935s |
| Tracer, builtin, 2 `@mcp` scenarios (`$D/tracer-builtin.log`) | `20ff36e` + Task 1 edits | exit 0, `2 scenarios (2 passed)`, `27 steps (27 passed)`, 0m 3.457s |
| `npm run lint` warm-up (`$D/lint-warm.log`) | same | exit 0 |
| `check:static`, first (`$D/tracer-static.log`) | same | exit 1: `format:check` flagged `features/lib/pi-commands.ts`. Prettier fixed it (one line). |
| `check:static`, rerun (`$D/tracer-static.log`) | same | exit 0, all 7 parts passed |
| Tracer commit hook (`check:commit`) | `6e06697` | Passed |
| Task 1 verify 1 to 8 | `6e06697` | all pass |
| Task 2 verify 1 to 4 (`$D/verify-t2.sh`) | `6e06697` | all exit 0 |
| Dry runs after the switch (`$D/dry-run-*-mid.log`) | `6e06697` + switch | same totals |
| Whole adapter profile (`$D/switch-adapter.log`) | `6e06697` + switch | exit 0, `2293 scenarios (2293 passed)`, `28755 steps (28755 passed)`, 10m 35.408s (wall 638 s) |
| Whole builtin profile (`$D/switch-builtin.log`) | `6e06697` + switch | exit 0, `260 scenarios (260 passed)`, `3576 steps (3576 passed)`, 1m 55.574s (wall 118 s) |
| Task 3 verify 1 (reload lines 533 = switch rows; new-session lines 106 = keep feature rows) | `6e06697` + switch | pass |
| `check:static` on the switched tree (`$D/switch-static.log`) | `6e06697` + switch | exit 0 |
| Area commit hooks (`check:commit`) | `71e6757`, `14dc0d6`, `90d11a4` | Passed, each |
| Final dry runs (`$D/dry-run-end.txt`) | `90d11a4` | equal to `$D/dry-run-base.txt` (adapter 2293 / 28755, builtin 260 / 3576), exit 0 |
| Final `check:static` (`$D/final-static.log`) | `90d11a4` | exit 0, all 7 parts passed (`check:features` included) |
| Final `npm run test:cucumber` (`$D/final-cucumber.log`) | `90d11a4` | exit 0. Adapter: `2293 scenarios (2293 passed)`, `28755 steps (28755 passed)`, 10m 10.790s. Builtin: `260 scenarios (260 passed)`, `3576 steps (3576 passed)`, 1m 47.441s. Wall 723 s. No failed, undefined, ambiguous, pending, skipped, or timed-out step |
| Task 3 scope check (changed files since `20ff36e` all in `files_modified`) | `90d11a4` | exit 0 |
| Task 3 area-commit check (titles and file sets) | `90d11a4` | exit 0 |
| Task 3 SUMMARY sections check | this file | pass |

| Commit | Title | Files |
| --- | --- | --- |
| `6e06697a10152d1d433278595a3d94e81b58c3c9` | test(features): reload pi over rpc with /claude:plugin reload | 9 |
| `71e6757` | test(features): reload pi in the plugin and marketplace scenarios | 34 |
| `14dc0d6` | test(features): reload pi in the hook scenarios | 16 |
| `90d11a47e88f619ce382bc9ff2aa6b2131d78c92` | test(features): reload pi in the component scenarios | 37 |

Measured: `git rev-list --count 20ff36e..HEAD` = 4. Every commit ran the full hook. No
`--no-verify` was used, and `SKIP` stayed as the session exported it (`trufflehog`).

## Deviations from Plan

1. **[Rule 3 - Blocking] Shell guard.** The worktree's shell guard refused one-line commands
   that call `git` beside other commands. As the plan's execution rules allow, the commit, audit,
   verify, and gate commands ran from scripts under `$D`: `commit.sh`, `build-audit.sh`,
   `verify-t2.sh`, `run-profile.sh`, and `final-gates.sh`. The verify bodies are the plan's text
   verbatim.
2. **[Process] Extra review list.** The orchestrator asked for `$D/trust-misses.tsv`, and
   `audit-uses.mjs` writes it. Its decisions are in `$D/review-decisions.json` under `trust`. No
   category depends on it.
3. **[Process] Reload form in the audit.** The audit script also treats
   `the user has reloaded pi, which warned` as a reload form, because Task 3's verify regex
   counts it. No line uses it.
4. **[Scope] Comments left as they are.** `features/support/world.ts:10-12` and `:275` still say
   that session results come from "a new session". The file is in `files_modified`, but only the
   tracer commit may hold it, and Task 1 named only `resultsSource` and `sessionSkills`. Changing
   it in an area commit would break the area-commit verify. It is listed for the orchestrator
   below.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

The executor edited none of these files.

- No CHANGELOG line: the change is test-only, and the reload subcommand's line belongs to
  261123-qru.
- Reverts flagged `possible product bug`: none. No switched scenario failed.
- Keep categories beyond decision 5's list, for the maintainer's review:
  - saved session: 0. Each saved-session scenario also declares session hooks.
  - live MCP connections: 5, in `features/mcp-server/legacy-move.feature` (2) and
    `features/mcp-server/lifecycle.feature` (3).
  - project trust: 36, in 8 files (see the counts table).
  - uneven repeat: 1, `features/plugin/autoapply.feature:343`.
  - another project: 6, in `features/plugin/{disable,enable,install}.feature`.
  - a step that names a new session: 1, the library caller `features/lib/subagent-hook-session.ts`.
  - Also review the `trust-misses` list above (47 texts, all `not a trust input`).
- Stale comments:
  - `features/support/world.ts:10-12` (the overview says the last results come from "a command
    or a new session") and `:275` ("The results of the last new session"). Both should also name
    a reload. The file is in this plan's `files_modified`, but the area-commit rules kept it out.
  - `features/step_definitions/mcp-implementation.steps.ts:16` ("as a new session does") is
    outside `files_modified`.
  - The doubled comment line at `features/step_definitions/hook/session.steps.ts:507-508`, left
    as it is.
  - `features/lib/path-marketplace.ts:199` says that the manifest cache "outlives a new session".
    That is still true and is not about how a switched scenario loads, so it stays.
- Run `npm run check` in the main checkout after the merge (AGENTS.md, Build verification).
- Commit this SUMMARY. The executor did not commit it, nor STATE.md or the PLAN.

## Self-Check: PASSED

- FOUND: `features/lib/pi-commands.ts` (`reloadSession`, `RELOAD_COMMAND`, `offeredSkills`),
  `features/step_definitions/session.steps.ts` (both reload steps),
  `.agents/skills/cucumber/rules/world-and-stand-ins.md`.
- FOUND on HEAD: `6e06697`, `71e6757`, `14dc0d6`, `90d11a4`.
