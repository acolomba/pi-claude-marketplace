---
phase: 06-load-time-dependency-check-and-allowed-uninstall
plan: 03
subsystem: uninstall
tags: [uninstall, dependencies, closed-set-retirement, catalog, prune]
requires:
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    plan: 02
    provides: the load-time check that reports each named dependent unsatisfied at the next load
  - phase: 05-prune-on-uninstall
    provides: the scope declaration index, the offline declaration walk and the orphan sweep
provides:
  - an uninstall that removes a plugin other installed plugins still declare
  - the `dependents unsatisfied` closed-set reason and the success row that carries it
  - the retirement of the Phase 5 refusal token, its two catalog states and its fixtures
  - a cause trailer on the `uninstalled` row, on the `disabled` row's precedent
affects: [06-04, phase-08, phase-10]
actuals:
  tokens: 23700
  tasks: 3
  commits: 3
plan_head_before: 88caf2f0a0416a9e39b1e5e9723e6078b1531279
tech-stack:
  added: []
  patterns:
    - "A guard turned into a reading: the same walk, the same lock, a value returned instead of a throw"
    - "Two independent reason axes composed into one brace rather than one replacing the other"
    - "A closed-set retirement paid for by an addition in the same edit, so the count does not move"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - docs/dependency-resolution.md
key-decisions:
  - "D-06-06 CONFIRMED by the developer on 2026-09-18 as `proceed-as-decided`: the uninstall reports instead of refusing, and the fail-closed unreadable-declarer refusal is preserved"
  - "D-06-07 CONFIRMED in the same answer: the refusal token is RETIRED, not repurposed. This supersedes D-05-14, D-05-15 and D-05-16's dependents arm"
  - "D-06-18: a declarer the same `--prune` run sweeps is filtered out of the surviving set by CODE, not by the snapshot -- the plan's claim that the sharing of one snapshot already excluded it was measured false"
  - "D-06-19: the reconcile uninstall-failure outcome's `cause` field SURVIVES the retirement, because it also carries the D-05-07 refusal the phase preserved"
  - "D-06-20: the `uninstalled` row gains a cause trailer, mirroring what LOAD-01 did for the `disabled` row, because the dependents list interpolates identifiers and the cause chain is the only channel in this grammar that may"
patterns-established:
  - "Retire a closed-set member in the same edit that adds its replacement, and renumber the running count narrative rather than annotate the gap"
  - "When a plan says `add a test rather than code`, run the experiment: disable the code and confirm the test goes red"
requirements-completed: []
coverage:
  - id: D1
    description: "The uninstall proceeds when other installed records declare the target, and the record and its artifacts are gone afterwards"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: the uninstall proceeds while one installed plugin declares the target"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-06-06: the orchestrated uninstall of a still-declared plugin succeeds and names no dependents"
        status: pass
    human_judgment: false
  - id: D2
    description: "The success row is the info `(uninstalled)` row with its reload stamp, carrying the new token and a sorted cause line"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: two dependents are named on the cause line in sorted key order"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.messaging.test.ts#LOAD-03: composeUninstalledRow names the dependents on the cause line and stays an info reload row"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 217 exact documented states"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two reason axes compose rather than replace, in the stated order, and neither present is the byte-frozen bare row"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.messaging.test.ts#LOAD-03 / D-05-09: composeUninstalledRow says what the removal means for others before the data disposition"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.messaging.test.ts#D-02-01: composeUninstalledRow with no dependents and no kept data is the bare frozen row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: an installed sibling that declares nothing leaves the bare uninstalled row"
        status: pass
    human_judgment: false
  - id: D4
    description: "The D-05-07 fail-closed refusal survives, in both notification modes, and removes nothing"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-07: a record its marketplace manifest does not list refuses the uninstall"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-07: the orchestrated unreadable-declarer refusal still returns the typed failed outcome"
        status: pass
    human_judgment: false
  - id: D5
    description: "`--prune` is unchanged, and a member it sweeps is not named as a surviving dependent"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: a declarer the same --prune run sweeps is not named as a surviving dependent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: --prune sweeps the orphan while the surviving declarer is named on the primary row"
        status: pass
    human_judgment: false
  - id: D6
    description: "The reconcile-driven removal proceeds, keeps its bare row, and the next pass reports each dependent unsatisfied with the remedy"
    requirement: LOAD-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-03: a config-driven uninstall of a still-declared plugin proceeds and the next pass holds the dependent down"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-03: dropping a plugin and its dependent together converges in ONE pass in plain record order"
        status: pass
    human_judgment: false
  - id: D7
    description: "The retirement is total: the closed set holds 58 members with every pin agreeing, and the token is gone from the extension, the tests and the docs"
    requirement: LOAD-03
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 58-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: command
        ref: "grep -rn 'dependents remain' extensions/ tests/ docs/ scripts/ -- no matches"
        status: pass
    human_judgment: false
  - id: D8
    description: "The D-05-16 retry loop still earns its keep on the surviving refusal class, in both its arms"
    requirement: LOAD-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-16 / D-05-07: a removal refused by an unreadable declarer is retried after the rest of the pass and then settles"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-16 / D-05-07: a refusal that no retry can settle reports its own row and removes nothing"
        status: pass
    human_judgment: false
  - id: D9
    description: "A live Pi session confirms the removal and the next-reload consequence: uninstall a plugin another installed plugin declares, reload once, and see the dependent disabled with its remedy"
    requirement: LOAD-03
    verification:
      - kind: manual_procedural
        ref: "a live Pi session: install two plugins where one declares the other, uninstall the dependency, read the row, /reload once, confirm the dependent is disabled and named"
        status: unknown
    human_judgment: true
    rationale: "The suite drives the real removal and the real next-pass disable against a temporary tree and asserts both rows byte for byte, but nothing automated proves an operator reading the two rows in sequence understands the consequence as intended. That judgment is the point of the row, and it is the same UAT gap 06-01 and 06-02 each recorded for their own arms."
duration: 45min
completed: 2026-09-18
status: complete
---

# Phase 6 Plan 3: LOAD-03, the allowed uninstall Summary

**`uninstall` now removes a plugin that other installed plugins still declare, names them on the success row, and lets the load-time check report each of them unsatisfied at the next reload — and the refusal it replaces is gone from the code, the vocabulary, the catalog and the docs rather than left dead in place.**

## The recorded answer to the one-way decision

The plan opened with a `blocking-human` decision checkpoint covering D-06-06 and D-06-07. It was surfaced to the developer and not self-answered.

> **Developer's answer, verbatim, 2026-09-18: `proceed-as-decided`.**

That is: retire the refusal and its token, add the new success-row token, keep the unreadable-declarer refusal. This summary is the citable supersession record D-06-07 asked for — **D-05-14, D-05-15 and D-05-16's dependents arm are superseded as of 2026-09-18.** D-05-16's retry loop itself survives, because it still serves the D-05-07 refusal (see D8 above).

The developer also ruled on the `docs/dependency-resolution.md` scope question as an ordinary deviation; see Scope Deviations item 6.

## Performance

- Duration: ~45 min
- Tasks: 3 (one decision checkpoint, two implementation)
- Files modified: 20
- Commits: 3 (1 RED + 2 GREEN)

## Accomplishments

- `assertNoDependents` became `readDeclarers`: the same `buildScopeDeclarationIndex` call, at the same site inside the same locked transaction, with the same exclude key. Only the outcome on a found dependent set changed — from a throw to a value carried out of the closure beside the removed version.
- The fail-closed throw is untouched and now carries the reason it must stay, because the surrounding change is exactly the one a later reader would assume covered both throws.
- `composeUninstalledRow` composes two independent axes — what the removal means for the rest of the scope, and what it left on disk — where the old builder set the reason array outright and could only carry one. Neither present still renders the byte-frozen bare row.
- The `uninstalled` row learned a cause trailer, mirroring exactly what LOAD-01 did for the `disabled` row three plans earlier: a list of identifiers cannot ride a 1-to-3-word token, and the cause chain is the only channel in this grammar that may interpolate one.
- `dependents unsatisfied` joined the closed set and the Phase 5 refusal marker left it in the same edit, so the count returns to 58 with all three membership pins amended by hand and neither derived from the constant under test.
- The retirement is total across seventeen sites in four production modules, eleven test files and two documents. The whole-tree grep returns nothing.
- The reconcile surface deliberately gained nothing: the load-time check already reports the same fact there, with a full remedy per dependent, so carrying a dependents brace as well would state one fact twice inside a single emission.

## Task Commits

1. Task 1: the blocking decision checkpoint — no commit by design; the answer is recorded above.
2. Task 2: the uninstall proceeds and reports — `9177d78f` (test, RED), `5a9fee5c` (feat)
3. Task 3: the vocabulary retirement across every pin surface — `96e923a6` (refactor)

Plan metadata: see the `docs(06-03)` commit that carries this file.

## Files Created/Modified

- `orchestrators/plugin/uninstall.ts` — `readDeclarers` and its `DeclarerReading`, the hoisted dependent list, `survivingDependents`, the four doc comments that named the retired refusal, and the recorded reason the orchestrated arm carries no dependents.
- `orchestrators/plugin/uninstall.messaging.ts` — three row-brace constants, `uninstalledRowReasons`, `composeUninstalledRow`, and the narrowed command-private reason pin.
- `orchestrators/reconcile/apply-outcomes.ts` — the `cause` field's doc comment, rewritten around the one refusal that still occurs.
- `shared/notification-types.ts` — the new member, the retired one removed, and `PluginUninstalledMessage.cause`.
- `shared/notification-grammar.ts` — `uninstalled` joins the cause-trailer statuses.
- `shared/notify-reasons.ts` — the new group home, the retired entry removed, both count sentences and the running narrative renumbered.
- `docs/output-catalog.md` — one state published, two deleted, the reasons-rendering tail enumeration re-listed.
- `docs/dependency-resolution.md` — the removal section rewritten around the new behaviour (see Scope Deviations item 6).
- Tests: `uninstall.test.ts`, `uninstall.messaging.test.ts`, `reconcile/apply.test.ts`, `reconcile/apply-outcomes.test.ts`, `reconcile/notify.test.ts`, `notification-types.test.ts`, `compat-01-no-expansion.test.ts`, `notify-closed-set-locks.test.ts`, `catalog-uat/catalog-contract.test.ts`, `catalog-uat/catalog-parser.test.ts`, `catalog-uat/fixtures/plugin-uninstall.ts`, `catalog-uat/fixtures/reconcile-applied.ts`.

## Decisions Made

**D-06-18: the swept-declarer exclusion is code, not a property of the shared snapshot.** The plan stated that because the declarer read and the `--prune` sweep share one snapshot under one lock, a record that both declares the target and is itself swept "is already excluded from the surviving set", and directed a test rather than code. That is false, and it was measured rather than argued: the dependent set is read BEFORE the removal and nothing subtracted from it afterwards. `survivingDependents` filters the list by the members that actually left, reading `removed` rather than sweep membership so a member whose removal FAILED — still installed, still a declarer — stays named. See Deviations item 1 for the experiment.

**D-06-19: the reconcile uninstall-failure `cause` field survives the retirement.** The plan directed it removed as dead carriage. Its doc comment and `apply.ts`'s producer both show it serves two refusals, and only one of them was retired: the D-05-07 unreadable-declarer refusal still reaches the reconcile surface and still needs its cause line to name which record could not be read. Removing the field would have silently dropped that line from a live path. The field stays; its comment now names the one refusal it carries and records why it outlived the other.

**D-06-20: the `uninstalled` row takes the cause chain.** The plan's behaviour spec asked for the dependent keys on "the row's cause line", but `PluginUninstalledMessage` had no cause field and the grammar's trailer arm did not admit the status. Both were extended on the exact precedent LOAD-01 set for the `disabled` row one plan earlier, with the same reasoning written at both sites: every other `uninstalled` producer omits `cause` and keeps its byte-frozen row.

**D-06-21: the brace orders the consequence before the disposition.** `{dependents unsatisfied, data kept}`, not the reverse. This follows the pruned row's existing rule — the token that says why this row exists comes first and the data disposition trails as a footnote — rather than the plan's suggested phrasing, which would have put the disposition first. The plan offered its wording as an example ("for instance"), and the in-repo precedent is the stronger guide; the constant's comment states the contract in words.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A `--prune` run named a member it was removing as a surviving dependent**

- **Found during:** Task 2
- **Issue:** The plan asserted the adjacency case was already handled by the shared snapshot and instructed "add a test proving that rather than adding code for it". The test failed. The dependent set is computed before the removal and nothing subtracts from it, so a dependency-provenance record that declares the target and is itself swept in the same command was named on the row as needing a plugin while it was itself going.
- **Fix:** `survivingDependents(dependents, prunedMembers)` runs inside the locked closure immediately after the sweep, filtering by the members that actually left.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Verification:** `tests/orchestrators/plugin/uninstall.test.ts#LOAD-03: a declarer the same --prune run sweeps is not named as a surviving dependent`. The claim was tested rather than assumed: with the one call commented out the suite reports `fail 1` on exactly that case and `pass 92`; restored, `fail 0`.
- **Commit:** `5a9fee5c`

**2. [Rule 3 - Blocking] The reconcile outcome field the plan called dead is live**

- **Found during:** Task 3
- **Issue:** The plan directed removing `PluginUninstallFailedOutcome.cause` and the row rendering that consumes it, on the grounds that it existed only to carry the retired refusal's dependent list. It carries both refusals — `apply.ts` attaches it on `result.error instanceof UninstallRefusedError`, which the surviving D-05-07 refusal also satisfies. Removing it would have dropped the `cause:` line from a live reconcile path with no test noticing, because the only test covering that surface used the retired reason.
- **Fix:** The field and its rendering stay. Its doc comment is rewritten to name the one refusal it now carries and to record that it outlived the other. The two tests that exercised it were re-pointed at the surviving refusal rather than deleted.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `tests/orchestrators/reconcile/apply-outcomes.test.ts`, `tests/orchestrators/reconcile/notify.test.ts`
- **Verification:** `tests/orchestrators/reconcile/notify.test.ts#D-05-16: carries the refusal cause on a plugin-uninstall-failed row that names one`, plus the two new `apply.test.ts` integration cases under item 5.
- **Commit:** `96e923a6`

**3. [Rule 3 - Blocking] The success row had no cause channel and no grammar arm**

- **Found during:** Task 2
- **Issue:** The plan's behaviour spec requires the dependent keys on the row's cause line, but `PluginUninstalledMessage` declares no `cause` and `notification-grammar.ts`'s trailer branch admits only `failed`, `manual recovery` and `disabled`. Neither `notification-grammar.ts` nor (for Task 2) `notification-types.ts` was in the plan's file scope.
- **Fix:** Both extended on the LOAD-01 `disabled`-row precedent set one plan earlier, each with a comment stating that every other producer of the status omits `cause` and keeps its byte-frozen row.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts`
- **Verification:** `tests/orchestrators/plugin/uninstall.test.ts` asserts the full rendered block including the `    cause:` trailer at four-space indent; the catalog contract asserts its bytes.
- **Commit:** `5a9fee5c`

**4. [Rule 3 - Blocking] Task 2 could not compile without Task 3's vocabulary**

- **Found during:** Task 2
- **Issue:** The plan puts the behaviour in Task 2 and the closed-set edit in Task 3, but the behaviour cannot be written — let alone typechecked — without the token, and adding a `REASONS` member without a group home is a TS2344 at `_ReasonsCoverageProof`.
- **Fix:** Task 2 added the new member, its group home, the command-private pin and the three membership pins at 59 with BOTH tokens present; Task 3 removed the retired one and returned every pin to 58. Each commit is independently green, which the alternative — leaving three pins red between two commits — would not have been.
- **Files modified:** `shared/notification-types.ts`, `shared/notify-reasons.ts`, `tests/architecture/notify-closed-set-locks.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/shared/notification-types.test.ts`
- **Verification:** `npm run typecheck` green at both commits; `REASONS.length` reads 59 at `5a9fee5c` and 58 at `96e923a6`.
- **Commits:** `5a9fee5c`, `96e923a6`

**5. [Rule 2 - Missing coverage] Retiring the refusal left the D-05-16 retry loop unexercised**

- **Found during:** Task 2
- **Issue:** The dependents refusal was the only thing any test used to drive `applyPluginUninstalls`'s refuse-and-retry loop. Rewriting those cases turned `orchestrators/reconcile/apply.ts` into an unpinned direct-coverage shortfall — `branches 146/150, functions 32/34`, with the `refused.push` arm and the whole retry branch dark. Pinning the shortfall would have recorded a machine that is no longer tested; the machine is still live for the surviving refusal.
- **Fix:** Two integration cases drive the loop through the D-05-07 refusal instead — one where the retry makes progress and settles both entries, one where no retry can settle and the refused outcome is reported. Both arms of the loop are covered and the file is back to 100% branch and line.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** `npm run test:coverage:direct:commit` reports `3 pinned shortfall(s) matched … exactly`, with no new pin added.
- **Commit:** `5a9fee5c`

### Scope Deviations

**6. `docs/dependency-resolution.md` was rewritten here, though plan 06-04 owns that file.**

Task 3's own acceptance criterion is a grep over `extensions/ tests/ docs/` returning no matches, and this file held the last occurrence. The criterion and the plan's prohibition ("the retired vocabulary must not be left dead in place… a token whose comment block asserts a refusal that no longer happens would mislead any reader who greps it") both point the same way, and the phase's roadmap success criterion 4 names this document's sentence explicitly. One paragraph was rewritten: the removal now proceeds, the row reads `{dependents unsatisfied}`, the dependents are reported at the next reload, and the "Claude Code documents this refusal for `disable`; this extension applies it to `uninstall`" sentence is gone. The surviving D-05-07 refusal's own two paragraphs are untouched and remain correct. **Plan 06-04 should re-triage its documentation task against what is already done here rather than assume the file is untouched.**

**7. The catalog-state arithmetic in Task 3's acceptance criteria is off by one, and the criterion was not met as literally written.**

The criterion reads "`grep -c 'catalog-state:' docs/output-catalog.md` equals the count before this phase began, plus three, minus two" — 220 + 3 − 2 = 221. The actual count is **222**. The arithmetic implicitly assumed this plan adds zero catalog states, because plans 06-01 and 06-02 had already contributed all three of the phase's "+3" (one state and two states respectively, verified against their commits: 220 → 221 → 223). That contradicts the same task's action text, which directs adding the replacement states for the new success row. The action text wins: D-06-06 is rated one-way precisely *because* it publishes a catalog row, so leaving the new row's bytes unpinned would forfeit the reason the decision needed a human. Net: 223 − 2 + 1 = 222. The contract test's own `EXPECTED_STATE_COUNT` moved 218 → 217 and its byte total 29,802 → 29,652, both recomputed from the tree rather than adjusted by a guessed delta.

**8. The retired reconcile catalog state got no replacement, against "add the replacement states" (plural).**

Only one replacement state was added, in the standalone uninstall section. The reconcile-applied section's refusal state was deleted outright, because the plan's own Task 2 action requires the reconcile-driven removal to keep its bare row — and that bare row is already documented by the ordinary `reconcile-applied-cascade` states. A second state would have published a duplicate of bytes the catalog already carries. The deleted state's meaning is not lost: the consequence it used to report now surfaces through `reconcile-dependency-unsatisfied`, and the new standalone state's prose says so explicitly.

**9. Two reconcile integration tests changed meaning rather than bytes.**

`D-05-16: dropping a plugin and its dependent together converges in ONE pass when the dependency is recorded first` proved that the retry loop rescued the record order the refusal broke. Nothing refuses on that axis now, so the same scenario settles in plain record order and the row order flipped (`orphan` then `keeper`). It was retitled `LOAD-03: … in plain record order` and its seeding comment now records what the order used to mean. `D-05-16 / PU-5: a converged entry beside a refusal…` became `… beside a still-declared removal` for the same reason. Both were rewritten rather than deleted, so the evidence of the change survives in the suite.

**Total deviations:** 5 auto-fixed (1 bug, 3 blocking, 1 missing coverage) and 4 scope deviations. **Impact:** item 1 is behavioural and would have shipped a row that names a plugin the same command was removing. Item 2 would have silently removed a live cause line. Item 5 would have left a live retry loop untested behind a green suite. Items 7 and 8 are recorded rather than silently absorbed, per the instruction to keep the acceptance criteria honest.

## Known Stubs

None. No placeholder, empty-literal or deferred path was introduced.

## Threat Flags

None. The three threats this plan owned are mitigated as planned:

- **T-06-03 / T-06-12 (fail-open, and removing a safety property before its replacement exists):** the unreadable-declarer refusal is asserted to still fire and still remove nothing, in both notification modes, and the load-time check that replaces the other refusal was landed and proven by 06-01 and 06-02 before this plan ran.
- **T-06-02 / T-06-01 (output spoofing, path disclosure):** the cause line is built from `name@marketplace` keys whose names passed `domain/dependencies.ts`'s token pattern, joined with `", "`, with no nested cause chained behind it — the same construction the retired refusal used, and the reasoning is recorded at `composeUninstalledRow`.
- **T-06-13 (a gate that stops gating):** the retirement is proven by the typecheck going green only after every site was swept, a whole-tree grep returning nothing, and three membership pins amended by hand rather than derived from the constant under test.

No new network endpoint, auth path, file-access pattern or schema field was introduced, and no package was installed.

## Issues Encountered

- **The row says what happened, not what to do.** `○ helper v1.0.0 (uninstalled) {dependents unsatisfied}` with `cause: required by app@mp` names the consequence but offers no remedy, because the remedy is the load-time check's to give, one row per dependent, on the next reload. That is the right division — a remedy naming every dependent would not fit a single cause line — but it means the operator sees the consequence one reload before they see what to do about it. Worth an operator's eye at phase UAT.
- **`pending` still does not see the verdict.** Carried unchanged from 06-01 and 06-02. `/claude:plugin pending` previews `will uninstall` and `will enable` without consulting the satisfaction verdict, so it cannot preview the disable that follows a removal. Plan 06-04 owns the decision.
- **`docs/plugin-enablement.md` is now wrong in a third way.** Already noted by 06-02 for the planner's enablement inputs; the removal path it describes is also stale. Plan 06-04 owns that rewrite.
- **LOAD-03 stays Pending in `REQUIREMENTS.md`.** Plan 06-04 declares the same ID, so the shared-ID gate refuses to mark it complete from here — the same situation 06-02 recorded for LOAD-01 and LOAD-02. `requirements mark-complete` was deliberately not run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-04. All three of the phase's requirements are implemented; 06-04 owns marking them, the supersession record in `REQUIREMENTS.md`, the `PRUNE-GUARD-MR-01` backlog re-triage and the remaining documentation.

What 06-04 inherits, stated precisely so it does not re-do work or assume work is undone:

- `docs/dependency-resolution.md`'s removal section is ALREADY rewritten (Scope Deviations item 6). Its §138 refusal sentence is gone. Re-triage rather than re-write.
- `docs/output-catalog.md` carries 222 `catalog-state:` markers and 217 contract-mapped states. The reasons paragraph reads 58 and its tail enumeration lists the three members this phase added.
- The supersession record D-06-07 asked for is this file, with the developer's verbatim answer and its date. `REQUIREMENTS.md`'s PRUNE-05 entry already carries a supersession note dated 2026-09-18; 06-04 should check it against D-06-18's correction (the retry loop survives; only the dependents arm of D-05-16 is superseded).
- `docs/plugin-enablement.md` is untouched and now stale in three ways.

## Self-Check: PASSED

All three commits this plan claims resolve in `git log` (`9177d78f`, `5a9fee5c`, `96e923a6`). Every file named under Files Created/Modified exists on disk. The four gates the plan's verification section names are green, each read by exit status rather than by a summary glyph and none of them piped: `npm run check` (exit 0), `npm run test:coverage:direct:all` (exit 0, 248 pairs, `3 pinned shortfall(s) matched … exactly`), `SKIP=trufflehog pre-commit run --all-files` (exit 0, no hook reporting Failed, and `git status` clean of hook rewrites afterwards), and the whole-tree grep for the retired token (exit 1, no matches).

---
*Phase: 06-load-time-dependency-check-and-allowed-uninstall*
*Completed: 2026-09-18*
