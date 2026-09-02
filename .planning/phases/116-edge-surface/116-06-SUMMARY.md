---
phase: 116-edge-surface
plan: "06"
subsystem: testing
tags: [node-test, coverage, edge, flag-catalog, cli-flags]

requires:
  - phase: 116-edge-surface
    provides: "116-00's pinned tests/helpers/notification-boundary.ts (unused by this pair, which needs no context)"
provides:
  - "tests/edge/flag-catalog.test.ts — the sole mirrored direct owner for edge/flag-catalog.ts, closing one of the phase's seven correspondence-gate violations"
  - "edge/flag-catalog.ts with FlagEntry.description required and the unreachable optional-description branch removed"
affects: [116-05, 116-20, 117]

actuals:
  tokens: 1500
  tasks: 1
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Transformation-not-data owner: when an architecture gate already pins a data table exactly, the mirrored pair owns the derivation shape (filter, order, key presence, exclusion) and states no claim about the table's contents"
    - "Compile-time guarantee replacing an unreachable runtime branch: tighten the private type so the branch's precondition cannot be constructed, then delete the branch, rather than adding a coverage exception"

key-files:
  created:
    - tests/edge/flag-catalog.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - .planning/phases/116-edge-surface/116-06-PLAN.md

key-decisions:
  - "The optional-description ternary in completionFlagEntries was unreachable through the module exports; FlagEntry.description became required and the branch was deleted, per the pair rule's remove-dead-code remedy rather than a coverage exception"
  - "completionFlagEntries keeps its exported return type { name: string; description?: string }[]; narrowing it would have been an exported signature change, which no plan in this phase makes"
  - "Two cases name SCOPE_TARGET_FLAG in their expectation rather than the literal --local, because writing the literal would restate flag-catalog-drift.test.ts's exact uninstall pin (D-116-12 outranks the hand-literal criterion where the promise is an identity relation between two exports)"
  - "The equal-comparing-entries claim has no distinct-pair target in the catalog data; it is discharged on the complete axis across the five list entries, proven by a .toReversed() plant"

patterns-established:
  - "Whole-array unsorted comparison as an order proof: pick the one verb whose declaration order differs from its sorted order (list), because a verb whose orders coincide (install, update) cannot redden a sort plant"
  - "Compile-time plant: remove a required field from a fixture and assert tsc rejects it (TS2741), the type-level counterpart to a runtime plant"

requirements-completed: []

coverage:
  - id: D1
    description: "tests/edge/flag-catalog.test.ts owns the four derivations edge/flag-catalog.ts exports, proving the transformation rather than re-pinning the per-verb flag data"
    requirement: MOD-09
    verification:
      - kind: unit
        ref: "tests/edge/flag-catalog.test.ts (23 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/flag-catalog.ts"
        status: pass
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs (14 -> 13 violations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The unreachable optional-description branch in completionFlagEntries is removed, and a completable entry without a description can no longer be constructed"
    requirement: MOD-09
    verification:
      - kind: other
        ref: "npm run typecheck rejects a complete:true entry with no description (TS2741)"
        status: pass
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts (4 cases)"
        status: pass
      - kind: unit
        ref: "npm test (4884 pass) and npm run test:integration (31 pass)"
        status: pass
    human_judgment: false

duration: 65min
completed: 2026-09-02
status: complete
---

# Phase 116 Plan 06: Flag Catalog Owner Summary

**A transformation-shaped owner for `edge/flag-catalog.ts` that proves the filter, the order, the fresh parse-set and the scope-target exclusion without restating the per-verb flag data the drift gate already pins — and the deletion of an optional-description branch no export could reach.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 1
- **Files modified:** 3 (1 test created, 1 production source, 1 plan amended)

## Accomplishments

- Wrote `tests/edge/flag-catalog.test.ts`: 23 cases across 10 bodies, owning `isCatalogVerb`, `CATALOG_VERBS`, `completionFlagEntries`, `parseFlagNames`, `passThroughFlagNames` and `SCOPE_TARGET_FLAG`. The correspondence gate dropped from 14 violations to 13; `missing-test: tests/edge/flag-catalog.test.ts` is gone.
- Found and removed an unreachable branch in `completionFlagEntries`, which had held the pair at 11/12 branches. The pair now measures **100 percent** functions, lines and branches.
- Ran six plants. All six went RED. All six were reverted and the reverts verified.
- Corrected three directions in the plan that the findings exposed as stale, under operator authorization.

## Task Commits

1. **Task 1 (test):** `623f2c0f` — `test(116-06): add the flag-catalog derivation owner`
2. **Task 1 (production):** `3968a30b` — `refactor(116-06): drop an unreachable branch from completionFlagEntries`
3. **Plan amendment:** `f66a37f4` — `docs(116-06): authorize the flag-catalog production edit`

## Files Created/Modified

- `tests/edge/flag-catalog.test.ts` — new. The sole mirrored owner for `edge/flag-catalog.ts`.
- `extensions/pi-claude-marketplace/edge/flag-catalog.ts` — `FlagEntry.description` made required, the scope-target entry given a description, the ternary in `completionFlagEntries` reduced to a plain map.
- `.planning/phases/116-edge-surface/116-06-PLAN.md` — production edit authorized and recorded; three stale directions corrected.

## The production change

### What was removed

```ts
export function completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[] {
  return CATALOG[verb]
    .filter((f) => f.complete)
    .map((f) =>
      f.description === undefined ? { name: f.name } : { name: f.name, description: f.description },
    );
}
```

replaced by:

```ts
export function completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[] {
  return CATALOG[verb]
    .filter((f) => f.complete)
    .map((f) => ({ name: f.name, description: f.description }));
}
```

with `readonly description?: string` on the module-private `FlagEntry` becoming `readonly description: string`, and `NON_COMPLETED_SCOPE_TARGET` gaining `description: "Record the declaration in claude-plugins.local.json (WB-01)"`.

### Why the branch was unreachable

The first ternary arm runs only for an entry that survives `.filter((f) => f.complete)` **and** has no `description`. No such entry existed. Every completable entry declares a description — `install` (`--map-model`, `--partial`), `update` (the same two), `list` (all five), `info` (`--fetch`). The only description-less entry was the shared `NON_COMPLETED_SCOPE_TARGET`, which carries `complete: false` and is filtered out before the map callback ever sees it. `uninstall`, `reinstall`, `enable` and `disable` declare that entry alone, so `completionFlagEntries` returns `[]` for them and the callback does not run at all.

This was measured, not inferred. The lcov branch record isolated one 0-hit range (`BRDA:167,5,0,0`, `BRF:12 BRH:11`), and a probe that removed `description` from `list`'s `--remote` entry produced `{ name: '--remote' }` in the assertion diff — the arm executing — confirming the diagnosis before any edit.

### Why this shape, not another

Making `description` required removes the branch without touching any exported signature: `completionFlagEntries` still declares `{ name: string; description?: string }[]`, and a value that always carries a `description` satisfies that type. `FlagEntry` is module-private and referenced nowhere outside `flag-catalog.ts`, so the tightening is invisible to every consumer. Narrowing the return type to a required `description` would have been an exported signature change, which no plan in this phase makes.

The runtime branch is replaced by a compile-time guarantee that is strictly stronger: a completable entry without a description is no longer merely absent from the data, it cannot be written.

## Plants

Six plants, all RED, all reverted. The pinned files were verified clean with `git diff --quiet` after every revert.

**Plant 1 — sort `completionFlagEntries` by name** (`.toSorted((a, b) => a.name.localeCompare(b.name))`). RED on the declaration-order case.

```
✖ completionFlagEntries returns the completable entries in catalog declaration order
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  -     description: 'Show installed plugins',
  -     name: '--installed'
  -   },
  -   {
        description: 'Show available plugins',
        name: '--available'
```

`list` is the only verb that discriminates this plant. Its declared order (`--installed, --available, --unavailable, --partial, --remote`) differs from its sorted order; `install` and `update` declare `--map-model, --partial`, which is already alphabetical, so a case built on them would have stayed GREEN. The case uses `list` for exactly that reason.

**Plant 2 — weaken the scope-target exclusion** (`f.parse && f.name !== SCOPE_TARGET_FLAG` becomes `f.parse`). RED on **both** pass-through cases, giving two independent catches.

```
✖ passThroughFlagNames leaves nothing for a verb whose only parse-accepted flag is the scope target
  actual: [ '--local' ], expected: []
✖ passThroughFlagNames keeps the remaining parse-accepted flags in catalog declaration order
  actual: [ '--map-model', '--partial', '--local' ], expected: [ '--map-model', '--partial' ]
```

**Plant 3 — reverse the filtered entries** (`.toReversed()`). RED on the order case. This is the stability plant: it proves the whole-array comparison catches a reordering among entries that compare equal on `complete`, the only field the derivation inspects.

**Plant 4 — prototype-chain membership** (`Object.hasOwn(CATALOG, value)` becomes `value in CATALOG`). RED on both inherited-name rows (`toString`, `constructor`). The unknown-word row stayed GREEN, which identifies those two rows as the discriminating ones for the own-key claim.

**Plant 5 — memoize the parse-set** (a module-level `Map` cache returning the same `Set` on every call). RED on the freshness case. This behavior is load-bearing: `flag-catalog-drift.test.ts:107` calls `catalogListParse.delete("--local")` on the returned set.

**Plant 6 — a completable entry with no description** (removing `description` from `list`'s `--remote` entry). This is the compile-time plant that replaces the deleted runtime branch. `npm run typecheck` exits 2:

```
extensions/pi-claude-marketplace/edge/flag-catalog.ts(127,5): error TS2741: Property 'description'
is missing in type '{ name: string; parse: true; complete: true; }' but required in type 'FlagEntry'.
```

Plants 1, 2 and 3 were re-run against the edited source after the production change and reddened identically; plant 1 and 3 target the function whose body changed, so the re-run was not optional.

## Findings

### 1. The plan's `must_haves` truth 1 had no mechanism

It promised that `completionFlagEntries` omits the `description` key "entirely when it does not [declare one]". Nothing in the catalog could produce that outcome, so the promise had neither a target nor, after the branch was deleted, a mechanism. Rewritten to state what is now true and enforced: every returned entry carries both `name` and `description`, and `FlagEntry` makes a description-less completable entry impossible to construct.

### 2. The direction to prove key omission through `uninstall` was wrong

`uninstall`'s only entry is the scope-target flag with `complete: false`. `completionFlagEntries("uninstall")` returns `[]` and never reaches the map callback, so the verb could not have proven anything about the description key. `uninstall` is still used in this owner, for what it can actually discriminate: the completable filter dropping a parse-accepted entry, and the pass-through list emptying for a verb that parses only the scope-target flag. The stale direction was removed from the committed plan rather than left to mislead a later reader.

### 3. The equal-comparing-entries claim had no distinct-pair target

`must_haves` truth 4 asked for two entries carrying the same description text. Checking all twelve verbs, **no two entries within any single verb share a description**. Rather than substitute a case that proves nothing, the claim is discharged on the axis that does exist: all five surviving `list` entries compare equal on `complete`, and the case asserts the whole five-element array unsorted. Plant 3 is the proof that this comparison catches a reordering among equal-comparing entries.

## Decisions Made

**`SCOPE_TARGET_FLAG` over the literal `"--local"` in two expectations.** The plan's acceptance criteria forbid an expectation that re-reads a constant off the module under test; D-116-12 forbids restating what a gate already enforces. Here they conflict: writing `"--local"` would reproduce `flag-catalog-drift.test.ts`'s exact `uninstall: ["--local"]` pin. D-116-12 wins, because in those two cases the promise **is** the identity relation between two exports — "the name `passThroughFlagNames` drops is the one `SCOPE_TARGET_FLAG` holds". The relation is not circular: `parseFlagNames` never reads `SCOPE_TARGET_FLAG`, and plant 2 proves the assertions still discriminate. The file header records the reasoning inline. Ratified by the operator.

**No exhaustiveness claim.** `flag-catalog.ts` contains no `switch` and no closed-union dispatch, so a missing-arm plant has no target here. Recorded as absent rather than substituted with a case that proves nothing.

**What this owner deliberately does not assert.** No case pins a verb's parse-set or completion-label *set*, and no case enumerates the catalog's key set to catch an added verb — `flag-catalog-drift.test.ts` holds all three, reconciled against the handlers and the completion provider. The flag names that do appear in expectations carry information the drift gate does not hold: declaration **order** (the drift gate compares sorted, on both sides) and the pass-through **exclusion**. `BOOLEAN_FLAGS` in `plugin/list.ts` was not touched, referenced, or restructured; it remains an observation for Phase 117.

## Deviations from Plan

### 1. [Rule 4 - Architectural] Production edit to `edge/flag-catalog.ts`

- **Found during:** Task 1, at the direct-coverage measurement.
- **Issue:** The pair could not reach 100 percent branches. The plan pinned `flag-catalog.ts` against modification and the phase rules reserved production edits to plan 116-27.
- **Resolution:** Halted and surfaced a decision checkpoint with three costed options rather than editing production under a pin. The operator chose Option A (make `description` required; leave the exported return type alone) and authorized this plan as the second permitted to touch production.
- **Files modified:** `extensions/pi-claude-marketplace/edge/flag-catalog.ts`, `.planning/phases/116-edge-surface/116-06-PLAN.md`
- **Verification:** direct coverage 100 percent; `npm test` 4884 pass; `npm run test:integration` 31 pass; drift gate 4 pass; plant 6 confirms the compile-time replacement.
- **Committed in:** `3968a30b` (production), `f66a37f4` (plan)

---

**Total deviations:** 1 escalated to the operator and approved (Rule 4). 0 auto-fixed.
**Impact on plan:** The escalation was the correct route — the alternative was a coverage exception the pair rule forbids, or a silent production edit under an explicit pin. No scope creep: the edit is four lines of behavior plus comments, and no exported signature changed.

## Issues Encountered

**`npm run check` is unusable in this checkout** and was not run. Its `format:check` link fails on pre-existing untracked operator files and short-circuits before `test`. Every gate was run separately with its exit code checked:

| Gate | Result |
|------|--------|
| `node --test tests/edge/flag-catalog.test.ts` | 23 pass, 0 fail |
| `npm run test:coverage:direct` (this pair) | **branches 11/11, functions 10/10, lines 190/190** |
| `npm test` | 4884 pass, 0 fail, 274 suites |
| `npm run test:integration` | 31 pass, 0 fail |
| `node --test tests/architecture/flag-catalog-drift.test.ts` | 4 pass, 0 fail |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run fallow` | 0 (exit code, not the `✗` summary text) |
| `npm exec -- prettier --check` (both files) | 0 |
| anti-pattern scan | no matches |
| `// arrange` / `// act` / `// assert` | 10 / 10 / 10, equal to the case-body count |
| `git diff --check` | clean |
| `git diff --quiet` on the three `shared.ts` helpers and the boundary helper | clean |
| `node scripts/check-corresponding-tests.mjs` | 14 → 13 violations |
| trufflehog filesystem scan (per file, byte count checked) | `verified_secrets: 0, unverified_secrets: 0` |
| `SKIP=trufflehog,npm-format-check pre-commit run --files` | 0 on all three commits |

The full unit and integration suites were re-run after the production change specifically because `flag-catalog.ts` feeds the completion provider and `flag-catalog-drift.test.ts`; a required-field change could have rippled. It did not.

## Known Stubs

None.

## Next Steps

Ready for the next plan in Phase 116. Two notes for later plans:

- **Other plans still pin `flag-catalog.ts`** with `git diff --quiet`. That pin compares the working tree against HEAD, so it still passes now that this change is committed. No other plan needs amending.
- **The order-proof recipe generalizes.** When proving that a derivation preserves declaration order, pick the input whose declared order differs from its sorted order. `116-05` (`completions/provider`) and `116-20` face the same catalog and the same trap.

## Self-Check: PASSED

- `tests/edge/flag-catalog.test.ts` exists on disk.
- `.planning/phases/116-edge-surface/116-06-SUMMARY.md` exists on disk.
- All four commits resolve in `git log`: `623f2c0f`, `3968a30b`, `f66a37f4`, `3ccd77ec`.
- `git diff --quiet` is clean for the three `shared.ts` helpers and `tests/helpers/notification-boundary.ts`; the boundary helper carries no change across the whole plan.
