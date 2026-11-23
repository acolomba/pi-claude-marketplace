---
phase: quick-261123-qru
plan: 01
type: execute
wave: 1
quick_id: 261123-qru
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - test/edge/handlers/plugin/shared.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/shared/session-host.ts
  - test/shared/session-host.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts
  - test/edge/handlers/plugin/reload.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - test/edge/handlers/plugin/help.test.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - test/edge/router.test.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - test/edge/register.test.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - test/edge/completions/provider.test.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - test/architecture/flag-catalog-drift.test.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - test/shared/notification-types.test.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - test/shared/notification-resolve.test.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - test/shared/notification-grammar.test.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - test/shared/notification-json.test.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - test/shared/notification-wire.test.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - test/shared/notification-dispatch.test.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - test/shared/notification-mcp.test.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - test/orchestrators/skill-invocation.test.ts
  - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
  - test/orchestrators/command-invocation.test.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - test/edge/skill-aliases.test.ts
  - extensions/pi-claude-marketplace/edge/command-invocation.ts
  - test/edge/command-invocation.test.ts
  - extensions/pi-claude-marketplace/edge/command-tool.ts
  - test/edge/command-tool.test.ts
  - schema/claude-plugin.schema.json
  - test/architecture/wire-schema.test.ts
  - test/architecture/json-output-docs.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/background-update-notice.test.ts
  - test/architecture/cross-op-convergence.test.ts
  - test/architecture/manifest-read-agreement.test.ts
  - test/architecture/mcp-config-notices.test.ts
  - test/architecture/mcp-migration-notice.test.ts
  - test/architecture/no-credential-leak.test.ts
  - test/architecture/notify-grammar-invariant.test.ts
  - test/architecture/notify-will-reload-agreement.test.ts
  - test/edge/command-run.test.ts
  - test/shared/notification-summary.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-tag-probe.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-clone-probe.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - features/plugin/reload.feature
  - features/plugin/help.feature
  - features/step_definitions/command.steps.ts
  - features/lib/plugin-completions.ts
  - features/lib/pi-commands.ts
  - features/skill/lifecycle.feature
  - features/slash-command/invocation.feature
  - docs/json-output.md
  - docs/output-catalog.md
  - docs/hooks-compatibility.md
  - docs/skills-commands-compatibility.md
  - docs/mcp-compatibility.md
  - docs/messaging-style-guide.md
  - README.md
  - README.es.md
  - .planning/PROJECT.md
  - .planning/quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/261123-qru-SUMMARY.md
autonomous: true
must_haves:
  truths:
    - "In Pi's terminal, `/claude:plugin reload` runs Pi's own reload, so the terminal shows Pi's row `Reloaded keybindings, extensions, skills, prompts, themes, and context files` (scenario `features/plugin/reload.feature:7`)."
    - "Over RPC, `/claude:plugin reload` appends one `reload-started` payload (severity `info`, `needsReload` false), then Pi reloads, and the load of the reloaded runtime reports the config's pending install once, all before Pi answers the prompt with the disposition `handled`. The When's driver requires `handled` and keeps only the entries that arrive before the answer, so the load's row in the Then proves the answer came after the reload (scenario `features/plugin/reload.feature:14`; break B6, which stops awaiting the reload, fails that Then)."
    - "In a one-shot run (print or json mode), `/claude:plugin reload` refuses with `Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes.` and an empty usage (scenario `features/plugin/reload.feature:33`); there help leaves `reload` out of the usage (guard scenario `features/plugin/help.feature:41`, which passes on today's tree and so has no natural red, and which break B2 fails), and completions leave it out after a session start whose host takes no later commands (router, help, provider, and register rows)."
    - "While the run of a prompt is active, `/claude:plugin reload` refuses with Claude Code's busy words `The session is busy, so plugins were not reloaded. Ask again once it is idle.`, starts no reload, and the prompt's run goes on to its end (scenario `features/plugin/reload.feature:42`)."
    - "`acceptsLaterCommands(host)` in `shared/session-host.ts` returns `host.hasUI` and is the only reader of Pi's `hasUI` in the extension; the reason is its doc comment. `reloadCommandFor(mode, host)` in the same file is the one place that picks the reload command: `/reload` where the host has Pi's own `/reload` (the module-private `hasNativeReload`, true only for `tui`), `/claude:plugin reload` in another host that takes later commands, and none in a one-shot run (grep gates and session-host rows)."
    - "Pi makes the command's context stale once it reloads, so `edge/register.ts` calls `ctx.reload()` only after the command settled and the foreground runner returned, and nothing reads the context after it; a reload that fails reaches Pi, which reports it (register rows)."
    - "The reload-hint trailer, the background update notice, and the MCP move rows name the command that `reloadCommandFor` picks, and a one-shot run's text has none of them; the JSON and RPC payloads keep `needsReload` in every mode, and every terminal byte form in `docs/output-catalog.md` stays as it is (grammar, mcp, dispatch, and catalog rows)."
    - "The skill and command refusals, typed and through `run_plugin_command`, name `/reload` in the terminal and `/claude:plugin reload` over RPC (scenarios `features/skill/lifecycle.feature:50` and `features/slash-command/invocation.feature:216`), and leave the reload out in a one-shot run (orchestrator rows)."
    - "Red proofs: R0 and R1 fail on the code without each change in a When or a Then, logged before the change is committed; the json help guard is a survivor of R0; breaks B1 to B6 on the bound commit fail the scenarios they name; `check-red.mjs` prints `RED-PROOFS OK` for the `r0-`, `r1-`, and `fix-` tables, and `extensions/` ends clean."
    - "Execution is checkpointed: every finished step appends one row (step, commit, logs, gates) to `$D/progress.tsv`, and a resumed executor continues after the last row without redoing a finished step (Resume protocol; each task's ledger gate)."
    - "`check:static` passes, every changed source pair has 100% direct coverage, `test:unpaired` and `test:integration` pass, and the affected feature files pass under the adapter and the builtin profiles."
    - "The output catalog, the JSON guide, the README command list and its Spanish copy, the hooks, skills and commands, and MCP compatibility pages, the messaging guide, and the Key Decisions row RELOADCMD-D1 state the command, the two predicates, the hint rule, the wording rule, and the Pi gaps."
  artifacts:
    - path: extensions/pi-claude-marketplace/shared/session-host.ts
      provides: "`SessionHost`, `acceptsLaterCommands`, `ReloadCommand`, `reloadCommandFor`, and the module-private `hasNativeReload`"
      contains: "export function acceptsLaterCommands(host: SessionHost): boolean {"
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts
      provides: "`makeReloadHandler`: the one-shot refusal, the argument check, the busy refusal, then `reload-started` and the reload request"
      contains: "export function makeReloadHandler("
    - path: extensions/pi-claude-marketplace/edge/register.ts
      provides: "the reload request set, `reloadWhenRequested` after the foreground runner, and the session-start answer that completions read"
      contains: "await ctx.reload();"
    - path: extensions/pi-claude-marketplace/shared/notification-wire.ts
      provides: "the `reload-started` payload in the payload union"
      contains: "kind: Type.Literal(\"reload-started\")"
    - path: features/plugin/reload.feature
      provides: "the terminal, RPC, one-shot, and busy scenarios at lines 7, 14, 33, and 42"
      contains: "Feature: Plugin reload"
    - path: features/plugin/help.feature
      provides: "the sessionful usage in the three rpc help scenarios and the json-mode guard at line 41"
      contains: "Scenario: Help in a one-shot run in json mode leaves the reload subcommand out"
    - path: .planning/PROJECT.md
      provides: "the Key Decisions row RELOADCMD-D1"
      contains: "RELOADCMD-D1"
  key_links:
    - from: extensions/pi-claude-marketplace/edge/router.ts
      to: extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts
      via: "`TOP_LEVEL_VERB_ROUTES` maps the spelling `reload` to the command id `plugin reload` and the handler `reload`, which `registerClaudePluginCommand` builds with `makeReloadHandler`"
      pattern: "\\[\"reload\", \\{ commandId: \"plugin reload\", handler: \"reload\" \\}\\]"
    - from: extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts
      to: extensions/pi-claude-marketplace/edge/register.ts
      via: "the handler calls its `requestReload(ctx)` port after `notifyReloadStarted`; the registration adds the context to its `WeakSet` and, after `runForeground` resolves, `reloadWhenRequested` deletes it and awaits `ctx.reload()`"
      pattern: "\\.then\\(\\(\\) => reloadWhenRequested\\(reloadRequests, ctx\\)\\)"
    - from: extensions/pi-claude-marketplace/shared/notification-dispatch.ts
      to: extensions/pi-claude-marketplace/shared/session-host.ts
      via: "the text branch of `emitPresentation` passes `reloadCommandFor(mode, ctx)` to `emitText`, which hands it to `formatEnvelopeArguments` and `formatRawSurface`"
      pattern: "emitText\\(ctx, presentation, reloadCommandFor\\(mode, ctx\\)\\)"
    - from: extensions/pi-claude-marketplace/edge/skill-aliases.ts
      to: extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
      via: "the request carries `reloadCommand: reloadCommandFor(ctx.mode, ctx)`, which the two skill refusals read; `edge/command-invocation.ts` and `edge/command-tool.ts` fill the command request the same way"
      pattern: "reloadCommand: reloadCommandFor\\(ctx\\.mode, ctx\\),"
---

# Quick 261123-qru: `/claude:plugin reload`, the sessionful predicate, and the reload wording

<objective>
Carry out decisions 1 to 4 of `.planning/research/HEADLESS-RELOAD.md`, the maintainer's binding
choices of 2026-11-23, under the new decision ID RELOADCMD-D1:

1. One named predicate, `acceptsLaterCommands(host)`, returns Pi's `hasUI`, with the reasoning in
   its doc comment, and no other code decides whether this Pi process takes later commands.
2. `/claude:plugin reload` runs `ctx.reload()` where the predicate holds (the terminal and RPC). A
   one-shot run (print and json mode) refuses it with a short usage message, and help and
   completions leave it out there.
3. The reload hint follows the same predicate: a one-shot run gets no hint text, and the JSON and
   RPC payloads keep `needsReload`.
4. Every user-facing instruction to reload takes its command from one place: `/reload` where the
   host has Pi's own `/reload` (one named predicate, true only for the terminal, documented as a
   Pi fact), `/claude:plugin reload` in another host that takes later commands. Every site the
   note lists is covered.

Test first: the four new scenarios and the three changed help scenarios fail on today's code (R0,
logged before the code commit), and the two changed refusal scenarios fail on the code of Task 1
(R1). Five deliberate breaks on the bound commit fail them again and are reverted clean.

Purpose: the AGENTS.md rules that a user-visible change ships with a scenario that fails without
it and that Claude Code's behavior is the default, and the sibling item 261123-qrv, which reloads
RPC scenarios with this command.

Output: six commits (a refactor, the command, the hint wording, the refusal wording, the docs, and
the decision row) and `261123-qru-SUMMARY.md` with the red proofs, the checks, the decisions, the
RPC reload contract for 261123-qrv, and the lines for the orchestrator.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/research/HEADLESS-RELOAD.md
@.agents/skills/cucumber/rules/features.md
@.agents/skills/cucumber/rules/steps.md
@.agents/skills/typescript-unit-tests/rules/cases.md
@.agents/skills/typescript-unit-tests/rules/test-doubles.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/local-verification/rules/commands.md
@.agents/skills/committing/SKILL.md
@.agents/skills/readme/SKILL.md

All line numbers below were read at 98ada0c. HEAD 84e1299 changed only `.planning/`, so they apply
to this tree. Where this plan and the research note differ, this plan wins; decisions 5 and 6 of
the note are not part of this item (5 is sibling 261123-qrv, 6 is out of scope).

## Pi 1.5.1 facts this plan rests on (read in `node_modules/@earendil-works/pi-coding-agent`)

- `ctx.reload()` runs `session.reload()` in RPC (`dist/modes/rpc/rpc-mode.js:256-258`) and in
  print and json mode (`dist/modes/print-mode.js:81-83`). In the terminal it calls
  `handleReloadCommand()` (`dist/modes/interactive/interactive-mode.js:1638-1640`), the code of
  the typed `/reload` (`:2762-2765`), which shows `Wait for the current response to finish before
  reloading.` while a run streams, catches its own failure as `Reload failed: ...`, and ends with
  the status row `Reloaded keybindings, extensions, skills, prompts, themes, and context files`
  (`:5482-5556`). It rebuilds the chat during the reload, so a notice sent before `ctx.reload()`
  is gone after it (`:3587-3590`, `rebuildChatFromMessages`).
- `session.reload()` throws `Wait for the current response to finish before reloading.` while a
  run streams and `Wait for compaction to finish before reloading.` while Pi compacts
  (`dist/core/agent-session.js:3094-3100`). The context's `isIdle()` is
  `!this._isAgentRunActive && !this.isCompacting` (`:1131-1133`), false in exactly those cases.
- An extension command runs at once, even while a run streams (`agent-session.js:1702-1711`), in
  RPC and in the terminal (`interactive-mode.js:2822-2828`). The RPC response to the prompt goes
  out after the handler returned (`rpc-mode.js:314-339`, `preflightResult("handled")`).
- After `ctx.reload()`, the old command context and the old `pi` are stale: every context getter
  and `pi.appendEntry` throw (`dist/core/extensions/runner.js:482-491`, `:621-681`;
  `dist/core/extensions/loader.js:319-321`; `docs/extensions.md:1514-1540`, "do not use the old ctx
  after await ctx.reload()").
- `hasUI` is true when the host bound a real UI context (`runner.js:403-405`): the terminal and
  RPC bind one, print and json bind the no-op one (`runner.js:131-145`).
- Pi calls a command's `getArgumentCompletions(prefix)` only from its terminal
  (`interactive-mode.js:544`), with no context; RPC has no completion request, and its
  `addAutocompleteProvider` does nothing (`rpc-mode.js:198-200`).
- Pi's docs say a print or json run "does not accept later commands" (`docs/cli-integration.md:44`).

## Claude Code 2.1.330 (read in `/opt/claude-code/bin/claude`, byte offsets from `grep -boaF`)

- `/reload-plugins` (@325359447): `{type:"local", name:"reload-plugins", description:"Activate
  pending plugin changes in the current session", argumentHint:"[--force]",
  supportsNonInteractive:!0, thinClientDispatch:"control-request"}`.
- After a reload it prints `Reloaded: <n> plugin(s) · <n> skill(s) · <n> agent(s) · <n> hook(s) ·
  <n> plugin MCP server(s) · <n> plugin LSP server(s)` (@339454145). In a non-interactive
  session whose input did not come from its local stdin it answers `/reload-plugins isn't
  available over a remote connection in this session.` (@339452313, `Ae` @339454863). `--force`
  only skips its prompt-cache warning.
- Its SDK `reload_plugins` request is served in a turn by default; with `refuse_if_busy`, a busy
  session gets `The session is busy, so plugins were not reloaded. Ask again once it is idle.`
  with the error code `reload_plugins_busy` (@352166769).
- The interactive notice `Plugins changed. Run /reload-plugins to activate.` (@347950235) exists
  only in its interactive UI; a `-p` run shows no reload hint.

## Decisions this plan takes (RELOADCMD-D1; the SUMMARY lists them for the maintainer)

- D1 Mid-run reload: refuse, with Claude Code's own busy words. Pi gap: Pi cannot reload while a
  run streams or compacts, where Claude Code's default serves the reload in the turn. The handler
  checks `ctx.isIdle()` before it asks for the reload, in every host, so the refusal is the same
  in the terminal and over RPC and the reload is never started into Pi's throw.
- D2 Success output. Pi gap: the command cannot report after the reload, because its context is
  stale, and Pi tells the reloaded runtime only `reason: "reload"`. So the command emits a new
  outcome kind, `reload-started` (severity `info`, `needsReload` false, no other field), right
  before the reload, and prints no `Reloaded: <counts>` line. The text strategy renders
  `reload-started` as nothing: Pi's terminal shows its own reload box and status row, and its
  chat rebuild would erase an earlier notice. Over RPC the payload is the command's outcome, which
  `runCommand` requires in json and rpc mode, and the prompt response follows the reload.
- D3 One-shot refusal text: `Reload is unavailable: this Pi run does not accept later commands, so
  the next run loads the changes.`, with an empty usage. It uses Pi's own phrase and names no mode,
  so no code but the predicate decides it. Claude Code's nearest text is about remote input, so it
  does not fit.
- D4 Arguments: none. `--force` has no Pi counterpart, because Pi checks no prompt-cache impact.
- D5 Help line: `  reload` padded to column 53, then Claude Code's description with a lower-case
  first word, as the `bootstrap` line has one: `activate pending plugin changes in the current
  session`.
- D6 Completions: Pi gives the completion callback no context, so the registration records
  `acceptsLaterCommands(ctx)` at each `session_start` and the provider gets that answer; it is
  false until a session starts, the safe direction of the note.
- D7 `reloadCommandFor(mode, host)` checks Pi's own `/reload` first. Pi's terminal binds a UI, so a
  host with Pi's own `/reload` always takes later commands, and the result is the same as checking
  the predicate first for every Pi mode. The terminal path then reads no `hasUI`, so the strict
  notification boundary of the edge suites keeps its reads, and every other host gets the hint
  only when `acceptsLaterCommands` holds.
- D8 One-shot wording of the other sites: decision 3 extended. A sentence that only tells the user
  to reload is left out, and an instruction `X, then run <command>` becomes `X.`, because the next
  run loads the change. RPC carries the MCP move rows and the background update as data, so their
  text is terminal-only in practice.
- D9 The four `hookDebugLog` lines that name `/reload` (`uninstall.ts:1197`, `update-swap.ts:1047`,
  `enable-disable.ts:1904`, `install-disable-cascade.ts:205`) are debug traces, not instructions
  to the user, and stay as they are. The migration notice's cost line ("Until you reload") names
  no command and stays.

## Design, file by file (paths under `extensions/pi-claude-marketplace/`)

`shared/session-host.ts` (new, zone `shared`, no imports). File header in the style of its
siblings: the two facts about the Pi host that the reload rules read, and the one place that picks
the command an instruction to reload names (RELOADCMD-D1). Contents after Task 2:

```ts
/** The fact about the Pi host that decides whether it takes later commands. */
export interface SessionHost {
  readonly hasUI: boolean;
}

/**
 * RELOADCMD-D1: whether this Pi process accepts later commands, a "sessionful"
 * host. Pi sets `hasUI` when the host bound a real UI context
 * (`core/extensions/runner.js:404`): the terminal and RPC bind one, print and
 * json bind none. A dialog needs an answer that arrives later, so `hasUI`
 * means a process that keeps reading input. The converse is not certain: a
 * future long-lived host without dialogs reads false, which is the safe
 * direction, because the extension then offers and names no reload there. It
 * is not whether Pi saves a session file: RPC with `--no-session` still takes
 * later commands. No other code decides this.
 */
export function acceptsLaterCommands(host: SessionHost): boolean {
  return host.hasUI;
}

/**
 * RELOADCMD-D1: whether the host has Pi's own `/reload`. Pi fact (1.5.1): the
 * terminal handles a typed `/reload` before any extension command
 * (`modes/interactive/interactive-mode.js:2762`); RPC's prompt runs only
 * extension commands, skills, and templates (`core/agent-session.js:1704`),
 * and the RPC command set has no reload (`modes/rpc/rpc-types.d.ts`).
 */
function hasNativeReload(mode: string): boolean {
  return mode === "tui";
}

/** The command that an instruction to reload names. */
export type ReloadCommand = "/reload" | "/claude:plugin reload";

/**
 * RELOADCMD-D1: the one place that picks the command an instruction to reload
 * names: Pi's own `/reload` where the host has it, `/claude:plugin reload` in
 * any other host that accepts later commands, and none in a one-shot run, whose
 * next run loads the change. Pi's terminal binds a UI, so a host with Pi's own
 * `/reload` always accepts later commands, and its check comes first.
 */
export function reloadCommandFor(mode: string, host: SessionHost): ReloadCommand | undefined {
  if (hasNativeReload(mode)) {
    return "/reload";
  }

  return acceptsLaterCommands(host) ? "/claude:plugin reload" : undefined;
}
```

Task 1 writes the header, `SessionHost`, and `acceptsLaterCommands`; Task 2 adds the rest.

`edge/handlers/plugin/reload.ts` (new, Task 1). Header: `/claude:plugin reload` runs Pi's reload
where the host takes later commands (RELOADCMD-D1); Pi's terminal does what its own `/reload` does,
and RPC has no `/reload`; a one-shot run refuses, because its next run loads the changes; Pi
cannot reload while a run streams or compacts, and the context is not idle then, so the command
refuses with Claude Code's busy words (a Pi gap: Claude Code serves the reload in the turn); Pi
makes the context stale once it reloads, so the handler reports `reload-started` first and asks
the registration, through `requestReload`, to reload after the command settled. Its module
constants are `USAGE = "Usage: /claude:plugin reload"` and the two refusal texts of D1 and D3.
`makeReloadHandler(requestReload: (ctx: ExtensionCommandContext) => void): SubcommandHandler`
returns a non-async handler (the `help.ts` form, each path ending in `return Promise.resolve();`)
that, in this order: refuses with the D3 text and usage `""` when `!acceptsLaterCommands(ctx)`;
returns when `rejectArguments(args, { ctx, run, usage: USAGE, surplus: "reload takes no
arguments." })` rejected; refuses with the D1 text and usage `""` when `!ctx.isIdle()` (the line
is exactly `    if (!ctx.isIdle()) {`, the old text of B3); else calls `notifyReloadStarted(ctx,
run)` and then `requestReload(ctx)`.

`edge/handlers/plugin/shared.ts` (Task 1, commit C0): add, after `rejectUnknownFlag`,

```ts
/**
 * The prelude of a verb that takes no argument (`browse`, `reload`): a token
 * that opens with `--` is an unknown flag, named first, and any other token is
 * `surplus`. Returns whether it rejected the arguments.
 */
export function rejectArguments(
  args: string,
  {
    ctx,
    run,
    usage,
    surplus,
  }: { ctx: ExtensionCommandContext; run: NotificationRun; usage: string; surplus: string },
): boolean {
  const tokens = tokenizeArgs(args).map((token) => token.value);
  if (rejectUnknownFlag(tokens, { ctx, run, usage })) {
    return true;
  }

  if (tokens.length === 0) {
    return false;
  }

  notifyUsageError(ctx, run, { message: surplus, usage });
  return true;
}
```

and import `tokenizeArgs` beside `parseArgs` from `../../args.ts`. `browse.ts:151-159` becomes one
`if (rejectArguments(args, { ctx, run, usage: USAGE, surplus: "browse takes no arguments." }))
{ return; }`, and its now unused imports go. This keeps the reload prelude from forming a clone
group with browse's (`fallow dupes`, 50 tokens and 5 lines by default).

`edge/router.ts` (Task 1):
- `SubcommandHandlers` (`:43-80`) gains `reload: SubcommandHandler;` after `browse`, with a
  comment `// RELOADCMD-D1: Pi's reload where the host takes later commands.`
- `TOP_LEVEL_SUBCOMMANDS` (`:86-107`) gains `"reload"` right after `"browse"`.
- `TOP_LEVEL_VERB_ROUTES` (`:243-261`) gains, after the browse row, the prescribed row
  `  ["reload", { commandId: "plugin reload", handler: "reload" }],`.
- `TOP_LEVEL_USAGE` (`:149-168`) is replaced by the exported function below, placed where the
  constant was, with the constant's lines kept as module constants. With no `reload`, its bytes
  equal today's `TOP_LEVEL_USAGE`.

```ts
// RELOADCMD-D1: the top-level spellings and lines before `reload`, which a
// host that takes no later commands leaves out of its usage.
const SPELLINGS_BEFORE_RELOAD =
  "bootstrap|install|uninstall|prune|update|fetch|reinstall|list|ls|info|pending|apply|autoapply|enable|disable|import|browse";

const USAGE_LINES_BEFORE_RELOAD = [
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope",
  // ... today's lines through "  browse", unchanged
];

const RELOAD_USAGE_LINE =
  "  reload                                             activate pending plugin changes in the current session";

/** The top-level usage for `host`, with `reload` only where the host takes later commands (RELOADCMD-D1). */
export function topLevelUsage(host: SessionHost): string {
  const reload = acceptsLaterCommands(host);
  return [
    `Usage: /claude:plugin <${SPELLINGS_BEFORE_RELOAD}${reload ? "|reload" : ""}|marketplace|market|help> ...`,
    ...USAGE_LINES_BEFORE_RELOAD,
    ...(reload ? [RELOAD_USAGE_LINE] : []),
    `  marketplace <${MARKETPLACE_SPELLINGS}> ...   (alias: market)`,
    "  help [marketplace]",
  ].join("\n");
}
```

- `selectClaudePluginRoute(args, handlers, host: SessionHost)`: only its `default` arm reads the
  host, `usage: topLevelUsage(host)`. `routeClaudePlugin` passes its `ctx` when it selects from
  text. Update the header comment (`:10-24`): the top-level usage is built for the host.

`edge/handlers/plugin/help.ts` (Task 1): the top-level arm (`:30-33`) sends `topLevelUsage(ctx)`;
the import of `TOP_LEVEL_USAGE` becomes `topLevelUsage`. Only that arm reads the host.

`edge/flag-catalog.ts` (Task 1): `CatalogVerb` gains `| "reload"` after `| "browse"`, and `CATALOG`
gains `reload: [],` after `browse: [],`, with the comment above them extended: `reload` rejects
every argument too (RELOADCMD-D1).

`edge/completions/provider.ts` (Task 1): `NO_FLAG_VERBS` (`:108-113`) gains `"reload"` and its
comment names it; `getArgumentCompletions` gains a fourth parameter, `laterCommands: boolean`,
with a JSDoc line (RELOADCMD-D1: whether the host takes later commands, from the last
`session_start`; `reload` is offered only then), and `topLevelCompletions(current,
laterCommands)` keeps a subcommand only when `s.startsWith(current) && (laterCommands || s !==
"reload")`. Extend branch 1 of the header comment (`:9-11`).

`edge/register.ts` (Task 1):
- Imports: `acceptsLaterCommands` from `../shared/session-host.ts`, `makeReloadHandler` from
  `./handlers/plugin/reload.ts`, and `ExtensionCommandContext` into the type import from
  `../platform/pi-api.ts`.
- A module-private function before `registerClaudePluginCommand`:

```ts
/**
 * RELOADCMD-D1: runs Pi's reload for a command that asked for one, as the last
 * thing the command does. Pi makes the command's context stale once it
 * reloads (`docs/extensions.md`, ctx.reload()), so this runs after the command
 * settled and the foreground runner returned, and nothing reads the context
 * after it. A reload that fails reaches Pi, which reports it.
 */
async function reloadWhenRequested(
  requests: WeakSet<ExtensionCommandContext>,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (requests.delete(ctx)) {
    await ctx.reload();
  }
}
```

- In `registerClaudePluginCommand`: `const reloadRequests = new WeakSet<ExtensionCommandContext>();`
  and `let laterCommands = false;` beside the other locals, with one comment for both (Pi makes a
  fresh command context for each invocation, `core/agent-session.js:1791`, so a context names one
  invocation; `laterCommands` is the last session start's answer, which completions read because
  Pi gives the completion callback no context). The handler map gains `reload:
  makeReloadHandler((ctx) => { reloadRequests.add(ctx); }),` after `browse`. The command handler
  keeps its synchronous prologue (the mode check and the route selection must still throw before
  the foreground runner) and becomes `requireNotificationMode(ctx.mode); const route =
  selectClaudePluginRoute(args, handlers, ctx); return runForeground(() => runCommand(...)).then(()
  => reloadWhenRequested(reloadRequests, ctx));`. The completion callback passes `laterCommands`
  as the fourth argument. In the `session_start` listener, right after
  `requireNotificationMode(ctx.mode);`, add `laterCommands = acceptsLaterCommands(ctx);`. Extend
  the header comment (`:3-39`) with the reload and the session-start answer.

The `reload-started` kind (Task 1, all in `shared/`):
- `notification-types.ts`: `export interface ReloadStartedSurface { readonly kind:
  "reload-started"; }` before `RawSurface` (`:1825`), JSDoc: RELOADCMD-D1, what `/claude:plugin
  reload` reports right before Pi reloads; Pi makes the command's context stale once it reloads,
  so the command cannot report after the reload; it carries no field. `RawSurface` gains `|
  ReloadStartedSurface` after `| AutoapplyStatusSurface`.
- `notification-resolve.ts`: `RAW_SURFACE_SEVERITY` gains `"reload-started": "info",` after
  `"autoapply-status"`; `resolveRawSurface` gains `case "reload-started":` in the pass-through
  group (`:745-751`).
- `notification-grammar.ts`: `formatRawSurface` gains `case "reload-started": return undefined;`
  with the comment `// RELOADCMD-D1: Pi's terminal shows its own reload, and it rebuilds the chat
  during the reload, so the text strategy adds nothing.` Move the `mcp-migration` arm's body
  (`:1384-1386`) into a module-private `mcpMigrationArguments(surface: ResolvedMcpMigration):
  NotifyArguments` placed before `formatRawSurface`, so the function keeps fallow's cyclomatic
  limit of 20 when the case is added; the arm becomes `return mcpMigrationArguments(surface);`.
  Extend the JSDoc of `formatRawSurface`: `reload-started` emits nothing too.
- `notification-json.ts`: `wireRawSurface` gains, after the `hook-notice` arm, `case
  "reload-started": return { ...envelope, kind: surface.kind };`.
- `notification-wire.ts`: `RELOAD_STARTED_PAYLOAD = Type.Object({ ...RAW_ENVELOPE_FIELDS, kind:
  Type.Literal("reload-started") }, { additionalProperties: false })` after `HOOK_NOTICE_PAYLOAD`
  (`:915-918`), with a JSDoc (RELOADCMD-D1: the outcome of `/claude:plugin reload`, appended right
  before Pi reloads; Pi answers the prompt after the reload); the union lists it right after
  `HOOK_NOTICE_PAYLOAD`, before the `internal-error` member.
- `notification-dispatch.ts`: `isRawOutcome` gains `case "reload-started":` in the `true` group.
  Add, after `notifyAutoapplyStatus`, `export function notifyReloadStarted(ctx:
  NotificationContext, run: NotificationRun): void` that emits `resolveRawSurface({ kind:
  "reload-started" })`, with a JSDoc in the style of its neighbors. Move the text branch of
  `emitPresentation` (`:624-635`) into a module-private `emitText(ctx, presentation)`: an envelope
  goes to `emitWithSummary`; a raw surface goes to `formatRawSurface`, and only a defined result
  goes to `deliver`, with the comment `// RELOADCMD-D1: reload-started renders no text; the other
  kinds that can render none return before transport selection.` The `eslint-disable` line and the
  non-null assertion go. The case arm becomes `emitText(ctx, presentation); return;`.
- Regenerate `schema/claude-plugin.schema.json` with `npm run schema:generate`.

The wording (Task 2):
- `platform/pi-api.ts`: `NotificationContext` (`:196-200`) gains `readonly hasUI: boolean;` after
  `mode`, JSDoc: Pi's `hasUI`, which `acceptsLaterCommands` reads for the reload rules
  (RELOADCMD-D1).
- `orchestrators/marketplace/background-pass.ts`: the one production literal of the type,
  `SILENT_CONTEXT` (`:107-114`, a print-mode sink whose notices go to the debug log), gains
  `hasUI: false,` after `mode`, with the comment that a silent sink takes no later commands, so
  its debug lines carry no reload hint (RELOADCMD-D1).
- `shared/notification-grammar.ts`: the constant `RELOAD_HINT_TRAILER` (`:1196-1197`) is replaced
  by `function reloadHintTrailer(needsReload: boolean, reload: ReloadCommand | undefined): string`
  returning `` `${reload} to pick up changes` `` when `needsReload && reload !== undefined`, else
  `""`, JSDoc: RELOADCMD-D1, the trailer names the host's reload command, and a one-shot run gets
  none. `formatEnvelopeArguments(envelope, body, reload: ReloadCommand | undefined)` folds
  `reloadHintTrailer(envelope.needsReload, reload)`. `composeBackgroundUpdateText(plugins,
  reload)` builds `const updated = ...updated: ${subject}` and returns `updated` when `reload` is
  undefined, else `` `${updated} · Run ${reload} to apply` ``. `formatRawSurface(surface,
  reload)` passes `reload` to `mcpMigrationArguments` and `composeBackgroundUpdateText`;
  `mcpMigrationArguments(surface, reload)` reads `const trailer =
  reloadHintTrailer(surface.needsReload, reload)` and appends `\n${trailer}` only when it is not
  `""`. Update the mini-spec line `:1178` to `[<reload> to pick up changes]  <-- iff the envelope
  needsReload and the host has a reload to name (RELOADCMD-D1)` and the JSDocs of the three
  functions. Import `type ReloadCommand` from `./session-host.ts`.
- `shared/notification-mcp.ts`: `leftRowLine(row, reload: ReloadCommand | undefined)`; two
  module-private helpers before it, `nextReload(reload, does: string)` returning `""` or
  `` ` The next ${reload} ${does}.` `` and `thenRunReload(reload)` returning `"."` or `` `, then
  run ${reload}.` ``, each with a one-line JSDoc citing RELOADCMD-D1. The `stopped` row ends
  `${sentenceBody(row.detail)}.${nextReload(reload, "tries again")}`, `file-unreadable` ends
  `so nothing in this scope moved. Fix it${thenRunReload(reload)}`, `collision` ends `Remove or
  rename that server${thenRunReload(reload)}`, and `unfinished` ends
  `${sentenceBody(row.detail)}.${nextReload(reload, "finishes the move")}`. With `/reload` every
  row keeps today's bytes. `composeMcpMigrationText(rows, notices, reload)` passes `(row) =>
  leftRowLine(row, reload)` to `titledSection`. Update both JSDocs.
- `shared/notification-dispatch.ts`: `emitWithSummary(ctx, envelope, body, reload)` and
  `emitText(ctx, presentation, reload)` take the command; `emitPresentation` reads the mode once,
  `const mode = requireNotificationMode(ctx.mode);`, switches on `mode`, and its text arm calls
  the prescribed line `emitText(ctx, presentation, reloadCommandFor(mode, ctx));`.
- `orchestrators/skill-invocation.ts`: `SkillInvocationRequest` (`:60-74`) gains `readonly
  reloadCommand: ReloadCommand | undefined;` with a JSDoc (RELOADCMD-D1: the command the refusals
  name to reload, from `reloadCommandFor`; undefined in a one-shot run). `untrustedProjectMessage`
  (`:231-234`) builds `const reload = request.reloadCommand === undefined ? "" : `, then run
  ${request.reloadCommand}`;` and returns `...Trust the project folder${reload} to use it.`.
  `unreadableSkillMessage(request, error)` (was `(typed, error)`, `:236-239`; its caller is
  `:272`) returns `` `Cannot read the skill ${request.typed}: ${errorMessage(error)}.${reload}` ``
  where `reload` is `""` or `` ` Run ${request.reloadCommand} to load the installed skills
  again.` ``. Update the two comments at `:257-266` to say "the next reload".
- `orchestrators/command-invocation.ts`: `CommandInvocationRequest` (`:61-76`) gains the same
  field. Two module-private helpers before `prepareCommand`, `untrustedCommandMessage(request)`
  and `unreadableCommandMessage(request, error)`, build the two refusals (`:276-290`) the way the
  skill helpers do, with `command` and `commands` in place of `skill` and `skills`. Update the
  comments at `:272-283`.
- `edge/skill-aliases.ts` (`:194-203`), `edge/command-invocation.ts` (`commandRequest`,
  `:48-65`), and `edge/command-tool.ts` (`run`, `:111-120`): each request gains the prescribed
  line `reloadCommand: reloadCommandFor(ctx.mode, ctx),`, with the import from
  `../shared/session-host.ts`.

Comments outside `shared/session-host.ts` name the predicates and never Pi's field by a property
access, so the `.hasUI` gate counts code only there.

## Prescribed text

`features/plugin/reload.feature` (Task 1). Its scenarios start at lines 7, 14, 33, and 42. No step
names MCP, so no scenario carries an implementation tag.

```gherkin
Feature: Plugin reload

  Reload makes Pi load plugin changes in a session that takes later commands, as Claude Code's
  /reload-plugins does, and refuses where it cannot (RELOADCMD-D1). The scenarios run the real
  extension in Pi's terminal, over rpc, in a one-shot run in json mode, and with a scripted model.

  Scenario: Reloading in pi's terminal runs pi's own reload
    When the user runs "/claude:plugin reload" in pi's terminal
    Then pi's terminal shows this result of the command:
      """
      Reloaded keybindings, extensions, skills, prompts, themes, and context files
      """

  Scenario: Reloading over rpc reports that the reload started, and the load it runs reports the pending install once
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin reload"
    Then the command reports these results:
      | kind           | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | reload-started | info     | false        |             |                   |                |                |                     |
      | cascade        | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins

  Scenario: Reloading in a one-shot run in json mode is refused, because the next run loads the changes
    When the user runs "/claude:plugin reload" in pi's json mode
    Then the result has these fields:
      | kind         | usage-error                                                                                           |
      | severity     | error                                                                                                 |
      | needs reload | false                                                                                                 |
      | message      | Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes. |
      | usage        |                                                                                                       |

  Scenario: Reloading while the tool of a prompt runs is refused with Claude Code's busy message
    Given pi runs with the scripted model
    Given the scripted model plays these steps:
      | reply | tool | arguments                                 |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      | Done. |      |                                           |
    When the user runs "/claude:plugin reload" while the tool of the prompt "run the echo" runs
    Then the result has these fields:
      | kind         | usage-error                                                                   |
      | severity     | error                                                                         |
      | needs reload | false                                                                         |
      | message      | The session is busy, so plugins were not reloaded. Ask again once it is idle. |
      | usage        |                                                                               |
```

The step for the last scenario, added to `features/step_definitions/command.steps.ts` right after
the `the user runs {string} in pi's terminal` When (`:175-183`), with `promptDisposition` imported
from `../lib/pi-rpc.ts` in sorted place, and one sentence added to the fileoverview (a command can
also run while the tool of a prompt that a profile Pi runs is working, RELOADCMD-D1):

```ts
// A scripted turn starts its tool within a second, and the tool's `sleep 3`
// keeps the run active past the command. The deadline stays below the
// 30-second step timeout, so a run that never starts its tool or never
// settles fails here.
const COMMAND_DURING_RUN_MS = 20_000;

// RELOADCMD-D1: Pi runs an extension command at once, even while a run is
// active, so the command meets the running prompt. The step starts the prompt
// on the profile Pi, waits for its tool to start, runs the command and keeps
// its results, then waits for the run to settle, so every step of the model
// script is used.
When(
  "the user runs {string} while the tool of the prompt {string} runs",
  async function (this: ScenarioWorld, command: string, prompt: string): Promise<void> {
    this.profileHarness();
    const deadline = Date.now() + COMMAND_DURING_RUN_MS;
    const from = this.pi.recordCount();
    const { response } = await this.pi.request({
      type: "prompt",
      message: expandTokens(prompt, this.tokens),
    });
    assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
    await this.pi.waitForRecord(
      from,
      (record) => record.type === "tool_execution_start",
      deadline - Date.now(),
    );
    this.recordResults(
      await runCommandPayloads(this.pi, expandTokens(command, this.tokens)),
      "command",
    );
    const settled = await this.pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      deadline - Date.now(),
    );
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  },
);
```

`features/plugin/help.feature` (Task 1): the `usage` cell of the scenarios at lines 7, 15, and 32
becomes this text (the sessionful usage, `\n` for a line break and `\|` for a pipe, as the file
writes it), and the other cells of each table are padded to the new width:

```text
Usage: /claude:plugin <bootstrap\|install\|uninstall\|prune\|update\|fetch\|reinstall\|list\|ls\|info\|pending\|apply\|autoapply\|enable\|disable\|import\|browse\|reload\|marketplace\|market\|help> ...\n  bootstrap                                          add anthropics/claude-plugins-official to user scope\n  install <plugin>@<marketplace> [--scope user\|project]\n  uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]\n  prune [--scope user\|project] [--dry-run]\n  update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]\n  fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]\n  reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]\n  list [<marketplace>] [--scope user\|project]   (alias: ls)\n  info <plugin>@<marketplace> [--scope user\|project]\n  pending [--scope user\|project]\n  apply [--scope user\|project]\n  autoapply [on\|off] [--scope user\|project] [--local]\n  enable <plugin>@<marketplace> [--scope user\|project] [--local]\n  disable <plugin>@<marketplace> [--scope user\|project] [--local]\n  import [--scope user\|project]\n  browse\n  reload                                             activate pending plugin changes in the current session\n  marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...   (alias: market)\n  help [marketplace]
```

`features/skill/lifecycle.feature:59` and `features/slash-command/invocation.feature:235` (Task 2):
in each `message` cell, the sentence after the error becomes `Run /claude:plugin reload to load
the installed skills again.` and `Run /claude:plugin reload to load the installed commands
again.`, and the other cells of each table are padded to the new width. These scenarios run over
RPC, which has no `/reload`.

`docs/json-output.md` (Task 1, the kind):
- Both jq `outcome` lists (`:34-38`, `:81-85`) gain `"reload-started"` after `"autoapply-status"`,
  with `"internal-error"` kept last, wrapped as the lines around them are.
- `:101`: "The thirteen kinds" becomes "The fifteen kinds", the count of the list.
- `:180`: "from the twenty-four kind sections below" becomes "from the twenty-five kind sections
  below".
- A section right before `#### internal-error` (`:594`):

```markdown
#### reload-started

What `/claude:plugin reload` reports right before Pi reloads (RELOADCMD-D1). Pi makes the command's context stale once it reloads, so the command cannot report after the reload. Pi answers the RPC prompt once the reload is done, and a reload that fails after it started reaches the client as Pi's `extension_error`. Its origin is `command`, severity is always `info`, and `needsReload` is always `false`. A one-shot run and a busy session refuse the command with a `usage-error` instead.

<!-- fields: kind:reload-started -->

<!-- use: common-fields -->

<!-- /fields -->
```

`docs/json-output.md` (Task 3, the hint): the `needsReload` row of Common fields (`:180`) reads
`Whether completed changes need a reload: \`/reload\` in Pi's terminal, \`/claude:plugin reload\`
over RPC. A one-shot run loads them at its next run.`, the table padded; "## Detect reload needs"
(`:137-147`) ends with the sentence `An RPC client that reads \`true\` sends \`/claude:plugin
reload\`, because RPC has no \`/reload\` (RELOADCMD-D1).`

`docs/output-catalog.md` (Task 3; prose and fences in sections the catalog parser skips, so the
counters `EXPECTED_STATE_COUNT` and `EXPECTED_UTF8_BYTES` stay):
- "### Reload-hint trailer" (`:71-77`): `:73` reads `` `notify()` appends `<reload> to pick up
  changes` (with one blank line above the trailer) iff (SNM-33 / D-22-01): ``, and after the two
  bullets comes this paragraph: "`<reload>` is the reload command that the host offers
  (RELOADCMD-D1): `/reload` in Pi's terminal, which has Pi's own `/reload`, and `/claude:plugin
  reload` in another host that takes later commands. A one-shot run (print or json mode) gets no
  trailer, because its next run loads the change. The background update notice and the MCP move
  rows follow the same rule and leave the reload out in a one-shot run. The JSON strategy carries
  `needsReload` in every mode. The blocks in this catalog show the terminal form."
- "## Usage errors" (`:5195-5221`): before "The shared argument parser applies..." add the
  paragraph "`/claude:plugin reload` refuses with an empty usage block in two cases (RELOADCMD-D1).
  A one-shot run (print or json mode) gets the first block. A reload while a prompt runs or Pi
  compacts gets the second, Claude Code's words for its busy refusal." and two `text` fences
  holding the D3 and D1 texts; in that sentence, the list gains `reload` after `browse`.
- A subsection right before `### Stop hook override cap reached (STOP-07 / D-88-01)` (`:5286`):

```markdown
### Reload started (RELOADCMD-D1)

`/claude:plugin reload` emits the `reload-started` kind right before Pi reloads, because Pi makes the command's context stale once it reloads, so the command cannot report after the reload. The text strategy shows nothing: Pi's terminal shows its own reload progress and then `Reloaded keybindings, extensions, skills, prompts, themes, and context files`. Over RPC the payload arrives first, and Pi answers the prompt once the reload is done. Severity `info`; no reload-hint. See [`docs/json-output.md`](json-output.md).
```

`README.md` and `README.es.md` (Task 3; the Spanish copy mirrors the English line for line):
- `README.md:235`: "After you install, uninstall, update, or reinstall plugins, run `/reload`. Then
  Pi discovers the changed resources. If you edit a config by hand, run `/claude:plugin apply`
  before `/reload`." becomes "After you install, uninstall, update, or reinstall plugins, reload
  Pi. Then Pi discovers the changed resources. In Pi's terminal, run `/reload`. Over RPC, which
  has no `/reload`, run `/claude:plugin reload`. A one-shot run, such as `pi -p`, needs no reload,
  because the next run loads the change. If you edit a config by hand, run `/claude:plugin apply`
  before you reload."
- `README.es.md:235`, the same sentences: "Después de instalar, desinstalar, actualizar o
  reinstalar complementos, recarga Pi. Así, Pi detecta los recursos modificados. En la terminal de
  Pi, ejecuta `/reload`. Por RPC, que no tiene `/reload`, ejecuta `/claude:plugin reload`. Una
  ejecución de una sola vez, como `pi -p`, no necesita recarga, porque la siguiente ejecución carga
  el cambio. Si editas una configuración a mano, ejecuta `/claude:plugin apply` antes de recargar."
- After the `/reload` fence that ends at line 436 of both files, one blank line, then the
  paragraph and a fence holding `/claude:plugin reload`. English: "Reload Pi with a command:
  `/claude:plugin reload`. In Pi's terminal, it does what `/reload` does. Over RPC, which has no
  `/reload`, it is how you reload. A one-shot run refuses it, because its next run loads the
  changes. While Pi works on a prompt, the command refuses and reloads nothing. Run it again when
  the prompt is done." Spanish: "Recarga Pi con un comando: `/claude:plugin reload`. En la
  terminal de Pi, hace lo mismo que `/reload`. Por RPC, que no tiene `/reload`, es la forma de
  recargar. Una ejecución de una sola vez lo rechaza, porque su siguiente ejecución carga los
  cambios. Mientras Pi trabaja en un prompt, el comando lo rechaza y no recarga nada. Ejecútalo de
  nuevo cuando el prompt termine."

The compatibility pages and the messaging guide (Task 3):
- `docs/hooks-compatibility.md:135`: the first cell becomes `` `/reload`, `/claude:plugin reload` ``
  and the last cell gains, after its first sentence, "`/claude:plugin reload` runs the same Pi
  reload (RELOADCMD-D1)."; `:157` becomes "- On a `/reload` or a `/claude:plugin reload`, as
  Claude Code's `/reload-plugins` runs none (D-CF5-03)."
- `docs/skills-commands-compatibility.md:149`: the Pi cell becomes "`✓` a change takes effect in a
  new session after `/reload` in Pi's terminal or `/claude:plugin reload` over RPC
  (RELOADCMD-D1)"; `:150`: the first cell becomes "A file removed before a reload" and the Pi cell
  "`✓` the invocation reports the missing file and names the reload command the host offers:
  `/reload` in Pi's terminal, `/claude:plugin reload` over RPC, and none in a one-shot run
  (RELOADCMD-D1)".
- `docs/mcp-compatibility.md`: right after the sentence that introduces the left-in-place table
  ("Some entries cannot move. ... (AMIG-01, AMIG-04):", near `:695`), insert one paragraph before
  the table: "In Pi's terminal the notice names `/reload`. A one-shot run leaves the reload
  instruction out, because its next run tries again, and RPC gets the rows as data
  (RELOADCMD-D1)."
- `docs/messaging-style-guide.md:91`: "`notify()` appends `/reload to pick up changes`" becomes
  "`notify()` appends `<reload> to pick up changes`, where `<reload>` is `/reload` in Pi's
  terminal and `/claude:plugin reload` in another host that takes later commands, and a one-shot
  run gets none (RELOADCMD-D1),".

Every table that a cell edit widens is padded again on all its rows.

The decision row (Task 3), one new line 2544 of `.planning/PROJECT.md`, right after the
HOOKLATESS-D1 row (`:2543`) and before the blank line above `## Evolution`:

```markdown
| **RELOADCMD-D1 (quick task 261123-qru, maintainer decisions 1 to 4 of 2026-11-23 in `research/HEADLESS-RELOAD.md`): `/claude:plugin reload`, the sessionful predicate, and the reload wording**: `acceptsLaterCommands(host)` (`shared/session-host.ts`) returns Pi's `hasUI` and is the only check of whether this Pi process takes later commands: the terminal and RPC bind a UI, print and json bind none, and a future long-lived host without dialogs reads false, the safe direction. `/claude:plugin reload` runs `ctx.reload()` only where it holds. A one-shot run refuses it with `Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes.`, and its help and completions leave it out; completions read the answer of the last `session_start`, because Pi gives the completion callback no context. While a run streams or Pi compacts (`ctx.isIdle()` false), the command refuses with Claude Code's busy words, `The session is busy, so plugins were not reloaded. Ask again once it is idle.`. Pi gap: Pi cannot reload then, where Claude Code's default serves the reload in the turn. Pi makes the command's context stale once it reloads, so the command emits the outcome `reload-started` first and the registration calls `ctx.reload()` after the command settled and the foreground runner returned. Pi gap: no context survives the reload, so the command prints no `Reloaded: <counts>` line as Claude Code's `/reload-plugins` does, and Pi's terminal shows its own reload status instead. The command takes no argument, because `--force` only skips a prompt-cache check that Pi does not make. The reload hint follows the predicate: a one-shot run gets no hint text, and the JSON and RPC payloads keep `needsReload` in every mode. Every instruction to reload names the command `reloadCommandFor(mode, host)` picks: `/reload` where the host has Pi's own `/reload`, only the terminal (`modes/interactive/interactive-mode.js:2762`), checked first because the terminal always binds a UI; `/claude:plugin reload` in another host that takes later commands; none in a one-shot run, where a reload sentence is left out. D-CF5-03 stays: the command runs Pi's reload, which runs no session hook. | Claude Code 2.1.330: `/reload-plugins` (@325359447), its `Reloaded:` line (@339454145), its remote decline (@339452313, `Ae` @339454863), the SDK busy refusal (@352166769), and the interactive-only notice (@347950235); Pi 1.5.1 `core/agent-session.js:1131-1133`, `:1702-1711`, `:3094-3100`, `core/extensions/runner.js:403-405`, `:482-491`, `modes/interactive/interactive-mode.js:2762`, `:5482-5556`, `docs/extensions.md:1514-1540`; see `research/HEADLESS-RELOAD.md` and `quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/`. | -- Locked |
```

## The break files

Each is a JSON array of `[file, old, new]` triples, `file` relative to
`extensions/pi-claude-marketplace/`, written by Task 1, step 1. Each old text occurs once in its
file at the bound commit.

- `R0.json`, `R1.json`: `[]` (the natural red runs on the code without the change).
- `B1.json`: `[["edge/register.ts", "await ctx.reload();", "await Promise.resolve();"]]` (the
  command never reloads).
- `B2.json`: `[["shared/session-host.ts", "return host.hasUI;", "return true;"]]` (every host takes
  later commands).
- `B3.json`: `[["edge/handlers/plugin/reload.ts", "if (!ctx.isIdle()) {", "if (false) {"]]` (no
  busy check).
- `B4.json`: `[["shared/session-host.ts", "return host.hasUI;", "return false;"]]` (no host takes
  later commands).
- `B5.json`: `[["shared/session-host.ts", "return mode === \"tui\";", "return true;"]]` (every
  host has Pi's own `/reload`).
</context>

## Scope note

One plan, three tasks, six commits. The coupling of the command surface sets the size of the
tracer commit: the router inventory, the flag catalog, its drift guard (every verb needs exactly
one usage line), the help text, the completions, the argument-rejection inventory of the register
suite, the new outcome kind (its payload schema, the committed JSON schema, and the JSON guide that
`json-output-docs.test.ts` reads), and `isRawOutcome`'s exhaustive switch all change together, or
the commit hook fails. C0, a refactor of browse's argument check, goes first so that the tracer's
argument check forms no clone group. Task 2 splits the wording into the notification text (C2)
and the refusals (C3), each with its own tests. Task 3 commits the docs, which include the two
build-input docs, and then the decision row.

## Execution rules

- `$S` is `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad`.
  This plan's folder is `$D` = `$S/quick-261123-qru`, a direct child of `$S`, so `break.sh`,
  copied into it, finds `$S/nondac-sh` and `$S/phase07-heavy.lock` in its parent. Never write to
  another folder of `$S`, and never run a file there.
- Run every command from the root of this plan's own checkout (`git rev-parse --show-toplevel`);
  every repository path here is relative to it. Never read, write, or run tests in another
  checkout.
- Put this prefix before every npm script: `npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144`. Run unit files in a minimal environment:
  `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import
  \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec <files>"`. Run direct
  coverage as `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp CI=1
  npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run
  test:coverage:direct -- <source or test path>`, one pair per run.
- Cucumber needs `fd`: put `$S/gate-bin` first on `PATH` for every cucumber run and every
  `check:static` (`check:features` dry-runs the scenarios). Run every cucumber run, the ESLint
  warm-up, every `check:static`, every suite run, and every commit under `flock -w 3600
  "$S/phase07-heavy.lock"`, and pass `--parallel 2` right after `--profile <name>`. `break.sh`
  takes the lock and `--parallel 2` itself.
- Pass a tool's own flags through `npx` only after `--` (`npx --no -- fallow dupes`).
- A cucumber run whose only failures are cucumber step timeouts is evidence of nothing: rerun it
  and keep the rerun's log. Decide a run by its exit status and the log it wrote; never pipe a
  check into `tail`, `head`, or `grep` to judge it. A `node --test` log is read by its ` tests `,
  ` pass `, and ` fail ` lines.
- A command that can outlast the tool's foreground limit (`check:static`, a suite, a cucumber run
  with a terminal scenario, a commit whose hook runs all pairs) runs with the tool's background
  option; wait for its completion notification and never poll with `sleep`.
- Warm ESLint with one lone `npm run lint` under the lock before the first `check:static`.
- When the shell guard refuses a one-line command that calls `git` inside `$(...)`, write it
  verbatim into a script under `$D`, run it with `bash`, and keep the script for the SUMMARY.
- Stage by explicit path only; never `git add -A`, `git add .`, or `git commit -a`. Before each
  commit no untracked file under `features/`, `extensions/`, or `test/` may be present that the
  commit does not stage, because the hook dry-runs every scenario and stashes only tracked edits.
  Commit with `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144 PATH="$S/gate-bin:$PATH" git commit -F <message file>`
  and let the whole hook run. Do not run the pre-commit tool by hand with a skip list, never set
  or change `SKIP` (the session's exported `SKIP=trufflehog` stays as it is), and never use
  `--no-verify`, `--amend`, a rebase, `git stash`, a push, or a commit on `main`. When a fixer
  hook changes a file, the commit fails: restage that file and commit again. Inside a worktree the
  hook may check nothing, so each code commit is preceded by its own `check:static` run and its
  pairs' direct coverage; the orchestrator's post-merge `npm run check` is the full verdict.
- Commit messages follow `.agents/skills/committing/SKILL.md`: the exact titles of the tasks, no
  quick id, decision id, milestone, phase, plan, wave, or task in the title or scope, body lines
  of at most 80 characters, and the attribution lines of your session's instructions at the end.
  Right after each commit, write `git rev-parse HEAD` to its file under `$D`: `c0-commit`,
  `fix-commit`, `hint-commit`, `bound-commit`, `docs-commit`, `decision-commit`.
- `break.sh` refuses to run while `extensions/` is dirty; every red or break run happens on a tree
  whose `extensions/` is clean.
- Edit only the files in `files_modified`, plus any other test double that the type check or a
  failing suite names in Task 2 (record each such file in the SUMMARY). Do not edit
  `CHANGELOG.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/BACKLOG.md`,
  `cucumber.json`, `.fallowrc.json`, `scripts/**`, a CI workflow, a skill rule, `features/support/**`,
  or another step module than `command.steps.ts`. In `.planning/PROJECT.md`, add only the decision
  row. A line meant for another file goes under "For the orchestrator" in the SUMMARY.
- Add no suppression marker (`fallow-ignore`, `eslint-disable`), no coverage exception, and no
  `.fallowrc.json` entry. If fallow reports an export as unused or a clone group, change the code,
  never the config, and record it in the SUMMARY.
- Comments and test titles cite RELOADCMD-D1 and other durable IDs, never a quick id or a plan
  step. Comments outside `shared/session-host.ts` never write Pi's field as a property access.
- Rule 4. If a scenario or a unit case outside this plan's own fails on a tree of this plan and
  this plan's change does not explain it, stop and report it with the log.

## Red proofs

`check-red.mjs` reads these tables, one set per prefix. `r0-` is the natural red on today's code
(Task 1), `r1-` the natural red of the refusal wording on the code of Task 1 (Task 2), and `fix-`
the breaks on the bound commit (Task 2).

<!-- r0-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| R0 | adapter | 7 | features/plugin/reload.feature features/plugin/help.feature:7 features/plugin/help.feature:15 features/plugin/help.feature:32 |
<!-- r0-break-runs:end -->

<!-- r0-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| R0 | adapter | features/plugin/reload.feature | Reloading in pi's terminal runs pi's own reload | |
| R0 | adapter | features/plugin/reload.feature | Reloading over rpc reports that the reload started, and the load it runs reports the pending install once | |
| R0 | adapter | features/plugin/reload.feature | Reloading in a one-shot run in json mode is refused, because the next run loads the changes | |
| R0 | adapter | features/plugin/reload.feature | Reloading while the tool of a prompt runs is refused with Claude Code's busy message | |
| R0 | adapter | features/plugin/help.feature | Help shows the plugin usage | |
| R0 | adapter | features/plugin/help.feature | Help for the help topic shows the plugin usage | |
| R0 | adapter | features/plugin/help.feature | An unknown plugin subcommand shows the plugin usage with a reason | |
<!-- r0-must-fail:end -->

<!-- r1-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| R1 | adapter | 2 | features/skill/lifecycle.feature:50 features/slash-command/invocation.feature:216 |
<!-- r1-break-runs:end -->

<!-- r1-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| R1 | adapter | features/skill/lifecycle.feature | Invoking a skill that an uninstall removed before a reload reports the missing file | |
| R1 | adapter | features/slash-command/invocation.feature | Invoking a command that an uninstall removed before a reload reports the missing file | |
<!-- r1-must-fail:end -->

<!-- fix-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| B1 | adapter | 2 | features/plugin/reload.feature:7 features/plugin/reload.feature:14 |
| B2 | adapter | 1 | features/plugin/reload.feature:33 |
| B3 | adapter | 1 | features/plugin/reload.feature:42 |
| B4 | adapter | 4 | features/plugin/help.feature:7 features/plugin/help.feature:15 features/plugin/help.feature:32 features/plugin/reload.feature:14 |
| B5 | adapter | 2 | features/skill/lifecycle.feature:50 features/slash-command/invocation.feature:216 |
<!-- fix-break-runs:end -->

<!-- fix-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| B1 | adapter | features/plugin/reload.feature | Reloading in pi's terminal runs pi's own reload | |
| B1 | adapter | features/plugin/reload.feature | Reloading over rpc reports that the reload started, and the load it runs reports the pending install once | |
| B2 | adapter | features/plugin/reload.feature | Reloading in a one-shot run in json mode is refused, because the next run loads the changes | |
| B3 | adapter | features/plugin/reload.feature | Reloading while the tool of a prompt runs is refused with Claude Code's busy message | |
| B4 | adapter | features/plugin/help.feature | Help shows the plugin usage | |
| B4 | adapter | features/plugin/help.feature | Help for the help topic shows the plugin usage | |
| B4 | adapter | features/plugin/help.feature | An unknown plugin subcommand shows the plugin usage with a reason | |
| B4 | adapter | features/plugin/reload.feature | Reloading over rpc reports that the reload started, and the load it runs reports the pending install once | |
| B5 | adapter | features/skill/lifecycle.feature | Invoking a skill that an uninstall removed before a reload reports the missing file | |
| B5 | adapter | features/slash-command/invocation.feature | Invoking a command that an uninstall removed before a reload reports the missing file | |
<!-- fix-must-fail:end -->

What each break proves: B1, the terminal shows no reload status and the RPC run reports only
`reload-started`, because Pi never reloads; B2, the json run starts a reload instead of refusing;
B3, the busy run calls `ctx.reload()`, which Pi rejects, so the When sees Pi's `extension_error`;
B4, RPC help leaves `reload` out and the RPC reload refuses; B5, RPC refusals name Pi's own
`/reload`, which RPC lacks.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Add /claude:plugin reload end to end, test first: the refactor commit, then the command commit</name>
  <precondition>$S/nondac-sh is executable, $S/gate-bin/fd exists, `flock` is on PATH, $S/fix-07b/break.sh and $S/fix-07b/check-red.mjs exist, node_modules/.package-lock.json exists, `jq` is on PATH (json-output-docs.test.ts runs it), and `git diff --quiet 98ada0c HEAD -- extensions/ features/ test/ docs/ schema/ README.md README.es.md` exits 0, so the line numbers and break sites of this plan apply.</precondition>
  <reversibility rating="costly">The `reload-started` kind enters the published payload schema (schemaVersion 1 stays, as a new kind allows); a revert removes a kind that RPC clients may have started to read.</reversibility>
  <files>extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts, test/edge/handlers/plugin/shared.test.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts, features/plugin/reload.feature, features/plugin/help.feature, features/step_definitions/command.steps.ts, features/lib/plugin-completions.ts, extensions/pi-claude-marketplace/shared/session-host.ts, test/shared/session-host.test.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts, test/edge/handlers/plugin/reload.test.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts, test/edge/handlers/plugin/help.test.ts, extensions/pi-claude-marketplace/edge/router.ts, test/edge/router.test.ts, extensions/pi-claude-marketplace/edge/register.ts, test/edge/register.test.ts, extensions/pi-claude-marketplace/edge/completions/provider.ts, test/edge/completions/provider.test.ts, extensions/pi-claude-marketplace/edge/flag-catalog.ts, test/architecture/flag-catalog-drift.test.ts, extensions/pi-claude-marketplace/shared/notification-types.ts, test/shared/notification-types.test.ts, extensions/pi-claude-marketplace/shared/notification-resolve.ts, test/shared/notification-resolve.test.ts, extensions/pi-claude-marketplace/shared/notification-grammar.ts, test/shared/notification-grammar.test.ts, extensions/pi-claude-marketplace/shared/notification-json.ts, test/shared/notification-json.test.ts, extensions/pi-claude-marketplace/shared/notification-wire.ts, test/shared/notification-wire.test.ts, extensions/pi-claude-marketplace/shared/notification-dispatch.ts, test/shared/notification-dispatch.test.ts, schema/claude-plugin.schema.json, docs/json-output.md, test/architecture/json-output-docs.test.ts, test/architecture/wire-schema.test.ts, test/architecture/catalog-uat/catalog-wire.test.ts</files>
  <behavior>
    - Scenarios `features/plugin/reload.feature:7`, `:14`, `:33`, `:42` and the three help scenarios fail on today's code (R0) and pass after the commit.
    - `rejectArguments` (shared, 3 cases): passes an empty argument text through and emits nothing; names the first flag of `surplus --bogus` as `Unknown flag: "--bogus".` with the usage; refuses `extra` with the verb's surplus message and the usage.
    - `acceptsLaterCommands` (session-host, 2 cases): true for a host with a UI; false for a host without one.
    - `makeReloadHandler` (reload, 6 cases, titles end `(RELOADCMD-D1)`): a host without a UI gets the one-shot refusal with an empty usage, and `isIdle` and the port are never called; an unknown flag gets `Unknown flag:` with the reload usage; a surplus argument gets `reload takes no arguments.`; a busy session gets Claude Code's busy refusal with an empty usage and no request; an idle rpc session appends one `reload-started` outcome and then requests one reload of its own context; an idle terminal session emits no notify call and requests one reload.
    - Kind rows: the `ReloadStartedSurface` type proof (types); severity `info` and pass-through resolve (resolve); `formatRawSurface` gives `undefined` (grammar); the wire payload is `{schemaVersion: 1, kind: "reload-started", origin, severity: "info", needsReload: false}` (json); the schema accepts a command-origin payload and rejects one with an extra field (wire); `notifyReloadStarted` delivers nothing in the terminal and appends the outcome over rpc, which settles `hasOutcome` (dispatch); 25 schema members in order, `reload-started` right before `internal-error` (wire-schema); the preparation recognizes `reload-started` (json-output-docs); the raw-kind tables of `catalog-wire.test.ts` gain a `reload-started` entry (catalog-wire).
    - Router rows: the vocabulary lists `reload` after `browse`; `reload` selects `plugin reload` and the `reload` handler; `topLevelUsage` with a UI holds the `|reload` spelling and the reload line, and without one equals today's usage bytes; an unknown subcommand gets the usage of its host, and only that arm reads it.
    - Help rows: the top-level topic sends the sessionful usage for a host with a UI and the one-shot usage for a host without one; the marketplace topic and the errors read no host.
    - Provider rows: TC-1 offers `reload` after `browse` when `laterCommands` is true and leaves it out when false; `reload -` offers no flag; every other case passes `true`.
    - Register rows: a registered `reload` over rpc logs `enter`, `append`, `exit`, `reload` in that order, resolves with a context whose getters throw after the reload, and appends the one `reload-started` payload; a busy registered reload appends the busy refusal and never calls `ctx.reload()`; a registered `help` never calls `ctx.reload()`; completions leave `reload` out before any session start and after one whose host has no UI, and offer it after one with a UI; the argument-rejection inventory gains the `reload` row (surplus `reload takes no arguments.`, scopeless), whose cases state one host read.
    - Drift rows: `reload` is a catalog verb with no flag, no completion beyond nothing, and one usage line in the sessionful usage.
  </behavior>
  <action>
    Follow "Design, file by file", "Prescribed text", and the execution rules. Order matters: R0
    runs while `extensions/` holds today's behavior, and no untracked feature file may exist while
    C0 commits.

    1. Create `$D` and `$D/brk`; write `git rev-parse HEAD` to `$D/plan-base`; copy
       `$S/fix-07b/break.sh` and `$S/fix-07b/check-red.mjs` into `$D` unchanged; write the seven
       break files of "The break files" into `$D/brk`.

    2. C0, test first. Add the three `rejectArguments` cases to
       `test/edge/handlers/plugin/shared.test.ts` with the strict boundary
       (`createNotificationBoundary`); run that file before the helper exists and keep the failing
       log as `$D/red-unit-shared.log`. Add `rejectArguments` to `shared.ts` and use it in
       `browse.ts`. Run `shared.test.ts` and `browse.test.ts`, the direct coverage of both pairs,
       and `check:static`. Commit those three files with the title `refactor(plugin): share the
       no-argument check of browse` and record `c0-commit`.

    3. Write `features/plugin/reload.feature` as prescribed, the three help usage cells, and the
       step in `command.steps.ts`. Run `PATH="$S/gate-bin:$PATH" node scripts/check-features.mjs`
       (exit 0; it reports no undefined or unused step).

    4. R0, with `extensions/` at C0: `PATH="$S/gate-bin:$PATH" bash "$D/break.sh" R0 adapter
       "$D/brk/R0.json" features/plugin/reload.feature features/plugin/help.feature:7
       features/plugin/help.feature:15 features/plugin/help.feature:32`, then `node
       "$D/check-red.mjs" <this plan> "$D" <checkout root> "$(cat "$D/plan-base")" r0-`, which
       must print `RED-PROOFS OK`. In `$D/R0-adapter.log`, the terminal scenario fails in its
       Then after waiting for the status row, and the other six fail in their Then on a different
       kind, message, or usage. A failure in a Given, or anywhere else, means the scenario is
       wrong: fix it, rerun R0, and record the change.

    5. Unit tests first. Write `test/shared/session-host.test.ts` (2 cases) and
       `test/edge/handlers/plugin/reload.test.ts` (6 cases), and add the kind, router, help,
       provider, register, and drift rows of the behavior list to their files. Run the two new
       files before their modules exist and keep `$D/red-unit-session-host.log` and
       `$D/red-unit-reload.log`. The reload cases use a strict context
       (`mock<ExtensionCommandContext>`) that states every read: `hasUI` once, `isIdle()` once on
       the paths that reach it, and the notification reads of the emission; the port is a
       recording function. The register reload case uses a plain context whose `reload` pushes
       `reload` to the log and then makes the `mode`, `hasUI`, and `ui` getters throw, in the form
       of the foreground-runner case at `register.test.ts:1727-1777`. A strict double that this
       change makes read the host states that read: the help top-level cases, the router's
       unknown-subcommand cases, the reload row of the argument-rejection inventory
       (`:3544-3750`), and the autocomplete wrapper's session start (`:1855-1885`). Replace the
       `EXPECTED_TOP_LEVEL_USAGE` constants of `router.test.ts` and `register.test.ts` by the two
       byte forms, sessionful and one-shot, and read `topLevelUsage({ hasUI: true })` in the drift
       guard's `usageLineFor`.

    6. Make the kind (notification types, resolve, grammar, json, wire, dispatch), regenerate the
       schema, and edit `docs/json-output.md` as prescribed. Then make `session-host.ts`
       (`SessionHost` and `acceptsLaterCommands` only), `reload.ts`, the router, help, flag
       catalog, provider, and register changes, and pass `true` as the fourth argument in
       `features/lib/plugin-completions.ts`, with the comment that Pi asks for argument
       completions only in its terminal, which takes later commands (RELOADCMD-D1).

    7. Run every touched test file, then the direct coverage of each of the 13 changed source
       pairs (session-host, reload, help, router, register, provider, flag-catalog,
       notification-types, notification-resolve, notification-grammar, notification-json,
       notification-wire, notification-dispatch), `npm run test:unpaired`, and `check:static`.
       Each must pass with no change to the gates.

    8. Cucumber, adapter then builtin, each one run: `features/plugin/reload.feature
       features/plugin/help.feature features/plugin/browse.feature
       features/marketplace/market-alias.feature features/plugin/list.feature
       features/mcp-server/verdict-list.feature`. If the terminal scenario fails only because Pi's
       status row reads differently (for example with `; saved project trust` after it), set the
       doc string to the row Pi printed and record it; any other failure is a defect to fix.

    9. Stage the files of this task except the three C0 files and commit with the title
       `feat(plugin): add /claude:plugin reload`; record `fix-commit`. The body says what the
       command does in each host, why it reports `reload-started` before Pi reloads, and that the
       registration reloads after the command settled.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qru; R=$(git rev-parse --show-toplevel) && B=$(cat "$D/plan-base") && node "$D/check-red.mjs" .planning/quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/261123-qru-PLAN.md "$D" "$R" "$B" r0- # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: R0's log is missing, dirty, timed out, or a must-fail scenario passed or failed outside a When or a Then</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; flock -w 3600 "$S/phase07-heavy.lock" env PATH="$S/gate-bin:$PATH" npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/reload.feature features/plugin/help.feature features/plugin/browse.feature features/marketplace/market-alias.feature features/plugin/list.feature features/mcp-server/verdict-list.feature</automated>
    <fails_when>non-zero exit: a reload, help, browse, or completion scenario fails under the adapter profile</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; flock -w 3600 "$S/phase07-heavy.lock" env PATH="$S/gate-bin:$PATH" npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run check:static</automated>
    <fails_when>non-zero exit: typecheck, ESLint, fallow (dead code, health, dupes, zones), Prettier, pairing, or the feature-file check fails</fails_when>
    <automated>E=extensions/pi-claude-marketplace; grep -q '^export function acceptsLaterCommands(host: SessionHost): boolean {$' $E/shared/session-host.ts && grep -qF '["reload", { commandId: "plugin reload", handler: "reload" }],' $E/edge/router.ts && grep -qF '.then(() => reloadWhenRequested(reloadRequests, ctx));' $E/edge/register.ts && grep -qF 'await ctx.reload();' $E/edge/register.ts && grep -qF '    if (!ctx.isIdle()) {' $E/edge/handlers/plugin/reload.ts && grep -qF 'kind: Type.Literal("reload-started")' $E/shared/notification-wire.ts && h=$(grep -rn '\.hasUI' $E --include=*.ts | grep -v "^$E/shared/session-host.ts:" | grep -cvE ':[0-9]+:\s*(//|\*)'); test "$h" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a prescribed line is missing, or a file other than shared/session-host.ts reads Pi's host field in code (the six presence checks fail at 98ada0c, where session-host.ts does not exist)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qru; C=$(cat "$D/c0-commit") && t=$(git show -s --format=%s "$C") && test "$t" = "refactor(plugin): share the no-argument check of browse" && g=$(git show --name-only --format= "$C") && test "$(printf '%s\n' "$g" | LC_ALL=C sort | tr '\n' ' ')" = "extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts test/edge/handlers/plugin/shared.test.ts " && F=$(cat "$D/fix-commit") && tf=$(git show -s --format=%s "$F") && test "$tf" = "feat(plugin): add /claude:plugin reload" && p=$(git rev-parse "$F~1") && test "$p" = "$C" && gf=$(git show --name-only --format= "$F") && printf '%s\n' "$gf" | grep -qx features/plugin/reload.feature && st=$(git status --porcelain -- extensions/ features/ test/ schema/ docs/) && test -z "$st" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a commit file is missing, a title differs, C0 holds another file, the command commit does not follow C0 or lacks the feature file, a git call fails, or a tracked change is left uncommitted</fails_when>
  </verify>
  <done>`/claude:plugin reload` reloads Pi in the terminal and over RPC, reports `reload-started` over RPC before Pi reloads, refuses in a one-shot run and while a run is active, and is left out of one-shot help and completions; R0 is logged and passes `check-red.mjs`; the seven scenarios pass; `check:static` and the pairs' coverage pass; C0 and the command commit are recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Word every reload instruction through one place, test first, then prove the scenarios with five breaks</name>
  <precondition>`$D/fix-commit` names HEAD, and `extensions/` is clean.</precondition>
  <reversibility rating="reversible">The change only rewords text and adds one context field the extension reads; no stored format changes.</reversibility>
  <files>features/skill/lifecycle.feature, features/slash-command/invocation.feature, extensions/pi-claude-marketplace/shared/session-host.ts, test/shared/session-host.test.ts, extensions/pi-claude-marketplace/platform/pi-api.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts, test/orchestrators/marketplace/background-pass.test.ts, extensions/pi-claude-marketplace/shared/notification-dispatch.ts, test/shared/notification-dispatch.test.ts, extensions/pi-claude-marketplace/shared/notification-grammar.ts, test/shared/notification-grammar.test.ts, extensions/pi-claude-marketplace/shared/notification-mcp.ts, test/shared/notification-mcp.test.ts, extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts, test/orchestrators/skill-invocation.test.ts, extensions/pi-claude-marketplace/orchestrators/command-invocation.ts, test/orchestrators/command-invocation.test.ts, extensions/pi-claude-marketplace/edge/skill-aliases.ts, test/edge/skill-aliases.test.ts, extensions/pi-claude-marketplace/edge/command-invocation.ts, test/edge/command-invocation.test.ts, extensions/pi-claude-marketplace/edge/command-tool.ts, test/edge/command-tool.test.ts, and the test doubles that the type check or a suite names (the test files of files_modified are the expected set)</files>
  <behavior>
    - Scenarios `features/skill/lifecycle.feature:50` and `features/slash-command/invocation.feature:216` fail on the code of Task 1 (R1) and pass after C3.
    - `reloadCommandFor` (session-host, 4 cases): `tui` with a UI gives `/reload`; `rpc` with a UI gives `/claude:plugin reload`; `print` and `json` without a UI give undefined; a `tui` host whose UI read would throw still gives `/reload` (the terminal reads no UI).
    - Grammar rows: an envelope that needs a reload gets `/reload to pick up changes` with `/reload`, `/claude:plugin reload to pick up changes` with the extension's command, and no trailer with none; the background update ends ` · Run <command> to apply` with a command and has no tail without one; the migration notice that needs a reload ends with the trailer line only when a command is given.
    - MCP rows: each of the four left-row kinds keeps today's bytes with `/reload`, names `/claude:plugin reload` in its place, and with no command drops `The next ... ` and turns `, then run ...` into a full stop.
    - Dispatch rows: a print emission of a cascade that needs a reload has no trailer and reads one host field; a terminal emission keeps the `/reload` trailer and reads none; a json emission keeps `needsReload: true`.
    - Orchestrator rows: each of the four refusals (skill and command, untrusted and unreadable) names `/reload`, names `/claude:plugin reload`, and has no reload sentence with no command; `run_plugin_command` refusals follow the same rule.
    - Edge rows: the skill, command, and command-tool requests carry `reloadCommand` from their context: `/reload` for a terminal context, `/claude:plugin reload` for an rpc context, and undefined for a json context.
  </behavior>
  <action>
    1. In `features/skill/lifecycle.feature:59` and `features/slash-command/invocation.feature:235`,
       write the prescribed message cells. R1, with `extensions/` at the command commit:
       `PATH="$S/gate-bin:$PATH" bash "$D/break.sh" R1 adapter "$D/brk/R1.json"
       features/skill/lifecycle.feature:50 features/slash-command/invocation.feature:216`, then
       `check-red.mjs` with the prefix `r1-` (`RED-PROOFS OK`). Both fail in their Then on the
       message cell; any other failure means a wrong cell: fix it and rerun.

    2. C2, test first: add the session-host, grammar, mcp, and dispatch rows; run them before the
       code and keep `$D/red-unit-hint.log`. Then make the C2 part of "The wording":
       `session-host.ts` (`hasNativeReload`, `ReloadCommand`, `reloadCommandFor`), the `hasUI`
       field of `NotificationContext` and of `SILENT_CONTEXT`, the grammar, the mcp text, and the
       dispatch text branch.
       Run `npm run typecheck`; each object literal that the type check names as a
       `NotificationContext` without the field gets `hasUI` with Pi's value for its mode (`tui` and
       `rpc` true, `print` and `json` false). Then run `npm run test:modules`, `npm run
       test:unpaired`, and `npm run test:integration`. Two failures are expected and fixed in the
       test: a case whose print emission no longer carries a reload trailer or sentence changes
       its expectation to the one-shot form, a one-shot run gets no reload hint (RELOADCMD-D1),
       and its double states `hasUI: false`; a strict double (`strong-mock`) whose print-mode
       text emission now makes the one host read states it, returning false. A terminal emission
       reads no host field, so a terminal double needs no change. Any other failure is a defect of
       this change: fix the code, not the expectation. Record every test file this step touched.

    3. Run the direct coverage of `session-host`, `notification-grammar`, `notification-mcp`,
       `notification-dispatch`, `platform/pi-api`, and `orchestrators/marketplace/background-pass`,
       and of each other pair whose test changed in step 2, and `check:static`. Stage the C2
       files and the doubles (not the two feature files) and commit with the title
       `fix(notify): word reload hints for the host that shows them`; record `hint-commit`.

    4. C3, test first: add the orchestrator and edge rows (the request builders of the four test
       files default `reloadCommand` to `/reload`); run them before the code and keep
       `$D/red-unit-refusals.log`. Make the C3 part of "The wording": the two request fields and
       refusal helpers and the three edge request lines. Run the five test files, their pairs'
       direct coverage, and `check:static`.

    5. Cucumber, adapter then builtin, each one run: `features/skill/lifecycle.feature
       features/slash-command/invocation.feature features/plugin/reload.feature
       features/marketplace/background-update.feature features/plugin/browse.feature
       features/skill/project-trust.feature features/slash-command/lifecycle.feature`.

    6. Stage the C3 files and the two feature files and commit with the title `fix(plugin): name
       a reload command the host offers in refusals`; record `bound-commit`.

    7. The breaks, on the bound commit with `extensions/` clean, one at a time: `bash
       "$D/break.sh" <id> adapter "$D/brk/<id>.json" <files>` for B1 to B5 with the files of the
       `fix-break-runs` table, each with `$S/gate-bin` first on `PATH`. Then `check-red.mjs` with
       the prefix `fix-` (`RED-PROOFS OK`), and `git status --porcelain -- extensions/` prints
       nothing. If a break's old text no longer occurs once, the code differs from this plan:
       rewrite only that break file to the same effect, say "rewrote a break" in the SUMMARY with
       the reason, and run it.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qru; P=.planning/quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/261123-qru-PLAN.md; R=$(git rev-parse --show-toplevel) && B=$(cat "$D/plan-base") && node "$D/check-red.mjs" "$P" "$D" "$R" "$B" r1- && node "$D/check-red.mjs" "$P" "$D" "$R" "$B" fix- && st=$(git status --porcelain -- extensions/) && test -z "$st" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: an R1 or break log is missing, dirty, or timed out, a must-fail scenario passed or failed outside a When or a Then, a git call fails, or extensions/ is left dirty</fails_when>
    <automated>E=extensions/pi-claude-marketplace; n=$(grep -nE '(Run|run|next) /reload|"/reload to pick up' $E/shared/notification-grammar.ts $E/shared/notification-mcp.ts $E/orchestrators/skill-invocation.ts $E/orchestrators/command-invocation.ts | grep -cvE ':[0-9]+:\s*(//|\*)'); test "$n" -eq 0 # [HEAD=10 EXPECT==0 @98ada0c]</automated>
    <fails_when>non-zero exit: one of the eight listed sites (or the grammar trailer constant) still words its own reload command in code</fails_when>
    <automated>E=extensions/pi-claude-marketplace; l=$(grep -rlE '"/claude:plugin reload"|"/reload"' $E --include=*.ts) && test "$l" = "$E/shared/session-host.ts" && grep -q 'mode === "tui"' $E/shared/session-host.ts && grep -qF 'emitText(ctx, presentation, reloadCommandFor(mode, ctx));' $E/shared/notification-dispatch.ts && grep -qF 'reloadCommand: reloadCommandFor(ctx.mode, ctx),' $E/edge/skill-aliases.ts && grep -qF 'reloadCommand: reloadCommandFor(ctx.mode, ctx),' $E/edge/command-invocation.ts && grep -qF 'reloadCommand: reloadCommandFor(ctx.mode, ctx),' $E/edge/command-tool.ts && h=$(grep -rn '\.hasUI' $E --include=*.ts | grep -v "^$E/shared/session-host.ts:" | grep -cvE ':[0-9]+:\s*(//|\*)'); test "$h" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a reload command literal lives outside shared/session-host.ts (or nowhere), the native check, the dispatch line, or a request line is missing, or another file reads Pi's host field in code</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; flock -w 3600 "$S/phase07-heavy.lock" env PATH="$S/gate-bin:$PATH" npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:integration</automated>
    <fails_when>non-zero exit: an integration case fails on the bound commit</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; flock -w 3600 "$S/phase07-heavy.lock" env PATH="$S/gate-bin:$PATH" npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/skill/lifecycle.feature features/slash-command/invocation.feature features/plugin/reload.feature features/marketplace/background-update.feature features/plugin/browse.feature features/skill/project-trust.feature features/slash-command/lifecycle.feature</automated>
    <fails_when>non-zero exit: a refusal, reload, background update, browse, trust, or lifecycle scenario fails under the adapter profile on the bound commit</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qru; F=$(cat "$D/fix-commit") && H=$(cat "$D/hint-commit") && th=$(git show -s --format=%s "$H") && test "$th" = "fix(notify): word reload hints for the host that shows them" && ph=$(git rev-parse "$H~1") && test "$ph" = "$F" && B=$(cat "$D/bound-commit") && tb=$(git show -s --format=%s "$B") && test "$tb" = "fix(plugin): name a reload command the host offers in refusals" && pb=$(git rev-parse "$B~1") && test "$pb" = "$H" && gb=$(git show --name-only --format= "$B") && printf '%s\n' "$gb" | grep -qx features/skill/lifecycle.feature && printf '%s\n' "$gb" | grep -qx features/slash-command/invocation.feature && hd=$(git rev-parse HEAD) && test "$hd" = "$B" # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: a commit file is missing, a title differs, the order is wrong, the feature files are not in the bound commit, or a commit follows it</fails_when>
  </verify>
  <done>Every listed reload instruction takes its command from `reloadCommandFor`: `/reload` in the terminal, `/claude:plugin reload` in RPC, and none in a one-shot run; the payloads keep `needsReload`; R1 and the five breaks pass `check-red.mjs`; the suites, the pairs' coverage, `check:static`, and the affected scenarios pass; `extensions/` is clean.</done>
</task>

<task type="auto">
  <name>Task 3: Document the command and its wording rule, record RELOADCMD-D1, and write the SUMMARY</name>
  <precondition>`$D/bound-commit` names HEAD, and `extensions/` is clean.</precondition>
  <reversibility rating="reversible">Docs and one decision row.</reversibility>
  <files>README.md, README.es.md, docs/output-catalog.md, docs/json-output.md, docs/hooks-compatibility.md, docs/skills-commands-compatibility.md, docs/mcp-compatibility.md, docs/messaging-style-guide.md, .planning/PROJECT.md, .planning/quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/261123-qru-SUMMARY.md</files>
  <action>
    1. Make the doc edits of "Prescribed text" in the eight files. Apply the `simple-english` skill
       in Plain mode and the `humanizer` skill to each added passage, keep the prescribed facts,
       commands, and code text as they are, and keep `README.es.md` a faithful translation of
       `README.md`, line for line. Re-pad every table a cell edit widened. Run
       `npm run test:unpaired` (the catalog and JSON guide tests read two of these files) and
       `check:static`.

    2. Commit the eight files with the title `docs: document /claude:plugin reload and its
       wording`; record `docs-commit`.

    3. Insert the decision row as line 2544 of `.planning/PROJECT.md`, as prescribed, and commit
       that one file with the title `docs(planning): record the reload command decision`; record
       `decision-commit`.

    4. Write the SUMMARY as `<output>` says.
  </action>
  <verify>
    <automated>r=$(grep -cF '/claude:plugin reload' README.md); e=$(grep -cF '/claude:plugin reload' README.es.md); test "$r" -ge 3 && test "$e" -ge 3 && grep -q '^#### reload-started$' docs/json-output.md && grep -q '^### Reload started (RELOADCMD-D1)$' docs/output-catalog.md && grep -qF 'appends `<reload> to pick up changes`' docs/output-catalog.md && grep -qF 'Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes.' docs/output-catalog.md && grep -qF 'need a reload: `/reload` in Pi' docs/json-output.md && grep -qF '`/reload`, `/claude:plugin reload`' docs/hooks-compatibility.md && grep -qF 'A file removed before a reload' docs/skills-commands-compatibility.md && grep -qF '(RELOADCMD-D1)' docs/mcp-compatibility.md && grep -qF 'appends `<reload> to pick up changes`' docs/messaging-style-guide.md # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: either README names the command fewer than three times, or a prescribed doc passage is missing (each check fails at 98ada0c)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; flock -w 3600 "$S/phase07-heavy.lock" env PATH="$S/gate-bin:$PATH" npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:unpaired</automated>
    <fails_when>non-zero exit: an architecture test, the catalog contract, or the JSON guide test fails on the docs commit</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-qru; n=$(grep -n '^| \*\*RELOADCMD-D1 (quick task 261123-qru' .planning/PROJECT.md) && test "${n%%:*}" = 2544 && test "$(printf '%s\n' "$n" | wc -l)" -eq 1 && K=$(cat "$D/bound-commit") && C=$(cat "$D/docs-commit") && tc=$(git show -s --format=%s "$C") && test "$tc" = "docs: document /claude:plugin reload and its wording" && gc=$(git show --name-only --format= "$C") && test "$(printf '%s\n' "$gc" | LC_ALL=C sort | tr '\n' ' ')" = "README.es.md README.md docs/hooks-compatibility.md docs/json-output.md docs/mcp-compatibility.md docs/messaging-style-guide.md docs/output-catalog.md docs/skills-commands-compatibility.md " && pc=$(git rev-parse "$C~1") && test "$pc" = "$K" && A=$(cat "$D/decision-commit") && ta=$(git show -s --format=%s "$A") && test "$ta" = "docs(planning): record the reload command decision" && ga=$(git show --name-only --format= "$A") && test "$ga" = ".planning/PROJECT.md" && pa=$(git rev-parse "$A~1") && test "$pa" = "$C" && ns=$(git diff --numstat "$A~1" "$A" -- .planning/PROJECT.md) && test "$(printf '%s\n' "$ns" | cut -f1)" -eq 1 && test "$(printf '%s\n' "$ns" | cut -f2)" -eq 0 # [HEAD=absent EXPECT==present @98ada0c]</automated>
    <fails_when>non-zero exit: the row is missing, repeated, or not line 2544, a commit file is missing, a title differs, the docs commit holds another file set, the decision commit changed more than one added line, a git call fails, or the order is wrong</fails_when>
  </verify>
  <done>The docs and both READMEs describe the command, the predicates, the hint and wording rule, and the Pi gaps; RELOADCMD-D1 is one new row of PROJECT.md; the two commits follow the bound commit; the SUMMARY exists.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| RPC client -> `/claude:plugin reload` | any client on Pi's RPC pipes can now reload the extension runtime, as it could already rebuild it with `new_session` |
| reloaded runtime -> old command | the old command's code runs after its context went stale, beside the new runtime's process-wide state |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qru-01 | Denial of service | a reload asked while a run streams or Pi compacts | medium | mitigate | `ctx.isIdle()` is checked before the request, so `ctx.reload()` never meets Pi's throw; the busy refusal leaves the run going (scenario `reload.feature:42`, break B3). |
| T-qru-02 | Tampering | the old runtime's code after the reload (the option variable re-apply of `runForeground` writes `process.env`) | medium | mitigate | `reloadWhenRequested` runs after `runForeground` returned, so the old runtime's re-apply runs before the reload and nothing of it runs after; the register row with a context that goes stale proves no read after the reload. |
| T-qru-03 | Repudiation | a reload that fails after `reload-started` | low | mitigate | The failure is not caught by the extension: it reaches Pi, which reports an `extension_error` over RPC and `Reload failed: ...` in the terminal; the JSON guide says the payload marks the start, not the end. |
| T-qru-04 | Information disclosure | the refusal texts and the new payload | low | accept | The busy and one-shot texts are fixed; the refusals that name a cwd already did; `reload-started` carries only the envelope. |
| T-qru-05 | Elevation of privilege | project trust across a reload | low | accept | The command runs Pi's own reload, which keeps Pi's trust decisions (`interactive-mode.js:5540`); the load still applies a project scope only when Pi trusts it (D-LOC-01). |
| T-qru-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package, so the package-legitimacy gate has nothing to check. |
</threat_model>

<verification>
- Task 1: R0 (`RED-PROOFS OK` for `r0-`), the three unit red logs, the touched unit files, direct
  coverage of the changed pairs, `test:unpaired`, `check:static`, the seven scenarios and the
  browse and completion features under the adapter profile, the same files under the builtin
  profile, the grep gates, and the C0 and command commits.
- Task 2: R1 and the breaks (`RED-PROOFS OK` for `r1-` and `fix-`), the two unit red logs,
  `test:modules`, `test:unpaired`, `test:integration`, direct coverage of the changed pairs,
  `check:static`, the affected features under both profiles, the wording gates, and the hint and
  bound commits.
- Task 3: the doc gates, `test:unpaired` on the docs commit, the decision row gate, and both
  commits' file sets, titles, and order.
- For the orchestrator, not the executor: `npm run check` in the main checkout after the merge
  (AGENTS.md, Build verification), the CHANGELOG parent line, and the STATE update.
</verification>

<success_criteria>
- `/claude:plugin reload` runs Pi's reload in the terminal and over RPC, reports `reload-started`
  over RPC before the reload, refuses in a one-shot run with the one-shot text, and refuses while
  a run is active with Claude Code's busy words; help and completions leave it out in a one-shot
  run.
- `acceptsLaterCommands` is the only reader of Pi's `hasUI`; `reloadCommandFor` is the one place
  that picks the reload command, with Pi's own `/reload` only in the terminal.
- The trailer, the background update notice, the MCP move rows, and the skill and command refusals
  name the picked command, and a one-shot run has none of them; `needsReload` stays in every
  payload.
- R0, R1, and B1 to B5 pass `check-red.mjs`; `extensions/` ends clean.
- `check:static`, the changed pairs' direct coverage, `test:unpaired`, `test:integration`, and the
  affected feature files pass.
- The docs, both READMEs, and RELOADCMD-D1 state the rules and the Pi gaps.
</success_criteria>

## Source audit

| Source | ID | Item | Plan | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GOAL | 261123-qru | `/claude:plugin reload`, the sessionful predicate, the hint and wording rules | Tasks 1, 2 | COVERED | scenarios at `reload.feature:7,14,33,42` |
| CONTEXT | decision 1 | one named predicate `acceptsLaterCommands(ctx)` returning `ctx.hasUI`, reasoning in its doc comment, no other check | Task 1 | COVERED | `shared/session-host.ts`; the `.hasUI` gate |
| CONTEXT | decision 2 | the subcommand runs `ctx.reload()` only where the predicate holds; one-shot refusal with a short usage message; help and completions leave it out there; not named `reload` at the top level | Task 1 | COVERED | reload handler, register, router, help, provider rows; D3, D6 |
| CONTEXT | decision 3 | no reload hint text in a one-shot host; JSON and RPC keep `needsReload` | Task 2 | COVERED | grammar and dispatch rows; D8 |
| CONTEXT | decision 4 | wording through one place: `/reload` with a native `/reload` (one named predicate, TUI only, a Pi fact), `/claude:plugin reload` in other sessionful hosts; every listed site | Task 2 | COVERED | `reloadCommandFor`, `hasNativeReload`; grammar `:1197`, `:1326`; mcp `:214`, `:216`, `:228`, `:230`; skill `:233`, `:238`; command `:277`, `:289`; D7, D9 |
| CONTEXT | decisions 5, 6 | RPC harness reload step and `new_session` audit; `reload-plugins` alias and print-mode notify | -- | EXCLUDED | sibling 261123-qrv; out of scope by the note |
| CONTEXT | orchestrator | match upstream `/reload-plugins`: what it prints after a reload and what it refuses mid-run | context, Tasks 1, 3 | COVERED | no counts line and the mid-run refusal, each with its Pi gap; Claude Code's busy words; D1, D2 |
| CONTEXT | orchestrator | the skill and command refusal texts keep upstream parity | context, Task 2 | COVERED | only the reload command changes; the rest of each text stays |
| CONTEXT | orchestrator | decide and test what the subcommand shows when `ctx.reload()` would throw mid-run | Tasks 1, 2 | COVERED | `isIdle()` check, busy refusal; scenario `:42`, B3, reload rows |
| CONTEXT | orchestrator | cucumber scenarios for TUI, RPC, and one-shot that fail without the change | Tasks 1, 2 | COVERED | R0, R1; B1 to B5 |
| CONTEXT | orchestrator | unit tests at 100% direct coverage | Tasks 1, 2 | COVERED | pairs listed per task |
| CONTEXT | orchestrator | docs: output catalog, README command list, compatibility pages | Task 3 | COVERED | eight files; the JSON guide's kind section lands with the kind in Task 1 |
| CONTEXT | orchestrator | a decision ID in PROJECT.md; a CHANGELOG parent line in the SUMMARY; never edit STATE, ROADMAP, BACKLOG, CHANGELOG | Task 3, output | COVERED | RELOADCMD-D1; "For the orchestrator" |
| CONTEXT | orchestrator | red proofs with `break.sh`, `check-red.mjs`, `nondac-sh` copied from `fix-07b` | Tasks 1, 2 | COVERED | `$D`, three table sets |
| CONTEXT | orchestrator | complexity gates, fallow zones, NFR-2, IL-2 chokepoint, architecture tests | Tasks 1, 2 | COVERED | `mcpMigrationArguments` and `emitText` extractions, C0 against a clone group, notify only through `notification-dispatch.ts`; `check:static`, `test:unpaired` |
| CONTEXT | orchestrator | verification prefix, `fd` on PATH, heavy-run lock, no `--no-verify`, no SKIP, commit titles without quick ids | rules | COVERED | |
| RESEARCH | Pi facts | `ctx.reload()` in every mode; throws while a run streams; built-in `/reload` TUI-only; extension command cannot be named `reload`; `hasUI` meaning | context | COVERED | design rests on them; the command lives under `/claude:plugin` |
| RESEARCH | sites | the eight sites the note lists | Task 2 | COVERED | the wording gate counts 10 at 98ada0c and 0 after |

<output>
Create `.planning/quick/261123-qru-add-claude-plugin-reload-and-the-sessionful-predicate-planni/261123-qru-SUMMARY.md`
with `status: complete` in its frontmatter and these sections:

- "Red proofs": the R0, R1, and B1 to B5 logs under `$D`, each one's count line and failing step,
  the three `check-red.mjs` outputs (`RED-PROOFS OK`), the unit red logs (shared, session-host,
  reload, hint, refusals), any scenario cell or doc string a step corrected, and any break file
  rewritten, with the words "rewrote a break" and the reason.
- "Checks": each command of the verify blocks with its exit status, the commit it ran on, the Node
  version, and the counts it printed (unit cases, coverage lines, scenario counts).
- "Decisions": RELOADCMD-D1 and D1 to D9 of the context, each marked for the maintainer's review,
  and the test files Task 2 touched for `hasUI`.
- "The RPC reload contract" (for sibling 261123-qrv): the command text `/claude:plugin reload`;
  the prompt response `{ disposition: "handled" }` after the reload has finished; the command's
  own payload `{ schemaVersion: 1, kind: "reload-started", origin: { kind: "command", commandId:
  "plugin reload", invocationId }, severity: "info", needsReload: false }` first, then the
  reloaded runtime's load payloads in session order (none when it has nothing to report); no
  extension error and no dialog on success; the busy refusal while a run is active; a reload that
  fails after it started reported by Pi as an `extension_error`.
- "For the orchestrator" (the executor edits none of these files):
  - CHANGELOG parent line: "`/claude:plugin reload` now reloads Pi, also over RPC, where Pi has no
    `/reload`. Reload hints and refusals name the command your host offers, and a one-shot run
    shows none."
  - STATE.md: record quick task 261123-qru and RELOADCMD-D1; the next item is 261123-qrv.
  - `npm run check` in the main checkout after the merge.
- `## Threat Flags`, even when the answer is "None" (AGENTS.md, GSD records), as this line:
  None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
</output>
