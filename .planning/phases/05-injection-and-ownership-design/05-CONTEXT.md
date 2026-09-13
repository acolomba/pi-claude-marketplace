# Phase 5: Injection and Ownership Design - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 exposes only the production seams and ownership boundaries required by the terminal TREF-04 through TREF-06 evidence. It classifies each hidden dependency, moves confirmed mutable module state into legitimate runtime or factory ownership, and removes test-only exports and test-shaped branches. It does not perform the later global-patching removal or approved large-module split program.

</domain>

<decisions>
## Implementation Decisions

### Hidden Dependency Classification

- **D-05-01:** Classify every MF-DEC-07 affected use before changing it. Ordinary portable filesystem behavior uses a fresh case-owned temporary tree. Only an irreproducible fault, timing edge, operation schedule, rollback point, probe sequence, hydration read, or state-read race may receive a narrow consumer-owned production port wired to its real adapter by production composition. Ports must not be `__deps` members, test-only exports, unused defaults, or dead seams.
- **D-05-02:** Preserve exactly the two MF-DEC-03 behavioral-composition exceptions: `applyReconcile` and `bootstrapClaudePlugin`. Do not add dependency-injection seams solely for those flows. Preserve apply's public-result assertions; bootstrap's complete state, configuration, and scope-tree assertions; and both suites' exact-notification assertions. Correct an independently authorized boundary, such as apply's state-read race, without weakening the composition proof.
- **D-05-03:** Phase 5 defines and wires any required production ports, but Phase 6 owns removal of the authorized `createRequire` and `syncBuiltinESMExports` machinery. — **Reversibility:** costly — Port placement must coordinate with Phase 6 source-test ownership moves and the install/reinstall split sequence.

### Mutable State Ownership

- **D-05-04:** Replace hooks routing module-state ownership with one explicit hooks runtime state instance per extension lifecycle. Registration, hydration, routing rebuilds, settle state, async-rewake lifecycle behavior, and registered callbacks share that instance. Stale registrations are invalidated through real lifecycle behavior, not a test reset export. Tests create fresh runtime instances. — **Reversibility:** costly — Reversing this would reintroduce shared-process state across the hooks call graph and require retouching every state consumer.
- **D-05-05:** Replace the module-global completion maps with a completion-cache instance owned at the extension or command composition boundary. Production consumers receive its public cache operations; tests create fresh instances. Preserve disk-cache schemas, invalidation semantics, time-to-live behavior, and cross-operation cache effects without exporting a reset hook. — **Reversibility:** costly — The cache is shared by completion readers and marketplace/plugin mutation invalidators, so changing its lifetime later affects both sides of that contract.
- **D-05-06:** A lifecycle operation may clear or replace state only when production behavior requires it, such as reload or disposal. Do not retain or create an operation whose only caller is test setup.

### Public Contract Cleanup

- **D-05-07:** Apply MF-DEC-01 trace-preserving removal to `BOOLEAN_FLAGS`, `resetEpoch`, `resetRoutingState`, `resetCompletionCache`, and any other terminal test-shaped surface found within the active scope. Remove or privatize the surface and its artificial case; keep tests on public results. Retain an export only when current production consumers establish a genuine public contract.
- **D-05-08:** Remove the `BOOLEAN_FLAGS` test import and tautological assertion while retaining the independent literal flag-catalog pin and public list-handler behavior coverage.
- **D-05-09:** Phase 5 may shape genuine contracts needed by the MF-DEC-02 split program, but Phase 6 owns the approved resolver, notify, install, update, reinstall, list, and catalog splits and their test-ownership migrations.

### the agent's Discretion

- Exact type, factory, and file names for the hooks runtime, completion cache, and narrow ports.
- Whether an owned state object is represented by a class, closure, or typed object, provided its lifetime and consumers are explicit.
- Migration order and temporary internal adapters, provided no test-only or dead surface survives the completed phase.
- The smallest port boundary for each authorized irreproducible case after current-source research.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Evidence Authority

- `.planning/ROADMAP.md` — Phase 5 goal and success criteria.
- `.planning/REQUIREMENTS.md` — Active TREF-04, TREF-05, and TREF-06 requirement contracts.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Terminal findings, scope changes, decisions, affected roots, and downstream constraints; this is the authority over historical route text.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` — Interpretation rules for the revalidation ledger.
- `.planning/phases/01-live-evidence-revalidation/01-CONTEXT.md` — Evidence-authority and stale-route rules established before revalidation.

### Prior Phase Contracts

- `.planning/phases/03-production-defect-corrections/03-CONTEXT.md` — Trace-preserving removal, real trust-boundary preservation, and no-ignore/test-only-export constraints.
- `.planning/phases/03-production-defect-corrections/03-VERIFICATION.md` — Verified Phase 3 prerequisite state.
- `.planning/phases/04-hermetic-test-infrastructure/04-CONTEXT.md` — Real-temporary-state default, narrow-port policy, typed collaborators, and hermeticity constraints.
- `.planning/phases/04-hermetic-test-infrastructure/04-VERIFICATION.md` — Verified Phase 4 prerequisite state.

### Historical Dossiers Retained by the Live Ledger

- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` — Cross-cutting provenance and decision context; counts are historical, not planning authority.
- `.planning/reviews/unit-test-adversarial/adversarial/bridges-hooks-dispatch.md` — HHD-023 hooks state/reset evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/shared-core.md` — SHC-F003 and SHC-F028 path-safety and completion-cache evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/edge-handlers-plugin.md` — EHP-001 `BOOLEAN_FLAGS` evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-reconcile-apply.md` — ORA-F23 composition-flow evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-support.md` — OPS-F20 bootstrap composition-flow evidence.

### Current Codebase Guidance

- `.planning/codebase/TESTING.md` — Current test layout, commands, doubles, and hermetic-test conventions.
- `.planning/codebase/CONVENTIONS.md` — Current TypeScript and module-contract conventions.
- `.planning/codebase/STRUCTURE.md` — Current module boundaries and composition points; validate any stale path examples against current source.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `bridges/hooks/routing-state.ts`: already centralizes hooks state behind named accessors and mutators, making it the natural source for an explicit runtime-state factory.
- `bridges/hooks/event-router.ts`: `registerHooksBridge`, hydration, rebuild, and callback factories expose the extension-lifecycle composition boundary that should own and pass hooks state.
- `shared/completion-cache.ts`: already groups public reads, invalidation, drop, schema, and persistence behavior; these operations can become one owned cache contract without changing observable semantics.
- `domain/manifest-cache.ts`: `createManifestCache` is an existing factory-owned cache pattern.
- Phase 4 hermetic helpers and typed collaborators: use real temporary homes/filesystems for ordinary behavior and typed doubles only at legitimate production ports.

### Established Patterns

- Production composition supplies real adapters; tests replace only typed, consumer-owned collaborators.
- Owner tests assert returned values, exact persisted state/bytes, notifications, cleanup, and ordering rather than merely checking collaborator calls.
- Direct production/test pairing and the corresponding-test gate constrain any new source module and its owner test.
- Lifecycle reload behavior is real production behavior and may justify state invalidation; generic test cleanup does not.

### Integration Points

- Hooks runtime ownership spans extension registration, route hydration/rebuild, dispatch handler capture, settle state, async-rewake cleanup, and reconcile-triggered hydration.
- Completion-cache ownership spans `edge/completions/data.ts` readers and marketplace/plugin add, remove, install, update, reinstall, and uninstall invalidators.
- `edge/handlers/plugin/list.ts` keeps `BOOLEAN_FLAGS` private while public handler behavior and `edge/flag-catalog.ts` remain the contract under test.
- Phase 5 port placement must anticipate Phase 6's install/reinstall ownership moves without executing those splits early.

</code_context>

<specifics>
## Specific Ideas

- Prefer one coherent owned runtime/cache object over a bag of independent injected functions.
- Keep the real adapter visible at the production composition point so a port cannot silently become test-only.
- Preserve exact behavioral assertions for the two selected composition exceptions.

</specifics>

<deferred>
## Deferred Ideas

- Phase 6 removes all authorized process-global builtin mutation machinery after Phase 5 supplies the classified seams.
- Phase 6 executes the approved large-module split program and source-test ownership migration.
- `bridges/skills/stage.test.ts` remains out of scope without a dedicated terminal finding.
- Stale architecture-document counts from AUDIT-009 remain deferred documentation work.
- The info split remains excluded and uninstall remains a cohesive transactional workflow under MF-DEC-02.
- No pid-table change is authorized without a dedicated terminal finding.
- Spikes 018 through 020 are historical exploration artifacts, not canonical findings; validate any useful idea against current source and the live ledger.

</deferred>

---

_Phase: 05-injection-and-ownership-design_
_Context gathered: 2026-09-07_
