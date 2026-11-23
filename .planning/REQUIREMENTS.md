# Requirements: pi-claude-marketplace, milestone system-git (System Git)

**Defined:** 2026-11-22
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** clone and fetch marketplaces and git-source plugins with the system `git` binary, as Claude Code does, instead of `isomorphic-git`, so that a user who authenticates git over SSH can install from a private repository, and the extension needs no git credential of its own. It reverses D-21 and supersedes PRs #326 and #327 (issue #325).

**Evidence:** `.planning/research/SUMMARY.md` and its four detail files. Upstream facts are from the Claude Code 2.1.330 binary (grepped 2026-11-22) unless marked otherwise, and each is re-checked into the phase CONTEXT.md as an evidence record per `.agents/skills/claude-code-compat-research`.

**Open decisions:** a requirement that says "per discuss" depends on a question in SUMMARY.md "Open Questions for Discuss" (cited as `Q<n>`). The phase that owns the requirement answers it in discuss and records it as a `D-SG-NN` decision. A "no" answer that removes a capability moves the requirement to Out of Scope.

## v1 Requirements

### Harness (SG-HRN)

- [x] **SG-HRN-01**: The unit, integration, and cucumber suites build their fixture repositories and run every git operation with the system `git` binary under a hermetic environment (no user, system, or sandbox-injected git config, including `GIT_CONFIG_COUNT`, reaches a test).
- [x] **SG-HRN-02**: The cucumber HTTPS git-host stand-in is trusted by system git (`GIT_SSL_CAINFO` or `http.sslCAInfo`), serves fetch-by-SHA, and has a refusing arm for the fallback path.
- [x] **SG-HRN-03**: The cucumber suite can drive the SSH probe and SSH transport through a stand-in (stub `ssh` on `PATH` or `GIT_SSH_COMMAND`) with no real network.
- [x] **SG-HRN-04**: `test/architecture/hermetic-git-environment.test.ts` fails when any git- or ssh-steering variable (the `GIT_CONFIG_*` family, `GIT_SSL_CAINFO`, `GIT_SSH`, `GIT_SSH_COMMAND`, `SSH_AUTH_SOCK`, proxies, `XDG_CONFIG_HOME`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`) leaks into a test process, and CI logs the git version it ran.

### Git process seam (SG-PRC)

- [ ] **SG-PRC-01**: Every git (and ssh probe) process starts from one platform module that the `child-process-chokepoint` rule names, with no shell, argument arrays, `--end-of-options` before untrusted data, and closed stdin.
- [ ] **SG-PRC-02**: No git command can prompt or hang: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, `credential.interactive=false`, ssh `BatchMode=yes` and `StrictHostKeyChecking=yes` built on the user's own `core.sshCommand`, no controlling tty, and a timeout that kills the whole process group.
- [ ] **SG-PRC-03**: A cloned repository cannot run code or change behavior through git: repo hooks and fsmonitor are off, the `ext`, `fd`, `git`, `ftp`, and `ftps` protocols are refused, repository-pointer variables (`GIT_DIR` and the rest) are stripped, and `GIT_CEILING_DIRECTORIES` stops discovery from reaching the user's own project repository.
- [ ] **SG-PRC-04**: Commands that NFR-5 requires to be network-free run on a local lane that git itself keeps off the network (`protocol.allow=never`).
- [ ] **SG-PRC-05**: A git failure surfaces as a typed error whose kind (not found, auth, network, ref missing, timeout, git missing, and the rest) is read from git's exit status and stderr under `LC_MESSAGES=C`, and callers narrow on `instanceof`, never on a name or message substring.
- [ ] **SG-PRC-06**: A user with no usable `git` on `PATH` gets a clear message naming the requirement (with the macOS `xcode-select --install` form where it applies), and path-source and hosted-manifest marketplaces still work without git. Whether a non-git fallback exists is decided per discuss (Q1, Q3).

### Transport (SG-TRN)

- [ ] **SG-TRN-01**: Every operation `platform/git.ts` performs today (clone, fetch, checkout, ref and remote-ref resolution, tag listing and peeling, ref update, current branch, remotes) runs on system git behind the existing `GitOps` seam, and the custom HTTP redirect client and the isomorphic-git auth callbacks are gone.
- [ ] **SG-TRN-02**: A git clone uses the upstream shape: `--depth 1`, `--branch <ref>` when a ref is given, and a SHA pin through `fetch --depth 1 origin <sha>`, falling back to `--unshallow`, then checkout, then a check that `HEAD` equals the pin. A ref that starts with `-` or a malformed SHA is refused before git runs.
- [ ] **SG-TRN-03**: A marketplace update follows the update model chosen per discuss (Q9: keep the D-14 fetch-and-checkout refresh, or upstream's `ls-remote` freshness check then re-clone into staging and swap), stays atomic (NFR-1) and retry-safe (NFR-3), and follows a moved default branch and a moved tag.
- [ ] **SG-TRN-04**: Version-range resolution that reads tags (TAGS-01, D-03-03) keeps working with the clone depth chosen per discuss (Q10), with NFR-5 amended if a network tag read is chosen.
- [ ] **SG-TRN-05**: A git clone or fetch times out after 120 s by default, and `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` changes that limit as it does upstream (Q15).
- [ ] **SG-TRN-06**: When the remote is unreachable during a marketplace update and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` is set, the existing checkout is kept as upstream keeps it.
- [ ] **SG-TRN-07**: `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (D-MF-01) keeps, changes, or retires its behavior per discuss (Q8), and the harness reaches its GitHub stand-in either way.

### SSH and transport selection (SG-SSH)

- [ ] **SG-SSH-01**: A user can add a marketplace or install a plugin from `git@host:path`, `ssh://`, `git+ssh://`, and `ssh+git://` URLs, with upstream's validator; `git://` stays refused. This amends D-76-01 under its own decision ID; whether `http://` and the git-subdir object `url` change follows discuss (Q6).
- [ ] **SG-SSH-02**: For an `owner/repo` marketplace source, the extension runs upstream's SSH probe, clones over SSH first only when the probe reports SSH configured and over HTTPS otherwise, retries with the other transport on failure, and prints upstream's progress lines and its both-failed error.
- [ ] **SG-SSH-03**: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` makes every GitHub clone use HTTPS with no probe, as upstream does; `CLAUDE_CODE_REMOTE` is not read (Q16).
- [ ] **SG-SSH-04**: A `github` plugin source on install, update, and dependency install uses the probe, fallback, and skip rules of the upstream surface chosen per discuss (Q7: shell `claude plugin install`, or in-session `/plugin`).
- [ ] **SG-SSH-05**: On Windows, a plugin install follows upstream's Windows-only SSH-to-HTTPS retry.
- [ ] **SG-SSH-06**: A clone made over SSH is recognized as the same source as its HTTPS form (scp-aware origin identity), so it is never refused as a stale clone, and its `plugin-clones/<key>/` directory does not move.

### Credentials (SG-AUTH)

- [ ] **SG-AUTH-01**: A user authenticates git only through what the machine already holds (ssh keys and agent, git credential helpers such as gh's or Git Credential Manager); the extension has no git token of its own and never reads `GITHUB_TOKEN` or similar into a URL or header.
- [ ] **SG-AUTH-02**: The GitHub OAuth Device Flow is removed, or kept in the form chosen per discuss (Q2), and the AAP, autoapply, and autoupdate rules (D-PL8-12) are restated for the outcome.
- [ ] **SG-AUTH-03**: A user who stored a token through Device Flow keeps working over HTTPS with no action, the extension never deletes a stored credential, and any one-time notice follows discuss (Q5).

### Errors (SG-ERR)

- [ ] **SG-ERR-01**: Clone and fetch failures report Claude Code's message for each failure class (auth, SSH auth, not found, network, timeout, ref missing, both transports failed, git missing, and the rest), adapted only where Pi has no equivalent, with the exact set chosen per discuss (Q4).
- [ ] **SG-ERR-02**: No message, notice, or debug log shows a credential: userinfo in URLs and secrets in git's stderr are redacted, and git's own output never reaches stdout or stderr directly (IL-2).

### Migration (SG-MIG)

- [ ] **SG-MIG-01**: A clone that isomorphic-git made before the upgrade keeps working: its `core.symlinks`, `core.filemode`, and `core.ignorecase` settings are corrected and its checkout refreshed, or it is re-cloned, per discuss (Q5), with no `/reload` failure and no manual step.

### Submodules (SG-SUB)

- [ ] **SG-SUB-01**: A plugin clone fetches its submodules shallowly (`--recurse-submodules --shallow-submodules`, and `--no-recurse-submodules` where upstream uses it), with submodule URLs held to the same protocol and containment rules as the parent.
- [ ] **SG-SUB-02**: A marketplace clone skips submodules, then fetches only the submodules that hold plugin files, as Claude Code 2.1.295 and later do.

### Marketplace pins (SG-PIN)

- [ ] **SG-PIN-01**: A marketplace source pinned to a SHA ref clones and updates through the SHA path upstream uses for it.

### Close (SG-CLS)

- [ ] **SG-CLS-01**: `isomorphic-git` is no longer a dependency, and no production or test file imports it.
- [ ] **SG-CLS-02**: `.planning/PROJECT.md` records a decision with its own ID that reverses D-21, and the amendments the milestone makes to NFR-5, NFR-10, D-76-01, D-MF-01, D-PL8-12, and the AAP rules, each citing what it amends.
- [ ] **SG-CLS-03**: `README.md` and `README.es.md` state the git requirement and the SSH and HTTPS rules, and say what changed for Device Flow users; `.planning/codebase/*.md` and `CHANGELOG.md` describe the new transport.

## Future Requirements

None deferred. Every optional item the research listed is in scope by the maintainer's choice (2026-11-22).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reading `GITHUB_TOKEN`, `GH_TOKEN`, or similar into a URL or header | Upstream: an environment token alone does not authenticate. |
| A direct `gh auth token` shortcut (PR #326) | Upstream has none; its rejected-token retry never reaches the next path. Superseded by SG-AUTH-01. |
| A global Device Flow on/off setting (PR #327) | Rejected by the maintainer as the wrong shape. Superseded by SG-AUTH-02. |
| `StrictHostKeyChecking=accept-new` or any interactive prompt | Upstream requires the host already in `known_hosts` and never prompts. |
| Honoring `CLAUDE_CODE_REMOTE` | A Pi process can inherit it from a cloud shell; not a Pi signal. |
| A `--depth` or `--full` user option | Upstream has none. |
| A Git LFS pointer warning and `--sparse` marketplaces | Research rated them deferred; not needed for the milestone goal. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SG-HRN-01 | Phase 1 | Complete |
| SG-HRN-02 | Phase 1 | Complete |
| SG-HRN-03 | Phase 1 | Complete |
| SG-HRN-04 | Phase 1 | Complete |
| SG-PRC-01 | Phase 2 | Pending |
| SG-PRC-02 | Phase 2 | Pending |
| SG-PRC-03 | Phase 2 | Pending |
| SG-PRC-04 | Phase 2 | Pending |
| SG-PRC-05 | Phase 2 | Pending |
| SG-PRC-06 | Phase 2 | Pending |
| SG-TRN-01 | Phase 3 | Pending |
| SG-TRN-02 | Phase 3 | Pending |
| SG-TRN-03 | Phase 3 | Pending |
| SG-TRN-04 | Phase 3 | Pending |
| SG-TRN-05 | Phase 3 | Pending |
| SG-TRN-06 | Phase 3 | Pending |
| SG-TRN-07 | Phase 3 | Pending |
| SG-MIG-01 | Phase 3 | Pending |
| SG-SSH-01 | Phase 4 | Pending |
| SG-SSH-02 | Phase 4 | Pending |
| SG-SSH-03 | Phase 4 | Pending |
| SG-SSH-04 | Phase 4 | Pending |
| SG-SSH-05 | Phase 4 | Pending |
| SG-SSH-06 | Phase 4 | Pending |
| SG-AUTH-01 | Phase 5 | Pending |
| SG-AUTH-02 | Phase 5 | Pending |
| SG-AUTH-03 | Phase 5 | Pending |
| SG-ERR-01 | Phase 6 | Pending |
| SG-ERR-02 | Phase 6 | Pending |
| SG-SUB-01 | Phase 7 | Pending |
| SG-SUB-02 | Phase 7 | Pending |
| SG-PIN-01 | Phase 7 | Pending |
| SG-CLS-01 | Phase 8 | Pending |
| SG-CLS-02 | Phase 8 | Pending |
| SG-CLS-03 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---

*Requirements defined: 2026-11-22*
*Last updated: 2026-11-22 after roadmap creation (8 phases, 35/35 requirements mapped)*
