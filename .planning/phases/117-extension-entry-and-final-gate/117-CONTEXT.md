# Phase 117: Extension Entry and Final Gate - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the last production module — `extensions/pi-claude-marketplace/index.ts` gets its mirrored
owner `tests/index.test.ts`, taking the pair total from 203/204 to 204/204 — then bring the
repository-wide gates to a state where they are complete, provably firing, and green over all 204
rows.

Four workstreams, in scope:

1. **The entry pair.** `tests/index.test.ts` owns `index.ts` with 100 percent direct function, line
   and branch coverage, absorbing the two legacy tests that drive `index.ts` from the wrong path.
2. **Correspondence gate cleanliness.** All 8 current violations resolved, and the gate taught to
   reject proxy-owned and ambiguous mappings, each new check carrying a COV-04 negative control.
3. **`tests/helpers/` dissolved.** SUITE-02 satisfied by moving every support module beside its
   concern and deleting the directory.
4. **The all-pair proof.** The Node 24 all-pair run measured, then a complete direct-coverage record
   produced for every one of the 204 inventory rows, with no aggregate-coverage substitution.

Plus the phase-boundary bookkeeping sweep that makes the inventory truthful (SUITE-06).

**Out of scope, decided:** no production source edits (both phase-116 licences are spent and no new
licence was opened); the unused-type-member gate; the tool parameter-description decision; a
repo-wide audit of every pre-existing gate's negative control.

</domain>

<decisions>
## Implementation Decisions

### Orphan test disposition

The correspondence gate reports **8 violations** measured in this tree on 2026-09-03:
`missing-test: tests/index.test.ts` plus **7 `unexpected-test`** rows. Each of the seven is resolved
by subject, not by an allow-list — SUITE-04 bars restoring an exemption-list mechanism.

- **D-117-01:** Fold each supplement into the mirrored owner of the module it actually measures;
  relocate to `tests/architecture/` only the ones that span modules and so have no single owner.
  The gate already exempts `architecture`, `e2e` and `integration` by root, so relocation needs no
  gate change. — **Reversibility:** costly — undoing means re-splitting merged suites and rewriting
  the import graph a second time across the same files.

  | Orphan | Disposition |
  | --- | --- |
  | `tests/shared/index-smoke.test.ts` (434 lines) | fold into `tests/index.test.ts` |
  | `tests/edge/index-handler.test.ts` (235 lines) | fold into `tests/index.test.ts`, casts dropped |
  | `tests/shared/device-flow-prompt.test.ts` | fold into `tests/domain/github-auth.test.ts` |
  | `tests/orchestrators/marketplace/cascade.test.ts` | fold into `tests/orchestrators/marketplace/shared.test.ts` |
  | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | relocate to `tests/architecture/` |
  | `tests/bridges/integration-materialization-gate.test.ts` | relocate to `tests/architecture/` |
  | `tests/helpers/source-scan.test.ts` | relocate to `tests/architecture/` (see D-117-04) |

- **D-117-02:** `tests/edge/index-handler.test.ts` holds the 7 `as any` / `as unknown as` casts that
  are absent from every one of phase 116's 30 pairs — D-116-10 deferred it here for exactly this.
  The casts do not survive the fold. If a proof cannot be restated without one, that is a finding to
  report, not a cast to carry forward.

- **D-117-03:** Both folds into `tests/index.test.ts` must land in a suite that reaches 100 percent
  direct coverage of `index.ts` when run alone. The existing hand-rolled `MockPi` shape in
  `index-smoke.test.ts` is not automatically the shape the new owner keeps; the owner follows the
  house pattern for a registration table (see Established Patterns below).

### tests/helpers/ dissolution

SUITE-02 bars a generic test-support directory and `tests/helpers/` is one. Consumer counts measured
by grep on 2026-09-03:

| Support module | Consumers | Distribution |
| --- | --- | --- |
| `source-scan.ts` | 5 | all in `tests/architecture/` |
| `ipc-child.ts` | 2 | all in `tests/integration/` |
| `marketplace-seed.ts` | 15 | 13 `tests/edge/handlers/`, 2 `tests/orchestrators/plugin/` |
| `notification-boundary.ts` | 26 | 22 `tests/edge/`, 4 `tests/orchestrators/` |

- **D-117-04:** Dissolve `tests/helpers/` in this phase. Two modules have an unambiguous home; the
  two cross-tier ones go beside their **dominant** consumer and the minority imports across the tier
  boundary. **50 import lines across 35 files**, plus one load-bearing data string at
  `tests/helpers/source-scan.test.ts:55`. (Corrected by research from the discuss-time estimate of
  ~48 across ~45.) — **Reversibility:** costly — undo touches
  every one of those import sites again.

  ```text
  tests/architecture/source-scan.ts         (5 consumers, all local)
  tests/architecture/source-scan.test.ts    (its orphan resolved by the same move)
  tests/integration/ipc-child.ts            (2 consumers, all local)
  tests/edge/notification-boundary.ts       (22 local, 4 cross-tier)
  tests/edge/handlers/marketplace-seed.ts   (13 local, 2 cross-tier)

  tests/helpers/ deleted.
  ```

- **D-117-05:** The 6 surviving cross-tier imports (4 into `notification-boundary.ts`, 2 into
  `marketplace-seed.ts`) are accepted and named, not hidden. `.fallowrc.json`'s zone rules govern
  `extensions/`, not `tests/`, so they break no configured boundary — but the plan states them
  explicitly rather than leaving them to be rediscovered.

- **D-117-06:** Duplicating a helper per tier was rejected. Two copies of a boundary helper that
  roughly 20 phase-116 proofs depend on is the drift this milestone exists to remove, and
  `fallow dupes` runs at `threshold: 3`.

- **Measured, so it is not a surprise mid-execution:** `node --test` with a brace glob naming a
  missing directory exits 0 and runs the remaining directories. Probed directly on 2026-09-03 with a
  scratch tree (`tests/{alpha,ghost}/**/*.test.ts` → `pass 1`, exit 0). Deleting `tests/helpers/`
  therefore breaks neither `npm test` nor `npm run test:coverage:unit`. The `helpers` entry in both
  globs becomes dead; remove it for honesty, not for function.

### Gate strengthening

- **D-117-07:** Add proxy-owned and ambiguous detection to the structural gates. OWN-02 ("without
  using a barrel or alternate module as a proxy") and COV-02 ("fails closed for a missing,
  ambiguous, or unmapped source or test path") are named requirements of this phase with no other
  owner, and success criterion 2 requires the gate to reject them. Today
  `scripts/check-corresponding-tests.mjs` detects only `missing-test`, `wrong-import` and
  `unexpected-test`. — **Reversibility:** reversible.

- **D-117-08:** Every new check gets a COV-04 negative control that **plants the violation** and
  proves the gate rejects it. A control that reads the gate's configuration back is not a control —
  this repository already shipped one inert gate that way. The two existing controls
  (`check-corresponding-tests.negative.mjs`, `test-coverage-direct.negative.mjs`) are the pattern to
  extend.

- **D-117-09:** No repo-wide audit of pre-existing gates' negative controls. COV-04 is satisfied for
  what this phase builds; anything else is reported, not swept.

### All-pair coverage run

A blocker recorded before phase 116 began: measure the Node 24 all-pair duration **before** adding
concurrency. `test:coverage:direct:all` spawns 204 sequential `node --test` subprocesses today.

- **D-117-10:** Measure first, decide second. One task times the full sequential 204-pair run on
  Node 24 and records the wall-clock **read from the runner**, never computed from a delta — the
  arithmetic-versus-measurement rule that already cost this milestone a wrong suite total. Whether
  to parallelize is a follow-on decision made against that number.

- **D-117-11:** If concurrency is added, it ships with a negative control proving a planted failing
  pair is still detected when runs interleave. If it is not added, the plan records the measured
  duration and the reason. Either outcome is acceptable; an unmeasured choice is not.

### Phase-boundary sweep

- **D-117-12:** Sweep the inventory to truth in this phase, because SUITE-06 depends on it:
  - the pair total from 203/204 to 204/204 in ROADMAP.md **and** STATE.md prose;
  - `MOD-10` closed;
  - `REQUIREMENTS.md` status drift — `MOD-07` still reads `Pending` though Phase 114 verified, and
    the per-pair Status column lapsed at Phase 110. **Measured: 154 rows read `Open`**, not the
    ~115 estimated at discuss time — phases 110-114 are 123 rows and **phase 116's own 30 rows are
    also still `Open`**, which the discuss-time count missed entirely.
  - ROADMAP carries the plan count in **two** places that drift independently. Fix both.

- **D-117-13:** No production licence is opened. Both phase-116 licences are spent, and none was
  granted here. Consequences, recorded rather than fixed:
  - WINDOWS entry 20 — the two `edge/register.ts` comments (18-20 and 104-106) asserting a
    registration-time `process.cwd()` capture the code does not make; it is read per invocation,
    measured, with Plant C turning exactly that case RED.
  - the two stale `edge/completions/data.ts` comments (`getScopeCompletions` export that does not
    exist at 1-12; `--partial` described as widening the install set at 361 when it shifts it).
  - `BOOLEAN_FLAGS` still re-exported from `edge/handlers/plugin/list.ts` solely for
    `tests/architecture/flag-catalog-drift.test.ts`.

  A branch or comment that cannot be corrected without a production edit is a finding to report, not
  a licence to take.

- **D-117-14:** The tool `available` / `unavailable` parameter-description decision stays open for
  the operator. After D-116-15's CR-01 fix made the `remote` and `partially-available` arms
  reachable, the wording admits a bucket it does not mention — changing it alters the LLM-facing
  contract and the pinned registration schema. — **Reversibility:** one-way — the descriptions are
  part of a published tool contract an LLM consumes and a pinned registration schema asserts; a
  later revert is a second contract change, not an undo.

### Research corrections — measured after these decisions were taken

Phase 117 research (`117-RESEARCH.md`) measured against this tree and overturned four premises these
decisions rested on. The decisions stand; these are the corrections to the facts under them.

- **D-117-15 (NEW, blocking): `npm test` cannot see `tests/index.test.ts`.** Every alternative in the
  glob `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
  names a DIRECTORY, so a file at the `tests/` root matches nothing. Confirmed independently:
  `globSync` returns **249 paths and `tests/index.test.ts` is not among them**. Because
  `test:coverage:direct:all` enumerates production modules itself rather than through that glob, the
  entry pair would report **green direct coverage while its owner never ran under `npm test`** — a
  green run that checked nothing, the exact defect class this milestone exists to remove. **Both the
  `test` and `test:coverage:unit` globs must be amended, and the amendment needs a control that fails
  if the root file stops being matched.** This supersedes the "remove the dead `helpers` entry for
  honesty, not for function" note above: those globs now need a functional change, not a cosmetic one.

- **D-117-16 (NEW): 7 of the 204 modules are type-only, and they produce no coverage record at all.**
  Measured — all seven are named `types.ts`: `edge/`, `orchestrators/`, `orchestrators/import/`, and
  `bridges/{agents,commands,mcp,skills}/`. `assertCompleteCoverage` returns the string `"type-only"`
  for them and passes unconditionally. COV-05 requires "one complete direct coverage record for each
  of the 204 inventory rows"; for these seven there is no record to produce, because a module that
  emits no JavaScript has no lines to cover. **The plan must state which reading of COV-05 it takes
  and why** — it cannot be met literally for all 204. Do not resolve this by adding a pragma or by
  weakening the other 197.

- **D-117-17 (NEW): merged coverage HIDES an uncovered branch — the aggregate is wrong in the safe
  direction, not merely weaker.** Measured on this very pair: run alone, `index-smoke` emits
  `BRDA:118,6,0,0` (branch uncovered); merged with `index-handler`, V8 emits **no range for line 118
  at all** and the body reads hit-count 1. This is the strongest available argument for COV-05's
  "aggregate coverage is not a substitute", and it was measured here rather than assumed.

- **D-117-07 is narrowed: barrel-proxy ownership is ALREADY rejected today, mislabelled.** Research
  planted a barrel-proxy owner and the existing gate rejected it — as `wrong-import`, not as a proxy
  violation. So OWN-02's substance is enforced and what is missing is the NAME, not the detection.
  Measured further: zero of the 8 barrel-importing suites import a barrel that re-exports their own
  pair, so the strict rule is green on today's tree. **Path-level ambiguity is unreachable** under the
  current 1:1 mapping; record-level ambiguity (`Expected one LCOV record ... found 2`) IS reachable
  and already guarded but has **no negative control** — as does the `Incomplete direct coverage`
  verdict the entire D-116-01a pin regime rests on. Those two uncontrolled gates are the honest COV-04
  target, not an invented ambiguity check.

- **D-117-18 (NEW): there is no Node 24 on this machine.** Measured: `node --version` is **v26.7.0**
  and `/usr/bin/node` is **v22.22.2**; CI pins 24. Success criterion 3 names "the Node 24 all-pair
  result". Either a Node 24 is installed for the measurement, or the result is labelled with the
  runtime it actually ran on. **Do not report a v26 run as a Node 24 result.**

- **Blast radius corrected:** the helpers dissolution is **50 import lines across 35 files**, and
  `package.json` lines 82 and 91 are contended by three workstreams — the one hard file collision in
  the phase. Sequence around it.

### Operator decisions taken after research (2026-09-03)

- **D-117-19: label the runtime honestly.** No Node 24 exists on this machine. Measure the all-pair
  run on the runtime actually present, record that version **beside** the number, and state that
  success criterion 3's "Node 24" result is satisfied by CI, which pins 24. **Do not label a non-24
  run "the Node 24 all-pair result."** No local install. — **Reversibility:** reversible.

- **D-117-20: COV-05 reads as 197 records plus 7 named type-only rows.** The all-pair artifact
  carries a complete direct coverage record for each of the 197 emitting modules, and an explicit
  `type-only` verdict **by name** for the other seven — `edge/types.ts`, `orchestrators/types.ts`,
  `orchestrators/import/types.ts`, and `bridges/{agents,commands,mcp,skills}/types.ts`. All 204 rows
  are accounted for and none is silent. COV-05 is reported met in substance with the exception
  enumerated. **Not** resolved by a pragma, and **not** by weakening the other 197.

- **D-117-21: D-117-07 is narrowed to what can actually fire.** Research measured that a barrel-proxy
  owner is already rejected today (as `wrong-import`) and that path-level ambiguity is unreachable
  under the current 1:1 mapping. So:
  - **Add** a `proxy-owned` label to the existing barrel rejection, with a planting control, so
    OWN-02 is named rather than incidental.
  - **Add** planting controls for the two reachable-but-uncontrolled verdicts:
    `Expected one LCOV record ... found 2`, and `Incomplete direct coverage for ...` — the latter is
    the verdict the entire D-116-01a pin regime rests on and has no control at all today.
  - **Do not add** a path-level ambiguity check. A gate that cannot fire is the exact defect
    `import-x/no-cycle` shipped as in this repository, and adding one to satisfy a wording would
    repeat it.

### Inherited rules that still bind — do not relitigate

- **D-116-01a as amended (2026-09-02):** any pair that MEASURES an unreachable branch becomes a
  claimant and MUST pin the shortfall IDENTITY — an `Incomplete direct coverage for <source>:`
  verdict, denominator minus numerator exactly 1, the exact uncovered line set. Never pin an
  absolute branch pair; V8 emits a branch range only when its count diverges from its enclosing
  block, so strengthening a suite raises numerator and denominator together. **No coverage-exception
  pragma, ever.** File each in `.planning/WINDOWS.md`.
- **D-116-04:** plant every non-obvious proof, confirm RED, revert, and record what the plant
  **actually said** — never what the plan predicted it would say. A plant that stays GREEN is a
  finding: narrow or strengthen the claim.
- **D-116-05 = O3:** a module with a real seam or an injected port gets exact-argument mocks; a
  seamless one gets `createNotificationBoundary(1, 0)` + `verifyBoundary()` with the exact-argument
  gap recorded in `must_haves`.
- **A green test proves nothing until you make it fail.** 30 of 31 phase-116 plans carried a defect
  in their own plan, and 24 were proofs the plan specified that could not have failed. Read a plan's
  blocks against each other, not only against the module.

### Claude's Discretion

- The internal structure of `tests/index.test.ts` — case decomposition, fixture shape, and how the
  two folded suites' cases are merged or dropped as redundant.
- Whether the ambiguous and proxy-owned checks live in `check-corresponding-tests.mjs`,
  `test-coverage-direct.mjs`, or a third script, provided each lands where its requirement points
  (OWN-02 is a correspondence property; COV-02 is a focused-command property).
- Plan and task decomposition, wave ordering, and commit granularity, subject to DEL-01 (one concern
  per plan and per commit).
- The order in which the four workstreams run, except that the inventory sweep (D-117-12) is last,
  because it must record measured outcomes.

### Folded Todos

None folded. See Deferred Ideas.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase handoff — read first

- `.planning/phases/116-edge-surface/.continue-here.md` — STATE.md routes this forward as phase
  117's handoff. Its BLOCKING CONSTRAINTS, measured-findings table, tooling-defect list and commit
  recipe all still apply; only its per-plan wave list is spent. The findings table is the single
  most expensive thing to rediscover.
- `.planning/STATE.md` §"What Phase 117 inherits", §"Blockers/Concerns", §"Standing environment
  debts" — the environment debts are all still true.
- `.planning/WINDOWS.md` — **22 ledger entries, 17 open** (measured; the discuss-time figure of
  23/14 was wrong on both halves). Entries 15-19, 21 and 22 are the seven
  D-116-01a coverage shortfalls; entry 20 is the stale `register.ts` comments.

### Requirements and roadmap

- `.planning/REQUIREMENTS.md` — OWN-01..06, CASE-01..04, TEST-01..05, COV-01..05, DES-01..03,
  DEL-01..04, MOD-10, PRES-01..02, SUITE-01..06. Also the Brownfield Pair Inventory whose Status
  column D-117-12 sweeps.
- `.planning/ROADMAP.md` §"Phase 117: Extension Entry and Final Gate" — goal, the 36 requirement
  IDs, and the five success criteria.

### The gates themselves

- `scripts/check-corresponding-tests.mjs` — the correspondence gate. `nonCorrespondingRoots` is
  `{architecture, e2e, integration}`; `supplementalCompanions` is the existing **structural**
  exemption (it proves the imports rather than listing names) and is the precedent for any new
  structural rule.
- `scripts/check-corresponding-tests.negative.mjs` — its planting control.
- `scripts/test-coverage-direct.mjs` — `assertCompleteCoverage`, `pairForPath`, `runPair`, and the
  `isTypeOnlyModule` escape at the `"type-only"` return that makes a type-only module pass
  unconditionally.
- `scripts/test-coverage-direct.negative.mjs` — its planting control.
- `package.json` §scripts — `test`, `test:coverage:unit`, `test:corresponding`,
  `test:coverage:direct*`. The `helpers` entry in the two globs is what D-117-04 makes dead.

### The module under ownership

- `extensions/pi-claude-marketplace/index.ts` (161 lines) — the async factory. Registers
  `registerHooksBridge` (awaited, load-bearing), a `resources_discover` handler, a `session_start`
  handler, `registerClaudePluginCommand` and `registerClaudeMarketplaceTools`. Carries DISP-01,
  DISP-02, D-59-02, D-59-03, RECON-01..05, PENV-01, D-90-03, D-90-04, SENV-01..03, NFR-2, AUTH-01,
  IL-2, WR-02, Y7.
- `tests/edge/index-handler.test.ts`, `tests/shared/index-smoke.test.ts` — the two legacy proxies
  being folded.
- `extensions/pi-claude-marketplace/edge/register.ts` — the sibling `registerClaudePluginCommand` /
  `registerClaudeMarketplaceTools` surface, and the site of WINDOWS entry 20.

### House rules

- `CLAUDE.md` (project) — git, commit-message, pre-commit and versioning rules.
- `.claude/rules/typescript-comments.md` — comments cite decision and requirement IDs; no
  phase/plan/wave/milestone process references.
- `.claude/rules/typescript-unit-testing.md` — the guidelines the pair contract measures against.
- `.planning/codebase/CONVENTIONS.md` — dependency injection over test-only seams; the
  plant-the-violation rule for architectural gates.
- `.planning/codebase/ARCHITECTURE.md` — layer boundaries and the `index.ts` entry-point contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`tests/edge/register.test.ts` (from 116-28) is the nearest analog for the new owner.** A
  registration table is almost entirely **data** — command name, event names, description, both tool
  names are values no branch selects, so coverage cannot see a wrong wiring. 116-28's answer:
  hand-author each name as an EXACT argument in the expectation and capture only the callback beside
  it with `It.willCapture`. Measured failure modes there: a wrong command or event name fails at the
  call site with strong-mock's `Didn't expect ... to be called` across 10 of 11 rows; swapping the
  two tool registrations reddens exactly one row. `index.ts` registers the same kind of table.
- **`tests/helpers/notification-boundary.ts`** — `createNotificationBoundary(emissions, probes)` +
  `verifyBoundary()`. `toolProbes` is REQUIRED, no default. A count of `0` now states *no
  expectation at all* (fixed in `af7c501f`; strong-mock's `.times(0)` is inert and reports clean).
- **`tests/helpers/marketplace-seed.ts`**, **`tests/helpers/ipc-child.ts`**,
  **`tests/helpers/source-scan.ts`** (`assertNoForbiddenSurface`, `stripComments`) — all four move
  under D-117-04.
- **`116-08-SUMMARY.md`** is the normative Group-C reference: boundary sized at one emission and
  zero probes with `cwd` OMITTED, both scopes seeded, whole notification list compared,
  `verifyBoundary()` last, plus an on-disk negative.

### Established Patterns

- **`npm run check` never runs the tests.** The chain is
  `typecheck && lint && fallow && format:check && test && test:integration`, and `format:check`
  fails on the operator's pre-existing untracked files (`.mcp.json`, seven
  `.planning/research/.cache/*.json`), short-circuiting before `test`. Run `npm run typecheck`,
  `npm run lint`, `npm run fallow`, `npm test` and `npm run test:integration` **separately** and
  check each exit code. Do not touch those files. SUITE-05 names `npm run check` — report it as the
  five separate gates plus the reason the aggregate cannot speak.
- **Git hooks are not installed in this checkout.** A successful commit is not evidence hooks
  passed. Use the operator-approved recipe: filesystem trufflehog with explicit literal paths, then
  per-file `prettier --check`, then `SKIP=trufflehog,npm-format-check pre-commit run --files <paths>`.
- **This shell does not word-split** and backticks inside `git commit -m` execute. Pass literal
  paths; use `git commit -F`.
- **Stage explicit literal paths only** — the operator edits unrelated files in this checkout
  concurrently. Never `git add -A`. Confirm with `git status --short` and `git log -1 --stat`.
- **`workflow.use_worktrees=false`** — executors run sequentially on the shared tree, one at a time.
- **Read the runner's `ℹ tests` line for any suite total.** Baseline at phase 116 close:
  `npm test` 5141/5141 across 295 suites, `test:integration` 31/31. A count derived by arithmetic is
  a guess, and this milestone already propagated one wrong total through four dispatches.
- **`createNotificationBoundary` returns `mock<ExtensionAPI>`, and reading a generic method off it
  as a VALUE is an `unbound-method` lint error** (116-27). `index.ts` does exactly that —
  `pi.on.bind(pi)` at line 29 reads `pi.on` as a value. Whether that helper can own this module at
  all is an open research question, not an assumption to carry.
- **Never name a non-plan artifact `*-SUMMARY.md`** — that glob is counted as a plan summary by
  `find-phase`, `phase-plan-index` and `progress.bar`, and silently inflates the phase count.

### Integration Points

- `checkCorrespondingTests()` is exported and already unit-testable against a `--root`; new checks
  should preserve that seam so their negative controls can drive a planted fixture tree.
- `assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot)` is likewise exported with an
  injectable root — the COV-02 ambiguous/unmapped failures belong at `pairForPath`/`toProjectPath`,
  which already throw for a path outside the project and for a missing pair member.
- Deleting `tests/helpers/` leaves the `helpers` token in the `test` and `test:coverage:unit` globs
  matching nothing; harmless (measured), but remove it.

### Tooling defects — expect these, repair by hand

- `roadmap.update-plan-progress` mangles ROADMAP.md **every time** (31 for 31 in phase 116). Hand-edit.
- `state.record-metric` double-increments `completed_plans`; `state.update-progress` writes nothing;
  `state.advance-plan` increments without appending the plan id.
- `phase.complete` cannot write the root planning files while workstream mode is active and neither
  workstream holds v1.19. Every phase transition since 114 was hand-applied; this one will be too.
- `state.add-decision` rejects `--summary-file` paths outside the repo root and has double-prefixed
  phase tags on entries.

</code_context>

<specifics>
## Specific Ideas

- The 8 correspondence-gate violations are a **measurement taken in this tree on 2026-09-03**, not
  an inherited claim. Re-run `npm run test:corresponding` before planning against them; the operator
  edits this checkout concurrently.
- The two clean helper moves are worth taking first: `source-scan.ts` → `tests/architecture/` also
  resolves one of the seven orphans in the same move, and `ipc-child.ts` → `tests/integration/` has
  two consumers.
- `tests/index.test.ts` sits at the `tests/` root — the first and only owner test there. Confirm the
  gate's `expectedTestPath`/`expectedSourcePath` round-trip handles the zero-directory case before
  writing the suite; `sourcePath.slice(prefix.length, -3)` yields the bare `index`, which should map
  to `tests/index.test.ts`, and the gate already reports exactly that as the missing mirror.

</specifics>

<deferred>
## Deferred Ideas

- **A gate for unused type members.** Reviewed and deliberately not folded. Measured on 2026-09-02
  by planting `readonly neverReadAnywhere?: string` on `EdgeDeps`: `npm run typecheck` exit 0,
  `npm run lint` exit 0, `npm run fallow` exit 0 with the member unmentioned. Coverage is
  structurally blind — an unused member has no read site, so there is no line. Building it means new
  compiler-API tooling plus its own planting control, which is a phase's worth of work rather than a
  check to bolt on. Stays in `.planning/STATE.md` §Deferred Items for v1.19 milestone triage.
- **`BOOLEAN_FLAGS` re-exported from `edge/handlers/plugin/list.ts`** solely for
  `tests/architecture/flag-catalog-drift.test.ts`. Blocked by D-117-13 (no production licence);
  recorded, not fixed.
- **The tool `available` / `unavailable` parameter descriptions** — open operator decision, carried
  by D-117-14 rather than resolved here.
- **A repo-wide audit of every structural gate's negative control** (COV-04 read at its widest).
  Out of scope per D-117-09; the new checks carry theirs.

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — matched at score 0.6 and its own frontmatter
  reads `resolves_phase: 117`. Reviewed and deferred: it is new tooling with its own negative
  control, and this phase's licence is the entry pair and the gates it already owns. An unused
  optional member is dead weight, not a correctness defect, so it blocks nothing.

</deferred>

---

*Phase: 117-Extension Entry and Final Gate*
*Context gathered: 2026-09-03*
