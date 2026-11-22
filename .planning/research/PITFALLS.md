# Pitfalls Research

**Domain:** Brownfield Pi extension. Milestone `system-git`: replace the `isomorphic-git` calls in `extensions/pi-claude-marketplace/platform/git.ts` with child processes of the system `git` binary. The new code clones and fetches marketplaces and git-source plugins as Claude Code does: an SSH probe with HTTPS fallback, `GIT_TERMINAL_PROMPT=0`, no askpass, credential helpers only, shallow clones, and SHA pins through fetch-by-sha with an `--unshallow` fallback. It must also keep NFR-1/2/3/5/10, IL-2, and `npm run check` green.
**Researched:** 2026-11-22
**Confidence:** HIGH for every item marked **[EXP]**. Each was reproduced in `/tmp/claude-0/sysgit/` with git 2.43.0, Node 24.22.3, and isomorphic-git 1.44.10 (the version in `node_modules`). The exact commands and outputs are in the Experiment log at the end. Items marked **[SRC]** come from reading this tree (`platform/git.ts`, `platform/git-credential.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/marketplace-tag-probe.ts`, `shared/git-failure-classifiers.ts`, `domain/version.ts`, `domain/auth-registry.ts`, `features/lib/hermetic-git.ts`, `features/lib/https-git-host/*`, `test/architecture/hermetic-git-environment.test.ts`). Items marked **[UP]** come from Claude Code's host-marketplace page (fetched 2026-11-22). The `classify-confidence` seam rates that fetch LOW, so each [UP] claim must be re-checked against the 2.1.330 binary with `.agents/skills/claude-code-compat-research` before it becomes a decision. Items marked **[MEM]** are from training knowledge and were not verified here (MEDIUM or LOW, as stated). Windows items were not run: no Windows host was available.

The phase labels below are proposals. The roadmapper may rename or renumber them.

| Label | Scope |
| --- | --- |
| **P-Spawn** | The one git process seam in `platform/`: binary resolution, the environment and `-c` override builder, stdio, timeouts, abort and kill, output capture and redaction, git presence and version detection, the `child-process-chokepoint` allow-list, the NFR-5 offline lane |
| **P-Transport** | `clone` / `fetch` / `ls-remote` / `checkout` / ref and tag reads on system git: shallow clones, `--branch`, SHA pins, `--unshallow`, submodules, the D-14 refresh, the PURL-04 refetch, the TAGS-01 local tag reads |
| **P-URL** | `owner/repo` URL selection: SSH probe, HTTPS fallback and SSH retry, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, skipping the probe under `GIT_SSH_COMMAND` / `GIT_SSH` / a URL rewrite, `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (D-MF-01 / GHB-01) |
| **P-Errors** | Failure classification and messages on git's stderr, redaction, the closed reason set (D-PL7-01) |
| **P-Auth** | What remains of Device Flow, the AAP no-Device-Flow rules, D-PL8-12 stored-credentials-only, and the keychain entries Device Flow left |
| **P-Migrate** | Clones that `isomorphic-git` wrote, and records that point at them |
| **P-Harness** | The cucumber HTTPS git host and its CA trust, `hermeticGitEnvironment`, `rpcChildEnvironment`, the hermetic test, and CI git |
| **P-Close** | `.planning/codebase/*.md`, `README.md`, `README.es.md`, CHANGELOG, the D-21 reversal record |

---

## Critical Pitfalls

### Pitfall 1: git or ssh prompts on Pi's terminal and hangs the TUI

**What goes wrong:**
A child git, ssh, or credential helper reads from the user's terminal while Pi's TUI holds it in raw mode. The user sees a garbled prompt, or nothing, and the command hangs. `GIT_TERMINAL_PROMPT=0` covers only git's own username and password prompt. These other prompts are outside it:
- ssh asks for a key passphrase or a host-key confirmation (`Are you sure you want to continue connecting`). ssh opens `/dev/tty` directly and does not read `GIT_TERMINAL_PROMPT`.
- `GIT_ASKPASS`, `core.askPass`, and `SSH_ASKPASS` start a GUI or TTY program. `platform/git-credential.ts` documents that its environment leaves these intact [SRC].
- A credential helper prompts on its own: GCM opens a browser or dialog, macOS `osxkeychain` shows a keychain-access dialog, `pass` opens a gpg pinentry, and `op` opens 1Password.
- A plain `spawn` keeps Pi's controlling terminal, so `stdin: "ignore"` does not stop a program that opens `/dev/tty`.

**Why it happens:**
Developers test from a shell with a loaded ssh-agent and a cached credential, so no prompt ever appears. They assume `GIT_TERMINAL_PROMPT=0` and `stdio: ["ignore", ...]` make git non-interactive. The cloud sandbox for this repository is non-interactive in a way that hides the problem: it has no TTY, and it already injects `credential.interactive=false` (see E-15).

**How to avoid:**
- **[UP]** Claude Code "leaves the user's git credential helper enabled but forbids it from prompting, and doesn't run askpass programs such as one set in `GIT_ASKPASS`". For SSH, "the key must work without a passphrase prompt … the host must already be in `known_hosts`." Match that contract on every git process:
  - `GIT_TERMINAL_PROMPT=0` (E-3: `fatal: could not read Username … terminal prompts disabled`).
  - `GIT_ASKPASS=` set to the empty string. **[MEM, MEDIUM]** git's `prompt.c` checks `GIT_ASKPASS`, then `core.askPass`, then `SSH_ASKPASS`, and does not run an empty value. Setting the empty string therefore also stops the other two. Verify this with a unit case against the real binary in P-Spawn.
  - `SSH_ASKPASS_REQUIRE=never` (OpenSSH 8.4 and later) and no inherited `DISPLAY`-driven askpass.
  - `GCM_INTERACTIVE=never`, which `git-credential.ts` already sets, plus `-c credential.interactive=false`. GCM reads both. This cloud sandbox uses the second one (E-15).
- On POSIX, spawn git with `detached: true` (`setsid`) so the child has no controlling terminal. Any program that opens `/dev/tty` then fails at once. E-3b shows the result with no TTY: `could not read Username …: No such device or address`, exit 128, no hang. This also makes ssh's host-key and passphrase prompts fail ("Host key verification failed") without overriding the user's `core.sshCommand`. Do NOT pass `detached: true` on Windows, because there it opens a new console window. Use `windowsHide: true` instead, and treat Windows ssh prompting as an open risk to test on a real host.
- Set `stdio: ["ignore", "pipe", "pipe"]` on every git process. Never use `inherit` (IL-2, see Pitfall 11).
- Give every network git a hard timeout that kills the process group. A GUI keychain dialog cannot be suppressed by any environment variable, so the timeout is the only bound. **[UP]** Claude Code reports `git clone timed out after 120s`. Re-check the value and whether it is configurable against the binary.
- Do NOT add `-o BatchMode=yes` through `GIT_SSH_COMMAND` or `-c core.sshCommand`. Either one replaces the user's own ssh command (a jump host, a `-i` key, 1Password's agent), and the milestone's probe-skip rule treats a set `GIT_SSH_COMMAND` as a signal of user intent. Keep BatchMode on the extension's own `ssh -T` probe only, if the binary shows that Claude Code probes that way.

**Warning signs:**
A cucumber run that passes in CI but hangs on a developer's laptop. A process listing that shows `ssh`, `git-credential-osxkeychain`, or `pinentry` children under Pi. A test that only passes when `HOME` holds an unlocked agent.

**Phase to address:** P-Spawn (environment and session handling). P-URL (the probe's own ssh flags). P-Harness (a scenario with an ssh remote whose host key is not in `known_hosts`, which must fail fast with a classified reason).

---

### Pitfall 2: the user's git configuration changes what the extension does

**What goes wrong:**
System git reads `/etc/gitconfig`, `~/.gitconfig`, `$XDG_CONFIG_HOME/git/config`, `includeIf` files, `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`, `GIT_CONFIG_PARAMETERS`, and the local config of any repository it discovers from its `cwd`. isomorphic-git read none of them. Settings that now take effect:

| Setting | Effect on this extension | Neutralize or respect |
| --- | --- | --- |
| `url.<base>.insteadOf` / `pushInsteadOf` | Rewrites the URL that is sent. **[EXP E-7, E-15]** In this cloud sandbox, `GIT_CONFIG_COUNT=3` rewrites `git@github.com:` and `ssh://git@github.com/` to `https://github.com/`. That survives `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`, so an SSH URL silently became HTTPS (E-9). | **Respect.** This is the upstream "probe skip under a URL rewrite" signal. Detect it with `git config --get-regexp '^url\..*\.insteadof$'` run with the same environment and `cwd` as the clone. |
| `core.sshCommand`, `GIT_SSH_COMMAND`, `GIT_SSH`, `ssh.variant` | Chooses the ssh binary and its flags. | **Respect** (parity). Never override it to add BatchMode (Pitfall 1). |
| `http.proxy`, `HTTPS_PROXY`, `NO_PROXY` | git (through libcurl) honors proxies. isomorphic-git's Node client did not **[SRC]**. **[EXP E-14b]** git sent an `example.invalid` request through this sandbox's proxy (`CONNECT tunnel failed, response 403`). | **Respect.** This is a fix for proxied users, but it is a behavior change: name it in the CHANGELOG. In tests, keep `127.0.0.1` in `NO_PROXY` or build the environment from scratch. |
| `http.sslCAInfo`, `GIT_SSL_CAINFO`, `http.sslBackend`, `http.sslVerify` | Decides TLS trust. `NODE_EXTRA_CA_CERTS` has no effect on git (E-16). `GIT_SSL_CAINFO` in the environment beats `http.sslCAInfo` in config (E-16c). | **Respect** for users. The harness must set it explicitly (Pitfall 9). |
| `http.extraHeader` (often in repository-local config, set by `actions/checkout`) | Sends a bearer token. | **Respect**, but never let git read the enclosing project's local config (Pitfall 3). |
| `protocol.allow`, `protocol.<name>.allow`, `GIT_PROTOCOL_FROM_USER` | Can forbid `https` or `ssh` (corporate policy), or permit `file` / `ext`. | **Respect** a stricter user setting. On top of it, always apply the extension's own allow-list (Pitfall 6). |
| `protocol.version=0` | **[EXP E-2b]** Turns fetch-by-sha into `Server does not allow request for unadvertised object`. | **Neutralize** on the pin fetch only: `-c protocol.version=2`. Otherwise fall back to the full fetch (Pitfall 5). |
| `core.hooksPath`, `init.templateDir` (template hooks) | **[EXP E-5]** A user `post-checkout` hook ran during `git clone -q`. Its stdout reached the parent's stdout. | **Neutralize:** `-c core.hooksPath=/dev/null` (on Windows, `NUL` or an empty directory inside the extension root) and `-c init.templateDir=` on clone. **[EXP E-5b]** no hook ran. Hooks have no role in fetching plugin bytes, and a hook writing to stdout breaks IL-2. Check whether Claude Code does the same, and record a divergence ID if it does not. |
| `core.autocrlf`, `core.eol`, `.gitattributes` `eol=` / `text=auto`, `filter.<x>.smudge` | Changes the bytes checked out. **[EXP E-4]** `core.autocrlf=true` turned `a\nb\n` into `a\r\nb\r\n`. isomorphic-git wrote the blob bytes unchanged **[EXP E-0]**. | **Decide in discuss** (Pitfall 4). |
| `filter.lfs.*` (here `filter.lfs.required=true` in `/etc/gitconfig`) | The LFS smudge filter runs on checkout. It reaches the network and needs credentials. | **Neutralize:** `GIT_LFS_SKIP_SMUDGE=1`. **[UP]** "The clone never downloads LFS content, so LFS-tracked files arrive as pointer files." That is parity, and it keeps checkout offline. |
| `core.fsmonitor`, `core.untrackedCache`, `gc.auto`, `gc.autoDetach`, `maintenance.auto`, `fetch.writeCommitGraph` | Start background daemons or a detached `git gc --auto` that holds files after the command returns (Pitfall 8). | **Neutralize:** `-c core.fsmonitor=false -c gc.auto=0 -c maintenance.auto=false`. |
| `safe.directory` ownership check | **[EXP E-12]** `fatal: detected dubious ownership in repository` when the clone belongs to another uid (root-owned project `.pi/`, Docker bind mounts, a shared user scope). isomorphic-git never checked ownership. | **Respect.** Classify it as its own reason with an actionable message. Do NOT pass `-c safe.directory=*`: it turns off a CVE-2022-24765 defense. |
| `core.symlinks`, `core.filemode`, `core.ignorecase` in the clone's own `.git/config` | See Pitfall 7 (isomorphic-git wrote `symlinks = false`). | **Neutralize** for clones the extension owns. |
| `commit.gpgsign`, `gpg.*`, `user.*` (this sandbox has `commit.gpgsign=true` with an `ssh` signing program) | Irrelevant to clone and fetch. They matter only if the code or a test fixture ever commits. | Fixtures already pass `-c commit.gpgsign=false` **[SRC]**. Keep it. |
| `advice.detachedHead` | **[EXP E-1b]** `clone --depth 1 --branch v1.0.0` prints a 15-line "Note: switching to …" block on stderr and exits 0. | **Neutralize:** `-c advice.detachedHead=false`. Never treat non-empty stderr as failure. |
| Locale (`LANG`, `LC_ALL`, `LANGUAGE`) | Git messages are translated, so a stderr classifier keyed on English text misses German or French users. | **Neutralize** for classification: `LC_ALL=C` (also `LANGUAGE=`) on every git process. |

**Why it happens:**
The isomorphic-git era had no config surface, so no module in this tree says which settings to trust. The cloud sandbox and CI each inject their own config through the environment, not through files, so `GIT_CONFIG_GLOBAL=/dev/null` looks hermetic and is not.

**How to avoid:**
- Build one environment in P-Spawn and one list of `-c` overrides: `buildGitEnvironment(process.env, purpose)`. Unit-test it as a table, one row per setting above, each marked "neutralize" or "respect" with its reason.
- Pass the neutralizing settings as `-c key=value` before the subcommand. They then rank above every file and above `GIT_CONFIG_COUNT`, without removing the user's settings that parity respects.
- Do not strip `GIT_CONFIG_COUNT` / `GIT_CONFIG_PARAMETERS` from users. They are legitimate config (this sandbox depends on them). Strip them only in the test harness.
- Always remove repository-pointer variables that a parent process can leak (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_COMMON_DIR`, `GIT_NAMESPACE`). A Pi started from a git hook (pre-commit, rebase exec) inherits `GIT_DIR`, and every git the extension runs would then act on the user's repository.

**Warning signs:**
A test that passes locally and fails in the cloud sandbox or in CI. An SSH URL that "works" without a key. CRLF diffs in a hash version. "dubious ownership" in a bug report.

**Phase to address:** P-Spawn (the table and its tests). P-URL (rewrite detection must use the same environment and `cwd`). P-Harness (Pitfall 9).

---

### Pitfall 3: a missing `.git` makes git act on the user's project repository

**What goes wrong:**
Project-scope clones live under `<cwd>/.pi/pi-claude-marketplace/…`, which is usually inside the user's own git repository. A clone directory whose `.git` is missing, half deleted, or not created yet (a staging directory before clone) is not a repository. git then walks up and finds the project's repository. **[EXP E-13]** `git -C outer/.pi/pi-claude-marketplace/clones/broken rev-parse --show-toplevel` printed `/tmp/claude-0/sysgit/outer`. The D-14 refresh (`update-ref refs/heads/<branch>`, then `checkout -f` / `reset --hard`) would then move the user's branch and throw away their uncommitted work. **[EXP E-14]** In the same way, `ls-remote` run with a `cwd` inside the project read the project's local `url.insteadOf`. `clone` did not (E-14b).

**Why it happens:**
`isomorphic-git` took `dir` and looked only at `<dir>/.git`. It never walked up. Code ported one call at a time keeps the "dir is the repository" assumption.

**How to avoid:**
- For every command that operates in a clone, pass `--git-dir=<clone>/.git --work-tree=<clone>` (or `GIT_DIR` / `GIT_WORK_TREE`) explicitly. Never rely on `-C <clone>` discovery alone.
- Also set `GIT_CEILING_DIRECTORIES=<parent of the clone root>` as a second guard. **[EXP E-13b]** discovery stopped: `fatal: not a git repository`.
- Run `clone` and `ls-remote` with `cwd` set to a directory that is not inside any repository, or with `GIT_CEILING_DIRECTORIES` set to that `cwd`. This stops a project's local config from leaking into a remote command.
- Before any destructive command (`reset --hard`, `checkout -f`, `update-ref`, `clean`), check that `rev-parse --absolute-git-dir` equals `<clone>/.git` after realpath. Refuse otherwise (NFR-10).
- Keep `listRemotes`' existing `readFile(<dir>/.git/config)` pre-check **[SRC]**. It already tells "not a repo" apart without discovery.

**Warning signs:**
A unit test of the refresh that runs in a temporary directory with no parent repository passes, and the same flow under `<cwd>/.pi/` fails. Any git call in `platform/` that does not name the git dir.

**Phase to address:** P-Spawn (the seam always names the git dir and sets the ceiling). P-Transport (the destructive-command guard). Add a cucumber scenario in P-Harness: a project scope inside a git repository with a damaged clone, where `update` fails clean and leaves the project's `HEAD` and working tree unchanged.

---

### Pitfall 4: checked-out bytes change, so versions and scripts change

**What goes wrong:**
`computeHashVersion` hashes the working-tree bytes of a path-source plugin root inside the marketplace clone **[SRC `domain/version.ts`]**. System git applies `core.autocrlf`, `.gitattributes` `eol`/`text`, and smudge filters at checkout. isomorphic-git applied none **[EXP E-0, E-4]**. Effects:
- Git for Windows enables `core.autocrlf=true` in its system config by default **[MEM, HIGH]**. Every path-source plugin on Windows then gets a new `hash-…` version after migration. `update` and `apply` report a spurious update, and two machines disagree on the same commit.
- `.sh` hook scripts and `#!` files checked out with CRLF fail under bash (`$'\r': command not found`). A plugin that worked on Windows under isomorphic-git breaks.
- A repository with `* text=auto eol=crlf` in `.gitattributes` changes bytes on every OS, autocrlf or not.
- The LFS smudge filter changes pointer files into real content (Pitfall 2, neutralized by `GIT_LFS_SKIP_SMUDGE=1`).

**Why it happens:**
On Linux CI, autocrlf is unset, so every test passes. The difference shows only on Windows or in repositories with attributes.

**How to avoid:**
- Decide in discuss, with the compat-research option format, whether to pass `-c core.autocrlf=false -c core.eol=lf` (bytes as committed) or to keep the user's setting (Claude Code parity, if the binary does not override it). An override needs a recorded divergence ID. It can be justified because the hash version is this extension's own derived value, but `.gitattributes` would still apply, so "bytes as committed" also needs `-c core.attributesFile=` and cannot neutralize in-repo attributes. State that limit.
- Whichever way it goes, add a unit case that checks out a fixture with CRLF and LF blobs under `core.autocrlf=true`, and record the expected hash.
- Git-source plugins version by commit (`shaVersion`, GV-01) **[SRC]**, so only path sources and plugins that hash their tree are exposed. Say so in the decision.

**Warning signs:**
`update` reports a version change on Windows with no upstream commit. `git status` in a clone shows every file modified after a config change.

**Phase to address:** P-Transport (the decision and the fixture test). P-Migrate (existing Windows clones will rehash once).

---

### Pitfall 5: shallow clones break assumptions the current code depends on

**What goes wrong:**
The milestone adds shallow clones. The current code assumes full history and a wildcard refspec **[SRC]**:
- **Local tag reads (TAGS-01).** `marketplace-tag-probe.ts` resolves a path-source dependency's version range from the marketplace clone's own `refs/tags/` with no network. **[EXP E-1]** after `git clone --depth 1`, `git tag -l` printed nothing, because shallow clones only auto-follow tags that point at fetched commits. Every constrained path-source dependency would then fail with "no satisfying tag".
- **The PURL-04 refetch.** `checkoutPinWithRefetch` states: "The clone left the wildcard fetch refspec, so one full fetch pulls every head and every tag." That is true for isomorphic-git **[EXP E-19]**: its `singleBranch` clone kept `+refs/heads/*`, and a later fetch brought `origin/main`. It is false for system git: `--single-branch --branch dev` records `+refs/heads/dev:refs/remotes/origin/dev`, and a later `git fetch origin` brings only `origin/dev`. `--depth 1 --branch v1.0.0` records `+refs/tags/v1.0.0:refs/tags/v1.0.0` (E-1b). `--depth` implies `--single-branch`.
- **`resolveTagOid` peeling** reads tag objects that a shallow clone may not hold.
- **Fetch-by-sha.** Works on protocol v2 **[EXP E-2]**, even for a commit that is not a tip. Fails on protocol v0 (E-2b) and on servers that reject unadvertised wants (some GitHub Enterprise, Gerrit, and Bitbucket Server setups, plus dumb-HTTP servers). An unknown sha gives `fatal: remote error: upload-pack: not our ref <sha>` **[EXP E-2c]**. That message must map to `PinnedCommitMissingError`, not to `network unreachable`.
- **`--unshallow` cost.** On a large repository it downloads the whole history, which can run past the clone timeout. `--unshallow` on a repository that is not shallow fails (`--unshallow on a complete repository does not make sense`), so a retry after a partial success errors out.
- **Stale `shallow.lock`.** An interrupted shallow fetch leaves `.git/shallow.lock`, and the next fetch fails `Unable to create …/shallow.lock: File exists` **[EXP E-11b]**.
- **`ls-remote --tags` with `--depth`.** These are separate: `ls-remote` needs no clone, so the D-03-03 remote tag listing (`listRemoteTags`) stays a network read and does not depend on depth. Do not try to derive tags from a shallow clone.

**Why it happens:**
"Shallow clone" reads as a pure size optimization. The code that depends on full history is spread across the update, the install pin, and the dependency resolver, and each documents its assumption locally.

**How to avoid:**
- Read the binary first. Does Claude Code clone marketplaces shallow too, or only plugins? If marketplaces are shallow, `<plugin>--v<version>` tag resolution for path sources must use `git ls-remote --tags` or `git fetch --depth 1 origin 'refs/tags/*:refs/tags/*'`. Either one is a network read, and NFR-5 / D-03-03 must be amended to allow it. Or keep marketplace clones full. Decide in discuss.
- After every `--single-branch` clone, set the refspec yourself to the one the next operation needs, or fetch with an explicit refspec (`git fetch origin +refs/heads/*:refs/remotes/origin/* +refs/tags/*:refs/tags/*`). Remove the comment in `clone-cache.ts` that assumes otherwise.
- The pin ladder: `fetch --depth 1 origin <sha>` with `-c protocol.version=2`. On a refusal (classified from stderr), `fetch --unshallow --tags origin`, then `fetch origin` if the repository is not shallow (check `rev-parse --is-shallow-repository` first). Then `checkout --detach <sha>`. Map `not our ref` / `unadvertised object` after the last rung to `PinnedCommitMissingError`.
- Validate every sha as `^[0-9a-f]{40}$` (or 64 for sha256 repositories) before it reaches argv.

**Warning signs:**
A path-source dependency scenario that passes only because the fixture's tag sits on the tip commit. A PURL-04 scenario that passes because the fixture has one branch.

**Phase to address:** P-Transport. Add cucumber fixtures with a tag that is not on the tip, two branches with a pin on the other one, and a host stand-in arm that refuses unadvertised wants. The stand-in serves through `git http-backend`, so `-c uploadpack.allowAnySHA1InWant=false` together with a protocol v0 client reproduces the refusal.

---

### Pitfall 6: argument injection and dangerous transports

**What goes wrong:**
A marketplace author controls `source.url`, `ref`, `sha`, plugin `repo`, and release tag names. Through `listRemoteTags`, an attacker's repository controls the tag names that a version range selects. isomorphic-git took these as typed fields, so injection was impossible. With argv:
- **[EXP E-6]** `git clone "--upload-pack=touch …/pwned;git-upload-pack" ./srv/acme/repo.git inj` ran the command and created `pwned`. A URL or ref that starts with `-` becomes an option.
- **[EXP E-17b]** `refs/tags/-evil` is a valid ref name (`check-ref-format` exit 0). A chosen release tag `-evil` passed as `--branch -evil` is the same injection.
- `ext::` runs arbitrary commands. It is blocked by default **[EXP E-6c]** (`transport 'ext' not allowed`), but a user's `protocol.ext.allow=always` would re-open it. `file://` and local paths are allowed by default **[EXP E-18]**, so a marketplace entry could make the extension clone `/home/user/.ssh` or a local repository into the plugin cache. It would not leak by itself, but it breaks the "remote source" model, and NFR-10 depends on that model.
- **Submodules** (a target feature). `.gitmodules` names arbitrary URLs, including ssh to other hosts and other credentials. Recursive clones were the vector of CVE-2024-32002 (symlinked submodule path on case-insensitive file systems; fixed in 2.45.1) and CVE-2025-48384 (CR in config values gives an arbitrary write and hook execution; fixed in 2.43.7 / 2.44.4 / … / 2.50.1) **[MEM, MEDIUM: check the advisories]**. The git 2.43.0 here predates both fixes, unless the distribution backported them.
- **Credentials in URLs.** A source URL like `https://user:token@host/…` is stored in `.git/config`, visible in `ps` to other local users while git runs, and can appear in stderr. **[EXP E-3c]** git left the userinfo out of its "not found" message, but other paths (curl errors, `GIT_TRACE`, proxy errors) are not guaranteed.

**Why it happens:**
`execFile("git", ["clone", url, dir])` looks safe because it uses no shell. `shell: false` stops shell injection, not option injection.

**How to avoid:**
- Put `--end-of-options` (git 2.24 and later) before every positional argument that came from data, and also `--` where the command takes paths. **[EXP E-17]** with it, git refused: `strange pathname '--upload-pack=…' blocked` / `invalid refspec`. Also validate inputs in `domain/`: URL schemes in an allow-list (`https`, `ssh`, scp-like `user@host:path`, and `http` only if Claude Code accepts it). Refs must pass `git check-ref-format` and must not start with `-`. Shas must match the hex rule.
- Pass `-c protocol.allow=never -c protocol.https.allow=always -c protocol.ssh.allow=always` (plus `http` if parity needs it) on every network command. That blocks `ext`, `file`, and local paths for the main repository and its submodules alike. The cucumber host is HTTPS, so tests keep working.
- Submodules: use `-c protocol.file.allow=never`, `--recurse-submodules` only when the source asks for it, `--shallow-submodules`, and check each submodule path is contained after checkout. Set a minimum git version (Pitfall 12) or warn below the CVE fix versions.
- Redact stderr through the existing `shared/redact-credentials.ts` and `shared/redact-absolute-paths.ts` before any message or debug log **[SRC]**. Never put a credential in argv: prefer the helper. Refuse or strip userinfo in source URLs, and record the decision.

**Warning signs:**
Any `spawn("git", [...])` call where a data value is not preceded by `--end-of-options`. A unit test suite with no "value starts with a dash" row.

**Phase to address:** P-Spawn (the terminator and the protocol allow-list in the seam, so no call site can forget them). P-Transport (submodules). `domain/` validation in P-URL. Run `/gsd-secure-phase` on both.

---

### Pitfall 7: clones that isomorphic-git wrote behave differently under system git

**What goes wrong:**
**[EXP E-0]** isomorphic-git's clone is a valid repository for system git: index version 2, loose refs (no `packed-refs`), `refs/remotes/origin/HEAD` as a symref, `git fsck --full` clean, `git status` clean, `fetch` works. But its `.git/config` holds:

```
[core]
	filemode = false
	symlinks = false
	ignorecase = true
```

isomorphic-git writes these on Linux too. System git obeys them:
- **[EXP E-0b]** After a system `fetch` + `reset --hard`, a new symlink `newlink -> lf.txt` was written as a 6-byte regular file holding `lf.txt`. With `-c core.symlinks=true`, it became a real symlink. A plugin that ships `skills/foo -> ../../shared/skills/foo` (the pattern Claude Code documents [UP]) silently stops resolving in old clones only, while fresh clones work.
- `ignorecase = true` on a case-sensitive file system makes git treat `README.md` and `readme.md` as one path.
- `filemode = false` did not drop the exec bit on new files in E-0c (`hook2.sh` came out `-rwxr-xr-x`), but git stops seeing mode changes in `status`.
- The clone has full history and no `.git/shallow`, so depth assumptions differ between old and new clones (Pitfall 5).
- isomorphic-git's `singleBranch` clone kept a wildcard refspec. System git's does not (E-19). Code that branches on "is this clone shallow or narrow" sees mixed states.
- **Default-branch tracking diverges.** **[EXP E-8]** isomorphic-git's `fetch` updated `refs/remotes/origin/HEAD` to the server's new default branch. System git 2.43 `fetch` did not: it stayed `refs/remotes/origin/main` after the server moved `HEAD` to `dev`. The D-14 form for `storedRef === undefined` resolves `refs/remotes/origin/HEAD` after fetching **[SRC `refreshGitHubClone`]**, so with system git it keeps following the old default branch forever. Git 2.48 added `remote.<name>.followRemoteHEAD`, and only creates a missing `origin/HEAD` by default **[web, LOW]**.

**Why it happens:**
"The clone opens and fsck is clean" looks like "the migration is done".

**How to avoid:**
- On the first system-git operation on a clone, normalize its local config: `git config core.symlinks true` (or unset it so git probes the file system), unset `core.ignorecase` and `core.filemode`, and let git re-probe. Doing this through `git config` writes atomically (git uses a lock file and rename). Then re-checkout the tree once (`checkout -f HEAD`), so files already written as symlink text are fixed. Or simpler: treat every isomorphic-git clone as stale, and re-clone into staging and swap on its next network operation. Claude Code re-clones on update failures anyway [UP]. Decide in discuss.
- Mark migrated clones so the work runs once: a marker in `state.json` with a schema bump, or detect `symlinks = false` on a non-Windows host.
- Default branch: before resolving `origin/HEAD`, run `git ls-remote --symref origin HEAD` (the same request fetch makes), or `git remote set-head origin --auto` (network, so it belongs to the fetch step only). Never rely on `fetch` updating it.
- Keep `listRemotes` reading the config file itself. Its "exactly one `remote.origin.url`" rule still holds for both writers **[SRC]**.

**Warning signs:**
A symlink scenario that passes on a fresh install and fails after `update` of an existing install. A marketplace whose default branch was renamed (`master` to `main`) keeps serving the old branch.

**Phase to address:** P-Migrate (normalization or re-clone, decided in discuss). P-Transport (default-branch tracking). Add an `earlier-version-state` style cucumber fixture in P-Harness: a clone written by isomorphic-git, with `symlinks = false`, then `update`.

---

### Pitfall 8: abort, kill, locks, and the staging rename

**What goes wrong:**
- **Orphaned transport helpers.** **[EXP E-10k]** `git ls-remote http://…` runs three processes: `git`, a child `git` (`remote-http`), and `git-remote-http`. `child.kill("SIGTERM")` on the direct child left the other two alive with ppid 1, still holding the connection. The D-PL8-24 abort ("fails like a network drop") therefore leaks processes and sockets in every Pi session. Killing the process group (`detached: true` plus `process.kill(-pid)`) took most of them down, but one `git` was still alive one second later. Wait for `close` before acting.
- **Stale lock files break retry (NFR-3).** A killed `fetch`, `checkout`, or `reset` leaves `index.lock`, `shallow.lock`, `HEAD.lock`, or `refs/…lock`. The next run fails `Unable to create '…/index.lock': File exists` **[EXP E-11, E-11b]**. isomorphic-git had no lock files, so the existing "safe to retry" proofs do not cover this.
- **Rollback racing a live git.** Removing a staging directory while a killed git is still writing (or while a detached `git gc --auto` runs) fails with `ENOTEMPTY`, or on Windows `EBUSY` / `EPERM`. The MA-9 cleanup-leak path then reports a leak on every abort.
- **Windows rename.** `rename(staging, cloneRoot)` fails `EPERM` / `EBUSY` while a git process, an fsmonitor daemon, Windows Defender, or the search indexer holds a handle in the tree. This is more common with system git, which leaves `core.fsmonitor` daemons and background gc processes.
- **Lock scope.** The `proper-lockfile` guard is per scope and not re-entrant **[SRC]**. A long git command (a 120 s clone) inside the guard holds the scope lock for that long, and a second Pi gets `StateLockHeldError` sooner than before, because isomorphic-git clones were small and full-history ones were not.

**Why it happens:**
The abort scope was designed around `AbortSignal` and HTTP hops in-process **[SRC `platform/git.ts`]**. Process lifetime is a new concern.

**How to avoid:**
- In P-Spawn: on POSIX, spawn with `detached: true` and kill the group with `process.kill(-pid, "SIGTERM")`, then `SIGKILL` after a short grace. On Windows, use `taskkill /pid <pid> /T /F`, which is itself a child process and must be in the chokepoint allow-list. Resolve the operation only after `close`. Keep the timer `unref()` as `git-credential.ts` does **[SRC]**.
- Never mutate a live clone in place for a network operation. Fetch and checkout into a staging copy (or a fresh clone), then swap with rename, as install already does. Then a killed operation leaves only staging debris. Clean it when you next hold the scope lock, which proves no git of this extension runs there. Remove a `*.lock` file inside an owned clone only under the scope lock, and only if no git child of this process is alive.
- Neutralize background work: `-c gc.auto=0 -c maintenance.auto=false -c core.fsmonitor=false` (Pitfall 2).
- On Windows, retry `rename` and `rm` with backoff on `EPERM` / `EBUSY` / `EACCES` (`fs.rm` already has `maxRetries`), and treat a final failure as a cleanup leak.
- Do the network read (`ls-remote`, clone into staging) outside the state lock where the flow allows, and keep only the swap and the `state.json` write inside it. Check this against the existing ledgers before changing it: it is a design change, not a port.

**Warning signs:**
`ps` shows `git-remote-https` processes after a cucumber run. A flaky "rollback leaked" message. Windows users report `EPERM: operation not permitted, rename`.

**Phase to address:** P-Spawn (kill and wait). P-Transport (staging for updates). Add a cucumber scenario in P-Harness with the host's existing `hold` arm and the background-update abort, which then checks that no git process is left. The `hold` / `hold-git-body` arms exist **[SRC `server.ts`]**.

---

### Pitfall 9: the cucumber HTTPS git host stops working, or works for the wrong reason

**What goes wrong:**
- **CA trust.** Today Pi trusts the host's self-signed certificate through `NODE_EXTRA_CA_CERTS` **[SRC `features/support/pi-process.ts:152`]**. System git ignores it. **[EXP E-16]** `server certificate verification failed. CAfile: none`. Every git scenario fails at once.
- **Precedence.** If the harness puts the CA in the sandbox `.gitconfig` as `http.sslCAInfo`, an inherited `GIT_SSL_CAINFO` wins **[EXP E-16c]**: it failed with `CAfile: /root/.ccr/ca-bundle.crt`, which this sandbox's environment sets. `rpcChildEnvironment` builds Pi's environment from scratch **[SRC]**, so Pi is safe today. `real-subagent-child.ts` and any new git spawn must stay the same way.
- **The hermetic test does not list the variables that matter now.** `INHERITED_VARIABLES` in `test/architecture/hermetic-git-environment.test.ts` checks `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_GLOBAL`, and `GIT_ASKPASS` **[SRC]**. It misses `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` / `GIT_CONFIG_PARAMETERS` (present in this sandbox, E-15), `GIT_SSL_CAINFO` (present), `GIT_SSH_COMMAND`, `GIT_SSH`, `SSH_AUTH_SOCK`, `HTTPS_PROXY` / `https_proxy` (present), `XDG_CONFIG_HOME`, `GIT_TRACE*`, `GCM_*`, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`.
- **SSH has no stand-in.** The host is HTTPS only. The SSH probe, the HTTPS fallback, and the SSH retry need a deterministic ssh endpoint, or a `GIT_SSH_COMMAND` / `GIT_SSH` stub. But a set `GIT_SSH_COMMAND` is also the probe-skip signal, so a stub through it cannot test the probe path. Use a stub `ssh` binary placed first on Pi's `PATH`. This sandbox has no `ssh` binary at all **[EXP E-9]**, which is also a realistic user state (minimal containers).
- **The `credential` arm.** Today it is answered by isomorphic-git `onAuth` and Device Flow. With system git, the arm exercises `credential.helper=store` in the sandbox `.gitconfig` **[SRC `git-host.steps.ts`]**, which works the same, but the Device Flow scenarios under `features/marketplace/device-flow*` change meaning or go away (P-Auth).
- **CI git version.** GitHub's `ubuntu-latest` image ships a newer git than the 2.43 used here. Behaviors that differ by version: `followRemoteHEAD` (2.48), `--revision` clone (2.49), `GIT_NO_LAZY_FETCH` (2.44.1 / 2.45.1), and the CVE fix levels. Tests that pin stderr text break across versions.
- **Proxy.** With `HTTPS_PROXY` inherited and `127.0.0.1` not in `NO_PROXY`, git sends loopback traffic to the proxy. The from-scratch environment avoids this. Keep it that way.

**Why it happens:**
The stand-in was built for a Node HTTP client, so CA trust and environment isolation were designed around Node.

**How to avoid:**
- In `rpcChildEnvironment`, add `GIT_SSL_CAINFO=<cert>`, or write `http.sslCAInfo` in the sandbox `.gitconfig` that `GIT_CONFIG_GLOBAL` already points at. Keep `NODE_EXTRA_CA_CERTS` for the hosted-manifest `fetch` path (`platform/hosted-manifest-fetch.ts`), which stays in Node. Extend the hermetic test's expected key set and its `INHERITED_VARIABLES` with every variable above.
- Add one architecture test: every `spawn` of git under `features/` and `test/` goes through `hermeticGitEnvironment` or `rpcChildEnvironment`.
- Pin `git --version` in the CI log, and set a floor in the harness so an old runner fails loudly. Classify on exit codes and stable stderr prefixes (`fatal: could not read Username`, `not our ref`, `Repository not found`, `Could not resolve host`), never on full sentences.
- For SSH, a stub `ssh` on `PATH` that reads its argv and either answers `ssh -T` with GitHub's greeting and exit 1, or fails with exit 255, covers the probe and fallback without a real sshd.

**Warning signs:**
All git scenarios fail with `certificate verification failed`. Scenarios pass locally and fail in the cloud sandbox (the proxy, `GIT_CONFIG_COUNT`). A scenario that asserts git's exact stderr.

**Phase to address:** P-Harness. Schedule it early: P-Transport cannot be verified behaviorally without it.

---

### Pitfall 10: NFR-5 breaks through "local" git commands

**What goes wrong:**
`list`, `info`, `uninstall`, `marketplace remove`, and a load without autoapply MUST NOT touch the network. With isomorphic-git, a local function was local by construction. With system git, several commands that look local can reach the network:
- `checkout` / `reset` in a partial clone (`--filter=blob:none`) fetch missing blobs on demand.
- `checkout` runs the LFS smudge filter, which downloads objects, unless `GIT_LFS_SKIP_SMUDGE=1`.
- `git remote show origin`, `git remote set-head --auto`, `git submodule update`, `git fetch` run through a "refresh" helper, and `git ls-remote`.
- A user's `url.insteadOf` cannot turn a local command into a network one, but a hook (`post-checkout`) can do anything (Pitfall 2).

ESLint BLOCK F today bans imports of `platform/git` from non-seam modules **[SRC]**. It cannot see which git subcommand a seam runs.

**Why it happens:**
"Local" is a property of the subcommand and its config, not of the function name.

**How to avoid:**
- Split the platform seam into two typed entry points: `runLocalGit(subcommand: LocalSubcommand, …)` with a closed union (`rev-parse`, `for-each-ref`, `cat-file`, `config --get*`, `tag -l`, `symbolic-ref`, `update-ref`, `checkout`, `reset`), and `runRemoteGit(…)`. The local lane always adds `-c protocol.allow=never`. **[EXP E-20]** that refuses any transport (`fatal: transport 'https' not allowed`) and leaves `rev-parse` working. Also add `GIT_NO_LAZY_FETCH=1`, `GIT_LFS_SKIP_SMUDGE=1`, and the hooks neutralization. The guarantee is then enforced by git itself, not only by review.
- Never create partial clones (`--filter`).
- Extend BLOCK F, or an architecture test, so the remote lane is importable only from `NETWORK_SEAMS` modules. The `marketplace-tag-probe-offline.test.ts` pattern (pin the import set) applies directly **[SRC]**.
- The `child-process-chokepoint` allow-list gains exactly one new platform file. `platform/git.ts` should stay the only module that names `git`. Then delete `git-credential.ts`'s own spawn if Device Flow goes, so the list shrinks.

**Warning signs:**
A cucumber offline scenario (`PI_OFFLINE=1`, a host with zero requests recorded) gains a request. The git host's request log records traffic during `list`.

**Phase to address:** P-Spawn (the two lanes). Every phase keeps the HOST-04 traffic assertions on offline commands green.

---

## Moderate Pitfalls

### Pitfall 11: git output reaches Pi's terminal (IL-2)

**What goes wrong:** `stdio: "inherit"` (or a hook that git starts while git inherits Pi's stdout) prints straight into the TUI. **[EXP E-5]** a `post-checkout` hook's `echo HOOK-STDOUT` reached the parent's stdout during `git clone -q`. Large outputs also break `execFile`: its default `maxBuffer` is 1 MiB, and `ls-remote` of a repository with tens of thousands of tags exceeds it (`stdout maxBuffer length exceeded`).
**How to avoid:** Use `spawn` with piped streams, collect stdout as a stream with a size cap you choose, keep only the tail of stderr (for example 64 KiB), and pass `-q` / `--no-progress`. Route all output through the notify chokepoint after redaction. The fallow `no-stdio` rule cannot see a child's inherited stdio, so add a unit case that asserts the spawn options.
**Phase:** P-Spawn.

### Pitfall 12: git is missing, too old, or the wrong binary

**What goes wrong:** D-21's one reason was "git not found on PATH" **[SRC]**. `spawn` raises `ENOENT` **[EXP E-10]**, and the cause is easy to misreport as "network unreachable" or an install bug. ssh can be missing while git is present **[EXP E-9]**: this sandbox has no `ssh`. Old git lacks `--end-of-options` (2.24), `safe.directory` (2.35.2), and the CVE fixes. On Windows, Node's `spawn` (libuv) looks for a bare `git` in the child's **cwd** first, then on `PATH`, adding `.com` and then `.exe` and ignoring `PATHEXT` **[web, LOW: libuv `search_path` comments; verify on current Node]**. With `cwd` set to a cloned marketplace, a `git.exe` committed at the repository root would run in place of the real git. That is a binary-planting attack.
**How to avoid:** Resolve git once per process: walk `PATH` yourself, skip relative entries and `.`, and spawn that absolute path. Never spawn a bare `git` with `cwd` inside a clone. Use `-C` / `--git-dir` with a trusted `cwd`. Probe `git --version` once, cache it, and set a documented floor (at least 2.24 for `--end-of-options`; consider the CVE fix levels). Report `git not found` and `git too old` as their own closed-set reasons, with a message that names the install step. Discuss decides between "git only" and an isomorphic-git fallback. The milestone lists this as open. If a fallback stays, every pitfall here applies twice.
**Phase:** P-Spawn. The decision belongs to discuss.

### Pitfall 13: failure classification is keyed on isomorphic-git error shapes

**What goes wrong:** `shared/git-failure-classifiers.ts` duck-types isomorphic-git errors (`code === "HttpError"` with `statusCode`, `UserCanceledError`, Node errno codes). `orchestrators/marketplace/shared.ts::isGitNotFoundError` matches `name === "NotFoundError"`. `clone-cache.ts` matches `CommitNotFetchedError` **[SRC]**. System git gives an exit code (128 for most fatal errors, 1 for some) and English stderr. Every rung of the ladder silently falls through to its default, so `authentication required` becomes a generic failure, and the D-14 third form (a tag or sha that is not a branch) rethrows in place of its fallback.
**How to avoid:** Produce typed errors in `platform/` from stderr and the exit code (`GitAuthRequiredError`, `GitRepositoryNotFoundError`, `GitRefNotFoundError`, `GitPinRefusedError`, `GitNetworkError`, `GitNotInstalledError`, `GitDubiousOwnershipError`, `GitTimeoutError`), each with `name` set per CONVENTIONS. Then update the classifier to narrow with `instanceof` on them. That removes the duck-typing D-13 needed. Force `LC_ALL=C` (Pitfall 2). GitHub answers a private repository that the user cannot see with `Repository not found`, not 401. Claude Code's message for that case should be checked against the binary so the classifier does not report "not found" where upstream says "authentication". Keep the D-PL7-01 reason set closed. Build the stderr corpus from real runs (see the Experiment log), not from memory.
**Phase:** P-Errors, shortly after P-Spawn. Do it before the cucumber migration, or every failure scenario needs rework twice.

### Pitfall 14: dropping Device Flow strands users or leaves tokens behind

**What goes wrong:** Device Flow stored its token through `git credential approve` as `protocol=https host=github.com username=x-access-token password=<OAuth token, scope repo>` (GitHub) or the GitLab equivalent **[SRC `auth-registry.ts`, `git-credential.ts`]**. Consequences:
- System git asks the same helper for the same `protocol` / `host` pair, so after the switch it **uses those tokens automatically** for every HTTPS github.com operation. Users who relied on Device Flow keep working as long as the token is valid. GitHub OAuth App tokens do not expire on their own **[MEM, MEDIUM]**. GitLab OAuth tokens expire after about 2 hours, so GitLab Device Flow users lose access at the first expiry after the upgrade, with no way to mint a new token.
- On a 401 with a helper-supplied credential, git itself runs `credential reject` for it **[MEM, MEDIUM]**. A revoked token is removed from the keychain on first failure, and the user then sees `authentication required`, with no hint that `gh auth login` + `gh auth setup-git` is the new path [UP].
- A `repo`-scope token the extension minted stays in the user's keychain after the extension no longer uses it. It is readable by every git on the machine.
- The AAP no-Device-Flow rules and D-PL8-12 (stored credentials only in the background pass) become trivially true, but their tests may still assert Device Flow plumbing. Removing `domain/github-auth.ts` also removes one of the two `fetch-chokepoint` callers **[SRC]**.
**How to avoid:** Discuss decides between full removal and keeping Device Flow as an explicit login command. Either way:
- Do not delete keychain entries automatically. A `reject` with a partial attribute set can match the user's own GitHub credential.
- Show one notice: the first time an HTTPS github.com operation fails with `authentication required`, and the state shows Device Flow had been used, say how to authenticate (`gh auth login`, `gh auth setup-git`, or an ssh key).
- Document how to remove the old token by hand.
- Remove the GitLab provider's expectations explicitly.
**Phase:** P-Auth. Record the migration notice in P-Migrate.

### Pitfall 15: URL selection loops, double-probes, or overrides the user

**What goes wrong:** The SSH probe (`ssh -T git@github.com`) runs on every `owner/repo` operation and adds 1 to 10 s each time. With no ssh binary (E-9) or no key, every install pays the probe. The HTTPS fallback plus an SSH retry can double the failure time to 2 × timeout. The extension's own `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` rewrite (GHB-01) has so far been applied in-process **[SRC `gitHubWireUrl`]**. If it is reimplemented as `-c url.<base>.insteadOf=https://github.com/`, the probe-skip detector sees it as a user rewrite. The recorded origin must stay canonical **[SRC `clone()` sets `remote.origin.url` back]**. With system git, a later `git fetch` then reads the canonical URL and goes to github.com, unless the rewrite is applied again on every remote command. **[UP]** Upstream in-session installs and updates "don't fall back" to HTTPS, only the CLI does. Claude Code issue 96811 reports that update forces HTTPS even when the existing clone works over SSH. Both are parity questions with unclear right answers.
**How to avoid:** Cache the probe result for the process lifetime per host, and skip it under `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`, `GIT_SSH_COMMAND`, `GIT_SSH`, or a detected rewrite. Read the rewrite with the same environment and `cwd` (Pitfall 3) and exclude the extension's own `-c`. Store which URL a clone used. Apply the base override as an explicit URL argument on every remote command, not as config. Read the binary for the exact probe argv, its timeout, and the in-session fallback rule before writing the ladder.
**Phase:** P-URL, after the compat-research pass.

### Pitfall 16: symlinks and containment in fresh system-git checkouts

**What goes wrong:** System git (with `core.symlinks=true`) writes real symlinks, including ones that point outside the clone. **[EXP E-0]** the fixture's `escape-link -> ../../../etc/passwd` was materialized, and isomorphic-git materialized it too, so the risk is not new. What is new: old clones wrote symlinks as text (Pitfall 7), so a containment check that passed on migrated clones can fail on fresh ones. Submodules add symlinked paths of their own. Claude Code copies the plugin into its cache: it preserves symlinks inside the plugin, dereferences ones that stay inside the marketplace, and skips ones outside [UP].
**How to avoid:** Keep NFR-10 checks on `realpath` of every plugin root and component path after checkout, never on the lexical path. Add a fixture with an outside-pointing symlink to the behavioral suite. Decide in discuss whether to adopt the upstream copy rules or keep in-place roots. That is a scope question for this milestone, not a port detail.
**Phase:** P-Transport, with a P-Harness scenario.

---

## Minor Pitfalls

### Pitfall 17: `resolveTagOid` and other signatures leak isomorphic-git types

**What goes wrong:** `ResolveTagOidOptions.cache: object` (an isomorphic-git object cache), the `GitCredentials` shape (isomorphic-git's `GitAuth`, with `cancel`), `runWithGitAbortSignal`, and `TooManyRedirectsError` / `CrossOriginChallengeError` (in-process redirect handling, GAUTH-06 / Q-02) are all shaped by the library **[SRC]**. System git follows redirects itself (`http.followRedirects=initial` by default), and its credential helper protocol is per-host, so the cross-origin credential guard moves into git.
**How to avoid:** Redesign the `GitOps` interface rather than porting it. Delete `cache`. Peel tags with one `git for-each-ref --format='%(refname:strip=2) %(objectname) %(*objectname)' refs/tags` call, which also removes the N-call peel loop. Retire `CrossOriginChallengeError` and `TooManyRedirectsError`, or map git's own redirect errors onto them, and record which. The fakes (`test/platform/git-ops-fake.ts`) and every orchestrator test that stubs `GitOps` change with it. Budget that as real work, because 100% direct coverage per pair (NFR-6) applies to each rewritten pair.
**Phase:** P-Transport.

### Pitfall 18: the stored-credential path in `git-credential.ts` asks with no `cwd`

**What goes wrong:** `spawn` passes no `cwd`, so `credential.helper` resolves from whatever repository the Pi process sits in **[SRC]**. Once Device Flow goes, this module either goes too or keeps a narrower job. If it stays, it inherits Pitfalls 1, 2, and 3.
**How to avoid:** Delete it if P-Auth removes Device Flow. Otherwise route it through the P-Spawn seam.
**Phase:** P-Auth.

### Pitfall 19: documentation and records go stale

**What goes wrong:** `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, and `CONVENTIONS.md` name isomorphic-git as critical, list the `isomorphic-git-chokepoint` rule, and say "no dependency on a `git` binary on PATH". README states no requirement for git. D-21 and MA-7 are cited in code comments.
**How to avoid:** P-Close changes the rule pack (remove `isomorphic-git-chokepoint`, update `child-process-chokepoint`), runs `fallow dead-code --trace-dependency isomorphic-git` before removing the dependency, and records the new decision ID that cites D-21. Update both READMEs together (`readme` skill).
**Phase:** P-Close.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
| --- | --- | --- | --- |
| Port each `GitOps` member one-to-one onto a git subcommand | Small diffs, existing tests keep their shape | Keeps isomorphic-git assumptions (wildcard refspec, `origin/HEAD` follows the server, `cache`) that are false for git (Pitfalls 5, 7, 17) | Never for `clone` / `fetch` / tags. Acceptable for `rev-parse`-style reads |
| `execFile` with default options | One line per call | 1 MiB `maxBuffer`, inherited environment, no group kill, no `--end-of-options` | Never in production code |
| Classify by full English stderr sentences | Fast to write | Breaks across git versions and locales | Only with `LC_ALL=C` and stable prefixes |
| Keep an isomorphic-git fallback "just in case" | Users without git keep working | Two transports, two error vocabularies, and two sets of these pitfalls, plus SSH still missing on the fallback | Only if discuss records a Windows git-absence rate that justifies it |
| `-c safe.directory=*` to stop ownership errors | Removes a class of bug reports | Disables a git security check machine-wide for these calls | Never |
| Leave isomorphic-git clones as they are | Zero migration code | Symlinks as text, stale default branch, mixed refspecs (Pitfall 7) | Only if every clone is re-cloned on its next network operation |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
| --- | --- | --- |
| `proper-lockfile` scope guard | Running a 120 s clone inside the guard | Clone into staging outside or before the guard where the ledger allows; swap and save inside it (Pitfall 8) |
| Staging-dir rename (`clone-cache.ts`, `add.ts`) | Renaming while a killed git still writes; no retry on Windows | Wait for `close`, neutralize background gc and fsmonitor, retry `EPERM` / `EBUSY` |
| Abort scope (D-PL8-24) | `child.kill()` on the direct pid | Group kill, wait for exit, classify as the abort reason |
| `gitHubWireUrl` (GHB-01) | Rewriting through `-c url.insteadOf` | Explicit wire URL per remote command; canonical `remote.origin.url` on disk |
| ESLint BLOCK F / `NETWORK_SEAMS` | Treating any `platform/git` import as equally networked | Separate local and remote lanes, and gate the remote lane only (Pitfall 10) |
| `child-process-chokepoint` | Adding several new spawning files | One platform module spawns git (and `taskkill` on Windows) |
| pi-subagents background child (`PI_SUBAGENT_CHILD=1`) | A child Pi starts a probe or a fetch | The child makes no installation change today (D-MB-12); keep the git seam unreachable there |
| `test/live-uat/*` canaries | Running against the user's real `~/.gitconfig` | Same hermetic environment as cucumber, plus an explicit operator opt-in for real credentials |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
| --- | --- | --- | --- |
| SSH probe on every operation | Each install is 1 to 10 s slower; doubled on failure | Cache per host per process; skip under the documented conditions | Any user without a GitHub ssh key |
| `--unshallow` as the first fallback | A pin on a large repository downloads full history, then times out | Fetch-by-sha first with protocol v2; unshallow only after a classified refusal | Repositories larger than about 100 MB of history |
| One `git` process per tag peel | `resolveTagOid` loops become N processes; slow on Windows (process start costs 30 to 100 ms) | One `for-each-ref` with `%(*objectname)` | Marketplaces with hundreds of release tags |
| `ls-remote` without a prefix | Full ref advertisement on large repositories | `ls-remote --tags origin 'refs/tags/<plugin>--v*'` with protocol v2 ref-prefix | Monorepos with many branches and pull-request refs |
| Full clones kept for marketplaces | Disk and time grow with history | Shallow where tags allow (Pitfall 5) | Long-lived marketplaces |

## Security Mistakes

| Mistake | Risk | Prevention |
| --- | --- | --- |
| Data values in argv without `--end-of-options` | Command execution through `--upload-pack` (E-6) | Terminator in the seam plus `domain/` validation (Pitfall 6) |
| No transport allow-list | `file://` / local-path clones; `ext::` if the user enabled it | `-c protocol.allow=never` plus explicit `https` / `ssh` (Pitfall 6) |
| Recursive submodules on an old git | CVE-2024-32002, CVE-2025-48384 class RCE on clone | Version floor or warning, `protocol.file.allow=never`, shallow submodules, opt-in only |
| Bare `git` spawned with `cwd` in a clone on Windows | A planted `git.exe` runs | Absolute git path resolved from `PATH` without cwd (Pitfall 12) |
| Hooks from user config run on clone | User or template hooks run inside the extension's operation and print to stdout | `core.hooksPath` neutralized (E-5b) |
| Credentials in URLs or stderr | Token leaks through `.git/config`, `ps`, or notifications | No userinfo in stored URLs; redact stderr with `redact-credentials.ts` |
| `safe.directory=*` | Re-opens CVE-2022-24765 | Never; classify the ownership error |
| Device Flow tokens left in the keychain | A `repo`-scope token stays usable by every git on the machine | Document removal; one-time notice (Pitfall 14) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
| --- | --- | --- |
| "git not found" reported as a network failure | The user debugs the network | Own reason, with the install hint per OS |
| Private repository reported as "not found" | The user thinks the name is wrong | Follow Claude Code's message for GitHub's `Repository not found` (check the binary); suggest `gh auth setup-git` or an ssh key |
| A hang with no output on a prompt | Pi looks frozen | No controlling terminal, plus a timeout with a "credential helper did not answer" reason |
| Spurious updates after migration on Windows | Every path plugin "updates" once | Decide autocrlf (Pitfall 4); one notice if a rehash is expected |
| Device Flow silently gone | A user who logged in through Pi cannot install after the token expires | One-time notice with the new path (Pitfall 14) |
| Ownership error | `dubious ownership` text reaches the user raw | Classified message naming the directory and `git config --global --add safe.directory <dir>` as the user's choice |

## "Looks Done But Isn't" Checklist

- [ ] **Non-interactive:** Every network command fails within its timeout with no TTY prompt when: no key, a passphrase-protected key, an unknown host key, a GCM helper, or `GIT_ASKPASS` set. Check on macOS and on Windows by hand, not only Linux CI.
- [ ] **Hermetic test:** `INHERITED_VARIABLES` includes `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_0`, `GIT_CONFIG_VALUE_0`, `GIT_CONFIG_PARAMETERS`, `GIT_SSL_CAINFO`, `GIT_SSH_COMMAND`, `GIT_SSH`, `HTTPS_PROXY`, `XDG_CONFIG_HOME`, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`.
- [ ] **CA trust:** The harness gives git the host certificate (`GIT_SSL_CAINFO` or `http.sslCAInfo`), and `NODE_EXTRA_CA_CERTS` still serves the hosted-manifest path.
- [ ] **Project scope inside a repository:** A damaged clone under `<cwd>/.pi/` never touches the project's `HEAD` or working tree.
- [ ] **Shallow and tags:** A path-source dependency with a range resolves when the satisfying tag is not on the tip.
- [ ] **PURL-04:** A pin on a second branch, after a ref-hint clone, succeeds.
- [ ] **Default branch:** A marketplace whose default branch moves is followed after `update`.
- [ ] **Migration:** An isomorphic-git clone with `symlinks = false` gets real symlinks after its first system-git operation, or is re-cloned.
- [ ] **Abort:** No `git` / `git-remote-https` process is left after an aborted background update, and the next run succeeds (no stale `*.lock`).
- [ ] **NFR-5:** Offline commands record zero host requests, and the local lane carries `-c protocol.allow=never`.
- [ ] **Injection:** Unit rows exist for a URL, ref, tag, and sha that start with `-`.
- [ ] **Locale:** Classifier tests run with `LANG=de_DE.UTF-8` set in the parent and still classify.
- [ ] **IL-2:** No git spawn uses inherited stdio. A clone with a stdout-printing hook in user config prints nothing to Pi's terminal.
- [ ] **Docs:** Both READMEs state the git requirement, the SSH and HTTPS rules, and the Device Flow change.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
| --- | --- | --- |
| Hang on a prompt (1) | LOW | User: Ctrl-C, then fix the key or helper. Code: add the missing environment variable or setsid, plus a scenario |
| Reset against the project repository (3) | HIGH | The user's uncommitted work may be lost (reflog recovers commits, not working-tree changes). Prevent it: guard plus ceiling |
| Spurious rehash (4) | LOW | One `apply`. Document it |
| Broken tag resolution after shallow (5) | MEDIUM | Re-clone marketplaces full or fetch tags; amend NFR-5 if it needs the network |
| Symlinks as text in old clones (7) | LOW | Normalize config and re-checkout, or re-clone on the next update |
| Stale locks (8) | LOW | Remove `*.lock` under the scope lock with no live child, or swap in a fresh staging clone |
| Lost Device Flow access (14) | LOW | `gh auth login` + `gh auth setup-git`, or an ssh key |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
| --- | --- | --- |
| 1 Prompts and hangs | P-Spawn, P-URL | Unit table on the environment; a scenario with an unknown host key and with GCM-like helper failure; manual macOS and Windows check |
| 2 User config leaks | P-Spawn | Table test of neutralize and respect rows; a cloud-sandbox run (`GIT_CONFIG_COUNT` present) |
| 3 Repository discovery | P-Spawn, P-Transport | Scenario: project scope inside a git repository with a damaged clone |
| 4 Bytes and versions | P-Transport (discuss decision) | Fixture test under `core.autocrlf=true` |
| 5 Shallow assumptions | P-Transport | Scenarios: off-tip tag, second-branch pin, refused unadvertised want |
| 6 Injection and transports | P-Spawn, P-URL, P-Transport | Unit rows with a leading dash; `/gsd-secure-phase` |
| 7 isomorphic-git clones | P-Migrate, P-Transport | Earlier-version fixture with `symlinks = false`; default-branch move scenario |
| 8 Kill, locks, rename | P-Spawn, P-Transport | `hold` arm plus abort, then process listing and retry |
| 9 Harness | P-Harness (early) | Hermetic test extended; all git scenarios green on both profiles |
| 10 NFR-5 local commands | P-Spawn | HOST-04 zero-request assertions; architecture test on the lane imports |
| 11 IL-2 output | P-Spawn | Spawn-option unit case; hook-in-user-config scenario |
| 12 Missing or old git, Windows lookup | P-Spawn | `git not found` scenario with an empty `PATH`; version-floor unit case |
| 13 Classification | P-Errors | Stderr corpus from real runs; locale row |
| 14 Device Flow | P-Auth, P-Migrate | Scenario: Device Flow state present, HTTPS 401, one notice |
| 15 URL selection | P-URL | Stub `ssh` on `PATH`; probe cached; base override does not trigger the skip |
| 16 Symlinks and containment | P-Transport | Outside-pointing symlink fixture |
| 17 Interface redesign | P-Transport | Fakes and orchestrator tests rewritten; 100% direct coverage |
| 18 `git-credential.ts` | P-Auth | File removed or moved behind the seam |
| 19 Docs and records | P-Close | `fallow dead-code --trace-dependency isomorphic-git` clean; rule pack updated |

## Experiment Log

Every experiment ran under `/tmp/claude-0/sysgit/` with `HOME=/tmp/claude-0/sysgit/home GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`, and with this sandbox's `GIT_CONFIG_COUNT` unset except in E-9 and E-15. A plain-HTTP host (`scripts/serve.mjs`, a `git http-backend` bridge in the shape of `features/lib/https-git-host/cgi.ts`) served `srv/acme/repo.git` on `127.0.0.1:18431`, and a TLS copy served it on `:18443`. The source repository had `crlf.txt` (CRLF), `lf.txt`, an executable `run.sh`, a symlink `escape-link -> ../../../etc/passwd`, annotated tags `v1.0.0` and `v1.1.0` on older commits, and a lightweight tag `light`. Tools: git 2.43.0, Node v24.22.3, isomorphic-git 1.44.10. No repository source file was changed.

- **E-0 (isomorphic-git clone read by system git).** `node scripts/iso-clone.mjs iso-full http://127.0.0.1:18431/acme/repo.git`, then `ls -a .git` → `HEAD config hooks index info objects refs` (no `packed-refs`, no `shallow`). `.git/config` → `filemode = false`, `symlinks = false`, `ignorecase = true`, `fetch = +refs/heads/*:refs/remotes/origin/*`. Index header `D I R C \0 \0 \0 002` (version 2). `git fsck --full` → no output. `git status --porcelain` → empty. `cat .git/refs/remotes/origin/HEAD` → `ref: refs/remotes/origin/main`. `ls -l escape-link` → `escape-link -> ../../../etc/passwd`. `od -c crlf.txt` → `l i n e 1 \r \n …` (bytes unchanged).
- **E-0b (symlinks = false).** Pushed a commit adding `newlink -> lf.txt`. `git -C iso-full fetch origin` → `e92c922..f2a88bd main -> origin/main`. `update-ref` + `reset --hard` → `-rw-r--r-- … newlink`, content `lf.txt`. `git -C iso-full -c core.symlinks=true checkout -q -f HEAD -- newlink` → `lrwxrwxrwx … newlink -> lf.txt`.
- **E-0c (filemode = false).** New executable `hook2.sh`, then fetch + `reset --hard` in iso-full → `-rwxr-xr-x … hook2.sh`.
- **E-1.** `git clone -q --depth 1 $U sh1; git -C sh1 tag -l` → (empty). `remote.origin.fetch` → `+refs/heads/main:refs/remotes/origin/main`. `rev-list --count HEAD` → `1`.
- **E-1b.** `git clone -q --depth 1 --branch v1.0.0 $U sh2` → stderr `Note: switching to 'e1161814…'. You are in 'detached HEAD' state…` (15 lines, exit 0). Tags → `light`, `v1.0.0`. Refspec → `+refs/tags/v1.0.0:refs/tags/v1.0.0`.
- **E-2.** `git -C sh1 fetch --depth 1 origin 70c24848…` (not a tip) → `* branch 70c24848… -> FETCH_HEAD`. `cat-file -t` → `commit`.
- **E-2b.** `git -C sh3 -c protocol.version=0 fetch --depth 1 origin 70c24848…` → `error: Server does not allow request for unadvertised object 70c24848…`.
- **E-2c.** `fetch --depth 1 origin 0123456789abcdef0123456789abcdef01234567` → `fatal: remote error: upload-pack: not our ref 0123…`.
- **E-3.** 401 endpoint, `GIT_TERMINAL_PROMPT=0 git clone … </dev/null` → `fatal: could not read Username for 'http://127.0.0.1:18431': terminal prompts disabled`, exit 128.
- **E-3b.** Same with `GIT_TERMINAL_PROMPT` unset, stdin an open pipe, no TTY → `fatal: could not read Username …: No such device or address`, exit 128 (this is what a session with no controlling terminal gives).
- **E-3c.** `git ls-remote http://user:s3cretTOKEN@127.0.0.1:18431/acme/nope.git` → `fatal: repository 'http://127.0.0.1:18431/acme/nope.git/' not found` (userinfo left out).
- **E-4.** `git -c core.autocrlf=true clone -q $U ac; od -c ac/lf.txt` → `a \r \n b \r \n c \r \n d \r \n`.
- **E-5.** `git -c core.hooksPath=…/uhooks clone -q $U hk` → the parent's stdout printed `HOOK-STDOUT`, and the hook wrote `post-checkout ran in /tmp/claude-0/sysgit/hk`.
- **E-5b.** Same plus `-c core.hooksPath=/dev/null` → no hook output, no marker file.
- **E-6.** `git clone "--upload-pack=touch /tmp/claude-0/sysgit/pwned;git-upload-pack" ./srv/acme/repo.git inj` → `done.`, and `pwned` was created.
- **E-6b.** `git clone -- "--upload-pack=…" inj2` → `fatal: repository '--upload-pack=…' does not exist`, no file.
- **E-6c.** `git ls-remote 'ext::sh -c touch% …'` → `fatal: transport 'ext' not allowed`.
- **E-7.** `git -c url.http://127.0.0.1:18431/acme/.insteadOf=https://github.com/acme/ ls-remote https://github.com/acme/repo.git HEAD` → served by the loopback host (`f2a88bd… HEAD`).
- **E-8 (default branch).** System clone `dh`. Server `symbolic-ref HEAD refs/heads/dev`. `git -C dh fetch -q origin; git -C dh symbolic-ref refs/remotes/origin/HEAD` → `refs/remotes/origin/main` (stale), while `ls-remote --symref` → `ref: refs/heads/dev HEAD`. isomorphic-git: clone with server HEAD=dev → `ref: refs/remotes/origin/dev`. Server HEAD back to main, `git.fetch` → `refs/remotes/origin/HEAD` became `ref: refs/remotes/origin/main` (followed).
- **E-9.** With this sandbox's injected config, `git ls-remote git@github.com:acme/repo.git` → `fatal: could not read Username for 'https://github.com': terminal prompts disabled` (the SSH URL was rewritten to HTTPS by `GIT_CONFIG_*`). `ssh -V` → `ssh: command not found`.
- **E-10.** `spawn("git-nonexistent-binary")` → `error` event `ENOENT spawn git-nonexistent-binary`.
- **E-10k (kill).** `scripts/kill-test.mjs` against a host that never answers: processes `git` → `git` → `git-remote-http`. After `child.kill("SIGTERM")`, the listing showed `git` (ppid 1) and `git-remote-http` still alive. With `detached: true` and `process.kill(-pid)`, one `git` (ppid 1) was still listed 1 s later.
- **E-11.** `touch dh/.git/index.lock; git -C dh checkout -q -f HEAD` → `fatal: Unable to create '…/dh/.git/index.lock': File exists.`
- **E-11b.** `touch sh1/.git/shallow.lock; git -C sh1 fetch -q --depth 1 origin main` → `fatal: Unable to create '…/sh1/.git/shallow.lock': File exists.`
- **E-12.** `chown -R nobody own; git -C own rev-parse HEAD` (as root) → `fatal: detected dubious ownership in repository at '/tmp/claude-0/sysgit/own'`. With `-c safe.directory='*'` → the sha.
- **E-13.** `git -C outer/.pi/pi-claude-marketplace/clones/broken rev-parse --show-toplevel` (no `.git` in `broken`) → `/tmp/claude-0/sysgit/outer`.
- **E-13b.** Same with `GIT_CEILING_DIRECTORIES=…/outer/.pi/pi-claude-marketplace/clones` → `fatal: not a git repository (or any of the parent directories): .git`.
- **E-14.** `outer` has local `url.http://127.0.0.1:18431/acme/.insteadOf https://example.invalid/acme/`. `(cd outer/.pi && git ls-remote https://example.invalid/acme/repo.git HEAD)` → `f2a88bd… HEAD` (the project's local config was applied).
- **E-14b.** `(cd outer/.pi && git clone -q https://example.invalid/acme/repo.git c14)` → `fatal: unable to access 'https://example.invalid/acme/repo.git/': CONNECT tunnel failed, response 403` (clone did not read the enclosing repository's config, and it went through the sandbox proxy).
- **E-15.** `env | grep ^GIT_` in this sandbox → `GIT_CONFIG_COUNT=3`, `credential.interactive=false`, two `url.https://github.com/.insteadOf` rows (`git@github.com:`, `ssh://git@github.com/`), `GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt`, `GIT_ASKPASS=` (empty), `GIT_TERMINAL_PROMPT=0`. `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.…insteadOf … git ls-remote https://example.invalid/acme/repo.git` under `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null` → served by the loopback host. `/etc/gitconfig` here has `filter.lfs.required=true`. `~/.gitconfig` has `commit.gpgsign=true`.
- **E-16.** TLS host with a self-signed P-256 certificate. `NODE_EXTRA_CA_CERTS=cert.pem git ls-remote https://127.0.0.1:18443/acme/repo.git HEAD` → `server certificate verification failed. CAfile: none CRLfile: none`. `GIT_SSL_CAINFO=cert.pem …` → `f2a88bd… HEAD`.
- **E-16c.** `http.sslCAInfo=cert.pem` in `GIT_CONFIG_GLOBAL` plus `GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt` → `server certificate verification failed. CAfile: /root/.ccr/ca-bundle.crt`. The config alone (E-16d) → success.
- **E-17.** `git ls-remote --end-of-options "--upload-pack=touch …"` → `fatal: strange pathname '--upload-pack=…' blocked`. `git -C sh1 fetch --end-of-options origin "--upload-pack=…"` → `fatal: invalid refspec '--upload-pack=…'`. No file created.
- **E-17b.** `git check-ref-format "refs/tags/-evil"` → exit 0.
- **E-18.** `git clone -q file:///…/srv/acme/repo.git fl` → success. `GIT_PROTOCOL_FROM_USER=0 git clone … fl2` → `fatal: transport 'file' not allowed`. `-c protocol.allow=never -c protocol.https.allow=always -c protocol.http.allow=always ls-remote file://…` → `fatal: transport 'file' not allowed`.
- **E-19 (single-branch refspec).** System: `git clone -q --single-branch --branch dev $U sb; git -C sb fetch -q origin; git -C sb branch -r` → `origin/dev` only. isomorphic-git `clone({ ref: "dev", singleBranch: true })`, then a system `fetch` → `origin/dev`, `origin/main` (its config kept the wildcard refspec).
- **E-20 (offline lane).** `git -c protocol.allow=never ls-remote https://127.0.0.1:1/acme/repo.git` → `fatal: transport 'https' not allowed`. `git -c protocol.allow=never -C iso-full rev-parse HEAD` → the sha.

## Sources

- This tree, read 2026-11-22: `extensions/pi-claude-marketplace/platform/git.ts`, `platform/git-credential.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/marketplace-tag-probe.ts`, `shared/git-failure-classifiers.ts`, `domain/version.ts`, `domain/auth-registry.ts`, `features/lib/hermetic-git.ts`, `features/lib/https-git-host/{server,cgi}.ts`, `features/step_definitions/git-host.steps.ts`, `features/support/pi-process.ts`, `test/architecture/hermetic-git-environment.test.ts`, `.planning/PROJECT.md` (Current Milestone). HIGH.
- Experiments E-0 to E-20 above. HIGH (observed on git 2.43.0 / Linux only).
- [Claude Code: Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md): the SSH probe, HTTPS fallback, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, "forbids it from prompting", "doesn't run askpass programs", LFS pointer files, symlink copy rules, re-clone on background-update failure, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, the 120 s clone timeout, and no in-session HTTPS fallback. The seam rates it LOW. Re-check against the 2.1.330 binary.
- [Claude Code issue 96811 (mirror): update forces HTTPS even when the clone works over SSH](https://claudeissues.com/issue/96811-plugin-marketplace-update-refresh-forces-https-and-fails-even-when-the-existing); [issue 13798 (mirror): HTTPS fallback fails with "terminal prompts disabled"](https://claudeissues.com/issue/13798-bug-private-marketplace-clone-fails-with-https-authentication-error). LOW: user reports, versions vary.
- [git 2.48.0 release notes](https://www.kernel.org/pub/software/scm/git/docs/RelNotes/2.48.0.adoc): `fetch` creates a missing `refs/remotes/<remote>/HEAD`, and `remote.<name>.followRemoteHEAD`. LOW (search snippet; read the full notes in P-Transport).
- [libuv `src/win/process.c` `search_path` (mirror)](https://git.stg.centos.org/source-git/libuv/blob/70c8fc7806dbdffcd346418faa460e9adc0fdecd/f/src/win/process.c): a bare filename is searched in the cwd before `PATH`; `.com`, then `.exe`. LOW (mirror, older version; verify on current Node for Windows).
- Training knowledge, unverified here: git `prompt.c` askpass order, git's `credential reject` on 401, Git for Windows' default `core.autocrlf=true`, CVE-2022-24765 / CVE-2024-32002 / CVE-2025-48384 fix versions, GitHub OAuth App and GitLab token lifetimes. MEDIUM. Each must be checked in the phase that relies on it.
