---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
verified: 2026-07-31T00:00:00Z
status: passed
score: 10/10 requirement-level truths verified (mocked + partial-live evidence)
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Abort a turn mid-tool-call in an interactive Pi session (tests/live-uat/README.md item 1)."
    expected: "The final assistant message carries `stopReason:\"aborted\"` and NO Stop/StopFailure hook fires on any interrupt path."
    why_human: "Interrupt timing cannot be driven by the headless `pi -p` canary (D-88-03b item 1); this is a runtime observation of Pi's own interrupt lifecycle, not the bridge's dispatch logic."

  - test: "Queue two user messages during an active turn and observe agent_settled/Stop-dispatch cadence (tests/live-uat/README.md item 2)."
    expected: "Exactly one `agent_settled` (and one settle-time Stop dispatch) fires after the queue fully drains, not per-response."
    why_human: "Queue-drain timing is a Pi runtime behavior no mocked `pi` fixture can establish (D-88-03b item 2)."

  - test: "Drive a Stop block re-entry in an interactive session and inspect stop_hook_active across consecutive Stop payloads, then submit a genuine prompt (tests/live-uat/README.md item 3)."
    expected: "stop_hook_active stays true across every bridge-injected re-entry (the injected sendMessage does not fire `input`) and clears only after a genuine user prompt."
    why_human: "This is the load-bearing integration assumption the whole STOP-07 cap design rests on (code review WR-06); the mocked tests exercise the input-reset handler directly but cannot prove Pi routes injected messages away from `input`."

  - test: "Drive the always-block ralph-wiggum canary in an interactive TTY session through 8 consecutive blocks (tests/live-uat/README.md item 4)."
    expected: "The 8th consecutive block is suppressed (no re-entry), the turn ends, and `Stop hook override cap reached.` fires exactly once naming the plugin."
    why_human: "The scripted `stop-canary.mjs` proves only the FIRST re-entry — headless `pi -p`/piped-stdin tears down its non-interactive lifecycle before the loop can reach the cap (confirmed empirically in 88-05; no PTY tooling available). This is also where the judgment-tier transparency prohibition (88-03 P-88-01: a livelocking hook's suppressed block must never be silent) gets its live-session confirmation."
---

# Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure Verification Report

**Phase Goal:** Dispatch `Stop` and `StopFailure` at genuine completion with 100% fidelity to the hook-observable contract — one `agent_settled` subscriber gated on the final assistant message's `stopReason` (stop→Stop, error/length→StopFailure, aborted→neither, toolUse→defensive no-op), full Stop decision-control (block re-entry, exit-2, additionalContext, continue:false precedence), loop protections (stop_hook_active + 8-consecutive-re-entry cap with one-shot warning), observation-only StopFailure with errorMessage-only classification. The one documented divergence is the turn-boundary timing shift.
**Verified:** 2026-07-31
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (by requirement)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | STOP-01: single `agent_settled` subscriber gates on cached `stopReason`; `stop`→Stop, `aborted`/`toolUse`→nothing, `error`/`length`→StopFailure; last-assistant cache is last-write-wins under `capturedEpoch` hygiene | ✓ VERIFIED | `settle.ts:150-193` (`settleHandlerFor`, `agentEndCacheHandler`); `tests/bridges/hooks/settle.test.ts` STOP-01 cases (gate per stopReason, empty-cache no-op, stale-epoch no-op, one-shot cache consumption post-WR-02); live proof `tests/live-uat/README.md` "PASS STOP-01: agent_settled dispatched the Stop bucket end-to-end" on real Pi 0.80.10 |
| 2 | STOP-02: Stop stdin envelope carries exactly `session_id`/`transcript_path`/`cwd`/`hook_event_name`/`last_assistant_message`/`stop_hook_active`; `background_tasks`/`session_crons` absent | ✓ VERIFIED | `payloads/stop.ts`; `tests/bridges/hooks/payloads/stop.test.ts` (4 cases incl. byte-exact JSON, absence assertions via `"key" in out`, lazy-session empty `transcript_path`) |
| 3 | STOP-03: `{decision:"block"}` re-enters via `pi.sendMessage({deliverAs:"followUp", triggerTurn:true, display:false})` with the reason as content | ✓ VERIFIED | `settle.ts` `reenter`/`reenterBounded`; `settle.test.ts` block-arm cases; live proof "PASS STOP-03: block re-entry started a second turn for one prompt" (two `turn_start` events for one prompt) |
| 4 | STOP-04: exit-2 rides the same block arm via `parseHookStdout`, no Stop-specific exit path | ✓ VERIFIED | `settle.test.ts:323` `parseHookStdout(2,"","boom")` fixture, asserts re-entry with `content:"boom"` |
| 5 | STOP-05: `additionalContext`-without-block re-enters via the same lane | ✓ VERIFIED | `settle.ts:266-275`; `settle.test.ts:720` |
| 6 | STOP-06: aggregate `continue:false` precedence — any hook signalling stop suppresses re-entry regardless of order or another hook's block | ✓ VERIFIED | `settle.ts:250-256` (`collectBucketOutcomes` no-short-circuit scan); `settle.test.ts:417,436` both declaration orders |
| 7 | STOP-07: `stop_hook_active` set on re-entry, cleared only on genuine `input`; 8-consecutive-re-entry cap (block AND additionalContext share one counter per D-88-08) trips a one-shot warning; non-re-entry outcome resets | ✓ VERIFIED (mocked); cap live-loop and input-self-clear are human items (see below) | `settle.ts:44-49,332-351` (`STOP_OVERRIDE_CAP`, `reenterBounded`); `settle.test.ts` boundary/adjacency/ordering/precision cases plus the two D-88-08 regression tests (pure-additionalContext loop bounded at 7, block/context alternation shares one cap); `notifyStopHookOverrideCap` byte-locked by `tests/architecture/hooks-cap-notify.test.ts` |
| 8 | SFAIL-01: `error`/`length` run the StopFailure bucket observation-only — result discarded, no re-entry, no loop-state mutation, every observer runs (no short-circuit) | ✓ VERIFIED | `settle.ts:293-315` (`runStopFailure` via `collectBucketOutcomes`, post-WR-01 fix); `settle.test.ts` SFAIL-01 cases incl. "every StopFailure observer runs even after a leading block" |
| 9 | SFAIL-02: StopFailure envelope carries `error`/optional `error_details`/`last_assistant_message` (verbatim errorMessage) | ✓ VERIFIED | `payloads/stop-failure.ts:37-47`; `tests/bridges/hooks/payloads/stop-failure.test.ts` envelope cases |
| 10 | SFAIL-03: errorMessage-only classifier into the closed 10-value vocab, `unknown` fallback, `length`→`max_output_tokens` deterministic, case-insensitive, numeric matches word-boundary-bounded (post-WR-03 fix) | ✓ VERIFIED | `payloads/stop-failure.ts:66-120` (`CLASSIFIER_TABLE`); `stop-failure.test.ts` 21 fixtures incl. the three WR-03 regression cases ("retry after 5000ms"→unknown, "request 4290 failed"→unknown, "consumed 4013 tokens"→unknown) + closed-vocab membership assertion on every fixture |

**Score:** 10/10 requirement-level truths verified. `behavior_unverified: 0` (every state-transition/loop-protection truth has a passing unit test exercising the actual transition, not just presence). Four items remain genuinely unscriptable and are routed to human verification below — this is the phase's own by-design outcome (D-88-03), not a gap.

### Code Review Findings — Fix Verification

`88-REVIEW.md` (standard depth, 20 files) found 1 critical + 6 warnings. `88-REVIEW-FIX.md` claims 6 fixed, 1 no-change-needed (WR-06, deferred to human UAT by design), 2 info-tier out of scope. Verified directly against the current codebase (not the SUMMARY claim):

| Finding | Claimed fix | Verified |
|---|---|---|
| CR-01 (loop-cap bypass via `additionalContext`) | `reenterBounded` shared by block+additionalContext lanes (D-88-08) | ✓ Confirmed in `settle.ts:332-351`; two new regression tests present and passing (`settle.test.ts:762,793`) |
| WR-01 (StopFailure starves later observers) | `runStopFailure` now uses `collectBucketOutcomes` (no short-circuit) | ✓ Confirmed `settle.ts:293-315`; regression test passing |
| WR-02 (stale double-settle) | Cache cleared on read (one-shot) | ✓ Confirmed `settle.ts:169-173`; regression test `settle.test.ts:260` passing |
| WR-03 (bare-digit classifier aliasing) | Word-boundary RegExp for numeric codes | ✓ Confirmed `stop-failure.ts:78-94`; 3 regression fixtures passing |
| WR-04 (research-anchor comments) | `(A2)`/`(research A5)`/`Pitfall` tokens removed | ✓ Confirmed via repo grep — zero matches in touched files |
| WR-05 (`stop_hook_active` not set on additionalContext lane) | Folded into `reenterBounded`, sets the flag on both lanes | ✓ Confirmed `settle.ts:349` (single call site for both lanes) |
| WR-06 (unverified input-routing assumption) | No code change; routed to live-UAT `human_needed` item 3 | ✓ Confirmed — this is exactly the framework's expected honest-abstention behavior, not a gap |

All 5 fix commits (`432dda24`, `cc01c7c4`, `2d055a3a`, `673c949a`, `3532a40e`) present in git history and their diffs match the claimed changes.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `bridges/hooks/settle.ts` | Full settle dispatcher (gate, Stop adapter, StopFailure arm, loop protections) | ✓ VERIFIED | 392 lines; all exports present (`settleHandlerFor`, `agentEndCacheHandler`, `resetSettleState`, `inputResetHandlerFor`, test inspectors) |
| `bridges/hooks/payloads/stop.ts` | Stop stdin translator | ✓ VERIFIED | Final 6-field shape, byte-pinned |
| `bridges/hooks/payloads/stop-failure.ts` | StopFailure translator + classifier | ✓ VERIFIED | `translate` + `classifyStopFailure` + `CLASSIFIER_TABLE` |
| `platform/pi-api.ts` re-exports | `AgentEndEvent`, `AgentSettledEvent`, `StopReason`, `AssistantMessage`, `AgentMessage` | ✓ VERIFIED | All 5 present; structurally derived from `AgentEndEvent.messages` (documented deviation from the plan's "re-export from entrypoint" instruction, justified — nested pi-ai/pi-agent-core are not top-level resolvable) |
| `shared/notify.ts` cap-trip seam | `notifyStopHookOverrideCap` | ✓ VERIFIED | Warning severity, single `ctx.ui.notify` call, byte-locked against `docs/output-catalog.md` |
| `docs/output-catalog.md` cap-trip entry | Byte-stable fenced block | ✓ VERIFIED | `stop-override-cap` marker present; byte-equality proven by `tests/architecture/hooks-cap-notify.test.ts` (passing) |
| `tests/live-uat/stop-canary.mjs` + `README.md` | Live UAT harness + human checklist | ✓ VERIFIED | Present; harness honestly exits non-zero and routes the unscriptable half to human_needed rather than faking a pass |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `agent_end.messages` | settle cache cell | `agentEndCacheHandler` | ✓ WIRED | Last-write-wins, epoch-guarded |
| settle cache | `settleHandlerFor` gate | direct read, one-shot clear | ✓ WIRED | Post-WR-02 fix |
| `DISPATCHABLE_EVENTS` widen | `TRANSLATORS` + `REQUIRED_EVENT_FIELDS` (dispatch-exec.ts, async-rewake/registry.ts) | `as const satisfies` compile force | ✓ WIRED | `DISPATCHABLE_EVENTS.length === 10` confirmed |
| Stop bucket reduced outcome | re-entry decision | `collectBucketOutcomes` scan (stop→block→mutate→noop) | ✓ WIRED | Aggregate precedence tests both orders |
| block/additionalContext re-entry | STOP-07 cap counter | `reenterBounded` (D-88-08 shared path) | ✓ WIRED | Post-CR-01 fix; regression tests present |
| cap-trip state | `ctx.ui.notify` | `notifyStopHookOverrideCap` (settle determines, notify renders) | ✓ WIRED | Matches "notify is a dumb renderer" convention |
| `pi.on("input")` | `stopHookActive`/counter reset | `inputResetHandlerFor` dedicated subscription | ✓ WIRED (mocked); Pi's actual `input`-routing behavior for injected `sendMessage` is the human item 3 above | DISP-01 pin at 11 calls / 10 distinct names confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| STOP-01 | 88-01, 88-05 | agent_settled gate | ✓ SATISFIED | See truth #1 |
| STOP-02 | 88-02 | Stop stdin envelope | ✓ SATISFIED | See truth #2 |
| STOP-03 | 88-01, 88-02 | Block re-entry | ✓ SATISFIED | See truth #3 |
| STOP-04 | 88-02 | Exit-2 | ✓ SATISFIED | See truth #4 |
| STOP-05 | 88-02 | additionalContext re-entry | ✓ SATISFIED | See truth #5 |
| STOP-06 | 88-02 | continue:false precedence | ✓ SATISFIED | See truth #6 |
| STOP-07 | 88-03, 88-05 | Loop protections | ✓ SATISFIED (mocked) / human items open | See truth #7 |
| SFAIL-01 | 88-04 | Observation-only dispatch | ✓ SATISFIED | See truth #8 |
| SFAIL-02 | 88-04 | StopFailure envelope | ✓ SATISFIED | See truth #9 |
| SFAIL-03 | 88-04 | Classifier | ✓ SATISFIED | See truth #10 |

No orphaned requirements — REQUIREMENTS.md traces all 10 IDs to Phase 88 and all 10 appear in at least one plan's `requirements:` frontmatter. DOC-04/DOC-05 (documentation reconcile) correctly belong to Phase 89 and are out of this phase's scope.

### Anti-Patterns Found

None in the phase's touched files. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all 10 touched source files returns zero matches. No hardcoded-empty stub patterns. `88-REVIEW.md`'s WR-04 (research-artifact comment anchors) was the only comment-policy finding and is confirmed fixed (zero matches for `(A2)`/`(research A5)`/`Pitfall` in the touched files after `3532a40e`).

### Automated Verification Run (this session, not SUMMARY-reported)

- `npm run typecheck` — green.
- `npx eslint <all 5 touched source files>` — clean, zero output.
- `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/payloads/stop.test.ts tests/bridges/hooks/payloads/stop-failure.test.ts tests/architecture/hooks-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/notify-grammar-invariant.test.ts tests/architecture/catalog-uat.test.ts tests/shared/index-smoke.test.ts` — 85/85 pass.
- `npm test` (full unit suite) — 3144 pass, 0 fail, 1 skip (pre-existing).
- `npm run test:integration` — 16/18 pass; the 2 failures are `tests/integration/provenance-invisibility.test.ts` and `tests/integration/skill-path-resolution.test.ts`, exactly the documented pre-existing pi-subagents GLOBAL-npm-root environment condition (not a phase regression — confirmed by test name match against the known issue).
- `node -e 'require("@earendil-works/pi-coding-agent/package.json")'` version — `0.82.1`, matching D-88-04's dev-tree-refresh requirement.

### Human Verification Required

Per D-88-03 (recorded in `88-CONTEXT.md`), the live-UAT plan (88-05) deliberately routes four runtime-timing/interrupt questions to human verification because a headless `pi -p` drive cannot sustain them. This is the phase's own by-design outcome, not an unresolved gap — the mocked settle tests (88-01..04) exhaustively prove the dispatcher logic offline, and 88-05 already proved two of the four D-88-03b items live (STOP-01 dispatch fires, STOP-03 block re-entry starts a new turn) on real Pi 0.80.10. The remaining four items (see frontmatter `human_verification` above) are:

1. **Abort mid-tool-call** (STOP-01) — does `agent_settled` correctly suppress on every interrupt path with `stopReason:"aborted"`.
2. **Queued-message settle timing** (STOP-01) — does `agent_settled` fire exactly once after queue-drain, not per-response.
3. **`sendMessage` re-entry does not self-clear `stop_hook_active`** (STOP-07) — the load-bearing integration assumption behind the entire loop-protection design (code review WR-06); mocked tests exercise the reset handler directly but cannot prove Pi routes injected messages away from `input`.
4. **The 8-consecutive-block cap in a live interactive loop** (STOP-07) — the scripted canary proves only the first re-entry (headless `pi` tears down before the loop reaches 8); this also carries the transparency prohibition from 88-03 (P-88-01: a livelocking hook's suppressed block must never be silent) to its live-session confirmation.

Each item has exact repro steps, expected result, and failure signature already documented in `tests/live-uat/README.md`.

### Gaps Summary

No gaps. All 10 requirement-level truths are backed by real, passing, non-trivial tests exercising the actual state transitions (not just symbol presence), and the one critical + five warning code-review findings were genuinely fixed with verifiable regression tests, not just claimed. The phase's own design correctly anticipated that four runtime-timing questions cannot be scripted and routed them to human verification with a well-specified checklist rather than silently passing or faking a live result — that is the expected, correct outcome for this phase (confirmed by the orchestrator's own verification notes), not a deficiency to remediate before proceeding.

One minor observation (not a gap, not blocking): the `docs/output-catalog.md` cap-trip entry's prose paragraph still cites "D-88-06" for the counter-reset rationale without mentioning D-88-08's supersession (the counter is now shared across block AND additionalContext re-entry lanes, not just blocks). The byte-locked fenced block itself (the actual notify output) is unaffected and correctly tested; only the surrounding explanatory prose is slightly stale. Phase 89 (documentation reconcile) is the natural place to true this up alongside DOC-04/DOC-05.

---

*Verified: 2026-07-31*
*Verifier: Claude (gsd-verifier)*
