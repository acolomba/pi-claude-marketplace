---
phase: 89-documentation-reconcile
plan: 02
subsystem: docs
tags: [hooks, stop, stopfailure, compatibility, install-time-disposition, matcher, markdown]

# Dependency graph
requires:
  - phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
    provides: shipped Stop/StopFailure promotion (bucket-A admission, agent_settled dispatcher, full Stop decision control, observation-only StopFailure)
  - plan: 89-01
    provides: output-catalog partial-hook example re-pointed off Stop; issue-103 authority doc version + stale-inventory reconciled
provides:
  - "docs/hooks-compatibility.md Stop/StopFailure event rows flipped to supported (✓) with corrected notes"
  - "turn-boundary timing-shift subsection documenting the one irreducible divergence, pointing to issue-103 doc"
  - "StopFailure error-type matcher row (closed 10-value set, exact-match charset) + Stop no-matcher disposition row"
  - "Install-time disposition section rewritten to the three-arm partial-partition model (partially-available per-entry drop; distinct structural-malformed unavailable arm; silent fall-open + silent drop kept)"
  - "all milestone-version (v1.13) framing stripped; version-neutral Pi column headers"
affects: [89-03 (DOC-05 research-doc amend)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep-gated structural doc reconcile: version-strip, glyph flips, matcher tokens, and disposition phrasing each asserted by grep since no test reads the doc (research Test-Coupling Map: NONE)"
    - "mdformat pre-commit normalizes table padding; author edits carry loose padding and let the hook re-align (one restage cycle per commit)"

key-files:
  created:
    - .planning/phases/89-documentation-reconcile/89-02-SUMMARY.md
  modified:
    - docs/hooks-compatibility.md

key-decisions:
  - "Stop no-matcher disposition placed as its own matcher-table row (mirrors SessionEnd reason / SessionStart source rows) rather than an events-row note, keeping the Stop events note short; StopFailure error-type row added to the same table"
  - "stop_hook_active and last_assistant_message surfaced as stdin-payload rows in the stdin/stdout table (payload fields fit the stdin column shape) rather than folded into the Task-1 timing-shift subsection"
  - "Install-time disposition presented as four labeled arms (partial-partition drop, structural unavailable, silent fall-open, silent drop); the structural-malformed arm kept explicitly distinct with its narrowResolverNotes vs narrowUnsupportedKinds source, per Pitfall 2"

requirements-completed: [DOC-04]

coverage:
  - id: A1-A6
    description: "Stop/StopFailure promotion: version-strip (D-89-01), event-row ✗→✓ flips, timing-shift subsection, StopFailure matcher row + Stop no-matcher note (D-89-02)"
    requirement: "DOC-04"
    verification:
      - kind: other
        ref: "grep -Ec 'v1\\.1[0-9]' == 0; oauth_org_not_allowed + max_output_tokens present; 'timing shift' present; issue-103 pointer present; all ten matcher tokens present exactly once (unknown x2: matcher row + 'unknown prefixes')"
        status: pass
      - kind: other
        ref: "human review at /gsd-verify-work against research Stale-Claim Inventory §A rows A1-A6"
        status: pending
    human_judgment: true
    rationale: "Prose quality of the timing-shift subsection and the ✓-not-⚠ rationale is judgment; the plan carries a <human-check>. Structural facts are grep-proven."
  - id: A7-A12
    description: "Install-time disposition rewrite + inline (unavailable){unsupported hooks} reconcile (matcher note A7, tool-name prose A8, http handler A9), additionalContext(Stop) + Stop decision-control/payload rows (A10/A11), three-arm disposition (A12)"
    requirement: "DOC-04"
    verification:
      - kind: other
        ref: "grep -Ec '\\(unavailable\\) \\{unsupported hooks\\}' == 0; '(partially-available)' present (4x); 'malformed' present (3x); 'additionalContext` (Stop)' row present"
        status: pass
      - kind: other
        ref: "human review at /gsd-verify-work: three distinct disposition arms (structural malformed stays (unavailable)); additionalContext(Stop) ✓"
        status: pending
    human_judgment: true
    rationale: "The three-arm distinction (not conflating structural-malformed into partially-available) is the Pitfall-2 correctness check; grep proves the stale phrasing is gone, human review confirms the arms read distinctly."
  - id: A13-A14
    description: "Full-doc audit (D-89-04) of async/lifecycle, env-var, handler-fields, config-surfaces rows against current code"
    requirement: "DOC-04"
    verification:
      - kind: other
        ref: "walked each row against research Ground-Truth Source Map; PermissionRequest still unsupported (not in BUCKET_A_EVENTS); no drift found — audited-and-unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-07-31
status: complete
---

# Phase 89 Plan 02: hooks-compatibility.md reconcile Summary

**Reconciled `docs/hooks-compatibility.md` with shipped v1.16 behavior: `Stop`/`StopFailure` now read supported with a turn-boundary timing-shift subsection and a StopFailure error-type matcher row, the stale hard-trip "Install-time disposition" section is rewritten to the three-arm partial-partition model, and all v1.13 milestone framing is stripped.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 1 (`docs/hooks-compatibility.md`)

## Accomplishments

**Task 1 (A1-A6) — Stop/StopFailure promotion + version-neutral reframe:**
- D-89-01: stripped every `v1.13` string — intro line, sources line, the nine `Pi v1.13` third-column headers (now `Pi`), the deferred-bucket Subagent bullet, and the `if`-field row note ("no `if`-field support in v1.13" → "for these tools"). `grep -Ec 'v1\.1[0-9]'` returns 0.
- A2/A3: `Stop` and `StopFailure` event rows flipped `✗`→`✓` with corrected notes (Stop: full decision control; StopFailure: fires on `error`/`length`, observation-only).
- A4: removed the `Stop` and `StopFailure` bullets from the "Deferred for engineering reasons" bucket; SubagentStart/SubagentStop stay deferred.
- A5: added a **Turn-boundary timing shift** subsection (adapted from issue-103 § "The one irreducible divergence") explaining why the shift is not hook-observable (same payload, `stop_hook_active` cadence, 8-block cap; only an extra transcript turn boundary) and hence `✓` not `⚠`, with a pointer to `docs/research/issue-103-stop-stopfailure-promotion.md`.
- A6: added a `StopFailure error-type matcher` matcher-table row listing exactly the ten closed-set values (`rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown`) with the exact-match charset note; added a `Stop matcher (none upstream)` row noting the reported `no-matcher-support` drop (UserPromptSubmit precedent).

**Task 2 (A7-A14) — disposition rewrite + full-doc audit:**
- A7/A8/A9: reconciled the three inline `(unavailable) {unsupported hooks}` mentions (regex matcher note, tool-name mapping prose, `http` handler row) to the per-entry-drop `(partially-available)` model. `grep -Ec '\(unavailable\) \{unsupported hooks\}'` returns 0.
- A10: added `additionalContext (Stop)` `✓` row (re-enters without a block; STOP-05); narrowed the `additionalContext (other events)` `✗` row and the silent-drop bullet to "other than `SessionStart` and `Stop`".
- A11: annotated the exit-2, `continue: false`, and `decision: "block"` rows for Stop's per-event arms; added `stop_hook_active` and `last_assistant_message` Stop stdin-payload rows.
- A12: **rewrote** the Install-time disposition section from the whole-plugin "Hard install-time trip" into four labeled arms — **Partial-partition drop** (`partially-available`, single aggregate `{unsupported hooks}` brace D-71-04, per-handler `info` breakdown D-71-05), **Structural unavailable** (malformed `hooks.json` → `(unavailable)` via `narrowResolverNotes`, kept distinct per Pitfall 2), and the verified-and-kept **Silent fall-open** / **Silent drop** arms.
- A13/A14: audited async/lifecycle, env-var, handler-fields, and config-surfaces rows against the research Ground-Truth Source Map — no drift (PermissionRequest still unsupported; env/config rows untouched by the promotion). **Audited-and-unchanged.**

## Task Commits

1. **Task 1: Stop/StopFailure promotion, version strip, timing-shift subsection, matcher row** — `ae639fc9`
2. **Task 2: Install-time disposition rewrite, stdin/stdout Stop rows, remaining-row audit** — `77fd1a93`

## Files Modified

- `docs/hooks-compatibility.md` — full-doc reconcile (inventory rows A1-A14). No other file touched.

## Deviations from Plan

None material. Two discretion resolutions worth recording:
- Stop's no-matcher disposition became a dedicated matcher-table row (not an events-row note) to keep the Stop events note short and mirror the table's existing per-event-matcher rows.
- `stop_hook_active` / `last_assistant_message` were added as stdin-payload rows in the stdin/stdout table rather than folded into the Task-1 timing-shift subsection (the subsection was already committed; the table's stdin column is the natural home).

## Verification

- `grep -Ec 'v1\.1[0-9]' docs/hooks-compatibility.md` → 0.
- `grep -Ec '\(unavailable\) \{unsupported hooks\}' docs/hooks-compatibility.md` → 0.
- All ten StopFailure matcher tokens present; `(partially-available)` present; structural `malformed` arm present.
- The doc is read by **no test** (research Test-Coupling Map: grep NONE); the only test-coupled doc (`output-catalog.md`) is untouched by this plan. As a no-regression confirmation the three doc-coupled architecture tests (`catalog-uat`, `hooks-cap-notify`, `partial-vocabulary-guard`) were run: **61 pass, 0 fail**.
- The full `npm run check` was not re-run: this doc has zero byte-test coupling, and plan 01 already documented the only failing suite (`skill-path-resolution` integration) as a pre-existing environmental global-peer drift, unrelated to any markdown edit.
- Human review of prose quality against research Stale-Claim Inventory §A is deferred to `/gsd-verify-work`.

## Known Stubs
None.

## Threat Flags
None — docs-only edit; no new endpoints, auth paths, file access, or schema surface (matches plan `<threat_model>` T-89-03/T-89-04, low/accept).

## User Setup Required
None.

## Next Phase Readiness
- DOC-04 complete: `hooks-compatibility.md` reflects shipped v1.16 Stop/StopFailure behavior and the force-install partial-partition model.
- Plan 03 (DOC-05, `docs/research/claude-hooks-vs-pi-events.md` correct-in-place) can proceed; it is not test-coupled and is independent of this plan's file.

## Self-Check: PASSED

- File verified present: `docs/hooks-compatibility.md`, `89-02-SUMMARY.md`.
- Commits verified in git log: `ae639fc9`, `77fd1a93`.

---
*Phase: 89-documentation-reconcile*
*Completed: 2026-07-31*
