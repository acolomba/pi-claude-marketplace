# Platform — git, git credentials, Pi API, shared adapter contracts

**Scope:** `tests/platform/*.ts` (11 files) and every `.ts` under
`extensions/pi-claude-marketplace/platform/` (`git.ts`, `pi-api.ts`,
`git-credential.ts`)
**Test files reviewed:** 11
**Production modules reviewed:** 3

## Summary

This is the strongest area reviewed so far for the shared-contract pattern: both
`git-ops-contract.ts` and `credential-ops-contract.ts` are invoked from their fake's
test AND their real adapter's test, every case constructs a fresh instance, and both
contracts carry a deliberately-broken-fake negative control with an independently
written, private expectation that fails exactly one named case. Real-adapter
hermeticity is excellent: `git.test.ts` never touches a real remote (all
`isomorphic-git` HTTP traffic is intercepted at `http.request` and served from
packed local commits), and `git-credential.test.ts` never spawns a real `git`
subprocess (every case injects `credential-process-fake.ts`). The one real break is
in `tests/platform/git-ops-fake.ts`: its own call-log recording crashes on the
`auth` bundle its type signature advertises support for, and a downstream consumer
(`tests/orchestrators/marketplace/add.test.ts`) has already had to invent a
strip-then-reattach workaround instead of the shared fake handling it once. Secondary
themes for a fixing pass: a documentation gap in `git-ops-contract.ts`'s six-category
coverage table (validation is neither covered nor recorded as inapplicable), a
production-design fix in `pi-api.ts` that would remove four double-assertions from
`pi-api.test.ts`, and a handful of small type-design opportunities in `git.ts` and
`git-credential.ts`.

## Unit test findings

### `tests/platform/git-ops-fake.ts`

- **[BLOCKER] `clone`/`fetch`/`resolveRemoteRef` crash on the `auth` bundle their own type declares** — `lines 129, 146, 203`
  `GitOpsFakeCalls` types `clone`/`fetch`/`resolveRemoteRef` call-log entries as
  carrying `auth?: GitAuthBundle` (lines 28-53), but the implementation logs the
  call with `calls.clone.push(structuredClone(cloneOptions))` (line 129, and the
  matching `structuredClone(fetchOptions)` / `structuredClone(resolveOptions)` at
  lines 146 and 203). `GitAuthBundle` carries `credentialOps` (an object of
  functions) and `onAuthRequired` (a function); `structuredClone` throws
  `DataCloneError: ... could not be cloned` on any value containing a function.
  Calling `gitOps.clone({ dir, url, auth: { credentialOps, host, onAuthRequired } })`
  directly against this fake therefore throws instead of recording the call. This
  is not hypothetical: `tests/orchestrators/marketplace/add.test.ts`'s local
  `makeMockGitOps` wrapper (lines 138-150) already has to strip `auth` out of the
  options before delegating to `git.gitOps.clone(authlessOptions)`, then manually
  `Object.assign` the auth object back onto the already-cloned log entry by
  reference — a workaround for exactly this defect, duplicated at the call site
  instead of fixed once in the shared fake. `git-ops-fake.test.ts`'s own suite never
  passes an `auth` bundle to `clone`/`fetch`/`resolveRemoteRef`, so the crash is
  invisible from inside this file's own coverage.
  Fix in `git-ops-fake.ts` itself, once, for all three operations: destructure
  `auth` out before cloning and reattach it by reference, e.g.
  `const { auth, ...loggable } = cloneOptions; calls.clone.push({ ...structuredClone(loggable), ...(auth !== undefined && { auth }) });`.
  This keeps aliasing protection for the plain-data fields while not attempting to
  clone live collaborator references (which, like a mock or callback, are not
  values that should be cloned). Then delete the workaround in
  `add.test.ts` (out of this area's scope, but worth flagging to whichever review
  covers `orchestrators/marketplace`).

### `tests/platform/git-ops-contract.ts`

- **[WARNING] The "validation" category is neither covered nor recorded as inapplicable** — `lines 40–43`
  The comment block after `GIT_OPS_CASE_NAMES` explicitly names three of the six
  required categories as inapplicable ("Mutable aliasing...", "Global ordering...",
  "Deletion is inapplicable...") but the fourth line ("Raw HTTP, auth, filesystem
  cleanup, and option forwarding are production-owner mechanics") never names
  "validation," and no case in the file tests input validation (the two
  "rejects a missing ... ref" cases are missing-value cases, not validation of a
  malformed ref/URL). Compare `credential-ops-contract.ts`, which explicitly covers
  validation with 21 control-character cases, and `device-flow-contract.ts`, whose
  header comment explicitly says "Input validation is inapplicable because...".
  Add a line naming validation explicitly, e.g. "Validation is inapplicable because
  GitOps performs no input validation of its own; malformed input is rejected by
  the wrapped isomorphic-git library, not this contract," or add a case if GitOps
  is later found to validate something on its own.

### `tests/platform/git-ops-fake.test.ts`

- **[WARNING] The negative control and the case-name inventory check share one test** — `lines 98–125`
  `test("the no-force-update fake fails only the force-update invariant", ...)`
  performs two independent checks under a title that only describes the second one:
  it asserts `gitOpsContractCases.map(...) `equals `GIT_OPS_CASE_NAMES` (lines
  120–123, the case-name-inventory check) and then asserts `failures` (the
  negative-control result, line 124). `credential-ops-fake.test.ts` and
  `device-flow-fake.test.ts` (the model) both keep these as two separate,
  independently titled tests: `"keeps the source-defined contract case order"` and
  `"detects only the ... defect"`. Split this test the same way: a standalone
  `test("keeps the source-defined contract case order", ...)` asserting only the
  name-inventory equality, and `test("the no-force-update fake fails only the
  force-update invariant", ...)` asserting only `failures`.

### `tests/platform/git.test.ts`

- **[WARNING] `describe("local Git operations")` groups six unrelated exports under one non-entrypoint name** — `line 627`
  The block holds cases for `currentBranch`, `resolveRef`, `listBranches` (x2),
  `listRemotes` (x2), `forceUpdateRef`, and `checkout` — six different exported
  functions under a label that names none of them. The guideline's grouping rule
  is "one top-level `describe()` block for each [exported] entrypoint... the name
  must identify an exported function." Split into one `describe()` per function
  (`describe("currentBranch", ...)`, `describe("resolveRef", ...)`, etc.), matching
  the shape already used for `clone`, `fetch`, `resolveRemoteRef`, and
  `buildAuthCallbacks` later in the same file.

### `tests/platform/pi-api.test.ts`

- **[WARNING] Four double assertions (`as unknown as PiBoundary.ExtensionAPI`) build an incomplete double** — `lines 28, 238, 320, 387`
  `extensionApiWithTools` (line 28) and three inline throwing fakes (lines 238,
  320, 387) each build an object with only `getAllTools` and force it through
  `as unknown as PiBoundary.ExtensionAPI` to satisfy the parameter type of
  `hasLoadedPiSubagents`/`hasLoadedPiMcpAdapter`/`softDepStatus`. This is exactly
  the pattern the unit-testing guideline calls out: "no ... double assertion ...
  hiding an invalid double — the production contract gets narrowed instead." The
  double itself is behaviorally correct here (only `getAllTools` is ever called),
  but the type checker cannot confirm that, and a future change to these functions
  that reached for a second `ExtensionAPI` member would compile against the full
  interface while every double in this file silently lacks it. See the paired
  production finding on `pi-api.ts` below for the fix (narrow the parameter type),
  which removes the need for all four casts.

### Clean files

- `tests/platform/credential-ops-contract.ts`
- `tests/platform/credential-ops-fake.ts`
- `tests/platform/credential-ops-fake.test.ts`
- `tests/platform/credential-process-fake.ts`
- `tests/platform/git-credential.test.ts`
- `tests/platform/git-test-repository.ts`

## Shared-contract pattern assessment (git-ops and credential-ops vs. the device-flow model)

Both contracts satisfy the core requirements: `registerGitOpsContract` is called
from `git-ops-fake.test.ts` (fake) and `git.test.ts`'s `describe("GitOps contract")`
(real adapter, `createProductionGitOps`); `registerCredentialOpsContract` is called
from `credential-ops-fake.test.ts` (fake) and `git-credential.test.ts`'s
`describe("createCredentialOps")` (real adapter). Every case factory
(`createFakeParticipant`, `createProductionGitOps`, `createCredentialOpsFake`,
`createProductionCredentialOps`) builds a fresh instance per call — for
`createProductionGitOps` this means a fresh `mkdtemp` repository pair per case, for
`createProductionCredentialOps` a fresh `Map` and fresh fake-process registry. Both
negative controls (`createNoForceUpdateGitOpsFake`, `createAliasingCredentialOpsFake`)
are declared un-exported, private to their one test, and their expected-failure
lists (`["force-updates a ref to the requested commit"]`,
`["returns a credential copy that cannot mutate stored state"]`) are literal arrays
written independently of the fake's own logic, not derived by re-running it — this
matches `device-flow-contract.ts` exactly and is a genuine strength; a missing
negative control was flagged as the headline risk for this pattern, and it is not
present here.

Concrete differences from the `device-flow-contract.ts` model:

1. **Six-category documentation discipline.** `device-flow-contract.ts` and
   `credential-ops-contract.ts` both name every inapplicable category explicitly by
   its guideline name (`"Input validation is inapplicable because..."`,
   `"Global ordering is inapplicable because..."`). `git-ops-contract.ts` documents
   three of six by name but folds "validation" into an unrelated catch-all comment
   without naming it — the one place this area's contract documentation is weaker
   than the model (see finding above).
2. **The negative-control test is not always isolated.** `device-flow-fake.test.ts`
   and `credential-ops-fake.test.ts` both give the negative control its own test,
   separate from the case-name-inventory check. `git-ops-fake.test.ts` merges the
   two into one test (see finding above).
3. **No typed inventory of contract *participants* exists for any of the three
   contracts, including the model.** `DEVICE_FLOW_CASE_NAMES` / `GIT_OPS_CASE_NAMES`
   / `CREDENTIAL_OPS_CASE_NAMES` are inventories of *case names*, checked at runtime
   against the case array — they say nothing about which *adapters* (fake, real)
   are required to run the contract. Nothing in this repo would fail type-checking
   or a structural gate if a future edit deleted
   `registerGitOpsContract(createProductionGitOps)` from `git.test.ts`: the fake's
   test would still pass, silently losing the real adapter's proof of the contract.
   This gap is shared with the model file, not unique to this area, so it is
   recorded here as a WARNING-level observation rather than a finding against any
   one file: a fix (e.g. a `satisfies`-checked `const CONTRACT_PARTICIPANTS = { fake: ..., real: ... } satisfies Record<"fake" | "real", ...>` that both test files must populate) would need to land in all three contracts, or in a shared harness, to be consistent.

## Production code findings

### `extensions/pi-claude-marketplace/platform/git.ts`

- **[WARNING] The `auth?` bundle type is repeated three times instead of reusing `BuildAuthCallbacksOpts`** — `lines 65, 74, 111` vs. `370–374`
  `CloneOptions.auth`, `FetchOptions.auth`, and `ResolveRemoteRefOptions.auth` each
  declare the identical inline object type
  `{ credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn }`.
  `BuildAuthCallbacksOpts` (lines 370–374) is already a named interface with the
  exact same three fields. Replace all three inline occurrences with
  `auth?: BuildAuthCallbacksOpts;`.
- **[WARNING] Two untyped, misnamed catch bindings** — `lines 458, 474`
  Both `onAuth` and `onAuthFailure` use `catch (err)` rather than the project's
  `catch (error: unknown)` convention (see `git-credential.ts`'s own comment
  discipline and the google-style-review rule). Rename `err` to `error` and add the
  explicit `: unknown` annotation in both catch blocks, updating the
  `errorMessage(err)` call sites to match.
- **[WARNING] Three option-bag interfaces carry no documentation at all** — `lines 90–93, 114–118, 120–122`
  `ResolveRefOptions`, `ForceUpdateRefOptions`, and `CurrentBranchOptions` have
  neither an interface-level doc comment nor field comments, unlike every other
  option-bag interface in the file (`CloneOptions`, `FetchOptions`,
  `CheckoutOptions`, `ResolveRemoteRefOptions`, `ListBranchesOptions`,
  `ListRemotesOptions`), each of which documents at least one field or the whole
  shape. Add a one-line `/** ... */` to each for consistency.

### `extensions/pi-claude-marketplace/platform/git-credential.ts`

- **[WARNING] `CredentialProcess.on()` cannot statically pair the event with its listener shape** — `lines 78–81`
  ```ts
  on(
    event: "error" | "close",
    listener: ((error: Error) => void) | ((code: number | null) => void),
  ): void;
  ```
  This union accepts either listener shape for either event name, so a future edit
  that swapped which listener went with which event string would still typecheck.
  Split into two overload signatures instead:
  `on(event: "error", listener: (error: Error) => void): void;` and
  `on(event: "close", listener: (code: number | null) => void): void;`. The
  production usage in `gitCredentialIO` (the two `child.on(...)` calls) already
  pairs them correctly, so this is a latent-defect risk, not a live bug.

### `extensions/pi-claude-marketplace/platform/pi-api.ts`

- **[WARNING] `hasLoadedPiSubagents`/`hasLoadedPiMcpAdapter`/`softDepStatus` take the full peer `ExtensionAPI` when they only use `getAllTools`** — `lines 129, 142, 158`
  All three functions only ever call `pi.getAllTools()`, yet their parameter type
  is the entire upstream `ExtensionAPI` (re-exported unnarrowed from
  `@earendil-works/pi-coding-agent` at the top of this file). This is what forces
  `pi-api.test.ts` into four `as unknown as PiBoundary.ExtensionAPI` double
  assertions (see the paired test finding above) to build a double, since no
  hand-built object can structurally satisfy the full peer interface. Apply fix #3
  from the testable-production-design list: declare a narrow, consumer-owned port
  in this file, e.g.
  `interface ToolProbe { getAllTools(): ReadonlyArray<{ name?: string; sourceInfo?: { source?: unknown } }>; }`,
  and change all three functions to accept `ToolProbe` instead of `ExtensionAPI`.
  Every real call site already passes a live `ExtensionAPI`, which satisfies
  `ToolProbe` structurally with no adapter needed.
- **[WARNING] Uncommented structural cast in `hasLoadedPiMcpAdapter`** — `line 145`
  `const candidate = tool as { name?: unknown; sourceInfo?: { source?: unknown } };`
  has no inline comment explaining why the cast is safe (the peer `Tool` type
  presumably doesn't declare `sourceInfo`, since the JSDoc above explains the
  matching logic but not the cast itself). A one-line comment stating that tool
  declarations carry runtime `sourceInfo` metadata the peer type omits would meet
  the google-style-review bar for `as` usage. Adopting the `ToolProbe` port above
  would let this become a direct, uncast structural read instead.

### Clean files

- (none beyond the notes above — `git.ts`, `git-credential.ts`, and `pi-api.ts` are
  otherwise well-designed for testability: every side-effecting dependency is an
  explicit parameter, no module-level mutable state, no hidden `Date.now()`/
  `randomUUID()`/`process.env` reads inside logic, and constructing an adapter
  never performs I/O.)

## Not covered

- The toolchain (`node --test`, `npm run test:coverage:direct`, `npm run check`)
  was not run, per this sweep's diagnostic-review constraint; branch/line coverage
  claims above (e.g. that all `clone`/`fetch`/`resolveRemoteRef` optional-field
  branches are exercised) are from manual tracing of every call site in
  `git.test.ts`, not from a coverage report.
- The evidence for the `git-ops-fake.ts` BLOCKER was confirmed by reading
  `tests/orchestrators/marketplace/add.test.ts`, which is outside this area's
  assignment; that file's own review is someone else's, and its workaround was
  used here only as proof that the defect is real and already load-bearing
  elsewhere, not as a target of this review.
