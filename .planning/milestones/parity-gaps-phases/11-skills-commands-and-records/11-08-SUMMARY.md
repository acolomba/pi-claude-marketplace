---
phase: 11-skills-commands-and-records
plan: "08"
subsystem: docs
status: complete
tags: [docs, skills, commands, compatibility, PG-DOC-01]
requires: ["11-01", "11-02", "11-04", "11-05", "11-07"]
provides: ["docs/skills-commands-compatibility.md with a cited status table"]
affects: [README.md, README.es.md, CHANGELOG.md]
tech-stack:
  added: []
  patterns: ["status rows cite scenarios as features/<dir>/<file>.feature:<line>"]
key-files:
  created:
    - docs/skills-commands-compatibility.md
  modified:
    - README.md
    - README.es.md
    - CHANGELOG.md
decisions:
  - "The page cites D-PG4-01 and D-141-04 for the manifest skills row and D-CF2-10 item 6 for the zero-width space row, the IDs the sources carry."
  - "The upstream nested-command `name` reading (one 2.1.323 binary fragment) is stated as read, not run, in the name mapping section and listed as not proven."
requirements: [PG-DOC-01]
metrics:
  duration: 22m
  completed: 2026-11-15
estimate:
  tokens: 95000
  tasks: 3
actuals:
  tokens: 14900
  tasks: 3
  commits: 2
plan_head_before: 07a237cea909bb5757fceccff1f986c2567822ad
plan_head_after: 0a1f642d9768d1888f9714dbf24438a2560c6466
---

# Phase 11 Plan 08: Skill and Command Compatibility Page Summary

`docs/skills-commands-compatibility.md` compares Claude Code's plugin skills and commands with the
bridge in the register of the hooks page, states D-PG11-02, D-PG11-03, and the directory rule of
D-PG11-06 as differences with their reasons, and carries a 35-row status table whose every row
cites the scenario lines that prove it; both READMEs and the CHANGELOG link to it.

## Commits

| Task | Commit | Files |
| --- | --- | --- |
| 11-08-01 prose sections | 3cd0f607 | docs/skills-commands-compatibility.md |
| 11-08-02 status table, unproven list, links | 0a1f642d | docs/skills-commands-compatibility.md, README.md, README.es.md, CHANGELOG.md |
| 11-08-03 full gate | (no commit; evidence below) | -- |

## Page sections

Name mapping; Alias suggestions; Typed arguments and variables; Context commands; File mentions;
Frontmatter fields; The model's command tool; The skill-read fill; Status; Not proven by a
scenario; Deferred for engineering reasons; Further reading.

## Status table

- 35 rows, in the topic order of the skills report's "Current project behavior" table, with this
  phase's rows beside the rows they extend (alias suggestion text after the skill menu row; the
  Claude Code command alias after the frontmatter alias row; the two attachment exclusions after
  the attachment row).
- 132 citations (128 distinct), 35 lines of the file hold a citation.
- Citation check of Task 2 at 0a1f642d: exit 0 (every cited line starts with `Scenario` or
  `Scenario Outline`). Row check: 35 rows, none without a citation. Order check (a script over
  each proof cell): every cell is ordered by file, then by ascending line, with no duplicate.
- Acceptance reads: slash-command aliases:41 and :130, skill aliases:238 and :256, invocation
  features (command :336, :365, :390; skill :350, :375), frontmatter :12 and :62, frontmatter :139
  and :167, manifest-forms :730, and project-trust :27, :31, :41 were opened; each states its row.

## Left in the unproven list

The `.` separator on Windows; the 1,536-character description cap; a symbolic link as a skill
folder; a root `SKILL.md` with no declaration; a `SKILL.md` inside `commands/` (CMDSKILLMD-01); the
`plugin:skill` token rewrite (SKTK-01); a project command in an untrusted project; the unit-only
mention rules (size limit, 2,000-line cut, binary, directory, symbolic link, line range, quoted
form, CJK marks, `~`, relative path); no attachment on the two model paths; and the name a
frontmatter `name` gives a command in a subfolder.

## Full gate evidence

- Command: `npm run check > /tmp/pg11-wave8.log 2>&1; echo "exit=$?" >> /tmp/pg11-wave8.log`
  (background, not piped).
- Exit status: `exit=0`.
- Commit: 0a1f642d9768d1888f9714dbf24438a2560c6466, clean tree for `docs README.md README.es.md
  CHANGELOG.md extensions features test` before and after.
- Node: v26.13.1.
- Scope: the whole tree.
- Cucumber: adapter profile 2084 scenarios (2084 passed), 25772 steps; builtin profile 204
  scenarios (204 passed), 2762 steps. Direct coverage merged 374 records.
- The citation check was last run at 0a1f642d, the gate commit.

## Deviations from Plan

1. **[Rule 1 - lint] MD038 on a code span with a leading space.** The agent-mention sentence held
  `` ` (agent)` ``; markdownlint rejects it. It now reads "a quoted value that ends with a space and
  `(agent)`". Commit 3cd0f607.
2. **[Rule 2 - accuracy] Two decision IDs corrected before commit.** The manifest `skills` row first
  cited D-CF2-05 and the zero-width space row D-CF2-10 alone; the sources carry D-PG4-01 and
  D-141-04 (root-source entries; first copy wins with a warning) and `D-CF2-10 item 6`
  (`edge/input-transform.ts`). Commit 0a1f642d.
3. **[Rule 2 - honesty] Extra content beyond the plan's list.** The page adds the legend mark `--`
  (not stated by the sources read) for two rows with no upstream counterpart; one difference the
  spike records but the plan did not name (Claude Code tells the model a file over the size limit
  was not read, the bridge gives no notice); and Open Question 2 of the research (nested command
  `name`), marked read in one binary fragment and not run, also in the unproven list.

## Maintainer review items

- The page states D-PG11-01, D-PG11-02, D-PG11-03, and D-PG11-06 as written; all four are still
  pending maintainer review, and the page changes if any is reversed.
- The `UserPromptExpansion` `command_name` difference (Open Question 1) is stated on the page; no
  BACKLOG entry was written by this plan.
- The `SKFM-01` ID on the malformed frontmatter row comes from the skills report; it has no Key
  Decisions row in PROJECT.md.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: docs/skills-commands-compatibility.md
- FOUND: 3cd0f607 (ancestor of HEAD)
- FOUND: 0a1f642d (HEAD)
