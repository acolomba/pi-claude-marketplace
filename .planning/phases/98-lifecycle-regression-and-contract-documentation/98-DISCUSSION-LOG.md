# Phase 98: Lifecycle regression and contract documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 98-lifecycle-regression-and-contract-documentation
**Areas discussed:** Review-carrier disposition, DOC-08 reconciliation depth, COMPAT-01 gate shape, LIFE coverage shape

---

## Review-carrier disposition (todo folding)

| Option | Description | Selected |
|--------|-------------|----------|
| IN-07 orphan-rewake threading | Thread orphanRewake through InstallPluginOutcome so reconcile renders {orphan rewake} for fresh installs | ✓ |
| WR-06 soft-dep markers on enable | Thread staged agent/MCP counts so re-enable renders {requires pi-subagents}/{requires pi-mcp} | ✓ |
| WR-02 enable remediation hint | Failed enable on stale gate gains a --partial remediation affordance | ✓ |
| WR-04 completion classifier | update --partial completion offers the disabled records it remedies | ✓ |

**User's choice:** All four carriers fold into Phase 98 as code changes.
**Notes:** Question framed the tension with the roadmap's "no lifecycle production
changes expected"; the operator overrode it for all four. Two doc carriers
(notify-stale-comments, README.md:34) were folded without asking as literal
DOC-08 scope; two backlog todos (rare-failure-arms sweep, stale-resolvedSource)
were left deferred.

---

## DOC-08 reconciliation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Named defects + falsified prose | Fix every named defect plus any statement v1.18 falsified within touched sections; no restructuring | ✓ |
| Named defects only | Surgical enumerated corrections only | |
| Full PRD list/info pass | Reconcile the entire chapter, redraw flowcharts as needed | |

**User's choice:** Named defects + falsified prose (recommended option).

### Flowchart sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Redraw to current behavior | Replace with current decision path (manifest load → lookup → ManifestLookup → row form) | ✓ |
| Correct minimally | Patch wrong branches in place | |
| Drop the flowchart | Delete, point at output-catalog.md | |

**User's choice:** Redraw to current behavior (recommended option).

---

## COMPAT-01 gate shape

| Option | Description | Selected |
|--------|-------------|----------|
| Enumeration equality | Test holds full literal member lists, asserts set equality against source constants | ✓ |
| Count pins only | Assert sizes; swaps pass silently | |
| Baseline snapshot file | Committed serialized snapshot compared in CI | |

**User's choice:** Enumeration equality (recommended option).

### Gate home sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| One new COMPAT-01 test file | All clauses in one tests/architecture/ file; delegates to existing network gate; direct file reads (NUL-byte constraint) | ✓ |
| Distribute into existing gates | Extend network/schema/vocabulary gates each with their clause | |

**User's choice:** One new COMPAT-01 test file (recommended option).

---

## LIFE coverage shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing suites | Coverage in the per-orchestrator test files, factories extended in place | ✓ |
| New lifecycle suite file | One consolidated lifecycle-manifest-absent suite | |

**User's choice:** Extend existing suites (recommended option).

### Uninstall structure sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| One composite fixture | Single plugin carrying all five kinds through install → manifest-removal → uninstall | |
| Per-kind cases | Five separate fixtures/tests, one kind each | ✓ |

**User's choice:** Per-kind cases — operator overrode the composite-fixture
recommendation, preferring per-kind isolation when a regression appears.

---

## Claude's Discretion

- COMPAT-01 clause internals (schema/source read mechanics)
- WR-04 classifier-contract direction (distinct classification vs reachable
  short-circuit), chosen at plan time with both researched
- Plan/wave structure and commit granularity
- LIFE fixture details and autoupdate suite placement

## Deferred Ideas

- Rare-failure-arms coverage sweep (2026-06-12 todo) — backlog
- Stale resolvedSource on unchanged version — backlog by prior operator routing
