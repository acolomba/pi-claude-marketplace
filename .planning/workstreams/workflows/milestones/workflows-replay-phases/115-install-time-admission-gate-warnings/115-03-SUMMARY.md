---
phase: 115-install-time-admission-gate-warnings
plan: 03
subsystem: api
tags: [workflows, reinstall, discovery-warnings, byte-gate, admission-gates]
status: complete

requires:
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 01: the `gate` field on both admitted verdict arms, GATE_REASONS, gateWarning, and the install.ts half of D-115-05 plus its `installGatedWorkflowPlugin` script-parameterized fixture"
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 04: the measured cost of the contradictory discovery-warning header (14 sites, 4 of them in reinstall.test.ts) and the catalog state whose byte gate this plan re-runs"
  - phase: 112-install-and-removal-lifecycle
    provides: "orchestrators/plugin/reinstall.ts::splitHandleWarnings, the LockedSuccess two-array shape and surfaceReinstallDiscoveryWarnings"
provides:
  - "orchestrators/plugin/reinstall.ts::the workflows prepare's warnings ride discoveryWarnings, so a standalone reinstall renders them -- the reinstall half of D-115-05"
  - "tests/orchestrators/plugin/reinstall.test.ts::the six-family channel pin (five families in one byte-exact block, `inspect` in its own case) plus the one-notification negative"
  - "tests/orchestrators/plugin/install.test.ts::the criterion-2 byte comparison (message, severity and whole record) with non-vacuity anchors in both directions, the idempotency case, and the install-side family block"
  - "the measured correction that the newly-visible family set is SIX, not the four the plan enumerated -- `read` and `inspect` are members and both are constructible hermetically"
affects:
  - "115-05: docs/workflows-compatibility.md -- all four verbs now agree, so the doc can state the warn behaviour without a per-verb exception"
  - "any future fix of Broken Windows #36: this plan adds two more header assertions (install and reinstall), so the 14-site count rises to 16"

actuals:
  tokens: 6223
  tasks: 2
  commits: 3

plan_head_before: 0560bb678a745c4bfb8083223b940e49b301188a

tech-stack:
  added: []
  patterns:
    - "derive the family set from the closed union in source, then pin every member -- not the subset a planning artifact happened to name"
    - "a byte comparison proven in both directions by planting an ASYMMETRIC production change (one that depends on the gate), because a symmetric change moves both runs together and cannot redden a two-run comparison"
    - "per-family attribution beside a whole-block byte assertion: the filtered line array names the changed family, the whole-message equality holds the header, separator and order"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "MEASURED CORRECTION to this plan's own enumeration: the newly-visible warning family set is SIX, not four. `WorkflowOutcomeSite` (bridges/workflows/discover.ts:119-145) is the closed union of every per-file line `discoverPluginWorkflows` can produce -- `skipped`, `refused`, `stem-fallback`, `read`, `inspect`, `gate` -- and the whole array was dropped standalone, so every member is newly visible. The plan named four. Unlike the usual short-enumeration case both missing members are CONSTRUCTIBLE hermetically: `read` from raw non-UTF-8 bytes (no permission needed, root-proof) and `inspect` from a workflows directory with its execute bit cleared. Both are pinned."
  - "DEVIATION, deliberate: one byte-exact block per verb instead of one case per family. The plan asks for four (reinstall) and three (install) containment cases. A `contains the file name` case is satisfiable by a channel that emits the WRONG phrase for that file; a whole-block byte comparison pins phrase, reason, order, count, header and separator, and the filtered line-array assertion beside it still names the offending family on failure (proven by control C). Six near-identical case bodies per file would also have been a `fallow dupes` and `sonarjs/no-identical-functions` liability across two files."
  - "`inspect` is the one family that cannot share a directory with the others: it fires when `lstat` fails on an entry `readdir` returned, which needs the directory's execute bit cleared, and that stops every sibling in the same directory from being opened. It has its own case on reinstall; on install the bridge-level pin in `tests/bridges/workflows/discover.test.ts` covers it one layer down and the orchestrator block covers the five that share a directory."
  - "The install-side fixture needed no extension. The plan says to extend the two-run comparison fixture so the runs differ in the SCRIPT rather than in the tool list; plan 01 already added `installGatedWorkflowPlugin(body)`, which is exactly that fixture -- own hermetic home per call, own cwd, notifications returned whole. `installWorkflowBearingPlugin` (the tool-list fixture) was left untouched."
  - "MEASURED: the severity half of the criterion-2 comparison cannot be reddened independently of the message half. `notify()` derives the rendered block's leading advisory line from the same severity it passes as the second argument, so an asymmetric severity plant reddens the MESSAGE comparison first (control B, line 10802). The severity assertion is a second statement of one fact rather than an independently-live gate; the `deepStrictEqual` over the whole record is what pins the ABSENCE of the severity argument, which two `undefined` reads would agree on either way."
  - "No second Broken Windows entry for the contradictory header. #36 already records it with the `[workflows-replay]` prefix and 115-04 measured its cost; a duplicate would split its history. The two new header assertions this plan adds are named in the SUMMARY so the count moves with them."

patterns-established:
  - "Prove a two-run byte comparison with an ASYMMETRIC plant. A one-word change to a shared literal moves both runs together and leaves the comparison green -- the plant has to make the row DEPEND on the thing under test."
  - "Derive an enumeration from the closed union in source before writing it down. The plan's four-family list was short by two, and both missing members turned out to be cheap to pin."

requirements-completed: [WGATE-01, WGATE-03]

coverage:
  - id: D1
    description: "A standalone reinstall of a plugin whose workflow script trips a gate renders the gate line through surfaceDiscoveryWarnings, exactly as a standalone install and update do"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family"
        status: pass
      - kind: other
        ref: "the RED transcript: with the pre-change classification the same case reports 1 !== 2 -- the row alone, no diagnostic"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every warning family the reclassification makes newly visible is pinned on the verb that gained it -- the set derived from the WorkflowOutcomeSite union, not from the plan's list"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family (gate, skipped, refused, stem-fallback, read)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WGATE-01 / D-115-05: a standalone reinstall reports a workflow script it could not inspect"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-01 / D-115-05: a standalone install renders every workflow discovery family"
        status: pass
      - kind: other
        ref: "control C: one word changed in INSTALL_OUTCOMES.read reddens both blocks and names exactly that family's line"
        status: pass
    human_judgment: false
  - id: D3
    description: "The first ctx.ui.notify call's message and severity are byte-identical between an install of a gate-warned plugin and an install of the same plugin whose script does not trip a gate"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row"
        status: pass
      - kind: other
        ref: "controls A and B: two asymmetric plants in composeInstalledRow (a reasons token, then a severity bump, each conditioned on discoveryWarnings) each redden the comparison at line 10802"
        status: pass
    human_judgment: false
  - id: D4
    description: "Installing the same gate-warned plugin twice, each into its own hermetic home, produces the same block and the same line count -- the warning does not accumulate"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WGATE-01 / WGATE-03: installing the same gate-warned plugin twice warns once each time"
        status: pass
    human_judgment: false
  - id: D5
    description: "A standalone reinstall of an all-well-formed plugin makes exactly one notify call, so the family assertions cannot be satisfied by a block that is always emitted"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WGATE-01 / D-115-05: a standalone reinstall of well-formed workflow scripts emits one notification"
        status: pass
    human_judgment: false
  - id: D6
    description: "splitStagingWarnings still has exactly four members: the reclassification happens at the call site, the way update.ts already does it"
    requirement: WGATE-01
    verification:
      - kind: other
        ref: "grep -c splitStagingWarnings reinstall.ts = 3, equal to the count at the RED commit; bridges/workflows is absent from the classifier's argument object"
        status: pass
    human_judgment: false
  - id: D7
    description: "The reclassification introduces no git surface into reinstall.ts, so the NFR-5 architectural gate still holds"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "The reclassification comment at the reinstall call site states the current argument rather than annotating the previous one"
    verification: []
    human_judgment: true
    rationale: "Prose judgement. The plan names this reviewer-read; the automated side cannot tell a present-tense rationale from a narration of what was replaced."

duration: 47min
completed: 2026-09-09
---

# Phase 115 Plan 03: Reinstall's discovery channel and the criterion-2 byte gate — Summary

**All four verbs now agree: a standalone `reinstall` renders the workflow discovery channel the way `install` and `update` do, every family the two reclassifications made newly visible is pinned on the verb that gained it — six of them, not the four the plan named — and "a gate reading changes no plugin-level byte" is a recorded comparison proven to redden under two asymmetric plants rather than an inference from the channel being separate.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-09-09T05:50Z (plan base `0560bb67`)
- **Completed:** 2026-09-09T06:25Z (last task commit) — verification and controls after
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- **Reinstall reads the channel it used to drop.** `handles.workflows.result.warnings` moves from `bridgeWarnings` (gated on `orchestrated`) to the returned `discoveryWarnings`, at the call site, exactly as `update.ts` does it. `splitStagingWarnings` is untouched and still takes four bridges.
- **The family set was measured, not transcribed.** `WorkflowOutcomeSite` is the closed union of every per-file line the workflows bridge can produce, and it has **six** members. The plan named four. `read` and `inspect` are the two it missed, and both are pinned — see The Enumeration below.
- **Criterion 2 is a byte comparison with anchors in both directions.** Two installs of the same fixture differing only in `meta.description`: each run's envelope bytes pinned literally first, the warned run's second notification pinned to contain the gate line, the unwarned run pinned to make exactly one notify call, and only then the two rows compared — by `message`, by `severity`, by whole record, and against a literal so two agreeing rows cannot be two empty ones.
- **The byte gate was proven to fail.** Three controls: a reasons token conditioned on the gate, a severity bump conditioned on the gate, and a one-word phrase change in a family sentence. All three transcripts below.
- **Re-installing a warned plugin warns once.** Two installs into two hermetic homes produce the same block and the same three-line message, so a future shared accumulator fails here.
- **`npm run check` is green end to end** — 5643 unit in 313 suites, 34 integration, typecheck, lint, fallow, format:check.

## Task Commits

1. **Task 1: reinstall surfaces the workflow discovery channel standalone** — `14fa8859` (`test(115-03)`, RED) → `d9de4b3e` (`feat(115-03)`, GREEN)
2. **Task 2: the criterion-2 byte assertion, the install-side families and idempotency** — `6c15c08b` (`test(115-03)`)

**Plan metadata:** committed with this SUMMARY.

`plan_head_before: 0560bb678a745c4bfb8083223b940e49b301188a` — `git rev-list --count 0560bb67..HEAD` = **3**, which is the `actuals.commits` figure above. `actuals.tokens` is `chars/4` over the realized diff (`git diff 0560bb67..HEAD | wc -c` = 24893), the scale the estimate's own units name; the plan estimated 55000 on that scale.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — the workflows array joins `discoveryWarnings` at the return site with the D-141-03 / WGATE-01 rationale; the module header names the workflows half beside the skills and commands ones; `LockedSuccess.discoveryWarnings`' doc no longer enumerates two bridges where three feed it.
- `tests/orchestrators/plugin/reinstall.test.ts` — `WORKFLOW_FAMILY_SCRIPTS`, `writeUnreadableWorkflowScript`, `EXPECTED_FAMILY_LINES`, the `standaloneReinstallNotifications` runner and three cases (five families byte-exact, `inspect` on a locked directory, and the one-notification negative).
- `tests/orchestrators/plugin/install.test.ts` — `WORKFLOW_GATE_SCRIPT` / `WORKFLOW_UNGATED_SCRIPT`, `gatedWorkflowEnvelopeBytes`, `WORKFLOW_DISCOVERY_FAMILY_SCRIPTS`, `EXPECTED_DISCOVERY_FAMILY_LINES` and three cases (the criterion-2 byte comparison, idempotency, and the install-side family block).

## The Enumeration: measured, and short by two

This milestone has shipped an enumeration shorter than the set it names seven times. The plan's own `<behavior>` list names four newly-visible families on `reinstall` (gate, skip, refusal, unrunnable) and three on `install`. **The set is six**, and it was derived from the source rather than from the plan:

`bridges/workflows/discover.ts:119-145` declares `INSTALL_OUTCOMES: Record<WorkflowOutcomeSite, string>`, whose annotation is the totality lock over the union `WorkflowOutcomeSite`. Every per-file line the bridge composes goes through `softFailWarning` with one of those six phrases, and `discoverPluginWorkflows` forwards its scanner's array unfiltered. So the members ARE the families:

| Family | Site | Fixture that reaches it | Pinned |
|---|---|---|---|
| `gate` | admitted `named` + gate | `meta` with a name and no description (engine check 9) | both verbs |
| `skipped` | verdict `skipped` | a helper module declaring no `meta` | both verbs |
| `refused` | verdict `refused` | a `Math.random` call (determinism blocklist) | both verbs |
| `stem-fallback` | admitted, no readable name | `meta` declaring a description and no name | both verbs |
| `read` | `readScriptSource` failed | raw bytes `0x65 0x78 0xff 0xfe 0x0a` — not valid UTF-8 in any position | both verbs |
| `inspect` | `lstat` failed after `readdir` returned the entry | a workflows directory chmod'd `0o444` | reinstall (bridge-level on install) |

Both missing members are constructible without a test-only seam. `read` is the cheaper of the two and is deterministic on every platform and under every uid: no JavaScript string encodes to invalid UTF-8, so the file is written from a `Buffer` and the decoder does the rest. `inspect` needs the directory's execute bit cleared, which also stops every sibling in that directory from being opened — which is why it cannot join the block and takes its own case, with the restoring `chmod` registered before the removal that cannot walk a directory it may not enter.

Measured against the real `discoverPluginWorkflows` before any expectation was written (directory reduced for reading; the render site redacts it per NFR-9):

```text
"workflow script \"aa-gate.js\" in \"<WF>\" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- ..."
"workflow script \"bb-helper.js\" in \"<WF>\" was not installed: bb-helper.js declares no `meta`, so there is nothing to install"
"workflow script \"cc-roll.js\" in \"<WF>\" was refused: cc-roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic"
"workflow script \"dd-stem.js\" in \"<WF>\" was installed but will not run: the engine loads a command only from a literal `meta.name` with a non-empty `meta.description`, and this script declares no readable name"
"workflow script \"ee-bad.js\" in \"<WF>\" could not be read and was skipped: the file is not valid UTF-8, so its bytes cannot be copied verbatim"
--- verdicts ---
aa-gate.js  | named         | gate=meta-fields-invalid   | hello:gate
bb-helper.js| skipped       | -                          |
cc-roll.js  | refused       | -                          |
dd-stem.js  | stem-fallback | -                          | hello:dd-stem
ee-fine.js  | named         | -                          | hello:fine
--- locked directory ---
"workflow script \"gg-locked.js\" in \"<WF>\" could not be inspected and was skipped: EACCES: permission denied, lstat '<WF>/gg-locked.js'"
discovered: 0
```

The `dd-stem` shape was chosen after measuring that the obvious one (`name: someVar`) is a stem-fallback **carrying a gate**, which would have made one file stand for two families. `export const meta = { description: "..." };` is a stem-fallback with no gate, so each family has its own file.

## The header contradiction: asserted as it stands

`surfaceDiscoveryWarnings` heads the block with `Plugin "<name>" <verb>; N declared components were skipped.` Two of the five components in each new block were **installed** with a caveat, so the header contradicts the lines under it. This is Broken Windows **#36**, `open`, recorded with the `[workflows-replay]` prefix and measured by plan 115-04 at 14 sites.

It is **not** fixed here: the header is shared by install, update and reinstall, it is outside this plan's `files_modified`, and changing it is a cross-verb rendering change. The two new blocks assert it **verbatim, as it stands**, with a comment at each site naming #36 as the carrier. **When #36 is fixed the count rises from 14 to 16** — the two whole-message assertions this plan adds (`install.test.ts` and `reinstall.test.ts`, one each) are new sites that move with the header. No second ledger entry was appended; duplicating #36 would split its history.

## Decisions Made

See `key-decisions` in the frontmatter. The three that change what the plan ships:

1. **Six families, not four**, derived from `WorkflowOutcomeSite` — see above.
2. **One byte-exact block per verb instead of one containment case per family.** A `contains the file name` assertion is green for a channel that emits the wrong phrase about the right file; the block pins phrase, reason, order, count, header and separator, and the filtered line-array assertion beside it preserves per-family attribution on failure (control C proves that).
3. **The severity half of the criterion-2 comparison is not independently reddenable**, and that is a measured structural fact rather than a weakness in the case. See control B.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] The newly-visible family enumeration is short by two**

- **Found during:** Task 1, at the measurement step before any fixture was written.
- **Issue:** the plan's `<behavior>` list and both `<acceptance_criteria>` blocks name four families on reinstall and three on install. `WorkflowOutcomeSite` has six members and the whole array was dropped standalone, so `read` and `inspect` are newly visible too. Pinning four of six would have left two families of third-party-derived text reaching a rendered surface with no test, which is exactly the "pin the newly-visible output rather than letting it appear untested" clause of D-115-05.
- **Fix:** the set is derived from the union; `read` is pinned on both verbs inside the block, `inspect` on reinstall in its own case (its fixture cannot share a directory) and at the bridge on install.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`, `tests/orchestrators/plugin/install.test.ts`.
- **Verification:** control C — a one-word change to `INSTALL_OUTCOMES.read` reddens both blocks and names the `read` line specifically.
- **Committed in:** `14fa8859`, `6c15c08b`.

**2. [Rule 3 — Blocking issue] One block per verb instead of six near-identical cases**

- **Found during:** Task 1.
- **Issue:** the acceptance criteria ask for one case per family, each asserting the second notification "names the affected file". Six such bodies per file, across two files, are near-duplicates of each other — the shape `sonarjs/no-identical-functions` and `fallow dupes` (threshold 3) gate — and each individually is a weaker statement than the block, because naming the file does not pin the phrase.
- **Fix:** one byte-exact block per verb, with a filtered line-array assertion first for per-family attribution. The two files use different script names (`aa-gate`/`bb-helper`/… versus `alpha-gate`/`beta-helper`/…) so their expected-line literals are not clones of each other.
- **Files modified:** both test files.
- **Verification:** `npm run fallow` exit 0, dupes report names neither file.
- **Committed in:** `14fa8859`, `6c15c08b`.

**3. [Rule 3 — Blocking issue] The install-side two-run fixture needed no extension**

- **Found during:** Task 2.
- **Issue:** the plan says to extend the two-run comparison fixture "so the two runs differ in the SCRIPT rather than in the session's tool list". That fixture (`installWorkflowBearingPlugin`) is parameterized by tool list, but plan 01 already added `installGatedWorkflowPlugin(body)` — parameterized by script, own hermetic home per call, own cwd, notifications returned whole. Widening the tool-list fixture would have produced a second way to do the same thing and touched two green cases for nothing.
- **Fix:** the byte comparison and the idempotency case both call `installGatedWorkflowPlugin`. `installWorkflowBearingPlugin` and its two `WDEP` cases are untouched. The existing `workflowEnvelopeBytes` constant is reused for the unwarned run's envelope rather than restated.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts` (additions only).
- **Verification:** `node --test tests/orchestrators/plugin/install.test.ts` — 157/157, including the two pre-existing `WDEP` cases.
- **Committed in:** `6c15c08b`.

**4. [Rule 3 — Blocking issue] The Broken Windows entry the plan asks for already exists**

- **Found during:** Task 1.
- **Issue:** the action says to record the `surfaceDiscoveryWarnings` header mismatch with `gsd-tools windows append`. Entry **#36** already records it, with the `[workflows-replay]` prefix, `status: open`, filed by plan 01 and measured by plan 04.
- **Fix:** no append. The acceptance criterion ("a Broken Windows entry exists … with a `[workflows-replay]` description prefix") is satisfied by #36; the new fact — two more assertion sites — is recorded here instead, where the count lives.
- **Files modified:** none.
- **Verification:** `.planning/WINDOWS.md` id 36, `status: open`.
- **Committed in:** n/a (no edit).

---

**Total deviations:** 4 auto-fixed (1 × Rule 2, 3 × Rule 3). **Zero Rule 4 escalations.**

**Impact on plan:** deviation 1 widens what the plan pins, in the direction its own decision (D-115-05) asks for. Deviations 2-4 are shape choices and an edit the plan would have duplicated; none reduces what is asserted. No scope creep: one production file changed by one classification move, no new module, no new test file, no dependency, no manifest touched.

## Controls Run

Every construct was checked by breaking something and watching what went red. Transcripts, not summaries.

### Control 1 — the reinstall reclassification, proven by its own RED run

The RED commit's cases against the pre-change classification:

```text
$ node --test --test-reporter=tap tests/orchestrators/plugin/reinstall.test.ts
not ok 82 - WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family
  error: |-
    [{"message":"● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes"}]

    1 !== 2
  expected: 2
  actual: 1
not ok 83 - WGATE-01 / D-115-05: a standalone reinstall reports a workflow script it could not inspect
ok 84 - WGATE-01 / D-115-05: a standalone reinstall of well-formed workflow scripts emits one notification
# tests 127
# pass 125
# fail 2
```

The failure is the dropped channel itself: the row alone, with no diagnostic behind it. The negative case passes in both configurations, which is what a negative control should do. After the call-site move: 127/127.

### Control A — the byte comparison reddens on an asymmetric MESSAGE change

A symmetric change cannot prove this case: a one-word edit to a shared row literal moves BOTH runs and leaves the comparison green. The plant has to make the row depend on the gate. `composeInstalledRow`'s reasons condition, one line:

```diff
-  if (installCtx.resolved.orphanRewake === true) {
+  if (installCtx.discoveryWarnings.length > 0) {
     reasons.push("orphan rewake");
```

```text
$ node --test --test-reporter=tap tests/orchestrators/plugin/install.test.ts
not ok  76 - SURF-05: installPlugin of a hooks-declaring plugin with rewakeMessage but no asyncRewake surfaces `(installed) {orphan rewake}`
not ok 153 - WGATE-01 / D-115-05: a standalone install names the engine check a script will be refused at
not ok 155 - WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row
# tests 157
# pass 154
# fail 3
```

```text
✖ WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row
  expected: |-
    ● mp [project]
      ● hello v0.0.1 (installed)

    /reload to pick up changes
  actual: |-
    ● mp [project]
      ● hello v0.0.1 (installed) {orphan rewake}

    /reload to pick up changes
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (.../install.test.ts:10802:10)
```

Line 10802 is `assert.equal(warnedRow.message, ungatedRow.message)` — the cross-run comparison, not the literal that follows it. A reasons-brace token added on the strength of a gate reading is exactly what criterion 2 forbids, and it is caught. Plant removed; 157/157.

### Control B — the same case reddens on an asymmetric SEVERITY change, and names where

```diff
   const severity =
-    installCtx.frontmatterDegradations.length > 0
+    installCtx.discoveryWarnings.length > 0
       ? "warning"
```

```text
$ node --test --test-reporter=tap tests/orchestrators/plugin/install.test.ts
not ok  33 - SKILL-01 / WARN-01: standalone install of a plugin with one unparseable skill -> ...
not ok  34 - CMD-01 / WARN-01: standalone install of a plugin with one unparseable command -> ...
not ok 155 - WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row
# tests 157
# pass 154
# fail 3

  error: |-
    + 'A plugin operation needs attention.\n' +
    +   '\n' +
    +   '● mp [project]\n' +
    +   '  ● hello v0.0.1 (installed)\n' +
    +   '\n' +
    +   '/reload to pick up changes'
    - '● mp [project]\n  ● hello v0.0.1 (installed)\n\n/reload to pick up changes'
    TestContext.<anonymous> (.../install.test.ts:10802:10)
```

**Recorded as observed, and it is a finding about the assertion rather than about the code:** the severity plant reddens at line 10802 — the MESSAGE comparison — because `notify()` derives the block's leading advisory line (`A plugin operation needs attention.`) from the same severity it passes as the second argument. So there is no asymmetric plant that moves `severity` while leaving `message` equal, and `assert.equal(warnedRow.severity, ungatedRow.severity)` is a second statement of one fact rather than an independently-live gate. What it does add is `deepStrictEqual(warnedRow, ungatedRow)` beside it: the harness omits the `severity` KEY entirely for an info row, so the record comparison pins the argument's absence, which two `undefined` reads would agree on either way. Plant removed; 157/157.

### Control C — the family blocks are bound to real output, per family

One word inside one family's phrase, in the bridge:

```diff
-  read: "could not be read and was skipped",
+  read: "could not be loaded and was skipped",
```

```text
$ node --test --test-reporter=tap tests/orchestrators/plugin/install.test.ts
not ok 157 - WGATE-01 / D-115-05: a standalone install renders every workflow discovery family
# tests 157
# pass 156
# fail 1

    Expected values to be strictly deep-equal:
    + actual - expected
      [
        'workflow script "alpha-gate.js" ... check 9 ...',
        'workflow script "beta-helper.js" ... declares no `meta` ...',
        'workflow script "delta-stem.js" ... declares no readable name',
    +   'workflow script "epsilon-bad.js" in "workflows" could not be loaded and was skipped: ...',
    -   'workflow script "epsilon-bad.js" in "workflows" could not be read and was skipped: ...',
        'workflow script "gamma-roll.js" ... `Math.random` ...'
      ]

$ node --test --test-reporter=tap tests/orchestrators/plugin/reinstall.test.ts
not ok 82 - WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family
# tests 127
# pass 126
# fail 1
```

Exactly one case per file, and the diff names the family whose phrase moved — which is the attribution the plan's per-family cases were for. Plant removed; both suites green.

### Control D — the measurement the fixtures were written from

Every expected line was produced by running the real `discoverPluginWorkflows` over the intended fixture shapes BEFORE the expectations were written, at both `tense: "install"` and against a locked directory. The transcript is under The Enumeration above. It is also what caught the `dd-stem` shape carrying a gate.

## Verification Results

Every `<automated>` command from both tasks, plus the plan-level block. Exit codes captured without a pipe, so no status is `tail`'s.

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/reinstall.test.ts` (Task 1) | 127 tests, 127 pass, 0 fail |
| `npm run typecheck` (Task 1) | exit 0 |
| `node --test tests/orchestrators/plugin/update.test.ts` (Task 1) | 160 tests, 160 pass, 0 fail — update reads the same channel and is unaffected |
| `grep -c splitStagingWarnings .../reinstall.ts` (Task 1) | 3, equal to the count at the RED commit |
| `node --test tests/orchestrators/plugin/install.test.ts` (Task 2) | 157 tests, 157 pass, 0 fail |
| `node --test tests/architecture/catalog-uat.test.ts` (Task 2) | 6 tests, 6 pass, 0 fail — no catalogued row's bytes moved |
| `npm run lint` (Task 2) | exit 0; zero mentions of either test file |
| `node --test tests/architecture/no-orchestrator-network.test.ts` | 1 test, 1 pass — NFR-5 gate still green over `reinstall.ts` |
| `npm test` (plan level) | 5643 tests, 313 suites, 5643 pass, 0 fail — exit 0 |
| `npm run typecheck` (plan level) | exit 0 |
| `npm run fallow` (plan level) | exit 0 — dead-code, health and dupes clean; the duplication report names neither changed test file |
| `test -z "$(git diff HEAD --name-only -- package.json package-lock.json)"` | exit 0 |
| `npm run test:integration` | 34 tests, 34 pass, 0 fail — exit 0 |
| `npm run format:check` | exit 0 |
| `npm run check` | **exit 0 end to end** — the `.planning/HANDOFF.json` violation plan 01 hit is fixed (Broken Windows #35) |
| `pre-commit run --files <changed files>` (per commit) | every hook Passed EXCEPT TruffleHog, which fails structurally in a linked worktree; a filesystem scan over the committed paths reported `verified_secrets: 0, unverified_secrets: 0` before each commit |

The rendered reinstall block, as a user sees it (5 families, one plugin):

```text
Plugin "hello" reinstalled; 5 declared components were skipped.

workflow script "aa-gate.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- ...
workflow script "bb-helper.js" in "workflows" was not installed: bb-helper.js declares no `meta`, so there is nothing to install
workflow script "cc-roll.js" in "workflows" was refused: cc-roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic
workflow script "dd-stem.js" in "workflows" was installed but will not run: the engine loads a command only from a literal `meta.name` with a non-empty `meta.description`, and this script declares no readable name
workflow script "ee-bad.js" in "workflows" could not be read and was skipped: the file is not valid UTF-8, so its bytes cannot be copied verbatim
```

## TDD Gate Compliance

| Gate | Commit | Status |
|---|---|---|
| RED | `14fa8859` `test(115-03): pin the workflow discovery families on reinstall` | ✓ verified `RED_EVIDENCE_OK` |
| GREEN | `d9de4b3e` `feat(115-03): surface workflow discovery warnings on a standalone reinstall` | ✓ 127/127 |
| REFACTOR | — | not needed; no cleanup pass changed behavior |

RED evidence, verified rather than asserted:

```text
$ node .claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence <record.json>
"verdict": "RED_EVIDENCE_OK",
"reason": "target_test_failed",
"exit_code": 1, "tests": 127, "pass": 125, "fail": 2,
"target_test": "WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family"
"failing_tests": [
  "WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family",
  "WGATE-01 / D-115-05: a standalone reinstall reports a workflow script it could not inspect"
]
"message": "RED evidence verified: ... GREEN authorized."
```

**Task 2 carries no RED commit, and that is structural rather than a lapse.** It is declared `tdd="true"` and is test-only over behavior plan 01 shipped: the install-side reclassification and the row's independence from the gate both already hold, so a failing-first test is unavailable by construction. What replaces it is stronger than a RED transcript would have been — the case was proven to fail under two planted production changes (controls A and B), which is the property a RED run is evidence for. The commit type is `test(115-03)`, the honest type for a regression pin.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced, and no test was skipped.

## Threat Flags

None. The plan's `<threat_model>` covers every surface touched, and each `mitigate` disposition is implemented:

- **T-115-13** (information disclosure) — the reclassification adds no render site; `surfaceDiscoveryWarnings` still applies `redactAbsolutePaths` to every line. Both new blocks assert `!message.includes(cwd)`, and the `inspect` line's expected bytes are `lstat 'gg-locked.js'` — the redaction reduced an absolute path inside a quoted `EACCES` message, which is the shape most likely to leak.
- **T-115-14** (denial of service against the plugin author) — the criterion-2 byte comparison is the mitigation, and controls A and B prove it fires.
- **T-115-15** (spoofing via file names) — unchanged posture; no new interpolation.
- **T-115-16** (the header's repudiation) — accepted and recorded, Broken Windows #36. Asserted as it stands, with the carrier named at both new sites.
- **T-115-17** (dependency manifests) — no package installed; the manifest-diff guard exits 0.

## Issues Encountered

**1. The severity half of the criterion-2 comparison cannot be independently reddened.** Measured, not assumed: `notify()` derives the rendered block's leading advisory line from the same severity it passes as `ctx.ui.notify`'s second argument, so every asymmetric severity plant reddens the message comparison first. The assertion the plan mandates is kept, and the whole-record `deepStrictEqual` beside it is what actually pins the argument's ABSENCE. Recorded so a later reader does not mistake a redundant assertion for a live one. Not a defect and not deferred — there is nothing to fix.

**2. The pre-commit prettier hook rewrote `install.test.ts` mid-run**, reflowing one long fixture entry. Caught by re-reading the file after the hook and re-running the suite (157/157) before committing, per the project's own warning that a rewriting hook still lets the commit succeed. No follow-up commit was needed because the rewrite happened before `git add`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready for **115-05**, the documentation plan. What it inherits:

- **All four verbs now agree** on the workflow discovery channel: `install`, `update` and `reinstall` render it to a standalone user, `info` renders it in preview tense. The doc can state the warn behaviour without a per-verb exception, and D-115-05 is closed on both of its drop sites.
- **The six gate names are unchanged** by this plan; the `replicate / warn / neither` column still has to equal `meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`.
- **A caution about counting:** if 115-05 or any later plan restates the warning-family set in prose, the number is **six** (`WorkflowOutcomeSite`), not the four this plan's own text carried. The union in `bridges/workflows/discover.ts` is the authority.

For whoever takes **Broken Windows #36**: the cost is now **16 sites**, not 14 — the two whole-message block assertions added here (`install.test.ts`, `reinstall.test.ts`) move with the header. Still no catalog state.

## Self-Check: PASSED

- `[ -f ]` on all three modified files: present.
- `git log --oneline --all | grep` each of `14fa8859`, `d9de4b3e`, `6c15c08b`: all three found.
- `git rev-list --count 0560bb67..HEAD` = 3, equal to the `actuals.commits` figure.
- Every task's `<acceptance_criteria>` re-run: all pass, with the two documented shape deviations — the per-family case count (one block per verb instead of four and three separate cases, covering MORE families than either list named) and the Broken Windows append (satisfied by the existing #36 rather than a duplicate).
- Plan-level `<verification>`: `npm test` 5643/5643, `npm run typecheck` 0, `npm run fallow` 0, manifest-diff guard 0. `npm run check` additionally green end to end.
- No operator-owned file staged: `git status --short` before and after each commit lists the same untracked and modified operator files (`.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, and the workstream's `config.json` and `.verification-ledger.json`), none of them in any commit.

---

*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
