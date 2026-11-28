# Phase 6: Failure-Message Parity - Research

**Researched:** 2026-11-28
**Domain:** git failure messages (remedy text, git stderr display) and credential redaction across every clone/fetch/`ls-remote` surface
**Confidence:** HIGH for upstream literals, triggers, and Pi code paths (read this session); MEDIUM for the rendering design (a recommendation, not yet built)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Message form (Q4, maintainer 2026-11-28)

- **D-SG-31: keep Pi's notice grammar, and add a remedy sentence.**
  - The row keeps its `{reason}` token (D-PL7-01).
  - The row keeps the typed cause line `git <op> failed: <kind>, exit code N` from `GitCommandError.message` (`shared/errors.ts`).
  - For each failure class that Claude Code gives a remedy, the cause chain adds one remedy sentence. The classes are: timeout, SSH host key changed, SSH host key unknown, SSH auth, HTTPS auth, network, and empty stderr.
  - Pi does NOT adopt upstream's `Failed to clone marketplace repository:` / `Failed to clone repository:` / `Failed to refresh marketplace '<name>':` wrapper sentences in place of its own row grammar. The already-verbatim both-transports-failed wrappers (D-SG-22, OQ-8) stay as they are.
  - A single-attempt `marketplace add` row that fails on a git command now always carries a cause line. Today it shows only `{reason}` (`orchestrators/marketplace/add.ts:1468-1521`, `failedAddRow`/`showsAddCause`).
  - This diverges from upstream's exact text. That is recorded as D-SG-31.
  - **Reversibility:** reversible. These are message strings only. Scenarios pin them, but no stored schema holds them.

- **D-SG-32: git's stderr is shown under Pi's convention for child-process output.** The maintainer chose "do whatever we were doing with pi by convention". The convention is the plugin package-install failure note (`orchestrators/plugin/package-install.ts:393-424`, D-PL9-10). That note shows the tool's own stderr, falling back to stdout, compacted by `compactOutput` and length-bounded by `boundedNote`. Apply the same rule to git failures:
  - every git failure's cause chain ends with git's stderr;
  - the stderr is compacted and bounded the same way;
  - the stderr is redacted first (D-SG-35);
  - an empty stderr shows nothing extra; its class remedy covers it.
  - This also covers the classes that have no remedy sentence (D-SG-34).
  - **Reversibility:** reversible.

#### Wording (Q4, maintainer 2026-11-28)

- **D-SG-33: rephrase every upstream remedy sentence in plain English.** Do not copy Claude Code's text verbatim, including the sentences that do not name Claude Code. Write each sentence with the `simple-english` skill (Plain mode) and the `humanizer` skill.
  - Each sentence must keep upstream's facts and remedy: what failed, and the command or setting that fixes it.
  - Keep every command and setting name exact, for example `ssh-keygen -R <host>`, `ssh -T git@<host>`, `gh auth login`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, and the example value 300000.
  - Never write "Claude Code" where Pi is meant. Upstream's "Claude Code runs this clone with terminal prompts … turned off" becomes a true statement about this extension (D-SG-05).
  - Upstream's `Run with --debug` becomes `PI_CLAUDE_MARKETPLACE_DEBUG=1` (`shared/debug-log.ts`).
  - The plugin remedy's `Then install again.` must fit the verb that shows it (install, update, reinstall), or be neutral.
  - The macOS git-missing text and `Git is required to install marketplaces.` stay as D-SG-07 set them.
  - Each remedy shows its value in seconds, rounded from the millisecond limit (D-SG-13).
  - The `<host>` / `GitHub` / "your git host" choice follows upstream's rules (the scp form for host-key messages; `gitHubAddressOf` and the base override for GitHub).
  - **Reversibility:** reversible.

- **HTTPS auth: one message.** Every HTTPS auth failure gets the same rephrased remedy sentence. That covers a refused stored credential (GAUTH-04), no credential, and a bare 401/403.
  - The remedy names a credential helper: `gh auth login` for GitHub, and a personal access token in a credential helper for another host.
  - Retire the D-1-02 recipe `printf '…' | git credential approve` (`NO_STORED_CREDENTIAL_CAUSE`, `orchestrators/auth-host.ts`) and the GAUTH-04 `<host> rejected the stored credential` cause text from every cause line.
  - Record the amendment of D-1-02 and GAUTH-04 in PROJECT.md.
  - The `rejected` / `no-credential` detail stays internal (D-SG-26 still reads it).
  - The Phase 3 WR-02 classification (a bare 401/403 reads `https-auth` / `no-credential`) stays as is, because it no longer changes any visible text.
  - This follows upstream. Its wording is still rephrased under D-SG-33.

- **D-SG-34: classes with no upstream remedy get git's redacted stderr only.** Upstream shows git's raw stderr for these classes:
  - dubious ownership, git too old, protocol refused, not a repository;
  - ref missing, commit missing;
  - not found, 5xx, TLS, connection refused;
  - `aborted`, `refused-input`, `pin-mismatch`, `failed`.

  Pi shows the row grammar and the typed cause line, then git's redacted, compacted stderr (D-SG-32). Pi writes no remedy of its own for these classes. The roadmap expected a dubious-ownership message, but upstream has none on this surface, so none is added.

#### Consistency

- Each reason and remedy comes from the typed failure kind (`platform/git-failure-kind.ts`, `shared/git-failure-classifiers.ts`). So the command's own notice, the `apply` and `import` cascades, and the background autoupdate pass show the same reason and remedy for the same failure (success criterion 2).

#### Redaction (SG-ERR-02)

- **D-SG-35: one redaction pass for every shown stderr and every debug line.**
  - The order follows upstream's `rRe`. First, replace each credential-bearing spelling of the request URL. Then run `redactCredentials`. Then run `redactAbsolutePaths`.
  - Widen `redactCredentials` (`shared/redact-credentials.ts`) to cover:
    - URL query and fragment tokens (`?private_token=`, `#…`);
    - GitLab `glpat-` tokens;
    - `Authorization: Basic` values;
    - percent-encoded userinfo;
    - the other provider token shapes upstream's `Gg` table lists, where they have a fixed prefix.
  - `hookDebugLog` (`shared/debug-log.ts`) redacts every line centrally. Fix the raw `subject` / `plan.first.url` / `run.subject` lines in `orchestrators/marketplace/clone-swap.ts` and `orchestrators/github-transport.ts`.
  - `GitCommandError.message` keeps stderr out. The stderr is redacted when the error is built and again when the cause chain is serialized.
  - git's output still never reaches stdout or stderr directly (`platform/process-run.ts` pipes it).

### Claude's Discretion

- Where the kind-to-remedy mapping lives: `shared/git-failure-classifiers.ts`, or a sibling module that reason resolution already reads.
- How a multi-line cause renders in the `cause:` line and the JSON wire. Strings change and the schema stays the same.
- Trigger precedence: Pi keeps its own anchored kinds and applies upstream's remedy per kind.
- Test layout: one cucumber scenario per class that gets a remedy, across `marketplace add`, `marketplace update`, and plugin install; one scenario for the stderr-only classes; and cascade checks for `apply`, `import`, and autoupdate. Also add a scenario that shows a credential in a URL and in stderr is redacted in the notice, in JSON mode, and in the debug log.
- Updates to `docs/messaging-style-guide.md`, the README wording, and a CHANGELOG line.

### Deferred Ideas (OUT OF SCOPE)

None. The discussion stayed within the phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SG-ERR-01 | Clone and fetch failures report Claude Code's message for each failure class, adapted only where Pi has no equivalent, with the exact set chosen per discuss (Q4). | Upstream evidence record (exact 2.1.332 literals and triggers, §Upstream evidence); draft wording table (§Draft remedy wording); the one rendering seam (`serializeCauseChain` plus `redactCauseChain`) and the per-surface sites that drop or flatten a cause today (§Surface map); scenario plan (§Validation Architecture). |
| SG-ERR-02 | No message, notice, or debug log shows a credential; git's own output never reaches stdout or stderr directly (IL-2). | Redaction gaps proven by a local probe (§Redaction design); widened pattern list from upstream's token table; central `hookDebugLog` pass; the `#ref` and query pitfalls; print-mode "prints nothing" step proves the IL-2 clause (§Validation Architecture). |
</phase_requirements>

## Project Constraints (from AGENTS.md)

There is no CLAUDE.md. AGENTS.md is the project instruction file. Directives that bind this phase:

- **Upstream parity is the default.** Divergence needs a recorded decision ID or a Pi capability gap. D-SG-31..35 are the recorded licenses here. Any new divergence found during planning (for example the plugin-surface remedies, see Open Question 2) is a question for the user.
- **Behavioral tests:** a `/claude:plugin` change that a user can see ships a cucumber scenario under `features/` that fails without the change. Unit tests and direct coverage do not replace it.
- **Quality bar (NFR-6):** `npm run check` stays green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, two cycle runs, health with cognitive 15 / cyclomatic 20, dupes, rule pack), Prettier, source/test pairing, unit, integration, cucumber (both profiles), and 100% direct coverage for every source-test pair.
- **Output channel (IL-2):** all output through `notify()` (`shared/notification-dispatch.ts`); no `process.stdout`/`process.stderr` writes; the only console calls are `console.warn` in `persistence/migrate.ts` and `console.error` in `shared/debug-log.ts`.
- **English only (IL-1), no telemetry (IL-4).** Upstream's telemetry buckets (`A_e`) stay out.
- **Atomic writes (NFR-1), containment (NFR-10), network policy (NFR-5):** this phase writes no new file and adds no network call.
- **Git:** never commit to `main`; never `--no-verify`; never rebase. Branch here is `features/system-git`.
- **GSD records:** every plan `SUMMARY.md` has a `## Threat Flags` section.
- **Build verification:** a GSD gate runs `npm run check` on the combined tree; the commit hook runs `npm run check:commit`.
- **Docs:** README edits follow the `readme` skill (README.md and README.es.md stay in sync); CHANGELOG follows the `changelog` skill; PR text uses `simple-english` (Plain) and `humanizer`.
- **Comments and test titles** cite durable IDs (D-SG-31, SG-ERR-01), not phase or plan numbers (`typescript-style`).

## Summary

The phase is mostly a rendering and redaction change in `shared/`, with a short list of per-surface sites that drop or flatten a git failure's cause today. The typed failure kind already exists on every `GitCommandError` (`platform/git-failure-kind.ts`), and every notice, JSON payload, background-pass debug line, and outcome note reads its cause through one serializer, `serializeCauseChain` (`shared/errors.ts:181-194`). So if the serializer renders a `GitCommandError` link as three entries (the typed line, the remedy, and git's compacted output), every surface that keeps the error in its chain shows the same remedy and output (success criterion 2). Two things break that "one change" today, and the plan must fix them explicitly:

1. **`redactCauseChain` rebuilds every link as a plain `Error`** (`shared/redact-absolute-paths.ts`), and about 15 call sites (apply, import, install cascade, update, fetch, prune, dependency moves) pass their chain through it. A plain `Error` carries no kind, so the remedy and the output would vanish on exactly the cascade surfaces success criterion 2 names. `redactCauseChain` must rebuild a `GitCommandError` link as a `GitCommandError` (it already does this for `ManualRecoveryError`).
2. **Five sites drop or flatten the cause for this failure**: `marketplace add` (`showsAddCause`), plugin install (`keepsRuntimeCause`, bare auth row), update preflight (`candidateFailure`, bare auth row), import (`unexpectedFailureRow` IMP-09 bare auth row, and `pushUnexpectedFailure`, which keeps only `errorMessage(error)` as the head), and the install cascade / D-MF-04 add (`memberCause`, `composeCascadeFailureMessage`, `recordAsInstallFailure`), which rebuild the head from `err.message`. Every auth class (HTTPS auth, SSH auth, both host-key classes) maps to `{authentication required}`, so the amended-D-79-03 "bare auth row" rule hides exactly the remedies this phase adds. The D-79-03 row in PROJECT.md must be amended again.

Upstream's redaction for git stderr (`rRe`) is URL-only: it replaces every credential-bearing spelling of the clone URL and then runs `Gg`, which redacts URL tokens (userinfo, query, fragment) in the text. The provider token table (AWS, GitLab, npm, Slack, ...) belongs to a separate secret scanner that `rRe` does not call. So D-SG-35's widening is stricter than upstream; that is allowed, and the table gives the exact fixed-prefix patterns. A local probe confirmed that git 2.43 strips URL userinfo from its `unable to access` line but prints a URL query token in full, and that the current `redactCredentials` misses query tokens, `glpat-`, `Authorization: Basic`, `%40`-separated userinfo, and other provider tokens. One trap: Pi uses `#<ref>` in url sources (`tools.git#stable`), so a fragment rule must only touch `name=value` pairs.

**Primary recommendation:** Store the remedy facts on `GitCommandError` when it is built (a credential-redacted remote URL from `runRemote`, and a stderr that has gone through URL spellings, then `redactCredentials`, then `redactAbsolutePaths`). Word the remedy in a new leaf module `shared/git-failure-remedy.ts` that imports nothing. Expand a `GitCommandError` link into `[typed line, remedy?, "git printed: <output>"?]` inside `serializeCauseChain`, preserve the class in `redactCauseChain`, make `StoredCredentialRejectedError` a `GitCommandError` subclass with no cause link, delete the D-1-02 machinery, and remove the five drop/flatten sites. Then pin each class with a cucumber scenario.

## Architectural Responsibility Map

The tiers here are this extension's layers, not web tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classify a git failure (kind, detail) | `platform/git-failure-kind.ts` | — | Already done (SG-PRC-05). No change except possibly none. |
| Attach remedy facts (remote URL, redacted stderr) | `platform/git-process.ts` (`settleRun`) and `platform/git.ts` (`runRemote`) | — | Only the network request path knows the URL; the process module holds raw stderr. |
| Word the remedy | new leaf `shared/git-failure-remedy.ts` | `shared/errors.ts` (caller) | Wording is user-facing text, like `gitCommandMessage`. A leaf module avoids an import cycle (see Pitfall 1). |
| Compact and bound git output | new leaf `shared/child-output.ts` (moved from `package-install.ts`) | `orchestrators/plugin/package-install.ts` (second consumer) | D-SG-32 copies the convention; one implementation avoids a fallow clone group. |
| Render the chain (text and JSON) | `shared/errors.ts` `serializeCauseChain` | `shared/redact-absolute-paths.ts` `redactCauseChain` | One serializer feeds TUI, print, JSON, RPC, notes, and the background debug lines. |
| Reason token | `shared/git-failure-classifiers.ts` | — | Unchanged (D-PL7-01). |
| Keep the cause on each surface's row | `orchestrators/**` row builders | — | Five sites drop or flatten the cause (§Surface map). |
| Redact credentials | `shared/redact-credentials.ts` | `shared/debug-log.ts` (central pass) | Leaf module, already used by every presenter. |
| Debug log redaction | `shared/debug-log.ts` | 267 call sites, unchanged | Central pass per D-SG-35. |

## Standard Stack

No new dependency. Everything the phase needs is already in the tree or in Node.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:util` `stripVTControlCharacters` | Node 24 (runtime v24.22.3 here) | Strip ANSI escape sequences from git output before display | Already used by `compactOutput` (`package-install.ts:53`). [VERIFIED: grep of package-install.ts import] |
| `shared/redact-credentials.ts` | in-repo | Credential redaction leaf | Already applied by `serializeCauseChain`, presenters, MCP tools. [VERIFIED: Read redact-credentials.ts:34-46] |
| `shared/redact-absolute-paths.ts` | in-repo | Path-to-basename redaction | Already used for cause chains on cascade surfaces. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Expanding a `GitCommandError` link into separate entries | One multi-line entry (`typed\nremedy\ngit printed: …`) | Survives `redactCauseChain` without a class change, but the TUI `cause: a -> b` line then breaks across lines with no indent, and the JSON entry mixes three facts. Precedent exists (the plugin both-failed message holds `\n`). Recommend separate entries. |
| Rendering in `linkMessage` / `serializeCauseChain` | Putting remedy and stderr in `GitCommandError.message` | Forbidden by D-SG-35 ("`GitCommandError.message` keeps stderr out") and would change the typed line D-SG-31 keeps. |
| New leaf remedy module | Remedy table inside `shared/git-failure-classifiers.ts` | The classifier imports `errors.ts` and `github-base-url.ts`; `errors.ts` cannot import it back without a cycle. |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Upstream evidence record (Claude Code 2.1.332)

Question: what does Claude Code show for each clone/fetch failure class, and how does it redact? Evidence: `/opt/claude-code/bin/claude`, `VERSION:"2.1.332"`, grepped (never run) on 2026-11-28 with a byte-offset reader. Marketplace classifier source at offset 344772949 (`bqo`); plugin clone `GHi` at 345023519; `SVo`/`kVo`/`zHi` at 345025692-345026728; `rRe`/`jh`/`mn` at 328971355-328971945; `Gg` at 328977792; the token table `Q` at about 328954000. Confidence HIGH: code read directly. [VERIFIED: binary grep 2.1.332]

### Marketplace clone (`bqo`), first match wins

The caller throws `Failed to clone marketplace repository: ${stderr}` (and `marketplace update` re-clones through the same function, so it shows the same class messages). Each class message ends with `\n\nOriginal error: ${stderr}`, where `stderr` already went through `rRe(stderr, url)`.

| Order | Trigger (exact) | Message (exact, before `Original error:`) |
|---|---|---|
| 1 | `Ze.error?.includes("timed out")` (the spawn layer's error, that is, the process was killed at the limit) | `Git clone timed out after ${Math.round(Se/1000)}s. The repository may be too large for the current timeout. Set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to increase it (e.g., 300000 for 5 minutes).` where `Se = Sgo()` is the configured limit |
| 2 | stderr includes `REMOTE HOST IDENTIFICATION HAS CHANGED` | `SSH host key has changed (server key rotation or possible MITM). Remove the stale known_hosts entry:\n  ${nt}\nThen connect once manually to verify and accept the new key.` with `nt = Ye ? \`ssh-keygen -R ${Ye}\` : "ssh-keygen -R <host>"` |
| 3 | stderr includes `Host key verification failed` | `SSH host key is not in your known_hosts file. To add it, connect once manually (this will show the fingerprint for you to verify):\n  ${nt}\n\nOr use an HTTPS URL instead (recommended for public repos).` with `nt = Ye ? \`ssh -T git@${Ye}\` : "ssh -T git@<host>"` |
| 4 | stderr includes `Permission denied (publickey)` or `Could not read from remote repository` | `SSH authentication failed. Please ensure your SSH keys are configured for ${zNi(e)}, or use an HTTPS URL instead.` |
| 5 | `qNi(stderr)`: includes `Authentication failed`, `could not read Username`, `unable to get password from user`, `terminal prompts disabled`, or `/40[13]/` after `P4i` removes 40/64-hex ids | `HTTPS authentication failed. Please ensure ${KNi(e)}. Claude Code runs this clone with terminal prompts and askpass programs turned off and tells credential helpers not to prompt, so git needs a credential it can get without asking you, such as one a credential helper already holds.` |
| 6 | stderr includes `timed out`, `timeout`, or `Could not resolve host` | `Network error or timeout while cloning repository. Please check your internet connection and try again.` |
| 7 | stderr empty | `Ze.error \|\| \`git clone exited with code ${Ze.code} (no stderr output). Run with --debug to see the full command.\`` (no `Original error:` suffix) |
| 8 | anything else | the redacted stderr alone |

Helpers (exact):

- `IGo(e)`: `if(e.includes("://"))return null;return e.match(/^[^:]*@([^@:]+):/)?.[1]??null` — the host only for the scp form (`git@github.com:acme/tools.git` gives `github.com`); any `://` URL gives the literal `<host>`.
- `zNi(e)`: host from `k3n({source:"git",url:e})`; `null` gives `"your git host"`; `Bo(n)` (GitHub) gives `"GitHub"`; else the host name.
- `KNi(e)`: GitHub gives `"your credential helper is configured (e.g., gh auth login)"`; else `` `your git credential helper has valid credentials for ${n??"this host"} (e.g., a personal access token)` ``.
- The `Bo` body in that chunk was not traced (minified names collide across chunks). MEDIUM: it reads as "the host is GitHub". Pi's equivalent is `gitHubAddressOf` (D-SG-23 `Ort` fold).

The both-attempts wrapper (`wqo`, exact): `Fetching the marketplace from GitHub failed on both attempts. ${e.transport} (${e.url}): ${e.error.message}\n\n${n.transport} (${n.url}): ${n.error.message}`, only when the two messages differ; it mutates and returns the second error. Each `error.message` there is a full class message with its `Original error:`.

### Plugin clone (`GHi`), no class messages

- Clone: `` `Failed to clone repository: ${SVo(Se,k)}${rRe(Se.stderr,e)}` `` with `SVo(e,n)` = `` e.timedOut&&n!==void 0?`timed out after ${Math.round(n/1000)}s (CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS sets the limit). `:"" ``.
- Fetch by SHA: `` `Failed to fetch commit ${g}: ${rRe(Ke.stderr,e)}` ``; checkout: `` `Failed to checkout commit ${g}: ${rRe(ze.stderr,e)}` ``.
- `kVo` sorts the failure into classes only for internal fallback behavior; no user wording.
- Both attempts (`zHi`, exact): `` `${d(H)}\nThe retry over SSH failed too: ${d(z)}\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.` `` Pi's `GitHubTransportsFailedError` plugin text is byte-identical except that Pi names the retry's transport from its own label table. [VERIFIED: Read errors.ts plugin branch earlier this session via sed; text matches]

So upstream's plugin surface has the timeout prefix and the raw stderr, and no remedy for SSH auth, HTTPS auth, host keys, or network. D-SG-31 adds those remedies on the plugin surface too (CONTEXT test layout names "plugin install" for each class). That goes beyond upstream; see Open Question 2.

### Upstream redaction (`rRe`), exact

```js
function rRe(e,t){let n=typeof t==="string"||t===void 0?[t]:t;for(let s of n){let r=mn(s),i=s&&r.length>0?jh(s):"";for(let o of r)e=i3e(e,o,i)}return Gg(e)}
function mn(e){if(!e||!At.test(e)||jh(e)===e)return[];let t=[e],n=_e(e),s=e.slice(n),r=s.indexOf("/");for(let i of new Set([s.indexOf("@"),Te(s)]))if(n!==0&&i!==-1&&(r===-1||i<r))t.push(e.slice(0,n)+s.slice(i+1));return t}
function Gg(e){if(!e)return e;return e.replace(Cn,(t)=>jh(t)).replace(In,(t,n,s)=>{let r=Dn(s);return r===-1?n+s:n+s.slice(0,r)+jh(s.slice(r))})}
var Cn=/[a-z][a-z0-9+.-]{0,31}:\/\/[^\s'"`<>]+/gi
var In=/(^|[\s'"`<>])([^\s'"`<>]*(?:@|%40)[^\s'"`<>]*)/gi
var Ix="[redacted URL]"
```

- `mn(url)` returns `[]` when the URL holds no secret (`jh(url)===url`). Otherwise it returns the URL and the spellings with the user part, or the text up to the password separator, removed. Each spelling is replaced with the redacted form `jh(url)`.
- `jh` strips userinfo, query (`search`), and fragment (`hash`), or returns `[redacted URL]` when it cannot make a safe form.
- `Gg` runs that URL redaction on every `scheme://` token and every token holding `@` or `%40`.
- **Correction to 06-UPSTREAM-ANALYSIS.md §2 item 3:** `Gg` is URL-only. The table `Ln` (`aws:"AWS", gitlab:"GitLab", …`) only builds display labels for a separate secret scanner (`redactTokens`/`redactContext`, rule list `Q` with `confidence:"high"` provider rules). `rRe` does not call that scanner. So for git stderr, upstream redacts URL credentials only, and the provider-token widening in D-SG-35 is stricter than upstream. [VERIFIED: binary grep 2.1.332]

Fixed-prefix provider rules from that table (`confidence:"high"`, exact sources), the candidate list for D-SG-35:

| id | source |
|---|---|
| aws-access-token | `\b((?:A3T[A-Z0-9]\|AKIA\|ASIA\|ABIA\|ACCA)[A-Z2-7]{16})\b` |
| gcp-api-key | `\b(AIza[\w-]{35})(?![\w-])` |
| google-oauth-client-secret | `\bGOCSPX-[\w-]{28}(?![\w-])` |
| digitalocean-pat / access-token | `\b(dop_v1_[a-f0-9]{64})…`, `\b(doo_v1_[a-f0-9]{64})…` |
| anthropic-api-key / admin / oauth | `sk[-]ant[-]api03-[a-zA-Z0-9_\-]{93}AA`, `sk-ant-admin01-[a-zA-Z0-9_\-]{93}AA`, `sk-ant-(?:oat\|ort)\d{2}-[\w-]{20,}` |
| openai-api-key | `sk-[A-Za-z0-9_-]{8,200}T3BlbkFJ[A-Za-z0-9_-]{8,200}` |
| huggingface-access-token | `\b(hf_[a-zA-Z]{34})…` |
| supabase | `\bsb_secret_[A-Za-z0-9_-]{20,}`, `\bsbp_[a-z0-9]{40,}` |
| github-pat / app / oauth / refresh | `ghp_[0-9a-zA-Z]{36}`, `(?:ghu\|ghs)_[0-9a-zA-Z]{36}`, `gho_[0-9a-zA-Z]{36}`, `ghr_[0-9a-zA-Z]{36}`; fine-grained `github_pat_\w{82}` |
| gitlab family | `glpat-`, `gldt-`, `glrt-`, `gloas-`, `glptt-`, `glagent-`, `glimt-`, `glsoat-`, `glcbt-`, `glft-`, `glffct-`, each followed by `[\w=-]{20,}(?:\.[0-9a-z]{9})?` |
| slack | `xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*`, `xox[a-z](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}`, `xoxe(?:\.xox[a-z])?-[0-9]-[A-Za-z0-9-]{28,}`, `xapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+` (i), `\bxwfp-[a-zA-Z0-9-]{20,}` |
| npm-access-token | `\b(npm_[a-zA-Z0-9]{36})…` |
| pypi-upload-token | `pypi-AgEIcHlwaS5vcmc[\w-]{50,1000}` |
| sendgrid | `\b(SG\.[a-zA-Z0-9=_\-.]{66})…` |
| databricks / pulumi / postman | `\b(dapi[a-f0-9]{32}(?:-\d)?)…`, `\b(pul-[a-f0-9]{40})…`, `\b(PMAK-[a-fA-F0-9]{24}-[a-fA-F0-9]{34})…` |
| hashicorp-tf | `[a-zA-Z0-9]{14}\.atlasv1\.[a-zA-Z0-9\-_=]{60,70}` |
| grafana | `\b(glc_[A-Za-z0-9+/]{32,400}={0,3})…`, `\b(glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})…` |
| sentry / stripe / shopify | `\b(sntryu_[a-f0-9]{64})…`, `\b((?:sk\|rk)_(?:test\|live\|prod)_[a-zA-Z0-9]{10,99})…`, `shpat_[a-fA-F0-9]{32}`, `shpss_[a-fA-F0-9]{32}` |
| http-auth-scheme (low confidence) | `\b(?:Bearer\|Basic)[\s]+([A-Za-z0-9+/=._~-]{20,})` (`ge="Bearer\|Basic"`) |

(`…` stands for upstream's trailing boundary `(?:[\x60'"\s;]|\\[nr]|$)`.)

## Pi today (read this session)

- `GitCommandError` (`shared/errors.ts:1349-1370`): fields `failure`, `kind`, `operation`, `exitCode`, `stderr`; `this.stderr = redactCredentials(details.stderr ?? "")`. No URL field. [VERIFIED: Read errors.ts:1349-1370]
- `gitCommandMessage` (`shared/errors.ts:1376-1394`), verbatim: `"git is not installed on this Mac. To install it, run xcode-select --install, then try again."`, `"Git is required to install marketplaces."`, `` `git ${operation} timed out after ${failure.timeoutMs} ms` ``, `` `git ${operation} failed: ${failure.kind}` ``, `` `git ${operation} failed: ${failure.kind}, exit code ${exitCode}` ``. [VERIFIED: Read errors.ts:1376-1394]
- `serializeCauseChain` (`shared/errors.ts:181-194`): `causeChain: links.map((link) => redactCredentials(linkMessage(link)))`, `truncated: hasOnwardCause(links.at(-1))`; `formatCauseChain` (`:201-204`) renders `` `cause: ${chain.causeChain.join(" -> ")}${suffix}` `` with `suffix = chain.truncated ? " (truncated)" : ""`. [VERIFIED: Read errors.ts:181-204]
- JSON wire: `wireCause` returns `{ causeChain: [...cause.causeChain], truncated: cause.truncated }` (`shared/notification-json.ts:783-785`); the text strategy and JSON both read `resolveFailure`'s `serializeCauseChain(cause)` (`shared/notification-resolve.ts:595-614`). [CITED: sed read of both files this session]
- `redactCredentials` (`shared/redact-credentials.ts:34-46`), verbatim patterns: `userinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]+@/gi`, `accessToken = /\b(x-access-token:)[^\s@/]+/gi`, `bearer = /\b(Bearer[ \t]+)([\w.~+/-]*\w=*)/gi`, `githubToken = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}/g`. [VERIFIED: Read redact-credentials.ts:34-46]
- `hookDebugLog` (`shared/debug-log.ts:22-26`): `if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") { console.error(\`[${tag}] ${detail}\`); }`, no redaction. 267 call sites outside the module. [VERIFIED: Read debug-log.ts:22-26; count by grep]
- `NO_STORED_CREDENTIAL_CAUSE` (`orchestrators/auth-host.ts:91-92`): `` String.raw`no credential was obtained for ${host}; store one with: printf 'protocol=https\nhost=${host}\nusername=<user>\npassword=<token>\n\n' | git credential approve` ``. [VERIFIED: Read auth-host.ts:91-92]
- `StoredCredentialRejectedError` message: `` `${host} rejected the stored credential` ``, thrown by `runWithAuthBundle` in `platform/git.ts:353-370` with the `GitCommandError` as its cause. [CITED: sed read of errors.ts:579-590 and git.ts:330-370]
- Convention to copy (`orchestrators/plugin/package-install.ts`): `NOTE_LIMIT = 500` (`:140`); `boundedNote(note)` = `note.slice(0, NOTE_LIMIT).replace(/[\uD800-\uDBFF]$/u, "")` (`:247-249`); `compactOutput(output)` strips VT control sequences, splits on `[\r\n]+`, replaces `\p{Cc}` with a space, trims, drops empty lines, drops npm warn lines when other lines exist, strips npm prefixes, and joins with `"; "` (`:407-416`). [VERIFIED: Read package-install.ts:136-142; CITED: sed read of :247-249 and :405-425]
- git stderr capture: `const STDERR_CAPTURE: OutputCapture = { limit: 65_536, keep: "tail" };` with the comment "A failure reason is the last line of stderr" (`platform/git-process.ts:683-687`). [VERIFIED: Read git-process.ts:683-687]
- `GITHUB_HOST = "github.com"` (`shared/github-base-url.ts:41`). [VERIFIED: Read github-base-url.ts:41]
- Local probe (git 2.43.0, loopback port 1, no remote host):

```
$ git ls-remote 'https://user:s3cr3tTOKEN@127.0.0.1:1/x.git?private_token=glpat-abcdefghijklmnopqrstuv'
fatal: unable to access 'https://127.0.0.1:1/x.git?private_token=glpat-abcdefghijklmnopqrstuv/': Failed to connect to 127.0.0.1 port 1 after 0 ms: Couldn't connect to server
$ git clone --depth 1 'https://user:s3cr3t@127.0.0.1:1/x.git' /nonexistent-xx
Cloning into '/nonexistent-xx'...
fatal: unable to access 'https://127.0.0.1:1/x.git/': Failed to connect to 127.0.0.1 port 1 after 0 ms: Couldn't connect to server
```

  git drops userinfo here, prints the query token in full, and prints an absolute path (`Cloning into '…'`). [VERIFIED: local probe output above]
- Current `redactCredentials` then `redactAbsolutePaths` on probe strings (node, this session): the query token, `glpat-…` in a `remote:` line, `Authorization: Basic dXNlcjpwYXNz`, `https://user:tok%40host.example/x.git`, `npm_…`, `AKIA…`, and `#access_token=abc123` all pass through unchanged; `https://user%40corp:p%40ss@host/x.git` becomes `https://***@host/x.git`; `Cloning into '/home/user/tmp/x'...` becomes `Cloning into 'x'...`. [VERIFIED: node probe this session]

## Architecture Patterns

### System Architecture Diagram

```
 git process (platform/process-run.ts, stdio piped; never reaches Pi's stdout/stderr)
        │ raw stderr (tail 64 KiB), exit code, timedOut
        ▼
 platform/git-process.ts settleRun ── classifyGitExit(code, stderr) ──► GitFailure {kind, detail}
        │  stderr' = redactAbsolutePaths(redactCredentials(redactUrlSpellings(stderr, request.remote)))
        ▼
 new GitCommandError(failure, {operation, exitCode, stderr', remote: redactCredentials(url)})
        │
        ▼
 platform/git.ts runRemote ──► runWithAuthBundle (rejected → StoredCredentialRejectedError, a GitCommandError subclass)
        │                     └► withFetchedUrlCause (GHB-01 cause link, unchanged)
        ▼
 orchestrators (clone-cache, clone-swap, github-transport, add, update, install, apply, import, background pass)
        │  reason = classifyGitFailure(...)  (unchanged, D-PL7-01)
        │  row.cause = the error (MUST be kept; five sites drop or flatten it today)
        │  optional redactCauseChain(cause)  (MUST preserve GitCommandError)
        ▼
 shared/errors.ts serializeCauseChain
        │  for a GitCommandError link: [typed line, gitFailureRemedy(link)?, "git printed: " + bounded(compact(stderr))?]
        │  every entry: redactCredentials (second pass)
        ▼
 ┌───────────────────────┬────────────────────────────┬──────────────────────────────┐
 │ text strategy (tui,   │ JSON/RPC strategy           │ background pass SILENT_CONTEXT │
 │ print): formatCause-  │ wireCause {causeChain[],    │ → hookDebugLog → central       │
 │ Chain "cause: a -> b" │ truncated}                  │ redaction → console.error      │
 └───────────────────────┴────────────────────────────┴──────────────────────────────┘
```

### Recommended module layout

```
extensions/pi-claude-marketplace/
├── shared/
│   ├── git-failure-remedy.ts     # NEW leaf, no imports: kind + facts -> remedy sentence or undefined
│   ├── child-output.ts           # NEW leaf: compactOutput + boundedNote, moved from package-install.ts
│   ├── redact-credentials.ts     # widened patterns + redactUrlSpellings(text, url)
│   ├── debug-log.ts              # central redaction pass
│   ├── errors.ts                 # GitCommandError gains `remote`; serializeCauseChain expands git links
│   └── redact-absolute-paths.ts  # redactCauseChain preserves GitCommandError
├── platform/
│   ├── git-process.ts            # GitRequest gains `remote`; settleRun applies the D-SG-35 order
│   └── git.ts                    # runRemote sets `remote`; StoredCredentialRejectedError built from the failure
└── orchestrators/...             # remove D-1-02 attach, the bare-auth-row rule, and head flattening
test/shared/git-failure-remedy.test.ts, test/shared/child-output.test.ts   # NEW pairs (100% direct coverage)
```

### Pattern 1: facts on the error, words in a leaf

**What:** `GitCommandError` carries facts only (kind, detail, operation, exit code, timeout, redacted stderr, redacted remote URL). A leaf module turns facts into a sentence. `serializeCauseChain` calls the leaf.
**When to use:** every remedy. The leaf must import nothing from `shared/`, because `errors.ts` imports it and `github-base-url.ts` and `redact-absolute-paths.ts` both import `errors.ts` (Pitfall 1).
**GitHub detection without importing `github-base-url.ts`:** compute it in `runRemote` (platform, which already imports `gitHubAddressOf`/`gitHubWireUrl`) and store a fact, for example `remote: { url, gitHub: boolean }`, or store only the URL and let the leaf compare the parsed host with a `github.com` value passed in. The ESLint rule `local/no-github-literal` (eslint.config.js:142) bans a `github.com` literal outside `shared/github-base-url.ts`, so the leaf must not spell it.

```typescript
// Sketch only (names are proposals). shared/git-failure-remedy.ts — a leaf module.
export interface GitRemedyFacts {
  readonly kind: string;               // GitFailure["kind"], structurally
  readonly operation: string;          // "clone --depth", "ls-remote --tags", ...
  readonly exitCode: number | null;
  readonly timeoutMs?: number;         // timeout kind only
  readonly ownStderr: string;          // stderr without `remote:` lines (WR-01)
  readonly remote?: { readonly url: string; readonly gitHub: boolean };
}
export function gitFailureRemedy(facts: GitRemedyFacts): string | undefined {
  switch (facts.kind) {
    case "timeout": return timeoutRemedy(facts.timeoutMs);
    case "ssh-host-key-changed": return hostKeyChangedRemedy(scpHost(facts.remote?.url));
    case "ssh-host-key-unknown": return hostKeyUnknownRemedy(scpHost(facts.remote?.url));
    case "ssh-auth": return sshAuthRemedy(hostLabel(facts.remote));
    case "https-auth": return httpsAuthRemedy(facts.remote);
    case "network": return NETWORK_TEXT.test(facts.ownStderr) ? NETWORK_REMEDY : undefined;
    case "no-stderr": return noStderrRemedy(facts.exitCode);
    default: return undefined;           // D-SG-34: stderr only
  }
}
// upstream IGo: the host only for the scp form; a `://` URL gives the literal "<host>".
const SCP_HOST = /^[^:]*@([^@:]+):/;
```

`satisfies Record<…>` over the closed kind set (as `GIT_FAILURE_ANSWERS` does) makes a new kind a compile error; with a leaf that cannot import the type, a `switch` plus a test that enumerates every kind does the same job.

### Pattern 2: expand, do not add links

`serializeCauseChain` maps each walked link to one or more entries. A `GitCommandError` link yields up to three entries; every other link yields one. The walk and `truncated` stay as they are, so the depth bound (`CAUSE_CHAIN_MAX_DEPTH = 5`) does not shrink. Adding real `Error` links instead would push chains such as `Failed to update… -> GitCommandError -> remedy -> output -> fetched <url>` past 5 and mark them `(truncated)`.

```typescript
// Sketch. In shared/errors.ts
function linkEntries(link: unknown): readonly string[] {
  if (!(link instanceof GitCommandError)) return [linkMessage(link)];
  const remedy = gitFailureRemedy(link.remedyFacts());
  const output = gitOutputNote(link.stderr);          // compact + bound, "" when empty
  return [link.message, ...(remedy ? [remedy] : []), ...(output ? [`git printed: ${output}`] : [])];
}
// causeChain: links.flatMap(linkEntries).map(redactCredentials)
```

Rendered example (marketplace add, SSH key refused, GitHub, wording from the draft table):

```
⊘ acme/tools [user] (failed) {authentication required}
    cause: git clone --depth failed: ssh-auth, exit code 128 -> SSH authentication with GitHub failed. Make sure that your SSH keys are set up for GitHub, or use an HTTPS URL. -> git printed: git@github.com: Permission denied (publickey).; fatal: Could not read from remote repository.; Please make sure you have the correct access rights; and the repository exists.
```

### Pattern 3: one owner for the HTTPS auth text

`StoredCredentialRejectedError` becomes `class StoredCredentialRejectedError extends GitCommandError`, built from the refused `GitCommandError` (same failure, operation, exit code, stderr, remote) plus `host`, with no `cause` link. Its message is the typed line, so no visible text changes between "rejected" and "no credential" (one HTTPS message, as decided), while `clone-swap.ts` (`refreshFailure`, D-SG-26 "a refused stored credential still wins") and the classifier keep their `instanceof` checks. Note the rung order in `classifyGitFailure`: the `GitCommandError` rung now catches it first; it gives the same reason (`https-auth` -> `authentication required`), so the later rung becomes dead and fallow/coverage will flag it. Remove it.

### Anti-Patterns to Avoid

- **Remedy keyed on stderr text across the whole stderr.** Pi's kinds read git's own lines with `remote:` lines removed (WR-01) so a server cannot choose the class. The network remedy needs a text sub-check (upstream fires only on `timed out`/`timeout`/`Could not resolve host`); run it on the same `remote:`-free text.
- **Path pass in `serializeCauseChain` for every link.** Many causes must keep their absolute path (MA-6 stale clone hint, manual-recovery leaks). Apply `redactAbsolutePaths` to the git stderr only (at build time) and, per D-SG-35, to debug lines.
- **Copying `compactOutput`.** fallow dupes fails on every clone group. Move it.
- **Wording that says "cloning" on a fetch or `ls-remote`.** A marketplace refresh reports the freshness `ls-remote` (D-SG-26). Keep remedies verb-neutral.

## Draft remedy wording (for the planner to lock)

Written in Plain mode (`simple-english`) and passed through `humanizer`: short sentences, active voice, condition before command, "make sure that", no "should/may/might/could", no semicolons or dashes, no contractions, commands kept exact and unquoted inline (matching the existing `run xcode-select --install` style). Placeholders: `{host}`, `{label}` = `GitHub` / the host name / `your git host`, `{N}` seconds.

| Class (Pi kind) | Upstream fact preserved | Draft sentence(s) |
|---|---|---|
| timeout | killed at the limit; the repo may be too large; `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`; example 300000 = 5 min; seconds = `Math.round(ms/1000)` | `The extension stopped git after {N} seconds, the time limit for one git command. A large repository can need more time. To raise the limit, set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to a number of milliseconds, for example 300000 for 5 minutes.` (use `1 second` when N is 1) |
| ssh-host-key-changed | key rotation or possible MITM; remove the stale `known_hosts` entry with `ssh-keygen -R {host}`; then connect once by hand to check and accept | `The SSH host key of {host} does not match the key in your known_hosts file. Either the server has a new key, or another computer is acting as the server. To remove the old key, run ssh-keygen -R {host}. Then connect once by hand to check the new key and accept it.` For a `://` URL: `The SSH host key of the server …` and `ssh-keygen -R <host>` (upstream's literal) |
| ssh-host-key-unknown | not in `known_hosts`; connect once by hand with `ssh -T git@{host}`, which shows the fingerprint to check; or use HTTPS, better for public repos | `The SSH host key of {host} is not in your known_hosts file. To add it, run ssh -T git@{host} once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.` (`<host>` literal for a `://` URL) |
| ssh-auth (both details) | SSH keys not set up for {label}; or use HTTPS | `SSH authentication with {label} failed. Make sure that your SSH keys are set up for {label}, or use an HTTPS URL.` |
| https-auth, GitHub (rejected, no-credential, bare 401/403) | credential helper set up, e.g. `gh auth login`; prompts and askpass are off, helpers are told not to prompt (true for Pi, D-SG-05) | `HTTPS authentication with GitHub failed. Make sure that your git credential helper is set up, for example with gh auth login. The extension runs git with terminal prompts and askpass programs turned off, and it tells credential helpers not to prompt. So git can only use a credential that it gets without asking you, such as one that a credential helper already holds.` |
| https-auth, other host | helper has valid credentials for {host} (or "this host"), e.g. a personal access token | `HTTPS authentication with {host} failed. Make sure that your git credential helper has a valid credential for {host}, for example a personal access token.` + the same last two sentences |
| network (only when git's own lines hold `timed out`, `timeout`, or `Could not resolve host`) | network error or timeout; check the connection; try again | `A network error or a network timeout stopped git. Make sure that your internet connection works, then try again.` |
| no-stderr | exited with code N and printed nothing; the debug switch shows the full command | `git exited with code {N} and printed no error output. To see the git command, set PI_CLAUDE_MARKETPLACE_DEBUG=1 and run the command again.` Only true if the debug log records the git command (Open Question 4). |
| git output label | upstream `Original error:` | `git printed: <compacted, bounded, redacted stderr>` |
| plugin both-failed tail | `Then install again.` | Verb-neutral: `Then run the command again.` (Open Question 1) |

Self-check against the skills: the longest descriptive sentence (the HTTPS prompt sentence) is 21 words; no "should", "may", "might", "could", semicolon, dash, or contraction; no "not X but Y" or one-line closer. The "Either … or" in the host-key sentence states two real alternatives (upstream's "rotation or possible MITM"), so it stays.

## Surface map (where each surface builds its cause chain)

| Surface | Where the row's cause is built | Today for a git failure | Change needed |
|---|---|---|---|
| `marketplace add` | `orchestrators/marketplace/add.ts` `failedAddRow` / `showsAddCause` (1460-1521) | no cause line, except git-missing, both-failed, hosted, frame, fetched URL | `showsAddCause` true for every `GitCommandError` (subclasses included) |
| `marketplace update`, autoupdate cascade | `orchestrators/marketplace/update.ts` `refreshFailureMessage` (737) wraps in `MarketplaceUpdateError`; `attachStoredCredentialCause` (499-514) adds the D-1-02 link | chain shown; D-1-02 line on `no-credential` | delete `attachStoredCredentialCause`, `lacksStoredCredential` (`marketplace/shared.ts:299`), `NO_STORED_CREDENTIAL_CAUSE` |
| PUP-2 sync (`plugin update`) | `orchestrators/plugin/update-flow.ts` `syncMarketplaceBySwap` (318-321) | D-1-02 line for url sources | delete the attach |
| plugin install | `orchestrators/plugin/install.messaging.ts` `keepsRuntimeCause` (182-188) | bare `{authentication required}` row (amended D-79-03) | keep the cause for every git failure |
| install's own add (D-MF-04) | `orchestrators/plugin/install-outcome.ts` `recordAsInstallFailure` (607-620) | non-auth add failure rethrown as `InstallMarketplaceAddError(reason, redactAbsolutePaths(errorMessage(err)))`, which drops the chain | carry the original error as `cause` |
| install cascade member | `orchestrators/plugin/install-cascade.messaging.ts` `memberCause` (565-578), `composeCascadeFailureMessage` (717) | head rebuilt from `err.message`, chain from `err.cause`, so a `GitCommandError` head loses its expansion | make the head keep the git entries (Pitfall 3) |
| plugin update preflight | `orchestrators/plugin/update-preflight.ts` `candidateFailure` (631-650) | bare auth row | keep the cause |
| plugin update / reinstall / converge | `update-flow.ts` 1109, 1324 (`redactCauseChain` for unclassified `network error`) | chain kept | covered once `redactCauseChain` preserves the class |
| dependency moves | `orchestrators/plugin/dependency-move.ts` 423 (`redactCauseChain(thrown)`) | chain kept | same |
| `fetch` (Pi-only verb) | `orchestrators/plugin/fetch.ts` 594 | chain kept | same |
| `import` | `orchestrators/import/execute.ts` `unexpectedFailureRow` (723-735, IMP-09 bare auth) and `pushUnexpectedFailure` (2314-2334: head = `redactAbsolutePaths(errorMessage(error))`, chain = `redactCauseChain(error.cause)`) | bare auth row; head flattening | keep the cause; keep git entries on the head |
| `apply` | `orchestrators/reconcile/apply.ts` 966; `apply-outcomes.ts` 920, 1072 (`redactCauseChain`) | chain kept | covered by the `redactCauseChain` change |
| background autoupdate pass | `orchestrators/marketplace/background-pass.ts` `SILENT_CONTEXT` (112-122) sends the rendered notice to `hookDebugLog`; failures logged at 223 with `errorMessage(err)` | same notice text in the debug log | central debug redaction; nothing else |
| MCP tools | `edge/handlers/tools.ts` 133 (`redactCredentials`) | list tools, no git failures | widening applies automatically |

Every site above reads its reason from `classifyGitFailure` and its wording from `serializeCauseChain`, so once the drop/flatten sites are fixed, the reason and the remedy are the same on every surface (success criterion 2).

## Redaction design (SG-ERR-02)

1. **URL spellings (new, `redactUrlSpellings(text, url)` in `shared/redact-credentials.ts`).** When `redactCredentials(url) !== url` or the URL has a query/credential fragment, replace the URL, the URL without its user part, and the URL without the text up to the password separator with the redacted form, as `mn`/`i3e` do. Inputs come from `runRemote` (`remote.url` and the wire URL after the D-SG-16 rewrite). Apply it in `settleRun` (via a new `GitRequest.remote` field) so the order is URL spellings, then credentials, then paths. After `redactCredentials` has run, the raw spelling no longer matches, which is why the order matters.
2. **Widened `redactCredentials`** (all callers benefit: subjects, clone notes, cause links, MCP tools):
   - query values: inside a `scheme://` token, replace each `?name=value` / `&name=value` value with `***`;
   - fragment values: only `#name=value` pairs (`#access_token=…`), never a bare `#stable` or `#v1`, because url sources use `#<ref>` (url-source.feature:94-185, info.feature:39);
   - GitLab family `gl(?:pat|dt|rt|oas|ptt|agent|imt|soat|cbt|ft|ffct)-[\w=-]{20,}` and the other fixed-prefix rules in the table above (planner chooses the list; recommend git-host and package-registry tokens plus AWS/GCP/Slack/OpenAI/Anthropic/Hugging Face);
   - `Basic` values: a separate rule that redacts any base64-shaped value (`[A-Za-z0-9+/]{4,}={0,2}` not followed by `=`, `"`, or a word character), because `dXNlcjpwYXNz` (12 letters) fails today's `isTokenShaped` and leaks; keep `Basic realm="…"` prose intact;
   - `%40` as the userinfo separator: `scheme://user:secret%40host/` (upstream rule `url-userinfo-encoded`).
3. **Paths:** `redactAbsolutePaths` on the git stderr at build time (git prints `Cloning into '<abs>'...`, `Offending ECDSA key in <abs>/known_hosts:3`, `dubious ownership in repository at '<abs>'`).
4. **Compaction and bound:** `compactOutput` (control characters and escape sequences stripped, which blocks terminal injection from server-sent `remote:` lines, one line, `"; "`-joined) then the 500-character bound. Open Question 3: head or tail.
5. **Second pass:** `serializeCauseChain` keeps its `redactCredentials` on every entry.
6. **Debug log:** `hookDebugLog` runs the same pass (no URL list) on `detail` before `console.error`. `debug-log.ts` can import `redact-credentials.ts` and `redact-absolute-paths.ts` without a cycle, because `errors.ts` does not import `debug-log.ts`. The raw lines in `clone-swap.ts:364-367`, `clone-swap.ts:482`, `github-transport.ts:231,238,267`, and `marketplace/add.ts:1023` (`subject = source.raw`) are then covered; fixing them at the site too keeps each line honest if the central pass changes.
7. **stdout/stderr:** unchanged. `platform/process-run.ts` pipes git's streams; the print-mode step `pi's print mode exits with code {int} and prints nothing` proves no git text escapes (debug off).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripping escape sequences from git output | a regex for ANSI codes | `node:util` `stripVTControlCharacters` (already in `compactOutput`) | Covers CSI, OSC, and other forms a server can send. |
| Compact/bound child output | a second copy | move `compactOutput`/`boundedNote` to `shared/child-output.ts` | fallow dupes fails on a clone group; D-SG-32 wants the same rule. |
| GitHub detection | a new host check | `gitHubAddressOf` (D-SG-23) in `runRemote` | Covers every GitHub spelling Pi folds. |
| Provider token shapes | invented prefixes | upstream table `Q` (exact sources above) | Tested by upstream; prefixes are fixed. |
| URL credential parsing | ad hoc split | WHATWG `URL` plus the existing userinfo regex | Matches git's reading of the last `@`. |

## Runtime State Inventory

Not a rename or migration phase. Checked anyway because visible texts retire:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. Cause texts are rendered per run; `state.json` and `claude-plugins.json` hold no message text (verified: messages are built from live errors in `notification-resolve.ts`). | none |
| Live service config | None. | none |
| OS-registered state | None. | none |
| Secrets/env vars | `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and `PI_CLAUDE_MARKETPLACE_DEBUG` are named in remedy text only; names unchanged. | none |
| Build artifacts | None. | none |

## Common Pitfalls

### Pitfall 1: an import cycle from `errors.ts`
**What goes wrong:** `serializeCauseChain` calls a remedy function that imports `github-base-url.ts` or `redact-absolute-paths.ts`; both import `errors.ts`, so fallow's cycle gate fails.
**How to avoid:** the remedy and compaction modules are leaves with no internal imports; GitHub detection and path redaction happen in `platform/` at build time.
**Warning signs:** `fallow dead-code --circular-deps` reports a cycle through `shared/errors.ts`.

### Pitfall 2: `redactCauseChain` erases the class
**What goes wrong:** apply, import, cascade, update, fetch, prune, and dependency-move rows lose the remedy and the output because the rebuilt link is a plain `Error`.
**How to avoid:** rebuild a `GitCommandError` link as a `GitCommandError` (copy failure, operation, exit code, remote; run `redactAbsolutePaths` on stderr again), next to the existing `ManualRecoveryError` branch.
**Warning signs:** an apply/import cascade scenario shows the typed line but no remedy.

### Pitfall 3: head flattening
**What goes wrong:** sites that build a new head from `err.message` plus `redactCauseChain(err.cause)` drop the git entries when the head is the `GitCommandError` (`memberCause`, `composeCascadeFailureMessage`, import `pushUnexpectedFailure`, `recordAsInstallFailure`).
**How to avoid:** route these through one helper that keeps the git entries, for example pass `redactCauseChain(err)` as the cause where the head class is a plain wrapper, or give `DependencyCascadeError` the expansion.
**Warning signs:** a dependency-clone failure row in an install cascade shows only `git clone --depth failed: …`.

### Pitfall 4: the bare auth row
**What goes wrong:** all four auth classes map to `{authentication required}`, and three sites (install, update preflight, import IMP-09) drop the cause for that reason, so the HTTPS/SSH/host-key remedies never show on plugin surfaces.
**How to avoid:** remove the rule and amend D-79-03 (and IMP-09) in PROJECT.md.

### Pitfall 5: `#ref` fragments and query strings are not secrets
**What goes wrong:** a blanket fragment rule turns `tools.git#stable` into `tools.git#***` in subjects and the `claude-plugins.json` echo; scenarios in url-source.feature, info.feature, and git-source.feature fail.
**How to avoid:** redact only `name=value` fragment pairs; redact query values, keep query names.

### Pitfall 6: server-controlled text
**What goes wrong:** a `remote:` line containing `timed out` makes the network remedy fire, or a `remote:` line holds an escape sequence that repaints the TUI.
**How to avoid:** sub-check the network remedy on git's own lines (`remote:` removed, as `classifyGitExit` does); strip control characters in compaction.

### Pitfall 7: volatile stderr in scenarios
**What goes wrong:** curl prints `after 0 ms`, ports, and temp paths, so an exact cause pin flakes.
**How to avoid:** pick arms with stable stderr (404 `repository '…' not found`, 403 `The requested URL returned error: 403`, 401 `could not read Username for '…': terminal prompts disabled`, the ssh stand-in texts); `{git host}`, `{home}`, `{project dir}`, `{agent dir}` tokens already replace the rest (`features/lib/run-tokens.ts`). A refused port (`Failed to connect … after N ms`) is volatile.

### Pitfall 8: central path redaction in debug lines
**What goes wrong:** existing unit tests that capture debug output (`test/platform/debug-log-capture.ts`, used by about 30 test files) and assert an absolute path fail once `hookDebugLog` runs `redactAbsolutePaths`.
**How to avoid:** run every test that imports `captureDebugLog` after the change; update assertions to basenames. If many hooks-bridge assertions depend on full paths, raise it with the user before narrowing D-SG-35.

### Pitfall 9: complexity gates
**What goes wrong:** a remedy `switch` with per-kind branches and host derivation exceeds sonarjs cognitive 15 or fallow cognitive 15 / cyclomatic 20; widened regexes trip `sonarjs/slow-regex` or `regex-complexity`.
**How to avoid:** one small function per class; a table for the token rules (`readonly [RegExp, replacement][]`); keep each regex linear (anchored prefixes, bounded classes, no nested quantifiers), as the current module documents.

### Pitfall 10: the `(truncated)` marker
**What goes wrong:** adding remedy and output as real `Error` links pushes long chains past `CAUSE_CHAIN_MAX_DEPTH = 5`.
**How to avoid:** expand entries in the serializer (Pattern 2).

## Code Examples

### The D-SG-35 order at build time

```typescript
// Sketch for platform/git-process.ts settleRun. Names are proposals.
const shown = redactAbsolutePaths(
  redactCredentials(redactUrlSpellings(run.stderr, request.remote?.urls ?? [])),
);
return new GitCommandError(classifyGitExit(code, run.stderr), {
  operation,
  ...(code !== null && { exitCode: code }),
  stderr: shown,                                   // constructor runs redactCredentials again (idempotent)
  ...(request.remote !== undefined && { remote: request.remote.display }),
});
```

Classify from the raw stderr (as today), display from the redacted one.

### Central debug redaction

```typescript
// shared/debug-log.ts — imports two leaves; no cycle (errors.ts never imports debug-log.ts).
export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${redactAbsolutePaths(redactCredentials(detail))}`);
  }
}
```

The header comment ("Pure leaf module: no imports") must change with it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D-1-02 `printf … \| git credential approve` cause line on update paths | one HTTPS auth remedy naming a credential helper | this phase | update rows lose the recipe; `test/architecture/no-credential-leak.test.ts:368-380` scans for `NO_STORED_CREDENTIAL_CAUSE` and must be removed or re-aimed |
| GAUTH-04 `<host> rejected the stored credential` link | the typed line plus the HTTPS remedy | this phase | credentials.feature:129 and git-source.feature:360-389 change |
| Placeholder `git <op> failed: <kind>, exit code N` alone | typed line, remedy, `git printed:` output | this phase | every scenario that pins a git cause chain changes (list below) |

## Tests and docs that change

Pins found by grep this session (counts are lines):

- D-1-02 recipe: `features/marketplace/git-source.feature` (lines 305, 331, 332, 413), `test/orchestrators/auth-host.test.ts`, `test/orchestrators/marketplace/update.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/architecture/no-credential-leak.test.ts` (AUTH-09 / GAUTH-04 case at 368).
- GAUTH-04 text: `features/marketplace/credentials.feature` (129), `features/marketplace/git-source.feature` (360, 388, 389), `test/orchestrators/marketplace/update.test.ts`, `test/shared/errors.test.ts`.
- Typed-line causes (chain pins that will gain entries): `test/orchestrators/marketplace/add.test.ts` (11), `test/orchestrators/plugin/fetch.test.ts` (10), `test/orchestrators/marketplace/update.test.ts` (10), `test/orchestrators/plugin/update-flow.test.ts` (9), `features/marketplace/git-source.feature` (9), `features/plugin/git-source.feature` (7), `test/orchestrators/plugin/install-flow-ledger.test.ts` (4), `features/marketplace/credentials.feature` (4), `features/plugin/git-source-update.feature`, `features/plugin/fetch.feature`, `features/marketplace/url-source-update.feature` (3 each), `test/shared/errors.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `features/plugin/update.feature`, `features/plugin/credentials.feature` (2 each), and one each in `install-cascade.messaging.test.ts`, `clone-swap.test.ts`, `edge/handlers/plugin/reinstall.test.ts`, `features/plugin/reinstall.feature`, `features/plugin/github-transport.feature`, `features/plugin/github-transport-update.feature`, `features/plugin/bootstrap.feature`, `features/marketplace/url-source.feature`, `features/marketplace/github-transport.feature`, `features/marketplace/github-refresh.feature`.
- Bare add rows that gain a cause: `features/marketplace/failed-add.feature` (the timeout scenario near line 145 and the drop scenario near line 130).
- Docs: `docs/messaging-style-guide.md` (the cause-chain bullets near lines 71 and 95: a git link renders as typed line, remedy, and `git printed:`; the `authentication required` paragraph at line 40); `docs/json-output.md:887` (`causeChain` description: entries now include the remedy and git output for a git link); README.md and README.es.md "Git authentication" (lines 44-70) do not show the D-1-02 recipe, so at most one sentence about the new remedies (follow the `readme` skill and keep both in sync); CHANGELOG `[Unreleased]` one bullet (follow the `changelog` skill); PROJECT.md rows D-SG-31..35 (new), amendments to D-79-03 (bare auth row and D-1-02 line retired), IMP-09 (if recorded), D-SG-26 (the "refused stored credential still wins" note now reads the subclass), D-SG-07 and D-SG-13 ("wording in Phase 6" notes closed). D-1-02 and GAUTH-04 have no rows of their own in PROJECT.md (grep this session); record their amendment inside the D-79-03 row and the new D-SG rows.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstream `Bo(host)` means "the host is GitHub" | Upstream evidence | `{label}` could differ for a GitHub Enterprise host; low impact |
| A2 | Separate cause entries read better than one multi-line entry | Pattern 2 | A cosmetic choice; reversible |
| A3 | Adding a debug line that records each git command is acceptable under IL-2/OBS-01 | Open Question 4 | Without it, the no-stderr remedy must not promise the command |
| A4 | The plugin surface should get the marketplace remedies (upstream shows only stderr there) | Open Question 2 | Divergence without an explicit user answer |
| A5 | An empty-stderr git failure cannot come from real git in the harness without a fake git | Validation | The no-stderr class may need a unit test only, or a new stand-in |

## Open Questions

1. **Does D-SG-31's "both-transports wrappers stay as they are" cover the plugin text's `Then install again.`?**
   - What we know: D-SG-31 keeps the wrappers; D-SG-33 says `Then install again.` must fit the verb or be neutral; Pi shows it on install, update, reinstall, apply, and import; pinned in github-transport.feature:187, credentials.feature:59/160, github-transport-update.feature:444.
   - Recommendation: keep the wrapper sentences, change only the last sentence to `Then run the command again.`, and record it under D-SG-33.
2. **Remedies on the plugin surface.** Upstream's plugin clone shows `Failed to clone repository: [timed out after Ns (…). ]<stderr>` and no class remedy. CONTEXT's test layout puts plugin install in every class. Recommendation: apply the remedies on every surface (one serializer makes anything else harder) and record it as part of D-SG-31; confirm with the user.
3. **Bound: head or tail.** `boundedNote` keeps the first 500 characters; git's reason is its last line (`git-process.ts:685` comment), and a long `remote:` banner can push it out. Recommendation: same 500 limit, keep the end for git output, and say so in D-SG-32's record; or keep the head for exact convention.
4. **The no-stderr remedy promises "the full command".** Pi's debug log does not record git commands today (only `git version` at `git-process.ts:1244`). Recommendation: add one `[git]` debug line per failed run with the subcommand, Pi-owned options, and redacted operands, so the sentence is true; otherwise word it as "to see more detail".
5. **Both-attempts inner messages.** Upstream's marketplace wrapper embeds each attempt's full class message; Pi's embeds the typed lines, and only the last attempt's link expands. Recommendation: keep it (D-SG-31); the first attempt's output stays in the debug log.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests | ✓ | v24.22.3 (with `/opt/pi-claude-marketplace/bin` on PATH) | — |
| npm | scripts | ✓ | 10.9.9 | — |
| git | product, harness | ✓ | 2.43.0 | — |
| ssh | none (tests must not run a real ssh) | ✗ | — | the ssh stand-in (`features/lib/ssh-git-host/`) |
| Claude Code binary | evidence only | ✓ | 2.1.332 at `/opt/claude-code/bin/claude` (grep, never run) | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration, architecture) and cucumber-js (behavioral, `adapter` and `builtin` profiles) |
| Config file | `package.json` scripts; `cucumber.json`; `scripts/cucumber.mjs` |
| Quick run command | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/shared/<module>.test.ts` (with `GIT_CONFIG_COUNT` and every `GIT_CONFIG_KEY_*`/`VALUE_*` unset) |
| One scenario | `PATH="$PWD/node_modules/.bin:/opt/pi-claude-marketplace/bin:$PATH" node scripts/cucumber.mjs --profile adapter features/x.feature --name '<name>'` |
| Full suite command | `npm run check` (GSD gates only) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-ERR-01 | Remedy per kind, host label, seconds rounding, `1 second`, `<host>` literal, network sub-check on own lines | unit | `node --test test/shared/git-failure-remedy.test.ts` | ❌ Wave 0 |
| SG-ERR-01 | Compaction and bound | unit | `node --test test/shared/child-output.test.ts` | ❌ Wave 0 (move from package-install tests) |
| SG-ERR-01 | Serializer expands a git link; `truncated` unchanged | unit | `node --test test/shared/errors.test.ts` | ✅ (extend) |
| SG-ERR-01 | `redactCauseChain` keeps `GitCommandError` | unit | `node --test test/shared/redact-absolute-paths.test.ts` | ✅ (extend) |
| SG-ERR-01 | Timeout remedy on `marketplace add` (hold arm, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=1000`) | cucumber | `features/marketplace/failed-add.feature` | ✅ (extend) |
| SG-ERR-01 | HTTPS auth remedy, GitHub and other host (401 credential arm; 403 status arm) on add, update, plugin install | cucumber | `features/marketplace/credentials.feature`, `features/plugin/credentials.feature`, `features/marketplace/git-source.feature` | ✅ (rewrite pins) |
| SG-ERR-01 | SSH auth remedy (`denied` arm) | cucumber | `features/marketplace/github-transport.feature`, `features/plugin/github-transport.feature` | ✅ |
| SG-ERR-01 | Host key unknown (`host-key` arm) | cucumber | new scenarios in the ssh feature files | ✅ arm exists |
| SG-ERR-01 | Host key changed | cucumber | needs a new ssh stand-in arm | ❌ Wave 0 |
| SG-ERR-01 | Network remedy (`ssh: Could not resolve hostname` from an unregistered ssh host) | cucumber | ssh feature files | ✅ stand-in behavior exists |
| SG-ERR-01 | Stderr-only class (404 `repository … not found` -> `{source missing}` with `git printed:` and no remedy) | cucumber | `features/marketplace/failed-add.feature` or git-source | ✅ arm exists |
| SG-ERR-01 | Same reason and remedy in `apply`, `import`, and the background pass (debug log) | cucumber | `features/plugin/apply*.feature`, `features/plugin/import*.feature`, `features/marketplace/background-update.feature` | ✅ (extend) |
| SG-ERR-01 | No-stderr remedy | unit (cucumber needs a silent fake git) | `test/shared/git-failure-remedy.test.ts`, `test/platform/git-process.test.ts` | ❌ / ✅ |
| SG-ERR-02 | Widened patterns, `#ref` kept, query values redacted, `Basic`, `%40`, token table rows | unit | `node --test test/shared/redact-credentials.test.ts` | ✅ (extend) |
| SG-ERR-02 | URL spellings replaced before credentials | unit | `node --test test/shared/redact-credentials.test.ts`, `test/platform/git-process.test.ts` | ✅ (extend) |
| SG-ERR-02 | Central debug redaction | unit | `node --test test/shared/debug-log.test.ts` | ✅ (extend) |
| SG-ERR-02 | Credential in URL userinfo and a query token, absent from the notice, the JSON-mode output, and the print-mode debug log | cucumber | new scenario (url source `https://user:secret@{git host}/acme/tools.git?private_token=glpat-…` against a 404 arm; JSON mode step; print mode with `PI_CLAUDE_MARKETPLACE_DEBUG=1`) | ❌ Wave 0 (a debug-log assertion step) |
| SG-ERR-02 | git output never reaches stdout/stderr directly | cucumber | `pi's print mode exits with code 0 and prints nothing` after a failing clone (debug off) | ✅ step exists |

### Sampling Rate
- **Per task commit:** the owner tests of the touched pairs, plus `npm run check:commit` through the hook.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** full `npm run check` green before `/gsd-verify-work` (known baseline: 5 `fd` Glob scenarios fail in features/hook/tool-use.feature).

### Wave 0 Gaps
- [ ] `test/shared/git-failure-remedy.test.ts` (new pair).
- [ ] `test/shared/child-output.test.ts` (new pair; move the compaction cases from `test/orchestrators/plugin/package-install.test.ts`).
- [ ] ssh stand-in arm for a changed host key in `features/lib/ssh-git-host/launch.ts` (the OpenSSH `@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@` banner, an `Offending … key in <path>/known_hosts:N` line, then `Host key verification failed.`, exit 255) plus its step in `features/step_definitions/ssh-host.steps.ts` and its `test/architecture/` harness test.
- [ ] A step that asserts the print-mode stderr (the debug log) holds no given secret, or compares it whole after token projection.
- [ ] Decide the no-stderr scenario: unit only, or a stand-in "git that exits 1 and prints nothing" (A5).

## Security Domain

`security_enforcement` is not set to false, so this section applies. ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no sign-in; git's own helpers) | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Validation, Sanitization and Encoding | yes | strip control characters and escape sequences from server-sent git output before display (`stripVTControlCharacters`, `\p{Cc}`); compact to one line so no newline forges a row |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | V7.1.1/V7.1.2: no credential or session token in logs (central `hookDebugLog` pass); errors shown to the user carry no secret (`serializeCauseChain` second pass) |
| V8 Data Protection | yes | V8.3.1-style: sensitive data in URL query strings is not shown (query value redaction) |
| V14 Configuration | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token in URL userinfo or query echoed by git | Information disclosure | URL spellings pass, widened `redactCredentials`, second pass at serialization |
| Token in a server-sent `remote:` line | Information disclosure | provider-prefix rules; `Bearer`/`Basic` rules |
| Absolute path in git stderr (home directory, user name) | Information disclosure | `redactAbsolutePaths` on stderr at build time and in debug lines |
| Escape sequence in `remote:` text repaints the terminal | Tampering / Spoofing | strip VT sequences and control characters |
| Server text picks a misleading remedy | Spoofing | classify and sub-check on git's own lines only (WR-01) |
| Very long stderr floods the notice | Denial of service | 64 KiB capture tail, 500-character display bound |
| Debug log written raw at 267 sites | Information disclosure | one central pass in `hookDebugLog` |

## Sources

### Primary (HIGH confidence)
- `/opt/claude-code/bin/claude` 2.1.332, grepped 2026-11-28: `bqo`, `wqo`, `qNi`, `IGo`, `zNi`, `KNi`, `GHi`, `SVo`, `kVo`, `zHi`, `rRe`, `mn`, `jh`, `Gg`, `Cn`, `In`, `Ix`, the token rule table `Q`, `ge`.
- In-repo source read this session: `shared/errors.ts`, `shared/redact-credentials.ts`, `shared/redact-absolute-paths.ts`, `shared/debug-log.ts`, `shared/git-failure-classifiers.ts`, `platform/git-failure-kind.ts`, `platform/git-process.ts`, `platform/git.ts`, `orchestrators/auth-host.ts`, `orchestrators/plugin/package-install.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/update-flow.ts`, `orchestrators/plugin/install.messaging.ts`, `orchestrators/plugin/install-cascade.messaging.ts`, `orchestrators/plugin/install-outcome.ts`, `orchestrators/plugin/update-preflight.ts`, `orchestrators/import/execute.ts`, `orchestrators/reconcile/apply-outcomes.ts`, `orchestrators/marketplace/background-pass.ts`, `features/lib/ssh-git-host/*`, `features/lib/https-git-host/server.ts`, `features/lib/field-rows.ts`, `features/step_definitions/command.steps.ts`.
- Local git 2.43.0 probe and node redaction probe (outputs quoted above).

### Secondary (MEDIUM confidence)
- `.planning/phases/06-failure-message-parity/06-UPSTREAM-ANALYSIS.md` (re-checked; one correction recorded about `Gg`/`Ln`).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Upstream texts and triggers: HIGH (binary read).
- Pi code paths and the drop/flatten sites: HIGH (read).
- Rendering and module design: MEDIUM (recommended, not built; the cycle constraint is verified by imports).
- Wording: MEDIUM (drafts for the planner to lock).

**Research date:** 2026-11-28
**Valid until:** 2026-12-28 (stable; recheck if the Claude Code binary changes version)
