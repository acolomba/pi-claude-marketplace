# Phase 6 (Failure-Message Parity) — discuss analysis

Read-only. Repo: /home/user/pi-claude-marketplace, branch features/system-git. 2026-11-28.

## Evidence base

- Binary: `/opt/claude-code/bin/claude`, `VERSION:"2.1.332"`. Grepped (never run) on 2026-11-28 with `grep -a` and a byte-offset context reader.
- The supplied dump `scratchpad/cc-strings.txt` is from **2.1.330** (`VERSION:"2.1.330"`), not 2.1.332. I made a 2.1.332 dump with `strings -n 8` at `scratchpad/cc332-strings.txt`. Every literal below occurs in both dumps; only minified names differ (`ZMo`/`rLo` in 2.1.330 are `bqo`/`GHi`+`kVo` in 2.1.332).
- Does the phase touch the upstream contract? Yes. These are the user-visible failure texts of `marketplace add/update` and the plugin install.
- Confidence: HIGH for every literal and trigger quoted below (code read directly). MEDIUM for Linux git-missing on the marketplace path (the Linux build compiles the macOS check `rSt` to `return!1`, and the Linux ENOENT text comes from the spawn layer, which I did not trace).

### Upstream structure (2.1.332)

**Marketplace clone (`bqo`)**: the classifier runs in this order. The first match wins, and each class message gets `\n\nOriginal error: ${stderr}` with the stderr already redacted (`rRe`). The caller throws `Failed to clone marketplace repository: ${stderr}`. `marketplace update` wraps the result once more as `Failed to refresh marketplace '${name}': ${msg}`.

Before the clone runs, it can refuse with `Refusing to clone. ${validatorMessage}` (D-SG-17 validator), with `Refusing to clone: this marketplace's \`ref\` (${ref}) looks like a commit id with capital letters, ...` (Pi already has this as `CapitalLetterCommitRefError`), or with a pin refusal. Counting these refusals and the raw stderr fallthrough explains the "nine classes" in FEATURES.md: 7 classified messages + refusals + raw stderr. E-SG-10's table lists 7 rows.

**Plugin clone (`GHi`)**: there are no class messages. The text is `Failed to clone repository: ${timeoutPrefix}${redactedStderr}`, where the prefix is `timed out after ${s}s (CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS sets the limit). ` and appears only on a timeout. `kVo` sorts the failure into typed classes only for internal behavior. The classes are `fatal: remote error:` (generic), `xcrun: error:` or the xcode line (git-missing), git-proxy refusal, and the `VHi` network regex. Their one consumer is the "installed from another marketplace instead" fallback (`Bdl`/`jdl`). No user-facing class wording exists. Other plugin texts: `Failed to fetch commit ${sha}: ${stderr}`, `Failed to checkout commit ${sha}: ${stderr}`, `SHA pin verification failed: expected ... Refusing to install.`, `Invalid ref "${ref}": cannot start with "-"`.

## 1. Failure-class table

Legend: **[CC-only]** means the text names something only Claude Code has, so Pi must adapt it. "Pi now" is what `features/` pins today.

Pi row grammar: `⊘ <subject> [scope] (failed) {reason}` with an optional `    cause: l1 -> l2`.

- A plugin row always carries a cause.
- A single-attempt **marketplace add** row carries **no cause line**, except for git-missing, both-transports, the hosted errors, an HTTP-status frame, or the base-override `fetched <url>` link (`orchestrators/marketplace/add.ts:1468-1521`, `failedAddRow`/`showsAddCause`).
- Pi's cause text for a git failure is `GitCommandError.message`: `git <op> failed: <kind>, exit code N` (`shared/errors.ts:1376-1394`). Phase 2 wrote that text as a placeholder and never shows the stderr.

| # | Class (upstream trigger) | Upstream exact text (source, 2.1.332) | Pi kind → reason | Pi now (feature pin) | Gap | Pi equivalent? |
|---|---|---|---|---|---|---|
| 1 | Marketplace clone timeout (`error` includes `timed out`) | `Git clone timed out after ${n}s. The repository may be too large for the current timeout. Set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to increase it (e.g., 300000 for 5 minutes).` + `\n\nOriginal error: …` (`bqo`) | `timeout` → `network unreachable` | add: `{network unreachable}` with no cause (failed-add.feature:145); plugin: `git clone --depth timed out after 120000 ms` (errors.ts:1388) | wording; ms vs s; no cause on add | Yes. Pi reads the same variable (D-SG-13) |
| 1b | Plugin clone timeout | `Failed to clone repository: timed out after ${n}s (CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS sets the limit). <stderr>` (`GHi`/`SVo`) | same | as above | wording | Yes |
| 2 | `REMOTE HOST IDENTIFICATION HAS CHANGED` | `SSH host key has changed (server key rotation or possible MITM). Remove the stale known_hosts entry:\n  ssh-keygen -R ${host}\nThen connect once manually to verify and accept the new key.` (`<host>` literal when the URL is not scp form; `IGo`) | `ssh-host-key-changed` → `authentication required` | `git clone --depth failed: ssh-host-key-changed, exit code 128` (plugin); add: token only | wording; add has no cause | Yes |
| 3 | `Host key verification failed` | `SSH host key is not in your known_hosts file. To add it, connect once manually (this will show the fingerprint for you to verify):\n  ssh -T git@${host}\n\nOr use an HTTPS URL instead (recommended for public repos).` | `ssh-host-key-unknown` → `authentication required` | same placeholder | wording | Yes |
| 4 | SSH auth (`Permission denied (publickey)` or `Could not read from remote repository`) | `SSH authentication failed. Please ensure your SSH keys are configured for ${GitHub\|host\|"your git host"}, or use an HTTPS URL instead.` (`zNi`: `GitHub` when `Bo(host)`) | `ssh-auth` (`publickey`/`unconfirmed`) → `authentication required` | `git clone --depth failed: ssh-auth, exit code 128` | wording. Upstream fires on *either* line; Pi splits the detail, which is fine because the retry rules (D-SG-22) need it | Yes |
| 5 | HTTPS auth (`Authentication failed`, `could not read Username`, `unable to get password from user`, `terminal prompts disabled`, or `/40[13]/` anywhere in stderr after removing 40/64-hex SHAs: `qNi`+`P4i`) | `HTTPS authentication failed. Please ensure ${hint}. Claude Code runs this clone with terminal prompts and askpass programs turned off and tells credential helpers not to prompt, so git needs a credential it can get without asking you, such as one a credential helper already holds.` The hint is `your credential helper is configured (e.g., gh auth login)` for GitHub, else `your git credential helper has valid credentials for ${host ?? "this host"} (e.g., a personal access token)` (`KNi`). **[CC-only: "Claude Code runs this clone"]** | `https-auth` `rejected`/`no-credential` → `authentication required`; `StoredCredentialRejectedError` → same | plugin/add: `git clone --depth failed: https-auth, exit code 128`; update: `Failed to update marketplace "x". -> git ls-remote failed: https-auth, exit code 128 -> no credential was obtained for <host>; store one with: printf '…' \| git credential approve` (D-1-02, update.test.ts:540; update.ts:505-512, update-flow.ts:319) | Wording. Upstream has **one** message for both rejected and no-credential, and it has no `git credential approve` recipe. WR-02 (a bare 401/403 is `no-credential`) only decides whether Pi's D-1-02 hint appears | Yes (except the "Claude Code" sentence) |
| 6 | Network/timeout text (`timed out`, `timeout`, `Could not resolve host`) | `Network error or timeout while cloning repository. Please check your internet connection and try again.` | `network` (no status) → `network unreachable` | add: token only; plugin: `git clone --depth failed: network, exit code 128` | Wording. Upstream's trigger is narrower: connection refused, TLS, and 5xx fall through to raw stderr. Pi's `network` kind is wider (git-failure-kind.ts:58-78) | Yes |
| 7 | Empty stderr | `git clone exited with code ${n} (no stderr output). Run with --debug to see the full command.` **[CC-only: `--debug`]** | `no-stderr` → rule.unknown (plugin: `network error` via apply/import; add: unclassified) | placeholder | wording; `--debug` maps to `PI_CLAUDE_MARKETPLACE_DEBUG=1` | Adapt |
| 8 | Anything else (not found, ref missing, 5xx, TLS, refused, dubious ownership…) | marketplace: `Failed to clone marketplace repository: <redacted stderr>`; plugin: `Failed to clone repository: <redacted stderr>` | `repository-not-found` → `source missing` (add, install) / `network error` (refresh, UPD-11); `remote-ref-missing` → `source missing` (add) / unclassified (install); `network` with status → `network error` + `<status> on <url>` frame | `git clone --depth failed: repository-not-found, exit code 128[, fetched <url>]`; add 404: `{source missing}` and `404 on <url>` only when a frame is built | Pi has no stderr and a placeholder text; upstream shows git's own words | Yes |
| 9 | Both transports failed, marketplace | `Fetching the marketplace from GitHub failed on both attempts. ${T1} (${url1}): ${msg1}\n\n${T2} (${url2}): ${msg2}` (`wqo`; only when the messages differ, else the second error) | `GitHubTransportsFailedError` → last attempt's reason (OQ-8) | wrapper verbatim (github-transport.feature:144), but `msgN` = Pi placeholder `git clone --depth failed: ssh-auth, exit code 128` | inner messages only (they become class messages once #1-8 land) | Yes |
| 9b | Both transports failed, plugin (shell install; Pi applies it to install/apply/import, D-SG-18/19) | `${msg1}\nThe retry over SSH failed too: ${msg2}\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.` (`zHi`) | same | wrapper verbatim (errors.ts:1477-1480), inner = placeholder | inner messages; "Then install again." also shows on update/reinstall | Yes |
| 10 | Git missing, macOS | `git is not installed on this Mac. To install it, run xcode-select --install, then try again.` (`fKr`; the spawn layer returns it as stderr with code 127, so it reaches the user as `Failed to clone marketplace repository: <this>` / `Failed to clone repository: <this>`) | `git-missing` `macos-shim` → `git missing` | `{git missing}` with cause = the macOS text verbatim (errors.ts:1383) | upstream adds the clone wrapper prefix; Pi does not | Yes |
| 10b | Git missing, other OS | `/plugin` UI: `Git is required to install marketplaces.` + hint `Install git and restart Claude Code.` **[CC-only: `/plugin` UI, restart]**; git-subdir: `git-subdir plugin source requires git to be installed and on PATH. Install git (version 2.25 or later for sparse-checkout cone mode) and try again.`; the CLI clone path on Linux shows the spawn error (MEDIUM) | `git-missing` `not-found`/`batch-launcher` → `git missing` | `Git is required to install marketplaces.` (without-git.feature:18), also on a plugin install | Settled by D-SG-07. The plugin-install row reuses the marketplace text; upstream's git-subdir text differs | Yes |
| 11 | Windows unsafe git location | `Command '${cmd}' not found or is in an unsafe location (current directory)` (generic `safeSpawn`, `le()` Windows only) | `git-missing` → `git missing` | `Git is required to install marketplaces.` | 02-CONTEXT: generic spawn text, not git-specific; D-SG-07 chose the marketplace text | Pi refuses cwd matches the same way (D-SG-04) |
| 12 | Dubious ownership | **No user message on the clone surface.** It appears only as a telemetry class `git_refused_dubious_ownership` (`Ar` table) and in sandbox system-prompt prose. The clone shows raw stderr (`fatal: detected dubious ownership in repository at '…'`) | `dubious-ownership` → rule.unknown | placeholder | The roadmap expects "the dubious-ownership message", but upstream has none for this surface | Pi-only kind |
| 13 | Ref missing | raw stderr (`fatal: Remote branch x not found in upstream origin`); plugin SHA: `Failed to fetch commit ${sha}: …` | `remote-ref-missing`, `commit-missing`, `local-ref-missing` | placeholder / `{source missing}` | wording | Yes |
| 14 | Git proxy 403 | plugin-only class `X1t` (Claude Code remote-session proxy) **[CC-only]** | `proxy-refused` → rule.unknown | placeholder | no Pi proxy (D-SG-24) | No |
| 15 | Pi-only kinds: `git-too-old`, `protocol-refused`, `not-a-repository`, `aborted`, `refused-input`, `pin-mismatch`, `failed` | none (raw stderr) | various | placeholder | decide wording | n/a |
| 16 | Marketplace update wrapper | `Failed to refresh marketplace '${name}': ${msg}` | — | `Failed to update marketplace "tools".` as the first cause link | wording; Pi reports the freshness `ls-remote` failure (D-SG-26), for which upstream has no text | Partly |

Telemetry buckets (`A_e`: `dns_or_refused`, `timeout`, `conn_reset`, `auth`, `not_found`, `tls`, `invalid_schema`, `other`) are out of scope under IL-4.

## 2. Credential redaction today (SG-ERR-02)

What is covered:

- `shared/redact-credentials.ts:34-46` `redactCredentials` replaces:
  - `scheme://userinfo@` with `***@`;
  - the secret after `x-access-token:` and after a token-shaped `Bearer` value;
  - `ghp_/gho_/ghu_/ghs_/ghr_` tokens and `github_pat_` tokens of 16 or more characters.
- `GitCommandError.stderr` is redacted when the error is built (`shared/errors.ts:1368`). Today the stderr is **never shown** (no consumer under `orchestrators/`, `shared/`, or `edge/`).
- Notices and JSON:
  - `serializeCauseChain` redacts every cause link (`shared/errors.ts:191`). The text and JSON/RPC strategies both read the serialized chain (`notification-json.ts:783`).
  - Subjects, clone note URLs and retries, and raw surfaces are redacted in `notification-resolve.ts:399-450,736-754` and `notification-present.ts:176-265`. MCP tools are redacted in `edge/handlers/tools.ts`.
- `GitHubTransportsFailedError` redacts its whole message (`errors.ts:1431`).
- Absolute paths: `redactAbsolutePaths` is applied per site (for example `install-outcome.ts:619`, `install-cascade.messaging.ts:575,717`). The cause chain itself does not run it.
- git's output never reaches the terminal directly: `platform/process-run.ts:420,438` pipes stdout and stderr (`stdio: [ignore|pipe, pipe, pipe]`). Only `shared/debug-log.ts:24` writes to the console (`console.error`, gated by `PI_CLAUDE_MARKETPLACE_DEBUG=1`).

Gaps:

1. **The debug log has no central redaction.** `hookDebugLog` (`shared/debug-log.ts:22-26`) prints its input as is. Redacted sites: `github-transport.ts:142` and `clone-swap.ts:373` (`debugMessage`), and `platform/git.ts:900,959` (paths only, no credential pass). Raw `errorMessage(err)` sites: `clone-swap.ts:266,580,631`, `marketplace/add.ts:1360`, `marketplace/remove.ts:1239`, `plugin/uninstall.ts:1336`, `plugin/update-swap.ts:1685`, `plugin/carried-marketplace-adds.ts:116,120`, `plugin/dependency-bindings.ts:162`, `plugin/clone-cache.ts:651`, `reconcile/apply.ts:1830`. GitCommandError messages hold no URL, but other errors in those chains can hold one (for example `FetchedUrlCause` `fetched <url>`, errors.ts:627).
2. **Unredacted URL or subject in debug lines**:
   - `orchestrators/marketplace/clone-swap.ts:364-367` logs `args.subject ?? plan.first.url` raw.
   - `clone-swap.ts:482` passes `plan.first.url` as the subject.
   - `orchestrators/github-transport.ts:231,238,267` log `run.subject` raw. `marketplace/add.ts:1023` sets subject to `source.raw`, the user-typed source, which may be an https URL with userinfo if a GitHub form keeps it. Verify.
3. **Narrower than upstream.** Upstream `rRe(stderr, url)` first replaces every credential-bearing spelling of the clone URL (`mn`) with its redacted form (`jh`). `jh` also redacts URLs that carry a query or fragment (`t.search||t.hash`), an ssh URL with a password, and percent-encoded userinfo. Then `Gg` runs a generic secret scanner, whose provider table (`Ln`) names AWS, GCP, GitLab, npm, PyPI, JWT, OpenAI, HuggingFace, HashiCorp, SendGrid, and others. Pi does not redact query or fragment tokens (`?private_token=…`), GitLab `glpat-`, `Authorization: Basic`, or other provider tokens. This matters as soon as Phase 6 shows git's stderr (`Original error:`), because `remote:` lines are server-controlled text.
4. **Absolute paths in stderr.** git prints local paths (`dubious ownership in repository at '/home/…'`, `destination path '…' already exists`). The cause chain runs no `redactAbsolutePaths`, so adding stderr to a cause line needs the path pass too (NFR-10/IL-2 rule, research FEATURES.md row 239).
5. `GitCommandError.message` deliberately omits stderr (errors.ts:1339-1342). Any new message must keep stderr out of `message` unless it is redacted at build time, or it must be redacted again at the cause-chain step (it already is).

## 3. Gray areas for the user

**Q1. What form does a git failure message take?**

> **Claude Code:** one sentence per class, built as `<wrapper>: <class message>\n\nOriginal error: <redacted git stderr>` (marketplace), or `Failed to clone repository: <redacted stderr>` (plugin, no classes). Binary 2.1.332, HIGH. **Pi:** `{reason}` token plus the placeholder cause `git clone --depth failed: <kind>, exit code N`. A single-attempt marketplace add shows no cause at all.

- A (recommended): keep the `{reason}` token (D-PL7-01 grammar) and make the cause line upstream's text per surface. A marketplace add or update shows `Failed to clone marketplace repository: <class msg>` (update: `Failed to refresh marketplace '<name>': …`). A plugin clone shows `Failed to clone repository: [timed out after Ns (…). ]…`. Both include `Original error: <stderr>`, redacted for credentials and paths. A marketplace add row always gets a cause line.
- B: same as A, but without git's stderr (class message only). This is safer and shorter, but upstream always shows the stderr and the unclassified classes would then say nothing.
- C: keep Pi's placeholder text and add only upstream's remedy sentences.

**Q2. How does Pi adapt text that names Claude Code?**

The affected phrases:

- `Claude Code runs this clone with terminal prompts…`
- `Run with --debug to see the full command.`
- `/plugin` UI `Install git and restart Claude Code.` (already dropped by D-SG-07)
- the plugin remedy `Then install again.`, which Pi also shows on update and reinstall

The options:

- A (recommended): change the product name only ("pi-claude-marketplace runs this clone…"), and replace `--debug` with `set PI_CLAUDE_MARKETPLACE_DEBUG=1`. Keep everything else verbatim, `gh auth login` and `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` included.
- B: drop the sentences that name Claude Code.
- C: keep them verbatim. This is false in Pi.

**Q3. HTTPS auth wording, the D-1-02 hint, and WR-02.**

Upstream has one message for every HTTPS auth failure: rejected, no credential, or a bare 401/403. It points to the credential helper (`gh auth login` for GitHub) and gives no `git credential approve` recipe. Pi has `rejected` (GAUTH-04 `<host> rejected the stored credential`) and `no-credential` with the D-1-02 printf recipe on the update paths. D-1-02 and D-79-03 are recorded decisions, but 05-CONTEXT deferred the auth-hint wording to Phase 6 "following upstream". The options:

- A (recommended): upstream's single message for both details. Retire the D-1-02 recipe and the GAUTH-04 text from the cause line. Keep the `rejected`/`no-credential` detail internal (D-SG-26 still reads it). WR-02 then has no user-visible effect, so keep it as is.
- B: upstream's message, plus the D-1-02 recipe for `no-credential`.
- C: keep Pi's texts. WR-02 stays.

**Q4. Classes upstream has no message for.**

These are dubious ownership, git too old, protocol refused, not a repository, commit or ref missing, and the plugin-side classes. The roadmap expects "the dubious-ownership message", but upstream shows only git's raw stderr there. The options:

- A (recommended): follow upstream. Show the surface wrapper plus git's redacted stderr. The kind only picks the reason token.
- B: add Pi-written remedies for the Pi-only kinds (for example `safe.directory`, or "needs git 2.25 or later" per D-SG-06). This is a divergence that needs a decision ID.
- C: A, plus a remedy for dubious ownership only.

## Already decided (not questions)

- The closed reason set and one classifier ladder: D-PL7-01, D-PL7-02 (404 is `source missing` on add and install, `network error` on refresh, UPD-11), D-PL7-11.
- `{git missing}` token, and its cause texts: the macOS xcode text verbatim; elsewhere `Git is required to install marketplaces.` with no restart hint (D-SG-07, D-SG-04, NFR-2). The Windows `Command 'git' not found or is in an unsafe location` text is the generic safe-spawn message, and D-SG-07 chose otherwise (02-CONTEXT correction). Reopen only if the user wants to.
- Timeout maps to `{network unreachable}`, and `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` is read as upstream reads it (D-SG-13, `GIT_FAILURE_ANSWERS`).
- No telemetry buckets (IL-4). English only (IL-1). All output goes through `notify()` (IL-2).
- Transport notes and both-failed wrappers are verbatim; their placement is settled (D-SG-22, OQ-8: the last attempt decides the reason).
- A refresh that fails on one attempt reports the freshness `ls-remote` failure (D-SG-26).
- Validator refusals and the capital-letter ref refusal are upstream text (D-SG-17, SG-TRN-02).
- No proxy class, because Pi has no remote-session proxy (D-SG-24).
- The Device Flow is gone (D-SG-27), so no sign-in remedy is shown.
- Non-interactive git (D-SG-05) makes upstream's "terminal prompts … turned off" sentence true for Pi.

## 4. What Claude can decide alone

- Where the kind-to-text mapping lives. `shared/git-failure-classifiers.ts`, or a sibling module that the GitCommandError consumers read. `GitCommandError.message` itself, if `stderr` stays out of it.
- Upstream trigger precedence and fidelity. For example, a `timed out` text inside stderr hits the network class, not the timeout class. `/40[13]/` after SHA removal: Pi keeps its own anchored kinds and applies upstream's *wording* per kind.
- `<host>` derivation: scp form only for the host-key messages, and `GitHub` vs host vs `your git host` through `gitHubAddressOf` and the base override.
- Seconds rounding (`Math.round(ms/1000)`).
- The redaction pipeline for any shown stderr: URL spellings, then `redactCredentials`, then `redactAbsolutePaths`. Widening `redactCredentials` to query and fragment tokens, `glpat-`, and Basic auth.
- Central redaction inside `hookDebugLog` for every `[git]`/`[install]` line, plus fixes for the raw `subject`/`plan.first.url` lines.
- Rendering a multi-line cause inside the `cause:` line and the JSON wire. This is additive: the strings change and the schema stays the same.
- Applying the plugin wording to update, reinstall, and dependency moves (D-SG-19 surfaces).
- One cucumber scenario per kept class across add, update, and plugin install, plus the cascade consistency checks for apply, import, and autoupdate (success criterion 2).
- Doc and catalog updates (`docs/messaging-style-guide.md`) and a CHANGELOG line.
