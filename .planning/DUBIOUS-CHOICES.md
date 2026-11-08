# behavioral-gaps: Dubious Choices Log

This log lists the choices made without the user during the behavioral-gaps
milestone (started 2026-11-07). The run decided by this project's conventions
and by Claude Code upstream parity, and it did not stop to ask. You and the
user go through this log together when the run ends.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until reviewed with the user.
- **IDs.** `S-NN` is a session-level choice. `P{N}-DC-NN` is a choice of
  phase N.

Each phase keeps its full log. When an entry below is short, its phase log has
the full text:

- `.planning/phases/01-foundation/DUBIOUS-CHOICES.md`
- Each stream phase N keeps `.planning/phases/<its dir>/DUBIOUS-CHOICES.md`,
  which the parent merges in at the phase's merge.

The log of the previous milestone is archived, unchanged, at
`.planning/milestones/mcp-builtin-DUBIOUS-CHOICES.md`.

## Decisions waiting on you

## Session-level choices

- **S-01 (Medium, open). The stream phases ran as background agents of the parent session, not as separate sessions.** The user chose to run all fifteen at once from the parent. A background agent cannot dispatch a subagent in the foreground, and a background subagent stalled when its parent agent handed back, so from the first hours on every phase ran its execution, code review, fixes, and verification inline, following the gsd-* agent definitions, without separate reviewer or verifier agents. Each phase logs it.
- **S-02 (Low, open). The phases shared one scratchpad at first.** Two phases wrote commit-message files of the same name there, and commit `4e3d127c` on the Phase 16 branch carries Phase 13's title. It was not amended (no history rewrites); each phase then moved to `/tmp/claude-1000/bg-phase-N/`.
- **S-03 (Low, open). The agent isolation sentinel is shared.** The dispatch guard reads `.gsd/dispatch-isolation-sentinel.json` from the parent checkout, which the phases overwrote in turn; the phases worked around it with general-purpose agents and then inline work.
- **S-04 (Low, open). A merge reuses the phase gate when the trees match.** When the milestone branch had not moved since a phase branched off, the merged tree equals the phase branch's tree, so the parent cites that phase's full `npm run check` instead of rerunning it (the gates.md reuse rule). Phase 15 merged this way.

## Phase 1: Foundation

## Phase 15: Marketplace State Lock

Full text: `.planning/phases/15-marketplace-state-lock/DUBIOUS-CHOICES.md`.

- **P15-DC-01 (High, open).** The scenarios pin D-06, not Claude Code's fallback.
- **P15-DC-02 (Medium, open).** No scenario for the unnamed or cross-scope flip.
- **P15-DC-03 (Low, open).** The seed is rewritten.
- **P15-DC-04 (Low, open).** No verb step module.
- **P15-DC-05 (Low, open).** Research ran.
- **P15-DC-06 (Medium, open).** The stale add twin checks no record.
- **P15-DC-07 (Low, open).** The stale flip twin drops the remembered-bytes Given.
- **P15-DC-08 (Low, open).** The seed keeps its title.
- **P15-DC-09 (Low, open).** The researcher ran its red proofs in a scratch copy of the tree.
- **P15-DC-10 (Low, open).** Pattern mapping skipped.
- **P15-DC-11 (Low, open).** One plan with three tasks.
- **P15-DC-12 (Low, open).** Planner wording choices.
- **P15-DC-13 (Low, open).** Checker warning dismissed.
- **P15-DC-14 (Medium, open).** Inline execution, review, and verification.
- **P15-DC-15 (Low, open).** Tables aligned by a scratch script.
- **P15-DC-16 (Low, open).** Early commit messages and gate logs lived in the session scratchpad.
- **P15-DC-17 (Low, open).** Review, verification, security audit, and validation sign-off ran inline.
- **P15-DC-18 (Low, open).** `phase.complete` rewrote STATE.md's frontmatter and Current Position.

## Phase 14: Bootstrap

Full text: `.planning/phases/14-bootstrap/DUBIOUS-CHOICES.md`.

- **P14-DC-01 (Medium, open).** No terminal scenario for the lock-held failure (D-BG-1404).
- **P14-DC-02 (Medium, open).** The lock-held row names the source, not the marketplace (D-BG-1406).
- **P14-DC-03 (Low, open).** No verb module (D-BG-1408).
- **P14-DC-04 (Low, open).** Commit message clobbered in the shared scratchpad.
- **P14-DC-05 (Low, open).** Research and pattern mapping skipped.
- **P14-DC-06 (Medium, open).** Red proof for the refusal outline runs the add before the checks.
- **P14-DC-07 (Low, open).** Wider checks in the json and terminal scenarios.
- **P14-DC-08 (Low, open).** Outline title and scenario layout.
- **P14-DC-09 (Low, open).** CONTEXT names the wrong step modules.
- **P14-DC-10 (Low, open).** Attribution trailer.
- **P14-DC-11 (Medium, open).** The plan ran inline, not in a gsd-executor subagent.
- **P14-DC-12 (Low, open).** The pgrep check matches itself.
- **P14-DC-13 (Medium, open).** Review fixes and verification ran inline.
- **P14-DC-14 (Low, open).** Review dispositions.
- **P14-DC-15 (Medium, open).** Json-mode timeouts under load accepted as load.
- **P14-DC-16 (Low, open).** Regression gate, Nyquist, and security audits.
- **P14-DC-17 (Low, open).** The parent's sentinel step and config-set step skipped.

## Phase 7: State Schema Migration

Full text: `.planning/phases/07-state-schema-migration/DUBIOUS-CHOICES.md`.

- **P7-DC-01 (Medium, open).** Release 0.4.3 left to Phase 8.
- **P7-DC-02 (Medium, open).** A new step reads the record's schema version and provenance.
- **P7-DC-03 (Medium, open).** Other commands' unreadable reports are not pinned or fixed.
- **P7-DC-04 (Medium, open).** A refused newer record keeps the installed components working.
- **P7-DC-05 (Low, open).** The migration write stays fire-and-forget.
- **P7-DC-06 (Low, open).** An old record with no plugins keeps its old schema version.
- **P7-DC-07 (Low, open).** UI and AI gates skipped as false positives.
- **P7-DC-08 (Low, open).** Research ran although the roadmap's research flag is "no".
- **P7-DC-09 (Low, open).** Pattern mapper skipped.
- **P7-DC-10 (Low, open).** Planner's choices.
- **P7-DC-11 (Low, open).** Commit attribution.
- **P7-DC-12 (Medium, open).** Inline execution, review, and verification.
- **P7-DC-13 (Low, open).** Root-pin guard not run.
- **P7-DC-14 (Low, open).** Gate and commit-message location.
- **P7-DC-15 (Medium, open).** One commit carries a wrong title.
- **P7-DC-16 (Low, open).** Executor details.
- **P7-DC-17 (Low, open).** `_auto_chain_active` reset skipped.
- **P7-DC-18 (Low, open).** Review Info item left unfixed.
- **P7-DC-19 (Low, open).** Security and Nyquist records written inline.
