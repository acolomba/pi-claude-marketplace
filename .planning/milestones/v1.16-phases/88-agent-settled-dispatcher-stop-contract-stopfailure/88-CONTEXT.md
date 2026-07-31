# Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Dispatch `Stop` and `StopFailure` at genuine completion with 100% fidelity to
the hook-observable contract. One `agent_settled` subscriber owns both events,
reading the last assistant message cached from the preceding
`agent_end.messages` and gating on its `stopReason`: `stop` → `Stop`,
`error`/`length` → `StopFailure`, `aborted` → neither, `toolUse` → defensive
no-op. `Stop` delivers the complete decision-control contract
(block-to-re-enter, exit-code-2, `additionalContext`, `continue:false`
precedence) and the upstream loop protections (`stop_hook_active` flag,
8-consecutive-block override cap with one-shot notify). `StopFailure` rides
the same dispatcher as an observation-only arm.

Requirements: STOP-01..07, SFAIL-01..03.

</domain>

<decisions>
## Implementation Decisions

### Cap-trip notification (STOP-07)
- **D-88-01:** The one-shot override-cap notification is **warning severity**
  (tri-state model: the turn ended — the protection worked — but a plugin's
  block desire was deliberately suppressed; the user should notice their hook
  may be livelocking). Form: non-empty summary first line on the `Warning:`
  label (e.g. "Stop hook override cap reached.") with detail naming the
  plugin and stating 8 consecutive blocks / turn ended despite an active
  block; exact wording finalized during planning within the established
  notify grammar. Ships with a **new byte-stable `docs/output-catalog.md`
  entry + catalog-UAT coverage** per house convention (IL-2: through
  `ctx.ui.notify`; summary-line grammar per the notify-grammar invariant).

### StopFailure classification (SFAIL-03)
- **D-88-02:** Classification is **errorMessage-only** — a substring/regex
  table over Pi's rendered `errorMessage` mapping into the 10-value
  vocabulary, with `unknown` as the in-vocabulary fallback; `length` maps
  deterministically to `max_output_tokens`. Do NOT subscribe to
  `after_provider_response`, do NOT hold an HTTP-status cell — the firming
  variant was explicitly declined (staleness hazard across auto-retries, new
  subscription, resurrects the superseded v1.13 synthesis design; no known
  consumer needs the accuracy — no first-party plugin uses StopFailure).

### Verification harness
- **D-88-03:** **Both** mocked and live verification in-phase:
  (a) mocked-Pi event-sequence unit tests through the router/dispatcher with
  a fake `pi` (offline, deterministic, in `npm run check`) covering the
  dispatcher gate, decision-control arms, loop protections, and classifier;
  (b) a **live Pi runtime UAT inside Phase 88 verification** answering the
  four implementation-time questions against a real Pi >= 0.80.5: (1)
  `agent_settled` firing after a user abort mid-tool-call and whether the
  final message reliably carries `stopReason: "aborted"`; (2) settle timing
  with queued user messages (upstream fires Stop per response; settle fires
  after queue drain — document any divergence); (3) `sendMessage`
  custom-message re-entry does NOT itself fire `input` (the
  `stop_hook_active` reset must not self-clear); (4) a ralph-wiggum-shaped
  canary exercising the blocking path end-to-end including the 8-block cap.
  The live UAT is expected to surface as human_needed verification items if
  it cannot run fully scripted.

### Research-surfaced planner directives (within already-locked envelopes)
- **D-88-04:** **Dev-tree refresh is the first task.** node_modules has
  pi-coding-agent 0.79.10 (predates `agent_settled`; missing nested
  pi-agent-core/pi-ai); the lockfile already resolves 0.82.1. `npm install`
  (materializing the locked 0.82.1) must precede any code referencing the new
  typings. Commit any lockfile normalization drift rather than reverting it
  (house precedent). The two env-flaky integration tests resolve the peer
  from the GLOBAL npm root and are unaffected by the local refresh.
- **D-88-05:** **STOP-06 precedence is aggregate:** if ANY Stop hook in the
  group returns top-level `continue: false`, the bridge does not re-enter —
  regardless of any other hook's block decision (matches the requirement
  text literally; not first-encountered-wins).
- **D-88-06:** **Consecutive-block counter semantics:** only a block outcome
  increments the counter; any non-block outcome (including
  `additionalContext`-without-block and plain allow) RESETS it — upstream
  counts 8 *consecutive* blocks. The one-shot cap notify latch is
  per-session and re-arms with the counter reset.
- **D-88-07:** The cap-trip warning must satisfy the existing
  notify-grammar invariant (summary line on the `Warning:` label) rather
  than carving it out — if the planner finds a genuine structural conflict
  with `shared/notify.ts`'s closed grammar, surface it in the plan instead
  of silently exempting.

### Post-review decision (code review CR-01)
- **D-88-08:** **The override cap counts ALL bridge re-entries** — block AND
  `additionalContext` continuations share one consecutive-re-entry counter
  (cap 8, same one-shot warning latch). Safer than upstream's literal
  blocks-only wording in the one corner upstream leaves unprotected
  (pure-`additionalContext` livelock); hook-invisible until it trips.
  `stop_hook_active` is set on BOTH re-entry lanes (a context continuation
  is "continuing as a result of a stop hook"). Supersedes D-88-06's
  reset-on-any-non-block for the `additionalContext` case: a context
  re-entry increments rather than resets; only a plain-allow/no-re-entry
  outcome resets the counter and re-arms the latch.

### Claude's Discretion
- Cache-cell placement for the last assistant message under the bridge's
  existing epoch/`/reload` hygiene (stale cell must never leak across
  reloads; last-write-wins across auto-retry/compaction chains).
- `stop_hook_active` state mechanics (per-session flag; set on
  block-re-entry, cleared on the next genuine `input` event — bridge-injected
  custom messages do not pass through `input`).
- Hook timeout: Stop/StopFailure inherit the existing executor timeout
  convention (upstream default 600s) — verify parity during research; no
  bespoke timeout.
- Exact substring-table entries for the classifier (offline-testable with
  fixture strings; keep the table small and evidence-based on real Pi
  errorMessage forms).
- Re-entry message `customType` naming (precedent: `claude-hook-rewake` with
  `display: false`; content model-visible, display-suppressed per STOP-03).
- Live-UAT session script shape (how the canary plugin + abort/queue
  scenarios are driven).
- Consecutive-block counter reset semantics within the cap (upstream:
  8 *consecutive* blocks — a non-block outcome resets the count) and the
  one-shot latch scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authority analysis (issue #103)
- `docs/research/issue-103-stop-stopfailure-promotion.md` — THE design
  authority: § Dispatcher design (stopReason table, decision control, Stop
  payload, StopFailure arm), § Pi API surface (AgentEndEvent/
  AgentSettledEvent/StopReason/sendMessage/input semantics),
  § Implementation-time verifications (the 4 items D-88-03 wires into the
  live UAT), § Prior art (pi-hooks seven contract deviations — mechanism
  reference only).
- `.planning/REQUIREMENTS.md` — STOP-01..07, SFAIL-01..03 (Phase 88 rows).
- `.planning/phases/87-bucket-a-admission-platform-floor/87-CONTEXT.md` —
  prior-phase locked decisions (D-87-01..06), esp. D-87-04 (dispatch key
  domain decoupled via `DISPATCHABLE_EVENTS` — Phase 88 folds Stop/StopFailure
  INTO the dispatchable domain by extending that subset + adding translators).

### Upstream contract
- <https://code.claude.com/docs/en/hooks> — Stop/StopFailure contract
  (verified 2026-07-28): stop_hook_active stdin flag, 8-block override cap,
  exit-2 semantics, continue:false precedence, observation-only StopFailure.

### House output conventions (for D-88-01)
- `docs/output-catalog.md` — byte-form catalog the new cap-trip warning
  entry joins.
- `docs/messaging-style-guide.md` — notify grammar the summary line must
  satisfy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/hooks/event-router.ts` — routing tables already pre-seed
  Stop/StopFailure buckets; `registerEventRouter` registers exactly 8 `pi.on`
  call sites today (test-pinned count in `hooks-dispatch.test.ts` — the pin
  MUST be updated deliberately when `agent_end` + `agent_settled` +
  (likely) `input` subscriptions are added); `compositeHandlerFor` keyed on
  `Exclude<DispatchableEvent, ...>` per D-87-04.
- `bridges/hooks/dispatch-exec.ts` — `TRANSLATORS` /
  `REQUIRED_EVENT_FIELDS` are `Record<DispatchableEvent, ...>`: extending
  `DISPATCHABLE_EVENTS` to include Stop/StopFailure forces both translator
  entries at compile time (the D-87-04 design paying off);
  `isDispatchableEvent` guards then admit the two events to dispatch.
- `bridges/hooks/wire-protocol.ts` — top-level `continue: false` and
  `decision: "block"` arms plus `hookSpecificOutput.additionalContext`
  handling already exist (lines ~101-155); Stop wires per-event arms into
  this existing machinery; exit-2 per-event arm pattern exists for other
  events.
- `bridges/hooks/payloads/` — per-event payload translator home; Stop and
  StopFailure translators land here.
- `bridges/hooks/async-rewake/registry.ts` — precedent for
  `pi.sendMessage({customType, display:false, content}, {deliverAs, ...})`
  injection and detached lifecycle management.
- `shared/notify.ts` — `ctx.ui.notify` boundary; warning summary-line
  grammar enforced by `tests/architecture/notify-grammar-invariant.test.ts`.

### Established Patterns
- Epoch/`/reload` hygiene: the router carries a `capturedEpoch` guard so
  stale handlers can't fire against rebuilt tables — the agent_end cache
  cell and stop_hook_active flag must ride the same hygiene.
- Notify: commands/dispatchers determine state and stamp severity; notify.ts
  is a dumb renderer — do not probe state at render time.
- The catalog/catalog-UAT byte-equality convention: new user-visible
  messages get a catalog row and UAT coverage in the same phase.
- Comment policy: `.claude/rules/typescript-comments.md` (no phase/milestone
  refs; D-IDs and requirement IDs allowed).

### Integration Points
- `DISPATCHABLE_EVENTS` in `domain/components/hook-events.ts` grows to
  include Stop/StopFailure (folding D-87-04's transitional subset up toward
  the admission tuple) — typecheck then demands the translators.
- New `pi.on("agent_end")` (message cache) + `pi.on("agent_settled")`
  (dispatcher) + `pi.on("input")` (stop_hook_active reset) subscriptions in
  the router registration path — update the pinned subscription-count test
  deliberately.
- `tests/bridges/hooks/` — dispatch/exec suites; new mocked event-sequence
  tests live alongside.

</code_context>

<specifics>
## Specific Ideas

- The stopReason gate table (from the authority doc): `stop` → Stop;
  `error` → StopFailure (classified); `length` → StopFailure with
  deterministic `max_output_tokens`; `aborted` → neither; `toolUse` →
  defensive no-op (not expected at settle).
- Stop stdin payload: bucket-A common fields (`session_id`,
  `transcript_path`, `cwd`, `hook_event_name`) + `last_assistant_message` +
  `stop_hook_active`. `background_tasks`/`session_crons` omitted
  (contract-legal — Pi has no task registry).
- StopFailure payload: `error` (classified type), optional `error_details`,
  `last_assistant_message` = rendered error text from Pi's `errorMessage`.
- The one irreducible divergence (timing shift: re-entry starts a new turn)
  is documented, not fixed — invisible to hook scripts; transcript shows an
  extra turn boundary. Phase 89 documents it; do not attempt to erase it.

</specifics>

<deferred>
## Deferred Ideas

- `docs/hooks-compatibility.md` + `docs/research/claude-hooks-vs-pi-events.md`
  reconcile — Phase 89 (DOC-04, DOC-05), including the timing-shift caveat
  and the StopFailure error-type matcher row.
- `after_provider_response` HTTP-status firming for the classifier —
  explicitly declined for v1.16 (D-88-02); revisit only if a real consumer
  demonstrates misclassification pain.
- UPSTREAM-SETTLE (cancelable settle / continue-directive) — v2, would erase
  the timing shift.
- SubagentStop blocking semantics — PAYL-V2-07, needs pi-subagents
  cooperation.

</deferred>

---

*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Context gathered: 2026-07-30*
