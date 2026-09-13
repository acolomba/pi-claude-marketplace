---
phase: 07-gate-integrity
plan: 08
subsystem: domain
tags: [closed-set, compile-time-proof, architecture-gates, hook-events, soft-dep]

requires:
  - phase: 07-gate-integrity
    plan: 01
    provides: the house shape for an architecture gate that is observed to fire before it is trusted
provides:
  - "_BucketAEventsCoverageProof — the compile-time proof that every ClaudeHookEvent is registered in BUCKET_A_EVENTS (the direction `satisfies readonly T[]` does not constrain)"
  - "a corrected BucketAEvent doc block stating one mechanism per direction instead of a bidirectional claim the compiler does not make"
  - "tests/architecture/closed-set-enrollment.test.ts — the SCN-F025 / GGAT-04 enrollment gate for ClaudeHookEvent (via BUCKET_A_EVENTS / TOOL_EVENTS) and Dependency (via softDepMarkers)"
affects: [07-15, gate-integrity, architecture-gates]

actuals:
  tokens: 41000
  tasks: 2
  commits: 2
  plan_head_before: f25c8b5f

tech-stack:
  added: []
  patterns:
    - "Reverse completeness proof: Exclude<Union, TupleMember> pinned to never through an _AssertNever constraint, exported so noUnusedLocals stays quiet, consumed by the owner test"
    - "Closed-set enrollment through existing runtime surface: pin the behaviour the set drives rather than adding a tuple purely to be counted"

key-files:
  created:
    - tests/architecture/closed-set-enrollment.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/domain/components/hook-events.test.ts

key-decisions:
  - "The reverse proof lives in hook-events.ts, not in a test. A test cannot make the compiler reject an unregistered union member; only a type constrained to never can, and it must sit where the tuple sits."
  - "Dependency is enrolled through softDepMarkers and REASONS. No DEPENDENCIES tuple was added — the module's own doc argues against one, and a tuple that exists only to be counted is production surface added for a test's benefit."
  - "The BUCKET_A_EVENTS negative control appended a duplicate valid member (\"Stop\") rather than a new event name. Six executor agents share this working tree; a tuple entry outside ClaudeHookEvent turns the whole-repo typecheck red and would have failed siblings' pre-commit hooks. The length case fires identically either way."
  - "The owner test consumes _BucketAEventsCoverageProof, mirroring notify-reasons.test.ts. That is what clears fallow's unused-type finding without a suppression."

requirements-completed: [GGAT-04]

coverage:
  - id: D1
    description: "A ClaudeHookEvent member left out of BUCKET_A_EVENTS is a TS2344 compile error naming the proof site"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "npx tsc --noEmit with \"Notification\" planted in the ClaudeHookEvent union — hook-events.ts(90,56): error TS2344"
        status: pass
    human_judgment: false
  - id: D2
    description: "A BUCKET_A_EVENTS entry outside ClaudeHookEvent still fails at the satisfies site, so both directions break the typecheck"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "npx tsc --noEmit with \"Notification\" planted in BUCKET_A_EVENTS — hook-events.ts(52,3): error TS2322"
        status: pass
    human_judgment: false
  - id: D3
    description: "The BucketAEvent doc block states what the two mechanisms actually guarantee, one per direction"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "grep -c 'or vice versa' → 0; grep -c 'Exclude<ClaudeHookEvent' → 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "BUCKET_A_EVENTS is pinned at 10 and TOOL_EVENTS at 3, each with a per-bump comment, plus the subset relation"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: BUCKET_A_EVENTS is the closed 10-entry admitted-event set"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: TOOL_EVENTS is the closed 3-entry tool-matcher subset"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: every TOOL_EVENTS member is an admitted bucket-A event"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dependency is enrolled through softDepMarkers: canonical order, both single-flag cases, both empty cases, and catalog containment"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: softDepMarkers emits both markers in canonical agents-before-mcp order"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: softDepMarkers emits only the agents marker for an agents-only declaration"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: softDepMarkers emits only the mcp marker for an mcp-only declaration"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: softDepMarkers emits nothing when the row declares neither dependency"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: softDepMarkers emits nothing when both companions are loaded"
        status: pass
      - kind: unit
        ref: "tests/architecture/closed-set-enrollment.test.ts#SCN-F025: every marker softDepMarkers can emit is a REASONS catalog member"
        status: pass
    human_judgment: false
  - id: D6
    description: "The gate was observed failing on a planted additive drift and on a reversed marker order"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "node --test with an 11th BUCKET_A_EVENTS entry → actual: 11, expected: 10; with reversed softDepMarkers pushes → actual: ['requires pi-mcp','requires pi-subagents']"
        status: pass
    human_judgment: false
  - id: D7
    description: "The slice holds under typecheck, ESLint, all three Fallow sub-gates, Prettier, direct coverage, and the whole architecture suite"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "npx tsc --noEmit; npx eslint --max-warnings=0; npm run fallow; npm run format:check; npm run test:coverage:direct; node --test 'tests/architecture/*.test.ts' (374 pass)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 08: Closed-Set Enrollment Summary

**`hook-events.ts` claimed `satisfies readonly T[]` broke the typecheck in both directions; the compiler says otherwise, so the missing direction is now an `Exclude<>`-to-`never` proof beside the tuple, the doc block says what the code actually does, and both previously unenrolled closed sets sit behind a gate that has been watched to fail.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-10T15:33:17Z
- **Completed:** 2026-09-10T16:18:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Added `_BucketAEventsCoverageProof` to `domain/components/hook-events.ts`, mirroring `notify-reasons.ts::_ReasonsCoverageProof` exactly: a local `_AssertNever<T extends never>`, a local `_UnregisteredHookEvent = Exclude<ClaudeHookEvent, BucketAEvent>`, and one exported type applying the first to the second. A `ClaudeHookEvent` member left unregistered is now a TS2344 build failure instead of a hook the resolver admits and no dispatch translator routes.
- Rewrote the `BucketAEvent` doc block as one mechanism per direction, naming which mechanism carries which. The block no longer claims that a `BUCKET_A_EVENTS` edit "or vice versa" breaks the typecheck at the assertion site.
- Built `tests/architecture/closed-set-enrollment.test.ts` (9 cases): the `BUCKET_A_EVENTS` length pin at 10 with its per-bump ledger, the `TOOL_EVENTS` length pin at 3, the tool-event subset relation, and six `softDepMarkers` cases covering canonical order, each single-flag case, the both-flags-false case, the both-loaded case, and catalog containment.
- Enrolled `Dependency` without adding a runtime tuple. `git diff` on `shared/concerns/soft-dep.ts` is empty; the gate reaches the closed set through `softDepMarkers` and `REASONS`, both of which already exist.

## Task Commits

1. **Task 1: Reverse proof + corrected doc claim** — `a186366f` (fix)
2. **Task 2: Closed-set enrollment gate** — `70153616` (test)

## Observed Compiler Output — Both Directions

The plan required these be measured, not reasoned about. Both plants were applied, compiled, and restored inside a single shell invocation each, so the shared working tree was never left broken between commands.

**Direction 1 — a `ClaudeHookEvent` member left unregistered.** `"Notification"` appended to the union in `shared/concerns/hooks.ts`:

```
extensions/pi-claude-marketplace/domain/components/hook-events.ts(90,56): error TS2344: Type '"Notification"' does not satisfy the constraint 'never'.
tests/shared/concerns/hooks.test.ts(30,1): error TS2578: Unused '@ts-expect-error' directive.
tests/shared/concerns/hooks.test.ts(45,1): error TS2578: Unused '@ts-expect-error' directive.
tests/shared/concerns/hooks.test.ts(48,1): error TS2578: Unused '@ts-expect-error' directive.
```

Line 90 is `export type _BucketAEventsCoverageProof = _AssertNever<_UnregisteredHookEvent>;` — the proof site names itself in the failure. Before this change the same plant compiled clean, which is the falsification `07-RESEARCH.md` §7 recorded.

**Direction 2 — a tuple entry outside the union.** `"Notification"` appended to `BUCKET_A_EVENTS`:

```
extensions/pi-claude-marketplace/domain/components/hook-events.ts(52,3): error TS2322: Type '"Notification"' is not assignable to type 'ClaudeHookEvent'.
```

Line 52 is the `as const satisfies readonly ClaudeHookEvent[]` assertion — the pre-existing mechanism, still firing. That plant also cascaded nine further `TS2741` / `TS1360` / `TS7053` errors across `bridges/hooks/{async-rewake/registry,dispatch-exec,timeout}.ts`, `hook-events.ts`'s own two matcher tables, and `domain/components/hooks/partition.ts`, because those exhaustive records are keyed on the derived union. The first direction produced no such cascade, which is precisely why it needed its own proof.

## Observed Gate Negative Controls

**Control C — additive drift on `BUCKET_A_EVENTS`.** A member appended to the tuple:

```
✖ SCN-F025: BUCKET_A_EVENTS is the closed 10-entry admitted-event set
    actual: 11,
    expected: 10,
ℹ pass 8
ℹ fail 1
```

The appended member was a duplicate `"Stop"` rather than a new event name — see the deviation below for why.

**Control D — reversed marker order in `softDepMarkers`.** The two `push` calls swapped in `shared/concerns/soft-dep.ts`:

```
✖ SCN-F025: softDepMarkers emits both markers in canonical agents-before-mcp order
    actual: [ 'requires pi-mcp', 'requires pi-subagents' ],
    expected: [ 'requires pi-subagents', 'requires pi-mcp' ],
ℹ pass 8
ℹ fail 1
```

Both files were restored from a backup copy taken in the same command; `git diff` confirms `soft-dep.ts` is byte-clean and `hook-events.ts` carries only this plan's change.

## Fallow Unowned-Export Census Delta

`npx fallow dead-code --production --unused-exports --format json`, measured before Task 1 and again after both commits:

| Field | Before | After |
|-------|--------|-------|
| `total_issues` | 102 | 102 |
| `unused_exports` | 102 | 102 |
| `unused_types` | 0 | 0 |
| `private_type_leaks` | 0 | 0 |

**The new type export gained no entry.** Filtering both censuses for `BucketAEventsCoverageProof` returns an empty list. `07-15-PLAN.md` pins this census and needs the delta: it is zero — the 102-entry list that plan pins is unchanged by this plan.

That is the `--production` census. The **non-production** run that `npm run fallow` (and therefore the `npm-fallow` pre-commit hook) executes did react, and had to be resolved before either commit could land:

- `● Unused type exports (1)` — `_BucketAEventsCoverageProof`. Resolved the way `_ReasonsCoverageProof` resolves it: the owner test imports the proof and pins it exactly-`never`. No suppression.
- `● Private type leaks (2)` — the proof references `_AssertNever` and `_UnregisteredHookEvent`. Resolved with the marker the plan conditionally authorizes; see the deviation below.

## Decisions Made

- **The reverse proof belongs in production, not in a test.** A test cannot make `tsc` reject an unregistered union member. Only a type whose constraint is `never` can, and it has to sit in the module that declares the tuple. The length pin is the opposite case — a bump should be a conscious edit in a gate file, not a silent one in a domain module — which is why the two halves live apart.
- **`Dependency` is enrolled through behaviour, not through a count.** `soft-dep.ts`'s own doc says nothing iterates the members at runtime, so a `DEPENDENCIES` tuple would exist solely to be counted. The gate pins what the set actually drives: `softDepMarkers` handles exactly two flags, orders them agents-before-mcp, returns `[]` for the neither-declared and both-loaded cases, returns one marker per single-flag case, and emits only `REASONS` members. A third dependency added to the union with no `softDepMarkers` branch would leave every one of those unchanged, which is the drift the plan named.
- **The owner test's exactness pin wraps both sides in tuples.** `[_BucketAEventsCoverageProof] extends [never]` rather than the naked form. A naked `never extends …` conditional distributes over `never` and short-circuits to `never`, so the bare form would have been a pin that could not fail — the same defect class this phase exists to close. `_ReasonsCoverageProof` sidesteps this by being a tuple type already.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `fallow-ignore-next-line private-type-leak` added, against the dispatch prompt's blanket no-marker constraint**

- **Found during:** Task 1
- **Issue:** With the proof in place, `npm run fallow` exits 1 on `● Private type leaks (2)` — `_BucketAEventsCoverageProof references private type _AssertNever` and `… _UnregisteredHookEvent`. `npm-fallow` is a pre-commit hook matching `extensions/.*\.ts`, so the commit could not land. The dispatch prompt's phase constraint 4 forbids `fallow-ignore` markers; the plan's own Task 1 action explicitly authorizes this one, conditionally: "carry the same `fallow-ignore-next-line private-type-leak` justification if and only if fallow reports the leak; do not add the marker preemptively."
- **Fix:** Added the marker, one line, naming only `private-type-leak` and carrying a justification in the house form. This is the fifth occurrence of exactly this pattern in the tree — `notify-reasons.ts:270`, `resolver-types.ts:37`/`:61`/`:63`, and both `*.messaging.ts` `_ReasonInSet` guards all suppress the same finding for the same reason: a compile-time proof's internals are meaningless to a caller, and exporting them to satisfy the analyzer would widen the module's public surface to no one's benefit. The alternatives were measured and are worse: exporting `_AssertNever` and `_UnregisteredHookEvent` trades one suppressed finding for two new public types with no consumers, and an inlined conditional-type form (`Exclude<…> extends never ? true : never`) compiles clean when the set drifts, moving the failure out of the production module entirely.
- **Files modified:** `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
- **Verification:** `npm run fallow` exits 0 with all three sub-gates green; the marker is not stale (`0 stale suppressions`).
- **Committed in:** `a186366f`
- **Note for the phase owner:** if constraint 4 is meant to override the plan here, the proof needs a different shape and Task 1 needs replanning — the marker is not removable on its own.

**2. [Rule 3 - Blocker] The `BUCKET_A_EVENTS` negative control appended a duplicate member rather than a new one**

- **Found during:** Task 2
- **Issue:** The plan says "temporarily append a member to `BUCKET_A_EVENTS`". Appending a name outside `ClaudeHookEvent` turns the whole-repo `tsc --noEmit` red, and `npm-typecheck` is a `pass_filenames: false` pre-commit hook. Five sibling executors are committing against this same working tree; a red typecheck during the plant window would have failed their hooks on a fault none of them introduced.
- **Fix:** Appended a duplicate `"Stop"` instead. The tuple grows to 11, the length case fires with `actual: 11, expected: 10`, and the typecheck stays green throughout. The assertion under test is the count, and the count does not care which member was appended.
- **Files modified:** none persisted — planted and restored inside one command.
- **Verification:** Control C output above; `git diff` on `hook-events.ts` shows only this plan's change.
- **Committed in:** n/a (transient)

---

**Total deviations:** 2 auto-fixed (2 × Rule 3 - blocking issue).
**Impact on plan:** No scope change. Deviation 1 is one comment line the plan itself names, resolving a gate the plan's own artifact triggers. Deviation 2 changes which member a transient plant used and weakens nothing — the control fired.

## Issues Encountered

**One acceptance criterion cannot return 0 as written.** The criterion is `grep -c "DEPENDENCIES" extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` returns 0. It returns **1**, and did before this plan: line 27 of that file reads "Spelled out as a literal union rather than a runtime `DEPENDENCIES` tuple". The match is the doc comment explaining why no tuple exists — the exact rationale the criterion is protecting. The criterion's substance holds and is better checked directly: `git diff HEAD -- extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` is empty. No runtime tuple was added; the file was not modified at all.

**`shared/concerns/hooks.ts` carries the same falsified claim, one layer up, and is out of this plan's `files_modified`.** Lines 20-24 of that file say the runtime tuples "are pinned to these literal unions via a `satisfies readonly ClaudeHookEvent[]` … assertion in that file -- one drifts, the typecheck breaks at the source-of-truth assertion site." As of this change that sentence is now true, because the proof exists — but it credits the wrong mechanism, naming only the `satisfies` assertion. It should name both. Left untouched: the file is not in this plan's declared set and six agents share this tree. Worth a one-line correction in a later plan that owns that file.

**Sibling noise cost roughly three minutes of waiting.** `npm-typecheck`, `npm-lint`, and `npm-fallow` are whole-repo, `pass_filenames: false` hooks. Task 1's pre-commit run failed four times on errors in `bridges/hooks/dispatch.ts`, `tests/bridges/hooks/dispatch.test.ts`, `orchestrators/plugin/reinstall-replace.ts`, and `tests/orchestrators/plugin/reinstall-replace.test.ts` — none of them files this plan owns. Polled at 40-45s intervals until clean, then committed. No sibling file was edited.

**The `WINDOWS.md` ledger could not be appended to.** `gsd-tools windows append` still refuses with the row-30/row-9 table-versus-JSON desync `07-01-SUMMARY.md` reported. The two deviations are recorded here only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`07-15-PLAN.md` pins the `fallow dead-code --production --unused-exports` census and needs this plan's delta before it can pin a number: **the delta is zero.** The 102-entry census is unchanged, and `_BucketAEventsCoverageProof` appears in neither the before nor the after list. `07-15` can pin against the census it already measured.

The proof pattern is now in the tree twice (`notify-reasons.ts` and `hook-events.ts`) with the same four parts each time — `_AssertNever`, one or more `Exclude` aliases, one exported proof type, one `private-type-leak` marker, and an owner-test exactness pin. Any further union/tuple pair this milestone finds unenrolled can copy it directly. The one thing to copy carefully is the exactness pin's tuple wrappers: a single-member proof pinned with a naked `extends never` conditional distributes to `never` and can never fail.

`tests/architecture/closed-set-enrollment.test.ts` reaches production through module specifiers only and names no repo-relative path literal, so it needs no `gate-targets.ts` entry and does not collide with `07-02`'s registry work.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `tests/architecture/closed-set-enrollment.test.ts` — present on disk.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — present, carries `_BucketAEventsCoverageProof`.
- `.planning/phases/07-gate-integrity/07-08-SUMMARY.md` — present on disk.
- `a186366f`, `70153616` — both reachable in `git log --oneline --all`.
- `.planning/STATE.md` and `.planning/ROADMAP.md` — untouched; the orchestrator owns those writes.
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` and `shared/concerns/hooks.ts` — no diff; both plants restored.
