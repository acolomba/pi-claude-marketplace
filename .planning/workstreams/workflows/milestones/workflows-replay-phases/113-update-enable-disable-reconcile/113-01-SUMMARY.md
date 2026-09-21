---
phase: 113-update-enable-disable-reconcile
plan: 01
subsystem: ui
tags: [notify, info, workflows, output-catalog, typescript-types]

requires:
  - phase: 109-workflows-kind-inversion
    provides: "`componentPaths.workflows` on the resolver's installable arm — exposed there and read for the first time here"
  - phase: 111-workflows-bridge
    provides: "`discoverPluginWorkflows`, the `softFailWarning` template, and the install-tense phrases its fixtures pin"
  - phase: 112-uninstall-and-gc
    provides: "`record.resources.workflows` as a required persisted array with a migrate default fill"
provides:
  - "`info` renders a `workflows:` line on the resolved arm, the lenient arm and the state-only arm"
  - "`discoverPluginWorkflows` takes a REQUIRED `tense` discriminant with two total phrase tables"
  - "a compile-forcing coverage proof over the renderer's component-kind set, demonstrated to fire"
  - "`PluginInfoRow.notes` — the free-text advisory channel, redacted at the composition site"
  - "`advisoryFields` — the single omit-when-empty composer every info row builder spreads"
  - "three paired catalog states plus two live `list` regression cases"
affects: [113-02, 113-03, 113-04, 113-05]

actuals:
  tokens: 21639
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "`as const satisfies readonly T[]` + `Exclude`-based `_AssertNever` proof as the forcing construct for a closed set the renderer iterates"
    - "a required discriminant parameter instead of an optional one with a default, so the compiler enumerates every call site"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/workflows/types.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - docs/output-catalog.md
    - tests/bridges/workflows/discover.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "`COMPONENT_KINDS` keeps its literal member types via `as const satisfies readonly ComponentKind[]` rather than a widened tuple annotation — an annotated tuple makes the coverage proof vacuous, because every slot reports the whole union and `Exclude` always answers `never`."
  - "The two tense phrase tables are separate total `Record<WorkflowOutcomeSite, string>` constants, per CONTEXT; totality over the site union is what forces a sixth site into BOTH tenses."
  - "`skippedWarning` / `refusedWarning` were deleted — the table lookup made them redundant. `unrunnableWarning` survives because it owns the WVAL-02 reason text, which is load-bearing and not derivable from the table."
  - "The advisory label token is `note:` — generic, matching the field's name rather than its producer. Every later plan's fixtures must use this token."
  - "`pluginName` is a THIRD positional parameter on `composeResolvedComponents`, not a member of the `resolved` bag, so both `Parameters<typeof composeResolvedComponents>[1]` references stay valid untouched."
  - "`advisoryFields` centralises the omit-when-empty decision; five per-builder conditional spreads would have been five branch pairs the corpus could not all reach."
  - "The two `WorkflowOutcome*` unions are NOT re-exported from the bridge barrel — a re-export with no consumer fails the `fallow dead-code` gate."

patterns-established:
  - "A closed set the renderer iterates carries BOTH an `as const` literal tuple and an `Exclude`-based coverage proof, and the proof is demonstrated non-vacuous by reverting the member and recording the observed error."
  - "Free text taken out of a plugin's tree is reduced through `redactAbsolutePaths` at the COMPOSITION site, never in the renderer and never nowhere — that is what makes the rendered bytes both non-disclosing and machine-independent, and therefore pinnable."

requirements-completed: [WFLW-04]

coverage:
  - id: D1
    description: "`info` renders a `workflows:` line on the resolved arm listing both admitted verdict arms as generated `<plugin>:<name>`, sorted, last among the per-kind lines"
    requirement: "WFLW-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-04: an installed plugin lists both admitted workflow arms, sorted, after its skills"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-04: a plugin whose workflow scripts are all unadmitted renders no workflows line"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#(/claude:plugin info, installed-with-workflows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`info` renders a `workflows:` line on the state-only arm from the persisted record inventory, running no discovery"
    requirement: "WFLW-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-04: a manifest-absent record renders its persisted workflow inventory, sorted"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-04: the state-only arm carries no advisory line, because it runs no discovery"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#(/claude:plugin info, state-only-installed-with-workflows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "the lenient component-path map carries the conventional workflows directory alongside any declared string"
    requirement: "WFLW-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WFLW-04: the lenient component map carries the conventional workflows directory beside a declared one"
        status: pass
    human_judgment: false
  - id: D4
    description: "`discoverPluginWorkflows` cannot be called without stating its tense; both phrase tables are total over the site union; the read-failure phrase is split by call site in both tenses"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#states a skipped script in the preview tense (+5 sibling preview cases)"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#reports an entry whose lstat fails and still records its readable sibling"
        status: pass
    human_judgment: false
  - id: D5
    description: "the renderer's component-kind set carries a proof that FIRES on the widening direction"
    verification:
      - kind: other
        ref: "negative control: tuple entry removed, `npm run typecheck` observed to fail with TS2344 naming the uncovered kind (verbatim text recorded below)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`info` renders the preview-tense discovery warnings, path-reduced, after the component block"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WR-09: a refused workflow script renders one preview-tense advisory line last"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#NFR-9: an advisory naming the walked directory renders it reduced to its basename"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WR-09: the workflow names and the advisories come from one discovery pass"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#(/claude:plugin info, installed-with-workflow-preview-note)"
        status: pass
    human_judgment: false
  - id: D7
    description: "`list` renders unchanged for a workflow-bearing plugin on both sides of the installed/not-installed split"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WFLW-04: a workflow-bearing available plugin renders the generic available row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WFLW-04: a non-empty persisted workflow inventory leaves the installed row unchanged"
        status: pass
    human_judgment: false

duration: 93min
completed: 2026-09-05
status: complete
---

# Phase 113 Plan 01: The `info` workflows line and the discovery tense Summary

**`info` now shows a plugin's workflow commands and, for each script it will not admit, says in the future tense what would happen to it — behind a component-kind guard that was measured false, replaced, and watched fire.**

## Performance

- **Duration:** 93 min
- **Started:** 2026-09-05T22:50:00Z (approx.)
- **Completed:** 2026-09-06T00:23:00Z
- **Tasks:** 3 of 3
- **Files modified:** 10

## Accomplishments

- `componentPaths.workflows` has a reader. `info` renders a `workflows:` line on all three component arms — resolved, lenient, state-only — listing BOTH admitted verdict arms as their generated `<plugin>:<name>`, sorted, last among the per-kind lines.
- The renderer's component-kind set carries a real forcing construct, and the false comment that claimed the tuple length was one is gone. The proof was demonstrated non-vacuous, not assumed.
- `discoverPluginWorkflows` cannot be called without stating its tense. The compiler enumerated all 23 existing call sites; 6 more were added for the preview half.
- The preview phrases have an audience: `info` renders them as `note:` lines, path-reduced at the composition site, pinned by a catalog fixture.
- `list` is pinned as unchanged by two live runs rather than by fixtures whose bytes are identical to the generic rows by construction.

## Task Commits

1. **Task 1: End-to-end "info shows a plugin's workflows" — one path only** — `282c23f6` (feat)
2. **Task 2: The state-only arm, the lenient arm and the list regression** — `0fe0f018` (feat)
3. **Task 3: Render the preview-tense discovery warnings on `info`** — `e4e8c71d` (feat)

## The forcing-construct negative control

**Required by the plan and by the project's own gate rule: a gate wants a test that plants the violation, not one that reads the config.**

The `"workflows"` literal was removed from `COMPONENT_KINDS` while the interface key stayed. `npm run typecheck` then failed with, verbatim:

```
extensions/pi-claude-marketplace/shared/notify.ts(3540,57): error TS2344: Type '"workflows"' does not satisfy the constraint 'never'.
```

Error code **TS2344**. The error names the uncovered kind, which is why the `Exclude`-based form was chosen over a total-`Record` form. The entry was then restored and the typechecker returned to exit 0.

**The shape of the construct is load-bearing and is the reason the old one did not work.** The tuple must NOT carry a `readonly [ComponentKind, ComponentKind, ...]` annotation. Under that annotation `(typeof COMPONENT_KINDS)[number]` evaluates to the whole `ComponentKind` union, so `Exclude<ComponentKind, ComponentKind>` is `never` unconditionally and the proof passes for every possible interface — vacuously. The tuple is therefore declared `as const satisfies readonly ComponentKind[]`: `as const` preserves each member's literal type so `Exclude` has something real to subtract, and `satisfies` keeps the other direction (a member that is not a kind at all) a compile error.

## Answers the plan asked for

- **Verbatim typecheck error and code:** recorded above — `TS2344`, `Type '"workflows"' does not satisfy the constraint 'never'.`
- **Discovery call sites updated in the owner test:** **23** existing sites took `tense: "install"` (the count research predicted). **6** new preview-tense cases bring `tests/bridges/workflows/discover.test.ts` to **29** discovery calls and 37 `tense` mentions.
- **Did the `list` section already have a usable state?** **Yes — and it documented its own gap.** `workflow-available-inventory` already pins a workflow-bearing plugin's `(available)` row, and its own prose said: *"Nothing enforces the workflow-specific half of that claim… No test renders an inventory row for a workflow-bearing plugin."* No new catalog state was added. Instead two live `list` runs were added to `tests/orchestrators/plugin/list.test.ts` — one over a plugin whose source tree holds a workflow script, one over an installed record holding a non-empty workflow inventory — and the disclaimer paragraph was rewritten to name them, because it is no longer true.
- **Advisory label token:** **`note:`** — rendered as `    note: <text>` at four-space indent. Every later plan's fixtures must match this token.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/workflows/types.ts` — exports `WorkflowOutcomeTense` and `WorkflowOutcomeSite`
- `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` — the two total phrase tables, the `outcomePhrase` lookup, the required `tense` threading, the inspect/read split
- `extensions/pi-claude-marketplace/bridges/workflows/stage.ts` — the one production caller states `tense: "install"`
- `extensions/pi-claude-marketplace/shared/notify.ts` — the sixth `components` key, the `as const` tuple + `_ComponentKindsCoverageProof`, `PluginInfoRow.notes`, the `note:` render loop
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — required `componentPaths.workflows`, the `pluginName` third positional, `previewWorkflows`, `advisoryFields`, the state-only workflows axis, the lenient/warm-git maps
- `docs/output-catalog.md` — three new states; the `list` disclaimer rewritten; the `info` intro kind list corrected
- `tests/bridges/workflows/discover.test.ts` — 23 call sites updated, 6 preview cases added, the lstat expectation split
- `tests/orchestrators/plugin/info.test.ts` — 11 new cases across the three arms and the advisory channel
- `tests/orchestrators/plugin/list.test.ts` — 2 regression cases
- `tests/architecture/catalog-uat.test.ts` — 3 fixtures; example-count pin 182 → 185

## Decisions Made

Recorded in `key-decisions` above. The three that will matter downstream:

1. **`note:` is the advisory token.** Fixed from this commit on; the catalog pins it.
2. **`composeResolvedComponents` returns `{ components, notes }`.** Its `Awaited<ReturnType<…>>` consumers now index `["components"]`. Plans 02–05 touching a row builder must spread `advisoryFields(composed.notes)` rather than testing emptiness inline.
3. **The tense unions live in `bridges/workflows/types.ts` only.** They are not on the barrel. A later plan that needs them outside `discover.ts` should import from `./types.ts` and add the barrel re-export in the same commit as its first consumer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The bridge barrel re-export failed the dead-code gate**

- **Found during:** Task 1
- **Issue:** The plan's action text says to re-export `WorkflowOutcomeTense` and `WorkflowOutcomeSite` through `bridges/workflows/index.ts`. Nothing consumes them from there — `discover.ts` imports them from `./types.ts`, and `info.ts` passes a string literal — so `fallow dead-code` reported two `unused-type (re-export)` findings and exited 1. `npm run fallow` is a mandatory member of `npm run check` and carries zero approved overrides.
- **Fix:** Dropped the two barrel re-exports. Both types stay exported from `types.ts`, which is what the plan's `<artifacts>` contract requires (`types.ts` provides `WorkflowOutcomeTense`). Adding two `unused-type` suppressions for symbols with no consumer would have been worse than not re-exporting them.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/index.ts` (net zero — the file is unchanged from `main`)
- **Verification:** `npm run fallow` exits 0.
- **Committed in:** `282c23f6`

**2. [Rule 1 - Bug] The coverage proof as specified would have been vacuous**

- **Found during:** Task 1
- **Issue:** The plan says to "extend `COMPONENT_KINDS` to six type slots" AND add an `Exclude`-based proof over `(typeof COMPONENT_KINDS)[number]`. Those two instructions are incompatible: with the slot annotation retained, the indexed access evaluates to the whole `ComponentKind` union and the `Exclude` is `never` for every possible interface. The guard would have compiled, passed, and guarded nothing — the exact failure mode the task exists to end.
- **Fix:** Dropped the slot annotation in favour of `as const satisfies readonly ComponentKind[]`, which preserves the literal member types for the proof and keeps the extra-member direction a compile error.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
- **Verification:** the negative control above — removing the entry produces TS2344 naming `"workflows"`. Had the annotation been kept, that run would have exited 0.
- **Committed in:** `282c23f6`

**3. [Rule 2 - Missing critical functionality] Five conditional advisory spreads reduced to one composer**

- **Found during:** Task 3
- **Issue:** Spreading `...(composed.notes.length > 0 && { notes: composed.notes })` at each of the five row builders left four branch pairs the test corpus could not reach (`node scripts/test-coverage-direct.mjs` reported branches 321/325 for `info.ts`). Reaching them would have meant four contrived fixtures asserting the same one-line decision.
- **Fix:** Extracted `advisoryFields(notes)`, spread by every builder. The omit-when-empty decision — the one that keeps an unaffected row's bytes unchanged — now has a single site.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** `node scripts/test-coverage-direct.mjs …/info.ts` → branches 323/323, functions 68/68, lines 2507/2507.
- **Committed in:** `e4e8c71d`

**4. [Rule 2 - Missing critical functionality] Two catalog claims went stale**

- **Found during:** Tasks 1 and 2
- **Issue:** The `info` section intro enumerated the per-kind order as `agents, commands, mcp, skills`, which the new line makes incomplete. The `list` section's `workflow-available-inventory` state carried a paragraph stating that nothing enforced its workflow-specific claim — no longer true once the two live `list` runs landed.
- **Fix:** Added `workflows` to the intro's order list (the pre-existing omission of `hooks` was left alone — not caused by this change). Rewrote the `list` paragraph to name the two tests that now supply the missing half.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** `node --test tests/architecture/catalog-uat.test.ts` exits 0 with 185 paired states.
- **Committed in:** `282c23f6`, `0fe0f018`

---

**Total deviations:** 4 auto-fixed (1 × Rule 1, 2 × Rule 2, 1 × Rule 3)
**Impact on plan:** No scope creep. Deviation 2 is the significant one — following the plan's literal instruction would have shipped a guard that never fires, which is the defect the task was written to remove. It was caught by running the negative control the plan mandated, which is the argument for mandating it.

## Issues Encountered

- **One existing fixture pinned the phrase the plan deliberately splits.** `tests/bridges/workflows/discover.test.ts`'s lstat case asserted `could not be read and was skipped` at the inspection site. Updated to `could not be inspected and was skipped` — this is the split CONTEXT prescribes, not a retune.
- **A broad string replacement hit an unrelated expectation.** A `{unreadable}` → `{unsupported source, unreadable}` edit matched a second, pre-existing NUL-byte test. Caught by the suite in the same run and reverted at that line before commit; the NUL-byte test's bytes are unchanged from `main`.
- **`pre-commit run` overlapped with an in-flight edit and reported "files were modified by this hook"** on `npm-lint`. It was my own concurrent write to `notify.ts`, not a hook rewrite. Re-run clean with no edits in flight before every commit; `git status` after each commit shows no hook-written file.
- **TruffleHog fails structurally in this linked worktree** (`.git` is a file, so the git-mode scan cannot read `.git/index`). Confirmed clean via filesystem-mode scans over the exact paths committed — `verified_secrets: 0`, `unverified_secrets: 0` for all three commits — then committed with `SKIP=trufflehog` only, per CLAUDE.md.

## Gate status

`npm run check` members all run and green at the final commit:

| Member | Result |
|---|---|
| `typecheck` | exit 0 |
| `lint` | exit 0 |
| `fallow` (dead-code / health / dupes) | exit 0 |
| `format:check` | clean after `npm run format` |
| `test:corresponding` (+ negative) | passed |
| `test:coverage:direct:negative` | passed |
| `test` | 5461 pass / 0 fail |
| `test:integration` | 32 pass / 0 fail |
| `test-coverage-direct` on `info.ts` | branches 323/323, functions 68/68, lines 2507/2507 |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. Three things plans 02–05 inherit:

- **`note:` is the fixed advisory token.** Plan 05's `pending` advisories and plan 04's stamp fixtures must match it if they render on this family.
- **`composeResolvedComponents` returns `{ components, notes }`**, and `advisoryFields` is the sole omit-when-empty composer. A new info row builder spreads it rather than testing emptiness.
- **The `catalog-uat` example-count pin is now 185.** Every plan adding a state bumps it in the same commit.

No blockers. Nothing in this plan touches `update.ts`, `enable-disable.ts`, `install.ts` or `workflows-staging-gc.ts`, so plans 02–05 start from an unmodified base in their own files.

---
*Phase: 113-update-enable-disable-reconcile*
*Completed: 2026-09-05*

## Self-Check: PASSED

Every file this summary claims exists on disk, and every commit hash it names resolves in `git log`.

- Files verified: `113-01-SUMMARY.md`, `bridges/workflows/types.ts`, `bridges/workflows/discover.ts`, `shared/notify.ts`, `orchestrators/plugin/info.ts`, `docs/output-catalog.md`
- Commits verified: `282c23f6`, `0fe0f018`, `e4e8c71d`, `3f1f0ca3`
- `.planning/workstreams/workflows/STATE.md` and `ROADMAP.md`: untouched, per the orchestrator's ownership of those files.
