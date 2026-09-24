---
phase: "06"
slug: "load-time-dependency-check-and-allowed-uninstall"
status: secured
# Blocking threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 06 — Security

Plan-time threats were checked at ASVS level 1 against current source, the [validation map](06-VALIDATION.md), and the [goal verification](06-VERIFICATION.md). The current tree passed 7,760 unit tests and all 15 integration files. The full `npm run check` is still blocked by formatting in the operator-owned `.planning/config.json`.

## Trust Boundaries

| Boundary | Description | Data Crossing |
| --- | --- | --- |
| Marketplace declarations → scope state | Manifest declarations determine whether recorded dependents are enabled | Plugin keys and version ranges |
| Reconcile result → notification | Failures and remedies become rendered rows | Guarded names and redacted causes |
| State transaction → disk | The consequence marker is re-derived at each load | Scoped state record |

## Threat Register

Each plan has its own threat IDs. The plan column identifies repeated IDs. Control text comes from the plan. The evidence reference identifies the current test or goal check.

| Plan | Threat ID | Category | Component | Severity | Disposition | Plan control and current evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 06-01-PLAN.md | T-06-01 | Information disclosure | the new verdict failure arm and the new remedy cause line | high | mitigate | Build every message from `redactAbsolutePaths(errorMessage(...))` and chain no nested cause, exactly as the declaration walk's failure constructor already does; the renderer's chain walk does not redact on its own (NFR-9 / T-55-02-02) Plan control: `06-01-PLAN.md`; test: `tests/orchestrators/reconcile/plan.test.ts`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-02 | Tampering (output spoofing) | the remedy sentence interpolating a plugin name | medium | mitigate | The interpolated keys are built from names that passed `domain/dependencies.ts::TOKEN_PATTERN`, which admits no control, bidi, ANSI, whitespace or quote character and no `@`; no new name source is introduced Plan control: `06-01-PLAN.md`; test: `tests/orchestrators/reconcile/notify.test.ts`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-03 | Tampering (fail-open) | a damaged manifest read as "declares nothing", silently leaving a dependent enabled | high | mitigate | Inherit D-05-07's fail-closed posture: keep `refuseUnusableOwnManifest: true` and return the typed failure arm; an empty declaration set is never produced from an unreadable declarer (task 1 and task 2, and the prohibition in `must_haves`) Plan control: `06-01-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-04 | Denial of service (CPU) | the propagation fixpoint on a declaration cycle | high | mitigate | The loop exits on an empty batch, `held` only grows and is bounded by the record count, and an explicit iteration bound asserted against the record count turns a regression into a failure rather than a hang (task 1, with a cycle fixture) Plan control: `06-01-PLAN.md`; test: `tests/architecture/no-orchestrator-network.test.ts`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-05 | Denial of service (rendering) | an unbounded declared range reaching a notification row | medium | mitigate | Render any range through `renderConstraintRange`, which caps at 200 characters with an explicit overflow marker; never slice a range by hand (relevant from plan 06-02, declared here because the row shape lands in this plan) Plan control: `06-01-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-06 | Elevation of privilege (write outside scope) | the new apply step's state write | medium | mitigate | Route the write through the scope-guard and `saveState`, never a bare atomic JSON write; every path comes from the branded `ScopedLocations` bundle whose getters run through `assertPathInside` (NFR-10) Plan control: `06-01-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-07 | Repudiation / integrity of user intent | writing the consequence-disable back to the user's config | high | mitigate | Do not write back to `claude-plugins.json`. D-04-02 and LOAD-02: the config carries only what the user asked for, and a write-back would make the user's own file assert a choice they did not make (prohibition in `must_haves`) Plan control: `06-01-PLAN.md`; test: `tests/persistence/state-io.test.ts`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-08 | Spoofing (trust the cache) | the persisted marker read as a durable claim about WHY a record is disabled | medium | mitigate | D-06-01 keeps the field a boolean re-derived live every pass; the planner gate reads the LIVE verdict and never the stored marker alone (task 1, and the prohibition in `must_haves`) Plan control: `06-01-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-01-PLAN.md | T-06-SC | Tampering | npm / pip / cargo installs | high | accept | No package is installed in this phase. `06-RESEARCH.md` § Package Legitimacy Audit records this explicitly: every symbol resolves inside the extension, `package.json` gains no entry, and no `npm install` step appears in any task. The gate has no target to run against Plan control: `06-01-PLAN.md`; goal check: `06-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 06-02-PLAN.md | T-06-05 | Denial of service (rendering) | an unbounded declared range reaching a notification row | medium | mitigate | Render every range through `renderConstraintRange`, which caps the output and emits an explicit overflow marker; slicing by hand is prohibited in `must_haves` (task 1) Plan control: `06-02-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-02-PLAN.md | T-06-09 | Denial of service (CPU) | a pathological set of declared ranges folded by the intersection | high | mitigate | Use `intersectDependencyRanges`, which carries two project-owned input caps checked BEFORE the work they bound; do not hand-roll the fold (task 1) Plan control: `06-02-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-02-PLAN.md | T-06-10 | Tampering (fail-open on a cap trip) | a range fold that trips a cap being read as "no constraint", silently satisfying a dependency | high | mitigate | Treat a disjoint fold and a cap trip as out-of-range, never as unconstrained; the unconstrained short-circuit is reached only through `isUnconstrainedRange` on a successful fold (task 1) Plan control: `06-02-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-02-PLAN.md | T-06-11 | Repudiation / integrity of user intent | the lift overturning a disable the user asked for | high | mitigate | Only a record the check itself transitioned carries the marker, and only a marked record is ever lifted; task 2 asserts that an unmarked disabled record is never lifted by the check Plan control: `06-02-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-02-PLAN.md | T-06-04 | Denial of service (CPU) | the propagation fixpoint on a declaration cycle | high | mitigate | Proven terminating by an explicit cycle fixture carrying a bounded timeout, on top of the iteration bound plan 06-01 asserted (task 3) Plan control: `06-02-PLAN.md`; test: `tests/architecture/no-orchestrator-network.test.ts`; current-tree suites passed. | closed |
| 06-02-PLAN.md | T-06-SC | Tampering | npm / pip / cargo installs | high | accept | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that every symbol resolves inside the extension and `package.json` gains no entry Plan control: `06-02-PLAN.md`; goal check: `06-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 06-03-PLAN.md | T-06-03 | Tampering (fail-open) | a damaged manifest read as "declares nothing", letting a needed plugin be removed with no report | high | mitigate | The unreadable-declarer refusal is explicitly PRESERVED; only the found-dependents outcome changes. Task 2 asserts the refusal still fires and still removes nothing Plan control: `06-03-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-03-PLAN.md | T-06-12 | Integrity (loss of a safety property) | removing the refusal before the replacement check exists | high | mitigate | Sequenced: this plan depends on 06-02, so the load-time check that reports the consequence is landed and proven before the refusal is removed. The wave ordering is the control Plan control: `06-03-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-03-PLAN.md | T-06-02 | Tampering (output spoofing) | a hostile plugin name in the dependents cause line | medium | mitigate | The keys are built from names that passed `domain/dependencies.ts::TOKEN_PATTERN`, which admits no control, bidi, ANSI, whitespace or quote character; the cause line is built the same way the retired refusal built its own Plan control: `06-03-PLAN.md`; test: `tests/orchestrators/reconcile/notify.test.ts`; current-tree suites passed. | closed |
| 06-03-PLAN.md | T-06-01 | Information disclosure | an absolute path leaking through the uninstall cause line | high | mitigate | Build the message from already-redacted strings and chain no nested cause, matching the existing construction in the declaration walk's failure arm (NFR-9) Plan control: `06-03-PLAN.md`; test: `tests/orchestrators/reconcile/plan.test.ts`; current-tree suites passed. | closed |
| 06-03-PLAN.md | T-06-13 | Repudiation (a gate that stops gating) | the token removed from the set while a stale gate stays green | high | mitigate | The retirement is proven by the typecheck going green only after every site is swept, plus a whole-tree grep returning nothing, plus three independent membership pins amended by hand and never derived from the constant under test (task 3) Plan control: `06-03-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-03-PLAN.md | T-06-SC | Tampering | npm / pip / cargo installs | high | accept | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that every symbol resolves inside the extension and `package.json` gains no entry Plan control: `06-03-PLAN.md`; goal check: `06-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 06-04-PLAN.md | T-06-14 | Repudiation (documentation drift) | the two prose contracts, neither of which is byte-gated | medium | mitigate | `docs/plugin-enablement.md` records affirmatively that nothing fails if a claim here drifts. The mitigation is procedural and stated in the task: quote the three remedy sentences byte-identically from the catalog, which IS gated, so the gated artifact anchors the ungated one; and verify the edits by reading against the three plan summaries rather than by running a test Plan control: `06-04-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-04-PLAN.md | T-06-15 | Repudiation (a closed record hiding a live gap) | the backlog item made moot as a guard but not as a gap | medium | mitigate | Re-triage rather than close, and say in the entry what changed and what did not. Encoded as a prohibition in `must_haves` and asserted by a verify that fails if the entry disappears Plan control: `06-04-PLAN.md`; goal check: `06-VERIFICATION.md`; current-tree suites passed. | closed |
| 06-04-PLAN.md | T-06-16 | Repudiation (contradictory decision records) | the superseded Phase 5 decisions | low | accept | Accepted with a control rather than mitigated away: the Phase 5 decisions stay in their own phase artifacts unedited, because rewriting a shipped phase's context would destroy the record of what was decided at the time. The control is that this phase's supersession record names them explicitly and separates the superseded half from the still-live half Plan control: `06-04-PLAN.md`; goal check: `06-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 06-04-PLAN.md | T-06-SC | Tampering | npm / pip / cargo installs | high | accept | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that `package.json` gains no entry Plan control: `06-04-PLAN.md`; goal check: `06-VERIFICATION.md`; original plan acceptance is logged below. | closed |

25 plan-specific threat rows are closed by a shipped control, an accepted risk, or a documented transfer. Only an open high or critical threat counts toward `threats_open`.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| R-06-01 | T-06-SC in 06-01-PLAN.md | No package is installed in this phase. `06-RESEARCH.md` § Package Legitimacy Audit records this explicitly: every symbol resolves inside the extension, `package.json` gains no entry, and no `npm install` step appears in any task. The gate has no target to run against | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-06-02 | T-06-SC in 06-02-PLAN.md | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that every symbol resolves inside the extension and `package.json` gains no entry | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-06-03 | T-06-SC in 06-03-PLAN.md | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that every symbol resolves inside the extension and `package.json` gains no entry | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-06-04 | T-06-16 in 06-04-PLAN.md | Accepted with a control rather than mitigated away: the Phase 5 decisions stay in their own phase artifacts unedited, because rewriting a shipped phase's context would destroy the record of what was decided at the time. The control is that this phase's supersession record names them explicitly and separates the superseded half from the still-live half | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-06-05 | T-06-SC in 06-04-PLAN.md | No package is installed in this phase; `06-RESEARCH.md` § Package Legitimacy Audit records that `package.json` gains no entry | original plan disposition, reviewed by orchestrator | 2026-09-24 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | ---: | ---: | ---: | --- |
| 2026-09-24 | 25 | 25 | 0 | orchestrator, ASVS L1 current-tree audit |

## Sign-Off

- [x] Every threat has a disposition.
- [x] Accepted risks are documented above.
- [x] No high or critical threats remain open.
- [x] `status: secured` and `threats_open: 0` are set.

**Approval:** verified 2026-09-24
