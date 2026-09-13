# Phase 9: Final Quality and Backlog Closure - Research

**Researched:** 2026-09-11
**Domain:** Fail-closed planning-contract seals, dependency-injection port design in the hooks
bridge, direct-coverage re-measurement, and closure-record bookkeeping
**Confidence:** HIGH — every mechanical claim below was reproduced in this session against this
tree, most of them by planting a violation and watching the gate fire.

## Summary

This phase has no unknowns worth researching in the ordinary sense; it has **mechanics that fail
closed**, and the value of research here is establishing exactly which carriers move together and
which gates fire when they do not. Three findings change the plan's shape.

First, **the requirement seal has fewer carriers than D-09-03 states, and one carrier the CONTEXT
does not name.** Measured by planting: the clause signature in `01-REVALIDATION.json` is *not*
disturbed by a status flip (the normalizer's capture group starts after `**ID**:`, so the checkbox
character is outside it), and the `- [ ]` → `- [x]` checkbox is *not read at all* by
`scope-impact --check`. Only two carriers must move in lockstep — the `## Traceability` row and
`SEALED_REQUIREMENT_ROUTES`. But flipping them breaks **two live cases in
`tests/architecture/revalidation.test.ts`**, which reads the real `.planning/REQUIREMENTS.md` into
its fixture and plants against literal text that the flip invalidates. One breaks on change A, one
on change B. Neither is mentioned anywhere in the CONTEXT or in 08-08/08-09.

Second, **the event-router port's blast radius is concentrated, not diffuse — but it lands on a
source-text gate.** `createHooksRouting(` appears 139 times across 29 test files and
`createHooksHydration(` 32 times across 10; `extensions/` has exactly one call site for each. A
required second parameter on `createHooksRouting` is a 140-site edit. Worse,
`tests/index.test.ts` asserts the **exact source text** of both constructions in `index.ts`
(`createHooksRouting(hooksRuntime)` and `createHooksHydration(hooksRuntime, { loadState })`), so
the production wiring change breaks that gate too. Complexity is not the binding constraint —
measured ESLint cognitive scores on the touched functions are 2–10 against a ceiling of 15.

Third, **the window-ledger repair needs a fourth edit the CONTEXT does not name, and the whole
procedure was proven end to end in a scratch copy.** Beyond entry 9's description, entry 30's
description, and entry 30's status, the frontmatter `open_count`/`fixed_count` must be updated by
hand — `parseLedger` refuses a ledger whose frontmatter counts disagree with its entries, which is
a *second* fail-closed check behind the table-drift guard. With all four edits applied,
`windows fixed 19 / 21 / 22` all exit 0 and the regenerated table matches the JSON exactly.

**Primary recommendation:** decompose so that each fail-closed unit is one commit — (1) the
event-router port plus every call site plus `tests/index.test.ts`, (2) coverage re-measurement,
(3) change A plus its one broken test case, (4) suite measurement, (5) change B plus its one
broken test case, (6) the window ledger, (7) backlog + ledger. Never split a seal change or the
window-ledger repair across commits; each is red at every intermediate state.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Requirement seal flip | Planning documents (`.planning/`) | Gate script (`scripts/revalidation.mjs`) | The contract is data in two files the checker compares; no runtime tier is involved |
| Seal enforcement | Gate script | Unit test (`tests/architecture/revalidation.test.ts`) | `scope-impact --check` is the gate; the test is the gate's own control and reads the live tree |
| Hooks `readFile` port | Bridge (`bridges/hooks/`) | Entry (`extensions/pi-claude-marketplace/index.ts`) | The bridge owns the read; the factory supplies the real implementation, exactly as it does for `loadState` |
| Coverage measurement | Build script (`scripts/test-coverage-direct.mjs`) | CI job + pre-commit hook | The gate implementation is one script serving three scopes through an explicit base |
| Window ledger | Planning documents | `gsd-tools` verb | Fenced JSON is the source of truth; the verb regenerates prose and frontmatter from it |
| Closure record | Planning documents | — | Pure bookkeeping; no code tier |

## Project Constraints (from CLAUDE.md)

These are directives, not suggestions. Each was confirmed against the tree this session.

- **Never commit to `main`.** Current branch is `features/refine-unit-tests`. `.git` is a **file**
  (`gitdir: /home/acolomba/pi-claude-marketplace/.git/worktrees/…`) — this is a linked worktree.
  `[VERIFIED: test -f .git → true, contents read this session]`
- **`trufflehog` cannot run here.** It reads `<root>/.git/index`, which does not exist when `.git`
  is a file. Every `pre-commit` invocation must be `SKIP=trufflehog pre-commit run --files <files>`.
  `[VERIFIED: STATE.md "What the 08-01 sweep measured"; .git confirmed to be a file]`
- **Run `pre-commit` BEFORE `git commit`, never `--no-verify`, never `git commit --amend` to
  recover.** A failed hook means the commit did not happen.
- **Never rebase, never rewrite history.** Update branches by merging.
- **Conventional Commits**, title 5–72 chars, body lines ≤ 80 chars, no GSD milestone/phase
  mentions in commit messages or PR titles.
- **Read before editing; trace callers before modifying a function.**
- **`npm run check` must stay green** (NFR-6).
- **All user-visible output through `ctx.ui.notify`** (IL-2) — not touched by this phase.
- **Comments cite durable spec IDs** (`D-09-NN`, `RCOV-NN`, `NFR-N`), never phase/plan/wave
  numbers. `[CITED: .planning/codebase/CONVENTIONS.md]`
- **Dependency injection over test-only seams** — a hard-to-test dependency wants to be an explicit
  collaborator. `[CITED: .planning/codebase/CONVENTIONS.md "Function Design"]`

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The operator's standing instruction for this phase: *prefer complete solutions that are
consistent and uniform all across, even if they require more effort; the end result of
going from A to B should be the same as if we had done the right thing and done B to
begin with.* Every decision below applies that rule, and it is the tie-breaker for any
choice planning meets that this file does not name.

#### The requirement seal

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

#### WR-04 — the event-router staleness case

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

#### Ordering, because production changes invalidate measurements

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

#### The window ledger

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

#### The closure audit trail

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLOSE-01 | The complete project quality suite passes after all terminal work, selected controls, focused owner tests, and independent assertion-strength requirements are complete. | §1 (seal mechanics, measured), §3 (coverage commands and costs), §7 (`npm run check` sub-command costs, measured green on this tree at 246s total) |
| CLOSE-02 | `TESTQ-01`, `FLOW-09`, `REASON-01`, and `FLOW-07` record their shipped terminal routes; `COV-01`, `AGCOL-01`, the unused-type-member todo, and the named `GAUTH-01` prescription retain explicit evidence-only or deferred histories without being described as implemented. | §5 (per-item terminal disposition with evidence, and the existing house format for a closed entry) |
</phase_requirements>

---

## §1 — The requirement seal: measured mechanics

### 1.1 Baseline, confirmed

```
$ node scripts/revalidation.mjs scope-impact --check
Scope impact valid: 40 records.        # exit 0, 0.18s
```

`[VERIFIED: run this session, 2026-09-11]`

### 1.2 What the checker actually reads — from source

`scripts/revalidation.mjs` is 2660 lines. The relevant code:

| What | Where | Behavior |
|------|-------|----------|
| `SEALED_REQUIREMENT_SIGNATURES` | line 58 | 30 `sha256:<hex>` clause hashes, one per ID |
| `SEALED_REQUIREMENT_ROUTES` | line 93 | `{ route, status }` per ID; the 8 `Pending` entries live here |
| `normalizeRequirementClause` | line 2129 | `clause.replace(/\n {2}/g, " ").replace(/\s+/g, " ").trim()` |
| `signRequirementClause` | line 2135 | `` `sha256:${createHash("sha256").update(normalized).digest("hex")}` `` |
| definition capture pattern | line 2148 | `` /^- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:[ \t]*([^\n]*(?:\n {2}[^\n]*)*)/gm `` |
| `parseRequirementDispositions` | line 2098 | `` /^\|[ \t]+([A-Z]+-\d+)[ \t]+\|[ \t]+([^|]+)[ \t]+\|[ \t]+([^|]+)[ \t]+\|$/gm `` |
| route contract check | line 2283–2298 | compares the traceability `{route,status}` against `SEALED_REQUIREMENT_ROUTES` |
| `validateRequirementClause` | line 2300 | compares the ledger's `requirementSignature` to the sealed hash AND `signRequirementClause(clause)` to the sealed hash |
| record-count check | line 2586 | `ledger.scopeChanges.length !== 40 \|\| rows.size !== 40` |

`[VERIFIED: scripts/revalidation.mjs, read this session]`

**The checkbox character is inside the capture-gating class, outside the captured clause.** The
pattern is `- \[[ x]\] \*\*ID\*\*:` — the class `[ x]` accepts both states, and capture group 2
begins after the colon. **A checkbox flip cannot change the signature.** Same for
`parseRequirementLocations` (line 2072), which uses `- \[[ x]\] \*\*(ID)\*\*:` only as a location
marker.

### 1.3 Answers to the CONTEXT's four questions — each established by planting

Every experiment ran in an isolated scratch root (`revalidation.mjs` supports `--root`), then the
two decisive ones were repeated on the real tree and reverted.

| # | Plant | Result |
|---|-------|--------|
| 1 | `RCOV-01` checkbox only (`- [ ]` → `- [x]`) | **exit 0**, `Scope impact valid: 40 records.` — the checkbox is inert to this gate |
| 2 | `RCOV-01` traceability row only (`Pending` → `Complete`) | **exit 1**, `requirement-route-contract: RCOV-01: traceability route/status differs from sealed requirement contract` |
| 3 | `RCOV-01` `SEALED_REQUIREMENT_ROUTES` only (`Pending` → `Complete`) | **exit 1**, identical message |
| 4 | Change A's six IDs, all three surfaces, **no signature edit** | **exit 0**, `Scope impact valid: 40 records.` |
| 5 | All eight IDs, all three surfaces, **no signature edit** | **exit 0**, `Scope impact valid: 40 records.` |
| 6 | `RCOV-03` clause **text** edited, signature untouched | **exit 1**, `requirement-clause: RCOV-03: requirement clause differs from scope signature` |

`[VERIFIED: all six planted and run this session]`

**Answers:**

- **What is the clause signature and how is it computed?** SHA-256 over the clause text captured
  after `**ID**:`, with `\n  ` (newline + exactly two spaces, the file's continuation indent)
  collapsed to a single space, all remaining whitespace runs collapsed to one space, and the
  result trimmed. Produced by `normalizeRequirementClause` + `signRequirementClause`.

  **Exact reproduction command** — reproduces all 30 sealed values byte for byte:

  ```bash
  node --input-type=module -e '
  import { createHash } from "node:crypto";
  import { readFileSync } from "node:fs";
  const md = readFileSync(".planning/REQUIREMENTS.md", "utf8");
  const norm = (c) => c.replace(/\n {2}/g, " ").replace(/\s+/g, " ").trim();
  const sign = (c) => `sha256:${createHash("sha256").update(c).digest("hex")}`;
  const pat = /^- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:[ \t]*([^\n]*(?:\n {2}[^\n]*)*)/gm;
  for (const m of md.matchAll(pat)) console.log(m[1], sign(norm(m[2])));
  '
  ```

  `[VERIFIED: run this session — all 30 outputs match SEALED_REQUIREMENT_SIGNATURES exactly]`

  For an **evidence-only** ID (`GGAT-02`, `RCOV-04`) the clause comes from the history section
  instead, via `` /^- \*\*([A-Z]+-\d+)\*\*(?: \([^)]*\))?:[ \t]*([^\n]*(?:\n {2}[^\n]*)*)/gm ``
  restricted to the `## Evidence and History` section. Neither ID moves in this phase.

- **Does a status flip require a signature change?** **No.** Experiments 1, 4 and 5 prove it:
  the `01-REVALIDATION.json` `requirementSignature` fields and the sealed hashes stay untouched
  and the gate exits 0. A signature change is required **only when the clause TEXT changes**
  (experiment 6), which is the 08-08 case, not the Phase 9 case. **D-09-03 carrier 4 is
  conditional and, as scoped, does not apply.** Carrier 1 (the checkbox) is not gate-enforced but
  should still move — it is the human-readable surface, and 22 of 30 IDs already read `- [x]`.

- **Is a six-ID flip mechanically different from a three-ID flip?** **No — it is the same
  operation repeated.** Each ID's two enforced surfaces are independent; the checker walks IDs and
  reports one violation per disagreeing ID. Experiments 4 and 5 exit 0 with six and eight IDs
  respectively. There is no cross-ID coupling except the phase-membership check below.

- **Baseline confirmed?** Yes: `Scope impact valid: 40 records.`

### 1.4 The carrier the CONTEXT does not name — two live test cases break

`tests/architecture/revalidation.test.ts::createScopeImpactFixture` (line 289) copies the **real**
`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `01-REVALIDATION.json` into a temp root,
then individual cases plant mutations against **literal strings taken from the live file**. Two of
those literals become stale when the seal flips.

Measured on the real tree (flip applied, test run, flip reverted, tree verified clean):

| Case | File:line | Literal | Breaks on |
|------|-----------|---------|-----------|
| `RVAL-04 scope-impact rejects an evidence ID with an active definition` | `tests/architecture/revalidation.test.ts:1219` | `marker: "- [ ] **GGAT-03**:"` | **Change A** — GGAT-03's checkbox becomes `- [x]`, the `.replace()` no-ops, no violation fires |
| `RVAL-04 scope-impact ignores content after a four-space fence pseudo-closer` | `tests/architecture/revalidation.test.ts:1026` | `const traceabilityRow = "\| CLOSE-02 \| Phase 9 \| Pending \|";` | **Change B** — the row reads `Complete`, the `.replace()` no-ops, no violation fires |

Measured runs of `node --test tests/architecture/revalidation.test.ts`:

| Tree state | tests | pass | fail |
|------------|------:|-----:|-----:|
| baseline | 136 | 136 | 0 |
| change A only | 136 | 135 | **1** (the GGAT-03 marker case) |
| change A + change B | 136 | 134 | **2** (both above) |

`[VERIFIED: three runs this session; tree restored and `git diff --stat` empty afterwards]`

**Implication for the plan.** Change A's commit must also update
`tests/architecture/revalidation.test.ts:1219` to `"- [x] **GGAT-03**:"`; change B's commit must
also update line 1026 to `"| CLOSE-02 | Phase 9 | Complete |"`. Splitting either edit from its
flip leaves a red suite — and the `npm-coverage-direct` pre-commit hook fires on both
`scripts/revalidation.mjs` and `tests/.*\.ts`, so the seal commit cannot be landed without the
test edit. No other live-literal dependency exists: the only other `- [ ]` literals in that file
are synthetic insertions (lines 1057, 1220), and the only other traceability-row literals name
already-`Complete` IDs (`AUTH-01`, `RVAL-01`, `PDEF-01`) or the `Evidence only` rows.
`[VERIFIED: grep over tests/architecture/revalidation.test.ts this session]`

`scripts/revalidation.negative.mjs` also holds `"| PDEF-01 | Phase 3 | Pending |"` and
`"- [ ] **AUTH-01**"`, but it builds its own synthetic fixture and is not wired into any npm
script, pre-commit hook, or CI job. `[VERIFIED: grep -rn "revalidation.negative" across
package.json, scripts/, tests/, .pre-commit-config.yaml, .github/]`

### 1.5 What does *not* need to move

- **`.planning/ROADMAP.md`.** `validatePhaseRequirements` (line 2497) compares each phase's
  `**Requirements:**` declaration against the sealed **routes** (not statuses) and against the
  traceability **routes**. The flip changes only `status`, so roadmap membership is unaffected.
  Experiments 4 and 5 exit 0 with the roadmap untouched. `[VERIFIED]`
- **`01-REVALIDATION.json`.** No `requirementSignature`, `beforeAnchor`, `afterAnchor`,
  `findingIds` or `rationale` field is affected by a status flip. The 40-record count is
  unchanged. `[VERIFIED]`

### 1.6 `gsd-tools requirements mark-complete` writes only TWO of the surfaces

`.claude/gsd-core/bin/lib/milestone.cjs:161–189` shows the verb writes exactly two surfaces:
"Surface 1 — the checkbox" and "Surface 2 — the traceability row". It has no knowledge of
`SEALED_REQUIREMENT_ROUTES`. **Running it alone leaves `scope-impact --check` red.** It also rolls
the checkbox back if the row write is rejected (`#2788 defect 2`), which for this repository means
it will succeed on all eight (all rows read `Pending`).

Either use the verb and then hand-edit the sealed table in the same commit, or hand-edit both.
`[VERIFIED: .claude/gsd-core/bin/lib/milestone.cjs read this session; `requirements` subcommands
confirmed as `mark-complete, ready-ids, revert-phase`]`

No workstream is active (`gsd-tools workstream get` → `{"active": null}`), and
`init.phase-op 9` resolves `requirements_path` to `.planning/REQUIREMENTS.md` — the same file the
gate script hardcodes. There is no workstream-split hazard here. `[VERIFIED]`

---

## §2 — The event-router read port

### 2.1 The two `readFile` sites, and there are exactly two

```
$ grep -n "readFile\|node:fs" extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
40:import { mkdir, readFile } from "node:fs/promises";
136:    raw = await readFile(opts.hooksJsonPath, "utf8");
575:  // not let `readFile` escape `loc.hooksDir`. Mirror the WRITE-site guard at   ← comment
606:    raw = await readFile(hooksJsonPath, "utf8");
```

`[VERIFIED: run this session]` — line 575 is a comment. `mkdir` at line 40 stays (used by
`ensureSharedDataDir`), so the import becomes `import { mkdir } from "node:fs/promises";`.

### 2.2 The two call chains

**Site A (routing) — shallow, one hop:**

```
createHooksRouting(runtime)                                       [281, exported]
  └─ readAndCachePluginHooksWith(routingState, opts)              [130]  ← readFile at 136
```

**Site B (hydration) — five hops, and `reader` stops two levels short:**

```
createHooksHydration(runtime, reader)                             [946, exported]
  ├─ hydrateProjectScopeForCwdWith(reader, cwd, routingState, guard)          [657]
  │    └─ hydrateScopeFromState(state, loc, cwd, routingState, guard)         [514]   ← reader NOT passed
  │         └─ tryHydrateOnePlugin(scope, mp, id, src, path, dir, cwd, rs, guard)  [560]  ← readFile at 606
  └─ registerHooksBridgeWith(runtime, reader, pi, opts)                       [764]
       └─ hydrateCacheFromDisk(opts, reader, routingState, guard)             [469]
            └─ hydrateScopeFromState(...)                                     [514]
                 └─ tryHydrateOnePlugin(...)                                  [560]
```

`[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, read this session]`

**The mechanical consequence:** `reader` already reaches `hydrateCacheFromDisk` and
`hydrateProjectScopeForCwdWith`, but **not** `hydrateScopeFromState` or `tryHydrateOnePlugin`.
Whatever shape the port takes, those two private functions gain a parameter.
`tryHydrateOnePlugin` already takes **nine positional parameters**; a tenth is the shape the
project's own conventions warn against ("switch to an `opts` object for anything with
optional/named fields"). Planning should consider folding it, but note that `hooks-lifecycle.test.ts`
Block E greps `hydrateProjectScopeForCwdWith`'s signature (see §7.3) — not `tryHydrateOnePlugin`'s.

### 2.3 Interface-shape analysis for D-09-08

`HooksHydrationReader` at line 422:

```ts
/** Required persisted-state operation for hooks hydration. */
export interface HooksHydrationReader {
  readonly loadState: (extensionRoot: string) => Promise<ExtensionState>;
}
```

`HooksRouting` (line 270) is the routing **operations** interface returned by the factory — it is
not a reader. Routing has no reader parameter at all today.

Three shapes, with the measured cost of each:

| Shape | What changes | Call-site cost | Reads as |
|-------|--------------|----------------|----------|
| **(a)** Widen `HooksHydrationReader` to `{ loadState, readHooksJson }`; add a *separate* one-member reader param to `createHooksRouting` | Two interfaces, asymmetric member sets | 140 test call sites + 1 prod + `index.ts` gate | Two ports for one responsibility — the asymmetry D-09-06 rejects, relocated |
| **(b)** New `HooksReader { readHooksJson }` taken by BOTH factories, alongside the existing `HooksHydrationReader` | Three interfaces, hydration takes two readers | 140 + 32 test call sites | Defensible but noisy: `createHooksHydration(runtime, stateReader, hooksReader)` is three positionals |
| **(c) Merge into one `HooksReader { loadState, readHooksJson }`** taken by both factories; `HooksHydrationReader` is renamed/retired | One interface, one member set, both factories take it | 140 + 32 test call sites; every `{ loadState }` literal grows a member | "This is the bridge's read port" — exactly what a correctly-designed module would look like |

**Recommendation (planning owns the call): (c).** It is the only shape where the two factories'
dependency is *the same type*, which is what "both sites on one injected port" means literally. It
also matches the module's own precedent: `05-06-SUMMARY.md:113` records that
`createHooksRouting`'s runtime parameter is **required** — "There is no optional runtime parameter,
default runtime export, raw singleton, or test-only seam." A defaulted port would sidestep the
140-site edit but would contradict that established decision in the same module.
`[CITED: .planning/phases/05-injection-and-ownership-design/05-06-SUMMARY.md:113]`

Note that (c) forces `createHooksRouting` to gain a reader it needs only for one member. If that
reads as over-wide, the honest alternative is to give routing a `HooksReader` too and let
hydration take `HooksReader & { loadState }` — but that is (b) in different clothes. The tradeoff
is real and the planner should state which side of it the plan lands on, not leave it implicit.

**What the gate will NOT object to:** `tests/architecture/no-test-only-production-surface.test.ts`
fires only on a **`__`-prefixed member declaration** (`MEMBER_NAME = __[A-Za-z][A-Za-z0-9_]*\s*\??\s*:`)
under `EXTENSION_ROOT_REL`, with one carve-out for `declare const … : unique symbol` brands. A
member named `readHooksJson` on an interface named `HooksReader` is invisible to it.
`[VERIFIED: tests/architecture/no-test-only-production-surface.test.ts, read this session]`

### 2.4 Every call site the signature change reaches

**Production — exactly two lines, both in `extensions/pi-claude-marketplace/index.ts`:**

```
index.ts:37:  const hooksRouting = createHooksRouting(hooksRuntime);
index.ts:40:  const hooksHydration = createHooksHydration(hooksRuntime, { loadState });
```

`[VERIFIED: grep -rn "createHooksRouting(\|createHooksHydration(" extensions/]`

**Tests — `createHooksRouting(`, 139 occurrences across 29 files:**

| file | n | | file | n |
|------|--:|-|------|--:|
| `tests/orchestrators/import/execute.test.ts` | 37 | | `tests/orchestrators/plugin/uninstall.test.ts` | 4 |
| `tests/orchestrators/plugin/enable-disable.test.ts` | 14 | | `tests/orchestrators/plugin/install-flow.test.ts` | 4 |
| `tests/orchestrators/plugin/update-flow.test.ts` | 12 | | `tests/architecture/cross-op-convergence.test.ts` | 4 |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 11 | | `tests/orchestrators/reconcile/backfill.test.ts` | 2 |
| `tests/edge/register.test.ts` | 9 | | `tests/orchestrators/plugin/update-swap.test.ts` | 2 |
| `tests/edge/handlers/plugin/import.test.ts` | 7 | | `tests/integration/fold-adoption.test.ts` | 2 |
| `tests/bridges/hooks/event-router.test.ts` | 7 | | `tests/edge/handlers/plugin/uninstall.test.ts` | 2 |
| `tests/orchestrators/reconcile/apply.test.ts` | 6 | | `tests/edge/handlers/plugin/reinstall.test.ts` | 2 |
| | | | `tests/edge/handlers/plugin/enable-disable.test.ts` | 2 |

plus 11 files with 1 each: `tests/orchestrators/reconcile/types.test.ts`,
`tests/orchestrators/marketplace/update.test.ts`,
`tests/integration/transaction-lifecycle-cascade.test.ts`,
`tests/integration/load-reconcile-race-child.ts`,
`tests/integration/hooks-cross-scope-reconcile.test.ts`,
`tests/integration/concurrent-install-child.ts`, `tests/index.test.ts`,
`tests/edge/handlers/plugin/update.test.ts`, `tests/edge/handlers/plugin/install.test.ts`,
`tests/e2e/import-command.test.ts`, `tests/architecture/hooks-if-field.test.ts`.

**Tests — `createHooksHydration(`, 32 call sites across 10 files:**
`tests/bridges/hooks/event-router.test.ts` (18), `tests/integration/hooks-dispatch-end-to-end.test.ts` (4),
`tests/integration/hooks-additionalcontext-end-to-end.test.ts` (2),
`tests/integration/hooks-spawn-end-to-end.test.ts` (2),
`tests/architecture/hooks-lifecycle.test.ts` (1, at line 408 with a full `HooksHydrationReader`
literal), `tests/integration/hooks-cross-scope-reconcile.test.ts` (1), plus the `tests/index.test.ts`
string literal below.

`[VERIFIED: grep -rn, counts run this session]`

### 2.5 The source-text gate the CONTEXT does not name

`tests/index.test.ts:787–793` asserts the **literal source text** of `index.ts`:

```ts
const routingConstructions = source.match(/createHooksRouting\(hooksRuntime\)/g) ?? [];
const hydrationConstruction = source.match(/createHooksHydration\(hooksRuntime, \{ loadState \}\)/g);
…
assert.deepStrictEqual(routingConstructions, ["createHooksRouting(hooksRuntime)"]);
assert.deepStrictEqual(hydrationConstruction, ["createHooksHydration(hooksRuntime, { loadState })"]);
```

Test title: *"constructs one runtime and completion cache for edge registration, hook hydration,
and plugin update"*. **Both regexes break when `index.ts:37/40` gains an argument.** The plan must
update this test in the same commit as the production wiring. `[VERIFIED: tests/index.test.ts,
read this session]`

### 2.6 Where a new port module may live without reforming the cycle

`bridges/hooks/routing-state.ts` is a leaf: it imports nothing from within `bridges/hooks/`
(everything else imports *it* — `dispatch.ts`, `dispatch-exec.ts`, `event-adapters.ts`,
`hook-env.ts`, `runtime.ts`, `spawn-helpers.ts`, `async-rewake/registry.ts`, `event-router.ts`).
`[VERIFIED: grep -rn "routing-state.ts" extensions/]`

A new port module has three safe homes:

1. **No new module at all** — declare the interface in `event-router.ts` beside
   `HooksHydrationReader` and export it through `bridges/hooks/index.ts`. Zero cycle risk, because
   it introduces no new edge. **This is the lowest-risk answer and matches where
   `HooksHydrationReader` already lives.**
2. `bridges/hooks/reader.ts` — a new leaf importing nothing from the bridge. Same cycle profile as
   `routing-state.ts`. Safe, but adds a file for one interface.
3. `bridges/hooks/routing-state.ts` — **do not.** That module's whole purpose is to hold the
   shared *state cells*; adding an I/O contract to it muddies the reason it exists.

Note that a type-only interface module would be invisible to coverage (type-only modules emit no
JS) and the `test:corresponding` gate would demand an owner test for it. Option 1 avoids both.

Fallow zone rules: `bridges-hooks` is its own zone in `.fallowrc.json`'s 13-zone matrix; a module
inside `bridges/hooks/` importing a sibling inside `bridges/hooks/` is an intra-zone edge and is
unconstrained. `fallow dead-code` gates cycles whole-repo and currently reports
`circular_dep_count: 0`. `[VERIFIED: npx fallow health --format json this session]`

### 2.7 The complexity gates have room — measured, both of them

**ESLint `sonarjs/cognitive-complexity` (ceiling 15).** Probed by running the rule at max 1 so
every function reports its score:

| line | function | cognitive | headroom |
|-----:|----------|----------:|---------:|
| 130 | `readAndCachePluginHooksWith` **(site A)** | 2 | 13 |
| 200 | (arrow inside `createBeforeAgentStartHandler`) | 2 | 13 |
| 247 | `rebuildRoutingTablesWith` | 3 | 12 |
| 329 | `pushGroupHandlers` | 3 | 12 |
| 375 | `flattenPluginIntoBuckets` | 8 | 7 |
| 469 | `hydrateCacheFromDisk` | 5 | 10 |
| **514** | **`hydrateScopeFromState`** | **10** | **5** ← tightest on the hydrate chain |
| 560 | `tryHydrateOnePlugin` **(site B)** | 6 | 9 |
| 657 | `hydrateProjectScopeForCwdWith` | 5 | 10 |
| 764 | `registerHooksBridgeWith` | 3 | 12 |
| 861 | (arrow) | 6 | 9 |

`[VERIFIED: npx eslint … --rule '{"sonarjs/cognitive-complexity":["error",1]}' this session]`

Threading a parameter adds **zero** cognitive complexity (a parameter is not a branch). Every
function on both chains has room even for a guard or two.

**Function size.** Measured with `max-lines-per-function` (skipComments, skipBlankLines):

| function | lines |
|----------|------:|
| `registerHooksBridgeWith` | 103 |
| `tryHydrateOnePlugin` **(site B)** | 58 |
| `hydrateScopeFromState` | 36 |
| `pushGroupHandlers` | 33 |
| `readAndCachePluginHooksWith` **(site A)** | 30 |
| `hydrateProjectScopeForCwdWith` | 27 |
| `hydrateCacheFromDisk` | 26 |

**Fallow.** `npx fallow health --format json` reports `functions_above_threshold: 0` over 13009
functions with `max_unit_size_threshold: 60` — while `registerHooksBridgeWith` is 103 ESLint-counted
lines. **Fallow's unit-size metric is not ESLint's line count**, and `npm run fallow` is green
today with that function present. File score for `event-router.ts`: `total_cyclomatic 86,
total_cognitive 59, function_count 43, lines 968, crap_max 56.0, crap_above_threshold 0`.
`npm run fallow` measured at **3.5s, exit 0**. `[VERIFIED: this session]`

**Practical reading:** fallow is not the risk here. The one number to watch is
`tryHydrateOnePlugin` at 58 ESLint-counted lines — if the planner adds a tenth positional
parameter (the repo's Prettier config at `printWidth: 100` puts each on its own line), the
signature grows one line to 59, and any two added body lines would cross 60 under
`max-lines-per-function` semantics. That rule is **not configured** in `eslint.config.js`, so it is
not an active gate — but it is the honest measure of "this function is at its size limit," and
`CONVENTIONS.md` names `maxUnitSize: 60` as a bound to respect. Folding
`tryHydrateOnePlugin`'s parameters into an `opts` object would shrink the signature and satisfy
the convention in the same move.

### 2.8 What the staleness test becomes

`tests/bridges/hooks/event-router.test.ts:1917` —
*"project hydration stops before parsing a plugin's hooks.json read under a stale generation"* —
currently carries a 22-line comment recording a **KNOWN CONFLICT with `D-08-A04`** and this
machinery:

```ts
const GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ = 3;
const runtimeGoingStaleAfterTheHooksRead: HooksRuntime = {
  ...runtime,
  currentGeneration(): number {
    if (stateRead) {
      guardsAfterTheStateRead += 1;
      if (guardsAfterTheStateRead === GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ) {
        runtime.advanceGeneration();
      }
    }
    return runtime.currentGeneration();
  },
};
```

With the port in place the case becomes a **named trigger**: advance the generation from inside
the injected `readHooksJson`, which runs at exactly the point the case wants. The spread decorator
over `HooksRuntime`, the counter, the `stateRead` latch, the constant, and the whole KNOWN-CONFLICT
comment all go. The three assertions stay unchanged:

```ts
assert.strictEqual(runtime.currentGeneration(), 1);
assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
```

**Keep the sibling control** at line 1882 —
*"project hydration parses a plugin's hooks.json into the parsed-config cache"* — untouched. It is
the same fixture with an undecorated runtime reading back one parsed-config entry, which is what
makes the empty assertion above mean "a hydration that was stopped." Keep both cases' recorded note
that `getRoutingBucket("PreToolUse")` is vacuous for this entrypoint (D-09-07).

`[VERIFIED: tests/bridges/hooks/event-router.test.ts:1882–1985, read this session]`

### 2.9 Coverage effect

`bridges/hooks/event-router.ts` currently reads **complete**:

```
$ node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
Direct coverage passed: … (branches 114/114, functions 43/43, lines 967/967)   # 4.1s
```

`[VERIFIED: run this session]` — note this supersedes the `branches 107/111, lines 959/967`
reading that `RCOV-02`'s clause text names; 08-03 closed it and 08-08 re-measured.

The module has **no pin row** (the pin holds exactly two modules — §3.3), so the port cannot
create a stale-row failure. It can create a *shortfall* if the new injected arm is not exercised.
At 4.1s per pair, the port work is cheap to iterate against.

---

## §3 — Coverage re-measurement: commands, costs, and the pin

### 3.1 The four arms

| npm script | scope | what it does |
|------------|-------|--------------|
| `test:coverage:direct` | branch (`origin/main...HEAD`) | changed pairs + every pinned pair |
| `test:coverage:direct:commit` | commit (`--base HEAD`) | pairs this commit touches + every pinned pair |
| `test:coverage:direct:all` | whole tree | all 230 pairs, `--report coverage/all-pairs.jsonl` |
| `test:coverage:direct:report` | whole tree, **no verdict** | all 230 pairs → `coverage/all-pairs-report.ndjson`, exit 0 means "report written" |
| `test:coverage:direct -- <path>` | one pair | measures one pair against its pin row |

`[VERIFIED: package.json scripts, read this session]`

`productionPaths()` returns **230** — confirmed this session by importing the module directly.

### 3.2 Measured wall-clock

| run | cost | source |
|-----|------|--------|
| one pair (`event-router.ts`) | **4.1s** | measured this session |
| `test:coverage:direct:report` (230 rows) | **486.9s** | **inherited** from 08-08's D1 — not re-run here |
| `test:coverage:direct:all` (230 pairs, strict) | **492.4s** | **inherited** from 08-08's D2 — not re-run here |
| branch-scoped, on a long-lived branch | ~147 pairs, ~6.5 min | `CONTRIBUTING.md` |

**Reported as inherited, deliberately.** Re-running either sweep to confirm a number already
measured on this tree would cost ~8 minutes and tell the planner nothing it does not already have.
Both must be re-run *for real* as part of D-09-09 step 2, after the production change lands.
Budget **~16 minutes of wall clock** for the pair (report + strict arm), as 08-08 did.

### 3.3 How the pin is "regenerated," and what byte-identical means

**There is no pin-generation command.** `scripts/test-coverage-direct.pin.mjs` exports only
`pinProjectPath`, `loadCoveragePin`, and `assertPinnedReadings` — it has no writer.
`[VERIFIED: grep for writeFile in scripts/test-coverage-direct.pin.mjs → nothing]`

08-08's method, which D-09-09 says to repeat:

1. `npm run test:coverage:direct:report` — writes `coverage/all-pairs-report.ndjson`, one row per
   pair, each with a `verdict` of `complete` | `type-only` | `accepted-shortfall`.
2. Rebuild the pin's `rows` array from the `accepted-shortfall` rows, carrying each row's
   `sourcePath`, its `reading` string exactly as the gate printed it, its `findingIds`, and its
   `reasons`.
3. Normalize the result through Prettier (`prettier --write scripts/test-coverage-direct.pin.json`,
   or `npm run format`).
4. **`git status --porcelain scripts/test-coverage-direct.pin.json` comes back empty.** That empty
   output *is* the byte-identity proof — the artifact was regenerated and the bytes agree.
5. `npm run test:coverage:direct:all` exits 0 over 230 pairs, with `assertPinnedReadings`
   confirming the bidirectional match.

`[CITED: .planning/phases/08-direct-coverage/08-08-SUMMARY.md, D1/D2 verification refs and
key-decisions]`

**08-08's own warning applies verbatim to this phase:** *"Hold every edit to a file the running
sweep measures until it finishes; `scripts/revalidation.mjs` and `.planning/` are one pair, and a
half-applied seal during the run reports as a coverage failure."* The sweep runs the owner test
for `scripts/revalidation.mjs`, which is `tests/architecture/revalidation.test.ts`, which reads
the live `.planning/REQUIREMENTS.md`. Do not edit either while a sweep is in flight.

`scripts/revalidation.mjs` reads `Direct coverage passed: branches 789/789, functions 202/202,
lines 2660/2660` — a data-only edit to `SEALED_REQUIREMENT_ROUTES` changes no branch, so the
reading should be unchanged, but the pair is measured on every seal commit by the pre-commit hook.

### 3.4 The pin's two rows

`scripts/test-coverage-direct.pin.json` (version 1) holds **exactly two rows**:

| sourcePath | reading | findingIds |
|------------|---------|-----------|
| `extensions/pi-claude-marketplace/bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | `BC-019` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | `branches 109/111, lines 1034/1040` | `D-08-A14` |

**`bridges/hooks/event-router.ts` has no pin row** — 08-03 closed it with real owner tests and
`D-08-03a` was discharged by measurement. `[VERIFIED: scripts/test-coverage-direct.pin.json read
this session]`

### 3.5 CONTRIBUTING.md is already correct — the CONTEXT's premise here is stale

The CONTEXT says *"`CONTRIBUTING.md` currently says the hook and CI job are not wired yet (08-08
wrote that deliberately) … this phase owns it."* **That tense was already corrected.**
`grep -n "not wired\|yet\b" CONTRIBUTING.md` returns nothing, and the coverage section reads in the
present tense: *"the pre-commit hook runs the commit-scoped one, and the CI job runs the
branch-scoped one on a pull request and the whole-tree one on everything else."*

Git history on the file:

```
b753bd20 docs(08-fix): restate gate behavior the phase changed underneath it
4165fc55 fix(08-fix): measure the whole tree on the release path
6d5cb6a0 docs(08-09): state where the coverage gate runs and what it costs
3925ce0e docs(08-08): state the pinned coverage set and both gate costs
```

Both gates exist and are wired:

- `.pre-commit-config.yaml:144` — `npm-coverage-direct`, `npm run test:coverage:direct:commit`,
  `files: '^(extensions/pi-claude-marketplace/.*\.ts|tests/.*\.ts|scripts/revalidation\.mjs|scripts/test-coverage-direct\.pin\.json)$'`
- `.github/workflows/ci.yml:140` — job `direct-coverage` / `direct coverage (Node 24)`,
  `fetch-depth: 0`, a `git rev-parse --verify origin/main^{commit}` assertion on `pull_request`,
  `set -o pipefail` before the piped gate run, a
  `grep -qx 'Changed-pair base: origin/main'` assertion on the logged base, and the whole-tree arm
  on every other event.
- `.github/workflows/ci.yml` `package` job: `needs: [check, integration-tests, e2e-tests, direct-coverage]`

`[VERIFIED: all four files read this session]`

**Recommendation:** the plan should carry a task that *re-reads* CONTRIBUTING.md's coverage section
against the final tree and corrects only what the phase's own changes make stale (e.g. the pin
rows and their readings, if either moves). It should **not** carry a task premised on rewriting a
"not wired yet" sentence that no longer exists. If nothing moved, the honest deliverable is a
recorded re-read with no diff — which is the same shape as 08-08's byte-identical pin.

---

## §4 — The window ledger: measured, and the repair proven end to end

### 4.1 The desync is exactly three cells, no more

Parsed both representations and compared every field of all 31 entries:

| entry | field | rendered table | fenced JSON |
|-------|-------|----------------|-------------|
| **9** | `description` | 2750 chars | 2326 chars |
| **30** | `description` | 1566 chars | 1198 chars |
| **30** | `status` | `fixed` | `open` |

**No other disagreement exists** across `id`, `phase`, `kind`, `file`, `line`, `description`,
`status`, `reason`, `recorded_at`, `resolved_at` for any of the 31 entries. The frontmatter
(`open_count: 23, waived_count: 0, fixed_count: 8, total_count: 31`) agrees with the **JSON**, not
the table. `[VERIFIED: field-by-field diff run this session]`

**Entry 9 — the exact byte-level delta.** It is a *replacement of the final sentence*, not an
append. The JSON ends:

> `…and adding the three orchestrators as injected collaborators is the test seam D-115-03 and CONVENTIONS.md forbid. This needs an operator decision.`

The table replaces `This needs an operator decision.` with:

> `DECIDED 2026-09-02: the operator accepted the recorded exposure. No code change - both structural remedies collide with phase 115's own bounds (100% branch coverage; no test-only DI seam on apply.ts), and the removed arms are unreachable today, so there is no live defect. This entry stays \`open\` deliberately, as the durable record of the residual risk rather than as a pending action. Resolution recorded in 115-VERIFICATION.md human_verification item 2.`

**Entry 30 — a pure append plus a status change.** The table's description is the JSON's text
followed by:

> ` RESOLVED 2026-09-04 by operator decision: D-117-20 stands (no ledger-keyed gate verdict); SC-4's literal wording accepted as superseded via an overrides entry on 117-VERIFICATION.md. The reproducibility half was fixed outright by npm run test:coverage:direct:report (commit 1495488b), which regenerates all 204 rows from the gate's own enumeration and blocks nothing.`

plus `status: open` → `fixed`. `[VERIFIED: difflib opcode diff run this session]`

### 4.2 How the verb detects it, and which verbs are blocked

`.claude/gsd-core/bin/lib/broken-windows.cjs::writeLedgerAtomic` (line 753) runs a **drift guard**
before regenerating anything: it parses the on-disk JSON, calls `renderTable(onDiskEntries)`, and
compares that byte-for-byte against `extractTableRegion(existing, …)`. On disagreement it throws
`WINDOWS_LEDGER_TABLE_DRIFT` naming the drifted row ids via `diffTableRowIds`.

Because the guard lives in `writeLedgerAtomic`, it blocks **`append`, `waive`, `fixed`** — the
three mutating verbs. **`windows status` is NOT blocked** (it only reads): it exits 0 today and
returns the JSON. The CONTEXT's "blocks EVERY `windows` verb" is true of every verb that *writes*.
(`list` genuinely does not exist — the subcommands are `status, append, waive, fixed`.)

Reproduced against a scratch copy:

```
$ node .claude/gsd-core/bin/gsd-tools.cjs windows fixed 19 --project-dir <scratch>
Error: Ledger table in <scratch>/.planning/WINDOWS.md disagrees with the fenced JSON entries
(the sole source of truth) for row id(s): 30, 9. Edit the fenced JSON block directly, or discard
the table edit and re-run the command so gsd-tools regenerates the table; never hand-edit the
rendered table.                                                                       # exit 1
```

`[VERIFIED: run this session against a scratch copy; the real `.planning/WINDOWS.md` was never
modified — `git status --porcelain .planning/WINDOWS.md` empty throughout]`

### 4.3 A FOURTH edit the CONTEXT does not name — the frontmatter counts

With only the three description/status edits applied, the verb still refuses:

```
Error: Ledger counts disagree with entries: frontmatter open/waived/fixed/total=23/0/8/31
but entries yield 22/0/9/31.                                                          # exit 1
```

`parseLedger` validates the frontmatter counts against the entries as a **second, independent
fail-closed check**, behind the table-drift guard. Flipping entry 30 to `fixed` in the JSON
therefore also requires editing the frontmatter to `open_count: 22` / `fixed_count: 9` by hand.
`[VERIFIED: run this session]`

### 4.4 The full repair, proven

With all four edits applied to the scratch copy:

```
$ node … windows fixed 19 --project-dir <scratch>   # exit 0 → open 21, fixed 10
$ node … windows fixed 21 --project-dir <scratch>   # exit 0
$ node … windows fixed 22 --project-dir <scratch>   # exit 0 → open_count: 19, fixed_count: 12
```

Post-repair, a field-by-field re-diff of the regenerated table against the JSON reports **zero
mismatches**. `[VERIFIED: run this session]`

**Lossless?** Yes, with one caveat worth a planning decision. `renderLedger` reconstructs
frontmatter + header + table + JSON and re-appends any trailing prose below the closing fence —
`.planning/WINDOWS.md` has none (the file is 425 lines and the closing fence is line 425), so
nothing is at risk. `renderTable`'s `cell()` escapes `\` → `\\` then `|` → `\|`; the two
descriptions contain neither, so the regenerated rows are the text verbatim.

**The caveat:** entry 30 hand-edited to `fixed` keeps `resolved_at: null` (the current rendered
table also shows an empty `resolved_at`). Entries closed through the verb get a fresh timestamp.
The planner should decide whether to leave entry 30's `resolved_at` null or set it to
`2026-09-04T01:03:42.619Z` — the date its own prose names. Setting it is more honest; either
passes the gate.

### 4.5 Entries 19, 21, 22 confirmed false-open

| id | phase | file | claim |
|----|-------|------|-------|
| 19 | 116 | `edge/handlers/plugin/pending.ts` | "Nullish-fallback arm on the first positional is unreachable through the module exports… COMPILER-FORCED" |
| 21 | 116 | `edge/args.ts` | "Index-read guard at 34-37 is unreachable at runtime… COMPILER-FORCED" |
| 22 | 116 | `edge/handlers/shared.ts` | "Cross-cutting flag scanner guard at 53-55 is unreachable at runtime… COMPILER-FORCED, same class as the args.ts claimant" |

All three name exactly the three dense-index guards `RCOV-02`'s clause says are "honestly rewritten
to typed iteration" and 08-02 rewrote. All three read `open`. `[VERIFIED: WINDOWS.md JSON parsed
this session; RCOV-02 clause read from .planning/REQUIREMENTS.md:97-106]`

### 4.6 Open count by phase — the CONTEXT omits phase 116

23 entries read `open`. Broken down:

| phase | open ids | count |
|-------|----------|------:|
| 86 | 1 | 1 |
| 88 | 2, 3 | 2 |
| 115 | 7, 8, 9, 10, 13, 14 | 6 |
| **116** | **15, 16, 17, 18, 19, 20, 21, 22** | **8** |
| 117 | 23, 24, 25, 26, 29, 30 | 6 |

**Correction to the CONTEXT:** D-09-13 names "phases 86, 88, 115, and 117" — but **phase 116 is the
largest open group at 8**, and it is where entries 19/21/22 live. After D-09-12 closes those three,
**19 remain open** (phase 116 drops to 5). D-09-13's instruction is unaffected — the remaining 19
still may not be mass-closed — but the plan's ledger prose must name 116 or it will be wrong.
`[VERIFIED: counted this session]`

---

## §5 — Backlog dispositions: the terminal evidence for each of the seven

### 5.1 The four that shipped

| backlog item | terminal route | evidence |
|--------------|----------------|----------|
| **`TESTQ-01`** (line 2380) — "act on the two-pass unit-test review corpus" | The **entire `refine-unit-tests` milestone**. It is the umbrella item that the milestone was cut from. | `TESTQ-01`'s own text lists five workstreams; they map to `RVAL-01..04` (Phase 1), `PDEF-01..08` + `AUTH-01` (Phases 2-3), `TREF-01..09` (Phases 4-6), `GGAT-01/03/04` (Phase 7), `RCOV-01/02/03` (Phase 8). Its item 4 ("re-arm the inert gates, 36 rows") is `GGAT-01/03/04`; its item 5 ("Wire `test:coverage:direct` into the check chain") is `RCOV-03`. `01-67-SUMMARY.md:128`: *"`TESTQ-01`, `FLOW-09`, `REASON-01`, and `FLOW-07` retain exact routes through their terminal findings."* |
| **`FLOW-09`** (line 540) — "internals exported only for tests" | **`TREF-05` + `TREF-06` (Phases 5-6)**, plus the `no-test-only-production-surface` gate under `GGAT-04`. | `TREF-05`: *"Terminal mutable module state moves to legitimate lifecycle or factory ownership without reset exports created only for tests."* `TREF-06`: *"Tests exercise public contracts, and terminal test-only exports, reset hooks, and test-shaped branches follow the trace-preserving removal disposition."* `tests/architecture/no-test-only-production-surface.test.ts` is the standing gate (`MF-DEC-07` / `D-05-01` / `GGAT-04`). |
| **`REASON-01`** (line 25) — "unify malformed-input failures under a `malformed X` reason family" | **`PDEF-03` (Phase 2) + `PDEF-05` (Phase 3)**. | `PDEF-03`: *"The terminal malformed-MCP input case returns its typed stable failure without an unexpected throw or configuration write."* `PDEF-05`: *"Terminal lock-contention, sibling-sweep, and malformed-input reasons use explicit typed classifications instead of message-substring flow."* `02-01-SUMMARY.md:9` provides *"Terminal PDEF-03 evidence and the locked malformed-input contract."* **Note the scope is narrower than `REASON-01` asked for** — see §5.4. |
| **`FLOW-07`** (line 420) — "is the ESLint `no-restricted-paths` zone matrix now redundant?" | **`GGAT-03` (Phase 7)**, which names it by ID. | `GGAT-03`'s clause: *"`FLOW-07` varies effective config sources and broad overrides across the terminal ESLint/Fallow boundary gaps and proves target visitation."* `07-16-SUMMARY.md:327` records the satisfaction row: *"`07-07` resolved both boundary gates through `ESLint#calculateConfigForFile` and deleted the two superseded gates"*, verified by `node --test tests/architecture/eslint-effective-config.test.ts` and `npm run lint` inside `npm run check`. |

`[VERIFIED: .planning/REQUIREMENTS.md, .planning/BACKLOG.md, and the named SUMMARY files, all read
this session]`

### 5.2 The four that stay evidence-only or deferred

| item | disposition | reasoning, from the record |
|------|-------------|---------------------------|
| **`COV-01`** (line 49) | **evidence-only** — superseded | `REQUIREMENTS.md` "Evidence and History": *"**RCOV-04** (`SCOPE-REQ-RCOV-04`, formerly Phase 8): the standalone `COV-01` remeasurement is superseded by `RCOV-01`'s complete all-pair baseline. Its two orchestrators remain included in that baseline and neither is a terminal current shortfall; this is not a flattering exclusion or an implementation claim."* `01-67-SUMMARY.md:130` concurs. The two named orchestrators are `import/execute.ts` and `marketplace/update.ts`; both are inside the 230-pair enumeration and neither appears in the pin. |
| **`AGCOL-01`** (line 1783) | **evidence-only** — unsupported premise | `REQUIREMENTS.md` "Evidence and History": *"**GGAT-02** (`SCOPE-REQ-GGAT-02`, formerly Phase 7): `AGCOL-01` asserted that the agents-collision gate was dead, but exhaustive canonical mapping found no dedicated terminal finding for that premise. Revalidation is required before this requirement can return to active scope; it is not implemented."* `01-67-SUMMARY.md:107`, `01-68-SUMMARY.md:114` concur. |
| **The unused-type-member todo** (`.planning/todos/2026-09-02-detect-unused-code-and-type-members.md`) | **deferred** to `v1.19` | `REQUIREMENTS.md`: *"The folded unused-type-member todo and the named `GAUTH-01` sentinel-wiring prescription likewise have no dedicated terminal finding. They remain traceable backlog history and cannot create active milestone work under D-22 without new terminal evidence inside the unit-test-quality boundary."* `09-CONTEXT.md` "Reviewed Todos" confirms it is not folded. |
| **`GAUTH-01`** (line 1647) | **deferred** — the *named prescription* is not activated | The backlog entry's prescription: `NO_PROVIDER_CAUSE(host)` (`orchestrators/auth-host.ts`) exists and is host-generic, but is wired into **one of five** auth-relevant call sites — `marketplace update`'s url-source refresh path (`orchestrators/marketplace/update.ts:394`). `plugin install`, `plugin reinstall`, `plugin fetch` and `marketplace add` still surface the bare host-less `"authentication required"` token. **That is the "named prescription": wire the same cause line into the other four call sites.** It is deferred because it is a *product* change with no terminal finding inside the unit-test-quality boundary; `01-67-SUMMARY.md:132`: *"The named GAUTH-01 sentinel-wiring prescription is not activated. `AUTH-01` retains only the independently terminal authentication findings."* (Its sibling `GAUTH-02` already shipped separately via quick task `260814-a7m`.) |

`[VERIFIED: .planning/REQUIREMENTS.md:121-139, .planning/BACKLOG.md, 01-67/01-68-SUMMARY.md, all
read this session]`

### 5.3 The house format for a closed backlog entry — match this

Two variants exist in `.planning/BACKLOG.md`. The **strikethrough** form is the dominant one for
items closed by a specific change:

```markdown
## ~~HKNC-01: session_start lazy-hydrate `?? []` fallback is unreachable~~ -- CLOSED

Closed 2026-08-17 by the routingTable encapsulation, which removed both
`?? []` call sites as a side effect rather than as a targeted fix. …

NOT closed by the same change: the single `?? []` inside `getRoutingBucket`
itself, which predates this item and has four other callers …

Original report follows.

Surfaced 2026-08-14 measuring branch coverage on PR #127. …
```

The **parenthetical** form (`## FLOW-01: … (CLOSED)`) is used by the FLOW family.

The shape has four parts: (1) heading marked closed, (2) a first paragraph naming the date and
**what** closed it, (3) an explicit "NOT closed by the same change" paragraph where the closure is
partial, (4) `Original report follows.` with the original text preserved verbatim.

`SEV-01` (line 2050) is the compact variant: heading + a `Filed and closed the same day (date).`
paragraph + what moved and why it needed a decision. No `Original report follows.` because the
entry was short.

**For the evidence-only items, the register to match is `REQUIREMENTS.md` §"Evidence and History"**
(lines 121-139), which `09-CONTEXT.md` names explicitly. Its shape: ID, its scope-change row id
and former route in parentheses, then what the claim asserted, what the revalidation found, and an
explicit *"it is not implemented"* / *"this is not a flattering exclusion or an implementation
claim."*

`[VERIFIED: .planning/BACKLOG.md and .planning/REQUIREMENTS.md read this session]`

### 5.4 One honest wrinkle for the `REASON-01` wording

`REASON-01` asks for a `{malformed <feature>}` **family** and names **two** mislabeled cases:
inline malformed `mcpServers` → `{unsupported source}`, and malformed `hooks.json` → `{unsupported
hooks}`. `PDEF-03` and `PDEF-05` cover the *terminal* malformed-input cases the revalidation
confirmed, which is narrower than "introduce a consistent family and reroute both." The disposition
that survives `D-22` is therefore **`implemented` for the terminal route the milestone carried**,
with an explicit note of what the original item asked for that this milestone did not do — the
"NOT closed by the same change" paragraph the house format already provides for exactly this. A
bare `implemented` with no such note would overstate it.

---

## §6 — The two human-checkable pin claims (D-09-16)

08-04's deliverable D5 is the standing caveat:

> *"A reason is a claim about why an arm cannot be reached. The gate can prove the reading, and the
> negative harness can prove the comparison, but only a reader can judge whether
> `PLUGIN_ENTRY_VALIDATOR` really re-checks what `MARKETPLACE_SCHEMA.plugins` already enforced —
> which is the difference between a pin and an allow-list."*

`[CITED: .planning/phases/08-direct-coverage/08-04-SUMMARY.md:109-113]`

Below is the reading, extending rather than repeating it. All three claims hold; one is stronger
than the pin states and one is weaker in a way worth writing down.

### 6.1 `discover.ts` 288-290 — the `CommandNameError` narrowing arm: **UNREACHABLE, confirmed**

The pin's reason: *"the arm is unreachable — only a `Symbol.hasInstance` patch reaches its throw —
but the check still narrows the `unknown` catch binding for `badNameWarning(err)`, so deleting it
without a restructure breaks typing."*

The code (`extensions/pi-claude-marketplace/bridges/commands/discover.ts`):

```ts
// line 222
function nameCommandInDir(pluginName: string, sourceName: string, base: string): string {
  try {
    return generatedCommandName(pluginName, sourceName);
  } catch (err) {
    throw new CommandNameError(sourceName, base, { cause: err });
  }
}

// line 286
  try {
    generatedName = nameCommandInDir(pluginName, sourceName, base);
  } catch (err) {
    if (!(err instanceof CommandNameError)) {   // ← uncovered arm
      throw err;
    }
    warnings.push(badNameWarning(err));
    return;
  }
```

**The argument, stated completely.** `nameCommandInDir` is **module-private** — it is declared and
called only inside `discover.ts` (`grep -rn "nameCommandInDir" extensions/` returns exactly the
declaration at :222 and the call at :287). Its entire body is a `try`/`catch` whose catch
unconditionally throws `new CommandNameError(…)`. So the **only** value `nameCommandInDir` can
throw is a `CommandNameError` instance.

The remaining escape route is the constructor itself throwing before the instance exists.
`CommandNameError` (`shared/errors-bridges.ts:112-122`) is:

```ts
constructor(sourceName: string, commandsDir: string, options?: { cause?: unknown }) {
  super(`invalid command source "${sourceName}" in "${commandsDir}"`, options);
  this.name = "CommandNameError";
  this.sourceName = sourceName;
  this.commandsDir = commandsDir;
}
```

Three string field assignments and a template-literal `super(...)` over two `string` parameters —
nothing that can throw for any input. **Conclusion: no input reaches the arm.** Only a
`Symbol.hasInstance` patch on `CommandNameError` (which `TREF-08` forbids planting) or a realm
boundary would make `instanceof` false for a genuine instance. The pin's reason is correct, and
the arm is genuinely compiler-forced: the `if` is what narrows `err: unknown` down to
`CommandNameError` for `badNameWarning(err: CommandNameError)`, and neither `!` nor `as` is
available under this repository's lint rules.

`[VERIFIED: extensions/pi-claude-marketplace/bridges/commands/discover.ts:205-296 and
extensions/pi-claude-marketplace/shared/errors-bridges.ts:112-122, read this session]`

### 6.2 `install-outcome.ts` 422-426 — the manifest-entry re-check: **UNREACHABLE by input, confirmed, with one named residual**

The pin's reason: *"re-validation of a manifest entry that the identical compiled schema already
accepted in the same pass. `MARKETPLACE_SCHEMA.plugins` is `Type.Array(PLUGIN_ENTRY_SCHEMA)` and
`PLUGIN_ENTRY_VALIDATOR` is `Compile(PLUGIN_ENTRY_SCHEMA)`…"*

Traced end to end:

```
install-outcome.ts:413   const manifest = await loadCachedMarketplaceManifest(sourceMp.manifestPath);
install-outcome.ts:300   → loadMarketplaceManifest(manifestPath)          [domain/manifest.ts]
domain/manifest.ts       → manifestCache.load(...)                        [createManifestCache]
domain/manifest-cache.ts → loadMarketplaceManifestUncached(manifestPath)  [the injected loader]
domain/manifest.ts:53    →   readFile → JSON.parse → MARKETPLACE_VALIDATOR.Check(parsed)
domain/manifest.ts:26-28     MARKETPLACE_SCHEMA = Type.Object({ …, plugins: Type.Array(PLUGIN_ENTRY_SCHEMA) })
domain/manifest.ts:40        MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA)

install-outcome.ts:414   const entryRaw = manifest.plugins.find((p) => p.name === plugin);
install-outcome.ts:422   if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) { throw … }   ← uncovered arm
domain/components/plugin.ts:89  PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA)
```

`entryRaw` is an element of an array the *identical* schema already validated, in this process,
from this parse. **The arm is unreachable for any input.** `[VERIFIED: all five files read this
session]`

**One residual the pin's reason does not name, and should.** `domain/manifest-cache.ts` D-03
returns hits **by reference** and its header says *"The seam preserves the raw `JSON.parse` value,
so callers MUST treat the result as READ-ONLY."* If some caller ever mutated a cached manifest
entry between the validated load and this re-check, the arm would fire. That is a *program* defect
(a violated read-only contract), not an input — so the reachability claim stands — but it is the
precise shape of the thing the re-check is defense-in-depth *against*, and naming it makes the pin
row a better record than the current text. Recommend the ledger row say so.

### 6.3 `install-outcome.ts` 818-820 — the hooks re-parse guard: **NOT input-reachable, but reachable by a filesystem mutation — the pin's reason is right and should be quoted, not softened**

The pin's reason: *"the hooks re-parse guard, over bytes on which the resolver already ran both of
`parseHooksConfig`'s `{ok:false}` arms at install-entry under `D-57-04`. The only difference
between the two calls is `skipIfMap`, and `D-61-02` records that every `compileIfPredicate` failure
collapses to `MATCH_ALL_IF`, so no if-field issue can produce a refusal. The guard fires only on a
mutation between the resolve and the phase."*

The two calls:

```ts
// domain/hooks-resolution.ts:40   — resolve time
const parsed = parseHooksConfig(raw, ifContext, noopCompileIf, { skipIfMap: true });

// orchestrators/plugin/install-outcome.ts:817 — the hooks ledger phase
const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
if (!parsed.ok) { throw new Error(`hooks.json re-parse failed: ${parsed.reason}`); }  ← uncovered arm
```

**A stronger argument than the pin gives, from `domain/components/hooks.ts:235-292`.** Both
`{ ok: false }` returns occur **before** `skipIfMap` is consulted:

- line 242-248: `JSON.parse` throws → `return { ok: false, reason: "hooks.json is not valid JSON: …" }`
- line 257-261: `!HOOKS_VALIDATOR.Check(candidate)` → `return { ok: false, reason: "hooks.json failed schema validation: …" }`
- line 282-284: `skipIfMap` only selects `new Map()` vs `buildIfPredicateMap(...)` on the **success**
  path, and the comment records D-61-02: *"every failure path inside `compileIfPredicate` collapses
  to MATCH_ALL_IF -- the parser never fails on an `if`-field issue."*

So `skipIfMap` is **structurally incapable** of changing the ok/not-ok verdict for identical bytes.
That is a stronger claim than "no if-field issue can produce a refusal" — it holds regardless of
what `compileIf` does.

**But the two calls read the file twice.** The resolver reads
`path.join(pluginRoot, "hooks", "hooks.json")`; the phase reads
`path.join(c.resolved.pluginRoot, c.resolved.hooksConfigPath)` where `hooksConfigPath` is
`path.join("hooks", "hooks.json")` — the same path, two separate `readFile` calls at different
times. **The arm is reachable if the file changes between them.** That is a genuine TOCTOU window,
not a phantom, and it is exactly what the guard is for.

**Disposition recommendation:** this claim is *checkable and checked* — the reachability is bounded
to a concurrent filesystem mutation inside the install window, which no unit test can produce
deterministically without patching `readFile` (barred by `TREF-08`). It should be recorded as
`implemented`-with-a-named-residual in the ledger, not silently folded into "unreachable." The pin's
own text already says "fires only on a mutation between the resolve and the phase," which is
accurate; the finding here is that the *reason for the reason* is stronger than stated, and the
residual is a race rather than an input.

---

## §7 — Gates, ordering, and the facts the planner must not get wrong

### 7.1 `npm run check` — every sub-command, measured on this tree today

```
check = typecheck && lint && fallow && format:check
      && test:corresponding && test:corresponding:negative
      && test:coverage:direct:negative && test && test:integration
```

| # | sub-command | exit | wall clock |
|--:|-------------|-----:|-----------:|
| 1 | `npm run typecheck` (`tsc --noEmit`) | 0 | **35.4s** |
| 2 | `npm run lint` (`eslint extensions tests scripts eslint.config.js`) | 0 | **113.4s** |
| 3 | `npm run fallow` (dead-code + health + dupes) | 0 | **3.5s** |
| 4 | `npm run format:check` (prettier) | 0 | **41.7s** |
| 5 | `npm run test:corresponding` | 0 | **2.4s** |
| 6 | `npm run test:corresponding:negative` | 0 | **0.9s** |
| 7 | `npm run test:coverage:direct:negative` | 0 | **3.8s** |
| 8 | `npm test` (unit) | 0 | **34.2s** — 6004 tests, 300 suites, 0 fail, 0 skipped |
| 9 | `npm run test:integration` | 0 | **10.8s** — 32 tests, 0 fail |
|   | **total** | **0** | **≈ 246s (4.1 min)** |

`[VERIFIED: each measured individually this session, 2026-09-11]`

This is the `CLOSE-01` baseline. **Note it is green *today*, before any Phase 9 work** — which is
precisely why D-09-02's split matters: flipping `CLOSE-01` now would be a true statement about a
tree that does not yet carry the phase's own changes.

Node is **v26.8.2**, npm **11.19.1**, fallow **3.20.0** (package.json floors are
`node >=20.19.0` and `fallow ^3.17.0`). The two `pi-subagents` integration tests pass here — the
global peer is current in this environment.

### 7.2 Which pre-commit hooks fire for which paths

Hooks with **no** `files:` gate (fire on every staged file, including `.planning/`):
`trailing-whitespace`, `end-of-file-fixer`, `fix-byte-order-marker`, `check-case-conflict`,
`check-merge-conflict`, `check-symlinks`, `destroyed-symlinks`,
`check-executables-have-shebangs`, `check-shebang-scripts-are-executable`, `detect-private-key`,
`check-added-large-files` (excludes `package-lock.json`, `.planning/`), `check-json`, `check-yaml`,
`check-ast`, `sort-simple-yaml`, `check-vcs-permalinks`, `forbid-submodules`,
`forbid-new-submodules`, `alphabetize-codeowners`, `fix-spaces`, `forbid-bidi-controls`,
`trufflehog` (broken in a worktree — always `SKIP=trufflehog`), `gitlint`.

Hooks that **exclude `.planning/`**: `fix-smartquotes`, `fix-ligatures`, `mdformat`,
`markdownlint-cli2`. `fix-unicode-dashes` excludes `.planning/`, `scripts/revalidation.mjs`, and
`tests/architecture/revalidation.test.ts`.

Path-gated hooks, by the paths this phase touches:

| hook | pattern | `.planning/**` | `scripts/revalidation.mjs` | `scripts/test-coverage-direct.pin.json` | `extensions/**/*.ts` | `tests/**/*.ts` | `CONTRIBUTING.md` |
|------|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| `prettier` (`\.(js\|json\|ts)$`) | any path | JSON only | — | **yes** | **yes** | **yes** | — |
| `npm-lint` | `eslint.config.js\|tsconfig.json\|(extensions\|tests)/.*\.ts\|scripts/.*\.mjs\|package(-lock)?.json` | — | **yes** | — | **yes** | **yes** | — |
| `npm-format-check` | + `.prettierrc.json\|.prettierignore` | — | **yes** | — | **yes** | **yes** | — |
| `npm-typecheck` | `(extensions\|tests)/.*\.ts\|package(-lock)?.json\|tsconfig.json` | — | — | — | **yes** | **yes** | — |
| `npm-fallow` | `.fallowrc.json\|tsconfig.json\|eslint.config.js\|(extensions\|tests)/.*\.(ts\|mjs)\|scripts/.*\.mjs\|package(-lock)?.json` | — | **yes** | — | **yes** | **yes** | — |
| `npm-coverage-direct` | `extensions/pi-claude-marketplace/.*\.ts\|tests/.*\.ts\|scripts/revalidation\.mjs\|scripts/test-coverage-direct\.pin\.json` | — | **yes** | **yes** | **yes** | **yes** | — |

`[VERIFIED: .pre-commit-config.yaml read this session]`

**Consequences for the seal commits.** Each seal commit touches `.planning/REQUIREMENTS.md`,
`scripts/revalidation.mjs`, and `tests/architecture/revalidation.test.ts` together. That fires
`npm-lint` (113s), `npm-format-check` (42s), `npm-typecheck` (35s), `npm-fallow` (3.5s),
`prettier`, **and `npm-coverage-direct`**, which runs a focused test per changed pair. The
`revalidation.mjs` ↔ `revalidation.test.ts` pair takes measurably longer than most (that test file
alone runs 18.6s / 136 cases), plus the two pinned pairs the gate measures on every run. **Budget
~4–5 minutes per seal commit for pre-commit alone.**

A `.planning/`-only commit (the closure ledger, the backlog, WINDOWS.md) fires none of the six
npm hooks and none of the markdown hooks — only the whitespace/EOF family. It is cheap.

**There is no pre-commit hook installed in this checkout** (memory: hooks dir has only `post-*` /
`pre-push`), so `pre-commit run --files <files>` must be invoked explicitly before every
`git commit`.

### 7.3 Architecture gates that name `event-router.ts` by path

| gate list | file | what it does with the entry | breaks on the port? |
|-----------|------|------------------------------|---------------------|
| `ZONE_REPRESENTATIVE_TARGETS` | `tests/architecture/gate-targets.ts:257` | ESLint effective-config resolution per zone; "the gate only ever asks the config resolver what rules reach them" | **No** — path only |
| `HOOKS_LIFECYCLE_TARGETS` | `tests/architecture/gate-targets.ts:310` | WR-01/WR-03/D-60-05 prefix agreement between four lifecycle verbs and the router | **Check Block E, below** |
| `UNOWNED_EXPORT_CENSUS` | `tests/architecture/gate-targets.ts:589` | records `["createBeforeAgentStartHandler"]` as event-router's unowned exports | **Only if the port adds a new export with no owner test** |

**`tests/architecture/hooks-lifecycle.test.ts:281` — WR-01 Block E is a source-text gate on the
function whose signature changes:**

```ts
const match = /async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/.exec(raw);
```

`[^{]*` matches the parameter list. **This still matches if the new parameter is annotated with a
named interface type (`reader: HooksReader`). It BREAKS if the parameter is annotated with an
inline object type** (`reader: { readHooksJson: … }`), because the `{` terminates `[^{]*` early and
the captured "body" becomes the type literal. The test then asserts `deleteParsedConfig` appears in
that fragment and fails.

**Planning constraint, stated plainly:** whatever shape D-09-08 lands on, the new parameter on
`hydrateProjectScopeForCwdWith` must use a **named type**, not an inline object type.
`[VERIFIED: tests/architecture/hooks-lifecycle.test.ts:281-317, read this session]`

`tests/architecture/hooks-lifecycle.test.ts:395-408` also builds a `HooksHydrationReader` literal
and calls `createHooksHydration(runtime, reader)` — it grows a member under shape (c).

**`event-router.ts` is NOT in `NETWORK_FREE_TARGETS`**, so
`tests/architecture/no-orchestrator-network.test.ts` does not scan it.
`tests/architecture/import-boundaries.test.ts` covers it only through the zone-representative
config resolution, which is path-based. `[VERIFIED: gate-targets.ts:41-140 read this session]`

### 7.4 `no-test-only-production-surface` will not object — established

See §2.3. The gate matches a `__`-prefixed **member declaration** under `EXTENSION_ROOT_REL`, with
a structural carve-out for `declare const … : unique symbol`. A port member named `readHooksJson`
on an interface named `HooksReader` or `HooksHydrationReader` is outside its pattern entirely.
The gate's own header states the design rationale the port should be written to satisfy:
*"A production interface, type, or options object MUST NOT declare a `__`-prefixed member whose
purpose is to let a test swap the module's collaborators."* A named, documented, production-wired
port is the opposite of that shape — it is what `CONVENTIONS.md` prescribes.

### 7.5 Recommended ordering, with the fail-closed unit for each step

D-09-09 fixes the sequence. This adds the commit boundaries the measurements above imply:

| step | unit of work (one commit each unless noted) | gate that must be green before moving on |
|-----:|---------------------------------------------|------------------------------------------|
| 1 | The port: `event-router.ts` + `bridges/hooks/index.ts` + `index.ts:37,40` + **`tests/index.test.ts:787-793`** + all 171 test call sites + the staleness-case rewrite in `event-router.test.ts` | `npm run typecheck`, `npm run lint`, `npm run fallow`, `node --test tests/bridges/hooks/ tests/architecture/hooks-lifecycle.test.ts tests/index.test.ts`, and `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (4.1s) |
| 2 | Coverage re-measurement (no commit unless the pin moves) | `npm run test:coverage:direct:report` (~487s) → rebuild pin → prettier → `git status --porcelain` on the pin, then `npm run test:coverage:direct:all` (~492s) exit 0 |
| 3 | **Change A**: six IDs × (traceability row + sealed route + checkbox) + `revalidation.test.ts:1219` | `node scripts/revalidation.mjs scope-impact --check` → `Scope impact valid: 40 records.`; `node --test tests/architecture/revalidation.test.ts` → 136/136 |
| 4 | Measure `npm run check` on the change-A tree; record the real output | exit 0, ~246s + whatever step 1 added |
| 5 | **Change B**: two IDs × (traceability row + sealed route + checkbox) + `revalidation.test.ts:1026` | same two gates as step 3 |
| 6 | Window ledger: 4 JSON/frontmatter edits, then `windows fixed 19 / 21 / 22` | each verb exits 0; final `open_count: 19`, `fixed_count: 12` |
| 7 | `09-CLOSURE-LEDGER.md` + `.planning/BACKLOG.md` dispositions + any CONTRIBUTING.md correction | `.planning/`-only; whitespace hooks + `mdformat` for CONTRIBUTING.md |

**Steps 2 and 3 must not overlap.** The sweep measures the `scripts/revalidation.mjs` ↔
`tests/architecture/revalidation.test.ts` pair, and that test reads the live
`.planning/REQUIREMENTS.md` — a half-applied seal during a running sweep reports as a coverage
failure (08-08 recorded this exact hazard).

---

## Runtime State Inventory

This phase edits production code (`event-router.ts`), gate data (`SEALED_REQUIREMENT_ROUTES`), and
planning documents. It is not a rename or migration, but the seal and the ledger are *state* that
lives outside the code, so the inventory is worth answering explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No database, no `state.json` schema change, no on-disk artifact format change. The port changes *how* `hooks.json` is read, not *what* is written. Verified: `git grep` of the phase's target files shows no `schemaVersion` or persisted-shape touch. | none |
| Live service config | **None.** No external service. The `direct-coverage` CI job already exists in `.github/workflows/ci.yml` and needs no GitHub-side change; whether it is a *required* status check is a protected-branch setting outside any tracked file (this is D-09-17's `unresolved` row). | none in-repo; one recorded `unresolved` |
| OS-registered state | **None.** No scheduler, no daemon, no global install. | none |
| Secrets/env vars | **None.** No new env var. `TEST_CONCURRENCY` and `PI_CM_E2E_REF` are unchanged. | none |
| Build artifacts | **None that auto-stale.** No build step exists (`tsc --noEmit`). `coverage/` is gitignored and regenerated by every sweep. | none |
| **Gate-embedded literals** (added category — this repo's real hazard) | **Four.** `tests/architecture/revalidation.test.ts:1219` (`- [ ] **GGAT-03**:`), `:1026` (`\| CLOSE-02 \| Phase 9 \| Pending \|`), `tests/index.test.ts:789` (`createHooksRouting(hooksRuntime)`), `tests/index.test.ts:792` (`createHooksHydration(hooksRuntime, { loadState })`). Each is a source-text or live-file literal that goes stale when this phase's changes land. | edit each in the same commit as its cause |

**The canonical question, answered:** after every file in the repo is updated, what still holds the
old value? Only the four gate-embedded literals above — and they are *inside* the repo, which is
why they are findable. Nothing outside the repo caches anything this phase changes.

---

## Common Pitfalls

### Pitfall 1: Splitting a seal change across commits
**What goes wrong:** The traceability row is edited in one commit and `SEALED_REQUIREMENT_ROUTES`
in the next. The first commit's `scope-impact --check` exits 1.
**Why it happens:** The two carriers live in different directories (`.planning/` and `scripts/`)
and feel like separate concerns.
**How to avoid:** Treat "one ID's status" as one unit of work spanning both files plus the test
literal. Verify with `node scripts/revalidation.mjs scope-impact --check` before running
`pre-commit`.
**Warning signs:** `requirement-route-contract: <ID>: traceability route/status differs from sealed
requirement contract`.

### Pitfall 2: Running `gsd-tools requirements mark-complete` and assuming the seal is done
**What goes wrong:** The verb flips the checkbox and the traceability row, reports success, and
leaves `SEALED_REQUIREMENT_ROUTES` untouched. The gate is red and the verb said nothing about it.
**Why it happens:** The verb is designed around a two-surface model (`milestone.cjs`); this
repository has a third, project-local surface it cannot know about.
**How to avoid:** If you use the verb, hand-edit `scripts/revalidation.mjs` in the same change.
**Warning signs:** as Pitfall 1.

### Pitfall 3: Forgetting the frontmatter counts when hand-editing WINDOWS.md
**What goes wrong:** The table-drift guard passes, then `parseLedger` refuses with
`Ledger counts disagree with entries`.
**Why it happens:** Two independent fail-closed checks; fixing the first reveals the second.
**How to avoid:** Flipping entry 30 to `fixed` means `open_count: 23 → 22` and
`fixed_count: 8 → 9` in the same edit.
**Warning signs:** `Ledger counts disagree with entries: frontmatter open/waived/fixed/total=…
but entries yield …`.

### Pitfall 4: Editing `.planning/` while a coverage sweep is running
**What goes wrong:** The sweep's `scripts/revalidation.mjs` pair runs
`tests/architecture/revalidation.test.ts`, which reads the live `.planning/REQUIREMENTS.md`. A
half-applied seal makes the pair fail and the sweep reports a coverage failure that is not one.
**Why it happens:** The sweep takes ~8 minutes and the temptation is to work in parallel.
**How to avoid:** 08-08's rule verbatim — hold every edit to a measured file until the sweep ends.
**Warning signs:** a sweep failure on `scripts/revalidation.mjs` with no code change to it.

### Pitfall 5: Annotating the new port parameter with an inline object type
**What goes wrong:** `tests/architecture/hooks-lifecycle.test.ts:281`'s regex
`/async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/` binds to the type literal's
brace instead of the function body, and the `deleteParsedConfig` assertion fails.
**How to avoid:** use a named interface type on every signature the gate greps.
**Warning signs:** `WR-01: hydrateProjectScopeForCwdWith must call deleteParsedConfig to drop
phantom entries` on a function that plainly does.

### Pitfall 6: Reporting an inherited sweep figure as a fresh measurement
**What goes wrong:** `CLOSE-01` claims a suite passed on the final tree while the number came from
08-08's run.
**Why it happens:** The two sweeps cost 16 minutes and the numbers are written down already.
**How to avoid:** D-09-10 says it outright — neither is reported from an earlier run. This research
document marks the two sweep costs as **inherited** for exactly this reason; the plan must not
inherit the *result*.

### Pitfall 7: Describing `REASON-01` as fully implemented
**What goes wrong:** The backlog says `implemented` while the `{malformed <feature>}` family the
item asked for was only partly delivered (the terminal cases, via `PDEF-03`/`PDEF-05`).
**How to avoid:** use the house format's "NOT closed by the same change" paragraph. See §5.4.

### Pitfall 8: Writing "phases 86, 88, 115 and 117" in the closure ledger
**What goes wrong:** Phase 116 holds 8 of the 23 open entries — the largest group — and is where
19/21/22 live. Repeating the CONTEXT's list produces a record that is wrong on its face.
**How to avoid:** use §4.6's measured breakdown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recomputing clause signatures | A bespoke normalizer | The exact five-step reproduction in §1.3, verified against all 30 sealed values first | 08-08's method: reproduce known-good input *before* editing, so a normalization mistake surfaces as a mismatch rather than as a sealed wrong answer |
| Regenerating the WINDOWS.md table | A hand-written markdown table | Edit the fenced JSON + frontmatter, then let `gsd-tools windows fixed <id>` regenerate | The drift guard refuses any hand-edited table; `renderTable`'s `cell()` escaping is not obvious to reproduce by hand |
| Producing the coverage pin | A new generator script | `npm run test:coverage:direct:report` → rebuild rows from `accepted-shortfall` → prettier → `git status --porcelain` empty | There is deliberately no writer; the empty `git status` **is** the byte-identity proof |
| Injecting the hooks read | A module-global seam or a `__`-prefixed member | A named interface parameter on both factories | `CONVENTIONS.md` ("Dependency injection over test-only seams") and `no-test-only-production-surface.test.ts` both forbid the alternative |
| Reaching the staleness guard in tests | A counted `currentGeneration()` consultation, a `setImmediate` race, or a FIFO | Advance the generation inside the injected read port | 08-03 built and measured all three alternatives and recorded why each is worse; the port makes the trigger named |
| Closing a backlog item | A new closure format | The strikethrough house format (§5.3) or the `REQUIREMENTS.md` Evidence-and-History register | D-09-15 requires the record and the ledger to use one vocabulary |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), Node **v26.8.2**, npm **11.19.1** |
| Config file | none — the glob lives in `package.json` `scripts.test` |
| Quick run command | `node --test tests/bridges/hooks/event-router.test.ts` (~10s) / `node --test tests/architecture/revalidation.test.ts` (**18.6s measured**, 136 cases) |
| Structural command | `node scripts/revalidation.mjs scope-impact --check` (**0.18s measured**) |
| Full suite command | `npm run check` (**246s measured, exit 0**) + `npm run test:coverage:direct:all` (**~492s, inherited from 08-08**) |
| Unit suite size | **6004 tests / 300 suites**, 0 fail, 0 skipped, 34.2s (measured this session) |
| Integration suite size | **32 tests**, 0 fail, 10.8s (measured this session) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLOSE-01 | The complete suite passes on the final tree | full-suite | `npm run check` | ✅ (measured 246s, exit 0) |
| CLOSE-01 | All 230 pairs pass the strict direct-coverage gate | full-sweep | `npm run test:coverage:direct:all` | ✅ (~492s, must be re-run after step 1) |
| CLOSE-01 | The event-router port keeps its pair complete | unit + coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | ✅ (4.1s; currently `branches 114/114, functions 43/43, lines 967/967`) |
| CLOSE-01 | No static `readFile` remains in `event-router.ts` | structural | `grep -c 'readFile' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` → expect only the comment at ~575 | ✅ (grep) |
| CLOSE-01 | The port survives both complexity gates | structural | `npm run lint` + `npm run fallow` | ✅ (113.4s + 3.5s) |
| CLOSE-01 | The seal's four carriers agree after each change | structural | `node scripts/revalidation.mjs scope-impact --check` → `Scope impact valid: 40 records.` | ✅ (0.18s) |
| CLOSE-01 | The seal's own control suite still passes | unit | `node --test tests/architecture/revalidation.test.ts` → 136/136 | ✅ (18.6s) |
| CLOSE-01 | `index.ts` wiring matches its source-text gate | unit | `node --test tests/index.test.ts` | ✅ |
| CLOSE-02 | The window ledger's verbs are unblocked and 19/21/22 are closed | structural | `node .claude/gsd-core/bin/gsd-tools.cjs windows status --pick ledger.open_count` → `19` | ✅ (proven in scratch this session) |
| CLOSE-02 | The rendered table agrees with the fenced JSON | structural | any `windows` write verb exits 0 (the drift guard is the check) | ✅ |
| CLOSE-02 | Each of the seven backlog items carries a terminal disposition in the one vocabulary | manual-only | read `.planning/BACKLOG.md` against `09-CLOSURE-LEDGER.md`; assert every row's disposition ∈ {`implemented`, `evidence-only`, `superseded`, `deferred`, `unresolved`} | manual — a document-consistency claim no gate in this repo can express |
| CLOSE-02 | No ledger row describes a coverage reading as assertion strength (D-09-18) | manual-only | read every row | manual — a semantic claim about prose |
| CLOSE-02 | The two pin claims are verified, not deferred (D-09-16) | manual-only | §6 of this document is the reading; the ledger records the argument | manual — 08-04's D5 says only a reader can judge a reason |

### Sampling Rate

- **Per task commit:** `node scripts/revalidation.mjs scope-impact --check` (0.18s) for any
  `.planning/`+`scripts/` change; `node scripts/test-coverage-direct.mjs <changed source>` (~4s)
  for any `extensions/` change; `SKIP=trufflehog pre-commit run --files <changed files>` always.
- **Per wave merge:** `npm run typecheck && npm run lint && npm run fallow && npm test`
  (~186s) — the fast four-fifths of `check`.
- **Phase gate:** `npm run check` (246s+) **and** `npm run test:coverage:direct:all` (~492s), both
  measured on the final tree with their real output recorded, before change B lands.

### Wave 0 Gaps

- **None for framework or fixtures** — `node:test` is in place, 6004 unit cases pass, and every
  command above runs today.
- **Four existing test files need edits as part of their causing commit**, not as new
  infrastructure:
  - [ ] `tests/index.test.ts:787-793` — the two `index.ts` source-text regexes (step 1)
  - [ ] `tests/bridges/hooks/event-router.test.ts:1917` — the staleness case rewrite (step 1)
  - [ ] `tests/architecture/hooks-lifecycle.test.ts:395-408` — the `HooksHydrationReader` literal (step 1)
  - [ ] `tests/architecture/revalidation.test.ts:1219` (step 3) and `:1026` (step 5)
- **One new artifact:** `.planning/phases/09-final-quality-and-backlog-closure/09-CLOSURE-LEDGER.md`.
  It is a planning document, not code, and needs no owner test — but note that
  `npm run test:corresponding` would demand one for any **new `.ts` module**, so if the planner
  creates a port module under `extensions/`, it needs a paired
  `tests/bridges/hooks/<name>.test.ts`. §2.6 option 1 (no new module) avoids this entirely.

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase touches no auth path. `GAUTH-01` is explicitly *deferred*, not implemented (§5.2). |
| V3 Session Management | no | No session concept in this extension. |
| V4 Access Control | no | No multi-user surface. |
| V5 Input Validation | **yes, indirectly** | The port must not weaken the containment check. `tryHydrateOnePlugin` calls `assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path")` **before** the read (NFR-10 defense-in-depth against a traversal slug in a corrupted `state.json`). The injected read port must stay **after** that guard, so the guard remains the chokepoint. |
| V6 Cryptography | no | The only hash is SHA-256 over document text for the seal — an integrity marker over non-secret data, not a security control. |
| V12 File Handling | **yes** | The port relocates a `readFile`. `shared/path-safety.ts::assertPathInside` is the single containment chokepoint (NFR-10) and must not be bypassed. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Traversal slug in `state.json` `resources.hooks[i]` escaping `loc.hooksDir` | Tampering / Elevation | `assertPathInside` at the READ site, mirroring the WRITE-site guard — **already present at `event-router.ts:577`; the port must not move the read above it** |
| A read port whose implementation ignores the containment argument | Tampering | The port takes an already-validated absolute path; containment stays in the caller, not the port. Do not give the port a "resolve this relative path" responsibility. |
| Corrupted `resolvedSource` reaching `CLAUDE_PLUGIN_ROOT` | Tampering | `asAbsolutePluginRoot` brand validation at the hydrate boundary — unchanged by this phase |
| A pin that excuses a genuinely reachable arm | Repudiation (of a security guard) | §6 is the check; `install-outcome.ts:818` is a *defense-in-depth re-parse* whose pin reason must stay accurate or the guard is silently excused |

**The one real security-adjacent obligation:** the port must preserve the ordering
`assertPathInside` → `generationIsCurrent` → `asAbsolutePluginRoot` → **read**. Moving the read
earlier to simplify the injection would defeat NFR-10's READ-site mirror. Verify by reading
`event-router.ts:560-620` after the change.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.2 (engines floor `>=20.19.0`) | — |
| npm | all scripts | ✓ | 11.19.1 | — |
| `node scripts/revalidation.mjs` | the seal gate | ✓ | in-repo, 2660 lines | — |
| `gsd-tools.cjs` | the `windows` verbs | ✓ | `.claude/gsd-core/bin/gsd-tools.cjs`, in-repo | — |
| `fallow` | `npm run fallow` | ✓ | 3.20.0 (devDep floor `^3.17.0`) | — |
| `eslint` / `typescript` / `prettier` | `npm run check` | ✓ | 10.x / 6.x / 3.x | — |
| `pre-commit` | the commit gate | ✓ | config present; **no hook installed in this checkout** | run `pre-commit run --files …` manually |
| `trufflehog` | the secret-scan hook | **✗ in this worktree** | — | `SKIP=trufflehog`; only CI closes this hole |
| `python3` | none of the phase's own commands | ✓ | used only for this research's diffing | — |
| `pi-subagents` (global peer) | two integration tests | ✓ | current — 32/32 integration tests pass here | tests skip in CI when absent |
| GitHub Actions | proving the `direct-coverage` job | **✗ locally** | — | **none** — this is D-09-17's `unresolved` row |

**Missing dependencies with no fallback:**
- GitHub-side execution of the `direct-coverage` job. Its `pull_request` arm — the `fetch-depth: 0`
  behavior, whether `refs/remotes/origin/main` exists, and whether the job is a *required* status
  check — cannot be observed outside Actions. D-09-17 is correct and the row must stay `unresolved`.

**Missing dependencies with fallback:**
- `trufflehog` — structurally impossible in a linked worktree (it reads `<root>/.git/index`, and
  `.git` is a file here). `SKIP=trufflehog` is the sanctioned route; CI runs the full
  `.pre-commit-config.yaml` via `pre-commit/action@v3.0.1` in `lint.yml`.

---

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package. `package.json` `dependencies` and
`devDependencies` are unchanged by every decision in `09-CONTEXT.md`; the only code change
(D-09-05) moves an existing `node:fs/promises` call behind an in-repo interface. No `npm install`
appears anywhere in this plan.

`[VERIFIED: read package.json this session; no decision in 09-CONTEXT.md names a dependency]`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The two inherited sweep figures (486.9s report, 492.4s strict, 230 pairs) still hold on this tree. They were measured by 08-08 at a head that has since gained 08-09's commits. | §3.2 | Low — the plan re-runs both for real in step 2, which is where the real number comes from. Only the *budget* would be wrong. |
| A2 | `TESTQ-01`'s terminal route is "the entire milestone." No single artifact states this in one place; it is assembled from the item's own five-workstream list mapped onto the requirement IDs, plus `01-67-SUMMARY.md:128`'s "retain exact routes through their terminal findings." | §5.1 | Medium — if the operator expects a narrower route (e.g. only `GGAT-*` + `RCOV-*`), the backlog wording would overstate. **Worth a confirmation checkpoint before writing the disposition.** |
| A3 | `FLOW-09`'s terminal route is `TREF-05` + `TREF-06` + the `GGAT-04` gate. Derived from clause text, not from a record that names `FLOW-09` against a requirement ID. | §5.1 | Medium — same shape as A2. The clause match is strong (`TREF-06` names "test-only exports, reset hooks" almost verbatim), but it is inference. |
| A4 | `REASON-01`'s terminal route is `PDEF-03` + `PDEF-05`, delivered *narrower* than the item asked for. | §5.1, §5.4 | Medium — if the milestone actually delivered the full `{malformed <feature>}` family, the "NOT closed by the same change" paragraph would be wrong in the other direction. A planner task should grep `shared/notification-types.ts` for a `malformed` token family to settle it. |
| A5 | Shape (c) — one merged `HooksReader` — is the right answer for D-09-08. The CONTEXT explicitly delegates this; the recommendation rests on the 05-06 required-injection precedent and on "one port" being the literal reading of D-09-05. | §2.3 | Low — all three shapes satisfy the locked invariant; the cost difference between (b) and (c) is presentational. |
| A6 | Setting entry 30's `resolved_at` to `2026-09-04T01:03:42.619Z` rather than leaving it null is the more honest choice. | §4.4 | Low — both pass every gate. |
| A7 | `fallow`'s `maxUnitSize: 60` does not fire on a 103-line function, so unit size is not a binding gate. Inferred from `functions_above_threshold: 0` alongside a measured 103-line function; fallow's counting method was not read. | §2.7 | Low — `npm run fallow` is measured green today with that function present, which is the operative fact regardless of the metric's definition. |
| A8 | No pre-commit hook is installed in this checkout, so hooks must be invoked manually. Carried from operator memory, not re-verified by inspecting `.git/hooks` this session. | §7.2 | Low — invoking `pre-commit run --files` explicitly is correct whether or not a hook exists. |

---

## Open Questions

1. **Does the milestone's `{malformed …}` work actually constitute `REASON-01`'s family, or only
   its two terminal cases?**
   - What we know: `PDEF-03` and `PDEF-05` cover the terminal malformed-input cases and
     `02-01-SUMMARY.md` provides "the locked malformed-input contract."
   - What's unclear: whether `narrowResolverNotes` was re-audited and both mislabeled cases
     rerouted, which is what `REASON-01` asked for.
   - Recommendation: one grep task in the plan —
     `grep -rn "malformed" extensions/pi-claude-marketplace/shared/notification-types.ts` plus the
     two named cases — settles it in under a minute and makes the backlog wording defensible
     either way. Do not write the disposition before running it.

2. **Which of the three interface shapes does the planner pick, and does the plan state the
   tradeoff it accepts?**
   - What we know: all three satisfy D-09-05; §2.3 recommends (c).
   - What's unclear: whether giving `createHooksRouting` a reader carrying `loadState` (which it
     never calls) reads as deliberate or as over-wide.
   - Recommendation: whichever is chosen, the plan should record the rejected shapes and why —
     D-09-08 says the shape "must read as deliberate design," and a decision with no recorded
     alternative does not.

3. **Is `CONTRIBUTING.md` genuinely already correct, or does the phase's own work stale a row?**
   - What we know: the "not wired yet" sentence is gone; both gates exist; the pin table matches
     the pin's two rows today.
   - What's unclear: whether step 2's re-measurement moves either pinned reading.
   - Recommendation: make this a *conditional* task — re-read after step 2 and correct only what
     moved. Record "re-read, no diff" if nothing did.

4. **Does the operator want entry 9's `open` status preserved?**
   - What we know: its own text says *"This entry stays `open` deliberately, as the durable record
     of the residual risk rather than as a pending action."*
   - What's unclear: nothing, really — but the ledger row for it should say `unresolved`
     (deliberately retained), not `deferred`, and the plan should not accidentally close it while
     repairing its description.
   - Recommendation: the repair task edits entry 9's `description` **only**; its `status` stays
     `open`.

---

## Sources

### Primary (HIGH confidence — read or executed this session)

- `scripts/revalidation.mjs` (lines 1-120, 2033-2360, 2480-2660) — the seal's implementation
- `.planning/REQUIREMENTS.md` — all 30 clauses, the traceability table, Evidence and History
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — 40 scope-change records
- `tests/architecture/revalidation.test.ts` (lines 250-340, 1018-1270) — the live-tree fixture and
  the two cases that break
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` — full module
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts`, `extensions/pi-claude-marketplace/index.ts`
- `tests/index.test.ts` (lines 760-815) — the `index.ts` source-text gate
- `tests/bridges/hooks/event-router.test.ts` (lines 1882-1985) — the staleness case + sibling control
- `tests/architecture/hooks-lifecycle.test.ts` (lines 270-320, 390-430) — WR-01 Block E
- `tests/architecture/gate-targets.ts` (lines 41-140, 250-320, 560-600) — the named-file gate lists
- `tests/architecture/no-test-only-production-surface.test.ts` (header + pattern constants)
- `.planning/WINDOWS.md` — frontmatter, 31-row table, 31-entry fenced JSON
- `.claude/gsd-core/bin/lib/broken-windows.cjs` (lines 285-890) — drift guard, `renderTable`,
  `writeLedgerAtomic`
- `.claude/gsd-core/bin/lib/milestone.cjs` (lines 76-245) — `mark-complete`'s two surfaces
- `.planning/BACKLOG.md` — the seven named entries and the closed-entry house formats
- `CONTRIBUTING.md` (lines 29-95), `.pre-commit-config.yaml`, `.github/workflows/ci.yml`,
  `package.json`, `.planning/config.json`
- `scripts/test-coverage-direct.pin.json`, `scripts/test-coverage-direct.pin.mjs`,
  `scripts/test-coverage-direct.mjs`
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts`,
  `extensions/pi-claude-marketplace/shared/errors-bridges.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`,
  `extensions/pi-claude-marketplace/domain/manifest.ts`,
  `extensions/pi-claude-marketplace/domain/manifest-cache.ts`,
  `extensions/pi-claude-marketplace/domain/components/plugin.ts`,
  `extensions/pi-claude-marketplace/domain/components/hooks.ts`,
  `extensions/pi-claude-marketplace/domain/hooks-resolution.ts`

**Commands executed this session (all measured, none estimated):**
`node scripts/revalidation.mjs scope-impact --check` (baseline + 6 planted variants);
`node --test tests/architecture/revalidation.test.ts` (3 tree states);
`npm run {typecheck,lint,fallow,format:check,test:corresponding,test:corresponding:negative,test:coverage:direct:negative,test,test:integration}`;
`node scripts/test-coverage-direct.mjs <event-router>`;
`npx eslint … --rule '{"sonarjs/cognitive-complexity":["error",1]}'` and
`--rule '{"max-lines-per-function":…}'`; `npx fallow health --format json`;
`npx fallow inspect --file event-router.ts`;
`gsd-tools windows status` / `windows fixed 19|21|22 --project-dir <scratch>`;
`gsd-tools query init.phase-op 9`; `gsd-tools workstream get`.

### Secondary (MEDIUM confidence — phase artifacts, cited not re-measured)

- `.planning/phases/08-direct-coverage/08-03-SUMMARY.md` — the alternatives measured for the
  staleness case, the four guard sites, and why a counted trigger was left in
- `.planning/phases/08-direct-coverage/08-04-SUMMARY.md` — deliverable D5, the standing caveat
- `.planning/phases/08-direct-coverage/08-08-SUMMARY.md` — the pin-regeneration method, the
  three-carrier re-seal, the two sweep timings (**inherited figures**)
- `.planning/phases/08-direct-coverage/08-09-SUMMARY.md` — the `RCOV-03` planting proof
- `.planning/phases/01-live-evidence-revalidation/01-67-SUMMARY.md` / `01-68-SUMMARY.md` — the
  backlog routing decisions
- `.planning/phases/05-injection-and-ownership-design/05-06-SUMMARY.md:113` — the
  required-injection precedent for `createHooksRouting`
- `.planning/phases/07-gate-integrity/07-16-SUMMARY.md:327` — `FLOW-07`'s satisfaction row
- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Tertiary (LOW confidence)

None. No claim in this document rests on a web search, on training knowledge, or on an unverified
recollection. Where a fact could not be established without an expensive run, it is labelled
**inherited** and its source named (§3.2).

---

## Metadata

**Confidence breakdown:**

- **Seal mechanics: HIGH** — six planted experiments, two of them repeated on the real tree with
  before/after test counts and a verified-clean revert.
- **Event-router port: HIGH** for the mechanics (sites, chains, call-site counts, gate membership,
  complexity readings — all measured); **MEDIUM** for the interface-shape recommendation, which is
  explicitly delegated to planning and argued from precedent rather than measured.
- **Coverage: HIGH** for commands, gate wiring, pin contents and the one-pair cost;
  **MEDIUM** for the two sweep durations, which are inherited from 08-08 and labelled as such.
- **Window ledger: HIGH** — the full repair was executed end to end in a scratch copy, including
  the second fail-closed check the CONTEXT does not mention, with a post-repair field-by-field
  re-diff showing zero mismatches.
- **Backlog dispositions: MEDIUM** — `COV-01`, `AGCOL-01` and `GAUTH-01` have explicit written
  dispositions in `REQUIREMENTS.md` and `01-67-SUMMARY.md` (HIGH); `TESTQ-01`, `FLOW-09` and
  `REASON-01` route through clause-text inference (A2/A3/A4 in the Assumptions Log).
- **Pin claims: HIGH** — all three arguments traced to source, two strengthened beyond what the
  pin's text states, one residual (the cache's by-reference contract) named that the pin omits.
- **Gate and ordering facts: HIGH** — every timing measured individually today.

**Corrections to the CONTEXT surfaced by this research** (each is a finding, not a quibble):

1. D-09-03's carrier 4 (the clause signature) is **not disturbed** by a status flip; carrier 1
   (the checkbox) is **not read** by the gate at all. Two carriers are enforced, not four. (§1.3)
2. A carrier the CONTEXT does not name: **two live cases in
   `tests/architecture/revalidation.test.ts`** break, one per change. (§1.4)
3. A second carrier the CONTEXT does not name: **`tests/index.test.ts`** asserts `index.ts`'s
   literal construction text for both hooks factories. (§2.5)
4. The window repair needs a **fourth edit** — the frontmatter counts — behind a second
   fail-closed check. (§4.3)
5. `CONTRIBUTING.md`'s "not wired yet" tense **was already corrected** by 08-09/08-fix; there is
   nothing to fix there unless step 2 moves a pinned reading. (§3.5)
6. The open-window breakdown is **86, 88, 115, 116, 117** — phase 116 holds the largest group (8)
   and is where entries 19/21/22 live. (§4.6)
7. `windows status` is **not** blocked by the drift guard; only the write verbs are. (§4.2)
8. `RCOV-02`'s clause names `event-router.ts` at `branches 107/111, lines 959/967`, but the module
   reads **`branches 114/114, functions 43/43, lines 967/967`** today — the clause text preserves
   the before-reading by design, and the phase must not "correct" it (that would break the sealed
   signature). (§2.9)

**Research date:** 2026-09-11
**Valid until:** 2026-10-11 for the mechanics; **invalidated immediately by any commit to
`.planning/REQUIREMENTS.md`, `scripts/revalidation.mjs`, `.planning/WINDOWS.md`, or
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`** — every measurement above is a
statement about this exact tree (`state_head: f79839f3`).
</content>
</invoke>
