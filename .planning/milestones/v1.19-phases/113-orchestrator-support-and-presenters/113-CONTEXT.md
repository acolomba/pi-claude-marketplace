# Phase 113: Orchestrator Support and Presenters - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the 35 orchestrator support and presenter
modules listed in the roadmap. Each pair must reach 100 percent direct function, line,
and branch coverage while preserving public message construction, classification,
probing, discovery, import planning, reconcile planning, scope fan-out, path/cache
support, and type contracts. This phase proves the helpers that lifecycle and composition
orchestrators consume; it does not redesign those workflows or widen production APIs for
tests.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

- **D-01:** Normalize and re-prove all 35 owners, including accepted-HEAD `PASS` tests.
  Baseline triage is input, not completion evidence.
- **D-02:** Every runtime case uses separate lowercase `// arrange`, `// act`, and
  `// assert` phases with the canonical blank lines. Lowercase `// act & assert` is
  limited to one `assert.throws()` or `assert.rejects()` expression. Data rows use
  separate phases.
- **D-03:** Every case constructs complete, case-local inputs and independently authored
  complete expectations. Small concern-local factories may return fresh setup values but
  must not calculate expected results or become shared scenario oracles.
- **D-04:** Type-only modules and contracts stay at module scope through positive
  `satisfies` checks and targeted negative `@ts-expect-error` checks. Do not invent
  runtime assertions for erased types or widen production exports for tests.

### Classifiers and planners

- **D-05:** Use partition-complete behavior matrices. Cover every meaningful decision
  branch and boundary, and exhaustively enumerate a state space only when it is small and
  closed. Do not multiply behaviorally equivalent input combinations.
- **D-06:** Assert the complete structured return value for every case, including action
  or classification, codes, reasons, severity, scope, ordering, diagnostics, and true
  omission of optional fields. Downstream effects are not a substitute for the direct
  helper contract.
- **D-07:** Exercise malformed and unexpected values only where they can enter through a
  real untrusted boundary such as files, environment, subprocess results, or external
  data. Do not use casts to fabricate impossible internal union members merely to reach
  an `assertNever` or defensive default.
- **D-08:** Express large matrices as named literal table cases. Each row carries its
  input and complete expected result; input factories may reduce setup noise, but no
  test-side reference implementation may derive the answer.

### Message producers

- **D-09:** Prove both owned layers: the complete structured message or command context
  and the exact rendered row bytes produced by that module. Shared notification behavior
  stays in its owner unless the presenter controls the label, cardinality, trailer, or
  other final bytes.
- **D-10:** Ordering is contract-specific. Alphabetize inventories and presentation-only
  collections. Preserve caller input, scope precedence, outer-loop order, reason order,
  and lifecycle operation order wherever sequence carries behavior.
- **D-11:** Cover the complete reload and trailer matrix: exact presence or absence,
  wording, blank-line placement, relationship to tallies, and singular/plural behavior.
- **D-12:** Cover every status arm and every reasons, dependencies, causes, scope, and
  severity variation that changes output or severity. Leave impossible field/status
  combinations to the discriminated TypeScript types rather than forcing them with casts.

### Offline collaborator boundaries

- **D-13:** Use a fresh real temporary filesystem for owned file semantics. Use injected,
  hand-written fakes for git, network, subprocess, credentials, and Pi API boundaries.
  Never mock the production module under test.
- **D-14:** Prove read-only paths stay offline in two layers: owner cases use fail-fast
  external fakes that reject any unexpected call, and architecture tests prohibit direct
  network imports. Successful execution alone is not sufficient offline evidence.
- **D-15:** Assert collaborator arguments, counts, and order when they define public
  behavior, including scope precedence, cache reuse, host selection, or once-only
  authentication. Avoid freezing incidental call structure that can change without
  changing the contract.
- **D-16:** Inject failures at every semantically distinct collaborator operation,
  including selected later calls in multi-call schedules. Assert the complete result or
  diagnostic, cleanup, and whether remaining work continues or stops.

### Ordering and isolation

- **D-17:** Alphabetize user-facing inventories, static catalogs, and non-behavioral test
  tables. Preserve execution, scope, declaration, and lifecycle sequences whose order is
  behavior. Document the reason when a visibly unsorted expectation is intentional.
- **D-18:** Every case owns its temporary tree, fake state, inputs, and expectations.
  Capture exact environment-property existence and value before mutation, restore it in
  `finally`, and never depend on another case's execution or cleanup.
- **D-19:** Create fresh maps, authentication memos, caches, and collaborators per case.
  Exercise unavoidable persistent module state through existing public lifecycle APIs or
  process isolation. Do not add test-only reset exports or cache-busting imports.
- **D-20:** Move single-module assertions into the mirrored owner. Retain supplemental
  tests only for genuine cross-module, integration, parity, or architecture contracts,
  and remove redundant fixtures or assertions that would create a competing owner. —
  **Reversibility:** costly — restoring duplicate suites would weaken the milestone's
  one-source-to-one-owner contract.

### the agent's Discretion

- Choose exact case names and the smallest partition table that proves every distinct
  result while honoring the locked completeness rules.
- Choose concern-local input factories and hand-written fake shapes, provided every call
  returns fresh state and no helper derives expected outcomes.
- Decide which exact presenter assertions belong in a messaging owner versus the shared
  notification owner, using module responsibility and direct coverage as the boundary.
- Choose which existing supplemental tests remain, and document the distinct cross-module
  contract for every retained suite.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 113 boundary, all 35 source-test pairs, dependencies,
  success criteria, and execution order.
- `.planning/REQUIREMENTS.md` — `MOD-06` plus case structure, assertion, doubles, direct
  coverage, production-design, pair-atomic delivery, preservation, and suite-quality
  requirements.
- `.planning/PROJECT.md` — v1.19 intent and locked milestone decisions for complete local
  proof, preserved public surfaces, lowercase phases, and no test-only production seams.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable rules for lowercase phases,
  independent expectations, role-correct doubles, direct coverage, hermetic process
  state, filesystem ownership, type-only modules, and barrels.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative rationale and full
  TypeScript examples for the same contract.

### Presenter and public-output contracts

- `docs/messaging-style-guide.md` — notification grammar, row composition, reasons,
  severity, scope, tallies, hints, and ordering conventions.
- `docs/output-catalog.md` — accepted user-visible command output and reload behavior.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Each `*.messaging.ts` module exposes a command context or outcome-to-message producer;
  its typed render map is total over the status set owned by that command.
- `shared/notify-context.ts` provides the contextual notification dispatch seams, while
  `shared/notify.ts` owns shared row primitives, reason composition, tallies, and trailers.
- `buildAuthForHost()` accepts credential and Device Flow collaborators and an optional
  host-keyed memo; an unsupported host returns no bundle and must not leak another host's
  authentication state.
- `probeManifestEntry()` and `probeUpgradeCandidate()` use the filesystem-only presence
  probe and strict resolver; missing mirrors and probe/resolve failures fold into explicit
  `remote`, `unavailable`, or `undefined` results without invoking git or network code.
- `classifyInstalledRecord()` and `classifyManifestEntry()` are pure closed-state
  classifiers with load-bearing precedence between disabled, degraded, and upgrade
  candidate states.
- `discoverGeneratedNames()` composes skills, commands, and agents discovery and returns
  all generated-name lists plus the selected agents source directory.
- `updatedRowFromOutcome()` centralizes update-row dependencies, ordered reasons,
  severity, partial-degrade shape, reload requirement, and true optional-field omission.
- Import settings, refs, and marketplace planners return structured warnings instead of
  hiding malformed files, non-boolean entries, malformed refs, or unmappable sources.
- Reconcile planning returns explicit add, remove, enable, disable, mismatch, dangling,
  malformed-key, and invalid-block outcomes; source-identity matching and claimed-record
  order prevent perpetual remove/re-add churn.

### Established Patterns

- Read-only support modules use real filesystem reads and injected or leaf-level probes;
  they must not reach the platform git seam or live network.
- Scope fan-out searches project before user when no scope is supplied and preserves that
  outer-loop order in its returned rows.
- Inventory surfaces are bulk/plural and alphabetically presented; mutation and reconcile
  surfaces preserve operation and reason order when it communicates causality.
- Structured message unions use status-specific fields so invalid reasons, details,
  dependencies, and severity combinations fail at compile time.
- Optional message fields are spread only when present; a present `undefined` key is not
  equivalent when exact object shape or rendered bytes are the contract.

### Integration Points

- Phase 114 lifecycle orchestrators consume the presenter contexts, authentication host
  bundles, cache helpers, probes, state classifiers, discovery names, and update rows.
- Phase 115 composition orchestrators consume the import and reconcile plans and project
  their per-entry outcomes through the Phase 113 message producers.
- `shared/notify.ts` remains the central rendering spine; Phase 113 owners prove only the
  command-specific status maps and message construction they contribute to that spine.
- Persistence loaders and `locationsFor()` provide real scope-root behavior for path,
  cache, settings, and scope-fanout cases; external operations stay behind injected
  boundaries.

</code_context>

<specifics>
## Specific Ideas

- Use literal case tables with complete expected objects for closed classifier and planner
  partitions; never compute the expected decision with production-like logic.
- Invoke every owned render-map arm directly and compare exact row strings, including
  braces, scope brackets, version arrows, causes, whitespace, and icon bytes.
- Make unexpected network, git, subprocess, credential, or Pi calls throw immediately so
  a read-only case cannot pass after silently crossing an external boundary.
- Seed temporary settings, manifests, clone metadata, and state files with exact bytes,
  and restore all touched environment keys in the same case's `finally` block.
- Preserve the exact lowercase runtime comments everywhere: `// arrange`, `// act`, and
  `// assert`; use lowercase `// act & assert` only for one throwing or rejection
  expression.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 113-Orchestrator Support and Presenters_
_Context gathered: 2026-08-31_
