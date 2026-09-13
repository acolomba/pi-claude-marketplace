# Phase 4: Hermetic Test Infrastructure - Research

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Build the authorized inventory from the active `AUTH-01`, `TREF-01`,
  `TREF-02`, `TREF-03`, and Phase 4 scope changes in
  `01-REVALIDATION.json`. Historical reviews are provenance, not independent
  authority.
- Use a unique temporary root for every affected case. Pin
  `PI_CODING_AGENT_DIR` explicitly and pin `HOME` where the production path can
  consult it. Restore both variables exactly through guaranteed cleanup.
- Keep hermetic support in tests. Add no production test mode, reset hook,
  path override, or global seam.
- Record real function-bearing `GitAuthBundle` values in the shared Git fake
  through typed snapshots. Remove downstream strip-and-reattach adapters.
- Prove hostile provider-host rejection, genuinely omitted optional auth
  collaborators, and realistic authentication-failure propagation offline.
- Rename exactly nine `makeMockGitOps`, four `makeMockCredentialOps`, and three
  `makeMockDeviceFlowHttp` definitions across the ten terminally traced files.
  Do not rename `makeMockPi` or unrelated fake families.
- Replace terminally traced broad context/API casts with typed collaborators or
  narrowed production dependency shapes. Preserve behavior and true safety
  checks; add no ignore directive or invalid fixture.
- Update `.planning/codebase/CONVENTIONS.md` to select role-only double names and
  remove stale helper references.

### Deferred Ideas (OUT OF SCOPE)

- `MF-005`, direct-coverage gate design, and unused-member enforcement remain
  assigned to Phase 7.
- Production enable/disable cleanup from `OPEF-F12` and `OPEFR-F004` is not in
  the authoritative Phase 4 route.
- General module splitting remains assigned to Phase 6.
- Production test-only exports and `__deps` seams are not authorized here.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                                    | Research Support                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01               | Terminal tests cover hostile-host rejection, optional collaborator behavior, and realistic authentication-failure propagation. | Exact host predicates already exist; the missing work is discriminating public-path coverage with offline collaborators.                                            |
| TREF-01               | Terminal gaps use case-owned temporary state and cannot access developer host configuration.                                   | `PI_CODING_AGENT_DIR` takes precedence over `HOME`; affected helpers must control both and project MCP tests must isolate merged user state.                        |
| TREF-02               | External-failure doubles preserve function-bearing collaborators with production-faithful behavior.                            | The shared Git fake currently passes auth-bearing options to `structuredClone`, which throws `DataCloneError`; eight consumers contain local stripping workarounds. |
| TREF-03               | Typed domain values and role-named doubles replace broad casts and production test-helper terminology.                         | The terminal ledger selects 16 factory definitions, four production comment owners, and traced `ExtensionContext`/`ExtensionAPI` literal casts.                     |
| </phase_requirements> |

## Summary

Phase 4 is a test-infrastructure correction, not a production-feature phase.
The code already exposes the required dependency seams: location resolution
uses environment inputs, auth builders accept credential and device-flow
collaborators, and orchestration accepts typed Git operations. The work is to
make the tests exercise those real contracts without ambient host state,
function-erasing snapshots, or compiler-bypassing fixture casts.

No new package or network service is required. Use Node's temporary filesystem,
the existing `createCredentialOpsFake`, `createDeviceFlowFake`,
`createGitOpsFake`, and `strong-mock` only where an interaction is the public
promise. The complete implementation can stay offline.

**Primary recommendation:** implement the shared primitives first, migrate
their dependents second, then perform the exact role-name/comment sweep last.
That order eliminates compatibility wrappers before their identifiers change
and gives the final census a stable target.

## Terminal Evidence Interpretation

The raw finding records retain older phase labels, but the active scope changes
are later and authoritative. Apply them as follows:

| Scope record           | Active work                                                                     | Explicit exclusion                                                |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `SCOPE-REQ-AUTH-01`    | `DCORE-001`, `ORR-F011`, and the auth-bearing portion of `PLT-F020`             | Do not revive the unmodeled four-site GAUTH sentinel.             |
| `SCOPE-REQ-TREF-01`    | The install/list user-root escape and current MCP effective-user-state escape   | `AUDIT-007` is stale evidence only; add no production test seam.  |
| `SCOPE-REQ-TREF-02`    | Shared Git fake fidelity, downstream workaround removal, and `MF-DEC-08` naming | `makeMockPi` and unrelated `Fake` families.                       |
| `SCOPE-REQ-TREF-03`    | Terminal cast/type corrections, 16 role names, and four production comments     | Preserve real safety checks; do not manufacture coverage.         |
| `SCOPE-ROUTE-PHASE-04` | Hermetic/auth/fake/typed-double portions only                                   | `MF-005` gate audit remains Phase 7 despite its historical route. |

## Authorized Implementation Inventory

### 1. Case-Owned Environment Boundary

`locationsFor("user", cwd)` reaches the Pi SDK's `getAgentDir()`, which reads
`PI_CODING_AGENT_DIR` before its home-derived fallback. A helper that changes
only `HOME` is therefore unsafe. The currently correct local pattern snapshots
both variables and restores absence by deletion, but some variants delete the
agent variable rather than assigning a case-owned value. Assigning a temporary
agent directory is more discriminating because user-scope writes then have an
exact inspectable destination.

Create concern-owned support under `tests/platform/`, not a generic
`tests/helpers/` directory. The helper should:

1. create one root containing separate `home`, `agent`, and `cwd` directories;
2. capture both variables before mutation;
3. assign `HOME` and `PI_CODING_AGENT_DIR` beneath the root;
4. invoke one asynchronous callback with readonly paths;
5. restore both variables in `finally` and remove only that exact root.

Migrate the terminally implicated user-scope suites and their enumerated sibling
variants: plugin install, reinstall, uninstall, update, enable-disable, info,
and list; marketplace update; and cross-operation convergence. Preserve each
suite's local cache reset or interaction-verification behavior around the shared
environment primitive. Existing marketplace list/info/autoupdate helpers that
already handle both variables are useful proof but need not be changed merely
for uniformity.

For `tests/bridges/mcp/stage.test.ts`, use the same boundary when a case can
call `loadEffectiveServerNames`. A project `cwd` alone is insufficient because
effective MCP discovery merges user-scoped names. Add a regression that places
a sentinel MCP entry outside the case root (or in the prior variable target),
then proves the project operation sees only the case-owned project and user
locations.

### 2. Function-Bearing Git Call Snapshots

The shared fake's `clone`, `fetch`, and `resolveRemoteRef` ledgers currently use
`structuredClone(options)`. Their production option types admit an auth bundle
containing `credentialOps` and `onAuthRequired` functions. JavaScript's
structured clone algorithm rejects functions, so valid production input throws
before the configured fake behavior runs.

Use explicit snapshot functions per option type. Structured-clone the data-only
fields, then attach the original readonly auth bundle when present. This keeps
ordinary option mutation from aliasing call history while retaining the exact
function identities required for invocation. Avoid one generic assertion-based
helper: the phase is specifically removing broad type assertions.

Add direct fake cases for clone, fetch, and remote-ref resolution with a real
production-shaped auth bundle. Assert the complete recorded options, callback
identity, callback result or thrown error identity, and normal fake result/state.
Run the all-pairs direct coverage gate because this is shared test support.

After the shared correction, remove auth stripping and manual ledger mutation
from these current consumers:

- `tests/orchestrators/marketplace/add.test.ts`
- `tests/orchestrators/marketplace/update.test.ts`
- `tests/orchestrators/plugin/clone-cache.test.ts`
- `tests/orchestrators/plugin/fetch.test.ts`
- `tests/orchestrators/plugin/info.test.ts`
- `tests/orchestrators/plugin/install.test.ts`
- `tests/orchestrators/plugin/reinstall.test.ts`
- `tests/orchestrators/plugin/update.test.ts`

Keep only consumer-specific behavior such as local fixture materialization,
synthetic refs, and configured failures.

### 3. Authentication Proofs

Production provider predicates already use exact equality for `github.com` and
`gitlab.com`. The missing test is adversarial: a widening mutation to suffix
matching survives. Add one typed row per hostile host and let the loop create an
independent `test()` for each. Include prefixes, suffixes, subdomains, and the
opposite provider so provider selection stays disjoint.

The current `buildCloneAuth` optional-collaborator case proves only that its
input object omitted keys and compares `onAuthRequired` to itself. Seed the
credential fake through its public contract, omit `deviceFlowHttp` and
`authMemo`, invoke `onAuthRequired`, and assert the exact filled credential and
credential calls. This proves the omitted HTTP collaborator is not touched and
avoids a real fetch.

For realistic failure propagation, pass an `onAuthRequired` callback whose
failure object or thrown `Error` has unique identity through the shared Git fake,
read the recorded auth bundle, invoke it, and compare the complete result or
error identity. Do not merely assert that an `auth` property exists.

### 4. Typed Context and API Values

The traced suites create partial object literals and then assert them as the
large SDK `ExtensionContext` and `ExtensionAPI` interfaces. Prefer the smallest
existing typed interaction boundary. Where orchestration only notifies and
reads tools, introduce or reuse consumer-declared readonly ports and type the
literal with `satisfies`; where the SDK object itself is the public interaction,
use a per-case exact `strong-mock` and verify it after result/state assertions.

Do not add a second assertion to hide a missing member. Preserve complete
notification arrays, tool inventories, and all current result/state assertions.
Limit changes to the terminally traced contexts in marketplace update,
plugin enable-disable, and the install-family helpers reached by the active
cross-cutting record.

### 5. Exact Role-Name and Comment Migration

The current source census confirms 16 definitions across ten files:

| Family                   | Definitions | Files                                                                                                                                                                                                                                              |
| ------------------------ | ----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `makeMockGitOps`         |           9 | `tests/architecture/cross-op-convergence.test.ts`, `tests/architecture/config-state-consistency.test.ts`, `tests/orchestrators/marketplace/{add,update}.test.ts`, `tests/orchestrators/plugin/{clone-cache,info,install,reinstall,update}.test.ts` |
| `makeMockCredentialOps`  |           4 | `tests/integration/auth-e2e.test.ts`, `tests/orchestrators/marketplace/{add,update}.test.ts`, `tests/orchestrators/plugin/info.test.ts`                                                                                                            |
| `makeMockDeviceFlowHttp` |           3 | `tests/integration/auth-e2e.test.ts`, `tests/orchestrators/marketplace/{add,update}.test.ts`                                                                                                                                                       |

Use `createGitOps`, `createCredentialOps`, and `createDeviceFlowHttp` unless a
local collision requires an equally role-based configured name. Apply the
rename to every call in each defining file, then prove the exact census is zero
old definitions and 16 new definitions. Do not alter imported established
`createGitOpsFake`, `createCredentialOpsFake`, or `createDeviceFlowFake` names;
those are intentional reusable abstraction names, not the selected local double
values.

Replace local factory names in production comments with the collaborator role:

- `orchestrators/plugin/fetch.ts`
- `orchestrators/plugin/install.ts`
- `orchestrators/plugin/reinstall.ts`
- `orchestrators/plugin/update.ts`

Update `CONVENTIONS.md` to remove the `makeMock*` rule and its absent
`tests/helpers/credential-mock.ts` example. Record that values and local
factories use production-role names while established concern-owned fake types
may use `Fake` when the abstraction itself is intentional.

## Verification Strategy

| Change                             | Focused proof                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment support and migrations | Run every migrated suite with `PI_CODING_AGENT_DIR` pre-poisoned to a guarded temporary path and verify the path remains byte-identical or absent. |
| MCP isolation                      | `node --test tests/bridges/mcp/stage.test.ts` plus the case-owned user sentinel regression.                                                        |
| Shared Git fake                    | `node --test tests/platform/git-ops-fake.test.ts` and `npm run test:coverage:direct:all`.                                                          |
| Auth behavior                      | `node --test tests/domain/auth-registry.test.ts tests/orchestrators/auth-host.test.ts`.                                                            |
| Typed contexts                     | Focused owner suites plus `npm run typecheck` and ESLint.                                                                                          |
| Role-name sweep                    | Run all ten defining suites, affected shared-support dependents, a zero-old-name census, Prettier, typecheck, ESLint, and full `npm run check`.    |

The final verification must also scan changed TypeScript for broad double
assertions, ignore pragmas, committed skipped tests, and production comments
that mention the removed local factory names.

## Risks and Mitigations

| Risk                                                        | Mitigation                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Process environment races                                   | Keep each helper callback serial within its file; register/enter restoration before production work and use one root per call.                      |
| Removing a wrapper also removes fixture behavior            | Delete only auth stripping and manual call-ledger mutation; retain local filesystem/ref/failure behavior.                                           |
| Snapshot aliases mutable option data                        | Structured-clone all data-only fields; retain only the intentional function-bearing auth bundle by identity.                                        |
| Optional-collaborator test accidentally reaches the network | Seed credential fill so the production callback returns before Device Flow; assert exact credential calls.                                          |
| Naming sweep expands beyond the decision                    | Count definitions before and after, target only the ten listed files, and leave unrelated `makeMockPi`/`*Fake` names unchanged.                     |
| Broad cast removal forces a production redesign             | Prefer an existing narrow port; if none exists, introduce only a consumer-declared structural type with unchanged runtime shape and owner coverage. |

## Planning Recommendation

Use six plans:

1. shared hermetic environment primitive;
2. migration of user-scope and MCP owner suites;
3. function-bearing Git fake and workaround removal;
4. hostile-host and optional/failing auth proofs;
5. typed context/API collaborator correction;
6. exact 16-factory and four-comment role-name migration plus conventions and
   complete verification.

Plans 2 and 3 may run after Plan 1 independently where their files do not
overlap. Plans 4 and 5 depend on the shared fake/environment primitives as
appropriate. The exact naming sweep should run last because it touches most
files from earlier plans.

---

_Phase: 04-hermetic-test-infrastructure_
_Research completed: 2026-09-07_
