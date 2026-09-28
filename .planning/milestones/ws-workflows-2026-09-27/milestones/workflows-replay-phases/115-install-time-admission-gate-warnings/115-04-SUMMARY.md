---
phase: 115-install-time-admission-gate-warnings
plan: 04
subsystem: api
tags: [workflows, info, preview-tense, output-catalog, byte-gate]
status: complete

requires:
  - phase: 115-install-time-admission-gate-warnings
    provides: "plan 01: the `gate` field on both admitted verdict arms, GATE_REASONS, gateWarning and the `gate` entry in PREVIEW_OUTCOMES"
  - phase: 113-update-enable-disable-reconcile
    provides: "orchestrators/plugin/info.ts::previewWorkflows with its required `tense: preview` and its redactAbsolutePaths map; the `notes` advisory channel on the plugin row"
  - phase: 044-info-surface
    provides: "docs/output-catalog.md::the `/claude:plugin info <plugin>@<marketplace>` section and tests/architecture/catalog-uat.test.ts::the forward and inverse catalog walks"
provides:
  - "tests/orchestrators/plugin/info.test.ts::four preview-tense gate cases -- the future-tense phrase, the note-is-the-only-byte comparison against a gate-free run, the NFR-9 home-path assertion, and the three-advisory ordering pin"
  - "docs/output-catalog.md::the `installed-with-workflow-gate-note` state -- the published bytes of an `info` row whose admitted script the engine will refuse"
  - "tests/architecture/catalog-uat.test.ts::the matching FIXTURES entry, plus the exact-count lock raised from 194 to 195"
  - "the measurement that the contradictory discovery-warning header is unreachable from `info` and unpublished in the catalog, with the cost of fixing it counted at 14 sites"
affects:
  - "115-03: reinstall's own drop site renders the same install-tense line; the preview pair of its bytes is now published"
  - "115-05: docs/workflows-compatibility.md -- its check-9 row describes the gate whose rendered sentence is now a published byte contract"

actuals:
  tokens: 3456
  tasks: 2
  commits: 2

plan_head_before: 309a37cc55fe690f97a95bee219476de6fffe011

tech-stack:
  added: []
  patterns:
    - "an unchanged-row assertion that names the difference: the note lines are extracted and compared to an expected list, then the remaining lines are compared to a baseline run, so neither half can be vacuous"
    - "a catalog state proven in three directions -- annotation removed, fixture removed, one byte changed -- rather than the two the plan mandated"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/deferred-items.md

key-decisions:
  - "MEASURED, and it answers the finding plan 01 addressed to this plan: the contradictory `Plugin \"<name>\" installed; 1 declared component was skipped.` header belongs to `surfaceDiscoveryWarnings`, which has three call sites -- `install.ts:2561`, `update.ts:503`, `reinstall.ts:610` -- and NONE of them is `info.ts`. The `info` surface emits exactly one `plugin-info` notification and no header at all. So the catalog state this plan publishes pins the `note:` line alone and CANNOT publish the contradiction. Nothing was blessed and nothing was rewritten."
  - "The header also appears in NO catalog state today: `grep \"declared component\" docs/output-catalog.md` finds one unrelated line at :1401. The install-side block is a second `notifyDiagnostic` call with no catalog annotation, exactly as D-115-06 recorded, so the byte gate could not have locked the contradiction in even if this plan had wanted it to."
  - "DEVIATION from the plan's literal instruction, made deliberately: the new fixture's `workflows` array carries a SECOND name (`commit-commands:greet`) rather than only replacing `notes`. A gate warning rides the two ADMITTED arms, and `previewWorkflows` lists every admitted script, so a real `info` row that carries this note ALWAYS lists that script's command. Copying only `notes` would have published a row no input can produce."
  - "The exact-count lock in `catalog-uat.test.ts` (`examples.length === 194`) is a third binding the plan's read_first did not name. Raised to 195 deliberately, with its comment, its literal and its failure message all moved together."
  - "The plan's fifth behaviour bullet -- an all-well-formed plugin renders no `note:` line -- is credited to the existing case `WR-09: a plugin whose workflow scripts are all admitted renders no advisory line`, which already asserts it byte-exactly over the same fixture. A second case would be a near-duplicate the toolchain gates."
  - "The gate fixture is `export const meta = { name: \"greet\" };` -- a readable name and no description. That is the check-9 gap the phase context calls the single most valuable warning: the script installs, registers a command, and dies at first invocation. It also keeps the generated name equal to its gate-free twin, which is what lets the unchanged-row comparison isolate the note."

requirements-completed: [WGATE-01, WGATE-03]

coverage:
  - id: D1
    description: "`info` names the engine check that will refuse an admitted script, in the future tense, on a row that also lists that script's command"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WGATE-01: info names the engine check that will refuse an admitted script, in the future tense"
        status: pass
      - kind: other
        ref: "control 1: the install phrase planted into PREVIEW_OUTCOMES.gate -- all four new cases red; transcript in Controls Run"
        status: pass
    human_judgment: false
  - id: D2
    description: "A gate note changes no other byte of the row and no severity: the status token, the reasons brace, every component line and the absent second notify argument all equal a run whose script trips no gate"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WGATE-03: the gate note is the only byte an info row gains, at the same severity"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate note names the workflows directory by name alone and discloses no path from the fixture's temporary home"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#NFR-9: the gate note names the workflows directory by name and discloses no home path"
        status: pass
    human_judgment: false
  - id: D4
    description: "A gate note takes its place among the skip and refusal advisories in directory-entry-name order, with no special placement"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WGATE-01: a gate note takes its place among the other advisories, in directory-entry order"
        status: pass
    human_judgment: false
  - id: D5
    description: "An all-well-formed plugin renders no `note:` line at all"
    requirement: WGATE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#WR-09: a plugin whose workflow scripts are all admitted renders no advisory line"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rendered bytes of the gate note are published in the output catalog and bound to a fixture in both directions of the gate"
    requirement: WGATE-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)"
        status: pass
      - kind: other
        ref: "controls 2, 3 and 4: annotation removed (ORPHAN FIXTURE), fixture removed (MISSING FIXTURE), one byte changed (BYTE MISMATCH); transcripts in Controls Run"
        status: pass
    human_judgment: false
  - id: D7
    description: "The new catalog state's prose paragraph describes the state honestly and in the sibling's register"
    verification: []
    human_judgment: true
    rationale: "Prose judgement. The plan names this reviewer-read. The automated side pins the fenced bytes, not the paragraph above them."

duration: 46min
completed: 2026-09-09
---

# Phase 115 Plan 04: The preview-tense gate note and its published bytes — Summary

**A plugin author running `/claude:plugin info` before they install now reads, per script, which engine check will refuse it — in the future tense, with no absolute path, on a row whose every other byte is unchanged — and those bytes are published in `docs/output-catalog.md` behind a byte gate proven red in three directions.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-09T05:10Z (plan base `309a37cc`)
- **Completed:** 2026-09-09T05:33Z (last task commit) — verification and controls after
- **Tasks:** 2 of 2
- **Files modified:** 4 (three in the plan's `files_modified`, plus this phase's `deferred-items.md`)

## Accomplishments

- **The warning arrives before the decision.** Four cases in `tests/orchestrators/plugin/info.test.ts` pin the preview-tense gate note: the future-tense phrase with the engine check named, the note as the only byte the row gains, the absence of any home path, and the note's place in directory-entry order among the skip and refusal advisories.
- **The unchanged-row claim names its difference.** The WGATE-03 case runs `info` twice over one manifest shape — once with `export const meta = { name: "greet" };`, once with the same script carrying a description. Both are admitted under `foo:greet`, so the `workflows:` line is equal and the note is the only byte the gate can move. The case extracts the note lines and compares them to an expected list, then compares everything else to the gate-free run's message, and asserts the notification record has a `message` key and nothing else — which is how this harness records "`ctx.ui.notify` was called with no severity argument".
- **A new catalog state, and it does not publish a contradiction.** `installed-with-workflow-gate-note` pins the row of a plugin whose admitted script the engine will refuse. The sibling `installed-with-workflow-preview-note` state and its fixture are untouched.
- **The byte gate was proven in three directions, not the two the plan asked for.** Removing the annotation reddens the inverse walk; removing the fixture reddens the forward walk; changing one word inside the fenced block reddens it as a byte mismatch. All three transcripts below.
- **The finding plan 01 addressed to this plan was measured rather than inherited.** The contradictory header is unreachable from `info` and unpublished in the catalog. See Decisions.

## Task Commits

1. **Task 1: the preview-tense `info` cases** — `9c67b649` (`test(115-04)`)
2. **Task 2: the catalog state and its fixture** — `287241ab` (`docs(115-04)`)

**Plan metadata:** committed with this SUMMARY.

`plan_head_before: 309a37cc55fe690f97a95bee219476de6fffe011` — `git rev-list --count 309a37cc..HEAD` = **2**, which is the `actuals.commits` figure above. `actuals.tokens` is `chars/4` over the realized diff (`git diff 309a37cc..HEAD | wc -c` = 13824), which is the scale the estimate's own units name; the plan estimated 45000 on that scale.

## Files Created/Modified

- `tests/orchestrators/plugin/info.test.ts` — a new section carrying `WORKFLOW_GATE_NO_DESCRIPTION`, `WORKFLOW_NAMED_GREET`, `WORKFLOW_REFUSED_SEED`, the independently written `EXPECTED_GATE_NOTE_CHECK_9`, the `runFooInfoWithGreetScript` runner, and four cases.
- `docs/output-catalog.md` — the `### Success -- a workflow script the engine will refuse to load (WGATE-01)` H3, its prose paragraph, its `<!-- catalog-state: installed-with-workflow-gate-note -->` annotation and its fenced block, inserted after the sibling preview-note state.
- `tests/architecture/catalog-uat.test.ts` — the matching `FIXTURES` entry under the `` `/claude:plugin info <plugin>@<marketplace>` `` section key, and the exact-count lock raised from 194 to 195 (comment, literal and failure message together).
- `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/deferred-items.md` — the measured outcome appended to plan 01's open header entry, so the file stops implying this plan would close it.

## The header contradiction: what was decided, and why

Plan 01 recorded that `surfaceDiscoveryWarnings` heads its block with `Plugin "<name>" installed; 1 declared component was skipped.`, while a gate line inside the same block says `was installed but the engine will refuse to load it`. The contradiction is real and it is live on install — `tests/orchestrators/plugin/install.test.ts:6763` asserts the header verbatim beside the gate line.

**Decision: this plan publishes nothing that contains that header, does not rewrite it, and reports its cost.** Three measurements settle it:

1. **The header is not reachable from `info`.** `grep -rn surfaceDiscoveryWarnings extensions/` gives three call sites — `install.ts:2561`, `update.ts:503`, `reinstall.ts:610` — and `info.ts` is not among them (its only mention is a comment at `:763` citing the redaction it mirrors). The `info` surface emits exactly one `plugin-info` message, and `catalog-uat` asserts one `ctx.ui.notify` call per fixture.
2. **The header is in no catalog state.** `grep -n "declared component" docs/output-catalog.md` returns one line, `:1401`, about unsupported component kinds. The install-side block is a second `notifyDiagnostic` call carrying no catalog annotation, which is what D-115-06 already recorded; the byte gate cannot redden from it and cannot lock it in.
3. **So the bytes this plan pins do not include it.** The new fenced block is a `plugin-info` row: header line, plugin row, description, `skills:`, `workflows:`, `note:`. There is no route by which this state blesses the sentence.

**Cost of the right fix, counted rather than estimated:** 14 sites. Two are the header's own branches in `orchestrators/plugin/shared.ts` (the singular and plural forms). Twelve are assertions — `shared.test.ts` (2), `install.test.ts` (1), `reinstall.test.ts` (4), `update.test.ts` (5). **No catalog state has to move with it**, which makes the fix cheaper than plan 01 estimated when it deferred the work here on catalog grounds. It remains a cross-verb rendering change over three verbs and outside this plan's `files_modified`, so it stays deferred, and Broken Windows entry **#36** stays `open` as its carrier. No second ledger entry was appended: the defect is already recorded and duplicating it would split its history.

## Decisions Made

See `key-decisions` in the frontmatter. The two that change what the phase ships:

1. **The new fixture's `workflows` array gained a second name.** The plan says to replace only `notes`. A gate warning rides the ADMITTED arms and `previewWorkflows` lists every admitted script, so the note and the command name are inseparable in any real row. Publishing the note without the name would have made the catalog the authority for a row no input produces.
2. **The exact-count lock is part of adding a state.** It was not in the plan's read_first list and it fails first, before any byte comparison. Raised deliberately from 194 to 195.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Replacing only `notes` would have published an impossible row**

- **Found during:** Task 2.
- **Issue:** the plan says to build the fixture by "copying the sibling's `NotificationMessage` and replacing only its `notes` array with the gate line". The sibling's note describes a REFUSED script, which is not admitted and therefore correctly absent from its `workflows:` line. A gate note describes an ADMITTED script: `verdictWarning` reaches `gateWarning` only on the `named` arm, `previewWorkflows` lists every `named` and `stem-fallback` verdict's generated name, so the command name is always on the row beside the note. A literal `notes`-only copy would have published a state that no `info` run can produce.
- **Fix:** the fixture's `components.workflows` carries `["commit-commands:changelog", "commit-commands:greet"]` and the fenced block lists both, so the row is one a real plugin produces. Nothing else about the sibling was copied over: it and its fixture are byte-unchanged.
- **Files modified:** `docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`.
- **Verification:** the measurement transcript under Controls Run — `greet.js` yields verdict `named`, gate `meta-fields-invalid`, generated name `foo:greet`, and its command appears on the `workflows:` line of the rendered row in the Task 1 cases.
- **Committed in:** `287241ab`.

**2. [Rule 3 — Blocking issue] A third binding the plan did not name: the exact-count lock**

- **Found during:** Task 2, on the first run of the byte gate.
- **Issue:** `catalog-uat.test.ts:5606` asserts `examples.length === 194` before any byte comparison. Adding a 195th annotated state fails there first — `Expected exactly 194 annotated catalog examples; found 195` — so the state cannot land without moving the lock. The plan's read_first named `:5492-5520` and `:5711-5748` but not this assertion.
- **Fix:** the literal, its comment and its failure message all read 195. Nothing was weakened: it is still an exact count, not a floor, which is what the comment says it is for.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`.
- **Verification:** control 2 below shows the same lock firing in the opposite direction (`found 194`) when the annotation is removed, which is the proof it still counts.
- **Committed in:** `287241ab`.

**3. [Rule 3 — Blocking issue] The all-well-formed criterion is already pinned**

- **Found during:** Task 1.
- **Issue:** the plan's fifth behaviour bullet and fifth acceptance criterion ask for a case asserting that an all-well-formed plugin renders no `note:` line. `WR-09: a plugin whose workflow scripts are all admitted renders no advisory line` (`info.test.ts:7265`) already asserts exactly that, byte-exactly, over a fixture of one well-formed named script: `deepEqual(notifications, [{ message: EXPECTED_FOO_INSTALLED_INFO + "\n    workflows: foo:zeta" }])`. A second case over the same shape would be a near-duplicate the toolchain gates (`sonarjs/no-identical-functions`, `fallow dupes`).
- **Fix:** no new case. The criterion is credited to the existing one and listed under coverage `D5`.
- **Files modified:** none.
- **Verification:** `node --test tests/orchestrators/plugin/info.test.ts` — that case passes among 144.
- **Committed in:** n/a (no edit).

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 2 × Rule 3). **Zero Rule 4 escalations.**

**Impact on plan:** deviation 1 makes the published state truthful about a row a real plugin produces, which is the whole point of a byte contract. Deviations 2 and 3 are a binding the plan missed and an edit it would have manufactured; neither reduces what the plan asserts. No scope creep: no production source changed, no new module, no dependency, no manifest touched.

## Controls Run

Every construct was checked by breaking something and watching what went red. Transcripts, not summaries.

### Control 1 — the four new `info` cases discriminate the TENSE

`PREVIEW_OUTCOMES.gate` replaced with the install phrase (`"would be installed but the engine will refuse to load it"` → `"was installed but ..."`), nothing else touched:

```text
$ node --test tests/orchestrators/plugin/info.test.ts
✖ WGATE-01: info names the engine check that will refuse an admitted script, in the future tense
✖ WGATE-03: the gate note is the only byte an info row gains, at the same severity
✖ NFR-9: the gate note names the workflows directory by name and discloses no home path
✖ WGATE-01: a gate note takes its place among the other advisories, in directory-entry order
ℹ tests 144
ℹ pass 140
ℹ fail 4
```

All four, and only those four. A case asserting the script's name alone would have stayed green on the install-tense wording, which on a read-only surface is a false statement about a disk nothing wrote to. Restored; 144/144.

### Control 2 — the annotation removed, the fixture left in place

```text
$ node --test tests/architecture/catalog-uat.test.ts
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
✔ XSURF-03: update-decline partially-upgradable reason brace === list partially-upgradable brace (same kinds)
✔ UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override)
✖ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)
✔ loadCatalogExamples: returns no examples when the catalog has no annotations
✔ loadCatalogExamples: pairs each discriminator with its next fenced block
ℹ pass 4
ℹ fail 2
✖ failing tests:
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
  AssertionError [ERR_ASSERTION]: Expected exactly 195 annotated catalog examples; found 194. Check that the discriminator comments in docs/output-catalog.md were not lost, and update this count when examples are added.
✖ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)
  [ORPHAN FIXTURE] section=/claude:plugin info <plugin>@<marketplace> state=installed-with-workflow-gate-note
```

The inverse walk names the orphan by section and state. The count lock fires too, in the opposite direction from the one that forced it up — which is the evidence that it still counts rather than sitting at a number nothing reaches. Restored.

### Control 3 — the fixture removed, the annotation left in place

```text
$ node --test tests/architecture/catalog-uat.test.ts
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
✔ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)
ℹ pass 5
ℹ fail 1
✖ failing tests:
  AssertionError [ERR_ASSERTION]: catalog UAT failures (1):
  [MISSING FIXTURE] section=/claude:plugin info <plugin>@<marketplace> state=installed-with-workflow-gate-note
```

The forward walk names the missing fixture; the inverse walk correctly stays green, because a fixture that does not exist cannot be an orphan. Restored; 6/6.

### Control 4 — one byte changed inside the new fenced block

Not asked for by the plan, and run because a byte gate that cannot fail is worse than no gate. `would be installed` → `will be installed` in the catalog block only:

```text
$ node --test tests/architecture/catalog-uat.test.ts
ℹ pass 5
ℹ fail 1
  [BYTE MISMATCH] section=/claude:plugin info <plugin>@<marketplace> state=installed-with-workflow-gate-note
```

Restored; 6/6. The state is bound to `notify()`'s actual output, not merely present beside a fixture.

### Control 5 — the measurement the fixtures were written from

The three fixture shapes run through the real `discoverPluginWorkflows` at `tense: "preview"` before any expectation was written (absolute directory reduced for reading; the render sites redact it per NFR-9):

```text
"workflow script \"greet.js\" in \"workflows\" would be installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared"
"workflow script \"helper.js\" in \"workflows\" will not be installed: helper.js declares no `meta`, so there is nothing to install"
"workflow script \"roll.js\" in \"workflows\" will be refused: roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic"
--- verdicts ---
greet.js | named | meta-fields-invalid | foo:greet
helper.js | skipped | -               |
roll.js | refused | -                 |
zeta.js | named | -                   | foo:zeta
```

`greet.js` is `named`, carries a gate, and has a generated name — which is deviation 1's evidence, and also why the ordering case's `workflows:` line reads `foo:greet, foo:zeta` while `helper.js` and `roll.js` appear only as notes.

## Verification Results

Every `<automated>` command from both tasks, plus the plan-level block.

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/info.test.ts` (Task 1) | 144 tests, 144 pass, 0 fail |
| `npm run typecheck` (Task 1) | exit 0 |
| `node --test tests/architecture/catalog-uat.test.ts` (Task 2, first) | 6 tests, 6 pass, 0 fail |
| `pre-commit run --files docs/output-catalog.md tests/architecture/catalog-uat.test.ts` (Task 2) | every hook Passed EXCEPT TruffleHog, which fails structurally in a linked worktree — see Issues Encountered. `mdformat` and `markdownlint-cli2` both Passed without rewriting, and `git status` was unchanged after the run |
| `node --test tests/architecture/catalog-uat.test.ts` (Task 2, after the formatter) | 6 tests, 6 pass, 0 fail — no hook reflowed the fenced block |
| `test -z "$(git diff HEAD --name-only -- package.json package-lock.json sonar-project.properties CHANGELOG.md)"` (Task 2) | exit 0 |
| `npm test` (plan level) | 5637 tests, 313 suites, 5637 pass, 0 fail |
| `npm run typecheck` (plan level) | exit 0 |
| `npm run fallow` (plan level) | exit 0 — dead-code, health and dupes all clean; the duplication report names no file this plan touched |
| `npm run lint` | exit 0 |
| `npx prettier --check tests/orchestrators/plugin/info.test.ts` | exit 0 |
| `pre-commit run --all-files` (plan level) | every hook Passed EXCEPT TruffleHog (structural). `git status --short` before and after the run are byte-identical, so no file was rewritten and no pre-existing violation is hiding behind a scoped run |

The published state, as it now stands in `docs/output-catalog.md`:

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    skills: commit-summary
    workflows: commit-commands:changelog, commit-commands:greet
    note: workflow script "greet.js" in "workflows" would be installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared
```

## TDD Gate Compliance

| Gate | Commit | Status |
|---|---|---|
| RED | — | unavailable by construction; see below |
| GREEN | — | not applicable: no production source changed |
| REFACTOR | — | not needed |

**Task 1 is declared `tdd="true"` and carries no RED commit, and that is structural rather than a lapse.** Its `<files>` names one test file, so it adds no behavior: the preview-tense gate note shipped in plan 01 (`gate` in `PREVIEW_OUTCOMES`, `gateWarning`, and `previewWorkflows`' required `tense: "preview"`), and `info.ts` already rendered `workflows.warnings` as `notes`. A failing-first test is unavailable when the behavior exists before the pin is written; writing one anyway would mean asserting something false about the current tree to make it fail. Committed as `test(115-04)`, which is the honest type for a regression pin — the same reading plan 01 recorded for its Tasks 2 and 3 and plan 02 for its Task 1.

What replaces the RED gate here is control 1: the four cases were proven to fail against a planted wrong implementation of the exact property they claim, which is the discrimination a RED commit is evidence of. Task 2 is a documentation-and-fixture task and never had a RED phase to skip.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced, and no test was skipped, `only`'d or `todo`'d.

## Threat Flags

None. The plan's `<threat_model>` covers every surface this plan touched, and each `mitigate` disposition is implemented:

- **T-115-18** (information disclosure on the gate note) — the NFR-9 case asserts the rendered row contains no path from the fixture's temporary home, which is a positive check on `redactAbsolutePaths` rather than an assumption about it. The published block carries the directory as `"workflows"` alone.
- **T-115-19** (spoofing in the published block) — the block is driven through the real `notify()` renderer and compared byte-for-byte, and control 4 proves the comparison bites on a single word. The block also round-tripped through `mdformat` and `markdownlint-cli2` unchanged, re-verified by the third verify command.
- **T-115-20** (denial of service against the author, via the row's severity) — the WGATE-03 case pins the status token, the reasons brace and every other line against a gate-free run of the same fixture, and asserts the notification record carries a `message` key and nothing else. No new `REASONS` member was added; the closed set stays where it was.
- **T-115-21** (tampering with manifests, Sonar properties or the changelog) — Task 2's fourth verify command exits 0, and `git diff 309a37cc..HEAD --name-only` names exactly three files, none of them a manifest.

## Issues Encountered

**1. TruffleHog's pre-commit hook fails structurally in this linked worktree, as documented.** `.git` is a text file here, so the hook's git-mode scan aborts with `failed to read index file: open .../.git/index: not a directory`. Both commits were therefore preceded by a filesystem scan over exactly the paths being committed, and both were clean:

```text
$ "$TH" filesystem tests/orchestrators/plugin/info.test.ts --results=verified,unknown --fail
finished scanning {"chunks": 27, "bytes": 351740, "verified_secrets": 0, "unverified_secrets": 0}

$ "$TH" filesystem docs/output-catalog.md tests/architecture/catalog-uat.test.ts --results=verified,unknown --fail
finished scanning {"chunks": 44, "bytes": 570485, "verified_secrets": 0, "unverified_secrets": 0}
```

Both exit 0 with zero verified and zero unverified findings, so each commit carried `SKIP=trufflehog` and nothing else.

**2. STATE.md, ROADMAP.md and REQUIREMENTS.md were deliberately not written by this executor.** `WGATE-01` and `WGATE-03` still read `Pending` in `.planning/workstreams/workflows/REQUIREMENTS.md`, and that is correct: both IDs are declared by plans 115-03 and 115-05 as well, neither of which has a SUMMARY, so the shared-ID gate blocks them until the last declaring plan finishes. The workstream-scoped state verbs are also known to fail or half-write against a workstream `STATE.md`. The orchestrator owns those three files for this phase.

**3. Broken Windows #36 stays open, and no second entry was appended.** The header contradiction is already recorded there by plan 01. This plan measured it, decided not to publish it, and counted the cost of fixing it; the measurement is appended to this phase's `deferred-items.md` beside plan 01's entry rather than duplicated into the ledger.

## Next Phase Readiness

Ready for **115-03** and **115-05**:

- For **115-03**: `reinstall.ts:1062`'s drop site is still the plan's own work. The install-tense phrase it will surface is `was installed but the engine will refuse to load it`; its preview pair is now published, so the two tenses can be compared against a byte contract rather than against each other. If 115-03 renders through `surfaceDiscoveryWarnings`, it inherits the header contradiction documented above — that is a known, recorded condition, not a new finding.
- For **115-05**: `docs/workflows-compatibility.md`'s check-9 row now describes a gate whose rendered sentence is a published byte contract. The sentence lives in `GATE_REASONS["meta-fields-invalid"]` and is quoted verbatim in `docs/output-catalog.md`; a reword touches both.
- The catalog's exact-count lock now reads **195**. Any later plan adding a state must move it, and it fails before the byte comparison does.

## Self-Check: PASSED

- `[ -f ]` on all four modified files: present.
- `git log --oneline --all | grep` each of `9c67b649`, `287241ab`: both found.
- `git rev-list --count 309a37cc..HEAD` = 2, equal to the `actuals.commits` figure.
- Every task's `<acceptance_criteria>` re-run: all pass, with the one documented exception — Task 1's fifth criterion is satisfied by an existing case rather than a new one (deviation 3), and Task 2's "replacing only its `notes` array" instruction is deliberately not followed (deviation 1).
- Plan-level `<verification>`: `npm test` 5637/5637, `npm run typecheck` 0, `npm run fallow` 0, `pre-commit run --all-files` clean but for the structural TruffleHog failure, with no file rewritten.
- No operator-owned file was staged: `git status --short` still shows ` M .claude/settings.json` and ` M .codex/config.toml` unstaged, and the untracked set is unchanged.

---

*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
