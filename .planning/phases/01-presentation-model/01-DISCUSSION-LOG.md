# Phase 1: Presentation Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 01-presentation-model
**Areas discussed:** Wire-corpus baseline, Probe snapshot plumbing, Model shape, Phase 1/2 seam

---

## Wire-corpus baseline

**Capture mechanism**

| Option | Description | Selected |
|--------|-------------|----------|
| Committed loader-hook tool | scripts/ tool; Node --import hook rewrites every `X.ui.notify(` in extensions/** into a recorder; survives file splits; removed at milestone close | ✓ |
| Throwaway branch instrumentation | Never-merged commit wrapping ctx.ui.notify; re-applied 7 times against a file Phases 1–3 rewrite | |
| Record in shared test fakes | Extend notification-boundary.ts and mock-pi.ts; misses ~28 files with their own fakes | |

**Diff rule**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file multiset, baseline ⊆ now | Additions allowed and listed; a changed byte is a missing entry | ✓ |
| Per-file ordered sequence, exact | Also catches reordering; test insertions force re-baselines | |
| Global multiset, baseline ⊆ now | Survives file moves; loses drift-to-test attribution | |

**Lifetime**

| Option | Description | Selected |
|--------|-------------|----------|
| Planning artifact, phase-end step | Committed under the phase dir; re-diff is a phase-end verification step | ✓ |
| Test fixture, gated in npm run check | Second full suite pass on every check | |
| Planning artifact, per-plan step | Re-diff after every notify-touching plan | |

**Non-vacuity**

| Option | Description | Selected |
|--------|-------------|----------|
| Negative script + count floor | *.negative plants a one-byte drift; diff refuses a capture below the baseline count | ✓ |
| Count floor only | Nothing proves the byte comparison works | |
| Manual one-time check | Not re-proven on tool edits | |

---

## Probe snapshot plumbing

**Snapshot origin**

| Option | Description | Selected |
|--------|-------------|----------|
| Command takes it, passes it | One softDepStatus(pi) per command feeds companionSeverity and the notify family, replacing `pi` (~80 calls, 40 files) | ✓ |
| Resolve probes, absorbs severity | notify keeps `pi`; severity decision leaves commands; per-emission probes remain | |
| Lazy per-command memo | Dispatch side can still trigger the probe at emit time | |

**Parameter type**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-command object | Snapshot now; Phase 5 adds the sink, Phase 6 invocationId and command id; call sites touched once | ✓ |
| Bare SoftDepStatus | Phases 5 and 6 re-edit the same ~80 call sites | |

**Construction site** (the question was re-asked once after an interrupted tool call)

| Option | Description | Selected |
|--------|-------------|----------|
| Edge + lifecycle roots | Command handler, resources_discover pass, hook callbacks; nested runs share the parent's object | ✓ |
| Orchestrator composition root | Phase 6 may need to hoist construction to the edge | |

---

## Model shape

**Model type** (answered twice after an interruption; same answer both times)

| Option | Description | Selected |
|--------|-------------|----------|
| Internal TS types; Phase 4 maps | Readonly interfaces now; Phase 4 authors the typebox wire schema plus an explicit DTO converter | ✓ |
| Typebox from day one = wire schema | One definition; every internal change becomes a wire change | |

**Summary line**

| Option | Description | Selected |
|--------|-------------|----------|
| Facts + model-owned line | Resolve composes the line (summaryPhrase moves in); both strategies read it verbatim | ✓ |
| Facts only; text composes | Phase 4 would duplicate or relocate the phrase logic for WIRE-05 | |

**Failure detail**

| Option | Description | Selected |
|--------|-------------|----------|
| In resolve | Producers keep the live Error; resolve serializes once; single site for Phase 4 redaction | ✓ |
| At the producers | Touches every failure path; redaction spreads across sites | |

---

## Phase 1/2 seam

**Marker suppression data**

| Option | Description | Selected |
|--------|-------------|----------|
| Marker-only policy on CommandContext | Total per-status `markers` switch; Phase 2 extends the same map | ✓ |
| Central table in resolve | Moves twice; needs a command key before Phase 6 | |

**Render arm shape**

| Option | Description | Selected |
|--------|-------------|----------|
| Arms take resolved rows now | RenderFn = (resolvedRow, mpScope) => string; 70 test calls updated now and again in Phase 2 | ✓ |
| Keep probe-shaped adapter until Phase 2 | Less churn; a probe still flows into the text path | |

---

## Claude's Discretion

- Module names and the split between model, resolve, and text within `shared/`.
- Capture tool layout, output format, per-process test-file identification,
  and newline normalization.
- Plan breakdown and migration order (baseline first; no reader-less export
  between commits; check green after every plan).
- Location of the SC-3 two-answer proof test.

## Deferred Ideas

None.
