# Platform — git, git credentials, Pi API, shared adapter contracts — adversarial re-review

**Scope:** all 11 files under `tests/platform/` and all 3 modules under
`extensions/pi-claude-marketplace/platform/`, re-examined by mutation against the
first pass's claims. Evidence for the shared-fake blast radius was gathered by
grepping `tests/` outside this area (read-only).
**First-pass file:** `unit-test-findings/platform.md`
**Clean files attacked:** 9 (6 named on the test `### Clean files` list, plus the 3
production modules the first pass declared "otherwise well-designed for testability")
**Existing findings graded:** 12 (11 numbered findings + the shared-contract
"no typed participant inventory" observation)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 13 |
| Existing CONFIRMED | 10 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

**Headline:** the first pass's "near-model area" verdict is **half right and half
wrong**, and the half that is wrong matters for META-FINDINGS' reference table. The
*contract machinery* (fake + real adapter + negative control + case-name inventory)
is genuinely strong and survived every attack I aimed at it. The *option-forwarding
and process-plumbing* layer underneath it is not: four surviving mutations let
`clone`, `fetch`, `checkout`, and `credentialFill` drop or invert documented
behaviour with the whole platform suite green. Two of the four sit in
`git-credential.test.ts`, which the first pass listed as clean.

## New findings — from the clean lists

### `tests/platform/git-credential.test.ts` (first-pass clean list)

- **[BLOCKER] The exit-code gate in `credentialFill` has no discriminating case** —
  `lines 113–130`
  Both rows of the data-driven pair (`{ exitCode: 128 }` and `{ exitCode: null }`)
  close the process **without writing any stdout**, then assert only
  `assert.strictEqual(credential, null)`. Null is therefore over-determined: the
  parse yields no `username`/`password` no matter what the exit code did. Two
  independent mutations survive:
  (a) delete `if (result.code !== 0) { return null; }` from
  `git-credential.ts:241–243` — both rows stay green;
  (b) change `resolve({ stdout, code: code ?? -1 })` to `code ?? 0` at
  `git-credential.ts:141` — the "closes without an exit code" row, whose *title* is
  precisely about that normalization, stays green.
  Mutation (b) is the live risk: a helper killed by a signal (null code) that had
  already emitted `username=`/`password=` would be treated as a successful fill.
  **Fix (one edit covers both):** in the loop body at line 143, write a complete
  payload before closing —
  `process.writeOutput("username=x-access-token\npassword=token-1\n");` — so the
  exit code is the *only* thing that can make the result null. Add a third row
  `{ behavior: "returns the credential on a zero exit", exitCode: 0 }` asserting
  `deepStrictEqual(credential, { username: "x-access-token", password: "token-1" })`
  so the guard is pinned in both directions.

- **[BLOCKER] The EPIPE stdin-error guard is asserted by a fake that no-ops when the
  guard is absent** — `git-credential.test.ts:95`, `credential-process-fake.ts:97–101`
  `git-credential.ts:148` registers `child.stdin.on("error", () => {})` with a
  comment stating that without it "the 'error' event on child.stdin becomes an
  unhandled exception." The only case that touches it calls
  `process.failInput(new Error("closed input"))`. But `failInput` just iterates
  `stdinErrorListeners`; with the production line deleted the array is empty, the
  call is a silent no-op, and the case still passes. The guard is unproven.
  **Fix:** make the fake model the real failure mode (the "fail loudly on unplanned
  input" pattern META-FINDINGS credits to `tests/orchestrators/plugin/fetch.test.ts`).
  In `credential-process-fake.ts`, change `failInput` to
  `failInput: (error) => { if (stdinErrorListeners.length === 0) { throw error; } for (const listener of stdinErrorListeners) { listener(error); } }`
  — an unhandled `'error'` on a real stream crashes the process, so the fake should
  too. No test change is needed; the existing case then discriminates the guard.

- **[WARNING] The 5 000 ms default timeout has no case** — `git-credential.ts:299`
  Every case passes an explicit `timeoutMs`, so `options.timeoutMs ?? 5_000` can be
  changed to any other number with the suite green. **Fix:** add
  `test("terminates a fill after the default five-second timeout")` using
  `t.mock.timers.enable({ apis: ["setTimeout"] })`, `createCredentialOps({ spawn })`
  with no `timeoutMs`, `t.mock.timers.tick(4_999)` → assert the promise is still
  pending (`processes.process().terminations()` is `[]`), then `tick(1)` → assert
  `credential === null` and `terminations()` is `["SIGTERM"]`.

- **[WARNING] Partial-credential attribute emission is unproven** — `lines 209–245`
  `buildAttributeBlock` has two independent guards (`cred?.username !== undefined`,
  `cred?.password !== undefined`) but only two inputs are ever exercised: `{}` (both
  absent, line 238) and both-present (line 215). Swapping the second guard to read
  `cred?.username` survives. **Fix:** convert lines 232–245 into a data-driven set of
  three sibling rows — `{}`, `{ username: "x-access-token" }`,
  `{ password: "token-1" }` — each asserting the exact `process.input()` string.
  While there, change `swallows a process failure during ${subcommand}` (line 271) to
  assert the swallowed result explicitly (`assert.strictEqual(await completed, undefined)`)
  rather than only `terminations()`; the title is about the swallow, the assertion is
  about the timer.

- **[WARNING] `DEFAULT_CREDENTIAL_OPS` has no owning case** — `git-credential.ts:310`
  The export is imported by five orchestrators but never by its own paired test. Its
  only "coverage" is incidental: the module-scope initializer runs on import, which is
  what executes the `options.spawn ?? spawn` fallback branch. **Fix:** add
  `test("exposes a default credential surface bound to the real git launcher")`
  asserting the shape (`typeof DEFAULT_CREDENTIAL_OPS.fill === "function"` for all
  three primitives) — or, better, apply the production fix below and let the
  composition module own it.

### `tests/platform/git.test.ts` (not on the clean list, but these are new)

- **[BLOCKER] `clone`'s `ref` / `singleBranch` and `fetch`'s `ref` forwarding are
  never proven — by the test whose title claims exactly that** — `lines 786–802`,
  `lines 857–894`, and `git-ops-contract.ts:51–75, 78–115`
  `test("forwards an explicit ref and single-branch option without auth")` installs
  `installFailedDiscoveryTransport`, which answers the *first* `info/refs` GET with
  503. `git.clone` aborts during ref discovery, before `ref` or `singleBranch` can
  influence a single byte. The only assertions are the `HttpError` and
  `deepStrictEqual(requests, [expectedDiscoveryRequest()])` — neither depends on
  either option. Deleting both conditional spreads from `git.ts:156–157` leaves the
  case green.
  The contract does not cover the gap either: its clone case passes `ref: "main",
  singleBranch: true`, but `installRepositoryTransport` advertises a remote whose
  HEAD symref *is* `refs/heads/main` and which has exactly one branch, so the
  explicit-ref result and the default result are identical. Same for
  `fetch`'s `ref` (`git.ts:173`): the contract's fetch case writes
  `refs/remotes/origin/main` whether or not `ref` is forwarded.
  `git-ops-contract.ts:43` explicitly delegates this — *"option forwarding are
  production-owner mechanics"* — so the contract deliberately hands the proof to
  `git.test.ts`, and `git.test.ts` does not deliver it. This is a documented handoff
  that nobody catches.
  **Fix:** in `describe("clone")`, add a case backed by `installRepositoryTransport`
  against a two-branch fixture: commit a `dev` branch at a distinct oid, advertise
  `refs/heads/dev` alongside `refs/heads/main`, serve `repository.pack("refs/heads/dev")`,
  then `clone({ dir: cloneDir, url: REMOTE_URL, ref: "dev", singleBranch: true })` and
  assert (a) `resolveRef({ dir: cloneDir, ref: "HEAD" })` equals the dev oid — this
  discriminates `ref` — and (b)
  `assert.deepStrictEqual(await listBranches({ dir: cloneDir, remote: "origin" }), ["dev"])`
  — this discriminates `singleBranch`. Mirror it in `describe("fetch")`: fetch with
  `ref: "dev"` and assert `resolveRef refs/remotes/origin/dev` resolves while
  `refs/remotes/origin/main` rejects with `NotFoundError`. Retitle the existing
  line-786 case to what it actually proves ("surfaces the discovery failure without
  auth callbacks").

- **[BLOCKER] `checkout`'s `noCheckout` is unproven, and its fixture makes the
  behaviour unobservable in principle** — `lines 763–782`
  `test("moves HEAD without checking out the worktree when requested")` asserts only
  `currentBranch(...) === "feature"`. It never inspects the worktree — the one thing
  the title names. Deleting `...(opts.noCheckout !== undefined && { noCheckout: opts.noCheckout })`
  from `git.ts:186` leaves it green.
  Worse, adding a worktree assertion to the *current* fixture would not help:
  `repository.commit([{ filepath: "feature.txt" }], "feature")` commits on `main`, so
  after `forceUpdateRef refs/heads/feature = featureOid` both `main` and `feature`
  point at the same commit. Checking out with and without `noCheckout` produces a
  byte-identical worktree. The case cannot discriminate its own contract.
  **Fix:** rebuild the fixture so the branches diverge. After committing `feature.txt`
  on `main` (HEAD now at `featureOid`), `await forceUpdateRef({ dir, ref: "refs/heads/base", value: repository.initialOid })`,
  then `await checkout({ dir, ref: "base", noCheckout: true })`, then assert
  `currentBranch === "base"` **and** that `feature.txt` still exists in the worktree
  (`assert.strictEqual(await readFile(join(dir, "feature.txt"), "utf8"), "feature\n")`).
  Add the paired negative — the same checkout without `noCheckout` — asserting
  `feature.txt` is gone. Note the deletion option in the production finding below:
  `noCheckout` has zero production callers, so deleting the option and this case is
  the cheaper resolution.

- **[WARNING] The byte-exact request assertion hardcodes the isomorphic-git version**
  — `line 98`
  `expectedListRefsBody()` embeds `packet("agent=git/isomorphic-git@1.41.8\n")`.
  `package.json` declares `"isomorphic-git": "^1.41.8"`, so any in-range patch or
  minor bump breaks the eight cases that use `expectedPublicRequests()` for a reason
  that has nothing to do with this repo's behaviour. The bytes that *are* this
  module's contract (`peel`, `symrefs`, the delim/flush framing, `Git-Protocol:
  version=2`) should stay exact. **Fix:** import `version` from `isomorphic-git` (it
  is a declared export, `index.d.ts:3465`) and build that one packet as
  `packet(\`agent=git/isomorphic-git@${git.version()}\n\`)`. This is not "computing
  the expected value with production code" — it is a third-party constant, not this
  repo's formatter.

- **[WARNING] Exported types are not pinned, unlike the sibling `pi-api.test.ts`** —
  `line 1053` and `git-credential.test.ts:14–18`
  `pi-api.test.ts` pins every exported type of its module with 20 `satisfies` proofs
  and 8 `@ts-expect-error` negatives (lines 31–92). `git.test.ts` pins three
  (`GitCredentials` at line 1053 — at the *bottom* of the file, after all the
  describes; `AuthAttemptResult` inline at 428/460; `OnAuthRequiredFn` at 397) and
  none of the nine exported option-bag interfaces. `git-credential.test.ts` pins one
  (`CredentialOps`) and none of `CredentialProcess`, `CredentialSpawn`,
  `CredentialSpawnOptions`, `CreateCredentialOpsOptions`. **Fix:** propagate the
  `pi-api.test.ts` shape — move `git.test.ts:1053` to the top of the file next to the
  imports and add a `satisfies` literal per exported option bag plus at least one
  `@ts-expect-error` negative each (e.g. `// @ts-expect-error a clone requires a url`
  `void ({ dir: "/d" } satisfies CloneOptions);`). See the related
  `CredentialSpawn` gap under `git-credential.ts` below — that one is not merely
  cosmetic.

### `tests/platform/git-ops-fake.test.ts`

- **[WARNING] The fake's two boundary guards have no case, and the negative control
  sits outside the `describe`** — `lines 51–96, 98`
  `createGitOpsFake` throws on a non-`"memory"` boundary (`git-ops-fake.ts:77–79`) and
  on a non-`"local"` clone-fixture boundary (`lines 81–83`). Neither is exercised.
  Its sibling `credential-ops-fake.test.ts:61–67` has exactly this case
  (`test("requires the explicit memory boundary")`), and this file *does* test the
  comparable `requireRemote` guard at line 57 — so the omission is internally
  inconsistent as well as drifted. Separately, `test("the no-force-update fake fails
  only the force-update invariant")` is declared at top level (line 98) while the
  other two cases live inside `describe("createGitOpsFake")`; the sibling keeps all
  three inside its describe. **Fix:** copy the two boundary cases from
  `credential-ops-fake.test.ts:61` (using `Reflect.apply` the same way) and move the
  line-98 test inside the `describe`, splitting it as the first pass already
  instructs.

### `tests/platform/git-ops-contract.ts` + `tests/platform/credential-ops-contract.ts`

- **[WARNING] `observeVoid` is duplicated verbatim across the two sibling contracts**
  — `git-ops-contract.ts:45–47`, `credential-ops-contract.ts:56–58`
  Identical three-line helper, identical purpose (make a `Promise<void>`'s resolution
  value assertable). **Fix:** put one copy in a shared module beside the concern —
  `tests/platform/observe-void.ts` — and import it from both. `tests/domain/device-flow-contract.ts`
  does not carry a third copy, so this is a two-site fix.

- **[WARNING] Nothing gates that the *real adapter* still runs each contract** —
  `git.test.ts:1049–1051`, `git-credential.test.ts:82–83`
  This upgrades the first pass's observation into an executable fix. Deleting
  `describe("GitOps contract") { registerGitOpsContract(createProductionGitOps); }`
  from `git.test.ts` leaves the whole suite green while silently removing the real
  adapter's proof of all 12 cases — the same shape as the "gates that do not gate"
  cluster in META-FINDINGS. The `*_CASE_NAMES` inventories guard case *names*, not
  *participants*. **Fix, matching this repo's own "plant the violation, don't read
  the config" rule:** add a case to each fake's test that scans the test tree for the
  registration call and asserts both participants are present, reusing the existing
  walker at `tests/architecture/source-scan.ts` —
  `assert.deepStrictEqual(filesCalling("registerGitOpsContract("), ["tests/platform/git-ops-fake.test.ts", "tests/platform/git.test.ts"])`
  and the equivalent for `registerCredentialOpsContract` and
  `registerDeviceFlowContract`. Land it in all three contracts together.

### `tests/platform/credential-ops-fake.ts` + `tests/platform/git-credential.test.ts`

- **[WARNING] `sameCredential` and `credentialsMatch` are the same function under two
  names in the same directory** — `credential-ops-fake.ts:41–43`,
  `git-credential.test.ts:36–38`
  Both compare `username` and `password` for the reject-matching rule. **Fix:** export
  one (`sameCredential`) from `credential-ops-fake.ts` and import it in
  `git-credential.test.ts`, deleting the second copy.

### `tests/platform/pi-api.test.ts`

- **[WARNING] Peer-contract pins are titled as if `pi-api.ts` implemented them** —
  `lines 106–123, 138–194`
  `getAgentDir` and `parseFrontmatter` are bare re-exports; the binding-identity cases
  (95, 127) are the module's own contract, and the other five cases exercise
  `@earendil-works/pi-coding-agent`. That is legitimate and valuable — `pi-api.ts:18–37`
  documents those exact semantics as a contract the skills/commands gates depend on,
  so pinning them against peer drift is the right call — but the titles read as claims
  about this module. **Fix (titles only, low priority):** retitle to name the pin,
  e.g. `"pins the peer parser's closed-block CRLF normalization"`,
  `"pins the peer parser's empty-metadata fallback without an opening delimiter"`,
  `"pins the peer agent-directory override"`. Do not delete the cases.

### `extensions/pi-claude-marketplace/platform/git.ts` (declared clean)

- **[WARNING] `listBranches`, `listRemotes`, and `CheckoutOptions.noCheckout` have
  zero production callers, and the file's own header comment says otherwise** —
  `lines 20–22, 87, 186, 304–320`
  A repo-wide grep (excluding `node_modules`, `.git`, `.planning`) finds these three
  symbols referenced only by `platform/git.ts` itself, `tests/platform/git.test.ts`,
  `platform/README.md`, and one competitive-analysis doc. No orchestrator, bridge,
  edge handler, or architecture test uses them. Five cases in `git.test.ts`
  (lines 650, 668, 686, 703, 763) exist solely to cover unreachable production
  surface. Two doc comments assert the opposite:
  - `git.ts:20–22` — *"The `listRemotes` wrapper (W-4) is exposed here even though the
    marketplace orchestrators are the consumers"* — the marketplace orchestrators are
    **not** consumers, of `listRemotes` or of anything else in this group.
  - `platform/README.md:13` claims the wrapper exposes `pull`, which `git.ts` does not
    export and which `orchestrators/marketplace/shared.ts:6–9` explicitly rules out
    ("NO `pull`").
  `fallow dead-code` cannot catch this: `.fallowrc.json` sets `production: false`, so
  test files count as consumers (a deliberate setting — see FLOW-06 — not something to
  flip).
  **Fix, in order of preference:** delete `listBranches`, `listRemotes`,
  `ListBranchesOptions`, `ListRemotesOptions`, and `CheckoutOptions.noCheckout`, along
  with the five test cases and the two stale doc claims. If a consumer is genuinely
  planned, replace the false header sentence with a present-tense statement of why the
  wrapper is retained and add the missing `noCheckout` proof from the BLOCKER above.
  Either way, `platform/README.md:13` must lose `pull` and gain the current export
  list.

- **[WARNING] The JSDoc and the inline comment both describe a `deviceFlowAttempted`
  flag that does not exist** — `lines 376–382` and `lines 433–440`
  *"The factory owns a closure-scoped `deviceFlowAttempted` flag (set when
  `onAuthRequired` returns `{ ok: true }`)"* and *"`deviceFlowAttempted` is set to true
  after a successful onAuthRequired call"*. `buildAuthCallbacks` (lines 429–492)
  declares no such variable; a repo-wide grep finds the identifier only in these two
  comments. A reader auditing the CP-9 no-retry discipline is told state exists that
  does not, in the one seam that handles credentials. This is also a comment narrating
  code that no longer exists, which `.claude/rules/typescript-comments.md` forbids
  outright. **Fix:** delete the flag sentence from the JSDoc at 379–382 and the whole
  "CP-9 future-proofing note" block at 433–440, keeping the CP-9 rationale that is
  still true — restated as a present-tense fact: "onAuthFailure always returns
  `{ cancel: true }`; retrying Device Flow from this seam would re-enter the same code
  path, and isomorphic-git's next `onAuth` call reaches Device Flow naturally on a fill
  miss."

### `extensions/pi-claude-marketplace/platform/git-credential.ts` (declared clean)

- **[WARNING] A parameter defaults to a live boundary, behind an uncommented cast that
  hides a real type mismatch** — `line 298`
  `const spawnProcess = options.spawn ?? (spawn as CredentialSpawn);` is exactly the
  pattern the guidelines forbid ("No parameter defaults to a live boundary; real
  adapters wire up in one composition module"). The first pass's claim that
  "every side-effecting dependency is an explicit parameter" does not hold for this
  line. The cast is also load-bearing and unexplained: `node:child_process.spawn`
  returns a `ChildProcess` whose `stdin` is `Writable | null` and whose `stdout` is
  `Readable | null`, neither of which satisfies `CredentialProcess`'s non-nullable
  `stdin`/`stdout`. What makes it safe is the `stdio: ["pipe", "pipe", "pipe"]`
  literal at line 121 — a fact stated nowhere near the cast. Nothing in the test suite
  can pin the shape either, because the cast is what suppresses the check
  (`void (spawn satisfies CredentialSpawn)` would not compile today).
  **Fix:** make `spawn` a required parameter of `createCredentialOps` and move the
  real-launcher wiring into the `DEFAULT_CREDENTIAL_OPS` line, which is the
  composition site: `export const DEFAULT_CREDENTIAL_OPS: CredentialOps = createCredentialOps({ spawn: spawn as CredentialSpawn });`
  with a comment on that one line stating the invariant — "`stdio: ['pipe','pipe','pipe']`
  guarantees non-null `stdin`/`stdout`, which `ChildProcess`'s declared
  `Writable | null` cannot express." Every existing test already passes `spawn`
  explicitly, so no test changes are required.

## Export ownership census

`platform/git.ts` (paired with `tests/platform/git.test.ts`):

| Export | Owning case | Status |
| --- | --- | --- |
| `clone` | `git.test.ts:786, 804`; contract case 1 | owned — but `ref`/`singleBranch` forwarding unproven (BLOCKER above) |
| `fetch` | `git.test.ts:841, 857`; contract case 2 | owned — `ref` forwarding unproven |
| `checkout` | `git.test.ts:747, 763`; contract case 4 | owned — `noCheckout` unproven |
| `resolveRef` | `git.test.ts:639`; contract cases 5, 6 | owned |
| `resolveRemoteRef` | `git.test.ts:898–1046`; contract cases 9–12 | owned, thoroughly |
| `forceUpdateRef` | `git.test.ts:725`; contract case 3 | owned |
| `currentBranch` | `git.test.ts:628`; contract cases 7, 8 | owned |
| `listBranches` | `git.test.ts:650, 668` | owned by tests only — **NO PRODUCTION CALLER** |
| `listRemotes` | `git.test.ts:686, 703` | owned by tests only — **NO PRODUCTION CALLER** |
| `buildAuthCallbacks` | `git.test.ts:390–625` (9 cases) | owned, strongest unit in the area |
| `GitCredentials` | `git.test.ts:1053` (`satisfies`) | owned |
| `AuthAttemptResult` | `git.test.ts:428, 460` (`satisfies`) | owned |
| `OnAuthRequiredFn` | `git.test.ts:397, 422, …` | owned |
| `BuildAuthCallbacksOpts` | — | NO CASE (no `satisfies` pin; also the first pass's dedup target) |
| `CloneOptions` / `FetchOptions` / `CheckoutOptions` / `ResolveRefOptions` / `ResolveRemoteRefOptions` / `ForceUpdateRefOptions` / `CurrentBranchOptions` | exercised structurally by the runtime cases | NO TYPE PIN |
| `ListBranchesOptions` / `ListRemotesOptions` | — | NO TYPE PIN, and attached to dead exports |

`platform/git-credential.ts` (paired with `tests/platform/git-credential.test.ts`):

| Export | Owning case | Status |
| --- | --- | --- |
| `createCredentialOps` | `git-credential.test.ts:85–290` + contract (31 cases) | owned |
| `CredentialOps` | `git-credential.test.ts:14–18` (`satisfies`) | owned |
| `DEFAULT_CREDENTIAL_OPS` | — | **NO CASE** — incidental only (its module-scope initializer is what executes the `?? spawn` branch) |
| `CredentialProcess` | satisfied only by `credential-process-fake.ts:113` | NO PIN against the real `ChildProcess` |
| `CredentialSpawn` | satisfied only by the fake; the real `spawn` reaches it through a cast | **NO PIN** — see the production WARNING |
| `CredentialSpawnOptions` | asserted structurally at `git-credential.test.ts:106–108` | owned incidentally |
| `CreateCredentialOpsOptions` | exercised, not pinned | NO TYPE PIN |

`platform/pi-api.ts` (paired with `tests/platform/pi-api.test.ts`): **every export owned.**
20 `Same<>`/`satisfies` proofs and 8 `@ts-expect-error` negatives at lines 31–92 cover
all 20 exported types; `getAgentDir`/`parseFrontmatter` have binding-identity cases at
95/127; `hasLoadedPiSubagents` (6 cases), `hasLoadedPiMcpAdapter` (9), `softDepStatus`
(5) are each owned by a dedicated `describe`. This is the strongest export census in
the area and the model the other two test modules should copy.

## Branch census

**Reachable and untested (findings above):** `git.ts` `clone.ref` /
`clone.singleBranch` / `fetch.ref` / `checkout.noCheckout` conditional spreads
(executed, never *discriminated*); `git.ts:250–253` ref-precedence disjunction
(`refs/heads/<ref>` before `refs/tags/<ref>` before bare `<ref>`) — no fixture
advertises a name that is both a branch and a tag, so reordering the three arms is
unobservable; `git-credential.ts:241` exit-code gate; `git-credential.ts:141`
`code ?? -1`; `git-credential.ts:299` `?? 5_000`; `git-credential.ts:298`
`?? spawn` (executes at import via `DEFAULT_CREDENTIAL_OPS`, asserted by nothing);
`git-credential.ts:179/183` username/password guards (never flipped independently);
`git-credential.ts:133` `timer.unref()` (CP-4 discipline, no case — testable only by
spying on the returned handle; lowest priority in this list).

**Reachable but behaviourally indistinguishable through the public surface (not a
finding, a production simplification):** `git-credential.ts:200` `if (eq <= 0)`. The
`=missing-key` fixture line at `git-credential.test.ts:93` is there to exercise it,
but relaxing the guard to `eq < 0` only adds an `out[""]` entry that `credentialFill`'s
`const { username, password } = parsed` never reads. Nothing observable distinguishes
the two arms. Either drop the fixture token or accept it as documentation.

**Compiler-forced, not removable (D-116-01a category):** `git.ts:301`
`return branch ?? undefined;` — isomorphic-git declares `currentBranch(): Promise<string | void>`,
and `void` is not assignable to `undefined` under this repo's strict settings, so the
funnel exists to satisfy the compiler, not to handle a distinct runtime value. It is
still covered end-to-end by the contract's detached-HEAD case.

**Unreachable-by-real-input defensive branches, correctly reached anyway:**
`pi-api.ts:131` and `pi-api.ts:144` `try/catch` around a throwing `tool.name` getter.
`pi-api.test.ts:249` and `:331` reach them with
`Object.defineProperty({}, "name", { get: () => { throw … } })` — a throwing accessor on
a **local fixture object**. That is the right technique, and it is materially different
from the four files META-FINDINGS §"Decisions" item 1 flags for patching *global*
prototypes. See "Meta-findings impact".

## Grading of first-pass findings

### `tests/platform/git-ops-fake.ts`

- **UNDERSTATED** — *"`clone`/`fetch`/`resolveRemoteRef` crash on the `auth` bundle
  their own type declares"*. The defect and the BLOCKER severity are right; the blast
  radius is off by an order of magnitude. The first pass cited one consumer
  workaround (`tests/orchestrators/marketplace/add.test.ts:138–150`). A tree-wide grep
  for `const { auth` finds **22 hand-rolled workarounds across 12 test files**:
  `orchestrators/plugin/clone-cache.test.ts` (×3 — clone, fetch, resolveRemoteRef),
  `orchestrators/plugin/fetch.test.ts` (×3), `orchestrators/plugin/info.test.ts` (×3),
  `orchestrators/plugin/{install,update,reinstall}.test.ts` (×2 each),
  `orchestrators/reconcile/apply.test.ts` (×2), `orchestrators/marketplace/{add,update}.test.ts`,
  `orchestrators/plugin/bootstrap.test.ts`, `edge/handlers/plugin/bootstrap.test.ts`,
  `architecture/config-state-consistency.test.ts`. `tests/orchestrators/plugin/bootstrap.test.ts:67–69`
  even carries a comment *documenting* the fake's defect instead of fixing it: "The
  fake records its arguments through `structuredClone`, and `auth` carries credential
  callbacks, which are not structured-cloneable."
  Two distinct shapes exist, and the second is worse than a workaround: 8 of the 12
  files use the `const { auth: _auth, ... }` **discard** form, which drops the bundle
  from the call log entirely — in those files `GitOpsFakeCalls.clone[].auth` is
  declared but can never be non-`undefined`, so any future "no auth was threaded"
  assertion there would pass vacuously. Verified empirically:
  `structuredClone({ dir, url, auth })` throws `DataCloneError: async () => null could
  not be cloned.` The first pass's one-line fix in `git-ops-fake.ts` is correct and
  deletes roughly ten wrapper functions across those files; sequence it high, because
  it is a single-file change with 12-file leverage.

### `tests/platform/git-ops-contract.ts`

- **CONFIRMED** — *"The 'validation' category is neither covered nor recorded as
  inapplicable"*. Lines 40–43 name mutable aliasing, global ordering, and deletion by
  their guideline names and omit validation, while `device-flow-contract.ts:60–62` and
  `credential-ops-contract.ts:48–49` account for every category. **Addendum the first
  pass missed:** the same comment block *does* delegate "option forwarding" to the
  production owner (line 43), and that delegation is unfulfilled — see the `git.test.ts`
  BLOCKER. Fixing only the missing word would leave the more serious half untouched.

### `tests/platform/git-ops-fake.test.ts`

- **CONFIRMED** — *"The negative control and the case-name inventory check share one
  test"* (lines 98–125). The sibling shape at `credential-ops-fake.test.ts:50` and
  `:69` is exactly as described. Add the two boundary-guard cases and the `describe`
  relocation from my new WARNING while doing this split.

### `tests/platform/git.test.ts`

- **CONFIRMED** — *"`describe("local Git operations")` groups six unrelated exports
  under one non-entrypoint name"* (line 627). `describe("clone")`, `describe("fetch")`,
  and `describe("resolveRemoteRef")` in the same file are the in-file counter-examples.
  **Addendum:** four of the eight cases inside that block (650, 668, 686, 703) cover
  `listBranches`/`listRemotes`, which have no production caller — resolve the dead-code
  question first, or the split will manufacture two describes for functions that should
  not exist.

### `tests/platform/pi-api.test.ts`

- **CONFIRMED** — *"Four double assertions build an incomplete double"* (lines 28, 238,
  320, 387). Real, and correctly paired to the production narrowing fix. This is the
  same defect class as META-FINDINGS leverage item 1.

### `extensions/pi-claude-marketplace/platform/git.ts`

- **CONFIRMED** — *"The `auth?` bundle type is repeated three times instead of reusing
  `BuildAuthCallbacksOpts`"* (lines 65, 74, 111 vs 370–374). Field-for-field identical;
  the substitution is safe. It also gives `BuildAuthCallbacksOpts` the type-pin the
  export census shows it lacks.
- **OVERSTATED** — *"Two untyped, misnamed catch bindings ... rather than the project's
  `catch (error: unknown)` convention"* (lines 458, 474). Both halves of the
  justification are wrong. (a) *Untyped:* `tsconfig.json:17` sets `"strict": true`,
  which enables `useUnknownInCatchVariables`, so `err` is **already** `unknown`; the
  annotation adds nothing. (b) *The project's convention:* `grep -rn "catch (error: unknown)" extensions`
  returns **0** hits and `grep -rn "catch (err)" extensions` returns **191**. `catch (err)`
  *is* the house style, with no counter-example anywhere in the extension.
  `.planning/codebase/CONVENTIONS.md` says nothing about catch bindings. The
  google-style skill does state the `catch (error: unknown)` rule, so this is not
  fully refuted — but the skill's own preamble says "Do not demand cleanups of
  unchanged code," and these files are unchanged. Correct handling: **one repo-wide
  style decision, not a per-file WARNING.** See "Meta-findings impact" — four other
  area files carry the same finding.
- **CONFIRMED** — *"Three option-bag interfaces carry no documentation at all"*
  (`ResolveRefOptions`, `ForceUpdateRefOptions`, `CurrentBranchOptions`). Factually
  right. Note that `ListBranchesOptions`/`ListRemotesOptions`, which *are* documented,
  belong to dead exports — so if the dead-code finding is resolved by deletion, this
  finding shrinks to two interfaces.

### `extensions/pi-claude-marketplace/platform/git-credential.ts`

- **CONFIRMED** — *"`CredentialProcess.on()` cannot statically pair the event with its
  listener shape"* (lines 78–81). **Added evidence the first pass did not have:** the
  cost is already visible in test support — `credential-process-fake.ts:135–141` has to
  write `listener as (error: Error) => void` and `listener as (code: number | null) => void`
  precisely because the union erases the pairing. Splitting into two overloads deletes
  both casts. Severity WARNING is right; it is latent, not live.

### `extensions/pi-claude-marketplace/platform/pi-api.ts`

- **CONFIRMED** — *"`hasLoadedPiSubagents`/`hasLoadedPiMcpAdapter`/`softDepStatus` take
  the full peer `ExtensionAPI` when they only use `getAllTools`"* (lines 129, 142, 158).
  The proposed `ToolProbe` port is the right fix and dissolves the four casts in the
  paired test. This is a clean, small instance of META-FINDINGS leverage item 1 and
  makes a good first proof of that ticket.
- **CONFIRMED** — *"Uncommented structural cast in `hasLoadedPiMcpAdapter`"* (line 145).
  Correct, and subsumed by the `ToolProbe` fix.

### Shared-contract pattern assessment

- **CONFIRMED, and upgraded to an actionable finding** — *"No typed inventory of
  contract *participants* exists for any of the three contracts, including the model."*
  I verified the consequence directly: deleting `describe("GitOps contract") { registerGitOpsContract(createProductionGitOps); }`
  from `git.test.ts:1049–1051` removes the real adapter's proof of all 12 cases and
  breaks nothing. The first pass recorded it as an observation; it belongs with
  META-FINDINGS' "gates that do not gate" cluster and has a concrete fix (see my
  WARNING above), so it should be a finding against all three contracts.

## Still clean after attack

These survived named mutations. Do not spend fixing-pass time here.

- **`tests/platform/credential-ops-contract.ts`** — 31 cases, and all six guideline
  categories are accounted for (missing values, aliasing, overwrite, deletion, and 21
  validation cases covered by cases; global ordering declared inapplicable at line 48).
  Mutations it catches: returning the stored object instead of a clone
  (`structuredClone` removed from `credential-ops-fake.ts:69`) fails "returns a
  credential copy that cannot mutate stored state"; removing the clone at ingress
  (line 79) fails "copies an approved credential before storing it"; relaxing the
  reject match to host-only (`sameCredential` → `true`) fails "keeps a credential when
  rejection attributes do not match"; swapping the `username`/`password` field labels
  in `sanitizeAttrValue`'s call sites fails 12 of the validation cases, which assert
  the exact message including the field name.
- **`tests/platform/credential-ops-fake.test.ts`** — the negative control
  (`createAliasingCredentialOpsFake`, lines 13–43) has an independently written
  one-element expected-failure list, and I confirmed it is the *only* case that fails:
  weakening the fake in any other single way (e.g. dropping the ingress clone) changes
  which names appear, and `assert.deepStrictEqual(failures, expectedFailures)` catches
  it. This is a real negative control, not a formality.
- **`tests/platform/git-test-repository.ts`** — deterministic commits (fixed author,
  monotonic `1_700_000_000 + commitIndex` timestamps, `timezoneOffset: 0`), one
  `mkdtemp` per call, `t.after(() => rm(dir, { recursive: true, force: true }))`
  registered before any write, no shared directory, no repo/home writes. The
  `assert.strictEqual(localUpdatedOid, updatedOid)` at `git.test.ts:289` proves the
  determinism is load-bearing: two independently built repositories produce the same
  oid.
- **`tests/platform/credential-process-fake.ts`** — `assertSpawnBoundary` (lines 33–62)
  is a fail-loudly boundary in the style META-FINDINGS credits to
  `orchestrators/plugin/fetch.test.ts`: it rejects a non-`git` command, a wrong
  argument vector, a missing `GIT_TERMINAL_PROMPT=0` / `GCM_INTERACTIVE=never`, and any
  non-pipe stdio. Deleting `GIT_TERMINAL_PROMPT: "0"` from `git-credential.ts:118`
  fails all 31 contract cases plus 11 direct ones. The one weakness is `failInput`,
  filed as a BLOCKER above.
- **`platform/git.ts::resolveRemoteRef`** — the best-tested function in the area.
  `expectedListRefsBody()` compares the ls-refs POST body **byte for byte**, so
  dropping `symrefs: true` or `peelTags: true` from `git.ts:232–233` fails; dropping
  `protocolVersion: 2` fails the `Git-Protocol: version=2` header assertion; changing
  `match.peeled ?? match.oid` to `match.oid` fails "prefers an annotated tag's peeled
  commit" (OID_PEELED ≠ OID_TAG); deleting either `throw new Error(...)` fails a case
  asserting the exact message including the URL.
- **`platform/git.ts::forceUpdateRef`** — the contract case calls it **twice** on an
  already-existing `refs/heads/main`, so deleting `force: true` from `git.ts:279`
  makes isomorphic-git throw `AlreadyExistsError` against the real adapter. The
  `createNoForceUpdateGitOpsFake` negative control proves the case is the one that
  discriminates it. This is the area's cleanest single proof.
- **`platform/git.ts::listRemotes` `gitdir` forwarding** — `git.test.ts:703–723`
  passes `dir: "/poisoned-working-tree"` with a real `gitdir`, so dropping the
  `gitdir` spread makes the call fail on a nonexistent directory. A genuinely clever
  discriminating fixture; it is the technique the `ref`/`noCheckout` cases need.
- **`platform/git.ts::buildAuthCallbacks`** — nine cases covering fill-hit, fill-miss →
  interactive success, three interactive-failure reasons, fill throw, interactive
  throw, reject, and reject throw. Every case compares the **whole** `credentials.calls`
  object with `deepStrictEqual` (so a spurious `approve` call is caught — a real
  silence proof) and the **whole** debug log array against a hand-written string, so
  dropping or rewording any `hookDebugLog` line fails. The `onAuthRequired` stubs
  throw on any unexpected invocation rather than returning a benign value.
- **`platform/git-credential.ts` wire format** — the three exact-`process.input()`
  assertions (lines 109, 227, 244, 265) pin `protocol=https`, host, field order, the
  trailing `\n\n`, and the "NEVER emit a `path=` line" invariant byte for byte. The
  `\r` stripping at `git-credential.ts:205` is discriminated by the `\r\n` fixture at
  line 93. Call-order (`write` then `end`) is also proven: swapping them makes
  `createProductionCredentialOps`'s `onInput` see an empty attribute block and throw,
  failing the contract's stored-credential cases.
- **`platform/git-credential.ts` construction hygiene** — `createCredentialOps` opens
  no connection, reads no file, and starts no timer; only its operations do. The
  module-scope `DEFAULT_CREDENTIAL_OPS` initializer is therefore side-effect-free at
  import, which is why importing this module in a test is safe.
- **`tests/platform/pi-api.test.ts`** — mutations it catches: swapping the two fields
  of `SoftDepStatus` (caught by "reports only subagents as loaded", a whole-object
  `deepStrictEqual`); `src.includes(...)` → `src.startsWith(...)` (caught by
  "recognizes the adapter within a source path"); dropping the `typeof src === "string"`
  guard (caught by "rejects a non-string adapter source"); loosening the substring to
  `"pi-mcp"` (caught by "rejects a partial adapter source name"); removing either
  `try/catch` (caught by the two throwing-`getAllTools` cases). Its `process.env`
  handling registers `t.after()` restoration **before** mutating (lines 109–116), the
  correct order.

## Not covered

- No command was run: no `node --test`, no `npm run test:coverage:direct`, no
  `npm run check`, per this pass's constraint. Every mutation verdict above is from
  tracing call sites and fixtures by hand. The one thing I did execute is a throwaway
  `node -e` snippet outside the repo tree, confirming
  `structuredClone({ dir, url, auth })` throws `DataCloneError` on a function-bearing
  bundle.
- I did not verify the exact isomorphic-git behaviour of a `singleBranch: false` clone
  against a two-branch protocol-v2 advertisement served by the local transport fake.
  The fix instruction for the clone BLOCKER assumes remote-tracking refs are created
  for every advertised branch; if that proves awkward to serve, the `ref` half of the
  fix (distinct oids per branch) stands on its own and is the more important half.
- The 12 downstream files carrying the `auth`-strip workaround were read only far
  enough to count and classify the two workaround shapes. Whether any of them contains
  a *vacuous* auth assertion made possible by the discard form is a question for those
  areas' own reviews; I confirmed only that `orchestrators/marketplace/update.test.ts`
  (which uses the reattach form) does not.
- `tests/integration/`, `tests/e2e/`, and `tests/live-uat/` remain out of scope, though
  `tests/integration/{auth-e2e,marketplace-add-seed-mirrors}.test.ts` also consume
  these two fakes and will be affected by the `git-ops-fake.ts` fix.

## Meta-findings impact

### New cross-cutting evidence

**1. The `catch (error: unknown)` finding class is a false-convention artifact, and it
is in at least five area files.** `grep -rn "catch (error: unknown)" extensions` returns
**0**; `grep -rn "catch (err)" extensions` returns **191**. `.planning/codebase/CONVENTIONS.md`
contains no catch-binding rule at all. Under `tsconfig.json`'s `"strict": true`,
`useUnknownInCatchVariables` already types the binding `unknown`, so "untyped" is also
wrong. Five area files log this finding — `platform.md`,
`bridges-hooks-adapters-state.md`, `orchestrators-reconcile-notify.md`,
`edge-handlers-root.md`, `orchestrators-plugin-update.md` — and
`bridges-hooks-adapters-state.md:159` states outright that "CONVENTIONS.md documents
`catch (error: unknown)` as house style," which is false. The rule *is* in the
google-style skill, so this is a legitimate open style question — but it is **one
repo-wide decision affecting 191 sites**, not a per-file WARNING, and every area file
carrying it should be re-graded OVERSTATED. **Areas to check: all five named above,
plus any other file whose production findings mention catch bindings.**

**2. `structuredClone` in a shared test fake is a defect class, not one bug.** The
`git-ops-fake.ts` crash has produced **22 hand-rolled workarounds across 12 test
files**, 14 of which silently discard the value they were meant to record.
`tests/platform/credential-ops-fake.ts` uses `structuredClone` on the same ingress/egress
principle and is safe only because `GitCredentials` is plain data.
`tests/domain/device-flow-contract.ts` — the reference implementation — has cases named
"copies the device-code response before use" / "copies polling responses before use",
i.e. the same technique. **The rule to propagate: `structuredClone` at a fake's
boundary is correct for plain data and wrong for any field typed to carry a
collaborator; destructure collaborator fields out and reattach them by reference.**
Any other fake whose recorded options can carry a port, callback, or `AbortSignal` has
this bug latent. **Areas to check: every `tests/**/*-fake.ts` and every hand-rolled
`makeMock*` factory that logs `structuredClone(options)`.**

**3. Dead production exports are invisible to the dead-code gate whenever a test is
their only consumer.** `platform/git.ts` exports `listBranches`, `listRemotes`, and
`CheckoutOptions.noCheckout` with **zero** production callers; five cases in
`git.test.ts` exist only to cover them. `.fallowrc.json` sets `production: false`
(deliberate, per FLOW-06 — do not flip it), so test files count as consumers and
`fallow dead-code` cannot see this. That means **"exported, tested, and unreachable
from `index.ts`" is a blind spot of the whole gate suite**, and the sweep's per-area
reviewers are the only thing that can find it. **Recommend: a one-off
`fallow dead-code --production` probe (a probe, not a config change) to enumerate this
class repo-wide, cross-checked by hand.** This belongs in the "gates that do not gate"
section as a sixth instance.

**4. The correct technique for reaching a defensive branch already exists in-repo, and
it is in this area.** META-FINDINGS §"Decisions" item 1 escalates four test files that
patch **global** prototypes (`String.prototype`, `RegExp.prototype`,
`Symbol.hasInstance`, `Object.prototype`) to reach unreachable branches, and calls the
tool wrong either way. `tests/platform/pi-api.test.ts:249` and `:331` reach the same
kind of branch with `Object.defineProperty({}, "name", { get: () => { throw … } })` — a
throwing accessor on a **local fixture object**, which is hermetic, needs no cleanup,
and cannot leak across cases. **Add this to the "Patterns to propagate" table as
"Reaching a defensive catch without global surgery →
`tests/platform/pi-api.test.ts:247`", and offer it as the mechanical resolution for the
four escalated files** — it converts the operator decision from "delete the branch or
keep the prototype patch" into "keep the branch, move the throw onto a local object."

**5. A contract that names a category as "production-owner mechanics" needs someone to
check the owner delivered.** `git-ops-contract.ts:43` delegates option forwarding to
`git.test.ts`, and `git.test.ts` does not prove it — the gap is invisible because both
files look complete on their own. `device-flow-contract.ts:60–62` makes the same kind
of delegation ("The production owner covers remote-payload validation, HTTP mechanics,
cancellation, and thrown poll transport failures per D-09"). **Areas to check:
`domain-core.md` should verify `tests/domain/github-auth.test.ts` actually covers those
four; `orchestrators/marketplace/shared.test.ts` should be checked against any
delegation in its own contract comments.**

### Corrections to META-FINDINGS.md

- **The reference-implementation table needs one qualification, not a retraction.**
  META-FINDINGS lists `tests/platform/{git-ops,credential-ops}-contract.ts` as files
  that "also do this well." That holds for `credential-ops-contract.ts`, which I
  attacked and could not break. `git-ops-contract.ts` should carry a caveat: its
  contract machinery is sound, but its category documentation is incomplete (validation
  unnamed) *and* the delegation it does make (option forwarding) is unfulfilled by the
  production owner. **Suggested edit:** change the row to
  "`tests/domain/device-flow-contract.ts` and `tests/platform/credential-ops-contract.ts`
  — model implementations. `tests/platform/git-ops-contract.ts` — same machinery, but
  see `adversarial/platform.md` before copying its category comment."
- **"Ranked by leverage" should gain the shared-fake `structuredClone` fix.** At 22
  workarounds across 12 files resolved by one edit to one file, it outranks several
  items already listed and is lower-risk than any of them. It is currently buried in
  "Real defects found outside the test layer," which understates it as
  "already biting … a strip-and-reattach workaround" in the singular.
- **The `platform.md` tally in "Master tally" (1 BLOCKER, 9 WARNING) is superseded.**
  This pass adds 4 BLOCKER and 13 WARNING and downgrades 1 WARNING to a repo-wide style
  decision. The refreshed audit should read platform as roughly 5 BLOCKER / 21 WARNING,
  with one of the originals re-scoped.

### Confirmations

- **"Confidence: findings are reliable; clean verdicts are not."** Independently
  confirmed, and this area is a clean demonstration: the file that produced two of my
  four new BLOCKERs (`tests/platform/git-credential.test.ts`) was on the first pass's
  `### Clean files` list, and both production modules that produced doc-comment and
  live-boundary findings were described as "otherwise well-designed for testability."
  Every one of the first pass's *recorded* findings, by contrast, checked out — ten
  confirmed, one understated, one overstated, zero refuted.
- **"Doc comments cut both ways; neither can be trusted without checking the call
  graph."** Confirmed twice more, in the same direction as the `routing-state.ts`
  example: `platform/git.ts:20–22` claims marketplace orchestrators consume
  `listRemotes` (they consume nothing from that group), and `platform/git.ts:379/433`
  describes a `deviceFlowAttempted` flag that does not exist in the function it
  documents. Both were found only by grepping the call graph.
- **"Sibling drift is the dominant shape."** Confirmed within a single 11-file
  directory: `credential-ops-fake.test.ts` tests its fake's boundary guard and
  `git-ops-fake.test.ts` does not; `pi-api.test.ts` pins 20 exported types and
  `git.test.ts` pins three; `credential-ops-fake.test.ts` keeps all three cases inside
  its `describe` and `git-ops-fake.test.ts` leaves one outside; `observeVoid` and the
  credential-comparison helper are each duplicated between siblings. Every fix has a
  named in-directory target.
- **"The `*-contract.ts` negative-control pattern is genuinely strong."** Confirmed by
  attack, not by inspection: I tried to find a second contract case that the
  no-force-update fake and the aliasing fake also fail, and there is none — both
  expected-failure lists are exactly right, and both are literal arrays written
  independently of the fakes they grade.
