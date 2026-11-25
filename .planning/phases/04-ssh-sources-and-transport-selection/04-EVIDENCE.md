# Phase 4 (system-git) upstream-parity evidence: SSH Sources and Transport Selection

Scope line (skill step 1): Phase 4 touches the upstream contract. Which addresses
`/plugin marketplace add` and a plugin entry accept, which transport an `owner/repo` source
clones over, the progress lines and the both-failed error, and whether an SSH clone is the
same source as its HTTPS form are all things a Claude Code user meets on `/plugin marketplace
add`, `/plugin marketplace update`, `claude plugin install`, and `/plugin install`. The
`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` interplay (D-MF-01, D-SG-16) and the `plugin-clones/<key>/`
directory have no upstream analogue; those records recommend from Pi and project constraints.

## Evidence base

- Binary: `/opt/claude-code/bin/claude`. The task named 2.1.331; the file on disk is
  **`VERSION:"2.1.332"`, `BUILD_TIME:"2026-11-24T19:09:44Z"`,
  `GIT_SHA:"f2426755e0f17a3e021ff027d3c7af1ed42aedc2"`** (Linux build). Grepped on 2026-11-25 with
  the byte-offset extractors `tools/ctx.py` and `tools/ctxa.py` (Python `mmap`; `ctxa.py` prints only
  hits inside JavaScript) in the scratchpad. The binary was never run.
- Strings dump `cc-strings.txt` in the scratchpad is of **2.1.330** (`GIT_SHA:"8c664bec..."`, the build
  02-EVIDENCE and 03-EVIDENCE read), so every finding below was checked in both builds. Differences
  are listed under "Changes since 2.1.330".
- Minified names (`Jxn`, `u0e`, `Qmt`, `Nrl`, `zHi`, `Lre`, `GHi`, `KHi`, `iTs`, `N2t`, `$Ce`, `Ort`,
  `wjt`, `_At`, `Njt`, `_Fi`, `Rqo`, `Djt`, `wqo`, `PJt`, `zmt`, `Uze`, `Ype`, `bqo`, `MBn`, `QPa`,
  `rDn`, `hxe`) belong to 2.1.332 only. 2.1.330's names are given where the milestone research used
  them (`DCn`, `LNe`, `qpt`, `kWa`, `hCi`, `Aoe`, `yCi`, `vas`, `ove`, `EJe`, `R$t`, `k4t`). Each record
  quotes string literals for finding the code again.
- Cited, not re-derived: FEATURES.md E-SG-01..E-SG-13 (2.1.330 reading, docs fetched 2026-11-22);
  02-EVIDENCE Q11 (the probe is a network operation, the lanes), Q14 (the three hardening layers,
  `nn`'s ssh wrapper), SG-PRC-05 (the ssh failure kinds); 03-EVIDENCE Q8 (D-SG-16 `insteadOf`),
  Q9/C4 (re-clone and swap, D-SG-10), Q10/C3 (marketplace tag `ls-remote`, D-SG-09), Q16
  (`H.bool()` truthy set `1`/`true`/`yes`/`on`, D-SG-15).
- Local experiments: git 2.43.0, Node 24 (`/opt/pi-claude-marketplace/bin`), in
  `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/ev4/`
  under `env -i HOME=<scratch>/home PATH=/usr/bin:/bin GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`.
  The only remote is a `file://` bare repository. There is **no `ssh` binary** (`command -v ssh`
  exits 127), and none was installed. Clones over SSH URLs ran through a `GIT_SSH_COMMAND` shell
  stand-in (`ev4/sshstub.sh`) that logs its argv and runs `git-upload-pack` on the local bare
  repository, so git's own URL handling is real and nothing leaves the machine. Experiment IDs are
  `E4-*`. No request left loopback.
- Not measurable here: a real `ssh -T git@github.com` (no ssh, no network), `ssh -G` output, a real
  key or agent, Windows behavior.
- Repository read 2026-11-25 on `features/system-git`: `domain/source.ts`, `domain/clone-key.ts`,
  `orchestrators/marketplace/{add,clone-swap}.ts`, `platform/git.ts`, `platform/git-process.ts`,
  `platform/git-failure-kind.ts`, `shared/github-base-url.ts`, `orchestrators/plugin/clone-cache.ts`,
  `orchestrators/auth-host.ts`, and the `networkCloneUrl` callers.

## Changes since 2.1.330 (re-checked in 2.1.332)

| # | Item | 2.1.330 | 2.1.332 | Effect on Phase 4 |
|---|---|---|---|---|
| V1 | Bundle shape | one blob | bun bytecode chunks, each headed `// Version: 2.1.332` | Names moved; literals identical. |
| V2 | Probe `ssh -T ...`, three-state result, `zpt`/`Jmt` classifier | `DCn` | `Jxn`, same argv, timeout, literals | None. |
| V3 | Plugin skip rules (`qpt` -> `Qmt`), `-G` Windows check, both log lines `... staying on SSH` | present | identical | None. |
| V4 | Plugin `github` clone (`hCi` -> `zHi`), retry text `The retry over SSH failed too:` | present | identical | None. |
| V5 | URL validator (`vas` -> `iTs`), every message | present | identical (string literals diffed: only interpolated helper names differ) | None. |
| V6 | `marketplace add` source parser (`ove` -> `$Ce`) | present | identical regexes and messages | None. |
| V7 | **Optional plugin dependencies** | absent (`tengu_melodic_honey` 0 hits) | new installer `hxe` behind flag `tengu_melodic_honey` (default on), messages `Optional dependency ... was left out`, `installing optional plugin dependencies threw`; the CLI install passes its HTTPS-fallback context into it (`Hit(e,n,o,r)` -> `hxe({...,gitHubHttpsFallback:r})`, and the member install `gitHubHttpsFallback:g&&{...g,notify:(b)=>S.push(b)}`) | Only if Pi adopts optional dependencies; the transport rule follows the CLI install's (Q7). |
| V8 | GitHub host constant | `Kr="github.com"` | `Zr="github.com"`, exported from one chunk with `kEa=[\`git@${Zr}:\`,\`ssh://git@${Zr}/\`]` | Closes FEATURES E-SG-02's open question: the SSH URL host is the literal `github.com`. |

---

## Q6: the accepted address forms, for marketplace add and for plugin sources

**Question.** What does upstream's validator accept for `marketplace add` and for plugin sources:
`git@host:path`, `ssh://`, `git+ssh://`, `ssh+git://`, `git://`, `http://`, and the git-subdir object
`url`? Does `marketplace add ssh://...` parse as a git source? What does upstream do for 03-SECURITY
F-2 (the git-subdir `url` has no scheme gate)?

**Claude Code behavior (2.1.332).** Two separate gates.

1. **The typed-source parser of `marketplace add`** (`$Ce`, used by `claude plugin marketplace add`,
   the in-session `/plugin` add box, `claude plugin install --marketplace`, and link lookups):
   - `n.match(/^([a-zA-Z0-9._-]+@[^:]+:.+?(?:\.git)?)(#(.+))?$/)` -> `{source:"git",url,ref?}`. So
     **`git@host:path[.git][#ref]` parses as a `git` source**.
   - `n.startsWith("http://")||n.startsWith("https://")`:
     - `c.endsWith(".git")||c.includes("/_git/")` -> `git` (the scheme is kept, so
       **`http://host/r.git` is a `git` source**);
     - a github.com host with `/<owner>/<repo>` -> `git` with `.git` appended;
     - a gitlab.com host with two or more path segments (not `api`, no `-`) -> `git` with `.git`;
     - anything else -> `{source:"url",url}` (hosted `marketplace.json`), `http://` included at
       parse time.
   - paths `./`, `../`, `/`, `~` -> `file`/`directory`.
   - `if(n.includes("/")&&!n.startsWith("@")){if(n.includes(":"))return null; ... owner/repo[#@ref] -> github}`.
   - Everything else returns `null`.
   - So **`ssh://git@host/o/r.git`, `git+ssh://...`, `ssh+git://...`, and `git://...` all return
     `null`**: each holds `/` and `:`, and none matches the scp regex (the text before `@` would
     have to be `[a-zA-Z0-9._-]+`, and `ssh://git` holds `:` and `/`). A `null` becomes the CLI error
     `Invalid marketplace source format. Try: owner/repo, https://..., or ./path` (`g4r`) or, in the
     `/plugin` add box, `That isn't a marketplace source. Try owner/repo, https://…, or ./path` (`Cm`).
     HIGH (the parser is short and fully read). This settles the research flag: **`marketplace add
     ssh://...` does not parse; it is refused before any validator.**
2. **The git URL validator** (`iTs`, wrapped by `N2t(e){try{return iTs(e),null}catch(i){return L(i)}}`).
   - Accepts `["https:","http:","ssh:","file:","git+ssh:","ssh+git:"]` and the scp form
     `H=/^(?!-)[A-Za-z0-9._-]+@(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\]):(?!\/\/)/` (returned as is
     unless it contains `://`).
   - Help text: `https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.`
   - Refusals, each prefixed `Invalid git URL`: control characters; `%00`; a square bracket except
     around an IPv6 host; scp form containing `://`; unparseable; a protocol outside the list
     (`Invalid git URL protocol: <p>. Supported: ...`, which is what `git://` gets); a backslash in an
     http(s) authority; for `ssh:`/`git+ssh:`/`ssh+git:` a `?` or `#`, a host that is not a hostname or
     bracketed IPv6 (optional `:port`), or a user that is not `^(?!-)[A-Za-z0-9._-]+$`
     (`Invalid ssh git URL: the host must be a hostname or bracketed IPv6 literal (optionally :port), the user a plain name, and the URL may not carry ? or # (...)`);
     a scheme without `//` (`a scheme URL must be spelled scheme://…`); a `file:` URL with a host or a
     network-shaped path (`Refusing git URL ...: a file: URL must name a local path (no host, no network-shaped path).`).
   - Where it runs:
     - marketplace `git` source at add (`Mce`: `if(y.source==="git"){let Se=N2t(y.url);if(Se!==null)throw K1(Se,"invalid_source")}`),
       at every marketplace clone (`bqo`: `Refusing to clone. <msg>`), at the freshness `ls-remote`
       (`n0e`: `Refusing to query. <msg>`), at tag listing (`Ymt`: `listPluginTagVersions: <msg>`), and in
       the registry admission rule (`its git URL can't be used: ...`);
     - plugin `url` source: `Lre(e,...){let y=iTs(e),...}` before every clone (the `github` arm also
       goes through `Lre`);
     - **plugin `git-subdir` `url`**: `KHi(e){if(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(e))return PJt()?\`https://github.com/${e}.git\`:\`git@${Zr}:${e}.git\`;return iTs(e)}`,
       called first in the git-subdir clone (`QHi`: `let H=KHi(e)`). So **upstream gates the git-subdir
       object `url` with the same validator** (2.1.330: `yCi` -> `vas`, identical). This is the
       upstream answer to F-2. HIGH.
   - Schema descriptions name the same forms: plugin `url` `"Full git repository URL (https:// or git@)"`,
     git-subdir `"Git repository: GitHub owner/repo shorthand, https://, or git@ URL"`, marketplace
     `git` `"Full git repository URL"` (no scheme restriction in the schema; the validator decides).
3. **Transport bans on every git command** (02-EVIDENCE Q14): `protocol.{ext,fd,git,ftp,ftps}.allow=never`,
   and `nn` turns a user's `GIT_ALLOW_PROTOCOL` into `protocol.<x>.allow=never` for each of https,
   http, ssh, file that it omits.

So `ssh://`, `git+ssh://`, and `ssh+git://` reach upstream only through settings and manifests
(`extraKnownMarketplaces` `{source:"git",url:"ssh://..."}`, a plugin `url` or git-subdir entry), never
through the add command line. `http://` is accepted by both gates.

| Form | `marketplace add <arg>` (CLI and `/plugin`) | marketplace `git` source in settings | plugin `url` / git-subdir `url` |
|---|---|---|---|
| `git@host:path[.git][#ref]` | `git` source, cloned over SSH | accepted | accepted |
| `ssh://git@host[:port]/p` | refused: `Invalid marketplace source format...` | accepted | accepted |
| `git+ssh://` / `ssh+git://` | refused (same) | accepted | accepted |
| `git://` | refused (same) | refused: `Invalid git URL protocol: git:...` | refused (same) |
| `http://host/r.git` | `git` source | accepted | accepted |
| `http://host/other` | hosted `url` source | n/a | n/a |
| `file:///abs` | not a CLI form (paths are) | accepted (no host) | accepted (no host) |
| git-subdir `owner/repo` | n/a | n/a | `git@github.com:<r>.git`, or HTTPS under `PJt()` |

**What git does (E4-ORIGIN, git 2.43).**

| Case | Result |
|---|---|
| a `clone -- git@github.com:o/r.git` through the stand-in with `-o BatchMode=yes -o StrictHostKeyChecking=yes` | rc 0. git first ran the variant check `<cmd> ... -G -o SendEnv=GIT_PROTOCOL git@github.com`, then `<cmd> -o BatchMode=yes -o StrictHostKeyChecking=yes git@github.com git-upload-pack 'o/r.git'`. Recorded `remote.origin.url` = `git@github.com:o/r.git`. |
| b `ssh://git@host.example:2222/o/r.git`, stand-in named `sshstub.sh`, no variant set | `fatal: ssh variant 'simple' does not support setting port`, rc 128 (the D-SG-08 failure mode). |
| f same with `GIT_SSH_VARIANT=ssh` | rc 0; argv `-o SendEnv=GIT_PROTOCOL -p 2222 git@host.example git-upload-pack '/o/r.git'`; origin `ssh://git@host.example:2222/o/r.git`. |
| c `git+ssh://` and `ssh+git://` | both rc 0; git treats them as `ssh`; origins recorded verbatim. |
| e `git://` under `-c protocol.git.allow=never` | `fatal: transport 'git' not allowed`, rc 128. |
| g scp URL with no ssh binary | `error: cannot run ssh: No such file or directory` / `fatal: unable to fork`, rc 128. |

**Pi today.**
- `domain/source.ts::parseUrlSourceForm`: github.com URLs -> `github`; other `https://` -> `url`;
  `raw.startsWith("git@") || raw.includes("://")` -> `unknown` with `unsupportedUrlReason` (D-76-01:
  `... is not supported; <scheme> URLs are rejected -- only https:// URLs and local paths are accepted`).
  E4-PARSE (`ev4/E4-parse.txt`): `git@github.com:o/r.git`, `git@gitlab.example:grp/r.git`,
  `ssh://...`, `ssh://...:2222/...`, `git+ssh://`, `ssh+git://`, `git://`, `http://...r.git`, and
  `file:///tmp/x.git` all parse `unknown`; only `https://host.example/o/r.git` is `url`.
- `gatedUrlField` sends both fields of a plugin `{source:"url"}` object (`url` and `raw`) through
  `parseUrlSourceForm`, so a manifest cannot smuggle a scheme in either field; `refRefusal` refuses a
  `-` ref and `shaRefusal` a short sha for every git-backed kind (SG-TRN-02).
- **F-2 confirmed:** `gitSubdirObjectSource` takes `url` verbatim with no gate. E4-PARSE:
  `{source:"git-subdir",url:"file:///etc",path:"x"}` and `{...url:"ext::sh -c id"}` both parse as
  `git-subdir`, and `networkCloneUrl` returns `ext::sh -c id` unchanged. git's network lane bans
  `ext`, `fd`, `git`, `ftp`, `ftps` (`platform/git-process.ts::configPairs`), so the `ext::` form is
  stopped by git, not by the domain; `file:` and `ssh:` reach git.
- `orchestrators/marketplace/add.ts::parseAddableSource` throws `UnsupportedSourceError`
  (`Cannot add marketplace from "<raw>": <reason>`) for `unknown`, and refuses `git-subdir`/`npm`.
- Network lane: no `protocol.file.allow=never` and no ban on ssh/http/https unless the user's
  `GIT_ALLOW_PROTOCOL` omits them (same as upstream's `nn` with no user list).
- Pi's `ParsedSource` has no `git`-marketplace kind separate from `url`; a non-GitHub git address is a
  `url` source on both the marketplace and the plugin side.

**Confidence.** HIGH for both upstream gates and their call sites (read in full in both builds) and
for git's handling (experiment). MEDIUM that no other upstream entry point reaches `marketplace add`
with an `ssh://` string (the `$Ce` callers listed were all found; a settings-file entry is the only
other route seen).

**Unresolved.** None for upstream. For Pi: whether `marketplace add` should accept `ssh://` on the
command line, which upstream refuses (a Pi convenience would be a divergence with no license).

---

## Q7: how a `github` plugin source chooses its transport

**Question.** On `claude plugin install` (shell) versus in-session `/plugin`, and on update and
dependency installs: what is the order, the fallback, and the skip rules?

**Claude Code behavior (2.1.332, `zHi(repo, dir, ref, sha, opts, ctx)`).**
- `k=\`git@${Zr}:${e}.git\``, `C=\`https://github.com/${e}.git\``, `Zr="github.com"` (V8). The repo
  must match `/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/` (`Invalid GitHub repository format: <x>. Expected format: owner/repo`).
- Step 1: `if(PJt())return Lre(C,...)`: HTTPS only, no probe, no message (Q16).
- Step 2: `if(y===void 0)return Lre(k,...)`: with no fallback context the clone is **SSH only**, no
  probe, no message, no retry.
- Step 3 (context present): `if(!await Qmt(y,k,n,!1))` try SSH. `Qmt(ctx, sshUrl, dir, windowsPass)`:
  1. `h=A()==="windows"; if(h!==g)return!1` (the non-Windows pass runs only off Windows, the Windows
     pass only on Windows);
  2. `_E(y,"GIT_SSH_COMMAND")!==void 0||_E(y,"GIT_SSH")!==void 0` -> stay on SSH (any value, empty
     included, read case-insensitively on Windows from the hardened environment `mme()`);
  3. `bF(n)` (the `git config --get-regexp '^(core\.sshcommand|ssh\.variant)$'` read) has a
     `command` -> stay on SSH;
  4. `git ls-remote --get-url -- <sshUrl>` (5000 ms, `stdin:"ignore"`, the plugin environment and the
     neutral cwd) must exit 0 and print the URL unchanged, else log
     `GitHub SSH URL is rewritten by git config, or git could not say (code=<n>): staying on SSH`;
  5. Windows pass only: `git <pinArgs> ls-remote -- <sshUrl>` with
     `GIT_SSH_COMMAND:\`${H.GIT_SSH_COMMAND} -G >&2\`` (5000 ms); true only if not timed out and stderr
     shows `hostname github.com` and no `proxycommand`/`proxyjump` other than `none` (Q21);
  6. `await e.probeSsh()!=="not-configured"` -> stay on SSH (so `configured` **and `unknown`** keep
     SSH);
  7. `await bf("ssh")===null` (no ssh on PATH) -> go HTTPS;
  8. `ssh -G git@github.com` (5000 ms, cwd `dWe()`) exits 0 and shows `hostname github.com` with no
     ProxyCommand/ProxyJump -> go HTTPS, else log
     `ssh -G does not show git@github.com going straight to github.com (code=<n>): staying on SSH`.
- When `Qmt` is false: `Lre(k)` (SSH). On failure, only a **clone-step** failure (`N1t`: the error
  carries `Symbol("pluginCloneStepFailed")`, set only on the `clone` command, not on the SHA fetch or
  checkout) whose text matches `Permission denied (publickey` or `Host key verification failed`
  **and** the Windows pass of `Qmt` returns true continues; otherwise the error is thrown. Off
  Windows the Windows pass returns false at its first line, so **off Windows an SSH-first plugin
  install never falls back**.
- HTTPS path: `y.notify("SSH not configured, cloning via HTTPS: <https-url>")`, `Lre(C)`. On a
  clone-step failure: clear the directory (`Could not clear <dir> for the SSH retry: ...` on failure),
  `y.notify("HTTPS clone failed, retrying with SSH: <ssh-url>")`, `Lre(k)`. Both failed (each a
  clone-step failure):
  `<https error>\nThe retry over SSH failed too: <ssh error>\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.`
- **Who passes the context.** It is built only by `Nrl(e){let n;return{notify:e,probeSsh:()=>n??=Jxn()}}`
  (2.1.330 `kWa`), and only in `QPa`, the shell `claude plugin install` handler that emits
  `tengu_plugin_installed_cli` with `install_source:"cli-explicit"`. `QPa` collects the notices in an
  array and joins them after the result message (`[r.message,...c,...w?[w]:[]].join("\n")`), so the
  lines print **after** `Successfully installed plugin: ...`, or with the failure. The context flows
  `QPa` -> `rDn` (`gitHubHttpsFallback:u`) -> `MBn` -> each closure member's fetch
  (`wi!==e&&an.has(wi)?void 0:Ae`, where `an` holds members already installed in that scope) -> the
  loader -> `zHi`. Also the bare-name retry through another marketplace (`rDn(J,n,{...,gitHubHttpsFallback:u})`)
  and, new in 2.1.332, optional dependencies (V7).
- **Who does not.** The in-session `/plugin` install (`MBn` with `trigger` `hint`/`ui-discover`),
  `plugin update` (`updatePluginOp`: no `gitHubHttpsFallback` in its body; its post-update dependency
  step `xBt` neither), autoupdate, the session-load repair `mxe` (`resolveMissingDependencies`, which
  calls `MBn` with no context), and `enable`. These clone a `github` plugin SSH only unless `PJt()`.
- The probe result is memoized within one CLI install (`n??=Jxn()`), so a cascade probes once; the
  skip checks (`--get-url`, `ssh -G`, `git config`) run again for each `github` member.
- Other `github` URLs that never probe or fall back: tag listings for constrained dependencies
  (`Uze`: `github` -> `zmt(repo)`, git-subdir `owner/repo` -> `zmt`), the marketplace remote for
  path-entry tags (`Ype`: `github` -> `zmt(repo)`), and git-subdir shorthand clones (`KHi`), where
  `zmt(e){return PJt()?\`https://github.com/${e}.git\`:\`git@${Zr}:${e}.git\`}`. **So upstream reads
  D-SG-09's and D-03-03's tags of a GitHub repository over SSH by default.**

Docs (FEATURES E-SG-04, host-marketplace page, 2026-11-22): "For a `github` source, that command can
fall back to HTTPS on its own, printing `SSH not configured, cloning via HTTPS`. Installs from
`/plugin` inside a session and plugin updates don't fall back, so without the variable they fail for
users who have no GitHub SSH key."

**Fallback order, summarized.**

| Surface | `PJt()` set | not set, off Windows | not set, on Windows |
|---|---|---|---|
| `claude plugin install` (and its required, optional, and bare-name members) | HTTPS only | skip checks pass and probe `not-configured`: HTTPS, then SSH on clone failure. Any check fails: SSH only. | SSH first; on a publickey/host-key clone failure with the `-G` check passing: HTTPS, then SSH again. |
| `/plugin` install, `plugin update`, autoupdate, load repair, dependency repair | HTTPS only | SSH only | SSH only |
| tag listings, git-subdir `owner/repo` | HTTPS | SSH | SSH |

**What git does (E4-GETURL, git 2.43, `ls-remote --get-url` is local).**

| Case | Output |
|---|---|
| a no config | `git@github.com:o/r.git` (unchanged: probe proceeds) |
| b Pi's D-SG-16 pair `-c url.https://127.0.0.1:9/.insteadOf=https://github.com/` | `git@github.com:o/r.git` (unchanged: the pair cannot trip the skip) |
| c user `url.https://github.com/.insteadOf=git@github.com:` | `https://github.com/o/r.git` (rewritten: stay on SSH) |
| d the same through `GIT_CONFIG_COUNT` | rewritten |
| e `pushInsteadOf` only | unchanged |
| f `insteadOf=ssh://git@github.com/` only | unchanged (scp form not matched) |
| g rewrite to another ssh host | `git@mirror.example:o/r.git` (rewritten) |
| h `GIT_ALLOW_PROTOCOL=/` (Pi's local lane) | unchanged, rc 0: the read works on the local lane |

**Pi today.** `domain/clone-key.ts::networkCloneUrl` sends every `github` source to
`https://github.com/<o>/<r>.git` (`ensureGitSuffix(canonicalCloneUrl(source))`), so install, update,
reinstall, dependency installs, mirrors, `fetch`, `info`, and the tag probes
(`dependency-tag-probe.ts:163`, `marketplace-tag-probe.ts:122`) all use HTTPS, with no probe and no
SSH. Pi has one install surface (`/claude:plugin install`, plus `apply` and the import cascade),
typed in a session like `/plugin` and shaped like the CLI command.

**Confidence.** HIGH for `zHi`, `Qmt`, the callers that pass the context, and the callers that do not
(every `gitHubHttpsFallback` hit in 2.1.332, eleven, was read). HIGH that required closure members
inherit it (2.1.330 has the same `...?void 0:Oe` hand-off, settling FEATURES E-SG-04's MEDIUM).
MEDIUM for the Windows branch (read, not run).

**Unresolved.** Which upstream surface Pi mirrors (maintainer). Whether Pi's tag reads follow
upstream's SSH default (maintainer; see the recommendation).

---

## Q16 (part): `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and `CLAUDE_CODE_REMOTE`

**Claude Code behavior (2.1.332).**
- `function PJt(){return s.CLAUDE_CODE_REMOTE||s.CLAUDE_CODE_PLUGIN_PREFER_HTTPS}`. Both entries are
  `H.bool()` in the environment registry (`CLAUDE_CODE_PLUGIN_PREFER_HTTPS:()=>kD`, `kD=H.bool()`;
  `CLAUDE_CODE_REMOTE:()=>xi`, `xi=H.bool()`), the parser 03-EVIDENCE Q16 read for
  `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` (true for `1`, `true`, `yes`, `on`). HIGH.
- `PJt()` callers (all six):
  1. marketplace `github` clone at add or load (`Njt`): `Cloning via HTTPS: <url>`, one attempt, no probe;
  2. marketplace refresh (`_Fi`): HTTPS clone, no probe, no fallback;
  3. the marketplace "is it at this commit" URL list (`Rqo`): HTTPS only;
  4. plugin `github` clone (`zHi`): HTTPS only;
  5. git-subdir `owner/repo` shorthand (`KHi`);
  6. `zmt`: tag listings of `github` and git-subdir shorthand sources, and the marketplace remote of
     a `github` marketplace for path-entry tags.
- It changes no non-GitHub URL: a `git@host:` or `https://host` address is cloned as written.
- So `CLAUDE_CODE_REMOTE` **does** affect transport upstream: in a Claude Code remote session every
  GitHub clone is HTTPS (that session reaches GitHub through its git proxy, E-SG-13).

**Pi today.** Neither variable is read on the git surface. `CLAUDE_CODE_REMOTE` appears only in the
hooks bridge, where HOOK-05 deliberately leaves it unset in a hook's environment
(`bridges/hooks/hook-env.ts:74`, `dispatch-exec.ts:17`).

**Constraints.** A Pi process may inherit `CLAUDE_CODE_REMOTE` from a Claude Code cloud shell it was
started in, where it describes the Claude Code session and not Pi. SG-SSH-03 already records "not
read". SUMMARY Q16 calls this a Pi capability gap: Pi has no remote-session git proxy, so the
variable's meaning upstream ("this session's GitHub traffic goes through the proxy") cannot hold.

**Confidence.** HIGH.

---

## Q18: the SSH probe

**Claude Code behavior (2.1.332, `Jxn`, 2.1.330 `DCn`).**
- **An `ssh` launch, not `git ls-remote`:**
  `vt("ssh",["-T","-o","BatchMode=yes","-o","ConnectTimeout=2","-o","StrictHostKeyChecking=yes","git@github.com"],{cwd:dWe(),timeout:3000})`.
  `vt` is the generic process runner, so the probe gets the process environment (no git hardening,
  no `GIT_SSH_COMMAND`), and `ssh` is looked up on PATH. `dWe(){let e="";try{e=Ft()}catch{}return Gt(e)?e:q("/")}`
  with `homedir as Ft`, `isAbsolute as Gt`, `resolve as q`: the cwd is the home directory, else `/`.
- Classification of `stdout + "\n" + stderr`:
  - `configured`: `e.code===1&&n.includes("successfully authenticated")` (GitHub's greeting exits 1);
  - `unknown`: `e.timedOut` (3000 ms; `ConnectTimeout=2` bounds the TCP connect);
  - `not-configured`: `e.code===255&&Jmt(n)`, `Jmt` = `Permission denied (publickey` or
    `Host key verification failed`;
  - otherwise `await bf("ssh")===null?"not-configured":"unknown"` (no ssh on PATH is `not-configured`);
  - a thrown error: log `SSH configuration check failed: <msg>` at warn, `unknown`.
  - Debug log every time: `SSH config check: code=<n> configured=<bool>`.
- The two paths read it differently: marketplaces `u0e(){return await Jxn()==="configured"}` (SSH
  first only on `configured`); plugins go HTTPS only on `not-configured` (Q7 step 6).
- **Caching.** None across commands and none within a marketplace command: `Njt` (add/load) and
  `Rqo` (the "at this commit" check) call `u0e()` each time, and `_Fi` (refresh) once per marketplace.
  The plugin CLI install memoizes within one command (`probeSsh:()=>n??=Jxn()`). HIGH.
- **Host.** Always `git@github.com`; GHES and other hosts are never probed.
- **What the two candidate mechanisms prove** (research flag): `ssh -T git@github.com` proves that
  the machine's ssh, with its agent and `~/.ssh/config`, authenticates to github.com as some user. It
  does not prove access to the repository. `git ls-remote git@github.com:o/r.git` would prove access
  to that repository, would go through `GIT_SSH_COMMAND`/`core.sshCommand` and any `insteadOf`, and
  costs a full ssh session plus ref advertisement. Upstream uses the first, and keeps the second's
  concerns in the plugin skip rules (`GIT_SSH*`, `core.sshCommand`, `--get-url`, `ssh -G`).
- **Not measurable here:** no ssh binary; the exit codes and texts above come from the binary's
  classifier, not from a run. PITFALLS E-9 records the same absence.

**D-SG-16 interplay (no upstream position).** Upstream has no base override. Under Pi's D-SG-16 the
pair rewrites only the `https://github.com/` prefix (E4-GETURL b), so:
- the SSH URL `git@github.com:<o>/<r>.git` is not rewritten and would go to the real github.com while
  the HTTPS URL goes to the base;
- the probe always targets the real `git@github.com`;
- the plugin `--get-url` skip check cannot see Pi's own pair (it rewrites no scp URL), so
  D-SG-16's instruction to "leave Pi's own `-c` out of the probe-skip check" holds automatically for
  `--get-url`; it still matters if Pi ever ran the check against the HTTPS URL.

**Pi today.** No probe. `platform/git-process.ts` is the only git spawn site and, per its header,
"the ssh one once the SSH probe lands"; `child-process-chokepoint` already lists it. 02-EVIDENCE Q11
records the probe as a network operation that needs no `NETWORK_SEAMS` entry if it lives in
`platform/git-process.ts` or `platform/git.ts` and is reached through `GitOps`, plus an NFR-5 text
entry.

**Confidence.** HIGH for argv, timeout, cwd, classification, and caching. LOW for real-world ssh
output (unrun).

---

## Q21 (part): the Windows-only SSH-to-HTTPS retry for plugin installs

**Claude Code behavior (2.1.332).** Only for a `github` plugin source on `claude plugin install`
(context present), only on Windows (`A()==="windows"`), only when `PJt()` is unset:
1. `Qmt(...,false)` returns false at once on Windows, so the clone runs **SSH first**, with no
   `ssh -T` probe and no `ssh -G` launch at all on Windows.
2. If the SSH clone step fails and its text contains `Permission denied (publickey` or
   `Host key verification failed`, run `Qmt(...,true)`: no `GIT_SSH_COMMAND`/`GIT_SSH` (Windows
   case-insensitive lookup), no `core.sshCommand`, `ls-remote --get-url` unchanged, then
   `git <pinArgs> ls-remote -- git@github.com:<r>.git` with `GIT_SSH_COMMAND="<wrapped ssh> -G >&2"`
   (5000 ms). `ssh -G` prints the resolved config and exits without connecting, so this check is
   local; it passes when stderr shows `hostname github.com` and no ProxyCommand/ProxyJump.
3. On pass: remove the target directory (`fl(n)`; a failure rethrows the SSH error), then the HTTPS
   path of Q7: `SSH not configured, cloning via HTTPS: <url>`, HTTPS, and on a clone failure
   `HTTPS clone failed, retrying with SSH: <url>`, SSH again, and the both-failed text.
4. Any other SSH failure (network, repository not found) is thrown as is.
Marketplaces on Windows use the same probe-and-retry as elsewhere (`Njt`/`_Fi` have no OS branch).

**What git does.** E4-ORIGIN a shows git's own `-G` launch (the variant check) and that a
`GIT_SSH_COMMAND` with extra words is run through the shell. The Windows run itself is unmeasurable
here.

**Pi today.** No Windows branch; D-SG-04 and D-SG-08 already handle the Windows git lookup and the
variant export. The manual Windows check is an open `[system-git]` `unrun-verify` windows entry.

**Confidence.** HIGH for the code path; LOW for Windows behavior in practice (unrun anywhere).

---

## Progress lines and errors

**Marketplace `github` source, add and load (`Njt`, progress callback `qT(o,...)`, shown while the
add runs):**
- `Cloning via HTTPS: https://github.com/<repo>.git` when `PJt()`.
- `Cloning via SSH: git@github.com:<repo>.git` on `configured`.
- `SSH not configured, cloning via HTTPS: https://github.com/<repo>.git` otherwise (`d0e`).
- Debug: `SSH configured for GitHub, using SSH for <repo>` / `SSH not configured for GitHub, using HTTPS for <repo>`.
- First attempt fails, **any** error, any OS: progress `<T1> clone failed, retrying with <T2>: <url2>`,
  debug `<T1> clone failed for marketplace <repo> (<msg>), falling back to <T2>` (error level), the
  target removed when it was made here.
- Both fail: debug `<T2> clone fallback also failed for marketplace <repo>: <msg>`, and `wqo`: when
  the two messages differ,
  `Fetching the marketplace from GitHub failed on both attempts. <T1> (<url1>): <msg1>\n\n<T2> (<url2>): <msg2>`;
  when they are equal, the second error unchanged. Each `<msg>` is already a
  `Failed to clone marketplace repository: ...` text (E-SG-10).
- The clone itself adds `Cloning repository (timeout: <n>s): <url>[ (ref: <r>)]` and the rest of
  03-EVIDENCE Q9's lines.

**Marketplace refresh (`_Fi`, `marketplace update`, autoupdate):** the probe orders the URLs
(`Djt(await u0e(), ssh, https)`), with no `Cloning via` line and no `retrying with` progress line; a
failure logs only `Marketplace refresh failed with <T1> for <repo> (<msg>), falling back to <T2>`
(info), and both failing throws the same `wqo` text. `PJt()`: HTTPS, one attempt.

**Plugin `github` source (`zHi`, CLI install only):** `SSH not configured, cloning via HTTPS: <url>`,
`HTTPS clone failed, retrying with SSH: <url>`, the both-failed text quoted in Q7, all appended after
the command's result line. SSH-first gives no line. Skip-rule logs: `GitHub SSH URL is rewritten by
git config, or git could not say (code=<n>): staying on SSH`, `ssh -G does not show git@github.com
going straight to github.com (code=<n>): staying on SSH` (debug only).

**Non-GitHub `git` sources:** one attempt, no probe, no transport line (E-SG-03).

Wording of the clone failures themselves (SSH auth, host key, HTTPS auth) is Phase 6's
(E-SG-10, D-SG-07).

---

## SG-SSH-06: is an scp-form origin the same source as an https one?

**Claude Code behavior (2.1.332).**
- Upstream **never reads a clone's recorded origin** on the plugin or marketplace surface. The only
  `remote get-url origin` and `config --get remote.<x>.url` reads in the binary belong to the user's
  own repository (usage report, PR features). Identity is the **declared source** in
  `known_marketplaces.json` and the install records.
- Source identity: `_At(e,n){return Bt(wjt(e),wjt(n))}` (deep equality after folding), with
  `wjt(e){if(e.source==="github")return{...e,repo:Ort(e.repo)??e.repo};if(e.source==="git"){let n=Ort(e.url);if(n!==null){let{url:o,...g}=e;return{...g,source:"github",repo:n}}}return e}`.
  `Ort` (2.1.330 `EJe`) returns a lower-cased `owner/repo` for any GitHub spelling and `null`
  otherwise:
  - a `://` URL whose protocol is in `["https:","http:","git:","git+https:","git+http:","git+ssh:","ssh:"]`
    with host `github.com` (for `ssh:`/`git+ssh:` also `ssh.github.com`), followed by `/`;
  - an scp form `user@host:path` whose host is `github.com` or `ssh.github.com`;
  - the path with one trailing `/` and one `.git` (any case) removed, matching
    `/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/`, not ending `/.` or `/..`;
  - refused outright when `Mle` or `Pwe` flags the address (hidden characters, a host that differs
    between parsers).
  So `git@github.com:O/R.git`, `ssh://git@github.com/o/r`, `https://github.com/o/r.git`, and
  `{source:"github",repo:"o/r"}` are one source; a non-GitHub host compares its `url` string exactly
  (`git@host:o/r.git` and `https://host/o/r.git` are two sources).
- The same fold keys the confirmed-commit cache (`Cqo(e,n){return\`${Ort(e)??e}@${n}\`}`) and the
  clone-directory guard (`Wbe`: `h.source.repo.toLowerCase()===o.repo.toLowerCase()`).
- The freshness check compares the checkout's `HEAD` with `ls-remote` of the source's URL list
  (`Rqo`), so a checkout cloned over SSH is `current` against an HTTPS `ls-remote` of the same commit;
  nothing compares transports. A stale or unreadable checkout is re-cloned (D-SG-10), never refused.
HIGH for `Ort`/`wjt` (identical in 2.1.330) and for the absence of origin reads (searched).

**What git does.** E4-ORIGIN a/c/f: git records the URL it was given verbatim as
`remote.origin.url` (`git@github.com:o/r.git`, `git+ssh://...`, `ssh://...:2222/...`).

**Pi today (where SG-SSH-06 bites).**
- `domain/clone-key.ts::canonicalCloneUrl`: `github` -> `https://github.com/<o>/<r>` whatever the
  transport, so a `github` plugin's `plugin-clones/<key>/` does not move. A `url` source with an SSH
  address would key on its own `url` string (`.git` stripped).
- `originMatchesSource` (used only by `add.ts::recognizeLeftover`, MA-12/MA-13): reparses the origin
  with `parsePluginSource` and compares WHATWG `href`s. E4-PARSE: `https://github.com/o/r.git` matches
  `o/r`; **`git@github.com:o/r.git` and `ssh://git@github.com/o/r.git` do not**, so a leftover SSH
  clone would be refused as `StaleSourceCloneError`. The path compares case-sensitively (IN-05),
  where upstream lower-cases `owner/repo`.
- `orchestrators/marketplace/clone-swap.ts::swapCloneUrl`: a refresh re-clones from the live
  checkout's recorded origin when present. A checkout first cloned over SSH would always refresh over
  SSH, with no probe and no fallback, unlike upstream's `_Fi`.
- `clone-cache.ts::deriveMarketplaceUrl` -> `readOriginRemoteUrl` (fs-only) -> `parsePluginSource`:
  a path-source marketplace whose checkout has an scp or `ssh://` origin parses `unknown`, so no
  same-repo seeding (ARCHITECTURE.md "silently unseedable").
- `orchestrators/auth-host.ts::hostFromCloneUrl`: `new URL(gitHubWireUrl(cloneUrl)).host` throws on
  an scp address.
- `platform/git.ts::bundleOrigin` returns undefined for a non-https wire URL, so an SSH request is
  never mapped by an auth bundle (correct: Device Flow is an HTTPS concern).
- `platform/git.ts::fetchCommit` reads the recorded origin to decide the D-SG-16 pair; an scp origin
  gets no pair (correct).

**Confidence.** HIGH for upstream and for Pi's current behavior (code read plus E4-PARSE).

---

## Pi tree today: where Phase 4 changes code

| File | Today | Phase 4 touch point |
|---|---|---|
| `domain/source.ts` | `parseUrlSourceForm` refuses `git@`/`://` other than https (D-76-01, `unsupportedUrlReason`); `gatedUrlField` gates a url object's `url` and `raw`; `gitSubdirObjectSource` takes `url` ungated (F-2); `refRefusal`/`shaRefusal` refuse `-` refs and short shas. | Port `iTs` as the gate for url objects, git-subdir `url`, and the marketplace git address; new `ParsedSource` shape for scp/ssh addresses (a `url` source with a non-https `url`, or a new kind). |
| `domain/clone-key.ts` | `canonicalCloneUrl` (github -> https identity), `networkCloneUrl` (github -> https wire), `originMatchesSource` (WHATWG compare). | Transport candidates for `github`; an `Ort`-style GitHub fold in `originMatchesSource` (scp, `ssh://`, `git+ssh://`, `ssh.github.com`, case). Keep `canonicalCloneUrl` unchanged. |
| `orchestrators/marketplace/add.ts` | `parseAddableSource` throws `UnsupportedSourceError` on `unknown`; `recognizeLeftover` uses `originMatchesSource`; `remoteUrlOf` and the add body use `networkCloneUrl`. | Accept `git@host:path[#ref]` (and `http://...git` if Q6 says so); probe, order, retry, progress lines for `github`. |
| `orchestrators/marketplace/clone-swap.ts` | `swapCloneUrl` reuses the recorded origin. | Upstream re-probes and orders on every refresh (`_Fi`); the origin reuse would pin a transport. |
| `orchestrators/plugin/clone-cache.ts` | plugin clone through `networkCloneUrl` (`:414`, `:944`); `readOriginRemoteUrl`/`deriveMarketplaceUrl` parse origins with `parsePluginSource`. | Plugin `github` transport per Q7; scp-aware origin parse for seeding. |
| `orchestrators/plugin/{dependency,marketplace}-tag-probe.ts` | `ls-remote --tags` of `networkCloneUrl` (HTTPS). | Upstream uses `zmt` (SSH unless `PJt()`); see Q7 recommendation. |
| `orchestrators/auth-host.ts` | `hostFromCloneUrl` uses `new URL`. | Must not throw on scp addresses (or not be called for them). |
| `platform/git.ts` | `runRemote` adds the D-SG-16 pair for `https://github.com/` URLs; `bundleOrigin` https only; `listRemotes` reads the origin with `config --local --null --get-all`. | Needs an `ls-remote --get-url` verb (local lane works, E4-GETURL h) and an `ssh -T` / `ssh -G` launch. |
| `platform/git-process.ts` | Network lane bans `ext,fd,git,ftp,ftps`, keeps the user's `GIT_ALLOW_PROTOCOL`; reads `core.sshCommand`/`ssh.variant` once (`SSH_CONFIG_READ`); wraps the user's ssh with `-o BatchMode=yes -o StrictHostKeyChecking=yes` (`-batch` for plink/putty) in `GIT_SSH_COMMAND`; exports `GIT_SSH_VARIANT` (D-SG-08); closed `GitSubcommand` set without an ssh launch. | Add the probe and `ssh -G` launches (still the one spawn site); expose whether `core.sshCommand` is set for the skip rule. |
| `platform/git-failure-kind.ts` | Kinds `ssh-host-key-changed`, `ssh-host-key-unknown`, `ssh-auth`, network rows for `ssh: Could not resolve hostname`/`ssh: connect to host`. | The Windows retry and the plugin retry read `Permission denied (publickey` / `Host key verification failed` from stderr; the kinds already separate them. `cannot run ssh` (E4-ORIGIN g) maps to no ssh row today. |
| `shared/github-base-url.ts` | `gitHubInsteadOfPairs` and `gitHubWireUrl` match the `https://github.com/` prefix only. | Decide the SSH URL under the override (below). |

---

## Recommendations per question

Each says the upstream behavior, whether parity is available in Pi (or the capability gap), and
what it means for NFR-5 (network), NFR-10 (containment), and the D-SG decisions. **[Maintainer]**
marks a product or preference question.

### Q6: address forms (SG-SSH-01)

- **Upstream:** validator `iTs` accepts `https`, `http`, `ssh`, `git+ssh`, `ssh+git`, scp
  `user@host:path`, and host-less `file:`; refuses `git://`. `marketplace add` on the command line
  accepts `git@host:path[#ref]` and `http(s)://...git` as `git` sources and refuses `ssh://`,
  `git+ssh://`, `ssh+git://`, `git://`. The git-subdir `url` is gated by the same validator (via
  `KHi`).
- **Parity:** available; nothing in Pi blocks any of it now that system git carries SSH.
- **Recommendation:** record the D-76-01 amendment (`D-SG-NN`) before the parser changes. Port `iTs`
  with its messages into `domain/` and use it for (a) a plugin `url` object's `url` and `raw`, (b) the
  git-subdir `url` (closes F-2 as upstream does: `file:` only without a host, `ext::` refused at parse,
  not only by git), (c) the marketplace git address. Port `$Ce`'s scp arm so `marketplace add
  git@host:path[#ref]` works, and keep `ssh://` refused on the command line, as upstream does. Keep
  `git://` refused (upstream refuses it; the network lane already bans it, E4-ORIGIN e).
- **[Maintainer] `http://`:** upstream accepts `http://...git` as a git source on add and in every
  plugin form, and parses other `http://` as a hosted catalog. D-PL5-04/05/33 keep it refused. Parity
  says accept for git sources; keeping it refused needs D-PL5-04/05/33 restated as the license.
  Recommend: accept `http://` for git sources only (parity), keep hosted catalogs https-only (D-PL5-36
  stands, and upstream's hosted fetch is out of this phase), and record both in the amendment.
- **[Maintainer] `ssh://` on the add command line:** parity is "refused"; accepting it would be a
  Pi convenience with no license. Recommend parity.
- **NFR-5:** no change (forms only). **NFR-10:** unchanged; a `file:` git-subdir URL must still keep
  its clone inside `plugin-clones/<key>/`, which the validator's host-less rule supports.
  **D-SG:** amends D-76-01; D-SG-05's protocol bans stay as the second layer.
- **Confidence:** HIGH.

### Q7: `github` plugin transport (SG-SSH-04)

- **Upstream:** `claude plugin install` probes and falls back (non-Windows: HTTPS first when every skip
  check passes and the probe says `not-configured`, then SSH; otherwise SSH only), and its required,
  optional, and bare-name members inherit that. `/plugin` install, `plugin update`, autoupdate, and
  dependency repair clone SSH only. Tag listings and git-subdir shorthand use SSH unless
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`.
- **Parity:** available either way; Pi has no shell-versus-session split, so neither surface is
  forced (not a capability gap). The `ssh -T` and `ssh -G` launches need `ssh` on PATH, which Pi can
  run like git.
- **[Maintainer] which surface `/claude:plugin install` mirrors.** Recommend the shell
  `claude plugin install` rules for `install`, `apply`, and the import cascade, with members
  inheriting the context as upstream's do (a user with no GitHub key otherwise fails every github
  install, today's working HTTPS path). Keep `update`, `reinstall`, and the dependency moves SSH only
  as upstream's `updatePluginOp` and repair are, **or** treat them like install; this second choice is
  the real preference question, because "SSH only" turns today's working HTTPS updates into failures
  for users with no key unless they set the variable.
- **[Maintainer] tag reads and git-subdir shorthand.** Upstream lists tags over SSH by default (`zmt`).
  Pi's D-SG-09 and D-03-03 read over HTTPS today. Parity would make a no-key user's constrained
  install silently fall back to the current copy (TAGS-02) where it now pins the tag. Recommend
  matching the transport the same command chose for its clones (Pi-internal choice: no visible
  difference when SSH works), or strict `zmt` if the maintainer wants parity; ask.
- **NFR-5:** the probe (`ssh -T`, TCP 22) and the HTTPS/SSH retry are network; they run only inside
  `install`/`update`/`reinstall` of git-source plugins on cache miss, which NFR-5 already allows; the
  skip checks (`git config`, `ls-remote --get-url`, `ssh -G`) are local and can run on the local lane
  (E4-GETURL h). Name the probe in the NFR-5 text (D-SG-02 deferred this to Phase 4). No `list`,
  `info`, or load path may call it. **NFR-10:** the probe writes nothing; `known_hosts` writes are
  D-SG-03's. **D-SG:** the probe lives in `platform/git-process.ts` (D-SG-01's spawn site, Q11 says no
  new `NETWORK_SEAMS` member); the `GIT_SSH_COMMAND`/`GIT_SSH`/`core.sshCommand` skip reads the
  user's values before Pi's wrapper (D-SG-05), never Pi's own wrapped command.
- **Confidence:** HIGH (upstream); the choice is the maintainer's.

### Q16: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and `CLAUDE_CODE_REMOTE` (SG-SSH-03)

- **Upstream:** either variable, read as `H.bool()` (`1`/`true`/`yes`/`on`), makes every GitHub URL
  HTTPS with no probe: marketplace add, load, refresh, freshness list, plugin clones, git-subdir
  shorthand, and tag listings. Non-GitHub addresses are untouched.
- **Parity:** available for `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`; read it by its upstream name with the
  same parser (D-SG-15's reader) at every site in the list. `CLAUDE_CODE_REMOTE`: capability gap. Pi
  has no Claude Code remote-session git proxy, and the variable a Pi process inherits describes the
  Claude Code session around it, not Pi. Record "not read" with that gap as the license (SG-SSH-03
  already says so); the hooks bridge's HOOK-05 rule is consistent.
- **NFR-5:** the variable removes a network probe; no amendment. **NFR-10:** none. **D-SG:** a new
  `D-SG-NN` for the reader and the `CLAUDE_CODE_REMOTE` gap.
- **Confidence:** HIGH.

### Q18: the probe (SG-SSH-02)

- **Upstream:** `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`,
  3000 ms, cwd home else `/`, plain process environment; `configured` on exit 1 plus
  `successfully authenticated`; `unknown` on timeout or other output with ssh present;
  `not-configured` on exit 255 with the publickey or host-key text, or no ssh on PATH. No cache
  across commands; marketplaces probe on every clone and freshness list; the plugin CLI install
  memoizes per command. The marketplace path never applies the plugin skip rules.
- **Parity:** available: Pi can launch `ssh` from `platform/git-process.ts`. Re-expressing it as
  `git ls-remote` would prove a different thing (repository access through the user's git ssh
  settings) and change which users go SSH first; not recommended.
- **Recommendation:** the exact argv, timeout (a fixed 3000 ms, not `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`),
  cwd (Pi's neutral directory instead of the home directory is an invisible, harmless divergence;
  record it), and classification; no cross-command cache; one probe per command for the plugin path,
  as upstream memoizes. **[Maintainer, optional]** memoizing the marketplace probe once per command
  too (an `apply` that adds several GitHub marketplaces would probe once instead of N times) is an
  invisible divergence with no license; recommend parity unless the cost shows.
- **Base override (D-SG-16, no upstream position):** under `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` the
  `insteadOf` pair rewrites HTTPS only, so an SSH-first clone would bypass the mirror and reach the
  real github.com. Recommend: while the variable is set, treat GitHub sources as HTTPS-only with no
  probe (as `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` does), so every GitHub byte goes to the base and the
  cucumber harness (HTTPS stand-in, no ssh) keeps working. Record as a refinement of D-MF-01/D-SG-16.
  **[Maintainer]** if they would rather the override also map `git@github.com:` (an SSH mirror),
  that is a new feature with no upstream analogue.
- **NFR-5:** the probe is network (TCP 22) and runs only inside commands NFR-5 already lets reach
  GitHub; amend the NFR-5 text to name it (D-SG-02). Under the override it never runs. **NFR-10:**
  none (ssh may update `known_hosts` per D-SG-03; `StrictHostKeyChecking=yes` refuses unknown hosts).
  **D-SG:** spawn site per D-SG-01; the harness needs a stub `ssh` first on Pi's PATH (PITFALLS
  Pitfall 9), since a `GIT_SSH_COMMAND` stub would trip the plugin skip rule.
- **Confidence:** HIGH for upstream; LOW for live ssh output (unmeasurable here).

### Q21: Windows retry (SG-SSH-05)

- **Upstream:** Windows CLI installs of `github` plugins go SSH first with no probe; a publickey or
  host-key clone failure, with no `GIT_SSH*`/`core.sshCommand`, an unrewritten `--get-url`, and an
  `ssh -G` check (through `GIT_SSH_COMMAND="<cmd> -G >&2"` on `git ls-remote`) showing a direct
  github.com hop, falls through to HTTPS then SSH, with the Q7 lines.
- **Parity:** available; same primitives as Q7. Unverifiable in this sandbox and in Linux CI.
- **Recommendation:** implement only if Q7 picks the CLI-install surface (otherwise there is no
  context to carry it). REQUIREMENTS records the maintainer's 2026-11-22 choice that optional items
  are in scope; **[Maintainer]** confirm in discuss. Unit rows against a fake platform, plus the open
  `[system-git]` Windows `unrun-verify` entry for a manual run.
- **NFR-5:** the `-G` check is local; the retries are network on an install that already is.
  **NFR-10:** none. **D-SG:** D-SG-04's Windows lookup and D-SG-08's variant export apply to the
  `-G` launch.
- **Confidence:** MEDIUM (read, never run).

### Progress lines and errors (SG-SSH-02)

- **Upstream:** marketplace add/load lines `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`,
  `SSH not configured, cloning via HTTPS: <url>`, `<T1> clone failed, retrying with <T2>: <url>`;
  refresh shows none of them and logs only; both failed: `Fetching the marketplace from GitHub failed
  on both attempts. ...` (only when the messages differ). Plugin CLI lines are appended after the
  result line.
- **Parity:** available through `notify()` (IL-2): the progress lines become rows or notes of the
  add/install notification; Pi has no live progress line for a running command, a presentation gap
  rather than a behavior gap. The both-failed and retry wording belong with Phase 6's message work
  but the transport outcome kinds belong here.
- **[Maintainer]** whether the add rows show the transport line on success (upstream shows it as
  transient progress, not in the final result) or only on fallback. Recommend: show only the retry
  and both-failed text in the final output, and the transport choice in the debug log, which matches
  what an upstream user still sees after the command ends.
- **NFR-5/NFR-10:** none. **D-SG:** Phase 6 wording (D-SG-07's pattern).

### SG-SSH-06: scp-aware identity

- **Upstream:** identity is the declared source after the `Ort`/`wjt` GitHub fold (scp, `ssh://`,
  `git+ssh://`, `ssh.github.com`, `http(s)://`, `git://`, `git+http(s)://`, case-insensitive,
  `.git` stripped); a non-GitHub address compares exactly; no origin is ever read; a checkout is
  judged only by its `HEAD` against `ls-remote`, so nothing is refused for its transport.
- **Parity:** available. Pi's leftover recognizer and seeding read origins, which upstream does not,
  so the parity-shaped fix is to fold origins the way `Ort` folds sources.
- **Recommendation:** port `Ort` into `domain/clone-key.ts` and use it in `originMatchesSource` and in
  the origin parse of `deriveMarketplaceUrl`; leave `canonicalCloneUrl` unchanged so no
  `plugin-clones/<key>/` moves; make `swapCloneUrl` take the URL list from the source (probe-ordered,
  as `_Fi`) instead of the recorded origin, or at least fold an SSH origin back to the source; make
  `hostFromCloneUrl` safe on scp. **[Maintainer, small]** adopt `Ort`'s lower-casing of `owner/repo`
  (closes IN-05, a visible change: `Owner/Repo` and `owner/repo` become one marketplace) or keep the
  exact compare under D-3-01.
- **NFR-5:** the recognizer stays fs-only/local. **NFR-10:** unchanged; recognition stays the only
  authority for removal (D-3-02), now with the wider fold. **D-SG:** fits D-SG-10's swap; no new
  network.
- **Confidence:** HIGH.

### Maintainer questions (collected)

1. Q6: accept `http://` for git sources (parity) despite D-PL5-04/05/33? Hosted catalogs stay https.
2. Q6: keep `marketplace add ssh://...` refused as upstream does?
3. Q7: which upstream surface `/claude:plugin install` (and `apply`, import) mirrors: CLI (probe and
   fallback) or in-session `/plugin` (SSH only)?
4. Q7: do `update`, `reinstall`, and dependency moves go SSH only as upstream's, or follow install?
5. Q7: tag reads (D-SG-09, D-03-03) and git-subdir shorthand: upstream's SSH default, or the
   transport the command chose?
6. Q18: HTTPS-only for GitHub sources while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set?
7. Q18 (optional): memoize the marketplace probe per command (invisible divergence)?
8. Q21: confirm the Windows retry is in scope (depends on answer 3).
9. Progress lines: transport line only in the debug log, retry and both-failed in the output?
10. SG-SSH-06: lower-case `owner/repo` in identity (closes IN-05)?

## Summary table

| Question | Upstream answer (2.1.332, same as 2.1.330 unless noted) | Recommendation | Reversible / costly | Confidence |
|---|---|---|---|---|
| Q6 forms | Validator: https, http, ssh, git+ssh, ssh+git, scp, host-less file; `git://` refused. CLI add: scp and `http(s)...git` are `git`; `ssh://` forms refused. git-subdir `url` validated (F-2). | Amend D-76-01; port `iTs` for every git address incl. git-subdir; scp on add; `ssh://` refused on add | `http://`: costly / preference; rest reversible | HIGH |
| Q7 plugin transport | CLI install: skip checks, probe, HTTPS then SSH; members inherit (optional deps new in 2.1.332). `/plugin`, update, repair: SSH only. Tags: SSH | Mirror the CLI install; ask about update and tag reads | Costly / preference | HIGH |
| Q16 variables | `CLAUDE_CODE_REMOTE \|\| CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, both `H.bool()`, HTTPS everywhere for GitHub | Read PREFER_HTTPS by name; `CLAUDE_CODE_REMOTE` not read (capability gap) | Reversible technical | HIGH |
| Q18 probe | `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`, 3 s, cwd home, three states; no cross-command cache; plugin CLI memoizes per command | Exact port in `git-process.ts`; HTTPS-only under the base override | Reversible technical (override rule: preference) | HIGH / LOW live |
| Q21 Windows | SSH first, no probe; publickey/host-key failure + `-G` check -> HTTPS, then SSH | Only with Q7's CLI surface; unit rows; manual Windows check | Reversible technical | MEDIUM |
| Lines and errors | `Cloning via SSH/HTTPS`, `SSH not configured, cloning via HTTPS`, `<T> clone failed, retrying with <T2>`, `failed on both attempts`; plugin `The retry over SSH failed too` | Outcome kinds here, wording Phase 6 | Reversible technical | HIGH |
| SG-SSH-06 identity | Declared source + `Ort` GitHub fold; no origin reads; HEAD vs `ls-remote` | Port `Ort` into origin compare and seeding; keep `canonicalCloneUrl` | Reversible (case fold: preference) | HIGH |
