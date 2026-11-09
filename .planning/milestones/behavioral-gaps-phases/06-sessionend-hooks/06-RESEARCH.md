# Phase 6: SessionEnd Hooks - Research

**Researched:** 2026-11-08
**Domain:** cucumber coverage of Pi 1.5.0 session ends through the hooks bridge, plus one additive product change in `bridges/hooks/timeout.ts` (D-BG-604)
**Confidence:** HIGH (every load-bearing claim was read in source this session or measured by a scratch probe run on 2026-11-08)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` support and a bounded SessionEnd wait (D-BG-605).
- Claude Code's `SessionEnd hook [<command>] failed: <output>` notice (HOOKERRNOTE-01).
- Print-mode, terminal `/new`, `/resume`, `/fork`, `/clone`, RPC `clone`, and signal-quit scenarios (D-BG-601).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEND-01 | `SessionEnd` hooks run with each reason Pi can produce, matchers select them by reason, and a failing `SessionEnd` hook does not keep the session from ending. | Q1 (resume through `switch_session`: file format, placement, measured payloads), Q2 (json-mode one-shot: measured runs), Q3/Q4 (D-BG-604 cap shape, unit cases, docs row), Q5 (red proof per scenario), Q6 (exact step texts, ambiguity check), Q7 (timing, CI leg), Validation Architecture (criterion-to-test map) |
</phase_requirements>

## Summary

Every planning question was settled by reading source and by one scratch probe run (two cucumber invocations on 2026-11-08, files deleted afterwards, `git status --short` clean). The resume path works with a one-line hand-written session file: RPC `switch_session` to `{agent dir}/sessions/saved.jsonl` ran exactly one SessionEnd (`resume`, first session, empty transcript path) and exactly one SessionStart (`resume`, second session, transcript path `{agent dir}/sessions/saved.jsonl`, `CLAUDE_ENV_FILE` `{project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env`) in 556 ms. A one-shot Pi in json mode running `/claude:plugin list` against a project-scope install wrote a SessionStart `startup` run and a SessionEnd `other` run into the profile Pi's harness directory, and exited 0 in 2.4 s even with an exit-2 SessionEnd hook. A SessionEnd hook that sleeps 30 s with no declared timeout was stopped at the 1.5 s default (new session answered in 1.9 s), and the run and the next session's SessionStart were both recorded.

The D-BG-604 cap is a single-branch change in `resolveTimeoutSeconds()`: the declared-value branch returns `capSessionEndTimeout(raw, ...)` instead of `raw`. Only the blocking lane (`dispatch-exec.ts:304-310`) is capped; the background lane (`async-rewake/registry.ts:208-215`) passes `lane: "background"` and keeps its declared value. No other unit or integration test pins an uncapped SessionEnd timeout. One comment in `timeout.ts` cites HKTO-01 (lines 49-55) and one doc row states the uncapped behavior (`docs/hooks-compatibility.md:204`).

Two traps the planner must design around: (1) a verbatim copy of `recordSessionAction()` from the frozen `hook/session.steps.ts` into the new module trips `fallow dupes` (measured: one 48-line clone group), so the new module must write its turn-recording helper in its own shape and the plan must run `npx fallow dupes --fail-on-issues`; (2) `Given the user has started a new pi session` also ends a session, so in a failure scenario that keeps it, the hook runs twice and the red proof of the `timeout: 60` row lands in that `Given`, not in the `When`. The probe showed the Given is not needed for the hook to run (the startup session's SessionEnd runs on the `When`), so the recommendation is to leave it out of the failure scenarios.

**Primary recommendation:** Three plans in two waves: Wave 1 runs (A) the new step module plus the reason and matcher scenarios and (B) the timeout cap with its unit cases, comments, and doc row in parallel; Wave 2 runs (C) the failure outlines and the exit-2 scenario, which edits the same feature file as A.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mapping Pi's shutdown reason to Claude's `reason` | Extension: `bridges/hooks/payloads/session-end.ts` | `bridges/hooks/event-router.ts` (`sessionShutdownCallback`) | Single mapping site (D-CF5-02); no change planned |
| Selecting SessionEnd hooks by `reason` | Extension: `bridges/hooks/dispatch.ts` (`matchValue`, line 905-920) | `domain/components/hook-events.ts` (closed set) | Closed-set matcher; no change planned |
| SessionEnd time budget (D-BG-604) | Extension: `bridges/hooks/timeout.ts` | `exec-timer.ts` ladder (unchanged) | The one place the blocking lane resolves a handler's timeout |
| Session replacement and exit | Pi 1.5.0 host (`agent-session-runtime.js`, `rpc-mode.js`, `print-mode.js`) | -- | Pi emits `session_shutdown` and waits for handlers |
| Observing runs | Test harness: hook recorder writes `$HOME/harness/hook-runs.jsonl` | New verb step module records the turn | Every Pi in the sandbox shares HOME, so all runs land in one log |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; Phase 6 works only on `features/behavioral-gaps-phase-6` in its own worktree; never rebase, merge only.
- Commits follow `.agents/skills/committing/SKILL.md`: Conventional Commits, no milestone/phase/plan identifiers in title or scope; never `--no-verify`.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (Behavioral tests rule).
- Upstream parity: Claude Code's behavior is the default; D-BG-604 moves the bridge toward upstream (E3).
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health, cycles, dupes, rule packs), Prettier, pairing, unit, integration, cucumber (both profiles), 100% direct coverage per source-test pair.
- Output only through the notify chokepoint; `hookDebugLog` (env-gated `console.error` in `shared/debug-log.ts`) is the sanctioned debug channel.
- Comments cite durable IDs (D-BG-604, HKTO-01), never phase/plan/wave numbers.
- Every plan SUMMARY.md has a `## Threat Flags` section.
- Milestone rules (ROADMAP, behavioral-gaps): only additive changes in the SessionEnd arm of the shared hook modules; frozen files (all of `features/lib/**`, `features/support/**`, every existing step module, `cucumber.json`, `.fallowrc.json`, `eslint.config.js`, `package.json`) are never edited; `CHANGELOG.md`, `README*.md`, `.planning/BACKLOG.md`, PROJECT.md Key Decisions, and `.planning/DUBIOUS-CHOICES.md` changes are parent lines in the last plan's SUMMARY.
- Subagent rules for this phase: hermetic home only; heavy commands with `--parallel 2` or `3`, in the background, exit code to a file; never pipe a gate command into `tail`/`head`/`grep`; one rerun for a timeout under load, both runs recorded.

## Standard Stack

No new dependency. Everything the phase needs is already in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | 13.3.0 (`npx cucumber-js --version`) [VERIFIED: local run] | Behavioral scenarios | Project's behavioral runner |
| `@earendil-works/pi-coding-agent` | 1.5.0 [VERIFIED: node_modules package.json] | Host under test (RPC, json, terminal modes) | Pinned dev dependency |
| `node:test` + `node:assert/strict` | Node 26.13.0 locally, CI Node 24 [VERIFIED: `node --version`] | Unit cases for `timeout.ts` | Project's unit runner |
| fallow | 3.41.0 [VERIFIED: `npx fallow --version`] | dupes/health gate | Part of `npm run check` |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | -- | -- | -- | -- | -- | -- |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 Scenario steps (features/hook/session-end.feature)
   |
   |  Given pi runs with the scripted model ----------> profile Pi (RPC, --no-session, HOME = {home})
   |  Given ... install demo@fixtures --scope project      |
   |                                                        |
   |  When resume (NEW) --- RPC switch_session ----------->  AgentSessionRuntime.switchSession
   |  When new session (frozen) --- RPC new_session ------>  .newSession            \
   |  When quit (frozen) --- stdin end ------------------->  dispose() (quit)        |  session_shutdown
   |  When terminal quit (frozen) --- quit keys -> terminal Pi dispose() (quit)     |  {reason}
   |  When json one-shot (NEW) --- spawn pi --mode json -> print-mode dispose()     /
   |                                                        |
   |                                                        v
   |                               event-router sessionShutdownCallback (reload -> no run)
   |                                 claudeSessionEndReason(reason, mode)   [payloads/session-end.ts]
   |                                                        |
   |                                                        v
   |                               dispatch: matchValue -> matcher filter -> runHooks (all at once)
   |                                                        |
   |                                                        v
   |                               dispatch-exec spawnAndCollect
   |                                 resolveTimeoutSeconds(lane "blocking")  [timeout.ts, D-BG-604 cap]
   |                                 installTimerLadder: SIGTERM at t, SIGKILL at t + 5 s
   |                                                        |
   |                                       hook script -> hook recorder -> {home}/harness/hook-runs.jsonl
   |                                       exit 2 -> blockNotices -> notify -> entry_appended record (RPC only)
   |                                                        |
   |  Then the hooks record these runs: <------ turn logs (lines added since the action began)
   |  Then the hooks show the user these messages: <---- turn records (RPC entry_appended)
```

### Recommended Project Structure
```text
features/hook/session-end.feature                         # NEW, "Feature: Hook session end"
features/step_definitions/hook/session-end.steps.ts       # NEW verb module (3 steps)
extensions/pi-claude-marketplace/bridges/hooks/timeout.ts # SessionEnd cap (additive)
test/bridges/hooks/timeout.test.ts                        # cap cases (paired, 100% direct coverage)
docs/hooks-compatibility.md                               # timeout row, SessionEnd part only
```

### Q1. RPC `switch_session` resume

**Session file format.** `CURRENT_SESSION_VERSION = 3` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js:11]. Pi writes a new header as:

```js
// session-manager.js:698-705 (verbatim)
const header = {
    type: "session",
    version: CURRENT_SESSION_VERSION,
    id: this.sessionId,
    timestamp,
    cwd: this.cwd,
    parentSession: options?.parentSession,
};
```

`loadEntriesFromFile` accepts a file whose first parsed entry has `header.type !== "session" || typeof header.id !== "string"` false, i.e. `type: "session"` and a string `id` [VERIFIED: session-manager.js:362-366]. `SessionManager.open(path, sessionDir, cwdOverride)` reads the header's `cwd` and, with no `sessionDir`, uses the file's parent directory: `const dir = sessionDir ? normalizePath(sessionDir) : resolve(resolvedPath, "..");` and returns `new SessionManager(cwd, dir, resolvedPath, true, ...)` (persisted) [VERIFIED: session-manager.js:1338-1359]. `switchSession` calls `SessionManager.open(sessionPath, undefined, options?.cwdOverride)`, `assertSessionCwdExists`, `teardownCurrent("resume", ...)` (which emits `session_shutdown` with `reason` `"resume"`), then `createRuntime({ cwd: sessionManager.getCwd(), ..., sessionStartEvent: { type: "session_start", reason: "resume", previousSessionFile } })` [VERIFIED: agent-session-runtime.js:102-112, 128-145]. The RPC handler: `case "switch_session": { const result = await runtimeHost.switchSession(command.sessionPath); if (!result.cancelled) { await rebindSession(); } return success(id, "switch_session", result); }` [VERIFIED: modes/rpc/rpc-mode.js:474-479].

**Minimal valid file** (one line plus newline; measured working):

```json
{"type":"session","version":3,"id":"<randomUUID()>","timestamp":"<new Date().toISOString()>","cwd":"<this.tokens.projectDir>"}
```

- `id`: use `randomUUID()`. It appears in `CLAUDE_ENV_FILE` (`path.join(loc.dataRoot, "_shared", \`claude-env-${transCtx.sessionId}.env\`)` checked by `assertPathInside`) [VERIFIED: bridges/hooks/hook-env.ts:98-99], so it must hold no path characters. The runs step reads it as `second` [VERIFIED: features/step_definitions/hook/runs.steps.ts:46,63-94].
- `cwd`: the sandbox project directory. `BeforeAll` builds the sandbox from `realpath(mkdtemp(...))`, so `this.tokens.projectDir` is already the realpath Pi compares [VERIFIED: features/support/pi-process.ts:133-142].
- **Placement:** `{agent dir}/sessions/<name>.jsonl`, directly under `sessions/`, not Pi's per-cwd subdirectory `--<encoded cwd>--` (`session-manager.js:291-296`). The encoded subdirectory name contains the sandbox path with dashes, which no run token projects, so a transcript-path cell under it would change every run. Directly under `sessions/`, the cell is the stable literal `{agent dir}/sessions/saved.jsonl`. Keep the file name free of the session id (the runs step replaces an embedded session id with its ordinal, `runs.steps.ts:88-91`).
- **Cleanup:** write with `{ flag: "wx" }` after `mkdir(..., { recursive: true })`, and register `this.onRelease(() => rm(file, { force: true }))`, as the compaction-settings Given does (`hook/session.steps.ts:234-243`). Pi appends a `model_change` and a `thinking_level_change` entry to the file when it resumes (measured), so assert the written text right after writing, never after the `When`. The next scenario's `Before()` empties the agent directory anyway [VERIFIED: features/support/pi-process.ts:226-235].

**Measured payloads** (probe, 2026-11-08, `Given the user has started a new pi session` then resume):

| event | session | reason | source | transcript path | CLAUDE_ENV_FILE |
|-------|---------|--------|--------|-----------------|-----------------|
| SessionEnd | first | resume | | (empty) | (absent) |
| SessionStart | second | | resume | `{agent dir}/sessions/saved.jsonl` | `{project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env` |

Both runs: `cwd` `{project dir}`, `CLAUDE_PROJECT_DIR` `{project dir}`, `CLAUDE_PLUGIN_ROOT` `{home}/marketplaces/fixtures/plugins/demo`, `CLAUDE_PLUGIN_DATA` `{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo`, `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` the run's ordinal, `CLAUDECODE` `1`. Response `{ success: true, data: { cancelled: false } }`; records in the window: the response only; no `entry_appended`. Elapsed 556 ms. The ended session's transcript path is empty because the profile Pi runs with `--no-session` (`test/e2e/_rpc.ts:285-287`) and `transcriptPath: ctx.sessionManager.getSessionFile() ?? ""` [VERIFIED: bridges/hooks/translation-context.ts:61]; the resumed session is persisted, so it reports the file.

**One SessionStart, not two.** RPC binds the extensions twice on a replacement (once through `finishSessionReplacement` -> `rebindSession`, once in the `switch_session` case), and the bridge drops the repeat by session id and Pi reason (SSDEDUP-01, `event-router.ts:1107-1123`). Measured: exactly one SessionStart `resume` run.

**What the new module must re-implement for the resume `When`** (step modules export nothing, so `recordSessionAction()` in `hook/session.steps.ts:123-137` cannot be imported). Its contract, step by step:

1. `const harness = world.profileHarness();` (fails when no profile Pi started)
2. `const lengths = await readLogLengths(harness);` (`features/lib/turn-records.ts:42`)
3. `const from = world.pi.recordCount();`
4. run the action; it resolves only after Pi answered, and Pi answers after its session handlers ran
5. `const records = world.pi.recordsSince(from);` and assert none is `extension_error` or an `extension_ui_request` whose `method` is in `DIALOG_METHODS` (exported from `features/lib/pi-process.ts:69`)
6. `const logs = await readLogLinesSince(harness, lengths);`
7. assert `modelCallsOf(logs)` (`features/lib/scripted-model/script.ts:294`) holds no `overflow` call
8. `world.recordTurn({ prompt: "switch_session", disposition: "handled", records, logs });`

The action: `const { response } = await this.pi.request({ type: "switch_session", sessionPath });` then assert `{ success: response.success, data: response.data }` deep-equals `{ success: true, data: { cancelled: false } }`. `RpcRequest` is `Readonly<{ type: string } & Record<string, unknown>>`, so the request type-checks as is [VERIFIED: features/lib/pi-process.ts:33]. Do not call `this.recordResults(...)`: the fork `When` does not either (`hook/session.steps.ts:364-382`).

### Q2. The json-mode one-shot `When`

- **Driver:** `runJsonModeCommand(launch, command, onRelease, timeoutMs = DEFAULT_JSON_MODE_MS)` with `const DEFAULT_JSON_MODE_MS = 25_000;` [VERIFIED: features/lib/pi-json-mode.ts:47,83-136]. It spawns Pi with `piArguments("json", [SCRIPTED_MODEL_EXTENSION])` plus `--provider faux --model faux-1`, stdin closed, its own process group; it throws `` `${command} in json mode failed or did not exit within ${timeoutMs} ms` `` on timeout, `` `... exited with ${exitCode}` `` on a non-zero exit, and `` `... emitted no claude-plugin payload` `` when the command emitted nothing. Launch from `await this.oneShotPiLaunch()` and pass `(release) => { this.onRelease(release); }`, exactly as `command.steps.ts:132-144` does.
- **Command:** `/claude:plugin list`. It needs no network, emits exactly one `cascade` payload in this setup (measured), and touches nothing installed. Expand tokens with `expandTokens(command, this.tokens)`.
- **Exit path:** json mode runs `runPrintMode`, whose `finally` calls `disposeRuntime()` -> `runtimeHost.dispose()`, which emits `session_shutdown` with `reason: "quit"` and waits for the handlers before Pi exits [VERIFIED: modes/print-mode.js:23-30,141-143; agent-session-runtime.js:296-303]. `disposeRuntime` unsubscribes stdout before `dispose()`, so a SessionEnd exit-2 notice is not printed in json mode and cannot reach the driver's payload parse (measured: exit-2 hook, exit 0, one payload).
- **Where the runs land:** the hook recorder appends to `harnessDirectory(process.env.HOME)` = `$HOME/harness` (`features/lib/hook-recorder.ts:98-106`, `features/lib/turn-records.ts:28-30`), and the one-shot Pi gets `HOME: sandbox.home` from `rpcChildEnvironment` (`test/e2e/_rpc.ts:235-245`). So its runs land in `world.profileHarness()`. A profile Pi must have started in the scenario (`profileHarness()` fails otherwise); `Given pi runs with the scripted model` provides it, and it also does the install.
- **Turn recording** (the `recordTerminalAction()` pattern, `hook/session.steps.ts:141-151`): read `lengths` before the run, run the driver, read `readLogLinesSince(harness, lengths)`, then `this.recordTurn({ prompt: command, disposition: "handled", records: [], logs })`. Do not call `this.recordResults(payloads, "command")` (D-BG-606): no step would compare the list rows, and the world fails a scenario whose rows go uncompared.
- **Measured runs** (project-scope install, hooks `start` SessionStart `*`, `end` SessionEnd `*` script exit 2), in append order:

| event | session | reason | source | transcript path | CLAUDE_ENV_FILE |
|-------|---------|--------|--------|-----------------|-----------------|
| SessionStart | first | | startup | (empty) | `{project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env` |
| SessionEnd | first | other | | (empty) | (absent) |

Other columns as in Q1 (`CLAUDE_PLUGIN_DATA` is the project-scope path). Elapsed 2.4 s for the whole one-shot run. The project-scope hooks run because the one-shot Pi shares the agent directory, whose `trust.json` the profile Pi wrote (`world.ts`, `trustSandboxProject`).

### Q3. The D-BG-604 cap in `timeout.ts`

Today's code [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/timeout.ts:61-72,100-124]:

```ts
const BLOCKING_EVENT_DEFAULT_SECONDS: Record<BucketAEvent, number | undefined> = {
  SessionStart: undefined,
  UserPromptSubmit: 30,
  PreToolUse: undefined,
  PostToolUse: undefined,
  PostToolUseFailure: undefined,
  PreCompact: undefined,
  PostCompact: undefined,
  SessionEnd: 1.5,
  Stop: undefined,
  StopFailure: undefined,
};
...
  const { raw, event, pluginId, lane } = opts;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
```

**Smallest additive change** (recommended shape; wording is the executor's):

```ts
/**
 * D-BG-604: Claude Code's SessionEnd budget, in seconds. A plugin hook's own
 * `timeout` does not raise it (E3), so it is both the default and the ceiling
 * of a turn-blocking SessionEnd hook.
 */
const SESSION_END_BUDGET_SECONDS = 1.5;

// in the table, the SessionEnd row only (no reorder):
  SessionEnd: SESSION_END_BUDGET_SECONDS,

/**
 * D-BG-604: caps a declared turn-blocking SessionEnd timeout at the budget,
 * with a debug line. Any other lane or event keeps the declared value.
 */
function capSessionEndTimeout(
  seconds: number,
  event: BucketAEvent,
  pluginId: string,
  lane: "blocking" | "background",
): number {
  if (lane !== "blocking" || event !== "SessionEnd" || seconds <= SESSION_END_BUDGET_SECONDS) {
    return seconds;
  }

  hookDebugLog(
    `resolveTimeoutSeconds: timeout ${seconds} on ${pluginId}/${event} (${lane}) exceeds ` +
      `the ${SESSION_END_BUDGET_SECONDS}s SessionEnd budget; using the budget`,
  );
  return SESSION_END_BUDGET_SECONDS;
}

// in resolveTimeoutSeconds, the declared branch only:
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return capSessionEndTimeout(raw, event, pluginId, lane);
  }
```

- The defaults table keeps its order and its other rows; the fallback path is untouched, so an undeclared or unusable SessionEnd value still resolves to 1.5 through the table. A reviewer who prefers not to touch the row value can keep `SessionEnd: 1.5` and accept the duplicated literal; either is inside the SessionEnd arm.
- `hookDebugLog(detail, tag = "hooks")` prints `[hooks] <detail>` only when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"` [VERIFIED: shared/debug-log.ts:22-26], which is what the existing test cases match with `/^\[hooks\]/`.
- **Call sites, both read this session:** blocking lane `dispatch-exec.ts:304-310` passes `lane: "blocking"` (`// This lane awaits the child, so the turn waits with it.`); background lane `async-rewake/registry.ts:208-215` passes `lane: "background"`. Only the blocking lane is capped by construction. Note that a plain `async: true` handler is not routed to the background lane today (`dispatchHookExec` branches on `asyncRewake === true` only, `dispatch-exec.ts:178`), so it is capped too; Phase 2 owns that branch.
- **Complexity:** the new function has one compound condition; `resolveTimeoutSeconds` gains no branch. Both ESLint `sonarjs/cognitive-complexity` and fallow health stay far under 15.
- **Unit cases to add to `test/bridges/hooks/timeout.test.ts`** (same arrange/act/assert form and debug-capture boilerplate as the existing cases at lines 120-153):
  1. caps a declared blocking SessionEnd timeout above 1.5 s and reports it: `raw: 60` -> `1.5`, exactly one line matching `/^\[hooks\]/`, `/timeout 60/`, `/<plugin>\/SessionEnd \(blocking\)/`, `/1\.5s SessionEnd budget/`.
  2. keeps a declared blocking SessionEnd timeout of exactly 1.5 s, quietly: `raw: 1.5` -> `1.5`, no debug line (the `<=` boundary).
  3. keeps a declared background SessionEnd timeout above the budget, quietly: `raw: 60`, `lane: "background"` -> `60`, no debug line.
  4. Existing cases already cover the other branches: `raw: 75` on `PreToolUse` blocking (other event, line 24-38), `raw: 3_600_000` on `PreToolUse` (line 361-375), `raw: 0.25` on SessionEnd blocking (below the cap, line 40-54). Case 1 changes no existing case. Direct coverage of the pair must stay 100% lines, functions, branches: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/timeout.ts`.
- **Other tests pinning uncapped behavior:** none. Searched `test/` and `test/integration/`: `exec-timer.test.ts:478` drives the ladder directly with 2 s (not through `resolveTimeoutSeconds`); `dispatch-exec.test.ts` declared timeouts (`37`, `12`, `2`, `1`, `60`) use `makeEntry`, whose default event is `"PreToolUse"` (`dispatch-exec.test.ts:523`); no `test/integration/hooks-*` test declares a SessionEnd timeout. No feature file declares a SessionEnd `timeout` (only `hook/session.feature` and `hook/messages.feature` declare SessionEnd hooks, neither with a timeout).

### Q4. Docs and comments that change

- `docs/hooks-compatibility.md:204`, the `timeout` row. Today's SessionEnd part [VERIFIED, verbatim]: "`SessionEnd`'s budget is applied per hook rather than shared across them, and a declared value there is not capped at upstream's 60 s". Replace only that clause, for example: "on `SessionEnd` a synchronous hook's declared value is capped at the 1.5 s budget, because a plugin hook's `timeout` does not raise Claude Code's budget (D-BG-604); the matching hooks start together, so they share the 1.5 s, except that a hook that ignores SIGTERM keeps the session for the 5-second kill grace, and `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` is not read (D-BG-605)". The Pi column stays ⚠ (the env variable and the bounded wait are still missing). Run mdformat through pre-commit; markdown is not Prettier's (`format:check` covers js/json/ts).
- No other doc row states the uncapped behavior or HKTO-01 (searched `docs/*.md`, README, CHANGELOG). Optional, not required: the "resume a saved session" row of the Session events table (`docs/hooks-compatibility.md:51`) has empty Notes; it could name `/resume` and RPC `switch_session`.
- `timeout.ts` comments: lines 49-55 (the defaults-table JSDoc) cite HKTO-01 and say the bridge "applies no upstream-style ceiling of its own"; rewrite to the D-BG-604 state. Lines 96-98 ("The upper bound deliberately lives with the timer, not here") need a qualifier: the timer still owns the representable-range clamp, and the SessionEnd ceiling is upstream's budget, not a timer property. No other comment in `bridges/hooks/` cites HKTO-01 (grep: only `timeout.ts:55`).
- Parent lines (last plan's SUMMARY, per CONTEXT specifics): close HKTO-01 in BACKLOG.md keeping D-BG-605's two items; add the SessionEnd wording to HOOKERRNOTE-01; new BACKLOG item for `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`; Key Decisions rows D-BG-601..606; one CHANGELOG line for the cap.

### Q6. Step texts for the new verb module

Proposed texts (all lower case outside quoted values; each names its own action, D-08):

| Keyword | Text | Used by |
|---------|------|---------|
| Given | `the user has a saved pi session {string} in the project` | resume reason scenario, resume matcher scenario |
| When | `the user resumes the saved pi session {string} with the hooks recording` | resume reason scenario, resume matcher scenario |
| When | `the user runs {string} in pi's json mode with the hooks recording` | json reason scenario, json failure outline |

**Ambiguity check** (every registered text read this session with a script over `features/step_definitions/**/*.steps.ts`): Cucumber expressions are anchored and `{string}` matches one quoted string, so `the user runs {string} in pi's json mode` (`command.steps.ts:133`) and `the user runs {string}` do not match the longer json text, and `the user has run {string}` / `... which failed` / `... which did not fail` do not match the saved-session Given. No existing text contains `saved pi session` or `resumes`. Validate the `{string}` session name against `/^[a-z0-9-]+$/` in the Given and build the path from it, so a scenario never types a path.

**Every other step already exists in a frozen module:**

- `model.steps.ts`: `pi runs with the scripted model`
- `marketplace/publishing.steps.ts`: `the marketplace {string} is published as a dir source`, `the marketplace {string} offers these plugins:`, `the marketplace {string} is added to the {word} scope`
- `hook/runs.steps.ts`: `the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:`, `the hooks record these runs:`, `the hooks record these runs in any order:`
- `command.steps.ts`: `the user has run {string}`
- `session.steps.ts`: `the user has started a new pi session`
- `hook/session.steps.ts`: `the user starts a new pi session with the hooks recording`, `the user quits pi with the hooks recording`, `the user has started pi in the terminal with the hooks recording`, `the user quits pi in the terminal with the hooks recording`
- `hook/messages.steps.ts`: `the hooks show the user these messages:`

The hooks table columns needed (`form`, `exit code`, `stderr`, `timeout`, `sleep`) all exist in `features/lib/hook-files.ts:206-232`; a hook name is `[a-z0-9-]+` (`hook-files.ts:162`), so the five matcher hooks are named e.g. `end-clear`, `end-resume`, `end-logout`, `end-prompt-input-exit`, `end-other` while the `matcher` cells keep the underscores. `logout` is in the SessionEnd closed set `const SESSION_END_REASONS = ["clear", "resume", "logout", "prompt_input_exit", "other"] as const;` [VERIFIED: domain/components/hook-events.ts:247], so the five-hook table installs with plain `the user has run "/claude:plugin install demo@fixtures --scope project"`.

### Planned scenarios (titles and the behavior each proves)

| # | Title (suggested) | Driver | Scope | Hooks declared | Expected runs |
|---|-------------------|--------|-------|----------------|---------------|
| 1 | Resuming a saved session runs SessionEnd with reason resume and SessionStart with source resume | Given new session, saved-session Given, resume When | project | `end` SessionEnd `*`, `start` SessionStart `*` | Q1 table (2 rows) |
| 2 | A command in pi's json mode runs SessionStart with source startup and SessionEnd with reason other | json When | project | `start` SessionStart `*`, `end` SessionEnd `*` | Q2 table (2 rows) |
| 3 | A SessionEnd matcher selects only the clear run of a new session | Given new session, new-session When | project | five SessionEnd matchers | one row, `end-clear`, `clear` |
| 4 | A SessionEnd matcher selects only the resume run of a resumed session | Given new session, saved-session Given, resume When | project | five SessionEnd matchers | one row, `end-resume`, `resume` |
| 5 | A SessionEnd matcher selects only the other run of an RPC stop | quit When | project | five SessionEnd matchers | one row, `end-other`, `other` |
| 6 | A SessionEnd matcher selects only the prompt_input_exit run of a terminal quit | terminal Given, terminal quit When | user | five SessionEnd matchers + `start` SessionStart `*` | one row, `end-prompt-input-exit`, `prompt_input_exit`, `CLAUDE_PLUGIN_DATA` `{agent dir}/pi-claude-marketplace/data/fixtures/demo` |
| 7 | Outline: A SessionEnd hook that `<failure>` does not keep the next session from starting | new-session When (no setup new session, see Pitfall 2) | project | `end` SessionEnd `*` script with the row's columns, `start` SessionStart `*` | SessionEnd first `clear`, SessionStart second `clear` |
| 8 | A SessionEnd hook that exits 2 shows its error and does not keep the next session from starting | new-session When | project | `end` script exit 2 stderr `cleanup failed`, `start` SessionStart `*` | as 7, plus message `info` / `SessionEnd:clear hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/end.sh]: cleanup failed` |
| 9 | Outline: A SessionEnd hook that `<failure>` does not keep pi from exiting after a json mode command | json When | project | `end` SessionEnd `*` script with the row's columns | SessionEnd first `other` |

Outline rows. Scenario 7 (3 rows): exit 1 + stderr; sleep 30, no timeout; timeout 60 + sleep 60. Scenario 9 (4 rows): the same three plus exit 2 + stderr. Every row uses `form` `script` (the behavior columns need it, `hook-files.ts` header comment). An empty Examples cell leaves its column unset. A `<failure>` column used only in the title keeps each row readable.

## Q5. Red proof per scenario

Each plan SUMMARY records the temporary edit, the failing output, and the revert. Run red proofs with `--parallel 1` or `2`: several end on a 25 s or 30 s timeout.

| Scenario(s) | Smallest temporary edit | Expected failure |
|-------------|-------------------------|------------------|
| 1, 4 | `payloads/session-end.ts:53-58`: move `case "resume":` into the `new` arm (returns `"clear"`) | 1: runs table `reason` `clear` vs `resume`. 4: the recorded run is `end-clear`, not `end-resume` |
| 2, 9 (all rows) | `payloads/session-end.ts:37-45`: move `case "json":` up to the `tui` arm | `reason` `prompt_input_exit` vs `other` |
| 3, 4, 5, 6 | `dispatch.ts:909-910`: the SessionEnd arm of `matchValue` returns `undefined` (line 983 then lets every hook fire) | five runs recorded where the table states one |
| 7 and 9, `timeout: 60` rows | without the D-BG-604 cap (`return raw;` in the declared branch) | 7: `When the user starts a new pi session with the hooks recording` fails with Cucumber's "function timed out, ensure the promise resolves within 30000 milliseconds" (`STEP_TIMEOUT_MS = 30_000`, `features/support/world.ts:88`). 9: `/claude:plugin list in json mode failed or did not exit within 25000 ms` |
| 7 and 9, sleep rows | `timeout.ts:69`: `SessionEnd: undefined` (falls back to 600 s) | same two messages. In 7 the hook outlasts the 30 s step timeout only by its own start time (sleep 30 vs a 30 s step), see Assumption A1 |
| 7 and 9, exit-1 rows; 9, exit-2 row | `dispatch-exec.ts` `close` handler (line 356-378): add `if (entry.claudeEvent === "SessionEnd" && code !== 0) { return; }` before `settle(...)`, so a failed SessionEnd hook is waited for forever | same two timeout messages |
| 8 | `dispatch.ts:506-511` (`blockNotices`): move `case "SessionEnd":` out of the hook-error arm into the `return []` arm | `the hooks show the user these messages:` gets no notice where the table states one (the runs `Then` still passes) |

Write scenarios 7 and 9 before or without the cap and record the `timeout: 60` rows red, or land the cap first and record the red proof by restoring `return raw;` temporarily. Either order is valid, since the plans own disjoint files in Wave 1.

## Q7. Gate and timing facts

- Measured (2026-11-08, `--parallel 2`, three probe scenarios including one worker's cold compile): 29 s wall. A profile Pi start is the dominant cost per scenario (13-20 s cold per worker, a few seconds warm; `PROFILE_PI_START_TIMEOUT_MS = 90_000`, `world.ts:100`).
- Per-row waits: an RPC slow row (sleep or `timeout: 60` after the cap) waits about 1.5 s per session end (measured 1.9 s for `new_session`; 1.6 s with a declared `timeout: 1`). Keeping `Given the user has started a new pi session` doubles it. A json row: one-shot start plus about 1.5 s; the plain json run measured 2.4 s. The RPC stop in scenario 5 waits up to `STOP_GRACE_MS = 5_000` (`features/lib/pi-process.ts:77`) for Pi to exit; in practice Pi exits within the hook time. The terminal scenario adds a terminal Pi start.
- Estimate for the whole new file: 14 scenario runs (6 + 3 + 1 + 4), about 1.5-2 minutes wall at `--parallel 2` on an idle machine. [ASSUMED: extrapolated from the probe; record the measured time in the SUMMARY]
- CI: `features/hook` runs in the adapter "components" leg (`paths: features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`, `timeout-minutes: 15`) [VERIFIED: .github/workflows/ci.yml:131-147]. The builtin leg runs `features` with `(@mcp or @builtin-only) and not @adapter-only`, so these untagged scenarios run once, under adapter. `test/architecture/behavioral-shard-coverage.test.ts` sees the new file inside the `features/hook` path; nothing to change.
- Iterate: `npx cucumber-js --profile adapter --parallel 2 features/hook/session-end.feature`; one scenario: `npx cucumber-js --profile adapter --name '<title>'`. Regression of the existing SessionEnd scenarios after the cap: `npx cucumber-js --profile adapter --parallel 2 features/hook/session.feature features/hook/messages.feature`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running a json-mode Pi | a new spawn helper | `runJsonModeCommand()` + `world.oneShotPiLaunch()` | Frozen driver already owns process groups, deadline, payload validation, release |
| Session id ordinals and token projection | own projection | `the hooks record these runs:` | Projects `{agent dir}`, `{project dir}`, `{home}`, ordinals, embedded ids |
| Hook processes that fail or sleep | own scripts | hooks table `form script` with `exit code`, `stderr`, `timeout`, `sleep` | Script records first, then fails; `sleep` keeps no pipe open |
| Detecting the exit-2 notice | own record filter | `the hooks show the user these messages:` | Validates the payload schema |
| Waiting for a terminal Pi's start | own wait | `the user has started pi in the terminal with the hooks recording` | Waits for the SessionStart `startup` run |

**Key insight:** the new module needs three steps and no library. Everything heavier is frozen and already proven by `hook/session.feature`.

## Common Pitfalls

### Pitfall 1: copying `recordSessionAction()` verbatim trips fallow dupes
**What goes wrong:** `npm run fallow` (`fallow dupes --fail-on-issues`) fails with a clone group between the new module and the frozen `hook/session.steps.ts`.
**Why it happens:** measured on 2026-11-08: a scratch module holding the helpers of `hook/session.steps.ts:88-137` gave `Duplicates (1 clone groups) 48 lines 2 instances` (`session.steps.ts:89-136`). `.fallowrc.json` has no `duplicates` block, and the frozen file cannot carry a marker.
**How to avoid:** write the turn recording in the new module in its own shape (the resume When inlines the eight steps of Q1 in a different statement layout, and a fault filter written against `DIALOG_METHODS` from `features/lib/pi-process.ts`), then run `npx fallow dupes --fail-on-issues --format human` and check `$?` (fallow prints a red summary on a passing tree). A `fallow-ignore-next-line code-duplication` marker is a last resort and needs a `--` justification.
**Warning signs:** `dup:` fingerprints naming `features/step_definitions/hook/session-end.steps.ts`.

### Pitfall 2: the setup new session also runs the slow hook
**What goes wrong:** in a failure scenario that keeps `Given the user has started a new pi session`, every slow row waits twice, and without the cap the `Given` times out, so the red proof names the setup instead of the action.
**Why it happens:** that Given ends the startup session, and the plugin's hooks are already active after the install.
**How to avoid:** leave the Given out of scenarios 7 and 8. The probe showed the startup session's SessionEnd runs on the `When` (SessionEnd `clear` recorded, 1.6 s). The runs then read `first` (startup session) and `second` (new session), as D-BG-603 states.

### Pitfall 3: recording the json command's payloads
**What goes wrong:** the scenario fails in `After` with "no step compared these rows of the last results".
**How to avoid:** the json `When` keeps only a turn (D-BG-606); never call `recordResults` there.

### Pitfall 4: stating a notice in json mode
**What goes wrong:** a json scenario that uses a hook notice step reads an empty turn (no RPC records) and either passes vacuously or fails.
**How to avoid:** no json scenario uses `the hooks show the user ...` (D-BG-606). Pi detaches stdout before `dispose()`, so a notice would not be visible anyway.

### Pitfall 5: a saved-session path that changes every run
**What goes wrong:** the transcript-path cell does not match on the next run.
**How to avoid:** put the file directly under `{agent dir}/sessions/`, not Pi's encoded per-cwd subdirectory, and keep the session id out of the file name (Q1).

### Pitfall 6: shared-file merge conflicts
**What goes wrong:** Phase 2 (async lane) may also touch `timeout.ts`.
**How to avoid:** keep the change to one new constant, one new function placed after the defaults table, one row value, and one line in the declared branch; no reformat of neighbors (Prettier on save only touches the edited lines).

### Pitfall 7: red-proof runs under load
**What goes wrong:** the 30 s / 25 s red proofs and the green runs share a machine with 14 other phases.
**How to avoid:** run in the background with `--parallel 2`, exit code to a file in the scratch dir; one rerun on a timeout failure, both runs recorded.

## Code Examples

### Saved-session Given (sketch)
```ts
// Pi's session header, version 3 (session-manager.js:11, 698-705). The file
// sits directly under the agent's sessions directory, so the resumed
// session's transcript path is a stable literal.
Given(
  "the user has a saved pi session {string} in the project",
  async function (this: ScenarioWorld, name: string) {
    assert.match(name, /^[a-z0-9-]+$/u);
    const file = path.join(this.tokens.agentDir, "sessions", `${name}.jsonl`);
    const text = `${JSON.stringify({
      type: "session",
      version: 3,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      cwd: this.tokens.projectDir,
    })}\n`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
```

### Resume reason scenario (sketch; tables use the measured values)
```gherkin
  Scenario: Resuming a saved session runs SessionEnd with reason resume and SessionStart with source resume
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | end   | SessionEnd   | *       |
      | start | SessionStart | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the user has a saved pi session "saved" in the project
    When the user resumes the saved pi session "saved" with the hooks recording
    Then the hooks record these runs:
      | event        | session | reason | source | cwd           | transcript path                  | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_ENV_FILE                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd   | first   | resume |        | {project dir} |                                  | end       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                            | first                  | first             | 1          |
      | SessionStart | second  |        | resume | {project dir} | {agent dir}/sessions/saved.jsonl | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env | second                 | second            | 1          |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SessionEnd declared `timeout` used as written (no ceiling) | capped at the 1.5 s budget on the blocking lane | this phase (D-BG-604) | A plugin cannot hold `/new`, a resume, or an exit for longer than 1.5 s plus the kill grace |
| HKTO-01 open (per-hook budget, no ceiling) | closed except D-BG-605's two items | this phase (parent line) | BACKLOG update by the parent |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The sleep-30 row of the RPC outline turns red reliably when the SessionEnd default is 600 s, because the hook starts after the step does and so outlasts the 30 s step timeout | Q5 | The red proof could pass once by a hair. Mitigation if seen: record the json row's red proof (25 s deadline) for that variant, or raise the row to sleep 60 as a dubious choice |
| A2 | 14 scenario runs take about 1.5-2 min at `--parallel 2` | Q7 | Only plan timing; measure and record |
| A3 | A shorter re-implementation of the turn recording (about 15 lines in a different layout) stays under fallow's clone threshold | Pitfall 1 | `npm run fallow` fails; the plan's verify step catches it |
| A4 | Dropping `the user has started a new pi session` from scenarios 7 and 8 is acceptable to the reviewer | Pitfall 2 | Keep it; red proofs then land in the Given |

## Open Questions

1. **Keep or drop the setup new session in the failure scenarios?**
   - What we know: both work; dropping halves the wait and puts the red proof on the `When`.
   - Recommendation: drop it in scenarios 7 and 8, keep it in 1, 3, and 4 for consistency with `hook/session.feature`; record as a dubious choice.
2. **Constant or duplicated literal for the budget?**
   - Recommendation: one `SESSION_END_BUDGET_SECONDS` used by the SessionEnd row and the cap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v26.13.0 (CI 24) | -- |
| Pi CLI | all scenarios | yes | 1.5.0 | -- |
| cucumber-js | scenarios | yes | 13.3.0 | -- |
| fallow | gate | yes | 3.41.0 | -- |
| `/bin/sh`, `sleep` | script hooks | yes | system | -- |
| Optional peers cache | adapter profile | yes (probe ran) | `node_modules/.cache/optional-peers` | -- |
| `/tmp` inodes | cucumber sandboxes, `/tmp/jiti` | yes | 5% used (48956 of 1048576) | -- |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js 13.3.0 (behavioral); `node:test` (unit) |
| Config file | `cucumber.json` (frozen), profiles `adapter` and `builtin` |
| Quick run command | `npx cucumber-js --profile adapter --parallel 2 features/hook/session-end.feature` |
| Full suite command | `npm run check` (both cucumber profiles, static checks, direct coverage) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEND-01 (1) | each reason Pi can produce runs SessionEnd with Claude's reason and payload: `resume` (scenario 1), `other` in json mode (2); existing `clear`, `resume` by fork, `other` by RPC stop, `prompt_input_exit` stay in `hook/session.feature` | behavioral | `npx cucumber-js --profile adapter --parallel 2 features/hook/session-end.feature features/hook/session.feature` | new file: Wave 1 |
| SEND-01 (2) | a matcher for each reason Pi produces selects only that run (3, 4, 5, 6); `logout` never runs | behavioral | same | new file: Wave 1 |
| SEND-01 (3) | exit non-zero, exit 2, past timeout: next session starts (7, 8) or Pi exits (9), run recorded | behavioral | same | new file: Wave 2 |
| D-BG-604 | declared blocking SessionEnd timeout capped at 1.5 s with a debug line; 1.5 kept; background kept | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/timeout.test.ts` and `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/timeout.ts` | exists; add 3 cases |
| D-BG-604 (behavior) | `timeout: 60` rows of 7 and 9 end within the budget | behavioral | scenario 7/9 rows | Wave 2 |
| step hygiene | no unused, undefined, or ambiguous step; layout rules | static | `npm run check:features` | -- |
| clone hygiene | no clone group with the frozen session steps | static | `npx fallow dupes --fail-on-issues --format human` (check `$?`) | -- |

### Sampling Rate
- **Per task commit:** the pre-commit hook runs `npm run check:commit` (static checks plus direct coverage of the staged pairs); plus the scenario file at `--parallel 2`.
- **Per wave merge:** `npm run check` on the combined tree, in the background, exit code to a file.
- **Phase gate:** `npm run check` and `npm run test:modules`, both green, before `/gsd-verify-work`.

### Wave 0 Gaps
None. The test infrastructure exists; the new files are the phase's own work.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no (Pi sessions, not web sessions) | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | `resolveTimeoutSeconds` stays the single narrowing point for the untyped `timeout` field; the cap adds an upper bound on one lane and event |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A plugin's SessionEnd hook holds `/new`, a resume, or an exit open with a long declared `timeout` | Denial of service | D-BG-604 cap (1.5 s plus the 5 s SIGKILL grace); the residual grace and a pipe-holding grandchild are D-BG-605 / HKDR-01 |
| A crafted session id reaches a file path (`claude-env-<id>.env`) | Tampering | existing `assertPathInside` in `hook-env.ts:99`; the test Given uses `randomUUID()` |
| Test writes outside the sandbox | Tampering | the Given writes only under `this.tokens.agentDir` (the sandbox agent dir), with `wx` and a release |

## Sources

### Primary (HIGH confidence)
- Pi 1.5.0 `dist/core/session-manager.js` (lines 11, 291-296, 326-369, 698-705, 1338-1359), `dist/core/agent-session-runtime.js` (102-145, 296-303), `dist/modes/rpc/rpc-mode.js` (225-290, 474-479), `dist/modes/print-mode.js` (1-150), read this session.
- Extension: `bridges/hooks/timeout.ts`, `payloads/session-end.ts`, `event-router.ts` (879-906, 1090-1170), `dispatch.ts` (240-300, 480-560, 855-1000), `dispatch-exec.ts` (140-215, 296-380), `async-rewake/registry.ts` (195-225), `translation-context.ts:61`, `hook-env.ts:98-99`, `domain/components/hook-events.ts:236-250`, `shared/debug-log.ts:22-26`.
- Harness: `features/lib/pi-json-mode.ts`, `hook-recorder.ts`, `hook-files.ts`, `pi-process.ts`, `pi-commands.ts`, `features/support/world.ts`, `features/support/pi-process.ts`, `test/e2e/_rpc.ts` (225-290); step modules `hook/session.steps.ts`, `hook/runs.steps.ts`, `hook/messages.steps.ts`, `session.steps.ts`, `command.steps.ts`.
- Scratch probe, 2026-11-08: two `npx cucumber-js --profile adapter` runs over a deleted scratch feature (resume, json exit 2, slow new session with and without the setup session), both exit 0; and one `npx fallow dupes` run over a deleted scratch copy of the session helpers.
- Upstream contract: 06-CONTEXT.md E1-E5 (Claude Code 2.1.319 binary and https://code.claude.com/docs/en/hooks, read 2026-11-08 by the discuss step).

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- Timing estimate for the full file (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new package; versions read locally.
- Architecture: HIGH - every path read in source and the three new flows measured end to end.
- Pitfalls: HIGH for 1, 2, 3, 5 (measured or read); MEDIUM for the timing-related 7.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08, or until Pi leaves 1.5.0 or a sibling phase changes `timeout.ts` or `dispatch.ts`.
