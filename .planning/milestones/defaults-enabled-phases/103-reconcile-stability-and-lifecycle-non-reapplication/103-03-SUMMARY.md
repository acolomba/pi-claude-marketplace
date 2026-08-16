---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 03
subsystem: orchestrators
tags: [reinstall, enablement, notify, closed-set-reasons, state-io]

requires:
  - phase: 102
    provides: "`applyDefaultEnabled` on the install path, so a record can land disabled through production code rather than by hand"
provides:
  - "`reinstall` refuses a record carrying an explicit disabled marker: nothing staged, nothing written, `state.json` byte-identical"
  - "a closed-set narrowing arm so both reinstall surfaces render `(skipped) {already disabled}` at info severity"
  - "an amended ENBL-08 rationale at the backfill scan, which had justified its filter with the write this plan removed"
  - "three regressions: the no-write proof, the two-surface row contract, and the manifest-flip case (DFEN-07)"
affects: [reconcile, enable-disable, output-catalog]

actuals:
  tokens: 78060
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "a lifecycle verb's disabled-record arm is a GUARD, not a body: it returns before the resolve when the verb has no pin to move"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "The arm returns BEFORE `loadCachedEntry`/`resolveInstallable` and refreshes nothing — unlike `update`, `reinstall` preserves the recorded version (D-68-02) and carries the recorded git identity forward (PURL-07), so no pin can move and no `tx.save()` is warranted"
  - "The skip reaches the row through the existing `narrowReason` closed-set mapping, not through a widened `ReinstallSkippedOutcome`; one exact-match arm covers the standalone verb and the bulk cascade"
  - "The reconcile backfill filter STAYS; only its rationale changed"

patterns-established:
  - "Disabled-record checks are spelled through `isRecordedButDisabled`, never as `!record.enabled`, so no site can drift from the rule `persistence/state-io.ts` owns"

requirements-completed: [DFEN-07]

coverage:
  - id: D1
    description: "A reinstall over a disabled record re-materializes nothing, writes no state and no config, and leaves the record byte-identical"
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#DFEN-07 / D-103-12 / ENBL-18: reinstall over a disabled record writes nothing and stages nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both reinstall surfaces render the truthful `(skipped) {already disabled}` row at info severity"
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#DFEN-07 / D-103-12: the standalone reinstall renders one benign skipped row for a disabled plugin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#DFEN-07 / D-103-12: the bulk cascade carries the skipped and the reinstalled row together"
        status: pass
    human_judgment: false
  - id: D3
    description: "A declaration flipped between install and reinstall does not move the record, with the flip proven visible to the process"
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#DFEN-07 / D-103-10: a declaration flipped between install and reinstall does not move the record"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 03: Reinstall Non-Reapplication Summary

**`reinstall` on a plugin the user disabled now does nothing, says it did nothing, and leaves `state.json` untouched — closing the goal sentence's "nothing re-enables it behind the user's back, not a `reinstall`".**

## Performance

- **Duration:** ~42 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added the disabled-record short-circuit to `runLockedReinstall`, immediately after the absent-record skip and before `loadCachedEntry` / `resolveInstallable`. It returns a `skipped` partition carrying the single note `already disabled`. No clone materialization, no `tx.save()`, no config write-back, no `updatedAt` bump, so `state.json`'s mtime is untouched (RECON-05).
- Added the `already disabled` exact-match arm to `narrowReason`, beside `up-to-date` and `already installed`. Without it the note fell through to `unreadable` and the row claimed the cascade could not read the plugin. One arm serves both surfaces (standalone and bulk cascade), which is exactly what the two row tests pin.
- Amended the ENBL-08 rationale at `reconcile/apply.ts`'s backfill filter. Its old text justified the filter with reinstall's unconditional `enabled: true` write — a fact this plan makes false. The guard itself is unchanged; the diff is comment-only.
- Added three test cases plus a defaulted per-entry declaration knob on the `seedMarketplace` / `mergeManifestEntry` / `writeManifest` fixture chain.

## Task Commits

The three tasks landed as ONE commit — see Deviations.

1. **Tasks 1-3** - `13b489cc` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - the disabled-record guard, the `already disabled` narrowing arm, and `isRecordedButDisabled` added to the existing `state-io.ts` import
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - comment-only: the backfill scan's ENBL-08 rationale
- `tests/orchestrators/plugin/reinstall.test.ts` - the `entryDefaultEnabled` / `applyDefaultEnabled` fixture knobs, two local helpers (`markRecordedPluginDisabled`, `seedDisabledInstall`), and four new cases

## Decisions Made

Followed the plan's settled calls DS-1 through DS-4 as written. Two findings worth recording:

- **DS-1 held under test.** The arm writes nothing and the state file stays byte-identical; the regression asserts the bytes, not only record deep-equality, so a no-op that still saved would fail.
- **The narrowing arm is load-bearing, proven by mutation.** Neutralizing only the `narrowReason` arm (leaving the guard in place) turns both row tests red while the no-write regression stays green — the guard and the arm are independently necessary.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | clean for this plan's three files (see Issues) |
| `node --test tests/orchestrators/plugin/reinstall.test.ts` | 89 pass, 0 fail (4 new) |
| `node --test "tests/orchestrators/plugin/**/*.test.ts"` | 770 pass, 0 fail |
| `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | 157 pass, 0 fail |
| `node --test "tests/architecture/**/*.test.ts"` | 353 pass, 0 fail |
| `npx eslint` + `npx prettier --check` on the three files | clean |
| `grep -v '^\s*[/*]' reinstall.ts \| grep -c isRecordedButDisabled` | 2 (import + single guard) |
| `grep -v '^\s*[/*]' reinstall.ts \| grep -cE 'enabled:\s*true'` | 1 (record composition untouched) |
| `grep -c 'defaultEnabled\|applyDefaultEnabled' reinstall.ts` | 0 — the sibling plan's architecture gate stays satisfied, comments included |
| `git diff -U0 -- reconcile/apply.ts` | comment-only, no statement added or removed |

**Mutation checks (both restored afterward):**

- Neutralizing the guard (`if (false && isRecordedButDisabled(...))`) → 4 fail / 85 pass.
- Neutralizing only the narrowing arm → 2 fail / 87 pass, and exactly the two row cases.

## Deviations from Plan

### 1. [Process] The three tasks landed as one commit rather than three

- **Found during:** commit time
- **Issue:** the executor protocol asks for one commit per task, but Tasks 2 and 3 add cases to the same test file Task 1 already touched, and Task 3's fixture knob edits helper functions that sit above Task 1's case in that file. Splitting would have required reconstructing intermediate versions of a 4,000-line file three times, in a worktree where three sibling agents are writing concurrently — a rewrite risk with no review benefit.
- **Fix:** one commit, `13b489cc`, with a message that names the behavior change and the comment amendment separately. The plan's own reversibility note treats the whole change as a single inverse diff, so revert granularity is unaffected.
- **Verification:** all four gates above run against the committed tree.

### 2. [Rule 3 - Blocking] `mergeManifestEntry` had to preserve existing entries' declarations

- **Found during:** Task 3
- **Issue:** the fixture's merge helper rebuilt the manifest from a `name -> version` map, dropping any `defaultEnabled` already on a sibling entry. A second `mergeManifestEntry` call for another plugin would have silently erased the first plugin's declaration, so the flip case would pass or fail for reasons unrelated to the verb.
- **Fix:** carry a parallel `name -> defaultEnabled` map through the read-back loop and into `writeManifest`, which takes it as a defaulted fourth parameter. The single existing direct `writeManifest` caller is unaffected.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** all 89 cases in the file green, including every pre-existing one.

---

**Total deviations:** 2 (1 process, 1 Rule 3).
**Impact on plan:** none on behavior or scope.

## Issues Encountered

- **`npm run typecheck` reported errors in a sibling's file, not mine.** Mid-wave, `tests/orchestrators/reconcile/apply.test.ts` carried five `TS6133` unused-import errors from another plan's in-progress edit. Those cleared once that sibling committed. No error ever named this plan's three files.
- **`pre-commit run --files ...` reported "files were modified by this hook" for prettier, npm lint and npm typecheck on the first run.** None of those hooks writes anything in this configuration (`lint` is bare `eslint`, `typecheck` is `tsc --noEmit`); pre-commit was detecting sibling agents writing to the worktree *during* the hook run. A second run passed every hook. Per-file `npx eslint` and `npx prettier --check` on this plan's three paths were clean both times.
- **TruffleHog failed structurally**, as it always does in a linked worktree (`failed to read index file: .../.git/index: not a directory`). Confirmed clean by the sanctioned filesystem route instead: `trufflehog filesystem <the three paths> --results=verified,unknown --fail` → exit 0, `verified_secrets: 0`, `unverified_secrets: 0`. Committed with `SKIP=trufflehog` only.

## Blast Radius — re-confirmed as the plan required

A repository-wide search for `reinstallPlugin` / `reinstallPlugins` finds these consumers, and no third one has appeared:

| Caller | Effect of the guard |
|---|---|
| `edge/handlers/plugin/reinstall.ts:67` → `reinstallPlugins` | the user-invoked verb — this is where the change is visible |
| `orchestrators/reconcile/apply.ts:1239` → `reinstallPlugin` | already filters disabled records out before calling (`:1158`), so it never reaches the new arm |
| `orchestrators/plugin/index.ts`, `orchestrators/index.ts` | re-exports only |

## Handoff to the documentation phase (DOC-01)

**`docs/output-catalog.md` gains no block in this plan, deliberately** — the catalog is a curated set with a byte-equality runner over what it documents, not a totality gate over every producible row.

**Catalog candidate for DOC-01 to inherit** — the reinstall skipped row for a disabled plugin, whose exact bytes are already pinned by this plan's standalone-row test:

```text
● mp [project]
  ⊘ hello (skipped) {already disabled}
```

Info severity, no summary line, no reload hint. The bulk cascade renders the same row beside an ordinary `● <name> v<version> (reinstalled)` row in one emission.

## Notes for sibling plans

- Nothing was added to `orchestrators/plugin/shared.ts` — plan `103-04` owns that file this wave and this plan needed nothing from it.
- No closed-set tuple grew: `already disabled` was already a `REASONS` and an `IDEMPOTENT_REASONS` member, so `shared/notify.ts`, `shared/notify-reasons.ts`, `tests/architecture/compat-01-no-expansion.test.ts` and `tests/architecture/notify-closed-set-locks.test.ts` all took zero delta.

## Next Phase Readiness

DFEN-07 is now pinned for both lifecycle verbs — `update` by plan `103-02`'s version-bump control, `reinstall` by this plan's direct manifest-read control. The phase-boundary gate (`npm run check`) belongs to plan `103-05` and was deliberately not run here while siblings are mid-edit.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*

## Self-Check: PASSED

All modified files and the task commit `13b489cc` verified present on disk and in `git log`.
