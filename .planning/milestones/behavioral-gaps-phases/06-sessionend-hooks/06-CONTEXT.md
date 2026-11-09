# Phase 6: SessionEnd Hooks - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Each choice made without the user is also in `DUBIOUS-CHOICES.md`.

<domain>
## Phase Boundary

Phase 6 adds the cucumber coverage of SessionEnd hooks that `hook/session.feature` does not pin (SEND-01): every way a Pi 1.5.0 session ends runs the plugin's SessionEnd hooks with Claude Code's `reason`, a matcher for each reason that Pi can produce selects only that reason's run, and a SessionEnd hook that exits non-zero, exits 2, or outlasts its time budget never keeps the next session from starting or Pi from exiting. The scenarios go in the new `features/hook/session-end.feature`, with the new verb step module `features/step_definitions/hook/session-end.steps.ts`. A product change is allowed only where a scenario exposes a bug in Phase 6's own files: `bridges/hooks/payloads/session-end.ts` and the SessionEnd arm of the shared hook modules (ROADMAP File ownership). The existing rows of `hook/session.feature` (`clear`, `resume` by fork, `other` by an RPC stop, `prompt_input_exit` by a terminal quit, the `clear` matcher, and the reload that runs nothing) stay as they are.

</domain>

<decisions>
## Implementation Decisions

### Upstream contract (evidence records)

- **E1 -- reason set.** Claude Code 2.1.319 (binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, grepped 2026-11-08) declares `["clear","resume","logout","prompt_input_exit","other"]` as the SessionEnd `reason` schema. The hooks reference (https://code.claude.com/docs/en/hooks, read 2026-11-08) gives the same five: `clear` for `/clear`, `resume` for an interactive `/resume`, `logout`, `prompt_input_exit` for an exit while the prompt input shows, and `other`; `bypass_permissions_disabled` was removed in v2.1.234. The component-features E1 record adds that `/branch` sends `resume` and that a print-mode end, a stdin close, and a signal send `other`. Confidence high. The bridge already maps Pi this way (D-CF5-02): `new` -> `clear`, `resume` and `fork` -> `resume`, `quit` -> `prompt_input_exit` in the terminal and `other` in print, json, and rpc mode, `reload` -> no run (D-CF5-03).
- **E2 -- no decision control.** The docs say SessionEnd hooks cannot block session termination, and Claude Code discards their JSON output, such as `systemMessage`. The exit-code table says exit 2 on SessionEnd "shows stderr to user only". In the binary, after the bounded run, each failed hook with output writes `SessionEnd hook [<command>] failed: <output>` to stderr. Confidence high.
- **E3 -- time budget.** Docs: "SessionEnd hooks have a default timeout of 1.5 seconds. It applies when you exit, run `/clear`, or switch sessions with interactive `/resume`." A per-hook `timeout` in the user's settings raises the overall budget to match, up to 60 seconds, but "Timeouts set on plugin-provided hooks don't raise the budget." `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` overrides the budget and becomes the timeout of each hook without its own. Binary: the budget function `jje()` is `max(1500, min(<largest settings timeout>, 60000), <env>)`, and it reads the settings, policy, and agent hook sources only, never a plugin's; the per-hook default `Rki()` is the variable or 1500 ms; `/clear` and `/resume` abort the hooks with `AbortSignal.timeout(jje())`, and every SessionEnd run is waited for at most `jje()` (`boundMs`). Confidence high.
- **E4 -- Pi 1.5.0's session ends** (`dist/core/agent-session-runtime.js`, `dist/modes/*`): `new` from `newSession` (RPC `new_session`, terminal `/new`); `resume` from `switchSession` (RPC `switch_session`, terminal `/resume`) and `importFromJsonl`; `fork` from `fork` (RPC `fork` and `clone`, terminal `/fork` and `/clone`); `quit` from `dispose()` in the terminal (quit keys, `/quit`, Ctrl+D, SIGTERM, SIGHUP), print and json mode (end of run, SIGTERM, SIGHUP), and rpc mode (stdin end, SIGTERM); `reload` from `/reload`. Print and json mode share one exit path (`modes/print-mode.js`).
- **E5 -- the bridge today.** Matching hooks of one event run at once (`runHooks`, D-CF5-09). The blocking lane's SessionEnd default is 1.5 s per hook (`bridges/hooks/timeout.ts`), but a declared `timeout` is used as written. A probe on 2026-11-08 confirmed the result: a SessionEnd hook with `timeout: 60` that sleeps 60 s held RPC `new_session` past the 30-second step timeout. An exit 2 shows the hook notice `SessionEnd:clear hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/end.sh]: cleanup failed` in the turn's records (D-CF5-24, probed the same day).

### Reasons (D-BG-601)

- **D-BG-601 -- the reasons that `hook/session.feature` lacks get scenarios in `hook/session-end.feature`:**
  - Pi `resume`: the user resumes a saved session through RPC `switch_session`. SessionEnd runs with `resume` for the session that ends, then SessionStart with `resume` for the resumed one. A `Given` writes the saved session as a Pi session file (a version-3 header line, with its own session id and the project directory as its cwd) at a path under `{agent dir}/sessions/`, and the resumed session's runs report that file as their `transcript path`.
  - Pi `quit` in json mode: a one-shot Pi in json mode runs a `/claude:plugin` command and exits. Its SessionStart runs with `startup`, and its SessionEnd with `other`. The step reuses `runJsonModeCommand()` from `features/lib/pi-json-mode.ts` (D-BG-09), which fails unless Pi exits 0 within its deadline, and keeps the hook log lines that the run added as the turn.
  - Not driven, each a dubious choice: print mode (it shares the json exit path and the `other` value; no print driver exists, and a new one would duplicate the frozen json driver); the terminal `/new`, `/resume`, `/fork`, and `/clone` (the mapping does not depend on the mode, and RPC covers `new`, `resume`, and `fork`); RPC `clone` (Pi's `fork` reason, which the fork scenario covers); a signal that quits a terminal Pi (the D-CF5-02 Pi gap: Pi does not say whether a signal caused a quit).

### Matchers (D-BG-602)

- **D-BG-602 -- one matcher scenario for each reason that Pi produces:** `clear` (a new session), `resume` (a resumed session), `other` (an RPC stop), and `prompt_input_exit` (a terminal quit, user scope, as the existing terminal scenarios). Each declares five SessionEnd hooks, one for each upstream reason (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`), and states that exactly the hook of that reason ran. `logout` never runs, as upstream. The terminal scenario also declares a SessionStart hook, which the terminal `Given` waits for. The existing two-hook `clear` matcher scenario in `hook/session.feature` stays.

### Failures (D-BG-603, D-BG-604)

- **D-BG-603 -- a failing SessionEnd hook never keeps the session from ending, and its run is recorded:**
  - A new session (RPC): a `Scenario Outline` over a hook that exits 1 with stderr, a hook that sleeps 30 s with no declared `timeout` (past the 1.5 s budget), and a hook that declares `timeout: 60` and sleeps 60 s. The hooks record the SessionEnd run of the first session and the SessionStart run of the second.
  - An exit 2 on a new session gets its own scenario: the next session starts, and the user sees `SessionEnd:clear hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/end.sh]: <stderr>` (D-CF5-24).
  - Pi exits: a `Scenario Outline` over the same three hooks, plus an exit 2, on a one-shot Pi in json mode. The json driver fails unless Pi exits 0 within 25 s, so a hook that held Pi open would fail it, and the hooks record the SessionEnd run with `other`.
  - The outlines do not state the notices of a non-blocking failure. Claude Code writes `SessionEnd hook [<command>] failed: <output>` to stderr (E2), and the bridge shows nothing for a non-blocking failure on any event; HOOKERRNOTE-01 carries that gap, and no decision licenses pinning either form. Dubious choice, with a BACKLOG parent line that adds the SessionEnd wording to HOOKERRNOTE-01.
  - An RPC stop is not used for "Pi exits": the profile Pi driver kills Pi after a 5-second grace and does not say whether Pi exited on its own.
- **D-BG-604 -- product fix: a plugin hook's own `timeout` does not extend the SessionEnd budget.** The blocking-lane timeout of a SessionEnd hook is its declared `timeout` capped at the 1.5 s budget, so a longer declared value no longer holds the session open (E3, E5). A declared value of 1.5 s or less is kept, and an undeclared one stays 1.5 s. The background lane (`asyncRewake`) is unchanged. The cap lives in `bridges/hooks/timeout.ts` as a new SessionEnd-only table or function, the SessionEnd arm, without reordering the per-event defaults; a capped value writes a `hookDebugLog` line, as an unusable value does. `test/bridges/hooks/timeout.test.ts` gains the cap cases. `docs/hooks-compatibility.md` changes only the SessionEnd part of the `timeout` row. The new-session and json outline rows with `timeout: 60` are the red proof. Because the hooks of one event run at once (E5), the per-hook cap also gives every SessionEnd hook the same 1.5 s, which is the shared budget of HKTO-01's first point; HKTO-01's second point (an uncapped declared value) is fixed here. Parent line: close HKTO-01 in BACKLOG.md, keeping what D-BG-605 defers.
- **D-BG-605 -- deferred, each a dubious choice and a BACKLOG parent line:**
  - `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` is not read. Implementing it is a feature that no Phase 6 scenario needs, and a scenario that shows a hook getting more than 1.5 s needs a timed release that the frozen fixtures do not offer.
  - No bounded wait as upstream's `boundMs`. A hook that ignores SIGTERM still holds the session for the ladder's 5-second SIGKILL grace, and a grandchild that keeps the hook's stdout open holds it until the grandchild exits (HKDR-01). Both live in the shared blocking lane (`dispatch-exec.ts`), outside Phase 6's files.

### Step module (D-BG-606)

- **D-BG-606 -- `hook/session-end.steps.ts` holds only what no frozen module offers:** the saved-session `Given`, the resume `When` (RPC `switch_session`, recorded as a session action turn the way `hook/session.steps.ts` records a fork: every record and stand-in log line the action added, no extension error or dialog, no model call past the script), and the json-mode `When` (the hook log lines that the one-shot run added, as a turn with no RPC record, the way the terminal steps record one; the command's own payloads are not the point of these scenarios and stay unrecorded, so no json scenario uses the hook notice steps). Each step text names its own action, so no sibling verb module can define the same text (D-08). Every other step comes from the frozen modules.

### Claude's Discretion

- Exact step wording, hook names, stderr texts, and the saved session's file name, within the cucumber rules.
- How the plans split across waves. Plans that edit the same feature file or step module go in separate waves.
- Whether the `Scenario Outline` placeholders carry the hook columns directly (`exit code`, `stderr`, `timeout`, `sleep`) or one `<failure>` description column, as long as each variant reads clearly.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/step_definitions/hook/session.steps.ts` (frozen): `the user starts a new pi session with the hooks recording`, `the user quits pi with the hooks recording` (RPC stdin end), `the user has started pi in the terminal with the hooks recording`, `the user quits pi in the terminal with the hooks recording`, `the user has prompted {string} with the hooks recording`, and the private `recordSessionAction()` pattern to copy for the resume `When`.
- `features/step_definitions/hook/runs.steps.ts` (frozen): the hooks table `Given` (columns `form`, `exit code`, `stderr`, `timeout`, `sleep`, and more), `the hooks record these runs:`, `... in any order:`, and `the hooks record no runs`.
- `features/step_definitions/hook/messages.steps.ts` (frozen): `the hooks show the user these messages:` and `... no messages`, which read the `entry_appended` records of the last turn.
- `features/lib/pi-json-mode.ts` (frozen): `runJsonModeCommand(launch, command, onRelease)`, with `ScenarioWorld.oneShotPiLaunch()`.
- `features/lib/pi-commands.ts`: `readSession()`; `features/lib/turn-records.ts`: `readLogLengths()` and `readLogLinesSince()`; `features/lib/run-tokens.ts`: `expandTokens()`.
- `features/lib/hook-files.ts`: a script hook's `sleep` sends its output to `/dev/null`, so killing the script ends the hook and no grandchild holds its pipe.

### Established Patterns
- A session action `When` records a turn of every RPC record and harness log line the action added; the runs step marks the turn compared.
- A one-shot or terminal Pi in the same sandbox writes its hook runs to the profile Pi's harness directory (`<sandbox home>/harness`).
- A scenario that drives a terminal Pi installs in the user scope; an RPC scenario installs in the project scope.

### Integration Points
- `bridges/hooks/timeout.ts` `resolveTimeoutSeconds()` is called by both exec lanes (`dispatch-exec.ts`, `async-rewake/registry.ts`); the cap applies to the blocking lane's SessionEnd only.
- `bridges/hooks/event-router.ts` `sessionShutdownCallback()` maps Pi's reason with `claudeSessionEndReason()` (`payloads/session-end.ts`); no change is planned there.

</code_context>

<specifics>
## Specific Ideas

- Every scenario names its red proof in the plan SUMMARY: the reason scenarios fail when the mapping arm is changed, the matcher scenarios when matcher filtering is off, the failure outlines' `timeout: 60` rows without the D-BG-604 cap, the sleep rows when the SessionEnd default is 600 s, and the exit-2 scenario without the hook error notice.
- Parent lines (last plan's SUMMARY): close HKTO-01 with what D-BG-605 keeps; add the SessionEnd wording to HOOKERRNOTE-01; a new BACKLOG item for `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`; Key Decisions rows D-BG-601 to D-BG-606; a CHANGELOG line for the SessionEnd timeout cap.

</specifics>

<deferred>
## Deferred Ideas

- `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` support and a bounded SessionEnd wait (D-BG-605).
- Claude Code's `SessionEnd hook [<command>] failed: <output>` notice (HOOKERRNOTE-01).
- Print-mode, terminal `/new`, `/resume`, `/fork`, `/clone`, RPC `clone`, and signal-quit scenarios (D-BG-601).

</deferred>
