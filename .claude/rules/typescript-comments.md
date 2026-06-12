---
paths:
  - "**/*.ts"
---

# TypeScript comment policy

Comments and test/describe titles describe **what the code does** and, when
non-obvious, **why**. They do not record which GSD milestone, phase, plan,
wave, or task produced the code. Git history owns process history.

## Forbidden in comments and test titles

- `Phase NN`, `Plan NN`, `Plan NN-NN`, `Wave N`, `Task N` references to
  GSD planning steps.
- `milestone vX.Y`, `vX.Y milestone`, and UAT-decision parentheticals such as
  `(v1.12 milestone UAT decision 2026-06-11)`.
- Parentheticals like `(Phase 56 review)`, `(Phase 54 frozen)`,
  `(Phase 55 Plan 01)`.
- Bare `Pitfall N` and `Pattern N` references (where N is a single digit)
  that cite per-phase RESEARCH.md numbered hazard lists. Per-phase numbering
  restarts per RESEARCH document, so the same `Pitfall N` token means
  different things in different files, the earliest source docs no longer
  exist, and the underlying hazards are gate-enforced by tests. Drop the
  token and let the surrounding comment's rationale (or surviving
  requirement/decision IDs) carry the anchor. Phase-qualified forms
  (`Pitfall NN-N`, `RESEARCH Pitfall N`) are already covered by the
  planning-artifact clause above.
- Any other phrasing whose only purpose is to record which planning artefact
  authored the line.

## Allowed (and encouraged) as traceability anchors

- Decision IDs: `D-01`, `D-21`, `D-54-01`, `D-15-11`, `D-17.1-01`, etc.
- Requirement and finding IDs: `PRL-NN`, `AUTH-NN`, `DIFF-NN`, `ATTR-NN`,
  `RECON-NN`, `ENBL-NN`, `SPLIT-NN`, `WR-NN`, `CR-NN`, `UAT-NN`, `SNM-NN`,
  `TYPE-NN`, `SC-N`, `NFR-N`, `Mxx` matrix IDs.
- GitHub issue/PR references like `#2916`.

These anchors link the code to a specification row, not to a planning step.

## Domain language is not GSD history

Words like `phase` that name domain concepts in the code itself are
**not** GSD references and must be preserved unchanged. Examples:

- The two-phase commit narration in `bridges/agents/stage.ts`
  (`Phase 2: remove old target files ...`).
- The `phase ledger` transaction concept and any body text under
  `tests/transaction/phase-ledger.test.ts` that talks about the ledger's
  own phases (e.g. `4 phases, phase 3 throws`).
- Fixture strings such as `plugin update phase 3 failed`.
- Version pins inside URLs such as `#v1.0`.

## Examples

Forbidden -> Allowed:

```text
// Phase 56 Plan 01 Task 2 -- shared edge-handler helpers ...
```

becomes

```text
// Shared edge-handler helpers ...
```

```text
// WB-01 / Phase 56 Plan 02: extract `--local` BEFORE positional parsing
```

becomes

```text
// WB-01: extract `--local` BEFORE positional parsing
```

```text
test("Phase 8 / PRL-10 replacePreparedSkills can rollback ...", ...)
```

becomes

```text
test("PRL-10 replacePreparedSkills can rollback ...", ...)
```

Forbidden -> Allowed:

```text
// WB-01 / Pitfall 2: target-path selection happens ONCE
```

becomes

```text
// WB-01: target-path selection happens ONCE
```

```text
test("Pitfall 9 loadState on missing state.json returns DEFAULT_STATE", ...)
```

becomes

```text
test("loadState on missing state.json returns DEFAULT_STATE", ...)
```
