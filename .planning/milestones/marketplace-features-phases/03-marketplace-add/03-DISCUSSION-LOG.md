# Phase 3: Marketplace Add - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 03-marketplace-add
**Areas discussed:** Duplicate-name variants, Failure-input spellings, --local round trip, Both-scope independence

---

## Duplicate-name variants

| Option | Description | Selected |
|--------|-------------|----------|
| Both, one Outline | Rows for the same source added twice and for another source whose manifest declares the same name, each with dir and @url rows | ✓ |
| Same source twice only | The simplest setup, but it also passes a check that compares sources | |
| Other source, same name only | The stronger variant on its own; it does not pin a plain re-add | |

**User's choice:** Both, one Outline

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via claude-plugins.json | The scope's config still declares the original source; this catches a duplicate that overwrites | ✓ |
| Failed row only | Misses an overwrite that still reports the error | |

**User's choice:** Yes, via claude-plugins.json

---

## Failure-input spellings

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute directory | `{home}/marketplaces/missing`, the baseline | ✓ |
| ~/ form | `~/marketplaces/missing`, the row that proves "as typed" | ✓ |
| Missing file path | The file kind's spelling of the same failure | ✓ |
| Directory with no manifest | An existing directory with no manifest; source missing from a different branch | ✓ |

**User's choice:** all four (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Both problems × dir, file, @url | One Outline with a `<manifest problem>` column: 4 local rows and 2 @url rows | ✓ |
| Both problems × dir, @url | Exactly the kinds ADD-07 names | |
| Schema-invalid only | Reuse today's fixture; malformed JSON goes untested | |

**User's choice:** Both problems × dir, file, @url

| Option | Description | Selected |
|--------|-------------|----------|
| Failed row only | The failures throw before any write; the row check catches the wrong reason or the wrong name | ✓ |
| Also a follow-up list | A second When runs list and a Then expects none | |

**User's choice:** Failed row only

---

## --local round trip

Research shown before the questions: reading the code turned up a possible leak. The first-run migration checks only the base file, so a scope whose first add used `--local` gets the local-only marketplace written into `claude-plugins.json` on the next load, and after that `remove --local` does not survive a reload.

| Option | Description | Selected |
|--------|-------------|----------|
| remove.feature, created now | Phase 3 creates it with one scenario and Phase 4 extends it | ✓ |
| add.feature | Stays in Phase 3's file but breaks the one-function-per-feature rule | |
| Hand it to Phase 4 | Moves half of ADD-13 and changes the traceability | |

**User's choice:** remove.feature, created now

| Option | Description | Selected |
|--------|-------------|----------|
| Seed a base entry first | Base declares only the first marketplace and local only the new one; uses existing steps | ✓ |
| Pristine scope, base absent | Needs a new "does not exist" read step | |

**User's choice:** Seed a base entry first

| Option | Description | Selected |
|--------|-------------|----------|
| Backlog it, confirm in research (recommended) | Record it, probe it in research, decide the fix later | |
| Insert a fix phase | A phase 3.1 that writes the scenario first, then fixes it, under a new requirement | ✓ |
| Pin today's behavior | A scenario that expects the leak | |

**User's choice:** Insert a fix phase (against the recommendation)

---

## Both-scope independence

| Option | Description | Selected |
|--------|-------------|----------|
| Add succeeds, both scopes declare | Uses existing steps; shows the other scope is no duplicate and the first entry is unchanged | ✓ |
| Plus a follow-up list | Overlaps LS-02 (Phase 4) | |
| Plus remove one, keep other | Crosses into RM-08 (Phase 4) | |

**User's choice:** Add succeeds, both scopes declare

| Option | Description | Selected |
|--------|-------------|----------|
| Every kind, one Outline | dir, file, @url, @github; git kinds clone a second time into the other scope | ✓ |
| dir only | The research proposal (MF-ADD-05) | |

**User's choice:** Every kind, one Outline

---

## Claude's Discretion

- The ADD-02 shape (a single dir scenario), the step wording, the new fixture modes, how `remove --local` shows the cleared entry, which scope the `--local` scenarios use, and any tightening of the Phase 1 seeds.

## Deferred Ideas

- Phase 3.1: the `--local` leak, fixed test-first under FIX-02.
- Phase 4: check what `remove` without `--local` does to a marketplace declared only in the local file.
- Todo `2026-10-13-cucumber-rules-trial` §3: not folded (another repository).
