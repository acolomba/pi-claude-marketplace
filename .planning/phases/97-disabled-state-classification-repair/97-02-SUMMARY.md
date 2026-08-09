---
phase: 97-disabled-state-classification-repair
plan: 02
subsystem: rendering
tags: [typescript, byte-exact-pins, output-catalog, prose-reconciliation, list, info]

requires:
  - phase: 97-disabled-state-classification-repair
    plan: 01
    provides: "`isRecordedButDisabled` in `persistence/state-io.ts`, keyed only on `enabled` — the collapse that makes the disabled-partial rendering reachable"
  - phase: 96-installation-record-backed-plugin-info
    provides: "`partitionDisabledScopes` and the `--fetch` skip-note accounting whose `{already disabled}` arm the partial now reaches"
  - phase: 95-manifest-independent-installed-inventory
    provides: "the canonical `(disabled)` inventory row the disabled partial renders at byte parity"
provides:
  - "a byte-exact list pin contrasting a disabled partial against an enabled partial in one marketplace block"
  - "a byte-exact `info --fetch` pin proving the skip reason is the disabled cause, not the manifest-absence cause"
  - "four render-surface / catalog prose fragments restated on the single-axis marker, with every predicate reference repointed at `persistence/state-io.ts`"
affects: [97-03, 97-04, 97-05, list, info, output-catalog]

actuals:
  tokens: 3440
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Contrast-pair byte pin: seed the two shapes that must diverge into ONE rendered block and assert the whole join, so the status tokens, the brace asymmetry, and the row order are all pinned by a single equality"
    - "Row-scoped negative assertion: extract the subject row before asserting absence, because a whole-output absence check is defeated by a sibling row that legitimately carries the token"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - docs/output-catalog.md

key-decisions:
  - "No catalog state added. The disabled partial's bytes are identical to the existing `disabled-inventory` block, so the fenced blocks and the `catalog-uat` byte gate were left untouched and only unenforced prose changed — D-97-01 discretion anchor 1, resolved toward canonical parity."
  - "The list pin asserts one `join(\"\\n\")` equality rather than per-row matches. The byte form IS the contract, and a single join proves the two status tokens, the brace asymmetry, and the seed row order together; three separate `assert.match` calls would prove none of the three relationships."
  - "The `alpha`-row negatives are extracted per row. A whole-output `includes(\"{\")` check would pass vacuously in the opposite direction here — `beta`'s legitimate `{lsp}` makes the output-level check meaningless, so the assertion has to name its subject row."
  - "`notify.ts` now records that the ABSENT `reasons` field is what makes INV-04 structural. Stating the type-level guarantee in the doc block is what stops a future author from 'helpfully' adding a reasons field to `PluginDisabledMessage` and silently re-opening `{not in manifest}` on a disabled row."
  - "`orchestrators/reconcile/README.md` was left alone despite carrying the same stale marker text — it is outside the plan's enumerated four surfaces and belongs to the reconcile plans or the Phase 98 DOC-08 carrier. Logged to `deferred-items.md` rather than swept silently."

patterns-established:
  - "Prose-sweep verification by diff reading, not token grep: `compatibility.installable` legitimately survives in the rewritten sentences that name it the ORTHOGONAL axis, so a grep for the field name reports false positives and a grep for its absence would reject the correct text."

requirements-completed: [ENBL-06]

coverage:
  - id: D1
    description: "A disabled partial and an enabled partial render as two distinct, byte-pinned rows in one marketplace block, in seed order, with the disabled row bare"
    requirement: ENBL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#ENBL-06 / INV-04: a disabled PARTIAL renders bare `(disabled)` beside an enabled partial's `(partially-installed) {lsp}` in the same block"
        status: pass
    human_judgment: false
  - id: D2
    description: "The disabled row carries no reason brace at all — not an empty pair, not an unsupported-kind token, not the manifest-absence token (ENBL-06 composing with INV-04)"
    requirement: ENBL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#ENBL-06 / INV-04 (row-scoped negatives on the `alpha` line)"
        status: pass
      - kind: other
        ref: "`PluginDisabledMessage` in shared/notify.ts declares no `reasons` field — the constraint is structural, not test-enforced"
        status: pass
    human_judgment: false
  - id: D3
    description: "`info --fetch` on a disabled partial emits the `{already disabled}` skip note rather than the state-only manifest-absence note"
    requirement: ENBL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-06 / D-96-04: `info --fetch` on a DISABLED PARTIAL skips for the disabled cause, not the manifest-absence cause"
        status: pass
    human_judgment: false
  - id: D4
    description: "No source comment and no catalog prose still describes the disabled marker as requiring `compatibility.installable`; every predicate reference names its new home"
    verification:
      - kind: other
        ref: "git diff review of the four touched files; `grep -rn 'plan.ts::isRecordedButDisabled' extensions/ docs/` returns only the deferred reconcile README"
        status: pass
    human_judgment: false
  - id: D5
    description: "No catalog state added and no fenced block touched — the byte gate is unmoved"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts (6/6 pass)"
        status: pass
      - kind: other
        ref: "git diff -- docs/output-catalog.md touches four prose lines plus one table-padding line; no `catalog-state:` marker added or changed"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-09
status: complete
---

# Phase 97 Plan 02: Disabled-partial rendering pins and stale-marker prose sweep Summary

**The ENBL-05 collapse changed what users see, so this plan froze the new bytes: a disabled partial now renders bare `(disabled)` beside an enabled partial's `(partially-installed) {lsp}` in the same block, its `--fetch` skip note names the disabled cause instead of the manifest-absence cause, and every comment and catalog sentence that still described the retired two-axis marker was restated on the single `enabled` boolean.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 6 (4 source/doc, 2 test)
- **Diff:** +142 / -19

## Accomplishments

- **The contrast pin.** One marketplace, two records differing only in `enabled`, asserted as a single three-line `join("\n")`. The equality carries three separate facts at once: the two status tokens diverge, only the enabled partial keeps its `{lsp}` brace, and `alpha` stays first — so reclassifying a record from partially-installed to disabled does not move its row within the block.
- **Row-scoped negatives.** The `alpha` line is extracted before asserting it carries no `{`, no `(partially-installed)`, and no `{not in manifest}`. At output level the brace check would be meaningless: `beta`'s `{lsp}` is legitimate and would defeat it.
- **The `--fetch` cause pin.** A disabled partial under `--fetch` produces exactly two notifications — the info-severity `(disabled)` cascade and the warning-severity note ending `⊘ alpha v1.0.0 (skipped) {already disabled}` — plus an explicit assertion that the note carries no manifest-absence token. That token is precisely what the pre-collapse state-only arm emitted for this shape.
- **The prose sweep.** Four fragments restated: both `shared/notify.ts` row doc blocks, the `reconcile/notify.ts` bucket comment, and the `reconcile/types.ts` bucket definition. Every reference to `orchestrators/reconcile/plan.ts::isRecordedButDisabled` — a module path that no longer defines anything — now names `persistence/state-io.ts`.
- **The catalog correction.** Four prose fragments in `docs/output-catalog.md`, all outside fenced blocks. The `disable` section's claim that the marker is "the four `resources.*` arrays reset to `[]`; the `installable: true` flag is retained" was doubly wrong: `toDisabledRecord` carries the `compatibility` block over unchanged rather than forcing `installable: true`, and there are five resource arrays, not four. It now states that the emptied arrays are a consequence of disabling, never the marker.
- **The structural note.** `PluginDisabledMessage`'s doc block now says why INV-04 needs no test: a row type with no `reasons` field cannot emit a manifest-absence reason. That is the guardrail against a future author adding the field back.

## Task Commits

1. **Task 1: byte-pin the disabled-partial list row against the enabled-partial contrast** — `4973f437` (test)
2. **Task 2: pin the `info --fetch` skip-note switch for a disabled partial** — `73ffcbae` (test)
3. **Task 3: reconcile the stale two-axis-marker prose** — `d6e9d438` (docs), plus `4aa44bda` (style) for the mdformat table realignment the shortened prose triggered

## Files Created/Modified

- `tests/orchestrators/plugin/list.test.ts` — the ENBL-06 / INV-04 contrast pin, placed after the ENBL-04 canonical-disabled family so the two read together
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` — the ENBL-06 / D-96-04 `--fetch` sibling of the CR-01 repro
- `extensions/pi-claude-marketplace/shared/notify.ts` — the `PluginDisabledMessage` and `PluginWillEnableMessage` doc blocks
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — the enable-bucket projection comment
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` — the `pluginsToEnable` bucket definition in the 7-bucket header
- `docs/output-catalog.md` — the status-token table row, the `disabled-inventory` trigger paragraph, the `disable` command preamble, and the idempotent-disable paragraph

## Decisions Made

See `key-decisions` in the frontmatter.

One detail worth recording about verification method: the plan's acceptance criterion deliberately forbade a bare token grep for `compatibility.installable`, and that was the right call. The rewritten sentences all still mention that field — by name — precisely to label it the orthogonal axis. A grep for its presence flags correct text, and a grep for its absence would reject it. The check has to be a diff read.

## Deviations from Plan

**1. [Rule 3 - Blocking] Separate `style` commit for mdformat's table realignment**

- **Found during:** Task 3
- **Issue:** the `(disabled)` status-token table row's prose shortened, so the `mdformat` pre-commit hook re-padded the column. The hook rewrote the working copy after the files were staged, leaving the padding fix unstaged when the `docs` commit closed.
- **Fix:** committed the one-line realignment separately as `style(97)`. Not amended — the repository forbids history rewriting.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** `pre-commit run --files …` clean on the final tree; `git status --short` empty afterwards.
- **Committed in:** `4aa44bda`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** None. A formatting consequence of a prose edit the plan called for.

## Issues Encountered

None substantive. Both new tests were green on first run, which is the expected outcome rather than a stalled RED gate: plan `97-01` landed the behavior these tests pin, and this plan's stated job is to freeze bytes that are already correct but unprotected. The `list` half of ENBL-06 in particular was working-but-unpinned — 97-01's summary said so explicitly and left the requirement Pending for exactly this reason.

## Verification

- `node --test tests/orchestrators/plugin/list.test.ts` — exit 0, 74/74, including the untouched D-63-04 hooks-only guard which still renders `(installed)`
- `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` — exit 0, 32/32, including the bare-`info` sibling which still emits no skip note
- `node --test tests/architecture/catalog-uat.test.ts` — exit 0, 6/6
- `npm run typecheck`, `npm run lint`, `npm run format:check` — all exit 0
- `PI_SUBAGENTS_ROOT=… npm run check` — exit 0; 3311 unit tests (3310 pass, 0 fail) plus 18 integration tests
- `grep -rn "plan.ts::isRecordedButDisabled" extensions/ docs/` — one hit remaining, the deliberately-deferred `orchestrators/reconcile/README.md`
- `git diff -- docs/output-catalog.md` — five changed lines, all outside fenced blocks; no `catalog-state:` marker added or altered

## Requirement Accounting

**ENBL-06 — Complete.** The requirement reads "`plugin list` AND `plugin info` render a disabled partially-installed record as `(disabled)`". `97-01` landed the `info` half as the CR-01 repro and left the traceability row Pending because the `list` half was unpinned. This plan pins the `list` half byte-exactly, adds the `--fetch` cause pin on the `info` side, and closes the row.

## Known Stubs

None.

## Out-of-Scope Discoveries (not fixed)

`extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:34` still says the predicate "reads the empty-resources marker (all four `resources.*` arrays empty AND `compatibility.installable === true`)" and still points at `plan.ts`. Both halves are stale, and the array count was already wrong before this phase. It is outside the plan's four enumerated surfaces and is recorded in `.planning/phases/97-disabled-state-classification-repair/deferred-items.md` with `97-03` / `97-04` or the Phase 98 DOC-08 carrier named as the owner.

Still outstanding from `97-01`'s inventory and untouched here by design: `orchestrators/reconcile/apply.ts:1057-1063`, whose test-seam JSDoc claims a partially-installed plugin cannot reach the planner's enable bucket — the collapse falsifies that, and it belongs with the reconcile work.

Deliberately deferred to Phase 98 DOC-08 per the plan: `docs/prd/pi-claude-marketplace-prd.md`'s PL-6 row and 5.3.1 flowchart, the catalog's brace-bearing-variant count, the missing `(partially-installed)` status-token table row, and the `notify-reasons.ts` header count.

## Next Phase Readiness

Nothing in this plan changed behavior, so no new surface opened. The rendering contract is now frozen in both directions, which is what `97-03` / `97-04` need before they touch `enable` re-materialization and reconcile convergence: any change that makes a disabled partial render as something else, or that re-introduces a reason brace on a disabled row, now fails a byte assertion rather than passing silently.

## Self-Check: PASSED

All four commit hashes resolve in `git log`; every file claimed as modified exists on disk and appears in `git diff --stat 4e89e015..HEAD`.

---
*Phase: 97-disabled-state-classification-repair*
*Completed: 2026-08-09*
</content>
