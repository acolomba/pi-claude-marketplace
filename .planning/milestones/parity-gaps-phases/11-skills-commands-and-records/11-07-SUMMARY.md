---
phase: 11-skills-commands-and-records
plan: "07"
subsystem: records
tags: [records, key-decisions, changelog, backlog, prd]
status: complete
requires: ["11-01", "11-02", "11-04", "11-05", "11-06"]
provides:
  - "Key Decisions rows D-PG11-01, D-PG11-02, D-PG11-03 and the D-PG11-01 amendment on D-141-01"
  - "the S8 Result cell of the PRD section 9 table"
  - "three CHANGELOG sub-bullets under the unreleased entry"
  - "BACKLOG note on EXPANSIONCMDNAME-01 and the new entry CMDNESTNAME-01"
affects: [".planning/PROJECT.md", "docs/prd/parity-gaps-prd.md", "CHANGELOG.md", ".planning/BACKLOG.md"]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - docs/prd/parity-gaps-prd.md
    - CHANGELOG.md
    - .planning/BACKLOG.md
decisions: []
requirements: ["PG-CMD-09", "PG-SKILL-01", "PG-SKILL-11"]
metrics:
  duration: "about 25 minutes"
  completed: 2026-11-15
actuals:
  tokens: 22000
  tasks: 2
  commits: 2
plan_head_before: 9d2692b6b1fa2f4527bbd4484befc022bc87db36
plan_head_after: b07af65c5d665d707ff03899f5a412557ca4ee34
---

# Phase 11 Plan 07: Records for the command alias and file mentions Summary

Three Key Decisions rows (the Claude Code command name as an alias, and two `@` mention
divergences), the D-141-01 amendment, the S8 spike result in the PRD, three CHANGELOG
sub-bullets, and two BACKLOG records, all written as pending maintainer review and as read in
the 2.1.323 binary, not run.

## Commits

| Task | Commit | Files |
| --- | --- | --- |
| 11-07-01 | 2a8b5354 `docs(planning): record the command alias and file mention decisions` | `.planning/PROJECT.md`, `docs/prd/parity-gaps-prd.md` |
| 11-07-02 | b07af65c `docs(changelog): describe the command alias and file attachment` | `CHANGELOG.md`, `.planning/BACKLOG.md` |

No build input changed: none of the four files matches the `npm-check` hook's `files:` pattern,
and the hook reported `(no files to check)` on both commits. No test ran (the plan runs none).

## Records changed

- `.planning/PROJECT.md`
  - Rows `D-PG11-01`, `D-PG11-02`, `D-PG11-03` appended after `D-PG10-25`. Each first cell opens
    `(parity-gaps, Phase 11, settled in the autonomous discussion of 2026-11-15, pending maintainer review; ...)`,
    names Claude Code 2.1.323 and Pi 1.5.0, and cites the scenarios from the 11-01, 11-04, and
    11-05 SUMMARYs. Second cell `See phases/11-skills-commands-and-records/11-CONTEXT.md.`, third
    cell `Pending maintainer review`.
  - D-PG11-01 says the naming premise was read in the 2.1.322 builder (skills report) and the
    plugins reference fetched 2026-11-15, with no session run, and that the row is recorded against
    2.1.323 and Pi 1.5.0.
  - D-PG11-02 calls the author-only rule a divergence licensed by a Pi capability gap; D-PG11-03
    calls the code skip a divergence with no Pi gap, licensed by the recorded decision alone, and
    states the maintainer's question. Neither row uses the word parity.
  - `D-141-01` Outcome cell: `-- Locked. Amended by D-PG11-01 (parity-gaps, Phase 11, pending maintainer review): the Claude Code name is added as an alias, and the listing name keeps the elision.`
  - Footer: `_Last updated: 2026-11-15 during parity-gaps Phase 11; Key Decisions gains D-PG11-01, D-PG11-02, and D-PG11-03, each pending maintainer review, and D-PG11-01 amends D-141-01._`
- `docs/prd/parity-gaps-prd.md`: the S8 Result cell opens
  `**Read 2026-11-15 in the Claude Code 2.1.323 binary and the plugins and skills documentation, with no session run.**`,
  gives the two answers, says the other four questions did not run, and points to
  `.planning/phases/11-skills-commands-and-records/11-SPIKE-S8.md`.
- `CHANGELOG.md`: the top line now names `commands`; three sub-bullets added at the end of the
  first `[Unreleased]` bullet (command alias with the `foo:foo-bar` example and the restage note,
  the alias suggestions with the argument hint, the `@` file attachment).
- `.planning/BACKLOG.md`: `Update 2026-11-15 (parity-gaps, Phase 11, D-PG11-01)` on
  `EXPANSIONCMDNAME-01`; new entry `## CMDNESTNAME-01: a frontmatter name on a nested command`,
  marked unverified (the ID was free).

## Deviations from Plan

1. **[Rule 1 - plan verify] The Task 2 check "at most one top-level `[Unreleased]` bullet" fails at the base.**
   The section already held three top-level bullets at 9d2692b6 (this branch's unnumbered bullet,
   `(#310)`, and `(#309)`), so `grep -c '^- '` gives 3 before and after. No top-level bullet was
   added; the intent of the check (keep one bullet for this branch) holds.
2. **[Rule 2 - accuracy] One sentence added to the S8 cell.** The spike record quotes the plugins
   reference on the root `SKILL.md` question as a side fact. The cell says the other four
   questions did not run, and adds that for the root `SKILL.md` question the record quotes only
   the plugins reference. Without it, the cell would hide a documentation answer the spike holds.

## Open for the maintainer

- D-PG11-01 (PRD decision 13): add Claude Code's command name as an alias; amends D-141-01.
- D-PG11-02: attach author-written mentions only; Claude Code 2.1.323 also attaches argument and
  `!` output paths (licensed by the missing Read permission gate in Pi).
- D-PG11-03: skip mentions in code; Claude Code 2.1.323 does not, and no Pi gap licenses it.
  Question: keep the skip, or follow Claude Code and change success criterion 2.
- D-PG11-06: a directory mention is not attached; Claude Code attaches an `ls` listing. It has no
  Key Decisions row of its own (D-PG11-14 names three rows); the compatibility page of plan 11-08
  states it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-11-24 is mitigated: each new row holds "pending maintainer review", its versions, and its
license; the two divergence rows hold the word divergence; the S8 cell says no session ran.

## Self-Check: PASSED

- FOUND: commits 2a8b5354 and b07af65c are ancestors of HEAD.
- FOUND: `grep -c '^| \*\*D-PG11-0[123] ' .planning/PROJECT.md` = 3; `Amended by D-PG11-01` present;
  `11-SPIKE-S8.md` in the PRD; `foo:foo-bar`, `argument hint`, `attach` in the CHANGELOG;
  `D-PG11-01` and `CMDNESTNAME-01` in the BACKLOG.
