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
- **S-05 (Medium, open). The combined-tree gates ran in parts, after merges in batches, under load.** The machine ran up to fifteen phase gates at once (load average up to 137 on 28 cores), so the parent ran one combined gate for several merges instead of one per merge. The gate at the Phase 8 merge (14 phases) passed every part: static checks, unpaired and integration tests, 1,757 of 1,761 adapter scenarios, 152 of 152 builtin, direct coverage (350 records), and `test:modules`. The four adapter failures (`plugin/update.feature:514`, `marketplace/update.feature:515` and `:520`, `plugin/autoapply.feature:507`) each found no `/skill:demo-skill` offered in a new session after an update or apply, and all four passed when rerun together at low load. No phase touched those files; it reads as an existing race under eight workers, to watch in CI.

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

## Phase 6: SessionEnd Hooks

Full text: `.planning/phases/06-sessionend-hooks/DUBIOUS-CHOICES.md`.

- **P6-DC-01 (High, open).** Plugin SessionEnd timeouts capped at 1.5 s (D-BG-604).
- **P6-DC-02 (Medium, open).** `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` is not read (D-BG-605).
- **P6-DC-03 (Medium, open).** No bounded SessionEnd wait (D-BG-605).
- **P6-DC-04 (Medium, open).** The failure outlines state no notice for a non-blocking failure (D-BG-603).
- **P6-DC-05 (Medium, open).** Ways a session ends that no scenario drives (D-BG-601).
- **P6-DC-06 (Low, open).** The resumed session is a hand-written session file (D-BG-601).
- **P6-DC-07 (Low, open).** "Pi exits" is proven in json mode, not by an RPC stop (D-BG-603).
- **P6-DC-08 (Low, open).** HKTO-01 counted as fixed by the cap (D-BG-604).
- **P6-DC-09 (Medium, open).** The failure scenarios start no setup session.
- **P6-DC-10 (Low, open).** The saved session sits directly in `{agent dir}/sessions/`.
- **P6-DC-11 (Low, open).** One named budget constant.
- **P6-DC-12 (Low, open).** Json-mode details.
- **P6-DC-13 (Low, open).** The sleep-30 RPC row's red proof is just past the 30 s step timeout.
- **P6-DC-14 (Low, open).** No pattern-mapper run.
- **P6-DC-15 (Low, open).** The cap and the scenario rows that prove it land in different waves.
- **P6-DC-16 (Low, open).** The docs `timeout` row keeps its exact width.
- **P6-DC-17 (Low, open).** The RPC reason and matcher scenarios keep the setup new-session Given.
- **P6-DC-18 (Low, open).** Proposed parent-line names.
- **P6-DC-19 (Low, open).** Step texts.
- **P6-DC-20 (Low, open).** Researcher, planner, and checker ran as background agents.
- **P6-DC-21 (Medium, open).** Plans, review, and verification ran inline in the child session.
- **P6-DC-22 (Medium, open).** SessionEnd recorder runs are load-sensitive.
- **P6-DC-23 (Low, open).** The exit-2 scenario starts a setup session.
- **P6-DC-24 (Low, open).** R6 for the json rows used a delayed settle.
- **P6-DC-25 (Low, open).** Two tasks per commit in 06-01 and 06-03.
- **P6-DC-26 (Medium, open).** The phase gate passed after one rerun.
- **P6-DC-27 (Low, open).** The code review found two info items and no fix.
- **P6-DC-28 (Low, open).** STATE.md left as the parent's.

## Phase 13: Prune

Full text: `.planning/phases/13-prune/DUBIOUS-CHOICES.md`.

- **P13-DC-01 (Medium, open).** Criteria 2 and 3 met by scenarios the phase does not own.
- **P13-DC-02 (Low, open).** Upstream's `autoremove` alias is not adopted.
- **P13-DC-03 (Medium, open).** An island of dependencies that declare each other stays installed.
- **P13-DC-04 (High, open).** A pruned disabled dependency leaves `enabled: false` in `claude-plugins.json`.
- **P13-DC-05 (Low, open).** A separate orphan per scope.
- **P13-DC-06 (Low, open).** The lock red proof edits a Phase 15 file locally.
- **P13-DC-07 (Low, open).** The optional-peer cache was missing.
- **P13-DC-08 (Low, open).** No pattern-mapper run.
- **P13-DC-09 (Low, open).** Scenario placement.
- **P13-DC-10 (Low, open).** M3 edits a file the phase does not own, locally.
- **P13-DC-11 (Low, open).** Scenario D states the config.
- **P13-DC-12 (Low, open).** One plan above the half-context estimate.
- **P13-DC-13 (Low, open).** BACKLOG IDs.
- **P13-DC-14 (Medium, open).** The plan, review, and verification ran inline, without subagents.
- **P13-DC-15 (Low, open).** Gate reruns on the failing scenarios only.
- **P13-DC-16 (Low, open).** The shared scratchpad leaked commit messages between phases.
- **P13-DC-17 (Low, open).** The roadmap plan line was ticked by hand.
- **P13-DC-18 (Low, open).** Security and validation records written inline.
- **P13-DC-19 (Low, open).** The regression gate is the full check.
- **P13-DC-20 (Low, open).** The transition's PROJECT.md step was skipped.

## Phase 8: First-Run Config Migration

Full text: `.planning/phases/08-first-run-config-migration/DUBIOUS-CHOICES.md`.

- **P8-DC-01 (Medium, open).** D-BG-802: a rebuilt config leaves out cascade-installed dependencies.
- **P8-DC-02 (Low, open).** D-BG-806: a new session stands in for a later load.
- **P8-DC-03 (Low, open).** D-BG-804: a deleted config loses `autoupdate`.
- **P8-DC-04 (Medium, open).** The edit scenario writes the user's edit through the plugins step, not `with this text:`.
- **P8-DC-05 (Low, open).** The invalid-config scenarios pin an empty file's `Unexpected end of JSON input`, or a one-segment schema error such as `{ "plugins": [] }`.
- **P8-DC-06 (Low, open).** Node 24's JSON error text was not observed.
- **P8-DC-07 (Low, open).** `migrate-config.ts` is not added to `DISABLED_STATE_TARGETS`.
- **P8-DC-08 (Low, open).** A load with autoapply on can still rewrite the config in one case.
- **P8-DC-09 (Low, open).** Project 0.4.3 `autoupdate` setup.
- **P8-DC-10 (Low, open).** The project-scope `pending` scenario uses a deleted config with a disabled plugin.
- **P8-DC-11 (Low, open).** Two plans in sequence, split by requirement.
- **P8-DC-12 (Low, open).** The feature's Background keeps only the publish step.
- **P8-DC-13 (Medium, open).** An extra scenario S-P5, which research did not plan.
- **P8-DC-14 (Low, open).** S-U5 kept.
- **P8-DC-15 (Low, open).** The project 0.4.3 scenario pins `autoupdate` false.
- **P8-DC-16 (Low, open).** The unit cases are one data-driven loop of five rows.
- **P8-DC-17 (Low, open).** No scenario runs `pending` against an invalid config.
- **P8-DC-18 (Low, open).** The tracer task bundles the fix, unit rows, seed rewrite, and README line in one commit.
- **P8-DC-19 (Low, open).** Every decision rated reversible; no checkpoint task.
- **P8-DC-20 (Low, open).** The planner edited ROADMAP.md's Phase 8 `Plans` entry itself.
- **P8-DC-21 (Medium, open).** Execution, code review, fixes, and verification ran inline in the phase session, not in subagents.
- **P8-DC-22 (Low, open).** The dispatch-isolation sentinel was forced in the parent checkout's `.gsd/`.
- **P8-DC-23 (Low, open).** Executor prompts passed the execution-context workflow files by path.
- **P8-DC-24 (Low, open).** Planning commits used the shared scratchpad for message files.
- **P8-DC-25 (Low, open).** The wave 1 gate's adapter leg had two timeouts under machine load.
- **P8-DC-26 (Low, open).** The review's one Info item (IN-01) is left unfixed.
- **P8-DC-27 (Low, open).** The phase closed without `/gsd-secure-phase` or `/gsd-validate-phase`.
- **P8-DC-28 (Low, open).** `phase.complete` advanced STATE.md's frontmatter and Current Position to Phase 2.

## Phase 4: PostToolUseFailure Hooks

Full text: `.planning/phases/04-posttoolusefailure-hooks/DUBIOUS-CHOICES.md`.

- **P4-DC-01 (High, open).** `is_interrupt` is always `false` (D-BG-401).
- **P4-DC-02 (Medium, open).** The cancelled-call guard edits a shared function (D-BG-402).
- **P4-DC-03 (Medium, open).** `tool_use_id`, `duration_ms`, and `mcp_server` stay out (D-BG-403).
- **P4-DC-04 (Medium, open).** The failing MCP stand-in and the interrupt driver live in the verb module.
- **P4-DC-05 (High, open).** The adapter failure routing is fixed in a shared line (D-BG-404).
- **P4-DC-06 (Medium, open).** `updatedToolOutput` on a failure is dropped (D-BG-405).
- **P4-DC-07 (Medium, open).** The failing-MCP scenarios pin each implementation's error wording and skip the built-in stand-in.
- **P4-DC-08 (Low, open).** Research side effects.
- **P4-DC-09 (Medium, open).** Plan split.
- **P4-DC-10 (Medium, open).** Pi's `read` wording is pinned in several scenarios.
- **P4-DC-11 (Low, open).** The MCP pair's titles name their licenses.
- **P4-DC-12 (Low, open).** The adapter check runs before the empty-bucket check.
- **P4-DC-13 (Low, open).** No `if` row and long scenarios.
- **P4-DC-14 (Low, open).** Plan checker run in the background.
- **P4-DC-15 (Medium, open).** Execution ran inline after plan 04-01's Task 1.
- **P4-DC-16 (Low, open).** The interrupt step's deadlines and helper shape.
- **P4-DC-17 (Low, open).** The `is_interrupt` docs row landed in the guard commit (48dfc857).
- **P4-DC-18 (Low, open).** Plan 04-02's scenarios R2 to R7 share one commit (80558dad).
- **P4-DC-19 (Low, open).** Gate reruns under load.
- **P4-DC-20 (Low, open).** The milestone merge commit d2dfb11d kept git's default message.
- **P4-DC-21 (Low, open).** The wave 2 gate reran 35 unrelated adapter scenarios.
- **P4-DC-22 (Low, open).** Code review and verification ran inline, scoped to the phase's own commits.
- **P4-DC-23 (Low, open).** The phase gate reran 8 unrelated adapter scenarios.
- **P4-DC-24 (Low, open).** STATE.md was left at the milestone's version.
