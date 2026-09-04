# Phase 114: Plugin and Marketplace Lifecycle - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the 14 marketplace and plugin lifecycle
modules listed in the roadmap. Each pair must reach 100 percent direct function, line,
and branch coverage while preserving public outcomes, exact notifications, persistence,
atomic mutation, rollback, retry, cache, authentication, and offline behavior. This phase
may repair a demonstrated product defect required by a locked public contract, but it does
not redesign lifecycle semantics, widen production APIs for tests, or absorb Phase 115
composition ownership.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

- **D-01:** Normalize and re-prove all 14 owners, including accepted-HEAD `PASS` tests.
  Baseline triage is input, not completion evidence.
- **D-02:** Every runtime case uses separate lowercase `// arrange`, `// act`, and
  `// assert` phases with canonical blank lines. Lowercase `// act & assert` is limited
  to one `assert.throws()` or `assert.rejects()` expression.
- **D-03:** Every case constructs complete, case-local inputs and independently authored
  complete expectations. Passive values are fresh plain typed data. Genuine interaction
  mocks use exact counts and explicit verification; `anyTimes()` is prohibited.
- **D-04:** Alphabetize presentation-only inventories, static catalogs, and
  non-behavioral tables. Preserve caller, scope, reason, transaction, rollback,
  declaration, and lifecycle order wherever sequence carries behavior.

### Contract authority and product corrections

- **D-05:** Current shipped public contracts outrank stale test expectations. Correct a
  historical test when it conflicts with a newer locked contract. Change production only
  for a demonstrated product defect supported by public-contract evidence or to remove
  CodeGraph-proven private unreachable code under D-UTR-12. An unreachable-code
  simplification must preserve every public outcome and cannot add a test seam, export,
  pragma, or coverage exception.
- **D-06:** Keep plugin update's current `ContentReason[]` runtime and public output
  behavior. Correct the misleading comment that lists only four skipped reasons, and
  directly prove every produced class, including transport, degradation, disabled-state,
  manifest, and installability reasons. Do not narrow the exported reason type or remap
  truthful reasons to fit the stale comment.
- **D-07:** Preserve GitHub, URL, and git-subdir sources as installable. The historical
  plugin-update failures that treated GitHub-shaped sources as structurally unavailable
  are stale fixtures; genuinely unsupported inputs must carry those test partitions.
- **D-08:** Restore the locked OR-12 product correction: plugin update must pass staged
  skill names into generated-agent staging so agent skill preloads survive update unless
  the source changes them. Prove this through the exported update workflow.
- **D-09:** Preserve and directly prove the OR-13 product correction that non-fatal
  bridge staging warnings survive a successful update. Also prove the production-reachable
  credential and Device Flow ports through exported network-capable lifecycle workflows.

### Direct, cascade, and orchestrated behavior

- **D-10:** Require semantic parity between direct and cascade/orchestrated paths for
  state transitions, statuses, reasons, causes, and reload semantics.
- **D-11:** Maintain a named, exhaustive allowlist of intentional context differences:
  notification suppression, config write-back suppression, companion-extension severity,
  discovery-warning placement, envelope/cardinality shape, and batch-abort behavior.
  Do not require byte or severity parity where the public contract deliberately differs.
- **D-12:** Direct plugin-update sync or preparation failure may abort its batch;
  `updateSinglePlugin` remains cascade-safe and returns a typed outcome. Manual update may
  report missing companion extensions differently from background autoupdate. Each
  difference must be explicit and regression-tested rather than inferred from separate
  test files.

### Atomicity, rollback, cleanup, and retry

- **D-13:** Prove atomicity at the contract's actual mutation unit, not as fictional
  whole-command rollback. A pre-mutation failure leaves no change; each committed
  artifact or state transition is atomic; designed partial outcomes expose their exact
  committed and uncommitted effects.
- **D-14:** Exercise each semantically distinct forward and undo failure boundary.
  Assert failing-phase undo, reverse compensation order, structured partial/leak
  reporting, authoritative state bytes, and remaining on-disk artifacts where owned by
  the lifecycle module.
- **D-15:** Prove safe retry after every material partial or cleanup failure. A second
  invocation must converge, complete documented best-effort cleanup, or repeat the same
  safe failure without corrupting state or duplicating artifacts.
- **D-16:** Preserve documented batch behavior: an earlier target may remain committed
  when a later target fails. Uninstall and marketplace-remove post-commit cleanup remains
  best-effort when that is the current contract; the next idempotent pass must clean or
  safely report leftovers.

### Offline and external boundaries

- **D-17:** Use fresh stateful Git, credential, Device Flow, and Pi contract fakes plus
  case-owned local fixture trees. Use loopback or Unix resources only when the transport
  or filesystem kind itself is under test. Never use live remotes or developer
  credentials.
- **D-18:** Install fail-fast external fakes in every offline case. Marketplace and plugin
  list, bare info, uninstall, marketplace remove, path-source operations, warm
  SHA-pinned cache operations, and reinstall's recorded-SHA path must prove zero
  unexpected network, Git, credential, or subprocess calls.
- **D-19:** Treat explicit `info --fetch`, cold-cache git operations, marketplace git
  add/update, and other documented network-capable arms as network-capable only through
  their injected production ports. Bare info remains filesystem-only.

### Supplemental ownership

- **D-20:** Absorb the 75 single-owner cases from lifecycle supplementals into their
  exact mirrored owners. Split combined update/reinstall authentication evidence by the
  production owner that emits each behavior.
- **D-21:** Retain genuine cross-module identities only: move the six marketplace-add
  seed/mirror cases and the one install → update → reinstall → uninstall lifecycle chain
  under `tests/integration/`. Do not flatten those seven cases into one owner or add
  correspondence-gate exceptions.
- **D-22:** Remove a supplemental only after its unique evidence is present in the owner
  or named integration carrier. The final tree must have no duplicate single-module
  oracle and no exception for the seven current lifecycle supplemental paths.

### the agent's Discretion

- Choose exact case names, concern-local factories, and the smallest complete failure
  matrix that proves each distinct result without deriving expected values.
- Choose whether a demonstrated correction is one narrow production edit or a local type
  refinement, provided public behavior, persistence formats, and test-only-surface rules
  remain intact.
- Choose plan waves and dependencies. P114-14's reason and preload contract must settle
  before P114-06 consumes update outcomes; P114-03 and P114-04 can proceed independently.
- Choose the final integration filenames for the seed/mirror and lifecycle-chain flows,
  provided they live under `tests/integration/` and retain their named end-to-end identity.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 114 boundary, all 14 source-test pairs, dependencies,
  success criteria, and plan inventory.
- `.planning/REQUIREMENTS.md` — `MOD-07`, `PRES-02`, and the case structure, assertions,
  doubles, direct coverage, pair-atomic delivery, preservation, and suite-quality rules.
- `.planning/PROJECT.md` — v1.19 intent and locked decisions for lowercase phases,
  alphabetical presentation, public-surface compatibility, passive typed data, and exact
  interaction verification.
- `.planning/inputs/unit-test-refactor-handoff/DECISIONS.md` — authoritative replay and
  reconsider dispositions, including all eight preserved product corrections.
- `.planning/inputs/unit-test-refactor-handoff/ORACLE-SCENARIOS.md` — observable oracle
  contracts, especially OR-12 update skill preloads and OR-13 staging warnings.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable lowercase AAA, independent
  expectation, role-correct double, direct coverage, hermetic process-state, filesystem,
  and strong-mock rules.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative rationale and full
  TypeScript examples for the same contract.

### Product and output contracts

- `.planning/inputs/unit-test-refactor-handoff/BEHAVIOR-CONTRACTS.yaml` — atomic write,
  retry, network, containment, scope, update correction, and lifecycle behavior authority.
- `.planning/inputs/unit-test-refactor-handoff/PUBLIC-SURFACE.yaml` — command, error,
  notification, reason, and typed-port authority.
- `.planning/inputs/unit-test-refactor-handoff/PERSISTENCE-CONTRACTS.yaml` — state,
  config, schema, and migration replay authority.
- `docs/messaging-style-guide.md` — exact notification grammar, reason taxonomy,
  severity, scope, tally, trailer, and ordering rules.
- `docs/output-catalog.md` — accepted user-visible lifecycle output and reload behavior.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Phase 113 directly proved the presenter contexts, reason classifiers, auth host bundle,
  clone cache/GC, git source probe, generated-name discovery, state classifier, scope
  fan-out, and shared lifecycle helpers consumed by these 14 workflows.
- `runPhases()` owns failing-phase undo, reverse compensation, and rollback-failure
  aggregation. Lifecycle owners should assert its exported effects rather than recreate
  a test-side transaction engine.
- `withLockedStateTransaction()` and atomic persistence/staging seams provide the real
  mutation boundaries. Case-owned temporary trees can prove committed bytes, leftovers,
  and retry behavior without a production reset seam.
- Existing `createGitOpsFake`, `createCredentialOpsFake`, and disabled-network Device
  Flow fakes are stateful contract doubles suitable for lifecycle owners.
- `notifyWithContext()` and the Phase 113 command contexts provide exact direct/cascade
  output construction; lifecycle owners control invocation mode, result grouping, and
  the intentional suppression or severity differences.

### Established Patterns

- Add, autoupdate, remove, enable/disable, install, and uninstall expose explicit direct
  versus orchestrated modes. Orchestrated mode can suppress notifications and config
  write-back while returning a typed outcome.
- Plugin update is a heterogeneous three-phase flow. Phase 3a intentionally collects
  bridge failures, structured rollback-partial output is public, and bulk updates can
  retain earlier successful targets.
- Read-only list/info and destructive cleanup paths stay offline. Network work occurs
  only through explicit git-source or fetch paths and their injected ports.
- Warm SHA-pinned cache materialization returns before cloning. Reinstall consumes the
  recorded SHA and does not resolve a remote pin. Bare info is filesystem-only; `--fetch`
  intentionally selects the network-capable probe.
- Presentation inventories are alphabetical, while scope precedence, input order,
  transaction order, rollback order, and reason order are behavioral.

### Known Corrections and Mismatches

- The current `PluginUpdateSkippedOutcome` prose names four reasons, but live producers
  truthfully emit more `ContentReason` values. Update the prose and prove the full
  producer set; do not narrow or remap runtime output.
- The historical update test mismatch came from treating GitHub-shaped sources as
  unavailable. GitHub/git URL sources are now intentionally installable; unsupported npm
  or other genuinely unavailable inputs own the structural-decline cases.
- Plugin install and reinstall pass staged skill names into generated-agent staging.
  Plugin update currently omits that `knownSkills` threading, violating locked OR-12;
  Phase 114 must restore it through the smallest production correction.
- Update already collects non-fatal bridge warnings. The owner must prove their complete
  surfaced order and keep successful state/artifacts authoritative.
- The marketplace-add Unix-socket baseline failure is an environment restriction around
  filesystem shape evidence, not proof of a product or network defect.

### Supplemental Inventory

- Seven current lifecycle supplemental files contain 82 cases.
- Seventy-five cases are single-owner evidence for marketplace update transport, plugin
  info/list manifest absence, plugin install authentication, and plugin update/reinstall
  authentication; these move into their mirrored owners.
- Six marketplace-add seed/mirror cases compose add, clone GC, and git-source probing;
  one lifecycle cascade case spans install, update, reinstall, and uninstall. These seven
  remain named integration evidence under `tests/integration/`.

### Integration Points

- P114-14 defines plugin update outcomes consumed by P114-06's marketplace autoupdate
  cascade, so its reason and preload correction is an upstream planning dependency.
- Phase 115 composition owners call these lifecycle workflows in import, bootstrap, and
  reconcile schedules; Phase 114 must leave typed outcomes and orchestrated modes stable.
- Phase 116 edge handlers depend on lifecycle option shapes, exact notify behavior, and
  thrown-versus-returned contracts.

</code_context>

<specifics>
## Specific Ideas

- For each mutation, capture complete pre-state bytes and owned-tree inventory, inject a
  single named failure, assert the exact outcome plus committed/rolled-back bytes, then
  retry with a fresh or repaired collaborator and assert convergence.
- Build literal direct-versus-orchestrated parity tables containing the shared semantic
  fields and the explicit allowlisted differences. Do not derive one expected path from
  the other.
- Give every offline case a fake that throws on an unexpected Git, credential, HTTP, or
  subprocess call. A passing operation without the fail-fast boundary is not offline
  proof.
- Preserve exact lowercase runtime comments everywhere: `// arrange`, `// act`, and
  `// assert`; use lowercase `// act & assert` only for one throwing or rejection
  expression.
- Keep expected user-facing inventories alphabetical, and add a short reason beside any
  visibly unsorted expectation whose order is contractual.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 114 scope. Phase 115 retains composition-level
failure isolation and arm-application ownership.

</deferred>

---

_Phase: 114-Plugin and Marketplace Lifecycle_
_Context gathered: 2026-09-01_
