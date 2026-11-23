# Phase 2 (system-git) upstream-parity evidence: Git Process Seam and Typed Failures

Scope line (skill step 1): Phase 2 touches the upstream contract. A missing git, git prompting, git
running repository code, and the git failure classes are all things a Claude Code user meets on
`/plugin marketplace add` and `/plugin install`. Q11, Q12, and Q17 are mostly project constraints
(NFR-5, NFR-10, version floor) with a thin upstream position.

## Evidence base

- Binary: `/opt/claude-code/bin/claude`, `VERSION:"2.1.330"`, `BUILD_TIME:"2026-11-20T17:34:37Z"`,
  `GIT_SHA:"8c664bec500172ded713624f9ecac0eb7e714829"` (Linux build). Grepped on 2026-11-23 with
  `grep -oa` and a byte-offset context extractor (Python `mmap`). The binary was never run.
- Minified names (`ze`, `lce`, `uxt`, `nn`, `ZMo`, `mCi`, `kCi`, `$0t`, `kft`, `cG`, `p0s`, `ms`, `DCn`)
  belong to this build only. Each record quotes string literals for finding the code again.
- Linux-build caveat: platform predicates are compiled to constants here. `function le(){return!1}`,
  `function se(){return!1}` (Windows gates), `function ue(e){...return!1}` (Git for Windows launcher
  gate), and `function kft(n,e){return!1}` (macOS xcrun-shim check). So the Windows and macOS
  *branches* can be seen, but the gate and the macOS check body cannot. Records that rest on them
  are MEDIUM.
- Local git experiments: git 2.43.0, in a scratchpad tree, under `env -i HOME=<tmp> GIT_CONFIG_NOSYSTEM=1`.
  The real user config was not touched.
- Repository read 2026-11-23: `platform/package-manager.ts`, `platform/git-credential.ts`,
  `shared/errors.ts`, `shared/git-failure-classifiers.ts`, `orchestrators/marketplace/shared.ts`,
  `orchestrators/plugin/clone-cache.ts`, `rule-packs/architecture.json`, `eslint.config.js`,
  `.planning/PROJECT.md`, and `test/platform/git-ops-fake.ts`.

## Corrections to the milestone research (re-checked against 2.1.330)

| # | Research claim (file) | Verdict | Correction |
|---|---|---|---|
| C1 | The in-checkout list `uxt` (`core.fsmonitor=`, `core.hooksPath=/dev/null`, `core.askPass=`, `protocol.ext.allow=never`, `submodule.recurse=false`, `hook.*.enabled=false`, `gc.auto=0`, `maintenance.auto=false`) "sits in the `inCheckoutArgs` family", MEDIUM (FEATURES E-SG-09) | **Wrong layer, list incomplete** | `uxt()` is applied by the generic process wrapper `ze` (its log text is `execFileNoThrow`) through `lce(...)` to **every** git process whose program basename matches `/^git(\.exe|\.cmd|\.bat|\.com)?$/`, clone included. Each key is added as `-c key=value` unless the caller already passed that key. It is also exported to child gits through `GIT_CONFIG_COUNT` (`w1(o,f)`). The full list also has `log.showSignature=false`, `format.pretty=medium`, `diff.autoRefreshIndex=false`, `core.alternateRefsCommand=f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f` (behind flag `tengu_cozy_parasol`, default on), and `hook.<name>.enabled=false` for 28 hook names. The same layer adds these environment variables when they are absent: `GIT_NO_LAZY_FETCH=1`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_LFS_SKIP_SMUDGE=1`. It also sets `GIT_PROXY_COMMAND=""` unless the user set it. `inCheckoutArgs` is a different list: `Nn` (`core.hooksPath=/dev/null`, `core.fsmonitor=`) + `fxt` (`core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes`) + `pinArgs`. The plugin code imports `kt`/`ut` from the chunk that defines `ze`/`lce`/`uxt`/`aKe`/`fxt`. HIGH. |
| C2 | The local lane can carry `-c protocol.allow=never` as "a git-enforced guarantee" (PITFALLS Pitfall 10, E-20; SG-PRC-04 wording) | **Defeatable** | Experiment (git 2.43.0): with a user `protocol.file.allow=always` in `~/.gitconfig`, `git -c protocol.allow=never ls-remote file://...` exits 0. git reads `protocol.<name>.allow` before `protocol.allow`, from any scope. `GIT_ALLOW_PROTOCOL=/` held in the same setup (`fatal: transport 'file' not allowed`), and local `rev-parse` still worked. Upstream's own network-free lane (`ms()`) uses `GIT_ALLOW_PROTOCOL:"/"`, not `protocol.allow`. |
| C3 | Upstream has a local or network lane split for plugin commands (implied by SG-PRC-04) | **No such split** | `ms()` (the lane with `GIT_ALLOW_PROTOCOL=/`) serves Claude Code's reads of the user's own repository (`rev-parse --abbrev-ref HEAD`, `show-ref`, `config --get`, `status`, `--version`, and more; 253 call sites). Plugin and marketplace in-checkout commands (`rev-parse`, `checkout`, `read-tree`, `grep --cached`) use `inCheckoutArgs` and the remote environment, with no protocol lane. HIGH. |
| C4 | "Plugin clones force `LC_MESSAGES=C`" (FEATURES E-SG-09/10) | **Confirmed, narrower than SG-PRC-05 wants** | `sLo()` (`LC_ALL` moved to `LC_CTYPE`, `LC_MESSAGES:"C"`) is used only by the plugin clone (`mCi`) and the git-subdir clone (`kCi`). The marketplace clone (`ZMo`) matches English stderr without forcing a locale. HIGH. |
| C5 | Windows message `Command 'git' not found or is in an unsafe location (current directory)` (FEATURES E-SG-10) | **Confirmed, generic** | It is the message of the generic safe-spawn wrappers (`Xb`, `jM`) for *any* command name: `` Command '${e}' not found or is in an unsafe location (current directory) ``. It is not git-specific. HIGH for the literal, MEDIUM for when it fires (Windows gate stubbed). |
| C6 | Floor "2.25 ... which matches the floor Claude Code names" (STACK) | **Confirmed only as message text** | 2.25 appears only in the git-subdir git-missing message. No `git --version` probe was found on the marketplace or plugin clone paths (`ZMo`, `mCi`, `kCi`). Version probes do exist elsewhere: `claude plugin eval` (`var un=[2,31]`, refusal messages quoted under Q17), worktrees (`k>=36`, that is 2.36), the Git for Windows launcher bypass (`>=2.26`), and runner modes (2.29, 2.32). |
| C7 | macOS check "`U0r`/`kft`, stubbed out in this Linux build" (STACK) | **Confirmed, more detail** | `kft` is called from `ze` before every git spawn: `if(h!==null&&kft(b,h.env))return{stdout:"",stderr:U0r,code:127,error:U0r}`. It is also part of `$0t()` (git availability). Its body is `return!1` here, but the module imports `existsSync`, `lstatSync`, `readdirSync`, `statSync`, `isAbsolute`, and `join`, so the macOS check is a synchronous filesystem check with no spawn (inferred, MEDIUM). At run time, stderr containing `xcrun: error:` is also classified as git-missing. |
| C8 | ARCHITECTURE.md (codebase) says 17 `NETWORK_SEAMS` | **Stale count** | `eslint.config.js` lists 18 (`orchestrators/marketplace/hosted-catalog.ts` added, D-PL5-07). |
| C9 | "Four name-matchers" (task framing) | **Three in orchestrators, one in a test fake, plus three code-matchers in the classifier** | `orchestrators/marketplace/shared.ts:253` (`name === "NotFoundError"`), `orchestrators/plugin/clone-cache.ts:73` (`CommitNotFetchedError`) and `:78` (`NotFoundError`), and `test/platform/git-ops-fake.ts:75-76`. The classifier keys on `code`: `shared/git-failure-classifiers.ts:30` (`"HttpError"`), `:102` (`"UserCanceledError"`, code or name), and `:128` (`"NotFoundError"`). |

---

## Q1: git only, or an isomorphic-git fallback when git is missing?

**Question.** When git is absent, does Claude Code fall back to a non-git transport, and what does it tell the user?

**Claude Code behavior.** It has no general fallback and no in-process git implementation. With git missing it fails with a git-required message:

- `/plugin` discover empty state: `case"git-not-installed"` renders `Git is required to install marketplaces.` with the hint `Install git and restart Claude Code.`.
- git-subdir plugin source, checked before cloning: `git-subdir plugin source requires git to be installed and on PATH. Install git (version 2.25 or later for sparse-checkout cone mode) and try again.`, thrown as the typed class `eno`.
- macOS without Command Line Tools: `git is not installed on this Mac. To install it, run xcode-select --install, then try again.` (`U0r`). The process wrapper returns it as stderr with exit 127, and `rLo` classifies it, or any `xcrun: error:` line, as `eno` (git missing).
- Plugin-install fallback note: `` (The ${ss}'s copy could not be downloaded${e==="git-missing"?": git was not found":" from its host"}. ...`` (`_qa` maps `eno` to `"git-missing"` and `tno` to `"fetch-failed"`).
- One non-git transport exists, and only for Anthropic's official marketplace (`nh`). Claude Code downloads it from GCS first and uses git as the fallback (`plugin_official_marketplace_fetch` events `gcs_failed_git_fallback`, `gcs_failed_git_unavailable`; `Git not available, skipping official marketplace auto-install`; flag `tengu_plugin_official_mkt_git_fallback`). That is a hosted catalog for one reserved marketplace, not a git emulation. Pi's analogue already exists: hosted-manifest and path-source marketplaces.

**Evidence.** Binary 2.1.330, 2026-11-23. `grep -c isomorphic-git` gives 0. `nodegit` and `dugite` appear only in a native-module name list (offset ~2.66 MB: `node-hid`, `node-pty`, ...), not as a transport. The other strings are quoted above. `async function $0t(){let e=ce();return e.gitAvailable??=Sqr("git"),await e.gitAvailable&&!kft("git",process.env)}`. Call sites of `$0t()`: the discover empty state (`uqa`), git-subdir (`kCi`), the official-marketplace auto-install, and a settings gate. The marketplace add and plugin clone paths have no pre-check.

**Confidence.** HIGH that no fallback exists and for the message literals. MEDIUM for the exact text a user sees when `marketplace add owner/repo` runs on Linux with no git. Inferred: the spawn fails, `ze` returns `{stderr:"",code:1}`, and `ZMo` prints `git clone exited with code 1 (no stderr output). Run with --debug to see the full command.` This was not traced end to end.

**Unresolved.** How often git is missing on Windows (no upstream data, see Q3). The exact Linux no-git text for marketplace add.

**Pi/project constraints.**
- D-21's only reason was "git not found on PATH".
- NFR-2: no fix may require a Pi restart. Upstream's "restart Claude Code" comes from its per-process `gitAvailable` cache.
- SG-PRC-06 requires that path-source and hosted-manifest marketplaces work without git. They already do.
- SG-CLS-01 moves to Out of Scope if a fallback is kept.
- Pi's own `pi install git:` needs system git (Pi 1.5.1 `core/package-manager.js:1487`), so Pi users who install git packages already have it.

**Options.**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code`: system git only. Clear git-required message; path-source and hosted-manifest still work. | Parity. One transport, one classifier, one auth path. Gives SSH. Lets SG-CLS-01 delete isomorphic-git and its redirect client. | A user with no git loses git-source installs that work today over isomorphic-git (a regression for that group). | New `platform/git-process.ts`, `shared/errors.ts` git-missing kind, cucumber no-git scenarios. Risk: Windows users without Git for Windows. | Rec if parity and a single transport are the priority (research default). |
| B. Keep isomorphic-git as an HTTPS-only fallback when git is not found. | No regression for no-git users. | Two transports, two classifier sets, two auth paths. The redirect client and DD-3 gap stay. Doubled test matrix. No SSH on the fallback. SG-CLS-01 goes Out of Scope. Behavior differs by machine. | Keeps `platform/git.ts` dual-path, `git-auth-callbacks.ts`, and `isomorphic-git-chokepoint`. Doubles the cucumber transport matrix. Risk: silent behavior split. | Rec only if discuss finds no-git users common and the user records a D-SG divergence. |

**License a divergence needs.** Option B has neither license. Pi has no capability gap: system git is available on every Pi platform, and Pi itself spawns it. No recorded decision covers it, and D-21 is being reversed. It needs a new user-approved `D-SG-NN` ("friendlier for no-git users" is not a license by itself).

**Recommendation.** Option A.

**Reversibility.** A is **costly**: once Phases 3 and 8 delete the isomorphic-git transport, the redirect client, and the auth callbacks, a fallback means rebuilding a second transport. B is **reversible**: dropping a fallback later is a deletion.

---

## Q3: How upstream detects a missing or unusable git on macOS, Linux, and Windows, and what Pi already has

**Question.** How does Claude Code find git and decide that it is missing or unusable on each OS, and which messages does it print? Does Pi already resolve Windows `.exe` paths?

**Claude Code behavior.**

- **Lookup (all OSes):** `Dt()` resolves the git program once per process: `e.gitExecutable??=dG("git")||"git"`, where `dG = X = function X(o){return Bun.which(o)}`. The availability check `$0t()` is `Bun.which("git") !== null && !kft("git", env)`, cached in `gitAvailable` for the process lifetime. It is invalidated only by `wWa()` (sets false) after an `xcrun: error:` failure.
- **Linux:** a PATH lookup only. A missing git means the lookup misses, or a spawn `ENOENT`. Classification and message are as in Q1.
- **macOS:**
  - `kft(program, env)` runs inside the process wrapper before **every** git spawn. When it reports the xcrun shim (`/usr/bin/git` present without Command Line Tools), the wrapper returns `{stderr: U0r, code: 127}` without spawning. `U0r` = `git is not installed on this Mac. To install it, run xcode-select --install, then try again.`
  - At run time, stderr starting `xcrun: error:` (or equal to `U0r`) becomes `eno` (git missing) in `rLo`. The official-marketplace path then logs `git is a non-functional macOS xcrun shim, treating as git_unavailable`.
  - The `kft` body is stubbed in this build. Its imports (`existsSync`, `lstatSync`, `readdirSync`, `statSync`) suggest a filesystem-only check.
- **Windows** (`cG` -> `p0s` -> `z`):
  - It resolves a bare command name itself and never hands a bare `git` to the spawn.
  - Only absolute PATH entries are used (`K(n)` returns null when not absolute, so relative entries are dropped).
  - Extensions come from PATHEXT, filtered to `[".com",".exe",".bat",".cmd"]`.
  - The cwd is searched first (`ue={searchCwdFirst:!0}`), but any candidate inside the cwd, lexically or canonically and symlink-aware (`b5n`), is skipped.
  - `WindowsApps` aliases that answer `EACCES` count as found. Results are cached per PATH, PATHEXT, and cwd.
  - When nothing is found, the throwing wrappers raise `` Command '${e}' not found or is in an unsafe location (current directory) `` with `code: "ENOENT"`.
  - Git for Windows' `cmd\git.exe` launcher is bypassed to `mingw64|ucrt64\bin\git.exe` when that git reports version 2.26 or newer and `MSYSTEM` is unset (`Bn`/`Fn`, regex `/^git version (\d+)\.(\d+)\.\d+\S*\.windows\.\d+/`).
- **Messages per surface:**
  - UI empty state: `Git is required to install marketplaces.` / `Install git and restart Claude Code.`
  - git-subdir: the 2.25 message.
  - macOS: `U0r`.
  - Windows: the generic `Command '...' not found or is in an unsafe location (current directory)`.

**Pi today.** `platform/package-manager.ts` (D-PL9-18):
- `windowsPathDirectories()` keeps only `path.win32.isAbsolute` PATH entries and strips quotes.
- `findOnWindowsPath()` tries `<cmd>.exe` then `<cmd>.cmd` per directory in PATH order. It never searches the cwd and ignores PATHEXT.
- An `.exe` starts directly. A `.cmd` other than npm's is refused, because Node cannot start a `.cmd` without a shell. Not found gives `` `${command} was not found on PATH` ``.
- POSIX starts the bare command name.

It does not refuse an absolute PATH entry that lies inside the cwd, which upstream refuses. Git for Windows ships `cmd\git.exe` as a real `.exe`, so the `.exe` path covers git. The Pi host itself uses `cross-spawn` on win32 (`dist/utils/child-process.js:2`).

**Evidence.** Binary literals and functions quoted above, 2026-11-23. Repository `platform/package-manager.ts:27-33,386-444`.

**Confidence.**
- HIGH: the lookup functions, the extension list, the cwd rule, and the messages.
- MEDIUM: when the Windows and macOS branches fire (gates stubbed in the Linux build), and the `kft` body.
- LOW/none: how common a missing git is on Windows (no upstream data).

**Unresolved.**
- The macOS `kft` heuristic (which files it checks).
- Whether `Bun.which` on Windows searches the cwd (this affects `Dt()` before `ze`).
- The prevalence of missing git on Windows.
- Windows tty and process-tree behavior (research flag; a manual check is planned).

**Pi/project constraints.**
- NFR-2: a cached "git missing" verdict for the process lifetime would force a Pi restart after the user installs git. Cache only a positive lookup, or re-resolve per command.
- D-PL9-18 is the precedent: extract it into a shared helper, or `fallow dupes` fails.
- IL-2: messages go through `notify()`.
- Upstream's `.bat/.cmd` acceptance cannot be matched: Node spawn with no shell cannot run them (the Pi capability gap D-PL9-18 already records).

**Options.**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code` shape: resolve git per command (absolute path on Windows, PATH lookup on POSIX). Add a macOS shim check before spawn, classify `xcrun: error:` and ENOENT as git-missing, and refuse a Windows candidate under the cwd. Use upstream's messages with "restart" adapted. | Parity of detection and wording. Closes the binary-planting hole the same way upstream does. Reuses D-PL9-18. | The macOS shim heuristic must be designed without seeing upstream's body. Adds a cwd-containment check that D-PL9-18 lacks. | Extract `findOnWindowsPath` into a shared platform helper and add the cwd-refusal rule (both runners). New git-missing kind. Risk: macOS false positives. | Rec if parity of messages is wanted (default). |
| B. Spawn-and-classify only: no pre-check, map spawn ENOENT, exit 127 with `xcrun: error:`, and Windows not-found to git-missing. Windows still resolves an absolute `.exe`. | Simplest. No macOS heuristic to guess. Covers the shim at the first git call. | A first git call fails before the message instead of up front. Every surface needs the classification. | Same helper extraction, no shim module. Risk: low. | Rec if the macOS shim heuristic cannot be pinned without a Mac. |
| C. Probe `git --version` once per command (existence, usability, version together). | One spawn answers Q3 and Q17. Catches the xcrun shim, broken installs, and too-old git. | Extra spawn on every git command path (about 5 ms). Upstream does this only for `claude plugin eval`. | One probe in `git-process.ts`. Risk: probe output parsing on vendor builds (`.windows.N`, Apple Git). | Rec if Q17 picks "refuse below a floor". |

**License a divergence needs.**
- The "restart Claude Code" wording is licensed by NFR-2 (a recorded constraint). The message becomes "install git, then run the command again" or `/reload`.
- Refusing `.cmd/.bat` git launchers is licensed by the Pi capability gap D-PL9-18 records (no shell).
- C's per-command probe on install paths has no license, but it is behavior-invisible when git is fine.

**Recommendation.** Option A, with B's spawn classification as the always-on backstop. Exact messages:
- macOS: `git is not installed on this Mac. To install it, run xcode-select --install, then try again.`
- Windows: `Command 'git' not found or is in an unsafe location (current directory)`.
- Elsewhere: `Git is required to install marketplaces.` plus an adapted hint.

Cache only a positive lookup (NFR-2).

**Reversibility.** **Reversible.** Internal module and wording only.

---

## Q11: Local lane and network lane; NFR-5, BLOCK F `NETWORK_SEAMS`, `child-process-chokepoint`, and the SSH probe

**Question.** Does upstream run local-only git commands with a network block such as `-c protocol.allow=never`? Which of its git commands are local and which reach a remote? How should NFR-5, BLOCK F, and the rule pack change, and is the SSH probe a network seam?

**Claude Code behavior.**

- **No `protocol.allow=never` anywhere** (`grep -oa 'protocol.allow=never'` = 0). The only `protocol.allow` strings are entries in a config-key denylist.
- **Upstream's network-free lane is `ms()`**, used for Claude Code's reads of the user's own repository:
  - environment `GIT_ALLOW_PROTOCOL:"/"` (no transport name matches);
  - `GIT_CONFIG_PARAMETERS` aliasing `remote-none`, `remote-/`, and each listed transport's `remote-<x>` to `version` (neutralizes remote helpers), plus `fetch.bundleURI=` and `help.autocorrect=0`;
  - `GIT_NO_LAZY_FETCH=1`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_LFS_SKIP_SMUDGE=1`;
  - `LC_ALL=C`, `LANGUAGE=C` (unless `userLocale`);
  - `GIT_SSH_COMMAND:"false"` unless `GIT_ALLOW_PROTOCOL` lists `ssh`;
  - it strips the repository-pointer variables and `GIT_CONFIG_COUNT`, `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG`, and `GIT_CONFIG_KEY_n`/`VALUE_n`;
  - it filters `PATH` to absolute entries (else `/dev/null`);
  - matching argv prefix `EL` = `-c core.hooksPath=/dev/null -c core.fsmonitor= -c safe.bareRepository=explicit -c protocol.file.allow=never`.
- **Plugin and marketplace commands do not use that lane** (C3).
- **Remote (network) commands on the plugin surface:**
  - `clone` (marketplace `ZMo`, plugin `mCi`, git-subdir `kCi`);
  - `fetch` (SHA pin `fetch --depth 1 origin <sha>`, `--unshallow`, marketplace SHA-pin `bCn`: `fetch --upload-pack=git-upload-pack --no-tags --no-recurse-submodules origin +refs/heads/*:...`);
  - `ls-remote` (freshness, in a temp dir `claude-lsremote-`, `["-C",k,...inCheckoutArgs,"ls-remote",...o,"--",e,...r]`);
  - `submodule update --init --recursive --depth 1`;
  - with `--filter=blob:none` / `--filter=tree:0` partial clones, the follow-up `sparse-checkout` and `read-tree` can fetch lazily;
  - the SSH probe `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` (`DCn`, `cwd:Jut()`, timeout 3000, configured only on exit 1 plus `successfully authenticated`).
- **Local commands:**
  - `git config --get-regexp '^(core\.sshcommand|ssh\.variant)$'` in a private temp dir (`OF`, `claude-ssh-config-`);
  - `ssh -G git@github.com` (config dump, 5000 ms);
  - `ls-remote --get-url`;
  - `rev-parse` (pin verification `tLo`), `checkout <sha>`, `read-tree -u --reset HEAD`, `grep --cached`, `rev-parse --verify -q`.

**Pi today.**
- NFR-5 forbids network for `list`, `info`, `uninstall`, `marketplace remove`, and a load without autoapply.
- ESLint BLOCK F (`eslint.config.js:40-100`) is default-deny over `orchestrators/` and `domain/`. It bans any `platform/git` import (regex `platform\/(?:git|hosted-manifest)`) and the names `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, and the hosted-catalog names, except in the 18 `NETWORK_SEAMS`. The regex already matches a new `platform/git-process.ts`.
- The network-free commands therefore reach no git module at all today. Local verbs (`resolveRef`, `listTags`, `currentBranch`, `listRemotes`, `checkout`, `forceUpdateRef`, `resolveTagOid`) are reached only from seam modules on network-capable commands.
- `child-process-chokepoint` (`rule-packs/architecture.json`) exempts `platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, `platform/package-manager.ts`, and `platform/prompt-shell.ts`, citing D-21 / D-PL9-11 / D-CF1-02. `no-network-modules`' message names `platform/git.ts` as the git traffic path.

**Evidence.** Binary 2.1.330, 2026-11-23: `Y=Object.freeze({GIT_ALLOW_PROTOCOL:"/",GIT_CONFIG_PARAMETERS:i,GIT_NO_LAZY_FETCH:"1",...})`, `function ms(_,E={})...`, `EL=Object.freeze([...Nn,"-c","safe.bareRepository=explicit","-c","protocol.file.allow=never"])`, `async function DCn(){...kt("ssh",["-T","-o","BatchMode=yes","-o","ConnectTimeout=2","-o","StrictHostKeyChecking=yes","git@github.com"],{cwd:Jut(),timeout:3000})`. Experiment E-Q11 (git 2.43.0):

| Case | Command | Result |
|---|---|---|
| A | `-c protocol.allow=never`, no user config | refused (128) |
| B | user `protocol.file.allow=always` + `-c protocol.allow=never` | **allowed (0)** |
| C | `GIT_ALLOW_PROTOCOL=/` + user always | refused (128) |
| D | `GIT_ALLOW_PROTOCOL=/` + `rev-parse` | works |
| E | `-c protocol.file.allow=never` + user always | refused (128) |

**Confidence.** HIGH for upstream's commands and for `ms()`. HIGH for the precedence experiment, on git 2.43 only.

**Unresolved.** Whether a planned local verb must ever touch a partial clone (Pi plans no `--filter`; Q20 owns sparse). Whether `GIT_ALLOW_PROTOCOL=/` interacts badly with `submodule` local reads (none planned on the local lane).

**Pi/project constraints.**
- SG-PRC-04's wording (`protocol.allow=never`) is defeatable (C2). It should name the mechanism that holds, as a requirement amendment.
- NFR-5 text must name the SSH probe as network under git-source add and install.
- The probe spawns `ssh`, so the spawn module needs an `ssh` launch (Q18, Phase 4).
- The chokepoint, `no-shell-out.test.ts`, and `gate-targets.ts` change in the same commit (milestone rule).

**Options (lane mechanism).**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code` (plugin surface): no git-enforced lane; rely on the static gates (BLOCK F import gate plus a closed local-verb union in the spawn module). | Exact parity with upstream's plugin commands. Least code. | The guarantee is review and lint only. A hook or lazy fetch inside a local verb would not be stopped by git (hooks are off and `GIT_NO_LAZY_FETCH=1` anyway). | `git-process.ts` with a typed `local` / `network` flag, no env lane. Risk: low. | Rec if SG-PRC-04 is amended to "static gates suffice". |
| B. Upstream's own `ms()` lane mechanism on every local verb: `GIT_ALLOW_PROTOCOL=/`, `GIT_SSH_COMMAND=false`, remote-helper alias neutralization, `GIT_NO_LAZY_FETCH=1`, `GIT_LFS_SKIP_SMUDGE=1`, and `-c safe.bareRepository=explicit -c protocol.file.allow=never` (keep the user's other config). | A real git-enforced guarantee that user config cannot defeat (E-Q11 case C). It is upstream's own mechanism for its offline git reads. Meets SG-PRC-04's intent. | Applies upstream's repo-read lane to plugin clones, where upstream does not (an invisible divergence). The alias trick needs a unit row per transport. | One extra env builder branch plus a unit table. Risk: low. | Rec (default): SG-PRC-04 intent with a mechanism that holds. |
| C. `-c protocol.allow=never` as SG-PRC-04 says, with per-protocol `-c protocol.{https,http,ssh,file,git,ext,fd,ftp,ftps}.allow=never`. | Literal requirement wording. `-c` beats every config scope for the listed names. | An open-ended list: a user-installed `git-remote-<x>` helper name is not covered. A bare `protocol.allow=never` alone is defeated (E-Q11 case B). | Same as B, less robust. Risk: false sense of guarantee. | Rec only if `GIT_ALLOW_PROTOCOL` is rejected for some reason. |

**Gate changes (any option).**
- `child-process-chokepoint`: add `platform/git-process.ts`, and drop `platform/git-credential.ts` once its `git credential` spawn moves into it (SG-PRC-01 covers that launch). Rewrite the message from "five sanctioned spawn sites" and D-21 to the new `D-SG` ID. Mirror the change in `test/architecture/no-shell-out.test.ts` (the "exactly five files" literal and the D-21 text) and in `test/architecture/gate-targets.ts` `SHELL_OUT_EXEMPT_TARGETS`, in the same commit.
- ESLint: add a BLOCK C zone so that only `platform/git.ts` may import `platform/git-process.ts` (the `PACKAGE_INSTALL_SEAM` pattern). The BLOCK F regex already covers it, and `NETWORK_SEAMS` needs no new member in Phase 2.
- `no-network-modules` message: say that git traffic goes through `platform/git-process.ts` subprocesses.
- NFR-5 amendment (a `D-SG` ID): system git subprocesses are the network path. The SSH probe (`ssh -T ... git@<host>`, 3 s) is network and runs only where git-source `marketplace add`/`update`/`install` may already reach the network. `ssh -G` and `git config` reads are local. Local verbs run on the lane chosen above.

**Is the SSH probe a network seam?** Yes, by behavior: it opens TCP 22 to the host. In the gate it needs no `NETWORK_SEAMS` entry, provided it lives in `platform/git-process.ts` (or `platform/git.ts`) and is reached through the `GitOps` seam, which the seam modules already hold. It needs the `child-process-chokepoint` exemption to cover an `ssh` launch, and an NFR-5 text entry.

**License a divergence needs.** B runs upstream's own offline lane on a surface where upstream does not. No user-visible behavior changes (local verbs never need a transport), so it is a project-internal hardening choice with no upstream position on that surface. Record it as `D-SG-NN`. C needs the same record. A needs SG-PRC-04 amended.

**Recommendation.** Option B, and amend SG-PRC-04 to name `GIT_ALLOW_PROTOCOL` (C2 shows `protocol.allow=never` does not hold).

**Reversibility.** **Reversible.** One env-builder branch and documentation text.

---

## Q12: NFR-10 and the files git writes through the user's configuration

**Question.** Which files outside the containment roots can git write through the user's own configuration, and does upstream do anything to prevent those writes?

**Claude Code behavior.** It leaves the user's credential helpers and ssh configuration in force and does nothing to stop writes those programs make.

- Clone and fetch commands carry `credential.interactive=false` (through `GIT_CONFIG_COUNT`), `GCM_INTERACTIVE=never`, `GIT_ASKPASS=""`, and `GIT_TERMINAL_PROMPT=0`. None of these suppress the helper `store` action that git runs (`credential approve`) after a successful authenticated HTTP request. A `store` helper therefore rewrites `~/.git-credentials`, `osxkeychain` writes the login keychain, GCM writes its own store, and `cache` creates its socket under `~/.cache/git/credential/`.
- `credential.helper=` (clearing helpers) appears only on an unrelated 4 s anonymous `ls-remote --heads --exit-code` probe (with `http.saveCookies=false`, `core.askPass=`) and in `claude plugin eval`. It never appears on `ZMo`, `mCi`, or `kCi`.
- For ssh, `StrictHostKeyChecking=yes` (in `fxt`, in the rebuilt `GIT_SSH_COMMAND`, and in the probe) means ssh never **adds a new host** to `known_hosts`. The binary has no `UpdateHostKeys` and no `UserKnownHostsFile` string (0 hits each). From OpenSSH docs (memory, MEDIUM): OpenSSH 8.5 and later default `UpdateHostKeys` to on when `UserKnownHostsFile` is not overridden, so ssh can still **append extra keys of an already-known host** (GitHub sends them) after authentication. The user's ssh config can also create `ControlMaster` sockets.
- Upstream neutralizes repository-side writers: `gc.auto=0`, `maintenance.auto=false`, `fetch.writeCommitGraph=false` on one fetch, and hooks off. Those writes would land inside the clone anyway.

**Pi precedent.** D-BG-1102 (PROJECT.md): the Device Flow already runs `git credential approve`, and the cucumber scenarios read the token from `.git-credentials` in the sandbox HOME. So the extension already writes outside NFR-10's roots through the user's helper today, and NFR-10's text does not record it.

**Evidence.** Binary 2.1.330, 2026-11-23: `vve={GIT_TERMINAL_PROMPT:"0",GIT_ASKPASS:"",GCM_INTERACTIVE:"never"}`; `GJe(...)...w1(tA(e,"GIT_CONFIG_COUNT"),[["credential.interactive","false"]],e)`; `fxt=["-c","core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes"]`; the `ZMo` and `mCi` argv quoted under Q14. 0 hits for `UpdateHostKeys` and `UserKnownHostsFile`. Repository: `platform/git-credential.ts:150-160` (approve), and `.planning/PROJECT.md` D-BG-1102.

**Confidence.** HIGH that upstream has no prevention. MEDIUM for the OpenSSH `UpdateHostKeys` default and git's approve-after-success behavior (git source and OpenSSH docs from memory, not run here).

**Unresolved.**
- Whether `UpdateHostKeys` fires under `BatchMode=yes` on the probe (`-T`, no command). Plan one manual check.
- User `trace2.*Target` config can make every git command write a trace file anywhere. Upstream clears `GIT_TRACE2*` only on one repo-read path. It is minor, but it is also a write outside the roots.

**Pi/project constraints.**
- NFR-10 governs paths the extension writes ("Refuse to write outside..."). The milestone rule keeps the user's git configuration in production.
- SG-AUTH-01 relies on helpers working, so clearing `credential.helper` is not possible without breaking authentication.

**Options.**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code`: record an NFR-10 amendment. Writes that the user's own git and ssh configuration makes (credential helper stores, keychain, ssh `known_hosts` key updates, sockets, trace targets) are outside NFR-10's scope. The extension itself still writes only inside the roots. `StrictHostKeyChecking=yes` keeps new hosts out of `known_hosts`. | Parity. Truthful about D-BG-1102's existing behavior. No code. | Accepts writes the extension does not control. | Documentation (PROJECT.md NFR-10 text, a `D-SG` ID). Risk: none. | Rec (default). |
| B. A plus `-o UpdateHostKeys=no` appended to the rebuilt ssh command and the probe. | Removes the one ssh write that remains under `StrictHostKeyChecking=yes`. | Divergence from upstream's exact ssh flags. Older ssh (before 6.8) rejects an unknown `-o` key, which needs a version-aware guard. | One flag in the ssh-command builder plus a unit row. Risk: ssh version compatibility. | Rec if known_hosts mutation is judged a containment issue. |

A third option, clearing the user's helpers and re-adding them as get-only wrappers, is not viable. It is fragile per helper, breaks GCM and osxkeychain token refresh, and diverges heavily. It is listed only as a rejected alternative.

**License a divergence needs.** B has no Pi capability gap and no recorded decision. It needs a user-approved `D-SG-NN`. A needs only the NFR-10 amendment ID (an amendment, not a divergence).

**Recommendation.** Option A.

**Reversibility.** **Reversible.** Documentation, or one ssh flag.

---

## Q14 (in-checkout hardening list only): exact `-c` keys and environment, which commands carry them, and the `GIT_ASKPASS=""` vs `core.askPass` precedence

**Question.** Which `-c` keys and environment variables does upstream set on its git commands, which commands carry them, and does `GIT_ASKPASS=""` outrank `core.askPass`?

**Claude Code behavior (2.1.330).** Three layers combine on every plugin and marketplace git command.

1. **Generic process layer, on every git spawn** (`ze` -> `lce`, basename `/^git(\.exe|\.cmd|\.bat|\.com)?$/`).
   - Prepended `-c` keys, each skipped if the caller already passed that key:
     - `core.fsmonitor=`;
     - `core.hooksPath=/dev/null` (Windows `\\.\NUL`; a caller-supplied `core.hooksPath=/dev/null|\\.\nul` is normalized to the platform form);
     - `core.askPass=`;
     - `protocol.ext.allow=never`;
     - `core.alternateRefsCommand=f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f` (flag `tengu_cozy_parasol`, default on);
     - `submodule.recurse=false`, `log.showSignature=false`, `format.pretty=medium`, `gc.auto=0`, `maintenance.auto=false`, `diff.autoRefreshIndex=false`;
     - `hook.<name>.enabled=false` for applypatch-msg, pre-applypatch, post-applypatch, pre-commit, pre-merge-commit, prepare-commit-msg, commit-msg, post-commit, pre-rebase, post-checkout, post-merge, pre-push, pre-receive, update, proc-receive, post-receive, post-update, reference-transaction, push-to-checkout, pre-auto-gc, post-rewrite, sendemail-validate, fsmonitor-watchman, p4-changelist, p4-prepare-changelist, p4-post-changelist, p4-pre-submit, post-index-change.
   - The same keys are also appended to `GIT_CONFIG_COUNT` at the user's offset, so child git processes inherit them.
   - Environment added only when absent: `GIT_NO_LAZY_FETCH=1`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_LFS_SKIP_SMUDGE=1`. `GIT_PROXY_COMMAND=""` is set unless the user set it.
   - `allowRepoGitHooks` drops `core.hooksPath`, `core.askPass`, `submodule.recurse`, and `hook.*` (for user-intent commands, not plugin clones).
2. **Plugin and marketplace environment** (`aKe` -> `nn(GJe(rn()), sshSettings)`).
   - `rn()` deletes `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE`, `GIT_CEILING_DIRECTORIES`, `GIT_DISCOVERY_ACROSS_FILESYSTEM`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_SHALLOW_FILE`, `GIT_NAMESPACE`, `GIT_IMPLICIT_WORK_TREE`, and `GIT_REFERENCE_BACKEND`.
   - `GJe` **forces** `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, and `GCM_INTERACTIVE=never`, overriding user values and deleting other-case spellings on Windows. It appends `credential.interactive=false` through `GIT_CONFIG_COUNT`.
   - `nn` sets:
     - `GIT_SSH_COMMAND` to the user's chosen ssh (`GIT_SSH_COMMAND` > `core.sshCommand` > `GIT_SSH` > `ssh`) with `-o BatchMode=yes -o StrictHostKeyChecking=yes` (plink gets `-batch`; tortoiseplink gets none), wrapped as `CDPATH= cd -- <safe dir> 2>/dev/null || cd / || exit 1; <cmd>`. It deletes `GIT_SSH`.
     - `GIT_SSH_VARIANT` from `ssh.variant`.
     - It deletes `GIT_ALLOW_PROTOCOL` and translates it into `-c protocol.<x>.allow=never` for each of https, http, ssh, and file that the user's list omits.
     - It forces `GIT_LFS_SKIP_SMUDGE=1` and `GIT_DEFAULT_REF_FORMAT=files`.
   - `aKe` and `__n` set `GIT_CEILING_DIRECTORIES` to the target directory and refuse a path that contains the PATH delimiter. The message begins `Cannot run git under ...`.
   - Plugin and git-subdir clones add `LC_MESSAGES=C` (`LC_ALL` moved to `LC_CTYPE`).
3. **Plugin argv.**
   - `pinArgs` = `-c protocol.ext.allow=never -c protocol.fd.allow=never -c protocol.git.allow=never -c protocol.ftp.allow=never -c protocol.ftps.allow=never` [+ the translated user `GIT_ALLOW_PROTOCOL`] `-c init.defaultRefFormat=files -c core.longpaths=true`.
   - `inCheckoutArgs` = `-c core.hooksPath=/dev/null -c core.fsmonitor= -c core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes` + `pinArgs`.

**Which commands carry what.**
- Clone (`ZMo`, `mCi`, `kCi`): `fxt + pinArgs` + layer 1, `stdin:"ignore"`, `-- <url> <dir>`.
  - `ZMo` adds `--depth 1` (not for SHA refs), `--no-recurse-submodules`, and `--filter=blob:none` for sparse or SHA cases.
  - `mCi` adds `--depth 1` and `--recurse-submodules --shallow-submodules` (or `--no-recurse-submodules` with `-c submodule.recurse=false`). It refuses a ref starting with `-` and a SHA outside `^([0-9a-f]{40}|[0-9a-f]{64})$`.
- In-checkout commands (pin fetch, `checkout`, `rev-parse`, `read-tree`, `submodule update`, `grep --cached`, and `ls-remote` in a temp dir): `inCheckoutArgs` + layer 1.
- Other fetch extras on one marketplace fetch: `-c fetch.writeCommitGraph=false -c fetch.bundleURI= -c transfer.bundleURI=false -c remote.origin.followRemoteHEAD=never` and `--no-tags --no-write-fetch-head --refmap= --no-recurse-submodules --end-of-options origin refs/heads/<b>`. The command is retried with `--dry-run` on exit 129, which means an older git.
- Timeouts and tty: `withoutControllingTerminal` (detached on non-Windows) is passed for the marketplace clone only when a lock holder is given, and for some `ls-remote` calls. The plugin clone uses `waitForExitAfterKill:!0`.
- Not set upstream: `core.symlinks`, `core.autocrlf`, `advice.detachedHead`, `init.templateDir` on plugin paths (`init.templateDir=` appears only in another feature's list `kHo`), `SSH_ASKPASS_REQUIRE` in the git environment (it appears only in an environment-strip list), `http.saveCookies` on plugin paths, and `UpdateHostKeys`.

**Precedence of `GIT_ASKPASS=""` vs `core.askPass`.** git's `git_prompt` order is `GIT_ASKPASS`, then `core.askPass`, then `SSH_ASKPASS`, and an empty but set value stops the chain and runs nothing. Verified on git 2.43.0 (E-Q14, `git credential fill` with no helper):

| Case | Setup | Result |
|---|---|---|
| 1 | `core.askPass=<script>` | askpass ran |
| 2 | Case 1 + `GIT_ASKPASS=""` + `GIT_TERMINAL_PROMPT=0` | `fatal: could not read Username for 'https://example.invalid': terminal prompts disabled`, askpass not run |
| 3 | Case 2 + `SSH_ASKPASS=<script>` | not run |
| 4 | `SSH_ASKPASS` + `-c core.askPass=` (no `GIT_ASKPASS`) | not run |
| 5 | `SSH_ASKPASS` only | ran |

So `GIT_ASKPASS=""` outranks both `core.askPass` and `SSH_ASKPASS` for git's own prompts. An empty `core.askPass` also blocks the `SSH_ASKPASS` fallback but not a set `GIT_ASKPASS`. Upstream sets both and forces `GIT_ASKPASS` over the user's value. ssh's own passphrase askpass is separate and is stopped by `BatchMode=yes`. Also verified: a `-c` value beats a `GIT_CONFIG_COUNT` value for the same single-valued key (both "command" scope; `-c` is read last).

**Evidence.** Binary strings quoted above, 2026-11-23 (`function uxt(){return[["core.fsmonitor",""],["core.hooksPath",KLr()],["core.askPass",""],["protocol.ext.allow","never"],...]}`, `uLs={GIT_NO_LAZY_FETCH:"1",GIT_NO_REPLACE_OBJECTS:"1",GIT_TERMINAL_PROMPT:"0",...oft}`, `oft=Object.freeze({GIT_LFS_SKIP_SMUDGE:"1"})`, `function nn(e=GJe(rn()),n){...inCheckoutArgs:[...Nn,...fxt,...r]...}`, `var zt=["-c","protocol.ext.allow=never",...]`, `var en=["-c","init.defaultRefFormat=files"],Fe={GIT_DEFAULT_REF_FORMAT:"files"},tn=["-c","core.longpaths=true"]`). Plus experiments E-Q14.

**Confidence.** HIGH for the lists, the layers, and the command coverage. HIGH for askpass precedence (experiment on git 2.43). MEDIUM for Windows `\\.\NUL` behavior (unrun).

**Pi/project constraints.**
- `platform/git-credential.ts:150-160` sets only `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` today.
- IL-2: hooks off also keeps hook stdout out of the TUI (PITFALLS E-5).
- The milestone rule: one unit row per setting neutralized or respected.
- The `core.alternateRefsCommand` value is a shell function. Git runs it through `sh`, which Git for Windows bundles.
- `GIT_CEILING_DIRECTORIES` cannot express a path that contains `:` (POSIX) or `;` (Windows). Upstream refuses such paths, and Pi's scope roots could contain one.

**Options.**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code` exact: copy the three layers as upstream composes them (generic list on every git spawn, `pinArgs` on clones, `inCheckoutArgs` on in-checkout commands, `GJe`/`rn`/`nn` environment, `LC_MESSAGES=C` on plugin clones only). | Byte-for-byte parity. Easy to re-check per upstream build. | Three call-shape variants. The marketplace clone stays locale-sensitive, which conflicts with SG-PRC-05's `LC_MESSAGES=C` for all. | `git-process.ts` env/argv builder with two modes plus a unit table. Risk: low. | Rec if strict per-command parity is wanted. |
| B. One builder producing upstream's **effective union** on every git spawn (layer 1 + `inCheckoutArgs` keys + `GJe`/`rn`/`nn` env + `GIT_CEILING_DIRECTORIES` + `LC_MESSAGES=C` everywhere), with the local lane from Q11 for local verbs. | The same effective set upstream applies to its in-checkout commands. Simpler call sites. Satisfies SG-PRC-05 (locale on all). No user-visible difference. | `core.sshCommand` and protocol bans also land on local verbs (harmless). `LC_MESSAGES=C` on the marketplace clone diverges invisibly. | One builder plus a table test. Risk: low. | Rec (default). |
| C. B plus PITFALLS extras: `init.templateDir=`, `advice.detachedHead=false`, `SSH_ASKPASS_REQUIRE=never`, `GIT_TRACE*` scrub, and `UpdateHostKeys=no`. | Closes template hooks, stderr noise, and trace writes. | Each extra is a divergence that needs a `D-SG` ID. `SSH_ASKPASS_REQUIRE` needs OpenSSH 8.4+. `UpdateHostKeys` is Q12's open question. | Builder rows plus records. Risk: older ssh. | Rec for `init.templateDir=` only (template hooks are the code-execution class the list targets). Others only if the user wants them. |

**License a divergence needs.**
- B's `LC_MESSAGES=C` on marketplace clones is licensed by SG-PRC-05 once recorded as `D-SG-NN` (no user-visible change).
- C's extras each need a user-approved `D-SG-NN`. `init.templateDir=` is arguably covered by SG-PRC-03 ("cannot run code"), but record it.

**Recommendation.** Option B, plus `init.templateDir=` from C. Keep `core.alternateRefsCommand` (upstream default on). Keep `GIT_PROXY_COMMAND=""` (upstream). Refuse scope paths containing the PATH delimiter, as upstream does.

**Reversibility.** **Reversible** to add keys later. Removing a key later is a security regression, so treat removals as costly.

---

## Q17: The git version floor

**Question.** Does upstream probe `git --version` or enforce a minimum on the plugin surface? Which features of the planned transport need which git version?

**Claude Code behavior.** On the marketplace and plugin clone paths it neither probes `git --version` nor enforces a minimum. It degrades instead: the marketplace fetch retries with `--dry-run` when git exits 129, which means an older git rejected `--no-write-fetch-head`.

The only floor number on this surface is in the git-subdir message (2.25, "for sparse-checkout cone mode"). Version probes with refusal exist elsewhere:
- `claude plugin eval`: `var un=[2,31]`. Messages:
  - `git ${g}.${a} is too old for claude plugin eval: it ignores the environment configuration (GIT_CONFIG_COUNT, added in git ${h}.${y}) that switches off the repository's git hooks and helper programs for the run. Install git ${h}.${y} or newer.`
  - `git on this host did not print a version claude plugin eval can read, ...`
  - a timeout variant.
- Worktree support: `y>2||y===2&&k>=36`.
- The Git for Windows launcher bypass: 2.26 or newer.
- Runner modes: `--use-anthropic-git-proxy requires git >= 2.32`; resume 2.29.

**Planned-transport features by git version.**
- **Hard (argv) floor:** `--end-of-options` (2.24). Older git treats it as a revision or path and fails.
- **Silently ignored by older git:**
  - `GIT_CONFIG_COUNT` (2.31): `credential.interactive=false` would be lost. Upstream has the same gap; `GCM_INTERACTIVE=never` still holds.
  - `init.defaultRefFormat` and `GIT_DEFAULT_REF_FORMAT` (2.45): older git only writes the `files` format anyway.
  - `remote.origin.followRemoteHEAD` (2.48).
  - `GIT_NO_LAZY_FETCH` (about 2.45; MEDIUM).
  - `hook.<name>.enabled` (config hooks, recent; MEDIUM).
  - `safe.bareRepository` (2.38).
- **Behavioral:**
  - Client protocol v2 by default: 2.26, reverted in 2.27, default again in 2.28 (LOW on the revert). Below that, fetch by SHA falls back to `--unshallow`. Fix with `-c protocol.version=2`.
  - `ls-remote --symref` (2.8), `--shallow-submodules` (2.9), sparse cone mode (2.25).
  - Submodule fixes: CVE-2024-32002 fixed in 2.45.1, 2.44.1, 2.43.4, 2.42.2, 2.41.1, 2.40.2, 2.39.4. CVE-2025-48384 fixed in 2.43.7, 2.44.4, 2.45.4, 2.46.4, 2.47.3, 2.48.2, 2.49.1, 2.50.1. MEDIUM, from memory; distributions backport.
  - `protocol.file.allow=user` default since 2.38.1.
- **Platform reference points (STACK, MEDIUM):** Ubuntu 20.04 ships 2.25.1, Ubuntu 22.04 2.34.1, Debian 12 2.39, RHEL 9 2.43, macOS CLT Apple Git 2.39 or newer.

**Evidence.** Binary 2.1.330, 2026-11-23 (literals above; `K.exitCode===129` retry; `function zpe(e){...y>2||y===2&&k>=36}`). Version facts are from memory and STACK.md (MEDIUM). git-scm.com was not checked in this session.

**Confidence.** HIGH that there is no plugin-path probe. MEDIUM for the per-feature introduction versions and CVE fix lines.

**Unresolved.** The exact error text and exit code of git older than 2.24 when it meets `--end-of-options` (not run). The git version on CI's runner image (SG-HRN-04 now logs it).

**Pi/project constraints.**
- NFR-2 and NFR-3: a too-old git should fail clean with a clear reason rather than a mystery.
- The `D-PL7-01` closed reason set: a "git too old" reason would be a new member.
- CI runs one Node and one Linux image (D-01). A floor leg adds a container job and its timeout rules (D-CF1-16).

**Options.**

| Option | Pros | Cons | Complexity | Recommendation |
|---|---|---|---|---|
| A. `Claude Code`: document a floor (README and codebase docs; 2.25 matches upstream's only number and covers `--end-of-options`), with no probe. Use only argv flags that exist by the floor, and classify `unknown option` / exit 129 as an "other" git failure. | Parity. No extra spawn. | A user on old git gets a generic failure instead of "upgrade git". | Docs plus a classifier row. Risk: low. | Rec (default). |
| B. Probe `git --version` once per command and refuse below the floor with an upstream-style message (the `claude plugin eval` wording pattern, "Install git X.Y or newer."). | A clear, actionable message. Precedent in upstream's eval command. Pairs with Q3 option C. | An extra spawn on every git path. Vendor version strings (`.windows.N`, Apple Git) need a parser. A new closed-set reason. Diverges from the upstream plugin path. | Probe in `git-process.ts`, a positive-only cache (NFR-2), a new error kind, and a cucumber scenario with a stub `git`. Risk: parser false refusals. | Rec if the README promises a floor and support load from old git matters. |
| C. Add a CI floor-version leg (a container with git 2.25.x) running integration and cucumber, combinable with A or B. | Proves the documented floor holds. Catches flags newer than the floor. | A new CI job: image upkeep, timeout rules, and the cucumber stand-in's `git http-backend` on old git. | `.github/workflows/ci.yml` job plus docs. Risk: flaky image, stand-in incompatibility. | Rec only if the floor is published as a support promise. Optional otherwise. |

**License a divergence needs.** B refuses on a surface where upstream does not. No Pi capability gap applies, so it needs a user-approved `D-SG-NN`. A needs none. C has no upstream position (CI is project-internal).

**Recommendation.** Option A. Document 2.25, add an `unknown option` / exit-129 classifier row, and log the git version in debug output. Defer C unless the README makes a support promise.

**Reversibility.** A is **reversible**. B is **reversible**, but users see it. C is **reversible** (a CI job).

---

## SG-PRC-05: typed git errors today and the upstream classes the kinds must carry

**Today (repository, 2026-11-23).**

- `shared/errors.ts`, git-related classes:
  - `PinnedCommitMissingError` (INR-03, `sha`);
  - `CrossOriginChallengeError` (DD-3 redirect challenge; its cause goes away with system git);
  - `StoredCredentialRejectedError` (GAUTH-04, `host`);
  - `TooManyRedirectsError` (IN-03; its cause goes away);
  - `HostedManifestHttpError` (shaped like isomorphic-git's `HttpError`: `code = "HttpError"`, `data.statusCode`, so the git ladder classifies hosted downloads; keep it for `platform/hosted-manifest-fetch.ts`);
  - `HostedManifestFetchError` (`failure: "network" | "unreadable"`);
  - `FetchedUrlCause` (GHB-01);
  - `InvalidGitHubBaseUrlError`;
  - `StaleSourceCloneError`, `UnremovableLeftoverCloneError`, `UnreadableSourceCloneError`;
  - `MarketplaceUpdateError` (wraps a cause);
  - `DeviceFlowUnavailableError`.

  No class exists for git missing, timeout, auth over SSH, host key, ref missing, or repository not found. Those arrive today as isomorphic-git errors or Node errnos.
- Name and code matchers that SG-PRC-05 replaces with `instanceof`:
  - `orchestrators/marketplace/shared.ts:253` `isGitNotFoundError` (`name === "NotFoundError"`, the D-14 deleted-branch fallback at `:326`);
  - `orchestrators/plugin/clone-cache.ts:73` `isGitCommitNotFetchedError` and `:78` `isGitNotFoundError`;
  - `shared/git-failure-classifiers.ts:30` (`code === "HttpError"`), `:102` (`UserCanceledError`), and `:128` (`code === "NotFoundError"`);
  - the test double `test/platform/git-ops-fake.ts:75-76` manufactures `NotFoundError`.
- The classifier's closed reasons (D-PL7-01): `network unreachable`, `authentication required`, `source missing`, `network error` (plus the hosted `unreadable`). The per-operation rule is D-PL7-02: `notFound`, `missingRef`, and `unknown`.

**Upstream classes the kinds must be able to carry** (binary 2.1.330; wording is Phase 6's job, but Phase 2's kinds must keep the distinctions).

| Upstream class (trigger) | Where | Suggested kind |
|---|---|---|
| Clone timed out (`timedOut`, message names `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, seconds) | `ZMo`, `oLo` | `timeout` (carry `timeoutMs`) |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | `ZMo` | `ssh-host-key-changed` (carry host) |
| `Host key verification failed` | `ZMo`; the probe's `zpt` | `ssh-host-key-unknown` (carry host) |
| `Permission denied (publickey)` / `Could not read from remote repository` | `ZMo`; probe | `ssh-auth` (carry host label) |
| `Authentication failed`, `could not read Username`, `unable to get password from user`, `terminal prompts disabled`, 401/403 | `ZMo` | `https-auth` (carry host) |
| `timed out`, `timeout`, `Could not resolve host`; plugin `SCi` regex (`fatal: unable to access '...': `, `error: RPC failed; curl (6\|7\|18\|28\|35\|52\|55\|56\|60\|92)`, `HTTP 4xx/5xx`, `ssh: Could not resolve hostname `, `ssh: connect to host ... port ...: `, `fatal: unable to connect to `) | `ZMo`; `rLo` -> `tno` | `network` (carry curl code or HTTP status when present, for D-PL7-02's 404/410 to `source missing`) |
| `xcrun: error:`, `U0r`, spawn ENOENT, Windows not-found or unsafe | `rLo` -> `eno`; `ze` exit 127 | `git-missing` (carry platform hint) |
| `remote: access denied by the git proxy` + 403 (`MCn`) | `rLo` -> `$Ut` | `proxy-refused` (remote-session only upstream; carry it but Pi likely never sees it) |
| `fatal: remote error:` | `rLo` (generic Error) | `remote-error` |
| Empty stderr with non-zero exit | `ZMo` | `no-stderr` (carry exit code) |
| SHA pin mismatch (`sha_pin_mismatch`, `SHA pin verification failed: expected ...`) | `tLo`, `bCn` | `pin-mismatch` (or keep `PinnedCommitMissingError`) |
| Invalid SHA, ref starting with `-`, refused URL (`Refusing to clone. `), control characters (`Invalid git URL: ... control characters are not allowed`) | `eLo`, `mCi`, `r$t` | `refused-input`: pre-spawn validation, not a git exit |
| Telemetry buckets `Epe`: `dns_or_refused`, `timeout`, `conn_reset`, `auth`, `not_found`, `tls`, `invalid_schema`, `other` | `Epe` | Not emitted (IL-4), but they show distinctions worth keeping: `tls` and `conn_reset` are separate from `network` upstream only in telemetry |

Pi needs these kinds beyond upstream's message classes, because they replace isomorphic-git matchers:
- `ref-missing` (remote `fatal: couldn't find remote ref`, which upstream matches as `^fatal: couldn't find remote ref ` elsewhere);
- `local-ref-missing` (`rev-parse --verify --quiet` exit 1, replacing `NotFoundError` at `shared.ts:253` and `clone-cache.ts:78`);
- `commit-missing` (checkout of an absent commit, replacing `CommitNotFetchedError` at `clone-cache.ts:73`);
- `repo-not-found` (`Repository not found` or HTTP 404/410, feeding D-PL7-02's `notFound`);
- `protocol-refused` (`transport '<x>' not allowed`, the local lane and protocol bans);
- `dubious-ownership` (`detected dubious ownership`);
- `aborted` (the `runWithGitAbortSignal` kill);
- optionally `git-too-old` (only if Q17 option B).

Suggested shape (ARCHITECTURE.md): `GitCommandError { kind, exitCode, stderr (redacted), operation }` with subclasses or a `kind` discriminant, `name` set per CONVENTIONS, and narrowed by `instanceof` plus a `switch` on `kind` with `assertNever`. Classify from exit status and `LC_MESSAGES=C` stderr prefixes (C4: upstream's marketplace path does not force the locale; Pi should, per SG-PRC-05).

Confidence: HIGH for the upstream literals and the repository inventory. The suggested kind names are a design proposal, not upstream.
