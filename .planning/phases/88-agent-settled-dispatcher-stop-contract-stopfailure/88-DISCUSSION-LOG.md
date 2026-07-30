# Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 88-agent-settled-dispatcher-stop-contract-stopfailure
**Areas discussed:** Cap-trip notification, StopFailure classification, Verification harness

---

## Todo cross-reference

The same keyword-only match from Phase 87 ("Coverage sweep: test rare failure
arms in update/reinstall/install", score 0.6) resurfaced. Not re-asked —
carried forward as reviewed-not-folded per the Phase 87 decision.

---

## Cap-trip notification (STOP-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Warning | Carried-out-but-short: turn ended (protection worked) but a plugin's block was deliberately suppressed — user should notice possible livelock | ✓ |
| Info | Desired-state-reached framing: loop guard is designed behavior | |
| Error | Not-carried-out framing: the hook's block was refused | |

**User's choice:** Warning (recommended option), with the proposed form
(summary "Stop hook override cap reached." + plugin-naming detail) and a new
byte-stable output-catalog entry + catalog-UAT coverage.

---

## StopFailure classification (SFAIL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| errorMessage only | Substring table + unknown fallback; no new subscription/state | ✓ (after explanation) |
| + HTTP-status firming | after_provider_response subscription + last-status cell to firm vague messages | |
| You decide | Claude picks during planning | |

**User's choice:** First answered "explain this"; after a mechanism-level
explanation (what is classified, how each option works, the staleness hazard
of the firming cell across auto-retries, that firming resurrects the
superseded v1.13 synthesis design, and that no first-party plugin consumes
StopFailure), selected "errorMessage only".

---

## Verification harness

| Option | Description | Selected |
|--------|-------------|----------|
| Mocked-Pi unit tests | Offline event-sequence tests; live canary deferred to milestone UAT | |
| Mocked + live in-phase | Also run a live Pi runtime UAT inside Phase 88 verification | ✓ |
| You decide | Claude picks the harness split | |

**User's choice:** Mocked + live in-phase — the four implementation-time
verifications (abort mid-tool-call, queued-message settle timing,
sendMessage-not-firing-input, ralph-wiggum canary incl. 8-block cap) get
answered against a real Pi >= 0.80.5 during this phase, not deferred.

---

## Claude's Discretion

- Cache-cell placement under existing epoch hygiene.
- stop_hook_active state mechanics; consecutive-counter reset semantics and
  one-shot latch scope.
- Hook timeout inheritance (verify parity with upstream 600s default).
- Exact classifier substring-table entries.
- Re-entry message customType naming (claude-hook-rewake precedent).
- Live-UAT session script shape.

## Deferred Ideas

- Phase 89 doc reconcile (timing-shift caveat, matcher row).
- after_provider_response firming (declined, D-88-02).
- UPSTREAM-SETTLE upstream PR; SubagentStop blocking (PAYL-V2-07).
