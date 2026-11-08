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

## Phase 9: Legacy MCP Entry Move

Full text: `.planning/phases/09-legacy-mcp-entry-move/DUBIOUS-CHOICES.md`.

- **P9-DC-01 (Medium, open).** "Byte for byte" read as the entries, not the file (D-BG-905).
- **P9-DC-02 (Low, open).** A project-scope scenario beyond the criteria (D-BG-906).
- **P9-DC-03 (Medium, open).** "Servers still run" proven by the tool listing, not a model call (D-BG-904).
- **P9-DC-04 (Medium, open).** The unexpanded variable reference is `${ALPHA_HOME:-/srv/alpha}`.
- **P9-DC-05 (Low, open).** Probes ran with `--parallel 1`.
- **P9-DC-06 (Low, open).** The project-scope scenario adds the marketplace to the project scope.
- **P9-DC-07 (Low, open).** The servers-run scenario does not pin the move's row.
- **P9-DC-08 (Low, open).** Plan shape and checks.
- **P9-DC-09 (Low, open).** The pattern-mapper step was skipped.
- **P9-DC-10 (Low, open).** The new Given's wording.
- **P9-DC-11 (Low, open).** The Given's marker check uses `"_piClaudeMarketplace" in entry`.
- **P9-DC-12 (Low, open).** The red probe.
- **P9-DC-13 (Medium, open).** Subagent dispatch.

## Phase 12: Browse Picker

Full text: `.planning/phases/12-browse-picker/DUBIOUS-CHOICES.md`.

- **P12-DC-01 (High, open).** Marketplace row wording changes, not only its count.
- **P12-DC-02 (Medium, open).** Unreadable manifest leaves the count out.
- **P12-DC-03 (Medium, open).** BROWSE-02's "its marketplace's scope" refined.
- **P12-DC-04 (High, open).** Install-scope screen kept as is (D-BG-1202).
- **P12-DC-05 (Low, open).** Unavailable plugin rows pinned without an upstream reference.
- **P12-DC-06 (Low, open).** Upstream's `Updated {date}` row part not added.
- **P12-DC-07 (Medium, open).** Reserved-name check in the count.
- **P12-DC-08 (Low, open).** Row text with an unreadable catalog.
- **P12-DC-09 (Low, open).** `pluginCount` keeps its name with a new meaning.
- **P12-DC-10 (Medium, open).** Seven terminal scenarios.
- **P12-DC-11 (Low, open).** Scope-screen descriptions pinned as truncated.
- **P12-DC-12 (Low, open).** Unavailable plugin's Info-only actions stay unit-tested only.
- **P12-DC-13 (Low, open).** Pattern mapper skipped.
- **P12-DC-14 (Low, open).** D-BG-1201 lands in two commits.
- **P12-DC-15 (Medium, open).** Scenario B's unavailable entry has no version.
- **P12-DC-16 (Low, open).** A unit case pins the look-alike-name refusal.
- **P12-DC-17 (Low, open).** Bare-command red proof required.
- **P12-DC-18 (Low, open).** Seed titles change.
- **P12-DC-19 (Low, open).** Decision IDs in two scenario titles.
- **P12-DC-20 (Low, open).** BROWSE-02 wording unchanged.
- **P12-DC-21 (Medium, open).** Cancel red proofs may race.
- **P12-DC-22 (Low, open).** BACKLOG ID `BROWSESCOPE-01` proposed.
- **P12-DC-23 (Low, open).** Every task rated reversible, no decision checkpoint.
- **P12-DC-24 (Medium, open).** Plans executed inline, not by `gsd-executor` subagents.
- **P12-DC-25 (Low, open).** Commit message files in the shared scratchpad.
- **P12-DC-26 (Low, open).** Literal `--import` path.
- **P12-DC-27 (Low, open).** Exactly two `ctx.cwd` reads in the first-screen unit helper.
- **P12-DC-28 (Low, open).** 12-02's three tasks in one commit.
- **P12-DC-29 (Low, open).** Scenario runs through a helper script.
- **P12-DC-30 (Medium, open).** Review, fixes, and verification inline.

## Phase 11: Device Flow Sign-In

Full text: `.planning/phases/11-device-flow-sign-in/DUBIOUS-CHOICES.md`.

- **P11-DC-01 (Medium, open).** No upstream sign-in to compare.
- **P11-DC-02 (Medium, open).** A denied and an expired sign-in read the same.
- **P11-DC-03 (Low, open).** The credential store file as the observation.
- **P11-DC-04 (Low, open).** Out of scope.
- **P11-DC-05 (Low, open).** No research step.
- **P11-DC-06 (Medium, open).** Cache-hit shape (D-BG-1104 amended).
- **P11-DC-07 (Low, open).** The DFLOW-03 pair is not minimal.
- **P11-DC-08 (Low, open).** Two-row outline.
- **P11-DC-09 (Low, open).** DFLOW-04 red proof removes two guards.
- **P11-DC-10 (Low, open).** A stored github.com credential Given of the phase's own.
- **P11-DC-11 (Low, open).** Lean plan context.
- **P11-DC-12 (Low, open).** Executors dispatched as general-purpose agents.
- **P11-DC-13 (Low, open).** Skipped GSD writes.
- **P11-DC-14 (Low, open).** Seed 1's sign-in table realigned (11-01).
- **P11-DC-15 (Low, open).** The credential store table has no path column (11-01).
- **P11-DC-16 (Low, open).** Shared hook repair.
- **P11-DC-17 (Low, open).** Shared scratchpad.
- **P11-DC-18 (Low, open).** Inline execution after 11-01.
- **P11-DC-19 (Low, open).** One commit for both 11-02 tasks.
- **P11-DC-20 (Low, open).** Combined red-proof runs.
- **P11-DC-21 (Low, open).** A doubled phase gate was stopped and rerun.

## Phase 16: Background-Child Load

Full text: `.planning/phases/16-background-child-load/DUBIOUS-CHOICES.md`.

- **P16-DC-01 (Medium, open).** "Still shows the change as pending" read as "the next parent load applies it".
- **P16-DC-02 (Low, open).** No duplicate of the grant scenario.
- **P16-DC-03 (Medium, open).** Hook input in a child.
- **P16-DC-04 (Medium, open).** Legacy-move scenario tagged `@own-implementation`.
- **P16-DC-05 (Low, open).** GSD manager projection ignored.
- **P16-DC-06 (Low, open).** Commit 4e3d127c carries another phase's message.
- **P16-DC-07 (Low, open).** Research ran although the roadmap says "Research flag: no".
- **P16-DC-08 (Low, open).** Red proofs run in a scratch copy.
- **P16-DC-09 (Medium, open).** A second mutation for the hook red proof.
- **P16-DC-10 (Low, open).** One plan, one wave.
- **P16-DC-11 (Low, open).** Pattern mapper skipped.
- **P16-DC-12 (Low, open).** Three tasks.
- **P16-DC-13 (Low, open).** Red-proof harness.
- **P16-DC-14 (Low, open).** The seed's old title stays in the frozen layout.md.
- **P16-DC-15 (Low, open).** Red-proof greps read cucumber's output format.
- **P16-DC-16 (Low, open).** Two `When` steps in scenarios A, B, and C.
- **P16-DC-17 (Medium, open).** The orchestrator finished the plan, review, and verification inline.
- **P16-DC-18 (Low, open).** Two executors overlapped in Task 2.
- **P16-DC-19 (Low, open).** The executor ran as a general-purpose agent.

## Phase 3: StopFailure Hooks

Full text: `.planning/phases/03-stopfailure-hooks/DUBIOUS-CHOICES.md`.

- **P3-DC-01 (High, open).** D-BG-301: three more StopFailure error types.
- **P3-DC-02 (High, open).** D-BG-302: `|` lists on StopFailure matchers only.
- **P3-DC-03 (Medium, open).** D-BG-303: `last_assistant_message` left out when empty.
- **P3-DC-04 (Medium, open).** D-BG-304: no new classifier rules.
- **P3-DC-05 (Low, open).** Fire-and-forget not pinned.
- **P3-DC-06 (Low, open).** Settle keeps the shared matcher check.
- **P3-DC-07 (Low, open).** Scenario messages.
- **P3-DC-08 (Low, open).** Pi's empty assistant row.
- **P3-DC-09 (Low, open).** Pattern mapper skipped.
- **P3-DC-10 (Low, open).** Three plans in three waves.
- **P3-DC-11 (Low, open).** The next-turn scenario's reason narrowed.
- **P3-DC-12 (Low, open).** The list matcher.
- **P3-DC-13 (Low, open).** Dropped matchers as an Outline.
- **P3-DC-14 (Low, open).** Look-alike other matchers.
- **P3-DC-15 (Low, open).** A seven-file tracer.
- **P3-DC-16 (Low, open).** Docs row rewritten once.
- **P3-DC-17 (Low, open).** Inline list rule in settle.
- **P3-DC-18 (Low, open).** The planner filled the validation map.
- **P3-DC-19 (Low, open).** BACKLOG ID.
- **P3-DC-20 (Low, open).** Two planner detectors skipped.
- **P3-DC-21 (Medium, open).** Inline execution.
- **P3-DC-22 (Low, open).** Executor collision.
- **P3-DC-23 (Low, open).** One combined wave gate.
- **P3-DC-24 (Medium, open).** A load timeout left red.
- **P3-DC-25 (Low, open).** Test shapes.

## Phase 10: Model-Facing Tools

Full text: `.planning/phases/10-model-facing-tools/DUBIOUS-CHOICES.md`.

- **P10-DC-01 (Medium, open).** The carried json-output D-03 choice closes as "return `isError: true`, never throw".
- **P10-DC-02 (High, open).** A disabled plugin keeps the `[unavailable]` tag, and the `unavailable` filter now returns it.
- **P10-DC-03 (Medium, open).** The list tool's `<N> plugin(s)` keeps counting installed plugins (D-09).
- **P10-DC-04 (Low, open).** GSD's manager view resolves Phase 10 to an archived directory.
- **P10-DC-05 (Medium, open).** `(no plugins)` for every block that keeps no rows.
- **P10-DC-06 (Low, open).** "Each parameter form" read as 3-4 combined calls.
- **P10-DC-07 (Low, open).** Research probes edited the owned `tools.ts` temporarily.
- **P10-DC-08 (Low, open).** Shared pre-commit hook briefly in migration mode.
- **P10-DC-09 (Low, open).** Pattern mapper skipped.
- **P10-DC-10 (Low, open).** Plan shape.
- **P10-DC-11 (Low, open).** One heavy Background.
- **P10-DC-12 (Low, open).** Scenario grouping.
- **P10-DC-13 (Low, open).** Description wording.
- **P10-DC-14 (Low, open).** No-change scenario scope.
- **P10-DC-15 (Low, open).** Shared unit fixture.
- **P10-DC-16 (Low, open).** Stale count comment left.
- **P10-DC-17 (Medium, open).** Isolation sentinel written in the parent checkout.
- **P10-DC-18 (Medium, open).** Plan 10-02, the code review, the fixes, and the verification ran inline.
- **P10-DC-19 (Low, open).** Sequential root pin simplified.
- **P10-DC-20 (Low, open).** Empty-block copy.
- **P10-DC-21 (Low, open).** Red proofs ran once.
- **P10-DC-22 (Medium, open).** The list tool does not follow Phase 12's picker wording.
- **P1-DC-48** (see the phase log).

## Phase 5: PostCompact Hooks

Full text: `.planning/phases/05-postcompact-hooks/DUBIOUS-CHOICES.md`.

- **P5-DC-01 (High, open).** PostCompact lines after `/compact` replace the hook error notice (D-BG-501).
- **P5-DC-02 (High, open).** Nothing shown after an automatic compaction (D-BG-502).
- **P5-DC-03 (Medium, open).** Two hook modules outside the enumerated shared list (D-BG-503).
- **P5-DC-04 (Low, open).** One notice, not one per hook (D-BG-501).
- **P5-DC-05 (Low, open).** The line's command includes exec-form arguments (D-BG-504).
- **P5-DC-06 (Low, open).** Shared doc sentences are parent lines (D-BG-508).
- **P5-DC-07 (Low, open).** Tooling: shared scratchpad and a stale manager projection.
- **P5-DC-08 (Low, open).** Pattern mapper skipped.
- **P5-DC-09 (Low, open).** The run is worked out in the payload module.
- **P5-DC-10 (Medium, open).** The trigger gate is a branch in a shared function body.
- **P5-DC-11 (Low, open).** Start errors are redacted.
- **P5-DC-12 (Low, open).** Edge divergences in the run output.
- **P5-DC-13 (Low, open).** Shared test loops change.
- **P5-DC-14 (Low, open).** D-BG-506's rationale is refuted.
- **P5-DC-15 (Low, open).** A third shared doc sentence.
- **P5-DC-16 (Low, open).** Plan checker not run as a subagent.
- **P5-DC-17 (Medium, open).** Execution, review, and verification inline.
- **P5-DC-18 (Low, open).** One eleven-file commit.
- **P5-DC-19 (Low, open).** Timeout line pinned in a scenario.
- **P5-DC-20 (Low, open).** Exec-form row in scenario 4.
- **P5-DC-21 (Medium, open).** Scenario 6 states Pi's compaction frame.
- **P5-DC-22 (Low, open).** Planning details.
- **P5-DC-23 (Low, open).** Plans' tasks folded into fewer commits.
- **P5-DC-24 (Low, open).** Test regrouping skipped.
- **P5-DC-25 (Medium, open).** Gate failures under load accepted on rerun.
- **P5-DC-26 (Low, open).** STATE.md not edited.
- **P5-DC-27 (Low, open).** Commit titles checked.
- **P1-DC-32** (see the phase log).
