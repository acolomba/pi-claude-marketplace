---
phase: 115-install-time-admission-gate-warnings
plan: 05
subsystem: api
tags: [workflows, published-contract, doc-pins, architecture-gate, admission-gates]
status: complete

requires:
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 01: GATE_ORDER, the derived WorkflowGate union, the two Record<WorkflowGate, ...> totality locks, and the three measured engine corrections"
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 02: the control-D lesson that a bare prefix match is green for a name-EXTENDING rename, and the stripComments-before-matching discipline"
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 03: reinstall's discovery channel, which is what lets the document say all four verbs name the check without a per-verb exception"
  - phase: 114-degradation-and-documentation
    provides: "docs/workflows-compatibility.md::the published contract and tests/architecture/workflows-doc-pins.test.ts::its three existing pins"
provides:
  - "docs/workflows-compatibility.md::the six-column classification table stating replicate / warn / neither per engine check, with the union member named on every warned row"
  - "docs/workflows-compatibility.md::the retracted paragraph, replaced by what is warned and why warning was chosen over refusing"
  - "tests/architecture/workflows-doc-pins.test.ts::the fourth case -- column totality, the three row-number partitions, the ordered doc-to-union deepEqual, and placeholder discipline"
  - "the four-direction negative-control transcripts on the union-to-document construct, direction 3 included"
affects:
  - "116/117: the document now states the warn behaviour as a contract; a later phase that adds or drops an engine gate must move GATE_ORDER and the table together or the fourth case reddens"
  - "any WPIN-01 re-read: the classification table's Notes cells carry the reserved-key and unreachability facts that a newer engine could move"

actuals:
  tokens: 6890
  tasks: 3
  commits: 2

plan_head_before: df81a0dbc3add4558a290ae97f72072b0fd2ca60

tech-stack:
  added: []
  patterns:
    - "a published table column parsed as a closed set, with the partition pinned by row number and the names bound to a tuple in a different language"
    - "a cell matcher anchored at BOTH ends of the trimmed cell, and a declaration matcher closed on the right by ` = [`, so no superstring satisfies either"
    - "a negative control whose third direction falsifies a COLUMN VALUE with no code change -- the direction that separates a gate reading names from a gate reading behaviour"

key-files:
  created: []
  modified:
    - docs/workflows-compatibility.md
    - tests/architecture/workflows-doc-pins.test.ts

key-decisions:
  - "MEASURED CORRECTION to this plan's own Task 1 instruction: it says row 8's note must record that the engine's reserved-key set is an internal `of which only one key is measured`. Plan 01 measured all three -- `__proto__`, `constructor` and `prototype` -- read verbatim from `evaluateLiteral`, and all three are in `RESERVED_META_KEYS` with a case each. Writing `only one key is measured` would have understated the replica in the one document whose job is not to understate. The note keeps the instruction's INTENT -- that the set is an unexported internal read at one version, so a key a later release adds is a missed warning and never a false one -- and states the measured three."
  - "The `This bridge` cells are written unbolded, as bare lowercase literals. The retired column bolded two of its five values and left three plain, which makes a cell's own formatting part of what a parser has to know. Three unformatted literals give the gate a full-cell anchor and give a reader one shape to scan."
  - "The module header's `Three claims ... are NOT prose` opener was raised to `Four`, and a fourth numbered entry added. The plan says to leave the DISCLAIMER in place, which is a different sentence and is untouched. Leaving the count at three would have shipped this milestone's signature defect -- an enumeration shorter than the set it names -- inside the gate written to prevent it."
  - "Direction 4 was run while direction 1's fabricated member was still planted, which is what both the plan and 115-VALIDATION specify, so the run order was 1, 4, restore, 2, restore, 3, restore. The transcripts below are numbered by direction, not by run order, and the order is stated here rather than left to be inferred."
  - "The divergence table's `meta.name` that is a number row was checked against plan 01's numeric-key correction and left standing. The correction is about a numeric object KEY (`{ 1: \"a\" }`, which the engine ADMITS); that row is about a numeric VALUE for `meta.name`, which `evaluateLiteral` resolves and `validateMeta` then refuses at check 9. The row was already right, and the document nowhere claims check 8 refuses a numeric key."

patterns-established:
  - "A three-valued published column beats a four-valued one plus prose. The retired column carried `replicates` / `no` / `partly` / `name only`; `partly` said nothing a reader could act on and `name only` was a fifth shape. Three values plus a Notes cell states the same nuance and can be gated."
  - "Derive every count in a document from the artifact it introduces, at edit time. Eight divergence rows, nine classification rows, six validateMeta bullets and two replicated checks were each recounted rather than carried forward."

requirements-completed: [WGATE-05, WGATE-01]

coverage:
  - id: D1
    description: "Every row of the classification table states one of exactly three values, and the partition matches what the bridge implements"
    requirement: WGATE-05
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-doc-pins.test.ts#WGATE-05: the classification column is closed and its warned rows name the source's gate union"
        status: pass
      - kind: other
        ref: "control direction 3: row 9 falsified from warn to neither with no code change -- red; transcript in Controls Run"
        status: pass
    human_judgment: false
  - id: D2
    description: "The doc's warned gate names equal the source's closed union, in order, and no non-warned row can hide a gate name"
    requirement: WGATE-05
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-doc-pins.test.ts#WGATE-05: the classification column is closed and its warned rows name the source's gate union"
        status: pass
      - kind: other
        ref: "control directions 1 and 2: the union grown by one member, and one warned row's gate name deleted -- red in both; transcripts in Controls Run"
        status: pass
    human_judgment: false
  - id: D3
    description: "The typecheck half of the totality construct is live: the Record annotations, not something else, are what redden when the union grows"
    requirement: WGATE-05
    verification:
      - kind: other
        ref: "control direction 4: the TS2741 naming the predicate map DISAPPEARS when its annotation is removed; transcript in Controls Run"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three enumerations the existing gate already held still agree after the rewrite: nine numbered rows, six message bullets, both bolded count phrases verbatim, and no second numbered table"
    requirement: WGATE-05
    verification:
      - kind: unit
        ref: "tests/architecture/workflows-doc-pins.test.ts#WDOC-01: the refusal-check counts agree with the enumerations beneath them"
        status: pass
      - kind: other
        ref: "grep -c '^| [0-9]' docs/workflows-compatibility.md -- 9"
        status: pass
    human_judgment: false
  - id: D5
    description: "The retracted sentence is gone rather than annotated, and every sentence that leaned on it moved with it"
    requirement: WGATE-05
    verification:
      - kind: other
        ref: "git show 104c85b5 -- the six moved sites are in one diff; grep -ci 'deliberately not implemented' returns 0"
        status: pass
    human_judgment: true
    rationale: "Whether the replacement paragraph reads honestly, and whether check 7's note explains unreachability rather than undetectability, is prose judgement. 115-VALIDATION names this reviewer-read and that is the honest ceiling; the gate can pin the column value, not the explanation."

duration: 40min
completed: 2026-09-09
---

# Phase 115 Plan 05: The published admit-versus-run contract — Summary

**The document that said install-time warnings for these shapes are deliberately not implemented now states, per engine check, whether this bridge replicates it, warns about it, or does neither — with the union member named on every warned row, bound to `GATE_ORDER` by a gate proven red in four directions, including the one that falsifies a column value with no code change.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-09T06:35Z (plan base `df81a0db`)
- **Completed:** 2026-09-09T07:15Z
- **Tasks:** 3 of 3
- **Files modified:** 2

## Accomplishments

- **A three-valued column, and every value measured.** Rows 1 and 2 `replicate`, rows 3, 4, 5, 6, 8 and 9 `warn`, row 7 alone `neither`. That is D-115-01's measured set, which differs from the ROADMAP's criterion-1 list three ways — it names check 3 twice, names check 7, and omits check 6. The table was built from the measurement.
- **Check 7's note says UNREACHABLE, not undetectable.** `export const meta;` is a syntax error acorn rejects at the engine's check 2 (`Unexpected token (1:17)`), and every non-`const` form fails check 4 first, so no parseable script arrives there. The two facts are different, and conflating them would leave a reader believing the bridge cannot see something it can.
- **Nothing in the document claims a check needs the script to be evaluated.** Row 8's note states the opposite in the engine's own terms: every arm is decidable from the node type. The CONTEXT's substituted-template example, which D-115-03 measured wrong, does not appear.
- **The retraction is a rewrite, not a note.** The half of the old sentence that was true — the strict direction does not self-correct — is now the argument FOR what shipped, stated as the asymmetry between a spurious warning and a spurious refusal.
- **The gate binds two artifacts one edit cannot move together.** The union lives in TypeScript, the rows live in markdown, and the fourth case deep-equals them in order. Its three companion assertions close the column as a set, pin the partition by row number, and forbid a gate name on a row the document says is not warned.
- **Direction 3 was red.** The gate compares column values, not merely gate names, so the defect that direction exists to detect is absent here.

## Task Commits

1. **Task 1: restate the contract and retract the sentence** — `104c85b5` (`docs(115-05)`)
2. **Task 2: bind the doc's rows to the gate union** — `6d2ee769` (`test(115-05)`)
3. **Task 3: the four-direction negative control** — no commit, by construction: every plant is restored, and `git status --short` over the two source modules and the document prints nothing.

**Plan metadata:** committed with this SUMMARY.

`plan_head_before: df81a0dbc3add4558a290ae97f72072b0fd2ca60` — `git rev-list --count df81a0db..HEAD` = **2** at SUMMARY-write time, which is the `actuals.commits` figure above. `actuals.tokens` is `chars/4` over `git diff df81a0db..HEAD` (27559 chars), against a plan estimate of 60000 on the same instrument. That is an eightfold overestimate, recorded as measured rather than adjusted toward the estimate.

## Files Created/Modified

- `docs/workflows-compatibility.md` — the classification table restated with six columns; the divergence section's opening sentence; the bounded-failure paragraph; the retracted paragraph and the warn-versus-refuse paragraph that replaces it; the sentence that grouped rows by the retired `partly` value; three script-semantics rows; and the installed-with-a-caveat disposition.
- `tests/architecture/workflows-doc-pins.test.ts` — the fourth case, plus `ANALYZER`, `BRIDGE_VALUES`, `GATE_NAME_PLACEHOLDER`, `GATE_NAME_CELL`, `GATE_ORDER_DECLARATION`, `ClassificationRow`, `classificationRows()` and `gateOrderMembers()`. The module header's opener moved from three claims to four. No existing assertion was removed, loosened, or re-pointed.

## Decisions Made

See `key-decisions` in the frontmatter. The one that changes what the document says:

**The reserved-key note states three names, because three is what was measured.** This plan's Task 1 instruction says to record that the engine's reserved-key set is an internal "of which only one key is measured". Plan 01 measured all three and pins all three. The note keeps the instruction's real point — the set is an unexported internal read at one version, so the failure direction of a later addition is a missed warning rather than a false one — and drops a figure that was already retired inside this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Task 1's reserved-key instruction states a figure this phase already falsified**

- **Found during:** Task 1, at the mandated read of `domain/workflow-script.ts` as plans 01 and 02 left it.
- **Issue:** the instruction requires row 8's note to record that the engine's reserved-key set is "an unexported internal of which only one key is measured, so an unmeasured reserved key is a missed warning rather than a false one". Plan 01's deviation 3 measured the set as three names — `__proto__`, `constructor`, `prototype` — read verbatim from `evaluateLiteral`, and all three are in `RESERVED_META_KEYS` with a case each and a test row each. Writing "only one key is measured" into the published contract would have understated the replica by two thirds, in the one document whose stated prohibition is not to understate.
- **Fix:** the note states the risk without the retired figure: "The reserved key names are read at 3.10.1 and are not an exported contract, so a name a later release adds is a missed warning, never a false one." The direction-of-failure claim, which is the load-bearing half, is preserved verbatim in meaning.
- **Files modified:** `docs/workflows-compatibility.md`.
- **Verification:** `grep -n RESERVED_META_KEYS -A 6` over the analyzer shows three members; plan 01's Control 1 transcript shows three `REFUSES | reserved key name not allowed` rows.
- **Committed in:** `104c85b5`.

**2. [Rule 2 — Missing critical functionality] The gate's own header enumerated three claims while the file now holds four**

- **Found during:** Task 2.
- **Issue:** the plan says to leave the module header's disclaimer in place, and it is untouched. But the header's opening sentence is a different sentence — "Three claims in that document are NOT prose" — and adding a fourth case without moving it would have shipped an enumeration shorter than the set it names, inside the gate this milestone added to catch that class. It has now been the milestone's recurring defect eight times.
- **Fix:** the opener reads "Four", and a fourth numbered entry describes the two bound columns and why one edit cannot satisfy both halves. The disclaimer paragraph beneath it — that the gate does not claim `nine` and `six` are the engine's real figures, and that `WPIN-01` remains deferred — is unchanged.
- **Files modified:** `tests/architecture/workflows-doc-pins.test.ts`.
- **Verification:** the header now numbers 1 through 4 and the file registers four cases; `node --test` reports `tests 4`.
- **Committed in:** `6d2ee769`.

**3. [Rule 3 — Blocking issue] The `This bridge` cells are unformatted literals, where the retired column mixed bold and plain**

- **Found during:** Task 1.
- **Issue:** the retired column wrote `**replicates**` on two rows and `no` / `partly` / `name only` plain on the rest. Carrying that habit forward would make a cell's own markdown part of what the new gate has to parse, and a bolded value is one backtick-or-asterisk edit away from a cell the gate reads as a fourth value.
- **Fix:** all nine `This bridge` cells are bare lowercase literals, and the gate matches the trimmed cell against the three-member set with no unwrapping. The `Gate name` cells stay in backticks, because they are identifiers and the document sets identifiers in code spans everywhere else; that cell is unwrapped by a regex anchored at both ends.
- **Files modified:** `docs/workflows-compatibility.md`, `tests/architecture/workflows-doc-pins.test.ts`.
- **Verification:** the parse probe under Controls Run prints all nine rows with six cells each and the expected values.
- **Committed in:** `104c85b5`, `6d2ee769`.

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 1 × Rule 2, 1 × Rule 3). **Zero Rule 4 escalations.**

**Impact on plan:** deviation 1 moves the published contract toward the measurement and away from a figure the phase itself retired one plan earlier. Deviation 2 is the milestone's short-enumeration pattern appearing an eighth time, this time in the header of the gate being extended. Deviation 3 makes the new column parseable without a formatting convention. No scope creep: no new production symbol, no new file, no dependency, no orchestrator or bridge touched, and no existing assertion weakened.

## Controls Run

The four directions of the negative control on the union-to-document construct, pasted verbatim. **Run order was 1, 4, restore, 2, restore, 3, restore** — direction 4 requires direction 1's plant to still be in place, which is what the plan and `115-VALIDATION.md` both specify. They are numbered below by direction.

### The parse probe that preceded the controls

Run after Task 2 went green and before any plant, so the case was known to be reading real cells rather than passing on empty projections:

```text
[
 { "n": 1, "cells": 6, "bridge": "replicate", "gate": "--" },
 { "n": 2, "cells": 6, "bridge": "replicate", "gate": "--" },
 { "n": 3, "cells": 6, "bridge": "warn", "gate": "meta-not-first-export" },
 { "n": 4, "cells": 6, "bridge": "warn", "gate": "meta-not-const-export" },
 { "n": 5, "cells": 6, "bridge": "warn", "gate": "meta-not-sole-declarator" },
 { "n": 6, "cells": 6, "bridge": "warn", "gate": "meta-not-named-meta" },
 { "n": 7, "cells": 6, "bridge": "neither", "gate": "--" },
 { "n": 8, "cells": 6, "bridge": "warn", "gate": "meta-not-pure-literal" },
 { "n": 9, "cells": 6, "bridge": "warn", "gate": "meta-fields-invalid" }
]
members: [
  'meta-not-first-export',
  'meta-not-const-export',
  'meta-not-sole-declarator',
  'meta-not-named-meta',
  'meta-not-pure-literal',
  'meta-fields-invalid'
]
```

### Direction 1 — the union grows and the document does not

`"fabricated-gate"` appended to `GATE_ORDER`, nothing else touched:

```text
const GATE_ORDER = [
  "meta-not-first-export",
  "meta-not-const-export",
  "meta-not-sole-declarator",
  "meta-not-named-meta",
  "meta-not-pure-literal",
  "meta-fields-invalid",
  "fabricated-gate",
] as const;
=== typecheck ===
extensions/pi-claude-marketplace/bridges/workflows/discover.ts(162,7): error TS2741: Property '"fabricated-gate"' is missing in type '{ "meta-not-first-export": string; "meta-not-const-export": string; "meta-not-sole-declarator": string; "meta-not-named-meta": string; "meta-not-pure-literal": string; "meta-fields-invalid": string; }' but required in type 'Record<"meta-not-first-export" | "meta-not-const-export" | "meta-not-sole-declarator" | "meta-not-named-meta" | "meta-not-pure-literal" | "meta-fields-invalid" | "fabricated-gate", string>'.
extensions/pi-claude-marketplace/domain/workflow-script.ts(898,7): error TS2741: Property '"fabricated-gate"' is missing in type '{ "meta-not-first-export": (ctx: GateContext) => boolean; "meta-not-const-export": (ctx: GateContext) => boolean; "meta-not-sole-declarator": (ctx: GateContext) => boolean; "meta-not-named-meta": (ctx: GateContext) => boolean; "meta-not-pure-literal": (ctx: GateContext) => boolean; "meta-fields-invalid": (ctx: GateC...' but required in type 'Record<"meta-not-first-export" | "meta-not-const-export" | "meta-not-sole-declarator" | "meta-not-named-meta" | "meta-not-pure-literal" | "meta-fields-invalid" | "fabricated-gate", (ctx: GateContext) => boolean>'.
TYPECHECK_EXIT=2
```

Both `Record` locks fire, in two files a single edit cannot change together. The doc-pin gate, in the same configuration:

```text
✔ WDEP-04: the compatibility doc states this project's peer floor as package.json declares it (11.52009ms)
✔ WDOC-01: the refusal-check counts agree with the enumerations beneath them (3.77486ms)
✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.751428ms)
✔ WDOC-01: both READMEs carry the workflows entry in Features and in Prerequisites (4.112121ms)
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ failing tests:

✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.751428ms)
  AssertionError [ERR_ASSERTION]: WGATE-05: docs/workflows-compatibility.md's warned rows name a different gate set, or a different order, than `GATE_ORDER` declares in extensions/pi-claude-marketplace/domain/workflow-script.ts. The union and the table are two artifacts one edit cannot move together; whichever side changed, the other has to follow.
  + actual - expected

    [
      'meta-not-first-export',
      'meta-not-const-export',
      'meta-not-sole-declarator',
      'meta-not-named-meta',
      'meta-not-pure-literal',
      'meta-fields-invalid',
  -   'fabricated-gate'
    ]
DOCPIN_EXIT=1
```

### Direction 2 — a document row loses its gate name and the union does not change

Row 5's `` `meta-not-sole-declarator` `` cell emptied, code untouched:

```text
| 5   | exactly one declarator                             | "meta export must declare only `meta`"                                                          | warn        |                            |
=== doc-pin gate ===
✔ WDEP-04: the compatibility doc states this project's peer floor as package.json declares it (8.283584ms)
✔ WDOC-01: the refusal-check counts agree with the enumerations beneath them (4.326929ms)
✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.606517ms)
✔ WDOC-01: both READMEs carry the workflows entry in Features and in Prerequisites (4.179303ms)
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ failing tests:

✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.606517ms)
  AssertionError [ERR_ASSERTION]: WGATE-05: docs/workflows-compatibility.md's warned rows name a different gate set, or a different order, than `GATE_ORDER` declares in extensions/pi-claude-marketplace/domain/workflow-script.ts. The union and the table are two artifacts one edit cannot move together; whichever side changed, the other has to follow.
  + actual - expected

    [
      'meta-not-first-export',
      'meta-not-const-export',
  +   '',
  -   'meta-not-sole-declarator',
      'meta-not-named-meta',
      'meta-not-pure-literal',
      'meta-fields-invalid'
    ]
```

### Direction 3 — a document row's column VALUE falsified, with no code change

**This is the direction that matters, and it is RED.** Row 9's `This bridge` cell changed from `warn` to `neither`; its gate name, the union, the predicates and the reasons are all untouched. The one-line diff is the proof that nothing but the column value moved:

```text
| 9   | `validateMeta` on the evaluated object             | one of six messages, below                                                                      | neither     | `meta-fields-invalid`      | the `description`, `model
=== git diff (proves only the column value moved) ===
 docs/workflows-compatibility.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
=== doc-pin gate ===
✔ WDEP-04: the compatibility doc states this project's peer floor as package.json declares it (10.148184ms)
✔ WDOC-01: the refusal-check counts agree with the enumerations beneath them (3.948932ms)
✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.932739ms)
✔ WDOC-01: both READMEs carry the workflows entry in Features and in Prerequisites (4.769536ms)
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ failing tests:

✖ WGATE-05: the classification column is closed and its warned rows name the source's gate union (5.932739ms)
  AssertionError [ERR_ASSERTION]: WGATE-05: docs/workflows-compatibility.md's classification partition moved. If the bridge's behavior genuinely changed, re-derive this expectation from a measurement against the engine -- do not edit it to match the document, which is the artifact under test.
  + actual - expected
  ... Skipped lines

    {
      neither: [
        7,
  +     9
      ],
      replicate: [
        1,
        2
      ],
  ...
        8,
  -     9
      ]
    }
```

The gate compares column values, not merely gate names. No strengthening was needed and no direction was re-run.

### Direction 4 — the construct's own liveness

Direction 1's fabricated member still planted, and the `Record<WorkflowGate, (ctx: GateContext) => boolean>` annotation removed from `GATE_PREDICATES`. Recorded as observed:

```text
898:const GATE_PREDICATES = {
=== typecheck ===
extensions/pi-claude-marketplace/bridges/workflows/discover.ts(162,7): error TS2741: Property '"fabricated-gate"' is missing in type '{ "meta-not-first-export": string; ... }' but required in type 'Record<"meta-not-first-export" | ... | "fabricated-gate", string>'.
extensions/pi-claude-marketplace/domain/workflow-script.ts(846,38): error TS7053: Element implicitly has an 'any' type because expression of type '"meta-not-first-export" | "meta-not-const-export" | "meta-not-sole-declarator" | "meta-not-named-meta" | "meta-not-pure-literal" | "meta-fields-invalid" | "fabricated-gate" ' can't be used to index type '{ "meta-not-first-export": (ctx: any) => boolean; ... }'.
  Property 'fabricated-gate' does not exist on type '{ "meta-not-first-export": (ctx: any) => boolean; ... }'.
extensions/pi-claude-marketplace/domain/workflow-script.ts(899,29): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
extensions/pi-claude-marketplace/domain/workflow-script.ts(900,29): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
extensions/pi-claude-marketplace/domain/workflow-script.ts(901,32): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
extensions/pi-claude-marketplace/domain/workflow-script.ts(902,27): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
extensions/pi-claude-marketplace/domain/workflow-script.ts(903,29): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
extensions/pi-claude-marketplace/domain/workflow-script.ts(904,27): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
TYPECHECK_EXIT=2
```

**The attribution.** The TS2741 that NAMED the predicate map — `workflow-script.ts(898,7)`, the second error of direction 1 — is gone. That disappearance is the criterion: direction 1's redness at that site came from the annotation, and not from something else that happens to redden whenever the tuple grows. What replaced it is informative rather than confounding. Unannotated, the map's inferred type has six keys, so the failure moves to the USE site (TS7053 at line 846, inside `readEngineGate`'s own lookup) and the parameters lose their contextual type (six TS7006). The bridge-side `Record<WorkflowGate, string>` lock stayed red in both configurations, so neither configuration would let a seventh gate through silently — but only the annotated one fails at the map itself, which is what makes it the lock.

### Restored state, after every direction

```text
--- restore ---
(empty above == restored)
CLEAN_EXIT=0
TYPECHECK_EXIT=0
✔ WDEP-04: the compatibility doc states this project's peer floor as package.json declares it (9.808908ms)
✔ WDOC-01: the refusal-check counts agree with the enumerations beneath them (3.898325ms)
✔ WGATE-05: the classification column is closed and its warned rows name the source's gate union (3.425745ms)
✔ WDOC-01: both READMEs carry the workflows entry in Features and in Prerequisites (2.711468ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

Each direction reddens the fourth case and leaves the other three green, so no case is passing on another's evidence. Every plant went into the real file and every restore was confirmed with `git status --short`; `git stash` was not used, in either direction.

## Counts, and where each came from

Every number the edited sections state was recounted against the artifact that carries it, rather than carried forward:

| Figure | Where stated | How derived |
|---|---|---|
| nine checks | `**nine distinct checks**`, and "The nine checks, in the order the engine runs them" | `grep -c '^\| [0-9]'` over the whole document = 9, which is also the gate's `[1..9]` deepEqual |
| two replicated | "This bridge replicates **two** of them" | rows 1 and 2 of the classification table, and the gate's `replicate` partition |
| six warned | "Six of the seven checks this bridge does not replicate" | the `warn` partition = rows 3, 4, 5, 6, 8, 9, deep-equalled against `GATE_ORDER`'s six members |
| one `neither` | row 7 | the `neither` partition = [7] |
| eight rows | "the widest of the eight rows" | the divergence table's body rows: 10 lines opening `\| ` minus its header and separator |
| six messages | `**six distinct messages**` | the gate's `messageBullets.length === 6` over the list beneath it |
| three reserved keys | row 8's Notes cell states the risk without a count | `RESERVED_META_KEYS` in the analyzer holds three, so no figure was written that a reader could find short |

## Verification Results

Every `<automated>` command from every task, plus the plan-level block.

| Command | Result |
|---|---|
| `node --test tests/architecture/workflows-doc-pins.test.ts` (Task 1, before formatting) | 3 tests, 3 pass, 0 fail |
| `pre-commit run --files docs/workflows-compatibility.md` (Task 1) | `mdformat` rewrote the table padding on the first run; clean on the second, every other hook `Passed`, `trufflehog` structurally unavailable in a linked worktree (see Issues) |
| `node --test tests/architecture/workflows-doc-pins.test.ts` (Task 1, after formatting) | 3 tests, 3 pass, 0 fail — `mdformat`'s re-padding did not move a row past the row regex |
| `grep -c '^\| [0-9]' docs/workflows-compatibility.md` (Task 1) | 9 — no second numbered table entered the document |
| `node --test tests/architecture/workflows-doc-pins.test.ts` (Task 2) | 4 tests, 4 pass, 0 fail |
| `npm run lint` (Task 2) | exit 0; zero mentions of `tests/architecture/workflows-doc-pins.test.ts` |
| `npm run typecheck` (Task 2) | exit 0 |
| `git status --short` over the two modules and the document (Task 3) | exit 0, no output |
| `npm run typecheck` (Task 3, after restore) | exit 0 |
| `node --test tests/architecture/workflows-doc-pins.test.ts` (Task 3, after restore) | 4 tests, 4 pass, 0 fail |
| **`npm run check`** (plan level) | **exit 0** — typecheck, lint, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, **5644/5644** unit, **34/34** integration |
| **`pre-commit run --all-files`** (plan level) | every hook `Passed` except `trufflehog`, which fails structurally here and was answered by a filesystem scan per commit |
| `test -z "$(git diff HEAD --name-only -- package.json package-lock.json sonar-project.properties CHANGELOG.md)"` (plan level) | exit 0 — no manifest, Sonar property or changelog touched |

The baseline was 5643 unit tests. 5644 is +1: the single new architecture case, exactly the number added.

## TDD Gate Compliance

Not applicable. The phase resolved `phase.tdd-applicable` as false for this plan and no task carries `tdd="true"`: Task 1 rewrites a document, Task 2 extends a doc-pin gate over behavior plans 01 through 04 already shipped, and Task 3 writes nothing that survives. A failing-first test was available for none of them without asserting something false. Both commits carry the honest type for what they contain — `docs(115-05)` for the published contract, `test(115-05)` for the regression pin.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced; no test is skipped, `todo` or `only`; every `<verify>` command in every task was run with real output. Nothing was appended to `.planning/WINDOWS.md`, because nothing here is open — deviation 1 is a correction that landed, not a defect left standing.

## Threat Flags

None. The plan's `<threat_model>` covers every surface touched, and each `mitigate` disposition is implemented:

- **T-115-22 (repudiation, the document, high)** — every row now states what the bridge does rather than what it intends, the new gate binds the column values and the gate names to the source, and the four-direction control proves the gate fires. The prose half stays reviewer-read, which the plan names as the ceiling.
- **T-115-23 (tampering with the new gate, high)** — direction 3 was run and is red, so the gate compares column values and not merely gate names. A green direction 3 would have been recorded as a defect; it did not arise.
- **T-115-24 (the engine citations, low — accepted)** — no new `src/...` citation was added, and the 3.10.1 staleness contract at the head of the document is untouched. Broken Windows **#34** remains its carrier.
- **T-115-25 (spoofing the retired-figure bar, medium)** — the bar at `tests/architecture/workflows-doc-pins.test.ts` is unchanged and unweakened. The rewrite uses `checks` as its noun throughout; `grep -ci 'seven gates'` over the document returns 0.
- **T-115-26 (manifests, Sonar properties, changelog, high)** — the manifest-diff guard exits 0 and `git diff --name-only df81a0db..HEAD` names exactly the two planned files.

## Issues Encountered

**1. `trufflehog` cannot run as a git-mode hook in this linked worktree, and that is structural.** `.git` here is a text file, so the hook's `--since-commit HEAD` scan aborts with `failed to read index file: ... not a directory`. `--all-files` fails identically, so it confirms nothing. Each commit was preceded by a filesystem scan over exactly the paths being committed (`trufflehog filesystem <paths> --results=verified,unknown --fail`), both clean at `verified_secrets: 0, unverified_secrets: 0`, and only then committed with `SKIP=trufflehog`. No other hook was skipped.

**2. Broken Windows #36 is still open and this plan did not touch it.** `surfaceDiscoveryWarnings` heads its block with `1 declared component was skipped.` over a gate line for a script that installed. 115-03 raised its cost to 16 sites. The document does not describe that header as correct — it describes the per-script warning, which never claims the script was skipped, refused or not installed. No second ledger entry was appended; #36 already carries it.

**3. `STATE.md` and `ROADMAP.md` were deliberately not written.** The workstream's state verbs are known to fail or half-update on this layout, and the phase's plan set is executed by an orchestrator that owns the central update. This plan's committed artifacts are the two source files and this SUMMARY.

## User Setup Required

None. No external service, no credential, no dependency install, no engine tarball. Every control edited a file in place and restored it from a scratchpad copy outside the repository.

## Next Phase Readiness

Phase 115's document work is complete. What this plan leaves for what follows:

- **The document and the union now move together, or the tree reddens.** A phase that adds an engine gate must add the tuple member, both `Record` entries, and a table row with its `warn` value and its gate name. The gate names the missing half in its failure message.
- **The partition is pinned by row number and is deliberately not derived.** If the bridge's behavior changes — a check moves from `warn` to `replicate`, say — the expectation must be re-derived from a measurement against the engine, not edited to match the document. The failure message says so.
- **116 and 117 inherit a contract that states the warn behaviour without a per-verb exception**, because 115-01 and 115-03 made install, reinstall, update and `info` agree. A change that re-splits those verbs would falsify the divergence section's second paragraph.
- **`WPIN-01` still owns the re-read.** The nine and the six were re-read at 3.10.1 on 2026-09-08 and both hold; the document now records that date beside the classification table. The gate's disclaimer that it cannot confirm those figures is unchanged.

## Self-Check: PASSED

- `[ -f ]` on both modified files: present.
- `git log --oneline --all | grep` each of `104c85b5`, `6d2ee769`: both found.
- `git rev-list --count df81a0db..HEAD` = 2, equal to the `actuals.commits` figure, measured rather than narrated.
- `git diff --name-only df81a0db..HEAD` names exactly `docs/workflows-compatibility.md` and `tests/architecture/workflows-doc-pins.test.ts`. No operator-owned file (`.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, the workstream `config.json` and `.verification-ledger.json`) is staged or committed.
- Every task's `<acceptance_criteria>` re-run: all pass, with the one documented substitution — row 8's Notes cell states the reserved-key risk without the retired "only one key" figure (deviation 1).
- Plan-level `<verification>`: `npm run check` exit 0 end to end, `pre-commit run --all-files` clean but for the structurally-unavailable `trufflehog`, manifest-diff guard exit 0.
- All four negative-control directions were run against the real files and all four transcripts are pasted above verbatim.

---

*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
