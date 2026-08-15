---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 04
subsystem: orchestrators
tags: [config-write-back, enable-disable, cfg-02, reconcile, typescript]

requires:
  - phase: 102
    provides: "the READ-side cross-file declaration rule (`install.ts::readDeclaredEnabled`), whose WRITE-side counterpart this plan adds"
provides:
  - "`selectDeclaringConfigWriteTarget` — the declaration-aware config write-target selector, in `orchestrators/plugin/shared.ts`"
  - "`enable` / `disable` write into the file the declaration lives in when no `--local` is typed, from ONE selection feeding both write sites"
  - "the converse half of criterion 4, proven end to end on both declaration sites"
affects: [103-06, install-write-back, reconcile-planner]

actuals:
  tokens: 7986
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A write-target selector that answers 'where does this declaration live' by delegating both arms to the flag-only selector, so `--local`'s file pairing keeps one definition"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "DS-1 upheld: a typed `--local` still wins unconditionally. The declaration-following rule answers the question the user did NOT answer; it does not overrule the one they did."
  - "The helper returns `targetIsLocal` alongside the two paths, so a caller reading across both files does not re-derive locality by comparing paths. 103-06 consumes this for `readDeclaredEnabled`'s identity label."
  - "The selection moved INSIDE the lock (it now reads a config file); `configBasename` escapes the closure through a `let` initialized to the base file's basename."
  - "The chain PINS rather than glosses two fieldless base-file entries under a local declaration — one from the reload's first-run config materialization, one from the update's still-flag-aimed write-back. Neither carries an `enabled` field, so neither moves the merged view."

patterns-established:
  - "Merged-view assertion as the proof of a config write: a physical-file check cannot distinguish a correct write from one CFG-02 shadows"
  - "One selection at the top of a locked closure feeding every downstream path use, so sibling write sites cannot drift onto different files"

requirements-completed: [DFEN-07]

coverage:
  - id: D1
    description: "With no `--local` typed, `enable` writes its flip into the file the declaration lives in, and the MERGED view moves"
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#D-103-13 / CFG-02 / ENBL-01: flagless enable of a locally-declared plugin writes the LOCAL file and moves the merged view"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rule is bounded on both sides: the base default is unmoved, a typed `--local` still wins, and both write sites select from one decision"
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WB-01 / D-103-13: flagless enable of a BASE-declared plugin still writes the base file, local absent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#UAT-05 / D-103-13: a typed --local still targets the local file even when the declaration is in base"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-03 / D-103-13: the config-truth promotion writes into the LOCAL declaring file and moves the merged view"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criterion 4's converse: an explicit enable survives a reload, a manifest-flipping update and a reinstall, for a base declaration and a local one"
    requirement: DFEN-07
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#DFEN-07 / D-103-10 / D-103-11: an explicit enable of a BASE-declared plugin survives reload, update and reinstall"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#DFEN-07 / D-103-10 / D-103-11: an explicit enable of a LOCALLY-declared plugin survives reload, update and reinstall"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 04: Declaration-Aware Config Write Target Summary

**`enable` and `disable` now write their config entry into the physical file the plugin's declaration lives in, so a flagless flip on a locally-declared plugin moves the merged view the reconcile planner reads instead of landing in a file CFG-02 shadows.**

## The helper `103-06` consumes

Exported from `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`, immediately after `selectConfigWriteTarget` (which is unchanged and still exported):

```ts
export async function selectDeclaringConfigWriteTarget(opts: {
  readonly locations: ScopedLocations;
  readonly local: boolean | undefined;
  readonly key: string;          // `<plugin>@<marketplace>`
}): Promise<{
  readonly targetConfigPath: string;
  readonly siblingConfigPath: string;
  readonly targetIsLocal: boolean;
}>;
```

Two facts `103-06` needs:

1. **It returns `targetIsLocal` directly.** Do NOT derive locality by comparing
   `targetConfigPath` against `locations.configLocalJsonPath` — the helper
   already knows. `install.ts::readDeclaredEnabled` takes a `targetIsLocal`
   argument currently spelled `opts.local === true` at the call site; that is
   exactly the value that must become the helper's `targetIsLocal`, or the read
   and the write will disagree about which file the declaration is in.
2. **It is async and it reads the local config file**, so it must be called
   from inside the caller's `withLockedStateTransaction` closure, not before it
   (WB-01). `install.ts` currently selects at `:1553`, BEFORE the lock; re-aiming
   it means moving the selection into the guard closure and hoisting
   `configBasename` to a `let`, exactly as this plan did in `enable-disable.ts`.

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-15T11:55Z
- **Completed:** 2026-08-15T12:39Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- The write follows the declaration. A flagless `enable` on a plugin declared
  only in `claude-plugins.local.json` now writes `enabled: true` into that file;
  before, it wrote the base file, CFG-02 kept the local `enabled: false`
  effective, and the next reload planned a disable and undid the user's command.
- **Both** write sites in `enable-disable.ts` — the ordinary write-back and the
  config-truth reclassification promotion — read ONE selection made at the top
  of the locked closure, so they cannot drift onto different files.
- Six test cases: the regression, three controls that bound the rule, and two
  end-to-end chains proving criterion 4's converse on both declaration sites.
- `seedRealDisabledMarketplace` gained two additive, defaulted knobs
  (`defaultEnabled` on the marketplace ENTRY, and a `configSeed` naming which
  physical file declares the plugin); no existing caller moved.

## Task Commits

1. **Task 1: the selector, the wiring and the regression** — `fdbc14e7` (fix)
2. **Task 2: the three controls** — `432bd9c5` (test)
3. **Task 3: criterion 4's converse chain** — `9599574e` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — the new
  `selectDeclaringConfigWriteTarget`, delegating both arms to the flag-only
  selector it sits beside.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` —
  one selection at the top of the locked closure feeding the `loadConfig`, both
  `synthesizeAdoptedMarketplaceSource` calls and both `writeBatchedConfigEntries`
  calls; `configBasename` hoisted to a `let`; module header amended.
- `tests/orchestrators/plugin/enable-disable.test.ts` — six new cases, two
  fixture knobs, and three hoisted helpers (`fileExists`,
  `readMergedUserPluginEntry`, `assertStaysEnabled`).

## Decisions Made

- **DS-1 upheld, and it is an interpretation.** D-103-13's sentence describes an
  `enable` WITHOUT the flag. The rule implemented is: flag typed → local;
  no flag → follow the declaration; neither → base. Dropping the flag entirely
  would void the WB-01 / UAT-05 contract that `--local` targets the local file
  unconditionally (including fresh-creating it on ENOENT) and would break the
  shipped `ENBL-01 enable --local` and UAT-05 cases. **If a reviewer wants the
  stricter reading — the declaration decides even when the flag is typed — that
  is a one-condition change in the helper plus a rewrite of the ENBL-01
  `--local` case and this plan's typed-flag control, and it should be taken as
  an explicit decision.**
- **The helper returns `targetIsLocal`.** The plan's `<action>` specified the
  two-path shape but its own flagged assumptions asked for locality to be
  reported directly if the helper could. It can, at the cost of one boolean, and
  the alternative leaves `103-06` re-deriving a fact by path comparison.
- **Both arms delegate to `selectConfigWriteTarget`.** The plan asked only for
  the flag arm to delegate. Passing the computed `declaredLocally` through the
  same function covers both arms, so the base/local path pairing has exactly one
  definition rather than one-and-a-half.

## Deviations from Plan

### 1. [Rule 2 — Missing critical] The helper returns `targetIsLocal`

- **Found during:** Task 1
- **Issue:** The plan's `<action>` specified `{ targetConfigPath, siblingConfigPath }`,
  but its flagged assumptions state that `103-06` needs the target's locality for
  `readDeclaredEnabled`'s identity label and will otherwise derive it by comparing
  paths — a re-derivation of a fact the helper already computed, and a place the
  read and the write could silently disagree.
- **Fix:** Added `targetIsLocal: boolean` to the returned shape. Callers that do
  not need it simply do not destructure it.
- **Verification:** `npm run typecheck`; the 46 cases in
  `tests/orchestrators/plugin/enable-disable.test.ts`.
- **Committed in:** `fdbc14e7`

### 2. [Rule 1 — Observed behavior] The base file is NOT untouched through the whole local chain

- **Found during:** Task 3
- **Issue:** The plan's acceptance criterion for the local chain says "the base
  file untouched". Probed empirically: it is untouched through the ENABLE leg,
  but the first RELOAD leg's first-run config materialization creates
  `claude-plugins.json` from recorded state with a **fieldless** `"foo@mp": {}`
  entry, and the UPDATE leg's still-flag-aimed `maybeWritePluginConfigBack`
  writes the same shadowed file again. Asserting "absent" after those legs would
  have failed against correct behavior.
- **Fix:** Asserted base-absent where it is true and load-bearing (immediately
  after ENABLE), and pinned the fieldless entry — with a comment naming both
  producers — after the reload and update legs. The fieldless entry carries no
  `enabled` field, so the local entry keeps replacing it wholesale and the merged
  view (asserted at every leg) does not move. This is the cosmetic pollution the
  plan already scoped OUT via `maybeWritePluginConfigBack`; it is now pinned
  rather than glossed, so a future change that starts writing a FIELD there
  fails a test instead of silently reversing a user.
- **Verification:** Probed the actual file contents at both legs before writing
  the assertions; 46/46 green.
- **Committed in:** `9599574e`

### 3. [Rule 3 — Blocking] The update leg needed a `plugin.json` version bump too

- **Found during:** Task 3
- **Issue:** The chain's UPDATE leg bumped only the marketplace entry's version
  and the record's version never moved, so the control proving the update really
  ran failed. `resolvePluginVersion` reads `plugin.json` as tier 1 and only falls
  through to the marketplace entry as tier 2.
- **Fix:** The update leg rewrites both the manifest entry and the plugin's
  `plugin.json` to `2.0.0`, with `defaultEnabled: false` preserved on the entry.
- **Verification:** Both chains assert the record's version moved to `2.0.0`.
- **Committed in:** `9599574e`

### 4. [Rule 3 — Blocking] Hoisted the existing inner `fileExists` helper

- **Found during:** Task 1
- **Issue:** The ENBL-01 `--local` case declared `fileExists` inline. Adding an
  identical module-level copy would trip `sonarjs/no-identical-functions`.
- **Fix:** Hoisted the one definition to module scope and deleted the inner one.
  No assertion changed.
- **Committed in:** `fdbc14e7`

---

**Total deviations:** 4 (1 missing critical, 1 observed-behavior correction, 2 blocking)
**Impact on plan:** No scope creep. Deviation 2 is the only one that changes what
an acceptance criterion asserts, and it makes the assertion true rather than
weaker.

## Mutation checks (required by the plan, all observed by hand)

| Mutation | Observed |
|---|---|
| Selection reverted to flag-only (`declaredLocally = false`) | Task 1's regression FAILS on the merged-view assertion — the local file still reads `enabled: false` |
| Selector's condition INVERTED | Task 2's base-declared control FAILS (7 cases fail in total), so the control is a real control |
| Task 1's wiring reverted, local chain | Fails FIRST at the ENABLE leg's merged-view assertion (`declaredEnabled: false` vs `true`) — earlier than the plan predicted. With that assertion and the two following it relaxed, the RELOAD leg then fails with the predicted reversal: `applyReconcile` emits `● mp [user]\n  ◍ foo v1.0.0 (disabled)\n\nReconcile: 1 success` and the record goes back. Both mutations were restored and the suite re-run green. |

## Issues Encountered

- `npm run typecheck` and the pre-commit `npm lint` hook transiently reported
  failures originating in **sibling plans' in-progress files**
  (`tests/orchestrators/reconcile/apply.test.ts` unused-import errors; a
  "files were modified by this hook" trip from a concurrent write). Both cleared
  without action on my part; `npm run lint` over the whole tree exits 0 and my
  three files pass `eslint` and `prettier --check` individually.
- TruffleHog fails structurally in a linked worktree (git-mode scan cannot read
  `.git/index`). Confirmed clean the sanctioned way — a `trufflehog filesystem`
  scan over the exact changed paths, `verified_secrets: 0`,
  `unverified_secrets: 0` — before each `SKIP=trufflehog` commit.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `node --test tests/orchestrators/plugin/enable-disable.test.ts` | 46 pass, 0 fail |
| `node --test "tests/orchestrators/plugin/**/*.test.ts"` | 775 pass, 0 fail |
| `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | 158 pass, 0 fail |
| `node --test "tests/architecture/**/*.test.ts"` | 353 pass, 0 fail |
| `npm run lint` | exit 0 |
| `prettier --check` (my three files) | clean |
| `selectConfigWriteTarget` in `enable-disable.ts` (non-comment) | 0 |
| `selectDeclaringConfigWriteTarget` in `enable-disable.ts` (non-comment) | 2 (import + ONE call site) |
| `selectConfigWriteTarget` in `install.ts` (non-comment) | 2 — untouched, superseded by `103-06` |

`npm run check` was deliberately NOT run: `103-05` owns the phase-boundary gate
and three sibling plans were mid-edit in the same worktree.

## Known Stubs

None.

## Next Phase Readiness

- `103-06` can consume `selectDeclaringConfigWriteTarget` as specified above.
  Read the two-fact list at the top of this SUMMARY before wiring it — the
  helper is async and lock-scoped, which moves `install.ts`'s selection site.
- `maybeWritePluginConfigBack` (`orchestrators/plugin/shared.ts`) remains the
  fourth flag-aimed write site, on the `update` / `reinstall` post-success paths.
  Out of scope by design and benign (its patch carries no field), and now pinned
  by Task 3's local chain. Recorded as a backlog candidate per the plan.

## Self-Check: PASSED

All three modified files exist on disk; all three task commits (`fdbc14e7`,
`432bd9c5`, `9599574e`) are present in `git log`;
`selectDeclaringConfigWriteTarget` is exported exactly once from `shared.ts`;
no planning-artifact reference (`Phase N` / `Plan N` / `Wave N` / `Pitfall N`)
appears in any of the three files.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*
