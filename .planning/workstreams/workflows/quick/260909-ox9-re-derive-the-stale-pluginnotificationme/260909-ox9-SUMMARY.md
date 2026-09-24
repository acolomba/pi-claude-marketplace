---
phase: 260909-ox9
plan: 01
subsystem: documentation
tags: [notify, messaging-guide, architecture-test, doc-pins, typescript-conditional-types]

requires:
  - phase: 105-workflow-degradation-and-documentation
    provides: the messaging style guide whose type-model claims had gone stale
provides:
  - docs/messaging-style-guide.md with no duplicated union listing and no bare cardinality
  - a 19-row status-by-field table stating per-arm field discipline exactly once
  - tests/architecture/messaging-guide-doc-pins.test.ts (MSGDOC-01), 5 cases
  - Broken Windows entry 47 carrying the out-of-scope reload-hint mechanism drift
affects: [messaging-style-guide, notify, output-catalog, future notify status additions]

actuals:
  tokens: 12018
  tasks: 3
  commits: 3

plan_head_before: 7da2d180c013390ea76b958b5d95c796b6867eda

tech-stack:
  added: []
  patterns:
    - "Doc pin by derivation: the allowed set is read out of the source at run time, never transcribed into the test"
    - "Conditional-type discipline map: a total map keyed by the status union whose value type is computed from the union's own interfaces, so a source drift is a typecheck error at the literal"
    - "Stated figures derived from the enumeration beneath them, so no number in the document is unbound"

key-files:
  created:
    - tests/architecture/messaging-guide-doc-pins.test.ts
  modified:
    - docs/messaging-style-guide.md
    - .planning/WINDOWS.md

key-decisions:
  - "The fenced union listing was DELETED, not corrected: it was the second copy of a nineteen-arm union inside the section that promises to point rather than duplicate, and it was the copy that rotted."
  - "docs/adr/v2-001-structured-notify.md keeps its identical stale listing. An ADR is a dated record; correcting it would falsify history. The new pin is scoped to the guide alone for the same reason."
  - "The glyph annotations in the deleted listing were not carried over. docs/output-catalog.md owns rendered bytes and tests/architecture/catalog-uat.test.ts gates them."
  - "Option (a) landed for the partition cases: a conditional-type FieldDiscipline map. Both fallbacks (source-text parsing, status-column-only) were unnecessary."
  - "A fourth, unplanned case was added binding the guide's stated figures to the table's rows, because writing 15 / 8+7+4 / a four-name family as plain prose would have re-armed the exact trap this task removes."

patterns-established:
  - "Derived allow-lists: a doc gate that hand-maintains a ban list is a second enumeration with the same failure mode as the one it removes"
  - "Both sides proven non-empty before comparison, so a rename or a deleted section reports as an unbound gate rather than a green run over nothing"

requirements-completed: [MSGDOC-01]

coverage:
  - id: D1
    description: "The messaging guide names no message-variant type that shared/notify.ts does not export"
    requirement: MSGDOC-01
    verification:
      - kind: unit
        ref: "tests/architecture/messaging-guide-doc-pins.test.ts#MSGDOC-01: every message type the messaging guide names is one notify.ts declares"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guide's status-by-field table is PLUGIN_STATUSES in tuple order and matches what each variant interface declares"
    requirement: MSGDOC-01
    verification:
      - kind: unit
        ref: "tests/architecture/messaging-guide-doc-pins.test.ts#MSGDOC-01: the status-by-field table's status column is PLUGIN_STATUSES in tuple order"
        status: pass
      - kind: unit
        ref: "tests/architecture/messaging-guide-doc-pins.test.ts#MSGDOC-01: the status-by-field table matches what each variant interface declares"
        status: pass
      - kind: unit
        ref: "tests/architecture/messaging-guide-doc-pins.test.ts#MSGDOC-01: every discipline cell is inside the closed three-value vocabulary"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every figure the guide states about the table is derived from the table's own rows"
    requirement: MSGDOC-01
    verification:
      - kind: unit
        ref: "tests/architecture/messaging-guide-doc-pins.test.ts#MSGDOC-01: the figures the guide states about the table agree with the table"
        status: pass
    human_judgment: false
  - id: D4
    description: "The out-of-scope reload-hint mechanism drift is filed behind a carrier rather than narrated"
    verification:
      - kind: other
        ref: ".planning/WINDOWS.md entry 47 (kind: unmet-truth, phase 105, status open)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-09-09
status: complete
---

# Quick 260909-ox9: Re-derive the stale PluginNotificationMessage claims

**The messaging guide's plugin-notification type model is now true at HEAD and mechanically bound to `shared/notify.ts`: the duplicated union listing is gone, per-arm field discipline lives in one nineteen-row table, and five MSGDOC-01 cases redden on a source drift without a human re-reading the document.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-09-09T22:08:55Z
- **Completed:** 2026-09-09T22:50Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (1 created, 2 modified)

## Re-derivation before any edit (Task 1's gating step)

The plan's `<measured_facts>` block was treated as orientation and every figure was re-derived from source before a line was edited.

| Claim in `<measured_facts>` | Re-derived at HEAD | Verdict |
|---|---|---|
| `PLUGIN_STATUSES` has 19 members | `PLUGIN_STATUSES.length` printed `19` under Node's native TS stripping | agrees |
| Tuple order (19 named members) | byte-identical to the plan's list | agrees |
| `PluginNotificationMessage` has 19 arms in a different order; `remote` sixth; the two partial states follow `disabled` | confirmed by reading the declaration at `notify.ts:1218-1237` | agrees |
| `grep -c PluginPresentMessage notify.ts` prints `0` | prints `0` | agrees |
| `reasons` required on 8 / optional on 7 / absent from 4 | measured per interface: identical membership | agrees |
| `dependencies` required on 3 / optional on 1 / absent from 15 | identical | agrees |
| `version` optional on 14, absent from `updated` + the `will *` group | identical | agrees |
| `scope` optional on 15, absent from `available` `remote` `unavailable` `partially-available` | identical | agrees |
| `MARKETPLACE_STATUSES` has 7 members | printed `7` | agrees |
| `needsReload` occurs 34 times in `notify.ts`, 0 in the guide | 34 and 0 | agrees |

**Every figure in `<measured_facts>` agreed with source.** One figure OUTSIDE that block did not — see "Figure that disagreed with the plan" below.

## Accomplishments

- Deleted the fenced `PluginNotificationMessage` listing and replaced it with a three-sentence source pointer. The listing was a verbatim duplicate of a nineteen-arm TypeScript union sitting inside the section whose opening line promises "This section points at those definitions; it does not duplicate them."
- Replaced the four by-field prose bullets with one nineteen-row `status x field` table, one row per `PLUGIN_STATUSES` member in tuple order, four discipline columns, and a closed `required` / `optional` / `absent` vocabulary defined in a legend above it. The rationale prose survives beneath the table and no longer restates membership.
- Corrected four claims that were false at HEAD: the `reasons` partition (`8 + 6 + 5` and a named compile error that does not occur, because `PluginUninstalledMessage.reasons?` exists per WLIF-06 — the real split is `8 + 7 + 4`), the reason-bearing variant count (stated as 5 in two places, measured 15), the no-scope carve-out family (named as three statuses, measured four — `remote` has no `scope` field either), and the retired `present` inventory token in two bullets.
- Stripped every bare cardinality for `PluginNotificationMessage`, `PluginStatus` and `MARKETPLACE_STATUSES`, replacing each with the derivation it actually has (`(typeof PLUGIN_STATUSES)[number]`, "one arm per `PLUGIN_STATUSES` member").
- Added `tests/architecture/messaging-guide-doc-pins.test.ts` with five MSGDOC-01 cases, all bound to source by derivation rather than transcription.
- Filed the out-of-scope reload-hint mechanism drift as Broken Windows entry 47.

## Task Commits

1. **Task 1 (tracer): Re-derive from source, then prove the source-to-doc loop on the variant names** — `5f3cd340` (docs)
2. **Task 2: Replace the by-field prose with a checkable status-by-field table and pin it to source** — `5073e497` (docs)
3. **Task 3: Run the full gate and file the out-of-scope reload-hint finding** — `a39ba7a4` (chore)

No plan-metadata commit: SUMMARY.md, STATE.md and PLAN.md are the orchestrator's to commit.

## Files Created/Modified

- `tests/architecture/messaging-guide-doc-pins.test.ts` — created. Five MSGDOC-01 cases pinning the guide's type-model claims to `shared/notify.ts`.
- `docs/messaging-style-guide.md` — modified. Union listing deleted, status-by-field table added, four false claims corrected, three bare cardinalities removed.
- `.planning/WINDOWS.md` — modified. One appended entry (id 47) via `gsd-tools windows append`; the file was never hand-edited.

## Negative controls

Each transcript below was produced by planting the named violation, running the gate, observing it fail, and reverting. A gate believed without this is a gate that may check nothing.

### NC-0 (unplanned, recorded for completeness): the gate was red on the REAL defect before the guide was edited

The variant-name case was written first and run against the unedited guide. It failed on the live `PluginPresentMessage` claim, which is the strongest evidence the gate binds — the violation was not planted, it was already there.

```
✖ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (26.245264ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1

✖ failing tests:

test at tests/architecture/messaging-guide-doc-pins.test.ts:65:1
✖ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (26.245264ms)
  AssertionError [ERR_ASSERTION]: MSGDOC-01: docs/messaging-style-guide.md names a message type extensions/pi-claude-marketplace/shared/notify.ts does not declare. The guide is present-tense, so a name it carries asserts that the type exists now. A retired name belongs in the ADR that recorded its retirement, not in the guide.
  + actual - expected

  + [
  +   'PluginPresentMessage'
  + ]
  - []

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/messaging-guide-doc-pins.test.ts:89:10)
    actual: [ 'PluginPresentMessage' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
```

### NC-1 (Task 1, mandatory): fabricated variant name appended to the guide

Planted: `- \`PluginFabricatedMessage\` -- planted violation for the negative control.`

```
=== TRANSCRIPT ===
✖ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (26.451749ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 280.906049

✖ failing tests:

test at tests/architecture/messaging-guide-doc-pins.test.ts:65:1
✖ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (26.451749ms)
  AssertionError [ERR_ASSERTION]: MSGDOC-01: docs/messaging-style-guide.md names a message type extensions/pi-claude-marketplace/shared/notify.ts does not declare. The guide is present-tense, so a name it carries asserts that the type exists now. A retired name belongs in the ADR that recorded its retirement, not in the guide.
  + actual - expected

  + [
  +   'PluginFabricatedMessage'
  + ]
  - []

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/messaging-guide-doc-pins.test.ts:89:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ 'PluginFabricatedMessage' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
[exit code: 1]
=== REVERTING ===
ℹ pass 1
ℹ fail 0
```

### NC-2 (Task 2, mandatory): one status row deleted from the guide's table

Planted: the `` `remote` `` row removed from the status-by-field table.

```
############ NEGATIVE CONTROL 1: delete the `remote` row from the table ############
✔ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (12.994811ms)
✖ MSGDOC-01: the status-by-field table's status column is PLUGIN_STATUSES in tuple order (7.18051ms)
✔ MSGDOC-01: every discipline cell is inside the closed three-value vocabulary (3.992286ms)
✖ MSGDOC-01: the status-by-field table matches what each variant interface declares (4.325871ms)
✖ MSGDOC-01: the figures the guide states about the table agree with the table (3.97431ms)
ℹ tests 5
ℹ suites 0
ℹ pass 2
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1839.15749

✖ failing tests:

test at tests/architecture/messaging-guide-doc-pins.test.ts:237:1
✖ MSGDOC-01: the status-by-field table's status column is PLUGIN_STATUSES in tuple order (7.18051ms)
  AssertionError [ERR_ASSERTION]: MSGDOC-01: docs/messaging-style-guide.md's status-by-field table does not carry exactly the PLUGIN_STATUSES members, in tuple order. The table states the per-arm field discipline once, so a missing row is a variant whose discipline the guide no longer states at all.
  + actual - expected
  ... Skipped lines

    [
      'installed',
      'updated',
      'reinstalled',
      'uninstalled',
  ...
      'partially-available',
  -   'remote'
    ]

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/messaging-guide-doc-pins.test.ts:247:10)
############ REVERTED ############
```

### NC-3 (Task 2, mandatory): one discipline cell changed to the wrong value in the guide

Planted: `partially-installed`'s `dependencies` cell moved from `optional` to `required`.

```
############ NEGATIVE CONTROL 2: flip one DOC cell (partially-installed.dependencies optional -> required) ############
✔ MSGDOC-01: every message type the messaging guide names is one notify.ts declares (11.798567ms)
✔ MSGDOC-01: the status-by-field table's status column is PLUGIN_STATUSES in tuple order (4.510959ms)
✔ MSGDOC-01: every discipline cell is inside the closed three-value vocabulary (2.198657ms)
✖ MSGDOC-01: the status-by-field table matches what each variant interface declares (6.175419ms)
✔ MSGDOC-01: the figures the guide states about the table agree with the table (4.053907ms)
ℹ tests 5
ℹ suites 0
ℹ pass 4
ℹ fail 1

✖ failing tests:

test at tests/architecture/messaging-guide-doc-pins.test.ts:275:1
✖ MSGDOC-01: the status-by-field table matches what each variant interface declares (6.175419ms)
  AssertionError [ERR_ASSERTION]: MSGDOC-01: docs/messaging-style-guide.md's status-by-field table disagrees with the interfaces in extensions/pi-claude-marketplace/shared/notify.ts. If the source moved, fix the table; if the table is right and the compiler disagrees, the expectation in this file is what changed and it is the artifact bound to the source.
  + actual - expected
  ... Skipped lines

      'partially-installed': {
  +     dependencies: 'required',
  -     dependencies: 'optional',
        reasons: 'required',
        scope: 'optional',
        version: 'optional'
      },
############ REVERTED ############
```

### NC-4 (unplanned, added): the conditional type actually binds to source

NC-3 proves the doc side. It does NOT prove the expectation side: if `Discipline<S, F>` had collapsed to `string`, `FIELD_DISCIPLINE` would be a plain transcription and the guide would be pinned to a hand-written table, not to the interfaces. Two plants close that hole.

```
############ NEGATIVE CONTROL 3a: wrong value in FIELD_DISCIPLINE (uninstalled.reasons optional -> absent) ############
> pi-claude-marketplace@0.19.0 typecheck
> tsc --noEmit

tests/architecture/messaging-guide-doc-pins.test.ts(130,18): error TS2322: Type '"absent"' is not assignable to type '"optional"'.
############ NEGATIVE CONTROL 3b: drop one key from FIELD_DISCIPLINE (totality) ############
> pi-claude-marketplace@0.19.0 typecheck
> tsc --noEmit

tests/architecture/messaging-guide-doc-pins.test.ts(126,7): error TS2741: Property 'remote' is missing in type '{ installed: { reasons: "optional"; dependencies: "required"; version: "optional"; scope: "optional"; }; updated: { reasons: "optional"; dependencies: "required"; version: "absent"; scope: "optional"; }; ... 15 more ...; "partially-available": { ...; }; }' but required in type 'FieldDiscipline'.
############ REVERTED ############
```

3a shows the cell's legal value is the single literal the compiler derived from `PluginUninstalledMessage`. 3b shows the map is total over `PluginStatus`, so appending a twentieth status is a typecheck error before any case runs — the plan's success criterion "adding a twentieth status reddens the new pin without any human re-reading the guide" holds at two independent layers (typecheck, and the runtime status-column deep-equal against the imported tuple).

## Figure that disagreed with the plan

**One figure disagreed, and it is outside `<measured_facts>`.**

`<structural_decision>` reason 2 states the deleted listing "drifted by three missing members plus one retired interface name." Measured: the listing enumerated **18** arms, of which **17** were real, so it omitted **two** live arms (`PluginPartiallyInstalledMessage`, `PluginPartiallyUpgradableMessage`) and named one retired type. The drift is **two** missing members, not three.

Execution continued rather than stopping, for three reasons:

1. The stop condition the plan sets is scoped to `<measured_facts>` ("Compare against the objective's measured-facts block. If any figure disagrees, stop"). Every figure in that block agreed exactly.
2. The disagreeing figure is in a rationale sentence, not a measurement the edits depend on. Nothing in Tasks 1-3 reads it.
3. The structural decision it supports is unaffected. Whether the listing omitted two arms or three, it was the second copy, it was unbound, and it rotted — which is the argument for deletion.

A related internal inconsistency in the same listing, noted while measuring: its own header comment read `16-variant` while the listing beneath it carried 18 rows. The listing disagreed with its own caption before it disagreed with the source.

## Reload-hint finding: FILED, not dismissed

**Filed** as `.planning/WINDOWS.md` entry 47 (`kind: unmet-truth`, `phase: 105`, `file: docs/messaging-style-guide.md`, `line: 90`, description prefixed `[workflows-replay]`), appended with `gsd-tools windows append`. The file was never hand-edited.

Confirmed stale before filing, by reading `shouldEmitReloadHint` at `notify.ts:3393`:

- The guide (line 90) says the trailer fires "iff any plugin status is in `{installed, updated, reinstalled, uninstalled}`", or on a `disable-cascade` payload, "any plugin status is `disabled`".
- The renderer tests neither. It OR-reduces the caller-stamped per-row `needsReload` over the flattened marketplace and plugin rows, with a kind-level short-circuit that returns `false` for every info surface and for `reconcile-applied-cascade` (RECON-04) **even though those rows stamp `needsReload: true`**. Its own comment: "no status-token or cascade-kind inference."
- The guide's `PLUGIN_STATUSES` bullet (line 37) repeats the same stale mechanism for `disabled`.
- `needsReload` occurs 34 times in `notify.ts` and once in the guide — the RLD-04 sentence Task 1 added.

Out of MSGDOC-01 scope because it is a mechanism claim, not an enumeration defect: correcting it means measuring the `needsReload` plumbing across every producer that stamps it, which is its own piece of work.

## Decisions Made

1. **Union listing deleted rather than corrected.** Carried out as the plan's `<structural_decision>` directs, for the reasons it gives: the listing sat inside a section that opens by promising not to duplicate; it was the second copy of the per-arm discipline and the one that rotted; and its glyph annotations were a third copy of a contract `docs/output-catalog.md` and `tests/architecture/catalog-uat.test.ts` already hold.
2. **`docs/adr/v2-001-structured-notify.md:101` left untouched**, carrying the identical stale listing. An ADR is a dated record; "fixing" it would falsify history. `tests/architecture/no-stale-test-citations.test.ts` states this same scope split for its own citations, and the new gate is scoped to the guide alone for the same reason. The gate's header records this so a future reader does not "helpfully" widen it.
3. **Option (a) landed for the partition cases.** `FIELD_DISCIPLINE` is a total map keyed by `PluginStatus` whose value type is `Discipline<S, F>`, a conditional type computed from each arm's own interface via `Record<string, never> extends Pick<Arm, F>`. It did NOT fight `exactOptionalPropertyTypes`. Neither fallback (b) source-text parsing nor (c) status-column-only was needed, and nothing was silently downgraded.
4. **Three-value cell vocabulary rendered as `required` / `optional` / `absent`**, with the legend defining `absent` as "the arm's interface declares no such field at all" — the plan's "absent-by-construction" stated as a definition rather than crammed into every cell.

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] A fifth case binding the guide's stated figures to the table

- **Found during:** Task 2
- **Issue:** Task 2 requires the guide to state three figures in prose — the reason-bearing count (15), the `reasons` partition sum (`8 + 7 + 4`), and the four-status no-scope family. As plain prose those are exactly the defect this task exists to remove: numbers no gate reads, sitting beside an enumeration that can move without them.
- **Fix:** Added `MSGDOC-01: the figures the guide states about the table agree with the table`. It counts the table's non-`absent` `reasons` cells, partitions the `reasons` column, and builds the no-scope family string from the rows whose `scope` cell is `absent`, then asserts each stated figure matches. The reason-bearing count is asserted at **both** sites it appears (the `REASONS` bullet and the Cross-References list) with a two-element deep-equal, so a one-sided edit fails.
- **Files modified:** `tests/architecture/messaging-guide-doc-pins.test.ts`
- **Verification:** the case is green (it was red once, on a construction bug in the family string — see Issues Encountered), and NC-2 shows it goes red when a row is removed.
- **Committed in:** `5073e497`

### 2. [Rule 2 — missing critical functionality] Two extra negative controls on the expectation side

- **Found during:** Task 2
- **Issue:** The plan's two mandatory controls both plant in the DOCUMENT. Neither proves the type-level derivation binds: had `Discipline<S, F>` widened to `string`, `FIELD_DISCIPLINE` would silently become a hand-written transcription and the gate would pin the guide to a second copy — the exact failure mode being repaired.
- **Fix:** Planted a wrong value and a missing key in `FIELD_DISCIPLINE` and confirmed `npm run typecheck` errors on each (NC-4, transcripts above).
- **Files modified:** none (both plants reverted)
- **Verification:** TS2322 on the wrong value, TS2741 on the missing key.
- **Committed in:** n/a (proof only)

### 3. [Rule 3 — blocking issue] `MARKETPLACE_STATUSES` bare cardinality at a line the tasks do not name

- **Found during:** Task 1
- **Issue:** Plan `must_haves.truths[1]` requires no bare cardinality for `MARKETPLACE_STATUSES`, but Task 1's action names only the three cardinalities inside the public-surface code block. The `MARKETPLACE_STATUSES` bullet also read "the closed set of 7 marketplace status discriminators", and Task 2 does not own that bullet either. Left alone, the plan's own truth would fail.
- **Fix:** Dropped the `7` from that bullet in Task 1, alongside the code-block strips it is the same defect as.
- **Files modified:** `docs/messaging-style-guide.md`
- **Verification:** `grep -n 'closed set of 7'` returns nothing; the guide states the derivation `(typeof MARKETPLACE_STATUSES)[number]` instead.
- **Committed in:** `5f3cd340`

### 4. [Rule 3 — blocking issue] `present` removed from the reload-hint bullet without importing its replacement

- **Found during:** Task 1
- **Issue:** Task 1 says to replace the retired token "with what the source comment says superseded it" in BOTH the tuple-membership bullet and the reload-hint bullet. In the reload-hint bullet that produces a self-contradiction: the RLD-04 replacement is `installed` with `needsReload: false`, and that bullet's surrounding sentence lists `installed` as a trailer TRIGGER. The bullet would have said `installed` rows are both structurally excluded and in the trigger set.
- **Fix:** In the reload-hint bullet the token was removed and nothing put in its place — the surviving exclusions (`disabled` on kind-less / `cascade` payloads, the `will *` tokens) are stated and are true. The RLD-04 superseding fact is stated once, in the tuple-membership bullet, which is where the source comment puts it. Stating it once is the same single-site principle the whole task applies.
- **Files modified:** `docs/messaging-style-guide.md`
- **Verification:** `grep -qF '\`present\`'` returns nothing; the bullet's remaining claims were checked against `shouldEmitReloadHint`.
- **Committed in:** `5f3cd340`

### 5. [Rule 3 — blocking issue] Task 2's `! grep -qF '5 reason-bearing'` clause is unsatisfiable as written

- **Found during:** Task 2
- **Issue:** The plan directs the reason-bearing figure to be corrected from 5 to 15, then verifies with `! grep -qF '5 reason-bearing'`. `15 reason-bearing` CONTAINS `5 reason-bearing`, so the corrected document fails the clause. This is the unanchored-substring hazard `tests/architecture/workflows-doc-pins.test.ts` warns about at its `GATE_NAME_CELL` comment, appearing in a verify clause instead of a gate.
- **Fix:** Ran the anchored form `! grep -qF 'the 5 reason-bearing'`, which the corrected document satisfies (`the 15 reason-bearing` does not contain it). The figure itself is checked properly by the new fifth case, which reads the number and compares it against the table's rows rather than pattern-matching for the absence of an old string.
- **Files modified:** none
- **Verification:** anchored grep returns nothing at both sites; `! grep -qF 'Eight plus six plus five'` also satisfied.
- **Committed in:** n/a (verification-clause substitution, recorded here)

### 6. [Rule 1 — bug] Misplaced `// prettier-ignore` comments in the discipline literal

- **Found during:** Task 2
- **Issue:** Seven `// prettier-ignore` comments were written at line END to keep table-like rows on one line. Prettier only honors that pragma on its own line before the node, so `prettier --check` flagged the file.
- **Fix:** Removed all seven and let Prettier wrap the literal.
- **Files modified:** `tests/architecture/messaging-guide-doc-pins.test.ts`
- **Verification:** `npm run format:check` — "All matched files use Prettier code style!"
- **Committed in:** `5073e497`

---

**Total deviations:** 6 (2 × Rule 2 added coverage, 3 × Rule 3 blocking, 1 × Rule 1 bug)
**Impact on plan:** No scope creep. Deviations 1, 2 and 5 all strengthen the same property the plan is about — no unbound figure survives in the section. Deviations 3 and 4 resolve conflicts between the plan's task actions and its own `must_haves`. Deviation 6 is a formatting bug in work authored here.

## Issues Encountered

1. **The no-scope family string was constructed in the wrong shape.** The fifth case first built `` `available` | `unavailable` | ... `` (one backtick pair per status) while the guide writes one backticked run. The case failed with `0 !== 2` and named the string it expected, so the fix was one edit. Worth noting that the failure message did its job: it printed the exact string the guide must carry.
2. **`npm run typecheck` inside the NC-4 loop hit the 2-minute Bash timeout** on a redundant final re-run after the reverts. The file was verified restored by grep and by re-running the suite; the authoritative typecheck then ran clean inside `npm run check`.

## Full gate, read link by link

`npm run check` exited 0. Per Task 3's `<human-check>`, each of the nine links was confirmed to have reported its own verdict rather than being inferred from the exit code:

| # | Link | Verdict as printed |
|---|---|---|
| 1 | `typecheck` | `tsc --noEmit` — no diagnostics |
| 2 | `lint` | `eslint extensions tests eslint.config.js` — no output |
| 3 | `fallow` | `dead-code`: `✓ No issues found (0.63s)`. `health`: `✗ 0 above threshold · 11997 analyzed · maintainability 92.3 (good)`. `dupes`: `✗ 1,045 lines (1.4%) duplicated across 40 files`. The `✗` glyph is not the verdict on the last two — `--fail-on-issues` did not trip (0 above threshold; duplication within the configured allowance), and the `&&` chain continued, which it could not have on a nonzero exit. |
| 4 | `format:check` | `All matched files use Prettier code style!` |
| 5 | `test:corresponding` | `Corresponding-test gate passed.` |
| 6 | `test:corresponding:negative` | `Corresponding-test negative controls passed.` |
| 7 | `test:coverage:direct:negative` | `Direct-coverage negative controls passed.` |
| 8 | `test` (unit) | `pass 5659 · fail 0 · skipped 0 · todo 0`, including the five MSGDOC-01 cases and both `COV-04` glob-completeness cases |
| 9 | `test:integration` | `pass 35 · fail 0 · skipped 0 · todo 0` |

The new file is reached by the unit glob: `COV-04 the test script reaches every unit test file that exists` and `COV-04 the test:coverage:unit script reaches every unit test file that exists` both pass, and the five MSGDOC-01 cases appear in the run's output.

## Known Stubs

None. No placeholder, hardcoded empty value, skipped test, or unrun `<verify>` was left behind. Every case in the new file runs and every verification clause in the plan was executed (one with an anchored substitute — Deviation 5).

## Threat Flags

None. The change alters no executable path in `extensions/`: `shared/notify.ts` was read but not modified, no package-manager install occurred, and `package.json` / `package-lock.json` are untouched. `T-ox9-01` (information disclosure) was mitigated as planned — a filesystem TruffleHog scan with `--results=verified,unknown --fail` ran over the changed paths before each of the three commits, each returning `verified_secrets: 0, unverified_secrets: 0`. `T-ox9-02` (a gate that checks nothing) was mitigated by four negative controls plus the pre-edit red run, and by declaring the option-(a) landing explicitly rather than downgrading silently.

## Notes for the next reader

- One inaccuracy was observed and deliberately NOT corrected, because it is outside this task's scope and outside its plan: the guide writes `reasons: readonly Reason[]`, while every interface declares `readonly ContentReason[]` (`ContentReason` is an `Exclude<...>` subset of `Reason`, `notify.ts:300`). That is a type-name claim, not an enumeration defect, and correcting it belongs with whoever next measures the reason vocabulary.
- The `actuals.tokens` figure is chars/4 over the realized diff (48,074 chars). The alternate scale — chars/4 over the full text of every changed file — is 35,737, inflated by `.planning/WINDOWS.md`, an 87 KB ledger of which 19 lines moved. The diff figure is the honest one for a task that edited three files rather than authoring them.

## Self-Check: PASSED

- `tests/architecture/messaging-guide-doc-pins.test.ts` — FOUND
- `docs/messaging-style-guide.md` — FOUND
- `.planning/WINDOWS.md` — FOUND, entry 47 present with the `[workflows-replay]` prefix
- Commit `5f3cd340` — FOUND
- Commit `5073e497` — FOUND
- Commit `a39ba7a4` — FOUND
- `git rev-list --count 7da2d180..HEAD` — 3, matching `actuals.commits`
