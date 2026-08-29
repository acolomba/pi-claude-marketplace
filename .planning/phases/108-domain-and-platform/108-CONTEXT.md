# Phase 108: Domain and Platform - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the 23 domain and platform production modules. Each pair must reach 100 percent direct function, line, and branch coverage while preserving current public behavior. The phase also lands the resolver's `installable: true | false` discriminant and proves that the production and fake Git, credential, and device-flow adapters satisfy the same public contracts without live network access, developer credentials, or test-only production exports.

</domain>

<decisions>
## Implementation Decisions

### Existing PASS tests

- **D-01:** Normalize all 19 Phase 108 owner tests that already pass focused coverage. Do not limit changes to the smallest patch when a test does not follow the v1.19 unit-testing structure. — **Reversibility:** costly — Reverting this convention would touch the owner and supporting tests across the 204-pair milestone.
- **D-02:** Every runtime case created or modified during v1.19 uses explicit lowercase `// arrange`, `// act`, and `// assert` comments in that order, separated according to the canonical guideline. Every generated pair plan must state this requirement.
- **D-03:** A single assertion expression can use lowercase `// act & assert`. Type-only owner tests use `satisfies` checks and `@ts-expect-error` negatives without artificial runtime cases or phase comments.
- **D-04:** Apply the normalization to all 204 owner tests and every contract, fake, negative-control, or supplemental case created or modified during v1.19. Do not sweep untouched legacy supplemental suites solely to change comments.
- **D-05:** The canonical rule and guideline already specify lowercase comments. Treat them as locked references; do not rewrite preserved handoff inputs or create documentation churn where the required wording is already present.

### Shared adapter contracts

- **D-06:** Give Git, credential, and device-flow one concern-local reusable contract registrar each. Production-adapter and fake-adapter test modules invoke the same registrar independently with a fresh factory for every case.
- **D-07:** Keep Git and credential contracts, fakes, seeds, and supplemental tests under `tests/platform/`. Keep device-flow support under `tests/domain/`. Relocate the relevant support from generic `tests/helpers/` into those concern directories.
- **D-08:** The shared contract covers the complete public port: every public operation's results, stable errors, mutation and aliasing behavior, ordering, and validation where applicable. Record explicitly when a category does not apply.
- **D-09:** Transport mechanics and fake-only controls are not part of the shared contract. The production owner test runs the shared contract and adds transport, process, filesystem, or HTTP cases needed for its paired source's direct coverage. The fake supplemental test runs the shared contract and tests only genuinely public fake behavior.
- **D-10:** The correspondence gate must classify fake and contract tests as supplemental evidence. They do not own a production source and do not replace the mirrored owner test.

### Broken-adapter controls

- **D-11:** Represent contract cases as callable functions as well as `node:test` registrations. A negative-control case can therefore invoke one contract case against a broken adapter and observe the assertion failure without spawning a nested test process.
- **D-12:** Git, credential, and device-flow each get one private broken implementation with one surgical defect aimed at a central public invariant.
- **D-13:** Each broken implementation must pass all remaining contract cases and fail exactly one named case. State the expected invariant independently of the contract implementation so the negative control does not compute its answer from the code it is proving.
- **D-14:** Keep the broken implementation and its negative-control case inside the fake adapter's concern-local supplemental test module, beside the fake's normal contract invocation. Do not create separate `*-contract-negative.test.ts` modules.

### Hermeticity boundary

- **D-15:** Exercise the production Git adapter against fresh per-case temporary local repositories and real local filesystem semantics. Inject or block remote transport, credentials, and time; do not substitute the local Git CLI for the production adapter.
- **D-16:** Exercise `createCredentialOps` through a deterministic injected `CredentialSpawn`. Cover stdin, stdout, exit, error, timeout, termination, and cleanup without invoking `git credential`, a keychain, or developer configuration.
- **D-17:** Test device-flow HTTP by replacing `globalThis.fetch` through the current test context, returning a fresh `Response` per call, and asserting exact method, URL, headers, and body. Inject polling waits so no live network or real timer runs.
- **D-18:** Provide concern-local guarded test factories that require explicit local or fake boundaries and throw when a required boundary is missing. Use poison controls for remote URLs and credential access. Do not add a generic global test harness.
- **D-19:** Every mutable global, mock, timer, environment change, and temporary directory belongs to the current case and is restored or removed by that case.

### the agent's Discretion

- Choose names and exact file splits for concern-local contract, fake, seed, and guarded-factory support, provided the files remain beside their concern and satisfy one-to-one owner-test enforcement.
- Choose the single planted fault and named discriminating case for each adapter contract from its most central public invariant.
- Choose which public-contract categories are inapplicable to a port, but record the rationale in the owning plan or test.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 108 boundary, 23 source-test pairs, resolver carrier, adapter-contract success criteria, and phase sequencing.
- `.planning/REQUIREMENTS.md` — `RES-01`, `MOD-01`, `PRES-03`, `PRES-04`, pair ownership, direct coverage, production-design, hermeticity, and suite-quality requirements.
- `.planning/PROJECT.md` — v1.19 milestone intent, pair-atomic delivery policy, preserved public-contract constraints, and accepted brownfield baseline.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — concise executable rules, including lowercase case markers, test-double roles, direct coverage, concern-local support, adapter contracts, and negative controls.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — full normative rationale and examples for the TypeScript unit-testing rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/helpers/git-mock.ts`: existing in-memory `GitOps` fake and call-state pattern; use as migration input for concern-local platform support rather than preserving the generic helper location.
- `tests/helpers/credential-mock.ts`: existing closure-scoped `CredentialOps` fake with per-method calls, failure controls, and no keychain/process access; relocate beside platform tests and adapt it to the shared contract.
- `tests/helpers/device-flow-mock.ts`: existing programmable `DeviceFlowHttp` fake with request/poll queues and no HTTP or real waits; relocate beside domain tests and adapt it to the shared contract.
- `extensions/pi-claude-marketplace/platform/git-credential.ts`: `createCredentialOps({ spawn, timeoutMs })` already exposes the deterministic process seam required by D-16.
- `extensions/pi-claude-marketplace/domain/github-auth.ts`: `DeviceFlowHttp`, `makeDeviceFlowHttp`, and `initiateDeviceFlow({ http, waitForPoll })` provide the HTTP and polling seams required by D-17.

### Established Patterns

- Source and owner-test paths mirror the `extensions/pi-claude-marketplace/` and `tests/` trees one to one.
- Domain modules are pure, network-free resolution and validation code. Platform modules are thin typed wrappers over Git, credentials, and the Pi API.
- Testability changes use explicit dependency injection or a narrow public port. Production code must not add reset hooks, state readers, or test-only exports.
- Whole public values, stable typed errors, exact bytes, and exact promised interactions are asserted independently from production computations.
- The accepted Phase 108 baseline has 19 focused-coverage passes, two coverage failures (`components/hooks.ts`, `source.ts`), and two missing owner tests (`resolver.ts`, `platform/git.ts`). Passing triage remains brownfield input, not completion evidence.

### Integration Points

- `extensions/pi-claude-marketplace/domain/resolver.ts` and its consumers must narrow first on `installable`. Only the true arm exposes `pluginRoot`; the existing three-way `state` remains secondary detail.
- Resolver consumers extend into later orchestrator phases. Phase 108 planning must trace every caller and preserve pair-atomic ownership while achieving the repository-wide type contract.
- Git, credential, and device-flow fakes are imported by tests outside Phase 108. Their relocation requires updating affected test imports without claiming completion for those later production pairs.
- Shared-contract or fake changes require focused validation of both participants and the all-pair coverage command required by the canonical guideline.

</code_context>

<specifics>
## Specific Ideas

- The exact phase comments are lowercase: `// arrange`, `// act`, `// assert`, and `// act & assert`.
- Normalization is intentional even for the 19 Phase 108 owner tests that already pass direct coverage.
- A broken adapter is useful only when its defect is localized: exactly one independently named contract case fails and every other case stays green.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 108-Domain and Platform*
*Context gathered: 2026-08-28*
