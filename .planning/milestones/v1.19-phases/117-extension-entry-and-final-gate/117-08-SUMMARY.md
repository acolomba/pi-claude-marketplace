---
phase: 117-extension-entry-and-final-gate
plan: "08"
subsystem: testing
tags: [node-test, strong-mock, proxy, coverage, npm-scripts, glob, nfr-2, pi-extension]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "117-01's glob-completeness control, which had to land green before this plan could turn it RED as its free plant"
  - phase: 117-extension-entry-and-final-gate
    provides: "117-03's move of notification-boundary.ts to tests/edge/, which this owner imports across the tier boundary"
  - phase: 117-extension-entry-and-final-gate
    provides: "117-07's post-helpers form of both npm glob lines, re-read from disk before amending"
provides:
  - the 204th and final mirrored pair, tests/index.test.ts, at complete direct coverage run alone
  - both unit-suite globs amended so a file at the tests root actually runs
  - the correspondence gate at zero violations for the first time in this milestone
  - the seventh accepted cross-tier import of tests/edge/notification-boundary.ts
  - three failure paths of the extension entry point reached for the first time
affects: [117-09 gate strengthening, 117-12 closing sweep]

actuals:
  tokens: 13748
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "a Proxy over the event the handler is given refuses a chosen read and drives a catch no injection seam can reach, cast-free"
    - "a notification recorder that pushes then throws turns a swallowed failure path into a whole-value comparison of what the module tried to say"

key-files:
  created:
    - tests/index.test.ts
  modified:
    - package.json
  deleted:
    - tests/shared/index-smoke.test.ts
    - tests/edge/index-handler.test.ts

key-decisions:
  - "The fixtures were changed from syntactically invalid to schema-invalid, because the reconcile renders the runtime's JSON parser text into a user-visible message and that text is not part of any contract."
  - "The PATH-warning case asserts TWO notifications, not one. The legacy filter hid a reconcile failure cascade that the same fixture has always produced."
  - "The absent-sessionManager input was dropped rather than kept as a second case: it is the same catch with no discriminating observable."
  - "The verdict is quoted from the focused per-pair run. The branch denominator is 15 here and 14 in the research prototype, on an unchanged source file."

patterns-established:
  - "Refuse the nth read, not the first: counting reads inside a Proxy selects which of four consumers of the same field fails, so one fixture shape reaches several independent catches."
  - "A file-scoped pre-commit run over deleted paths verifies nothing; every hook reports (no files to check). A deletion is validated by the direct gate run instead."

requirements-completed:
  [
    MOD-10,
    OWN-01,
    OWN-03,
    COV-01,
    CASE-01,
    CASE-02,
    CASE-03,
    CASE-04,
    TEST-01,
    TEST-02,
    TEST-03,
    TEST-04,
    TEST-05,
    DES-01,
    DES-02,
    DES-03,
    DEL-01,
    DEL-02,
    SUITE-01,
    SUITE-03,
  ]

coverage:
  - id: D1
    description: "extensions/pi-claude-marketplace/index.ts has one mirrored owner at tests/index.test.ts that imports it directly, at complete direct coverage when run alone"
    requirement: MOD-10
    verification:
      - kind: unit
        ref: "node --test tests/index.test.ts — ℹ tests 12, ℹ pass 12, ℹ fail 0"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts — 'Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 15/15, functions 3/3, lines 161/161)', exit 0"
        status: pass
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs — 'Corresponding-test gate passed.', exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The registration table is proven by hand-authored exact names, one expectation per registration, and a wrong name fails at the call site rather than silently"
    requirement: TEST-03
    verification:
      - kind: unit
        ref: "Plant C (agent_settled renamed to turn_end) — 12 of 12 cases RED, mock reported 'Didn't expect extension API.on(\"agent_settled\", [Function anonymous]) to be called.'"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts#registers the slash command and the two read-only tools alongside the bridge surface"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two deferred failure catches no existing suite reached are reached, and each is proven load-bearing rather than incidentally green"
    requirement: COV-01
    verification:
      - kind: other
        ref: "Plant A (hydrate-refusal case removed) — 'Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 13/14, lines 156/161', exit 1"
        status: pass
      - kind: other
        ref: "Plant B (PATH-recompute-refusal case removed) — 'Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 12/13, lines 159/161', exit 1"
        status: pass
      - kind: other
        ref: "restored — 'Direct coverage passed ... branches 15/15, functions 3/3, lines 161/161', exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The owner runs under npm test, not only under the focused pair command, and the glob-completeness control was RED before the amendment and green after"
    requirement: SUITE-01
    verification:
      - kind: unit
        ref: "tests/architecture/unit-suite-glob-completeness.test.ts before the amendment — ℹ pass 0, ℹ fail 2, both cases showing - 'tests/index.test.ts' on the expected side"
        status: pass
      - kind: unit
        ref: "tests/architecture/unit-suite-glob-completeness.test.ts after the amendment — ℹ tests 2, ℹ pass 2, ℹ fail 0, exit 0"
        status: pass
      - kind: unit
        ref: "npm test before the amendment ℹ tests 5141 with ℹ fail 2; after ℹ tests 5153 with ℹ fail 0 — all read from the runner"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both legacy proxies are deleted, every claim of theirs is accounted for, and no banned cast survives"
    requirement: DEL-01
    verification:
      - kind: other
        ref: "test ! -e on both paths — exit 0; rg -n 'index-smoke' tests scripts — exit 1"
        status: pass
      - kind: other
        ref: "anti-pattern scan over tests/index.test.ts (as unknown as, as any, as never, It.isAny, anyTimes, only/skip/todo, coverage pragmas, planning references) — no match, exit 1"
        status: pass
      - kind: unit
        ref: "npm test after the deletion — ℹ tests 5142, ℹ suites 295, ℹ pass 5142, ℹ fail 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "No production file changed, and the stale production comment the deletion creates is filed rather than fixed"
    requirement: DEL-02
    verification:
      - kind: other
        ref: "git diff --quiet -- extensions/ after each task — exit 0 both times"
        status: pass
      - kind: other
        ref: ".planning/WINDOWS.md entry 26, open; frontmatter counters moved open_count 20 to 21 and total_count 25 to 26"
        status: pass
    human_judgment: false
  - id: D7
    description: "No case here opens a network transport, and the fail-fast replacement that would catch one is a live replacement rather than a no-op"
    requirement: TEST-05
    verification:
      - kind: unit
        ref: "Plant D (a case calling https.request directly) — passed, the call threw the suite's own message; removed after recording"
        status: pass
      - kind: unit
        ref: "all 12 cases pass with a throwing https.request installed, so the measured count of transport opens is exactly zero"
        status: pass
    human_judgment: true
    rationale: "The zero is real but has no positive control through the module under test: no input any case builds reaches the transport, so the count could not rise whatever the module did. The disposition is a labelled regression guard, not a measurement."

duration: 22 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 08: The Extension Entry Owner and the Final Gate Summary

**`extensions/pi-claude-marketplace/index.ts` has its mirrored owner at `tests/index.test.ts` — 12 cases, `branches 15/15, functions 3/3, lines 161/161` run alone, zero banned casts — both unit globs now name it, and the correspondence gate reports `Corresponding-test gate passed.` for the first time in this milestone.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-03T19:27:59Z
- **Completed:** 2026-09-03T19:50:40Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 1 manifest, 2 deleted)

## Accomplishments

- The 204th and final pair exists and is complete. The gate's own words, quoted rather than predicted: **`Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 15/15, functions 3/3, lines 161/161)`**.
- **The branch denominator is 15, not the 14 the research prototype reached on the same unchanged source file.** This is D-116-01a's amendment showing up again: a stronger suite raises numerator and denominator together, which is exactly why the plan forbade writing an absolute branch pair into any acceptance criterion. It was right to.
- Three failure paths that no suite in this repository had ever reached are now reached: the hydrate catch, the plugin-PATH recompute catch, and the inner notify catch on the PATH-warning path.
- Both npm globs name the root-level owner. Before the amendment the owner passed alone, held complete coverage, and contributed **nothing** to `npm test` — the total sat unchanged at 5141. That is the defect this plan existed to close, and it was observed rather than argued.
- The correspondence gate exits 0. Zero violations, first time this milestone.
- Both legacy proxies are gone, with all eleven of their cases dispositioned individually below.

## Task Commits

1. **Task 1: Write the entry owner and make the unit suite run it** — `59798116` (test)
2. **Task 2: Delete the two legacy proxies and take the correspondence gate to zero** — `bd93a1f4` (test)

## The four suite totals, each read from a runner's own line

Never computed, never reconstructed by arithmetic.

| Reading | `ℹ tests` | `ℹ suites` | `ℹ fail` |
| --- | --- | --- | --- |
| `node --test tests/index.test.ts` (the owner alone) | 12 | 0 | 0 |
| `npm test` immediately BEFORE the glob amendment | 5141 | 295 | **2** |
| `npm test` immediately AFTER the glob amendment | 5153 | 295 | 0 |
| `npm test` after the deletion | 5142 | 295 | 0 |

Two things worth stating plainly.

**The pre-amendment 5141 is the whole argument.** It is byte-identical to 117-07's closing baseline, taken with the owner already on disk, already passing, already at complete coverage. The suite could not see it. The two failures in that run are the 117-01 control refusing to let that pass silently.

**`ℹ suites` never moved.** It counts `describe` blocks, not files, and this owner declares none. Anyone reading the suite count as evidence the file ran would have concluded it did not.

## The plants (D-116-04)

Every one run; what each ACTUALLY printed, not what was predicted.

**Plant 0 — the free one, before touching the manifest.** `node --test tests/architecture/unit-suite-glob-completeness.test.ts`, exit 1, `ℹ pass 0 / ℹ fail 2`. Both cases, with the file on the expected side and absent from the matched side:

```
✖ COV-04 the test script reaches every unit test file that exists
✖ COV-04 the test:coverage:unit script reaches every unit test file that exists
  ...
      'tests/edge/types.test.ts',
  -   'tests/index.test.ts',
      'tests/orchestrators/auth-host.test.ts',
```

After the amendment: `ℹ tests 2, ℹ pass 2, ℹ fail 0`, exit 0.

**Plant A — hydrate-refusal case removed.** Exit 1:

```
Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 13/14, lines 156/161
```

**Plant B — plugin-PATH-recompute-refusal case removed.** Exit 1:

```
Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 12/13, lines 159/161
```

**Restored:** `Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 15/15, functions 3/3, lines 161/161)`, exit 0.

Both plants moved the **denominator** — 15 to 14, and 15 to 13 — not merely the numerator. Removing a case did not leave an uncovered branch behind; it removed the branch from the report. Research measured this on the prototype and it reproduced here on a different suite.

**Plant C — one literal event name changed** (`agent_settled` to `turn_end`). All **12 of 12** cases RED, and the mock named the call site rather than a symptom:

```
Error: Didn't expect extension API.on("agent_settled", [Function anonymous]) to be called.

Remaining expectations:
when(() => extension API.on("turn_end", Capture(agent settled))).thenReturn(undefined).between(1, 1)
- Expected
+ Received
-   "turn_end",
+   "agent_settled",
```

This is the claim coverage cannot make. Every name in the registration table is a value no branch selects, so a wrong wiring is invisible to a coverage number and visible here.

**Plant D — is the network trap live, or a no-op?** A temporary case calling `https.request` directly passed, throwing the suite's own message. Removed after recording. See the offline question below.

## The offline question, asked as two questions

The plan required these be asked separately and the zero labelled honestly.

**Can any fixture this suite builds reach the transport?** No. The factory statically imports the module re-exporting `DEFAULT_GIT_OPS`, so the transport IS in the import graph — but those operations are handed to `registerClaudePluginCommand` and reach only the subcommand handlers, which no case here dispatches.

**Does any input through the captured handlers turn it on?** No. All 12 cases pass with a throwing `https.request` installed, so the measured count of transport opens is exactly **zero**.

**The honest label: a regression guard, not a measurement.** A zero that could not rise whatever the module did is not evidence about the module. Plant D establishes only that the device is live and would fire — which is the part worth having. No case asserts a count against it, and the file header says so.

## Case-by-case disposition of both deleted suites

Every claim walked against the owner before either file was removed.

### `tests/shared/index-smoke.test.ts` (7 cases)

| Legacy case | Disposition | Where it went |
| --- | --- | --- |
| `default export is a function` | **DROPPED** | Restates a compiler fact. The default import is typed and eleven other cases invoke it. |
| `registers command, read-only tools, session_start, and resources_discover exactly once` | **REBUILT** | Replaced by 17 per-registration expectations with hand-authored names, verified by `verifyBoundary()` in all 12 cases, plus a dedicated case comparing both tool names as a whole value. Plant C proves it fires; the sorted list it replaced could not see order or a swapped handler. |
| `resources_discover handler resolves project cwd at invocation time` | **CARRIED, strengthened** | Now "discovers prompts under the working directory the event names, not the one the process runs in". The process actually moves into a third root holding a decoy prompt, and the result is one `deepStrictEqual` instead of two `.some()` probes. |
| `PENV-01 applies the plugin PATH from a valid state.json` | **CARRIED, strengthened** | Whole-value `PATH` and ledger comparison, not `entries.includes(...)`. |
| `PENV-01 malformed state.json and warns for that scope` | **CARRIED, corrected** | See "What the legacy filter was hiding" below. |
| `SENV-01/02/03 session_start applies the session env` | **CARRIED** | Three variables compared as one array. |
| `WR-02 swallows a throwing or undefined sessionManager` | **MERGED to one case** | Only the throwing-reader input survives. The absent-`sessionManager` input reaches the same catch with no discriminating observable, so keeping both would have been the tautology template the plan names. Also strengthened from `doesNotThrow` to an observable: all three variables are deleted first and asserted still absent. |

### `tests/edge/index-handler.test.ts` (4 cases)

| Legacy case | Disposition | Where it went |
| --- | --- | --- |
| `RECON-04 wiring: ... with bound ctx` | **DROPPED** | `handlers.has(...)` plus `handler.length === 2` is satisfied by any two-parameter arrow whatever it does. Subsumed by the typed `It.willCapture<DiscoverListener>` under a hand-authored `"resources_discover"`. |
| `a clean reconcile ... returns a ResourcesDiscoverResult` + the WR-05 pristine check | **CARRIED** | Both on-disk negatives kept verbatim (`tests/index.test.ts:525-526`). This is the invariant a production comment gates a directory creation on — see the finding below. |
| `a real applyReconcile throw is caught ... 'reconcile aborted:' at error severity` | **CARRIED, strengthened** | The whole message is now compared, not a `startsWith` prefix: `reconcile aborted: host notification refused`. |
| `even when the last-ditch notify ALSO throws` | **CARRIED, strengthened** | Instead of asserting a call count of 2, the case compares the whole list of messages the module ATTEMPTED to emit before each was refused. |

**No claim disappeared silently.** The two drops are both restatements of facts another gate already owns.

## What the legacy filter was hiding

The legacy malformed-state case asserted `notifications.filter(...).length === 1`. On this tree that fixture produces **two** emissions, and the filter discarded the first:

```
⊘ state.json [project] (failed) {unreadable}
  ⊘ state.json (failed) {unreadable}
    cause: state.json at state.json has an unsupported schema version

Reconcile: 2 failures
```

The reconcile renders its own failure cascade for the same unreadable file, before the plugin-PATH warning is ever emitted. The owner compares the whole two-element list, so both are pinned. This is the house rule about not asserting one property at a time earning its keep: the filter was not merely weaker, it concealed a second user-visible message.

Research recorded this fixture as "emissions 1, toolProbes 2". That reading is explained rather than contradicted: with the boundary sized to one emission, the second `ctx.ui` read is unexpected, the throw lands inside the very catch at the PATH-warning site, and the second emission vanishes. The prototype's `notifications.length === 1` passed because the emission it was missing was being swallowed by the code under test.

## Both fixtures were changed from unparseable to schema-invalid

The research route seeds `{ not json`. That works, but the reconcile renders the JSON parser's own sentence into a user-visible message:

```
cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

That text belongs to the runtime, not to any contract here, and it has changed between V8 versions. Both fixtures were moved to a schema violation instead — `{"schemaVersion": 99}` — whose cause is the project's own validator sentence and is stable. This is what makes the whole-value comparison of both cascades defensible rather than a hostage to the Node version. Measured on this tree, which is **Node v26.7.0**, not the Node 24 CI pins (D-117-18); this change is what makes that difference not matter for these two messages.

## The finding this deletion creates (D-117-13: reported, not fixed)

Re-grepped rather than trusted from a line number:

```
extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:741:    // tests/edge/index-handler.test.ts). When no plugin declares
```

The comment justifies gating `ensureSharedDataDir` on at least one SessionStart entry existing, and cites the now-deleted suite as the pin for the WR-05 "no files on a clean reconcile" invariant. **The invariant itself survives** — `tests/index.test.ts:525-526` asserts neither `<cwd>/.pi` nor `<home>/.pi` is created by a clean reconcile — but the comment names a file that no longer exists.

D-117-13 opens no production licence, so this is filed rather than fixed: **`.planning/WINDOWS.md` entry 26**, kind `deviation`, status `open`. Counters verified afterwards: `open_count` 20 to 21, `total_count` 25 to 26.

## Git records no rename, and this summary does not claim one

Measured with rename detection explicitly on, across both commits:

```
$ git diff -M --summary HEAD~2 HEAD
 delete mode 100644 tests/edge/index-handler.test.ts
 create mode 100644 tests/index.test.ts
 delete mode 100644 tests/shared/index-smoke.test.ts
```

Two deletes and one create. A two-into-one rewrite shares no structural similarity with either original, so `-M` finds nothing to pair and `git log --follow tests/index.test.ts` will not bridge to either predecessor. The 117-02 and 117-07 moves reported 94-98 percent because they were moves; this is not one, and an acceptance criterion demanding a rename here could not have been met.

## The seventh accepted cross-tier import (D-117-05)

`tests/index.test.ts` imports `createNotificationBoundary` from `./edge/notification-boundary.ts`. From the tests root that is a cross-tier read, and it is the **seventh** such consumer beyond the six D-117-05 names (four into the notification boundary from 117-03, two into the marketplace seed from 117-07). Named here rather than left to be rediscovered.

It breaks nothing configured: `.fallowrc.json`'s zones and the ESLint `no-restricted-paths` rule both scope to `extensions/`, and neither has a rule covering `tests/`. `npm run fallow` exits 0 and names the owner in no finding.

## Gate results

Every link run separately with its exit code read from the command itself, never from a pipe tail — the zsh `$status` trap the field notes document, which this plan hit once early (a piped `eslint` reported 0 while printing two errors) and then avoided.

`npm run check` was not used, per the plan: its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before the tests run, so a green result would mean nothing. The five links it would have covered are reported individually.

### Task 1

| Link | Exit | Result |
| --- | --- | --- |
| `node --test tests/index.test.ts` | 0 | `ℹ tests 12`, `ℹ pass 12`, `ℹ fail 0` |
| `npm run test:coverage:direct -- .../index.ts` | 0 | `branches 15/15, functions 3/3, lines 161/161` |
| `node --test tests/architecture/unit-suite-glob-completeness.test.ts` | 0 | `ℹ tests 2`, `ℹ pass 2` (after the amendment) |
| `npm run typecheck` | 0 | no `error TS` line |
| `npm exec -- eslint tests/index.test.ts` | 0 | after fixing two `no-dynamic-delete` errors |
| `npm exec -- prettier --check tests/index.test.ts package.json` | 0 | after `--write` |
| `npm run fallow` | 0 | owner named in no finding |
| `npm test` | 0 | `ℹ tests 5153`, `ℹ fail 0` |
| anti-pattern scan over the owner | 1 | no match |
| `rg -c '^\s*// arrange$'` | 0 | 12, matching 12 `// act` and 12 `// assert` |
| `rg -q 'tests/index.test.ts' package.json` | 0 | both globs name it |
| `git diff --check -- tests/index.test.ts` | 0 | no whitespace damage |
| `git diff --quiet -- extensions/` | 0 | unchanged |

### Task 2

| Link | Exit | Result |
| --- | --- | --- |
| `node scripts/check-corresponding-tests.mjs` | 0 | **`Corresponding-test gate passed.`** |
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | |
| `npm run fallow` | 0 | |
| `npm test` | 0 | `ℹ tests 5142`, `ℹ suites 295`, `ℹ pass 5142`, `ℹ fail 0` |
| `npm run test:integration` | 0 | `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0` |
| `npm run test:corresponding:negative` | 0 | `Corresponding-test negative controls passed.` |
| `npm run test:coverage:direct:negative` | 0 | `Direct-coverage negative controls passed.` |
| `test ! -e` on both deleted paths | 0 | both gone |
| `rg -n 'index-smoke' tests scripts` | 1 | no match |
| `npm run test:coverage:direct -- .../index.ts` | 0 | `branches 15/15, functions 3/3, lines 161/161` |
| `git diff --quiet -- extensions/` | 0 | unchanged |

### Pre-commit

**Task 1** — `SKIP=trufflehog,npm-format-check pre-commit run --files tests/index.test.ts package.json`, exit 0, every hook Passed. Both skips are the two documented ones. The sanctioned substitute for the first ran beforehand over the literal paths: `chunks: 4, bytes: 37143, verified_secrets: 0, unverified_secrets: 0`, exit 0 — non-zero chunk and byte counts confirmed, so it did scan.

**Task 2** — the same command over the two deleted paths exits 0 but **verifies nothing**: every hook reports `(no files to check)`, because neither path exists any more. It is recorded as vacuous rather than as a pass, and the deletion is validated by the twelve-link direct gate run above instead. The trufflehog substitute likewise has no target: a deletion adds no file content to scan.

## Decisions Made

- **The verdict is quoted from the focused per-pair run, never the aggregate (D-117-17).** The merged report was measured by research to HIDE an uncovered branch on this exact pair, so the aggregate is wrong in the safe direction here, not merely weaker.
- **Both fixtures moved from syntactically invalid to schema-invalid.** The reconcile renders the runtime's JSON parser text into a user-visible message; that text is not part of any contract and differs across V8 versions.
- **The malformed-state case asserts two notifications.** The reconcile cascade is real public output of this handler and the legacy filter concealed it.
- **The absent-`sessionManager` input was dropped, not kept.** Two inputs asserted to produce the identical outcome is the tautology template; the summary states plainly that both are the same NFR-2 path with no discriminating observable.
- **`Reflect.deleteProperty` for the environment restore.** `delete process.env[key]` is an ESLint error under `no-dynamic-delete`; the `Reflect` form is established house practice for exactly this env-restore pattern in five existing suites. The restore also deletes rather than reassigns an absent variable, because `process.env` stringifies every assignment and reassigning `undefined` would set the four letters `undefined`.
- **No `PiRegistrar` alias was needed.** 116-28 declared one because it COMPARES the registered tool definition structurally; this owner only captures it, so the instantiated `Parameters<ExtensionAPI["registerTool"]>[0]` suffices — as research predicted.

## Deviations from Plan

The plan directed a single "exactly one warning notification" for the unreadable-state case. The module emits two notifications on that fixture, and the case now asserts both. This is a correction to the plan's premise (inherited from the legacy suite's filtered assertion), made by measurement, and it strengthens rather than weakens the claim. No other deviation: no production file changed, no cast was carried forward, the prototype was used as a coverage-route reference and not shipped, and every plant the task named was run.

## Issues Encountered

1. **The zsh `$status` trap caught this plan once.** An early `npm exec -- eslint ... | tail` reported `ESLINT_EXIT=0` while printing two errors — the pipe means `$?` is *tail's*. Every gate in the tables above was re-run unpiped, or captured to a file with its own exit code read directly.
2. **`pre-commit` exceeded the harness's two-minute budget mid-`npm typecheck`** on the Task 1 run. Not a hook failure; re-run with a longer budget and it completed at exit 0 with every hook Passed.
3. **The research prototype's probe and emission counts do not transfer.** They were measured against thinner assertions; this owner's counts were measured per case from strong-mock's own `verify` failures, as the plan required. The PATH-warning case is `(2, 2)`, not the `(1, 2)` the prototype used.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The pair contract is complete at 204 of 204.** The correspondence gate exits 0 with its passing line.
- Both unit globs name the root-level owner, and the 117-01 control now guards the amendment in both directions.
- Requirement IDs were deliberately **not** marked complete. Several of this plan's IDs are declared by more than one plan in this phase, so `requirements.ready-ids` returns none ready until the last claimant lands; D-117-12 owns the sweep.
- One new open ledger entry (26) for the next sweep to see, and no blockers.

## Self-Check: PASSED

- `tests/index.test.ts` exists on disk; neither `tests/shared/index-smoke.test.ts` nor `tests/edge/index-handler.test.ts` does.
- Commits `59798116` and `bd93a1f4` are both present in `git log`, carrying the create and the two deletes respectively.
- Every `<verify>` link from both tasks was run separately with its exit code read directly; all results are tabulated above.
- Every plant named by the plan was run and its verbatim output recorded, including the free glob plant taken before the manifest was touched.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
