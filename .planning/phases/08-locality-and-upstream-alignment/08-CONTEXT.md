# Phase 8: Locality and Upstream Alignment - Context

**Added:** 2026-11-03
**Status:** Retroactive. Every change this phase records was already merged
when the phase was added.

## Why this phase exists

The milestone closed on 2026-11-02 with a tech-debt audit. The user then went
through the open decisions and audit warnings one at a time, and the
milestone was reopened for the work that came out of it (2a20d2f). The user
asked for a phase that records that work, so the milestone archive explains
it instead of leaving it only in the dubious-choices log.

The work was decided and done in the main session, not planned through
`/gsd-plan-phase`. The plans in this folder therefore describe what was done
and why. They were not executed from.

## Decisions

| ID | Decision | Where |
| --- | --- | --- |
| D-LOC-01 | A project-scope operation affects only its project; trust comes from Pi alone; the git credential helper is the one exception | PROJECT.md, DC-41, DC-42 |
| D-CF2-13, D-CF2-14, D-CF2-15, D-CF2-16, D-CF3-07 | Reversed by D-LOC-01 (the user-folder provenance ledger and the rules that protected it) | PROJECT.md, DC-41 |
| T-05-34 | Closed as consistent: a project's `CLAUDE_PLUGIN_DATA` stays inside the project | DC-41 item 4 |
| T-05-33 | Hook output is read whole and `onFailure: "block"` follows Claude Code 2.1.316 ("match upstream fully") | DC-42 items 6-10 |
| W6 | Fill a model-read skill only while the text is the skill's own ("fill only unchanged text") | DC-43 |
| W2, W4 | Not defects; guard scenarios added instead of the approved fixes | DC-44 |

## Plans

- 08-01: locality redesign (LOC-01)
- 08-02: hook output matches upstream (LOC-02)
- 08-03: model-read skill fill (LOC-03)
- 08-04: W2 and W4 guard scenarios (LOC-04)

## Not in scope

- The upstream fork branches on `acolomba/pi` and `acolomba/pi-subagents`;
  they wait on the user's review.
- D-CF7-05's live probe; it cannot run in this sandbox.
- Re-verifying Phases 2, 3, 5 and 7 after these changes and re-closing the
  milestone; the parent session does that next.
