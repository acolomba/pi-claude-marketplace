# Backlog

Ideas surfaced during planning that are deferred from active scope but worth retaining for future milestones.

## UAT-02: reconcile cascade invisible on `/reload` (host TUI limitation)

Surfaced by v1.12 milestone runtime UAT (2026-06-11). The load-time reconcile
cascade (RECON-04) is emitted correctly via `ctx.ui.notify`, and IS visible at
Pi startup -- but on `/reload`, pi's `handleReloadCommand` calls
`rebuildChatFromMessages()` after `session.reload()`, reconstructing the chat
from the LLM transcript only. Extension notifications (any severity) emitted
during the reload pipeline are erased. `@earendil-works/pi-coding-agent` is not
our fork; operator decided (2026-06-11) NOT to file an upstream issue for now.

Candidate directions for later brainstorming:

- queue-and-flush: stash the cascade when `reason === "reload"`, emit on the
  next extension event with a live UI (deterministic but late-arriving)
- persistent `ui.setWidget` badge summarizing the last reconcile
- upstream change: re-append extension notifications after the chat rebuild
- do nothing: results remain verifiable via `/claude:plugin pending` / `list`

Workaround today: run `/claude:plugin pending` before reloading, or `list` after.

## REASON-01: unify malformed-input failures under a "malformed X" reason family

Surfaced during v1.14 Phase 85 discuss (2026-07-22). The `UNSUPPORTED_REASONS`
tokens (`unsupported hooks`, `lsp`, `unsupported source`) semantically mean a
_well-formed but unsupported component KIND_ -- lsp / monitors / themes / etc.,
whose content the resolver never parses. Malformed input to a _supported_
feature is a different axis (a parse / structural defect) and belongs with the
failure family, parallel to `{invalid manifest}` and `{unparseable}`.

Two existing cases mislabel that axis:

- inline malformed `mcpServers` -> `{unsupported source}` (the `narrowResolverNotes` catch-all)
- malformed `hooks.json` (invalid JSON / schema) -> `{unsupported hooks}`

Phase 85 introduces the correct token `{malformed mcp}` for a broken/malformed
mcpServers _string reference_, but deliberately leaves the two cases above
unchanged (existing behavior, out of scope for this milestone).

Direction for later: introduce a consistent `{malformed <feature>}` failure-class
family and reroute the mislabeled supported-feature parse failures to it. Requires
re-auditing `narrowResolverNotes`, which currently forces every resolver note into
the unsupported family -- parse / structural notes need to reach failure-class
tokens (the `narrowProbeError` path already does this for I/O errors).

## COV-01: coverage exclusion policy, and the two out-of-bound orchestrators

Promoted from the 2026-08-10 todo at the v1.18 close (2026-08-12). Both parts sit
outside the D-99-05b bound (update / reinstall / install only), which is why the
bounded sweep could not carry them.

**The premise has already narrowed.** A fresh unit-coverage run on 2026-08-10
measured `orchestrators/edge-deps.ts` at **100%** line coverage, against the
49.7% capture from 2026-06-12 that raised the question. Whatever landed between
the two captures answered it by measurement: no exclusion is needed there, and
adding one now would exclude a module that already carries real tests.

**1. The exclusion policy itself.** Record the reasoning, not only the verdict,
because the next low-coverage wiring module raises the same question. A
`sonar.coverage.exclusions` entry raises the reported percentage without
executing one additional line -- the excluded file's uncovered arms stay
uncovered, they merely stop being counted. That trades a true statement about the
tree for a flattering one, and it does it silently: a later reader sees a high
number and infers safety the tests do not provide. An exclusion is defensible
only for code that cannot regress in a way tests would catch (generated files,
type-only declarations). Wiring glue does not qualify -- a mis-wired dependency
is exactly the defect an integration test catches. So the default answer is
tests, and any exclusion must carry its justification in
`sonar-project.properties` next to the entry.

**2. The two remaining orchestrators.** `import/execute.ts` (59 uncovered lines,
94.53%) and `marketplace/update.ts` (50 uncovered, 95.49%) were named by the
original carrier. Their uncovered remainder is the same shape the bounded sweep
worked -- rare-failure and cascade-diagnostic arms. Decide whether they get a
follow-on bounded sweep or are accepted as-is. Do not decide it by exclusion.

## FLOW-01: unzoned files are boundary-unchecked and nothing says so (CLOSED)

Filed 2026-08-15 alongside the fallow adoption (quick task 260815-h7g).

**CLOSED 2026-08-16** (quick task 260816-qov). `.fallowrc.json` now sets
`boundaries.coverage.requireAllFiles: true`, so zone coverage is complete by
construction rather than by accident of the current tree. Both questions the
item asked are settled: the failure names the unzoned path
(`extensions/.../probe.ts:1 no matching boundary zone`), and `tests/**` plus
`eslint.config.js` are explicitly out of scope through `allowUnmatched`, which
records them as unmatched by design rather than by oversight.

Two zones were added so no file under `extensions/` is unzoned: `entry` for
`index.ts` and `bridges-barrel` for the aggregate `bridges/index.ts`, bringing
the total to 14. `bridges-barrel` is deliberately on no other zone's allow
list -- it re-exports across all five bridge kinds, so any zone permitted to
import it would gain a laundering route around the no-cross-bridge-imports
rule. `orchestrators/plugin/discover-names.ts` was repointed at the three
per-kind barrels for exactly that reason.

Verified as the item asked: a throwaway directory outside every zone pattern
took `npm run fallow` to exit 1 naming the path, and deleting it returned the
gate to exit 0.

`.fallowrc.json`'s `boundaries` block names 12 zones, one per layer plus one
per bridge kind. Every file under `extensions/pi-claude-marketplace/` matches
one today, so the gate is complete by accident of the current tree rather than
by construction. A new top-level directory -- say
`extensions/pi-claude-marketplace/telemetry/` -- would match no zone, and
fallow would boundary-check none of it while still reporting a clean run.

`fallow config-schema` exposes `boundaries.coverage`, documented as an
"Optional policy for files that match no zone." It is currently unset. Setting
it should turn an unzoned file into a loud failure that says "add a zone,"
instead of silence that reads as "no violations."

Two things to settle when picking this up. First, the failure has to name the
unzoned path, or it just moves the confusion. Second, decide whether `tests/`
and repo-root config files are in or out of the policy's scope -- they match no
zone either, by design, and a naive policy would flag every one of them.

Verify by creating a throwaway directory outside all 12 zone patterns,
confirming `npm run fallow` fails on it, then deleting it. A clean run against
the current tree proves nothing here, because the current tree has no unzoned
files.

## FLOW-02: circular dependencies are gated in CI but not locally (CLOSED)

Filed 2026-08-15 alongside the fallow adoption (quick task 260815-h7g).

**CLOSED 2026-08-15:** `npm run fallow` now runs `--boundary-violations
--circular-deps --re-export-cycles`, so the local gate and the pull-request
gate see the same finding classes. The 8 inherited cycles described below are
gone -- the `bridges/hooks/` knot was untangled by extracting its shared module
state into the `bridges/hooks/routing-state.ts` leaf, so the gate could adopt
`--circular-deps` in the same change rather than suppress or baseline it.

`npm run fallow` passes `--boundary-violations`, which isolates the run to
boundary violations. Cycles are computed and discarded. The full report on the
current tree is `4 files, 190 exports, 93 types, 1 class member, 4 duplicate
pairs, 8 circular dependencies` -- none of which fails a commit, a
`npm run check`, or a `ci.yml` run.

CI is better off: `fallow audit` reports `circular_dependencies` and
`re_export_cycles` under its default `gate: new-only`, so a newly introduced
cycle fails a pull request while inherited ones pass with attribution. The
local gate has no equivalent, so a developer can introduce a cycle and see
green until the pull request opens.

All 8 inherited cycles are the single `bridges/hooks/` knot ARCHITECTURE.md
already documents by name (`event-router.ts` <-> `dispatch.ts` <->
`async-rewake/registry.ts`). That knot is why the local gate cannot simply add
`--circular-deps`: it would fail on day one.

Options, cheapest first: accept the 8 with `fallow-ignore-next-line
circular-dependency` markers at the knot (the codebase currently has zero
suppression markers, so this would be the first -- weigh that); adopt a
baseline if fallow supports one for cycles as it does for `dupes`; or untangle
the knot, which is a real refactor of the hooks bridge and out of proportion to
the gap.

Note the asymmetry this leaves today: a green local `npm run check` does not
imply the pull-request gate will pass.

## ~~FLOW-03: should `import-x/no-cycle` widen past `orchestrators/` now?~~ -- CLOSED

Closed 2026-08-17: the question is moot because the rule is gone.

Following this item's own verification recipe surfaced something larger
than the glob question. Widening the glob was free -- lint stayed clean
and took 19.23s against a 19.37s baseline, so the type-aware cost this
item worried about is measurably zero. But the planted two-file cycle
the recipe calls for was never reported, at ANY glob, including inside
`orchestrators/` where the rule already applied.

Six probes: the original config, a real `platform/` <-> `shared/` cycle,
`createNodeResolver` with `.ts` extensions, the vendor's whole
`flatConfigs.typescript` preset, that preset's parsers with the node
resolver, and `eslint-import-resolver-typescript` via
`createTypeScriptImportResolver`. Only the fourth made the rule emit
anything, and only a resolve error from the missing dependency. A
control unused-var error proved eslint was linting the files, and
`import-x/no-unresolved` firing on a bogus specifier while staying
silent on the real one proved resolution worked. The failure is in the
graph traversal, on eslint-plugin-import-x@4.17.1. Untested hypothesis:
this repository writes explicit `.ts` extensions in import specifiers,
which is not the convention import-x is built around.

The rule and its pinning test are removed. Cycles are gated by the bare
`fallow dead-code` run, which was measured catching the identical cycle
and exiting 1, and the replacement test pins that the invocation stays
unfiltered.

Original report follows.

Filed 2026-08-15 alongside the FLOW-02 closure (quick task 260815-p25).

`import-x/no-cycle` (BLOCK C-2 of `eslint.config.js`) is scoped to
`extensions/pi-claude-marketplace/orchestrators/**/*.ts`. The stated reason it
stops there was the `bridges/hooks/` cycle knot, which no longer exists. The
question the knot was masking is now askable: should the glob cover
`extensions/pi-claude-marketplace/**` instead?

It is not a free win. `npm run fallow --circular-deps` already covers the whole
repo, so the ESLint rule would be defense in depth rather than new coverage --
it buys editor-time feedback and a second opinion on the graph, at the cost of
a type-aware rule running over the full extension tree. Weigh the lint-time
cost against that.

`tests/architecture/import-boundaries.test.ts` pins both the current glob and
the `import-x/extensions` setting the rule depends on (without `.ts` in that
setting the rule walks a one-node graph and greens on any cycle). Widening the
glob means updating that test in the same change, and the test is the thing
that would otherwise let a silently-broken rule pass for a wide tree.

Verify by widening the glob against the current tree and confirming a clean
`npm run lint`, then planting a two-file cycle outside `orchestrators/` and
confirming the rule -- not just fallow -- fails on it.

## FLOW-04: converge the local and pull-request fallow gates on whole-repo, all-checks (CLOSED)

Filed 2026-08-15 alongside the FLOW-02 closure (quick task 260815-p25).

**CLOSED 2026-08-16** (quick task 260816-qov). The two gates are now one
command. `npm run fallow` is three explicit invocations --
`fallow dead-code --fail-on-issues`, `fallow health --fail-on-issues` and
`fallow dupes --fail-on-issues` -- and that identical command runs in
`npm run check`, in the `.pre-commit-config.yaml` `npm-fallow` hook, and in
`.github/workflows/lint.yml`. `fallow:audit`, `--changed-since` and the
new-only verdict are gone from the repository, so a green local run and a green
pull request now mean the same thing.

The sequence the item prescribed was followed: each class was driven to zero
BEFORE its invocation joined the gate, never the reverse.

| Check | At filing | At closure |
|-------|-----------|------------|
| Dead code | 156 findings | 0 |
| Complexity (`fallow health`) | 439 above threshold | 0 |
| Duplication (`fallow dupes`) | 3.5% | 2.12%, gated at a 3% threshold |

The `production` question the item called "the unlock" was settled as
`production: false`. That admits tests to the reachability graph, which retires
the ~130 false positives the `_*ForTest` seam convention manufactured and let
the one existing suppression in the tree -- on the load-bearing `currentEpoch`
and `getRoutingBucket` re-exports -- be deleted rather than kept.

Complexity and duplication were NOT closed by threshold tuning. The health
profile is fallow's own default (cyclomatic 20, cognitive 15) and all 36
findings were decomposed; duplication was consolidated from 66 clone groups to
41, measured at 2.12%.

The duplication threshold is set at 3%, deliberately above the measured figure.
A near-zero margin was rejected as too brittle for routine work: it would fail
CI on a single moderate copy-paste mid-refactor. 3% still enforces, because it
sits below the 3.62% the branch started at -- regressing to the pre-cleanup
level fails the gate -- while leaving room to consolidate within a PR rather
than being blocked on the first duplicated block.

One caveat worth carrying forward, recorded in STACK.md: under
`production: false` fallow promotes every discovered file to an entry point, so
the unused-file and unused-export classes are close to vacuous. Boundary,
coverage and cycle enforcement are unaffected and were each verified by a
planted violation. See the new FLOW-05 for the reckoning.

FLOW-02 closed the specific hole where a new cycle failed CI but not the local
gate. The two gates still answer different questions, and neither is a superset
of the other:

| | local `npm run fallow` | CI `fallow:audit` |
|---|---|---|
| Subcommand | `dead-code` | `audit` |
| Scope | whole repo | changed files only |
| Classes | boundary violations, circular deps, re-export cycles | dead-code + complexity + duplication + styling |
| Verdict | any finding, inherited or new | only newly-introduced findings |

A green local run therefore does not imply a green pull-request gate -- add a
complex or duplicated function and CI fails on something local never examines.
The delta-scoping in CI exists only because of inherited findings; drive those
to zero and `--changed-since` can become `--gate all`, at which point the two
gates converge and the asymmetry is gone for good.

**Why this is not a flag flip.** Whole-repo counts as of this filing:

| Check | Findings |
|-------|----------|
| Dead code (`--no-production --include-entry-exports`) | 156 -- 2 files, 62 exports, 91 types, 1 stale suppression |
| Complexity (`fallow health`) | 439 above threshold of 1517 analyzed, maintainability 87.5 (good) |
| Duplication (`fallow dupes`) | 2,104 lines (3.5%) across 55 files |

**Do the config fix first -- it is the unlock.** `.fallowrc.json` sets
`production: true`, which excludes tests from the reachability graph. Against
this project's deliberate `_*ForTest` seam convention that manufactures roughly
130 false positives: unisolated dead-code reports 294 findings under
`production: true` versus 156 under `--no-production --include-entry-exports`.
Until that is settled, "suppress the false positives" means ~130 suppression
comments, and no dead-code finding can be trusted on sight. This is not
hypothetical -- it is exactly why fallow flagged the load-bearing `currentEpoch`
and `getRoutingBucket` re-exports in `event-router.ts`, which now carry an
inline suppression rather than a removal.

The tradeoff to decide: `production: true` is designed to catch production code
whose only consumer is its own test, which is real dead weight. This project's
seam convention makes that same signal overwhelmingly false. Pick deliberately.

**Sequence.** Same clean-then-gate pattern that landed `--circular-deps`: get a
class to zero, then add its flag in that same change. Never add a flag first --
it fails on the inherited findings at the first commit.

1. Settle the `production` question; re-baseline the dead-code count.
2. Triage the resulting dead-code findings; gate dead-code whole-repo at zero.
3. Then, and only then, switch CI from `--changed-since` to `--gate all`.

**Complexity and duplication are threshold tuning, not a defect list.** 439
findings against maintainability 87.5 ("good") says the default thresholds are
stricter than this codebase's norm. Gating them means choosing thresholds
first; otherwise the options are raising them until green (cosmetic -- and the
spike series already caught one cosmetic-lever trap in `rules.<name>` severity)
or a large refactor. Advisory in CI is the honest posture for these two until
someone decides what the thresholds should be.

Related: FLOW-01 (unzoned files are boundary-unchecked) is the same class of
problem -- a gate that is complete by accident of the current tree rather than
by construction.

## FLOW-05: revisit CRAP and real coverage in the fallow health gate

Filed 2026-08-16 alongside the FLOW-04 closure (quick task 260816-qov).

`health.maxCrap` is set to `0`, which fallow documents as "disable CRAP
enforcement entirely: no findings, nothing counts above threshold." That is the
current posture and it is deliberate, not an oversight: complexity is gated
directly (cyclomatic 20, cognitive 15), coverage is gated by SonarCloud, and
CRAP is a product of the two, so it would be a third opinion about facts two
gates already own.

Record these so a future attempt does not rediscover them:

- Fallow needs Istanbul `coverage-final.json` and rejects lcov. This project
  emits lcov (`coverage/{unit,integration,e2e}.lcov`) for SonarCloud, so wiring
  real coverage is a conversion step, not a flag.
- `c8` emits `-1` branchMap columns that fallow's parser rejects outright.
- Naively clamping those columns is UNSAFE. One `c8` flag change silently
  zeroed 119 files and swung the `extensions/` CRAP figure from 25 to 238 --
  the metric moved by an order of magnitude with no code change, which means a
  gate built on it would have been enforcing the coverage pipeline's
  configuration rather than the code's risk.

Picking this up means owning the coverage-format conversion first. Until then
`maxCrap: 0` is the honest setting, because a CRAP number this project cannot
compute reliably is worse than no CRAP number.

## FLOW-06: `production: false` makes the dead-code classes nearly vacuous (CLOSED)

Filed 2026-08-16 alongside the FLOW-04 closure (quick task 260816-qov).

**CLOSED 2026-08-16**, same quick task. The fix was `includeEntryExports: true`
rather than reverting `production`. Fallow documents it as making "exports of
entry-point files subject to unused-export detection instead of being
auto-credited as used", which is exactly the arm the entry-point promotion was
short-circuiting. `production` stays `false`, so the ~130 false positives from
the `_*ForTest` seam convention do not return.

Enabling it surfaced 154 real findings. All 154 are resolved, and the
resolution mix is the evidence they were genuine rather than noise:

| Resolution | Count |
|---|---|
| Export used only inside its own file -> dropped the `export` keyword | 60 |
| Dead name removed from a re-export list | 32 |
| Unreferenced declaration deleted, plus what it solely supported | 27 |
| `as const` tuple whose only consumer was a derived type -> direct union | 13 |
| Dead barrel FILE deleted (`orchestrators/{plugin,marketplace}/index.ts`) | 2 |
| Suppressed with a written justification | 6 |

The two deleted barrels had no production consumer at all; each one's only
consumer was a test asserting that the barrel re-exports. Those two tests went
with them.

All six suppressions are compile-time assertions, not unused code:
`_DroppedHookDriftCheck`, `_DroppedHookArmKeysCheck` and
`_ReasonsCoverageProof` fail the BUILD on drift and their `export` is
load-bearing (dropping it was observed failing typecheck with TS6196);
`AddPrivateReason` and `RemovePrivateReason` derive through `_ReasonInSet`,
which is what asserts their literals are members of the closed `Reason` set;
and `ResolvedPluginSchema` is the canonical typebox definition of the NFR-7
union, where un-exporting trips `no-unused-vars` and deleting would orphan all
three arm schemas.

Method note worth keeping: textual grep could not classify these. Symbols
appeared elsewhere only in comments, in string literals, or as same-named local
declarations -- `FETCH_STATUSES` and `INSTALL_STATUSES` each collide with an
unrelated local const in `edge/completions/data.ts`. Typecheck was the decisive
test, and it caught two real importers a comment-stripped census missed,
including dynamic `await import()` call sites.

`.fallowrc.json` sets `production: false` so tests join the reachability graph.
That was the right call for the reason FLOW-04 gives -- it retires roughly 130
false positives from the `_*ForTest` seam convention -- but it has a cost that
was measured, not assumed:

Under `production: false`, fallow reports "439 entry points detected (437
plugin, 1 manual entry, 1 package.json)" against 440 discovered files. It is
promoting essentially every file to its own entry point. An orphan file planted
at `shared/zz-orphan.ts` was NOT reported as unused. Under `production: true`
the same tree reports 2 entry points and 289 findings, almost all false.

So today the `dead-code` invocation earns its place through boundary
violations, boundary coverage and circular dependencies -- each verified by a
planted violation -- while `unused_files` and `unused_exports` are close to
no-ops. The `adoption` skill's warning about a high plugin-entry-point count
being "a red flag, not a healthy signal" applies here.

Worth investigating whether the per-analysis form
`production: { deadCode: true, health: false, dupes: false }` (supported, and
verified working) plus a small number of individually justified suppressions
can recover real unused-code detection without reintroducing the false-positive
wall. Measured at filing: that form yields 4 unused files, 192 unused exports,
93 unused types and 4 duplicate pairs, so it is not a small triage.

## FLOW-07: is the ESLint `no-restricted-paths` zone matrix now redundant?

Filed 2026-08-16 alongside the FLOW-04 closure (quick task 260816-qov).

Deliberately NOT acted on in 260816-qov, which left the rule and its three
pinning tests untouched.

Fallow's 14-zone model is a finer-grained superset of the ESLint 8-zone matrix,
and it is the only thing enforcing that cross-bridge imports are forbidden.
That invites the question of whether the ESLint rule still earns its keep.

Two reasons it might. Fallow's boundary checking is reachability-gated, so a
violation in a file unreachable from `entry` is invisible to it, while ESLint's
glob-based rule is reachability-blind and would still catch it. And the three
architecture tests pin the ESLint rule's CONFIGURATION -- deleting them while
keeping the rule would leave a silently-misconfigured lint rule undetected,
which is the exact failure mode the `import-x/no-cycle` test was written to
catch.

Settle whether the reachability gap is real on this codebase before removing
anything.

## ~~FLOW-08: barrel re-export hygiene is unenforced~~ -- CLOSED

Filed 2026-08-16 alongside the barrel prune (quick task 260816-qov). CLOSED the
same day: the cause was found and removed rather than tracked.

**The diagnosis below was wrong**, and is kept because the correction is the
useful part. The gate was never blind to "barrel re-exports" as a class. It was
blind to exactly five files, and the reason was an `export *`.

`bridges/index.ts` did `export * from "./agents/index.ts"` and the same for the
other four per-kind barrels. A star re-export consumes EVERY export in its
target, so all five barrels had their exports auto-credited as used. Removing
the single `export *` line for agents made a planted dead export in
`bridges/agents/index.ts` report immediately.

It was not about re-exports -- a plain `export const` in those files was missed
identically. It was not about the `index.ts` filename --
`bridges/hooks/if-field/index.ts` and `bridges/index.ts` itself were both
caught. Exactly the five `export *` targets were blind, nothing else.

Resolution: the aggregate `bridges/index.ts` was deleted. Its only consumer was
the ESLint boundary canary fixture, via a bare side-effect import taking no
symbols; that fixture now points at `bridges/agents/index.ts`. All five barrels
were then verified enforced by planting a dead export in each. The same file was
independently an architectural laundering route across bridge kinds, so one
deletion closed both problems. See ARCHITECTURE.md.

Carry-forward rule, now in CONVENTIONS.md: never write an `export *` barrel; it
suppresses unused-export detection for everything it re-exports.

---

Original entry, retained for the record:

The five per-kind bridge barrels were pruned from 115 declared symbols to 49 --
the 66 removed were re-exported by the barrel and imported through it by
nobody. Before the prune `bridges/agents/index.ts` declared 36 symbols public
while 12 were consumed, publishing internals such as `convertAgent`,
`MODEL_MAP`, `TOOL_MAP`, `parseFrontmatter`, `emitYamlScalar` and
`sanitizeProvenanceValue` as public API when only the bridge itself used them.
That contradicted each barrel's own header, which declares the module's public
surface and cites D-01 opaque-handle discipline.

~~**The shipping gate does NOT catch this class, and that is the point of this
item.** Measured directly: re-adding `export { convertAgent } from
"./convert.ts"` to the agents barrel leaves `npm run fallow` at exit 0. The
findings were only ever visible under `production: true`, which is rejected for
the reasons in FLOW-04 and FLOW-06. So the prune is a one-time cleanup with no
ongoing protection -- a new dead barrel line can be added tomorrow and nothing
will notice.~~

The exit-0 measurement was real; the attribution was not. It was the `export *`
in the aggregate barrel, not the shipping config, and not re-exports as a
class. No architecture test is needed -- deleting the aggregate restored native
fallow coverage on all five barrels.

Distinct from FLOW-09: that one is about internals exported for TESTS, a
different cause with a different fix.

## FLOW-09: internals exported only for tests

**Status 2026-08-17: the type-leak half is done; the seams remain.**

All ten `private-type-leak` suppressions that cited this item are gone,
and no code references FLOW-09 any more. They came off four different
ways, and the split is the useful part of the record:

- Two were not a seam problem at all. `list.ts` re-exported
  `narrowProbeError` / `narrowListFailReason` to reach a ladder that
  `shared/probe-classifiers.ts` already exports publicly and already has
  a test file for. The tests moved to that file; the seams went.
- Two were a type in the wrong module. `EntityErrorRow` is a message-row
  shape and now lives beside `InstallMsg` in `install.messaging.ts`.
- One was a redundant alias. `reinstall.ts`'s `PluginRecord` duplicated
  `PluginInstallRecord`, already exported by `persistence/state-io.ts`.
- Five were contracts that were private for no reason. `HookExecutor`,
  `OrphanProbes`, `RefreshOneArgs`, `RefreshSnapshot`, `ScopeReadResult`
  and `FilterBucket` are the parameter and return types of functions the
  module already exports. A type you cannot name is not injectable, so
  exporting the contract is the honest shape.

What is NOT done is the thing this item is actually named after. The
`__test_`-prefixed re-exports and the `_set*ForTest` module-global
mutators still exist in `install.ts`, `update.ts`, `apply.ts`,
`list.ts`, `dispatch.ts` and `registry.ts`. They no longer leak private
types, so fallow is quiet about them, which makes this item HARDER to
find rather than closed. `registry.ts` alone carries eight seams.

The remaining work is dependency injection proper: pass the executor,
the probe bundle and the spawn function in, after which the seams
disappear rather than moving. Note `__test_availableRowMessage` is
different in kind -- it feeds a real cross-surface drift guard in
`tests/orchestrators/edge-deps.test.ts`, so it wants a public contract,
not deletion.

**Update 2026-08-18: the "fallow is quiet about them" claim above is only
half true, and the half that is false matters.**

Measured with three planted probes under the committed config:

| probe | shape | verdict |
| --- | --- | --- |
| exported, referenced by nothing | orphan | REPORTED |
| exported, referenced only by a module-PRIVATE function | internal-only | REPORTED |
| exported, named in an EXPORTED function's signature | contract | not reported |

So `unused-types` (default severity `error`, active) does catch an export
whose only consumer is its own file -- row 2 is exactly the shape this item
worried was invisible. `ignoreExportsUsedInFile` defaults to `false`
("suppress nothing"), not true. What fallow does NOT flag is row 3, and that
is correct rather than a hole: a type named in an exported signature is
genuinely public API, because a caller needs the name to call the function.

The consequence for this item: a seam is invisible to fallow only while it is
reachable through an exported signature. That makes the fix directional --
narrow the signature and the type goes private as a side effect, with no
suppression and no new gate. `runInstallLedger` is the worked example: it
returned its mutable `InstallCtx` scratchpad (25 fields, 11 mutable, including
the four rollback prep handles and a live `stateSnapshot`), which is what
forced the export. Returning a readonly `InstallLedgerSummary` projection of
the four fields that actually cross the module boundary made `InstallCtx`
module-private again (PR #132).

An export-surface pin test was considered and rejected: it would restate what
`unused-types` already enforces for rows 1-2 and cannot judge row 3.


Filed 2026-08-16 alongside the routing-state test repointing (quick task
260816-qov).

CONVENTIONS.md now states the principle: tests are written against the public
interface; pressure to reach inside is signal that a module wants to exist; and
exporting inner code for a test is the anti-pattern that relieves the pressure
without doing the design work.

Roughly 84 internal helpers are currently exported only so a test can reach
them, plus roughly 39 explicit test seams (`_setSpawnForTest`,
`_resetSpawnForTest`, `_setDispatchIdGeneratorForTest` and the like).

**This is NOT an item to perform 84 extractions.** Each site is a decision with
two legitimate outcomes:

  (a) the inner code is a semantically coherent unit -> promote it to a module
      with its own public interface and its own test; or
  (b) it is not -> delete the export and rewrite the test against the public
      interface.

Outcome (b) is a real and expected result, not a failure to extract. An attempt
that mechanically converted all 84 into modules would be applying the principle
wrongly and would leave the codebase worse -- 84 modules that exist only because
a test asked for them are the same defect in a new shape.

For the ~39 seams the answer is dependency injection, which is the same
principle rather than an exception: pass the dependency in, and it becomes part
of the public interface the test legitimately exercises. Relocating the state
holder does not help -- `routing-state.ts` is the proof, since production still
never calls the setter.

**The measured payoff, which is the actual reason to do this.** These exports
are precisely why `production: true` was unusable, because it flags every
test-only export as dead:

| Configuration | Findings |
|---|---|
| `production: true` | 288 |
| `production: false` + `includeEntryExports: true` (shipping) | 154 |
| Exclusively an artifact of the difference | 196 |

Applied fully there would be no test-only exports left, so `production: true`
becomes viable and yields genuine orphan-file and unused-export detection
WITHOUT the `includeEntryExports` workaround.

Distinct from FLOW-08: that one is dead re-export lines in the bridge barrels,
a different cause with a different fix.

## ~~FLOW-10: duplication is gated by one repo-wide percentage and nothing else~~ -- CLOSED

Closed 2026-08-17 as accepted, same day it was filed. Up to 3% duplication
is the deliberate posture: `duplicates.threshold` is the gate, one
whole-repo percentage, and the headroom between the current 2.1% and
that ceiling is budget rather than leak. Audit's warn-not-fail verdict
on introduced duplication is consistent with that and needs no change.

Reopen only if the intent changes, i.e. if introduced clones should be
blocked independently of the repo-wide total. Original report follows.

Filed 2026-08-17 while measuring the audit job's real behaviour on PR #132.

`fallow audit` reports introduced duplication but does not fail on it. The
verdict is `warn` and the exit code is 0, and this holds under BOTH gate
modes -- `--gate all` was measured exiting 0 on a branch carrying 3
introduced and 26 inherited clone groups, exactly as `new-only` did. So the
PR-time job contributes attribution, not enforcement, for this one class.

That leaves `duplicates.threshold` in `npm run fallow` as the only real
duplication gate, and it is a whole-repo percentage. The repository sits at
2.1% against a threshold of 3, so roughly 0.9 points of headroom can be
spent by any pull request without either job objecting. At the current
62,170 analysed lines that is on the order of 500 duplicated lines.

This is the direct consequence of raising the threshold from 2.2 to 3
earlier on the same branch, which was the right call at the time: 2.2 was
set against a tree that had just been cleaned and left no room to work.
The question is whether the headroom should be ratcheted back down as the
number settles, or whether a percentage is simply the wrong instrument and
introduced-clone-count wants its own gate.

Not urgent. It is a slow leak, not a hole -- but it is invisible until
someone reads the exit code rather than the red `✗ 1,321 lines (2.1%)`
line, which prints on a passing run.

Code seams: `.fallowrc.json` (`duplicates.threshold`), `package.json`
(`npm run fallow`), `.github/workflows/lint.yml` (`fallow-audit`).

## ~~FLOW-11: PR annotations are capped below the finding count~~ -- CLOSED (not as first attempted)

Closed 2026-08-17, but NOT the way this item proposed. The premise was
partly wrong and the proposed fix does not work.

The premise: the job log was said to be the only uncapped view. It is
not. The action runs a `Job summary` step in addition to the annotation
step, on every run, independent of `format`:

```text
Emit inline annotations -> rendered via native github-annotations
Job summary             -> rendered via native github-summary
```

So a complete, uncapped report already renders on the run page. The
10-per-type-per-step ceiling only ever truncated the INLINE markers on
the diff, which is a presentation limit rather than lost data.

The proposed fix: `sarif: true` was tried and reverted the same day. It
fails the job outright, and not for want of permission --
`security-events: write` was granted at job scope and the audit's own
verdict was `warn`:

```text
##[error]The CodeQL Action does not support uploading multiple SARIF runs
with the same category. Please update your workflow to upload a single
run per category.
```

Fallow emits one SARIF run per analysis (dead-code, health, dupes,
styling) under a single `fallow` category, and Code Scanning stopped
combining those in July 2025. That is inside the action's SARIF
generation, so no workflow-level setting reaches it. Reopen only if the
action starts emitting one run per category, and note the fork caveat
still stands: forks never get `security-events: write`, so a
SARIF-only reporting path would go dark on fork pull requests, which
log-based annotations do not.

Original report follows.

Filed 2026-08-17 from the first `fallow-rs/fallow@v3` run on PR #132.

The audit job reports through `--format github-annotations`, which emits
log-based `::warning` lines the runner turns into inline markers. The format
was chosen because it renders on fork pull requests without a write token,
unlike the PR-comment and review formats. That reasoning still holds.

The limit is GitHub's, and the action states it in the job log:

```text
##[notice]fallow emitted 8 annotations; GitHub shows at most 10 per type per step
```

Eight is under the cap, so nothing was lost on that run. But the count
scales with the diff, and a hand-rolled whole-repo variant of the same
command emitted 59 locally. A larger pull request will cross 10 silently.
Findings on lines outside the diff also fall back to the check summary
rather than rendering inline.

Two ways out, neither taken. The action exposes `sarif: true`, which
uploads to GitHub Code Scanning -- free on public repositories, no
per-step cap, findings persist across runs -- at the cost of a
`security-events: write` permission. Or `github-summary`, which renders the
full markdown report in the job summary and also survives fork pull
requests without a token.

The job log always carries the complete list, so nothing is unreachable
today; it is a discoverability ceiling, not a data loss.

Code seams: `.github/workflows/lint.yml` (`fallow-audit`).

## MRO-01: mode-aware structured output via `ctx.mode` and `pi.appendEntry`

Surfaced during the 2026-08-10 competitive analysis of `@nklisch/pi-plugins`
(`docs/competitive-analysis/pi-plugins.md`, recommendation #11). Verified
2026-08-13 directly against our own pinned `@earendil-works/pi-coding-agent`:
every `ExtensionContext` carries a real `mode: "tui" | "rpc" | "json" |
"print"` field, set by how the user invoked Pi (`pi` interactive, `pi -p`,
`pi --mode json`, or the RPC stdin/stdout protocol). We never read it. Our
sole output primitive, `ctx.ui.notify(message: string, type?)`, takes a plain
formatted string and a severity -- no structured-payload slot.

A user driving `/claude:plugin` through `pi --mode json` or RPC gets the same
human-formatted string wrapped in a JSON envelope today, not real
machine-readable data. `@nklisch/pi-plugins` solved this on the low-level
`pi.appendEntry<T>(customType, data)` primitive -- confirmed present in our
own pinned Pi version too, under "Append a custom entry to the session for
state persistence (not sent to LLM)". Their `pi-control-channel.ts` keys
output by mode: rpc/json modes emit `appendEntry` frames, print mode writes
stdout lines, tui is a no-op. A versioned grammar, closed exit-code
vocabulary, and pagination sit on top of that channel, none of which are
scoped here.

Direction for later: design a structured shape for the existing
`NotificationMessage` / `PluginInfoRow` discriminated types in
`shared/notify.ts` (most of the shape work already exists), and emit it via
`pi.appendEntry` when `ctx.mode` is `"json"` or `"rpc"`, alongside (not
instead of) the existing human `notify()` line.

Code seams: `shared/notify.ts` (message shapes), `platform/pi-api.ts`
(re-exports `ExtensionContext`), `edge/router.ts` (the `/claude:plugin`
command entry point every handler's `ctx` flows through).

## WFLW-01: `workflows` component kind is unrecognized (silent gap)

Surfaced 2026-08-13 auditing Claude Code's official plugin-marketplace and
plugins-reference docs (`code.claude.com/docs/en/plugins-reference`) against
our own resolver. Claude Code's manifest schema has shipped a `workflows`
field (`string|array`, "Custom workflow script files or directories,
replaces default `workflows/`") as a first-class component kind alongside
skills/commands/agents/hooks -- confirmed via direct fetch of the live docs,
not inferred.

`domain/resolver.ts` carries two closed component-kind lists:
`SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"]` and
`UNSUPPORTED_COMPONENT_KINDS = ["lspServers", "monitors", "themes",
"outputStyles", "channels", "userConfig", "settings"]`. `workflows` is in
neither. The code carries its own warning directly above the unsupported
list (T-02-25): "The list is closed. A new kind upstream that's neither in
SUPPORTED_COMPONENT_KINDS nor in this list would be silently ignored.
Re-audit when Claude Code adds new component kinds." That is exactly what
happened -- a plugin declaring `workflows` today gets no degradation, no
reason token, and no signal at all, unlike `monitors`/`themes`/etc., which
are all correctly tracked and correctly demote the plugin to
`partially-available`.

Direction for later: add `workflows` to `UNSUPPORTED_COMPONENT_KINDS` (the
mechanical fix that restores the closed-set guarantee and produces a
`{unsupported workflows}` reason) as the immediate fix; a real bridge that
translates a Claude workflow script into a Pi-native equivalent is a
separate, larger question with no known Pi analog yet.

Code seams: `domain/resolver.ts` (`SUPPORTED_COMPONENT_KINDS`,
`UNSUPPORTED_COMPONENT_KINDS`, `UNSUPPORTED_COMPONENT_CONVENTIONS`),
`domain/components/plugin.ts` (`UNSUPPORTED_COMPONENT_FIELDS` schema),
`shared/notify.ts` / `docs/output-catalog.md` (the closed REASONS set).

## PSRC-01: two real Claude Code plugin-source kinds unresolved (`npm`, `archive`)

Surfaced 2026-08-13 auditing Claude Code's official plugin-marketplace docs
against `domain/source.ts` and `domain/resolver.ts`.

**`npm`**: Claude Code's documented shape --
`{source: "npm", package, version?, registry?}`, installed via `npm install`
-- matches our own `NpmSource` interface field-for-field. We parse and list
it, but the resolver hard-rejects it: `unsupported source kind: npm`. This is
the same gap recommendation #5 in `docs/competitive-analysis/pi-plugins.md`
names ("npm plugin sources... removes our one unsupported plugin-source
kind") -- confirmed here as real Claude Code parity, not a competitor-only
convenience.

**`archive`**: a second, genuinely distinct Claude Code source kind --
`{source: "archive", url, sha256?}`, a zip archive downloaded over HTTPS,
"works without git or npm on the user's machine," requires Claude Code
v2.1.224+. `domain/source.ts`'s `ParsedSource` union (`PathSource |
GitHubSource | UrlSource | GitSubdirSource | NpmSource | UnknownSource`) has
no representation for it at all -- not even a recognized-but-unsupported case
in `parseKindObjectSource`'s switch, so an `archive`-sourced entry falls
through to `unknown` today. Neither `@nklisch/pi-plugins` nor this project
implements it; their own TAR-reader hardening is npm-tarball-specific and
does not cover Claude's zip-based `archive` format either.

Direction for later: `npm` needs resolver-side materialization (packument
fetch, tarball fetch, verify, extract -- the acquisition mechanics
`@nklisch/pi-plugins` already built, minus the SHA-512 absolutism their own
backlog flags as harmful -- see the cautions in `pi-plugins.md`). `archive`
needs a new `ArchiveSource` variant in `ParsedSource` plus a
zip-download-and-extract materialization path, likely sharing
containment/hardening concerns with whatever npm-tarball work lands first
(path traversal, symlink escapes, decompression bombs -- the same class of
hazard `@nklisch/pi-plugins`' `tar-reader.ts` defends against, for a
different archive format).

Code seams: `domain/source.ts` (`ParsedSource` union, `parsePluginSource`),
`domain/resolver.ts` (source-kind dispatch), `orchestrators/plugin/clone-cache.ts`
(the only existing acquisition seam, currently git-only).

## PKGDEP-01: no auto-install of a plugin's own Node.js/Bun dependencies

Surfaced 2026-08-13 auditing Claude Code's plugins-reference docs
(`code.claude.com/docs/en/plugins-reference`, "Node.js package
dependencies"). When a plugin's own root ships a `package.json` plus a
supported lockfile (`bun.lock`, `bun.lockb`, `npm-shrinkwrap.json`, or
`package-lock.json`), Claude Code runs a frozen-resolution, `--ignore-scripts`,
60-second-bounded install (`npm ci --ignore-scripts` or `bun install
--frozen-lockfile --ignore-scripts`) into the cached copy at install time,
update time, and at session start on a fresh machine, so the plugin's own
hooks and MCP servers can load their dependencies. A failed or skipped
install never blocks the plugin; a `package.json` with no recognized
lockfile is skipped silently.

We have no equivalent anywhere in the codebase (confirmed by grep -- zero
hits for lockfile names or `--ignore-scripts`/`--frozen-lockfile`). A plugin
that bundles its own npm dependencies installs today with hooks or MCP
servers that fail at runtime on an unresolved `node_modules`, with no
diagnostic pointing at the real cause.

Direction for later: a new phase in the install/update ledger (or a step
inside the existing skills/commands/agents/hooks/mcp five-phase sequence)
that detects `<pluginRoot>/package.json` + a recognized lockfile and runs the
matching frozen, no-lifecycle-scripts install into the staged copy, mirroring
Claude Code's exact lockfile-priority order and timeout. Failure should
degrade (warning-level note), never block the install.

Code seams: `transaction/phase-ledger.ts` (the 5-phase ledger pattern),
`orchestrators/plugin/install.ts` / `update.ts` (ledger composition),
`shared/notify.ts` (a new closed-set reason for a skipped/failed dependency
install).

## DFEN-01: `defaultEnabled` manifest field unsupported

Surfaced 2026-08-13 auditing Claude Code's plugins-reference docs. A
`plugin.json` (or marketplace entry, which takes precedence) can set
`defaultEnabled: false` (requires Claude Code v2.1.154+) so a plugin installs
in a disabled state until the user explicitly turns it on -- intended for
plugins that add cost or scope a user should opt into. Two things override it
when present: an existing `enabledPlugins` setting for the plugin, and a
dependency requirement from another active plugin.

We have no representation of this field anywhere (confirmed by grep). Every
plugin we install is enabled by default with no way for a plugin author to
request otherwise, and no field carries the marketplace-entry override
precedence rule either.

Direction for later: read `defaultEnabled` from the manifest
(marketplace entry wins per Claude's precedence rule) at install time, and
thread it into the same state-write the install ledger already performs for
the `enabled` flag -- this is a small, self-contained resolver + install-ledger
change with no new component-kind or bridge involved.

Code seams: `domain/components/plugin.ts` (schema field), `domain/resolver.ts`
(read + surface the value), `orchestrators/plugin/install.ts` (state write),
`persistence/state-io.ts` (the `enabled` flag this would set the initial
value of).

## AUTOUP-01: autoupdate is a manual-trigger flag, not a background update

Surfaced 2026-08-13 comparing our `marketplace autoupdate`/`noautoupdate`
against Claude Code's own autoupdate model (`code.claude.com/docs/en/
discover-plugins#configure-auto-updates`) and the parallel design pattern
already named in `docs/competitive-analysis/pi-plugins.md` ("Update
discovery, notices, and staged updates" -- `@nklisch/pi-plugins` built a
lease-based background coordinator toward the same end).

Claude Code's real behavior: after a session starts, with a random delay of
up to ten minutes (so the running session keeps using what it loaded at
launch), Claude Code refreshes the marketplace catalog AND updates installed
plugins to their latest versions on disk, unattended -- no command, no
prompt. If anything updated, the user sees a passive notification offering
`/reload-plugins`; otherwise the new versions are just there on next launch.
The default is kind-aware: official Anthropic marketplaces have autoupdate
on by default, third-party and local-dev marketplaces have it off by
default. `DISABLE_AUTOUPDATER` / `FORCE_AUTOUPDATE_PLUGINS=1` let an
operator decouple "update the Claude Code binary" from "update plugins."

Ours is a different mechanism wearing the same name. `marketplace
autoupdate` / `noautoupdate` (`orchestrators/marketplace/autoupdate.ts`)
only flips a per-marketplace boolean in `claude-plugins.json`. That flag is
read in exactly one place (`orchestrators/marketplace/update.ts:508,542,978`)
to decide whether an explicitly user-run `marketplace update <name>` also
cascades into updating that marketplace's installed plugins, or only
refreshes the manifest. Nothing runs on a timer, nothing runs unattended,
and neither `session_start` nor `resources_discover` in `index.ts` triggers
any refresh-and-update sweep -- confirmed by grep, and by reading both
lifecycle handlers directly. The flag governs cascade SCOPE of a manual
command, not automaticity.

Direction for later: a real background sweep is a genuinely new capability,
not a rename of the existing flag. Open design questions before scoping a
plan: (1) a bare `setTimeout` from `session_start` is enough to get
"jittered delay after startup" -- Pi extensions are long-lived JS in the
host process, no special API needed -- but the sweep would then contend for
the SAME `withLockedStateTransaction` lock (`retries: 0`, not re-entrant)
that a concurrently-typed `/claude:plugin` command holds, which Claude
Code's single-process model doesn't have to reason about; (2) NFR-2's
"never propagate past resources_discover/session_start" boundary discipline
would need to extend to whatever fires the background sweep; (3) our
architecture has no "official marketplace" concept to hang a kind-aware
default off of -- the on-by-default / off-by-default split may not port
directly and needs its own decision; (4) the passive
"updated -- run /reload-plugins" notification is close to what `pending`
already renders network-free, but this would be the first NOTIFICATION
that fires with no user-issued command behind it at all.

Code seams: `orchestrators/marketplace/autoupdate.ts` (the existing flag,
kept as the per-marketplace opt-in surface), `orchestrators/marketplace/update.ts`
(the cascade logic to reuse, currently manual-trigger only), `index.ts`
(`session_start` / `resources_discover` -- candidate trigger sites),
`transaction/with-state-guard.ts` (the lock a background sweep would need to
coordinate with foreground commands around), `shared/notify.ts` (a new
notification shape for an update that fired with no command behind it).

## MIGR-01: replace field-level backward-compat migration with a staleness gate

Surfaced 2026-08-13 spiking whether `state.json` and `claude-plugins.json`
still need per-field backward-compat migration now that a desired-state
config file exists to rebuild from, and the project has few enough users
that a forced resync on upgrade is an acceptable cost. Full investigation,
prototype, and requirements: `.claude/skills/spike-findings-pi-claude-marketplace/`
(3 spikes: `installed-record-backcompat-audit` VALIDATED,
`config-file-backcompat-audit` PARTIAL, `force-reinstall-on-version-mismatch`
PARTIAL).

**The finding, in short:** `persistence/migrate.ts` (283 prod / 529 test
LOC -- `state.json` field-fills for `manifestPath`/`marketplaceRoot`,
`resources.*` defaults, `enabled` default) is pure legacy-catchup with
zero overlap with the live install/add write paths, and
`STATE_VALIDATOR.Check()` on the RAW un-migrated JSON already fails on
every shape it exists to heal -- proven against the real, unmodified
validator in `sources/003-force-reinstall-on-version-mismatch/prototype.ts`.
No new version-stamp field is needed; the existing strict schema already
is the staleness detector, for both plugin- and marketplace-level records
in one check. `persistence/migrate-config.ts` (197 prod / 570 test LOC --
first-run `state.json` -> `claude-plugins.json` bootstrap) looks
structurally similar but is NOT free to delete: it is the only thing
stopping "config file absent" from being read as "uninstall everything"
by `reconcile/plan.ts`'s `buildUninstallBucket`. Net estimated impact if
implemented as designed: `migrate.ts` deleted outright; `migrate-config.ts`
deleted and replaced by a small (~10-20 LOC) loud-failure guard for the
one edge case (stale state + absent config) that must notify and refuse
rather than silently wipe or silently auto-migrate; `bridges/agents/marker.ts`'s
legacy marker constant and the scattered D-13 `autoupdate` scrub are
explicitly left alone (both provably inert / out of scope).

Direction for later: the guard's exact `notify()` wording and the recovery
command it should point users at (re-run install per plugin? a
`--rebuild-config-from-disk` escape hatch?) is unresolved -- an open design
question for planning, not answered by the spike.

Code seams: `persistence/migrate.ts` (delete), `persistence/migrate-config.ts`
(delete, replace call site), `persistence/state-io.ts` (`loadState`,
`STATE_SCHEMA.schemaVersion` union simplification), `orchestrators/reconcile/apply.ts`
(`migrateFirstRunConfig` call site, new loud-failure guard).

## PDEP-01: `claude:plugin info` silently drops version-pinned plugin dependencies

Surfaced 2026-08-13 spiking whether Claude Code plugins support declaring
dependencies on other plugins and how this repo handles the field. Full
investigation, live prototype, and requirements:
`.claude/skills/spike-findings-pi-claude-marketplace/references/plugin-dependencies.md`
(2 spikes: `claude-plugin-dependency-spec` VALIDATED,
`pi-cm-dependency-behavior` PARTIAL).

**The finding, in short:** Claude Code's `plugin.json` `dependencies` field
accepts array elements in two shapes -- a bare string (plugin name) or an
object `{name, version, marketplace}` carrying a semver constraint --
confirmed against the official reference docs, not inferred. Upstream
auto-resolves and auto-installs these; this repo intentionally stays
opaque (no auto-resolution -- PI-13/PR-5, a standing scope decision, not
in question here). What IS a real defect: the "manual-install warning"
meant to compensate for the missing auto-resolution does not reliably
reach the user. `claude:plugin install` drops the note per D-19-01;
`claude:plugin list` only reads resolver notes for an `unavailable`
plugin, never an `installable` one; and `claude:plugin info` --
`orchestrators/plugin/info.ts`'s `normalizeDependencies()` -- filters the
`dependencies` array to `typeof d === "string"` only, silently dropping
every object-shaped (version-pinned) entry. Confirmed live against the
real resolver and `info` orchestrator
(`sources/005-pi-cm-dependency-behavior/prototype.ts`): an array of three
shapes (all-strings, mixed, all-objects) renders correctly, partially, and
not at all, respectively -- no crash, pure lost information. Net effect: a
plugin declaring a version-pinned dependency, the shape upstream documents
as the primary use case, is invisible to a pi-claude-marketplace user
through every command surface.

Direction for later: the minimum fix is narrow -- `normalizeDependencies`
should render object-shaped entries too (at minimum `name`, ideally
`name@version`) instead of filtering them out. Separate, still-open
question: whether the PI-13 note should also reappear on `install`/`list`
for an installable plugin, or whether `info` remains the intended sole
surface (in which case only the display fix is needed, but requirements
docs should say "discoverable via `info`" rather than implying a warning
appears at install time).

Code seams: `orchestrators/plugin/info.ts` (`normalizeDependencies`),
`domain/resolver.ts` (`resolveStrict`/`resolveLoose`, the PI-13 note-push
-- shape-agnostic, no change needed), `orchestrators/plugin/install.ts`
(D-19-01 drop site, if install-time surfacing is later decided),
`orchestrators/plugin/list.ts` (`sharedNarrowResolverNotes` scoping, if
list-time surfacing is later decided).

## USRCFG-01: no equivalent to Claude Code's `userConfig` plugin settings

Surfaced 2026-08-13 reviewing `docs/competitive-analysis/` against
`.planning/BACKLOG.md` for coverage gaps, then researching Claude Code's
official `userConfig` spec and `@nklisch/pi-plugins`' implementation of it
directly.

Claude Code's `plugin.json` `userConfig` field lets a plugin declare
settings (`type`: string/number/boolean/directory/file, `title`,
`description`, `required`, `sensitive`, `default`, `min`/`max`, `multiple`)
that Claude Code prompts the user for at enable time, then substitutes as
`${user_config.KEY}` into skill/agent content, MCP/LSP server fields, and
hook commands (exec-form only -- shell-form hook/monitor commands reject the
substitution as of v2.1.207 to block injection; those read
`CLAUDE_PLUGIN_OPTION_<KEY>` from the environment instead). Non-sensitive
values store in `settings.json` under `pluginConfigs[<plugin-id>].options`
(user settings / `--settings` / managed policy only -- project settings are
explicitly excluded); sensitive values go to macOS Keychain or
`~/.claude/.credentials.json` (~2KB, shared with OAuth tokens).

We have no equivalent (confirmed by grep -- zero hits for `userConfig`
anywhere). A plugin declaring it downgrades to `partially-available` today,
treated as an unsupported component-kind field.

Pi itself provides no comparable primitive to build this on -- confirmed
against `@earendil-works/pi-coding-agent`'s docs and shipped types directly,
not inferred. `pi.registerFlag()` is ephemeral CLI-only; the provider
credential system (`interaction.prompt({type: "secret"})`,
`~/.pi/agent/auth.json`) is scoped to model-provider auth and not callable
by an arbitrary extension; `context.store` is scoped to `refreshModels()`'s
catalog cache; and `ctx.ui.input()` has no masked/secret mode. There is no
OS Keychain integration exposed to extensions at all.

`@nklisch/pi-plugins` (`docs/competitive-analysis/pi-plugins.md`) is the one
project in the field that implements `userConfig`, and it proves the shape
of the problem rather than solving it for us: they built their own schema
parser (`src/formats/claude/user-config-reader.ts`), their own masked-input
TUI component (`MaskedInputSurface` / `SensitiveValue`, built on raw
`pi-tui` primitives via `ctx.ui.custom()`, since Pi's own `ctx.ui.input()`
has no masking), and their own SQLite storage for non-sensitive values --
none of it drawn from a Pi-provided `userConfig` API, because none exists.
Their sensitive-value custody is unfinished even so:
`src/infrastructure/secrets/create-platform-secret-store.ts` returns
`createUnavailableSecretStore()` unconditionally on every platform at this
commit -- no Keychain, libsecret, or Credential Manager code shipped, and a
plugin requiring a sensitive value cannot activate on their own
implementation either (diagnostic: `SECRET_CUSTODY_UNAVAILABLE`).

Direction for later: non-sensitive subset first, matching both competitor
reports' own recommendation and the only part `@nklisch/pi-plugins` has
actually gotten working. Read the `userConfig` schema from `plugin.json`,
prompt-and-validate via `ctx.ui.input()`/`confirm()` dialogs at
install/enable time (no schema-driven form exists in Pi; validation is ours
to write), store plaintext values in `state.json` using the existing atomic
per-scope write path, and extend `shared/vars.ts`'s
`${CLAUDE_PLUGIN_DATA}`-style substitution to cover `${user_config.KEY}` /
`CLAUDE_PLUGIN_OPTION_<KEY>`. Explicitly scope out `sensitive: true` (would
require building OS-level secret custody from scratch -- a separate, much
larger piece of work with no Pi primitive and no working prior art to
borrow from, per the competitor's own unfinished attempt).

Code seams: `domain/components/plugin.ts` (`UNSUPPORTED_COMPONENT_FIELDS`
-- `userConfig` currently classified here), `domain/resolver.ts`
(component-kind handling), `shared/vars.ts` (substitution machinery to
extend), `persistence/state-io.ts` (storage location for non-sensitive
values), `orchestrators/plugin/install.ts` / `enable-disable.ts`
(prompt-at-install/enable touchpoints).

## UDISP-01: uninstall deletes plugin data unconditionally, no `--keep-data` escape hatch

Surfaced 2026-08-13 from a competitive-analysis gap review
(`docs/competitive-analysis/pi-plugins.md` recommendation #1: "Uninstall
data disposition... the smallest change here... closes a real data-loss
path") -- initially framed against the competitor's own model (a required
`--keep-data`/`--delete-data` mutex pair), then re-checked directly against
Claude Code's own official behavior
(`code.claude.com/docs/en/plugins-reference`). The two differ, and upstream
is the one worth matching per this project's stated `/claude:plugin`
alignment goal.

**Claude Code's actual behavior:** `claude plugin uninstall <plugin>
[--scope] [--keep-data] [--prune] [-y]`. There is no `--delete-data` flag.
Default is delete, but only when the plugin has no other scope installation
to fall back on: "By default, uninstalling from the last remaining scope
also deletes the plugin's `${CLAUDE_PLUGIN_DATA}` directory. Use
`--keep-data` to preserve it." Deletion is scope-aware and silent -- no
confirmation prompt for data specifically (`-y`/`--yes` gates a different,
unrelated `--prune` dependency-removal confirmation).

**Our behavior today:** `orchestrators/plugin/uninstall.ts:635` -- `await
rm(dataDir, { recursive: true, force: true })` -- runs unconditionally on
every uninstall, with no flag, no scope check, and no way to opt out.
Confirmed by direct read, not inferred. The contents of
`${CLAUDE_PLUGIN_DATA}` are lost on uninstall even when the plugin remains
installed in the other scope.

**Two call sites, one fix needed in both:** `uninstallPlugin()`
(`orchestrators/plugin/uninstall.ts`) is called from the interactive
`/claude:plugin uninstall` command AND from
`orchestrators/reconcile/apply.ts`'s `applyPluginUninstalls()`, which fires
non-interactively from `resources_discover`/`session_start` whenever a
plugin is dropped from `claude-plugins.json`. Both paths need the same
scope-aware rule; the reconcile path was never going to be interactive
under Claude Code's own model either (their default is a scope-state
check, not a prompt), so no special-casing is needed between the two call
sites.

Direction for later: add an optional `--keep-data` flag to the interactive
command -- no `--delete-data`, matching upstream exactly; inventing one
would add a flag Claude Code doesn't have. Before deleting, check whether
the plugin is still installed in the other scope using the existing
`otherScope()` + `locationsFor()` + `loadState()` seam
(`orchestrators/plugin/shared.ts:216`, already reused by
`reinstall.ts`/`update.ts`/`list.ts` for the identical "is this plugin
present in the other scope" question -- "ONE extra `loadState` of the
other scope" is the documented cost there). Delete only when this is the
last remaining scope AND `--keep-data` was not passed; the
reconcile-triggered path applies the identical rule with no flag to
consult, since there is no command line to put one on. A GC sweep for
orphaned `--keep-data`-retained data directories is out of scope here --
keeping is opt-in under this model, not a default-driven accumulation
path, so it is a reasonable separate follow-on item, not a blocker.

Code seams: `orchestrators/plugin/uninstall.ts` (the unconditional `rm()`
call, line 635), `orchestrators/plugin/shared.ts` (`otherScope()`, the
existing cross-scope-presence pattern to reuse), `orchestrators/reconcile/apply.ts`
(`applyPluginUninstalls()`, the non-interactive call site),
`edge/handlers/plugin/uninstall.ts` (new `--keep-data` flag parsing),
`edge/args.ts` / `edge/flag-catalog.ts` (flag registration, drift-gated).

## SKFM-01: repair single-line frontmatter scalars instead of degrading the whole skill

Surfaced 2026-08-13 from a competitive-analysis gap review
(`docs/competitive-analysis/asermax-pi-cc-plugins.md`, README.md
consolidated recommendation #4: "their headline feature without their
defect"). Scoped deliberately narrower than the source report's own
implementation, per its own caution.

**The problem:** Claude Code's `SKILL.md` frontmatter parser is lenient;
Pi's is strict. A `description:` line containing an unquoted colon --
`description: Use this: when reviewing pull requests` -- parses fine under
Claude Code and is fatal under Pi's parser.

**Our behavior today:** `bridges/skills/stage.ts`'s `PARSE-01` block
(~line 280) tries `parseFrontmatter(content)`; on throw it calls
`synthesizeUnparseableSkill()` (`bridges/skills/frontmatter-degrade.ts:46`),
which replaces the ENTIRE frontmatter block with a generated name, the
fixed placeholder string `"Source frontmatter could not be parsed."`, and
`disable-model-invocation: true`. The skill still installs, but the model
never sees its real description -- confirmed by direct read of the
`PARSE-01` catch arm, not inferred.

**What `@asermax/pi-cc-plugins` got right, and where their build breaks:**
they're the only one of the four competitors that tries to repair loose
frontmatter rather than degrade or route around it -- a real, useful
instinct. Their `sanitizeFrontmatterLines` walks the block line by line and
JSON-stringify-quotes any value that isn't already boolean/null/number.
Verified by executing their own exported `sanitizeSkillMarkdown`:
`description: Use this: when reviewing` correctly becomes
`description: "Use this: when reviewing"`, but `tags: [a, b]` becomes the
literal string `tags: "[a, b]"` (a sequence corrupted into a string), and a
`description:` spanning two lines gets its first line quoted while the
indented continuation line is left orphaned, so a document that Pi
originally accepted no longer parses at all. Their line-by-line rule
cannot tell a single-line scalar from the start of a multi-line one.

Direction for later: repair ONLY single-line inline scalars -- the exact
case that fails today and the only case verified safe to rewrite. Two
existing pieces of machinery in `bridges/skills/frontmatter-degrade.ts`
already do most of the work, just for a different call site: the private
`emitSafeDoubleQuotedScalar()` helper (line 146) already implements the
correct escaping (newlines collapse to spaces, `\` escaped before `"`) and
is already proven via `setDescriptionScalar()`'s SKILL-03 full-node-span
replacement; `descriptionValueEnd()` already distinguishes a single-line
value from a multi-line one by checking whether the following line is
indented. The new work is a pre-parse repair step inserted into
`stage.ts`'s `PARSE-01` catch arm (before falling through to
`synthesizeUnparseableSkill`): detect a single top-level `key: value` line
whose value is unquoted and contains a YAML-significant character, re-emit
it through the same safe-quoting logic, and retry `parseFrontmatter`. Any
line that is a sequence (`[...]`), a mapping (`{...}`), or has an indented
continuation line MUST fall straight through to the existing
`synthesizeUnparseableSkill` degrade unchanged -- reproducing either of
those is exactly the asermax defect this item exists to avoid. A repair
that still fails to parse must never replace the working degrade path; a
synthesized block that parses beats a repair attempt that does not.

Code seams: `bridges/skills/stage.ts` (`PARSE-01` catch arm, ~line 280 --
the insertion point), `bridges/skills/frontmatter-degrade.ts`
(`emitSafeDoubleQuotedScalar` to reuse/export, `descriptionValueEnd`'s
single-vs-multi-line detection pattern to reuse, `synthesizeUnparseableSkill`
as the required fallback), `bridges/skills/rewrite-frontmatter.ts` (the
sibling single-node-rewrite pattern this follows -- rewrite exactly one
node span, leave every other key byte-identical).

## MCPSRC-01: MCP collision slot list has drifted behind pi-mcp-adapter

Surfaced 2026-08-13 from the upstream release review covering
2026-08-05..2026-08-12 (pi 0.84.0-0.84.1, pi-subagents 0.41.0-0.47.1,
pi-mcp-adapter 2.21.0-2.23.0). The agent-plugin half is in-window; the
`.agents` half is older drift the same review turned up.

**The problem:** `MCP_COLLISION_SLOTS(cwd)`
(`bridges/mcp/collision-slots.ts:29`) returns four frozen paths and its
doc comment calls them "the four pi-mcp-adapter configuration paths".
Read against pi-mcp-adapter 2.23.0 `config.ts::getConfigSources()`, the
adapter reads six, plus a seventh source added in the review window:

```text
~/.config/mcp/mcp.json          checked
~/.agents/mcp.json              NOT CHECKED  (added 2.13.0, 2026-07-25)
~/.agents/mcp/mcp.json          NOT CHECKED  (added 2.13.0)
<agentDir>/mcp.json             checked
<cwd>/.mcp.json                 checked
<cwd>/.pi/mcp.json              checked
settings.agentPluginPaths ->    NOT CHECKED  (added 2.21.0, 2026-08-06)
  <plugin>/mcp.json
```

Verified by reading `config.ts` at tag v2.23.0, not from the changelog
prose. The `.agents` pair traces to upstream commit `084c56c`
("feat: discover global .agents MCP configs"), first tagged v2.13.0.

**Why the two halves differ in severity:** the `.agents` slots hold
VERBATIM server names -- the same namespace our bridge writes into, since
`bridges/mcp/stage.ts:220` takes `Object.keys(servers)` straight from the
Claude plugin with no prefixing. A user with `~/.agents/mcp.json`
declaring `github` who installs a Claude plugin also declaring `github`
gets no MC-4/RN-5 collision warning at all, and precedence silently
decides which one the adapter actually connects. That is the realistic
failure. The agent-plugin source is narrower: those names are normalized
to `<plugin>__<server>` by `formatAgentPluginServerName`
(`agent-plugin-loader.ts:250`), so colliding needs a Claude plugin to
declare a server literally named `foo__bar`. Real, but unlikely.

**Which side wins on collision:** `loadMcpConfig` ends with
`mergeConfigs(pluginConfig, config)`, and `mergeConfigs(base, next)` lets
`next` win -- so standard config, including the `<scopeRoot>/mcp.json` we
write, beats an agent-plugin entry. On an undetected collision OUR server
shadows the user's, which is the worse direction: the user's own
declaration disappears with no diagnostic from either side.

Direction for later: extend the slot tuple with the two `.agents` paths
and re-word the MC-4/RN-5 contract comment away from "four". The
agent-plugin source is a separate and harder question -- its paths are
not fixed, they come from `settings.agentPluginPaths` inside whichever
config slot declares it, so enumerating them means reading `settings`
across slots first and then resolving each plugin's own `mcp.json`. Worth
deciding whether that is in scope for collision detection at all, or
whether MC-4 should explicitly document agent-plugin servers as out of
contract. Do NOT silently widen the tuple without also updating the user
contract text -- the array is frozen and snapshot-tested precisely so the
slot order and membership are a deliberate, reviewed change.

Code seams: `bridges/mcp/collision-slots.ts` (`MCP_COLLISION_SLOTS`, the
frozen tuple and its doc comment; `loadEffectiveServerNames`'s
first-declarer-wins walk), `bridges/mcp/stage.ts`
(`assertNoMcpCollisions` call site, ~line 224), plus the snapshot test
that locks the slot order, and the RN-5 user-contract wording wherever it
enumerates the slots.

## ENVDOC-01: `docs/env-vars.md` has drifted behind two upstreams

Surfaced 2026-08-13 from the same upstream release review that produced
[MCPSRC-01]. Two independent staleness points, both in `docs/env-vars.md`,
both small enough for one `/gsd-quick` pass over the file.

**Point 1 -- the pi-mcp-adapter anchor is 13 minor versions old.** The
"MCP runtime env inheritance" subsection (`docs/env-vars.md:151`) opens
with "behavior verified against 2.10.0". Current upstream is 2.23.0. The
CLAIM is still correct: `server-manager.ts::resolveEnv` at v2.23.0 still
builds `{...process.env, ...interpolated(config.env)}` for the path our
entries take, so nothing in the divergence text is wrong. What is missing
is that the signature became
`resolveEnv(env, serverName, literalEnv = false)` in 2.21.0, adding an
opt-out the doc does not mention. Re-anchor the version and add one
sentence for the third parameter. The behavioral question that opt-out
raises is filed separately as [ENVLIT-01] -- keep this one to doc accuracy.

**Point 2 -- `AI_AGENT=pi` has no row in the overview matrix.** pi 0.84.0
added it (#7493). It is set as `process.env.AI_AGENT = "pi"` at the top of
`packages/coding-agent/src/cli.ts` and `rpc-entry.ts` -- on the Pi process
itself, at startup, before any extension code runs. It therefore reaches
every surface the matrix documents purely by inheritance, with no work
from us: bash children, both hook lanes (both spread `...process.env`),
and MCP servers (pi-mcp-adapter's `resolveEnv` seeds from
`{...process.env}`). No Claude Code equivalent exists, so it belongs in
the matrix the same way `CLAUDE_SESSION_ID` and
`PI_CLAUDE_MARKETPLACE_PATH` do (rows at `docs/env-vars.md:29-30`), with
`--` in the Claude Code column.

One real difference from those two pi-only rows, worth getting right in
the footnote rather than copying theirs verbatim: `AI_AGENT` is set at
process start, so it carries NO spawn-order caveat. The `‡` footnote
exists because our session vars are set in the `session_start` handler and
so miss servers spawned before it runs. `AI_AGENT` cannot miss anything.

Code seams: `docs/env-vars.md` (overview matrix at lines 19-31 and its
footnote list at 33-35; per-surface tables; the "MCP runtime env
inheritance" subsection at 151). Documentation only -- no extension source
changes, since we neither set nor consume `AI_AGENT`.

## ENVLIT-01: `literalEnv` opt-out is unevaluated for MCP env fidelity

Surfaced 2026-08-13 from the upstream release review. The doc-accuracy
half of this is [ENVDOC-01]; this item is the behavioral question, which
is genuinely open and needs a fact we do not currently have.

**What upstream added:** pi-mcp-adapter 2.21.0 added
`literalEnv?: boolean` to `ServerEntry`, consumed in
`server-manager.ts::resolveEnv` as an early return:

```text
if (literalEnv) return env ? { ...resolved, ...env } : resolved;
```

It skips `resolveCommandSecretsRecord` entirely while still inheriting
`process.env`. Upstream uses it for Agent Plugin env rules, where declared
values are already fully resolved and must not be re-interpolated.

**Why it might matter to us:** we never set it, so every `env` value our
MCP bridge writes takes the interpolating path -- `${VAR}` and `$env:VAR`
are expanded, and an unknown variable resolves to the empty string, not to
the literal text. A Claude plugin author who writes a literal `$` or a
`${...}` that is NOT meant as host interpolation therefore gets a
different value under Pi than the one they wrote.

**The fact we are missing:** whether Claude Code interpolates `${VAR}` in
stdio MCP server `env` values at all. `docs/env-vars.md`'s existing claim
that our behavior "matches Claude Code" is about which vars Claude Code
INJECTS into the spawn env, not about whether it EXPANDS declared values;
the interpolation half was never verified. Establish that first, because
it decides the whole item:

- if Claude Code also interpolates, our pass-through is already correct
  and `literalEnv` should stay unused -- close this as verified-no-change
- if Claude Code treats declared `env` values as literals, we have a real
  and undocumented MENV divergence, and `literalEnv: true` is the exact
  lever that closes it

Do not set `literalEnv` speculatively. Turning it on would silently stop
expanding `${CLAUDE_PLUGIN_ROOT}`-style values that plugins may already
depend on, which would be a worse regression than the defect it targets --
check how our own `bridges/mcp/substitute.ts` install-time substitution
interacts before touching the runtime path, since the two layers both
rewrite the same values at different times.

Code seams: `bridges/mcp/substitute.ts` (install-time `${CLAUDE_*}`
substitution -- the layer that runs BEFORE pi-mcp-adapter sees the value),
`bridges/mcp/stage.ts` (where the `env` map is composed and where a
`literalEnv` field would be written), `docs/env-vars.md` ("MCP runtime env
inheritance" and the MCP env column of the overview matrix).

## SRCP-01/02: git-subdir url expansion (SRCP-01 withdrawn)

Surfaced by a GitLab-parity spike (2026-08-14, `.planning/spikes/008-gitlab-bare-source-parsing`),
triggered by an upstream Claude Code changelog entry ("bare gitlab.com repo
URLs, including nested subgroups, now clone like github.com URLs"). Two
related gaps in `domain/source.ts`'s `parsePluginSource`:

- SRCP-01 (WITHDRAWN 2026-08-14 -- see the correction below):
  bare host-prefixed strings (no `https://` scheme) are unrecognized
  for ANY host, including `github.com` itself -- `gitlab.com/group/project`,
  `gitlab.com/group/subgroup/project`, and `github.com/owner/repo` all fall
  through to `{kind: "unknown", reason: "non-relative string source ...
  cannot be classified"}`. Only the already-assumed-GitHub, host-less
  `owner/repo` shorthand (exactly one slash, D-76-04) is recognized.
  Full-scheme URLs (`https://gitlab.com/...`) already work today regardless
  of nested-subgroup depth -- no fix needed there, since the generic `url`
  source kind treats the whole path as opaque.
- SRCP-02: the `git-subdir` object source's `url` field is taken as a literal
  string with no shorthand expansion (`gitSubdirObjectSource`,
  `domain/source.ts`) -- confirmed against upstream's own git-subdir schema
  (`https://code.claude.com/docs/en/plugin-marketplaces.md#git-subdirectories`),
  which documents `url` accepting the bare `owner/repo` GitHub shorthand
  alongside the separate `path` field. Feeding our parser
  `{"source": "git-subdir", "url": "owner/repo", "path": "..."}` today stores
  `"owner/repo"` verbatim as `GitSubdirSource.url`, which is not a valid git
  remote and would fail at actual clone time.

**SRCP-01 is withdrawn: upstream rejects this form too.** Probed 2026-08-14
against the installed `claude` CLI v2.1.232 -- the shipped binary, not our
reimplementation of it. `claude plugin marketplace add
"gitlab.com/acolomba/pi-cm-test-marketplace"` is rejected outright:
`not a valid GitHub owner/repo shorthand. For a git repo, use the full
https:// clone URL from your host...`, and identically so with a `.git`
suffix appended. The host-less `acolomba/pi-cm-test-marketplace` shorthand
still routes to GitHub (`git@github.com:acolomba/pi-cm-test-marketplace.git`),
never to GitLab -- the same already-assumed-GitHub rule we implement as
D-76-04. Meanwhile `https://gitlab.com/acolomba/nonexistent-repo` and
`https://gitlab.com/somegroup/somesubgroup/nonexistent-repo` both passed
source-format validation and reached a real clone attempt.

Read against that behavior, the changelog line this item was filed from ("bare
`gitlab.com` repo URLs, including nested subgroups, now clone like `github.com`
URLs") describes the full `https://gitlab.com/...` form getting
GitHub-URL-equivalent treatment -- nested-subgroup-safe parsing and host-aware
auth hints -- not a new scheme-less input syntax. Our `{kind: "unknown"}` for
`gitlab.com/group/project` is therefore agreement with upstream, not a gap
behind it, and teaching `parsePluginSource` that form would leave us accepting
input upstream refuses: a parity regression, not a parity fix. The clone
attempt above also named `gitlab.com` in its auth-failure message, which
corroborates the other half of the same changelog line -- that half belongs to
the git-host auth-failure hint item immediately below (spike 009) and is
unaffected here. Spike 008's other finding stands confirmed: full-scheme GitLab
URLs, nested subgroups included, already resolve today with no change.

Direction for later, SRCP-02 only: expand a host-less `owner/repo` value in the
`git-subdir` object source's `url` field to its full GitHub clone URL -- the
same already-assumed-GitHub rule D-76-04 applies to string sources -- so what
lands in `GitSubdirSource.url` is a usable git remote. Do not pair it with a
scheme-less host-prefixed recognition branch in `parsePluginSource`: upstream
rejects that input form itself, so accepting it would put us ahead of upstream
rather than level with it. This is a `domain/source.ts`-only change; no
bridge/orchestrator/NFR-10/NFR-5 impact (confirmed by spike 008).

## GAUTH-01: git host auth-failure hint coverage

Surfaced by the same GitLab-parity spike (2026-08-14,
`.planning/spikes/009-git-host-auth-hint-coverage`), prompted by the same
upstream changelog line ("...and clone auth-failure hints name your actual
git host"). The host-named diagnostic `NO_PROVIDER_CAUSE(host)`
(`orchestrators/auth-host.ts`) exists and is already host-generic, but is
wired into exactly one of five auth-relevant call sites -- `marketplace
update`'s url-source refresh path (`orchestrators/marketplace/update.ts:394`).
`plugin install`, `plugin reinstall`, `plugin fetch`, and `marketplace add`
all still surface only the bare, host-less `"authentication required"`
token on a no-provider host. Pure code, no external dependency -- wire the
same cause line into the other four call sites.

(GAUTH-02, the sibling item from the same spike -- registering a GitLab
Device Flow auth provider -- has already shipped: quick task 260814-a7m
added `GITLAB_PROVIDER` to `domain/auth-registry.ts`.)

## HKDIR-01: factory-time `_shared` mkdir is gated cross-scope, not per-scope

Surfaced 2026-08-14 while reviewing PR #127 (project-scope SessionStart
hooks never dispatching). The PR fixes the dispatch defect and its own
mkdir gate is correct; this item is the adjacent pre-existing one it
leaves in place.

**The defect.** `registerHooksBridge` walks both scopes and, per scope,
conditionally creates that scope's `_shared` data dir so a `SessionStart`
hook can rely on `CLAUDE_ENV_FILE`'s directory existing
(`bridges/hooks/event-router.ts`, the `for (const { loc } of hydrated)`
loop). The gate reads:

```ts
if ((routingTable.get("SessionStart") ?? []).length > 0) {
  await ensureSharedDataDir(loc);
}
```

`routingTable` is a single cross-scope map. So the presence of ANY
`SessionStart` entry, in EITHER scope, satisfies the gate for BOTH
iterations. A user-scope-only hooks plugin therefore provokes a project
`_shared` mkdir as well -- at `locationsFor("project", opts.cwd)`, where
`opts.cwd` is the factory's `homedir()`. In production that lands a
`~/.pi/pi-claude-marketplace/data/_shared` tree nobody asked for; run the
factory with any other cwd and it lands there instead. Verified by probe:
booting the bridge with only a user-scope `SessionStart` plugin creates
`.pi/` under the boot cwd.

**Why it is only cosmetic today.** The directory is empty, `mkdir` is
recursive and idempotent, and `assertPathInside` still contains the write,
so nothing escapes containment and nothing breaks. It is a WR-05
("no files on a clean reconcile") violation in spirit rather than a
functional bug -- which is also why it survived this long.

**Fix shape.** One line, matching what PR #127 already does on the
session_start path:

```ts
if ((routingTable.get("SessionStart") ?? []).some((e) => e.scope === loc.scope)) {
```

Worth a regression test in the shape of `HOOK-E2E-03`, which pins the same
invariant for the lazy-hydrate path: boot with a user-scope-only
`SessionStart` plugin, assert the OTHER scope's root stays empty.

Code seams: `bridges/hooks/event-router.ts` (the factory hydrate loop and
`ensureSharedDataDir`), `tests/integration/hooks-dispatch-end-to-end.test.ts`.

## ~~HKNC-01: session_start lazy-hydrate `?? []` fallback is unreachable~~ -- CLOSED

Closed 2026-08-17 by the routingTable encapsulation, which removed both
`?? []` call sites as a side effect rather than as a targeted fix. The
`routingTable` cell is module-private now, so the two reads go through
`getRoutingBucket("SessionStart")` and the nullish arms this item named no
longer exist. The fix note asked for both sites together; both went.

NOT closed by the same change: the single `?? []` inside `getRoutingBucket`
itself, which predates this item and has four other callers in dispatch.ts
and settle.ts. Whether that arm is covered was not measured. And HKDIR-01,
which merely QUOTED the same idiom, is untouched -- its defect is the
cross-scope gate, and rewriting the expression preserved that semantics
exactly.

Original report follows.

Surfaced 2026-08-14 measuring branch coverage on PR #127. Cosmetic; the
only cost is a branch that can never go green.

**The defect.** The lazy project hydrate rebuilds the routing tables and
then reads the bucket back through a nullish fallback
(`bridges/hooks/event-router.ts`, the `session_start` wrapper):

```ts
rebuildRoutingTables();
if ((routingTable.get("SessionStart") ?? []).some((e) => e.scope === "project")) {
```

`rebuildRoutingTables` pre-seeds a bucket for every `BUCKET_A_EVENTS`
member before it returns, and `SessionStart` is the first of them. So one
line after that call `routingTable.get("SessionStart")` cannot be
`undefined`, and the `?? []` arm is dead by construction. Branch coverage
confirms it: `BRDA` for that line reports `taken=0` on the fallback arm
across the whole unit + integration suite, while both arms of the `if`
itself are exercised (`HOOK-E2E-02` true, `HOOK-E2E-03` false).

**Fix shape.** Drop the `??` and read the bucket directly, or keep it and
accept a permanently-uncovered branch. No test can close this one -- it is
a code change or nothing.

Note the same `?? []` idiom appears on the factory-side gate quoted in
HKDIR-01, where it is equally unreachable for the same reason; fix both
together or neither.

Code seams: `bridges/hooks/event-router.ts` (the `session_start` wrapper),
`domain/components/hook-events.ts` (`BUCKET_A_EVENTS`).

<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
