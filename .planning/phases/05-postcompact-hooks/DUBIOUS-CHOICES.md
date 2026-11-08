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
</content>
</invoke>
