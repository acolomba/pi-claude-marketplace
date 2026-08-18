---
task: 260816-qov-make-fallow-a-full-uniform-static-analys
status: complete
branch: features/fallow-full-gate
started_head: 0ce620f1
final_head: 10b8b19a
commits: 20
requirements: [FLOW-04, FLOW-01, NFR-5, NFR-6, IL-2]
---

# Make fallow a full, uniform static-analysis gate

`fallow` went from three overlapping half-measures to one whole-repo gate that
runs identically in three places, and the codebase was made compliant with it.

## What shipped

`npm run fallow` is now three explicit invocations chained with `&&`:

```
fallow dead-code --fail-on-issues --format human &&
fallow health    --fail-on-issues --format human &&
fallow dupes     --fail-on-issues --format human
```

That identical command runs in `npm run check`, in the `.pre-commit-config.yaml`
`npm-fallow` hook (`always_run: true`), and in `.github/workflows/lint.yml`. The
retired audit script, the delta-scoping flag and the `fetch-depth: 0` checkout
are gone from the repository. A green local run and a green pull request now
mean the same thing.

| Analysis class | Before | After |
|---|---|---|
| Dead code / boundaries / cycles | checked (filtered to 3 classes) | 0 findings, all classes |
| Complexity (`fallow health`) | not gated at all | 0 findings, gated |
| Duplication (`fallow dupes`) | not gated (`threshold: 0` = NO LIMIT) | 2.115%, gated at 2.2% |
| Clone groups | 66 | 41 |
| Zone coverage | complete by accident | complete by construction |

`npm run check` is green end to end. All 3467 unit tests and 21 integration
tests pass, unchanged, throughout — including the catalog UAT suite that
compares rendered output byte-for-byte against `docs/output-catalog.md`.

## Verification: every exit code was observed, never inferred

Per-subcommand on the final tree: `dead-code=0`, `health=0`, `dupes=0`,
`npm run fallow=0`.

Full negative battery, each planted then reverted:

| Planted defect | Exit | After revert |
|---|---|---|
| Cross-zone import (`shared/` importing `orchestrators/`) | 1 | 0 |
| Two-file circular dependency | 1 | 0 |
| Function above cyclomatic 20 | 1 | 0 |
| Duplication above threshold (one 66-line module pasted 3x) | 1 | 0 |
| File outside every zone | 1 | 0 |
| `process.stderr.write` in `shared`, `orchestrators`, `bridges/hooks`, `edge` | 1 (each) | 0 |

**Threshold measured on a clean committed tree, as instructed.** HEAD
`30dc24461c51dc99cf50b1fae3c5d658f3dba7f4`, working tree clean except untracked
`.planning/` artifacts: **2.1153261061025797%**. Threshold set to **2.2%** — a
deliberate margin of 0.085 points, recorded in the commit body. The figure is a
ratio over total lines, so it moves on any change to total line count even when
no duplication is added (deleting non-duplicated code raises it); the margin
absorbs that arithmetic jitter and nothing more.

**The threshold bites in BOTH directions**, verified as instructed: at 2.2 the
gate exits 0; lowered to 2.0 it exits 1 with `Duplication (2.1%) exceeds
threshold (2.0%)`; restored to 2.2 it exits 0 again. This matters because
`--fail-on-issues` does not fail duplication at all — `--threshold` is the only
thing standing between this gate and a permanent no-op.

No scratch file survives; `git status` is clean.

## Findings that changed the plan

**1. Fallow does NOT replace the NFR-5 architecture test — no test was removed.**

The plan expected a narrow `orchestrators-network-free` zone to let
`tests/architecture/no-orchestrator-network.test.ts` be deleted. Planting the
exact violation the plan specifies (a `platform/git.ts` import plus a `clone()`
call in `install.ts`) left `npm run fallow` at **exit 0** while the test
**failed**. D5 requires proof before removal, and the proof came back negative.

Three independent reasons, all measured and now recorded in the test's header
and in ARCHITECTURE.md:

- `orchestrators` → `platform` is a legal edge that `update.ts`,
  `clone-cache.ts` and `auth-host.ts` need, so a zone-granularity import rule
  cannot forbid it for three files only.
- The narrow zone split was actually built and produces **26 false violations**,
  because the two halves of `orchestrators/` legitimately import each other.
  Allowing them back lets `DEFAULT_GIT_OPS` reach `install.ts` through the
  `marketplace/shared.ts` re-export anyway, so the rule would enforce nothing.
- `platform/git.ts` shares a directory with `platform/pi-api.ts`, which
  `install.ts` legitimately imports. Fallow zones are directory-scoped.

The `import-boundaries.test.ts` tests also stay: they pin the ESLint
`no-restricted-paths` configuration and the `import-x/no-cycle` setting, neither
of which fallow covers. Whether the ESLint rule is now redundant was filed as
FLOW-07 rather than acted on, as the plan directed.

**2. The `dup:<hash>-NN` fingerprint form is an INDEX, not a content hash.**

Fallow emits two fingerprint forms. Appending a comment to `domain/name.ts` was
observed re-binding `dup:c77b3abb6f87acd9-25` from the live-uat canary pair to
`domain/name.ts` itself. An `ignoredClones` entry keyed that way would silently
suppress a different, unrelated group later — a hole in the gate that moves.
Only content-addressed `dup:<hash>` keys are used. The canaries' third group
carries only an index-form fingerprint, so it stays visible and is covered by
the threshold instead.

**3. `production: false` makes the unused-code classes nearly vacuous.**

D1a's `production: false` is correct for the reason the plan gives — it retires
~130 false positives from the `_*ForTest` seam convention and let the tree's one
suppression be deleted. But under it fallow reports "439 entry points detected
(437 plugin...)" against 440 files: it promotes nearly everything to an entry
point. A planted orphan at `shared/zz-orphan.ts` was **not** reported as unused.

So the `dead-code` invocation earns its place through boundary, coverage and
cycle enforcement — each verified by a planted violation — not through
`unused_files` / `unused_exports`. The per-analysis form
`production: { deadCode: true, health: false, dupes: false }` was verified to
work and yields 4 unused files plus 192 unused exports, so recovering real
unused-code detection is a triage job, not a flag flip. Filed as **FLOW-06**.

**4. Grouped `case` labels collapse to one branch.**

Measured while reducing `renderPluginRow` (19 arms, cyclomatic 21, cognitive 3).
This is what made the flat-dispatch cases tractable without splitting readable
switches into unreadable fragments.

## Deviations from plan

**[Rule 4-adjacent — architectural, resolved by measurement] Task 8 removed no
tests.** Covered above. The plan explicitly conditioned removal on an observed
exit 1; the observation was exit 0, so the sanctioned outcome was to keep the
tests and record why. The IL-2 forbidden-call rules were still added and do bite.

**[Rule 3] The four test seed helpers were not merged into one.** The plan
predicted they were "structurally the same fixture builder repeated across four
files." They are not: `install.test.ts` builds a plugin SOURCE TREE with
components and its own `plugin.json`, while the other three seed state records
from a supplied manifest. More importantly their `resources` defaults encode
DIFFERENT contracts — `list.test.ts` pins ENBL-18 (disable preserves every
array) while `info.test.ts` empties a disabled record's inventory. Forcing one
helper would have silently changed fixtures. Instead the genuinely identical
plumbing (record construction, state merge, config seeding, source-tree
materialization) moved to `tests/helpers/marketplace-seed.ts` and each suite
keeps its own `resources` policy. All four findings cleared; all tests pass
unchanged, which is the evidence the fixtures are byte-identical.

**[Rule 3] Remaining clone groups are gated by threshold, not enumerated as
`ignoredClones`.** A strict reading of Task 5/6's done-criteria would require an
`ignoredClones` entry for each of the 41 remaining groups. That would suppress
them from the percentage entirely and make the threshold — the actual gate —
meaningless. `ignoredClones` is used only where D4d intends it: structurally
identical fragments that must stay free to diverge (the two live-uat canaries,
2 entries). Everything else is either consolidated or counted.

**[Rule 1] Fixed an orphaned JSDoc** in `clone-cache.ts` and `list.ts` where an
earlier extraction left a block comment attached to the wrong function.

**[Rule 2] Removed an unnecessary type assertion** (`as PluginUpdateOutcome`,
`as RoutingEntry`, `as Partial<MockGitState>`) in three places rather than
leaving casts that could mask a shape error; each was verified unnecessary by
removing it and observing a clean typecheck.

## Compliance work (the bulk of the change)

**Complexity: 36 findings → 0.** Every one decomposed, none suppressed. There
are zero `health.thresholdOverrides` and zero `fallow-ignore` complexity
markers. Three now-redundant `eslint-disable sonarjs/cognitive-complexity`
comments were deleted. Every extracted helper stays guard-free (no state lock
re-acquired) and no ledger module gained an import of the other family's ledger.

**Duplication: 3.615% → 2.115%, 66 groups → 41.** The largest consolidations:

- 142 lines: the sync and async-rewake dispatch lanes carried identical copies
  of the HOOK-05 env builder, kept in sync only by a comment asking readers to.
  Now `bridges/hooks/hook-env.ts`.
- Eight `*.messaging.ts` render maps re-inlined row bodies their own comments
  said should be *called*, not duplicated (D-11). `shared/notify.ts` now exports
  one renderer per status and both the central switch and every map call them.
- Four copies of the host-keyed auth-bundle builder, three of whose comments
  described themselves as mirrors of the first → `auth-host.ts::buildCloneAuth`.
- The agents/commands/skills tolerant-readdir and markdown-file predicate →
  `shared/fs-utils.ts`. Cross-bridge imports are forbidden, so `shared/` is the
  only legal home.

## Tasks 10-12 (added after the initial nine)

### Task 10 -- make unused-code detection real

FLOW-06 recorded that `production: false` left the `unused_files` /
`unused_exports` classes vacuous: fallow promoted all 442 tsconfig-included
files to entry points, so a planted orphan was not flagged. Closed with
`includeEntryExports: true`, which subjects entry-file exports to unused-export
detection instead of auto-crediting them. `production` stays `false`; reverting
it would reintroduce the 299-finding test-consumer wall.

That surfaced **154 real findings, all resolved**:

| Resolution | Count |
|---|---|
| Export used only inside its own file -> dropped the `export` keyword | 60 |
| Dead name removed from a re-export list | 32 |
| Unreferenced declaration deleted, plus what it solely supported | 27 |
| `as const` tuple whose only consumer was a derived type -> direct union | 13 |
| Dead barrel FILE deleted | 2 |
| Suppressed with a written justification | 6 |

The two deleted barrels (`orchestrators/{plugin,marketplace}/index.ts`) had no
production consumer; each one's only consumer was a test asserting the barrel
re-exports, so those two tests went with them.

All six suppressions are compile-time assertions, not unused code:
`_DroppedHookDriftCheck`, `_DroppedHookArmKeysCheck` and
`_ReasonsCoverageProof` fail the BUILD on drift and their `export` is
load-bearing (dropping it was observed failing typecheck with TS6196);
`AddPrivateReason` / `RemovePrivateReason` derive through `_ReasonInSet`, which
is what asserts their literals are members of the closed `Reason` set; and
`ResolvedPluginSchema` is the canonical typebox definition of the NFR-7 union,
where un-exporting trips `no-unused-vars` and deleting orphans all three arm
schemas.

**Method finding:** textual grep could not classify these. Symbols appeared
elsewhere only in comments, in string literals, or as same-named local
declarations -- `FETCH_STATUSES` and `INSTALL_STATUSES` each collide with an
unrelated local const in `edge/completions/data.ts`. Typecheck was the decisive
test and caught two real importers a comment-stripped census missed, including
dynamic `await import()` call sites.

**Verified by plant:** a fresh orphan file exporting one unused function takes
`npm run fallow` to exit 1; exit 0 after deleting it. No probe file left behind.

### Task 11 -- prune dead bridge barrel re-exports

Each barrel's header declares the module's public surface and cites D-01
opaque-handle discipline, but the surfaces had drifted far past what anything
consumes.

| Barrel | Exported before | After |
|---|---|---|
| agents | 36 | 12 |
| mcp | 30 | 10 |
| skills | 18 | 10 |
| commands | 17 | 10 |
| hooks | 14 | 7 |
| **Total** | **115** | **49** |

All 66 removed lines were imported through the barrel by nobody. Only the
barrel LINES were removed -- every underlying declaration stays, because
several are used inside their own bridge (`convertAgent` is imported by
`bridges/agents/stage.ts` from `./convert.ts`). Re-verified before deleting
that there are zero namespace imports of any barrel and that the aggregate
`bridges/index.ts` export-star chain consumes nothing.

Pruning exposed two symbols whose only consumer had been a barrel line: a
pass-through re-export of `generatedAgentName`, and the unreferenced
`McpServerEntry` interface. Both removed.

**The shipping gate does not catch this class.** Measured directly: re-adding
`export { convertAgent } from "./convert.ts"` leaves `npm run fallow` at exit 0.
These findings were only ever visible under `production: true`, which is
rejected for the FLOW-04 / FLOW-06 reasons. So this is a one-time cleanup with
no ongoing protection, filed as **FLOW-08**.

### Task 12 -- test routing state through its own module

`event-router.ts` carried a re-export whose stated purpose was to keep itself
"the single import surface the test suite addresses" -- an export existing for
tests rather than production.

14 test files repointed at `routing-state.ts` for the four symbols it owns.
Four orchestrator tests reach it by dynamic import and now take
`getRoutingBucket` from `routing-state.ts`. One production consumer also relied
on the re-export: `spawn-helpers.ts` imported `RoutingEntry` from
`event-router.ts` and now imports it from `routing-state.ts`. The re-export is
deleted.

**One test actually moved** rather than being repointed: `"currentEpoch: starts
at 0 in a fresh module load"` had routing state as its SUBJECT, so it went to
the new `tests/bridges/hooks/routing-state.test.ts` (which also gained a
bump/reset test). Every other usage passes `currentEpoch()` into
`compositeHandlerFor` while asserting event-router behaviour -- those are
helpers, so those tests stayed put with the import repointed.

CONVENTIONS.md records the principle in order: test the public interface;
pressure to reach inside is signal a module wants to exist; extract only when
the inner code is semantically meaningful, otherwise return to the public
interface. Export-for-test is named as the anti-pattern that relieves the
pressure without doing the design work. Dependency injection is presented as
the principle applied, not an exception.

**FLOW-09** files the remaining ~84 exports and ~39 seams as decisions with two
legitimate outcomes -- promote to a module, or delete the export and test
through the public interface -- explicitly NOT as 84 pending extractions. It
records the payoff: 288 findings under `production: true` versus 154 under the
shipping config, with 196 exclusively an artifact of the difference, so
finishing it makes `production: true` viable without the `includeEntryExports`
workaround.

### Final state after Tasks 10-12

`fallow dead-code` reports 0 issues and 0 stale suppressions. `npm run check`
is green: 3466 unit tests pass (net +1 from the new routing-state module test,
-2 from the deleted barrel-assertion tests), 21 integration tests pass.

## Tasks 13-14 (added after Task 12)

### Task 13 -- enable `private-type-leaks` and clear 78 findings

Added a top-level `rules` block with `"private-type-leaks": "error"` -- the
ONLY rule override in the project; everything else stays on fallow's defaults.
No `--private-type-leaks` flag was added: the bare `fallow dead-code` reports
all 78 and exits 1 with the rule alone, and the flag is a filter that would
narrow the run to one issue type (the Task 2 trap).

Resolution of the 78, by the requested categories:

| Category | Findings |
|---|---|
| (a) export the referenced type | 57 |
| (b) narrow / inline the signature | 2 |
| (c) individual suppression with an inline reason | 19 |

**(a) 57.** Nearly all were base interfaces and union members already
referenced across a contract: `PluginOutcomeBase`, `OutcomeBase`,
`PluginUpdateBase`, `ReinstallOutcomeBase`, `MpCommon` and the notify message
variants. Exporting cascaded twice -- exporting a type revealed the private
types ITS signature named (`MpCommon`, `StatKind`, `InstallCtx`) -- so this was
iterated to convergence.

**(b) 2.** `SpawnImpl` was a one-token alias for `typeof spawn` in two files, so
both `_setSpawnForTest` signatures now say `typeof spawn` directly. That removes
the leak without exporting anything. `OrphanProbes` and `HookExecutor` are
multi-field, so inlining them would duplicate real structure -- those went to (c).

**(c) 19, in two groups.** Eight are internals of compile-time assertions
(`_AssertTrue`, `_AssertNever`, `_ReasonInSet`, `_DroppedHookArmKeysDrift`,
`_UncoveredReason`, `_ExtraReason`), which belong to drift guards whose export
exists only so `noUnusedLocals` treats them as consumed. Those lines already
carried an `unused-type` suppression, so the slug list is now comma-separated
on one directive -- a form I verified works before relying on it.

**The other 11 are the FLOW-09 cluster, reported rather than silenced by
widening the surface.** Each is an internal type reached only through a
`__test_*` or `_set*ForTest` export: `OrphanProbes`, `HookExecutor`,
`RefreshOneArgs`, `RefreshSnapshot`, `EntityErrorRow`, `ListReason`,
`FilterBucket`, `PluginRecord`, `ScopeReadResult`. Exporting them would widen
the public API to serve a test -- the anti-pattern CONVENTIONS.md names -- and
the clean fix is dependency injection. Each suppression names its type and
cites FLOW-09. Every new suppression uses the inline `-- reason` form, so it
would already satisfy `require-suppression-reason`.

`EntityErrorRow` looked like a genuine cross-module contract (it appears in
three `edge/` files), but all three occurrences are COMMENTS -- the same trap
as before.

Also corrected two comments left stale by the aggregate-barrel deletion: the
import-boundaries canary now names the fixture's real target
(`bridges/agents/index.ts`), and `discover-names.ts` describes the aggregate in
the past tense.

**Plants:** an exported function with a non-exported parameter type exits 1 and
reverts to 0; the orphan-file and cross-zone-import plants still exit 1 and
revert to 0. No probe file left behind.

### Task 14 -- `fallow audit` back as an additional PR-time layer

Not a reversal of Task 7. Audit was previously the ONLY CI gate and was
delta-scoped, so a dirty repo passed CI while local disagreed. The whole-repo
`npm run fallow` is now the blocking authority in all three surfaces; audit is
a second job doing a DIFFERENT job -- new-vs-inherited attribution on the diff.

`fallow ci-template` only ships a GitLab template, so the YAML is hand-rolled
on fallow's documented GitHub guidance: `--format github-annotations`, which
renders on fork PRs without a write token. The existing `fallow` job is
untouched and stays shallow; the new `fallow-audit` job takes `fetch-depth: 0`,
fetches the base branch explicitly, and pins `--base` to the PR base ref.
Default `new-only` gate; `--gate all` deliberately not passed.

**Verification 1 -- the 9 inherited dead-code findings are gone.**

| | before Task 13 | after |
|---|---|---|
| dead_code introduced / inherited | 0 / 9 | **0 / 0** |
| complexity introduced / inherited | 0 / 0 | 0 / 0 |
| duplication introduced / inherited | 3 / 24 | 3 / 26 |
| changed_files_count | 168 | 170 |

Better than the "ideally 0" target: nothing survives, including the
`_DroppedHookArmKeysCheck`-style guards, because audit honours the inline
suppressions Task 13 added.

**Verification 2 -- audit and the full gate agree on rule set.** The single
divergence was `private-type-leaks`, which audit enables by default and our
bare `dead-code` did not see until Task 13 added it to config; that is closed.
With 170 changed files against 440 in the repository, any additional default-on
rule would surface as inherited findings, and inherited dead-code is 0 while
the gate is also 0.

The remaining difference is duplication's **verdict model, not its rule set**:
audit counts clone groups per changed file, the gate applies a repo-wide
percentage. Measured: introduced duplication yields `warn` / exit 0, while a
planted introduced dead-code finding yields `fail` / exit 1. So duplication
stays gated by `duplicates.threshold` in the whole-repo job, not by audit --
recorded in STACK.md so it is not mistaken for a gap.

Audit's styling analysis contributes nothing here (no CSS in the repo);
`styling_introduced` / `styling_inherited` are structurally 0 and STACK.md says
so explicitly.

### Final state after Tasks 13-14

`fallow dead-code` reports 0 issues and 0 stale suppressions across all classes
including `private-type-leaks`. `npm run check` is green: 3466 unit tests, 21
integration tests. Version deliberately untouched at 0.15.0.

## Known stubs

None.

## Self-Check: PASSED

- `.fallowrc.json`, `package.json`, `.pre-commit-config.yaml`,
  `.github/workflows/lint.yml` — all present and committed.
- `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`,
  `bridges/skills/frontmatter-scan.ts`, `tests/helpers/marketplace-seed.ts`,
  `tests/helpers/ipc-child.ts` — all present.
- All 15 commits verified present in `git log` on `features/fallow-full-gate`.
- `npm run check` green; `npm run fallow` exit 0 on the final committed tree.
