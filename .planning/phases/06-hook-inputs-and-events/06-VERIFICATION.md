---
phase: 06-hook-inputs-and-events
verified: 2026-11-15T09:30:00Z
status: passed
score: 6/6 must-haves verified
covered_files: [".agents/skills/cucumber/rules/features.md",".agents/skills/cucumber/rules/layout.md",".agents/skills/cucumber/rules/world-and-stand-ins.md",".planning/phases/06-hook-inputs-and-events/06-01-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-01-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-02-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-02-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-03-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-03-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-04-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-04-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-05-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-05-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-06-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-06-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-07-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-07-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-08-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-08-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-09-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-09-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-10-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-10-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-11-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-11-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-12-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-12-SUMMARY.md",".planning/phases/06-hook-inputs-and-events/06-13-PLAN.md",".planning/phases/06-hook-inputs-and-events/06-13-SUMMARY.md","CHANGELOG.md","docs/env-vars.md","docs/hooks-compatibility.md","docs/output-catalog.md","docs/prd/parity-gaps-prd.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts","extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts","extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts","extensions/pi-claude-marketplace/bridges/hooks/index.ts","extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts","extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/timeout.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts","extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/argument-substitution.ts","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/domain/components/hooks.ts","extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts","extensions/pi-claude-marketplace/domain/components/hooks/partition.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts","extensions/pi-claude-marketplace/platform/subagent-child.ts","extensions/pi-claude-marketplace/shared/concerns/hooks.ts","features/agent/frontmatter.feature","features/hook/async.feature","features/hook/configuration.feature","features/hook/failures.feature","features/hook/lifecycle.feature","features/hook/matchers.feature","features/hook/mcp-tool-names.feature","features/hook/messages.feature","features/hook/prompt-and-stop.feature","features/hook/prompt-expansion.feature","features/hook/session-end.feature","features/hook/session.feature","features/hook/stop-failure.feature","features/hook/tool-failure.feature","features/hook/tool-use.feature","features/lib/hook-run-tokens.ts","features/lib/mcp-configuration.ts","features/lib/real-subagent-child.ts","features/lib/saved-sessions.ts","features/lib/scripted-model/extension.ts","features/plugin/project-locality.feature","features/plugin/project-trust.feature","features/plugin/subagent-child.feature","features/skill/model-reads.feature","features/step_definitions/hook/prompt-commands.steps.ts","features/step_definitions/hook/runs.steps.ts","features/step_definitions/hook/session.steps.ts","features/step_definitions/hook/tool-use.steps.ts","features/step_definitions/mcp-configuration.steps.ts","features/step_definitions/mcp-implementation.steps.ts","features/step_definitions/model.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/world.ts","test/architecture/closed-set-enrollment.test.ts","test/architecture/hooks-lifecycle.test.ts","test/architecture/hooks-translators.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/async-rewake/rewake-text.test.ts","test/bridges/hooks/child-root-session.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/hook-env.test.ts","test/bridges/hooks/hook-labels.test.ts","test/bridges/hooks/if-field/index.test.ts","test/bridges/hooks/index.test.ts","test/bridges/hooks/mcp-server-table.test.ts","test/bridges/hooks/payloads/post-compact.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-compact.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/payloads/session-end.test.ts","test/bridges/hooks/payloads/session-start.test.ts","test/bridges/hooks/payloads/stop-failure.test.ts","test/bridges/hooks/payloads/stop.test.ts","test/bridges/hooks/payloads/tool-event-facts.test.ts","test/bridges/hooks/payloads/user-prompt-expansion.test.ts","test/bridges/hooks/payloads/user-prompt-submit.test.ts","test/bridges/hooks/routing-state.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/timeout.test.ts","test/bridges/hooks/tool-batch.test.ts","test/bridges/hooks/translation-context.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/domain/argument-substitution.test.ts","test/domain/components/hook-events.test.ts","test/domain/components/hooks.test.ts","test/domain/components/hooks/matcher.test.ts","test/domain/components/hooks/partition.test.ts","test/e2e/_rpc.ts","test/edge/skill-aliases.test.ts","test/index.test.ts","test/integration/hooks-additionalcontext-end-to-end.test.ts","test/integration/hooks-cross-scope-reconcile.test.ts","test/integration/hooks-dispatch-end-to-end.test.ts","test/integration/hooks-spawn-end-to-end.test.ts","test/integration/pi-subagents-child-identity.test.ts","test/orchestrators/mcp/recorded-servers.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/typed-expansion.test.ts","test/platform/subagent-child.test.ts","test/shared/concerns/hooks.test.ts"]
covered_digest: "v4:sha256:69132233a98757bd9e376e60e02788d9594341f95e120aa9bb433440d9b2ab18"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "Judgment-tier prohibition (06-09): a child tool hook that names the launching session always carries agent_id"
    reason: "Judgment-tier prohibition; verifier verdict satisfied and confirmed by the orchestrator: buildTranslationContext (bridges/hooks/translation-context.ts:131-152) takes the root only from the kept child identity, which also sets childIdentity, and a child dispatches only tool events, whose translators add agent_id"
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T10:00:00Z"
  - must_have: "Judgment-tier prohibition (06-13): a user learns that a plugin installed earlier needs update or reinstall before its UserPromptExpansion hooks run"
    reason: "Judgment-tier prohibition; verifier verdict satisfied and confirmed by the orchestrator: CHANGELOG.md line 28 and docs/hooks-compatibility.md:121 both name /claude:plugin update and reinstall"
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T10:00:00Z"
decision_coverage:
  honored: 24
  total: 24
  not_honored: []
  amended_by_record:
    - "D-PG6-01: a nested child names its launcher (one hop), not the root main session (PROJECT.md D-PG6-01/02/03 row; docs/hooks-compatibility.md:73)"
    - "D-PG6-10: effort not on UserPromptSubmit (finding F1) and Pi max passes (finding F2) (PROJECT.md D-PG6-10 row)"
    - "D-PG6-15: --fork reads fork and a continued fork reads resume (PROJECT.md D-PG6-13..17 row)"
human_verification: []
---

# Phase 6: Hook Inputs and Events Verification Report

**Phase Goal:** Hooks receive the stdin fields that official plugins read, `UserPromptExpansion` hooks run before a plugin command or skill expands, and a `SessionStart` hook can tell a continued session from a new one.
**Verified:** 2026-11-15T09:30:00Z
**Status:** passed with two overrides (all six success criteria verified; the two judgment-tier prohibitions were judged satisfied by the verifier, confirmed by the orchestrator, and accepted as overrides pending maintainer review)
**Re-verification:** No, initial verification

All six roadmap success criteria hold in the code at HEAD `8874947c`. Each has a whole-payload cucumber scenario and owner tests. The only open items are the two judgment-tier prohibitions of plans 06-09 and 06-13. The agent rules do not let a verifier pass those on its own verdict.

## Gate evidence

- Phase gate, run by the orchestrator and not rerun here: `/tmp/pg6-iter1.log`, at `4a4f3a82`, ends `exit=0`. It ran 1967 adapter and 188 builtin scenarios, all passed, and merged 369 direct coverage records.
- `git diff --stat 4a4f3a82..HEAD` changes only `.planning/BACKLOG.md`, `06-REVIEW.md`, and `06-VALIDATION.md`. So the build inputs at HEAD are the ones the gate checked.
- My own runs, all in a hermetic home (`test/platform/isolated-pi-home.ts` and the cucumber sandbox):
  - Owner tests for `session-start`, `translation-context`, `child-root-session`, `tool-batch`, `tool-event-facts`, `user-prompt-expansion`, `typed-expansion`, `mcp-server-table`, and `pre-compact`: 134/134 pass.
  - `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-expansion.feature features/hook/session.feature`: 38/38 scenarios, 521 steps pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (PG-HOOK-04): a recording hook sees one `tool_use_id` on the `PreToolUse` and `PostToolUse` runs of one call, and another on a second call | VERIFIED | **Code:** `tool_use_id: event.toolCallId` in `payloads/pre-tool-use.ts:54`, `post-tool-use.ts:76`, `post-tool-use-failure.ts:74`. Edit pairs get `<id>#<n>` from `editPairToolUseId` (`tool-batch.ts:126-132`), which both the pre path (`dispatch.ts:1152`) and the result path (`dispatch.ts:1397`) use. **Scenario:** `features/hook/tool-use.feature:864`. Its rows read `{tool use 1}` on pre and post of the first call and `{tool use 2}` on the second. `features/lib/hook-run-tokens.ts` gives tokens by first appearance, so a constant id or a mismatched pair would fail the table. The runs step compares whole payloads: an unstated stdin member becomes a column (`runs.steps.ts:60-66`). |
| 2 | SC2 (PG-HOOK-04): `duration_ms` on `PostToolUse`/`PostToolUseFailure`, `mcp_server` for a plugin MCP tool, `custom_instructions` on `PreCompact`, `model` and `session_title` on `SessionStart`, `effort` for Claude's levels, `permission_mode` per decision 25 | VERIFIED | **duration_ms:** marked on every exit of the `tool_call` handler (`dispatch.ts:1080-1096`), taken on entry of the result handler (`dispatch.ts:1302`, `:1352-1360`), and computed as `max(0, round(now - max(mark, lastTopLevelMark)))` (`runtime.ts:524-532`). Marks clear at the end of a run (`settle.ts:152`). The pre event never gets the fact. Scenarios have `{milliseconds}` 36 times in `tool-use.feature` and 19 times in `tool-failure.feature`. **mcp_server:** `{name:"plugin:<plugin>:<server>",source:"plugin"}` via `runtime.mcpServerFor` (`runtime.ts:415`) and `mcpServerFacts` (`dispatch.ts:1363-1366`, `:1322`, `:1610`). The table is built in hydrate and refreshed after autoapply (WR-01/02 fixes). `@mcp` scenarios at `mcp-tool-names.feature:38`, `:61`, `:85`, and `:109` ran under both profiles. **custom_instructions:** `session.feature:85` shows `null`, and `:112` shows `keep the API notes`. **model / session_title:** `translation-context.ts:137-149`. `session.feature:135` shows `faux-1` and `Release prep`, and `:159` shows `session_title` on `UserPromptSubmit`. **effort:** `hookEffortLevel` over `low..max` (`argument-substitution.ts:46`, `:298`) is spread only by the tool, Stop, and StopFailure translators. The outline at `tool-use.feature:1909` covers low, medium, and high, with no effort on `UserPromptSubmit`. `:1947` gives `minimal` no field. Stop and StopFailure scenarios are at `prompt-and-stop.feature:252` and `stop-failure.feature:277`. **permission_mode:** never sent (D-PG6-11). The whole-payload tables would show it, and `docs/hooks-compatibility.md:399` states the reason. |
| 3 | SC3 (PG-HOOK-06): a `UserPromptExpansion` hook with matcher `demo:deploy` blocks `/demo:deploy`, the model gets no call, and the notice shows the reason | VERIFIED | **Code:** a second `input` handler is registered right after `UserPromptSubmit` (`event-router.ts:1543-1566`). It skips `extension` input, a child, an empty bucket, and an unresolved line (`:1119-1131`). The resolver is injected in `index.ts:165-169`, before `registerSkillAliases`/`registerCommandInvocation` (`index.ts:349-352`), so the hooks see the line before it expands. The block text comes from `hook-labels.ts:142`. **Scenario:** `prompt-expansion.feature:8`. `/demo:other` runs no hook and expands. `/demo:deploy production` records the run, shows `UserPromptExpansion operation blocked by hook:\n[...guard.sh]: no deploys today`, and the turn has zero model calls (`prompt-commands.steps.ts:16-18`). |
| 4 | SC4 (PG-HOOK-06): a non-blocking expansion hook receives `expansion_type`, Claude-form `command_name`, `command_args`, `command_source`, and `prompt`, for a typed template and a typed skill, and the expansion runs | VERIFIED | **Code:** `orchestrators/typed-expansion.ts` sets the `plugin`, `userSettings`, and `projectSettings` sources (`:50-52`, `:81`, `:96-97`), and `payloads/user-prompt-expansion.ts` builds the stdin. **Scenario:** the outline at `prompt-expansion.feature:53` covers command, command with no argument, `/skill:demo-status`, and the skill alias `/demo:status`. Each row states all five fields, and the model then receives the expanded body. `:223` covers the user's own template with an empty matcher. The order, a prompt-hook block, a stop, and the context forms are at `:99`, `:132`, `:162`, and `:191`. |
| 5 | SC5 (PG-HOOK-11): a recording `SessionStart` hook records `resume` under `--continue` or `--resume`, and `startup` in a new session | VERIFIED | **Code:** `readSessionLaunchFacts` reads only `getHeader()`/`getEntries()` (`event-router.ts:197-212`). `launchSource` checks for a fork first, then for `message` entries (`payloads/session-start.ts:48-55`). A throwing read keeps `startup` (0d07e530). The harness flags are in `test/e2e/_rpc.ts:294-305` (`--continue`, `--session <file>`, `--fork <file>`, default `--no-session`). **Scenarios:** `session.feature:428` (new saved session reads `startup`), `:444` (`--continue` reads `resume`, and a `startup` matcher does not run), `:486` (`--session`), `:507` (`--fork` reads `fork`), `:528` (a continued fork reads `resume`), and `:550` (`--continue` with nothing saved reads `startup`). All passed in my run. |
| 6 | SC6: in a pi-subagents child, a tool hook's `session_id`, `transcript_path`, and `CLAUDE_CODE_SESSION_ID` name the chosen session, and the page records it | VERIFIED | **Code:** `buildTranslationContext` uses the root only through a kept identity (`translation-context.ts:131-152`). The env takes `transCtx.sessionId`, while `CLAUDE_ENV_FILE` keys on `ownSessionId` (`hook-env.ts:99`, `:103`). The journal owner keys on `ownSessionId` (`registry.ts:367`). The root resolver makes a one-hop, 65,536-byte, regular-file-only read (`child-root-session.ts`). **Scenario:** `subagent-child.feature:540` (`@mcp`) runs real pi-subagents 0.88.1 background children. Their tool hooks record `main` / `session file of main` / `main`, and `agent id` is the child's own. `main` is the main Pi's RPC `get_state` session id (`real-subagent-child.ts:743-753`, `subagent-hooks.steps.ts:290-306`), not a value the bridge reports. `:566` shows the no-source fallback (the children keep their own ids). **Docs:** `docs/hooks-compatibility.md:57-77` and `:513`. The one-hop rule is a recorded deviation (PROJECT.md D-PG6-01/02/03). |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Plan must-haves spot-checked (all VERIFIED)

- 06-01: `06-S7-SPIKE.md` has `## Result`, and PRD row S7 (`docs/prd/parity-gaps-prd.md:956`) names the record.
- 06-04: a mark is dropped at the end of a run and at registration (`runtime.ts:353-366`, `settle.ts:152`), and a missing mark sends no field (`tool-event-facts.ts:33-41`).
- 06-08 / D-PG6-21: the event is admitted (`hook-events.ts:62`, matcher key `command_name` `:206`). `info` reports it supported and install needs no `--partial` (`configuration.feature:222`, `:248`). `CHILD_EVENT_POLICY` suppresses it in a child (`event-router.ts:176`).
- 06-09 prohibition: only tool events dispatch in a child (`event-router.ts:164-177`), and each tool translator spreads `agent_id` from the kept identity. Judged satisfied, flagged below.
- 06-13: the page states every new field, `permission_mode` not sent (`:399`), the Session events rows (`:136-139`), `mcp_prompt` never sent (`:196`), and the update/reinstall note (`:121`). The CHANGELOG Unreleased has six reader-facing bullets for the phase. The output catalog names the block notice (`docs/output-catalog.md:5423`).

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `bridges/hooks/payloads/tool-event-facts.ts` | VERIFIED | `withToolFacts`/`toolFactFields`, used by dispatch and the three translators |
| `bridges/hooks/mcp-server-table.ts` | VERIFIED | `mcpServerEntries`/`findMcpServer`, wired through hydrate and `refreshMcpServers` |
| `bridges/hooks/child-root-session.ts` | VERIFIED | `resolveChildRootSession`, one hop, bounded read |
| `bridges/hooks/payloads/user-prompt-expansion.ts` | VERIFIED | translator served by the composite handler |
| `orchestrators/typed-expansion.ts` | VERIFIED | `createTypedExpansionResolver`, injected at `index.ts:168` |
| `features/lib/hook-run-tokens.ts`, `features/lib/saved-sessions.ts` | VERIFIED | used by `runs.steps.ts` and `tool-use.steps.ts` |
| `test/e2e/_rpc.ts` `PiSessionLaunch` | VERIFIED | `sessionFlags` `:294-305` |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `dispatch.ts` | `tool-batch.ts editPairToolUseId` | pre `:1152`, result `:1397` | WIRED |
| `dispatch.ts` | `runtime.ts recordToolCallPrepared/takeToolDuration` | `:1093`, `:1358` | WIRED |
| `dispatch.ts` | `runtime.ts mcpServerFor` | `mcpServerFacts` `:1365` | WIRED |
| `event-router.ts` | `session-start.ts claudeSessionStartSource` | `:1497-1500` | WIRED |
| `event-router.ts` | `expansionInputHandler` | `pi.on("input")` `:1556-1565` | WIRED |
| `index.ts` | `typed-expansion.ts` | `resolveTypedExpansion` `:168` | WIRED |
| `dispatch-exec.ts`, `registry.ts` | `buildTranslationContext` | `:229`, `:365` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Launch source, context fields, root read, edit ids, facts, expansion translator and resolver, server table, PreCompact | `node --import test/platform/isolated-pi-home.ts --test <9 owner files>` | 134/134 pass | PASS |
| SC3, SC4, SC5 scenarios and the session fields | `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-expansion.feature features/hook/session.feature` | 38/38 scenarios pass | PASS |
| Whole suite, both profiles | phase gate log `/tmp/pg6-iter1.log` (not rerun) | 1967 + 188 passed, exit 0 | PASS |

### Probe Execution

Not applicable. Spike S7 is a recorded one-time measurement (`06-S7-SPIKE.md`), not a committed probe script.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| PG-HOOK-04 | 06-02, 06-04, 06-05, 06-06, 06-07, 06-09, 06-11, 06-13 | SATISFIED | Truths 1, 2, 6 |
| PG-HOOK-06 | 06-08, 06-10, 06-12, 06-13 | SATISFIED | Truths 3, 4 |
| PG-HOOK-11 | 06-01, 06-03, 06-13 | SATISFIED | Truth 5 |

No orphaned requirements: REQUIREMENTS.md maps exactly these three IDs to Phase 6. Their checkboxes still read Pending. The orchestrator updates them at phase completion, and closes BACKLOG HOOKPAYLOAD-01, HOOKLAUNCH-01, and CHILDSESSIONID-01.

### Anti-Patterns Found

The added lines in `extensions/`, `features/`, and `test/` since `0f231177` hold no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` marker. The `xxx…` server names in `mcp-tool-names.feature` are test data. I found no stub.

### Known items classified

| Item | Classification |
|---|---|
| IN2-01 (the server-name port is unguarded at factory hydrate; the production reader cannot throw today) | Info; recorded as a review residual (8874947c). Not a gap. |
| IN2-02 (the `mcp_server` docs row names only some of the no-server cases) | Info; documentation precision, recorded as a residual. Not a gap. |
| WR-03 (a queued follow-up expansion's context is dropped) | Documented Pi gap (`docs/hooks-compatibility.md`). Not a criterion. |
| WR-01/WR-02 fixes marked "requires human verification" by the fixer | Each has a scenario seen red, then green (`mcp-tool-names.feature:85`, `:109`), and both passed in the gate. Verified. |
| Bash in a child sees the child's own `CLAUDE_CODE_SESSION_ID` while its hooks see the launcher's | Recorded (D-PG6-03), stated on the page as open for a maintainer decision. Not a gap. |
| D-PG6-01, -02, -04, -07, -09, -10, -11, -14, -15, -18, -19, -20 pending maintainer review | Product decisions, implemented as recorded. Not verification gaps. |

### Human Verification Required

1. **Child prohibition (06-09, judgment tier).**
   - **Test:** Read `translation-context.ts:131-152` and the three tool translators.
   - **Expected:** A child tool hook that names the launching session always carries `agent_id`.
   - **Why human:** Judgment-tier prohibition. The LLM verdict, satisfied, is not authoritative.
2. **Update or reinstall disclosure (06-13, judgment tier).**
   - **Test:** Read the `UserPromptExpansion` bullet in `CHANGELOG.md` and `docs/hooks-compatibility.md:121`.
   - **Expected:** A user learns that a plugin installed earlier needs `update` or `reinstall` before its expansion hooks run.
   - **Why human:** Judgment-tier prohibition. The LLM verdict, satisfied, is not authoritative.

### Gaps Summary

None. The goal is achieved in code and proven by whole-payload scenarios. The status is `human_needed` only because the two judgment-tier prohibitions need a human to confirm them.

---

_Verified: 2026-11-15T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
