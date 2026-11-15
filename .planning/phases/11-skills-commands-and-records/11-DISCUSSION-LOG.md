# Phase 11: Skills, Commands, and Records - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-11-15
**Phase:** 11-skills-commands-and-records
**Areas discussed:** Command name alias (decision 13), `@file` attachment (spike S8), alias suggestions, records
**Mode:** autonomous discuss (`--auto`). The user told this run to proceed without asking and to take the reversible upstream-parity default. Decision 13 and the three S8 divergences are marked **pending maintainer review**. No todo matched the phase. Spike S8 ran from the 2.1.323 binary and the docs only; no live Claude Code session ran.

---

## Command name alias (PG-CMD-09, decision 13)

| Option | Description | Selected |
|--------|-------------|----------|
| Add the Claude Code name as an alias | Parity; Pi listing name keeps D-141-01; amends D-141-01 | ✓ |
| Keep D-141-01 as is | PG-CMD-09 moves to Out of Scope | |

**Choice:** add the alias (D-PG11-01). **Pending maintainer review.**
**Notes:** upstream `asana/commands/asana-setup.md` is `/asana:asana-setup` (skills report CMD-09; DOCS plugins-reference). Windows colon form included. Existing alias claim rules decide collisions.

## `@file` attachment (PG-SKILL-01, spike S8)

| Option | Description | Selected |
|--------|-------------|----------|
| Author-written mentions only, skip code (locked requirement) | Diverges from 2.1.323 on arguments, `!` output, and code | ✓ |
| Scan the rendered text (parity) | Attaches argument and `!` paths and code mentions; contradicts criteria 1 and 2 | |

**Choice:** the locked requirement (D-PG11-02, D-PG11-03). **Pending maintainer review.**
**Notes:** S8 found that Claude Code 2.1.323 runs its mention pass over the content after argument substitution and `!` output, with no Markdown awareness, and gates each path on its Read deny rules. D-PG11-02 is licensed by a Pi gap (no permission gate; the attachment bypasses `PreToolUse` on `Read`). D-PG11-03 has no Pi gap; it is a recorded choice, and the maintainer may prefer parity.
Sub-choices taken autonomously (reversible): upstream mention syntax with `#L` ranges (D-PG11-04); Pi's `<file>` form appended after the body (D-PG11-05); regular text file up to 262,144 bytes, 2,000-line cut, symbolic links followed, anything else silently left as text, directory not attached (D-PG11-06, the directory part pending review); typed invocations only (D-PG11-07).

## Alias suggestions (PG-SKILL-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Pi's native format `hint — description` from the target | Matches how pi-tui shows a native command | ✓ |
| Description only | Loses the skill `argument-hint`, which the requirement names | |

**Choice:** the first (D-PG11-09). The colon trigger stays.

## Records (PG-DOC-01, PG-DOC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Correct the eight rows as the PRD states them; mark run-only claims unmeasured; compatibility page last with scenario-cited rows only | Requirement text | ✓ |

**Choice:** D-PG11-10 to D-PG11-12. S8 Q5 settles the `PATH` row: Claude Code gives plugin `bin` to the Bash and PowerShell tools only, not to hooks or MCP servers.

## Claude's Discretion

Storage of the Claude Code command name at stage; the text test; truncation note wording; module placement; scenario wording; plan splits.

## Deferred Ideas

Attaching on the model paths; directory, image, and PDF mentions; bash-only plugin `bin` (N5); alias suggestions before `:`; the stale records no requirement owns; the other S8 questions.
