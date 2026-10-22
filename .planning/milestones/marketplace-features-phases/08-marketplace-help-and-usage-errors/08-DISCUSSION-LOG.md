# Phase 8: Marketplace Help and Usage Errors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 8-Marketplace Help and Usage Errors
**Areas discussed:** Help text and --local, Rejection coverage matrix, Empty required argument

---

## Help text and --local

Question 1: what should Phase 8 do about the marketplace help text omitting `[--local]`?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix to match verbs (Recommended) | Show `[--local]` on add, remove, autoupdate, noautoupdate as their usage lines do; test-first; catalog and byte count updated. | ✓ |
| Pin as is | Keep today's help text and pin it. | |

Question 2: guard against the drift recurring?

| Option | Description | Selected |
|--------|-------------|----------|
| One source per verb (Recommended) | Each verb's argument signature defined once; help line and `Usage:` line built from it. | ✓ |
| Scenarios only | Fix the text and pin both copies in scenarios. | |

**User's choice:** Fix to match verbs; one source per verb.
**Notes:** The same drift in the top-level `/claude:plugin help` (install/update/reinstall) was noted as deferred (plugin help, outside this phase).

---

## Rejection coverage matrix

Question 1: how broad should the rejection scenarios be?

| Option | Description | Selected |
|--------|-------------|----------|
| Every verb per kind (Recommended) | One Outline per rejection kind with a row for every verb that can produce it. | ✓ |
| One verb per code path | A representative verb per parser path per kind. | |
| One verb per kind | A single scenario per kind. | |

Question 2: how should `--scope` positions be covered?

| Option | Description | Selected |
|--------|-------------|----------|
| Positions per code path (Recommended) | Every verb gets bad- and missing-value rows; positions added for one verb of each parser path. | ✓ |
| Every verb × position | The full cross product. | |

**User's choice:** Every verb per kind; positions per code path.
**Notes:** The user declined the "more questions or next area" check prompt; the discussion moved on.

---

## Empty required argument

Question 1: what should an explicitly empty required argument report? The user asked for an explanation first ("explain this to me"); the orchestrator showed the three cases and the shared-parser reach, then re-asked.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'Missing required…' (Recommended) | Empty and omitted both report `Missing required argument.` | |
| Say 'must not be empty' | Report `Argument must not be empty.` like the optional case. | |

**User's choice (free text):** "this falls under input value validation — so “plugin. name must not be empty"

Question 2: which wording and reach?

| Option | Description | Selected |
|--------|-------------|----------|
| Named, all verbs (Recommended) | `<Field> must not be empty.` (`Source`, `Marketplace name`, `Plugin name`) for required and optional arguments in every verb sharing the parser; an omitted required argument keeps `Missing required argument.` | ✓ |
| Named, marketplace only | Same wording for marketplace verbs only; plugin verbs later. | |

**User's choice:** Named, all verbs.

---

## D-05 reach (after research)

Research found that install/info/update/fetch/reinstall reject `""` with their own `Invalid <plugin>@<marketplace> ref: "".` message (outside the shared parser), and plugin `list ""` is accepted.

| Option | Description | Selected |
|--------|-------------|----------|
| Every verb (Recommended) | Named empty-value messages everywhere, including those plugin verbs and plugin `list ""`. | ✓ |
| Shared parser only | Only the verbs using `parseCommandArgs` change. | |

**User's choice:** Every verb. Recorded as D-06.

---

## Claude's Discretion

- Alias rows (`rm`, `ls`) in the rejection Outlines.
- Pinning `--scope --local` and `help marketplace extra`.
- Outline titles, table layout, and plan split.

## Deferred Ideas

- Top-level `/claude:plugin help` drift on install/update/reinstall flags.
- Plugin `list`'s `Unknown option:` versus the marketplace verbs' `Unknown flag:`.
