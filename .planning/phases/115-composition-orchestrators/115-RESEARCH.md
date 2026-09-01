# Phase 115: Composition Orchestrators - Research

**Researched:** 2026-09-01
**Domain:** In-repo TypeScript unit-test refactor — composition orchestrators (import cascade,
bootstrap onboarding, edge dependency wiring, load-time reconcile)
**Confidence:** HIGH (every finding below was measured or read in this session; no external
sources were needed and none were consulted)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Milestone test contract carried forward.** Phase 114's D-01 through D-05 and D-13 through
D-22 apply unchanged and are not restated here. The load-bearing ones for this phase:

- Every runtime case uses separate lowercase `// arrange`, `// act`, and `// assert`
  phases. Lowercase `// act & assert` is limited to one `assert.throws()` or
  `assert.rejects()` expression.
- Every case constructs complete, case-local inputs and independently authored
  complete expectations. Never derive an expected value from the code under test.
- Shipped public contracts outrank stale test expectations.
- Production changes are limited to a demonstrated defect or a proven unreachable-code
  removal. A change may not add a test seam, export, pragma, or coverage exception.
- Install fail-fast external fakes in every offline case; prove zero unexpected network,
  git, credential, or subprocess calls.

**Import barrel contract.**

- **D-115-01:** Make `orchestrators/import/index.ts` reachable from production instead of
  suppressing it. Repoint `edge/handlers/plugin/import.ts` to import `importClaudeSettings`
  from `./index.ts` rather than `./execute.ts`, and prune the barrel to exactly what
  production consumes, including the two types the handler needs
  (`ClaudeImportExecutionResult`, `ImportClaudeSettingsOptions`). Delete all eight
  `fallow-ignore` WR-01 markers with nothing put in their place.
  — **Reversibility:** costly — the barrel currently re-exports seven functions and one
  type from `marketplaces.ts`, `refs.ts`, `settings.ts`, and `types.ts`; restoring a
  pruned binding later means re-adding the export and re-justifying its suppression.

  Evidence behind this: the barrel today has zero production importers. Production
  reaches `importClaudeSettings` directly from `execute.ts`, and the only file in the
  repository importing `index.ts` is `tests/orchestrators/import/execute.test.ts`. A
  probe run of `fallow dead-code --production` reports `index.ts` as an unused FILE and
  simultaneously reports all eight suppressions as STALE, because once the file is
  unreachable fallow stops evaluating its individual exports. Pruning alone does not fix
  this — a one-line barrel is still unreachable. Only a real production import clears it,
  and it clears under both `production: false` and the eventual `production: true`.

- **D-115-02:** Repoint the `import/execute.ts` owner test to import its paired source
  directly rather than through the barrel. `tests/orchestrators/import/execute.test.ts:17`
  currently imports through `index.ts`, which is the recorded `wrong-import` violation.
  An owner test imports its own source; the barrel is proved by its own owner.

**Composition depth and the coverage pragma.**

- **D-115-03:** Choose the double strategy per module by what that module's contract
  actually is. Do not force symmetry between the two composition orchestrators.
  - Where the contract is aggregating collaborator outcomes, inject the collaborators.
    `import/execute.ts` already exposes `ImportDeps` (`loadSettings`, `loadState`,
    `addMarketplace`, `installPlugin`) as explicit parameter-level dependency injection,
    which is the convention this repository endorses.
  - Where the contract is the resulting on-disk state, drive the real composition.
    `bootstrap.ts` composes real `addMarketplace` and `setMarketplaceAutoupdate`;
    `reconcile/apply.ts` composes real install, uninstall, enable, and disable. Both
    already do this against a case-owned temporary tree with only `createGitOpsFake` at
    the network boundary, and each of the seven existing suites runs in under four
    seconds, so real composition carries no meaningful cost.
  - Add no production seam to `bootstrap.ts`, `apply.ts`, `backfill.ts`, or `pending.ts`
    for test convenience.

- **D-115-04:** Delete the `c8 ignore` pragma at `import/execute.ts:214` by proving the
  production default path, not by keeping the exception. `stateLoader` currently carries
  `/* c8 ignore next -- production path; unit tests always inject deps.loadState */`.
  Add owner cases that call `importClaudeSettings` with no `deps` so each default
  resolver (`stateLoader`, `settingsLoader`, `addMarketplaceFn`, `installPluginFn`)
  executes for real. This is the only `c8 ignore` or `istanbul ignore` pragma in the
  entire `extensions/` tree, and the milestone contract forbids coverage exceptions.

**Supplemental ownership.**

- **D-115-05:** Absorb `tests/orchestrators/reconcile/notify-projection-edge.test.ts`
  into the `reconcile/notify.ts` owner and delete the file. It imports only
  `buildReconcileAppliedCascade` from a single module, so it is single-owner evidence.
  Its two cases (the `mp-remove-partial` bare failed header, and the `reasonAsContent`
  `"not added"` defensive fallback) are branches of `notify.ts` that the owner needs for
  complete direct coverage.

- **D-115-06:** Move `tests/orchestrators/reconcile/plan-convergence.test.ts` intact to
  `tests/integration/`. It composes `planReconcile`, `mergeScopeConfigs`,
  `buildConfigFromState`, and `domain/source.ts` into a cross-layer fixed-point identity
  that no single owner honestly owns. Keep its end-to-end identity; do not flatten it
  into an owner and do not add a correspondence-gate exception.

**Failure isolation.**

- **D-115-07:** Prove continue-after-failure with an exhaustive entry-kind by
  failure-mode matrix for both `import/execute.ts` and `reconcile/apply.ts`, rather than
  a representative sample. Every one of the 23 distinct public outcome kinds must be
  produced, and every cell asserts the COMPLETE aggregated result, not only its own row.
  - `reconcile/apply.ts` emits 15 outcome kinds: `invalid-block`, `mp-added`,
    `mp-add-failed`, `mp-removed`, `mp-remove-failed`, `mp-remove-partial`,
    `plugin-disabled`, `plugin-disable-failed`, `plugin-enabled`, `plugin-enable-failed`,
    `plugin-installed`, `plugin-install-failed`, `plugin-uninstalled`,
    `plugin-uninstall-failed`, `source-mismatch`.
  - `import/execute.ts` emits eight outcome types: `MarketplaceAddedOutcome`,
    `MarketplaceSkipOutcome`, `PluginInstalledOutcome`, `PluginSkipOutcome`,
    `ImportWarningOutcome`, `MarketplaceFailureOutcome`, `SourceMismatchOutcome`,
    `UnexpectedPluginFailureOutcome`.

- **D-115-08:** The matrix varies the COMPOSITION's inputs — which fault each entry hits
  and which outcome each collaborator returns — and asserts the composition's aggregated
  public reporting. It does not re-derive why a lifecycle workflow failed internally.
  Phase 114 owns those failure modes directly, and D-20 and D-22 forbid duplicating a
  single-module oracle. Each matrix cell provokes or injects one cause per outcome kind
  and then proves the composition's continuation, ordering, tally, and notification
  effect.

- **D-115-09:** Continuation must hold regardless of where the failing entry sits.
  Include a failing FIRST entry (proving the batch is not aborted) and a failing MIDDLE
  entry (proving the remainder is still processed and earlier commits stay intact) for
  each orchestrator.

### Claude's Discretion

- Case names, concern-local factories, and the exact fixture shapes.
- Whether the barrel keeps a named re-export or a combined export statement, provided
  production imports through it and no suppression remains.
- Plan waves and dependencies among the eight pairs, provided D-115-01 and D-115-02
  settle before the `import/index.ts` and `import/execute.ts` owners are finalized.
- The final integration filename for the relocated `plan-convergence` flow, provided it
  lives under `tests/integration/` and keeps its cross-module identity.

### Deferred Ideas (OUT OF SCOPE)

- Flipping `.fallowrc.json` `production` to `true` and resolving the resulting 81
  unused-export findings — its own effort, owned by the operator, out of scope here.
- `transaction/rollback.ts` is the second file reported unreachable under a production
  probe. Not a Phase 115 pair; leave it alone.
- The five remaining `unexpected-test` violations that Phase 114 left in
  `tests/orchestrators/` (`marketplace/cascade.test.ts`,
  `plugin/cross-surface-reason-parity.test.ts`) and elsewhere
  (`bridges/integration-materialization-gate.test.ts`, `helpers/source-scan.test.ts`,
  `shared/device-flow-prompt.test.ts`, `shared/index-smoke.test.ts`,
  `edge/handlers/import.test.ts`, `edge/index-handler.test.ts`) belong to Phases 116 and
  117, which close the repository-wide gates.
- How `edge-deps.ts` proves its contract as a pure wiring module was raised but not
  discussed; left to research and planning.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-08 | All eight composition orchestrator pairs complete the pair contract [VERIFIED: `.planning/REQUIREMENTS.md:125-126` — "**MOD-08**: All eight composition orchestrator pairs complete the pair contract."] | The per-pair gap table, the exhaustive-matrix enumeration, the reachability audit, and the eight per-plan work orders below give the planner a measured, cell-by-cell definition of "complete" for each of the eight pairs. |

The pair contract MOD-08 refers to is the conjunction of OWN-01..06, CASE-01..04,
TEST-01..05, COV-01..05, DES-01..03, DEL-01..04, PRES-01, and SUITE-01..06
[VERIFIED: `.planning/REQUIREMENTS.md:14-165`]. The two that bite hardest in this phase
are:

- `COV-01`: "Each source-test pair reaches 100 percent function, line, and branch
  coverage when its owner test runs alone."
  [VERIFIED: `.planning/REQUIREMENTS.md:63-64`]
- `CASE-01`: "Each runtime case has explicit arrange, act, and assert phases in that
  order." [VERIFIED: `.planning/REQUIREMENTS.md:26-27`]

</phase_requirements>

## Summary

This is a normalization phase, not a writing-from-scratch phase, and the coverage gap is
the *smaller* half of the work. Seven owner suites exist (8,309 lines, 160 cases). Three
of the eight pairs already pass direct coverage at 100 percent; four fail by a measured
83 branches, 6 functions, and 304 lines; one has no owner test at all. But **zero** of
the 160 existing cases carry the mandated lowercase `// arrange` / `// act` / `// assert`
phase markers, **zero** of the seven files use `strong-mock`, and the suites lean on 409
`assert.equal` and 187 `assert.ok` calls against 82 whole-value comparisons. The contract
normalization touches every case; the coverage gap touches roughly 60 to 90 new cases.

The second load-bearing finding is a reachability wall. Several of the uncovered branches
are **defensive arms that the real collaborators cannot produce** and that D-115-03
forbids reaching by injection. In `reconcile/apply.ts` the three `result === undefined`
guards (lines 204, 312, 369) sit behind orchestrators that never return `undefined` in
orchestrated mode; in `reconcile/notify.ts` and `import/execute.ts` five `assertNever` /
`default: throw` arms have a `never`-typed scrutinee and are unreachable through the
module's public surface. Every one of these is `[VERIFIED]` below by reading the producer.
Each needs an explicit disposition (delete as proven-unreachable, or narrow a type so the
guard becomes a compile error) before the pair can reach 100 percent, and two of the three
plausible dispositions reach into Phase-114-complete production pairs, which `DEL-03`
forbids. This is the single biggest planning risk and it belongs in a checkpoint, not in
an executor's improvisation.

The third finding is contamination in `tests/orchestrators/reconcile/apply.test.ts`: eight
cases `readFile` production **source text** — seven of them for modules other than
`apply.ts` (`plugin/install.ts`, `plugin/enable-disable.ts`, `plugin/shared.ts`,
`reconcile/notify.ts`, `shared/notify.ts`, `persistence/config-write-back.ts`, and
`index.ts`) — and `assert.match` regexes against their comments. Those cases test the wrong
modules, assert on prose rather than behavior, and are the reason 14 case titles carry
`PR #51` ticket references. They must be removed, not translated.

**Primary recommendation:** plan Phase 115 as three waves — (1) the two mechanically
independent, already-green pairs plus the barrel repoint (P115-01, P115-03, P115-04, and
the D-115-01/02 production edit); (2) the four pure or near-pure projection and scan pairs
(P115-06, P115-07, P115-08) plus P115-02; (3) the one heavyweight real-composition pair
(P115-05) last, because it consumes the outcome vocabulary that P115-07 pins and because
its unreachable-arm disposition is the phase's only genuine open question. Front-load the
reachability disposition as a `checkpoint:human-verify` before wave 3 begins.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregating collaborator outcomes into one import result | Orchestrators (composition) | — | `import/execute.ts` owns the cascade result shape; the lifecycle orchestrators own why each entry failed (D-115-08). |
| Driving the real install/uninstall/enable/disable lifecycle at load time | Orchestrators (composition) | Orchestrators (lifecycle) | `reconcile/apply.ts` has no injectable collaborator and calls the real orchestrators directly [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:54-58` — `import { addMarketplace } from "../marketplace/add.ts";` … `import { uninstallPlugin } from "../plugin/uninstall.ts";`]. |
| Projecting per-entry outcomes into a cascade message | Orchestrators (presentation) | — | `reconcile/notify.ts` is a pure function of `PerEntryOutcome[]`; no filesystem, no network. |
| Deciding pending (preview) rows | Orchestrators (presentation) | Domain | `reconcile/pending.ts` reads config + state and delegates the projection to `notify.ts`. |
| Version-gated re-materialization of partially-installed plugins | Orchestrators (composition) | Orchestrators (lifecycle) | `reconcile/backfill.ts` owns the scan and gate; reinstall owns the materialize. |
| One-keystroke onboarding | Orchestrators (composition) | Orchestrators (marketplace lifecycle) | `bootstrap.ts` composes `addMarketplace` + `setMarketplaceAutoupdate` and owns **no** notification vocabulary of its own [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts:12-20`]. |
| Building the completion-cache resolver across the edge/persistence boundary | Orchestrators (wiring glue) | Persistence, Domain | `edge-deps.ts` exists specifically so `edge/` need not import `persistence/` or `domain/` [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:3-21`]. |
| Publishing the import surface to the edge | Orchestrators (barrel) | — | After D-115-01, `import/index.ts` is the production import path for `edge/handlers/plugin/import.ts`. |

## Project Constraints (from CLAUDE.md)

These are directives the planner must honor; each is `[VERIFIED: CLAUDE.md]` by reading
the file this session.

| Directive | Consequence for this phase |
|-----------|----------------------------|
| "Before editing any file, read it first. Before modifying a function, trace its callers." | Every plan that touches production (D-115-01's barrel prune, any unreachable-arm removal) must trace callers first. |
| "NEVER commit to the main branch." Feature branches are `features/*`. | Current branch is `features/unit-test-refactor`; keep it. |
| "Run `pre-commit run --all-files` … **before** attempting `git commit`." Never `--no-verify`; never amend after a hook failure. | Per-plan commit ritual. Note the memory item: CI runs `--all-files`, so scoped `--files` runs hide pre-existing violations. |
| "NEVER rebase, never rewrite history. Update branches by merging." | No history rewriting during the phase. |
| Conventional Commits; title 5–72 chars; body lines ≤ 80; "Avoid GSD milestone/phases mentions." | Commit-message shape for the eight pair commits. |
| `npm run check` must stay green — typecheck + ESLint + `fallow` + Prettier + unit tests + integration tests (NFR-6). | The phase gate. `fallow` is a mandatory member of the chain, not an optional extra. |
| All user-visible output via `ctx.ui.notify` through `shared/notify.ts` (IL-2). | Any production edit must not add a direct notify call. |
| `.claude/rules/typescript-comments.md`: no `Phase NN` / `Plan NN` / `Wave N` / `Task N` / bare `Pitfall N` in comments or test titles. Decision and requirement IDs are encouraged. GitHub issue/PR references like `#2916` **are** allowed. | See the Open Question about `PR #51` in test titles. |
| `.claude/rules/typescript-unit-testing.md`: the full pair contract quoted throughout this document. | The normative spec for all eight pairs. |
| CodeGraph: prefer `codegraph_explore` over grep when locating code (a `.codegraph/` directory exists at repo root). | Use it for the caller traces D-05 unreachable-code removals require. |

## Measured Baseline

Everything in this section was produced by running the repository's own gates in this
session on `features/unit-test-refactor` at `3331d23d`.

### Direct coverage, one pair at a time

Command: `node scripts/test-coverage-direct.mjs <source>`.

| Pair | Source | Branches | Functions | Lines | Verdict |
|------|--------|---------:|----------:|------:|---------|
| P115-01 | `orchestrators/edge-deps.ts` | 26/26 | 8/8 | 242/242 | **PASS** |
| P115-02 | `orchestrators/import/execute.ts` | 116/137 | 31/33 | 1071/1130 | FAIL |
| P115-03 | `orchestrators/import/index.ts` | — | — | — | no owner test |
| P115-04 | `orchestrators/plugin/bootstrap.ts` | 5/5 | 1/1 | 134/134 | **PASS** |
| P115-05 | `orchestrators/reconcile/apply.ts` | 74/105 | 20/21 | 805/964 | FAIL |
| P115-06 | `orchestrators/reconcile/backfill.ts` | 54/60 | (all) | 452/461 | FAIL |
| P115-07 | `orchestrators/reconcile/notify.ts` | 89/112 | 18/21 | 881/954 | FAIL |
| P115-08 | `orchestrators/reconcile/pending.ts` | 32/34 | (all) | 264/268 | FAIL |

[VERIFIED: `node scripts/test-coverage-direct.mjs` run per pair, 2026-09-01. The tool's own
verdict lines were, verbatim: `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/edge-deps.ts (branches 26/26, functions 8/8, lines 242/242)`;
`Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/import/execute.ts: branches 116/137, functions 31/33, lines 1071/1130`;
`Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts (branches 5/5, functions 1/1, lines 134/134)`;
`Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts: branches 74/105, functions 20/21, lines 805/964`;
`Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts: branches 54/60, lines 452/461`;
`Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts: branches 89/112, functions 18/21, lines 881/954`;
`Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts: branches 32/34, lines 264/268`.]

**Aggregate coverage debt: 83 branches, 6 functions, 304 lines.**

### Suite size, case count, and runtime

| Owner test | Lines | `test()` calls | Wall time (node --test, alone) |
|------------|------:|---------------:|-------------------------------:|
| `tests/orchestrators/edge-deps.test.ts` | 837 | 15 | 2.84 s |
| `tests/orchestrators/import/execute.test.ts` | 1487 | 25 | 2.97 s |
| `tests/orchestrators/plugin/bootstrap.test.ts` | 404 | 6 | 2.90 s |
| `tests/orchestrators/reconcile/apply.test.ts` | 2540 | 33 | 3.85 s |
| `tests/orchestrators/reconcile/backfill.test.ts` | 1025 | 20 | 3.74 s |
| `tests/orchestrators/reconcile/notify.test.ts` | 1247 | 45 | 2.76 s |
| `tests/orchestrators/reconcile/pending.test.ts` | 769 | 16 | 2.85 s |
| **Total** | **8309** | **160** | — |

[VERIFIED: `wc -l` and `time node --test <file>` per file, 2026-09-01.] Most of the wall
time is Node's TS-strip startup, not the tests. CONTEXT's "under four seconds" claim holds
and real composition is genuinely cheap.

### Contract-compliance census

| Signal | edge-deps | execute | bootstrap | apply | backfill | notify | pending | Total |
|--------|----------:|--------:|----------:|------:|---------:|-------:|--------:|------:|
| `// arrange` markers | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `// act` markers | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `// assert` markers | 0 | 1 | 1 | 1 | 1 | 0 | 1 | **5** |
| `strong-mock` import | no | no | no | no | no | no | no | **0/7** |
| `describe()` blocks | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `assert.deepStrictEqual` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `assert.deepEqual` | 3 | 20 | 3 | 12 | 8 | 34 | 2 | **82** |
| `assert.equal` / `assert.strictEqual` | 40 | 66 | 21 | 95 | 45 | 114 | 28 | **409** |
| `assert.ok` | 13 | 3 | 4 | 65 | 20 | 58 | 24 | **187** |
| `as unknown as` double assertions | 0 | 2 | 3 | 0 | 9 | 0 | 20 | **34** |
| `readFile` of production **source text** | 0 | 0 | 0 | 8 | 0 | 0 | 0 | **8** |
| Case titles with ticket refs (`PR #NN`) | 0 | 0 | 0 | 14 | 0 | 0 | 0 | **14** |
| Imports from `tests/helpers/` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `only` / `skip` / `todo` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |

[VERIFIED: `grep -c` per file, 2026-09-01.]

Reference points from **completed** pairs, for calibration:

| Completed owner | Phase | Lines | `test()` | `// arrange` | `deepStrictEqual` |
|-----------------|------:|------:|---------:|-------------:|------------------:|
| `tests/orchestrators/reconcile/plan.test.ts` | 113 | 640 | 13 | 13 | 14 |
| `tests/orchestrators/import/settings.test.ts` | 113 | 596 | 16 | 16 | 17 |
| `tests/orchestrators/marketplace/add.test.ts` | 114 | 2423 | 52 | 52 | 40 |
| `tests/orchestrators/plugin/install.test.ts` | 114 | 9417 | 131 | 33 | 137 |

[VERIFIED: `grep -c`/`wc -l`, 2026-09-01.] `add.test.ts` and `plan.test.ts` are the clean
templates — one `// arrange` per case. `install.test.ts` is **not** a template: Phase 114
extended it in place (`git log -- tests/orchestrators/plugin/install.test.ts` shows five
`test(114…)` commits amending an existing file, versus `add.test.ts`'s single
`c277157c test(114-01): own marketplace add lifecycle`), so roughly 98 of its 131 cases
still lack phase markers. Do not cite it as precedent for skipping D-02.

### Correspondence gate

`node scripts/check-corresponding-tests.mjs` reports **18 violations**; the four this phase
owns are, verbatim from the run:

```text
wrong-import: tests/orchestrators/import/execute.test.ts
missing-test: tests/orchestrators/import/index.test.ts
unexpected-test: tests/orchestrators/reconcile/notify-projection-edge.test.ts
unexpected-test: tests/orchestrators/reconcile/plan-convergence.test.ts
```

[VERIFIED: `node scripts/check-corresponding-tests.mjs`, 2026-09-01.]

The gate excludes three roots from correspondence entirely:

```js
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);
```

[VERIFIED: `scripts/check-corresponding-tests.mjs:10`.] So D-115-06's relocation to
`tests/integration/` is sufficient to clear that violation — no allowlist entry needed.
`wrong-import` fires when `importedPaths(projectRoot, testPath)` does not `.includes(sourcePath)`
[VERIFIED: `scripts/check-corresponding-tests.mjs:124-126`], so adding a direct
`./execute.ts` import clears it even if a barrel import also remains — but D-115-02 asks
for the barrel import to go, and P115-03 makes the barrel its own owner's subject anyway.

### fallow

`npx fallow dead-code --fail-on-issues` and `npx fallow dupes --fail-on-issues` both exit
`0` on the current tree [VERIFIED: exit codes captured 2026-09-01]. `fallow dupes` reports
`915 lines (1.4%) duplicated across 38 files` under the `threshold: 3` setting without
failing.

## Per-Pair Gap Assessment

This is the section the phase description asked for. For each pair: what the existing suite
already proves, what the contract still demands, and the named uncovered functions and
branches.

---

### P115-01 — `orchestrators/edge-deps.ts` → `tests/orchestrators/edge-deps.test.ts`

**Coverage:** 26/26 branches, 8/8 functions, 242/242 lines. **Already 100 percent.**

**What it already proves.** 15 cases over the single runtime export `makeLocationsResolver`
[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:148` —
`export function makeLocationsResolver(cwd: string): LocationsResolverLike {`]: the two
pure path getters, `loadStateForScope` (populated projection and ENOENT-empty),
`loadManifestForMarketplace` (no state record → `ManifestSoftFailError`; installed +
available rows; unavailable plugin; manifest-read failure wrapped; unsafe-name degrade),
and the finer-status bucketizer including the `remote` git-source arm and the two
disabled-record partitions.

**What the contract still demands.** The answer to the deferred question "how does a pure
wiring module prove its contract" is: **it already does, behaviorally — and the residual
work is contract-shape, not coverage.**

1. **A derived expectation (TEST-01 violation).** The case at
   `tests/orchestrators/edge-deps.test.ts:573`, titled
   `"D-67-02 / T-67-08 parity: the bucketizer rows equal the shared classifier on the SAME fixture (no provider-local reclassification)"`,
   builds `expectedByName` by calling the production `loadMarketplaceManifest`,
   `resolveStrict`, `classifyInstalledRecord`, and `classifyManifestEntry` — the very
   functions `makeLocationsResolver` calls — and then compares the two maps. Its own inline
   comment says so: `"Independently re-derive the expected status for every manifest entry
   by calling the SAME shared classifier"`. That is exactly what
   `.claude/rules/typescript-unit-testing.md` forbids: "Build expected values
   independently. Do not call the production formatter or serializer, transform the
   adapter result, ask a harness for the answer". This case must be rewritten as a literal
   status table over the same fixture. It cannot be salvaged by renaming.
2. **160-case-wide items applied here:** AAA phase markers for all 15 cases; whole-value
   `deepStrictEqual` on `PluginIndexRow[]` instead of the current 40 `assert.equal` + 13
   `assert.ok`; a `describe("makeLocationsResolver")` is optional (single entrypoint —
   the rule says a single-entrypoint module keeps cases at top level).
3. **Offline proof (D-18).** `edge-deps.ts` reaches `probeManifestEntry` /
   `probeUpgradeCandidate`, which are documented no-network (NFR-5). The suite installs no
   fail-fast git/credential fake today. D-18 requires one in every offline case: "A passing
   operation without the fail-fast boundary is not offline proof."
4. `process.env` is mutated by a file-local `withHermeticProjectScope`; the rule wants the
   restore registered through the test context (`t.after()`), not only a `finally`.

**Risk:** LOW. No production change needed. This is the cheapest of the eight and a good
wave-1 candidate.

---

### P115-02 — `orchestrators/import/execute.ts` → `tests/orchestrators/import/execute.test.ts`

**Coverage:** 116/137 branches (**21 short**), 31/33 functions (**2 short**), 1071/1130
lines (**59 short**).

**Uncovered functions** (from the LCOV `FNDA:0` records):

| LCOV name | Line | What it is |
|-----------|-----:|------------|
| `anonymous_3` | 215 | the default `loadState` closure inside `stateLoader` — the one carrying the `c8 ignore` pragma |
| `anonymous_7` | 233 | the default `installPlugin` wrapper inside `installPluginFn` |

**Uncovered branch lines:** 212, 221, 227, 233, 315, 317, 504, 506, 557, 666, 698, 743,
895, 927, 971, 980, 1003, 1010, 1021, 1022, 1040.
[VERIFIED: LCOV `BRDA:*,*,*,0` records for `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, generated 2026-09-01 by
`node --test --experimental-test-coverage --test-reporter=lcov tests/orchestrators/import/execute.test.ts`.]

Mapped to source:

| Line(s) | Construct | Why uncovered | Disposition |
|---------|-----------|---------------|-------------|
| 212, 215 | `stateLoader` default arm + `/* c8 ignore next */` | no case omits `deps.loadState` | **D-115-04**: call with no `deps` |
| 221 | `settingsLoader`: `deps?.loadSettings ?? defaultLoadSettings` | same | D-115-04 |
| 227 | `addMarketplaceFn`: `?? defaultAddMarketplace` | same | D-115-04 |
| 233 | `installPluginFn`: `?? (async (opts) => defaultInstallPlugin(opts))` | same | D-115-04 |
| 315, 317 | `importWarningReason` arms `"marketplace-failed"` → `"not found"` and `"unmappable-marketplace-source"` → `"unsupported source"` | those two reasons are `continue`d out of the notification block at line 451 before reaching the renderer for the *notification* path, so only `unavailable`/`uninstallable` reach it | reachable: emit a warning of each reason and assert the returned `ClaudeImportExecutionResult.warnings` **and** the rendered rows |
| 504 | `blockToMarketplaceMessage` `case undefined:` — a block with plugin children and no marketplace status | reachable: a skipped-existing marketplace carrying a plugin row |
| 506–509 | `default: throw new Error(\`unexpected import marketplace status: ${block.status}\`)` | **structurally unreachable** — see the Reachability Audit |
| 557–569 | `reconcileExistingMarketplace` `case "unknown-stored"` | reachable: seed `state.marketplaces[x].source` with an unrecognized shape |
| 666–667 | `default: assertNever(outcome)` on `InstallPluginOutcome` | **structurally unreachable** — the union has exactly two arms |
| 698 | `...(opts.gitOps !== undefined && { gitOps: opts.gitOps })` | reachable: one case with `gitOps` supplied, one without |
| 743–751 | `executeScopedPlan` catch → `settings-read-error` diagnostic + scope abort | reachable: `deps.loadState` rejects |
| 895–905 | write-back post-pass catch → `settings-read-error` diagnostic | reachable: make the config path unwritable |
| 927–932 | `buildBatchedPatchForScope` defensive `rawSource === undefined` `continue` | needs an `addedMarketplaces` entry whose name is absent from `marketplacesToEnsure` — the `CR-01` recorded-name-differs-from-declared-key case |
| 971–973 | same defensive `continue` in the repair-patch builder | same, for `skippedExistingMarketplaces` |
| 980–982 | repair builder's `skipped.scope !== scopePlan.scope` `continue` | reachable: two scopes with different skips |
| 1003, 1010 | `mergeEnsureAndRepairs` loops over `repair.marketplaces` / `repair.plugins` | reachable: a repair patch with entries |
| 1021, 1022 | `isEmptyPatch`'s two `Object.keys(... ?? {}).length === 0` operands | reachable: patches empty in one dimension only |
| 1040–1050 | `dispatchFailedOutcome`'s `error instanceof ConcurrentInstallError` arm | the existing "concurrent install race" case injects a `PluginShapeError`, not a `ConcurrentInstallError` |

**What it already proves.** 25 cases covering the happy cascade, blocked-marketplace
continuation, `declaresAgents`/`declaresMcp` propagation (all four combinations), the
reload trailer, plan `skippedPlugins` → `unmappable-marketplace-source` warnings,
`postCommitWarnings` diagnostics, cross-scope independence, and five `WB-03` batched
write-back cases.

**What the contract still demands.** The 21-branch closure above, plus the D-115-07
exhaustive matrix (sized below), plus D-115-02's import repoint, plus AAA/assertion
normalization of all 25 cases, plus replacing the two `as unknown as` doubles.

**Risk:** MEDIUM. `ImportDeps` makes the matrix cheap; the only production question is the
two unreachable arms.

---

### P115-03 — `orchestrators/import/index.ts` → `tests/orchestrators/import/index.test.ts`

**Coverage:** no owner test exists. This is the phase's only new file.

**Current barrel** [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/import/index.ts:1-18`,
read in full this session]:

```ts
export { importClaudeSettings } from "./execute.ts";
// fallow-ignore-next-line unused-export -- WR-01 compatibility: …
export { buildClaudeImportPlan } from "./marketplaces.ts";
// … (six more suppressed runtime re-exports) …
// fallow-ignore-next-line unused-type -- WR-01 compatibility: …
export type { EnabledPluginRef } from "./types.ts";
```

Eight `fallow-ignore` markers, seven runtime re-exports, one type re-export.

**Sole importer today**, confirmed by repository-wide grep:
`tests/orchestrators/import/execute.test.ts:17`. [VERIFIED: `grep -rn` over `extensions/`
and `tests/`, 2026-09-01 — one hit.]

**The production edit D-115-01 asks for.** `edge/handlers/plugin/import.ts:1-5` currently
reads, verbatim:

```ts
import {
  importClaudeSettings,
  type ClaudeImportExecutionResult,
  type ImportClaudeSettingsOptions,
} from "../../../orchestrators/import/execute.ts";
```

[VERIFIED: `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:1-5`.] Change
`./execute.ts` to `./index.ts` and prune the barrel to those three bindings. That is the
whole production delta.

**How the owner test proves a barrel.** The rule is explicit: "An existing `index.ts` gets
a test module that asserts each runtime re-export is the same binding as its source with
`assert.strictEqual()`." [VERIFIED: `.claude/rules/typescript-unit-testing.md`, "Barrels"
pattern.] The canonical in-repo template is `tests/bridges/skills/index.test.ts`, which
imports each symbol twice — once through the barrel and once as `defining<Name>` from its
defining module — and asserts identity inside one `describe()` per symbol.

**Coverage feasibility.** A re-export-only barrel *does* produce an LCOV record and *can*
pass the gate: `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/skills/index.ts`
returns, verbatim,
`Direct coverage passed: extensions/pi-claude-marketplace/bridges/skills/index.ts (branches 1/1, functions 0/0, lines 22/22)`.
[VERIFIED: run 2026-09-01.] So a one-runtime-export barrel is a normal pair, not a
type-only pair. The two `export type` re-exports get `satisfies` evidence at module scope,
per the type-only pattern.

**Risk:** LOW-MEDIUM. The one thing to verify at plan time (it was not verified here,
because it needs an actual edit): that `npx fallow dead-code --fail-on-issues` still exits
`0` after the prune under the current `production: false`, given the seven pruned symbols
retain their owner tests as consumers.

---

### P115-04 — `orchestrators/plugin/bootstrap.ts` → `tests/orchestrators/plugin/bootstrap.test.ts`

**Coverage:** 5/5 branches, 1/1 functions, 134/134 lines. **Already 100 percent.**

**What it already proves.** Six cases: clean state (two notifications, exact bytes
`"● claude-plugins-official [user] (added)"` then `"● claude-plugins-official [user] <autoupdate>"`);
already-bootstrapped (one notification, `{already autoupdate}`, `assert.deepEqual(after, before)`
on state); half-configured (autoupdate flip); user-scope-only (project state file never
created); non-duplicate clone error propagates and the autoupdate step is not reached;
`WB-04` config write-back.

**Success criterion 4 — "Bootstrap … idempotent and stable across repeated calls".** This is
the one behavioral gap. All three idempotence cases **seed the post-state by hand and call
`bootstrapClaudePlugin` once**. None calls it twice in a single case. A genuine repeated-call
proof, hermetically, is straightforward and cheap:

- one `mkdtemp` tree per case + `withHermeticHome`;
- `createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [...], cloneFixture: { boundary: "local", sourceDir: fixtureClaudePluginsOfficial() } })`
  — the file-local `makeMockGitOps` wrapper already builds exactly this
  [VERIFIED: `tests/orchestrators/plugin/bootstrap.test.ts:59-79`];
- call `bootstrapClaudePlugin` **twice** against the same `cwd`;
- assert the complete notification log across both calls (2 rows then 1 row);
- assert the state bytes after call 2 `deepStrictEqual` the bytes after call 1;
- assert `gitState.cloneCalls.length === 2` and name why — the GitHub-source
  duplicate-name check happens *after* the clone, so the idempotent re-run does clone once
  more. This is documented in `bootstrap.ts:88-99` and is not a defect.

**Other contract items.** AAA markers on 6 cases; three `as unknown as` doubles;
`assert.ok("claude-plugins-official" in userState.marketplaces)` is an existence
assertion where the whole record is the promise; and the file header carries a
work-session note — `"The plan's pre-execution claim that clone is never invoked on the
idempotent path was inconsistent with the existing add design; this test follows the actual
behavior rather than the pre-execution claim."` — which `SUITE-03` forbids ("Source and
test files contain no migration notes, relocation history, or work-session comments").

**Risk:** LOW. No production change. Wave-1 candidate.

---

### P115-05 — `orchestrators/reconcile/apply.ts` → `tests/orchestrators/reconcile/apply.test.ts`

**Coverage:** 74/105 branches (**31 short**), 20/21 functions (**1 short**), 805/964 lines
(**159 short**). The largest gap in the phase.

**Uncovered function:** `buildFailed` at line 762 — the disable arm's failure builder:

```ts
buildFailed: (info) => ({ kind: "plugin-disable-failed", ...info }),
```

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:762`.]

**Uncovered branch lines:** 106, 158, 204, 224, 265, 312, 342, 369, 388, 400, 409, 487,
488, 502, 503, 510, 516, 517, 530, 578, 579, 580, 581, 582, 629, 644, 672, 680, 697, 898,
962. [VERIFIED: LCOV `BRDA` zero-hit records, 2026-09-01.]

Mapped, with the reachability verdict that matters most:

| Line(s) | Construct | Reachable through the real collaborator? |
|---------|-----------|------------------------------------------|
| 106 | `if (!stateExists && !configExists)` pristine-scope early return | YES — a scope with neither file |
| 158 | `if (outcome.local.status === "invalid")` | YES — malformed `claude-plugins.local.json` |
| **204** | `if (result === undefined)` after `removeMarketplace` | **NO** — see Reachability Audit |
| 224 | `catch` around `removeMarketplace` | UNCERTAIN — see Reachability Audit |
| 265–291 | `foldRemoveOutcome`'s `result.status === "partial"` arm, which is the sole producer of `mp-remove-partial` and of `plugin-uninstall-failed`-under-a-remove | YES — a cascade that unstages some and fails others |
| **312** | `if (result === undefined)` after `addMarketplace` | **NO** |
| 342 | `catch` around `addMarketplace` | LIKELY YES via `parsePluginSource` — see Reachability Audit |
| **369** | `if (result === undefined)` after `uninstallPlugin` | **NO** |
| 388 | `result.status === "converged"` → render no row | YES — record already gone |
| 400 | uninstall `else` → `plugin-uninstall-failed` | YES |
| 409 | `catch` around `uninstallPlugin` | UNCERTAIN |
| 487–490 | install-disabled arm's `postCommitWarnings` conditional spread | YES |
| 502–505 | installed arm's `postCommitWarnings` spread | YES |
| 510 | installed arm's `orphanRewake === true` spread | YES |
| 516–519 | installed arm's `degradedKinds` spread | YES |
| 530 | `catch` around `installPlugin` | UNCERTAIN |
| 578–582 | all five spreads in `degradationFromEnable` (`unsupported`, `orphanRewake`, `degradedKinds`, `stagedAgents`, `stagedMcpServers`) | YES — an enable that re-materializes a degraded plugin |
| 629 | `...(Object.keys(degradation).length > 0 && { degradation })` | YES, together with 578–582 |
| 644 | `catch` in `applyPluginToggles` | UNCERTAIN |
| 672, 680, 697 | `source-mismatch` causes `"source-mismatch"`, `"unknown-stored"`, `"malformed-plugin-key"` | YES — planner-driven; only `"dangling-reference"` is covered today |
| 898 | `rebuildScopeRoutingTable`'s `if (!(await pathExists(loc.stateJsonPath)))` pristine gate | YES |
| 962 | plural post-install-warning header (`${n} post-install warnings surfaced from reconcile installs.`) | YES — two warnings in one reconcile |

**Outcome-kind production status.** Of the 15 kinds D-115-07 enumerates, the current suite
produces 12. **Never produced today:** `mp-remove-partial`, `plugin-uninstall-failed`, and
`plugin-disable-failed`. Additionally `source-mismatch` is produced for only one of its
four causes. [VERIFIED: derived from the zero-hit branch set above against the producer
sites at `apply.ts:212-219, 260-293, 373-381, 393-407, 410-416, 466-491, 493-520, 522-528, 531-537, 623-640, 645-652, 673-704, 750, 762, 810-816`.]

**Contamination that must be removed, not translated.** Eight cases read production
**source text** and `assert.match` against it:

```text
apply.test.ts:1106  "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
apply.test.ts:1127  "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
apply.test.ts:1131  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
apply.test.ts:1135  "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
apply.test.ts:1276  "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
apply.test.ts:1300  "extensions/pi-claude-marketplace/shared/notify.ts"
apply.test.ts:1323  "extensions/pi-claude-marketplace/persistence/config-write-back.ts"
apply.test.ts:1802  "extensions/pi-claude-marketplace/index.ts"
```

[VERIFIED: `grep -n '"extensions/pi-claude-marketplace' tests/orchestrators/reconcile/apply.test.ts`.]
The worst is the `S10` case, which asserts that a *comment block* exists above a cast:

```ts
assert.match(
  src,
  /S10[\s\S]{0,600}saveConfig[\s\S]{0,200}as MarketplaceConfigEntry/,
  "S10: the cast comment must reference saveConfig's validator backstop",
);
```

These violate `OWN-02` (an owner test imports and exercises its own paired module),
`CASE-02` (title states public behavior), and `TEST-01` (assert the public result). Seven of
the eight target modules that are **not** `apply.ts` and whose owners are already complete.
Delete all eight; if any expresses a durable architectural rule, its home is
`tests/architecture/`, and `.planning/codebase/CONVENTIONS.md` is explicit that such a gate
"wants a test that plants the violation, not one that reads the config."

**Risk:** HIGH. Largest coverage gap, the only pair with a genuine reachability wall, and
the only pair with cross-module contamination.

---

### P115-06 — `orchestrators/reconcile/backfill.ts` → `tests/orchestrators/reconcile/backfill.test.ts`

**Coverage:** 54/60 branches (**6 short**), all functions covered, 452/461 lines (**9 short**).

**Uncovered branch lines and what each needs:**

| Line | Construct | Case needed |
|-----:|-----------|-------------|
| 71 | `if (state === undefined)` in `applyBackfillForScope` (`// Pristine scope … no state.json to stamp (WR-05)`) | a scope whose read pass yields no state |
| 168 | the body of `for (const mp of Object.values(state.marketplaces))` in `hasForceInstalledPlugin` | today this helper only runs against a state with zero marketplaces; give it a populated state on the state.json-absent path |
| 387 | `outcome.reasons?.[0] ?? classifyOrchestratorThrow(new Error(outcome.notes.join("; ")))` — the `??` right operand | a failed re-materialize whose outcome carries **no** `reasons` |
| 413 | `...(resolved.orphanRewake === true && { orphanRewake: true })` | a promotion whose re-resolve reports an orphan rewake |
| 414–415 | `...(outcome.degradedKinds !== undefined && outcome.degradedKinds.length > 0 && { degradedKinds })` | a promotion whose reinstall degraded a component |

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:71, 168, 387, 413-415` read this session; LCOV zero-hit records `BRDA:71,2,0,0  BRDA:168,18,0,0  BRDA:387,43,0,0  BRDA:413,47,0,0  BRDA:414,48,0,0  BRDA:415,49,0,0`.]

**What it already proves.** 20 strong cases: the version-stamp gate (absent stamp opens,
unchanged stamp skips and leaves state.json untouched), full and partial promotion, the
strict-superset rule, the `NFR-5` no-network scan, `WR-01`/`WR-02`/`WR-03` isolation, the
`ENBL-08` disabled-partial skip plus its enabled control, `SF-01`/`SF-02` failure arms, and
per-plugin isolation.

**Nine `as unknown as` doubles** and no AAA markers are the normalization load.

**Risk:** LOW. Six branches, all reachable, no production change.

---

### P115-07 — `orchestrators/reconcile/notify.ts` → `tests/orchestrators/reconcile/notify.test.ts`

**Coverage:** 89/112 branches (**23 short**), 18/21 functions (**3 short**), 881/954 lines
(**73 short**).

**Uncovered functions:**

| LCOV name | Line | What it is |
|-----------|-----:|------------|
| `anonymous_10` | 450 | `(m) => m.plugins.length === 0` inside `isReconcilePlanListEmpty`'s `marketplacesToRemove.every(...)` — never runs because no case supplies a non-empty `marketplacesToRemove` |
| `reasonAsContent` | 906 | the `"not added"` → `["not found"]` defensive fold; **currently proved only by the supplemental** `notify-projection-edge.test.ts` |
| `anonymous_20` | 950 | `(a, b) => compareByNameThenScope(a, b)` — the **applied** cascade's block sort; never runs because no applied-cascade case produces two blocks |

**Uncovered branch lines:** 144, 147, 162, 302, 660, 663, 666, 667, 671, 726, 768, 805,
822, 823, 824, 825, 835, 848, 849, 850, 851, 852, 868.

The shape of the gap is clean and diagnostic: **the pending (preview) projection is
thoroughly proved; the applied-cascade projection is barely proved.** The uncovered set is
almost exactly the marketplace-subject half of `applyMarketplaceOutcomeToBlock` and the
plugin-failure half of `applyPluginOutcomeToBlock`:

| Line(s) | Arm |
|---------|-----|
| 144, 147 | `blockToMarketplaceMessage` `case "added"` and `case "removed"` |
| 162–163 | its `default: assertNever(block.status)` — **structurally unreachable** |
| 302–307 | `resolvePendingForceInstalls`'s `catch` around `resolveStrict` |
| 660, 663 | `applyMarketplaceOutcomeToBlock` `case "mp-added"` / `"mp-removed"` |
| 666, 667 | `case "mp-add-failed"` / `"mp-remove-failed"` (the two arms that call `reasonAsContent`) |
| 671–677 | `case "mp-remove-partial"` — the bare `(failed)` header with no `reasons` |
| 726–730 | its `default: assertNever(outcome)` — **structurally unreachable** |
| 768–777 | `case "plugin-uninstalled"` |
| 805–821 | `case "plugin-disabled"` |
| 822–834 | `case "plugin-install-failed" / "plugin-uninstall-failed" / "plugin-enable-failed" / "plugin-disable-failed"` |
| 835–839 | its `default: assertNever(outcome)` — **structurally unreachable** |
| 848–852 | `applyOutcomeToBlock`'s five marketplace-subject cases |
| 868–869 | its `default: assertNever(outcome)` — reachable only through a cast |

**This is the cheapest large gap in the phase.** `buildReconcileAppliedCascade(outcomes)` is
a pure function of a `PerEntryOutcome[]` literal — no filesystem, no orchestrators, no
faking. Ten more outcome kinds routed through it, plus one two-block cascade to exercise
the sort comparator, plus a `marketplacesToRemove` plan for `isReconcilePlanListEmpty`,
plus a `resolveStrict`-throwing candidate, closes almost everything.

**D-115-05 lands here.** `notify-projection-edge.test.ts` (67 lines, 2 cases) is the only
current prover of `reasonAsContent` and of the `mp-remove-partial` arm. Its two cases
transplant verbatim.

**Coupling with P115-07 and P115-05:** the entanglement is one-directional and mild.
`apply.ts` imports `buildReconcileAppliedCascade` from `notify.ts`
[VERIFIED: `apply.ts:67`], so the outcome vocabulary P115-05 must produce is exactly the
vocabulary P115-07 must project. **Sequence P115-07 before P115-05** so the projection
contract is pinned first; then P115-05's cases can assert against a settled row shape.
The `notify-projection-edge` absorption does **not** have to land with P115-05 — it is
purely a `notify.ts` concern — but it must land with P115-07 or the correspondence gate
still shows `unexpected-test`.

**Risk:** MEDIUM. Large but mechanical, except the three unreachable defaults.

---

### P115-08 — `orchestrators/reconcile/pending.ts` → `tests/orchestrators/reconcile/pending.test.ts`

**Coverage:** 32/34 branches (**2 short**), all functions covered, 264/268 lines (**4 short**).
The smallest gap in the phase.

**Uncovered branch lines:**

| Line | Construct | Case needed |
|-----:|-----------|-------------|
| 102 | the fall-through `return narrowProbeError(err)` in `narrowStateLoadFailReason` | today only the `err.cause instanceof SyntaxError` arm runs; add a state-load failure whose cause is **not** a `SyntaxError` (e.g. `EACCES`, or a held lock) |
| 160 | `if (outcome.local.status === "invalid")` | a malformed `claude-plugins.local.json`; only the base file is proved today |

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:99-105, 156-166`;
LCOV zero-hit records `BRDA:102,3,0,0  BRDA:160,14,0,0`.]

**What it already proves.** 16 cases: empty steady state, two-invocation byte-identical
idempotency, no-mutation mtime/byte pins, `CFG-03` invalid-manifest abort with basename
(not absolute path), `WR-04` corrupt-state containment, `WR-05` ordering, scope fan-out
project-first, three `MIG-01` pre-migration-window cases, and five `FSTAT-06` force-preview
partitions. This is the best-shaped of the seven suites behaviorally.

**Success criterion 4 — "pending-state behavior remains idempotent and stable across
repeated calls"** is already satisfied by
`"DIFF-01 SC #2 / idempotency: two invocations against unchanged state -> byte-identical notify args"`.

**Normalization load is the heaviest here relative to size: 20 `as unknown as` doubles** in
769 lines, including the module-scope `const STUB_PI = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;`
at line 41 (a module-level shared double, which `CASE-03` disallows for anything but a
stateless stub — this one is arguably stateless, but the `as unknown as` is not).

**Two suppressed migration warnings leak to stderr** during the run:
`Legacy marketplace migration could not be persisted to /tmp/pending-cwd-…/state.json; …`.
That is the sanctioned `console.warn` (IL-3) firing from production during two `MIG-01`
cases. Not a defect, but the planner should decide whether the owner asserts it or silences
it, because a test suite that prints uncontrolled warnings is noise in `npm run check`.

**Risk:** LOW.

---

## Reachability Audit

This is the finding that most changes the shape of the plan. Several uncovered branches
cannot be reached without either a production change or a forbidden cast.

### Class A — `result === undefined` guards behind orchestrated collaborators

`apply.ts` lines 204, 312, and 369 each read:

```ts
if (result === undefined) {
  // S6 / PR #51: a silent continue would drop the row from the cascade
  // and hide a producer-contract violation
  // (orchestrated mode is supposed to ALWAYS return an outcome).
  outcomes.push({ kind: "mp-remove-failed", …, reason: classifyOrchestratorThrow(
    new Error("removeMarketplace returned no outcome in orchestrated mode")) });
  continue;
}
```

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:204-221`; the
add and uninstall variants at 312-325 and 369-383 are structurally identical.]

The three collaborators are declared `Promise<X | undefined>`:

```ts
export async function addMarketplace(opts: AddMarketplaceOptions): Promise<AddMarketplaceOutcome | undefined>
export async function removeMarketplace(opts: RemoveMarketplaceOptions): Promise<RemoveMarketplaceOutcome | undefined>
export async function uninstallPlugin(opts: UninstallPluginOptions): Promise<UninstallPluginOutcome | undefined>
```

[VERIFIED: `orchestrators/marketplace/add.ts:510-512`, `orchestrators/marketplace/remove.ts:632-634`,
`orchestrators/plugin/uninstall.ts:484-486`.]

But `undefined` is the **standalone**-mode return, not the orchestrated one. `add.ts`'s own
doc comment says so verbatim:

> `RECON-03: returns \`AddMarketplaceOutcome\` in orchestrated mode and \`undefined\` in standalone mode (after firing the standalone notify()). Callers in orchestrated mode know the outcome is defined; standalone callers ignore the return.`

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:505-508`.] And
the body confirms it: the only `return undefined` on the success path is guarded by
`if (orchestrated) { return { status: "added", name: recordedName }; }` at line 583-585,
and the failure path's `handleAddFailure` returns a typed outcome whenever `orchestrated`
is true (lines 466-473 and 481-483).

**Conclusion: apply.ts lines 204, 312, and 369 are unreachable through the real
collaborators.** D-115-03 forbids adding an injection seam to `apply.ts`. So the pair cannot
reach 100 percent branch coverage while those guards stand.

**In-repo precedent for the remedy.** This exact situation was already resolved once, for
the fourth loop:

```ts
export function setPluginEnabled(
  opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
): Promise<EnableDisablePluginOutcome>;
export function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined>;
```

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:570-575`.]
Its doc comment states the intent verbatim:

> `The reconcile cascade (\`applyPluginToggles\`) used to carry an \`if (result === undefined) continue\` guard that silently dropped the row -- the overload makes that branch a compile error so the cascade always materialises a row`

[VERIFIED: `enable-disable.ts:560-568`.] `installPlugin` needs nothing — it already returns
`Promise<InstallPluginOutcome>` with no `| undefined`
[VERIFIED: `orchestrators/plugin/install.ts:1923`], which is why `apply.ts`'s install loop
has no such guard.

**The tension the planner must resolve.** Extending that overload pair to `addMarketplace`,
`removeMarketplace`, and `uninstallPlugin` and deleting the three guards is a type-only,
runtime-neutral, narrowing change with exact precedent — but it edits three **other**
production modules whose pairs completed in Phase 114. `DEL-03` says "Supporting edits stay
within the owning concern and do not change a second production pair."
[VERIFIED: `.planning/REQUIREMENTS.md:97-98`.] Three candidate dispositions:

1. **Extend the overload to the three collaborators and delete the guards.** Cleanest
   result, exact precedent, type-only. Costs a `DEL-03` exception and re-running direct
   coverage for `add.ts`, `remove.ts`, `uninstall.ts` (all currently passing).
2. **Delete the three guards on the strength of the doc-comment contract alone**, without
   the overload. Cheaper, stays inside `apply.ts` (the owning pair). But it removes a
   fail-loud defence with nothing compile-time replacing it, which is precisely what the
   `S6` comment was added to prevent, and TypeScript would then flag the now-unreachable
   `undefined` narrowing.
3. **Leave them and accept the failure.** Not an option — `COV-01` is the phase gate.

**Recommendation: option 1, gated behind a `checkpoint:human-verify`.** It is the only
disposition that preserves the fail-loud intent while satisfying `COV-01`, and it is the
same edit the repository already made for the fourth loop. Present the `DEL-03` tension to
the operator explicitly rather than letting an executor decide.

### Class B — `never`-typed `default:` arms

Five defensive arms have a scrutinee TypeScript narrows to `never`, so no legal value
reaches them:

| Location | Arm | Why unreachable |
|----------|-----|-----------------|
| `reconcile/notify.ts:162-163` | `default: assertNever(block.status)` | `MarketplaceBlock.status?: ReconcileBlockStatus` = `"added" \| "removed" \| "failed"`; all three plus `undefined` are explicit cases [VERIFIED: `notify.ts:87, 93, 143-164`] |
| `reconcile/notify.ts:726-730` | `default: assertNever(outcome)` in `applyMarketplaceOutcomeToBlock` | its parameter is `Extract<PerEntryOutcome, { kind: … 7 kinds }>` and the switch lists exactly those seven; `applyOutcomeToBlock` gates entry on the identical seven [VERIFIED: `notify.ts:645-657, 659-731, 847-856`] |
| `reconcile/notify.ts:835-839` | `default: assertNever(outcome)` in `applyPluginOutcomeToBlock` | same construction for the nine plugin kinds [VERIFIED: `notify.ts:857-867`] |
| `import/execute.ts:506-509` | `default: throw new Error(\`unexpected import marketplace status: ${block.status}\`)` | `block.status?: MarketplaceStatus` is **wide**, but the only assignments in the module are `"added"`, `"updated"`, `"failed"` at lines 361, 366, 371, 382 [VERIFIED: `grep -n "block.status\|\.status = " import/execute.ts` → 361, 366, 371, 382, 496, 509] |
| `import/execute.ts:666-667` | `default: assertNever(outcome)` on `InstallPluginOutcome` | the union has exactly two arms, `"installed"` and `"failed"`, both explicit cases [VERIFIED: `orchestrators/types.ts:429-469`] |

`notify.ts:868-869` (`applyOutcomeToBlock`'s own default) is the one member of this family
that a test *could* reach, by casting a bogus `kind` into `buildReconcileAppliedCascade`.
But the rules forbid it: "Do not use `any`, a double assertion, or a broad `Partial<T>`
cast to hide an invalid double." The two repository precedents for exercising `assertNever`
(`tests/bridges/hooks/exec-result.test.ts:41-58` and `tests/shared/errors.test.ts:181-190`)
both call the **exported** `assertNever` directly from **its own owner test** with
`as never` — they do not smuggle an impossible value into a third module.

**In-repo precedent for the remedy, twice over.** `reconcile/notify.ts:138-142` documents
the pattern already applied to this very file:

> `S8 (PR #51): the defensive runtime throw for \`"updated"\` / \`"autoupdate enabled"\` / \`"autoupdate disabled"\` / \`"skipped"\` has been deleted; \`MarketplaceBlock.status\` is now narrowed to \`ReconcileBlockStatus\` so any attempt to assign one of those tokens here is a compile error caught at edit time instead of a runtime signal.`

And Phase 113's own accumulated decision, verbatim from `.planning/STATE.md`:

> `[Phase 113]: Removed one unreachable closed-union presenter default instead of fabricating an impossible test value.`

**Recommendation.** Apply the `S8` recipe to each Class-B arm, inside its own owning pair:

- `import/execute.ts`: narrow the file-local `MarketplaceBlock.status` from
  `MarketplaceStatus` to `Extract<MarketplaceStatus, "added" | "updated" | "failed">` and
  delete the `default: throw`. This is one file, one pair, no seam, no export change —
  `MarketplaceBlock` is declared **privately** at `execute.ts:281-287`, so nothing outside
  the module sees it.
- `import/execute.ts:666-667`: delete the `default: assertNever(outcome)`; the two-arm
  switch is already exhaustive.
- `reconcile/notify.ts:162-163, 726-730, 835-839, 868-869`: delete all four defaults.

Each is a `D-05` / `D-UTR-12` unreachable-code removal within the owning pair, adds no
seam, export, pragma, or coverage exception, and preserves every public outcome. Each still
requires a CodeGraph caller trace as evidence in the plan.

### Class C — `catch` arms around orchestrated collaborators

`apply.ts:224, 342, 409, 530, 644` are `catch` blocks around collaborators that convert
their own failures into typed outcomes. Whether each is reachable depends on whether the
collaborator can throw *before* its internal try. Two concrete routes exist for
`addMarketplace`:

```ts
const locations = locationsFor(opts.scope, opts.cwd);   // add.ts:515 — can throw PathContainmentError
const source = parsePluginSource(opts.rawSource);       // add.ts:516 — can throw on a malformed source
…
let recordedName: string;
try { recordedName = await runAddInGuard({ … }); }      // add.ts:528-537 — the guarded region starts HERE
```

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:513-537`.] Both
statements run **outside** the try, so a config declaring a marketplace whose `source`
string does not parse gives a real, planner-driven route into `apply.ts:342`.

**This was not exhaustively verified for the other four catch arms.** [ASSUMED] that
analogous pre-try throw routes exist in `removeMarketplace`, `uninstallPlugin`,
`installPlugin`, and `setPluginEnabled`. The planner should make "identify one real,
planner-reachable throw route per catch arm, or classify the arm as unreachable and dispose
of it under `D-05`" an explicit task in the P115-05 plan rather than an assumption.

## The Exhaustive Matrix — Honest Size

D-115-07 asks for an exhaustive entry-kind by failure-mode matrix. Here is the real
enumeration, so the planner sizes it rather than guessing.

### `reconcile/apply.ts`

Entry kinds are the `ReconcilePlan` buckets plus the read-pass and post-scope stages
[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:211-220` —
`scope`, `marketplacesToAdd`, `marketplacesToRemove`, `pluginsToInstall`,
`pluginsToUninstall`, `pluginsToEnable`, `pluginsToDisable`, `sourceMismatches`], driven in
the documented order at `apply.ts:737-764`: uninstall → remove → add → install → enable →
disable → source-mismatch.

| # | Entry kind | Distinct outcome arms | Cells |
|--:|-----------|----------------------|------:|
| 1 | `pluginsToUninstall` | uninstalled (with version), uninstalled (no version), converged→no row, failed status, throw, (`undefined` — unreachable) | 5 |
| 2 | `marketplacesToRemove` | removed + unstaged children, partial (unstaged + failed children + bare header), failed status, throw, (`undefined` — unreachable) | 4 |
| 3 | `marketplacesToAdd` | added, non-added status, throw, (`undefined` — unreachable) | 3 |
| 4 | `pluginsToInstall` | installed; installed + `landedDisabled`; each of `postCommitWarnings` × 2 arms, `orphanRewake`, `degradedKinds`; failed status; throw; `configSource: "local"` vs base | 9 |
| 5 | `pluginsToEnable` | enabled clean; enabled + each of 5 degradation signals; failed; skipped→no row; throw | 9 |
| 6 | `pluginsToDisable` | disabled; failed; skipped→no row; throw | 4 |
| 7 | `sourceMismatches` | 4 causes: `source-mismatch`, `unknown-stored`, `dangling-reference`, `malformed-plugin-key` | 4 |
| 8 | read pass | pristine (both files absent); base config invalid; local config invalid; both invalid; read-pass throw (unparseable state); read-pass throw (lock held); read-pass throw = `MigrateConfigSaveError` | 7 |
| 9 | post-scope | backfill isolation throw; routing-rebuild throw; routing-rebuild pristine gate; 0 / 1 / N post-install warnings | 6 |
| 10 | fan-out & silence | explicit `--scope`; both scopes project-first; zero outcomes → silent | 3 |
| 11 | D-115-09 continuation | failing FIRST and failing MIDDLE for each of buckets 1–6 | 12 |

**Honest total: 66 cells, of which 3 are the unreachable `undefined` guards.** Against 33
existing cases, roughly 40 to 45 net-new cases, plus rewriting the 33 (minus the 8 deleted
source-text pins, so 25 rewrites). Extrapolating from `add.test.ts` (2423 lines / 52 cases
≈ 47 lines per case), expect `apply.test.ts` to land near **3,000–3,500 lines**. That is
large but bounded, and at ~3.9 s the suite has ample headroom.

The 12 D-115-09 continuation cells can be **folded into** cells 1–6 rather than added on
top, if each failure cell is authored as a three-entry batch with the fault in position 1
or 2 and the complete aggregated result asserted. Doing so cuts the honest total to about
**54 cells**. D-115-07 requires each cell to assert "the COMPLETE aggregated result, not
only its own row", which makes folding natural rather than a shortcut.

### `import/execute.ts`

| # | Entry kind | Distinct outcome arms | Cells |
|--:|-----------|----------------------|------:|
| 1 | `marketplacesToEnsure`, not yet recorded | added; typed non-added outcome (`cause` propagated); `undefined` outcome → `"addMarketplace returned no outcome in orchestrated mode"`; throw | 4 |
| 2 | `marketplacesToEnsure`, already recorded | `samePlannedSource` → `"same"` (skip), `"different"` (source-mismatch per dependent plugin), `"unknown-stored"` (block + diagnostic) | 3 |
| 3 | `skippedPlugins` from the plan | `unmappable-marketplace-source` warning | 1 |
| 4 | `pluginsToInstall` under a blocked marketplace | silent skip, no outcome | 1 |
| 5 | `pluginsToInstall` already recorded | `plugin-skip` / `already-installed` | 1 |
| 6 | `pluginsToInstall`, real install | installed; installed + `postCommitWarnings`; `PluginShapeError{already-installed}`; `{not-in-manifest}`; `{not-installable}`; `{no-longer-installable}`; `ConcurrentInstallError`; other typed `Error`; `installPlugin` throws | 9 |
| 7 | scope-level | `loadState` rejects → `settings-read-error` diagnostic + scope abort; settings diagnostics passthrough; two scopes independent | 3 |
| 8 | config write-back post-pass | batched happy patch; empty → skip; mixed (only successes land); per-scope invalid config aborts that scope only; write throws → diagnostic; the two defensive `rawSource === undefined` continues; `mergeEnsureAndRepairs` (current-has-key / patch-present / neither); `isEmptyPatch` both operands | 10 |
| 9 | notification projection | block status `added` / `updated` / `failed` / `undefined`; the four `ImportWarningOutcome` reasons folding to three `ContentReason`s; the two suppressed reasons; reload trailer; plural tally | 9 |
| 10 | D-115-04 default resolvers | one no-`deps` case exercising all four defaults, plus per-resolver isolation if the planner prefers | 1–4 |
| 11 | D-115-09 continuation | failing FIRST and failing MIDDLE, for marketplaces and for plugins | 4 |

**Honest total: 46–49 cells.** Against 25 existing cases, roughly 22 to 25 net-new plus 25
rewrites. Expect `execute.test.ts` near **2,000–2,400 lines**.

`ImportDeps` makes almost all of this cheap: no filesystem is needed except for the
write-back post-pass and the D-115-04 no-`deps` cases.

### Combined phase estimate

| | Existing | Net-new | Rewritten | Projected final |
|-|--------:|--------:|----------:|----------------:|
| Cases | 160 | ~85–100 | ~152 | **~245–260** |
| Lines | 8,309 | — | — | **~12,000–13,500** |

For calibration, Phase 114 delivered 14 pairs; `install.test.ts` alone is 9,417 lines. A
~13,000-line total across eight pairs is in family with that phase's output.

## Outcome-Kind Reachability Tables

### The 15 `reconcile/apply.ts` outcome kinds

| # | Kind | Producer site | Reachable via | Produced today? |
|--:|------|---------------|---------------|:---------------:|
| 1 | `invalid-block` | `apply.ts:148-166` (config), `810-816` (read-pass throw), plus `backfill.ts` / routing-rebuild isolation | malformed `claude-plugins.json` or `.local.json`; unparseable `state.json`; pre-held `.state-lock`; `MigrateConfigSaveError` | yes (base + read-pass throw only) |
| 2 | `mp-added` | `apply.ts:333` | config declares a marketplace absent from state; `addMarketplace` succeeds | yes |
| 3 | `mp-add-failed` | `apply.ts:316-323` (undefined — unreachable), `335-340` (typed), `343-348` (catch) | typed: make `gitOps.clone` fail; catch: a source string `parsePluginSource` rejects | yes (typed arm only) |
| 4 | `mp-removed` | `apply.ts:263` | config drops a recorded marketplace | yes |
| 5 | `mp-remove-failed` | `apply.ts:212-219` (undefined — unreachable), `293` (typed), `225-230` (catch) | typed: cascade returns `failed` | yes (typed arm only) |
| 6 | **`mp-remove-partial`** | `apply.ts:289` | a remove whose cascade unstages some plugins and fails others | **no** |
| 7 | `plugin-disabled` | `apply.ts:466-491` (install-disabled) and `758-761` (toggle) | `defaultEnabled:false` install; config flips `enabled:false` | yes |
| 8 | **`plugin-disable-failed`** | `apply.ts:762` `buildFailed` | `setPluginEnabled(enable:false)` returns `failed`, or throws | **no** |
| 9 | `plugin-enabled` | `apply.ts:745-749` | config flips a disabled record to enabled | yes |
| 10 | `plugin-enable-failed` | `apply.ts:750` | enable fails | yes |
| 11 | `plugin-installed` | `apply.ts:493-520` | config declares a new plugin | yes |
| 12 | `plugin-install-failed` | `apply.ts:522-528` (typed), `531-537` (catch) | install returns `failed` | yes (typed arm only) |
| 13 | `plugin-uninstalled` | `apply.ts:260`, `272`, `393-399` | config drops a plugin; or a remove cascade unstages | yes |
| 14 | **`plugin-uninstall-failed`** | `apply.ts:276-282` (under a partial remove), `373-381` (undefined — unreachable), `401-407` (typed), `410-416` (catch) | uninstall returns `failed`; or a partial remove | **no** |
| 15 | `source-mismatch` | `apply.ts:673-704`, four causes | planner emits `plan.sourceMismatches` | partially — only `"dangling-reference"` |

`plugin-backfilled` is the 16th `PerEntryOutcome` kind but is produced by `backfill.ts`, not
`apply.ts` [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:392-396`], which is why
D-115-07 names 15 for apply.

### The 8 `import/execute.ts` outcome types

| # | Type | Producer site | Reachable via |
|--:|------|---------------|---------------|
| 1 | `MarketplaceAddedOutcome` | `execute.ts:701-706` | `deps.addMarketplace` returns `{status:"added"}` |
| 2 | `MarketplaceSkipOutcome` | `execute.ts:571-576` | marketplace already in state with a `"same"` source |
| 3 | `PluginInstalledOutcome` | `execute.ts:649-659` | `deps.installPlugin` returns `{status:"installed"}` |
| 4 | `PluginSkipOutcome` | `execute.ts:787-794` (already recorded) and `1041-1049` (`ConcurrentInstallError`) and `1056-1063` (`PluginShapeError{already-installed}`) | three distinct routes — all three must be produced |
| 5 | `ImportWarningOutcome` | `execute.ts:772-777` (`unmappable-marketplace-source`), `1066` (`unavailable`), `1070` (`uninstallable`), and via `recordMarketplaceAddFailure` (`marketplace-failed`) | four reasons; two of them are suppressed from the notification but still ride the returned result |
| 6 | `MarketplaceFailureOutcome` | `execute.ts:530-536` inside `recordMarketplaceAddFailure` | add returns a non-`added` outcome, returns `undefined`, or throws |
| 7 | `SourceMismatchOutcome` | `execute.ts:585-593` | recorded source differs from the Claude-settings source |
| 8 | `UnexpectedPluginFailureOutcome` | `execute.ts:626-634` (throw) and `1075-1083` (untyped `Error`) | two distinct routes |

Note that four of the eight types have **more than one producer route**, and D-115-07 asks
for every outcome kind to be produced — the plan should read that as every *route*, since a
single route leaves the sibling branch uncovered anyway.

## Standard Stack

No new dependency is introduced or needed. Everything below is already in `package.json`
and already used by completed pairs.

### Core

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `node:test` | Node ≥ 20.19 built-in | Runner, lifecycle, `t.mock` | Mandated: "Use `node:test` for the runner, lifecycle, and the context's `t.mock`" [VERIFIED: `.claude/rules/typescript-unit-testing.md`, Tools] |
| `node:assert/strict` | built-in | Assertions | Same rule. Under `/strict`, `assert.deepEqual` is `deepStrictEqual`, so the 82 existing `deepEqual` calls are contract-legal; the 409 `assert.equal` calls are the problem, not the `deepEqual` spelling |
| `strong-mock` | `^9.2.2` | Strict interaction mocks | Mandated for interaction mocks; already a devDependency [VERIFIED: `package.json:27` — `"strong-mock": "^9.2.2",`] |

### Supporting (in-repo test support)

| Module | Purpose | When to use |
|--------|---------|-------------|
| `tests/platform/git-ops-fake.ts` → `createGitOpsFake` | The network-edge double | Every case that drives real `addMarketplace` / `installPlugin` / `removeMarketplace` [VERIFIED: `tests/platform/git-ops-fake.ts:76` — `export function createGitOpsFake(options: GitOpsFakeOptions): GitOpsFake {`] |
| `tests/platform/credential-ops-fake.ts` | Credential-edge double | Any case reaching a git-auth path |
| `tests/platform/git-ops-contract.ts`, `credential-ops-contract.ts` | Shared adapter contracts | Not needed here; they belong to the platform pairs |
| File-local `withHermeticHome` / `makeCtx` / `makePi` factories | Per-suite support | The established shape; `SUITE-02` forbids a generic helper directory |

### The canonical `ctx` double — copy this, not the casts

The seven Phase-115 suites build `ExtensionContext` with `as unknown as` (34 sites) or a
single `as StubCtx` assertion on an incomplete literal. The completed Phase-114 owner does
it properly:

```ts
// tests/orchestrators/marketplace/add.test.ts:178-190 (excerpt, verbatim)
type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & { … };
…
const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
when(() => ctx.ui).thenReturn(ui).times(expectedNotifications);
when(() => pi.getAllTools()).thenReturn([]).times(…);
when(() => ui.notify).thenReturn((message, severity) => { … }).times(expectedNotifications);
```

[VERIFIED: `tests/orchestrators/marketplace/add.test.ts:178-226`, read this session.]
Sixteen test files already use `mock<ExtensionContext>` [VERIFIED: `grep -rln "mock<ExtensionContext>" tests/` → 16 files]. This is the recipe for eliminating all 34 double
assertions.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `strong-mock` for `ImportDeps` collaborators | Plain typed stubs (`{ installPlugin: async () => outcome } satisfies ImportDeps`) | The rules say a canned value driving one path **is** a stub, and "Do not turn a stub into a mock by asserting its call count." Where the case's promise is only *what the composition reports*, a stub is correct. Where the promise is *which collaborator was called with which scope and in which order* (D-115-08's "continuation, ordering"), it is a mock and `strong-mock` with `exactParams: true` + `verify()` is mandatory. Choose per case, not per file. |
| Rebuilding `apply.test.ts` from scratch | Incremental normalization | Rebuilding is likely cheaper here: 8 of 33 cases are deleted outright, all 33 need AAA and whole-value assertions, and ~40 new cells are added. Treat "rewrite" as the default for P115-05. |
| Extending the overload to three collaborators (Class A) | Deleting the guards outright | See the Reachability Audit; the overload preserves the fail-loud intent, the bare deletion does not. |

**Installation:** none — no package is added, removed, or upgraded by this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package. `npm install` is not run;
`package.json` is not modified. No `[SLOP]` or `[SUS]` verdict applies because no package is
introduced.

Packages removed due to `[SLOP]` verdict: none.
Packages flagged as suspicious `[SUS]`: none.

## Architecture Patterns

### Data flow through the composition tier

```text
Pi lifecycle: resources_discover                 /claude:plugin import
        │                                                 │
        ▼                                                 ▼
  index.ts::applyReconcile                    edge/handlers/plugin/import.ts
        │                                                 │  ← D-115-01 repoints here
        │                                                 ▼
        │                                     orchestrators/import/index.ts  (P115-03)
        │                                                 │
        │                                                 ▼
        │                                     orchestrators/import/execute.ts (P115-02)
        │                                          │           │
        │                                          │           └─→ ImportDeps seam
        │                                          │               (loadSettings, loadState,
        │                                          │                addMarketplace, installPlugin)
        ▼                                          ▼
 reconcile/apply.ts (P115-05) ──┬── readPassForScope ──→ persistence + planReconcile
        │                       │
        │                       ├── applyPlan ──→ REAL uninstall / remove / add /
        │                       │                 install / enable / disable
        │                       │                 (no injection seam by design)
        │                       │
        │                       ├── backfill.ts (P115-06) ──→ REAL reinstall
        │                       │
        │                       └── rebuildScopeRoutingTable
        │
        ▼
 reconcile/notify.ts (P115-07) ── buildReconcileAppliedCascade(outcomes) ──→ one notify()
        ▲
        │ (same module, different entrypoint)
 reconcile/pending.ts (P115-08) ── buildReconcilePendingNotification ──→ one notify()

 orchestrators/plugin/bootstrap.ts (P115-04) ──→ REAL addMarketplace + setMarketplaceAutoupdate
 orchestrators/edge-deps.ts (P115-01) ──→ persistence/state-io + domain/manifest + probes
```

Note the two independent test-design regimes this diagram makes visible, and why D-115-03
refuses to force symmetry: `import/execute.ts` has a parameter-level seam and its contract
is *aggregation*; `apply.ts` has none and its contract is *resulting on-disk state*.

### Pattern 1 — Inject the collaborator (import cascade)

**What:** drive `importClaudeSettings` with a complete `ImportDeps` bundle so each matrix
cell chooses the collaborator outcome directly.
**When to use:** every `import/execute.ts` cell except the D-115-04 defaults and the
write-back post-pass.
**Shape** (the production seam is already there):

```ts
// extensions/pi-claude-marketplace/orchestrators/import/execute.ts:207-234 (verbatim)
function stateLoader(deps: ImportDeps | undefined): (scope: Scope, cwd: string) => Promise<ExtensionState> {
  if (deps?.loadState !== undefined) { return deps.loadState; }
  /* c8 ignore next -- production path; unit tests always inject deps.loadState */
  return async (scope, cwd) => defaultLoadState(locationsFor(scope, cwd).extensionRoot);
}
function settingsLoader(deps) { return deps?.loadSettings ?? defaultLoadSettings; }
function addMarketplaceFn(deps) { return deps?.addMarketplace ?? defaultAddMarketplace; }
function installPluginFn(deps) { return deps?.installPlugin ?? (async (opts) => defaultInstallPlugin(opts)); }
```

D-115-04 closes lines 212, 215, 221, 227, and 233 by adding at least one case that passes
**no `deps` at all** against a real hermetic tree — which exercises all four `??` right
operands in one act.

### Pattern 2 — Drive the real composition (reconcile apply, bootstrap, backfill)

**What:** a case-owned `mkdtemp` tree plus `withHermeticHome`, a real
`claude-plugins.json` / `state.json`, `createGitOpsFake` as the only substitute, and
assertions on committed bytes read back through `loadState` / `loadConfig` / `locationsFor`.
**When to use:** every `apply.ts`, `bootstrap.ts`, `backfill.ts`, `pending.ts` case.
**Why it is affordable:** measured at 2.8–3.9 s per whole suite today.
**How each failure is provoked without a seam:** by shaping the *inputs on disk* — a
malformed config, an unparseable `state.json`, a pre-held `.state-lock`, a marketplace
source string that does not parse, a `gitOps` fake whose `clone` throws, a plugin fixture
whose manifest omits the entry, a directory made unwritable.

### Pattern 3 — Pure projection (reconcile notify)

**What:** call `buildReconcileAppliedCascade(outcomes)` / `buildReconcilePendingNotification(plans, keys)`
with `PerEntryOutcome[]` / `ReconcilePlan[]` literals and `deepStrictEqual` the whole
returned message.
**When to use:** all of P115-07 except `resolvePendingForceInstalls` (which needs a
`resolveStrict` fixture).
**Why it matters:** ten of P115-07's twenty-three uncovered branches close with pure
literals and zero I/O. This is the highest coverage-per-effort work in the phase.

### Pattern 4 — Barrel identity (import index)

**What:** import each runtime binding twice — through the barrel and from its defining
module — and `assert.strictEqual` them, one `describe()` per binding.
**Template:** `tests/bridges/skills/index.test.ts` (8 `describe()` blocks, 8 identity
assertions, passes direct coverage at `branches 1/1, functions 0/0, lines 22/22`).
**Type re-exports:** module-scope `satisfies` plus `@ts-expect-error` negatives; no runtime
phases.

### Anti-Patterns to Avoid

- **Reading production source text and asserting on it.** Eight such cases exist in
  `apply.test.ts` today. They test the wrong module, assert on comments, and break on any
  refactor. If a rule is genuinely architectural, it belongs in `tests/architecture/` and,
  per `.planning/codebase/CONVENTIONS.md`, must **plant** the violation rather than read the
  config.
- **Deriving the expected value from production.** `edge-deps.test.ts:573` calls the same
  classifiers the module calls and compares. A wrong classifier passes that test.
- **`as unknown as ExtensionContext`.** 34 sites. Use `mock<ExtensionContext>({ exactParams: true, name: "extension context" })`.
- **Adding a `deps` seam to `apply.ts`, `bootstrap.ts`, `backfill.ts`, or `pending.ts`.**
  Explicitly forbidden by D-115-03 and by `DES-01`.
- **Adding a coverage pragma anywhere.** The one that exists is being deleted; adding
  another inverts the phase.
- **Smuggling an impossible value past a type with a double assertion to hit an
  `assertNever`.** The repository's answer is to delete the arm (Phase 113 precedent), not
  to fabricate the value.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Faking git clone/fetch for a composition case | A per-file `gitOps` object literal | `createGitOpsFake` from `tests/platform/git-ops-fake.ts` | It is a stateful contract fake with a proven negative control (`PRES-03`, `PRES-04` are already `[x]`), records `state.calls.clone`, and supports `allowedRemoteUrls` for fail-fast offline proof |
| An `ExtensionContext` / `ExtensionAPI` double | `{ ui: { notify() {} } } as ExtensionContext` | `mock<…>({ exactParams: true, name: "…" })` + `when()` + `verify()` | The cast hides a structurally invalid double; the mock proves the exact notification cardinality D-115-08 asks for |
| A transaction/rollback simulator | A test-side ledger | Assert the real `runPhases()` effects | `.planning/codebase/ARCHITECTURE.md`: lifecycle owners "should assert its exported effects rather than recreate a test-side transaction engine" |
| Concurrency / lock-held provocation | `sleep` + polling | A pre-held `.state-lock` file, as `apply.test.ts`'s `T6` case already does | `proper-lockfile` is `retries: 0`, so a held lock surfaces deterministically as `StateLockHeldError` |
| A hermetic HOME helper shared across files | `tests/helpers/hermetic-home.ts` | A file-local `withHermeticHome` per suite | `SUITE-02` forbids a generic helper directory; each of the seven suites already has its own |
| An "impossible outcome" to reach an `assertNever` | `{ kind: "future" } as unknown as PerEntryOutcome` | Delete the unreachable arm under `D-05` | Phase 113 precedent, recorded verbatim in `.planning/STATE.md` |

**Key insight:** every substitution point this phase needs already exists as a proven
in-repo fake or as an explicit production parameter. The phase should add **zero** new test
infrastructure. If a case seems to need a new seam, that is the signal to re-read D-115-03,
not to build one.

## Common Pitfalls

### Pitfall — "already 100 percent" mistaken for "already compliant"

**What goes wrong:** P115-01 and P115-04 pass direct coverage today, so a planner sizes them
as no-ops. They are not: both need full AAA restructuring, and `edge-deps.test.ts` carries a
derived-expectation case that a wrong implementation would pass.
**How to avoid:** D-01 says it outright — "Normalize and re-prove all owners, including
accepted-`PASS` tests. Baseline triage is input, not completion evidence."
**Warning sign:** a plan for P115-01 or P115-04 with no test-file diff.

### Pitfall — assuming an uncovered branch is reachable

**What goes wrong:** an executor writes a case for `apply.ts:312` (`addMarketplace` returned
`undefined`), discovers it cannot be provoked, and reaches for a cast or a seam.
**How to avoid:** the Reachability Audit above classifies every uncovered arm. Give each
Class-A and Class-B arm an explicit disposition **in the plan**, before execution.
**Warning sign:** a task worded "cover the remaining defensive branches."

### Pitfall — the `DEL-03` collision on the Class-A overloads

**What goes wrong:** closing `apply.ts`'s three `undefined` guards the clean way edits
`add.ts`, `remove.ts`, and `uninstall.ts` — three Phase-114-complete pairs — which
`DEL-03` forbids, and an executor either does it silently or stalls.
**How to avoid:** a `checkpoint:human-verify` before P115-05 executes, presenting the three
dispositions from the Reachability Audit.
**Warning sign:** a P115-05 plan whose file list includes a `marketplace/` or `plugin/`
production module with no recorded exception.

### Pitfall — deleting a supplemental before its evidence lands

**What goes wrong:** `notify-projection-edge.test.ts` is the **only** current prover of
`reasonAsContent` and of the `mp-remove-partial` projection arm. Deleting it before P115-07
absorbs both cases loses coverage that was already green.
**How to avoid:** D-22 is explicit — "Remove a supplemental only after its unique evidence
is present in the owner." Make absorption and deletion one commit.
**Warning sign:** a plan with a standalone "delete supplementals" task.

### Pitfall — `fallow dupes` tripping on seven copies of `makeCtx`

**What goes wrong:** the `strong-mock` `makeCtx` recipe is ~40 lines; copying it into seven
more files under `duplicates.threshold: 3` may cross the gate. Sixteen files already carry
variants without failing [VERIFIED: `npx fallow dupes --fail-on-issues` exits `0` today],
so the risk is real but not certain.
**How to avoid:** run `npm run fallow` after the first two suites adopt the recipe rather
than after all seven; keep each factory shaped to its own suite's notification cardinality,
which is what keeps the existing sixteen distinct.
**Warning sign:** a mechanical copy-paste of `add.test.ts:178-226` into every file.

### Pitfall — the barrel prune breaking `fallow dead-code`

**What goes wrong:** D-115-01 removes seven re-exports and eight `fallow-ignore` markers.
Under the current `production: false` the seven pruned symbols keep their owner tests as
consumers, so dead-code should stay clean — but this was **not** verified by actually
performing the edit.
**How to avoid:** make "run `npx fallow dead-code --fail-on-issues` immediately after the
prune, before writing the owner test" an explicit verification step in the P115-03 plan.
**Warning sign:** the prune and the owner test landing in one unverified step.

### Pitfall — stderr noise mistaken for a failure

**What goes wrong:** `pending.test.ts` prints two `Legacy marketplace migration could not be
persisted …` warnings during its `MIG-01` cases. That is production's sanctioned
`console.warn` (IL-3), not a test failure.
**How to avoid:** decide in the plan whether the owner asserts the warning or arranges the
fixture so it does not fire. Do not "fix" it by silencing `console`.

### Pitfall — `install.test.ts` cited as an AAA precedent

**What goes wrong:** an executor observes that Phase 114's `install.test.ts` has 131 cases
and only 33 `// arrange` markers, and concludes markers are optional.
**How to avoid:** it is Phase-114 debt from extending a pre-milestone file in place, not
precedent. `add.test.ts` (52/52) and `plan.test.ts` (13/13) are the templates.

## Code Examples

### Compliant case shape (the target for all ~250 cases)

```ts
// Source: .claude/rules/typescript-unit-testing.md, "Reference case", adapted to this repo
test("reports a failed marketplace add and still installs the plugins of its siblings", async () => {
  // arrange
  const expectedResult: ClaudeImportExecutionResult = { /* complete, independently authored */ };
  const addMarketplace = mock<ImportDeps["addMarketplace"]>({ exactParams: true, name: "add marketplace" });
  when(() => addMarketplace({ /* exact options */ })).thenResolve({ status: "failed", reason: "not found", /* … */ });
  const installPlugin = mock<ImportDeps["installPlugin"]>({ exactParams: true, name: "install plugin" });
  when(() => installPlugin({ /* exact options */ })).thenResolve({ status: "installed", /* … */ });

  // act
  const importResult = await importClaudeSettings({ ctx, pi, cwd, selectedScopes: ["project"], deps: { addMarketplace, installPlugin, loadSettings, loadState } });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  verify(addMarketplace);
  verify(installPlugin);
});
```

### Pure projection case (P115-07's bread and butter)

```ts
// Source: tests/orchestrators/reconcile/notify-projection-edge.test.ts:20-42 (verbatim, already compliant in shape)
test("I1: mp-remove-partial projects a bare (failed) marketplace header with no mp-level reasons", () => {
  // arrange
  const outcomes = [
    { kind: "mp-remove-partial", scope: "user", marketplace: "partial-mp" },
  ] as const;

  // act
  const message = buildReconcileAppliedCascade(outcomes);

  // assert
  assert.deepEqual(message, {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      { name: "partial-mp", plugins: [], scope: "user", severity: "error", status: "failed" },
    ],
  });
});
```

This is the only file in the phase already written in compliant AAA form. It is also the
file D-115-05 deletes — transplant both cases verbatim, upgrading `deepEqual` to
`deepStrictEqual` for explicitness.

### Barrel identity case (P115-03)

```ts
// Source: tests/bridges/skills/index.test.ts (structure), applied to the pruned import barrel
import { importClaudeSettings } from ".../orchestrators/import/index.ts";
import { importClaudeSettings as definingImportClaudeSettings } from ".../orchestrators/import/execute.ts";

describe("importClaudeSettings", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedBinding = definingImportClaudeSettings;

    // act
    const barrelBinding = importClaudeSettings;

    // assert
    assert.strictEqual(barrelBinding, expectedBinding);
  });
});

// type re-exports: module-scope evidence only, no runtime phases
void ({ /* complete literal */ } satisfies ClaudeImportExecutionResult);
// @ts-expect-error an import execution result always carries its diagnostics array
void ({ addedMarketplaces: [] } satisfies ClaudeImportExecutionResult);
```

### Repeated-call idempotence (P115-04, success criterion 4)

```ts
test("a second bootstrap against an already-bootstrapped tree changes no bytes and reports only the idempotent autoupdate", async () => {
  // arrange
  const { ctx, pi, notifications } = makeCtx(3);
  const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureClaudePluginsOfficial() });
  const userLocations = locationsFor("user", cwd);

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });
  const stateAfterFirst = await readFile(userLocations.stateJsonPath, "utf8");
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.strictEqual(await readFile(userLocations.stateJsonPath, "utf8"), stateAfterFirst);
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(gitState.cloneCalls.length, 2); // github-source name check follows the clone (bootstrap.ts:88-99)
});
```

The three expected notification strings are quoted verbatim from
`tests/orchestrators/plugin/bootstrap.test.ts:222-226` and `:265-268`, which is the shipped
byte contract [VERIFIED].

## Runtime State Inventory

This phase is a test refactor with two small, contained production edits (the barrel
repoint plus the unreachable-arm removals). It moves and deletes files, so the inventory is
answered here rather than omitted.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | **None.** No datastore, collection name, key, or user_id changes. The only persisted artifacts touched are per-case `mkdtemp` trees created and removed by the tests themselves. | none |
| Live service config | **None** — verified by reading the eight source modules and the phase boundary; this phase registers nothing with an external service. | none |
| OS-registered state | **None** — no scheduler, launchd, pm2, or systemd registration exists in this repository. | none |
| Secrets / env vars | **None changed.** `HOME` and `PI_CODING_AGENT_DIR` are mutated and restored per case by each suite's file-local `withHermeticHome`; `TEST_CONCURRENCY` remains an optional npm-script knob. | none |
| Build artifacts | **None.** `tsconfig.json` is `noEmit: true` and there is no bundler or compiled output. | none |
| **File moves and deletions** | `tests/orchestrators/reconcile/plan-convergence.test.ts` moves to `tests/integration/` (its four relative imports shorten from `../../../extensions/…` to `../../extensions/…`); `tests/orchestrators/reconcile/notify-projection-edge.test.ts` is deleted; `tests/orchestrators/import/index.test.ts` is created. | `git mv` for the relocation so history follows; fix the four import depths; verify `npm run test:integration` picks it up under `tests/integration/**/*.test.ts` |

## Risks and Ordering

### Entanglement map

| Pair | Depends on | Why |
|------|-----------|-----|
| P115-03 (`import/index.ts`) | the D-115-01 production repoint | the barrel must have a production importer before its owner is meaningful and before `fallow` is clean |
| P115-02 (`import/execute.ts`) | D-115-02 (repoint the test import) | that is the recorded `wrong-import` violation; it must settle before the owner is finalized |
| P115-05 (`reconcile/apply.ts`) | **P115-07** (`reconcile/notify.ts`) | `apply.ts:67` imports `buildReconcileAppliedCascade`; the outcome vocabulary apply must produce is the vocabulary notify must project. Pin the projection first. |
| P115-07 (`reconcile/notify.ts`) | D-115-05 absorption | the two `notify-projection-edge` cases are the only current provers of `reasonAsContent` and the `mp-remove-partial` arm; absorption and deletion are one commit |
| P115-06 (`reconcile/backfill.ts`) | nothing in-phase | `backfill.ts` produces `plugin-backfilled`, which `notify.ts` already projects and covers |
| P115-08 (`reconcile/pending.ts`) | loosely, P115-07 | `pending.ts:49-51` imports three symbols from `notify.ts`; but pending's own gap is two branches and its notify dependencies are already covered |
| P115-01, P115-04 | nothing | fully independent |
| D-115-06 relocation | nothing | a pure `git mv` plus four import-path edits |

### Recommended wave structure

**Wave 1 — independent, low-risk, unblocks the barrel.**
P115-01 (`edge-deps`), P115-04 (`bootstrap`), the D-115-01/02 production repoint, and
P115-03 (`import/index`). Also land the D-115-06 relocation here; it is a `git mv` and it
removes one of the four correspondence violations immediately.

**Wave 2 — projection and scan pairs.**
P115-07 (`notify`, including the D-115-05 absorption), P115-06 (`backfill`),
P115-08 (`pending`), P115-02 (`execute`). P115-07 must precede P115-05.

**Wave 3 — the heavyweight.**
P115-05 (`apply`), after a `checkpoint:human-verify` on the Class-A disposition.

`DEL-01` requires one pair per executable plan and per commit, so the waves are about
scheduling and shared context, not about bundling commits.

### Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|--:|------|-----------|--------|------------|
| R1 | The Class-A `undefined` guards cannot be closed without editing three Phase-114 pairs (`DEL-03` collision) | HIGH — the analysis is verified | HIGH — P115-05 cannot reach `COV-01` | `checkpoint:human-verify` before wave 3; present the three dispositions from the Reachability Audit |
| R2 | Class-C `catch` arms turn out to be unreachable too | MEDIUM — verified reachable only for `addMarketplace` | MEDIUM | Make "find one planner-reachable throw route per catch arm, or dispose of it under D-05" an explicit P115-05 task |
| R3 | `fallow dupes` trips on seven copies of the `strong-mock` `makeCtx` | LOW-MEDIUM | MEDIUM — blocks `npm run check` | Adopt the recipe in two suites first, run `npm run fallow`, then continue |
| R4 | The barrel prune breaks `fallow dead-code` | LOW | MEDIUM | Run `fallow dead-code` immediately after the prune, before writing the owner test |
| R5 | Deleting the eight source-text pins in `apply.test.ts` loses a genuine architectural rule | LOW | LOW-MEDIUM | Read each of the eight before deleting; if one expresses a durable rule, re-home it in `tests/architecture/` as a *planting* test, per `CONVENTIONS.md` |
| R6 | Scope creep from the `PR #51` comment references in production (`apply.ts` × 13, `notify.ts` × 4) | MEDIUM | LOW | `.claude/rules/typescript-comments.md` explicitly **allows** GitHub PR references in comments. Leave production comments alone; only the 14 *test titles* are in question (see Open Questions). |
| R7 | The phase's line count (~13,000) makes review unwieldy | MEDIUM | MEDIUM | Pair-atomic commits (`DEL-01`) keep each review unit at one file; `apply.test.ts` at ~3,000 lines is comparable to `add.test.ts` at 2,423 |
| R8 | An executor "fixes" the two stderr migration warnings in `pending.test.ts` by silencing `console` | LOW | MEDIUM — would violate IL-3 | Name the warnings as expected production behavior in the P115-08 plan |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node ≥ 20.19.0; CI pins Node 24) + `node:assert/strict` + `strong-mock ^9.2.2` |
| Config file | none — configured entirely through `package.json` scripts |
| Quick run command | `node --test tests/orchestrators/reconcile/apply.test.ts` (2.8–3.9 s per suite) |
| Full suite command | `npm run check` (typecheck → lint → fallow → format:check → unit → integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| MOD-08 / P115-01 | `makeLocationsResolver` contract | unit + direct coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | yes |
| MOD-08 / P115-02 | import cascade aggregation + continuation | unit + direct coverage | `… orchestrators/import/execute.ts` | yes |
| MOD-08 / P115-03 | barrel re-export identity | unit + direct coverage | `… orchestrators/import/index.ts` | **no — new file** |
| MOD-08 / P115-04 | bootstrap composition + repeated-call idempotence | unit + direct coverage | `… orchestrators/plugin/bootstrap.ts` | yes |
| MOD-08 / P115-05 | reconcile apply: 15 outcome kinds, continuation, scope | unit + direct coverage | `… orchestrators/reconcile/apply.ts` | yes |
| MOD-08 / P115-06 | backfill gate, scan, promotion, isolation | unit + direct coverage | `… orchestrators/reconcile/backfill.ts` | yes |
| MOD-08 / P115-07 | pending + applied cascade projections | unit + direct coverage | `… orchestrators/reconcile/notify.ts` | yes |
| MOD-08 / P115-08 | pending advisory, idempotence, no-mutation | unit + direct coverage | `… orchestrators/reconcile/pending.ts` | yes |
| Phase gate | four correspondence violations closed | structural | `node scripts/check-corresponding-tests.mjs` (expect 14 remaining, all deferred to 116/117) | yes |
| Phase gate | negative controls still fire | structural | `npm run test:coverage:direct:negative` and `npm run test:corresponding:negative` | yes |
| Phase gate | relocated cross-module identity | integration | `npm run test:integration` | after the `git mv` |

### Sampling Rate

- **Per task commit:** `node --test <the one changed owner test>` then
  `node scripts/test-coverage-direct.mjs <its paired source>` — both must be green before
  the commit.
- **Per wave merge:** `npm run test:coverage:direct` (changed-pair mode, which derives its
  pair set from `git diff` against `origin/main` plus the working tree
  [VERIFIED: `scripts/test-coverage-direct.mjs:99-142`]) plus
  `node scripts/check-corresponding-tests.mjs`.
- **Phase gate:** `pre-commit run --all-files`, then `npm run check` green, then
  `npm run test:coverage:direct:all`.

### Wave 0 Gaps

- [ ] `tests/orchestrators/import/index.test.ts` — the phase's only missing file; covers
      MOD-08 / P115-03.
- [ ] No framework install, no config file, no shared fixture module is needed. `strong-mock`
      is already a devDependency; `createGitOpsFake` already exists; every suite already
      owns its `withHermeticHome` / `makeCtx` factories.
- [ ] No new `tests/helpers/` module may be created (`SUITE-02`).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.
This phase changes no runtime behavior, adds no dependency, opens no port, parses no new
untrusted input, and touches no credential path. The ASVS analysis is therefore short but
not omitted.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | The phase does not modify `platform/git-credential.ts`, `orchestrators/auth-host.ts`, or `domain/github-auth.ts`. Credential paths remain Phase-113/114 territory. |
| V3 Session Management | no | No session state exists in these modules. |
| V4 Access Control | no | Scope selection (`user` / `project`) is unchanged; the phase adds no scope arm. |
| V5 Input Validation | yes (already satisfied) | `typebox` validators in `domain/components/*.ts` and `persistence/config-io.ts` remain the boundary. New test cases feed **malformed** `claude-plugins.json` and `state.json` fixtures on purpose — that exercises the existing validators rather than bypassing them. |
| V6 Cryptography | no | No cryptography in scope. |
| V12 File and Resource | yes (already satisfied) | `shared/path-safety.ts::assertPathInside` is the NFR-10 containment chokepoint; every new case writes only inside its own `mkdtemp` tree. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status in this phase |
|---------|--------|---------------------|----------------------|
| Test writes outside its temporary tree (repo, `$HOME`) | Tampering | one `mkdtemp` per case, removed in `finally` / `t.after()`; `withHermeticHome` redirects `HOME` and clears `PI_CODING_AGENT_DIR` | Existing pattern; every new case must follow it |
| A test reaching a live remote | Information disclosure | `createGitOpsFake` with `allowedRemoteUrls`, plus D-18's fail-fast requirement | **Gap today in `edge-deps.test.ts`** — no fail-fast fake installed; close it in P115-01 |
| A production seam added "just for the test" widening the attack surface | Elevation of privilege | `DES-01` / D-115-03 forbid it; ESLint + `fallow` boundary zones gate imports | Enforced by the phase contract |
| A coverage pragma hiding an unexercised security-relevant path | Repudiation | The milestone forbids pragmas; the one that exists is being deleted (D-115-04) | Improves posture |

No new threat is introduced by this phase.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Analogous pre-`try` throw routes exist for `removeMarketplace`, `uninstallPlugin`, `installPlugin`, and `setPluginEnabled`, making `apply.ts:224, 409, 530, 644` reachable the way `addMarketplace` makes 342 reachable | Reachability Audit, Class C | If wrong, four more branches join Class A and the `DEL-03` collision widens. Verify per-collaborator during P115-05 planning. |
| A2 | Pruning `import/index.ts` to one runtime re-export keeps `npx fallow dead-code --fail-on-issues` at exit 0 under `production: false` | P115-03, Risk R4 | If wrong, D-115-01 needs rework mid-wave. Cheap to falsify: perform the edit and run the command. |
| A3 | Copying the `strong-mock` `makeCtx` recipe into seven suites will not cross `fallow dupes`' `threshold: 3` | Risk R3 | If wrong, `npm run check` fails and the factories need per-suite differentiation. Sixteen variants coexist today, which is suggestive but not proof. |
| A4 | The estimate of ~85–100 net-new cases and ~13,000 final lines | Combined phase estimate | An underestimate would stretch the phase; the numbers are extrapolated from `add.test.ts`'s 47 lines/case, which is itself a composition-heavy owner |
| A5 | Deleting the five Class-B `never`-typed default arms type-checks cleanly without a `noImplicitReturns` complaint in `blockToMarketplaceMessage` | Reachability Audit, Class B | If wrong, the `import/execute.ts` arm needs the status-narrowing edit (which the recommendation already includes) rather than a bare deletion |

## Open Questions (RESOLVED)

1. **Do `PR #51` references belong in test titles?** — **RESOLVED:** moot. 115-05 Task 2 retitles all 14 for the independent CASE-02 violation.
   - What we know: `.claude/rules/typescript-comments.md` explicitly **allows** "GitHub
     issue/PR references like `#2916`" in comments and test titles.
     `.claude/rules/typescript-unit-testing.md` says "A durable requirement ID may appear;
     plan, phase, or ticket references may not."
   - What's unclear: whether a merged PR number counts as an allowed GitHub reference or a
     forbidden ticket reference.
   - Recommendation: rewrite the 14 `apply.test.ts` titles regardless — they are
     independently non-compliant with `CASE-02` because they name implementation shapes
     (`"the three non-toggle orchestrated loops in apply.ts adopt the fail-loud … pattern"`)
     rather than public behavior. Leave the `S6` / `S8` / `Y3` decision anchors in *comments*,
     where both rules agree they are fine. Do not touch production comments.

2. **What becomes of the eight source-text pins in `apply.test.ts`?** — **RESOLVED:** 115-05 Task 2 triages each pin, then deletes; any survivor becomes a planting test under `tests/architecture/`.
   - What we know: all eight assert `assert.match` over production source; seven target
     modules other than `apply.ts`.
   - What's unclear: whether any encodes a rule that is not otherwise gated.
   - Recommendation: read each before deleting. `.planning/codebase/CONVENTIONS.md` says a
     gate "wants a test that plants the violation, not one that reads the config" — so a
     surviving rule moves to `tests/architecture/` as a planting test, and the rest are
     deleted. Budget one task for the triage.

3. **Is `reconcile/README.md` drift worth fixing?** — **RESOLVED:** deferred to Phase 117 with the other repository-wide gates; out of scope for Phase 115.
   - What we know: `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:24`
     describes `buildReconcilePreviewNotification` and a `preview.ts`; the shipped names are
     `buildReconcilePendingNotification` and `pending.ts`.
   - What's unclear: whether a README counts as "source and test files" under `SUITE-03`.
   - Recommendation: out of scope for Phase 115 (it is not a pair). Capture it for Phase 117's
     repository-wide gates.

4. **`assert.deepEqual` or `assert.deepStrictEqual`?** — **RESOLVED:** `deepStrictEqual` throughout, as every plan specifies.
   - What we know: under `node:assert/strict` they are the same function. Completed owners
     use both (`plan.test.ts` 14/0, `install.test.ts` 137/52).
   - Recommendation: prefer `deepStrictEqual` for explicitness — it is what the rule's
     reference case shows — but do not treat an existing `deepEqual` as a defect.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v24 (engines floor `>=20.19.0`) | — |
| npm | dependency install | ✓ | bundled | — |
| `node --test --experimental-test-coverage` | direct coverage gate | ✓ | built-in | — |
| `fallow` | `npm run fallow` | ✓ | `^3.16.0` via npx, both sub-gates exit 0 | — |
| `strong-mock` | interaction mocks | ✓ | `^9.2.2` devDependency | — |
| `pre-commit` | commit gate | ✓ | configured in `.pre-commit-config.yaml` | — |
| Network | **not required** | — | — | every case is offline by contract (`SUITE-01`) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## State of the Art

| Old approach (present in these seven suites) | Current approach (Phase 113/114 completed owners) | Impact |
|-----------|------------------|--------|
| Unmarked case bodies | lowercase `// arrange` / `// act` / `// assert`, blank-line separated | 160 cases to restructure |
| `as unknown as ExtensionContext` | `mock<ExtensionContext>({ exactParams: true, name: "extension context" })` + `verify()` | 34 sites |
| Piecemeal `assert.equal` / `assert.ok` | `assert.deepStrictEqual` on the whole public result | 596 piecemeal calls to consolidate |
| Source-text `assert.match` pins | behavioral cases, or a planting test under `tests/architecture/` | 8 cases to delete or re-home |
| Expected values derived by calling production | independently authored literals | 1 case (`edge-deps.test.ts:573`) |
| `c8 ignore` pragma for a production default path | a case that exercises the default | 1 pragma, the last in `extensions/` |
| Defensive `default:` arm over a `never` scrutinee | delete the arm, keep the type exhaustive | 5 arms (Phase 113 precedent) |
| `if (result === undefined)` guard on an orchestrated return | mode-discriminated overload making the branch a compile error | 3 guards (`Y3` precedent in `enable-disable.ts:570-575`) |

**Deprecated / outdated in this phase's scope:**

- `tests/orchestrators/reconcile/notify-projection-edge.test.ts` — absorbed by D-115-05.
- `tests/orchestrators/reconcile/plan-convergence.test.ts` at its current path — relocated by
  D-115-06.
- The seven suppressed re-exports and eight `fallow-ignore` markers in
  `orchestrators/import/index.ts` — pruned by D-115-01.

## Sources

### Primary (HIGH confidence) — measured or read in this session

- `node scripts/test-coverage-direct.mjs <source>` run for all seven existing pairs, plus
  `extensions/pi-claude-marketplace/bridges/skills/index.ts` as a barrel control.
- `node --test --experimental-test-coverage --test-reporter=lcov` per owner test, with the
  resulting LCOV parsed for `FNDA:0` and zero-hit `BRDA` records.
- `node scripts/check-corresponding-tests.mjs` (18 violations).
- `npx fallow dead-code --fail-on-issues` and `npx fallow dupes --fail-on-issues` (both exit 0).
- `time node --test <file>` per owner test.
- Full or partial reads of: `orchestrators/edge-deps.ts`, `orchestrators/import/index.ts`,
  `orchestrators/import/execute.ts`, `orchestrators/import/types.ts`,
  `orchestrators/plugin/bootstrap.ts`, `orchestrators/reconcile/apply.ts`,
  `orchestrators/reconcile/backfill.ts`, `orchestrators/reconcile/notify.ts`,
  `orchestrators/reconcile/pending.ts`, `orchestrators/reconcile/types.ts`,
  `orchestrators/reconcile/apply-outcomes.ts`, `orchestrators/types.ts`,
  `orchestrators/marketplace/add.ts`, `orchestrators/plugin/enable-disable.ts`,
  `edge/handlers/plugin/import.ts`, `scripts/test-coverage-direct.mjs`,
  `scripts/check-corresponding-tests.mjs`.
- Test files read: all seven Phase-115 owners plus `notify-projection-edge.test.ts`,
  `plan-convergence.test.ts`, `tests/bridges/skills/index.test.ts`,
  `tests/orchestrators/marketplace/add.test.ts`, `tests/bridges/hooks/exec-result.test.ts`,
  `tests/shared/errors.test.ts`.
- Planning documents: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`,
  `.planning/phases/115-composition-orchestrators/115-CONTEXT.md`,
  `.planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md`,
  `.planning/config.json`.
- Rules: `.claude/rules/typescript-unit-testing.md`, `.claude/rules/typescript-comments.md`,
  `CLAUDE.md`, `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`.

### Secondary (MEDIUM confidence)

None. No external documentation was needed.

### Tertiary (LOW confidence)

None. No web search was performed; every question this phase raises is answered inside the
repository.

## Metadata

**Confidence breakdown:**

- Per-pair coverage numbers: **HIGH** — produced by the repository's own gate, quoted verbatim.
- Uncovered function and branch identification: **HIGH** — parsed from LCOV, then read at the
  named source lines.
- Class-A and Class-B unreachability: **HIGH** — the producer's own doc comments and type
  unions were read and quoted.
- Class-C `catch`-arm reachability: **MEDIUM** — verified for `addMarketplace` only; A1 in the
  Assumptions Log.
- Matrix sizing (66 / 46–49 cells): **MEDIUM** — a careful enumeration of producer sites, but
  cell granularity is partly a planning choice.
- Line-count projection: **MEDIUM** — extrapolated from `add.test.ts`.
- Contract-compliance census: **HIGH** — `grep -c` counts.
- Ordering and risk recommendations: **MEDIUM** — reasoned from the verified dependency edges.

**Research date:** 2026-09-01
**Valid until:** this research is pinned to `features/unit-test-refactor` at `3331d23d`. The
coverage numbers, violation counts, and census figures are exact for that tree and become
stale the moment a Phase-115 plan lands. Re-run
`node scripts/test-coverage-direct.mjs <source>` before starting each pair rather than
trusting the table.
