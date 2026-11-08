# Phase 14 (Bootstrap): Dubious Choices

The choices Phase 14 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 14.
Only the Phase 14 child session writes this file: it copies each item from
the report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 14's.

## Discuss step

The autonomous run took the recommended option at every discuss question. Those answers are the decisions D-BG-1401 to D-BG-1410 in 14-CONTEXT.md, so this log does not repeat them, except for the three that a reviewer may want to reverse.

- **P14-DC-01 (Medium, open). No terminal scenario for the lock-held failure (D-BG-1404).** Criterion 2 compares the terminal with json and RPC. The lock-held notice wraps its cause line at the real sandbox path, and that path's length depends on the host's temporary directory. So only the added and refused outcomes are compared in the terminal. The lock-held outcome is compared over RPC and in json mode.
- **P14-DC-02 (Medium, open). The lock-held row names the source, not the marketplace (D-BG-1406).** The failed row reads `anthropics/claude-plugins-official` where the manifest name is `claude-plugins-official`. This is `marketplace add`'s row for a GitHub source it could not add, and MOD-01 makes it bootstrap's contract. The existing 404 scenario pins the same shape. The phase pins it and does not change it.
- **P14-DC-03 (Low, open). No verb module (D-BG-1408).** The ownership table lists a NEW `plugin/bootstrap.steps.ts` for Phase 14. Every step that the scenarios need already exists, so the module is created only if planning or execution finds a missing step.
- **P14-DC-04 (Low, open). Commit message clobbered in the shared scratchpad.** The commit that recorded 14-CONTEXT.md and this log is titled `docs(planning): record the legacy mcp move discussion`, which is a sibling session's message. The message file was written to the scratchpad directory that the fifteen child sessions share, and a sibling overwrote it before `git commit -F` read it. No amend is allowed, so the title stays wrong. Later commits use a private `scratchpad/p14/` directory.

## Planning step

- **P14-DC-05 (Low, open). Research and pattern mapping skipped.** The workflow recommends research and a pattern map. The roadmap says "Research flag: no", and the discuss step measured today's behavior with a probe feature, so the planner worked from CONTEXT and the probe alone. There is no VALIDATION.md, so Nyquist dimension 8 does not apply.
- **P14-DC-06 (Medium, open). Red proof for the refusal outline runs the add before the checks.** CONTEXT's mutation lets a refused flag through to the add. That add emits a second result, so the fields step fails first and the four new "changes nothing" steps never run. The plan's mutation instead runs the add silently before the argument checks, so the new steps are the ones that fail (planner).
- **P14-DC-07 (Low, open). Wider checks in the json and terminal scenarios.** The json and terminal refusals carry all four "changes nothing" checks. The json lock-held scenario also checks that there is no marketplace checkout and no git clone. Each publishes the official marketplace first, so the checks can fail (planner).
- **P14-DC-08 (Low, open). Outline title and scenario layout.** The outline becomes "Bootstrap rejects <rejected> with its usage and changes nothing". The lock-held scenarios use `the command reports these results:` and come after the 404 scenario. The json and terminal refusals go at the end. The feature description gains one sentence about the lock-holder helper (planner).
- **P14-DC-09 (Low, open). CONTEXT names the wrong step modules.** `holds no git clones` is in `plugin/installation.steps.ts`, and `holds no marketplace checkout` is in `marketplace/checkout.steps.ts`. Neither is in `scope-state.steps.ts`. The plan names the real modules, and D-BG-1408 still holds (planner).
- **P14-DC-10 (Low, open). Attribution trailer.** The plan checker noted that the brief's trailer names `Claude Opus 5.5`, while a reminder it saw named another model. The plan keeps the trailer that the parent's brief prescribes.

## Execution

- **P14-DC-11 (Medium, open). The plan ran inline, not in a gsd-executor subagent.** The agent isolation guard (`.claude/hooks/gsd-agent-isolation-guard.js`) reads `.gsd/dispatch-isolation-sentinel.json` under the hook's cwd. That cwd is the session's checkout, the parent `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps`, not this worktree. So the forced `none` sentinel in the phase worktree did not apply, and the guard refused the dispatch as `harness-worktree`. Two other routes were refused. Writing the sentinel into the parent checkout breaks the "never touch the parent" rule. A harness worktree would branch from the parent's HEAD and have no `node_modules`. The orchestrator therefore took the workflow's documented "switch to inline execution" path. Parent line: the brief's sentinel step does not work for a child whose session cwd is the parent checkout.
- **P14-DC-12 (Low, open). The pgrep check matches itself.** The plan's `pgrep -af .../state-lock-holder` check found only its own invoking shell, because the pattern is in that shell's command line. The check was read as "no helper process left".
