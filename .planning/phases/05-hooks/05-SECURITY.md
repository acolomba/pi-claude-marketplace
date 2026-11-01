---
phase: "05"
slug: "hooks"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of the 9 plans (`05-01-PLAN.md` to `05-09-PLAN.md`), written at plan time. `T-05-SC` appears in all nine plans and is one threat. Each mitigation was checked against the tree at `b5ff1e7` (branch `features/component-features-phase-5`) at ASVS level 1: the code, step, or test the plan names exists and does what the plan promised. Block threshold: `high`.

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

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | `event-router.ts` reload path | medium | mitigate | `sessionShutdownCallback` returns on `reason === "reload"` before dispatch (`bridges/hooks/event-router.ts` l.862-864); the `session_start` closure returns on `reload` after the hydrate, rebuild, and shared-dir step (l.1100-1105); cases `event-router.test.ts` l.2796, l.2876; scenario "Reloading pi in the terminal runs no session hook" (`features/hook/session.feature` l.187) | closed |
| T-05-02 | Denial of service | compaction SessionStart re-entrancy | low | mitigate | `runCompactionSessionStart` / `sessionCompactCallback` (l.878-935) run inside the existing `session_compact` registration (l.1132-1144); `prepareSessionStartDataDirs` checks the generation after each await (l.833), the leg returns `generationIsCurrent()` (l.895) and PostCompact is skipped when stale (l.922-931); `grep -c 'pi.on('` = 11; cases l.3227, l.3253 | closed |
| T-05-03 | Information disclosure | `CLAUDE_ENV_FILE` path on a compaction SessionStart | low | accept | see Accepted Risks Log (rationale verified: `bridges/hooks/hook-env.ts` l.92-96 `assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE")` for every SessionStart entry) | closed |
| T-05-04 | Tampering | harness settings file outside the sandbox | low | mitigate | `features/step_definitions/hook/session.steps.ts` l.149-158: path under `this.tokens.agentDir`, `writeFile(..., { flag: "wx" })`, `this.onRelease(() => rm(file, { force: true }))`, read-back assert | closed |
| T-05-05 | Elevation of privilege | `planSpawn` exec-form substitution | medium | mitigate | `bridges/hooks/spawn-helpers.ts` l.47-60: `substituteClaudeVars` only inside the `Array.isArray(argsField)` arm, which returns `shell: false`; the shell arm returns `command` unchanged; values from `hookPathVars` (`hook-env.ts` l.34-44), the same three the env exports; both lanes call `planSpawn(entry, vars)` (`dispatch-exec.ts` l.287, `async-rewake/registry.ts` l.208); shell-form case in `spawn-helpers.test.ts`, scenario `features/hook/process.feature` l.53 | closed |
| T-05-06 | Tampering | substituted value re-expansion | low | mitigate | `shared/vars.ts` l.68-73: one `replaceAll` pass with a callback, so spliced values are never rescanned; case "replaces each placeholder of one argument once and never rescans a spliced value" (`test/bridges/hooks/spawn-helpers.test.ts` l.77) | closed |
| T-05-07 | Elevation of privilege | a failing policy hook failing open | medium | mitigate | `bridges/hooks/on-failure.ts` l.53-63 (`isFailure`: start failure, timeout, exit not 0/2, broken `{` JSON) and l.81-106 (`onFailureBlock`); asked before `parseHookStdout` in the `error` (`dispatch-exec.ts` l.391-404) and `close` (l.413-427) handlers; `TimerLadder.fired()` (`exec-timer.ts` l.86, l.201); `features/hook/failures.feature` l.7 (Outline x3), l.76; default stays fail-open | closed |
| T-05-08 | Denial of service | script hooks in the harness waiting forever | low | mitigate | `features/lib/hook-files.ts` l.112-113 (`MEETING_TENTHS = 30`), l.287-294 (bounded wait loop), l.310 (explicit `sleep` cell with no pipe held); the bridge timeout ladder still applies (`dispatch-exec.ts` l.288-294, l.309) | closed |
| T-05-09 | Elevation of privilege | parallel fold precedence | high | mitigate | `bridges/hooks/dispatch.ts` l.222-232 (`Promise.all` keeps routing order, not finish order), l.380-394 (`stop` first, then first `block`), l.327-340 (`ask` before `allow`); cases `dispatch.test.ts` l.2744 (held executors finished in reverse order), l.2775 (block beats earlier ask), l.859 (stop beats later block) | closed |
| T-05-10 | Elevation of privilege | `ask` without a terminal | high | mitigate | `bridges/hooks/event-adapters.ts` l.198-212: `userAllows` returns `false` when `ctx.mode !== "tui"` before reading `ctx.ui`; l.222-225 blocks; cases `event-adapters.test.ts` l.241-262 for `rpc`/`json`/`print` with a context whose `ui` getter throws (l.45-52); `dispatch.test.ts` l.3219 | closed |
| T-05-11 | Tampering | `updatedInput` rewrite | medium | mitigate | `bridges/hooks/event-adapters.ts` l.133-150 (`replaceToolCallInput`): rejects null, primitive, and array; clears then copies own keys, skipping `"__proto__"`; cases `event-adapters.test.ts` l.170, l.190 (prototype unpolluted), l.214-236 | closed |
| T-05-12 | Elevation of privilege | MCP calls the proxy runs without a nested Pi call | medium | accept | see Accepted Risks Log (recorded Pi gap: `docs/hooks-compatibility.md` l.144, `05-CONTEXT.md` l.214, D-CF5-12; skip rule `dispatch.ts` l.609-621) | closed |
| T-05-13 | Denial of service | parallel hooks racing on shared files | low | accept | see Accepted Risks Log (rationale verified: one process per hook, one fold after `Promise.all`, `dispatch.ts` l.222-232, l.397-411) | closed |
| T-05-14 | Repudiation | manifest `hooks` silently ignored | medium | mitigate | `domain/hooks-resolution.ts` l.172-190 (`declaresUnloadedHooks`) and l.261-266 (push `"hooks"` to `unsupported` once); scenarios `features/hook/configuration.feature` l.7 (Outline x3), l.39 (marketplace entry), l.106 (install needs `--partial`) | closed |
| T-05-15 | Tampering | manifest `hooks` path outside the plugin root | low | mitigate | `domain/hooks-resolution.ts` l.139-146 (`namesConventionFile` resolves through `resolveContainedComponentPath`, never reads) and l.151-161 (an unresolvable path counts as another file); `domain/component-paths.ts` l.12-37 (absolute and escaping paths refused via `assertPathInside`) | closed |
| T-05-16 | Elevation of privilege | an `if`-gated session hook running unconditionally | low | mitigate | `bridges/hooks/if-field/index.ts` l.271-276 (`compileIfPredicate` returns `{ kind: "tool-less-event" }` for a non-tool event) and l.498 (`ifFires` returns `false`); scenario `features/hook/configuration.feature` l.126 | closed |
| T-05-17 | Elevation of privilege | a disabled or uninstalled plugin's hook still running | medium | mitigate | `features/hook/lifecycle.feature` l.19-27 (disable: no runs), l.42-50 (uninstall: no runs), l.52-66 (update: only `fresh-guard`), l.29-38 (enable restores); hydrate skips disabled records (`event-router.ts` l.601) | closed |
| T-05-18 | Spoofing | UserPromptSubmit context replacing the user's prompt | medium | mitigate | `bridges/hooks/event-adapters.ts` l.352-377: `adaptInputResult` has no `transform` arm; a mutate buffers context and returns `undefined`; `event-router.ts` l.219-238 sends a separate hidden custom message; scenario `features/hook/additional-context.feature` l.7 | closed |
| T-05-19 | Information disclosure | context leaking into a later session | low | mitigate | `bridges/hooks/runtime.ts` l.190-193 drains both buffers; called at every bridge load (`event-router.ts` l.1015); HOOK-E2E-04 (`test/integration/hooks-additionalcontext-end-to-end.test.ts` l.264); `event-router.test.ts` l.1468 | closed |
| T-05-20 | Tampering | plain stdout from tool hooks reaching the model | low | mitigate | `bridges/hooks/wire-protocol.ts` l.44-47 (`PLAIN_CONTEXT_EVENTS` = SessionStart, UserPromptSubmit), l.95-102 (other events: noop); sole call site passes the entry's event (`dispatch-exec.ts` l.427) | closed |
| T-05-21 | Spoofing | a hook notice imitating product output | medium | mitigate | every notice text is composed by `hookSaysText` / `promptBlockedText` / `hookErrorText` (`bridges/hooks/hook-labels.ts` l.74, l.84, l.97) at `dispatch.ts` l.448-516 and `settle.ts` l.272; emitted only as kind `hook-notice` through a `{ kind: "hook" }` run (`dispatch.ts` l.540-543; `shared/notification-dispatch.ts` l.485-495; wire payload `shared/notification-wire.ts` l.886) | closed |
| T-05-22 | Information disclosure | absolute paths or secrets in a hook's message | low | accept | see Accepted Risks Log (pass-through verified: `shared/notification-resolve.ts` l.719-720; pinned by `test/shared/notification-resolve.test.ts` l.1856) | closed |
| T-05-23 | Tampering | terminal escape sequences in a notice | low | mitigate | declared control present: the text arm renders through the notification grammar like `async-rewake-summary` (`shared/notification-grammar.ts` l.1390-1394); byte lock `test/architecture/hooks-notice-notify.test.ts` l.41 against `docs/output-catalog.md` l.5400. L1 note: the arm passes producer text verbatim (grammar l.1336) and no control-character filter exists on this path, so the control does not neutralize escape sequences; see Carry-forward | closed |
| T-05-24 | Denial of service | Stop feedback looping | medium | mitigate | `bridges/hooks/settle.ts` l.362-366: one `reenterBounded` per settle with all feedback parts; `reenterBounded` (l.452-474) counts through `runtime.recordStopReentry()`; case "counts a re-entry that carries several hooks' feedback once toward the cap (STOP-07)" (`settle.test.ts` l.746) | closed |
| T-05-25 | Information disclosure | a systemMessage reaching the model | medium | mitigate | `systemMessage` is read only by the notice builders (`dispatch.ts` l.423-463, `settle.ts` l.260-276, l.431-433); every model-bound carrier reads `additionalContext` or reasons only (`event-adapters.ts` l.101-109, `dispatch.ts` l.575, `settle.ts` l.225-229); scenarios `features/hook/messages.feature` l.7-29, l.33-56 state the model calls without notice text | closed |
| T-05-26 | Tampering | a gate fix weakening a test to pass | medium | mitigate | plan 05-09 changed no test file: `git show --stat` of `e3f0676`, `565aaf5`, `d063097`, `f840d7b` lists only `docs/hooks-compatibility.md`, two `.ts` files whose diff is comment-only, and the SUMMARY; `05-09-SUMMARY.md` l.127 records that no gate fix was needed | closed |
| T-05-27 | Repudiation | a deferred item dropped without a record | medium | mitigate | `05-09-SUMMARY.md` l.191-214: 20 BACKLOG parent lines covering D-CF5-06/08/16/20/28 and every deferred item in the 05-03, 05-04, 05-06, 05-07, 05-08 SUMMARYs; decision rows l.133-162 carry the residuals | closed |
| T-05-28 | Elevation of privilege | project-scope hook hydrate in `bridges/hooks/event-router.ts` (`hydrateScopeFromState` -> `tryHydrateOnePlugin`) | high | transfer | transferred to the parent merge: "Security follow-up at merge (T-05-28)" in `05-09-SUMMARY.md` l.251-257 (parent's provenance line word for word, insertion point, second writer `readAndCachePluginHooksWith`, ledger layout); `DUBIOUS-CHOICES.md` P5-DC-11 l.152-165 (High, open) and P5-DC-12 item 9 l.192-196. Insertion point valid on the final tree (`event-router.ts` l.687-704, between `reader.readHooksJson` and `parseHooksConfig`); funnel counts 3/2/3; `bridges/skills/project-installs.ts` absent on this branch. The exposure stays live in code until the parent applies the guard; see Carry-forward | closed |
| T-05-29 | Information disclosure | a Stop hook's `systemMessage` reaching the model through the re-entry | medium | mitigate | `bridges/hooks/settle.ts` l.225-229 (`feedbackTexts`: block reason and `additionalContext` only), l.239-252 (`stopFeedback`), l.260-276 (`showStopNotices` via `notifyHookNotice`); case `settle.test.ts` l.1545; scenario `features/hook/prompt-and-stop.feature` l.67-89 | closed |
| T-05-30 | Spoofing | a tool hook's context read as the tool's own output | low | mitigate | `bridges/hooks/dispatch.ts` l.558 (`claude-hook-tool-context`), l.570-592 (`sendToolContext`: separate hidden message labeled `<Event>:<Tool> hook additional context:`, `triggerTurn: false`), called at l.681 (PreToolUse) and l.729 (tool result); scenarios `features/hook/tool-use.feature` l.348, l.376 | closed |
| T-05-SC | Tampering | package installs | low | accept | see Accepted Risks Log (verified: `git diff --stat 74829438..HEAD -- package.json package-lock.json` is empty) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Carry-forward to the parent merge

- **T-05-28 (high, transfer).** On this branch, project-scope hooks that repository-supplied state records are still hydrated and run with no D-CF2-13 provenance check. The transfer is closed only as a disposition. The parent must apply the "Security follow-up at merge" line in `05-09-SUMMARY.md` (one call in `tryHydrateOnePlugin`, scope `project`, between `reader.readHooksJson` and `parseHooksConfig`) and decide on the second writer `readAndCachePluginHooksWith`. Until then P5-DC-11 stays open. Re-run `/gsd-secure-phase` after the merge to move this to `mitigate`.
- **T-05-23 (low).** The declared control is present at L1, but `hook-notice` text reaches `ctx.ui.notify` verbatim (`shared/notification-grammar.ts` l.1336, l.1390-1394; `shared/notification-dispatch.ts` l.146-152). No ESC or control-character filter exists on this path. At ASVS L2 this threat would be open. Either re-disposition it to `accept` (author text, same trust as the plugin's hooks, upstream parity) or add a control-character filter in the hook-notice text arm.

### Summary Threat Flags

| Flag | Source | Disposition |
|------|--------|-------------|
| None (all nine SUMMARYs) | `05-01`..`05-09-SUMMARY.md` | informational: each mapped flag names an existing threat ID |
| PostToolUse `updatedToolOutput` now reaches the model (commit `6bbe6ba`, an orchestrator addition outside the 05-06 plan) | `05-06-SUMMARY.md` "Orchestrator addition" and its Threat Flags note | unregistered (warning, not a blocker): a plugin hook can now replace the tool output the model reads. No threat ID covers it. The CR-01 whitelist is present (`bridges/hooks/event-adapters.ts` l.164-182: only array `content` and boolean `isError`) |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-03 | A compaction SessionStart gets the same containment-checked `_shared/claude-env-<session>.env` path the startup SessionStart gets (`hook-env.ts` `assertPathInside`); no new location is exposed | plan 05-01 threat model | 2026-11-01 |
| AR-05-02 | T-05-12 | Pi gap (D-CF5-12): an MCP call that pi-mcp-adapter runs without a nested Pi tool call reaches no hook, so PreToolUse policy hooks do not see it. The adapter's default path makes a nested call, which fires hooks once under the real tool name. Recorded in `docs/hooks-compatibility.md` | plan 05-03 threat model (D-CF5-12) | 2026-11-01 |
| AR-05-03 | T-05-13 | Each hook is its own process; the bridge applies one folded result after every hook finishes. A plugin whose own hooks race on its own files is the plugin's concern, as upstream | plan 05-03 threat model | 2026-11-01 |
| AR-05-04 | T-05-22 | The notice text is the plugin author's own output, shown as upstream shows it; the JSON strategy's existing envelope applies; no path redaction is added for author text | plan 05-07 threat model | 2026-11-01 |
| AR-05-05 | T-05-SC | No plan of the phase installs a package; `install-test-peers.mjs` installs the declared optional peers into the test cache only; no dependency file changed | plan threat models 05-01..05-09 | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 31 | 31 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01 (T-05-28 carried forward to the parent merge as a transfer)
