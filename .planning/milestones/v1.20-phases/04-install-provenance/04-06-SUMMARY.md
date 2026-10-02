---
phase: 04-install-provenance
plan: 06
subsystem: orchestrators
tags: [provenance, promotion, notification-catalog, closed-set, install, node-test, docs]

# Dependency graph
requires:
  - phase: 04-install-provenance
    provides: plan 04-01's `provenance` field on every install record (D-04-01), plan 04-05's retired config write and its `writePluginConfigEntry`-only orchestrated arm (D-04-02), and the `writeAdoptingConfigEntries` standalone write (D-04-04 step 3)
provides:
  - "PROV-03 has a code path: `install <plugin>` on a record whose `provenance` is `\"dependency\"` flips that one field to `\"explicit\"`, declares the plugin's key in the desired-state config, saves, and reports one `installed` row carrying `{already installed, dependency promoted}` at info severity with no reload hint (D-04-07)"
  - "The closed reason set is 54 members; `dependency promoted` is the tail member, owned by install's command-private partition and outside the idempotent group"
  - "`composePromotedRow` in `install.messaging.ts` -- a separate exported composer; `composeInstallFailureMessage` is untouched at 20 cyclomatic / 15 cognitive"
  - "`promoteDependencyRecord` and `promotedRowOutcome` in `install-flow.ts`; the lock closure and the outer function each gained exactly one condition (fallow 12/11 -> 13/12 and 12/13 -> 13/14 against 20/15)"
  - "All catalog surfaces moved in one commit: `docs/output-catalog.md` section + `dependency-promoted` anchor, the fixture, `EXPECTED_STATE_COUNT` 205 -> 206, `EXPECTED_UTF8_BYTES` 27_293 -> 27_385, the parser tuple count 205 -> 206, the length lock 53 -> 54, both full enumerations"
  - "`npm run check` exit 0 on the committed tree (6382/6382 unit, 32/32 integration); `pre-commit run --all-files` exit 0, 31 hooks passed"
affects: [05-prune]

# Actuals (#2632) -- chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 8364
  tasks: 3
  commits: 1
plan_head_before: 1201d6256d1800df22f3243c324830ac801c0687

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A lock-closure escape that carries an object rather than a bare `let`: the closure's write is not visible to TypeScript's flow analysis at the post-guard read, so a `let` declared without an initializer reads as `undefined` there and the `record: promoted` argument fails to type; an object with a declared `T | undefined` property narrows from its declared type (the `disabledInstall` precedent)"
    - "Catalog bytes produced by running the dispatcher over the composer's output through the same `makeCtx` boundary the contract test uses, then pasted; the fixture is hand-written from the contract as the independent expectation"
    - "Count-ledger sweep after a closed-set amendment: every literal count of the set (header prose, test titles, assertion constants) is grepped and bumped, because a title such as `parses all 205 independent catalog tuples` is a pin the plan's nine-surface list did not name"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat/fixtures/plugin-install.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/shared/notification-types.test.ts
    - tests/orchestrators/plugin/install.messaging.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts

key-decisions:
  - "Task 1 (checkpoint:decision, answered by the developer before dispatch): proceed-as-decided. Reason token `dependency promoted` (lowercase, one space, no punctuation); status token `installed`; info severity; no reload hint; carried beside `already installed`. `skipped` and every other wording were considered and rejected"
  - "The promotion's config write is `writeAdoptingConfigEntries` (the standalone install arm's own writer), not the bare `writePluginConfigEntry` the plan named: it writes the promoted key alone AND adopts the marketplace entry when the merged view does not declare it, which a dependency resolved through the CMP-3 fallback from another marketplace needs -- a bare key there is the dangling declaration the planner turns into a marketplace removal plus a perpetual failed row (see Deviations)"
  - "The promotion outcome is `{ status: \"installed\", version, resourcesChanged: false, declaresAgents, declaresMcp }` with the declares-flags read off the record's own `resources`, so an orchestrated caller (import) describes the promoted plugin as it is rather than as empty; the standalone row carries `dependencies: []` because nothing was materialized and no companion can be missing on it"
  - "Row-level `scope` is set on the promotion row (the plan lists it as a composer input); `renderScopeBracket` suppresses it when it equals the block's scope, so the bytes are the same as the file's scope-omitting composers produce"
  - "Tasks 2 and 3 landed in ONE commit (`bb300d96`): the `npm-coverage-direct` hook runs `tests/shared/notification-types.test.ts` alone on any `notification-types.ts` change and that suite's enumeration pin is red until Task 3 amends it, so no split passes every hook (as 04-04 and 04-05 found)"
  - "The plan's nine surfaces were ten: `tests/architecture/catalog-uat/catalog-parser.test.ts` pins the parsed tuple count (205) in a title and an assertion; the full `npm run check` found it, and it was bumped in the same commit"

patterns-established:
  - "D-04-08 anchoring: every new comment and test title cites `D-04-07` or `D-04-02`; `grep -o 'PROV-[0-9]*'` over `install-flow.ts` still reads 3 (the pre-existing git-auth citations)"

requirements-completed: [PROV-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Installing by name a dependency-installed plugin flips its provenance to explicit and changes nothing else in the state document (whole-document equality against the pre-promotion snapshot with one field substituted)"
    requirement: PROV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-07: installing a dependency by name flips its provenance and nothing else in the state document"
        status: pass
    human_judgment: false
  - id: D2
    description: "The promotion declares exactly the promoted key in `claude-plugins.json` (whole-document bytes) and emits one `installed` row `{already installed, dependency promoted}` at info with no summary line and no reload trailer; the outcome is `installed` with `resourcesChanged: false`"
    requirement: PROV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-07: the promotion declares the promoted key and reports one installed row at info severity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.messaging.test.ts#D-04-07: composes an installed row carrying the promotion brace at info severity with no reload"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.messaging.test.ts#D-04-07: the promotion row renders through the installed arm with the brace in reason order"
        status: pass
    human_judgment: false
  - id: D3
    description: "An orchestrated promotion flips the record, writes no declaration, emits nothing and returns the installed outcome"
    requirement: PROV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-07: an orchestrated promotion flips the record, writes no declaration and emits nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A plugin already recorded as a direct install still fails with the already-installed refusal, byte for byte, and neither state.json nor the config is written (PROV-03's empty case)"
    requirement: PROV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-07: a plugin already recorded as a direct install still fails with the already-installed refusal"
        status: pass
    human_judgment: false
  - id: D5
    description: "The closed-set amendment landed in full and every gate that pins it is green: catalog contract (206 states, 27_385 bytes), parser tuple count, length lock (54), both enumeration pins, and the omission plant was observed firing"
    requirement: PROV-03
    verification:
      - kind: unit
        ref: "node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts -> 27/27"
        status: pass
      - kind: other
        ref: "planted removal of the `dependency-promoted` fixture entry: node --test --test-reporter=tap catalog-contract.test.ts -> exit 1, `not ok 4 ... 205 !== 206` at line 345; restored, sha256 cd0c5367a4af0a88 before and after, 4/4"
        status: pass
      - kind: other
        ref: "npm run check -> exit 0 (typecheck, lint, lint:workflows x2, fallow dead-code `No issues found` / health `0 above threshold` / dupes, format:check, test:corresponding x2, test:coverage:direct:negative, test 6382/6382, test:integration 32/32); SKIP=trufflehog pre-commit run --all-files -> exit 0, 31 passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "In a live Pi session, install a plugin as a dependency of another, then install it by name, and confirm the row reads sensibly and states the promotion"
    requirement: PROV-03
    verification: []
    human_judgment: true
    rationale: "The catalog contract pins the bytes; whether the row reads sensibly to a person in a live session is the judgment 04-VALIDATION carries into phase UAT"

# Metrics
duration: 39min
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 06: The promotion row and the closed-set amendment Summary

**`install <plugin>` on a record that arrived as a dependency now promotes it -- one field of one record flips to `"explicit"`, the key joins the desired-state config, and the command reports `● <plugin> v<version> (installed) {already installed, dependency promoted}` at info -- with the 54th closed-set reason landed across all ten pinning surfaces in one commit.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-09-16T14:17:10Z
- **Completed:** 2026-09-16T14:56:08Z
- **Tasks:** 3 (Task 1 was the pre-answered decision)
- **Files modified:** 13

## Task 1 -- the decision, as recorded

Answered by the developer before dispatch: **proceed-as-decided**.

| Sub-choice | Answer |
|---|---|
| (a) reason token | **`dependency promoted`** -- exactly this string, lowercase, one space, no punctuation; appended at the tail of `REASONS` (index 53, the 54th member) |
| (b) status token | **`installed`**, at info severity, no reload hint, the new reason carried beside the existing `already installed` |
| rejected | `skipped` (reads as not-carried-out for something that was carried out); any other wording; a new status token (outside D-04-07's enumerated surfaces) |

## Accomplishments

- **`notification-types.ts`:** `"dependency promoted"` appended at the tail of `REASONS` with an inline note in the register of its neighbours: the fact it names (a recorded dependency the user then named, promoted to a direct install) and why `already installed` alone cannot carry it (that token alone is a refusal; this row is a state change).
- **`notify-reasons.ts`:** the header ledger gains the `53 to 54` sentence and the two literal `53-entry` mentions read `54-entry`; the token has its home in `CommandPrivateReason` (install-owned, like `data kept`), and is NOT in `IDEMPOTENT_REASONS` -- `skipSeverity(["already installed", "dependency promoted"])` would read `warning`, which is precisely why the row is not a skipped row.
- **`install.messaging.ts`:** `composePromotedRow({ plugin, version, scope })` -> `{ status: "installed", name, version, scope, dependencies: [], reasons: ["already installed", "dependency promoted"], severity: "info", needsReload: false }`. `composeInstallFailureMessage` gained no branch.
- **`install-flow.ts`:** `promoteDependencyRecord` (the whole decision: absent record or non-dependency provenance -> `undefined`; otherwise flip the field, write the config unless orchestrated, return the record) and `promotedRowOutcome` (mirrors `failedRowOutcome`: orchestrated returns the outcome, standalone also emits through `notifyWithContext` + `INSTALL_CONTEXT`). The lock closure calls the first right after the CFG-03 abort arm and before the cascade, saves explicitly and returns; one escape object `promotion` beside the existing escape flags; one post-guard `if` beside the existing ones. The WR-04 comment now says the cascade arm is one of two mutating arms. `install-outcome.ts`'s already-installed throw is untouched.
- **Catalog:** the `### Dependency promoted to a direct install (D-04-07)` section with `<!-- catalog-state: dependency-promoted -->`, its fenced block produced by RUNNING `notify()` over `composePromotedRow` through the contract test's own `makeCtx` boundary (92 UTF-8 bytes), and a paragraph on why both tokens and neither alone. `grep -c 'catalog-state:'`: 210 -> 211.
- **Gates:** `EXPECTED_STATE_COUNT` 205 -> 206 with its ledger comment; `EXPECTED_UTF8_BYTES` 27_293 -> 27_385 (+92, the rendered block; confirmed by the contract test, and re-confirmed after the mdformat/markdownlint hooks ran over the catalog with no reflow); the contract test's title `205` -> `206` (as the RESV-05 bump did); `catalog-parser.test.ts` title + assertion `205` -> `206`; `REASONS.length` lock `53` -> `54` with its ledger entry and the title `53-entry` -> `54-entry`; both full enumerations end with `"dependency promoted"` and stay equality assertions.

## Measured complexity (fallow, `health --complexity --max-cyclomatic 1 --max-cognitive 1`)

| Function | Before (cyc/cog) | After (cyc/cog) | Ceiling |
|---|---|---|---|
| `composeInstallFailureMessage` (`install.messaging.ts`) | 20 / 15 | **20 / 15** (unchanged) | 20 / 15 |
| `installPluginWithTransaction` (`install-flow.ts`) | 12 / 13 | **13 / 14** (+1 / +1: the one post-guard `if`) | 20 / 15 |
| its lock closure (`<arrow>`) | 12 / 11 | **13 / 12** (+1 / +1: the one promotion `if`) | 20 / 15 |
| `promoteDependencyRecord` (new) | -- | 4 / 3 | 20 / 15 |
| `promotedRowOutcome` (new) | -- | 2 / 1 | 20 / 15 |
| `composePromotedRow` (new) | -- | 1 / 0 | 20 / 15 |

`npm run fallow` exit 0: dead-code `No issues found`, health `0 above threshold` (13322 analyzed), dupes exit 0. ESLint clean after two adjustments during the task: `prefer-optional-chain` (`record?.provenance !== "dependency"`) and `sonarjs/no-invariant-returns` on `promotedRowOutcome` (one return after a `!orchestrated` notify, instead of two returns of the same value).

## TDD Gate Compliance (Task 2, `tdd="true"`)

- **RED:** the four `D-04-07` cases were written into `install-flow.test.ts` and run against the unmodified `install-flow.ts`:

```text
$ node --test --test-reporter=tap --test-name-pattern "D-04-07" tests/orchestrators/plugin/install-flow.test.ts
not ok 1 - D-04-07: installing a dependency by name flips its provenance and nothing else in the state document
not ok 2 - D-04-07: the promotion declares the promoted key and reports one installed row at info severity
not ok 3 - D-04-07: an orchestrated promotion flips the record, writes no declaration and emits nothing
ok 4 - D-04-07: a plugin already recorded as a direct install still fails with the already-installed refusal
# tests 4  # pass 1  # fail 3   (exit 1)
```

  Case 1 failed on the whole-document `deepStrictEqual` with `+ provenance: 'dependency' / - provenance: 'explicit'` -- the install threw already-installed on the non-mutating arm and saved nothing. Case 4 is the regression guard for the unchanged empty case and was expected green. `gsd_run check tdd-red-evidence` on the raw TAP: **`RED_EVIDENCE_OK` (`target_test_failed`)**, `failing_tests` = cases 1-3.
- **GREEN:** after the four source edits, 4/4; `git log --grep '^feat(04-06):'` -> `bb300d96`. No `test(04-06):` commit exists on its own -- the RED edits ride the same commit, for the hook reason under Deviations. The first green run had case 2 red on `severity: "info"`: the dispatcher passes NO severity argument for info, so the expectation became the bare `{ message }` record (the file's existing `note.severity === undefined` idiom).
- **REFACTOR:** none as a separate commit; the two lint-driven reshapes above happened before the single commit.

## The omission plant

With every surface in place, the `dependency-promoted` fixture entry was removed from `plugin-install.ts` (byte copy taken first; `grep -c '"dependency-promoted"'` -> 0):

```text
$ node --test --test-reporter=tap tests/architecture/catalog-uat/catalog-contract.test.ts
not ok 4 - catalog contract matches all 20 fixture modules to 205 exact documented states
    205 !== 206     (catalog-contract.test.ts:345 -- the fixture-state count against EXPECTED_STATE_COUNT)
# tests 4  # pass 3  # fail 1   (exit 1)
```

Restored from the byte copy: sha256 `cd0c5367a4af0a88...` before and after, `grep -c` -> 1, 4/4.

## Measured gate

| Check | Result |
|---|---|
| `npm run check` on the tree committed as `bb300d96` | **exit 0** (282 s) |
| `npm test` | 6382 tests, 6382 pass, 0 fail (6376 at the end of 04-05 + 4 flow cases + 2 messaging cases) |
| `npm run test:integration` | 32 pass, 0 fail |
| `node --test --test-name-pattern "D-04-07" install-flow.test.ts` | 4 pass, 0 fail |
| Task 2 focused run (`notification-types`, `notify-reasons`, `install.messaging` tests) BEFORE Task 3 | 92 tests, 91 pass, **1 fail** -- the shared enumeration pin, exactly as the plan's `<fails_when>` says to expect and record |
| Task 3 four-suite run | 27 pass, 0 fail |
| `npm run typecheck` | clean (the coverage proof compiles: the token has a partition home) |
| `npm run test:coverage:direct:commit` (the hook's script) | exit 0; the one recorded shortfall (`install-outcome.ts` 114/116 branches) is pre-existing and pinned |
| `SKIP=trufflehog pre-commit run --files <13 files>` before the commit | 23 hooks passed, nothing rewritten |
| `SKIP=trufflehog pre-commit run --all-files` after the commit | exit 0, 31 hooks passed |
| `grep -c 'catalog-state:' docs/output-catalog.md` | 210 before, 211 after |
| `REASONS.length` / last member | 54 / `dependency promoted` |
| `grep -o 'PROV-[0-9]*' install-flow.ts` | 3 (unchanged, the git-auth citations) |

## Task Commits

1. **Task 2: The closed-set member and the promotion on the mutating arm** + **Task 3: Move all catalog surfaces in one commit** -- `bb300d96` (feat), 13 files, +525/-14 (see Deviations for why one commit)

**Plan metadata:** the `docs(04-06)` commit that adds this file.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts` -- `"dependency promoted"` appended to `REASONS` with its note
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` -- header ledger sentence, `54-entry`, the `CommandPrivateReason` arm
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` -- `composePromotedRow`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` -- import, `promoteDependencyRecord`, `promotedRowOutcome`, the `promotion` escape object, the lock-closure arm, the post-guard arm, the amended WR-04 comment
- `docs/output-catalog.md` -- the promotion section and anchor
- `tests/architecture/catalog-uat/fixtures/plugin-install.ts` -- the `dependency-promoted` fixture
- `tests/architecture/catalog-uat/catalog-contract.test.ts` -- both constants, the ledger comment, the title
- `tests/architecture/catalog-uat/catalog-parser.test.ts` -- the tuple count (title + assertion)
- `tests/architecture/notify-closed-set-locks.test.ts` -- the length lock, its ledger entry, the title
- `tests/architecture/compat-01-no-expansion.test.ts` -- the enumeration tail
- `tests/shared/notification-types.test.ts` -- the enumeration tail
- `tests/orchestrators/plugin/install.messaging.test.ts` -- two `composePromotedRow` cases (shape; render through the `installed` arm with no soft-dep marker whatever the host lacks)
- `tests/orchestrators/plugin/install-flow.test.ts` -- `seedDependencyInstalled` helper and the four `D-04-07` cases

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The promotion's config write adopts the marketplace when the merged view does not declare it**
- **Found during:** Task 2, designing `promoteDependencyRecord`
- **Issue:** the plan names the bare single-entry writer (`writePluginConfigEntry`, as `writeOrchestratedDeclarations` uses it). A dependency can be recorded in the target scope through the CMP-3 project->user fallback from a marketplace the target scope's config never declared (the cascade adopts the marketplace RECORD into the target state but only the root's marketplace is ever declared). Writing that dependency's bare key on promotion is the dangling declaration `writeAdoptingConfigEntries`'s own doc describes: the planner converts it into a marketplace removal plus a perpetual failed row.
- **Fix:** the promotion writes through `writeAdoptingConfigEntries` with `pluginPatch: {}` -- the same call, with the same membership gate over both physical files, that the standalone install arm makes for a fresh install by name. It still writes the promoted plugin's key and nothing else on the plugin side; the marketplace entry is added only when neither file declares it. Skipped in orchestrated mode, as the plan requires. T-04-15's mitigation holds in substance (one plugin key, no reconcile clobber); its "single-entry writer" wording is what changed.
- **Files modified:** `install-flow.ts`
- **Verification:** the D-04-07 config-bytes case (same-marketplace dependency: the marketplace is already declared, so the write is the plugin key alone and the document bytes are pinned). The cross-marketplace adoption arm itself is exercised by the writer's existing tests, not by a new install-flow case.
- **Committed in:** `bb300d96`

**2. [Rule 3 - Blocking] A tenth pinning surface: `catalog-parser.test.ts`**
- **Found during:** Task 3's `npm run check` (`npm test` link)
- **Issue:** `loadCatalogExamples parses all 205 independent catalog tuples` asserts `examples.length === 205` and carries the count in its title. It is not in the plan's nine-surface list or in 04-PATTERNS' checklist; the RESV-05 precedent commit (`c9695872`) bumped it too.
- **Fix:** title and assertion `205` -> `206`; the parser suite 12/12; `npm run check` re-run from the top, exit 0.
- **Files modified:** `tests/architecture/catalog-uat/catalog-parser.test.ts`
- **Committed in:** `bb300d96`

### CLAUDE.md-driven adjustment

**3. [Rule 2 - CLAUDE.md precedence] Tasks 2 and 3 landed in one commit**
- **Found during:** Task 2's commit planning
- **Issue:** the `npm-coverage-direct` hook runs `tests/shared/notification-types.test.ts` alone whenever `notification-types.ts` changes, and that suite's `EXPECTED_REASONS` equality pin is red until Task 3 appends the token (the plan's own `<fails_when>` for Task 2 records this red). The `npm-typecheck` hook likewise rejects `install.messaging.test.ts` importing `composePromotedRow` before the source exists, which rules out a separate RED commit. CLAUDE.md requires every hook green before a commit and forbids committing through a failure.
- **Fix:** one `feat(04-06)` commit carrying all thirteen files with every hook green. The RED proof is a recorded run (`RED_EVIDENCE_OK`), not a commit -- the shape 04-03, 04-04 and 04-05 recorded.
- **Files modified:** all thirteen

### Small departures, recorded

- The escape value is an object `promotion: { record: PluginInstallRecord | undefined }` rather than a bare `let`, and it carries the RECORD rather than only "the promoted record's version" the plan names: the post-guard outcome also needs the record's `resources` for the declares-flags, and a bare `let` assigned only inside the closure reads as `undefined` at the post-guard site under TypeScript's flow analysis (the `disabledInstall` object exists for the same reason).
- One comment in the new tests originally read "PROV-03's empty case"; it was reworded to `D-04-07` before the commit (D-04-08).

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking), 1 CLAUDE.md-driven commit-shape adjustment, 2 small departures recorded. **Impact:** the marketplace-adoption change is the only behavioral difference from the plan's text and it closes a reconcile-convergence hole the plan's writer would have opened; everything else is which commit or which shape, not what.

## Issues Encountered

- This checkout is a linked worktree (`.git` is a file) on the developer's `features/manifest` branch, dispatched in sequential mode; STATE.md and ROADMAP.md were not touched. The developer's uncommitted edits (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`) and untracked files were never staged.
- No git pre-commit hook is installed; hooks were run by hand (`--files` before the commit, `--all-files` after).
- The markdown hooks were run over `docs/output-catalog.md` BEFORE the byte-length lock was taken as final: 11 insertions, nothing reflowed, so the +92 held.

## Threat register notes

- **T-04-13 (mitigated):** the whole-document equality case is the control; no ledger runs on the promotion path (the cascade is never reached), so version, resources and timestamps are the cascade's.
- **T-04-14 (mitigated):** the row is `installed` at info with the new reason; the catalog fixture pins its bytes; the refusal row's bytes are pinned by the D-04-07 empty-case test and the existing PI-5 case.
- **T-04-15 (mitigated, wording amended):** the write declares the promoted plugin's key only on the plugin side, adopts the marketplace only when undeclared, and is skipped in orchestrated mode (the orchestrated case asserts the config bytes are unchanged).
- **T-04-02 (mitigated):** the promotion writes the `"explicit"` schema literal; `tx.save()` revalidates before writing.
- **T-04-SC:** accepted per the plan; nothing to record.

## The two items the phase owes its successor

1. **The migrate fill labels every record a development build wrote before wave 1 as a direct install, including ones that genuinely arrived as dependencies.** Phase 5's prune will therefore decline to prune those specific plugins on the operator's own machine. The remedy is to uninstall and reinstall the plugin -- not to debug prune. Carry this into Phase 5's UAT.
2. **Development trees that installed dependencies between wave 1 and wave 5 end the phase with config entries that violate the desired-state invariant on that machine.** They are inert (reconcile reads declared + recorded + enabled as steady state) and no cleanup is in scope. A promotion on such a tree writes the same key again (entry-level merge, no change).

## Next Phase Readiness

- The one-way ratchet is closed: `dependency` -> `explicit` on install-by-name (this plan), never the reverse (04-01's cascade skip). Phase 5's `--prune` can read `provenance` as the single fact it needs.
- Phase UAT item carried from 04-VALIDATION: in a live Pi session install a plugin as a dependency, then by name, and confirm the row reads sensibly (`D6` above).
- Accepted debt named in the plan's assumption-delta stands: the promotion rides an `installed` row with a reason brace; a second "record changed, nothing materialized" outcome would be the trigger for a status token of its own.

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on all 13 modified files: FOUND
- Commit `bb300d96` present in `git log`: FOUND
- `commits: 1` measured from `plan_head_before` `1201d625..HEAD`
