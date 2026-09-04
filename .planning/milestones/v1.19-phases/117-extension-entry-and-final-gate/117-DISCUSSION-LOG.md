# Phase 117: Extension Entry and Final Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 117-extension-entry-and-final-gate
**Areas discussed:** Orphan test disposition, All-pair coverage run, Gate strengthening scope,
Phase-boundary sweeps, tests/helpers dissolution, Cross-tier helper placement

---

## Orphan Test Disposition

The correspondence gate was run before the question was asked. It reported 8 violations:
`missing-test: tests/index.test.ts` plus 7 `unexpected-test` rows. SUITE-04 bars restoring an
exemption-list mechanism, which removed the most obvious option before the question was put.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold by subject, relocate the rest | Per-file decision: fold each supplement into the mirrored owner of the module it measures; relocate only genuinely cross-module ones to `tests/architecture/`, which the gate already exempts by root | ✓ |
| Relocate all seven to `tests/architecture/` | Mechanical `git mv` of every orphan under the exempt root; cheapest, but miscategorizes single-module supplements and leaves both `index.ts` proxies alive beside their new owner with casts intact | |
| Fold all seven, delete what has no owner | Maximum consolidation; discards cross-module parity proofs that exist precisely because no single owner sees the seam | |
| Teach the gate to recognize supplements structurally | Extend `supplementalCompanions` with a second structural rule; keeps files in place but grows gate complexity and edges toward the barred exemption mechanism | |

**User's choice:** Fold by subject, relocate the rest.

**Notes:** Four fold (`shared/index-smoke` and `edge/index-handler` → `tests/index.test.ts` with the
7 banned casts dropped; `shared/device-flow-prompt` → `tests/domain/github-auth.test.ts`;
`orchestrators/marketplace/cascade` → `.../marketplace/shared.test.ts`). Three relocate
(`cross-surface-reason-parity`, `integration-materialization-gate`, `helpers/source-scan`).

---

## All-Pair Coverage Run

A blocker recorded before phase 116 began required the Node 24 all-pair duration to be measured
before concurrency was added. `test:coverage:direct:all` spawns 204 sequential `node --test`
subprocesses.

| Option | Description | Selected |
|--------|-------------|----------|
| Measure first, then decide | Time the full sequential run on Node 24, record the number read from the runner, and make concurrency a follow-on decision against that measurement | ✓ |
| Measure, then parallelize unconditionally | Add worker concurrency regardless of the result so the gate can live in CI; costs a failure-reporting design and a control proving a failing pair is still caught | |
| Keep sequential, do not add concurrency | Record the duration but leave the runner deterministic; the gate stays an on-demand phase and milestone command | |

**User's choice:** Measure first, then decide.

**Notes:** The measurement must be read from the runner, never computed from a delta — this
milestone already propagated a wrong suite total through four dispatches by arithmetic. If
concurrency is added it ships with a negative control proving a planted failing pair still fails
when runs interleave.

---

## Gate Strengthening Scope

Success criterion 2 requires the gate to reject ambiguous and proxy-owned tests. The gate today
detects only `missing-test`, `wrong-import` and `unexpected-test`.

| Option | Description | Selected |
|--------|-------------|----------|
| Add proxy-owned + ambiguous detection | OWN-02 and COV-02 are named requirements of this phase with no other owner; each new check gets a COV-04 control that plants the violation | ✓ |
| Add the unused-type-member gate | The pending todo, whose own frontmatter reads `resolves_phase: 117`; new compiler-API tooling plus its own control | |
| Audit every existing gate's negative control | COV-04 read at its widest — walk every structural gate in the repo and confirm or add a planting control | |
| Only what SUITE-05/SUITE-06 need to pass | Build no new detection; report the ambiguous/proxy-owned criteria as inherited-but-unbuilt | |

**User's choice:** Add proxy-owned + ambiguous detection (only).

**Notes:** Multi-select question; the other three were left unselected, so the unused-type-member
gate and the repo-wide control audit are both out of scope and recorded as deferred.

---

## Phase-Boundary Sweeps

Phase 117 is the last phase and inherits every deferred sweep.

| Option | Description | Selected |
|--------|-------------|----------|
| Pair total + MOD-10 + REQUIREMENTS status | Sweep 203/204 → 204/204 in ROADMAP and STATE, close MOD-10, fix the REQUIREMENTS.md drift (MOD-07 stale `Pending`; ~115 Status rows lapsed since Phase 110) | ✓ |
| Open a comment-only production licence | Fix WINDOWS entry 20's two `edge/register.ts` comments and the two stale `data.ts` comments, all provably wrong | |
| Decide the tool parameter descriptions | Resolve the `available` / `unavailable` wording that admits an unmentioned bucket after D-116-15's CR-01 fix | |
| Leave sweeps to the milestone audit | Phase 117 builds and proves only | |

**User's choice:** Pair total + MOD-10 + REQUIREMENTS status (only).

**Notes:** No production licence opened, so the stale `register.ts` and `data.ts` comments and the
`BOOLEAN_FLAGS` re-export are recorded as findings rather than fixed. The tool parameter-description
decision stays open for the operator and was rated one-way in CONTEXT.md — it is a published tool
contract and a pinned registration schema, so a later revert is a second contract change.

---

## tests/helpers Dissolution

Raised as a consequence of relocating `helpers/source-scan.test.ts`: SUITE-02 bars a generic test
support directory, and `tests/helpers/` is one.

| Option | Description | Selected |
|--------|-------------|----------|
| Record it, do not dissolve | Relocate the orphan test only, leave the four support modules, file `tests/helpers/` as an argued SUITE-02 shortfall | |
| Dissolve it in this phase | Move each support module beside the concern it serves and update every importer, so SUITE-02 passes for real | ✓ |
| Dissolve only the single-consumer helpers | Partial compliance; leave `notification-boundary.ts` and file the remainder | |

**User's choice:** Dissolve it in this phase.

**Notes:** Cost was measured after the choice rather than estimated before it — 48 import lines
across roughly 45 files. Two modules had an unambiguous home and two did not, which is what raised
the follow-up below.

---

## Cross-Tier Helper Placement

Consumer counts measured by grep on 2026-09-03: `source-scan.ts` 5 (all `tests/architecture/`),
`ipc-child.ts` 2 (all `tests/integration/`), `marketplace-seed.ts` 15 (13 edge, 2 orchestrators),
`notification-boundary.ts` 26 (22 edge, 4 orchestrators).

| Option | Description | Selected |
|--------|-------------|----------|
| Dominant tier, minority reaches across | `notification-boundary.ts` → `tests/edge/`, `marketplace-seed.ts` → `tests/edge/handlers/`; the 6 orchestrator suites import across the tier boundary | ✓ |
| Split per tier, duplicate the seam | Fully local, but two copies of a helper ~20 phase-116 proofs depend on is the drift this milestone exists to remove, and `fallow dupes` runs at threshold 3 | |
| Move the two clean ones, file the two cross-tier | Smaller blast radius; SUITE-02 reported short with a reason | |
| Promote both to a named concern directory | e.g. `tests/boundary/` and `tests/seed/`; satisfies the letter of SUITE-02's naming objection but perhaps not its intent | |

**User's choice:** Dominant tier, minority reaches across.

**Notes:** The 6 surviving cross-tier imports are accepted and named explicitly in CONTEXT.md rather
than left to be rediscovered. `.fallowrc.json`'s zone rules govern `extensions/`, not `tests/`, so
they break no configured boundary.

---

## Claude's Discretion

- Internal structure of `tests/index.test.ts` — case decomposition, fixture shape, and how the two
  folded suites' cases are merged or dropped as redundant.
- Which script hosts the ambiguous and proxy-owned checks, provided each lands where its requirement
  points (OWN-02 is a correspondence property, COV-02 a focused-command property).
- Plan and task decomposition, wave ordering, commit granularity, subject to DEL-01.
- Ordering of the four workstreams, except that the inventory sweep runs last because it records
  measured outcomes.

## Deferred Ideas

- A gate for unused type members — reviewed, not folded. Measured 2026-09-02: typecheck, lint and
  fallow all pass with a planted unused `EdgeDeps` member. Stays in STATE.md Deferred Items for
  v1.19 milestone triage.
- `BOOLEAN_FLAGS` re-exported from `edge/handlers/plugin/list.ts` for one architecture test —
  blocked by the no-production-licence decision.
- The tool `available` / `unavailable` parameter descriptions — open operator decision.
- A repo-wide audit of every structural gate's negative control — out of scope; the new checks carry
  their own.

## Measurements taken during this discussion

Recorded so no later agent re-derives them.

- `npm run test:corresponding` → 8 violations (1 missing-test, 7 unexpected-test).
- Production module count under `extensions/pi-claude-marketplace/` → exactly 204.
- `tests/**/*.test.ts` count → 268.
- Helper consumer counts → 5 / 2 / 15 / 26 as tabled above.
- `node --test` with a brace glob naming a missing directory → exit 0, remaining directories run
  (probed on a scratch tree: `tests/{alpha,ghost}/**/*.test.ts` reported `pass 1`). Deleting
  `tests/helpers/` therefore breaks neither `npm test` nor `npm run test:coverage:unit`.
