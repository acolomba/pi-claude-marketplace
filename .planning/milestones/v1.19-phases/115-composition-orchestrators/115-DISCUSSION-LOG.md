# Phase 115: Composition Orchestrators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 115-composition-orchestrators
**Areas discussed:** Import barrel contract, Composition depth, Supplemental disposition, Failure-isolation depth

______________________________________________________________________

## Import barrel contract

The first framing of this question was withdrawn. It offered "keep all nine bindings and
delete the suppressions" as the recommended option, on the reasoning that a new owner
test would make the exports reachable because `.fallowrc.json` sets `production: false`.
The operator asked what the answer becomes once `production` is set to `true`, which they
intend to do. A probe run of `fallow dead-code --production` then showed that reasoning
does not survive the flip, and the options were rebuilt.

**Probe evidence:** under `--production`, `orchestrators/import/index.ts` is reported as
an unused FILE, and all eight of its `fallow-ignore` markers are simultaneously reported
as STALE suppressions, because once the file is unreachable fallow stops evaluating its
individual exports. The barrel has zero production importers today: production reaches
`importClaudeSettings` directly from `execute.ts`, and the only importer of `index.ts`
anywhere in the repository is `tests/orchestrators/import/execute.test.ts`.

| Option | Description | Selected |
|--------|-------------|----------|
| Route production through it, prune to what it uses | Repoint `edge/handlers/plugin/import.ts` to import from `./index.ts`; prune the barrel to what production consumes; delete all eight markers. Clean under both `production: false` and `production: true`. | ✓ |
| Keep all nine, delete the markers, accept `unused-file` later | Prove all nine re-export the exact identities, delete the stale markers, leave the barrel as a facade with no production consumer. Contributes one `unused-file` finding after the flip. | |
| Delete the barrel entirely | Cleanest under both settings, but removes P115-03 from the roadmap and drops the accepted baseline from 204 to 203 modules, changing MOD-08 and the plan list. | |

**User's choice:** Route production through it, prune to what it uses.
**Notes:** The operator's stated intent to eventually set `production: true` is what
decided this. Pruning alone was shown not to help — a one-line barrel is still
unreachable — so only a real production import clears the finding. Recorded as D-115-01,
with the consequential owner-test repoint recorded as D-115-02.

______________________________________________________________________

## Composition depth

**Measured evidence:** each of the seven existing owner suites runs in under four seconds
(`apply` 3.76s, `backfill` 3.79s, `execute` 3.13s, `edge-deps` 2.96s, `bootstrap` 2.90s,
`pending` 2.78s, `notify` 2.71s), so the speed tradeoff that motivated the question does
not exist. The real asymmetry found: `import/execute.ts` carries a four-collaborator
`ImportDeps` seam that production never populates, plus the only `c8 ignore` pragma in
the entire `extensions/` tree; `reconcile/apply.ts` carries no seam at all and its owner
drives the real composed lifecycle.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-module by contract, kill the pragma | Inject where the contract is aggregating collaborator outcomes; drive real where the contract is the on-disk result; add no-deps cases so the pragma is deleted; add no new production seams. | ✓ |
| Unify on real composition everywhere | Drop `ImportDeps` as the primary mechanism. Most honest end-to-end proof, but import's failure matrix would have to re-provoke Phase 114 ground. | |
| Unify on injected seams everywhere | Give bootstrap, apply, backfill, and pending the same seam. Fast and exhaustive, but adds test-only surface to four production modules, which D-05 forbids. | |

**User's choice:** Per-module by contract, kill the pragma.
**Notes:** Recorded as D-115-03 (per-module double strategy) and D-115-04 (delete the
`c8 ignore` at `import/execute.ts:214` by proving the production default path).

______________________________________________________________________

## Supplemental disposition

**Gate evidence:** `scripts/check-corresponding-tests.mjs` currently fails with 18
violations. Four fall inside Phase 115's directories; the rest belong to Phases 116 and
117.

| Option | Description | Selected |
|--------|-------------|----------|
| Absorb one, move one to integration | `notify-projection-edge.test.ts` is single-owner evidence for `reconcile/notify.ts`, so D-20 absorbs it. `plan-convergence.test.ts` spans four modules across two layers, so D-21 moves it to `tests/integration/` intact. | ✓ |
| Absorb both into owners | Fewest files, but no single owner honestly owns the cross-layer fixed-point identity. | |
| Move both to `tests/integration/` | Zero absorption work, but parks two `reconcile/notify.ts` branches outside direct coverage so P115-07 could not reach 100 percent alone. | |

**User's choice:** Absorb one, move one to integration.
**Notes:** Recorded as D-115-05 and D-115-06. No correspondence-gate exception is added.

______________________________________________________________________

## Failure-isolation depth

**Counted evidence:** 23 distinct public outcomes across the two composition
orchestrators — 15 `kind` values emitted by `reconcile/apply.ts` and eight outcome
interfaces exported by `import/execute.ts`.

| Option | Description | Selected |
|--------|-------------|----------|
| Outcome-complete plus first/middle continuation | All 23 outcome kinds, each asserting the complete aggregated result, plus continuation proven at the two positions that can differ. Recommended. | |
| Outcome-complete plus a single mid-list continuation | Smallest satisfying set, but leaves the first-entry early-abort case unproven. | |
| Exhaustive entry-kind by failure-mode matrix | Every action bucket crossed with every failure cause. Maximum confidence; combinatorial, and risks duplicating Phase 114 ground. | ✓ |

**User's choice:** Exhaustive entry-kind by failure-mode matrix — chosen against the
recommendation.
**Notes:** The recommendation had been the outcome-complete option, on the grounds that
the exhaustive matrix collides with D-20 and D-22. The operator chose the exhaustive
matrix anyway. To keep that decision executable, the boundary was stated back and
recorded as D-115-08: the matrix varies the COMPOSITION's inputs — which fault each entry
hits and which outcome each collaborator returns — and asserts the aggregated public
reporting. It does not re-derive why a lifecycle workflow failed internally, which stays
Phase 114's. The operator did not object to that reading. D-115-09 additionally requires
continuation to hold for a failing first entry and a failing middle entry.

______________________________________________________________________

## Claude's Discretion

- Case names, concern-local factories, and exact fixture shapes.
- Whether the pruned barrel uses named re-exports or a combined export statement.
- Plan waves and dependencies among the eight pairs.
- The final integration filename for the relocated `plan-convergence` flow.

## Deferred Ideas

- Flipping `.fallowrc.json` `production` to `true` and resolving the resulting 81
  unused-export findings — the operator's own effort, out of scope here.
- `transaction/rollback.ts`, the second file a production probe reports unreachable.
- The remaining `check-corresponding-tests` violations owned by Phases 116 and 117,
  including the two Phase 114 left in `tests/orchestrators/`.
- How `edge-deps.ts` proves its contract as a pure wiring module — raised in the closing
  prompt but not discussed.
