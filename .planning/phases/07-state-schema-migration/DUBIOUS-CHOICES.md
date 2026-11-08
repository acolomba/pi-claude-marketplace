# Phase 7 (State Schema Migration): Dubious Choices

The choices Phase 7 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 7.
Only the Phase 7 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 7's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-701 to D-BG-704 in 07-CONTEXT.md. The entries below are the parts of them a reviewer may want to reverse.

- **P7-DC-01 (Medium, open). Release 0.4.3 left to Phase 8.** STMIG-01 says "each older schema". Schema version 1 is covered by the release 0.6.0 record only; the 0.4.3 record (also schema version 1, with no `resources.hooks` and no config files) has no Phase 7 scenario, because its first load is the MIG-01 config migration that Phase 8 owns (D-BG-701).
- **P7-DC-02 (Medium, open). A new step reads the record's schema version and provenance.** The ROADMAP's Behavioral tests rule says scenarios observe the installation record "through its existing steps". No existing step reads `schemaVersion` or `provenance`, which is what "rewritten in the current schema" means, so the verb module adds one read step (D-BG-704).
- **P7-DC-03 (Medium, open). Other commands' unreadable reports are not pinned or fixed.** With a newer `state.json`, `install` reports no reason, `update` reports `unreadable manifest`, and `uninstall` and `info` report an internal error whose cause is cut to `state.json at [path]`. All refuse and change nothing, but only `list`, `disable`, `pending`, `apply`, and the load report `{unreadable}`. The fixes are in orchestrators no stream owns, so Phase 7 pins `list` (seed) and `disable` only, and proposes a BACKLOG entry as a parent line (D-BG-703).
- **P7-DC-04 (Medium, open). A refused newer record keeps the installed components working.** The load that refuses a newer `state.json` still offers the plugin's skill, because resource discovery reads the staged files, not the record. Phase 7 pins that as "every installed component stays as it was" (STMIG-02) instead of asking whether a release that cannot read the record should stop offering what it installed (D-BG-703).
- **P7-DC-05 (Low, open). The migration write stays fire-and-forget.** `loadState` does not await `persistMigratedState`, so the record steps read a file whose write the load started but did not wait for. The exploratory runs saw it landed every time, and no product change is planned unless a gate run shows otherwise (D-BG-704).
- **P7-DC-06 (Low, open). An old record with no plugins keeps its old schema version.** `loadState` rewrites the file only when a field was filled, so a schema version 1 or 2 record with marketplaces but no plugins stays at its version on disk. No scenario pins it; a BACKLOG entry is proposed as a parent line.

## Research step

- **P7-DC-07 (Low, open). UI and AI gates skipped as false positives.** `ui-plan-gate` read the phase as frontend because the criteria say "component"; the only active plan:pre skill hook was `ai-integration`, whose AI-keyword condition does not match. No UI-SPEC or AI-SPEC was made.
- **P7-DC-08 (Low, open). Research ran although the roadmap's research flag is "no".** The flag concerns upstream (Claude Code) research; the GSD researcher was run anyway, for the Validation Architecture that VALIDATION.md and the Nyquist check need. It re-measured the newer-schema reports in a scratch probe and added the `marketplace status`, `marketplace reasons`, and `scope` columns.

## Planning step

- **P7-DC-09 (Low, open). Pattern mapper skipped.** The phase adds one step module and one feature file; the research already names the analog (`installation.steps.ts`) and sketches the step.
- **P7-DC-10 (Low, open). Planner's choices.** The seeds also get product-sabotage red proofs; the second-load red proof stamps `updatedAt` on every load, because skipping the write cannot fail a "changes nothing" scenario; the step text is pinned to the D-BG-704 wording; "every recorded plugin" is shown with one plugin record; no scenario checks what the first load does to `claude-plugins.json` (Phase 8 owns MIG-01); `disable`'s "unstages nothing" is read with the frozen staged-files step; red-proof and gate logs go under the gitignored `tmp/`; each task runs the feature three times clean; the proposed BACKLOG IDs are `STATEREAD-01` and `STATEVER-01`.
- **P7-DC-11 (Low, open). Commit attribution.** The plan checker noted that its own session reminder names another model; the commits use the attribution lines the parent gave this child session.

## Execution

- **P7-DC-12 (Medium, open). Inline execution, review, and verification.** The session's agent-isolation guard reads its dispatch sentinel from the parent checkout, which this child session may not write (the permission classifier refused both a direct write and the `dispatch-isolation --cwd` verb there), so it refused the sequential `gsd-executor` dispatch. The orchestrator ran the plan inline, and the coordinator then ruled that the rest of the phase (code review per `gsd-code-reviewer.md`, fixes, verification per `gsd-verifier.md`) also runs inline. Reviewer and verifier are therefore not independent contexts.
- **P7-DC-13 (Low, open). Root-pin guard not run.** The harness refused `bash <guard script>` as too complex to verify; the work used absolute worktree paths and checked every commit with `git log`.
- **P7-DC-14 (Low, open). Gate and commit-message location.** Per the coordinator, commit messages and gate logs live in `/tmp/claude-1000/bg-phase-7/`; the first three commits (context, plan, Task 1) used the session scratchpad or the worktree's `tmp/`. Their titles were checked against their content and match.
- **P7-DC-15 (Medium, open). One commit carries a wrong title.** Commit `500fee97` holds the plan SUMMARY and the ROADMAP and STATE updates, but its message is a copy of the previous commit's (`test(features): prove a newer installation record is left untouched`): the new message file was not written before the commit ran. It was not amended (the brief forbids `--amend`).
- **P7-DC-16 (Low, open). Executor details.** The R3 sabotage replaced the write with `void stateJsonPath;` so the file still type-checks; S10's "unstages nothing" uses the frozen staged-files step; the adapter gate leg took about 30 minutes under the shared load.
- **P7-DC-17 (Low, open). `_auto_chain_active` reset skipped.** execute-phase's initialize step resets `workflow._auto_chain_active` with `config-set`, which the brief forbids; init already read it as false.
