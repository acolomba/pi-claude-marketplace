# Reload outside the terminal UI: Pi facts and decisions

Researched 2026-11-23 against the pinned Pi 1.5.1 (`node_modules/@earendil-works/pi-coding-agent`).
The decisions at the end were agreed with the maintainer in the session that wrote this note.

## Pi facts

- **How sessions work in each mode.** Print and JSON run once: the prompts come on the command
  line, run in order, and Pi exits. It reads no further input (`docs/cli-integration.md:44`,
  `docs/json.md:3-9`). RPC is long-lived: JSONL commands on stdin, responses and events on stdout
  (`docs/rpc.md`). The TUI is long-lived and interactive.
- **Built-in `/reload` is TUI-only.** `interactive-mode.js:2762` handles it before any extension
  command. In RPC, `prompt` dispatches extension commands, skills, and templates only
  (`agent-session.js:1704`, `_tryExecuteExtensionCommand` at `:1782`), so `/reload` sent as a
  prompt reaches the model as text. The RPC docs say built-in TUI commands "would not execute if
  sent via `prompt`" (`docs/rpc-commands.md`, `get_commands`). The RPC command set
  (`rpc-types.d.ts`) has no reload.
- **`ctx.reload()` works in every mode.** The command context's `reload` action is wired in RPC
  (`rpc-mode.js:256`), print and JSON (`print-mode.js:81`), and the TUI (`interactive-mode.js:1638`,
  which calls the same `handleReloadCommand` that `/reload` uses). It runs `session.reload()`
  (`agent-session.js:3094`): `session_shutdown` (reason `reload`), settings and resources reloaded,
  a new extension runtime, `session_start` (reason `reload`), and `resources_discover` (reason
  `reload`). It throws while a run streams or a compaction runs. Docs: `docs/extensions.md:1514-1565`;
  example `examples/extensions/reload-runtime.ts`.
- **An extension command cannot be named `reload`.** The TUI's built-in wins, and Pi reports a
  conflict diagnostic (`interactive-mode.js:468-480`).
- **`new_session` and `switch_session` are not reloads.** They rebuild the runtime
  (`agent-session-runtime.js:128-170`) but emit `session_start` with reason `new` or `resume`, and
  then `resources_discover` with reason `startup` (`agent-session.js:2776-2778`). `new_session`
  empties the conversation. The hooks bridge behaves differently for these reasons: a reload runs
  no SessionStart and no SessionEnd (`event-router.ts:1434`, `:1727`, D-CF5-03); a new session runs
  SessionEnd, and then SessionStart with source `clear`. The late SessionStart (HOOKLATESS-D1) keys
  on `startup` (`index.ts:270`).
- **`hasUI` means a live counterpart.** `runner.js:404`: `hasUI` is true when the host bound a real
  UI context. The TUI and RPC bind one; print and JSON bind none. A dialog needs an answer that
  arrives later, so `hasUI` implies a process that keeps reading input. The converse is not
  guaranteed: a future long-lived host without dialogs would read `hasUI: false`. That is the safe
  direction of failure.
- **Print mode shows no extension notify.** Print mode binds no UI context, so `ctx.ui.notify` is
  the runner's no-op (`runner.js:136`). JSON and RPC carry the structured `needsReload` boolean
  (`notification-wire.ts:378`, `:619`). Only the text renderer writes `/reload to pick up changes`
  (`notification-grammar.ts:1197`).
- **Upstream.** Claude Code has `/reload-plugins` in its interactive UI and a `reload_plugins`
  request on its long-lived SDK channel. Its one-shot `-p` runs offer no reload
  (`.planning/research/HOOKLATESS-01-UPSTREAM.md`).

## Where `/reload` is named to users today

- `shared/notification-grammar.ts:1197` (the trailer) and `:1326` ("Run /reload to apply")
- `shared/notification-mcp.ts:214`, `:216`, `:228`, `:230` (MCP move notices)
- `orchestrators/skill-invocation.ts:233`, `:238` (skill refusals, every mode)
- `orchestrators/command-invocation.ts:277`, `:289` (command refusals, every mode)

## Harness facts

- **Real reloads:** the TUI driver sends `/reload` in a pseudoterminal (`features/lib/pi-tui.ts:471`).
  About 10 scenarios use it.
- **RPC stand-in:** 639 RPC steps in 92 feature files say "the user starts a new pi session". They
  call `startSession` (`features/lib/pi-commands.ts:164`), which sends `new_session`. Its comment
  claims it works "as `/reload` does", which is not accurate (see above). Other callers:
  `features/support/pi-process.ts:245` (resetting the shared Pi between scenarios),
  `features/lib/real-subagent-child.ts:742`, `features/lib/subagent-hook-session.ts:587`,
  `features/step_definitions/plugin/subagent-hooks.steps.ts:434`,
  `features/step_definitions/hook/session.steps.ts:513`.
- **One-shot drivers:** `features/lib/pi-json-mode.ts` and `features/lib/pi-one-shot.ts` start a
  fresh process per command and never reload.

## Decisions (maintainer, 2026-11-23)

1. **Key on the cause, not on mode names.** The cause is whether this process accepts later
   commands ("sessionful"). It is not whether a session file is saved: `--no-session` RPC is still
   sessionful. A single named predicate decides it, `acceptsLaterCommands(ctx)` returning
   `ctx.hasUI`, with the reasoning above in its doc comment. No other code checks a mode name for
   this.
2. **Add `/claude:plugin reload`.** It is available only when `acceptsLaterCommands(ctx)` is true,
   so in the TUI and RPC. It runs `ctx.reload()`. In a one-shot host it refuses with a short usage
   message, and help leaves it out there. (Completions always offer it: Pi asks for them only in
   its terminal. Changed at PR review, 2026-11-24.) It is not named `reload` at the top level
   (the TUI built-in wins).
3. **The reload hint follows the same predicate.** In a one-shot host there is no reload hint text:
   the next invocation loads the change. The JSON and RPC payload keeps `needsReload` in every
   mode, because an RPC client acts on it by sending `/claude:plugin reload`.
4. **Wording.** In the TUI, text that tells the user to reload keeps naming `/reload`, Pi's native
   command. In another sessionful host, it names `/claude:plugin reload`. The choice of words lives
   in one place, a single named predicate for "the host has a native `/reload`", which is true only
   for the TUI. It is documented as a Pi fact (`interactive-mode.js:2762`).
5. **RPC tests reload.** Add an RPC harness step that sends `/claude:plugin reload`. Audit the RPC
   `new_session` steps. Those that only stand in for a reload (making installed plugins visible)
   switch to the reload step. Those that test a new session stay: SessionStart `clear`, SessionEnd
   hooks, an empty conversation, or the shared Pi reset between scenarios. Fix the
   `pi-commands.ts:162` comment.
6. **Out of scope:** an alias for Claude Code's `reload-plugins` spelling (not decided), and print
   mode showing notify output (a separate finding).
