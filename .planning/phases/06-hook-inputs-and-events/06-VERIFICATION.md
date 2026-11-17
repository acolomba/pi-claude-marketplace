---
phase: 06-hook-inputs-and-events
verified: 2026-11-17T02:07:35Z
status: passed
score: 104/104 must-haves verified (102 VERIFIED, 2 PASSED (override)); 2 judgment-tier prohibitions carried by overrides that the maintainer review confirmed
covered_files: [".agents/skills/cucumber/rules/features.md",".agents/skills/cucumber/rules/layout.md",".agents/skills/cucumber/rules/world-and-stand-ins.md",".planning/phases/06-hook-inputs-and-events/06-01-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-01-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-02-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-02-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-03-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-03-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-04-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-04-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-05-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-05-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-06-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-06-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-07-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-07-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-08-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-08-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-09-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-09-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-10-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-10-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-11-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-11-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-12-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-12-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-13-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-13-SUMMARY.md","CHANGELOG.md","docs/env-vars.md","docs/hooks-compatibility.md","docs/output-catalog.md","docs/prd/parity-gaps-prd.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts","extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts","extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts","extensions/pi-claude-marketplace/bridges/hooks/index.ts","extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts","extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts","extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/timeout.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts","extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/argument-substitution.ts","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/domain/components/hooks.ts","extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts","extensions/pi-claude-marketplace/domain/components/hooks/partition.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts","extensions/pi-claude-marketplace/platform/subagent-child.ts","extensions/pi-claude-marketplace/shared/concerns/hooks.ts","extensions/pi-claude-marketplace/shared/session-env.ts","features/agent/frontmatter.feature","features/hook/async.feature","features/hook/configuration.feature","features/hook/failures.feature","features/hook/lifecycle.feature","features/hook/matchers.feature","features/hook/mcp-tool-names.feature","features/hook/messages.feature","features/hook/prompt-and-stop.feature","features/hook/prompt-commands.feature","features/hook/prompt-expansion.feature","features/hook/session-end.feature","features/hook/session.feature","features/hook/stop-failure.feature","features/hook/tool-failure.feature","features/hook/tool-use.feature","features/lib/hook-run-tokens.ts","features/lib/mcp-configuration.ts","features/lib/real-subagent-child.ts","features/lib/saved-sessions.ts","features/lib/scripted-model/extension.ts","features/plugin/project-locality.feature","features/plugin/project-trust.feature","features/plugin/subagent-child.feature","features/skill/model-reads.feature","features/step_definitions/hook/prompt-commands.steps.ts","features/step_definitions/hook/runs.steps.ts","features/step_definitions/hook/session.steps.ts","features/step_definitions/hook/tool-use.steps.ts","features/step_definitions/mcp-configuration.steps.ts","features/step_definitions/mcp-implementation.steps.ts","features/step_definitions/model.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/world.ts","test/architecture/closed-set-enrollment.test.ts","test/architecture/hooks-lifecycle.test.ts","test/architecture/hooks-notice-notify.test.ts","test/architecture/hooks-translators.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/async-rewake/rewake-text.test.ts","test/bridges/hooks/child-root-session.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/hook-env.test.ts","test/bridges/hooks/hook-labels.test.ts","test/bridges/hooks/if-field/index.test.ts","test/bridges/hooks/index.test.ts","test/bridges/hooks/mcp-server-table.test.ts","test/bridges/hooks/on-failure.test.ts","test/bridges/hooks/payloads/post-compact.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-compact.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/payloads/session-end.test.ts","test/bridges/hooks/payloads/session-start.test.ts","test/bridges/hooks/payloads/stop-failure.test.ts","test/bridges/hooks/payloads/stop.test.ts","test/bridges/hooks/payloads/tool-event-facts.test.ts","test/bridges/hooks/payloads/user-prompt-expansion.test.ts","test/bridges/hooks/payloads/user-prompt-submit.test.ts","test/bridges/hooks/routing-state.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/timeout.test.ts","test/bridges/hooks/tool-batch.test.ts","test/bridges/hooks/translation-context.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/domain/argument-substitution.test.ts","test/domain/components/hook-events.test.ts","test/domain/components/hooks.test.ts","test/domain/components/hooks/matcher.test.ts","test/domain/components/hooks/partition.test.ts","test/e2e/_rpc.ts","test/edge/skill-aliases.test.ts","test/index.test.ts","test/integration/hooks-additionalcontext-end-to-end.test.ts","test/integration/hooks-cross-scope-reconcile.test.ts","test/integration/hooks-dispatch-end-to-end.test.ts","test/integration/hooks-spawn-end-to-end.test.ts","test/integration/pi-subagents-child-identity.test.ts","test/orchestrators/mcp/recorded-servers.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/typed-expansion.test.ts","test/platform/subagent-child.test.ts","test/shared/concerns/hooks.test.ts"]
covered_digest: "v4:sha256:c7dc6bca324119fb0e2a91c60db1d151827bf2f8ba793c54e27c4272cc95f313"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "Judgment-tier prohibition (06-09): a child tool hook that names the launching session always carries agent_id"
    reason: "Judgment-tier prohibition; verifier verdict satisfied and confirmed by the orchestrator. Re-checked 2026-11-17, unchanged: buildTranslationContext (bridges/hooks/translation-context.ts:131-152, file unchanged since the previous report) takes the root only from an identity kept for the own session, and the same branch sets childIdentity; a child dispatches only the three tool events (CHILD_EVENT_POLICY, bridges/hooks/event-router.ts:166-179, file unchanged), and each tool translator spreads agent_type/agent_id from childIdentity (payloads/pre-tool-use.ts:58, post-tool-use.ts:84, post-tool-use-failure.ts:80, all unchanged)."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-15T10:00:00Z"
  - must_have: "Judgment-tier prohibition (06-13): a user learns that a plugin installed earlier needs update or reinstall before its UserPromptExpansion hooks run"
    reason: "Judgment-tier prohibition; verifier verdict satisfied and confirmed by the orchestrator. Re-checked 2026-11-17: CHANGELOG.md:29 (the line moved from :28 when the Original prompt sentence was added) and docs/hooks-compatibility.md:121 both name /claude:plugin update and reinstall, and :121 adds that a load does not restore the groups."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-15T10:00:00Z"
  - must_have: "06-05 truth, legacy-record clause: mcp_server is left out for a server of a record written before mcpServerConfigs existed"
    reason: "Superseded in that clause by in-phase review fix WR-02 (cf060a19, 2026-11-15, 06-REVIEW-FIX.md), which the decision row D-PG6-07 now records: PROJECT.md:2404 lists the left-out cases as a non-plugin MCP tool, a cut adapter name with no recovered full name, and a name two servers claim, and no longer a legacy record. mcpServerEntries asks the injected MREC-01/02 reader for each enabled record (bridges/hooks/mcp-server-table.ts:42-77, unchanged), so a legacy record is re-resolved and its tools get mcp_server, as upstream sends the object for every MCP tool; an uncontained record names no server (UF-1, NFR-10). Evidence: features/hook/mcp-tool-names.feature:85 (in Gate G), named test 'MREC-02: names the servers the reader re-resolves for a record written before mcpServerConfigs', docs/hooks-compatibility.md:402. The rest of the truth holds: non-MCP tool, an MCP tool of no plugin, a disabled record (:66), two servers on one key (:100), and a name cut inside the server part (:81-83)."
    accepted_by: "project decision D-PG6-07 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:11:07Z"
  - must_have: "06-10 truth, notice clause: the UserPromptExpansion block notice shows the reason without Claude Code's Original prompt: part"
    reason: "Superseded in that clause by the maintainer decision of 2026-11-16 recorded in D-PG6-20 (PROJECT.md:2409, row Locked, 'Original prompt: restored'; it also amends D-CF5-24 at PROJECT.md:2212 and closes BACKLOG HOOKORIGPROMPT-01): no Pi gap licensed the drop, so the notice now ends with a blank line and 'Original prompt: <prompt>', the stdin's prompt, unless the blocking hook's JSON sets hookSpecificOutput.suppressOriginalPrompt: true under its own hookEventName, or the block comes from onFailure: \"block\". Implemented by 4d6825ba and 8c64be00: promptBlockedText (bridges/hooks/hook-labels.ts:138-147), blockNotices (bridges/hooks/dispatch.ts:573-594), originalPromptOf (:1666-1672) over expansionPrompt (payloads/user-prompt-expansion.ts:38-42), suppressesOriginalPrompt (wire-protocol.ts:205-217), onFailureBlock (on-failure.ts:112-147). Evidence: features/hook/prompt-expansion.feature:50 and :53 (in Gate G), the 19 D-PG6-20 cases of test/bridges/hooks/dispatch.test.ts and the owner files hook-labels, wire-protocol, user-prompt-expansion and on-failure (run this pass). The rest of the truth holds: a block and a continue: false answer handled, the model gets no call, the reason or [<command>]: <stderr> sits on the line after the head, and the stop shows Operation stopped by hook: <stopReason>."
    accepted_by: "project decision D-PG6-20 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-17T02:07:35Z"
re_verification:
  previous_status: passed
  previous_score: "104/104 (103 VERIFIED, 1 PASSED (override))"
  reason: "staleness: 26 commits after the previous report's tree (4527c825) changed 19 of its covered non-planning files. The phase-relevant ones are 4d6825ba and 8c64be00, which end the UserPromptExpansion and UserPromptSubmit block notices with the Original prompt (D-PG6-20, maintainer review 2026-11-16); they changed bridges/hooks/dispatch.ts, hook-labels.ts, wire-protocol.ts, payloads/user-prompt-expansion.ts, on-failure.ts and exec-result.ts. The other changes (domain/name.ts D-PG8-18, index.ts D-PG10-25, docs and CHANGELOG lines) move lines but no Phase 6 behavior."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_added:
    - "06-10 notice clause (D-PG6-20, Original prompt restored by the maintainer review 2026-11-16)"
  overrides_removed: []
  status_correction: "The previous body said the overrides and the D-PG6 decisions waited for maintainer review. The maintainer review of 2026-11-16 locked every D-PG6 row in PROJECT.md (:2401-2409) and confirmed the overrides, so this report records them as confirmed."
decision_coverage:
  honored: 24
  total: 24
  not_honored: []
  amended_by_record:
    - "D-PG6-01: a nested child names its launcher (one hop), not the root main session (PROJECT.md:2401; docs/hooks-compatibility.md:73)"
    - "D-PG6-07: a legacy record is re-resolved and gets mcp_server (review fix WR-02; PROJECT.md:2404)"
    - "D-PG6-10: effort not on UserPromptSubmit (finding F1) and Pi max passes (finding F2) (PROJECT.md:2406)"
    - "D-PG6-15: --fork reads fork and a continued fork reads resume (PROJECT.md:2408)"
    - "D-PG6-20: the block notice ends with Original prompt: <prompt> unless suppressed (maintainer review 2026-11-16; PROJECT.md:2409)"
human_verification: []
---

# Phase 6: Hook Inputs and Events Verification Report

**Phase Goal:** Hooks receive the stdin fields that official plugins read, `UserPromptExpansion` hooks run before a plugin command or skill expands, and a `SessionStart` hook can tell a continued session from a new one.
**Verified:** 2026-11-17T02:07:35Z
**Status:** passed. All six roadmap criteria and all 98 plan truths hold on the current tree. Two plan-truth clauses pass by decision overrides: D-PG6-07 (06-05) and D-PG6-20 (06-10). The maintainer review of 2026-11-16 confirmed both decisions and the two judgment-tier prohibitions.
**Re-verification:** Yes. The previous report (passed, 104/104, 2026-11-16T07:11:07Z) became stale after the maintainer review fixes 4d6825ba and 8c64be00 and later commits changed 19 of its covered non-planning files.

## Verification Basis

This pass re-checked the roadmap criteria and the plan must-haves against the current tree, `features/gaps` at `4de96ee4`. Summaries were not taken as evidence. Each file changed since the previous report's tree (`4527c825`) was diffed and read. Every truth that cites a changed file was checked again, and its citations were moved to current lines. A truth whose files did not change keeps its verdict after a regression check. **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`.

Phase source files changed since the previous report:

- 4d6825ba and 8c64be00 (D-PG6-20): H/dispatch.ts, H/hook-labels.ts, H/wire-protocol.ts, H/payloads/user-prompt-expansion.ts, H/on-failure.ts and H/exec-result.ts. A blocked `UserPromptExpansion` or `UserPromptSubmit` notice now ends with a blank line and `Original prompt: <prompt>`. A JSON block that sets `hookSpecificOutput.suppressOriginalPrompt: true` under its own `hookEventName` leaves the part out, and so does a block from `onFailure: "block"`.
- H/spawn-helpers.ts and `index.ts` (D-PG10-25, unreadable plugin options) and `domain/name.ts` (D-PG8-18, workflow names). These change no Phase 6 behavior. In `index.ts` the lines move by 4.

H/event-router.ts, H/runtime.ts, H/translation-context.ts, H/hook-env.ts, H/tool-batch.ts, H/settle.ts, H/child-root-session.ts, H/mcp-server-table.ts, the other translators, `orchestrators/typed-expansion.ts`, `orchestrators/skill-alias-state.ts` and `edge/skill-aliases.ts` did not change, so their citations hold.

**Gate G (reused, not re-run):** `npm run check` exited 0 at `333784b7` on Node v26.13.1 with a hermetic `PI_CODING_AGENT_DIR` (log `/tmp/pg-final.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). Then the unpaired and integration tests passed, with pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The real-child probes record `piSubagents: 0.88.1` and a `mainSessionId` for each run. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 478645). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 413244). Direct coverage merged 376 LCOV records. The log ends with `exit=0`. `git diff --name-only 333784b7 HEAD` names only `.planning/phases/11-skills-commands-and-records/11-VERIFICATION.md`, so G covers every executable input of HEAD, including 4d6825ba and 8c64be00 and every phase feature. The suite was not repeated.

**Independent checks (this pass):** each run used a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap`. Four owner files ran whole: test/bridges/hooks/hook-labels.test.ts (52/52), wire-protocol.test.ts (98/98), payloads/user-prompt-expansion.test.ts (7/7) and on-failure.test.ts (27/27). The `D-PG6-20` cases of test/bridges/hooks/dispatch.test.ts passed 19/19. Four single named tests passed 1/1 each (N1, N4b, N21, N22 below). `query verify.artifacts` gives 65/65 and `query verify.key-links` 39/39 across the 13 plans. `query verify.commits` confirmed 4d6825ba, 8c64be00, 559c1278, f6586f1f, 0401bac2, 567585d3 and 333784b7.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 6 must-haves |
| --- | --- | --- |
| D-PG6-20, amended by the maintainer review 2026-11-16 (PROJECT.md:2409; 4d6825ba, 8c64be00) | The block notice of a typed command or a prompt ends with a blank line and `Original prompt: <prompt>`, the stdin's `prompt`: `/<name>[ <args>]` for an expansion (`expansionPrompt`, H/payloads/user-prompt-expansion.ts:38-42) and the submitted text for a prompt (`originalPromptOf`, H/dispatch.ts:1666-1672). The first block in routing order decides, and its hook's suppression counts (H/dispatch.ts:573-594, :668-681). `suppressesOriginalPrompt` (H/wire-protocol.ts:205-217) reads the field only under the running event's `hookEventName` and only on the two prompt events. `onFailureBlock` always suppresses (H/on-failure.ts:112-147). | The 06-10 clause "without Claude Code's `Original prompt:` part" no longer holds. A new override carries it. SC3 still holds: the notice shows the reason, then the original prompt (prompt-expansion.feature:50). The 06-12 truth still holds: the head and `[<command>]: <stderr>` on the next line are unchanged. |
| Review fix WR-02 (in-phase, cf060a19), recorded in D-PG6-07 (PROJECT.md:2404, locked by the maintainer review 2026-11-16) | The server table asks the injected MREC-01/02 reader for each enabled record, so a record written before `mcpServerConfigs` is re-resolved (H/mcp-server-table.ts:42-77). | The 06-05 clause that leaves `mcp_server` out for such a record no longer holds. An override carries it. |
| Review fix WR-01 (in-phase, 4120ffa0) | `refreshMcpServers` re-reads both scopes after the load's autoapply (H/event-router.ts:1056-1075, :1695-1698). | Additive to the 06-05 hydrate truth. Scenario mcp-tool-names.feature:109 in G. |
| D-PG10-10 (Phase 10) | Each plugin option is exported to its hooks as `CLAUDE_PLUGIN_OPTION_<KEY>` (H/hook-env.ts:103-105); routing and cache entries carry the options (H/routing-state.ts:85-89, :116-120). | Additive. The session variables still spread last from the hook-facing id (:109), and `CLAUDE_ENV_FILE` still keys on `ownSessionId` (:113). |
| D-PG10-25 (Phase 10, after the previous report) | A hook that names an option of a record whose stored options do not parse fails with `UnreadablePluginOptionsError` (H/spawn-helpers.ts:101-113). | Additive; it touches no Phase 6 field or event. |
| D-PG11-01 (Phase 11) | A bridged command also answers to Claude Code's name for it, as an alias. | The resolver maps every command alias to the command's Pi name (`orchestrators/typed-expansion.ts:95-97`), so the 06-12 truth holds. |
| D-PG11-09 (Phase 11) | Alias targets carry menu text (`menu`). | Additive; the resolver reads only `kind`, `name` and `generatedName`. |
| In-phase successors (06-09, 06-10, 06-12; D-PG6-18) | Three plan truths describe an intermediate state that their own text says a later plan changes: the 06-07 control reading, the 06-08 "13 `pi.on` sites, no handler", and the 06-10 "the handler answers nothing until 06-12". | Each is a record of its plan's tree (commits a5bd001e, edaeda30, eb2907d4). The end state that replaced it is verified below. A registration with no resolver still runs no expansion hook (H/event-router.ts:1136-1138). Counted VERIFIED. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| SC1 | A recording hook sees the same `tool_use_id` on the `PreToolUse` and `PostToolUse` run of one call, and a different one on a second call (PG-HOOK-04). | ✓ VERIFIED | **Code:** `tool_use_id: event.toolCallId` in H/payloads/pre-tool-use.ts:54, post-tool-use.ts:76, post-tool-use-failure.ts:74 (unchanged). An edit pair gets `<id>#<n>` from `editPairToolUseId` (H/tool-batch.ts:126-132), used on the pre path (H/dispatch.ts:1178) and the result path (:1423). **Scenario (in G):** tool-use.feature:864; its rows read `{tool use 1}` on pre and post of the first call and `{tool use 2}` on the second. The runs step projects ids through `hookRunTokens` (features/step_definitions/hook/runs.steps.ts:43, :140) and appends any unstated stdin member as a column (:136-143). **Named test:** N1 (re-run this pass). |
| SC2 | `duration_ms` on `PostToolUse`/`PostToolUseFailure`, `mcp_server` for a plugin MCP tool, `custom_instructions` on `PreCompact`, `model` and `session_title` on `SessionStart`, `effort` for Claude's levels, `permission_mode` per decision 25 (PG-HOOK-04). | ✓ VERIFIED | **duration_ms:** `markedOnExit` wraps only the PreToolUse composite handler and marks in a `finally` (H/dispatch.ts:1096-1122, mark at :1119). The result handler takes the duration on entry (:1328) through `takeToolFacts` (:1379-1388). The value is `max(0, round(now - max(mark, lastTopLevelMark)))` (H/runtime.ts:524-532). The marks clear at agent end (H/settle.ts:152) and at a load (H/runtime.ts:358-366). N2-N4, N4b. **mcp_server:** `runtime.mcpServerFor` (H/runtime.ts:415-417) over `findMcpServer` (H/mcp-server-table.ts:90-105), added by `mcpServerFacts` (H/dispatch.ts:1390-1393) on the pre (:1636) and result (:1348) paths. Scenarios mcp-tool-names.feature:38, :61, :85, :109, both profiles in G. N5, N6. **custom_instructions:** session.feature:85 (`null`), :112. N7. **model / session_title:** H/translation-context.ts:136-151; session.feature:135, :159. **effort:** `hookEffortLevel` (`domain/argument-substitution.ts:303`) through `dispatchEffort` (H/translation-context.ts:95-106), spread only by the tool, Stop and StopFailure translators. tool-use.feature:1909, :1947; prompt-and-stop.feature:252; stop-failure.feature:277. **permission_mode:** never sent (D-PG6-11); docs/hooks-compatibility.md:407 states why. N12. |
| SC3 | A `UserPromptExpansion` hook with matcher `demo:deploy` blocks `/demo:deploy`, the model gets no call, and the notice shows the reason (PG-HOOK-06). | ✓ VERIFIED | **Code:** the expansion `input` handler registers directly after the `UserPromptSubmit` one (H/event-router.ts:1554-1577). It skips a child, `extension` input, a registration with no resolver and an empty bucket (:1129-1141), and a rejected or empty resolution (:1144-1160). The factory injects the resolver (`index.ts:186-189`) before `registerSkillAliases` (:387) and `registerCommandInvocation` (:390). The block text is `promptBlockedText` (H/hook-labels.ts:138-147), which now ends with the original prompt (D-PG6-20). **Scenario (in G):** prompt-expansion.feature:8. `/demo:other one` runs no hook and expands. `/demo:deploy production` records the run and shows `UserPromptExpansion operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: no deploys today\n\nOriginal prompt: /demo:deploy production` (:50), and the turn has no model call. :53 shows that `suppressOriginalPrompt` leaves the part out. **Named tests:** the 19 `D-PG6-20` cases of dispatch.test.ts, among them "shows the event's block notice with an exit-2 stderr (D-PG6-20)". |
| SC4 | A non-blocking expansion hook receives `expansion_type`, Claude-form `command_name`, `command_args`, `command_source` and `prompt`, for a typed template and a typed skill, and the expansion runs (PG-HOOK-06). | ✓ VERIFIED | **Code:** `orchestrators/typed-expansion.ts` sets `plugin`, `userSettings` and `projectSettings` (:47-56, :78-81, :95-97) and the Claude-form skill name (:59-65). H/payloads/user-prompt-expansion.ts builds the stdin; `prompt` now comes from `expansionPrompt` (:38-42, :61), with no trailing space for empty arguments. The refactor keeps the output: the owner file passes 7/7 this pass. **Scenario (in G):** the outline at prompt-expansion.feature:82 covers a command, a command with no argument, `/skill:demo-status` and the alias `/demo:status`; each row states all five fields, and the model then receives the expanded body. :252 covers the user's own template with an empty matcher. **Named tests:** N12, N13, N14. |
| SC5 | A recording `SessionStart` hook records `resume` under `--continue` or `--resume`, and `startup` in a new session (PG-HOOK-11). | ✓ VERIFIED | Files unchanged since the previous report. **Code:** `readSessionLaunchFacts` (H/event-router.ts:199-214), called only for Pi's `startup` reason (:1505-1511); `launchSource` (H/payloads/session-start.ts:48-55). The harness maps a launch to `--no-session`, `--continue`, `--session <file>` or `--fork <file>` (test/e2e/_rpc.ts:294-306), passed by `startProfilePi` (features/support/world.ts:1187). **Scenarios (in G):** session.feature:428, :444, :486, :507, :528, :550. **Named tests:** N18, N19 (previous pass). |
| SC6 | In a pi-subagents child, a tool hook's `session_id`, `transcript_path` and `CLAUDE_CODE_SESSION_ID` name the chosen session, and the page records it. | ✓ VERIFIED | Code files unchanged. `buildTranslationContext` (H/translation-context.ts:131-152); env `transCtx.sessionId` (H/hook-env.ts:109), `CLAUDE_ENV_FILE` on `ownSessionId` (:113); journal owner (H/async-rewake/registry.ts:367); root read (H/child-root-session.ts:17, :47, :72-89), resolved once (H/event-router.ts:329-345, :354-365). **Scenario (in G):** subagent-child.feature:542 runs real pi-subagents 0.88.1 background children; :568 is the no-source case. **Docs:** docs/hooks-compatibility.md:66-73 and :522; D-PG6-01/02/03 (PROJECT.md:2401, Locked). **Named tests:** N8-N11, N17, N20 (previous pass). |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Current evidence |
|------|--------|--------|----------|
| 06-01 | 6 (spike S7 record) | ✓ 6/6 VERIFIED | Unchanged. `06-S7-SPIKE.md` `## Environment` (:5, :10-12), `## Commands` (:30), outputs (:107, :229), `## Result` (:353), `ctx.model?.id` row :379. docs/prd/parity-gaps-prd.md names the record (the PRD changed in other rows only). |
| 06-02 | 7 (`tool_use_id`) | ✓ 7/7 VERIFIED | SC1. Translators unchanged. Tokens: features/lib/hook-run-tokens.ts; runs.steps.ts:43, tool-use.steps.ts:38. N1. |
| 06-03 | 8 (`SessionStart` source, harness launch) | ✓ 8/8 VERIFIED | SC5. Unchanged files: H/payloads/session-start.ts:62-74; H/event-router.ts:1457-1471, :1495-1500; test/e2e/_rpc.ts:296-297; features/lib/saved-sessions.ts:23, :35. |
| 06-04 | 8 (`duration_ms`) | ✓ 8/8 VERIFIED | SC2. The duration-mark cases (`describe("duration marks (D-PG6-06)")`, test/bridges/hooks/dispatch.test.ts:7340) and "gives each pair of a multi-pair edit the call's duration" (:7478, N4b, re-run) pass. No mark: `takeToolFacts` adds nothing for `undefined` (H/dispatch.ts:1384-1387). Load drop at H/runtime.ts:358-366. Token: hook-run-tokens.ts:16, :48. |
| 06-05 | 6 (`mcp_server`) | ✓ 5/6 VERIFIED, 1 PASSED (override) | SC2. H/mcp-server-table.ts:29-40, hydrate H/event-router.ts:815-820, untrusted project :1008 (all unchanged). **Left-out cases:** the legacy-record clause is superseded (override 3, D-PG6-07 / WR-02). |
| 06-06 | 6 (`custom_instructions`, `model`, `session_title`) | ✓ 6/6 VERIFIED | Unchanged: H/payloads/pre-compact.ts:11, :27, :41; session-start.ts:102-103; user-prompt-submit.ts:9, :20, :33; H/translation-context.ts:136-151. N7. |
| 06-07 | 7 (real-children harness and root resolver) | ✓ 7/7 VERIFIED (1 transitional) | Unchanged files. subagent-hooks.steps.ts:290-306; real-subagent-child.ts:748-751; `subagentParentSessionId` (platform/subagent-child.ts:49-52); H/child-root-session.ts:72-89; H/event-router.ts:337-346, :361-364; H/runtime.ts:595-601. |
| 06-08 | 8 (admitted event, name matcher, translator) | ✓ 8/8 VERIFIED (1 transitional) | `domain/components/hook-events.ts:62`, :206; `parseNameMatcher` (`domain/components/hooks/matcher.ts:130-132`); partition `regex` drop (`domain/components/hooks/partition.ts:52-55`); configuration.feature:222, :248. Translator still holds no `effort`, `permission_mode` or `session_title` (H/payloads/user-prompt-expansion.ts:21-31, :49-63); N12 in the owner file run. Child H/event-router.ts:178; timeout H/timeout.ts:79; background name H/async-rewake/rewake-text.ts:30; `if` H/if-field/index.ts:19. |
| 06-09 | 7 (child names the launching session) | ✓ 7/7 VERIFIED | SC6. `applySessionEnv(sessionId)` still assigns the own id (`shared/session-env.ts:65-67`), called with `ctx.sessionManager.getSessionId()` (`index.ts:325`). |
| 06-10 | 10 (expansion dispatch) | ✓ 9/10 VERIFIED, 1 PASSED (override) (1 transitional clause) | SC3. Order and filters: H/event-router.ts:1129-1141, :1554-1577; N15, N16. Matcher: `matcherFiresOnCommandName` (H/dispatch.ts:180-196). **Notices:** a block and a stop answer `handled` and the model gets no call; the stop shows `Operation stopped by hook[: <stopReason>]` (prompt-expansion.feature:191). The clause "without Claude Code's `Original prompt:` part" is superseded by D-PG6-20 (override 4); the notice now ends with the original prompt (H/hook-labels.ts:138-147; docs/hooks-compatibility.md:208). Missing-script rule excludes the event (H/wire-protocol.ts:60), so exit 2 blocks; plain stdout counts as context (:51-58). Context event: `PROMPT_CONTEXT_EVENTS` (H/routing-state.ts:159-164, :179), used by the input adapter (H/event-adapters.ts:142, :594, :678, :717) and labeled per event (H/event-router.ts:367-375). 14 sites: H/event-router.ts:1444, 1524, 1533, 1541, 1554, 1568, 1582, 1588, 1597, 1603, 1615, 1619, 1627, 1647 (file unchanged), pinned by test/architecture/hooks-lifecycle.test.ts (N21, re-run). Scenarios prompt-expansion.feature:128, :161, :191, :220 in G. |
| 06-11 | 5 (`effort`) | ✓ 5/5 VERIFIED | SC2. `claudeEffort` vs `hookEffortLevel` (`domain/argument-substitution.ts:291-305`, unchanged). The "sends no effort from a context that holds one" owner cases (six payload files) pass in G. `reasoningModelPath` (features/lib/scripted-model/extension.ts:240, :294, :310). |
| 06-12 | 11 (typed-line resolution and the expansion scenarios) | ✓ 11/11 VERIFIED | SC3, SC4. Resolver unchanged: precedence `orchestrators/typed-expansion.ts:151-160`, :120-125, :131-134, :127-129. Cache: `createPluginNamesCache` (`orchestrators/skill-alias-state.ts:443-472`), one instance passed to both (`index.ts:186-189`, :387), cleared at `session_start` (`edge/skill-aliases.ts:175-176`), awaited (`typed-expansion.ts:106`). The SC3 scenario still shows the head and `[<command>]: <stderr>` on the next line (prompt-expansion.feature:50); the original prompt part follows. A prompt hook blocks first and runs no expansion hook (:161; its notice now ends with `Original prompt: /demo:cmd first second`, :188). Token: `SLASH_TOKEN` (:32); case-only mismatch (typed-expansion.test.ts:170). Load failure: N14. |
| 06-13 | 9 (page, catalog, CHANGELOG) | ✓ 9/9 VERIFIED | docs/hooks-compatibility.md: tool fields :29, :401-404; child :66-73; event :101, :182-218 (the block form at :208 now names the `Original prompt:` part and its two exceptions), unsupported list from :225; `mcp_prompt` :196; launch rows :136-139; stdin :404-407; differences :401, :402, :403, :216, :37-51. docs/output-catalog.md:5564 names the block notice and its `Original prompt:` part; the `catalog-state: hook-notice` fenced block (:5558-5562) is unchanged (only its prose line changed) and test/architecture/hooks-notice-notify.test.ts passes in G. CHANGELOG.md:26-32 (the `UserPromptExpansion` line :29 now also names the original prompt; :30 is the `UserPromptSubmit` line). docs/env-vars.md:121. No feature description claims a phase field is not sent or that a child hook names its own session. |

**Score:** 104/104 truths verified: 6 success criteria and 98 plan truths. 102 are VERIFIED directly and 2 are PASSED (override): the 06-05 legacy-record clause (D-PG6-07) and the 06-10 notice clause (D-PG6-20). Three plan truths are transitional records whose successor state is verified. None is behavior-unverified: every behavior-dependent truth has a passing named test from this pass or the previous one, or a scenario in G.

### Prohibitions

| Plan | Statement | Tier | Disposition |
|------|-----------|------|-------------|
| 06-09 | MUST NOT send the launching session's `session_id` on a child tool hook that carries no `agent_id`. | judgment | LLM verdict: holds (see override 1; the cited files did not change). Carried by the orchestrator's override, which the maintainer review of 2026-11-16 confirmed. |
| 06-13 | MUST NOT leave a user believing that an installed plugin's `UserPromptExpansion` hooks run before its next `update` or `reinstall`. | judgment | LLM verdict: holds (CHANGELOG.md:29, docs/hooks-compatibility.md:121). Carried by the orchestrator's override, which the maintainer review of 2026-11-16 confirmed. |

## Required Artifacts

`query verify.artifacts`: 06-01 2/2, 06-02 6/6, 06-03 5/5, 06-04 5/5, 06-05 5/5, 06-06 5/5, 06-07 5/5, 06-08 5/5, 06-09 4/4, 06-10 5/5, 06-11 5/5, 06-12 6/6, 06-13 4/4. Each artifact exists, is substantive, and is wired:

| Artifact | Status | Details |
|---|---|---|
| H/payloads/tool-event-facts.ts | ✓ VERIFIED | `withToolFacts`/`toolFactFields`; used by H/dispatch.ts:95, :1348, :1636 and the three translators |
| H/mcp-server-table.ts | ✓ VERIFIED | `mcpServerEntries` :57, `findMcpServer` :90; hydrate H/event-router.ts:815-820, refresh :1049-1075 |
| H/runtime.ts | ✓ VERIFIED | `recordToolCallPrepared` :513, `takeToolDuration` :524, `clearToolCallMarks` :353, `mcpServerFor` :415, `recordChildRoot` :595 |
| H/child-root-session.ts | ✓ VERIFIED | `resolveChildRootSession` :72; called at H/event-router.ts:357 |
| H/translation-context.ts | ✓ VERIFIED | `ownSessionId`, `sessionTitle`, `readonly effort`; `buildTranslationContext` :131-152 |
| H/payloads/user-prompt-expansion.ts | ✓ VERIFIED | `translateUserPromptExpansion` in both translator tables (H/dispatch-exec.ts:155, H/async-rewake/registry.ts:165); `expansionPrompt` :38, imported by H/dispatch.ts:96 and used at :1668 |
| H/hook-labels.ts | ✓ VERIFIED | `promptBlockedText` :138-147 with the optional `originalPrompt`; called by `blockNotices` (H/dispatch.ts:573-594) |
| H/payloads/session-start.ts | ✓ VERIFIED | `SessionLaunchFacts`, `claudeSessionStartSource`; called at H/event-router.ts:1510 |
| `orchestrators/typed-expansion.ts` | ✓ VERIFIED | `createTypedExpansionResolver`; injected at `index.ts:189` |
| `orchestrators/skill-alias-state.ts`, `edge/skill-aliases.ts` | ✓ VERIFIED | `loadPluginNames` :397, `createPluginNamesCache` :443; shared through `index.ts:186`, :387 |
| `domain/components/hook-events.ts`, `domain/components/hooks/matcher.ts` | ✓ VERIFIED | admitted event :62; `parseNameMatcher` :130 |
| `domain/argument-substitution.ts` | ✓ VERIFIED | `hookEffortLevel` :303 |
| `platform/subagent-child.ts` | ✓ VERIFIED | `subagentParentSessionId` :49; called at H/event-router.ts:358 |
| test/e2e/_rpc.ts, features/lib/hook-run-tokens.ts, features/lib/saved-sessions.ts, features/lib/scripted-model/extension.ts | ✓ VERIFIED | `PiSessionLaunch` :115, `sessionFlags` :294; tokens; `{session file}`; `reasoningModelPath` |
| Phase features and step files | ✓ VERIFIED | all in G; no `@skip`/`@wip` tag |
| docs/hooks-compatibility.md, docs/output-catalog.md, docs/env-vars.md, CHANGELOG.md, docs/prd/parity-gaps-prd.md | ✓ VERIFIED | see the 06-01 and 06-13 rows |

## Key Link Verification

`query verify.key-links`: 39/39 across the 13 plans (01 2/2, 02 3/3, 03 3/3, 04 3/3, 05 3/3, 06 2/2, 07 3/3, 08 4/4, 09 3/3, 10 4/4, 11 3/3, 12 4/4, 13 2/2).

| From | To | Current connection | Status |
|---|---|---|---|
| H/dispatch.ts | H/tool-batch.ts `editPairToolUseId` | pre :1178, result :1423 | WIRED |
| H/dispatch.ts | H/runtime.ts marks | `recordToolCallPrepared` :1119, `takeToolDuration` :1384 | WIRED |
| H/dispatch.ts | H/runtime.ts `mcpServerFor` | `mcpServerFacts` :1390-1393 | WIRED |
| H/dispatch.ts | H/payloads/user-prompt-expansion.ts `expansionPrompt`, H/hook-labels.ts `promptBlockedText` | `originalPromptOf` :1666-1672 -> `hookNotices` :1078-1083 -> `blockNotices` :573-594 | WIRED |
| H/wire-protocol.ts, H/on-failure.ts | `HookExecResult.suppressOriginalPrompt` (H/exec-result.ts:96-97) | `normalizeClaudeStdout` :194-199, `onFailureBlock` :143-147 -> `blocks` (H/dispatch.ts:668-681) | WIRED |
| H/event-router.ts | H/mcp-server-table.ts | `mcpServerEntries` :815, :1049 | WIRED |
| H/event-router.ts | H/payloads/session-start.ts | `claudeSessionStartSource` :1510 | WIRED |
| H/event-router.ts | expansion handler | second `input` registration :1568-1577 | WIRED |
| H/event-router.ts | H/child-root-session.ts, `platform/subagent-child.ts` | :357-358 | WIRED |
| H/dispatch-exec.ts, H/async-rewake/registry.ts | `buildTranslationContext` | :229, :365; owner `ownSessionId` :367 | WIRED |
| H/hook-env.ts | session env / env file | `transCtx.sessionId` :109, `ownSessionId` :113 | WIRED |
| `index.ts` | H/event-router.ts, `edge/skill-aliases.ts` | `resolveTypedExpansion` :189, one cache :186, :387 | WIRED |
| `orchestrators/typed-expansion.ts` | `orchestrators/skill-alias-state.ts` | `PluginNamesCache` :23, :106 | WIRED |
| H/translation-context.ts | `domain/argument-substitution.ts` | `hookEffortLevel` :104 | WIRED |
| features/support/world.ts | test/e2e/_rpc.ts | `session: launch.session` :1187 | WIRED |
| runs.steps.ts, tool-use.steps.ts | hook-run-tokens.ts, saved-sessions.ts | :43, :45; :38 | WIRED |
| docs/output-catalog.md | test/architecture/hooks-notice-notify.test.ts | `catalog-state: hook-notice` :5558 | WIRED |

## Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| `tool_use_id` | Pi `toolCallId` -> translator -> hook stdin | Yes; distinct tokens per call in tool-use.feature:864 | FLOWING |
| `duration_ms` | `tool_call` exit mark -> `takeToolDuration` -> result stdin | Yes; `{milliseconds}` rows | FLOWING |
| `mcp_server` | state records -> MREC reader -> server table -> `findMcpServer` -> stdin | Yes; `{"name":"plugin:demo:stub","source":"plugin"}` rows | FLOWING |
| `SessionStart` source | `sessionManager` header and entries -> `launchSource` -> stdin | Yes; `resume`/`fork`/`startup` rows | FLOWING |
| Expansion fields | Pi command list + name table -> resolver -> synthetic event -> stdin | Yes; five fields asserted per row | FLOWING |
| Block notice `Original prompt:` | synthetic event (`expansionPrompt`) or Pi `input` text -> `originalPromptOf` -> `promptBlockedText` -> `hook-notice` | Yes; `/demo:deploy production` in prompt-expansion.feature:50, `/demo:cmd first second` in :188 | FLOWING |
| Child session fields | `PI_SUBAGENT_PARENT_SESSION` + header file -> root -> context -> stdin and env | Yes; `main` from the main Pi's `get_state` | FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services.

| ID | Test | File | Result |
| --- | --- | --- | --- |
| N1 | a native edit with one pair keeps the call's tool use id before and after the call | test/bridges/hooks/dispatch.test.ts | PASS (this pass) |
| N4b | gives each pair of a multi-pair edit the call's duration | test/bridges/hooks/dispatch.test.ts | PASS (this pass) |
| N21 | same-runtime reload makes every retained registration inert before argument access (pins the 14-site order) | test/architecture/hooks-lifecycle.test.ts | PASS (this pass) |
| N22 | blocks a hook that exits 1 when onFailure is block (now carries `suppressOriginalPrompt: true`) | test/bridges/hooks/dispatch-exec.test.ts | PASS (this pass) |
| D20 | the 19 cases named `D-PG6-20` (block notices with and without the original prompt, first block wins, a later block's suppression ignored) | test/bridges/hooks/dispatch.test.ts | 19/19 PASS (this pass) |
| OWN | whole owner files: hook-labels (52), wire-protocol (98), payloads/user-prompt-expansion (7, includes N12), on-failure (27) | test/bridges/hooks/ | 184/184 PASS (this pass) |
| N2-N3, N5-N11, N13-N20 | the named tests of the previous report; their source and test files did not change | as listed in the previous report | PASS (previous pass, and in G) |
| G | `npm run check` at `333784b7` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

Not applicable. Spike S7 is a recorded one-time measurement (`06-S7-SPIKE.md`), not a committed probe script, and no plan declares a `probe-*.sh`.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| PG-HOOK-04 | 06-02, 06-04, 06-05, 06-06, 06-07, 06-09, 06-11, 06-13 | ✓ SATISFIED | SC1, SC2, SC6. REQUIREMENTS.md:29 `[x]`, trace :180 Complete |
| PG-HOOK-06 | 06-08, 06-10, 06-12, 06-13 | ✓ SATISFIED | SC3, SC4. REQUIREMENTS.md:30 `[x]`, trace :181 Complete |
| PG-HOOK-11 | 06-01, 06-03, 06-13 | ✓ SATISFIED | SC5. REQUIREMENTS.md:34 `[x]`, trace :185 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these three IDs to Phase 6, and each appears in plan frontmatter. BACKLOG HOOKORIGPROMPT-01 (:4810) is now closed by D-PG6-20.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| The files changed since the previous report (H/dispatch.ts, hook-labels.ts, wire-protocol.ts, on-failure.ts, exec-result.ts, payloads/user-prompt-expansion.ts, prompt-expansion/messages/prompt-commands features) | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | None | No match |
| The phase features | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- docs/hooks-compatibility.md:428 states a remaining difference: upstream rejects a hook's whole output for a wrong `hookEventName`, while the bridge only ignores `suppressOriginalPrompt`. The page records it.
- IN2-01 and IN2-02 (the `mcp_server` row at docs/hooks-compatibility.md:402 does not name every no-server case) stay review residuals.
- WR-03 (a queued follow-up expansion's context is dropped) stays a documented Pi gap (docs/hooks-compatibility.md:219, :451).
- Bash in a child sees the child's own `CLAUDE_CODE_SESSION_ID` while its hooks see the launcher's (D-PG6-03), stated at :73 and docs/env-vars.md:121.
- BACKLOG HOOKMCPSERVERSCOPE-01 (`mcp_server` for an MCP tool of no plugin) stays open, as D-PG6-07 records.

## Human Verification Required

None. The two judgment-tier prohibitions are carried by overrides that the maintainer review of 2026-11-16 confirmed.

## Maintainer Review

The maintainer review of 2026-11-16 settled every item that the previous report left open:

1. **06-09 prohibition (orchestrator override):** confirmed. A child tool hook that names the launching session always carries `agent_id`.
2. **06-13 prohibition (orchestrator override):** confirmed. The CHANGELOG and the page tell a user to run `update` or `reinstall` for a plugin installed earlier.
3. **D-PG6-07 (decision override):** confirmed. A legacy record's MCP tools get `mcp_server` (review fix WR-02).
4. **D-PG6-20 (decision override, new in this report):** the review restored the `Original prompt:` part of the block notice, which replaces the 06-10 clause that left it out (4d6825ba, 8c64be00).

D-PG6-01 to D-PG6-22 are locked in PROJECT.md (:2401-2409). D-PG6-23/24 (:2410) record the evidence and the docs. They are implemented as recorded.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all six roadmap criteria and all 98 plan truths of Phase 6 hold. Every citation points at a current line. The maintainer review fixes changed the phase in one place, and it breaks no criterion:

- A blocked typed command or prompt now ends its notice with a blank line and `Original prompt: <prompt>`, as Claude Code 2.1.323 does. A hook can suppress it with `suppressOriginalPrompt`, and a block from `onFailure: "block"` always leaves it out (D-PG6-20). SC3 asks that the notice show the reason, and it still does. The one 06-10 clause that said the part is left out passes by the D-PG6-20 override.

The other changes since the previous report (D-PG10-25, D-PG8-18, docs and CHANGELOG lines) only move cited lines. The status stays `passed`, and the score stays 104/104, now with two overrides on plan truths.

---

_Verified: 2026-11-17T02:07:35Z_
_Verifier: Claude (gsd-verifier)_
