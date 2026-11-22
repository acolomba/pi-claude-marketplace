# Architecture Research

**Domain:** System-git transport for a Pi extension that clones Claude plugin marketplaces and git-source plugins (milestone `system-git`)
**Researched:** 2026-11-22
**Confidence:** HIGH for the integration map (every claim is a file:line read on `features/system-git` at `0c1aeb2`). MEDIUM for the proposed components and build order (design inference). LOW for upstream behavior quoted from the Claude Code host-marketplace page: the `classify-confidence` seam rates a `webfetch` source LOW, and each claim must be re-checked against the 2.1.330 binary in the phase CONTEXT.md, as `claude-code-compat-research` requires.

## Standard Architecture

### System Overview (target)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ orchestrators/  (unchanged call shape: GitOps seam + clone-cache entrypoints)│
│  marketplace/add.ts  marketplace/update.ts  plugin/clone-cache.ts            │
│  plugin/update-flow.ts  plugin/dependency-tag-probe.ts                       │
│  plugin/marketplace-tag-probe.ts  (callers of GitOps / platform/git.ts)      │
│        │  GitOps (orchestrators/marketplace/shared.ts:167) -- auth param GONE │
├────────┼─────────────────────────────────────────────────────────────────────┤
│ platform/git.ts   REWRITTEN: same verbs, implemented as git argv             │
│   clone / fetch / checkout / resolveRef / forceUpdateRef / currentBranch /   │
│   resolveRemoteRef / listRemoteTags / listTags+resolveTagOid / listRemotes    │
│   + NEW: transport selection (SSH probe -> HTTPS fallback -> SSH retry)       │
│        │ argv + cwd + AbortSignal                                             │
│ platform/git-process.ts  NEW: the one git/ssh spawn site                      │
│   env builder (GIT_TERMINAL_PROMPT=0, askpass off, hardening -c flags),      │
│   timeout, abort scope, process-group kill, stderr capture + redaction,       │
│   Windows command lookup, typed GitCommandError                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ shared/  git-failure-classifiers.ts (stderr kinds, replaces HttpError ladder)│
│          errors.ts (GitCommandError, GitRefNotFoundError, GitCommitMissing…)  │
│          github-base-url.ts (D-MF-01: kept as -c insteadOf, or retired)        │
├──────────────────────────────────────────────────────────────────────────────┤
│ system git binary + the user's own config: credential helpers, ssh-agent,    │
│ known_hosts, url.<x>.insteadOf, GIT_SSH_COMMAND                               │
└──────────────────────────────────────────────────────────────────────────────┘

REMOVED or SHRUNK when git owns credentials:
  platform/git-auth-callbacks.ts (all of it), the isomorphic-git HTTP client in
  platform/git.ts:207-532, orchestrators/auth-host.ts bundle builders, the
  `auth`/`credentialOps`/`deviceFlowHttp`/`authMemo` threading in about 23
  orchestrator files, and Device Flow (domain/github-auth.ts,
  domain/auth-registry.ts, platform/git-credential.ts) if discuss removes it.
```

### Component Responsibilities

| Component | Responsibility after the milestone | New / Modified / Removed |
|-----------|-------------------------------------|--------------------------|
| `platform/git-process.ts` | The only module that spawns `git` (and the `ssh -T` probe). It builds the non-interactive environment, adds the hardening `-c` flags, runs asynchronously (the state-lock refresh timer needs the event loop, as `platform/package-manager.ts` notes for D-PL9-15), applies a timeout, reads the D-PL8-24 abort scope, kills the process group, caps and redacts stderr, and throws `GitCommandError` | **New** |
| `platform/git.ts` | Keeps its exported verbs and the `ListRemotesResult`/`RemoteTag` types. Each verb becomes one or two git commands. It owns transport selection for `owner/repo`. It no longer imports `isomorphic-git` or `git-auth-callbacks.ts` | **Modified** (rewritten) |
| `orchestrators/marketplace/shared.ts` | Owns the `GitOps` seam (`:167`), `DEFAULT_GIT_OPS` (`:223`), and the D-14 `refreshGitHubClone` (`:274`). The `auth?` members leave the seam. `isGitNotFoundError` (`:253`) becomes `instanceof GitRefNotFoundError` | **Modified** |
| `orchestrators/plugin/clone-cache.ts` | Same entrypoints. The `CommitNotFetchedError` and `NotFoundError` name matchers (`:73`, `:78`) become `instanceof`. `resolveAuth` and `auth` leave the arguments. `resolveTagOid`'s `cache` argument goes away | **Modified** |
| `orchestrators/auth-host.ts` | Loses the bundle builders. Its remaining job, if any, is the Device Flow retry (if kept) and `hostFromCloneUrl` for messages. Without Device Flow it can be deleted | **Removed or shrunk** |
| `platform/git-auth-callbacks.ts` | The isomorphic-git `onAuth`/`onAuthFailure` state machine. git consults credential helpers itself | **Removed** |
| `platform/git-credential.ts` | `git credential fill/approve/reject`. It survives only if Device Flow survives, to `approve` the minted token before the retry | **Removed, or kept for Device Flow** |
| `domain/github-auth.ts`, `domain/auth-registry.ts` | Device Flow engine and provider registry | **Removed, or kept** (discuss) |
| `shared/git-failure-classifiers.ts` | Classifies a failure from `GitCommandError.kind` (derived from stderr and the exit code) instead of isomorphic-git's `HttpError.data.statusCode` (`:28-30`, `:96-102`). The hosted-catalog `HttpError` path (`HostedManifestHttpError`, `shared/errors.ts:633`) stays | **Modified** |
| `domain/source.ts` | Accepts `git@host:path` and `ssh://` for `url` and `git-subdir` sources. Today they are rejected at `:105-123` and `:467` (D-76-01) | **Modified** |
| `domain/clone-key.ts` | `canonicalCloneUrl` (`:85`) keeps `https://github.com/<o>/<r>` as the github identity, so no `plugin-clones/` key changes. `originMatchesSource` (`:118`) and `normalizedIdentity` (`:131`) must compare scp and `ssh://` forms, which WHATWG `URL` cannot parse | **Modified** |
| `shared/github-base-url.ts` | GHB-01 `gitHubWireUrl` (`:84`) and `gitHubOverrideHost` (`:100`). It becomes a `-c url.<base>/.insteadOf=https://github.com/` flag, or it is retired in favor of the user's own git config (decision; see D-MF-01 below) | **Modified or removed** |
| `features/lib/https-git-host/*` | Already serves smart HTTP through `git http-backend` (`server.ts:1-19`, `cgi.ts:36-60`). It needs CA trust for system git and new request baselines | **Modified** (harness) |

## Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── platform/
│   ├── git.ts               # REWRITTEN: verbs as git argv; transport selection
│   ├── git-process.ts       # NEW: sole git/ssh spawn site (child-process allow-list)
│   ├── windows-command.ts   # NEW (optional): PATH lookup shared with package-manager.ts
│   ├── git-credential.ts    # KEEP only if Device Flow stays
│   └── git-auth-callbacks.ts# DELETE
├── shared/
│   ├── git-failure-classifiers.ts  # stderr-kind ladder
│   ├── git-stderr-redact.ts        # NEW (or inside git-process.ts): userinfo, tokens, abs paths
│   ├── errors.ts                   # + GitCommandError family; - CrossOrigin/TooManyRedirects/StoredCredentialRejected
│   └── github-base-url.ts          # + GITHUB_SSH_HOST literal (the local/no-github-literal rule exempts only this file)
├── domain/
│   ├── source.ts            # accept git@host: / ssh:// forms
│   └── clone-key.ts         # scp/ssh identity compare; networkCloneUrl -> transport candidates
└── orchestrators/
    ├── marketplace/shared.ts  # GitOps without auth
    └── auth-host.ts           # DELETE or shrink
```

### Structure Rationale

- **`platform/git-process.ts` is separate from `platform/git.ts`.** Then the child-process allow-list names one small module that holds only the spawn mechanics, as `platform/package-manager.ts` does for D-PL9-11. `git.ts` holds only git semantics and stays testable with an injected runner. This follows the CONVENTIONS rule "dependency injection over test-only seams".
- **Transport selection lives in `platform/`, not `domain/`.** The SSH probe spawns `ssh`, and `domain/` must stay pure. The fallow `platform` zone may import only `shared` (`.fallowrc.json` boundaries; restated at `platform/git-auth-callbacks.ts:31-37`). So the URL-candidate type that `domain/clone-key.ts` produces and `platform/git.ts` consumes must be declared in `shared/` or passed as plain strings.
- **The github.com SSH host literal goes in `shared/github-base-url.ts`.** The `local/no-github-literal` ESLint rule (GHB-02, `eslint.config.js` after BLOCK F) exempts only that module. Every other github.com literal already carries a disable comment (`domain/auth-registry.ts:52-56`, `domain/source.ts:703,720,735,858`).

## Integration Map (question 1): `platform/git.ts`, `GitOps`, and every caller

### Exported surface of `platform/git.ts` and its isomorphic-git dependency

| Export | Line | isomorphic-git call | System-git equivalent (proposed) |
|--------|------|---------------------|----------------------------------|
| `runWithGitAbortSignal` | `:302` | AsyncLocalStorage scope read by the custom HTTP client (`:412-426`) | The same AsyncLocalStorage, read by `git-process.ts`. Spawn with `signal` and kill the process group on abort |
| `clone` | `:566` | `git.clone` + `setConfig remote.origin.url` when GHB-01 rewrote the URL (`:597-601`) | `git clone [--depth 1] [--branch <ref>] [--recurse-submodules] -- <url> <dir>`. When the rewrite is a `-c insteadOf`, git records the canonical URL itself and the `setConfig` disappears |
| `fetch` | `:612` | `git.getConfig` + `git.fetch` with an explicit `url` under GHB-01 (`:615-638`) | `git -C <dir> fetch [--depth 1] [--tags] [--force] origin [<ref>]` |
| `checkout` | `:641` | `git.checkout` | `git -C <dir> checkout [--detach] <ref>`, with the hardening flags (hooks off) |
| `resolveRef` | `:650` | `git.resolveRef` (throws `NotFoundError`) | `git rev-parse --verify --quiet <ref>^{commit}`. Exit 1 maps to `GitRefNotFoundError` |
| `resolveRemoteRef` | `:687` | `listServerRefs` v2, `symrefs`, `peelTags` (`:544-564`) | `git ls-remote --symref <url> HEAD` or `git ls-remote <url> refs/heads/<r> refs/tags/<r> refs/tags/<r>^{}` |
| `listRemoteTags` | `:758` | `listServerRefs` with `prefix: refs/tags/` | `git ls-remote --tags <url>`. Prefer the `^{}` peeled line, which matches today's `peeled ?? oid` at `:772` |
| `listTags` | `:792` | `git.listTags` | `git for-each-ref --format=%(refname:strip=2) refs/tags` |
| `resolveTagOid` | `:834` | `resolveRef` + `readTag`/`readCommit` loop with an isomorphic-git `cache` (`:162-172`) | `git rev-parse --verify --quiet refs/tags/<n>^{commit}`. The `cache` parameter disappears. Better: one `for-each-ref` with `%(*objectname) %(objecttype)` replaces `listTags` plus N peels |
| `forceUpdateRef` | `:879` | `git.writeRef({force:true})` | `git update-ref <ref> <sha>` |
| `currentBranch` | `:902` | `git.currentBranch` | `git symbolic-ref --quiet --short HEAD`. Exit 1 means detached, which maps to `undefined` |
| `listRemotes` | `:946` | fs pre-read of `.git/config`, then `git.getConfigAll` | Keep the fs pre-read: it alone gives the `not-a-repo`, `permission-denied`, and `unreadable` arms. Then `git config --get-all remote.origin.url` |
| `GitCredentials` (type) | `:980` | isomorphic-git `GitAuth` shape | Removed, or moved to `git-credential.ts` if Device Flow stays |
| Types `CloneOptions` … `ListRemotesResult` | `:50-205` | | Kept, minus every `auth?` member (`:81`, `:90`, `:129`, `:143`) |
| Private HTTP client `requestWithinOrigin`, `sendHop`, redirect and cross-origin rules | `:207-477` | `isomorphic-git/http/node` | **Deleted.** git applies its own redirect policy (`http.followRedirects=initial`) and its credential helper keys a redirect target by that target's host, which retires the DD-3 capability gap recorded at `:446-451` |
| `withFetchedUrlCause` / `networkCall` | `:486-532` | | Fold into `git-process.ts`. `FetchedUrlCause` survives only if GHB-01 survives |

### The `GitOps` seam

`orchestrators/marketplace/shared.ts:167-215` declares eight primitives (`clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, `resolveRemoteRef`, `listRemotes`). `DEFAULT_GIT_OPS` (`:223-236`) binds them to `platform/git.ts`. `runWithGitAbortSignal` is re-exported at `:242` for `index.ts:18,352`. `GitAuthBundle` (`:139`) is the readonly `BuildAuthCallbacksOpts`. `listRemoteTags`, `listTags`, and `resolveTagOid` are **not** on `GitOps`. Three callers import them from `platform/git.ts` directly: `dependency-tag-probe.ts:33`, `marketplace-tag-probe.ts:25`, and `clone-cache.ts:35`.

### Every caller

| Caller | What it calls | Lines | Change needed |
|--------|---------------|-------|---------------|
| `orchestrators/marketplace/shared.ts::refreshGitHubClone` | `fetch` → `resolveRef(refs/remotes/origin/HEAD or <ref>)` → `currentBranch` → `forceUpdateRef` → `checkout` (D-14) | `:274-343` | Drop `auth`. See the tag pitfall below: a moved tag is not updated by a plain `git fetch origin <tag>`. Recommend `fetch --force` and checkout of `FETCH_HEAD`'s sha |
| `…/marketplace/shared.ts::refreshUrlClone` | builds the auth bundle (`buildAuthForHost`, `:390`), calls `refreshGitHubClone`, attaches `NO_STORED_CREDENTIAL_CAUSE` (`:402-404`) | `:367-408` | Collapses to a call of `refreshGitHubClone`. `lacksStoredCredential` (`:418`) is removed |
| `orchestrators/marketplace/add.ts::gitStagingSteps` | `gitOps.clone` with `networkCloneUrl(source)`, `singleBranch` when a ref is set, and `cloneAuthFor` | `:869-895`, `:1864-1867` | Drop auth. Transport selection runs inside `clone` |
| `…/marketplace/add.ts::recognizeLeftover` | `gitOps.listRemotes` then `originMatchesSource` | `:1688-1720` | `originMatchesSource` must accept scp and ssh origins (an SSH clone records `git@github.com:o/r.git` as its origin) |
| `…/marketplace/add.ts` defaulting | `args.gitOps ?? DEFAULT_GIT_OPS` | `:817`, `:1243` | none |
| `orchestrators/marketplace/update.ts::refreshRecord` | github arm: `buildGitHubAuth` + `refreshGitHubSource`. url arm: `refreshUrlClone`. hosted arm untouched | `:502-570`, `:465-482` | Drop auth and the `NO_STORED_CREDENTIAL_CAUSE` line. Upstream re-clones after a failed background check (`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`): that is a features decision |
| `…/marketplace/update.ts` defaulting | `opts.gitOps ?? DEFAULT_GIT_OPS` | `:286`, `:327` | none |
| `orchestrators/marketplace/autoupdate.ts` | no direct git surface. It reaches git through `updateMarketplace`, and its comment at `:68` names that | | Its D-3-04 stored-credential-only rule becomes "git is non-interactive", which every call already is |
| `orchestrators/marketplace/background-pass.ts` | `runWithAbortSignal` wraps each step (`:99`, `:197`, `:241`) | | Keep the contract. The scope must now kill a child process |
| `orchestrators/plugin/clone-cache.ts::materializePluginClone` | `cloneIntoStaging` → `gitOps.clone` (`:121-133`). `checkoutPinWithRefetch` → `checkout`, then on `CommitNotFetchedError` a `fetch --tags` and a second `checkout` (`:148-167`) | `:208-257` | Shallow clone plus `fetch --depth 1 origin <sha>`, then the `--unshallow` fallback, replaces the refetch. The `CommitNotFetchedError` name check becomes a typed error |
| `…/clone-cache.ts::checkoutGitDirCopy` | copies `.git`, deletes the index, then `gitOps.checkout` | `:283-292` | It works with system git, but a copied `.git` carries the source's hooks and `core.*` config. Every local command must pass `-c core.hooksPath=` and `-c core.fsmonitor=false` (pitfall) |
| `…/clone-cache.ts::copyMirrorAtCommit` | the copy plus a `NotFoundError` or `CommitNotFetchedError` fallback | `:300-330` | A shallow mirror often lacks the sha, so the copy falls back to a clone more often (more network, same correctness) |
| `…/clone-cache.ts::materializeOrRefreshPluginMirror` | `refreshGitHubClone` (`:539`), `resolveRef HEAD` (`:542`), `resolveTagOid` (`:531`) | `:467-545` | Drop auth |
| `…/clone-cache.ts::seedSameRepoPluginMirrors` | copies a path-source marketplace's `.git`, then checkout | `:767-820`, `:722` | **Security:** this copies the *user's* repository `.git`, including `hooks/` and `config`. Hardening flags are mandatory |
| `…/clone-cache.ts::resolvePluginPin` | `gitOps.resolveRemoteRef` with `networkCloneUrl` | `:835-868` | Drop auth. Transport selection applies to `ls-remote` too |
| `…/clone-cache.ts::materializeMarketplaceTagClone` | copy plus checkout of a marketplace tag | `:944-990` | Same hardening |
| `…/clone-cache.ts::readOriginRemoteUrl` | fs-only `.git/config` parse | `:607-640` | Keep, because it is network-free. It must accept a scp or ssh origin in `deriveMarketplaceUrl` (`:652-675`) |
| `orchestrators/plugin/git-source-probe.ts::readMirrorHeadSha` | fs-only read of `.git/HEAD`, loose refs, and `packed-refs` | `:54-86` | Breaks on a **reftable** repository and on a `.git` *file*. Pass `--ref-format=files` on clone (git 2.45 or later; this sandbox has 2.43.0), or replace the fs read with `git rev-parse` (which spawns git on a read path, an NFR-5-neutral but chokepoint-relevant change) |
| `orchestrators/plugin/update-flow.ts::makeSyncCloneOnce` | `buildGitHubAuth` + `refreshGitHubClone`, or `refreshUrlClone` | `:233-283` | Drop auth and `authMemo` |
| `orchestrators/plugin/update-preflight.ts::makeUpdateCloneProbe` | `buildStoredCredentialAuth` or `buildCloneAuth` | `:343-366` | The `cloneAuth` helper disappears |
| `orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags` | `listRemoteTags({url: networkCloneUrl, auth: buildCloneAuth(...)})` | `:153-175`, `:126` | Drop auth. `ls-remote` gets transport selection |
| `orchestrators/plugin/marketplace-tag-probe.ts` | `listTags` + `resolveTagOid(cache)` | `:25-38`, `:97`, `:106` | Signature change. The `marketplace-tag-probe-offline` architecture test pins exactly `["listTags","resolveTagOid"]` (`test/architecture/marketplace-tag-probe-offline.test.ts:65-76`) |
| `orchestrators/plugin/update-constraint-gate.ts` | type `RemoteTag`, and calls both tag probes | `:29-37`, `:205` | Type-only. It stays in NETWORK_SEAMS only while it imports `platform/git` |
| `orchestrators/plugin/install-cascade.ts` | type `RemoteTag` (`:134`), `tagMemo` (`:1677`), `deviceFlowHttp` (`:960`) | | Drop the auth threading. Moving `RemoteTag` into `shared/` takes this file out of NETWORK_SEAMS |
| `orchestrators/plugin/install-clone-probe.ts`, `fetch.ts`, `info.ts` | `buildCloneAuth` → clone-cache `resolveAuth` | `install-clone-probe.ts:74,90`; `fetch.ts:433,451`; `info.ts:2499,2519` | Drop auth (not NETWORK_SEAMS: they reach git through clone-cache by name) |
| `orchestrators/plugin/bootstrap.ts` | passes `gitOps` to `addMarketplace` | `:47`, `:88`, `:121` | none |
| `orchestrators/import/execute.ts` | passes `gitOps` to marketplace adds | `:368`, `:1393` | none |
| `orchestrators/reconcile/apply.ts`, `reconcile/types.ts` | passes and declares the `gitOps` seam | `apply.ts:337`; `types.ts:60`, `:371` | none |
| `edge/types.ts`, `edge/register.ts`, `edge/handlers/plugin/import.ts`, `index.ts` | wire `DEFAULT_GIT_OPS` | `edge/types.ts:21,37`; `register.ts:154`; `import.ts:12,21,64`; `index.ts:18,365` | none |

### Typed-error contract the rewrite must keep

Four orchestrator sites match isomorphic-git error **names** because D-13 forbade importing the library: `marketplace/shared.ts:253` (`NotFoundError`), and `clone-cache.ts:73` (`CommitNotFetchedError`) and `:78` (`NotFoundError`). In `shared/git-failure-classifiers.ts`, `:30` reads `code === "HttpError"`, `:102` reads `UserCanceledError`, and `:128` reads `NotFoundError`. `test/platform/git-ops-fake.ts:76-80` manufactures `NotFoundError` the same way. The rewrite should add real classes to `shared/errors.ts`: `GitCommandError { kind, exitCode, stderr (redacted), operation }`, `GitRefNotFoundError`, and `GitCommitMissingError`. Then switch those matchers to `instanceof`, which is the CONVENTIONS rule anyway ("callers narrow on `instanceof`, never on … `error.name`"). Do this in the **same** phase as the transport swap, or every refresh of a deleted branch silently stops falling back to the detached checkout (`shared.ts:326-330`).

## Auth Surface (question 2)

| Module | What it does today | Fate if git owns credentials |
|--------|--------------------|------------------------------|
| `platform/git-auth-callbacks.ts` (270 lines) | The `buildAuthCallbacks` state machine (`:176`): https-only and host-compare (`onAuth`), `credentialOps.fill`, Device Flow on a miss for `device-flow` bundles, evict on `onAuthFailure` (AUTH-07), `StoredCredentialRejectedError` for `stored-credential` bundles (GAUTH-04). It declares `AuthAttemptResult` (`:39`), `OnAuthRequiredFn` (`:48`), and `BuildAuthCallbacksOpts` (`:69`) | **Deleted.** git runs the helper protocol itself, including `approve` after a success and `reject` after a 401 |
| `platform/git-credential.ts` (355 lines) | Spawns `git credential fill/approve/reject` with `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, and a 5 s timeout (`:148-160`). It is today's only git spawn and the reason it is on the child-process allow-list | **Deleted** without Device Flow. **Kept** with Device Flow, solely to `approve` the minted token |
| `orchestrators/auth-host.ts` (282 lines) | `DEFAULT_CREDENTIAL_OPS` (`:77`), `hostFromCloneUrl` (`:95`), `NO_STORED_CREDENTIAL_CAUSE` (`:126`), `buildStoredCredentialAuth` (`:139`), `buildAuthForHost` with the AAP-02 rule that a non-command run gets no Device Flow (`:176-218`), `buildGitHubAuth` with the GHB-02 rule that the override means no Device Flow (`:228-240`), and `buildCloneAuth` (`:260`). It re-exports the auth types so non-seam orchestrators can name them (`:57`) | **Deleted** without Device Flow. With it, it shrinks to one `runWithDeviceFlowRetry(host, run, op)` composer |
| `domain/github-auth.ts` (426 lines) | RFC 8628 Device Flow engine, `initiateDeviceFlow` (`:402`). It is one of two `fetch` callers (the `fetch-chokepoint` rule) | **Deleted**, or kept unchanged behind the retry |
| `domain/auth-registry.ts` (109 lines) | `GITHUB_PROVIDER` and `GITLAB_PROVIDER` descriptors, `findProviderForHost` (`:107`). It is in NETWORK_SEAMS only because it type-imports `GitCredentials` from `platform/git.ts` (`:23`) | **Deleted**, or kept with `GitCredentials` moved |
| `shared/errors.ts` | `DeviceFlowUnavailableError` (`:6`), `CrossOriginChallengeError` (`:593`), `StoredCredentialRejectedError` (`:610`), `TooManyRedirectsError` (`:620`), `FetchedUrlCause` (`:674`) | The redirect and challenge errors have no producer, so they are **deleted**. The other two follow the Device Flow and GHB-01 decisions |
| `shared/notification-dispatch.ts::notifyDeviceFlowPrompt`, `DeviceFlowPrompt` type | Renders the user code | Follows Device Flow |

**Threading that disappears.** The names `credentialOps`, `deviceFlowHttp`, `authMemo`, and `AuthAttemptResult` appear 233 times in 23 production files. 47 test and feature files use them too. Removing them is mechanical but wide. Schedule it as its own phase, after the transport swap, so a reviewer can read the swap alone.

**If Device Flow is kept (data-flow shape).** isomorphic-git called `onAuth` mid-request. System git cannot call back into Node. So Device Flow becomes **retry-after-failure**: run git, classify stderr as `auth`, check that the host is a registry host and the run is a command run (AAP-02, D-3-04, D-PL8-12), run `initiateDeviceFlow`, call `credentialOps.approve(host, cred)`, then run git once more. The retry authenticates only if the user's git **has a credential helper that stores** the token. Without one, the token must reach git inline. A `GIT_CONFIG_COUNT` credential helper or `http.extraHeader` both keep the token out of argv, but it stays readable in `/proc/<pid>/environ` for the same user. This is the main argument for removing Device Flow. Removal is upstream parity: the host-marketplace page says "Claude Code has no git token of its own" (LOW until re-checked against the binary). Note a migration detail in favor of removal: tokens that earlier Device Flow runs stored with `git credential approve` (`protocol=https`, `host=github.com`, `username=x-access-token`) stay in the user's helper. System git over HTTPS **uses them automatically**, so existing users keep access without any migration code. It is lost only when the SSH probe succeeds and SSH is used instead.

## URL construction and SSH forms (question 3)

| Concern | Where today | What changes |
|---------|-------------|--------------|
| github identity | `domain/clone-key.ts:85` `canonicalCloneUrl` → `${GITHUB_ORIGIN}/${owner}/${repo}` (`GITHUB_ORIGIN` at `shared/github-base-url.ts:30`) | **Unchanged.** It is the cache-key identity. Changing it rehashes every `plugin-clones/<hash>` directory (warning at `clone-key.ts:79-82`) |
| github wire URL | `clone-key.ts:93-102` `networkCloneUrl` → `ensureGitSuffix` (`source.ts:650`) | Becomes a candidate pair: `git@github.com:<o>/<r>.git` (SSH) and `https://github.com/<o>/<r>.git` (HTTPS). The platform picks one by the upstream probe rules: probe `ssh -T git@github.com`, use SSH on success, fall back to HTTPS on probe failure or SSH clone failure, skip the probe under `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`, `GIT_SSH_COMMAND`, `GIT_SSH`, or a `url.*.insteadOf` rewrite in git config. Cache the probe result once per process or per command |
| url and git-subdir wire URL | `networkCloneUrl` `url` arm reads `source.raw`; `git-subdir` arm reads `source.url` via `stripSlashAndFragment` (`source.ts:593`) | Verbatim. A scp or ssh URL passes through unchanged |
| String-form gate | `source.ts:455-471` `parseUrlSourceForm` rejects `git@` and any non-https `://` via `unsupportedUrlReason` (`:105-123`) | Admit `git@host:path[.git][#ref]` and `ssh://[user@]host[:port]/path`. They become `url` sources, a new `transport: "ssh"` member or a separate kind. Upstream: `git@host:path.git` is SSH. `gitHubUrlPath` (`:683-705`) must also recognize `git@github.com:o/r` so it normalizes to `github` kind with one identity |
| Object-form gate | `urlObjectSource` gates `url` and `raw` (`:203-249`). `gitSubdirObjectSource` (`:251-258`) does **not** gate `url` at all, and `git-auth-callbacks.ts` says object sources can carry `http://` | Decide the git-subdir gate explicitly. Today the https-only `onAuth` check is the only guard, and it goes away |
| Leftover recognition | `clone-key.ts:118-132` `originMatchesSource` + WHATWG `URL.canParse` | Needs a scp-aware normalizer. Otherwise every SSH clone is refused as `StaleSourceCloneError` on re-add (`add.ts:1697-1703`) |
| Host for credentials and messages | `auth-host.ts:95-101` `hostFromCloneUrl` → `new URL(gitHubWireUrl(cloneUrl)).host` | Throws on scp form. It goes away with the bundles, or is rewritten for messages only |
| Path-source origin | `clone-cache.ts:607-675` `readOriginRemoteUrl` + `parsePluginSource(origin)` | A user's path-source checkout with an SSH origin (common) now yields a seedable URL. It was silently unseedable before |
| `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (D-MF-01) | read only by `shared/github-base-url.ts:16,37` (`readGitHubBase`). Production consumers: `platform/git.ts:13,549,581,623` (`gitHubWireUrl`), `auth-host.ts:46,96-101,233,269` (`gitHubOverrideHost`, `gitHubWireUrl`), `shared/git-failure-classifiers.ts` (2 sites). Harness: `features/support/pi-process.ts:155`, `features/lib/pi-rpc.ts:58,207-208`, `features/support/world.ts:691,1259` | Option A (recommended for the transport swap): keep the variable and translate it to `-c url.<base>/.insteadOf=https://github.com/` on every git command. git then records the canonical origin itself, the `setConfig` at `git.ts:600` goes away, and the upstream rule "a URL rewrite in git config skips the SSH probe" treats this rewrite like the user's own. Option B (parity, later phase): retire D-MF-01 and have the harness write `url.<host>.insteadOf` into the sandbox `GIT_CONFIG_GLOBAL`. That removes a non-upstream variable and the GHB-02 special case in `buildGitHubAuth` |

## Test doubles and harness (question 4)

| Asset | Today | What system git needs |
|-------|-------|-----------------------|
| `test/platform/git-ops-fake.ts` (268 lines) | An in-memory `GitOps` fake. It records `auth` per call (`:29-55`) and fabricates `NotFoundError` by name (`:76-80`) | Drop the `auth` fields from the call records. Throw the new typed errors. Keep the `boundary: "memory"` contract |
| `test/platform/git-test-repository.ts` (126 lines) | Builds repositories **with isomorphic-git** (`:6`, `git.init` at `:58`, in-memory packfiles at `:119`) | Rewrite on system git with the hermetic env pattern of `features/lib/hermetic-git.ts:17-41` (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, a scratch HOME). Three files use it. `pack()` has no system-git twin (use a bare repository plus `file://` or the HTTPS host instead) |
| `test/platform/git.test.ts` (2,977 lines) | Contract tests of the custom redirect client and the isomorphic-git wrappers | Mostly deleted (the redirect, cross-origin, and challenge rules). It is replaced by argv and env contract tests against an injected runner, plus a thin real-git suite over a `file://` bare repository |
| 37 test and feature files import `isomorphic-git` | `test/edge/**`, `test/orchestrators/**`, `test/integration/path-source-tag-install.test.ts`, `features/lib/github-device-flow/extension.ts`, `features/marketplace/device-flow.feature` | Each must move off before the dependency is removed from `package.json` |
| `test/architecture/hermetic-git-environment.test.ts` (276 lines) | Proves `hermeticGitEnvironment` returns exactly its **eight** keys (`:66-70`), and that `rpcChildEnvironment` passes only the run's `NODE_EXTRA_CA_CERTS`, `GIT_CONFIG_*`, and GitHub base to Pi, never the shell's (`INHERITED_VARIABLES` `:25-40`) | Add `GIT_SSL_CAINFO` (or `http.sslCAInfo`) to `RpcGitEnvironment` and its assertions. Add the SSH-probe skip (`CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` or an insteadOf rewrite) so a CI runner with an SSH key never reaches github.com. Assert that `GIT_ASKPASS` and `SSH_ASKPASS` from the shell do not reach Pi (they are already in `INHERITED_VARIABLES`) |
| `test/integration/auth-e2e.test.ts` (462 lines) | Real isomorphic-git `clone` (`:38`), `isomorphic-git/http/node` (`:28`), `buildAuthCallbacks` + `initiateDeviceFlow` composition, and AUTH-01/02/07 | Without Device Flow, it reduces to "a real system-git clone of a credential-armed repository succeeds with a stored helper credential and fails `{authentication required}` without one" |
| Cucumber HTTPS git host `features/lib/https-git-host/server.ts` (662 lines) + `cgi.ts` (167 lines) | Loopback `node:https` with a fresh P-256 cert for `IP:127.0.0.1` (`server.ts:37-56`). It serves bare repositories through **`git http-backend`** CGI with `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL`, and `GIT_PROTOCOL` passthrough (`cgi.ts:36-60`). Arms: status, drop, hold, credential (401), redirect (`server.ts:64-77`). Pi trusts it via `NODE_EXTRA_CA_CERTS` (`features/support/pi-process.ts:151-156`) | **The smart-HTTP server is already right for system git.** Missing: (1) **CA trust.** `NODE_EXTRA_CA_CERTS` does not reach git's libcurl. Set `GIT_SSL_CAINFO=<cert.pem>` in `RpcGitEnvironment`, which avoids writing the global config (DRV-03 requires it to be absent until a scenario writes it, `pi-process.ts:150`). (2) **Request baselines.** System git protocol v2 sends `GET info/refs`, `POST git-upload-pack` (ls-refs), `POST git-upload-pack` (fetch), where isomorphic-git sent two requests. A 401 arm adds a retry. 79 `the git host receives these requests` tables across 20 feature files must be re-baselined (`features/marketplace/github-source.feature:20-23` is the two-row form). (3) **SHA wants.** Shallow `fetch --depth 1 origin <sha>` needs the bare repositories to allow reachable-SHA wants (`uploadpack.allowReachableSHA1InWant`, or check the protocol v2 default in the stand-in). Verify this in the phase |
| GitHub redirect stand-in `features/lib/github-device-flow/extension.ts` | Patches `node:https` and `globalThis.fetch` **inside Pi's process** to route `github.com` to the stand-ins (`:1-26`) | **It cannot see a git subprocess.** A scenario that runs Pi without the base override (D-BG-01) and clones `github.com` would reach the real network. Replace git routing with `url.https://127.0.0.1:<port>/.insteadOf=https://github.com/` in the sandbox global config. Keep the in-process patch only for Device Flow `fetch`, if Device Flow survives |
| Credential steps `features/step_definitions/git-host.steps.ts:75-79,204-212` | Write `credential.helper = store` and `~/.git-credentials` in the sandbox HOME. Today's real `git credential fill` reads them | **They already work for system git unchanged.** This is the strongest existing evidence that the harness is near-ready |
| e2e (`test/e2e`, pinned and nightly) | Clones real upstream repositories over isomorphic-git | Needs `git` on the runner (GitHub-hosted runners have it). Set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` so the SSH probe is deterministic in CI. This sandbox has no `ssh` binary (`ssh: command not found`), so the probe path must also handle ENOENT |

## Rule-pack and ESLint entries that must change (question 5)

| Gate | Location | Change |
|------|----------|--------|
| `isomorphic-git-chokepoint` | `rule-packs/architecture.json:103-109` | Turn it into a total ban (empty `exclude`) with a message citing the new decision that reverses D-21. Or delete it together with the dependency. A total ban keeps a re-add from landing silently |
| `child-process-chokepoint` | `rule-packs/architecture.json:110-123` | Add `platform/git-process.ts`. Remove `platform/git-credential.ts` if Device Flow goes. Rewrite the message ("five sanctioned spawn sites") |
| `SHELL_OUT_EXEMPT_TARGETS` + no-shell-out test | `test/architecture/gate-targets.ts:221-227`; `test/architecture/no-shell-out.test.ts:140-224` (literal "exactly five files", the D-21 supersession message at `:196`) | Same set as the rule pack, in the same commit. The `:196` text that says isomorphic-git supersedes MA-7 must be rewritten |
| `no-network-modules` message | `rule-packs/architecture.json` (the message names `platform/git.ts` as the git traffic path) | Message only. It now says that git traffic goes through `platform/git-process.ts` subprocesses |
| `fetch-chokepoint` | `rule-packs/architecture.json:165-175` | Drop the `domain/github-auth.ts` exemption if Device Flow goes |
| ESLint `NETWORK_SEAMS` | `eslint.config.js:53-90` | Remove `domain/auth-registry.ts` and `domain/github-auth.ts` (listed only for the `GitCredentials` type import) and `orchestrators/auth-host.ts` when deleted. Remove `install-cascade.ts`, `update-constraint-gate.ts`, and the type-only half of `update-preflight.ts` once `RemoteTag` moves to `shared/` |
| ESLint BLOCK F regex | `eslint.config.js:574-583` (`regex: "platform/git"`), `:98-117` selectors | The regex already matches `platform/git-process.ts`, which is what we want: a network-free module cannot reach the spawn site. No change |
| BLOCK C zone for the runner | `eslint.config.js` (pattern of `PACKAGE_INSTALL_SEAM`, `:35-36`) | Add a zone: only `platform/git.ts` may import `platform/git-process.ts`, the same shape as the package-manager zone |
| `CREDENTIAL_LEAK_TARGETS` | `test/architecture/gate-targets.ts:152-171` | Remove deleted files and add `platform/git-process.ts` (stderr redaction, environment). **Positional bindings:** the comments at `:164-167` warn that `no-credential-leak.test.ts` binds entries by position, so edit both files together |
| `MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS` test | `test/architecture/marketplace-tag-probe-offline.test.ts:65-76` | Update it if `listTags` and `resolveTagOid` merge into one local-tag verb |
| `.fallowrc.json` | `production.deadCode` with the single entry `index.ts` | A new module that is not yet reachable fails `fallow dead-code`. Land each new module together with its first consumer, or use the per-file `ignoreExports` entry that CONVENTIONS prescribes for frozen exports. Never put a `fallow-ignore` marker in such a module |
| Constraint text | `AGENTS.md` NFR-5, NFR-10; `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS}.md` | **NFR-10 amendment:** git writes outside the containment roots for us: a store helper's `~/.git-credentials` on `approve`, and `known_hosts` if ssh `accept-new` were allowed. Record that writes git makes through the user's own configuration are outside NFR-10. Upstream requires the host to be in `known_hosts` already, so `StrictHostKeyChecking=yes` avoids the second write |

## Architectural Patterns

### Pattern 1: Injected git runner (mirror of `platform/package-manager.ts`)

**What:** `createGitRunner({ spawn, timeoutMs, killGraceMs, env, host })` returns `run(argv, { cwd, network: boolean }) → { stdout }` or throws `GitCommandError`. `NODE_GIT_SPAWN` is the production launcher. `platform/git.ts` takes the runner as a defaulted parameter.
**When to use:** for every git and ssh invocation.
**Trade-offs:** it doubles the code of the package-manager runner. Extract the shared kill-tree and Windows lookup into a pure helper (`platform/windows-command.ts`), or `fallow dupes` fails.

```typescript
// platform/git.ts (sketch)
export async function resolveRef(opts: ResolveRefOptions, git: GitRunner = DEFAULT_GIT): Promise<string> {
  const { stdout, exitCode } = await git.run(
    ["rev-parse", "--verify", "--quiet", `${opts.ref}^{commit}`],
    { cwd: opts.dir, network: false, allowExit: [1] },
  );
  if (exitCode === 1) {
    throw new GitRefNotFoundError(opts.ref);
  }
  return stdout.trim();
}
```

### Pattern 2: One environment and flag builder for every git command

**What:** a pure function returns `{ env, prefixArgs }`. `env` is `process.env` plus `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` (moved from `git-credential.ts:148-160`). It also sets an empty askpass (`GIT_ASKPASS`, `SSH_ASKPASS`, `-c core.askPass=`), because upstream does not run askpass, and `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when the user set neither `GIT_SSH_COMMAND` nor `GIT_SSH`. `prefixArgs` is `-c core.hooksPath=/dev/null` (or a platform-neutral empty dir), `-c core.fsmonitor=false`, `-c protocol.file.allow=user`, the GHB-01 `insteadOf` when option A applies, and `GIT_LFS_SKIP_SMUDGE=1`, because upstream "never downloads LFS content".
**When to use:** for every spawn. Local and network commands get the same hardening, because a copied `.git` carries foreign config.
**Trade-offs:** `-c` overrides beat the user's repository config, which is the intent. The user's *global* credential and ssh settings still apply, which is the point of the milestone.

### Pattern 3: Transport candidates resolved in the platform, identity fixed in the domain

**What:** `domain/clone-key.ts` keeps `canonicalCloneUrl` as the identity. A new `cloneTransports(source)` returns `[{ url: ssh }, { url: https }]` for github and `[{ url: verbatim }]` otherwise. `platform/git.ts` walks the list with the probe rules and returns the URL it used, so `FetchedUrlCause` (or its successor) can name it.
**When to use:** in clone, `ls-remote` (resolveRemoteRef and listRemoteTags), and the first fetch of an existing clone. Later fetches use the recorded origin.
**Trade-offs:** an SSH clone records `git@github.com:o/r.git` as its origin. The leftover recognizer and `readOriginRemoteUrl` must fold that back to the github identity. Otherwise the identity contract breaks.

## Data Flow

### Install of a git-source plugin (cold cache), after the milestone

```
edge install → install-flow → install-outcome (no auth bundle built)
   → clone-cache.resolvePluginPin
        → GitOps.resolveRemoteRef(networkTransports)
            → platform/git.ts: probe? → git ls-remote --symref <ssh|https> HEAD
                → git-process: spawn(git, env+flags, signal) → stdout | GitCommandError(kind)
   → clone-cache.materializePluginClone
        → GitOps.clone(depth 1, --branch ref) → GitOps.fetch(--depth 1 origin <sha>)
          → GitOps.checkout(--detach <sha>)   [fallback: fetch --unshallow]
        → rename staging → plugin-clones/<key>   (unchanged, NFR-1)
   failure → shared/git-failure-classifiers (kind → closed reason token)
           → notify (stderr redacted, IL-2)
```

What leaves the flow: `buildCloneAuth` → `GitAuthBundle` → `buildAuthCallbacks` → isomorphic `onAuth` → `credentialOps.fill` → Device Flow → `credentialOps.approve`. git's own helper invocation replaces that whole chain.

### Key Data Flows

1. **Marketplace refresh (D-14):** `refreshGitHubClone` keeps its fetch → resolve → update-ref → checkout shape. For a tag or pinned ref, fetch with `--force` and resolve `FETCH_HEAD`, because `git fetch origin <tag>` does not move an existing local tag. isomorphic-git's resolve of `refs/remotes/origin/<tag>` failed and fell back to the stale local tag, which hid this.
2. **Background pass abort (D-PL8-24):** `background-pass.ts:197` → `runWithAbortSignal` → AsyncLocalStorage → `git-process` reads the store and spawns detached. On abort it sends SIGTERM to the group, SIGKILL after the grace, and rejects with `signal.reason`. The "cut-short ref list read as success" guard (`git.ts:507-532`) is no longer needed: a killed `ls-remote` exits non-zero.
3. **Failure classification:** `GitCommandError.kind` is derived from stderr patterns (`Authentication failed`, `could not read Username`, `terminal prompts disabled`, `Permission denied (publickey)`, `Host key verification failed`, `Repository not found`, `returned error: 404`, `Could not resolve host`, `Connection timed out`, `Remote branch … not found`, `couldn't find remote ref`) and from spawn `ENOENT`, which is the new "git not found on PATH" kind that D-21 originally avoided. `classifyGitFailure` maps a kind to the existing closed reason tokens.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| A few marketplaces | Process spawn cost (~5-20 ms per git command) is noise beside the network |
| Bulk import or apply over many plugins | One SSH probe per process, memoized. A shared `ls-remote` result per URL per command (today's `tagMemo` and `constraintTagMemo` already do this for tags) |
| Large plugin repositories | Shallow clones cut transfer. Upstream times clones out at 120 s ("git clone timed out after 120s", troubleshooting page, LOW). Mirror that timeout in the runner |

### Scaling Priorities

1. **First bottleneck:** a cold mirror copy falls back to a clone more often with shallow mirrors. Accept it, or fetch `--depth 1 <sha>` into the mirror before copying.
2. **Second bottleneck:** sequential `no-await-in-loop` git calls in the tag peel loop (`git.ts:837-866`). Replace them with one `for-each-ref`.

## Anti-Patterns

### Anti-Pattern 1: Passing a token on the git command line

**What people do:** `https://x-access-token:<token>@github.com/...` or `-c http.extraHeader=Authorization: ...` in argv.
**Why it's wrong:** any local user can read argv in `ps`. git also echoes the URL in stderr, which feeds the failure notification (AUTH-09, `no-credential-leak.test.ts`).
**Do this instead:** let the user's helper supply the token. If Device Flow survives, `approve` the token into the helper, or use `GIT_CONFIG_COUNT` env injection, and redact stderr regardless.

### Anti-Pattern 2: Running git in a copied or user-owned `.git` with its own config live

**What people do:** `cp -r .git` and then `git checkout` (`clone-cache.ts:283-292`, `:722`, `:976`).
**Why it's wrong:** a path-source marketplace's `.git/hooks/post-checkout` runs, and `core.fsmonitor` in its config runs an arbitrary command. isomorphic-git never ran either, so this is a new code-execution path.
**Do this instead:** add `-c core.hooksPath=<empty> -c core.fsmonitor=false` to every command. Consider `safe.directory` behavior for repositories owned by another user (git refuses them, and that refusal must classify cleanly).

### Anti-Pattern 3: Keeping isomorphic-git error names as the cross-tier contract

**What people do:** emit `err.name = "NotFoundError"` from the new transport to satisfy the old matchers.
**Why it's wrong:** CONVENTIONS forbid name discrimination, and the shim would outlive its reason.
**Do this instead:** real error classes in `shared/errors.ts`, with `instanceof` at the three matcher sites, in the swap phase.

### Anti-Pattern 4: Re-baselining cucumber request tables by hand without one canonical change

**What people do:** edit 79 tables one at a time as each scenario fails.
**Why it's wrong:** the swap and the shallow-clone change each alter the request sequence, so each table gets edited twice.
**Do this instead:** land shallow clone **in the same phase** as the transport swap, or freeze the request shape in a shared step ("the git host receives a clone of X") before the swap.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `git` binary (any host OS) | `spawn` with no shell, through `git-process.ts` | Floor version matters: `--ref-format` needs git 2.45 or later, and `remote.<n>.followRemoteHEAD` needs 2.48. This sandbox has 2.43.0. A missing binary is a new user-visible failure that needs its own reason token and remedy |
| `ssh` (probe only, plus git's own transport) | `ssh -T -o BatchMode=yes git@github.com` with a short timeout. Exit 1 plus "successfully authenticated" means success | ENOENT (no ssh) means the probe failed, so use HTTPS |
| User git config (helpers, insteadOf, GIT_SSH_COMMAND) | Read implicitly by git. The probe-skip check reads `git config --get-regexp '^url\..*\.insteadof$'` | That read is itself a local git spawn |
| GitHub Device Flow endpoints | `fetch` in `domain/github-auth.ts` | Only if kept |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| orchestrators ↔ `platform/git.ts` | `GitOps` seam (DI) plus three direct tag imports | Remove the `auth` members. Keep the seam so `git-ops-fake.ts` keeps working |
| `platform/git.ts` ↔ `platform/git-process.ts` | Injected runner | Same zone (`platform`). An ESLint BLOCK C zone restricts the importer |
| `platform/*` ↔ `shared/*` | Error classes, classifier kinds, redaction, the github host literal | The platform zone may import only `shared` |
| `domain/clone-key.ts` ↔ `platform/git.ts` | Plain-string candidate list | Declare the candidate type in `shared/`, not in `domain/` |

## Suggested Build Order (each phase leaves `npm run check` green)

1. **Harness readiness (no product change).** Rewrite `test/platform/git-test-repository.ts` on system git with the hermetic env. Add `GIT_SSL_CAINFO` to `RpcGitEnvironment` (`features/lib/pi-rpc.ts:49-65`, `:203-214`; `features/support/pi-process.ts:151-156`), plus its `hermetic-git-environment.test.ts` assertions. Allow SHA wants in the stand-in's bare repositories. Move pure types (`RemoteTag`, `ListRemotesResult`) into `shared/` if desired. *Why first:* system-git fixtures work under the current product too, and every later phase needs them.
2. **Runner and typed errors.** Add `platform/git-process.ts` (env and flag builder, timeout, abort, group kill, redaction, Windows lookup extracted from `package-manager.ts`). Add the `GitCommandError` family and the stderr-kind classifier to `shared/`. Update the child-process allow-list in all three places (rule pack, `gate-targets.ts`, `no-shell-out.test.ts`) and add a BLOCK C zone. The runner has no production consumer yet: wire it into `listRemotes` or `currentBranch` in this phase (a local read, no network) so `fallow dead-code` stays green with no `ignoreExports` entry.
3. **Transport swap behind an unchanged `GitOps` (keep auth as retry).** Reimplement every `platform/git.ts` verb on the runner. Switch the three name matchers to `instanceof`. Implement GHB-01 as `-c insteadOf`. Keep the `auth?` parameters and implement a `device-flow` bundle as a retry after an `auth`-classified failure, which `approve`s into the helper. The device-flow scenarios already configure `credential.helper = store`, so they stay green. Delete the HTTP client and `git-auth-callbacks.ts`. Re-baseline the cucumber request tables. Land shallow clone, `--depth 1` SHA fetch, and the `--unshallow` fallback **here**, so the tables change once. This is the riskiest phase: it needs a research flag.
4. **URL forms and transport selection.** `source.ts` accepts scp and `ssh://`. Add scp-aware identity in `clone-key.ts` and the leftover recognizer. Add the SSH probe, HTTPS fallback, SSH retry, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, and the probe skip. Each user-visible change needs a cucumber scenario (AGENTS.md "Behavioral tests"). Add the CI or e2e determinism variable.
5. **Auth surface decision applied.** Without Device Flow, delete `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, the `auth-host.ts` builders, and the `credentialOps`/`deviceFlowHttp`/`authMemo` threading (23 files), plus the device-flow feature and stand-in. Prune NETWORK_SEAMS, `fetch-chokepoint`, `CREDENTIAL_LEAK_TARGETS` (positional), and the error classes. Rewrite the AAP-02, D-3-04, and D-PL8-12 rule text as "git is non-interactive".
6. **Failure-message parity and redaction.** Map kinds to Claude Code's wording and remedies (for example "SSH not configured, cloning via HTTPS", missing-git remedy) with the closed reason tokens. Add the stderr redaction tests.
7. **Submodules, LFS skip, migration, and cleanup.** Add `--recurse-submodules` to clone and the submodule update after a copy checkout. Set `GIT_LFS_SKIP_SMUDGE`. Existing full isomorphic-git clones need no migration, because system git reads them. Stored Device Flow tokens keep working over HTTPS. Remove `isomorphic-git` from `package.json` after the last of the 37 test importers is gone. Turn the rule-pack entry into a total ban. Update `.planning/codebase/*.md`, `README.md`, and `README.es.md`, and record the decision that reverses D-21, plus the NFR-5, NFR-10, and D-MF-01 amendments.

**Ordering rationale:** fixtures before transport, because tests must run against real git before the product does. Runner before transport, because the allow-list change is isolated and reviewable. The swap keeps the `GitOps` and auth shapes, so the blast radius is `platform/` plus tests and the 23-file auth cleanup stays separate. URL forms come after the swap, because isomorphic-git has no SSH transport and cannot test them. The Device Flow decision lands last among behavior changes, because the retry shim keeps phases 3 and 4 green whichever way discuss decides.

## Sources

- Codebase (HIGH): `extensions/pi-claude-marketplace/platform/git.ts`, `platform/git-auth-callbacks.ts`, `platform/git-credential.ts`, `platform/package-manager.ts`, `orchestrators/marketplace/{shared,add,update}.ts`, `orchestrators/plugin/{clone-cache,git-source-probe,update-flow,update-preflight,dependency-tag-probe,marketplace-tag-probe}.ts`, `orchestrators/auth-host.ts`, `domain/{source,clone-key,auth-registry,github-auth}.ts`, `shared/{github-base-url,git-failure-classifiers,errors}.ts`, `eslint.config.js`, `rule-packs/architecture.json`, `test/architecture/{gate-targets,no-shell-out.test,hermetic-git-environment.test,marketplace-tag-probe-offline.test}.ts`, `test/platform/{git-ops-fake,git-test-repository}.ts`, `test/integration/auth-e2e.test.ts`, `features/lib/https-git-host/{server,cgi}.ts`, `features/lib/hermetic-git.ts`, `features/lib/pi-rpc.ts`, `features/support/pi-process.ts`, `features/lib/github-device-flow/extension.ts`, `features/step_definitions/git-host.steps.ts`
- Upstream (LOW per the classify-confidence seam; re-verify against the Claude Code 2.1.330 binary): https://code.claude.com/docs/en/plugins/host-marketplace.md, sections "Grant access to a private marketplace", "What background auto-update does with credentials", and "Keep plugin files out of Git LFS"
- `.planning/PROJECT.md`, Current Milestone: system-git

---
*Architecture research for: system-git transport in pi-claude-marketplace*
*Researched: 2026-11-22*
