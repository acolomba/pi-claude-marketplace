---
phase: 100-disabled-plugin-information-retention
plan: 05
subsystem: output-surface
tags: [typescript, notify, info-orchestrator, output-catalog, byte-fixture, requirements]

requires:
  - phase: 100-disabled-plugin-information-retention
    plan: "03"
    provides: "the `list` half of ENBL-16 and the catalog rule this plan makes the `info` surface obey"
  - phase: 100-disabled-plugin-information-retention
    plan: "04"
    provides: "the reroute this plan documents, covers and corrects; the seeder Task 1 asked for was already dropped there"
provides:
  - "`applyDisabledRowShape` -- the disabled row's status injection AND its reason narrowing, one helper at the command"
  - "`state-only-disabled-with-components` -- a catalog state and its paired byte fixture"
  - "info-surface coverage for the rerouted disabled arm: recorded hooks, the still-declared control, and the zero-network proof"
  - "three catalog prose corrections plus the notification-count claim the reroute changed"
affects: []

actuals:
  tokens: 8600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "one command-level helper owns a row FORM (status plus admissible reasons), so two surfaces cannot answer one record differently"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The suppression extends the existing status-injection helper rather than adding a second one. Status and admissible reasons are one rule about one row form; two helpers at the same two call sites could be threaded apart. `applyDisabledStatus` became `applyDisabledRowShape` because the old name would have described half of what it does."
  - "The narrowing is a filter against one allowed member, not a subtraction of the known offenders. `reasons.filter(r => r === DISABLED_ROW_REASON)` closes over every reason the arm can ever produce, including the hooks-read markers; a `filter(r => r !== 'lsp')` would have admitted the next reason someone adds."
  - "The new catalog state carries NO description line. The plan and its must_haves call for one, but `buildStateOnlyInstalledRow` reconstructs no description by design -- the manifest is its only source. A fixture with a description would have been a falsified example in the file whose prose is otherwise unguarded (T-100-15)."
  - "The still-declared disabled control was added to `info-manifest-absent.test.ts` even though `info.test.ts` has a sibling. This file's disabled set otherwise proves nothing about WHERE the absence reason comes from; the boundary pin is what rules out a stamp hard-coded on the disabled arm."

patterns-established:
  - "A cross-surface agreement claim is testable as one sentence in the catalog plus one record rendered through both surfaces; the divergence here was found by reading the catalog against the code, not by a failing test."

requirements-completed: []

coverage:
  - id: R1
    description: "A disabled record with a dropped component kind renders `(disabled) {not in manifest}` on info -- the same bytes list renders for the same record"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-08 / ENBL-16 / ENBL-17: a manifest-absent DISABLED PARTIAL keeps `(disabled)` and hides its unsupported-kind token"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-06 / D-96-04: `info --fetch` on a DISABLED PARTIAL skips for the disabled cause, not the manifest-absence cause"
        status: pass
      - kind: other
        ref: "mutation-checked: with the reason filter removed both tests fail on the persisted `lsp` token and the other 33 stay green"
        status: pass
    human_judgment: false
  - id: R2
    description: "A disabled, manifest-absent record lists the hooks its RECORD holds, with no materialized configuration on disk to read"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-16 / ENBL-17: a disabled, manifest-absent record lists its recorded hooks and its whole retained inventory"
        status: pass
    human_judgment: false
  - id: R3
    description: "The absence reason is derived from the manifest lookup, not from disabled-ness: a DECLARED disabled record carries no reason brace"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-16 / ENBL-17: a DECLARED disabled record renders `(disabled)` with no reason brace"
        status: pass
    human_judgment: false
  - id: R4
    description: "The rerouted disabled arm makes zero clone-seam and zero credential-seam calls under `--fetch`, and still renders its full inventory"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-17 / NFR-5: a DISABLED manifest-absent record under `--fetch` makes ZERO seam calls"
        status: pass
    human_judgment: false
  - id: R5
    description: "A fetch over a marketplace whose only found scope is disabled still emits the skip note"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04 / ENBL-17: `info --fetch` on a disabled AND manifest-absent scope emits ONE skip row, reporting the disabled cause"
        status: pass
    human_judgment: false
  - id: R6
    description: "The disabled info row has its own catalog state and a paired byte fixture, landed in one commit"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: other
        ref: "mutation-checked: editing one byte of the new fenced block reports `[BYTE MISMATCH] section=/claude:plugin info <plugin>@<marketplace> state=state-only-disabled-with-components`"
        status: pass
    human_judgment: false
  - id: R7
    description: "Manual UAT: install, disable, drop the manifest entry, reload, then `plugin info` -- description, inventory, `(disabled)` and the absence reason, with hooks not firing"
    requirement: ENBL-17
    verification:
      - kind: manual
        ref: "spans the Pi extension host; recorded manual-only in the phase validation strategy"
        status: pending
    human_judgment: true

duration: 50min
completed: 2026-08-11
status: complete
---

# Phase 100 Plan 05: The disabled info row gets a byte contract and one answer Summary

**`info` and `list` now render one disabled record identically -- `{not in manifest}` and nothing else on either surface -- and the info row's new form ships as its own catalog state with a paired byte fixture instead of a cross-reference to the list row it no longer resembles.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-08-11T18:20:00Z
- **Completed:** 2026-08-11T19:10:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5

## Accomplishments

- **The two surfaces stopped disagreeing.** A disabled record carrying `unsupported: ["lspServers"]` rendered `{not in manifest, lsp}` on `info` and `{not in manifest}` on `list`. One record, two answers. `info` now narrows to the same single reason, and the narrowing is mutation-checked in both of the two tests that see such a record.
- **The narrowing lives at the command.** `applyDisabledStatus` became `applyDisabledRowShape` and now owns the whole row form: the status injection it already did, plus a filter that admits one reason member. `notify.ts` probes nothing and renders what it is given.
- **The disabled info row has a byte contract.** `state-only-disabled-with-components` and its fixture landed in one commit, mutation-checked in both directions. The row it pins is the one the phase exists to produce: a `(disabled)` record reporting its retained skills and the hooks its own record holds.
- **The record is proven to be the hook source.** The central fixture writes NO materialized hooks configuration, which is the disk state a disable actually leaves behind. The rendered `hooks:` block can only have come from `hookEntries`; a reader that fell back to the file would render no block at all.
- **The zero-network claim became an assertion for the disabled arm too.** Before the reroute the arm returned before any fetch-capable builder existed, so "no network here" was a property of the control flow. A remote-shaped disabled record under `--fetch` now pins all five counters on the injected clone-cache and credential seams at zero, and asserts the full inventory beside them -- a guard that reached zero by returning an empty block would satisfy the counters alone.
- **The catalog stopped describing behavior the code does not have.** Five corrections: the retired cross-reference, the retired cascade-path claim, the scope-disjointness assumption under the single skip-reason carrier, the "disabled inventory row is a second notification" claim, and the all-disabled early return that no longer exists.

## Task Commits

1. **Operator-mandated correction: hide the unsupported-kind tokens on the disabled info row** - `a31de6c6` (fix)
2. **Task 2: Coverage for the rerouted disabled arm** - `74c7679d` (test)
3. **Task 3: The catalog state, its byte fixture, and the prose corrections** - `71d14b75` (docs)

Task 1 produced no commit — see Deviations.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - `DISABLED_ROW_REASON` added as the single allowed member; `applyDisabledStatus` renamed to `applyDisabledRowShape` and extended to filter the reason brace, with the governing rule and the `list.ts` cross-reference in its doc; both call sites and the `getPluginInfo` comment updated.
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` - three new cases (recorded hooks on a disabled record, the DECLARED disabled control, the disabled zero-network fetch); the two disabled-PARTIAL fixtures re-pinned to the single reason with a row-scoped negative; the file header's retired disabled-carve-out claim replaced.
- `tests/architecture/catalog-uat.test.ts` - the `state-only-disabled-with-components` fixture, pure notification data with the preamble comment recording why no fixture can show a suppressed token; the section's state index extended.
- `docs/output-catalog.md` - the new state with its prose; the info-surface disabled paragraph rewritten; the mixed fetch-skip paragraph amended for the one-scope-both-causes case; the state-only fetch-skip paragraph's notification-count claim corrected; the disabled fetch-skip paragraph's early-return clause corrected; the severity-routing list extended.
- `.planning/REQUIREMENTS.md` - the ENBL-16 entry's closing clause reversed: the "no other reason" rule binds BOTH surfaces, and the entry names the helper on each.

## Decisions Made

- **The suppression extends one helper instead of adding a second.** Status and admissible reasons are one rule about one row form, applied at the same two arms of `buildBlock`. Two helpers would be two things a future arm could thread apart; one cannot be half-applied. The rename was forced by that: `applyDisabledStatus` would have named half the job.
- **The filter is an allow-list, not a deny-list.** `filter(reason => reason === DISABLED_ROW_REASON)` closes over every reason the state-only arm can produce today (the absence token, the unsupported-kind tokens, the four hooks-read markers) and every one it produces tomorrow. Subtracting the two known offenders would have admitted the next one silently.
- **The new catalog state carries no description line.** The plan's must_haves and its Task 3 instructions both call for one. `buildStateOnlyInstalledRow` reconstructs no description — the manifest is the only source and this arm has no manifest entry. The paragraph says so explicitly, and points at the sibling state that already records the same limit. Writing one in would have been a falsified example in a file whose prose the byte gate does not cover, which is the exact failure T-100-15 names.
- **The DECLARED disabled control belongs in this file, not only in `info.test.ts`.** Every other disabled case here is manifest-absent, so the suite cannot tell a reason derived from the manifest lookup from one hard-coded on the disabled arm. The control is the boundary pin — and after the correction it also proves a declared disabled row's brace stays empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 was already complete; it produced no commit**

- **Found during:** Task 1
- **Issue:** The task directs the executor to drop the seeder's disabled-empties-resources ternary, add a hook-entries field to the override and rewrite the JSDoc. All three were already on the branch: 100-04 dropped the ternary and rewrote the JSDoc as its own deviation 1, and 100-02 added `hookEntries` to the seeded record. Re-doing the work would have meant reverting and re-applying it.
- **Fix:** Verified each acceptance criterion against the file and the suite, then proceeded. The seeder selects `resources` from `override ?? defaults` with no reference to the disabled flag; `hookEntries` is a sibling key on the same installed-entry type; the JSDoc states that the flag controls `enabled` alone, citing ENBL-05 and ENBL-18.
- **Files modified:** none
- **Verification:** `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` — 35 pass before any edit of mine.
- **Committed in:** n/a

**2. [Rule 1 - Bug] The two `list` / `info` disabled rows disagreed for one input (OPERATOR-MANDATED)**

- **Found during:** before Task 2, as the correction this plan carries
- **Issue:** A disabled record with a persisted unsupported kind rendered `(disabled) {not in manifest, lsp}` on `info` and `(disabled) {not in manifest}` on `list`. `docs/output-catalog.md` already stated the rule the code broke, in text written one plan earlier: `:338` "the row carries at most ONE reason ... every other reason stays off a disabled row", and `:365` "a disabled record whose install-time resolution dropped a component kind keeps its unsupported-kind tokens hidden". 100-04 had recorded the divergence as deliberate and scoped the register's "no other reason" clause to the list row.
- **Fix:** The reason narrowing in `applyDisabledRowShape`, at the command. The catalog text was left INTACT — it was the code that was wrong. The ENBL-16 register entry was reconciled to say the clause binds both surfaces and to name the helper on each.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `tests/orchestrators/plugin/info-manifest-absent.test.ts`, `.planning/REQUIREMENTS.md`
- **Verification:** Mutation-checked — with the filter reverted to `row.reasons ?? []`, exactly the two tests that see a disabled record with a dropped kind fail and the other 33 pass. The tests pin the suppression, not the equality.
- **Committed in:** `a31de6c6`

**3. [Rule 1 - Bug] The test file header still claimed a disabled carve-out runs before the state-only arm**

- **Found during:** Task 2
- **Issue:** The requirement index at the top of `info-manifest-absent.test.ts` reads "D-54-01 / ENBL-04 the disabled carve-out still runs BEFORE the state-only arm". The reroute deleted the carve-out; a disabled record now travels the state-only arm itself. A reader trusting the header would look for a branch that does not exist.
- **Fix:** Replaced with the ENBL-16 / ENBL-17 entry describing what the file actually pins.
- **Files modified:** `tests/orchestrators/plugin/info-manifest-absent.test.ts`
- **Verification:** the three disabled cases the entry describes are in the file and green.
- **Committed in:** `74c7679d`

**4. [Rule 1 - Bug] Two more false catalog sentences beside the three the plan names**

- **Found during:** Task 3
- **Issue:** The `state-only-fetch-skipped` paragraph reads "The disabled inventory row above breaks IL-2 in the same manner and for the same reason" — the disabled row is no longer a separate notification, which is the notification-count change 100-04 carried forward. The `disabled-fetch-skipped` paragraph reads "the command returns before any probe runs", describing the all-disabled early return the reroute deleted.
- **Fix:** The first now says the disabled row renders inside the info block and that a mixed run emits two notifications and not three. The second says no probe runs at all, which is the surviving fact.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** `node --test tests/architecture/catalog-uat.test.ts` green; both are prose, so no fixture pairs with them.
- **Committed in:** `71d14b75`

---

**Total deviations:** 4 auto-fixed (3 x Rule 1, 1 x Rule 3)
**Impact on plan:** No scope creep. Deviation 1 is a task the branch had already completed; 2 is the operator's ruling, which the catalog already stated; 3 and 4 are false sentences in files these tasks own.

## Deliberate omissions

- **The `state-only-disabled-with-components` fixture shows no description line and no dependencies line.** Neither is reachable on this arm. See Decisions.
- **No fixture shows a suppressed unsupported-kind token.** After the correction no such row can be produced, so a fixture claiming one would be unreachable. The prose and the fixture's preamble comment record the suppression instead; the two orchestrator tests are what pin it.
- **The severity-routing paragraph enumerates the info surface's success states BY NAME**, so the new state was added to the list. The plan asked for this disposition to be recorded: it is a named list, not a described class.

## Issues Encountered

- **`tests/docs/` still does not exist.** Task 3's second `<automated>` verify names a directory that is not in the repository, as 100-03 also recorded. The markdown-facing gates are `tests/architecture/catalog-uat.test.ts` plus the `mdformat` / `markdownlint` pre-commit hooks; all pass.
- **The plan's estimate assumed three tasks of fresh work.** Two of them were substantially landed by 100-04, so the realized diff is roughly an eighth of the estimate. The correction, which the plan does not mention at all, was the larger half of the work.

## Verification

- `npm run check` — typecheck, lint and format:check exit 0; `npm test` 3436 tests, 3435 pass, 0 fail, 1 skipped (three more than 100-04's 3433: this plan's three new cases)
- `npm run test:integration` — 16 pass, 2 fail (`provenance-invisibility`, `skill-path-resolution`; both resolve `pi-subagents` from a stale global npm root and reproduce on unmodified `main` — environment, not this branch)
- `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` — 38 pass, 0 fail
- `node --test tests/orchestrators/plugin/info.test.ts` — 67 pass, 0 fail, unedited
- `node --test tests/architecture/catalog-uat.test.ts` — 6 pass, 0 fail
- Mutation check (correction): filter reverted → 2 fail / 33 pass, both failures on the persisted `lsp` token
- Mutation check (catalog pair): one byte edited in the new fence → `[BYTE MISMATCH] ... state=state-only-disabled-with-components`
- Acceptance greps: `catalog-state: state-only-disabled-with-components` appears once in `docs/output-catalog.md`; `state-only-disabled-with-components` appears twice in `tests/architecture/catalog-uat.test.ts` (the index entry and the fixture key) — both in commit `71d14b75`
- `pre-commit run --files <each changed path>` — all hooks pass except the structurally-broken worktree `trufflehog`; a filesystem scan of every committed path reported 0 verified and 0 unverified secrets

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-100-11 (Tampering: a catalog state landing without its fixture) | mitigated | Both parts are in commit `71d14b75`. The walker asserts byte equality in one direction and rejects an orphan fixture in the other; the pairing was mutation-checked. |
| T-100-15 (Repudiation: unguarded catalog prose) | mitigated | The three sentences the plan named were rewritten, and two more false ones were found and rewritten beside them. The one place the plan's own instructions would have produced a falsified example — a description line on a state that cannot emit one — was declined and the reason recorded. |
| T-100-13 (Information disclosure: `info --fetch` on the rerouted disabled arm) | mitigated | Authored as an explicit case: a remote-shaped DISABLED record under `--fetch`, five counters on the injected clone-cache and credential seams pinned at zero, with the full inventory asserted beside them so an empty-block guard cannot pass. |
| T-100-02 (Spoofing: fixture purity) | mitigated | The new fixture is a hand-authored `NotificationMessage` literal; it calls no domain helper and reads no record. |
| T-100-SC (Supply chain) | accepted | No package installed, no `package.json` entry added. |

## Known Stubs

None.

## Carriers out of this phase

- **The manual UAT is outstanding** (R7): install a plugin, disable it, remove its entry from the marketplace manifest, reload, then run `plugin info`. Expect the component inventory, the `(disabled)` token and `{not in manifest}` — and confirm the plugin's hooks do not fire. It spans the Pi extension host, which no automated suite exercises.
- **Three seeders still hard-code empty resources on their `disabled` branch** — `seedRealDisabledMarketplace` (`enable-disable.test.ts`), the private seeder in `list-manifest-absent.test.ts`, and `seedPathMarketplace` in `info.test.ts`. All three still narrate emptiness as the disabled marker in their JSDoc, which ENBL-05 retired. Harmless today; each is one ternary.
- **`applyDisabledRowShape` and `list.ts::disabledReasonsField` are two implementations of one rule.** They agree today and two tests would catch a divergence, but nothing structural holds them together. A third surface that renders a disabled row would have to remember the rule a third time.

## Self-Check: PASSED

All 5 modified files exist on disk; all three task commits (`a31de6c6`, `74c7679d`, `71d14b75`) resolve in `git log`.
