---
phase: 115-composition-orchestrators
plan: "05"
subsystem: testing
tags: [node-test, reconcile, real-composition, exhaustive-matrix, overload-narrowing, direct-coverage]

requires:
  - phase: 115-composition-orchestrators
    plan: "07"
    provides: "The settled applied-cascade row shape this owner asserts against, and the narrow-then-delete recipe for an unreachable arm"
  - phase: 115-composition-orchestrators
    plan: "02"
    provides: "The finding that a plan's enumeration of unreachable arms can be short, and the discipline of reporting a green plant instead of papering over it"
  - phase: 115-composition-orchestrators
    plan: "08"
    provides: "The sized notification boundary and the t.after-owned hermetic scope idioms this suite copies"
provides:
  - "The sole mirrored owner for orchestrators/reconcile/apply.ts at 100 percent direct branch, function and line coverage"
  - "A compile-time producer contract: addMarketplace, removeMarketplace and uninstallPlugin narrow their orchestrated return, so a dropped cascade row is a gate failure rather than a silent continue"
  - "All fifteen reconcile outcome kinds produced, including the partial marketplace removal, the failed plugin uninstall and the failed plugin disable no case had ever produced"
  - "A reconcile owner that reads no production source text: all eight regular-expression pins on other modules' comments are gone"
affects: [116, 117]

actuals:
  tokens: 59023
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Give a dual-mode entrypoint a mode-discriminated overload so the caller's status read narrows without a non-null assertion; the guard then disappears because nothing needs it, not because it was silenced"
    - "Provoke a documented cross-process race by answering one file's reads with the competitor's bytes from the Nth read onward, stating the read order in the case so a change in that order fails loudly"
    - "Make one directory read-only through the same hook that removes the tree, so a permission-refusal case still tears down"
    - "When rendered blocks are sorted, prove drive order with a collaborator log that is not sorted -- the ordered clone list, or the plugin-row order inside one block"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Delivered the producer narrowing and the guard deletion as one commit that also drops the single test case pinning the deleted comment wording, because leaving that case behind would have left the commit boundary red"
  - "Found the marketplace-add, plugin-install and plugin-toggle catch clauses unreachable and removed all three; kept the removal and uninstall clauses and proved both with a real competing-writer race"
  - "Proved the converge and not-added arms with a filesystem-boundary double rather than deleting them: both are documented concurrent-removal races, so deleting either would have changed behavior"
  - "Reported rather than papered over the one plant that stayed green: the documented remove-before-add ordering has no discriminating input because the planner makes those two buckets disjoint"

patterns-established:
  - "A comparison against undefined on a narrowed value is NOT a typecheck failure; the gate that catches a re-added dropped-row guard is the type-aware lint rule, so name the gate the plant actually turns red"
  - "A catch clause around a collaborator that answers every throw with a typed outcome is unreachable, but unlike a never-typed switch arm nothing enforces that contract afterwards -- record the residual exposure"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "orchestrators/reconcile/apply.ts reaches 100 percent direct functions, lines and branches with its owner run alone, and carries no coverage exception"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts -> branches 117/117, functions 21/21, lines 916/916"
        status: pass
      - kind: unit
        ref: "rg 'c8 ignore|node:coverage ignore' extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts -> 0 hits"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three producers carry the mode-discriminated overload, the three no-outcome guards are gone, and no completed pair's test changed"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "planted violation: removing each narrow overload turns npm run typecheck red at the cascade's status read (TS2345 / TS18048); all three restored"
        status: pass
      - kind: unit
        ref: "planted violation: re-adding an if (result === undefined) continue guard is an error at npm run lint (@typescript-eslint/no-unnecessary-condition); reverted"
        status: pass
      - kind: unit
        ref: "node --test over marketplace/add, marketplace/remove, plugin/uninstall, plugin/bootstrap and import/execute -> 185 tests, 185 pass, all five unmodified (git diff --quiet -- tests/ exit 0)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct on all three producers -> add 129/129 branches, remove 97/97, uninstall 77/77, each still complete"
        status: pass
    human_judgment: false
  - id: D3
    description: "All fifteen cascade outcome kinds and all four planner diagnostic causes are produced, each cell asserting the complete aggregated result and the complete on-disk state"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts (43 case bodies, 49 runtime cases); the header records which cell produces each kind"
        status: pass
      - kind: unit
        ref: "planted violation: reporting a partial removal as a plain failure, dropping a removal's uninstalled children, dropping its failed children, and reporting a dangling reference as a byte mismatch each turn the suite red; all reverted"
        status: pass
    human_judgment: false
  - id: D4
    description: "Continuation holds with the failing entry first and in middle position, proved against an ordered collaborator log"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "three declaration orders for the marketplace adds, two fault positions for the uninstalls and two for the installs, each asserting the complete cascade and the complete record set"
        status: pass
      - kind: unit
        ref: "planted violation: driving the installs before the adds, and fanning out user scope first, each turn the suite red; both reverted"
        status: pass
    human_judgment: false
  - id: D5
    description: "No case reads production source text, and the correspondence gate reports nothing under tests/orchestrators/reconcile/ or tests/orchestrators/import/"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node scripts/check-corresponding-tests.mjs -> exactly 14 violations, all deferred to Phases 116 and 117"
        status: pass
      - kind: unit
        ref: "rg 'assert\\.match|readFileSync|readFile\\(\"extensions|PR #' tests/orchestrators/reconcile/apply.test.ts -> 0 hits"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each of the five per-entry catch clauses is either proved by a real reachable throw route or removed with a recorded caller trace"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "planted violation: swallowing the removal throw and swallowing the uninstall throw each turn the suite red, so both surviving clauses are proved reachable; reverted"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct reports no zero-hit branch after the three unreachable clauses were removed"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-09-02
status: complete
---

# Phase 115 Plan 05: Reconcile Cascade Owner Summary

**The load-time reconcile cascade now proves all fifteen of its outcome kinds against a real
on-disk tree at 100 percent direct coverage — and the producer contract that used to be a
runtime guard is a compile-time one, which is what made the last three impossible branches
disappear rather than be silenced.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3, delivered in 2 commits
- **Cases:** 33 case bodies -> 43 case bodies (49 runtime cases, 2 top-level `describe()`)
- **Suite size:** 2540 -> 2823 lines
- **Direct coverage:** branches 74/105, functions 20/21, lines 805/964 -> **117/117, 21/21, 916/916**

## Task Commits

1. **Task 1: Narrow the three producers and delete the impossible guards** — `56c6bcec` (refactor)
2. **Tasks 2 and 3: Remove the source-text pins, normalize, and build the matrix** — `3b45c6e0` (test)

## D-115-10 — the producer contract is compile-time

`addMarketplace`, `removeMarketplace` and `uninstallPlugin` now carry the overload pair
`setPluginEnabled` already had: an orchestrated-mode signature returning the typed outcome with
no `undefined` member, then the wide signature, then the unchanged implementation. The three
`if (result === undefined)` guards in the cascade are gone, and the status read that follows
each call narrows with no non-null assertion.

### Caller trace, recorded per DEL-02

| Entrypoint | Call sites | Passes the orchestrated mode as a literal? |
| --- | --- | --- |
| `addMarketplace` | `edge/handlers/marketplace/add.ts:38`, `orchestrators/plugin/bootstrap.ts:103`, `orchestrators/import/execute.ts:720`, `orchestrators/reconcile/apply.ts:196` | only the import cascade and the reconcile cascade; the edge handler and the bootstrap composer are standalone |
| `removeMarketplace` | `edge/handlers/marketplace/remove.ts:37`, `orchestrators/reconcile/apply.ts` | only the reconcile cascade |
| `uninstallPlugin` | `edge/handlers/plugin/uninstall.ts:32`, `orchestrators/reconcile/apply.ts` | only the reconcile cascade |

The import cascade holds `addMarketplace` in a variable typed
`(opts: AddMarketplaceOptions) => Promise<AddMarketplaceOutcome | undefined>`
(`import/execute.ts:219`), which is why the wide signature stays last: an overloaded function is
assignable to a single-signature type through any one of its overloads, and that caller keeps
its `undefined` arm.

**The exception is operator-approved by D-115-10** and is type-level only. The blast radius was
confirmed, not assumed: the owner suites for `marketplace/add.ts`, `marketplace/remove.ts`,
`plugin/uninstall.ts`, `plugin/bootstrap.ts` and `import/execute.ts` pass **185/185 unmodified**,
`git diff --quiet -- tests/` exits 0 across Task 1, and all three producers keep complete direct
coverage.

### The compile-time claim, measured rather than assumed

The production comment on `setPluginEnabled` says the overload "makes that branch a compile
error". That is true of the *deletion*, not of a *re-addition*: TypeScript does not report
`TS2367` for `x === undefined` when `x` is non-nullable, so re-adding the guard typechecks
clean. The gate that turns red is `@typescript-eslint/no-unnecessary-condition`, which is
type-aware and inside `npm run lint`. Both directions were planted:

- Re-adding `if (result === undefined) { continue; }` after the removal call — **green at
  `npm run typecheck`, red at `npm run lint`**.
- Removing each narrow overload — **red at `npm run typecheck`**: `TS2345` at
  `foldRemoveOutcome(result, …)`, five `TS18048` at the add loop's status reads, five more at the
  uninstall loop's.

The guarantee holds; it is enforced one gate over from where the comment implies. Recorded here
so the next reader does not re-derive it.

## D-115-07 / D-115-08 — the exhaustive matrix

All fifteen outcome kinds are produced, plus `plugin-backfilled`. The three the suite had never
produced now have cells:

- **`mp-remove-partial`** — a removal that unstages one plugin and is refused on another, and a
  removal refused on its only plugin. Both render the bare `(failed)` header with per-plugin
  children, which is also the only producer of `plugin-uninstall-failed` under a removal.
- **`plugin-uninstall-failed`** — a refused unstage in the direct uninstall bucket, in first and
  in middle position, and the children of the partial removal.
- **`plugin-disable-failed`** — a refused unstage on the disable path, beside a sibling that
  disables cleanly.

All four planner diagnostic causes ride one cascade: a recorded source that differs from the
declaration, an unrecognized recorded source, a plugin declared under an undeclared marketplace
(the only cause that attributes a plugin child), and a plugin key with no marketplace half.

**Every fault is shaped on disk**, never injected into `apply.ts`: an unparseable configuration,
a schema-invalid local configuration, an unparseable state file, a pre-held advisory lock, a
read-only scope directory, a read-only hooks directory, a plugin source tree that is not there, a
marketplace source directory that is not there, and a git fake whose clone cannot reach its
remote. The only doubles are the git edge and the two Pi surfaces.

Every cell asserts the complete notification array, the complete state record read back through
the persistence loader, and — where the cell is about materialization — the complete scope-root
inventory through the shared `tests/orchestrators/plugin/scope-tree-inventory.ts` helper
(imported read-only, unmodified) plus the bytes of the configuration files the case must not
change.

## D-115-09 — continuation

Folded into the failure cells rather than added on top. The marketplace adds are a three-row
table over the declaration orders *first*, *middle* and *last*, all sharing one expected
aggregate — position-independence stated as the equality it is. The uninstalls and the installs
are two-row tables whose expected rows differ by position, because plugin rows inside a
marketplace block keep drive order while the blocks themselves sort by name. That row order is
the ordered collaborator log for the plugin buckets; the ordered clone list is the log for the
marketplace buckets and for the scope fan-out.

## Catch-arm disposition

Read each producer for statements outside its own guarded region.

| Clause | Verdict | Evidence |
| --- | --- | --- |
| `applyMarketplaceRemoves` | **reachable, kept and proved** | `removeMarketplace` resolves its scope through `loadState` *before* entering its guard (`remove.ts:660`), and rethrows anything that is not its own configuration sentinel (the catch at `remove.ts:704`). A state file another process is mid-write reaches the cascade. |
| `applyPluginUninstalls` | **reachable, kept and proved** | `uninstallPlugin` calls `resolveCrossScopePluginTarget` before any try (`uninstall.ts:492`), and that helper loads state. Same route. |
| `applyMarketplaceAdds` | **unreachable, removed** | pre-try is `locationsFor` (path joins only) and `parsePluginSource` (returns `{kind:"unknown"}`, never throws); the guarded region's catch routes every classified *and* unclassified error through `handleAddFailure`, which returns a typed outcome whenever orchestrated; the post-try cache invalidation and mirror seeding each swallow their own failures. |
| `applyPluginInstalls` | **unreachable, removed** | `installPlugin` documents that it never re-throws. Its whole body is one try (`install.ts:1992-2276`) whose catch returns a typed outcome in orchestrated mode, and the only awaited statement after that catch is `collectPostCommitWarnings`, every branch of which is internally guarded. |
| `applyPluginToggles` | **unreachable, removed** | `setPluginEnabled` wraps its cross-scope resolution in one try and its transaction in another (`enable-disable.ts:588`, `:636`), both returning typed failures in orchestrated mode; what follows is `outcomeToTypedResult`, a pure mapping. |

Both surviving clauses are proved by a real competing writer, and both removals were confirmed
by the coverage gate reporting no zero-hit branch afterwards. The five downstream owner suites
were re-run after the removals: **308 tests, 308 pass**.

**Residual exposure, recorded in `.planning/WINDOWS.md`.** Unlike the never-typed switch arms
Phases 115-02 and 115-07 removed, nothing enforces the "never re-throws" contract of those three
entrypoints afterwards. A throw later added outside one of their guarded regions would abort the
whole reconcile instead of surfacing one failed row. The ledger entry says so.

## The eight source-text pins

Read all eight before deleting any. Seven target modules this pair does not own; the eighth
matched a comment that D-115-10 has now deleted. **Every disposition is deletion**, and none
encodes a durable rule that is not already gated elsewhere.

| Case | Read | Disposition |
| --- | --- | --- |
| `S6` fail-loud wording at three loops | `reconcile/apply.ts` | Delete — obsolete. The wording is gone with the guards; the contract it approximated is now the overload. |
| `S4` decision-anchored comment at three call sites | `plugin/install.ts`, `plugin/enable-disable.ts`, `plugin/shared.ts` | Delete — a comment-presence audit has no violation to plant. |
| `S8` narrowed block status and deleted defensive throw | `reconcile/notify.ts` | Delete — 115-07 replaced it with a compile-time table pin in notify's own owner and proved it by planting a fourth status token. |
| `SEV-02` severity reducer parameter shape | `shared/notify.ts` | Delete — the durable rule (severity is caller-stamped, never inferred from status or reasons) is behavior of `shared/notify.ts`, whose own owner is the single oracle for it under D-20. Not this pair's to hold, and not an import or call-graph rule, so not a `tests/architecture/` gate either. |
| `S10` cast comment references the validator backstop | `persistence/config-write-back.ts` | Delete — a comment-presence audit. |
| `Y7` entry point composes `errorMessage(err)` | `index.ts` | Delete — behavior of `index.ts`, whose pair is Phase 117 work. |

Nothing was re-homed under `tests/architecture/`: that directory gates import boundaries and
call-graph reach, and none of the eight expressed a rule of that kind. The architecture suite is
green and unchanged (**198 tests, 198 pass**).

## Retitling

All fourteen titles that carried a merged-pull-request reference or named an internal code shape
are gone with the rewrite. Every title now states what a caller or user observes; the durable
decision anchors (`RECON-nn`, `WR-nn`, `DFEN-nn`, `ENBL-nn`, `D-115-10`) live in titles and
comments where they are traceability, not process history. No `Phase`, `Plan`, `Wave` or `PR #`
token appears in either pair member.

## Suite hygiene

- Every case takes a `createHermeticScopes(t, label)` pair of roots, with the `HOME` restore, the
  agent-directory restore, the read-only-directory restore and both tree removals in **one**
  `t.after()` registered before the act phase. The old `withHermeticHome` wrapper restored in a
  `finally` and left a case that threw mid-act with a read-only directory it could not remove.
- The notification boundary is three strict `strong-mock` mocks sized to the promised emission
  count, with `verifyBoundary()` after the state assertions. Four cases promise **zero**
  emissions, which is how the load-time silence contract is proved: a call throws where it is
  made.
- `createOfflineGitOps` admits no remote at all, so any git reach fails the case. Every cell
  asserts the complete ordered clone list, empty in all but two.
- No double is built by casting through `unknown`; no `as any`; no wildcard matcher; no
  unbounded-count expectation.

## Planted violations

Thirty-three plants were run against the production source, each applied, measured and reverted.
`git diff` against the committed tree is empty.

| Plant | Result |
| --- | --- |
| overload removal on `removeMarketplace` / `addMarketplace` / `uninstallPlugin` | RED (typecheck) ×3 |
| re-add the dropped-row guard after the removal call | GREEN at typecheck, **RED at lint** |
| report a partial removal as a plain failure | RED |
| drop the uninstalled children of a clean removal | RED |
| drop the failed children of a partial removal | RED |
| render a row for a converge another process won | RED |
| swallow an unexpected removal throw | RED |
| swallow an unexpected uninstall throw | RED |
| report an install that landed disabled as installed | RED (typecheck) |
| drop the orphan-rewake propagation on the install row | RED |
| drop the degraded-kind propagation on the install row | RED |
| drop each of the five enable degradation signals | RED ×5 |
| never carry the degradation signals onto the enabled row | RED (typecheck) |
| record a non-added marketplace outcome as added | RED (typecheck) |
| drop the version from the uninstalled row | RED |
| report a dangling reference as a byte mismatch | RED |
| drop the pristine-scope gate in the read pass | RED (typecheck) |
| drop the pristine-scope gate in the routing rebuild | RED |
| ignore an invalid local configuration | RED (typecheck) |
| emit a cascade even when nothing happened | RED |
| skip a scope's invalid-block rows | RED |
| attribute every read-pass throw to the state file | RED |
| swallow the post-cascade hygiene warnings | RED |
| always use the plural post-install header | RED |
| leak the absolute path in a warning | RED |
| ignore the warnings a disabled install produced | RED |
| drive the plugin installs before the marketplace adds | RED (after strengthening) |
| fan out user scope before project scope | RED (after strengthening) |
| drive the marketplace adds before the removals | **GREEN — reported below** |

### Two plants stayed green. Both were fixed. One remains, and is reported.

**1. Scope fan-out order was not discriminated.** The fan-out case asserted the cascade, but the
projection sorts blocks by name and then by scope, so reversing the loop changed nothing.
Fixed by adding a case whose two scopes both declare a git-source marketplace: the ordered clone
list is not sorted, and it now pins project before user. The plant is red.

**2. Add-before-install was not discriminated.** No case declared a marketplace and a plugin
under it in the same pass, so the one ordering with a real data dependency was untested. Fixed by
adding that case: swapping the two makes the install fail with the marketplace still absent. The
plant is red.

**3. The remove-before-add ordering has no discriminating input — reported, not papered over.**
Swapping `applyMarketplaceRemoves` and `applyMarketplaceAdds` leaves the suite green. The reason
is structural: a marketplace reaches the removal bucket only when it is recorded and *not*
declared, and the add bucket only when it is declared and *not* recorded, so no name can be in
both and neither step establishes a precondition for the other. The header's ordering rationale
is real for uninstall-before-remove (smallest cascade footprint) and for add-before-install (a
genuine data dependency, now pinned); for remove-versus-add it is a convention no behavior can
distinguish. Recorded in `.planning/WINDOWS.md` rather than resolved here, because changing the
documented order is not this pair's call.

## Deviations from Plan

**1. [Process] Task 1's commit also deletes one owner case**

- **Found during:** Task 1's verification
- **Issue:** Task 1's gate asks for `git diff --quiet -- tests/` *and* a green
  `apply.test.ts`. Those are contradictory: one of the eight source-text cases asserted the
  fail-loud comment wording that D-115-10 deletes, so removing the guards necessarily reddens it.
- **Fix:** Deleted that single case — one of the eight the plan mandates removing anyway — inside
  Task 1's commit, so no commit boundary is red. The other five downstream suites still satisfy
  the unmodified requirement literally.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Commit:** `56c6bcec`

**2. [Process] Tasks 2 and 3 landed in one commit**

- **Found during:** Task 2
- **Issue:** The plan splits normalization from matrix construction. Every surviving behavior
  became a matrix cell, so splitting would have meant writing the same 43 case bodies twice.
- **Fix:** One rewrite commit. Both tasks' acceptance criteria were checked at the same boundary:
  no source-text read, no pull-request reference, contract-shaped phases, complete-value
  assertions, all fifteen kinds, and complete direct coverage. Same precedent as 115-02 and
  115-07.
- **Commit:** `3b45c6e0`

**3. [Rule 3 — Blocking] The plan's assumed reachable throw route does not exist**

- **Found during:** Task 3's catch-arm disposition
- **Issue:** The research proposed reaching the marketplace-add catch through a source string
  `parsePluginSource` rejects. `parsePluginSource` never throws — it returns
  `{ kind: "unknown", reason }` for every malformed input. An unsafe recorded *name* looked
  promising for the removal catch, but `removePath` awaits the path promise **inside** its own
  swallowing try, so the containment failure never escapes either.
- **Fix:** Found the real route by reading each producer's pre-guard region: both surviving
  clauses are reached when the target resolution meets a state file another process is mid-write.
  The two cases provoke exactly that.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Commit:** `3b45c6e0`

**4. [Rule 3 — Blocking] The plan's routing-rebuild and backfill isolation cells are not this
pair's branches**

- **Found during:** Task 3's coverage measurement
- **Issue:** The plan asks for an isolated backfill throw and an isolated routing-rebuild throw
  as separate cells. `runScopeIsolated` lives in `backfill.ts` and has its own owner; the only
  branch `apply.ts` holds on that path is the routing rebuild's pristine-scope gate.
- **Fix:** Covered both arms of that gate, and the rebuild's own isolated failure now rides the
  two competing-writer cases for free — their cascades carry the rebuild's `state.json` row
  alongside the collaborator's, which is asserted as part of the complete aggregate.
- **Commit:** `3b45c6e0`

**5. [Process] Two matrix cells are proved through a filesystem-boundary double**

- **Found during:** Task 3
- **Issue:** The converge arm and the marketplace not-found arm are, by their own production
  comments, *exclusively* concurrent-removal races: the planner derives its buckets from the very
  state the orchestrator re-reads under its lock, so no single-process input can separate them.
  Deleting either would have changed behavior — a converge would start rendering a false
  `(uninstalled)` row, in direct contradiction of WR-06.
- **Fix:** Answered `state.json` reads for one scope with the competitor's bytes from a stated
  read onward, using the `t.mock.method` + `syncBuiltinESMExports` idiom that
  `tests/orchestrators/plugin/uninstall.test.ts` already uses for its retry proofs. No seam was
  added to `apply.ts`; the double sits at the filesystem boundary the persistence layer reads
  through, and each case names the read order it depends on.
- **Commit:** `3b45c6e0`

## Verification

Every gate was run separately, because `npm run check` short-circuits at `format:check` on
pre-existing untracked files this plan must not touch.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm exec -- eslint <both pair members>` | exit 0 |
| Fallow (dead-code, health, dupes) | `npm run fallow` | exit 0 (read as an exit status; its `✗` duplication line is informational and names no file from this plan) |
| Prettier | `npm exec -- prettier --check <both pair members>` | exit 0 |
| Unit suite | `npm test` | exit 0 — 4832 tests, 4832 pass, 0 fail |
| Integration suite | `npm run test:integration` | exit 0 — 30 tests, 30 pass |
| Architecture suite | `node --test "tests/architecture/**/*.test.ts"` | 198 tests, 198 pass |
| Owner suite | `node --test tests/orchestrators/reconcile/apply.test.ts` | 49 tests, 49 pass |
| Direct coverage (this pair) | `npm run test:coverage:direct -- …/reconcile/apply.ts` | **branches 117/117, functions 21/21, lines 916/916** |
| Direct coverage (three producers) | same, per file | add 129/129, remove 97/97, uninstall 77/77 — all unchanged |
| Downstream owners | `node --test` over add, remove, uninstall, bootstrap, import/execute, notify, backfill, pending | 308 tests, 308 pass, none modified |
| Correspondence gate | `node scripts/check-corresponding-tests.mjs` | **exactly 14 violations**, none under `tests/orchestrators/import/` or `tests/orchestrators/reconcile/` |
| Negative controls | `npm run test:coverage:direct:negative`, `npm run test:corresponding:negative` | exit 0, exit 0 |
| Prohibited patterns | `rg` for `only/skip/todo`, `c8 ignore`, `as unknown as`, `as any`, `anyTimes()`, `It.isAny()`, `verifyAll(`, capitalized phase markers, `assert.match`, `PR #`, `readFileSync`, source reads | 0 hits |
| Phase markers | 43 `// arrange`, 43 `// act`, 43 `// assert`, 43 case bodies, 2 top-level `describe()` | balanced |
| Secrets | trufflehog `filesystem` over both changed paths, `--results=verified,unknown --fail` | 0 verified, 0 unverified |
| Scoped hooks | `pre-commit run --files <changed paths>` | every hook passes except the two known ones: TruffleHog's git-mode abort (structural in a linked worktree, covered by the filesystem scan) and `npm format check` on the operator-owned untracked files |

The correspondence gate's fourteen remaining violations are the six `missing-test` entries under
`tests/edge/` plus `tests/index.test.ts`, and the eight `unexpected-test` entries — all deferred
to Phases 116 and 117. **All four violations Phase 115 owned are closed.**

## Broken-Windows Ledger

- **Entry 6 closed.** The apply-tier facts orphaned when the backfill owner stopped driving
  `applyReconcile` now have an owner here: one cascade carries a promotion row beside a fresh
  install row, the rendered `(installed)` and `(failed)` row bytes are asserted as complete
  message literals in thirty-odd cells, and the absent reload trailer is enforced structurally —
  every one of those literals would break if the trailer appeared.
- **Two new entries recorded**, both `deviation`: the residual exposure from the three removed
  catch clauses, and the remove-before-add ordering that no input discriminates.

## Known Stubs

None.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or trust-boundary schema change was
introduced. The plan's six threats are discharged as designed:

- **T-115-05-A** — the producer change is type-level only, all five downstream owner suites pass
  unmodified, and all three producers keep complete direct coverage.
- **T-115-05-B** — the overload turns a dropped row into a gate failure; the direction was
  measured in both directions and the effective gate named.
- **T-115-05-C** — `createOfflineGitOps` admits no remote; the two cases that do reach git admit
  exactly the URLs they use and assert the complete ordered clone list.
- **T-115-05-D** — one temporary root pair per case, removed with both environment restores and
  every read-only directory restored in one hook registered before the act phase; every
  materializing cell asserts the complete scope-root inventory and the bytes of the files it must
  not change.
- **T-115-05-E** — the failure cells feed malformed configuration, unparseable state and
  unparseable sources through the real validators rather than around them.
- **T-115-05-F** — each of the eight source-text pins has a recorded disposition above.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` — FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — FOUND
- `tests/orchestrators/reconcile/apply.test.ts` — FOUND
- `.planning/phases/115-composition-orchestrators/115-05-SUMMARY.md` — FOUND
- Commit `56c6bcec` — FOUND in `git log`
- Commit `3b45c6e0` — FOUND in `git log`
