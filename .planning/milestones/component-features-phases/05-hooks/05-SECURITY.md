---
phase: "05"
slug: "hooks"
status: open
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of the 9 plans (`05-01-PLAN.md` to `05-09-PLAN.md`), written at plan time. `T-05-SC` appears in all nine plans and is one threat. After the merge the parent changed T-05-28 from `transfer` to `mitigate` and added T-05-31 by hand. The 2026-11-02 re-audit added T-05-32, T-05-33, and T-05-34, which no plan registered.

**2026-11-02 post-merge re-audit.** Every row was checked again against the merged tree at `5eb0ddc` (branch `claude/quirky-planck-hhm592`). That tree holds Phases 2, 3, 4, 6, and 7, the three hooks code-review fix rounds (`0d877aa`..`a17639b`), and the parent's post-merge fixes (`29a755e`..`eb838b6`). Depth is ASVS level 1; for T-05-28 every route that writes or reads the user's project ledger was also traced. Block threshold: `high`. Line numbers below are for `5eb0ddc`. Runs on this tree:

- `npx cucumber-js features/hook`: 77 scenarios passed.
- `npx cucumber-js features/skill/project-autoapply.feature features/marketplace/background-update.feature features/plugin/autoapply.feature`: 48 scenarios passed.
- `node --test` on `test/bridges/hooks/{event-router,stage,project-ledger,dispatch-exec,on-failure}.test.ts`, `test/orchestrators/marketplace/background-pass.test.ts`, `test/orchestrators/reconcile/load.test.ts`, `test/shared/notification-resolve.test.ts`, `test/persistence/project-installs.test.ts`: 503 passed, 0 failed.
- Four throwaway probe scenarios, run from outside the repository with the existing steps and not committed. Each starts from the `features/hook/project-provenance.feature` Background (a `PreToolUse` hook that records its runs, installed at project scope). (1) A plugin that only the repository's config declares, with `autoapply: true` in the project config: no hook run. (2) An installed plugin whose ledger entry is removed, `autoapply: true` in the project config, and a newer catalog version: no hook run. (3) The ledger entry is removed, the catalog moves to 2.0.0, and the user runs `/claude:plugin update`: **the hook ran**. (4) The ledger entry is removed and the user runs `/claude:plugin reinstall`: **the hook ran**. Probes 3 and 4 are the evidence for T-05-32.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Pi session lifecycle -> hook process | Pi's session events decide which installed plugin commands run and with what stdin | session ids, source/reason values, `CLAUDE_ENV_FILE` path |
| harness -> agent settings | a scenario writes `<agent dir>/settings.json` inside the sandbox | test configuration |
| plugin hook declaration -> child process | the installed plugin's `command` and `args` decide what the bridge spawns | command text, path values (code execution) |
| hook process -> bridge | exit code, stdout, stderr, and timing decide the outcome | untrusted hook output |
| hook stdout -> tool call | a plugin's hook decides whether and with what input a tool runs | allow/deny/ask decisions, rewritten tool input |
| model -> mcp proxy -> real tool | the adapter's proxy runs a nested Pi tool call that hooks see | MCP tool name and arguments |
| plugin manifest and marketplace entry -> resolver | author-declared fields decide what the install claims to support | file paths (containment), supportability verdict |
| plugin lifecycle -> hook routing | a verb's effect on which plugin commands Pi runs at its events | routing table |
| hook stdout -> model context | a plugin's hook adds text the model reads | untrusted text into model context |
| hook stdout -> user interface | a plugin's hook text is shown to the user through the notify chokepoint | untrusted text into the UI and JSON/RPC stream |
| phase -> parent merge | the parent applies the collected lines to files the phase may not edit | planning records |
| repository-supplied project state -> hook routing | a project's `.pi/` state and staged `hooks.json`, which a cloned repository can supply, decide which commands project-scope hooks run | commands to execute (code execution) |
| user command -> project ledger | a `/claude:plugin` command that stages project plugins writes this user's record of project installs under the user scope (added 2026-11-02) | which project hook configs count as this user's install |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | `event-router.ts` reload path | medium | mitigate | `sessionShutdownCallback` returns on `reason === "reload"` before dispatch (`bridges/hooks/event-router.ts` l.942-944); the `session_start` closure returns on `reload` after the hydrate, rebuild, and shared-dir step (l.1183); cases `event-router.test.ts` l.2974, l.3054; scenario "Reloading pi in the terminal runs no session hook" (`features/hook/session.feature` l.243) | closed |
| T-05-02 | Denial of service | compaction SessionStart re-entrancy | low | mitigate | `runCompactionSessionStart` / `sessionCompactCallback` (l.958-1015) run inside the one `session_compact` registration (l.1212); `prepareSessionStartDataDirs` checks the generation after each await (l.913), the leg returns `generationIsCurrent()` (l.975), and PostCompact is skipped when stale; cases l.3306, l.3345, l.3409, l.3435. `grep -c 'pi.on('` is now 12, not 11: the extra registration is `turn_end` (l.1252, added by `a17639b` for follow-up context), not a second compaction registration | closed |
| T-05-03 | Information disclosure | `CLAUDE_ENV_FILE` path on a compaction SessionStart | low | accept | see Accepted Risks Log (rationale verified: `bridges/hooks/hook-env.ts` l.93-95 `assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE")` for every SessionStart entry) | closed |
| T-05-04 | Tampering | harness settings file outside the sandbox | low | mitigate | `features/step_definitions/hook/session.steps.ts` l.166-169: path under `this.tokens.agentDir`, `writeFile(..., { flag: "wx" })`, `this.onRelease(() => rm(file, { force: true }))` | closed |
| T-05-05 | Elevation of privilege | `planSpawn` exec-form substitution | medium | mitigate | `bridges/hooks/spawn-helpers.ts` l.47-60: `substituteClaudeVars` only inside the `Array.isArray(argsField)` arm, which returns `shell: false`; the shell arm returns `command` unchanged; values from `hookPathVars` (`hook-env.ts` l.34-44), the same three the env exports; both lanes call `planSpawn` (`dispatch-exec.ts` l.293, `async-rewake/registry.ts` l.208); scenario `features/hook/process.feature` l.53 | closed |
| T-05-06 | Tampering | substituted value re-expansion | low | mitigate | `shared/vars.ts` l.69: one `replaceAll` pass with a callback, so spliced values are never rescanned; case `test/bridges/hooks/spawn-helpers.test.ts` l.77 | closed |
| T-05-07 | Elevation of privilege | a failing policy hook failing open | medium | mitigate | `bridges/hooks/on-failure.ts` l.40-63 (`isFailure`: start failure, timeout, exit not 0/2, broken `{` JSON) and l.83-106 (`onFailureBlock`); asked before `parseHookStdout` in the `error` (`dispatch-exec.ts` l.347-360) and `close` (l.362-381) handlers; `TimerLadder.fired()` (`exec-timer.ts` l.86, l.201); scenarios `features/hook/failures.feature` l.7, l.76, `features/hook/tool-use.feature` l.88, l.115. Since `8da30e5` an output overflow no longer kills the hook; it runs to its exit, so an exit other than 0 and 2 and a timeout still block (case `dispatch-exec.test.ts` l.1753). Default stays fail-open, as upstream. The exit-0 path with stdout cut at 1 MB is a separate open item: T-05-33 | closed |
| T-05-08 | Denial of service | script hooks in the harness waiting forever | low | mitigate | `features/lib/hook-files.ts` l.117 (`MEETING_TENTHS = 30`), l.305-307 (bounded wait loop), l.324 (explicit `sleep` cell with no pipe held); the bridge timeout ladder still applies | closed |
| T-05-09 | Elevation of privilege | parallel fold precedence | high | mitigate | `bridges/hooks/dispatch.ts` l.231 (`Promise.all` keeps routing order, not finish order), l.383-397 (`foldOutcomes`: `stop` first, then the first `block`), l.330-343 (`foldedPermission`: `ask` before `allow`); cases `dispatch.test.ts` l.2922 (finish order reversed), l.802, l.859 (stop over a later block) | closed |
| T-05-10 | Elevation of privilege | `ask` without a terminal | high | mitigate | `bridges/hooks/event-adapters.ts` l.198-212: `userAllows` returns `false` when `ctx.mode !== "tui"` before reading `ctx.ui`; l.217-230 blocks; cases `event-adapters.test.ts` l.266 (`rpc`/`json`/`print`, `headlessContext` l.53); scenario `features/hook/tool-use.feature` l.269 | closed |
| T-05-11 | Tampering | `updatedInput` rewrite | medium | mitigate | `bridges/hooks/event-adapters.ts` l.135-152 (`replaceToolCallInput`): rejects null, primitive, and array; clears then copies own keys, skipping `"__proto__"`; case `event-adapters.test.ts` l.215 (prototype unpolluted) | closed |
| T-05-12 | Elevation of privilege | MCP calls the proxy runs without a nested Pi call | medium | accept | see Accepted Risks Log (recorded Pi gap: `docs/hooks-compatibility.md` l.146, D-CF5-12) | closed |
| T-05-13 | Denial of service | parallel hooks racing on shared files | low | accept | see Accepted Risks Log (rationale verified: one process per hook, one fold after `Promise.all`, `dispatch.ts` l.231, l.383-397) | closed |
| T-05-14 | Repudiation | manifest `hooks` silently ignored | medium | mitigate | `domain/hooks-resolution.ts` l.172-190 (`declaresUnloadedHooks`) and l.261-266 (push `"hooks"` to `unsupported` once); scenarios `features/hook/configuration.feature` l.7 (Outline), l.39 (marketplace entry), l.106 (install needs `--partial`) | closed |
| T-05-15 | Tampering | manifest `hooks` path outside the plugin root | low | mitigate | `domain/hooks-resolution.ts` l.139-161 (`namesConventionFile` resolves through `resolveContainedComponentPath`, never reads; an unresolvable path counts as another file); `domain/component-paths.ts` l.11-36 (absolute and escaping paths refused via `assertPathInside`) | closed |
| T-05-16 | Elevation of privilege | an `if`-gated session hook running unconditionally | low | mitigate | `bridges/hooks/if-field/index.ts` l.141 (`tool-less-event` predicate) and l.498-499 (never fires); scenario `features/hook/configuration.feature` l.126 | closed |
| T-05-17 | Elevation of privilege | a disabled or uninstalled plugin's hook still running | medium | mitigate | `features/hook/lifecycle.feature` l.19 (disable), l.29 (enable restores), l.42 (uninstall), l.52 (update runs only the new hook); hydrate skips disabled records (`event-router.ts` l.679) | closed |
| T-05-18 | Spoofing | UserPromptSubmit context replacing the user's prompt | medium | mitigate | `bridges/hooks/event-adapters.ts` l.497-521: `adaptInputResult` has no `transform` arm; a mutate queues the context and returns `undefined`; the context goes as its own hidden message, at `before_agent_start` (`event-router.ts` l.283-284) or, for a follow-up, at the `turn_end` that reads it (`a17639b`), with the prompt unchanged; scenarios `features/hook/additional-context.feature` l.7, l.49, l.77 | closed |
| T-05-19 | Information disclosure | context leaking into a later session | low | mitigate | `bridges/hooks/runtime.ts` l.219-223 drains all three buffers (session start, prompt, and the follow-up buffer that `a17639b` added); called at every bridge load (`event-router.ts` l.1095); HOOK-E2E-04 (`test/integration/hooks-additionalcontext-end-to-end.test.ts`); `event-router.test.ts` l.1483 | closed |
| T-05-20 | Tampering | plain stdout from tool hooks reaching the model | low | mitigate | `bridges/hooks/wire-protocol.ts` l.45 (`PLAIN_CONTEXT_EVENTS` = SessionStart, UserPromptSubmit), l.94-102 (other events: noop) | closed |
| T-05-21 | Spoofing | a hook notice imitating product output | medium | mitigate | every notice text is composed by `hookSaysText` / `promptBlockedText` / `hookErrorText` (`bridges/hooks/hook-labels.ts` l.94, l.104, l.117) and emitted only as kind `hook-notice` through `notifyHookNotice` (`dispatch.ts` l.555, `settle.ts` l.272, `shared/notification-dispatch.ts` l.491-502; wire payload `shared/notification-wire.ts` l.886) | closed |
| T-05-22 | Information disclosure | absolute paths or secrets in a hook's message | low | accept | see Accepted Risks Log (pass-through verified: `terminalSafeHookNotice` removes escapes and bounds length but redacts no path, `shared/notification-resolve.ts` l.684-693) | closed |
| T-05-23 | Tampering | terminal escape sequences in a notice | low | mitigate | `40f3d52` added `terminalSafeHookNotice` (`shared/notification-resolve.ts` l.684-693): `stripVTControlCharacters`, then every other control character except a line break or a tab becomes a space, and a notice past 2,000 grapheme clusters is cut with `… (+N chars)`. `notifyHookNotice` applies it before both strategies (`shared/notification-dispatch.ts` l.496); cases `notification-dispatch.test.ts` l.7151, l.7169, `notification-resolve.test.ts` l.3143; scenario `features/hook/messages.feature` l.33. The 2026-11-01 carry-forward note (no filter on this path) is resolved | closed |
| T-05-24 | Denial of service | Stop feedback looping | medium | mitigate | `bridges/hooks/settle.ts` l.365: one `reenterBounded` per settle with all feedback parts; `reenterBounded` (l.452-474) counts through `runtime.recordStopReentry()` (l.460); case `settle.test.ts` l.746 | closed |
| T-05-25 | Information disclosure | a systemMessage reaching the model | medium | mitigate | `systemMessage` is read only by the notice builders (`dispatch.ts` l.424-460, `settle.ts` l.266, l.431-433); every model-bound carrier reads `additionalContext` or reasons only; scenarios `features/hook/messages.feature` l.7, l.53 | closed |
| T-05-26 | Tampering | a gate fix weakening a test to pass | medium | mitigate | plan 05-09 changed no test file: `git show --stat` of `e3f0676`, `565aaf5`, `d063097`, `f840d7b` lists only docs, two comment-only `.ts` diffs, and the SUMMARY; `05-09-SUMMARY.md` records that no gate fix was needed | closed |
| T-05-27 | Repudiation | a deferred item dropped without a record | medium | mitigate | `05-09-SUMMARY.md` BACKLOG parent lines; the review residuals are BACKLOG HOOKFOLLOWUP-01, HOOKBIGJSON-01, HOOKREVIEW-01 | closed |
| T-05-28 | Elevation of privilege | project-scope hook hydrate in `bridges/hooks/event-router.ts` (`hydrateScopeFromState` -> `tryHydrateOnePlugin`) | high | mitigate | Re-audited 2026-11-02 (the parent changed this row from `transfer` by hand after `da72ba4`). **Read side:** both writers of the parsed-config cache check the ledger, `readAndCachePluginHooksWith` (`event-router.ts` l.189-235, check l.208) and `tryHydrateOnePlugin` (l.720-798, check l.774); no other `setParsedConfig` caller exists. `provenProjectHooks` (l.137-146) reads the ledger under the user agent directory; a missing or malformed ledger gives an empty map, so every project config fails closed. The digest is compared with the same bytes that are parsed (one read). The project re-hydrate at `resources_discover` first deletes every project cache key (l.837-848). **Write side:** the only hooks ledger writer is `recordProjectHooks` (`bridges/hooks/stage.ts` l.250-270), which removes the staged config when the ledger write fails; its callers are the install ledger (`orchestrators/plugin/install-outcome.ts`) and the update swap (`update-swap.ts`). Skill and command keys cannot take `hooks/<plugin>` (`assertSafeName` rejects `/`). **Autoapply (D-CF2-14):** `orchestrators/reconcile/load.ts` l.102-142 passes `scope: "user"` (l.128) and `apply.ts` l.2287 keeps to it; the user-scope plan reads only user config files (`persistence/config-merge.ts` l.195-205); probes 1 and 2 recorded no hook run. **Background autoupdate (D-CF2-15):** `orchestrators/marketplace/background-pass.ts` l.106 (`PASS_SCOPE = "user"`), l.375-388; the marketplace cascade passes the marketplace's own scope to each plugin update (`marketplace/update.ts` l.743-753, l.821-825); `features/marketplace/background-update.feature` l.61 passes. Scenarios `features/hook/project-provenance.feature` (3) pass. Residuals: T-05-31, T-05-32, T-05-34 | closed |
| T-05-29 | Information disclosure | a Stop hook's `systemMessage` reaching the model through the re-entry | medium | mitigate | `bridges/hooks/settle.ts` l.226-230 (`feedbackTexts`: block reason and `additionalContext` only), l.239 (`stopFeedback`), l.260-272 (`showStopNotices` via `notifyHookNotice`); scenario `features/hook/prompt-and-stop.feature` l.67 | closed |
| T-05-30 | Spoofing | a tool hook's context read as the tool's own output | low | mitigate | `bridges/hooks/dispatch.ts` l.571 (`claude-hook-tool-context`), l.583-600 (`sendToolContext`: separate hidden message, `triggerTurn: false`); scenarios `features/hook/tool-use.feature` l.402, l.430 | closed |
| T-05-31 | Tampering | files a recorded project hook runs that the ledger digest does not cover (`resolvedSource` in `state.json`, scripts under the plugin root) | medium | accept | see Accepted Risks Log (AR-05-06 present). Checked against code: the digest covers `hooks.json` only (`isInstalledHere`, `event-router.ts` l.153-159); `resolvedSource` comes from the record and is only shape-checked (`asAbsolutePluginRoot`, l.750-758; `hook-env.ts` l.54-55 says no containment is asserted on it). What AR-05-06 states is accurate. It is incomplete in two ways: the ledger key is the `resources.hooks` slug of whatever record names it (l.684-690, l.774), so a repository can also attach a recorded config to another `marketplace`/`pluginId` record; and `CLAUDE_PLUGIN_DATA` is not named (T-05-34) | closed |
| T-05-32 | Elevation of privilege | project ledger admission by user commands that name no plugin: `/claude:plugin update` and `/claude:plugin reinstall` with no target or an `@<marketplace>` target (also `update --scope project`), `marketplace update`'s cascade, and `apply`'s convergence moves | high | mitigate | Fixed by the parent in `fed700e` (D-CF2-16, pending user review). `persistence/project-installs.ts::admittedProjectLedger` reads the project ledger once before a stage writes: a `refresh` admission gets the ledger as it is only when an entry of that plugin exists, else a ledger that forgets and never remembers. The update swap (`update-swap.ts::commitUpdatePhase3a`) and the install ledger (`install-outcome.ts::runInstallLedgerBody`) pass it to the skills, commands, and hooks writers. `refresh` is set by `update-flow.ts` for every target form but `<plugin>@<marketplace>`, by `updateSinglePluginWith` (the `marketplace update` cascade) and `convergePluginWith` (`apply`'s moves), and by `reinstall-flow.ts` when the command named no plugin; `DependencyCaller`, `DependencyMoveContext`, and `CascadeInstallOptions` carry it to the dependencies such a command moves or installs. A command that names the plugin keeps adding entries (the recovery the aborts print). Unit tests in the eight source-test pairs; scenarios in `features/hook/project-provenance.feature` (bare update, bare reinstall, recovery by a named reinstall) and `features/skill/project-provenance.feature` (bare update, bare reinstall) fail without the source change. Residual: `apply`'s install, enable, and missing-dependency steps for a plugin the project config declares still add entries, because the user typed `apply` (D-CF2-14) | closed |
| T-05-33 | Elevation of privilege | hook stdout over the 1 MB cap on exit 0 (`bridges/hooks/dispatch-exec.ts` l.371) | medium | unassigned (found 2026-11-02) | Missing. `answer = stdoutCap.cut() ? "" : stdout` drops cut stdout before `onFailureBlock` runs, so `isBrokenJson` never sees the cut `{...` head. An exit-0 hook whose JSON deny passes 1 MB is a noop, even with `onFailure: "block"`. Pinned on purpose by `dispatch-exec.test.ts` l.1830; recorded only as BACKLOG HOOKBIGJSON-01 and `05-REVIEW.md` IN-11. A guard that echoes model-controlled input in its reason can be pushed over the cap by the model. Upstream reads all of stdout. Fix: under `onFailure: "block"`, treat cut stdout as a failure; or accept with a decision ID | open — below high threshold (non-blocking) |
| T-05-34 | Tampering | project-scope `CLAUDE_PLUGIN_DATA` inside the repository tree (`bridges/hooks/hook-env.ts` l.34-44, l.79) | medium | unassigned (found 2026-11-02) | Missing. For a project-scope hook, `CLAUDE_PLUGIN_DATA` is `<cwd>/.pi/pi-claude-marketplace/data/<pluginId>` (`features/hook/project-provenance.feature` l.63 expects it). That folder is in the repository tree, and `pluginId` comes from the repository's `state.json`. A recorded hook that runs code from its data folder (the upstream pattern of installing dependencies there) runs what the repository put there. Upstream keeps the data folder under the user's config directory. Neither the D-CF2-13 digest nor AR-05-06 names it. Fix: extend AR-05-06 with the user, or move the project data root out of the repository tree (BACKLOG HOOKDATA-01 is the related layout question) | open — below high threshold (non-blocking) |
| T-05-SC | Tampering | package installs | low | accept | see Accepted Risks Log (verified again at `5eb0ddc`: `git diff --stat 74829438..HEAD -- package.json package-lock.json` is empty) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Carry-forward

- **T-05-32 (high).** Mitigated by the parent in `fed700e` under D-CF2-16 (pending user review, with D-CF2-13, D-CF2-14, and D-CF2-15). The fix sits in the shared update and install runners, so it covers skills, commands, and hooks. Its residual, `apply`'s install steps for config-declared plugins, is recorded on the row.
- **T-05-33, T-05-34 (medium, non-blocking).** Tracked. Each can close as a fix or as an accepted risk with a decision ID.
- **T-05-23.** Resolved by `40f3d52`, the control-character filter that the 2026-11-01 note asked for.
- **Informational, not registered.** (a) DUBIOUS-CHOICES DC-36 item 6: a failed ledger forget leaves a stale entry, and the install undo ignores ledger warnings. A stale entry only keeps the digest of bytes this user once installed. (b) `05-REVIEW.md` IN-04: a generation change during a fold drops a PreToolUse deny. This predates the phase (DISP-03) and needs a reload during a tool call. (c) Since `8da30e5` a hook that floods its output runs until its timeout and is not killed, as upstream does; memory stays bounded by the caps.

### Summary Threat Flags

| Flag | Source | Disposition |
|------|--------|-------------|
| None (all nine SUMMARYs) | `05-01`..`05-09-SUMMARY.md` | informational: each mapped flag names an existing threat ID |
| PostToolUse `updatedToolOutput` now reaches the model (commit `6bbe6ba`, an orchestrator addition outside the 05-06 plan) | `05-06-SUMMARY.md` "Orchestrator addition" and its Threat Flags note | unregistered (warning, not a blocker): a plugin hook can replace the tool output the model reads. No threat ID covers it. The CR-01 whitelist is present (`bridges/hooks/event-adapters.ts` l.166-182: only array `content` and boolean `isError`); `c9793d8` changed only its types |
| Review-round and post-merge changes: `0d877aa`, `8da30e5` (overflow), `c1fe1e2` (PreCompact), `a17639b` (follow-up context), `40f3d52` (notice filter), `da72ba4` / `29a755e` (project ledger), `0b29f66` (background pass) | `05-REVIEW-FIX.md`, DUBIOUS-CHOICES DC-36, DC-37 | mapped: T-05-07 and T-05-33; T-05-09; T-05-18 and T-05-19; T-05-23; T-05-28, T-05-31, T-05-32, T-05-34; T-05-28 |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-03 | A compaction SessionStart gets the same containment-checked `_shared/claude-env-<session>.env` path the startup SessionStart gets (`hook-env.ts` `assertPathInside`); no new location is exposed | plan 05-01 threat model | 2026-11-01 |
| AR-05-02 | T-05-12 | Pi gap (D-CF5-12): an MCP call that pi-mcp-adapter runs without a nested Pi tool call reaches no hook, so PreToolUse policy hooks do not see it. The adapter's default path makes a nested call, which fires hooks once under the real tool name. Recorded in `docs/hooks-compatibility.md` | plan 05-03 threat model (D-CF5-12) | 2026-11-01 |
| AR-05-03 | T-05-13 | Each hook is its own process; the bridge applies one folded result after every hook finishes. A plugin whose own hooks race on its own files is the plugin's concern, as upstream | plan 05-03 threat model | 2026-11-01 |
| AR-05-04 | T-05-22 | The notice text is the plugin author's own output, shown as upstream shows it; the JSON strategy's existing envelope applies; no path redaction is added for author text | plan 05-07 threat model | 2026-11-01 |
| AR-05-05 | T-05-SC | No plan of the phase installs a package; `install-test-peers.mjs` installs the declared optional peers into the test cache only; no dependency file changed | plan threat models 05-01..05-09 | 2026-11-01 |
| AR-05-06 | T-05-31 | The D-CF2-13 hook digest covers the staged `hooks.json` bytes only. It does not bind `resolvedSource` (the `CLAUDE_PLUGIN_ROOT` that the project `state.json` records) or the scripts under the plugin root (a project install's clone under `<cwd>/.pi/pi-claude-marketplace/`, in the repository tree). A repository that edits its in-repo clone, or points `resolvedSource` elsewhere, can change what a recorded hook command runs. Same residual as AR-02-05 for skills and T-03-23 for commands (BACKLOG CMDDIGEST-01) | parent, project-hook provenance check (`DUBIOUS-CHOICES.md` DC-36 item 4), pending user review | 2026-11-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 31 | 31 | 0 | gsd-security-auditor (ASVS L1, block_on high) |
| 2026-11-02 | 35 | 32 | 3 (1 blocking: T-05-32; 2 below threshold: T-05-33, T-05-34) | gsd-security-auditor, post-merge re-audit at `5eb0ddc` after the three review fix rounds and the parent's post-merge fixes (ASVS L1, T-05-28 traced end to end, block_on high) |
| 2026-11-02 | 35 | 33 | 2 (0 blocking; 2 below threshold: T-05-33, T-05-34) | parent, not a re-audit: T-05-32 marked mitigated after the fix in `fed700e` (D-CF2-16); the other rows were not checked again |

---

## Sign-Off

- [ ] All threats have a disposition (mitigate / accept / transfer): T-05-33, T-05-34 have none yet
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed: T-05-32 mitigated in `fed700e`; T-05-33 and T-05-34 stay open below the high threshold
- [ ] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01; reopened 2026-11-02 by the post-merge re-audit (T-05-32 blocked); the block cleared 2026-11-02 by the parent's fix `fed700e`, not by a re-audit
