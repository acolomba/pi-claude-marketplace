---
phase: 260816-qov-make-fallow-a-full-uniform-static-analys
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .fallowrc.json
  - package.json
  - .pre-commit-config.yaml
  - .github/workflows/lint.yml
  - tests/live-uat/manifest-absence-canary.mjs
  - tests/live-uat/stop-canary.mjs
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/architecture/import-boundaries.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/helpers/git-mock.ts
  - .planning/codebase/ARCHITECTURE.md
  - .planning/codebase/STACK.md
  - .planning/codebase/CONVENTIONS.md
  - .planning/BACKLOG.md
  - .planning/STATE.md
  - CHANGELOG.md
autonomous: true
requirements: [FLOW-04, FLOW-01, NFR-5, NFR-6, IL-2]

estimate:
  tokens: 520000
  raw_tokens: 260000
  tasks: 9
  confidence: low

must_haves:
  truths:
    - "`npm run fallow` runs three explicit invocations -- `fallow dead-code --fail-on-issues`, `fallow health --fail-on-issues`, `fallow dupes --fail-on-issues` -- and each one's exit code has been observed empirically, not inferred from the flag name"
    - "The identical `npm run fallow` command runs in `npm run check`, in the `.pre-commit-config.yaml` `npm-fallow` hook, and in `.github/workflows/lint.yml` -- no `--changed-since`, no `audit` subcommand, no delta scoping anywhere"
    - "`.fallowrc.json` carries no categorical exclusion: `production: false`, `boundaries.coverage.requireAllFiles: true`, and every suppression in the tree is an individually justified marker or a `health.thresholdOverrides` / `duplicates.ignoredClones` entry with a written reason"
    - "A cross-zone import, a two-file circular dependency, and an over-threshold function each make `npm run fallow` exit 1 when planted, and the gate returns to exit 0 when reverted"
    - "`npm run check` is fully green end to end"
    - "BACKLOG FLOW-04 is closed and a new backlog item records the CRAP / real-coverage findings"
  artifacts:
    - .fallowrc.json
    - package.json
    - .github/workflows/lint.yml
    - .pre-commit-config.yaml
    - CHANGELOG.md
  key_links:
    - "Sequence is load-bearing: each analysis class must reach zero findings BEFORE its `--fail-on-issues` invocation joins `npm run fallow`, or the very next commit fails its own pre-commit hook on inherited findings"
    - "`duplicates.threshold` can only be chosen after the Task 5-6 consolidation, because the achievable percentage is unknown until then"
    - "`boundaries.coverage.requireAllFiles` turns the two unzoned `index.ts` files into findings; zoning them exposes the `discover-names.ts` -> `bridges/index.ts` edge, so the zone work and that import fix must land together"
    - "Architecture tests may only be deleted after fallow is empirically proven to fail on the same planted violation -- a config that merely looks equivalent is not proof"
---

<objective>
Turn `fallow` from a partial, delta-scoped advisory signal into a full, uniform, whole-repo static-analysis gate with zero categorical exclusions, and make the codebase compliant with it.

Purpose: today's gate is three overlapping half-measures. `npm run fallow` passes `--boundary-violations --circular-deps --re-export-cycles`, which are documented as "Only report X" FILTERS -- so the local gate checks nothing else, including the dead code it names in its own subcommand. CI runs a different subcommand (`fallow audit`) over a different scope (`--changed-since`) with a different verdict (new-only). `production: true` drops tests from the reachability graph and manufactures roughly 283 false findings, which is why the one existing suppression in the tree exists at all. A green local run does not imply a green pull request, and a green pull request does not imply a clean codebase. This closes BACKLOG FLOW-04 and FLOW-01.

Output: a rewritten `.fallowrc.json` with zone coverage and forbidden-call policy, a compliant codebase (dead code, complexity, and duplication all at zero findings), one `npm run fallow` command running identically in three places, the architecture tests fallow provably replaced removed, and updated docs.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/codebase/ARCHITECTURE.md
@.planning/codebase/CONVENTIONS.md
@.claude/rules/typescript-comments.md
@.claude/skills/spike-findings-pi-claude-marketplace/references/fallow-adoption.md
</context>

<preflight_findings>

## Working tree

All work happens in the existing worktree at
`/Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate`, branch
`features/fallow-full-gate`, already 7 commits ahead of `origin/main` and already carrying
the fast-forward merge of `features/hooks-cycle-removal`. Do not create a branch, do not
create a worktree, do not rebase, do not reset. Never commit to `main`.

`fallow` v3.16.0 is installed at `node_modules/.bin/fallow`. Use that path directly in
verification commands; do not use `npx fallow@latest`.

## Verified CLI semantics (measured in this worktree)

`--circular-deps`, `--re-export-cycles`, and `--boundary-violations` are each documented by
`fallow dead-code --help` as "Only report X". They are filters, not additions. Proof:

| Command | `total_issues` |
|---|---|
| `fallow dead-code --no-production` | 3 |
| `fallow dead-code --no-production --circular-deps --re-export-cycles` | 0 |

The current `npm run fallow` script therefore checks boundary violations and cycles and
nothing else. Bare `fallow dead-code` reports every class in one summary object
(`unused_files`, `unused_exports`, `unused_types`, `circular_dependencies`,
`re_export_cycles`, `boundary_violations`, `boundary_coverage_violations`,
`boundary_call_violations`, `stale_suppressions`, and more), which is why the gate wants
the bare form.

## Measured baseline (this worktree, before any change)

**Dead code**, `fallow dead-code --no-production`: `total_issues: 3`.

| Finding | Location |
|---|---|
| unused file | `tests/live-uat/manifest-absence-canary.mjs` |
| unused file | `tests/live-uat/stop-canary.mjs` |
| stale suppression | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:853` |

Circular dependencies: 0. Re-export cycles: 0. Boundary violations: 0.

**Health**, findings with `cyclomatic > 20` or `cognitive > 15` (which is what
`maxCrap: 0` leaves behind): 36 total -- 28 in `extensions/`, 8 in `tests/`. Full list is
inlined into Tasks 2, 3, and 4.

**Duplication**, `fallow dupes --no-production`: 66 clone groups, 139 instances, 2240
duplicated lines, `duplication_percentage: 3.6152356358941256`, 59 of 193 files affected.
Full group list is inlined into Tasks 5 and 6.

**Unzoned files** (relevant once `boundaries.coverage.requireAllFiles` is on): exactly
three non-test files -- `extensions/pi-claude-marketplace/index.ts`,
`extensions/pi-claude-marketplace/bridges/index.ts`, and `eslint.config.js`.

## Config schema shapes (from `fallow config-schema`, v3.16.0)

```
boundaries.coverage      { requireAllFiles?: boolean, allowUnmatched?: string[] }
boundaries.calls         { forbidden?: ForbiddenCallRule[] }
ForbiddenCallRule        { from: string, callee: string | string[] }   // both required
BoundaryZone             { name: string, patterns?: string[], autoDiscover?: string[], root?: string|null }
health                   { maxCyclomatic?: u16=20, maxCognitive?: u16=15, maxCrap?: f64=30,
                           maxUnitSize?: u32=60, ignore?: string[], thresholdOverrides?: [...] }
HealthThresholdOverride  { files: string[] (required), functions?: string[], maxCyclomatic?,
                           maxCognitive?, maxCrap?, maxUnitSize?, reason?: string }
duplicates               { threshold?: f64=0 (0 = NO LIMIT), ignoredClones?: string[], ... }
duplicates.ignoredClones entry format: `dup:<fingerprint>:<instance_count>`, e.g. `dup:334fd290:2`
```

`maxCrap: 0` is documented as "disable CRAP enforcement entirely: no findings, nothing
counts above threshold". Forbidden-call `callee` matching is segment-aware, not substring:
`child_process.*` matches `child_process.exec` and named imports from `child_process` /
`node:child_process`; `fetch` matches only `fetch`; a leading `*.` suffix-matches any
object receiver.

## Facts that shape specific tasks

- `extensions/pi-claude-marketplace/bridges/index.ts` is an aggregate barrel that
  `export *`s all five per-kind barrels. Its only production consumer is
  `orchestrators/plugin/discover-names.ts:11-15`, which pulls
  `discoverPluginAgents` / `discoverPluginCommands` / `discoverPluginSkills` from it.
  `tests/fixtures/bad-imports/edge-imports-bridges.ts` also imports it as the target of the
  ESLint boundary canary in `tests/architecture/import-boundaries.test.ts`, and fallow
  currently treats that fixture as reachable (it is not reported unused), so the barrel
  stays alive even after `discover-names.ts` stops importing it.
- `extensions/pi-claude-marketplace/index.ts` imports from `bridges/hooks/index.ts`,
  `edge/register.ts`, four `orchestrators/` modules, `persistence/locations.ts`,
  `platform/pi-api.ts`, and four `shared/` modules. Its zone rule needs exactly those six
  target zones.
- The stale suppression at `event-router.ts:845-853` is preceded by an eight-line comment
  whose stated justification is `production: true`. Flipping `production` to `false`
  invalidates the comment as well as the marker; both go.
- `tests/architecture/import-boundaries.test.ts` holds six tests. One pins the
  `import-x/no-cycle` rule and its `import-x/extensions` setting -- fallow does not cover
  either. Two are directed-edge grep gates over individual ledger FILES inside the single
  `orchestrators` zone -- fallow zones are directory-scoped and cannot express them as
  written. Three pin the ESLint `no-restricted-paths` zone matrix.
- `tests/architecture/no-orchestrator-network.test.ts` holds one test asserting that
  `orchestrators/plugin/{install,list,uninstall}.ts` carry no `gitOps` surface. Ten other
  `orchestrators/` files legitimately import `platform/git.ts`, so the existing broad
  `orchestrators` zone cannot express NFR-5 as an import rule without a zone split.
- ESLint's `sonarjs/cognitive-complexity` is set to 15 and passes today on functions fallow
  reports at cognitive 49. The two tools compute the metric differently. Do not expect
  their numbers to agree, and do not treat a green `npm run lint` as evidence about a
  fallow health finding.
- `CHANGELOG.md` has no `[Unreleased]` section; the top entry is `## [0.15.0]`.

</preflight_findings>

<tasks>

<task type="tracer">
  <name>Task 1: Config foundation, dead-code compliance, and an unfiltered dead-code gate</name>
  <files>
    .fallowrc.json,
    package.json,
    tests/live-uat/manifest-absence-canary.mjs,
    tests/live-uat/stop-canary.mjs,
    extensions/pi-claude-marketplace/bridges/hooks/event-router.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  </files>
  <read_first>
    .fallowrc.json,
    extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts,
    extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (lines 840-860),
    extensions/pi-claude-marketplace/index.ts (import block only)
  </read_first>
  <action>
This is the tracer slice: it moves one analysis class -- dead code and boundaries -- all the
way from config to compliant codebase to enforcing gate, proving the whole shape before the
larger health and duplication work follows the same path.

Edit `.fallowrc.json`:

Per D1a, set `production` to `false`. Per D1b, add a `health` block with `maxCyclomatic: 20`,
`maxCognitive: 15`, `maxUnitSize: 60`, and `maxCrap: 0`. Record in a sibling planning note or
the commit body why CRAP is off: complexity is gated directly, coverage is gated by
SonarCloud, and CRAP's only data source is unreliable for this project. `maxUnitSize` is
descriptive only and produces no findings on its own; it is present so the profile stays
calibrated.

Per D1c, add two zones so no file under `extensions/` is unzoned. Name the first zone `entry`
covering `extensions/pi-claude-marketplace/index.ts`, and the second `bridges-barrel`
covering `extensions/pi-claude-marketplace/bridges/index.ts`. Prefer exact literal paths over
wildcards in `patterns`: fallow's `*` was observed crossing directory separators during
measurement, so a pattern that looks file-scoped may silently swallow a subtree. Whichever
form you write, prove the membership empirically before moving on -- see `<verify>`.

Add the matching rules. `entry` allows exactly `edge`, `orchestrators`, `bridges-hooks`,
`persistence`, `platform`, `shared` -- that is the observed import set of `index.ts`, and
`bridges-hooks` is on it because the factory registers the hooks bridge event listeners, as
ARCHITECTURE.md documents. `bridges-barrel` allows exactly the five `bridges-*` zones. Do NOT
add `bridges-barrel` to any other zone's allow list: the barrel re-exports across all five
bridge kinds, so any zone permitted to import it gains a laundering route around the
no-cross-bridge-imports rule.

Per D1d, add `boundaries.coverage` with `requireAllFiles: true` and an `allowUnmatched` list
covering `eslint.config.js` and `tests/**`. Those two are unmatched by design, not by
oversight.

Per D4b, repoint `orchestrators/plugin/discover-names.ts` so it imports
`discoverPluginAgents`, `discoverPluginCommands`, and `discoverPluginSkills` from the three
per-kind barrels (`../../bridges/agents/index.ts`, `../../bridges/commands/index.ts`,
`../../bridges/skills/index.ts`) instead of the aggregate `../../bridges/index.ts`. Those
three zones are already on the `orchestrators` allow list, so the edge becomes legal by
routing rather than by suppression. Update the file's header comment, which currently
explains the aggregate-barrel import. Keep the import block ordered and alphabetized per the
`import-x/order` convention.

Per D4a, add a file-level suppression to each of the two `tests/live-uat/*.mjs` canaries.
Place `// fallow-ignore-file unused-file` at the top of each file, directly under a short
comment stating the reason: these are standalone, manually-run UAT drivers, invoked by an
operator from the command line and never imported by any module, so unreachability is their
intended shape. Do not delete them and do not add a blanket ignore pattern.

Remove the now-stale suppression in `bridges/hooks/event-router.ts`. Delete the
`fallow-ignore-next-line unused-export` marker on the line above the re-export, and rewrite
the preceding comment block: its stated justification was that the analysis excludes tests
from the reachability graph, which stops being true in this same change. Keep the re-export
itself -- it is load-bearing for the test suite -- and keep a shortened comment saying so.

Per D2, change the `fallow` script in `package.json` to
`fallow dead-code --fail-on-issues --format human`. Dropping `--boundary-violations`,
`--circular-deps`, and `--re-export-cycles` widens the run from three filtered classes to
every class the subcommand computes, cycles and boundaries included. Leave `fallow:audit`
alone for now; Task 7 removes it. Do not add health or dupes invocations yet -- both are red
until Tasks 2-6 land, and adding them here makes the very next commit fail its own
pre-commit hook.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
# 1. Zone membership is what was intended, not what the glob happened to match.
node_modules/.bin/fallow list --boundaries --format json > /tmp/qov-zones.json 2>/dev/null
node -e 'const z=require("/tmp/qov-zones.json");console.log(JSON.stringify(z).slice(0,4000))'
# 2. The gate is green and its exit code is observed, not assumed.
npm run fallow; echo "fallow exit=$?"
# 3. Every dead-code and boundary class is at zero.
node_modules/.bin/fallow dead-code --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const bad=Object.entries(j.summary).filter(([k,v])=>v!==0);console.log("nonzero:",JSON.stringify(bad));process.exit(bad.length?1:0)})'
echo "summary exit=$?"
# 4. Negative test: an unzoned file must be a loud failure (FLOW-01).
mkdir -p extensions/pi-claude-marketplace/zztmp
printf 'export const probe = 1;\n' > extensions/pi-claude-marketplace/zztmp/probe.ts
npm run fallow; echo "unzoned exit=$? (MUST be 1)"
rm -rf extensions/pi-claude-marketplace/zztmp
npm run fallow; echo "reverted exit=$? (MUST be 0)"
npm run typecheck && npm run lint && npm test
    </automated>
  </verify>
  <done>
`fallow dead-code --format json` reports every `summary` counter at 0, including
`boundary_coverage_violations` and `stale_suppressions`. `npm run fallow` exits 0 on the
clean tree and exits 1 with a message naming the unzoned path when a file outside all zones
exists. `extensions/pi-claude-marketplace/index.ts` and
`extensions/pi-claude-marketplace/bridges/index.ts` each appear in exactly one zone, and no
zone has swallowed a subtree it was not meant to. `npm run typecheck`, `npm run lint`, and
`npm test` are green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Health -- decompose the install and update ledgers</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  </files>
  <read_first>
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    .planning/codebase/ARCHITECTURE.md (Phase&lt;C&gt; ledger and lock re-entrancy sections)
  </read_first>
  <action>
Per D4c, bring these seven functions under `maxCyclomatic: 20` and `maxCognitive: 15` by
genuine decomposition. These are the two heaviest files in the tree (2439 and 3067 lines) and
carry the worst two findings in the codebase.

| File:line | Function | cyc | cog | LOC |
|---|---|---|---|---|
| install.ts:1328 | `installPlugin` | 40 | 49 | 598 |
| install.ts:2317 | `narrowResolverReasons` | 19 | 28 | 103 |
| install.ts:721 | `runInstallLedger` | 17 | 18 | 549 |
| update.ts:1850 | `runThreePhaseUpdate` | 29 | 29 | 373 |
| update.ts:1700 | `<arrow>` | 17 | 22 | 141 |
| update.ts:268 | `updatePlugins` | 16 | 18 | 176 |
| update.ts:999 | `preflightUpdate` | 16 | 16 | 178 |

Extract cohesive helpers, do not merely move branches behind a function call to game the
metric. Natural seams to look for: per-phase ledger construction (the five
skills/commands/agents/hooks/mcp phase objects each closing over the same context), the
resolver-verdict narrowing chain, the outcome-to-message composition, and the preflight
validation sequence.

Two hard constraints from ARCHITECTURE.md that any extraction must respect. First, lock
re-entrancy: `proper-lockfile` is configured `retries: 0` and is NOT re-entrant, so a helper
extracted out of a guard-free ledger body must stay guard-free -- never wrap an extracted
helper in `withLockedStateTransaction`. Second, the directed-edge rule: an
`orchestrators/plugin/` ledger module must not import an `orchestrators/marketplace/` ledger
module in either direction, including `import type`. Shared helpers go to
`orchestrators/plugin/shared.ts`, a leaf composer, or `shared/` -- never to a sibling ledger.

The two `<arrow>` findings are anonymous functions. `health.thresholdOverrides` addresses
functions by exact emitted name, so an anonymous arrow is effectively unaddressable; these
must be decomposed or given a name, not overridden.

Per D4c, if a specific function proves genuinely irreducible, prefer a
`health.thresholdOverrides` entry -- a visible numeric ceiling with a written `reason` --
over a binary `fallow-ignore` suppression. Use that escape at most sparingly and never for
the four functions D4c names by their measured worst-case numbers.

The 1300+ tests in this suite are the safety net for this refactor. Run them after each
extracted function, not once at the end.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
node_modules/.bin/fallow health --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const hits=j.findings.filter(f=>(f.cyclomatic>20||f.cognitive>15)&&/orchestrators\/plugin\/(install|update)\.ts/.test(f.path));hits.forEach(f=>console.log(`${f.path}:${f.line} ${f.name} cyc=${f.cyclomatic} cog=${f.cognitive}`));console.log("remaining:",hits.length);process.exit(hits.length?1:0)})'
echo "health-subset exit=$? (MUST be 0)"
npm run fallow; echo "fallow exit=$?"
npm run typecheck && npm run lint && npm test && npm run test:integration
    </automated>
  </verify>
  <done>
No function in `orchestrators/plugin/install.ts` or `orchestrators/plugin/update.ts` exceeds
cyclomatic 20 or cognitive 15. `npm run fallow` still exits 0. `npm test` and
`npm run test:integration` pass with no test file modified. No extracted helper acquires a
state lock, and neither file gained an import of an `orchestrators/marketplace/` ledger
module.
  </done>
</task>

<task type="auto">
  <name>Task 3: Health -- decompose the remaining plugin orchestrators</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/list.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  </files>
  <read_first>
    extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/list.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  </read_first>
  <action>
Per D4c, bring these ten functions under the thresholds.

| File:line | Function | cyc | cog | LOC |
|---|---|---|---|---|
| enable-disable.ts:834 | `outcomeToTypedResult` | 23 | 18 | 90 |
| enable-disable.ts:533 | `<arrow>` | 18 | 21 | 134 |
| enable-disable.ts:1063 | `composeOutcomeRow` | 19 | 17 | 134 |
| enable-disable.ts:460 | `setPluginEnabled` | 14 | 18 | 247 |
| uninstall.ts:341 | `uninstallPlugin` | 19 | 19 | 365 |
| list.ts:389 | `installedRowMessage` | 18 | 16 | 193 |
| list.ts:1049 | `loadPluginListPayload` | 13 | 16 | 142 |
| list.ts:1238 | `scopeOf` | 21 | 2 | 45 |
| clone-cache.ts:85 | `materializePluginClone` | 14 | 16 | 83 |
| clone-cache.ts:203 | `materializeOrRefreshPluginMirror` | 10 | 17 | 60 |

`scopeOf` at cyclomatic 21 with cognitive 2 is a flat dispatch, most likely a long
`switch` or chained ternary. Flat high-cyclomatic dispatch is not the same defect as deep
nesting: prefer converting it to a lookup table or a typed record over splitting it into
functions, which would make it harder to read rather than easier.

`setPluginEnabled` has the ARCHITECTURE.md lock subtlety: its enable branch invokes the
guard-free ledger body precisely because it already holds the lock. Any helper extracted from
it inherits that contract -- do not let an extraction re-acquire the state lock.

`clone-cache.ts` is the sanctioned network seam in the install path (NFR-5), and it is the
one `orchestrators/plugin/` file that may legitimately consume git ops. Do not move any git
call out of it into a sibling during decomposition; that would spread the network surface
across files the NFR-5 gate is meant to keep clean.

The same D4c escape applies: `health.thresholdOverrides` with a written `reason` before a
binary suppression, and neither for anything reducible.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
node_modules/.bin/fallow health --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const hits=j.findings.filter(f=>(f.cyclomatic>20||f.cognitive>15)&&/orchestrators\/plugin\//.test(f.path));hits.forEach(f=>console.log(`${f.path}:${f.line} ${f.name} cyc=${f.cyclomatic} cog=${f.cognitive}`));console.log("remaining:",hits.length);process.exit(hits.length?1:0)})'
echo "health-subset exit=$? (MUST be 0)"
npm run fallow; echo "fallow exit=$?"
npm run typecheck && npm run lint && npm test && npm run test:integration
    </automated>
  </verify>
  <done>
No function anywhere under `orchestrators/plugin/` exceeds cyclomatic 20 or cognitive 15
(this subsumes Task 2's subset, so a regression there fails here too). `npm run fallow` exits
0. All tests pass. Git operations remain confined to `clone-cache.ts` within
`orchestrators/plugin/`.
  </done>
</task>

<task type="auto">
  <name>Task 4: Health -- clear the remaining findings and gate complexity</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts,
    extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts,
    extensions/pi-claude-marketplace/shared/notify.ts,
    extensions/pi-claude-marketplace/domain/source.ts,
    extensions/pi-claude-marketplace/persistence/migrate.ts,
    extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts,
    extensions/pi-claude-marketplace/bridges/hooks/event-router.ts,
    extensions/pi-claude-marketplace/edge/handlers/tools.ts,
    tests/orchestrators/plugin/install.test.ts,
    tests/orchestrators/plugin/list.test.ts,
    tests/orchestrators/plugin/info.test.ts,
    tests/orchestrators/plugin/info-manifest-absent.test.ts,
    tests/architecture/catalog-uat.test.ts,
    tests/helpers/git-mock.ts,
    tests/live-uat/manifest-absence-canary.mjs,
    package.json
  </files>
  <action>
Per D4c, clear the last 19 health findings -- 11 in `extensions/`, 8 in `tests/` -- then add
the health invocation to the gate in this same commit, so complexity is enforced before the
duplication work in Tasks 5-6 can regress it.

Extensions:

| File:line | Function | cyc | cog |
|---|---|---|---|
| import/execute.ts:539 | `executeScopedPlan` | 24 | 32 |
| reconcile/notify.ts:637 | `applyOutcomeToBlock` | 21 | 8 |
| marketplace/remove.ts:635 | `removeMarketplace` | 16 | 17 |
| marketplace/autoupdate.ts:464 | `setMarketplaceAutoupdate` | 12 | 17 |
| shared/notify.ts:3787 | `composePluginLinesWith` | 23 | 16 |
| shared/notify.ts:2243 | `renderPluginRow` | 21 | 3 |
| domain/source.ts:292 | `parsePluginSource` | 20 | 19 |
| persistence/migrate.ts:100 | `ensurePluginResources` | 14 | 17 |
| bridges/hooks/event-adapters.ts:90 | `applyMutationInPlace` | 14 | 16 |
| bridges/hooks/event-router.ts:328 | `flattenPluginIntoBuckets` | 9 | 17 |
| edge/handlers/tools.ts:322 | `pluginScopeOrFallback` | 21 | 2 |

Tests:

| File:line | Function | cyc | cog |
|---|---|---|---|
| orchestrators/plugin/install.test.ts:130 | `seedPathMarketplaceWithPlugin` | 28 | 30 |
| orchestrators/plugin/list.test.ts:169 | `seedMarketplace` | 24 | 20 |
| helpers/git-mock.ts:93 | `makeMockGitOps` | 23 | 11 |
| orchestrators/plugin/info-manifest-absent.test.ts:187 | `seedPathMarketplace` | 23 | 18 |
| live-uat/manifest-absence-canary.mjs:322 | `flowA` | 20 | 17 |
| orchestrators/plugin/info.test.ts:151 | `seedPathMarketplace` | 18 | 21 |
| architecture/catalog-uat.test.ts:77 | `loadCatalogExamples` | 14 | 26 |
| architecture/catalog-uat.test.ts:4634 | `<arrow>` | 13 | 20 |

The four test seed helpers (`seedPathMarketplaceWithPlugin`, `seedMarketplace`, and the two
`seedPathMarketplace`) are structurally the same fixture builder repeated across four files.
Consolidating them into one parameterized helper under `tests/helpers/` fixes all four
findings at once. Verify the consolidated helper still produces byte-identical fixtures for
each caller -- the suite is the proof.

`renderPluginRow` (cyc 21, cog 3) and `pluginScopeOrFallback` (cyc 21, cog 2) are flat
dispatch, same guidance as `scopeOf` in Task 3: prefer a lookup table over splitting.

`parsePluginSource` is named in the fallow adoption spike findings as a known complexity
hotspot; check `.claude/skills/spike-findings-pi-claude-marketplace/references/fallow-adoption.md`
for anything already learned about it before starting.

Two IL-2 constraints apply while editing these files. `shared/notify.ts` is the single
sanctioned UI-output surface; extracted helpers stay inside it or move to a `notify-*`
sibling, never to a caller. `bridges/hooks/if-field/bash.ts` and the hooks lane must not gain
`process.stdout` or `process.stderr` writes.

`bridges/hooks/event-router.ts` was already touched in Task 1. Re-read it before editing;
its re-export block and comment are now in their post-Task-1 form.

Once every health finding is cleared, extend the `fallow` script in `package.json` so it runs
both `fallow dead-code --fail-on-issues --format human` and
`fallow health --fail-on-issues --format human`, chained with `&&`. Observe both exit codes
before and after the chain change -- D2 requires the exit code be measured, never inferred.
Do not add the dupes invocation yet; duplication is still above any real threshold until
Task 6.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
# Every health finding across the whole repo, extensions and tests alike.
node_modules/.bin/fallow health --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const hits=j.findings.filter(f=>f.cyclomatic>20||f.cognitive>15);hits.forEach(f=>console.log(`${f.path}:${f.line} ${f.name} cyc=${f.cyclomatic} cog=${f.cognitive}`));console.log("remaining:",hits.length);process.exit(hits.length?1:0)})'
echo "health-all exit=$? (MUST be 0)"
# Empirical exit code of the health invocation on its own.
node_modules/.bin/fallow health --fail-on-issues --format human; echo "health --fail-on-issues exit=$? (MUST be 0)"
npm run fallow; echo "fallow exit=$?"
npm run typecheck && npm run lint && npm test && npm run test:integration
    </automated>
  </verify>
  <done>
Zero functions in the repository exceed cyclomatic 20 or cognitive 15.
`fallow health --fail-on-issues` exits 0, observed directly. `npm run fallow` now chains the
dead-code and health invocations and exits 0. The four duplicated test seed helpers are one
parameterized helper. `npm run check`'s test and lint stages pass.
  </done>
</task>

<task type="auto">
  <name>Task 5: Duplication -- consolidate the orchestrator and messaging clones</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/info.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/list.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts,
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts,
    extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts,
    extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/*.messaging.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/*.messaging.ts,
    extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts,
    extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts,
    .fallowrc.json
  </files>
  <read_first>
    .planning/codebase/ARCHITECTURE.md (Architectural Constraints -- circular imports section),
    extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/types.ts
  </read_first>
  <action>
Per D4d, consolidate the orchestrator clone groups. Retrieve each group's exact instances
with `node_modules/.bin/fallow dupes --trace dup:<fingerprint>` before editing -- the line
numbers below shift as you work, the fingerprints do not.

Cross-file groups, largest first:

| Lines | Fingerprint | Instances |
|---|---|---|
| 102 | `dup:c77b3abb6f87acd9-8` | `plugin/info.ts`, `plugin/install.ts` |
| 63 | `dup:c77b3abb6f87acd9-6` | `import/execute.ts`, `reconcile/notify.ts` |
| 59 | `dup:c77b3abb6f87acd9-1` | `marketplace/remove.ts`, `plugin/uninstall.ts` |
| 39 | `dup:62626547` | `plugin/reinstall.ts`, `plugin/update.ts` |
| 30 | `dup:c77b3abb6f87acd9-17` | `edge/handlers/tools.ts`, `plugin/list.ts` |
| 24 | `dup:c77b3abb6f87acd9-27` | `plugin/install.messaging.ts`, `plugin/list.messaging.ts` |
| 23 | `dup:c77b3abb6f87acd9-40` | `plugin/enable-disable.messaging.ts`, `plugin/fetch.messaging.ts` |
| 22 | `dup:c77b3abb6f87acd9-49` | `plugin/enable-disable.ts`, `plugin/install.ts` |
| 20 | `dup:c77b3abb6f87acd9-24` | `plugin/enable-disable.ts`, `plugin/uninstall.ts` |
| 16 | `dup:c77b3abb6f87acd9-43` | `plugin/enable-disable.messaging.ts`, `plugin/install.messaging.ts` |
| 15 | `dup:c77b3abb6f87acd9-13` | `fetch/install/list.messaging.ts` (x3) |
| 14 | `dup:c77b3abb6f87acd9-51` | `marketplace/info.ts`, `plugin/info.ts` |
| 12 | `dup:c77b3abb6f87acd9-22` | `marketplace/remove.messaging.ts`, `plugin/uninstall.messaging.ts` |
| 12 | `dup:c77b3abb6f87acd9-4` | `plugin/list.ts`, `shared/notify.ts` |
| 12 | `dup:c77b3abb6f87acd9-48` | `plugin/fetch.messaging.ts`, `plugin/list.messaging.ts` |
| 10 | `dup:3370ec90` | `import/execute.messaging.ts`, `fetch/install/list.messaging.ts` (x4) |
| 10 | `dup:c77b3abb6f87acd9-33` | `marketplace/update.messaging.ts`, `plugin/enable-disable.messaging.ts` |
| 10 | `dup:c77b3abb6f87acd9-16` | `plugin/enable-disable.messaging.ts`, `plugin/update.messaging.ts` |
| 10 | `dup:c77b3abb6f87acd9-14` | `plugin/install.ts`, `plugin/update.ts` |
| 9 | `dup:9bf56b773eb6ea94-2` | `enable-disable/list.messaging.ts`, `reconcile.messaging.ts` |
| 9 | `dup:22fba630` | `remove/uninstall.messaging.ts`, `reconcile.messaging.ts` |
| 9 | `dup:9bf56b773eb6ea94-1` | `plugin/enable-disable.messaging.ts`, `plugin/list.messaging.ts` |
| 8 | `dup:1ba8f6c9` | `plugin/install.ts`, `plugin/reinstall.ts` |
| 5 | `dup:c77b3abb6f87acd9-50` | `marketplace/update`, `enable-disable`, `reinstall` `.messaging.ts` |

Same-file groups (self-duplication within one module):
`dup:c77b3abb6f87acd9-42` (46L, `reconcile/apply.ts`), `dup:c77b3abb6f87acd9-31` (28L,
`marketplace/update.ts`), `dup:c77b3abb6f87acd9-34` (23L, `plugin/reinstall.ts`),
`dup:c77b3abb6f87acd9-46` (19L) and `dup:c77b3abb6f87acd9-53` (17L, both
`plugin/shared.ts`), `dup:55a43b38` (17L, `plugin/enable-disable.ts`),
`dup:c77b3abb6f87acd9-12` (12L, `plugin/update.ts`), `dup:c77b3abb6f87acd9-25` (11L,
`plugin/clone-cache.ts`), `dup:c77b3abb6f87acd9-3` (15L, `shared/notify.ts`).

The routing rules are non-negotiable and come from ARCHITECTURE.md, not from convenience.
An `orchestrators/plugin/` ledger module (`install`, `update`, `uninstall`, `reinstall`,
`enable-disable`) and an `orchestrators/marketplace/` ledger module (`add`, `remove`,
`update`, `autoupdate`) must not import each other in either direction, `import type`
included. So the `marketplace/remove.ts` / `plugin/uninstall.ts` 59-line clone cannot be
resolved by one importing the other. Route it through `orchestrators/marketplace/shared.ts`,
a leaf composer (`plugin/update-row.ts`, `clone-cache.ts`, `clone-gc.ts`), shared types in
`orchestrators/types.ts`, or `shared/`. The messaging-module family is the easiest win: those
are pure message builders with no ledger state, so a shared row/line composer under
`shared/notify*.ts` or a new `orchestrators/*.messaging-shared.ts` leaf resolves most of the
family at once. Keep IL-2 intact -- the composed output still has to reach the user through
`shared/notify.ts`.

Two groups reach outside `orchestrators/`: `dup:c77b3abb6f87acd9-17` pairs
`edge/handlers/tools.ts` with `plugin/list.ts`, and `dup:c77b3abb6f87acd9-4` pairs
`plugin/list.ts` with `shared/notify.ts`. `edge` may not import `orchestrators` internals
beyond the orchestrator entry points, and `shared` is a leaf that may import nothing internal
but `platform`. Both therefore consolidate downward into `shared/` or `domain/`, never
sideways.

Per D4d, where two fragments are structurally identical but semantically distinct -- and
merging them would couple two things that must be free to diverge -- record an individual
`duplicates.ignoredClones` entry in `.fallowrc.json` using the exact
`dup:<fingerprint>:<instance_count>` key, with the justification written as a JSON comment
adjacent to it or in the commit body. A content or occurrence-count change invalidates the
key and makes the group reportable again, which is the point. Never add a blanket `ignore`
pattern and never raise `minLines` or `minTokens` to make groups disappear.

Tasks 2-4 already gated complexity, so every new shared helper is subject to it. Consolidate
so the helper stays under the thresholds rather than becoming a new hotspot.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
node_modules/.bin/fallow dupes --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const orch=j.clone_groups.filter(g=>g.instances.some(i=>/orchestrators\//.test(i.file)));console.log("orchestrator groups remaining:",orch.length);console.log("duplication_percentage:",j.stats.duplication_percentage);orch.forEach(g=>console.log(" ",g.fingerprint,g.line_count+"L",[...new Set(g.instances.map(i=>i.file))].join(" | ")))})'
npm run fallow; echo "fallow exit=$? (MUST be 0 -- dead-code and health must not regress)"
npm run typecheck && npm run lint && npm test && npm run test:integration
    </automated>
  </verify>
  <done>
The remaining orchestrator clone groups are only those carrying an explicit
`duplicates.ignoredClones` entry with a written justification, and the printed list is
reviewed against that set. `duplication_percentage` has dropped measurably from the 3.6152%
baseline. No ledger module imports a ledger module of the other family. `npm run fallow`
still exits 0 for dead code and health. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 6: Duplication -- consolidate the bridge, edge, domain, and test clones</name>
  <files>
    extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts,
    extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts,
    extensions/pi-claude-marketplace/bridges/skills/stage.ts,
    extensions/pi-claude-marketplace/bridges/skills/unstage.ts,
    extensions/pi-claude-marketplace/bridges/skills/discover.ts,
    extensions/pi-claude-marketplace/bridges/agents/stage.ts,
    extensions/pi-claude-marketplace/bridges/agents/discover.ts,
    extensions/pi-claude-marketplace/bridges/commands/stage.ts,
    extensions/pi-claude-marketplace/bridges/commands/unstage.ts,
    extensions/pi-claude-marketplace/bridges/commands/discover.ts,
    extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts,
    extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts,
    extensions/pi-claude-marketplace/domain/components/hooks.ts,
    extensions/pi-claude-marketplace/domain/name.ts,
    extensions/pi-claude-marketplace/domain/resolver.ts,
    extensions/pi-claude-marketplace/persistence/migrate.ts,
    extensions/pi-claude-marketplace/edge/completions/data.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts,
    tests/integration/concurrent-install-child.ts,
    tests/integration/load-reconcile-race-child.ts,
    tests/live-uat/manifest-absence-canary.mjs,
    tests/live-uat/stop-canary.mjs,
    .fallowrc.json
  </files>
  <read_first>
    .planning/codebase/ARCHITECTURE.md (Layers -- bridges/ section),
    extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts,
    extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  </read_first>
  <action>
Per D4d, consolidate the remaining clone groups outside `orchestrators/`.

| Lines | Fingerprint | Instances |
|---|---|---|
| 142 | `dup:c77b3abb6f87acd9-52` | `hooks/async-rewake/registry.ts`, `hooks/dispatch-exec.ts` |
| 43 | `dup:334fd290` | `skills/frontmatter-degrade.ts`, `skills/rewrite-frontmatter.ts` |
| 30 | `dup:c77b3abb6f87acd9-15` | `domain/name.ts` (same file) |
| 29 | `dup:c77b3abb6f87acd9-29` | `domain/resolver.ts` (same file) |
| 26 | `dup:c77b3abb6f87acd9-21` | `agents/stage.ts`, `commands/stage.ts` |
| 26 | `dup:c77b3abb6f87acd9-30` | `agents/discover.ts`, `commands/discover.ts` |
| 23 | `dup:c77b3abb6f87acd9-35` | `edge/handlers/plugin/{bootstrap,pending}.ts` |
| 21 | `dup:c77b3abb6f87acd9-20` | `domain/resolver.ts` (same file) |
| 20 | `dup:c77b3abb6f87acd9-38` | `commands/stage.ts`, `skills/stage.ts` |
| 20 | `dup:c77b3abb6f87acd9-45` | `edge/handlers/marketplace/autoupdate.ts`, `edge/handlers/plugin/enable-disable.ts` |
| 17 | `dup:c77b3abb6f87acd9-28` | `skills/frontmatter-degrade.ts`, `skills/rewrite-frontmatter.ts` |
| 16 | `dup:c77b3abb6f87acd9-9` | `edge/handlers/plugin/{install,update}.ts` |
| 16 | `dup:c77b3abb6f87acd9-18` | `commands/unstage.ts`, `skills/unstage.ts` |
| 15 | `dup:c77b3abb6f87acd9-54` | `hooks/if-field/index.ts`, `domain/components/hooks.ts` |
| 14 | `dup:c77b3abb6f87acd9-2` | `edge/completions/data.ts` (same file) |
| 14 | `dup:c77b3abb6f87acd9-19` | `commands/stage.ts`, `skills/stage.ts` |
| 13 | `dup:c77b3abb6f87acd9-41` | `persistence/migrate.ts` (same file) |
| 13 | `dup:c77b3abb6f87acd9-10` | `edge/handlers/plugin/{info,list,pending}.ts` |
| 13 | `dup:c77b3abb6f87acd9-37` | `domain/name.ts` (same file) |
| 13 | `dup:c77b3abb6f87acd9-44` | `hooks/async-rewake/registry.ts`, `hooks/dispatch-exec.ts` |
| 12 | `dup:c77b3abb6f87acd9-7` | `hooks/if-field/glob.ts` (same file) |
| 12 | `dup:c77b3abb6f87acd9-23` | `commands/stage.ts`, `skills/stage.ts` |
| 11 | `dup:31f77b2e` | `agents/stage.ts`, `commands/stage.ts` |
| 10 | `dup:c77b3abb6f87acd9-32` | `agents/discover.ts`, `commands/discover.ts` |
| 10 | `dup:c77b3abb6f87acd9-39` | `commands/stage.ts`, `skills/stage.ts` |
| 10 | `dup:c77b3abb6f87acd9-26` | `hooks/async-rewake/registry.ts`, `hooks/dispatch-exec.ts` |
| 7 | `dup:c77b3abb6f87acd9-5` | `commands/discover.ts`, `skills/discover.ts` |

Tests: `dup:c77b3abb6f87acd9-36` (23L), `dup:cc950b18` (13L), `dup:6d8c002d` (10L) all pair
the two `tests/live-uat/*.mjs` canaries; `dup:c77b3abb6f87acd9-11` (16L) and
`dup:c77b3abb6f87acd9-47` (12L) pair the two `tests/integration/*-child.ts` drivers.

The hard architectural constraint here is that cross-bridge imports are FORBIDDEN, and
fallow's zone rules are the only thing enforcing it. That covers the largest group in the
whole codebase (142 lines shared between `hooks/async-rewake/registry.ts` and
`hooks/dispatch-exec.ts` -- same bridge, so a `bridges/hooks/` leaf module is a legal home)
and, critically, the `agents` / `commands` / `skills` stage-and-discover family, which is
NOT. A shared stage helper for those three must live in `domain/`, `persistence/`, or
`shared/` -- all three are on every bridge zone's allow list -- and never in a sibling
bridge. The same applies to `hooks/if-field/index.ts` paired with
`domain/components/hooks.ts`: the shared shape belongs in `domain/`, which the hooks bridge
may already import.

The `edge/handlers/` groups are argument-parsing and scope-resolution boilerplate. `edge`
may import `orchestrators`, `domain`, `shared`, and `platform`; a shared handler prelude
belongs in `edge/args.ts` or a new `edge/handlers/shared.ts` inside the same zone.

The two `tests/live-uat/*.mjs` canaries carry a Task 1 `fallow-ignore-file unused-file`
marker, which suppresses the unused-file finding only, not duplication. They are standalone
operator-run drivers with no shared module story and deliberately no import graph, so their
three clone groups are the clearest candidates for `duplicates.ignoredClones` entries with a
written justification -- extracting a shared module would defeat their standalone purpose.
The two `tests/integration/*-child.ts` drivers are ordinary modules and CAN share a helper
under `tests/helpers/`; consolidate rather than suppress those.

Same D4d rules: individual justified `ignoredClones` entries only, never a blanket `ignore`
pattern, never a `minLines` / `minTokens` raise.

Finish by measuring the final `duplication_percentage` and recording it in the commit body.
Task 7 needs that number to set `duplicates.threshold`. Do not set the threshold here.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
node_modules/.bin/fallow dupes --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("groups:",j.clone_groups.length,"instances:",j.stats.clone_instances,"pct:",j.stats.duplication_percentage);j.clone_groups.forEach(g=>console.log(" ",g.fingerprint,g.line_count+"L",[...new Set(g.instances.map(i=>i.file))].join(" | ")))})'
# No bridge may import another bridge -- fallow zones enforce it; confirm the gate agrees.
npm run fallow; echo "fallow exit=$? (MUST be 0)"
npm run typecheck && npm run lint && npm test && npm run test:integration
    </automated>
  </verify>
  <done>
Every remaining clone group is either intentionally retained with a `duplicates.ignoredClones`
entry and a written justification, or gone. The final `duplication_percentage` is measured
and recorded for Task 7. No bridge directory imports another bridge directory. `npm run
fallow` exits 0 for dead code and health. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 7: Assemble the three-invocation gate and make it uniform across all three surfaces</name>
  <files>
    package.json,
    .fallowrc.json,
    .pre-commit-config.yaml,
    .github/workflows/lint.yml
  </files>
  <read_first>
    package.json,
    .pre-commit-config.yaml,
    .github/workflows/lint.yml
  </read_first>
  <action>
Per D1f, set `duplicates.threshold` in `.fallowrc.json` to a real non-zero percentage the
codebase satisfies after Tasks 5-6. `0` means NO LIMIT, which is precisely why `fallow dupes`
exits 0 today with 66 clone groups present. Choose a value slightly above the measured
post-consolidation percentage -- enough headroom that an ordinary change does not trip it, low
enough that a copy-pasted module does. Write the chosen number and the measured number next
to each other in the commit body so the margin is auditable later.

Per D2, make the `fallow` script three explicit invocations chained with `&&`:

```
fallow dead-code --fail-on-issues --format human && \
fallow health --fail-on-issues --format human && \
fallow dupes --fail-on-issues --format human
```

Bare `fallow --fail-on-issues` in combined mode was measured exiting 0 with 105 findings
present, so the combined form is not a substitute for the three. Verify every exit code
empirically -- run each subcommand, echo `$?`, and confirm the observed value. Never trust a
flag name.

Remove the `fallow:audit` script; nothing will reference it after this task.

Per D3, make the identical `npm run fallow` command run in all three surfaces:

1. `npm run check` already chains `npm run fallow`. Confirm it is unchanged and still in
   position between `lint` and `format:check`.
2. `.pre-commit-config.yaml`'s `npm-fallow` hook currently triggers only on
   `^(\.fallowrc\.json|extensions/.*\.ts|package(-lock)?\.json)$`. Health and duplication now
   cover `tests/` too, so a test-only commit can regress the gate without firing the hook.
   Either widen the pattern to include `tests/.*\.ts` and `tests/.*\.mjs`, or set
   `always_run: true` -- the run takes roughly 0.6 seconds, so the cost of always running is
   negligible and the coverage is exact. Prefer `always_run: true` and keep the existing
   comment explaining why the hook never takes filenames.
3. `.github/workflows/lint.yml`'s `fallow` job runs
   `npm run fallow:audit -- --changed-since "origin/<base>"`. That is a different subcommand
   over a different scope with a different verdict, and it is the exact cause of pull-request
   surprises. Replace the step with `npm run fallow`. Remove the `fetch-depth: 0` checkout
   option and the comment justifying it -- with no merge base to compute, full history is
   dead weight in the job.

Then run the negative tests the constraint requires. Each planted defect must make
`npm run fallow` exit 1, and reverting must return it to exit 0:

- a cross-zone import (for example, a `shared/` file importing from `orchestrators/`)
- a two-file circular dependency between modules that do not currently reference each other
- a function whose cyclomatic complexity exceeds 20

Add a fourth for duplication now that the threshold is real: paste a block large enough to
push `duplication_percentage` past the new threshold and confirm exit 1. Revert every plant.
Leave no scratch file behind and confirm `git status` is clean of them before committing.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
# Observe each subcommand's exit code independently. All three MUST be 0.
node_modules/.bin/fallow dead-code --fail-on-issues --format human >/dev/null 2>&1; echo "dead-code exit=$?"
node_modules/.bin/fallow health    --fail-on-issues --format human >/dev/null 2>&1; echo "health exit=$?"
node_modules/.bin/fallow dupes     --fail-on-issues --format human >/dev/null 2>&1; echo "dupes exit=$?"
npm run fallow; echo "npm run fallow exit=$? (MUST be 0)"
# Uniformity: the same command string must appear in all three surfaces.
node -e 'const p=require("./package.json");console.log("check:",p.scripts.check);console.log("fallow:",p.scripts.fallow);console.log("audit-script-present:",Object.hasOwn(p.scripts,"fallow:audit"))'
node_modules/.bin/fallow --version
grep -n "npm run fallow" .pre-commit-config.yaml .github/workflows/lint.yml
# Negative test 1: cross-zone import. Observe 1, revert, observe 0.
printf 'import { installPlugin } from "../orchestrators/plugin/install.ts";\nexport const zz = typeof installPlugin;\n' > extensions/pi-claude-marketplace/shared/zz-probe.ts
npm run fallow >/dev/null 2>&1; echo "cross-zone import exit=$? (MUST be 1)"
rm -f extensions/pi-claude-marketplace/shared/zz-probe.ts
npm run fallow >/dev/null 2>&1; echo "reverted exit=$? (MUST be 0)"
# Negative test 2: two-file circular dependency inside one zone.
printf 'import { zzB } from "./zz-b.ts";\nexport const zzA = (): number => zzB() + 1;\n' > extensions/pi-claude-marketplace/shared/zz-a.ts
printf 'import { zzA } from "./zz-a.ts";\nexport const zzB = (): number => (zzA ? 1 : 2);\n' > extensions/pi-claude-marketplace/shared/zz-b.ts
npm run fallow >/dev/null 2>&1; echo "circular dep exit=$? (MUST be 1)"
rm -f extensions/pi-claude-marketplace/shared/zz-a.ts extensions/pi-claude-marketplace/shared/zz-b.ts
npm run fallow >/dev/null 2>&1; echo "reverted exit=$? (MUST be 0)"
# Negative test 3: a function above the cyclomatic ceiling. Generate a long
# if-chain rather than hand-writing one, so the branch count is unambiguous.
node -e 'const b=Array.from({length:30},(_,i)=>`  if (n === ${i}) { return ${i}; }`).join("\n");require("fs").writeFileSync("extensions/pi-claude-marketplace/shared/zz-complex.ts",`export function zzComplex(n: number): number {\n${b}\n  return -1;\n}\n`)'
npm run fallow >/dev/null 2>&1; echo "over-threshold function exit=$? (MUST be 1)"
rm -f extensions/pi-claude-marketplace/shared/zz-complex.ts
npm run fallow >/dev/null 2>&1; echo "reverted exit=$? (MUST be 0)"
# Negative test 4: duplication above the new threshold -- paste a block large
# enough to move the percentage, confirm exit 1, revert, confirm exit 0.
# No scratch file may survive.
git status --short
# Full green.
npm run check
    </automated>
  </verify>
  <done>
`npm run fallow` is three explicit invocations and exits 0, with each subcommand's exit code
observed individually. `fallow:audit` no longer exists in `package.json`. `.pre-commit-config.yaml`
and `.github/workflows/lint.yml` both invoke the same `npm run fallow`, with no
`--changed-since`, no `audit` subcommand, and no `fetch-depth: 0`. `duplicates.threshold` is a
real non-zero number recorded alongside the measured percentage. All four planted defects
(cross-zone import, circular dependency, over-threshold function, over-threshold duplication)
were each observed producing exit 1 and each observed returning to exit 0 after revert. No
scratch file survives. `npm run check` is fully green.
  </done>
</task>

<task type="auto">
  <name>Task 8: Encode NFR-5 and IL-2 as fallow rules, then remove the architecture tests fallow provably replaced</name>
  <files>
    .fallowrc.json,
    tests/architecture/no-orchestrator-network.test.ts,
    tests/architecture/import-boundaries.test.ts
  </files>
  <read_first>
    tests/architecture/no-orchestrator-network.test.ts,
    tests/architecture/import-boundaries.test.ts,
    .planning/codebase/ARCHITECTURE.md (Architectural Constraints, Anti-Patterns)
  </read_first>
  <action>
Per D1e, add `boundaries.calls.forbidden` to `.fallowrc.json`. The shape is
`{ from: "<zone>", callee: "<pattern>" | ["<pattern>", ...] }` and BOTH keys are required.
There is no wildcard `from`, so a policy that applies to every zone needs one entry per zone.
Callee matching is segment-aware, not substring.

Encode IL-2: no zone in the extension may write directly to the process output streams. Use
`process.stdout.*` and `process.stderr.*` callee patterns, one rule per zone. This mirrors the
existing ESLint `no-restricted-syntax` block scoped to
`extensions/pi-claude-marketplace/**/*.ts` and gives the constraint a second, reachability-aware
enforcer.

Encode NFR-5: orchestrators must not reach the network. Forbid the network callees
(`fetch`, and the `platform/git.ts` operation names `clone`, `fetch`, `resolveRemoteRef`,
`forceUpdateRef`, `listRemotes`) from the `orchestrators` zone. There is a complication you
must resolve empirically rather than assume: ten `orchestrators/` files -- including
`marketplace/add.ts`, `marketplace/update.ts`, `plugin/clone-cache.ts`, and
`orchestrators/auth-host.ts` -- legitimately consume git, and `clone-cache.ts` is the
ARCHITECTURE.md-sanctioned network seam for the install path. A blanket rule from the broad
`orchestrators` zone will fail on all of them.

The expressible resolution is a zone split: define a narrower zone, name it
`orchestrators-network-free`, covering exactly
`orchestrators/plugin/install.ts`, `orchestrators/plugin/list.ts`, and
`orchestrators/plugin/uninstall.ts` -- the three files NFR-5 names -- and hang both the
forbidden-call rule and an import rule (allow list identical to `orchestrators` minus
`platform`) off it. Before writing it, verify empirically how fallow resolves a file matched
by two zone patterns: check whether the narrow zone wins, the broad zone wins, or the file
lands in both. Use `fallow list --boundaries` and a deliberate probe. Whatever the resolution
rule turns out to be, write the config so the three named files are governed by the narrow
rule, and confirm that with `boundary_coverage_violations` at 0 and no false failure from the
other ten git-consuming orchestrator files.

Per D5, only after that: prove-then-remove. For each candidate test, reintroduce the exact
violation it guards, run `npm run fallow`, and observe the exit code. Remove the test only
when the observed exit is 1. Revert the plant.

`tests/architecture/no-orchestrator-network.test.ts` -- one test, asserting
`orchestrators/plugin/{install,list,uninstall}.ts` carry zero `gitOps` surface. Plant a
`gitOps` field and a `platform/git.ts` import in `install.ts` and observe. Note the shape
difference before you decide: the test greps for an IMPORT and a FIELD DECLARATION, while
`boundaries.calls.forbidden` catches a CALL. A file can import `platform/git.ts` and declare
`gitOps` without calling anything, which the calls rule alone would miss -- this is exactly
why the task adds the narrow-zone IMPORT rule as well. If both the import rule and the calls
rule fire, the file is fully replaced and can be deleted. If only one fires, keep the test
trimmed to the part fallow does not cover, and say so in a comment citing NFR-5.

`tests/architecture/import-boundaries.test.ts` -- six tests, and they are NOT uniform:

| Test | What it pins | Expected disposition |
|---|---|---|
| `D-11: import-x/no-cycle is configured and can traverse .ts dependencies` | the ESLint rule AND its `import-x/extensions` setting | KEEP -- fallow covers neither |
| `D-11: no orchestrators/marketplace file imports a plugin LEDGER module` | a directed edge between individual FILES inside one zone | KEEP unless the Task 8 zone split makes it expressible |
| `D-11: no orchestrators/plugin LEDGER imports a marketplace ledger module` | same, opposite direction | KEEP unless expressible |
| `import-x/no-restricted-paths defines exactly 8 zones` | ESLint config shape | evaluate: fallow's zones are a finer-grained superset, but this test pins the ESLint rule, not the architecture |
| `each zone's target+from set matches the D-11 allowed-imports matrix` | ESLint config shape | same evaluation |
| the boundary canary (around line 273) | that the ESLint rule actually fires on a fixture | same evaluation |

Do not remove the ESLint `no-restricted-paths` rule as part of this task. As long as that rule
exists, the three tests pinning its configuration still have a job, and deleting them would
leave a silently-misconfigured lint rule undetected -- the precise failure mode the no-cycle
test was written to catch. If you conclude the ESLint rule itself is now redundant against
fallow's 14-zone model, that is a separate decision: file it as a backlog item in Task 9
rather than acting on it here.

Document what replaced what: for every test removed, add a line to the commit body and to the
ARCHITECTURE.md update in Task 9 naming the test, the fallow config key that replaced it, and
the planted violation that proved the replacement.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
# Zone resolution for the three NFR-5 files must be the narrow zone.
node_modules/.bin/fallow list --boundaries --format json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.stringify(JSON.parse(s)).slice(0,6000))})'
node_modules/.bin/fallow guard extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
node_modules/.bin/fallow guard extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
# Clean tree still green -- the ten legitimate git consumers must NOT fire.
npm run fallow; echo "clean exit=$? (MUST be 0)"
# Proof plant for NFR-5. Observe exit 1, then revert and observe exit 0.
cp extensions/pi-claude-marketplace/orchestrators/plugin/install.ts /tmp/qov-install-backup.ts
node -e 'const f="extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";const fs=require("fs");fs.writeFileSync(f,`import { clone } from "../../platform/git.ts";\nexport const zzProbe = async (): Promise<void> => { await clone({} as never); };\n`+fs.readFileSync(f,"utf8"))'
npm run fallow >/dev/null 2>&1; echo "NFR-5 plant exit=$? (MUST be 1)"
cp /tmp/qov-install-backup.ts extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
rm -f /tmp/qov-install-backup.ts
npm run fallow >/dev/null 2>&1; echo "reverted exit=$? (MUST be 0)"
npm run check
    </automated>
  </verify>
  <done>
`.fallowrc.json` encodes IL-2 as per-zone forbidden `process.stdout` / `process.stderr`
callee rules and NFR-5 as a narrow `orchestrators-network-free` zone with both an import rule
and a forbidden-call rule. `fallow guard` confirms `install.ts` is governed by the narrow zone
and `clone-cache.ts` is not. The clean tree exits 0 -- none of the ten legitimate git
consumers fires. The NFR-5 plant was observed producing exit 1 and exit 0 after revert. Every
architecture test that was deleted has its planted-violation proof and its replacing config
key recorded; every test kept has a written reason naming what fallow cannot express. The
ESLint `no-restricted-paths` rule is untouched. `npm run check` is fully green.
  </done>
</task>

<task type="auto">
  <name>Task 9: Documentation, backlog, and changelog</name>
  <files>
    .planning/codebase/ARCHITECTURE.md,
    .planning/codebase/STACK.md,
    .planning/codebase/CONVENTIONS.md,
    .planning/BACKLOG.md,
    .planning/STATE.md,
    CHANGELOG.md
  </files>
  <read_first>
    .planning/codebase/STACK.md (Build/Dev section),
    .planning/codebase/ARCHITECTURE.md (Architectural Constraints, Anti-Patterns),
    .planning/BACKLOG.md (FLOW-01, FLOW-03, FLOW-04),
    CHANGELOG.md (first 10 lines)
  </read_first>
  <action>
Per D6, bring the documentation in line with what shipped. Every claim below must be checked
against the final state of the files, not against this plan -- the plan describes intent, the
repository is the fact.

`STACK.md`, Build/Dev section: the `fallow` paragraph currently says `npm run fallow` is the
local gate and `npm run fallow:audit` gates pull requests on newly-introduced findings only.
Both halves are now wrong. Replace with the three-invocation whole-repo gate, its identical
presence in `npm run check` / pre-commit / `lint.yml`, and the fact that `fallow:audit` no
longer exists. Update the zone count if the two new zones (plus any Task 8 narrow zone)
changed it from 12.

`ARCHITECTURE.md`:
- The "Circular imports" bullet describes whole-repo cycle coverage coming from
  `npm run fallow`'s `--circular-deps` flag. That flag is gone; coverage now comes from the
  bare `fallow dead-code` run. Correct it.
- The "Network boundary" bullet names `tests/architecture/no-orchestrator-network.test.ts` as
  the enforcer of NFR-5. Rewrite to match whatever Task 8 concluded -- the narrow zone, the
  forbidden-call rule, and whatever remains of the test.
- The "Orchestrator files importing git/network surfaces" anti-pattern names the same test.
  Same correction.
- The "Direct `ctx.ui.notify` calls" anti-pattern should gain the fallow forbidden-call rule
  alongside the ESLint rule and grep gate.
- Add a short subsection recording the boundary model: zone coverage is now complete by
  construction rather than by accident of the current tree (`requireAllFiles`), and an
  unzoned file is a loud failure naming the path. This is what closes FLOW-01.
- Record what replaced what for every architecture test Task 8 removed.

`CONVENTIONS.md`: the Function Design section says size is bounded implicitly by
`sonarjs/cognitive-complexity: 15`. Add that `fallow health` now gates cyclomatic 20 and
cognitive 15 across `extensions/` AND `tests/`, that the two tools compute cognitive
complexity differently and their numbers do not agree, and that an exceptional function is
recorded as a `health.thresholdOverrides` entry with a written reason rather than a binary
suppression. Add the duplication convention: individual justified `duplicates.ignoredClones`
keys, never a blanket ignore pattern.

`BACKLOG.md`:
- Close FLOW-04. Follow the FLOW-02 closure format already in the file: mark it CLOSED with
  the date and a short paragraph stating that the two gates converged, the three-invocation
  whole-repo form that replaced them, and the final measured counts.
- Close FLOW-01 the same way -- `boundaries.coverage.requireAllFiles` is exactly the fix it
  asked for, and it was verified by the throwaway-directory probe in Task 1.
- FLOW-03 (should `import-x/no-cycle` widen past `orchestrators/`) is untouched by this work
  and stays open.
- File a NEW item to revisit CRAP and real coverage. Record, so the next attempt does not
  rediscover it: fallow needs Istanbul `coverage-final.json` and rejects lcov; `c8` emits
  `-1` branchMap columns that fallow's parser rejects; naive clamping of those columns is
  unsafe -- one `c8` flag change silently zeroed 119 files and swung the `extensions/` CRAP
  figure from 25 to 238. State that `maxCrap: 0` is the current posture and why (complexity
  gated directly, coverage gated by SonarCloud, CRAP redundant on top of both).
- If Task 8 concluded the ESLint `no-restricted-paths` rule is now redundant against fallow's
  zone model, file that as its own item here rather than acting on it.

`CHANGELOG.md`: add a `## [Unreleased]` section above `## [0.15.0]`. Describe the change in
the file's existing voice -- user-visible effect first, mechanism second. This is a build and
tooling change with no runtime behavior change, so say that plainly. Do NOT bump the version
in `package.json` or `sonar-project.properties`; the user will be asked about that separately.

`STATE.md`: add the row for this quick task to the Quick Tasks Completed table and refresh
`last_activity` / `last_activity_desc`.

Run the `simple-english` skill over the prose you write in `BACKLOG.md` and `CHANGELOG.md` if
it is available -- these are the two files a future reader hits cold.
  </action>
  <verify>
    <automated>
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
# The docs must not still describe the retired audit gate.
node -e '
const fs=require("fs");
const files=[".planning/codebase/STACK.md",".planning/codebase/ARCHITECTURE.md",".planning/codebase/CONVENTIONS.md"];
let bad=[];
for (const f of files) { const t=fs.readFileSync(f,"utf8"); if (t.includes("fallow:audit")) bad.push(f+" mentions the retired script"); if (t.includes("--changed-since")) bad.push(f+" mentions delta scoping"); }
const p=require("./package.json"); if (Object.hasOwn(p.scripts,"fallow:audit")) bad.push("package.json still defines the retired script");
const cl=fs.readFileSync("CHANGELOG.md","utf8"); if (!cl.includes("## [Unreleased]")) bad.push("CHANGELOG has no Unreleased section");
if (p.version !== "0.15.0") bad.push("version was bumped and should not have been");
const bl=fs.readFileSync(".planning/BACKLOG.md","utf8"); if (!/FLOW-04.*CLOSED|CLOSED.*FLOW-04/s.test(bl.slice(bl.indexOf("FLOW-04"), bl.indexOf("FLOW-04")+400))) bad.push("FLOW-04 not marked closed");
console.log(bad.length? bad.join("\n") : "docs OK"); process.exit(bad.length?1:0)'
echo "docs exit=$? (MUST be 0)"
npm run check
    </automated>
  </verify>
  <done>
`STACK.md`, `ARCHITECTURE.md`, and `CONVENTIONS.md` describe the three-invocation whole-repo
gate and mention neither `fallow:audit` nor `--changed-since`. FLOW-04 and FLOW-01 are marked
CLOSED with dates and outcomes; FLOW-03 is untouched; a new backlog item records the CRAP and
real-coverage findings including the c8 branchMap and 119-file clamping trap. `CHANGELOG.md`
has an `[Unreleased]` section and `package.json` still reads `0.15.0`. `STATE.md` carries the
quick-task row. `npm run check` is fully green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repository -> CI gate | A change that passes locally must not be able to pass CI while carrying a defect, and vice versa. Divergence between the two is the defect this whole task removes. |
| refactor -> runtime behavior | Tasks 2-6 restructure 16,000+ lines of shipped orchestrator, bridge, and notify code. The only thing standing between a decomposition and a silent behavior change is the test suite. |
| suppression marker -> gate integrity | Every `fallow-ignore`, `thresholdOverrides`, and `ignoredClones` entry is a hole in the gate. A blanket one is an unbounded hole. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qov-01 | Tampering | Task 2-6 refactors of `install.ts`, `update.ts`, `notify.ts` | high | mitigate | Run `npm test` and `npm run test:integration` after each extracted function, not once per task. No test file is modified in Tasks 2, 3, 5, or 6; a test edit there means behavior changed. |
| T-qov-02 | Repudiation | gate exit codes | high | mitigate | D2 requires every exit code be observed by running the command and echoing `$?`. Three of the plausible invocations were measured exiting 0 with findings present; a flag name is not evidence. |
| T-qov-03 | Elevation of Privilege | `duplicates.ignore`, `health.ignore`, blanket `fallow-ignore-file` | high | mitigate | D4 forbids blanket exclusions. Only individual `ignoredClones` keys, `thresholdOverrides` entries, and per-file markers with written justification. Each `ignoredClones` key embeds the content fingerprint and instance count, so any edit reopens the finding. |
| T-qov-04 | Denial of Service | pre-commit `npm-fallow` hook on every commit | low | accept | Measured runtime is roughly 0.6 seconds whole-repo. `always_run: true` is affordable and buys exact coverage. |
| T-qov-05 | Spoofing | architecture-test removal in Task 8 | high | mitigate | D5 requires an empirical plant-observe-revert cycle per test before deletion. A config that reads as equivalent is not proof; only an observed exit 1 is. |
| T-qov-06 | Information Disclosure | committing from a linked worktree | medium | mitigate | The trufflehog git-mode hook structurally fails in a worktree. Confirm cleanliness with the documented filesystem scan over the paths being committed, then prefix with `SKIP=trufflehog`. Never extend `SKIP=` to another hook, never use `--no-verify`. |
| T-qov-SC | Tampering | npm/pip/cargo installs | high | accept | This task adds no dependency. `fallow@^3.16.0` is already in `devDependencies` and was audited at adoption. No package-manager install task exists, so the legitimacy gate has nothing to gate. |
</threat_model>

<verification>

Run after every task, without exception:

```bash
cd /Users/acolomba/src/pi-claude-marketplace/.worktrees/fallow-full-gate
npm run fallow; echo "exit=$?"
npm run typecheck && npm run lint && npm test && npm run test:integration
```

Run once at the end of Task 9:

```bash
npm run check
```

And the full negative battery, each plant observed at exit 1 and each revert observed at
exit 0:

1. cross-zone import (a `shared/` file importing `orchestrators/`)
2. two-file circular dependency
3. a function above cyclomatic 20
4. a pasted block pushing duplication above `duplicates.threshold`
5. a file outside every zone
6. a `platform/git.ts` import plus a `gitOps` field in `orchestrators/plugin/install.ts`

## Commit discipline (per CLAUDE.md, every task)

Before each `git commit`:

```bash
pre-commit run --files <changed files>
```

Fix, restage, re-run until clean. A failed hook means the commit did NOT happen -- do not
recover with `--amend`, which would rewrite the previous commit.

The trufflehog hook is a git-mode scan and fails structurally in a linked worktree (`.git` is
a file, not a directory). `pre-commit run trufflehog --all-files` fails identically and
confirms nothing. Confirm cleanliness the documented way instead:

```bash
TH=$(find "${PRE_COMMIT_HOME:-$HOME/.cache/pre-commit}" -type f -name trufflehog -perm -u+x | head -1)
"$TH" filesystem <changed paths> --results=verified,unknown --fail
```

Exit 0 with `verified_secrets: 0` and `unverified_secrets: 0` is clean. Only then prefix the
commit with `SKIP=trufflehog`. Do not extend `SKIP=` to any other hook. Never `--no-verify`.
Never rebase.

Commit messages: Conventional Commits, ASCII only (the `fix-unicode-dashes` hook rejects em
dashes in `COMMIT_EDITMSG`), title 5-72 characters, body lines at most 80 characters, no
milestone or phase references.

Suggested commit types by task: `build` for Tasks 1, 4, 7 (config and gate wiring),
`refactor` for Tasks 2, 3, 5, 6, 8, `docs` for Task 9.

</verification>

<success_criteria>

- `npm run fallow` is exactly three invocations -- `fallow dead-code --fail-on-issues`,
  `fallow health --fail-on-issues`, `fallow dupes --fail-on-issues` -- and each exit code was
  observed, not inferred.
- The identical `npm run fallow` runs in `npm run check`, the `.pre-commit-config.yaml`
  `npm-fallow` hook, and `.github/workflows/lint.yml`. `fallow:audit` and `--changed-since`
  appear nowhere in the repository.
- `.fallowrc.json` carries `production: false`, `health.maxCrap: 0`,
  `boundaries.coverage.requireAllFiles: true`, a non-zero `duplicates.threshold`, zones
  covering every file under `extensions/`, and `boundaries.calls.forbidden` rules encoding
  NFR-5 and IL-2.
- Every suppression in the tree is individual and justified. No blanket `ignore` pattern, no
  `health.ignore` entry, no raised `minLines` or `minTokens`.
- All six negative tests were observed producing exit 1 and exit 0 after revert.
- Every removed architecture test has a recorded plant-observe-revert proof and a named
  replacing config key. Every retained test has a written reason naming what fallow cannot
  express.
- `npm run check` is fully green.
- BACKLOG FLOW-04 and FLOW-01 are CLOSED; a new item records the CRAP and real-coverage
  findings; FLOW-03 is untouched.
- `CHANGELOG.md` has an `[Unreleased]` entry and `package.json` still reads `0.15.0`.

</success_criteria>

<output>
Create `.planning/quick/260816-qov-make-fallow-a-full-uniform-static-analys/260816-qov-SUMMARY.md` when done.
</output>
