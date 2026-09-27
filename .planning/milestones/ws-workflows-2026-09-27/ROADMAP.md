# Roadmap: workflows

**Workstream:** workflows

## Milestones

- ✅ **workflows-replay — Workflow Bridge Replay onto main** — Phases 109-117 (completed 2026-09-21 on `features/workflow`; **not merged**) — archive: `milestones/workflows-replay-ROADMAP.md`, `milestones/workflows-replay-REQUIREMENTS.md`, `milestones/workflows-replay-MILESTONE-AUDIT.md`, `milestones/workflows-replay-phases/`
- ✅ **workflows — Claude `workflows` Component-Kind Bridge** — Phases 101-105 (completed 2026-08-16 on `features/workflows-spike`; **not merged**; superseded by the replay) — archive: `milestones/workflows-ROADMAP.md`, `milestones/workflows-phases/`

## Phases

No active milestone. The replay's nine phases and the hardening phases that
were planned as `workflow-hardening` were archived together as
`workflows-replay` (decision recorded in `STATE.md` § Decisions, "Milestone
close"): `gsd-tools` resolved all nine as one milestone, and the audit graded
them as one set.

<details>
<summary>✅ workflows-replay (Phases 109-117) — completed 2026-09-21</summary>

- [x] Phase 109: Kind inversion (5/5 plans) — completed 2026-09-04
- [x] Phase 110: Domain and platform modules (3/3 plans) — completed 2026-09-05
- [x] Phase 111: Workflows bridge (4/4 plans) — completed 2026-09-05
- [x] Phase 112: Install and removal lifecycle (4/4 plans) — completed 2026-09-05
- [x] Phase 113: Update, enable/disable, reconcile (5/5 plans) — completed 2026-09-06
- [x] Phase 114: Degradation and documentation (5/5 plans) — completed 2026-09-08
- [x] Phase 115: Install-time admission-gate warnings (6/6 plans) — completed 2026-09-09
- [x] Phase 116: Load-time workflow convergence (4/4 plans) — completed 2026-09-09
- [x] Phase 117: Measured `agent()` failure evidence (3/3 plans) — completed 2026-09-09

All nine re-verified `passed` at the close (114-117 on 2026-09-21, after three
merges of main had made their reports stale). Phase details, success criteria
and the `workflow-hardening` framing are in the archived roadmap.

</details>

<details>
<summary>✅ workflows (Phases 101-105) — completed 2026-08-16, superseded</summary>

- [x] Phase 101: Workflow component-kind recognition
- [x] Phase 102: Workflow naming and script admission
- [x] Phase 103: Workflow artifact materialization
- [x] Phase 104: Workflow lifecycle completion
- [x] Phase 105: Workflow degradation and documentation

Completed on `features/workflows-spike` and never merged; main had moved under
it. Its requirements, phase records and spike evidence carried into the replay.

</details>

## Carried forward

Nothing this workstream owes is open in a phase. What the close carried out of
scope lives in `.planning/BACKLOG.md`:

- **VSTALE-01** — one `covered_files` rule for every phase's VERIFICATION.md
  (WINDOWS #66, #80); the natural first phase of a next milestone
- **WLREC-01** — which names the succeeded arm records on a staging-cleanup leak (#79)
- **RLHINT-01** — the messaging guide's reload-hint mechanism claim (#74)
- **PCERR-01** — `PathContainmentError` interpolates the untrusted path (#64)
- **WSTOR-01** — the W1/W2/W3 storage canary was never driven live (#72)
- **WPIN-01** — machine-check the engine internals the compatibility doc cites (#61)

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| workflows-replay | 109-117 (9) | 39/39 | Complete, archived | 2026-09-21 |
| workflows | 101-105 (5) | 20/20 | Complete, archived, superseded | 2026-08-16 |
