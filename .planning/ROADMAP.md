# Roadmap: pi-claude-marketplace

## Milestones

- **v1.20 transitive-dependencies** — shipped 2026-09-24; 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). Closeout used an explicit UAT exception for the private-repository credential challenge.
- **test-backlog** — shipped 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md).
- **refine-unit-tests** — shipped 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md).
- **v1.19 Unit Test Refactor** — shipped 2026-09-04; [archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

The next milestone has not been defined. v1.20's completed phase details are in
[the roadmap archive](milestones/v1.20-ROADMAP.md), and its phase records are
under [v1.20-phases](milestones/v1.20-phases/).

| Phase | Delivered | Completed |
| --- | --- | --- |
| 1 | Manifest read fidelity | 2026-09-14 |
| 2 | Uninstall data disposition and option seam | 2026-09-14 |
| 3 | Dependency resolution | 2026-09-15 |
| 4 | Install provenance | 2026-09-16 |
| 5 | Prune on uninstall | 2026-09-16 |
| 6 | Load-time dependency check and allowed uninstall | 2026-09-19 |
| 7 | Marketplace repository tag resolution | 2026-09-19 |
| 8 | Enablement parity for dependencies | 2026-09-21 |
| 9 | Reload installs missing dependencies | 2026-09-22 |
| 10 | Constraint-aware update | 2026-09-22 |
| 11 | Cross-marketplace dependency allowlist | 2026-09-23 |
| 12 | Standalone prune with dry-run | 2026-09-24 |

## Carried Forward

- Phase 3 UAT still needs one successful credential challenge against a private
  GitHub or GitLab repository. The live annotated-tag and 401 paths passed;
  the success path was deferred to later UAT by the operator. Its archived
  [UAT record](milestones/v1.20-phases/03-dependency-resolution/03-UAT.md)
  remains `testing`.
- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
