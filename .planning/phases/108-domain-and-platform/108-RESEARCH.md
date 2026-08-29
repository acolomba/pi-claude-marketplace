# Phase 108: Domain and Platform - Research

**Researched:** 2026-08-28
**Domain:** TypeScript domain contracts, platform adapters, direct-coverage ownership, and hermetic test architecture
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Existing PASS tests

- **D-01:** Normalize all 19 Phase 108 owner tests that already pass focused coverage. Do not limit changes to the smallest patch when a test does not follow the v1.19 unit-testing structure. — **Reversibility:** costly — Reverting this convention would touch the owner and supporting tests across the 204-pair milestone.
- **D-02:** Every runtime case created or modified during v1.19 uses explicit lowercase `// arrange`, `// act`, and `// assert` comments in that order, separated according to the canonical guideline. Every generated pair plan must state this requirement.
- **D-03:** One throwing/rejection expression can use lowercase `// act & assert`. Ordinary assertions and data rows use separate lowercase phases. Type-only owner tests use `satisfies` checks and `@ts-expect-error` negatives without artificial runtime cases or phase comments.
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-01 | All 23 domain and platform pairs complete the pair contract. | The pair inventory, baseline coverage audit, plan sequencing, and validation map below identify one owner and one focused gate per production source. [VERIFIED: `.planning/REQUIREMENTS.md`:87-90; `.planning/REQUIREMENTS.md`:155-181] |
| RES-01 | Each resolver result exposes `installable: true \| false`; materializable arms use `true`, the `false` arm does not expose `pluginRoot`, and the three-way `state` remains secondary detail. | The resolver section maps the schema change, constructor/narrower changes, compile-time cases, and caller-tracing constraint. [VERIFIED: `.planning/REQUIREMENTS.md`:64-74] |
| PRES-03 | Production and fake Git, credential, and device-flow adapters pass the same public contract cases. | The adapter responsibility matrices define the shared port, production participant, fake participant, contract categories, and owner-only mechanics. [VERIFIED: `.planning/REQUIREMENTS.md`:106-114] |
| PRES-04 | Each adapter contract has an independent negative control. | The negative-control matrix selects one surgical defect and one independently named discriminating case for each contract. [VERIFIED: `.planning/REQUIREMENTS.md`:112-114; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37] |
</phase_requirements>

## Summary

Phase 108 is not a test-file fill-in exercise. It is 23 pair-atomic deliveries: 19 brownfield owners that already pass direct coverage but still require full lowercase AAA and guideline normalization, two owners that exist but miss direct coverage, and two owner modules that do not exist. A prior PASS is explicitly brownfield input, not completion evidence. [VERIFIED: `.planning/REQUIREMENTS.md`:7-10; `.planning/REQUIREMENTS.md`:155-181; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:18-22]

The phase has four carrier responsibilities. P108-18 owns only the resolver discriminant and compile-time contract; its later production consumers remain pair-atomic assignments in P113-24, P114-07/08/09/10/11/12/14, and P115-06/07. P108-21, P108-12, and P108-22 own the credential, device-flow, and Git shared-contract cores respectively. The generic-helper consumer rewrites are distributed into bounded post-carrier batches in P108-02/03/04/05/07, and P108-23 deletes the three generic helpers only after those batches finish. P108-21 owns the supplemental-evidence classifier used by all three contract carriers. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45,94-97; `.planning/REQUIREMENTS.md`:76-85; `.claude/rules/typescript-unit-testing.md`:29-32,186-186,225-225]

Current focused measurements confirm the two coverage repairs are narrow but real: `components/hooks.ts` is at 88.17% lines, 72.73% branches, and 62.50% functions; `source.ts` is at 99.38% lines, 95.06% branches, and 100% functions. Direct coverage fails closed for the absent resolver and Git owners. The current remote-ref supplemental suite also fails in a restricted environment because it binds a loopback HTTP server; replace that protocol stub with an injected `isomorphic-git/http/node` request boundary. [VERIFIED: focused direct-coverage commands run 2026-08-28; `tests/platform/git-remote-refs.test.ts`:1-92; focused `node --test tests/platform/git-remote-refs.test.ts` run 2026-08-28]

**Primary recommendation:** Plan exactly 23 owning-pair commits, run P108-18 and the three adapter carriers in an explicitly serialized order, then parallelize the independent normalization/coverage pairs; require focused test plus 100% direct coverage for every pair and require both adapter participants, the planted negative control, the correspondence gate, all-pair coverage, and `npm run check` at each carrier boundary. [VERIFIED: `.planning/ROADMAP.md`:49-88; `.planning/REQUIREMENTS.md`:76-85,116-128]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain parsing, manifest values, hook schemas, and resolver result construction | API / Backend | — | These are pure typed domain transformations under the extension domain tree; callers inject filesystem or remote policy rather than the domain importing platform services. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:291-304] |
| `installable` result discrimination | API / Backend | — | The resolver schema and narrowing functions own the materializable/unavailable distinction. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:161-261,1689-1744] |
| Git local repository behavior | API / Backend platform adapter | Database / Storage | The platform wrapper delegates to `isomorphic-git` with Node filesystem semantics, while each case owns an isolated temporary repository. [VERIFIED: `extensions/pi-claude-marketplace/platform/git.ts`:1-18,136-320; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Git remote transport and authentication | API / Backend platform adapter | External HTTP / credential boundaries | The wrapper supplies the HTTP client and optional auth callbacks; tests must replace or poison these boundaries. [VERIFIED: `extensions/pi-claude-marketplace/platform/git.ts`:136-179,224-260] |
| OS credential-helper adapter | API / Backend platform adapter | OS process / credential store | `CredentialOps` is implemented by a spawned `git credential` process in production and by an injected deterministic process in tests. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:59-119,303-316] |
| Device-flow state machine and HTTP adapter | API / Backend domain service | External OAuth provider | `initiateDeviceFlow` owns polling/outcomes; `DeviceFlowHttp` owns the two HTTP operations, and polling waits are injectable. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:76-135,347-438] |
| Shared contract, fake, broken control, and guarded factories | Test support tier | Owning API / Backend concern | Support belongs beside the concern and is supplemental evidence, never a production-source owner. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:186-186,225-225; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37] |

## Project Constraints (from AGENTS.md)

- The repository contains `.codegraph/`; implementation and review agents must use `codegraph explore` before grep/find or direct file reads when locating or understanding code. [VERIFIED: `AGENTS.md`:1-10; `.codegraph/` presence checked 2026-08-28]
- CodeGraph results include current line-numbered source and call paths; name the target symbol or file in the query. [VERIFIED: `AGENTS.md`:4-7]

## Pair Inventory and Baseline

Every row remains open even when its HEAD triage is PASS. [VERIFIED: `.planning/REQUIREMENTS.md`:7-10,132-135]

| Pair | Source → owner | HEAD triage | Planning consequence |
|------|----------------|-------------|----------------------|
| P108-01 | `domain/auth-registry.ts` → `tests/domain/auth-registry.test.ts` | PASS | Normalize every runtime case; focused test and direct coverage. |
| P108-02 | `domain/clone-key.ts` → `tests/domain/clone-key.test.ts` | PASS | Normalize every runtime case; focused test and direct coverage. |
| P108-03 | `domain/components/hook-events.ts` → mirrored owner | PASS | Normalize; type-only cases stay compile-time if applicable. |
| P108-04 | `domain/components/hook-if-targets.ts` → mirrored owner | PASS | Normalize; preserve full public values. |
| P108-05 | `domain/components/hook-tool-names.ts` → mirrored owner | PASS | Normalize; preserve full public values. |
| P108-06 | `domain/components/hooks.ts` → `tests/domain/components/hooks.test.ts` | COVERAGE_FAIL | Rewrite/extend owner for all exported projections and reachable validation arms; remove demonstrably unreachable defensive branches instead of ignoring coverage. |
| P108-07 | `domain/components/hooks/matcher.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-08 | `domain/components/hooks/partition.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-09 | `domain/components/hooks/schema.ts` → mirrored owner | PASS | Normalize runtime cases; keep schema/type checks exact. |
| P108-10 | `domain/components/mcp.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-11 | `domain/components/plugin.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-12 | `domain/github-auth.ts` → `tests/domain/github-auth.test.ts` | PASS | Carry device-flow contract/fake/negative control, fetch/wait hermeticity, helper relocation, and import rewrites. |
| P108-13 | `domain/manifest-cache.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-14 | `domain/manifest-lookup.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-15 | `domain/manifest.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-16 | `domain/name.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-17 | `domain/plugin-root.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-18 | `domain/resolver.ts` → missing `tests/domain/resolver.test.ts` | MISSING | Create canonical owner, consolidate legacy resolver suites, add discriminant/type cases, trace callers, and reach direct 100%. |
| P108-19 | `domain/source.ts` → `tests/domain/source.test.ts` | COVERAGE_FAIL | Add non-string input and unequal logical path cases; normalize legacy tables and whole-value assertions. |
| P108-20 | `domain/version.ts` → mirrored owner | PASS | Normalize and run focused gates. |
| P108-21 | `platform/git-credential.ts` → mirrored owner | PASS | Carry credential contract/fake/negative control, deterministic spawn coverage, supplemental-evidence gate support, helper relocation, and import rewrites. |
| P108-22 | `platform/git.ts` → missing `tests/platform/git.test.ts` | MISSING | Create canonical owner, merge legacy Git supplements as appropriate, carry Git contract/fake/negative control, and replace loopback transport. |
| P108-23 | `platform/pi-api.ts` → mirrored owner | PASS | Normalize and run focused gates. |

The exact paths and triage values above come from the accepted inventory. [VERIFIED: `.planning/REQUIREMENTS.md`:155-181; `.planning/ROADMAP.md`:66-88]

### Coverage repair details

**P108-06 (`components/hooks.ts`).** Focused coverage currently misses primitive/array wrapper rejection, projection functions, persisted-summary projection, and several defensive branches. The owner imports only `parseHooksConfig` and is legacy-structured. Plan cases for complete wrapper and bare shapes; accepted and rejected handler groups; compiled `if` maps; both summary projection arms; default matcher behavior; and persisted-summary projection. The fallback at lines 147-148, missing dense-array group at 315-317, and missing validated handler at 342-344 appear unreachable from exported inputs; prove that with the schema/loop invariants and remove dead branches rather than adding coverage ignores. [VERIFIED: `extensions/pi-claude-marketplace/domain/components/hooks.ts`:124-151,305-354,382-431; `tests/domain/components/hooks.test.ts` opened 2026-08-28; focused coverage run 2026-08-28]

**P108-19 (`source.ts`).** Focused coverage misses the non-string primitive/array input arm at lines 376-378 and the false path for differing path logical values at line 594. Replace weak field-by-field/table assertions with sibling public-behavior cases and complete `deepStrictEqual` values while applying lowercase AAA. [VERIFIED: `extensions/pi-claude-marketplace/domain/source.ts`:371-382,585-603; `tests/domain/source.test.ts` opened 2026-08-28; focused coverage run 2026-08-28]

## Standard Stack

No new package is needed. Keep the repository's installed/locked stack; this is a contract and refactor phase, not a dependency-upgrade phase. [VERIFIED: `package.json`:8-33,75-97; `package-lock.json` inspected 2026-08-28]

### Core

| Library / runtime | Version used | Published / availability | Purpose | Why standard here |
|-------------------|--------------|--------------------------|---------|-------------------|
| Node.js built-in `node:test`, `node:assert/strict`, mocks, and coverage | Runtime `v26.7.0`; package floor `>=20.19.0` | Available locally | Test registration, test-context mocks/timers, assertions, and direct V8 coverage | Already powers every test and the direct-coverage runner. [VERIFIED: environment probe 2026-08-28; `package.json`:32-33,82-95] |
| TypeScript | Installed `6.0.3` | Published 2026-04-16; npm latest was `7.0.2` on research date | Strict compile-time contracts and type-only owner cases | The repository pins the 6.0 line and compiles with strict NodeNext options; do not combine this phase with an upgrade. [VERIFIED: `package.json`:27-30; `tsconfig.json`:2-20; `npm view` query 2026-08-28] |
| `isomorphic-git` | Installed `1.41.8` | Published 2026-08-21; npm latest was `1.41.9` on research date | Production Git implementation without a Git CLI | It is the existing production dependency and supports explicit filesystem and HTTP clients. [VERIFIED: `package.json`:8-11; `package-lock.json`:4544-4548; `npm view` query 2026-08-28] [CITED: https://isomorphic-git.org/docs/en/http] |
| TypeBox (`typebox`) | Installed `1.3.14` | Published 2026-08-14; npm latest was `1.3.20` on research date | Runtime schema plus static resolver union | The resolver already derives its result union from TypeBox schemas; literals and unions directly express RES-01. [VERIFIED: `package.json`:27-30; `package-lock.json`:5330-5335; `extensions/pi-claude-marketplace/domain/resolver.ts`:202-253; `npm view` query 2026-08-28] [CITED: https://github.com/sinclairzx81/sinclair-typebox] |

### Supporting

| Library / facility | Version | Purpose | When to use |
|--------------------|---------|---------|-------------|
| `strong-mock` | Installed/current `9.2.2`, published 2026-04-29 | Exact interaction mocks with explicit verification | Use for process collaborator and exact interaction expectations; use stateful fakes for shared adapter contracts. [VERIFIED: `package.json`:27-27; `package-lock.json`:5240-5245; `npm view` query 2026-08-28; `.claude/rules/typescript-unit-testing.md`:112-122] |
| Node temporary-directory and filesystem APIs | Built in | Fresh local Git repositories and case-owned files | Use real local filesystem semantics, guarded by a case cleanup hook. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Test-context `MockTracker` and fake timers | Built in | Replace `globalThis.fetch`, `isomorphic-git` HTTP request, and timers with automatic per-case restoration | Use only from the active `TestContext`; register non-mock cleanup with `t.after`. [CITED: https://nodejs.org/docs/latest-v24.x/api/test.html#mocking] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Existing `isomorphic-git` wrapper | Local `git` CLI | Rejected: it tests a different adapter and introduces PATH/config/credential state forbidden by D-15. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45; `extensions/pi-claude-marketplace/platform/git.ts`:11-18] |
| Shared stateful fake | Graph of mock functions | Rejected: it obscures public state/aliasing and duplicates interactions rather than contract behavior. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:112-122] |
| Test-only exported reset/factory | Dependency seam used by production | Rejected: production may inject or extract a real responsibility, but may not add test-only surface. [VERIFIED: `.planning/REQUIREMENTS.md`:64-71] |
| Loopback HTTP server | Mock the explicit HTTP client request boundary | The loopback suite can fail where listening sockets are forbidden and exercises more transport infrastructure than the owner needs. [VERIFIED: `tests/platform/git-remote-refs.test.ts`:1-92; focused test run 2026-08-28] |

**Installation:** none. Do not run `npm install` for this phase. [VERIFIED: existing lockfile and local dependency probes 2026-08-28]

## Package Legitimacy Audit

Not applicable. Phase 108 installs no external package, so the package-legitimacy gate is not triggered. Existing package versions were checked against the lockfile, local runtime, and read-only npm metadata; none reported a `postinstall` script in the registry queries. [VERIFIED: `package.json`:8-30; `npm view` queries 2026-08-28]

**Packages removed due to SLOP verdict:** none.

**Packages flagged as suspicious:** none.

## Architecture Patterns

### System Architecture Diagram

```text
production input / caller
        |
        v
  domain parsing + validation ------------------------------+
        |                                                   |
        v                                                   v
 resolver result union                              device-flow state machine
        |                                                   |
        | installable false -> structural error             +--> DeviceFlowHttp
        | installable true  -> state secondary                    | requestCode
        v                                                        | pollToken
 caller may read pluginRoot                                      v
                                                          injected fetch / fake

 marketplace operation
        |
        +--> GitOps contract --> production platform wrapper --> local fs / injected HTTP
        |                         fake GitOps -------------> isolated in-memory state
        |
        +--> CredentialOps contract --> createCredentialOps --> injected process / OS helper
                                  fake CredentialOps ------> isolated in-memory state

each shared contract case
        --> fresh production factory
        --> fresh fake factory
        --> one private broken fake (negative-control loop only)
        --> exact expected failure-name set
```

This flow follows the existing injected domain/platform boundaries and the locked contract/hermeticity decisions. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:291-304; `extensions/pi-claude-marketplace/domain/github-auth.ts`:88-135; `extensions/pi-claude-marketplace/platform/git-credential.ts`:59-98; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45]

### Recommended Project Structure

The exact names are recommendations; the concern placement is locked. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30,49-51]

```text
tests/
├── domain/
│   ├── github-auth.test.ts                 # mirrored owner
│   ├── device-flow-contract.ts             # callable cases + registrar
│   ├── device-flow-fake.ts                 # supported fake
│   └── device-flow-fake.test.ts            # contract participant + broken control
└── platform/
    ├── git.test.ts                         # mirrored owner
    ├── git-contract.ts                     # GitOps callable cases + registrar
    ├── git-fake.ts                         # relocated supported fake
    ├── git-fake.test.ts                    # contract participant + broken control
    ├── git-test-repository.ts               # guarded local repo/HTTP boundary
    ├── git-credential.test.ts              # mirrored owner
    ├── credential-ops-contract.ts           # CredentialOps callable cases + registrar
    ├── credential-fake.ts                   # relocated supported fake
    ├── credential-fake.test.ts              # contract participant + broken control
    └── credential-process-fake.ts           # deterministic injected process
```

Contract/support modules intentionally do not use `.test.ts`; fake participant modules do, so the correspondence gate needs an explicit structural supplemental classification rather than treating them as missing production mirrors. [VERIFIED: `scripts/check-corresponding-tests.mjs`:29-42,78-106; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30]

### Pattern 1: One contract case model, two execution surfaces

**What:** Store each shared case as `{ name, run }`; the registrar registers each case with `node:test`, while the negative-control case calls the same `run` function directly. The `run` function obtains a new adapter from the supplied factory. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37; `.claude/rules/typescript-unit-testing.md`:225-225]

**When to use:** Git, credential, and device-flow only. Keep transport assertions in the mirrored production owner and fake-only controls in the supplemental fake test. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37]

**Example:**

```typescript
// Source pattern: project TypeScript unit-testing guideline, shared adapter contracts.
interface ContractCase<TFactory> {
  readonly name: string;
  readonly run: (factory: TFactory) => Promise<void>;
}

function registerContract<TFactory>(
  cases: readonly ContractCase<TFactory>[],
  factory: TFactory,
): void {
  for (const contractCase of cases) {
    void test(contractCase.name, async () => {
      await contractCase.run(factory);
    });
  }
}
```

The concrete case functions must call a factory that creates a fresh boundary for that case; do not close over one adapter created by the registrar. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:225-225]

### Pattern 2: Independent exact negative control

Run every callable case against a private broken factory, collect assertion failures by the case's declared name, and compare with a literal one-element expected array written beside the broken implementation. Do not import or compute the expected name from the case list. The test must also reject a non-assertion exception so a setup failure cannot masquerade as a discriminating contract failure. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37; `docs/guidelines/typescript-unit-testing-guidelines.md`:1318-1326]

Recommended planted defects:

| Concern | Private defect | Only named case that should fail | Why discriminating |
|---------|----------------|----------------------------------|--------------------|
| Git | `forceUpdateRef` returns without changing the target ref | “force-updates a ref to the requested commit” | All other cases use fresh factories; the defect targets the central state-transition invariant without corrupting clone/fetch/checkout. |
| Credential | `fill` returns the stored object by reference | “returns a credential copy that cannot mutate stored state” | Miss, overwrite, reject, and independent hosts still work; only egress alias isolation fails. |
| Device flow | Fake `pollToken` reads but does not consume the first queued result | “consumes polling responses in order” | Single-response outcome cases pass; the multi-response pending/success case alone detects FIFO consumption. |

These fault selections are recommendations under the user's explicit discretion and implement D-12/D-13. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37,49-51]

### Pattern 3: Contract responsibility matrices

#### Git

The shared production-consumer port is `GitOps`, not every export in `platform/git.ts`. Its operations are quoted verbatim:

DATA_R8V3N6KT_START
`clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, `resolveRemoteRef`
DATA_R8V3N6KT_END

[VERIFIED: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`:106-138]

| Contract category | Shared cases | Owner-only cases / rationale |
|-------------------|--------------|------------------------------|
| Results and state | Clone creates the expected tree; fetch updates remote knowledge without changing worktree; force-update changes the exact ref; checkout moves HEAD/worktree; resolve operations return exact OIDs; current branch distinguishes attached/detached HEAD. | `listBranches`, `listRemotes`, and `buildAuthCallbacks` are exports of the paired platform source but are outside `GitOps`; cover them in `git.test.ts`. [VERIFIED: `extensions/pi-claude-marketplace/platform/git.ts`:296-320,322-335,429 onward] |
| Stable errors | Missing local/ref/remote-ref cases assert stable public error type/message fields used by callers. | Exact lower `isomorphic-git` parameter forwarding and protocol responses belong to the owner. |
| Mutation / aliasing | Ref/worktree mutations are observable through the port; primitive OID/branch results have no aliasing category. Record aliasing as inapplicable for primitive results. | Filesystem cleanup and injected HTTP call shape stay owner-only. |
| Ordering | Verify fetch → force-update → checkout only where the port exposes an observable sequence through the participant/harness; otherwise record inter-method workflow ordering as caller-owned. | Do not copy orchestrator workflow tests into this platform owner. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`:95-138] |
| Validation | Required option behavior and missing ref results. | Protocol byte framing is `isomorphic-git` responsibility and must not be hand-rolled. [CITED: https://isomorphic-git.org/docs/en/http] |

Use real temporary repositories seeded through `isomorphic-git`, never the Git CLI. The imported `isomorphic-git/http/node` value exposes one configurable/writable `request` method in the installed build; replace it through the current test context for canned/poison remote behavior instead of binding a socket. [VERIFIED: runtime property inspection 2026-08-28; `extensions/pi-claude-marketplace/platform/git.ts`:1-5; focused loopback test failure 2026-08-28] [CITED: https://isomorphic-git.org/docs/en/http]

#### Credentials

The exact public port operations are:

DATA_F4Q9X2LP_START
`fill(host)`, `approve(host, cred)`, `reject(host, cred)`
DATA_F4Q9X2LP_END

[VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:59-65]

| Contract category | Shared cases | Owner-only cases / rationale |
|-------------------|--------------|------------------------------|
| Results/state | Miss returns `null`; approve/fill round trip; overwrite; independent hosts; reject exact credential. | Exact subprocess return-code and stdout parsing are production transport details. |
| Errors | Public fake and production best-effort behavior for supported operations. | Spawn `error`, nonzero close, timeout, and early stdin `EPIPE` belong to `git-credential.test.ts`. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:114-158,218-300] |
| Mutation/aliasing | Clone credentials at approve ingress and fill egress; changing caller/returned objects cannot mutate stored state. | `GitCredentials` is the public mutable object shape, so aliasing applies. [VERIFIED: `extensions/pi-claude-marketplace/platform/git.ts`:322-334] |
| Ordering | Per-host overwrite and reject semantics apply; a global cross-host order does not. Record global ordering as inapplicable. | Child-process event ordering is owner-only. |
| Validation | Control-character rejection for host/credential attributes is a public production behavior; either reproduce it in the supported fake or explicitly define validation at the production adapter edge and keep it owner-only. Prefer the former only if callers rely on the port-level invariant. | Wire bytes, command, args, env, stdio, timer unref/kill, and cleanup are owner-only. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:84-98,114-192] |

The owner must remove the current default-adapter test that depends on PATH/absence of Git and replace it with injected `CredentialSpawn` coverage. [VERIFIED: `tests/platform/git-credential.test.ts` opened 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45]

#### Device flow

The public HTTP port operations are quoted verbatim:

DATA_M5C8J2ZW_START
`requestCode(clientId, scope)`, `pollToken(clientId, deviceCode, intervalSec)`
DATA_M5C8J2ZW_END

[VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:88-107]

The poll result variants are quoted verbatim:

DATA_P6H3Y9DS_START
`"success"`, `"pending"`, `"slow_down"`, `"access_denied"`, `"expired_token"`, `"unexpected"`
DATA_P6H3Y9DS_END

[VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:70-82]

| Contract category | Shared cases | Owner-only cases / rationale |
|-------------------|--------------|------------------------------|
| Results | Exact request-code value and every poll variant, including success defaults, pending, cumulative slow-down, denied, expired, invalid JSON, and unexpected/provider error. | Exact fetch method, URLs, headers, encoded body, response status, and network failure are owner-only. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:182-294,347-415] |
| Errors | Stable initialization and terminal flow results; cancellation remains a public flow case. | Raw fetch rejection conversion belongs to the production owner. |
| Mutation/aliasing | Return fresh response values on every call; mutation of a returned device-code/poll object must not alter queued fake state. | `Response` instances must also be fresh because bodies are one-shot. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Ordering | Request-code precedes polling; polling consumes FIFO; pending keeps interval; each slow-down adds five seconds to all later waits. | Exact timer mechanism is owner-only; contract uses injected wait observations. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:347-383] [CITED: https://www.rfc-editor.org/rfc/rfc8628.html#section-3.5] |
| Validation | Missing request fields, malformed JSON, and unknown provider error code. | Exact fetch wire validation is owner-only. |

The existing production factory `makeDeviceFlowHttp` is private while `DeviceFlowHttp` and `initiateDeviceFlow` are exported. Preserve that public surface: define the shared participant factory in test support as a fresh device-flow scenario runner. The production participant omits `http`, replaces `globalThis.fetch` in the current test context, and therefore exercises the private production adapter; the fake participant injects a fresh `DeviceFlowHttp`. Every shared scenario must drive the applicable `requestCode` and `pollToken` outcomes, while the production owner alone asserts exact wire transport. Do not export `makeDeviceFlowHttp` or either implementation function for the test. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:182-307,417-438; `.planning/REQUIREMENTS.md`:64-71; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30,41-45]

### Pattern 4: Resolver boolean-first discriminant

Current schema values are quoted verbatim:

DATA_B7L2K5RH_START
`state: Type.Literal("installable")`
`state: Type.Literal("partially-available")`
`state: Type.Literal("unavailable")`
DATA_B7L2K5RH_END

[VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:202-229]

Add `installable: Type.Literal(true)` to `MATERIALIZABLE_FIELDS` so both materializable arms share it. Add `installable: Type.Literal(false)` only to the unavailable schema. Keep `pluginRoot` solely in the materializable field bag. Update every result constructor and exact fixture to return the matching literal. [VERIFIED: `.planning/REQUIREMENTS.md`:72-74; `extensions/pi-claude-marketplace/domain/resolver.ts`:161-229]

Nineteen external test fixture constructions must be staged before the field becomes required. P108-06 owns seven agents/commands/integration constructions and P108-19 owns twelve integration/skills/classifier constructions. Each prerequisite uses an exact `{ installable: true | false } as const` field bag spread into the existing fixture object. A spread-added member is accepted by the pre-change structural type and simultaneously satisfies the post-change required literal, so every intermediate commit remains typecheck-green without an optional field, result-type cast, or compatibility shim. Both materializable states use true; only unavailable uses false. [VERIFIED: TypeScript semantic compiler probe 2026-08-29; execution checkpoint typecheck inventory 2026-08-29]

Use the boolean for the first broad narrowing: `requirePartialInstallable` returns on `r.installable`; `requireInstallable` first rejects `!r.installable`, then still checks `r.state === "installable"` because the true arm includes partial availability. The secondary `state` retains its three distinctions and still controls partial-install error detail. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:1689-1744; `.planning/REQUIREMENTS.md`:72-74]

Create `tests/domain/resolver.test.ts` as the sole owner. Consolidate exported runtime/type behavior from the existing `resolver-comp01`, `resolver-default-enabled`, `resolver-loose`, `resolver-strict`, and `resolver.types` suites into the canonical owner, or make their supplemental status structurally explicit. Do not leave multiple proxy owners. [VERIFIED: existing resolver test file inventory inspected 2026-08-28; `scripts/check-corresponding-tests.mjs`:85-104]

The owner needs compile-time checks that `if (result.installable)` admits `pluginRoot`, `if (!result.installable)` rejects `pluginRoot` with `@ts-expect-error`, and all three secondary states remain legal. Runtime cases assert the complete result object including the boolean in all constructors. [VERIFIED: `.planning/REQUIREMENTS.md`:72-74; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:18-22]

### Pattern 5: Supplemental evidence is structural, not an exemption list

The current correspondence gate treats every `.test.ts` under `tests/domain` or `tests/platform` as an owner candidate, derives a production path from its filename, and reports `unexpected-test` when that source does not exist. It has no fake/contract supplemental category. [VERIFIED: `scripts/check-corresponding-tests.mjs`:29-42,78-106]

Have the first adapter carrier (recommended: P108-21) add a narrow structural category for concern-local fake participant tests and extend the gate's negative suite. The category should recognize an intentional suffix, require the module to import its sibling fake and contract registrar, and never count it as a production owner. Keep unknown legacy tests rejected. This is a rule, not a named-file allowlist or ownership registry. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30; `.planning/REQUIREMENTS.md`:14-25,118-126]

### Recommended execution order

1. **P108-06 and P108-19 fixture preflight plus owner repairs:** run independently after P108-01. Each remains exactly one owner pair while its third task stages a disjoint, typecheck-safe subset of the 19 external resolver fixtures. [VERIFIED: execution checkpoint fixture inventory and TypeScript semantic compiler probe 2026-08-29]
2. **P108-18 resolver carrier:** only after both prerequisite summaries, make the boolean required in the schema/type/owner contract. Trace callers with CodeGraph; do not edit supporting fixtures again or silently edit later production owners. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:94-95; `.planning/REQUIREMENTS.md`:76-85]
3. **P108-21 credential carrier:** establish supplemental-evidence classification, relocate credential support, add the first registrar/negative-control pattern, and update all credential-fake imports. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45,96-97]
4. **P108-12 device-flow carrier:** run after the credential support path is stable because the device-flow owner and integration tests use credential support. [VERIFIED: helper import inventory and CodeGraph call graph inspected 2026-08-28]
5. **P108-22 Git carrier:** run after credential relocation because current Git auth tests import the credential fake; relocate Git support and eliminate the loopback server. [VERIFIED: `tests/platform/git-remote-refs.test.ts`:13-19; helper import inventory inspected 2026-08-28]
6. **The remaining 17 PASS normalization pairs:** schedule in parallel waves where their owner files do not overlap; each remains its own plan and commit. [VERIFIED: `.planning/REQUIREMENTS.md`:155-181; `.planning/REQUIREMENTS.md`:76-85]

The three generic helpers currently appear in 26 Git-related, 16 credential-related, and 8 device-flow-related test files (counts include the helper modules themselves), with overlap across architecture, integration, edge, orchestrator, platform, and shared tests. Serialize the three replacement-adapter carriers, then migrate the 27 surviving consumer files once all replacement APIs exist. The five non-overlapping batches are assigned to P108-02/03/04/05/07; P108-23 proves no imports remain before deleting all three helpers. Import-only changes do not complete the consumers' later production pairs, and any case body changed for an explicit guarded-factory call must use exact lowercase `// arrange`, `// act`, `// assert`; lowercase `// act & assert` is permitted only for one throwing/rejection expression. [VERIFIED: repository import inventory run 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:18-30,94-97]

### Anti-Patterns to Avoid

- **Treating HEAD PASS as complete:** all 19 passing owners still require case-structure and assertion audit. [VERIFIED: `.planning/REQUIREMENTS.md`:7-10; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:18-22]
- **One adapter instance for a whole registrar:** state leaks between cases and can make the planted defect fail multiple cases. Create inside each callable case. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37]
- **Nested `node:test` for the negative control:** call case functions directly and capture assertion failures. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37]
- **A test-only production export:** use a real dependency factory/port that production wiring also uses, or test through the existing public seam. [VERIFIED: `.planning/REQUIREMENTS.md`:64-71]
- **Loopback HTTP or Git CLI:** both widen environmental dependencies; inject the explicit HTTP/process boundary. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45; focused loopback test failure 2026-08-28]
- **Coverage ignores for unreachable branches:** prove the invariant and remove dead defensive code if no exported input reaches it. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:29-32; focused hooks audit 2026-08-28]
- **Leaving old helper paths in comments/imports:** relocation must update code, tests, fixtures, and owned comments without creating migration-history comments. [VERIFIED: `.planning/REQUIREMENTS.md`:118-126; helper reference inventory run 2026-08-28]
- **Globally ignoring `*-fake.test.ts`:** require structural supplemental imports so arbitrary legacy tests cannot evade ownership. [VERIFIED: `.planning/REQUIREMENTS.md`:14-25; `scripts/check-corresponding-tests.mjs`:98-104]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Git object/ref/protocol behavior | A shell Git harness or custom pkt-line server/protocol parser | Existing `isomorphic-git` with real temporary filesystem and mocked official HTTP client boundary | The production adapter already delegates these semantics; a second implementation can drift and violates D-15. [VERIFIED: `extensions/pi-claude-marketplace/platform/git.ts`:1-18,136-320] [CITED: https://isomorphic-git.org/docs/en/http] |
| Credential subprocess orchestration | A real keychain setup or PATH-sensitive helper | Existing `createCredentialOps({ spawn, timeoutMs })` plus deterministic `CredentialProcess` fake | The production source already exposes the exact process seam and owns timeout/EPIPE cleanup. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:68-119,303-316] |
| Device OAuth protocol | Live GitHub calls or a second polling state machine | Existing `DeviceFlowHttp`, fetch-backed implementation, and injected `waitForPoll` | RFC error/backoff semantics and provider response handling already live in the production state machine. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:76-135,347-438] [CITED: https://www.rfc-editor.org/rfc/rfc8628.html#section-3.5] |
| Contract registration | Duplicated production/fake test tables | One concern-local callable-case list and registrar | One source of cases is the actual equivalence proof. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37] |
| Mock restoration/timers | A global reset helper | Node test-context mocks/timers and `t.after` | The runner restores test-context mocks/timers after the case; explicit cleanup owns external resources. [CITED: https://nodejs.org/docs/latest-v24.x/api/test.html#class-mocktracker] |
| Resolver runtime/static dual model | A hand-maintained TypeScript union separate from validation | TypeBox literal/object/union schemas plus `Type.Static` | The existing resolver schema is canonical for both runtime and static arms. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:202-253] [CITED: https://github.com/sinclairzx81/sinclair-typebox] |

**Key insight:** Reuse existing production seams and make shared cases exercise public outcomes. Test-only infrastructure should guard environmental boundaries, not reimplement Git, credential, OAuth, schema, or coverage engines. [VERIFIED: `.planning/REQUIREMENTS.md`:64-71,116-128]

## Runtime State Inventory

This is a refactor/relocation phase, so repository grep alone is insufficient. The five runtime categories were checked explicitly. [VERIFIED: phase goal and helper-relocation decisions in `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:9-9,26-30]

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None. `ResolvedPlugin` results are transient domain values; no persistence/transaction source references `ResolvedPlugin`, `resolveStrict`, or `resolveLoose`, and no serialization of resolver output was found. | Code/type fixture edit only; no data migration. Re-run caller/typecheck inventory after the new field. [VERIFIED: CodeGraph and repository persistence/transaction reference audit 2026-08-28] |
| Live service config | None. The affected fakes/contracts live in source-controlled tests; the phase requires no UI/database-held external-service configuration. | No service migration. Poison remote HTTP so tests cannot fall back to a configured service. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| OS-registered state | None. No systemd/launchd/scheduler/process registration is renamed. | Do not invoke Git CLI credential helpers or keychains; injected processes and local repositories only. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Secrets / environment variables | No renamed key. Production credential spawning deliberately sets exact environment entries shown below; tests may inspect them but must restore any per-case environment mutation. | No secret migration. Preserve these exact values and do not read developer credential configuration. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:121-128; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Build artifacts / installed packages | None from a package/module rename. Helper relocation changes TypeScript import paths; temporary repositories are per-case artifacts. | Update all affected imports, remove obsolete helper source after consumers move, and remove every temporary directory in its creating case. No reinstall/package migration. [VERIFIED: helper import inventory run 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45,94-97] |

The credential environment values are quoted verbatim:

DATA_T3W8G5VC_START
`GIT_TERMINAL_PROMPT: "0"`
`GCM_INTERACTIVE: "never"`
DATA_T3W8G5VC_END

[VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:121-128]

## Common Pitfalls

### Pitfall 1: Pair-atomic resolver change versus caller-style migration

**What goes wrong:** P108-18 edits later production callers or smuggles 19 external fixture-only repairs into the resolver pair; alternatively, the field becomes required before those fixtures migrate and repository typecheck fails. [VERIFIED: `.planning/REQUIREMENTS.md`:76-85; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:94-95; execution checkpoint 2026-08-29]

**Why it happens:** Existing consumers often discriminate on the three-way `state`; the new boolean is redundant at runtime but primary in the new public type contract. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:202-261; CodeGraph caller inventory 2026-08-28]

**How to avoid:** P108-06 and P108-19 first stage disjoint fixture batches with exact-literal field-bag spreads that typecheck before and after the union change. P108-18 then implements the required schema/constructors/narrowers, includes the complete fixture and production-caller traces, and proves `pluginRoot` is impossible on the false arm. Lexical production caller rewrites remain scheduled with their later owning pairs. [VERIFIED: `.planning/REQUIREMENTS.md`:72-85; TypeScript semantic compiler probe 2026-08-29]

**Warning signs:** P108-18 lists any of the nine supporting fixture files, a prerequisite adds `installable?`, `any`, or a result-type cast, or success is reported without both 108-06/108-19 summaries and the complete ledgers.

### Pitfall 2: Supplemental tests fail correspondence

**What goes wrong:** New concern-local fake `.test.ts` modules produce `unexpected-test`, or an overbroad ignore hides unrelated legacy tests. [VERIFIED: `scripts/check-corresponding-tests.mjs`:39-42,98-104]

**How to avoid:** Add structural supplemental classification and a negative fixture proving an arbitrary test remains rejected. Run both correspondence commands in the carrier. [VERIFIED: `package.json`:83-84; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30]

### Pitfall 3: A contract that proves only the fake

**What goes wrong:** The production owner copies the case titles or asserts transport calls instead of invoking the same registrar; fake and production can drift while both suites stay green.

**How to avoid:** Import the same case list/registrar into both participant modules, use a fresh factory per case, and keep a concern-local typed participant inventory. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:225-225; `docs/guidelines/typescript-unit-testing-guidelines.md`:1296-1326]

### Pitfall 4: Negative control false confidence

**What goes wrong:** The broken fake fails setup or several cases, but the test only checks that “something failed”; or expected failure name is read from the case implementation.

**How to avoid:** Require the exact one-element literal failure-name array, reject non-assertion failures, and run every other case to prove it stays green. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37]

### Pitfall 5: Hermetic means “localhost”

**What goes wrong:** A loopback server still depends on socket permission and can fail in a sandbox; the current remote-ref suite does exactly that in this environment. [VERIFIED: `tests/platform/git-remote-refs.test.ts`:1-92; focused test failure `listen EPERM 127.0.0.1` on 2026-08-28]

**How to avoid:** Mock the explicit HTTP request object and use poison URLs/credential boundaries. A local filesystem repository is required; a local network listener is not. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45]

### Pitfall 6: Process tests touch developer state

**What goes wrong:** A default credential case depends on `PATH`, installed Git, or configured credential helpers.

**How to avoid:** Always inject `CredentialSpawn`, assert command/args/env/stdio exactly, simulate all close/error/timeout/stdin paths, and verify cleanup. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:84-158; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45]

### Pitfall 7: Fake aliases hide production drift

**What goes wrong:** The current simple credential/device fakes return or retain caller objects directly; contract consumers can mutate stored or queued state. [VERIFIED: `tests/helpers/credential-mock.ts` and `tests/helpers/device-flow-mock.ts` opened 2026-08-28]

**How to avoid:** Clone at mutable ingress and egress, and add explicit contract cases. If a category is truly inapplicable, record why rather than omitting it. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:122-122,225-225]

### Pitfall 8: Broad normalization misses legacy assertion defects

**What goes wrong:** Adding comments alone leaves field-by-field, existence-only, copied-computation, work-session, or migration-history assertions in touched owners.

**How to avoid:** For all 23 owners, audit title, phases, complete public result/error, role-correct double, case-owned state, and exact interaction verification. Preserve useful assertions when relocating cases. [VERIFIED: `.planning/REQUIREMENTS.md`:27-48,116-128; `.claude/rules/typescript-unit-testing.md`:91-107]

## Code Examples

### Resolver literal construction

The requirement's exact literals are quoted verbatim:

DATA_H2D7S4QJ_START
`installable: true | false`
DATA_H2D7S4QJ_END

[VERIFIED: `.planning/REQUIREMENTS.md`:72-74]

```typescript
// Source pattern: TypeBox literal/object/union APIs.
const MATERIALIZABLE_FIELDS = {
  installable: Type.Literal(true),
  // existing materializable fields remain here
} as const;

const unavailable = Type.Object({
  installable: Type.Literal(false),
  // no pluginRoot field
});
```

TypeBox exposes `Type.Literal` and `Type.Union` for this runtime/static pattern. [CITED: https://github.com/sinclairzx81/sinclair-typebox]

### Case-owned boundary replacement

```typescript
// Source: Node.js test runner MockTracker and cleanup APIs.
void test("uses only the injected boundary", async (t) => {
  // arrange
  t.mock.method(boundary, "request", deterministicRequest);
  t.after(async () => {
    await removeCaseDirectory();
  });

  // act
  const result = await operation();

  // assert
  assert.deepStrictEqual(result, expectedResult);
});
```

Test-context mocks are restored after each test; `t.after` owns non-mock cleanup. [CITED: https://nodejs.org/docs/latest-v24.x/api/test.html#mocking; https://nodejs.org/docs/latest-v24.x/api/test.html#contextafterfn-options]

### Exact negative-control loop

```typescript
// Source pattern: locked Phase 108 D-11 through D-14.
const failures: string[] = [];

for (const contractCase of contractCases) {
  try {
    await contractCase.run(createFreshBrokenAdapter);
  } catch (error) {
    assert.ok(error instanceof assert.AssertionError);
    failures.push(contractCase.name);
  }
}

assert.deepStrictEqual(failures, EXPECTED_SINGLE_FAILURE_WRITTEN_HERE);
```

The concrete test must define the expected one-element array locally and independently; the placeholder above must not survive implementation. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37]

## State of the Art

| Old approach in the tree | Required Phase 108 approach | When changed | Impact |
|--------------------------|-----------------------------|--------------|--------|
| Generic `tests/helpers/` adapter fakes | Concern-local fakes/contracts under `tests/platform` or `tests/domain` | Locked for v1.19 on 2026-08-28 | Import rewrites are supporting carrier work; no generic global harness. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30] |
| Separate Git auth/remote-ref supplemental tests and no canonical `git.test.ts` | One canonical owner that runs shared contract plus platform-only mechanics; fake remains supplemental | Phase 108 | Restores one-to-one ownership and direct coverage. [VERIFIED: `.planning/REQUIREMENTS.md`:14-25,176-181] |
| Resolver `state` as sole discriminator | `installable` is primary materializability boolean and `state` remains secondary three-way detail | Phase 108 | False arm statically excludes `pluginRoot`; partial/installable remain distinguishable. [VERIFIED: `.planning/REQUIREMENTS.md`:72-74] |
| Loopback Git HTTP stub | Replace explicit `isomorphic-git` HTTP request method per case; poison unplanned remotes | Phase 108 hermeticity decision | Removes socket permission and accidental-network dependencies. [VERIFIED: `tests/platform/git-remote-refs.test.ts`:1-92; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Shared contract expressed only as registered tests | Callable cases plus registrar and one exact broken participant | Phase 108 D-11 through D-14 | Negative control runs in-process and proves one invariant is discriminating. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37] |
| Uppercase/implicit/mixed case comments in touched tests | Exact lowercase `// arrange`, `// act`, `// assert`; `// act & assert` only for one throwing/rejection expression | v1.19 locked decision | Every touched runtime case is structurally reviewable; type-only cases remain compile-only. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:18-22] |

**Deprecated/outdated:**

- Loopback smart-HTTP test server: replace with injected HTTP request behavior in this phase. [VERIFIED: focused failure 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45]
- Generic Git, credential, and device-flow helper locations: relocate the relevant support and update consumers. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30,94-97]
- Resolver proxy-owner layout: create the missing canonical owner and make any retained suite supplemental by a structural rule. [VERIFIED: `.planning/REQUIREMENTS.md`:176-176; `scripts/check-corresponding-tests.mjs`:78-106]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are derived from locked decisions, opened source-of-truth files, focused commands, installed dependency inspection, and official documentation. | — | — |

## Resolved Questions

1. **RESOLVED — How lexical resolver caller migration satisfies pair atomicity.**
   - Ruling: P108-06 and P108-19 first own disjoint supporting-fixture batches totaling all 19 construction sites; their exact-literal spreads preserve typecheck before and after the strict union. P108-18 changes only `domain/resolver.ts` and its canonical/legacy owner evidence. It adds the required boolean to the schema/results, changes the resolver-owned narrowers, and proves runtime/type behavior. It does not edit those supporting fixtures, `plugin-state-classifier.ts`, or any other production consumer, and Phase 108 does not claim repository-wide lexical production migration complete. [VERIFIED: `.planning/REQUIREMENTS.md`:72-85; execution checkpoint 2026-08-29]
   - Migration assignments: P113-24 owns `plugin-state-classifier.ts`; P114-07/08/09/10/11/12/14 own `enable-disable.ts`, `fetch.ts`, `info.ts`, `install.ts`, `list.ts`, `reinstall.ts`, and `update.ts`; P115-06/07 own `reconcile/backfill.ts` and `reconcile/notify.ts`. Those plans must narrow materializability on `installable` before using `state` as secondary detail. [VERIFIED: `.planning/ROADMAP.md`:305,344-351,377-378; CodeGraph and static caller inventory 2026-08-28]
   - Already-safe direct consumers: P111-08/10/13/24/30 and P113-15/17/26 consume `MaterializablePlugin` or `GitPluginRootResult`, while P113-20 delegates full-union classification without a root-access gate. They require preservation, not a lexical boolean-first edit. Comment-only mentions are excluded. The full file/symbol ledger lives in `108-18-PLAN.md`.

2. **RESOLVED — Which carrier owns the supplemental-evidence gate change.**
   - Ruling: P108-21 owns `scripts/check-corresponding-tests.mjs` and its negative fixture because it introduces the first contract/fake supplement. P108-12 and P108-22 depend on P108-21 and must satisfy the same structural rule. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30; `scripts/check-corresponding-tests.mjs`:39-42,78-106]

No research question remains open and no missing technical information blocks planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Unit runner, mocks, coverage, native TS execution in this repo | ✓ | `v26.7.0` | Project floor is `>=20.19.0`. [VERIFIED: environment probe 2026-08-28; `package.json`:32-33] |
| npm | Project scripts and registry verification | ✓ | `11.19.0` | Direct `node` commands for focused tests; npm remains required for canonical gates. [VERIFIED: environment probe 2026-08-28; `package.json`:75-95] |
| TypeScript | Typecheck and type-only resolver cases | ✓ | `6.0.3` | None needed. [VERIFIED: environment probe 2026-08-28] |
| `isomorphic-git` | Production Git adapter and local repository seeds | ✓ | `1.41.8` | None; do not use Git CLI as fallback. [VERIFIED: local package probe 2026-08-28; `package-lock.json`:4544-4548] |
| Git CLI | Repository administration only | ✓ | `2.55.0` | Not permitted as the adapter-test implementation. [VERIFIED: environment probe 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| CodeGraph CLI | Required code discovery | ✓ | `1.6.0` | Shell CodeGraph is the stated fallback when MCP is absent. [VERIFIED: environment probe 2026-08-28; `AGENTS.md`:4-7] |
| Network / loopback listener | Not required by compliant unit tests | ✗ in current sandbox for `127.0.0.1` listen | — | Inject HTTP/fetch; this is the required design, not a degraded fallback. [VERIFIED: focused Git remote test failure 2026-08-28; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Developer credential helper / keychain | Must not be required | Not probed intentionally | — | Inject deterministic `CredentialSpawn`. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** loopback/live network and developer credentials are deliberately replaced by required injected boundaries.

## Validation Architecture

Nyquist validation is enabled. [VERIFIED: `.planning/config.json`:16-23]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner on Node `v26.7.0`, `node:assert/strict`, test-context mocks/timers, plus `strong-mock` `9.2.2` for interaction mocks. [VERIFIED: environment probe 2026-08-28; `package.json`:27-29,82-95] |
| Config file | None; ESM/strict behavior comes from `package.json` and `tsconfig.json`. [VERIFIED: `package.json`:97-97; `tsconfig.json`:2-20] |
| Quick run command | `node --test <owner-test-path>` followed by `npm run test:coverage:direct -- <source-or-owner-path>` [VERIFIED: `.claude/rules/typescript-unit-testing.md`:29-32; `package.json`:88-90] |
| Full suite command | `npm run check` [VERIFIED: `package.json`:75-95] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MOD-01 | All 23 mirrored owners pass alone at 100% functions/lines/branches | 23 focused unit/direct coverage gates | `npm run test:coverage:direct:all` plus each pair's focused command | 21 owners exist; `tests/domain/resolver.test.ts` and `tests/platform/git.test.ts` are ❌ Wave 0. [VERIFIED: `.planning/REQUIREMENTS.md`:155-181; focused commands 2026-08-28] |
| RES-01 | Boolean discriminant, false arm excludes root, three states retained | Runtime unit + TypeScript compile contract | `node --test tests/domain/resolver.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/resolver.ts && npm run typecheck` | ❌ Wave 0 canonical owner. Existing resolver suites are migration input. [VERIFIED: `.planning/REQUIREMENTS.md`:72-74,176-176] |
| PRES-03 | Same contract cases pass production and fake for all three concerns | Shared contract participant tests + owner mechanics | Focused production owner + concern fake supplemental test for each carrier, then `npm run test:coverage:direct:all` | ❌ Wave 0 contract/fake participant modules. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30,94-97] |
| PRES-04 | Exactly one independent planted failure per concern | Supplemental negative-control unit cases | Run each concern's fake supplemental test alone; exact expected one-element failure set must pass | ❌ Wave 0 negative controls inside fake tests. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:34-37] |

### Sampling Rate

- **Per task commit:** run the owner alone, its focused direct-coverage command, typecheck/lint for the touched files, and any affected supplemental participant. [VERIFIED: `.claude/rules/typescript-unit-testing.md`:29-32]
- **Per adapter carrier:** run production owner, fake participant (including broken control), correspondence positive/negative commands, affected downstream tests after import relocation, and `npm run test:coverage:direct:all`. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:94-97; `package.json`:83-90]
- **Per wave merge:** run `npm run test:coverage:direct:all` and `npm run check`. [VERIFIED: `.planning/REQUIREMENTS.md`:116-128]
- **Phase gate:** all 23 focused records at 100%, three shared contracts with exact negative controls, correspondence gates green, no live boundary access, and `npm run check` green before verification. [VERIFIED: `.planning/ROADMAP.md`:49-60; `.planning/REQUIREMENTS.md`:116-130]

### Wave 0 Gaps

- [ ] Create `tests/domain/resolver.test.ts` and migrate/consolidate exported resolver behavior. [VERIFIED: `.planning/REQUIREMENTS.md`:176-176]
- [ ] Create `tests/platform/git.test.ts` and migrate appropriate Git supplemental behavior. [VERIFIED: `.planning/REQUIREMENTS.md`:180-180]
- [ ] Create concern-local Git contract, fake, fake participant, and guarded local-repository/HTTP support. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45]
- [ ] Create concern-local credential contract, relocated fake, fake participant, and deterministic process support. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45]
- [ ] Create concern-local device-flow contract, relocated fake, fake participant, and fetch/wait support. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-45]
- [ ] Extend correspondence gate and its negative fixture with a structural supplemental-evidence category. [VERIFIED: `scripts/check-corresponding-tests.mjs`:39-42,78-106; `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-30]
- [ ] Replace the current loopback Git remote-ref fixture; it fails with `listen EPERM` in the current target sandbox. [VERIFIED: focused test run 2026-08-28]

Current baseline note: a batch of the existing Phase 108 owners/supplements passed 22 of 23 modules; only `git-remote-refs.test.ts` failed, for the loopback listener. `npm run typecheck` passed. This is diagnostic baseline evidence, not completion. [VERIFIED: focused batch and typecheck runs 2026-08-28]

## Security Domain

Security enforcement is enabled because the config does not set it to false. The table uses the requested ASVS 4.x category labels; OWASP ASVS 5.0 is the current release, but the phase's mandated research template names the 4.x categories. [VERIFIED: `.planning/config.json`:1-53] [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | OAuth device-flow state machine, typed credential port, token non-disclosure cases, and deterministic credential boundary. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:55-146,347-438] [CITED: https://github.com/OWASP/ASVS/blob/master/4.0/en/0x11-V2-Authentication.md] |
| V3 Session Management | No | This phase creates no application session/cookie/token-session store; access tokens are operation credentials, not an application session. Reassess in any phase that adds session persistence. [VERIFIED: audited Phase 108 source/caller scope 2026-08-28] [CITED: https://github.com/OWASP/ASVS/blob/master/4.0/en/0x12-V3-Session-management.md] |
| V4 Access Control | No | No authorization policy or resource-access decision is introduced; source/platform adapters preserve existing caller authority. [VERIFIED: `.planning/ROADMAP.md`:49-60] |
| V5 Input Validation | Yes | TypeBox resolver schemas, credential wire control-character rejection, exact HTTP response validation, and poison remote boundaries. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts`:202-253; `extensions/pi-claude-marketplace/platform/git-credential.ts`:160-192; `extensions/pi-claude-marketplace/domain/github-auth.ts`:182-294] [CITED: https://github.com/OWASP/ASVS/blob/master/4.0/en/0x13-V5-Validation-Sanitization-Encoding.md] |
| V6 Cryptography | Yes, boundary-only | Use provider TLS, OS credential helpers, and existing Git/OAuth libraries; never implement crypto or token protection primitives in test support. [VERIFIED: existing platform/domain boundaries opened 2026-08-28] [CITED: https://github.com/OWASP/ASVS/blob/master/4.0/en/0x14-V6-Cryptography.md] |

### Known Threat Patterns for TypeScript Platform Tests

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential/token leaks in notification, error, fixture, or assertion output | Information Disclosure | Use synthetic secrets; assert exact safe messages; preserve the architecture no-credential-leak test; never include real env/keychain values. [VERIFIED: `extensions/pi-claude-marketplace/domain/github-auth.ts`:138-155,417-438] |
| Credential wire injection with newline, carriage return, or NUL | Tampering | Preserve and directly cover the exact control-character validator and encoded attribute block. [VERIFIED: `extensions/pi-claude-marketplace/platform/git-credential.ts`:160-192] |
| Accidental remote URL or keychain fallback | Information Disclosure / Elevation of Privilege | Guarded factories require explicit boundaries; poison unplanned HTTP and credential access. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Temporary repository path escape or residue | Tampering / Information Disclosure | Create a fresh private temp directory per case, seed only inside it, and remove it in the same case's cleanup. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:41-45] |
| Global fetch/timer/env mock leakage | Denial of Service / Tampering | Use current `TestContext` mocks/timers; register cleanup and avoid shared mutable adapters. [VERIFIED: `.planning/REQUIREMENTS.md`:29-48] [CITED: https://nodejs.org/docs/latest-v24.x/api/test.html#class-mocktracker] |
| Fake contract drift | Tampering | Run one shared contract against production and fake, plus the exact one-case broken control and typed participant inventory. [VERIFIED: `.planning/phases/108-domain-and-platform/108-CONTEXT.md`:26-37] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/108-domain-and-platform/108-CONTEXT.md` — locked scope, AAA normalization, adapter contracts, negative controls, hermeticity, integration points.
- `.planning/REQUIREMENTS.md` — RES-01, MOD-01, PRES-03, PRES-04, pair atomicity, coverage, ownership, and suite quality.
- `.planning/ROADMAP.md` — 23 exact pair slots and Phase 108 success criteria.
- `.claude/rules/typescript-unit-testing.md` and `docs/guidelines/typescript-unit-testing-guidelines.md` — canonical case/double/contract/coverage rules.
- Current line-numbered source opened through CodeGraph and direct reads: resolver, Git, Git credential, GitHub auth, correspondence gate, owner tests, and helper fakes.
- Focused commands on 2026-08-28 — two direct-coverage failures, two missing owners, typecheck pass, helper import inventory, loopback `EPERM` reproduction, and local dependency/runtime probes.

### Secondary (MEDIUM confidence)

- [Node.js test runner documentation](https://nodejs.org/docs/latest-v24.x/api/test.html) — test-context mocks, timers, and cleanup.
- [isomorphic-git HTTP documentation](https://isomorphic-git.org/docs/en/http) — explicit HTTP client request boundary.
- [isomorphic-git clone documentation](https://isomorphic-git.org/docs/en/clone) and [fetch documentation](https://isomorphic-git.org/docs/en/fetch) — explicit filesystem/HTTP inputs.
- [TypeBox official repository](https://github.com/sinclairzx81/sinclair-typebox) — literal/object/union schema patterns.
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html) — device-flow pending, slow-down, denied, and expiry semantics.
- OWASP ASVS official project and 4.x category documents — security applicability.

### Tertiary (LOW confidence)

- None. No LOW-confidence claim is used as a planning decision.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — exact installed/locked versions and current read-only registry metadata were checked; no package is added.
- Architecture: HIGH — based on current source/call paths, locked context, canonical test guidelines, and official dependency APIs.
- Pitfalls: HIGH — reproduced coverage/missing-owner behavior and the loopback listener failure; gate behavior was read from source.
- Resolver caller rollout policy: HIGH — the complete caller ledger is assigned to exact owning pairs, P108-18 remains pair-atomic, and Phase 108 explicitly avoids a repository-wide lexical-completion claim.

**Research date:** 2026-08-28
**Valid until:** 2026-09-27 for repository architecture; re-run package/version and direct-coverage probes if HEAD changes before planning.
