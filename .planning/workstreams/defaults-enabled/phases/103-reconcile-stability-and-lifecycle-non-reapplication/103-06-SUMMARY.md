---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 06
subsystem: orchestrators
tags: [config-write-back, install, cfg-02, dfen-05, dfen-06, reconcile, typescript]

requires:
  - phase: 103
    plan: 04
    provides: "`selectDeclaringConfigWriteTarget` — the declaration-aware config write-target selector this plan consumes at the install's write site"
provides:
  - "the standalone install writes its config stamp into the physical file the plugin's declaration lives in, through the same helper `enable`/`disable` use"
  - "`readDeclaredEnabled`'s `targetIsLocal` derived from the SELECTED file rather than from the caller's flag, so the precedence read survives the write fix"
  - "criterion 1 proven through the standalone-install door: the reload after a locally-declared install-disabled install plans nothing, asserted against the planner's own output"
affects: [103-05, install-write-back, reconcile-planner]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One in-closure write-target selection feeding the CFG-03 load, the precedence read and BOTH write arms, so sibling write sites cannot drift onto different files"
    - "A merged-view assertion PLUS a planner assertion as the proof a config write closed a loop rather than relocating it"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "`targetIsLocal` is taken from the helper's return value rather than re-derived by comparing the selected path to `locations.configLocalJsonPath` (DS-2's fallback). `103-04` shipped the helper returning it, and its SUMMARY names re-derivation as the place the read and the write could silently disagree."
  - "The corrected `install-dfen05-local-true-wins-` row moved in Task 1's commit rather than Task 2's, so the test suite is green at every commit. Task 2 kept the new both-files case, which is the part that pins the label."
  - "DS-3 accepted as observed: with the target flipped to the local file, CR-02's adopted marketplace declaration rides that same atomic save into the local file. That arm only fires when the marketplace is declared in NEITHER file, so nothing is contradicted."

patterns-established:
  - "Sibling-file assertions distinguish `expectSiblingEntryAfter: {}` (file exists, entry fieldless) from `expectSiblingKeyAbsent` (file may not exist at all) — asserting `status === \"valid\"` on an untargeted file fails against correct behavior"

requirements-completed: [DFEN-06]

coverage:
  - id: D1
    description: "The standalone install's stamp lands in the file the declaration lives in, and the MERGED view moves"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#D-103-16 / DFEN-06 / CFG-02: a locally-declared install stamps the LOCAL file and moves the merged view"
        status: pass
    human_judgment: false
  - id: D2
    description: "The loop is CLOSED, not relocated: one reload after that install plans nothing, read from the planner's own output"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#D-103-16 / DFEN-06 / CFG-02: the reload after a locally-declared install plans nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The precedence READ survives the WRITE fix — the effective-declaration label is derived from file identity"
    requirement: DFEN-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#DFEN-05: CFG-02 / D-103-16: with the key in BOTH files the LOCAL entry decides, and neither file moves"
        status: pass
    human_judgment: false
  - id: D4
    description: "The unchanged arms are unchanged: the common install, the typed flag, and the orchestrated caller for both `configSource` values"
    requirement: DFEN-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WB-01 / UAT-05 / D-103-16: a plugin declared in NEITHER file stamps the base file, local not created"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WB-01 / UAT-05 / D-103-16: a typed --local still targets the local file over a BASE declaration"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WB-01 / UAT-05 / D-103-16: the orchestrated stamp targets the {local,base} file, unchanged"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 06: The Install Stamp Follows the Declaration Summary

**The standalone install now writes its config entry into the physical file the plugin's declaration lives in, so a flagless install of a locally-declared `defaultEnabled: false` plugin moves the merged view the reconcile planner reads instead of stamping a file CFG-02 shadows — and the reload after it plans nothing.**

## What changed

`installPlugin` selected its config write target from `opts.local` alone, before
the lock. Under a declaration living only in `claude-plugins.local.json`, the
`enabled: false` stamp went to the base file, CFG-02's wholesale per-key
replacement shadowed it, `isDeclaredEnabled` kept answering true on the merged
entry, and `plan.ts` pushed an enable on every reload — permanently, unattended,
with the install reporting success each time. That is this phase's success
criterion 1, false, through the standalone-install door.

The fix is one call site: `selectDeclaringConfigWriteTarget`, the helper plan
`103-04` created for `enable`/`disable`. Three verbs author an enablement
declaration on the user's behalf; after this plan they read one decision about
where a declaration lives.

Two structural consequences, both anticipated by `103-04`'s SUMMARY:

- The helper is **async and reads a config file**, so the selection moved INSIDE
  `withLockedStateTransaction`. `configBasename` — needed by the post-guard
  CFG-03 abort row — escapes the closure through a `let` initialized to the base
  file's basename, the value the no-flag/no-declaration arm yields, so the
  pre-assignment value is never wrong.
- `readDeclaredEnabled`'s `targetIsLocal` argument now comes from the selector
  instead of from `opts.local === true`. That is the subtle half: the function
  picks the effective ENTRY by physical-file identity BEFORE reading that
  entry's `enabled` field, so labelling the selected file with the caller's flag
  swaps which of `current` and the sibling is treated as local.

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-15T12:45Z
- **Completed:** 2026-08-15T13:25Z
- **Tasks:** 3
- **Files modified:** 2 (plus `103-VALIDATION.md`)

## Task Commits

1. **Task 1: the wiring, the identity label, the rationale, and the two-half regression** — `5e86d4fd` (fix)
2. **Task 2: the both-files case that pins the label** — `2f57b585` (test)
3. **Task 3: the three unchanged-arm controls** — `c9f4ccc7` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the
  selection moved into the locked closure and re-aimed through
  `selectDeclaringConfigWriteTarget`; `configBasename` hoisted to a `let`; the
  `targetIsLocal` argument taken from the selector; the WB-01 rationale block
  and `InstallPluginOptions.local`'s doc comment amended to state the new rule.
- `tests/orchestrators/plugin/install.test.ts` — the two-half regression, the
  corrected local-declared precedence row, the both-files label case, and the
  three controls. Two case-shape fields added (`expectSiblingKeyAbsent`,
  `alsoSeedSiblingEntry`), both optional; no existing case moved except the one
  recorded below.

## INTENDED BEHAVIOR CHANGE — one pre-existing expectation moved

This is a behavior change, not a weakened assertion. A verifier reading only the
diff must not mistake it for one.

**Case:** `install-dfen05-local-true-wins-` in the DFEN-05 precedence table.
**Fixture (unchanged):** the plugin is declared ONLY in
`claude-plugins.local.json` as `{ enabled: true }`; the marketplace entry
declares `defaultEnabled: false`; the install runs with `applyDefaultEnabled`
and NO `--local`.

| | Before | After |
|---|---|---|
| Assertion | `expectSiblingEntryAfter: {}` — the BASE file exists and holds a fieldless entry for the key | `expectSiblingKeyAbsent: true` — the BASE file holds no entry for the key, and is not created at all |
| Reason | the write-back addressed the base file, and it carried no `enabled` (the install landed ENABLED, so there was nothing to stamp) | the write-back addresses the LOCAL file, where the declaration lives, so the base file gains nothing |
| Outcome | unchanged: the record lands `enabled: true`, artifacts staged, the local entry left as `{ enabled: true }` | unchanged |

The row's comment claimed the write-back "still addresses the base file" — the
sentence Task 1 falsified — and was rewritten to state the new rule, its reason,
and the CR-02 consequence (DS-3). The old assertion could not simply be relaxed:
the loop's sibling check asserted `status === "valid"`, which now fails against a
file that is CORRECTLY never created, so a new `expectSiblingKeyAbsent` field
handles the `absent` arm explicitly rather than by tolerance.

The table's header comment was also corrected: it said `seedLocal` puts the
declaration in the local file "while the install still targets the base file".

## Decisions Made

- **`targetIsLocal` is READ from the helper, not re-derived.** The plan's DS-2
  specified an explicit path-identity comparison against
  `locations.configLocalJsonPath`, but its own flagged assumptions said to prefer
  the helper's value if it landed carrying one — and `103-04` shipped it that
  way, naming re-derivation as exactly where the read and the write could
  disagree. Both are exact; taking the helper's value means there is one
  computation of the fact instead of two.
- **The corrected precedence row landed in Task 1's commit.** The plan assigns
  it to Task 2, but Task 1's own acceptance criteria require
  `node --test tests/orchestrators/plugin/install.test.ts` to exit 0, and the
  row goes red the moment the wiring lands. Moving the correction into the same
  commit makes every commit in this plan independently green and bisectable.
  Task 2 kept the part the plan actually built it for: the both-files case.
- **DS-3 confirmed rather than assumed.** With the target flipped to the local
  file, CR-02's adopted marketplace declaration rides that same atomic save into
  the local file. The adoption arm only fires when the marketplace is declared in
  NEITHER physical file, so there is nothing for it to contradict, and splitting
  the write to aim the marketplace elsewhere would break CR-02's single-atomic-
  save property to solve a problem that does not arise.
- **The sweep is stated as a RULE, not as coverage.** No comment claims every
  write site follows it. `maybeWritePluginConfigBack`
  (`orchestrators/plugin/shared.ts`) still aims by the flag on the `update` /
  `reinstall` post-success paths — deliberately out of scope, benign because its
  patch carries no field, and already recorded as a backlog candidate.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The corrected precedence row moved into Task 1's commit

- **Found during:** Task 1
- **Issue:** Task 1's acceptance criteria require the install suite to exit 0,
  but they also defer the one legitimately-moved expectation to Task 2. Those
  cannot both hold: the row fails the instant the wiring lands.
- **Fix:** Correct the row in Task 1's commit; leave Task 2 the both-files case.
  The before/after is recorded above exactly as Task 2's acceptance criteria
  require.
- **Verification:** 117/117 green at `5e86d4fd`; 118/118 at `2f57b585`;
  122/122 at `c9f4ccc7`.
- **Committed in:** `5e86d4fd`

### 2. [Rule 2 — Missing critical] The reload half cannot assert the base file absent

- **Found during:** Task 1
- **Issue:** The plan's reload half says to assert the loop is closed. It does
  not say what the base file holds afterwards, and asserting "absent" would have
  failed against correct behavior: a reconcile pass materializes a base config
  from recorded state when none exists, and its plugin entry is FIELDLESS.
- **Fix:** The stamp half asserts the base file gained nothing (true there, and
  load-bearing). The reload half pins the fieldless entry instead, with a comment
  naming why it is harmless — it carries no `enabled`, so the local entry keeps
  replacing it wholesale (CFG-02) and the merged view does not move. A future
  change that starts writing a FIELD there now fails a test rather than silently
  reversing the user. This mirrors what `103-04` found on the same seam.
- **Verification:** Probed the file contents before writing the assertion.
- **Committed in:** `5e86d4fd`

### 3. [Rule 3 — Blocking] The DS-2 label derivation was superseded by the shipped helper

- **Found during:** Task 1
- **Issue:** DS-2 prescribes a path-identity comparison, which exists only
  because the plan assumed a two-path return shape. The shipped helper returns
  `targetIsLocal`.
- **Fix:** Destructure it. Recorded here per the plan's flagged assumption,
  which asked for this preference explicitly and asked which was used.
- **Committed in:** `5e86d4fd`

---

**Total deviations:** 3 (1 missing critical, 2 blocking)
**Impact on plan:** No scope creep. Deviation 1 moves work between two commits
of the same plan; deviations 2 and 3 make assertions and derivations true rather
than weaker.

## Mutation checks (required by the plan, all observed by hand)

| Mutation | Observed |
|---|---|
| `targetIsLocal` reverted to `opts.local === true` (the label derived from the flag) | ONLY the both-files case fails, on `record.enabled`: `false !== true`. The install landed DISABLED under a local `{ enabled: true }` — the DFEN-05 violation the fix would otherwise introduce. Restored; 118/118 green. |
| The selection reverted to the flag-only `selectConfigWriteTarget` | THREE cases fail: the corrected precedence row, the stamp half, and the reload half. The reload half fails on `a converged pass says nothing` — `applyReconcile` emits a cascade, which is the perpetual re-enable itself. Restored; 118/118 green. |
| The selector's membership condition INVERTED in `shared.ts` | 12 cases fail, INCLUDING control (1) (`a plugin declared in NEITHER file stamps the base file`). The control is a real control. Restored; 122/122 green, `git diff -- extensions/` empty. |

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `node --test tests/orchestrators/plugin/install.test.ts` | 122 pass, 0 fail |
| `node --test "tests/orchestrators/plugin/**" "tests/orchestrators/reconcile/**"` | 940 pass, 0 fail |
| `node --test "tests/orchestrators/import/**/*.test.ts"` | 59 pass, 0 fail |
| `node --test "tests/architecture/**/*.test.ts"` | 353 pass, 0 fail |
| `npm run lint` | exit 0 |
| `npm run format:check` / `prettier --check` (both files) | clean |
| `selectDeclaringConfigWriteTarget` in `install.ts` (non-comment) | 2 — the import and exactly ONE call site |
| `selectConfigWriteTarget` in `install.ts` (non-comment) | 0 — was 2 before this plan |
| `opts.local === true` in `install.ts` (non-comment) | 0 |
| `git diff --name-only -- extensions/` for Tasks 2 and 3 | empty |

`npm run check` was deliberately NOT run: `103-05` owns the phase-boundary gate
in wave 3.

## Known Stubs

None.

## Deferred (out of scope)

One pre-existing `Phase 65/69` planning reference in a comment of
`tests/orchestrators/plugin/install.test.ts` violates
`.claude/rules/typescript-comments.md`. It predates this phase (`c695bdab`) and
is untouched by this plan's diff, so it is logged in `deferred-items.md` rather
than fixed here.

## Next Phase Readiness

- `103-05` shares `tests/orchestrators/plugin/install.test.ts` with this plan and
  runs after it, as the wave ordering intends. The precedence table gained two
  optional case-shape fields; no existing case shape changed.
- `maybeWritePluginConfigBack` (`orchestrators/plugin/shared.ts`) remains the
  fourth flag-aimed write site, on the `update` / `reinstall` post-success paths.
  Out of scope by design and benign (its patch carries no field, so the merged
  view never moves and no enable is ever planned). Recorded as a backlog
  candidate in `103-05`'s SUMMARY. A later reader should treat the RULE as
  settled and its COVERAGE as three sites, not all of them.

## Self-Check: PASSED

Both modified source files exist on disk; all three task commits (`5e86d4fd`,
`2f57b585`, `c9f4ccc7`) are present in `git log`; no planning-artifact reference
(`Phase N` / `Plan N` / `Wave N` / `Pitfall N`) appears in either file.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*
