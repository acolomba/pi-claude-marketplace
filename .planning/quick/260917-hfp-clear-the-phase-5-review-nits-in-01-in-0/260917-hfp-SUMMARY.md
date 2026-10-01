---
quick_id: 260917-hfp
phase: quick-260917-hfp
plan: 01
subsystem: orchestrators
tags: [uninstall, prune, reconcile, dependency-index, output-catalog, review-settlement]

requires:
  - phase: 05-prune-on-uninstall
    provides: "the `--prune` sweep, the dependents guard, the D-05-16 reconcile retry loop, and the `05-REVIEW.md` Info findings this task settles"
provides:
  - orphan sweep gated on standalone mode (`opts.prune === true && !orchestrated`, D-05-08) with an owner-suite case
  - "`prunedMembers: PrunedMember[]` carrying the sweep's members out of the transaction closure"
  - exported `MarketplaceStateRecord` alias reused by `IndexedRecord` in `dependency-index.ts`
  - reconcile retry loop that exits on `refused.length === 0 || settled === 0` (a PU-5 converge is not progress)
  - "`ApplyReconcileOptions.uninstallPlugin?` injection seam mirroring `gitOps?`"
  - catalog `prune-partial-failure` prose with the shrunk-or-intact clause attached to the failed member's record
  - "`05-REVIEW-FIX.md` section recording IN-01/02/03/07/08 fixed and IN-04 carried"
affects: [reconcile, uninstall, prune, review-closure]

actuals:
  tokens: 6193
  tasks: 3
  commits: 4
plan_head_before: 234ddbd9c899f8d1382b75545236b301c7310276

tech-stack:
  added: []
  patterns:
    - "Optional injection seam on an options bundle (`uninstallPlugin?` beside `gitOps?`): production omits, tests inject an observing overload-pair wrapper around the real operation"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - docs/output-catalog.md
    - .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md

key-decisions:
  - "IN-01 is a runtime gate (`&& !orchestrated`), not a type narrowing: `prune?: never` on the narrow orchestrated overload falls through to the wide overload with no diagnostic"
  - "IN-03 exports `MarketplaceStateRecord` because fallow's `private-type-leaks: \"error\"` forbids an exported `IndexedRecord` referencing a private alias (the `BrowserTui` precedent)"
  - "IN-08 adds the `uninstallPlugin?` seam on `ApplyReconcileOptions` mirroring `gitOps?`: no existing seam observes a refused or converged child call from `applyReconcile`"
  - "No CHANGELOG entry: `.claude/rules/changelog.md` is one entry per pull request and the milestone's ship step writes this branch's entry"

patterns-established: []

requirements-completed: [PRUNE-03, PRUNE-05]

coverage:
  - id: D1
    description: "An orchestrated uninstall carrying `prune: true` removes only the named plugin; the dependency-provenance orphan survives (D-05-08)"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-08: an orchestrated call carrying the prune option removes only the named plugin"
        status: pass
    human_judgment: false
  - id: D2
    description: "A converged entry beside a refusal is settled in one reconcile pass: one child call per bucket entry, same refusal row, state unchanged"
    requirement: PRUNE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-16 / PU-5: a converged entry beside a refusal is settled in one pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "The catalog's D-05-13 paragraph attaches `shrunk ... or intact` to the failed member's record with the fenced example block and byte lock unchanged"
    requirement: PRUNE-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts (213 states / 28,729 bytes) and tests/architecture/partial-vocabulary-guard.test.ts"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-09-17
status: complete
---

# Quick 260917-hfp: Clear the phase 5 review nits IN-01, IN-02, IN-03, IN-07, IN-08 (IN-04 carried) Summary

**The orphan sweep now runs in standalone mode only, the reconcile retry loop stops when a pass settles nothing, and the remaining phase 5 Info findings are recorded as settled in `05-REVIEW-FIX.md` -- four commits, two planted tests observed red then green, catalog byte lock untouched.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-09-17T16:50:36Z
- **Completed:** 2026-09-17T17:19:49Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- IN-01 (D-05-08): the sweep gate in `uninstall.ts` is `opts.prune === true && !orchestrated`; an orchestrated call carrying `prune: true` returns `{ status: "uninstalled", name: "x", version: "0.0.1" }` and leaves `o@mp` recorded. The option doc says standalone only.
- IN-02: `const prunedMembers: PrunedMember[] = []` replaces the `{ members: [] }` wrapper and its false-rationale sentence; the three accesses read the array.
- IN-03: `MarketplaceStateRecord` is exported (fallow private-type-leak rule) and both `IndexedRecord` members use it; `ExtensionState["marketplaces"][string]` is spelled once in the file.
- IN-08 (D-05-16 / PU-5): `applyPluginUninstalls` counts `settled` per pass and exits on `refused.length === 0 || settled === 0`; `ApplyReconcileOptions.uninstallPlugin?` is the injection seam that makes the pass count observable.
- IN-07 (D-05-13 / PRUNE-03): the catalog paragraph is reordered so `shrunk ... or intact` follows the failed member's record; one line changed, example block byte-identical.
- IN-04: verified against BACKLOG `PRUNE-GUARD-MR-01` and recorded as carried; BACKLOG not edited.

## Task Commits

1. **Task 1 (IN-01, IN-02, IN-03):** `97c9ce14` `fix(prune): sweep only in standalone mode and tidy the owners` -- `uninstall.ts`, `dependency-index.ts`, `tests/orchestrators/plugin/uninstall.test.ts`
2. **Task 1 (IN-08):** `3e1198c9` `fix(reconcile): stop retrying refusals when a pass settled nothing` -- `reconcile/apply.ts`, `reconcile/types.ts`, `tests/orchestrators/reconcile/apply.test.ts`
3. **Task 2 (IN-07):** `03d56b0d` `docs(catalog): attach the shrunk-or-intact clause to the failed member` -- `docs/output-catalog.md`
4. **Task 3 (record):** `15eb4a0b` `docs(review): settle IN-01..04, IN-07, IN-08 from the phase 5 review` -- `05-REVIEW-FIX.md`

All four carry the `Co-Authored-By` and `Claude-Session` trailers. `git show --stat` of each lists only its staged paths. SUMMARY.md / STATE.md / PLAN.md are not committed (orchestrator's docs commit).

## RED / GREEN evidence

Both planted cases were run against the unchanged production code with `node --test --test-reporter=tap` before the fix landed.

**IN-01 case, RED on HEAD `234ddbd9` (uninstall suite: 88 tests, 87 pass, 1 fail):**

```text
not ok 84 - D-05-08: an orchestrated call carrying the prune option removes only the named plugin
  ---
  duration_ms: 21.736422
  type: 'test'
  location: '/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/uninstall.test.ts:5522:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

    + {}
    - {
    -   'o@mp': [
    -     'mp-o-skill'
    -   ]
    - }
```

GREEN after `97c9ce14`: `ok 98 - D-05-08: an orchestrated call carrying the prune option removes only the named plugin`; uninstall + dependency-index suites 102/102.

**IN-08 case, RED with the `uninstallPlugin?` seam in place and the length test unchanged (reconcile suite: 53 tests, 52 pass, 1 fail).** The seam was added first so the red run measures the extra pass rather than a missing option:

```text
    not ok 17 - D-05-16 / PU-5: a converged entry beside a refusal is settled in one pass
      ---
      duration_ms: 35.399963
      type: 'test'
      location: '/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/reconcile/apply.test.ts:1316:3'
      failureType: 'testCodeFailure'
      error: |-
        Expected values to be strictly deep-equal:
        + actual - expected

          [
            'gone@mp',
            'orphan@mp',
        +   'orphan@mp'
          ]
```

GREEN after the `settled` counter: `ok 17 - D-05-16 / PU-5: a converged entry beside a refusal is settled in one pass`; reconcile apply + types suites 58/58.

## Gates

Before each code commit: `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run format:check` all exit 0; `npm run test:coverage:direct:commit` exit 0; `SKIP=trufflehog pre-commit run --files <staged paths>` exit 0 with no files rewritten.

Direct coverage readings (100% on every changed production file):

| File | Branches | Functions | Lines |
|------|----------|-----------|-------|
| `orchestrators/plugin/uninstall.ts` | 124/124 | 26/26 | 1268/1268 |
| `orchestrators/plugin/dependency-index.ts` | 24/24 | 4/4 | 200/200 |
| `orchestrators/reconcile/apply.ts` | 134/134 | 27/27 | 1029/1029 |
| `orchestrators/reconcile/types.ts` | 5/5 | 2/2 | 312/312 |

The three recorded shortfalls (`bridges/agents/convert.ts`, `bridges/commands/discover.ts`, `orchestrators/plugin/install-outcome.ts`) matched `scripts/test-coverage-direct.pin.json` exactly; the pin file was not edited.

Fallow: `npm run fallow` stayed at zero findings with the `??` fallback inside `applyPluginUninstalls`; the `applyPlan` hoist fallback the plan reserved for a cognitive-complexity trip was NOT needed.

Catalog byte lock (Task 2): `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/partial-vocabulary-guard.test.ts` -> 63/63 pass with `EXPECTED_STATE_COUNT = 213` and `EXPECTED_UTF8_BYTES = 28_729` untouched; `git diff --stat docs/output-catalog.md` showed exactly one changed line.

After the last commit: `npm test` 6530/6530 (316 suites, 0 fail -- the two pi-subagents peer tests did not fail); `SKIP=trufflehog pre-commit run --all-files` exit 0 with the tree unchanged.

Forbidden-token scan: `git diff 234ddbd9 -- extensions tests | grep '^+.*\(IN-0[1-8]\|260917\|review\)'` has no hits; the pre-existing `IN-02:`/`IN-04:`/`IN-05:` comments in `uninstall.ts` and `IN-07:` in `apply.ts` are earlier findings and untouched.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- sweep gate `opts.prune === true && !orchestrated`; `prune` option doc; `prunedMembers` array
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` -- exported `MarketplaceStateRecord`; `IndexedRecord` reuses it
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` -- `opts.uninstallPlugin ??` fallback; `settled` counter; exit on `settled === 0`; header comment states the rule and termination
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` -- `uninstallPlugin?: UninstallPluginOperation` on `ApplyReconcileOptions`
- `tests/orchestrators/plugin/uninstall.test.ts` -- orchestrated-plus-prune case beside the D-05-08 case
- `tests/orchestrators/reconcile/apply.test.ts` -- converged-beside-refused single-pass case beside the second D-05-16 case; overload-pair observing wrapper (no cast)
- `docs/output-catalog.md` -- reordered D-05-13 prose only
- `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` -- `## Info items settled (2026-09-17)` section

## Decisions Made

- IN-01 runtime gate over type narrowing (plan decision, not re-litigated): the overload pair makes `prune?: never` fall through silently.
- IN-03 exported alias (plan decision): fallow's `private-type-leaks` is `error`.
- IN-08 `uninstallPlugin?` seam (plan decision): mirrors `gitOps?`; the per-entry invocation count is the only observable of pass count.
- RED ordering for IN-08: the seam (`types.ts` + the `??` line) was added before the red run so the failing assertion reports the extra pass (`['gone@mp','orphan@mp','orphan@mp']`) instead of an ignored option (`[]`). The seam alone does not turn the case green, so it is not the fix.
- No CHANGELOG entry: `.claude/rules/changelog.md` is one entry per pull request; this branch has no PR yet and the milestone's ship step writes it. `CHANGELOG.md` was not edited.
- `.planning/BACKLOG.md` was not edited: `PRUNE-GUARD-MR-01` already states the `marketplace remove` bypass, the D-05-07 exit, and the pick-up scope.

## Deviations from Plan

None - plan executed exactly as written. One sequencing note: the reconcile test was parked in the scratchpad (and the file restored to HEAD) while commit 1 was gated, because it references the `uninstallPlugin` seam that only lands in commit 2 and the whole-tree `npm run typecheck` gate must be green for each commit. It was re-applied unchanged before the IN-08 work.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. `T-05-16` (sweep under orchestrated `prune: true`) is mitigated by the gate and the planted case; `T-05-17` (the `uninstallPlugin?` seam) is populated only by `tests/`; `T-05-18` (retry loop termination) is argued in the header comment and covered by the three D-05-16 cases.

## Next Steps

The orchestrator commits this SUMMARY and the STATE update. All Info items in `05-REVIEW.md` are now settled in `05-REVIEW-FIX.md`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` FOUND, `opts.prune === true && !orchestrated` present
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` FOUND, one spelling of `ExtensionState["marketplaces"][string]`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` FOUND, `settled === 0` present
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` FOUND, `uninstallPlugin?` present
- `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` FOUND, six `### IN-NN` headings in order
- Commits `97c9ce14`, `3e1198c9`, `03d56b0d`, `15eb4a0b` FOUND in `git log`
- `git rev-list --count 234ddbd9..HEAD` = 4
