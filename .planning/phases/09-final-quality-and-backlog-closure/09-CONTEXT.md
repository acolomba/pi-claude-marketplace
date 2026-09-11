# Phase 9: Final Quality and Backlog Closure - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the milestone's confirmed work as a whole and close the bundled backlog with an
audit trail.

Three deliverables:

1. The complete project quality suite measured green on the final tree, after every
   terminal work item is complete (`CLOSE-01`).
2. The eight requirement IDs that `SEALED_REQUIREMENT_ROUTES` still pins at `Pending`
   flipped to `Complete` through changes that keep the four seal carriers in agreement.
3. Backlog items and window-ledger entries recorded with their terminal dispositions,
   in one vocabulary, distinguishing implemented fixes from stale, unsupported, and
   evidence-only records (`CLOSE-02`).

**Not in this phase:** new defect work. `D-22` bars a backlog item without terminal
evidence inside the unit-test-quality boundary from creating milestone work. Closure
records what happened; it does not reopen scope.

</domain>

<decisions>
## Implementation Decisions

The operator's standing instruction for this phase: *prefer complete solutions that are
consistent and uniform all across, even if they require more effort; the end result of
going from A to B should be the same as if we had done the right thing and done B to
begin with.* Every decision below applies that rule, and it is the tie-breaker for any
choice planning meets that this file does not name.

### The requirement seal

- **D-09-01:** Eight IDs are `Pending`, not three. `STATE.md`'s handoff named only
  `RCOV-01`, `RCOV-02`, and `RCOV-03`. The sealed table at `scripts/revalidation.mjs:93`
  also pins `GGAT-01`, `GGAT-03`, and `GGAT-04` at `Phase 7 / Pending`, plus `CLOSE-01`
  and `CLOSE-02` at `Phase 9 / Pending`. All eight end this phase at `Complete`.
  `GGAT-01/03/04` are pinned, not unfinished: `07-VERIFICATION.md` reads
  `status: passed`, 7/7, with all three rows `SATISFIED`. `08-VERIFICATION.md` reads
  `passed`, 8/8.

- **D-09-02:** The flip lands in **two** atomic changes, not one.
  - Change A: `GGAT-01`, `GGAT-03`, `GGAT-04`, `RCOV-01`, `RCOV-02`, `RCOV-03`.
  - Change B: `CLOSE-01`, `CLOSE-02`, landing only after the full suite has been
    measured green on a tree that already carries change A.

  Reason: `CLOSE-01` asserts the suite passes *after* all terminal work is complete.
  Flipping it in the same commit as the work it describes writes a claim that has not
  been measured yet — the exact defect class this milestone exists to retire. The two
  ID sets are disjoint, so each change is internally consistent on its own and
  `scope-impact --check` exits 0 after each. The end state is identical to a single
  flip; only the unmeasured intermediate claim is avoided.
  — **Reversibility:** costly — undoing a flip means recomputing the clause signature
  in all three carriers again, the operation 08-08 showed fails closed if any pair
  disagrees.

- **D-09-03:** Each ID's flip touches **four** carriers in the same commit, because the
  checker compares all of them and fails on any pair disagreeing:
  1. the `- [ ]` → `- [x]` checkbox in `.planning/REQUIREMENTS.md`,
  2. that ID's row in the `## Traceability` table (`Pending` → `Complete`),
  3. its entry in `SEALED_REQUIREMENT_ROUTES` in `scripts/revalidation.mjs`,
  4. any disturbed clause signature in
     `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`.

  Proved by planting in 08-09: flipping `RCOV-03` alone made
  `node scripts/revalidation.mjs scope-impact --check` exit 1 with
  `requirement-route-contract: RCOV-03: traceability route/status differs from sealed
  requirement contract`. Signature recomputation follows 08-08's method — reproduce the
  current sealed values with the production normalizer's exact steps *before* any edit,
  so a normalization mistake shows up as a mismatch on known-good input rather than as
  a sealed wrong answer.

- **D-09-04:** The gate for every seal change is
  `node scripts/revalidation.mjs scope-impact --check` exiting 0. Baseline on entry to
  this phase, measured 2026-09-11: `Scope impact valid: 40 records.`

### WR-04 — the event-router staleness case

- **D-09-05:** Complete the port. `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
  ends this phase with **zero** static `readFile` usage — the `node:fs/promises` import
  at line 40 loses `readFile`. Both call sites go through one injected read port:
  - site A, `readAndCachePluginHooksWith` (~line 136), reached from
    `createHooksRouting`;
  - site B, the hydrate helper (~line 606), reached from `createHooksHydration`.

  Both public factories receive the port; `extensions/pi-claude-marketplace/index.ts:40`
  supplies the real implementation, as it already does for `loadState`.
  — **Reversibility:** costly — `createHooksRouting` and `createHooksHydration` are
  exported through `bridges/hooks/index.ts`, so the signature change reaches every
  caller and the published bridge surface.

- **D-09-06:** **Rejected:** adding `readHooksJson` to `HooksHydrationReader` and
  porting only the hydrate site. 08-03 measured that route and it is a seam shaped by
  one test's reach — the same asymmetric shape `D-08-13` refused for the removal port
  and `D-08-A14` records 08-07 declining for `install-outcome.ts`. A port that leaves a
  sibling call site on the static import is not what this module would look like if it
  had been designed correctly, so it fails the operator's A-to-B rule.

- **D-09-07:** Consequence for the test. With both sites injected, the staleness case in
  `tests/bridges/hooks/event-router.test.ts` no longer needs a counted
  `currentGeneration()` consultation, so `D-08-A04` is satisfied by design rather than
  by exception. Keep the sibling control 08-03 added — it is what makes the empty
  assertion mean "a hydration that was stopped" rather than "a fixture that never
  hydrates" — and keep both cases' record that `getRoutingBucket("PreToolUse")` is
  vacuous for this entrypoint.

- **D-09-08:** Planning owns the exact interface shape. `HooksHydrationReader` currently
  documents itself as "Required persisted-state operation for hooks hydration" and
  carries only `loadState`; routing has no reader at all. Whether the read port joins
  that interface, becomes a second interface both factories take, or the two merge into
  one `HooksReader` is a planning decision. The locked invariant is D-09-05: no static
  `readFile` left in the module, both sites on one injected port, both factories
  receiving it. Whatever shape is chosen must read as deliberate design, not as an
  interface widened to fit a test.

### Ordering, because production changes invalidate measurements

- **D-09-09:** D-09-05 edits production code, and `RCOV-02` names
  `bridges/hooks/event-router.ts` at `branches 107/111, lines 959/967` as a module
  closed by real owner tests. Any production change therefore obligates a full
  re-measurement before the seal flips. Phase order is fixed:

  1. production changes (D-09-05) land and their owner tests pass;
  2. `npm run test:coverage:direct:all` re-runs over all 230 pairs, and the committed
     pin `scripts/test-coverage-direct.pin.json` is regenerated and compared, exactly as
     08-08 did — an artifact that comes back byte-identical is a result, not a no-op;
  3. change A (D-09-02) lands;
  4. the full suite is measured green;
  5. change B lands.

  A flip that precedes its own measurement is the failure this ordering exists to
  prevent.

- **D-09-10:** "The complete project quality suite" means `npm run check` — typecheck,
  lint, fallow, format:check, `test:corresponding`, `test:corresponding:negative`,
  `test:coverage:direct:negative`, `test`, `test:integration` — plus
  `npm run test:coverage:direct:all` at exit 0 over 230 pairs. Both are measured on the
  final tree and their real output recorded. Neither is reported from an earlier run.

### The window ledger

- **D-09-11:** Repair the rows 9/30 desync losslessly, then use the verbs. The fenced
  JSON is the sole source of truth and regenerating the table overwrites the prose side,
  so the repair is to write the rendered table's authoritative text **into** the JSON
  first, then let the verb regenerate. Two specific edits:
  - row 9: the table carries a `DECIDED 2026-09-02` resolution paragraph
    (operator accepted the recorded exposure; resolution recorded in
    `115-VERIFICATION.md` human_verification item 2) where the JSON still reads
    `This needs an operator decision.`;
  - row 30: the table carries a `RESOLVED 2026-09-04` paragraph **and** status `fixed`,
    while the JSON reads `open`. 08-02's note that "both rows read `open` in the JSON,
    so the disagreement is in the rendered description text, not in status" is correct
    about the JSON and wrong about the table — row 30 is a status disagreement too.

  This is mechanical and recoverable, not an operator-only judgement call. The prose
  that regeneration would destroy is exactly the text copied into the JSON beforehand.

- **D-09-12:** With the verbs unblocked, close entries 19, 21, and 22 — the three
  unreachable arms 08-02 deleted. Each currently reads `open` while saying "closes only
  by a production rewrite" that has already landed, so each is false.

- **D-09-13:** Do **not** mass-close the remaining open entries. 23 read open, from
  phases 86, 88, 115, and 117 — most predate this milestone. Closing them on narrative
  rather than terminal evidence is the defect class this milestone exists to retire, and
  `D-22` bars it. Whether open windows should block `/gsd-ship` is the operator's call at
  ship time, not something this phase forces by emptying the ledger.

### The closure audit trail

- **D-09-14:** One artifact, one vocabulary. `09-CLOSURE-LEDGER.md` carries a row per
  closed item drawn from a single closed disposition set —
  `implemented` | `evidence-only` | `superseded` | `deferred` | `unresolved` — covering:
  - the eight requirement IDs;
  - the `CLOSE-02` backlog items;
  - the window entries this phase touched;
  - the two caveats in D-09-16 and D-09-17.

  A second vocabulary anywhere is what lets a record drift from what happened.

- **D-09-15:** `.planning/BACKLOG.md` gets each item's terminal disposition written in
  place, in the same vocabulary, so the ledger and the backlog cannot disagree. Per
  `CLOSE-02`: `TESTQ-01` (line 2380), `FLOW-09` (537), `REASON-01` (25), and `FLOW-07`
  (420) record their shipped terminal routes; `COV-01` (49), `AGCOL-01` (1783), the
  unused-type-member todo, and the named `GAUTH-01` (1647) prescription retain explicit
  evidence-only or deferred histories and are never described as implemented.

- **D-09-16:** Verify the two human-checkable pin claims rather than recording them as
  unverifiable. The pin's `reasons` are claims about why an arm cannot be reached, and no
  gate in this repository can check one — if a reason is wrong, the pin is an allow-list
  with good manners. 08-04 recorded this as deliverable D5, and two claims were named as
  human-checkable: the `CommandNameError` narrowing arm in
  `extensions/pi-claude-marketplace/bridges/commands/discover.ts`, and the two
  defense-in-depth re-checks in
  `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`
  (`D-08-A14`, operator decision 2026-09-11). This phase reads both and states why no
  input reaches the arm, recording the argument in the ledger. Accepting a caveat is the
  right answer only where the claim is genuinely uncheckable; these two are checkable.

- **D-09-17:** The `direct-coverage` CI job is genuinely unprovable here and gets one
  explicit `unresolved` row. Its first real run is on the PR. The local proxy proves
  everything except the GitHub-side ref creation the in-job base assertions exist to
  catch, and whether it is a REQUIRED status check is a protected-branch setting outside
  any tracked file. The row names what is unproven and what would close it. It is not
  folded into a passing claim.

- **D-09-18:** Coverage stays reachability evidence, never assertion strength — the
  `RCOV-03` boundary, already stated in `CONTRIBUTING.md`. No ledger row may describe a
  coverage reading as proof that an assertion is strong.

### Claude's Discretion

The operator delegated every choice in this phase with the standing rule quoted at the
top of this section. Planning decides: the exact interface shape in D-09-08; plan
decomposition and count; the `09-CLOSURE-LEDGER.md` column layout; and the wording of
each backlog disposition. Where a choice is close, take the one that leaves the tree
looking as though it had always been that way.

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — matched phase 9 at score 0.6
  (`keywords: phase, audit, milestone, unused, type`). **Not folded.** `CLOSE-02` names
  this todo explicitly as one that retains a deferred history without being described as
  implemented. It gets a `deferred` ledger row and creates no implementation work. Its
  substance — no gate reports a type member nothing reads, measured with typecheck,
  lint, and fallow all passing on a planted one — stays a `v1.19` deferred item.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement seal — all four carriers

- `.planning/REQUIREMENTS.md` — the eight `Pending` checkboxes (lines 81-119) and the
  `## Traceability` table (lines 161-194). Also the `## Evidence and History` section
  (lines 121-139), which is the existing precedent for evidence-only wording.
- `scripts/revalidation.mjs` §`SEALED_REQUIREMENT_ROUTES` (line 93) — the sealed
  route/status table. §`validateRequirementClause` (line 2300) and the route contract
  check (line 2283) are the code that fails closed.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — the scope
  change ledger holding clause signatures; the third carrier that must agree.
- `.planning/phases/08-direct-coverage/08-08-SUMMARY.md` — the worked example of a
  three-carrier clause re-seal, including the normalizer-reproduction method and why
  neither `RCOV-01` nor `RCOV-02` could be flipped inside Phase 8.
- `.planning/phases/08-direct-coverage/08-09-SUMMARY.md` — the planting proof that a
  single-ID flip exits 1.

### Verification evidence for the pinned upstream IDs

- `.planning/phases/07-gate-integrity/07-VERIFICATION.md` — `passed` 7/7; `GGAT-01`,
  `GGAT-03`, `GGAT-04` all `SATISFIED` with live test runs (lines 60-63, 142-146).
- `.planning/phases/08-direct-coverage/08-VERIFICATION.md` — `passed` 8/8.

### The event-router port (D-09-05)

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` — line 40 import;
  site A at ~136 inside `readAndCachePluginHooksWith`; site B at ~606 inside the hydrate
  helper; `HooksHydrationReader` at 422; `HooksRouting`/`createHooksRouting` at 274-294;
  `createHooksHydration` at 946.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` — exports both factories and
  both interfaces; the published surface the signature change touches.
- `extensions/pi-claude-marketplace/index.ts` line 40 — `createHooksHydration(hooksRuntime, { loadState })`,
  where the real implementation is supplied today.
- `tests/bridges/hooks/event-router.test.ts` — the staleness case and 08-03's sibling
  control.
- `.planning/phases/08-direct-coverage/08-03-SUMMARY.md` — the measurement of every
  alternative route, and why nothing injected runs between the containment check and the
  `readFile`.
- `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` — the leaf module
  that exists to keep the three-way cycle from reforming; its import invariant
  constrains where a new port may live.

### Coverage, the pin, and its caveat

- `CONTRIBUTING.md` — the pinned set, how the pin fails in three directions, both gate
  scopes with measured costs, and the reachability boundary. 08-08 wrote it saying the
  hook and CI job are not wired yet; that tense is now stale and this phase owns it.
- `scripts/test-coverage-direct.pin.json` — the committed pin; one reason per uncovered
  site, not an allow-list.
- `scripts/test-coverage-direct.mjs` — `selectBase()` and the changed-pair gate.
- `.planning/phases/08-direct-coverage/08-04-SUMMARY.md` — deliverable D5, the standing
  caveat, and `loadCoveragePin`/`assertPinnedReadings`.
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` — the
  `CommandNameError` narrowing arm named in D-09-16.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` — the two
  defense-in-depth re-checks named in D-09-16.
- `.github/workflows/ci.yml` — the `direct-coverage` job that has never executed.

### Backlog and ledger

- `.planning/BACKLOG.md` — `REASON-01` (25), `COV-01` (49), `FLOW-09` (537/540),
  `FLOW-07` (420), `GAUTH-01` (1647), `AGCOL-01` (1783), `TESTQ-01` (2380).
- `.planning/WINDOWS.md` — the ledger; fenced JSON is the sole source of truth. Rows 9
  (line 26 table / 149 JSON) and 30 (line 47 table / 401 JSON) are the desync; entries
  19, 21, 22 are the false-open rows.
- `.planning/phases/08-direct-coverage/deferred-items.md` — the desync's discovery
  record and why 08-08 re-routed it.
- `.planning/STATE.md` §"Autonomous Run Parameters" (line 1073) — the handoff, the three
  inherited open decisions, and the environment debts.

### Project rules

- `CLAUDE.md` — commit conventions, `pre-commit` before `git commit`, never `--no-verify`.
- `.planning/codebase/CONVENTIONS.md` — dependency injection over test-only seams; the
  two independent complexity gates; comments cite durable spec IDs, never GSD process
  artifacts.
- `.planning/codebase/ARCHITECTURE.md` — layer boundaries and the hooks bridge's place
  in them.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **08-08's three-carrier re-seal procedure.** A clause sealed by hash is rewritten in
  three places in one change — the prose, the script's sealed table, and the ledger's
  scope change — and the current sealed values are reproduced with the production
  normalizer before any edit. This phase repeats it for eight IDs instead of three
  clauses; do not invent a second method.
- **`loadCoveragePin` / `assertPinnedReadings`** (08-04) and the all-pair arm that
  compares the regenerated pin to the committed one. The regeneration-and-compare step
  in D-09-09 is an existing, exercised path.
- **`{ loadState }` at `index.ts:40`.** The injection shape D-09-05 extends already
  exists in this exact module pair; the read port follows the established convention
  rather than introducing one.
- **`.planning/REQUIREMENTS.md` §"Evidence and History"** already carries `GGAT-02` and
  `RCOV-04` in the exact register `CLOSE-02` wants for the evidence-only backlog items.
  Match it.

### Established Patterns

- **The seal fails closed on any pair disagreeing**, so partial edits are not a smaller
  version of the change — they are a red gate. Plan each ID's four carriers as one unit
  of work.
- **Dependency injection over test-only seams** (`CONVENTIONS.md`). A dependency that is
  hard to test wants to be an explicit collaborator, not a module-global hole. D-09-05 is
  this rule applied, which is why the complete port is the conventional answer and the
  partial one is the exception.
- **Two independent complexity gates.** ESLint `sonarjs/cognitive-complexity: 15` and
  fallow `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60` disagree on scores.
  Threading a port through `event-router.ts` must satisfy both; a green ESLint run is not
  evidence fallow will pass.
- **Comments cite durable spec IDs, never phase or plan numbers.** New code and ledger
  prose carry `D-09-NN`, `RCOV-NN`, `NFR-N` style anchors only.

### Integration Points

- `createHooksRouting` and `createHooksHydration` are both exported from
  `bridges/hooks/index.ts`; D-09-05 changes at least one signature, so `index.ts:40` and
  every test constructing either factory are touched.
- `routing-state.ts` exists specifically to break a three-way cycle among
  `event-router.ts`, `dispatch.ts`, and `async-rewake/registry.ts`. A new port module, if
  planning creates one, must not reform that cycle — `fallow dead-code` gates it
  whole-repo.
- The seal spans `.planning/`, `scripts/`, and a phase-01 JSON ledger simultaneously.
  `pre-commit run --files <changed files>` must pass before each seal commit, and a
  failed hook means the commit did not happen.

</code_context>

<specifics>
## Specific Ideas

The operator's rule, stated once and applying to every unnamed choice in this phase:

> apply your best judgement. prefer complete solutions that are consistent and uniform
> all across even if they require more effort. the end result of going from A to B should
> be the same as if we'd done the right thing and done B to begin with.

Read as guidance for downstream agents, not as an instruction from a later source: where
two routes both close a requirement, take the one that leaves the tree indistinguishable
from one that never had the defect. That is why D-09-05 ports both call sites rather than
the one a test can reach, why D-09-11 repairs the window ledger rather than re-routing it
to the operator, why D-09-14 uses one disposition vocabulary, and why D-09-16 checks the
pin claims instead of recording them as unverifiable.

Its limit is `D-22`, and D-09-13 is where the two meet: uniformity applies to how this
milestone's own work is recorded, not as a licence to close 23 windows from four earlier
milestones on narrative.

</specifics>

<deferred>
## Deferred Ideas

- **Repairing the remaining open window entries from phases 86, 88, 115, and 117.**
  Out of bounds under `D-22` — closing them needs terminal evidence, which this milestone
  did not gather for them. See D-09-13.
- **Whether open windows should block `/gsd-ship`.** An operator policy question about
  the ship gate, not a Phase 9 deliverable.
- **Detecting unused code and unused type members** — the reviewed-not-folded todo. Stays
  a `v1.19` deferred item; see the Reviewed Todos subsection above.
- **Proving the `direct-coverage` CI job end to end.** Cannot be done before a PR exists.
  Recorded as the one `unresolved` row (D-09-17), to be settled when the PR runs.
- **The four deferred-verification phases (01, 03, 04, 05).** `STATE.md` records them as
  skipped-on-re-entry because their `covered_files` include planning documents every
  later phase rewrites, so re-verification re-stales them and never converges. Settling
  them belongs to the milestone audit, not to this phase.

</deferred>

---

*Phase: 9-Final Quality and Backlog Closure*
*Context gathered: 2026-09-11*
