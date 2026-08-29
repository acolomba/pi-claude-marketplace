# Phase 108: Domain and Platform - Pattern Map

**Mapped:** 2026-08-28
**Primary path assignments:** 48
**Current relocation references:** 32 unique paths
**Reusable pattern sources:** 5
**Primary assignments with a match:** 41 / 48

## File Classification

### Mirrored owner tests

The current owner remains the behavior inventory for each existing pair. Use
`tests/domain/github-auth.test.ts` as the structural exemplar for lowercase AAA,
case-owned doubles, whole-value assertions, and explicit mock verification.

| New or modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `tests/domain/auth-registry.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/clone-key.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hook-events.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hook-if-targets.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hook-tool-names.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hooks.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hooks/matcher.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hooks/partition.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/hooks/schema.test.ts` | test | transform and validation | Same file; `tests/domain/resolver.types.test.ts` for compile-time checks | exact + type structure |
| `tests/domain/components/mcp.test.ts` | test | transform and validation | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/components/plugin.test.ts` | test | transform and validation | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/github-auth.test.ts` | test | request-response and event-driven polling | Same file | exact |
| `tests/domain/manifest-cache.test.ts` | test | file-I/O and cache CRUD | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/manifest-lookup.test.ts` | test | transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/manifest.test.ts` | test | file-I/O and validation | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/name.test.ts` | test | transform and validation | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/plugin-root.test.ts` | test | path transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/resolver.test.ts` | test | request-response and transform | `tests/domain/resolver.types.test.ts` plus the five legacy resolver suites | role match |
| `tests/domain/source.test.ts` | test | transform and validation | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/domain/version.test.ts` | test | file-I/O and batch transform | Same file for behavior; `tests/domain/github-auth.test.ts` for case form | exact + structure |
| `tests/platform/git-credential.test.ts` | test | request-response and event-driven process I/O | Same file | exact |
| `tests/platform/git.test.ts` | test | file-I/O and request-response | `tests/platform/git-auth-callbacks.test.ts`, `tests/platform/git-remote-refs.test.ts`, and `tests/helpers/git-mock.ts` | role match |
| `tests/platform/pi-api.test.ts` | test | type boundary and transform | Same file; `tests/domain/resolver.types.test.ts` for compile-time checks | exact + type structure |

### Production and support files

| New or modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | model and utility | transform | Same file; remove only branches proved unreachable from exports | exact |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | model and service | request-response and transform | Same file's TypeBox field-bag and constructor pattern | exact |
| `tests/domain/device-flow-contract.ts` | test contract | request-response and event-driven | No live analog; use the canonical shared-contract rule | none |
| `tests/domain/device-flow-fake.ts` | test fake | request-response and event-driven | `tests/helpers/device-flow-mock.ts` | exact relocation |
| `tests/domain/device-flow-fake.test.ts` | supplemental test | request-response and event-driven | No live negative-control analog | none |
| `tests/platform/git-contract.ts` | test contract | file-I/O and request-response | No live analog; use the canonical shared-contract rule | none |
| `tests/platform/git-fake.ts` | test fake | CRUD and file-I/O simulation | `tests/helpers/git-mock.ts` | exact relocation |
| `tests/platform/git-fake.test.ts` | supplemental test | CRUD and request-response | No live negative-control analog | none |
| `tests/platform/git-test-repository.ts` | test factory | file-I/O and request-response | No compliant live analog | none |
| `tests/platform/credential-ops-contract.ts` | test contract | CRUD and request-response | No live analog; use the canonical shared-contract rule | none |
| `tests/platform/credential-fake.ts` | test fake | CRUD and request-response | `tests/helpers/credential-mock.ts` | exact relocation |
| `tests/platform/credential-fake.test.ts` | supplemental test | CRUD and request-response | No live negative-control analog | none |
| `tests/platform/credential-process-fake.ts` | test fake | streaming and event-driven process I/O | `tests/platform/git-credential.test.ts` lines 17-63 | exact extraction |
| `tests/helpers/git-mock.ts` | legacy test fake | CRUD and file-I/O simulation | Move to `tests/platform/git-fake.ts` | exact relocation |
| `tests/helpers/credential-mock.ts` | legacy test fake | CRUD and request-response | Move to `tests/platform/credential-fake.ts` | exact relocation |
| `tests/helpers/device-flow-mock.ts` | legacy test fake | request-response and event-driven | Move to `tests/domain/device-flow-fake.ts` | exact relocation |
| `scripts/check-corresponding-tests.mjs` | config and gate | batch and transform | Same file's AST-based import classification | exact |
| `scripts/check-corresponding-tests.negative.mjs` | negative gate test | file-I/O and batch | Same file's temporary-project negative controls | exact |

### Legacy suite migration inputs

These suites do not become alternative owners. Move their public behavior into
the new canonical owner, or classify any retained file as supplemental by a
structural rule.

| File | Role | Data flow | Destination |
|---|---|---|---|
| `tests/domain/resolver-comp01.test.ts` | legacy test | transform | `tests/domain/resolver.test.ts` |
| `tests/domain/resolver-default-enabled.test.ts` | legacy test | transform | `tests/domain/resolver.test.ts` |
| `tests/domain/resolver-loose.test.ts` | legacy test | request-response and transform | `tests/domain/resolver.test.ts` |
| `tests/domain/resolver-strict.test.ts` | legacy test | request-response and transform | `tests/domain/resolver.test.ts` |
| `tests/domain/resolver.types.test.ts` | legacy type test | compile-time transform | `tests/domain/resolver.test.ts` |
| `tests/platform/git-auth-callbacks.test.ts` | legacy supplemental test | request-response | `tests/platform/git.test.ts` or a structurally supplemental module |
| `tests/platform/git-remote-refs.test.ts` | legacy supplemental test | request-response | `tests/platform/git.test.ts`; remove the loopback listener |

## Pattern Assignments

### Existing owner normalization cohort

**Apply to:** all 21 existing mirrored owner tests.

**Structural analog:** `tests/domain/github-auth.test.ts`

**Imports pattern** (lines 1-17):

```typescript
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  initiateDeviceFlow,
  type DeviceCodeResponse,
  type DeviceFlowHttp,
  type DeviceFlowResult,
  type InitiateDeviceFlowOpts,
  type NotifyFn,
  type PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
```

Use `strong-mock` only when an interaction is public behavior. Pure modules use
`node:assert/strict` and plain typed values.

**Lowercase AAA, case-owned global replacement, whole result, and interactions**
(lines 563-645):

```typescript
test("sends the provider's device and token requests through fetch", async (t) => {
  // arrange
  const provider = authProvider();
  const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
  const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
  const fetchSpy = t.mock.method(
    globalThis,
    "fetch",
    (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://auth.example/device") {
        return Promise.resolve(new Response(JSON.stringify(deviceCode()), { status: 200 }));
      }

      if (url === "https://auth.example/token") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "token-1",
              token_type: "bearer",
              scope: "read_repository",
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    },
  );
  when(() => {
    notification("Open https://verify.example/device and enter: CODE-1", "info");
  }).thenReturn(undefined);
  when(() =>
    credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
  ).thenResolve(undefined);

  // act
  const deviceFlow = await initiateDeviceFlow({
    host: "auth.example",
    credentialOps,
    notifyFn: notification,
    provider,
  });

  // assert
  assert.deepStrictEqual(deviceFlow, {
    ok: true,
    cred: { username: "oauth2", password: "token-1" },
    authAttempted: true,
  });
  const fetchRequests = await Promise.all(
    fetchSpy.mock.calls.map(async ({ arguments: [input, init] }) => {
      const request = new Request(input, init);
      return {
        url: request.url,
        method: request.method,
        accept: request.headers.get("accept"),
        contentType: request.headers.get("content-type"),
        body: await request.text(),
      };
    }),
  );
  assert.deepStrictEqual(fetchRequests, [
    {
      url: "https://auth.example/device",
      method: "POST",
      accept: "application/json",
      contentType: "application/x-www-form-urlencoded",
      body: "client_id=client-1&scope=read_repository",
    },
    {
      url: "https://auth.example/token",
      method: "POST",
      accept: "application/json",
      contentType: "application/x-www-form-urlencoded",
      body: "client_id=client-1&device_code=device-1&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
    },
  ]);
  verify(credentialOps);
  verify(notification);
});
```

Keep each current owner's public behavior. Replace legacy comments and weak
field assertions with this structure. A data row uses separate lowercase
arrange, act, and assert phases. Use `// act & assert` only for one
throwing/rejection expression.

### `extensions/pi-claude-marketplace/domain/components/hooks.ts`

**Analog:** the same file's exported parse and projection pipeline.

Keep `parseHooksConfig` as the public validation entrypoint. Its successful arm
returns `value`, `dropped`, and `ifPredicates` together. Keep
`projectHookSummaryEntries` and `hookSummaryEntriesFromPersisted` as public
projection entrypoints.

The owner must add cases for wrapper and bare inputs, accepted and rejected
groups, compiled `if` maps, both summary arms, default matcher behavior, and the
persisted projection. Prove that the fallbacks at lines 147-148, 315-317, and
342-344 cannot receive exported input. Then remove only those dead branches.
Do not add a coverage ignore.

### `extensions/pi-claude-marketplace/domain/resolver.ts`

**Analog:** the same file's TypeBox schema and constructor pattern.

**Shared materializable field bag** (lines 161-229):

```typescript
const MATERIALIZABLE_FIELDS = {
  name: Type.String(),
  pluginRoot: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  hooksConfigPath: Type.Optional(Type.String()),
  orphanRewake: Type.Optional(Type.Boolean()),
  droppedHooks: Type.Optional(Type.Array(DroppedHookSchema)),
  defaultEnabled: Type.Boolean(),
} as const;

const ResolvedPluginInstallableSchema = Type.Object({
  state: Type.Literal("installable"),
  ...MATERIALIZABLE_FIELDS,
});

const ResolvedPluginPartiallyAvailableSchema = Type.Object({
  state: Type.Literal("partially-available"),
  ...MATERIALIZABLE_FIELDS,
});

const ResolvedPluginUnavailableSchema = Type.Object({
  state: Type.Literal("unavailable"),
  name: Type.String(),
  notes: Type.Array(Type.String()),
});
```

Add `installable: Type.Literal(true)` to `MATERIALIZABLE_FIELDS`. Add
`installable: Type.Literal(false)` only to the unavailable schema. Keep
`pluginRoot` only in the shared materializable bag.

**Constructor pattern** (lines 439-497):

```typescript
function unavailable(name: string, notes: string[]): ResolvedPluginUnavailable {
  return {
    state: "unavailable",
    name,
    notes,
  };
}

function installable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  defaultEnabled: boolean,
): ResolvedPluginInstallable {
  return {
    state: "installable",
    ...materializableFields(name, pluginRoot, partial, defaultEnabled),
  };
}

function partiallyAvailable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  defaultEnabled: boolean,
): ResolvedPluginPartiallyAvailable {
  return {
    state: "partially-available",
    ...materializableFields(name, pluginRoot, partial, defaultEnabled),
  };
}
```

Add the matching literal to all three constructor outputs. Narrow first on
`installable`. Keep `state` checks for the secondary three-way behavior.

**Pre-resolver supporting-fixture field pattern:**

```typescript
const INSTALLABLE_FIXTURE_FIELDS = { installable: true } as const;

const fixture: ResolvedPluginInstallable = {
  ...INSTALLABLE_FIXTURE_FIELDS,
  state: "installable",
  // existing exact fixture fields
};
```

Use the equivalent false-literal bag only for unavailable fixtures. The spread
is deliberate: it typechecks while the old structural type does not declare the
member and satisfies the required literal after P108-18. Do not use an optional
field, `any`, or a result-type cast. P108-06 owns seven agents/commands/integration
construction sites; P108-19 owns the remaining twelve integration/skills/classifier
sites. P108-18 edits none of those supporting files.

### `tests/domain/resolver.test.ts`

**Analogs:** `tests/domain/resolver.types.test.ts` and the five legacy resolver
suites.

**Compile-time narrowing pattern** (lines 47-69):

```typescript
function narrowOnDiscriminator(): string | undefined {
  if (r.state === "installable" || r.state === "partially-available") {
    return r.pluginRoot;
  }

  return undefined;
}

function consumeUnavailable(): void {
  // @ts-expect-error -- pluginRoot must not be accessible on the unavailable variant.
  void unavail.pluginRoot;
}

function narrowOnDiscriminatorNegative(): void {
  if (r.state === "unavailable") {
    // @ts-expect-error -- the unavailable arm has no pluginRoot.
    void r.pluginRoot;
  }
}
```

Change the first positive narrower to `if (r.installable)`. Add a negative
`if (!r.installable)` case. Keep exact checks for all three `state` literals.
Do not copy the artificial runtime smoke case at lines 141-147. Runtime resolver
behavior already belongs to the canonical owner.

### `tests/platform/git-credential.test.ts` and `credential-process-fake.ts`

**Analog:** current owner process control at lines 17-63 and timeout case at
lines 192-222.

**Timer, process termination, and injected spawn pattern** (lines 192-222):

```typescript
test("terminates a timed-out fill and returns null", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const terminate = mock<CredentialProcess["kill"]>({
    exactParams: true,
    name: "credential process termination",
  });
  when(() => terminate("SIGTERM")).thenReturn(true);
  const child = credentialProcess(terminate);
  const spawnProcess = mock<CredentialSpawn>({
    exactParams: true,
    name: "credential process launcher",
  });
  when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
    child.process,
  );
  const credentialOps = createCredentialOps({ spawn: spawnProcess, timeoutMs: 50 });

  // act
  const pendingCredential = credentialOps.fill("github.com");
  t.mock.timers.tick(50);
  const credential = await pendingCredential;

  // assert
  assert.strictEqual(credential, null);
  verify(spawnProcess);
  verify(terminate);
});
```

Extract only the deterministic process implementation into
`credential-process-fake.ts`. Keep production transport assertions in the owner.
Never call the default adapter or depend on `PATH`.

### `tests/platform/git-fake.ts`

**Analog:** `tests/helpers/git-mock.ts`

**Imports and state shape** (lines 21-87):

```typescript
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  GitAuthBundle,
  GitOps,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

export interface MockGitState {
  remoteRefs: Record<string, string>;
  localRefs: Record<string, string>;
  head: string;
  fixtureSourceDir?: string;
  currentBranchOverride?: string | null;
  cloneCalls: { dir: string; url: string; ref?: string; singleBranch?: boolean; auth?: GitAuthBundle }[];
  fetchCalls: { dir: string; remote?: string; ref?: string; auth?: GitAuthBundle }[];
  forceUpdateRefCalls: { dir: string; ref: string; value: string }[];
  checkoutCalls: { dir: string; ref: string }[];
  resolveRefCalls: { dir: string; ref: string }[];
  currentBranchCalls: { dir: string }[];
  resolveRemoteRefCalls: { url: string; ref?: string; auth?: GitAuthBundle }[];
  remoteResolveMap: Record<string, string>;
  remoteHead?: string;
  cloneThrows?: Error;
  fetchThrows?: Error;
  checkoutThrows?: Error;
  resolveRemoteRefThrows?: Error;
}
```

**Fresh mutable state and core operations** (lines 122-186):

```typescript
function buildMockGitState(initial?: Partial<MockGitState>): MockGitState {
  return {
    remoteRefs: { ...(initial?.remoteRefs ?? {}) },
    localRefs: { ...(initial?.localRefs ?? {}) },
    head: initial?.head ?? "",
    cloneCalls: [],
    fetchCalls: [],
    forceUpdateRefCalls: [],
    checkoutCalls: [],
    resolveRefCalls: [],
    currentBranchCalls: [],
    resolveRemoteRefCalls: [],
    remoteResolveMap: { ...(initial?.remoteResolveMap ?? {}) },
    ...pickSeededMockGitKnobs(initial),
  };
}

export function makeMockGitOps(initial?: Partial<MockGitState>): MockGitOpsHandle {
  const state = buildMockGitState(initial);

  const gitOps: GitOps = {
    async clone(opts): Promise<void> {
      state.cloneCalls.push({ ...opts });
      if (state.cloneThrows !== undefined) throw state.cloneThrows;
      await mkdir(opts.dir, { recursive: true });
      if (state.fixtureSourceDir !== undefined) {
        await cp(state.fixtureSourceDir, opts.dir, { recursive: true });
      }
    },
    async fetch(opts): Promise<void> {
      state.fetchCalls.push({ ...opts });
      if (state.fetchThrows !== undefined) throw state.fetchThrows;
      await Promise.resolve();
    },
    async forceUpdateRef(opts): Promise<void> {
      state.forceUpdateRefCalls.push({ ...opts });
      state.localRefs[opts.ref] = opts.value;
    },
  };

  return { gitOps, state };
}
```

Preserve the complete seven-operation `GitOps` surface. Add contract-required
copying or isolation only where public mutable values cross the port.

### `tests/platform/credential-fake.ts`

**Analog:** `tests/helpers/credential-mock.ts`

**Fresh closure state and error controls** (lines 57-103):

```typescript
export function makeMockCredentialOps(
  initial?: Partial<MockCredentialState>,
): MockCredentialOpsHandle {
  const state: MockCredentialState = {
    store: new Map(initial?.store ?? []),
    fillCalls: [],
    approveCalls: [],
    rejectCalls: [],
    ...(initial?.fillThrows !== undefined && { fillThrows: initial.fillThrows }),
    ...(initial?.approveThrows !== undefined && { approveThrows: initial.approveThrows }),
    ...(initial?.rejectThrows !== undefined && { rejectThrows: initial.rejectThrows }),
  };

  const credOps: CredentialOps = {
    async fill(host: string): Promise<GitCredentials | null> {
      state.fillCalls.push({ host });
      if (state.fillThrows !== undefined) throw state.fillThrows;
      await Promise.resolve();
      return state.store.get(host) ?? null;
    },
    async approve(host: string, cred: GitCredentials): Promise<void> {
      state.approveCalls.push({ host, cred });
      if (state.approveThrows !== undefined) throw state.approveThrows;
      await Promise.resolve();
      state.store.set(host, cred);
    },
    async reject(host: string, cred: GitCredentials): Promise<void> {
      state.rejectCalls.push({ host, cred });
      if (state.rejectThrows !== undefined) throw state.rejectThrows;
      await Promise.resolve();
      state.store.delete(host);
    },
  };

  return { credOps, state };
}
```

Rename the production-role handle to `credentialOps`. Use `structuredClone()`
at approve ingress and fill egress. Clone call-log credentials too.

### `tests/domain/device-flow-fake.ts`

**Analog:** `tests/helpers/device-flow-mock.ts`

**Fresh queues and ordered polling** (lines 64-117):

```typescript
export function makeMockDeviceFlowHttp(
  initial?: Partial<MockDeviceFlowState>,
): MockDeviceFlowHttpHandle {
  const state: MockDeviceFlowState = {
    deviceCode: initial?.deviceCode ?? {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [...(initial?.pollQueue ?? [])],
    defaultPoll: initial?.defaultPoll ?? { kind: "pending" },
    requestCodeCalls: [],
    pollTokenCalls: [],
    ...(initial?.requestCodeThrows !== undefined && {
      requestCodeThrows: initial.requestCodeThrows,
    }),
    ...(initial?.pollTokenThrows !== undefined && { pollTokenThrows: initial.pollTokenThrows }),
  };

  const http: DeviceFlowHttp = {
    async requestCode(clientId, scope): Promise<DeviceCodeResponse> {
      state.requestCodeCalls.push({ clientId, scope });
      if (state.requestCodeThrows !== undefined) throw state.requestCodeThrows;
      await Promise.resolve();
      return state.deviceCode;
    },
    async pollToken(clientId, deviceCode, intervalSec): Promise<PollResult> {
      state.pollTokenCalls.push({ clientId, deviceCode, intervalSec });
      if (state.pollTokenThrows !== undefined) throw state.pollTokenThrows;
      await Promise.resolve();
      return state.pollQueue.shift() ?? state.defaultPoll;
    },
  };

  return { http, state };
}
```

Rename the handle to the production role. Clone device-code and poll values at
queue ingress and response egress. Keep FIFO consumption explicit.

### Contract registrars and fake participant tests

**Live analog:** none.

Use this research-backed shape for each Git, credential, and device-flow
contract. The case calls the factory, so every registration gets fresh state.

```typescript
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

The fake participant invokes the same registrar. Its private broken adapter
runs each callable case directly:

```typescript
const failures: string[] = [];

for (const contractCase of contractCases) {
  try {
    await contractCase.run(createFreshBrokenAdapter);
  } catch (error) {
    assert.ok(error instanceof assert.AssertionError);
    failures.push(contractCase.name);
  }
}

assert.deepStrictEqual(failures, ["literal expected failing case name"]);
```

Write the expected case name beside the broken implementation. Do not import or
derive that expected name from the contract list.

Use these concern-specific defects:

| Concern | Private defect | Exact discriminating case |
|---|---|---|
| Git | `forceUpdateRef` returns without changing the ref | `force-updates a ref to the requested commit` |
| Credential | `fill` returns stored mutable state by reference | `returns a credential copy that cannot mutate stored state` |
| Device flow | `pollToken` reads without consuming the queue head | `consumes polling responses in order` |

### `tests/platform/git-test-repository.ts` and `tests/platform/git.test.ts`

**Live analog:** none. `tests/platform/git-remote-refs.test.ts` is migration
input, but its loopback server is an anti-pattern for this phase.

Use one `mkdtemp()` directory per case. Register `rm(directory, { recursive:
true, force: true })` with `t.after()`. Seed local repositories with
`isomorphic-git`, not the Git CLI. Replace `isomorphic-git/http/node.request`
through the current test context. Reject every unplanned URL and credential
request.

The shared Git contract covers only the seven-operation `GitOps` port. The
canonical owner separately covers `listBranches`, `listRemotes`,
`buildAuthCallbacks`, option forwarding, HTTP calls, filesystem behavior, and
stable errors.

### `scripts/check-corresponding-tests.mjs`

**Analog:** the same file's AST import inspection.

**Current candidate and import pattern** (lines 39-75):

```javascript
function isCorrespondingTestCandidate(testPath) {
  const relativePath = testPath.slice(`${testRoot}/`.length);
  const firstSegment = relativePath.split("/", 1)[0];
  return !nonCorrespondingRoots.has(firstSegment);
}

function importedPaths(projectRoot, testPath) {
  const absoluteTestPath = path.join(projectRoot, testPath);
  const sourceFile = ts.createSourceFile(
    testPath,
    readFileSync(absoluteTestPath, "utf8"),
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );
  const paths = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    if (statement.moduleSpecifier === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".")) continue;

    const resolvedPath = path.resolve(path.dirname(absoluteTestPath), specifier);
    paths.push(toProjectPath(projectRoot, resolvedPath).replace(/\.js$/, ".ts"));
  }

  return paths;
}
```

Add a structural supplemental classifier. It must require the intentional fake
test suffix and imports of its sibling fake and contract. Do not add a named
allowlist. The existing `unexpected-test` loop at lines 98-104 remains the
default for every unmatched test.

**Negative fixture pattern** (`scripts/check-corresponding-tests.negative.mjs`
lines 14-47):

```javascript
try {
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(testDirectory, { recursive: true });
  await writeFile(sourcePath, "export const answer = 42;\n");
  await writeFile(
    testPath,
    'import { answer } from "../../extensions/pi-claude-marketplace/domain/answer.ts";\nvoid answer;\n',
  );

  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), []);

  await unlink(testPath);
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "missing-test", path: "tests/domain/answer.test.ts" },
  ]);

  await writeFile(testPath, 'import assert from "node:assert/strict";\nvoid assert;\n');
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "wrong-import", path: "tests/domain/answer.test.ts" },
  ]);

  await writeFile(
    testPath,
    'import { answer } from "../../extensions/pi-claude-marketplace/domain/answer.ts";\nvoid answer;\n',
  );
  await writeFile(path.join(testDirectory, "extra.test.ts"), "export {};\n");
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), [
    { kind: "unexpected-test", path: "tests/domain/extra.test.ts" },
  ]);
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
```

Extend this fixture with one accepted structural fake test and one arbitrary
suffix lookalike that still returns `unexpected-test`.

## Shared Patterns

### Test case form

Apply this rule to every runtime case created or modified in Phase 108:

1. Use lowercase `// arrange`, `// act`, and `// assert` in this order.
2. Separate the phases with blank lines.
3. Use `// act & assert` only for one throwing/rejection expression; data rows use separate phases.
4. Give every stateful case fresh dependencies.
5. Assert the whole public value or state before interaction verification.
6. End each `strong-mock` case with `verify()` for every mock.

Type-only checks use `satisfies` and `@ts-expect-error`. They do not need phase
comments or an artificial runtime case.

### Errors

Assert stable error classes and structured fields. Do not use message fragments
when the source exposes a typed error. For external process, fetch, and Git
errors, build the exact error independently and assert the public conversion.

### Mutable boundaries

Use `structuredClone()` at fake ingress and egress. Clone values written to call
logs. Primitive Git OIDs and branch names need no aliasing case. Record this as
inapplicable in the Git capability table.

### Hermetic resources

Use `t.mock.method()` and `t.mock.timers` from the current case. Return a fresh
`Response` per fetch call. Register filesystem cleanup with `t.after()` or a
case-local `finally`. Do not use a live network, developer credentials, the Git
CLI, a keychain, or a real timer.

### Pair ownership

The mirrored owner imports its production source and owns its direct coverage.
Contract and fake tests are supplemental evidence. Import-only helper relocation
does not complete a later production pair. Likewise, an exact-literal resolver
fixture preflight in a supporting test does not complete that test's later
production pair; the frontmatter owner remains the plan's sole pair.

## Relocation Reference Inventory

Current repository search found 26 Git references, 16 credential references,
and 8 device-flow references. Some paths appear in more than one concern.

### Git helper references

```text
tests/architecture/config-state-consistency.test.ts
tests/architecture/cross-op-convergence.test.ts
tests/edge/handlers/marketplace/add.test.ts
tests/edge/handlers/marketplace/update.test.ts
tests/edge/handlers/plugin/bootstrap.test.ts
tests/helpers/credential-mock.ts
tests/helpers/device-flow-mock.ts
tests/helpers/git-mock.ts
tests/orchestrators/marketplace/_fixtures/README.md
tests/orchestrators/marketplace/add-seed-mirrors.test.ts
tests/orchestrators/marketplace/add.test.ts
tests/orchestrators/marketplace/remove.test.ts
tests/orchestrators/marketplace/update-transport.test.ts
tests/orchestrators/marketplace/update.test.ts
tests/orchestrators/plugin/bootstrap.test.ts
tests/orchestrators/plugin/clone-cache-seed.test.ts
tests/orchestrators/plugin/clone-cache.test.ts
tests/orchestrators/plugin/fetch.test.ts
tests/orchestrators/plugin/info-manifest-absent.test.ts
tests/orchestrators/plugin/info.test.ts
tests/orchestrators/plugin/install-auth.test.ts
tests/orchestrators/plugin/install.test.ts
tests/orchestrators/plugin/reinstall.test.ts
tests/orchestrators/plugin/update-reinstall-auth.test.ts
tests/orchestrators/plugin/update.test.ts
tests/orchestrators/reconcile/apply.test.ts
```

### Credential helper references

```text
tests/helpers/device-flow-mock.ts
tests/integration/auth-e2e.test.ts
tests/orchestrators/auth-host.test.ts
tests/orchestrators/marketplace/add-seed-mirrors.test.ts
tests/orchestrators/marketplace/add.test.ts
tests/orchestrators/marketplace/shared.test.ts
tests/orchestrators/marketplace/update-transport.test.ts
tests/orchestrators/marketplace/update.test.ts
tests/orchestrators/plugin/fetch.test.ts
tests/orchestrators/plugin/info-manifest-absent.test.ts
tests/orchestrators/plugin/info.test.ts
tests/orchestrators/plugin/install-auth.test.ts
tests/orchestrators/plugin/update-reinstall-auth.test.ts
tests/platform/git-auth-callbacks.test.ts
tests/platform/git-remote-refs.test.ts
tests/shared/device-flow-prompt.test.ts
```

### Device-flow helper references

```text
tests/integration/auth-e2e.test.ts
tests/orchestrators/auth-host.test.ts
tests/orchestrators/marketplace/add.test.ts
tests/orchestrators/marketplace/update-transport.test.ts
tests/orchestrators/plugin/fetch.test.ts
tests/orchestrators/plugin/install-auth.test.ts
tests/orchestrators/plugin/update-reinstall-auth.test.ts
tests/shared/device-flow-prompt.test.ts
```

Each carrier must repeat its repository search before deletion. Update imports,
type imports, and owned comments. Do not add migration-history comments.

## No Analog Found

| File | Role | Data flow | Planner source |
|---|---|---|---|
| `tests/domain/device-flow-contract.ts` | test contract | request-response and event-driven | `108-RESEARCH.md` Pattern 1 and canonical shared-contract rule |
| `tests/platform/git-contract.ts` | test contract | file-I/O and request-response | `108-RESEARCH.md` Pattern 1 and Git responsibility matrix |
| `tests/platform/credential-ops-contract.ts` | test contract | CRUD and request-response | `108-RESEARCH.md` Pattern 1 and credential responsibility matrix |
| `tests/domain/device-flow-fake.test.ts` | supplemental negative control | event-driven | `108-RESEARCH.md` Pattern 2 |
| `tests/platform/git-fake.test.ts` | supplemental negative control | CRUD and request-response | `108-RESEARCH.md` Pattern 2 |
| `tests/platform/credential-fake.test.ts` | supplemental negative control | CRUD and request-response | `108-RESEARCH.md` Pattern 2 |
| `tests/platform/git-test-repository.ts` | guarded test factory | file-I/O and request-response | `108-RESEARCH.md` Git matrix and hermeticity decisions D-15/D-18/D-19 |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/`,
`extensions/pi-claude-marketplace/platform/`, `tests/domain/`,
`tests/platform/`, `tests/helpers/`, and `scripts/`.

**Code discovery:** CodeGraph CLI first, followed by exact repository searches
for current helper-reference inventories.

**Primary reusable analog files:**

- `tests/domain/github-auth.test.ts`
- `tests/domain/resolver.types.test.ts`
- `tests/helpers/git-mock.ts`
- `tests/helpers/credential-mock.ts`
- `tests/helpers/device-flow-mock.ts`

**Same-file continuation sources:** `tests/platform/git-credential.test.ts`,
`extensions/pi-claude-marketplace/domain/resolver.ts`,
`scripts/check-corresponding-tests.mjs`, and
`scripts/check-corresponding-tests.negative.mjs`.

**Pattern extraction date:** 2026-08-28
