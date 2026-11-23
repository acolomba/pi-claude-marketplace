# Phase 2: Git Process Seam and Typed Failures - Research

**Researched:** 2026-11-23
**Domain:** Node subprocess control of system `git` (no shell, process groups, hermetic environment), git failure classification, closed-set notification reasons, ESLint/fallow gate edits
**Confidence:** HIGH for the repository facts and the git 2.43 experiments; MEDIUM for macOS and Windows behavior (not runnable here, manual check planned)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The full upstream evidence records (Claude Code 2.1.330 binary, grepped
2026-11-23, never run; git 2.43.0 experiments) are in `02-EVIDENCE.md` in this
directory. Each decision below cites its record. Each lands in PROJECT.md Key
Decisions under its `D-SG-NN` ID.

#### Transport and constraint amendments (asked; maintainer accepted the recommendation 2026-11-23)
- D-SG-01 (Q1, reverses D-21): system `git` only, with no `isomorphic-git` fallback, as Claude Code has no fallback and no in-process git. A user with no usable git gets an error naming the requirement; on macOS the upstream form "git is not installed on this Mac. To install it, run xcode-select --install, then try again." (exact text per `02-EVIDENCE.md` Q1). Path-source and hosted-manifest marketplaces still add and install without git (SG-PRC-06). SG-CLS-01 stays in scope (Phase 8 removes the dependency). — **Reversibility:** costly — once Phase 3 deletes the isomorphic-git transport, a fallback means re-adding a second transport, classifier set, and test matrix.
- D-SG-02 (Q11, amends SG-PRC-04 and NFR-5): local-only git commands (those NFR-5 requires to be network-free) run on upstream's own network-free lane (`ms()`): `GIT_ALLOW_PROTOCOL=/`, `GIT_SSH_COMMAND=false`, neutralized remote helpers, `GIT_NO_LAZY_FETCH=1`, `GIT_LFS_SKIP_SMUDGE=1`. SG-PRC-04's text changes from `protocol.allow=never` to this lane, because a user's `protocol.<name>.allow=always` in `~/.gitconfig` beats `-c protocol.allow=never` (experiment in `02-EVIDENCE.md` Q11). NFR-5 names the SSH probe as a network operation that runs only on paths that already allow the network. ESLint BLOCK F `NETWORK_SEAMS` gets no new entry: the module sits in `platform/` behind `GitOps`. — **Reversibility:** costly — the lane is a recorded constraint amendment that later phases' local verbs (Phase 3's refresh, checkout, ref reads) build on.
- D-SG-03 (Q12, amends NFR-10): files that git and ssh write through the user's own configuration (a credential helper's `store`/keychain write such as `~/.git-credentials`, ssh's `known_hosts`) are outside NFR-10's containment scope, as upstream prevents none of them; the extension itself still writes nothing outside its roots. Precedent: D-BG-1102 already writes `.git-credentials` through the user's helper. No `-o UpdateHostKeys=no` is added. — **Reversibility:** costly — it is a recorded amendment of a project constraint (NFR-10) that Phase 8 restates.

#### Decided autonomously
- [Git detection] Q: "How does the extension detect a missing or unusable git (Q3)?" → Selected: "D-SG-04: Claude Code's method. One lookup per process, cached only when git is found (a cached 'missing' would need a Pi restart, which NFR-2 forbids — this licenses dropping upstream's 'restart Claude Code' hint). On macOS, check for the xcrun shim before a git spawn and classify an `xcrun: error:` stderr as git missing. On Windows, look only in absolute PATH entries, refuse a match inside the cwd (upstream rule, new to Pi), and refuse `.cmd`/`.bat` launchers (D-PL9-18 no-shell gap). Reuse the D-PL9-18 lookup extracted from `platform/package-manager.ts`. Classify-after-spawn (ENOENT, exit 127) is the backstop." — internal module behavior; detection order and caching are local to one function.
- [Hardening] Q: "Which in-checkout hardening does every git command carry (Q14 part)?" → Selected: "D-SG-05: one builder applies upstream's combined set to every git command: the generic `uxt` `-c` list (hooks off including the 28 `hook.*.enabled=false` keys, `core.hooksPath`, `core.fsmonitor=false`, `log.showSignature=false`, `format.pretty=medium`, `diff.autoRefreshIndex=false`, `core.alternateRefsCommand`, protocol bans for ext/fd/git/ftp/ftps, `init.defaultRefFormat=files`, `core.longpaths=true`), the environment builder (`GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=` empty, `GCM_INTERACTIVE=never`, `credential.interactive=false`, repo-pointer variables stripped, `GIT_CEILING_DIRECTORIES`, `GIT_NO_REPLACE_OBJECTS`, `GIT_PROXY_COMMAND=` empty, `GIT_LFS_SKIP_SMUDGE=1`, `GIT_DEFAULT_REF_FORMAT=files`), ssh BatchMode and StrictHostKeyChecking appended to the user's own ssh command (never replacing it), plus `LC_MESSAGES=C` on every command and `init.templateDir=` (empty). Exact lists per `02-EVIDENCE.md` Q14. User settings upstream does not neutralize (autocrlf, symlinks) are left alone in this phase (Phase 3 decides old-clone settings)." — adding keys is local to one builder; no user-visible difference.
- [Version floor] Q: "Does the extension enforce a git version floor (Q17)?" → Selected: "D-SG-06: as Claude Code, no version probe and no refusal. Document git 2.25 or later (README, Phase 8). Add a classifier row so an 'unknown option' failure or exit 129 maps to a 'git too old' kind, and log the git version in the debug output. No CI floor-version leg." — documentation plus one classifier row.
- [Typed errors] Q: "What shape do typed git failures take (SG-PRC-05)?" → Selected: "One `GitCommandError` class (in `shared/errors.ts` per CONVENTIONS) with a readonly `kind` from a closed union, narrowed by `instanceof` and `kind`, never by name or message substring. The kind set covers upstream's classes (timeout with its limit, host key changed, host key unknown, SSH auth, HTTPS auth, network, git missing, proxy refused, remote error, no stderr with exit code, pin mismatch, refused input) plus Pi's (remote ref missing, local ref missing, commit missing, repository not found, protocol refused, dubious ownership, aborted, git too old). The trigger-to-kind table is in `02-EVIDENCE.md`. Stderr is redacted before it is stored on the error. The isomorphic-git name matchers stay until Phase 3 swaps the transport." — an internal error type; Phase 6 maps kinds to wording.
- [Seam and gates] Q: "How do the gates change with the module?" → Selected: "`child-process-chokepoint` names `platform/git-process.ts` (git and ssh launches) and drops `platform/git-credential.ts` once its `git credential` spawn moves into the module; `test/architecture/no-shell-out.test.ts` and `test/architecture/gate-targets.ts` change in the same commit. An ESLint BLOCK C zone lets only `platform/git.ts` and `platform/git-credential.ts` import the new module. Async `spawn` only (no `execFile` 1 MiB cap, no sync calls), argument arrays, no shell, closed stdin, `--end-of-options` before marketplace-controlled data, a timeout that kills the whole process group (shared with the D-PL9-15/19 launcher)." — gate edits are local and change together.
- [Test hermeticity carried from Phase 1] Q: "How does a unit test give production git spawns a hermetic environment (Phase 1 deferred item)?" → Selected: "The module takes its base environment as an injected parameter that defaults to `process.env` (the CONVENTIONS dependency-injection rule); unit tests pass `hermeticGitEnvironment`-built bases. No test preload." — a parameter with a default.

### Claude's Discretion
- File split inside `platform/` (one module or a module plus an error-classifier module), as long as the chokepoint names every launching file.
- Which first consumer lands with the module (`listRemotes`, `currentBranch`, or the `git credential` launch).

### Deferred Ideas (OUT OF SCOPE)
- Error wording for each kind: Phase 6.
- Old-clone settings (autocrlf, symlinks, filemode): Phase 3 (Q5, Q14 part).
- `-o UpdateHostKeys=no`: declined (D-SG-03).
- A CI floor-version leg: declined (D-SG-06); revisit if the README promises a floor that CI should prove.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SG-PRC-01 | Every git (and ssh probe) process starts from one platform module that `child-process-chokepoint` names, no shell, argument arrays, `--end-of-options` before untrusted data, closed stdin. | The only production git launch today is `platform/git-credential.ts:150`, so it must move (Finding F1). Gate edits are listed exactly (Pattern 6). `--end-of-options` is accepted by `clone`, `ls-remote`, `fetch`, `config`, `tag`, `update-ref`, `rev-parse --verify` but **not** by `checkout` on git 2.43 (E7). `git credential` needs stdin input then EOF (Pattern 2). The ssh probe itself lands in Phase 4 (ROADMAP Phase 4 notes). |
| SG-PRC-02 | No prompt or hang: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never`, `credential.interactive=false`, ssh BatchMode/StrictHostKeyChecking on the user's ssh command, no controlling tty, group-kill timeout. | Today's credential env runs the user's `core.askPass` and even returns its answer (E10, verified). `detached: true` gives a new session (sid = pid) and process group; group SIGTERM reaps `git`, `git remote-http`, `git-remote-http`, and an ssh child (E8, E9); zombies linger until reaped. |
| SG-PRC-03 | Hooks and fsmonitor off, ext/fd/git/ftp/ftps refused, repo-pointer variables stripped, `GIT_CEILING_DIRECTORIES` stops discovery reaching the user's project. | `GIT_CEILING_DIRECTORIES` must be `dirname(realpath(cwd))`; the cwd itself is **ignored** as a ceiling (E1, E2). Without it, `ls-remote` in the project reads the project's `url.insteadOf` (E2). Hooks, template hooks, fsmonitor neutralized by `-c` (E5). `GIT_TEMPLATE_DIR` beats `-c init.templateDir=` (E6). |
| SG-PRC-04 | Local lane git itself keeps off the network (`GIT_ALLOW_PROTOCOL=/` and the rest of `ms()`). | `GIT_ALLOW_PROTOCOL=/` refused file, https, ssh, and `foo::` helper transports under a user `protocol.*.allow=always`, while `rev-parse`, `symbolic-ref`, `tag -l`, `checkout` worked (E3). The `alias.remote-<x>` neutralizer only replaces helpers that do not exist on disk (E4). Do not copy `ms()`'s `GIT_CONFIG_*` stripping (Pitfall 5). |
| SG-PRC-05 | Typed error with a kind from exit status and stderr under `LC_MESSAGES=C`; callers narrow by `instanceof`. | Stderr corpus from real git 2.43 runs (Corpus table). `LC_ALL` must be moved to `LC_CTYPE` or it overrides `LC_MESSAGES=C` (upstream `sLo`). Spawn ENOENT also fires for a missing **cwd** (E11). Two kinds beyond the locked list are needed for totality (Open Question 2). |
| SG-PRC-06 | No usable git: clear message naming the requirement (macOS `xcode-select` form); path-source and hosted marketplaces still work. | Clone is still isomorphic-git in Phase 2, so a git-required gate in `platform/git.ts`'s network verbs is what makes the message appear (Finding F2). Needs a new closed-set reason token (Open Question 1). Cucumber can start a scenario Pi with a PATH that has no git through the existing `usePiWith()` pattern (Pattern 7). |
</phase_requirements>

## Summary

Phase 2 builds one subprocess module for git, but the product still clones with isomorphic-git, so very little of it has a production caller yet. Two facts set the shape of the plan. First, the only git process the extension starts today is `git credential fill/approve/reject` in `platform/git-credential.ts:150`. Success criterion 1 ("every git launch in production goes through it") can only hold if that launch moves into the new module in this phase. That also makes it the natural first consumer, and it lets `platform/git-credential.ts` leave the `child-process-chokepoint` list, as the locked decision says. Second, `marketplace add` and plugin install still clone through isomorphic-git, so a missing git would not show today. Success criterion 5 therefore needs a git-required gate: `platform/git.ts`'s network verbs (`clone`, `fetch`, `resolveRemoteRef`, `listRemoteTags`) ask the new module to locate git first and throw `GitCommandError` with kind `git-missing` when it cannot. Phase 3's spawn then raises the same error from the same place. Local verbs (`listTags`, `resolveTagOid`, `resolveRef`, and the rest) stay ungated, because a path-source marketplace may read its own tags.

The experiments on git 2.43 found four things the milestone research and the evidence file do not state. (1) `GIT_CEILING_DIRECTORIES` must be the parent of the real (symlink-resolved) cwd. A ceiling equal to the cwd is ignored, and git walked up into the user's project repository (E1, E2). (2) On POSIX, Node's spawn of a bare `git` with a relative or empty `PATH` entry runs a `git` file planted in the child's cwd (E12). So the module must resolve git to an absolute path on every platform, not only Windows. (3) `git checkout` on 2.43 treats `--end-of-options` as a pathspec (E7). The argv builder needs a per-subcommand rule, not a blanket insertion. (4) A spawn whose `cwd` does not exist fails with the same `ENOENT` as a missing binary (E11). The classifier must not call that `git-missing`.

Delivering the message needs a new token in the closed `Reason` set (`notification-types.ts`, `notification-wire.ts`, `notify-reasons.ts`, the closed-set lock tests, the catalog fixtures, and `docs/json-output.md` / `docs/output-catalog.md`). The text rides the row's cause chain, which `marketplace add` and install already render. That cause chain is the same one Phase 6 later rewords.

**Primary recommendation:** Extract the D-PL9-15/18/19 launcher into a spawn-injected `platform/process-run.ts` (moved, not copied). Build `platform/git-process.ts` on it (the only new `node:child_process` importer) and a pure `platform/git-failure-kind.ts` classifier. Move the `git credential` launch into it, and add the git-required gate to `platform/git.ts`'s four network verbs. Change the rule pack, the no-shell-out test, `gate-targets.ts`, and a composed BLOCK C zone in one commit.

## Project Constraints (from AGENTS.md)

- Never commit to `main`; branch is `features/system-git` (verified with `git branch --show-current`). Never rebase; merge to update. Never `--no-verify`.
- Commit messages: Conventional Commits, 5-72 char title, body lines at most 80, and no GSD milestone, phase, plan, or wave in the message or scope (`.agents/skills/committing/SKILL.md`).
- Every plan `SUMMARY.md` includes `## Threat Flags` (even "None").
- `gsd-tools windows append --description` is prefixed with `[system-git]`.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. "Our way is simpler" is not a license.
- NFR-1 atomic disk writes; NFR-2 no fix needs a Pi restart (licenses the positive-only lookup cache); NFR-3 safe to retry; NFR-5 network policy (amended by D-SG-02 in this phase); NFR-10 containment (amended by D-SG-03 in this phase).
- IL-2: output only through `shared/notification-dispatch.ts`; no direct stdout/stderr; git's own output must never reach Pi's stdio (spawn with piped stdio, never `inherit`).
- IL-4 no telemetry; IL-1 English only.
- Quality bar: `npm run check` green (typecheck, ESLint `--max-warnings 0`, fallow dead-code/health/dupes/rule packs, Prettier, source/test pairing, unit, integration, cucumber both profiles, 100% direct coverage per source-test pair).
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it.
- TypeScript strict; typed errors `extends Error`, set `this.name`, readonly structured fields, `{ cause }` passthrough, narrowed by `instanceof` (CONVENTIONS).
- No `fallow-ignore` marker in a module that a later phase consumes; land each new module with its first production consumer.
- Both complexity gates (ESLint `sonarjs/cognitive-complexity: 15`, fallow `maxCognitive: 15`, `maxCyclomatic: 20`) apply independently; classifier ladders must stay flat (a table, not nested ifs).
- `no-await-in-loop` requires an `eslint-disable-next-line` with a reason (PATH order is the precedent at `platform/package-manager.ts:402`).
- Unit-test skill: no test-only exports, no module-level mutable state (factory-owned instead), "Do not default a parameter to a live boundary. Wire real adapters in one composition module" (`.agents/skills/typescript-unit-tests/rules/pairing-and-design.md`). See Open Question 5 for how this meets the locked "defaults to `process.env`" wording.
- Sandbox: run Node through `PATH="/opt/pi-claude-marketplace/bin:$PATH"` (Node v24.22.3 verified); no `ssh`; `GIT_CONFIG_COUNT=3` injected (verified: `credential.interactive=false` and two `url.https://github.com/.insteadOf` rewrites); `fd` missing (5 known Glob scenario failures); `dispatch-exec.test.ts:39` env-size failure is known.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn, capture, timeout, process-group/tree kill, Windows PATH lookup | `platform/process-run.ts` (new, pure, spawn injected) | `platform/package-manager.ts`, `platform/git-process.ts` | One launcher for both runners keeps `fallow dupes` clean; spawn injected so the file needs no chokepoint entry. |
| git lookup (absolute path, macOS shim, Windows rules, positive cache) | `platform/git-process.ts` | `platform/process-run.ts` (Windows lookup) | D-SG-04; cache owned by a factory-created instance. |
| git env and argv hardening, local lane, ceiling | `platform/git-process.ts` | — | D-SG-02, D-SG-05; one builder for every git command. |
| Stderr/exit to kind | `platform/git-failure-kind.ts` (new, pure) | `platform/git-process.ts` | Keeps the ladder out of the launcher's complexity budget; Claude's discretion allows the split. |
| `GitCommandError`, `GitFailureKind` | `shared/errors.ts` | — | CONVENTIONS: domain errors live in `shared/errors.ts`; fallow allows `platform` → `shared`. |
| Kind → closed-set reason | `shared/git-failure-classifiers.ts` | `shared/notification-types.ts` (new token) | D-PL7-01 ladder already lives here; every surface (add, install, update, apply, import, autoupdate) reads it. |
| git credential protocol | `platform/git-credential.ts` | `orchestrators/auth-host.ts` (composition) | Keeps its protocol; its launch moves into the git module. |
| git-required gate on network verbs | `platform/git.ts` | `orchestrators/marketplace/add.ts`, `install.messaging.ts` (render) | Same throw site Phase 3's spawn will use. |
| User-visible message | `shared/notification-dispatch.ts` via existing failed-row builders | — | IL-2; the cause chain carries the text. |
| Behavior proof | `features/` cucumber + `test/platform/*` | `features/support/world.ts` (`usePiWith`) | AGENTS.md Behavioral tests rule. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` `spawn` | Node 24.22.3 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | Start git asynchronously with piped stdio, no shell | Locked: async `spawn` only. `execFile`'s `maxBuffer` default is `1024 * 1024` [CITED: nodejs.org/api/child_process.html]; a sync call starves the state-lock refresh timer [CITED: ROADMAP Phase 2 notes]. |
| system `git` | 2.43.0 in sandbox; documented floor 2.25 (D-SG-06) | The transport and every local verb from Phase 3 on | D-SG-01. |
| `node:fs/promises` `stat`/`access`/`realpath` | built-in | Lookup (`isFile`, executable bit), ceiling (`realpath`), cwd existence check | Async only; `prompt-shell.ts` uses `statSync`, do not copy that. |
| `node:string_decoder` | built-in | Split-UTF-8-safe capture | Already used by `package-manager.ts:44`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `strong-mock` | `^9.2.2` (devDependency) | Strict interaction mocks | Only where an existing test of the module family already uses it; the package-manager tests use hand fakes. |
| `@cucumber/cucumber` | `^13.3.0` (devDependency) | SG-PRC-06 and askpass/cwd behavior scenarios | Every user-visible change. |
| Phase 1 stand-ins | in repo | `HttpsGitHost` (`credential`, `hold`, `status` arms), `SshGitHost` (records each launch's argv), `hermeticGitEnvironment` | Module-level real-git cases for SG-PRC-02/03. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| own launcher | `execa`, `cross-spawn`, `simple-git`, `dugite` | Rejected by the roadmap notes ("rejects any new dependency"). |
| `-c` keys on argv | exporting keys through `GIT_CONFIG_COUNT` (upstream also does this) | `-c` already reaches child gits through `GIT_CONFIG_PARAMETERS` (E13, verified) and beats `GIT_CONFIG_COUNT` for the same key (E13). The `GIT_CONFIG_COUNT` export matters for submodule children, which is Phase 7. |
| `GIT_CEILING_DIRECTORIES` only | `--git-dir=<dir>/.git --work-tree=<dir>` on in-clone commands | Both are valid; the ceiling is what SG-PRC-03 names. `--git-dir` can be added in Phase 3 for destructive verbs (PITFALLS Pitfall 3). |

**Installation:** none. No package is added.

**Version verification:** no external package recommended; `git --version` → `git version 2.43.0`, `node --version` → `v24.22.3` [VERIFIED: sandbox].

## Package Legitimacy Audit

No external packages are installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Key Findings (read these first)

- **F1. The credential launch must move in this phase.** `grep` for spawns in `extensions/` finds `platform/git-credential.ts:150` (`spawnProcess("git", ["credential", subcommand], {`), the taskkill and package launches in `package-manager.ts`, the prompt shell, and the hook executors. No other production code starts git [VERIFIED: grep + Read of `platform/git-credential.ts:143-187`]. So the credential launch is the first consumer, and the chokepoint can drop `platform/git-credential.ts`.
- **F2. SG-PRC-06 needs a gate, because clone is still isomorphic-git.** Put `await <git>.locate()` (throws `GitCommandError` kind `git-missing`) at the top of `clone`, `fetch`, `resolveRemoteRef`, `listRemoteTags` in `platform/git.ts`. Do not gate `listTags`/`resolveTagOid`/`resolveRef`/`checkout`/`forceUpdateRef`/`currentBranch`/`listRemotes`: `orchestrators/plugin/marketplace-tag-probe.ts` reads a path-source dependency's tags from the marketplace clone with `listTags`/`resolveTagOid` [VERIFIED: Read of `marketplace-tag-probe.ts:1-25`], and path-source flows must keep working without git (SG-PRC-06). Phase 3 must revisit this when local verbs move to system git (flag for Phase 3).
- **F3. Recommended first-consumer set: the credential launch plus the gate; leave `currentBranch`/`listRemotes` on isomorphic-git until Phase 3.** Moving `currentBranch` would give the local lane a production caller, but `platform/git.ts`'s exported functions take no injected runner, so the git contract tests in `test/platform/git.test.ts` would spawn git with `process.env` (the sandbox's `GIT_CONFIG_COUNT=3` reaches them, against SG-HRN-01). Phase 3 rewrites `git.ts` with an injected runner anyway. The local lane, the ssh-command composition, and the transport kinds are then exercised by module tests only in Phase 2 (internal branches, no unused exports, so `fallow dead-code` stays green).
- **F4. `GIT_CEILING_DIRECTORIES` = `path.dirname(await realpath(cwd))`.** See E1/E2. Every git command runs with `cwd` equal to the directory git should treat as the repository (or, for clone, credential, ls-remote, a directory that is not a repository), never a subdirectory of it.
- **F5. Resolve git to an absolute path on every platform** (E12). Skip relative and empty `PATH` entries on POSIX too, and spawn the absolute path.

## Architecture Patterns

### System Architecture Diagram

```
 /claude:plugin marketplace add | install | update | apply | import | autoupdate
        │
        ▼
 orchestrators (add.ts, clone-cache.ts, install-*.ts ...)  ── GitOps seam (DEFAULT_GIT_OPS)
        │                                   │
        │ 401 challenge (isomorphic-git)    │ network verb
        ▼                                   ▼
 platform/git-auth-callbacks.ts      platform/git.ts  clone/fetch/resolveRemoteRef/listRemoteTags
        │                                   │ 1. git.locate()  ──fails──► GitCommandError{git-missing}
        ▼                                   │ 2. isomorphic-git (unchanged in Phase 2)
 platform/git-credential.ts                 │
   fill/approve/reject                      │
        │ run({ args:["credential",…], input, lane:"network", cwd:neutral })
        ▼                                   ▼
 ┌──────────────────── platform/git-process.ts (only node:child_process importer for git/ssh) ─────┐
 │ locate(): absolute PATH entries only → macOS shim check → Windows .exe only, skip cwd matches   │
 │           positive cache per instance; invalidated on ENOENT / xcrun                           │
 │ buildEnv(base): strip repo pointers + GIT_TEMPLATE_DIR, force no-prompt vars, LC_MESSAGES=C     │
 │                 (LC_ALL→LC_CTYPE), ceiling=dirname(realpath(cwd)), lane vars (local only)       │
 │ buildArgv(): -c hardening list, subcommand, options, [--end-of-options per table], operands     │
 └──────────────────────────────┬─────────────────────────────────────────────────────────────────┘
                                ▼
 platform/process-run.ts (pure; spawn injected): spawn(no shell, piped, detached on POSIX,
   windowsHide), stdin input-then-EOF or ignore, capped capture, timeout → SIGTERM group →
   grace → SIGKILL group → deadline; Windows: System32\taskkill /T /F; AbortSignal
                                ▼
 GitRun {exitCode, stdout, stderr, timedOut, aborted, spawnError}
                                ▼
 platform/git-failure-kind.ts (pure ladder) → GitFailure {kind, …}
                                ▼
 shared/errors.ts GitCommandError (redacted stderr)  ──►  shared/git-failure-classifiers.ts
   instanceof rung → D-PL7-01 reason (+ new "git missing" token)  ──►  failed row + cause chain
   ──► shared/notification-dispatch.ts notify()  (IL-2)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── platform/process-run.ts        # NEW: extracted launcher (pure; spawn injected); no child_process import
├── platform/package-manager.ts    # thinner: npm.cmd → npm-cli.js, update-notifier env, own spawn binding
├── platform/git-process.ts        # NEW: git lookup, env/argv builder, lanes, run(); imports spawn
├── platform/git-failure-kind.ts   # NEW: pure stderr/exit → kind ladder (table-driven)
├── platform/git-credential.ts     # launch moved to git-process; no child_process import
├── platform/git.ts                # network verbs call locate() first
├── shared/errors.ts               # + GitCommandError, GitFailureKind/GitFailure
└── shared/git-failure-classifiers.ts  # + instanceof GitCommandError rung
test/platform/
├── process-run.test.ts            # NEW pair: cases MOVED from package-manager.test.ts
├── package-manager.test.ts        # keeps npm-specific cases only
├── git-process.test.ts            # NEW pair: fake-spawn table cases + real-git cases on stand-ins
├── git-failure-kind.test.ts       # NEW pair: corpus table
└── git-credential.test.ts         # rewired to the new launcher contract
```

### Pattern 1: Extract the launcher, do not copy it

**What:** Move `watchProcess`, `startKillTimers`, `stopTree`, `killWindowsTree`, `appendCapped`/`finishOutput`, `windowsPathDirectories`, `findOnWindowsPath`, `variable`, and the `Process`/`SpawnOptions`/`Host` interfaces from `platform/package-manager.ts:46-410` into `platform/process-run.ts`. Keep the injected `spawn` contract so `process-run.ts` imports nothing from `node:child_process` (the no-shell-out regexes also match a type-only import: `/from\s+["']node:child_process["']/`, `no-shell-out.test.ts:154`). `package-manager.ts` keeps `NODE_PACKAGE_MANAGER_SPAWN = spawn as …`, the `npm.cmd` → `npm-cli.js` launch (`:412-444`), and the `npm_config_update_notifier` env (`:351`).
**What the shared launcher must add for git:**
- stdin: `"ignore"` or an `input` string written then `end()`ed, with an `error` listener on stdin to swallow EPIPE (`git-credential.ts:179-185` precedent).
- capture strategy per run: package manager keeps a 65,536-char **head** prefix (`OUTPUT_LIMIT`, `:153`); git classification needs the **tail** of stderr (the `fatal:` line is last) and, from Phase 3, much larger stdout (`ls-remote` of many tags). Make the cap and head/tail choice parameters.
- `windowsHide: true` on Windows (cheap; Node docs: "Hide the subprocess console window that would normally be created on Windows systems. Default: false" [CITED: nodejs.org/api/child_process.html]).
- Windows lookup parameters: the extension list (`[".exe", ".cmd"]` today; git adds `.bat` as a refused launcher) and a "skip candidates inside this directory" rule (D-SG-04). Whether npm adopts the cwd rule is Open Question 4.
**Test move:** the generic cases in `test/platform/package-manager.test.ts` (timeouts, grace, group kill, taskkill, UTF-8 capture, spawn errors, Windows lookup; lines 122-1189) move to `test/platform/process-run.test.ts`. A copied test block would be a `fallow dupes` clone group.

### Pattern 2: One git request shape, one builder

```typescript
// platform/git-process.ts (sketch; names are recommendations)
export type GitLane = "local" | "network";

export interface GitRequest {
  readonly cwd: string;              // must exist; ceiling = dirname(realpath(cwd))
  readonly lane: GitLane;            // "local" adds GIT_ALLOW_PROTOCOL=/ etc. (D-SG-02)
  readonly subcommand: GitSubcommand; // closed union: "credential" now; more in Phase 3
  readonly options: readonly string[];  // Pi-owned flags only
  readonly operands?: readonly string[]; // marketplace-controlled data; gets --end-of-options where supported
  readonly input?: string;           // stdin, written then closed (git credential)
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;     // D-PL8-24 abort scope
}

export interface GitProcess {
  /** Absolute git path; throws GitCommandError{kind:"git-missing"}; caches a found path only. */
  locate(): Promise<string>;
  /** Resolves with the run; throws GitCommandError when the run failed (see allowExit). */
  run(request: GitRequest & { readonly allowExit?: readonly number[] }): Promise<GitResult>;
}
```

**Environment (every command):** start from the injected base env, then:
1. Delete (all spellings on Windows): `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE`, `GIT_CEILING_DIRECTORIES`, `GIT_DISCOVERY_ACROSS_FILESYSTEM`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_SHALLOW_FILE`, `GIT_NAMESPACE`, `GIT_IMPLICIT_WORK_TREE`, `GIT_REFERENCE_BACKEND` [CITED: 02-EVIDENCE.md Q14 layer 2, upstream `rn()`], plus `GIT_TEMPLATE_DIR` (E6, recommended addition) and `GIT_SSH` (upstream `nn` deletes it).
2. Force: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never` (override user values, upstream `GJe`); set when absent: `GIT_NO_LAZY_FETCH=1`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_LFS_SKIP_SMUDGE=1`; `GIT_PROXY_COMMAND=""` unless the user set it; `GIT_DEFAULT_REF_FORMAT=files`.
3. Locale: `LC_MESSAGES=C`; if `LC_ALL` is set, move its value to `LC_CTYPE` and delete `LC_ALL` (upstream `sLo` [CITED: 02-EVIDENCE.md C4]). Reason: `LC_ALL` overrides every `LC_*` category, so `LC_MESSAGES=C` alone does nothing when the user exports `LC_ALL` [ASSUMED: POSIX locale precedence; no translated git locale is installed in the sandbox to run it].
4. `GIT_CEILING_DIRECTORIES = dirname(realpath(cwd))`; refuse (kind `refused-input`) a ceiling that contains `path.delimiter` (upstream `Cannot run git under ...`).
5. Network-lane commands that can use ssh (Phase 3+ clone/fetch/ls-remote): `GIT_SSH_COMMAND = <user's choice> -o BatchMode=yes -o StrictHostKeyChecking=yes`, where the user's choice is `GIT_SSH_COMMAND` > global/system `core.sshCommand` > `GIT_SSH` > `ssh`; plink gets `-batch`, tortoiseplink nothing; `GIT_SSH_VARIANT` from `ssh.variant` [CITED: 02-EVIDENCE.md Q14 `nn`]. Read `core.sshCommand` with `git config --get` from a neutral cwd, never from a clone (a repo-local `core.sshCommand` is a code-execution vector; `GIT_SSH_COMMAND` in env beats config, so setting it neutralizes the repo value). `git credential` does not need this branch.
6. Local lane only: `GIT_ALLOW_PROTOCOL=/`, `GIT_SSH_COMMAND=false`, `GIT_NO_LAZY_FETCH=1`, `GIT_LFS_SKIP_SMUDGE=1`, and `-c alias.remote-<x>=version` for the listed helper names (defense in depth only, E4). Keep the user's `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_COUNT`/`GIT_CONFIG_PARAMETERS` (Pitfall 5).

**Argv (every command):** `-c` for each key upstream's `uxt` list sets, unless the caller passed that key: `core.fsmonitor=` (the locked list writes `core.fsmonitor=false`; both disable it, E5 used the empty form), `core.hooksPath=/dev/null` (Windows `\\.\NUL`, MEDIUM), `core.askPass=`, `protocol.ext.allow=never`, `core.alternateRefsCommand=f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f`, `submodule.recurse=false`, `log.showSignature=false`, `format.pretty=medium`, `gc.auto=0`, `maintenance.auto=false`, `diff.autoRefreshIndex=false`, the 28 `hook.<name>.enabled=false` keys, then `pinArgs` (`protocol.{ext,fd,git,ftp,ftps}.allow=never`, `init.defaultRefFormat=files`, `core.longpaths=true`), `credential.interactive=false`, `init.templateDir=` [CITED: 02-EVIDENCE.md Q14, exact lists]. Then the subcommand, Pi's options, and operands. Older git ignores unknown `-c` keys (E13 ran `version` with `core.longpaths`, `init.defaultRefFormat`, `hook.pre-commit.enabled`, `log.showSignature` on 2.43: exit 0).

**`--end-of-options` table (E7, git 2.43):**

| Subcommand | Accepts `--end-of-options` | Rule |
|------------|----------------------------|------|
| `clone`, `ls-remote`, `fetch`, `config --get-all`, `tag -l`, `update-ref` | yes | insert before operands |
| `rev-parse --verify` | yes | insert after `--verify` |
| `rev-parse` (no `--verify`) | echoes it as output | always use `--verify` |
| `checkout` | **no**: `error: pathspec '--end-of-options' did not match` | refuse an operand starting with `-` (upstream `mCi` does), then `git checkout <ref> --` |
| `credential` | n/a | no operands; data goes through stdin, which `sanitizeAttrValue` already guards |

**cwd for commands outside a clone:** `git credential` today passes no `cwd`, so it inherits Pi's cwd (the user's project) and reads the project's `.git/config` helpers (`git-credential.ts:41-43`, PITFALLS Pitfall 18). Run it with a neutral existing directory that is never a repository (recommendation: `os.tmpdir()` resolved with `realpath`; nothing is written there) and the ceiling at its parent. The exact directory is Open Question 3.

### Pattern 3: git lookup (D-SG-04)

- POSIX: walk `PATH`, keep only absolute entries (relative and empty entries resolve against the child's cwd, E12), first `<dir>/git` that is a file with the execute bit (`access(X_OK)`) wins. Spawn that absolute path.
- macOS, before the first spawn of a found path: treat `/usr/bin/git` (after `realpath`) as the xcrun shim unless a developer directory holds a real git. Heuristic proposal: `DEVELOPER_DIR/usr/bin/git`, the target of `/var/db/xcode_select_link` + `/usr/bin/git`, or `/Library/Developer/CommandLineTools/usr/bin/git` exists [ASSUMED: upstream's `kft` body is stubbed in the Linux build; it imports `existsSync`, `lstatSync`, `readdirSync`, `statSync` per 02-EVIDENCE.md C7]. Backstop: stderr containing `xcrun: error:` → `git-missing` and cache invalidation. Message: `git is not installed on this Mac. To install it, run xcode-select --install, then try again.` [CITED: 02-EVIDENCE.md Q1, upstream `U0r`].
- Windows: the extracted `findOnWindowsPath` over absolute `PATH` entries (any spelling, quotes stripped), `<dir>\git.exe` wins, a `.cmd`/`.bat` found first is refused (D-PL9-18), a candidate inside `realpath(process.cwd())` is skipped (upstream skips, then keeps searching [CITED: 02-EVIDENCE.md Q3]). Git for Windows ships `cmd\git.exe` as a real executable [CITED: 02-EVIDENCE.md Q3]. Upstream's launcher bypass (`mingw64\bin\git.exe` at 2.26+ with `MSYSTEM` unset) is not in D-SG-04; leave it out and note it in the manual Windows check.
- Cache: the found absolute path, per `GitProcess` instance (factory-owned, not module state). Never cache "missing" (NFR-2). Drop the cache on a spawn `ENOENT` whose binary no longer `stat`s, and on an `xcrun: error:` stderr.

### Pattern 4: typed failure (`GitCommandError`)

Follow the `PluginShapeError` precedent (`shared/errors.ts:1184-1273`: a `shape` union with a `kind`, `PluginShapeErrorKind = PluginShapeErrorShape["kind"]`):

```typescript
// shared/errors.ts (sketch)
export type GitFailure =
  | { readonly kind: "timeout"; readonly timeoutMs: number }
  | { readonly kind: "aborted" }
  | { readonly kind: "git-missing"; readonly cause: "not-found" | "macos-shim" | "batch-launcher" }
  | { readonly kind: "https-auth" | "ssh-auth" | "proxy-refused" }
  | { readonly kind: "network"; readonly httpStatus?: number; readonly curlCode?: number }
  | { readonly kind: "repository-not-found"; readonly httpStatus?: number }
  | { readonly kind: "no-stderr" }
  // … the remaining kinds, each with only the fields it carries
  ;
export type GitFailureKind = GitFailure["kind"];

export class GitCommandError extends Error {
  readonly failure: GitFailure;
  readonly operation: string;      // e.g. "credential fill" -- never an operand or input
  readonly exitCode: number | null;
  readonly stderr: string;         // redacted, tail-capped; never in `message`
  constructor(failure: GitFailure, details: { operation: string; exitCode: number | null; stderr: string }, options?: ErrorOptions) { … this.name = "GitCommandError"; }
  get kind(): GitFailureKind { return this.failure.kind; }
}
```

Keep stderr out of `message`: the cause chain is user-visible today (cucumber `cause chain` columns), and Phase 6 owns wording. For `git-missing`, `message` is the requirement text, because SG-PRC-06 needs it now. Redact before storing: strip `scheme://user[:pass]@` userinfo (git 2.43 already drops it from its own HTTP messages, E14, but `remote:` lines and helper stderr are server/helper controlled). Put the redactor in `shared/` so Phase 6 (SG-ERR-02) extends it.

### Pattern 5: kind ladder (table-driven, first match wins)

Order matters. Run it in `platform/git-failure-kind.ts` as an ordered array of `{ kind, test }` rows so both complexity gates stay low.

1. `signal.aborted` → `aborted`. 2. `timedOut` → `timeout` (carry `timeoutMs`). 3. Spawn error: `ENOENT`/`EACCES` with the cwd present and the binary gone → `git-missing` (E11: a missing cwd gives the same `ENOENT`; check the cwd before spawn and report `refused-input` or a filesystem error instead). 4. Exit 0 or a caller-allowed exit (`allowExit`, e.g. `rev-parse --verify --quiet` exit 1 → the caller maps it to "not found", `symbolic-ref --quiet` exit 1 → detached) → success. 5. Stderr rows, in this order:

| # | Kind | Trigger (stderr under `LC_MESSAGES=C`, or exit) | Corpus source |
|---|------|-----------------------------------------------|---------------|
| 1 | `git-missing` | `xcrun: error:` | upstream `rLo` (ASSUMED text on Linux) |
| 2 | `git-too-old` | exit 129, or `^error: unknown (option\|switch) ` | E15: `error: unknown option \`no-such-flag'` + usage, exit 129 |
| 3 | `dubious-ownership` | `detected dubious ownership in repository at '` | E15 (chowned repo) |
| 4 | `protocol-refused` | `^fatal: transport '[^']+' not allowed` | E3, E15 |
| 5 | `ssh-host-key-changed` | `REMOTE HOST IDENTIFICATION HAS CHANGED` (before row 6: the banner also prints `Host key verification failed.`) | E16 (stub with OpenSSH text) |
| 6 | `ssh-host-key-unknown` | `Host key verification failed` | E16 |
| 7 | `proxy-refused` | `remote: access denied by the git proxy` (before row 9's 403) | upstream `MCn` |
| 8 | `ssh-auth` | `Permission denied (publickey` | E16 |
| 9 | `https-auth` | `could not read Username for '`, `could not read Password for '`, `terminal prompts disabled`, `Authentication failed for '`, `The requested URL returned error: 401`/`403` | E14/E15 (stub server) |
| 10 | `repository-not-found` | `^fatal: repository '.*' not found` (git prints this for HTTP 404, not the status), `does not appear to be a git repository`, `^fatal: repository '.*' does not exist`, `ERROR: Repository not found`, `returned error: 410` (carry `httpStatus`) | E15 |
| 11 | `remote-ref-missing` | `couldn't find remote ref `, `Remote branch .* not found in upstream origin` | E15 |
| 12 | `commit-missing` | `not our ref `, `reference is not a tree: ` | E15 |
| 13 | `local-ref-missing` | `error: pathspec '.*' did not match any file` | E15 (`checkout nope`, exit 1) |
| 14 | `not-a-repository` | `^fatal: not a git repository` | E1 |
| 15 | `network` | `Could not resolve host`, `Failed to connect to`, `Couldn't connect to server`, `Connection timed out`, `Connection refused`, `Connection reset`, `ssh: Could not resolve hostname`, `ssh: connect to host`, `fatal: unable to connect to `, `error: RPC failed; curl (\d+)`, `SSL certificate problem`, `returned error: 5\d\d`, then the generic `fatal: unable to access '` (carry `httpStatus`/`curlCode`) | E15 |
| 16 | `remote-error` | `^fatal: remote error: ` (after row 12, which also starts with it) | E15 |
| 17 | `ssh-auth` | `Could not read from remote repository` (last: the file-missing and ssh-resolve cases also print it, and rows 10 and 15 catch them first) | E15, E16 |
| 18 | `no-stderr` | non-zero exit, empty stderr (carry exit code) | upstream `ZMo` |
| 19 | `failed` | anything else | — |

`pin-mismatch` and `refused-input` are raised by Pi code before or after a run, not from stderr. Phase 4 will meet `error: cannot run ssh: No such file or directory` / `fatal: unable to fork` (E16); it falls to `failed` in Phase 2.

### Pattern 6: gate edits, all in the commit that adds the module

1. `rule-packs/architecture.json` `child-process-chokepoint` (`:110-123`). Today [VERIFIED: Read, `rule-packs/architecture.json:115-122`]:
   ```
   "exclude": [
     "extensions/pi-claude-marketplace/platform/git-credential.ts",
     "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
     "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
     "extensions/pi-claude-marketplace/platform/package-manager.ts",
     "extensions/pi-claude-marketplace/platform/prompt-shell.ts"
   ],
   "message": "D-21 / D-PL9-11 / D-CF1-02: only the five sanctioned spawn sites import node:child_process: the git credential helper, the two hook executors, the plugin package manager runner, and the ! prompt shell of user-invoked skills and commands. ..."
   ```
   Replace the first entry with `extensions/pi-claude-marketplace/platform/git-process.ts`; rewrite the message to cite D-SG-01 (which reverses D-21) and name "the git process module (git and ssh launches)". Still five files. `platform/process-run.ts` is not listed (it imports no `child_process`). The `no-network-modules` rule's message ("Git traffic goes through platform/git.ts") may stay true in Phase 2; add "and the git subprocesses that platform/git-process.ts starts".
2. `test/architecture/gate-targets.ts` `SHELL_OUT_EXEMPT_TARGETS` (`:221-227`) — same swap, and the doc comment above it (`:209-220`, "`git-credential.ts` runs the credential helper").
3. `test/architecture/no-shell-out.test.ts` — `expectedFiles` (`:210-216`, today `"platform/git-credential.ts"`) becomes `"platform/git-process.ts"` (keep it sorted); rewrite the D-21 supersession header (`:59-138`), the test title `"no child_process imports outside the platform/git-credential whitelist (D-21)"` (`:163`), and the offender message that says isomorphic-git supersedes MA-7 (`:196`). Add a second import-gate table beside the package-runner table (`:14-57`) for `platform/git-process.ts`: `platform/git.ts` → `[]`, `platform/git-credential.ts` → `[]`, `platform/other.ts` → `["import-x/no-restricted-paths"]`, `orchestrators/plugin/package-install.ts` → violation, `edge/commands.ts` → violation. Keep the package-runner rows passing (they read the computed config, so they catch the composition pitfall below).
4. `eslint.config.js` BLOCK C. Flat config replaces a rule's options with the last matching block's options; the repo already relies on this ("Keep all other direction restrictions when adding the package-runner zone", `:529-530`; "this block replaces the earlier syntax rule options", `:565-566`) [VERIFIED: Read, `eslint.config.js:514-550`]. A new block that only ignores `git.ts`/`git-credential.ts` would drop the package-manager zone for every other file, and a block that also ignores `package-install.ts` would forbid nothing new to it. Use four blocks:
   - all files: `IMPORT_DIRECTION_ZONES` (exists, `:518-527`);
   - all files except `package-install.ts`: + package-manager zone (exists, `:529-550`);
   - all files except `package-install.ts`, `platform/git.ts`, `platform/git-credential.ts`: + package-manager zone + git-process zone (new);
   - `package-install.ts` only: + git-process zone (new).
   A `GIT_PROCESS_IMPORTERS` constant beside `PACKAGE_INSTALL_SEAM` (`:31-36`) with a D-SG-01 comment. BLOCK F needs nothing: its pattern `regex: "platform/git"` (`:578`) already matches `platform/git-process` and `platform/git-failure-kind`, and `NETWORK_SEAMS` gets no entry (D-SG-02).
5. `CREDENTIAL_LEAK_TARGETS` (`gate-targets.ts:152-171`) — recommended: append `"extensions/pi-claude-marketplace/platform/git-process.ts"` last (the list is positional: `no-credential-leak.test.ts:78-91` destructures it and `:96-109` pins `DECLARED_MODULE_ORDER`), add the binding and a scan that no `new Error(` / `new GitCommandError(` interpolates `input`, `password`, or `cred.`. Edit both files together. `platform/git-credential.ts` stays in the list (it still builds the attribute block).
6. `.fallowrc.json`: no change. Platform may import shared, shared may import platform [VERIFIED: `.fallowrc.json` boundaries `{'from': 'platform', 'allow': ['shared']}`]. No `ignoreExports` entry: every new export has a production importer.
7. Docs that enumerate the chokepoint (`.planning/codebase/STACK.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`, and `AGENTS.md`'s NFR-5/NFR-10 text for D-SG-02/03), plus PROJECT.md Key Decisions D-SG-01..06.

### Pattern 7: cucumber "no usable git"

`features/support/world.ts:1160-1164` already has `usePiWith(environment)`, used by `usePiWithGitHubBaseUrl` (`:688-693`) and `usePiWithBackgroundUpdateDelay` (`:702-709`) to start a scenario Pi with a changed environment. Add `usePiWithoutGit()` that starts Pi with `{ ...currentRun().piEnvironment, PATH: <a directory with no git> }`. Pi itself starts from the absolute `process.execPath` (`features/lib/pi-rpc.ts:308`), so it needs nothing on PATH. Phase 1 found git and ssh sharing `/usr/bin`; use the SSH stand-in's `binDirectory` alone (it holds only the stub `ssh`, whose wrapper is `#!/bin/sh` with an absolute Node path) or an empty directory. `rpcChildEnvironment` keeps its key set, so `hermetic-git-environment.test.ts` is unaffected (it asserts keys, not values).

Scenarios (each must fail without the change):
1. git-source `marketplace add` (url and github forms) with no git → failed row, new reason token, cause chain with the requirement text, `Then the git host receives no request`, no checkout, no `claude-plugins.json`.
2. plugin install of a git-source plugin from a path-source marketplace with no git → failed row with the same token; nothing recorded; no request.
3. path-source marketplace add and path-source plugin install with no git → succeed.
4. hosted-manifest marketplace add with no git → succeeds (Node `fetch`).
5. Credential lookup no longer runs the user's askpass (E10): global `core.askPass` = a recording script, a host requiring a credential, none stored → `authentication required` as today, and the script recorded nothing. Fails today (askpass runs and its answer is sent).
6. Optional: a repo-local `credential.helper` in the project's `.git/config` is not consulted (cwd change).

### Anti-Patterns to Avoid

- **Ceiling at the cwd itself:** ignored by git (E1b); use the parent of the realpath.
- **Bare `git` spawn on POSIX:** binary planting through `.`/empty PATH entries (E12).
- **Blanket `--end-of-options`:** breaks `checkout` and plain `rev-parse` on 2.43 (E7).
- **Copying upstream `ms()` verbatim:** it strips `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_COUNT`/`GIT_CONFIG_PARAMETERS`; the cucumber Pi relies on `GIT_CONFIG_GLOBAL` (`features/support/pi-process.ts:170-172`) and users keep their config (milestone rule). D-SG-02 lists the lane variables without that strip.
- **`ENOENT` ⇒ git missing:** also a missing cwd (E11).
- **`message` carrying stderr:** stderr goes to a redacted field; the cause chain is user-visible.
- **Module-level lookup cache:** a factory-owned instance instead (unit-test skill, "Replace module-level mutable state with state owned by a factory-created instance").
- **`stdio: "inherit"`** or a sync spawn.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timeout + group kill + Windows tree kill | a second timer/kill implementation in `git-process.ts` | the extracted `platform/process-run.ts` (D-PL9-15/19 code) | Already handles close-after-SIGTERM, SIGKILL escalation, deadline settle, pid ≤ 1, failed group signal, taskkill from System32; a copy fails `fallow dupes`. |
| Windows command lookup | new PATH walker | extracted `findOnWindowsPath` (`package-manager.ts:386-410`) with parameters | Same D-PL9-18 rules; one place to add the cwd skip. |
| Credential wire format | anything new | keep `buildAttributeBlock`/`parseCredentialOutput`/`sanitizeAttrValue` in `git-credential.ts` | Contract-tested (`test/platform/credential-ops-contract.ts`, 31 cases). |
| Protocol blocking | `-c protocol.allow=never` | `GIT_ALLOW_PROTOCOL=/` | User `protocol.<x>.allow=always` beats it (02-EVIDENCE.md E-Q11 case B). |
| Failure reasons | per-surface stderr matching | one `instanceof GitCommandError` rung in `classifyGitFailure` | Every surface already reads that ladder. |
| A new subprocess dependency | `execa`/`cross-spawn`/`simple-git` | Node `spawn` | Roadmap rejects new dependencies. |

**Key insight:** almost all the risk in this phase is in the details git and Node get wrong silently (ceiling semantics, PATH resolution, `--end-of-options` coverage, ENOENT ambiguity, locale precedence, flat-config option replacement), so each rule needs a table row in the module test that would fail on the plausible wrong implementation.

## Experiment Log (git 2.43.0, `env -i HOME=<tmp> GIT_CONFIG_NOSYSTEM=1 PATH=/usr/bin:/bin`, scratchpad only)

| ID | Setup | Result | Tag |
|----|-------|--------|-----|
| E1a | project repo; `-C <project>/.pi/pi-claude-marketplace/clones/tools` (no `.git`) `symbolic-ref --short HEAD` | `main` (the project's branch) | [VERIFIED: run] |
| E1b | same, `GIT_CEILING_DIRECTORIES=<clone dir>` | `main`: a ceiling equal to the cwd is ignored | [VERIFIED: run] |
| E1c | same, ceiling = parent of clone dir | `fatal: not a git repository (or any of the parent directories): .git`, exit 128 | [VERIFIED: run] |
| E1d/e | real clone, ceiling = clone dir or its parent | `main` (works) | [VERIFIED: run] |
| E1g | ceiling = clone dir, cwd = clone's subdir | `fatal: not a git repository` (so cwd must be the repo root) | [VERIFIED: run] |
| E2 | symlinked cwd; ceiling = `dirname(link)` | `main` (leaked); ceiling = `dirname(realpath(link))` → `not a git repository` | [VERIFIED: run] |
| E2b | project `.git/config` `url.<file://project>.insteadOf=https://example.invalid/x`; `ls-remote https://example.invalid/x` from a subdir | the rewrite applied (listed the project's HEAD); with the ceiling: `Could not resolve host: example.invalid` | [VERIFIED: run] |
| E3 | user `protocol.{file,https,ext}.allow=always`; `GIT_ALLOW_PROTOCOL=/` | `fatal: transport 'file' not allowed` (file URL and plain-path remote `fetch origin`), `'https'`, `'ssh'` (scp form), `'foo'` (`foo::bar`), all exit 128; `rev-parse`, `symbolic-ref`, `tag -l`, `checkout` work | [VERIFIED: run] |
| E4 | `-c alias.remote-foo=version ls-remote foo::bar` / `-c alias.remote-https=version ls-remote https://…` | first: exit 128, no "not a git command" (alias used); second: real https attempt (`Could not resolve host`), alias ignored because `git-remote-https` exists | [VERIFIED: run] |
| E5 | template `post-checkout` via user `init.templateDir`; repo `core.fsmonitor`; repo `.git/hooks/post-checkout`; repo `core.hooksPath=.git/hooks` | unhardened: hooks and fsmonitor run; `-c core.hooksPath=/dev/null` stops template and repo hooks, also over a repo-set `core.hooksPath`; `-c core.fsmonitor=` stops fsmonitor; `-c init.templateDir=` copies no hooks | [VERIFIED: run] |
| E6 | `GIT_TEMPLATE_DIR=<tpl>` + `-c init.templateDir=` | hooks copied (env wins); `clone --template=` copies none | [VERIFIED: run] |
| E7 | `--end-of-options` | accepted by `clone`, `ls-remote`, `fetch`, `config --get-all`, `tag -l`, `update-ref`, `rev-parse --verify --quiet`; **rejected** by `checkout` (`error: pathspec '--end-of-options' did not match any file(s) known to git`, exit 1); `rev-parse` without `--verify` prints `--end-of-options` | [VERIFIED: run] |
| E8 | Node `spawn` detached, `git ls-remote git@stand-in.test:…` with `GIT_SSH_COMMAND` = script that backgrounds `sleep`; `process.kill(-pid, "SIGTERM")` vs `child.kill` vs not detached | group kill: nothing left; `child.kill` or non-detached: the `sleep` survives; detached child's `sid == pgid == pid` | [VERIFIED: run] |
| E9 | detached `git ls-remote http://127.0.0.1:<held>/x.git` | group = `git`, `git remote-http`, `git-remote-http`; after group SIGTERM and `close`, one `[git] <defunct>` zombie stays in the group until reaped (~2 s here), so `kill(-pgid, 0)` still succeeds; then `ESRCH` | [VERIFIED: run] |
| E10 | `git credential fill` with today's env (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`) and `core.askPass=<script>` | askpass ran twice and its answer was returned (`username=fromaskpass`); with `GIT_ASKPASS=` + `credential.interactive=false`: `fatal: could not read Username for 'https://example.test': terminal prompts disabled`, exit 128, askpass not run | [VERIFIED: run] |
| E11 | Node `spawn("/usr/bin/git", …, { cwd: "/nonexistent-dir-xyz" })` | `error ENOENT spawn /usr/bin/git`, no pid, `close -2` | [VERIFIED: run] |
| E12 | planted `git` script in cwd; Node `spawn("git")` with `PATH=.:/usr/bin` and `PATH=:/usr/bin` | `PLANTED-GIT-RAN` both times; `PATH=/usr/bin` → real git | [VERIFIED: run] |
| E13 | `-c core.hooksPath=/dev/null -c alias.zz='!env' zz`; `GIT_CONFIG_COUNT` `credential.interactive=true` + `-c credential.interactive=false` | child env carries `GIT_CONFIG_PARAMETERS='core.hooksPath'='/dev/null' …`; `config --get` → `false` (`-c` read last) | [VERIFIED: run] |
| E14 | clone `http://alice:s3cret@127.0.0.1:<stub>/…` for 403/404/500/401, refused port, DNS | no message contained `s3cret` or `alice:`; 401 with userinfo → `fatal: Authentication failed for 'http://127.0.0.1:18931/auth/x.git/'` | [VERIFIED: run] |
| E15 | stderr corpus (below) | — | [VERIFIED: run] |
| E16 | `GIT_SSH_COMMAND` stubs printing OpenSSH's texts (exit 255); a stub not named `ssh` with `ssh://…:2222` | git appends `fatal: Could not read from remote repository.` + access-rights hint; non-`ssh` basename → `fatal: ssh variant 'simple' does not support setting port`; no ssh binary → `error: cannot run ssh: No such file or directory` / `fatal: unable to fork` | [VERIFIED: run; ssh texts are the stub's copies of OpenSSH, MEDIUM] |

**Stderr corpus (E15, exact lines, exit 128 unless noted):**

| Case | stderr |
|------|--------|
| HTTP 401 | `fatal: could not read Username for 'http://127.0.0.1:18931': terminal prompts disabled` |
| HTTP 401, user in URL | `fatal: could not read Password for 'http://alice@127.0.0.1:18931': terminal prompts disabled` |
| HTTP 403 | `fatal: unable to access 'http://127.0.0.1:18931/forbidden/x.git/': The requested URL returned error: 403` |
| HTTP 404 | `fatal: repository 'http://127.0.0.1:18931/missing/x.git/' not found` |
| HTTP 410 | `fatal: unable to access '…/gone/x.git/': The requested URL returned error: 410` |
| HTTP 500 | `fatal: unable to access '…/err/x.git/': The requested URL returned error: 500` |
| refused port | `fatal: unable to access 'http://127.0.0.1:9/x.git/': Failed to connect to 127.0.0.1 port 9 after 0 ms: Couldn't connect to server` |
| DNS | `fatal: unable to access 'http://nonexistent.invalid/x.git/': Could not resolve host: nonexistent.invalid` |
| `file://` repo missing | `fatal: '<path>' does not appear to be a git repository` / `fatal: Could not read from remote repository.` / `Please make sure you have the correct access rights` / `and the repository exists.` |
| plain path missing | `fatal: repository '<path>' does not exist` |
| `clone --branch nope` | `fatal: Remote branch nope not found in upstream origin` |
| `fetch origin refs/heads/nope` | `fatal: couldn't find remote ref refs/heads/nope` |
| fetch unknown SHA (file) | `fatal: git upload-pack: not our ref <sha>` / `fatal: remote error: upload-pack: not our ref <sha>` |
| `checkout <unknown sha>` | `fatal: reference is not a tree: <sha>` |
| `checkout nope` | `error: pathspec 'nope' did not match any file(s) known to git` (exit 1) |
| no repo (ceiling) | `fatal: not a git repository (or any of the parent directories): .git` |
| ext refused | `fatal: transport 'ext' not allowed` |
| unknown option | `error: unknown option \`no-such-flag'` + usage (exit 129) |
| credential fill, no helper | `fatal: could not read Username for 'https://example.test': terminal prompts disabled` |
| dubious ownership | `fatal: detected dubious ownership in repository at '<path>'` + `git config --global --add safe.directory <path>` hint |
| ssh denied | `git@stand-in.test: Permission denied (publickey).` + git's `Could not read from remote repository.` block |
| ssh unknown host key | `Host key verification failed.` + git's block |
| ssh changed host key | `@@@…` / `@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @` / `@@@…` / `Host key verification failed.` + git's block |
| ssh DNS | `ssh: Could not resolve hostname stand-in.test: Name or service not known` + git's block |

Note: the sandbox network answered a private-range IP with `remote: Destination IP is in a private/reserved range` + 403; that is the sandbox proxy, not git, and is excluded from the corpus.

## Common Pitfalls

### Pitfall 1: the ceiling equals the cwd
**What goes wrong:** a clone directory without `.git` under `<cwd>/.pi/` makes git act on the user's project (E1b).
**How to avoid:** `GIT_CEILING_DIRECTORIES = dirname(realpath(cwd))`, cwd = repo root.
**Warning signs:** a unit test passes in a bare temp dir but nothing tests a temp dir nested in a repo. Add exactly that case (SC3).

### Pitfall 2: binary planting through PATH
**What goes wrong:** `PATH` with `.` or an empty entry runs a cloned repository's `git` (E12); on Windows, CreateProcess search order adds the cwd [ASSUMED for Windows, PITFALLS Pitfall 12 LOW].
**How to avoid:** absolute lookup on every platform; spawn the absolute path; consider dropping relative entries from the child's `PATH` too, so git's own `ssh` and helper lookups cannot be planted (Open Question 6).

### Pitfall 3: flat-config option replacement drops a zone
**What goes wrong:** adding the git-process zone as one more block silently removes the package-manager zone for files matching both blocks, or forbids nothing for `package-install.ts`.
**How to avoid:** the four-block layout in Pattern 6; the import-gate tables in `no-shell-out.test.ts` compute each file's real config.

### Pitfall 4: ENOENT ambiguity
**What goes wrong:** a removed staging dir as cwd reports "git is not installed".
**How to avoid:** `stat` the cwd before spawn; on `ENOENT`, `stat` the resolved binary before choosing `git-missing`.

### Pitfall 5: copying the whole `ms()` lane
**What goes wrong:** stripping `GIT_CONFIG_GLOBAL` breaks every cucumber scenario that stores a credential (`GIT_CONFIG_GLOBAL` points at the sandbox `.gitconfig`) and ignores the user's config.
**How to avoid:** the lane adds only the D-SG-02 variables.

### Pitfall 6: classification order
**What goes wrong:** the generic `Could not read from remote repository` (also printed for a missing `file://` repo and an ssh DNS failure) or `Host key verification failed` (also printed under the changed-key banner) wins too early; `fatal: remote error:` swallows `not our ref`.
**How to avoid:** the ordered table in Pattern 5, one test row per corpus case.

### Pitfall 7: zombies in leftover-process checks
**What goes wrong:** after a group kill, `kill(-pgid, 0)` succeeds for up to ~2 s because an intermediate `git` is a zombie waiting for reaping (E9), so a test asserting "no process left" flakes.
**How to avoid:** list the group with `ps -o pid,stat -g <pgid>` and ignore state `Z`, or let the stand-in's own `close()` wait (Phase 1's `SshGitHost.reset()` waits up to 5 s for stubs, `01-07-SUMMARY.md`). Do not poll real timers in unit tests (unit-test skill); put real-process cases where the launcher already has them (`package-manager.test.ts:588`, `:915` "D-PL9-19: stops the whole process tree…").

### Pitfall 8: `LC_ALL` defeats `LC_MESSAGES=C`
**How to avoid:** move `LC_ALL` to `LC_CTYPE` (upstream `sLo`). One builder table row.

### Pitfall 9: Windows environment spellings
**What goes wrong:** Node on Windows "lexicographically sorts the `env` keys and uses the first one that case-insensitively matches" [CITED: nodejs.org/api/child_process.html]; a user's `Git_Askpass` could win over Pi's `GIT_ASKPASS`.
**How to avoid:** on win32, delete every case variant before setting (upstream `GJe` does), reusing `variable()`-style case folding from `package-manager.ts:286-289`.

### Pitfall 10: behavior change without a scenario
**What goes wrong:** the askpass and credential-cwd changes are user-visible (E10) but have no cucumber scenario, which AGENTS.md requires.
**How to avoid:** Pattern 7 scenarios 5 (and 6).

### Pitfall 11: SC4 wording against the locked decision
**What goes wrong:** SC4 says "no caller narrows on an error name or a message substring", but the decision keeps `isGitNotFoundError` (`orchestrators/marketplace/shared.ts:252-254`, `err.name === "NotFoundError"`), `clone-cache.ts:73/78`, and the classifier's `code` matchers (`git-failure-classifiers.ts:30,102,128`) until Phase 3, and the ROADMAP Phase 3 notes assign their conversion there.
**How to avoid:** scope SC4's verification to `GitCommandError` and record the Phase 3 hand-off in the plan and VERIFICATION.

## Code Examples

### Kind ladder as data (both complexity gates stay flat)

```typescript
// platform/git-failure-kind.ts (sketch) -- rows from the E15/E16 corpus, first match wins
type StderrRow = readonly [GitFailureKind, RegExp];
const STDERR_ROWS: readonly StderrRow[] = [
  ["git-missing", /xcrun: error:/],
  ["git-too-old", /^error: unknown (?:option|switch) /m],
  ["dubious-ownership", /detected dubious ownership in repository at '/],
  ["protocol-refused", /^fatal: transport '[^']+' not allowed/m],
  ["ssh-host-key-changed", /REMOTE HOST IDENTIFICATION HAS CHANGED/],
  ["ssh-host-key-unknown", /Host key verification failed/],
  ["proxy-refused", /^remote: access denied by the git proxy/m],
  ["ssh-auth", /Permission denied \(publickey/],
  // … rows 9-17 of Pattern 5
];
```

### Production binding next to the factory (package-manager precedent)

```typescript
// Source: platform/package-manager.ts:81 and orchestrators/plugin/package-install.ts:164-179
export const NODE_GIT_SPAWN = spawn as ProcessSpawn;     // the only new child_process binding
export function createGitProcess(deps: GitProcessDeps): GitProcess { /* owns the lookup cache */ }
// git-credential.ts replaces NODE_CREDENTIAL_SPAWN with a GitProcess collaborator;
// orchestrators/auth-host.ts:78-81 keeps composing DEFAULT_CREDENTIAL_OPS through
// git-credential.ts's exported production binding, because BLOCK C forbids it to
// import platform/git-process.ts.
```

### git-missing reaches the user through the existing ladder

```typescript
// shared/git-failure-classifiers.ts (sketch): first rung of classifyGitFailure (:161)
if (error instanceof GitCommandError) {
  return reasonOfGitFailure(error.failure, rule); // exhaustive switch + assertNever
}
// orchestrators/marketplace/add.ts:414-427 errorAddReason → classifyGitSourceAccessFailure
// orchestrators/plugin/install.messaging.ts → classifyGitHostFailure (same ladder)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D-21: isomorphic-git, no git binary needed | D-SG-01: system git only | this milestone | git-missing becomes a real failure mode |
| `git credential` with `process.env` + 2 vars, no cwd, SIGTERM only | hardened env, neutral cwd + ceiling, group kill | this phase | askpass no longer runs (E10) |
| `-c protocol.allow=never` (SG-PRC-04 text) | `GIT_ALLOW_PROTOCOL=/` lane | D-SG-02 | holds against user config |
| isomorphic-git error names (`NotFoundError`, `HttpError`) | `GitCommandError` + `instanceof` | Phase 2 (type), Phase 3 (callers) | — |

**Deprecated/outdated:** the D-21 supersession text in `no-shell-out.test.ts:59-138` and its offender message (`:196`); `platform/git.ts`'s header line "Uses pure-JS isomorphic-git, so there is no `git not found on PATH` failure mode (D-21, MA-7)" (`:23-24`) becomes false once the gate lands.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LC_ALL` set by the user overrides `LC_MESSAGES=C` for git's messages | Pattern 2, Pitfall 8 | Classification fails for users with a translated locale; mitigation is cheap either way |
| A2 | macOS shim heuristic (`/usr/bin/git` + no developer dir with a real git) | Pattern 3 | False "git missing" on macOS, or a GUI install prompt; manual macOS check required |
| A3 | Windows `taskkill /T /F` from the launcher pid also stops the real `mingw64\bin\git.exe` and its helpers (the `cmd\git.exe` launcher stays alive as parent) | Pattern 1 | Orphaned git on Windows after timeout; manual Windows check |
| A4 | Windows CreateProcess searches the cwd for a bare name | Pitfall 2 | None if the absolute lookup is used (it is recommended anyway) |
| A5 | `os.tmpdir()` as the neutral cwd for `git credential` is acceptable (no write; NFR-10 untouched) | Pattern 2 | A user's tmp under a repository would be read (ceiling still limits it to tmp itself) |
| A6 | `windowsHide: true` has no downside for console-hosted Pi | Pattern 1 | Cosmetic only |
| A7 | Exact wording of the non-macOS git-missing message (proposal: `Git is required to install marketplaces. Install git, then run the command again.`, from upstream's `Git is required to install marketplaces.` with the restart hint adapted per NFR-2) and of the Windows unsafe-location case (`Command 'git' not found or is in an unsafe location (current directory)`) | Pattern 3, Pattern 7 | Phase 6 rewords anyway; scenarios pin it, so a change later edits those rows |
| A8 | OpenSSH stderr texts in E16 match real ssh (the stub copies them) | Corpus | A row misses on real ssh; Phase 4 re-checks with the probe |

## Open Questions (RESOLVED)

1. **New reason token for git missing.** The D-PL7-01 reason set is closed and append-only (`notify-reasons.ts:18-25`); no existing token fits. Proposal: `git missing` (FailureReason group), following `network unreachable`'s two-word form; `requires git` collides with the soft-dependency marker meaning of `requires pi-subagents`. Touches `notification-types.ts`, `notification-wire.ts`, `notify-reasons.ts`, `test/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, the catalog fixtures, `docs/json-output.md:950`, `docs/output-catalog.md:63`. Needs a decision ID (for example D-SG-07). Recommendation: decide in planning; it is a user-visible token.
   RESOLVED: `git missing` reason token, recorded as D-SG-07 (02-02).
2. **Two kinds outside the locked list.** A closed union needs a total fallback (`failed`) and the local `not-a-repository` (`fatal: not a git repository`, which SC3 produces). Recommendation: add both and record them with the decision; they do not change user-visible behavior.
   RESOLVED: both kinds added, `failed` and `not-a-repository` (02-02).
3. **Neutral cwd for `git credential`.** `os.tmpdir()` (recommended), the agent dir, or a filesystem root. Changing it is user-visible only for a user with a repo-local credential helper in the project they run Pi from.
   RESOLVED: the realpath of `os.tmpdir()` (02-03).
4. **Does the npm runner adopt the Windows cwd-skip rule?** D-SG-04 names git. Applying it to npm is a hardening of D-PL9-18. Recommendation: keep npm's behavior (parameter off) unless the user approves; one parameter either way.
   RESOLVED: npm keeps its behavior; the cwd-skip rule is a git-only parameter (02-01).
5. **"Defaults to `process.env`" vs the unit-test skill.** The skill says "Do not default a parameter to a live boundary". Recommendation: `createGitProcess({ env, spawn, host, … })` with `env` required, and one production binding that passes `process.env` (the `DEFAULT_PACKAGE_INSTALL_OPS` precedent, `package-install.ts:164-179`). That keeps the locked intent (injected env, tests pass `hermeticGitEnvironment` bases). The CONVENTIONS precedent (`tools: HookToolView = createHookToolView(pi)`) allows a defaulted last parameter if the planner prefers the literal wording.
   RESOLVED: `env` is required; one production binding passes `process.env` (02-03).
6. **Filter relative entries out of the child's `PATH`?** Upstream does this only on its `ms()` lane. It closes git's own `ssh`/helper planting (E12 analogue) with no user-visible change; it is not in D-SG-05's list. Recommendation: ask, or record it as part of D-SG-05.
   RESOLVED: relative PATH entries are dropped, as part of D-SG-05 (02-03).
7. **How to "log the git version in the debug output" without a probe (D-SG-06).** `hookDebugLog` has no "enabled" query (`shared/debug-log.ts:22-27`). Recommendation: on a `git-too-old` failure only, run `git --version` (short timeout) and debug-log it; no spawn on the success path.
   RESOLVED: `git --version` runs and is debug-logged only after a `git-too-old` failure (02-04).
8. **Kind → reason mapping scope.** Full exhaustive mapping now (so Phase 3's swap keeps every scenario's reason) or only `git-missing` now. Recommendation: full mapping, because the switch with `assertNever` makes a missing kind a compile error and Phase 3 needs it the day the transport swaps.
   RESOLVED: full kind-to-reason mapping now (02-02).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | all real-git tests, cucumber | ✓ | 2.43.0 | — |
| Node | everything | ✓ (via `/opt/pi-claude-marketplace/bin`) | v24.22.3 | — |
| ssh | real ssh behavior | ✗ | — | Phase 1 stub `ssh` (records argv); real ssh only in the manual macOS/Windows check |
| `ps` (procps) | leftover-process checks | ✓ | — | — |
| python3 | research experiments only | ✓ | — | not needed by the plans |
| macOS host | xcrun shim, osxkeychain, BSD process groups | ✗ | — | manual check by hand |
| Windows host | taskkill tree, `.cmd` refusal, cwd skip, console | ✗ | — | manual check by hand |
| `fd` | 5 Glob scenarios | ✗ | — | known failures, unrelated |

**Missing dependencies with no fallback:** macOS and Windows behavior. Plan a `checkpoint:human-verify` task:
- macOS: (a) without Command Line Tools, `marketplace add owner/repo` shows the `xcode-select --install` message and no install dialog stays; (b) with them, a held clone's timeout leaves no `git`/`git-remote-https` (`ps -g`); (c) `git credential fill` with osxkeychain and no entry returns no credential and opens no askpass.
- Windows: (a) no git on PATH → the requirement message; (b) a `git.exe` placed in the project cwd is skipped; (c) a `git.cmd` first on PATH is refused; (d) a held clone's timeout leaves no `git.exe`/`git-remote-https.exe` in `tasklist`; (e) no console window opens; (f) GCM installed, no stored credential → no GCM window.

**Missing dependencies with fallback:** ssh (stub).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node v24.22.3) + `node:assert/strict`; `@cucumber/cucumber` `^13.3.0` |
| Config file | `package.json` scripts; `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git-process.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-process.ts` (repeat for `process-run.ts`, `git-failure-kind.ts`, `package-manager.ts`, `git-credential.ts`, `git.ts`, `shared/errors.ts`, `shared/git-failure-classifiers.ts`) |
| Gate tests | `npm run test:unpaired` (architecture: no-shell-out, credential leak, closed-set locks) |
| Scenarios | `npm run test:cucumber:profile -- --profile adapter features/marketplace/<new>.feature features/plugin/<new>.feature`, then `--profile builtin` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-PRC-01 | spawn options: absolute git, argv array, `shell: false`, piped stdio, stdin ignore or input-then-EOF, `detached` on POSIX, `windowsHide` | unit (fake spawn) | quick run of `git-process.test.ts` | ❌ Wave 0 |
| SG-PRC-01 | `--end-of-options` per subcommand table; `checkout` operand starting with `-` refused | unit | same | ❌ |
| SG-PRC-01 | chokepoint/whitelist/zone edits | architecture | `npm run test:unpaired` + `npm run fallow` + `npm run lint` | ✅ (edit) |
| SG-PRC-02 | env table: forced vars override user values; Windows spellings removed; `credential.interactive=false` on argv | unit | quick run | ❌ |
| SG-PRC-02 | HTTPS host with `credential` arm, no stored credential → fails, no askpass run, within timeout | unit, real git on `HttpsGitHost` | quick run | ❌ |
| SG-PRC-02 | ssh launch argv carries `-o BatchMode=yes -o StrictHostKeyChecking=yes` after the user's command | unit, real git on `SshGitHost` (launch log argv) | quick run | ❌ |
| SG-PRC-02 | `hold` arm + short timeout → `timeout` kind; group listing has no non-zombie member | unit (real) + process-run unit (fake timers) | quick run; `process-run.test.ts` | ❌ |
| SG-PRC-03 | repo hook, template hook, fsmonitor not run; `ext::`/`fd::`/`git://`/`ftp://`/`ftps://` refused; planted `GIT_DIR` ignored; no-`.git` dir under a repo → `not-a-repository`; symlinked cwd | unit (real git in temp trees) | quick run | ❌ |
| SG-PRC-04 | local lane refuses file/https/ssh/helper under user `protocol.*.allow=always`; local reads work | unit (real git) | quick run | ❌ |
| SG-PRC-05 | corpus table → kind, one row per E15/E16 case; order rows (changed vs unknown key, file-missing vs ssh-auth, not-our-ref vs remote-error); ENOENT with missing cwd ≠ git-missing; redaction of userinfo | unit | `git-failure-kind.test.ts`, `git-process.test.ts` | ❌ |
| SG-PRC-05 | `classifyGitFailure` maps each kind (exhaustive) | unit | `test/shared/git-failure-classifiers.test.ts` | ✅ (extend) |
| SG-PRC-06 | lookup: absolute-only, relative/empty skipped, macOS shim (injected host `darwin`), Windows `.exe`/`.cmd`/`.bat`/cwd skip, positive-only cache, invalidation | unit (injected host) | quick run | ❌ |
| SG-PRC-06 | network verbs throw `git-missing` before isomorphic-git; local verbs do not | unit | `test/platform/git.test.ts` | ✅ (extend) |
| SG-PRC-06 | no git: git-source add / install fail with token + message; path-source add/install and hosted add succeed | cucumber | profile commands above | ❌ |
| SG-PRC-02 (user-visible) | askpass not run during credential lookup | cucumber | same | ❌ |

### Sampling Rate

- **Per task commit:** the owner test(s) and `npm run test:coverage:direct -- <source>` for each touched pair; the hook then runs `npm run check:commit`.
- **Per wave merge:** `npm run check` on the combined tree (AGENTS.md: GSD gates run `npm run check`; a merge does not run the hook).
- **Phase gate:** `npm run check` green, then the manual macOS/Windows checkpoint, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `test/platform/process-run.test.ts` (cases moved from `package-manager.test.ts`)
- [ ] `test/platform/git-process.test.ts`
- [ ] `test/platform/git-failure-kind.test.ts`
- [ ] a process-group listing helper for real-process cases that ignores zombies (test support next to the concern, e.g. `test/platform/process-group.ts`; a non-`.test.ts` file under `test/` makes `check:commit` run all pairs)
- [ ] `features/support/world.ts` `usePiWithoutGit()` and its step; the new feature scenarios
- [ ] No framework install needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (credential helpers) | User's own helpers only; `GIT_ASKPASS=""`, `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `credential.interactive=false` |
| V3 Session Management | no | — |
| V4 Access Control | yes (containment) | NFR-10 as amended by D-SG-03; ceiling keeps git out of the user's project |
| V5 Input Validation | yes | argv arrays, no shell, `--end-of-options` table, leading-`-` refusal, `sanitizeAttrValue` (CR/LF/NUL) for credential stdin, PATH-delimiter refusal for the ceiling |
| V6 Cryptography | no (TLS is git/curl's) | never disable `http.sslVerify`; harness trusts its CA through `GIT_SSL_CAINFO` |
| V7 Error Handling and Logging | yes | stderr redacted before storage; stderr never in `message`; `hookDebugLog` only; AUTH-09 scan extended |
| V10 Malicious Code | yes | hooks, template hooks, fsmonitor, `alternateRefsCommand`, ext/fd protocols, repo-pointer variables, absolute git path |
| V14 Configuration | yes | user config kept; repo-local `core.sshCommand`/`core.askPass`/`core.hooksPath`/`core.fsmonitor` overridden |

### Known Threat Patterns for Node + system git

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Binary planting (`git`, `ssh`) via relative PATH or cwd | Elevation of privilege | Absolute lookup, skip relative entries and cwd matches (E12, D-SG-04) |
| Hook / fsmonitor / template code execution from a clone or path-source dir | Elevation of privilege | `-c core.hooksPath=/dev/null`, `-c core.fsmonitor=`, `-c init.templateDir=`, delete `GIT_TEMPLATE_DIR` (E5, E6) |
| Argument injection (`--upload-pack=`, `-o`) through marketplace data | Tampering | `--end-of-options` where accepted, refuse leading `-` elsewhere (E7) |
| `ext::`/`fd::` transport command execution | Elevation of privilege | `protocol.{ext,fd,git,ftp,ftps}.allow=never`; local lane `GIT_ALLOW_PROTOCOL=/` |
| Discovery into the user's project repository (wrong repo mutated, project config read) | Tampering / Information disclosure | Ceiling = parent of realpath(cwd) (E1, E2) |
| Prompt hijack of Pi's TUI, hang | Denial of service | No-prompt env, setsid via `detached`, BatchMode, group-kill timeout |
| Credential in stderr or error message | Information disclosure | Userinfo redaction, stderr outside `message`, credential input never interpolated (AUTH-09 scan) |
| Orphaned helpers holding sockets after abort | Denial of service | Process-group kill with SIGKILL escalation; Windows `taskkill /T /F` |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `platform/package-manager.ts` (1-470), `platform/git-credential.ts` (1-355), `platform/git.ts` (1-245, 880-986), `orchestrators/marketplace/shared.ts` (130-340), `orchestrators/marketplace/add.ts` (380-440, 1310-1380), `shared/git-failure-classifiers.ts` (1-247), `shared/errors.ts` (586-700, 1280-1305), `shared/notification-types.ts` (20-140, 280-300), `shared/notification-wire.ts` (90-170), `shared/notify-reasons.ts` (1-60, 130-175), `shared/debug-log.ts`, `rule-packs/architecture.json` (108-126), `eslint.config.js` (25-215, 505-620), `test/architecture/no-shell-out.test.ts`, `test/architecture/gate-targets.ts` (130-260), `test/architecture/no-credential-leak.test.ts` (55-130, 340-440), `features/support/world.ts` (680-712, 1140-1215), `features/support/pi-process.ts` (140-200), `features/lib/pi-rpc.ts` (190-260), `features/lib/ssh-git-host/host.ts`, `orchestrators/plugin/marketplace-tag-probe.ts` (1-60), `.agents/skills/{local-verification,typescript-unit-tests,cucumber,committing}`.
- `02-EVIDENCE.md` (Claude Code 2.1.330 records Q1, Q3, Q11, Q12, Q14, Q17, corrections C1-C9).
- git 2.43.0 experiments E1-E16 (this session, scratchpad only).

### Secondary (MEDIUM confidence)
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - `detached` (new process group and session on POSIX; own console window on Windows), `windowsHide`, Windows env case handling, `.bat`/`.cmd` need a shell, `execFile` `maxBuffer` default.
- `.planning/research/PITFALLS.md` Pitfalls 3, 8, 11, 12, 13, 18 and `ARCHITECTURE.md` gate table (prefer 02-EVIDENCE.md where they differ).

### Tertiary (LOW confidence)
- macOS `xcrun: error: invalid active developer path` behavior: [Built In](https://builtin.com/software-engineering-perspectives/invalid-active-developer-path), [Apple developer forums](https://developer.apple.com/forums/thread/711512), [inventivehq](https://inventivehq.com/knowledge-base/macos/xcrun-invalid-active-developer-path-fix) - background for the shim heuristic only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependency; Node and git versions verified.
- Architecture: HIGH for the gate edits and the first-consumer analysis (code read); MEDIUM for module boundaries (recommendations within Claude's discretion).
- Pitfalls: HIGH for E1-E16 on Linux git 2.43; MEDIUM for macOS/Windows (manual check).
- Kind table: HIGH for rows backed by E15; MEDIUM for ssh rows (stub copies of OpenSSH text) and `xcrun`.

**Research date:** 2026-11-23
**Valid until:** 2026-12-23 (stable domain; re-check if the sandbox git version changes)
