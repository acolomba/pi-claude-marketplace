---
phase: 03-dependency-resolution
plan: 01
subsystem: orchestrators/plugin
tags: [dependency-resolution, graph-walk, phase-ledger, rollback, config-write-back]

requires:
  - phase: 01-manifest-read-fidelity
    provides: "domain/dependencies.ts -- the DeclaredDependency parser and the token allowlist this walk consumes"
provides:
  - "domain/dependency-closure.ts: a pure, network-free closure walk carrying a path stack (the only cycle test) and a separate visited memo (diamond dedup), whose post-order accumulator IS the install order"
  - "orchestrators/plugin/install-cascade.ts: an outer runPhases ledger, one phase per closure member, giving all-or-nothing rollback across plugins under one held state lock"
  - "writeAdoptingConfigEntries' dependencyPluginPatches parameter: every cascade member is declared in the requesting plugin's own physical config file, in the one batched write"
  - "ClosureLookup as an injected seam, so swapping the catalog read order changes no structure"
affects:
  [
    version-constraint resolution,
    live tag resolution,
    per-member outcome reporting,
    plugin-manifest-first dependency read order,
    install provenance,
  ]

actuals:
  tokens: 20669
  tasks: 3
  commits: 4
plan_head_before: 00f3538122148bc1e85e0a5b1ee3224484cd435f

tech-stack:
  added: []
  patterns:
    - "Two-structure dependency graph walk (path stack + visited memo) in domain/"
    - "A second, OUTER runPhases instantiation whose phase array is DERIVED from a separately tested post-order"
    - "A ledger phase whose undo gates on a context-set materialization sentinel rather than on the snapshot alone"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/dependency-closure.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - tests/domain/dependency-closure.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/shared.test.ts

key-decisions:
  - "The root is exempt from the closure's already-installed, marketplace-known and catalog-absent guards: all three are preconditions of the REQUESTED plugin, and the ledger owns them because it resolves a marketplace across scopes (CMP-3) in ways a pure walk over one snapshot cannot see."
  - "The cascade's phase undo gates on a `materialized` sentinel, not on runPhases' `executed` array alone. TR-02 runs the FAILING phase's own undo, so an install of an already-recorded plugin would otherwise unstage the very install its throw was reporting."
  - "ClosureLookup takes an already-split subject ({key, name, marketplace}) rather than a bare key, so no reader re-parses a key and no gated file carries an unreachable split guard."
  - "toClosureLookupResult lives in domain/ so the parse-failure arm has one definition and a reader whose own source cannot produce a failure does not carry an arm its tests cannot reach."
  - "install-flow passes ALL cascade members to dependencyPluginPatches including the requesting plugin's own key; the spread-under ordering makes its own patch win, which is the collision rule the parameter documents."

patterns-established:
  - "Path stack vs visited memo: two structures, two jobs. Conflating them misreports a legal diamond as a cycle; dropping the memo makes a layered graph re-walk exponentially."
  - "A derived runPhases array is legitimate when its order is an explicit, separately tested contract -- the literal-array discipline guards against IMPLICIT ordering."
  - "A rollback proof compares a whole two-scope footprint (records plus on-disk inventory) captured before and after; a result-only assertion of a rollback passes while proving nothing."

requirements-completed: []

coverage:
  - id: D1
    description: "Installing a plugin that declares one not-yet-installed dependency records BOTH plugins in the target scope, dependency first, under one held lock and one save"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-01 a cascade records the dependency and the requesting plugin, dependency first"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-01 a root declaring one dependency closes over both, dependency first"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dependency naming a marketplace resolves there; one naming none resolves in the declaring plugin's marketplace, re-checked against the token allowlist"
    requirement: RESV-02
    verification:
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-02 a declaration naming no marketplace resolves in the declaring plugin's"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-02 a filled-in marketplace that fails the token allowlist rejects the declaration"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-02 keys match by exact string identity, so case is never folded"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-02 two Unicode forms of one name resolve as distinct members"
        status: pass
    human_judgment: false
  - id: D3
    description: "A dependency cycle terminates with a reportable chain, and a legal diamond installs its shared member exactly once"
    requirement: RESV-04
    verification:
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-04 a root that declares itself reports a chain beginning and ending at it"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-04 a three-node ring reports the whole walk order plus the repeated key"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#D-03-11 a diamond resolves once and reports no cycle -- the one-set walk's failure"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#D-03-11 the memo bounds a layered graph to one lookup per distinct key"
        status: pass
    human_judgment: false
  - id: D4
    description: "An already-installed dependency is skipped before its marketplace is checked, never reinstalled, and never reachable by rollback"
    requirement: RESV-05
    verification:
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-05 an already-installed dependency is skipped and its own children are not walked"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#RESV-05 the already-installed guard precedes the marketplace-known guard"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-03-07 a member installed BEFORE the run survives a later member's failure"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed member unwinds the whole cascade, leaves both scope roots at their pre-command values, surfaces rollback partials, and replays identically"
    requirement: RESV-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-06 / D-03-07 three members whose LAST fails leave no trace of the first two"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-06 / D-03-07 a failing member restores the whole two-scope footprint"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-06 an undo that itself fails surfaces a rollback partial without throwing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-06 / NFR-3: a failed cascade never reaches tx.save() and replays the same"
        status: pass
    human_judgment: false
  - id: D6
    description: "A dependency naming a marketplace the target scope has not added fails the whole cascade, with no auto-add and no auto-clone"
    requirement: RESV-02
    verification:
      - kind: unit
        ref: "tests/domain/dependency-closure.test.ts#D-03-08 a dependency naming an unadded marketplace fails the whole closure"
        status: pass
      - kind: architecture
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "A cascade-installed dependency is declared in the same physical config file as its parent, so the reconcile uninstall bucket does not sweep it on the next resources_discover"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-03-06: a cascade dependency is declared in the parent's own file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#RESV-01 declares every cascade dependency in the requesting plugin's own file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#RESV-01 a key in both records resolves in the requesting plugin's favour"
        status: pass
    human_judgment: true
    rationale: "The reload clause itself -- that a real /reload does not remove the dependency -- is closed here by construction plus a plan.ts read, not by an end-to-end reload. A runtime UAT of `install` then `/reload` is the only thing that observes the whole loop."

duration: 89min
completed: 2026-09-14
status: complete
---

# Phase 3 Plan 1: Dependency-closure tracer Summary

**`install foo@mp` now installs `foo`'s declared dependencies with it -- resolved by a pure two-structure graph walk, materialized dependency-first by an outer phase ledger under one held state lock, declared in the parent's own config file, and unwound whole if any member fails.**

## Performance

- **Duration:** ~89 min
- **Started:** 2026-09-14T23:27Z
- **Completed:** 2026-09-15T00:56Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **`domain/dependency-closure.ts`** -- a pure, network-free, I/O-free walk over an injected catalog lookup. It carries a `path` array whose `includes` is the ONLY cycle test and a separate `visited` memo that dedupes a diamond; its post-order accumulator IS the install order, so no sort pass exists. The guard order (already-installed -> marketplace-known -> cycle -> memo) is load-bearing and tested as such.
- **`orchestrators/plugin/install-cascade.ts`** -- an outer `runPhases` ledger, one phase per closure member. `do` calls the guard-free `runInstallLedger`; `undo` calls `cascadeUnstagePlugin` and drops the member's in-memory record. The lock-acquiring `installPlugin` is never re-entered, so `proper-lockfile`'s non-reentrancy cannot self-deadlock.
- **`install-flow.ts`** drives the cascade inside its EXISTING single `withLockedStateTransaction` closure. Every failure arm returns or throws without reaching `tx.save()`, so no other process can observe half a cascade through the lock.
- **`writeAdoptingConfigEntries`** gained `dependencyPluginPatches`, spread under the requesting plugin's own entry. Every member rides the ONE batched write and the ONE write-target selection, which is what closes RESV-01's reload clause: an undeclared record is exactly what `buildUninstallBucket` sweeps.
- Both new modules carry complete direct line, branch and function coverage.

## Task Commits

1. **Task 1: End-to-end "installing foo installs bar"** - `ebf629db` (feat)
2. **Task 2: Make a cascade-installed dependency survive /reload** - `ad6d627d` (feat)
3. **Task 3: Prove the graph edges and the all-or-nothing footprint** - `a554572c` (test)

**Plan metadata:** the `docs(03-01): complete the dependency-closure tracer plan` commit, which carries this file (a commit cannot record its own hash).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` - the pure closure walk, its lookup seam, and the `toClosureLookupResult` mapping.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - the outer all-or-nothing ledger and `formatClosureFailure`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - wires the cascade inside the existing lock closure; adds the marketplace-entry-sourced catalog read and the cascade-outcome routing.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - `writeAdoptingConfigEntries` takes the dependency patch record.
- `tests/domain/dependency-closure.test.ts` - 23 cases over the walk contract.
- `tests/orchestrators/plugin/install-cascade.test.ts` - 15 cases including the two-scope footprint and replay proofs.
- `tests/orchestrators/plugin/install-flow.test.ts` - the end-to-end declare, unresolvable-dependency and no-save cases.
- `tests/orchestrators/plugin/shared.test.ts` - the dependency-patch batch, omission and collision cases.

## Decisions Made

- **The root is exempt from three closure guards** (already-installed, marketplace-known, catalog-absent). All three are preconditions of the REQUESTED plugin and belong to the ledger, which applies the CMP-3 cross-scope marketplace fallback a pure walk over one snapshot cannot see, and which reports each miss against the right subject. Enforcing them in the walk pre-empted that with a dependency-shaped verdict on a plugin that is nobody's dependency -- an absent root reported `not-found` with no `requiredBy`, which the arm cannot carry.
- **`ClosureLookup` takes `{key, name, marketplace}`, not a bare key.** The plan specified `(key: string)`. Handing the already-split, already-allowlisted parts removes a re-parse from every reader and, in `install-flow.ts` specifically, removes a split guard no caller can reach -- which matters because that file is direct-coverage gated.
- **`toClosureLookupResult` lives in `domain/`.** The parse-failure arm then has one definition, and `install-flow.ts` (whose own source cannot produce a failure, because `loadMarketplaceManifest` isolates an unparseable `dependencies` entry into an unsupported stub before it returns) does not carry an arm its tests cannot reach.
- **`buildUninstallBucket` was READ and needs no edit.** `orchestrators/reconcile/plan.ts:501-506` tests `declaredPluginKeys.has(key)` against the merged declared config; declaring every member closes the sweep by construction. CONTEXT.md asked that this be verified rather than assumed -- it is verified, and `plan.ts` is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The failing phase's own undo would uninstall an already-installed plugin**

- **Found during:** Task 1
- **Issue:** The plan (and RESEARCH.md) stated that `runPhases`' own `executed` array makes D-03-07's "this run's own materializations only" rule fall out for free, with no bookkeeping flag. That is true of the REVERSE walk but not of the failing phase itself: per `phase-ledger.ts`'s TR-02 contract, the failing phase's own `undo` runs FIRST, from the catch block. Installing an already-recorded plugin reaches its phase and throws from inside `do`, so its `undo` ran against the record that already existed and called `cascadeUnstagePlugin` on it -- re-running `install` on an installed plugin would have removed its artifacts and dropped its record.
- **Fix:** Each phase records itself in a `materialized` set on the run context after its ledger returns, and `undo` acts only on what it finds there. This is the remedy `Phase.undo`'s own doc comment prescribes ("gate on context-set sentinels"). The module header now states both halves of the rollback-scope rule instead of the plan's single structural claim.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`
- **Verification:** `tests/orchestrators/plugin/install-cascade.test.ts#RESV-06 / D-03-07 a failing member restores the whole two-scope footprint` and the three install-flow retry proofs that re-install an installed plugin.
- **Commit:** `ebf629db`

**2. [Rule 1 - Bug] The closure pre-empted the ledger's PI-3 and marketplace-absent verdicts**

- **Found during:** Task 1
- **Issue:** With the catalog read applied to the root, a plugin absent from its manifest and a marketplace absent from the scope both came back `absent` and became a closure `not-found` failure. That replaced `{not in manifest}` on the plugin row and the `marketplace-not-added` marketplace-subject row with a generic dependency failure (5 install-flow cases).
- **Fix:** The root is exempt from the catalog-absent guard, alongside the two guards it was already exempt from; the walk yields a one-member closure and the ledger reports the miss.
- **Files modified:** `extensions/pi-claude-marketplace/domain/dependency-closure.ts`
- **Verification:** the pre-existing PI-3 / ATTR-01 / CMP-4 cases pass unchanged.
- **Commit:** `ebf629db`

**3. [Rule 3 - Blocker] Task 3's test matrix had to land in task 1's commit**

- **Found during:** Task 1 (at commit time)
- **Issue:** The `npm-coverage-direct` pre-commit hook gates every changed source/test pair at full strictness. A new production module that arrives under-covered fails the commit, and the only alternatives were pinning both new modules in `scripts/test-coverage-direct.pin.json` and un-pinning them one commit later -- writing a measurement the pin file explicitly states "forgives nothing" -- or covering them on arrival. The plan's three-task split assumed the tests could trail the module by two commits.
- **Fix:** The closure and cascade matrices task 3 specified were written in task 1 so both modules arrive at 100% line, branch and function coverage. Task 3's commit carries the proofs the coverage gate did NOT force: the three-member last-fails footprint, the Unicode-form encoding case, and the caller-observed no-save proof.
- **Files modified:** `tests/domain/dependency-closure.test.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`
- **Verification:** `npm run test:coverage:direct` reports `branches 57/57, functions 8/8, lines 439/439` and `branches 36/36, functions 7/7, lines 293/293`; `scripts/test-coverage-direct.pin.json` is unchanged.
- **Commit:** `ebf629db`, `a554572c`

**4. [Rule 3 - Blocker] Existing install-flow fixtures observed both ledgers**

- **Found during:** Task 1
- **Issue:** Install now schedules TWO `runPhases` calls -- the outer cascade and the six-phase bridge ledger inside each of its phases. Two fixtures that instrument `transactionControl.runPhases` unconditionally therefore fired twice, and the `PI-13` fixture's declared dependency (`some-other-plugin`, never seeded) became a real, unresolvable cascade member.
- **Fix:** The staging-census expectation now names the cascade phase explicitly and records why the second install produces one cascade row and no bridge rows; the MCP fault fixture arms on the ledger it means (`phases.some((phase) => phase.name === "mcp")`) rather than on whichever `runPhases` returns first; and the `declareDependencies` fixture seeds the named sibling, its title re-anchored on RESV-01 since this milestone retires PI-13's manual-install posture.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** all 136 install-flow cases pass.
- **Commit:** `ebf629db`

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 3 blockers).
**Impact:** Deviation 1 is the significant one -- it is a data-loss defect the plan's own prohibition list named ("Rollback must never unstage, delete, or drop the record of a plugin that was already installed before this cascade run") but whose mechanism the research had ruled out. The rest are integration adjustments with no behavioral cost.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog fails with `failed to read index file: ... not a directory`. Every commit in this plan therefore ran `SKIP=trufflehog`, per the repository's own worktree guidance. Every other pre-commit hook passed, and `npm run check` exits 0.
- **A failed cascade leaves empty scaffolding directories.** When a rolled-back member had components, the bridges' container and staging directories survive as empty directories (`pi-claude-marketplace/resources/skills/`, `pi-claude-marketplace/skills-staging/`). No file and no record survives. These are per-scope directories the bridges create idempotently and reuse, nothing discovers or reconciles an empty one, and a successful install leaves the same shape -- but a failed SINGLE install does not create them, because it throws in preflight before any phase runs. The no-save proof asserts the file-level and record-level invariant and names the reason.

## Threat Flags

None. Every surface this plan adds is fs-and-cache only; `tests/architecture/no-orchestrator-network.test.ts` passes with both install owners still in `NETWORK_FREE_TARGETS`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ClosureMember.ranges` already accumulates every range the walk encountered, in encounter order, seeded empty per D-03-10. The version-constraint work can fold it without touching the walk.
- `ClosureLookup` is an injected parameter, so the plugin-manifest-first read order replaces `lookupCascadeDependencies`' body and nothing else. The deferral is recorded in that function's own doc comment.
- The internal failure discriminants (`cycle`, `marketplace-not-added`, `not-found`, `unusable-declaration`, `member-failed`) are stable and currently rendered through `formatClosureFailure`'s interim cause text; the closed-set `REASONS` mapping is a separate concern.
- `CascadeMemberOutcome` already carries each member's key, name, marketplace, `requiredBy` and resolved version, which is the whole input a per-member reporting surface needs.
- **Docs follow-up folded in here:** `.planning/codebase/ARCHITECTURE.md` asserted `runPhases` has "exactly ONE production consumer". `install-cascade.ts` is a second one; the statement is corrected in this plan's metadata commit. No gate asserted the single-consumer claim.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-14_

## Self-Check: PASSED

All created files exist on disk and all three task commits are present in the repository.
