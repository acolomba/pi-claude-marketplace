# Phase 3: System Git Transport and Clone Shape - Pattern Map

**Mapped:** 2026-11-23
**Files analyzed:** 24 (new or modified)
**Analogs found:** 23 / 24

All paths below are relative to `extensions/pi-claude-marketplace/` unless they start with `test/`, `features/`, or a repo-root file. Line numbers were read on 2026-11-23 and will drift once edits land.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `platform/git-process.ts` (+ `GitRequest.config`, + `for-each-ref` row) | utility (process chokepoint) | request-response | itself: `SUBCOMMAND_RULES` :321-332, `gitArguments` :749-756 | exact (self-extension) |
| `platform/git-failure-kind.ts` (+ `https-auth` detail, + v0 unadvertised row) | utility (classifier) | transform | itself: `ROWS` :77-116 (`git-missing` rows already carry `detail`) | exact |
| `shared/errors.ts` (`GitFailure` union reshape; delete `CrossOriginChallengeError`, `TooManyRedirectsError`) | model (errors) | n/a | `GitFailure` :1308-1336, `StaleSourceCloneError` | exact |
| `shared/git-failure-classifiers.ts` (drop isomorphic rungs, map `https-auth` detail) | utility | transform | itself, `GitCommandError` arm | exact |
| `platform/git.ts` (every GitOps verb on system git, insteadOf, timeout, abort signal, Device Flow retry) | service (platform wrapper) | request-response (network + local lanes) | `platform/git-credential.ts` :89-110 (`NODE_GIT_PROCESS.run`) | role-match |
| `platform/git-timeout.ts` (new, optional) + `test/platform/git-timeout.test.ts` | utility (env reader) | transform | `shared/github-base-url.ts::readGitHubBase` :36-71 (reads env on every call) | role-match |
| `platform/git-credential.ts` (receive `GitAuthBundle`, `AuthAttemptResult`, `OnAuthRequiredFn` types) | service | request-response | itself (`approve` :75, runner :89-110) | exact |
| `platform/git-auth-callbacks.ts` + test | — | — | DELETE | n/a |
| `shared/github-base-url.ts` (+ insteadOf pair builder) | utility | transform | `gitHubWireUrl` :84-91 | exact |
| `domain/source.ts` or new `domain/git-ref.ts` (SHA / leading `-` refusal) | domain validation | transform | `domain/name.ts::assertSafeName` :35-66 | role-match |
| `persistence/locations.ts` (+ `sourceBackupDir`, `pluginCloneBackupDir`) | config (path bundle) | file-I/O | `sourceCloneDir` / `sourcesStagingDir` :360-385 | exact |
| `orchestrators/marketplace/shared.ts` (`GitOps` reshape; `refreshCloneBySwap` replaces `refreshGitHubClone` :274 / `refreshUrlClone` :367; `lacksStoredCredential` :418) | service | file-I/O + network | `orchestrators/marketplace/add.ts` `gitStagingSteps` :874-899, `setAsideReplacedClone`/`restoreReplacedClone` :940-975 | exact (same staging+rename shape) |
| `orchestrators/marketplace/update.ts` (call the swap; MU-5 after rename; KEEP outcome) | controller (orchestrator) | request-response | itself `snapshotAfterRefresh` :467-570 | exact |
| `orchestrators/plugin/update-flow.ts` / `update-preflight.ts` (PUP-2 sync to swap) | orchestrator | request-response | `update-flow.ts` `makeSyncCloneOnce` :231-280 | exact |
| `orchestrators/plugin/clone-cache.ts` (pin ladder, mirror swap, D-SG-11 key drop, instanceof matchers, tag-copy fetch) | service | file-I/O + network | itself: `promoteStagingToClone` :95-115, `cloneIntoStaging` :121-133, `checkoutGitDirCopy` :282-292 | exact |
| `orchestrators/plugin/marketplace-tag-probe.ts` (remote `ls-remote --tags` / local `for-each-ref`) | service | request-response | `orchestrators/plugin/dependency-tag-probe.ts` `listCandidateTags` :119-150, `probeDependencyTags` :153+ | exact |
| `orchestrators/plugin/install-cascade.ts`, `update-constraint-gate.ts`, `install-outcome.ts` (pass marketplace source + auth) | orchestrator | request-response | `install-cascade.ts::resolveMemberTagSource` :820-847 | exact |
| `eslint.config.js` (`NETWORK_SEAM_NAMES` :106-107, `NETWORK_SEAMS` comments :64-101) | config | n/a | itself | exact |
| `rule-packs/architecture.json` (`isomorphic-git-chokepoint` drop `exclude` :102-109) | config | n/a | sibling rule `no-network-modules` (no exemption) | exact |
| `test/platform/git-ops-fake.ts` + `test/platform/git-ops-contract.ts` | test (fake/contract) | n/a | itself; fake `NotFoundError` factory :75-76 -> `GitCommandError` | exact |
| `test/platform/git.test.ts` (rewrite on system git) | test | request-response | `test/platform/git-process.test.ts` `realGit` :408-418, `laneFixture` :420-438; `test/platform/git-test-repository.ts` | exact |
| `test/architecture/marketplace-tag-probe-offline.test.ts` (invert) + `gate-targets.ts` | test (architecture) | n/a | itself :31-34 | exact |
| `features/lib/github-device-flow/connect-proxy.ts` (new) | test harness (server) | streaming (CONNECT tunnel) | `features/lib/github-device-flow/server.ts`, `routing.ts` (jsonl decision log) | role-match |
| `features/lib/https-git-host/server.ts` (cert SAN, `refuse-sha-want` step) + `cgi.ts` (forward backend error :172-206) | test harness | request-response | itself :40-80 | exact |
| Feature files (`marketplace/*`, `plugin/*` request-table re-baseline; new D-SG-09, D-SG-13, D-SG-15, D-SG-11, v0 ladder, symlink-outside scenarios) | test (cucumber) | n/a | `features/step_definitions/mcp-server/listing.steps.ts` :120-135 (env-var profile step); existing `Then the git host receives these requests:` tables | role-match |

## Pattern Assignments

### `platform/git-process.ts` (utility, request-response)

**Request shape** (lines 138-159). Add `readonly config?: readonly string[]` here with a doc comment, next to `options`:
```ts
export interface GitRequest {
  readonly subcommand: GitSubcommand;
  readonly lane: GitLane;
  /** Pi-owned flags after the subcommand, in the order given. */
  readonly options?: readonly string[];
  readonly operands?: readonly string[];
  readonly cwd?: string;
  readonly input?: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly allowExit?: readonly number[];
}
```

**Closed verb table** (lines 125-135 union, 321-332 rules). New verb `for-each-ref` joins both, as `{ operands: MARKER_RULE, ssh: false }`, and needs a corpus row in `test/platform/git-process.test.ts`:
```ts
const SUBCOMMAND_RULES: Readonly<Record<GitSubcommand, SubcommandRule>> = {
  clone: { operands: MARKER_RULE, ssh: true },
  ...
  "update-ref": { operands: MARKER_RULE, ssh: false },
  "rev-parse": { operands: VERIFY_MARKER_RULE, ssh: false },
  checkout: { operands: DASH_REFUSED_RULE, ssh: false },
```
If `forceUpdateRef` is deleted, drop `update-ref` here too, or fallow/coverage will see a dead row.

**Argv assembly** (lines 749-756). Append the request's `config` pairs after the lane pairs, never through `GIT_CONFIG_COUNT` (the module keeps the user's value, lines 30-32):
```ts
const pairs = [...rules.config, ...PIN_PAIRS, ...LANES[request.lane].pairs];
return [...pairs.flatMap((pair) => ["-c", pair]), request.subcommand, ...words];
```
**Operation label** (lines 891-893): `operationOf` = subcommand + first Pi-owned option. Pick option order per command before re-baselining cause chains.

**Fallow markers:** the `unused-export` markers at :948, :1134, :1154 go stale if `platform/git.ts` imports `createGitProcess`/`NODE_GIT_HOST`/`NODE_GIT_SPAWN`. Bind `platform/git.ts` to `NODE_GIT_PROCESS` only (as `git-credential.ts` does), or inject a `GitProcess` parameter and remove the marker that becomes consumed.

---

### `platform/git-failure-kind.ts` (classifier, transform)

**Row-with-detail precedent** (lines 77-80):
```ts
const ROWS: ReadonlyArray<readonly [Trigger, Outcome]> = [
  [/^(?:xcrun: error:.*(?:\n|$))+$/, { kind: "git-missing", detail: "macos-shim" }],
  [127, { kind: "git-missing", detail: "not-found" }],
```
Split today's single `https-auth` row (lines 88-91) into two rows in the same position: `could not read (Username|Password) for '` / `terminal prompts disabled` -> `{ kind: "https-auth", detail: "no-credential" }`; `Authentication failed for '` / `returned error: 40[13]` -> `{ kind: "https-auth", detail: "rejected" }`. Add `[/^error: Server does not allow request for unadvertised object /m, { kind: "commit-missing" }]` beside the existing commit row (line 109):
```ts
[/^fatal: .*not our ref |^fatal: reference is not a tree: /m, { kind: "commit-missing" }],
```
Pair: `test/platform/git-failure-kind.test.ts` (add measured stderr strings from RESEARCH: `fatal: could not read Username for 'http://127.0.0.1:18602': terminal prompts disabled`, `fatal: Authentication failed for 'http://127.0.0.1:18602/acme/tools.git/'`).

---

### `platform/git.ts` (service, request-response over system git)

**Analog:** `platform/git-credential.ts` lines 89-110, the only production `NODE_GIT_PROCESS.run` caller today:
```ts
const run = await NODE_GIT_PROCESS.run({
  subcommand: "credential",
  options: [action],
  lane: "network",
  input,
  timeoutMs,
});
return run.stdout;
```
Apply the same shape for every verb; target argv per verb is the table in `03-RESEARCH.md` "GitOps inventory" (lines 107-125). Clone example from RESEARCH (lines 404-413):
```ts
const clone: GitRequest = {
  subcommand: "clone", lane: "network",
  config: insteadOfPairFor(url),
  options: ["--depth", "1", "--no-recurse-submodules", ...(ref ? [`--branch=${ref}`] : [])],
  operands: [url, stagingDir],
  timeoutMs: gitTimeoutMs(),
  ...(signal !== undefined && { signal }),
};
```
**Absent-ref read** (replace isomorphic `NotFoundError` paths): `rev-parse --verify --quiet <ref>^{commit}` with `allowExit: [1]`, `exitCode === 1 ? undefined : stdout.trim()` (RESEARCH :418-423).

**Delete:** isomorphic imports (:5-6, :19), the HTTP redirect client (:214-484), the origin reset after clone (:605-609), the explicit-url fetch override (:639), `listTags`/`resolveTagOid` (:803-878), `forceUpdateRef`/`currentBranch` (:890-919). **Keep:** `withFetchedUrlCause` (:493-512, GHB-01 cause line) and the `gitAbortScope` `AsyncLocalStorage` (:309-310), now feeding `GitRequest.signal`.

**Device Flow retry** (D-SG-14): RESEARCH `runWithAuthRetry` sketch :428-440. Narrow on `error instanceof GitCommandError && error.failure.kind === "https-auth" && error.failure.detail === "no-credential"`, never on stderr (SG-PRC-05). One-shot helper file goes in the neutral directory (`platform/git-neutral-directory.ts::createNeutralDirectory` :34), mode 0600, deleted in `finally`.

---

### `platform/git-timeout.ts` (new utility, env reader)

**Analog:** `shared/github-base-url.ts` — reads its variable on every call, no module cache (doc at :93-99). Shape:
```ts
export function gitTimeoutMs(env: NodeJS.ProcessEnv = process.env): number
```
Finite > 0 -> `Math.min(v, 2147483647)`, else `120_000`. Take `env` as a defaulted parameter (DI convention, CONVENTIONS "Dependency injection over test-only seams"). Paired test required (source-test pairing gate).

---

### `shared/github-base-url.ts` (insteadOf builder)

**Analog in-file:** `gitHubWireUrl` :84-91:
```ts
export function gitHubWireUrl(url: string): string {
  if (!url.startsWith(`${GITHUB_ORIGIN}/`)) {
    return url;
  }
  const base = readGitHubBase();
  return base === undefined ? url : `${base.url}${url.slice(GITHUB_ORIGIN.length)}`;
}
```
New export returns `readonly string[]` (`[]` or `[`url.${base.url}/.insteadOf=https://github.com/`]`), with the same prefix-gated read. Add a GHB-03 reason for `=` in the base via the existing `InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, "<reason>")` pattern (:60-62). `gitHubWireUrl` becomes unused in production once git.ts stops using it; fallow dead-code will flag it unless a consumer remains (`withFetchedUrlCause` may still need it for the cause line).

---

### `domain/` SHA and ref refusal

**Analog:** `domain/name.ts::assertSafeName` (:35-66), throw-on-invalid assertion with a label. Regex `/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/` after lower-casing; refuse a ref starting with `-`. Throw a typed error from `shared/errors.ts` following the `StaleSourceCloneError` shape (`this.name = ...`, readonly fields, doc comment citing SG-TRN-02). `domain/` imports only `shared/`.

---

### `persistence/locations.ts` (backup getters)

**Analog** (lines 360-385):
```ts
async sourceCloneDir(mp: string): Promise<string> {
  assertSafeName(mp, `sourceCloneDir marketplace name "${mp}"`);
  const candidate = path.join(sourcesDir, mp);
  await assertPathInside(sourcesDir, candidate, `sourceCloneDir(${mp})`);
  return candidate;
},

async sourcesStagingDir(uuid: string): Promise<string> {
  const sourcesStagingRoot = path.join(extensionRoot, "sources-staging");
  const candidate = path.join(sourcesStagingRoot, uuid);
  await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
  return candidate;
},
```
Add `sourceBackupDir(mp)` (root `sources-backup/`) and `pluginCloneBackupDir(key)` (root `plugin-clones-backup/`, NOT under `plugin-clones/`, which `clone-gc.ts` sweeps). Add the interface members in the `ScopedLocations` type block near :53-90 with the same doc-comment style.

---

### `orchestrators/marketplace/shared.ts` — `refreshCloneBySwap`

**Analog:** `orchestrators/marketplace/add.ts`.

Staging clone + ownership marker (`gitStagingSteps` :874-899):
```ts
async stage(stagingDir) {
  await gitOps.clone({
    dir: stagingDir,
    url: networkCloneUrl(source),
    ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
    auth,
  });
  await writeOwnershipMarker(stagingDir);
},
```
Set aside / restore through `ScopedLocations` (:940-975):
```ts
const setAside = await locations.sourcesStagingDir(randomUUID());
await mkdir(path.dirname(setAside), { recursive: true });
await rename(cloneDir, setAside);
...
try {
  await rename(setAside, cloneDir);
  return undefined;
} catch (err) {
  return `failed to restore marketplace clone ${setAside} to ${cloneDir}: ${errorMessage(err)}`;
}
```
Ownership marker (:1673-1686) is private to `add.ts`; the swap must write it into staging before the rename (Pitfall 5). Either export `writeOwnershipMarker` from `add.ts` (check BLOCK C: `add` is a `MARKETPLACE_LEDGERS` member, so `shared.ts` importing it is fine only if no ledger-to-ledger rule trips; `shared.ts` is not a ledger) or move it to `shared.ts` and have `add.ts` import it.

Leak handling on cleanup: `clone-cache.ts::promoteStagingToClone` :95-115 (`cleanupStaging` + `appendLeakToError`, MA-9). Errno arm for EBUSY/EPERM/EACCES follows the same `(err as NodeJS.ErrnoException).code` read.

Result union: discriminated `{ kind: "current" | "replaced" | "kept-stale" | "kept-in-use" }`, consumers switch with `assertNever`. Rename `refreshGitHubClone` in `eslint.config.js` `NETWORK_SEAM_NAMES` (:106-107) to the new name in the same commit.

---

### `orchestrators/plugin/clone-cache.ts`

**Pin ladder** replaces `checkoutPinWithRefetch` :148-167 and `asPinnedCommitMissing` :175-177. Keep the error-wrapping style:
```ts
function asPinnedCommitMissing(err: unknown, pin: string): unknown {
  return isGitCommitNotFetchedError(err) ? new PinnedCommitMissingError(pin) : err;
}
```
becomes `err instanceof GitCommandError && err.failure.kind === "commit-missing"`. Delete the name matchers at :73-80. Order: clone `--depth 1 --no-checkout` -> `fetch --depth 1 origin <sha>` -> (any `GitCommandError`, and only if `rev-parse --is-shallow-repository` prints `true`) `fetch --unshallow origin [<ref>]` -> `checkout --detach <sha>` -> `rev-parse HEAD` equals pin else `pin-mismatch`.

**D-SG-11 key drop** at `checkoutGitDirCopy` :282-292, between the `rm(index)` and the checkout:
```ts
await cp(gitDir, path.join(staging, ".git"), { recursive: true, verbatimSymlinks: true });
await rm(path.join(staging, ".git", "index"), { force: true });
// + config --local --unset-all core.symlinks / core.ignorecase (allowExit [5])
await gitOps.checkout({ dir: staging, ref });
```
**Offline ref reads** `resolveFetchedRefOffline` :564-581 / `resolveLocalTagOffline` :583-597: keep the lookup order, replace try/catch on `isGitNotFoundError` with the `undefined` return of the new `resolveRef`. Keep `readOriginRemoteUrl` :607+ fs-only (Pitfall 9).

**Mirror refresh** (`materializeOrRefreshPluginMirror` :467, refresh call ~:539): call `refreshCloneBySwap` without KEEP, backup via `pluginCloneBackupDir`.

---

### `orchestrators/plugin/marketplace-tag-probe.ts`

**Analog:** `orchestrators/plugin/dependency-tag-probe.ts` :100-150 — memo keyed by URL, written only on success, throw folded to `tag-listing-failed`:
```ts
async function listCandidateTags(request: TagListingRequest): Promise<TagListingOutcome> {
  const memoized = request.memo?.get(request.url);
  if (memoized !== undefined) {
    return { kind: "listed", tags: memoized };
  }
  try {
    const tags = await request.seam.listRemoteTags({ url: request.url, auth: request.auth });
    request.memo?.set(request.url, tags);
    return { kind: "listed", tags };
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return {
      kind: "tag-listing-failed",
      cause: err instanceof Error ? err : new Error(String(err)),
      classification: classifyGitFailure(err, { notFound: "source missing" })?.reason,
    };
  }
}
```
URL from `canonicalCloneUrl(source)` + `buildCloneAuth(cloneUrl, source.kind, options.auth)` (:153-160). Inject the listing as a `seam` with a `REAL_*_SEAM` default, as `dependency-tag-probe.ts` does, so the unit test records the URL handed in. Directory marketplaces use the local `for-each-ref` reader.

---

### `test/architecture/marketplace-tag-probe-offline.test.ts` (invert)

Reads targets from `gate-targets.ts` (`MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS`, :31-34 import, `gate-targets.ts:191`). Rename the constant (drop "OFFLINE"), pin the probe's `platform/git` named imports to the new reader set. Keep the `domain/release-tag.ts` imports-nothing-from-platform assertion. Also update `gate-targets.ts:158-167` and `test/.../no-credential-leak.test.ts:104-109,579`, which name `git-auth-callbacks.ts`.

---

### `test/platform/git.test.ts` and `git-ops-contract.ts` (real system git)

**Analog:** `test/platform/git-process.test.ts` :408-438:
```ts
async function realGit(options: RealGitOptions): Promise<GitProcess> {
  const configPath = path.join(await mkdtemp(path.join(options.root, "gitconfig-")), "config");
  await writeFile(configPath, options.config);
  return createGitProcess({
    spawn: options.spawn ?? NODE_SPAWN,
    host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(options.root) },
    env: { ...options.env, GIT_CONFIG_GLOBAL: configPath },
    killGraceMs: options.killGraceMs ?? KILL_GRACE_MS,
  });
}
```
Fixture repos: `createGitTestRepository(t, { boundary: "local" })`, `repository.cloneBare(bare)`, `repository.run("tag", ...)` (`test/platform/git-test-repository.ts` :257; helpers `runSystemGit` :93). Environment: `hermeticGitEnvironment(root)` from `test/platform/hermetic-environment.ts`. This requires `platform/git.ts` to accept an injected `GitProcess` (DI), with `NODE_GIT_PROCESS` as the default.

**Fake** (`test/platform/git-ops-fake.ts` :75-76) manufactures `NotFoundError` today:
```ts
error.name = "NotFoundError";
return Object.assign(error, { code: "NotFoundError" });
```
Replace it with `new GitCommandError(...)` of the right kind, or with `undefined` returns for absent refs. Change the `GitOps` interface, fake, and contract in one commit (29 test files use the fake or contract).

---

### `features/lib/github-device-flow/connect-proxy.ts` (new harness)

**Analogs:** `features/lib/github-device-flow/server.ts` (loopback server lifecycle with `close()`) and `routing.ts` (the `github-redirect.jsonl` `{decision, method, url, target}` entries that `Then pi routes these github requests:` reads). Tunnel only `CONNECT github.com:443` to `127.0.0.1:<git host port>` and refuse everything else. Child env key `https_proxy` must be added to the exact key set in `test/architecture/hermetic-git-environment.test.ts` (:90-105, :390 show the pattern of listed keys). Also plant `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` there.

### `features/lib/https-git-host/server.ts` / `cgi.ts`

The cert args are at :40-59, and `"subjectAltName=IP:127.0.0.1"` becomes `"subjectAltName=IP:127.0.0.1,DNS:github.com"`. The `GitHostArm` union (:60-80) already has `refuse-sha-want`, so add only its Given step. In `cgi.ts::runHttpBackend` (:172-206), forward the backend's own answer instead of rejecting a non-zero exit.

### Cucumber scenarios

Env-var profile step analog (`features/step_definitions/mcp-server/listing.steps.ts` :120-135):
```ts
Given(
  "pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, variable: string, value: string) {
    const file = await writeLaunchEnvironment(this.tokens.home, { [variable]: value });
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({ companions: ["pi-mcp-adapter"], extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION] });
```
Reuse it, or generalize it, for `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS="1000"` and the KEEP variable. Re-baseline request tables with the rule table in RESEARCH :288-295, one file at a time.

## Shared Patterns

### Process launch chokepoint
**Source:** `platform/git-process.ts` `NODE_GIT_PROCESS` (:1165), used as in `platform/git-credential.ts` :102-108.
**Apply to:** all of `platform/git.ts`. No `child_process` import (`child-process-chokepoint` rule).

### Typed git failure narrowing
**Source:** `GitCommandError` + `GitFailure` (`shared/errors.ts` :1308-1336). Classify only in `platform/git-failure-kind.ts`.
**Apply to:** `clone-cache.ts`, `marketplace/shared.ts`, `platform/git.ts` retry, `git-failure-classifiers.ts`. Use `instanceof` + `.failure.kind`/`.detail`, never stderr text or `.name` (SG-PRC-05, CONVENTIONS).

### Staging + rename containment
**Source:** `ScopedLocations` getters (`persistence/locations.ts` :360-385), `add.ts` :940-975, `clone-cache.ts::promoteStagingToClone` :95-115.
**Apply to:** the marketplace swap, the mirror swap, and pin clones. Use only same-filesystem `rename`, with staging under `sources-staging/` and backups under the new getters (NFR-1, NFR-10).

### State lock
**Source:** `transaction/with-state-guard.ts` :205-222 (`retries: 0, stale: 10_000, update: 2_000`).
**Apply to:** the swap callers keep their existing lock. No nested guard. Every spawn stays async.

### Network seam gating
**Source:** `eslint.config.js` BLOCK F, with `NETWORK_SEAMS` at :64-101 and `NETWORK_SEAM_NAMES` at :106-107.
**Apply to:** any new seam identifier, such as `refreshCloneBySwap`. Update the per-file reason comments too.

### Error class shape
**Source:** `StaleSourceCloneError` in `shared/errors.ts`. It sets `this.name`, has readonly fields, passes `{ cause }`, and has a doc comment with an ID.
**Apply to:** the new domain refusal error, and to `StoredCredentialRejectedError` wrapping a `GitCommandError` cause.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `features/lib/github-device-flow/connect-proxy.ts` (tunnel half) | harness | streaming | No HTTP `CONNECT` tunnel exists in the repo. Use the `routing.ts` log format and Node `http.Server` `'connect'` event per RESEARCH :221. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{platform,shared,domain,persistence,orchestrators/marketplace,orchestrators/plugin}`, `test/platform`, `test/architecture`, `features/lib`, `features/step_definitions/mcp-server`.
**Tracked-source gate:** all named analogs are tracked repo sources. No `.gsd` mirror paths are named.
**Pattern extraction date:** 2026-11-23
