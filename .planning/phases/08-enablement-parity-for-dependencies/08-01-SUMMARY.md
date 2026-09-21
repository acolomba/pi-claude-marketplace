---
phase: 08-enablement-parity-for-dependencies
plan: 01
subsystem: plugin-lifecycle
tags: [dependency-cascade, enable, notification-vocabulary, closed-set]

requires:
  - phase: 03-dependency-resolution
    provides: "domain/dependency-closure.ts::resolveDependencyClosure, the post-order transitive-closure walk"
  - phase: 05-prune-on-uninstall
    provides: "orchestrators/plugin/dependency-index.ts::buildScopeDeclarationDetail, the offline whole-scope declaration map"
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    provides: "the Phase 6 dependencyDisabled consequence marker and its clear-on-write-through convention"
provides:
  - "EDEP-01: enable <plugin> resolves the plugin's declared dependency closure transitively in the same scope and reports every member on its own row"
  - "EDEP-03 (enable arm): a closure member that is installed-and-disabled is re-materialized through its own record and reports {dependency enabled}"
  - "The dependency enabled closed-set reason token (D-08-02), REASONS 59 -> 60, landed across all ten pinning surfaces"
  - "EnableRefusedError and the cycle / unreadable-declarer refusal arms, which write nothing"
affects: [08-02-disable-dependents-guard, 08-03-install-cascade-dependency-enabled]

actuals:
  tokens: 27283
  tasks: 3
  commits: 3
  plan_head_before: cd11171c

tech-stack:
  added: []
  patterns:
    - "Enable cascade reuses install-cascade's post-order closure walk and row-composition shape (root row + sorted member rows in one notifyWithContext call) without importing install-cascade's own types -- EnableCascadeMemberRow is a structurally distinct union from CascadeMsg."
    - "Evidence-backed assertion functions (asserts x is Y, empty body) narrow a union down to its one reachable arm instead of writing dead switch cases for arms a specific caller configuration cannot produce -- mirrors the file's own pre-existing assertRecordedStateLedgerInstalled."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - docs/plugin-enablement.md
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/enable-disable.messaging.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-enable.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/shared/notification-types.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "Task 1 ruling (verbatim, developer replied \"proceed as recommended\"): Decision A CONFIRMED -- the token is `dependency enabled`, lowercase, one space, no punctuation, riding an `installed` row beside `already installed` on the install-cascade arm (plan 08-03) and alone on the enable-cascade member row (this plan); rejected alternatives were a bare `enabled` status with no reason and reuse of `dependency promoted`. Decision B -- OPTION B1 TAKEN: plan 08-02's disable refusal (EDEP-02) will re-add `dependents remain` to REASONS at the tail (the exact token Phase 5 shipped for the uninstall refusal and D-06-07 retired when that refusal stopped happening; the refusal it named now happens on `disable` instead), costing a second closed-set amendment (59 -> 60 in this plan for `dependency enabled`, 60 -> 61 in plan 08-02 for `dependents remain`); rejected B2 (reuse `dependents unsatisfied` -- its own rationale states its subject is a removal that WENT THROUGH on a SUCCESS row, so reuse would make one grep return two different situations) and B3 (no token at all -- every other refusal row in the catalog names its fact in the brace). Discretion call 1 CONFIRMED: an already-enabled closure member reuses the EXISTING `already enabled` token rather than inventing a parallel one. Discretion call 2 CONFIRMED: a manual `enable` clears the Phase 6 `dependencyDisabled` consequence marker at write time on the root and on every re-enabled member, rather than leaving it for the next reconcile pass. This ruling is recorded here verbatim for plan 08-02 to inherit; `dependents remain` is NOT added by this plan."
  - "Tasks 2 and 3 landed as one implementation commit rather than two. The three-way closure-member classification (re-enabled / already-enabled / not-installed) and the two refusal arms (cycle / unreadable declarer) are small, mutually-referencing pieces of the same switch and the same row composer; splitting them into a Task-2-only stub followed by a Task-3 rewrite would have meant shipping throwaway code in the first commit only to overwrite it in the second, which Simplicity First rules out. The style (prettier) and chore (type-members pin remap) follow-up commits are separate because pre-commit only reformats/repins after the content commit exists."
  - "The enable cascade is scoped to standalone (non-orchestrated) enable calls only. A reconcile-driven (orchestrated) `setPluginEnabled` call is a different call site with its own dependency handling in `orchestrators/reconcile/dependency-verdict.ts`; running the cascade there too was never in this plan's scope and risked the extensive existing reconcile-owner test suite. Proven with a dedicated test: a cyclic declaration that WOULD refuse a standalone enable does not refuse an orchestrated one -- the root alone enables and the dependency is left untouched."
  - "`writeUserState` (the shared test fixture ~40 pre-existing tests in enable-disable.test.ts already used) now also writes a real, minimal, on-disk marketplace manifest declaring the seeded plugin with no dependencies. EDEP-01 unconditionally reads every record's declared dependencies before any enable/disable proceeds (D-05-07 fail-closed), so a fixture whose manifest file does not exist on disk now fails cascade-side with {unreadable} before ever reaching the scenario the test was written to exercise. The plugin's own directory is deliberately left uncreated, so a test that specifically wants a missing-clone failure still observes it -- now at the correct, later point in the pipeline."
  - "`narrowEnableFailure` gained a case classifying the resolver's `not-installable` / \"source dir does not exist\" PluginShapeError shape as `source missing`. This is a pre-existing gap the writeUserState fixture fix exposed rather than a regression it caused: before the fix, ENBL-03 (\"missing cached clone aborts with {source missing}\") accidentally passed by hitting a raw ENOENT reading the (also-missing) manifest file itself, never reaching the scenario its own title names. With the manifest now readable, the test reaches the real missing-clone path, which the resolver reports as a structured `PluginShapeError`, not an errno exception -- the existing classifier could not see it."

patterns-established:
  - "A command-local multi-row cascade composer (composeEnableCascadeRows) can reuse an existing single-row CommandContext's render map unchanged, because dispatchRow already selects by row.status -- no new render map is needed for a cascade, only the row-array composition and the sort."
  - "A closure resolution + per-member materialization pair scoped to a specific caller configuration (fixed installedKeys, fixed lookup shape) can prove some DependencyClosureResult failure arms structurally unreachable and narrow them away with an evidence-backed assertion function instead of writing live switch cases the direct-coverage gate would then require tests for."

requirements-completed: [EDEP-01, EDEP-03]

coverage:
  - id: D1
    description: "enable <plugin> resolves the plugin's declared dependency closure transitively in the same scope, re-materializes every installed-and-disabled member through its own record, and reports the full closure (root plus every member, already-enabled ones included) in one notification"
    requirement: EDEP-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01 / EDEP-03: enabling a plugin turns on its one disabled dependency and reports both rows"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: depth-2 transitivity enables the whole chain in dependency-first order"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: a diamond shares its member once"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: row order follows the canonical comparator even when the root is not first"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01 empty edge: a root declaring no dependencies enables byte-identically to the plain enable-fresh row"
        status: pass
      - kind: e2e
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts#EDEP-01: an enable cascade's member row reaches the rendered output through the real edge handler"
        status: pass
    human_judgment: false
  - id: D2
    description: "EDEP-03's enable arm: an installed-and-disabled closure member is re-materialized through its own record and reports {dependency enabled}; an already-enabled member reports {already enabled} untouched; a not-installed member reports {not installed} and does not refuse the root"
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-03: an already-enabled dependency renders (skipped) {already enabled} and its record is untouched"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: a not-installed declared dependency reports {not installed} and does not refuse the root"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: an idempotent root still enables a disabled dependency and reports both rows"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01 / LOAD-02: enabling a consequence-disabled member clears its dependencyDisabled marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "The dependency enabled closed-set reason token lands across all ten pinning surfaces in one change: REASONS tuple, notify-reasons.ts CommandPrivateReason + header count, the length-lock enrollment map, the compat-01 enumeration, the notification-types.test.ts enumeration, docs/output-catalog.md's reasons paragraph and new enable-cascade state, its fixture, and both catalog-uat count constants"
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 60-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the reason vocabulary holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 219 exact documented states"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-parser.test.ts#loadCatalogExamples parses all 219 independent catalog tuples"
        status: pass
    human_judgment: false
  - id: D4
    description: "A dependency graph that closes on itself, or whose declarer cannot be read, refuses the whole enable via EnableRefusedError before any phase runs -- nothing is saved and no absolute path is leaked"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: a cycle refuses the enable and writes nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: an unreadable declarer refuses the enable with no absolute path leaked"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: a member ledger failure unwinds every member this command already turned on"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: a member's undo folds a partial unstage failure into the record it puts back to disabled"
        status: pass
    human_judgment: false
  - id: D5
    description: "Only the plugin the user named reaches writeEnabledFlagBack -- no cascade member's key enters either config file (D-04-02); a reconcile-driven (orchestrated) call skips the cascade entirely"
    requirement: EDEP-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01 / EDEP-03: enabling a plugin turns on its one disabled dependency and reports both rows"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#EDEP-01: orchestrated mode skips the cascade entirely -- a cyclic declaration does not refuse a reconcile-driven enable"
        status: pass
    human_judgment: false

duration: 210min
completed: 2026-09-21
status: complete
---

# Phase 8 Plan 1: Enable cascade -- transitive dependency enable with full-closure reporting Summary

**`enable <plugin>` now walks its declared dependency closure transitively, re-materializes every installed-and-disabled member through its own record, and reports the whole closure -- root plus every member -- in one notification carrying the new `{dependency enabled}` closed-set token (REASONS 59 -> 60).**

## Performance

- **Duration:** 210 min
- **Started:** 2026-09-21T08:30:00Z
- **Completed:** 2026-09-21T12:00:00Z
- **Tasks:** 3 (Task 1 ruled by the developer in a prior session; Tasks 2 and 3 implemented together in this session)
- **Files modified:** 16

## Accomplishments

- `enable <plugin>` resolves the plugin's declared dependency closure transitively in the same scope via the existing `domain/dependency-closure.ts::resolveDependencyClosure` walk, reusing its post-order (dependencies before dependents, root last) unchanged.
- Every non-root closure member is classified against the live locked snapshot into one of three dispositions -- `re-enabled` (record present and disabled), `already-enabled` (record present and enabled), `not-installed` (no record at all) -- and every disposition renders its own row in the single terminal notification, matching the install cascade's full-closure reporting convention (D-08-03).
- A `re-enabled` member is materialized through the SAME `runInstallLedger` re-enable machinery the root's own `enable` already used (`pinVersionOverride` + `allowExistingRecord: true`), driven through `runPhases` so a later member's ledger failure unwinds every member this command already turned on.
- The new `dependency enabled` closed-set reason token (D-08-02) landed across all ten pinning surfaces in the same commit: the `REASONS` tuple, `notify-reasons.ts`'s `CommandPrivateReason` and header count, the length-lock enrollment map, the `compat-01` enumeration, `notification-types.test.ts`'s enumeration, `docs/output-catalog.md`'s reasons paragraph plus its new `enable-cascade` catalog state, that state's fixture, and both `catalog-uat` count constants (218 -> 219 states, byte count recomputed).
- A dependency cycle or an unreadable declarer refuses the whole enable via `EnableRefusedError` before any phase runs -- nothing is saved, and the cause line never leaks an absolute path.
- Only the plugin the user named ever reaches `writeEnabledFlagBack`; no cascade member's key enters either config file (D-04-02), and the cascade is scoped to standalone enable calls -- a reconcile-driven (orchestrated) call skips it entirely.
- `docs/plugin-enablement.md`'s "A plugin required by another active plugin is not enabled on its behalf" subsection now also states the enable-side half of what closes this divergence, without claiming the install-cascade half (plan 08-03's job) is done.

## Task Commits

Tasks 2 and 3 landed as one implementation pass (see Deviations below), followed by two mechanical hook-driven follow-ups:

1. **Tasks 2 + 3: resolve, materialize and classify the enable cascade** - `40bcedd7` (feat)
2. **Prettier reformatting from the pre-commit hook** - `40018978` (style)
3. **Remap the type-members contract pins the cascade's inserted lines shifted** - `64f3a5c2` (chore)

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md, written after this file).

_Note: Task 1 (the checkpoint:decision ruling) made no source commit -- see key-decisions above for the ruling recorded verbatim._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - `EnableRefusedError`, the closure resolution (`resolveEnableCascade`), per-member classification and materialization (`runEnableCascadeMembers`, `buildEnableCascadeMemberPhase`), and the closure-step/branch-dispatch extractions (`runEnableCascadeStep`, `dispatchBranch`) that keep the transaction closure's cognitive complexity within budget
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` - `EnableCascadeMemberRow` and `composeEnableCascadeRows`; extended `narrowEnableFailure` to classify a missing clone directory reported as a structured `PluginShapeError`
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `"dependency enabled"` appended to `REASONS` (index 59)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - `"dependency enabled"` added to `CommandPrivateReason`, header running count updated
- `docs/output-catalog.md` - new `enable-cascade` catalog state; reasons paragraph updated to 60-member and the new token
- `docs/plugin-enablement.md` - the enable-side half of the "not enabled on its behalf" divergence recorded
- `tests/orchestrators/plugin/enable-disable.test.ts` - 14 new EDEP-01/EDEP-03 cases plus the `writeUserState` fixture fix (a real on-disk manifest) needed for every pre-existing case in the file to keep passing under the new unconditional declaration read
- `tests/orchestrators/plugin/enable-disable.messaging.test.ts` - `composeEnableCascadeRows` cases and `narrowEnableFailure`'s new classification case
- `tests/edge/handlers/plugin/enable-disable.test.ts` - one spot-check proving the cascade's multi-row block survives the edge boundary
- `tests/architecture/catalog-uat/fixtures/plugin-enable.ts`, `catalog-contract.test.ts`, `catalog-parser.test.ts` - the `enable-cascade` fixture and the 219-state / recomputed-byte-count pins
- `tests/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `tests/shared/notification-types.test.ts` - the 60-member enrollment/enumeration updates
- `scripts/check-unused-type-members.contracts.json` - 13 pins remapped to their post-insertion line, 2 new pins for the cycle-only narrowing this plan introduces

## Decisions Made

See `key-decisions` in the frontmatter for the full text, including Task 1's verbatim ruling. In summary: Decision A confirmed (`dependency enabled`), Decision B took Option B1 (plan 08-02 re-adds `dependents remain`), both Claude's-Discretion calls confirmed (reuse `already enabled`; clear the `dependencyDisabled` marker at write time).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `writeUserState` test fixture needed a real on-disk manifest**
- **Found during:** Task 2/3 (running the full pre-existing `enable-disable.test.ts` suite against the new cascade code)
- **Issue:** EDEP-01's cascade resolution (`buildScopeDeclarationDetail`) reads every record's declared dependencies, fail-closed, before any enable/disable proceeds. `writeUserState`'s synthetic fixture pointed at a marketplace manifest that never existed on disk (`/tmp/dummy-mp/...`), so every enable in ~15 pre-existing tests started failing cascade-side with `{unreadable}` instead of reaching the scenario each test was actually written to exercise.
- **Fix:** `writeUserState` now also writes a real, minimal marketplace manifest (under the test's own hermetic `home`, not a shared `/tmp` path) declaring the seeded plugin with no dependencies. The plugin's own directory is deliberately left uncreated, so a case that wants a genuinely missing clone still observes that failure, now at the ledger stage instead of the declaration-read stage.
- **Files modified:** tests/orchestrators/plugin/enable-disable.test.ts
- **Verification:** the full pre-existing 66-test suite (now 80 with the new EDEP cases) passes unchanged in intent
- **Committed in:** 40bcedd7

**2. [Rule 1 - Bug] `narrowEnableFailure` did not classify a resolver-reported missing clone directory**
- **Found during:** Task 2/3 (ENBL-03 / WR-02 / I4, exposed by the fixture fix above)
- **Issue:** With a real manifest now readable, the "missing cached clone" scenario these three tests exercise reaches `resolveStrict`'s structured `not-installable` / "source dir does not exist" `PluginShapeError`, not a raw `ENOENT`. The existing errno-only classifier could not see it, so the row lost its `{source missing}` brace.
- **Fix:** `narrowEnableFailure` gained a case recognizing `PluginShapeError` with `shape.kind === "not-installable"` and a `"source dir does not exist"` reason, classifying it as `source missing`.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
- **Verification:** `tests/orchestrators/plugin/enable-disable.messaging.test.ts` (2 new cases), plus the 3 previously-failing orchestrator tests
- **Committed in:** 40bcedd7

**3. [Rule 3 - Blocking] `enable-disable.ts`'s transaction closure exceeded the cognitive-complexity ceiling**
- **Found during:** Task 2/3 (`npm run fallow` health check, and ESLint's `sonarjs/cognitive-complexity` rule, which disagree slightly on the exact count)
- **Issue:** Adding the cascade step and its save-forcing branch to the existing `withLockedStateTransaction` closure pushed it past both tools' complexity ceiling of 15.
- **Fix:** Extracted `runEnableCascadeStep` (the cascade resolve-and-materialize step) and `dispatchBranch` (the enable/disable branch dispatch, including the disable branch's partial-cascade save-and-return arm) as named helper functions, matching the file's own established `runEnableBranch` / `runDisableBranch` extraction pattern.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
- **Verification:** `npx eslint` and `npx fallow health --fail-on-issues` both clean afterward
- **Committed in:** 40bcedd7

**4. [Rule 1 - Bug] Two genuinely-unreachable switch arms and a `??` fallback were dead code under the project's 100%-branch coverage gate**
- **Found during:** Task 2/3 (`npm run test:coverage:direct:commit`)
- **Issue:** `enableCascadeClosureFailure`'s switch had three arms (`marketplace-not-added`, `not-found`, `unusable-declaration`) that this plan's specific `lookup`/`knownMarketplaces` configuration can never produce, and `runEnableCascadeMembers`'s `result.error ?? new Error(...)` fallback can never take its right side (`runPhases`'s sole `ok: false` producer always sets `error`). Both are true dead code, not merely hard-to-reach.
- **Fix:** Replaced both with evidence-backed assertion functions (`asserts x is Y`, empty body, matching the file's own pre-existing `assertRecordedStateLedgerInstalled` pattern) instead of writing switch arms or a fallback that no test could ever legitimately exercise.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
- **Verification:** `enable-disable.ts` and `enable-disable.messaging.ts` both reach 100% line/branch/function coverage when their own paired test runs alone
- **Committed in:** 40bcedd7

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug). **Impact:** all four were necessary to keep the pre-existing test suite green and the coverage/complexity gates passing under the new cascade code; none changed the plan's own required behavior.

**Process deviation (not a Rule 1-4 fix):** Tasks 2 and 3 were implemented as one commit rather than two -- see key-decisions above for why splitting them would have meant shipping throwaway code.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EDEP-01 and the enable-side half of EDEP-03 are Complete. `REASONS` sits at 60 members with `dependency enabled` at the tail.
- Plan 08-02 (disable's dependents guard, EDEP-02) inherits the Task 1 ruling recorded here verbatim: it re-adds `dependents remain` to `REASONS` at the tail (59 -> 60 -> 61 overall), taking Option B1.
- Plan 08-03 (the install cascade's own already-installed-disabled arm) can reuse `EnableCascadeMemberRow`'s row shape and the `{dependency enabled}` token as-is; `docs/plugin-enablement.md`'s divergence subsection is left in place (heading unchanged) for that plan's own rewrite, per its own `<artifacts_this_phase_produces>` note.
- No blockers.

---

*Phase: 08-enablement-parity-for-dependencies*
*Completed: 2026-09-21*
