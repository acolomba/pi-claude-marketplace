---
phase: 113-update-enable-disable-reconcile
plan: 04
subsystem: api
tags: [notify, closed-set, workflows, uninstall, disable, reinstall, update, traceability]

requires:
  - phase: 112-install-and-removal-lifecycle
    provides: "`cascadeUnstagePlugin`'s sixth `dropped.workflows` axis, reinstall's `placedWorkflowNames` thread-through, and `record.resources.workflows` as a required persisted array"
  - phase: 113-02
    provides: "the update verb's workflows prepare/commit, `handles.workflows.result.stagedNames`, and `preflight.record` in scope at the success-outcome composition"
  - phase: 113-03
    provides: "`InstallLedgerSummary.stagedWorkflowNames` and the enable branch's pre-enable `installed` record parameter"
provides:
  - "`\"stale workflow command\"` as the 44th closed-set `Reason` literal, with all four of its gates moved in one commit"
  - "`retiresWorkflowCommand(previousNames, placedNames)` in `orchestrators/plugin/shared.ts` — the one place the set-difference rule is stated"
  - "`staleWorkflowCommand?: boolean` on the update updated-outcome, the reinstall reinstalled-outcome, and the module-private enable/disable sentinel (fresh + disable-failed arms)"
  - "`PluginUninstalledMessage.reasons?` and its render thread — the `(uninstalled)` row's first reason brace"
  - "four published catalog states, one per stamping verb, each paired with a fixture"
  - "the corrected WLIF-04 traceability row, split off from the WLIF-04..06 block"
affects: [113-05]

actuals:
  tokens: 15486
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "a closed-set amendment landed as a seven-site transaction, with each gate individually observed to fire before the commit"
    - "a set-difference gate extracted to one named helper so three verbs cannot state the rule three ways under a dupes threshold of 3"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - docs/output-catalog.md
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/reinstall.messaging.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/update-row.test.ts
    - .planning/workstreams/workflows/REQUIREMENTS.md

key-decisions:
  - "`stagedWorkflowNames` on the module-private `SetEnabledOutcome` fresh arm was DELETED and replaced by `staleWorkflowCommand?: boolean`. The retirement gate is computed inside `runEnableBranch`, where both operands (`installed`, the pre-enable record parameter, and `summary.stagedWorkflowNames`, the ledger projection) are already in scope. Carrying the names to the row composer instead would have meant threading the pre-enable record through `dispatchOutcome` and `composeOutcomeRow` — and computing the difference inside a row composer is exactly what the plan's prohibition on computing the gate 'inside a renderer' forbids. The member left plan 03 with a producer and no consumer; it now has neither."
  - "The closed-set amendment turned out to be a SEVEN-site transaction, not six. Beyond the plan's six, `tests/shared/notify.test.ts:5008` carries a SECOND `REASONS.length` assertion, and `tests/shared/notify-reasons.test.ts:47` carries a `_ReasonsCoverageProof extends [never, never]` type-level pin. Both went red on the removal experiment; both were bumped in the same commit."
  - "`PluginUninstalledMessage` had NO `reasons` field, so the uninstall stamp required widening the message type and threading `p.reasons` through `renderUninstalledRow`. The two hard-coded `false` soft-dependency arguments were KEPT, so MSG-SD-3 (no `{requires pi-*}` marker on a removal row) stays structural rather than becoming a convention."
  - "The token sits LAST inside the brace on every verb, after orphan rewake / malformed kinds / dropped kinds. That is the tail position the closed set itself gives it, and one fixed position across five surfaces is what lets a reader scan a column of rows."
  - "The disable-FAILED arm stamps the token JOINED to its failure reason and stays at `error` severity. The disable was not carried out, which outranks the warning band the token carries alone; the row still has to name both facts, because a partial cascade that removed two envelopes and then failed leaves two commands registered."
  - "Uninstall's own failure arm does NOT stamp. The plan names the four success rows plus disable's two arms; extending to uninstall's `(failed)` row would have been unrequested scope, and it is recorded here as the one asymmetry with disable."
  - "`composeUninstalledRow` was extracted from `uninstallPlugin`. The stamp pushed that function to cognitive 16 against fallow's ceiling of 15; the extraction is what kept `.fallowrc.json` at zero `health.thresholdOverrides` and zero suppression markers."

patterns-established:
  - "A closed-set widening is proved non-vacuous by REMOVING the new literal and watching each gate go red, one at a time, before the commit. The compile-time proofs catch a removed or renamed member while an additive drift is silently absorbed, so a widening that arrives without its pins is a widening nothing guards."
  - "A gate whose operand differs by verb states WHY at each site. The two removing verbs read what their cascade REPORTED dropping; the three re-materializing verbs read the record minus what they placed. The shared helper's doc comment names both and says which verbs take which, so a later edit cannot quietly swap one for the other."

requirements-completed: [WLIF-06, WLIF-04]

coverage:
  - id: D1
    description: "the closed reason set carries one more member, appended at the tail, with every existing literal in its existing position"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 44-entry reason set"
        status: pass
    human_judgment: false
  - id: D2
    description: "every literal has a home and no home names a literal outside the set"
    requirement: "WLIF-06"
    verification:
      - kind: other
        ref: "`npm run typecheck` exits 0 with the literal present; removing it produces TS2344 at notify-reasons.ts:278 and TS1360 at tests/shared/notify-reasons.test.ts:48"
        status: pass
    human_judgment: false
  - id: D3
    description: "the amendment is proved non-vacuous — each gate was observed to fire"
    requirement: "WLIF-06"
    verification:
      - kind: other
        ref: "one temporary removal of the tuple member; three failures recorded verbatim below, then restored"
        status: pass
    human_judgment: false
  - id: D4
    description: "all four retiring verbs stamp the remedy, from set difference, at warning severity, one token per plugin"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-06: an uninstall that took an envelope off disk names the reload remedy"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: a disable that took an envelope off disk names the reload remedy"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.messaging.test.ts#WLIF-06: a retired workflow command takes the tail token and raises the row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-06: an update that withdrew a workflow names the reload remedy"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: three retired names stamp exactly one token"
        status: pass
    human_judgment: false
  - id: D5
    description: "an unaffected row is byte-identical to before, on every stamping verb"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-06: an uninstall that retired nothing renders the row it always rendered"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: a disable that retired nothing renders the row it always rendered"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.messaging.test.ts#WLIF-06: a reinstall that retired nothing renders the row it always rendered"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-row.test.ts#WLIF-06: an update that retired nothing renders the row it always rendered"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-06: an update that re-placed every recorded workflow stamps nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "a rename retires a command exactly as a deletion does, and a name in both sets retires nothing"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: a renamed workflow retires a command exactly as a deletion does"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: a name in both the recorded and the staged set retires nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-06: a reinstall that re-placed every recorded workflow omits the axis"
        status: pass
    human_judgment: false
  - id: D7
    description: "the exported enable/disable projection never carries the token, whatever the verb underneath it did"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: the reconcile projection carries no token after a retiring disable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: the reconcile projection carries no token after a retiring enable"
        status: pass
    human_judgment: false
  - id: D8
    description: "a partial disable cascade names the envelopes it DID remove, rather than reporting that nothing changed"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-06: a partial disable cascade names the envelopes it DID remove"
        status: pass
    human_judgment: false
  - id: D9
    description: "the row's severity is warning when the token is present and unchanged when it is absent"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-row.test.ts#WLIF-06: the dropped-kind row raises on the stale token alone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.messaging.test.ts#WLIF-06: the token raises a row that has no other reason of its own"
        status: pass
      - kind: other
        ref: "four catalog states carry `expectedSeverity: \"warning\"` and pair byte-equal through the catalog-uat runner"
        status: pass
    human_judgment: false
  - id: D10
    description: "every new rendered byte is published and paired"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts (189 annotated examples, all byte-equal)"
        status: pass
      - kind: other
        ref: "`grep -c 'stale workflow command' docs/output-catalog.md` prints 6 (>= 4 required)"
        status: pass
    human_judgment: false
  - id: D11
    description: "reinstall REPLACES a workflow artifact: old bytes gone, new bytes at the same target, record rewritten, adjacent plugin untouched"
    requirement: "WLIF-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-04: a reinstall REPLACES a workflow envelope at its recorded target"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-04: a workflow the new version drops leaves neither an envelope nor a record entry"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs …/reinstall.ts → branches 246/246, functions 49/49, lines 1822/1822"
        status: pass
    human_judgment: false

duration: 65min
completed: 2026-09-05
status: complete
---

# Phase 113 Plan 04: The lingering-command reload remedy Summary

**Every verb that can retire a workflow command now says so in one voice, at one severity, in one position inside the brace — and the reload path that clears the condition has a case proving it can never claim the remedy.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3 of 3
- **Files modified:** 22

## Task Commits

1. **Task 1: the closed-set amendment with all of its gates** — `e9d79e31` (feat)
2. **Task 2: the stamp from all four retiring verbs** — `2923eadc` (feat)
3. **Task 3: the reinstall verification and its traceability correction** — `e6647ebf` (test)

## The three separately observed gate failures

The plan required the widening to be proved non-vacuous rather than assumed from the fact that the gates exist. `"stale workflow command"` was removed from the `REASONS` tuple ALONE — every pin, every home and every catalog state left in place — and each gate was run separately. Verbatim:

**1. The completeness proof (`shared/notify-reasons.ts`).**

```
extensions/pi-claude-marketplace/shared/notify-reasons.ts(278,83): error TS2344: Type '"stale workflow command"' does not satisfy the constraint 'never'.
```

`_ExtraReason` resolves to the literal because `CommandPrivateReason` still names a member the tuple no longer holds. TS2344 is the failure code the proof's own doc comment predicts.

**2. The length pin (`tests/architecture/notify-closed-set-locks.test.ts`).**

```
✖ OUT-08: REASONS is the closed 44-entry reason set
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  43 !== 44
      at TestContext.<anonymous> (…/notify-closed-set-locks.test.ts:55:10)
```

**3. The enumeration pin (`tests/architecture/compat-01-no-expansion.test.ts`).**

```
✖ COMPAT-01: REASONS holds exactly its inherited members, in order
  AssertionError [ERR_ASSERTION]: COMPAT-01: no reason token may be renamed. …
  + actual - expected
    [
      'up-to-date',
      …
      'marketplace in project scope',
  -   'stale workflow command'
    ]
```

The literal was restored immediately after and `npm run typecheck` returned to `0` errors before anything was staged.

**A FOURTH gate fired that the plan did not name**, and it is worth recording because it is the same class of pin in a file nobody would have looked in:

```
tests/shared/notify-reasons.test.ts(48,12): error TS1360: Type 'true' does not satisfy the expected type 'false'.
```

That is `ReasonsCoverageProofIsExact`, a type-level `_ReasonsCoverageProof extends [never, never]` assertion in the reasons module's own owner test. It needed no edit — it is a proof, not a count — but it is the second independent reader of the coverage proof and it went red on the same removal.

## The seven amendment sites, one line each

The plan enumerated six. Two more were found by the removal experiment and by grep, so the transaction was seven wide.

1. **The tuple + its doc comment** — `shared/notify.ts:227`: `"stale workflow command"` appended at the TAIL, no existing literal moved, with the house multi-paragraph comment stating what it claims and both contrasts (not the reload trailer; stays off the exported enable/disable union). The tuple header's `43-entry` sentence bumped to `44-entry`.
2. **A home in `CommandPrivateReason`** — `shared/notify-reasons.ts:262`: appended after `"orphan rewake"` with the per-member justification comment the group's existing members carry ("named here for the proof rather than promoted to a shared topic group").
3. **The module header's count sentence** — `shared/notify-reasons.ts:24`: one sentence continuing the history, in the shape of the sentences already there (`43 to 44`). Both `43-entry` mentions in that header bumped too.
4. **The length pin** — `tests/architecture/notify-closed-set-locks.test.ts:29,52`: one comment LINE in the file's convention (requirement ID and arrow), the literal bumped to `44`, AND the test TITLE, which names the count.
5. **The enumeration pin** — `tests/architecture/compat-01-no-expansion.test.ts:163`: the new literal appended at the END of the hand-written list, matching declared tuple order. This is enumeration equality, so order matters.
6. **A paired catalog fixture per stamping verb** — `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts`: four new states (`uninstall-stale-workflow-command`, `reinstall-stale-workflow-command`, `update-stale-workflow-command`, `disable-stale-workflow-command`), each with its fixture and each carrying `expectedSeverity: "warning"`. The runner's exact-count assertion moved 185 → 189, comment and message included.
7. **A SECOND length assertion the plan did not list** — `tests/shared/notify.test.ts:5008`: a bare `assert.equal(REASONS.length, 43)` inside the notify owner test, independent of the architecture pin. Bumped to `44` in the same commit.

`tests/architecture/cross-surface-reason-parity.test.ts` was checked and needed nothing: it enumerates resolver-note → reason mappings per surface, not the reason SET, so a new literal with no note behind it does not appear there.

## The `stagedWorkflowNames` decision

**Deleted, not read.** Plan 03 left the member on the module-private `SetEnabledOutcome` fresh arm with a producer and no consumer, and required plan 04 either to read it or to remove it in the same commit. It is gone; `staleWorkflowCommand?: boolean` sits in its place on the same arm.

The reasoning is the plan's own prohibition. `composeOutcomeRow` is a row composer — a renderer — and the plan forbids computing the gate inside one. Reading `stagedWorkflowNames` at the row would additionally have required threading the pre-enable `installed` record through `dispatchOutcome` and `composeOutcomeRow`, because the difference needs BOTH operands and the composer holds neither. Computing it in `runEnableBranch`, where `installed` is already a parameter (captured before the ledger rewrites it) and `summary.stagedWorkflowNames` is the projection plan 03 added, needs no new plumbing at all.

`InstallLedgerSummary.stagedWorkflowNames` — the REQUIRED projection member on the install ledger — is untouched and is now genuinely read: it is the second operand of the enable gate.

The optionality reasoning plan 03 recorded still holds and carried over verbatim to the replacement member: `runDisableBranch` and `resolveIdempotentOutcome` also reach the `fresh` arm, and the config-write-back arm stages nothing and removes nothing, so absent means "nothing was retired here" rather than "everything was".

## The token's final position inside the update row's brace

**Last, on both row forms.**

- `(updated)`: `[...orphanRewake, ...malformedKinds, ...stale]`
- `(partially-installed)`: `[...orphanRewake, ...malformedKinds, ...droppedKinds, ...stale]`

All four axes at once render `{orphan rewake, malformed skill, unsupported component, stale workflow command}`, pinned by `tests/orchestrators/plugin/update-row.test.ts#WLIF-06: all four axes at once emit in one brace in the established order`. The same tail position is used by `freshEnableRow`, `reinstalledRowFromOutcome` and the uninstall/disable rows, so the token appears in one place across all five surfaces.

The composer's severity sentence was EXTENDED rather than contradicted, as the plan required. It now says two axes move the channel and names the different reason for each: the malformed axis reports a component written in degraded form, the stale-command axis reports a shortfall in what the operation ACHIEVED. Orphan rewake still moves nothing.

## The reinstall verification: satisfied, and the row now says so

**The requirement was already satisfied, and by Phase 112 rather than this phase.** `tests/orchestrators/plugin/reinstall.test.ts` already carried a genuine REPLACEMENT case — same target path, different bytes after — plus a dropped-workflow case that also asserts an adjacent plugin's envelope survives byte-unchanged. Both were landed by `112-03` (`b6ed30e8`, `c97ca097`, `e785a865`). No production half was missing, so nothing was implemented; the row was corrected.

Two things were strengthened before the row moved, because the plan asks for filesystem facts rather than inference:

- The replacement case now reads the envelope bytes BEFORE the reinstall and asserts they are gone afterwards (`assert.notEqual(after, beforeBytes)`). Previously "the old content is gone" was inferred from the new content matching, which is a weaker claim about a file that could in principle have been appended to.
- The adjacent-plugin assertion, which existed but was unexplained, now states why it belongs to this requirement: "replaces" is only meaningful against a boundary saying which artifacts it does NOT touch, and the saved directory is shared.

Both cases were retitled from `WLIF-01` to `WLIF-04`, so a reader arriving from the traceability row can find them.

**What the row now says** (`.planning/workstreams/workflows/REQUIREMENTS.md:107`): `WLIF-04` is split off from the `WLIF-04..06, WFLW-04` block into its own row reading `Phase 113 -> Phase 112 | Complete`, naming the three landing commits, naming both evidence cases by title, and recording that the correction was made only after they passed. The remainder row is `WLIF-05, WLIF-06, WFLW-04 | Phase 113 | Pending (re-land)` — status untouched, because Phase 113 is not finished and those bookings are the orchestrator's to close.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `PluginUninstalledMessage` had no `reasons` field**

- **Found during:** Task 2.
- **Issue:** The plan requires uninstall to stamp on its row composer, but the `(uninstalled)` message variant declared no `reasons` at all and `renderUninstalledRow` passed a hard-coded `undefined` to `composeReasons`. The stamp was unreachable.
- **Fix:** Added `reasons?: readonly ContentReason[]` to the variant with a doc comment on the same terms its four siblings carry, and threaded `p.reasons` through the renderer. The two soft-dependency arguments stay hard-coded `false`, so MSG-SD-3 remains structural — a removal row still cannot emit `{requires pi-subagents}` / `{requires pi-mcp}` whatever the removed record declared.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
- **Committed in:** `2923eadc`

**2. [Rule 3 — Blocking] `uninstallPlugin` breached the cognitive-complexity ceiling**

- **Found during:** Task 2.
- **Issue:** `npm run fallow` reported `uninstallPlugin` at cyclomatic 17 / cognitive 16 against `maxCognitive: 15`, breaching on the cognitive dimension. The stamp's ternary, conditional spread and severity selection were what pushed it over.
- **Fix:** Extracted `composeUninstalledRow(plugin, removedVersion, staleWorkflowCommand)` as a file-private function. `.fallowrc.json` still carries zero `health.thresholdOverrides` and no suppression marker was added.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Committed in:** `2923eadc`

**3. [Rule 1 — Bug] Seventeen existing uninstall cases asserted a row the verb no longer renders**

- **Found during:** Task 2.
- **Issue:** `seedFullPlugin` seeds a workflow and puts its envelope on disk, so every uninstall driven through it now genuinely retires a command. Seventeen cases asserted `severity: undefined` and a brace-less row.
- **Fix:** Updated each to the row the verb now renders. The shared `LIFE_04_UNINSTALLED_ROW` constant was SPLIT rather than edited: the five `seedFullPlugin` cases use `LIFE_04_UNINSTALLED_ROW_STALE`, and the sixth — a hand-seeded record naming no resources — keeps the brace-less form. That pair is what shows the token is gated rather than unconditional.
- **Files modified:** `tests/orchestrators/plugin/uninstall.test.ts`
- **Committed in:** `2923eadc`

### Departures from the plan's literal instruction

**4. The shared gate helper was not in the plan's artifact table**

`retiresWorkflowCommand` was added to `orchestrators/plugin/shared.ts`. The plan's own `fallow` `<fails_when>` anticipates "a dupes finding across the four near-identical gate computations" with a `duplicates.threshold` of 3, and three verbs (enable, reinstall, update) share the identical set-difference expression. One named helper states the rule once — including why a rename retires as a deletion does, why a name in both sets retires nothing, and why the two REMOVING verbs read a different operand — instead of three sites restating it or three sites tripping the gate.

**5. Uninstall's `(failed)` arm does not stamp, while disable's does**

The plan names disable's two arms explicitly and names uninstall only at "the uninstall row composer". Uninstall's non-AG-5 partial-failure arm renders a `PluginFailedMessage` at `error` severity, and adding the token there was not requested. It is recorded here rather than left silent because it is a real asymmetry: a partial uninstall cascade CAN leave a command registered over a removed envelope, exactly as a partial disable cascade can, and only one of the two says so. If that gap is worth closing it is a one-line change at `emitCascadeFailure`.

**6. `git status --porcelain` is not empty**

What is dirty is the operator's own concurrent working set, present at session start and untouched here: `.claude/settings.json`, `.codex/config.toml`, `.planning/workstreams/workflows/state.json`, plus untracked `.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`, `.planning/workstreams/workflows/{config,.verification-ledger}.json`. Staging them would violate the project's explicit "never `git add -A`" rule. No file this plan touched is dirty; `git status` was checked after each of the three commits.

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 2 × Rule 3) + 3 documented departures
**Impact on plan:** No scope creep. The one widened render contract (`PluginUninstalledMessage.reasons`) was forced by the plan's own stamp requirement.

## Gate results

Run over the whole tree at `e6647ebf`:

| Member | Result |
|---|---|
| `typecheck` | exit 0, `0` lines matching `): error TS` |
| `lint` | exit 0 |
| `fallow` (dead-code / health / dupes) | exit 0, zero `health.thresholdOverrides`, no suppression marker added |
| `format:check` | "All matched files use Prettier code style!" |
| `test:corresponding` + its negative control | exit 0 |
| `test:coverage:direct:negative` | exit 0 |
| `test` | **5506 pass / 0 fail** |
| `test:integration` | **34 pass / 0 fail** |
| `test-coverage-direct` on `update-row.ts` | branches 20/20, functions 2/2, lines 165/165 |
| `test-coverage-direct` on `reinstall.ts` | branches 246/246, functions 49/49, lines 1822/1822 |
| `npm run check` | **exit 0** at all nine steps |

Per-verb literal coverage: `grep -lc 'stale workflow command'` over `uninstall.ts`, `enable-disable.ts`, `reinstall.ts`, `update-row.ts` prints `4`.

## Issues Encountered

- **TruffleHog fails structurally in this checkout.** `.git` is a file (linked worktree), so the hook's git-mode scan cannot read `.git/index`. Confirmed clean by filesystem-mode scan over the exact paths committed — `verified_secrets: 0`, `unverified_secrets: 0` for all three commits — then committed with `SKIP=trufflehog` only, per CLAUDE.md. No other hook was skipped and `--no-verify` was never used.
- **No pre-commit hook is installed in this checkout**, so `pre-commit run --files` was run by hand before each commit and fixed to clean. The prettier hook reformatted four files during Task 2; that was landed BEFORE the commit rather than after, so no follow-up commit was needed and nothing was amended.
- **One unused `eslint-disable` directive** was written and then removed. The `no-unnecessary-condition` carve-out the sibling closure sentinels carry (`alreadyGone`, `configInvalid`) stopped being needed once the row composition moved into `composeUninstalledRow`, where the boolean arrives as a parameter and TS no longer narrows it to `false`.

## `actuals.tokens` basis

`15486` is `chars/4` over the **realized diff** (`git diff HEAD~3 HEAD` additions: 61,944 characters), the same basis `113-03-SUMMARY.md` used. The plan's `estimate.tokens: 130000` carried `confidence: low` and did not state its basis; a calibrator comparing the two should settle that first, because the sibling plans in this phase have not all used the same one.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. Four things `113-05` inherits:

- **The closed set is 44 entries.** Any further token this phase adds is a seven-site transaction, and `tests/shared/notify.test.ts:5008` is the site the plan documents forget.
- **`retiresWorkflowCommand` is the one place the retirement rule lives.** A sixth stamping site should call it rather than restate the difference.
- **`PluginUninstalledMessage` now admits `reasons`.** It is a real channel with one member; anything else stamped there is an orchestrator decision (D-95-01), not a render-path widening.
- **`REQUIREMENTS.md` line 107 is now `WLIF-05, WLIF-06, WFLW-04 | Phase 113 | Pending (re-land)`.** WLIF-05 closed in `113-03` and WLIF-06 closed here, so that row is ready to be split again at phase close. `STATE.md` and `ROADMAP.md` were not touched by this plan.

No blockers.

---
*Phase: 113-update-enable-disable-reconcile*
*Completed: 2026-09-05*

## Self-Check: PASSED

- Files verified on disk: `shared/notify.ts`, `shared/notify-reasons.ts`, `orchestrators/plugin/shared.ts`, `orchestrators/types.ts`, the four stamp-site orchestrators, `docs/output-catalog.md`, the eleven test files, `REQUIREMENTS.md`, and this summary.
- Commits verified in `git log`: `e9d79e31`, `2923eadc`, `e6647ebf`, `4124c9d3`.
- `.planning/workstreams/workflows/STATE.md` and `ROADMAP.md`: not present in any of this plan's commits, per the orchestrator's ownership of those files. `REQUIREMENTS.md` was touched for the WLIF-04 row only, in the same commit as its evidence (`e6647ebf`).
