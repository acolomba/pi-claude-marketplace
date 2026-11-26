# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **system-git** System Git
- ✅ **integration-rescope** Integration Test Rescope — completed 2026-11-23 on branch `claude/stoic-shannon-la9q7o` (pushed, no PR or npm release yet; version stays 0.23.0); 9 phases (one inserted), 26 plans, 22/22 requirements. [Archive](milestones/integration-rescope-ROADMAP.md), [requirements](milestones/integration-rescope-REQUIREMENTS.md), [audit](milestones/integration-rescope-MILESTONE-AUDIT.md).
- ✅ **parity-gaps** Claude Code Parity Gaps and Defects — completed 2026-11-17 on branch `features/gaps` (not yet pushed, no PR or npm release; version stays 0.23.0); 11 phases, 102 plans, 42/42 requirements. [Archive](milestones/parity-gaps-ROADMAP.md), [requirements](milestones/parity-gaps-REQUIREMENTS.md), [audit](milestones/parity-gaps-MILESTONE-AUDIT.md).
- ✅ **behavioral-gaps** Behavioral Coverage Gaps — completed 2026-11-08 on branch `features/behavioral-gaps` (not yet pushed, no PR or npm release yet); 16 phases, 36 plans, 34/34 requirements. [Archive](milestones/behavioral-gaps-ROADMAP.md), [requirements](milestones/behavioral-gaps-REQUIREMENTS.md), [audit](milestones/behavioral-gaps-MILESTONE-AUDIT.md).
- ✅ **mcp-builtin** MCP Built-in — completed 2026-11-05 on branch `features/mcp-builtin` (PR [#303](https://github.com/acolomba/pi-claude-marketplace/pull/303), version 0.23.0, not yet merged; user review done 2026-11-06, review fixes merged); 6 phases, 55 plans, 31/31 requirements. [Archive](milestones/mcp-builtin-ROADMAP.md), [requirements](milestones/mcp-builtin-REQUIREMENTS.md), [audit](milestones/mcp-builtin-MILESTONE-AUDIT.md).
- ✅ **component-features** Component Behavioral Tests — completed 2026-11-03 on branch `claude/quirky-planck-hhm592` (first closed 2026-11-02, reopened for the user's decisions; PR [#295](https://github.com/acolomba/pi-claude-marketplace/pull/295), no npm release yet); 8 phases, 65 plans, 62/62 requirements. [Archive](milestones/component-features-ROADMAP.md), [requirements](milestones/component-features-REQUIREMENTS.md), [audit](milestones/component-features-MILESTONE-AUDIT.md).
- ✅ **plugin-lifecycle** Marketplace and Plugin Lifecycle Backlog — completed 2026-10-29 on branch `features/plugin-lifecycle-p11` in PR #290 (not yet merged, no npm release); 11 phases, 80 plans, 64/64 requirements. [Archive](milestones/plugin-lifecycle-ROADMAP.md), [requirements](milestones/plugin-lifecycle-REQUIREMENTS.md), [audit](milestones/plugin-lifecycle-MILESTONE-AUDIT.md).
- ✅ **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- ✅ **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- ✅ **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- ✅ **mcp-4** MCP 4 — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- ✅ **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221). [Archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md).
- ✅ **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md).
- ✅ **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205). [Archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md).
- ✅ **test-backlog** — completed 2026-09-18. [Archive](milestones/test-backlog-ROADMAP.md).
- ✅ **refine-unit-tests** — completed 2026-09-13. [Archive](milestones/refine-unit-tests-ROADMAP.md).
- ✅ **v1.19 Unit Test Refactor** — completed 2026-09-04. [Archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

### In progress system-git -- System Git

**Milestone goal:** Clone and fetch marketplaces and git-source plugins with
the system `git` binary, as Claude Code does, instead of `isomorphic-git`, so
that a user who authenticates git over SSH can install from a private
repository, and the extension needs no git credential of its own. The
milestone reverses D-21, answers issue #325 at its root cause
(`isomorphic-git` has no SSH transport), and supersedes PRs #326 and #327,
which the maintainer handles outside this milestone.

Inputs: `.planning/PROJECT.md` (Current Milestone), `.planning/REQUIREMENTS.md`
(35 `SG-` requirements), and `.planning/research/SUMMARY.md` with its four
detail files (`STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`).
Baseline: the Claude Code 2.1.330 binary, read 2026-11-22. The research
experiments (E-0 to E-20) ran on git 2.43.0, Node 24, and Linux only.

#### Order and gates

Phases run in numeric order, one at a time. The order is SUMMARY.md's: test
fixtures before the transport, the process seam before the swap, the swap
before SSH, SSH before the credential removal and the message wording,
submodules late because they carry the largest code-execution surface, and
the close last. No requirement forced a change to that order. Phase 3 stays
one phase (see its Notes).

| Phase | Main code area | Open questions its discuss step answers | Research flag |
| --- | --- | --- | --- |
| 1 | test fixtures, cucumber stand-ins, `test/architecture/` | none | no (standard patterns) |
| 2 | new `platform/` git process module, `shared/errors.ts`, rule pack, ESLint | Q1, Q3, Q11, Q12, Q14 (hardening list), Q17 | yes |
| 3 | `platform/git.ts`, `orchestrators/marketplace/`, `orchestrators/plugin/clone-cache.ts`, cucumber request tables | Q5 (old clones), Q8, Q9, Q10, Q13, Q14 (autocrlf, default branch), Q15, Q16 (keep on failure), Q19 | yes (riskiest phase) |
| 4 | `domain/source.ts`, `domain/clone-key.ts`, transport selection in `platform/git.ts` | Q6, Q7, Q16 (prefer HTTPS, `CLAUDE_CODE_REMOTE`), Q18, Q21 (Windows SSH-first) | yes |
| 5 | `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, `orchestrators/auth-host.ts` | Q2, Q5 (stored credentials, notice) | no (wide, not deep) |
| 6 | git failure messages, `shared/git-failure-classifiers.ts` | Q4 | no (table in FEATURES.md E-SG-10) |
| 7 | plugin and marketplace clone paths | Q20, Q21 (submodules) | yes |
| 8 | `package.json`, rule pack, PROJECT.md, READMEs, codebase docs, CHANGELOG | none | no |

Four questions change what their phase builds (SUMMARY.md): Q1 (Phase 2),
Q2 (Phase 5), Q7 (Phase 4), and Q10 (Phase 3). Two of them reach other
phases. A fallback chosen for Q1 keeps `isomorphic-git`, so SG-CLS-01 moves
to Out of Scope. Phase 3 deletes the `isomorphic-git` auth callbacks before
Phase 5 answers Q2, so Phase 3's discuss step settles how the Device Flow
scenarios stay green until Phase 5: an interim retry after an auth failure,
as ARCHITECTURE.md suggests, or Q2 answered early.

#### Milestone rules

- **Upstream parity.** Claude Code 2.1.330 is the reference for every
  expected behavior. Re-check each upstream claim against the binary and
  carry it into the phase CONTEXT.md as an evidence record, per
  `.agents/skills/claude-code-compat-research`. A divergence needs a recorded
  decision ID or a Pi capability gap.
- **Open questions.** SUMMARY.md's Q1 to Q21 are open, and this roadmap
  decides none of them. The phase that lists a question answers it in its
  discuss step, with the compat-research option format, before any plan is
  written, and records the answer in PROJECT.md as a `D-SG-NN` decision. A
  "no" that removes a capability moves the requirement to Out of Scope in
  REQUIREMENTS.md.
- **Green gate.** Every phase leaves `npm run check` green on the combined
  tree. A gate the phase changes (the `child-process-chokepoint`,
  `isomorphic-git-chokepoint`, and `fetch-chokepoint` rules, ESLint BLOCK C
  and BLOCK F `NETWORK_SEAMS`, `test/architecture/gate-targets.ts`,
  `no-shell-out.test.ts`, `hermetic-git-environment.test.ts`, and
  `CREDENTIAL_LEAK_TARGETS`) changes in the same commit as the code it gates.
- **Behavioral tests.** A change to `/claude:plugin` behavior that a user can
  see ships with a cucumber scenario under `features/` that fails without the
  change (AGENTS.md). Unit tests and direct coverage do not replace it.
- **User git configuration.** SUMMARY.md recommends that production keep the
  user's git configuration (credential helpers, `insteadOf`,
  `core.sshCommand`, proxies) and that only tests set `GIT_CONFIG_NOSYSTEM`
  and `GIT_CONFIG_GLOBAL`. Each setting the transport neutralizes or respects
  gets one unit row (PITFALLS.md Pitfall 2); Q14 decides the contested rows.
- **Platforms.** No Windows or macOS host ran the research. CI runs Linux.
  Windows and macOS behavior is pinned by unit tests with the platform
  injected, and Phase 2 plans one manual check by hand on each.
- **Records.** Each `D-SG-NN` decision lands in PROJECT.md in the phase that
  makes it. Phase 8 checks the set and writes the amended constraint text.

- [x] **Phase 1: Harness on System Git** - The test suites build fixtures and run git with the system binary under a hermetic environment, and the cucumber stand-ins serve system git over HTTPS and SSH (completed 2026-11-23)
- [x] **Phase 2: Git Process Seam and Typed Failures** - Every git process starts from one hardened module that cannot prompt, hang, or run repository code, a git failure arrives as a typed error with a kind, and a missing git gets a clear message (completed 2026-11-23)
- [x] **Phase 3: System Git Transport and Clone Shape** - Marketplaces and git-source plugins clone, fetch, and update with system git in Claude Code's shape, and clones made before the upgrade keep working (completed 2026-11-24)
- [ ] **Phase 4: SSH Sources and Transport Selection** - A user adds a marketplace or installs a plugin from an SSH URL, and `owner/repo` sources choose SSH or HTTPS as Claude Code does
- [ ] **Phase 5: Credential Surface** - Git authenticates only through what the machine holds, Device Flow is removed or kept as discuss decides, and tokens stored through it keep working
- [ ] **Phase 6: Failure-Message Parity** - Clone and fetch failures report Claude Code's message for each failure class, and no output shows a credential
- [ ] **Phase 7: Submodules and Marketplace Pins** - Plugin clones fetch their submodules, marketplace clones fetch only the submodules that hold plugin files, and a SHA-pinned marketplace follows upstream's path
- [ ] **Phase 8: Close** - `isomorphic-git` is gone, and the records, READMEs, codebase docs, and CHANGELOG describe the system git transport

<details>
<summary>✅ integration-rescope — Integration Test Rescope — SHIPPED 2026-11-23</summary>

- [x] Phase 1: Duplicate Integration Files (2/2 plans) — completed 2026-11-21
- [x] Phase 2: Plugin Layers, Names, and List Fold (4/4 plans) — completed 2026-11-21
- [x] Phase 3: Marketplace Layers and Cross-Scope Install (4/4 plans) — completed 2026-11-21
- [x] Phase 4: Prune (2/2 plans) — completed 2026-11-22
- [x] Phase 5: MCP Install, Legacy Move, and Overrides (3/3 plans) — completed 2026-11-22
- [x] Phase 6: Hooks and Auth (2/2 plans) — completed 2026-11-22
- [x] Phase 06.1: Reload Keeps SessionStart Context (INSERTED) (3/3 plans) — completed 2026-11-23
- [x] Phase 7: Path-Source Dependency Tags (1/1 plan) — completed 2026-11-23
- [x] Phase 8: Integration Suite Rescope (5/5 plans) — completed 2026-11-23

**Outcome:** 22/22 requirements, 9/9 phases, 4/4 integration points, and 3/3 flows pass; 2285 adapter-profile and 260 builtin-profile cucumber scenarios, and `test/integration/` down to 28 files and 236 cases. The audit reads `tech_debt` with no blockers. Seven phase reports closed with a stale-verification override: later phases edited files they verified, and the combined tree passes `npm run check`.

</details>

<details>
<summary>✅ parity-gaps — Claude Code Parity Gaps and Defects — SHIPPED 2026-11-17</summary>

11 phases, 102 plans. The phase list is in the [archive](milestones/parity-gaps-ROADMAP.md).

**Outcome:** 42/42 requirements, 11/11 phases, 9/9 integration seams, and 6/6 flows pass; 2100 adapter-profile and 204 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phase 5 closed with a verification override (`human_needed` on A9 alone: the start-failure notice has not run on Node 24, and the PR's CI closes it). The runtime UAT was skipped by the user's choice; the cucumber suite, with a real Pi and real companion extensions, stands in for it.

</details>

<details>
<summary>✅ behavioral-gaps — Behavioral Coverage Gaps — SHIPPED 2026-11-08</summary>

16 phases, 36 plans. The phase list is in the [archive](milestones/behavioral-gaps-ROADMAP.md).

**Outcome:** 34/34 requirements, 16/16 phases, 11/11 integration checks, and 16/16 phase flows pass; 1779 adapter-profile and 153 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phases 1, 4, and 6 closed with a stale-verification override: later merges changed files they verified, and the combined tree passes `npm run check`. The adapter-profile order flakes were fixed by `d04a5106`.

</details>

<details>
<summary>✅ mcp-builtin — MCP Built-in — SHIPPED 2026-11-05</summary>

- [x] Phase 1: Foundation and Pi 1.5.0 (14/14 plans) — completed 2026-11-04
- [x] Phase 2: Built-in Materialization (9/9 plans) — completed 2026-11-04
- [x] Phase 3: Read-Time Verdicts (9/9 plans) — completed 2026-11-04
- [x] Phase 4: Agent Grants (6/6 plans) — completed 2026-11-04
- [x] Phase 5: Hook Tool Names (4/4 plans) — completed 2026-11-04
- [x] Phase 6: Release Docs and Combined Tree (13/13 plans) — completed 2026-11-05

**Outcome:** 31/31 requirements, 6/6 phases, 9/9 integration seams, and 8/8 end-to-end flows pass; 1603 adapter-profile and 133 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phase 2 closed with a verification override (`human_needed`, 5/7); after the user's review and the review fixes it re-verified `passed` (7/7), with 02-UAT 2/2.

</details>

<details>
<summary>✅ component-features — Component Behavioral Tests — SHIPPED 2026-11-03</summary>

- [x] Phase 1: Harness and Version Raise (15/15 plans) — completed 2026-11-01
- [x] Phase 2: Skills (7/7 plans) — completed 2026-11-02
- [x] Phase 3: Slash Commands (9/9 plans) — completed 2026-11-01
- [x] Phase 4: Agents (6/6 plans) — completed 2026-11-01
- [x] Phase 5: Hooks (9/9 plans) — completed 2026-11-01
- [x] Phase 6: MCP Servers (9/9 plans) — completed 2026-11-02
- [x] Phase 7: Workflows (6/6 plans) — completed 2026-11-01
- [x] Phase 8: Locality and Upstream Alignment (4/4 plans, retroactive) — completed 2026-11-03

**Outcome:** 62/62 requirements, 8/8 phases, 6/6 integration seams, and 5/5 end-to-end flows pass; 1539 cucumber scenarios. The audit has no blockers. MCP-07 stays an accepted deviation (MCPBG-01); W2 and W4 are guarded non-defects; T-05-33 is fixed and T-05-34 accepted under D-LOC-01, which replaced the D-CF2-13..16 and D-CF3-07 provenance ledger.

</details>

<details>
<summary>✅ plugin-lifecycle — Marketplace and Plugin Lifecycle Backlog — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Staging Warning Channels (8/8 plans)
- [x] Phase 2: Apply Ordering and Installed Declarations (6/6 plans)
- [x] Phase 3: Dependency Cascade Rows and Status (6/6 plans)
- [x] Phase 4: Dependency Resolver Residue (6/6 plans)
- [x] Phase 5: Marketplace Command Parity (9/9 plans)
- [x] Phase 6: Import Marketplace Planning (6/6 plans)
- [x] Phase 7: Git Errors and Lock Discipline (10/10 plans)
- [x] Phase 8: Background Autoupdate (4/4 plans)
- [x] Phase 9: Plugin Package Dependencies (5/5 plans)
- [x] Phase 10: Lifecycle Test and Harness Gaps (7/7 plans)
- [x] Phase 11: Cleanup, Split, and Docs (13/13 plans)

**Outcome:** 64/64 requirements, 11/11 phases, 12/12 integration groups, and 10/10 end-to-end flows pass. The audit has no blockers and carries only the accepted HOSTED-DNS-01 residual under D-PL5-31.

</details>

## Phase Details

### Phase 1: Harness on System Git

**Goal**: The unit, integration, and cucumber suites build their fixture repositories and run every git operation with the system `git` binary under a hermetic environment, and the cucumber stand-ins can serve a product that speaks system git over HTTPS and SSH, before the product changes its transport.
**Depends on**: Nothing (first phase)
**Requirements**: SG-HRN-01, SG-HRN-02, SG-HRN-03, SG-HRN-04
**Open questions**: None. The SSH stand-in serves both an `ssh` probe launch and git's SSH transport, so either answer to Q18 (Phase 4) runs on it.
**Research flag**: None (standard patterns: the harness already runs `git http-backend`, and the credential-store steps work unchanged).
**Notes**: The product still clones with `isomorphic-git` in this phase, so the cucumber request tables do not change yet, and only the harness's own checks exercise the system-git CA trust and the SSH stand-in until Phase 3. The phase measures how many request tables Phase 3 re-baselines (the research estimate is 79 tables in 20 feature files) and records the count for Phase 3. About 36 test and feature files import `isomorphic-git` today; `test/platform/git-test-repository.ts` and its importers, and the `features/lib/` git helpers, move to system git. System git ignores `NODE_EXTRA_CA_CERTS`, which is why the HTTPS stand-in needs `GIT_SSL_CAINFO` or `http.sslCAInfo`. The cloud sandbox injects `url.insteadOf` through `GIT_CONFIG_COUNT`, which is why the hermetic environment clears that family (PITFALLS.md Pitfalls 2 and 9). SUMMARY.md also suggests `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` in the e2e suite for determinism.
**Success Criteria** (what must be TRUE):
  1. Every fixture repository that the unit, integration, and cucumber suites create is built by the system `git` binary, the fixture builders no longer import `isomorphic-git`, and `npm run check` passes (SG-HRN-01).
  2. A git command that a test runs sees no user, system, or sandbox-injected git configuration: run from a shell that sets a `url.<base>.insteadOf` rewrite through `GIT_CONFIG_COUNT`, as the cloud sandbox does, the suites still pass and no fixture or stand-in request follows the rewrite (SG-HRN-01).
  3. Inside the cucumber harness, a system `git` clone and a fetch by SHA from the HTTPS git-host stand-in succeed with only the harness's CA trust (`GIT_SSL_CAINFO` or `http.sslCAInfo`), and the stand-in's refusing arm makes the fetch by SHA fail, so a later phase can drive the fallback path (SG-HRN-02).
  4. Inside the cucumber harness, a system `git` clone from a `git@<host>:<path>` URL and an SSH probe launch both reach the SSH stand-in (a stub `ssh` on `PATH` or `GIT_SSH_COMMAND`) and get scripted answers, with no real network (SG-HRN-03).
  5. `test/architecture/hermetic-git-environment.test.ts` checks every variable SG-HRN-04 names (the `GIT_CONFIG_*` family, `GIT_SSL_CAINFO`, `GIT_SSH`, `GIT_SSH_COMMAND`, `SSH_AUTH_SOCK`, the proxy variables, `XDG_CONFIG_HOME`, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`), and the CI log of every job that runs git shows the git version (SG-HRN-04).
**Plans**: 8/8 plans complete in 4 waves

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Suite-wide git builder with named variables, the system-git runner and checkout handle, and the unit fixture builder, git contract fixtures, and warm mirror seed on system git (wave 1)
- [x] 01-02-PLAN.md — `git --version` in every CI test job and the e2e suite's own `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Clone-cache and list fixtures on system git, and cucumber clone inspection with system git (wave 2)
- [x] 01-04-PLAN.md — Install, info, and update fixtures on system git (wave 2)
- [x] 01-05-PLAN.md — Integration fixtures on system git and from-scratch environments for forked integration children (wave 2)
- [x] 01-06-PLAN.md — HTTPS git host trusted through `GIT_SSL_CAINFO`, fetch by SHA and the refusing arm, and Pi's `GIT_SSL_CAINFO` and `PATH` members (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-07-PLAN.md — SSH stand-in (stub `ssh` first on every cucumber Pi's PATH) with upstream's probe answers (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-08-PLAN.md — Hermetic test over every builder and every SG-HRN-04 variable, planted-leak real clones, and the Phase 3 re-baseline record (wave 4)

### Phase 2: Git Process Seam and Typed Failures

**Goal**: Every git process the extension starts, and the SSH probe, starts from one platform module that cannot prompt, hang, run code from a cloned repository, reach the network on a local lane, or act on the user's own project repository. A git failure reaches its caller as a typed error with a kind, and a user with no usable git gets a clear message.
**Depends on**: Phase 1
**Requirements**: SG-PRC-01, SG-PRC-02, SG-PRC-03, SG-PRC-04, SG-PRC-05, SG-PRC-06
**Open questions**: Q1 (git only, or an `isomorphic-git` fallback), Q3 (how common a missing git is on Windows, and the macOS `xcode-select` and Windows lookup messages), Q11 (local lane and network lane: NFR-5, BLOCK F `NETWORK_SEAMS`, the rule pack, and whether the SSH probe is listed as network), Q12 (NFR-10 and the files git writes through the user's configuration, such as `~/.git-credentials` and `known_hosts`), Q14 in part (the in-checkout hardening list: hooks, fsmonitor, askpass, `core.longpaths`), Q17 (the git version floor: document it or probe for it, and whether CI gets a floor-version leg).
**Research flag**: Yes. Verify against the binary which commands carry the in-checkout hardening list, how `GIT_ASKPASS=""` takes precedence, and how Windows handles the tty and the process tree. Plan a manual check by hand on macOS and on Windows.
**Notes**: The research proposes `platform/git-process.ts`, extracted from the launcher in `platform/package-manager.ts` (process-group kill and absolute-`PATH` `.exe` resolution, D-PL9-15/18/19) so that `fallow dupes` stays clean, and it rejects any new dependency (`simple-git`, `execa`, `dugite`, a `cross-spawn` import). The module lands with its first consumer (for example `listRemotes` or `currentBranch`), so `fallow dead-code` stays green with no `ignoreExports` entry. It uses async `spawn` only: `execFile` stops git at 1 MiB of output, and a sync call starves the state-lock refresh timer. `platform/git-credential.ts` already spawns `git credential`; SG-PRC-01 covers that launch too, whatever Phase 5 decides for the file. The error kinds must be able to carry every failure class that Phase 6 may keep (Q4); the wording waits for Phase 6. If Q1 picks a fallback, SG-CLS-01 moves to Out of Scope.
**Success Criteria** (what must be TRUE):
  1. The `child-process-chokepoint` rule names the new git process module, and every git launch in production goes through it with an argument array, no shell, closed stdin, and `--end-of-options` before marketplace-controlled data; the rule pack, `test/architecture/no-shell-out.test.ts`, `test/architecture/gate-targets.ts`, and the ESLint zones change in the same commits, and `npm run check` passes (SG-PRC-01).
  2. A git command run through the module against a remote that asks for a password, a key passphrase, or an unknown host key fails without a prompt and within its timeout, and a timeout leaves no git, remote-helper, or ssh process behind (SG-PRC-02).
  3. A repository whose checkout carries a hook or an fsmonitor command runs neither; a URL on the `ext`, `fd`, `git`, `ftp`, or `ftps` protocol is refused; `GIT_DIR` or another repository-pointer variable in the environment changes nothing; a clone directory with no `.git` under `<cwd>/.pi/` makes the command fail rather than act on the user's project repository; and a command on the local lane fails rather than reach the network (SG-PRC-03, SG-PRC-04).
  4. Each git failure reaches its caller as a typed error whose kind (not found, auth, network, ref missing, timeout, git missing, and the rest) is read from git's exit status and its stderr under `LC_MESSAGES=C`, and no caller narrows on an error name or a message substring (SG-PRC-05).
  5. With no usable `git` on `PATH`, a git-source `marketplace add` or plugin install tells the user that git is required (in the `xcode-select --install` form on macOS), or runs the fallback if discuss chose one (Q1, Q3), and path-source and hosted-manifest marketplaces still add and install; cucumber scenarios pin each case (SG-PRC-06).
**Plans**: 8/8 plans complete in 6 waves

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Shared launcher `platform/process-run.ts` moved out of the package manager unchanged, then given stdin input, a tail capture, a hidden console, and a parameterized Windows lookup (wave 1)
- [x] 02-02-PLAN.md — `{git missing}` reason (D-SG-07), `GitCommandError` with its closed kind union, every kind mapped to a reason, and the requirement text on a git-missing row (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-03-PLAN.md — `platform/git-process.ts` with the absolute git lookup and the D-SG-05 hardening, `git credential` as its first consumer, and the chokepoint, gate tests, and ESLint zone changed in the same commit (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-04-PLAN.md — Kind ladder from git's exit status and C-locale stderr, the git version in the debug log after a too-old failure, the macOS xcrun shim, and the credential-leak scan (wave 3)
- [x] 02-05-PLAN.md — Git-required gate on the four network verbs of `platform/git.ts`, and cucumber scenarios for sources without git and for a credential lookup that runs no askpass or project helper (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-06-PLAN.md — Operand rules (`--end-of-options`), the network-free local lane (D-SG-02), the `GIT_ALLOW_PROTOCOL` translation, and real-git proofs for hooks, transports, pointers, and the ceiling (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-07-PLAN.md — The user's ssh with BatchMode and StrictHostKeyChecking from a neutral directory, and real-git proofs of no prompts and no leftover processes (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-08-PLAN.md — Codebase map update, the manual macOS and Windows check (blocking, deferrable to the pull request), and the D-SG outcomes in PROJECT.md (wave 6)

### Phase 3: System Git Transport and Clone Shape

**Goal**: Marketplaces and git-source plugins clone, fetch, refresh, and update on system git in Claude Code's shape, the custom HTTP client and the `isomorphic-git` auth callbacks are gone, and a clone that `isomorphic-git` made before the upgrade keeps working with no manual step.
**Depends on**: Phase 2
**Requirements**: SG-TRN-01, SG-TRN-02, SG-TRN-03, SG-TRN-04, SG-TRN-05, SG-TRN-06, SG-TRN-07, SG-MIG-01
**Open questions**: Q5 in part (old clones: correct their settings in place, or re-clone on the next network operation), Q8 (`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`: an `insteadOf` key, an explicit wire URL, or retired; Phase 4 uses the answer for the probe), Q9 (marketplace update model: the D-14 fetch and checkout, or upstream's `ls-remote` check, then a re-clone into staging and a swap), Q10 (shallow marketplace clones against TAGS-01 and NFR-5), Q13 (where the state lock sits during a clone of up to 120 s), Q14 in part (`core.autocrlf`, and how the default branch is tracked), Q15 (the timeout variable, and the explicit-install plugin clone timeout), Q16 in part (`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`), Q19 (symlinks and containment, and whether NFR-10 checks use `realpath`). Q2 belongs to Phase 5, but this phase deletes the auth callbacks, so its discuss step settles how the Device Flow scenarios stay green until then.
**Research flag**: Yes, the riskiest phase. Verify `git fetch --force` for moved tags, `followRemoteHEAD` and `origin/HEAD` across git versions, the `--unshallow` cost against the timeout, SHA wants on protocol v0 servers, the symlink and autocrlf choices, and every TAGS-01 caller. Re-verify what `isomorphic-git` does with `origin/HEAD` today (E-8) before the fix is designed.
**Notes**: One phase, not two. Shallow clones, the SHA ladder, and the refresh change the same cucumber request tables, so they change once, here (Phase 1 measured the count). The swap is also what makes `core.symlinks=false` and a stale `origin/HEAD` bite on old clones, so SG-MIG-01 lands with it (SUMMARY.md; PITFALLS.md Pitfalls 4 and 7). The plan waves can follow SUMMARY.md's two halves: the verbs and `instanceof` at the matcher sites first, then the clone shape, pins, refresh, and old clones. The four name-matchers (`NotFoundError`, `CommitNotFetchedError`) become `instanceof` checks in this phase, or a deleted-branch refresh loses its detached-checkout fallback. If the update model or the tag read adds a network read (Q9, Q10), NFR-5 is amended under a `D-SG-NN` ID in this phase. A load stays free of installation changes and of the network (APL-D1, NFR-5) whatever Q5 decides.
**Success Criteria** (what must be TRUE):
  1. Every `GitOps` operation (clone, fetch, checkout, ref and remote-ref resolution, tag listing and peeling, ref update, current branch, remotes) runs on system git: `platform/git.ts` imports nothing from `isomorphic-git`, the custom HTTP redirect client and `platform/git-auth-callbacks.ts` are gone, and the marketplace and plugin cucumber features pass with their request tables re-baselined against system git (SG-TRN-01).
  2. `marketplace add` and a git-source plugin install clone with `--depth 1`, and with `--branch <ref>` when a ref is given; a plugin pinned to a SHA ends with `HEAD` equal to the pin, through the `--unshallow` fallback when the server refuses the SHA; a ref that starts with `-` or a malformed SHA is refused before git runs; cucumber scenarios pin the pin, the fallback, and the refusals (SG-TRN-02).
  3. `marketplace update` follows a moved default branch and a moved tag under the model discuss chose (Q9); an update that fails or is interrupted leaves the previous checkout usable, and the next run succeeds; with the remote unreachable and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` set, the existing checkout is kept as upstream keeps it; and version-range resolution still finds the right tag at the clone depth discuss chose (Q10); cucumber scenarios pin each (SG-TRN-03, SG-TRN-04, SG-TRN-06).
  4. A clone or fetch that runs past 120 s, or past the limit that `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` sets, fails as a timeout and leaves the scope safe to retry; `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` keeps, changes, or retires its behavior as discuss chose (Q8), and the cucumber harness still reaches its GitHub stand-in (SG-TRN-05, SG-TRN-07).
  5. A user who upgrades with marketplace and plugin clones that `isomorphic-git` made needs no manual step: the next `/reload` succeeds, and after the next operation on such a clone it has real symlinks and a correct checkout (corrected settings or a re-clone, per Q5); a cucumber scenario that starts from a clone with `isomorphic-git`'s settings pins it (SG-MIG-01).
**Plans**: 17/17 plans complete in 9 waves

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Pi-owned `-c` pairs on git requests, `for-each-ref` on the local lane, and the https-auth and v0 SHA-refusal details in the failure classifier (wave 1)
- [x] 03-02-PLAN.md — An abbreviated or malformed sha and a ref that starts with `-` refused while the source is parsed, before git runs, for plugins and `marketplace add` (wave 1)
- [x] 03-03-PLAN.md — Cucumber stand-ins for system git: the loopback CONNECT proxy for `github.com`, the git host forwarding the backend's refusal, and the hermetic check of the two new variables (wave 1)
- [x] 03-04-PLAN.md — Local `GitOps` verbs on system git: an absent ref answers `undefined`, a copy of an old clone drops its three `core.*` keys, the `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` reader, and `fetchCommit` with the `--unshallow` fallback (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-05-PLAN.md — Network request path: the D-SG-16 `insteadOf` key on every remote request, the two `ls-remote` verbs on system git, and the D-SG-14 Device Flow retry through a one-shot credential helper, with the Device Flow scenarios run through the CONNECT proxy (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-06-PLAN.md — Clone on system git in Claude Code's shape (`--depth 1`, `--branch=<ref>`, no submodules), upstream's SHA-pin ladder, and every clone request table and cause chain re-baselined once (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-07-PLAN.md — D-SG-10 marketplace refresh: the `ls-remote` freshness check, a re-clone into staging, the swap through `sources-backup/`, interrupted-swap recovery, and the D-SG-15 keep variable (wave 4)
- [x] 03-08-PLAN.md — D-SG-09 release tags of a git marketplace read from its remote, the tag copy fetching only its commit, and scenarios for a tag present at add and one pushed after it (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-09-PLAN.md — The plugin mirror refresh and the PUP-2 marketplace sync on the same swap through `plugin-clones-backup/`, the D-14 refresh wrappers deleted, and the refresh tables re-baselined (wave 5)
- [x] 03-10-PLAN.md — Scenarios for the `--unshallow` fallback against a git host that refuses SHA fetches, the keep variable on an unreachable marketplace, and a clone that runs past the git timeout (wave 5)
- [x] 03-11-PLAN.md — A marketplace ref that looks like a commit id with capital letters refused before git runs, as Claude Code refuses it (a lower-case one reaches git and fails as a missing ref until SG-PIN-01 in Phase 7), and scenarios for a moved default branch, a moved tag, and an interrupted or dropped update (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03-12-PLAN.md — The Device Flow bundle types moved into the credential module, the orchestrator tests moved off the callback builder and the D-14 members, and the BLOCK F and BLOCK C seam lists updated (wave 6)
- [x] 03-13-PLAN.md — `recordedCalls` in the `GitOps` fake, git host failures fabricated as system git reports them, and the edge injection proofs trapped at the git process module (wave 6)
- [x] 03-14-PLAN.md — Upgrade scenarios: marketplace clones and plugin mirrors with `isomorphic-git`'s settings keep working and write links on their next copy, a link out of a git marketplace is refused, and `plugin update` keeps an unreachable marketplace only when asked (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03-15-PLAN.md — One transport: the D-14 verbs, the HTTP redirect client, `platform/git-auth-callbacks.ts`, and the `isomorphic-git` dependency removed, with the credential-leak gate re-aimed and the `isomorphic-git` chokepoint made a total ban in the same commits (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03-16-PLAN.md — What the old transport left: the classifier rungs that read its errors, `CrossOriginChallengeError`, and its comments in the extension and the Device Flow harness (wave 8)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03-17-PLAN.md — Codebase map update for the system git transport, and the D-SG-09 to D-SG-16 outcomes in PROJECT.md, written from every plan SUMMARY, 03-16's included (wave 9)

### Phase 4: SSH Sources and Transport Selection

**Goal**: A user who authenticates git over SSH can add a marketplace or install a plugin from an SSH URL or from a private `owner/repo` repository, and `owner/repo` sources choose SSH or HTTPS as Claude Code does (issue #325).
**Depends on**: Phase 3
**Requirements**: SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06
**Open questions**: Q6 (amend D-76-01: the SSH forms only, or also `http://`, which D-PL5-04/05/33 refuse; and a URL gate for the git-subdir object `url`), Q7 (the plugin `github` fallback: mirror `claude plugin install` or the in-session `/plugin`, and whether update and dependency installs stay SSH only), Q16 in part (`CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, and recording `CLAUDE_CODE_REMOTE` as not read), Q18 (the probe: an `ssh -T` launch or `git ls-remote`, and whether its result is cached), Q21 in part (the Windows SSH-first plugin path; REQUIREMENTS.md records the maintainer's choice of 2026-11-22 that every optional item is in scope, and discuss confirms it). Phase 3's answer to Q8 says which host gets the SSH URL and whether the probe is skipped under the base URL.
**Research flag**: Yes. Verify the probe's `ssh` launch against `git ls-remote git@github.com:...` (they prove different things), how the plugin fallback reaches dependency installs, and whether `marketplace add ssh://...` parses as a `git` source.
**Notes**: The D-76-01 amendment is recorded under its own ID before the source parser changes. On the probe rules SUMMARY.md prefers FEATURES.md, read from the binary: the marketplace path always probes, with no memo across commands, and the skip rules (`GIT_SSH_COMMAND`, `GIT_SSH`, a URL rewrite in git config) belong to the plugin CLI install path. A probe that spawns `ssh` starts from the Phase 2 module (SG-PRC-01), and Q11's answer says whether it is a network seam. The plugin clone key stays fixed in `domain/clone-key.ts` (`canonicalCloneUrl`).
**Success Criteria** (what must be TRUE):
  1. A user can run `/claude:plugin marketplace add` with a `git@host:path`, `ssh://`, `git+ssh://`, or `ssh+git://` URL and install a plugin from that marketplace over SSH; a `git://` URL is refused by upstream's validator; `http://` and the git-subdir `url` behave as discuss chose (Q6); cucumber scenarios pin each form (SG-SSH-01).
  2. For an `owner/repo` marketplace source the user sees upstream's progress lines: SSH first only when the probe reports SSH configured, HTTPS first otherwise, a retry with the other transport on failure, and upstream's error when both fail; with `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` no probe runs and every GitHub clone uses HTTPS, and `CLAUDE_CODE_REMOTE` changes nothing; cucumber scenarios pin each path (SG-SSH-02, SG-SSH-03).
  3. A `github` plugin source on install, update, and dependency install follows the probe, fallback, and skip rules of the upstream surface discuss chose (Q7), with cucumber scenarios for each, and on Windows a plugin install retries an SSH failure over HTTPS as upstream does (SG-SSH-04, SG-SSH-05).
  4. A marketplace or plugin cloned over SSH is the same source as its HTTPS form: a later update, reinstall, or install never refuses it as a stale clone, and its `plugin-clones/<key>/` directory does not move (SG-SSH-06).
**Plans**: 15/18 plans executed in 11 waves

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — Upstream's git address validator (`iTs`) for every git address, the scp `marketplace add` arm over the ssh stand-in, the command-line refusal of the URL-scheme SSH forms, the import `git` kind, the git-subdir gate (F-2), and the F-5 harness guard (wave 1)
- [x] 04-02-PLAN.md — The clone note field on marketplace blocks and plugin rows (types, wire, JSON, grammar, schema), the `ssh-auth` detail, and the typed both-failed error (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-03-PLAN.md — The GitHub identity fold (`Ort`) in comparisons only, per-URL D-SG-21 SSH-form `insteadOf` pairs, and the scp-safe host reads (wave 2)
- [x] 04-04-PLAN.md — The `ssh -T` probe from the one spawn site, the `NETWORK_SEAM_NAMES` gate, the marketplace transport plan and runner's first attempt for `marketplace add`, PREFER_HTTPS and the base override, and the refusing test `ssh` in `scripts/isolated-pi-home.mjs` (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 04-05-PLAN.md — The marketplace add's retry and both-failed error, the ssh stand-in's refusals, the scenario variables with the PREFER_HTTPS and CLAUDE_CODE_REMOTE scenarios, the Device Flow scenarios with a denied ssh, and auth-e2e on the stand-in (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 04-06-PLAN.md — The plugin install transport: upstream's skip checks, `ssh -G`, the HTTPS-first retry, the git-subdir shorthand, and one context per install command (wave 4)
- [x] 04-08-PLAN.md — `marketplace add` notifications name the transport, the url-source GitHub note, and the add scenarios re-baselined (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 04-07-PLAN.md — Release-tag reads of GitHub sources over SSH by default (D-SG-20), the HTTPS retry of a `github`-source dependency's failed SSH listing, and the TAGS-02 consequence for path-source dependencies (wave 5)
- [x] 04-09-PLAN.md — Every refresh on an attempt list from the declared source: `marketplace update`, the PUP-2 sync, and plugin mirrors (wave 5)
- [x] 04-10-PLAN.md — The Windows SSH-first plugin path with the HTTPS retry, the `-G` check through git, and the WINDOWS ledger entry (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 04-11-PLAN.md — Transport contexts for `plugin update`, `reinstall`, dependency moves, and the converge entry (wave 6)
- [x] 04-13-PLAN.md — Marketplace refresh notifications name the transport, and the refresh scenarios re-baselined (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 04-12-PLAN.md — Transport contexts for `fetch`, `info --fetch`, and `enable` (D-SG-19 as extended), the SSH-only no-context arm removed, and the clone-cache transport required (wave 7)
- [x] 04-14-PLAN.md — Install notifications name each clone's transport, and the install scenarios re-baselined (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 04-15-PLAN.md — Update and reinstall notifications, with the PUP-2 note and dependency moves, and their scenarios re-baselined (wave 8)

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 04-16-PLAN.md — Fetch, `info --fetch`, and enable notifications, and their scenarios re-baselined (wave 9)

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 04-17-PLAN.md — One transport context per `apply` and `import` run, shared by their installs, enables, and moves, their notes, and their scenarios re-baselined (wave 10)

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 04-18-PLAN.md — Records: NFR-5 amended in PROJECT.md and AGENTS.md, the D-SG-17..24 outcomes, the codebase maps, and the user docs (wave 11)

**Cross-cutting constraints:** <!-- gsd:generated -->
- Every re-baselined scenario differs only by clone columns or clone lines (04-08's rule)

### Phase 5: Credential Surface

**Goal**: Git authenticates only through what the machine already holds, the extension keeps no git token of its own, Device Flow is removed or kept in the form discuss chose, and a user who stored a token through Device Flow keeps working with no action.
**Depends on**: Phase 4
**Requirements**: SG-AUTH-01, SG-AUTH-02, SG-AUTH-03
**Open questions**: Q2 (remove or keep Device Flow; keeping it needs a recorded divergence, runs as a retry after an auth failure, and exposes the token unless a helper stores it), Q5 in part (a one-time notice for Device Flow users, and whether short-lived GitLab tokens need a message).
**Research flag**: None (mechanical once discuss decides; wide, not deep).
**Notes**: If Device Flow goes, the phase deletes `domain/github-auth.ts`, `domain/auth-registry.ts`, `platform/git-credential.ts`, the `orchestrators/auth-host.ts` builders, the `credentialOps`, `deviceFlowHttp`, and `authMemo` threading (233 occurrences in 23 production files and 47 test and feature files), the `fetch-chokepoint` exemption for `domain/github-auth.ts`, the matching `CREDENTIAL_LEAK_TARGETS` entries (a positional pair, edited together), and `features/marketplace/device-flow.feature` with its stand-in `features/lib/github-device-flow/`. The AAP and D-PL8-12 rules ("stored credentials only, no Device Flow") are restated for the outcome. The extension never deletes a stored credential (PITFALLS.md Pitfall 14).
**Success Criteria** (what must be TRUE):
  1. A user whose machine holds an SSH key or agent, or a git credential helper such as gh's or Git Credential Manager, adds a private marketplace and installs from it with no prompt from the extension; with only `GITHUB_TOKEN` or `GH_TOKEN` set and no helper, the private clone fails as an auth failure, and the token appears in no URL, header, or argument (SG-AUTH-01).
  2. Device Flow is gone, with no device-code prompt on any command, or it remains in the form discuss chose (Q2); either way a load with `autoapply` on and the background autoupdate pass never wait for user input, and PROJECT.md restates the AAP, autoapply, and D-PL8-12 rules for the outcome (SG-AUTH-02).
  3. A user who stored a token through Device Flow before the upgrade still clones and updates over HTTPS with no action, the extension deletes no stored credential, and the one-time notice, if discuss chose one (Q5), appears once; cucumber scenarios pin each (SG-AUTH-03).
**Plans**: TBD

### Phase 6: Failure-Message Parity

**Goal**: A clone or fetch failure tells the user what Claude Code tells its user for the same failure, and no output shows a credential.
**Depends on**: Phase 5
**Requirements**: SG-ERR-01, SG-ERR-02
**Open questions**: Q4 (which of upstream's nine marketplace message classes and which plugin-clone wording to copy exactly, and whether the telemetry buckets matter; IL-4 forbids telemetry).
**Research flag**: None (the message table is in FEATURES.md E-SG-10).
**Notes**: The wording comes after Phase 4 because it names transports and remedies that exist only from then, and after Phase 5 because the auth remedies depend on Q2. The set includes `git is not installed ... xcode-select --install`, `Command 'git' not found or is in an unsafe location`, and the dubious-ownership message. The closed D-PL7-01 reason set is mapped from the typed failure kind of Phase 2. Messages are English only (IL-1) and go through `notify()` (IL-2). Carried from Phase 3 (review WR-02, maintainer decision 2026-11-24): a bare `returned error: 401` or `403` line with no `Authentication failed for` line now reads `https-auth` / `no-credential`, so a 403 after a refused stored credential no longer reads `rejected`; compare this with Claude Code's wording here and keep or change it.
**Success Criteria** (what must be TRUE):
  1. For each failure class that discuss kept (Q4), such as auth, SSH auth, not found, network, timeout, ref missing, both transports failed, and git missing, `marketplace add`, `marketplace update`, and a git-source plugin install report Claude Code's message, adapted only where Pi has no equivalent; a cucumber scenario pins each class (SG-ERR-01).
  2. The same failure gives the same reason wherever it is reported (the command's own notice, the `apply` and `import` cascades, and the background autoupdate pass), because each reason comes from the typed failure kind (SG-ERR-01).
  3. A failure whose URL carries userinfo, or whose git stderr carries a token or a password, shows neither in the notice, the JSON-mode output, or the debug log, and git's own output never reaches stdout or stderr directly (SG-ERR-02).
**Plans**: TBD

### Phase 7: Submodules and Marketplace Pins

**Goal**: A plugin whose repository uses submodules installs with them, a marketplace fetches only the submodules that hold plugin files, a SHA-pinned marketplace clones and updates through upstream's SHA path, and no submodule URL opens a way to run code or to write outside the clone.
**Depends on**: Phase 6
**Requirements**: SG-SUB-01, SG-SUB-02, SG-PIN-01
**Open questions**: Q20 (the `directoryPin` exception, which was not traced; SG-SUB-02 already asks for upstream's selective rule), Q21 in part (whether this phase ships in the milestone; REQUIREMENTS.md records the maintainer's choice of 2026-11-22 that every optional item is in scope, and discuss confirms it).
**Research flag**: Yes. Re-check the advisories for the submodule fix versions (the CVE-2024-32002 and CVE-2025-48384 class), the `directoryPin` trigger, upstream's selective rule, and the gate on upstream's SHA-ref marketplace path.
**Notes**: The code depends only on Phases 2 and 3. The phase comes late because it carries the largest code-execution surface, and it is the first cut candidate if the milestone must shrink (SUMMARY.md). The hardening includes `protocol.file.allow=never`, containment for each submodule, and a review of `GIT_LFS_SKIP_SMUDGE=1`.
**Success Criteria** (what must be TRUE):
  1. Installing a git-source plugin whose repository has submodules materializes them shallowly (`--recurse-submodules --shallow-submodules`, and `--no-recurse-submodules` where upstream uses it), and a submodule whose URL uses a refused protocol or resolves outside the plugin's clone root is refused, with nothing from it run or written outside the clone root; cucumber scenarios pin both (SG-SUB-01).
  2. Adding or updating a marketplace whose repository has submodules fetches only the submodules that hold plugin files, as Claude Code 2.1.295 and later do; a cucumber scenario pins it (SG-SUB-02).
  3. A marketplace source pinned to a SHA ref adds and updates through upstream's SHA path and ends at the pinned commit; a cucumber scenario pins it (SG-PIN-01).
**Plans**: TBD

### Phase 8: Close

**Goal**: `isomorphic-git` is gone from the project, and PROJECT.md, the READMEs, the codebase docs, and the CHANGELOG describe the system git transport and the decisions the milestone made.
**Depends on**: Phase 7
**Requirements**: SG-CLS-01, SG-CLS-02, SG-CLS-03
**Open questions**: None. If Phase 2 kept an `isomorphic-git` fallback (Q1), SG-CLS-01 moves to Out of Scope.
**Research flag**: None.
**Notes**: `README.md` and `README.es.md` change together (`readme` skill). Before the PR, offer the version bump in `package.json` and `sonar-project.properties` with `package-lock.json` (AGENTS.md "Versioning"), audit and close the milestone on the PR branch (`/gsd-audit-milestone`, then `/gsd-complete-milestone`), and get zero new SonarCloud issues before the merge.
**Success Criteria** (what must be TRUE):
  1. `package.json` and `package-lock.json` no longer list `isomorphic-git`, no production, test, script, or `features/` file imports it, `fallow dead-code --trace-dependency isomorphic-git` is clean, the `isomorphic-git-chokepoint` rule is a total ban or is removed, and `npm run check` passes (SG-CLS-01).
  2. PROJECT.md records the decision that reverses D-21 under its own ID, and its Constraints and Key Decisions carry each amendment the milestone made to NFR-5, NFR-10, D-76-01, D-MF-01, D-PL8-12, and the AAP rules, each citing what it amends (SG-CLS-02).
  3. `README.md` and `README.es.md` state that git is required, give the SSH and HTTPS rules and the variables the extension reads, and tell Device Flow users what changed; `.planning/codebase/*.md` and `CHANGELOG.md` describe the system git transport (SG-CLS-03).
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Harness on System Git | 8/8 | Complete    | 2026-11-23 |
| 2. Git Process Seam and Typed Failures | 8/8 | Complete    | 2026-11-23 |
| 3. System Git Transport and Clone Shape | 17/17 | Complete    | 2026-11-24 |
| 4. SSH Sources and Transport Selection | 15/18 | In Progress | - |
| 5. Credential Surface | 0/TBD | Not started | - |
| 6. Failure-Message Parity | 0/TBD | Not started | - |
| 7. Submodules and Marketplace Pins | 0/TBD | Not started | - |
| 8. Close | 0/TBD | Not started | - |

## Carried Forward

- integration-rescope: BACKLOG DIRGITTAG-01, HOOKLATESS-01 (a parity question for the user), and HOOKASYNCRESUME-01 in [BACKLOG.md](BACKLOG.md); the three Phase 6.1 CHANGELOG lines in STATE.md and the accepted fallow `weakened-tests` finding on `standalone-prune` go to the milestone PR; Nyquist validation for all nine phases; the `dispatch-exec.test.ts` large-environment fragility.
- parity-gaps: AGTLONGNAME-01 and PG1-TIMING-01 stay open; Phase 5 A9 closes with the PR's CI `behavioral` job on Node 24; SEED-261107-kax stays dormant pending upstream open-gsd/gsd-core#4649; the BACKLOG entries the milestone added (among them HOOKRESULT-01, MCPSAMPLING-01, MCPOPENUI-01, PITRUSTPATHS-01, STOPMODECHECK-01, and SIBLINGPREFIX-01) in [BACKLOG.md](BACKLOG.md).
- behavioral-gaps: the 25 BACKLOG entries the milestone added (among them ASYNCNEWSESSION-01, AMIGTRUST-01, WORKERHOMEDIR-01, SESSIONENDENV-01, PRUNECFG-01) in [BACKLOG.md](BACKLOG.md); the unknown writer to the real `~/.pi` during `npm run check` (P1-DC-53); Nyquist validation for phases 2, 3, 4, 8, 9, 10, 11, 12, 14, and 16.
- mcp-builtin: BACKLOG COMPLIMPL-01, STAMPTYPE-01, GRANTRUNARG-01, STAMPREQ-01, EDGEDEPSCASES-01, PENDAPPLY-01, CONTAINCATCH-01, BLTREPEAT-01, SUBCHILDVAR-01, BLTOWNER-01 (narrowed), DENYPIN-01, and the 17 deferred built-in MCP items in [BACKLOG.md](BACKLOG.md); Phase 2's one open Nyquist gap (a `/reload` implementation switch, MSEL-02); the Pi 1.5.0 RPC double `session_start` fix on `acolomba/pi` branch `fix/rpc-double-session-start`, for the user to report upstream.
- component-features: upstream fixes wait on the user's review on forks `acolomba/pi` (`fix/input-transform-expand-opt-out`) and `acolomba/pi-subagents` (`fix/mcp-direct-tools-adapter-7`); MCPBG-01, PIEXPAND-01, WFLOCAL-01 and MCPCANARY-01 stay in [BACKLOG.md](BACKLOG.md); D-CF7-05 awaits a live probe of Claude Code.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Closed under D-BG-1001 (behavioral-gaps Phase 10, pending user review, P10-DC-01): the json-output `09/` D-03 choice. The LLM tools return `isError: true`, never throw; Pi 1.5.0 delivers a returned `isError` to the model as a failed tool result.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
