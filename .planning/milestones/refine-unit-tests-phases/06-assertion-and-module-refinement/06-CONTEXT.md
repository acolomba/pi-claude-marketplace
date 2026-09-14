# Phase 6: Assertion and Module Refinement - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 strengthens terminal observable assertions, removes only the authorized process-global prototype and builtin-module patches, and completes the approved resolver, notify, install, update, reinstall, list, and catalog split program. Product behavior must remain intact except for already-authorized exact-output corrections. Uninstall, the deferred info split, the unused-type-member gate, and work without terminal evidence remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Extracted Public Surface

- **D-06-01:** Give each extracted module the smallest genuine production surface. Export only symbols used by real production composition and the module's paired owner test. Do not add a barrel export unless a current production consumer needs it.
- **D-06-02:** Extraction may include broad API cleanup: rename symbols and reshape awkward parameters when the new responsibility boundary admits a clearer contract. Every tracked production caller and owner test must migrate atomically in the same plan; retain no deprecated overload or compatibility call form. — **Reversibility:** costly — Undoing a cleaned contract requires coordinated edits across every migrated caller and paired owner test.

### Exact-Output Ownership

- **D-06-03:** Narrowly documented body-focused tests may remain, including cases that intentionally omit a tally suffix from their local observation. Each affected producer boundary must also own independently authored zero/one/many cases that assert the complete exact output bytes.
- **D-06-04:** Keep complete expected strings as owner-local constants beside the affected producer tests. The output catalog remains an independent cross-check and must not become the value from which owner-test expectations are derived.
- **D-06-05:** Make paths, timestamps, counts, plugin names, and other dynamic values deterministic in fixtures, then compare the entire final string byte-for-byte. Do not normalize the observed output or replace exact comparisons with patterns.
- **D-06-06:** Use strict collaborator doubles that reject extra or missing notifications, and deep-compare the captured notification array with the complete expected sequence, including severity and ordering.

### Split Rollout Order

- **D-06-07:** Complete assertion strengthening and authorized global-patch removal before the module split program. Then split the leaf-oriented catalog, resolver, and notify responsibilities before the command flows.
- **D-06-08:** Use dependency-aware parallel waves for disjoint splits. Catalog work must follow its emitter and notify contracts. Serialize plans that touch the same structural gates, documentation, ownership maps, or completeness invariants.
- **D-06-09:** When dependencies permit, split command flows in this order: install, update, reinstall, then list.
- **D-06-10:** Verify each plan with its focused direct owner pair and command-flow proof, run affected structural gates at the end of each wave, and close Phase 6 with the complete `npm run check` suite.

### No Forwarding Seams

- **D-06-11:** Do not leave a temporary forwarding module, compatibility adapter, or old-path re-export during extraction. Move the responsibility and migrate its callers atomically within one plan.
- **D-06-12:** If cycles or caller overlap make an extraction too large for one atomic plan, replan around a smaller genuine leaf contract and retry the move. Do not use a forwarding seam as an intermediate state.
- **D-06-13:** After its responsibilities move, delete the original large module rather than retaining a thin orchestration facade or stable re-export path. Move all remaining sequencing and composition behavior to named new owners and update every import. — **Reversibility:** costly — Restoring an old module path would require reconstructing ownership and migrating the new call graph again.
- **D-06-14:** Before deleting an original module, map every exported symbol, invariant, source-scanning gate reference, documentation reference, completeness check, and owner test to a named new owner. A stale-path scan must return zero.

### Carried-Forward Constraints

- `MF-DEC-06` remains binding: structural single/plural cardinality comes from invocation form, plural tallies remain user-visible, and row-count inference is forbidden.
- `MF-DEC-07` and Phase 5 decisions D-05-01 through D-05-03 remain binding: use case-owned real temporary filesystems by default; introduce a narrow consumer-owned production port only for authorized irreproducible faults, timing, schedules, rollback points, probes, hydration reads, or races. No test-only export, dead default, `__deps` bag, or ignore pragma is permitted.
- `MF-DEC-02` remains binding: complete only the seven approved split families, give every new production module exactly one mirrored owner test with direct-pair coverage, retain one end-to-end proof per command flow, and perform the four-part gate/documentation/ownership/completeness repointing checklist.
- The current evidence grants no file-specific authorization to alter `tests/bridges/skills/stage.test.ts` merely because it uses builtin patching. Uninstall and the independently deferred info split remain excluded.

### the agent's Discretion

- Exact new file, symbol, parameter, and local factory names, provided they express the selected responsibility and obey the minimal-surface rule.
- Exact wave membership among genuinely disjoint leaf splits, provided shared gates, documentation, and ownership artifacts are serialized.
- The smallest atomic leaf boundary used to break a cyclic or overly broad extraction, provided it is a real production responsibility and not a forwarding seam.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Evidence Authority

- `.planning/ROADMAP.md` — Phase 6 goal, boundary, and success criteria.
- `.planning/REQUIREMENTS.md` — Active TREF-07, TREF-08, and TREF-09 contracts and explicit evidence-only exclusions.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Terminal finding routes and resolved `MF-DEC-02`, `MF-DEC-06`, and `MF-DEC-07`; this is the authority over historical review prose.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` — Interpretation rules for the live evidence ledger.

### Prior Phase Contracts

- `.planning/phases/03-production-defect-corrections/03-CONTEXT.md` — Exact structural-cardinality, trace-preserving removal, and no-test-only-surface constraints.
- `.planning/phases/04-hermetic-test-infrastructure/04-CONTEXT.md` — Hermetic filesystem, typed collaborator, and public-contract testing constraints.
- `.planning/phases/05-injection-and-ownership-design/05-CONTEXT.md` — Classified hidden dependencies, legitimate production ports, ownership boundaries, and Phase 6 handoff.

### Output and Codebase Guidance

- `docs/output-catalog.md` — Independent canonical examples that must stay synchronized with output changes.
- `.planning/codebase/TESTING.md` — Direct source-test pairing, strict doubles, hermetic filesystem, and owner-test conventions.
- `.planning/codebase/CONVENTIONS.md` — TypeScript, import, complexity, export, and production-owned dependency-injection rules.
- `.planning/codebase/STRUCTURE.md` — Current layer boundaries, large-module inventory, and composition points; validate paths against the live tree before planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/edge/notification-boundary.ts`: `createNotificationBoundary` already sizes strict notification and tool interactions and captures full `{ message, severity }` records.
- `tests/orchestrators/plugin/list.test.ts`: `makeCtx({ recordTally })` documents the current focused-body caveat and provides the concrete boundary that needs independent exact zero/one/many proofs.
- `tests/architecture/catalog-uat.test.ts`: the current scanner, fixture map, and driver identify distinct catalog responsibilities and already byte-pair `NotificationMessage` fixtures with documented output.
- `domain/manifest-cache.ts`, `bridges/hooks/routing-state.ts`, and the Phase 5 owned runtime/cache factories provide established examples of genuine production-owned leaf contracts.

### Established Patterns

- Tests mirror production modules one-to-one and assert public results, exact persisted bytes/state, notification sequences, cleanup, and ordering.
- Production composition supplies real adapters; tests replace only narrow typed collaborators. Real case-owned temporary state is preferred over process-global interception.
- `npm run check` combines typecheck, ESLint, Fallow, formatting, unit tests, and integration tests; ESLint and Fallow impose independent complexity and boundary gates.
- Architecture gates require planted offenders and benign controls, not configuration-existence assertions.

### Integration Points

- `extensions/pi-claude-marketplace/shared/notify.ts` owns the closed notification envelope, row rendering, cascade composition, tallies, severity, and dispatch; catalog UAT consumes those contracts.
- `extensions/pi-claude-marketplace/domain/resolver.ts` spans schema/union contracts, source and manifest resolution, component paths, closed-set behavior, and installability policy.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `update.ts`, `reinstall.ts`, and `list.ts` remain the command-flow owners whose responsibilities and tests must move without forwarding paths.
- Authorized builtin-patch removal spans terminally routed command discovery, hook routing/staging, selected plugin flows, reconcile apply, and path safety; the live ledger, not a raw text census, determines which uses Phase 6 may change.

</code_context>

<specifics>
## Specific Ideas

- Treat old-path deletion as a proof obligation: ownership is complete only when the stale-path scan is empty.
- Prefer a clear new API even when it requires broad caller migration, but make that migration one atomic change with no compatibility tail.
- Keep exact expected output independently authored at the closest owner boundary so production renderers, documentation, and tests cannot all share the same mistake.

</specifics>

<deferred>
## Deferred Ideas

- The unused-type-member gate described in `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` remains evidence-only history for Phase 9 closure; no new terminal evidence authorizes it here.
- The info split remains independently deferred, and uninstall remains a cohesive transactional flow outside `MF-DEC-02`.
- `tests/bridges/skills/stage.test.ts` remains unchanged without a dedicated terminal finding, despite appearing in the raw builtin-patch census.

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — reviewed and left deferred because REQUIREMENTS.md explicitly classifies the unused-type-member proposal as evidence-only without terminal authorization.

</deferred>

---

*Phase: 06-assertion-and-module-refinement*
*Context gathered: 2026-09-08*
