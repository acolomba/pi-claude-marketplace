---
phase: 100-disabled-plugin-information-retention
plan: 03
subsystem: output-surface
tags: [typescript, notify, list-orchestrator, output-catalog, byte-fixture, requirements]

requires:
  - phase: 100-disabled-plugin-information-retention
    plan: "01"
    provides: "retention of the record's resources inventory on disable, which is what made the ENBL-15 byte guarantee worth pinning"
  - phase: 95-manifest-absent-installed-inventory
    provides: "the `ManifestLookup` discriminant and the `not in manifest` reason token, both reused unchanged"
provides:
  - "`PluginDisabledMessage.reasons` -- an optional field carrying at most `not in manifest`"
  - "the manifest-absence stamp on the list surface's disabled inventory row, gated on a successfully read manifest"
  - "`disabled-inventory-not-in-manifest` -- a catalog state and its paired byte fixture"
  - "INV-04 recorded as superseded by ENBL-16 in the requirement register, the interface documentation, the catalog prose and the two tests that asserted the bare row"
affects: [disabled-plugin-info-render]

actuals:
  tokens: 11500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "per-surface render maps are the real render path: a shared-renderer arm and the command's own map must both be threaded"
    - "an optional-field composer returned as an object (`Pick<Msg, 'reasons'>`) rather than an array, so the absent case omits the key entirely"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/list-manifest-absent.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The list surface renders its disabled row through its OWN render map in `list.messaging.ts`, not through the central `renderPluginRow` arm. Threading only the shared arm typechecks, passes every architecture gate, and changes nothing the user sees."
  - "The reasons composer was extracted to a named `disabledReasonsField` helper rather than inlined: the inline ternary pushed `installedRowMessage` to cognitive complexity 17 against a budget of 15."
  - "The ENBL-06 contrast-pair test was re-seeded manifest-absent rather than left declared. That is what makes it prove the two reason SOURCES do not merge -- the disabled row names absence alone while the enabled partial beside it keeps `{not in manifest, lsp}`."
  - "ENBL-16 is recorded as IN PROGRESS, not complete: only the `list` half landed here. The `info` half rides with the ENBL-17 reroute."

patterns-established:
  - "Discrimination by fixture read-back: the ENBL-15 test asserts the arrays that actually reached `state.json` alongside the rendered bytes, so a future seeder that silently empties them fails loudly instead of turning the byte assertion vacuous."

requirements-completed: [ENBL-15]

coverage:
  - id: R1
    description: "A disabled record with populated agents and mcpServers renders byte-identically to one with empty arrays -- no soft-dependency marker"
    requirement: ENBL-15
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#ENBL-15 / D-100-06: a disabled record with populated agents and mcpServers renders the same bytes as one with empty arrays"
        status: pass
      - kind: other
        ref: "mutation-checked: restoring the seeder's disabled-empties-resources ternary fails exactly this test and leaves the other 74 green"
        status: pass
    human_judgment: false
  - id: R2
    description: "A manifest-absent disabled record renders `(disabled) {not in manifest}` on the list surface"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#ENBL-16: a manifest-absent disabled record renders `(disabled) {not in manifest}`"
        status: pass
    human_judgment: false
  - id: R3
    description: "A disabled record its manifest still declares renders the bare row, byte-identical to before"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-manifest-absent.test.ts#ENBL-16: a disabled record its manifest STILL declares renders `(disabled)` with no reason brace"
        status: pass
    human_judgment: false
  - id: R4
    description: "A disabled record that is BOTH manifest-absent and partially installed carries the absence reason and no unsupported-kind token; row order is unchanged"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#ENBL-06 / ENBL-16: a manifest-absent disabled PARTIAL renders `(disabled) {not in manifest}` beside an enabled partial's `(partially-installed) {not in manifest, lsp}`"
        status: pass
    human_judgment: false
  - id: R5
    description: "The `/claude:plugin disable` fresh cascade row is unchanged"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts -- 41 tests pass with no expected-byte edit"
        status: pass
      - kind: other
        ref: "`enable-disable.messaging.ts` hard-codes `composeReasons(undefined, ...)` on its own disabled arm, so the omission is structural at that surface"
        status: pass
    human_judgment: false
  - id: R6
    description: "The new row form has a catalog state and a paired byte fixture, landed in one commit"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: other
        ref: "mutation-checked: editing one byte of the new fenced block reports `[BYTE MISMATCH] section=/claude:plugin list state=disabled-inventory-not-in-manifest`"
        status: pass
    human_judgment: false
  - id: R7
    description: "No status token, reason token or glyph was added"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts and tests/architecture/compat-01-no-expansion.test.ts pass unamended"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-08-11
status: complete
---

# Phase 100 Plan 03: The disabled list row names manifest absence Summary

**A disabled plugin whose marketplace manifest no longer declares it now says so on the list row -- `{not in manifest}` and no other reason -- while the row stays byte-identical under any retained inventory, and INV-04 is recorded as superseded in every artifact that asserted it.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-08-11T16:20:00Z
- **Completed:** 2026-08-11T17:30:00Z
- **Tasks:** 3 of 3
- **Files modified:** 8

## Accomplishments

- The list row now names the one fact that blocks the user's next action. `plugin enable` re-runs the install ledger, which resolves from the marketplace manifest, so a disabled manifest-absent record cannot be re-enabled; the bare row gave no warning before the attempt.
- The absence claim is gated where it already was. The stamp reuses `notInManifest`, which is derived from the `ManifestLookup` discriminant and is true only for a manifest that was READ and omitted the record. A manifest the system never parsed backs no claim, and no new gate was introduced to say so.
- ENBL-15's guarantee moved from incidental to stated. The two soft-dependency derivations now sit BELOW the disabled early return, so a disabled record's retained `agents` / `mcpServers` are not even in scope where its row is built, and both soft-dep arguments stay hard-coded `false` in both render arms.
- The new row form shipped with its byte contract. The catalog state and its fixture landed in one commit, and the pairing was mutation-checked in both directions.
- No closed set grew. `{not in manifest}` and `(disabled)` were already members, so `notify-closed-set-locks` and `compat-01-no-expansion` passed unamended.

## Task Commits

1. **Task 1: Make a disabled record with a populated inventory expressible, then pin its bytes** - `367d6ccb` (test)
2. **Task 2: The disabled row carries `{not in manifest}` and nothing else** - `db787cee` (feat)
3. **Task 3: Catalog state, byte fixture and the INV-04 supersession record** - `1b82686a` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - `PluginDisabledMessage` gains `readonly reasons?: readonly ContentReason[]` as its last field; the JSDoc paragraph asserting the absent field made INV-04 structural is replaced by the ENBL-16 rationale, the byte-compatibility argument, and what now keeps ENBL-15 structural. The central `disabled` render arm threads `p.reasons` and keeps both soft-dep arguments `false`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` - the list surface's OWN `disabled` render arm, threaded identically. Without this the field is inert on the only surface that stamps it.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - `disabledReasonsField`, a named composer beside `partiallyInstalledReasons`; the disabled early return spreads it; the two soft-dep derivations moved below that return.
- `tests/orchestrators/plugin/list.test.ts` - the seeder's `disabled` flag now sets `enabled` alone and a per-kind `resources` override was added; the ENBL-15 pinning test with its state.json read-back; the contrast-pair test re-seeded manifest-absent.
- `tests/orchestrators/plugin/list-manifest-absent.test.ts` - the INV-04 test inverted to ENBL-16, its still-declared control added, and the file header's requirement index updated.
- `tests/architecture/catalog-uat.test.ts` - the `disabled-inventory-not-in-manifest` fixture, pure notification data with the file's standard preamble comment.
- `docs/output-catalog.md` - the new catalog state with its prose; the two false clauses in the `disabled-inventory` paragraph rewritten; the disable-command paragraph's stale zeroing sentence corrected.
- `.planning/REQUIREMENTS.md` - INV-04 marked superseded, ENBL-10..19 added to the requirement list and the traceability table, coverage counters and the change log updated.

## Decisions Made

- **The list surface has its own render map, and that is where the row is actually built.** `listPlugins` emits through `notifyWithContext(ctx, pi, LIST_CONTEXT, ...)`, which dispatches per-status through `list.messaging.ts` -- not through `renderPluginRow`'s `case "disabled"`. Threading only the shared arm typechecked, kept every architecture gate green, and produced no visible change. The plan's three-edit model was right in shape and one file short. Four surfaces own a disabled arm (`list`, `info`, `reconcile`, `enable-disable`); only the list one was touched.
- **The reasons composer is a named function.** Inlining the ternary in the disabled branch pushed `installedRowMessage` to cognitive complexity 17 against the repo's budget of 15. `disabledReasonsField` sits beside `partiallyInstalledReasons` -- the same file's existing "one composer per row form" shape -- and carries the rationale the branch would otherwise have had to.
- **The contrast-pair test was re-seeded manifest-absent.** Left declared, it would have proved only that the bytes did not move. Re-seeded, one join proves the two reason SOURCES do not merge: the disabled row names absence alone, the enabled partial beside it keeps `{not in manifest, lsp}`, and the row order is unchanged.
- **ENBL-16 is recorded as in progress.** Its `info` half is D-100-08's reroute and belongs to a later plan, so marking the requirement complete here would have been a false claim in the register.

## Deliberate omissions

- **The fresh-disable transition site in `enable-disable.ts` stamps no reasons.** This is the plan's specified non-edit, and it is stronger than a convention: `enable-disable.messaging.ts` renders that row through its own arm, which hard-codes `composeReasons(undefined, false, false, probe)`. The transition row cannot carry a reason even if a future caller stamped one. Its 41 tests passed with no expected-byte edit.
- **The `info` surface was not touched.** D-100-07 covers both surfaces, but `info.messaging.ts`'s disabled arm belongs to the ENBL-17 reroute.
- **No `enabled` guard was added to the soft-dep derivations.** As the plan established, it would be dead code: the values are type-incapable of reaching a disabled row. They were moved below the early return instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The `resources` override the plan assumed did not exist in this seeder**

- **Found during:** Task 1
- **Issue:** The plan directed the executor to drop the disabled ternary and "let the existing `resources` override supply the inventory". That override exists in `seedPathMarketplace` (`info-manifest-absent.test.ts`), not in `seedMarketplace` (`list.test.ts`). Without it the disabled-plus-populated fixture stays unexpressible, which is the whole prerequisite the task exists to remove.
- **Fix:** Added a per-kind `resources?` override to the seeder's installed-entry type, matching the sibling seeder's declared field set verbatim, and rebuilt the arrays from `override ?? defaults`.
- **Files modified:** `tests/orchestrators/plugin/list.test.ts`
- **Verification:** Mutation-checked -- with the retired ternary restored the new ENBL-15 test fails and the other 74 pass.
- **Committed in:** `367d6ccb`

**2. [Rule 1 - Bug] The reason never rendered: the list surface has its own render map**

- **Found during:** Task 2
- **Issue:** After the three planned edits, `npm run typecheck` and every gate passed and the inverted tests still failed with the bare row. `listPlugins` renders through `LIST_CONTEXT`'s per-status map in `list.messaging.ts`, whose `disabled` arm hard-codes `composeReasons(undefined, ...)`. The central `renderPluginRow` arm the plan named is not on the list path.
- **Fix:** Threaded `p.reasons` in the list surface's arm too, with the same both-flags-false comment. The other three disabled arms (`info`, `reconcile`, `enable-disable`) were left alone deliberately.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` (not in the plan's `files_modified`)
- **Verification:** The two inverted tests go green; the enable-disable suite passes unedited, which is the proof the other surfaces did not move.
- **Committed in:** `db787cee`

**3. [Rule 3 - Blocking] Cognitive complexity budget**

- **Found during:** Task 2
- **Issue:** The inline `notInManifest ? { reasons: [...] } : {}` in the disabled branch pushed `installedRowMessage` from 15 to 17 on `sonarjs/cognitive-complexity`, failing `npm run lint` and therefore `npm run check` (NFR-6).
- **Fix:** Extracted `disabledReasonsField` as a named module-level composer beside `partiallyInstalledReasons`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
- **Verification:** `npx eslint` clean on all five changed files.
- **Committed in:** `db787cee`

**4. [Rule 1 - Bug] The catalog still described disable as zeroing the record**

- **Found during:** Task 3
- **Issue:** `docs/output-catalog.md`'s `/claude:plugin disable` paragraph states "Every `resources.*` array resets to `[]`". Plan 100-01 reversed that behavior; the sentence is now a documented falsehood in the file this task edits, and it contradicts the retention the whole phase exists to deliver.
- **Fix:** Rewrote the clause to state preservation, citing ENBL-18 / D-100-10. One sentence; the rest of the paragraph is untouched.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** `node --test tests/architecture/catalog-uat.test.ts` green -- the paragraph is prose, not a fenced block, so no fixture pairs with it.
- **Committed in:** `1b82686a`

---

**Total deviations:** 4 auto-fixed (2 x Rule 1, 2 x Rule 3)
**Impact on plan:** No scope creep. Deviations 1 and 2 are corrections to the plan's model of where the code lives; without either, the plan's own acceptance criteria could not have been met. Deviation 3 is a lint budget. Deviation 4 is a one-sentence doc correction in a file the task already owns.

## Issues Encountered

- **A green typecheck and green gates said nothing about the feature working.** The `reasons` field, the stamp and the shared render arm were all consistent and all inert, because the list surface reads a different map. The byte-equality tests were the only thing that caught it -- which is the argument for writing them first.
- **`tests/docs/` does not exist.** The plan's `node --test tests/docs/` verification line names a directory that is not in the repository; the markdown-facing gate is `tests/architecture/catalog-uat.test.ts` plus the `mdformat` / `markdownlint` pre-commit hooks, all of which pass.
- **`node --test` does not accept bare directories on this Node build**, as 100-02 also recorded; the glob form is required.

## Verification

- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npm run format:check` -- exit 0
- `npm test` -- 3433 tests, 3432 pass, 0 fail, 1 skipped
- `npm run test:integration` -- 16 pass, 2 fail (`provenance-invisibility`, `skill-path-resolution`; both resolve `pi-subagents` from a stale global npm root and reproduce on unmodified `main` -- environment, not this branch)
- `node --test 'tests/orchestrators/**/*.test.ts'` -- 1166 pass, 0 fail
- `node --test 'tests/architecture/**/*.test.ts' 'tests/shared/**/*.test.ts'` -- 686 pass, 0 fail
- `pre-commit run --files docs/output-catalog.md .planning/REQUIREMENTS.md` -- mdformat and markdownlint pass (trufflehog fails structurally in a worktree; a filesystem scan of every committed path reported 0 verified and 0 unverified secrets)
- Acceptance greps: `catalog-state: disabled-inventory-not-in-manifest` appears once in `docs/output-catalog.md`, and `disabled-inventory-not-in-manifest` once in `tests/architecture/catalog-uat.test.ts` -- both in commit `1b82686a`.

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-100-09 (Spoofing: an absence claim about an unread manifest) | mitigated | The stamp reuses `notInManifest`, which is `lookup.kind === "absent"` and is produced only by `manifestLookupFor` after a successful read; a failed read yields `unverified`. The ENBL-16 still-declared control asserts the negative directly, and the BOUND-01 / BOUND-03 cases in the same suites are unchanged and green. |
| T-100-10 (Information disclosure: unrelated reasons leak onto the widened row) | mitigated | The orchestrator stamps at most the single absence member, and both soft-dep arguments stay hard-coded `false` in both render arms. Asserted by the ENBL-15 byte pin (which probes BOTH companions as unloaded, the condition under which a leak would show) and by the contrast-pair test's row-scoped `lsp` negatives. |
| T-100-11 (Tampering: a catalog state landing without its fixture) | mitigated | Both parts are in commit `1b82686a`. The catalog walker asserts byte equality in one direction and the inverse walk rejects an orphan fixture in the other; the pairing was mutation-checked. |
| T-100-SC (Supply chain) | accepted | No package installed, no `package.json` entry added. |

## Known Stubs

None.

## Carriers into the rest of the phase

- **The `info` half of ENBL-16 is open.** `info.messaging.ts`'s disabled arm still hard-codes `composeReasons(undefined, ...)`, and `info.ts`'s disabled path stamps nothing. Both need the same two-edit treatment when D-100-08's reroute lands. The requirement register records ENBL-16 as in progress for exactly this reason.
- **`docs/output-catalog.md:1688`'s info-surface disabled paragraph still cross-references the list section's `disabled-inventory` state for its byte form.** That cross-reference is what the ENBL-17 reroute retires; it was left in place because the info row has not moved yet.
- **Two seeders still hard-code empty resources on their `disabled` branch** -- `seedRealDisabledMarketplace` (`enable-disable.test.ts`) and `seedPathMarketplace` (`info-manifest-absent.test.ts`), plus the private seeder in `list-manifest-absent.test.ts`. `list.test.ts`'s is now fixed. Each also carries a JSDoc paragraph narrating emptiness as the disabled marker, which ENBL-05 retired. The minimal edit in every case is the same: drop the ternary so `disabled` controls only `enabled`.

## Self-Check: PASSED

All 8 modified files exist on disk; all three task commits resolve in `git log`.
