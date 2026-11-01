---
phase: 04-agents
reviewed: 2026-11-01T18:32:57Z
depth: standard
iteration: 2
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/discover.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/lib/agent-files.ts
  - features/step_definitions/agent/listing.steps.ts
  - features/step_definitions/agent/runs.steps.ts
  - test/orchestrators/plugin/update-flow.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 4: Code Review Report (iteration 2)

**Reviewed:** 2026-11-01T18:32:57Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Scope: the source, harness, and test-support changes of phase 4, from
`faa94a2` to HEAD (`git diff --stat` over `extensions/`,
`features/step_definitions/agent/`, `features/lib/agent-files.ts`, `test/`).
The paired unit tests under `test/bridges/agents/` and `test/domain/name.test.ts`
were read for coverage of the findings below. The other `test/` edits are
one-line fixture updates for the new `skillSources` field and the 5.x model
IDs. Feature files and docs are covered by the gates, as the brief scopes.

The reviewer ran no subagent (none can be spawned in this session). The
review was done inline, and each finding was reproduced with a probe that calls
`convertAgent` directly (scratchpad `review/probe.ts`).

What was checked and holds:

- **Discovery walk (D-CF4-01).** `agentFilesIn` descends only into entries
  `readdir` reports as folders and reads only regular files, so a symlinked
  file or folder inside the tree is skipped (T-03-27). The 32-segment cap
  stops the recursion. A declared `.md` path is `lstat`ed, so a symlinked file
  is not followed. AG-12 ordering is fixed by the per-folder `localeCompare`
  sort. The flattened-name collision is a recorded choice (P4-DC-03 item 5,
  P4-DC-04 item 8).
- **Skill preloads (D-CF4-04).** `readSkillPreloads` reads only the rows the
  skills phase recorded. The skills bridge already refused a symlinked
  `SKILL.md` when it discovered the row, so the read cannot leave the plugin
  through a link. Both orchestrator call sites pass the rows of the same
  prepare pass (install: `c.stagedSkillRecords`; update: `handles.skills`),
  so an update reads the new source, not the staged copy. The enable branch
  and reinstall reach these two sites (`runInstallLedger`, the update runner).
- **Names.** `generatedAgentName` and `declaredAgentName` check each namespace
  segment and the joined name. Default `namespace = []` keeps every old caller
  byte-identical.
- **Frontmatter emit.** `advertise: true` and the optional `async:` line sit
  above the provenance mapping, and pi-subagents' top-level key regex reads
  them. The D-CF4-05 MCP exception returns `undefined`, which emits no line.
- **Harness.** `readAgentFileRows` refuses a table with no `file` or `body`
  column. `mergeUserSetting` restores the previous bytes, or removes a file it
  created, on release. `offeredToolNames` asserts the call exists.

## Iteration 2

This pass re-reviews the fix commit `ee1b1da` (iteration 1's WR-01) and looks
for regressions it introduced.

- **WR-01 (`Skill(spec)` entry): resolved.** `isSkillToken` compares
  `toolNameOf(token)` with `"Skill"`. All five former raw comparisons use it:
  the skip in `mapToolTokens`, both sides of the `inheritSkills` flag in
  `mapTools`, the skip and the flag in `omittedToolMapping`, and the AG-11
  note in `assertMappedToolsNonEmpty`. The probe now gives `tools: read`,
  `inheritSkills: true`, no dropped tool for `tools: Read, Skill(helper)`, and
  `inheritSkills: false` with no warning for `disallowedTools: Skill(helper)`.
- **Regressions: none found.** A bare `Skill` takes the same path as before
  (`toolNameOf("Skill")` is `"Skill"`). `tools: Skill(helper)` alone still
  refuses the install (AG-11); it now carries the Skill note, as `tools: Skill`
  does. `Skill(helper)` in an explicit list's `disallowedTools` still maps to
  no Pi name, so the explicit-list filter is unchanged. The three new unit
  cases and the new scenario `A Skill entry with a pattern grants or disallows
  the skills as the Skill tool does` pass; `features/agent/` passes (40
  scenarios). ESLint, `fallow health`, and `fallow dupes` are clean.

The iteration-1 Info findings stand unchanged below. They are outside the fix
scope (Critical and Warning only).

## Info

### IN-01: A full `claude-` model ID keeps a `[1m]` suffix, which an alias drops

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:313-315` (`fullModelId`)

**Issue:** With `--map-model`, `sonnet[1m]` maps to `anthropic/claude-sonnet-5-5`,
but `claude-opus-5-5[1m]` passes through as `anthropic/claude-opus-5-5[1m]`.
Upstream accepts the suffix on a full ID as well (the same one-million-token
selector). The bracketed name is not a Pi model ID, so a run fails with
`Unknown subagent model`. The decision text (D-CF4-07: "a full `claude-*` ID
passes through as `anthropic/<id>`") reads as the current behavior, so this is
a parity gap, not a defect against the plan.

**Fix:** Strip one trailing `[1m]` (case-insensitive) in `fullModelId` before
the pass-through, and record it against D-CF4-07.

### IN-02: The thinking-fallback warning quotes the raw `effort`, not the level it emits

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:604` (`mapThinking`)

**Issue:** `thinking: bogus` with `effort: " MED"` emits `thinking: medium` and
warns `using effort " MED" as fallback`. The warning names a value the bridge
did not write.

**Fix:** Quote `effort.emit` in the fallback warning.

### IN-03: An agent file named `.md`, or a folder whose name is not a safe name, now fails the whole install

**File:** `extensions/pi-claude-marketplace/bridges/agents/discover.ts:142-145` (`collectAgentFile`), `domain/name.ts` (namespace segment check)

**Issue:** Before D-CF4-01 the walk skipped dotfiles, so `agents/.md` was
ignored. Now it is read, its stem is empty, and `assertSafeName("")` throws,
which aborts the install of every component of the plugin. A namespace segment
that `assertSafeName` refuses (a control character in a folder name) does the
same. The same was already true for a flat file whose stem fails the check, so
this widens an existing behavior rather than adding a new one. Upstream's
handling of an empty agent name was not measured.

**Fix:** None proposed in this phase. If upstream skips such a file, skip it
with a discovery warning instead of throwing.

---

_Reviewed: 2026-11-01T18:32:57Z_
_Reviewer: Claude (gsd-code-reviewer role, run inline)_
_Depth: standard_
