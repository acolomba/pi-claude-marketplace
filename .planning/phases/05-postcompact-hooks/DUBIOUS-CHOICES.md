# Phase 5 (PostCompact Hooks): Dubious Choices

The choices Phase 5 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 5.
Only the Phase 5 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 5's.

## Discuss step

The autonomous run took the recommended option at every discuss question;
those answers are the decisions D-BG-501 to D-BG-508 in 05-CONTEXT.md. The
entries below are the ones a reviewer may reverse.

- **P5-DC-01 (High, open). PostCompact lines after `/compact` replace the hook error notice (D-BG-501).** After a manual compaction the bridge shows one notice that lists each PostCompact hook's end, worded as Claude Code 2.1.319's `/compact` output (`PostCompact [<command>] completed successfully: <stdout>`, `... failed: <stderr>`). This amends the PostCompact clause of the locked D-CF5-24, which showed an exit 2 as `PostCompact:<trigger> hook error: [<command>]: <stderr>` and showed nothing for exit 0 or exit 1. The evidence is the binary's PostCompact runner and the `/compact` result text; no earlier record looked at those lines.
- **P5-DC-02 (High, open). Nothing shown after an automatic compaction (D-BG-502).** A PostCompact hook that fails during an automatic compaction now shows the user nothing, an exit 2 included, because Claude Code 2.1.319 computes the same text on its automatic paths and no code reads it. The evidence is the absence of a consumer, so confidence is medium-high, not high.
- **P5-DC-03 (Medium, open). Two hook modules outside the enumerated shared list (D-BG-503).** The run of a PostCompact hook travels as one new optional field of `HookExecResult` in `bridges/hooks/exec-result.ts`, and its wording is one new function in `bridges/hooks/hook-labels.ts`. Neither file is in the roadmap's list of shared hook dispatch modules. Both changes are additive and PostCompact-only; the parent may treat them as part of "the PostCompact arm of the shared hook modules" or ask for another carrier.
- **P5-DC-04 (Low, open). One notice, not one per hook (D-BG-501).** Upstream shows the lines as one block, so the bridge shows one `hook-notice` whose text joins them with line breaks, as the PreCompact block notice does (D-CF5-18).
- **P5-DC-05 (Low, open). The line's command includes exec-form arguments (D-BG-504).** Upstream's display command joins `args` after `command`. The existing block texts of D-CF5-11 omit `args`; they are left as they are and noted in Deferred.
- **P5-DC-06 (Low, open). Shared doc sentences are parent lines (D-BG-508).** Two sentences of `docs/hooks-compatibility.md` name PostCompact beside SessionStart and SessionEnd, which Phase 6 owns. They stay unchanged on this branch, so the doc contradicts D-BG-501 there until the parent applies the parent line at the merge.
- **P5-DC-07 (Low, open). Tooling: shared scratchpad and a stale manager projection.** The scratchpad directory is shared by the parent and every child session: another child's `init.milestone-op` output overwrote this session's file of the same name, so this session writes only under `scratchpad/phase-5/`. `gsd-tools query init.manager` reports Phase 5 as executed with a stale verification, because it matches an archived `05-prune-on-uninstall` directory; `init.phase-op 5` reports the phase correctly, and the run follows it.
- **P5-DC-08 (Low, open). Pattern mapper skipped.** The plan step ran research but not the optional pattern-mapper hook, because 05-RESEARCH.md already names every edit point with line numbers and excerpts; this saves a subagent run on a machine shared by fifteen phases.

## Research step

- **P5-DC-09 (Low, open). The run is worked out in the payload module.** The function that turns a PostCompact hook's end into its run lives in `payloads/post-compact.ts`, a file this phase owns, although that file's header describes one stdin translator.
- **P5-DC-10 (Medium, open). The trigger gate is a branch in a shared function body.** The manual-only display is one `if (claudeEvent === "PostCompact")` branch in `compositeHandlerFor`, next to the PreToolUse branch; reading the trigger back from the label string was rejected.
- **P5-DC-11 (Low, open). Start errors are redacted.** At the child `error` site the start error goes through `redactAbsolutePaths`, as the outer catch already does; upstream shows the raw message.
- **P5-DC-12 (Low, open). Edge divergences in the run output.** A JSON `permissionDecision: "deny"` shows its deny reason (upstream shows stdout); `continue: false` with `decision: "block"` shows stdout (upstream the reason); an empty `reason` shows nothing (upstream falls back to stderr); broken JSON on exit 0 under `onFailure` appends stdout (upstream its schema-validation message).
- **P5-DC-13 (Low, open). Shared test loops change.** The PostCompact row of `TRANSLATOR_CASES` in `dispatch-exec.test.ts` gets an expected outcome, and `dispatchDriven` gets an optional event parameter; both are shared test helpers, with merge-conflict risk against sibling hook phases.
- **P5-DC-14 (Low, open). D-BG-506's rationale is refuted.** A probe showed that the overflow compact-and-retry compacts even without a prior turn; the scenario keeps the prior turn as decided.
- **P5-DC-15 (Low, open). A third shared doc sentence.** The count "three more notices" in `docs/hooks-compatibility.md` is shared too, so it is a third parent line beyond the two D-BG-508 names.

## Planning step

- **P5-DC-16 (Low, open). Plan checker not run as a subagent.** The coordinator ruled mid-phase that this session's subagents run async and stall, so the plan checker was not dispatched; the orchestrator read both plans itself, and the planner's own gates (plan structure, decision coverage 8/8, failing directions 20/20) passed.
- **P5-DC-17 (Medium, open). Execution, review, and verification inline.** By the coordinator's rule, the rest of the phase (execution, code review per `gsd-code-reviewer.md`, fixes, verification per `gsd-verifier.md`) runs inline in the orchestrator, not in fresh subagent contexts, so the review and verification are not independent of the author.
- **P5-DC-18 (Low, open). One eleven-file commit.** 05-01 Task 1 lands the run type, its producer and consumer, two scenarios, and five unit pairs together, because fallow rejects an unconsumed export and the hook needs 100% coverage of each staged pair.
- **P5-DC-19 (Low, open). Timeout line pinned in a scenario.** Scenario 4 pins `Hook cancelled` with a `slow` hook (timeout 1, sleep 3) placed first, which also proves routing order; it costs about 3 s. The start-failure line stays unit-only because Node words spawn errors per major.
- **P5-DC-20 (Low, open). Exec-form row in scenario 4.** An `exec script` hook with the argument `["note"]` pins D-BG-504's display command in behavior.
- **P5-DC-21 (Medium, open). Scenario 6 states Pi's compaction frame.** Its model-call row holds Pi's own summary frame text, because D-BG-507 names `the model receives these calls:` and the frozen `features/lib/upstream/` has no projection for it; a parent line proposes the projection (same class as P1-DC-32).
- **P5-DC-22 (Low, open). Planning details.** The derivation is named `postCompactRunOf`; the matcher scenario states PostCompact rows only; no silent-overflow scenario; existing `translatePostCompact` cases regroup under a `describe`; red proofs for the seed and scenarios 2 and 3 share two one-run breakages of `compactTrigger`; the edge-probe assumption sits in `must_haves.assumptions`, which the GSD parser does not read; between the two 05-01 commits a hook that cannot start adds no line; the doc's PostCompact Notes cell stays within its column width.

## Execution, review, and verification

- **P5-DC-23 (Low, open). Plans' tasks folded into fewer commits.** 05-01's two tasks landed in one commit (`2c3c6b71`), and 05-02's first two tasks in one commit; every red proof is still recorded per scenario.
- **P5-DC-24 (Low, open). Test regrouping skipped.** The existing `translatePostCompact` cases stay top-level beside the new `describe("postCompactRunOf")`, and `POST_COMPACT_EVENT` is a constant rather than the planned `postCompactEvent()` function; fallow's dupes gate passed.
- **P5-DC-25 (Medium, open). Gate failures under load accepted on rerun.** The wave 1 adapter leg timed out once (`marketplace/background-update.feature:90`), and the phase gate's adapter leg failed four scenarios outside the hook modules (`skill/collisions.feature:156`, `marketplace/remove.feature:630`, `plugin/install-dependencies.feature:562`, `plugin/update.feature:484`); each passed on one rerun. Because `npm run check` stops at the first failing part, the builtin leg and `test:coverage:direct:all` of the phase gate ran as separate commands afterwards (both green).
- **P5-DC-26 (Low, open). STATE.md not edited.** The phase's completion is recorded in its own ROADMAP, REQUIREMENTS, and VALIDATION entries; STATE.md's counts and position are left to the parent, which re-derives them at the merge.
- **P5-DC-27 (Low, open). Commit titles checked.** After the coordinator's warning about the shared scratchpad, every commit title of this branch was checked against its content and matches; commit messages moved to `/tmp/claude-1000/bg-phase-5/` from the plans commit on.
