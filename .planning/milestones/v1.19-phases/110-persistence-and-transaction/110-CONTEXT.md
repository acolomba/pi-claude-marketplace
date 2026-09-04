# Phase 110: Persistence and Transaction - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the nine persistence modules and three transaction modules assigned to Phase 110. Each pair must reach 100 percent direct function, line, and branch coverage while preserving accepted state, configuration, index, migration, ledger, rollback, and locking contracts. The phase proves exact stored formats, replay outcomes, atomic replacement, failure isolation, idempotency, and retry behavior through public values and effects. It does not redesign persistence formats or widen production APIs for tests.

</domain>

<decisions>
## Implementation Decisions

### Persistence fixtures and stored formats

- Use a fresh real temporary directory for every filesystem case. The same case owns and removes the directory, including corrupt-input and partial-failure cases.
- Construct persisted inputs from independent literal JSON and object values that pin the accepted wire format. Do not derive expected documents from production builders.
- Keep reusable setup in small concern-local factories beside the persistence tests. Do not create or restore a generic helper directory.
- Preserve and prove the exact current treatment of unknown fields, legacy versions, corrupt rows, invalid documents, missing files, and empty inputs.

### Migration and replay behavior

- Drive migration behavior through public load and migration entry points. Test exported pure transforms directly where they form part of the public module contract.
- Prove idempotency by sending the migrated result through the same path again and requiring an exact no-op outcome.
- For persistence failures, assert the complete public error or warning, its stable cause and fields, retained in-memory state, and exact filesystem effects.
- Assert complete stored values and exact JSON bytes where byte shape is contractual. Do not replace independent expected values with selected-field assertions or generated snapshots.

### Transaction and rollback schedules

- Fail every meaningful ledger position independently, including the failing phase's own undo path, instead of sampling only the first, middle, and last positions.
- Prove rollback with the complete newest-first call log, structured partial-failure rows, causes, leaks, and final state. Merely observing that an undo function ran is insufficient.
- Use case-local real lock paths for lock lifecycle and contention. Use the existing public dependency seams for deterministic load and save failures.
- Test timing, contention, and retry behavior with controlled promises or injected timing. Do not use real sleeps, shared locks, or broad timeout assumptions.

### Public surface and testability

- Preserve current exports. A production change for testability must be a behavior-preserving extraction or real dependency injection within the owning source-test pair; do not add test-only exports, reset hooks, or state readers.
- Normalize and re-prove every Phase 110 owner, including owners whose accepted-HEAD triage already passes focused coverage. Baseline `PASS` is input, not completion evidence.
- Every owner directly imports its paired production module and proves the complete public contract at 100 percent direct function, line, and branch coverage. Supplemental integration and architecture tests do not replace owner evidence.
- Every runtime case uses separate lowercase `// arrange`, `// act`, and `// assert` phases with the canonical blank lines. Lowercase `// act & assert` is limited to one `assert.throws()` or `assert.rejects()` expression. Data rows use separate phases, and type-only evidence uses `satisfies` or `@ts-expect-error` without artificial runtime phases.

### the agent's Discretion

- Choose names and exact shapes for concern-local factories, provided each factory remains beside its persistence or transaction concern and does not become a generic test-helper layer.
- Choose the precise failure schedule and controlled-promise mechanism needed to discriminate each public transaction branch without real sleeps.
- Make behavior-preserving internal production refactors only when the current public seam cannot provide complete direct coverage, and keep each change within its owning pair.

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `shared/atomic-json.ts` is the sanctioned atomic JSON write seam used by state, config, and agents-index persistence.
- `agents-index-schema.ts`, `config-io.ts`, and `state-io.ts` expose compiled TypeBox validators and public schema-derived types that owner tests can exercise with independent positive and negative values.
- `withLockedStateTransaction` already exposes injected `loadState` and `saveState` dependencies for deterministic persistence failures while the lock lifecycle remains real.
- `phase-ledger.ts` exposes the generic `Phase<C>` and structured `RunPhasesResult` contracts needed for complete failure schedules without orchestrator coupling.

### Established Patterns

- Persistence tests use real case-local temporary directories rather than an in-memory filesystem.
- Missing state and configuration files have explicit public outcomes; malformed JSON, schema-invalid data, row corruption, and ordinary I/O errors remain distinct.
- Migration first normalizes accepted legacy shapes, then validates and persists through the same atomic writer. Replaying a normalized result must be a fixed point.
- Transaction code returns structured errors and rollback partials. Presentation remains outside the transaction layer.
- Testability uses real dependency injection or an extracted production concern, never module-global test controls.

### Integration Points

- `state-io.ts` is consumed broadly by orchestrators, hooks, edge handlers, integration tests, and the state-lock guard, so stored-shape and migration behavior must remain stable.
- `config-io.ts`, `config-merge.ts`, `config-write-back.ts`, and `migrate-config.ts` jointly define desired-state loading, entry-level override provenance, physical-file targeting, and first-run capture.
- `agents-index-io.ts` combines file-level failure with per-row soft corruption handling and writes through the shared atomic JSON seam.
- `phase-ledger.ts`, `rollback.ts`, and `with-state-guard.ts` connect install and reinstall workflows to rollback ordering, partial failures, save timing, and cross-process locking.

</code_context>

<specifics>
## Specific Ideas

- Treat persisted documents as public wire contracts: use readable literal fixtures and exact complete expectations rather than opaque snapshots.
- Exercise migrations twice to make replay stability visible in the owner case itself.
- Enumerate transaction failure positions and expected newest-first compensation order as named behavior rows.
- The exact runtime phase comments are lowercase: `// arrange`, `// act`, and `// assert`; lowercase `// act & assert` applies only to one throwing or rejection expression.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
