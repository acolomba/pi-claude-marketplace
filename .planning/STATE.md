---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: stop-hooks
current_phase_name: roadmap created — 3 phases, 87-89
status: planning
stopped_at: Phase 87 context gathered
last_updated: "2026-07-30T01:46:39.076Z"
last_activity: 2026-07-29
last_activity_desc: v1.16 roadmap created (Phases 87-89)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: Not started (roadmap created — 3 phases, 87-89)
Plan: —
Status: Roadmap approved; ready to plan Phase 87
Last activity: 2026-07-29 — v1.16 roadmap created (Phases 87-89)

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

**Last session:** 2026-07-30T01:46:39.053Z
**Stopped at:** Phase 87 context gathered
**Resume file:** .planning/phases/87-bucket-a-admission-platform-floor/87-CONTEXT.md

## Performance Metrics

No plans executed yet for v1.16.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

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

## Deferred Items

Items acknowledged and deferred at v1.14 milestone close on 2026-07-23. All are
pre-existing (none from v1.16 stop-hooks).

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Plan the first phase with `/gsd-plan-phase 87`
