---
phase: 08-direct-coverage
plan: 06
subsystem: testing
tags: [node-test, dependency-injection, test-doubles, filesystem, rollback, leak-messages]

requires:
  - phase: 08-direct-coverage
    provides: "08-05's removal port, `createRemovalOpsFake`, and the measured residual-patching census this plan spends and re-derives"
  - phase: 06-assertion-and-module-refinement
    provides: "G1's recorded override — the interleaved leak-message ordering and the leaked-residue partition, deferred by name with the technical blocker independently confirmed"
provides:
  - "`06-VERIFICATION.md` G1's open remainder closed by observation: an ordered whole-value leak array and a two-sided residue partition, per bridge"
  - "`createDelegatingRemovalOps` — a recording decorator over a real collaborator, so a case can state which removals really happened on disk"
  - "every `rm` and `rename` fault that reaches `cleanupStaging` or `rollbackReplacementCommon` injected through the collaborator, in all four owner tests"
  - "a re-derived residual builtin-module and prototype patching census, with its open rows named and the decision that leaves each open"
affects: [08-07, 08-09, direct-coverage, g1-leak-assertions]

actuals:
  tokens: 8865
  tasks: 3
  commits: 2
  plan_head_before: 4417abf0a2efc6a7e57db46613e1fcd1eb286106

tech-stack:
  added: []
  patterns:
    - "Two doubles for one port, split by the question asked: an in-memory model when every call is faulted, a recording decorator when the case must read real disk state"
    - "Destination-keyed fault injection: a restore whose source path is minted by an unported forward call is faulted on the destination it restores to"
    - "Ordered whole-value leak arrays: one message per leaking stage, compared as a complete value, so a reordering regression cannot pass"

key-files:
  created: []
  modified:
    - tests/platform/removal-ops-fake.ts
    - tests/shared/fs-utils.test.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/commands/stage.test.ts
    - tests/bridges/agents/stage.test.ts

key-decisions:
  - "The residue partition is read from real disk state through a delegating collaborator, not from the in-memory fake's entry map: the fake removes nothing, so the unfaulted half of the partition is unstatable through it"
  - "The delegating decorator lives in the existing `tests/platform/removal-ops-fake.ts` rather than a new support file, keeping one concern owner and one pairing"
  - "The skills manual-recovery case keys its restore fault on the rename DESTINATION, because the source backup path is minted inside `replacePreparedSkills`' own unported forward rename"
  - "The agents case leaves the index-restore hook succeeding rather than forcing it to leak: making it fail requires an absent previous index, which would also empty `_previousEntries` and delete the backup stage the ordering proof needs"
  - "`RCOV-02` stays Pending — 08-07 and 08-09 still carry it, and this phase's convention is that the last contributing plan flips it"

patterns-established:
  - "Plant the ordering regression, not a behavior regression: `Object.freeze([...leaks].reverse())` changes only message order, so it proves a whole-value ordered assertion catches what a length or membership check would not"
  - "Two plants for a two-sided partition: dropping the sibling cleanup call proves the 'absent' half, bypassing the port inside the failure arm proves the 'still present' half"

requirements-completed: []

coverage:
  - id: D1
    description: "A replacement rollback's leak messages arrive one per failing stage, in the order the stages ran, and the complete array is asserted as one value"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#reports one leak per failed stage in stage order and leaves only the blocked roots"
        status: pass
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#reports one leak per failed stage in stage order and leaves only the blocked roots"
        status: pass
      - kind: unit
        ref: "tests/bridges/agents/stage.test.ts#reports one leak per failed stage in stage order and leaves only the blocked roots"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cleanup that failed leaves its root on disk and a cleanup that succeeded leaves its root absent; both halves are asserted in the same case"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "tests/bridges/{skills,commands,agents}/stage.test.ts#reports one leak per failed stage in stage order and leaves only the blocked roots (stagingPresent true / backupPresent false)"
        status: pass
      - kind: automated_ui
        ref: "planted: drop the backupRoot cleanup call -> the backup-absent half fails red in all three bridges; reverted, green"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every `rm` and `rename` fault the removal port reaches is injected through the collaborator, in all four owner tests"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "tests/shared/fs-utils.test.ts holds exactly four `t.mock.method(fs,` sites, and their verbs are lstat, lstat, stat, readdir"
        status: pass
      - kind: automated_ui
        ref: "tests/bridges/skills/stage.test.ts holds five patches, each on a `cp`, `stat`, or direct `rm`/`rename` the port does not carry"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both restored contracts go red against the exact regression they claim to catch and green again after reverting"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "three plants, each confirmed red on its named assertion and reverted; `git status --porcelain -- extensions/` empty afterwards"
        status: pass
    human_judgment: false
  - id: D5
    description: "The four owner pairs read complete under the direct-coverage gate"
    requirement: RCOV-02
    verification:
      - kind: automated_ui
        ref: "node scripts/test-coverage-direct.mjs over shared/fs-utils.ts and the three bridge stage.ts modules -> Direct coverage passed for all four"
        status: pass
    human_judgment: false

duration: 84min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 06: G1's Two Proofs Summary

**A replacement rollback's leak messages are asserted as one complete ordered array per bridge, and the same case reads both halves of the leaked-residue partition off real disk — the blocked staging root still there, the unblocked backup root gone — with every fault injected through the removal port instead of a patched builtin.**

## Performance

- **Duration:** 84 min
- **Started:** 2026-09-11T04:55:07Z
- **Completed:** 2026-09-11T06:19:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- Restored G1's **ordering** proof in all three bridges. Each new case faults three of a replacement rollback's four removals — the renamed replacement's `rm`, the backup's restore `rename`, the staging root's cleanup `rm` — and asserts the resulting three-element array with one `assert.deepStrictEqual`, in the order the stages ran. The messages are built from the same paths the fault map is keyed on, so a fault and its expected message cannot drift apart.
- Restored G1's **partition** proof in the same cases, read from real disk: the faulted staging root is still a directory, the unfaulted backup root is gone, and the replacement whose removal was blocked still holds its post-replacement bytes. The agents case additionally pins the index restore, which runs between the restore stage and the cleanups.
- Converted every fault that reaches `cleanupStaging` or `rollbackReplacementCommon`. `tests/shared/fs-utils.test.ts` went from six port-verb patches to zero; `tests/bridges/skills/stage.test.ts` went from two port-reachable cases to zero. Four `lstat`/`stat`/`readdir` patches and five non-port `cp`/`stat`/`rm`/`rename` patches survive, each named in its file's header note with the production helper it faults and the decision that leaves it unported.
- Added `createDelegatingRemovalOps` beside the in-memory fake: it answers seeded faults and forwards everything else to a collaborator the case supplies, and records both verbs in one interleaved log. It imports no filesystem module — the real collaborator arrives as a parameter — so the fake file's containment property is unchanged.
- Proved all three restored contracts by planting and reverting, the method `06-VERIFICATION.md` used to close its other twelve gaps. Each plant turned exactly the named assertion red; `git status --porcelain -- extensions/` is empty and the four suites are green again.
- Re-derived the residual patching census from the tree rather than inheriting 08-05's. It grew, because the measurement widened past `node:fs/promises` to every builtin-namespace, prototype, and `globalThis` patch: 20 `node:https` network guards and a dozen prototype patches were never in anyone's count.

## Task Commits

1. **Task 1: Convert every rm and rename fault in tests/shared/fs-utils.test.ts to the port** — `6eadef13` (test)
2. **Task 2: Restore the interleaved leak-message ordering proof across the three bridges** — `3d6aceed` (test)
3. **Task 3: Prove each restored proof catches its regression, and record the residual census** — this document; its metadata commit follows. The measured `commits: 2` counts the two task commits present when this file was written.

## Files Created/Modified

**Modified — test support**

- `tests/platform/removal-ops-fake.ts` — adds `createDelegatingRemovalOps`, `DelegatingRemovalOpsOptions`, `DelegatingRemovalOps`, and `RemovalOpsOperation`. The header now states which double answers which question.

**Modified — owner tests**

- `tests/shared/fs-utils.test.ts` — six conversions; the reverse-order case now reads its interleaved log from the decorator and compares it structurally; header note records the four surviving patches.
- `tests/bridges/skills/stage.test.ts` — one new case, two conversions (the finalize pair, and the manual-recovery case's `rm` plus destination-keyed restore), header note rewritten to classify all five survivors. 29 cases became 30.
- `tests/bridges/commands/stage.test.ts` — one new case. 25 cases became 26.
- `tests/bridges/agents/stage.test.ts` — one new case, written fresh against the collaborator. 32 cases became 33.

## Decisions Made

1. **The partition is read from real disk, so it needs a delegating collaborator.** `createRemovalOpsFake` performs no filesystem work by design, which is exactly what makes it unable to state the partition's second half: a sibling root it was "asked" to remove is still on disk afterwards, so `absent` is false for both the faulted and the unfaulted target. The new decorator answers the seeded faults itself and forwards the rest to `createRemovalOps()`, which is what the deleted G1 test's `if (target === X) throw; else original(...)` structure did — minus the patched builtin. The plan's acceptance criterion names `createRemovalOpsFake` for the ordering case; the in-memory fake is used where every call is faulted (the `fs-utils` five-leak case, the skills finalize pair) and the decorator where disk state is the claim.

2. **The decorator lives in the existing fake module.** A new `tests/platform/removal-ops-*.ts` would add a support file to a directory that already owns this concern, and the project's rule is to keep fakes beside the tests of the concern they serve. Three inline copies of the same 12-line decorator across three bridge tests would also have been a duplication finding.

3. **The skills manual-recovery case keys its restore fault on the destination.** Its two faults must be seeded before `replacePreparedSkills` runs, and the backup path they would key on is minted inside that same call's unported forward `rename`. The destination — the target the backup is restored to — is known from the fixture. `renameDestinationErrors` exists for that one reason and says so in its doc comment. The case still asserts the full two-element leak array, and now also asserts that the observed restore source is a `backup-`-prefixed directory inside the bridge's own staging area.

4. **The agents index-restore hook succeeds rather than leaks.** Forcing a leak from it requires an absent previous index (`restoreAgentsIndex`'s `rm` arm, the deterministic one), but an absent index also empties `_previousEntries`, which deletes the backup and therefore the restore stage the ordering proof needs. The hook's own leak is already proved in isolation by "reports an index restoration leak and still removes replacement files". The new case pins its position instead: the index is restored to its previous bytes, between the restore stage and the cleanups, contributing no message.

5. **`RCOV-02` stays Pending.** Seven plans in this phase carry it and two have not run. 08-02, 08-03 and 08-05 all reverted the automatic flip; this plan does not flip it either, and `requirements-completed` is empty rather than asserting a completion this plan does not own.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The partition criterion and the fake-only criterion cannot both be met by one double

- **Found during:** Task 2, designing the new cases
- **Issue:** Task 2's criteria require both "faults two or more rollback stages through `createRemovalOpsFake`" and "a faulted target still present on disk and an unfaulted sibling target absent". The in-memory fake removes nothing, so after it runs, both targets are still on disk and the partition's second half is false for a correct implementation.
- **Fix:** Added `createDelegatingRemovalOps` to the same support module and used it for the three new cases and the manual-recovery conversion; `createRemovalOpsFake` carries the conversions where every call is faulted. The fault-injection mechanism is still the removal-ops module's per-target map, and no builtin patch was reintroduced.
- **Files modified:** `tests/platform/removal-ops-fake.ts`
- **Verification:** `npm run check` exits 0; the three plants below turn only the named assertions red.
- **Committed in:** `6eadef13`, `3d6aceed`

### 2. [Scope] One file outside `files_modified`

- **Found during:** Task 1
- **Issue:** `tests/platform/removal-ops-fake.ts` is not in the plan's `files_modified`, which lists the four owner tests.
- **Fix:** Modified it anyway, additively. The plan's blast-radius verification forbids files under `extensions/`, and no file under `extensions/` is touched; the support module is the concern owner the plan's own key_links name.
- **Files modified:** `tests/platform/removal-ops-fake.ts`
- **Verification:** `git diff $PLAN_BASE..HEAD --name-only` lists five files, none under `extensions/`.
- **Committed in:** `6eadef13`

### 3. [Measurement] `actuals.tokens` is on a different scale than 08-05's

- **Found during:** writing this summary
- **Issue:** `actuals.tokens: 8865` is `estimateTokens` (chars/4) over the realized diff, the scale the executor protocol names. 08-05's `157916` is a harness context count. The two are not comparable, and a calibrator averaging them would be averaging measurement methods.
- **Fix:** Recorded the protocol's scale and named the mismatch here so the hazard is visible rather than silent.
- **Files modified:** none
- **Verification:** `git diff 4417abf0..HEAD | wc -c` = 35,458.
- **Committed in:** not a code change

---

**Total deviations:** 3 (1 Rule 3 blocking, 1 scope, 1 measurement)
**Impact on plan:** None on scope or on any production file. Five files changed, all under `tests/`.

## Plant-and-revert evidence

Each plant was applied alone, measured, then reverted before the next.

| # | Contract | Production mutation | What went red | After revert |
|---|---|---|---|---|
| 1 | Leak-message ordering | `rollbackReplacementCommon` returns `Object.freeze([...leaks].reverse())` — order only, every message and count unchanged | 5 cases, all on `assert.deepStrictEqual(leaks, expectedLeaks)`: the three new bridge cases, the skills manual-recovery case, and `fs-utils`' five-leak case. 129 of 134 still passed. A length or membership check would have passed | 134 pass, fail 0 |
| 2 | Residue partition, "the unfaulted sibling is gone" | deleted the `cleanupStaging(input.ops, input.backupRoot, …)` call | `backupPresent === false` in all three new cases, plus three pre-existing empty-staging-directory cases. The leak arrays were unaffected, because the backup root was never faulted | 89 pass, fail 0 |
| 3 | Residue partition, "the faulted target is still there" | `cleanupStaging`'s failure arm calls `fs.rm(dir, …)` directly before returning its leak message — a port bypass | `stagingPresent === true` in all three new cases, while the leak message still appeared | 89 pass, fail 0 |

`git status --porcelain -- extensions/` is empty after the pass. `npm run check` exits 0 (5,986 unit cases, 32 integration cases, fail 0).

## Residual builtin-module and prototype patching census (measured 2026-09-11)

`D-08-14` pins two files. The tree holds more, and the honest number is larger than 08-05's too — not because patching grew, but because this measurement covers every builtin-namespace, prototype, and `globalThis` patch rather than only `node:fs/promises`. Measured with `grep -rn "t\.mock\.method(" tests/ --include=*.ts` (142 sites total) plus `grep -rl "syncBuiltinESMExports\|createRequire" tests/`.

| file | what is patched | production call the fault lands on | port reaches it? | this phase |
|---|---|---|---|---|
| `tests/shared/fs-utils.test.ts` | `fs.lstat` ×2, `fs.stat`, `fs.readdir` | `pathExists`, `isPlainMarkdownFile`, `removeOrphanIfPresent`, `readDirEntriesTolerant` | **NO** — verbs outside the port (`D-08-13`); `removeOrphanIfPresent` unported by `D-08-A08` | **open**, by decision |
| `tests/shared/fs-utils.test.ts` | *(was `fs.rm` ×4, `fs.rename` ×2)* | `cleanupStaging`, `rollbackReplacementCommon` | YES | **CLOSED** |
| `tests/bridges/skills/stage.test.ts` | `cp`, `stat` | `prepareStageSkills`' per-skill copy, `commitPreparedSkills`' target inspection | **NO** — verbs outside the port | **open**, by decision |
| `tests/bridges/skills/stage.test.ts` | `rm`, `rename` ×2 | `commitPreparedSkills`' previous-dir removal and staged rename; `replacePreparedSkills`' forward backup rename | **NO** — direct calls the port deliberately does not carry | **open**, by decision |
| `tests/bridges/skills/stage.test.ts` | *(was `rm` ×2 in finalize, `rm` + `rename` in manual recovery)* | `cleanupStaging`, `rollbackReplacementCommon` | YES | **CLOSED** |
| `tests/orchestrators/plugin/uninstall.test.ts` | retry-`fs` `mkdir`, `readdir`, `rm`, `unlink` (via `createRequire` + `syncBuiltinESMExports`) | the `unstage*` removal path | **NO** — `D-08-13` leaves `unstage*` unported | open |
| `tests/orchestrators/marketplace/add.test.ts` | `path.dirname`, `path.basename` ×3 | clone-root and record-name derivation | **NO** — the port carries no `path` verb; `08-CONTEXT.md` records it as a deferred idea | open |
| `tests/platform/git.test.ts` | isomorphic-git `http.request` | the git transport | **NO** — not a filesystem verb | open |
| `tests/transaction/with-state-guard.test.ts` | `proper-lockfile` `lock` ×7 | lock acquisition | **NO** — not a filesystem verb | open |
| 20 sites across `tests/index.test.ts`, `tests/edge/**` | `node:https` `request` | the network-refusal guard each case installs | **NO** — a deliberate no-network assertion, not a fault seam | open |
| `tests/bridges/hooks/wire-protocol.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts` | `JSON.parse` | payload and state parsing | **NO** — a global, not a module | open |
| `tests/bridges/skills/frontmatter-degrade.test.ts` ×4, `rewrite-frontmatter.test.ts`, `tests/bridges/commands/stage.test.ts` ×3, `tests/bridges/hooks/if-field/index.test.ts` ×2, `tests/shared/redact-absolute-paths.test.ts` | `String.prototype` (`split`, `includes`, `startsWith`, `indexOf`, `endsWith`, `lastIndexOf`) | unreachable-branch probes in pure string logic | **NO** — a prototype patch, not a filesystem verb | open |
| `tests/bridges/hooks/dispatch-exec.test.ts` | `ChildProcess.prototype.once` | child-process wiring | **NO** | open |
| `tests/bridges/hooks/{exec-timer,dispatch-exec,async-rewake/registry}.test.ts`, `tests/domain/github-auth.test.ts`, `tests/orchestrators/edge-deps.test.ts` | `globalThis` members (`fetch`, `setTimeout`, `clearTimeout`) | timers and network | **NO** | open |
| many files | `console.error` / `console.warn` | diagnostic output capture | **NO** | open |

**The class is not closed, and this plan did not try to close it.** What it closed is the port-reachable subset: every `rm` and `rename` fault that lands on `cleanupStaging` or `rollbackReplacementCommon` now travels through the collaborator, in all four owner tests. Every remaining row is open for a stated reason — `D-08-13`'s two-verb membership, `D-08-A08`'s `removeOrphanIfPresent` exception, the `path` and `lstat`/`stat`/`readdir` deferrals `08-CONTEXT.md` records, or a verb that is not a filesystem verb at all.

One related in-tree record: `scripts/check-phase-06-hub-ledger.mjs` pins a residual census naming exactly `tests/bridges/skills/stage.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts`. Its membership is still accurate — both files still patch a builtin — but its call counts are arguments supplied by the caller, and the skills file now holds 6 `syncBuiltinESMExports` pairs rather than 8. Nothing in `npm run check` invokes that script.

## G1: closed by observation

`06-VERIFICATION.md` recorded G1 as twelve-of-thirteen closed, with the remainder an accepted override because the interleaved leak array and the leaked-residue partition were observable only through a re-patched `node:fs/promises`. Both halves are now observable through the injected port:

- **Ordering half** — `reports one leak per failed stage in stage order and leaves only the blocked roots` in `tests/bridges/skills/stage.test.ts`, `tests/bridges/commands/stage.test.ts`, and `tests/bridges/agents/stage.test.ts`, each asserting the complete array as one ordered value. `tests/shared/fs-utils.test.ts`'s `returns every failure leak in execution order` covers the shared helper's own five-message interleaving, including the `beforeCleanup` contributor, and now does so through the collaborator.
- **Partition half** — the same three cases, asserting `stagingPresent === true` and `backupPresent === false` from real disk state, plus the surviving replacement bytes.

The override in `06-VERIFICATION.md` can be retired: G1's remainder is closed by the same plant-and-revert method its other twelve gaps were closed with, not by a promise.

## Issues Encountered

- **The agents fixture needed the generated marker.** A previous target written as plain bytes is classified as foreign previous content and `replacePreparedAgents` refuses before any backup exists. The fixture now carries the `provenance.generatedBy` frontmatter the ownership check reads.
- **`08-PATTERNS.md`'s line numbers for the skills mock inventory are stale** (they predate 08-05's threading edits). The sites were re-located by grep rather than by the recorded line numbers; the classification the patterns document describes was accurate.

## Verification

| check | result |
|---|---|
| `node --test` over the four owner tests | 134 cases, `fail 0` (fs-utils 45, skills 30, commands 26, agents 33) |
| `# pass` not lower than before (fs-utils) | 45 before, 45 after |
| surviving `t.mock.method(fs,` verbs in `fs-utils.test.ts` | `{lstat: 2, stat: 1, readdir: 1}` — exactly the three non-port verbs |
| `assert.deepStrictEqual` count in `fs-utils.test.ts` | 15 before, 15 after; no leak-message literal removed |
| `node scripts/test-coverage-direct.mjs` ×4 | `Direct coverage passed` for `shared/fs-utils.ts` (52/52, 10/10, 394/394), `bridges/skills/stage.ts` (71/71, 11/11, 544/544), `bridges/commands/stage.ts` (76/76, 12/12, 523/523), `bridges/agents/stage.ts` (105/105, 25/25, 633/633) |
| `git status --porcelain -- extensions/` | empty |
| `git diff $PLAN_BASE..HEAD --name-only` | 5 files, none under `extensions/` |
| **`npm run check`** | **exit 0** — typecheck, lint, fallow, format, both corresponding gates, the direct-coverage negative control, 5,986 unit cases, 32 integration cases |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **08-07 is unaffected and still unblocked.** It drives `runInstallLedger`'s three `commitPrepared*` leak arms through `InstallLedgerOptions.removalOps`; the in-memory fake is the right double there, since a ledger test faults the cleanup and asserts the returned leak rather than disk residue. `createDelegatingRemovalOps` is available if it needs a sibling arm to really succeed.
- **`RCOV-02` is still Pending** and belongs to whichever plan runs last among the seven that carry it.
- **One open judgment for a reviewer:** deviation 1. If the intent was that the new cases use `createRemovalOpsFake` and give up the on-disk partition, that is a smaller test than the one G1 lost, and the ordering half alone would not restore the partition the override named.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*

## Self-Check: PASSED

All five modified files exist on disk; both task commits resolve in `git log`.
