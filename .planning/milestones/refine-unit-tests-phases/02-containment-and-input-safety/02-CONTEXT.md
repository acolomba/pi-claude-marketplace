# Phase 2: Containment and Input Safety - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 fixes the three production-safety requirements that survived Phase 1 revalidation:

- `PDEF-02`: path containment for manifest- and state-derived runtime paths, including the current lenient plugin-info discovery path.
- `PDEF-03`: truthful, fail-closed classification of malformed `mcpServers` values shared by MCP stage and unstage.
- `PDEF-04`: containment and recovery at the root `resources_discover` lifecycle boundary.

The boundary is exactly `PDEF-02`, `PDEF-03`, and `PDEF-04`. This phase does not pull assertion-strength, gate, module-split, naming, coverage, or other Phase 3+ work forward. Safety defects take precedence over preserving current unsafe or misleading behavior.

</domain>

<decisions>
## Implementation Decisions

### Production-first sequence

- Implement the malformed-MCP boundary first.
- Repair the shared containment chokepoint next, then verify every affected live consumer against it.
- Implement lifecycle containment and recovery last.
- Keep the three requirement changes independently reviewable even though they share the Phase 2 safety boundary.

### Path containment (`PDEF-02`)

- Centralize the repair in the shared containment owner at `extensions/pi-claude-marketplace/shared/path-safety.ts`; do not create per-consumer containment policies.
- Cover terminal manifest- and state-derived runtime paths and the current lenient plugin-info discovery path. The affected-consumer audit must include the current uses represented by `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `extensions/pi-claude-marketplace/bridges/commands/stage.ts`, and `extensions/pi-claude-marketplace/persistence/locations.ts`, plus every other live caller that relies on the same chokepoint.
- Preserve absolute paths that are contained within their owning root.
- Reject lexical traversal and any normalized path outside the owning root before a read or write.
- Reject an escape through any existing symlink component before a read or write, including an intermediate component rather than only the leaf.
- Preserve the existing typed containment-error family unless a minimal internal naming adjustment is needed to express the repaired behavior.
- The historic MCP-home escape in `AUDIT-007` is repaired and remains evidence-only. It must not generate implementation work.

### Malformed MCP boundary (`PDEF-03`)

- Model `RawMcpDoc.mcpServers` truthfully as `unknown` at the raw JSON boundary in `extensions/pi-claude-marketplace/bridges/mcp/types.ts`.
- Use one shared classifier for both stage and unstage. Do not let those paths drift into separate malformed-value policies.
- A missing `mcpServers` field remains a clean no-op.
- A present object continues through the normal stage or unstage behavior.
- A present malformed value, including `null`, a string, or an array, produces a stable typed fail-closed outcome at the public stage or unstage flow and causes no configuration write.
- Existing string/array no-op expectations may change. Safety and truthful boundary typing override preservation of those expectations.
- Do not broaden this work into general JSON-schema cleanup or rewrite the policy for unrelated malformed top-level documents.

### Lifecycle containment and recovery (`PDEF-04`)

- Contain an aggregate resource-discovery failure at the `resources_discover` boundary in `extensions/pi-claude-marketplace/index.ts`.
- Reconcile and plugin-`PATH` work that completed before discovery failed remains completed. Preserve that exact partial state; do not roll it back or replay it inside the failed invocation.
- The failed invocation returns the stable empty discovery result: empty `skillPaths` and `promptPaths`.
- A later reload must run normally and succeed after the transient discovery failure is removed. The failure must not poison later invocations.
- Attempt skipped-scope warning notifications independently. Failure of one notification must not suppress later scope warnings or escape the lifecycle boundary.
- Do not redesign the overall lifecycle, reconciliation, or resource-discovery architecture.

### Verification contract

- Use a case-owned temporary filesystem for path and lifecycle evidence.
- Do not use the real user home, network access, or process-global patching.
- Add direct source-test pairs for each changed owner and each affected consumer whose behavior changes.
- Assert exact typed errors or results, exact persisted state, and exact file bytes where a write is relevant.
- Prove both first-invocation failure and second-invocation recovery for the transient lifecycle case.
- For malformed MCP input, prove stage and unstage share the classification, emit the intended typed result, and leave configuration bytes unchanged.

### Agent Discretion

- Choose internal error/type names and the smallest shared helper placement that fit current public contracts.
- Adjust local implementation structure only as needed for the three safety fixes. No Phase 6 module split is approved here.

</decisions>

<specifics>
## Evidence and Traceability

### Terminal evidence roots

| Requirement | Current terminal evidence        | Treatment                                                                                                  |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PDEF-02`   | `MF-003`, `SHC-F001`, `SHC-F051` | Implement the shared normalization/symlink repair and verify affected consumers.                           |
| `PDEF-03`   | `ABG-021`                        | Replace permissive/accidental raw-value handling with one shared stage/unstage fail-closed classification. |
| `PDEF-04`   | `RID-F004`, `RID-F008`           | Preserve independent warning attempts and contain aggregate discovery failure with retry recovery.         |

`MF-002` is supporting umbrella provenance for the production-defect workstream, not a substitute for the narrow terminal roots above. `MF-010` supplies the production-before-test-rewrite sequencing constraint. `AUDIT-007` is stale evidence and is excluded from implementation scope.

### Current behavior that the plan must change

- `assertPathInside` currently computes containment and path segments from unnormalized inputs; the hermetic Phase 1 probes reproduced both a normalization-precondition escape and an intermediate-symlink escape.
- `RawMcpDoc.mcpServers` is currently typed as a record even though parsed JSON is not proven to have that shape. The current stage helper rejects only missing values and arrays, so `null` reaches object enumeration and strings can be enumerated as character keys.
- The root lifecycle already contains reconcile failures and most plugin-`PATH` failures, but aggregate resource discovery can still reject the public `resources_discover` callback. Current notification containment is not adequately proven against one failed warning suppressing later warnings.

</specifics>

<code_context>

## Existing Code Context

### Reusable assets

- `extensions/pi-claude-marketplace/shared/path-safety.ts`: existing `assertPathInside`, `PathContainmentError`, and `SymlinkRefusedError` ownership.
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`: shared raw-document and stage/unstage types.
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` and `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`: paired consumers that must share malformed-value classification.
- `extensions/pi-claude-marketplace/index.ts`: root lifecycle registration and the `resources_discover` boundary.
- `tests/shared/path-safety.test.ts`, `tests/bridges/mcp/stage.test.ts`, `tests/bridges/mcp/unstage.test.ts`, and `tests/index.test.ts`: direct owner suites to extend with case-owned, hermetic evidence.

### Established patterns

- Keep shared safety rules in leaf-level shared modules and make orchestrators/bridges consume them.
- Keep disk mutation atomic and compare unchanged bytes on refusal paths.
- Express public results and errors as stable typed shapes, then verify exact values at direct owner boundaries.
- Preserve load progress that already completed while isolating later failure at the host callback boundary.

### Canonical planning and evidence references

- `.planning/REQUIREMENTS.md` — active `PDEF-02`, `PDEF-03`, and `PDEF-04` clauses.
- `.planning/ROADMAP.md` — fixed Phase 2 boundary and success criteria.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — canonical terminal finding records and routes.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — generated human-readable ledger projection.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` — ledger interpretation rules.
- `.planning/phases/01-live-evidence-revalidation/01-CONTEXT.md` — Phase 1 evidence and scope-control decisions.
- `.planning/phases/01-live-evidence-revalidation/01-69-SUMMARY.md` — Phase 1 validation seal and final census.
- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` — umbrella production-defect and sequencing provenance.
- `.planning/reviews/unit-test-adversarial/adversarial/shared-core.md` — `SHC-F001` and `SHC-F051` source claims.
- `.planning/reviews/unit-test-adversarial/adversarial/architecture-boundary-gates.md` — `ABG-021` source claim.
- `.planning/reviews/unit-test-adversarial/adversarial/root-index.md` — `RID-F004` and `RID-F008` source claims.
- `.planning/reviews/unit-test-adversarial/_AUDIT.md` — stale `AUDIT-007` historical source only.

</code_context>

<deferred>
## Deferred Ideas

- The repaired MCP-home escape (`AUDIT-007`) remains evidence-only.
- The unused-type-member gate remains outside this phase.
- Do not prescribe a GAUTH sentinel in this phase.
- Host-notification visibility/reason unification and notification test infrastructure remain on their existing later routes.
- Broad lifecycle redesign is not approved.
- Assertion strength, coverage enforcement, gate work, module splits, naming cleanup, and every other Phase 3+ route remain deferred to their existing phases.

</deferred>

---

_Phase: 02-containment-and-input-safety_
_Context gathered: 2026-09-05_
