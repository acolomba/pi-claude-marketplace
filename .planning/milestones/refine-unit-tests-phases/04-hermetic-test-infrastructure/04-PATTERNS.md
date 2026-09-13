# Phase 4: Hermetic Test Infrastructure - Pattern Map

**Mapped:** 2026-09-07
**Authority:** Active Phase 4 scope changes in `01-REVALIDATION.json`, narrowed
by `04-CONTEXT.md` and the authorized inventory in `04-RESEARCH.md`

## File Classification

| New/Modified File                        | Role                                   | Closest Tracked Analog                                           | Match                                        |
| ---------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `tests/platform/hermetic-environment.ts` | concern-owned test environment support | `tests/orchestrators/scope-fanout.test.ts::makeTestScopes`       | exact restoration pattern                    |
| affected plugin/marketplace/MCP suites   | tests                                  | `tests/orchestrators/marketplace/list.test.ts::withHermeticHome` | same location precedence                     |
| `tests/platform/git-ops-fake.ts`         | stateful boundary fake                 | `tests/platform/credential-ops-fake.ts`                          | exact function-preserving collaborator style |
| `tests/platform/git-ops-fake.test.ts`    | fake contract tests                    | `tests/platform/credential-ops-fake.test.ts`                     | exact                                        |
| `tests/domain/auth-registry.test.ts`     | domain owner test                      | existing unknown-host table                                      | exact                                        |
| `tests/orchestrators/auth-host.test.ts`  | auth wiring owner test                 | existing credential/device-flow cases                            | exact                                        |
| ten traced factory-owner suites          | tests                                  | their existing configured factory bodies                         | behavior-preserving rename                   |
| four plugin production comments          | documentation                          | the typed collaborator members they describe                     | exact role terminology                       |
| `.planning/codebase/CONVENTIONS.md`      | repository convention                  | active TypeScript unit-testing skill                             | exact policy                                 |

## Pattern Assignments

### Case-Owned Environment

**Apply to:** terminally implicated environment helpers and MCP staging cases.

**Analog:** `tests/orchestrators/scope-fanout.test.ts::makeTestScopes` snapshots
`PI_CODING_AGENT_DIR`, assigns a path below a temporary root, and restores the
original presence/value during registered cleanup.

The shared support should expose readonly `root`, `home`, `agentDir`, and `cwd`
paths to one callback. It owns only environment mutation and exact root cleanup.
Suite-specific cache resets and interaction verification remain local wrappers.

Do not copy the older `HOME`-only helper. Do not delete
`PI_CODING_AGENT_DIR`: an explicit case-owned value makes every user-scope path
observable and proves precedence itself.

### Function-Preserving Snapshot

**Apply to:** clone, fetch, and remote-ref call recording in
`tests/platform/git-ops-fake.ts`.

**Analog:** explicit typed projection rather than generic graph cloning.

```typescript
function snapshotCloneOptions(options: CloneOptions): CloneOptions {
  const { auth, ...dataOptions } = options;
  const snapshot = structuredClone(dataOptions);
  return auth === undefined ? snapshot : { ...snapshot, auth };
}
```

Use the corresponding production option type for each operation. Preserve
auth callback identity deliberately; clone every other data field. Consumers
call the shared fake directly and retain only their unrelated configured
behavior.

### Hostile Host Rows

**Apply to:** `tests/domain/auth-registry.test.ts`.

Use independently authored rows that each create a sibling `test()`:

```typescript
for (const host of ["evilgithub.com", "github.com.evil", "api.github.com"]) {
  test(`rejects hostile GitHub neighbor ${host}`, () => {
    assert.strictEqual(findProviderForHost(host), undefined);
  });
}
```

Include GitLab equivalents and provider disjointness. Keep supported exact-host
cases separate.

### Optional Collaborator Without Network

**Apply to:** `tests/orchestrators/auth-host.test.ts`.

Seed a credential under the public credential fake contract, omit
`deviceFlowHttp` and `authMemo`, build auth, invoke `onAuthRequired`, and compare
the exact authentication result plus credential call ledger. The credential
hit ensures the default HTTP adapter is never reached without mocking a global.

### Typed Interaction Boundaries

**Apply to:** terminally traced `ExtensionContext` and `ExtensionAPI` fixtures.

Prefer a consumer-declared interface and `satisfies` for a plain stub/recorder.
If the promised behavior is exact notification or tool interaction, use a
per-case `strong-mock` with `exactParams: true`, explicit counts, and `verify`
after public result/state assertions. Never replace one broad assertion with a
double assertion or `Partial<T>`.

### Role-Only Factory Names

**Apply to:** exactly the 16 selected local definitions and their call sites.

Default mapping:

| Before                   | After                  |
| ------------------------ | ---------------------- |
| `makeMockGitOps`         | `createGitOps`         |
| `makeMockCredentialOps`  | `createCredentialOps`  |
| `makeMockDeviceFlowHttp` | `createDeviceFlowHttp` |

The imported concern-owned abstractions `createGitOpsFake`,
`createCredentialOpsFake`, and `createDeviceFlowFake` remain unchanged. Local
double values keep role names such as `gitOps`, `credentialOps`, and
`deviceFlowHttp`.

## Verification Patterns

- Focused owner test before and after each implementation cluster.
- `npm run test:coverage:direct:all` after the shared Git fake changes.
- Run environment-owner suites with an ambient agent directory set to a
  temporary poison location and compare that location before/after.
- Run `npm run typecheck`, `npx eslint . --max-warnings=0`, Prettier check, and
  `npm run check` after the final cross-file naming/type sweep.
- Census old/new selected definitions and production comments; zero old names
  and exactly 16 new definitions is the completion condition.

## Prohibited Patterns

- `tests/helpers/`, generic utilities, production reset hooks, or test modes.
- `as unknown as`, broad context/API assertions, ignore directives, and invalid
  mutable-discriminator fixtures.
- Serialization or omission of auth callbacks.
- Real network fallback or developer home/agent/MCP access.
- Repository-wide `Mock`/`Fake` renaming beyond the ten selected files.
