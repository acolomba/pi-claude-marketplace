# Stop + StopFailure promotion -- feasibility and design (issue #103)

Verified feasibility analysis for promoting Claude Code's `Stop` and `StopFailure` hook events into the bridge's supported bucket-A set, resolving GitHub issue #103 and retiring the PAYL-V2-04 / PAYL-V2-06 deferrals recorded at v1.13. Supersedes the `Stop` and `StopFailure` rows of the naive mapping table in `claude-hooks-vs-pi-events.md` (see § Stale-doc inventory).

## Executive summary

- **Verdict: promotable.** Both events are implementable at 100% fidelity to the *hook-observable* contract -- every payload field, exit-code semantic, decision-control arm, and loop protection a hook script can depend on -- at the same fidelity bar the eight shipped bucket-A events meet.
- **The fire-point is `agent_settled`, not `agent_end`.** Pi added `agent_settled` in `@earendil-works/pi-coding-agent` 0.80.5 (2026-07-09), after the v1.13 research was written against 0.73.x. It fires exactly once per logical completion -- after auto-retry, auto-compact-and-retry, and queued continuations -- where `agent_end` fires per low-level run and would over-fire relative to Claude's contract. Issue #103 proposes `agent_end`; this doc records why the bridge deviates.
- **One `stopReason` gate drives both events.** Pi's protocol contract (`pi-agent-core`) requires providers to encode failures as a final assistant message with `stopReason` and `errorMessage`. The full `StopReason` set (`stop | length | toolUse | error | aborted`) partitions turn endings exactly as upstream does: `stop` → Stop, `error` → StopFailure, `length` → StopFailure with the deterministic `max_output_tokens` error type, `aborted` → neither (upstream suppresses Stop on user interrupt).
- **StopFailure is the cheap half and shipping it is near-mandatory.** A correct Stop must suppress firing on error endings; without StopFailure those endings become invisible to plugins -- matching neither Claude nor a defensible partial. Upstream declares StopFailure observation-only (output and exit code ignored), so none of Stop's re-entry machinery applies.
- **One irreducible divergence:** upstream folds a blocked stop into the *same* turn; under Pi the agent has settled and re-entry starts a *new* turn. Hook scripts cannot observe the difference (same payload, flag cadence, and cap); the transcript shows an extra turn boundary. Erasing it would need an upstream Pi change (a cancelable settle or a continue-directive event return).
- **Cost:** peer floor bump `>=0.74.0` → `>=0.80.5` (the upstream CHANGELOG attributes `agent_settled` to a patch the npm registry never released -- 0.80.3 → 0.80.5 -- and the typings first ship in 0.80.5, so `>=0.80.5` is the correct installable floor).
- **Marketplace effect:** `ralph-wiggum` (Stop-only) and `hookify` (Stop + bucket-A) flip to fully available; `security-guidance` remains partial on its unmapped `MultiEdit`/`NotebookEdit` matchers (PROM-01). First-party: 12/13 fully available. No first-party plugin uses StopFailure -- its value is contract completeness for third parties.

## Authoritative sources

| Use                                  | Source                                                                                            | Verified   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------- |
| Upstream Stop / StopFailure contract | <https://code.claude.com/docs/en/hooks> (hooks.md render)                                         | 2026-07-28 |
| Pi event surface + re-entry API      | `@earendil-works/pi-coding-agent` 0.82.1 `dist/core/extensions/types.d.ts` + `docs/extensions.md` | 2026-07-28 |
| `agent_settled` introduction         | `@earendil-works/pi-coding-agent` CHANGELOG -- 0.80.5 (2026-07-09)                                | 2026-07-28 |
| `StopReason` / `errorMessage` shapes | `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai` bundled `types.d.ts`                    | 2026-07-28 |
| Prior art                            | `@hsingjui/pi-hooks` 0.0.2 tarball (npm)                                                          | 2026-07-28 |
| Demand + proposed mapping            | GitHub issue #103 (fank, 2026-07-28)                                                              | 2026-07-28 |

## Issue #103 assessment

Every factual claim in the issue verified against the code and packages: the P1 `{kind: "event"}` drop path in `partitionHooks`, the `(partially-available) {unsupported hooks}` resolution, `AgentEndEvent.messages`, the `sendMessage(..., { deliverAs: "followUp", triggerTurn: true })` re-entry surface, and the `@hsingjui/pi-hooks` prior art all check out. The issue independently converges on the design v1.13 recorded as PAYL-V2-04 -- expected, since Pi's API affords essentially one mechanism.

What the issue adds beyond the v1.13 record: third-party demand evidence (completion-gating hooks in a private team marketplace that currently silently do not run), the requirement that `stop_hook_active` reach the hook's stdin (PAYL-V2-04 specified only bridge-internal safeguards), testable acceptance criteria including matcher reporting and `plugin info` listing, and the composition gap with `@hsingjui/pi-hooks` (settings-only engine; plugin `hooks.json` has no execution path, and hand-copying drifts on update).

Where this design deviates from the issue: the fire-point. The issue argues `agent_end` is closer to Claude's Stop because blocking "is only meaningful while re-entry is still possible." Re-entry from a settled (idle) agent is exactly what `triggerTurn: true` and `sendUserMessage` provide, so nothing about settling forecloses the block -- while `agent_end` genuinely fires on runs Pi is about to auto-retry, which are `StopFailure`-or-nothing moments under Claude's contract, and a block issued there could inject duplicate feedback into a run that was about to continue anyway.

## Pi API surface (verified)

- `AgentEndEvent { type: "agent_end"; messages: AgentMessage[] }` -- fires per low-level run end. Pi "may still auto-retry, auto-compact and retry, or continue with queued follow-up messages" afterwards (0.82.1 docs).
- `AgentSettledEvent { type: "agent_settled" }` -- "fired after an agent run has fully settled and no automatic retry, compaction, or queued continuation will run." Carries no payload; added 0.80.5.
- `StopReason = "stop" | "length" | "toolUse" | "error" | "aborted"`; `AssistantMessage.errorMessage?: string`. Provider protocol contract: failures MUST surface as a final assistant message with `stopReason` `"error"`/`"aborted"` plus `errorMessage` -- a documented contract, not an implementation detail, which retires PAYL-V2-06's "depends on Pi `agent_error` shape stability" caveat.
- `pi.sendMessage(msg, { deliverAs: "followUp", triggerTurn: true })` -- delivery waits for the agent to finish; `triggerTurn` starts an LLM response when idle. `pi.sendUserMessage` always triggers a turn.
- `input` event -- fires only for genuine user input (after extension-command check, before expansion). Bridge-injected custom messages do not pass through it, so it is the clean `stop_hook_active` reset signal.
- Pi's own `examples/extensions/git-merge-and-resolve.ts` uses `agent_end` + `sendUserMessage` for block-to-continue -- the mechanism is upstream-sanctioned.

## Dispatcher design

One `agent_settled` subscriber owning both events:

| Final assistant `stopReason` | Fires                                    | Upstream analog                               |
| ---------------------------- | ---------------------------------------- | --------------------------------------------- |
| `stop`                       | `Stop`                                   | "main agent has finished responding"          |
| `error`                      | `StopFailure` (classified `error` type)  | "turn ends due to an API error"               |
| `length`                     | `StopFailure` with `max_output_tokens`   | documented matcher value; deterministic map   |
| `aborted`                    | neither                                  | Stop "does not run … due to a user interrupt" |
| `toolUse`                    | not expected at settle (defensive no-op) | --                                            |

Because `AgentSettledEvent` carries no payload, the bridge caches the latest `agent_end.messages` (last-write-wins across retry chains yields the final run's messages) and reads it at settle time. The cache follows the bridge's existing epoch/`/reload` hygiene so a stale cell cannot leak across reloads.

### Stop decision control (full upstream contract)

- JSON `{"decision": "block", "reason": ...}` → re-enter via `sendMessage(..., { deliverAs: "followUp", triggerTurn: true })` with the reason as content (model-visible, display-suppressed).
- Exit code 2 → block with stderr as the reason (the non-JSON idiom; the wire-protocol already has per-event exit-2 arms for other events).
- `hookSpecificOutput.additionalContext` without block → conversation continues (same mechanism, feedback labeling).
- `continue: false` → takes precedence over block; the bridge simply does not re-enter.
- `stop_hook_active` -- bridge-held per-session flag: set when the bridge blocks and re-enters, cleared on the next `input` event; serialized into every Stop stdin payload.
- Loop cap: upstream "overrides the hook and ends the turn after 8 consecutive blocks" -- the bridge matches 8 (PAYL-V2-04's draft value of 10 is superseded) with a one-shot notify when the cap trips.
- No matcher upstream: a non-empty `Stop` matcher takes the existing `NON_TOOL_EVENT_FIELDS` `null`-sentinel `no-matcher-support` drop, so it is reported, never silently ignored (issue #103 acceptance criterion).

### Stop payload

Common fields as shipped for bucket-A (`session_id`, `transcript_path`, `cwd`, `hook_event_name`), plus `last_assistant_message` (from the cached messages) and `stop_hook_active`. Upstream's `background_tasks` / `session_crons` are defined as present only "when the task registry is reachable"; Pi has no task registry, so omission sits inside the documented contract. Upstream guidance explicitly steers Stop hooks to `last_assistant_message` over parsing `transcript_path` (the transcript may lag at Stop time), which reduces fidelity pressure on Pi's non-Claude-format session file -- a pre-existing, accepted bucket-A divergence.

### StopFailure arm

Observation-only per upstream ("output and exit code are ignored"): no decision control, no re-entry, no loop guard. Payload: `error` (classified type, used for matcher filtering), optional `error_details`, and `last_assistant_message` carrying the rendered error text (Pi's `errorMessage`). Matcher: upstream's closed 10-value vocabulary -- `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown` -- with the narrower exact-match charset (letters, digits, `_`, `|` only). `unknown` being a documented member gives the classifier an in-vocabulary fallback: `length` maps deterministically to `max_output_tokens`; `error` endings classify best-effort from `errorMessage` (optionally firmed by HTTP status tracked via `after_provider_response`: 429 → `rate_limit`, 401/403 → `authentication_failed`, 5xx → `server_error`/`overloaded`), else `unknown`. The closed set slots into the existing `NON_TOOL_EVENT_CLOSED_SETS` machinery (same shape as the `SessionStart` source matcher).

## The one irreducible divergence

Upstream, a blocked stop folds the continuation into the same turn -- the agent never visibly stopped. Under Pi, by the time the bridge can decide, the agent has settled; re-entry starts a new turn with the reason as its trigger. Hook scripts cannot tell the difference; the LLM receives the reason as context either way; the transcript shows an extra turn boundary. This is the "timing shift" loss mode the v1.13 research documented, unchanged. A small upstream Pi PR (cancelable settle, or a continue directive returned from the event handler) would erase it; worth floating, not load-bearing.

## Prior art: @hsingjui/pi-hooks 0.0.2

Third-party Pi extension (MIT, single maintainer, ~1,700 lines, two releases, dormant since 2026-05) reading Claude-style hooks from Pi `settings.json` and dispatching 9 events including Stop on `agent_end`. It validates the mechanism end-to-end (payload with `last_assistant_message`, `stop_hook_active` flag, `followUp` + `triggerTurn` re-entry) but is **not a fidelity reference** -- seven contract deviations: exit-2 does not block; `additionalContext` without block is dropped; no 8-block cap (livelock with a naive hook); fires on retry-bound/interrupt endings; 60 s default timeout (upstream 600 s); first block short-circuits remaining hooks and `continue: false` unhandled in the Stop path; payload gaps (`permission_mode`, `background_tasks`, `session_crons`, Pi-format transcript, stale `stop_hook_active` after interrupt). It is also the wrong integration seam for the bridge (competing engine on a config surface NFR-10 forbids writing; no `pi.events` or programmatic API; would double-dispatch alongside the bridge) -- leverage rejected; cite as mechanism proof only.

## Scope boundaries

- **`SubagentStop` / `SubagentStart` stay deferred (PAYL-V2-07).** Conditional on `pi-subagents` wiring; `SubagentStop`'s block contract would require re-entering the subagent's own run, which `pi-subagents` does not expose -- a different fidelity conversation.
- **Remaining bucket-D events unchanged** (`CwdChanged`, `PostToolBatch`, `UserPromptExpansion` -- PAYL-V2-02/03/05): mechanically unrelated to the settle dispatcher.
- **Settings-driven (non-plugin) hooks** remain out of scope, as in v1.13.

## Implementation-time verifications

Flagged as fixture-test items, not assumptions:

1. `agent_settled` firing (or not) after a user abort mid-tool-call, and whether the final assistant message reliably carries `stopReason: "aborted"` on every interrupt path.
2. Settle timing with queued user messages -- upstream fires Stop per response; settle fires after the queue drains. Document any divergence.
3. `sendMessage` custom-message re-entry does not itself fire `input` (the `stop_hook_active` reset must not self-clear).
4. Canary: a `ralph-wiggum`-shaped fixture exercising the blocking path end-to-end, including the 8-block cap.

## Stale-doc inventory (reconciled by this milestone)

- `docs/research/claude-hooks-vs-pi-events.md` -- reconciled (DOC-05): the naive mapping table's `Stop` row (which predated both `sendMessage` re-entry usage and `agent_settled`, and had claimed "Pi's `agent_end` is observation-only; bridge cannot honor `decision: "block"`") and the `StopFailure` row's `after_provider_response` synthesis were corrected in place to the `agent_settled` dispatch and the `stopReason` protocol contract.
- `docs/hooks-compatibility.md` -- reconciled (DOC-04): the `Stop`/`StopFailure` rows now read as supported, and the "Install-time disposition" section was rewritten from the v1.13 hard `(unavailable)` trip to the force-install partial partitioning (`(partially-available)` + per-entry drops) that issue #103's reproduction shows.
