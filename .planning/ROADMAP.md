# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **v1.16 stop-hooks** — Phases 87-89 (in progress, target npm 0.12.0) — promote Claude's `Stop` + `StopFailure` hook events into the supported bucket-A set via one `agent_settled` dispatcher (GitHub issue #103)
- ✅ **v1.15 frontmatter-compliance** — Phase 86 (shipped 2026-07-27, npm 0.11.1) — full detail: `milestones/v1.15-ROADMAP.md`
- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

## Phases

### In progress v1.16 stop-hooks

**Phase Numbering:**

- Integer phases (87, 88, 89): Planned milestone work (continues the global counter
  from Phase 86, the v1.15 frontmatter-compliance phase).

- Decimal phases (87.1, 88.1): Urgent insertions (marked with INSERTED).

- [x] **Phase 87: Bucket-A admission & platform floor** — `BUCKET_A_EVENTS` grows 8→10, the per-event matcher dispositions land (`Stop` takes the `null` no-matcher sentinel; `StopFailure` takes the closed 10-value error-type set), and the `@earendil-works/pi-coding-agent` peer floor rises to `>=0.80.5` — so a plugin declaring `Stop`/`StopFailure` alongside already-supported events resolves available and `ralph-wiggum` + `hookify` flip to fully available, without yet dispatching. (completed 2026-07-30)
- [x] **Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure** — one `agent_settled` subscriber gated on the final assistant message's `stopReason` fires `Stop` on genuine completion (`stop`) and `StopFailure` on `error`/`length`, suppressing both on `aborted`; `Stop` delivers the full hook-observable decision-control contract (block re-entry, exit-2, `additionalContext`, `continue:false` precedence) and loop protections (`stop_hook_active`, 8-block cap), while `StopFailure` is observation-only with the classified error type. (completed 2026-07-30)
- [x] **Phase 89: Documentation reconcile** — `docs/hooks-compatibility.md` flips the `Stop`/`StopFailure` rows to supported (timing-shift caveat + error-type matcher row) and rewrites the stale v1.13 hard-trip install-time disposition section for the force-install partial-partition model; `docs/research/claude-hooks-vs-pi-events.md` retires the "`agent_end` is observation-only" claim and adds `agent_settled`. (completed 2026-07-31)

<details>
<summary>✅ v1.15 frontmatter-compliance (Phase 86) — SHIPPED 2026-07-27</summary>

- [x] Phase 86: Skill and command frontmatter compliance (5/5 plans) — completed 2026-07-26
  The skills and commands bridges parse source frontmatter with Pi's own
  `parseFrontmatter` before rewriting, never stage bytes Pi rejects, degrade a broken
  skill (synthesized `disable-model-invocation` block, body verbatim) or command
  (neutralized, name-from-filename) at Claude-Code parity, fold a skill's `when_to_use`
  into the description Pi actually reads, and surface + classify each failure as a warning —
  while the ~99% of already-valid components stay byte-for-byte unchanged (issue #101).

</details>

<details>
<summary>✅ v1.14 mcp-string-refs (Phase 85) — SHIPPED 2026-07-23</summary>

- [x] Phase 85: `mcpServers` string file-path references (2/2 plans) — completed 2026-07-23
  Resolves a `./`-relative string `mcpServers` (marketplace entry OR `plugin.json`)
  to a wrapped `.mcp.json` inside the plugin root and installs its servers at parity
  with the inline form; a missing / malformed / out-of-root reference isolates that
  one plugin to `(unavailable) {malformed mcp}`, never failing the marketplace load.

</details>

## Phase Details

### Phase 87: Bucket-A admission & platform floor

**Goal**: Make `Stop` and `StopFailure` first-class supported hook events at the resolver/admission layer — the prerequisite plumbing every later phase builds on. `BUCKET_A_EVENTS` grows from 8 to 10, each new event gets its matcher disposition, and the peer floor rises to the version that introduced the fire-point primitive. A plugin whose `hooks.json` declares `Stop` and/or `StopFailure` alongside already-supported bucket-A events resolves available (no `{unsupported hooks}` partition drop for these events) and `plugin info` lists both as supported — even though dispatch is not yet wired (Phase 88). This is a coherent, verifiable admission boundary: the resolver's verdict is the observable outcome.
**Depends on**: Nothing (first phase of this milestone; extends the shipped bucket-A hooks machinery in `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — `BUCKET_A_EVENTS`, `NON_TOOL_EVENT_FIELDS`, `NON_TOOL_EVENT_CLOSED_SETS` — the resolver's `partitionHooks`, and `package.json` `peerDependencies`).
**Requirements**: ADMIT-01, ADMIT-02, FLOOR-01
**Success Criteria** (what must be TRUE):

  1. A plugin whose `hooks.json` declares `Stop` and/or `StopFailure` alongside already-supported bucket-A events resolves **available** — no `{unsupported hooks}` partition drop for these two events — and `plugin info` lists both as supported components; the `ralph-wiggum` (Stop-only) and `hookify` (Stop + bucket-A) fixture manifests flip to fully available (first-party 12/13). (ADMIT-01, ADMIT-02)
  2. `Stop` carries the `NON_TOOL_EVENT_FIELDS` `null` no-matcher sentinel: a non-empty `Stop` matcher is reported as a `no-matcher-support` group drop, never silently ignored (issue #103 acceptance criterion). (ADMIT-01)
  3. `StopFailure` carries the closed 10-value error-type set (`rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown`) through the existing `NON_TOOL_EVENT_CLOSED_SETS` machinery (same shape as the `SessionStart` source matcher, honoring the narrower exact-match charset — letters, digits, `_`, `|`); a matcher outside the vocabulary is reported as a drop, not silently ignored. (ADMIT-01)
  4. The `@earendil-works/pi-coding-agent` peer floor rises `>=0.74.0` → `>=0.80.5` in `package.json` `peerDependencies` (the version that introduced `agent_settled`; the npm registry has no 0.80.4 release — D-87-05; declarative only, doc mentions deliberately omitted per D-87-01/D-87-02); below the floor `Stop` and `StopFailure` stay unsupported rather than degrading. (FLOOR-01)

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 87-01-PLAN.md — Decouple the dispatch key domain (DISPATCHABLE_EVENTS subset, D-87-04) and re-point Stop→Notification unsupported examples; tuple stays 8, suite green (ADMIT-01 prep)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 87-02-PLAN.md — Admission cutover: widen BUCKET_A_EVENTS 8→10 with Stop null-sentinel + StopFailure closed set, lockstep union, dispatch guard, peer floor `>=0.80.5` (ADMIT-01, FLOOR-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 87-03-PLAN.md — Fixture-backed proof: restore hookify Stop arm + add ralph-wiggum fixture; hookify + ralph-wiggum resolve available and `plugin info` lists both (ADMIT-02)

### Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure

**Goal**: Dispatch `Stop` and `StopFailure` at genuine completion with 100% fidelity to the hook-observable contract — the load-bearing engineering of the milestone. One `agent_settled` subscriber owns both events, reading the last assistant message cached from the preceding `agent_end.messages` and gating on its `stopReason`: `stop` → `Stop`, `error`/`length` → `StopFailure`, `aborted` → neither (matching upstream's does-not-run-on-user-interrupt rule), `toolUse` → defensive no-op. `Stop` delivers the complete decision-control contract (block-to-re-enter, exit-code-2, `additionalContext`, `continue:false` precedence) and the upstream loop protections (`stop_hook_active` flag, 8-consecutive-block override cap). `StopFailure` rides the same dispatcher as an observation-only arm — output and exit code ignored, no re-entry, no loop guard. The one documented divergence is the turn-boundary timing shift (Pi re-enters as a new turn), invisible to hook scripts.
**Depends on**: Phase 87 (`Stop`/`StopFailure` must be admitted and the `null`-sentinel + closed-set matcher machinery in place before the dispatcher can wire their payload translators, wire-protocol arms, and event-router subscription; the `>=0.80.5` peer floor guarantees `agent_settled` exists rather than degrading).
**Requirements**: STOP-01, STOP-02, STOP-03, STOP-04, STOP-05, STOP-06, STOP-07, SFAIL-01, SFAIL-02, SFAIL-03
**Success Criteria** (what must be TRUE):

  1. A single `agent_settled` subscriber fires `Stop` exactly once per logical completion — after Pi auto-retry, auto-compaction, and queued-continuation drain — when the final assistant message's `stopReason` is `stop`, and does NOT fire on a user interrupt (`aborted`). The last assistant message is cached from the preceding `agent_end.messages` (last-write-wins across retry/compaction chains) under the bridge's existing epoch/`/reload` hygiene so a stale cell never leaks across reloads. **Verification items** (fixture-test level): `agent_settled` firing (or not) after a user abort mid-tool-call, and whether the final message reliably carries `stopReason: "aborted"` on every interrupt path; settle timing with queued user messages (upstream fires `Stop` per response, settle fires after queue drain — any divergence documented). (STOP-01)
  2. A `Stop` hook receives the standard Claude stdin payload: the shipped bucket-A common fields (`session_id`, `transcript_path`, `cwd`, `hook_event_name`) plus `last_assistant_message` (from the STOP-01 cache) and `stop_hook_active` (from criterion 4); `background_tasks`/`session_crons` are omitted (Pi has no task registry — contract-legal per upstream's registry-reachability condition). (STOP-02)
  3. `Stop` decision control at full hook-observable fidelity: `{"decision":"block","reason":...}` re-enters the agent loop via `pi.sendMessage(..., { deliverAs: "followUp", triggerTurn: true })` with the reason as model-visible, display-suppressed content; a hook exiting code 2 blocks with stderr as the reason (wire-protocol per-event exit-2 arm); `hookSpecificOutput.additionalContext` without a block keeps the conversation going via the same re-entry mechanism (feedback labeling, not block labeling); a top-level `continue: false` takes precedence over any block decision (the bridge does not re-enter). (STOP-03, STOP-04, STOP-05, STOP-06)
  4. Loop protections match upstream: the bridge holds a per-session `stop_hook_active` flag set when it blocks-and-re-enters and cleared on the next genuine `input` event — bridge-injected custom messages do not pass through `input`, so the flag never self-clears — and 8 consecutive blocks trip the override cap with a one-shot notify (superseding PAYL-V2-04's draft cap of 10). **Verification**: a `ralph-wiggum`-shaped canary fixture exercises the blocking path end-to-end including the 8-block cap. (STOP-07)
  5. `StopFailure` fires observation-only at settle on `error` and `length` endings — hook output and exit code ignored, no decision machinery, no re-entry, no loop guard — and its payload carries `error` (the classified type used for matcher filtering: `length` maps deterministically to `max_output_tokens`; `error` endings classify best-effort from Pi's `errorMessage` with `unknown` as the in-vocabulary fallback), optional `error_details`, and `last_assistant_message` = the rendered error text from `errorMessage`. (SFAIL-01, SFAIL-02, SFAIL-03)

**Plans**: 5/5 plans executed
**Wave 1**

- [x] 88-01-PLAN.md — Tracer: dev-tree refresh to pi-coding-agent 0.82.1 + settle dispatcher gate & Stop block re-entry end-to-end (STOP-01, STOP-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 88-02-PLAN.md — Stop decision control: exit-2, additionalContext, aggregate continue:false precedence + Stop stdin envelope (STOP-02, STOP-03, STOP-04, STOP-05, STOP-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 88-03-PLAN.md — Loop protections: stop_hook_active flag, 8-consecutive-block cap, input reset + cap-trip warning seam & catalog entry (STOP-07)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 88-04-PLAN.md — StopFailure observation-only arm + errorMessage classifier into the closed 10-value vocab (SFAIL-01, SFAIL-02, SFAIL-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 88-05-PLAN.md — Live Pi runtime UAT: scripted ralph-wiggum canary + human_needed verification items (STOP-01, STOP-07)

### Phase 89: Documentation reconcile

**Goal**: Bring the hooks documentation into line with the shipped Stop/StopFailure behavior, once the dispatcher contract is final. The compatibility reference flips both events to supported and documents the one irreducible divergence; the stale v1.13 hard-trip disposition section is rewritten for the force-install partial-partition model that issue #103's reproduction shows; and the research inventory retires the naive-table claims the `agent_settled`/`stopReason` design supersedes, with pointers to the authority doc.
**Depends on**: Phase 88 (documentation describes the final shipped behavior — the timing-shift caveat, the StopFailure error-type matcher row, and the partial-partition disposition can only be reconciled once the dispatcher contract is settled). Runs sequentially (non-worktree) per project convention for docs phases that touch shared planning/state files.
**Requirements**: DOC-04, DOC-05
**Success Criteria** (what must be TRUE):

  1. `docs/hooks-compatibility.md` is reconciled with shipped behavior: the `Stop` and `StopFailure` event rows flip to supported with the turn-boundary timing-shift caveat documented, the matcher table gains the `StopFailure` error-type row, and the stale v1.13 hard-trip "Install-time disposition" section is rewritten for the force-install partial-partition model (`(partially-available)` + per-entry drops). (DOC-04)
  2. `docs/research/claude-hooks-vs-pi-events.md` is amended: the naive-table "`agent_end` is observation-only" claim is retired, `agent_settled` is added to the Pi event inventory, and `StopFailure`'s `after_provider_response` synthesis is superseded by the `stopReason` protocol contract — with pointers to `docs/research/issue-103-stop-stopfailure-promotion.md`. (DOC-05)

**Plans**: 3/3 plans executed

Plans:
**Wave 1** *(sequential, non-worktree; all three plans are file-independent)*

- [x] 89-01-PLAN.md — Riders (leads to de-risk the only test-coupled edit): re-point `output-catalog.md` Stop→Notification partial-hook example (D-89-07) + correct the issue-103 doc `0.80.4`→`0.80.5` at all four sites (D-89-06) (DOC-04, DOC-05)
- [x] 89-02-PLAN.md — DOC-04: full-doc reconcile of `hooks-compatibility.md` — Stop/StopFailure rows flip to `✓`, timing-shift subsection, StopFailure error-type matcher row, three-arm install-time disposition rewrite, milestone-version strip (DOC-04)
- [x] 89-03-PLAN.md — DOC-05: correct-in-place amendment of `claude-hooks-vs-pi-events.md` — retire the `agent_end`-observation-only Stop claim, add `agent_settled` inventory row #31, supersede StopFailure's `after_provider_response` synthesis with the `stopReason` contract, add issue-103 pointers (DOC-05)

## Progress

**Execution Order:**
Sequential: 87 → 88 → 89 (each phase depends on the prior)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 87. Bucket-A admission & platform floor | v1.16 | 3/3 | Complete    | 2026-07-30 |
| 88. `agent_settled` dispatcher, Stop contract & StopFailure | v1.16 | 5/5 | Complete    | 2026-07-30 |
| 89. Documentation reconcile | v1.16 | 3/3 | Complete    | 2026-07-31 |
| 86. Skill and command frontmatter compliance | v1.15 | 5/5 | Complete | 2026-07-26 |
| 85. `mcpServers` string file-path references | v1.14 | 2/2 | Complete | 2026-07-23 |
