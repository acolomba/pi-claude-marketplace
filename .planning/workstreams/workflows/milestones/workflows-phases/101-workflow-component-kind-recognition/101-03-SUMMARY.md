---
phase: 101-workflow-component-kind-recognition
plan: 03
subsystem: docs
tags: [catalog, byte-equality, notify, component-kinds, workflows, comments]

# Dependency graph
requires:
  - phase: 101-01
    provides: "the six-slot `COMPONENT_KINDS` tuple and the `workflows` member on `PluginInfoComponentsResolved.components` that the new fixture typechecks against"
provides:
  - "`installed-single-scope-with-workflows` -- the catalog state pinning a rendered `workflows:` line, last among the per-kind component lines"
  - "its paired `FIXTURES` entry, so both directions of the catalog walk pass"
  - "an `info` prose surface with no surviving statement of a component-line order shorter than six kinds"
affects: [101-04, workflow-name-extraction]

actuals:
  tokens: 2400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "bidirectional gate: land the annotation and its fixture in one commit, then PROVE the new state is exercised by perturbing one byte of the block and watching the gate fail on that state by name -- a passing suite alone cannot distinguish 'matched' from 'silently skipped'"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts

key-decisions:
  - "the new catalog block reuses the `installed-single-scope` plugin identity verbatim and adds one line -- the exact shape the sibling `installed-single-scope-with-dependencies` state already uses, so the delta a reviewer reads is the `workflows:` line alone"
  - "the section's own state-inventory comment gained a row for the new state; leaving it out would create a fresh stale-inventory site in the one plan whose second task exists to remove them"
  - "no `list` byte changed -- SC 3's `list` half is satisfied at the state level (`compatibility.supported`), pinned by plan 101-04, not at the render level"
  - "two of the four named sweep sites needed no edit: wave 1 already corrected the arity phrase, and `shared/concerns/hooks.ts` names the tuple's existence but no order"

patterns-established:
  - "Prove a new catalog state is live by perturbation, not by a green suite: the forward walk reports `[BYTE MISMATCH] state=<name>`, which names the state and so distinguishes an exercised fixture from an unpaired one"
  - "When a comment states an enumerated order that has grown, write the whole current order rather than appending one name -- an appended name preserves whatever was already missing"

requirements-completed: []

coverage:
  - id: D15
    description: "A rendered `workflows:` line is under the byte-equality user contract: the catalog block and its FIXTURES entry agree with what `notify()` emits"
    requirement: WFLW-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (state installed-single-scope-with-workflows)"
        status: pass
    human_judgment: false
  - id: D16
    description: "The pairing holds in both walk directions -- no annotation without a fixture, no fixture without an annotation"
    requirement: WFLW-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)"
        status: pass
    human_judgment: false
  - id: D17
    description: "The rendered order is pinned byte-for-byte with `workflows` LAST among the component lines, names pre-sorted by the orchestrator"
    requirement: WFLW-03
    verification:
      - kind: unit
        ref: "the same forward walk; the block's four component lines are agents, commands, skills, workflows in that order, and a one-byte perturbation of the workflows line fails the gate by state name"
        status: pass
    human_judgment: false
  - id: D18
    description: "No surviving prose statement of the rendered component-line order names fewer than six kinds"
    requirement: WFLW-03
    verification:
      - kind: other
        ref: "grep for `agents, commands, mcp` / `mcp, skills` across tests, extensions and docs returns only six-kind statements plus the deliberately-untouched five-BRIDGE count in enable-disable.ts and the install-ledger order in enable-disable.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 03: Workflow component-kind recognition Summary

**A rendered `workflows:` line is now under the project's binding byte-equality contract, landed with its paired fixture in one commit, and every surviving `info` prose statement of the render order names all six kinds**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-14T19:05:00Z
- **Completed:** 2026-08-14T19:30:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `docs/output-catalog.md` carries `<!-- catalog-state: installed-single-scope-with-workflows -->` with a fenced block whose last component line is `    workflows: changelog, tag-release`, and `tests/architecture/catalog-uat.test.ts` carries the matching `FIXTURES` entry. Both halves are in commit `52c52f60`; a half-landing would have failed one of the two walks.
- **The gate was proven to exercise the new state, not merely to stay green.** Because the fixtures are hand-written data, a green suite is equally consistent with "the new pair matches" and "the new pair was never reached". Perturbing one byte of the block (`tag-release` → `tag-releaseX`) produced `[BYTE MISMATCH] section=/claude:plugin info <plugin>@<marketplace> state=installed-single-scope-with-workflows` and `# fail 1`; reverting restored green. That output names the state, which is what makes it evidence.
- Two `info` prose sites stated the render order as a four-kind list and were corrected to six kinds. Both were already stale before this phase — neither named `hooks` — so appending one name would have shipped a still-wrong list.
- `npm run check` is green: typecheck, ESLint, Prettier, 3458 unit tests (0 failures, 1 pre-existing platform-conditional skip) and 18 integration tests.

## Task Commits

1. **Task 1: The catalog state and its paired fixture, in one change** — `52c52f60` (docs)
2. **Task 2: Correct every prose statement of the rendered component-line order** — `cea170fb` (test)

## Files Created/Modified

- `docs/output-catalog.md` — the new `### Success -- installed single scope with workflow scripts (WFLW-03)` H3, its prose, annotation and fenced block, placed immediately after the `installed-single-scope-with-dependencies` H3 so the component-line states stay together; plus the `info` section preamble and the `installed-single-scope` H3 prose, both corrected from a four-kind to the six-kind order
- `tests/architecture/catalog-uat.test.ts` — the paired `FIXTURES["/claude:plugin info <plugin>@<marketplace>"]["installed-single-scope-with-workflows"]` entry, and one row added to the section's own state inventory comment
- `tests/shared/notify-v2.test.ts` — one comment: the `INFO-02 / INFO-05` renderPluginInfo case's kind-order line
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` — one comment: the `INFO-11 / D-96-01` banner's kind-order clause

## Decisions Made

- **The block reuses the sibling's plugin identity and adds exactly one line.** `installed-single-scope-with-dependencies` is authored the same way — identical body plus a `dependencies:` line — so the established shape for "same state plus one line" already existed. The reviewable delta is the `workflows:` line alone. The two stems (`changelog`, `tag-release`) are plausible `.js` file stems that the real enumeration path can produce, and they are already in the orchestrator's comparator order.
- **The state inventory comment gained a row.** The `FIXTURES` section opens with a comment enumerating every state it holds. Adding a state without adding its row would have created exactly the kind of stale inventory Task 2 exists to remove. This makes `grep -c 'installed-single-scope-with-workflows'` on the test file read 2 rather than the 1 the plan's acceptance criterion names — see Deviations.
- **No `list` byte changed.** `list` renders no component enumeration; it composes rows from glyph, name, version, status token and a reasons brace, and every reason derives from `unsupported[]`, never `supported[]`. SC 3's `list` half is satisfied at the state level by `compatibility.supported` recording `"workflows"`, which plan `101-04` pins. Minting a reason token, status token or glyph to force the criterion green would have tripped COMPAT-01's `REASONS` pin and duplicated later-phase work.
- **`enable-disable.ts` deliberately untouched.** Its `COMPONENT_KINDS 5-tuple` phrase counts the five artifact bridges, not the info renderer tuple. That count changes when a bridge is added, which is a later phase; editing it here would have turned a correct comment into a wrong one.

## Deviations from Plan

### Findings

**1. [Rule 2 - Consistency] The `FIXTURES` state inventory comment needed the new row**

- **Found during:** Task 1
- **Issue:** The plan's acceptance criterion reads `grep -c 'installed-single-scope-with-workflows' tests/architecture/catalog-uat.test.ts` is exactly 1. The section is preceded by a maintained comment enumerating all 19 of its states; the criterion did not account for it.
- **Resolution:** Added the inventory row and let the count read 2. The criterion's intent — one fixture, no duplicate — holds exactly: `grep -cE '^    "installed-single-scope-with-workflows": \{'` is 1, and the second hit is the inventory line. Omitting the row would have left a new stale enumeration in the file, contradicting this plan's own second task.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`
- **Committed in:** `52c52f60`

**2. [Scope] Two of the four named sweep sites needed no edit**

- **Found during:** Task 2
- **Issue:** The plan's `files_modified` lists `tests/orchestrators/plugin/info.test.ts` and `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`. Wave 1 had already dropped the stale arity from the first (recorded as a deviation in `101-01-SUMMARY.md`). The second names `COMPONENT_KINDS` only to say where it lives — it states no order and no arity — which is the condition the plan's own action made the edit conditional on.
- **Resolution:** Left both untouched. `tests/shared/notify-v2.test.ts` needed one of its two named sites, not both, for the same reason.
- **Files modified:** none
- **Committed in:** n/a

**3. [Bookkeeping] REQUIREMENTS.md rows left `Pending`**

- **Found during:** State updates
- **Issue:** Same judgment `101-01` and `101-02` made. The traceability rows are scoped to the phase, and all four plans carry the same four IDs; `101-04` still owes the `compatibility.supported` pins.
- **Resolution:** Left the rows unchanged. They belong to phase completion.
- **Files modified:** none
- **Committed in:** n/a

---

**Total deviations:** 1 consistency addition, 1 scope reduction, 1 bookkeeping judgment call
**Impact on plan:** No production code touched. Both success criteria that this plan owns are met by executed gates; the third (`list`) is satisfied at the level the locked decision names and is pinned by the next plan.

## Issues Encountered

- **`trufflehog` fails structurally in this worktree**, as CLAUDE.md documents (`.git` is a file, so the git-mode scan cannot read an index). Both commits were preceded by a clean filesystem-mode scan over the exact paths staged (`verified_secrets: 0`, `unverified_secrets: 0`) and used `SKIP=trufflehog`, that hook only. No other hook was skipped and `--no-verify` was never used.
- **`mdformat`, not prettier, formats the catalog.** `pre-commit run --files docs/output-catalog.md` passed on the first run with no reformatting; `npm run format:check` never sees the file (it covers `js,json,ts` only).

## User Setup Required

None — no external service configuration and no package install.

## Next Phase Readiness

- **Ready.** `npm run check` green.
- `101-04` can pin `compatibility.supported` recording `"workflows"`, which closes SC 3's `list` half at the state level. Nothing in this plan changed production behavior, so it depends on nothing here.
- **Handed forward to the name-extraction phase:** the catalog block shows file stems. When the name source moves to the extracted `meta.name`, this block's two names and its paired fixture must move together — the gate will fail on `installed-single-scope-with-workflows` by name if only one side changes, which is the intended alarm.

## Self-Check: PASSED

All four modified files verified present on disk; both commit hashes verified in `git log`.

---
*Phase: 101-workflow-component-kind-recognition*
*Completed: 2026-08-14*
</content>
