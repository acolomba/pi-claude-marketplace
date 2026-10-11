# Roadmap: pi-claude-marketplace

## Milestones

- **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11 on branch `features/json` (not yet merged); 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

The next milestone has not been defined. json-output's completed phase details
are in [the roadmap archive](milestones/json-output-ROADMAP.md), and its phase
records are under [json-output-phases](milestones/json-output-phases/).

| Phase | Delivered | Completed |
| --- | --- | --- |
| 1 | Presentation model | 2026-10-01 |
| 2 | Row policies | 2026-10-02 |
| 3 | Typed raw surfaces | 2026-10-03 |
| 4 | Wire schema and JSON strategy | 2026-10-06 |
| 5 | Mode-selected JSON sink | 2026-10-07 |
| 6 | Command-run contract | 2026-10-09 |
| 7 | Mode refusals, real-Pi verification, and docs | 2026-10-10 |
| 8 | Tech debt: ledger dispositions and advisory | 2026-10-10 |
| 9 | Tech debt: redact LLM tool error text | 2026-10-11 |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap
  pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output Phase 9 (D-03): the LLM tools return
  `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead
  would set Pi's error flag.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
