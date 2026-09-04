# Phase 108: Domain and Platform - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 108-Domain and Platform
**Areas discussed:** Existing PASS tests, Shared adapter contracts, Broken-adapter controls, Hermeticity boundary

---

## Existing PASS tests

### Rewrite policy

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal compliance edits | Keep existing cases unless a guideline, contract, or independence defect requires a change. | |
| Uniform normalization | Reshape every passing test into the new guideline structure. | ✓ |
| Clean-slate rewrite | Rebuild each owner test from the public contract regardless of existing quality. | |

**User's choice:** Uniform normalization.

### Visible case phases

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit labels everywhere | Use comments in every runtime case. | ✓ |
| Ordered code only | Enforce arrange, act, and assert order without comments. | |
| Labels for complex cases | Use comments only where phases are not obvious. | |

**User's choice:** Explicit labels everywhere.
**Notes:** The user required lowercase `// arrange`, `// act`, and `// assert` and asked that the guideline, plans, and modified tests carry the convention. The canonical rule and full guideline already specify lowercase comments.

### Normalization scope

| Option | Description | Selected |
|--------|-------------|----------|
| Every repository test | Normalize owner, architecture, integration, contract, and supplemental tests. | |
| All milestone-owned work | Normalize all 204 owner tests and every supporting test v1.19 creates or modifies. | ✓ |
| Phase 108 only | Normalize only the 23 Phase 108 owners and support. | |

**User's choice:** All milestone-owned work.

### Compact and compile-time cases

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical exceptions | Use `// act & assert` only for one throwing/rejection expression; ordinary assertions and data rows use separate phases; do not invent runtime phases for type-only modules. | ✓ |
| Always split runtime phases | Require separate act and assert markers for every runtime case. | |
| Strict three-marker form | Require all three markers even for compile-time-only owner tests. | |

**User's choice:** Follow the canonical exceptions.

---

## Shared adapter contracts

### Contract organization

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable contract registrar | One concern-local registrar is invoked independently by production and fake tests. | ✓ |
| One combined contract test | One owner test runs the same contract against both implementations. | |
| Parallel explicit cases | Equivalent cases are handwritten in separate tests. | |

**User's choice:** Reusable contract registrar.

### Support location

| Option | Description | Selected |
|--------|-------------|----------|
| Beside concerns | Put Git and credential support in `tests/platform/` and device-flow support in `tests/domain/`. | ✓ |
| Central contracts directory | Centralize registrars while keeping fakes beside concerns. | |
| Keep existing helpers | Leave the current fakes under `tests/helpers/`. | |

**User's choice:** Beside their concerns.

### Contract breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Complete public port semantics | Cover all public results, errors, mutation/aliasing, ordering, and validation where applicable. | ✓ |
| Minimum common behavior | Share only success, missing-value, and failure cases. | |
| Full implementation equivalence | Include diagnostics, call logs, and fake controls in the shared contract. | |

**User's choice:** Complete public port semantics.

### Adapter-specific coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Contract plus focused specifics | Production runs the contract plus transport-specific coverage; fake runs the contract plus public fake behavior. | ✓ |
| Contract cases only | Put every transport and fake branch into the shared registrar. | |
| Separate owner specifics | Keep the contract out of the production owner test. | |

**User's choice:** Contract plus focused specifics.

---

## Broken-adapter controls

### Proof mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Executable contract cases | Callable cases let a normal test observe an assertion failure from a broken adapter. | ✓ |
| Failing child-test fixture | Run the broken adapter through a nested `node --test` process. | |
| Breakable shared fake | Add a mutation flag to the normal fake. | |

**User's choice:** Executable contract cases.

### Fault count

| Option | Description | Selected |
|--------|-------------|----------|
| One surgical fault per contract | Give each of Git, credential, and device-flow one targeted defect. | ✓ |
| One fault per public operation | Plant a separate defect for every port operation. | |
| One broadly broken adapter | Let one implementation violate several cases. | |

**User's choice:** One surgical fault per contract.

### Fault localization

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly one named case fails | The broken adapter passes all other contract cases. | ✓ |
| At least one case fails | The broken adapter may trip several cases. | |
| Run only the targeted case | Do not check the broken adapter against the remaining contract. | |

**User's choice:** Exactly one named case fails.

### Negative-control location

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated supplemental test | Add a separate `*-contract-negative.test.ts`. | |
| Inside the fake test | Keep the private defect beside the fake's normal contract invocation. | ✓ |
| Inside the production owner test | Mix the negative control into the paired source owner. | |

**User's choice:** Inside the fake test.

---

## Hermeticity boundary

### Production Git

| Option | Description | Selected |
|--------|-------------|----------|
| Real temporary local repositories | Use the production adapter with per-case local repositories and block remote/auth/time boundaries. | ✓ |
| Fully injected Git substrate | Stub every underlying Git and filesystem operation. | |
| Local Git CLI | Substitute the installed Git executable for the production adapter. | |

**User's choice:** Real temporary local repositories.

### Production credentials

| Option | Description | Selected |
|--------|-------------|----------|
| Injected credential process | Use deterministic `CredentialSpawn` process doubles. | ✓ |
| Isolated real Git helper | Invoke `git credential` with temporary configuration. | |
| Fake contract only | Avoid exercising the production process adapter. | |

**User's choice:** Injected credential process.

### Device-flow HTTP and polling

| Option | Description | Selected |
|--------|-------------|----------|
| Mocked fetch plus injected wait | Inspect exact requests with fresh responses and no real timers. | ✓ |
| Loopback HTTP server | Run production fetch against a per-case localhost server. | |
| Device-flow fake only | Avoid exercising production fetch behavior. | |

**User's choice:** Mocked fetch plus injected wait.

### Fail-closed guard

| Option | Description | Selected |
|--------|-------------|----------|
| Concern-local guarded factories | Require explicit local/fake boundaries and poison live access without a global harness. | ✓ |
| Injection by convention | Depend on plans and review to supply collaborators. | |
| External sandbox only | Depend on CI isolation and credential scrubbing. | |

**User's choice:** Concern-local guarded factories.

---

## the agent's Discretion

- Exact support-file names and splits within `tests/platform/` and `tests/domain/`.
- The single planted defect and named discriminating case for each adapter contract.
- Recorded rationale for public-contract categories that do not apply to a port.

## Deferred Ideas

None.
