# Phase 8: Direct Coverage - Research

**Researched:** 2026-09-10
**Domain:** Per-pair coverage instrumentation, a production-owned filesystem removal port, and gate wiring (pre-commit + CI) in a TypeScript/Node extension
**Confidence:** HIGH — almost every finding below was produced by running a command in this tree and is reproducible from the commands quoted beside it

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `08-CONTEXT.md` `## Implementation Decisions`. These are binding. Research below says HOW to implement them and, where a measurement contradicts a premise, says so explicitly and leaves the escalation to the planner.

Discussion mode: the operator directed "choose the recommended option, prefer doing the right thing even if it is more effort." Every decision below is therefore taken by the agent, biased toward the correct-but-larger option, and is binding on planning.

**Measured Corrections to the Phase's Own Premises**

- **D-08-01:** The pair count is **230**, not 204. `productionPaths()` in `scripts/test-coverage-direct.mjs` returns 230 entries on the milestone branch; the Phase 6 split program added modules after the roadmap text was written. Every artifact naming 204 — `.planning/ROADMAP.md` §"Phase 8", `.planning/REQUIREMENTS.md` `RCOV-01` — is corrected to the measured count in this phase, together with the reproduction command. A count is a claim; this phase does not get to ship a stale one while requiring the baseline not to carry any.

- **D-08-02:** The shortfall count is an **output of this phase, not an input to it**, and no plan may carry a fixed number forward from the roadmap, from `CONTRIBUTING.md`, or from this document. At least **nine** modules fall short today, which is already two more than the roadmap's "seven," and the true set is unknown until the full report runs to completion.

  The reason the number cannot be known in advance is the instrument itself: both gate arms stop at the **first** refusal, so every count anyone has quoted is a count of shortfalls found before the run halted. Two were discovered during this discussion by probing single modules by hand, one of them named only in a `STATE.md` note. There is no reason to believe hand-probing found the last one.

  Known shortfalls at discussion time, all reproduced with `node scripts/test-coverage-direct.mjs <source path>`:

  | module (under `extensions/pi-claude-marketplace/`) | reading | status |
  | --- | --- | --- |
  | `edge/args.ts` | `branches 28/29, lines 86/89` | rewrite per `D-08-09` |
  | `edge/handlers/shared.ts` | `branches 14/15, lines 83/85` | rewrite per `D-08-09` |
  | `edge/completions/data.ts` | `branches 109/110` | compiler-forced, pin |
  | `edge/completions/provider.ts` | `branches 79/80` | compiler-forced, pin |
  | `edge/handlers/marketplace/update.ts` | `branches 11/12` | compiler-forced, pin |
  | `edge/handlers/plugin/import.ts` | `branches 11/12` | compiler-forced, pin |
  | `edge/handlers/plugin/pending.ts` | `branches 9/10` | compiler-forced, pin |
  | `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | classified by `D-08-03` |
  | `bridges/hooks/event-router.ts` | `branches 107/111, lines 959/967` | **unclassified**, see `D-08-03a` |

  The first seven readings come from `CONTRIBUTING.md` and were themselves measured at an earlier commit; the last two were measured live during this discussion. Treat all nine as candidates to re-measure, not as established fact.

- **D-08-03:** `bridges/commands/discover.ts` is classified **compiler-forced, accepted**, not a regression to repair. Lines 289-290 are the `if (!(err instanceof CommandNameError)) { throw err; }` narrowing arm. `BC-019`'s ledger disposition already ruled it: "the arm is unreachable, but deleting the narrowing check without restructure still breaks typing — treat as compiler-forced narrowing, not removable production behavior." It went uncovered when `6527a944 test(06-02): remove bridge builtin mutation` deleted the `Symbol.hasInstance` surgery that was the only thing reaching it. It is the honest reading `TREF-08` left behind, and re-covering it would mean reinstating the exact patching `TREF-08` forbids.

- **D-08-03a:** `bridges/hooks/event-router.ts` is **not classified here**, and no plan may assume it is compiler-forced. Four branches and eight lines are uncovered across four separate sites (553-554, 587-588, 615-616, 872-873). That shape — several sites, lines as well as branches — is not the single-narrowing-arm signature the other accepted cases share, and it has no ledger finding authorizing an accepted reading. `STATE.md` records it as one of three Phase 6 splits that dropped coverage, alongside `reconcile/apply.ts` (closed during Phase 7) and `discover.ts`.

  Its disposition is decided **inside this phase, from measurement**: each of the four sites is either genuinely unreachable — in which case it is pinned with its own recorded reason — or it is reachable and gets a test. "It was a split casualty" is a cause, not a classification, and it does not authorize a pin. This is the same class `.claude` memory records as splits dropping sequence and coverage assertions while end-state assertions survive, which is why a title census would not have caught it and a measured sweep did.

- **D-08-04:** The retained artifact `coverage/all-pairs.jsonl` holds **83 of 230** rows, dated 2026-09-07, ending at `edge/args-schema.ts` — the run stopped at the first shortfall, `edge/args.ts`. It is not a baseline and must not be read as one. The regenerated baseline supersedes it entirely.

- **D-08-04a:** Every count and shortfall list in `.planning/ROADMAP.md` §"Phase 8", `.planning/REQUIREMENTS.md` (`RCOV-01`, `RCOV-02`), `CONTRIBUTING.md`, and `scripts/revalidation.mjs` is rewritten from the completed report run, in the coordinated form `RVAL-04` requires. `RCOV-02`'s "all seven terminal shortfalls" becomes the measured set with its evidence recorded as a scope change.

**The Accepted-Shortfall Pin**

- **D-08-05:** The accepted readings become a **committed, machine-readable pin** that the gate reads and compares against **exactly and bidirectionally**. This is `D-07-19`'s pinned-snapshot mechanism, already adopted in this milestone for the 91-entry unowned-export census, applied to the same class of problem: a must-be-zero gate that cannot ship green, where an allow-list is forbidden.

  The distinction `D-07-19` drew holds here verbatim and must be restated in the pin's own header: **an allow-list forgives named entries silently and forever; a pinned set fails on an addition, on a removal, and on a swap.** A module that falls short and is absent from the pin fails. A pinned module whose reading changed — better or worse — fails. A pinned module that now reads complete fails as a stale pin. Every change to the tree's coverage surface must therefore be written down in the commit that causes it. That is enforcement, not exemption. — **Reversibility:** reversible — the pin is one committed data file plus the comparison layer that reads it.

- **D-08-06:** The pin is a **committed JSON data file**, not a TypeScript constant. `tests/architecture/gate-targets.ts` holds `UNOWNED_EXPORT_CENSUS` and is the natural sibling, but `D-07-07` scoped that registry to `tests/architecture/**` on the explicit ground that the `.mjs` gate scripts are plain JavaScript and cannot import a `.ts` registry. The direct-coverage gate is `scripts/test-coverage-direct.mjs`. A JSON file is the source of truth both can read, and it is exactly the "`.mjs` or JSON source of truth" Phase 7 named in its own deferred idea when it declined to solve this. The file is committed and lives outside `coverage/`, which is gitignored.

- **D-08-07:** Each pinned row carries four fields, not just a path: the `sourcePath`, the **exact reading string** the gate produces (`"branches 109/110"`), the **finding id** that authorizes it (`ER-F05`, `EHR-F16`, `BC-019`, …), and the **reason the arm is unreachable**. A pin whose rows carry no evidence is an allow-list wearing a pin's shape. The reading is compared as the gate's own formatted string so the pin cannot drift from the gate's vocabulary.

- **D-08-08:** The pin is **generated by measurement, not hand-authored**, and the phase runs the full report **twice**:

  1. **Enumerate, before anything is decided.** `npm run test:coverage:direct:report` over all 230 pairs, on the milestone branch, unmodified. This is the only instrument that can answer "which modules fall short" — both gate arms stop at the first refusal, which is why `D-08-02` refuses to fix a count in advance. Classification of every `accepted-shortfall` row happens against this run, not against `CONTRIBUTING.md`'s table.
  2. **Re-measure, after the work lands.** A second full run after the rewrites, the removal port, and any tests written for reachable arms. The committed pin is generated from **this** run, so the artifact reflects the final tree rather than an intermediate one.

  Two full sweeps is roughly twenty minutes of wall clock. That is the price of a baseline that is measured rather than inherited, and this phase exists to stop inheriting. Ordering within the phase follows from it: enumerate, classify, rewrite and port, re-measure, pin.

**Rewriting the Two Removable Guards**

- **D-08-09:** Both dense-index guards are rewritten, behavior-preserving, and drop out of the pin entirely rather than being pinned. `ER-F05` established that `edge/args.ts`'s shortfall (`branches 28/29, lines 86/89`, lines 35-37 uncovered) yields to a `for...of` rewrite that removes the index guard with no non-null assertion; `ER-F19` established the same for `edge/handlers/shared.ts` (`branches 14/15, lines 83/85`), and `EHR-F16` routed that module's shortfall to this same decision rather than to an invented test. Both are typed iteration, not `!` or `as` — neither is available under this project's rules.

  This reopens the ratified `D-116-01a` disposition for these two modules only. `ER-F05` names that as the operator's choice and the operator has taken it: the accepted "compiler-forced" premise is false for these two iterable shapes, so the honest resolution is to remove the guards, not to keep pinning readings that a rewrite can make complete. Every other module keeps `D-116-01a` untouched. — **Reversibility:** reversible — each rewrite is one loop body with its owner test unchanged in contract.

- **D-08-09a:** The same test applies to every shortfall the enumeration run returns, including ones nobody has named yet: **prefer removing an unreachable guard, or covering a reachable one, over pinning its reading.** A row enters the pin only after a plan has recorded why neither a behavior-preserving rewrite nor a real test can reach it. The pin is the residue of that examination, not its starting point.

- **D-08-10:** No end-state count is predicted, and no plan may treat one as a target. `RCOV-01` asks for an honest baseline; a phase that decides the answer first and then measures has written a target, and an instrument aimed at a target is the failure mode this milestone has now hit twice — once in the roadmap's "seven," once in this document's own first draft, which said "eight" before `bridges/hooks/event-router.ts` was measured. The completed report run is the answer, whatever it says.

**The `cleanupStaging` Removal Port**

- **D-08-11:** The port is a **narrow, named, typed collaborator created by a production factory**, in the established `GitOps` / `CredentialOps` / `DeviceFlowHttp` house shape, threaded as an **explicit required parameter** from the public bridge and orchestrator entry points down to `cleanupStaging` and `rollbackReplacementCommon`. It is not a parameter bolted onto `cleanupStaging` alone. — **Reversibility:** costly — the parameter becomes part of the public shape of every bridge stage/commit/unstage entry point and both orchestrator call sites, so reverting means migrating roughly forty call sites and their owner tests back.

  **Why the reach is the point, not an accident.** `06-VERIFICATION.md` G1's open remainder is the *interleaved* leak-message ordering and the leaked-residue partition. Both are observable only when one specific `cleanupStaging` call fails while its siblings succeed, driven from **outside**, through the entry point the G1 tests actually call (`commitPreparedSkills`, `prepareStageSkills`, and their commands/agents twins). A port that stops at `cleanupStaging`'s own signature is unreachable from those tests and closes nothing. That is precisely the distinction G1's override analysis drew, and it is why this is a phase of its own rather than a gap fix.

- **D-08-12:** The parameter is **required, with no default**. `D-05-01` forbids a dead default, and a defaulted port also lets the obligation go quiet the moment a new call site forgets it. Composition roots supply the real operations. Every production caller migrates atomically in the same plan that introduces the port — `D-06-11` forbids a forwarding module, compatibility adapter, or old-path re-export as an intermediate state, and `D-06-12` says a migration too large for one atomic plan is replanned around a smaller genuine leaf contract, never bridged by a seam.

- **D-08-13:** The port's verb set is **`rm` and `rename` only** — the two operations the G1 leak paths traverse. `rollbackReplacementCommon` needs both: it removes each renamed replacement, restores each backup by rename, and then calls `cleanupStaging` twice, accumulating leak messages from all three stages. That accumulation *is* the residue partition G1 wants observable.

  `pathExists`, `removeOrphanIfPresent`, `readDirEntriesTolerant`, and `isPlainMarkdownFile` keep calling `fs.lstat` / `fs.stat` / `fs.readdir` directly. Widening the port to every filesystem verb in `fs-utils.ts` is not authorized by criterion 4 and has no terminal finding behind it.

- **D-08-14:** Residual builtin-module patching is closed **only where the port reaches**. The census pins two files. In `tests/shared/fs-utils.test.ts` the `t.mock.method(fs, "rm")` and `t.mock.method(fs, "rename")` sites convert to the port and the patching goes; the `lstat` / `stat` / `readdir` sites in the same file stay, because `D-08-13` leaves those verbs unported. In `tests/orchestrators/marketplace/add.test.ts` the patches are on `path.dirname` / `path.basename` / `path.join`, which the removal port does not touch at all; that file is untouched by this phase. Record the residual census honestly with its new membership rather than claiming the class is closed.

**Gate Wiring**

- **D-08-15:** The CI job checks out with **`fetch-depth: 0`**. `actions/checkout` defaults to a depth-1 clone in which `origin/main` does not exist, so `D-07-13`'s ordered chain would silently fall through to `HEAD~1` and diff one commit while reporting a resolved base. Fail-closed base selection is worth nothing if the base it closes on is the wrong one. `fetch-depth: 0` is already the house answer — the `fallow-audit` job in `.github/workflows/lint.yml` uses it for the same reason. The job asserts the selected base it printed, so a regression to `HEAD~1` fails visibly rather than passing quietly.

- **D-08-16:** CI gets a **dedicated job**, not a step folded into `check`. `RCOV-03` says "a dedicated authoritative CI job" and the separation earns its keep: the sweep spawns one focused test run per changed pair, so it wants its own timeout and its own legible red signal rather than sitting behind a typecheck failure in a fifteen-minute composite.

- **D-08-17:** The pre-commit hook is a **scoped local hook** in the shape of the four existing `npm-*` hooks — `language: system`, `pass_filenames: false`, and a `files:` pattern over the production root, the corresponding test root, and `scripts/revalidation.mjs` (the one special pair). It invokes the same `npm run test:coverage:direct` the CI job runs; `RCOV-03` says "the same strict changed-pair gate," and two implementations of one gate is how gates drift apart.

  Record its cost plainly in `CONTRIBUTING.md` rather than hiding it: a commit touching ten pairs spawns ten focused test runs. `SKIP=<hook-id>` is the pre-commit-native escape for a developer who needs one; `--no-verify` remains forbidden.

- **D-08-18:** The gate's pin comparison is proved by **planting, not by configuration reading**, extending `scripts/test-coverage-direct.negative.mjs` — which already plants refusals against this exact gate through an injected `mkdtemp` root and already runs inside `npm run check` (`D-07-15`). Four cases, one per divergence class plus the control: an unpinned shortfall, a pinned module reading differently, a pinned module that now reads complete, and an unmutated tree that passes. This is what puts the pin machinery under `npm run check` even though the slow sweep itself stays out of it.

**Instrument Separation**

- **D-08-19:** Three instruments, three jobs, and the boundary between them stays where it is. `test-coverage-direct.report.mjs` **measures** every pair and files no verdict — its header states outright that it does not read the ledger and its exit code is not a coverage verdict. It is what generates the pin. The committed pin **records**. The `test-coverage-direct.mjs` gate arms **enforce** by comparing measurement against the pin.

  `assertCompleteCoverage` stays pure — it answers "is this reading complete?" and nothing else. The pin comparison is a separate layer the gate arms call. Teaching `assertCompleteCoverage` about the pin would leak the ledger into the reporter through its shared `runPair` import and destroy the independence the reporter's header promises.

**Scope Boundary Taken Deliberately**

- **D-08-20:** The `fix-unicode-dashes` pre-commit blocker is **fixed in this phase**, by widening the existing exclusion to cover `tests/architecture/revalidation.test.ts` alongside `scripts/revalidation.mjs`.

  Two reasons it cannot wait for `CLOSE-01`. First, `pre-commit run --all-files` is what CI's Lint job runs verbatim, and it is red today: this phase's own deliverable is a new pre-commit hook, and a new hook cannot be verified inside a run that is already failing. Second, this phase edits `.pre-commit-config.yaml` anyway.

  Widening beats the alternative — dropping the em-dash from both sides — because the test pins the exact bytes `scripts/revalidation.mjs` emits, and those bytes are the `.planning/` house convention the hook already excludes wholesale. Changing them means changing the script's output and every planning record its `RVAL-04` scan parses. One convention, one exclusion, matching reasons.

  `CLOSE-01` keeps its identity and records the early closure with evidence — the same treatment `D-07-19` gave `ORA-F32`'s instance.

**Carried-Forward Constraints**

- `MF-DEC-07` and `D-05-01` through `D-05-03` remain binding: no test-only export, dead default, `__deps` bag, or ignore pragma. Case-owned real temporary filesystems by default; a narrow production-owned port only where authorized — which criterion 4 authorizes here, and nowhere wider.
- `D-06-11` through `D-06-14` remain binding on the port migration: no forwarding seam, no compatibility tail, and every moved responsibility mapped to a named owner before the old form goes.
- `D-07-13` and `D-07-14` are already implemented and are inputs, not work: deterministic ordered base selection that prints its choice, and a zero-selection outcome that distinguishes "resolved and held nothing pairable" from "resolution failed." `D-07-16` explicitly assigned the wiring of that already-correct gate to this phase.
- Both complexity ceilings apply independently to every new helper: ESLint's `sonarjs/cognitive-complexity: 15` and Fallow's `health.maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`. Passing one does not predict the other.
- `duplicates.threshold: 3` applies to the four negative-control cases. Shared fixture setup is extracted, not copied.
- Coverage is reachability evidence only. `RCOV-03` says so and `CLOSE-01` owns assertion strength; no artifact this phase writes may blur the two.

### Claude's Discretion

- Exact filename and location of the pin, provided it is committed, sits outside gitignored `coverage/`, and is readable by `scripts/test-coverage-direct.mjs` without importing a `.ts` module.
- Exact name and member names of the removal collaborator interface and its factory, provided the factory name follows the production-role convention (`create*`) and the reusable test double follows `create*Fake`.
- Whether the pin comparison lives in `test-coverage-direct.mjs` or a sibling module it imports, provided `assertCompleteCoverage` stays pure per `D-08-19`.
- Plan granularity and wave membership, provided the port migration is atomic per `D-08-12`, and provided both full report runs sit where `D-08-08` puts them — the enumeration run before any classification, the pin-generating run after the rewrites and the port.
- Whether the two loop rewrites are one plan or two.

### Deferred Ideas (OUT OF SCOPE)

- **`FLOW-05` CRAP integration** — needs a coverage-format conversion and a metric-policy decision. Named in `REQUIREMENTS.md` "Out of Scope"; unchanged here.
- **A shared target registry for the `.mjs` gate scripts** — Phase 7 deferred enrolling `scripts/check-corresponding-tests.mjs` and `scripts/test-coverage-direct.mjs` in one registry for want of a source of truth both could import (`D-07-07`). `D-08-06` creates a JSON pin that establishes the precedent, but this phase does not migrate the two scripts' path handling into a shared registry — that remains its own work.
- **`path` builtin patching in `tests/orchestrators/marketplace/add.test.ts`** — outside the removal port's verb set per `D-08-13` and carrying no terminal finding of its own. It stays in the residual census.
- **The remaining `fs.lstat` / `fs.stat` / `fs.readdir` patches in `tests/shared/fs-utils.test.ts`** — same reason. Criterion 4 authorizes a removal port, not a filesystem facade.
- **Assertion strength for the newly covered leak paths** — `RCOV-03` fixes coverage as reachability evidence only. Whether the restored G1 assertions are strong enough belongs to `CLOSE-01` in Phase 9.
- **The unused type-member gate** (`.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md`) — no phase-8 match returned by `todo.match-phase`, and `D-22` still forbids a new gate without independent revalidation. Named again in `CLOSE-02`.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RCOV-01 | One honest per-pair coverage baseline is regenerated from the milestone branch for all current source-test pairs and records every refusal without stale counts or a false pass. | §"Finding 0" — the reporter is broken and cannot produce a baseline at all; §"The Measured Baseline" gives a complete 229-row run plus the one row that needs the repo (not a copy) to measure; §"Pair count" confirms 230. |
| RCOV-02 | All terminal shortfalls are reclassified; the removable dense-index guards are honestly rewritten and the genuinely compiler-forced cases retain current explicit evidence without an allowlist. | §"Shortfall Dispositions, Measured" classifies all seven measured shortfalls, with a proven rewrite for three, proven tests for two, and one pin row with two sites; §"The Pin" gives the data shape, the read mechanics, and the comparison layer's placement. |
| RCOV-03 | The same strict changed-pair gate runs in scoped local pre-commit and dedicated authoritative CI with fail-closed base and pair selection, while coverage remains reachability evidence only. | §"Gate Wiring" gives the exact job block, the exact hook block, the `files:` regex, and the **measured** sweep cost — which contradicts `D-08-17`'s cost estimate by two orders of magnitude and needs escalation. |

</phase_requirements>

## Summary

Ten questions were put to this tree with commands rather than reasoning, and the tree answered most of them differently from the documents. Three answers change the shape of the phase.

**First: the instrument `D-08-08` depends on is dead.** `npm run test:coverage:direct:report` — the only thing that can enumerate the shortfall set — exits 1 after 0.6 seconds having measured nothing, because `scripts/test-coverage-direct.report.mjs:112` calls `modulePaths.map(pairForPath)` and `Array.prototype.map` passes the array index as `pairForPath`'s second argument, which became `selectedProjectRoot` in Phase 7's own code-review fix `c0241c82`. Fixing that one line is the phase's first task and a prerequisite for everything `D-08-08` orders.

**Second: the measured shortfall set is seven modules, and it is a different seven from the one every artifact names.** With the reporter repaired, a complete sweep returns `complete 215, type-only 7, accepted-shortfall 7`. Four of `CONTRIBUTING.md`'s seven now read complete. Two modules nobody has named fall short, one of them badly: `orchestrators/plugin/install-outcome.ts` reads `branches 60/83, functions 22/27, lines 956/1031`. Every disposition `D-08-03a` and `D-08-09a` asked for was then settled by probe: three dense-index guards yield to a rewrite and measure complete, `bridges/hooks/event-router.ts`'s four sites are all **reachable** through its public surface and measure `branches 114/114, lines 967/967` with three purposeful tests, and `bridges/commands/discover.ts` is the only residual pin candidate — carrying **two** unreachable sites, not the one `D-08-03` records.

**Third: the removal port is far smaller than feared and the pre-commit gate is far more expensive.** The port was built end to end in a scratch copy: production typechecks as one unit across **9 files and 42 call sites**, and exactly **4 test files / 205 error lines** need mechanical updates — no other test file breaks, because a fake typed `typeof X` still satisfies a widened parameter. `fallow health` passes on the ported tree. Against that, the changed-pair gate selects **147 pairs** on this branch today (base `origin/main`, 935 commits ahead), measured at **6.2 minutes**, not the "ten focused test runs" `D-08-17` budgets.

**Primary recommendation:** sequence the phase as *(0)* repair `report.mjs:112` and run the enumeration sweep in the repository, *(1)* land the three proven rewrites plus the `event-router` and `update-preflight` owner tests, *(2)* land the removal port as one atomic plan over the enumerated 9+4 files, *(3)* close `install-outcome.ts` — the phase's only open-ended work — *(4)* re-measure, generate a one-or-two-row pin, and wire the gate. Escalate `D-08-17`'s cost statement before writing the hook.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-pair coverage measurement | Build tooling (`scripts/*.mjs`) | — | Spawns `node --test` per pair and parses LCOV; touches no extension layer |
| Accepted-shortfall record (the pin) | Build tooling data (`scripts/*.json`) | — | `D-08-06`: must be readable by a `.mjs` script, so not a `.ts` registry and not under gitignored `coverage/` |
| Pin comparison / enforcement | Build tooling (gate arms) | — | `D-08-19`: lives in `runAllPairs`/`runChangedPairs`, never in `runPair` or `assertCompleteCoverage`, so the reporter stays ledger-blind |
| Removal port interface + factory | `shared/` (leaf) | `platform/` also legal | `shared/fs-utils.ts` is the consumer; `shared → platform` and `shared → shared` are both allowed by `.fallowrc.json`; `shared → orchestrators` is not |
| Supplying the real removal ops | `orchestrators/` (composition roots) | — | Measured: `install-outcome.ts`, `update-swap.ts`, `reinstall-replace.ts`, `marketplace/add.ts`, `plugin/clone-cache.ts` are the five files that must construct it; the three bridges need **no** local construction |
| Staging leak observation | `bridges/{skills,commands,agents}` entry points | — | G1's tests drive `prepareStage*` / `commitPrepared*` / `finalize*`; the port must be a parameter of those, which is exactly what `D-08-11` says |
| Dense-index loop rewrites | `edge/` | — | All three measured guards are in `edge/args.ts`, `edge/handlers/shared.ts`, `edge/handlers/plugin/pending.ts` |
| Generation-guard coverage | `bridges/hooks` | — | Reached by injecting a decorated `HooksRuntime` into `createHooksHydration`, the module's existing public collaborator |
| Gate wiring | CI (`.github/workflows/ci.yml`) + local (`.pre-commit-config.yaml`) | — | `D-08-16` dedicated job; `D-08-17` scoped local hook |

## Finding 0 (blocking): `npm run test:coverage:direct:report` cannot run

This is the single most important finding. `D-08-08` orders two full report runs; neither can happen today.

```
$ npm run test:coverage:direct:report
The "paths[0]" argument must be of type string. Received type number (0)
$ echo $?
1
```

Reproduction of the root cause, with the stack: `[VERIFIED: reproduced 2026-09-10 in this tree]`

```
$ node -e 'import("./scripts/test-coverage-direct.mjs").then(m=>{
    try { m.productionPaths().slice(0,2).map(m.pairForPath); }
    catch(e){ console.log(e.stack.split("\n").slice(0,4).join("\n")); } })'
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received type number (0)
    at Object.resolve (node:path:1257:7)
    at toProjectPath (.../scripts/test-coverage-direct.mjs:21:29)
    at pairForPath (.../scripts/test-coverage-direct.mjs:71:23)
```

**Mechanism.** `scripts/test-coverage-direct.report.mjs:112` reads:

```js
for (const pair of modulePaths.map(pairForPath)) {
```

`Array.prototype.map` invokes the callback as `(element, index, array)`, so `pairForPath(sourcePath, 0)` lands `0` in `selectedProjectRoot`, and `toProjectPath` calls `path.resolve(0, inputPath)`.

**When it broke.** `pairForPath` gained `selectedProjectRoot = projectRoot` in `c0241c82 fix(07): thread the selected root through the whole pairing answer` (2026-09-10, Phase 7's CR-02 fix). `report.mjs` has carried the bare `.map(pairForPath)` since it was created in `697d6812` (2026-09-04). `[VERIFIED: git log -S / git log -L on both files]`

**Why nothing caught it.** The gate's own `--all` arm wraps the call correctly at `scripts/test-coverage-direct.mjs:590` (`modulePaths.map((modulePath) => pairForPath(modulePath))`), so only the reporter is affected, and nothing in `npm run check` runs the reporter. `[VERIFIED: grep over tests/, scripts/, .github/ — no file other than package.json references test-coverage-direct]`

**The fix** is one line, mirroring the gate's own wrapper:

```js
for (const pair of modulePaths.map((modulePath) => pairForPath(modulePath))) {
```

**Planner obligations this creates.**
1. This repair must be Wave 0 — `D-08-08` step 1 cannot run before it.
2. It is a behaviour change to the reporter that `npm run check` still will not cover. The negative harness should gain a case that plants it: call the reporter's pair-enumeration path and assert it does not throw, or assert `pairForPath(p, 0)` refuses rather than silently resolving. The house rule ("a gate wants a test that plants the violation") applies to the reporter exactly as it applies to a gate.
3. The same hazard exists wherever a root-taking exported function is passed to `map`/`forEach`/`filter` as a bare reference. `grep -n "\.map(pairForPath\|\.map(assertCompleteCoverage\|\.map(pairsForChangedPaths" scripts/` returns only this one site today.

## The Measured Baseline

`[VERIFIED: full sweep run 2026-09-10 against a pristine copy of this tree with only report.mjs:112 repaired; 229 of 230 rows; raw ndjson retained at /tmp/.../scratchpad/baseline.ndjson]`

### Pair count

```
$ node -e 'import("./scripts/test-coverage-direct.mjs").then(m => console.log(m.productionPaths().length))'
230
```

`D-08-01`'s 230 is confirmed. `[VERIFIED: run in this tree 2026-09-10]`

### Verdict tally

| Verdict | Count |
|---------|-------|
| `complete` | 215 |
| `type-only` | 7 |
| `accepted-shortfall` | 7 |
| **total rows** | **229** |

The 230th pair, `scripts/revalidation.mjs ↔ tests/architecture/revalidation.test.ts`, threw `Focused test failed` in the copy because the copy has no `.planning/` tree. Measured in the repository it passes outright: `Direct coverage passed: scripts/revalidation.mjs (branches 789/789, functions 202/202, lines 2660/2660)`. `[VERIFIED: run in this tree 2026-09-10]`

> **Planning obligation:** the `D-08-08` sweeps must run **in the repository**, not in a copy or a bare worktree. `tests/architecture/revalidation.test.ts` reads `.planning/`, and `verdictFor` rethrows a focused-test failure rather than recording it, so the report aborts at row 230 in any tree missing the planning directory. This also means a GSD worktree without `.planning/` cannot produce the baseline.

### Timing

| Metric | Measured |
|--------|----------|
| Whole sweep, 229 pairs | **467.7 s ≈ 7.8 min** |
| Mean per pair | 2042 ms |
| p50 / p90 / p99 | 1116 / 4056 / 9022 ms |
| min / max | 353 / 10710 ms |
| `scripts/revalidation.mjs` pair (measured separately) | **20 354 ms** |
| Full sweep including row 230 | **≈ 8.1 min** |

Slowest pairs: `reinstall-flow.ts` 10.7 s, `update-swap.ts` 10.1 s, `update-flow.ts` 9.0 s, `install-flow.ts` 7.8 s, `edge/handlers/plugin/update.ts` 7.5 s.

`CONTRIBUTING.md:46`'s "around nine minutes for the whole tree" is **accurate** and does not need rewriting on that point. `D-08-08`'s "roughly twenty minutes" for two sweeps is accurate and slightly conservative (≈16 min). `[VERIFIED: measured]`

### The retained artifact

`D-08-04` is confirmed exactly: `coverage/all-pairs.jsonl` holds 83 rows and its last row is `extensions/pi-claude-marketplace/edge/args-schema.ts` on `v26.8.1`. `[VERIFIED: wc -l + tail in this tree]`

## Shortfall Dispositions, Measured

All seven readings below were reproduced **in the repository** on 2026-09-10, not inferred. Each disposition was then settled by building it and re-measuring.

| # | module | measured reading | `CONTRIBUTING.md` says | disposition (measured) |
|---|--------|------------------|------------------------|------------------------|
| 1 | `edge/args.ts` | `branches 28/29, lines 86/89` | same | **rewrite — proven complete** |
| 2 | `edge/handlers/shared.ts` | `branches 14/15, lines 83/85` | same | **rewrite — proven complete** |
| 3 | `edge/handlers/plugin/pending.ts` | `branches 9/10` | same | **rewrite — proven complete** (third guard, not named by `D-08-09`) |
| 4 | `bridges/hooks/event-router.ts` | `branches 107/111, lines 959/967` | not listed | **tests — proven complete**, all four sites reachable |
| 5 | `orchestrators/plugin/update-preflight.ts` | `functions 20/21, lines 589/593` | not listed | **test — one exported predicate the owner test never calls** |
| 6 | `orchestrators/plugin/install-outcome.ts` | `branches 60/83, functions 22/27, lines 956/1031` | not listed | **owner tests — the phase's largest open item** |
| 7 | `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | not listed | **pin** — two unreachable sites, not one |

Four of `CONTRIBUTING.md`'s seven rows now read **complete** and must be struck: `[VERIFIED: each run individually in this tree 2026-09-10]`

| module | `CONTRIBUTING.md` reading | measured today |
|--------|---------------------------|----------------|
| `edge/completions/data.ts` | `branches 109/110` | `branches 109/109, functions 36/36, lines 631/631` |
| `edge/completions/provider.ts` | `branches 79/80` | `branches 78/78, functions 19/19, lines 340/340` |
| `edge/handlers/marketplace/update.ts` | `branches 11/12` | `branches 11/11, functions 3/3, lines 73/73` |
| `edge/handlers/plugin/import.ts` | `branches 11/12` | `branches 11/11, functions 2/2, lines 75/75` |

`CONTRIBUTING.md:55`'s sentence "Seven modules fall short today, each by one branch the compiler forces and no input can reach" is false on both clauses: the set has changed membership, and three of the survivors yield to a behavior-preserving rewrite while two are plainly reachable.

**A note on the irony the planner should record.** The roadmap said seven, and the measured answer is also seven — but a different seven. A count that happens to match is the most dangerous kind of stale claim, because it survives a sanity check. `D-08-02` and `D-08-10` are vindicated by this, and `RCOV-02`'s rewrite must name the modules, not the number.

### 1-3. The three dense-index guards (`D-08-09`, `D-08-09a`)

**ER-F05's and ER-F19's claim is correct.** Under this repo's `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`), `for...of` over a `string[]` yields `string`, and `Array.prototype.entries()` yields `[number, string]`. Indexed access still yields `string | undefined`. Verified with a compile-time probe that assigns each form to a `const check: string`: `[VERIFIED: tsc --noEmit exit 0 on the probe, this tree's tsconfig]`

```ts
for (const tok of tokens) {
  const check: string = tok;              // compiles — element is `string`
}
for (const [index, tok] of tokens.entries()) {
  const checkIndex: number = index;        // compiles
  const checkTok: string = tok;            // compiles
}
const indexed = tokens[0];
const checkIndexed: string | undefined = indexed;  // indexed access is still optional
```

So the rewrites need **no** `!` and **no** `as`. Confirmed by building all three and measuring:

| module | before | after | how |
|--------|--------|-------|-----|
| `edge/args.ts` | `branches 28/29, lines 86/89` | `branches 29/29, functions 2/2, lines 86/86` | `for (const [index, token] of tokens.entries())` + a `skipValue` flag |
| `edge/handlers/shared.ts` | `branches 14/15, lines 83/85` | `branches 15/15, functions 3/3, lines 81/81` | `for (const tok of tokens)` + a `skipValue` flag |
| `edge/handlers/plugin/pending.ts` | `branches 9/10` | `branches 9/9, functions 2/2, lines 56/56` | `const [first] = parsed.positional; if (first !== undefined)` |

`tsc --noEmit` is clean, and the whole `tests/edge/**` suite passes unchanged: `655 pass, 0 fail`. `[VERIFIED: node --test "tests/edge/**/*.test.ts" in the probe tree]`

**Before / after shapes.**

`edge/args.ts:31-54` — the uncovered region is lines 35-37, the `if (token === undefined) { i++; continue; }` arm.

```ts
// BEFORE
let i = 0;
while (i < tokens.length) {
  const token = tokens[i];
  if (token === undefined) {      // <- lines 35-37 uncovered
    i++;
    continue;
  }

  if (token === "--scope") {
    i++;
    const val = tokens[i];
    if (val === "user" || val === "project") { scope = val; }
    else if (val === undefined) { throw new Error(`--scope requires a value: "user" or "project".`); }
    else { throw new Error(`Invalid --scope value: "${val}". Must be "user" or "project".`); }
  } else {
    positional.push(token);
  }

  i++;
}

// AFTER  (measured: branches 29/29, lines 86/86)
let skipValue = false;
for (const [index, token] of tokens.entries()) {
  if (skipValue) {
    skipValue = false;
    continue;
  }

  if (token === "--scope") {
    const val = tokens[index + 1];
    skipValue = true;
    if (val === "user" || val === "project") { scope = val; }
    else if (val === undefined) { throw new Error(`--scope requires a value: "user" or "project".`); }
    else { throw new Error(`Invalid --scope value: "${val}". Must be "user" or "project".`); }
  } else {
    positional.push(token);
  }
}
```

`entries()` is needed here (not bare `for...of`) because the `--scope` arm reads the *next* token. The `skipValue` flag is what replaces the old `i++`-inside-the-branch, and both of its arms are reachable from real input (`--scope user`).

`edge/handlers/shared.ts:50-82` — the uncovered region is the `if (tok === undefined) { break; }` arm.

```ts
// BEFORE
let i = 0;
while (i < tokens.length) {
  const tok = tokens[i];
  if (tok === undefined) { break; }            // <- uncovered

  if (tok === "--scope") { i += 2; continue; } // consumes the value
  if (tok === SCOPE_TARGET_FLAG) { local = true; i += 1; continue; }
  if (tok.startsWith("--")) {
    if (passThroughLongFlags.includes(tok)) { i += 1; continue; }
    notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
    return undefined;
  }

  i += 1;
}

// AFTER  (measured: branches 15/15, lines 81/81)
let skipValue = false;
for (const tok of tokens) {
  if (skipValue) {
    // The `--scope` value, handled by the downstream domain parser.
    skipValue = false;
    continue;
  }

  if (tok === "--scope") { skipValue = true; continue; }
  if (tok === SCOPE_TARGET_FLAG) { local = true; continue; }
  if (tok.startsWith("--")) {
    if (passThroughLongFlags.includes(tok)) { continue; }
    notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
    return undefined;
  }
}
```

⚠️ **A naive `for...of` here is NOT behavior-preserving.** The original's `i += 2` exists to stop the `--scope` *value* being examined as a flag. Without the skip, the input `--scope --local` would set `local = true`, where today it does not. The `skipValue` flag preserves that. A plan that drops the skip passes its owner test and silently changes flag parsing. Keep the nested `passThroughLongFlags` `if` as shown — merging it into `&&` also reaches complete coverage but at `branches 14/14`, a different reading and a larger diff.

`edge/handlers/plugin/pending.ts:38-39` — the uncovered branch is the `?? ""` arm of `parsed.positional[0] ?? ""`, which cannot be taken inside `if (length > 0)`.

```ts
// BEFORE
if (parsed.positional.length > 0) {
  const first = parsed.positional[0] ?? "";   // <- the `?? ""` arm is unreachable
  if (first.startsWith("--")) { ... }

// AFTER  (measured: branches 9/9, lines 56/56)
const [first] = parsed.positional;
if (first !== undefined) {
  if (first.startsWith("--")) { ... }
```

**Finding that extends `D-08-09`:** `pending.ts` is a third removable dense-index guard of the same class, and `D-08-09` names only two. `D-08-09a` authorizes it ("prefer removing an unreachable guard … over pinning its reading"), and `CONTRIBUTING.md` currently lists it as "compiler-forced". The planner should treat all three as one rewrite family and record the `D-116-01a` reopening for three modules, not two. This removes a row from the pin at no cost.

### 4. `bridges/hooks/event-router.ts` — `D-08-03a` resolved: all four sites are reachable

**Do not pin this module.** All four uncovered sites are the *same* construct, not four different ones:

| site | code | preceding `await` |
|------|------|-------------------|
| 552-554 | `if (!generationIsCurrent()) { return; }` in `hydrateScopeFromState`'s per-plugin loop | `tryHydrateOnePlugin(...)` |
| 586-588 | `if (!generationIsCurrent()) { return; }` in `tryHydrateOnePlugin` | `assertPathInside(...)` |
| 614-616 | `if (!generationIsCurrent()) { return; }` in `tryHydrateOnePlugin` | `readFile(hooksJsonPath)` |
| 871-873 | `if (!generationIsCurrent()) { return; }` in the `session_start` handler | `ensureSharedDataDir(locationsFor("project", ctx.cwd))` |

`generationIsCurrent` is a closure over `runtime.currentGeneration() === capturedGeneration`, and `runtime: HooksRuntime` is an **injected collaborator** — `createHooksHydration(runtime, reader)` and `registerHooksBridge(pi, opts)` are the public surface, and `HooksRuntime` (`bridges/hooks/runtime.ts:52-54`) declares `readonly currentGeneration: () => number` and `readonly advanceGeneration: () => number`. A test therefore controls the guard without touching a builtin, without `!`, and without `as`.

**Proven by probe.** Three purposeful tests close all four sites and the module measures complete: `[VERIFIED: probe tests added to tests/bridges/hooks/event-router.test.ts in a scratch copy; LCOV uncovered-line list empty; gate output below]`

```
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  (branches 114/114, functions 43/43, lines 967/967)
```

The probe's decorator (a spread over the **real** `createHooksRuntime()`, overriding one member):

```ts
function runtimeAdvancingOnCall(real: HooksRuntime, callIndex: number): HooksRuntime {
  let calls = 0;
  return {
    ...real,
    currentGeneration(): number {
      calls += 1;
      if (calls === callIndex) { real.advanceGeneration(); }
      return real.currentGeneration();
    },
  };
}
```

Which index reaches which site, measured by bisection: `[VERIFIED: per-index LCOV uncovered-line lists]`

| test | driver | covers |
|------|--------|--------|
| hydrate, `callIndex: 3` | `createHooksHydration(runtime, reader).hydrateProjectScopeForCwd(projectRoot)` over a project fixture with one hooks plugin | 587-588 **and** 553-554 |
| hydrate, `callIndex: 4` | same | 615-616 **and** 553-554 |
| `session_start`, `callIndex: 10` | `registerHooksBridge(pi, …)` then invoke the recorded `session_start` handler, fixture seeded with a project-scope `SessionStart` route | 872-873 |

**Caveat the planner must act on.** `callIndex` is a coupling to call *order*, which is an implementation detail and will rot. The probe is proof of reachability, not a finished test design. Two more robust shapes are available and should be preferred:
- Advance the generation inside a **semantically adjacent** collaborator. For 871-873 the decorator can advance inside `getRoutingBucket`, which `event-router.ts:869` calls immediately before the `ensureSharedDataDir` await — deterministic and self-documenting.
- For 586-588 and 614-616, advance inside `reader.loadState` on a second invocation, or keep a counted decorator but assert the *reason* (`runtime.parsedConfigEntries()` is empty, the routing bucket is empty) so the test states the contract rather than the call index.

The file already contains the precedent: `tests/bridges/hooks/event-router.test.ts:1797` "runtime hydration stops before mirroring when registration advances its generation" uses a deferred `loadState` plus a concurrent `registerHooksBridge` to reach the guard at line 699.

### 5. `orchestrators/plugin/update-preflight.ts` — one uncalled exported predicate

Uncovered: lines 590-593, function `isUpdatePreflightOutcome`. `[VERIFIED: LCOV FNDA over tests/orchestrators/plugin/update-preflight.test.ts]`

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:589-593
export function isUpdatePreflightOutcome(
  value: PreparedPluginUpdate | UpdatePreflightOutcome,
): value is UpdatePreflightOutcome {
  return "partition" in value;
}
```

It is exported, pure, synchronous, and consumed in production by `update-flow.ts`. The owner test (`tests/orchestrators/plugin/update-preflight.test.ts`, 761 lines, 18 cases) never calls it. The fix is two cases that feed it real values of both arms — the test already produces `PreparedPluginUpdate` values via `preparePluginUpdate`, so no new fixture is needed. Do **not** reach it with `as never`; the project's rules forbid `as` and the real values are available.

### 6. `orchestrators/plugin/install-outcome.ts` — the phase's largest open item

Measured `branches 60/83, functions 22/27, lines 956/1031`: **75 uncovered lines, 23 uncovered branches, 5 uncovered functions**. Uncovered line runs: `[VERIFIED: LCOV over the owner test]`

```
332-333, 384-386, 395-399, 407-408, 414-417, 435-447, 455, 659-660, 668-669,
673-674, 703-704, 711-712, 716-717, 756-757, 766-767, 771-772, 801-823,
829-830, 857-858
```
Uncovered functions: `resolveGitPluginRoot` (the inline `resolveStrict` callback), plus four anonymous phase bodies.

**This is a Phase 6 split casualty, not untested code.** Run the *sibling* suite against the same module and almost all of it covers: `[VERIFIED: LCOV over tests/orchestrators/plugin/install-flow.test.ts]`

| suite | size | uncovered in `install-outcome.ts` |
|-------|------|-----------------------------------|
| `tests/orchestrators/plugin/install-outcome.test.ts` (the owner) | 320 lines | 75 lines, 23 branches, 5 functions |
| `tests/orchestrators/plugin/install-flow.test.ts` | 9336 lines | `668-669, 711-712, 756-757, 859-864, 887-888, 891-897` |

So the work is largely **relocating owner coverage**, not inventing behaviour: the Phase 6 split moved `install-outcome.ts` out of `install-flow.ts` and left the tests behind. This is the same class `STATE.md` records for `discover.ts`, `event-router.ts`, and `reconcile/apply.ts` — a **fourth and fifth** instance (with `update-preflight.ts`) that no artifact records.

**Two arms the removal port unlocks for free.** Lines 667-669, 710-712, 755-757 are:

```ts
const leak = await commitPreparedSkills(prep);   // then Commands, then Agents
if (leak !== undefined) {
  c.bridgeWarnings.push(leak);
}
```

`commitPrepared*` returns a leak string only when `cleanupStaging` fails — which is exactly what the removal port makes faultable. These three arms are uncovered even under `install-flow.test.ts`, and they are unreachable today without builtin patching. **The port and this shortfall are the same problem**; sequencing the port before the `install-outcome` coverage work lets one mechanism close both.

**Risk.** The residue (roughly 60 lines: the preflight throws at 383-417, the `resolveGitPluginRoot` callback at 435-447, the `hooksPhase.do` body at 801-823, the `statePhase` record assembly) is genuine owner-test work. This is the one item in the phase whose size is not yet bounded, and it is also a file the removal port edits. Plan it as its own unit, after the port.

⚠️ **Pinning this module would be an allow-list wearing a pin's shape.** `D-08-07` requires a recorded "reason the arm is unreachable" per row; 75 lines across 19 disjoint runs have no such single reason. If the work cannot complete inside the phase, that is an escalation, not a pin row.

### 7. `bridges/commands/discover.ts` — the pin's one row, with **two** sites

`D-08-03` records one site. The measurement shows two: `[VERIFIED: LCOV over tests/bridges/commands/discover.test.ts]`

```
uncovered line runs: 289-290
uncovered branch lines: [178, 288]
```

| site | code | classification |
|------|------|----------------|
| 288 + 289-290 | `if (!(err instanceof CommandNameError)) { throw err; }` | `BC-019`, compiler-forced narrowing — the reason `D-08-03` records |
| 178 | `return isErrnoException(err) && TOLERATED_WALK_ERRNOS.has(err.code ?? "")` | the `?? ""` arm — **not covered by `D-08-03`'s reason** |

The second site is also genuinely unreachable at runtime: `isErrnoException` (`shared/errors.ts:15-19`) already requires `typeof err.code === "string"`, so `err.code ?? ""` can never take its right arm. It is nevertheless forced by the type, because `NodeJS.ErrnoException` declares `code?: string`.

**A non-assertion removal exists** — tighten the predicate to `err is NodeJS.ErrnoException & { code: string }`, after which `err.code` is a plain `string` and the `??` goes. But it does **not** empty the pin (site 288-290 survives under `BC-019`), and it widens the blast radius to every `isErrnoException` consumer. Recommend **not** doing it in this phase, and instead recording the `?? ""` arm as a second reason on the same pin row.

**Obligation for the planner:** `D-08-07`'s row carries one `reading` string and one `reason`. `discover.ts`'s reading (`branches 55/57, lines 412/414`) aggregates two sites, so the `reason` field must name both or the pin records half its own evidence. Either widen the schema to a `reasons` array, or write one reason that covers both sites explicitly. This is a schema decision the planner owns.

### Projected pin membership after the work

| module | in the pin? | why |
|--------|-------------|-----|
| `bridges/commands/discover.ts` | **yes** | two compiler-forced sites (`BC-019` + the `?? ""` arm) |
| everything else measured | no | three proven rewrites, two proven test closures, one open-ended owner-test item |

A **one-row pin** is the likely honest outcome, which is what `D-08-09a` intends ("as small as honest measurement allows"). `D-08-10` forbids treating that as a target — it is a projection from today's measurement, and the re-measure run decides.

## The Pin

### Read mechanics: `readFileSync` + `JSON.parse`, not import attributes

Both work on this Node: `[VERIFIED: both probes run on Node v26.8.2, no stderr, no ExperimentalWarning]`

```
$ node probe/import.mjs      # import pin from "./pin.json" with { type: "json" }
import attributes OK rows=1
$ node probe/read.mjs        # JSON.parse(readFileSync(path.join(root,"pin.json"),"utf8"))
readFileSync OK rows=1
```

**Recommend `readFileSync` + `JSON.parse`, decisively, for three reasons that have nothing to do with syntax support:**

1. **Root injectability — this is the decisive one.** `D-08-18` requires the negative harness to plant pins. A static `import … with { type: "json" }` resolves relative to the *script*, is hoisted, and is module-cached — it cannot be pointed at an injected `selectedProjectRoot`, and a second planted pin in the same process would read the first. Every other root-aware function in the gate already takes `selectedProjectRoot`; `loadCoveragePin(selectedProjectRoot)` fits that shape exactly and the harness can plant four different pins in one run.
2. **No new syntax, no new import.** `scripts/test-coverage-direct.mjs:2` already imports `readFileSync` from `node:fs`. The pin loader adds zero dependencies.
3. **Legible refusals.** A missing or malformed pin can throw a message naming the file and what to do, which a module-resolution failure cannot.

The project's engine floor is `node >= 20.19.0` (`package.json` `engines`), where JSON modules were still behind an experimental warning. `[ASSUMED — not verifiable in this environment; Node 20 is not installed here]` This only reinforces the recommendation; the root-injectability argument stands on its own.

### Location: `scripts/test-coverage-direct.pin.json`

Constraints checked against the live configuration:

| constraint | source | effect on the pin |
|------------|--------|-------------------|
| `/coverage/` is gitignored | `.gitignore:64` | pin must not live under `coverage/` — confirms `D-08-06` |
| `prettier --check "**/*.{js,json,ts}"` | `package.json:79` | **every** `.json` anywhere is format-checked; the pin must be prettier-clean |
| `.prettierignore` | 4 dirs + 1 fixture | does not cover `scripts/` |
| pre-commit `prettier` hook, `files: '\.(js\|json\|ts)$'`, no path restriction | `.pre-commit-config.yaml` | will also format the pin |
| pre-commit `check-json` | `.pre-commit-config.yaml` | validates the pin parses |
| `check-added-large-files --maxkb=64` | `.pre-commit-config.yaml` | a one-to-three-row pin is far under |
| `productionPaths()` enumerates `extensions/**/*.ts` + `specialPairs` only | `scripts/test-coverage-direct.mjs:100-112` | a `.json` under `scripts/` adds no source-test pair |
| corresponding-tests gate's `nonCorrespondingRoots` includes `scripts` | `scripts/check-corresponding-tests.mjs:10` | nothing under `scripts/` demands an owner test |
| eslint runs on `extensions tests eslint.config.js` | `package.json` lint script | `scripts/*.json` is not linted |

**Generated output is already prettier-clean.** `JSON.stringify(pin, null, 2) + "\n"` is byte-identical to `prettier` output, including for a reason string of 250 characters (prettier does not wrap JSON strings, so `printWidth: 100` is irrelevant): `[VERIFIED: diff of JSON.stringify output vs prettier output — byte-identical; prettier --check passes on both the short and the long variant]`

So the generator needs **no** separate formatting step. A plan should still assert it: `./node_modules/.bin/prettier --check scripts/test-coverage-direct.pin.json`.

⚠️ **Latent version drift to note while editing `.pre-commit-config.yaml`:** the `prettier` mirror hook pins `prettier@3.9.5` with a comment saying it matches the npm devDependency, but `package.json` declares `^3.8.3` and the installed version is **3.9.6**. `[VERIFIED: package.json:26 + node -p require('prettier/package.json').version]` Not this phase's obligation, but the phase is editing that file.

### Row shape (`D-08-07`)

```json
{
  "version": 1,
  "rows": [
    {
      "sourcePath": "extensions/pi-claude-marketplace/bridges/commands/discover.ts",
      "reading": "branches 55/57, lines 412/414",
      "findingId": "BC-019",
      "reason": "..."
    }
  ]
}
```

The `reading` must be the gate's own formatted string. That string is produced in exactly one place — `assertCompleteCoverage` (`scripts/test-coverage-direct.mjs`):

```js
const details = incomplete.map(([name, count]) => `${name} ${count.hit}/${count.found}`).join(", ");
throw new Error(`Incomplete direct coverage for ${sourcePath}: ${details}`);
```

so comparing the pin against that string satisfies `D-08-07`'s "cannot drift from the gate's vocabulary" clause by construction.

**Add a structural validity check independent of any test run:** a pin row whose `sourcePath` is not in `productionPaths()` must fail immediately. Otherwise a deleted module leaves a pin row nothing can ever contradict — the precise hole a pin exists to close. Prior art exists for this: `.planning/WINDOWS.md` entry 30 records an earlier implementation of this mechanism (built in Phase 117 of a previous milestone, measured, then reverted unshipped under `D-117-20`) in which "both self-expiry refusals work (a listed module that becomes complete, and an entry naming a module no longer in the tree)". Worth reading before rebuilding it.

## Where the Pin Comparison Belongs (`D-08-19`)

### The shared surface, traced exactly

`scripts/test-coverage-direct.mjs` exports: `pairForPath`, `productionPaths`, `selectBase`, `changedPaths`, `pairsForChangedPaths`, `assertCompleteCoverage`, `assertReportComplete`, `runPair`. Module-private: `toProjectPath`, `sourceToTest`, `testToSource`, `gitLines`, `upstreamCandidate`, `isStructuralSupplement`, `pairabilityRefusal`, `isPairablePath`, `parseLcov`, `isTypeOnlyModule`, `coverageCounts`, `recordProjectPath`, `repeatedValues`, **`runAllPairs`**, **`runChangedPairs`**, `skippedReport`, `main`.

Consumers: `[VERIFIED: import statements at the top of each file]`

| consumer | imports from the gate |
|----------|----------------------|
| `scripts/test-coverage-direct.report.mjs` | `assertReportComplete`, `pairForPath`, `productionPaths`, `runPair` |
| `scripts/test-coverage-direct.negative.mjs` | `assertCompleteCoverage`, `assertReportComplete`, `changedPaths`, `pairsForChangedPaths`, `selectBase` (plus `verdictFor` from the reporter) |

### Verdict

Put the comparison in the two **module-private gate arms**, `runAllPairs` and `runChangedPairs`. Neither is exported and neither is imported by the reporter, so the reporter is **provably unaffected**: its four imports are untouched, `runPair` keeps its signature and behaviour, and `assertCompleteCoverage` stays pure exactly as `D-08-19` requires.

### The one unavoidable touch to `report.mjs`

`runPair` **throws** on a shortfall, so the arms must catch it and recover the reading from the message. That reading is currently parsed in the reporter:

```js
// scripts/test-coverage-direct.report.mjs:25
const shortfallPattern = /^Incomplete direct coverage for (?<sourcePath>[^:]+): (?<counts>.+)$/;
```

Re-declaring that regex in the gate would be a clone against `duplicates.threshold: 3`. Export one pure helper from the gate — `shortfallReadingOf(error, sourcePath)` returning the reading string or `undefined` — and have `verdictFor` delegate to it. **This does not breach `D-08-19`:** the helper parses a message, it does not consult the pin and it files no verdict. The reporter gains no ledger knowledge; it loses a duplicated regex. Record the reasoning in `report.mjs`'s header, which currently promises independence.

### A gap in `D-08-05`'s bidirectionality the planner must close

`D-08-05` requires "a pinned module that now reads complete fails as a stale pin." The **changed-pair** arm only runs pairs the change set selects. If a pinned module is not in the change set, the arm never measures it and the stale direction cannot fire.

Close it by having `runChangedPairs` run the union of *(changed pairs)* and *(every pinned pair)*. Cost is negligible at the projected pin size — `discover.ts`'s pair measures about 1.4 s. The alternative (compare only within the change set) leaves one of the three divergence classes unenforced in the arm that actually gates commits, which would make the pin an allow-list for every commit that does not happen to touch a pinned file.

A pinned pair that no longer exists must also fail, via the structural check above, with no test run.

## The Removal Port: Exact Inventory

Every number below comes from building the port in a scratch copy of this tree and running `tsc --noEmit`. Baseline typecheck on the unmodified copy: exit 0.

### Call-site census (production)

`cleanupStaging(` real invocations: **29** (plus one reference in a comment at `shared/errors.ts:221`). `rollbackReplacementCommon({` call sites: **3**. `[VERIFIED: grep over extensions/]`

| file | `cleanupStaging(` calls | lines |
|------|------------------------|-------|
| `bridges/agents/stage.ts` | 7 | 250, 353, 391, 410, 426, 554, 555 |
| `bridges/commands/stage.ts` | 6 | 259, 347, 351, 365, 468, 469 |
| `bridges/skills/stage.ts` | 5 | 288, 368, 384, 487, 488 |
| `orchestrators/plugin/clone-cache.ts` | 5 | 87, 192, 263, 404, 418 |
| `orchestrators/marketplace/add.ts` | 4 | 432, 665, 714, 717 |
| `shared/fs-utils.ts` (internal) | 2 | 220, 221 |

**The roadmap's "~40 call sites" is not the right count of anything.** The accurate numbers are: 29 direct `cleanupStaging` invocations; **42** production call sites that must gain an argument (measured: the number of `TS2554 Expected N arguments, but got N-1` errors after the signatures change); **21** functions whose signature changes; **9** production files; **4** test files; **205** test-side error lines.

### Signatures that must gain the collaborator

**`shared/fs-utils.ts` (the port's owner)**

| function | change |
|----------|--------|
| `cleanupStaging(dir, label)` | gains `ops` — `await ops.rm(dir, { recursive: true, force: true })` replaces `fs.rm` |
| `rollbackReplacementCommon(input)` | `RollbackReplacementInput` gains a required `ops` member; `input.ops.rm(pair.to, rmOptions)` and `input.ops.rename(backup.to, backup.from)` replace the `fs` calls |

`rollbackReplacementCommon` also calls `fs.mkdir(path.dirname(backup.from), …)` at line 206. `D-08-13`'s verb set is `rm`/`rename` only, so that stays direct — meaning the *restore* stage can be faulted through `rename` but not through `mkdir`. Sufficient for G1's residue partition; note it so a later reader does not read the port as total.

⚠️ **Tension with `D-08-13`'s own wording.** `D-08-13` lists `removeOrphanIfPresent` among the helpers that "keep calling `fs.lstat` / `fs.stat` / `fs.readdir` directly", but `removeOrphanIfPresent` (`fs-utils.ts:107-122`) calls **`fs.rm` twice** — a port verb. Leaving it unported is a defensible scope line (criterion 4 names `cleanupStaging`), but it means `fs.rm` still appears directly in `fs-utils.ts` after the port, and the decision's stated rationale does not cover that. Record it rather than let a reviewer discover it.

**The three bridges — 7 functions each, 6 exported + 1 private**

| bridge | exported (all gain `ops`) | private |
|--------|---------------------------|---------|
| skills (`bridges/skills/stage.ts`) | `prepareStageSkills`, `commitPreparedSkills`, `abortPreparedSkills`, `replacePreparedSkills`, `rollbackSkillsReplacement`, `finalizeSkillsReplacement` | `rollbackSkillsReplacementInternal` |
| commands | `prepareStageCommands`, `commitPreparedCommands`, `abortPreparedCommands`, `replacePreparedCommands`, `rollbackCommandsReplacement`, `finalizeCommandsReplacement` | `rollbackCommandsReplacementInternal` |
| agents | `prepareStagePluginAgents`, `commitPreparedAgents`, `abortPreparedAgents`, `replacePreparedAgents`, `rollbackAgentsReplacement`, `finalizeAgentsReplacement` | `rollbackAgentsReplacementInternal` |

`discover.ts`, `unstage.ts`, `frontmatter.ts`, `index-mutation.ts` are **untouched**. In particular the **`unstage*` functions never call `cleanupStaging`** — they call `rm` directly on their own targets (`bridges/agents/unstage.ts:86`, `bridges/skills/unstage.ts:72`), which `D-08-13` leaves unported. `D-08-11`'s phrase "every bridge stage/commit/unstage entry point" overstates the reach by one verb family; the probe confirms no `unstage*` signature needs to change. `[VERIFIED: no unstage function appeared in the 42 migrated call sites]`

⚠️ **A TypeScript ordering constraint, measured.** `replacePreparedAgents(prepared, opts?)` already has an optional second parameter. Appending `ops` produces:

```
extensions/pi-claude-marketplace/bridges/agents/stage.ts(441,3):
  error TS1016: A required parameter cannot follow an optional parameter.
```

So for that one function `ops` must come **before** `prepared`, or be carried on an options object. A plan that assumes "append the parameter everywhere" fails to compile on exactly one of the 21 signatures. Either put `ops` first on all 21 for uniformity, or document the one exception.

**`orchestrators/plugin/clone-cache.ts` — three exported entry points**

`materializePluginClone(args)`, `materializeOrRefreshPluginMirror(args)`, `seedSameRepoPluginMirrors(args)`, plus private `promoteStagingToClone` and `seedOnePluginMirror`. `resolvePluginPin` and `resolveGitPluginRootWithSubdir` do **not** reach `cleanupStaging` and need nothing. `[VERIFIED: read clone-cache.ts:495-583 + call graph]`

**`orchestrators/marketplace/add.ts` — one exported entry point**

`addMarketplace` (three overload signatures at lines 528, 531, 534) plus private `runAddInGuard`, `addGitClonedInGuard`. All four `cleanupStaging` calls sit in the two private functions, so the ops can ride `AddMarketplaceOptions` — which is how `gitOps` already travels.

### Production composition roots — the five files that must construct the real ops

Measured: after the bridges and `fs-utils` are threaded, exactly these five files report `TS2554`, and the **bridges need no local construction at all** (the probe's leftover `const REMOVAL_OPS` in `bridges/agents/stage.ts` was reported as *unused*, proving the bridge is fully threaded). `[VERIFIED: tsc error distribution across iterations]`

| composition root | call sites | how it already supplies `gitOps` |
|------------------|-----------:|----------------------------------|
| `orchestrators/plugin/reinstall-replace.ts` | 15 | an injected `operations` bundle of `typeof <fn>` fields with a real default binding |
| `orchestrators/plugin/update-swap.ts` | 12 | direct imports |
| `orchestrators/plugin/install-outcome.ts` | 6 | direct imports |
| `orchestrators/plugin/clone-cache.ts` | 5 | `args.gitOps ?? DEFAULT_GIT_OPS` |
| `orchestrators/marketplace/add.ts` | 4 | `opts.gitOps ?? DEFAULT_GIT_OPS` |
| **total** | **42** | |

⚠️ **The named precedent uses the shape `D-08-12` forbids.** `GitOps`, the port's model, is threaded as `gitOps?: GitOps` with `?? DEFAULT_GIT_OPS` at every site (`clone-cache.ts:508`, `add.ts:537`, `marketplace/update.ts:208,241`). `D-08-12` requires the new port to be required with no default. So the port will be the *only* `*Ops` collaborator in the tree that is required. That is the decision, and the project's own unit-testing rule backs it ("Do not default a parameter to a live boundary. Wire real adapters in one composition module." — `.claude/rules/typescript-unit-testing.md`). Flagging it so a reviewer does not read the asymmetry as an oversight.

Note also that `reinstall-replace.ts`'s seam fields are typed `typeof prepareStageSkills` etc., so the **interface type updates itself** when the signature changes; only the real invocations need an argument.

### Test-side blast radius: 4 files, 205 lines — and nothing else

After production typechecks clean, the residual errors are: `[VERIFIED: tsc --noEmit on the fully ported scratch copy]`

| test file | error lines |
|-----------|------------:|
| `tests/bridges/agents/stage.test.ts` | 72 |
| `tests/bridges/commands/stage.test.ts` | 60 |
| `tests/bridges/skills/stage.test.ts` | 59 |
| `tests/shared/fs-utils.test.ts` | 14 |
| **total** | **205** |

Error codes: `TS2554` ×194 (missing argument), `TS2345` ×6, `TS1360` ×5 (a `satisfies RollbackReplacementInput` literal now missing `ops`). Every one is a mechanical one-line edit.

**The critical negative result: no other test file breaks.** Not `tests/orchestrators/plugin/reinstall-replace.test.ts`, not `install-flow.test.ts`, not `update-swap.test.ts`, not the eight test files that mention `materializePluginClone`, nor the five that mention `addMarketplace`. A naive census would have predicted ~380 affected call sites across ~20 files. The reason is TypeScript function-parameter assignability: a fake written `async (args) => …` and typed `typeof materializePluginClone` remains assignable when the real parameter type gains a member, because the target supplies more than the source reads. Only *real* invocations of the changed functions need an argument.

### Fallow and ESLint impact

`fallow health --fail-on-issues` on the fully ported production tree: `[VERIFIED: run in the scratch copy with the repo's .fallowrc.json]`

```
✗ 0 above threshold · 12851 analyzed · maintainability 91.8 (good)
exit=0
```

So the port introduces **no** `maxCognitive` / `maxCyclomatic` / `maxUnitSize` violation. ESLint declares no `max-params` rule (`grep max-params eslint.config.js` → no match), and `@typescript-eslint/explicit-module-boundary-types: "error"` is satisfied because every signature keeps its explicit return type.

### Boundary and zone legality

`.fallowrc.json` `boundaries` allow-list, read directly: `[VERIFIED: parsed .fallowrc.json]`

```
shared        -> allow: [platform]
bridges-*     -> allow: [domain, persistence, shared, platform]
orchestrators -> allow: [bridges-*, domain, transaction, persistence, platform, shared]
```

Everything may import `shared`, and `shared` may import `platform`. So the port's interface is legal in **either** `shared/` or `platform/`, and no call-site zone gains a forbidden edge. `shared/` already imports `platform/` in five files (`notification-dispatch.ts`, `notify-context.ts`, `notify-reasons.ts`, `notification-grammar.ts`), so neither direction is novel. `[VERIFIED: grep for '../platform/' under shared/]`

**Recommendation: declare `RemovalOps` and `createRemovalOps` in `shared/`** — either inside `fs-utils.ts` (which `.claude/rules/typescript-unit-testing.md` describes as option 3, "inject a side-effecting port through a narrow interface declared in the consumer module") or in a sibling `shared/removal-ops.ts`.

Two consequences of that choice the planner should weigh:
- A new `extensions/.../shared/removal-ops.ts` requires an owner test `tests/shared/removal-ops.test.ts` (corresponding-tests gate, no exclusions) **and** that pair must read complete under the direct gate. Declaring the interface inside `fs-utils.ts` avoids a new pair entirely.
- The structural-supplement exemption the other `*Ops` fakes use is scoped to `tests/(domain|platform)/<name>-fake.test.ts` (`scripts/test-coverage-direct.mjs` `isStructuralSupplement`). `tests/platform/` holds all three existing triads (`git-ops-{fake,contract}.ts` + `git-ops-fake.test.ts`, `credential-ops-*`, `device-flow-*`); `tests/shared/` holds **no** fakes. A `tests/shared/removal-ops-fake.ts` is fine (it is not a `.test.ts`, so it needs no pair), but a `tests/shared/removal-ops-fake.test.ts` would **not** be exempt and would demand a production module that does not exist. The project rule settles it: "Test modules and test support (fakes, seeds, contracts) need no meta-tests; a fake is verified through its shared contract." So define `createRemovalOpsFake` next to the tests that consume it and give it no `-fake.test.ts`.

Note for accuracy: `GitOps` itself is declared in `orchestrators/marketplace/shared.ts`, not in `platform/`. Only its *fake* lives in `tests/platform/`. So "the `GitOps` house shape" is about naming and injection, not about a specific directory.

## Can the Port Land in One Atomic Plan? — Verdict: YES

**Verdict: one plan.** Evidence:

1. **Production typechecks as a unit.** With `fs-utils.ts`, the three bridges, and the five composition roots migrated together, `tsc --noEmit` reports zero errors in `extensions/`. No intermediate state is needed, so no forwarding seam, compatibility adapter, or old-path re-export appears at any point — `D-06-11` and `D-08-12` are satisfiable.
2. **The file list is enumerated and closed.** 9 production files, 4 test files. The test files are the owner tests of the three migrated bridges plus `fs-utils`'s own — i.e. exactly the pairs the change touches, which keeps the plan's `files_modified` disjoint from any other plan that does not touch those bridges.
3. **The edits are mechanical.** 42 production call sites and 205 test lines, all `TS2554`-shaped. The compiler enumerates every one of them; there is no discovery work inside the migration.
4. **No gate regresses.** `fallow health` stays at 0 above threshold; no boundary edge is added; no ESLint rule applies.
5. **A smaller leaf contract is available but does not satisfy criterion 4.** Threading only `fs-utils.ts` (`cleanupStaging` + `rollbackReplacementCommon`) costs 30 production errors in 5 files and 14 test errors in 1 file — genuinely smaller. But it leaves `cleanupStaging` unreachable from `commitPreparedSkills` / `prepareStageSkills`, which is precisely the "port that stops at `cleanupStaging`'s own signature … closes nothing" case `D-08-11` rules out. So `D-06-12`'s escape hatch is unavailable: the only smaller leaf is the one that fails the requirement.

**Sequencing constraint inside the plan.** `orchestrators/plugin/install-outcome.ts` is both a composition root for the port **and** the phase's biggest coverage shortfall. The port's edits land in it, and three of its uncovered arms (`667-669`, `710-712`, `755-757`) only become reachable *because* of the port. Put the port before the `install-outcome` coverage work, and make the coverage plan depend on the port plan.

**Residual risk the plan must own.** The 205 test edits are mechanical but they sit in three very large owner tests (`tests/bridges/agents/stage.test.ts` and siblings). Converting `t.mock.method(fs, "rm")` / `t.mock.method(fs, "rename")` in `tests/shared/fs-utils.test.ts` to the fake (`D-08-14`) is **not** mechanical and is where the G1 assertions get restored. Treat those as two distinct units of work in the same plan: the mechanical argument threading, then the `D-08-14` conversion plus the G1 cases.

## The Negative Harness (`D-08-18`)

### Shape, read end to end

`scripts/test-coverage-direct.negative.mjs` (528 lines) is **not** a `node:test` file. It is a plain top-level-`await` ESM script of sequential `assert` calls, run by `npm run test:coverage:direct:negative`, which sits inside `npm run check` (`package.json:76`).

- **Fixture root:** one module-level `const fixtureRoot = await mkdtemp(path.join(tmpdir(), "direct-coverage-gate-"))` with derived sub-roots `sourceDirectory` and `gitFixtureRoot`. A single `try { … } finally { await rm(fixtureRoot, { force: true, recursive: true }) }` wraps the whole body.
- **Root injection:** by passing `fixtureRoot` as the `selectedProjectRoot` argument to `assertCompleteCoverage`, `changedPaths`, `pairsForChangedPaths`, `selectBase`. It never monkey-patches anything.
- **It exports nothing.** `08-CONTEXT.md`'s "already exports the harness shape" is not accurate — the reusable pieces are module-private helpers, not exports.
- **Internal helpers available for reuse:** `inRepo(relativePath)`, `lcovRecord(sourcePath, counts)`, `fixtureGit(cwd, args)`, `buildFixtureRepository(name, branch, commits)`, `cloneShallow(sourceRepository, name)`, and the `completeCounts` / `shortfallCounts` literals.
- **Imports:** `assertCompleteCoverage, assertReportComplete, changedPaths, pairsForChangedPaths, selectBase` from the gate; `verdictFor` from the reporter.
- **Two command-driven cases** (`spawnSync(process.execPath, [gatePath, …])`) for the two refusals no export can reach.

### How to attach the four pin cases without duplicating setup

Split the pin into two layers and plant against the pure one:

```
loadCoveragePin(selectedProjectRoot)   -- thin I/O: readFileSync + JSON.parse + shape validation
assertPinnedReadings(observed, pin)    -- pure: bidirectional comparison, no disk
```

Then the four cases are in-memory arrays with **one** shared pair of literals and no fixture tree at all:

```js
// One shared arrange, four acts. No mkdtemp, no git, no LCOV.
const pinnedRow = {
  sourcePath: "extensions/pi-claude-marketplace/domain/alpha.ts",
  reading: "branches 1/2",
  findingId: "AAA-001",
  reason: "the narrowing arm is unreachable",
};
const observedShort = [{ sourcePath: pinnedRow.sourcePath, reading: "branches 1/2" }];

assert.doesNotThrow(() => assertPinnedReadings(observedShort, [pinnedRow]));        // control
assert.throws(() => assertPinnedReadings(
  [{ sourcePath: ".../beta.ts", reading: "branches 3/4" }], [pinnedRow]), {…});     // unpinned shortfall
assert.throws(() => assertPinnedReadings(
  [{ sourcePath: pinnedRow.sourcePath, reading: "branches 0/2" }], [pinnedRow]), {…}); // reading moved
assert.throws(() => assertPinnedReadings([], [pinnedRow]), {…});                    // stale pin
```

**This is the file's own established idiom**, not an invention: the `assertReportComplete` group (negative harness lines ~218-300) does exactly this — "These records are string pairs only — the assertion never reads the disk — so the fixture names deliberately do not exist in the tree" — with one `assert.doesNotThrow` control followed by five `assert.throws` refusals over one shared `completeRecords` literal.

**Duplication budget.** `duplicates.threshold: 3` applies, but the existing file already carries six `assert.throws(() => assertReportComplete(…), { message })` blocks of near-identical shape and `npm run fallow` is green, so four more of the same shape are within tolerance. `[VERIFIED: the six blocks exist and fallow passes at Phase 7 close]` The thing to avoid is four `mkdtemp` + `writeFile` + planted-pin fixture trees — which the pure-layer split makes unnecessary.

**One additional thin case** should plant `loadCoveragePin`'s I/O half against the injected root: write a pin into `fixtureRoot`, read it back, and assert a malformed pin refuses with a message naming the file. That reuses the existing `fixtureRoot` and `writeFile` already in scope — no new setup.

**The `assertReportComplete` non-empty precedent transfers.** `unowned-exports-census.test.ts` guards "a run that produced nothing must not deep-equal an accidentally-empty pin and report success." The coverage analogue is the *stale pin* case above plus a case asserting that an **empty** pin with a shortfall present fails. Include both; they are different directions.

## Gate Wiring

### `.pre-commit-config.yaml` — the hook block

Append to the existing `- repo: local` block, after `npm-fallow`:

```yaml
      - id: npm-coverage-direct
        name: npm direct coverage (changed pairs)
        entry: npm run test:coverage:direct
        language: system
        pass_filenames: false
        files: '^(extensions/pi-claude-marketplace/.*\.ts|tests/.*\.ts|scripts/revalidation\.mjs|scripts/test-coverage-direct\.pin\.json)$'
```

Why this regex:
- `extensions/pi-claude-marketplace/.*\.ts` — the production root the gate maps from.
- `tests/.*\.ts` — deliberately **wider** than `tests/.*\.test\.ts`. Over-matching is safe and under-matching is not: the gate's own `pairabilityRefusal` passes over a non-test file under `tests/` with the reason "under the test root but not a corresponding test path", so a changed `tests/platform/git-ops-fake.ts` makes the hook run, resolve zero pairs, and exit 0 in under a second. `[VERIFIED: read pairabilityRefusal in scripts/test-coverage-direct.mjs]`
- `scripts/revalidation\.mjs` — the one `specialPairs` entry (`scripts/test-coverage-direct.mjs:13-15`). **This phase edits that file** (`D-08-04a`), so the hook will fire on the phase's own commits; that pair alone costs 20 s.
- the pin file — so a pin edit re-runs the comparison. Only meaningful if `runChangedPairs` also runs every pinned pair (see the bidirectionality gap above).

The existing four hooks use `(extensions|tests)/.*\.ts`; narrowing the production half to `extensions/pi-claude-marketplace/` is closer to what the gate actually maps, but matching the siblings' looser form is also fine — the gate passes over anything it cannot pair.

### `.pre-commit-config.yaml` — the `D-08-20` em-dash fix, verified

**Current failure, reproduced** in a throwaway git repo containing only `tests/architecture/revalidation.test.ts` and the repo's current hook stanza: `[VERIFIED: pre-commit 4.5.1, 2026-09-10]`

```
Fix Unicode dash characters..............................................Failed
- hook id: fix-unicode-dashes
- exit code: 1
- files were modified by this hook
Changes were made in these files:
  tests/architecture/revalidation.test.ts
```

**With the widened exclusion, the same run passes:**

```
Fix Unicode dash characters..............................................Passed
```

The exact change:

```yaml
      # `scripts/revalidation.mjs` both matches and emits the em-dash that
      # `.planning/` documents carry, and `tests/architecture/revalidation.test.ts`
      # pins the exact bytes it emits. `.planning/` is excluded here, so rewriting
      # either side's dash literals breaks the planning-contract parser (its
      # RVAL-04 record scan stops matching every row).
      - id: fix-unicode-dashes
        exclude: ^(\.planning/|scripts/revalidation\.mjs$|tests/architecture/revalidation\.test\.ts$)
```

**The widening masks no second offender.** A scan of every git-tracked file, excluding the hook's `.planning/` + `scripts/revalidation.mjs` exclusion and pre-commit's global `exclude: ^(\.agents/|\.claude/|\.codex/|tests/domain/fixtures/hash-stability/)`, for U+2010, U+2011, U+2012, U+2013, U+2014, U+2015 and U+2212 returns **exactly one file**: `[VERIFIED: scan over git ls-files, 2026-09-10]`

```
tests/architecture/revalidation.test.ts   {'EM-DASH': 16}
offending tracked files: 1
```

16 em-dashes matches `STATE.md`'s "the hook rewrites 16 lines" exactly. `D-08-20` is correct and sufficient. Remember to update the existing comment above the hook — it explains only `scripts/revalidation.mjs` today.

### `.github/workflows/ci.yml` — the job block

Add as a fifth job (and add it to `package`'s `needs:` if the phase wants `package` gated on it):

```yaml
  direct-coverage:
    name: direct coverage (changed pairs, Node 24)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          # D-08-15: origin/main must exist, or selectBase falls through to
          # HEAD~1 and diffs one commit while reporting a resolved base.
          fetch-depth: 0

      - name: Setup Node 24
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Assert the base candidate resolved
        run: git rev-parse --verify origin/main^{commit}

      - name: Run the changed-pair direct-coverage gate
        run: npm run test:coverage:direct | tee coverage-direct.log

      - name: Assert the gate selected origin/main
        run: grep -qx 'Changed-pair base: origin/main' coverage-direct.log
```

Notes:
- `fetch-depth: 0` matches the in-repo precedent at `.github/workflows/lint.yml` (`fallow-audit` job). `[VERIFIED: read lint.yml]`
- `runChangedPairs` writes `Changed-pair base: ${selected.base}` before either outcome (`scripts/test-coverage-direct.mjs`), which is what makes the assertion possible. The grep is `D-08-15`'s "asserts the selected base it printed".
- ⚠️ `tee` + `grep` in two steps: piping `npm run ...` into `tee` means the pipeline's exit status is `tee`'s, which masks a gate failure. Use `set -o pipefail` (GitHub's default shell is `bash -e`, which does **not** set pipefail) or redirect instead of piping. This is exactly the "green runs that checked nothing" class recorded in memory — flagging it because the obvious formulation is wrong.
- ⚠️ `timeout-minutes: 20` is a guess sized from the measurement below; on this branch the job would take ~7 minutes today. `[ASSUMED]`
- ⚠️ **Unverifiable here:** whether `actions/checkout@v7` with `fetch-depth: 0` on a `pull_request` event creates `refs/remotes/origin/main`. `[ASSUMED — GitHub Actions cannot be exercised in this environment]` The "Assert the base candidate resolved" step above turns a wrong assumption into a loud, legible failure rather than a silent `HEAD~1` fallback, which is the whole point of `D-08-15`. Keep it.

### Measured sweep cost — and a contradiction with `D-08-17`

`D-08-17` says: "a commit touching ten pairs spawns ten focused test runs."

**Measured, in this tree, right now:** `[VERIFIED: node -e with pairsForChangedPaths(), 2026-09-10]`

```
$ node -e 'import("./scripts/test-coverage-direct.mjs").then(m=>{const s=m.pairsForChangedPaths();
  console.log("base:",s.base,"pairs:",s.pairs.length,"skipped:",s.skipped.length)})'
base: origin/main pairs: 147 skipped: 675
$ git rev-list --count origin/main..HEAD
935
```

Cross-referencing those 147 source paths against the per-pair `elapsedMs` from the baseline sweep: **374 s = 6.2 min**, plus `scripts/revalidation.mjs` at 20 s if it is in the set → **≈ 6.5 minutes per invocation**. `[VERIFIED: join of selected paths against baseline.ndjson elapsedMs]`

**The mechanism.** `changedPaths` unions four git queries (`scripts/test-coverage-direct.mjs`):

```js
["diff", "--name-only", "--diff-filter=ACMR", `${base.commit}...HEAD`],
["diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
["ls-files", "--others", "--exclude-standard"],
```

The first query is branch-wide against the selected base. That is *correct* for a PR-scoped gate — a PR's authoritative change set **is** `origin/main...HEAD` — and `CONTRIBUTING.md:49` describes it accurately as "the pairs your branch changed". It is simply not "the pairs this commit touches".

**Consequences for the two wirings:**
- **CI job: fine, and arguably exactly right.** ~7 minutes in a dedicated 20-minute job re-verifies every pair the PR touched. `D-08-16`'s reasoning holds.
- **Pre-commit hook: 6.5 minutes per commit on this branch, growing with branch length.** This phase alone will produce many commits, each paying it.

⚠️ **This contradicts a locked decision's stated cost and needs escalation, not a silent reinterpretation.** The options, none of which this research picks:
1. Accept it and state it accurately in `CONTRIBUTING.md` ("roughly 6-7 minutes on a long-lived branch, and it grows"), leaning on `SKIP=npm-coverage-direct` as the routine escape. Honest, and consistent with `D-08-17`'s "record its cost plainly" — but a gate developers routinely skip is not a gate.
2. Pass a commit-scoped base to the same gate in the hook (for example `HEAD` only). This keeps **one** implementation, which is `D-08-17`'s actual concern ("two implementations of one gate is how gates drift apart"), while changing only the base the hook selects. It is a smaller deviation than it looks, but it does change the selection semantics locally versus CI.
3. Drop the pre-commit half and rely on the CI job. Contradicts `RCOV-03` in terms.

Option 2 appears to preserve the most of `D-08-17` at the least cost, but choosing is the planner's and the operator's call. Either way, `D-08-17`'s "ten focused test runs" sentence must not be copied into `CONTRIBUTING.md` as written.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading the pin in a `.mjs` gate | A JSON-module `import` with attributes, or a bespoke parser | `readFileSync` + `JSON.parse` behind `loadCoveragePin(selectedProjectRoot)` | Only the explicit-root form is injectable by the negative harness; a static import is hoisted and module-cached |
| Formatting the generated pin | A custom serializer, or a post-`prettier --write` step | `JSON.stringify(pin, null, 2) + "\n"` | Measured byte-identical to prettier's output, including for 250-character strings |
| Parsing a shortfall reading out of the gate's error | A second regex in the gate arms | One exported pure `shortfallReadingOf(error, sourcePath)`, with `verdictFor` delegating to it | A duplicated regex is a clone against `duplicates.threshold: 3`, and two copies drift |
| Reaching the `generationIsCurrent` guards | Patching `node:fs`, `t.mock.module`, or a `_setGenerationForTest` seam | A spread decorator over the real `createHooksRuntime()` overriding `currentGeneration` | `HooksRuntime` is already an injected public collaborator; `MF-DEC-07` / `D-05-02` forbid the alternatives |
| Removing the dense-index guards | A non-null assertion or a cast | `for...of` / `.entries()` / array destructuring | Measured: all three compile clean under `noUncheckedIndexedAccess` with no assertion |
| Planting the four pin divergences | Four planted fixture repositories | One shared in-memory literal against the pure comparator | The file's own `assertReportComplete` group is exactly this idiom; four fixture trees would trip the clone threshold |
| Faulting `cleanupStaging` | `t.mock.method(fs, "rm")` | The injected removal port | `TREF-08` removed builtin patching; criterion 4 authorizes the port precisely to replace it |
| A "real permissions" route to a cleanup failure | `chmod`-based read-only parents | The port | ROADMAP criterion 4 already ruled it out: the staging root's parent must be writable at create and read-only at remove, inside one closure |

**Key insight:** every shortcut in this phase has already been tried and recorded somewhere in `.planning/`. `WINDOWS.md` entry 30 documents an accepted-shortfall list that was built, measured, and reverted; `TREF-08` removed the builtin patching the port replaces; `D-116-01a` ratified "compiler-forced" for guards that three measurements now show yield to a rewrite. Measure before inheriting.

## Common Pitfalls

### Pitfall 1: Running the sweep anywhere but the repository
**What goes wrong:** the report aborts at row 230 with `Focused test failed: tests/architecture/revalidation.test.ts`, and `verdictFor` rethrows rather than recording, so you get 229 rows and exit 1.
**Why it happens:** that test reads `.planning/`; a copy or a `.planning`-less worktree has none.
**How to avoid:** run `npm run test:coverage:direct:report` in the checkout. `workflow.use_worktrees` is already `false` in `.planning/config.json`, so the default dispatch is correct — but do not "helpfully" move it.
**Warning signs:** a 229-row report with a non-zero exit.

### Pitfall 2: Passing a root-taking function as a bare `map` callback
**What goes wrong:** `Array.prototype.map` supplies the index as the second argument. `pairForPath(p, 0)` → `path.resolve(0, p)` → `ERR_INVALID_ARG_TYPE`.
**Why it happens:** the second parameter was added later, to a function that was already being mapped.
**How to avoid:** always wrap — `map((x) => f(x))`. Audit every exported function that grew a `selectedProjectRoot` parameter in Phase 7.
**Warning signs:** `The "paths[0]" argument must be of type string. Received type number`.

### Pitfall 3: A `for...of` rewrite that silently changes flag parsing
**What goes wrong:** dropping `edge/handlers/shared.ts`'s `i += 2` lets `--scope --local` set `local = true`, which it does not today. Coverage reads complete and the owner test passes.
**Why it happens:** the index arithmetic encoded lookahead, not just iteration.
**How to avoid:** keep a `skipValue` flag in both rewrites. Add a case for `--scope --local` and for `--scope` as the final token before touching the loop.
**Warning signs:** a diff that removes an `i += 2` without adding a skip.

### Pitfall 4: Appending a required parameter after an optional one
**What goes wrong:** `TS1016: A required parameter cannot follow an optional parameter` — measured on `replacePreparedAgents(prepared, opts?)`.
**How to avoid:** put `ops` first on all 21 signatures, or carry it on an options object.

### Pitfall 5: `npm run ... | tee` in a CI step
**What goes wrong:** the pipeline exits with `tee`'s status, so a red gate reports green. GitHub's default shell is `bash -e`, which does **not** enable `pipefail`.
**How to avoid:** `set -o pipefail` explicitly, or redirect to a file and read it in the next step.
**Warning signs:** a coverage job that has never failed.

### Pitfall 6: Pinning a shortfall that is merely untested
**What goes wrong:** `install-outcome.ts`'s 75 uncovered lines across 19 disjoint runs would become a pin row with no honest "reason the arm is unreachable" — `D-08-07`'s evidence field filled with prose. That is the allow-list `D-08-05` forbids.
**How to avoid:** a row enters the pin only when a single recordable reason covers every uncovered site in it. Where it does not, the answer is tests or an escalation.

### Pitfall 7: Assuming the pre-commit hook costs what `D-08-17` says
**What goes wrong:** the hook ships, every commit takes 6.5 minutes, and developers learn `SKIP=`.
**How to avoid:** settle the base-selection question before writing the hook, and state the measured number in `CONTRIBUTING.md`.

### Pitfall 8: Coupling the `event-router` tests to a `currentGeneration()` call index
**What goes wrong:** the counted decorator works today (indices 3, 4, and 10) and breaks the first time an `await` is added or removed anywhere in the hydration path.
**How to avoid:** advance the generation from a semantically adjacent collaborator call (`getRoutingBucket` for the `session_start` guard) and assert the consequence, not the index.

### Pitfall 9: Rewriting counts instead of modules
**What goes wrong:** `RCOV-02` says "all seven terminal shortfalls". The measured set is also seven — a *different* seven. A rewrite that updates the number and not the membership reads as correct and is wrong.
**How to avoid:** `D-08-04a`'s rewrites must name modules and readings. Never restate a bare count.

## Runtime State Inventory

This is not a rename or migration phase, but the port changes public signatures and the phase edits records several gates read, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No database, collection name, or record key changes. `state.json` schema is untouched by the port (the ops is a parameter, never persisted). Verified by reading the `statePhase` record assembly in `install-outcome.ts:890-950` — no new field. | none |
| Live service config | **None.** No external service configuration. GitHub Actions workflow files are in git, so the new job is a tracked change, not out-of-band state. | none |
| OS-registered state | **None.** No scheduled tasks, launchd plists, or pm2 entries. The pre-commit hook is declared in the tracked `.pre-commit-config.yaml`; note that **no git hook is installed in this checkout** (`.git/hooks` holds only `post-*`/`pre-push`), so the new hook will not fire locally until `pre-commit install` is run — verify the hook by running `pre-commit run npm-coverage-direct --all-files` rather than by committing. | run the hook explicitly to verify |
| Secrets/env vars | **None.** No new env var. `TEST_CONCURRENCY` is read by existing npm scripts but not by the direct-coverage gate (`runPair` spawns `node --test` with a fixed argument list). | none |
| Build artifacts | **`coverage/all-pairs.jsonl`** (83 stale rows, gitignored) and **`coverage/all-pairs-report.ndjson`**. `D-08-04` supersedes the first; both are gitignored and regenerated. Nothing installed or compiled carries a stale name — `tsconfig.json` is `noEmit: true`, so there is no build output to invalidate. | regenerate; do not read the stale file |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | every gate and test | ✓ | v26.8.2 (engines floor `>=20.19.0`; CI pins 24) | — |
| npm | scripts, `npm ci` | ✓ | 11.19.1 | — |
| git | `selectBase`, `changedPaths`, fixture repos | ✓ | 2.55.0 | — |
| `pre-commit` | `D-08-17`, `D-08-20` verification | ✓ | 4.5.1 | — |
| prettier | `format:check`, pin formatting | ✓ | 3.9.6 installed (hook pins 3.9.5, `package.json` says `^3.8.3`) | — |
| typescript | `typecheck` | ✓ | 6.0.3 | — |
| fallow | `npm run fallow` | ✓ | 3.20.0 | — |
| `.planning/` tree | `tests/architecture/revalidation.test.ts` (the 230th pair) | ✓ in the repo, ✗ in a bare worktree | — | none — run the sweep in the repository |
| GitHub Actions runner | `D-08-15` / `D-08-16` verification | ✗ locally | — | assert `origin/main` resolves and assert the printed base, so a wrong assumption fails loudly |
| Installed git pre-commit hook | local hook firing on commit | ✗ (`.git/hooks` has no `pre-commit`) | — | verify with `pre-commit run <id>` |

**Missing dependencies with no fallback:** none that block the phase.
**Missing dependencies with fallback:** GitHub Actions (mitigated by in-job assertions); the installed git hook (mitigated by explicit `pre-commit run`).

**No external packages are installed by this phase**, so the Package Legitimacy Audit is not applicable. The phase adds one committed JSON data file, edits existing `.mjs` scripts and `.ts` modules, and edits two config files. `[VERIFIED: no new dependency appears in any recommendation above]`

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. `[VERIFIED: read config.json]`

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), Node v26.8.2 locally / 24 in CI |
| Config file | none — configured entirely through `package.json` scripts |
| Quick run command | `node --test <test-path>` |
| Pair coverage command | `node scripts/test-coverage-direct.mjs <source-path>` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RCOV-01 | the reporter enumerates all 230 pairs without throwing | negative control | `npm run test:coverage:direct:negative` (new case planting the `map(pairForPath)` arity bug) | ✅ file exists, ❌ case — Wave 0 |
| RCOV-01 | the baseline is complete and current | manual measurement | `npm run test:coverage:direct:report` (≈8 min, run in the repository) | n/a — an artifact, not a test |
| RCOV-02 | `edge/args.ts` reads complete after the rewrite | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/args.ts` | ✅ (owner test unchanged) |
| RCOV-02 | `edge/handlers/shared.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/shared.ts` | ✅ |
| RCOV-02 | `edge/handlers/plugin/pending.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` | ✅ |
| RCOV-02 | flag parsing is unchanged by the rewrites (`--scope --local`, trailing `--scope`) | unit | `node --test tests/edge/args.test.ts tests/edge/handlers/shared.test.ts` | ✅ file, ❌ the two edge cases — Wave 0 |
| RCOV-02 | the four generation guards return early | unit | `node --test tests/bridges/hooks/event-router.test.ts` | ✅ file, ❌ 3 cases |
| RCOV-02 | `isUpdatePreflightOutcome` discriminates both arms | unit | `node --test tests/orchestrators/plugin/update-preflight.test.ts` | ✅ file, ❌ 2 cases |
| RCOV-02 | `install-outcome.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | ✅ file, ❌ ~60 lines of cases |
| RCOV-02 | a `cleanupStaging` failure surfaces as a leak message, interleaved and partitioned (G1) | unit | `node --test tests/bridges/skills/stage.test.ts` (+ commands, agents) | ✅ files, ❌ the G1 cases |
| RCOV-02 | the pin fails on an addition / a changed reading / a stale row / a missing module | negative control | `npm run test:coverage:direct:negative` | ✅ file, ❌ 5 cases |
| RCOV-03 | the changed-pair gate selects `origin/main` and says so | CI assertion | `grep -qx 'Changed-pair base: origin/main' coverage-direct.log` | ❌ — new CI job |
| RCOV-03 | `pre-commit run --all-files` is green | smoke | `pre-commit run --all-files` | ✅ command, currently **red** (`D-08-20`) |
| RCOV-03 | the whole gate chain is green | full suite | `npm run check` | ✅ |

### Sampling Rate
- **Per task commit:** `node --test <changed test path>` plus `node scripts/test-coverage-direct.mjs <changed source path>` for each pair the task touched — explicit single pairs, **not** the bare `npm run test:coverage:direct` (147 pairs, 6.5 min on this branch).
- **Per wave merge:** `npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:coverage:direct:negative && npm test`.
- **Phase gate:** `npm run check` green, `pre-commit run --all-files` green, and the second full report run complete with the pin regenerated from it.

### Wave 0 Gaps
- [ ] `scripts/test-coverage-direct.report.mjs:112` — repair the `map(pairForPath)` arity bug (blocks RCOV-01 entirely)
- [ ] `scripts/test-coverage-direct.negative.mjs` — a case planting the reporter's pair enumeration
- [ ] `.pre-commit-config.yaml` — widen the `fix-unicode-dashes` exclusion (`D-08-20`), so `--all-files` is green before a new hook is added to it
- [ ] the enumeration report run, in the repository, to completion — the input to every classification

*No framework install is needed; `node:test` is built in.*

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled. This phase changes test instrumentation, a filesystem-removal injection point, and CI/pre-commit wiring. It adds no authentication, session, network, or cryptographic surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no credential path is touched; `platform/git-credential.ts` is unchanged |
| V3 Session Management | no | no session surface |
| V4 Access Control | no | no authorization decision changes |
| V5 Input Validation | **yes (narrow)** | the pin is parsed data. `loadCoveragePin` must validate shape and refuse an unexpected one rather than coerce; the gate's `baseCandidateName` regex already guards the one ref name that comes from git output |
| V6 Cryptography | no | no cryptographic operation |
| V12 File & Resource | **yes (narrow)** | the removal port concentrates `rm`/`rename`; containment stays with `assertPathInside` (`shared/path-safety.ts`), which the port does **not** bypass — the port replaces the syscall, not the NFR-10 chokepoint in front of it |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A removal port widened into a general filesystem facade, bypassing `assertPathInside` | Tampering | `D-08-13`'s verb set is `rm`/`rename` only; callers keep owning containment, and `removeOrphanIfPresent`'s doc comment states the caller-owns-containment contract explicitly |
| A test double for the port that writes outside its fixture | Tampering | `createRemovalOpsFake` records and simulates; it must not perform real filesystem work |
| A malformed or attacker-supplied pin silently widening what the gate accepts | Tampering / Repudiation | the pin is a committed, reviewed, prettier-checked, `check-json`-validated file; `assertPinnedReadings` fails on an addition, a changed reading, a stale row, and a row naming a module not in `productionPaths()` |
| A gate reporting success without measuring | Repudiation | `D-08-18`'s planted cases; the `tee`/`pipefail` warning above; the `Changed-pair base:` assertion |
| A ref name from git output reaching a later git invocation | Injection | already mitigated: `baseCandidateName = /^[A-Za-z0-9._/-]+$/` in `selectBase`, and every git call uses an argument array, never a shell string |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `CONTRIBUTING.md`'s seven-module table | a measured set of seven **different** modules | Phase 6 splits + subsequent test work | four rows must be struck, three added; the sentence "each by one branch the compiler forces and no input can reach" is false |
| "the gate is deliberately not taught this list" (`CONTRIBUTING.md:69`) | `D-08-05`'s bidirectional pin | this phase | the paragraph must be rewritten, not merely softened — and the reason `D-117-20` barred the earlier list (a ledger-keyed verdict) is what the bidirectional framing answers |
| "neither script has a CI job" (`CONTRIBUTING.md:69,79`) | a dedicated CI job (`D-08-16`) + a local hook (`D-08-17`) | this phase | both sentences go |
| `D-116-01a`: these guards are compiler-forced | false for three iterable shapes, measured complete after rewrite | this phase | `D-08-09` reopens it for `args.ts` and `handlers/shared.ts`; the measurement adds `pending.ts` as a third |
| `t.mock.method(fs, "rm")` in bridge tests | an injected removal port | `TREF-08` removed the patching; this phase supplies the replacement | the G1 leak cases become observable; three `install-outcome.ts` arms become reachable as a side effect |
| `coverage/all-pairs.jsonl` as a baseline | a regenerated report from a repaired reporter | this phase | the 83-row artifact is superseded (`D-08-04`) |

**Deprecated/outdated:**
- `.planning/codebase/TESTING.md` describes a `tests/helpers/` tree throughout (lines 91, 93, 115, 124, 127). That directory **does not exist**. `[VERIFIED: ls tests/helpers → absent]` Validate every path in that document against the live tree before relying on it; the current rule (`.claude/rules/typescript-unit-testing.md`) explicitly forbids `test/helpers/`.
- `.planning/WINDOWS.md` entries 27 and 30 describe the pre-`report.mjs` state and the reverted accepted-shortfall list. Entry 30 is worth reading as prior art; its "RESOLVED 2026-09-04" note is what `D-08-05` now supersedes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/checkout@v7` with `fetch-depth: 0` creates `refs/remotes/origin/main` on a `pull_request` event | Gate Wiring (CI) | the gate silently falls through to `HEAD~1`. **Mitigated in the proposed job** by an explicit `git rev-parse --verify origin/main^{commit}` step and the printed-base assertion, so a wrong assumption fails loudly instead of passing quietly |
| A2 | JSON import attributes emit an `ExperimentalWarning` on Node 20.19 (the `engines` floor) | The Pin | none material — the recommendation rests on root-injectability, which is verified independently. Node 20 is not installed here |
| A3 | `timeout-minutes: 20` is adequate for the CI direct-coverage job | Gate Wiring (CI) | a long PR could time out; sized from the measured 6.2 min on a 935-commit branch, with ~3x headroom |
| A4 | four more `assert.throws` blocks in the negative harness stay under `duplicates.threshold: 3` | Negative Harness | a fallow dupes failure. Six blocks of that shape already exist and fallow is green, so the shape is tolerated; the pure-comparator split is what keeps the new cases from carrying fixture setup |
| A5 | the residual ~60 uncovered lines in `install-outcome.ts` can be closed by relocating owner coverage from `install-flow.test.ts` | Shortfall 6 | the phase's largest sizing risk. Evidence is strong (`install-flow.test.ts` covers all but 6 runs) but the relocation itself was not performed |
| A6 | a `HooksRuntime` spread decorator is an acceptable test double under the project's rules | Shortfall 4 | if the reviewer reads it as reaching into internals, the tests need a different shape. The rule's own wording supports it: `HooksRuntime` is an explicit constructor parameter of `createHooksHydration`, and the decorator overrides one declared member of a public interface |
| A7 | `prettier@3.9.5` (hook) vs `3.9.6` (installed) causes no formatting disagreement on the pin | The Pin | a pre-commit/CI formatting mismatch on the pin file. Low risk for JSON; worth a single `pre-commit run prettier --files <pin>` check |

## Open Questions

1. **Does `D-08-17`'s pre-commit hook survive its measured cost?**
   - What we know: the gate selects 147 pairs / 6.2 min on this branch today, by design (`origin/main...HEAD`), and the number grows with branch length.
   - What's unclear: whether the operator accepts that per-commit cost, or wants the hook scoped to the commit's own pairs while keeping one gate implementation.
   - Recommendation: escalate before writing the hook. Do not copy `D-08-17`'s "ten focused test runs" into `CONTRIBUTING.md`.

2. **Does the pin's row schema carry one reason or several?**
   - What we know: `discover.ts`'s single `reading` aggregates two independent unreachable sites (the `CommandNameError` arm under `BC-019`, and the `err.code ?? ""` arm, which `D-08-03` does not address).
   - What's unclear: whether `D-08-07`'s four fields become five (`reasons: string[]`), or one reason names both sites.
   - Recommendation: a `reasons` array. A row that records half its own evidence is the failure mode `D-08-07` exists to prevent.

3. **Can `install-outcome.ts` reach complete inside this phase?**
   - What we know: 75 lines / 23 branches / 5 functions short; `install-flow.test.ts` covers all but six runs; three of those six become reachable through the removal port.
   - What's unclear: the effort to relocate the remainder, and whether the resolver callback at 435-447 and the `hooksPhase.do` body at 801-823 have owner-test-shaped drivers.
   - Recommendation: its own plan, after the port, with an explicit escalation path. A pin row is not an acceptable fallback (`D-08-07`).

4. **Should the reporter's repair carry its own negative control, and where?**
   - What we know: nothing in `npm run check` runs the reporter; that is how the arity bug shipped and survived a code-review fix in the same phase that caused it.
   - What's unclear: whether the guard belongs in the existing `.mjs` negative harness or a `tests/scripts/` suite (`tests/scripts/check-phase-06-hub-ledger.test.ts` is the only current occupant, and `scripts` is a non-corresponding root).
   - Recommendation: the existing harness — it already imports `verdictFor` from the reporter, so the dependency exists.

5. **Is `removeOrphanIfPresent`'s direct `fs.rm` acceptable after the port?**
   - What we know: `D-08-13` names it among the helpers that keep calling `lstat`/`stat`/`readdir` directly, but it calls `fs.rm` twice — a port verb.
   - What's unclear: whether the decision's scope line was drawn in full knowledge of that.
   - Recommendation: leave it unported (criterion 4 names `cleanupStaging`), and record the exception in `fs-utils.ts`'s header so it reads as a decision rather than an oversight.

## Sources

### Primary (HIGH confidence — measured in this tree on 2026-09-10)
- `scripts/test-coverage-direct.mjs` (697 lines), `scripts/test-coverage-direct.report.mjs` (151), `scripts/test-coverage-direct.negative.mjs` (528) — read end to end
- Full report sweep: 229 rows, 467.7 s, verdict tally and per-pair `elapsedMs`
- Per-pair re-measurement of 8 modules in the repository
- LCOV uncovered-line / uncovered-branch / `FNDA:0` extraction for `install-outcome.ts`, `update-preflight.ts`, `pending.ts`, `discover.ts`, `event-router.ts`
- Removal-port build in a scratch copy: staged `tsc --noEmit` runs producing the 9-file / 42-site / 4-file / 205-line counts and `TS1016`
- `fallow health --fail-on-issues` on the ported tree: 0 above threshold
- Three loop rewrites + three `event-router` probe tests + a `pending.ts` rewrite, each measured by the gate; `tests/edge/**` 655 pass / 0 fail
- `pre-commit run fix-unicode-dashes` before and after the widened exclusion, in a throwaway repository
- Unicode-dash scan over `git ls-files` (one offender)
- `pairsForChangedPaths()` on this branch: 147 pairs, base `origin/main`, 935 commits ahead
- `prettier --check` and byte-diff of `JSON.stringify(…, null, 2)` against prettier output
- `tsc --noEmit` type probe for `for...of` / `.entries()` / indexed access under `noUncheckedIndexedAccess`
- `.fallowrc.json`, `.pre-commit-config.yaml`, `.prettierignore`, `.prettierrc.json`, `.gitignore`, `package.json`, `tsconfig.json`, `.github/workflows/{ci,lint}.yml`, `.planning/config.json` — all read directly
- `tests/architecture/unowned-exports-census.test.ts`, `tests/architecture/gate-targets.ts` — the pinned-census house pattern
- `.claude/rules/typescript-unit-testing.md`, `.claude/rules/typescript-comments.md`
- `git log -S`, `git log -L`, `git show` for `c0241c82` and `697d6812`

### Secondary (MEDIUM confidence — in-repo records, cross-checked against code)
- `08-CONTEXT.md`, `.planning/ROADMAP.md` §"Phase 8", `.planning/REQUIREMENTS.md` §"Direct Coverage", `.planning/STATE.md`
- `CONTRIBUTING.md` §"Coverage sweeps (manual)" and §"The whole-tree report" — four of its seven rows measured false today
- `.planning/WINDOWS.md` entries 27 and 30 — prior art for the pin
- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Tertiary (LOW confidence — not verifiable in this environment)
- `actions/checkout` ref behaviour on `pull_request` with `fetch-depth: 0` (A1)
- Node 20.19 JSON-module warning behaviour (A2)

## Project Constraints (from CLAUDE.md)

| Directive | Source | Effect on this phase |
|-----------|--------|---------------------|
| Read a file before editing it; trace a function's callers before modifying it | `CLAUDE.md` §General | the call-site inventory above is that trace, done by compiler |
| Never commit to `main`; feature branches are `features/*`; merge, never rebase | `CLAUDE.md` §Git | current branch is `features/refine-unit-tests` |
| Conventional Commits; title 5-72 chars; body ≤80 cols; **no GSD milestone/phase mentions** | `CLAUDE.md` §Git | commit subjects must not say "Phase 8"; cite requirement and decision IDs instead |
| Run `pre-commit run --all-files` (or `--files`) **before** committing; fix, restage, re-run | `CLAUDE.md` §Git | blocked today by `fix-unicode-dashes` → `D-08-20` is Wave 0. Also: CI runs `--all-files`, so scoped `--files` runs hide pre-existing violations |
| Never `--no-verify`; never rewrite history | `CLAUDE.md` §Git | `SKIP=<hook-id>` is the only sanctioned escape |
| `npm run check` must stay green (typecheck + ESLint + fallow + prettier + unit + integration) | `CLAUDE.md` §Quality bar / NFR-6 | fallow is a mandatory member of the chain; `fallow health` measured green on the ported tree |
| All user-visible output through `ctx.ui.notify`; no `process.stdout`/`stderr` in `extensions/**` | IL-2, enforced by ESLint **and** fallow `calls.forbidden` | the port adds no output; `scripts/*.mjs` is outside `extensions/` and may write to stdout |
| TypeScript strict; no `!`, no `as` available under the project's rules | `CLAUDE.md` §Tech stack, `.claude/rules/typescript-unit-testing.md` | verified: all three rewrites and the `event-router` tests need neither |
| All disk mutations atomic | NFR-1 | the port wraps `rm`/`rename`; `atomicWriteJson` is untouched |
| Refuse to write outside the scope roots | NFR-10 | `assertPathInside` stays in front of the port; the port replaces the syscall only |
| Comments cite durable spec IDs (`D-NN`, `NFR-N`, `RCOV-NN`, `BC-019`) and **never** `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N` | `.claude/rules/typescript-comments.md` | applies to the pin's header, the port's doc comments, and every new test title |
| No test-only export, reset hook, global mutator, test mode, bracket access, or `as any` | `.claude/rules/typescript-unit-testing.md`, `MF-DEC-07`, `D-05-01`..`03` | the port is the sanctioned alternative; the `HooksRuntime` decorator overrides a declared public member |
| Do not default a parameter to a live boundary; wire real adapters in one composition module | `.claude/rules/typescript-unit-testing.md` | directly supports `D-08-12`'s no-default rule and the five-composition-root design |
| Every production `.ts` has exactly one owner `.test.ts` at the mirrored path; each pair reaches 100% alone; no coverage pragmas | `.claude/rules/typescript-unit-testing.md` §Pairing and coverage | a new `shared/removal-ops.ts` creates a new pair obligation — declaring the interface inside `fs-utils.ts` avoids it |
| Fakes/contracts need no meta-tests | same | `createRemovalOpsFake` needs no `-fake.test.ts` |
| Do not create `test/helpers/`, `test/utils/`, `test/mocks/` | same | keep the fake beside the tests that consume it |
| Use CodeGraph before grep/read loops | `.claude/CLAUDE.md` | `.codegraph/` exists; the compiler-driven inventory above was the stronger instrument for this particular question |
| Version bump + `CHANGELOG.md` offered before a PR | `CLAUDE.md` §Versioning | phase close, not plan work |

## Metadata

**Confidence breakdown:**
- Reporter bug (Finding 0): **HIGH** — reproduced with a stack trace, root cause in one line, dated to a named commit by `git log -S`/`-L`
- Measured baseline and shortfall set: **HIGH** — one complete sweep plus eight individual re-measurements in the repository
- Three loop rewrites: **HIGH** — built, typechecked, measured complete, full `tests/edge/**` suite green
- `event-router.ts` reachability: **HIGH** — built, measured `branches 114/114, lines 967/967`; the specific call indices are **MEDIUM** as a long-term test design
- Removal-port inventory and atomicity verdict: **HIGH** — the port was built; every count is a compiler output, not an estimate
- Pin read mechanics and location: **HIGH** — both approaches run; prettier byte-equality verified; every config constraint read from the live file
- Pin comparison placement: **HIGH** — import graph traced; the one required `report.mjs` touch is identified with its justification
- Negative-harness attachment: **HIGH** on the file's shape (read end to end), **MEDIUM** on the clone-threshold budget (A4)
- `D-08-20` em-dash fix: **HIGH** — failure and fix both reproduced; single-offender scan over all tracked files
- Sweep cost and the `D-08-17` contradiction: **HIGH** — 147 pairs measured, 6.2 min derived from per-pair measurements of the same tree
- CI job block: **MEDIUM** — the `fetch-depth: 0` precedent is verified in-repo, but GitHub's PR ref behaviour (A1) and the timeout (A3) are assumed and mitigated by in-job assertions
- `install-outcome.ts` remediation sizing: **MEDIUM** (A5) — the diagnosis is measured, the relocation effort is not

**Research date:** 2026-09-10
**Valid until:** 2026-09-24 for the tooling and configuration findings. The **measured coverage readings expire the moment any test or production file changes** — re-measure rather than quote them. `[VERIFIED: the instrument halts at the first refusal, which is exactly why every count in circulation was stale]`
