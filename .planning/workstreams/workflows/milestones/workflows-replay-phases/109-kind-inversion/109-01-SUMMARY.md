---
phase: 109-kind-inversion
plan: 01
subsystem: closed-set gates and the published output contract
tags: [inversion, closed-set, catalog, resolver, red-slice]
status: complete

requires: []
provides:
  - "docs/output-catalog.md carrying the post-inversion bytes for the three workflow catalog states, under ids that name what they render"
  - "the three renamed FIXTURES keys in tests/architecture/catalog-uat.test.ts, paired by id to the turned annotations"
  - "both REASONS length pins at 43 and the ordered enumeration at 43 entries with an unmoved tail"
  - "the SUPPORTED_COMPONENT_KINDS 5-tuple pin and the WINV-01 negative mirror on UNSUPPORTED_COMPONENT_KINDS"
  - "two asymmetric positive resolver owner tests replacing the retired scenario-table row"
affects:
  - "109-02 (the production edits these gates now demand)"
  - "109-04 (the catalog-uat fixture payloads, deliberately left untouched here)"

tech-stack:
  added: []
  patterns:
    - "gate turned first, production second -- the red is the deliverable"
    - "catalog state = doc block + fixture, paired by pure string match on the id"
    - "closed-set ledger comments are running arithmetic, appended never rewritten"

key-files:
  created:
    - .planning/workstreams/workflows/phases/109-kind-inversion/109-01-SUMMARY.md
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - tests/shared/notify.test.ts
    - tests/domain/resolver.test.ts

key-decisions:
  - "A-04 settles State 1's id as `workflow-available-inventory`, not D-109-05's `workflow-installed-inventory` example, because the block renders the not-installed `(available)` row"
  - "The three catalog-uat `message` payloads stay byte-unchanged so the byte gate is observably red at runtime, not only at tsc (A-02)"
  - "The strict resolver test reads `componentPaths` through a kind-keyed view so the assertion is type-expressible before the field lands, without loosening what it asserts"

requirements-completed: [WINV-01, WINV-02, WINV-03, WINV-04, WINV-05]

coverage:
  - deliverable: "The three catalog states carry the measured post-inversion bytes under ids that name what they render, in both homes"
    verification:
      - kind: test
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
        note: "PASS in the inverted sense the plan defines: the gate reports the required byte mismatch on exactly the three turned states, and the inverse orphan walk stays green"
    human_judgment: false
  - deliverable: "The five prose lines in docs/output-catalog.md that state a workflow-bearing plugin degrades are corrected"
    verification:
      - kind: command
        ref: "grep -o '{workflows}' docs/output-catalog.md | wc -l -> 0; grep -o '44-member' docs/output-catalog.md | wc -l -> 0"
        status: pass
    human_judgment: true
    rationale: "WINV-05 (probe: encoding) is a backstop: no gate scans the prose paragraphs. partial-vocabulary-guard covers only the retired force/unsupported vocabulary and catalog-uat covers only the fenced blocks, so a human read of the decoded prose is the check."
  - deliverable: "Both REASONS length pins read 43 and the ordered enumeration is 43 entries with an unmoved tail"
    verification:
      - kind: test
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 43-entry reason set"
        status: pass
      - kind: test
        ref: "tests/shared/notify.test.ts#closed notification constants preserve exact public values"
        status: pass
      - kind: test
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
    human_judgment: false
  - deliverable: "SUPPORTED_COMPONENT_KINDS is pinned as a 5-tuple and a negative mirror pins the kind out of UNSUPPORTED_COMPONENT_KINDS"
    verification:
      - kind: test
        ref: "tests/architecture/hooks-foundation.test.ts#WINV-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'"
        status: pass
      - kind: test
        ref: "tests/architecture/hooks-foundation.test.ts#HOOK-01 / WINV-01: SUPPORTED_COMPONENT_KINDS is the closed 5-tuple"
        status: pass
    human_judgment: false
  - deliverable: "The retired resolver scenario row is replaced by two asymmetric positive tests"
    verification:
      - kind: test
        ref: "tests/domain/resolver.test.ts#WINV-01 strict / WINV-01 loose"
        status: pass
    human_judgment: false
  - deliverable: "All six gate runs are RED against unmodified production code and their output is captured"
    verification:
      - kind: command
        ref: "node --test over the five red files plus --test-name-pattern=WINV-01; every run exits 1 with a nonzero fail count"
        status: pass
    human_judgment: true
    rationale: "Success Criterion 4 is an obligation about an observation sequence. The captured output below is the evidence; no end-of-phase green run can attest to it retroactively."

duration: 22 min
completed: 2026-09-04

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase 109 Plan 01: Kind inversion red slice Summary

Turned all five locking gates plus the published byte contract to the post-inversion
reading of `workflows`, and observed every one of them fail against unmodified production
code -- the RED half of the red-then-green pair Success Criterion 4 requires.

**Duration:** 22 min (2026-09-04T22:52Z -> 2026-09-04T23:14Z)
**Tasks:** 3 of 3
**Files:** 7 modified, 0 under `extensions/`

## Accomplishments

- **The published contract now states the post-inversion behavior.** The three
  `catalog-state` blocks in `docs/output-catalog.md` carry the measured bytes -- a clean
  `○ (available)` inventory row, a clean `● (installed)` success row, and a rejection whose
  brace names the OTHER component kind. Each id was renamed in both homes in the same edit,
  so neither the forward walk nor the inverse orphan walk reports a mismatch.
- **Five prose lines corrected.** The reason-rendering paragraph drops the workflows
  carve-out and reads `43-member`; the derivation-path sentence is gone; the
  `(partially-available)` status-table row no longer names workflows in either half; and the
  two tail paragraphs drop `workflows,` and the `{workflows}` alternative. `{workflows}`
  now occurs zero times in the file.
- **Both REASONS length pins read 43**, the ordered `compat-01` enumeration is 43 entries
  with `"marketplace in project scope"` unmoved at the tail, and the `notify-closed-set-locks`
  ledger records the reversal as one appended arithmetic line beneath the retained
  `WDET-04 / D-106-04` line.
- **The supported-kind tuple is pinned as a 5-tuple**, with a negative mirror asserting the
  kind out of `UNSUPPORTED_COMPONENT_KINDS` -- the only assertion in the phase that can see a
  future state where the kind sits in BOTH closed sets (the T-109-01 detection surface).
- **The retired resolver scenario row is replaced, not deleted into an absence.** Two
  asymmetric positive owner tests took its place: strict asserts `installable` plus a
  populated convention path, loose asserts `installable` plus the ABSENCE of the
  contains-note, because the loose collector never probes disk.

## Red observations (Success Criterion 4)

Every block below was produced by running the named gate against **unmodified production
code**, after the gate was turned and before any byte under `extensions/` moved.
`git diff --name-only 85fecdba~1..HEAD -- extensions/` returns zero files.

### 1. `node --test tests/architecture/catalog-uat.test.ts` -- exit 1

```text
ℹ tests 6
ℹ pass 5
ℹ fail 1

✖ failing tests:

test at tests/architecture/catalog-uat.test.ts:5231:1
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
  AssertionError [ERR_ASSERTION]: catalog UAT failures (3):
  [BYTE MISMATCH] section=/claude:plugin list state=workflow-available-inventory
  --- expected ---
  ● official [user]
    ○ helper v1.0.0 (available)
  --- actual ---
  ● official [user]
    ⊖ helper v1.0.0 (partially-available) {workflows}
  ----------------

  [BYTE MISMATCH] section=/claude:plugin install <plugin>@<marketplace> state=workflow-install-success
  --- expected ---
  ● official [user]
    ● helper v1.0.0 (installed)

  /reload to pick up changes
  --- actual ---
  ● official [user]
    ◉ helper v1.0.0 (partially-installed) {workflows}

  /reload to pick up changes
  ----------------

  [BYTE MISMATCH] section=/claude:plugin install <plugin>@<marketplace> state=workflow-plus-unsupported-rejection
  --- expected ---
  A plugin operation has failed.

  ● official [user]
    ⊖ helper (partially-available) {unsupported component}
      Re-run with --partial to install the supported components.
  --- actual ---
  A plugin operation has failed.

  ● official [user]
    ⊖ helper (partially-available) {workflows}
      Re-run with --partial to install the supported components.
  ----------------
```

The failure is a byte mismatch on the three turned states. It contains `catalog UAT failures`
and does NOT contain `catalog UAT inverse-walk failures` or
`Expected exactly 182 annotated catalog examples`, so the id pairing and the example count
are both intact.

### 2. `node --test tests/architecture/compat-01-no-expansion.test.ts` -- exit 1

```text
ℹ tests 14
ℹ pass 13
ℹ fail 1

✖ failing tests:

test at tests/architecture/compat-01-no-expansion.test.ts:127:1
✖ COMPAT-01: REASONS holds exactly its inherited members, in order
  AssertionError [ERR_ASSERTION]: COMPAT-01: no reason token may be renamed. The order is
  catalog-stable: a new token appends at the tail and arrives with its catalog row, renderer
  arm, and fixture in the same change. A token may be removed ONLY when its component kind
  moves from the unsupported set to the supported set, and only when the removal arrives with
  its catalog rows in the same change.
  + actual - expected

    [
      'up-to-date',
      ...
      'marketplace in project scope',
  +   'workflows'
    ]
```

The diff is a single trailing `+ 'workflows'` -- every surviving token's index is unmoved,
which is the property that made the tail the only safe removal.

### 3. `node --test tests/architecture/notify-closed-set-locks.test.ts` -- exit 1

```text
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ failing tests:

test at tests/architecture/notify-closed-set-locks.test.ts:29:1
✖ OUT-08: REASONS is the closed 43-entry reason set
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  44 !== 43

      at tests/architecture/notify-closed-set-locks.test.ts:52:10
    actual: 44,
    expected: 43,
    operator: 'strictEqual',
```

`ℹ tests 4` confirms no assertion was deleted to make room for the appended ledger line.

### 4. `node --test tests/shared/notify.test.ts` -- exit 1

```text
ℹ tests 253
ℹ pass 252
ℹ fail 1

✖ failing tests:

test at tests/shared/notify.test.ts:4933:1
✖ closed notification constants preserve exact public values
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  44 !== 43

      at tests/shared/notify.test.ts:5008:10
```

The single failing test is the intended one; the other 252 pass, so this task introduced no
unrelated regression. This is the SECOND, independent length pin -- A-01's addition to the
gate list -- and it is turned alongside the first, not deleted in favour of it.

### 5. `node --test tests/architecture/hooks-foundation.test.ts` -- exit 1

```text
ℹ tests 9
ℹ pass 7
ℹ fail 2

✖ HOOK-01 / WINV-01: SUPPORTED_COMPONENT_KINDS is the closed 5-tuple [skills,commands,agents,hooks,workflows]
  AssertionError [ERR_ASSERTION]: SUPPORTED_COMPONENT_KINDS is a public closed-set contract -- shape and order are locked
  + actual - expected

    [
      'skills',
      'commands',
      'agents',
      'hooks',
  -   'workflows'
    ]

✖ WINV-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'
  AssertionError [ERR_ASSERTION]: UNSUPPORTED_COMPONENT_KINDS must NOT contain "workflows":
  lspServers,monitors,themes,outputStyles,channels,userConfig,settings,workflows
```

`ℹ tests 9` is the baseline 8 plus the new mirror -- nothing was deleted.

### 6. `node --test --test-name-pattern="WINV-01" tests/domain/resolver.test.ts` -- exit 1

```text
ℹ tests 2
ℹ pass 0
ℹ fail 2

✖ WINV-01 strict: implicit-by-convention workflows/ dir -> installable with componentPaths.workflows populated
  AssertionError [ERR_ASSERTION]: notes if not: contains workflows
  + actual - expected

  + 'partially-available'
  - 'installable'

✖ WINV-01 loose: workflows/ dir on disk -> installable, no workflows contains-note
  AssertionError [ERR_ASSERTION]: notes if not: contains workflows
  + actual - expected

  + 'partially-available'
  - 'installable'
```

Both new positive tests exist and both fail. Over the whole file the run is
`ℹ tests 157 / pass 155 / fail 2` -- exactly these two, confirming the two generated
scenario tests the retired table row fed were removed cleanly and nothing else moved.

### The gate that must stay GREEN

`node --test tests/architecture/partial-vocabulary-guard.test.ts` -- exit 0,
`ℹ tests 52 / ℹ pass 52 / ℹ fail 0`. No prose or comment written here reintroduced the
retired D-75-01 vocabulary.

## Why the arithmetic ledger line is permitted (comment policy)

Carried verbatim from the plan, because a reviewer reading
`.claude/rules/typescript-comments.md` alongside `notify-closed-set-locks.test.ts` will see
an apparent conflict: the rule bans narration of code that no longer exists, and D-109-02
nonetheless keeps the existing `WDET-04 / D-106-04` line and appends a reversal below it.

> The ledger in `notify-closed-set-locks.test.ts` lines 30-51 is a running ARITHMETIC
> derivation of a count, one `+N` or `-N` per spec anchor, not a description of any shape.
> `// WINV-03: -1 for the retired workflows member (44 -> 43).` reads as arithmetic and is
> allowed; `// workflows is no longer a reason` describes a removed shape and is not.

The line as written is `// WINV-03 / D-109-01: -1 for the retired workflows member (44 -> 43).`
The same rule barred writing "byte-identical to the previous row" in the catalog prose; the
State 2 and State 3 paragraphs name what the row renders instead, and the gate
(`catalog-uat`) is what pins the bytes.

## The A-04 id choice

State 1's id was settled as `workflow-available-inventory`, not D-109-05's example
`workflow-installed-inventory`. D-109-04 item 1 specifies the **not-installed** inventory
row, which renders `(available)`. An id reading `installed` above an `(available)` row would
repeat the exact stale-id defect D-109-05 exists to fix. The ids in D-109-05 are marked
"e.g.", so this is a naming choice inside the decision rather than a change to it. The same
reasoning drove the other two: `workflow-install-success` above a clean `(installed)` row,
and `workflow-plus-unsupported-rejection` above a row whose brace names the other kind.

## Deviations from Plan

### 1. [Rule 3 - Blocker] The strict resolver assertion needed a type-expressible read

- **Found during:** Task 3
- **Issue:** `resolvedPlugin.componentPaths.workflows` is `TS2339` until `109-02` widens
  `PartialResolution.componentPaths`. That is a legitimate compile-time expression of the
  same RED, but the `npm-typecheck` pre-commit hook is not optional and blocked the commit.
  Skipping the hook was not available (only `SKIP=trufflehog` is sanctioned here, and
  `--no-verify` is forbidden).
- **Fix:** the test reads the collected paths through a kind-keyed view of the same object:
  `const collected: Readonly<Record<string, readonly string[] | undefined>> = resolvedPlugin.componentPaths;`
  then asserts `deepStrictEqual(collected.workflows, ["workflows"])`. This is an annotation,
  not an `as` cast, and the runtime assertion is byte-for-byte the one the plan specified --
  the gate is not weakened, only made expressible. It mirrors the `as readonly string[]`
  precedent the plan itself mandates for the `hooks-foundation` mirror, which exists for the
  same reason on the other side of the move.
- **Follow-up for `109-02`:** once `componentPaths.workflows` exists, the annotation can be
  dropped and the direct property access restored. It is not load-bearing.
- **Files modified:** `tests/domain/resolver.test.ts`
- **Verification:** `npm run typecheck` clean; the test still fails RED on the state
  assertion, `ℹ fail 2` under the `WINV-01` pattern.
- **Commit:** `6a4b2239`

### 2. [Rule 3 - Blocker] `npm run format:check` was red on an untracked `.mcp.json`

- **Found during:** Task 1
- **Issue:** the repo root carries an untracked `.mcp.json` (the operator's local CodeGraph
  MCP config, present before this plan started). `prettier --check` globs `**/*.{js,json,ts}`,
  so the `npm-format-check` pre-commit hook -- which runs whenever any `tests/**/*.ts` file is
  staged -- failed on it and blocked every commit in this plan.
- **Fix:** `npx prettier --write .mcp.json`, a whitespace-only normalization
  (`"args": ["serve", "--mcp"]` onto one line). The file stays untracked and was never staged.
- **Files modified:** `.mcp.json` (untracked, not committed)
- **Verification:** `npm run format:check` -> "All matched files use Prettier code style!"
- **Commit:** none (untracked file)

**Total deviations:** 2 auto-fixed (2 × Rule 3 blockers). **Impact:** none on the deliverable.
Neither changed what any gate asserts; both removed a hook failure that was blocking commits.

## Intermediate states recorded deliberately

Three facts that a later reader would otherwise rediscover as defects:

- **D-109-06's window is now open.** From this plan until Phase 111 lands, a workflow-bearing
  plugin resolves `installable`, renders `● (installed)` with no brace, and materializes zero
  workflow commands -- less honest than the pre-inversion `partially-available {workflows}`.
  Accepted; the window has no external surface (`ci.yml` carries no `push` trigger on
  `features/**`). **Cut no release from this branch before Phase 111.**
- **A-03: do not bump `EXTENSION_VERSION` inside the window.**
  `orchestrators/reconcile/backfill.ts` runs `supportedSetGrew` over records at
  `installable: false` -- exactly where a pre-inversion `--partial`-installed workflow-bearing
  record sits -- but the scan is gated on
  `state.lastReconciledExtensionVersion === EXTENSION_VERSION`. The version stays `0.18.1`
  through this phase, so the scan never runs. A bump inside the window would fire that
  convergence while no bridge exists to materialize anything.
- **The `CHANGELOG.md` 0.18.1 entry is untouched on purpose.** Its two workflow bullets sit
  under a released heading and describe what 0.18.1 actually shipped; `package.json` and
  `EXTENSION_VERSION` are both `0.18.1`. `CHANGELOG.md` is not under `docs/`, so WINV-05 does
  not reach it. The inversion belongs in the next version's entry, which is release work the
  STATE.md outstanding list already carries.

## Known Stubs

None. Every assertion turned by this plan asserts a live value; none was retitled into
vacuity, weakened, or deleted.

## Issues Encountered

None beyond the two Rule 3 blockers documented above.

## Next Phase Readiness

Ready for `109-02`, which owns the production edits these six gates now demand: the four
resolver tuple moves, the `domain/components/plugin.ts` manifest-field move, the
`componentPaths.workflows` widening, and the four-site reason retirement. Every gate turned
here is expected to go green under those edits; `109-03` and `109-04` then carry the 76
test-side `componentPaths` widening sites and the `catalog-uat` fixture payloads.

## Self-Check: PASSED

- `.planning/workstreams/workflows/phases/109-kind-inversion/109-01-SUMMARY.md` -- FOUND
- All seven modified files present and committed: FOUND
- `85fecdba` docs(109-01): turn the workflow catalog states -- FOUND
- `4a5c572c` test(109-01): turn both REASONS length pins -- FOUND
- `6a4b2239` test(109-01): pin workflows as a supported kind -- FOUND
- `git diff --name-only 85fecdba~1..HEAD -- extensions/` returns 0 files -- PASS
- All six gates RED, `partial-vocabulary-guard` green -- PASS
