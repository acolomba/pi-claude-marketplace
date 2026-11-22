# Project Research Summary

**Project:** pi-claude-marketplace, milestone `system-git` (System Git)
**Domain:** Pi extension that installs Claude Code plugin marketplaces. This milestone replaces the `isomorphic-git` transport with the system `git` binary, as Claude Code does.
**Researched:** 2026-11-22
**Confidence:** HIGH for the integration map and for upstream behavior read from the Claude Code 2.1.330 binary. MEDIUM for phase boundaries and for git version-introduction facts. LOW for anything only the docs support.

Detail files: [STACK.md](./STACK.md), [FEATURES.md](./FEATURES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [PITFALLS.md](./PITFALLS.md).

## Executive Summary

The milestone swaps one module's engine. `platform/git.ts` has 13 isomorphic-git calls behind a stable `GitOps` seam, and each maps to a git subcommand. Claude Code does this the same way. It runs the machine's git with a pinned environment (no prompts, no askpass, SSH `BatchMode`, protocol denylist, `LC_MESSAGES=C`), clones shallow, pins SHAs with `fetch --depth 1 origin <sha>` then `--unshallow`, and has no git token of its own. The recommended build is a thin own wrapper over `node:child_process.spawn`, extracted from the launcher that `platform/package-manager.ts` already has. Add no dependency. Remove `isomorphic-git` from production, and from tests after about 37 test and feature files move their fixtures to system git.

The work is not mainly the transport. Three things carry the risk. First, system git reads the user's whole configuration (insteadOf, hooks, autocrlf, proxies, credential helpers). isomorphic-git read none of it, so every behavior difference needs an explicit "neutralize or respect" decision. Second, several assumptions in this tree were true only for isomorphic-git. Examples are full history for TAGS-01 local tag reads, a wildcard refspec after a single-branch clone, `origin/HEAD` following the server, and symlinks written as files in old clones. Third, the process model is new: process groups, stale lock files, repository discovery walking into the user's project repo under `<cwd>/.pi/`, and argument injection from untrusted marketplace data. Fix these in a single seam module so no call site can forget them.

Recommended order: harness first (tests must run on real git before the product does), then the spawn seam with typed errors, then the transport swap with shallow, pin, refresh, and old-clone normalization together, then SSH URL forms and transport selection, then the credential-surface removal, then message parity, then submodules, then closing records. Twenty-one questions are open for the user, and several change phase scope (Device Flow, git-only versus fallback, plugin fallback surface, marketplace shallow versus TAGS-01). Section "Open Questions for Discuss" lists all of them. The roadmapper should not decide any of them.

## Key Findings

### Recommended Stack

Add nothing to `package.json`. Floor git at 2.25, documented and not enforced by a version probe. Claude Code names 2.25 in its own message, and every argv flag the milestone needs exists by then. Do not set `GIT_CONFIG_NOSYSTEM` or `GIT_CONFIG_GLOBAL` in production, because the user's credential helpers (Git for Windows keeps `manager` in the system gitconfig), `insteadOf`, `core.sshCommand`, and proxy settings are the point of the milestone. Those variables stay test-only.

**Core technologies:**

- System `git` CLI (floor 2.25): clone, fetch, ls-remote, local ref reads. This is what upstream runs, and it brings SSH and credential helpers.
- Async `node:child_process.spawn`, `shell: false`, argv arrays, `--` and `--end-of-options` before data: `execFile` kills git at 1 MiB of stdout, and sync calls starve the state-lock refresh timer.
- One spawn module under `platform/` (proposed `platform/git-process.ts`), kept behind the existing `GitOps` seam. It extracts the process-group kill and absolute-PATH `.exe` resolution that D-PL9-15/18/19 already built in `package-manager.ts`.
- Reject `simple-git` (three RCE advisories from option injection), `execa`, and `dugite`. Reject a `cross-spawn` import. Reject `cwd`-first Windows lookup of a bare `git`.
- `isomorphic-git` becomes test-fixture-only at most, then is deleted. The lockfile loses its subtree.

### Expected Features

**Must have (table stakes, the milestone's P1):**

- System git transport behind `platform/git.ts`, non-interactive on every command, with protocol and hook hardening.
- Upstream clone shape: `--depth 1`, `--branch`, the SHA ladder (fetch by SHA, `--unshallow`, checkout, `rev-parse` must equal the pin, refuse refs starting with `-`, require 40/64 hex).
- Marketplace `owner/repo` transport: the SSH probe, SSH only when it reports `configured`, retry in both directions, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`. Add the upstream progress lines and the both-failed error.
- Accept `git@host:path`, `ssh://`, `git+ssh://`, and `ssh+git://` with upstream's validator, refusing `git://`. This answers issue #325 and needs an amendment of D-76-01 under its own ID.
- Error classification and wording per Claude Code's nine message classes, with URL-userinfo redaction, and a git-missing message (including the macOS `xcode-select` form).
- `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, default 120000 ms. The probe takes 3 s. The `ls-remote --get-url` and `ssh -G` checks take 5 s each.
- Marketplace update as `ls-remote` freshness check, then re-clone into staging and swap, plus `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`.
- Authentication only through what the machine holds. The Device Flow outcome follows discuss.

**Should have (after validation, or per discuss):**

- Plugin `github` probe and HTTPS fallback on `/claude:plugin install` (which upstream surface to mirror is a user question).
- Upstream's selective marketplace submodule rule. The first version may fetch every submodule.
- Windows SSH-first path for plugins.

**Defer:**

- Marketplace SHA-ref pin path (upstream gates it behind a flag), Git LFS pointer warning, `--sparse` marketplaces.

**Anti-features (do not build):**

- Reading `GITHUB_TOKEN` or `GH_TOKEN` into a URL or header, PR #326's `gh auth token` shortcut, PR #327's global Device Flow toggle, honoring `CLAUDE_CODE_REMOTE`, `StrictHostKeyChecking=accept-new`, interactive prompts, in-place `git pull` for marketplace update, and a `--depth` or `--full` knob.

### Architecture Approach

Keep the `GitOps` seam and the orchestrator call shape. Rewrite `platform/git.ts` verbs as git argv over one injected runner (`createGitRunner({ spawn, timeoutMs, ... })`, the `package-manager.ts` pattern). One pure builder returns the environment and the `-c` prefix for every command, local reads included, because a copied `.git` carries foreign config. Transport candidates (`[ssh, https]` for github) are resolved in `platform/`, and the cache identity stays fixed in `domain/clone-key.ts` (`canonicalCloneUrl`), so no `plugin-clones/<hash>` directory moves. The platform zone may import only `shared/`, so the candidate type lives in `shared/`.

**Major components:**

1. `platform/git-process.ts` (new) — the only git and ssh spawn site: env, `-c` hardening, timeout, abort scope (D-PL8-24, `AsyncLocalStorage` kept), process-group kill, capped output, redaction, git lookup.
2. `platform/git.ts` (rewritten) — same verbs as argv, transport selection for `owner/repo`, no HTTP client, no auth callbacks.
3. `shared/errors.ts` + `shared/git-failure-classifiers.ts` — typed `GitCommandError` family; the four name-matchers (`NotFoundError`, `CommitNotFetchedError`) become `instanceof`. This must land in the swap phase, or a deleted-branch refresh silently loses its detached-checkout fallback.
4. `domain/source.ts` + `domain/clone-key.ts` — admit scp and `ssh://` forms. `originMatchesSource` and `readOriginRemoteUrl` need scp-aware identity, or every SSH clone is refused as `StaleSourceCloneError`.
5. Auth surface to delete (if Device Flow goes): `platform/git-auth-callbacks.ts`, `platform/git-credential.ts`, `orchestrators/auth-host.ts`, `domain/github-auth.ts`, `domain/auth-registry.ts`, and the `credentialOps`/`deviceFlowHttp`/`authMemo` threading (233 occurrences in 23 production files, 47 test and feature files).
6. Gates to change in the same commits: fallow `isomorphic-git-chokepoint` (total ban or delete), `child-process-chokepoint` (add the spawn module and any `ssh`/`taskkill` launch), `test/architecture/{gate-targets,no-shell-out}`, ESLint `NETWORK_SEAMS` and a BLOCK C zone for the runner, `CREDENTIAL_LEAK_TARGETS` (positionally bound), `hermetic-git-environment.test.ts`.

### Critical Pitfalls

1. **Prompts and hangs** — `GIT_TERMINAL_PROMPT=0` covers only git's own prompt. Set `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, and `credential.interactive=false` (appended to any user `GIT_CONFIG_COUNT`). Spawn with `stdio: ["ignore","pipe","pipe"]`, `detached` on POSIX so ssh has no controlling tty, and a hard timeout. Pin SSH `BatchMode=yes` and `StrictHostKeyChecking=yes` the way Claude Code does (reading the user's `core.sshCommand`/`ssh.variant` first).
2. **User git config changes behavior** — a table of neutralize-or-respect rows (insteadOf, proxy, CA, hooks, autocrlf, LFS, fsmonitor, gc, locale, `advice.detachedHead`) with one unit row each. Strip repository-pointer variables (`GIT_DIR`, `GIT_WORK_TREE`, and the rest of the list in STACK.md). Never pass `safe.directory=*`.
3. **Repository discovery walks into the user's project** — a clone dir with no `.git`, under `<cwd>/.pi/`, makes `git -C` operate on the project repo (reproduced E-13), and D-14's `update-ref`/`checkout -f` would move the user's branch. Name the git dir explicitly, set `GIT_CEILING_DIRECTORIES`, and guard every destructive command.
4. **Assumptions that were true only for isomorphic-git** — shallow clones carry no tags (TAGS-01 local read breaks), `--single-branch` leaves a narrow refspec (PURL-04 refetch breaks), `fetch` does not move `origin/HEAD` (D-14 default-branch path follows the old branch), and a moved tag is not updated by a plain `fetch origin <tag>`. Old clones also carry `core.symlinks=false`, so symlinks revert to text files (reproduced E-0b).
5. **Argument injection, dangerous transports, and process lifetime** — marketplace data controls URL, ref, sha, and tag names (`--upload-pack=` ran a command, E-6). Use `--end-of-options`, scheme allow-list, `-c protocol.allow=never` plus explicit https/ssh, and a local lane that carries `protocol.allow=never` (E-20) so NFR-5 is enforced by git itself. Kill the process group (a direct-child kill leaked `git-remote-http`, E-10k), and expect stale `*.lock` files after an abort (NFR-3).

## Implications for Roadmap

Suggested phase structure (eight phases, numbering restarts at 1 for this milestone). Phase 3 is the largest and may be split by the roadmapper into "verbs and typed errors" and "shallow, pins, refresh, old-clone normalization".

### Phase 1: Harness readiness on system git

**Rationale:** Tests must run on real git before the product does, and the cucumber suite stops working the moment the transport changes (system git ignores `NODE_EXTRA_CA_CERTS`). ARCHITECTURE.md and PITFALLS.md both put this first.
**Delivers:** Fixture builders (`test/platform/git-test-repository.ts` and about 15 importers) rewritten on system git under the hermetic env; `GIT_SSL_CAINFO` (or `http.sslCAInfo`) for the HTTPS stand-in; a stub `ssh` on `PATH` for the probe; the stand-in allowing SHA wants and a refusing arm; `hermetic-git-environment.test.ts` extended (add `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n`/`PARAMETERS`, `GIT_SSL_CAINFO`, `GIT_SSH_COMMAND`, `GIT_SSH`, `SSH_AUTH_SOCK`, proxies, `XDG_CONFIG_HOME`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`); `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` in e2e for determinism; git version logged in CI.
**Avoids:** Pitfall 9 (harness works for the wrong reason), Pitfall 2 (cloud sandbox injects `url.insteadOf` through `GIT_CONFIG_COUNT`).

### Phase 2: Git process seam and typed failures

**Rationale:** Every later phase needs one hardened spawn site, and the allow-list change is small and reviewable alone. ARCHITECTURE.md's "runner and typed errors" and PITFALLS.md's P-Spawn agree. PITFALLS.md also asks for classification early (Pitfall 13), so the error kinds belong here and the wording parity waits for Phase 6.
**Delivers:** `platform/git-process.ts` with the env and `-c` builder, local lane versus remote lane, repo-discovery guard, timeout, abort scope, group kill, output cap, git-missing and version detection, absolute-PATH resolution on Windows (shared with `package-manager.ts`), stderr redaction. The `GitCommandError` family with `kind` from stderr and exit code under `LC_MESSAGES=C`. Rule-pack, `gate-targets.ts`, `no-shell-out.test.ts`, ESLint BLOCK C updates in the same commits. Land it with its first consumer (for example `listRemotes` or `currentBranch`) so `fallow dead-code` stays green with no `ignoreExports` marker.
**Uses:** the `package-manager.ts` launcher, extracted so `fallow dupes` stays clean.
**Avoids:** Pitfalls 1, 2, 3, 6, 8 (kill and wait), 10, 11, 12, 13.

### Phase 3: Transport swap, upstream clone shape, and old-clone normalization

**Rationale:** Land shallow clone, SHA ladder, and re-baselined request tables together, so the 79 cucumber request tables change once (ARCHITECTURE.md Anti-Pattern 4). Old clones must be handled in the same phase because the swap is what makes `symlinks=false` and a stale `origin/HEAD` bite (PITFALLS.md Pitfall 7).
**Delivers:** Every `platform/git.ts` verb on the runner; the HTTP client and `git-auth-callbacks.ts` deleted; `instanceof` at the matcher sites; `--depth 1`, `--branch`, the SHA ladder, tag peeling through one `for-each-ref`; default-branch tracking through `ls-remote --symref`; marketplace update per open question 9; GHB-01 per open question 8; normalization of isomorphic-git clones (config fix plus re-checkout, or re-clone on next network operation). The `auth?` members stay on `GitOps` only if discuss keeps a Device Flow retry.
**Avoids:** Pitfalls 4, 5, 7, 16, 17.
**Mapped features:** shallow/branch/SHA clone shape, marketplace freshness check and re-clone-and-swap, KEEP_MARKETPLACE_ON_FAILURE, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`.

### Phase 4: SSH URL forms and transport selection

**Rationale:** isomorphic-git has no SSH, so this cannot be built or tested before Phase 3. D-76-01's reason disappears with the swap, so its amendment is a prerequisite recorded first (FEATURES.md).
**Delivers:** The amendment of D-76-01 (own ID). `domain/source.ts` accepts `git@host:path`, `ssh://`, `git+ssh://`, `ssh+git://` with upstream's validator; `git://` stays refused. scp-aware identity in `clone-key.ts`, the leftover recognizer, and `readOriginRemoteUrl`. The SSH probe, marketplace ordering and bidirectional retry with the upstream progress lines, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, the D-MF-01 interplay, and plugin `github` behavior per open question 7. A cucumber scenario per visible change (AGENTS.md "Behavioral tests").
**Avoids:** Pitfall 15 (probe cost and loops), Pitfall 6 (scheme allow-list).

### Phase 5: Credential surface

**Rationale:** The Device Flow decision lands after behavior is proven on real git, so Phases 3 and 4 stay green whichever way discuss decides (ARCHITECTURE.md). It is mechanical and wide, so it gets its own reviewable phase.
**Delivers:** If Device Flow is removed: delete `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, the `auth-host.ts` builders, the 23-file threading, the `fetch-chokepoint` exemption, `CREDENTIAL_LEAK_TARGETS` entries (edit the positional pair together), and the device-flow feature and stand-in; rewrite the AAP and D-PL8-12 rules as "git is non-interactive"; one-time notice for users with Device Flow state. If kept: a retry-after-`auth`-failure shim, with the token-exposure trade-off decided.
**Avoids:** Pitfall 14 (stranded users, leftover tokens), Pitfall 18.

### Phase 6: Failure-message parity

**Rationale:** Wording references transports and remedies that only exist after Phase 4.
**Delivers:** The nine marketplace message classes, the plugin-clone wording, `git is not installed ... xcode-select --install`, `Command 'git' not found or is in an unsafe location`, the dubious-ownership message, redaction tests, and the closed D-PL7-01 reason set mapped from `GitCommandError.kind`. Wording is IL-1 English-only and goes through `notify()` (IL-2).
**Avoids:** Pitfall 13 (classification drift), UX pitfalls (private repo reported as not found).

### Phase 7: Submodules

**Rationale:** Highest security risk (CVE-2024-32002, CVE-2025-48384 class) and not needed by the SSH goal, so it comes after the core is stable. It is the first cut candidate if the milestone must shrink.
**Delivers:** Plugin clones with `--recurse-submodules --shallow-submodules` (and `--no-recurse-submodules` where upstream does), `protocol.file.allow=never`, per-submodule containment, `GIT_LFS_SKIP_SMUDGE=1` hardening review. The marketplace selective-submodule rule is optional (P2).
**Avoids:** Pitfalls 6 and 16.

### Phase 8: Close

**Rationale:** The dependency can be deleted only after the last test importer is gone, and the records must cite the new decision.
**Delivers:** `isomorphic-git` removed (`fallow dead-code --trace-dependency isomorphic-git` clean), rule pack `isomorphic-git-chokepoint` turned into a total ban or removed, the new decision that reverses D-21, amendments to NFR-5, NFR-10, D-MF-01, D-PL8-12, `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS}.md`, `README.md` and `README.es.md` together (git requirement, SSH and HTTPS rules, Device Flow change), CHANGELOG, and the version-bump offer.

### Phase Ordering Rationale

- Fixtures before transport, runner before swap, swap before SSH, SSH before message parity, and the Device Flow removal late. Each phase leaves `npm run check` green.
- Shallow, SHA ladder, and re-baselined tables share Phase 3, because splitting them rewrites the same 79 request tables twice.
- Classification kinds are early (Phase 2) and wording is late (Phase 6). The files disagreed here, and this reconciles them.
- Submodules are late because they carry the largest remote-code-execution surface.

### Where the Four Files Disagreed

| Topic | STACK | FEATURES | ARCHITECTURE | PITFALLS | Resolution here |
|---|---|---|---|---|---|
| Phase labels and count | none | priority tiers only | 7 numbered phases | 8 labels (P-Spawn, P-Transport, P-URL, P-Errors, P-Auth, P-Migrate, P-Harness, P-Close) | 8 phases above. P-Migrate folds into Phase 3, P-Errors splits across 2 and 6. |
| Harness timing | CA trust noted | test infra last in dependency graph | first | "early" | First. |
| Device Flow | remove or keep both costed | recommend remove | keep as retry shim in the swap, delete in a later phase | decide in discuss; notes helper tokens keep working | Order tolerates both. Decision left open. |
| Old clones | not covered | "migration" listed open | "no migration, system git reads them" | Reproduced breakage: `symlinks=false`, stale `origin/HEAD` | Prefer the experiment (PITFALLS). Normalization or re-clone is needed in Phase 3. |
| Marketplace update | `fetch` plus checkout equivalents | binary: `ls-remote`, then re-clone and swap, never `fetch` | keeps D-14 fetch shape | suggests staging copy | Prefer the binary. Open question 9, because it changes `refreshGitHubClone`. |
| GHB-01 / D-MF-01 | `-c url.<base>.insteadOf` | host rule open | Option A `-c insteadOf` | do not use config; pass explicit wire URL | Open question 8. The probe-skip interplay differs between the designs. |
| Probe cache and skip rules | skip when rewrite exists | binary: marketplace path always probes, no cross-command memo. Skip only on the plugin CLI install path, where it means SSH only | probe skipped under `GIT_SSH_COMMAND`, insteadOf, and so on, cached per process | same as ARCHITECTURE | Prefer FEATURES (binary). ARCHITECTURE and PITFALLS described the plugin-install rules as general. |
| SSH BatchMode | pin `core.sshCommand` with BatchMode after reading the user's value (binary) | same (binary) | `GIT_SSH_COMMAND` only if user set neither | do not add BatchMode through `GIT_SSH_COMMAND`/`core.sshCommand` | Prefer STACK and FEATURES (binary). PITFALLS's concern, losing the user's `-i` key or agent, is met by the read-then-append sequence. |
| Locale | `LC_MESSAGES=C`, `LC_ALL` moved to `LC_CTYPE` (binary) | same | not covered | `LC_ALL=C`, `LANGUAGE=` | Prefer the binary form. |
| Hooks and fsmonitor off | in-checkout `core.hooksPath=/dev/null` etc. | binary shows the hardening list, command coverage MEDIUM | `-c core.hooksPath=` on every command | neutralize, "check whether CC does" | Upstream does it (binary). Parity, so no divergence ID needed. |
| Marketplace shallow | `--depth 1` as CC parity, flags the tag problem | binary: `--depth 1`, dropped only for a SHA ref | shallow | warns TAGS-01 breaks; keep full or fetch tags | Upstream is shallow. TAGS-01 and NFR-5 conflict is open question 10. |
| Timeout | 120 s and env var from binary | same (binary) | "LOW" from docs | "re-check" | Settled by binary: 120000 ms, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`. |
| Retry directions | not covered | binary: marketplace retries both ways. Plugin CLI install retries HTTPS to SSH only (SSH to HTTPS retry on Windows only). In-session installs and updates go SSH only | "HTTPS fallback and SSH retry" generally | "in-session installs don't fall back" | Prefer FEATURES (binary). |

### Research Flags

Phases needing `/gsd-plan-phase --research-phase`:

- **Phase 2:** verify against the binary which commands carry the in-checkout hardening list (`uxt`), `GIT_ASKPASS=""` precedence, and Windows tty and process-tree handling (no Windows host was available). Needs a real macOS and Windows check by hand.
- **Phase 3:** riskiest phase. Verify `git fetch --force` behavior for moved tags, `followRemoteHEAD` and `origin/HEAD` handling across git versions, `--unshallow` cost and timeout, SHA wants on v0 servers, the symlink and autocrlf decisions, and the trace of TAGS-01 callers. Baseline all 79 request tables.
- **Phase 4:** the probe's `ssh` launch versus `git ls-remote git@github.com:...` (they prove different things), plugin fallback hand-off to dependency installs, and whether `marketplace add ssh://...` parses as a `git` source.
- **Phase 7:** advisory re-check for the submodule CVE fix versions, the `directoryPin` trigger, and upstream's selective rule.

Standard patterns (skip research):

- **Phase 1:** the harness already runs `git http-backend` and credential-store steps work unchanged.
- **Phase 5:** mechanical deletion once discuss decides. It is wide, not deep.
- **Phase 6:** the message table is already captured in FEATURES.md E-SG-10.
- **Phase 8:** records, docs, and dependency removal.

## Open Questions for Discuss

None of these is decided here. Group A holds the five already planned for discuss. Groups B to D hold the questions the research raised. Each follows the compat-research option format in discuss: upstream behavior, options, and which license (a recorded ID, or a Pi capability gap) a divergence would need.

### A. Planned for discuss

1. **Git only or an isomorphic-git fallback.** Upstream has no fallback and tells the user to install git. A fallback means two transports, two classifier sets, two auth paths, no SSH on the fallback, and a doubled test matrix. Research recommends git only.
2. **Device Flow: remove or keep.** Removal is upstream parity ("no git token of its own") and moots #326 and #327. Keeping needs a recorded divergence, runs as retry-after-failure (git cannot call back into Node), and exposes the token in `/proc/<pid>/environ` unless a helper stores it. Research recommends removal.
3. **How common missing git is (Windows).** No upstream data. Feeds question 1. Also whether to ship a macOS `xcode-select` message and a Windows lookup message.
4. **Error and classification parity.** Which of upstream's nine marketplace classes and the plugin-clone wording to copy exactly, and whether the telemetry buckets matter (IL-4 forbids telemetry).
5. **Migration of old clones and keychain entries.** Normalize in place (`core.symlinks`, `ignorecase`, `filemode`, re-checkout) or re-clone on next network operation. Existing Device Flow tokens stay in the user's helper and system git over HTTPS uses them automatically. Never delete them automatically. Decide on a one-time notice, and whether the GitLab provider's short-lived tokens warrant a message.

### B. Decisions and amendments with new IDs

6. **Amend D-76-01 (SSH URL forms).** Accept `git@host:` and `ssh://` (and `git+ssh://`, `ssh+git://`) only, or also `http://`, which upstream accepts but D-PL5-04/05/33 refuse? Also whether the git-subdir object form, which has no URL gate today, gets one.
7. **Plugin `github` fallback scope.** Mirror `claude plugin install` (probe plus HTTPS fallback), or the in-session `/plugin` install (SSH only unless `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`)? Pi has no shell-versus-session split. Also whether `plugin update` and dependency installs stay SSH-only as upstream has them. Neither choice has a license by itself.
8. **D-MF-01 (`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`).** Keep it as `-c url.<base>/.insteadOf=https://github.com/` (STACK, ARCHITECTURE), pass an explicit wire URL on every remote command with a canonical origin on disk (PITFALLS), or retire it for the user's own `insteadOf` in the harness? Which host gets the SSH URL, and is the probe skipped under it? Upstream has no override.
9. **Marketplace update model.** Keep D-14 `fetch`, `resolve`, `update-ref`, `checkout`, or adopt upstream's `ls-remote` freshness check then re-clone into staging and swap (with `.bak`)? The second fits NFR-1 and NFR-3 and removes the `origin/HEAD` problem, but it rewrites `refreshGitHubClone`, `update-preflight.ts`, and `clone-cache.ts`.

### C. Constraints the swap changes

10. **Shallow marketplace clones versus TAGS-01 and NFR-5.** Upstream clones marketplaces `--depth 1`, and a shallow clone carries no tags. Options: keep marketplace clones full (diverges), fetch tags once at add or update (`fetch --depth 1 origin 'refs/tags/*:refs/tags/*'`), or move the marketplace tag probe to `ls-remote --tags` and amend NFR-5 and D-03-03 to allow that network read.
11. **Local-lane and network-lane enforcement.** Amend NFR-5, ESLint BLOCK F `NETWORK_SEAMS`, and the rule pack to list the SSH probe as network, and whether the local lane carries `-c protocol.allow=never` as a git-enforced guarantee.
12. **NFR-10 amendment.** Writes git makes through the user's configuration (`~/.git-credentials` on `approve`, `known_hosts`) are outside the containment roots. Record that, or forbid host-key writes (`StrictHostKeyChecking=yes` already does).
13. **Where the state lock sits.** A 120 s clone inside the scope lock holds it that long. Clone into staging outside the guard where the ledgers allow, or accept the longer hold.

### D. Behavior neutralization and parity

14. **Hooks, autocrlf, and `origin/HEAD`.** The binary shows upstream disables hooks, fsmonitor, askpass, and sets `core.longpaths`. Confirm the full in-checkout list. `core.autocrlf` is not neutralized upstream as far as is known, so decide whether to keep the user's setting (parity) or force bytes-as-committed (needs a divergence ID, and `.gitattributes` still applies). Git for Windows defaults to `autocrlf=true`, which would rehash every path-source plugin version on Windows. Also how to track the default branch (`ls-remote --symref` versus `remote set-head`).
15. **Timeout environment variable.** Read `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (upstream name, default 120000 ms) rather than a `PI_` alias, and what the explicit-install plugin clone timeout is (unverified upstream).
16. **Env variables to honor.** Read `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` by their upstream names. Do not read `CLAUDE_CODE_REMOTE` (a Pi process could inherit it from a cloud shell). Record that omission as a Pi capability gap.
17. **Git version floor.** Document 2.25 (upstream's) or higher. `--end-of-options` needs 2.24 and submodule CVE fixes need newer, `--ref-format` needs 2.45 (upstream pins `init.defaultRefFormat=files` as a `-c` key that older git ignores), `GIT_CONFIG_COUNT` needs 2.31. Whether to enforce through a version probe or only document it, and whether CI gets a floor-version leg.
18. **SSH probe mechanism.** Spawn `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` as upstream does (admit `ssh` in the child-process chokepoint), or re-express it as `git ls-remote`. Also whether the probe result is cached (upstream does not across commands) given the 1 to 10 s cost for users with no key.
19. **Symlinks and containment.** Whether to adopt upstream's copy rules for symlinks (preserve inside the plugin, dereference inside the marketplace, skip outside) or keep in-place roots, and whether NFR-10 checks switch to `realpath`.
20. **Submodule scope.** Fetch every submodule in the first version, or implement upstream's selective rule (v2.1.295 and later). Also the `directoryPin` exception, which looks tied to Anthropic's directory and was not traced.
21. **Scope of the first release.** Whether Phase 7 (submodules) and the Windows SSH-first plugin path ship in this milestone, since both are P2 or lower.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Codebase facts read at file and line. Claude Code 2.1.330 invocation shape read from the binary. Flags checked with git 2.43.0. Per-flag introduction versions are MEDIUM (git-scm.com was unreachable). |
| Features | HIGH for marketplace and plugin clone paths | Read in the binary and confirmed by docs. MEDIUM for background-autoupdate wiring, plugin clone timeouts, and the SHA-ref marketplace path. |
| Architecture | MEDIUM | The integration map (every caller, every gate) is HIGH. The proposed components and build order are design inference, and ARCHITECTURE.md relied on docs only for upstream behavior (LOW per the seam), which the binary later corrected in places. |
| Pitfalls | HIGH for the 20 reproduced experiments | All on git 2.43.0 and Linux only. Windows and macOS items are unrun. CVE fix versions and Git for Windows defaults are from memory (MEDIUM). |

**Overall confidence:** HIGH for what to build and why, MEDIUM for exact phase boundaries and the Windows behavior.

### Gaps to Address

- **Windows and macOS were never run.** Process-tree kill with `taskkill`, no-tty ssh behavior, `core.autocrlf` rehash, `EPERM` on rename, and git lookup order are unverified. Plan a manual check in Phase 2.
- **Upstream facts not traced to the binary:** explicit-install plugin clone timeout, whether the CLI install's fallback context reaches dependency members, `directoryPin`, the hop from background trigger to bulk refresh, the in-checkout hardening command coverage, and whether `marketplace add ssh://...` parses as a `git` source. Each needs a narrower grep in the phase that uses it. Re-check minified function names per build, and carry quoted string literals into phase CONTEXT.md evidence records.
- **Experiments cover git 2.43.0 only.** CI's newer git differs (`followRemoteHEAD` 2.48, `--revision` 2.49). Pin the version in the CI log, and classify on exit codes and stable stderr prefixes.
- **`origin/HEAD` current isomorphic-git behavior** was observed to follow the server (E-8) but should be re-verified in Phase 3 before the fix is designed.
- **Cucumber re-baseline cost** (79 request tables across 20 feature files) is an estimate. Measure it in Phase 1.

## Sources

### Primary (HIGH confidence)

- Claude Code 2.1.330 binary `/opt/claude-code/bin/claude` (build 2026-11-20): `strings` and `grep` of the clone, probe, env, and error code. Source of the invocation shape, timeouts, message classes, and the probe and fallback rules.
- This repository, read 2026-11-22: `platform/git.ts`, `platform/git-credential.ts`, `platform/git-auth-callbacks.ts`, `platform/package-manager.ts`, `orchestrators/marketplace/{shared,add,update}.ts`, `orchestrators/plugin/clone-cache.ts`, `domain/{source,clone-key}.ts`, `shared/git-failure-classifiers.ts`, `rule-packs/architecture.json`, `eslint.config.js`, `test/architecture/*`, `features/lib/https-git-host/*`, `.planning/PROJECT.md`.
- Experiments E-0 to E-20 (PITFALLS.md): git 2.43.0, Node 24, isomorphic-git 1.44.10.

### Secondary (MEDIUM confidence)

- Claude Code docs: host-marketplace, plugin-marketplaces, troubleshooting, cli-reference (fetched 2026-11-22). Corroborating only, since the confidence seam rates web fetch LOW.
- Pi 1.5.1 `package-manager.js` as precedent for system git with `GIT_TERMINAL_PROMPT=0`.
- gitprotocol-v2, Git 2.31 and 2.56 release notes, git BreakingChanges.

### Tertiary (LOW confidence, validate in the phase that relies on it)

- libuv Windows `search_path` mirror, node-which cwd behavior, Claude Code issues 96811 and 13798 (user reports), git `prompt.c` askpass order, Git for Windows `autocrlf` default, CVE fix versions, GitHub and GitLab token lifetimes.

---

*Research completed: 2026-11-22*
*Ready for roadmap: yes, after discuss resolves questions 1, 2, 7, and 10 (they change phase scope)*
