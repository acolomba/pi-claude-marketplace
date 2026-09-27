---
phase: 116-load-time-workflow-convergence
plan: 01
subsystem: api
tags: [reconcile, backfill, notify, closed-set, output-catalog, node-test]

requires:
  - phase: 115-install-time-admission-gate-warnings
    provides: the `workflows` component kind, its resolver support and the `PluginTree.workflow` fixture knob the WCONV-01 case seeds against
provides:
  - the load-time backfill scan widened from partially-installed records to every recorded plugin, with `supportedSetGrew` as the sole promotion gate
  - the closed-set reason token `components now supported`, appended at the tail of `REASONS` in all five of its derivations
  - both render arms of `backfilledRowFromOutcome` carrying that token from one shared prelude line
  - the two published backfill catalog states re-byted, with the prose that claimed a backfilled row can render brace-less rewritten
affects: [116-02, 116-03, 116-04, 114 re-verification]

actuals:
  tokens: 9077        # chars/4 over the realized diff, 3e10c506..HEAD
  tasks: 3
  commits: 3          # MEASURED: git rev-list --count 3e10c506..HEAD
plan_head_before: 3e10c50663c131bc69167dfffc7eaa978cbb5485

tech-stack:
  added: []
  patterns:
    - "Widen a filter by deletion, so the growth policy is stated in exactly one place"
    - "A closed-set amendment moves all five derivations in one commit, and the three silently-green prose counts are fixed by inspection in the same commit"
    - "A new reason token rides an existing outcome and is stamped in a shared prelude both render arms read, so 'both arms carry it' is true by construction rather than by two edits that can drift"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/shared/notify.test.ts
    - tests/index.test.ts

key-decisions:
  - "Token spelling fixed as `components now supported` (D-116-02 delegated it): the widened scan promotes any record whose supported set strictly grew, so a token naming the `workflows` kind would be false about most of the rows it rides"
  - "`hasForceInstalledPlugin`'s predicate left byte-unchanged (D-116-04); only its doc's false `only kind` claim was corrected"
  - "The two red `tests/index.test.ts` cases repaired at the fixture seed by closing the version gate (D-116-05); no notification-boundary count literal moved"
  - "The `installed` arm's conditional `reasons` spread replaced with an unconditional assignment — the prelude always places a token, so the guard could no longer be false"

patterns-established:
  - "Negative control before belief: three controls were RUN and their failing transcripts pasted verbatim below"
  - "The retired-policy site set is derived by TWO methods whose results are disjoint, and both counts are reported"

requirements-completed: [WCONV-01, WCONV-03]

coverage:
  - id: D1
    description: "A cleanly-installed record (`installable: true`) whose offline re-resolution yields a strictly larger supported set is re-materialized on one load: the record's supported set grows to include `workflows`, its `resources.workflows` names the generated command, the envelope lands in the host engine's saved directory, and no clone is attempted"
    requirement: WCONV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WCONV-01: promotes a cleanly-installed record whose supported set grew"
        status: pass
      - kind: unit
        ref: "negative control — restore `if (record.compatibility.installable) return false;`, case goes RED (transcript below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The recorded `version` and `installedAt` survive the promotion unchanged, and the counting git fake reports an empty clone-URL list"
    requirement: WCONV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WCONV-01: promotes a cleanly-installed record whose supported set grew"
        status: pass
    human_judgment: false
  - id: D3
    description: "`components now supported` is a legal member of the closed `REASONS` set at the tail, at the new length 46, in every one of the five independent derivations of that set"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 46-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "npm run typecheck (`_ReasonsCoverageProof` + its test-side twin)"
        status: pass
      - kind: unit
        ref: "negative control — remove the token from `REASONS` only: tsc errors twice, three locks red (transcript below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A backfilled row carries the convergence token on BOTH the `installed` and the `partially-installed` arm, from one shared prelude line, with severity unchanged"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts — six whole-row `deepStrictEqual` cases across both arms"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#BFILL-01: one cascade carries a backfill promotion row beside a fresh install row and no reload trailer"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two published backfill catalog states show the bytes the row now renders, and their prose no longer asserts what stopped being true"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: unit
        ref: "negative control — one byte changed inside a re-byted fenced block, `[BYTE MISMATCH]` reported (transcript below)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The bounded-population claim inherited from CONTEXT.md — are the Anthropic-authored workflow plugins path-source or git-source?"
    requirement: WCONV-01
    verification: []
    human_judgment: true
    rationale: "A fact about upstream repositories, not about this tree. The local measurement below narrows it but does not close it: zero plugins in either cached marketplace carry a `workflows/` component directory at all, so the specific two-plugin claim could not be confirmed from this machine."

duration: 36min
completed: 2026-09-09
status: complete
---

# Phase 116 Plan 01: Load-time workflow convergence Summary

**The load-time backfill scan now reaches the population whose install already worked — the one that never converged — and a converged plugin's row says why its commands appeared.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-09-09T14:28:00Z
- **Completed:** 2026-09-09T15:04:00Z
- **Tasks:** 3 of 3
- **Files modified:** 13

## Accomplishments

- Deleted the `if (record.compatibility.installable) return false;` early return in `backfillOnePluginIsolated`, leaving `supportedSetGrew` as the sole promotion gate (D-116-01). One line of production change carries all of WCONV-01: a record seeded `installable: true, supported: ["skills"]` against a source tree carrying a clean skill and a runnable workflow is promoted on one load, its `resources.workflows` names the generated command, the envelope lands in the host engine's saved directory, and no clone is attempted.
- Appended `components now supported` at the tail of the closed `REASONS` set and moved all five of its derivations in one commit, plus the three prose counts that stay silently green.
- Stamped the token as the first element of `backfilledRowFromOutcome`'s shared `reasons` prelude, so both render arms carry it by construction. A convergence can no longer render byte-identically to a fresh install (T-116-07).
- Re-byted the two published backfill catalog states and rewrote the two prose paragraphs and one H3 heading that asserted a backfilled row can render brace-less.

## Task Commits

1. **Task 1: End-to-end promotion of a cleanly-installed record whose set grew** — `f96143d4` (feat)
2. **Task 2: Amend the closed reason set, in all five derivations at once** — `a42a7e04` (feat)
3. **Task 3: Stamp the token on both render arms and re-byte the two published states** — `507d376d` (feat)

**Plan metadata:** this SUMMARY (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` — the filter deletion; twelve comment sites restated in present tense, including the amended D-68-03 charter that now names the scan's real bound (path-source only)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `components now supported` appended at the tail of `REASONS`; the `46-entry` prose count
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the same literal given a home in `CommandPrivateReason`; two `46-entry` prose counts and one running-ledger sentence
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — one line in the shared `reasons` prelude; the `installed` arm's now-always-true conditional spread made unconditional
- `docs/output-catalog.md` — both backfill states' fenced blocks, both prose paragraphs, the second state's H3 heading
- `tests/orchestrators/reconcile/backfill.test.ts` — the WCONV-01 promotion case
- `tests/orchestrators/reconcile/notify.test.ts` — six whole-row expectations turned
- `tests/orchestrators/reconcile/apply.test.ts` — the rendered-cascade expectation turned
- `tests/architecture/catalog-uat.test.ts` — the two `FIXTURES` entries and their comments; the corpus-count lock is byte-unchanged
- `tests/architecture/notify-closed-set-locks.test.ts` — length lock 45 → 46, one new ledger entry, and the test's own title
- `tests/architecture/compat-01-no-expansion.test.ts` — the literal appended to the `expected` array's tail
- `tests/shared/notify.test.ts` — the `REASONS.length` assertion 45 → 46
- `tests/index.test.ts` — `seedEnabledPlugin` writes a closed version gate

## The token spelling, and why it names no component kind

The token is **`components now supported`**.

It states the cause without naming a kind because the widened scan promotes ANY record whose supported set strictly grew — a path-source plugin that gained a `skills/`, `commands/` or `agents/` directory converges on the same path — so a token reading "workflows arrived" would be a false statement about most of the population it fires on.

It composes as `{components now supported, requires pi-dynamic-workflows}` on the real population's likely first render, and as `{components now supported, lsp}` on the degraded arm.

## The retired-policy site set: two methods, two counts, disjoint results

| Method | Count | What it found |
|---|---|---|
| **By removal** (delete the filter, run `npm test`, treat every red as a member) | **2** | `tests/index.test.ts:601` (PENV-01) and `:722` (NFR-2 recompute-refused), both on an unexpected third `getAllTools()` — one extra cascade emission over a seed whose `marketplaceRoot` no case creates. Zero tests in the owner suite `tests/orchestrators/reconcile/backfill.test.ts` reddened. |
| **By grep** (`grep -n installable` over `orchestrators/reconcile/`, plus reading the surrounding sentences) | **12** | All in `backfill.ts`. Comment prose asserting the deleted policy. |

**The two sets are disjoint.** Neither alone is the answer: the removal method finds only what a gate covers, and no gate covers a comment; the grep finds only prose, and no prose reddens.

The research's grep list named **7** of those 12 sites. The 5 it did not name, found by reading each hit's surrounding sentence rather than the line the grep printed:

1. `applyBackfillForScope` doc, WR-01 paragraph — "With zero partially-installed plugins **to promote**"
2. `applyBackfillForScope` doc, stamp-on-gate-open paragraph — "even with zero partially-installed plugins **to promote**"
3. The `SF-02` inline comment above the `anyFailure` return — "a **partially-installed plugin** was scanned but its backfill FAILED"
4. `scanForceInstalledBackfills` doc, RECON-04 paragraph — "may have re-materialized a **partially-installed plugin** in the SAME load"
5. The `ENBL-08` inline comment — "so **the filter above** does not cover this one", a sentence whose referent the deletion removed. This one does not contain the word `installable` at all, so no `installable` grep could ever have found it.

That is this milestone's recurring defect in its exact shape, one more time: an enumeration shorter than the set it names.

## Negative controls — all three RUN, transcripts verbatim

### Control 1 — restore the deleted filter, the WCONV-01 case must go RED

Planted `if (record.compatibility.installable) { return false; }` back at the head of `backfillOnePluginIsolated`, changing nothing else.

```
▶ scanForceInstalledBackfills
  ✖ WCONV-01: promotes a cleanly-installed record whose supported set grew (36.155393ms)
✖ scanForceInstalledBackfills (41.706711ms)
ℹ tests 1
ℹ suites 1
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2853.258411

✖ failing tests:

test at tests/orchestrators/reconcile/backfill.test.ts:1569:3
✖ WCONV-01: promotes a cleanly-installed record whose supported set grew (36.155393ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + []
  - [
  -   {
  -     dependencies: [],
  -     installable: true,
  -     kind: 'plugin-backfilled',
  -     marketplace: 'mp',
  -     plugin: 'hello',
  -     scope: 'project',
  -     unsupported: [],
  -     version: '1.0.0'
  -   }
  - ]

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/orchestrators/reconcile/backfill.test.ts:1611:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Promise.all (index 12)
      at async Suite.run (node:internal/test_runner/test:1905:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [],
    expected: [ { kind: 'plugin-backfilled', scope: 'project', marketplace: 'mp', plugin: 'hello', version: '1.0.0', dependencies: [], installable: true, unsupported: [] } ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

Filter removed again; the case is green. This control matters more than usual here: nothing on this tree pinned that a cleanly-installed record is skipped, so the WCONV-01 case is net-new rather than a red-to-green flip, and this run is the only proof it discriminates.

### Control 2 — remove the token from `REASONS` only, the locks must go RED

Deleted `"components now supported",` from the tuple in `shared/notify.ts`, leaving every other edit of Task 2 in place.

```
$ npm run typecheck

> pi-claude-marketplace@0.19.0 typecheck
> tsc --noEmit

extensions/pi-claude-marketplace/shared/notify-reasons.ts(302,83): error TS2344: Type '"components now supported"' does not satisfy the constraint 'never'.
tests/shared/notify-reasons.test.ts(48,12): error TS1360: Type 'true' does not satisfy the expected type 'false'.
```

```
$ node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notify.test.ts
✖ COMPAT-01: REASONS holds exactly its inherited members, in order (6.857383ms)
✖ OUT-08: REASONS is the closed 46-entry reason set (3.27026ms)
✖ closed notification constants preserve exact public values (1.90384ms)
ℹ tests 273
ℹ suites 0
ℹ pass 270
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2492.653323
✖ failing tests:
test at tests/architecture/compat-01-no-expansion.test.ts:127:1
✖ COMPAT-01: REASONS holds exactly its inherited members, in order (6.857383ms)
test at tests/architecture/notify-closed-set-locks.test.ts:29:1
✖ OUT-08: REASONS is the closed 46-entry reason set (3.27026ms)
test at tests/shared/notify.test.ts:4938:1
✖ closed notification constants preserve exact public values (1.90384ms)
```

The two failure bodies:

```
test at tests/architecture/compat-01-no-expansion.test.ts:127:1
✖ COMPAT-01: REASONS holds exactly its inherited members, in order (5.269014ms)
  AssertionError [ERR_ASSERTION]: COMPAT-01: no reason token may be renamed. The order is catalog-stable: a new token appends at the tail and arrives with its catalog row, renderer arm, and fixture in the same change. A token may be removed ONLY when its component kind moves from the unsupported set to the supported set, and only when the removal arrives with its catalog rows in the same change.
  + actual - expected
  ... Skipped lines

    [
      'up-to-date',
      'not found',
      'already installed',
      'not installed',
  ...
      'requires pi-dynamic-workflows',
  -   'components now supported'
    ]
```

```
test at tests/architecture/notify-closed-set-locks.test.ts:29:1
✖ OUT-08: REASONS is the closed 46-entry reason set (3.329646ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  45 !== 46

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/notify-closed-set-locks.test.ts:62:10)
```

Token restored; `tsc` clean, 314/314 green.

### Control 3 — change one byte inside a re-byted fenced block

Changed `lsp` to `Lsp` in the `backfill-partially-installed` fenced block of `docs/output-catalog.md`. Nothing else.

```
test at tests/architecture/catalog-uat.test.ts:5599:1
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (36.772568ms)
  AssertionError [ERR_ASSERTION]: catalog UAT failures (1):
  [BYTE MISMATCH] section=reconcile-applied-cascade state=backfill-partially-installed
  --- expected ---
  ● local-mp [user]
    ◉ hello v1.0.0 (partially-installed) {components now supported, Lsp}

  Reconcile: 1 success
  --- actual ---
  ● local-mp [user]
    ◉ hello v1.0.0 (partially-installed) {components now supported, lsp}

  Reconcile: 1 success
  ----------------
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/catalog-uat.test.ts:5621:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: undefined,
    operator: 'fail',
    diff: 'simple'
  }
```

Byte restored; 6/6 green. The pairing proves membership AND rendering, which is what criterion 4 asks for.

**Control 4 (the measured zero for a never-scanned disabled record) is not this plan's.** `116-VALIDATION.md` lists four controls; this plan owns 1, 2 and 3. Control 4 belongs to plan 116-02, which owns the disabled-record measured zero.

## The three silently-green amendment sites — checked by inspection, and a fourth

`116-VALIDATION.md` names three sites that absorb a closed-set amendment without any gate firing. All three were corrected in the same commit as the amendment (`a42a7e04`):

| Site | Was | Now |
|---|---|---|
| `tests/architecture/notify-closed-set-locks.test.ts` test TITLE | `OUT-08: REASONS is the closed 45-entry reason set` | `... closed 46-entry reason set` |
| `extensions/pi-claude-marketplace/shared/notify.ts:83` prose | "its 45-entry membership AND order" | "its 46-entry membership AND order" |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts:7, :14` prose | "the 45-entry membership AND order", "the flat 45-entry set" | both read 46 |

A **fourth** silently-green site in the same file: the running-ledger sentence in `notify-reasons.ts`'s header, which narrates each count transition (`... WDEP-04 appends requires pi-dynamic-workflows ... (44 to 45)`). It has no gate either. One sentence appended: `WCONV-03 appends components now supported ... (45 to 46)`.

## The path-source population claim — re-measured, and it narrows rather than confirms

`116-CONTEXT.md` carried an unmeasured claim that both Anthropic-authored workflow plugins land on the `installable: true` side, and instructed the plan to re-measure the source kind rather than inherit it. Measured against this machine's cached marketplace clone at `~/.pi/agent/pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/marketplace.json`:

| Source kind | Plugins | Converges at load time? |
|---|---|---|
| `url` | 83 | no |
| `path` (`./...`) | 49 | **yes** |
| `git-subdir` | 38 | no |
| `github` | 2 | no |
| **total** | **172** | 49 of 172 (28.5%) |

So the bound the research measured is real and material: `resolveRecordedPluginOffline` passes no clone-cache resolver, so `url` / `git-subdir` / `github` sources all resolve `unavailable` and only the 49 path-source records can converge. That bound is now stated in `scanForceInstalledBackfills`'s doc comment, in present tense.

**The specific two-plugin claim is still not confirmed, and is narrowed against.** Zero of the 172 plugins in that clone — and zero in the second cached marketplace, `open-code-review` — carry a `workflows/` component directory at all. (Two `workflows` directories exist in the caches; both are `.github/workflows`, CI config, not plugin components.) So no workflow-bearing plugin could be found locally to classify, and the CONTEXT's population sentence is unsupported by anything reachable from this tree. It is not falsified either — the claim is about upstream repositories at some version, and this is one machine's cache. Carried forward as coverage item **D6** with `human_judgment: true`; the honest statement for the ROADMAP is "path-source records converge; whether the named plugins are path-source is unverified."

## Decisions Made

- **Token spelling: `components now supported`** (D-116-02 delegated it to the planner). Reason above; the reversibility rating in the plan is `costly` because COMPAT-01 forbids renaming a shipped token.
- **`hasForceInstalledPlugin` left alone** (D-116-04). Its body is byte-unchanged; only its doc's false "the only kind the backfill scan can promote" claim was restated as what the guard actually decides, with the reason the narrow predicate stays narrow.
- **The `installed` arm's conditional `reasons` spread made unconditional.** Once the prelude always places a token, `reasons.length > 0` can no longer be false, so the conditional was a branch no input can take. Left in place it would be an uncoverable branch under the per-pair coverage gate. This is the only production edit beyond the plan's two named ones.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Wrong site description] `tests/shared/notify.test.ts` holds a length assertion, not a tuple copy**

- **Found during:** Task 2
- **Issue:** The plan and `116-RESEARCH.md` Q3 describe `tests/shared/notify.test.ts:4938` as "a second full enumeration of the same tuple" and instruct "append the literal to that file's own independent copy". The test does enumerate `STATUS_TOKENS`, `PLUGIN_STATUSES` and `MARKETPLACE_STATUSES` in full, but for `REASONS` it asserts only `assert.equal(REASONS.length, 45)`.
- **Fix:** Bumped the literal to 46, which is what actually makes the site red on an unaccompanied amendment.
- **Files modified:** `tests/shared/notify.test.ts`
- **Verification:** Control 2 shows this test failing with the token removed.
- **Committed in:** `a42a7e04`

**2. [Rule 1 — Enumeration shorter than the set] Six projection rows changed, not four**

- **Found during:** Task 3
- **Issue:** The plan named four backfill projection cases in `tests/orchestrators/reconcile/notify.test.ts` (`:1106`, `:1147`, `:1186`, `:1226`). Six rows in that file actually reddened. The two the plan did not name are the `plugin-backfilled` entry in the shared `appliedOutcomeRows()` fixture table (`:155`), which drives the table-driven case `projects the complete cascade for a plugin-backfilled outcome`, and `folds two outcomes for one marketplace into a single block in apply order` (`:1330`), whose second row is a backfill.
- **Fix:** All six whole-row `deepStrictEqual` expectations updated in the position the prelude puts the token. None was weakened to a containment check.
- **Files modified:** `tests/orchestrators/reconcile/notify.test.ts`
- **Verification:** `node --test tests/orchestrators/reconcile/notify.test.ts` → 79/79.
- **Committed in:** `507d376d`

**3. [Rule 1 — Derivation outside the plan's file list] `tests/orchestrators/reconcile/apply.test.ts` reddened at the wave-boundary run**

- **Found during:** Task 3, at `npm test`
- **Issue:** A seventh derivation, in a file the plan's `files_modified` does not list: `BFILL-01: one cascade carries a backfill promotion row beside a fresh install row and no reload trailer` (`apply.test.ts:2314`) asserts the fully **rendered** cascade string, so the token appears in its bytes. The plan anticipated this class of miss exactly — its `npm test` gate reads "this is the wave-boundary run and it is what catches a fifth derivation the three named locks did not."
- **Fix:** Updated the expected string to `  ● promoted v1.0.0 (installed) {components now supported}`, with a comment noting that the fresh-install row beside it carries no brace, which is the marker's whole point.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** `npm test` → 5646/5646.
- **Committed in:** `507d376d`

**4. [Rule 1 — Branch made unreachable by this change] The `installed` arm's conditional `reasons` spread**

- **Found during:** Task 3
- **Issue:** `...(reasons.length > 0 && { reasons })` became permanently true the moment the prelude always places a token — a branch no input can take, and an uncoverable one under a 100% branch-coverage pairing.
- **Fix:** Replaced with an unconditional `reasons,` and a comment saying why the arm has no brace-less shape to guard for.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
- **Verification:** `npm run typecheck` clean; `npm test` 5646/5646; `npm run fallow` green via the `npm-fallow` pre-commit hook.
- **Committed in:** `507d376d`

**5. [Rule 1 — Dangling referent] The `ENBL-08` comment's "the filter above"**

- **Found during:** Task 1
- **Issue:** The disabled-record filter's comment ended "Availability and disabled-ness are orthogonal axes (ENBL-05), so **the filter above** does not cover this one." The filter it referred to is the one this plan deleted, so the sentence pointed at nothing. It contains no occurrence of `installable`, so the mandated grep could not find it.
- **Fix:** Restated as "Disabled-ness is its own axis (ENBL-05) and nothing else on this path reads it."
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`
- **Verification:** `node --test tests/architecture/partial-vocabulary-guard.test.ts` → 52/52; comment-policy read (no narration of removed code).
- **Committed in:** `f96143d4`

---

**Total deviations:** 5 auto-fixed (5 × Rule 1). **Impact on plan:** none on scope or on any prohibition. Four of the five are the same underlying miss — a plan-time enumeration shorter than the set it names — caught by running the gates the plan mandated rather than by trusting the list. No `PerEntryOutcome` member was added, no notification-boundary count literal moved, `hasForceInstalledPlugin`'s body is byte-unchanged, and the catalog corpus-count lock is byte-unchanged (116-03 owns it).

## Issues Encountered

- **Trufflehog's git-mode pre-commit hook aborts structurally in this linked worktree** (`.git` is a file, so `failed to read index file: ... not a directory`). Handled per `CLAUDE.md`: a filesystem scan over exactly the paths being committed was run before each of the three commits, each returning `verified_secrets: 0, unverified_secrets: 0`, and only then was `SKIP=trufflehog` used. No other hook was skipped, `--no-verify` was never used, nothing was amended or rebased, and no `git add -A` was run — the operator's seven concurrent uncommitted files are untouched and still uncommitted.
- **The pre-commit prettier and mdformat hooks rewrote nothing.** `git status` after each commit showed only the operator's own files.

## Verification Run

| Gate | Result |
|---|---|
| `node --test tests/orchestrators/reconcile/backfill.test.ts tests/index.test.ts` | 44/44 |
| `node --test tests/orchestrators/reconcile/notify.test.ts tests/architecture/catalog-uat.test.ts` | 85/85 |
| `node --test` on the four closed-set suites | 314/314 |
| `node --test tests/architecture/partial-vocabulary-guard.test.ts` | 52/52 |
| `test "$(grep -c 'all three benign skips' .../backfill.ts)" = "0"` | passes |
| `npm run typecheck` | exit 0 |
| `npm test` | 5646/5646, fail 0 |
| `npm run test:integration` | 34/34, fail 0 |
| `pre-commit run --files <staged paths>` before each commit | all hooks pass except the structurally-broken trufflehog |

`npm run check` was deliberately NOT run — plan 116-04 owns that gate. The `npm-fallow`, `npm-lint`, `npm-format-check` and `npm-typecheck` pre-commit hooks ran green on every commit, so the whole-tree fallow scan is green at each of the three intermediate trees, which is what `<execution_ordering>` required.

## Known Stubs

None.

## Residual naming inaccuracy for 116-03

The catalog state id `backfill-partially-installed-no-reasons` and its `FIXTURES` key now under-describe their row: the row has one reason (the convergence marker), not none. The id still reads correctly as "no *dropped-kind* reasons", and renaming it was outside this plan's action (which named the fenced block, the fixture `reasons`, both prose paragraphs and the second H3 heading, and nothing else). 116-03 owns the catalog corpus and is the right place to decide whether the rename is worth the churn.

## Next Phase Readiness

- **116-02** (`depends_on: ["116-01"]`) can proceed: the widened scan and its two surviving filters are in place, the `WR-01` case at `backfill.test.ts:529` is still green as the standing control for the untouched guard, and the git-source bound is stated in the code for 116-02's dedicated gate to pin.
- **116-03** can proceed: the token renders, the two existing states are byte-true, and the corpus-count lock is untouched so 116-03's `195 → 197` move is a single edit.
- **116-04** owns `npm run check` and the per-pair coverage runs.
- **Phase 114's verification is now stale**, as `116-CONTEXT.md` anticipated: `docs/output-catalog.md` and `tests/architecture/catalog-uat.test.ts` are in its `covered_files` and both changed here.
- **Out of scope, named rather than inherited (research P4/P7):** the WGATE-01 per-script admission-gate warnings are still dropped at load time (BACKLOG `UPCASC-01`) — the new token partly compensates by making the row non-silent, but the per-script detail is still lost; and a permanently-failing path-source record keeps the version gate open on every load for its whole scope, which the widened population makes more likely.

---
*Phase: 116-load-time-workflow-convergence*
*Completed: 2026-09-09*

## Self-Check: PASSED

All six named artifacts exist on disk; all three task commits are reachable from `git log --all`; the token is present in all five derivations of the closed set and in the projection; both length locks read 46.
