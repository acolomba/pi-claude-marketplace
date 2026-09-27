---
phase: 111-workflows-bridge
verified: 2026-09-05T00:00:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 111: Workflows bridge Verification Report

**Phase Goal:** The sixth bridge exists as a discover / stage / unstage triplet with the same shape as its five siblings, and writes its envelopes atomically into a directory outside every scope root.
**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## Scope note

Four SUMMARYs were written before two code-review iterations landed twelve
fix commits (`9f248b35`..`ede9459e`) that changed `stage.ts`, `unstage.ts`,
`discover.ts`, and the integration test after their SUMMARYs described them.
This verification reads the code at `HEAD` (commit range `48af9a19..HEAD`,
`8b69e1f6` is the tip), not the SUMMARY narrative, and independently
re-executed the two items the task flagged for direct testing (the
assertion-inversion negative control and the six-site version bump) rather
than trusting the executor's or reviewer's report of them.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `bridges/workflows/` provides discover / prepareStage / commitPrepared / abortPrepared / unstage; `persistence/locations.ts` owns every written path through `assertPathInside` | ✓ VERIFIED | `ls extensions/pi-claude-marketplace/bridges/workflows/` = `discover.ts index.ts stage.ts types.ts unstage.ts`. `workflowArtifactPath` is the sole composer (3 call sites: `stage.ts:182,252`, `unstage.ts:40`, each awaited); `assertTargetsUnoccupied`/`assertPathInside` chain confirmed by reading `stage.ts:244-330,367`. |
| 2 | Discovery is flat, non-recursive, refuses symlinks, dedups first-wins | ✓ VERIFIED | `tests/bridges/workflows/discover.test.ts` cases "scans...flatly", "refuses a symlinked script...", "discovers a script once when two declared spellings resolve to one directory", "folds case..." all pass (`node --test` green). Discovery-side coverage 51/51 branches. |
| 3 | A script that cannot be read or staged is reported through `warnings[]` without failing the plugin install | ✓ VERIFIED | `discover.test.ts` per-file soft-fail cases (lstat throw, unreadable file, UTF-8 round-trip failure, skipped/refused verdicts) each pair a failing file with an admissible sibling and assert the sibling still installs; all pass. |
| 4 | A stem-fallback workflow gets a `warnings[]` row that does not falsely claim the description is absent | ✓ VERIFIED | `unrunnableWarning` helper confirmed in `discover.ts` (verbatim string transcribed in 111-02-SUMMARY matches source); reused `softFailWarning` (`grep -c softFailWarning discover.ts` = 5, no second template); reason names the missing name and states the description as the engine's other requirement, never as absent. `stage.test.ts#"stages the stem-fallback envelope and carries its caveat row through"` proves the row survives to the commit result while the envelope is still staged. |
| 5 | Staging is adjacent to its target (no filesystem-boundary crossing); a commit finding foreign content at a target refuses before its first rename | ✓ VERIFIED | WPTH-05 cross-configuration invariant in `tests/persistence/locations.test.ts` (the actual guard, per 111-03-SUMMARY) passes; `stage.test.ts#"refuses a target holding foreign content before its first rename"` passes, asserting an empty `onPlaced` report, an unchanged listing, and intact foreign bytes. |
| 6 | Every file under `bridges/workflows/` has a mirrored owner test and `npm run test:corresponding` passes | ✓ VERIFIED | `tests/bridges/workflows/` = `discover.test.ts index.test.ts stage.test.ts types.test.ts unstage.test.ts` (5/5). `npm run test:corresponding` and `test:corresponding:negative` both exit 0 (independently re-run). |
| 7 | `npm run check` is green | ✓ VERIFIED | Independently re-run: `tsc --noEmit` 0 errors; `eslint` on all touched paths 0 errors; `npm run fallow` exit 0 (no `Boundary coverage`/`Unused exports` sections; the two `✗` glyphs on health/dupes are zero-above-threshold, non-failing per house convention); `prettier --check` clean on touched ts/json; `test:corresponding` + negative pass; `test:coverage:direct:negative` passes; `npm test` 5382/5382 pass; `npm run test:integration` 32/32 pass. |
| 8 | `EXTENSION_VERSION` is bumped in this phase, at all sites | ✓ VERIFIED | Independently re-grepped all six sites: `package.json` `0.19.0`; `package-lock.json` both records `0.19.0`; `extension-version.ts` `EXTENSION_VERSION = "0.19.0"`; `tests/shared/extension-version.test.ts` `expectedVersion = "0.19.0"`; `sonar-project.properties` `sonar.projectVersion=0.19.0`; `CHANGELOG.md` `## [0.19.0] - 2026-09-05` heading present with 4 reader-facing bullets, no internal-mechanism language. |
| 9 | The install-window assertion is inverted (proves the envelope present, not absent); the positive precondition is untouched | ✓ VERIFIED (independently re-tested) | See "Independent negative control" below. `tests/integration/workflow-kind-inversion.test.ts` reads the envelope back from `locationsFor("project", cwd).workflowsSavedDir` and compares it whole against `{name: "hello:greet", description: "greets", script: ...}`. Restoring old fixture body and re-running turns it red; restoring the fixture turns it green again, with `git status` clean afterward. `compatibility.supported`/`unsupported` precondition block is unchanged (per WR-05 fix and my own `git show`/diff read). |

**Score:** 9/9 ROADMAP success criteria verified, 0 present-but-behavior-unverified.

### Independent negative control (criterion 9)

Restored the old fixture body (`export default { name: "greet" };`) in
`tests/integration/workflow-kind-inversion.test.ts`, ran
`node --test tests/integration/workflow-kind-inversion.test.ts`:

```
✖ WINV-02 / WBRG-01: ... (143.5ms)
[Error: ENOENT: no such file or directory, open '.../saved/hello:greet.json']
ℹ tests 1 / pass 0 / fail 1
```

Restored the fixed body, re-ran: `1 pass, 0 fail`. `git status --porcelain --
tests/integration/workflow-kind-inversion.test.ts` printed nothing after
restoration. The assertion is not vacuous.

### Phase-declared must-haves (PLAN frontmatter, all four plans)

All `must_haves.truths` across 111-01..04 were cross-checked against source
and tests; every one resolved VERIFIED. Representative spot-checks beyond the
ROADMAP table above:

- `WorkflowTargetOccupiedError` carries a typed readonly `targetPath`, sets
  its own `name`, and extends `Error` directly (two-rung chain, not three) —
  confirmed in `shared/errors-bridges.ts` and its three-case owner test, all
  green.
- `LOCATION_KEYS` extended to 31 entries in the order the plan specifies
  (`workflowsHomeDir`, `workflowsSavedDir`, `workflowsStagingDir` after
  `marketplaceNamesCacheFile`; `workflowArtifactPath` last) — confirmed by
  reading `111-01-SUMMARY.md`'s transcribed list against
  `tests/persistence/locations.test.ts`'s `LOCATION_KEYS` array.
- The barrel withholds both prepared-union arms and re-exports 5 runtime
  bindings + 11 types by identity/mutual-assignability — confirmed by
  `index.test.ts` (5 `describe` blocks, `@ts-expect-error` privacy proofs)
  passing and `index.ts` coverage at 1/1 branches, 0/0 functions, 25/25 lines.
- No second composer of a workflow artifact path anywhere in the tree — `grep`
  over `extensions/` for `workflowArtifactPath` call sites returns exactly the
  three noted above, matching the prohibition.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `extensions/pi-claude-marketplace/persistence/locations.ts` | workflows path members + composer | ✓ VERIFIED | Present, wired (3 call sites), 20/20 branches, 8/8 functions, 382/382 lines |
| `extensions/pi-claude-marketplace/shared/errors-bridges.ts` | `WorkflowTargetOccupiedError` | ✓ VERIFIED | Present, raised in `stage.ts:300`, 13/13 branches, 12/12 functions, 141/141 lines |
| `extensions/pi-claude-marketplace/bridges/workflows/types.ts` | 13 bridge types | ✓ VERIFIED | Present, type-only (classified, no coverage owed), consumed compile-time by `types.test.ts` |
| `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` | flat symlink-refusing scan + soft-fail channel + criterion-4 arm | ✓ VERIFIED | Present, 51/51 branches, 13/13 functions, 344/344 lines |
| `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts` | by-name removal, PI-14-compliant | ✓ VERIFIED | Present, 11/11 branches, 1/1 functions, 100/100 lines (post-WR-10 fix) |
| `extensions/pi-claude-marketplace/bridges/workflows/stage.ts` | prepare/commit/abort triplet | ✓ VERIFIED | Present, 62/62 branches, 14/14 functions, 456/456 lines (post-WR-11/WR-12 fixes) |
| `extensions/pi-claude-marketplace/bridges/workflows/index.ts` | barrel | ✓ VERIFIED | Present, 1/1 branches, 0/0 functions, 25/25 lines |
| `.fallowrc.json` | `bridges-workflows` zone/allow/forbidden-calls | ✓ VERIFIED | 3 occurrences confirmed; allow list is exactly `domain, persistence, shared, platform`; `orchestrators` allow-list deliberately omits `bridges-workflows` (no orchestrator imports it yet) |
| `tests/bridges/workflows/*.test.ts` (5 files) | mirrored owner tests | ✓ VERIFIED | All 5 present, all pass, `test:corresponding` green |
| `tests/integration/workflow-kind-inversion.test.ts` | inverted install-window assertion | ✓ VERIFIED | Present, inverted, negative-controlled independently (see above) |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `bridges/workflows/discover.ts` | `domain/workflow-script.ts` | `admitWorkflowScript` | ✓ WIRED |
| `bridges/workflows/discover.ts` | `shared/path-safety.ts` | `assertPathInside` (loud read-side containment) | ✓ WIRED — confirmed both parent-relative and absolute declared-path refusal cases pass |
| `bridges/workflows/unstage.ts` | `persistence/locations.ts` | `workflowArtifactPath(name)` | ✓ WIRED |
| `bridges/workflows/stage.ts` | `persistence/locations.ts` | `workflowArtifactPath(generatedName)`, awaited at all 2 call sites | ✓ WIRED |
| `bridges/workflows/stage.ts` | `shared/errors-bridges.ts` | `WorkflowTargetOccupiedError` raised pre-first-rename | ✓ WIRED |
| `bridges/workflows/stage.ts` | `bridges/workflows/discover.ts` | warnings forwarded unchanged into `StageWorkflowsCommitResult` | ✓ WIRED |
| `.fallowrc.json` | `bridges/workflows/` | `bridges-workflows` zone pattern | ✓ WIRED — `npm run fallow` boundary-coverage section empty |
| `tests/integration/workflow-kind-inversion.test.ts` | `bridges/workflows/index.ts` | barrel-driven `prepareStageWorkflows`/`commitPreparedWorkflows` | ✓ WIRED |

### Post-review fix verification (WR-10, WR-11, WR-12 — the critical scope note)

All three Warnings from the iteration-2 review were independently confirmed
fixed by reading the code (not just the fix report) and running the
regression tests:

- **WR-10** (`unstagePluginWorkflows` swallowing `PathContainmentError`):
  `unstage.ts` now accumulates a `refusal` variable, continues the loop past
  it, and raises the first one bare after the loop — confirmed by reading the
  full source and by `unstage.test.ts#"raises the first symlinked target after
  removing the names after it"` passing (two refused names + one removable,
  asserting first-wins raise + later-name removal).
- **WR-11** (leak text contradicting the placement report): `stage.ts` now
  builds one `stranded` list (filtered by `restoredTargets.has(pair.to)`) that
  feeds both `reportPlaced` and `rollbackLeaks` — confirmed by reading
  `stage.ts:414-436` and by `stage.test.ts:1000`'s
  `assert.doesNotMatch(error.message, /failed to roll back workflow rename/)`
  passing on the reclaimed-target case.
- **WR-12** (`.previous` join anchored on itself): `stage.ts:262` now anchors
  `assertPathInside(prepared.stagingRoot, aside, ...)` on the staging root, one
  level above `.previous` — confirmed by reading the source and by
  `stage.test.ts#"refuses a displaced directory that has been replaced by a
  symbolic link"` passing.

**IN-06** (a throwing `onPlaced` destroys the original error and every
rollback leak): left unfixed as Info, explicitly out of `--fix` scope without
`--all`, per `111-REVIEW-FIX.md`'s iteration-2 footer. Adjudicated as a
legitimate non-blocking carry-forward, not a phase gap: it is a pre-existing
shape issue (a caller-supplied callback that throws destroys its caller's
error is a general JS hazard, not specific to this phase's new code), it
requires no runtime change to any must-have behavior, and the codebase's own
established convention (Phase 109/110 reviews) is that Info findings remain
open by design with no individual ROADMAP carrier — only Warnings that affect
a later phase's correctness get a numbered carrier (as WR-08 and WR-09 did).
No carrier is missing; none was owed.

### WR-08 / WR-09 durable-carrier check

Both deferrals verified present as numbered ROADMAP criteria, not just prose:

- **WR-08** (orphaned staging trees): `ROADMAP.md` Phase 112, criterion 6 —
  "An orphaned staging tree is swept or reported." — confirmed present,
  explicitly attributes the deferral to Phase 111's review.
- **WR-09** (install-tense warning phrases feeding `info`): `ROADMAP.md` Phase
  113, criterion 5 — "The discovery warning phrases stop asserting an install
  outcome on the `info` surface." — confirmed present, explicitly attributes
  the deferral to Phase 111's review (WR-09).

### WNAM-03 / WPTH-02 split-closure check

Both requirements were split across Phase 110 (classification/derivation
half) and Phase 111 (the owed half), per `REQUIREMENTS.md`'s traceability
table. Both halves confirmed closed here:

- **WNAM-03** ("a script with no `meta` declaration is skipped with a warning
  and not installed"): `discover.ts`'s `skippedWarning` composes
  `"...was not installed: ..."`; `discover.test.ts#"warns about a script that
  declares no metadata and still records the verdict"` asserts the record
  carries `outcome: "skipped"` (never staged) and the exact warning text.
- **WPTH-02** (the never-written guarantee): `tests/persistence/locations.test.ts#"WPTH-02
  roots the saved directory under the home and never under the project"`
  passes, using a cwd distinct from the relocated home so the assertion is not
  incidentally true.

Neither is orphaned: `REQUIREMENTS.md`'s traceability table names both
explicitly and neither is unaccounted for.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WBRG-01 | 111-02, 111-03, 111-04 | Envelope shape `{name, description?, script}`, verbatim script bytes | ✓ SATISFIED | `stage.test.ts` byte-comparison cases; integration test |
| WBRG-02 | 111-02 | Flat, non-recursive, symlink-refusing, first-wins dedup | ✓ SATISFIED | `discover.test.ts` |
| WBRG-03 | 111-02 | Per-file soft-fail via `warnings[]` | ✓ SATISFIED | `discover.test.ts` |
| WBRG-04 | 111-03 | Engine's own directory scan discovers installed workflows; single-rename crossing | ✓ SATISFIED | `stage.test.ts` happy-path + same-device cases |
| WPTH-01 | 111-01 | User/project scope canonical paths | ✓ SATISFIED | `locations.test.ts` |
| WPTH-03 | 111-01 | Project key composition (derivation half closed in Phase 110) | ✓ SATISFIED | `locations.test.ts` composition case; split reading recorded in 111-01-SUMMARY |
| WPTH-04 | 111-01, 111-03 | New writable root, all writes contained | ✓ SATISFIED | `locations.test.ts`, `stage.test.ts` staging-containment case |
| WPTH-05 | 111-01, 111-03 | Staging adjacent, no EXDEV | ✓ SATISFIED | Cross-configuration invariant + same-device corroboration |
| WNAM-03 (owed half) | 111-02 | Warning + not-installed for no-meta scripts | ✓ SATISFIED | See split-closure check above |
| WPTH-02 (owed half) | 111-01 | Never `<cwd>/.pi/workflows/saved` | ✓ SATISFIED | See split-closure check above |

No orphaned requirements: cross-referenced `REQUIREMENTS.md`'s Phase 111 rows
against all four plans' `requirements` frontmatter fields; every ID accounted
for in both directions.

### Anti-Patterns Found

None. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all files this
phase created or modified (bridge files, locations.ts, errors-bridges.ts, all
owner tests, the integration test) returned nothing. No `fallow-ignore`
marker in any touched file. No planning-artifact token (`Phase NN`, `Plan NN`,
`Wave N`, bare `Pitfall N`) in any comment or test title.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Unit suite (workflows + related) | `node --test tests/bridges/workflows/ tests/persistence/locations.test.ts tests/shared/errors-bridges.test.ts tests/shared/extension-version.test.ts tests/architecture/extension-version-sync.test.ts` | 107/107 pass | ✓ PASS |
| Full unit suite | `npm test` | 5382/5382 pass | ✓ PASS |
| Integration suite | `npm run test:integration` | 32/32 pass | ✓ PASS |
| Typecheck | `tsc --noEmit` | 0 errors | ✓ PASS |
| Lint (touched paths) | `eslint <touched paths>` | 0 errors | ✓ PASS |
| Format | `prettier --check <touched ts/json>` | clean | ✓ PASS |
| Fallow | `npm run fallow` | exit 0, no boundary-coverage/unused-exports findings | ✓ PASS |
| Corresponding-test gate | `npm run test:corresponding[:negative]` | pass | ✓ PASS |
| Direct-coverage negative control | `npm run test:coverage:direct:negative` | pass | ✓ PASS |
| Direct coverage, all 6 touched pairs | `npm run test:coverage:direct -- <each path>` | all `hit === found` | ✓ PASS |
| Criterion-9 negative control | restore old fixture, re-run, restore | red then green, `git status` clean | ✓ PASS (independently reproduced) |

### Probe Execution

Not applicable — this phase is not a migration/tooling phase and declares no
`scripts/*/tests/probe-*.sh` files. `find scripts -path '*/tests/probe-*.sh'`
returns nothing relevant to this phase.

### Human Verification Required

None. All must-haves resolved to VERIFIED programmatically; no
present-but-behavior-unverified truths remain (all behavior-dependent
truths — the rollback branches, the occupancy refusal, the criterion-9
inversion — are exercised by passing tests, several of which were
independently re-run against the pre-fix source to confirm they are
red-first regressions rather than incidental passes).

### Gaps Summary

None. All 9 ROADMAP success criteria verified, all 8 phase-declared
requirement IDs satisfied, both split-requirement halves (WNAM-03, WPTH-02)
confirmed closed, both review deferrals (WR-08, WR-09) confirmed carried on
durable ROADMAP criteria, and all three post-review Warning fixes (WR-10,
WR-11, WR-12) confirmed landed in source with passing red-first regression
tests. The one open Info finding (IN-06) is adjudicated as a legitimate,
non-blocking carry-forward consistent with house convention, not a gap.

---

*Verified: 2026-09-05*
*Verifier: Claude (gsd-verifier)*
