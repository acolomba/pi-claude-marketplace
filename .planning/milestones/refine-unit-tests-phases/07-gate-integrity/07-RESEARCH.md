# Phase 7: Gate Integrity - Research

**Researched:** 2026-09-10
**Domain:** In-repo structural test gates (Node `node:test`, ESLint 10 flat config, Fallow 3.20, git-driven change selection)
**Confidence:** HIGH — every claim below was measured in this working tree this session, not recalled

## Summary

This phase has no external dependency surface. Every question it raises is answerable by
running the repository's own tools, and this research ran all of them. The findings split
three ways.

**Two of the thirteen routed findings are already closed by Phase 5/6 work, one is
partially closed, and ten are live.** `resetCompletionCache` no longer exists,
`availableRowMessage` now has a real production consumer. But `MARKETPLACE_VALIDATOR`,
`surfacePostCommitWarnings`, `__operations`, the `no-orchestrator-network` target
omissions, the `partial-vocabulary-guard` scope gap, the copied `REQUIRED_EVENT_FIELDS`
table, the unenrolled `ClaudeHookEvent`/`Dependency` closed sets, and the duplicated marker
assertions are all still there, verified by direct inspection.

**Every mechanism the decisions call for works, and three of them work better than
expected.** `ESLint#calculateConfigForFile` exists on ESLint 10.8.1, returns numeric
severities and full rule options, sweeps all 229 extension files in 2.3 seconds, and
composes cleanly with a fixture config that spreads the real `eslint.config.js` and appends
one override. All three `D-07-10` offenders (blanket override, zone substitution, rule-off)
resolve exactly as designed. Fallow takes `--root` and `--config` flags, so a mutated-config
offender needs no repository mutation at all. And `fallow dead-code --production` computes
the production-unowned-export census in 0.19 s **without touching `.fallowrc.json`**, which
satisfies `D-07-20` outright.

**One decision is sized wrong and needs re-scoping before planning.** `D-07-19` frames the
production-unowned-export sweep as closing two named instances. The measured census is
**91 unowned exports in `extensions/` plus 11 in `scripts/`** — 102 total. A repo-wide
must-be-zero gate cannot ship green against this tree in one phase, and `D-07-18`'s
no-allow-list stance forecloses the cheap escape. Section 5 lays out three routes.

**Primary recommendation:** Build the shared temp-root scan mechanic and the path registry
first (they gate everything else), close the six mechanically-small findings behind them,
resolve the effective-config gaps with `calculateConfigForFile`, and re-scope `D-07-19`
from "repo-wide zero" to a bounded, measured contract before any plan commits to it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Temp-root offender/benign controls | Test harness (`tests/architecture/`) | — | The scan mechanic is test-owned; production code has no notion of an injected root |
| Injected-root scan parameter | Test harness (`tests/architecture/source-scan.ts`) | — | `assertNoForbiddenSurface` is a test-only module; the parameter never reaches production |
| Path registry + meta-gate | Test harness (`tests/architecture/`) | — | `D-07-07` bounds it to `tests/architecture/**`; `.mjs` scripts stay out |
| Effective-config resolution | Test harness, via ESLint programmatic API | Build config (`eslint.config.js`) | The gate reads; only the fixture config writes, and it writes by composition |
| Fallow boundary probe | Test harness, via `fallow --root/--config` | Build config (`.fallowrc.json`) | `D-07-20` freezes the real config; the probe supplies its own |
| Changed-pair base selection | Gate script (`scripts/test-coverage-direct.mjs`) | — | Behavior change lives in the script; `RCOV-03` wiring is Phase 8 |
| `__operations` removal | Production (`orchestrators/plugin/`) | Test harness | A production-owned collaborator is production surface; tests only stop passing `__operations` |
| Unowned-export detection | Test harness, via `fallow --production` | — | The flag is per-invocation; the config stays as `FLOW-06` left it |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Offender and Control Mechanism**

- **D-07-01:** File-scanning gates prove firing through a hermetic `mkdtemp` temp-root copy.
  Copy the real targets into the temporary root, mutate one copy to create the offender, and
  run the real scan against an injected root. The offender is derived from the real file, so
  it cannot drift from the target it represents. This requires `assertNoForbiddenSurface` and
  every bespoke walker to accept a root parameter instead of closing over `REPO_ROOT`. —
  **Reversibility:** costly — the root parameter reaches every current and future caller of
  the shared scan mechanic, so reverting means re-inlining `REPO_ROOT` at each gate.
- **D-07-02:** Gates that invoke a real tool (ESLint flat config, Fallow) use a committed
  in-repo fixture instead, because plugin and `tsconfig` resolution must work. That fixture is
  linted through the **real resolved config**, never through a synthetic `overrideConfig`. The
  two mechanisms are deliberate: each is matched to what its gate actually invokes.
- **D-07-03:** Visitation is proved separately from firing. Each scan reports the set of paths
  it actually opened, and the gate deep-compares that set against its declared target list.
  This catches both a target that stopped resolving and a target list that quietly shrank —
  the existing `ENOENT` rule (`WR-06`) catches only the first.
- **D-07-04:** Every gate carries two benign controls: an unmutated copy of the same real
  target (proving the gate is not failing everything) and a near-miss (the forbidden token
  inside a comment or a string literal, proving comment-stripping and pattern precision).

**Composed-Target Discoverability**

- **D-07-05:** Gate targets live in one central registry module under `tests/architecture/`
  holding **full literal repo-relative paths**. Every gate imports its targets from the
  registry and composes nothing locally, so a literal-match stale-path scan reads one file and
  sees every guarded target. — **Reversibility:** costly — undoing it means redistributing
  every path constant back into the gates that use it and losing the single scan point.
- **D-07-06:** The registry is enforced by a self-hosting meta-gate that scans the gate files
  themselves: a production path named anywhere in `tests/architecture/**` outside the registry
  is an offender. The meta-gate gets the same temp-root offender and benign controls as every
  other gate, so it proves it fires.
- **D-07-07:** Registry scope is `tests/architecture/**` only. The `.mjs` gate scripts keep
  their own path handling; they are plain JavaScript and cannot import a `.ts` registry.
- **D-07-08:** A pattern built by joining a name list into a regex (the `D-11` ledger pair is
  the worked example) carries a positive control per name: synthesize the exact specifier a
  violation would use and assert the pattern matches it. This is what catches a regex that
  drifted from its name list while still reporting success.

**Effective Config Resolution**

- **D-07-09:** Both `GGAT-03` gaps are closed by resolving the effective ESLint config through
  `ESLint#calculateConfigForFile`. ESLint applies its own cascade, so a later blanket override
  or an off-switch shows up as the resolved severity or options rather than as a block the
  gate never looked at. Do not reimplement the flat-config cascade inside a gate.
- **D-07-10:** The gate varies its config source across three offenders — a blanket override, a
  duplicate-zone substitution, and a rule-off — each constructed as the real `eslint.config.js`
  plus **one** appended mutation, so no offender can drift from the real config. The unmodified
  real config is the benign control.
- **D-07-11:** The `no-console` severity gate sweeps every extension `.ts` file, because the
  obligation is that exactly three files are exempt and only a full sweep can prove that set is
  complete. The zone-matrix gate probes one representative file per folder.
- **D-07-12:** Delete the regex source-scrape in `tests/architecture/hooks-dispatch.test.ts`
  once effective resolution replaces it. It is the defect (`AHG-014`), and a superseded gate
  left in place invites someone to trust it. — **Reversibility:** reversible — the scrape is a
  single test body.

**Changed-Pair Selection**

- **D-07-13:** Base selection uses a deterministic, ordered fallback chain — `origin/main`,
  then `main`, then the upstream tracking ref, then `HEAD~1` — and **prints which candidate it
  selected**. It exits non-zero only when every candidate fails. The printed choice is what
  makes the selection auditable.
- **D-07-14:** Zero selected pairs distinguishes its two causes. Pass when the changed-path set
  resolved successfully and simply held no pairable entries, reporting which paths were skipped
  and why. Fail when the path set came back empty because base resolution or a git invocation
  failed. A docs-only commit stays green; a broken selector goes red.
- **D-07-15:** The base-selection and zero-selection proofs extend
  `scripts/test-coverage-direct.negative.mjs`, which already plants failures against this exact
  gate through an injected `mkdtemp` root and already runs inside `npm run check`. New cases
  plant a repository with no `origin/main`, a shallow clone, and a docs-only change.
- **D-07-16:** Phase 7 owns the behavior change **and** its proofs; Phase 8 wires an
  already-correct gate into scoped pre-commit and a dedicated CI job (`RCOV-03`). A criterion
  cannot prove fail-closed behavior against a script that is not fail-closed yet.

**Test-Only Production Surface**

- **D-07-17:** Several findings routed here were already closed by earlier work —
  `shared/completion-cache.ts` now owns its plugin-index memory privately behind
  `createCompletionCache()` with no test-only export, and `orchestrators/plugin/list.ts` has
  been split. Record those as closed-by-earlier-phase with positive current evidence rather
  than re-fixing them, and still add the gate so the class cannot return.
- **D-07-18:** The test-only-surface gate fires on real offenders, and the one live offender is
  removed in this phase: `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts`
  exports `__operations?: ReinstallReplaceOperations` on `ReplaceReinstalledPluginInput`, which
  `MF-DEC-07` forbids as a `__deps` bag. Give `reinstall-replace.ts` a production-owned
  collaborator the way Phase 5 did elsewhere, so the gate ships green against a tree that
  actually satisfies it. No allow-list entry: this milestone has repeatedly found allow-lists go
  stale and silent. — **Reversibility:** costly — the collaborator becomes part of the reinstall
  compensation path's public shape, so reverting means migrating the replacement schedule and its
  owner test back.

**Production-Unowned Exports**

- **D-07-19:** The production-unowned-export gate is a repository-wide sweep: an export with no
  production consumer outside its own module is an offender. It closes `DCORE-030`
  (`MARKETPLACE_VALIDATOR` in `domain/manifest.ts`) and the identical instance
  `surfacePostCommitWarnings` (`orchestrators/reconcile/apply.ts`) together. They are one defect
  with two instances; gating one while leaving the other is the split that lets a class survive.
- **D-07-20:** Fallow's `production: false` setting stays as it is. It is `FLOW-06`'s deliberate
  fix, paired with `includeEntryExports`, and the operator owns that question separately. The
  unowned-export gate is therefore a **test**, not a config change — which is also why the blind
  spot exists: under `production: false` a test import counts as a consumer.

**Carried-Forward Constraints**

- `MF-DEC-07` and Phase 5 decisions `D-05-01` through `D-05-03` remain binding: no test-only
  export, dead default, `__deps` bag, or ignore pragma. Case-owned real temporary filesystems by
  default; a narrow production-owned port only where authorized.
- Phase 6 established that architecture gates require planted offenders and benign controls,
  never configuration-existence assertions. That stands and is strengthened here by the
  visitation obligation.
- `SCOPE-REQ-GGAT-01` excludes the folded unused-type-member todo from active scope: prose alone
  does not establish a terminal property-member gap, and `D-22` forbids adding a new gate until
  that claim is independently revalidated.
- `SCOPE-REQ-GGAT-02` keeps `GGAT-02`/`AGCOL-01` evidence-only. No active work.
- Both complexity ceilings apply independently to every new gate helper: ESLint's
  `sonarjs/cognitive-complexity: 15` and Fallow's `health.maxCognitive: 15` /
  `maxCyclomatic: 20` / `maxUnitSize: 60`. Passing one does not predict the other.
- `duplicates.threshold: 3` applies to gate fixture setup. Shared temp-root and registry helpers
  must be extracted, not copied across gate files.

### Claude's Discretion

- Exact registry module name, constant names, and grouping, provided every entry is a full
  literal repo-relative path.
- How many new gate files to create versus folding a new clause into an existing gate, provided
  the dupes threshold is respected and each gate keeps its own requirement-anchored failure
  message.
- Whether `HHD-027` (copied expected tables) and `HHD-028` (optional dependencies only ever
  passed `undefined`) become one gate or two.
- The disposition of `SHC-F047`'s redundant-gate audit, provided the finding is closed with
  recorded current evidence either way.
- The shape of the production-owned collaborator that replaces `__operations`, provided it is a
  real production responsibility and not a forwarding seam.
- Wave membership and plan granularity, provided plans that touch the shared registry, the
  shared scan mechanic, or `eslint.config.js` are serialized.

### Deferred Ideas (OUT OF SCOPE)

- **Unused type-member detection** (todo `2026-09-02-detect-unused-code-and-type-members.md`,
  matched at score 0.6): reviewed and deliberately **not folded**. `SCOPE-REQ-GGAT-01` excludes
  it from active scope because prose alone does not establish a terminal property-member gap, and
  `D-22` forbids adding a gate until the claim is independently revalidated. It stays in the
  bundled backlog and is named again in Phase 9's `CLOSE-02` criteria.
- **`FLOW-07` matrix removal** — whether the ESLint `no-restricted-paths` zone matrix can be
  removed in favour of Fallow's 13-zone model still needs an edge-by-edge allow-list comparison,
  not another zone count. Closed to evidence-only for this milestone by `SCOPE-REQ-GGAT-03`.
- **`ORA-F32`'s routing** — the finding is recorded as deferred-backlog, but `D-07-19` closes its
  instance as part of the repository-wide sweep. Record that the instance closed early while the
  finding keeps its backlog identity.
- **`.mjs` gate-script path registry** — enrolling `scripts/check-corresponding-tests.mjs` and
  `scripts/test-coverage-direct.mjs` in a shared target registry needs a `.mjs` or JSON source of
  truth they can both import. Out of scope per `D-07-07`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GGAT-01 | Each terminal scanning-gate gap proves target visitation and carries a synthetic offender and benign control; changed-pair discovery also proves deterministic base selection and a fail-closed zero-selection case. | §2 (injectable root, 21 gates enumerated), §9 (`no-orchestrator-network` targets + dynamic-import form, all measured), §8 (`partial-vocabulary-guard` scope + repair census), §10 (git fallback chain measured in a temp repo; existing negative-harness coverage enumerated so new cases do not duplicate) |
| GGAT-03 | `FLOW-07` varies effective config sources and broad overrides across the terminal ESLint/Fallow boundary gaps and proves target visitation. | §3 (`calculateConfigForFile` verified on ESLint 10.8.1; three offender configs constructed and their resolved outputs recorded), §4 (Fallow `--root`/`--config` verified; no current gate reads `.fallowrc.json`) |
| GGAT-04 | Terminal closed-set and delegated-contract gates cover their real production consumers and any public seams created by approved splits, with visitation, offender, and benign controls. | §7 (`ClaudeHookEvent` / `Dependency` real consumers; the `satisfies` one-directionality falsified with `tsc` output), §1 (`HHD-027`/`HHD-028` offenders located by line), §6 (`__operations` call sites traced; a second live `__deps` bag found) |

## 1. Current State of Each Routed Finding

Every row was checked against the working tree this session. "Live" means the described
defect reproduces now; "closed" means positive current evidence shows it does not.

| Finding | Status | Current evidence |
|---------|--------|------------------|
| `OMR-F01` | **LIVE** | `FORBIDDEN_TARGETS` (`tests/architecture/no-orchestrator-network.test.ts:67-135`) has 20 entries; none is `orchestrators/marketplace/{autoupdate,list,remove}.ts`. See §9. |
| `OMRR-F004` | **LIVE** (duplicate of `OMR-F01`) | Same list, same absence. `remove.ts` and `list.ts` unnamed. |
| `OPEF-F01` | **LIVE** | `FORBIDDEN_PATTERNS` (same file, `:137-142`) matches `from "…platform/git…"` only. A `import("…platform/git.ts")` call is not matched. Probe: the static pattern returns `false` on `await import("../../platform/git.ts")`; a `/import\(\s*["'][^"']*platform\/git[^"']*["']\s*\)/` form returns `true`. |
| `OPIB-F07` (install-b) | **LIVE** | `collectGuardedSources()` (`tests/architecture/partial-vocabulary-guard.test.ts:80-107`) reads `extensions/**`, two docs, non-recursive `tests/architecture/*.ts`, and one `catalog-uat` file. It never reads `tests/orchestrators/**`. 12 non-architecture test files carry retired vocabulary today. See §8. |
| `DCORE-030` | **LIVE** | `MARKETPLACE_VALIDATOR` is declared at `extensions/pi-claude-marketplace/domain/manifest.ts:40`, referenced twice inside that file (`:70`, `:71`), imported by `tests/domain/manifest.test.ts:9`, and imported by **no** production module. Every other repo hit is a comment. |
| `SCN-F025` | **LIVE** | No file under `tests/architecture/` names `ClaudeHookEvent` or `Dependency`. `notify-closed-set-locks.test.ts` locks four other tuples and stops there. See §7. |
| `HHD-027` | **LIVE** | `REQUIRED_EVENT_FIELDS` (`bridges/hooks/dispatch-exec.ts:217-229`) enumerates 10 event keys with their field lists; `tests/bridges/hooks/dispatch-exec.test.ts` repeats the same closed key set as `requiredFields` data rows from `:611` onward. A copied oracle with no gate over the relationship. |
| `HHD-028` | **LIVE** | Optional deps: `pi?: ExtensionAPI` at `bridges/hooks/dispatch.ts:337` and `:374`; `pi: ExtensionAPI \| undefined` at `:96`, `:174`, `:264`; `executor?: HookExecutor` at `bridges/hooks/event-router.ts:431`, `:768`, `:962`. `tests/bridges/hooks/dispatch.test.ts` supplies `undefined` throughout. |
| `OPLU-A-F07` | **MOSTLY CLOSED** | `availableRowMessage` now lives at `orchestrators/plugin/list-candidate-row.ts:161` and **has a production consumer**: `list-flow.ts:69` imports it, `:366` calls it. `FilterBucket` is imported by the same line. The "JSDoc-named parity guard" prose is gone. **Residue:** `CandidateRow` (`list-candidate-row.ts:28`) is still exported with no production consumer outside its own module. |
| `OPLU-B-F15` | **CLOSED** | `resetCompletionCache` returns zero hits across `extensions/` and `tests/`. `shared/completion-cache.ts` exports only `MARKETPLACE_NAMES_CACHE_SCHEMA` (`:58`), `PLUGIN_INDEX_CACHE_SCHEMA` (`:79`), `PluginIndexRow` (`:108`), `ManifestSoftFailError` (`:143`), `GetPluginIndexOptions` (`:204`), `CompletionCache` (`:356`), `createCompletionCache` (`:374`). |
| `SHC-F046` | **MOSTLY CLOSED** | The three named test-owned exports are gone with `resetCompletionCache`. **Residue:** the two typebox schema constants (`:58`, `:79`) remain unowned by production — they fall inside the §5 census, not a special case. |
| `SHC-F047` | **LIVE** | `tests/shared/markers.test.ts:9-39` and `tests/architecture/markers-snapshot.test.ts:55-70` assert byte-identical values for the same two constants (`RECOVERY_PLUGIN_REINSTALL_PREFIX`, `STATE_LOCK_HELD_PREFIX`). Additionally the snapshot gate's header (`:17-20`) cites `tests/architecture/no-legacy-markers.test.ts`, **which does not exist** — a stale reference inside a gate, i.e. a criterion-4 instance in the gate corpus itself. |
| `OPEFR-F007` | **LIVE** | `orchestrators/plugin/fetch.ts:483` — `const { resolveStrict } = await import("../../domain/plugin-resolver.ts");` inside `reasonedRow`. **Correction to the ledger prose:** the specifier is `domain/plugin-resolver.ts`, not `domain/resolver.ts`. It is the only dynamic import in `extensions/**` other than two inline `import(...)` type positions (`reconcile/backfill.ts:451`, `reconcile/apply.ts:250`). |
| `ABG-004` | **LIVE** | `loadZones()` (`tests/architecture/import-boundaries.test.ts:34-46`) imports `eslint.config.js` and returns the **first** block whose `rules` object carries `import-x/no-restricted-paths`. It never resolves the cascade. Measured: with a later `"import-x/no-restricted-paths": "off"` appended, the raw block still reports 8 zones while the resolved severity is 0. See §3. |
| `AHG-014` | **LIVE** | `tests/architecture/hooks-dispatch.test.ts:42-75` regex-scrapes `eslint.config.js` for `files: [...]` arrays that literally contain `extensions/pi-claude-marketplace` and have `no-console: off` within 600 characters. A blanket `files: ["**/*.ts"], rules: {"no-console":"off"}` block carries no such literal, so the gate never inspects it. Measured: that block flips `domain/manifest.ts` from resolved severity `2` to `0` while the gate stays green. |
| `ORA-F32` | **LIVE** | `surfacePostCommitWarnings` is exported at `orchestrators/reconcile/apply.ts:921`, called once in the same file at `:857`, imported by `tests/orchestrators/reconcile/apply.test.ts:69`, and by no production module. |

**Two additional live defects found while checking the above** — both belong in scope
because they are the same classes the phase is closing:

- **A second live `__deps` bag.** `orchestrators/plugin/reinstall-flow.ts` declares
  `readonly __deps?: ReinstallPluginDeps` **twice** (`:138` on
  `ReinstallPluginOptions`, `:151` on `ReinstallPluginsOptions`) and forwards it at `:531`.
  `D-05-01` states plainly that "Ports must not be `__deps` members". `D-07-18` names only
  `__operations`, so a test-only-surface gate that fires on `__`-prefixed members will go red
  on `reinstall-flow.ts` too. Either the gate's scope or the phase's removal list has to
  account for it.
- **An orphaned comment describing a removed export.** `orchestrators/plugin/info.ts` ends
  (`:2483-2485`) with `// Test-only re-export of the shared classifier so callers exercising /
  this orchestrator's behavior can verify the closed-set ladder without / reaching into
  shared/probe-classifiers.ts directly.` — followed by nothing. The re-export it documents
  does not exist. `.claude/rules/typescript-comments.md` forbids narration of code that no
  longer exists.

## 2. Injectable-Root Refactor Surface

`tests/architecture/source-scan.ts` (100 lines) exports `REPO_ROOT` (`:29`),
`stripComments` (`:42`), and `assertNoForbiddenSurface` (`:66`). Current signature:

```ts
export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
  opts: { readonly allowMissing?: ReadonlyArray<string> } = {},
): Promise<void>
```

It reads `path.join(REPO_ROOT, rel)` at `:77` and makes one `assert.deepEqual(offenders, [])`
at `:99`.

**Direct callers of `assertNoForbiddenSurface` — 3 files, 6 call sites:**

| File | Call sites | Notes |
|------|-----------|-------|
| `tests/architecture/no-orchestrator-network.test.ts` | `:149` | 20 targets, 4 patterns |
| `tests/architecture/no-lifecycle-default-enabled-read.test.ts` | `:70` | 4 targets, 2 patterns |
| `tests/architecture/source-scan.test.ts` | `:20`, `:31`, `:41`, `:54` | The existing gate-the-gate. `:55` deliberately scans `tests/architecture/source-scan.ts` itself for its own export name to prove firing. |

**Importers of the exported `REPO_ROOT` — 2 files:**
`tests/architecture/compat-01-no-expansion.test.ts:98` (used at `:118`, `:335`) and
`tests/architecture/manifest-lookup-drift.test.ts:32` (used at `:197`, `:225`, `:302`).

**Importers of `stripComments` — 10 test files** (plus `source-scan.ts` itself):
`manifest-read-seam`, `reconcile-planner-purity`, `import-boundaries`,
`compat-01-no-expansion`, `no-credential-leak`, `manifest-lookup-drift`,
`no-hooks-strict-additional-properties`, `no-orchestrator-network`, `source-scan.test`,
`disabled-state-classification`. `stripComments` is pure and needs no change.

**Gates that build target paths from a root they close over — 19 files total.**
16 define their own `const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")`:

```
extension-version-sync   manifest-read-seam        disabled-state-classification
config-state-write-seams reconcile-planner-purity  import-boundaries
no-split-01-cast-reads   no-shell-out              no-telemetry-deps
hooks-cap-notify         no-credential-leak        partial-vocabulary-guard
no-hooks-strict-additional-properties               peer-floor
unit-suite-glob-completeness                        scope-fences-63
```

Two more build from `import.meta.dirname` directly (`hooks-lifecycle`,
`scope-order-drift`), and one uses `process.cwd()` (`hooks-dispatch`, at `:24`, `:44`, `:80`).

**What breaks.** Adding a **trailing optional** `root` to `assertNoForbiddenSurface` (or
folding it into the existing `opts` bag) breaks nothing — all six call sites keep compiling.
Adding a **required** parameter breaks all six. Adding a **visited-path return value**
(`D-07-03`) changes the return type from `Promise<void>` to `Promise<ReadonlyArray<string>>`,
which is source-compatible at all six sites (they `await` and discard).

**Recommended shape**, matching the precedent already in the tree
(`assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot)` at
`scripts/test-coverage-direct.mjs:305`):

```ts
export interface ScanReport {
  /** Repo-relative paths actually opened, in target order. */
  readonly visited: ReadonlyArray<string>;
  /** Repo-relative targets waived through `allowMissing`. */
  readonly waived: ReadonlyArray<string>;
}

export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
  opts: {
    readonly allowMissing?: ReadonlyArray<string>;
    /** Scan root. Defaults to the repository; a temp-root control injects its own. */
    readonly root?: string;
  } = {},
): Promise<ScanReport>
```

`root` in `opts` rather than a fourth positional argument keeps `opts` the single place
optional behavior lives, which is the convention `CONVENTIONS.md` §"Function Design" states.

**Blast radius of `D-07-05` is much larger than `D-07-01`'s.** The registry reaches all 19
root-closing gates plus the two `REPO_ROOT` importers, because "composes nothing locally"
means every `path.join(SOME_DIR, "name.ts")` and every `` `${EXTENSION_ROOT}/edge` `` template
moves. §12 counts them.

## 3. `ESLint#calculateConfigForFile` Mechanics on This Repo

All measured this session.

**Version and availability.** `eslint` resolves to **10.8.1** (`node -e "require('eslint/package.json').version"`), Node **v26.8.2**, TypeScript **6.0.3**, Prettier **3.9.6**, Fallow **3.20.0**, git **2.55.0**. `Object.getOwnPropertyNames(ESLint.prototype)` returns
`['constructor','getRulesMetaForResults','hasFlag','lintFiles','lintText','loadFormatter','calculateConfigForFile','findConfigFile','isPathIgnored']` — `calculateConfigForFile` is present and is a function under flat config.

**Returned shape.** Top-level keys are exactly
`['linterOptions','rules','plugins','language','languageOptions']`. `rules` is a flat
`Record<string, [severity, ...options]>` with **numeric** severity (`0`/`1`/`2`), already
normalized from `"off"`/`"warn"`/`"error"`. 182 rules resolve for an extension `.ts` file.

**(a) `extensions/pi-claude-marketplace/shared/debug-log.ts`** →
`rules["no-console"] === [0, {}]`.

**(b) An ordinary extension file (`domain/manifest.ts`)** →
`rules["no-console"] === [2, {}]`.

**Full `no-console` sweep** (`D-07-11`): 229 files under
`extensions/pi-claude-marketplace/**/*.ts`, resolved one at a time in **2 285 ms**. Exactly
three resolve to `0`:

```
extensions/pi-claude-marketplace/shared/debug-log.ts
extensions/pi-claude-marketplace/shared/notification-dispatch.ts
extensions/pi-claude-marketplace/persistence/migrate.ts
```

226 resolve to `2`, zero resolve to `1`, zero are absent. The sweep is cheap enough to run
per test and gives `D-07-11`'s "exactly three exempt" contract directly.

**(c) `import-x/no-restricted-paths` options.** Exposed in full for any file matched by
BLOCK C's glob:

```js
rules["import-x/no-restricted-paths"] === [
  2,
  { basePath: "/home/acolomba/pi-claude-marketplace-refine-unit-tests",
    zones: [ { target: "./extensions/pi-claude-marketplace/edge",
               from: [...3 entries...],
               message: "edge/ may only import from orchestrators/, domain/, shared/, platform/." },
             ...7 more... ] }
]
```

`zones.length === 8`. `basePath` resolves to an **absolute** path (the config writes
`import.meta.dirname`), so a gate comparing zone targets must compare the relative
`./extensions/...` strings, not `basePath`-joined ones. **Note a live prose drift:**
`eslint.config.js:176` calls this a "9-zone `no-restricted-paths` mapping" while the array
holds 8, and `import-boundaries.test.ts:283` correctly asserts 8.

**Per-zone probe files.** The zone matrix can be probed one representative file per folder —
any real `.ts` under each of the eight folders resolves the same 8-zone options object.
There is no need for a synthetic file.

**Fixture-config composition — verified to work, including plugin resolution.** A fixture
config that spreads the real config and appends one block:

```js
// tests/fixtures/eslint-probe/<name>.config.js
import real from "../../../eslint.config.js";

export default [
  ...real,
  { files: ["**/*.ts"], rules: { "no-console": "off" } },
];
```

driven by `new ESLint({ cwd: repoRoot, overrideConfigFile: "<fixture path>" })`. All three
`D-07-10` offenders were built and measured against
`extensions/pi-claude-marketplace/edge/router.ts`:

| Config source | `no-console` | `no-restricted-paths` severity | zones |
|---------------|-------------|-------------------------------|-------|
| real `eslint.config.js` (benign control) | `[2,{}]` | `2` | 8 |
| + blanket `files:["**/*.ts"] no-console:"off"` | `[0,{}]` | `2` | 8 |
| + zone substitution (`files:["extensions/…/**/*.ts"]`, one dummy zone) | `[2,{}]` | `2` | **1** |
| + rule-off (`"import-x/no-restricted-paths":"off"`) | `[2,{}]` | **`0`** | 8 |

Three `ESLint` instances plus three resolutions ran in **2 163 ms** total. Plugin resolution
works because the real config's `import` statements resolve from `eslint.config.js`'s own
location, and `import.meta.dirname` inside it still evaluates to the repository root
regardless of where the fixture lives — so `basePath` and `tsconfigRootDir` are unaffected.

The **rule-off** row is exactly `ABG-004`: `loadZones()` reads the raw first block and reports
8 zones, so it stays green while the rule is disabled. The **blanket** row is exactly
`AHG-014`.

**Two mechanical traps for the planner.**

1. **A zone with an empty `zones: []` is rejected by the rule schema** —
   `Key "rules": Key "import-x/no-restricted-paths": Value [] should NOT have fewer than 1 items.`
   The substitution offender must supply at least one (dummy) zone.
2. **`tests/fixtures/bad-imports/**` is globally ignored by `eslint.config.js:303`, and BLOCK C's
   `files` glob is `["extensions/pi-claude-marketplace/**/*.ts"]`.** Consequently
   `calculateConfigForFile("tests/fixtures/bad-imports/edge-imports-bridges.ts")` returns
   `undefined`; with `new ESLint({ ignore: false })` it returns a config object but
   `rules["import-x/no-restricted-paths"]` is **absent**, and `lintFiles` on it produces zero
   messages. **The existing canary fixture cannot be linted through the real resolved config
   as-is.** The `code_context` section of CONTEXT.md assumes it can ("Reuse the fixture, replace
   the synthetic config with the real resolved one"); that assumption does not hold. Two viable
   routes:
   - **Recommended.** Stop linting the fixture and instead make the `D-11` proof a
     *resolved-config* proof: assert the resolved 8-zone contract on a representative file per
     folder, and prove firing through the three appended-mutation offenders above. The canary's
     original job — "prove the rule emits the right `ruleId`" — is then covered by the offender
     configs, which fire on real extension files.
   - Keep a linted fixture, but the fixture config must both remove the global ignore and add a
     `files` glob carrying the rule. That is *two* mutations of the real config, not one, so it
     conflicts with `D-07-10`'s "plus **one** appended mutation" rule.

## 4. Fallow's Role in `GGAT-03`

**No current gate reads `.fallowrc.json`.** A repo-wide grep for `fallowrc` across `tests/`
and `scripts/` returns exactly two hits, both prose comments in
`tests/live-uat/{stop-canary,manifest-absence-canary}.mjs` explaining the two
`duplicates.ignoredClones` entries. The only Fallow-facing gate is
`import-boundaries.test.ts:132-187` ("D-11: npm run fallow runs dead-code unfiltered"), and
it reads `package.json`'s `fallow` script string, not the Fallow config. It uses an
allow-list of tokens (`npx`, `fallow`, `dead-code`, `--fail-on-issues`, `--format`, `human`)
rather than a denylist, so it is not vulnerable to the first-match/raw-read weakness that
`loadZones()` has.

**Conclusion for scoping.** Both `GGAT-03` terminal findings (`ABG-004`, `AHG-014`) are
ESLint-side. The requirement's "ESLint/Fallow" wording is broader than its evidence. Adding a
Fallow-config gate would be a new gate for a claim with no terminal finding, which `D-22`
forbids. **Recommend: `GGAT-03`'s Fallow half is satisfied by recording that no Fallow gate
reads `.fallowrc.json` today, so there is no first-match weakness to close on that side.**

**If a Fallow offender proof is wanted anyway, it is cheap and offline.** `fallow` exposes
both flags (from `fallow dead-code --help`):

```
-r, --root <ROOT>       Project root directory
-c, --config <CONFIG>   Path to config file (.fallowrc.json, .fallowrc.jsonc, fallow.toml, or .fallow.toml)
```

So a "vary the effective config" proof is `fallow dead-code --root <tempRoot> --config
<mutatedCopy> --fail-on-issues` with the real config as the benign control — no repository
mutation, no network. Measured runtimes on this tree, all offline:

| Command | Exit | Time |
|---------|------|------|
| `fallow dead-code --fail-on-issues` | 0 | 0.82 s |
| `fallow health --fail-on-issues` | 0 | 0.16 s |
| `fallow dupes --fail-on-issues` | 0 | 0.18 s |
| `fallow dead-code --production --unused-exports` | 102 issues | 0.42 s |
| `fallow dead-code --production` (all classes) | 120 issues | 0.19 s |

A temp-root Fallow probe would additionally have to copy enough of the tree for zone globs to
match, which is why the ESLint side is the cheaper place to spend `GGAT-03`'s budget.

## 5. Production-Unowned Export Detection — the Census

This is the section most likely to change the plan.

### The right instrument

Four candidates were considered. **`fallow dead-code --production` is the right one**, and it
satisfies `D-07-20` exactly:

| Instrument | Verdict |
|-----------|---------|
| **`fallow dead-code --production --unused-exports`** | **Use this.** `--production` is a per-invocation flag that overrides the config's `production` value for that run only. `.fallowrc.json` is untouched, so `FLOW-06`'s `production: false` and `includeEntryExports` stay exactly as the operator left them. `D-07-20` says "the gate is a **test**, not a config change" — this is literally that. |
| TypeScript compiler API | Works (a 90-line probe was written and run this session) but re-implements what Fallow already does, misses star-imported modules unless handled explicitly, and adds a hand-maintained instrument the phase would then have to gate. |
| CodeGraph | Good for tracing one symbol; not an enumerating instrument. |
| Plain import-graph text parsing | Same drawbacks as the compiler API, with worse fidelity on `export … from` chains. |

### The census — measured, not estimated

`npx fallow dead-code --production --unused-exports --format json`, run this session:

```
✗ 102 exports (0.42s)
  102 issues · 8 suppressed · 0 stale suppressions
```

By root: **`extensions/` 91, `scripts/` 11.** Entry points drop from **576** (non-production:
every test file is an entry) to **9** (1 manual + 8 from `package.json`) — that difference is
precisely the blind spot `DCORE-030` and `ORA-F32` describe. The **same command without
`--production` reports `✓ No issues found`**, which is the benign control writing itself.

`fallow dead-code --production` with all classes enabled reports **120 issues**:
3 unused files, 91 exports, 10 types, 1 class member, 4 duplicate export pairs.

**The 91 `extensions/` entries, by file** (line numbers from the JSON):

```
bridges/agents/convert.ts                     3   :42 MODEL_MAP  :52 TOOL_MAP  :63 THINKING_VALUES
bridges/agents/frontmatter.ts                 3   :35 (re-export)  :48 emitYamlScalar  :67 sanitizeProvenanceValue
bridges/agents/index.ts                       2   :21 ×2 (re-exports)
bridges/agents/marker.ts                      2   :25 GENERATED_AGENT_PREFIX  :41 GENERATED_AGENT_MARKER_LEGACY
bridges/hooks/async-rewake/pid-table.ts       2   :53  :60
bridges/hooks/async-rewake/registry.ts        1   :87 MARKER_ENV
bridges/hooks/event-router.ts                 1   :193 createBeforeAgentStartHandler
bridges/hooks/if-field/index.ts               4   :61 ×2  :63 ×2 (re-exports)
bridges/hooks/stage.ts                        2   :42 hookConfigPathFor  :218 createWriteHookConfig
bridges/mcp/collision-slots.ts                1   :31 MCP_COLLISION_SLOTS
bridges/mcp/index.ts                          1   :19
bridges/mcp/marker.ts                         1   :27 readMarker
bridges/mcp/parse.ts                          2   :29 parseMcpServers  :72
bridges/mcp/stage.ts                          1   :93 MalformedMcpServersError
bridges/mcp/substitute.ts                     1   :52 deepSubstitute
bridges/skills/unstage.ts                     1   :32 createUnstagePluginSkills
domain/auth-registry.ts                       1   :89 GITLAB_PROVIDER
domain/components/hooks.ts                    2   :55  :56
domain/components/hooks/schema.ts             1   :57
domain/manifest.ts                            1   :40 MARKETPLACE_VALIDATOR      <-- DCORE-030
domain/plugin-resolver.ts                     1   :638 resolveLoose
domain/resolver-types.ts                      1   :100 ResolvedPluginSchema
domain/unsupported-components.ts              2   :11  :27
edge/completions/data.ts                      2   :161 buildItem  :495 getPluginToMarketplacesMap
edge/flag-catalog.ts                          1   :154 CATALOG_VERBS
edge/handlers/plugin/fetch.ts                 1   :43 parseFetchTarget
edge/handlers/tools.ts                        1   :175 projectRowStatus
edge/router.ts                                2   :91 TOP_LEVEL_USAGE  :107 MARKETPLACE_USAGE
index.ts                                      1   :35
orchestrators/import/marketplaces.ts          1   :98 planMarketplaceSourcesForRefs
orchestrators/import/refs.ts                  1   :10 parseEnabledPluginRef
orchestrators/import/settings.ts              2   :28  :98
orchestrators/marketplace/shared.ts           1   :477 resolveScopeFromState
orchestrators/plugin-path.ts                  1   :35 collectBinDirs
orchestrators/plugin/enable-disable.ts        1   :990 createSetPluginEnabled
orchestrators/plugin/fetch.ts                 1   :129 createFetchPlugins
orchestrators/plugin/info.ts                  1   :2469 createGetPluginInfo
orchestrators/plugin/install-flow.ts          1   :1113 createInstallPlugin
orchestrators/plugin/install.messaging.ts     1   :605 narrowResolverReasons
orchestrators/plugin/reinstall-flow.ts        1   :180 createReinstallPlugin
orchestrators/plugin/reinstall-replace.ts     4   :189 :216 :223 :230           <-- see §6
orchestrators/plugin/reinstall.messaging.ts   1   :273 outcomeToPluginMessage
orchestrators/plugin/uninstall.ts             1   :855 createUninstallPlugin
orchestrators/reconcile/apply.ts              2   :861 createApplyReconcile  :921 surfacePostCommitWarnings   <-- ORA-F32
orchestrators/reconcile/backfill.ts           1   :208 scanForceInstalledBackfills
orchestrators/reconcile/reconcile.messaging.ts 1  :70 PENDING_STATUSES
persistence/config-io.ts                      1   :93 CONFIG_VALIDATOR
persistence/state-io.ts                       3   :81  :287  :302
platform/git-credential.ts                    1   :297 createCredentialOps
platform/git.ts                               3   :304 listBranches  :312 listRemotes  :429 buildAuthCallbacks
platform/pi-api.ts                            2   :150 hasLoadedPiSubagents  :163 hasLoadedPiMcpAdapter
shared/completion-cache.ts                    2   :58  :79                     <-- SHC-F046 residue
shared/errors-bridges.ts                      1   :24 AgentForeignContentError
shared/errors.ts                              1   :393 ConcurrentUninstallError
shared/markers.ts                             1   :24 STATE_LOCK_HELD_PREFIX
shared/notification-dispatch.ts               1   :79 emitWithSummary
shared/notification-grammar.ts                2   :72 ICON_REMOTE  :95 ICON_PARTIALLY_AVAILABLE
shared/notification-types.ts                  4   :6 REASONS  :65 STATUS_TOKENS  :96 PLUGIN_STATUSES  :119 MARKETPLACE_STATUSES
shared/path-safety.ts                         2   :38 LexicalTraversalError  :105 createPathSafetyGuard
```

**Independent cross-check.** A TypeScript-compiler-API census written from scratch this
session (own program over `extensions/**` + `tests/**`, resolving named imports,
`export … from`, namespace imports, and inline `import(...)` types) found **83 value exports**
with no production consumer outside their own module, all consumed by at least one test, of
which **6 are not referenced inside their own module either**:

```
domain/unsupported-components.ts   SUPPORTED_COMPONENT_KINDS   :11
edge/flag-catalog.ts               CATALOG_VERBS               :154
shared/completion-cache.ts         MARKETPLACE_NAMES_CACHE_SCHEMA :58
shared/errors-bridges.ts           AgentForeignContentError    :24
shared/errors.ts                   ConcurrentUninstallError    :393
shared/markers.ts                  STATE_LOCK_HELD_PREFIX      :24
```

The two instruments agree within their different scopes (Fallow additionally counts type
exports, re-export sites, and star-imported modules). The number is real.

### What this means for `D-07-19`

`D-07-19` reads as if the sweep closes two named instances. It does not: it is a **91-item
remediation in `extensions/` alone**. Many are legitimate design (`REASONS` and its three
sibling tuples derive their union type in the same file; `STATE_SCHEMA`/`STATE_VALIDATOR` are
internal; the `create*` injectable factories exist for exactly the dependency-injection
pattern `CONVENTIONS.md` §"Function Design" prescribes). And `D-07-18` forecloses an
allow-list.

**Three routes, for the planner to choose between:**

1. **Narrow the offender definition to `--production` + not-referenced-inside-its-own-module.**
   That is the 6-item list above plus `MARKETPLACE_VALIDATOR` and `surfacePostCommitWarnings`
   (which *are* referenced internally, so they'd need explicit inclusion). Small, shippable,
   but it does not match `D-07-19`'s wording and would not have caught `DCORE-030`.
2. **Keep the wording and take the 91-item remediation as phase work.** Honest, but it is a
   phase of its own, and each removal has to be checked against whether the test that consumes
   it is the module's *owner* test (which `.claude/rules/typescript-unit-testing.md` requires
   for every module) — an owner test for a one-export module has no other way in.
3. **Recommended: land the gate as a *baseline-pinned* count, not a zero.** Assert the
   `--production --unused-exports` census equals a pinned number with the full list committed
   beside it, so the next addition forces a conscious bump — the exact pattern
   `notify-closed-set-locks.test.ts:29-77` already uses for `REASONS.length === 44`. Then
   remove `MARKETPLACE_VALIDATOR` and `surfacePostCommitWarnings` in this phase and drop the
   pin by two. That closes both named instances, gates the class, needs no allow-list (a pinned
   total is not an allow-list — it names nothing and forgives nothing silently), and does not
   swallow a 91-item sweep.

Route 3 needs a `Claude's Discretion` ruling or a user confirmation, because it changes
`D-07-19`'s "an export with no production consumer outside its own module is an offender" into
"the count of such exports is pinned."

## 6. `__operations` Removal Surface

**The declaration.** `orchestrators/plugin/reinstall-replace.ts:103-104`:

```ts
  /** @internal Test-only bridge operations; production callers omit this. */
  readonly __operations?: ReinstallReplaceOperations;
```

Read at `:192`: `const operations = input.__operations ?? REAL_REINSTALL_REPLACE_OPERATIONS;`
where `REAL_REINSTALL_REPLACE_OPERATIONS` (`:158-182`) is a module-private 22-member record of
the physical bridge functions. The resolved `operations` is threaded to `prepareAllHandles`,
`replaceAll`, and stored on the returned `ReinstallReplacement.operations` (`:89`, also
`@internal`-tagged) so `rollbackReinstalledPlugin` (`:214`) and `finalizeReinstalledPlugin`
(`:221`) compensate through the same owner.

**Every caller.**

| Kind | Site | Form |
|------|------|------|
| Production | `orchestrators/plugin/reinstall-flow.ts:730` | `await transaction.replaceReinstalledPlugin({ … })` — does **not** pass `__operations` |
| Test | `tests/orchestrators/plugin/reinstall-replace.test.ts:143` | inside an input builder: `...(operations !== undefined && { __operations: operations })` |
| Test | `tests/orchestrators/plugin/reinstall-flow.test.ts:5724` | inside `reinstallTransactionWith(operations)`: wraps `REAL_REINSTALL_TRANSACTION.replaceReinstalledPlugin` to splice `__operations` in |

That is **one production call site and two test seams**.

**Recommended production-owned collaborator shape.** `ReinstallTransaction`
(`reinstall-replace.ts:142-148`) already *is* the production-owned seam — `reinstall-flow.ts`
takes it as an explicit parameter (`:181`, `:243`, `:656`) and binds
`REAL_REINSTALL_TRANSACTION` at `:200`. The physical-bridge record is the one collaborator that
did not get enrolled in it. Enrolling it:

```ts
export interface ReinstallTransaction {
  readonly finalizeReinstalledPlugin: typeof finalizeReinstalledPlugin;
  readonly replaceReinstalledPlugin: typeof replaceReinstalledPlugin;
  readonly rollbackReinstalledPlugin: typeof rollbackReinstalledPlugin;
  readonly runPostSuccessMaintenance: typeof runPostSuccessMaintenance;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
  /** The physical bridge operations the replacement schedule performs. */
  readonly replaceOperations: ReinstallReplaceOperations;
}

export async function replaceReinstalledPlugin(
  input: ReplaceReinstalledPluginInput,   // `__operations` removed
  operations: ReinstallReplaceOperations, // required, no default
): Promise<ReinstallReplacement>
```

`REAL_REINSTALL_TRANSACTION` gains `replaceOperations: REAL_REINSTALL_REPLACE_OPERATIONS` and
`REAL_REINSTALL_REPLACE_OPERATIONS` becomes exported. `reinstall-flow.ts:730` becomes
`transaction.replaceReinstalledPlugin({ … }, transaction.replaceOperations)`.

**Call sites that move: 6.** The interface (`:142`), the real binding (`:151`), the function
signature (`:188`), the internal read (`:192`), the production invocation
(`reinstall-flow.ts:730`), and each test's construction of the transaction. Both tests get
*simpler*: `reinstall-flow.test.ts:5715-5724` collapses from a `replaceReinstalledPlugin`
wrapper to `{ ...REAL_REINSTALL_TRANSACTION, replaceOperations: operations }`, and
`reinstall-replace.test.ts` passes `operations` as the second argument instead of splicing it
into the input.

This is a real production responsibility (the transaction owns *which* physical bridges the
schedule drives, which is what makes compensation and replacement use the same owner), not a
forwarding seam, so it satisfies both `D-07-18` and Phase 6's no-forwarding-seam rule.

**No default parameter.** `D-05-01` forbids "unused defaults"; a `= REAL_…` default would be one,
since production always supplies it through the transaction.

**Other `__`-prefixed / test-only production surface still under `extensions/`** — the full
census:

| Site | Kind | Disposition |
|------|------|-------------|
| `orchestrators/plugin/reinstall-flow.ts:138`, `:151` (forwarded at `:531`) | `readonly __deps?: ReinstallPluginDeps` on two options interfaces | **A second live `MF-DEC-07` offender.** Not named in `D-07-18`. A gate that fires on `__`-prefixed members goes red here too. Must be in scope or explicitly excluded. |
| `orchestrators/plugin/reinstall-replace.ts:89` | `/** @internal */ readonly operations` on `ReinstallReplacement` | Legitimate — the compensation ledger genuinely carries its owner. Drop the `@internal` tag when `__operations` goes. |
| `orchestrators/plugin/info.ts:2483-2485` | Orphaned comment for a removed test-only re-export | Delete. Violates `.claude/rules/typescript-comments.md` §"Narration of code that no longer exists". |
| `orchestrators/plugin/{install-flow.ts:163, fetch.ts:111, info.ts:127}` | `cloneCacheSeam?` fields documented "Test-only clone-cache seam override" | Optional *typed* seams, not `__deps` bags. Phase 5 authorized narrow production ports for probe sequences; these read as the authorized form. Recommend recording them as classified-and-kept rather than silently ignoring them. |
| `domain/plugin-root.ts:16` | `declare const __absolutePluginRootBrand: unique symbol` | Not a seam — a nominal-type brand. Any `__`-prefix gate needs an explicit carve-out for `declare const … : unique symbol`, or it false-positives. |

Zero `_setXForTest` / `__test_*` seams survive; every hit for those tokens is a comment
recording that the pattern was removed.

## 7. Closed-Set Enrollment for `SCN-F025`

**Correction to the finding's `sourceRefs`.** The finding names
`extensions/pi-claude-marketplace/shared/concerns/hooks.ts` for both symbols. Only one lives
there:

- `ClaudeHookEvent` — `shared/concerns/hooks.ts:57-67`, a 10-member literal union:
  `"SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PreCompact" | "PostCompact" | "SessionEnd" | "Stop" | "StopFailure"`.
- `Dependency` — **`shared/concerns/soft-dep.ts:31`**: `export type Dependency = "agents" | "mcp";`

**Real production consumers.**

| Symbol | Production consumers |
|--------|---------------------|
| `ClaudeHookEvent` | `domain/components/hook-events.ts:5` (type-only import), used at `:52` as `as const satisfies readonly ClaudeHookEvent[]` on `BUCKET_A_EVENTS` (10 members) and at `:80` on `TOOL_EVENTS` (3 members) via the derived `BucketAEvent`. `shared/concerns/hooks.ts` itself derives `ToolEvent` (`:81`) and `HookSummaryEntry` (`:83-92`) from it. |
| `Dependency` | Declared and used only within `shared/concerns/soft-dep.ts`. The module's own doc (`:26-30`) records that "nothing iterates the members at runtime, so the union type alone is the sole declaration site" — the paired constants `SOFT_DEP_MARKER_AGENTS` / `SOFT_DEP_MARKER_MCP` (`:34-35`) are module-private `Reason` values. |

**What an enrollment gate must assert — and the falsified claim underneath it.**
`hook-events.ts:58-65` documents that "adding/removing a value from `BUCKET_A_EVENTS` here
without the matching `ClaudeHookEvent` edit (or vice versa) breaks the typecheck at that
assertion site." **The "or vice versa" half is false**, and this session proved it by running
the compiler:

```ts
// probe.ts
type ClaudeHookEvent = "A" | "B" | "NEWLY_ADDED";
const BUCKET = ["A", "B"] as const satisfies readonly ClaudeHookEvent[];
export type X = (typeof BUCKET)[number];
```

```
$ node_modules/.bin/tsc --noEmit --strict probe.ts
tsc exit=0
```

`satisfies readonly T[]` proves every tuple member is a `T`. It says nothing about whether
every `T` appears in the tuple. So a member added to `ClaudeHookEvent` and never registered in
`BUCKET_A_EVENTS` compiles clean and silently never routes — the "optional-field
silent-omission" class this milestone has hit repeatedly. That is the concrete, mechanically
detectable content of `SCN-F025`'s "no shared-event bidirectional proof", and it is also the
`hook-events.ts` doc comment that needs correcting.

**The two house patterns to mirror.**

`tests/architecture/notify-closed-set-locks.test.ts` (77 lines) — the **exact-length
tripwire**. Imports the four runtime tuples and asserts `REASONS.length === 44`,
`STATUS_TOKENS.length === 24`, `PLUGIN_STATUSES.length === 19`,
`MARKETPLACE_STATUSES.length === 7`. Its header (`:8-16`) states the reasoning precisely: the
compile-time proofs catch removal and rename, additive drift is silently absorbed, and the
length assertion is the deliberate-bump prompt. Each count carries a per-bump comment naming
the requirement ID that grew it.

`tests/architecture/markers-snapshot.test.ts` (76 lines) — the **byte-for-byte snapshot**.
`assert.equal(GENERATED_AGENT_MARKER, "generatedBy: pi-claude-marketplace")` and four
siblings, each with a doc block explaining why the bytes are a user contract.

**Recommended enrollment shape.** `ClaudeHookEvent` has no runtime tuple in `shared/`, so a
length assertion has nothing to count. The gate that actually holds is the **bidirectional
pin**: assert `BUCKET_A_EVENTS.length === 10` (the tripwire half, mirroring
`notify-closed-set-locks`) plus a compile-time reverse proof in `hook-events.ts` such as

```ts
type _EveryClaudeHookEventIsRegistered =
  Exclude<ClaudeHookEvent, BucketAEvent> extends never ? true : never;
```

so both directions break the typecheck. For `Dependency`, the honest gate is a two-member
length pin against a runtime tuple that does not exist today — so either introduce one (which
the module's own doc argues against) or assert the closed set through the two `Reason` members
it maps to. **Recommend: enroll `Dependency` by pinning that `softDepMarkers` handles exactly
two flags and that both marker literals are `REASONS` members**, which uses existing runtime
surface rather than adding a tuple purely to be counted.

## 8. `partial-vocabulary-guard` Scope Extension

**Current target set** — `collectGuardedSources()`,
`tests/architecture/partial-vocabulary-guard.test.ts:80-107`:

1. Every `.ts` under `extensions/pi-claude-marketplace/**` (recursive, `readdirSync(…, { recursive: true })` at `:67`)
2. `docs/output-catalog.md`, `docs/messaging-style-guide.md` (`:86-87`)
3. `tests/architecture/*.ts` — **non-recursive** (`readdirSync(ARCH_DIR, { withFileTypes: true })` at `:89`), with this guard file itself excluded (`:95`)
4. `tests/architecture/catalog-uat/catalog-contract.test.ts` (`:103`, named individually)
5. `docs/prd/pi-claude-marketplace-prd.md` — scanned separately at `:358` with an allowlist mask

**What it misses:** all of `tests/{bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**` — 271 `.ts` files. That is `OPIB-F07` concretely.

**Correction to the finding.** It names `tests/orchestrators/plugin/install.test.ts`. That file
does not exist; the install suite was split into `install-flow.test.ts`,
`install-outcome.test.ts`, `install-clone-probe.test.ts`, `install-declared-enabled.test.ts`,
`install-disable-cascade.test.ts`, and `install.messaging.test.ts`. The stale terminology is in
`install-flow.test.ts`.

**Repair census.** Applying the guard's own token lists (`ABSENT_FLAGS`,
`ABSENT_STATUS_LITERALS`, `ABSENT_RENDER_TOKENS`, `ABSENT_IDENTIFIERS` at `:160-199`, and
`ABSENT_FORCE_PROSE` at `:226-232`) to the 271 currently-unscanned test files:

| File | Matching lines |
|------|---------------|
| `tests/orchestrators/plugin/install-flow.test.ts` | 37 |
| `tests/orchestrators/plugin/update-flow.test.ts` | 37 |
| `tests/orchestrators/plugin/list-flow.test.ts` | 29 |
| `tests/shared/notification-dispatch.test.ts` | 9 |
| `tests/orchestrators/plugin/info.test.ts` | 7 |
| `tests/domain/plugin-resolver.test.ts` | 4 |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 4 |
| `tests/orchestrators/marketplace/update.test.ts` | 3 |
| `tests/edge/handlers/plugin/reinstall.test.ts` | 3 |
| `tests/platform/pi-api.test.ts` | 2 |
| `tests/persistence/state-io.test.ts` | 1 |
| `tests/orchestrators/plugin/reinstall-record.test.ts` | 1 |
| **Total** | **137 lines across 12 files** |

Representative stale forms in `install-flow.test.ts`: test titles
`"PHOOK-04: install --force stages a strict-subset hooks.json…"` (`:4242`),
`"PHOOK-04 / D-71-02: install --force drops only the unsupportable matcher group…"` (`:4296`),
`"SEV-01 / SEV-02 / FSTAT-07 / D-71-06: partial-hook install blocks without --force… degrades to info force-installed with --force"` (`:4353`), plus prose at `:488`, `:591`, `:874`, `:4234`, `:4347-4350`, `:4374-4390`.

**Three of those 137 hits are out-of-scope homonyms and need an allowlist or narrower tokens** —
extending the guard naively turns them into false failures:

- `tests/platform/pi-api.test.ts:96` — `void ({ role: "unsupported" } satisfies PiBoundary.AgentMessage);`
- `tests/platform/pi-api.test.ts:100` — `void ("unsupported" satisfies PiBoundary.StopReason);`
- `tests/persistence/state-io.test.ts:462` — `"unsupported": []` (a JSON fixture key)

`tests/orchestrators/plugin/reinstall-record.test.ts:249` — `reasons: ["unsupported"]` — is
**not** a homonym: the live `REASONS` members are `"unsupported source"`,
`"unsupported component"`, `"unsupported hooks"` (`shared/notification-types.ts:14-16`), all with
an interior space. A bare `"unsupported"` reason is genuine stale vocabulary.

The guard's `filesContaining` / `filesMatching` helpers already support a `.filter(f => f !== ALLOW)` allowlist pattern (used at `:252` and `:298-309`), so per-token allowlists are the established form.

## 9. `no-orchestrator-network` Extension

**Current `FORBIDDEN_TARGETS`, verbatim** (`tests/architecture/no-orchestrator-network.test.ts:67-135`, 20 entries; the inline rationale comments are omitted here but are part of the array):

```
extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
extensions/pi-claude-marketplace/domain/plugin-resolver.ts
```

**Current `FORBIDDEN_PATTERNS`, verbatim** (`:137-142`):

```ts
{ name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
{ name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
{ name: "gitOps reference",          pattern: /\bgitOps\b/ },
{ name: "refreshGitHubClone reference", pattern: /\brefreshGitHubClone\b/ },
```

**The three marketplace targets are network-free today.** Running the real strip-and-match
against each:

```
CLEAN  extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts   (624 lines)
CLEAN  extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts         (107 lines)
CLEAN  extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts       (799 lines)
```

Their import blocks confirm it: `autoupdate.ts` imports only `node:path`, persistence, shared,
transaction, and two siblings; `list.ts` imports persistence + shared + `list.messaging.ts`;
`remove.ts` imports `node:fs/promises`, `node:path`, persistence, shared, transaction,
`../plugin/clone-gc.ts`, and two siblings. Adding all three keeps the gate green. Note
`autoupdate.ts:60-61` and `list.ts:7-9` carry header comments that literally name
`platform/git` and `DEFAULT_GIT_OPS` — `stripComments` removes them, which is exactly why the
strip step is mandatory and why this is a good benign near-miss control (`D-07-04`).

**The dynamic-import form that the static pattern misses.**
`orchestrators/plugin/fetch.ts:483`, inside `reasonedRow`:

```ts
  const { resolveStrict } = await import("../../domain/plugin-resolver.ts");
```

Measured: `/from\s+["'][^"']*platform\/git[^"']*["']/` returns `false` on
`await import("../../platform/git.ts")`. A companion pattern
`/import\(\s*["'][^"']*platform\/git[^"']*["']\s*\)/` returns `true` on that string and
`false` on `import("../../domain/plugin-resolver.ts")` — so it fires on the real hazard and
not on the existing legitimate dynamic import.

The whole `extensions/` tree contains exactly one runtime dynamic import (`fetch.ts:483`) and
two inline `import(...)` type positions (`reconcile/backfill.ts:451`, `reconcile/apply.ts:250`),
so a dynamic-import pattern has a very small false-positive surface.

**`OPEFR-F007`'s disposition.** The `fetch.ts:483` import is documented at `:468-472` as a
re-resolve for byte-parity with `list`, but the doc explains *what it re-resolves*, not *why it
is dynamic*. The finding asks for a cycle or load-cost reason. Cheapest close: add one sentence
of rationale (or make it static if no cycle exists — `orchestrators/plugin/fetch.ts` →
`domain/plugin-resolver.ts` is a legal zone edge and `fetch.ts` already imports other `domain/`
modules statically) and record the outcome.

**Same blind spot exists on the `D-11` pair, and it is new evidence.** The joined regexes at
`import-boundaries.test.ts:229-234` were probed against synthesized specifiers this session:

| Violation form | `PLUGIN_LEDGER_IMPORT` |
|----------------|-----------------------|
| `import { x } from "../plugin/install-flow.ts";` | MATCH |
| `import type { X } from "../plugin/uninstall.ts";` | MATCH |
| `export { x } from "../plugin/enable-disable.ts";` | MATCH |
| `const m = await import("../plugin/install-flow.ts");` | **MISS** |
| `type T = import("../plugin/install-flow.ts").X;` | **MISS** |

`MARKETPLACE_LEDGER_IMPORT` behaves identically (MATCH on
`import { addMarketplace } from "../marketplace/add.ts"`, MISS on
`await import("../marketplace/add.ts")`). All nine ledger paths resolve on disk today, so
`D-07-08`'s per-name positive control would currently pass; the *pattern-form* gap is the live
half.

## 10. Changed-Pair Selector Mechanics

`scripts/test-coverage-direct.mjs`, 520 lines. `projectRoot` is a module-level
`const` resolved from `import.meta.url` (`:10`) — **not** injectable, unlike
`assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot)` at `:305`.

**How `gitLines` swallows failures** (`:106-119`):

```js
function gitLines(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
```

`stderr` is discarded (`stdio[2] === "ignore"`), the exit status is not read, and every failure
class — non-zero exit, missing binary, not-a-repo — collapses to `[]`. `[]` is
indistinguishable from "this git command legitimately produced no lines."

**What `changedPaths()` returns when `origin/main` is absent** (`:121-146`). Measured in a
purpose-built temp repository this session:

```
$ git merge-base HEAD origin/main
fatal: Not a valid object name origin/main        exit=128
$ git rev-parse --verify main                     exit=0   be73e6b…
$ git rev-parse --abbrev-ref '@{upstream}'
fatal: no upstream configured for branch 'main'   exit=128
$ git rev-parse --verify HEAD~1                   exit=0   ef69ea0…
$ git diff --name-only --diff-filter=ACMR HEAD    exit=0   (no output)
```

So `gitLines(["merge-base","HEAD","origin/main"])` returns `[]`, `mergeBase` is `undefined`,
and the **entire `mergeBase...HEAD` diff branch at `:126-135` is skipped silently**. The three
surviving commands (`diff … HEAD`, `diff --cached`, `ls-files --others --exclude-standard`) see
only uncommitted work. On a clean tree `changedPaths()` returns `[]`,
`pairsForChangedPaths()` returns `[]`, and `main()` at `:505-508` prints
`No changed source-test pairs.` and exits **0**.

That is the fail-open `D-07-14` targets: a broken base and a docs-only commit are
byte-identical outcomes.

**Shallow-clone behavior**, measured on a `git clone --depth 1`:

```
git rev-parse --is-shallow-repository  -> true
git rev-parse --verify origin/main     -> exit=0
git merge-base HEAD origin/main        -> exit=0
git rev-parse --verify HEAD~1
fatal: Needed a single revision        -> exit=128
```

`origin/main` and `merge-base` survive a depth-1 clone; **`HEAD~1` does not**. So the
`D-07-13` chain's *last* candidate is the one a shallow clone breaks, not the first. The
realistic CI shallow failure is a checkout that never fetched `origin/main` at all — which is
case (a) above.

**What `scripts/test-coverage-direct.negative.mjs` (292 lines) already covers** — new cases
must not duplicate any of these:

| Target | States planted |
|--------|---------------|
| `assertCompleteCoverage` | type-only escape; zero-record refusal; complete verdict; shortfall shape; two-record ambiguity; injected-root record selection; out-of-every-root record passed over |
| the gate command (via `spawnSync`) | `Path is outside the project:` refusal; `Not a corresponding test path:` refusal |
| `assertReportComplete` | passing state; missing row; repeated `sourcePath`; repeated `testPath`; non-round-tripping mapping; extra unenumerated row |
| `verdictFor` (`test-coverage-direct.report.mjs`) | complete; type-only; accepted-shortfall; wrong-module shortfall rethrow; focused-test-failure rethrow |

**Nothing touches `gitLines`, `changedPaths`, base selection, `pairsForChangedPaths`, or
`isPairablePath`.** The new `D-07-15` cases are entirely additive.

**Existing machinery reusable for the git fixtures.** The harness already opens a
`mkdtemp(path.join(tmpdir(), "direct-coverage-gate-"))` root at `:11`, builds files under it,
and drives the gate as a subprocess with `spawnSync(process.execPath, [gatePath, arg], { cwd: projectRoot, encoding: "utf8" })` (`:126-133`, `:135-142`). It has **no** `git init` machinery —
that is new.

**Two routes for reaching the selector from a fixture repo:**

1. **Recommended, matching the file's own precedent.** Give `changedPaths()` /
   `gitLines()` an optional root parameter exactly as `assertCompleteCoverage` already has
   (`selectedProjectRoot = projectRoot`), export a `selectBase(root)` that returns the chosen
   candidate, and call them directly from the negative harness against `mkdtemp` repos. No
   subprocess, fastest, and it makes the printed base assertable as a return value rather than
   scraped from stdout.
2. Copy the gate script into the fixture repo and `spawnSync` it with `cwd` set there. Works
   without touching the script, but `projectRoot` derives from `import.meta.url`, so the copy
   has to sit at the same relative depth (`<root>/scripts/`) — brittle.

Fixture construction is cheap: `git init -q -b main`, `git config user.{email,name}`, two
commits, and for the shallow case `git clone -q --depth 1 --no-local file://<src> <dst>`. All
offline. Total wall time for all three fixtures in this session's probe was under 2 seconds.

## 11. Complexity and Duplication Budget

**Both ceilings are live and independent.** ESLint: `sonarjs/cognitive-complexity: ["error", 15]`
(`eslint.config.js:77`), turned `"off"` for `tests/**/*.ts` at `eslint.config.js:315`. Fallow:
`health.maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0`, **zero**
`thresholdOverrides` in `.fallowrc.json`.

**Critical asymmetry the planner must know: ESLint's cognitive-complexity rule is OFF for
tests, Fallow's is NOT.** `eslint.config.js:308-322` disables `sonarjs/cognitive-complexity`
(along with `no-nested-conditional`, `no-identical-functions`, and others) for `tests/**/*.ts`.
Fallow's health gate analyses **12 606 units repo-wide** including every test file
(`.fallowrc.json` has no test exclusion; `boundaries.coverage.allowUnmatched` lists `tests/**`
but that governs *zone coverage*, not health). Current state: `✗ 0 above threshold · 12606
analyzed · maintainability 92.0 (good) (0.16s)`. So a new gate helper in `tests/architecture/`
will pass `npm run lint` and can still fail `npm run fallow`. That is the trap.

**Ranked breach risk for the three planned mechanisms:**

1. **The visitation-reporting temp-root scan — highest risk.** A single function that walks a
   target list, copies each file into a temp root, mutates one, runs the scan, deep-compares the
   visited set, and asserts the offender/benign outcomes accumulates branches fast. `maxUnitSize:
   60` is the binding constraint before `maxCognitive`. **Shape that avoids it:** three separate
   named functions with no shared branching —
   `materializeTargets(root, targets): Promise<void>` (copy only),
   `plantOffender(root, target, mutate): Promise<void>` (one write),
   `runScanReporting(root, targets, patterns): Promise<ScanReport>` (delegate to the real
   `assertNoForbiddenSurface`). Each is under 20 lines with at most one loop and one conditional.
2. **The registry meta-gate — medium risk.** "Scan `tests/architecture/**` for production paths
   named outside the registry" needs a path-shaped regex, a per-file loop, a registry-membership
   check, a self-exclusion, and an allowance for the four deliberate non-paths in
   `source-scan.test.ts` (`renamed-away.ts`, `not-yet-written.ts`, `other-missing.ts`,
   `not-this-one.ts` — measured: those are the *only* four unresolved literal paths among 89 named
   across `tests/architecture/*.ts`). Five conditions in one loop is right at the cognitive
   ceiling. **Shape that avoids it:** a pure `namedProductionPaths(source): string[]` extractor
   and a separate set-difference assertion, so neither function carries both the parsing and the
   policy.
3. **Effective-config resolution — lowest risk.** `calculateConfigForFile` does the work; the
   gate reads `rules[name][0]` and `rules[name][1].zones`. Straight-line code. The 229-file
   `no-console` sweep is one `for` loop with one `if`.

**Duplication.** `duplicates.threshold: 3`; `ignoredClones` holds exactly two entries
(`dup:cc950b18:2`, `dup:6d8c002d:2`). Current whole-repo state: **873 duplicated lines (1.1%)
across 38 files**, and `fallow dupes --fail-on-issues` exits **0** — so there is headroom, but
the two largest reported clone families are both in production (`bridges/agents/stage.ts` ↔
`bridges/commands/stage.ts`, and two groups inside `orchestrators/plugin/shared.ts`).

**Temp-root fixture setup is a real dupes risk** because the shape is nearly identical per gate:
`mkdtemp` → `mkdir -p` the target's directory chain → `copyFile` → `readFile`+`replace`+`writeFile`
→ run scan → `assert` → `rm -rf` in a `finally`. Three gates writing that inline is a
three-occurrence clone, which is exactly `threshold: 3`. **Extract it once**
(`tests/architecture/temp-root-control.ts`, a non-`.test.ts` support module in the same
directory as `source-scan.ts`, so it registers no cases — the `D-98-09` rule) and have every
gate call it. `source-scan.ts` is the precedent for a support module living beside the gates.

**Two more gates that must stay green after any change:**
`tests/architecture/unit-suite-glob-completeness.test.ts` verifies every `tests/**` file is
matched by the `npm test` glob — a new support module under `tests/architecture/` that is not a
`*.test.ts` is fine (the glob is `**/*.test.ts`), but check its exact assertion before adding
files. And `scripts/check-corresponding-tests.mjs` enforces the source↔test pairing rule; its
`nonCorrespondingRoots` set (mirrored at `scripts/test-coverage-direct.mjs:151`) already exempts
`architecture`, so new `tests/architecture/` files need no production pair.

## 12. Composed-Target Discoverability — the Baseline

A literal-match stale-path scan over `tests/architecture/*.ts` finds **89 distinct literal
repo-relative paths**, of which **4 do not resolve** — all four deliberate, all four in
`source-scan.test.ts`:

```
extensions/pi-claude-marketplace/orchestrators/plugin/renamed-away.ts     (:21)
extensions/pi-claude-marketplace/orchestrators/plugin/not-yet-written.ts  (:32, :35)
extensions/pi-claude-marketplace/orchestrators/plugin/other-missing.ts    (:42)
extensions/pi-claude-marketplace/orchestrators/plugin/not-this-one.ts     (:45)
```

Those are the WR-06 proof's own fixtures. Any `D-07-06` meta-gate needs an explicit,
justified allowance for them.

**The composed paths the literal scan cannot see** — this is what criterion 4 is about:

| Gate | Composition site | Composed targets |
|------|-----------------|------------------|
| `import-boundaries.test.ts` | `EXPECTED_FORBIDDEN` (`:66-113`), built from `` `${EXTENSION_ROOT}/edge` `` templates with `EXTENSION_ROOT = "./extensions/pi-claude-marketplace"` (`:48`) | 8 zone targets + 32 `from` entries = **40** |
| `import-boundaries.test.ts` | `PLUGIN_LEDGERS` (`:218-224`) and `MARKETPLACE_LEDGERS` (`:225`) joined into regexes at `:229-234`; `orchestratorFiles()` composes `` `${ORCHESTRATORS_REL}/${subdir}` `` (`:240`); `:267` composes `` `${ORCHESTRATORS_REL}/plugin/${name}.ts` `` | **9** module paths (5 plugin + 4 marketplace) |
| `hooks-lifecycle.test.ts` | `ORCH_DIR` (`:44-47`) + `path.join(ORCH_DIR, "install-flow.ts")` (`:53`), `"uninstall.ts"` (`:54`), `"reinstall-flow.ts"` (`:55`), `"update-swap.ts"` (`:56`); `EVENT_ROUTER_PATH` (`:48-51`); `readdir(ORCH_DIR)` walk at `:307` | **5** named + one directory walk |
| `partial-vocabulary-guard.test.ts` | `EXT_ROOT` (`:51`), `ARCH_DIR` (`:52`), `path.join(REPO_ROOT, "docs", …)` (`:86-87`), `path.join(ARCH_DIR, "catalog-uat", "catalog-contract.test.ts")` (`:103`), `PRD_REL` (`:358`) | 2 directory walks + **4** named files |
| 15 other gates | local `REPO_ROOT` + `path.join`, listed in §2 | various |

All nine ledger paths and all four `hooks-lifecycle` paths resolve on disk **today** — the
Phase 6 repairs held. What has not been fixed is that *nothing proves they still will*.

## Runtime State Inventory

This phase changes test code, one gate script, and one production module's collaborator
wiring. No stored data, service configuration, or OS registration carries any of the renamed
or restructured names.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | None — verified: the phase touches no `state.json` schema, no `claude-plugins.json` key, no persisted record field. `ReinstallReplaceOperations` is an in-memory function record, never serialized (`reinstall-replace.ts:158-182`). | none |
| Live service config | None — verified: no CI job, npm script, or `.pre-commit-config.yaml` hook names `__operations`, `loadZones`, or any gate function this phase renames. `npm run check` invokes `test:coverage:direct:negative`, which stays the same script path. | none |
| OS-registered state | None — verified: no `scripts/pi.sh`, systemd, or Task Scheduler surface references these symbols. | none |
| Secrets and env vars | None — verified: the only env vars in play are `TEST_CONCURRENCY`, `PI_CODING_AGENT_DIR`, `PI_CM_E2E_REF`, `PI_CLAUDE_MARKETPLACE_DEBUG`. None is renamed. | none |
| Build artifacts | None — verified: `noEmit: true`, no bundler, no compiled output. Node runs `.ts` sources directly, so a signature change takes effect on the next `node --test` with no reinstall. | none |

**One cross-cutting item that is *not* runtime state but behaves like it.** If `D-07-05`'s
registry lands, `scripts/check-phase-06-hub-ledger.mjs:468,472` still validates its own census
paths independently (`OWNER_PAIRS`, `EXTENSION_ROOT` at `:39-40`) and does not read the new
registry. `D-07-07` puts `.mjs` scripts out of scope, so that is expected — but the planner
should record it so a later reader does not assume one registry covers both.

## Standard Stack

No packages are installed by this phase. Everything used is already a dependency, verified
present and at these versions this session:

### Core

| Tool | Version | Purpose | Why standard here |
|------|---------|---------|-------------------|
| `node:test` | Node 26.8.2 built-in | Gate runner | `.claude/rules/typescript-unit-testing.md` forbids adding another runner |
| `node:assert/strict` | built-in | Assertions | Same rule |
| `eslint` | 10.8.1 | `calculateConfigForFile` effective-config resolution | Already the lint gate; `D-07-09` names it |
| `typescript` | 6.0.3 | `tsc --noEmit` typecheck; compile-time closed-set proofs | Already the typecheck gate |
| `fallow` | 3.20.0 | `dead-code --production` unowned-export census; health/dupes ceilings | Already in `npm run check`; `--production` avoids the `D-07-20` config change |
| `git` | 2.55.0 | Temp-repo fixtures for base-selection proofs | Already required by the gate under test |

### Supporting

| Module | Purpose | When to use |
|--------|---------|-------------|
| `node:fs/promises` (`mkdtemp`, `cp`, `rm`, `readFile`, `writeFile`) | Temp-root controls | `D-07-01`; `D-98-10` forbids a `grep` subprocess for reads |
| `node:child_process` (`execFileSync`, `spawnSync`) | Driving `git` and the gate script in fixtures | Already the pattern in both `.mjs` harnesses |
| `strong-mock` 9.2.2 | Strict interaction mocks | Available and named by the rules file, but architecture gates read files and configs rather than collaborate with objects — most Phase 7 work needs it not at all |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|-----------|----------|----------|
| `fallow --production` for the unowned-export census | TypeScript compiler API | Written and run this session; agrees with Fallow, but adds a hand-maintained instrument that then itself needs gating. Fallow is already in `npm run check`. |
| `fallow --production` | Editing `.fallowrc.json` | Forbidden by `D-07-20`. `--production` gets the identical answer with no config change. |
| `calculateConfigForFile` | Re-implementing the flat-config cascade | Explicitly forbidden by `D-07-09`, and the cascade has non-obvious rules (global `ignores` are absolute; a rules block's `files` glob decides applicability). |
| Linting `tests/fixtures/bad-imports/**` through the real config | Not possible as-is | Globally ignored at `eslint.config.js:303`, and BLOCK C's `files` glob excludes it. See §3 trap 2. |

**Installation:** none. `npm ci` already provides everything.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every tool it uses is already
in `package.json` and `package-lock.json`, was resolved from the existing `node_modules`
during this research, and reported its version from the installed copy rather than from a
registry lookup. `fallow` additionally self-verified: `verified: yes (cache hit at
node_modules/@fallow-cli/linux-x64-gnu/.fallow-verified); fallow 3.20.0 signed`.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### How a Phase 7 gate is shaped

```
                 ┌──────────────────────────────────────────┐
                 │  tests/architecture/<registry>.ts          │
                 │  full literal repo-relative paths only     │
                 │  (D-07-05)                                 │
                 └───────┬───────────────────────┬────────────┘
                         │ imported by            │ scanned by
                         ▼                        ▼
         ┌───────────────────────────┐   ┌────────────────────────────┐
         │  each gate *.test.ts       │   │  registry meta-gate         │
         │  owns: patterns, message   │   │  (D-07-06) — a production    │
         │  owns: nothing composed    │   │  path named outside the      │
         └───────┬───────────────┬────┘   │  registry is an offender     │
                 │               │        └──────────┬──────────────────┘
      real-tree  │               │ temp-root         │ same controls
      assertion  │               │ controls          │
                 ▼               ▼                   ▼
   ┌───────────────────┐  ┌─────────────────────────────────────────┐
   │ source-scan.ts     │  │ temp-root-control.ts (extract once —     │
   │ assertNoForbidden  │◄─┤ dupes threshold is 3)                    │
   │ Surface(…, {root}) │  │  materializeTargets → plantOffender →    │
   │ → ScanReport       │  │  runScanReporting                        │
   │   { visited,       │  └─────────────────────────────────────────┘
   │     waived }       │
   └─────────┬──────────┘
             │ visited set
             ▼
   deep-compare visited against the declared target list  (D-07-03)
```

Tool-invoking gates (ESLint, Fallow) take the other branch: a committed in-repo fixture config
that spreads the real config and appends exactly one mutation, driven through the tool's own
programmatic API or its `--root`/`--config` flags.

### Recommended file layout

```
tests/architecture/
├── source-scan.ts                 # existing — gains { root } and a ScanReport return
├── source-scan.test.ts            # existing gate-the-gate — gains temp-root cases
├── <registry>.ts                  # NEW: literal repo-relative target paths (D-07-05)
├── <registry>.test.ts             # NEW: the self-hosting meta-gate (D-07-06)
├── temp-root-control.ts           # NEW: shared mkdtemp/copy/mutate helper (dupes)
├── eslint-effective-config.test.ts# NEW: replaces hooks-dispatch.test.ts's scrape (D-07-12)
└── …existing gates, each importing its targets from <registry>

tests/fixtures/eslint-probe/
├── blanket-no-console.config.js   # NEW: real config + one appended override
├── zone-substitution.config.js    # NEW: real config + one substituted zone (>=1 zone!)
└── rule-off.config.js             # NEW: real config + rule turned off
```

### Pattern 1: Temp-root offender derived from the real target

**What:** Copy the real file, mutate the copy, scan the temp root.
**When to use:** Every file-scanning gate (`D-07-01`).
**Example** (shape verified against `source-scan.ts`'s current behavior; not yet written):

```ts
// Source: derived from tests/architecture/source-scan.ts:66-99 and the mkdtemp pattern
// at scripts/test-coverage-direct.negative.mjs:11
const root = await mkdtemp(path.join(tmpdir(), "gate-control-"));
try {
  await materializeTargets(root, TARGETS);        // benign control lives here unmutated

  // offender: derived from the real file, so it cannot drift
  const target = TARGETS[0]!;
  const real = await readFile(path.join(REPO_ROOT, target), "utf8");
  await writeFile(
    path.join(root, target),
    `${real}\nconst gitOps = DEFAULT_GIT_OPS;\n`,
  );

  await assert.rejects(
    () => assertNoForbiddenSurface(TARGETS, PATTERNS, describe, { root }),
    /gitOps surface detected/,
  );
} finally {
  await rm(root, { force: true, recursive: true });
}
```

### Pattern 2: Effective-config offender by composition

**What:** A fixture config file that spreads the real config and appends one block.
**When to use:** Both `GGAT-03` gaps (`D-07-02`, `D-07-10`).
**Example** (this exact file was written and run this session; it produced
`no-console: [0,{}]` on `domain/manifest.ts`, which the real config resolves to `[2,{}]`):

```js
// tests/fixtures/eslint-probe/blanket-no-console.config.js
import real from "../../../eslint.config.js";

export default [
  ...real,
  { files: ["**/*.ts"], rules: { "no-console": "off" } },
];
```

```ts
// the gate side
const offender = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: "tests/fixtures/eslint-probe/blanket-no-console.config.js",
});
const resolved = await offender.calculateConfigForFile(
  "extensions/pi-claude-marketplace/domain/manifest.ts",
);
assert.equal(resolved.rules["no-console"][0], 0); // proves the gate would see the flip
```

### Pattern 3: Per-name positive control for a joined regex

**What:** Synthesize the exact specifier a violation would use, per name (`D-07-08`).
**When to use:** `PLUGIN_LEDGERS` / `MARKETPLACE_LEDGERS` and any future joined pattern.
**Example** (this loop was run this session; all nine names matched their static form):

```ts
for (const name of PLUGIN_LEDGERS) {
  assert.match(
    `import { x } from "../plugin/${name}.ts";`,
    PLUGIN_LEDGER_IMPORT,
    `the joined pattern no longer matches a violation naming ${name} -- the regex drifted from its name list`,
  );
  // the target must also still resolve, or the pattern guards a file that is gone
  assert.ok(existsSync(path.join(REPO_ROOT, `${ORCHESTRATORS_REL}/plugin/${name}.ts`)));
}
```

### Anti-Patterns to Avoid

- **Reading a config's raw source and matching on it.** Both `GGAT-03` findings are this
  anti-pattern (`loadZones()` at `import-boundaries.test.ts:34-46`,
  the regex scrape at `hooks-dispatch.test.ts:52-71`). Resolve the effective config instead.
- **Leaving a superseded gate in place.** `D-07-12` deletes the scrape rather than keeping both.
  `markers-snapshot.test.ts:17-20` shows the cost of not doing this: it points readers at
  `tests/architecture/no-legacy-markers.test.ts`, which does not exist.
- **Asserting a rule is configured.** `CONVENTIONS.md` states it outright: a gate wants a test
  that plants the violation, not one that reads the config. `import-x/no-cycle` was
  configured-but-inert for a period behind exactly such a test.
- **Copying the temp-root fixture setup into each gate.** `duplicates.threshold: 3` means the
  third copy is a finding.
- **Trusting `satisfies readonly T[]` as a two-way pin.** Falsified in §7 with `tsc` output.
- **Adding a `__`-prefixed options member.** `D-05-01` names them explicitly; there are two live
  offenders (§6) and the phase should not add a third.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|------------|-------------|-----|
| Resolving which ESLint rules apply to a file | A flat-config cascade walker | `ESLint#calculateConfigForFile` | `D-07-09` forbids it, and the cascade has non-obvious rules — global `ignores` are absolute and cannot be re-enabled by a later block; a rules block's `files` glob decides applicability; severities come back numeric. Measured working. |
| Finding exports with no production consumer | A TypeScript-compiler-API import-graph walker | `fallow dead-code --production --unused-exports` | Already in the stack, 0.42 s, handles `export … from` chains and namespace imports. A from-scratch census was written this session and agrees with it; it is 90 more lines to maintain and gate. |
| Enabling Fallow production mode for one analysis | Editing `.fallowrc.json` | `fallow --production` (per-invocation flag) | `D-07-20` freezes the config. The flag gets the same answer and leaves `production: false` and `includeEntryExports` untouched. |
| Running a gate against a mutated Fallow config | Mutating the repo's config in a test | `fallow --root <temp> --config <copy>` | Both flags exist (`fallow dead-code --help`). No repository mutation, no cleanup risk. |
| Stripping comments before matching | A per-gate regex | `stripComments` from `source-scan.ts:42` | Ten gates already share it. Mandatory: three of the files this phase adds to `no-orchestrator-network` name the forbidden symbols in their own headers. |
| Reading a target file in a gate | `grep`/`rg` subprocess | `readFile(..., "utf8")` | `D-98-10`: a `grep` that classifies a file as binary reports nothing and greens the gate over a file it never inspected. |
| One gate delegating a clause to another | Importing the other `*.test.ts` | Import the shared mechanic module | `D-98-09`: importing a module that registers cases at top level registers them a second time and misreports the count. |
| Distinguishing "no changes" from "git failed" | Checking whether the array is empty | Read the exit status and the selected base | §10: `gitLines` swallows exit 128 into `[]`, which is why the two are currently indistinguishable. |

**Key insight:** every mechanism this phase needs already exists in a tool the repository
runs on every `npm run check`. The phase's real work is wiring, not building — and the one
place a from-scratch instrument was tempting (the unowned-export census) is exactly where
Fallow's `--production` flag gives the answer for free while honoring `D-07-20`.

## Common Pitfalls

### Pitfall: The canary fixture cannot be linted through the real config

**What goes wrong:** A plan reads CONTEXT.md's "Reuse the fixture, replace the synthetic config
with the real resolved one" and discovers mid-execution that
`calculateConfigForFile("tests/fixtures/bad-imports/edge-imports-bridges.ts")` returns
`undefined`, and that with `ignore: false` the rule is simply absent.
**Why it happens:** Two independent barriers — `eslint.config.js:303` globally ignores
`tests/fixtures/bad-imports/**`, and BLOCK C's `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
never matches a fixture path. Flat-config global ignores cannot be un-ignored by a later block.
**How to avoid:** Make the `D-11` proof a resolved-config proof on real extension files plus the
three appended-mutation offenders (§3). Decide this at plan time, not execution time.
**Warning signs:** A task that says "lint the fixture through the real config" with no note about
the ignore.

### Pitfall: `D-07-19` sized as a two-file fix

**What goes wrong:** A plan adds a repo-wide must-be-zero unowned-export gate, the tree reports
91 offenders in `extensions/`, and the phase either stalls or reaches for the allow-list
`D-07-18` forbids.
**Why it happens:** `D-07-19`'s wording names two instances; the class has 91.
**How to avoid:** Take §5's route 3 (a pinned census count with the list committed beside it,
mirroring `notify-closed-set-locks.test.ts`), or narrow the offender definition, and get the
ruling before a plan commits.
**Warning signs:** Any task phrased "the gate asserts zero unowned exports."

### Pitfall: A test-only-surface gate goes red on `reinstall-flow.ts`

**What goes wrong:** The `__`-prefix gate ships, `__operations` is removed as `D-07-18` says, and
the gate still fails because `reinstall-flow.ts:138` and `:151` declare `__deps`.
**Why it happens:** `D-07-18` names one offender; there are two (plus a `unique symbol` brand at
`domain/plugin-root.ts:16` that any naive `__` pattern also hits).
**How to avoid:** Decide up front whether `__deps` is in scope. If it is, size it — `ReinstallPluginDeps`
threads through `reinstall-flow.ts` far more widely than `__operations` does through
`reinstall-replace.ts`. If it is not, the gate's pattern must exclude it explicitly and say why.
**Warning signs:** A plan that says "remove the one live offender."

### Pitfall: A new gate helper passes lint and fails Fallow

**What goes wrong:** `npm run lint` is green, `npm run fallow` exits 1 on `maxCognitive` or
`maxUnitSize`.
**Why it happens:** `eslint.config.js:315` turns `sonarjs/cognitive-complexity` **off** for
`tests/**/*.ts`; Fallow's health gate has no test exclusion and analyses all 12 606 units.
**How to avoid:** Run `npx fallow health --fail-on-issues` (0.16 s) after writing any gate
helper, not just `npm run lint`. Keep helpers to one loop and one conditional (§11).
**Warning signs:** A helper over ~40 lines, or one that both walks files and decides policy.

### Pitfall: Extending the vocabulary guard turns three legitimate lines red

**What goes wrong:** The guard is pointed at `tests/**` and immediately fails on
`tests/platform/pi-api.test.ts:96,100` and `tests/persistence/state-io.test.ts:462`.
**Why it happens:** Those are out-of-scope homonyms — a Pi `AgentMessage` role, a Pi
`StopReason`, and a JSON fixture key — that happen to spell `"unsupported"` with a closing quote.
**How to avoid:** Budget the three allowlist entries alongside the 137-line repair, using the
guard's existing `.filter(f => f !== ALLOW)` form (`:252`, `:298-309`). Do not confuse them with
`tests/orchestrators/plugin/reinstall-record.test.ts:249`, which is genuine stale vocabulary.
**Warning signs:** A task that says "extend the guard, then repair" with a line count but no
homonym budget.

### Pitfall: A visitation report that only proves ENOENT

**What goes wrong:** The gate returns visited paths but compares them against the same array it
just passed in, so the comparison is vacuous.
**Why it happens:** `assertNoForbiddenSurface(targets, …)` already receives `targets`; returning
"the targets I visited" and deep-comparing to `targets` proves only that no target threw.
**How to avoid:** `D-07-03` wants the comparison against the **declared** list — which, once
`D-07-05` lands, is the registry entry, a different object from whatever the gate passed. Assert
`report.visited` against `REGISTRY.<groupName>`, and assert the group is non-empty.
**Warning signs:** `assert.deepEqual(report.visited, TARGETS)` in the same function that called
`assertNoForbiddenSurface(TARGETS, …)`.

### Pitfall: A shallow-clone fixture that proves the wrong thing

**What goes wrong:** A test clones `--depth 1` expecting base resolution to fail, and it
succeeds.
**Why it happens:** Measured (§10): a depth-1 clone still resolves `origin/main` and
`merge-base`. What it breaks is `HEAD~1` — the chain's *last* candidate.
**How to avoid:** Plant the shallow case to exercise the tail of the chain (all earlier
candidates removed), and plant "no `origin/main`" separately as the head-of-chain case.
**Warning signs:** One fixture asked to prove both.

## Code Examples

### Resolving effective ESLint severity for a file

```js
// Verified this session against eslint 10.8.1
const { ESLint } = require("eslint");
const eslint = new ESLint({ cwd: repoRoot });
const config = await eslint.calculateConfigForFile(
  "extensions/pi-claude-marketplace/shared/debug-log.ts",
);
// config keys: linterOptions, rules, plugins, language, languageOptions
config.rules["no-console"];                       // => [0, {}]   (numeric severity)
config.rules["import-x/no-restricted-paths"][0];  // => 2
config.rules["import-x/no-restricted-paths"][1].zones.length; // => 8
// A file outside every `files` glob returns undefined, not a partial object.
```

### The full three-file no-console sweep (`D-07-11`)

```js
// Verified: 229 files, 2285 ms, exactly three resolve to 0.
const { globSync } = require("node:fs");
const files = globSync("extensions/pi-claude-marketplace/**/*.ts");
const eslint = new ESLint({ cwd: repoRoot });
const exempt = [];
for (const file of files) {
  const config = await eslint.calculateConfigForFile(file);
  if (config.rules["no-console"]?.[0] === 0) exempt.push(file);
}
// exempt === [
//   "extensions/pi-claude-marketplace/shared/debug-log.ts",
//   "extensions/pi-claude-marketplace/shared/notification-dispatch.ts",
//   "extensions/pi-claude-marketplace/persistence/migrate.ts",
// ]  (order follows the glob; sort before comparing)
```

### The unowned-export census without touching `.fallowrc.json`

```bash
# Verified this session. Offender run:
npx fallow dead-code --production --unused-exports --format json
#   -> { "unused_exports": [ { path, export_name, is_type_only, line, col, ... } ], "total_issues": 102 }
#      91 under extensions/, 11 under scripts/

# Benign control (the real config, unchanged):
npx fallow dead-code --unused-exports --format human
#   -> "✓ No issues found (0.82s)"   — 576 entry points, because every test file is one
```

### Distinguishing a resolved-empty change set from a failed one (`D-07-14`)

```js
// The current shape, scripts/test-coverage-direct.mjs:106-119 — every failure becomes []:
function gitLines(args) {
  try { return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8",
                                           stdio: ["ignore", "pipe", "ignore"] })
    .split("\n").map((l) => l.trim()).filter(Boolean); }
  catch { return []; }
}

// The shape D-07-13/D-07-14 need: separate "no lines" from "the command failed".
function gitLines(args, root) {
  const run = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (run.status !== 0) {
    return { ok: false, reason: `git ${args[0]} exited ${run.status}: ${run.stderr.trim()}` };
  }
  return { ok: true, lines: run.stdout.split("\n").map((l) => l.trim()).filter(Boolean) };
}
```

### Building the three git fixtures

```bash
# (a) no origin/main -- measured: merge-base exits 128, main and HEAD~1 resolve
git init -q -b main . && git config user.email t@t && git config user.name t
# ...two commits...
git merge-base HEAD origin/main   # fatal: Not a valid object name origin/main   (128)

# (b) shallow -- measured: origin/main and merge-base OK, HEAD~1 exits 128
git clone -q --depth 1 --no-local "file://$SRC" shallow
git rev-parse --is-shallow-repository   # true
git rev-parse --verify HEAD~1           # fatal: Needed a single revision        (128)

# (c) docs-only -- commit only under docs/, then the pairable filter selects nothing
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `eslint.calculateConfigForFile` returning eslintrc-shaped config with string severities | Flat-config shape: 5 top-level keys, numeric severities, `undefined` for unmatched files | ESLint 9 flat config, current on 10.8.1 | A gate must read `rules[name][0]` as a number and handle `undefined` for ignored/unmatched paths |
| `import-x/no-cycle` as the cycle gate | Removed; `fallow dead-code` unfiltered is the cycle gate | Recorded in `ARCHITECTURE.md` §"Architectural Constraints" | Measured: the ESLint rule reported nothing on a deliberate two-file cycle while `fallow dead-code` exited 1 |
| Editing `production` in `.fallowrc.json` to find unowned exports | `fallow --production` per-invocation flag | `fallow` 3.x | Exactly what `D-07-20` needs: same answer, config untouched |
| `orchestrators/plugin/list.ts` as one module | `list-flow.ts` + `list-candidate-row.ts` + `list-installed-row.ts` + `list-orphan-fold.ts` + `list.messaging.ts` | Phase 6 | `OPLU-A-F07`'s premise moved; `availableRowMessage` now has a production consumer |
| `resetCompletionCache()` module-global reset | `createCompletionCache()` returning a `CompletionCache` with private memory | Phase 5/6 | `OPLU-B-F15` closed; the class needs a gate so it cannot return |
| `tests/orchestrators/plugin/install.test.ts` | six `install-*` suites | Phase 6 split | `OPIB-F07`'s named file no longer exists; the vocabulary is in `install-flow.test.ts` |

**Deprecated / stale in-repo references found this session:**

- `tests/architecture/markers-snapshot.test.ts:17-20` cites
  `tests/architecture/no-legacy-markers.test.ts` — **the file does not exist**.
- `eslint.config.js:176` says "9-zone `no-restricted-paths` mapping"; the array holds 8.
- `domain/components/hook-events.ts:58-65` claims `satisfies` breaks the typecheck in both
  directions; falsified in §7.
- `orchestrators/plugin/info.ts:2483-2485` documents a test-only re-export that was removed.
- The `01-REVALIDATION.json` prose for `OPEFR-F007` names `domain/resolver.ts`; the real
  specifier is `domain/plugin-resolver.ts`.
- The `SCN-F025` `sourceRefs` place `Dependency` in `shared/concerns/hooks.ts`; it is in
  `shared/concerns/soft-dep.ts:31`.

## Project Constraints (from CLAUDE.md)

Directives the planner must honor. Each is either a hard rule in `CLAUDE.md`,
`.claude/rules/*`, or the codebase docs `CLAUDE.md` imports.

**Git and process**

- NEVER commit to `main`. Feature branches are `features/<name>`. Current branch is
  `features/refine-unit-tests`.
- Conventional Commits for commit messages and PR titles; title 5–72 chars; body lines ≤ 80.
  **No GSD milestone/phase mentions in commit messages or PR titles.**
- Run `pre-commit run --all-files` (or `--files <changed>`) **before** `git commit`. Fix,
  restage, re-run until clean. Never `--no-verify`. Never `--amend` to recover from a hook
  failure.
- Never rebase, never rewrite history. Merge to update branches. Squash-merge PRs.
- Before editing any file, read it. Before modifying a function, trace its callers.

**Quality gate**

- `npm run check` must stay green. It chains, in order: `typecheck`, `lint`, `fallow`,
  `format:check`, `test:corresponding`, `test:corresponding:negative`,
  `test:coverage:direct:negative`, `test`, `test:integration`. **Fallow is a mandatory member,
  not an optional extra.**
- Both complexity ceilings apply independently: ESLint `sonarjs/cognitive-complexity: 15`
  (off for `tests/**`) and Fallow `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`
  (**on** for `tests/**`). Zero `thresholdOverrides` exist.
- `duplicates.threshold: 3`; exactly two `ignoredClones` entries, both justified inline in
  `tests/live-uat/*.mjs`.

**TypeScript**

- Strict mode; `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`.
- All exported functions declare return types (`@typescript-eslint/explicit-module-boundary-types`).
- Named exports only; no default exports.
- `import-x/order`: builtin → external → internal → parent → sibling → index → object → type,
  blank line between groups, alphabetized case-insensitively, type-only imports last.
- Test files import production modules with explicit `.ts` extensions.
- `curly: ["error", "all"]`; blank line required after every block-like statement.
- No `!` non-null assertions and no `as` casts in `extensions/` (per prior-phase records).
- `process.stdout.write` / `process.stderr.write` forbidden in `extensions/**` by two
  independent gates. Note the `.mjs` gate scripts under `scripts/` *do* write to stdout and are
  configured for it (`eslint.config.js:346` sets `no-console: "warn"` there).

**Comments and test titles** (`.claude/rules/typescript-comments.md`)

- Forbidden: `Phase NN`, `Plan NN`, `Wave N`, `Task N`, `milestone vX.Y`, bare `Pitfall N` /
  `Pattern N`, and any phrasing whose only purpose is recording which planning artifact wrote
  the line.
- Forbidden: narration of code that no longer exists — `the former X`, `X used to`,
  `X no longer`, `byte-identical to the former X`. Restate the rationale as a present-tense
  fact, or name the gate that pins it.
- Allowed and encouraged: decision IDs (`D-07-01`), requirement and finding IDs (`GGAT-01`,
  `NFR-5`, `WR-06`, `MF-DEC-07`), GitHub refs.
- Domain uses of the word "phase" (the transaction phase ledger, `plugin update phase 3
  failed`) are preserved unchanged.

**Unit testing** (`.claude/rules/typescript-unit-testing.md`)

- `node:test` + `node:assert/strict` + `strong-mock`. No other runner, assertion library, or
  mocking library. Use the context's `t.mock`, never the process-wide `mock` from `node:test`.
- One `.test.ts` per production module at the mirrored path; no exclusions. `tests/architecture/`
  is a non-corresponding root, so new gate files there need no production pair — verified at
  `scripts/test-coverage-direct.mjs:151` and mirrored in `check-corresponding-tests.mjs`.
- Independent `test()` cases (not `it()`); fresh state per case; no `before()` for shared
  state; one top-level `describe()` per exported entrypoint, never nested.
- Titles state public behavior. A durable requirement ID may appear; plan/phase/ticket
  references may not.
- `// arrange`, `// act`, `// assert` phase comments, lowercase, in order, blank-line separated.
- Values named after their production role — never `result`, `data`, `value`, `sut`, bare
  `actual`. Expected values get an `expected` prefix.
- No `test.only` / `test.skip` / `test.todo` committed. No coverage-ignore directives.
- Each source-test pair reaches 100% function/line/branch coverage run alone.

**Architecture** (from `.planning/codebase/ARCHITECTURE.md`, imported by `CLAUDE.md`)

- Layer import direction: edge → orchestrators → {bridges, domain, transaction, persistence} →
  {platform, shared}. Enforced by ESLint BLOCK C (8 zones) and Fallow's 13 zones.
- All user-visible output through `shared/notification-dispatch.ts`; it is the sole sanctioned
  `ctx.ui.notify` call site.
- Dependency injection over test-only seams: a side-effecting dependency becomes an explicit
  parameter, never a module-global `_setXForTest`.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Route 3 for `D-07-19` (a pinned census count) does not count as the allow-list `D-07-18` forbids, because it names nothing and forgives nothing silently. | §5 | If the user reads a pinned total as an allow-list, the phase needs the 91-item remediation or a narrower offender definition instead. **Needs a user ruling.** |
| A2 | `reinstall-flow.ts`'s `__deps` (`:138`, `:151`) is in scope, because `D-05-01` forbids `__deps` members and a `__`-prefix gate cannot avoid it. `D-07-18` names only `__operations`. | §6 | If it is out of scope, the gate pattern needs an explicit documented carve-out; if in scope, the phase absorbs a second, larger removal. **Needs a scoping ruling.** |
| A3 | `GGAT-03`'s Fallow half is satisfiable by recording that no gate reads `.fallowrc.json`, so there is no first-match weakness on that side. | §4 | If a Fallow-config gate is expected, `D-22` has to be reconciled — there is no terminal finding for one. |
| A4 | The `cloneCacheSeam?` optional fields in `install-flow.ts`/`fetch.ts`/`info.ts` are the Phase-5-authorized production-port form and are not offenders. | §6 | If they are offenders, three more orchestrators join the removal list. |
| A5 | The three `"unsupported"` occurrences in `tests/platform/pi-api.test.ts` and `tests/persistence/state-io.test.ts` are legitimate out-of-scope homonyms warranting allowlist entries. | §8 | If they are stale vocabulary, they are repairs, not allowlist entries — a smaller allowlist but a slightly larger repair. |
| A6 | The recommended `no-restricted-paths` route (drop the fixture lint, prove via resolved config + appended-mutation offenders) satisfies `D-07-02`'s "linted through the real resolved config" intent, given the fixture cannot be. | §3 | If a linted fixture is required, `D-07-10`'s one-mutation rule needs relaxing to two. **Needs a ruling.** |
| A7 | Adding `orchestrators/marketplace/{autoupdate,list,remove}.ts` to `FORBIDDEN_TARGETS` will not break as those files evolve — they are network-free *by contract*, not incidentally. `remove.ts` carries no header comment saying so. | §9 | If `remove.ts` legitimately needs git later (it imports `../plugin/clone-gc.ts` today), the gate becomes an obstacle. Recommend adding the rationale comment beside each new entry, as every existing entry has. |

## Open Questions

1. **How is `D-07-19` scoped?**
   - What we know: the census is 91 unowned exports in `extensions/` (102 with `scripts/`),
     measured by `fallow dead-code --production`; the real config reports zero.
   - What's unclear: whether the phase takes the full remediation, narrows the offender
     definition, or pins the count.
   - Recommendation: §5 route 3 (pinned count, list committed, the two named instances removed
     and the pin dropped by two). Confirm before any plan commits.

2. **Is `reinstall-flow.ts`'s `__deps` in scope?**
   - What we know: two declarations plus a forwarding site; `D-05-01` forbids `__deps` members;
     `D-07-18` names only `__operations`.
   - What's unclear: whether the phase removes both or gates only one.
   - Recommendation: include it — a gate that fires on `__operations` and not `__deps` is the
     "gating one instance while leaving the other" split that `D-07-19` itself warns against.

3. **Does the `D-11` canary keep a linted fixture?**
   - What we know: the fixture is globally ignored and outside BLOCK C's `files` glob;
     `ignore: false` un-ignores it but the rule still does not apply.
   - What's unclear: whether `D-07-02`'s intent survives a resolved-config-only proof.
   - Recommendation: yes — the three appended-mutation offenders fire against real extension
     files, which is a stronger proof than a fixture ever was.

4. **What does `SHC-F047`'s audit conclude?**
   - What we know: `tests/shared/markers.test.ts` is the module's **owner** test, which
     `.claude/rules/typescript-unit-testing.md` requires; `markers-snapshot.test.ts` duplicates
     its two byte assertions and additionally cites a nonexistent sibling gate.
   - What's unclear: which one keeps the byte pins.
   - Recommendation: the owner test keeps them (the rule mandates its existence); the
     architecture gate keeps only what the owner test cannot express — the `locationsFor`
     assertion at `:72-76` and the agents-bridge markers at `:34-44`, which come from a
     different module. Fix the dangling `no-legacy-markers.test.ts` citation either way.

5. **Does `OPEFR-F007` get documented or promoted?**
   - What we know: `fetch.ts:483` is the only runtime dynamic import in `extensions/`;
     `orchestrators/plugin` → `domain` is a legal zone edge and `fetch.ts` already imports other
     `domain/` modules statically.
   - What's unclear: whether a load-order or cycle reason exists that a static import would break.
   - Recommendation: try the static import; if `npm run check` stays green, make it static and
     close the finding outright rather than documenting a form that has no reason.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|-----------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.2 | — |
| `eslint` | `GGAT-03` effective-config gates | ✓ | 10.8.1 | — |
| `typescript` | typecheck, compile-time closed-set proofs | ✓ | 6.0.3 | — |
| `fallow` | unowned-export census, health/dupes ceilings | ✓ | 3.20.0 (signed, verified) | — |
| `git` | temp-repo base-selection fixtures | ✓ | 2.55.0 | — |
| `prettier` | `format:check` in the gate chain | ✓ | 3.9.6 | — |
| `strong-mock` | strict interaction mocks (rules-mandated) | ✓ | 9.2.2 | — |
| `pre-commit` | commit hook pipeline | assumed present (Python framework, not probed) | — | Run `pre-commit run --all-files` before committing; CI's Lint job runs it regardless |
| Network | nothing | not needed | — | Every probe in this document ran offline |
| `.planning/graphs/graph.json` | optional graph context | ✗ absent | — | Not needed; CodeGraph (`.codegraph/`) is present and direct source inspection covered every question |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the knowledge graph is absent; direct inspection and
`fallow`'s own graph covered every question this phase asks.

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26.8.2 built-in) + `node:assert/strict`; `strong-mock` 9.2.2 for strict interaction mocks |
| Config file | none — configured through `package.json` scripts, not a runner config |
| Quick run command | `node --test tests/architecture/<gate>.test.ts` |
| Full suite command | `npm run check` |

### Phase requirements → test map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|-------------|
| GGAT-01 | The shared scan accepts an injected root and reports the paths it opened | unit | `node --test tests/architecture/source-scan.test.ts` | ✅ (extend) |
| GGAT-01 | `no-orchestrator-network` covers the three marketplace orchestrators, fires on a temp-root offender, stays green on the unmutated copy and on the comment near-miss | unit | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (extend) |
| GGAT-01 | The gate matches a dynamic `import("…platform/git…")` and not the legitimate `plugin-resolver` dynamic import | unit | same command | ✅ (extend) |
| GGAT-01 | Every gate's visited-path set deep-equals its registry group, and each group is non-empty | unit | `node --test "tests/architecture/*.test.ts"` | ❌ Wave 0 (registry + meta-gate) |
| GGAT-01 | A production path named in `tests/architecture/**` outside the registry is an offender; the meta-gate fires on a temp-root offender | unit | `node --test tests/architecture/<registry>.test.ts` | ❌ Wave 0 |
| GGAT-01 | Each joined-regex name has a positive control: the synthesized specifier matches, and the composed path resolves | unit | `node --test tests/architecture/import-boundaries.test.ts` | ✅ (extend) |
| GGAT-01 | `partial-vocabulary-guard` reads the recursive unit-test sources and fires on a planted offender | unit | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ (extend) |
| GGAT-01 | Base selection tries `origin/main` → `main` → upstream → `HEAD~1`, prints the chosen candidate, and exits non-zero only when all fail | unit (negative harness) | `npm run test:coverage:direct:negative` | ✅ (extend `scripts/test-coverage-direct.negative.mjs`) |
| GGAT-01 | Zero pairs from a resolved-but-empty path set passes and names the skipped paths; zero pairs from a failed git invocation exits non-zero | unit (negative harness) | same command | ✅ (extend) |
| GGAT-01 | Fixture repos: no `origin/main`; shallow clone; docs-only commit | unit (negative harness) | same command | ✅ (extend; `mkdtemp` machinery exists, `git init` machinery is new) |
| GGAT-03 | Exactly three extension files resolve `no-console` to `0`, over a full 229-file sweep | unit | `node --test tests/architecture/eslint-effective-config.test.ts` | ❌ Wave 0 |
| GGAT-03 | A blanket `files:["**/*.ts"] no-console:"off"` offender config flips the resolved severity, and the gate fails on it | unit | same command | ❌ Wave 0 (needs `tests/fixtures/eslint-probe/blanket-no-console.config.js`) |
| GGAT-03 | The resolved zone matrix matches `EXPECTED_FORBIDDEN` per folder; a zone-substitution offender and a rule-off offender each fail the gate | unit | `node --test tests/architecture/import-boundaries.test.ts` | ✅ (extend; needs two more fixture configs) |
| GGAT-03 | The `hooks-dispatch.test.ts` regex scrape is gone | unit | `npm test` (absence of the case) plus `grep` in the registry meta-gate | ✅ (delete per `D-07-12`) |
| GGAT-04 | `BUCKET_A_EVENTS.length === 10`, and `Exclude<ClaudeHookEvent, BucketAEvent>` is `never` at compile time | unit + typecheck | `node --test tests/architecture/<closed-sets>.test.ts` && `npm run typecheck` | ❌ Wave 0 |
| GGAT-04 | `softDepMarkers` handles exactly the two `Dependency` members and both marker literals are `REASONS` members | unit | same command | ❌ Wave 0 |
| GGAT-04 | The production `REQUIRED_EVENT_FIELDS` table is not duplicated as a test oracle; the test derives its rows from the production table | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ✅ (revise) |
| GGAT-04 | Optional collaborators are exercised with a real value at least once, not only `undefined` | unit | `node --test tests/bridges/hooks/dispatch.test.ts tests/bridges/hooks/event-router.test.ts` | ✅ (extend) |
| GGAT-04 | No `__`-prefixed options member survives under `extensions/` (excluding `declare const … : unique symbol` brands) | unit | `node --test tests/architecture/<test-only-surface>.test.ts` | ❌ Wave 0 |
| GGAT-04 | `replaceReinstalledPlugin` takes its operations as a production-owned parameter; no `__operations` in the tree | unit | `node --test tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | ✅ (revise) |
| GGAT-04 | The unowned-export census matches its pin, computed via `fallow --production` with `.fallowrc.json` unchanged | unit | `node --test tests/architecture/<unowned-exports>.test.ts` | ❌ Wave 0 (pending the §5 ruling) |
| GGAT-04 | `SHC-F047`: marker byte pins have exactly one owner; the dangling `no-legacy-markers.test.ts` citation is gone | unit | `node --test tests/shared/markers.test.ts tests/architecture/markers-snapshot.test.ts` | ✅ (revise) |

### Sampling rate

- **Per task commit:** `node --test <the gate file(s) the task touched>` — sub-second for a
  single architecture gate — plus `npx fallow health --fail-on-issues` (0.16 s), because
  ESLint's cognitive-complexity rule is **off** for `tests/**` and will not catch a breach.
- **Per wave merge:** `npm run typecheck && npm run lint && npm run fallow && npm test`.
  Add `npm run test:coverage:direct:negative` for any wave touching
  `scripts/test-coverage-direct*.mjs`.
- **Phase gate:** full `npm run check` green, then `/gsd-verify-work`.
- **Extra sample for the `__operations` change only:** `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts`, because the
  100%-per-pair rule applies to the module whose signature changed.

### Wave 0 gaps

- [ ] `tests/architecture/<registry>.ts` — literal repo-relative target registry (`D-07-05`);
      gates every other task, so it must land first
- [ ] `tests/architecture/<registry>.test.ts` — the self-hosting meta-gate (`D-07-06`),
      with an explicit allowance for the four deliberate non-paths in `source-scan.test.ts`
- [ ] `tests/architecture/temp-root-control.ts` — shared `mkdtemp`/copy/mutate helper; extracting
      it is not optional (`duplicates.threshold: 3`)
- [ ] `tests/architecture/eslint-effective-config.test.ts` — replaces the `hooks-dispatch.test.ts`
      scrape (`D-07-12`)
- [ ] `tests/fixtures/eslint-probe/{blanket-no-console,zone-substitution,rule-off}.config.js` —
      three committed offender configs, each the real config plus exactly one appended block.
      The zone-substitution config must carry **at least one** zone; `zones: []` is rejected by
      the rule schema.
- [ ] A closed-set enrollment gate for `ClaudeHookEvent` / `Dependency`, plus the
      `Exclude<ClaudeHookEvent, BucketAEvent> extends never` compile-time proof in
      `domain/components/hook-events.ts` and a correction to its `:58-65` doc comment
- [ ] A test-only-surface gate (`__`-prefix + `@internal Test-only`), with a documented carve-out
      for `declare const … : unique symbol`
- [ ] An unowned-export gate wrapping `fallow dead-code --production` — **blocked on the §5
      ruling**
- [ ] `scripts/test-coverage-direct.mjs` — a root parameter on `changedPaths`/`gitLines` and an
      exported `selectBase(root)`, mirroring `assertCompleteCoverage`'s existing
      `selectedProjectRoot = projectRoot`
- [ ] `git init` fixture machinery in `scripts/test-coverage-direct.negative.mjs` — the file has
      `mkdtemp` and `spawnSync` already, but no git repo builder

**Framework install:** none — `node:test` is built in and every tool is already a dependency.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is
included. The phase changes test code, one gate script, and one production collaborator's
wiring; it adds no user input path, no network call, and no credential handling.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | no | The phase touches no auth path. `orchestrators/auth-host.ts` and `platform/git-credential.ts` are unchanged. |
| V3 Session Management | no | No session surface. |
| V4 Access Control | no | No authorization decision changes. |
| V5 Input Validation | no (new surface) | The one production change (`replaceReinstalledPlugin`'s second parameter) accepts a typed internal record, never external input. Existing `typebox` validation in `domain/components/*.ts` is untouched. |
| V6 Cryptography | no | No crypto. |
| V12 Files and Resources | **yes** | New temp-root controls create and delete real directories. Every one must use `mkdtemp(path.join(tmpdir(), …))` and `rm(root, { force: true, recursive: true })` in a `finally`, matching `scripts/test-coverage-direct.negative.mjs:11` and `:290-292`. The production containment chokepoint `shared/path-safety.ts::assertPathInside` (NFR-10) is unchanged. |
| V14 Configuration | **yes** | `.fallowrc.json` and `eslint.config.js` must not be mutated in place by any gate. `D-07-20` freezes the former; `D-07-10` requires the latter to be *composed*, never edited. Both are enforceable by construction: `fallow --config <copy>` and a fixture config that spreads `real`. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|--------------------|
| A temp-root control writing outside its `mkdtemp` root | Tampering | Join every write path from the `mkdtemp` return value; never accept an absolute path from a target list |
| A `rm -rf` in a control resolving to something other than the temp root | Denial of service | `rm` only the `mkdtemp` return value, and only in a `finally`; never a composed subpath |
| A gate mutating the repository's real config and failing to restore it | Tampering | Never mutate; compose (`[...real, oneBlock]`) or pass `--config <copy>` |
| A fixture git repo inheriting the developer's global git config | Tampering | `git init` then set `user.email` / `user.name` explicitly per fixture, as the §10 probe did |
| A gate that greens over files it never opened | Repudiation | This is the phase's whole subject: `D-07-03`'s visited-path report plus `WR-06`'s ENOENT rule |
| A subprocess gate swallowing a non-zero exit | Repudiation | §10's `gitLines` is the live instance; read `status` and `stderr`, do not collapse to `[]` |

No new secret, credential, or network surface is introduced, so the `no-credential-leak`
and `no-shell-out` gates remain the relevant existing controls and neither needs extension
for this phase.

## Sources

### Primary (HIGH confidence — measured in this working tree, this session)

- `node -e "require('eslint/package.json').version"` → 10.8.1; `Object.getOwnPropertyNames(ESLint.prototype)` → includes `calculateConfigForFile`
- `ESLint#calculateConfigForFile` run against `shared/debug-log.ts`, `domain/manifest.ts`, `edge/router.ts`, and `tests/fixtures/bad-imports/edge-imports-bridges.ts`; full 229-file `extensions/**` sweep timed at 2 285 ms
- Three composed fixture configs written to `tests/fixtures/eslint-probe/` and run, then removed; results tabulated in §3
- `npx fallow dead-code --production --unused-exports --format json` → 102 unused exports (91 `extensions/`, 11 `scripts/`); same command without `--production` → `✓ No issues found`
- `npx fallow {dead-code,health,dupes} --fail-on-issues` → all exit 0; timings in §4
- `npx fallow dead-code --help` → `-r, --root <ROOT>`, `-c, --config <CONFIG>`, `--production`
- `node_modules/.bin/tsc --noEmit --strict probe.ts` → exit 0 with an unrepresented union member, falsifying the `satisfies`-is-bidirectional claim (§7)
- Two temp git repositories (`git init -b main`, `git clone --depth 1 --no-local`) probed for `merge-base`, `rev-parse --verify`, `@{upstream}`, `HEAD~1`, and `diff --name-only` behavior (§10)
- An independent TypeScript-compiler-API export-consumer census over `extensions/**` + `tests/**` (§5 cross-check)
- Direct reads with line numbers: `tests/architecture/source-scan.ts`, `source-scan.test.ts`, `no-orchestrator-network.test.ts`, `no-lifecycle-default-enabled-read.test.ts`, `import-boundaries.test.ts`, `hooks-dispatch.test.ts`, `hooks-lifecycle.test.ts`, `partial-vocabulary-guard.test.ts`, `markers-snapshot.test.ts`, `notify-closed-set-locks.test.ts`, `extension-version-sync.test.ts`; `scripts/test-coverage-direct.mjs`, `test-coverage-direct.negative.mjs`, `check-phase-06-hub-ledger.mjs`; `eslint.config.js`, `.fallowrc.json`, `package.json`; `extensions/pi-claude-marketplace/{orchestrators/plugin/reinstall-replace.ts, orchestrators/plugin/reinstall-flow.ts, orchestrators/plugin/info.ts, orchestrators/plugin/fetch.ts, orchestrators/marketplace/{autoupdate,list,remove}.ts, orchestrators/reconcile/apply.ts, domain/manifest.ts, domain/components/hook-events.ts, shared/concerns/hooks.ts, shared/concerns/soft-dep.ts, shared/completion-cache.ts, shared/markers.ts, shared/notification-types.ts, bridges/hooks/dispatch-exec.ts, bridges/hooks/dispatch.ts, bridges/hooks/event-router.ts}`
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, all 17 matching finding records extracted and read in full
- Regex probes of `FORBIDDEN_PATTERNS`, `PLUGIN_LEDGER_IMPORT`, and `MARKETPLACE_LEDGER_IMPORT` against synthesized violation forms (§9)
- Literal-path resolution audit over `tests/architecture/*.ts` → 89 paths, 4 unresolved (§12)
- Retired-vocabulary census over 271 non-architecture test files (§8)

### Secondary (MEDIUM confidence — project documentation read this session)

- `.planning/phases/07-gate-integrity/07-CONTEXT.md` — decisions `D-07-01` … `D-07-20`
- `.planning/REQUIREMENTS.md` §"Gate Integrity" — `GGAT-01`, `GGAT-03`, `GGAT-04`
- `.planning/phases/05-injection-and-ownership-design/05-CONTEXT.md` — `D-05-01` port classification
- `.planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md` — `D-06-14` stale-path-scan obligation
- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`
- `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/{typescript-comments,typescript-unit-testing}.md`

### Tertiary (LOW confidence)

None. No web search was performed and no claim in this document rests on training memory.

## Metadata

**Confidence breakdown:**

- Finding status (§1): **HIGH** — every row has a file path and line number checked this session
- Injectable-root surface (§2): **HIGH** — enumerated by grep over the full directory
- ESLint mechanics (§3): **HIGH** — every number came from a run, including the two traps
- Fallow role (§4): **HIGH** — grep census plus `--help` output plus timed runs
- Unowned-export census (§5): **HIGH** for the number, **MEDIUM** for the recommendation — route 3 needs a user ruling (A1)
- `__operations` surface (§6): **HIGH** for the trace, **MEDIUM** for the collaborator shape (it is a design proposal, not a measurement)
- Closed-set enrollment (§7): **HIGH** — including the `tsc` falsification
- Vocabulary guard (§8): **HIGH** for scope and census, **MEDIUM** for the homonym classification (A5)
- Network gate (§9): **HIGH** — target list verbatim, three files scanned with the real patterns, regex forms probed
- Changed-pair mechanics (§10): **HIGH** — git behavior measured in purpose-built fixtures
- Complexity budget (§11): **HIGH** for the ceilings and current state, **MEDIUM** for the ranked risk (a projection about code not yet written)
- Composed-target baseline (§12): **HIGH** — counted programmatically

**Research date:** 2026-09-10
**Valid until:** 2026-10-10 for the tool mechanics (ESLint/Fallow/git behavior, stable). The
finding statuses and both censuses (§1, §5, §8, §12) are **valid until the next commit that
touches `extensions/` or `tests/`** — re-run the four probes before planning if the branch has
moved.
