---
phase: 96-installation-record-backed-plugin-info
reviewed: 2026-08-09T06:40:00Z
depth: standard
iteration: 3
files_reviewed: 8
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/list-manifest-absent.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 96: Code Review Report (iteration 3, final)

**Reviewed:** 2026-08-09
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Re-review of `5481c5ae^..HEAD` after the iteration-2 fix pass (six commits:
`4c563758`, `44b4c684`, `e9882eba`, `63508fec`, `5f4b718c`, `bbd20c78`).

All six fixes land and none of them regresses behavior. No BLOCKER-class defect
exists in this phase. What remains is one factual clause the WR-12 doc fix
itself introduced, plus one catalog-coverage gap for the byte form the WR-13
test newly pins.

### Fix verification

| ID | Verdict | Evidence |
| --- | --- | --- |
| WR-10 note-last ordering | FIXED, both paths agree | `info.ts:2350-2360` — the mixed path now notifies `disabledBlocks` and *then* calls `emitFetchSkip`, matching the all-disabled early return (`:2271-2278`, inventory then note). I walked the third path too: the single-scope arm (`:2295-2296`) notifies the info block then the note, so all three orderings are now subject-then-note. The move places `emitFetchSkip` above the `failedBlocks` loop, which preserves the pre-existing warning-before-error relative order (failures were already last). |
| WR-11 catalog "only warning" | FIXED | `output-catalog.md:1531` now reads "one of the two `warning`-severity states … the other is `disabled-fetch-skipped` below". Grepped every `warning` occurrence in the catalog (81 hits): no surviving uniqueness claim on this surface, and `:1445`'s two-state routing sentence agrees. |
| WR-12 module header | FIXED | `info.messaging.ts:36-40` now names both reasons (`not in manifest` / `already disabled`) and explicitly says the disabled arm has no `InfoBlock`. Matches `emitFetchSkip`'s two source arms exactly. |
| WR-12 catalog per-scope rule | FIXED with a new inaccuracy | `output-catalog.md:1546` restates the trigger as "at least one found scope" and splits the all-disabled and mixed cases. The all-disabled clause and the "inventory shows before this note" clause are both now true. One added clause is not — see WR-15. |
| WR-13 mixed test pinned | FIXED | `info-manifest-absent.test.ts:1043-1079` replaces `find()` with `assert.equal(notifications.length, 3)` plus whole-message equality at indices 0/1/2 and a severity assertion on each. This now matches the file-header convention and would fail on a duplicated note, a lost info block, or any reordering — including a WR-10 regression. |
| WR-14 test comment | FIXED | `info-manifest-absent.test.ts:1419-1423` describes the producer-reported `stateOnly: false` discriminant and states that nothing about the rendered row is consulted. `grep -rn isStateOnlyInfoBlock extensions/ tests/ docs/` returns nothing. |
| IN-01 skip-source list | FIXED, semantics preserved | `info.ts:2132-2199`. The scope-keyed `Map` is replaced by a flat `SkipSource[]` plus `scopes.flatMap`. I checked the output is byte-identical on every reachable input: `partitionDisabledScopes` (`:2075-2082`) puts each found scope in exactly one of `disabled` / `infoFound`, `found` holds at most one tuple per scope (`:2229-2238` iterates `scopes`), and `built` derives only from `infoFound` — so the source list has at most one entry per scope and `flatMap` reproduces the old `Map`-lookup order. The rejected-assert rationale in the commit message is correct: `getPluginInfo` has no classifying catch upstream (`edge/handlers/plugin/info.ts` → `edge/router.ts` are catch-free), so a throw would abort the read-only command. `SkipSource` cannot silently drift from `buildFetchSkipBlock`'s parameter object because the spread at `:2198` would stop type-checking. |

### Independent verification performed

- `npm run typecheck` — clean.
- `npm test` — 3303 pass / 0 fail / 1 skipped (3263 subtests), including the
  119 tests across `info.test.ts`, `info-manifest-absent.test.ts`,
  `list-manifest-absent.test.ts` and `catalog-uat.test.ts`.
- `pre-commit run --files <the four changed source/doc/test files>` — every hook
  passes (prettier, mdformat, markdownlint-cli2, npm lint, npm format check, npm
  typecheck). The only failure is the documented structural trufflehog
  worktree-mode abort described in `CLAUDE.md`, not a content finding.
- Comment-policy check: `git diff 4c563758^..HEAD` over `extensions/` and
  `tests/` adds no `Phase N` / `Plan N` / `Wave N` / `Pitfall N` / `milestone
  vX.Y` reference. The surviving "research Open Question 3" in
  `info.messaging.ts:19` is pre-existing and untouched by this phase.
- No debug artifacts introduced: `TODO` / `FIXME` / `XXX` / `HACK` /
  `console.log` / `debugger` all absent from the four changed files.
- `list.ts`'s only phase change is comment text (`:892-902`); no behavior.

Recorded deferrals honored — CR-01 (Phase 97 ENBL-05/06), the WR-06 cwd-threading
half, WR-04 case 2, the `:1445` shorthand-ids consistency item, the stale
`shared/notify.ts` comments (Phase 98 DOC-08), and the INFO-10 non-unification
carve-out are not re-reported.

## Warnings

### WR-15: The clause the WR-12 catalog fix added is false for the exact mixed case the suite pins

**File:** `docs/output-catalog.md:1546`

**Issue:** The rewritten `disabled-fetch-skipped` paragraph ends the mixed-run
case with:

> If only some of the found scopes are disabled, the note shows beside the info
> block of each other scope, whose probes do run.

The non-restrictive relative clause asserts that every non-disabled scope in a
mixed run does run probes. That is true only when the other scope is a
manifest-declared plugin. It is false for the other reachable shape, which is
the one the phase's own test exercises: in
`info-manifest-absent.test.ts:1015-1081` the project scope is disabled and the
user scope is a **state-only** record whose arm is network-free by signature
(`buildStateOnlyInstalledRow`, `info.ts:969-993` — the INFO-12 zero-call suite
at `:1096` exists precisely to prove no probe runs there).

Two consequences for a catalog reader, on the document this project treats as
the byte-level user contract:

1. The sentence teaches that a `{already disabled}` note beside a live info
   block implies the other scope was fetched. In the state-only mixed case
   nothing was fetched in *either* scope.
2. It omits the fact the sentence exists to introduce — that in that case the
   other scope contributes its **own** `{not in manifest}` row to the **same**
   notification. That combined two-row form is what the test pins.

**Fix:** Replace the clause with one that does not over-claim and that names the
combined shape:

```text
If only some of the found scopes are disabled, the note shows beside the info
block of each other scope. Those other scopes fetch only if their plugin has a
manifest entry; a scope whose record outlived its manifest entry fetches nothing
either, and adds its own `{not in manifest}` row to this same note.
```

## Info

### IN-02: The mixed skip note is the phase's newest byte form and has no catalog fixture, so the catalog-UAT gate never sees it

**File:** `docs/output-catalog.md:1548-1555` (missing state); pinned only at
`tests/orchestrators/plugin/info-manifest-absent.test.ts:1065-1079`

**Issue:** `catalog-uat.test.ts` drives the renderer for every
`<!-- catalog-state: STATE -->` annotation and compares it to the next fenced
block. Both skip states carry a fixture, and both show the **singular** form:

```text
A plugin operation needs attention.

● mp [user]
  ⊘ alpha v1.0.0 (skipped) {already disabled}
```

The mixed run emits a different notification: a **plural** summary
(`Some plugin operations need attention.`), two marketplace headers, and two
rows with two different reason tokens. `:1546` now describes that behavior in
prose ("one notification carries all of the rows in project-first scope order"),
but shows no example of it, so the byte form is guarded by one unit test and by
nothing in the catalog gate. This surface already catalogs its fan-out
compositions separately (`state-only-installed-both-scopes-fan-out`), so the
omission is a gap in the surface's own convention rather than a deliberate
carve-out.

**Fix:** Add a fenced state under the `disabled-fetch-skipped` section carrying
the literal the test already asserts:

```text
<!-- catalog-state: mixed-fetch-skipped -->

A plugin operations need attention.   <- use the plural form the renderer emits

● mp [project]
  ⊘ alpha v1.0.0 (skipped) {already disabled}

● mp [user]
  ⊘ alpha v2.0.0 (skipped) {not in manifest}
```

(Copy the exact bytes from `info-manifest-absent.test.ts:1068-1078`; the
`catalog-uat` driver will then hold them.)

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 3, final)_
