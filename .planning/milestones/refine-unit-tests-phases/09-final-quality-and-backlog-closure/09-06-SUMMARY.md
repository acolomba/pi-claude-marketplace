---
phase: 09-final-quality-and-backlog-closure
plan: 06
subsystem: planning-records
tags: [closure, measurement, coverage-pin, reachability, audit-trail]
status: complete

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-01's injected hooks read port — the last production change on the tree these measurements describe"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-02's re-measured 230-pair coverage surface and the byte-identical pin the three reachability claims are read against"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-03's two-commit requirement seal, whose eight IDs this ledger records"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-04's repaired window ledger and the three entries it closed"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-05's eight terminal backlog dispositions, whose exact words this ledger reuses"
provides:
  - "A final-tree `npm run check` measurement taken at `d83a6dc3`: exit 0 in 246s, unit `pass 6007 / fail 0`, integration `pass 32 / fail 0`"
  - "A final-tree `npm run test:coverage:direct:all` measurement taken at the same commit: exit 0 in 480s over 230 pairs, both pinned shortfalls matched exactly"
  - "`09-CLOSURE-LEDGER.md`: 24 rows in one five-word vocabulary, every row carrying a command run this cycle or a file-and-line citation"
  - "Three traced coverage-pin reachability arguments, including the two residuals the pin's own text does not name"
  - "One explicit `unresolved` caveat row for the `direct-coverage` CI job, naming what is unproven and what would close it"
affects: [phase verification, /gsd-ship, the milestone close]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate`.
actuals:
  tokens: 14200
  tasks: 3
  commits: 2
plan_head_before: d83a6dc32101aa89d828a029e2fbbc5ecf857a04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A claim about a tree is measured on that tree, with the commit SHA recorded beside the output, and never inherited from an earlier wave's artifact"
    - "A closure record uses one closed disposition vocabulary shared with the source records it summarizes, so the two cannot drift apart"
    - "An unverifiable claim gets its own row naming what is unproven and what would close it, rather than being absorbed into a passing claim"

key-files:
  created:
    - .planning/phases/09-final-quality-and-backlog-closure/09-CLOSURE-LEDGER.md
    - .planning/phases/09-final-quality-and-backlog-closure/09-06-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Both measurements were re-run on the final tree even though waves 4 and 5 touched only `.planning/` — D-09-10 requires the final tree, and a measurement that was true earlier is a different claim from one taken now"
  - "All three pin `reasons` claims were traced against the current source rather than inherited from `09-RESEARCH.md` §6; the research conclusions were confirmed in direction and two of them were confirmed as stronger than the pin states"
  - "The hooks re-parse guard is recorded as reachable by a filesystem mutation between two reads, not softened into `unreachable` — the two calls read the same path at two different times"
  - "Both pin-claim rows carry `evidence-only`, not `implemented`: the argument is a reading, and nothing in this repository can gate a reading"
  - "The clean-tree precondition was read over the surface the two measurements cover, not over the whole checkout, following 09-03's precedent; sixteen pre-existing session-external residue entries are named in the ledger rather than hidden"
  - "`09-04-SUMMARY.md`'s claim that phase 116 is `still the largest group at 5` is corrected in the ledger: phase 115 is largest at 6, with 116 and 117 tied at 5"

patterns-established:
  - "Before trusting a superlative inherited from a sibling summary, recompute the distribution it summarizes — the count can be right while the superlative is wrong"
  - "When a pre-commit-managed formatter excludes a directory, check the exclusion before shaping a table to survive reformatting that will never run"

requirements-completed: [CLOSE-01, CLOSE-02]

coverage:
  - id: D1
    description: "The complete project quality suite was measured on the final tree, at the commit it was taken at, with its real output recorded"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "npm run check at d83a6dc3 -> exit 0 in 246s; unit `tests 6007 / pass 6007 / fail 0 / skipped 0`; integration `tests 32 / pass 32 / fail 0`"
        status: pass
    human_judgment: false
  - id: D2
    description: "The strict whole-tree coverage arm was measured on the same final tree over all 230 pairs"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:all at d83a6dc3 -> exit 0 in 480s, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.`, `All-pair run complete: 230 pairs in 480.1s (480121ms) on v26.8.2`"
        status: pass
      - kind: other
        ref: "wc -l coverage/all-pairs.jsonl -> 230"
        status: pass
    human_judgment: false
  - id: D3
    description: "All three coverage-pin reachability claims were traced against the current source this cycle and each carries a stated conclusion with citations"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "grep -rn \"nameCommandInDir\" extensions/ tests/ scripts/ -> discover.ts:222 (declaration), discover.ts:286 (call), and the pin's own prose; no other module or test"
        status: pass
      - kind: other
        ref: "grep -c 'PLUGIN_ENTRY_VALIDATOR' install-outcome.ts domain/components/plugin.ts -> 2 and 1; identical-schema premise traced through manifest.ts:28,40,70,79"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/commands/discover.ts -> `branches 55/57, lines 412/414`, the pin row's exact reading, `1 pinned shortfall(s) matched ... exactly.`"
        status: pass
    human_judgment: true
    rationale: "The conclusions are readings. The commands above establish the premises — module privacy, schema identity, the measured coverage reading — but whether a `reasons` entry is true is the judgement 08-04's deliverable D5 says only a reader can make, and no gate in this repository expresses it."
  - id: D4
    description: "`09-CLOSURE-LEDGER.md` carries 24 rows in one closed five-word vocabulary, each with non-empty evidence"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "grep -oE '\\| (implemented|evidence-only|superseded|deferred|unresolved) \\|' 09-CLOSURE-LEDGER.md | wc -l -> 24; kind tally -> 8 requirement, 7 backlog, 1 todo, 5 window, 3 caveat"
        status: pass
      - kind: other
        ref: "awk over every table row's Evidence cell -> zero empty cells"
        status: pass
      - kind: other
        ref: "git ls-files -- .../09-CLOSURE-LEDGER.md -> tracked"
        status: pass
    human_judgment: false
  - id: D5
    description: "Exactly two rows read `unresolved` — window entry 9 and the `direct-coverage` CI job — and the CI row is the only one in the `caveat` kind"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "grep -c '| unresolved |' 09-CLOSURE-LEDGER.md -> 2"
        status: pass
    human_judgment: false
  - id: D6
    description: "No ledger row describes a coverage reading as assertion strength, and the boundary is stated once in the preamble"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "grep -c 'reachability evidence only' 09-CLOSURE-LEDGER.md -> 1; every row read against D-09-18 before committing"
        status: pass
    human_judgment: true
    rationale: "A semantic claim about prose. The grep proves the boundary sentence is present; whether any row violates it is a reading, which 09-VALIDATION.md lists as manual-only."
  - id: D7
    description: "The requirement seal is unharmed by the ledger commit"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs scope-impact --check after the commit -> `Scope impact valid: 40 records.`, exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 22 min
completed: 2026-09-11
---

# Phase 9 Plan 06: Final Quality and Backlog Closure Summary

**The whole suite and the whole-tree coverage sweep were re-measured on the tree that ships, all three coverage-pin reachability claims were traced against the current source rather than inherited, and the milestone's closure record now carries 24 rows in one vocabulary — with the two things this repository cannot settle written down as unresolved instead of absorbed into a passing claim.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-11T21:52Z
- **Completed:** 2026-09-11T22:14Z
- **Tasks:** 3 of 3
- **Files created:** 1 (plus this SUMMARY)

## Task 1: the final-tree measurement, verbatim

Both commands were run from the repository root on commit
`d83a6dc32101aa89d828a029e2fbbc5ecf857a04` (`d83a6dc3`, "docs(backlog): close out the
terminal-disposition plan"), dated 2026-09-11. **Neither figure is carried over from plan 09-02 or
plan 09-03.** Those runs measured earlier trees and remain correct statements about those trees;
this is the run `CLOSE-01` asserts over.

Waves 4 and 5 touched only `.planning/WINDOWS.md` and `.planning/BACKLOG.md`, neither of which is
on the surface `npm run check` reads — so the suite was expected to come back unchanged, and it
did. It was re-run anyway because D-09-10 asks for the final tree, and a measurement that was true
earlier is not the same claim as one taken now.

### `npm run check`

Exit status **0**. Wall clock **246s** (2026-09-11T21:54:31Z → 21:58:37Z).

```
$ npm run check
> pi-claude-marketplace@0.18.1 check
> npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration
```

Unit suite (`npm test`):

```
ℹ tests 6007
ℹ suites 301
ℹ pass 6007
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33591.414515
```

Integration suite (`npm run test:integration`):

```
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10475.317775
```

Intermediate gates in the chain, verbatim:

```
✓ No issues found (0.63s)
✗ 0 above threshold · 13016 analyzed · maintainability 91.8 (good) (0.23s)
✗ 915 lines (1.1%) duplicated across 38 files (0.19s)
Checking formatting...
All matched files use Prettier code style!
Corresponding-test gate passed.
Corresponding-test negative controls passed.
Direct-coverage negative controls passed.
1 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
```

The two `✗` lines are fallow's informational `health` and `dupes` counts. Both sit inside their
configured thresholds and neither fails the run — the chain continued past them to the tests, and
`typecheck` and `lint` each exited 0 with no issue rows.

### `npm run test:coverage:direct:all`

Exit status **0**. Wall clock **480s** (2026-09-11T21:58:46Z → 22:06:46Z).

```
$ npm run test:coverage:direct:all
> pi-claude-marketplace@0.18.1 test:coverage:direct:all
> mkdir -p coverage && node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl
```

Final two lines, verbatim:

```
2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
All-pair run complete: 230 pairs in 480.1s (480121ms) on v26.8.2
```

`wc -l coverage/all-pairs.jsonl` → `230`. The 480s figure is within 1s of 09-02's 479.4s on the
same 230 pairs, which is a coincidence of a stable tree rather than a reused number — the
timestamps above bound this run.

### The clean-tree precondition — read, and reported unsatisfied

`git status --porcelain` is **not** empty in this checkout and cannot be made empty by this plan.
It carries sixteen entries of pre-existing, session-external residue: the operator's
`.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, an
untracked `.codegraph/` index, and ten untracked review documents under
`.planning/phases/01-…` and `.planning/phases/08-…`.

Every entry was classified against the measured surface before the runs started. None is under
`extensions/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`, `eslint.config.js`,
`.fallowrc.json`, `tsconfig.json` or `.prettierrc.json`, so none is on the surface either
measurement reads. Plan 09-03 read the same precondition the same way, for the same reason, and
recorded it. The acceptance criterion "`git status --porcelain` prints nothing" is therefore
reported as **unsatisfied and documented** rather than satisfied in appearance — the same
treatment 09-04 gave window entry 30's `resolved_at`.

## Task 2: the three pin claims, traced this cycle

Every argument below comes from a trace performed in this task against the current source.
`09-RESEARCH.md` §6 reached the same three conclusions, but inheriting a judgement is precisely
the defect 08-04's standing caveat names, so each was re-walked. All three hold. Research's
direction was confirmed in every case; nothing needed correcting.

### Claim 1 — `discover.ts:288-290`, the `CommandNameError` narrowing arm: **no input reaches it**

- **Module privacy.** `grep -rn "nameCommandInDir" extensions/ tests/ scripts/` returns exactly
  two source lines — the declaration at
  `extensions/pi-claude-marketplace/bridges/commands/discover.ts:222` and the call at `:286` —
  plus the pin's own prose in `scripts/test-coverage-direct.pin.json:10`. No test and no sibling
  module reaches the helper.
- **Single throw path.** The helper's entire body is a `try`/`catch` whose catch clause
  unconditionally executes `throw new CommandNameError(sourceName, base, { cause: err })`
  (`discover.ts:226`). The only value it can throw is a `CommandNameError`.
- **The constructor cannot throw first.** `CommandNameError`
  (`extensions/pi-claude-marketplace/shared/errors-bridges.ts:112-122`) performs a
  template-literal `super(...)` over two `string` parameters and three field assignments. Nothing
  there can throw for any input.

**Conclusion:** the arm is unreachable for every input. Only a `Symbol.hasInstance` patch on the
class — which `TREF-08` forbids planting — or a cross-realm boundary would make `instanceof` false
for a genuine instance. The pin's reason is correct as written.

**Why it cannot simply be deleted.** The `if` is what narrows `err: unknown` to `CommandNameError`
for `badNameWarning(err: CommandNameError)` at `discover.ts:101`. Neither a non-null assertion nor
an `as` cast is available under this repository's lint rules, so removing the arm means
restructuring the call site, not deleting three lines.

### Claim 2 — `install-outcome.ts:422-426`, the manifest-entry re-check: **unreachable by input, with one residual the pin omits**

Traced end to end:

```
install-outcome.ts:413   loadCachedMarketplaceManifest(sourceMp.manifestPath)
install-outcome.ts:300   → loadMarketplaceManifest(manifestPath)      [domain/manifest.ts]
domain/manifest.ts:70        MARKETPLACE_VALIDATOR.Check(parsed)  — before the return at :79
domain/manifest.ts:40        MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA)
domain/manifest.ts:28        MARKETPLACE_SCHEMA.plugins = Type.Array(PLUGIN_ENTRY_SCHEMA)

install-outcome.ts:414   entryRaw = manifest.plugins.find((p) => p.name === plugin)
install-outcome.ts:422   if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) { throw … }   ← the arm
domain/components/plugin.ts:89  PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA)
```

The schema that accepted the array element and the schema the re-check applies are the same
`PLUGIN_ENTRY_SCHEMA` object, compiled twice. `entryRaw` is an element of an array that schema
already validated, in this process, from this parse. **The arm is unreachable for any input.**

**The residual the pin's text does not name.** `extensions/pi-claude-marketplace/domain/manifest-cache.ts:15-20`
records decision D-03: cache hits return the loaded value **by reference**, and the header states
"The seam preserves the raw `JSON.parse` value, so callers MUST treat the result as READ-ONLY." A
caller that violated that contract and mutated a cached entry between the validated load and this
re-check would make the arm fire. That is a program defect rather than an input, so the
reachability claim stands as written — but it is the exact shape of the thing the re-check is
defense-in-depth against, and naming it makes the pin a better record.

### Claim 3 — `install-outcome.ts:818-820`, the hooks re-parse guard: **not input-reachable, but reachable by a filesystem mutation**

The pin says the only difference between the two `parseHooksConfig` calls is `skipIfMap`, and that
`D-61-02` keeps an `if`-field issue from producing a refusal. Read against
`extensions/pi-claude-marketplace/domain/components/hooks.ts`, the argument is **stronger**:

- `:243-247` — `JSON.parse` throws → `return { ok: false, … }`
- `:257-261` — `!HOOKS_VALIDATOR.Check(candidate)` → `return { ok: false, … }`
- `:282` — `options.skipIfMap` is consulted only on the success path, selecting an empty `Map`
  versus `buildIfPredicateMap(...)`

Both `{ok:false}` returns occur **before** `skipIfMap` is read at all, so the option is
structurally incapable of changing the ok-or-not verdict for identical bytes. That holds
regardless of what `compileIf` does, which is stronger than the pin's own `D-61-02` argument.

**But the two calls read the file twice.** The resolver reads
`path.join(pluginRoot, "hooks", "hooks.json")` through its injected `readFileText`
(`domain/hooks-resolution.ts:30,36`); the ledger phase reads
`path.join(c.resolved.pluginRoot, c.resolved.hooksConfigPath)` (`install-outcome.ts:811-814`),
where `hooksConfigPath` is `path.join("hooks", "hooks.json")` (`domain/hooks-resolution.ts:49`).
Same path, two separate reads at two different times.

**Conclusion:** the arm is not input-reachable, but it **is** reachable by a filesystem mutation
between the two reads. That is a genuine window inside the install, not a phantom, and it is
exactly what the guard is for. It is recorded as such and not softened into "unreachable". No unit
test can produce it deterministically without patching `readFile`, which `TREF-08` bars.

### The gate reading, re-measured

`node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/commands/discover.ts`
→ `Direct coverage shortfall recorded: … (branches 55/57, lines 412/414)` followed by
`1 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.` — the pin row's
exact reading, exit 0.

**No conclusion above rests on a coverage reading.** A complete reading would say every arm ran;
it would say nothing about whether the owner test asserted anything worth asserting. The three
arguments are source traces, and the coverage reading appears only as evidence that the pin row
still describes the tree.

## Task 3: `09-CLOSURE-LEDGER.md`

Created at `.planning/phases/09-final-quality-and-backlog-closure/09-CLOSURE-LEDGER.md` and
committed as `76d604d0`. It follows `07-FINDING-DISPOSITIONS.md`'s preamble discipline, table
shape and split-disposition sections, but **not** its status vocabulary — that column carries free
prose, and this one is a closed five-word set.

**24 rows, measured:**

| kind | count | dispositions |
| --- | --- | --- |
| `requirement` | 8 | all `implemented` — `GGAT-01/03/04`, `RCOV-01/02/03`, `CLOSE-01/02` |
| `backlog` | 7 | 4 `implemented`, 1 `superseded`, 1 `evidence-only`, 1 `deferred` |
| `todo` | 1 | `deferred` |
| `window` | 5 | 4 `implemented`, 1 `unresolved` (entry 9) |
| `caveat` | 3 | 2 `evidence-only`, 1 `unresolved` (the CI job) |

Every one of the eight words plan 09-05 wrote into `.planning/BACKLOG.md` and the pending todo
file is reused character-identically.

**Split-disposition sections written:** `REASON-01` (the terminal route shipped; neither of the
two cases the item named by hand was rerouted), `GAUTH-01` (the cause line exists and is wired at
one of five call sites), window entry 30 (one half fixed outright, one half accepted as
superseded, and why its `resolved_at` cannot be populated), both pin-claim rows with their
residuals, the `direct-coverage` CI job, and window entry 9's retained-not-scheduled status.

**The CI-job row states three things precisely.** What the local proxy proves — the gate's own
logic, its fail-closed base selection, its pin comparator, and both the commit-scoped and
whole-tree arms, all exercised here. What it cannot prove — whether `actions/checkout` at
`fetch-depth: 0` creates `refs/remotes/origin/main` on a `pull_request` event, which is what the
job's two `pull_request`-scoped assertion steps exist to catch and which no local run can
exercise. And that whether `direct-coverage` is a **required** status check is a protected-branch
setting living in no tracked file. What would close it: the job's first real run on a pull
request, green, with both assertion steps passing. It is not folded into a passing claim and it is
not described as low risk.

### One inherited claim that did not survive re-verification

`09-04-SUMMARY.md` says the ledger is left "19 open, phase 116 still the largest group at 5." The
count of 5 for phase 116 is right; the superlative is not. Recomputed from the fenced JSON this
cycle, the 19 open entries distribute as `{86: 1, 88: 2, 115: 6, 116: 5, 117: 5}` — phase **115**
is the largest remaining group at 6, with 116 and 117 tied behind it at 5 each. The ledger names
the full distribution and records the correction.

## Verification results

| check | result |
| --- | --- |
| `npm run check` on the final tree | exit 0, 246s, unit `pass 6007 / fail 0`, integration `pass 32 / fail 0` |
| `npm run test:coverage:direct:all` on the final tree | exit 0, 480s, 230 pairs, 2 pinned shortfalls matched exactly |
| `git ls-files -- …/09-CLOSURE-LEDGER.md` | tracked |
| `grep -c '\| unresolved \|' …/09-CLOSURE-LEDGER.md` | `2` |
| `grep -oE '\| (implemented\|evidence-only\|superseded\|deferred\|unresolved) \|' … \| wc -l` | `24` |
| kind tally over the table | 8 requirement, 7 backlog, 1 todo, 5 window, 3 caveat |
| empty `Evidence` cells | `0` |
| `grep -c '116' …/09-CLOSURE-LEDGER.md` | `5` |
| `grep -c 'reachability evidence only' …/09-CLOSURE-LEDGER.md` | `1` |
| `node scripts/revalidation.mjs scope-impact --check` after the commit | `Scope impact valid: 40 records.` |
| `SKIP=trufflehog pre-commit run --files …/09-CLOSURE-LEDGER.md` | every applicable hook Passed; the markdown formatters skip `.planning/` by configured exclusion |

## Deviations from Plan

**1. [Rule 2 — record correctness] Commit scopes are semantic, not `{phase}-{plan}`**

- **Found during:** Task 3, at commit time
- **Issue:** The executor's default protocol prescribes `{type}({phase}-{plan}):`, which
  `CLAUDE.md` forbids ("Avoid GSD milestone/phases mentions").
- **Fix:** `docs(closure): …` and `docs(closure): …`. CLAUDE.md takes precedence.
- **Commits:** `76d604d0`, plus this SUMMARY's commit

**2. [Rule 3 — blocking] `gsd-tools query state.update-progress` not run**

- **Found during:** close-out
- **Issue:** The verb corrupts this workstream's progress frontmatter; all five prior waves hit it.
- **Fix:** `.planning/STATE.md` hand-edited (`completed_plans` 209 → 210). `percent` stays `44` and
  `completed_phases` stays `4` — phase 9 is not marked complete until its verification runs.
  `roadmap update-plan-progress 09` was called as the sanctioned path for `ROADMAP.md`.

**3. [documented, not fixed] The clean-tree precondition cannot be satisfied in this checkout**

- **Found during:** Task 1, before the first measurement
- **Issue:** Task 1's precondition asks for an empty `git status --porcelain`. The checkout carries
  sixteen pre-existing, session-external entries this plan may not touch — operator configuration
  files and untracked review documents.
- **Resolution:** Every entry was classified against the measured surface and none is on it. The
  criterion is reported unsatisfied and documented rather than satisfied in appearance, following
  09-03's precedent for the same precondition. Not auto-fixed: committing or deleting the
  operator's own files would be a worse outcome than an honest note.

**Total deviations:** 2 auto-applied (1 record correctness, 1 blocking-tool workaround), 1
documented-unsatisfied. **Impact:** none on the measurements or the ledger's content.

## Issues Encountered

None beyond the documented precondition divergence above. Both measurements came back green on the
first run.

## Next Phase Readiness

Phase 9's six plans are complete. The milestone's confirmed work is measured as a whole on the
tree that ships it, the bundled backlog is closed with an audit trail in one vocabulary, and the
two things that cannot be settled from inside this repository — the `direct-coverage` CI job's
first real run and its protected-branch status — are named as `unresolved` rather than absorbed.

Ready for `/gsd-verify-work 09`, then the milestone close. Two items travel forward: the CI job's
`unresolved` row settles on the pull request, and nineteen window entries remain open on terminal
evidence, whose effect on `/gsd-ship` is the operator's call at ship time.

## Self-Check: PASSED

- `.planning/phases/09-final-quality-and-backlog-closure/09-CLOSURE-LEDGER.md` — FOUND, tracked by git
- `.planning/phases/09-final-quality-and-backlog-closure/09-06-SUMMARY.md` — FOUND
- Commit `76d604d0` — FOUND in `git log`
- All Task 1, Task 2 and Task 3 acceptance criteria re-run above; the one unsatisfiable criterion
  is reported as unsatisfied rather than skipped
- Plan-level `<verification>` re-run: both measurements exit 0, the ledger carries 24 rows inside
  the closed set, exactly two read `unresolved`, every disposition word matches 09-05's, and
  `scope-impact --check` still prints `Scope impact valid: 40 records.`
