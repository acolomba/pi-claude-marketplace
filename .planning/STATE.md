---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: stop-hooks
status: Awaiting next milestone
stopped_at: Completed 89-03-PLAN.md
last_updated: "2026-07-31T12:49:26.242Z"
last_activity: 2026-07-31
last_activity_desc: Milestone v1.16 completed and archived
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 100
current_phase: 89
current_phase_name: Documentation reconcile
---

# Project State

## Current Position

Phase: Milestone v1.16 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-31 — Milestone v1.16 completed and archived

## Roadmap Summary

- 3 phases (Phases 87-89), continuing the global counter from Phase 86 (v1.15
  frontmatter-compliance). Executed sequentially: 87 → 88 → 89 (each depends on the
  prior). All 15 requirements mapped, no orphans.

- **Phase 87 — Bucket-A admission & platform floor** (ADMIT-01, ADMIT-02, FLOOR-01):
  the prerequisite plumbing. `BUCKET_A_EVENTS` grows 8→10 in
  `domain/components/hook-events.ts`; `Stop` takes the `NON_TOOL_EVENT_FIELDS` `null`
  no-matcher sentinel (a non-empty matcher is reported as a `no-matcher-support` group
  drop, not silently ignored); `StopFailure` takes the closed 10-value error-type set
  through `NON_TOOL_EVENT_CLOSED_SETS` (same shape as the `SessionStart` source
  matcher, narrower charset). The resolver then admits plugins declaring these events
  (`ralph-wiggum` + `hookify` flip to fully available; `plugin info` lists both). Peer
  floor bumps `>=0.74.0` → `>=0.80.4` (the version that introduced `agent_settled`).
  This is a coherent admission boundary — the resolver verdict is observable — even
  though dispatch is deferred to Phase 88.

- **Phase 88 — `agent_settled` dispatcher, Stop contract & StopFailure** (STOP-01..07,
  SFAIL-01..03): the load-bearing engineering. One `agent_settled` subscriber owns both
  events, reading the last assistant message cached from the preceding
  `agent_end.messages` and gating on `stopReason` (`stop` → Stop, `error`/`length` →
  StopFailure, `aborted` → neither, `toolUse` → defensive no-op). Stop delivers the full
  decision-control contract (block re-entry via `sendMessage(..., {deliverAs:"followUp",
  triggerTurn:true})`, exit-2, `additionalContext`, `continue:false` precedence) and the
  loop protections (`stop_hook_active` flag set on re-entry / cleared on next genuine
  `input`; 8-consecutive-block override cap with one-shot notify — supersedes
  PAYL-V2-04's draft of 10). StopFailure rides the same dispatcher as an observation-only
  arm (output/exit-code ignored; `error` classified within the 10-value vocabulary,
  `length` → `max_output_tokens`). Rationale for combining Stop + StopFailure in one
  phase: they share the single `agent_settled` subscriber and `stopReason` gate, and a
  correct Stop MUST suppress firing on `error`/`length` endings — without StopFailure
  those endings become invisible, matching neither Claude nor a defensible partial.

- **Phase 89 — Documentation reconcile** (DOC-04, DOC-05): docs describe the final
  shipped behavior. `docs/hooks-compatibility.md` flips the Stop/StopFailure rows to
  supported (timing-shift caveat + StopFailure error-type matcher row) and rewrites the
  stale v1.13 hard-trip "Install-time disposition" section for the force-install
  partial-partition model. `docs/research/claude-hooks-vs-pi-events.md` retires the
  naive-table "`agent_end` is observation-only" claim, adds `agent_settled`, and
  supersedes StopFailure's `after_provider_response` synthesis with the `stopReason`
  protocol contract. Runs sequentially (non-worktree) per project convention for docs
  phases touching shared planning/state files.

- **Implementation-time verifications** (from
  `docs/research/issue-103-stop-stopfailure-promotion.md`, land as fixture tests in
  Phase 88): (1) `agent_settled` firing after a user abort mid-tool-call and whether the
  final message reliably carries `stopReason: "aborted"`; (2) settle timing with queued
  user messages (upstream fires Stop per response; settle fires after queue drain —
  document any divergence); (3) `sendMessage` custom-message re-entry does not itself
  fire `input` (the `stop_hook_active` reset must not self-clear); (4) a
  `ralph-wiggum`-shaped canary exercising the blocking path end-to-end incl. the 8-block
  cap.

- **The one irreducible divergence** (documented, not fixed): upstream folds a blocked
  stop into the same turn; under Pi the agent has settled and re-entry starts a new turn.
  Invisible to hook scripts (same payload, flag cadence, cap); the transcript shows an
  extra turn boundary. Erasing it needs an upstream Pi change (tracked as UPSTREAM-SETTLE
  in v2).

## Session

**Last session:** 2026-07-31T10:53:31.608Z
**Stopped at:** Completed 89-03-PLAN.md
**Resume file:** None

No plans executed yet for v1.16.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 87 P01 | 40min | 2 tasks | 12 files |
| Phase 87 P02 | 21min | 2 tasks | 11 files |
| Phase 87 P03 | 35min | 2 tasks | 5 files |

## Decisions

Design decisions are pre-captured in the Roadmap Summary above and in
`docs/research/issue-103-stop-stopfailure-promotion.md`. Plan-phase and execution will
record per-plan decisions here.

- [Roadmap]: Fire-point is `agent_settled` (added in `@earendil-works/pi-coding-agent`
  0.80.4), NOT `agent_end` — `agent_end` over-fires on runs Pi is about to auto-retry,
  which are StopFailure-or-nothing moments under Claude's contract (deviates from issue
  #103's `agent_end` proposal).

- [Roadmap]: Stop + StopFailure combined in Phase 88 (one dispatcher, one `stopReason`
  gate); admission/floor split into Phase 87 as the prerequisite; docs isolated in
  Phase 89 to reconcile against final behavior.

- [Phase 87]: 87-01: DISPATCHABLE_EVENTS subset decouples dispatch/rewake/translator tables from the BUCKET_A_EVENTS admission tuple (D-87-04); tuple stays 8, admission ships in Plan 02
- [Phase 87]: 87-01: Stop -> Notification for the canonical unsupported-event example across the suite (D-87-06); hookify wire-byte provenance left on Stop (restored in the admission plan, D-87-03)
- [Phase 87]: 87-02: BUCKET_A_EVENTS grows 8->10 (Stop null-sentinel + StopFailure closed 10-value error-type set); ClaudeHookEvent widened in lockstep (ADMIT-01)
- [Phase 87]: 87-02: dispatch.ts adaptForEvent/entryFires/compositeHandlerFor re-keyed to DispatchableEvent (Rule-3 blocking fix from the widen; D-87-04 decoupling, no behavior change)
- [Phase 87]: 87-02: peer floor @earendil-works/pi-coding-agent >=0.80.5 declarative only (FLOOR-01, D-87-01, D-87-05)
- [Phase 87]: 87-03: hookify Stop arm restored + ralph-wiggum (real ralph-loop wire bytes) fixture added; both flip to available with Stop bare-supported, ADMIT-02 proven offline (D-87-03)
- [Phase 88]: 88-01: settle dispatcher tracer - agent_end caches last-assistant, agent_settled gates on stopReason; stop -> Stop bucket -> block -> sendMessage(followUp+triggerTurn) re-entry (STOP-01, STOP-03)
- [Phase 88]: 88-01: pi-ai/pi-agent-core nested & not top-level resolvable - StopReason/AssistantMessage/AgentMessage derived structurally from AgentEndEvent.messages, pi-api.ts stays sole import site
- [Phase 88]: 88-01: DISPATCHABLE_EVENTS folded to 10 (Stop/StopFailure gain translators); subset type + isDispatchableEvent belt retained per D-87-04
- [Phase ?]: STOP-06 aggregate precedence realized via collectBucketOutcomes (no-short-circuit bucket walk); asyncRewake-on-Stop degraded to noop+log, not sync-bypassed
- [Phase ?]: 88-03: STOP-07 loop protections -- stop_hook_active (cleared only on genuine input), 8-consecutive-block cap with one-shot warning, D-88-06 reset-on-any-non-block; cap notify via shared/notify.ts seam (cap literal 8 kept out of bridge layer)
- [Phase ?]: 88-03: D-88-07 reconciled honestly -- cap-trip is a bridge diagnostic, not a NotificationMessage; byte-covered by dedicated hooks-cap-notify.test.ts + Out-of-band catalog entry (catalog-uat skips it), not silently exempted
- [Phase ?]: 88-04: StopFailure observation-only arm (error/length -> reduceBucket, result discarded); never touches sendMessage/stop_hook_active/counter (SFAIL-01)
- [Phase ?]: 88-04: errorMessage-only classifier (D-88-02) into closed 10-value vocab, unknown fallback, length -> max_output_tokens deterministic; membership-pinned to NON_TOOL_EVENT_CLOSED_SETS.StopFailure (SFAIL-02/03)
- [Phase ?]: 88-05: Live Stop UAT proves STOP-01 (agent_settled dispatch) + STOP-03 (block re-entry) on real Pi via spawn/stdin-ignore + --mode json; the 8-block cap loop cannot be driven headlessly (no PTY) and is routed to human_needed.
- [Phase ?]: Phase 89 riders landed: output-catalog Stop->Notification (D-89-07) and issue-103 agent_settled 0.80.4->0.80.5 (D-89-06); DOC-04/DOC-05 deferred to plans 02/03
- [Phase ?]: 89-02: hooks-compatibility.md reconciled to shipped v1.16 (Stop/StopFailure supported, three-arm partial-partition disposition, v1.13 framing stripped) — DOC-04 complete
- [Phase ?]: 89-03: claude-hooks-vs-pi-events.md corrected in place (D-89-05) — Stop/StopFailure cross-mapping rows now agent_settled dispatch + stopReason contract, agent_settled added as Pi inventory row #31 (count 31), feasibility A 8->10 / D 5->3, marketplace Stop->A; DOC-05 pointers to issue-103 at every corrected claim; E/F/G/H + soft-dep audit preserved (Pitfall 3)

## Deferred Items

Items acknowledged and deferred at the v1.14 milestone close on 2026-07-23 and
re-acknowledged unchanged at the v1.16 close on 2026-07-31 (override_closeout,
known verification overrides: 5). None originate from v1.16 stop-hooks. New from
the v1.16 audit (non-blocking): VALIDATION.md left `status: draft` for Phases 88
and 89 — run `/gsd-validate-phase 88` / `89` to reconcile if desired (coverage
itself is verified; see `milestones/v1.16-MILESTONE-AUDIT.md`).

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Release npm 0.12.0 for v1.16: version bump (package.json + lock +
  EXTENSION_VERSION + sonar projectVersion + CHANGELOG), then PR off
  `features/stop-hooks` via /gsd-ship (repo squash-merges; no git tag at GSD
  milestone close per house convention — tags track npm releases)
- Start the next milestone with /gsd-new-milestone

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 88 P01 | 40min | 2 tasks | 12 files |
| Phase 88 P02 | 25min | 2 tasks | 4 files |
| Phase 88 P03 | 40min | 2 tasks | 8 files |
| Phase 88 P04 | 25min | 2 tasks | 3 files |
| Phase 88 P05 | 55min | 2 tasks | 4 files |
| Phase 89 P01 | 20min | 2 tasks | 2 files |
| Phase 89 P02 | ~25min | 2 tasks | 1 files |
| Phase 89 P03 | 20min | 2 tasks | 1 files |

## Deferred Verification

None — Phase 88 human verification completed 2026-07-31 (88-UAT.md, 4/4 passed;
G-88-D1 doc gap fixed inline).
