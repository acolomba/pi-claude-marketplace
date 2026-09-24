---
phase: 03-dependency-resolution
plan: 06
subsystem: orchestrators/plugin
tags:
  [dependency-resolution, notifications, closed-set-reasons, output-catalog, resv-06]

requires:
  - phase: 03-dependency-resolution
    plan: 01
    provides: "runInstallCascade and its per-member outcomes -- the list this plan renders"
  - phase: 03-dependency-resolution
    plan: 03
    provides: "docs/dependency-resolution.md's failure table -- the list every minted token had to agree with"
  - phase: 03-dependency-resolution
    plan: 04
    provides: "probeDependencyTags' transport classification, which is already a closed-set member and so is reused verbatim"
  - phase: 03-dependency-resolution
    plan: 05
    provides: "the six constraint discriminants, the InstallPluginOptions.tagProbe seam, and the two interim prose formatters this plan replaced"
provides:
  - "seven new closed-set REASONS members with their pinned-enumeration amendment, their inline justifications and their catalog rows"
  - "install-cascade.messaging.ts: CASCADE_CONTEXT, composeCascadeMemberRows, composeCascadeFailureMessage, cascadeFailureCause"
  - "InstallCascadeResult.installed.alreadyInstalled -- the RESV-05 skip list, so a dependency left alone is reportable"
  - "CascadeMemberOutcome.declaresAgents / declaresMcp -- what a member staged, so its row fires the same soft-dep marker and SEV-01 severity an ordinary install row does"
  - "twelve catalog states recording the cascade's rendered bytes"
affects:
  [dependency-cascade UX, the closed reason vocabulary, the output catalog, install failure attribution]

actuals:
  tokens: 29851
  tasks: 2
  commits: 3
plan_head_before: 30fb8fe1c22e4462088848e4a5194e9f6d4cff58

tech-stack:
  added: []
  patterns:
    - "A command-local render map that SPREADS a sibling's rather than restating its arms, so the two surfaces cannot drift"
    - "A structured failure carried across a lock-closure boundary in a sink, so the catch can name a subject a thrown string would have erased"
    - "One closed-set token over two subjects, separated by the co-reason and the version beside it rather than by a second token"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - docs/output-catalog.md
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-install.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/shared/notification-types.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/edge/handlers/plugin/install.test.ts

key-decisions:
  - "D-03-30: the cascade needs exactly seven new reason members. Four inherited members carry four of the twelve outcomes unchanged -- `not in manifest` for a dependency its marketplace does not declare, `invalid manifest` for an unusable declaration, `already installed` for a member RESV-05 left alone, and the probe's own `network unreachable` / `authentication required` for a listing that could not be read. Everything else needed a token because no inherited member states the same fact."
  - "D-03-31: `dependency marketplace not added` is a CONTENT reason, not a fourth structural marketplace-absent marker. The three structural ones are excluded from `ContentReason` because their subject is a standalone marketplace row; this token's subject is the dependency row it rides, which is the `marketplace in user scope` precedent. The exclusion is mechanical as well as semantic -- a structural member cannot type-check into a plugin row's `reasons`."
  - "D-03-32: the cascade emits `cardinality: \"single\"`. The user named ONE plugin; the members are that install's transitive consequence, not a bulk operation. This also keeps a no-dependency install's bytes frozen, because a plural cardinality would have added a trailing tally to every install."
  - "D-03-33: the success path routes through `CASCADE_CONTEXT` UNCONDITIONALLY. A plugin that declares nothing hands the composer two empty lists and gets back the single row it always had, so there is no branch whose untaken side could rot."
  - "D-03-34: a `member-failed` whose key IS the root records no cascade subject and keeps the existing single-plugin failure path, which classifies entity-shape errors and git-auth challenges the cascade block has no arm for."
  - "D-03-35: `handleCascadeThrow` derives its Error from the SUBJECT rather than from the caught value, via `cascadeFailureCause`. The subject is recorded only at a throw site that throws exactly that Error, so the two agree by construction and the outcome's typed `error` needs no `unknown` widening for a case a cascade arm cannot produce."
  - "install-cascade.messaging.ts is NOT added to `sonar.cpd.exclusions`. That list exists for modules whose per-verb arms are structurally parallel by design; this one SPREADS install's render map instead of restating it, so it has no parallel arms, and `fallow dupes` reports no clone involving it. Pre-emptively excluding it would suppress a finding that does not exist."

patterns-established:
  - "A render map that spreads a sibling's is a cheaper exhaustiveness guarantee than a second copy: the one added arm is the whole diff, and the shared arms cannot drift because there is only one of them."
  - "When a lock closure must abort but the catch needs structure, record the discriminant in a sink beside the throw. A `throw new Error(text)` is where a subject goes to die."
  - "A reused token plus a co-reason beats a minted token when the fact is identical and only the subject moves -- `{already installed, version conflict}` says what a second conflict token would have, and keeps the closed set smaller."

requirements-completed: [RESV-01, RESV-03, RESV-04, RESV-06]

coverage:
  - id: D1
    description: "Installing a plugin that declares dependencies renders one row per cascade member beside the requesting plugin's own row"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / RESV-06: a successful cascade renders one row per member"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#RESV-01 / RESV-05 one row per member, with the skip readable apart from the install"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts (state dependency-cascade-success)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dependency that was already installed and left alone is distinguishable in the output from one this command installed"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-05 / RESV-06: an already-installed dependency renders as left alone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 an already-installed dependency that ... is left exactly as it was (3 cases, alreadyInstalled assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed cascade names the dependency that failed and the reason it failed, not only the plugin the user asked for"
    requirement: RESV-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-06: a dependency its marketplace does not declare is what the block names"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-06: a dependency whose own ledger throws is the block's subject"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#composeCascadeFailureMessage (12 arms, whole-notification comparison)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The reason a failed dependency carries names the constraint text when the failure is a constraint failure"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-03 / RESV-06: an unsatisfiable constraint names the dependency and the range"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#RESV-03 contradictory declarations name the joined declared ranges"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#RESV-05 an unsatisfied installed copy carries its recorded version beside the token"
        status: pass
    human_judgment: false
  - id: D5
    description: "A cycle failure renders the chain of plugin keys that closes the cycle"
    requirement: RESV-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#RESV-04 a cycle renders the whole chain including the repeated key"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts (state dependency-cycle)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A dependency whose marketplace has not been added renders a reason naming that marketplace and pointing at the command that adds it"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#RESV-02 an unadded marketplace names the marketplace and the command that adds it"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts (state dependency-marketplace-not-added)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every reason token the cascade renders is a member of the closed vocabulary, whose pinned enumeration was amended by equality in the same commit as the members added, each with an inline justification"
    requirement: RESV-06
    verification:
      - kind: architecture
        ref: "node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-types.test.ts#exports the exact notification vocabulary from its named owner"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every new rendered row shape has a byte-form entry in the command output catalog, byte-equal to real emitted output"
    requirement: RESV-06
    verification:
      - kind: architecture
        ref: "node --test tests/architecture/catalog-uat/catalog-contract.test.ts (204 states, 27100 UTF-8 bytes)"
        status: pass
    human_judgment: false
  - id: D9
    description: "All cascade output reaches the user through the single notification dispatch surface, and no cascade row renders an absolute filesystem path"
    requirement: RESV-06
    verification:
      - kind: architecture
        ref: "npm run check (ESLint no-restricted-syntax + fallow boundaries.calls.forbidden)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts (every case compares the WHOLE emitted notification, so a second block would fail)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The cascade block read by a real operator against a real marketplace with real dependencies"
    verification: []
    human_judgment: true
    rationale: "Every case here drives a seeded path marketplace or a composed row through a fake host. Whether the block reads well in a live Pi session -- the wrapping, the ordering against a longer closure, and whether `Run marketplace add <source> to add it.` is the sentence an operator acts on -- is only observable in a runtime UAT."

duration: 72min
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 6: Make the cascade legible Summary

**A dependency cascade now renders one row per closure member beside the requesting plugin's own row, and a cascade that failed names the DEPENDENCY as the row's subject with a closed-set reason and its cause -- rather than reporting the plugin the user typed for something one of its dependencies did.**

## Performance

- **Duration:** ~72 min
- **Started:** 2026-09-15T11:40Z
- **Completed:** 2026-09-15T12:52Z
- **Tasks:** 2
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- **The closed reason vocabulary grew by exactly seven, and four outcomes were carried by members that already existed.** The reuse is the interesting half: a dependency its marketplace does not declare is `{not in manifest}` (the ATTR-08 split holds -- an absent CONTAINER is a marketplace-subject fact, an absent ENTRY is a plugin-row fact); an unusable `dependencies` array is `{invalid manifest}`; a member RESV-05 left alone is `{already installed}`; and a tag listing that could not be read reuses the probe's OWN classification, which was already a closed-set member. The seven minted are `no matching version`, `version conflict`, `constraint too complex`, `invalid version constraint`, `dependency marketplace not added`, `dependency cycle` and `dependency failed`.
- **One token covers both `version conflict` subjects.** Contradictory declarations and an already-installed copy the constraint rejects are the same fact about different subjects, so the second row carries `{already installed, version conflict}` and its recorded version rather than a token of its own. That is one fewer member in a set the whole renderer is written against.
- **The pinned enumeration was amended by equality, in the same commit as the members, each with an inline note recording why no inherited member said the same thing.** The length lock, the owner's own vocabulary test, and both catalog counts moved with it. The equality assertion was not loosened.
- **Twelve catalog states record the rendered bytes,** produced by running the composition through the dispatcher rather than typed by hand -- the contract test drives every one of them and the file's UTF-8 byte total moved 24,145 -> 27,100.
- **`install-cascade.messaging.ts` spreads install's render map instead of restating it.** Its status set is `InstallMsg["status"] | "skipped"` and its map is `{...INSTALL_CONTEXT.render, skipped}`, so the requesting plugin's row renders byte-identically whether or not the plugin declared dependencies, and the one added arm calls the shared `pluginRow` composer the central switch's own `skipped` arm calls.
- **Both interim prose formatters are gone, not extended.** `formatClosureFailure` and `formatConstraintFailure` were deleted from `install-cascade.ts`; their cause text now lives beside the rows it belongs to, and `cascadeFailureCause` hands the orchestrator the SAME `Error` the row carries, so the text a cascade caller reads cannot drift from the text the user reads. Their two table tests moved into the messaging test, where they are now whole-notification assertions rather than string comparisons.
- **Every new module carries complete direct coverage** (`install-cascade.messaging.ts` branches 50/50, functions 12/12, lines 419/419), `install-cascade.ts` and `install-flow.ts` both returned to complete coverage, the three pinned shortfalls matched exactly, and `npm run check` exits 0.

## Task Commits

1. **Task 1: Amend the closed reason vocabulary, deliberately** - `ecc640bc` (feat)
2. **Task 2: Render one row per cascade member and name what failed** - `bae2e5b7` (feat)

**Plan metadata:** the `docs(03-06): complete the cascade messaging plan` commit, which carries this file (a commit cannot record its own hash).

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` - **new.** The block's command-local vocabulary: `CASCADE_CONTEXT`, `composeCascadeMemberRows`, `composeCascadeFailureMessage`, `cascadeFailureCause`, and the three conventions (subjects, order, failure attribution) that belong to the block rather than to the orchestrator that emits it.
- `tests/orchestrators/plugin/install-cascade.messaging.test.ts` - **new.** 22 cases, every one comparing the WHOLE emitted notification through the real dispatch seam.
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - the seven appended `REASONS` members with their inline justifications.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - the seven added to `CommandPrivateReason` so the OUT-08 completeness proof stays total.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `alreadyInstalled` on the installed arm, `declaresAgents`/`declaresMcp` on a member outcome, the shared `recordedVersionOf` read, and the removal of both formatters.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - the `CascadeFailureSink`, `handleCascadeThrow`, the success path's route through the cascade composer, and one hoisted companion probe per emission.
- `docs/output-catalog.md` - the conventions subsection plus twelve byte-form states; the reasons-rendering paragraph updated to 52 members.
- `tests/architecture/compat-01-no-expansion.test.ts` - the amended pinned enumeration.
- `tests/architecture/notify-closed-set-locks.test.ts` - 45 -> 52 with the bump's rationale.
- `tests/architecture/catalog-uat/{fixtures/plugin-install.ts,catalog-contract.test.ts,catalog-parser.test.ts}` - twelve fixtures and the two state/byte counts.
- `tests/shared/notification-types.test.ts` - the owner's own vocabulary list.
- `tests/orchestrators/plugin/install-cascade.test.ts` - the two moved formatter tables removed, an `alreadyInstalled` assertion added.
- `tests/orchestrators/plugin/install-flow.test.ts` - five appended whole-notification cascade cases.
- `tests/edge/handlers/plugin/install.test.ts` - the disabled-install probe count normalized to the one every other standalone install states.

## Decisions Made

- **D-03-30: seven minted, four reused.** The per-outcome record is in `key-decisions` above and in the inline comments each member carries. The governing rule was truthful attribution: `{no matching version}` (the listing held nothing usable) is deliberately a different claim from `{network unreachable}` / `{authentication required}` (the listing could not be read), and `{constraint too complex}` (the input is well formed, the COMBINATION is refused) from `{invalid version constraint}` (one field is unreadable).
- **D-03-31: `dependency marketplace not added` is a `ContentReason`.** The plan asked whether the inherited `marketplace not added` could carry this as-is. It cannot, and the reason is mechanical before it is semantic: that member is `Exclude`d from `ContentReason`, so it does not type-check into a plugin row's `reasons` at all. The semantic half agrees -- its subject is a standalone marketplace row, while this fact's subject is the dependency row it rides, which is exactly the `marketplace in user scope` precedent.
- **D-03-32 / D-03-33: `cardinality: "single"`, and the success path routes through the cascade composer unconditionally.** Together these are what keep a no-dependency install's bytes frozen while adding the member rows: empty lists in, one row out, no tally, no branch.
- **D-03-34: a root-keyed `member-failed` stays on the single-plugin path.** Nothing but the requested plugin failed there, and that path classifies entity-shape errors, git-auth challenges and rollback partials the cascade block has no arm for. Routing it through the block would have traded working attribution for a second row saying the plugin failed because the plugin failed.
- **D-03-35: the cascade error is derived from the subject.** `handleCascadeThrow` reads `cascadeFailureCause(subject, rootKey)` rather than the caught `unknown`. That removed the last `err instanceof Error` branch on a path where a non-Error is unreachable -- the branch was measurably uncoverable, which is the signal that it was describing a case the code cannot produce.
- **Tokens appended at the tail rather than placed mid-tuple.** The plan asked for canonical render order. `composeReasons` joins in ARRAY order, not tuple order, so tuple position does not move any rendered byte; the gate's own message states the discipline ("a new token appends at the tail"), and the DATA-01 member set the precedent. Appending is the canonical order here.
- **`install-cascade.messaging.ts` is not added to `sonar.cpd.exclusions`.** See `key-decisions`: the list is for modules whose per-verb arms are parallel by design, and this one has no parallel arms because it spreads install's map.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The cascade had no way to report a dependency it left alone**

- **Found during:** Task 2
- **Issue:** The plan's own must-have truth is that "a dependency that was already installed and left alone is distinguishable in the output from one this command installed." `InstallCascadeResult`'s installed arm carried `members` only. RESV-05's skipped members are consumed by the constraint step and then dropped, so the caller had nothing to render and the truth would have been false of the running system.
- **Fix:** `CascadeSkippedMember` and `InstallCascadeResult.installed.alreadyInstalled`, projected from the closure walk's own skip list plus a shared `recordedVersionOf` read that the RESV-05 constraint check now uses too -- so a row cannot report a version the check never saw.
- **Files modified:** `install-cascade.ts`, `install-flow.ts`, `install-cascade.test.ts`
- **Verification:** `tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 ... is left exactly as it was` (3 cases) and `install-flow.test.ts#RESV-05 / RESV-06: an already-installed dependency renders as left alone`.
- **Commit:** `bae2e5b7`

**2. [Rule 2 - Missing critical functionality] A materialized dependency could degrade silently**

- **Found during:** Task 2
- **Issue:** A member row composed with `dependencies: []` fires no `{requires pi-subagents}` / `{requires pi-mcp}` marker and stamps a flat `info`, so a dependency that staged agents while the companion extension was unloaded would have installed silently degraded -- the exact condition SEV-01 exists to surface, and one the requesting plugin's own row cannot speak for.
- **Fix:** `CascadeMemberOutcome` carries `declaresAgents` / `declaresMcp` (two expressions off the ledger summary, no new branches in the cascade), and the messaging module turns them into the row's `dependencies` and its `companionSeverity` verdict.
- **Files modified:** `install-cascade.ts`, `install-cascade.messaging.ts`, `install-cascade.messaging.test.ts`
- **Verification:** `tests/orchestrators/plugin/install-cascade.messaging.test.ts#SEV-01 a member's unloaded companion marks its own row and raises the block` -- exact bytes plus the `warning` severity argument.
- **Commit:** `bae2e5b7`

**3. [Rule 3 - Blocker] Two closed-set gates the plan did not name had to move with the vocabulary**

- **Found during:** Task 1
- **Issue:** `files_modified` named `notification-types.ts` and the COMPAT-01 gate. Three other places pin the same set: `notify-closed-set-locks.test.ts` pins the LENGTH, `tests/shared/notification-types.test.ts` holds the owner's own enumeration, and `notify-reasons.ts` carries the compile-time `_ReasonsCoverageProof`, which is a TS2344 build failure for any member without a home. Each is deliberate duplication and each had to be amended in the same change.
- **Fix:** length 45 -> 52 with its rationale, the owner's list extended, and the seven added to `CommandPrivateReason` with a note recording that all seven are content reasons owned by the cascade messaging module.
- **Files modified:** `notify-closed-set-locks.test.ts`, `tests/shared/notification-types.test.ts`, `notify-reasons.ts`
- **Verification:** `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/shared/notification-types.test.ts` -- all green.
- **Commit:** `ecc640bc`

**4. [Rule 3 - Blocker] The catalog's two counts are pinned in two different files**

- **Found during:** Task 1
- **Issue:** `catalog-contract.test.ts` pins the state count AND the total UTF-8 byte size of every fenced block; `catalog-parser.test.ts` independently pins the tuple count. Twelve new states moved both files.
- **Fix:** 192 -> 204 in both, and 24,145 -> 27,100 bytes, with the reason recorded beside the count.
- **Files modified:** `catalog-contract.test.ts`, `catalog-parser.test.ts`
- **Verification:** `node --test tests/architecture/catalog-uat/` -- 16 cases green.
- **Commit:** `ecc640bc`

**5. [Rule 3 - Blocker] One extra companion probe broke a boundary count**

- **Found during:** Task 2
- **Issue:** `composeCascadeMemberRows` needs the soft-dep probe for its SEV-01 member severity, and a naive `softDepStatus(pi)` beside `composeInstalledRow`'s own call doubled the probe on every install. The strict notification boundary states probe counts rather than deriving them, so a discovery-warning case failed outright.
- **Fix:** ONE probe hoisted per emission and threaded into both composers, which also means every row in a block describes the same host snapshot. That left the DISABLED-install arm -- which previously probed only at render time -- stating 2 where every other standalone install states 4; that one count was normalized with the reason recorded inline.
- **Files modified:** `install-flow.ts`, `tests/edge/handlers/plugin/install.test.ts`
- **Verification:** `node --test tests/edge/handlers/plugin/install.test.ts` and the full `npm test` run -- green.
- **Commit:** `bae2e5b7`

**6. [Rule 3 - Blocker] A branch the code cannot reach cost install-flow its complete coverage**

- **Found during:** Task 2 (at `npm run test:coverage:direct`)
- **Issue:** `handleCascadeThrow` opened with `err instanceof Error ? err : new Error(...)`, copied from its sibling. The cascade only records a subject at a throw site that throws an `Error`, so the false arm is unreachable -- and the gate measured `install-flow.ts` at branches 118/119, an UNPINNED shortfall on a file that had none.
- **Fix:** the handler derives its Error from the subject through `cascadeFailureCause` instead of from the caught value (D-03-35). The uncoverable branch disappeared rather than being pinned, and the outcome contract is unchanged because the member arm returns the same object and the other arms the same message.
- **Files modified:** `install-flow.ts`
- **Verification:** `npm run test:coverage:direct:commit` -- `install-flow.ts` branches 118/118, functions 25/25, lines 1438/1438; "3 pinned shortfall(s) matched ... exactly".
- **Commit:** `bae2e5b7`

---

**Total deviations:** 6 auto-fixed (2 Rule 2, 4 Rule 3).
**Impact:** Deviations 1 and 2 are the consequential ones -- without them a plan whose whole objective is per-member legibility would have shipped a block that omits one member class entirely and silently under-reports another. Deviation 6 is worth keeping in view as a method: an uncoverable branch is usually a description of a case the code cannot produce, and removing it beat pinning it.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog fails to read the index. Both commits ran `SKIP=trufflehog`, per the repository's own worktree guidance and this phase's precedent. Every other pre-commit hook passed on every commit.
- **`fallow dupes` reports 1,035 duplicated lines and exits 0.** The `✗` line reads like a failure but the sub-gate does not fail on it, and a pristine `git archive` of HEAD reports the identical figure. Pre-existing and unchanged by this plan; recorded so the next reader does not spend the same ten minutes proving it.

## Known Stubs

None. Every reason member has a producer, a row, a catalog entry and a test; every failure arm of the cascade has a rendered block.

## Threat Flags

None. The plan's register is addressed in code: every value a row interpolates is a token-allowlisted plugin key, a `renderConstraintRange`-bounded constraint, a recorded version, a validator field path, or a closed-set classification, so a crafted manifest can forge no row (T-03-25); rows carry no filesystem path, and the one arm carrying an arbitrary Error is the member's own ledger failure, which is the identical value a single-plugin install of that dependency already surfaces (T-03-26); the enumeration gate was amended by equality in the same commit as the members, each with an inline justification and a catalog row (T-03-27); and all output goes through `notifyWithContext` into the single sanctioned dispatch surface, with both independent gates green (T-03-28).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Decision IDs through D-03-35 are now allocated;** a later plan should mint from D-03-36.
- **The dependency-cascade reason members are command-private to `install-cascade.messaging.ts`.** A later verb that needs to report a dependency outcome (update, reinstall, reconcile) should import that module's composers rather than re-stamping the tokens, and should expect `cardinality: "single"` to be install's choice rather than a cascade-wide rule.
- **`docs/dependency-resolution.md`'s failure table and the seven tokens agree today.** They are coupled by prose, not by a gate: nothing fails if a future edit to one drifts from the other. A cheap guard would be a source-scan asserting every row of that table names a live `REASONS` member.
- **The one open UAT item is D10:** the block has never been read by an operator in a live Pi session against a real marketplace. The wrapping, the ordering against a closure longer than two, and whether `Run marketplace add <source> to add it.` is the sentence an operator acts on are all judgment calls no fixture settles.
- **Phase 03 is complete.** All six plans have summaries; RESV-01..06 are covered.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-15_

## Self-Check: PASSED

Both created files exist on disk (`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`, `tests/orchestrators/plugin/install-cascade.messaging.test.ts`), both task commits (`ecc640bc`, `bae2e5b7`) are present in the repository, and `npm run check` exits 0 over the whole chain.
