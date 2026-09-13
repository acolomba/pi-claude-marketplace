---
phase: 01-live-evidence-revalidation
plan: 71
subsystem: evidence-tooling
tags: [complexity, refactor, quality-gate, revalidation]
status: complete
requires:
  - "scripts/revalidation.mjs validateScopeChangeStructure"
provides:
  - "Structural scope-row validator measured under both complexity engines with no suppression"
affects:
  - "npm run check (fallow health sub-gate)"
tech-stack:
  added: []
  patterns:
    - "Extract-helper split targeted at decision points rather than nesting, so cyclomatic drops without trading it for cognitive"
key-files:
  created: []
  modified:
    - scripts/revalidation.mjs
decisions:
  - "Pass isRequirement/isRoute into the contract-kind helper instead of recomputing them inside it, so the two id-shape branches stay unconditionally evaluated and direct branch coverage stays at 100%."
  - "Keep the mandatory-field disjunction in its original negative polarity inside the extracted helper, so operand-level branch reachability is identical to the pre-split expression."
metrics:
  duration: ~35m
  completed: 2026-09-12
actuals:
  tokens: 9000
  tasks: 2
  commits: 1
  plan_head_before: 6bc71dc4
---

# Phase 01 Plan 71: Split the structural scope-row validator under both complexity ceilings Summary

`validateScopeChangeStructure` was split into three functions so it measures under fallow's cyclomatic 20 and cognitive 15 ceilings on its own, and the `fallow-ignore-next-line complexity` marker that was holding `npm run check` green was deleted with no substitute suppression added anywhere.

## What Was Built

Two module-private helpers were extracted from `validateScopeChangeStructure` in `scripts/revalidation.mjs`:

- `validateScopeRowMandatoryFields(change, violations)` — owns the six-operand disjunction guarding `requirementId`, `action` and `rationale`, pushing the same `incomplete-scope-change` violation and returning a boolean. The disjunction keeps its original negative polarity, so each operand is reached under exactly the same conditions as before.
- `validateScopeContractKind(change, isRequirement, isRoute, violations)` — owns the two `requireContractKind`-gated checks (`invalid-scope-kind` and `invalid-scope-signature`). The caller still computes `isRequirement`/`isRoute` unconditionally and passes them in; recomputing them inside the helper would have made those two id-shape branches conditional on `requireContractKind` and stranded a branch the existing cases cannot enter.

Every violation `code`, `target` and `message` string is byte-identical. Push order is preserved even though both consumers sort before emitting.

## Measurement

Before (marker removed, function unsplit):

```
● High complexity functions (1)
  scripts/revalidation.mjs
    :1133 validateScopeChangeStructure
          22 ! cyclomatic   14   cognitive   69 lines
✗ 1 above threshold · 13132 analyzed · maintainability 91.8 (good)
```

After:

```
scripts/revalidation.mjs
  :1187 validateScopeChangeStructure       12 cyclomatic   10 cognitive   36 lines
  :1133 validateScopeRowMandatoryFields     7 cyclomatic    2 cognitive   21 lines
  :1157 validateScopeContractKind           6 cyclomatic    5 cognitive   29 lines

✓ 0 above threshold · 13134 analyzed · maintainability 91.8 (good)
```

`npx fallow health --fail-on-issues --format human` exits 0. The second, independently-computed engine agrees: `npx eslint scripts/revalidation.mjs` exits 0, so `sonarjs/cognitive-complexity` (threshold 15) and `sonarjs/no-identical-functions` (threshold 3) both pass — the two helpers have structurally distinct bodies.

`grep -n 'fallow-ignore\|eslint-disable\|thresholdOverrides' scripts/revalidation.mjs .fallowrc.json` returns nothing. `.fallowrc.json` still carries zero `health.thresholdOverrides` entries.

## Gate Evidence

`npm run check` — exit 0.

- Unit: `tests 6109 / pass 6109 / fail 0 / skipped 0 / todo 0`
- Integration: `tests 32 / pass 32 / fail 0 / skipped 0 / todo 0`

`node scripts/revalidation.mjs scope-impact --check` — exit 0:

```
Scope impact valid: 40 records.
```

`npm run test:coverage:direct -- scripts/revalidation.mjs` — exit 0:

```
ℹ  revalidation.mjs | 100.00 |   100.00 |  100.00 |
Direct coverage passed: scripts/revalidation.mjs (branches 794/794, functions 204/204, lines 2689/2689)
```

Function count moved 202 → 204, so both extracted helpers are reached by the existing cases; no helper was stranded.

`node --test tests/architecture/revalidation.test.ts` — `tests 138 / pass 138 / fail 0 / skipped 0 / todo 0`.

## Behavior Invariance

Neither oracle file was edited. `git diff --name-only -- tests/architecture/revalidation.test.ts scripts/revalidation.negative.mjs` is empty in the working tree, and `git diff --name-only cff25be1^..cff25be1` lists only `scripts/revalidation.mjs`.

## Deviations from Plan

None. The plan executed as written.

## Pre-existing Out-of-Scope Red

`node scripts/revalidation.negative.mjs` exits 1 — **but it did so identically before this refactor**, which makes it additional invariance evidence rather than a regression.

The failing case is `scripts/revalidation.negative.mjs:270`. It reads the canonical `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`, rewrites `- [ ] **AUTH-01**` and `| AUTH-01 |` into `EVIL-99`, and expects five violations. Both replace patterns have drifted out of the canonical document: `REQUIREMENTS.md:44` now reads `- [x] **AUTH-01**` (checked, not unchecked) and `REQUIREMENTS.md:175` reads `| AUTH-01     | Phase 4 ...` (column-padded). Neither replacement lands, so `EVIL-99` never enters the requirements document and the two `unexpected-requirement-definition` / `unexpected-requirement-route` violations never fire. The other three expected violations do fire.

Proof of pre-existence: `git show HEAD:scripts/revalidation.mjs` was run through the same negative runner in an isolated directory (scratchpad copy with a symlinked `.planning/`, touching nothing tracked). It produced a **byte-identical** assertion diff — same three actual violations, same two missing ones.

This is the same family as the known out-of-scope `node scripts/revalidation.mjs validate` red (945 stale `unsafe-reference` paths): stale planning-document references, not tooling behavior. It is not part of `npm run check`. It was not chased, because both available fixes are forbidden by this plan's contract — editing `scripts/revalidation.negative.mjs` would destroy the invariance oracle, and editing `.planning/REQUIREMENTS.md` is outside the one authorized file.

## Commits

- `cff25be1` — `refactor(revalidation): split scope-row validator under complexity gates`

## Self-Check: PASSED

- `scripts/revalidation.mjs` — FOUND
- `cff25be1` — FOUND in `git log`
- Oracle files unmodified — verified empty diff in both the working tree and the commit
