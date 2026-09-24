---
phase: "08"
slug: "enablement-parity-for-dependencies"
status: secured
# Blocking threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 08 — Security

Plan-time threats were checked at ASVS level 1 against current source, the [validation map](08-VALIDATION.md), and the [goal verification](08-VERIFICATION.md). The current tree passed 7,760 unit tests and all 15 integration files. The full `npm run check` is still blocked by formatting in the operator-owned `.planning/config.json`.

## Trust Boundaries

| Boundary | Description | Data Crossing |
| --- | --- | --- |
| Installed declaration → command | Author declarations govern cascades and disable refusal | Guarded plugin keys |
| Cascade transaction → state/config | Member toggles update records; explicit commands may update config | Enabled flag and provenance |
| Failure → notification | Refusals and rollback details become rendered messages | Guarded names and redacted causes |

## Threat Register

Each plan has its own threat IDs. The plan column identifies repeated IDs. Control text comes from the plan. The evidence reference identifies the current test or goal check.

| Plan | Threat ID | Category | Component | Severity | Disposition | Plan control and current evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 08-01-PLAN.md | T-08-01 | Tampering | `enable-disable.ts` cascade member write | high | mitigate | The member write reaches the state record ONLY. `writeEnabledFlagBack` stays reachable from the root's arm alone, so no config file gains a key for a plugin the user did not name (D-04-02). Asserted by a Task 2 acceptance criterion. Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-01-PLAN.md | T-08-02 | Tampering / Denial of Service | `runEnableCascadeMembers` partial write | high | mitigate | Members are driven through `runPhases`, so a member failure unwinds every member already turned on; each `undo` re-disables via `cascadeUnstagePlugin` + `toDisabledRecord` rather than deleting the record that owns the artifacts. No bare `record.enabled = true` path exists (NFR-3). Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-01-PLAN.md | T-08-03 | Information disclosure | `EnableRefusedError` cause line | medium | mitigate | The unreadable-declarer message is `buildScopeDeclarationDetail`'s own, already routed through `redactAbsolutePaths` in `dependency-index.ts`, and no `{ cause }` is chained behind it. Asserted by the Task 3 no-absolute-path criterion. Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-01-PLAN.md | T-08-04 | Tampering | closure walk inputs from author-controlled manifests | medium | mitigate | Member keys reach a row only after `isRenderableDependencyToken` passes in `splitKey` / `buildChildEdge`; an unrenderable half never becomes a key. Reused unchanged from `domain/dependency-closure.ts`. Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-01-PLAN.md | T-08-05 | Elevation of privilege | `enable-disable.ts` network reachability | medium | mitigate | The file is already a `NETWORK_FREE_TARGETS` member; the new declaration read composes `dependency-index.ts`, itself a gate member. `tests/architecture/no-orchestrator-network.test.ts` runs in this plan's verify set. Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-01-PLAN.md | T-08-SC | Tampering | npm/pip/cargo installs | low | accept | This phase adds no runtime or dev dependency; RESEARCH.md's Package Legitimacy Audit records the gate as not applicable, and no task runs a package-manager install. Plan control: `08-01-PLAN.md`; goal check: `08-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 08-02-PLAN.md | T-08-06 | Tampering | `composeDisableRefusalCause` dependent list | high | mitigate | Every dependent key passes through `renderDependentKeys`, a mirror of `uninstall.messaging.ts::renderDependents`: the keys are joined only when all of them pass `isRenderablePluginKey`, and otherwise the list collapses to a count. Asserted by the adversarial-name acceptance criterion in Task 1. Plan control: `08-02-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-02-PLAN.md | T-08-07 | Information disclosure | the refusal carrier's message | medium | mitigate | The message is composed from `name@marketplace` keys and fixed phrases only, and the fail-closed arm reuses `dependency-index.ts`'s already path-redacted `cause.message`. No `{ cause }` is chained behind either, so the renderer's cause-chain walk cannot print a raw underlying message. Asserted by the no-absolute-path criterion. Plan control: `08-02-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-02-PLAN.md | T-08-08 | Denial of service | an author-controlled declaration that refuses a user's disable | medium | accept | A plugin the user installed can declare a dependency on another installed plugin and so refuse its disable. This IS the requirement (EDEP-02) and it matches upstream; the remedy is named on the row (disable the dependents first, or uninstall the declarer, which is never refused for this reason under D-06-06). Plan control: `08-02-PLAN.md`; goal check: `08-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 08-02-PLAN.md | T-08-09 | Tampering | guard bypass through the idempotency short-circuit | medium | mitigate | The guard is placed so that any path reaching `runDisableBranch` has passed it; a target that is already disabled returns through the idempotent arm, which performs no unstage. Asserted by the zero-call `cascadeUnstagePlugin` spy criterion. Plan control: `08-02-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-02-PLAN.md | T-08-SC | Tampering | npm/pip/cargo installs | low | accept | This plan adds no runtime or dev dependency and runs no package-manager install; RESEARCH.md records the legitimacy gate as not applicable for this phase. Plan control: `08-02-PLAN.md`; goal check: `08-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 08-03-PLAN.md | T-08-10 | Tampering / Denial of Service | `buildReEnableMemberPhase` partial write | high | mitigate | The member is a `Phase`, so `runPhases`'s reverse walk reaches it; its `undo` re-disables through `cascadeUnstagePlugin` + `toDisabledRecord` and RETHROWS a failed unstage after folding what did drop, so a surviving artifact is reported as `{rollback partial}` rather than silently claimed as unwound (NFR-3). Asserted by two fault-injection criteria. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-03-PLAN.md | T-08-11 | Elevation of privilege | provenance flip on the re-materialized member | high | mitigate | The re-materialization never writes `provenance`; the flip to `explicit` stays behind `promoteDependencyRecord`'s by-name guard. A dependency that silently became explicit would survive a `--prune` sweep it should not. Asserted by a Task 1 criterion. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-03-PLAN.md | T-08-12 | Tampering | desired-state config gaining a dependency key | high | mitigate | No config seam is reachable from the cascade's re-enable path; the write is to the state record alone (D-04-02). Asserted by the zero-call config-write-seam criterion. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-03-PLAN.md | T-08-13 | Repudiation | a user's explicit disable reversed without a visible record | medium | mitigate | The row is an `installed` row carrying an explicit second brace token naming the state change, documented as its own catalog state and pinned by a fixture, so the reversal is never silent. This is the behaviour EDEP-03 asks for; the mitigation is that it is REPORTED, not that it is prevented. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; current-tree suites passed. | closed |
| 08-03-PLAN.md | T-08-14 | Information disclosure | rewritten documentation | low | accept | The two rewritten sections carry no paths, no identifiers beyond example plugin names, and no configuration values. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 08-03-PLAN.md | T-08-SC | Tampering | npm/pip/cargo installs | low | accept | This plan adds no runtime or dev dependency and runs no package-manager install; RESEARCH.md records the legitimacy gate as not applicable for this phase. Plan control: `08-03-PLAN.md`; goal check: `08-VERIFICATION.md`; original plan acceptance is logged below. | closed |

17 plan-specific threat rows are closed by a shipped control, an accepted risk, or a documented transfer. Only an open high or critical threat counts toward `threats_open`.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| R-08-01 | T-08-SC in 08-01-PLAN.md | This phase adds no runtime or dev dependency; RESEARCH.md's Package Legitimacy Audit records the gate as not applicable, and no task runs a package-manager install. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-08-02 | T-08-08 in 08-02-PLAN.md | A plugin the user installed can declare a dependency on another installed plugin and so refuse its disable. This IS the requirement (EDEP-02) and it matches upstream; the remedy is named on the row (disable the dependents first, or uninstall the declarer, which is never refused for this reason under D-06-06). | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-08-03 | T-08-SC in 08-02-PLAN.md | This plan adds no runtime or dev dependency and runs no package-manager install; RESEARCH.md records the legitimacy gate as not applicable for this phase. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-08-04 | T-08-14 in 08-03-PLAN.md | The two rewritten sections carry no paths, no identifiers beyond example plugin names, and no configuration values. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-08-05 | T-08-SC in 08-03-PLAN.md | This plan adds no runtime or dev dependency and runs no package-manager install; RESEARCH.md records the legitimacy gate as not applicable for this phase. | original plan disposition, reviewed by orchestrator | 2026-09-24 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | ---: | ---: | ---: | --- |
| 2026-09-24 | 17 | 17 | 0 | orchestrator, ASVS L1 current-tree audit |

## Sign-Off

- [x] Every threat has a disposition.
- [x] Accepted risks are documented above.
- [x] No high or critical threats remain open.
- [x] `status: secured` and `threats_open: 0` are set.

**Approval:** verified 2026-09-24
