# Phase 16 (Background-Child Load): Dubious Choices

The choices Phase 16 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 16.
Only the phase's own session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 16's.

## Discuss step

The autonomous run took the recommended option at every discuss question;
those answers are the decisions D-BG-1601 to D-BG-1605 in 16-CONTEXT.md, so
only the judgment calls inside them are repeated here.

- **P16-DC-01 (Medium, open). "Still shows the change as pending" read as
  "the next parent load applies it".** Criterion 1 asks that the next parent
  load still show the change as pending, but the scenario keeps autoapply on,
  so a parent load applies the change instead of listing it. The applied
  install, uninstall, and update are taken as the proof that the child left
  them pending (D-BG-1602). The parent is a one-shot Pi in json mode, because
  the only restart that drops the child marker belongs to the
  launch-environment child step, whose restart steps name `mcp` or
  pi-mcp-adapter and would make a non-MCP scenario an MCP one.
- **P16-DC-02 (Low, open). No duplicate of the grant scenario.** The grant
  half of CHILD-02 stays proven by the unowned scenario "A pi-subagents
  background child leaves an agent's grant in the form it holds (MGRT-02)" in
  `features/mcp-server/agent-grants.feature`; the phase re-runs its red proof
  instead of copying it into `plugin/subagent-child.feature` (D-BG-1604).
- **P16-DC-03 (Medium, open). Hook input in a child.** Claude Code runs
  plugin tool hooks inside subagents and adds `agent_id` and `agent_type` to
  their input (code.claude.com/docs/en/hooks, read 2026-11-08). In a
  pi-subagents child this extension cannot know the child's identity (the
  runner hosts several children in one process and sets only
  `PI_SUBAGENT_CHILD`), so the child's PreToolUse scenario selects neither
  field. The extension also runs `SessionStart` hooks in a child, where the
  upstream docs name only `SubagentStart` for a subagent's start; the phase
  leaves that unpinned. Both belong to the hook phases.
- **P16-DC-04 (Medium, open). Legacy-move scenario tagged
  `@own-implementation`.** The child step loads no companion, so the child
  runs Pi's built-in MCP under both profiles; the scenario chooses its
  implementation itself and runs once, under the adapter profile, instead of
  carrying `@mcp` and running the same child twice (D-BG-1603).
- **P16-DC-05 (Low, open). GSD manager projection ignored.** `gsd-tools query
  init.manager` reported Phase 16 as executed, with six plans, six summaries,
  and a stale verification, while no phase directory existed and `init.phase-op
  16` reported no context and no plans. The run followed `init.phase-op` and
  the disk.
- **P16-DC-06 (Low, open). Commit 4e3d127c carries another phase's
  message.** The context commit holds this phase's CONTEXT.md and this log, but
  its message reads "docs(planning): record the prune coverage context": the
  child sessions share one scratchpad directory, and another session rewrote
  the generic message file between its write and the commit. History is not
  rewritten (no amend, no rebase). Later commit messages live in a
  phase-specific subdirectory.

## Planning step

- **P16-DC-07 (Low, open). Research ran although the roadmap says "Research
  flag: no".** With `workflow.research` and Nyquist validation on, planning
  without RESEARCH.md leaves no VALIDATION.md, and the only ways around it are
  a question to the user or a `config-set`, which the brief forbids. The
  researcher got the discuss step's probe results so that it only filled the
  open tables and the validation map.
- **P16-DC-08 (Low, open). Red proofs run in a scratch copy.** The
  researcher ran each mutation in an untracked scratch copy of the tree with
  `node_modules` linked, not in the worktree, because it was told to edit no
  tracked file (researcher P16-R-01).
- **P16-DC-09 (Medium, open). A second mutation for the hook red proof.** A
  child load that discovers no resources leaves the PreToolUse scenario green,
  because the hooks bridge registers at factory time and hydrates again at
  `session_start`. Its red proof also skips the hooks bridge in a child
  (`index.ts`), so the scenario proves that hooks run in a child, not that the
  load rebuilds the routing (researcher P16-R-02).
- **P16-DC-10 (Low, open). One plan, one wave.** The four scenarios share one
  feature file, so they form one plan in one wave, which needs one full wave
  gate before the phase gate (researcher P16-R-03).
- **P16-DC-11 (Low, open). Pattern mapper skipped.** The research already
  holds the exact scenario text and every step's source, and the phase adds no
  new code file to map.
