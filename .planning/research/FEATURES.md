# Feature Research

**Domain:** Claude Code-compatible git transport for plugin marketplaces and git-source plugins (milestone system-git: replace `isomorphic-git` with the system `git` binary)
**Researched:** 2026-11-22
**Confidence:** HIGH for the marketplace and plugin clone paths (read in the 2.1.330 binary and confirmed by the docs); MEDIUM for background autoupdate wiring, plugin clone timeouts, and the marketplace SHA-pin path (behind a feature flag); LOW where marked unverified.

## How the evidence was gathered

- **Binary:** `/opt/claude-code/bin/claude`, `VERSION:"2.1.330"`, `BUILD_TIME:"2026-11-20T17:34:37Z"`, `GIT_SHA:"8c664bec500172ded713624f9ecac0eb7e714829"`. Grepped on 2026-11-22 with `grep -oa` and a byte-offset context extractor. No Claude Code process was run. Minified names such as `hCi`, `X$t`, and `qpt` belong to this build only. Use the quoted string literals to find the code again in a later build.
- **Docs, fetched 2026-11-22:** `https://code.claude.com/docs/en/plugins/host-marketplace.md`, `https://code.claude.com/docs/en/plugin-marketplaces` (now the "Create a marketplace" page), `https://code.claude.com/docs/en/plugins/troubleshooting.md`, `https://code.claude.com/docs/en/plugins/cli-reference.md`.
- **Confidence tiers:** `.agents/skills/claude-code-compat-research` ranks the binary above the docs. A record is HIGH when the binary shows the behavior, and the docs agree where they say anything. The GSD `classify-confidence` seam rates `webfetch` LOW, even with `--verified`. So a fact that only the docs support is rated MEDIUM here, never HIGH.

## Corrections to the prior-session claims

| Claim | Verdict | Correction |
|---|---|---|
| `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`, 3 s timeout | **Confirmed** | Success needs exit 1 **and** `successfully authenticated` in the output. |
| SSH when the probe succeeds, else `SSH not configured, cloning via HTTPS: <url>`, then HTTPS | **Confirmed, with a split** | Marketplaces and plugins read the probe differently (E-SG-02 vs E-SG-04). A marketplace goes SSH-first only on `configured`. A plugin goes HTTPS-first only on `not-configured`, and an `unknown` result means SSH only. |
| If HTTPS fails, retry SSH (`HTTPS clone failed, retrying with SSH: <url>`) | **Confirmed, too narrow** | Marketplaces retry in both directions (`SSH clone failed, retrying with HTTPS: …` too). The plugin CLI install retries HTTPS→SSH only. Its SSH→HTTPS retry runs only on Windows. |
| Probe skipped when `GIT_SSH_COMMAND`/`GIT_SSH` is set or git config rewrites the URL | **Partly wrong** | The skip happens only on the plugin CLI install path. It also covers `core.sshCommand` and an `ssh -G` ProxyCommand/ProxyJump check, and it means SSH only, with no fallback. The marketplace path always probes, unless HTTPS is forced. |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` (or `CLAUDE_CODE_REMOTE`) forces HTTPS | **Confirmed** | `function k4t(){return s.CLAUDE_CODE_REMOTE\|\|s.CLAUDE_CODE_PLUGIN_PREFER_HTTPS}`. It also changes the URL that git-subdir `owner/repo` and SHA resolution use. |
| `GIT_TERMINAL_PROMPT=0`, askpass not run | **Confirmed, more than that** | Also `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, `credential.interactive=false`, and SSH `BatchMode=yes` plus `StrictHostKeyChecking=yes`. |
| Background autoupdate never prompts, fails quietly, keeps the checkout | **Confirmed (docs + code path)** | An update is an `ls-remote` check, then a **full re-clone and swap**, never `fetch`/`pull`. |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` | **Confirmed** | It applies only when `ls-remote` says `unreachable` and the checkout already has `.claude-plugin/marketplace.json`. |
| Env tokens like `GITHUB_TOKEN` alone don't authenticate | **Confirmed (docs)** | The binary's clone paths inject no token. |
| No OAuth or Device Flow for plugins | **Confirmed (docs)** | "Claude Code has no git token of its own." A claude.ai GitHub-connection proxy exists only in remote sessions. |
| `--depth 1`; `--recurse-submodules --shallow-submodules` or `--no-recurse-submodules`; `--branch <ref>`; SHA via `fetch --depth 1 origin <sha>`, then `--unshallow`, then `checkout` | **Confirmed for plugin clones** | Marketplaces clone `--no-recurse-submodules`, then run `submodule update --init --recursive --depth 1` on only the submodules that hold plugin files. A marketplace pinned to a SHA ref is not shallow. |
| stderr redacted | **Confirmed** | Credentials in the URL are scrubbed from stderr. Plugin clones also force `LC_MESSAGES=C`. |
| `Failed to clone marketplace repository: ...` and `SSH authentication failed. Please ensure your SSH keys are configured for <host>, or use an HTTPS URL instead.` | **Confirmed** | `<host>` is `GitHub` for github.com, else the host, else `your git host`. Nine message classes in total (E-SG-10). |
| In-session `/plugin` installs and plugin updates don't fall back to HTTPS | **Confirmed** | Only `claude plugin install` from the shell passes the fallback context. Every other plugin clone of a `github` source is SSH only unless HTTPS is forced. |

## Upstream evidence records

Each record uses the skill's fields, so a phase CONTEXT.md can carry it over unchanged.

### E-SG-01: The SSH probe

- **Question:** What does Claude Code run to decide whether GitHub SSH is configured, and how does it read the result?
- **Behavior:** It runs `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` with a 3000 ms timeout. The result has three states:
  - `configured`: exit 1 and `successfully authenticated` in stdout+stderr.
  - `unknown`: a timeout, a thrown error, or anything else when `ssh` is on PATH.
  - `not-configured`: exit 255 with `Permission denied (publickey` or `Host key verification failed`, or no `ssh` on PATH.

  The probe always targets github.com. GHES and other hosts are never probed.
- **Evidence (binary 2.1.330, 2026-11-22):** `async function DCn(){try{let e=await kt("ssh",["-T","-o","BatchMode=yes","-o","ConnectTimeout=2","-o","StrictHostKeyChecking=yes","git@github.com"],{cwd:Jut(),timeout:3000}),o=...,r=e.code===1&&o.includes("successfully authenticated");...if(r)return"configured";if(e.timedOut)return"unknown";if(e.code===255&&zpt(o))return"not-configured";return await Bf("ssh")===null?"not-configured":"unknown"}`, where `function zpt(e){return e.includes("Permission denied (publickey")||e.includes("Host key verification failed")}`. Docs (host-marketplace, 2026-11-22): "Claude Code probes `ssh -T git@github.com` and clones over SSH when the probe succeeds."
- **Confidence:** HIGH. The code is explicit.
- **Open questions:** Neither path memoizes the probe across commands. The plugin CLI install memoizes it within one command (`probeSsh:()=>o??=DCn()`). The marketplace path calls it once per marketplace fetch.
- **Pi/project constraints:** `child-process-chokepoint` must admit the module that spawns `ssh`. NFR-5 allows network only on the listed operations, and the probe is network. It runs only inside operations that already have network.
- **Divergence:** None proposed.

### E-SG-02: GitHub `owner/repo` marketplace: transport choice and retry

- **Question:** Which URL does a `github` marketplace source clone, and what happens when it fails?
- **Behavior:** `git@github.com:<repo>.git` is the SSH URL and `https://github.com/<repo>.git` the HTTPS one.
  - If `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` or `CLAUDE_CODE_REMOTE` is set, Claude Code clones HTTPS only, with the progress line `Cloning via HTTPS: <url>`.
  - Otherwise it probes. On `configured` it tries SSH first (`Cloning via SSH: <url>`). On `unknown` or `not-configured` it tries HTTPS first (`SSH not configured, cloning via HTTPS: <url>`).
  - When the first attempt fails for any reason, on any OS, it prints `<First> clone failed, retrying with <Second>: <url>` and tries the other transport.
  - When both fail and the messages differ, the error is `Fetching the marketplace from GitHub failed on both attempts. <T1> (<url1>): <msg1>\n\n<T2> (<url2>): <msg2>`.
  - The path checks nothing about `GIT_SSH_COMMAND`, `GIT_SSH`, `core.sshCommand`, or `insteadOf`.
- **Which operations:** All marketplace clones go through the same `X$t` function: `marketplace add` (`Bie`), a load that finds the cache corrupt or missing (`q9`), and the bulk refresh behind `marketplace update` (the loop that logs `Skipping marketplace '…' in bulk refresh`). The "is the clone at this commit" check (`rOo`) also uses both URLs, ordered by the probe.
- **Evidence (binary):** `case"github":{let At=\`git@${Kr}:${e.repo}.git\`,pt=\`https://github.com/${e.repo}.git\`;...if(k4t()){fE(r,\`Cloning via HTTPS: ${pt}\`),...break}let jt=await LNe(),[sn,Gt]=z$t(jt,At,pt);fE(r,jt?\`Cloning via SSH: ${At}\`:DNe(pt))...catch(Jt){...fE(r,\`${sn.transport} clone failed, retrying with ${Gt.transport}: ${Gt.url}\`)...throw ...QMo(...)}`. `async function LNe(){return await DCn()==="configured"}`. `function z$t(e,o,r){let g={transport:"SSH",url:o},h={transport:"HTTPS",url:r};return e?[g,h]:[h,g]}`. Docs (host-marketplace): "If the probe fails, or the SSH clone itself fails, it clones over HTTPS. Users on machines without a GitHub SSH key can set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` to skip the probe and clone over HTTPS." Docs (troubleshooting): "Without it, Claude Code clones those sources over SSH when an SSH key for `github.com` looks configured, and falls back to HTTPS when the SSH clone fails."
- **Confidence:** HIGH.
- **Open questions:** `Kr` is almost certainly `github.com`. The docs say `git@github.com`, but the constant itself was not traced.
- **Pi/project constraints:** D-MF-01 (`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`) overrides the github.com base. Upstream has no such override, so it is a recorded project divergence and needs a rule for which host the SSH URL and the probe use under the override.
- **Divergence:** Possibly D-MF-01's interplay. Decide in discuss.

### E-SG-03: `git` marketplace sources (any URL)

- **Question:** Does a non-GitHub git URL get a probe or a fallback?
- **Behavior:** No. It clones `e.url` exactly once, over whichever transport the URL names. An scp-form `user@host:path` URL uses SSH, and `https://` uses HTTPS.
- **Evidence (binary):** `case"git":{be=Ih(z,Ge),ve=!0,qe=await PG(e.url,be,g,e.path,e.ref,e.sparsePaths,r),...}`. Docs (host-marketplace): "`git@host:path.git`: SSH. `https://example.com/repo.git`: HTTPS."
- **Confidence:** HIGH.

### E-SG-04: GitHub `owner/repo` plugin source: transport choice and retry

- **Question:** Which transport does a `github` plugin source use, and when does it fall back?
- **Behavior:** This differs from the marketplace path.
  1. With `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` or `CLAUDE_CODE_REMOTE` set, it clones HTTPS only.
  2. Without a fallback context it clones **SSH only** (`git@github.com:<repo>.git`). Every caller except `claude plugin install` from the shell lacks that context: in-session `/plugin` installs, `plugin update`, autoupdate, dependency installs, and session-start loads.
  3. With the context, it first asks whether to go to HTTPS (`qpt`). On non-Windows the answer is yes only if all of these hold:
     - no `GIT_SSH_COMMAND` and no `GIT_SSH`;
     - no `core.sshCommand` in git config;
     - `git ls-remote --get-url -- <ssh-url>` returns the URL unchanged, so no `insteadOf` rewrite (5 s timeout);
     - the probe says `not-configured`;
     - and either `ssh` is absent, or `ssh -G git@github.com` shows `hostname github.com` with no ProxyCommand or ProxyJump (5 s timeout).

     If any check fails, it logs `... staying on SSH` and clones SSH only, with no fallback on non-Windows.
  4. When it goes to HTTPS, it notifies `SSH not configured, cloning via HTTPS: <https-url>` and clones HTTPS. On a clone-step failure of any kind it notifies `HTTPS clone failed, retrying with SSH: <ssh-url>` and retries SSH. If that also fails, the error is `<https error>\nThe retry over SSH failed too: <ssh error>\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.`
  5. On Windows, the path always tries SSH first. If SSH fails with `Permission denied (publickey` or `Host key verification failed`, and a `git ls-remote` with `GIT_SSH_COMMAND="<cmd> -G >&2"` shows github.com reached directly, it falls through to step 4.
- **Evidence (binary):** `async function hCi(e,o,r,g,h,y){...let k=\`git@${Kr}:${e}.git\`,R=\`https://github.com/${e}.git\`;if(k4t())return Aoe(R,o,r,g,h);if(y===void 0)return Aoe(k,o,r,g,h);if(!await qpt(y,k,o,!1))try{return await Aoe(k,o,r,g,h)}catch(H){if(!oUt(H)||!zpt(d(H))||!await qpt(y,k,o,!0))throw H;...}y.notify(DNe(R));try{return await Aoe(R,o,r,g,h)}catch(H){...y.notify(ICn(k));try{return await Aoe(k,o,r,g,h)}catch(z){...throw new C(\`${d(H)}\nThe retry over SSH failed too: ...\`` ; `qpt`: `if(tA(y,"GIT_SSH_COMMAND")!==void 0||tA(y,"GIT_SSH")!==void 0)return!1;let k=await OF(o);if(k.command!==void 0)return!1;...["ls-remote","--get-url","--",o]...timeout:5000});if(z.code!==0||z.stdout.trim()!==o)return t(\`GitHub SSH URL is rewritten by git config, or git could not say ...: staying on SSH\`),!1;...if(await e.probeSsh()!=="not-configured")return!1;if(await Bf("ssh")===null)return!0;let X=await kt("ssh",["-G","git@github.com"],...timeout:5000});if(X.code===0&&OCn(X.stdout))return!0;` The fallback context is built only in the CLI install: `Mvn(..., {..., gitHubHttpsFallback:kWa((k)=>{f.push(k)})}, l)` inside the function that emits `tengu_plugin_installed_cli` with `install_source:S("cli-explicit")`. Docs (host-marketplace): "For a `github` source, that command can fall back to HTTPS on its own, printing `SSH not configured, cloning via HTTPS`. Installs from `/plugin` inside a session and plugin updates don't fall back, so without the variable they fail for users who have no GitHub SSH key."
- **Confidence:** HIGH for steps 1 to 4 and for the caller scope. MEDIUM for step 5's Windows detail and for whether the CLI install's dependency cascade inherits the context (`fdr` receives it with `explicit:!0`, but the hand-off to dependency members was not traced).
- **Pi/project constraints:** Pi has no shell-versus-session split. Every `/claude:plugin install` runs inside a Pi session, so we must choose which upstream surface it mirrors.
- **Divergence:** This is a genuine question for discuss. Matching the in-session `/plugin` behavior (SSH only) is strict parity. Matching `claude plugin install` (probe plus fallback) is the friendlier upstream surface. Neither license applies by itself, so the user decides.

### E-SG-05: `url` and `git-subdir` plugin sources

- **Question:** Do they probe or fall back?
- **Behavior:**
  - `url`: validates the URL (E-SG-08) and clones it as written. No probe, no fallback.
  - `git-subdir`: if `url` matches `^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$`, it becomes `https://github.com/<r>.git` when HTTPS is forced, else `git@github.com:<r>.git`. Otherwise the URL is used as written. No probe, no fallback. It first checks that git exists: `git-subdir plugin source requires git to be installed and on PATH. Install git (version 2.25 or later for sparse-checkout cone mode) and try again.`
  - When a git-subdir plugin's version comes from a SHA, the clone URL follows the same rule (`function Upt(e){return k4t()?\`https://github.com/${e}.git\`:\`git@${Kr}:${e}.git\`}`).
- **Evidence (binary):** `case"url":...X=await Aoe(e.url,k,e.ref,e.sha,{...})`; `function yCi(e){if(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(e))return k4t()?\`https://github.com/${e}.git\`:\`git@${Kr}:${e}.git\`;return vas(e)}`. Docs (host-marketplace): "Claude Code clones a public `url` or `git-subdir` source over HTTPS without credentials when the entry gives an `https://` URL. For a `github` source, or a `git-subdir` source written as `owner/repo`, tell users without a GitHub SSH key to set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`."
- **Confidence:** HIGH.

### E-SG-06: Plugin clone commands, refs, SHAs, and submodules

- **Question:** What exact git commands does a plugin clone run?
- **Behavior:**
  - Clone: `git -c core.sshCommand="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" <pinArgs> [-c submodule.recurse=false] clone --depth 1 (--recurse-submodules --shallow-submodules | --no-recurse-submodules) [--branch <ref>] [--no-checkout] -- <url> <dir>`.
  - `--branch` is added only when there is no SHA. `--no-checkout` is added when there is one.
  - Submodules are off when the plugin has a "directory pin" (`noSubmodules:o.directoryPin!==null`), else recursive and shallow.
  - SHA pins: `fetch --upload-pack=git-upload-pack --depth 1 origin <sha>`. On failure, log `Shallow fetch of SHA … failed, falling back to unshallow fetch` and run `fetch --upload-pack=git-upload-pack --unshallow [origin <ref>]`. Then `checkout <sha>`, and `rev-parse HEAD` must equal the SHA, else `SHA pin verification failed: expected HEAD to be <sha>, got <x>. The pinned commit may have been removed upstream, or a ref with the same name exists. Refusing to install.`
  - Submodule commits are checked against what the parent repository records (`SHA pin verification failed: submodule … is on commit …`). That check runs behind a feature flag.
  - Input guards: a SHA must be 40 or 64 hex digits (`Invalid sha "<x>": must be a full commit hash (40 or 64 hex digits)`), and a ref may not start with `-` (`Invalid ref "<x>": cannot start with "-"`).
  - git-subdir: `clone --depth 1 [--filter=tree:0] --no-checkout [--branch <ref>]`, sparse-checkout of the path, `read-tree -u --reset HEAD` (or `<sha>`), the same SHA fetch and unshallow fallback, a refusal for a path through a symlink, and `Subdirectory '<p>' not found in repository <url> (ref: <r>). Check that the path is correct and exists at the specified ref/sha.`
- **Evidence (binary):** `let be=[...fxt,...H,...X,"clone","--depth","1",...y?["--no-recurse-submodules"]:["--recurse-submodules","--shallow-submodules"]];if(r&&!g)be.push("--branch",r);if(g)be.push("--no-checkout");be.push("--",e,o);` and `[...Q,"fetch",A8,"--depth","1","origin",g]` … `t(\`Shallow fetch of SHA ${g} failed, falling back to unshallow fetch\`);let Ke=await ut(Dt(),[...Q,"fetch",A8,"--unshallow",...r?["origin",r]:[]]` … `[...Q,"checkout",g]`. `var A8="--upload-pack=git-upload-pack"`. `var fxt=["-c","core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes"]`.
- **Confidence:** HIGH for the commands. MEDIUM for what sets `directoryPin`: `lve(pluginId, source)`, which looks tied to Anthropic's official directory listing. Not traced.

### E-SG-07: Marketplace clone, update, submodules, sparse paths, SHA refs

- **Question:** How is a marketplace cloned and updated?
- **Behavior:**
  - Clone into a `<name>..clone` staging directory: `git -c core.sshCommand=… <pinArgs> clone [--depth 1] [--filter=blob:none] (--no-checkout | --no-recurse-submodules) [--no-checkout --origin origin | --branch <ref>] -- <url> <dir>`.
    - `--depth 1` is dropped only for a SHA ref.
    - `--filter=blob:none` is added for sparse paths or a SHA ref, when the protocol supports it.
    - `--no-checkout` is used when `--sparse` paths are set.
  - Submodules (v2.1.295+, per the docs): after the clone, `submodule update --init --recursive --depth 1 [-- <paths>]` runs for only the submodules that hold plugin files. A plugin at the root that names a submodule path gets every submodule (`-c submodule.active=.`).
  - Sparse: `sparse-checkout` for each recorded path, then `read-tree -u --reset HEAD`. The paths are saved in `.git` so a later change of paths forces a re-clone.
  - Update (the freshness probe `$Ft`): no `fetch` or `pull` ever runs.
    - If the sparse paths changed, or HEAD is unreadable, the result is `stale`.
    - If `ref` is a full SHA, compare it to HEAD.
    - Otherwise run `git ls-remote -- <url> HEAD` (or `refs/heads/<ref>`, `refs/tags/<ref>^{}`, `refs/tags/<ref>`). An equal SHA means `current`. A non-zero exit means `unreachable`. A different SHA, or a ref not advertised, means `stale`.
    - `current` returns at once. `unreachable` with `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` set and an existing `.claude-plugin/marketplace.json` keeps the clone, with the log `Marketplace remote unreachable, keeping existing clone (CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE)`. Anything else re-clones into staging, renames the live directory to `<name>.bak`, moves the staged clone in, and deletes `.bak`. A failed re-clone leaves the old checkout in place.
  - A marketplace `ref` that is a 40/64-hex SHA (behind the `tengu_tender_raven` flag) clones with full depth and `--filter=blob:none`. It then fetches `+refs/heads/*` and `+refs/tags/*` into `refs/marketplace-pin/*`, checks that a branch or tag contains the commit, and runs `update-ref --no-deref HEAD <sha>` and `read-tree`. An uppercase SHA ref is refused, and reserved official names refuse SHA refs.
  - Progress lines: `Refreshing marketplace cache (timeout: <n>s)…`, `Cloning repository (timeout: <n>s): <url>[ (ref: <r>)]`, `Replacing the existing marketplace clone…`, `Clone complete, validating marketplace…`.
  - After a clone, a Git LFS pointer scan warns (`… checked out as Git LFS pointer files … Claude Code never downloads Git LFS content there`).
- **Evidence (binary):** `ae=[...fxt,...X,"clone",...z===void 0?["--depth","1"]:[]];if((H||z!==void 0)&&Tis(e))ae.push("--filter=blob:none");if(H)ae.push("--no-checkout");else ae.push("--no-recurse-submodules");if(z!==void 0)ae.push("--no-checkout","--origin","origin");else if(r)ae.push("--branch",r);ae.push("--",e,o);`. `"submodule","update","--init","--recursive","--depth","1",...Q==="all"?[]:["--",...Q]`. `$Ft`: `Q=await bNe(o,{patterns:r===void 0?["HEAD"]:[\`refs/heads/${r}\`,\`refs/tags/${r}^{}\`,\`refs/tags/${r}\`],timeout:h})` … `if(Q.code!==0)return ... "unreachable"`. Docs (host-marketplace): "The check finds new commits, or fails because it can't reach or authenticate to the remote: Claude Code clones the marketplace again and replaces the existing checkout with the new clone. If that clone fails, the existing checkout stays in place." Docs (plugin-marketplaces): "Claude Code clones the repository and fetches only the git submodules that hold plugin files. Requires Claude Code v2.1.295 or later."
- **Confidence:** HIGH for clone, update, and KEEP. MEDIUM for the SHA-ref path, which a feature flag gates.
- **Pi/project constraints:** Today `platform/git.ts` keeps full history, follows no submodules, and updates with `fetch` plus `checkout`. Upstream's re-clone-and-swap fits NFR-1 (atomic rename) and NFR-3 (retry-safe) better than an in-place fetch.

### E-SG-08: Accepted URL forms

- **Question:** Which git addresses does Claude Code accept?
- **Behavior:**
  - The validator (`vas`, `Invalid git URL…`) accepts `https:`, `http:`, `ssh:`, `git+ssh:`, `ssh+git:`, a local `file://` with no host, and scp form `user@host:path` (no `://` allowed in it). It refuses `git://` ("isn't supported because it isn't encrypted"), control characters, `%00`, square brackets except around an IPv6 host, a backslash in an http(s) authority, and an ssh URL with `?` or `#` or an odd host or user.
  - Separately, every git command carries `-c protocol.{ext,fd,git,ftp,ftps}.allow=never`, and a user's `GIT_ALLOW_PROTOCOL` only narrows `https,http,ssh,file` further.
  - `marketplace add` source strings (CLI reference): `owner/repo`, `owner/repo#ref`, `owner/repo@ref` → `github`; `user@host:path[.git][#ref]` → `git` over SSH; an `http(s)://` URL ending `.git[#ref]` or containing `/_git/` → `git`; `https://github.com/owner/repo` or `https://gitlab.com/ns/project` → `git` with `.git` appended; any other `http(s)://` URL → hosted `marketplace.json`; paths → `directory` or `file`. `ssh://` is not in the CLI table, but the validator accepts it for settings entries and plugin `url` sources.
- **Evidence (binary):** `var U="https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted."` and `if(!["https:","http:","ssh:","file:","git+ssh:","ssh+git:"].includes(i.protocol))`. `var zt=["-c","protocol.ext.allow=never","-c","protocol.fd.allow=never","-c","protocol.git.allow=never","-c","protocol.ftp.allow=never","-c","protocol.ftps.allow=never"]`. Docs (cli-reference, 2026-11-22): the source-form table quoted above.
- **Confidence:** HIGH for the validator. MEDIUM for whether `marketplace add ssh://…` parses as a `git` source, because the CLI source parser itself was not traced.
- **Pi/project constraints:** **D-76-01** ("`url` marketplace sources accept https:// only … `http://`, `ssh://`, and `git@host:` scp-form all reject") rests on `isomorphic-git` having no SSH. This milestone removes that reason, so accepting `git@host:` and `ssh://` needs an amendment of D-76-01 with its own ID. `http://` is a separate question: D-PL5-04/05/33 keep it refused. Only the user can relax that.

### E-SG-09: Non-interactive environment and hardening

- **Question:** What environment and config does every remote git command run under?
- **Behavior:**
  - Env: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, plus `credential.interactive=false` appended through `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n`, keeping any count the user already set.
  - SSH: `GIT_SSH_COMMAND` becomes `<chosen ssh> -o BatchMode=yes -o StrictHostKeyChecking=yes`. The chosen ssh is the user's `GIT_SSH_COMMAND`, else `core.sshCommand`, else `GIT_SSH`, else `ssh`. The `ssh.variant` and `GIT_SSH_VARIANT` handling covers `plink` (`-batch`) and `tortoiseplink`.
  - Config pins: `init.defaultRefFormat=files`, `core.longpaths=true`, the protocol bans above, and `GIT_CEILING_DIRECTORIES=<dir>`.
  - In-checkout hardening: `core.fsmonitor=`, `core.hooksPath=/dev/null`, `core.askPass=`, `protocol.ext.allow=never`, `submodule.recurse=false`, every `hook.<name>.enabled=false`, `gc.auto=0`, `maintenance.auto=false`.
  - Plugin clones force `LC_MESSAGES=C` so stderr matching works in any locale.
  - The credential helper stays enabled but cannot prompt. Docs: "Claude Code leaves the user's git credential helper enabled but forbids it from prompting, and doesn't run askpass programs such as one set in `GIT_ASKPASS`."
- **Evidence (binary):** `var vve={GIT_TERMINAL_PROMPT:"0",GIT_ASKPASS:"",GCM_INTERACTIVE:"never"};function GJe(e=process.env){return{...e,...,...vve,...w1(tA(e,"GIT_CONFIG_COUNT"),[["credential.interactive","false"]],e)}}`. `function nn(e=GJe(rn()),n){let r=[...Qt(e),...en,...tn]...}`, `var en=["-c","init.defaultRefFormat=files"]`, `tn=["-c","core.longpaths=true"]`. `function sLo(e){let{LC_ALL:o,...r}=e;return{...r,LC_ALL:void 0,...,LC_MESSAGES:"C"}}`. `function uxt(){return[["core.fsmonitor",""],["core.hooksPath",KLr()],["core.askPass",""],["protocol.ext.allow","never"],...,["submodule.recurse","false"],...]}`.
- **Confidence:** HIGH for env and pins. MEDIUM for which commands carry the `uxt` in-checkout list. It sits in the `inCheckoutArgs` family, but that was not traced line by line.
- **Pi/project constraints:** `platform/git-credential.ts` already sets `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` for `git credential`. `test/architecture/hermetic-git-environment.test.ts` must be rebuilt around a real git binary.

### E-SG-10: Error classification and messages

- **Question:** How are clone failures classified and worded?
- **Behavior (marketplace clone, `ZMo`):** each class prepends one message to `\n\nOriginal error: <redacted stderr>`. The command then throws `Failed to clone marketplace repository: <that>`.

  | Trigger in stderr | Message |
  |---|---|
  | Clone timed out | `Git clone timed out after <n>s. The repository may be too large for the current timeout. Set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to increase it (e.g., 300000 for 5 minutes).` |
  | `REMOTE HOST IDENTIFICATION HAS CHANGED` | `SSH host key has changed (server key rotation or possible MITM). Remove the stale known_hosts entry:\n  ssh-keygen -R <host>\nThen connect once manually to verify and accept the new key.` |
  | `Host key verification failed` | `SSH host key is not in your known_hosts file. To add it, connect once manually (this will show the fingerprint for you to verify):\n  ssh -T git@<host>\n\nOr use an HTTPS URL instead (recommended for public repos).` |
  | `Permission denied (publickey)` or `Could not read from remote repository` | `SSH authentication failed. Please ensure your SSH keys are configured for <GitHub\|host\|your git host>, or use an HTTPS URL instead.` |
  | `Authentication failed`, `could not read Username`, `unable to get password from user`, `terminal prompts disabled`, or 401/403 | `HTTPS authentication failed. Please ensure <your credential helper is configured (e.g., gh auth login) \| your git credential helper has valid credentials for <host> (e.g., a personal access token)>. Claude Code runs this clone with terminal prompts and askpass programs turned off and tells credential helpers not to prompt, so git needs a credential it can get without asking you, such as one a credential helper already holds.` |
  | `timed out`, `timeout`, or `Could not resolve host` | `Network error or timeout while cloning repository. Please check your internet connection and try again.` |
  | Empty stderr | `git clone exited with code <n> (no stderr output). Run with --debug to see the full command.` |

  For the SSH messages, `<host>` comes from the scp form only; a `://` URL gives `<host>`.

  Plugin clones (`rLo`) use other wording: `Failed to clone repository: [timed out after <n>s (CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS sets the limit). ]<redacted stderr>`. They sort failures into typed classes: `fatal: remote error:` is generic; `xcrun: error:` or git missing on macOS is a "git missing" class (`git is not installed on this Mac. To install it, run xcode-select --install, then try again.`); a git-proxy 403 is a proxy class; a network regex (`fatal: unable to access '…': `, `error: RPC failed; curl (6|7|18|28|35|52|55|56|60|92)`, `HTTP 4xx/5xx`, `ssh: Could not resolve hostname `, `ssh: connect to host … port …: `, `fatal: unable to connect to `) is a network class.

  Telemetry buckets (`Epe`): `dns_or_refused`, `timeout`, `conn_reset`, `auth`, `not_found`, `tls`, `invalid_schema`, `other`.

  Redaction: `Dve(stderr, url)` replaces every credential-bearing spelling of the URL with its redacted form before any message is built.

  Windows git lookup: `Command 'git' not found or is in an unsafe location (current directory)`.
- **Evidence (binary):** the message literals above, all inside `async function ZMo(` and `function rLo(`; `var SCi=/^(?:fatal: unable to access '[^']*': |error: RPC failed; (?:curl (?:6|7|18|28|35|52|55|56|60|92)\b|HTTP [45]\d\d)|ssh: Could not resolve hostname |ssh: connect to host \S+ port \d+: |fatal: unable to connect to )/`. Docs (troubleshooting): sections `SSH authentication failed or HTTPS authentication failed`, `SSH host key is not in your known_hosts file`, `Command 'git' not found or is in an unsafe location`, `Git clone timed out after 120s`, `Invalid git URL`.
- **Confidence:** HIGH.
- **Pi/project constraints:** IL-1 (English only) fits. IL-2 means every message goes through `notify()`. The NFR-10/IL-2 rule on redacting absolute paths (`shared/redact-absolute-paths.ts`) still applies on top of URL redaction. `shared/git-failure-classifiers.ts` is the natural owner.

### E-SG-11: Timeouts and environment variables read

- **Behavior:**
  - Marketplace clone, re-clone, and freshness `ls-remote`: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` when greater than 0 (capped at 2147483647), default 120000 ms.
  - Probe: 3000 ms. `ls-remote --get-url` and `ssh -G`: 5000 ms each.
  - Plugin clones take `gitTimeoutMs`, which the session-start load sets to the same 120 s value. Whether an explicit install sets a timeout is unverified.
  - Variables read on this surface: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, `GIT_SSH_COMMAND`, `GIT_SSH`, `GIT_SSH_VARIANT`, `GIT_CONFIG_COUNT`, `GIT_ALLOW_PROTOCOL`, `LC_ALL` (moved to `LC_CTYPE`), and `CLAUDE_CODE_TMPDIR` (used to read ssh settings), plus git config `core.sshCommand` and `ssh.variant`.
- **Evidence (binary):** `var pbi=120000,...;function Wto(){let e=s.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;if(e!==void 0&&e>0)return Math.min(e,au);return pbi}` with `var au=2147483647`. `gitTimeoutMs:Wto()` in the session-load call. The `OF` function reads `"^(core\\.sshcommand|ssh\\.variant)$"`. Docs (troubleshooting): "Cloning a marketplace, and re-cloning one to update it, gets 120 seconds by default."
- **Confidence:** HIGH for the marketplace timeout and the variable list. LOW for the explicit-install plugin clone timeout (unverified).

### E-SG-12: Background autoupdate and credentials

- **Question:** How does background autoupdate authenticate, and what does it do on failure?
- **Behavior:** It uses the same non-interactive git as everything else, so it never prompts.
  - SSH remotes work with an agent-loaded key.
  - HTTPS remotes work with a helper that already holds a credential.
  - A helper that needs to prompt fails quietly and keeps the checkout.
  - New commits, or an unreachable or unauthenticated remote, trigger a re-clone and swap. A failed re-clone keeps the old checkout.
  - `GITHUB_TOKEN` alone does nothing. A token takes effect only through a helper such as `gh`'s.
  - Autoupdate is off by default except for the official marketplaces (`xFe`: `autoUpdate` setting, else claude.ai and plugin-directory sources, else the reserved official names).
- **Evidence:** Docs (host-marketplace, "What background auto-update does with credentials"), quoted in the corrections table. Binary: the bulk refresh loop calls `X$t(H.source,R,void 0,e,R,void 0,y)`, so E-SG-02's probe and retry apply to it too. `function xFe(e,o,r){if(r!==void 0)return r;if(o.autoUpdate!==void 0)return o.autoUpdate;if(o.source?.source==="claudeai")return!0;if(o.source?.source==="pluginDirectory")return!0;...}`.
- **Confidence:** MEDIUM. The docs say it explicitly and the bulk refresh path is in the binary, but the hop from the background trigger to that loop was not traced.
- **Pi/project constraints:** D-PL8-01 and D-PL8-12 (stored credentials only, no Device Flow), and the AAP rules (autoapply uses stored credentials only). With system git, "stored credentials" becomes "whatever the machine's git and ssh already hold". That is upstream's model exactly, so these decisions get simpler.

### E-SG-13: No token or OAuth of Claude Code's own

- **Behavior:** Claude Code has no git token of its own. `marketplace.json` has no credential field. No Device Flow exists on this surface. The claude.ai GitHub connection matters only in remote sessions, through a git proxy (`proxy: [github_link_required]`, `remote: access denied by the git proxy`).
- **Evidence:** Docs (host-marketplace): "Claude Code runs `git` on their machine with interactive prompts turned off and relies on whatever credentials that machine already holds. Claude Code has no git token of its own, and `marketplace.json` has no field for one." Binary: `MCn` parses `remote: access denied by the git proxy` plus `The requested URL returned error: 403` into `not-in-session` or `no-github-connection`.
- **Confidence:** HIGH for "no token of its own". MEDIUM for the remote-session proxy scope.
- **Pi/project constraints:** The project's GitHub OAuth Device Flow (`domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `platform/git-auth-callbacks.ts`, `platform/git-credential.ts`) has no upstream analogue. Keeping it is a divergence that needs a recorded decision. Removing it is parity.

## Feature Landscape

### Table Stakes (users coming from Claude Code expect these)

| Feature | Why Expected | Complexity | Notes / Dependencies |
|---------|--------------|------------|----------------------|
| System `git` transport behind `platform/git.ts`'s operations (clone, ls-remote, fetch-at-SHA, checkout, rev-parse, read-tree, sparse-checkout, submodule update) | Upstream runs the machine's git (E-SG-06, E-SG-07). It is the only way to get SSH and credential helpers. | HIGH | Replaces `isomorphic-git` (reverses D-21 with a new decision ID). Spawning moves into the `child-process-chokepoint` allow-list. ESLint BLOCK F `NETWORK_SEAMS` keeps naming the same seams if the `platform/git.ts` API shape survives. The fallow `isomorphic-git-chokepoint` rule is retired. |
| Non-interactive env on every git command: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, `credential.interactive=false` via `GIT_CONFIG_COUNT`, SSH `BatchMode=yes` + `StrictHostKeyChecking=yes` | E-SG-09. Without it, a background autoupdate or autoapply can hang on a prompt. NFR-2 forbids a hung session. | MEDIUM | Reuse the env-building pattern in `platform/git-credential.ts`. `GIT_CONFIG_COUNT` must append to the user's count, not overwrite it. |
| Protocol and hook hardening: `protocol.{ext,fd,git,ftp,ftps}.allow=never`, `GIT_ALLOW_PROTOCOL` narrowing only, `core.hooksPath=/dev/null`, `core.fsmonitor=`, hooks disabled, `GIT_CEILING_DIRECTORIES` | E-SG-09. A cloned repository is untrusted. Running its hooks or fsmonitor is code execution. | MEDIUM | Security surface; add threat-model rows. `isomorphic-git` never ran hooks, so this is a new risk that system git brings in. |
| Shallow clones (`--depth 1`), `--branch <ref>`, SHA pins via `fetch --depth 1 origin <sha>` → `--unshallow` fallback → `checkout` → `rev-parse` verification | E-SG-06. Upstream behavior and message wording. | MEDIUM | The current code keeps full history. The plugin version derivation (`domain/version.ts`) and `dependency-tag-probe.ts` must not need history a shallow clone lacks. Check `resolveTagOid` and `listTags` callers. |
| Submodules: plugin clones `--recurse-submodules --shallow-submodules`; marketplaces `--no-recurse-submodules`, then only the submodules that hold plugin files | E-SG-06, E-SG-07. Today submodules are not followed at all, so plugins that need them break. | HIGH (marketplace selective rule) / LOW (plugin recursive) | Start with the plugin rule and a marketplace "all submodules" rule. Upstream's selective rule (read plugin config paths and file text) can follow. Note the `directoryPin` exception (MEDIUM evidence). |
| GitHub `owner/repo` **marketplace** transport: probe → SSH-first only on `configured`, else HTTPS-first; retry the other transport on any failure; the `Cloning via …`, `SSH not configured, cloning via HTTPS: <url>`, and `<T> clone failed, retrying with <T2>: <url>` lines; `failed on both attempts` error | E-SG-01, E-SG-02. Users who learned the upstream messages see the same ones. | MEDIUM | Applies to add, update, autoupdate, cascade add (D-MF-04), and apply. D-MF-01 host override: decide which host gets the SSH URL. The probe always targets github.com upstream. |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` forces HTTPS (no probe) for marketplaces, plugins, git-subdir shorthand, and SHA resolution URLs | E-SG-02, E-SG-04, E-SG-05. Documented upstream as the fix for users without an SSH key. | LOW | Read the upstream name, not a `PI_` alias, so upstream instructions work verbatim. `CLAUDE_CODE_REMOTE` has no Pi meaning; see Anti-Features. |
| Accept `git@host:path` and `ssh://` (`git+ssh://`, `ssh+git://`) addresses for `url`/git marketplace sources and plugin `url`/`git-subdir` sources; refuse `git://` | E-SG-08. Private-repo SSH users need these forms, and they are the point of issue #325. | MEDIUM | Needs a new decision amending **D-76-01**, because its reason (no SSH transport) goes away. Port upstream's validator rules (brackets, `%00`, control characters, backslash in authority, ssh host/user charset). `http://` stays refused under D-76-01 and D-PL5-04/05/33 unless the user decides otherwise. |
| Error classification and wording matching E-SG-10, with stderr URL redaction | Upstream parity on messages users search for. Leaking a token in an error is a security bug. | MEDIUM | `shared/git-failure-classifiers.ts` is rewritten from isomorphic-git error codes to stderr patterns. Force `LC_MESSAGES=C` (and move `LC_ALL` to `LC_CTYPE`) so matching works in any locale. Keep `redact-absolute-paths` on top. |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, default 120 s, for marketplace clone, re-clone, and `ls-remote`; probe 3 s, `--get-url` and `ssh -G` 5 s | E-SG-11. | LOW | Kill the process group on timeout; Windows needs care. The `Git clone timed out after <n>s …` message names the upstream variable. |
| Marketplace update as `ls-remote` freshness check, then **re-clone into staging and atomic swap** (with `.bak` rollback); no in-place fetch | E-SG-07. Upstream semantics, and it fits NFR-1 and NFR-3 better than fetch+checkout. | MEDIUM | Changes `orchestrators/marketplace/update.ts`, `update-preflight.ts`, and `clone-cache.ts`. Containment (NFR-10) must hold for the `..clone` and `.bak` siblings: they live inside `<scopeRoot>/pi-claude-marketplace/`. |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1`: on `unreachable`, keep a checkout that has `.claude-plugin/marketplace.json` | E-SG-07. A documented offline escape hatch. | LOW | Depends on the freshness check returning a typed `unreachable`. |
| Authentication only through what the machine holds (ssh-agent keys, credential helpers such as `gh auth setup-git`); `GITHUB_TOKEN` alone does nothing | E-SG-12, E-SG-13. The milestone goal: "needs no git credential of its own". | LOW (behavior) / HIGH (removal blast radius) | The fate of Device Flow is a discuss decision (see Differentiators and Anti-Features). D-PL8-12 and the AAP rules collapse to "git is non-interactive". |
| Git-missing detection with a clear message | Upstream: `Command 'git' not found or is in an unsafe location (current directory)` (Windows), the macOS `xcode-select --install` message, and the git-subdir "requires git … 2.25 or later" message. D-21's one reason was exactly this failure. | LOW | MA-7 comes back in spirit. Never run a `git` found only in the current directory (Windows `PATH` search order). |

### Differentiators (go beyond upstream; each one is a divergence needing a license)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Probe and HTTPS fallback on **every** `/claude:plugin install` of a `github` plugin, not only the shell CLI install | Pi has no shell-versus-session split, so users without an SSH key would otherwise fail on every github plugin install, the exact pain the upstream docs warn about. | MEDIUM | Upstream's `claude plugin install` does this (E-SG-04 step 3+). Its in-session `/plugin` install does not. Which surface Pi mirrors is a user question. It is not a Pi capability gap, since Pi could do either. Recommendation: mirror `claude plugin install`, because `/claude:plugin install` is typed like a CLI command. Keep `plugin update` and dependency installs SSH-only as upstream does, or ask. |
| Keep the GitHub Device Flow as an opt-in credential source that feeds a git credential helper | Users with no `gh` and no SSH key keep a working path. | HIGH | No upstream analogue (E-SG-13). It needs a recorded decision. It conflicts with the milestone goal ("no token of the extension's own") and with the maintainer's rejection of a global Device Flow toggle (PR #327). Recommendation: remove it. |
| `isomorphic-git` fallback when `git` is missing | Restores D-21's original benefit. | HIGH | Two transports with diverging behavior (no SSH, no submodules in one) is a parity bug factory. Recommendation: do not build it; see Anti-Features. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Reading `GITHUB_TOKEN`/`GH_TOKEN` directly and injecting it into the clone URL or an `http.extraHeader` | "Make it just work in CI" | Upstream explicitly doesn't (E-SG-12). A token in a URL leaks through stderr, `.git/config`, and process lists. It diverges from docs users follow. | Document `gh auth setup-git` or a credential helper, as upstream does. |
| PR #326's `gh auth token` shortcut ahead of Device Flow | Convenience for gh users | Superseded by the milestone; system git with `gh auth setup-git` already uses gh's helper. | System git plus the user's helper. |
| PR #327's global `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW=off` | Turn off prompts | The maintainer rejected the design. System git makes it moot. | Non-interactive git everywhere. |
| Honoring `CLAUDE_CODE_REMOTE` to force HTTPS | Literal parity with `k4t()` | `CLAUDE_CODE_REMOTE` marks a Claude Code remote (cloud) session. A Pi process inheriting it from a cloud shell would silently change transport. | Read only `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`. Record the omission as a Pi capability gap (Pi has no Claude remote-session mode). |
| Auto-accepting unknown SSH host keys (`StrictHostKeyChecking=accept-new`) | Fewer first-run failures | Upstream uses `=yes` on purpose (troubleshooting: "refuses a host whose key you haven't accepted yet rather than accepting the key automatically"). | Match upstream and show its `ssh -T git@<host>` hint. |
| Interactive prompts (passphrase, username/password, GCM GUI) in a TUI session | "I'm at the keyboard anyway" | Pi's background autoupdate and autoapply cannot prompt. Upstream never prompts on this surface. Prompting in some paths and not others is confusing. | Fail with the E-SG-10 message telling the user to load the key into ssh-agent or store a credential. |
| Following the repository's git hooks, LFS smudge, or fsmonitor during clone | "Full fidelity" | Code execution from an untrusted repository. Upstream disables hooks and never downloads LFS content. | Hooks off, LFS pointer warning as upstream. |
| `git pull`/`fetch` in place for marketplace update | Faster for big repos | Not upstream (E-SG-07). A half-applied fetch breaks NFR-1 atomicity. | `ls-remote` check, then re-clone and swap. |
| A `--depth`/`--full` knob or per-marketplace git options | Power users | No upstream knob. Extra divergence surface. | Upstream defaults plus `--sparse`, which upstream has. Sparse support is a separate feature if it isn't already present. |

## Feature Dependencies

```
System git transport (platform/git.ts rewrite)
    ├──requires──> child-process-chokepoint allow-list update + rule-pack retirement of isomorphic-git-chokepoint
    ├──requires──> non-interactive env + hardening config
    ├──requires──> git-missing detection (replaces D-21's rationale)
    └──requires──> stderr-based failure classifiers + URL redaction + LC_MESSAGES=C
                       └──enables──> E-SG-10 message parity

URL validator (ssh://, git@host:) ──requires──> new decision amending D-76-01
                                  └──enables──> SSH for non-GitHub git sources (E-SG-03)

SSH probe (E-SG-01)
    ├──enables──> marketplace github transport + bidirectional retry (E-SG-02)
    └──enables──> plugin github fallback (E-SG-04) ──requires──> discuss decision on which upstream surface Pi mirrors
                     └──requires──> git ls-remote --get-url, git config read, ssh -G checks

CLAUDE_CODE_PLUGIN_PREFER_HTTPS ──short-circuits──> SSH probe (all paths)

Marketplace freshness check (ls-remote) ──requires──> system git
    ├──enables──> re-clone-and-swap update (staging + .bak, NFR-1/NFR-10)
    └──enables──> CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE

Shallow clone ──conflicts──> any code that walks history (tag listing, version-from-history); verify domain/version.ts, dependency-tag-probe.ts, marketplace-tag-probe.ts first

Device Flow removal ──requires──> migration of stored keychain entries + D-PL8-12/AAP rule rewrites + README/README.es.md updates
                    ──conflicts──> "keep Device Flow" differentiator (pick one in discuss)

Test infra: cucumber HTTPS git-host stand-in (CA trust) ──must change──> real git needs GIT_SSL_CAINFO / http.sslCAInfo for the stand-in; SSH paths need an sshd or GIT_SSH_COMMAND stand-in
test/architecture/hermetic-git-environment.test.ts ──must change──> hermetic HOME, GIT_CONFIG_GLOBAL/NOSYSTEM, no ambient ssh-agent
```

### Dependency Notes

- **The transport rewrite comes first.** Every other row needs system git running under the hardened, non-interactive env.
- **The D-76-01 amendment gates SSH URL forms.** Record it before the source parser changes. It is also the visible fix for issue #325.
- **The probe and fallback depend on two discuss answers:** (a) for plugins, which upstream surface `/claude:plugin install` mirrors (E-SG-04); (b) how D-MF-01's host override interacts with the github.com-only probe.
- **The shallow clone could break history readers.** `resolveTagOid`, `listTags`, `listRemoteTags`, and the version derivation must work on a depth-1 clone, or use `ls-remote` as upstream does (`ls-remote --tags` for `<plugin>--v<version>` tags, upstream `Wpt`).
- **Removing Device Flow touches many modules:** `domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `platform/git-auth-callbacks.ts`, and the `fetch-chokepoint` exemption for `domain/github-auth.ts`. The `fetch-chokepoint` allow-list then shrinks to `platform/hosted-manifest-fetch.ts`.

## MVP Definition

### Launch With (v1 of this milestone)

- [ ] System git transport with the non-interactive env and hardening config. This is the core of the milestone.
- [ ] Shallow clone, `--branch`, the SHA fetch→unshallow→checkout→verify sequence, and recursive shallow submodules for plugins. This is upstream's install shape.
- [ ] Marketplace github probe, ordering, and bidirectional retry, with the upstream messages, plus `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`. Without these, users with no SSH key regress.
- [ ] Accept `git@host:` and `ssh://` addresses (D-76-01 amendment) with upstream's validator. This fixes issue #325.
- [ ] Error classification and wording per E-SG-10, with URL redaction. This is parity plus safety.
- [ ] Git-missing detection message.
- [ ] Marketplace update as `ls-remote` plus re-clone-and-swap, and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`.
- [ ] `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` with the 120 s default.
- [ ] Device Flow decision carried out (removal recommended) and migration of existing clones and keychain entries.

### Add After Validation

- [ ] Plugin `github` probe and fallback on `/claude:plugin install`, if discuss picks the `claude plugin install` surface. It could also ship in v1 if chosen.
- [ ] Upstream's selective marketplace submodule rule (only the submodules that hold plugin files). v1 can fetch every submodule (pre-2.1.295 upstream behavior).
- [ ] Marketplace SHA-ref path (`refs/marketplace-pin/*` with containment check). Upstream gates it behind a flag.
- [ ] Windows-specific SSH-first path for plugins (E-SG-04 step 5).

### Future Consideration

- [ ] Git LFS pointer scan warning after clone.
- [ ] Sparse marketplace checkout (`--sparse`), if not already supported.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| System git transport + hardened env | HIGH | HIGH | P1 |
| SSH URL forms (D-76-01 amendment) | HIGH | MEDIUM | P1 |
| Marketplace probe + bidirectional retry + PREFER_HTTPS | HIGH | MEDIUM | P1 |
| Shallow/branch/SHA/submodule clone shape | HIGH | MEDIUM | P1 |
| Error classification + redaction | HIGH | MEDIUM | P1 |
| Re-clone-and-swap update + KEEP_ON_FAILURE | MEDIUM | MEDIUM | P1 |
| Git-missing message | MEDIUM | LOW | P1 |
| Device Flow removal + migration | MEDIUM | HIGH | P1 (decision) |
| Plugin github fallback on install | HIGH | MEDIUM | P1/P2 (discuss) |
| Selective marketplace submodules | MEDIUM | HIGH | P2 |
| Marketplace SHA-ref pin path | LOW | MEDIUM | P3 |
| Windows SSH-first plugin path | LOW | MEDIUM | P2 |

**Priority key:** P1 must ship in this milestone; P2 should ship when possible; P3 later.

## Competitor Feature Analysis

| Feature | Claude Code 2.1.330 | Pi (`pi install git:...`) | Our Approach |
|---------|---------------------|---------------------------|--------------|
| Git engine | System `git`, hardened | System `git`, `GIT_TERMINAL_PROMPT=0` (PROJECT.md, observed 2026-11-21; not re-verified here) | System `git` with upstream's hardening |
| SSH URL forms | `git@host:`, `ssh://`, `git+ssh://`, `ssh+git://` | `git@host:`, `ssh://` | Accept upstream's set (amend D-76-01) |
| `owner/repo` transport | Probe → SSH or HTTPS, retry the other (marketplace); CLI install only for plugins | n/a | Marketplace: match. Plugin: discuss |
| Auth | Machine credentials only; no token, no OAuth | Machine credentials, no OAuth | Machine credentials only (Device Flow removal recommended) |
| Update | `ls-remote` → re-clone + swap | n/a | Match |
| Prompts | Never (`BatchMode`, no askpass, `credential.interactive=false`) | `GIT_TERMINAL_PROMPT=0` | Match upstream's full set |

## Gaps and open questions for discuss

1. **Plugin fallback surface (E-SG-04).** Mirror `claude plugin install` (probe + fallback) or in-session `/plugin` (SSH only)? No license covers either choice, so the user decides.
2. **D-MF-01 under SSH.** With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, is the SSH URL `git@<override-host>:` and is the probe skipped? Upstream has no override.
3. **D-76-01 amendment scope.** Accept `ssh://`/`git@` only, or also `http://` (upstream accepts it)? D-PL5-04/05/33 currently refuse `http://`.
4. **Device Flow: remove or keep.** Also how to migrate existing keychain entries and clones made with full history.
5. **Unverified:** the explicit-install plugin clone timeout; whether the CLI install's fallback context reaches dependency installs; what sets `directoryPin`; the exact trigger hop from background autoupdate to the bulk refresh loop; which commands carry the `uxt` in-checkout hardening list; whether `marketplace add ssh://…` parses as a `git` source. Each needs a narrower grep in the phase that uses it.
6. **How often git is missing on Windows.** No upstream data. Upstream simply requires git and shows a message.
7. **CHANGELOG history** of the probe and fallback (when HTTPS fallback and the bidirectional retry arrived) was not checked. It matters only if users on older upstream versions report different behavior.

## Sources

- Claude Code binary `/opt/claude-code/bin/claude` 2.1.330 (build 2026-11-20T17:34:37Z, git 8c664bec), grepped 2026-11-22. Primary evidence, HIGH per `.agents/skills/claude-code-compat-research`.
- https://code.claude.com/docs/en/plugins/host-marketplace.md, "Grant access to a private marketplace", "Serve users who have no git-host account", "What background auto-update does with credentials" (fetched 2026-11-22; seam tier LOW, corroborating).
- https://code.claude.com/docs/en/plugin-marketplaces, now "Create a marketplace", "Keep unused submodules out of the clone" (fetched 2026-11-22).
- https://code.claude.com/docs/en/plugins/troubleshooting.md, "SSH authentication failed or HTTPS authentication failed", "SSH host key is not in your known_hosts file", "Command 'git' not found …", "Git clone timed out after 120s", "Marketplace updates keep failing offline", "Invalid git URL" (fetched 2026-11-22).
- https://code.claude.com/docs/en/plugins/cli-reference.md, "plugin marketplace add" source-form table (fetched 2026-11-22).
- Project context: `.planning/PROJECT.md` (Current Milestone system-git; D-21, D-76-01, D-MF-01, D-PL5-04/05/33, D-PL8-12), `extensions/pi-claude-marketplace/domain/source.ts` (current SSH/http rejection), `extensions/pi-claude-marketplace/platform/git.ts` (full-history, no-submodule `isomorphic-git` wrapper).

---
*Feature research for: Claude Code-compatible system-git transport (milestone system-git)*
*Researched: 2026-11-22*
