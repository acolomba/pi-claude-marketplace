---
phase: 111-workflows-bridge
plan: 04
subsystem: infra
tags: [versioning, changelog, integration-testing, workflows, backfill]

requires:
  - phase: 111-workflows-bridge (111-01)
    provides: the `workflowsSavedDir` / `workflowsStagingDir` members on `ScopedLocations` and `WorkflowTargetOccupiedError`
  - phase: 111-workflows-bridge (111-02)
    provides: the workflows discovery and unstage modules plus the `bridges-workflows` fallow zone
  - phase: 111-workflows-bridge (111-03)
    provides: `prepareStageWorkflows` / `commitPreparedWorkflows` and the `bridges/workflows/index.ts` barrel
provides:
  - the extension version at 0.19.0 across all six sites, which opens the load-time backfill gate
  - a `## [0.19.0]` changelog section recording the sixth component kind and the `acorn` dependency
  - an install-window integration assertion that proves the workflow envelope is written
  - a workflow fixture body the admission rule actually admits
affects: [112-install-lifecycle, milestone live acceptance testing, pull-request quality gate]

actuals:
  tokens: 7800
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Bump the version literal at six sites, not the five the repository checklist names"
    - "Invert a negative assertion rather than delete it, and keep its tautology guard beside it"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - extensions/pi-claude-marketplace/shared/extension-version.ts
    - tests/shared/extension-version.test.ts
    - sonar-project.properties
    - CHANGELOG.md
    - .planning/PROJECT.md
    - tests/integration/workflow-kind-inversion.test.ts

key-decisions:
  - "0.19.0 rather than 0.18.2: a new supported component kind is user-visible capability, which is what every prior minor heading in this changelog records. One bump serves the whole milestone; later phases append bullets under this heading."
  - "The integration test drives the bridge with two explicit calls through the barrel, because no orchestrator calls it yet. Phase 112 replaces those calls with the install-driven path and the assertion does not change."
  - "The precondition comment above the supported/unsupported assertions was rewritten because it referred to an ENOENT assertion that no longer exists. The assertion statements themselves are byte-identical."

patterns-established:
  - "Version bump verification: re-run the unit suite by hand, because none of the four local pre-commit hooks runs it and two tests guard the literal"
  - "Negative control before trusting an inverted assertion: restore the old fixture body and confirm the case goes red"

requirements-completed: [WBRG-01, WPTH-01]

coverage:
  - id: D1
    description: "The extension version literal reads 0.19.0 at all six sites, and the manifest agrees with both lockfile records."
    verification:
      - kind: unit
        ref: "tests/shared/extension-version.test.ts#exports the checked-in extension version"
        status: pass
      - kind: unit
        ref: "tests/architecture/extension-version-sync.test.ts#BFILL-02 EXTENSION_VERSION equals the repo-root package.json version"
        status: pass
      - kind: other
        ref: "node -e \"p.version === l.version && p.version === l.packages[''].version\" prints agree"
        status: pass
    human_judgment: false
  - id: D2
    description: "The CHANGELOG records the sixth component kind, its soft-fail behaviour, the unrunnable caveat, and the acorn dependency, in reader-facing language."
    verification: []
    human_judgment: true
    rationale: "Whether a bullet reads as a user-visible change rather than an internal mechanism is an editorial judgment no test asserts."
  - id: D3
    description: "The install-window assertion proves the workflow envelope is written at the project scope's canonical saved path, with the script text carried verbatim."
    requirement: "WBRG-01"
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag and its workflow script materializes as an envelope"
        status: pass
    human_judgment: false
  - id: D4
    description: "The envelope is read back from the bundle's own workflowsSavedDir rather than a hand-composed path, so the scope's path derivation is exercised end to end."
    requirement: "WPTH-01"
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag and its workflow script materializes as an envelope"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole gate chain is green and a whole-tree pre-commit run leaves no file modified."
    verification:
      - kind: other
        ref: "npm run check"
        status: pass
      - kind: other
        ref: "pre-commit run --all-files"
        status: pass
      - kind: other
        ref: "npm run test:corresponding"
        status: pass
    human_judgment: false
  - id: D6
    description: "The bumped version releases the backfill gate for a real stale record end to end."
    verification: []
    human_judgment: true
    rationale: "Not observable in this phase. The re-materialization behind the gate runs through reinstallPlugin, which gains no workflows phase until Phase 112, so nothing in-tree can exercise the repair. Deferred to the milestone's live acceptance testing."

duration: 34 min
completed: 2026-09-05
status: complete
---

# Phase 111 Plan 04: Version bump and assertion inversion Summary

**The extension version moves to 0.19.0 at all six sites, and the install-window
integration assertion turns from proving the workflow storage root absent to
proving the `hello:greet` envelope present at the project scope's saved path.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-05T07:09:00Z (approx, first edit after 111-03's final commit)
- **Completed:** 2026-09-05T11:43:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- The version literal reads `0.19.0` at every site the repository has, including
  `tests/shared/extension-version.test.ts`, which the repository's own bump
  checklist does not name.
- A `## [0.19.0]` changelog section records the sixth component kind, the
  soft-fail behaviour a reader can observe, the unrunnable-script caveat, and the
  `acorn` runtime dependency added in the preceding phase.
- `tests/integration/workflow-kind-inversion.test.ts` now drives the bridge
  through its barrel and compares the written envelope as one whole object. Its
  fixture script declares metadata the admission rule admits, so the assertion is
  answerable at all.
- The whole `npm run check` chain is green and `pre-commit run --all-files`
  rewrote nothing.

## Task Commits

1. **Task 1: Bump the extension version at all six sites** - `b524524c` (chore)
2. **Task 2: Invert the install-window assertion** - `a3939034` (test)
3. **Task 3: Take the phase through the gate** - no commit; no hook rewrote a
   file, which the plan names as the expected outcome.

## The six bumped sites

| # | Site | Before | After |
|---|------|--------|-------|
| 1 | `package.json` `version` | `0.18.1` | `0.19.0` |
| 2 | `package-lock.json` (both records, regenerated with `npm install --package-lock-only`) | `0.18.1` | `0.19.0` |
| 3 | `extensions/pi-claude-marketplace/shared/extension-version.ts` `EXTENSION_VERSION` | `0.18.1` | `0.19.0` |
| 4 | `tests/shared/extension-version.test.ts` `expectedVersion` | `0.18.1` | `0.19.0` |
| 5 | `sonar-project.properties` `sonar.projectVersion` | `0.18.1` | `0.19.0` |
| 6 | `CHANGELOG.md` | top section `## [0.18.1]` | new `## [0.19.0] - 2026-09-05` above it |

Plus the seventh, prose site: `.planning/PROJECT.md` stated the version stays at
`0.18.1` until this phase lands the bridge. That sentence and the claim depending
on it now state what is true.

The lockfile diff is two lines, both version records. Nothing was hand-edited and
`npm` normalized nothing else.

`node -e` comparing the manifest against both lockfile records prints `agree`.
Both version guards pass under a hand-run suite (`npm test`: 5378 tests, 312
suites, 0 fail) — necessary, because none of the four local pre-commit hooks runs
the unit suite.

## The changelog bullets as landed

```
## [0.19.0] - 2026-09-05

- A plugin that ships workflow scripts now installs them as workflows the Pi workflow engine can load.
- The extension reports and skips a workflow script it cannot read, or one that declares no usable metadata, and installs the rest of the plugin.
- A workflow script that declares no readable name still installs, and reports that it will not run until it declares a name and a description.
- The extension now depends on `acorn` to read the metadata that a workflow script declares.
```

Written through the plain-English and de-slop skills, as the changelog rule
requires. Each bullet is one sentence of 25 words or fewer, active voice, leading
with what changed for the reader. No bullet describes the ledger, the staging
tree, the rename, or any other internal, and no bullet lists what remains
unimplemented.

## What the bump does, and what it does not

The bump is the **enabling half** of the stale-record repair, not the repair.

`orchestrators/reconcile/backfill.ts:76` returns early while
`state.lastReconciledExtensionVersion === EXTENSION_VERSION`. Moving the constant
opens that gate, so a reload re-resolves a stale record and clears its
`{workflows}` reason token. The re-materialization behind the gate runs through
`reinstallPlugin` (`backfill.ts:343`), which gains no workflows phase until the
install-lifecycle phase.

**Artifacts for records written by the last released version do not appear in this
phase.** Nothing in this change set, and nothing in the tree, makes an envelope
exist for such a record. Phase 112 does that when it wires the bridge into the
install ledger and into reinstall.

The version is not released from this branch, so a real user crosses the version
gate exactly once, at a released `0.19.0`, by which time the bridge is wired. One
bump serves the whole milestone; later phases append bullets under the heading
created here rather than bumping again.

## The four edits to the integration test

1. **The fixture body.** `seedWorkflowPlugin` wrote
   `export default { name: "greet" };`. The real admission rule classifies that
   as declaring no metadata, so no envelope was written in any phase and the
   inverted assertion would have been red forever. It now writes
   `export const meta = { name: "greet", description: "greets" };`, which the
   same rule admits as the generated name `hello:greet`. The seeder already
   returned `pluginRoot`; the call site now captures it.
2. **The assertion.** The `assert.rejects(stat(...), { code: "ENOENT" })` block is
   replaced by an explicit bridge drive — `prepareStageWorkflows` then
   `commitPreparedWorkflows`, both imported from
   `bridges/workflows/index.ts` — followed by one whole-object comparison of the
   file read back from `locationsFor("project", cwd).workflowsSavedDir`:

   ```ts
   assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
     name: "hello:greet",
     description: "greets",
     script: 'export const meta = { name: "greet", description: "greets" };\n',
   });
   ```

   The resolver installable arm is hand-built from the captured plugin root, with
   a comment recording why that is honest: the resolver's own verdict for this
   exact fixture is asserted by the precondition above, which reads the record the
   real install wrote, so the literal supplies only the plugin root and the
   declared component path. A comment beside the two calls states that the
   install-driven path is not wired yet, so a later reader replaces them without
   re-deriving why they are there.
3. **The test title.** It claimed the install "writes no workflow artifact". It
   now reads `WINV-02 / WBRG-01: a workflow-bearing plugin installs with no
   partial flag and its workflow script materializes as an envelope`.
4. **The header comment.** It stated the storage root is not written because no
   bridge materializes the kind. It now states what the file proves: the plugin
   installs clean with no partial opt-in, and its workflow script materializes as
   an envelope at the scope's canonical saved path.

Untouched, as the plan required: the hermetic-home wrapper, the notification-row
assertions, the cleanup block, and the three `assert.ok` statements of the
positive precondition. `git diff` shows no change to those statements.

**Negative control.** After the inversion, the old fixture body was restored
temporarily and the case run again: `pass 0 / fail 1`. The assertion is not
vacuous — it fails when the bridge writes nothing.

## Direct coverage

All six named pairs report `hit === found`. No shortfall, no finding.

| Module | Branches | Functions | Lines |
|--------|----------|-----------|-------|
| `bridges/workflows/discover.ts` | 56/56 | 14/14 | 348/348 |
| `bridges/workflows/stage.ts` | 61/61 | 10/10 | 425/425 |
| `bridges/workflows/unstage.ts` | 8/8 | 1/1 | 59/59 |
| `bridges/workflows/index.ts` | 1/1 | 0/0 | 25/25 |
| `persistence/locations.ts` | 20/20 | 8/8 | 382/382 |
| `shared/errors-bridges.ts` | 13/13 | 12/12 | 141/141 |

`bridges/workflows/types.ts` takes the type-only escape and is exempt.
`npm run test:corresponding` passes, and `tests/bridges/workflows/` holds exactly
`discover.test.ts index.test.ts stage.test.ts types.test.ts unstage.test.ts` —
five modules, five owner tests.

## Gate results

- `npm run check` exits zero end to end. Unit suite 5378 / 312 suites / 0 fail;
  integration suite 32 / 0 fail.
- `pre-commit run --all-files`: every hook passed except the git-mode secret
  scanner, which aborts structurally in this worktree because the repository
  pointer is a file. No `files were modified by this hook` line appeared, so
  nothing was rewritten and Task 3 produced no commit.
- The git-mode scanner was answered per commit by a filesystem-mode scan
  (`--results=verified,unknown --fail`), each returning exit 0 with
  `verified_secrets: 0` and `unverified_secrets: 0`.

## Manual-only items

**1. The bump does not repair a stale record's artifacts in this phase.** The gate
opens and the re-resolution clears the stale reason token. The re-materialization
runs through `reinstallPlugin`, which gains no workflows phase until the
install-lifecycle phase, so nothing in the tree can observe the end-to-end repair.
This rides to the milestone's live acceptance testing.

**2. Duplication at pull-request time.** `fallow dupes` measures zero new
duplicated lines for this bridge (993 lines / 1.4% / 38 files, the pre-existing
baseline, unchanged by this phase). The hosted quality service uses a different
algorithm and may disagree. **The standing remedy is a `sonar.cpd.exclusions`
entry citing the rationale in `.planning/workstreams/workflows/port/README.md`,
explicitly not a refactor into a shared helper** — a naming decision in this
workstream declined that mechanism.

## Decisions Made

- **`0.19.0`, not `0.18.2`.** Every `0.x.0` heading in this changelog introduces
  new user-visible capability; `0.x.y` headings are fixes. A sixth component kind
  is capability. A patch bump would force a second bump later and a renamed
  section.
- **Two explicit bridge calls rather than wiring the orchestrator.** Wiring the
  install ledger is the next phase's first criterion. The explicit drive lets the
  assertion be true today and is replaced by the install-driven path without the
  assertion inverting again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The precondition's comment referred to a deleted assertion**

- **Found during:** Task 2 (assertion inversion)
- **Issue:** The comment above the positive precondition read "Without this the
  ENOENT assertion below is a tautology, green for a plugin carrying no
  `workflows/` directory at all…". After the inversion there is no ENOENT
  assertion, and the failure mode it names inverts too: those cases now make the
  envelope assertion red, not green. Left verbatim, the comment would be a false
  statement about the current code and a dangling reference, which the project's
  TypeScript comment policy forbids ("narration of code that no longer exists").
- **Fix:** Rewrote only the four comment lines to state what the precondition
  proves now — that the resolver admitted the kind, while the envelope assertion
  proves the bridge acted on it. The three `assert.ok` statements and the two
  `const` lines of the guard are byte-identical, which is what the plan's
  acceptance criterion pins.
- **Files modified:** `tests/integration/workflow-kind-inversion.test.ts`
- **Verification:** `git diff` shows no `+`/`-` line on any assertion statement in
  that block; `grep -c 'compatibility.supported'` is unchanged at 2.
- **Committed in:** `a3939034`

**2. [Rule 3 - Blocking] Type-import ordering rejected by `import-x/order`**

- **Found during:** Task 2
- **Issue:** The new `ResolvedPluginInstallable` type import was placed after the
  external `@earendil-works/pi-coding-agent` type import and separated by a blank
  line. `npm run lint` rejected both, in two successive runs.
- **Fix:** Moved the parent-relative type import first and removed the blank line
  inside the type group.
- **Files modified:** `tests/integration/workflow-kind-inversion.test.ts`
- **Verification:** `npm run lint` exits zero.
- **Committed in:** `a3939034`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Neither changed scope. The comment rewrite was required by a
binding project rule the plan's own prohibitions did not anticipate, and it
preserves the guard the prohibition protects.

## Issues Encountered

**`git status --porcelain` does not print zero, for reasons outside this plan.**
Task 3's acceptance criterion asks for an empty porcelain listing. Eight paths
remain, all present in the working tree before this plan started and none touched
by it or by any hook:

```
 M .claude/settings.json
 M .codex/config.toml
?? .claude/CLAUDE.md
?? .codegraph/
?? .mcp.json
?? .planning/workstreams/workflows/.verification-ledger.json
?? .planning/workstreams/workflows/config.json
?? AGENTS.md
```

These are operator harness configuration (Claude and Codex settings, MCP server
registration, an `AGENTS.md`, a CodeGraph index) and two GSD workstream artifacts.
Committing them would exceed the seven-path and one-path commit budgets the plan's
own `<verify>` blocks enforce. The criterion's real intent — that no hook rewrote
a file and left the rewrite uncommitted — is met: `pre-commit run --all-files`
reported no modification, and every path this plan touched is committed.

**The `compatibility.supported` grep expectation was miscounted in the plan.** The
plan expects exactly `1`; the file contained `2` before this plan and contains `2`
after, because the guard spans two lines (the `.includes` call and the failure
message's `.join`). The criterion's stated failure mode — a `0` meaning the guard
was removed — is satisfied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 111 is complete: five bridge modules with five mirrored owner tests, the
  `bridges-workflows` fallow zone, the version bump, and an install-window
  assertion that proves the envelope rather than its absence.
- Ready for phase verification.
- Phase 112 inherits two carriers from this plan: replace the two explicit bridge
  calls in `tests/integration/workflow-kind-inversion.test.ts` with the
  install-driven path (the assertion itself does not change), and add
  `"bridges-workflows"` to the `orchestrators` zone's `allow` array in
  `.fallowrc.json` at its first orchestrator import. This phase deliberately left
  that array alone, because nothing imports the bridge yet and the edge would be
  unverifiable.
- No second version bump is owed. Later phases append bullets under the
  `## [0.19.0]` heading created here.

---
*Phase: 111-workflows-bridge*
*Completed: 2026-09-05*

## Self-Check: PASSED

All eight modified paths and the SUMMARY exist on disk. Both task commits
(`b524524c`, `a3939034`) are present in `git log --all`. Every task's
`<acceptance_criteria>` was re-run; the two that could not be satisfied literally
(`git status --porcelain` printing zero, and the `compatibility.supported` grep
expecting `1`) are recorded under "Issues Encountered" with the measured numbers
rather than silently skipped.
