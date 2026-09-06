---
phase: 113-update-enable-disable-reconcile
plan: 05
subsystem: api
tags: [workflows, staging, pending, notify, catalog, uninstall, gate]

requires:
  - phase: 112-install-and-removal-lifecycle
    provides: "`garbageCollectWorkflowsStaging`, `WORKFLOWS_STAGING_MAX_AGE_MS`, and the private `holdsDisplacedEnvelopes` retention predicate"
  - phase: 113-01
    provides: "the phase's catalog-state convention and the `note:` advisory label precedent"
  - phase: 113-04
    provides: "`\"stale workflow command\"` as a closed-set `Reason`, `PluginUninstalledMessage.reasons`, and uninstall's `retiredWorkflowCommand` sentinel"
provides:
  - "`scanRetainedWorkflowsStaging` — the read-only sibling of the sweep, sharing its retention rule and its age bound"
  - "`readDisplacedEnvelopes` — the single reader of `.previous/`, with `holdsDisplacedEnvelopes` as its boolean projection"
  - "`advisories?: readonly string[]` on `CascadeNotificationMessage` and `ReconcilePendingEmptyMessage`, folded in from one render site"
  - "`composeRetainedWorkflowsAdvisories` — the byte form of the retained-tree line"
  - "an optional trailing `advisories` argument on `notifyWithContext`"
  - "the `stale workflow command` token on uninstall's `(failed)` arm"
  - "three published catalog states, each paired with a fixture"
affects: []

actuals:
  tokens: 12531
  tasks: 4
  commits: 4

tech-stack:
  added: []
  patterns:
    - "a destructive primitive and its read-only sibling share one private reader, with the primitive's boolean becoming a projection of the richer result"
    - "one optional member on two message shapes plus one fold helper, so two arms of a command cannot drift apart in bytes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - docs/output-catalog.md
    - docs/competitive-analysis/pi-claude-plugins.md
    - docs/competitive-analysis/pi-plugins.md
    - docs/competitive-analysis/zmarketplace.md
    - docs/competitive-analysis/asermax-pi-cc-plugins.md
    - tests/orchestrators/plugin/workflows-staging-gc.test.ts
    - tests/orchestrators/reconcile/pending.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/live-uat/README.md

key-decisions:
  - "The advisory line's published byte form is `    retained workflow staging: <name> (N envelopes) under the workflows staging directory`, at four-space indent, one line per tree, no header. The `<key>: ` prefix is what makes the line self-labeling in the absence of a header; the four-space indent follows the `leaked:` trailer, the house shape for an advisory body line composed from a string array."
  - "The count is OMITTED, not rendered as zero, when `.previous/` could not be read. The tree is reported on the same open question that makes the sweeper keep it, and a count nobody read is not a fact the line may state. The singular form (`1 envelope`) comes from the existing `tallyCategory` pluralizer rather than a second one."
  - "The call site does NOT wrap the scan in a try/catch. The scan is TOTAL by construction, so a catch there is a branch nothing can reach — measured, not assumed: the direct-coverage gate reported `branches 37/38, lines 306/308` with the wrapper present and `39/39, 329/329` without it. The plan's requirement (a scan failure must not fail the command) is met AT the scan, whose four failure arms each have a case."
  - "`emitCascadeWith` takes the advisory list as an explicit parameter rather than reading it off its `CascadeNotificationMessage | ReconcileAppliedCascadeMessage` union. `{ advisories?: readonly string[] }` is a WEAK type — every member optional — so TypeScript rejects a union member with no overlapping property (TS2345). The parameter keeps the member on the two shapes that can produce one."
  - "Uninstall's `(failed)` arm stamps from the SAME `retiredWorkflowCommand` sentinel its clean arm reads, assigned the moment the cascade returns and ahead of the failure split. The token joins the failure reason at the tail; severity stays `error`."

patterns-established:
  - "A predicate whose error arm carries no data is refactored by extracting the reader, not by writing a second one. The errno ladder here IS the retention rule, so two copies of it are two retention rules; one reader with a boolean projection keeps the destructive caller's behaviour provably unchanged while giving the read-only caller the count."
  - "An unreachable swallow is a defect, not defence in depth. Wrapping a total function in a try/catch buys nothing and costs a branch the coverage gate will not accept and a suppression this project does not allow. Put the swallow where the failure is, and pin each failure arm with a case."

requirements-completed: [WLIF-01]

coverage:
  - id: D1
    description: "the read-only scan reports exactly the trees the sweep keeps for the retention reason — same predicate, same age bound, count-bearing, sorted"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: reports an aged staging tree whose .previous holds displaced envelopes"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: does not report a staging tree still inside the maximum age"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: sorts the reported trees by directory name"
        status: pass
    human_judgment: false
  - id: D2
    description: "the scan is read-only in the strong sense: it creates nothing, resolves on every failure, and one bad entry does not end the pass"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: returns the empty result and creates nothing when the staging directory is absent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: returns the empty result rather than throwing when the staging directory cannot be read"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-06: skips a staging entry it cannot inspect and still resolves"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-07: skips a refused staging segment and resolves rather than rejecting"
        status: pass
      - kind: other
        ref: "`grep -cE '\\bawait (mkdir|writeFile|rename)\\(' …/workflows-staging-gc.ts` prints 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "the shared reader refactor left the sweep's signature, its retention decisions and its leak strings unchanged"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-02: the sweep's leak list and retention decisions survive the shared reader"
        status: pass
      - kind: other
        ref: "the eleven pre-existing sweep cases pass unchanged; `grep -c 'Promise<string\\[\\]>' …/workflows-staging-gc.ts` prints 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "the open-question arm reports the tree WITHOUT a count, rather than claiming zero"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#WR-05: reports a retained tree whose .previous cannot be read, with no count"
        status: pass
    human_judgment: false
  - id: D5
    description: "the advisory renders on BOTH pending arms, byte-identically"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#WR-06: the steady state names a retained workflow staging tree"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#WR-06: the cascade arm carries the identical retained-tree line"
        status: pass
      - kind: other
        ref: "both catalog fixtures read one `RETAINED_WORKFLOW_STAGING_ADVISORY` constant and pair byte-equal through the catalog-uat runner"
        status: pass
    human_judgment: false
  - id: D6
    description: "the scan runs once per invocation, not once per scope"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#WR-06: renders the advisory once for an invocation that walks both scopes"
        status: pass
      - kind: other
        ref: "`grep -c 'scanRetainedWorkflowsStaging' …/reconcile/pending.ts` prints exactly 2 — the import and one call"
        status: pass
    human_judgment: false
  - id: D7
    description: "the command still emits exactly one notification, stays byte-identical on repeat, and writes nothing"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#WR-06 / DIFF-01: a retained tree still leaves two consecutive invocations byte-identical"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#NFR-5: naming retained trees never creates the workflows staging directory"
        status: pass
      - kind: other
        ref: "every case runs through `createNotificationBoundary`, which throws at a second `ctx.ui.notify` where it is made"
        status: pass
    human_judgment: false
  - id: D8
    description: "an unreadable staging directory leaves the command's own output unchanged"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#WR-06: a staging directory that cannot be read leaves the command's own output unchanged"
        status: pass
    human_judgment: false
  - id: D9
    description: "an empty retained set renders nothing at all, and carries no key on the message"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#DIFF-01: reports the zero-action advisory when neither scope has pending work (unchanged bytes)"
        status: pass
      - kind: other
        ref: "`pendingEmptyMessage` spreads the key in only when the list is present; all 24 pre-existing pending cases pass byte-unchanged"
        status: pass
    human_judgment: false
  - id: D10
    description: "a partial uninstall cascade that retired a command names the reload remedy on its (failed) row"
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-06: a partial uninstall cascade that took an envelope off disk names the reload remedy"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#TR-03 (non-AG-5 partial): resources.* filtered by outcome.dropped.* (the negative control — its cascade drops no workflow and its row stays `{permission denied}`)"
        status: pass
      - kind: other
        ref: "`docs/output-catalog.md` state `failure-stale-workflow-command`, paired and byte-equal at `expectedSeverity: \"error\"`"
        status: pass
    human_judgment: false
  - id: D11
    description: "the phase's full gate chain and whole-tree hook pipeline are green"
    requirement: "WLIF-01"
    verification:
      - kind: other
        ref: "`npm run check` exit 0 at all nine steps; `pre-commit run --all-files` green on every hook but the structurally-failing TruffleHog, and modifying nothing on a second run"
        status: pass
    human_judgment: false

duration: 120min
completed: 2026-09-06
status: complete
---

# Phase 113 Plan 05: The retained staging tree read surface Summary

**The bytes the sweeper keeps forever now have a name on the one read surface that is not plugin-scoped, and the sweeper it borrows its retention rule from is provably the same sweeper it was.**

## Performance

- **Duration:** ~120 min
- **Tasks:** 4 of 4 (3 planned + 1 orchestrator-added)
- **Files modified:** 17

## Task Commits

1. **Task 1: the shared displaced-envelope reader and the read-only scan** — `1a26bbaa` (feat)
2. **Task 2: the retained-tree advisory on both `pending` arms** — `42b1fd4c` (feat)
3. **Task 4 (orchestrator-added): the reload remedy on uninstall's `(failed)` arm** — `5eacab50` (feat)
4. **Task 3: the phase green gate and the stale count sweep** — `efe2ba41` (docs)

Task 4 was executed between the plan's tasks 2 and 3, as instructed, so the green gate covers it.

## The advisory line's published byte form

```text
    retained workflow staging: 9f1c4d2a-3b7e (2 envelopes) under the workflows staging directory
```

Four spaces of indent, one line per retained tree, sorted by directory name, appended as its own block after the body and before the tally slot. Three deliberate properties:

- **No header, and no line at all when the set is empty.** The `retained workflow staging: ` key prefix is what makes the line readable without a header — the same role `leaked: ` plays on the failure trailer this borrows its shape from. A header would need an empty-set form, and an empty-set form is exactly what the plan forbids.
- **A directory NAME, never a path.** The containing location is fixed literal text (`under the workflows staging directory`). Two independent reasons, both decisive: this surface already renders basenames rather than absolute paths for information-disclosure reasons (T-53-02-02, the `(failed) {invalid manifest}` row), and a byte-equality fixture cannot pin a machine-specific absolute path at all — an interpolated one would have made the catalog state unpinnable, which is the same as not pinning the bytes.
- **The count is absent, not zero, when it is unknowable.** `1 envelope` / `2 envelopes` comes from the existing `tallyCategory` pluralizer; the unreadable-`.previous/` arm renders `retained workflow staging: <name> under the workflows staging directory` with no parenthetical. The tree is reported on an open question, and a count nobody read is not a fact the line may state.

Both arms are composed by ONE function (`composeRetainedWorkflowsAdvisories`) and folded by ONE helper (`foldAdvisories`); the two catalog fixtures read a single `RETAINED_WORKFLOW_STAGING_ADVISORY` constant, so the byte-identity claim is what the runner actually checks rather than something two hand-written blocks happen to agree on.

## Did the shared reader refactor change any sweep observation?

**No.** `garbageCollectWorkflowsStaging` keeps its `Promise<string[]>` signature (`grep -c 'Promise<string\[\]>'` prints 1), its five-step flow, and its call shape — `if (await holdsDisplacedEnvelopes(candidate))` is character-for-character what it was. `holdsDisplacedEnvelopes` is now a one-line projection of `readDisplacedEnvelopes`, which is the module's SINGLE reader of `.previous/` and carries the errno ladder's doc comment, moved rather than restated.

The eleven pre-existing sweep cases pass unchanged, including the four that pin the ladder's arms (`ENOENT` sweeps, `ENOTDIR` sweeps, empty `.previous/` sweeps, unreadable `.previous/` retains). One case was ADDED as the refactor's regression guard — `WR-02: the sweep's leak list and retention decisions survive the shared reader` — which sweeps one tree of each kind the sweep distinguishes in a single pass, so a reader that answered any of the three differently would move either the leak list or the surviving set.

`await readdir(` appears at exactly three call sites: the sweep's enumeration, the scan's enumeration, and the one reader.

## Did either complexity gate force an extraction?

**Yes, once — ESLint's, on `pendingReconcile`.** Wiring the advisory took the function from cognitive 14 to 16 against `sonarjs/cognitive-complexity: 15`, on two added conditionals: the `advisories.length > 0 && { advisories }` spread that keeps the key ABSENT on the empty arm, and the `length > 0 ? … : undefined` at the cascade call.

Both were extracted into named units — `retainedWorkflowsAdvisories(cwd)`, which owns the scan call and returns `undefined` for an empty set, and `pendingEmptyMessage(advisories)`, which owns the key-absent spread. That returns `pendingReconcile` to its previous conditional count. `.fallowrc.json` still carries zero `health.thresholdOverrides` and no suppression marker was added; fallow's independent ceiling was green throughout.

`emitCascadeFailure` in `uninstall.ts` gained one conditional spread for Task 4 and both gates stayed green with no extraction.

## The unreachable swallow, measured rather than assumed

The plan asks the `pending` call site to wrap the scan "in the same swallowing shape the sweep's call sites use". It was written that way first, and the direct-coverage gate reported `branches 37/38, lines 306/308` — the catch block and its branch, unreachable.

That is not a gap in the tests. The plan ALSO requires the scan to be total: an absent or unreadable staging directory yields the empty result, a per-entry failure is skipped, a containment refusal skips its entry. A total function wrapped in a try/catch produces a branch nothing can reach, and this project neither accepts an unreached branch on a gated file nor permits a suppression marker.

The wrapper was removed and the obligation moved to where the failure actually is. The scan's four failure arms each have a case; `pending`'s own case (`a staging directory that cannot be read leaves the command's own output unchanged`) pins the end-to-end claim the plan's acceptance criterion asks for. Coverage after removal: `branches 39/39, functions 9/9, lines 329/329`.

## Task 4: uninstall's `(failed)` arm

`113-04-SUMMARY.md` recorded this gap and called it "a one-line change at `emitCascadeFailure`". **The location was right; the size was understated.** It is five edits: one member on the args interface, one destructure, one conditional spread in `reasons`, and the sentinel threaded at both call sites. Nothing else was needed — no new gate, no new operand.

The verification the added task asked for came out in favour of doing it:

- **The `(failed)` arm CAN know what was retired.** `retiredWorkflowCommand = localOutcome.dropped.workflows.length > 0` is assigned the moment the cascade returns, at `uninstall.ts:656`, which is BEFORE the `!localOutcome.ok` split. Both failure exits — the AG-5 rethrow through the outer catch, and the non-AG-5 partial via the `cascadeFailure` sentinel — see the value. Only a cascade that throws before returning an outcome leaves it `false`, and that is the correct answer there: nothing was reported dropped.
- **The gate is the same one.** Both arms read that single sentinel, so they cannot disagree about what counts as retired. That was the added task's stated requirement.

The row: `⊘ helper v1.0.0 (failed) {permission denied, stale workflow command}` — token LAST, the position it takes on all five other stamping surfaces, joined to the failure reason rather than replacing it. Severity stays `error` (the removal was not carried out, which outranks the warning band the token carries alone), and the reload trailer stays structurally absent. This is exactly the shape `disable`'s failed arm already uses, which is the inconsistency the extension closes.

## The stale count sites found and corrected

The plan's action names "the published catalog". **`docs/output-catalog.md` carried no such prose** — a real sweep of it for kind enumerations and kind counts found nothing to correct, and it now mentions `workflows` 17 times.

The plan's gate, however, greps all of `docs/` and `extensions/`, and the rot was elsewhere. Fifteen sites in four competitive-analysis documents, plus three more found by widening the search:

| File | Sites | Correction |
|---|---|---|
| `docs/competitive-analysis/pi-claude-plugins.md` | 7 | six component kinds; the missing-kind arithmetic re-derived (they translate 2, so four of six are missing); one `five-phase ledger` → `seven-phase` |
| `docs/competitive-analysis/pi-plugins.md` | 5 | six component kinds; `three component kinds against our six`; the `missing by design` claim keeps its two, with the denominator corrected |
| `docs/competitive-analysis/asermax-pi-cc-plugins.md` | 4 | six component kinds; `Two of the five … missing` → `Three of the six …` (they translate skills, agents and MCP) |
| `docs/competitive-analysis/zmarketplace.md` | 2 | six component kinds; `five-phase transactional ledger` → `seven-phase` |
| `extensions/…/orchestrators/plugin/install.ts` | 1 | the ledger array comment said `5-element constant array`; the literal has held seven since the workflows phase landed |
| `tests/live-uat/README.md` | 1 | `across all five kinds` → six |
| `tests/orchestrators/plugin/enable-disable.test.ts` | 1 | `symmetric across all five kinds` → six |

Every comparison's arithmetic was re-derived from the coverage each document already enumerates for its competitor — no new claim about any competitor was introduced, only the denominator each document had already committed to. The gate now prints `0`.

## The two flagged planner assumptions

Both were settled by evidence during execution.

1. **`WFLW-04` — settled, and the assumption held.** The planner assumed the obligation was to CONSUME the already-exposed `componentPaths.workflows` on the `info` surface. `113-01` built exactly that consumption (the `workflows:` line, its two admitted arms, the state-only arm, the lenient component map) and marked `WFLW-04` complete against five named `info` / `list` cases plus paired catalog fixtures. The resolver half was already satisfied, as research measured; nothing over-delivered and nothing was left inferred.
2. **`WLIF-04` — settled, and the assumption held.** The planner assumed verify-then-correct rather than new code, and planned it as an explicit task so the assumption would be tested. `113-04` strengthened the two reinstall cases first (the replacement case now reads the envelope bytes BEFORE the reinstall and asserts they are gone, rather than inferring it), watched them pass against Phase 112's code, and corrected the traceability row IN THE SAME COMMIT as the evidence. `REQUIREMENTS.md:107` now reads `Phase 113 -> Phase 112 | Complete` and names all three landing commits.

Neither was carried forward silently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] the call-site swallow was unreachable dead code**

- **Found during:** Task 2.
- **Issue:** The plan's try/catch around the scan produced a branch and two lines nothing could execute, because the same plan requires the scan to be total. Measured: `branches 37/38, lines 306/308`.
- **Fix:** Removed the wrapper; the swallow lives at the scan, whose four failure arms each carry a case, and `pending` carries the end-to-end case the acceptance criterion asks for. Recorded on the scan's own doc comment so a future reader knows why there is no wrapper.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`
- **Committed in:** `42b1fd4c`

**2. [Rule 3 — Blocking] `foldAdvisories` could not read its member off the emitter's union**

- **Found during:** Task 2.
- **Issue:** `{ advisories?: readonly string[] }` is a WEAK type — all properties optional — so TypeScript refuses a union member with no overlapping property. `emitCascadeWith` takes `CascadeNotificationMessage | ReconcileAppliedCascadeMessage`, and the second declares no `advisories`. TS2345 at `notify.ts:4064`.
- **Fix:** `foldAdvisories` takes `readonly string[] | undefined` and `emitCascadeWith` takes the list as an explicit trailing parameter, mirroring the `hint` parameter beside it. `emitContextCascade` passes `message.advisories`; the reconcile-applied emitter passes `undefined`. The member stays on the two shapes that can produce one, which is what the plan required.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
- **Committed in:** `42b1fd4c`

**3. [Rule 3 — Blocking] `pendingReconcile` breached the cognitive-complexity ceiling**

- **Found during:** Task 2. See "Did either complexity gate force an extraction?" above.
- **Fix:** Extracted `retainedWorkflowsAdvisories` and `pendingEmptyMessage`. Zero threshold overrides, zero suppression markers.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`
- **Committed in:** `42b1fd4c`

### Departures from the plan's literal instruction

**4. Three of the plan's grep gates were ALREADY failing on the unmodified tree**

Each was written against CALL counts but expressed as `grep -c`, which counts LINES — including the import line and every comment that names the symbol. Verified against `HEAD` before this plan's first commit:

| Gate as written | Baseline | After | The question it meant to ask | Answer |
|---|---|---|---|---|
| `grep -c 'readdir' …/workflows-staging-gc.ts` <= 3 | **5** | 7 | `grep -c 'await readdir('` | **3** — the sweep, the scan, the one reader |
| `grep -cE 'mkdir\|writeFile\|rename' …/workflows-staging-gc.ts` == 0 | **1** | 1 | `grep -cE '\bawait (mkdir\|writeFile\|rename)\('` | **0** — the one match is the word "renames" in a comment |
| `grep -cE 'notify\(\|notifyWithContext\(' …/pending.ts` <= 4 | **5** | 5 | emission call sites | **2**, unchanged — the other three matches are comments |

The corrected forms are reported above and all three pass. No gate was weakened to fit: each was re-asked in the form that answers the question the plan's `<fails_when>` states.

**5. The stale-count sweep landed outside the plan's `<files>`**

Task 3 declares `docs/output-catalog.md`. The catalog had no stale kind prose; the rot the gate detects lives in four competitive-analysis documents, one source comment and two test comments. Those were corrected instead. Counts only — no claim about any competitor was added or changed beyond the denominator each document already committed to.

**6. Test and implementation landed in ONE commit per task, not a RED commit then a GREEN commit**

`pre-commit` runs `npm-typecheck` over the whole tree, and a commit holding a test that imports a not-yet-existing export fails it. A RED commit is therefore not reachable in this checkout without `--no-verify`, which the project forbids. Tests were written first and observed to fail — Task 1's cases failed with `TS2305: Module … has no exported member 'scanRetainedWorkflowsStaging'` before any production line was written — and the pair was committed together.

**7. `git status --porcelain` is not empty**

What is dirty is the operator's own concurrent working set, present at session start and untouched here: `.claude/settings.json`, `.codex/config.toml`, `.planning/workstreams/workflows/state.json`, plus untracked `.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`, and two workstream JSON files. Staging them would violate the project's explicit "never `git add -A`" rule. No file this plan touched is dirty; `git status` was checked after each of the four commits.

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 2 × Rule 3) + 4 documented departures
**Impact on plan:** No scope creep in the product surface. The one widened contract beyond the plan's table is the explicit `advisories` parameter on the module-private `emitCascadeWith`, forced by TypeScript's weak-type rule.

## Gate results

`npm run check` at `efe2ba41`, run end to end over the whole tree — **exit 0 at all nine steps**:

| Member | Result |
|---|---|
| `typecheck` | exit 0, `0` lines matching `): error TS` |
| `lint` | exit 0 |
| `fallow dead-code` | `✓ No issues found`, 514 entry points |
| `fallow health` | `0 above threshold · 11752 analyzed · maintainability 92.3 (good)`; zero `thresholdOverrides` |
| `fallow dupes` | exit 0; no clone group pairs the scan against the sweep |
| `format:check` | "All matched files use Prettier code style!" |
| `test:corresponding` | "Corresponding-test gate passed." |
| `test:corresponding:negative` | "Corresponding-test negative controls passed." |
| `test:coverage:direct:negative` | "Direct-coverage negative controls passed." |
| `test` | **5524 pass / 0 fail** (312 suites) |
| `test:integration` | **34 pass / 0 fail** |

Direct coverage, `hit === found` on every dimension:

| Module | Branches | Functions | Lines |
|---|---|---|---|
| `orchestrators/plugin/workflows-staging-gc.ts` | 45/45 | 5/5 | 338/338 |
| `orchestrators/reconcile/pending.ts` | 39/39 | 9/9 | 329/329 |
| `orchestrators/plugin/uninstall.ts` | 91/91 | 12/12 | 849/849 |

`pre-commit run --all-files` — every hook Passed except TruffleHog, which fails structurally in this checkout (see Issues Encountered). The first whole-tree run reported `mdformat: files were modified by this hook`; the rewrite was table-column realignment inside the four competitive-analysis files this plan had already modified, and no file outside this plan's own edits was touched. The rewrite was landed in the same commit, and a SECOND whole-tree run modified nothing.

Catalog: the annotated-example count moved 189 → 192 (two pending states, one uninstall state), and the runner's inverse walk confirms every catalog state added anywhere in this phase has a paired fixture.

## Issues Encountered

- **TruffleHog fails structurally in this checkout.** `.git` is a file (linked worktree), so the hook's git-mode scan cannot read `.git/index`. This is the documented CLAUDE.md condition, not a finding. Confirmed clean by filesystem-mode scan over the exact paths of each commit — `verified_secrets: 0`, `unverified_secrets: 0` for all four — then committed with `SKIP=trufflehog` only. No other hook was skipped and `--no-verify` was never used.
- **No pre-commit hook is installed in this checkout**, so `pre-commit run --files` was run by hand before each commit and fixed to clean. Prettier reformatted `notify.ts` and `catalog-uat.test.ts` during Task 2; both were landed BEFORE the commit rather than after, so no follow-up commit was needed and nothing was amended.
- **A per-entry-only containment refusal is not constructible for the scan**, and the test comment says so rather than implying a stronger claim. A symlinked ENTRY is skipped earlier as a non-directory, so the staging SEGMENT is the only place a refusal can originate — and that refuses every entry at once. The case asserts what is provable: the call resolves rather than rejecting, and reports nothing. The sweep's own symlink cases have the same shape and prove continuation through their leak channel, which the read-only scan does not have.

## `actuals.tokens` basis

`12531` is `chars/4` over the **realized diff** (`git diff ef4df6c6..HEAD` additions: 50,122 characters), the same basis `113-03-SUMMARY.md` and `113-04-SUMMARY.md` used. The plan's `estimate.tokens: 100000` carried `confidence: low` and did not state its basis; the same caveat those summaries recorded applies — a calibrator comparing the two should settle the estimate's basis first.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. Four things the orchestrator inherits at phase close:

- **`REQUIREMENTS.md:108` still reads `WLIF-05, WLIF-06, WFLW-04 | Phase 113 | Pending (re-land)`.** WLIF-05 closed in `113-03`, WLIF-06 in `113-04` (and its uninstall-failure extension here), WFLW-04 in `113-01`. `113-04-SUMMARY.md` recorded that row as the orchestrator's to split at phase close, and this plan left it untouched.
- **`STATE.md` and `ROADMAP.md` were not touched by this plan.** No commit here contains either file.
- **The closed reason set is still 44 entries.** Task 4 added a stamping SITE, not a token; no closed-set transaction was needed.
- **`scanRetainedWorkflowsStaging` has exactly one caller.** A second read surface that wants the retained set should call it rather than widening the sweep — the sweep's `Promise<string[]>` signature and its two discarding call sites are unchanged and should stay that way.

No blockers.

---
*Phase: 113-update-enable-disable-reconcile*
*Completed: 2026-09-06*

## Self-Check: PASSED

- Files verified on disk: `orchestrators/plugin/workflows-staging-gc.ts`, `orchestrators/reconcile/pending.ts`, `orchestrators/plugin/uninstall.ts`, `orchestrators/plugin/install.ts`, `shared/notify.ts`, `shared/notify-context.ts`, `docs/output-catalog.md`, the four competitive-analysis documents, the five test files, and this summary.
- Commits verified in `git log`: `1a26bbaa`, `42b1fd4c`, `5eacab50`, `efe2ba41`.
- `STATE.md` and `ROADMAP.md`: `git log ef4df6c6..HEAD --name-only` names neither, in any commit. `REQUIREMENTS.md` was not touched either — its remaining `Pending (re-land)` row is the orchestrator's to close.
