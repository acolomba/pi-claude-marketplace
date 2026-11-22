# Stack Research

**Domain:** Pi extension that clones and fetches Claude plugin marketplaces and git-source plugins (milestone system-git: replace `isomorphic-git` with the system `git` binary, reversing D-21)
**Researched:** 2026-11-22
**Confidence:** HIGH for codebase facts (read from the tree, cited file:line) and for Claude Code 2.1.330 behavior (read from the local binary `/opt/claude-code/bin/claude`, `strings` output, never executed for git work); HIGH for flags verified by running git 2.43.0 in the scratchpad against github.com; MEDIUM for git version-introduction facts (web sources cross-checked, git-scm.com was not reachable from this session); LOW only where marked.

## Bottom Line

1. **Add nothing to `package.json`.** The new transport is a thin own wrapper over `node:child_process.spawn` that runs `git` (and, for the SSH probe, `ssh`). Every hard part (no shell, async spawn, process-group kill, Windows absolute-PATH `.exe` resolution, stdout decoding) already exists in `platform/package-manager.ts` (D-PL9-15/18/19) and should be extracted and shared, not re-bought from npm.
2. **Remove `isomorphic-git` from `dependencies`** (`package.json:10`). Production imports it only in `platform/git.ts:5-6,18`. About 20 test files and `test/platform/git-test-repository.ts` use it as a fixture builder; rewrite those fixtures on the system git (preferred), or park it in `devDependencies` for one phase at most.
3. **Floor: git 2.25** (documented, not enforced by a version probe), which matches the floor Claude Code names. Every argv flag the milestone needs exists by 2.25. Anything newer (2.28 protocol-v2 default, 2.31 `GIT_CONFIG_COUNT`) is used only in forms that an older git silently ignores.
4. **Do not set `GIT_CONFIG_NOSYSTEM` or `GIT_CONFIG_GLOBAL` in production.** The milestone exists so the user's own git config works: credential helpers (Git for Windows keeps `credential.helper=manager` in the **system** gitconfig), `url.*.insteadOf`, `core.sshCommand`, `http.proxy`, and `http.sslCAInfo`. These variables stay test-only (`features/lib/hermetic-git.ts:21-22`).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| System `git` CLI | floor **2.25**; current upstream 2.56 (released ~2026-09-28; 2.98 planned for Dec 2026, then 3.0) | clone, fetch, ls-remote, local ref and config reads | This is what Claude Code runs (upstream parity, PROJECT.md Constraints). It brings SSH transport (issue #325) and the machine's credential helpers for free. Pi's own `pi install git:` also runs it (`node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js:1482-1489,1696`). |
| `node:child_process.spawn` | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` (unchanged) | start git with an argv array, `shell: false` | Async spawn is required: the state lock's refresh timer needs the event loop while git runs (the reason recorded at `platform/package-manager.ts:23-24`). `execFile` buffers to `maxBuffer` (1 MiB default) and kills git on overflow, and `ls-remote --tags` of a large repo can exceed that. `spawn` with streamed, capped capture avoids both problems. |
| Own wrapper: `platform/git.ts` (API) over one spawn module | new | the only git/ssh spawn site; same `GitOps` seam (`orchestrators/marketplace/shared.ts:167-236`) | It keeps D-13's chokepoint shape and the `child-process-chokepoint` rule. Orchestrators stay unchanged behind `DEFAULT_GIT_OPS`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | -- | -- | Every capability below is built on Node built-ins (`node:child_process`, `node:string_decoder`, `node:fs/promises`, `node:path`). |
| `isomorphic-git` | 1.44.10 locked (`package-lock.json:4015-4016`), latest 1.44.18 | test fixtures only, transitional | Only while the fixture rewrite is in flight. Move it to `devDependencies` in the same commit that removes the production import, then delete it. `fallow dead-code` reports an unused dependency, so it cannot linger after the tests stop using it. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| System git in CI | unit, integration, and cucumber suites | It is already required: the HTTPS stand-in runs `git http-backend` (`features/lib/https-git-host/cgi.ts:140`). The GitHub runner image's git (2.5x, exact version unverified) is newer than the floor. A floor-version CI leg (a container with git 2.25) is optional and worth having only if the roadmap commits to the floor publicly. |
| `GIT_SSL_CAINFO` in the hermetic test env | trust the stand-in's CA | isomorphic-git used Node TLS, so the harness passes `NODE_EXTRA_CA_CERTS` (`features/lib/pi-rpc.ts:204`). System git uses libcurl's CA store and ignores it. Add `GIT_SSL_CAINFO` (or `http.sslCAInfo` in a hermetic global config file) and update the key set that `test/architecture/hermetic-git-environment.test.ts` asserts. |

## Current isomorphic-git Surface and Its Exact system-git Equivalent

Production uses 13 isomorphic-git calls, all in `platform/git.ts`. Each one maps to a git command. "Neutral cwd" means a fresh empty temp dir with `GIT_CEILING_DIRECTORIES` set to its parent, so neither git discovery nor the repo config of the user's project leaks in. Claude Code runs `ls-remote` this way (`git -C <mkdtemp claude-lsremote-> ... ls-remote ... -- <url>`).

| `platform/git.ts` export (line) | isomorphic-git call | system git equivalent | Notes |
|---|---|---|---|
| `clone` (566) | `git.clone` full history, `singleBranch` when a ref is given; `setConfig remote.origin.url` after a rewritten wire URL (597-601) | `git <pin -c> clone --depth 1 [--branch <branch-or-tag>] [--recurse-submodules --shallow-submodules \| --no-recurse-submodules] [--no-checkout] -- <url> <dir>` | This changes behavior from full history to shallow, which is CC parity. `--branch` takes a branch or tag, never a SHA, so a SHA goes to the pin sequence below. CC validates the pin as `^([0-9a-f]{40}\|[0-9a-f]{64})$` and refuses a ref that starts with `-`. Replace the GHB-01 setConfig step with a per-command `-c url.<wire-base>.insteadOf=https://github.com/`: `remote.origin.url` then stays canonical with no rewrite step, and submodule URLs get the same base. |
| SHA pin (inside `clone-cache.ts:120-170`, now `clone` + `checkout` + refetch) | `checkout`, then a full `fetch` with `tags: true` on `CommitNotFetchedError` | `clone --depth 1 [--branch <hint>] --no-checkout` -> `fetch --upload-pack=git-upload-pack --depth 1 origin <sha>` -> on failure `fetch --upload-pack=git-upload-pack --unshallow [origin <hint>]` -> `checkout <sha>` -> `rev-parse HEAD` must equal the pin | This is CC's exact sequence (binary: `mCi`, plus `tLo` for the verification). Protocol v2 servers serve any want ("Wants can be anything and are not limited to advertised objects", gitprotocol-v2), so `uploadpack.allowReachableSHA1InWant` matters only for v0-only servers, which take the `--unshallow` fallback. Verified: `fetch --depth 1 origin <non-tip sha>` against github.com with git 2.43 succeeded. |
| `fetch` (612) | `git.getConfig remote.<r>.url` + `git.fetch` with an explicit wire `url` (624-631), `tags` option | `git -C <dir> <pin -c> fetch [--depth 1] [--tags \| --no-tags] origin [<ref>]` | `insteadOf` replaces the explicit wire URL. **Behavior gap:** isomorphic-git's fetch may refresh `refs/remotes/origin/HEAD`, but `git fetch` never does. The D-14 default-branch path (`shared.ts:257-263`) reads `refs/remotes/origin/HEAD`, so use `git ls-remote --symref origin HEAD` or `git remote set-head origin -a` (Pi's choice, `package-manager.js:1435`). Verify the current isomorphic-git behavior in the phase. |
| `checkout` (641) | `git.checkout` (`noCheckout`) | `git -C <dir> -c advice.detachedHead=false checkout --quiet <ref>`; for `noCheckout`, `git update-ref --no-deref HEAD <sha>` or `symbolic-ref HEAD refs/heads/<b>` | `GitOps.checkout` passes `force?` (`shared.ts:187`), which the platform wrapper ignores today. Keep it ignored, or map it to `--force`, as a recorded decision. |
| `resolveRef` (650) | `git.resolveRef` (tag object for an annotated tag, no peel) | `git -C <dir> rev-parse --verify --quiet --end-of-options <ref>` | Exit 1 with empty stdout replaces `NotFoundError`. `isGitNotFoundError` (`shared.ts:253-255`) and the classifiers (`shared/git-failure-classifiers.ts:124-128`) must switch to a typed error that the wrapper throws. |
| `resolveRemoteRef` (687) | `listServerRefs` protocol v2, `symrefs`, `peelTags` | `git <pin -c> ls-remote --symref -- <url> HEAD`, or `ls-remote -- <url> refs/heads/<ref> refs/tags/<ref> refs/tags/<ref>^{}` | Pass **full** ref names: `ls-remote <url> main` matches tails, so it also matches `refs/heads/foo/main`. Prefer the `^{}` peeled line for annotated tags. Verified: `ls-remote --symref` prints `ref: refs/heads/master\tHEAD` (git 2.43). |
| `listRemoteTags` (758) | `listServerRefs` `prefix: "refs/tags/"`, `peelTags` | `git <pin -c> ls-remote --tags -- <url>` in a neutral cwd | Output is `<oid>\t<ref>` lines, plus `<ref>^{}` peel lines. Keep the existing "prefer peeled, drop the `^{}` duplicate" fold (771-772). Protocol v2 filters by ref prefix on the server. |
| `listTags` (792) | `git.listTags` | `git -C <dir> for-each-ref --format=%(refname:strip=2) refs/tags` | **Pitfall:** a `--depth 1` clone carries almost no tags, because with `--single-branch` it auto-follows only tags on fetched commits. The D-07-05 / TAGS-01 marketplace tag probe (`orchestrators/plugin/marketplace-tag-probe.ts:25,106`) reads tags from the marketplace clone, so it needs `fetch --depth 1 origin 'refs/tags/*:refs/tags/*'` or an `ls-remote --tags` of the marketplace origin. Flag for phase research. |
| `resolveTagOid` (834) | `resolveRef` + `readTag`/`readCommit` loop, bounded at 10 hops, with an object `cache` | `git -C <dir> rev-parse --verify --quiet refs/tags/<name>^{commit}` (one spawn, peels tag-of-tag chains, fails for blob/tree tags, which maps to `undefined`) | The `cache: object` option (`ResolveTagOidOptions`, 162-172) has no equivalent and is dropped. For many tags, one `for-each-ref --format='%(refname:strip=2) %(objectname) %(*objectname) %(*objecttype)' refs/tags` replaces N spawns (it peels one level, which covers real tags). |
| `forceUpdateRef` (879) | `git.writeRef force` | `git -C <dir> update-ref <ref> <sha>` | No old-value argument means force. `test/architecture/partial-vocabulary-guard.test.ts:512-533` names the isomorphic-git `writeRef` force semantics and must be updated. |
| `currentBranch` (902) | `git.currentBranch` | `git -C <dir> symbolic-ref --quiet --short HEAD` (exit 1 when detached -> `undefined`) | -- |
| `listRemotes` (946) | `fs.readFile .git/config` probe + `git.getConfigAll remote.origin.url` | keep the `readFile` probe for the `not-a-repo` / `permission-denied` / `unreadable` arms, then `git config --file <dir>/.git/config --get-all remote.origin.url` (exit 1 means `no-origin`) | `--file` reads that file only, with no discovery into a parent repo and no includes, which is today's semantics. It returns the raw stored URL with no `insteadOf` rewrite. |
| `runWithGitAbortSignal` (302) + the redirect-following HTTP client (207-477) | custom `HttpClient` over `isomorphic-git/http/node` -> `simple-get` | **Deleted.** Keep the `AsyncLocalStorage` scope API, and on abort kill git's process group | With system git, libcurl and git own redirects (`http.followRedirects=initial` by default) and the credential lookup for the redirected host. The DD-3 capability gap, `CrossOriginChallengeError`, and `TooManyRedirectsError` (`shared/errors.ts:584-586`) lose their cause. The interrupted-listing guard (`networkCall`, 514-532) becomes unnecessary, because a killed git exits non-zero and never returns a truncated list as a success. |
| `GitCredentials` type (980) | isomorphic-git `GitAuth` | none | It exists only for `onAuth`. `domain/auth-registry.ts:23` and `domain/github-auth.ts:50` import it. Its fate follows the Device Flow decision (open for discuss). |

## Flags, Environment, and the git Version Each Needs

The floor reasoning matters here. Older git rejects an unknown **argv flag** with a hard failure, but it silently ignores unknown **`-c` keys and env variables**. So only argv flags set the floor.

| Item | Introduced in git | Used for | Confidence |
|------|------|------|------|
| `clone --depth 1 --branch <tag>` | `--branch` accepts tags since 1.7.10 | shallow clone at a ref | HIGH (long-standing) |
| `--recurse-submodules --shallow-submodules` | `--shallow-submodules` 2.9 | CC parity for plugin clones | MEDIUM |
| `fetch --depth 1 origin <sha>` | any version; the server must allow it (v2: always; v0: `uploadpack.allowReachableSHA1InWant` / `allowAnySHA1InWant`) | SHA pins | HIGH (doc quote + run against GitHub) |
| `fetch --unshallow` | 1.8.3 | pin fallback | MEDIUM |
| `ls-remote --symref` | 2.8 | default-branch resolution | MEDIUM |
| `ls-remote --tags`, `^{}` peel lines | ancient | tag lists | HIGH (verified) |
| client protocol v2 by default | 2.26 (reverted in 2.27, default again in 2.28; LOW on the exact revert history) | server-side ref-prefix filtering, any-want fetch | MEDIUM |
| `-c protocol.version=2` explicit | 2.18 | to force v2 on 2.25-2.27 | MEDIUM |
| `--end-of-options` | 2.24 | stop option parsing before a user-supplied ref | MEDIUM |
| sparse-checkout cone mode | 2.25 (CC's own message: "Install git (version 2.25 or later for sparse-checkout cone mode)") | only if git-subdir adopts CC's `--filter=tree:0` sparse path | HIGH (from the binary) |
| `-c key=value` | ancient | per-command hardening | HIGH |
| `GIT_TERMINAL_PROMPT=0` | 2.3 | no username/password prompt | HIGH (verified: `fatal: could not read Username for 'https://github.com': terminal prompts disabled` in 0.18 s) |
| `GIT_ASKPASS=""` (empty, not unset) | prompt.c treats an empty value as "no askpass" and also skips the `core.askPass` / `SSH_ASKPASS` fallbacks | suppress GUI askpass | MEDIUM (source behavior from memory; CC sets exactly this) |
| `GCM_INTERACTIVE=never`, `credential.interactive=false` | Git Credential Manager settings, not git core | GCM returns no credential instead of opening a window | MEDIUM |
| `GIT_SSH_COMMAND` | 2.3; `core.sshCommand` 2.10. The env variable outranks the config key | BatchMode SSH | HIGH (git precedence) |
| `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` | 2.31 (commit d8d77153); older git ignores them | config that must not appear in argv (a token-bearing helper, if Device Flow survives) | MEDIUM |
| `GIT_CEILING_DIRECTORIES` | ancient | stop discovery from walking into the user's project repo | HIGH |
| `protocol.<name>.allow` | 2.12; default `protocol.file.allow=user` since 2.38.1 (CVE-2022-39253, distros backport it) | deny `ext`, `fd`, `git`, `ftp`, `ftps` | MEDIUM |
| `safe.directory` ownership check | 2.35.2 (CVE-2022-24765) | not used. Classify `detected dubious ownership` in stderr | MEDIUM |
| `init.defaultRefFormat=files`, `GIT_DEFAULT_REF_FORMAT=files` | reftable 2.45; the Git 3.0 BreakingChanges make reftable and SHA-256 the default for new repos | keep clones in the `files` ref format as long as any code reads `.git/` directly | HIGH (CC pins both: binary `en`/`Fe`) |
| `GIT_LFS_SKIP_SMUDGE=1` | git-lfs | a system `filter.lfs.required=true` (present on this machine's `/etc/gitconfig`) must not run LFS downloads during checkout | HIGH (CC sets it: binary `oft`) |
| `core.longpaths=true` | Git for Windows key, harmless elsewhere | plugin trees under `~/.pi/agent/pi-claude-marketplace/plugin-clones/<key>/` can pass MAX_PATH. Node fs handled long paths, so dropping isomorphic-git is a regression risk without it | HIGH (CC pins it: binary `tn`) |

### The Exact Invocation Shape to Copy (Claude Code 2.1.330, from the binary)

Every remote git command in CC is built the same way: base env, then pinned `-c` args, then the subcommand.

- **Environment** (`rn()` + `GJe()` + `nn()` + `aKe()` + `sLo()`):
  - Start from `process.env`.
  - Delete the repo-binding variables `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE`, `GIT_CEILING_DIRECTORIES`, `GIT_DISCOVERY_ACROSS_FILESYSTEM`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_SHALLOW_FILE`, `GIT_NAMESPACE`, `GIT_IMPLICIT_WORK_TREE`, and `GIT_REFERENCE_BACKEND`. These matter when Pi runs inside a git hook or under a user-set `GIT_DIR`.
  - Add `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, and `GCM_INTERACTIVE=never`.
  - Append `credential.interactive=false` through `GIT_CONFIG_COUNT`, offset by any count the user already set.
  - Set `GIT_LFS_SKIP_SMUDGE=1` and `GIT_DEFAULT_REF_FORMAT=files`.
  - Pin `GIT_SSH_VARIANT` from the user's `ssh.variant`.
  - Set `GIT_CEILING_DIRECTORIES=<parent of target>`.
  - Clear `LC_ALL`, keep its value as `LC_CTYPE`, and set `LC_MESSAGES=C`, so stderr is English and parseable for classification.
- **Pinned args:**
  - `-c core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes` (binary `fxt`).
  - `-c protocol.ext.allow=never -c protocol.fd.allow=never -c protocol.git.allow=never -c protocol.ftp.allow=never -c protocol.ftps.allow=never`. A user `GIT_ALLOW_PROTOCOL` is unset and translated into `protocol.<x>.allow=never` for the excluded members of https/http/ssh/file.
  - `-c init.defaultRefFormat=files -c core.longpaths=true`.
- **The user's ssh command is preserved:** before the clone, CC reads the user's `core.sshCommand` / `ssh.variant` (`git config --get-regexp '^(core\.sshcommand|ssh\.variant)$'` under a private temp dir) and rebuilds the pinned `core.sshCommand` from them with BatchMode appended (`-batch` for plink). A user `GIT_SSH_COMMAND` already outranks the `-c`. A plain `-c core.sshCommand=ssh ...` would silently drop a user's `ssh -i key` or 1Password agent setting, so treat this read as a parity requirement, not polish.
- **Spawn:** `stdin: "ignore"`, `-- <url> <dir>` always, and a per-command timeout. Marketplace clones default to **120 000 ms**, overridable by `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and capped (`Wto()`, `pbi=120000`). On timeout, the error text names `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`. Some calls run `withoutControllingTerminal`.
- **SSH probe:** CC spawns **`ssh`**, not git: `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` with a 3000 ms timeout (`DCn`). The chokepoint allow-list must therefore admit an `ssh` launch, or the probe must be re-expressed as `git ls-remote git@github.com:...`. Decide in discuss, because the two differ in what they prove.
- **Stderr classification strings seen in the binary:** `Permission denied (publickey)`, `Could not read from remote repository`, `Host key verification failed`, `couldn't find remote ref`, and `terminal prompts disabled`. Also check git's own `Repository not found`, `The requested URL returned error: <code>`, `Could not resolve host`, `Server does not allow request for unadvertised object`, `not our ref`, and `detected dubious ownership`. On macOS, CC has a branch for the `/usr/bin/git` stub without Command Line Tools: "git is not installed on this Mac. To install it, run xcode-select --install" (`U0r`/`kft`, stubbed out in this Linux build).

### Spawning git From Node 22/24 Safely

Reuse and generalize `platform/package-manager.ts`. Do not write a third launcher.

| Concern | Recommendation | Why |
|---|---|---|
| Shell | `shell: false`, an argv array, and `--` before every user-derived positional (URL, dir). Refuse refs that start with `-`. Use `--end-of-options` where a ref follows options | Option injection (`--upload-pack=...`) is the RCE class behind simple-git's three CVEs. CC does both. |
| URL scheme | Allowlist `https://`, `ssh://`, and scp-like `git@host:path` before spawning. Reject `<transport>::<address>` (remote-helper syntax: `ext::`, `fd::`, or any installed `git-remote-<x>`) and `file://` for remote sources | Marketplace manifests are untrusted input, and submodule URLs are too. `protocol.*.allow` is the second line of defense. |
| Windows binary resolution | Resolve `git.exe` only from the **absolute** entries of `PATH`, as `package-manager.ts` does for npm (D-PL9-18, lines 26-31, 386-433). Never pass a bare `git` on Windows | libuv and cmd.exe search the **current directory first**, so a repo that commits `git.exe` gets it run (GHSA-3fgc-wc43-9q2f; gitoxide CVE-2024-40644). Git for Windows ships `cmd\git.exe`, a real `.exe`, so no `.cmd` handling is needed. |
| `cross-spawn` | Do not use it, even though Pi does (`dist/utils/child-process.js`, cross-spawn 7.0.6 on win32) | It exists for `.cmd` shims and shebangs, which git does not need. Its `which` lookup prepends the cwd on Windows (LOW: from memory of node-which v2). |
| stdio | `["ignore", "pipe", "pipe"]` | A closed stdin means no prompt can block on it. CC uses `stdin: "ignore"`. |
| Controlling terminal / process tree | `detached: process.platform !== "win32"` (setsid: new session and group), `windowsHide: true` | With no controlling tty, ssh and helpers cannot open `/dev/tty` to prompt. The group lets a timeout or abort kill `git` + `git-remote-https` + `ssh` together. This is the D-PL9-19 logic at `package-manager.ts:13-19,348-371`, plus `taskkill /T /F` on Windows. |
| Timeout / abort | Own timer plus the `runWithGitAbortSignal` scope -> SIGTERM the group, then SIGKILL after a grace period. Settle even if `close` never fires (grace as in D-PL9-12). Do **not** rely on spawn's `timeout` option | spawn's `timeout` and `signal` kill only the direct child, and a grandchild holding the pipes keeps `close` from firing (Pi documents the same problem: earendil-works/pi#5303). |
| Output | Stream stdout through `StringDecoder("utf8")` with a byte cap. Keep a tail of stderr for classification. Never `execFile`'s `maxBuffer` | See the Core Technologies row. |
| Env construction | Build a fresh object. Read variables case-insensitively on Windows (`Path` vs `PATH`; `package-manager.ts` already has a `variable(env, name)` helper at 386-391) | A spread of `process.env` loses Windows' case-insensitivity. CC's `tA()` handles this case. |
| cwd | Remote commands without a repo (`ls-remote`) run in a neutral temp dir. Repo commands use `-C <dir>` **and** `GIT_CEILING_DIRECTORIES=<parent>` | A half-written clone dir with no `.git` would otherwise make `git -C dir rev-parse` answer for the user's project repo, because `.pi/` usually sits inside one. |
| Secrets | Never put a token in argv (`ps` shows it). If Device Flow survives, pass the token in an env variable and point an inline helper at it through `GIT_CONFIG_COUNT`: `credential.<url>.helper=!f() { test "$1" = get && printf 'username=x\npassword=%s\n' "$TOKEN"; }; f`, which is the form seen in CC's binary | `!` helpers run through `sh`, which Git for Windows bundles. |
| Stderr in messages | Redact URL userinfo (`https://user:token@host`) and absolute paths (`shared/redact-absolute-paths.ts`) before notify | CC labels every git failure "(stderr redacted)". |

## Can isomorphic-git Be Removed Entirely?

**Yes for production; tests need work.** What depends on it:

| Dependent | File:line | Action |
|---|---|---|
| Production transport | `platform/git.ts:5-6,18` | Replace (table above). |
| Error duck-typing on `HttpError`, `UserCanceledError`, `NotFoundError` | `shared/git-failure-classifiers.ts:13-128`, `orchestrators/marketplace/shared.ts:244-255`, `shared/errors.ts:584-586,630-646` | Rewrite on exit code + `LC_MESSAGES=C` stderr. A hosted-manifest `HttpError` shape (`errors.ts:630-646`) may still be wanted for `platform/hosted-manifest-fetch.ts`, so check before deleting. |
| isomorphic-git `onAuth` callbacks | `platform/git-auth-callbacks.ts` (whole file) | Dead if Device Flow goes; otherwise replaced by the helper-in-env form above. `platform/git-credential.ts` (`git credential fill/approve/reject`) existed to feed `onAuth`. Fold its env into the shared git env builder, or delete it with Device Flow. |
| Fallow rule `isomorphic-git-chokepoint` | `rule-packs/architecture.json:103-109` | Re-point as a ban with no exemption, or delete it. Its `files` glob still matches, so it will not trip the WARN-fails gate either way. |
| Fallow rule `child-process-chokepoint` + `test/architecture/no-shell-out.test.ts` | `rule-packs/architecture.json:111-123`; `no-shell-out.test.ts:62,196` (the D-21 message text) | Add the new git spawn module (and `ssh` if the probe spawns it). Rewrite the D-21 wording to the new decision ID. |
| Test fixture builders (`init`/`add`/`commit`/`tag`/`addRemote`/packfile) | `test/platform/git-test-repository.ts:6,119`; `test/orchestrators/plugin/warm-mirror-seed.ts:10`; about 15 more `test/orchestrators/**` and `test/integration/**` files | Rewrite on the system git through the existing helper (`createGitTestRepository`), so tests exercise the binary that production runs. The fake-transport tests that stub `isomorphic-git/http/node` (`test/orchestrators/plugin/update-flow.test.ts:20-21,105,9354-9580`; `test/integration/auth-e2e.test.ts:29,55`) lose their subject. Their behavior moves to the HTTPS stand-in or to `GitOps` fakes. |
| Wire-counting comments | about 12 `test/edge/**` files ("`isomorphic-git/http/node` reaches the wire through `simple-get`") | The NFR-5 "no network" assertions need a new probe point: count git spawns through the injected launcher instead of `simple-get` sockets. |
| Cucumber prose | `features/marketplace/device-flow.feature:5`, `features/lib/github-device-flow/extension.ts:12` | Follows the Device Flow decision. |

After removal, the lockfile loses `isomorphic-git` and its whole subtree: `simple-get`, `pako`, `sha.js`, `async-lock`, `diff3`, `crc-32`, `clean-git-ref`, `minimisted`, `pify`, `readable-stream`, and `ignore@5`, unless another package needs them. `npm ci` prunes them.

## Installation

```bash
# Production: nothing to add.
npm uninstall isomorphic-git        # once no test imports it
# Transitional alternative for one phase only:
# npm uninstall isomorphic-git && npm install -D isomorphic-git@1.44.10
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Own thin wrapper on `spawn` | `simple-git` 4.1.0 (npm, modified 2026-11-16) | Never here. It has three RCE advisories from `ext::` + `-c`/`--config` injection (CVE-2022-25912 <3.15.0; CVE-2026-28292 case-bypass; CVE-2026-6951 fixed in 3.36.0). It spawns a bare `git`, so on Windows it hits the cwd lookup. Its English-only error parsing, task queue, and plugin system duplicate what the project already owns, and it cannot express CC's pinned env, process-group kill, or no-tty session. |
| Own wrapper | `execa` | Only if the project ever drops its own launcher. It is another dependency for features (`cleanup`, `forceKillAfterDelay`) that `package-manager.ts` already implements and tests. |
| System git only | Keep `isomorphic-git` as a fallback when git is missing | Only if discuss finds "git missing" common on target platforms (Windows without Git for Windows). The cost is two transports, two classifier sets, two auth paths (and the redirect client stays), and a doubled test matrix. CC has no fallback: it tells the user to install git. |
| System git | `dugite` (GitHub Desktop's bundled git) | Only to guarantee git exists. It downloads a per-platform git build (tens of MB) at install time, ignores the system git's user setup in subtle ways, and diverges from CC. Not recommended. |
| `ls-remote` for tag lists | Shallow-fetch all tags (`fetch --depth 1 origin 'refs/tags/*:refs/tags/*'`) | When a local tag probe (TAGS-01 marketplace clone) must stay network-free after `marketplace add`: fetch the tags once at add/update time. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `GIT_CONFIG_NOSYSTEM=1` / `GIT_CONFIG_GLOBAL=/dev/null` in production | They disable Git for Windows' system `credential.helper=manager`, the user's `insteadOf`, `core.sshCommand`, proxy, and CA settings: everything the milestone is for | Test harness only (`features/lib/hermetic-git.ts`) |
| `shell: true`, or a bare `git` on Windows | Injection, plus cwd-first `git.exe` lookup | `shell: false` + absolute-PATH `git.exe` resolution (D-PL9-18 code) |
| `spawnSync` / `execFileSync` | Blocks the event loop that the state-lock refresh timer needs | async `spawn` |
| `execFile` with the default `maxBuffer` | Kills git at 1 MiB of stdout (large `ls-remote --tags`) | streamed capture with an explicit cap |
| Plain `-c core.sshCommand=ssh -o BatchMode=yes ...` without reading the user's value | Silently overrides a configured `core.sshCommand` | CC's read-then-pin sequence |
| Reading `.git/refs/*` or `packed-refs` directly | Breaks on reftable repos (the Git 3.0 default for new repos) | `rev-parse` / `for-each-ref` / `symbolic-ref`, and pin `init.defaultRefFormat=files` like CC |
| `ls-remote <url> <short-name>` | Tail-matching returns `refs/heads/x/<name>` too | full ref names |
| `GIT_TRACE*` / `GIT_CURL_VERBOSE` inherited into classification | They flood stderr and confuse the classifiers (LOW: CC does not clear them) | consider deleting them in the env builder |

## Stack Patterns by Variant

**If Device Flow is removed (discuss):**
- Delete `platform/git-auth-callbacks.ts` and the `auth?` fields of `GitOps`; `platform/git-credential.ts` probably goes too.
- D-PL8-12 and the AAP no-Device-Flow rules become trivially true: the background pass simply runs git non-interactively.

**If Device Flow is kept:**
- Inject the stored token only through an env-backed inline `credential.<url>.helper`, set through `GIT_CONFIG_COUNT` (git >= 2.31; older git ignores it and falls back to the user's own helpers).
- Never put the token in argv or in a written config file.

**If `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (D-MF-01) is set:**
- Add `-c url.<base>/.insteadOf=https://github.com/` per command.
- CC's rule "skip the SSH probe when a URL rewrite exists in git config" must look at the **user's** config, not at this injected `-c`.

**On Windows:**
- Add `core.longpaths=true`.
- Skip the ssh-variant probe (CC does).
- Expect Git for Windows' bundled `usr\bin\ssh.exe`, unless the user's `core.sshCommand` names Windows OpenSSH.

**On macOS without Command Line Tools:**
- `/usr/bin/git` exists but fails with `xcrun: error: invalid active developer path`.
- Classify it as "git not installed" with the `xcode-select --install` hint (CC parity).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| git >= 2.25 | Ubuntu 22.04 (2.34.1), Debian 12 (2.39.x), RHEL 9 / 8.10 (2.43.x, MEDIUM), macOS CLT (Apple Git 2.39+), Git for Windows 2.5x | Ubuntu 20.04 ships exactly 2.25.1. Protocol v2 is not the default there, so pass `-c protocol.version=2` for prefix-filtered `ls-remote`. |
| Node 22.22.2+/24.15+ `spawn` | `signal` and `timeout` options exist, but neither kills the tree | Use the own group-kill. |
| git 3.0 (expected spring 2027) | SHA-256 and reftable default for **new** repos | Clones follow the remote's hash. Accept 64-hex pins (CC does). Pin `files` ref format. |
| `isomorphic-git` 1.44.x | -- | Removed. |

## Sources

- Codebase (HIGH): `extensions/pi-claude-marketplace/platform/git.ts`; `orchestrators/marketplace/shared.ts:167-255`; `orchestrators/plugin/clone-cache.ts:100-200`; `platform/package-manager.ts:1-40,348-433`; `platform/git-credential.ts:1-160`; `rule-packs/architecture.json:103-123`; `package.json:8-15`; `package-lock.json:4015-4039`; `features/lib/hermetic-git.ts`; `features/lib/pi-rpc.ts:195-210`; `features/lib/https-git-host/cgi.ts:140`.
- Pi 1.5.1 precedent (HIGH): `node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js:35,1425-1489,1685-1805,2295-2385`; `dist/utils/child-process.js` (cross-spawn on win32).
- Claude Code 2.1.330 binary (HIGH, `strings` of `/opt/claude-code/bin/claude`): functions `mCi` (plugin clone + SHA pin), `ZMo` (marketplace clone), `bNe` (ls-remote in a temp dir), `OF` (ssh settings read), `nn`/`rn`/`GJe`/`aKe`/`sLo` (env and pinned args), `zt`/`qt` (protocol denylist), `fxt`, `A8`, `oft`, `Wto`/`pbi` (120 s timeout), `DCn` (SSH probe), `kCi` (git-subdir, 2.25 floor message). Minified names change between builds; re-check them for the phase CONTEXT.md evidence records.
- Empirical (HIGH): git 2.43.0 in the scratchpad: non-interactive `ls-remote` failure text and timing; `ls-remote --symref`; `ls-remote --tags` peel lines; `clone --depth 1 --no-checkout` + `fetch --depth 1 origin <non-tip sha>` + `checkout` against github.com.
- Web (MEDIUM where cross-checked, else LOW): [gitprotocol-v2 (MIT mirror)](https://web.mit.edu/git/git-doc/gitprotocol-v2.html) ("Wants can be anything..."); [Git 2.31.0 release notes](https://www.kernel.org/pub/software/scm/git/docs/RelNotes/2.31.0.adoc) and [config envvar-pairs commit](https://googlers.googlesource.com/jrn/git/+/d8d77153eafdb0fc334e827976f09e4bdff26b58); [Highlights from Git 2.56](https://github.blog/open-source/git/highlights-from-git-2-56/) and [GitLab: What's new in Git 2.56.0](https://about.gitlab.com/blog/whats-new-in-git-2-56-0/); [Git BreakingChanges](https://git-scm.com/docs/BreakingChanges); [GHSA-3fgc-wc43-9q2f](https://www.wiz.io/vulnerability-database/cve/ghsa-3fgc-wc43-9q2f), [CVE-2024-40644](https://www.rapid7.com/db/vulnerabilities/cve-2024-40644/), [nodejs/node#52554](https://github.com/nodejs/node/issues/52554); [CVE-2022-25912](https://nvd.nist.gov/vuln/detail/CVE-2022-25912), [CVE-2026-28292](https://advisories.gitlab.com/npm/simple-git/CVE-2026-28292/), [CVE-2026-6951](https://osv.dev/vulnerability/CVE-2026-6951). npm registry (`npm view`): simple-git 4.1.0, isomorphic-git 1.44.18, cross-spawn 7.0.6.
- Not reachable: git-scm.com (DNS blocked in this session). The per-flag introduction versions marked MEDIUM come from memory plus secondary sources. Re-verify them against `Documentation/RelNotes/*` before they go into a requirement.

---
*Stack research for: system-git transport in pi-claude-marketplace*
*Researched: 2026-11-22*
