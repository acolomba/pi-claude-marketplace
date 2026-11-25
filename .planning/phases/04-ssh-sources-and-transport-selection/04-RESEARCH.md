# Phase 4: SSH Sources and Transport Selection - Research

**Researched:** 2026-11-25
**Domain:** git address validation, GitHub transport selection (SSH probe, HTTPS/SSH fallback), source identity, cucumber SSH stand-in
**Confidence:** HIGH for the code paths and the upstream contract; MEDIUM for the threading design and the scenario blast radius; LOW for real ssh output and Windows behavior (no ssh binary, no Windows host)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The upstream evidence (Claude Code 2.1.332 binary, checked against 2.1.330,
grepped 2026-11-25, never run; git 2.43.0 experiments on `file://` and an ssh
stand-in; no `ssh` binary in the sandbox) is in `04-EVIDENCE.md` in this
directory. Each decision cites its record. Decisions with a `D-SG-NN` ID land
in PROJECT.md Key Decisions under that ID.

#### Asked (maintainer answered 2026-11-25)
- D-SG-17 (Q6, amends D-76-01 and D-PL5-04/05/33; SG-SSH-01): git addresses follow upstream's validator. Every git address (a plugin `url` object's `url` and `raw`, the git-subdir object `url`, and a marketplace git address) goes through a port of `iTs` with its messages: `https`, `http`, `ssh`, `git+ssh`, `ssh+git`, scp `user@host:path`, and host-less `file:` are accepted; `git://` is refused. `http://` is accepted for git sources (parity, maintainer choice), and hosted `.json` catalogs stay https-only (D-PL5-36 stands). The git-subdir `url` gate closes security finding F-2 as upstream does (`ext::` refused at parse, not only by git's protocol ban). D-SG-05's protocol bans stay as the second layer. — **Reversibility:** costly — it widens a recorded input contract; narrowing it later refuses sources users have recorded.
- D-SG-18 (Q7, SG-SSH-04): `/claude:plugin install`, `apply`, and the import cascade follow the shell `claude plugin install`, not in-session `/plugin`. Off Windows, a `github` plugin source goes HTTPS first only when every skip check passes (no `GIT_SSH_COMMAND` or `GIT_SSH` in the user's environment, no `core.sshCommand`, `git ls-remote --get-url` returns the SSH URL unchanged, `ssh -G` shows a direct github.com hop or ssh is absent) and the probe says `not-configured`; then it retries over SSH. Otherwise it goes SSH only. Required and optional dependency installs and bare-name retries inherit the command's context, as upstream's do. The skip checks read the user's values, never Pi's own `-c` pairs or wrapper (D-SG-05, D-SG-16). — **Reversibility:** costly — it fixes which users clone over which transport; switching to SSH only later breaks installs for users with no key.
- D-SG-19 (Q7, divergence, no upstream license other than this decision): `plugin update`, `reinstall`, and dependency moves of a `github` plugin follow the same probe and fallback as install. Upstream's `updatePluginOp` and dependency repair clone over SSH only; following install keeps today's working HTTPS updates for users with no SSH key. — **Reversibility:** costly — going to SSH only later turns working updates into failures for users with no key.
- D-SG-20 (Q7, parity): release-tag reads for constrained dependencies (D-SG-09 and D-03-03's dependency tag list) and `git-subdir` `owner/repo` shorthand use SSH by default, as upstream's `zmt` does, unless `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` (or the base override, D-SG-21) forces HTTPS. Accepted consequence: for a user with no SSH key, a constrained install's tag read fails and the install uses the marketplace's current copy (the TAGS-02 fallback) instead of pinning the tag. — **Reversibility:** costly — changes which version a constrained install picks for no-key users.
- D-SG-21 (Q18 base override, refines D-MF-01 and D-SG-16; new feature, no upstream analogue): while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, every GitHub address form reaches the base. Besides `url.<base>/.insteadOf=https://github.com/`, every remote command carries `insteadOf` pairs for `git@github.com:`, `ssh://git@github.com/`, and the other SSH spellings the identity fold covers, so an SSH-first clone, a tag read, and an SSH fallback all go to the base over its own scheme. The probe does not run while the variable is set (it would contact the real github.com, and every form reaches the base anyway); this last point was decided by the orchestrator to fit the answer, see the log. — **Reversibility:** costly — it defines what the override variable covers; users of a mirror may come to depend on SSH forms being rewritten.
- D-SG-22 (progress lines, maintainer choice): every GitHub clone's final notification names the transport it used (upstream's `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`, `SSH not configured, cloning via HTTPS: <url>`), including a plain success, plus the retry line (`<T> clone failed, retrying with <T2>: <url>`) and the both-failed error when they apply. Upstream shows the transport line only as transient progress; Pi has no live progress line, so the maintainer chose to show it in the final output. This phase owns the outcome kinds and the note's placement; Phase 6 settles the wording. — **Reversibility:** costly — it is user-visible output that tests and users read.
- D-SG-23 (SG-SSH-06, parity, supersedes D-3-01's exact compare): GitHub `owner/repo` identity is folded to lower case, with upstream's `Ort` fold (scp, `ssh://`, `git+ssh://`, `ssh.github.com`, `http(s)://`, `git://`, `git+http(s)://`, `.git` stripped). `Owner/Repo` and `owner/repo` become one source. Closes review item IN-05. — **Reversibility:** one-way — once two recorded spellings merge into one source, splitting them back is not possible from the record alone.

#### Decided autonomously
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

### Deferred Ideas (OUT OF SCOPE)
- Memoizing the marketplace probe once per command (an invisible divergence with no license; revisit if the cost shows).
- Optional plugin dependencies (new in Claude Code 2.1.332), a separate capability.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SG-SSH-01 | Add a marketplace or install a plugin from `git@host:path`, `ssh://`, `git+ssh://`, `ssh+git://`; upstream's validator; `git://` refused; `http://` and the git-subdir `url` per discuss | §A1 (`domain/source.ts` arms), §P1 (iTs port, full source in §Code Examples), §A2 (add parser split: command line vs config), §S (stand-in serves `git@127.0.0.1:` today) |
| SG-SSH-02 | `owner/repo` marketplace: probe, SSH first only on `configured`, retry with the other transport, upstream's progress lines and both-failed error | §P3 (probe launch), §P4 (transport plan + fallback runner), §A3 (add, clone-swap, update touch points), §N (notification placement) |
| SG-SSH-03 | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` forces HTTPS with no probe; `CLAUDE_CODE_REMOTE` not read | §P5 (shared boolean reader, short-circuit order), §S (scenario needs a no-base-override Pi plus the variable) |
| SG-SSH-04 | `github` plugin source on install, update, dependency install: probe, fallback, skip rules of the shell install | §P4 (skip-check order verified in `Qmt`), §T (threading map: `buildInstallLedgerOptions`, update preflight, reinstall, dependency moves, import, apply) |
| SG-SSH-05 | Windows SSH-to-HTTPS retry | §W (Windows branch, `-G` check runs on the network lane, failure-kind detail needed), unit rows with `platform: "win32"` |
| SG-SSH-06 | An SSH clone is the same source as its HTTPS form; no stale-clone refusal; `plugin-clones/<key>/` does not move | §P2 (Ort port, verbatim upstream source), §A4 (`originMatchesSource`, `samePlannedSource`, `deriveMarketplaceUrl`, reserved names, `hostFromCloneUrl`), §R (no state migration) |
</phase_requirements>

## Project Constraints (from AGENTS.md and the included codebase maps)

These bind every plan. Each one is quoted from AGENTS.md or the included maps [VERIFIED: AGENTS.md, .planning/codebase/*.md, read this session].

- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. "Our way is simpler" is not a license. D-SG-19, D-SG-21 and D-SG-22 are the licensed divergences of this phase.
- NFR-5: `list`, `info`, `uninstall`, `marketplace remove`, and a load without `autoapply` MUST NOT touch the network. The probe and the retry need an NFR-5 text amendment, mirrored in AGENTS.md.
- NFR-10: no write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `mcp-adapter.json`, `mcp.json`. ssh `known_hosts` writes are the user's own (D-SG-03).
- NFR-1: atomic writes. NFR-2: no fix needs a Pi restart. NFR-3: retry-safe.
- NFR-6: `npm run check` stays green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, two cycle runs, health with `maxCognitive: 15`/`maxCyclomatic: 20`, dupes, rule pack), Prettier, source/test pairing, unit, integration, cucumber under both profiles, 100% direct coverage for every source-test pair.
- IL-2: output only through `shared/notification-dispatch.ts`. No `process.stdout`/`process.stderr`. IL-4: no telemetry. IL-1: English only.
- D-SG-01: every child process starts from a module the `child-process-chokepoint` rule names. `platform/git-process.ts` is already one, and its header reserves the ssh probe for it.
- Typed errors: `extends Error`, `this.name`, typed readonly fields, callers narrow on `instanceof`, never on a message substring (SG-PRC-05).
- Comments and test titles cite durable IDs (`D-SG-NN`, `SG-SSH-NN`), never `Phase N`/`Plan N`.
- A user-visible change ships with a cucumber scenario that fails without it. Unit tests and coverage do not replace it.
- GSD records: every plan `SUMMARY.md` has `## Threat Flags`. `gsd-tools windows append --description` starts with `[system-git]`.
- Git: never commit to `main`; never rebase; never `--no-verify`.
- No `.planning/` file reaches the lint, so `.planning/` edits are build-input-free; `features/`, `extensions/`, `test/`, `eslint.config.js`, `.fallowrc.json`, `rule-packs/` are build inputs.

## Summary

The phase has three parts, and they meet only at a few seams. First, the domain learns new address forms: a port of upstream's git URL validator (`iTs`) gates every git address, the source parser gains an scp arm and an `http://` git arm, and the add command line keeps refusing the URL-scheme SSH forms that config and manifests may carry. Second, GitHub sources learn to pick a transport: an `ssh -T` probe launched from `platform/git-process.ts`, upstream's skip checks, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, the base override's SSH pairs, an HTTPS/SSH fallback around the clone step, and a transport note on the final notification. Third, identity folds GitHub spellings with upstream's `Ort`, so SSH and HTTPS forms of one repository are one source, without moving any clone directory.

The repository is well prepared. The SSH stand-in that the cucumber suite needs already exists from Phase 1 (`features/lib/ssh-git-host/`): it is first on every Pi's PATH, scripts the three probe answers plus a `hold` arm, prints `ssh -G` config with an optional proxy line, serves `git-upload-pack` from the https git host's repositories, and logs every launch with its argv. No step definition uses it yet. Pi's ssh hardening, the neutral directory, and the network and local lanes are in place, and `ls-remote --get-url` works on the local lane. The real work is the threading: Pi's GitHub plugin clone is not one `git clone` but a mirror clone or freshness `ls-remote` plus re-clone, or a pin ladder, so the fallback has to wrap the clone step of each, and one per-command probe memo has to reach every install, apply, import, update, reinstall, fetch, and dependency-move path. The `authMemo` already travels exactly this route, so a sibling `gitHubTransport` context can follow it.

Two findings change the plan shape. One: upstream probes only `owner/repo` sources. A GitHub URL typed as `https://github.com/o/r` or `git@github.com:o/r.git` is a `git` source upstream and clones as written with no probe (verified in `$Ce` and `Rqo`). Pi folds `https://github.com/...` into the `github` kind (D-76-02), so the transport rule must key on the declared spelling (`raw`), not on `kind === "github"`, or Pi probes where upstream does not. Two: the shared Pi of the cucumber run always has the base override set, and with the override the probe never runs. So existing request tables do not change (an SSH URL rewritten to the https base sends the same requests), but every scenario that clones a GitHub source gains the D-SG-22 transport note. Field tables are exhaustive (`namesLike` adds unstated fields), so about 129 scenarios that mention `github` are candidates for a rebaseline in the same wave as the note.

**Primary recommendation:** Build the phase bottom-up in four layers. Use pure domain modules for the validator, the `Ort` fold, and the transport plan. Put the ssh and `--get-url` launches in `platform/git-process.ts` and `platform/git.ts`, behind a new port. Thread a `gitHubTransport` context beside `authMemo` and apply the fallback inside the existing seams (`clone-cache.ts`, `add.ts`, `clone-swap.ts`, the tag probes). Last, rebaseline the scenarios. Key the probe on the `owner/repo` spelling, and treat the base override like `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` for ordering.

## Architectural Responsibility Map

The tiers here are this extension's layers, not browser and server tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Git address validation (`iTs` port) | domain (`domain/git-url.ts`, new) | domain/source.ts arms | Pure string rules; domain may import only `shared` (fallow zone) [VERIFIED: .planning/codebase/ARCHITECTURE.md] |
| Add command-line form (`$Ce` scp arm, `ssh://` refusal) | orchestrators/marketplace/add.ts (`parseAddableSource`) | edge/handlers/marketplace/add.ts passes the origin flag | `apply`, import, and the D-MF-04 project add call the same orchestrator with config strings, which must accept the wider forms |
| GitHub identity fold (`Ort`) | domain/clone-key.ts | shared/github-base-url.ts (host literals) | CONTEXT locates it there; the `no-github-literal` rule keeps `github.com` literals in `shared/github-base-url.ts` |
| Transport plan (which URLs, which order, which note) | domain (`domain/github-transport.ts`, new, pure) | — | A pure function of the spelling, the variables, the platform, and the probe and check results; unit-testable with no doubles |
| SSH probe, `ssh -G`, `ls-remote --get-url`, user ssh override | platform/git-process.ts (spawn) + platform/git.ts (verbs) | orchestrators/marketplace/shared.ts (default binding) | D-SG-01 spawn site; BLOCK C lets only `git.ts` and `git-credential.ts` import `git-process.ts` |
| Fallback runner (attempt, clear, retry, both-failed) | orchestrators seams: plugin/clone-cache.ts, marketplace/add.ts, marketplace/clone-swap.ts | a small non-seam helper `orchestrators/github-transport.ts` that takes closures | The seams already name `gitOps`; the helper names no git surface, so BLOCK F allows it |
| Per-command probe memo and notes | orchestrators command roots (install-flow, apply, import, update-flow, reinstall-flow, fetch, info) | threaded like `authMemo` | Upstream memoizes per CLI install (`probeSsh:()=>n??=Jxn()`) |
| Base override SSH pairs (D-SG-21) | shared/github-base-url.ts | platform/git.ts `runRemote`, `fetchCommit` | The module already builds the D-SG-16 pair and holds the only `github.com` literals |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` reader | shared (new small module, or move `keepMarketplaceOnFailure`'s reader) | — | The planner must check whether the reader lands in two places, because fallow `dupes` fails on every clone group |
| Transport note, retry line, both-failed outcome | shared/notification-types.ts, -wire.ts, -json.ts, -grammar.ts | orchestrators composers | Closed wire schema (`additionalProperties: false`, WIRE-03 enrollment) |
| SSH stand-in and steps | features/lib/ssh-git-host (exists), features/step_definitions/git-host.steps.ts | features/support/world.ts | Pi fixes PATH at start; the stand-in already lives in `PiRun` |

## Standard Stack

### Core

No new runtime dependency. Every capability uses what the tree already has [VERIFIED: package.json, .planning/codebase/STACK.md].

| Component | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| System git | 2.43.0 in the sandbox; README documents ≥2.25 (D-SG-06) | clone, `ls-remote`, `ls-remote --get-url`, the `-G` check | D-SG-01: the only transport |
| The user's OpenSSH `ssh` | user-supplied; absent in the sandbox | probe `ssh -T`, `ssh -G` | Upstream launches `ssh` from PATH (`vt("ssh",...)`) [VERIFIED: binary grep, `Jxn`/`Qmt` quoted in §Code Examples] |
| `node:child_process` via `platform/process-run.ts` | Node 24.22.3 | the one launcher | `child-process-chokepoint` sanctions `platform/git-process.ts` |
| `typebox` | ^1.1.38 | wire schema for the new note | existing closed wire schema |
| `@cucumber/cucumber` + the SSH stand-in | existing | behavioral scenarios | Phase 1 SG-HRN-03 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ssh -T git@github.com` probe | `git ls-remote git@github.com:o/r.git` | Proves repository access through the user's git ssh settings and `insteadOf`, costs a full session plus ref advertisement, and changes which users go SSH first. Upstream uses `ssh -T` and keeps the git-side concerns in the skip checks (04-EVIDENCE Q18). Locked by CONTEXT. |
| A `GIT_SSH_COMMAND` stub in cucumber | stub `ssh` first on PATH | A `GIT_SSH_COMMAND` in Pi's environment trips the D-SG-18 skip rule, so the probe path could never be tested. Locked by CONTEXT; the PATH stub already exists. |
| A real loopback sshd | the existing stub | Needs an ssh binary, keys, and a port; the stub already serves upload-pack and records argv |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed in this phase. The probe uses the user's own `ssh`, and git is already a system requirement.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 user command / config / manifest entry
          │
          ▼
 ┌──────────────────────────┐   refuses: git://, ext::, control chars, %00, brackets,
 │ address gate             │   scp with ://, file: with host, bad ssh host/user
 │ domain/git-url.ts (iTs)  │   add command line additionally refuses ssh://, git+ssh://,
 │ + source.ts arms         │   ssh+git:// ("Invalid marketplace source format...")
 └───────────┬──────────────┘
             │ ParsedSource (github | url | git-subdir | ...)
             ▼
 ┌──────────────────────────┐   identity only: originMatchesSource, samePlannedSource,
 │ Ort fold (clone-key.ts)  │   reserved names, deriveMarketplaceUrl, hostFromCloneUrl
 └───────────┬──────────────┘   (canonicalCloneUrl unchanged → keys do not move)
             │
             ▼  is the source an owner/repo spelling? ──no──► one attempt, URL as written
             │ yes
             ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ transport plan (domain/github-transport.ts, pure)            │
 │  1 PREFER_HTTPS true ─────────────► [https]  note "via HTTPS"│
 │  2 base override set ─────────────► [https]  (decision OQ-2) │
 │  3 marketplace path: probe==configured ? [ssh,https] : [https,ssh]
 │  4 plugin path, off Windows: skip checks + probe ─► [https,ssh] or [ssh]
 │  5 plugin path, Windows: [ssh] then, on publickey/host-key + checks, [https,ssh]
 │  6 tag reads, git-subdir shorthand: [ssh] (D-SG-20), [https] under 1 or 2
 └───────────┬──────────────────────────────────────────────────┘
             │ inputs from the per-command context (probe memo) and platform ops:
             │   ssh -T probe (network, TCP 22), ssh -G, ls-remote --get-url (local lane),
             │   user GIT_SSH_COMMAND/GIT_SSH/core.sshCommand
             ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ fallback runner around the CLONE STEP of each seam           │
 │  marketplace add (stage), clone-swap freshness + re-clone,   │
 │  plugin mirror clone/refresh, pin-ladder clone (not fetch)    │
 │  attempt url1 ─fail→ clear staging → note "T1 failed,        │
 │  retrying with T2" → attempt url2 ─fail→ both-failed error    │
 └───────────┬──────────────────────────────────────────────────┘
             │ platform/git.ts runRemote (network lane, D-SG-13 limit, abort,
             │ D-SG-16 + D-SG-21 insteadOf pairs, D-SG-14 Device Flow retry inside)
             ▼
        system git ──► https host / ssh (user's ssh, BatchMode, StrictHostKeyChecking=yes)
             │
             ▼
 notes collected on the context ─► composer adds them to the row ─► notify() (IL-2)
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── git-url.ts            # NEW: iTs port; returns a refusal reason or undefined
│   ├── github-transport.ts   # NEW: pure transport plan + note kinds
│   ├── clone-key.ts          # + gitHubRepoOf (Ort), folded identity; canonicalCloneUrl unchanged
│   └── source.ts             # scp arm, http git arm, gated url/raw/git-subdir url
├── platform/
│   ├── git-process.ts        # + ssh launch (probe, -G), ssh lookup, user ssh override facts
│   └── git.ts                # + probeGitHubSsh, sshConfigShowsDirectGitHub, getUrl, sshGCheck (Windows)
├── shared/
│   ├── github-base-url.ts    # + SSH prefixes and their insteadOf pairs (D-SG-21)
│   └── <upstream-flag>.ts    # PREFER_HTTPS reader (or reuse the D-SG-15 reader, moved)
├── orchestrators/
│   ├── github-transport.ts   # NEW (not a seam): context type, runOverTransports(closures)
│   ├── marketplace/{add,clone-swap,update,shared}.ts
│   └── plugin/{clone-cache,install-*,update-*,reinstall-*,dependency-*,fetch,info,*-tag-probe}.ts
└── shared/notification-{types,wire,json,grammar}.ts   # transport note on rows
```

### A. Current code paths the decisions touch (file:line)

All line numbers come from files read this session on `features/system-git` [VERIFIED: Read/sed of each file, 2026-11-25].

**A1. `domain/source.ts`**
- `unsupportedUrlReason` 105-108 and `rejectedScheme` 110-124: the D-76-01 text `... is not supported; <scheme> URLs are rejected -- only https:// URLs and local paths are accepted`. This text goes away.
- `refRefusal` 161-163 (`Invalid ref "${ref}": cannot start with "-"`) and `shaRefusal` 149-153: they stay for every git kind.
- `gatedUrlField` 237-242 sends a url object's `url` and `raw` through `parseUrlSourceForm`; `urlObjectSource` 244-288 then requires `raw` to name the same identity as `url` (T-2-10). Here the iTs gate replaces the https-only gate.
- `gitSubdirObjectSource` 290-298 takes `url` verbatim: **F-2**. A git-subdir `owner/repo` shorthand today reaches `networkCloneUrl` as the bare string `owner/repo` (clone-key.ts 105-106), which git reads as a local path. Upstream maps it through `KHi` to SSH (or HTTPS under `PJt`).
- `parseUrlSourceForm` 490-506: the github arm first, then `https://` → `url`, then `raw.startsWith("git@") || raw.includes("://")` → unknown (501-503). The scp arm and the `http://` git arm go here, after the github arm and before the refusal.
- `parseHostedManifestForm` 450-473 is `https://` only. Keep it that way: `http://host/m.json` must stay refused (D-PL5-36).
- `parsePluginSource` 543-561: the arm order is load-bearing (paths, hosted, URL schemes, shorthand).
- `samePlannedSource` 857-893: the github arm compares owner, repo, and ref exactly (872-878), and `planned.kind !== current.kind` returns `different` (867). D-SG-23 changes both lines.

**A2. `orchestrators/marketplace/add.ts`**
- `parseAddableSource` 780-813 calls `parsePluginSource` and throws `UnsupportedSourceError` (`Cannot add marketplace from "<raw>": <reason>`) on `unknown`.
- The callers of `parseAddableSource` are the add guard (`runAddInGuard` 1094), the failure frame (`hostErrorFrame` 1410), and **`orchestrators/plugin/install-outcome.ts:651`**, the D-MF-04 project add of a user-scope record's `raw`. `apply` reaches it through `addMarketplace` with the config string (`orchestrators/reconcile/apply.ts:327-332`), and import does the same through `orchestrators/import/execute.ts`.
- Finding: Pi's config holds a marketplace `source` as a **string** (`persistence/config-io.ts:46`, `source: Type.String()`), so config and command line share one funnel. To honor "refused on the add command line, accepted through config", `parseAddableSource` needs an origin flag (`commandLine: true` only from `edge/handlers/marketplace/add.ts`). The planner must not refuse `ssh://` inside `parsePluginSource` itself [VERIFIED: config-io.ts:46, apply.ts:327-332, install-outcome.ts:647-651].
- `gitStagingSteps` 920-951 clones `networkCloneUrl(source)` once (935-940). The marketplace probe, order, retry, and notes go here.
- `recognizeLeftover` 1732-1771 uses `originMatchesSource` (1744). D-SG-23 widens it.
- `cloneAuthFor` 1912-1916 calls `hostFromCloneUrl(source.url, "url")`, which **throws on an scp URL** (see A4).
- Import of upstream settings: `orchestrators/import/marketplaces.ts:40-67` maps only nested `url`, `github`, and `directory` kinds. An upstream `extraKnownMarketplaces` entry `{source:"git", url:"ssh://..."}` is unmappable today. Add a `git` case (`url` plus `#ref`) so that SSH marketplaces reach Pi through import, as D-SG-17 expects. [VERIFIED: import/marketplaces.ts:40-67]

**A3. Marketplace refresh**
- `clone-swap.ts:78-85` `swapCloneUrl` reuses the live checkout's recorded `origin`, else `networkCloneUrl(source)`. CONTEXT replaces this for github with the probe-ordered list. Unit test `test/orchestrators/marketplace/update.test.ts:1319` ("a refresh asks and clones the URL the checkout records as its origin", origin `https://github.com/anthropics/earlier-name.git`) and `clone-swap.test.ts:1142` pin the old rule and must flip. For a `url` kind, upstream's `Rqo` returns `[e.url]`; keeping the recorded-origin fallback for `url` only is a Pi choice (OQ-5).
- `CloneSwapArgs.url` (138) is one string; `checkFreshness` 232-259 and `cloneIntoStaging` 303-326 each use it once. Change it to `urls: readonly string[]`: freshness tries each URL in order until one answers (upstream `iIi` loops `Rqo`'s list), and the clone tries each in order. Callers: `orchestrators/marketplace/update.ts:552-571` (`refreshGitSource`), `orchestrators/plugin/update-flow.ts:297` (PUP-2 sync), and `orchestrators/plugin/clone-cache.ts:610-640` (`refreshMirrorBySwap`). All of them change in one commit (§Pitfall 9).
- `keepMarketplaceOnFailure` 98-110 holds the D-SG-15 reader: `TRUE_VALUES = new Set(["1", "true", "yes", "on"])`, trimmed and lower-cased. `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` uses the same rule (H.bool(), 04-EVIDENCE Q16). Extract it into one shared function so fallow `dupes` finds no clone.
- `update.ts:501-513` `refreshAuthFor` also calls `hostFromCloneUrl(source.url, "url")` (512).

**A4. Identity and hosts**
- `domain/clone-key.ts:86-88` `canonicalCloneUrl`: github → `${GITHUB_ORIGIN}/${owner}/${repo}`, else `source.url`. Keep it unchanged (CONTEXT).
- `clone-key.ts:99-108` `networkCloneUrl`: github → `ensureGitSuffix(canonicalCloneUrl(source))` (always HTTPS today); url → `stripSlashAndFragment(source.raw).base`; git-subdir → `stripSlashAndFragment(source.url).base`. The SSH candidate for a github source comes from a new function beside it, not from this one, because every current caller expects the HTTPS wire form.
- `clone-key.ts:121-131` `originMatchesSource` re-parses the origin with `parsePluginSource` and compares WHATWG `href`s; `normalizedIdentity` 134-136 returns undefined for a non-URL, so an scp origin never matches. Replace it with a `gitHubRepoOf` fold first, then the exact compare for non-GitHub URLs (upstream compares a non-GitHub `url` string exactly).
- `orchestrators/auth-host.ts:108-114` `hostFromCloneUrl`: `new URL(gitHubWireUrl(cloneUrl)).host` throws `TypeError` on `git@host:path`. Callers: `marketplace/add.ts:1915`, `marketplace/update.ts:512`, `plugin/update-flow.ts:274`, `plugin/update-preflight.ts:369`, and `auth-host.ts:292` (`buildCloneAuth`) [VERIFIED: grep plus Read of auth-host.ts:100-115]. An SSH request never uses a bundle (`platform/git.ts:310-317` `bundleOrigin` is https-only), so return the scp host, or skip the bundle for a non-https URL.
- `domain/name.ts:97-113` `reservedMarketplaceNameRefusal` accepts a reserved name only for `source.kind === "github" && owner === "anthropics"`. Upstream's `z4s` also accepts a `git` source whose url folds through `Ort` to `anthropics/…` (`oJt`, `jt`), so `git@github.com:anthropics/x.git` may use a reserved name upstream. The Pi rule must fold url kinds too [VERIFIED: binary grep, `z4s`/`oJt` quoted in §Code Examples; Read of name.ts:95-113].
- `orchestrators/plugin/clone-cache.ts:682-718` `readOriginRemoteUrl` (fs-only) and 726-750 `deriveMarketplaceUrl`: a path marketplace whose checkout origin is scp or `ssh://` parses `unknown`, so the D-SEED seeding is silently skipped. Fold through `Ort` there.
- `persistence/state-io.ts:512-520` `revalidateStoredUrlSource` and 539-548 `revalidateStoredStringSource` re-parse stored sources. Once the parser accepts the SSH forms, stored SSH records load. No migration is needed (§R).

**A5. Platform**
- `platform/git.ts:285-302` `runRemote` sets `config = gitHubInsteadOfPairs(remote.url)` and `wireUrl = gitHubWireUrl(remote.url)`. With D-SG-21 both must recognize the SSH spellings. `fetchCommit` 482-509 reads the recorded origin (`recordedOriginUrl` 512-523) and gives that URL to `runRemote`, so a mirror cloned over `git@github.com:` gets the SSH pairs on its pin fetch.
- `platform/git-process.ts`:
  - The header 95-96 says the module is the git spawn site "and the ssh one once the SSH probe lands".
  - `GitSubcommand` 129-140 is a closed set of git subcommands; `ssh` is not a git subcommand, so the probe needs its own request type and runner beside `run`.
  - `configPairs` 250-269 hold the protocol bans (`protocol.ext.allow=never`, `protocol.fd.allow=never`, `protocol.git.allow=never`, `protocol.ftp.allow=never`, `protocol.ftps.allow=never`); `BANNED_PROTOCOLS` 286.
  - `LANES` 420-438: on the local lane `GIT_ALLOW_PROTOCOL: "/"` and `GIT_SSH_COMMAND: "false"`.
  - `SSH_CONFIG_READ` 445-451 is the one `config --get-regexp --null` read of `core.sshcommand` and `ssh.variant`.
  - `userValue` 509-513 treats an **empty** value as unset; upstream's skip rule treats a set-but-empty `GIT_SSH_COMMAND` as set (Pitfall 4).
  - `sshEnvironment` 554-582 wraps the user's command in `CDPATH= cd -- '<neutral>' 2>/dev/null || cd / || exit 1; <cmd> -o BatchMode=yes -o StrictHostKeyChecking=yes`.
  - `gitEnvironment` 711-752 filters PATH to absolute entries (747-749).
  - `sshChange` 1079-1098 runs only for network-lane `clone`, `fetch`, and `ls-remote`.
- `platform/git-failure-kind.ts:80-128`: the ssh rows are `^@ +WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` → `ssh-host-key-changed` (87), `^Host key verification failed\.` → `ssh-host-key-unknown` (88), `^\S+: Permission denied \(publickey` → `ssh-auth` (90), and the catch-all `^fatal: Could not read from remote repository` → `ssh-auth` (126).
- `shared/github-base-url.ts`: `GITHUB_HOST = "github.com"` (29), `GITHUB_ORIGIN` (36), `gitHubWireUrl` 95-102 and `gitHubInsteadOfPairs` 114-121, both matching the exact prefix `https://github.com/`.

**A6. Plugin clone paths**
- `clone-cache.ts`:
  - `cloneIntoStaging` 119-131 is the mirror's cold clone.
  - `cloneAtPin` 148-185 is the pin ladder: a no-checkout clone, `fetchCommit`, `checkout`, then a `HEAD` check. Only the first step is the "clone step" (`N1t`).
  - `materializePluginClone` 224-290, `materializeUnpinnedSource` 402-440 (`networkCloneUrl` at 414), `refreshMirrorBySwap` 610-640, and `resolvePluginPin` 932-976 (`ls-remote` of `networkCloneUrl` at 944).
- `install-clone-probe.ts:55-95` `probeInstallClone` builds the clone URL and the auth for install.
- `install-outcome.ts:824-846` holds the `resolveGitPluginRoot` callback.
- `update-preflight.ts:367-410` holds `cloneAuth`, `probeUnpinned`, and `probePinned` for update, reinstall, and moves.
- Tag reads: `dependency-tag-probe.ts:151-171` (`url: networkCloneUrl(source)` at 163) and `marketplace-tag-probe.ts:115-146` (`networkCloneUrl(source)` at 122). Under D-SG-20 a `github` source lists `git@github.com:<o>/<r>.git` unless the variable or the base forces HTTPS. These two probes keep their per-URL memo keys, so the key becomes the chosen URL.

### B. Pattern 1: the git address validator (D-SG-17)

**What:** a pure port of `iTs` that returns `undefined` (accepted) or the refusal message. It is called by `gatedUrlField` (for `url` and `raw`), `gitSubdirObjectSource` (after the shorthand check, as `KHi` does), and the marketplace git address. The forms are accepted only through it; the D-SG-05 protocol bans stay as the second layer.

**Rules, in upstream order** (verbatim source in §Code Examples) [VERIFIED: binary grep of `iTs`, 2.1.332]:
1. control characters `[\u0000-\u001f\u007f]` → `Invalid git URL: <x> — control characters are not allowed`
2. `%00` → `... "%00" in a git address means different things ...`
3. a square bracket outside an IPv6 host (`zZ`) → the bracket message
4. scp `H=/^(?!-)[A-Za-z0-9._-]+@(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\]):(?!\/\/)/`: accepted unless the address contains `://`
5. `new URL` fails → `Invalid git URL: <x> (it could not be read as a URL). Supported: <U>`
6. a protocol outside `["https:","http:","ssh:","file:","git+ssh:","ssh+git:"]` → `Invalid git URL protocol: <p>. Supported: <U>` (this is what `git://` gets)
7. a backslash in an http(s) authority (`Iwe`) → the backslash message
8. ssh forms: `?` or `#`, a host other than a hostname or bracketed IPv6 (optional `:port`), or a user not matching `^(?!-)[A-Za-z0-9._-]+$` → `Invalid ssh git URL: ...`
9. no `//` after the scheme → `... a scheme URL must be spelled scheme://…`
10. `file:` with a host or a network-shaped path → `Refusing git URL <x>: a file: URL must name a local path (no host, no network-shaped path).`

`U` = `https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.`

**When to use:** at every parse of a git address. The `#ref` split of Pi's url form (D-76-01) happens before the gate, so an scp `git@host:o/r.git#main` passes rule 8's `#` ban only because it is the scp form (rule 4 returns first) [VERIFIED: rule 4 returns before rule 8 in the quoted source]. An `ssh://...#ref` string form must be split first, or the gate refuses it. That matches upstream, whose plugin url object keeps `ref` in its own field, while a Pi string form carries `#ref` (OQ-6).

**Display helpers.** `w(jh(e))` redacts userinfo and truncates to 200 characters for display. Use Pi's `shared/redact-credentials.ts` for the same purpose; do not port `jh` [ASSUMED: equivalence of the two redactions is not verified]. The `file:` network-path test (`$W`, `aI`) covers UNC and device paths such as `//host/share` and `\\?\`. Port only the observable rule: refuse a `file:` URL whose host is non-empty or whose decoded path starts with two slashes or backslashes [ASSUMED: the full `aI` helper was not read].

### C. Pattern 2: the `Ort` fold (D-SG-23)

**What:** `gitHubRepoOf(address): string | null`, returning a lower-cased `owner/repo` for any GitHub spelling [VERIFIED: binary grep of `Ort`, `Rt`, `Tt`, `ye`, `jZn`, `MJt`, `Mle` (2.1.332), quoted in §Code Examples]:
- With `://`: `new URL` parses; the protocol is in `Rt = {https:, http:, git:, git+https:, git+http:, git+ssh:, ssh:}` (note: **`ssh+git:` is not in it**); the hostname is GitHub (`Bo`: lower case, every leading `www.` and trailing dots removed, then `=== "github.com"`), or also `ssh.github.com` for `ssh:` and `git+ssh:` (`Tt`); the character after the authority is `/`. The path is what follows, up to `?` or `#`.
- Without `://` but with `:`: the text before the first `:` holds no `/`, and the host between `@` and `:` is GitHub (`ye`, so `ssh.github.com` too). The path is what follows `:`, with one leading `/` removed. The user part is ignored.
- Then one trailing `/` and one `.git` (any case) are removed; the result must match `jZn = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/`, must not end in `/.` or `/..`, and is lower-cased.
- Refused outright (`null`) when `Mle` flags the address: a stray bracket (`zZ`), a backslash in the authority (`Iwe`), an unparseable non-http URL, a non-http hostname with `%`, control or non-ASCII characters, or an scp whose `@` comes after its `:`.

**Where it applies:**
- `originMatchesSource`;
- `samePlannedSource` (upstream `wjt` rewrites a `git` source whose url folds into `{source:"github", repo}` before comparing; `_At` compares the folded objects deeply, `ref` included);
- `recordedSourceAction` (add.ts 615-656, through `samePlannedSource`);
- `reservedMarketplaceNameRefusal`;
- `deriveMarketplaceUrl`;
- seeding's identity compare (`repositoryIdentity` against the marketplace URL; both must fold or neither).

**Where it must NOT apply:** `canonicalCloneUrl`, `pluginCloneKey`, and `pluginMirrorKey`. Folding them would rehash every `plugin-clones/` directory (CONTEXT; the clone-key.ts:81-84 comment says the same).

### D. Pattern 3: the SSH launches on the one spawn site

**What:** `platform/git-process.ts` gains a second runner, e.g. `runSsh(request: SshRequest)`, with its own closed purpose set (`probe`, `print-config`). It uses the same launcher (`runProcess`), the same absolute-PATH lookup idea (find `ssh` only in absolute PATH entries; a miss is reported, not cached, as for git), the neutral directory as cwd, `windowsHide`, closed stdin, and a fixed timeout. `platform/git.ts` adds verbs on top. Every verb takes the defaulted git process as its last parameter, as the existing verbs do.

| Verb | Launch | Lane / env | Timeout | Result |
|---|---|---|---|---|
| `probeGitHubSsh()` | `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` | the user's environment unchanged (`SSH_AUTH_SOCK` must survive); cwd neutral | 3000 ms fixed (not `gitTimeoutMs()`) | `configured` on exit 1 with `successfully authenticated` in stdout+stderr; `unknown` on timeout; `not-configured` on exit 255 with `Permission denied (publickey` or `Host key verification failed`; otherwise `not-configured` if no ssh is found, else `unknown`; a thrown error is `unknown` plus a debug line |
| `sshShowsDirectGitHub()` | `ssh -G git@github.com` | user environment, cwd neutral | 5000 ms | true when exit 0 and `Xxn(stdout)`: a trimmed, lower-cased line `hostname github.com`, and no line matching `/^proxy(command|jump)(?! none$)/` |
| `sshUrlRewritten(sshUrl)` | `git ls-remote --get-url --end-of-options <url>` | **local lane**, **no** D-SG-16/21 request pairs | 5000 ms | true unless exit 0 with stdout equal to the URL |
| `userSshOverride()` | none (reads the env) plus `SSH_CONFIG_READ` | — | — | true when `GIT_SSH_COMMAND` or `GIT_SSH` is present in any spelling, **empty included**, or `core.sshCommand` is set |
| `sshGCheckThroughGit(sshUrl)` (Windows only) | `git ls-remote --end-of-options <url>` with `GIT_SSH_COMMAND="<wrapped user ssh> -G >&2"` | **network lane** (the local lane refuses ssh, E-R7) | 5000 ms | `!timedOut && Xxn(stderr)` |

Facts behind the table:
- The probe argv, timeout, and classification are verbatim `Jxn` [VERIFIED: binary grep]. `ConnectTimeout=2` bounds the TCP connect.
- The neutral directory as cwd instead of home is a recorded invisible divergence (CONTEXT).
- `ls-remote --get-url` on the local lane answers locally and returns the URL unchanged, and Pi's own D-SG-16 pair cannot rewrite an scp URL [VERIFIED: 04-EVIDENCE E4-GETURL a, b, h; re-run this session, E-R5].
- A user `insteadOf` whose prefix is longer than Pi's wins (git picks the longest match), as IN-01 already records for HTTPS [VERIFIED: experiment E-R6 this session].

**Port, not GitOps:** add these verbs as a new port (for example `GitHubSshOps`), bound in `orchestrators/marketplace/shared.ts` beside `DEFAULT_GIT_OPS`, rather than as new required members of `GitOps`. Required members would ripple into every `GitOps` implementation in one commit: `createGitOpsFake` in `test/platform/git-ops-fake.ts` and the inline objects in `test/platform/system-git-ops.ts`, `test/orchestrators/marketplace/{shared,update,add}.test.ts` [VERIFIED: grep `listRemotes:` in test/]. The port's name must not match BLOCK F's `\b(?:gitOps|DEFAULT_GIT_OPS|refreshCloneBySwap|...)\b` (eslint.config.js:108-109) if a network-free module must carry it.

### E. Pattern 4: the transport plan, the per-command context, and the fallback runner

**Plan (pure, `domain/github-transport.ts`).** The inputs are the transport surface (`marketplace-clone`, `marketplace-refresh`, `plugin-clone`, `tag-read`, `git-subdir-shorthand`), `owner/repo`, whether the source is an `owner/repo` spelling, `preferHttps`, `baseOverride`, `platform`, and lazily the probe and check results. The output is an ordered list of `{transport: "ssh" | "https", url}`, the note kind, and whether a retry is allowed. The order and the checks follow `Qmt` exactly (non-Windows pass) [VERIFIED: binary grep `Qmt`, quoted in §Code Examples]:

1. `GIT_SSH_COMMAND` or `GIT_SSH` set (empty included) → SSH only
2. `core.sshCommand` set → SSH only
3. `ls-remote --get-url` rewritten, or a non-zero exit → SSH only (debug: `GitHub SSH URL is rewritten by git config, or git could not say (code=<n>): staying on SSH`)
4. (Windows pass only: the `-G` check through git, then **return**; no probe)
5. probe `!== "not-configured"` → SSH only (so `configured` and `unknown` keep SSH)
6. no `ssh` found → HTTPS first
7. `ssh -G` direct → HTTPS first, else SSH only (debug: `ssh -G does not show git@github.com going straight to github.com (code=<n>): staying on SSH`)

The marketplace path (`Njt`, `_Fi`, `Rqo`) never runs steps 1-4 and 6-7. It only asks `probe === "configured"` [VERIFIED: 04-EVIDENCE Q18, `u0e`].

**Context.** Upstream's context is `{notify, probeSsh: () => n ??= Jxn()}` (`Nrl`), built only by the shell install. Pi's equivalent is a plain object built at each command root, for example `{ sshProbe?: Promise<SshProbeResult>; notes: GitHubCloneNote[] }`. Its field name must not match BLOCK F, so network-free modules may carry it. Thread it beside `authMemo`, through the same 20 files and about 64 sites (`grep -rn authMemo`), and through `buildInstallLedgerOptions` (`install-flow-cascade-context.ts:116-180`), whose comment calls the auth trio "cascade-wide, deliberately". That is how required dependency installs inherit the context, matching upstream's hand-off (`wi!==e&&an.has(wi)?void 0:Ae`: members already installed in the scope get none). Phase 5 may delete `authMemo`. Keep the transport context a separate field so Phase 5 does not have to untangle it.

**Runner.** `runOverTransports(plan, attempt: (url) => Promise<T>, opts)` in `orchestrators/github-transport.ts`. It is a non-seam module that names no git surface, which BLOCK F allows.
- It runs `attempt(url1)`. Only a clone-step failure continues: upstream's `N1t` marks the `clone` command only, not the SHA fetch or the checkout.
- Before `attempt(url2)` it clears the target. Pi's `clone` already removes the directory git made (platform/git.ts:430-434), and each seam's staging cleanup runs.
- It records the retry note and throws a typed both-failed error when both attempts fail.
- The marketplace path continues on **any** error. The plugin path continues HTTPS → SSH on a clone-step failure, and on Windows SSH → HTTPS only on the publickey or host-key kinds plus the Windows checks (§W).

**Where the runner wraps, per seam:**

| Seam | Wrap |
|---|---|
| `marketplace/add.ts` `gitStagingSteps.stage` | the clone into staging (one attempt per URL) |
| `clone-swap.ts` `refreshCloneBySwap` | the freshness `ls-remote` over the URL list (first that answers), then the re-clone over the list |
| `clone-cache.ts` cold mirror (`cloneIntoStaging`) | the clone |
| `clone-cache.ts` warm mirror (`refreshMirrorBySwap`) | through `refreshCloneBySwap`'s list |
| `clone-cache.ts` `cloneAtPin` | the no-checkout clone only, never `fetchCommit` or `checkout` |
| `resolvePluginPin` (ref resolution `ls-remote`) | the URL list (Pi-specific step; treat as part of the clone step, OQ-4) |
| tag probes | one URL (D-SG-20 has no fallback: upstream `zmt` is SSH or HTTPS, never both) |

### F. Pattern 5: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and the base override

- `PREFER_HTTPS` true → every GitHub address uses HTTPS, one attempt, no probe, no skip checks (`PJt()` is checked first in `zHi`, `Njt`, `_Fi`, `Rqo`, `KHi`, and `zmt`). It never changes a non-GitHub address.
- Base override set (D-SG-21) → the probe does not run. The planner must still choose the order (OQ-2). Both candidate URLs reach the same wire URL under the pairs (`git@github.com:acme/tools.git` and `https://github.com/acme/tools.git` both become `<base>/acme/tools.git`, E-R5), so a retry would repeat the same request. **Recommend:** the override behaves as `PREFER_HTTPS` for ordering and the note, and the SSH pairs exist so that SSH-*spelled* GitHub addresses (a `url` source `git@github.com:o/r.git`, a recorded scp origin read by `fetchCommit`) also reach the base. D-SG-20's own text, "the base override (D-SG-21) forces HTTPS", supports this.
- SSH pairs, computed per URL: for any address that `gitHubRepoOf` folds, emit `url.<base>/.insteadOf=<the address's prefix through the host separator>` (`git@github.com:`, `ssh://git@github.com/`, `git+ssh://git@ssh.github.com:443/`, …). git's `insteadOf` is a case-sensitive prefix match, so a fixed list (`git@github.com:`, `ssh://git@github.com/`) misses `git@GitHub.com:`, other users, and `ssh.github.com` (E-R5 shows those unrewritten). The multi-valued `url.<base>/.insteadOf` keys work in one command line [VERIFIED: experiment E-R5]. The base's `=` refusal (GHB-03) keeps the key intact, and a prefix may contain `:` [VERIFIED: E-R5 rewrote `git@github.com:` via `-c url.https://127.0.0.1:9/base/.insteadOf=git@github.com:`].
- Under the override, `gitHubWireUrl` must map the SSH spellings too, so a failure's `FetchedUrlCause` names the base (GHB-01).

### T. Threading map: how one probe result per command reaches every path (D-SG-18, D-SG-19)

| Command root | Where the context is created | How it reaches clones | Verified anchor |
|---|---|---|---|
| `install` (and its cascade) | `createInstallPlugin` root (`install-flow.ts`), when the caller passed none | `CascadeInstallOptions` → `buildInstallLedgerOptions` (cascade-wide, beside `authMemo`) → `InstallLedgerOptions` → `install-outcome.ts:824-846` `resolveGitPluginRoot` → `probeInstallClone` → clone-cache | install-flow-cascade-context.ts:60-71, 116-180 |
| bare-name retry, required dependency installs, missing-dependency install | the same options object (`install-flow-dependency-ledger.ts`, `dependency-bindings.ts:59-150`) | inherited | grep `authMemo` |
| `apply` (and a load with autoapply) | one context per `applyReconcile` | its installs, enables, moves (`convergePlugin`), and marketplace adds | reconcile/apply.ts:327 |
| `import` | one per import run (`orchestrators/import/execute.ts`, a seam) | its marketplace adds and installs | NETWORK_SEAMS entry |
| `update` | `update-flow.ts:512` creates `authMemo` today; create the context beside it | `update-preflight.ts:367-410` `probeUnpinned`/`probePinned`; `update-cascade.ts`; `dependency-move.ts:80-186` | update-flow.ts:512 |
| `reinstall` | `reinstall-flow.ts:550` (the `authMemo` site) | `materialize-latest.ts` → update preflight seam | reinstall-flow.ts:550 |
| `fetch`, `info --fetch` | `fetch.ts:157`, `info.ts:267` | clone-cache | OQ-7 |
| `marketplace add`, `update`, autoupdate, PUP-2 sync | no plugin context: the marketplace path probes on every clone and freshness list (CONTEXT), so the seam calls the probe directly | add.ts `gitStagingSteps`, `clone-swap.ts` | 04-EVIDENCE Q18 |

### S. The cucumber SSH stand-in

**What exists** [VERIFIED: Read of features/lib/ssh-git-host/{host,launch,stub}.ts and features/support/pi-process.ts]:
- `SshGitHost.start(root, { repositoriesRoot: gitHost.repositoriesRoot })` runs in `BeforeAll`, and `PATH: sshHost.searchPath()` puts its `bin/ssh` first on every Pi's PATH (pi-process.ts:162-175). `Before()` calls `run.sshHost.reset()` and asserts `sshHost: { hosts: [], launches: [] }` (pi-process.ts:252, 284).
- `register(host, arm)` takes `SshHostArm = { probe: SshProbeArm; proxy?: string }`, with `SshProbeArm` = `{ kind: "authenticated"; user: string } | { kind: "denied" } | { kind: "host-key" } | { kind: "hold" }` (launch.ts:29-39). `HOST_NAME = /^[A-Za-z0-9.-]+$/` admits `github.com` and `127.0.0.1`.
- The stub answers:
  - an unregistered host with `ssh: Could not resolve hostname <host>: Name or service not known` (exit 255; for a probe this is `unknown`, because ssh is present);
  - `-G` with `host`, `user`, `hostname`, and `port` lines plus the arm's proxy line;
  - a probe (no remote command) with `probeAnswer`: `Hi <user>! You've successfully authenticated, but GitHub does not provide shell access.` exit 1, `<user>@<host>: Permission denied (publickey).` exit 255, `Host key verification failed.` exit 255, or a hold;
  - `git-upload-pack '<path>'` by running `git upload-pack --strict` on `repositoriesRoot/<path>` in the hermetic environment.
- It logs `{ pid, argv, gitProtocol? }` per launch; `mark()` and `launchesSince(window)` give a per-`When` window.
- No step definition uses it yet (`grep sshHost features/step_definitions` is empty).

**What to add:**
1. Givens: `ssh answers probes of "{word}" as {arm}` (registers the host; `authenticated as {word}` for the user), and a variant with a `proxycommand` line. For SSH sources: register `127.0.0.1` with any arm, then publish the marketplace and add `git@127.0.0.1:acme/tools.git` or `ssh://git@127.0.0.1/acme/tools.git` on the shared Pi. These need no override change, because the base override rewrites only GitHub forms.
2. Then: `the ssh stand-in receives these launches:` with an `argv` column (joined with spaces), compared whole for the last `When` (mark before the `When`, as `requestsOfLastCommand` does for the git host). It pins the probe argv (`-T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`), the `-G` launch, the absence of a probe under `PREFER_HTTPS`, and git's own transport launch (`-o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git'`, E-R8).
3. A profile Pi without the override, with `httpsProxy` (the CONNECT proxy tunnels `github.com:443` to the git host), the GitHub redirect, and optional variables (`CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_REMOTE`). Reuse "pi runs with github's requests routed to the stand-ins" (git-host.steps.ts:362-388) and extend the profile with `variables`.
4. Skip-check Givens write the sandbox `GIT_CONFIG_GLOBAL` (`<home>/.gitconfig`, pi-process.ts:170): `core.sshCommand`, and `url.https://github.com/.insteadOf=git@github.com:`. A user `GIT_SSH_COMMAND` must be a profile variable. It must point at the stub (for example `ssh` itself), or git launches a real program.
5. The hermetic test: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` is already in `INHERITED_VARIABLES` (hermetic-git-environment.test.ts:95). Add it beside `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` in `RpcGitEnvironment` (pi-rpc.ts:83-90, 232; world.ts:255-256) and in the "only a scenario's own Pi gets them" cases (test lines 457-475).

**Request rows.** The https git host logs `GET /acme/tools.git/info/refs?service=git-upload-pack` and two `POST /acme/tools.git/git-upload-pack` per depth-1 clone (github-source.feature:19-23). An SSH clone sends nothing to the https host, so a scenario that goes SSH first pins **no** request rows plus the stub's upload-pack launch. A fallback scenario pins both: the failed attempt's launch or requests, then the other transport's. On the no-override profile, the CONNECT proxy log (`Then pi routes these github requests:`) also shows HTTPS tunnels.

### K. Failure kinds for the retry rules

Measured with git 2.43.0 and a stub (E-R1..E-R4) [VERIFIED: experiments this session]:

| Case | Stderr git prints | Row hit today | Needed |
|---|---|---|---|
| publickey | `git@github.com: Permission denied (publickey).` / `fatal: Could not read from remote repository.` / blank / `Please make sure you have the correct access rights` / `and the repository exists.` | 90 → `ssh-auth` | `ssh-auth` with `detail: "publickey"` |
| unknown host key | `No ED25519 host key is known for github.com and you have requested strict checking.` / `Host key verification failed.` / the same `fatal:` tail | 88 → `ssh-host-key-unknown` | as is |
| changed host key | the `@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` banner + `Host key verification failed.` | 87 → `ssh-host-key-changed` (E16 corpus, Phase 2) | as is; upstream's `Jmt` treats it like the unknown key (it contains `Host key verification failed`), so the Windows retry fires on it too |
| ssh missing under Pi's wrapper | `<wrapper>: 1: ssh: not found` + `fatal: Could not read from remote repository.` | 126 → `ssh-auth` | `ssh-auth` with `detail: "unconfirmed"` (no publickey line), or a new `ssh-missing` kind (Phase 6 wording) |
| ssh missing, no wrapper | `error: cannot run ssh: No such file or directory` / `fatal: unable to fork` | none (`failed`) | not reachable from Pi (Pi always wraps) |
| unknown host (DNS) | `ssh: Could not resolve hostname …` | `NETWORK_TEXT` → `network` | as is |

**Recommendation:** split `ssh-auth` into `{ kind: "ssh-auth"; detail: "publickey" | "unconfirmed" }`. Row 90 gives `publickey`; row 126 gives `unconfirmed`. The Windows retry and the plugin-path rule then read `ssh-auth/publickey`, `ssh-host-key-unknown`, or `ssh-host-key-changed`, which is parity with `Jmt`'s text test without matching text in an orchestrator. Every consumer of `GitFailure["kind"] === "ssh-auth"` still compiles. Only object-literal constructions of `{ kind: "ssh-auth" }` (tests, fakes) need the detail (Pitfall 9).

### N. The notification surface for D-SG-22

What exists [VERIFIED: sed of shared/notification-types.ts, notification-wire.ts, notification-json.ts this session]:
- Row types: `TransitionMessageBase` (417-420) is the base of `PluginInstalledMessage` (423-431) and the other transition rows; marketplace rows `MpAdded`/`MpUpdated`/`MpFailed` (951-970) extend `MpCommon`.
- The cascade carries `advisories?: readonly string[]` (1069): free text after the body, already ordered, with no closed token. It is rendered by the grammar and carried in JSON (notification-json.ts:401-405, notification-wire.ts:395, 589).
- The wire schema is closed: "Every object schema sets `additionalProperties: false`" (notification-wire.ts:31), and closed sets enroll as `Record<ClosedSet, true>` (WIRE-03).

**Recommendation (Claude's discretion):** add a structured optional field on the rows that a GitHub clone produced, not free text. For example: `clone?: { transport: "ssh" | "https"; why: "configured" | "not-configured" | "preferred-https" | "ssh-only"; url: string; retry?: { from: "ssh" | "https"; to: "ssh" | "https"; url: string } }`.
- `url` is in github.com terms (GHB-04).
- The grammar renders upstream's words for now: `Cloning via SSH: <url>`, `Cloning via HTTPS: <url>`, `SSH not configured, cloning via HTTPS: <url>`, `<T1> clone failed, retrying with <T2>: <url>`. Phase 6 owns the final wording.
- The both-failed error stays an error (`MpFailed`/`PluginFailedMessage`) whose cause is the typed `GitHubTransportsFailedError`. Its reason comes from the last attempt's classification until Phase 6 adds a token (OQ-8). No new `ContentReason` member is needed in this phase.
- A structured field keeps JSON consumers off text parsing, and it lets the scenario tables pin `clone transport`, `clone why`, and `clone url` columns. `advisories` would put the lines at the end of the whole cascade, not under their row, and could not tell which marketplace or plugin a line belongs to in an `apply` with several clones.
- Files touched together: `notification-types.ts`, `notification-wire.ts` (enroll the closed sets), `notification-json.ts`, `notification-grammar.ts`, the composers in `orchestrators/marketplace/add.ts`, `update.ts`, `plugin/install-*.messaging.ts`, `update-*.messaging.ts`, and the catalog fixtures. Run `npm run schema:generate` if the generated schema is committed.

### W. The Windows branch (SG-SSH-05)

- The branch is pure policy plus two platform facts: `host.platform === "win32"` (`GitProcessHost` extends `ProcessHost`, whose `platform` is `process.platform` in production, process-run.ts:151-152) and case-insensitive variable spellings (`WINDOWS_RULES.sameName`, git-process.ts:649-656).
- Unit rows use `createHost({ platform: "win32", ... })` (test/platform/git-process.test.ts:154-170, as used at 831-959) for the `-G` launch's argv and environment, and a plan-table row with `platform: "win32"` for the order: SSH first; then HTTPS, then SSH, on `ssh-auth/publickey` or a host-key kind when the checks pass; any other failure thrown as is; no probe launch on Windows.
- The `-G` check is `ls-remote --end-of-options <sshUrl>` on the **network** lane with `GIT_SSH_COMMAND = <the wrapped user command> + " -G >&2"`. It must reuse Pi's own wrapper (`sshEnvironment`), as upstream appends to its hardened `H.GIT_SSH_COMMAND`, and it never connects (`ssh -G` prints the config and exits). E-R7 shows it works on the network lane and is refused on the local lane.
- On Windows, Git for Windows' bundled `sh` runs the wrapper (A5).
- WINDOWS ledger: one `unrun-verify` entry, appended through `gsd-tools windows append --description "[system-git] ..."` (AGENTS.md), on `platform/git-process.ts` or the transport module. Its text: the Windows SSH-first `github` plugin install, the `-G` check through Git for Windows' `sh`, and the HTTPS-then-SSH retry after a publickey or host-key failure are proven by fake-platform unit rows only; the manual Windows check covers them. Open entries 120-125 already defer the manual Windows run to the pull request, so this one joins them.

### X. Existing scenarios and request tables that change

- **Request tables (`the git host receives these requests:`) on the shared Pi do not change**, provided OQ-2 is "the base override behaves as `PREFER_HTTPS`". Even under the other reading, an SSH URL rewritten by the D-SG-21 pairs reaches `<base>/acme/tools.git` over https, which is the same path (E-R5). The `install-dependencies.feature` tag-read rows (`GET /acme/tools.git/info/refs?service=git-upload-pack`, lines 834-898) and every HTTPS-first GitHub clone row stay as they are.
- **Field and record tables change** in every scenario where a GitHub source is cloned, because of the D-SG-22 note. There are up to 129 scenarios that mention `github` (Pitfall 10). The largest groups: `marketplace/update.feature` (15), `plugin/git-source.feature` (15), `marketplace/device-flow.feature` (12), `plugin/git-source-update.feature` (10), `marketplace/git-source.feature` (8), `plugin/fetch.feature` (8), `plugin/info.feature` (7).
- **`features/marketplace/unsupported-source.feature:21-28` flips:**
  - `http://{git host}/acme/tools.git` becomes a git source. The https git host has no plain-HTTP listener, so either add an HTTP arm to the stand-in, or pin that the add now fails as a network error rather than `unsupported source`, which is weaker but still discriminates.
  - `git@127.0.0.1:acme/tools.git` becomes an SSH add. Register `127.0.0.1` in the stub.
  - `ssh://{git host}/acme/tools.git` stays refused, now with upstream's text.
  - Add `git://…` (refused by the validator, not by git) and `http://…/m.json` (refused: hosted catalogs stay https-only).
- **`device-flow.feature`** (no override, stub first on PATH, `github.com` unregistered): every add now probes (an unregistered host gives `unknown`, so not `configured`), so `SSH not configured, cloning via HTTPS` appears. A refused sign-in becomes the both-failed outcome (Pitfall 12).
- **Unit tests that flip:** `test/domain/source.test.ts` (14 D-76-01 rows), `test/orchestrators/marketplace/update.test.ts:1319`, `test/orchestrators/marketplace/clone-swap.test.ts:1142`, the `originMatchesSource` cases in `test/domain/clone-key.test.ts`, the `ssh-auth` literals in `test/platform/git-failure-kind.test.ts` and `git-process.test.ts:1853`.

### Research-flag answers (ROADMAP)

- **The `ssh -T` launch versus `git ls-remote git@github.com:…`:** they prove different things. `ssh -T` proves that the machine's ssh (agent, `~/.ssh/config`) authenticates to github.com as some user. `ls-remote` proves access to one repository through git's ssh settings and `insteadOf`. Upstream uses `ssh -T` for the probe and handles the git-side concerns in the skip checks (`Qmt`, verified above). CONTEXT locks the `ssh -T` launch.
- **How the transport choice reaches dependency installs:** upstream passes `gitHubHttpsFallback` from the shell install into `rDn` → `MBn` → each closure member's fetch, except members already installed in the scope, and into the bare-name retry. In Pi the same route is `buildInstallLedgerOptions`'s cascade-wide fields (§T).
- **Does `marketplace add ssh://...` parse as a `git` source?** No. Upstream's `$Ce` returns `null` for `ssh://`, `git+ssh://`, `ssh+git://`, and `git://`, because each has `/` and `:` and does not match the scp regex, so the add says `Invalid marketplace source format. Try: owner/repo, https://..., or ./path` [VERIFIED: `$Ce` source above]. Those forms reach upstream only through settings and manifests.

### Suggested plan and wave shape (for the planner)

| Wave | Plan | Content | Why this order |
|---|---|---|---|
| 1 | address forms | `domain/git-url.ts`; source.ts arms; git-subdir gate and shorthand; the command-line flag on `parseAddableSource`; the import `git` kind; unsupported-source.feature + an SSH-source feature on the shared Pi (stub `127.0.0.1`) | pure domain + shared-Pi scenarios; no probe needed |
| 1 | identity fold | `Ort` port; `originMatchesSource`, `samePlannedSource`, reserved names, `deriveMarketplaceUrl`, `hostFromCloneUrl` | pure; independent of transport |
| 1 | platform ssh | `runSsh` + lookup; the probe, `-G`, `--get-url`, override facts; the `ssh-auth` detail; the port + default binding + fake; `shared/github-base-url.ts` SSH pairs and wire URL; the PREFER_HTTPS reader | platform leaf; no orchestrator change |
| 2 | transport core | `domain/github-transport.ts`; `orchestrators/github-transport.ts` runner + context; `GitHubTransportsFailedError` + classifier arm; the notification field (types, wire, json, grammar) | needs the wave 1 platform verbs |
| 3 | marketplace path | add, clone-swap `urls`, update, PUP-2; marketplace scenarios; rebaseline of marketplace feature files and device-flow | needs wave 2; the rebaseline must land in the same wave |
| 3 | plugin path | clone-cache wraps; threading (§T); tag reads and git-subdir shorthand (D-SG-20); Windows rows; plugin scenarios; rebaseline of plugin feature files | same |
| 4 | records | NFR-5 amendment in PROJECT.md and AGENTS.md; the D-SG-17..24 outcome column; the WINDOWS ledger entry; `.planning/codebase/*.md` lines (gates: NETWORK_SEAMS unchanged; the git-process header) | after code |

The marketplace and plugin plans of wave 3 both edit `clone-swap.ts` callers and the notification composers. Either serialize them, or give `refreshCloneBySwap`'s `urls` change to the transport-core plan.

### R. What happens to `state.json` records already present (D-SG-23)

No migration. Records keep their spelling. The fold runs in each comparison, and stored sources still re-parse through `normalizeStoredSource` (state-io.ts:512-548), which accepts the new forms once the parser does. See the Runtime State Inventory below.

### Anti-Patterns to Avoid

- **Probing on `kind === "github"`.** Upstream probes only `owner/repo` (`{source:"github"}`) sources. `marketplace add https://github.com/o/r` is `{source:"git", url:"https://github.com/o/r.git"}` upstream, and `Rqo` returns `[e.url]` for a `git` source, so it clones as written [VERIFIED: binary grep `$Ce`, `Rqo`]. Pi's D-76-02 folds that URL into the `github` kind, so key the probe on the declared spelling (`raw` not a URL). OQ-1 asks the maintainer to confirm.
- **Re-deriving transport from the recorded origin.** CONTEXT moves the refresh to the declared source. An origin read stays only for identity (folded) and for `fetchCommit`'s pair.
- **Text matching on stderr in orchestrators.** The Windows retry and the publickey rule must read typed kinds (SG-PRC-05). Add a `detail` to `ssh-auth` rather than matching `GitCommandError.stderr` (§K).
- **Folding the cache key.** `canonicalCloneUrl` stays exact; only comparisons fold.
- **One fixed SSH `insteadOf` list** for D-SG-21 (see Pattern 5).
- **Running the `-G` check on the local lane.** git refuses the ssh transport there (E-R7).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Launching ssh | a second `spawn` site | `platform/git-process.ts` + `runProcess` | `child-process-chokepoint`, `no-shell-out.test.ts`, and the AUTH-09 leak gate already cover that file |
| The ssh binary lookup | `which`/`command -v` through a shell | the absolute-PATH lookup pattern of `findGitOnPosix` | D-SG-04: a relative PATH entry could plant a binary |
| Boolean variable parsing | a second truthy set | D-SG-15's reader (`TRUE_VALUES`), moved to one shared function | parity (`H.bool()`); fallow dupes |
| URL rewriting under the base | building `<base>/o/r.git` in Pi | git `insteadOf` pairs | the recorded origin stays canonical (D-SG-16); credentials key by the base host |
| The SSH stand-in | a new stub or an sshd | `features/lib/ssh-git-host/` (`SshGitHost`, `probeAnswer`, `configLines`) | it exists, is reset per scenario, and records argv |
| Failure classification | regexes in orchestrators | `platform/git-failure-kind.ts` rows plus a `detail` | SG-PRC-05, WR-01 (`remote:` lines removed before matching) |
| Redacting URLs in messages | porting `jh` | `shared/redact-credentials.ts` | SG-ERR-02, AUTH-09 gate |

**Key insight:** every hard part (spawn hardening, lanes, redaction, the stand-in, the swap) exists. The phase is mostly policy and threading; new mechanisms are a risk to the gates.

## Runtime State Inventory

The phase is not a rename, but D-SG-23 changes how stored records compare, so each category is answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` marketplace and plugin records keep `raw`, `owner`, `repo` as typed. Records spelled `Acme/Tools` and `acme/tools` under two names may exist. | None: the fold is read-time (in `samePlannedSource`, `originMatchesSource`, and the reserved check). Two records that fold to one source make `recordedSourceAction` find two matches, which returns `undefined` and runs a fresh add (add.ts 621-628), so nothing merges silently. No data migration. |
| Live service config | None. GitHub and mirrors hold no Pi state. | None |
| OS-registered state | The user's `~/.ssh/known_hosts` may gain entries through the user's ssh (D-SG-03); `StrictHostKeyChecking=yes` refuses unknown hosts, so the probe adds none. | None |
| Secrets / env vars | New reads: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`; existing `GIT_SSH_COMMAND`, `GIT_SSH`, `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`. `CLAUDE_CODE_REMOTE` stays unread. | Code only; `test/architecture/hermetic-git-environment.test.ts:95` already plants `CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "1"` in the inherited set |
| Build artifacts / clones | `plugin-clones/<key>/` keys unchanged. A mirror cloned over SSH records `origin = git@github.com:o/r.git`, verbatim (E4-ORIGIN a). `sources/<name>/` checkouts may now carry SSH origins. | None: recognition folds; the refresh uses the declared source |

## Common Pitfalls

### Pitfall 1: the probe reaches the real github.com from a test
**What goes wrong:** `NODE_GIT_PROCESS` reads `process.env.PATH`. A unit or integration test that runs a GitHub add or install without the base override and without fakes launches the developer's or CI runner's real `ssh -T git@github.com` (TCP 22).
**Why it happens:** `test/integration/auth-e2e.test.ts` already runs `addMarketplace` for a GitHub source **without** the base override (through the CONNECT proxy) [VERIFIED: file header lines 1-18]. After this phase that add probes. The 12 scenarios of `features/marketplace/device-flow.feature` do the same through "pi runs with github's requests routed to the stand-ins" (git-host.steps.ts:362-388); there the stub is first on PATH, so they are safe.
**How to avoid:** put an `SshGitHost` stub (or a refusing `ssh`) first on PATH for every in-process test that clones a GitHub source without the base override, or set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` in that test's own environment. Orchestrator unit tests use `createGitOpsFake`, which blocks unplanned remotes, plus a fake for the new port. Platform tests of the probe use `sshFixture` (test/platform/git-process.test.ts:489-500) or an injected spawn.
**Warning signs:** a test that passes offline only after a long wait (the 3000 ms probe timeout), or the ssh stand-in's launch log missing a probe line you expected.

### Pitfall 2: under the base override nothing SSH-shaped can be observed
**What goes wrong:** the shared cucumber Pi always sets `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (features/support/pi-process.ts:168-175), and D-SG-21 skips the probe there. A probe scenario written on the shared Pi passes without testing anything.
**How to avoid:** every probe, skip-check, fallback, and `PREFER_HTTPS` scenario starts its own Pi without the override, with the CONNECT proxy and the GitHub redirect (`usePiWithProfile({ withoutGitHubBaseOverride: true, httpsProxy, extraExtensions: [GITHUB_REDIRECT_EXTENSION] })`). The `PREFER_HTTPS` scenario additionally needs the variable on that profile Pi. Today `usePiWithVariables` (world.ts:798-820) and the no-override profile are separate paths, so the planner must combine them, and add the variable to `RpcGitEnvironment` (world.ts:255-256, pi-rpc.ts:83-90 and 232).
**Warning signs:** a "the ssh stand-in receives these launches" table that is empty in every arm.

### Pitfall 3: F-5 lets a no-override Pi leave the machine
**What goes wrong:** 03-SECURITY F-5: `usePiWithProfile` does not require `httpsProxy` when `withoutGitHubBaseOverride` is set (world.ts:848-851, 1391-1401). A new Phase 4 scenario that forgets the proxy sends HTTPS git to the real github.com.
**How to avoid:** close F-5 in this phase, because the phase adds several no-override scenarios: require `httpsProxy` with `withoutGitHubBaseOverride`.

### Pitfall 4: the `GIT_SSH_COMMAND` skip rule versus Pi's own hardening
**What goes wrong:** (a) Pi's `userValue` treats an empty `GIT_SSH_COMMAND` as unset (git-process.ts:509-513), while upstream's skip uses `_E(...) !== void 0`, so a set-but-empty variable means "stay on SSH". (b) Pi always exports its own wrapped `GIT_SSH_COMMAND` to git children (sshEnvironment 554-582). A skip check that read a child's environment, or Pi's own `options.env` after a change, would always see a value.
**How to avoid:** the skip reads the *base* environment `options.env` with presence semantics (every Windows spelling), never the computed `gitEnvironment`. Add unit rows for: unset, empty, set, and lower-case on win32.
**Warning signs:** every plugin install stays on SSH in a scenario with no user ssh setting.

### Pitfall 5: `StrictHostKeyChecking=yes` against the stub
**What goes wrong:** nothing, for the stub: it ignores options and answers by host arm. The risk is on real machines: a user without `github.com` in `known_hosts` gets `Host key verification failed` → `not-configured` → HTTPS first, which is upstream's intent (accept-new is out of scope).
**How to avoid:** pin the `host-key` arm in a scenario: probe → `not-configured` → `SSH not configured, cloning via HTTPS`.

### Pitfall 6: a missing ssh reads as `ssh-auth`
**What goes wrong:** under Pi's wrapper, git runs `sh -c '<wrapped>'`, and a missing ssh prints `<wrapper text>: 1: ssh: not found` plus `fatal: Could not read from remote repository.` (exit 128), which the catch-all row 126 maps to `ssh-auth` [VERIFIED: experiment E-R3]. Without the wrapper, git prints `error: cannot run ssh: No such file or directory` / `fatal: unable to fork` (E-R4, no row today). The stderr also carries the neutral directory's absolute path.
**How to avoid:** the probe classifies ssh absence by its own lookup (no spawn), so the transport choice is right. For the failure of an SSH-only clone with no ssh, add a row or a `detail` (§K) and make sure redaction runs on the path before any message.

### Pitfall 7: the identity fold is one-way
**What goes wrong:** after the fold, a config `Acme/Tools` reconciles as "same" as a record `acme/tools`. The record's spelling wins forever, and nothing can split them later.
**How to avoid:** fold only in comparisons; never rewrite `raw`/`owner`/`repo` in a record; never fold a cache key. Add a unit row for a config and a record that differ only by case, and a scenario where `marketplace add Acme/Tools` after `acme/tools` reports the marketplace already added. Upstream's MPA-01 says `already added; nothing changed`.

### Pitfall 8: the probe key differs between the two paths
**What goes wrong:** treating `unknown` the same on both paths. The marketplace path goes SSH first only on `configured` (`unknown` → HTTPS first). The plugin path goes HTTPS only on `not-configured` (`unknown` → SSH only).
**How to avoid:** one probe result type, two predicates, unit rows for all three results on both paths. The stub's `hold` arm gives `unknown` after 3000 ms.

### Pitfall 9: changes that must land in one commit
The commit hook typechecks the whole tree (`check:commit` runs `check:static`), so these move together:
- the `refreshCloneBySwap` `url` → `urls` change, with update.ts, update-flow.ts, clone-cache.ts, and their tests;
- any `GitFailure` shape change (an `ssh-auth` detail): every exhaustive switch (`shared/git-failure-classifiers.ts`, notify-reasons) and `test/platform/git-failure-kind.test.ts`;
- a notification type field, the wire schema (`additionalProperties: false`, WIRE-03 `Record<ClosedSet,true>` enrollment), `notification-json.ts`, the grammar, the catalog fixtures, and `npm run schema:generate`'s output if it is committed;
- a required port member and every implementation (prefer an optional port, Pattern 3);
- the parser acceptance change with `test/domain/source.test.ts` (14 D-76-01 rows) and `test/platform/git-process.test.ts`.

`features/marketplace/unsupported-source.feature:21-28` (the `http://`, `ssh://`, `git@127.0.0.1:` examples) is not run by the hook, but it must flip in the same wave, or the wave's `npm run check` fails.

### Pitfall 10: the transport note rebaselines many scenarios
**What goes wrong:** field and record tables are exhaustive (`namesLike` appends every unstated field; `recordTable` adds every unstated column; features/lib/field-rows.ts:81-99) [VERIFIED: Read via sed]. A row field such as `clone transport` therefore appears in every table of every scenario that clones a GitHub source, including on the shared Pi (with the base override, each GitHub clone notes HTTPS). A scan finds 129 scenarios across 31 feature files that mention `github`: marketplace/update 15, plugin/git-source 15, device-flow 12, plugin/git-source-update 10, … This is an upper bound: warm clones note nothing.
**How to avoid:** plan the rebaseline in the same wave as the note, per feature file, and decide OQ-3 first (whether `url`-spelled GitHub sources get a note), because it changes the count.

### Pitfall 11: Sonar and fallow on ported regexes
**What goes wrong:** upstream's `$Ce` scp regex `/^([a-zA-Z0-9._-]+@[^:]+:.+?(?:\.git)?)(#(.+))?$/` and the ssh-URL checks use lazy quantifiers that `sonarjs` slow-regex rules may flag, and `fallow health` caps cognitive complexity at 15. `iTs` as one function is far above that.
**How to avoid:** write character-level parsers, as `domain/source.ts` does (D-06), and split `iTs` into one small function per rule with a table of `(check, message)` rows.

### Pitfall 12: the Device Flow retry and the transport fallback nest
**What goes wrong:** D-SG-14's Device Flow runs inside `runRemote` for an HTTPS `no-credential` failure. With the marketplace HTTPS-first order, a refused sign-in fails the HTTPS attempt, and the transport runner then retries over SSH. On the device-flow profile (stub with an unregistered `github.com`) that SSH attempt fails as `ssh: Could not resolve hostname`, so the result becomes the both-failed error. The `device-flow.feature` failure scenarios change.
**How to avoid:** keep the Device Flow inside the HTTPS attempt (it is part of that attempt), and rebaseline those scenarios. Phase 5 may delete Device Flow.

## Code Examples

The verbatim upstream sources the ports follow, extracted from `/opt/claude-code/bin/claude` 2.1.332 this session (grep only, never run) [VERIFIED: binary grep with `tools/ctxa.py`].

### The validator `iTs` and its constants
```js
// 2.1.332, chunk-local constants
var U="https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.",
H=/^(?!-)[A-Za-z0-9._-]+@(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\]):(?!\/\/)/,
V=/^(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])$/,
q=/^(?!-)[A-Za-z0-9._-]+$/;
function iTs(e){
 if(/[\u0000-\u001f\u007f]/.test(e))throw new T(`Invalid git URL: ${w(jh(e))} — control characters are not allowed`,...);
 if(e.includes("%00"))throw new T(`Invalid git URL: ${w(jh(e))} — "%00" in a git address means different things to different versions of git, so it is not allowed. Remove it.`,...);
 if(zZ(e))throw new T(`Invalid git URL: ${w(jh(e))} — git can read a square bracket ...`,...);
 if(H.test(e)){if(!e.includes("://"))return e;throw new T(`Invalid git URL: an address written as user@host:path can't contain "://", ...`,...)}
 let i;try{i=new URL(e)}catch{throw new T(`Invalid git URL: ${w(jh(e))} (it could not be read as a URL). Supported: ${U}`,...)}
 if(!["https:","http:","ssh:","file:","git+ssh:","ssh+git:"].includes(i.protocol)){... `Invalid git URL protocol: ${...}. Supported: ${U}` ...}
 if((i.protocol==="https:"||i.protocol==="http:")&&Iwe(e))throw new T(`Invalid git URL: ${w(jh(e))} — a backslash before the first "/" can make git connect to a different server ...`,...);
 if(["ssh:","git+ssh:","ssh+git:"].includes(i.protocol)){ /* host must match V, user must match q, no ? or # */
   ... throw new T(`Invalid ssh git URL: the host must be a hostname or bracketed IPv6 literal (optionally :port), the user a plain name, and the URL may not carry ? or # (${w(W)})`,...)}
 if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(e))throw new T(`Invalid git URL: ${w(jh(e))} — a scheme URL must be spelled scheme://…`,...);
 if(i.protocol==="file:"&&(/*network path*/ ||i.host!==""||/^file:\/\/[^/\\]/i.test(e)||/^file:[\\/]*[\\]/i.test(e)||/*device path*/))
   throw new T(`Refusing git URL ${w(jh(e))}: a file: URL must name a local path (no host, no network-shaped path).${/^file:\/\/[a-z]:/i.test(e)?" A drive letter such as C: counts as a local path only on Windows.":""}`,...);
 return e}
function KHi(e){if(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(e))return PJt()?`https://github.com/${e}.git`:`git@${Zr}:${e}.git`;return iTs(e)}
```

### The add command-line parser `$Ce` (the arms that matter)
```js
let n=e.trim(), o=n.match(/^([a-zA-Z0-9._-]+@[^:]+:.+?(?:\.git)?)(#(.+))?$/);
if(o?.[1]){ return c ? {source:"git",url:l,ref:c} : {source:"git",url:l} }   // scp → git
if(n.startsWith("http://")||n.startsWith("https://")){
  if(c.endsWith(".git")||c.includes("/_git/")) return {source:"git",url:c,...};   // http(s) .git → git
  if(Bo(g.hostname)) ... return {source:"git",url:`${y}.git`,...};               // github URL → git (no probe!)
  ...
  return {source:"url",url:c} }                                                  // hosted catalog
if(n.includes("/")&&!n.startsWith("@")){ if(n.includes(":"))return null; ... owner/repo → github }
// ssh://, git+ssh://, ssh+git://, git:// fall through to null →
// "Invalid marketplace source format. Try: owner/repo, https://..., or ./path"
```

### The `Ort` fold and the reserved-name use
```js
function Ort(e){if(Mle(e)||Pwe(e))return null;let n=e,s=e.indexOf("://");
 if(s!==-1){let a;try{a=new URL(e)}catch{a=null}let i=e.slice(s+3).search(/[/?#]/)+s+3;
  if(a===null||!Rt.has(a.protocol)||!(Tt.has(a.protocol)?ye(a.hostname):Bo(a.hostname))||e[i]!=="/")return null;
  n=e.slice(i+1).split(/[?#]/)[0]??""}
 else if(e.includes(":")){let a=e.indexOf(":");if(e.slice(0,a).includes("/")||!ye(e.slice(e.indexOf("@")+1,a)))return null;
  n=e.slice(a+1).replace(/^\//,"")}
 let o=n.replace(/\/$/,"").replace(/\.git$/i,"");if(!jZn.test(o)||/\/\.\.?$/.test(o))return null;return o.toLowerCase()}
var Rt=new Set(["https:","http:","git:","git+https:","git+http:","git+ssh:","ssh:"]),Tt=new Set(["ssh:","git+ssh:"]);
function ye(e){return Bo(e)||ber(e,"ssh.github.com")}
function Bo(t){return ber(t,Zr)}   function ber(t,n){return MJt(t)===n}
var MJt=m1(function(n){let r=AD(n);while(r.startsWith("www."))r=r.slice(4);return r},...);
jZn=/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;
function wjt(e){if(e.source==="github")return{...e,repo:Ort(e.repo)??e.repo};
 if(e.source==="git"){let n=Ort(e.url);if(n!==null){let{url:o,...g}=e;return{...g,source:"github",repo:n}}}return e}
function oJt(e){if(e.source==="github"){let n=e.repo??"";return!n.includes(":")&&mCn(n)}return e.source==="git"&&e.url!==void 0&&jt(e.url)}
function jt(e){let n=e.trim();return n.includes(":")&&mCn(n)}   function mCn(e){return Ort(e)?.startsWith(`${K}/`)===!0}  // K="anthropics"
```

### The probe, the skip checks, and the plugin clone
```js
async function Jxn(){try{let e=await vt("ssh",["-T","-o","BatchMode=yes","-o","ConnectTimeout=2","-o","StrictHostKeyChecking=yes","git@github.com"],{cwd:dWe(),timeout:3000}),
 n=`${e.stdout??""}\n${e.stderr??""}`,o=e.code===1&&n.includes("successfully authenticated");
 t(`SSH config check: code=${e.code} configured=${o}`);if(o)return"configured";if(e.timedOut)return"unknown";
 if(e.code===255&&Jmt(n))return"not-configured";return await bf("ssh")===null?"not-configured":"unknown"}
 catch(e){t(`SSH configuration check failed: ${d(e)}`,{level:"warn"});return"unknown"}}
function Jmt(e){return e.includes("Permission denied (publickey")||e.includes("Host key verification failed")}
async function Qmt(e,n,o,g){let h=A()==="windows";if(h!==g)return!1;let y=mme();
 if(_E(y,"GIT_SSH_COMMAND")!==void 0||_E(y,"GIT_SSH")!==void 0)return!1;
 let k=await bF(n);if(k.command!==void 0)return!1;
 let{pinArgs:C,env:H}=Y5e(o,k),z=await vt($t(),["ls-remote","--get-url","--",n],{...await WCn(o,H),stdin:"ignore",timeout:5000});
 if(z.code!==0||z.stdout.trim()!==n)return t(`GitHub SSH URL is rewritten by git config, or git could not say (code=${z.code}): staying on SSH`),!1;
 if(h){let Q=await vt($t(),[...C,"ls-remote","--",n],{...await WCn(o,{...H,GIT_SSH_COMMAND:`${H.GIT_SSH_COMMAND} -G >&2`}),stdin:"ignore",timeout:5000});return!Q.timedOut&&Xxn(Q.stderr)}
 if(await e.probeSsh()!=="not-configured")return!1;if(await bf("ssh")===null)return!0;
 let Y=await vt("ssh",["-G","git@github.com"],{cwd:dWe(),timeout:5000});if(Y.code===0&&Xxn(Y.stdout))return!0;
 return t(`ssh -G does not show git@github.com going straight to github.com (code=${Y.code}): staying on SSH`),!1}
function Xxn(e){let n=e.split(`\n`).map((o)=>o.trim().toLowerCase());return n.includes("hostname github.com")&&!n.some((o)=>/^proxy(command|jump)(?! none$)/.test(o))}
async function zHi(e,n,o,g,h,y){ /* repo must match /^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/ */
 let k=`git@${Zr}:${e}.git`,C=`https://github.com/${e}.git`;
 if(PJt())return Lre(C,...); if(y===void 0)return Lre(k,...);
 if(!await Qmt(y,k,n,!1))try{return await Lre(k,...)}catch(H){if(!N1t(H)||!Jmt(d(H))||!await Qmt(y,k,n,!0))throw H;await fl(n).catch(()=>{throw H})}
 y.notify(d0e(C));   // "SSH not configured, cloning via HTTPS: <url>"
 try{return await Lre(C,...)}catch(H){if(!N1t(H))throw H; /* clear dir */ y.notify(Qxn(k));  // "HTTPS clone failed, retrying with SSH: <url>"
  try{return await Lre(k,...)}catch(z){if(!N1t(z))throw z;
   throw new T(`${d(H)}\nThe retry over SSH failed too: ${d(z)}\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.`,...)}}}
async function Rqo(e){if(e.source==="git")return[e.url];if(e.source!=="github")return[];
 return PJt()?[`https://github.com/${e.repo}.git`]:Djt(await u0e(),`git@${Zr}:${e.repo}.git`,`https://github.com/${e.repo}.git`).map((n)=>n.url)}
```

### Pi sketch: the pure plan (shape only)
```ts
// domain/github-transport.ts -- [ASSUMED] names; the rules are upstream's above.
export type GitHubTransport = "ssh" | "https";
export type SshProbeResult = "configured" | "not-configured" | "unknown";
export interface TransportAttempt { readonly transport: GitHubTransport; readonly url: string }
export type CloneNoteKind = "via-ssh" | "via-https" | "ssh-not-configured";

/** The marketplace path (Njt/_Fi/Rqo): SSH first only on `configured`. */
export function marketplaceAttempts(
  repo: string,
  forced: "https" | undefined,     // PREFER_HTTPS or (OQ-2) the base override
  probe: SshProbeResult | undefined,
): readonly TransportAttempt[] { /* ... */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D-76-01: only `https://` and local paths | upstream validator `iTs`; scp, `ssh`, `git+ssh`, `ssh+git`, `http`, host-less `file:` | this phase (D-SG-17) | 14 unit rows and 3 feature examples flip |
| every GitHub clone over HTTPS (`networkCloneUrl`) | probe-ordered HTTPS/SSH with fallback; tag reads SSH by default | this phase | no-key users keep HTTPS for clones; constrained tag reads fall back (TAGS-02) |
| exact owner/repo compare (D-3-01) | `Ort` fold, lower case | this phase (D-SG-23) | IN-05 closed |
| refresh from the recorded origin | refresh from the declared source's probe-ordered list | this phase | update.test.ts:1319 flips |

**Changes since 2.1.330** (from 04-EVIDENCE V1-V8): names only, plus optional plugin dependencies (`tengu_melodic_honey`), which are deferred.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi's `shared/redact-credentials.ts` is an acceptable stand-in for upstream's `jh`/`w` display redaction in the validator messages | Pattern 1 | message text differs from upstream in a redacted case; Phase 6 wording may revisit |
| A2 | The `file:` network-path check can be reduced to "non-empty host, or a path that starts with two slashes or backslashes" without porting `aI` whole | Pattern 1 | a Windows device path (`\\?\`) slips through or a valid path is refused |
| A3 | Under the base override, ordering as `PREFER_HTTPS` (one HTTPS attempt) satisfies D-SG-21 | Pattern 5, OQ-2 | the maintainer wanted an SSH-first order under the mirror; scenario notes change |
| A4 | Keying the probe on the `owner/repo` spelling (`raw` not a URL) is parity | Anti-patterns, OQ-1 | if the maintainer wants every `github`-kind source probed, it is a divergence that needs an ID |
| A5 | A Windows `-G` check through Git for Windows' `sh` behaves like the Linux experiment | §W | the Windows retry never fires; the `unrun-verify` entry catches it |
| A6 | Real OpenSSH output matches the classifier strings (`successfully authenticated` exit 1; `Permission denied (publickey).` exit 255) | Pattern 3 | wrong classification on real machines; the stub's strings come from the same classifier, so CI cannot catch it |
| A7 | The names `domain/git-url.ts`, `domain/github-transport.ts`, `orchestrators/github-transport.ts`, `GitHubSshOps`, `gitHubTransport` | Structure | none; naming only |

## Open Questions (RESOLVED)

1. **OQ-1: which spellings probe?**
   - What we know: upstream probes only `{source:"github"}` and `owner/repo` sources; `https://github.com/o/r` and `git@github.com:o/r.git` typed at add are `git` sources that clone as written (`$Ce`, `Rqo` verified). Pi folds the https form into `github` (D-76-02).
   - What's unclear: whether the maintainer reads D-SG-18/D-SG-22 "GitHub source" as the kind or the spelling.
   - Recommendation: key on the spelling (parity). An https-URL-spelled `github` source clones HTTPS with one attempt, and the planner chooses whether it shows the `Cloning via HTTPS` note (OQ-3). Confirm with the maintainer before planning the scenarios.
   - **RESOLVED (orchestrator, 2026-11-25, upstream parity is the project default):** key on the declared spelling. Only an `owner/repo` spelling probes; an https- or scp-spelled GitHub address clones as written with one attempt.
2. **OQ-2: the order under the base override.** Recommendation: behave as `PREFER_HTTPS` (A3). D-SG-21's log entry says the planner may revisit this point.
   - **RESOLVED (orchestrator, 2026-11-25):** under the base override the order is the `PREFER_HTTPS` order (one HTTPS attempt, no probe); the D-SG-21 SSH-form `insteadOf` pairs, built per URL, make SSH-spelled GitHub addresses reach the base too.
3. **OQ-3: when the note appears.** It is clear for a cold clone. For a refresh that finds the checkout current (no clone) and for a warm cache (no clone), recommend no note, because no clone ran. Upstream's refresh shows no line at all, and D-SG-22 says "every GitHub clone". A url-spelled GitHub source (if OQ-1 is the spelling) could still show `Cloning via HTTPS`. This choice drives Pitfall 10's count.
   - **RESOLVED (orchestrator, 2026-11-25, D-SG-22 'every GitHub clone'):** a note appears exactly when a GitHub clone runs (cold clone, re-clone of a stale checkout, fallback). A current refresh or a warm cache shows none. A url-spelled GitHub source that clones shows `Cloning via HTTPS: <url>`.
4. **OQ-4: Pi-only network steps.** `resolvePluginPin`'s `ls-remote` and the mirror freshness `ls-remote` have no upstream analogue. Recommend that they use the same attempt list as the clone that follows. A failure of the first URL's `ls-remote` moves to the second URL, as upstream's `iIi` loops `Rqo`.
   - **RESOLVED (orchestrator, 2026-11-25):** the Pi-only `ls-remote` steps use the same attempt list as the clone that follows, moving to the next URL on failure.
5. **OQ-5: `swapCloneUrl` for `url` sources.** CONTEXT moves github to the declared list. For `url`, upstream uses `[e.url]`. Keep the recorded-origin fallback (legacy records under another URL) or drop it for parity? Recommend parity (`[networkCloneUrl(source)]`) unless a scenario depends on it; only unit tests pin it today.
   - **RESOLVED (orchestrator, 2026-11-25, parity):** `url` sources refresh from `[networkCloneUrl(source)]`; the recorded-origin fallback goes, and the unit tests that pin it flip.
6. **OQ-6: an `ssh://...#ref` string form.** A Pi string form carries `#ref`, which `iTs` refuses for ssh URLs. Recommend splitting `#ref` before the gate, as D-76-01 does for https. Upstream's string-form parity cannot settle this, because upstream refuses `ssh://` on the command line anyway.
   - **RESOLVED (orchestrator, 2026-11-25):** split `#ref` before the gate, as D-76-01 does for https.
7. **OQ-7: `fetch` and `info --fetch` (Pi-only verbs).** D-SG-18 and D-SG-19 name install, apply, import, update, reinstall, and moves. Recommend that `fetch` and `info --fetch` also carry a context (probe and fallback), because SSH only would break no-key users exactly as D-SG-19 argues.
   - **RESOLVED (orchestrator, 2026-11-25, follows D-SG-19's reasoning):** `fetch` and `info --fetch` carry a transport context with probe and fallback.
8. **OQ-8: the both-failed reason.** SG-ERR-01 lists "both transports failed" for Phase 6. In Phase 4, a typed `GitHubTransportsFailedError` that carries both attempts (`transport`, `url`, `error`) should classify by its last attempt (upstream `wqo` keeps the second error when both messages are equal), through an explicit `instanceof` arm in `shared/git-failure-classifiers.ts`, which does not walk causes today [VERIFIED: Read of the classifier via sed, lines 74-114].
   - **RESOLVED (orchestrator, 2026-11-25):** a typed `GitHubTransportsFailedError` carrying both attempts classifies by its last attempt through an explicit `instanceof` arm; Phase 6 adds a token.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | all git tests | ✓ | 2.43.0 | — |
| Node | the runtime and tests | ✓ | v24.22.3 (`/opt/pi-claude-marketplace/bin`) | — |
| ssh (OpenSSH) | the probe in production; real-ssh tests | ✗ (`command -v ssh` fails) | — | stub `ssh` (`features/lib/ssh-git-host`, unit `sshFixture`); never install one |
| Network beyond loopback | — | ✗ by policy | — | https git host, CONNECT proxy, GitHub redirect, ssh stub |
| Windows host | SG-SSH-05 | ✗ | — | unit rows with `platform: "win32"` (`createHost`, test/platform/git-process.test.ts:154-170), plus a `[system-git]` `unrun-verify` ledger entry |
| Claude Code binary | evidence | grep only | 2.1.332 | never run |

**Missing dependencies with no fallback:** none blocks execution.
**Missing dependencies with fallback:** ssh (stub), Windows (fake platform plus the ledger).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock`; cucumber-js (adapter and builtin profiles) |
| Config file | `cucumber.json`, `package.json` scripts |
| Quick run command | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test <test-path>`; one scenario: `npx cucumber-js --profile adapter --name '<title>'` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-SSH-01 / D-SG-17 | the iTs rules: each refusal message and each accepted form; `git://` refused; host-less `file:` only | unit | `node --import ... --test test/domain/git-url.test.ts` | ❌ Wave 0 |
| SG-SSH-01 | the scp arm, the `http` git arm, `http://…json` still refused, the url object `url`/`raw` gate, the git-subdir gate (F-2: `ext::`, `file://host`), the git-subdir shorthand → SSH | unit | `... test/domain/source.test.ts` | ✅ (rows flip) |
| SG-SSH-01 | the add command line refuses `ssh://`, `git+ssh://`, `ssh+git://` with upstream's text; config, import, and the D-MF-04 add accept them | unit | `... test/orchestrators/marketplace/add.test.ts`, `test/orchestrators/import/marketplaces.test.ts` | ✅ |
| SG-SSH-01 | `marketplace add git@127.0.0.1:acme/tools.git` clones over SSH (stub launch row), then a plugin installs from it; `git://` refused; an `ssh://` marketplace declared in config reaches `apply`; a plugin `{source:"url", url:"ssh://git@127.0.0.1/…"}` installs | cucumber | `npm run test:cucumber:profile -- --profile adapter features/marketplace/ssh-source.feature features/plugin/git-source.feature` | ❌ new feature file; unsupported-source.feature rows flip |
| SG-SSH-02 | the probe arms → marketplace order: `authenticated` → `Cloning via SSH`; `denied`/`host-key` → `SSH not configured, cloning via HTTPS`; `hold` → HTTPS first after 3000 ms; first failure → retry note; both fail → the both-failed outcome | cucumber (no-override profile) | `... features/marketplace/github-transport.feature` | ❌ |
| SG-SSH-02 | the probe classifier, argv, timeout, cwd, user env kept (`SSH_AUTH_SOCK`), ssh lookup in absolute PATH entries only | unit + real stub | `... test/platform/git-process.test.ts`, `test/platform/git.test.ts` | ✅ (new cases) |
| SG-SSH-02 | the refresh URL list: freshness tries each, the re-clone tries each | unit | `... test/orchestrators/marketplace/clone-swap.test.ts`, `update.test.ts` | ✅ (rows flip) |
| SG-SSH-03 / D-SG-24 | `PREFER_HTTPS=1`: no probe launch in the stub log, HTTPS clone; `CLAUDE_CODE_REMOTE=1` changes nothing | cucumber + unit (the reader's truthy set) | as above + `test/shared/<flag>.test.ts` | ❌ |
| SG-SSH-04 / D-SG-18 | each skip check (user `GIT_SSH_COMMAND`, `core.sshCommand` in the sandbox `.gitconfig`, `insteadOf` rewriting `git@github.com:`, `ssh -G` with a proxy line, ssh absent) → SSH only; all pass + `not-configured` → HTTPS then SSH; the dependency member inherits (one probe launch per command) | unit (pure plan) + cucumber (representative rows) | `... test/domain/github-transport.test.ts`; `features/plugin/github-transport.feature` | ❌ |
| D-SG-19 | update, reinstall, and a dependency move follow the install rules | unit + cucumber | `test/orchestrators/plugin/update-preflight.test.ts`; feature rows | ✅ / ❌ |
| D-SG-20 | a constrained dependency's tag read lists `git@github.com:o/r.git`; under the variable or the base, HTTPS; on a failure, the TAGS-02 fallback | unit + cucumber | `test/orchestrators/plugin/{dependency,marketplace}-tag-probe.test.ts` | ✅ |
| D-SG-21 | the per-URL SSH `insteadOf` pairs; `fetchCommit` from an scp origin gets the pair; `gitHubWireUrl` of SSH forms | unit + real git | `test/shared/github-base-url.test.ts`, `test/platform/git.test.ts` | ✅ |
| D-SG-22 | the note kinds on the rows, the JSON wire field, the grammar | unit + architecture (wire schema) + cucumber | `test/shared/notification-*.test.ts`; rebaselined features | ✅ |
| SG-SSH-05 | Windows: SSH first, no probe; a publickey or host-key failure + checks → HTTPS then SSH; another failure → thrown; case-insensitive `GIT_SSH*` | unit with `platform: "win32"` | `test/domain/github-transport.test.ts`, `test/platform/git-process.test.ts` | ❌ + manual (WINDOWS ledger) |
| SG-SSH-06 / D-SG-23 | the `Ort` fold table (each spelling, `ssh+git:` NOT folded, `www.`, trailing dots, `.GIT`); `originMatchesSource` with an scp origin; `samePlannedSource` url-vs-github; the reserved name with `git@github.com:anthropics/…`; `deriveMarketplaceUrl` with an scp origin seeds; `hostFromCloneUrl` on scp does not throw; `canonicalCloneUrl` unchanged | unit | `test/domain/clone-key.test.ts`, `test/domain/name.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/orchestrators/auth-host.test.ts` | ✅ |
| SG-SSH-06 | a leftover SSH clone of a marketplace is recognized, not refused as `{stale clone}`; `add Acme/Tools` after `acme/tools` is already added; a reinstall after an SSH install reuses `plugin-clones/<key>/` | cucumber | `features/marketplace/add.feature`, `features/plugin/reinstall.feature` | ✅ (new rows) |
| Pitfall 1 | no test reaches github.com:22 | architecture or integration | `test/integration/auth-e2e.test.ts` with a stub on PATH | ✅ (change) |
| Hermetic | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` reaches only a scenario's own Pi | architecture | `npm run test:architecture` (`hermetic-git-environment.test.ts`) | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the pre-commit hook (`npm run check:commit`) plus the owner tests of the touched pairs.
- **Per wave merge:** `npm run check` on the combined tree (the GSD post-merge gate).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/domain/git-url.test.ts`: the iTs table
- [ ] `test/domain/github-transport.test.ts`: the plan table (both paths × three probe results × each skip check × win32)
- [ ] `test/orchestrators/github-transport.test.ts`: the runner (retry only on a clone-step failure; target cleared; both-failed)
- [ ] cucumber steps: register an ssh host arm (`Given ssh answers probes of github.com as {word}`, the proxy variant), `Then the ssh stand-in receives these launches:` (argv table, read with `mark()`/`launchesSince()`), a no-override profile with variables
- [ ] `features/marketplace/ssh-source.feature`, `features/marketplace/github-transport.feature`, `features/plugin/github-transport.feature` (names per `.agents/skills/cucumber/rules/layout.md`)
- [ ] the F-5 harness fix (require `httpsProxy` without the override)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirectly) | the user's ssh keys and agent, and git credential helpers; the extension holds no key; `BatchMode=yes`, `StrictHostKeyChecking=yes`, no prompt (SG-PRC-02) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | the `iTs` port for every git address; `--end-of-options` before operands; refusal of `-`-led refs and of scp/ssh users or hosts that start with `-` (`(?!-)`) |
| V6 Cryptography | no (transport crypto is git's and ssh's) | `git://` refused because it is unencrypted |
| V12 Files and Resources | yes | host-less `file:` only; clones stay in `plugin-clones/<key>/` and `sources/<name>/` (NFR-10) |
| V14 Configuration | yes | the user's git and ssh configuration is respected; repository config cannot change the ssh command (D-SG-05) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `ext::sh -c …` in a git-subdir `url` (F-2) | Tampering / EoP | refused at parse by the `iTs` gate, plus `protocol.ext.allow=never` as the second layer |
| an option smuggled through an scp host or user (`-oProxyCommand=…@h:p`) | EoP | the scp regex's `(?!-)`, the ssh user and host regexes, and operands after `--end-of-options` |
| a `file://host/share` UNC address that makes a Windows machine contact a server | Info disclosure / SSRF-like | the `file:` host and network-path refusal |
| the probe or a retry leaking a GitHub username or key path into output | Info disclosure | the probe's debug line holds only `code=<n> configured=<bool>`; no output names the ssh command (`sshChange`'s comment: "a user's ssh arguments can name key files"); the AUTH-09 gate covers git-process.ts |
| a manifest steering the transport to a hostile host through a lookalike GitHub spelling | Spoofing | `Mle` refusals in the fold (brackets, backslashes, non-ASCII hosts); the fold changes identity only, never the wire URL |
| a base override pair with `=` breaking the key so requests reach the real github.com | Tampering | GHB-03 refuses `=` in the base (existing) |
| the neutral directory path in a missing-ssh stderr (E-R3) | Info disclosure | redact absolute paths before any message (`shared/redact-absolute-paths.ts`) |

## Experiments run this session

All ran under `env -i HOME=<scratch>/home PATH=<stub>:/usr/bin:/bin GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`, in `/tmp/claude-0/-home-user-pi-claude-marketplace/f641c099-e3f5-563d-9ac5-9922f1b9e06a/scratchpad/research-04/x1`, with git 2.43.0, stub `ssh` scripts, and a local bare repository. No request left the machine.

| ID | Setup | Result |
|---|---|---|
| E-R1 | clone `git@github.com:o/r.git` with Pi's wrapped `GIT_SSH_COMMAND` + a stub that prints `git@github.com: Permission denied (publickey).`, exit 255 | stderr `git@github.com: Permission denied (publickey).` / `fatal: Could not read from remote repository.` + the access-rights paragraph; rc 128 → rows 90 then 126 match; row 90 (`ssh-auth`) wins |
| E-R2 | a stub that prints `No ED25519 host key is known for github.com and you have requested strict checking.` / `Host key verification failed.`, exit 255 | the same `fatal:` tail; rc 128 → row 88 `ssh-host-key-unknown` |
| E-R3 | no ssh, Pi's wrapper | `CDPATH= cd -- '<neutral>' 2>/dev/null \|\| cd / \|\| exit 1; ssh -o BatchMode=yes -o StrictHostKeyChecking=yes: 1: ssh: not found` + `fatal: Could not read from remote repository.`; rc 128 → row 126 `ssh-auth` |
| E-R4 | no ssh, no wrapper | `error: cannot run ssh: No such file or directory` / `fatal: unable to fork`; rc 128 → no ssh row |
| E-R5 | `ls-remote --get-url` with five `url.<base>/.insteadOf=` pairs (`https://github.com/`, `git@github.com:`, `ssh://git@github.com/`, `git+ssh://git@github.com/`, `ssh+git://git@github.com/`) | the five forms → `https://127.0.0.1:9/base/o/r.git`; `ssh://git@ssh.github.com:443/…`, `git@GitHub.com:O/R.git`, and `org-1@github.com:o/r.git` unchanged |
| E-R6 | a user `GIT_CONFIG_COUNT` `insteadOf` with the longer prefix `git@github.com:o/` beside Pi's pair | the user's rewrite wins (`https://github.com/r.git`) |
| E-R7 | `ls-remote` with `GIT_SSH_COMMAND="<wrapped> -G >&2"` and a `-G`-aware stub | network lane: the config lines on stderr (`hostname github.com`, `proxycommand none`), argv `-o BatchMode=yes -o StrictHostKeyChecking=yes -G -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'o/r.git'`, rc 128. Local lane: `fatal: transport 'ssh' not allowed` |
| E-R8 | a successful clone through the stub on PATH | argv `-o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'o/r.git'`; origin `git@github.com:o/r.git` |

## Sources

### Primary (HIGH confidence)
- `04-EVIDENCE.md` (this directory): the upstream reading of 2.1.332, cited throughout, not re-derived.
- `/opt/claude-code/bin/claude` 2.1.332, grepped this session: `iTs` and its constants, `KHi`, `$Ce`, `Ort`, `Rt`, `Tt`, `ye`, `Bo`, `ber`, `MJt`, `jZn`, `Mle`, `wjt`, `z4s`, `oJt`, `jt`, `mCn`, `Jxn`, `Jmt`, `Qmt`, `Xxn`, `zHi`, `Rqo`, `_Fi` (head).
- Repository files read this session (line ranges in §A).
- git 2.43.0 experiments E-R1..E-R8.

### Secondary (MEDIUM confidence)
- Phase 3 records: 03-SECURITY (F-2, F-5, R-1, R-2), 03-REVIEW-FIX (IN-01..IN-03 deferred), the 03-05/06/07/09/15 SUMMARYs.

### Tertiary (LOW confidence)
- Real OpenSSH and Windows behavior: unmeasured (A5, A6).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependency; every mechanism exists.
- Architecture: MEDIUM-HIGH. The seams and the threading route (`authMemo`) are verified; the module names and the port split are recommendations.
- Pitfalls: HIGH for the gates, the harness, and the stderr (measured); MEDIUM for the scenario count (a text scan, an upper bound).

**Research date:** 2026-11-25
**Valid until:** 2026-12-25 for the repository facts (the `features/system-git` branch moves fast; re-check line numbers at plan time). The upstream facts hold for 2.1.332 only.
