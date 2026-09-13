# Phase 3: Production Defect Corrections - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 corrects only the production defects that Phase 1 terminally confirmed
and routed to `PDEF-01`, `PDEF-05`, `PDEF-06`, `PDEF-07`, or `PDEF-08`.
Every correction lands with a direct regression in the owning test module.

This phase includes typed failure classification, update cleanup and diagnostic
preservation, safe dynamic lookups, trace-preserving removal of unreachable
test-shaped branches, reconcile alias resolution, multi-directory agent
discovery, compact-trigger translation, rollback error ownership, and the
production-output corrections already selected by the Phase 1 decisions.
Stale, struck, superseded, supporting-only, and evidence-only claims do not
authorize changes.

</domain>

<decisions>
## Implementation Decisions

### Scope and sequencing

- **D-01:** Derive the implementation inventory from the active Phase 3 scope
  changes and terminal finding records in `01-REVALIDATION.json`; the historical
  review corpus supplies provenance, not independent authorization.
- **D-02:** Give every changed production owner a regression that demonstrably
  fails without its correction. Keep each defect and its owner regression
  independently reviewable where dependencies allow.
- **D-03:** Land behavior corrections before later test-architecture work and
  before the approved Phase 6 module splits. Do not combine a correction with a
  size-only extraction.

### Agent discovery (`PDEF-08`)

- **D-04:** Preserve the agents bridge's real multi-directory contract. Consume
  every resolved `componentPaths.agents` directory instead of flattening the
  list to its first member.
- **D-05:** Preserve resolved directory order and the bridge's deterministic
  first-wins duplicate policy. A later duplicate generated name is skipped with
  the existing discovery-warning behavior; it must not silently replace the
  first agent.
- **D-06:** Use the resolved plugin component paths as the production source of
  truth. Remove the single-directory asymmetry and any now-redundant flattened
  input rather than maintaining two competing agent-source representations.
- **D-07:** Prove a plugin with a declared agents directory plus the conventional
  `agents/` directory materializes agents from both, and prove duplicate handling
  across the two directories.

### Compact triggers (`PDEF-08`)

- **D-08:** Translate Pi compaction reasons with the direct three-to-two mapping:
  `manual` becomes Claude `manual`; `threshold` and `overflow` become Claude
  `auto`.
- **D-09:** Apply the same mapping to pre-compact and post-compact payloads.
  Update the associated supportability contract so both events admit exactly the
  translated `manual` and `auto` matcher values.
- **D-10:** Replace stale fixtures and comments rather than preserving the old
  constant-`auto` behavior. Give each Pi reason an independently asserted case
  in both payload owner suites, plus the relevant closed-set architecture proof.

### Rollback errors (`PDEF-08`)

- **D-11:** Ship the existing ES-4 rollback cause-chain contract and make
  `formatRollbackError` the single production rule used by the install ledger.
  — **Reversibility:** costly — removing the cause-chain later would change
  diagnostic behavior across the transaction-to-install boundary and require
  coordinated test and documentation changes.
- **D-12:** Preserve the original `PathContainmentError` object verbatim and
  suppress rollback-partial framing for that safety path. Preserve the original
  error object when no rollback partial exists. When partials exist, wrap once
  with the original error as `cause` and carry the structured partial rows.
- **D-13:** Delete the duplicate install-side formatting logic and correct every
  caller comment in the same change. Prove both the transaction owner and the
  live install integration; a test-only rollback module is not an acceptable
  endpoint.

### Typed failure classification (`PDEF-05`)

- **D-14:** Known lock-contention, sibling-sweep, and malformed-input outcomes
  must be classified from explicit error types, discriminants, or stable error
  codes. Error names and user-controlled message text are diagnostic data only,
  never control flow.
- **D-15:** Map the existing `StateLockHeldError` explicitly to the closed
  `lock held` reason wherever the terminal uninstall/cascade path reaches it.
  Align sibling narrowers for the same cause instead of letting equivalent
  failures render different reasons.
- **D-16:** Keep typed classifiers with their production owner unless two or
  more live owners genuinely share the same domain rule. Shared transport and
  errno helpers may be reused; do not create a universal error taxonomy.
- **D-17:** Remove message-substring fallbacks for the confirmed known cases.
  Unknown failures use the owner's existing honest generic reason. Regression
  cases must vary the human-readable message while preserving the typed signal
  to prove classification is message-independent.

### Cleanup, warnings, and diagnostics (`PDEF-06`)

- **D-18:** The operation's original failure remains the primary error. Cleanup
  failure never replaces it, changes its reason, or erases its cause chain.
- **D-19:** Carry cleanup problems as structured, readonly context using the
  existing phase/bridge failure channels where possible. Render text only at the
  notification boundary; do not make later control flow parse a cleanup string.
- **D-20:** Capture every terminal update prepare, abort, commit, and rollback
  cleanup descriptor currently discarded, including commands and skills paths.
  Successful cleanup adds no warning.
- **D-21:** For each failure-path regression, assert the primary error by
  identity or cause, assert the exact cleanup context, and inspect the temporary
  filesystem to prove no staging, backup, or temporary artifact remains. If
  cleanup itself is deliberately failed, assert the exact residual-artifact
  descriptor instead of pretending removal succeeded.
- **D-22:** Do not broaden terminal update cleanup work into the separately
  deferred warning-channel product decisions.

### Dynamic lookups and unreachable branches (`PDEF-07`)

- **D-23:** Guard open-string lookup tables with own-key membership or a `Map`.
  Prototype members such as `constructor` and `toString` are unsupported input,
  not valid table entries or fallbacks.
- **D-24:** Preserve real trust-boundary guards. Remove only branches proven to
  have no production producer, or restructure locally so compiler-forced
  fallbacks become honestly reachable through the public contract. Delete the
  artificial test case with the removed branch.
- **D-25:** Do not add ignore pragmas, test-only exports, invalid casts, prototype
  mutation, or mutable-discriminator fixtures to manufacture coverage.

### Reconcile aliases and selected output behavior (`PDEF-01`, `PDEF-08`)

- **D-26:** Carry the resolved Phase 1 alias decision unchanged: resolve declared
  plugin keys through a one-to-one declared-key-to-recorded-name source-claim
  map, preserve the manifest-derived canonical state identity, and fail closed
  when a claim is absent or ambiguous.
- **D-27:** Exercise the alias plan and apply path with distinct independently
  authored declared and manifest names. Apply twice and prove fixed-point
  convergence with no repeated failure or network work.
- **D-28:** Carry the resolved structural-cardinality decision unchanged. Current
  `notifyWithContext` producers must declare single versus plural from invocation
  structure, never row count; newly visible tallies require exact output-catalog
  and owner-test updates in the same change.

### the agent's Discretion

- Choose local type and helper names, and choose the smallest production-owned
  placement that satisfies the contracts above.
- Sequence independent owner corrections to minimize overlapping edits in the
  large update and notification modules.
- Choose whether a cleanup detail extends an existing failure record or uses a
  narrowly scoped sibling type, provided it remains structured and readonly.
- Choose the exact own-key implementation (`Object.hasOwn` or `Map`) that best
  fits each existing lookup table.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active scope and evidence authority

- `.planning/ROADMAP.md` § Phase 3 — phase goal, boundary, dependencies, and
  success criteria.
- `.planning/REQUIREMENTS.md` § Production Correctness — authoritative
  `PDEF-01`, `PDEF-05`, `PDEF-06`, `PDEF-07`, and `PDEF-08` requirements.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` —
  canonical terminal findings, source/test references, scope changes, and
  resolved decisions.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` —
  rules for interpreting terminal status, routes, and scope changes.
- `.planning/phases/01-live-evidence-revalidation/01-CONTEXT.md` — evidence
  authority, hermetic probe, and direct-owner regression constraints.
- `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md` — prior
  safety, typed-result, filesystem, and no-broad-redesign decisions.

### Historical finding dossiers

- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` § Production bugs
  found by this sweep — umbrella defect descriptions and production-first
  sequencing provenance.
- `.planning/reviews/unit-test-adversarial/adversarial/bridges-agents.md` —
  multi-directory agent contract mismatch and owner-test evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/bridges-hooks-payloads.md`
  — compact reason/trigger drift and supportability consequences.
- `.planning/reviews/unit-test-adversarial/adversarial/transaction.md` — dead
  rollback helper, live duplicate path, and ES-4 alternatives.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-list-uninstall-b.md`
  — lock-held uninstall classification evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-update-a.md`
  — message-substring reason and discarded cleanup-descriptor evidence.
- `.planning/reviews/unit-test-adversarial/adversarial/domain-components.md` —
  open-key lookup defects and prototype-key probes.
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-reconcile-apply.md`
  — declared-alias dead end and equal-fixture blind spot.

### Current codebase guidance

- `.planning/codebase/TESTING.md` — direct owner tests, real temporary
  filesystems, injected collaborators, and typed error assertions.
- `.planning/codebase/STRUCTURE.md` — module ownership and integration points.
- `.planning/codebase/CONCERNS.md` — current risk map; verify every dated concern
  against the terminal ledger before acting on it.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/bridges/agents/discover.ts` already accepts
  ordered agent directories and implements deterministic first-wins dedup.
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` and
  `shared/errors.ts` provide established typed/code-based classification
  patterns.
- `extensions/pi-claude-marketplace/transaction/rollback.ts` already expresses
  the selected rollback result and cause-chain rules.
- `extensions/pi-claude-marketplace/shared/notify.ts` owns structured reasons,
  cardinality, and final message rendering.
- Existing staging helpers already return cleanup descriptors on several bridge
  paths; Phase 3 must retain and route them instead of recomputing strings.

### Established Patterns

- Use public production interfaces, case-owned temporary filesystems, and
  injected doubles for external boundaries.
- Keep semantic classification separate from message rendering.
- Compare exact typed outcomes, state, and bytes when behavior or persistence
  changes.
- Keep shared policy at leaf modules only when the rule is genuinely shared.

### Integration Points

- Agent paths flow from resolved component paths through plugin install,
  update/reinstall discovery, and the agents stage bridge.
- Compact reasons flow from Pi session events through pre/post compact payload
  translators and hook-event supportability tables.
- Rollback partials flow from `runPhases` through the install orchestrator into
  structured notification payloads.
- Update cleanup descriptors flow through prepare, abort, commit, rollback,
  phase-failure composition, and direct/cascade outcomes.
- Reconcile source claims flow from marketplace planning into plugin action
  classification and apply convergence.

</code_context>

<specifics>
## Specific Ideas

- Treat human-readable error text as mutable diagnostics in regression cases;
  the classified reason must remain stable when that text changes.
- Use `manual`, `threshold`, and `overflow` as three distinct source fixtures for
  each compact translator rather than deriving expected values from production.
- Alias fixtures must use visibly different names such as a declared alias and a
  manifest-derived canonical name so equality cannot hide the mapping defect.
- A cleanup regression is incomplete unless it checks both reported context and
  the resulting filesystem.

</specifics>

<deferred>
## Deferred Ideas

- Broad resolver, notify, install, update, reinstall, list, and catalog module
  splits remain in Phase 6 after production behavior is corrected.
- Assertion-strength, test-double, hidden-dependency, and broader hermeticity
  work remains in Phases 4-6 unless a direct Phase 3 owner regression requires a
  narrowly scoped fixture.
- Coverage and general gate enforcement remain in Phases 7-8.
- Warning-channel product decisions `ENWARN-01`, `UPCASC-01`, and `WCHAN-01`
  remain outside this milestone scope.

### Reviewed Todos (not folded)

- `Detect unused code and type members in the real production program` remains
  assigned to Phase 7. It is a structural gate and does not correct a Phase 3
  production defect.

</deferred>

---

_Phase: 03-production-defect-corrections_
_Context gathered: 2026-09-06_
