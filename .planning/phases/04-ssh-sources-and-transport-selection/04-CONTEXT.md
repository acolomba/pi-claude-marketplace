# Phase 4: SSH Sources and Transport Selection - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A user who authenticates git over SSH can add a marketplace or install a
plugin from an SSH address, and `owner/repo` (GitHub) sources pick SSH or
HTTPS the way Claude Code's shell `claude plugin install` does (issue #325).
The phase ports upstream's git address validator (`iTs`) and the scp arm of
the `marketplace add` parser, the SSH probe (`ssh -T`), the probe skip
checks, the HTTPS/SSH retry, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, the Windows
SSH-to-HTTPS retry, and the GitHub identity fold (`Ort`) for origins and
sources. The requirements are SG-SSH-01 through SG-SSH-06.

Not in this phase: the fate of Device Flow and credential wording (Phase 5),
the final wording of the retry and both-failed messages (Phase 6; this phase
owns the outcome kinds), submodules and marketplace SHA pins (Phase 7), and
hosted `.json` catalogs, which stay https-only.

</domain>

<decisions>
## Implementation Decisions

The upstream evidence (Claude Code 2.1.332 binary, checked against 2.1.330,
grepped 2026-11-25, never run; git 2.43.0 experiments on `file://` and an ssh
stand-in; no `ssh` binary in the sandbox) is in `04-EVIDENCE.md` in this
directory. Each decision cites its record. Decisions with a `D-SG-NN` ID land
in PROJECT.md Key Decisions under that ID.

### Asked (maintainer answered 2026-11-25)
- D-SG-17 (Q6, amends D-76-01 and D-PL5-04/05/33; SG-SSH-01): git addresses follow upstream's validator. Every git address (a plugin `url` object's `url` and `raw`, the git-subdir object `url`, and a marketplace git address) goes through a port of `iTs` with its messages: `https`, `http`, `ssh`, `git+ssh`, `ssh+git`, scp `user@host:path`, and host-less `file:` are accepted; `git://` is refused. `http://` is accepted for git sources (parity, maintainer choice), and hosted `.json` catalogs stay https-only (D-PL5-36 stands). The git-subdir `url` gate closes security finding F-2 as upstream does (`ext::` refused at parse, not only by git's protocol ban). D-SG-05's protocol bans stay as the second layer. — **Reversibility:** costly — it widens a recorded input contract; narrowing it later refuses sources users have recorded.
- D-SG-18 (Q7, SG-SSH-04): `/claude:plugin install`, `apply`, and the import cascade follow the shell `claude plugin install`, not in-session `/plugin`. Off Windows, a `github` plugin source goes HTTPS first only when every skip check passes (no `GIT_SSH_COMMAND` or `GIT_SSH` in the user's environment, no `core.sshCommand`, `git ls-remote --get-url` returns the SSH URL unchanged, `ssh -G` shows a direct github.com hop or ssh is absent) and the probe says `not-configured`; then it retries over SSH. Otherwise it goes SSH only. Required and optional dependency installs and bare-name retries inherit the command's context, as upstream's do. The skip checks read the user's values, never Pi's own `-c` pairs or wrapper (D-SG-05, D-SG-16). — **Reversibility:** costly — it fixes which users clone over which transport; switching to SSH only later breaks installs for users with no key.
- D-SG-19 (Q7, divergence, no upstream license other than this decision): `plugin update`, `reinstall`, and dependency moves of a `github` plugin follow the same probe and fallback as install. Upstream's `updatePluginOp` and dependency repair clone over SSH only; following install keeps today's working HTTPS updates for users with no SSH key. Extended 2026-11-25 (maintainer, after plan check): `enable`, which re-clones a git plugin whose clone is gone, follows the same rules; upstream's enable is SSH only. — **Reversibility:** costly — going to SSH only later turns working updates into failures for users with no key.
- D-SG-20 (Q7, parity): release-tag reads for constrained dependencies (D-SG-09 and D-03-03's dependency tag list) and `git-subdir` `owner/repo` shorthand use SSH by default, as upstream's `zmt` does, unless `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` (or the base override, D-SG-21) forces HTTPS. Accepted consequence: for a user with no SSH key, a constrained install's tag read fails and the install uses the marketplace's current copy (the TAGS-02 fallback) instead of pinning the tag. Amended 2026-11-25 (maintainer, after plan check): for a constrained dependency whose source is a `github` repository, a failed SSH tag listing is retried once over HTTPS before it counts as failed, so a no-key user's install still pins the tag (a small divergence from upstream's `zmt`). — **Reversibility:** costly — changes which version a constrained install picks for no-key users.
- D-SG-21 (Q18 base override, refines D-MF-01 and D-SG-16; new feature, no upstream analogue): while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, every GitHub address form reaches the base. Besides `url.<base>/.insteadOf=https://github.com/`, every remote command carries `insteadOf` pairs for `git@github.com:`, `ssh://git@github.com/`, and the other SSH spellings the identity fold covers, so an SSH-first clone, a tag read, and an SSH fallback all go to the base over its own scheme. The probe does not run while the variable is set (it would contact the real github.com, and every form reaches the base anyway); this last point was decided by the orchestrator to fit the answer, see the log. — **Reversibility:** costly — it defines what the override variable covers; users of a mirror may come to depend on SSH forms being rewritten.
- D-SG-22 (progress lines, maintainer choice): every GitHub clone's final notification names the transport it used (upstream's `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`, `SSH not configured, cloning via HTTPS: <url>`), including a plain success, plus the retry line (`<T> clone failed, retrying with <T2>: <url>`) and the both-failed error when they apply. Upstream shows the transport line only as transient progress; Pi has no live progress line, so the maintainer chose to show it in the final output. This phase owns the outcome kinds and the note's placement; Phase 6 settles the wording. — **Reversibility:** costly — it is user-visible output that tests and users read.
- D-SG-23 (SG-SSH-06, parity, supersedes D-3-01's exact compare): GitHub `owner/repo` identity is folded to lower case, with upstream's `Ort` fold (scp, `ssh://`, `git+ssh://`, `ssh.github.com`, `http(s)://`, `git://`, `git+http(s)://`, `.git` stripped). `Owner/Repo` and `owner/repo` become one source. Closes review item IN-05. — **Reversibility:** one-way — once two recorded spellings merge into one source, splitting them back is not possible from the record alone.

### Decided autonomously
- [Address forms] Q: "Does `marketplace add ssh://...` (and `git+ssh://`, `ssh+git://`) parse on the add command line?" → Selected: "No, as upstream: the add parser accepts scp `git@host:path[#ref]` and `http(s)://...git` as git sources and refuses the URL-scheme SSH forms with upstream's `Invalid marketplace source format. Try: owner/repo, https://..., or ./path`. Those forms still reach Pi through config and manifest entries, where the validator accepts them." — reversible technical: parity default; accepting them later only widens the parser.
- [Address forms] Q: "Is `git://` accepted?" → Selected: "Refused, as upstream ('isn't supported because it isn't encrypted'); the network lane already bans it." — reversible technical: parity, no recorded user of it.
- [Probe] Q: "What is the probe?" → Selected: "Upstream's exact launch from `platform/git-process.ts` (D-SG-01's spawn site, no new `NETWORK_SEAMS` member): `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`, a fixed 3000 ms timeout, Pi's neutral directory as cwd (upstream uses the home directory; invisible), `configured` on exit 1 with 'successfully authenticated', `unknown` on timeout or other output, `not-configured` on exit 255 with the publickey or host-key text or when ssh is missing. Not `git ls-remote`, which proves something else." — reversible technical: an internal launch with upstream's observable result.
- [Probe] Q: "Is the probe result cached?" → Selected: "As upstream: no cache across commands; the plugin install path probes once per command; the marketplace path probes on every GitHub clone and freshness list (an `apply` adding several GitHub marketplaces probes each time)." — reversible technical: a memo can be added later with no visible change.
- [Variables] Q: "How is `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` read, and is `CLAUDE_CODE_REMOTE` read?" → Selected: "`CLAUDE_CODE_PLUGIN_PREFER_HTTPS` by its upstream name with D-SG-15's boolean reader (`1`/`true`/`yes`/`on`); when true every GitHub address (marketplace add, refresh, freshness list, plugin clones, git-subdir shorthand, tag listings) uses HTTPS and no probe runs. `CLAUDE_CODE_REMOTE` is not read: capability gap, Pi has no Claude Code remote-session git proxy and the variable describes the session around Pi (SG-SSH-03). Recorded as D-SG-24." — reversible technical: one variable read; the gap is the license.
- [Windows] Q: "Is the Windows SSH-to-HTTPS retry in scope (Q21)?" → Selected: "Yes. REQUIREMENTS records the maintainer's 2026-11-22 choice that optional items are in scope, and D-SG-18 picks the shell install surface that carries it: Windows installs of `github` plugins go SSH first with no probe; a publickey or host-key clone failure with the skip checks passing (including the `ssh -G` check through `GIT_SSH_COMMAND='<cmd> -G >&2'` on `git ls-remote`) tries HTTPS, then SSH. Unit rows against a fake platform plus a `[system-git]` Windows `unrun-verify` entry." — reversible technical: one platform branch with unit rows.
- [Identity] Q: "Where does the identity fold apply (SG-SSH-06)?" → Selected: "Port `Ort` into `domain/clone-key.ts`; use it in `originMatchesSource`, in the origin parse of `deriveMarketplaceUrl`, and in `hostFromCloneUrl` (made scp-safe); `swapCloneUrl` takes the URL list from the declared source (probe-ordered) instead of the recorded origin; `canonicalCloneUrl` is unchanged, so no `plugin-clones/<key>/` directory moves." — reversible technical: internal matching; directory keys stay put.
- [Network policy] Q: "What does NFR-5 say about the probe?" → Selected: "Amend the NFR-5 text to name the probe (TCP 22) and the HTTPS/SSH retry; both run only inside commands that NFR-5 already lets reach GitHub, never in `list`, `info`, or a load without autoapply. The skip checks are local and run on the local lane. Mirror the text in AGENTS.md." — reversible technical: a text amendment matching the code.
- [Harness] Q: "How do cucumber scenarios exercise SSH with no ssh binary?" → Selected: "A stub `ssh` first on Pi's PATH (a `GIT_SSH_COMMAND` stub would trip the plugin skip rule), serving the probe's three outcomes and an SSH transport to the loopback git host; no request leaves the machine." — reversible technical: test harness only.

### Claude's Discretion
- How the SSH stand-in carries git traffic (a stub that runs `git-upload-pack` on a local bare repository, or a loopback sshd stand-in), as long as no request leaves the machine and the probe's three outcomes are pinned.
- How the transport note sits in the notification (a note row under the marketplace or plugin row, or a cause-style line), within D-SG-22.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/git-process.ts`: the one spawn site, with the hardened environment, the local and network lanes, and the protocol allow list; the probe and the `ssh -G` check launch from here.
- `shared/github-base-url.ts`: builds the D-SG-16 `insteadOf` pair; D-SG-21 adds the SSH-form pairs here.
- D-SG-15's boolean reader for `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, reused for `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`.
- `domain/source.ts` (`gatedUrlField`, `refRefusal`) and `orchestrators/marketplace/add.ts` (`parseAddableSource`): where the validator and the scp add arm land.
- `domain/clone-key.ts` (`canonicalCloneUrl`): stays fixed; the `Ort` fold goes beside it.

### Established Patterns
- Typed failure kinds from `platform/git-failure-kind.ts` (publickey and host-key failures need kinds for the retry rules); wording waits for Phase 6.
- Every remote command goes through `runRemote` in `platform/git.ts`; transport choice wraps it, it does not bypass it.
- Scenarios pin request rows on the loopback git host and its CONNECT proxy; an SSH stand-in follows the same pattern.

### Integration Points
- `orchestrators/plugin/clone-cache.ts` (plugin clones and mirrors), `orchestrators/marketplace/{add,update,clone-swap}.ts` (marketplace clone, freshness list, swap URL), `orchestrators/plugin/{marketplace-tag-probe,dependency-tag-probe}.ts` (tag reads, D-SG-20), the install cascade and update runner (D-SG-18, D-SG-19).
- The stale-clone recognizer (`originMatchesSource`) and `deriveMarketplaceUrl`, which today reject scp origins (`04-EVIDENCE.md` SG-SSH-06).

</code_context>

<specifics>
## Specific Ideas

- Upstream strings to reproduce come from `04-EVIDENCE.md`: the validator messages, `Invalid marketplace source format. Try: owner/repo, https://..., or ./path`, the four progress lines, `Fetching the marketplace from GitHub failed on both attempts. ...`, and the plugin install's `The retry over SSH failed too: ...`.
- 2.1.332 adds optional plugin dependencies (flag `tengu_melodic_honey`); a shell install passes its HTTPS fallback to them. Pi has no optional dependencies yet, so only required dependencies and bare-name retries inherit today.

</specifics>

<deferred>
## Deferred Ideas

- Memoizing the marketplace probe once per command (an invisible divergence with no license; revisit if the cost shows).
- Optional plugin dependencies (new in Claude Code 2.1.332), a separate capability.

</deferred>
