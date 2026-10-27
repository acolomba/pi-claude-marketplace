# Phase 8: Background Autoupdate - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous smart discuss (wave 1 of `plugin-lifecycle`; no user questions, per the parent session's rules)

<domain>
## Phase Boundary

After the first message of a session, a marketplace whose autoupdate is on is refreshed and its installed plugins are updated in the background, after a random delay, as Claude Code does. A `/claude:plugin` command that runs at the same time in the same Pi process is never refused or corrupted by that run. When the run moved at least one plugin, the user gets one passive notice that names the plugins and the `/reload` step; a run that changed nothing is silent.

Requirements: AUP-01, AUP-02, AUP-03. Backlog: AUTOUP-01.

Out of scope: a new refresh or cascade (the pass reuses `marketplace update`'s code); the missing-dependency settle after an update (Phase 2, RCN-06, reached through the reused cascade); reserved official names (Phase 5, MKT-01); command-sourced plugins (no such source kind in this project).

</domain>

<upstream_evidence>
## Claude Code Evidence Records

Upstream contract checked against the Claude Code **2.1.310** binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`, strings grepped 2026-10-26) and the docs pages `discover-plugins`, `plugins/loading` ("When auto-update runs"), `plugins/host-marketplace` ("What background auto-update does with credentials"), and `env-vars`, all fetched 2026-10-26.

### E1. When the pass runs, and its delay

- **Claude Code:** "In an interactive session, after you send your first message, Claude Code waits a random delay of up to ten minutes. It then refreshes every marketplace with auto-update on and updates the plugins installed from them on disk" (`plugins/loading`). The binary's pass sleeps `Math.floor(Math.random()*I)` with `var I=600000` on an unref'd timer, inside a background-housekeeping step that `claim()`s once per process.
- **Evidence:** binary strings (`Plugin autoupdate: checking installed plugins`, `var I=600000`, `backgroundHousekeeping.claim()`); docs.
- **Confidence:** high.
- **Unresolved:** none for the delay. The binary's "interactive" test is a minified predicate; the docs state the rule.
- **Pi constraints:** Pi has no single process-lifetime for extension state: `/reload`, `new`, `resume`, and `fork` rebuild the extension runtime (`session_shutdown`, then a fresh factory). Pi fires `input` for a submitted prompt that is not an extension command (`agent-session.js`: extension commands run before `_runInputHandlers`). `ctx.hasUI` is true in `tui` and `rpc`, false in `print` and `json`.
- **Divergence:** once per extension runtime instead of once per process (Pi capability gap: no process-lifetime hook for an extension).

### E2. Which marketplaces auto-update by default

- **Claude Code:** first set wins: `autoUpdate` on the `extraKnownMarketplaces` settings entry, then `autoUpdate` on the `known_marketplaces.json` entry, then the default: on for the official names (`claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`, `life-sciences`, `knowledge-work-plugins`, `claude-for-legal`, `claude-for-financial-services`, `financial-services-plugins`, `first-party-plugins`, `claude-tag-plugins`) except `knowledge-work-plugins` and `first-party-plugins`; on for `claudeai` and `pluginDirectory` sources; off for every other marketplace.
- **Evidence:** binary `function d$e(e,n,s){if(s!==void 0)return s;if(n.autoUpdate!==void 0)return n.autoUpdate;if(n.source?.source==="claudeai")return!0;if(n.source?.source==="pluginDirectory")return!0;...return u4e.has(r)&&!Ks.has(r)}` with the `u4e` and `Ks` sets above; docs `discover-plugins` and `plugins/loading`.
- **Confidence:** high.
- **Unresolved:** none upstream.
- **Pi constraints:** this project stores the flag in `claude-plugins.json` / `.local.json` (local wins, LAYER-09) and reads `?? false` in five places (`marketplace/update.ts`, `marketplace/list.ts`, `marketplace/autoupdate.ts`, `orchestrators/scope-fanout.ts`, and through it `plugin/info.ts`). `bootstrap` writes `autoupdate: true` for `claude-plugins-official` and its first run reports `(autoupdate enabled)` (`features/plugin/bootstrap.feature`). Phase 5 (MKT-01) makes `marketplace add` refuse the reserved official names, so `bootstrap` stays the route to the official marketplace. Pi has no claude.ai or plugin-directory source.
- **Divergence:** see D-PL8-07.

### E3. Operator opt-outs

- **Claude Code:** `DISABLE_UPDATES` (bool), `DISABLE_AUTOUPDATER` (truthy: `1`/`true`/`yes`/`on`, case-insensitive, trimmed), or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (any non-empty value) turn the whole plugin pass off, unless `FORCE_AUTOUPDATE_PLUGINS` (bool) is set. Claude Code's own global-config `autoUpdates: false` and a host pin (`CLAUDE_CODE_AUTOUPDATER_DISABLED_BY_HOST`) also turn it off. With the pass off, the `/plugin` Enable auto-update toggle is hidden.
- **Evidence:** binary `function Due(){if(i.FORCE_AUTOUPDATE_PLUGINS)return!1;if(!i.CLAUDE_CODE_AUTOUPDATER_DISABLED_BY_HOST)return ebe();...}`, `function Ch(e){if(i.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"};let n=ZAt();...if(r.autoUpdates===!1&&...)return{type:"config"}`, `function Ne(e){...return["1","true","yes","on"].includes(n)}`, `function ZAt(){if(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)return...}`, the env registry (`FORCE_AUTOUPDATE_PLUGINS:()=>ID`, `ID=D.bool()`, `DISABLE_UPDATES:()=>oD`, `oD=D.bool()`); docs `plugins/loading` and `env-vars`.
- **Confidence:** high for the names and the rule; medium that `D.bool()` parses exactly as `Ne` (the registry parser body was not read).
- **Unresolved:** `D.bool()`'s exact accepted spellings.
- **Pi constraints:** this extension already reads one Claude Code variable (`CLAUDE_CONFIG_DIR`, import). Pi has no Claude Code global config and no host pin.
- **Divergence:** see D-PL8-08.

### E4. The notice

- **Claude Code:** one passive, low-priority notification, 10 s timeout: `Plugin updated: <name>` for one plugin, `Plugins updated: <a> and <b>` for two, `Plugins updated: <n> plugins` for more (names are plugin ids with `@marketplace` stripped, deduplicated), followed by ` · Run /reload-plugins to apply` when not reloaded in session. Nothing updated: no notification. Failures and skips are logged only (`Plugin autoupdate: failed to refresh marketplace ...`, `... failed to update ...`); blocked plugins go to the `/plugin` Errors tab.
- **Evidence:** binary notice composer `et=Ge.length<=2?Ge.join(" and "):\`${Ge.length} plugins\``, `{text:\`${Ge.length===1?"Plugin":"Plugins"} updated: ${et}\`}`, `yt=" · Run /reload-plugins to apply"`, `priority:"low",timeoutMs:1e4`; docs `discover-plugins` ("you see `Plugin updated: <name> · Run /reload-plugins to apply`").
- **Confidence:** high.
- **Unresolved:** none.
- **Pi constraints:** Pi's reload command is `/reload`. Every output goes through `shared/notification-dispatch.ts` (IL-2): `ctx.ui.notify` in `tui`/`print`, a `claude-plugin` entry through `pi.appendEntry` in `json`/`rpc`. Load-origin surfaces (`reconcile-aborted`, `plugin-path-skipped`, `mcp-migration`) already fire with no command behind them.
- **Divergence:** `/reload` for `/reload-plugins` (Pi command name); no in-session auto-reload (Claude Code reloads only command-sourced plugins in session; this project has no command source).

### E5. Credentials in the background

- **Claude Code:** the background check uses the configured git credential helpers and never prompts; a helper that must prompt makes the update fail quietly and the checkout stays.
- **Evidence:** docs `plugins/host-marketplace`.
- **Confidence:** high.
- **Pi constraints:** `orchestrators/auth-host.ts::buildAuthForHost` already gives a run whose origin is not `command` stored credentials only and no Device Flow (AAP-02 / D-13 / D-3-04).
- **Divergence:** none.

### E6. Concurrency with a foreground command

- **Claude Code:** no upstream position: Claude Code runs the pass in its own process and has no cross-command state lock.
- **Pi constraints:** every state mutation runs under `withLockedStateTransaction` (`proper-lockfile`, `retries: 0`, not re-entrant, D-06); a second holder gets `StateLockHeldError` (`{lock held}`). Pi runs a `/claude:plugin` command through `pi.registerCommand`'s handler (`edge/register.ts`). Pi awaits `session_shutdown` handlers before it builds the next runtime.
- **Divergence:** not applicable; recommended from project constraints (D-PL8-04, D-PL8-05).

</upstream_evidence>

<decisions>
## Implementation Decisions

### Trigger, timing, and lifetime (AUP-01)

- **D-PL8-01: the background pass is not a load.** APL-D1 still holds: a load (`/reload`, session start) changes no installation state. The pass is a separate run that starts after the first message, touches only marketplaces whose autoupdate is on (the user's opt-in), and runs `marketplace update`'s refresh and cascade. NFR-5 amendment (for PROJECT.md): the background autoupdate pass runs `marketplace update`'s code for each marketplace with autoupdate on, so it may use the network as that command does, with stored credentials only (D-PL8-12).
- **D-PL8-02: arm on the first message, run once per extension runtime.** The pass arms on the runtime's first Pi `input` event (a submitted prompt that is not an extension command, which is Claude Code's "after you send your first message"), only in an interactive mode: `ctx.mode` `tui` or `rpc` (Pi's `hasUI` modes). `print` and `json` never arm (Claude Code: interactive sessions only). It waits `Math.floor(random() * maxDelay)` ms with `maxDelay` = 600 000 (10 minutes, the binary's constant) on an unref'd timer, then runs once. A later `input` in the same runtime does nothing. A new runtime (`/reload`, new, resume, fork) arms again on its own first message.
- **D-PL8-03: teardown and NFR-2.** `session_shutdown` cancels a pending timer and stops further steps. For `reload`, `new`, `resume`, and `fork` it awaits the step in flight, so the next runtime's load pass never meets this runtime's state lock. For `quit` it returns at once (the process ends; `proper-lockfile` releases its locks on exit). No throw escapes the `input` handler, the `session_shutdown` handler, or the timer callback: each failure goes to `hookDebugLog`, as `resources_discover` and `session_start` do today.

### Foreground priority and lock contention (AUP-01)

- **D-PL8-04: an in-process gate gives `/claude:plugin` commands priority.** Every `/claude:plugin` command invocation runs through the gate's `runForeground`: it waits for the background step in flight and holds back further steps until the command returns. A background step is one marketplace refresh (`updateMarketplace` up to its cascade) or one plugin update; the pass checks the gate before its first step and yields between plugin updates (the cascade runs outside the scope lock, MU-4), so a command waits at most one step. So no command in this Pi process is refused `{lock held}` or reads a half-done step because of the background pass. The wait is silent. Commands are not serialized among themselves (unchanged).
- **D-PL8-05: the background pass skips what another process holds.** A step that meets `StateLockHeldError` (another Pi process holds the scope lock) is skipped for this pass and not retried in this runtime; the next runtime's pass tries again. A command in another Pi process can still meet `{lock held}` while this process's background step holds the lock: the same exposure two concurrent commands in two processes have today, under D-06 (`retries: 0`) unchanged.

### Reuse (AUP-01)

- **D-PL8-06: the pass reuses `marketplace update <name>`.** For each scope (project first, MSG-GR-3) and each recorded marketplace whose merged config `autoupdate` is true (the value the cascade itself reads), the pass calls `updateMarketplace` with: a load-origin run (`{ kind: "load" }`) whose output sink and context are silent (the per-marketplace rows are not shown; their text goes to `hookDebugLog`), and the plugin update runner from `beginPluginUpdateRun`, wrapped to yield to the gate before each plugin and to collect each `updated` outcome. Refresh, cascade, dependency handling, rollback, and cache drop stay in `update.ts` and `update-flow.ts`, unchanged. An `InvalidGitHubBaseUrlError` that `updateMarketplace` rethrows ends the pass silently (debug log).

### Defaults and opt-outs (AUP-02)

- **D-PL8-07: per-marketplace default stays "off unless the config sets it".** Claude Code's default-on set is the official names; in this project the official marketplace gets `autoupdate: true` from `bootstrap` (MPA-01, `features/plugin/bootstrap.feature`), and Phase 5's reserved-name refusal (MKT-01) keeps `bootstrap` the route to an official name. Claude Code's other default-on sources (`claudeai`, `pluginDirectory`) have no Pi counterpart (capability gap). Precedence maps directly: config local entry, then base entry (LAYER-09), then off; Claude Code: settings entry, then `known_marketplaces.json`, then the default. `marketplace/autoupdate.ts` is not changed.
- **D-PL8-08: Claude Code's opt-out variables, same names and rule.** `DISABLE_UPDATES` (truthy), `DISABLE_AUTOUPDATER` (truthy), or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (any non-empty value) turn the pass off unless `FORCE_AUTOUPDATE_PLUGINS` (truthy) is set. Truthy is `1`, `true`, `yes`, or `on`, case-insensitive, trimmed (the binary's `Ne`). The pass reads them when it arms. Not mapped: Claude Code hides the `/plugin` toggle when the pass is off, but `marketplace autoupdate` / `noautoupdate` stay available here because the flag also scopes the manual `marketplace update` cascade; Claude Code's global-config `autoUpdates` and host-pin variables are Claude Code binary settings with no Pi meaning and are not read.
- **D-PL8-09: one Pi-only knob for the delay.** `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`, a non-negative whole number of milliseconds, replaces the 10-minute maximum of the random delay; `0` runs the pass right after the first message. Any other value is ignored (the 10-minute maximum applies). It exists so the behavioral test and an operator can run the pass without waiting up to ten minutes; it follows the `PI_CLAUDE_MARKETPLACE_*` naming of the extension's other variables.

### The notice (AUP-03)

- **D-PL8-10: one load-origin notice kind, `background-update`.** After the pass, when at least one plugin moved (an `updated` outcome), the pass raises one `background-update` notice through `shared/notification-dispatch.ts` with the real context and a load-origin run; otherwise it is silent. Failures, skips, and up-to-date results are debug-logged only (Claude Code logs them). Text, after Claude Code with Pi's reload command, names deduplicated by `<plugin>@<marketplace>`:
  - one plugin: `Plugin updated: alpha · Run /reload to apply`
  - two: `Plugins updated: alpha and beta · Run /reload to apply`
  - three or more: `Plugins updated: 3 plugins · Run /reload to apply`
  Severity `info`. JSON wire payload: `kind: "background-update"`, `origin: { kind: "load" }`, `severity: "info"`, `needsReload: true`, `plugins: [{ name, marketplace, scope, fromVersion?, toVersion }]` in pass order, one row per updated install (a plugin updated in both scopes has two rows).
- **D-PL8-11: no in-session reload.** Claude Code reloads command-sourced plugins in the running session; this project has no command source kind, so the notice always asks for `/reload`.
- **D-PL8-12: stored credentials only.** The pass's load-origin run makes `buildAuthForHost` return a stored-credential bundle with no Device Flow (existing AAP-02 / D-13 behavior), matching Claude Code's "never prompts".

### Research follow-ups (settled after RESEARCH.md)

- **D-PL8-13: arm on any `input` source.** `interactive`, `rpc`, and `extension` inputs all arm the pass (in RPC the source is `rpc`); the mode gate of D-PL8-02 decides interactivity. A UserPromptSubmit hook that blocks the prompt before this handler runs leaves the pass unarmed for that message; the next message arms it.
- **D-PL8-14: the delay knob rejects values Node cannot schedule.** `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` above 2147483647 (Node clamps it to 1 ms) is invalid and falls back to the 10-minute maximum.
- **D-PL8-15: a stopped runtime never notifies.** After `session_shutdown` the pass sets a stopped flag; the notice and every later step check it, and a stale-context throw is caught and debug-logged.
- **D-PL8-16: `fromVersion` stays optional on the wire** (D-PL8-10); the pass fills it from the outcome, where it is always present today.
- **Known limit:** the gate has no timeout. A background git fetch that stalls holds a waiting `/claude:plugin` command for as long as it stalls (`platform/git.ts` sets no timeout); the same fetch run by `marketplace update` in the foreground would stall that command the same way.

- **D-PL8-17 (after code review): a pass that ends early still reports what moved.** When the pass stops on an `InvalidGitHubBaseUrlError` after at least one plugin moved, it still raises the `background-update` notice (unless the runtime stopped); D-PL8-06's "ends the pass silently" holds only when nothing moved (review WR-03).
- **D-PL8-18 (after code review): a mid-cascade opt-out stops the cascade.** Before each plugin update, after the gate lets the step start, the pass re-reads the marketplace's merged `autoupdate`; if a command turned it off during the yield, the remaining plugins of that marketplace are not updated (review WR-04).
- **Known limit (review IN-04):** the `session_shutdown` wait for the step in flight (D-PL8-03) has no timeout either, so a stalled background fetch also holds `/reload`, new, resume, and fork until it ends.

### Claude's Discretion

- Module split, names, and test layout, inside the Files line: the gate, the scheduler, the pass, and the env policy live in new `orchestrators/marketplace/` modules (the gate may be its own module).
- The debug-log wording and category.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `orchestrators/marketplace/update.ts::updateMarketplace` -- the `marketplace update <name>` body: scope resolve, locked refresh, cache drop, and the cascade through the injected `PluginUpdateFn`; every result goes out through `notifyWithContext(ctx, run, ...)`.
- `orchestrators/plugin/operations.ts::createUpdateOperations(...).beginPluginUpdateRun({ ctx, run })` -- the cascade's per-run `PluginUpdateFn`; `index.ts` already builds `pluginUpdateOperations`.
- `shared/notification-run.ts` -- `NotificationRun` (`origin`, `entrySink`, `softDeps`), `openNotificationRun`, `openNotificationSnapshot`.
- `shared/notification-dispatch.ts::emitLoadSurface` -- the load-origin raw-surface path (`notifyPluginPathSkipped`, `notifyMcpMigration` are the patterns).
- `persistence/config-merge.ts::loadMergedScopeConfig`, `persistence/state-io.ts::loadState`, `persistence/locations.ts::locationsFor`.
- `shared/debug-log.ts::hookDebugLog`.

### Established Patterns

- Raw surface kinds: `notification-types.ts` (surface interface + `LoadSurface` union), `notification-resolve.ts` (`RAW_SURFACE_SEVERITY`, `resolveRawSurface`), `notification-grammar.ts` (`formatRawSurface`), `notification-json.ts` (`wireRawSurface`), `notification-wire.ts` (payload schema + `NOTIFICATION_PAYLOAD_SCHEMA` union), `notification-dispatch.ts` (`isRawOutcome`, exported helper). `mcp-migration` is the precedent for a raw kind that needs a reload (`needsReload` decided outside the severity table).
- Exhaustive switches: a new kind is a compile error at every consumer until it has an arm (TS7030 under `noImplicitReturns`).
- DI over test seams (CONVENTIONS): the scheduler takes `setTimeout`/`clearTimeout`/`random`/`env` as parameters; `index.ts` binds the real ones.
- NFR-2 boundary: Pi lifecycle handlers in `index.ts` wrap every await in try/catch and debug-log.

### Integration Points

- `index.ts`: build the gate and the background updater; `pi.on("input", ...)` arms; `pi.on("session_shutdown", ...)` stops; the gate goes to `registerClaudePluginCommand` through its `options` bag.
- `edge/register.ts::registerClaudePluginCommand`: the command handler runs through the gate (outside the Files line; one option and one wrap -- see Files note below).
- `features/`: a dedicated Pi (like `usePiWithGitHubBaseUrl`) with `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS=0`, a plain prompt to fire `input` (it fails for want of a model after the input handlers ran), then the session entries hold the notice.

### Files note

The Files line names `index.ts`, the new background module(s), `marketplace/autoupdate.ts` (defaults only), `shared/notification-types.ts` (one kind), and `docs/`. A new raw kind needs an arm in each exhaustive consumer (`notification-resolve.ts`, `notification-grammar.ts`, `notification-json.ts`, `notification-wire.ts`, `notification-dispatch.ts`) and the matching tests and docs; the foreground gate needs `edge/register.ts` to run the command handler through it; the behavioral test needs a world helper and steps under `features/`. Each is a minimal, additive change, recorded in the SUMMARY under files touched outside the Files line. `marketplace/autoupdate.ts` stays untouched (D-PL8-07).

</code_context>

<specifics>
## Specific Ideas

- Claude Code's notice text, with `/reload`: `Plugin updated: <name> · Run /reload to apply`.
- The binary's 10-minute constant and once-per-process claim, mapped to once per Pi extension runtime.

</specifics>

<deferred>
## Deferred Ideas

- Settling missing dependencies after a background update (Claude Code does it in the same pass): Phase 2 (RCN-06) owns the dependency step; the pass inherits whatever the reused cascade does.
- Retrying a marketplace skipped for a lock another process held, within the same runtime.
- A visible "waiting for background update" line while a command waits on the gate.

</deferred>

## Uncertain choices (for user review)

1. **D-PL8-02, mode gate includes `rpc`.** Chose `tui` and `rpc` (Pi's `hasUI` modes) as "interactive". Alternative: `tui` only, treating `rpc` like Claude Code's SDK/`-p` (non-interactive). `rpc` drives editor front ends where a person is present, and the behavioral test needs it.
2. **D-PL8-02, once per extension runtime.** Chose to arm again in each runtime (`/reload`, new, resume, fork). Alternative: once per process through process-global state, which this project avoids (no module-level business state) and which `/reload` re-evaluates anyway.
3. **D-PL8-03, `quit` does not wait for the step in flight.** Chose to return at once on quit. Alternative: wait on every shutdown reason, which could hold Pi's exit on a slow git fetch.
4. **D-PL8-04, a command waits silently on the gate.** Chose a silent wait of at most one background step. Alternative: print a "waiting" line, or refuse the background step instead (impossible to guarantee once it holds the lock).
5. **D-PL8-05, cross-process contention unchanged.** A command in another Pi process can still get `{lock held}` while this process's background step holds the scope lock. Alternative: lock retries for foreground commands, which reverses D-06 (`retries: 0`) for every command and is outside this phase.
6. **D-PL8-07, no read-time official-name default.** Chose to keep "off unless set" and rely on `bootstrap` + MKT-01 for the official marketplace. Alternative: read-time default-on for Claude Code's official names at all five readers; it would also turn `bootstrap`'s first-run `(autoupdate enabled)` row into `{already autoupdate}` and change Phase 2 and Phase 5 surfaces. Gap left: an official-named marketplace declared in `claude-plugins.json` or imported without an `autoupdate` value stays off here, on in Claude Code.
7. **D-PL8-08, reading Claude Code's variables in Pi.** Chose to honor `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `FORCE_AUTOUPDATE_PLUGINS` with Claude Code's names and rule. Alternative: `PI_CLAUDE_MARKETPLACE_*` names of our own, which a user migrating from Claude Code would not know. Also unsettled: whether Claude Code's `D.bool()` accepts exactly `1`/`true`/`yes`/`on`.
8. **D-PL8-09, a Pi-only delay variable.** `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` has no Claude Code counterpart. Alternative: no knob, and a behavioral test that cannot wait ten minutes, so the user-visible notice would rest on unit tests only.
9. **D-PL8-10, notice text after Claude Code.** Chose Claude Code's one-line wording with `/reload`. Alternative: the house row grammar (`● alpha [user] (updated)` rows plus the `/reload to pick up changes` trailer), as `mcp-migration` does.
10. **Known limit, no gate timeout.** A stalled background fetch holds a waiting command. Alternative: a wait cap after which the command runs anyway and may meet `{lock held}`.
