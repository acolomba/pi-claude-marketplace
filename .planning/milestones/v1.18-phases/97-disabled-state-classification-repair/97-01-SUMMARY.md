---
phase: 97-disabled-state-classification-repair
plan: 01
subsystem: state
tags: [typescript, predicate-consolidation, reconcile, classifier, drift-gate]

requires:
  - phase: 96-installation-record-backed-plugin-info
    provides: "the state-only info arm and `partitionDisabledScopes`, whose disabled guard this plan repairs (CR-01)"
  - phase: 95-manifest-independent-installed-inventory
    provides: "the canonical `(disabled)` inventory row the disabled partial now renders at byte parity"
provides:
  - "`isRecordedButDisabled` exported from `persistence/state-io.ts` — the sole disabled-state predicate, reading only `enabled`"
  - "three deleted predicate twins plus one deleted inline conjunction; six modules on the single definition"
  - "a drift gate inverted from `the twin has the right body` to `no twin survives`"
  - "the CR-01 repro: a manifest-absent disabled partial renders the `(disabled)` cascade"
  - "classifier + completion-bucket pins for the disabled partial, with the enabled soft-degraded counter-case"
affects: [97-02, 97-03, 97-04, 97-05, enable-disable, reconcile, update, list, info]

actuals:
  tokens: 10395
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Structural-parameter predicate: `{ readonly enabled: boolean }` so every caller's record view satisfies it without a cast"
    - "Source-grep drift gate asserting an absence (no local re-derivation) plus a presence (each site imports the one definition), over comment-stripped source"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - tests/orchestrators/plugin/plugin-state-classifier.test.ts
    - tests/orchestrators/edge-deps.test.ts

key-decisions:
  - "The predicate lives in `persistence/state-io.ts` beside `toDisabledRecord`, not in `shared/` or the classifier: state-io already owns the disabled shape, so the predicate is the read side of an invariant that module already writes."
  - "`reconcile/plan.ts` does NOT re-export the predicate. A second binding surface would re-create exactly the drift the collapse removes; consumers import from the one home."
  - "The drift gate was replaced wholesale rather than re-pointed at a renamed helper. A body-shape regex keyed on a function name is defeated by the next rename and cannot see a fifth copy appearing elsewhere; asserting absence-of-conjunction plus presence-of-import is strictly stronger."
  - "D-97-01 discretion anchor 1 resolved toward parity: the disabled partial's row renders BARE, byte-identical to the canonical `(disabled)` row. `PluginDisabledMessage` carries no `reasons` field by construction, which makes INV-04's `never {not in manifest} on a disabled row` structural rather than test-enforced, and costs zero catalog amendment."

patterns-established:
  - "Orthogonal-axes predicate: degraded-ness (`compatibility.installable`) and disabled-ness (`enabled`) are independent facts; merging them into one conjunction is what made the disabled partial invisible to every surface."
  - "Absence-asserting architecture gate: for a `no module re-derives X locally` invariant, grep comment-stripped source of every former definition site for the removed expression AND for the single-definition import."

requirements-completed: [ENBL-05]
# ENBL-06 is carried by BOTH 97-01 and 97-02. This plan landed its `info` half
# (the CR-01 repro); the `list` half is 97-02's, so ENBL-06 stays Pending in
# REQUIREMENTS.md until that plan lands. See `## Requirement Accounting`.
requirements-partial: [ENBL-06]

coverage:
  - id: D1
    description: "One exported disabled-state predicate keyed only on `enabled`, consumed by all four former definition sites and by list/info"
    requirement: ENBL-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: isRecordedButDisabled truth table over installable x enabled -- every enabled:false cell is disabled, regardless of availability"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: no conjunctive disabled-state twin survives -- every former definition site consumes the single persistence/state-io.ts predicate (drift gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The over-reach guard: an ENABLED soft-degraded record is never reported as disabled and still plans nothing on reconcile"
    requirement: ENBL-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan-convergence.test.ts (soft-degraded fixture in state-populated-mixed.json plans an empty reconcile)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/plugin-state-classifier.test.ts#ENBL-05 over-reach guard: an ENABLED soft-degraded record is still `partially-installed`"
        status: pass
    human_judgment: false
  - id: D3
    description: "CR-01: a manifest-absent disabled PARTIAL record renders the `(disabled)` inventory cascade byte-for-byte, not the state-only installed block"
    requirement: ENBL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-05 / ENBL-06 / CR-01: a manifest-absent DISABLED PARTIAL record renders the `(disabled)` inventory cascade, not the state-only installed block"
        status: pass
    human_judgment: false
  - id: D4
    description: "The classifier and completion-bucket consequence: a disabled partial is frozen `installed` and is not offered as an `update --partial` candidate"
    requirement: ENBL-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/plugin-state-classifier.test.ts#ENBL-05 / WR-01: a DISABLED PARTIAL record is `installed` -- the disabled short-circuit runs ahead of the unsupported branch"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#ENBL-05: a DISABLED PARTIAL buckets with the plain installed set, never `partially-installed` (not an `update --partial` candidate)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No state migration, schema-version bump, or persisted write: a record already on disk in the disabled-partial shape reclassifies on the next read"
    verification:
      - kind: other
        ref: "git diff --stat -- extensions/pi-claude-marketplace/persistence/migrate.ts (empty)"
        status: pass
      - kind: other
        ref: "git diff --stat -- docs/output-catalog.md (empty — the bare row adds no catalog state)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-09
status: complete
---

# Phase 97 Plan 01: Disabled-state predicate collapse Summary

**Four independently-drifting copies of `installable && !enabled` collapsed into one `persistence/state-io.ts` predicate reading only `enabled`, which makes a soft-degraded plugin that the user disabled recognizable as disabled by every surface — turning the CR-01 `info` repro from `(partially-installed) {not in manifest, lsp}` into the bare `(disabled)` row.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 (Task 1 was a TDD tracer: RED then GREEN)
- **Files modified:** 11 (7 source, 4 test)
- **Diff:** +300 / -169

## Accomplishments

- `isRecordedButDisabled(record: { readonly enabled: boolean })` now lives once, in `persistence/state-io.ts`, immediately after `toDisabledRecord` — the read side of the shape that function writes. Availability and `resources.*` are deliberately not inputs.
- Three twins deleted (`reconcile/plan.ts`'s export, `plugin/update.ts`'s module-private copy, `plugin/enable-disable.ts::isCurrentlyDisabled`) plus the inline conjunction in `plugin-state-classifier.ts`. `list.ts` and `info.ts` were repointed off `../reconcile/plan.ts`.
- The truth table's fourth cell flipped: `(installable: false, enabled: false)` is now disabled. The third cell `(installable: false, enabled: true)` stays NOT disabled and is labelled the over-reach guard — it is what keeps a soft-degraded but never-disabled plugin materializing its supported components.
- The drift gate was replaced, not edited: it now asserts that none of the four former definition files contains the two-axis conjunction in comment-stripped source, and that each imports the single predicate.
- The CR-01 repro landed as an end-to-end `info` test and went from red (`● mp [user] <no autoupdate>` / `◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}`) to green (`● mp [user]` / `◍ alpha v1.0.0 (disabled)`).
- The classifier's disabled short-circuit precedence — ahead of the `unsupported.length` branch — became load-bearing rather than incidental, and is now pinned in both directions along with its completion-bucket consequence.

## Task Commits

1. **Task 1 (tracer, TDD RED): failing truth table, drift gate, and CR-01 repro** — `4e0a2494` (test)
2. **Task 1 (tracer, TDD GREEN): the predicate collapse** — `8eab6c08` (fix)
3. **Task 2: classifier and completion-bucketizer consequences** — `b2b8f973` (test)

No REFACTOR commit — the GREEN implementation needed no cleanup pass.

## Files Created/Modified

- `persistence/state-io.ts` — the sole predicate, with a JSDoc stating why the availability axis is not an input
- `orchestrators/reconcile/plan.ts` — local definition and export deleted; header prose and the JSDoc that wrongly claimed a soft-degraded plugin always carries `enabled: true` both corrected
- `orchestrators/plugin/update.ts` — twin deleted; the D-UPD short-circuit comment restated on the explicit-boolean marker
- `orchestrators/plugin/enable-disable.ts` — `isCurrentlyDisabled` deleted; the idempotency equality test now reads the single predicate
- `orchestrators/plugin/plugin-state-classifier.ts` — inline conjunction replaced by the predicate call; the `InstalledRecordLike` doc block and the WR-01 comment restated
- `orchestrators/plugin/list.ts`, `orchestrators/plugin/info.ts` — imports repointed at `persistence/state-io.ts`; list's D-54-01/ENBL-04 comment corrected
- `tests/orchestrators/reconcile/plan.test.ts` — header prose rewritten, cell flipped, drift gate replaced, plus a new case for the transient all-empty-resources enabled shape
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` — the CR-01 repro
- `tests/orchestrators/plugin/plugin-state-classifier.test.ts`, `tests/orchestrators/edge-deps.test.ts` — disabled-partial pins with the enabled soft-degraded control

## Decisions Made

See `key-decisions` in the frontmatter. In short: the predicate's home is `persistence/state-io.ts`; `plan.ts` does not re-export it; the drift gate was replaced rather than re-pointed; and the disabled-partial row renders bare, at byte parity with the canonical `(disabled)` row (D-97-01 anchor 1).

One implementation detail worth recording: the drift gate's positive half matches an `import { … isRecordedButDisabled … } from "…persistence/state-io.ts"` statement rather than a bare mention of the symbol. `plan.ts` already carried a type-only import from `state-io.ts`, so a looser "imports from state-io" check would have passed vacuously there.

## Deviations from Plan

**1. [Rule 3 - Blocking] Restored the import-group blank line in `list.ts`**

- **Found during:** Task 1 GREEN
- **Issue:** Deleting the `../reconcile/plan.ts` import consumed the blank line separating the parent-relative import group from the sibling group, so `import-x/order` failed with "There should be at least one empty line between import groups".
- **Fix:** Re-inserted the blank line before `./git-source-probe.ts`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `8eab6c08` (part of the GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** None — a mechanical consequence of an import deletion the plan called for. No scope creep.

## Issues Encountered

None. The plan's line-level inventory matched the worktree exactly; every cited line range was accurate.

## Verification

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0, no new `sonarjs/cognitive-complexity` suppression
- `npm run format:check` — exit 0
- `PI_SUBAGENTS_ROOT=… npm run check` — exit 0; 3309 unit tests (3308 pass, 0 fail) plus 18 integration tests
- `plan-convergence.test.ts` green: the `soft-degraded` fixture (`installable: false`, `enabled: true`) still plans nothing
- Acceptance criteria checked directly: exactly one `export function isRecordedButDisabled`; the runtime predicate returns `true`/`false` for `{enabled:false}`/`{enabled:true}`; zero non-comment occurrences of `function isCurrentlyDisabled`; `git diff --stat` empty for both `persistence/migrate.ts` and `docs/output-catalog.md`

## Requirement Accounting

**ENBL-05 — Complete.** One definition, reading only `enabled`, consumed by every former definition site; drift gate and truth-table cell both landed in the same commit as the collapse.

**ENBL-06 — Partial, left Pending.** The requirement reads "`plugin list` AND `plugin info` render a disabled partially-installed record as `(disabled)`". This plan landed the `info` half as the CR-01 repro. The `list` half is plan `97-02`'s (it also carries `ENBL-06` in its frontmatter). `list.ts` does now render the disabled partial as `(disabled)` — its `isRecordedButDisabled` guard runs ahead of the classifier and the guard is on the single predicate — but nothing in this plan pins that byte-for-byte, so the traceability row was deliberately left at `Pending` rather than marked `Complete` on a half-covered requirement. `97-02` closes it.

## Known Stubs

None.

## Out-of-Scope Discoveries (not fixed)

Four comments outside this plan's enumerated set still name `orchestrators/reconcile/plan.ts::isRecordedButDisabled` as the predicate's home, which is now a dangling module reference, and two of them additionally describe the old empty-resources-plus-`installable: true` marker:

- `orchestrators/reconcile/types.ts:16-19`
- `orchestrators/reconcile/notify.ts:403-404`
- `shared/notify.ts:723-727` and `shared/notify.ts:993-997`
- `orchestrators/reconcile/apply.ts:1057-1063` — its test-seam JSDoc claims "the planner's enable bucket requires `installable === true`, so a partially-installed plugin cannot reach it through a real plan", which the collapse falsifies

`docs/output-catalog.md` carries four matching prose fragments (lines ~149, ~331, ~2191, ~2215). All are prose, not fenced byte blocks, so the catalog byte gate is unmoved. RESEARCH.md classifies these as low-risk traceability prose; the `apply.ts` one is the substantive item and belongs with the reconcile work in `97-03`/`97-04`, with the notify/catalog prose falling under the Phase 98 DOC-08 carrier.

## Next Phase Readiness

ENBL-05 is the root repair, and it is done: the remaining plans in this phase are expansion, not new architecture. Specifically unblocked, with the second-order edits RESEARCH.md flagged still outstanding:

- **ENBL-07 (`97-02`?):** `enable-disable.ts:476` now inverts correctly for the disabled partial, so `disable` is idempotent and `enable` falls through to `runEnableBranch`. But `runEnableBranch` still passes no `partial` field to `runInstallLedger`, so re-materializing a partial hits `requireInstallable` and renders `(failed)`. That edit is required for ENBL-07's enable half.
- **ENBL-09:** `refreshDisabledRecord` still hard-codes `installable: true`, so the short-circuit a disabled partial now reaches would rewrite its compatibility block untruthfully.
- **ENBL-08:** `reconcile/apply.ts`'s BFILL-01 backfill scan still has no `enabled` guard, so a disabled partial whose supported set grew can be re-materialized and silently re-enabled by the reinstall path.

None of these regressed anything today — the full suite is green — but each is reachable now in a way it was not before the collapse.

## Self-Check: PASSED

All three commit hashes resolve in `git log`; every file claimed as created or modified exists on disk.

---
*Phase: 97-disabled-state-classification-repair*
*Completed: 2026-08-09*
