---
phase: 07-gate-integrity
plan: 14
subsystem: testing
tags: [architecture-gates, vocabulary-guard, node-test, temp-root-control, d-75-01, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/temp-root-control.ts — withTempRoot / materializeTargets / plantOffender (07-01)"
  - phase: 07-gate-integrity
    provides: "the offenderLineFor pattern — derive the offender from the real target at plant time (07-05)"
  - phase: 07-gate-integrity
    provides: "the two stale install-flow test titles 07-11 found and left for this plan"
  - phase: 07-gate-integrity
    provides: "the reinstall-flow suite as 07-12 left it, so the repair applies to the migrated file"
provides:
  - "a vocabulary guard that reads the recursive unit-test tree it names: 279 -> 548 guarded files, 269 newly covered"
  - "a visitation clause asserting every policed `tests/` root contributed a file, with the counts in the failure message"
  - "a temp-root planted-offender control plus its unmutated benign half, both observed failing/passing"
  - "TOKEN_WAIVERS — six per-(file, token) waivers, each carrying its category and reason, each asserted load-bearing"
  - "the MSG-SD-1 retired soft-dep sentences added to the forbidden set, closing the two stale titles 07-11 routed here"
  - "168 of 175 retired-vocabulary lines repaired across 12 files; the remaining 7 are waived with reasons"
affects: [07-15, 07-16, gate-integrity, notification-vocabulary]

actuals:
  tokens: 96000
  tasks: 3
  commits: 3
  plan_head_before: 3a9ebd72eb43a17a40ef019194dcbb7c2798492a
  commits_note: >-
    `git rev-list --count 3a9ebd72..HEAD` returns 5, not 3. This plan ran
    concurrently with 07-13 on the same branch in a shared working tree, so the
    ledger range also contains that plan's two commits (3412d600, e2eca4c3).
    The three attributable to this plan are dbbf4a3d, f8c0dad4 and 9b9b4444;
    each is listed under Task Commits with its file list.

tech-stack:
  added: []
  patterns:
    - "Visitation by NAMED ROOT, not by file count: a walk that stopped matching still returns many files but stops naming one of the declared roots"
    - "Per-(file, token) waiver rows carrying a category and a reason, with a companion clause that fails when a row stops being load-bearing"
    - "An ABSENCE clause taking its source map as a parameter, so the same function the real run uses can be run against a temp-root copy"
    - "The offender derived from the target's own case TITLE, reproducing the exact defect class the widening exists for"

key-files:
  created: []
  modified:
    - tests/architecture/partial-vocabulary-guard.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/list-flow.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/domain/plugin-resolver.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/reinstall-record.test.ts
    - tests/edge/handlers/marketplace-seed.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "The waiver table carries six rows, not the plan's three. The plan's three homonym sites collapse to two (file, token) pairs because the guard filters by file, and three further rows were forced by sites the research census did not classify: a fourth homonym, a case whose SUBJECT is the retired token's rejection, and the retired-to-live mapping document. Every row is asserted load-bearing."
  - "`tests/edge/handlers/plugin/reinstall.test.ts` is waived rather than repaired. Its case proves reinstall REJECTS `--force`; the flag is the input argument and the echoed error text. Repairing it would delete a live regression proof, which the plan's own instruction routes to the SUMMARY rather than to a silent edit."
  - "The retired soft-dep sentences were added to the forbidden set so the two titles 07-11 found are caught by a clause rather than by this plan's diff. `docs/messaging-style-guide.md` is waived for them because that table's left column IS the retired form."
  - "Visitation is asserted by named root rather than by a file-count floor. A count floor passes on any large number; naming the ten policed roots fails the moment the walk stops reaching one."
  - "The widening ADDS: the extension tree and the two docs are unchanged, and the individually-named `catalog-uat` read was dropped only because the recursive walk now reaches it (the sanity clause still names that file, so the drop is checked)."

patterns-established:
  - "Pattern: a scanning clause takes `sources` as a parameter so the control can hand it a temp-root copy; a clause that can only read the repository can never be seen to fail"
  - "Pattern: a waiver is a row with a category and a reason, and a companion clause deletes it by failing when its file stops spelling its token"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "The vocabulary guard reads the recursive unit-test sources it claims to police, and proves which roots it reached"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: the recursive unit-test walk reached every policed root"
        status: pass
      - kind: command
        ref: "measured collected-file count 279 -> 548 (229 extension + 2 docs + 317 policed test sources); 269 newly covered"
        status: pass
    human_judgment: false
  - id: D2
    description: "The widened scope FIRES rather than merely reading more: a retired token planted in a copy of a real unit-test source fails the clause, and the unmutated copy passes"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: the widened scan fires on a retired token planted in a copy of a real unit-test source"
        status: pass
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: an unmutated copy of the same real unit-test source passes"
        status: pass
      - kind: other
        ref: "control C: `// force-installed` appended to the real tests/bridges/skills/stage.test.ts -> exactly one clause failed (force[- ]install), 57 pass 1 fail; reverted"
        status: pass
    human_judgment: false
  - id: D3
    description: "168 of the 175 retired-vocabulary lines are repaired; the remaining 7 are waived with a recorded category and reason"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "guard-token line census over policed tests/**: 175 lines / 14 files -> 7 lines / 4 files, all four waived"
        status: pass
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: every token waiver is load-bearing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every waiver is proved load-bearing by removal, and removing one fails exactly one clause"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "control A: the install-flow waiver row deleted -> exactly one clause failed (absent everywhere -- \"unsupported\"), 57 pass 1 fail; restored"
        status: pass
      - kind: other
        ref: "control B: the plantOffender call deleted -> exactly the offender clause failed, 57 pass 1 fail; restored"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two stale install-flow titles are repaired and a clause now catches their wording"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: absent everywhere (code + docs + unit tests) -- pi-subagents is not loaded"
        status: pass
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts#D-75-01 guard: absent everywhere (code + docs + unit tests) -- pi-mcp-adapter is not loaded"
        status: pass
    human_judgment: false
  - id: D6
    description: "No assertion changed and no durable ID was stripped; the slice holds under both complexity ceilings and the full gate"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c 'assert\\.' over all ten repaired suites: identical before and after (704/695/215/383/442/311/638/267/24/302)"
        status: pass
      - kind: other
        ref: "npx fallow health --fail-on-issues -> 0 above threshold, 12795 analyzed; npm run typecheck; npx eslint tests --max-warnings=0; npx prettier --check"
        status: pass
      - kind: unit
        ref: "npm test -> 5940 pass, 299 suites, 0 fail"
        status: pass
    human_judgment: false

duration: 78 min
completed: 2026-09-10
status: complete
---

# Phase 07 Plan 14: Vocabulary Guard Scope Extension Summary

**The guard's scope comment named `tests/**` while its walk read only `tests/architecture/*.ts` non-recursively; it now reads 548 files instead of 279, was observed failing on a retired token planted in a real unit-test source it had never opened, and carries six waivers that each fail their own clause when they stop being needed.**

## Performance

- **Duration:** 78 min
- **Started:** 2026-09-10T16:32:00Z
- **Completed:** 2026-09-10T17:50:00Z
- **Tasks:** 3 of 3
- **Files modified:** 12 (0 created, 12 modified)

## Accomplishments

- **Measured the census first, then repaired it.** Applying the guard's own token lists line-by-line to the 317 policed test sources found **175 matching lines across 14 files**, not the 137 across 12 the research census recorded. Sibling work in this phase and the file splits moved lines; two files research never listed were carrying hits. The repair worked from the measurement.
- **Widened `collectGuardedSources()` and proved the widening reaches ground.** The guard now reads `tests/**/*.ts` recursively minus itself and minus `tests/e2e` / `tests/integration`. Measured: **279 -> 548** guarded files (229 extension `.ts` + 2 docs + 317 policed test sources), **269 newly covered**.
- **Proved it FIRES on a file it had never opened.** Appending one `// force-installed` line to the real `tests/bridges/skills/stage.test.ts` — a root the old guard did not walk — failed exactly one clause. That is the difference between reading more files and policing them.
- **Built the temp-root controls on 07-01's mechanic and 07-05's derived-offender pattern.** The offender is built from a case TITLE the target really declares, which reproduces the exact defect class this widening exists for: retired vocabulary in a test title, invisible to any guard that reads only assertion bodies.
- **Replaced the ad-hoc `.filter(f => f !== ALLOW)` shape with a declared waiver table**, and added the clause that keeps it honest — a row whose file stops spelling its token, or whose token stops being forbidden, fails.
- **Closed the two stale titles 07-11 routed here by adding a clause, not just by editing them.** `pi-subagents is not loaded` / `pi-mcp-adapter is not loaded` are now forbidden tokens, so the repair cannot silently regress.

## Task Commits

1. **Task 1: Repair the three largest suites' retired vocabulary** — `dbbf4a3d` (test)
   - `tests/orchestrators/plugin/install-flow.test.ts` (+45 −45)
   - `tests/orchestrators/plugin/list-flow.test.ts` (+56 −51)
   - `tests/orchestrators/plugin/update-flow.test.ts` (+54 −50)
2. **Task 2: Repair the five mid-sized suites** — `f8c0dad4` (test)
   - `tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/orchestrators/plugin/reinstall-flow.test.ts`, `tests/shared/notification-dispatch.test.ts` (+60 −57 total)
3. **Task 3: Widen the guard, waive the homonyms, and prove it fires** — `9b9b4444` (test)
   - `tests/architecture/partial-vocabulary-guard.test.ts` (+295 −27)
   - `tests/edge/handlers/marketplace-seed.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/plugin/reinstall-record.test.ts` (7 lines)

## Per-file match counts, measured before and after

Method: apply the guard's `ABSENT_FLAGS`, `ABSENT_STATUS_LITERALS`, `ABSENT_RENDER_TOKENS`,
`ABSENT_IDENTIFIERS`, `ABSENT_FORCE_PROSE`, the backtick-verdict regex and the
`` `(unsupported)` `` render token to every policed test source, counting distinct LINES.

| File | Research census | Measured before | After | Disposition of the remainder |
|------|----------------:|----------------:|------:|------------------------------|
| `tests/orchestrators/plugin/install-flow.test.ts` | 37 | 42 | 1 | waived (homonym) |
| `tests/orchestrators/plugin/list-flow.test.ts` | 29 | 42 | 0 | — |
| `tests/orchestrators/plugin/update-flow.test.ts` | 37 | 40 | 0 | — |
| `tests/orchestrators/plugin/info.test.ts` | 7 | 14 | 0 | — |
| `tests/domain/plugin-resolver.test.ts` | 4 | 10 | 0 | — |
| `tests/shared/notification-dispatch.test.ts` | 9 | 9 | 0 | — |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 4 | 6 | 0 | — |
| `tests/edge/handlers/plugin/reinstall.test.ts` | 3 | 3 | 3 | waived (subject) |
| `tests/orchestrators/marketplace/update.test.ts` | 3 | 3 | 0 | — |
| `tests/platform/pi-api.test.ts` | 2 | 2 | 2 | waived (homonym) |
| `tests/edge/handlers/marketplace-seed.ts` | *(absent)* | 1 | 0 | census miss, repaired |
| `tests/orchestrators/plugin/enable-disable.test.ts` | *(absent)* | 1 | 0 | census miss, repaired |
| `tests/orchestrators/plugin/reinstall-record.test.ts` | 1 | 1 | 0 | — |
| `tests/persistence/state-io.test.ts` | 1 | 1 | 1 | waived (homonym) |
| **Total** | **137 / 12 files** | **175 / 14 files** | **7 / 4 files** | **168 repaired** |

### Why the before count is 175 and not 137

Three causes, all measured rather than inferred:

1. **`reinstall-flow.test.ts` grew from 4 to 6** — `07-12` rewrote 54 call sites in that file, which
   moved two comment blocks that carry the retired wording. This is the drift the plan asked to
   re-measure rather than trust.
2. **`info.test.ts` (7 -> 14), `plugin-resolver.test.ts` (4 -> 10), `list-flow.test.ts` (29 -> 42),
   `install-flow.test.ts` (37 -> 42), `update-flow.test.ts` (37 -> 40)** — the research census
   appears to have counted a narrower token set (it does not reach the `` `(unsupported)` ``
   render-token clause, which contributes several of the extra lines).
3. **Two files research did not list at all** (below).

### Census misses

Both are outside this plan's `files_modified`. Per the plan's instruction — "that is a file
research's census missed: repair it and record it, do not add an allowlist entry to make the
run green" — both were repaired, not waived.

| File | Line | Text | Repair |
|------|-----:|------|--------|
| `tests/edge/handlers/marketplace-seed.ts` | 38 | ``reproduces a record that resolved `unsupported` at install time`` | `` `partially-available` `` |
| `tests/orchestrators/plugin/enable-disable.test.ts` | 342 | ``the kind listed in `unsupported`)`` | ``the kind listed in the `unsupported` array)`` — the component-kind ARRAY sense the guard's existing lookahead already allows |

## The six waivers

The plan budgeted **three**. The guard carries **six**. The gap is explained line by line here
and recorded as deviation 1.

| # | File | Token | Category | Why |
|---|------|-------|----------|-----|
| 1 | `tests/platform/pi-api.test.ts` | `"unsupported"` | homonym | Two `@ts-expect-error` boundary probes (`:96`, `:100`) spell a deliberately-invalid Pi `AgentMessage` role and a deliberately-invalid Pi `StopReason`. Both name Pi-side values. **This is the plan's homonyms 1 and 2 — one row, because the guard filters by file.** |
| 2 | `tests/persistence/state-io.test.ts` | `"unsupported"` | homonym | `:462` — a legacy `state.json` fixture spells the persisted `compatibility.unsupported` component-kind KEY. **The plan's homonym 3.** |
| 3 | `tests/orchestrators/plugin/install-flow.test.ts` | `"unsupported"` | homonym | `:5640` — `Object.hasOwn(clean, "unsupported")` reads the SAME field as row 2, as a property key. NREG-01 needs the absent-key fact, which cannot be asserted without naming the key. **Research did not classify this one.** |
| 4 | `tests/edge/handlers/plugin/reinstall.test.ts` | `--force` | subject | `:807`, `:815`, `:819` — the case proves reinstall REJECTS the retired flag (RINST-01 / D-67-03). The flag is the input argument and the echoed `Unknown flag: "--force".` message. **Research classified these three as repairable; they are not.** |
| 5 | `docs/messaging-style-guide.md` | `pi-subagents is not loaded` | mapping | `:166` — the retired-to-live table's left column. |
| 6 | `docs/messaging-style-guide.md` | `pi-mcp-adapter is not loaded` | mapping | `:167` — the same table's second soft-dependency row. |

Rows 5 and 6 exist only because this plan ADDED those two tokens to the forbidden set
(deviation 2); they are not waivers against a pre-existing clause.

Every row is checked by `D-75-01 guard: every token waiver is load-bearing`, which fails when a
row's file stops spelling its token or when the token stops being forbidden. That clause is also
a second, independent visitation proof: rows 1-4 can only pass because the recursive walk
actually opens those four unit-test files.

## Controls observed

Three, each performed against the committed guard and reverted:

1. **Waiver removed (the plan's required observation).** Deleting waiver row 3 (the
   `install-flow.test.ts` / `"unsupported"` row) failed **exactly one** case —
   `D-75-01 guard: absent everywhere (code + docs + unit tests) -- "unsupported"` — leaving 57
   passing. Restored: 58 pass, 0 fail.
2. **Plant removed.** Deleting the `plantOffender(...)` call from the offender case failed
   **exactly** that case, 57 pass 1 fail. Without this, the offender case would have been
   indistinguishable from one that never planted anything.
3. **Retired token planted in a REAL newly-covered file.** Appending `// force-installed` to
   `tests/bridges/skills/stage.test.ts` — a root the old, non-recursive walk never opened —
   failed **exactly one** case, `D-75-01 guard: force-family prose absent -- force[- ]install`.
   Restored; `git status` clean for that path. This is the control that distinguishes "the guard
   reads 269 more files" from "the guard polices 269 more files".

## Collected-file count, before and after

| | Before | After |
|---|-------:|------:|
| extension `.ts` | 229 | 229 |
| user-facing docs | 2 | 2 |
| `tests/architecture/*.ts` (flat, minus self) | 47 | — |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` (named individually) | 1 | — |
| policed `tests/**/*.ts` (recursive, minus self / e2e / integration) | — | 317 |
| **Total** | **279** | **548** |

The 47 + 1 rows are subsumed by the 317: the recursive walk reaches both the flat
`tests/architecture/*.ts` files and the nested `catalog-uat` contract, and the sanity clause
still names that contract by path so the drop is checked rather than assumed.

## Durable IDs preserved — five spot-checks

Every repaired title kept its requirement and decision identifiers; only the vocabulary around
them changed.

| # | Before | After |
|---|--------|-------|
| 1 | `PHOOK-04: install --force stages a strict-subset hooks.json ...` | `PHOOK-04: install --partial stages a strict-subset hooks.json ...` |
| 2 | `SEV-01 / SEV-02 / FSTAT-07 / D-71-06: partial-hook install blocks without --force (error + hint), degrades to info force-installed with --force` | `SEV-01 / SEV-02 / FSTAT-07 / D-71-06: partial-hook install blocks without --partial (error + hint), degrades to info partially-installed with --partial` |
| 3 | `LIST-01 / D-67-01: a force-installed plugin shows under --installed (A1) and is ABSENT under --unsupported` | `LIST-01 / D-67-01: a partially-installed plugin shows under --installed (A1) and is ABSENT under --partial` |
| 4 | `XSURF-03 / FORCE-03: without --force the force-upgradable candidate declines ... + the --force trailer at warning` | `XSURF-03 / FORCE-03: without --partial the partially-upgradable candidate declines ... + the --partial trailer at warning` |
| 5 | `FSTAT-01 / D-64-02: the force-installed row's reasons are the narrowUnsupportedKinds dropped-component markers` | `FSTAT-01 / D-64-02: the partially-installed row's reasons are the narrowUnsupportedKinds dropped-component markers` |

`FORCE-01` .. `FORCE-05`, `FSTAT-01` .. `FSTAT-07`, `SEV-01` .. `SEV-04`, `PHOOK-02` ..
`PHOOK-05`, `LIST-01`, `USTAT-01`, `XSURF-01` / `-03`, `WR-02` / `-03` / `-08`, `RINST-01`,
`BFILL-01`, `NREG-01`, `IN-02`, `RSTATE-02` / `-05`, `CR-01`, `UGRM-01` / `-02`, `SNM-11`,
`INFO-05`, `ENBL-07`, `CMC-13`, `MSG-SD-1` / `-2`, `PI-11` / `-12`, `RH-3` / `-4` and every
`D-NN-NN` survive unchanged. No planning-artifact reference (phase / plan / wave / task number)
was introduced; one pre-existing `Phase-73` reference was dropped from an `update-flow.test.ts`
comment while repairing the surrounding retired wording, which the comment rule requires anyway.

## No assertion changed

`grep -c "assert\."` and `grep -cE '^\s*(test|it)\('` over every repaired file, before and
after — identical in all ten:

| File | `assert.` | cases |
|------|----------:|------:|
| `install-flow.test.ts` | 704 | 126 |
| `update-flow.test.ts` | 695 | 139 |
| `list-flow.test.ts` | 215 | 88 |
| `notification-dispatch.test.ts` | 383 | 190 |
| `info.test.ts` | 442 | 133 |
| `plugin-resolver.test.ts` | 311 | 139 |
| `reinstall-flow.test.ts` | 638 | 114 |
| `marketplace/update.test.ts` | 267 | 57 |
| `reinstall-record.test.ts` | 24 | 5 |
| `enable-disable.test.ts` | 302 | 65 |

One fixture VALUE changed: `tests/orchestrators/plugin/reinstall-record.test.ts:249`'s
`reasons: ["unsupported"]` became `reasons: ["unsupported component"]`. It is inert input —
`reinstallReasonsFromError` maps any `PluginShapeError` to `["source mismatch"]` regardless of
`reasons`, and the case's assertion on that call is unchanged. `PluginShapeError.shape.reasons`
is typed `readonly string[]` (free-form resolver text), not the closed 44-member `REASONS` set,
so the bare `"unsupported"` named no live reason, which is why research classified it as stale
rather than as a homonym.

## Exported-symbol delta (for 07-15's census)

**None.** `git diff 3a9ebd72..HEAD -- tests/architecture/partial-vocabulary-guard.test.ts | grep -E '^[+-]export'`
returns nothing. Every symbol this plan added to the guard is module-private:
`POLICED_TEST_ROOTS`, `UNPOLICED_TEST_ROOTS`, `TEST_ROOT`, `TokenWaiver` (interface),
`TOKEN_WAIVERS`, `ABSENT_SOFT_DEP_PROSE`, `ABSENT_TOKENS`, `CONTROL_TARGET`, `CONTROL_TOKEN`,
`FIRST_TEST_TITLE`, `isPolicedTestSource`, `collectTreeSources`, `waivedFor`, `unwaivedHits`,
`offenderLineFor`, `sourcesUnder`. One module-private constant was **removed**: `ARCH_DIR`
(the non-recursive walk's root, now unreachable). No file outside the guard gained or lost an
export.

## Case counts

| | Count |
|---|---|
| `tests/architecture/partial-vocabulary-guard.test.ts` | **58 pass, 0 fail** (was 50) |
| `npm test` (whole unit suite) | **5940 pass, 299 suites, 0 fail** |
| the same count `07-06` recorded | 5924 |

The +16 is 8 from this plan (2 controls, 1 visitation clause, 1 waiver clause, 2 soft-dep token
clauses, and the token loop gaining rows) and the remainder from `07-13`, which committed to the
same branch during this run.

## Registry gap recorded for 07-16

The controls need to name one **test** source (`CONTROL_TARGET = "tests/domain/plugin-resolver.test.ts"`)
and the walk needs the ten policed `tests/` root names. `tests/architecture/gate-targets.ts`
holds production paths only and has no group for either, and nobody owned that file this wave, so
both are declared locally in the guard with doc blocks. If `07-16`'s self-hosting meta-gate treats
a test path named under `tests/architecture/**` as an offender, it needs a
`VOCABULARY_GUARD_TEST_TARGETS` group (one entry) and a `POLICED_TEST_ROOTS` group (ten entries),
or an explicit carve-out saying test paths are out of the registry's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The waiver table carries six rows, not the plan's three**

- **Found during:** Task 3
- **Issue:** The plan budgets "exactly three allowlist entries, each scoped to one path and one
  token", derived from research's three homonym SITES. Three separate facts break that budget.
  (a) The guard filters by FILE, so the plan's two `pi-api.test.ts` sites are one (file, token)
  row, not two. (b) `install-flow.test.ts:5640` spells `"unsupported"` as a property key on the
  live `compatibility.unsupported` component-kind field — the same homonym as the
  `state-io.test.ts` fixture the plan itself calls out — and research did not classify it.
  (c) `reinstall.test.ts`'s three lines are not repairable (see deviation 3).
- **Fix:** A declared `TOKEN_WAIVERS` table of six rows, each carrying `file`, `token`, a
  `category` (`homonym` / `subject` / `mapping`) and a prose `why`. The `.filter(...)` mechanic
  the plan names is preserved — `unwaivedHits` filters `filesContaining` by the rows matching the
  token. A companion clause fails when a row stops being load-bearing, which is strictly stronger
  than the plan's three bare `f !== ALLOW` filters: a stale filter is invisible, a stale row fails.
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts`
- **Verification:** control 1 above — deleting one row fails exactly one clause. All six rows
  pass the load-bearing clause.
- **Committed in:** `9b9b4444`

**2. [Rule 2 - Missing critical] The retired soft-dep sentences were added to the forbidden set**

- **Found during:** Task 3
- **Issue:** `07-11` found two `install-flow.test.ts` titles (`:2765`, `:2810`) still quoting
  `'pi-subagents is not loaded'` / `'pi-mcp-adapter is not loaded'` while their assertions
  correctly match `{requires pi-subagents}` / `{requires pi-mcp}`. This plan's success criterion
  requires that the titles be repaired **and that the guard would catch them**. No token list
  covered that wording, so repairing the titles alone would have left the regression unguarded —
  precisely the failure mode this phase exists to close.
- **Fix:** `ABSENT_SOFT_DEP_PROSE` adds the two retired sentences (MSG-SD-1). The two titles now
  read `-> the success row carries the {requires pi-subagents} marker` and
  `-> the success row carries the {requires pi-mcp} marker`. `docs/messaging-style-guide.md` is
  waived for both (waiver rows 5 and 6) because that document's retired-to-live table names the
  retired form in its left column. `docs/prd/pi-claude-marketplace-prd.md` is scanned separately
  and is unaffected: its PI-11 / PI-12 requirement rows still state the retired wording, which is
  a PRD-content question outside this plan.
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts`,
  `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** both new clauses pass; `grep -c "is not loaded" tests/` returns 0 for the two
  retired sentences.
- **Committed in:** `9b9b4444`

**3. [Rule 3 - Blocker] `tests/edge/handlers/plugin/reinstall.test.ts` is waived, not repaired**

- **Found during:** Task 3
- **Issue:** The plan instructs "Repair the two remaining genuine sites first:
  `tests/edge/handlers/plugin/reinstall.test.ts` (3 lines) and
  `tests/orchestrators/plugin/reinstall-record.test.ts:249`". The reinstall-record site was
  repaired. The reinstall.test.ts site cannot be: the case
  `rejects an overwrite flag (--force) as an unknown flag rather than accepting it (RINST-01 / D-67-03)`
  passes `"alpha@mp --force"` as its INPUT and asserts the exact reply
  `` `Unknown flag: "--force".\n\n${REINSTALL_USAGE}` ``. Renaming the flag would make the case
  assert that some other flag is rejected and would delete the D-67-03 regression proof
  outright.
- **Fix:** Waiver row 4, category `subject`, with the reason recorded at the row. This is the
  same category the guard already applies to itself ("this file necessarily spells the retired
  tokens out to forbid them"): a token cannot be proved rejected without being named. The plan's
  own Task 1 instruction routes exactly this case here — "If a repair would require changing an
  expected string, stop and record it: that is a behaviour question, not a vocabulary one, and it
  belongs in the SUMMARY rather than in a silent edit."
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts` (the waiver row);
  `tests/edge/handlers/plugin/reinstall.test.ts` is **unchanged**.
- **Verification:** the load-bearing clause proves the row is needed; removing it fails the
  `--force` clause.
- **Committed in:** `9b9b4444`

**4. [Rule 3 - Blocker] Two files outside `files_modified` were repaired**

- **Found during:** Task 3
- **Issue:** `tests/edge/handlers/marketplace-seed.ts:38` and
  `tests/orchestrators/plugin/enable-disable.test.ts:342` each carry one retired-vocabulary line
  that research's census did not list. With the widened scope they turn the guard red.
- **Fix:** Both repaired (one line each, comment prose only). Neither is owned by the concurrent
  `07-13` plan, whose single file is `tests/architecture/no-test-only-production-surface.test.ts`.
  Per the plan's explicit instruction, a census miss is repaired and recorded rather than waived.
- **Files modified:** `tests/edge/handlers/marketplace-seed.ts`,
  `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** `node --test` on both files' suites passes; assert and case counts for
  `enable-disable.test.ts` unchanged (302 / 65); `marketplace-seed.ts` declares no case.
- **Committed in:** `9b9b4444`

**5. [Rule 3 - Blocker] `collectTreeSources` extracted so the second walk is not a clone**

- **Found during:** Task 3
- **Issue:** The extension walk and the new `tests/` walk are the same seven-line
  `readdirSync(..., { recursive: true, withFileTypes: true })` / filter / `readInto` sequence.
  `.fallowrc.json` sets `duplicates.threshold: 3`, and a third such walk elsewhere would complete
  a reportable clone group.
- **Fix:** One `collectTreeSources(root, include)` helper; `collectExtensionSources` becomes
  `collectTreeSources(EXT_ROOT, () => true)`. The `include` predicate is what carries the
  self-exclusion and the e2e / integration exclusion, so those are stated once.
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts`
- **Verification:** `npx fallow health --fail-on-issues` reports `0 above threshold · 12795
  analyzed`; `npx fallow dupes` puts the guard in no clone group.
- **Committed in:** `9b9b4444`

---

**Total deviations:** 5 auto-fixed (2 × Rule 2 - missing critical, 3 × Rule 3 - blocking issue).
**Impact on plan:** No weakened assertion and no scope creep into another agent's files.
Deviations 1 and 3 make the waiver mechanism stricter than the plan's shape (a declared,
self-checking table instead of three bare filters) while exceeding the plan's count; both are
recorded here line by line so the count can be audited rather than trusted. Deviation 2 adds one
clause the plan did not specify but its success criterion requires. Deviations 4 and 5 are
consequences of measuring rather than inheriting the census, and of a repository gate the plan
itself names.

## Issues Encountered

**The research census under-counted by 38 lines and missed two files.** Recorded in full above.
The plan anticipated drift in `reinstall-flow.test.ts` (from `07-12`) and asked for a
re-measurement there; the drift is broader than that one file. `07-16` should not treat
`07-RESEARCH.md` §8's table as a baseline.

**Research misclassified `tests/edge/handlers/plugin/reinstall.test.ts` as repairable.** Its three
lines are the retired flag under test, not stale prose. See deviation 3. Any future plan reading
§8's "Three of those 137 hits are out-of-scope homonyms" should read it as "at least six of the
175 hits are not repairable, in three distinct categories".

**Sibling noise on the shared tree.** This plan and `07-13` committed to the same branch in one
working tree. Every `pre-commit run` and `npm test` in this run was clean, but the ledger range
`3a9ebd72..HEAD` contains `07-13`'s two commits, and the `npm test` count (5940) includes its
cases. No sibling file was edited; `git status` was inspected before each of the three commits and
showed only this plan's paths (plus the operator's own untracked and pre-modified files, which were
never staged).

**The `WINDOWS.md` ledger still cannot be appended to.** `gsd-tools windows append` refuses with
`Ledger table … disagrees with the fenced JSON entries (the sole source of truth) for row id(s):
30, 9` — the same desync `07-01` and `07-02` recorded, unchanged and predating all three. The one
item this plan owed the ledger (the three waivers beyond the plan's budget) is recorded in
deviation 1 instead. The desync still wants reconciling before the ship gate reads it.

**One thing this plan did NOT do.** The guard still does not forbid the bare words `force` and
`unsupported`, by design — they are the fs/git overwrite homonym and the component-kind homonym,
and the guard's header says so. Consequently a handful of local bindings (`noForce`, `forced`,
`forcedMsg`, `makeCandidateUnsupported`) and bare-word test titles (`-> unsupported`) still read in
the retired register even though every guarded token around them is repaired. Narrowing or widening
that boundary is a vocabulary decision, not a gate-integrity one, and it belongs in whichever plan
owns the token lists rather than in a silent edit here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **`07-15` (unowned-export census):** this plan added and removed **zero** exports. The
  module-private symbol delta is listed above so the attribution is complete either way.
- **`07-16` (self-hosting meta-gate):** the registry gap is recorded above. Two literals are
  declared locally in the guard because no registry group fits a test path.
- **Anyone extending the token lists:** add the token to `ABSENT_TOKENS` and let the
  load-bearing clause tell you whether an existing waiver was silently covering it. A waiver whose
  token is not in `ABSENT_TOKENS` now fails, so the two lists cannot drift apart.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All twelve modified files present on disk; `.planning/phases/07-gate-integrity/07-14-SUMMARY.md` present.
- `dbbf4a3d`, `f8c0dad4`, `9b9b4444` — all reachable in `git log --oneline --all`.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `eslint.config.js` and `tests/architecture/gate-targets.ts` — no diff against HEAD; none was touched.
- `node --test tests/architecture/partial-vocabulary-guard.test.ts` — 58 pass, 0 fail. `npm test` — 5940 pass, 0 fail.
